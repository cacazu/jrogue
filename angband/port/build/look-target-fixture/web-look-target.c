/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-look-target.h"
#ifdef __EMSCRIPTEN__
#include "cave.h"
#include "web-interface-text.h"
#include "web-semantic.h"
#include <string.h>
#define ID(role) "angband.look." role

/* Scoped observational handoffs. None contains an entity, grid, or player pointer. */
static struct ab_look_state *coordinate_owner, *condition_owner, *feature_owner;
static const char *coordinate_buffer, *condition_buffer;
static unsigned coordinate_parts;
static int selected_feature = -1;

struct look_feature_ids { int feature; const char *prefix, *preposition; };
struct look_trap_ids { const char *normal, *wizard, *article; };
/* AB_LOOK_REVIEWED_TABLES_BEGIN */
static const struct look_feature_ids look_features[]={
 {FEAT_NONE,"angband.look.terrain.prefix.an","angband.look.preposition.on"},
 {FEAT_FLOOR,"angband.look.terrain.prefix.an","angband.look.preposition.on"},
 {FEAT_CLOSED,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
 {FEAT_OPEN,"angband.look.terrain.prefix.an","angband.look.preposition.in"},
 {FEAT_BROKEN,"angband.look.terrain.prefix.a","angband.look.preposition.in"},
 {FEAT_LESS,"angband.look.terrain.prefix.an","angband.look.preposition.on"},
 {FEAT_MORE,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
 {FEAT_STORE_GENERAL,"angband.look.terrain.prefix.entrance","angband.look.preposition.at"},
 {FEAT_STORE_ARMOR,"angband.look.terrain.prefix.entrance","angband.look.preposition.at"},
 {FEAT_STORE_WEAPON,"angband.look.terrain.prefix.entrance","angband.look.preposition.at"},
 {FEAT_STORE_BOOK,"angband.look.terrain.prefix.entrance","angband.look.preposition.at"},
 {FEAT_STORE_ALCHEMY,"angband.look.terrain.prefix.entrance","angband.look.preposition.at"},
 {FEAT_STORE_MAGIC,"angband.look.terrain.prefix.entrance","angband.look.preposition.at"},
 {FEAT_STORE_BLACK,"angband.look.terrain.prefix.entrance","angband.look.preposition.at"},
 {FEAT_HOME,"angband.look.terrain.prefix.entrance","angband.look.preposition.at"},
 {FEAT_SECRET,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
 {FEAT_RUBBLE,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
 {FEAT_MAGMA,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
 {FEAT_QUARTZ,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
 {FEAT_MAGMA_K,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
 {FEAT_QUARTZ_K,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
 {FEAT_GRANITE,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
 {FEAT_PERM,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
 {FEAT_LAVA,"angband.look.terrain.prefix.some","angband.look.preposition.on"},
 {FEAT_PASS_RUBBLE,"angband.look.terrain.prefix.a","angband.look.preposition.on"},
};
static const struct look_trap_ids look_traps[]={
 {"angband.look.trap.kind_0.normal","angband.look.trap.kind_0.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_1.normal","angband.look.trap.kind_1.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_2.normal","angband.look.trap.kind_2.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_3.normal","angband.look.trap.kind_3.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_4.normal","angband.look.trap.kind_4.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_5.normal","angband.look.trap.kind_5.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_6.normal","angband.look.trap.kind_6.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_7.normal","angband.look.trap.kind_7.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_8.normal","angband.look.trap.kind_8.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_9.normal","angband.look.trap.kind_9.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_10.normal","angband.look.trap.kind_10.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_11.normal","angband.look.trap.kind_11.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_12.normal","angband.look.trap.kind_12.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_13.normal","angband.look.trap.kind_13.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_14.normal","angband.look.trap.kind_14.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_15.normal","angband.look.trap.kind_15.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_16.normal","angband.look.trap.kind_16.wizard","angband.look.article.an"},
 {"angband.look.trap.kind_17.normal","angband.look.trap.kind_17.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_18.normal","angband.look.trap.kind_18.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_19.normal","angband.look.trap.kind_19.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_20.normal","angband.look.trap.kind_20.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_21.normal","angband.look.trap.kind_21.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_22.normal","angband.look.trap.kind_22.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_23.normal","angband.look.trap.kind_23.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_24.normal","angband.look.trap.kind_24.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_25.normal","angband.look.trap.kind_25.wizard","angband.look.article.an"},
 {"angband.look.trap.kind_26.normal","angband.look.trap.kind_26.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_27.normal","angband.look.trap.kind_27.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_28.normal","angband.look.trap.kind_28.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_29.normal","angband.look.trap.kind_29.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_30.normal","angband.look.trap.kind_30.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_31.normal","angband.look.trap.kind_31.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_32.normal","angband.look.trap.kind_32.wizard","angband.look.article.an"},
 {"angband.look.trap.kind_33.normal","angband.look.trap.kind_33.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_34.normal","angband.look.trap.kind_34.wizard","angband.look.article.an"},
 {"angband.look.trap.kind_35.normal","angband.look.trap.kind_35.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_36.normal","angband.look.trap.kind_36.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_37.normal","angband.look.trap.kind_37.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_38.normal","angband.look.trap.kind_38.wizard","angband.look.article.a"},
 {"angband.look.trap.kind_39.normal","angband.look.trap.kind_39.wizard","angband.look.article.a"},
};
/* AB_LOOK_REVIEWED_TABLES_END */

void ab_look_init(struct ab_look_state *state)
{
 if(!state)return;
 memset(state,0,sizeof(*state));
 state->intro=-1;state->gender=-1;state->feature=-1;state->trap=-1;
}
void ab_look_release(struct ab_look_state *state)
{
 if(!state)return;
 if(coordinate_owner==state){coordinate_owner=NULL;coordinate_buffer=NULL;coordinate_parts=0;}
 if(condition_owner==state){condition_owner=NULL;condition_buffer=NULL;}
 if(feature_owner==state)feature_owner=NULL;
 ab_naming_snapshot_release(&state->monster);ab_naming_snapshot_release(&state->object);
}
int ab_look_int(int *destination,int original)
{if(destination)*destination=original;return original;}
bool ab_look_wizard(struct ab_look_state *state,bool original)
{if(state)state->wizard=original;return original;}
bool ab_look_trap_article(struct ab_look_state *state,bool original)
{if(state)state->article_an=original;return original;}
void ab_look_name(struct ab_look_state *state,const char *buffer,bool object)
{
 struct ab_naming_snapshot *destination;
 if(!state)return;
 destination=object?&state->object:&state->monster;
 ab_naming_snapshot_release(destination);
 if(object)ab_naming_copy_object_snapshot(destination,buffer);
 else ab_naming_copy_monster_snapshot(destination,buffer);
}
void ab_look_coordinate_begin(struct ab_look_state *state,const char *buffer)
{
 coordinate_owner=state;coordinate_buffer=buffer;coordinate_parts=0;
 if(state)state->coordinates=false;
}
void ab_look_coordinate_direction(const char *buffer,bool vertical,bool negative)
{
 if(!coordinate_owner || buffer!=coordinate_buffer)return;
 if(vertical){coordinate_owner->south=negative;coordinate_parts|=1U;}
 else {coordinate_owner->west=negative;coordinate_parts|=2U;}
}
int ab_look_coordinate_distance(const char *buffer,bool vertical,int original)
{
 if(coordinate_owner && buffer==coordinate_buffer){
  if(vertical){coordinate_owner->vertical=original;coordinate_parts|=4U;}
  else {coordinate_owner->horizontal=original;coordinate_parts|=8U;}
 }
 return original;
}
void ab_look_coordinate_end(struct ab_look_state *state)
{
 if(coordinate_owner!=state)return;
 state->coordinates=coordinate_parts==15U;
 coordinate_owner=NULL;coordinate_buffer=NULL;coordinate_parts=0;
}
void ab_look_condition_begin(struct ab_look_state *state,const char *buffer)
{
 condition_owner=state;condition_buffer=buffer;
 if(state)memset(&state->condition,0,sizeof(state->condition));
}
void ab_look_condition_health(const char *buffer,bool living,int grade)
{
 static const char *const ids[2][5]={
  {ID("condition.health.nonliving.0"),ID("condition.health.nonliving.1"),ID("condition.health.nonliving.2"),ID("condition.health.nonliving.3"),ID("condition.health.nonliving.4")},
  {ID("condition.health.living.0"),ID("condition.health.living.1"),ID("condition.health.living.2"),ID("condition.health.living.3"),ID("condition.health.living.4")}
 };
 if(condition_owner && buffer==condition_buffer && grade>=0 && grade<5)
  condition_owner->condition.health=ids[living?1:0][grade];
}
void ab_look_condition_status(const char *buffer,int status)
{
 static const char *const ids[]={ID("condition.status.sleep"),ID("condition.status.hold"),ID("condition.status.disenchant"),ID("condition.status.confusion"),ID("condition.status.fear"),ID("condition.status.stun"),ID("condition.status.slow"),ID("condition.status.fast")};
 if(condition_owner && buffer==condition_buffer && status>=0 && status<8)
  condition_owner->condition.status[status]=ids[status];
}
void ab_look_condition_end(struct ab_look_state *state)
{
 if(condition_owner!=state)return;
 state->condition.complete=state->condition.health!=NULL;
 condition_owner=NULL;condition_buffer=NULL;
}
void ab_look_feature_begin(struct ab_look_state *state)
{
 feature_owner=state;
 if(state){state->feature=-1;state->terrain=false;}
}
void ab_look_feature_selected(int selected)
{
 selected_feature=selected>=0 && selected<FEAT_MAX?selected:-1;
 if(feature_owner){feature_owner->feature=selected_feature;feature_owner->terrain=selected_feature>=0;}
}
void ab_look_feature_end(struct ab_look_state *state)
{if(feature_owner==state)feature_owner=NULL;}
/* Only for immediate consumption after the caller's original square_apparent_name(). */
const char *ab_look_selected_feature_id(void)
{return selected_feature>=0?ab_if_feature_id(selected_feature):NULL;}
static const struct look_feature_ids *feature_ids(int feature)
{
 size_t i;
 for(i=0;i<N_ELEMENTS(look_features);i++)if(look_features[i].feature==feature)return &look_features[i];
 return NULL;
}
const char *ab_look_selected_feature_prefix_id(void)
{
 const struct look_feature_ids *ids=feature_ids(selected_feature);
 return ids?ids->prefix:NULL;
}

/* Nested localized_text construction accepts only our reviewed identities and fields. */
static void object_start(struct ab_semantic_event *event,const char *id,bool parameters)
{
 ab_semantic_json_literal(event,"{\"id\":");ab_semantic_json_string(event,id);
 if(parameters)ab_semantic_json_literal(event,",\"params\":{");
}
static void object_end(struct ab_semantic_event *event,bool parameters)
{ab_semantic_json_literal(event,parameters?"}}":"}");}
static void field_start(struct ab_semantic_event *event,const char *name,const char *type,bool comma)
{
 if(comma)ab_semantic_json_literal(event,",");
 ab_semantic_json_string(event,name);ab_semantic_json_literal(event,":{\"type\":");
 ab_semantic_json_string(event,type);ab_semantic_json_literal(event,",\"value\":");
}
static void field_end(struct ab_semantic_event *event)
{ab_semantic_json_literal(event,"}");}
static void field_ref(struct ab_semantic_event *event,const char *name,const char *id,bool comma)
{
 field_start(event,name,"localized_text",comma);object_start(event,id,false);
 object_end(event,false);field_end(event);
}
static void field_integer(struct ab_semantic_event *event,const char *name,int value,bool comma)
{
 field_start(event,name,"integer",comma);ab_semantic_json_int32(event,value);field_end(event);
}
static void parameter_ref(struct ab_semantic_event *event,const char *name,const char *id)
{
 ab_semantic_param_begin(event,name,"localized_text");object_start(event,id,false);
 object_end(event,false);ab_semantic_param_end(event);
}
static void subject(struct ab_semantic_event *event,struct ab_look_state *state,enum ab_look_content content,int count)
{
 const struct look_feature_ids *terrain;
 if(content==AB_LOOK_OBJECT || content==AB_LOOK_CARRY || content==AB_LOOK_MONSTER){
  bool object=content!=AB_LOOK_MONSTER;
  struct ab_naming_snapshot *name=object?&state->object:&state->monster;
  ab_semantic_param_begin(event,"subject","localized_text");
  object_start(event,object?ID("subject.object"):ID("subject.monster"),true);
  field_start(event,object?"object":"monster",object?"KnownObjectDescription":"MonsterDescription",false);
  if(!name->json || !name->length){event->valid=false;return;}
  if(name->length>AB_NAMING_SNAPSHOT_MAX_BYTES){event->valid=false;return;}
  ab_semantic_json_literal(event,name->json);field_end(event);object_end(event,true);
  ab_semantic_param_end(event);return;
 }
 ab_semantic_param_begin(event,"subject","localized_text");
 if(content==AB_LOOK_STRANGE)object_start(event,ID("subject.strange"),false);
 else if(content==AB_LOOK_PILE){
  object_start(event,ID("subject.pile"),true);field_integer(event,"count",count,false);
 }else if(content==AB_LOOK_TRAP){
  const struct look_trap_ids *lexical;
  if(state->trap<0 || (size_t)state->trap>=N_ELEMENTS(look_traps)){event->valid=false;return;}
  lexical=&look_traps[state->trap];object_start(event,ID("subject.trap"),true);
  field_ref(event,"article",state->article_an?ID("article.an"):ID("article.a"),false);
  field_ref(event,"name",state->wizard?lexical->wizard:lexical->normal,true);
 }else if(content==AB_LOOK_TERRAIN){
  terrain=feature_ids(state->feature);
  if(!state->terrain || !terrain){event->valid=false;return;}
  object_start(event,ID("subject.terrain"),true);
  field_ref(event,"prefix",terrain->prefix,false);
  field_ref(event,"name",ab_if_feature_id(state->feature),true);
 }else {event->valid=false;return;}
 object_end(event,content!=AB_LOOK_STRANGE);ab_semantic_param_end(event);
}
static void condition(struct ab_semantic_event *event,const struct ab_look_state *state,enum ab_look_content content)
{
 static const char *const fields[]={"sleep","hold","disenchant","confusion","fear","stun","slow","fast"};
 unsigned i;
 if(content!=AB_LOOK_MONSTER){parameter_ref(event,"condition",ID("empty"));return;}
 if(!state->condition.complete){event->valid=false;return;}
 ab_semantic_param_begin(event,"condition","localized_text");
 object_start(event,ID("condition.parentheses"),true);
 field_start(event,"condition","localized_text",false);
 object_start(event,ID("condition.sequence"),true);
 field_ref(event,"health",state->condition.health,false);
 for(i=0;i<8;i++)field_ref(event,fields[i],state->condition.status[i]?state->condition.status[i]:ID("empty"),true);
 object_end(event,true);field_end(event);object_end(event,true);ab_semantic_param_end(event);
}
void ab_look_emit(struct ab_look_state *state,enum ab_look_content content,int count)
{
 static const char *const rows[]={ID("row.self"),ID("row.see"),ID("row.sense"),ID("row.recall")};
 static const char *const genders[]={ID("carry.gender.female"),ID("carry.gender.male"),ID("carry.gender.other")};
 const struct look_feature_ids *terrain;
 struct ab_semantic_event event;
 if(!state || !state->coordinates || state->intro<0 || state->intro>3)return;
 if(content==AB_LOOK_CARRY && (!state->wizard || state->gender<0 || state->gender>2))return;
 if(content==AB_LOOK_PILE && count<=1)return;
 ab_semantic_event_begin(&event,content==AB_LOOK_CARRY?ID("row.carry"):rows[state->intro],"ui","target-detail","row.0.prose",0,-1);
 if(content==AB_LOOK_CARRY){
  parameter_ref(&event,"gender",genders[state->gender]);
  parameter_ref(&event,"also",state->also?ID("carry.also"):ID("carry.first"));
 }else{
  const char *preposition=ID("empty");
  if(state->intro==0){
   terrain=content==AB_LOOK_TERRAIN?feature_ids(state->feature):NULL;
   preposition=terrain?terrain->preposition:ID("preposition.on");
  }
  parameter_ref(&event,"preposition",preposition);
  condition(&event,state,content);
 }
 subject(&event,state,content,count);
 ab_semantic_param_begin(&event,"coordinates","localized_text");object_start(&event,ID("coordinates"),true);
 field_integer(&event,"vertical",state->vertical,false);
 field_ref(&event,"north_south",state->south?ID("direction.south"):ID("direction.north"),true);
 field_integer(&event,"horizontal",state->horizontal,true);
 field_ref(&event,"east_west",state->west?ID("direction.west"):ID("direction.east"),true);
 object_end(&event,true);ab_semantic_param_end(&event);
 if(state->wizard){
  ab_semantic_param_begin(&event,"diagnostics","localized_text");object_start(&event,ID("diagnostics"),true);
  field_integer(&event,"y",state->y,false);field_integer(&event,"x",state->x,true);
  field_integer(&event,"noise",state->noise,true);field_integer(&event,"scent",state->scent,true);
  object_end(&event,true);ab_semantic_param_end(&event);
 }else parameter_ref(&event,"diagnostics",ID("empty"));
 ab_semantic_event_emit(&event);
}
#endif
