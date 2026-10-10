/* SPDX-License-Identifier: GPL-2.0-only */
/* Owned source projections. This file never evaluates dice, effects or knowledge. */
#include "web-effect-description.h"
#ifdef __EMSCRIPTEN__
#include "effects.h"
#include "player-timed.h"
#include "player.h"
#include "project.h"
#include "web-domain-text.h"
#include "web-ui-text.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define AB_EFFECT_BUFFERS 64U
#define AB_EFFECT_RESULTS 32U
#define AB_EFFECT_PREFIXES 16U
#define AB_EFFECT_NODES 512U
struct ab_effect_identity { int index; const char *description,*menu; };
struct ab_effect_projection_identity { int index; const char *description,*player,*lash; };
struct ab_effect_lexical_identity { int index; const char *id; };
#include "../migration/effect-description-data/bindings.inc"
struct buffer_capture { const char *address; struct ab_semantic_event json; unsigned parts,params; bool ref_open,finished; };
struct result_capture { const void *address; struct ab_effect_graph graph; };
struct prefix_capture { const char *address,*id; };
static struct buffer_capture buffers[AB_EFFECT_BUFFERS];
static struct result_capture results[AB_EFFECT_RESULTS];
static struct prefix_capture prefixes[AB_EFFECT_PREFIXES];
static unsigned graph_depth;
static bool capture_failed,menu_active;
static const char graph_start[]="{\"schema_version\":1,\"parts\":[";
static void raw_begin(struct ab_semantic_event *json){memset(json,0,sizeof(*json));json->valid=true;}
static void reset_buffers(void){unsigned i;for(i=0;i<AB_EFFECT_BUFFERS;i++){ab_semantic_event_discard(&buffers[i].json);memset(&buffers[i],0,sizeof(buffers[i]));}}
static void reset_results(void){unsigned i;for(i=0;i<AB_EFFECT_RESULTS;i++){ab_semantic_event_discard(&results[i].graph.json);memset(&results[i],0,sizeof(results[i]));}}
static struct buffer_capture *buffer_get(const char *address,bool create){
 unsigned i;struct buffer_capture *empty=NULL;
 if(!address){if(create)capture_failed=true;return NULL;}
 for(i=0;i<AB_EFFECT_BUFFERS;i++){if(buffers[i].address==address)return &buffers[i];if(!buffers[i].address&&!empty)empty=&buffers[i];}
 if(!create)return NULL;
 if(!empty||!address){capture_failed=true;return NULL;}empty->address=address;return empty;
}
static struct result_capture *result_get(const void *address,bool create){
 unsigned i;struct result_capture *empty=NULL;
 for(i=0;i<AB_EFFECT_RESULTS;i++){if(results[i].address==address)return &results[i];if(!results[i].address&&!empty)empty=&results[i];}
 if(!create)return NULL;
 if(!empty||!address){capture_failed=true;return NULL;}empty->address=address;return empty;
}
static const char *lexical_id(enum ab_effect_lexical_family family,int index){
 size_t i;
 if(family<=AB_EFFECT_PROJECTION_LASH){for(i=0;i<sizeof(ab_effect_projection_ids)/sizeof(*ab_effect_projection_ids);i++)if(ab_effect_projection_ids[i].index==index){
  return family==AB_EFFECT_PROJECTION_DESC?ab_effect_projection_ids[i].description:family==AB_EFFECT_PROJECTION_PLAYER?ab_effect_projection_ids[i].player:ab_effect_projection_ids[i].lash;}}
 else if(family==AB_EFFECT_TIMED){for(i=0;i<sizeof(ab_effect_timed_ids)/sizeof(*ab_effect_timed_ids);i++)if(ab_effect_timed_ids[i].index==index)return ab_effect_timed_ids[i].id;}
 else if(family==AB_EFFECT_STAT){for(i=0;i<sizeof(ab_effect_stat_ids)/sizeof(*ab_effect_stat_ids);i++)if(ab_effect_stat_ids[i].index==index)return ab_effect_stat_ids[i].id;}
 else if(family==AB_EFFECT_SUMMON&&index>=0&&(size_t)index<sizeof(ab_effect_summon_ids)/sizeof(*ab_effect_summon_ids))return ab_effect_summon_ids[index];
 return NULL;
}
const char *ab_effect_description_id(int index,bool menu){size_t i;for(i=0;i<sizeof(ab_effect_identities)/sizeof(*ab_effect_identities);i++)if(ab_effect_identities[i].index==index)return menu?ab_effect_identities[i].menu:ab_effect_identities[i].description;return NULL;}
const char *ab_effect_safe_dice_format(int index,const char *native_format){
 switch(index){case EF_MOVE_ATTACK:return "moves the player up to 4 spaces and executes up to %s melee blows";case EF_MELEE_BLOWS:return "strikes %s blows against an adjacent monster";case EF_SWEEP:return "strikes %s blows against all adjacent monsters";default:return native_format;}
}
static void write_ref(struct ab_semantic_event *json,const char *id){
 if(!id){json->valid=false;return;}ab_semantic_json_literal(json,"{\"kind\":\"ref\",\"id\":");ab_semantic_json_string(json,id);ab_semantic_json_literal(json,",\"params\":{}");ab_semantic_json_literal(json,"}");
}
void ab_effect_graph_begin(struct ab_effect_graph *graph){
 if(!graph_depth){reset_buffers();reset_results();capture_failed=false;}
 graph_depth++;memset(graph,0,sizeof(*graph));raw_begin(&graph->json);graph->open=true;ab_semantic_json_literal(&graph->json,graph_start);
 if(graph_depth>16U)graph->json.valid=false;
}
static void graph_separator(struct ab_effect_graph *graph){if(!graph->open||graph->count++>=AB_EFFECT_NODES){graph->json.valid=false;return;}if(graph->count>1)ab_semantic_json_literal(&graph->json,",");}
void ab_effect_graph_ref(struct ab_effect_graph *graph,const char *id){graph_separator(graph);write_ref(&graph->json,id);}
const char *ab_effect_prefix(const char *id,const char *address){
 unsigned i;struct prefix_capture *empty=NULL;if(!address)return address;
 for(i=0;i<AB_EFFECT_PREFIXES;i++){if(prefixes[i].address==address){prefixes[i].id=id;return address;}if(!prefixes[i].address&&!empty)empty=&prefixes[i];}
 if(empty){empty->address=address;empty->id=id;}else capture_failed=true;return address;
}
const char *ab_effect_random_prefix(const char *address){return ab_effect_prefix("angband.effect_info.grammar.random",address);}
void ab_effect_graph_prefix(struct ab_effect_graph *graph,const char *address){unsigned i;for(i=0;i<AB_EFFECT_PREFIXES;i++)if(prefixes[i].address==address){ab_effect_graph_ref(graph,prefixes[i].id);return;}graph->json.valid=false;}
static void buffer_close_ref(struct buffer_capture *buffer){if(buffer&&buffer->ref_open){ab_semantic_json_literal(&buffer->json,"}}");buffer->ref_open=false;}}
static void buffer_finish(struct buffer_capture *buffer){if(!buffer||buffer->finished)return;buffer_close_ref(buffer);ab_semantic_json_literal(&buffer->json,"]}");buffer->finished=true;}
static void buffer_start_ref(struct buffer_capture *buffer,const char *id){
 if(!buffer)return;buffer_close_ref(buffer);if(buffer->finished||buffer->parts++>=AB_EFFECT_NODES){buffer->json.valid=false;return;}
 if(buffer->parts>1)ab_semantic_json_literal(&buffer->json,",");
 if(!id){buffer->json.valid=false;return;}
 ab_semantic_json_literal(&buffer->json,"{\"kind\":\"ref\",\"id\":");ab_semantic_json_string(&buffer->json,id);ab_semantic_json_literal(&buffer->json,",\"params\":{");buffer->params=0;buffer->ref_open=true;
}
void ab_effect_buffer_list_begin(const char *address,size_t capacity){
 struct buffer_capture *buffer=buffer_get(address,true);if(!buffer)return;
 ab_semantic_event_discard(&buffer->json);buffer->parts=buffer->params=0;buffer->ref_open=buffer->finished=false;raw_begin(&buffer->json);
 if(!capacity||capacity>65536U){buffer->json.valid=false;return;}
 ab_semantic_json_literal(&buffer->json,"{\"kind\":\"bounded\",\"native_max_bytes\":");ab_semantic_json_int32(&buffer->json,(int32_t)capacity);ab_semantic_json_literal(&buffer->json,",\"parts\":[");
}
void ab_effect_buffer_begin(const char *buffer,size_t capacity,const char *id){ab_effect_buffer_list_begin(buffer,capacity);buffer_start_ref(buffer_get(buffer,false),id);}
void ab_effect_buffer_append(const char *buffer,const char *id){buffer_start_ref(buffer_get(buffer,false),id);}
void ab_effect_buffer_end_ref(const char *buffer){buffer_close_ref(buffer_get(buffer,false));}
void ab_effect_buffer_list_ref(const char *address,const char *id){struct buffer_capture *buffer=buffer_get(address,false);if(!buffer)return;buffer_start_ref(buffer,id);buffer_close_ref(buffer);}
const char *ab_effect_list_literal(const char *buffer,const char *id,const char *value){ab_effect_buffer_list_ref(buffer,id);return value;}
void ab_effect_buffer_list_lexeme(const char *buffer,enum ab_effect_lexical_family family,int index){ab_effect_buffer_list_ref(buffer,lexical_id(family,index));}
static struct buffer_capture *parameter_begin(const char *address,const char *name,const char *type){
 struct buffer_capture *buffer=buffer_get(address,false);if(!buffer||!name||!buffer->ref_open){capture_failed=true;return NULL;}
 if(buffer->params++>=6U){buffer->json.valid=false;return NULL;}
 if(buffer->params>1)ab_semantic_json_literal(&buffer->json,",");ab_semantic_json_string(&buffer->json,name);ab_semantic_json_literal(&buffer->json,":{\"type\":");ab_semantic_json_string(&buffer->json,type);ab_semantic_json_literal(&buffer->json,",\"value\":");return buffer;
}
int ab_effect_integer(const char *address,const char *name,int value){struct buffer_capture *buffer=parameter_begin(address,name,"integer");if(buffer){ab_semantic_json_int32(&buffer->json,value);ab_semantic_json_literal(&buffer->json,"}");}return value;}
const char *ab_effect_reference(const char *address,const char *name,const char *id,const char *value){
 struct buffer_capture *buffer=parameter_begin(address,name,"localized_text");if(buffer){if(!id)buffer->json.valid=false;ab_semantic_json_literal(&buffer->json,"{\"id\":");ab_semantic_json_string(&buffer->json,id);ab_semantic_json_literal(&buffer->json,"}}");}return value;
}
const char *ab_effect_lexeme(const char *buffer,const char *name,enum ab_effect_lexical_family family,int index,const char *value){return ab_effect_reference(buffer,name,lexical_id(family,index),value);}
const char *ab_effect_graph_lexeme(const char *address,const char *name,enum ab_effect_lexical_family family,int index,const char *value){struct buffer_capture *buffer=parameter_begin(address,name,"EffectDescription");if(buffer){ab_semantic_json_literal(&buffer->json,graph_start);write_ref(&buffer->json,lexical_id(family,index));ab_semantic_json_literal(&buffer->json,"]}}");}return value;}
const char *ab_effect_selected(const char *buffer,const char *name,const char *value){unsigned i;for(i=0;i<AB_EFFECT_PREFIXES;i++)if(prefixes[i].address==value)return ab_effect_reference(buffer,name,prefixes[i].id,value);return ab_effect_reference(buffer,name,NULL,value);}
const char *ab_effect_nested_buffer(const char *address,const char *name,const char *value){
 struct buffer_capture *source=buffer_get(value,false),*target=parameter_begin(address,name,"EffectDescription");
 if(target){if(!source||source==target){target->json.valid=false;}else{buffer_finish(source);if(!source->json.valid)target->json.valid=false;
  ab_semantic_json_literal(&target->json,graph_start);ab_semantic_json_literal(&target->json,source->json.data?source->json.data:"null");ab_semantic_json_literal(&target->json,"]}");}
 ab_semantic_json_literal(&target->json,"}");}return value;
}
void ab_effect_graph_buffer(struct ab_effect_graph *graph,const char *address){
 struct buffer_capture *buffer=buffer_get(address,false);graph_separator(graph);if(!buffer){graph->json.valid=false;return;}buffer_finish(buffer);if(!buffer->json.valid)graph->json.valid=false;ab_semantic_json_literal(&graph->json,buffer->json.data?buffer->json.data:"null");
}
void ab_effect_graph_child(struct ab_effect_graph *graph,const void *address){
 struct result_capture *child=result_get(address,false);char saved;size_t offset=sizeof(graph_start)-1;
 if(!child||child->graph.open||!child->graph.count||child->graph.json.length<offset+2){graph->json.valid=false;return;}
 if(!child->graph.json.valid)graph->json.valid=false;
 if(graph->count)ab_semantic_json_literal(&graph->json,",");graph->count+=child->graph.count;if(graph->count>AB_EFFECT_NODES)graph->json.valid=false;
 saved=child->graph.json.data[child->graph.json.length-2];child->graph.json.data[child->graph.json.length-2]='\0';
 ab_semantic_json_literal(&graph->json,child->graph.json.data+offset);child->graph.json.data[child->graph.json.length-2]=saved;
 ab_semantic_event_discard(&child->graph.json);memset(child,0,sizeof(*child));
}
void ab_effect_graph_result(struct ab_effect_graph *graph,const void *address){
 struct result_capture *result;
 if(graph->open){ab_semantic_json_literal(&graph->json,"]}");graph->open=false;}if(capture_failed)graph->json.valid=false;
 if(graph_depth)graph_depth--;
 if(!graph_depth)memset(prefixes,0,sizeof(prefixes));
 if(!address){ab_semantic_event_discard(&graph->json);return;}
 result=result_get(address,true);if(!result){ab_semantic_event_discard(&graph->json);return;}
 ab_semantic_event_discard(&result->graph.json);result->graph=*graph;memset(graph,0,sizeof(*graph));
}
static void emit_graph(struct ab_semantic_event *event,const struct ab_semantic_event *graph){
 ab_semantic_param_begin(event,"description","EffectDescription");
 /* Failed capture is explicit unsupported data, never a partial localized sentence. */
 ab_semantic_json_literal(event,graph&&graph->valid&&graph->data?graph->data:"{\"schema_version\":0,\"parts\":[]}");ab_semantic_param_end(event);ab_semantic_event_emit(event);
}
void ab_effect_emit_result(const void *address){
 struct ab_semantic_event event,statement;struct result_capture *result=result_get(address,false);size_t offset=sizeof(graph_start)-1;char saved;
 if(!address)return;
 if(ab_domain_info_context()){if(!ab_domain_info_event_begin(&event,"angband.effect_info.description"))return;}
 else ab_semantic_event_begin(&event,"angband.effect_info.description","ui","effect-description","description",0,-1);
 raw_begin(&statement);ab_semantic_json_literal(&statement,graph_start);
 if(result&&result->graph.json.valid&&result->graph.json.length>=offset+2){
  saved=result->graph.json.data[result->graph.json.length-2];result->graph.json.data[result->graph.json.length-2]='\0';
  ab_semantic_json_literal(&statement,result->graph.json.data+offset);result->graph.json.data[result->graph.json.length-2]=saved;
  if(result->graph.count)ab_semantic_json_literal(&statement,",");write_ref(&statement,"angband.effect_info.grammar.statement_end");
 }else statement.valid=false;
 ab_semantic_json_literal(&statement,"]}");emit_graph(&event,&statement);ab_semantic_event_discard(&statement);
 if(result){ab_semantic_event_discard(&result->graph.json);memset(result,0,sizeof(*result));}
}
void ab_effect_menu_begin(void){reset_buffers();reset_results();memset(prefixes,0,sizeof(prefixes));capture_failed=false;menu_active=true;ab_ui_scope_begin("effect-menu",true);}
void ab_effect_emit_menu(const char *address,unsigned row){
 struct buffer_capture *buffer=buffer_get(address,false);struct ab_semantic_event graph,event;char widget[48];int n;
 if(!menu_active)return;n=snprintf(widget,sizeof(widget),"row.%u.label",row);if(n<0||(size_t)n>=sizeof(widget))return;
 raw_begin(&graph);ab_semantic_json_literal(&graph,graph_start);if(buffer){buffer_finish(buffer);if(!buffer->json.valid)graph.valid=false;ab_semantic_json_literal(&graph,buffer->json.data?buffer->json.data:"null");}else graph.valid=false;
 ab_semantic_json_literal(&graph,"]}");if(capture_failed)graph.valid=false;
 ab_semantic_event_begin(&event,"angband.effect_info.description","ui","effect-menu",widget,0,-1);emit_graph(&event,&graph);ab_semantic_event_discard(&graph);
}
void ab_effect_menu_random(unsigned row){char widget[48];int n;if(!menu_active)return;n=snprintf(widget,sizeof(widget),"row.%u.label",row);if(n>=0&&(size_t)n<sizeof(widget))ab_ui_static("effect-menu",widget,"angband.effect_info.grammar.menu.random");}
void ab_effect_menu_prompt(const char *native_prompt){
 const char *id;struct ab_semantic_event event;if(!menu_active)return;
 id=native_prompt?ab_domain_source_id(native_prompt):"angband.effect_info.grammar.menu.prompt";
 if(id)ab_ui_static("effect-menu","prompt",id);
 else{ab_semantic_event_begin(&event,"","ui","effect-menu","__unsupported:prompt",0,-1);ab_semantic_event_emit_control(&event);}
}
void ab_effect_menu_end(void){if(menu_active){ab_ui_scope_end();menu_active=false;reset_buffers();memset(prefixes,0,sizeof(prefixes));}}
#endif
