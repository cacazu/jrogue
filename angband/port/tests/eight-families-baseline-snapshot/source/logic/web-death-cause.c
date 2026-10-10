/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-death-cause.h"
#ifdef __EMSCRIPTEN__
#include "web-naming.h"
#include "web-ui-text.h"
#include "web-semantic.h"
#include "cave.h"
#include "effects.h"
#include "object.h"
#include "score.h"
#include "trap.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#define AB_DC_MAX_BYTES (16U*1024U)
#define AB_DC_SOURCE_ROWS 2048U
extern uint32_t ab_rs_death_commit(const uint8_t *bytes,uint32_t length);
extern void ab_rs_death_clear(void);
extern const uint8_t *ab_rs_death_current(void);
extern const uint8_t *ab_rs_death_score(const uint8_t *record,uint32_t length);
extern uint32_t ab_rs_death_score_bind(const uint8_t *record,uint32_t length,uint32_t current);
extern uint32_t ab_rs_death_scores_retain(const uint8_t *records,uint32_t count);
_Static_assert(sizeof(struct high_score)==126,"pinned original score byte identity");
struct ab_dc_source { uintptr_t address; char id[128]; };
static struct ab_dc_source *sources;
static size_t source_count;
struct ab_dc_pending { const struct ab_dc_capture *borrowed; const char *buffer; struct ab_dc_capture owned; };
static struct ab_dc_pending pending[16];
static unsigned depth;
void ab_dc_capture_release(struct ab_dc_capture *capture) {
 if(capture){free(capture->json);memset(capture,0,sizeof(*capture));}
}
static void begin(struct ab_semantic_event *event,const char *id) {
 memset(event,0,sizeof(*event));event->valid=id!=NULL;
 ab_semantic_json_literal(event,"{\"id\":");ab_semantic_json_string(event,id);
 ab_semantic_json_literal(event,",\"params\":{");
}
static void finish(struct ab_dc_capture *capture,struct ab_semantic_event *event) {
 if(event->parameter_open)event->valid=false;
 ab_semantic_json_literal(event,"}}");ab_dc_capture_release(capture);
 if(event->valid && event->length<=AB_DC_MAX_BYTES){capture->json=event->data;capture->length=(uint32_t)event->length;event->data=NULL;}
 ab_semantic_event_discard(event);
}
void ab_dc_capture_fixed(struct ab_dc_capture *capture,const char *id) {
 struct ab_semantic_event event;begin(&event,id);finish(capture,&event);
}
static void named(struct ab_dc_capture *capture,const char *buffer,bool object) {
 struct ab_naming_snapshot snapshot={0};struct ab_semantic_event event;
 if(object)ab_naming_copy_object_snapshot(&snapshot,buffer);
 else ab_naming_copy_monster_snapshot(&snapshot,buffer);
 begin(&event,object?"interface.death.cause.object":"interface.death.cause.monster");
 ab_naming_param_snapshot(&event,object?"object":"monster",object?"KnownObjectDescription":"MonsterDescription",&snapshot);
 ab_naming_snapshot_release(&snapshot);finish(capture,&event);
}
void ab_dc_capture_monster(struct ab_dc_capture *capture,const char *buffer){named(capture,buffer,false);}
void ab_dc_capture_object(struct ab_dc_capture *capture,const char *buffer){named(capture,buffer,true);}
void ab_dc_capture_trap(struct ab_dc_capture *capture,const struct trap_kind *trap) {
 struct ab_semantic_event event;const char *id=trap?ab_ui_trap_id(trap->desc):NULL;
 begin(&event,"interface.death.cause.trap");ab_semantic_param_begin(&event,"trap","TrapName");
 ab_semantic_json_literal(&event,"{\"name_id\":");ab_semantic_json_string(&event,id);ab_semantic_json_literal(&event,"}");
 ab_semantic_param_end(&event);finish(capture,&event);
}
void ab_dc_capture_chest(struct ab_dc_capture *capture,const struct chest_trap *trap) {
 const char *id=NULL;
 if(trap && trap->code && trap->msg_death) {
  if((!strcmp(trap->code,"LOSE_STR") || !strcmp(trap->code,"LOSE_CON")) && !strcmp(trap->msg_death,"a poison needle"))id="interface.death.cause.chest_needle";
  else if(!strcmp(trap->code,"EXPLODE") && !strcmp(trap->msg_death,"an exploding chest"))id="interface.death.cause.chest_explosion";
 }
 ab_dc_capture_fixed(capture,id);
}
bool ab_dc_register_source_message(const char *address,const char *id) {
 size_t i,n;
 if(!address || !id || !(n=strlen(id)) || n>127)return false;
 for(i=0;i<n;i++)if(!((id[i]>='a'&&id[i]<='z')||(id[i]>='0'&&id[i]<='9')||id[i]=='.'||id[i]=='_'||id[i]=='-'))return false;
 for(i=0;i<source_count;i++)if(sources[i].address==(uintptr_t)address)break;
 if(i==source_count){
  if(source_count>=AB_DC_SOURCE_ROWS)return false;
  if(!sources){sources=calloc(AB_DC_SOURCE_ROWS,sizeof(*sources));if(!sources)return false;}
  source_count++;
 }
 sources[i].address=(uintptr_t)address;memcpy(sources[i].id,id,n+1);return true;
}
const char *ab_dc_source_message_id(const char *address) {
 size_t i;if(!address)return NULL;
 for(i=0;i<source_count;i++)if(sources[i].address==(uintptr_t)address)return sources[i].id;
 return NULL;
}
void ab_dc_unregister_source_message(const char *address) {
 size_t i;if(!address)return;
 for(i=0;i<source_count;i++)if(sources[i].address==(uintptr_t)address){sources[i]=sources[--source_count];memset(&sources[source_count],0,sizeof(*sources));return;}
}
void ab_dc_registry_reset(void) {
 unsigned i;for(i=0;i<depth;i++)ab_dc_capture_release(&pending[i].owned);
 memset(pending,0,sizeof(pending));depth=0;free(sources);sources=NULL;source_count=0;
}
static void register_selected(const char *address,const char *id) {
 if(!ab_dc_register_source_message(address,id))quit("Death source registry integration failed");
}
void ab_dc_register_shape_effect(const char *shape,const struct effect *effect) {
 if(!shape || !effect || effect->index!=EF_DAMAGE || !effect->msg)return;
 if(!strcmp(shape,"bat") && !strcmp(effect->msg,"taking bat form"))register_selected(effect->msg,"domain.shape.bat.effect_message");
 else if(!strcmp(shape,"warg") && !strcmp(effect->msg,"taking warg form"))register_selected(effect->msg,"domain.shape.warg.effect_message");
 else if(!strcmp(shape,"vampire") && !strcmp(effect->msg,"taking vampire form"))register_selected(effect->msg,"domain.shape.vampire.effect_message");
}
void ab_dc_register_class_effect(const char *class_name,const char *spell,const struct effect *effect) {
 if(!class_name || strcmp(class_name,"Necromancer") || !spell || !effect || effect->index!=EF_DAMAGE || !effect->msg)return;
 if(!strcmp(spell,"Shadow Shift") && !strcmp(effect->msg,"shadow shifting"))register_selected(effect->msg,"angband.player_class.necromancer.book.dark_rituals.spell.shadow_shift.effect.self_damage.death_reason");
 else if(!strcmp(spell,"Power Sacrifice") && !strcmp(effect->msg,"self sacrifice"))register_selected(effect->msg,"angband.player_class.necromancer.book.corruption_of_spirit.spell.power_sacrifice.effect.self_damage.death_reason");
 else if(!strcmp(spell,"Curse") && !strcmp(effect->msg,"performing a curse"))register_selected(effect->msg,"angband.player_class.necromancer.book.corruption_of_spirit.spell.curse.effect.self_damage.death_reason");
}
void ab_dc_capture_source(struct ab_dc_capture *capture,const char *message) {
 struct ab_semantic_event event;const char *id=ab_dc_source_message_id(message);
 begin(&event,"interface.death.cause.source_effect");ab_semantic_param_begin(&event,"effect","localized_text");
 ab_semantic_json_string(&event,id);ab_semantic_param_end(&event);finish(capture,&event);
}
void ab_dc_push(const struct ab_dc_capture *capture,const char *buffer) {
 if(depth>=16)quit("Death cause scope integration failed");
 pending[depth++]=(struct ab_dc_pending){.borrowed=capture,.buffer=buffer};
}
void ab_dc_push_fixed(const char *id) {
 ab_dc_push(NULL,NULL);ab_dc_capture_fixed(&pending[depth-1].owned,id);pending[depth-1].borrowed=&pending[depth-1].owned;
}
void ab_dc_pop(void) {
 if(!depth)quit("Death cause scope integration failed");
 depth--;ab_dc_capture_release(&pending[depth].owned);memset(&pending[depth],0,sizeof(pending[depth]));
}
void ab_dc_commit(const char *buffer) {
 const struct ab_dc_capture *capture=NULL;
 if(depth && (!pending[depth-1].buffer || pending[depth-1].buffer==buffer))capture=pending[depth-1].borrowed;
 ab_rs_death_commit(capture?(const uint8_t*)capture->json:NULL,capture?capture->length:0);
}
void ab_dc_set_fixed(const char *id) {
 struct ab_dc_capture capture={0};ab_dc_capture_fixed(&capture,id);
 ab_rs_death_commit((const uint8_t*)capture.json,capture.length);ab_dc_capture_release(&capture);
}
void ab_dc_clear(void){ab_rs_death_clear();}
const struct feature *ab_dc_terrain(const struct feature *feature) {
 if(depth && feature && feature->fidx==FEAT_LAVA && feature->die_msg && !strcmp(feature->die_msg,"burning to a cinder in lava")) {
  ab_dc_capture_fixed(&pending[depth-1].owned,"interface.death.cause.lava");pending[depth-1].borrowed=&pending[depth-1].owned;
 }
 return feature;
}
static void emit(const char *context,const char *widget,const char *id,const uint8_t *cause,bool with_depth,int depth_value) {
 struct ab_semantic_event event;ab_semantic_event_begin(&event,id,"ui",context,widget,0,-1);
 ab_semantic_param_begin(&event,"cause","localized_text");
 if(cause)ab_semantic_json_literal(&event,(const char*)cause);else event.valid=false;
 ab_semantic_param_end(&event);
 if(with_depth){ab_semantic_param_begin(&event,"depth","integer");ab_semantic_json_int32(&event,depth_value);ab_semantic_param_end(&event);}
 ab_semantic_event_emit(&event);
}
void ab_dc_emit_current(const char *context,const char *widget,const char *id){emit(context,widget,id,ab_rs_death_current(),false,0);}
void ab_dc_emit_score(const struct high_score *score,int index,bool town,int depth_value) {
 char widget[48];snprintf(widget,sizeof(widget),"row.%d.cause",index);
 emit("score",widget,town?"interface.score.row.cause.town":"interface.score.row.cause.dungeon",ab_rs_death_score((const uint8_t*)score,(uint32_t)sizeof(*score)),!town,depth_value);
}
void ab_dc_score_enter(const struct high_score *entry,const struct high_score *scores,size_t count) {
 size_t i;if(count>100)quit("Death score registry integration failed");
 if(ab_rs_death_scores_retain((const uint8_t*)scores,(uint32_t)count))quit("Death score retention integration failed");
 for(i=0;i<count;i++)if(!memcmp(entry,&scores[i],sizeof(*entry))){ab_rs_death_score_bind((const uint8_t*)entry,(uint32_t)sizeof(*entry),1);break;}
}
void ab_dc_score_preview(const struct high_score *entry){ab_rs_death_score_bind((const uint8_t*)entry,(uint32_t)sizeof(*entry),0);}
const char *ab_dc_date(const char *native_date) {
 char date[25];size_t length=native_date?strlen(native_date):0;
 if(length>24)length=24;memcpy(date,native_date?native_date:"",length);date[length]=0;
 ab_ui_emit("death","date","interface.death.date",(const struct ab_ui_param[]){AB_UI_OPAQUE("date","opaque_calendar_date",date)},1);
 return native_date;
}
#endif
