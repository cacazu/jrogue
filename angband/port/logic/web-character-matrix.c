/* SPDX-License-Identifier: GPL-2.0-only */
/* Observes only the selected canonical entry and final native renderer branch.
 * No gameplay lookup, value recomputation, English parsing or RNG call. */
#include "angband.h"
#include "ui-term.h"
#include "web-character-matrix.h"
#ifdef __EMSCRIPTEN__
#include "web-naming.h"
#include "web-interface-text.h"
#include "web-death-cause.h"
#include "web-message-recall.h"
#include "web-semantic.h"
#include <string.h>
#define AB_MATRIX_MAX_SLOTS 12
#define AB_MATRIX_MAX_VALUE_WIDTH 16
#define AB_EXPORT_MAX_ROWS 16384U
static struct { bool active,row_active; int row,slots; const char *label; } matrix;
static struct { bool active,basics,failed; unsigned int row; } exported;
#define AB_EXPORT_LABELS 128U
static struct {char key[96],id[192];} export_labels[AB_EXPORT_LABELS];
static unsigned export_label_count;
static struct { bool valid; char key[96],id[192]; } export_pending_static;
struct entry_id { const char *source,*id; };
static const struct entry_id entry_ids[] = {
 {"stat_mod_ui_compact_0<STR>","angband.character.matrix.label.stat_mod_ui_compact_0_str.full"},
 {"stat_mod_ui_compact_0<INT>","angband.character.matrix.label.stat_mod_ui_compact_0_int.full"},
 {"stat_mod_ui_compact_0<WIS>","angband.character.matrix.label.stat_mod_ui_compact_0_wis.full"},
 {"stat_mod_ui_compact_0<DEX>","angband.character.matrix.label.stat_mod_ui_compact_0_dex.full"},
 {"stat_mod_ui_compact_0<CON>","angband.character.matrix.label.stat_mod_ui_compact_0_con.full"},

 {"resist_ui_compact_0<ACID>","angband.character.matrix.label.resist_ui_compact_0_acid.full"},
 {"resist_ui_compact_0<ELEC>","angband.character.matrix.label.resist_ui_compact_0_elec.full"},
 {"resist_ui_compact_0<FIRE>","angband.character.matrix.label.resist_ui_compact_0_fire.full"},
 {"resist_ui_compact_0<COLD>","angband.character.matrix.label.resist_ui_compact_0_cold.full"},
 {"resist_ui_compact_0<POIS>","angband.character.matrix.label.resist_ui_compact_0_pois.full"},
 {"resist_ui_compact_0<LIGHT>","angband.character.matrix.label.resist_ui_compact_0_light.full"},
 {"resist_ui_compact_0<DARK>","angband.character.matrix.label.resist_ui_compact_0_dark.full"},
 {"resist_ui_compact_0<SOUND>","angband.character.matrix.label.resist_ui_compact_0_sound.full"},
 {"resist_ui_compact_0<SHARD>","angband.character.matrix.label.resist_ui_compact_0_shard.full"},
 {"resist_ui_compact_0<NEXUS>","angband.character.matrix.label.resist_ui_compact_0_nexus.full"},
 {"resist_ui_compact_0<NETHER>","angband.character.matrix.label.resist_ui_compact_0_nether.full"},
 {"resist_ui_compact_0<CHAOS>","angband.character.matrix.label.resist_ui_compact_0_chaos.full"},
 {"resist_ui_compact_0<DISEN>","angband.character.matrix.label.resist_ui_compact_0_disen.full"},
 {"pfear_ui_compact_0","angband.character.matrix.label.pfear_ui_compact_0.full"},
 {"pblind_ui_compact_0","angband.character.matrix.label.pblind_ui_compact_0.full"},
 {"pconf_ui_compact_0","angband.character.matrix.label.pconf_ui_compact_0.full"},
 {"pstun_ui_compact_0","angband.character.matrix.label.pstun_ui_compact_0.full"},
 {"holdlife_ui_compact_0","angband.character.matrix.label.holdlife_ui_compact_0.full"},
 {"regen_ui_compact_0","angband.character.matrix.label.regen_ui_compact_0.full"},
 {"esp_ui_compact_0","angband.character.matrix.label.esp_ui_compact_0.full"},
 {"see_invis_ui_compact_0","angband.character.matrix.label.see_invis_ui_compact_0.full"},
 {"free_action_ui_compact_0","angband.character.matrix.label.free_action_ui_compact_0.full"},
 {"feather_falling_ui_compact_0","angband.character.matrix.label.feather_falling_ui_compact_0.full"},
 {"slow_digestion_ui_compact_0","angband.character.matrix.label.slow_digestion_ui_compact_0.full"},
 {"trap_immunity_ui_compact_0","angband.character.matrix.label.trap_immunity_ui_compact_0.full"},
 {"bless_ui_compact_0","angband.character.matrix.label.bless_ui_compact_0.full"},
 {"imphp_ui_compact_0","angband.character.matrix.label.imphp_ui_compact_0.full"},
 {"impsp_ui_compact_0","angband.character.matrix.label.impsp_ui_compact_0.full"},
 {"fear_ui_compact_0","angband.character.matrix.label.fear_ui_compact_0.full"},
 {"aggravate_ui_compact_0","angband.character.matrix.label.aggravate_ui_compact_0.full"},
 {"noteleport_ui_compact_0","angband.character.matrix.label.noteleport_ui_compact_0.full"},
 {"drainxp_ui_compact_0","angband.character.matrix.label.drainxp_ui_compact_0.full"},
 {"sticky_ui_compact_0","angband.character.matrix.label.sticky_ui_compact_0.full"},
 {"fragile_ui_compact_0","angband.character.matrix.label.fragile_ui_compact_0.full"},
 {"stealth_ui_compact_0","angband.character.matrix.label.stealth_ui_compact_0.full"},
 {"search_ui_compact_0","angband.character.matrix.label.search_ui_compact_0.full"},
 {"infravision_ui_compact_0","angband.character.matrix.label.infravision_ui_compact_0.full"},
 {"tunneling_ui_compact_0","angband.character.matrix.label.tunneling_ui_compact_0.full"},
 {"speed_ui_compact_0","angband.character.matrix.label.speed_ui_compact_0.full"},
 {"blows_ui_compact_0","angband.character.matrix.label.blows_ui_compact_0.full"},
 {"shots_ui_compact_0","angband.character.matrix.label.shots_ui_compact_0.full"},
 {"shooting_power_ui_compact_0","angband.character.matrix.label.shooting_power_ui_compact_0.full"},
 {"light_ui_compact_0","angband.character.matrix.label.light_ui_compact_0.full"},
 {"damage_reduction_ui_compact_0","angband.character.matrix.label.damage_reduction_ui_compact_0.full"},
 {"movement_speed_ui_compact_0","angband.character.matrix.label.movement_speed_ui_compact_0.full"},
};
static const char *const state_resist[] = {
 "angband.character.matrix.state.resist.unknown",
 "angband.character.matrix.state.resist.not_present",
 "angband.character.matrix.state.resist.none",
 "angband.character.matrix.state.resist.resist",
 "angband.character.matrix.state.resist.vulnerable",
 "angband.character.matrix.state.resist.immune",
 "angband.character.matrix.state.resist.timed_resist_none",
 "angband.character.matrix.state.resist.timed_resist_resist",
 "angband.character.matrix.state.resist.timed_resist_vulnerable",
 "angband.character.matrix.state.resist.timed_vulnerable_none",
 "angband.character.matrix.state.resist.timed_vulnerable_resist",
 "angband.character.matrix.state.resist.timed_immune_none",
 "angband.character.matrix.state.resist.timed_immune_resist",
 "angband.character.matrix.state.resist.timed_immune_vulnerable",
 "angband.character.matrix.state.resist.resist_vulnerable",
 "angband.character.matrix.state.resist.timed_resist_resist_vulnerable",
 "angband.character.matrix.state.resist.timed_vulnerable_resist_vulnerable",
 "angband.character.matrix.state.resist.timed_immune_resist_vulnerable",
 "angband.character.matrix.state.resist.timed_both_none",
 "angband.character.matrix.state.resist.timed_both_resist",
 "angband.character.matrix.state.resist.timed_both_vulnerable",
 "angband.character.matrix.state.resist.timed_both_resist_vulnerable",
};
static const char *const state_flag[] = {
 "angband.character.matrix.state.flag.unknown",
 "angband.character.matrix.state.flag.not_present",
 "angband.character.matrix.state.flag.off",
 "angband.character.matrix.state.flag.on",
 "angband.character.matrix.state.flag.timed_on",
};
static const char *const state_signed[] = {
 "angband.character.matrix.state.signed.unknown",
 "angband.character.matrix.state.signed.not_present",
 "angband.character.matrix.state.signed.zero",
 "angband.character.matrix.state.signed.zero_timed_positive",
 "angband.character.matrix.state.signed.zero_timed_negative",
 "angband.character.matrix.state.signed.positive",
 "angband.character.matrix.state.signed.positive_timed_positive",
 "angband.character.matrix.state.signed.positive_timed_negative",
 "angband.character.matrix.state.signed.negative",
 "angband.character.matrix.state.signed.negative_timed_positive",
 "angband.character.matrix.state.signed.negative_timed_negative",
};
static const char *const state_sustain[] = {
 "angband.character.matrix.state.sustain.unknown",
 "angband.character.matrix.state.sustain.not_present",
 "angband.character.matrix.state.sustain.zero",
 "angband.character.matrix.state.sustain.zero_sustained",
 "angband.character.matrix.state.sustain.positive",
 "angband.character.matrix.state.sustain.positive_sustained",
 "angband.character.matrix.state.sustain.negative",
 "angband.character.matrix.state.sustain.negative_sustained",
};
static const char *entry_label(const char *source)
{
 size_t i;if(!source)return NULL;
 for(i=0;i<N_ELEMENTS(entry_ids);i++)if(!strcmp(source,entry_ids[i].source))return entry_ids[i].id;
 return NULL;
}
static const char *state_id(enum ab_character_matrix_backend backend,int index)
{
 const char *const *ids=NULL;size_t count=0;
 switch(backend){
 case AB_MATRIX_RESIST:ids=state_resist;count=N_ELEMENTS(state_resist);break;
 case AB_MATRIX_FLAG:ids=state_flag;count=N_ELEMENTS(state_flag);break;
 case AB_MATRIX_SIGNED:ids=state_signed;count=N_ELEMENTS(state_signed);break;
 case AB_MATRIX_SUSTAIN:ids=state_sustain;count=N_ELEMENTS(state_sustain);break;
 default:return NULL;
 }
 return index>=0 && (size_t)index<count?ids[index]:NULL;
}
void ab_character_matrix_begin(void)
{
 if(matrix.active)return;matrix.active=true;matrix.row_active=false;
 ab_ui_scope_begin_required("character-matrix",true);
}
void ab_character_matrix_end(void)
{
 if(!matrix.active)return;matrix.active=false;matrix.row_active=false;matrix.label=NULL;
 ab_ui_scope_end();
}
void ab_character_matrix_region(int region)
{
 static const char *const roles[]={"resistances","abilities","hindrances","modifiers"};
 if(region>=0 && (size_t)region<N_ELEMENTS(roles) && exported.active)ab_character_export_heading(roles[region]);
}
void ab_character_matrix_row_begin(const struct ui_entry *entry,int row,bool known_rune,int slots)
{
 char widget[64];struct ab_ui_param p[2];
 matrix.row_active=false;matrix.label=NULL;
 if(!matrix.active)return;
 if(row<0 || row>=256 || slots<0 || slots>AB_MATRIX_MAX_SLOTS){ab_character_export_reject();return;}
 matrix.label=entry_label(ab_ui_entry_source_name(entry));if(!matrix.label){ab_character_export_reject();return;}
 matrix.row=row;matrix.slots=slots;matrix.row_active=true;
 strnfmt(widget,sizeof(widget),"matrix.%d.label",row);
 p[0]=AB_UI_REF("label",matrix.label);
 p[1]=AB_UI_REF("knowledge",known_rune?"angband.character.matrix.known":"angband.character.matrix.unknown");
 ab_ui_emit("character-matrix",widget,"angband.character.matrix.row",p,2);
}
void ab_character_matrix_row_end(void){matrix.row_active=false;matrix.label=NULL;}
void ab_character_matrix_selected(enum ab_character_matrix_backend backend,int index,int palette_index,int color,int x,int y,int width)
{
 char widget[64],slot[2],glyph[AB_MATRIX_MAX_VALUE_WIDTH*4+1];
 const char *state;int i,a;wchar_t c;size_t used=0;struct ab_ui_param p[4];
 if(!matrix.active || !matrix.row_active)return;
 if(index<0 || index>matrix.slots || width<1 || width>AB_MATRIX_MAX_VALUE_WIDTH){ab_character_export_reject();return;}
 state=state_id(backend,palette_index);if(!state){ab_character_export_reject();return;}
 if(!Term || y<0 || y>=Term->hgt || x<0 || x>Term->wid-width){ab_character_export_reject();return;}
 for(i=0;i<width;i++){
  int n;char encoded[8];if(Term_what(x+i,y,&a,&c)){ab_character_export_reject();return;}
  n=text_wctomb(encoded,c);if(n<=0 || n>4 || used+(size_t)n>=sizeof(glyph)){ab_character_export_reject();return;}
  memcpy(glyph+used,encoded,(size_t)n);used+=(size_t)n;
 }
 glyph[used]=0;
 /* Source screen uses the body order; index==slots is the original @ column. */
 slot[0]=index==matrix.slots?'@':"abcdefgimnop"[index];slot[1]=0;
 if(slot[0]<' ' || slot[0]>'~'){ab_character_export_reject();return;}
 p[0]=AB_UI_OPAQUE("slot","canonical_key",slot);
 p[1]=AB_UI_OPAQUE("symbol","opaque_parser_token",glyph);
 p[2]=AB_UI_REF("state",state);
 strnfmt(widget,sizeof(widget),"row.%d.label",matrix.row*66+index);
 p[3]=AB_UI_REF("label",matrix.label);
 ab_ui_emit("character-matrix",widget,"angband.character.matrix.cell",p,4);
 if(color>=0 && color<BASIC_COLORS){
  struct ab_semantic_event event;char control[96];
  strnfmt(control,sizeof(control),"__row:%d",matrix.row*66+index);
  ab_semantic_event_begin(&event,"","ui","character-matrix",control,0,-1);
  ab_semantic_param_begin(&event,"color","integer");ab_semantic_json_int32(&event,color);ab_semantic_param_end(&event);ab_semantic_event_emit_control(&event);
 }
 if(exported.active){ab_character_export_emit("angband.character.export.matrix_cell",p,4);}
}
bool ab_character_export_active(void){return exported.active;}
bool ab_character_export_valid(void){return !exported.failed;}
void ab_character_export_reject(void){if(exported.active)exported.failed=true;}
bool ab_character_export_widget(char *out,size_t size)
{
 int n;if(!exported.active)return false;
 if(!out || !size || exported.row>=AB_EXPORT_MAX_ROWS){exported.failed=true;return false;}
 n=snprintf(out,size,"export.row.%u.label",exported.row++);
 if(n<0 || (size_t)n>=size){exported.failed=true;return false;}return true;
}
void ab_character_export_emit(const char *id,const struct ab_ui_param *params,size_t count)
{
 char widget[64];if(!exported.active)return;
 if(!id || !id[0] || count>16 || (count && !params)){exported.failed=true;return;}
 if(ab_character_export_widget(widget,sizeof(widget)))ab_ui_emit("character-export",widget,id,params,count);
}
void ab_character_export_begin(const char *build)
{
 struct ab_ui_param p=AB_UI_OPAQUE("build","opaque_build_identity",build);
 if(exported.active)return;exported.active=true;exported.basics=true;exported.failed=false;exported.row=0;export_label_count=0;export_pending_static.valid=false;
 ab_ui_scope_begin_required("character-export",true);
 ab_character_export_emit("angband.character.export.title",&p,1);
}
void ab_character_export_end(void)
{
 if(!exported.active)return;
 if(exported.failed)ab_ui_static("character-export","export.error","angband.character.export.capture_rejected");
 ab_ui_scope_commit();ab_ui_scope_end();exported.active=false;
 if(exported.failed)return;
 /* Explicit completion differs from inner character/object-info batch commits. */
 {struct ab_semantic_event event;ab_semantic_event_begin(&event,"","ui","character-export","__export_ready",0,-1);ab_semantic_param_begin(&event,"expected_rows","integer");ab_semantic_json_int32(&event,(int32_t)exported.row);ab_semantic_param_end(&event);ab_semantic_event_emit_control(&event);}
}
void ab_character_export_heading(const char *role)
{
 char id[96];if(!role)return;if(!strcmp(role,"sustains")){if(export_pending_static.valid)ab_character_export_reject();exported.basics=false;}strnfmt(id,sizeof(id),"angband.character.export.heading.%s",role);ab_character_export_emit(id,NULL,0);
}
void ab_character_export_object(char slot,const char *native_buffer)
{
 char widget[64],key[2]={slot,0};struct ab_semantic_event event;struct ab_naming_snapshot snapshot={0};
 if(!ab_character_export_widget(widget,sizeof(widget)))return;
 if(!ab_naming_copy_object_snapshot(&snapshot,native_buffer)){exported.failed=true;return;}
 ab_semantic_event_begin(&event,"angband.character.export.object","ui","character-export",widget,0,-1);
 ab_semantic_param_begin(&event,"slot","canonical_key");ab_semantic_json_string(&event,key);ab_semantic_param_end(&event);
 ab_naming_param_snapshot(&event,"object","KnownObjectDescription",&snapshot);ab_semantic_event_emit(&event);ab_naming_snapshot_release(&snapshot);
}
int ab_character_export_slot(const char *buffer,int selected_slot)
{ab_character_export_object((char)selected_slot,buffer);return selected_slot;}
void ab_character_export_option(int option,bool value,const char *key)
{
 struct ab_ui_param p[3];const char *id=ab_if_option_id(option);
 if(!id){ab_character_export_reject();return;}p[0]=AB_UI_REF("description",id);p[1]=AB_UI_REF("value",value?"angband.character.export.yes":"angband.character.export.no");p[2]=AB_UI_OPAQUE("key","canonical_identity",key);
 ab_character_export_emit("angband.character.export.option",p,3);
}
bool ab_character_export_retired(bool retired)
{ab_character_export_death(retired);return retired;}
const char *ab_character_export_option_key(int option,bool value,const char *key)
{ab_character_export_option(option,value,key);return key;}
void ab_character_export_death(bool retired)
{
 char widget[64];if(retired)ab_character_export_emit("angband.character.export.retired",NULL,0);
 else if(ab_character_export_widget(widget,sizeof(widget)))ab_dc_emit_current("character-export",widget,"angband.character.export.killed");
}
static const char *export_label(const char *key)
{
 unsigned i;for(i=0;i<export_label_count;i++)if(!strcmp(key,export_labels[i].key))return export_labels[i].id;return NULL;
}
static void export_label_remember(const char *widget,const char *id)
{
 unsigned i;size_t n=strlen(widget),m=strlen(id);
 if(n<6 || strcmp(widget+n-6,".label") || n-6>=sizeof(export_labels[0].key) || !m || m>=sizeof(export_labels[0].id))return;
 for(i=0;i<export_label_count;i++)if(strlen(export_labels[i].key)==n-6 && !strncmp(widget,export_labels[i].key,n-6))break;
 if(i==export_label_count){if(export_label_count>=AB_EXPORT_LABELS){ab_character_export_reject();return;}export_label_count++;}
 memcpy(export_labels[i].key,widget,n-6);export_labels[i].key[n-6]=0;memcpy(export_labels[i].id,id,m+1);
 if(export_pending_static.valid && !strcmp(export_pending_static.key,export_labels[i].key)){
  struct ab_ui_param p[2]={AB_UI_REF("label",export_labels[i].id),AB_UI_REF("value",export_pending_static.id)};
  export_pending_static.valid=false;ab_character_export_emit("angband.character.export.field",p,2);
 }
}
void ab_character_export_observe_ui(const char *context,const char *widget,const char *id,const struct ab_ui_param *params,size_t count,bool control)
{
 char key[96];const char *label,*column=NULL,*source=NULL;struct ab_ui_param values[1],p[3];size_t len,n;
 if(!exported.active || !exported.basics || !context || strcmp(context,"character") || !widget || !id || count>16)return;
 if(!control && id[0] && !count && strstr(widget,".label")){export_label_remember(widget,id);if(!strcmp(widget,"turns_used.label"))ab_character_export_emit(id,NULL,0);return;}
 if(control){
  if(!strncmp(widget,"__value:",8) && count==1 && (!strcmp(params[0].type,"integer") || !strcmp(params[0].type,"signed_integer"))){
   widget+=8;values[0]=params[0];values[0].name="number";params=values;count=1;source=!strcmp(values[0].type,"signed_integer")?"angband.character.export.signed_number":"angband.character.export.number";
  }else if(!strncmp(widget,"__input:",8) && count==1 && !strcmp(params[0].type,"verbatim_user_text")){
   widget+=8;values[0]=params[0];values[0].name="text";params=values;count=1;source="angband.character.export.authored_input";
  }else return;
 }else if(id[0])source=id;else return;
 len=strlen(widget);if(len>=sizeof(key))return;memcpy(key,widget,len+1);
 if(len>6 && !strcmp(key+len-6,".value"))key[len-6]=0;
 if(!strncmp(key,"stat.",5) && key[5]>='0' && key[5]<='4' && key[6]=='.'){
  const char *field=key+7;
  if(!strcmp(field,"self"))column="birth.stats.column.self";
  else if(!strcmp(field,"race"))column="birth.stats.column.race_bonus";
  else if(!strcmp(field,"class"))column="birth.stats.column.class_bonus";
  else if(!strcmp(field,"equipment"))column="birth.stats.column.equipment_bonus";
  else if(!strcmp(field,"best"))column="birth.stats.column.best";
  else if(!strcmp(field,"current"))column="angband.character.export.column.current";
  key[6]=0;
 }
 label=export_label(key);
 if(!label && !strncmp(key,"hit.",4))label=export_label("hit");
 if(!label){
  /* Original likert emits the selected static rating before its field label.
   * Store only the detached source ID until that original label is observed. */
  if(!control && !count && len>6 && !strcmp(widget+len-6,".value")){
   size_t id_len=strlen(source),key_len=strlen(key);
   if(export_pending_static.valid || id_len>=sizeof(export_pending_static.id) || key_len>=sizeof(export_pending_static.key)){ab_character_export_reject();return;}
   memcpy(export_pending_static.id,source,id_len+1);memcpy(export_pending_static.key,key,key_len+1);export_pending_static.valid=true;return;
  }
  /* Non-field source descriptors and original column labels stay source-owned. */
  ab_character_export_emit(source,params,count);return;
 }
 n=0;p[n++]=AB_UI_REF(column?"stat":"label",label);
 if(column)p[n++]=AB_UI_REF("column",column);
 p[n++]=AB_UI_NESTED("value",source,params,count);
 ab_character_export_emit(column?"angband.character.export.stat_field":"angband.character.export.field",p,n);
}
void ab_character_export_message(int age)
{
 char widget[64];if(age<0 || age>UINT16_MAX){ab_character_export_reject();return;}
 if(ab_character_export_widget(widget,sizeof(widget)) && !ab_message_recall_emit((uint16_t)age,"character-export",widget))ab_character_export_reject();
}
#endif
