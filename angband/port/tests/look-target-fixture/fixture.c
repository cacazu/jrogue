/* Tests actual look helper and actual annotated/native producer functions.
 * The semantic sink and naming allocator are deliberately mocked; no game runs. */
#include "angband.h"
#include "web-look-target.h"
#include "web-semantic.h"
static struct player fixture_player;
static struct chunk fixture_chunk;
static struct monster fixture_monster;
static struct feature fixture_features[FEAT_MAX];
struct player *player=&fixture_player;
struct chunk *cave=&fixture_chunk;
struct feature *f_info=fixture_features;
static unsigned checks, condition_cases, coordinate_cases, native_queries, live_snapshots, emitted;
#define CHECK(x) do {checks++;if(!(x)){fprintf(stderr,"LOOK fixture assertion line %d: %s\n",__LINE__,#x);exit(2);}} while(0)
struct monster *cave_monster(struct chunk *chunk,int index)
{(void)chunk;native_queries++;return index==1?&fixture_monster:NULL;}
bool monster_is_destroyed(struct monster *monster)
{native_queries++;return monster->destroyed;}
struct square *square(struct chunk *chunk,struct loc location)
{(void)location;native_queries++;return &chunk->known;}
size_t my_strcpy(char *buffer,const char *text,size_t size)
{size_t length=strlen(text);if(size){size_t n=length<size-1?length:size-1;memcpy(buffer,text,n);buffer[n]=0;}return length;}
size_t my_strcat(char *buffer,const char *text,size_t size)
{size_t old=strlen(buffer);return old+(old<size?my_strcpy(buffer+old,text,size-old):strlen(text));}
int strnfmt(char *buffer,size_t size,const char *format,...)
{va_list args;int n;va_start(args,format);n=vsnprintf(buffer,size,format,args);va_end(args);return n;}
static bool snapshot(struct ab_naming_snapshot *destination,const char *buffer)
{
 if(!buffer)return false;
 destination->length=(uint32_t)strlen(buffer);destination->json=malloc(destination->length+1);
 CHECK(destination->json!=NULL);memcpy(destination->json,buffer,destination->length+1);live_snapshots++;return true;
}
bool ab_naming_copy_object_snapshot(struct ab_naming_snapshot *destination,const char *buffer){return snapshot(destination,buffer);}
bool ab_naming_copy_monster_snapshot(struct ab_naming_snapshot *destination,const char *buffer){return snapshot(destination,buffer);}
void ab_naming_snapshot_release(struct ab_naming_snapshot *snapshot)
{if(snapshot->json){CHECK(live_snapshots>0);live_snapshots--;free(snapshot->json);}snapshot->json=NULL;snapshot->length=0;}
const char *ab_if_feature_id(int feature)
{static const char *const ids[]={
#include "feature-ids.h"
};return feature>=0&&feature<FEAT_MAX?ids[feature]:NULL;}
static void append(struct ab_semantic_event *event,const char *text)
{
 size_t length=strlen(text);
 if(!event->valid)return;
 if(length>event->capacity-event->length-1){event->valid=false;return;}
 memcpy(event->data+event->length,text,length+1);event->length+=length;
}
void ab_semantic_json_literal(struct ab_semantic_event *event,const char *text)
{if(!text){event->valid=false;return;}append(event,text);}
void ab_semantic_json_string(struct ab_semantic_event *event,const char *text)
{
 const unsigned char *p=(const unsigned char *)text;char escape[8];append(event,"\"");
 for(;*p;p++){
  if(*p=='"')append(event,"\\\"");else if(*p=='\\')append(event,"\\\\");
  else if(*p<32){snprintf(escape,sizeof(escape),"\\u%04x",*p);append(event,escape);}
  else {escape[0]=(char)*p;escape[1]=0;append(event,escape);}
 }
 append(event,"\"");
}
void ab_semantic_json_int32(struct ab_semantic_event *event,int32_t value)
{char text[32];snprintf(text,sizeof(text),"%d",value);append(event,text);}
void ab_semantic_json_bool(struct ab_semantic_event *event,bool value)
{append(event,value?"true":"false");}
void ab_semantic_event_begin(struct ab_semantic_event *event,const char *id,const char *channel,const char *context,const char *widget,int32_t severity,int32_t sound)
{
 (void)channel;(void)context;(void)widget;(void)severity;(void)sound;
 memset(event,0,sizeof(*event));event->capacity=262144;event->data=malloc(event->capacity);CHECK(event->data!=NULL);event->data[0]=0;event->valid=true;
 append(event,"{\"id\":");ab_semantic_json_string(event,id);append(event,",\"params\":{");
}
void ab_semantic_param_begin(struct ab_semantic_event *event,const char *name,const char *type)
{
 if(event->parameter_count++)append(event,",");ab_semantic_json_string(event,name);append(event,":{\"type\":");
 ab_semantic_json_string(event,type);append(event,",\"value\":");
}
void ab_semantic_param_end(struct ab_semantic_event *event){append(event,"}");}
void ab_semantic_event_discard(struct ab_semantic_event *event){free(event->data);event->data=NULL;}
void ab_semantic_event_emit(struct ab_semantic_event *event)
{
 if(event->valid){append(event,"}}");printf("EVENT %s\n",event->data);emitted++;}
 ab_semantic_event_discard(event);
}
void ab_semantic_event_emit_control(struct ab_semantic_event *event){ab_semantic_event_emit(event);}

static void producer_cases(void)
{
 const int health[]={100,99,60,59,25,24,10,9,1,0,-1};
 const char *const status_ids[]={"angband.look.condition.status.sleep","angband.look.condition.status.hold","angband.look.condition.status.disenchant","angband.look.condition.status.confusion","angband.look.condition.status.fear","angband.look.condition.status.stun","angband.look.condition.status.slow","angband.look.condition.status.fast"};
 const int grades[]={0,1,1,2,2,3,3,4,4,4,4};
 const size_t sizes[]={1,8,80,96};
 int living,h,mask,j;size_t n;char actual[96],original[96],id[96];struct ab_look_state state;
 for(living=0;living<2;living++)for(h=0;h<(int)N_ELEMENTS(health);h++)for(mask=0;mask<256;mask++)for(n=0;n<N_ELEMENTS(sizes);n++){
  unsigned before=native_queries;
  fixture_monster.hp=health[h];fixture_monster.maxhp=100;fixture_monster.destroyed=!living;
  for(j=0;j<8;j++)fixture_monster.m_timed[j]=(mask&(1<<j))?7:0;
  ab_look_init(&state);memset(actual,0,sizeof(actual));memset(original,0,sizeof(original));
  original_look_mon_desc(original,sizes[n],1);CHECK(native_queries==before+2);
  ab_look_condition_begin(&state,actual);look_mon_desc(actual,sizes[n],1);ab_look_condition_end(&state);
  CHECK(native_queries==before+4);CHECK(strcmp(actual,original)==0);CHECK(state.condition.complete);
  snprintf(id,sizeof(id),"angband.look.condition.health.%s.%d",living?"living":"nonliving",grades[h]);CHECK(strcmp(state.condition.health,id)==0);
  for(j=0;j<8;j++){CHECK((state.condition.status[j]!=NULL)==((mask&(1<<j))!=0));if(state.condition.status[j])CHECK(strcmp(state.condition.status[j],status_ids[j])==0);}
  condition_cases++;ab_look_release(&state);
 }
 /* Wrong output buffer, stale hooks and null native monster are deliberate admission failures. */
 ab_look_init(&state);ab_look_condition_begin(&state,actual);look_mon_desc(original,80,1);ab_look_condition_end(&state);CHECK(!state.condition.complete);
 ab_look_condition_health(actual,true,0);CHECK(!state.condition.complete);
 ab_look_condition_begin(&state,actual);look_mon_desc(actual,80,0);ab_look_condition_end(&state);CHECK(!state.condition.complete);
 ab_look_condition_begin(&state,actual);ab_look_condition_health(actual,true,-1);ab_look_condition_status(actual,8);ab_look_condition_end(&state);CHECK(!state.condition.complete);
 ab_look_release(&state);
}
static void coordinate_tests(void)
{
 const int values[]={0,1,5,100,255};int py,px,y,x;char actual[20],original[20],wrong[20];struct ab_look_state state,other;
 for(py=0;py<5;py++)for(px=0;px<5;px++)for(y=0;y<5;y++)for(x=0;x<5;x++){
  player->grid.y=values[py];player->grid.x=values[px];ab_look_init(&state);
  original_coords_desc(original,20,values[y],values[x]);ab_look_coordinate_begin(&state,actual);coords_desc(actual,20,values[y],values[x]);ab_look_coordinate_end(&state);
  CHECK(strcmp(actual,original)==0);CHECK(state.coordinates);CHECK(state.vertical==ABS(values[y]-values[py]));CHECK(state.horizontal==ABS(values[x]-values[px]));
  CHECK(state.south==(values[y]>values[py]));CHECK(state.west==(values[x]<values[px]));coordinate_cases++;ab_look_release(&state);
 }
 ab_look_init(&state);ab_look_init(&other);ab_look_coordinate_begin(&state,actual);coords_desc(wrong,20,2,3);ab_look_coordinate_end(&state);CHECK(!state.coordinates);
 ab_look_coordinate_begin(&state,actual);coords_desc(actual,20,2,3);ab_look_coordinate_end(&other);CHECK(!state.coordinates);ab_look_coordinate_end(&state);CHECK(state.coordinates);
 ab_look_coordinate_begin(&state,actual);ab_look_release(&state);coords_desc(actual,20,2,3);CHECK(!state.coordinates);
}
static void feature_tests(void)
{
 struct ab_look_state state;int feature;struct loc location={1,1};const char *actual,*original;
 for(feature=0;feature<FEAT_MAX;feature++){fixture_features[feature].fidx=feature;fixture_features[feature].name=(char *)ab_if_feature_id(feature);}
 for(feature=0;feature<FEAT_MAX;feature++){
  unsigned before=native_queries;fixture_chunk.known.feat=feature;ab_look_init(&state);
  original=original_square_apparent_name(cave,location);ab_look_feature_begin(&state);actual=square_apparent_name(cave,location);ab_look_feature_end(&state);
  CHECK(native_queries==before+2);CHECK(actual==original);CHECK(state.feature==feature);CHECK(state.terrain);CHECK(strcmp(ab_look_selected_feature_id(),ab_if_feature_id(feature))==0);
  ab_look_release(&state);
 }
 fixture_chunk.known.feat=FEAT_SECRET;fixture_features[FEAT_SECRET].mimic=&fixture_features[FEAT_GRANITE];ab_look_init(&state);
 ab_look_feature_begin(&state);square_apparent_name(cave,location);ab_look_feature_end(&state);CHECK(state.feature==FEAT_GRANITE);CHECK(strcmp(ab_look_selected_feature_id(),"terrain.granite.name")==0);
 fixture_chunk.known.feat=FEAT_NONE;ab_look_feature_begin(&state);square_apparent_name(cave,location);ab_look_feature_end(&state);CHECK(state.feature==FEAT_NONE);CHECK(strcmp(ab_look_selected_feature_id(),"terrain.none.name")==0);
 ab_look_feature_selected(-1);CHECK(ab_look_selected_feature_id()==NULL);ab_look_feature_selected(FEAT_MAX);CHECK(ab_look_selected_feature_id()==NULL);
 ab_look_release(&state);
}
static void emit_tests(void)
{
 struct ab_look_state state;char coordinate[20],name[128]="{\"mock_name\":\"a blade {猫}: %n ユーザー名\"}";int value=0,counter=0;unsigned before;
 ab_look_init(&state);CHECK(AB_LOOK_INT(&value,++counter)==1);CHECK(counter==1&&value==1);CHECK(AB_LOOK_WIZARD(&state,++counter==2));CHECK(counter==2&&state.wizard);CHECK(AB_LOOK_TRAP_ARTICLE(&state,++counter==3));CHECK(counter==3&&state.article_an);state.article_an=false;
 state.intro=2;state.x=7;state.y=9;state.wizard=false;player->grid.x=2;player->grid.y=4;
 ab_look_coordinate_begin(&state,coordinate);coords_desc(coordinate,20,9,7);ab_look_coordinate_end(&state);
 before=native_queries;ab_look_name(&state,name,true);CHECK(live_snapshots==1);memset(name,'x',4);CHECK(strstr(state.object.json,"a blade")!=NULL);CHECK(native_queries==before);
 ab_look_emit(&state,AB_LOOK_OBJECT,0);CHECK(emitted==1);
 state.wizard=true;state.noise=3;state.scent=4;ab_look_emit(&state,AB_LOOK_STRANGE,0);CHECK(emitted==2);
 state.trap=7;state.wizard=false;ab_look_emit(&state,AB_LOOK_TRAP,0);CHECK(emitted==3);state.wizard=true;ab_look_emit(&state,AB_LOOK_TRAP,0);CHECK(emitted==4);
 state.wizard=false;state.gender=0;ab_look_emit(&state,AB_LOOK_CARRY,0);CHECK(emitted==4);state.wizard=true;ab_look_emit(&state,AB_LOOK_CARRY,0);CHECK(emitted==5);
 state.wizard=false;ab_look_emit(&state,AB_LOOK_PILE,1);CHECK(emitted==5);ab_look_emit(&state,AB_LOOK_PILE,2);CHECK(emitted==6);
 state.coordinates=false;ab_look_emit(&state,AB_LOOK_STRANGE,0);CHECK(emitted==6);
 state.coordinates=true;state.intro=-1;ab_look_emit(&state,AB_LOOK_STRANGE,0);CHECK(emitted==6);
 state.intro=1;state.trap=-1;ab_look_emit(&state,AB_LOOK_TRAP,0);CHECK(emitted==6);state.trap=40;ab_look_emit(&state,AB_LOOK_TRAP,0);CHECK(emitted==6);
 state.terrain=false;ab_look_emit(&state,AB_LOOK_TERRAIN,0);CHECK(emitted==6);state.condition.complete=false;ab_look_emit(&state,AB_LOOK_MONSTER,0);CHECK(emitted==6);
 {
  uint32_t original_length=state.object.length;
  state.object.length=AB_NAMING_SNAPSHOT_MAX_BYTES+1U;ab_look_emit(&state,AB_LOOK_OBJECT,0);CHECK(emitted==6);state.object.length=original_length;
 }
 {
  char monster_name[80]="{\"mock_name\":\"an orc\"}";
  char native_condition[80];struct loc location={2,3};
  ab_look_name(&state,monster_name,false);fixture_monster.hp=9;fixture_monster.maxhp=100;fixture_monster.destroyed=false;
  memset(fixture_monster.m_timed,0,sizeof(fixture_monster.m_timed));fixture_monster.m_timed[MON_TMD_SLEEP]=3;fixture_monster.m_timed[MON_TMD_FEAR]=2;
  ab_look_condition_begin(&state,native_condition);look_mon_desc(native_condition,sizeof(native_condition),1);ab_look_condition_end(&state);
  ab_look_emit(&state,AB_LOOK_MONSTER,0);CHECK(emitted==7);
  fixture_chunk.known.feat=FEAT_NONE;ab_look_feature_begin(&state);square_apparent_name(cave,location);ab_look_feature_end(&state);
  ab_look_emit(&state,AB_LOOK_TERRAIN,0);CHECK(emitted==8);
 }
 ab_look_release(&state);CHECK(live_snapshots==0);ab_look_release(&state);CHECK(live_snapshots==0);
}
int main(void)
{
 producer_cases();coordinate_tests();feature_tests();emit_tests();
 printf("RESULT {\"passed\":true,\"checks\":%u,\"conditionCases\":%u,\"coordinateCases\":%u,\"events\":%u,\"liveSnapshots\":%u}\n",checks,condition_cases,coordinate_cases,emitted,live_snapshots);
 return 0;
}
