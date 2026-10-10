/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-context-menu.h"
#ifdef __EMSCRIPTEN__
#include "cmds.h"
#include "ui-input.h"
#include "web-interface-text.h"
#include "web-naming.h"
#include "web-semantic.h"
#include <stdio.h>
#include <string.h>
#include "../migration/context-menu-data/command-bindings.inc"
/* Menu pointers are presentation identities owned only between open/close.
 * No gameplay entity, descriptor buffer or selected command pointer is kept.
 * The existing visible-row observer is the only projector caller.
 * Enter shortcuts are copied after their original row callback formats them. */
#define AB_CONTEXT_DEPTH 8U
#define AB_CONTEXT_ROWS 512U
struct context_frame {
 struct menu *menu;
 char context[32];
 const char *ids[AB_CONTEXT_ROWS];
 menu_row_validity_t valid[AB_CONTEXT_ROWS];
 char shortcuts[AB_CONTEXT_ROWS][48];
 bool commands,construction_shortcuts;
 const char *prompt_id,*terrain_id,*prefix_id;
 bool prompt_object,prompt_named;
 struct ab_naming_snapshot prompt_name;
};
static struct context_frame frames[AB_CONTEXT_DEPTH];
static unsigned frame_count;
static struct context_frame *frame_for(const struct menu *menu) {
 unsigned i;for(i=0;i<frame_count;i++)if(frames[i].menu==menu)return &frames[i];
 return NULL;
}
static void context_parameter_int(struct ab_semantic_event *event,const char *name,int number) {
 ab_semantic_param_begin(event,name,"integer");ab_semantic_json_int32(event,number);ab_semantic_param_end(event);
}
static void context_parameter_bool(struct ab_semantic_event *event,const char *name,bool value) {
 ab_semantic_param_begin(event,name,"boolean");ab_semantic_json_bool(event,value);ab_semantic_param_end(event);
}
static void context_prompt(struct context_frame *frame) {
 if(!frame->prompt_id)return;
 if(frame->terrain_id) {
  struct ab_ui_param inner[]={AB_UI_REF("prefix",frame->prefix_id),AB_UI_REF("name",frame->terrain_id)};
  struct ab_ui_param p=AB_UI_NESTED("terrain","angband.look.subject.terrain",inner,N_ELEMENTS(inner));
  ab_ui_emit(frame->context,"prompt",frame->prompt_id,&p,1);
 } else if(frame->prompt_named) {
  struct ab_semantic_event event;
  ab_semantic_event_begin(&event,frame->prompt_id,"ui",frame->context,"prompt",0,-1);
  ab_naming_param_snapshot(&event,frame->prompt_object?"object":"monster",
   frame->prompt_object?"KnownObjectDescription":"MonsterDescription",&frame->prompt_name);
  ab_semantic_event_emit(&event);
 } else ab_ui_static(frame->context,"prompt",frame->prompt_id);
}
static void context_project(struct menu *menu,int oid) {
 struct context_frame *frame=frame_for(menu);struct ab_semantic_event event;
 char widget[48];int view=oid,y;
 if(!frame || oid<0 || oid>=(int)AB_CONTEXT_ROWS || !frame->ids[oid])return;
 /* These menus have no filters. Do not guess a filtered-view coordinate. */
 if(menu->filter_list)return;
 y=menu->active.row+view-menu->top;
 if(view<menu->top || view>=menu->top+menu->active.page_rows ||
  menu->active.col<0 || menu->active.col>255 || y<0 || y>255)return;
 if(view==menu->top)context_prompt(frame);
 if(frame->construction_shortcuts)ab_context_row_drawn(menu,oid);
 snprintf(widget,sizeof(widget),"__context_row:%d",oid);
 ab_semantic_event_begin(&event,"","ui",frame->context,widget,0,-1);
 context_parameter_int(&event,"x",menu->active.col);
 context_parameter_int(&event,"y",y);
 context_parameter_int(&event,"valid",frame->valid[oid]);
 context_parameter_int(&event,"depth",(int)(frame-frames));
 context_parameter_int(&event,"flags",menu->flags);
 context_parameter_int(&event,"count",menu->count);
 context_parameter_int(&event,"top",menu->top);
 context_parameter_int(&event,"col",menu->active.col);
 context_parameter_int(&event,"row",menu->active.row);
 context_parameter_int(&event,"width",menu->active.width);
 context_parameter_int(&event,"page_rows",menu->active.page_rows);
 context_parameter_bool(&event,"cursor",menu->cursor==view);
 ab_semantic_event_emit_control(&event);
}
void ab_context_open(struct menu *menu,const char *title_id,const char *prompt_id) {
 struct context_frame *frame;unsigned i;
 if(!menu || frame_for(menu) || frame_count>=AB_CONTEXT_DEPTH)return;
 frame=&frames[frame_count];memset(frame,0,sizeof(*frame));frame->menu=menu;
 snprintf(frame->context,sizeof(frame->context),"context-menu.%u",frame_count++);
 for(i=0;i<AB_CONTEXT_ROWS;i++)frame->valid[i]=MN_ROW_VALID;
 frame->prompt_id=prompt_id;
 ab_if_menu_bind(menu,frame->context,title_id,NULL,frame->ids,AB_CONTEXT_ROWS);
 ab_if_menu_projector(menu,context_project);
}
void ab_context_close(struct menu *menu) {
 struct context_frame *frame=frame_for(menu);
 if(!frame)return;
 /* The native call tree unwinds in stack order. Never release an outer owner. */
 if(frame!=&frames[frame_count-1])return;
 ab_if_menu_forget(menu);ab_naming_snapshot_release(&frame->prompt_name);
 memset(frame,0,sizeof(*frame));frame_count--;
}
const char *ab_context_label(struct menu *menu,const char *id,const char *native) {
 struct context_frame *frame=frame_for(menu);
 if(frame && menu->count>=0 && menu->count<(int)AB_CONTEXT_ROWS)frame->ids[menu->count]=id;
 return native;
}
menu_row_validity_t ab_context_valid(struct menu *menu,menu_row_validity_t original) {
 struct context_frame *frame=frame_for(menu);
 if(frame && menu->count>=0 && menu->count<(int)AB_CONTEXT_ROWS)frame->valid[menu->count]=original;
 return original;
}
static int context_list_index(const struct command_list *list,const struct cmd_info *commands) {
 size_t i;for(i=0;i<N_ELEMENTS(context_commands);i++)
  if((list && list==&cmds_all[i]) || (commands && commands==cmds_all[i].list))return (int)i;
 return -1;
}
void ab_context_command_list(struct menu *menu,const struct command_list *list) {
 struct context_frame *frame=frame_for(menu);int index=context_list_index(list,NULL);size_t i;
 if(!frame || index<0 || list->len>AB_CONTEXT_ROWS || list->len!=context_commands[index].count)return;
 frame->commands=true;
 for(i=0;i<list->len;i++)frame->ids[i]=context_commands[index].ids[i];
}
void ab_context_command_added(struct menu *menu,const struct cmd_info *commands,int index,const char *shortcut) {
 struct context_frame *frame=frame_for(menu);int list=context_list_index(NULL,commands);int oid=menu?menu->count-1:-1;
 if(!frame || list<0 || index<0 || (size_t)index>=context_commands[list].count || oid<0 || oid>=(int)AB_CONTEXT_ROWS)return;
 frame->commands=true;frame->construction_shortcuts=true;frame->ids[oid]=context_commands[list].ids[index];
 ab_context_shortcut(menu,oid,shortcut);
}
void ab_context_categories(struct menu *menu) {
 struct context_frame *frame=frame_for(menu);int i;
 if(!frame || menu->count<0 || menu->count>(int)N_ELEMENTS(context_categories))return;
 for(i=0;i<menu->count;i++)frame->ids[i]=context_categories[i];
}
void ab_context_category_row(struct menu *menu,int oid) {
 struct context_frame *frame=frame_for(menu);
 if(frame && oid>=0 && oid<(int)N_ELEMENTS(context_categories))frame->ids[oid]=context_categories[oid];
}
void ab_context_row_drawn(struct menu *menu,int oid) {
 struct context_frame *frame=frame_for(menu);
 if(!frame || !frame->commands || oid<0 || oid>=(int)AB_CONTEXT_ROWS || !frame->ids[oid])return;
 if(frame->shortcuts[oid][0]) {
  struct ab_ui_param p[]={AB_UI_REF("label",frame->ids[oid]),AB_UI_OPAQUE("shortcut","display_token",frame->shortcuts[oid])};
  ab_if_menu_text(menu,oid,"context.command.row",p,N_ELEMENTS(p));
 } else ab_if_menu_text(menu,oid,frame->ids[oid],NULL,0);
}
void ab_context_shortcut(struct menu *menu,int oid,const char *native_shortcut) {
 struct context_frame *frame=frame_for(menu);
 if(!frame || oid<0 || oid>=(int)AB_CONTEXT_ROWS)return;
 if(!native_shortcut || !native_shortcut[0])frame->shortcuts[oid][0]=0;
 else {
  /* The mouse command list supplies KC_TAB as one non-UTF-8 native byte.
   * Copy its source-selected key identity into the same readable token used
   * by Enter's original keypress_to_readable(). Native drawing is untouched. */
  const char *display_shortcut =
   ((unsigned char)native_shortcut[0] == KC_TAB && native_shortcut[1] == '\0') ? "Tab" : native_shortcut;
  snprintf(frame->shortcuts[oid],sizeof(frame->shortcuts[oid])," (%s)",display_shortcut);
 }
}
void ab_context_prompt_static(struct menu *menu,const char *id) {
 struct context_frame *frame=frame_for(menu);if(!frame)return;
 ab_naming_snapshot_release(&frame->prompt_name);frame->terrain_id=NULL;frame->prefix_id=NULL;frame->prompt_id=id;frame->prompt_named=false;
}
void ab_context_prompt_named(struct menu *menu,const char *id,const char *native_buffer,bool object) {
 struct context_frame *frame=frame_for(menu);if(!frame)return;
 ab_context_prompt_static(menu,id);frame->prompt_object=object;frame->prompt_named=true;
 if(object)ab_naming_copy_object_snapshot(&frame->prompt_name,native_buffer);
 else ab_naming_copy_monster_snapshot(&frame->prompt_name,native_buffer);
}
void ab_context_prompt_terrain(struct menu *menu,const char *selected_feature_id,const char *selected_prefix_id) {
 struct context_frame *frame=frame_for(menu);if(!frame)return;
 ab_context_prompt_static(menu,"context.prompt.seen_terrain");frame->terrain_id=selected_feature_id;frame->prefix_id=selected_prefix_id;
}
void ab_context_floor_prompt(int total_weight,int difference) {
 struct ab_ui_param p[]={AB_UI_DECIMAL("weight",total_weight),AB_UI_DECIMAL("capacity",ABS(difference)),
  AB_UI_REF("status",difference<0?"context.burden.overweight":"context.burden.remaining")};
 ab_ui_scope_begin("context-floor",true);ab_ui_emit(NULL,"prompt","context.prompt.floor_burden",p,N_ELEMENTS(p));ab_ui_scope_end();
}
#endif