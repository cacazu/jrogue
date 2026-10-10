/* SPDX-License-Identifier: GPL-2.0-only */
#include "web-naming.h"
#ifdef __EMSCRIPTEN__
#include "object.h"
#include "monster.h"
#include "obj-tval.h"
#include "web-naming-data.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

struct ab_naming_cache_entry {
 uintptr_t buffer,subject;
 uint32_t mode,length;
 uint64_t serial;
 bool object;
 char *json;
};
static struct ab_naming_session *ab_object_session,*ab_monster_session;
static struct ab_naming_cache_entry ab_cache[AB_NAMING_CACHE_ENTRIES];
static size_t ab_cache_bytes;
static uint64_t ab_cache_serial;
#define AB_BINDINGS(table) ab_naming_##table##_bindings, sizeof(ab_naming_##table##_bindings)/sizeof(ab_naming_##table##_bindings[0])

static const struct ab_naming_binding *ab_binding(const struct ab_naming_binding *table,size_t count,uint32_t index)
{
 size_t i;
 for(i=0;i<count;i++)if(table[i].index==index)return &table[i];
 return NULL;
}
static bool ab_matches(const struct ab_naming_binding *binding,const char *raw)
{
 /* Exact source lexeme identity/content verification, never output matching. */
 return binding && binding->id && binding->raw && raw && !strcmp(binding->raw,raw);
}
static const struct ab_naming_role *ab_role(const char *role)
{
 size_t i;
 if(!role)return NULL;
 for(i=0;i<sizeof(ab_naming_roles)/sizeof(ab_naming_roles[0]);i++)
  if(!strcmp(ab_naming_roles[i].role,role))return &ab_naming_roles[i];
 return NULL;
}
static void ab_fail(struct ab_naming_session *s,const char *reason)
{
 if(s&&s->complete){s->complete=false;s->reason=reason;}
}
static void ab_u32(struct ab_semantic_event *e,uint32_t value)
{
 char text[32];
 int n=snprintf(text,sizeof(text),"%lu",(unsigned long)value);
 if(n<0||(size_t)n>=sizeof(text)){e->valid=false;return;}
 ab_semantic_json_literal(e,text);
}
static void ab_field_string(struct ab_naming_session *s,const char *key,const char *value)
{
 ab_semantic_json_literal(&s->value,",");ab_semantic_json_string(&s->value,key);
 ab_semantic_json_literal(&s->value,":");ab_semantic_json_string(&s->value,value);
}
static void ab_field_number(struct ab_naming_session *s,const char *key,int32_t value)
{
 ab_semantic_json_literal(&s->value,",");ab_semantic_json_string(&s->value,key);
 ab_semantic_json_literal(&s->value,":");ab_semantic_json_int32(&s->value,value);
}
static void ab_field_bool(struct ab_naming_session *s,const char *key,bool value)
{
 ab_semantic_json_literal(&s->value,",");ab_semantic_json_string(&s->value,key);
 ab_semantic_json_literal(&s->value,":");ab_semantic_json_bool(&s->value,value);
}
static bool ab_part(struct ab_naming_session *s,const char *kind)
{
 if(!s||!s->complete)return false;
 if(s->part_count>=32){ab_fail(s,"CaptureCapacity");return false;}
 if(s->part_count++)ab_semantic_json_literal(&s->value,",");
 ab_semantic_json_literal(&s->value,"{\"kind\":");ab_semantic_json_string(&s->value,kind);
 return true;
}
static void ab_end_part(struct ab_naming_session *s){ab_semantic_json_literal(&s->value,"}");}
static void ab_reference_id(struct ab_naming_session *s,const char *id)
{
 if(!id){ab_fail(s,"UnsupportedCatalogIdentity");return;}
 ab_field_string(s,"name_id",id);
}
static void ab_cache_remove(size_t index)
{
 ab_cache_bytes-=ab_cache[index].length;
 free(ab_cache[index].json);memset(&ab_cache[index],0,sizeof(ab_cache[index]));
}
void ab_naming_invalidate_buffer(const char *buffer)
{
 size_t i;uintptr_t address=(uintptr_t)buffer;
 for(i=0;i<AB_NAMING_CACHE_ENTRIES;i++)if(ab_cache[i].json&&ab_cache[i].buffer==address)ab_cache_remove(i);
}
static void ab_begin(struct ab_naming_session *s,char *buffer,size_t max,uint32_t mode,uintptr_t subject,bool object)
{
 memset(s,0,sizeof(*s));s->object=object;s->buffer_address=(uintptr_t)buffer;
 s->subject_address=subject;s->mode=mode;s->native_max_bytes=max;s->complete=true;
 s->previous=object?ab_object_session:ab_monster_session;
 if(object)ab_object_session=s;else ab_monster_session=s;
 ab_naming_invalidate_buffer(buffer);
 s->value.valid=true;
 if(!max||max>AB_NAMING_SNAPSHOT_MAX_BYTES){ab_fail(s,"CaptureCapacity");return;}
 ab_semantic_json_literal(&s->value,"{\"schema_version\":2,\"mode\":");ab_u32(&s->value,mode);
 ab_semantic_json_literal(&s->value,",\"native_max_bytes\":");ab_u32(&s->value,(uint32_t)max);
 ab_semantic_json_literal(&s->value,",\"parts\":[");
}
void ab_naming_object_begin(struct ab_naming_session *s,char *buffer,size_t max,uint32_t mode,const struct object *obj)
{ab_begin(s,buffer,max,mode,(uintptr_t)obj,true);}
void ab_naming_object_kind_begin(struct ab_naming_session *s,char *buffer,size_t max,const struct object_kind *kind)
{(void)kind;ab_begin(s,buffer,max,0,0,true);}
void ab_naming_object_base_begin(struct ab_naming_session *s,char *buffer,size_t max)
{ab_begin(s,buffer,max,0,0,true);}
void ab_naming_monster_begin(struct ab_naming_session *s,char *buffer,size_t max,uint32_t mode,const struct monster *mon)
{ab_begin(s,buffer,max,mode,(uintptr_t)mon,false);}
void ab_naming_monster_list_begin(struct ab_naming_session *s,char *buffer,size_t max,const struct monster_race *race)
{(void)race;ab_begin(s,buffer,max,0,0,false);}

static size_t ab_cache_oldest(void)
{
 size_t i,result=0;uint64_t oldest=UINT64_MAX;
 for(i=0;i<AB_NAMING_CACHE_ENTRIES;i++)if(ab_cache[i].json&&ab_cache[i].serial<oldest){oldest=ab_cache[i].serial;result=i;}
 return result;
}
static void ab_finish(struct ab_naming_session *s)
{
 struct ab_semantic_event event;size_t i,slot=AB_NAMING_CACHE_ENTRIES;
 if(!s)return;
 if(!s->part_count)ab_fail(s,"NativeOutputNotWritten");
 if(!s->value.valid)ab_fail(s,"CaptureCapacity");
 if(s->complete){
  ab_semantic_json_literal(&s->value,"],\"complete\":true");
  if(!s->object)ab_field_bool(s,"capital",s->capital);
  ab_semantic_json_literal(&s->value,"}");
  if(!s->value.valid)ab_fail(s,"CaptureCapacity");
 }
 if(!s->complete){
  ab_semantic_event_discard(&s->value);s->value.valid=true;
  ab_semantic_json_literal(&s->value,"{\"schema_version\":2,\"complete\":false,\"reason\":");
  ab_semantic_json_string(&s->value,s->reason?s->reason:"CaptureCapacity");
  ab_semantic_json_literal(&s->value,"}");
 }
 /* No live subject is consulted after this point, including host yields. */
 if(s->object)ab_object_session=s->previous;else ab_monster_session=s->previous;
 if(!s->value.valid){ab_semantic_event_discard(&s->value);return;}
 if(ab_cache_serial==UINT64_MAX){for(i=0;i<AB_NAMING_CACHE_ENTRIES;i++)ab_cache_remove(i);ab_cache_serial=0;}
 while(ab_cache_bytes+s->value.length>AB_NAMING_CACHE_MAX_BYTES)ab_cache_remove(ab_cache_oldest());
 for(i=0;i<AB_NAMING_CACHE_ENTRIES;i++)if(!ab_cache[i].json){slot=i;break;}
 if(slot==AB_NAMING_CACHE_ENTRIES){slot=ab_cache_oldest();ab_cache_remove(slot);}
 ab_cache[slot].buffer=s->buffer_address;ab_cache[slot].subject=s->subject_address;
 ab_cache[slot].object=s->object;ab_cache[slot].mode=s->mode;
 ab_cache[slot].length=(uint32_t)s->value.length;ab_cache[slot].json=s->value.data;
 ab_cache[slot].serial=++ab_cache_serial;ab_cache_bytes+=s->value.length;
 memset(&s->value,0,sizeof(s->value));
 ab_semantic_event_begin(&event,s->object?"naming.object.description":"naming.monster.description","ui","descriptions",s->object?"object":"monster",0,0);
 ab_semantic_param_begin(&event,s->object?"object":"monster",s->object?"KnownObjectDescription":"MonsterDescription");
 ab_semantic_json_literal(&event,ab_cache[slot].json);ab_semantic_param_end(&event);ab_semantic_event_emit(&event);
}
size_t ab_naming_object_finish(size_t value){ab_finish(ab_object_session);return value;}
void ab_naming_monster_finish(void){ab_finish(ab_monster_session);}

void ab_naming_literal(const char *role)
{
 struct ab_naming_session *s=ab_object_session;const struct ab_naming_role *r=ab_role(role);
 if(ab_part(s,"literal")){ab_reference_id(s,r?r->id:NULL);ab_end_part(s);}
}
void ab_naming_literal_buffer(char *buffer,size_t max,const char *role)
{
 struct ab_naming_session session;
 ab_naming_object_begin(&session,buffer,max,0,NULL);
 ab_naming_literal(role);ab_naming_object_finish(0);
}
const char *ab_naming_monster_name_id(const struct monster_race *race)
{
 const struct ab_naming_binding *b=race?ab_binding(AB_BINDINGS(race),race->ridx):NULL;
 return race&&ab_matches(b,race->name)?b->id:NULL;
}
const char *ab_naming_ego_name_id(const struct ego_item *ego)
{
 const struct ab_naming_binding *b=ego?ab_binding(AB_BINDINGS(ego),ego->eidx):NULL;
 return ego&&ab_matches(b,ego->name)?b->id:NULL;
}
void ab_naming_select_kind_base(const struct object_kind *kind)
{
 struct ab_naming_session *s=ab_object_session;const struct ab_naming_binding *b;
 if(!s)return;b=kind?ab_binding(AB_BINDINGS(kind),kind->kidx):NULL;
 if(!kind||!ab_matches(b,kind->name)){ab_fail(s,"UnsupportedCatalogIdentity");return;}
 s->base_id=b->id;s->modifier_used=b->uses_modifier;
}
void ab_naming_select_base(const char *role)
{
 struct ab_naming_session *s=ab_object_session;const struct ab_naming_role *r=ab_role(role);
 if(!s)return;if(!r){ab_fail(s,"UnsupportedCatalogIdentity");return;}
 s->base_id=r->id;s->modifier_used=r->uses_modifier;
}
static void ab_modifier(struct ab_naming_session *s,const struct object_kind *kind,const char *text)
{
 const struct ab_naming_binding *b=NULL;
 if(!kind||!text){ab_fail(s,"UnsupportedCatalogIdentity");return;}
 if(kind->flavor){
  b=ab_binding(AB_BINDINGS(flavor),kind->flavor->fidx);
  if(b&&b->generated){
   ab_semantic_json_literal(&s->value,"{\"origin\":\"generated_scroll_title\",\"text\":");
   ab_semantic_json_string(&s->value,text);ab_semantic_json_literal(&s->value,"}");return;
  }
  if(!ab_matches(b,text)||!b->modifier){ab_fail(s,"UnsupportedCatalogIdentity");return;}
 }else{
  b=ab_binding(AB_BINDINGS(kind),kind->kidx);
  if(!ab_matches(b,text)){ab_fail(s,"UnsupportedCatalogIdentity");return;}
 }
 ab_semantic_json_literal(&s->value,"{\"name_id\":");
 ab_semantic_json_string(&s->value,b->modifier?b->modifier:b->id);ab_semantic_json_literal(&s->value,"}");
}
void ab_naming_object_base(const struct object_kind *kind,const char *modifier,bool plural)
{
 struct ab_naming_session *s=ab_object_session;
 if(ab_part(s,"base")){
  ab_reference_id(s,s->base_id);ab_field_bool(s,"plural",plural);
  if(s->modifier_used&&modifier){ab_semantic_json_literal(&s->value,",\"modifier\":");ab_modifier(s,kind,modifier);}
  ab_end_part(s);
 }
}
void ab_naming_object_base_name(int tval,bool plural)
{
 struct ab_naming_session *s=ab_object_session;const struct ab_naming_binding *b=ab_binding(AB_BINDINGS(base),(uint32_t)tval);
 if(!s)return;
 if(!ab_matches(b,kb_info[tval].name)){ab_fail(s,"UnsupportedCatalogIdentity");return;}
 s->base_id=b->id;s->modifier_used=false;ab_naming_object_base(NULL,NULL,plural);
}
void ab_naming_object_flavor(const struct object_kind *kind)
{
 struct ab_naming_session *s=ab_object_session;const struct ab_naming_binding *b;
 if(!s||!kind||!kind->flavor){ab_fail(s,"UnsupportedCatalogIdentity");return;}
 b=ab_binding(AB_BINDINGS(flavor),kind->flavor->fidx);
 if(ab_part(s,"literal")){
  if(b&&b->generated){ab_field_string(s,"origin","generated_scroll_title");ab_field_string(s,"text",kind->flavor->text);}
  else ab_reference_id(s,ab_matches(b,kind->flavor->text)?b->id:NULL);
  ab_end_part(s);
 }
}
void ab_naming_object_prefix(const char *form,int32_t number)
{
 struct ab_naming_session *s=ab_object_session;
 if(ab_part(s,"prefix")){ab_field_string(s,"form",form);if(!strcmp(form,"quantity"))ab_field_number(s,"number",number);ab_end_part(s);}
}
void ab_naming_money_prepare(int32_t amount,const struct object_kind *kind)
{if(ab_object_session){ab_object_session->money_amount=amount;ab_object_session->money_kind=kind;}}
bool ab_naming_money_ignore(bool ignored)
{
 struct ab_naming_session *s=ab_object_session;const struct ab_naming_binding *b;
 if(!s)return ignored;b=s->money_kind?ab_binding(AB_BINDINGS(kind),s->money_kind->kidx):NULL;
 if(ab_part(s,"money")){ab_field_number(s,"amount",s->money_amount);ab_reference_id(s,ab_matches(b,s->money_kind?s->money_kind->name:NULL)?b->id:NULL);ab_field_bool(s,"ignore",ignored);ab_end_part(s);}
 return ignored;
}
void ab_naming_artifact_suffix(const struct artifact *artifact)
{
 struct ab_naming_session *s=ab_object_session;const struct ab_naming_binding *b;const char *raw,*display,*attachment="after";char *quoted=NULL;size_t len;
 if(!s||!artifact)return;b=ab_binding(AB_BINDINGS(artifact),artifact->aidx);raw=artifact->name;
 if(ab_part(s,"suffix")){
  ab_field_string(s,"form","artifact");
  if(ab_matches(b,raw))ab_reference_id(s,b->id);
  else if(raw){
   /* artifact_gen_name produces exactly of <proper-name> or '<proper-name>'. */
   display=raw;len=strlen(raw);
   if(len>3&&!strncmp(raw,"of ",3)){attachment="of";display=raw+3;}
   else if(len>=2&&raw[0]=='\''&&raw[len-1]=='\''){
    quoted=malloc(len-1);if(!quoted){ab_fail(s,"CaptureCapacity");ab_end_part(s);return;}
    memcpy(quoted,raw+1,len-2);quoted[len-2]='\0';display=quoted;attachment="quoted";
   }
   ab_field_string(s,"origin","generated_randart_name");ab_field_string(s,"text",raw);
   ab_field_string(s,"display_name",display);ab_field_string(s,"attachment",attachment);free(quoted);
  }else ab_fail(s,"UnsupportedCatalogIdentity");
  ab_end_part(s);
 }
}
void ab_naming_ego_suffix(const struct ego_item *ego)
{
 struct ab_naming_session *s=ab_object_session;const struct ab_naming_binding *b=ego?ab_binding(AB_BINDINGS(ego),ego->eidx):NULL;
 if(ab_part(s,"suffix")){ab_field_string(s,"form","ego");ab_reference_id(s,ego&&ab_matches(b,ego->name)?b->id:NULL);ab_end_part(s);}
}
void ab_naming_kind_suffix(const char *form,const struct object_kind *kind)
{
 struct ab_naming_session *s=ab_object_session;const struct ab_naming_binding *b=kind?ab_binding(AB_BINDINGS(kind),kind->kidx):NULL;
 if(ab_part(s,"suffix")){ab_field_string(s,"form",form);ab_reference_id(s,kind&&ab_matches(b,kind->name)?b->id:NULL);ab_end_part(s);}
}
void ab_naming_chest_state(const char *role)
{
 struct ab_naming_session *s=ab_object_session;const struct ab_naming_role *r=ab_role(role);
 if(ab_part(s,"chest")){ab_reference_id(s,r?r->id:NULL);ab_end_part(s);}
}
void ab_naming_chest_record(const struct chest_trap *trap)
{
 struct ab_naming_session *s=ab_object_session;size_t i;const char *id=NULL;
 if(!s||!trap)return;
 for(i=0;i<sizeof(ab_naming_chest_bindings)/sizeof(ab_naming_chest_bindings[0]);i++){
  const struct ab_naming_chest_binding *b=&ab_naming_chest_bindings[i];
  if(trap->code&&trap->name&&!strcmp(b->code,trap->code)&&!strcmp(b->raw,trap->name)){id=b->id;break;}
 }
 if(ab_part(s,"chest")){ab_reference_id(s,id);ab_end_part(s);}
}
void ab_naming_number(const char *kind,int32_t value)
{
 struct ab_naming_session *s=ab_object_session;
 if(ab_part(s,kind)){ab_field_number(s,!strcmp(kind,"fuel")?"turns":!strcmp(kind,"charging")?"count":"value",value);ab_end_part(s);}
}
int32_t ab_naming_number_result(const char *kind,int32_t value){ab_naming_number(kind,value);return value;}
void ab_naming_dice(int32_t dice,int32_t sides)
{struct ab_naming_session *s=ab_object_session;if(ab_part(s,"dice")){ab_field_number(s,"dice",dice);ab_field_number(s,"sides",sides);ab_end_part(s);}}
void ab_naming_bonus_pair(int32_t hit,int32_t damage)
{struct ab_naming_session *s=ab_object_session;if(ab_part(s,"bonuses")){ab_field_string(s,"form","hit_damage");ab_field_number(s,"hit",hit);ab_field_number(s,"damage",damage);ab_end_part(s);}}
void ab_naming_bonus_single(const char *form,int32_t value)
{struct ab_naming_session *s=ab_object_session;if(ab_part(s,"bonuses")){ab_field_string(s,"form",form);ab_field_number(s,!strcmp(form,"hit")?"hit":!strcmp(form,"damage")?"damage":"value",value);ab_end_part(s);}}
void ab_naming_armor(const char *form,int32_t base,int32_t bonus)
{struct ab_naming_session *s=ab_object_session;if(ab_part(s,"armor")){ab_field_string(s,"form",form);if(strcmp(form,"bonus"))ab_field_number(s,"base",base);if(strcmp(form,"base"))ab_field_number(s,"bonus",bonus);ab_end_part(s);}}
void ab_naming_modifiers(const int *values,size_t count)
{struct ab_naming_session *s=ab_object_session;size_t i;if(ab_part(s,"modifiers")){ab_semantic_json_literal(&s->value,",\"values\":[");for(i=0;i<count;i++){if(i)ab_semantic_json_literal(&s->value,",");ab_semantic_json_int32(&s->value,values[i]);}ab_semantic_json_literal(&s->value,"]");ab_end_part(s);}}
void ab_naming_charging(void){struct ab_naming_session *s=ab_object_session;if(ab_part(s,"charging"))ab_end_part(s);}
static bool ab_inscription_begin(struct ab_naming_session *s)
{
 if(!s||!s->complete)return false;
 if(!s->inscriptions_open){if(!ab_part(s,"inscriptions"))return false;ab_semantic_json_literal(&s->value,",\"entries\":[");s->inscriptions_open=true;}
 if(s->inscription_count>=6){ab_fail(s,"CaptureCapacity");return false;}
 if(s->inscription_count++)ab_semantic_json_literal(&s->value,",");
 return true;
}
void ab_naming_inscription_user(const char *text)
{struct ab_naming_session *s=ab_object_session;if(ab_inscription_begin(s)){ab_semantic_json_literal(&s->value,"{\"origin\":\"user\",\"text\":");ab_semantic_json_string(&s->value,text);ab_semantic_json_literal(&s->value,"}");}}
void ab_naming_inscription_tag(const char *role)
{struct ab_naming_session *s=ab_object_session;const struct ab_naming_role *r=ab_role(role);if(ab_inscription_begin(s)){ab_semantic_json_literal(&s->value,"{\"name_id\":");if(!r)ab_fail(s,"UnsupportedCatalogIdentity");ab_semantic_json_string(&s->value,r?r->id:NULL);ab_semantic_json_literal(&s->value,"}");}}
void ab_naming_inscriptions_finish(void)
{struct ab_naming_session *s=ab_object_session;if(s&&s->inscriptions_open){ab_semantic_json_literal(&s->value,"]}");s->inscriptions_open=false;}}
void ab_naming_store_annotation(const char *role)
{struct ab_naming_session *s=ab_object_session;const struct ab_naming_role *r=ab_role(role);if(ab_part(s,"store_annotation")){ab_reference_id(s,r?r->id:NULL);ab_end_part(s);}}
void ab_naming_monster_pronoun(int32_t code)
{struct ab_naming_session *s=ab_monster_session;
 /* Indefinite someone forms do not disclose female versus male sex. */
 if(code>=0x24&&code<=0x26)code-=0x10;
 if(ab_part(s,"pronoun")){ab_field_number(s,"code",code);ab_end_part(s);}}
void ab_naming_monster_reflexive(const char *gender)
{struct ab_naming_session *s=ab_monster_session;if(ab_part(s,"reflexive")){ab_field_string(s,"gender",gender);ab_end_part(s);}}
void ab_naming_monster_prefix(const char *form)
{struct ab_naming_session *s=ab_monster_session;if(ab_part(s,"prefix")){ab_field_string(s,"form",form);ab_end_part(s);}}
bool ab_naming_monster_article(bool an){ab_naming_monster_prefix(an?"an":"a");return an;}
void ab_naming_monster_race(const struct monster_race *race,bool strip,const char *plural_form)
{
 struct ab_naming_session *s=ab_monster_session;const struct ab_naming_binding *b=race?ab_binding(AB_BINDINGS(race),race->ridx):NULL;const char *id=NULL;
 if(race&&ab_matches(b,race->name)){
  id=strip?b->stem:b->id;
  if(plural_form&&!strcmp(plural_form,"explicit"))id=b->plural&&b->plural_raw&&race->plural&&!strcmp(b->plural_raw,race->plural)?b->plural:NULL;
 }
 if(ab_part(s,"race")){ab_reference_id(s,id);ab_field_bool(s,"strip_appositive",false);if(plural_form)ab_field_string(s,"plural_form",plural_form);ab_end_part(s);}
}
void ab_naming_monster_marker(const char *kind){struct ab_naming_session *s=ab_monster_session;if(ab_part(s,kind))ab_end_part(s);}
void ab_naming_monster_capital(void){if(ab_monster_session)ab_monster_session->capital=true;}
void ab_naming_monster_list_prefix(bool unique,int32_t number)
{struct ab_naming_session *s=ab_monster_session;if(ab_part(s,"list_prefix")){ab_field_string(s,"form",unique?"unique":"count");if(!unique)ab_field_number(s,"number",number);ab_end_part(s);}}

static bool ab_copy(struct ab_naming_snapshot *out,uintptr_t address,bool object,uint32_t mode,bool subject)
{
 size_t i;const struct ab_naming_cache_entry *found=NULL;
 if(!out)return false;memset(out,0,sizeof(*out));
 if(!address)return false;
 for(i=0;i<AB_NAMING_CACHE_ENTRIES;i++)if(ab_cache[i].json&&ab_cache[i].object==object&&
  (subject?(ab_cache[i].subject==address&&ab_cache[i].mode==mode):ab_cache[i].buffer==address)&&(!found||ab_cache[i].serial>found->serial))found=&ab_cache[i];
 if(!found)return false;
 out->json=malloc((size_t)found->length+1);if(!out->json)return false;
 memcpy(out->json,found->json,(size_t)found->length+1);out->length=found->length;return true;
}
bool ab_naming_copy_object_snapshot(struct ab_naming_snapshot *out,const char *buffer){return ab_copy(out,(uintptr_t)buffer,true,0,false);}
bool ab_naming_copy_monster_snapshot(struct ab_naming_snapshot *out,const char *buffer){return ab_copy(out,(uintptr_t)buffer,false,0,false);}
bool ab_naming_copy_object_subject_snapshot(struct ab_naming_snapshot *out,const struct object *object,uint32_t mode){return ab_copy(out,(uintptr_t)object,true,mode,true);}
bool ab_naming_copy_monster_subject_snapshot(struct ab_naming_snapshot *out,const struct monster *monster,uint32_t mode){return ab_copy(out,(uintptr_t)monster,false,mode,true);}
void ab_naming_snapshot_release(struct ab_naming_snapshot *snapshot){if(snapshot){free(snapshot->json);memset(snapshot,0,sizeof(*snapshot));}}
static void ab_missing(struct ab_semantic_event *event)
{ab_semantic_json_literal(event,"{\"schema_version\":2,\"complete\":false,\"reason\":\"NoDescriptorSnapshot\"}");}
void ab_naming_param_snapshot(struct ab_semantic_event *event,const char *name,const char *type,const struct ab_naming_snapshot *snapshot)
{ab_semantic_param_begin(event,name,type);if(snapshot&&snapshot->json&&snapshot->length<=AB_NAMING_SNAPSHOT_MAX_BYTES)ab_semantic_json_literal(event,snapshot->json);else ab_missing(event);ab_semantic_param_end(event);}
bool ab_naming_copy_json_for_buffer(struct ab_semantic_event *event,const char *buffer,const char *kind)
{
 struct ab_naming_snapshot snapshot;bool found=false;
 memset(&snapshot,0,sizeof(snapshot));
 if(kind&&!strcmp(kind,"KnownObjectDescription"))found=ab_naming_copy_object_snapshot(&snapshot,buffer);
 else if(kind&&!strcmp(kind,"MonsterDescription"))found=ab_naming_copy_monster_snapshot(&snapshot,buffer);
 if(found)ab_semantic_json_literal(event,snapshot.json);else ab_missing(event);
 ab_naming_snapshot_release(&snapshot);return found;
}
#endif /* __EMSCRIPTEN__ */
