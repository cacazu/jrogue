/* SPDX-License-Identifier: GPL-2.0-only */
/* Pure source-selected knowledge presentation; no gameplay predicates/RNG. */
#include "angband.h"
#include "web-knowledge-text.h"
#ifdef __EMSCRIPTEN__
#include "monster.h"
#include "player.h"
#include "obj-properties.h"
#include "obj-knowledge.h"
#include "web-domain-text.h"
#include "web-semantic.h"
#include "web-combat.h"
#include <stdio.h>
#include <string.h>
#include "../migration/knowledge-text-data/web-knowledge-data.h"
#define AB_KNOWLEDGE_COUNT(a) (sizeof(a)/sizeof((a)[0]))
static bool lore_active;
static unsigned int lore_sequence;
static struct { size_t oid; int variety,index; bool description,valid; } last_rune;

const char *ab_knowledge_monster_description_id(const struct monster_race *race)
{
 if(!race || race->ridx>=AB_KNOWLEDGE_COUNT(ab_knowledge_monster_ids)) return NULL;
 return ab_knowledge_monster_ids[race->ridx];
}
const char *ab_knowledge_property_id(int type,int index,enum ab_knowledge_property_field field)
{
 size_t i;
 for(i=0;i<AB_KNOWLEDGE_COUNT(ab_knowledge_property_ids);i++) {
  if(ab_knowledge_property_ids[i].index!=index) continue;
  if(ab_knowledge_property_ids[i].type!=type &&
   !(type==OBJ_PROPERTY_MOD && ab_knowledge_property_ids[i].type==OBJ_PROPERTY_STAT)) continue;
  switch(field) {
   case AB_KNOWLEDGE_NAME:return ab_knowledge_property_ids[i].name;
   case AB_KNOWLEDGE_DESCRIPTION:return ab_knowledge_property_ids[i].desc;
   case AB_KNOWLEDGE_NOTICE:return ab_knowledge_property_ids[i].notice;
   case AB_KNOWLEDGE_ADJECTIVE:return ab_knowledge_property_ids[i].adjective;
   case AB_KNOWLEDGE_NEGATIVE:return ab_knowledge_property_ids[i].negative;
  }
 }
 return NULL;
}
const char *ab_knowledge_slay_id(int index,int role)
{
 size_t i;for(i=0;i<AB_KNOWLEDGE_COUNT(ab_knowledge_slay_ids);i++) if(ab_knowledge_slay_ids[i].index==index) {
  if(role==0)return ab_knowledge_slay_ids[i].name;
  if(role==1)return ab_knowledge_slay_ids[i].melee;
  if(role==2)return ab_knowledge_slay_ids[i].range;
 }
 return NULL;
}
const char *ab_knowledge_brand_id(int index,bool verb)
{
 size_t i;for(i=0;i<AB_KNOWLEDGE_COUNT(ab_knowledge_brand_ids);i++) if(ab_knowledge_brand_ids[i].index==index)
  return verb?ab_knowledge_brand_ids[i].verb:ab_knowledge_brand_ids[i].name;
 return NULL;
}
void ab_knowledge_emit_ability(const char *context,const char *widget,const struct player_ability *ability)
{
 size_t i;if(!ability || !ability->type) return;
 for(i=0;i<AB_KNOWLEDGE_COUNT(ab_knowledge_ability_ids);i++) {
  const char *element;
  if(strcmp(ability->type,ab_knowledge_ability_ids[i].type) || ability->index!=ab_knowledge_ability_ids[i].index) continue;
  if(!strcmp(ability->type,"element") && ability->value!=ab_knowledge_ability_ids[i].value)continue;
  element=ab_knowledge_ability_ids[i].element;
  if(element) {struct ab_ui_param p=AB_UI_REF("element",element);ab_ui_emit(context,widget,ab_knowledge_ability_ids[i].id,&p,1);}
  else ab_ui_static(context,widget,ab_knowledge_ability_ids[i].id);
  return;
 }
}
void ab_knowledge_rune_capture(size_t oid,int variety,int index,bool description)
{
 last_rune.oid=oid;last_rune.variety=variety;last_rune.index=index;
 last_rune.description=description;last_rune.valid=true;
}
void ab_knowledge_emit_last_rune(const char *context,const char *widget,size_t oid,bool description)
{
 const char *id=NULL,*lexeme=NULL,*slot=NULL;
 int index;size_t i;
 if(!last_rune.valid || last_rune.oid!=oid || last_rune.description!=description)return;
 index=last_rune.index;
 switch(last_rune.variety) {
  case RUNE_VAR_COMBAT:
   for(i=0;i<AB_KNOWLEDGE_COUNT(ab_knowledge_combat_rune_ids);i++)if(ab_knowledge_combat_rune_ids[i].index==index)
    id=description?ab_knowledge_combat_rune_ids[i].desc:ab_knowledge_combat_rune_ids[i].name;
   break;
  case RUNE_VAR_MOD:
   lexeme=ab_knowledge_property_id(OBJ_PROPERTY_MOD,index,AB_KNOWLEDGE_NAME);slot="property";
   id=description?"angband.knowledge.grammar.rune.description.mod":"angband.knowledge.grammar.rune.name.plain";break;
  case RUNE_VAR_RESIST:
   for(i=0;i<AB_KNOWLEDGE_COUNT(ab_knowledge_ability_ids);i++)if(ab_knowledge_ability_ids[i].element && ab_knowledge_ability_ids[i].index==index) {lexeme=ab_knowledge_ability_ids[i].element;break;}
   slot="element";id=description?"angband.knowledge.grammar.rune.description.resist":"angband.knowledge.grammar.rune.name.resist";break;
  case RUNE_VAR_BRAND:
   lexeme=ab_knowledge_brand_id(index,false);slot="brand";
   id=description?"angband.knowledge.grammar.rune.description.brand":"angband.knowledge.grammar.rune.name.brand";break;
  case RUNE_VAR_SLAY:
   lexeme=ab_knowledge_slay_id(index,0);slot="target";
   id=description?"angband.knowledge.grammar.rune.description.slay":"angband.knowledge.grammar.rune.name.slay";break;
  case RUNE_VAR_CURSE:
   lexeme=ab_domain_id(AB_DOMAIN_CURSE,index,description?AB_DOMAIN_DESCRIPTION:AB_DOMAIN_NAME,0);
   slot=description?"curse_effect":"curse";
   id=description?"angband.knowledge.grammar.rune.description.curse":"angband.knowledge.grammar.rune.name.curse";break;
  case RUNE_VAR_FLAG:
   lexeme=ab_knowledge_property_id(OBJ_PROPERTY_FLAG,index,AB_KNOWLEDGE_NAME);slot="property";
   id=description?"angband.knowledge.grammar.rune.description.flag":"angband.knowledge.grammar.rune.name.plain";break;
 }
 last_rune.valid=false;
 if(!id)return;
 if(slot) {struct ab_ui_param p=AB_UI_REF(slot,lexeme);if(lexeme)ab_ui_emit(context,widget,id,&p,1);}
 else ab_ui_static(context,widget,id);
}
const char *ab_knowledge_element_id(int index)
{
 if(index<0 || (size_t)index>=AB_KNOWLEDGE_COUNT(ab_knowledge_element_ids))return NULL;
 return ab_knowledge_element_ids[index];
}
#define AB_KNOWLEDGE_LIST_MAX 64U
static struct {
 const char *ids[AB_KNOWLEDGE_LIST_MAX];
 const char *wrappers[AB_KNOWLEDGE_LIST_MAX];
 size_t count;
 const char *role;
 bool invalid,pending_weak;
} selected_list;
/* Includes each optional lexical wrapper plus two refs per interior node. */
static struct ab_ui_param list_nodes[AB_KNOWLEDGE_LIST_MAX*3U];
static size_t list_node_count;
void ab_knowledge_list_begin(void)
{
 memset(&selected_list,0,sizeof(selected_list));
 if(!ab_domain_info_context())selected_list.invalid=true;
}
void ab_knowledge_list_role(const char *role){selected_list.role=role;}
void ab_knowledge_list_add(const char *id)
{
 size_t n=selected_list.count;
 if(selected_list.invalid)return;
 if(!id || n>=AB_KNOWLEDGE_LIST_MAX){selected_list.invalid=true;return;}
 selected_list.ids[n]=id;
 selected_list.wrappers[n]=selected_list.pending_weak?"angband.knowledge.object_info.brand.weak":NULL;
 selected_list.pending_weak=false;selected_list.count++;
}
void ab_knowledge_list_powerful(void)
{
 if(!selected_list.invalid && selected_list.count)
  selected_list.wrappers[selected_list.count-1]="angband.knowledge.object_info.slay.powerful";
}
void ab_knowledge_list_weak(void){selected_list.pending_weak=true;}
static struct ab_ui_param list_ref(const char *name,size_t start,size_t count)
{
 size_t offset= list_node_count;
 if(count==1){
  const char *wrapper=selected_list.wrappers[start];
  if(!wrapper)return AB_UI_REF(name,selected_list.ids[start]);
  list_node_count++;
  list_nodes[offset]=AB_UI_REF(!strcmp(wrapper,"angband.knowledge.object_info.brand.weak")?"brand":"target",selected_list.ids[start]);
  return AB_UI_NESTED(name,wrapper,&list_nodes[offset],1);
 }
 list_node_count+=2;
 list_nodes[offset]=list_ref("left",start,count/2);
 list_nodes[offset+1]=list_ref("right",start+count/2,count-count/2);
 return AB_UI_NESTED(name,"angband.knowledge.object_info.list.pair",&list_nodes[offset],2);
}
void ab_knowledge_list_emit(const char *role)
{
 struct ab_ui_param p;char id[128];int n;
 if(selected_list.invalid || !selected_list.count)return;
 if(!role)role=selected_list.role;
 if(!role)return;
 n=snprintf(id,sizeof(id),"angband.knowledge.object_info.%s",role);
 if(n<0 || (size_t)n>=sizeof(id))return;
 list_node_count=0;p=list_ref("items",0,selected_list.count);
 ab_domain_info_emit(id,&p,1);selected_list.invalid=true;
}
void ab_knowledge_info_modifier(int index,int amount,bool exact)
{
 const char *id=ab_knowledge_property_id(OBJ_PROPERTY_MOD,index,AB_KNOWLEDGE_NAME);
 struct ab_ui_param p[2];if(!id || !ab_domain_info_context())return;
 p[0]=AB_UI_REF("property",id);p[1]=AB_UI_SIGN("amount",amount);
 ab_domain_info_emit(exact?"angband.knowledge.object_info.modifier.exact":"angband.knowledge.object_info.modifier.unspecified",p,exact?2:1);
}
void ab_knowledge_info_property(int type,int index)
{
 const char *id=ab_knowledge_property_id(type,index,AB_KNOWLEDGE_DESCRIPTION);
 struct ab_ui_param p=AB_UI_REF("property",id);
 if(id && ab_domain_info_context())ab_domain_info_emit("angband.knowledge.object_info.property.sentence",&p,1);
}
/* The event owns selected IDs/scalars immediately; no entity or source buffer survives. */
static struct ab_semantic_event section_event;
static bool section_open,part_open;
static unsigned int section_parts,part_parameters;
static const char *section_caller,*selected_lexeme;
static int part_color;
static void knowledge_value(struct ab_semantic_event *e,const struct ab_ui_param *p,unsigned int depth)
{
 size_t i;if(depth>8){e->valid=false;return;}
 if(!strcmp(p->type,"integer") || !strcmp(p->type,"signed_integer"))ab_semantic_json_int32(e,p->number);
 else if(!strcmp(p->type,"localized_text")){
  if(!p->text){e->valid=false;return;}
  ab_semantic_json_literal(e,"{\"id\":");ab_semantic_json_string(e,p->text);
  if(p->nested_count){
   ab_semantic_json_literal(e,",\"params\":{");
   for(i=0;i<p->nested_count;i++){
    const struct ab_ui_param *q=&p->nested[i];if(i)ab_semantic_json_literal(e,",");
    ab_semantic_json_string(e,q->name);ab_semantic_json_literal(e,":{\"type\":");
    ab_semantic_json_string(e,q->type);ab_semantic_json_literal(e,",\"value\":");
    knowledge_value(e,q,depth+1);ab_semantic_json_literal(e,"}");
   }
   ab_semantic_json_literal(e,"}");
  }
  ab_semantic_json_literal(e,"}");
 }else{e->valid=false;}
}
void ab_knowledge_section_begin(const char *section)
{
 char widget[48];int n;
 if(!lore_active || !section || section_open || lore_sequence>=8192U)return;
 n=snprintf(widget,sizeof(widget),"row.%u.label",lore_sequence++);
 if(n<0 || (size_t)n>=sizeof(widget))return;
 ab_semantic_event_begin(&section_event,"angband.knowledge.lore.section","ui","monster-lore",widget,0,-1);
 ab_semantic_param_begin(&section_event,"section","KnowledgeSection");
 ab_semantic_json_literal(&section_event,"{\"schema_version\":1,\"section\":");
 ab_semantic_json_string(&section_event,section);
 ab_semantic_json_literal(&section_event,",\"ordered_parts\":[");
 section_open=true;section_parts=0;part_open=false;section_caller=NULL;
}
void ab_knowledge_section_caller(const char *caller){section_caller=caller;}
bool ab_knowledge_caller_is_alternative(void)
{return section_caller && (!strcmp(section_caller,"nonresistance") || !strcmp(section_caller,"effect_immunity") || !strcmp(section_caller,"innate") || !strcmp(section_caller,"breath") || !strcmp(section_caller,"magic"));}
bool ab_knowledge_caller_has_end(void)
{return section_caller && (!strcmp(section_caller,"alter") || !strcmp(section_caller,"detection"));}
void ab_knowledge_part_begin(const char *section,const char *role,const char *id)
{
 if(!section_open || part_open)return;
 if(section_parts++>=512U){section_event.valid=false;return;}
 if(section_parts>1)ab_semantic_json_literal(&section_event,",");
 ab_semantic_json_literal(&section_event,"{\"section\":");ab_semantic_json_string(&section_event,section);
 ab_semantic_json_literal(&section_event,",\"role\":");ab_semantic_json_string(&section_event,role);
 ab_semantic_json_literal(&section_event,",\"id\":");ab_semantic_json_string(&section_event,id);
 if(section_caller && (!strcmp(section,"clause") || !strcmp(section,"spell_clause"))){
  ab_semantic_json_literal(&section_event,",\"caller\":");ab_semantic_json_string(&section_event,section_caller);
 }
 ab_semantic_json_literal(&section_event,",\"params\":{");part_parameters=0;part_color=-1;part_open=true;
}
void ab_knowledge_part_param(const struct ab_ui_param *p)
{
 if(!part_open || !p)return;
 if(part_parameters++>=16U){section_event.valid=false;return;}
 if(part_parameters>1)ab_semantic_json_literal(&section_event,",");
 ab_semantic_json_string(&section_event,p->name);ab_semantic_json_literal(&section_event,":{\"type\":");
 ab_semantic_json_string(&section_event,p->type);ab_semantic_json_literal(&section_event,",\"value\":");
 knowledge_value(&section_event,p,0);ab_semantic_json_literal(&section_event,"}");
}
void ab_knowledge_part_end(void)
{
 if(!part_open)return;
 ab_semantic_json_literal(&section_event,"}");
 if(part_color>=0){ab_semantic_json_literal(&section_event,",\"presentation\":{\"color\":");ab_semantic_json_int32(&section_event,part_color);ab_semantic_json_literal(&section_event,"}");}
 ab_semantic_json_literal(&section_event,"}");part_open=false;
}
void ab_knowledge_section_end(void)
{
 if(!section_open)return;
 if(part_open){section_event.valid=false;ab_knowledge_part_end();}
 ab_semantic_json_literal(&section_event,"]}");ab_semantic_param_end(&section_event);
 if(section_parts)ab_semantic_event_emit(&section_event);else ab_semantic_event_discard(&section_event);
 section_open=false;section_caller=NULL;
}
const char *ab_knowledge_capture_text(const char *name,const char *id,const char *native_text)
{struct ab_ui_param p=AB_UI_REF(name,id);ab_knowledge_part_param(&p);return native_text;}
const char *ab_knowledge_capture_combat(const char *name,const char *native_text)
{return ab_knowledge_capture_text(name,ab_combat_text_id(native_text),native_text);}
int ab_knowledge_capture_integer(const char *name,int native_value)
{struct ab_ui_param p=AB_UI_INT(name,native_value);ab_knowledge_part_param(&p);return native_value;}
int ab_knowledge_capture_color(int native_color){if(part_open)part_color=native_color;return native_color;}
void ab_knowledge_selected_lexeme(const char *id){selected_lexeme=id;}
const char *ab_knowledge_last_lexeme(void){return selected_lexeme;}
const char *ab_knowledge_pronoun_id(int sex,bool possessive,bool title_case)
{
 static const char *const words[2][3][2]={
  {{"angband.knowledge.lore.lexeme.pronoun.nominative.neuter.lower","angband.knowledge.lore.lexeme.pronoun.nominative.neuter.title"},
   {"angband.knowledge.lore.lexeme.pronoun.nominative.male.lower","angband.knowledge.lore.lexeme.pronoun.nominative.male.title"},
   {"angband.knowledge.lore.lexeme.pronoun.nominative.female.lower","angband.knowledge.lore.lexeme.pronoun.nominative.female.title"}},
  {{"angband.knowledge.lore.lexeme.pronoun.possessive.neuter.lower","angband.knowledge.lore.lexeme.pronoun.possessive.neuter.title"},
   {"angband.knowledge.lore.lexeme.pronoun.possessive.male.lower","angband.knowledge.lore.lexeme.pronoun.possessive.male.title"},
   {"angband.knowledge.lore.lexeme.pronoun.possessive.female.lower","angband.knowledge.lore.lexeme.pronoun.possessive.female.title"}}};
 if(sex<0 || sex>2)sex=0;return words[possessive?1:0][sex][title_case?1:0];
}
const char *ab_knowledge_race_flag_id(int flag)
{
 size_t i;for(i=0;i<AB_KNOWLEDGE_COUNT(ab_knowledge_lore_flag_ids);i++)
  if(ab_knowledge_lore_flag_ids[i].flag==flag)return ab_knowledge_lore_flag_ids[i].id;
 return NULL;
}
static struct ab_ui_param number_params[2],start_params[1];
static const char *number_id,*start_id,*article_id,*ordinal_id;
static size_t number_count,start_count;
const char *ab_knowledge_select_lexeme(const char *id,const char *native_text)
{selected_lexeme=id;return native_text;}
const char *ab_knowledge_capture_selected(const char *name,const char *native_text)
{return ab_knowledge_capture_text(name,selected_lexeme,native_text);}
void ab_knowledge_prepare_number(const char *id,int whole,int fraction,const char *fraction_slot)
{
 number_id=id;number_params[0]=AB_UI_INT("whole",whole);number_count=1;
 if(fraction_slot){number_params[1]=AB_UI_INT(fraction_slot,fraction);number_count=2;}
}
void ab_knowledge_prepare_start(const char *id,int sex,bool subject)
{
 start_id=id;start_count=subject?1:0;
 start_params[0]=AB_UI_REF("subject",ab_knowledge_pronoun_id(sex,false,true));
}
const char *ab_knowledge_capture_prepared(const char *name,bool start,const char *native_text)
{
 struct ab_ui_param p=AB_UI_NESTED(name,start?start_id:number_id,start?start_params:number_params,start?start_count:number_count);
 ab_knowledge_part_param(&p);return native_text;
}
void ab_knowledge_morphology_select(bool article,const char *id){if(article)article_id=id;else ordinal_id=id;}
const char *ab_knowledge_morphology_id(bool article){return article?article_id:ordinal_id;}
void ab_knowledge_lore_begin(void)
{
 lore_active=true;lore_sequence=0;ab_ui_scope_begin("monster-lore",true);
}
void ab_knowledge_lore_commit(void) {if(lore_active)ab_ui_scope_commit();}
void ab_knowledge_lore_end(void)
{
 if(!lore_active)return;ab_ui_scope_end();lore_active=false;ab_ui_reset("monster-lore");
}
void ab_knowledge_lore_emit(const char *id,const struct ab_ui_param *params,size_t count)
{
 char widget[48];int n;
 if(!lore_active || !id || lore_sequence>=8192U)return;
 n=snprintf(widget,sizeof(widget),"row.%u.label",lore_sequence++);
 if(n<0 || (size_t)n>=sizeof(widget))return;
 ab_ui_emit("monster-lore",widget,id,params,count);
}
#endif
