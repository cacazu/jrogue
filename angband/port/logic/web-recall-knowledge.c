/* SPDX-License-Identifier: GPL-2.0-only */
/* Projections copy facts selected by ui-knowledge.c. No simulation queries. */
#include "angband.h"
#include "message.h"
#include "web-recall-knowledge.h"
#include "web-ui-text.h"
#include "web-interface-text.h"
#include "web-semantic.h"
#include "web-naming.h"
#ifdef __EMSCRIPTEN__
#include <string.h>
#include <stdio.h>
static struct ab_rk_title pending_title;
static const char *pending_title_address;
static void row_widget(char *out,size_t size,int index,const char *field) {
 snprintf(out,size,"row.%d.%s",index,field);
}
const char *ab_rk_status_token(int index,const char *id,const char *native) {
 char widget[64];
 if(index>=0 && index<=65535 && id) {
  row_widget(widget,sizeof(widget),index,"status");
  ab_ui_static("knowledge-items",widget,id);
 }
 return native;
}
void ab_rk_kills(int index,int kills) {
 char widget[64];struct ab_ui_param p=AB_UI_INT("kills",kills);
 if(index<0 || index>65535)return;
 row_widget(widget,sizeof(widget),index,"kills");
 ab_ui_emit("knowledge-items",widget,"interface.knowledge.row.kills",&p,1);
}
void ab_rk_monster_name_restore(int index,const struct monster_race *race) {
 /* The preceding legacy kills projector used row.name. Restore its unchanged
  * already selected race descriptor; no knowledge predicates are re-evaluated. */
 ab_if_row_text("knowledge-items",index,ab_naming_monster_name_id(race),NULL,0);
}
void ab_rk_unique_summary(int known,int slain) {
 struct ab_ui_param p[]={AB_UI_INT("known",known),AB_UI_INT("slain",slain)};
 ab_ui_emit("knowledge-metadata","summary","ui.knowledge.summary.uniques",p,2);
}
void ab_rk_group_summary(int group,int total) {
 struct ab_ui_param p[]={AB_UI_INT("group",group),AB_UI_INT("total",total)};
 ab_ui_emit("knowledge-metadata","summary","ui.knowledge.summary.creatures",p,2);
}
void ab_rk_title_prepare(const char *native,const char *id,uint32_t seed) {
 memset(&pending_title,0,sizeof(pending_title));
 pending_title_address=native;pending_title.id=id;
 snprintf(pending_title.seed,sizeof(pending_title.seed),"%08lx",(unsigned long)seed);
}
void ab_rk_title_take(const char *native,struct ab_rk_title *out) {
 memset(out,0,sizeof(*out));
 if(native==pending_title_address)*out=pending_title;
 memset(&pending_title,0,sizeof(pending_title));pending_title_address=NULL;
 /* A new native panel invalidates the preceding metadata, including summary. */
 ab_ui_reset("knowledge-metadata");
}
void ab_rk_title_emit(const struct ab_rk_title *source) {
 struct ab_ui_param p;
 if(!source || !source->id)return;
 if(!strcmp(source->id,"ui.knowledge.title.artifacts.seed")) {
  p=AB_UI_OPAQUE("seed","display_token",source->seed);
  ab_ui_emit("knowledge-metadata","title",source->id,&p,1);
 } else ab_ui_static("knowledge-metadata","title",source->id);
}
void ab_rk_knowledge_leave(void) { ab_ui_reset("knowledge-metadata"); }
static void row_color(const char *context,uint16_t age,int color) {
 struct ab_semantic_event event;char widget[48];
 snprintf(widget,sizeof(widget),"__row:%u",(unsigned)age);
 ab_semantic_event_begin(&event,"","ui",context,widget,0,-1);
 ab_semantic_param_begin(&event,"color","integer");
 ab_semantic_json_int32(&event,color);ab_semantic_param_end(&event);
 ab_semantic_param_begin(&event,"selected","boolean");
 ab_semantic_json_bool(&event,false);ab_semantic_param_end(&event);
 ab_semantic_event_emit_control(&event);
}
static void recall_content(uint16_t age,const char *context) {
 char widget[64];row_widget(widget,sizeof(widget),age,"name");
 if(!ab_message_recall_emit(age,context,widget))
  ab_ui_static(context,widget,"ui.recall.row.legacy_unbound");
}
void ab_rk_recall_one(void) {
 ab_ui_scope_begin("message-one",true);
 ab_ui_static(NULL,"prefix","ui.recall.one.prefix");
 if(messages_num()) { recall_content(0,"message-one");row_color("message-one",0,message_color(0)); }
 ab_ui_scope_end();
}
void ab_rk_recall_begin(void) { ab_ui_scope_begin("message-recall",true); }
void ab_rk_recall_row(uint16_t age,int terminal_row,uint16_t count,int color,int offset) {
 char widget[64];
 recall_content(age,"message-recall");row_color("message-recall",age,color);
 if(count>1) {
  struct ab_ui_param p=AB_UI_INT("count",count);
  row_widget(widget,sizeof(widget),age,"repeat");
  ab_ui_emit(NULL,widget,"ui.recall.row.repeat",&p,1);
 }
 row_widget(widget,sizeof(widget),age,"age");ab_ui_number(widget,age);
 row_widget(widget,sizeof(widget),age,"terminal_row");ab_ui_number(widget,terminal_row);
 row_widget(widget,sizeof(widget),age,"offset");ab_ui_number(widget,offset);
}
void ab_rk_recall_header(int first,int last,int total,int offset) {
 struct ab_ui_param p[]={AB_UI_INT("first",first),AB_UI_INT("last",last),AB_UI_INT("total",total),AB_UI_INT("offset",offset)};
 ab_ui_emit(NULL,"title","ui.recall.header",p,4);
}
void ab_rk_recall_end(const char *query) {
 if(query && query[0]) {
  struct ab_ui_param p=AB_UI_OPAQUE("query","verbatim_user_text",query);
  ab_ui_emit(NULL,"search","ui.recall.search.current",&p,1);
 }
 ab_ui_scope_end();
}
void ab_rk_recall_leave(void) { ab_ui_reset("message-recall"); }
bool ab_rk_recall_find(uint16_t age,const char *query,bool native_match) {
 const char *localized;
 if(native_match)return true;
 if(!query || !query[0])return false;
 localized=ab_message_recall_text(age);
 return localized && my_stristr(localized,query)!=NULL;
}
#endif
