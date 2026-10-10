/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-list-text.h"
#ifdef __EMSCRIPTEN__
#include "web-ui-text.h"
#include "web-semantic.h"
#include <string.h>
#define ID(role) "angband.list." role
static struct { bool active; unsigned cursor; } states[2];
static struct ab_list_row *pending_object;
static const char *context(enum ab_list_kind kind)
{return kind==AB_LIST_OBJECT?"object-list":"monster-list";}
static bool valid_kind(enum ab_list_kind kind)
{return kind==AB_LIST_MONSTER || kind==AB_LIST_OBJECT;}
static bool next_widget(enum ab_list_kind kind,char *out,size_t size)
{
 if(!valid_kind(kind) || !states[kind].active)return false;
 if(states[kind].cursor>65535U)return false;
 strnfmt(out,size,"row.%u.label",states[kind].cursor++);return true;
}
void ab_list_begin(enum ab_list_kind kind)
{
 if(!valid_kind(kind))return;
 if(kind==AB_LIST_OBJECT)pending_object=NULL;
 states[kind].active=true;states[kind].cursor=1;
 ab_ui_scope_begin(context(kind),true);
}
void ab_list_end(enum ab_list_kind kind)
{
 if(!valid_kind(kind) || !states[kind].active)return;
 if(kind==AB_LIST_OBJECT)pending_object=NULL;
 states[kind].active=false;ab_ui_scope_end();
}
void ab_list_format_end(enum ab_list_kind kind,bool real_textblock,bool notice_guard)
{
 if(real_textblock)ab_list_end(kind);
 ab_naming_notice_suppress_end(notice_guard);
}
void ab_list_reset(enum ab_list_kind kind)
{
 if(!valid_kind(kind))return;
 ab_list_end(kind);if(kind==AB_LIST_OBJECT)pending_object=NULL;
 states[kind].cursor=0;ab_ui_reset(context(kind));
}
int ab_list_int(int *out,int original)
{if(out)*out=original;return original;}
bool ab_list_bool(bool *out,bool original)
{if(out)*out=original;return original;}
void ab_list_location(struct ab_list_row *row)
{if(row)row->location=true;}
void ab_list_sleep(struct ab_list_row *row,int source_role)
{if(row)row->sleep=source_role;}
void ab_list_monster_name(struct ab_list_row *row,const char *original_buffer)
{if(row)ab_naming_copy_monster_snapshot(&row->snapshot,original_buffer);}
void ab_list_object_name_begin(struct ab_list_row *row)
{
 pending_object=row;
 if(row)ab_naming_snapshot_release(&row->snapshot);
}
void ab_list_object_name_capture(const char *original_buffer)
{
 /* Active only inside the original object_list_format_name call, before strtok. */
 if(pending_object)ab_naming_copy_object_snapshot(&pending_object->snapshot,original_buffer);
}
void ab_list_object_name_end(struct ab_list_row *row)
{if(pending_object==row)pending_object=NULL;}
void ab_list_row_release(struct ab_list_row *row)
{
 if(!row)return;if(pending_object==row)pending_object=NULL;
 ab_naming_snapshot_release(&row->snapshot);
}
void ab_list_header(enum ab_list_kind kind,int section,int count,bool others,bool period)
{
 char widget[64];const char *id=NULL;
 const char *headers[2][6]={
  {ID("monster.header.visible.one"),ID("monster.header.visible.many"),ID("monster.header.aware.one"),ID("monster.header.aware.many"),ID("monster.header.aware_other.one"),ID("monster.header.aware_other.many")},
  {ID("object.header.visible.one"),ID("object.header.visible.many"),ID("object.header.aware.one"),ID("object.header.aware.many"),ID("object.header.aware_other.one"),ID("object.header.aware_other.many")}
 };
 struct ab_ui_param params[2];
 if(!next_widget(kind,widget,sizeof(widget)))return;
 if(section<0 || section>1 || count<0)return;
 if(count==0){
  id=kind==AB_LIST_OBJECT?(section?ID("object.header.aware.empty"):ID("object.header.visible.empty")):(section?ID("monster.header.aware.empty"):ID("monster.header.visible.empty"));
  ab_ui_static(context(kind),widget,id);return;
 }
 id=headers[kind][(section?(others?4:2):0)+(count==1?0:1)];
 params[0]=AB_UI_INT("count",count);
 params[1]=AB_UI_REF("end",period?ID("layout.period"):ID("layout.colon"));
 ab_ui_emit(context(kind),widget,id,params,2);
}
static void reference(struct ab_semantic_event *event,const char *name,const char *id)
{
 ab_semantic_param_begin(event,name,"localized_text");
 ab_semantic_json_literal(event,"{\"id\":");ab_semantic_json_string(event,id);ab_semantic_json_literal(event,"}");
 ab_semantic_param_end(event);
}
static void location(struct ab_semantic_event *event,const struct ab_list_row *row)
{
 if(!row || !row->location){reference(event,"location",ID("layout.empty"));return;}
 ab_semantic_param_begin(event,"location","localized_text");
 ab_semantic_json_literal(event,"{\"id\":\"angband.list.location\",\"params\":{\"y\":{\"type\":\"integer\",\"value\":");
 ab_semantic_json_int32(event,row->y);
 ab_semantic_json_literal(event,"},\"direction_y\":{\"type\":\"localized_text\",\"value\":{\"id\":");
 ab_semantic_json_string(event,row->north?ID("direction.north"):ID("direction.south"));
 ab_semantic_json_literal(event,"}},\"x\":{\"type\":\"integer\",\"value\":");ab_semantic_json_int32(event,row->x);
 ab_semantic_json_literal(event,"},\"direction_x\":{\"type\":\"localized_text\",\"value\":{\"id\":");
 ab_semantic_json_string(event,row->west?ID("direction.west"):ID("direction.east"));
 ab_semantic_json_literal(event,"}}}}");ab_semantic_param_end(event);
}
static void asleep(struct ab_semantic_event *event,const struct ab_list_row *row,int count)
{
 if(!row || row->sleep==0){reference(event,"asleep",ID("layout.empty"));return;}
 if(row->sleep==1){reference(event,"asleep",ID("monster.asleep.one"));return;}
 ab_semantic_param_begin(event,"asleep","localized_text");
 ab_semantic_json_literal(event,"{\"id\":\"angband.list.monster.asleep.many\",\"params\":{\"count\":{\"type\":\"integer\",\"value\":");
 ab_semantic_json_int32(event,count);ab_semantic_json_literal(event,"}}}");ab_semantic_param_end(event);
 if(row->sleep!=2)event->valid=false;
}
void ab_list_row_emit(enum ab_list_kind kind,const struct ab_list_row *row,int count_asleep)
{
 char widget[64];struct ab_semantic_event event;
 if(!next_widget(kind,widget,sizeof(widget)))return;
 ab_semantic_event_begin(&event,kind==AB_LIST_OBJECT?ID("object.row"):ID("monster.row"),"ui",context(kind),widget,0,-1);
 ab_naming_param_snapshot(&event,kind==AB_LIST_OBJECT?"object":"monster",kind==AB_LIST_OBJECT?"KnownObjectDescription":"MonsterDescription",row?&row->snapshot:NULL);
 if(kind==AB_LIST_MONSTER)asleep(&event,row,count_asleep);
 location(&event,row);ab_semantic_event_emit(&event);
}
void ab_list_omitted(enum ab_list_kind kind,int original_remaining)
{
 char widget[64];struct ab_ui_param param=AB_UI_INT("count",original_remaining);
 if(!next_widget(kind,widget,sizeof(widget)))return;
 ab_ui_emit(context(kind),widget,kind==AB_LIST_OBJECT?ID("object.omitted"):ID("monster.omitted"),&param,1);
}
void ab_list_hallucination(void)
{
 char widget[64];if(next_widget(AB_LIST_MONSTER,widget,sizeof(widget)))
  ab_ui_static(context(AB_LIST_MONSTER),widget,ID("monster.hallucination"));
}
void ab_list_sort_prompt(bool currently_enabled)
{
 struct ab_semantic_event event;
 /* Patch the committed rows before the original blocking viewer call. */
 ab_ui_scope_begin(context(AB_LIST_MONSTER),false);
 ab_ui_static(context(AB_LIST_MONSTER),"row.0.label",currently_enabled?ID("monster.sort.disable_exp"):ID("monster.sort.enable_exp"));
 ab_semantic_event_begin(&event,"","ui",context(AB_LIST_MONSTER),"__row:0",0,-1);
 ab_semantic_param_begin(&event,"activation_key","integer");ab_semantic_json_int32(&event,120);ab_semantic_param_end(&event);
 ab_semantic_event_emit_control(&event);ab_ui_scope_end();
}
#endif
