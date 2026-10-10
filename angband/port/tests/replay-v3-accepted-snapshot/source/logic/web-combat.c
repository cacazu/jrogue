/* SPDX-License-Identifier: GPL-2.0-only */
/* Pure presentation capture for Angband 4.2.6 selected combat text branches. */
#include "angband.h"
#include "web-combat.h"
#ifdef __EMSCRIPTEN__
#include "init.h"
#include "mon-msg.h"
#include "mon-spell.h"
#include "mon-blows.h"
#include "project.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "web-combat-data.h"

#define AB_COUNT(a) (sizeof(a)/sizeof((a)[0]))
#define AB_COMBAT_BINDINGS_MAX 1024U
struct ab_combat_binding { const char *source, *id, *plural; };
static struct ab_combat_binding bindings[AB_COMBAT_BINDINGS_MAX];
static size_t binding_count;
static const struct monster_spell *bound_spells;
static const struct monster_pain *bound_pain;
static const struct monster_race *bound_races;
static const struct blow_method *bound_blows;
static const struct projection *bound_projections;
static struct ab_combat_reaction *active_reaction;
static struct ab_combat_blow *active_blow;

void ab_combat_reset_catalog_bindings(void)
{
 binding_count=0;bound_spells=NULL;bound_pain=NULL;bound_races=NULL;bound_blows=NULL;bound_projections=NULL;
}
static void bind_source(const char *source,const char *id,const char *plural)
{
 if (!source || !id || binding_count>=AB_COMBAT_BINDINGS_MAX) return;
 bindings[binding_count++]=(struct ab_combat_binding){source,id,plural?plural:id};
}
static void bind_catalog(void)
{
 size_t i;
 if (bound_spells==monster_spells && bound_pain==pain_messages &&
  bound_races==r_info && bound_blows==blow_methods && bound_projections==projections && binding_count) return;
 ab_combat_reset_catalog_bindings();
 bound_spells=monster_spells;bound_pain=pain_messages;
 bound_races=r_info;bound_blows=blow_methods;bound_projections=projections;
 if (!z_info) return;
 for(i=0;i<AB_COUNT(ab_combat_pain_aliases);i++) {
  int index=ab_combat_pain_aliases[i].index,band=ab_combat_pain_aliases[i].band;
  if(pain_messages && index>=0 && index<z_info->mp_max && band>=0 && band<7)
   bind_source(pain_messages[index].messages[band],ab_combat_pain_aliases[i].singular,ab_combat_pain_aliases[i].plural);
 }
 for(i=0;i<AB_COUNT(ab_combat_spell_aliases);i++) {
  const struct monster_spell *spell=monster_spells;
  const struct monster_spell_level *level;
  const char *source=NULL;
  while(spell && spell->index!=ab_combat_spell_aliases[i].index) spell=spell->next;
  if(!spell) continue;
  level=spell->level;
  while(level && level->power!=ab_combat_spell_aliases[i].power) level=level->next;
  if(!level) continue;
  switch(ab_combat_spell_aliases[i].field) {
   case 0:source=level->message;break;case 1:source=level->blind_message;break;
   case 2:source=level->miss_message;break;case 3:source=level->save_message;break;
   case 4:source=level->lore_desc;break;
  }
  bind_source(source,ab_combat_spell_aliases[i].id,NULL);
 }
 for(i=0;i<AB_COUNT(ab_combat_alternate_aliases);i++) {
  int index=ab_combat_alternate_aliases[i].race;
  const struct monster_altmsg *alternate;
  if(!r_info || index<0 || index>=z_info->r_max) continue;
  alternate=r_info[index].spell_msgs;
  while(alternate && (alternate->index!=ab_combat_alternate_aliases[i].index ||
   alternate->msg_type!=ab_combat_alternate_aliases[i].kind)) alternate=alternate->next;
  if(alternate) bind_source(alternate->message,ab_combat_alternate_aliases[i].id,NULL);
 }
 for(i=0;i<AB_COUNT(ab_combat_projection_aliases);i++) {
  int code=ab_combat_projection_aliases[i].code;
  if(projections && code>=0 && code<PROJ_MAX)
   bind_source(projections[code].lash_desc,ab_combat_projection_aliases[i].id,NULL);
 }
 for(i=0;i<AB_COUNT(ab_combat_blow_aliases);i++) {
  const struct blow_method *method=blow_methods && z_info->blow_methods_max>1?&blow_methods[1]:NULL;
  const struct blow_message *message;
  int ordinal;
  /* method->name is the canonical parser key, not a printed action. */
  while(method && strcmp(method->name,ab_combat_blow_aliases[i].method)) method=method->next;
  if(!method) continue;
  ordinal=method->num_messages-1-ab_combat_blow_aliases[i].source_ordinal;
  if(ordinal<0) continue;
  message=method->messages;
  while(message && ordinal>0) {message=message->next;ordinal--;}
  if(message && ordinal==0) bind_source(message->act_msg,ab_combat_blow_aliases[i].id,NULL);
 }
 for(i=0;i<AB_COUNT(ab_combat_blow_lore_aliases);i++) {
  const struct blow_method *method=blow_methods && z_info->blow_methods_max>1?&blow_methods[1]:NULL;
  while(method && strcmp(method->name,ab_combat_blow_lore_aliases[i].method)) method=method->next;
  if(method) bind_source(method->desc,ab_combat_blow_lore_aliases[i].id,NULL);
 }
}
static const char *selected_id(const char *source,bool plural)
{
 size_t i;bind_catalog();
 for(i=0;i<binding_count;i++) if(bindings[i].source==source) return plural?bindings[i].plural:bindings[i].id;
 return NULL;
}
const char *ab_combat_text_id(const char *selected_source)
{
 return selected_id(selected_source,false);
}
static void reference(struct ab_semantic_event *event,const char *id)
{
 ab_semantic_json_literal(event,"{\"id\":");ab_semantic_json_string(event,id);
 ab_semantic_json_literal(event,",\"params\":{}}");
 if(!id) event->valid=false;
}
static void monster_reference(struct ab_semantic_event *event,const char *buffer)
{
 ab_semantic_json_literal(event,"{\"id\":\"naming.monster.description\",\"params\":{\"monster\":{\"type\":\"MonsterDescription\",\"value\":");
 ab_naming_copy_json_for_buffer(event,buffer,"MonsterDescription");
 ab_semantic_json_literal(event,"}}}");
}
static const char *next_name(struct ab_combat_template *s,const char *tag,char *name,size_t max)
{
 unsigned int *count=NULL;int result;
 if(!strcmp(tag,"name")) count=&s->name_count;
 else if(!strcmp(tag,"pronoun")) count=&s->pronoun_count;
 else if(!strcmp(tag,"target")) count=&s->target_count;
 else if(!strcmp(tag,"type")) count=&s->type_count;
 else if(!strcmp(tag,"oftype")) count=&s->oftype_count;
 else if(!strcmp(tag,"oftarget")) count=&s->oftarget_count;
 else if(!strcmp(tag,"has")) count=&s->has_count;
 if(!count || *count>=16U) {s->value.valid=false;return NULL;}
 result=snprintf(name,max,"%s_%u",tag,(*count)++);
 if(result<0 || (size_t)result>=max) {s->value.valid=false;return NULL;}
 return name;
}
void ab_combat_reaction_begin(struct ab_combat_reaction *s,int count,bool offscreen,int sound)
{
 memset(s,0,sizeof(*s));s->previous=active_reaction;s->kind="omitted";
 s->count=count;s->offscreen=offscreen;s->sound=sound;s->format="message";active_reaction=s;
}
void ab_combat_subject_hidden(void) { if(active_reaction) active_reaction->kind="hidden"; }
void ab_combat_subject_visible(const struct monster_race *race,bool unique,const char *plural_form)
{
 if(!active_reaction) return;
 active_reaction->kind="visible";active_reaction->unique=unique;
 /* A unique subject prints no numeric quantity. Retain only its selected
  * singular branch; body plurality and displayed damage are separate facts. */
 if(unique) active_reaction->count=1;
 active_reaction->name_id=ab_naming_monster_name_id(race);active_reaction->plural_form=plural_form;
}
void ab_combat_subject_comma(void) {if(active_reaction) active_reaction->comma=true;}
void ab_combat_reaction_body(int code,const char *selected_source,bool plural)
{
 size_t i;if(!active_reaction) return;
 for(i=0;i<AB_COUNT(ab_combat_repository_aliases);i++)
  if(ab_combat_repository_aliases[i].code==code && ab_combat_repository_aliases[i].plural==plural) {
   active_reaction->body_id=ab_combat_repository_aliases[i].id;return;
  }
 active_reaction->body_id=selected_id(selected_source,plural);
}
void ab_combat_reaction_format(const char *form) {if(active_reaction) active_reaction->format=form;}
static void reaction_emit(bool damage,int displayed_damage)
{
 struct ab_combat_reaction *s=active_reaction;struct ab_semantic_event event;char id[96];
 if(!s) return;
 active_reaction=s->previous;
 snprintf(id,sizeof(id),"angband.combat.grammar.reaction.%s",s->format);
 ab_semantic_event_begin(&event,id,"message","combat","reaction",0,s->sound);
 ab_semantic_param_begin(&event,"subject","MonsterAggregateSubject");
 ab_semantic_json_literal(&event,"{\"schema_version\":1,\"kind\":");ab_semantic_json_string(&event,s->kind);
 if(strcmp(s->kind,"omitted")) {
  ab_semantic_json_literal(&event,",\"count\":");ab_semantic_json_int32(&event,s->count);
  ab_semantic_json_literal(&event,",\"offscreen\":");ab_semantic_json_bool(&event,s->offscreen);
 }
 if(!strcmp(s->kind,"visible")) {
  ab_semantic_json_literal(&event,",\"unique\":");ab_semantic_json_bool(&event,s->unique);
  ab_semantic_json_literal(&event,",\"name_id\":");ab_semantic_json_string(&event,s->name_id);
  ab_semantic_json_literal(&event,",\"plural_form\":");ab_semantic_json_string(&event,s->plural_form);
  ab_semantic_json_literal(&event,",\"appositive_comma\":");ab_semantic_json_bool(&event,s->comma);
 }
 ab_semantic_json_literal(&event,"}");ab_semantic_param_end(&event);
 ab_semantic_param_begin(&event,"body","localized_text");reference(&event,s->body_id);ab_semantic_param_end(&event);
 if(damage) {ab_semantic_param_begin(&event,"damage","int32");ab_semantic_json_int32(&event,displayed_damage);ab_semantic_param_end(&event);}
 if(event.valid) ab_semantic_event_emit(&event);else ab_semantic_event_discard(&event);
}
int ab_combat_reaction_damage(int displayed_damage) {reaction_emit(true,displayed_damage);return displayed_damage;}
void ab_combat_reaction_emit(void) {reaction_emit(false,0);}
void ab_combat_spell_begin(struct ab_combat_template *s,const char *source,int sound)
{
 const char *id=selected_id(source,false);memset(s,0,sizeof(*s));
 ab_semantic_event_begin(&s->value,id,"message","combat","spell",0,sound);
}
void ab_combat_template_monster(struct ab_combat_template *s,const char *tag,const char *buffer,bool semantic_reference)
{
 char name[32];const char *key=next_name(s,tag,name,sizeof(name));if(!key) return;
 ab_semantic_param_begin(&s->value,key,semantic_reference?"localized_text":"MonsterDescription");
 if(semantic_reference) monster_reference(&s->value,buffer);
 else ab_naming_copy_json_for_buffer(&s->value,buffer,"MonsterDescription");
 ab_semantic_param_end(&s->value);
}
void ab_combat_template_player(struct ab_combat_template *s,const char *tag,bool possessive)
{
 char name[32];const char *key=next_name(s,tag,name,sizeof(name));if(!key) return;
 ab_semantic_param_begin(&s->value,key,"localized_text");
 reference(&s->value,possessive?"angband.combat.grammar.target.player.possessive":"angband.combat.grammar.target.player.object");
 ab_semantic_param_end(&s->value);
}
void ab_combat_template_lash(struct ab_combat_template *s,const char *tag,const char *lash,bool optional_of)
{
 char name[32];const char *key=next_name(s,tag,name,sizeof(name));if(!key) return;
 const char *id=lash?selected_id(lash,false):NULL;
 ab_semantic_param_begin(&s->value,key,"localized_text");
 if(optional_of && !lash) reference(&s->value,"angband.combat.grammar.none");
 else if(optional_of) {
  ab_semantic_json_literal(&s->value,"{\"id\":\"angband.combat.grammar.projection.of\",\"params\":{\"type\":{\"type\":\"localized_text\",\"value\":");
  reference(&s->value,id);ab_semantic_json_literal(&s->value,"}}}");
 } else reference(&s->value,id);
 ab_semantic_param_end(&s->value);
}
void ab_combat_template_has(struct ab_combat_template *s,bool monster_target)
{
 char name[32];const char *key=next_name(s,"has",name,sizeof(name));if(!key) return;
 ab_semantic_param_begin(&s->value,key,"localized_text");
 reference(&s->value,monster_target?"angband.combat.grammar.has.monster":"angband.combat.grammar.has.player");
 ab_semantic_param_end(&s->value);
}
void ab_combat_spell_end(struct ab_combat_template *s)
{
 if(s->value.valid) ab_semantic_event_emit(&s->value);else ab_semantic_event_discard(&s->value);
}
void ab_combat_save(const char *source)
{
 struct ab_semantic_event event;const char *id=selected_id(source,false);
 ab_semantic_event_begin(&event,id,"message","combat","save",0,MSG_GENERIC);
 if(event.valid) ab_semantic_event_emit(&event);else ab_semantic_event_discard(&event);
}
void ab_combat_blow_begin(struct ab_combat_blow *s,const char *buffer)
{
 memset(s,0,sizeof(*s));s->previous=active_blow;s->period=true;
 ab_naming_copy_monster_snapshot(&s->actor,buffer);active_blow=s;
}
void ab_combat_blow_action_begin(struct ab_combat_template *s,const char *source)
{
 const char *id=selected_id(source,false);memset(s,0,sizeof(*s));s->nested=true;s->value.valid=id!=NULL;
 ab_semantic_json_literal(&s->value,"{\"id\":");ab_semantic_json_string(&s->value,id);
 ab_semantic_json_literal(&s->value,",\"params\":{");
}
void ab_combat_blow_action_end(struct ab_combat_template *s)
{
 ab_semantic_json_literal(&s->value,"}}");
 if(active_blow && s->value.valid) {
  ab_semantic_event_discard(&active_blow->action);active_blow->action=s->value;
  memset(&s->value,0,sizeof(s->value));
 }
 ab_semantic_event_discard(&s->value);
}
void ab_combat_blow_stop(bool period) {if(active_blow) active_blow->period=period;}
void ab_combat_blow_emit(struct ab_combat_blow *s,int sound,bool show_damage,int damage)
{
 struct ab_semantic_event event;
 if(s->emitted) return;s->emitted=true;if(active_blow==s) active_blow=s->previous;
 ab_semantic_event_begin(&event,show_damage?"angband.combat.grammar.blow.damage":"angband.combat.grammar.blow.message","message","combat","blow",0,sound);
 ab_naming_param_snapshot(&event,"actor","MonsterDescription",&s->actor);
 ab_semantic_param_begin(&event,"action","localized_text");
 if(s->action.valid && s->action.data) ab_semantic_json_literal(&event,s->action.data);else event.valid=false;
 ab_semantic_param_end(&event);
 ab_semantic_param_begin(&event,"stop","localized_text");
 reference(&event,s->period?"angband.combat.grammar.stop.period":"angband.combat.grammar.stop.none");
 ab_semantic_param_end(&event);
 if(show_damage) {ab_semantic_param_begin(&event,"damage","int32");ab_semantic_json_int32(&event,damage);ab_semantic_param_end(&event);}
 if(event.valid) ab_semantic_event_emit(&event);else ab_semantic_event_discard(&event);
}
void ab_combat_blow_end(struct ab_combat_blow *s)
{
 if(active_blow==s) active_blow=s->previous;
 ab_naming_snapshot_release(&s->actor);ab_semantic_event_discard(&s->action);
}
#endif
