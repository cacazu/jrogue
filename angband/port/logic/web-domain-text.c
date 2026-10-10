/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-domain-text.h"
#ifdef __EMSCRIPTEN__
#include "cave.h"
#include "effects.h"
#include "init.h"
#include "object.h"
#include "obj-curse.h"
#include "player.h"
#include "player-timed.h"
#include "trap.h"
#include "web-death-cause.h"
#include "web-semantic.h"
#include "web-character-matrix.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
struct ab_domain_binding {
 enum ab_domain_kind kind;
 int index;
 enum ab_domain_field field;
 int slot;
 const char *id;
 unsigned tags;
 bool register_message;
};
#include "../migration/domain-text-data/domain-bindings.inc"
static uint32_t domain_status;
struct ab_domain_info_scope { const char *context; unsigned row; };
static struct ab_domain_info_scope info_scopes[16];
static unsigned info_depth;
static unsigned suppressed_depth;
struct ab_domain_textblock_tag { const void *pointer;char context[64];uint64_t generation; };
static struct ab_domain_textblock_tag textblock_tags[64];
static uint64_t textblock_generation;
const char *ab_domain_id(enum ab_domain_kind kind,int index,
 enum ab_domain_field field,int slot)
{
 size_t i;
 for(i=0;i<N_ELEMENTS(ab_domain_bindings);i++) {
  const struct ab_domain_binding *b=&ab_domain_bindings[i];
  if(b->kind==kind && b->index==index && b->field==field && b->slot==slot)return b->id;
 }
 return NULL;
}
static const struct ab_domain_binding *binding_id(const char *id)
{
 size_t i;if(!id)return NULL;
 for(i=0;i<N_ELEMENTS(ab_domain_bindings);i++)
  if(!strcmp(ab_domain_bindings[i].id,id))return &ab_domain_bindings[i];
 return NULL;
}
static const char *binding_source(const struct ab_domain_binding *b)
{
 if(b->index<0)return NULL;
 switch(b->kind) {
 case AB_DOMAIN_OBJECT:
  if(b->index>=z_info->k_max)return NULL;
  if(b->field==AB_DOMAIN_EFFECT_MESSAGE)return k_info[b->index].effect_msg;
  if(b->field==AB_DOMAIN_VISIBLE_MESSAGE)return k_info[b->index].vis_msg;
  break;
 case AB_DOMAIN_ACTIVATION:
  if(b->index>=z_info->act_max)return NULL;
  if(b->field==AB_DOMAIN_MESSAGE)return activations[b->index].message;
  break;
 case AB_DOMAIN_TIMED:
  if(b->index>=TMD_MAX)return NULL;
  if(b->field==AB_DOMAIN_END)return timed_effects[b->index].on_end;
  if(b->field==AB_DOMAIN_INCREASE)return timed_effects[b->index].on_increase;
  if(b->field==AB_DOMAIN_DECREASE)return timed_effects[b->index].on_decrease;
  if(b->field==AB_DOMAIN_ENTER || b->field==AB_DOMAIN_LEAVE) {
   struct timed_grade *grade;unsigned limit=0;
   for(grade=timed_effects[b->index].grade;grade && limit++<256;grade=grade->next)
    if(grade->grade==b->slot)return b->field==AB_DOMAIN_ENTER?grade->up_msg:grade->down_msg;
  }
  break;
 case AB_DOMAIN_TRAP:
  if(b->index>=z_info->trap_max)return NULL;
  if(b->field==AB_DOMAIN_TRIGGER)return trap_info[b->index].msg;
  if(b->field==AB_DOMAIN_SAVED)return trap_info[b->index].msg_good;
  if(b->field==AB_DOMAIN_FAILED)return trap_info[b->index].msg_bad;
  if(b->field==AB_DOMAIN_EXTRA)return trap_info[b->index].msg_xtra;
  break;
 case AB_DOMAIN_TERRAIN:
  if(b->index>=FEAT_MAX)return NULL;
  if(b->field==AB_DOMAIN_WALK_WARN)return f_info[b->index].walk_msg;
  if(b->field==AB_DOMAIN_RUN_WARN)return f_info[b->index].run_msg;
  if(b->field==AB_DOMAIN_DAMAGE)return f_info[b->index].hurt_msg;
  if(b->field==AB_DOMAIN_DEATH)return f_info[b->index].die_msg;
  if(b->field==AB_DOMAIN_CONFUSED)return f_info[b->index].confused_msg;
  break;
 case AB_DOMAIN_SHAPE: {
  struct player_shape *shape;unsigned limit=0;
  for(shape=shapes;shape && limit++<256;shape=shape->next)if(shape->sidx==b->index) {
   if(b->field==AB_DOMAIN_EFFECT_MESSAGE) {
    struct effect *effect=shape->effect;int slot=b->slot;
    while(effect && slot-->0)effect=effect->next;
    return effect?effect->msg:NULL;
   }
   if(b->field==AB_DOMAIN_BLOW) {
    struct player_blow *blow=shape->blows;int slot=b->slot;
    while(blow && slot-->0)blow=blow->next;
    return blow?blow->name:NULL;
   }
   break;
  }
  break;
 }
 case AB_DOMAIN_CURSE:
  if(b->index>=z_info->curse_max)return NULL;
  if(b->field==AB_DOMAIN_EFFECT_MESSAGE && curses[b->index].obj)return curses[b->index].obj->effect_msg;
  break;
 case AB_DOMAIN_ARTIFACT:
  if(b->index>=z_info->a_max)return NULL;
  if(b->field==AB_DOMAIN_ALT_ACTIVATION)return a_info[b->index].alt_msg;
  break;
 default:break;
 }
 return NULL;
}
bool ab_domain_register_messages(void)
{
 size_t i;domain_status=0;info_depth=0;suppressed_depth=0;
 memset(info_scopes,0,sizeof(info_scopes));
 memset(textblock_tags,0,sizeof(textblock_tags));textblock_generation=0;
 for(i=0;i<N_ELEMENTS(ab_domain_bindings);i++) {
  const struct ab_domain_binding *b=&ab_domain_bindings[i];const char *source;
  if(!b->register_message)continue;
  source=binding_source(b);
  if(!source || !ab_dc_register_source_message(source,b->id)) {
   fprintf(stderr,"Angband domain binding failed: row=%zu id=%s kind=%d index=%d field=%d slot=%d pointer=%p reason=%s\n",
    i,b->id,(int)b->kind,b->index,(int)b->field,b->slot,(const void *)source,
    source?"source-message-registry-rejected":"canonical-source-missing");
   fflush(stderr);
   domain_status=1;return false;
  }
 }
 return true;
}
uint32_t ab_domain_status(void){return domain_status;}
const char *ab_domain_source_id(const char *native_source)
{return ab_dc_source_message_id(native_source);}
const char *ab_domain_curse_name_id(int index)
{return ab_domain_id(AB_DOMAIN_CURSE,index,AB_DOMAIN_NAME,0);}
const char *ab_domain_curse_description_id(int index)
{return ab_domain_id(AB_DOMAIN_CURSE,index,AB_DOMAIN_DESCRIPTION,0);}
void ab_domain_message_pointer(const char *native_source,int sound)
{
 struct ab_semantic_event event;const char *id=ab_domain_source_id(native_source);
 const struct ab_domain_binding *b=binding_id(id);
 if(!b || b->tags){domain_status=2;return;}
 ab_semantic_event_begin(&event,id,"message","domain-message","selected",0,sound);
 ab_semantic_event_emit(&event);
}
const char *ab_domain_expect_check(const char *native_source)
{return ab_ui_check_source(ab_domain_source_id(native_source),native_source);}
const char *ab_domain_hurt(const char *native_source,int damage,bool show)
{
 struct ab_semantic_event event;const char *id=ab_domain_source_id(native_source);
 if(!id){domain_status=2;return native_source;}
 ab_semantic_event_begin(&event,show?"domain.message.terrain.damage_with_amount":"domain.message.terrain.damage","message","domain-message","terrain",0,-1);
 ab_semantic_param_begin(&event,"message","localized_text");
 ab_semantic_json_literal(&event,"{\"id\":");ab_semantic_json_string(&event,id);ab_semantic_json_literal(&event,"}");ab_semantic_param_end(&event);
 if(show){ab_semantic_param_begin(&event,"damage","integer");ab_semantic_json_int32(&event,damage);ab_semantic_param_end(&event);}
 ab_semantic_event_emit(&event);return native_source;
}
void ab_domain_custom_begin(struct ab_domain_custom_capture *capture,
 const char *native_source,bool has_object,int number,int sound)
{
 const struct ab_domain_binding *b;
 memset(capture,0,sizeof(*capture));
 capture->id=ab_domain_source_id(native_source);b=binding_id(capture->id);
 if(!b || number<0 || number>255 || (!has_object && number)){capture->id=NULL;domain_status=2;return;}
 capture->tags=b->tags;capture->has_object=has_object;capture->number=(uint8_t)number;capture->sound=sound;
}
void ab_domain_custom_snapshot(struct ab_domain_custom_capture *capture,
 const char *native_buffer,bool kind)
{
 struct ab_naming_snapshot *target=kind?&capture->kind:&capture->name;
 if(!capture->id)return;
 ab_naming_snapshot_release(target);
 if(!ab_naming_copy_object_snapshot(target,native_buffer))domain_status=3;
}
void ab_domain_custom_hands(struct ab_domain_custom_capture *capture,bool kind)
{
 static const char value[]="{\"schema_version\":2,\"mode\":0,\"native_max_bytes\":1024,\"parts\":[{\"kind\":\"literal\",\"name_id\":\"domain.custom_message.hands\"}],\"complete\":true}";
 struct ab_naming_snapshot *target=kind?&capture->kind:&capture->name;
 if(!capture->id)return;
 ab_naming_snapshot_release(target);target->json=malloc(sizeof(value));
 if(!target->json){domain_status=3;return;}
 memcpy(target->json,value,sizeof(value));target->length=(uint32_t)sizeof(value)-1;
}
static void custom_count(struct ab_semantic_event *event,const char *name,
 const char *type,const struct ab_domain_custom_capture *capture)
{
 ab_semantic_param_begin(event,name,type);
 ab_semantic_json_literal(event,"{\"has_object\":");ab_semantic_json_bool(event,capture->has_object);
 ab_semantic_json_literal(event,",\"number\":");ab_semantic_json_int32(event,capture->number);
 ab_semantic_json_literal(event,"}");ab_semantic_param_end(event);
}
void ab_domain_custom_finish(struct ab_domain_custom_capture *capture)
{
 if(capture->id && (((capture->tags&1U) && !capture->name.json) ||
  ((capture->tags&2U) && !capture->kind.json))) {domain_status=3;capture->id=NULL;}
 if(capture->id) {
  struct ab_semantic_event event;
  ab_semantic_event_begin(&event,capture->id,"message","domain-message","custom",0,capture->sound);
  if(capture->tags&1U)ab_naming_param_snapshot(&event,"name","KnownObjectDescription",&capture->name);
  if(capture->tags&2U)ab_naming_param_snapshot(&event,"kind","KnownObjectDescription",&capture->kind);
  if(capture->tags&4U)custom_count(&event,"s","DomainCustomVerbSuffix",capture);
  if(capture->tags&8U)custom_count(&event,"is","DomainCustomCopula",capture);
  ab_semantic_event_emit(&event);
 }
 ab_naming_snapshot_release(&capture->name);ab_naming_snapshot_release(&capture->kind);
 capture->id=NULL;
}
void ab_domain_info_begin(const char *context)
{
 if(!context || suppressed_depth || info_depth>=N_ELEMENTS(info_scopes)){
  domain_status=4;suppressed_depth++;return;
 }
 info_scopes[info_depth++]=(struct ab_domain_info_scope){context,0};
 ab_ui_scope_begin(context,true);
}
const char *ab_domain_info_context(void)
{return ab_character_export_active()?"character-export":(!suppressed_depth && info_depth?info_scopes[info_depth-1].context:NULL);}
static struct ab_domain_info_scope *info_row(char widget[48])
{
 struct ab_domain_info_scope *scope;
 static struct ab_domain_info_scope export_scope={"character-export",0};
 /* Existing object/lore producers append to one source-owned export batch. */
 if(ab_character_export_active()) {
  return ab_character_export_widget(widget,48)?&export_scope:NULL;
 }
 if(suppressed_depth || !info_depth)return NULL;
 scope=&info_scopes[info_depth-1];
 if(scope->row>=512){domain_status=4;return NULL;}
 snprintf(widget,48,"row.%u.label",scope->row++);
 return scope;
}
bool ab_domain_info_event_begin(struct ab_semantic_event *event,const char *id)
{
 struct ab_domain_info_scope *scope;char widget[48];
 if(!event || !id || !id[0])return false;
 scope=info_row(widget);if(!scope)return false;
 ab_semantic_event_begin(event,id,"ui",scope->context,widget,0,-1);
 if(!event->valid){ab_semantic_event_discard(event);domain_status=4;return false;}
 return true;
}
void ab_domain_info_emit(const char *id,const struct ab_ui_param *params,size_t count)
{
 struct ab_domain_info_scope *scope;char widget[48];
 scope=info_row(widget);if(!scope)return;
 if(id)ab_ui_emit(scope->context,widget,id,params,count);
 else {char unsupported[80];struct ab_semantic_event event;
  if(ab_character_export_active())ab_character_export_reject();
  snprintf(unsupported,sizeof(unsupported),"__unsupported:%s",widget);
  ab_semantic_event_begin(&event,"","ui",scope->context,unsupported,0,-1);ab_semantic_event_emit_control(&event);
 }
}
void ab_domain_info_selected(enum ab_domain_kind kind,int index,
 enum ab_domain_field field,int slot)
{
 const char *id=ab_domain_id(kind,index,field,slot);
 if(kind==AB_DOMAIN_ACTIVATION && field==AB_DOMAIN_DESCRIPTION && id) {
  struct ab_ui_param p=AB_UI_REF("effect",id);
  ab_domain_info_emit("domain.info.activation_description",&p,1);
 } else ab_domain_info_emit(id,NULL,0);
}
void ab_domain_curse_info(int curse_index,bool permanent)
{
 const char *id=ab_domain_id(AB_DOMAIN_CURSE,curse_index,AB_DOMAIN_DESCRIPTION,0);
 struct ab_ui_param p=AB_UI_REF("curse",id);
 if(!id){ab_domain_info_emit(NULL,NULL,0);return;}
 ab_domain_info_emit(permanent?"domain.info.permanent_curse_description":"domain.info.curse_description",&p,1);
}
void ab_domain_info_commit(void){if(!suppressed_depth && info_depth)ab_ui_scope_commit();}
void ab_domain_info_close(void)
{
 if(suppressed_depth){suppressed_depth--;return;}
 if(!info_depth)return;
 ab_ui_scope_end();info_depth--;
}
void ab_domain_info_tag(const void *native_textblock,const char *context)
{
 size_t i,slot=N_ELEMENTS(textblock_tags),length;
 if(!native_textblock || !context)return;
 length=strlen(context);
 if(!length || length>=sizeof(textblock_tags[0].context) || textblock_generation==UINT64_MAX){domain_status=5;return;}
 for(i=0;i<N_ELEMENTS(textblock_tags);i++) {
  if(textblock_tags[i].pointer==native_textblock){slot=i;break;}
  if(!textblock_tags[i].pointer && slot==N_ELEMENTS(textblock_tags))slot=i;
 }
 if(slot==N_ELEMENTS(textblock_tags)){domain_status=5;return;}
 textblock_tags[slot].pointer=native_textblock;
 memcpy(textblock_tags[slot].context,context,length+1);
 textblock_tags[slot].generation=++textblock_generation;
}
void ab_domain_info_display_end(const void *native_textblock)
{
 size_t i,j;
 for(i=0;i<N_ELEMENTS(textblock_tags);i++)if(textblock_tags[i].pointer==native_textblock) {
  for(j=0;j<N_ELEMENTS(textblock_tags);j++)
   if(textblock_tags[j].pointer && !strcmp(textblock_tags[j].context,textblock_tags[i].context) &&
    textblock_tags[j].generation>textblock_tags[i].generation)return;
  ab_ui_reset(textblock_tags[i].context);return;
 }
}
void ab_domain_info_forget(const void *native_textblock)
{
 size_t i;
 for(i=0;i<N_ELEMENTS(textblock_tags);i++)if(textblock_tags[i].pointer==native_textblock) {
  memset(&textblock_tags[i],0,sizeof(textblock_tags[i]));return;
 }
}
void *ab_domain_info_end_result(void *native_result)
{
 const char *context=ab_domain_info_context();
 if(context)ab_domain_info_tag(native_result,context);
 ab_domain_info_close();return native_result;
}
#endif
