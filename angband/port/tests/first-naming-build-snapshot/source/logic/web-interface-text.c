/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "web-interface-text.h"
#ifdef __EMSCRIPTEN__
#include "web-semantic.h"
#include "cave.h"
#include "option.h"
#include "web-naming.h"
#include "../migration/interface-data/option-bindings.inc"
#include <stdio.h>
#include <string.h>
/* Presentation-only bounded identities. No C gameplay object is retained. */
struct ab_if_binding {
 const struct menu *menu;
 const char *context, *title_id, *prompt_id;
 const char *const *row_ids;
 size_t row_count;
 void (*project)(struct menu*,int);
};
static struct ab_if_binding bindings[64];
static const char *item_context;
static struct ab_if_binding *binding(const struct menu *menu) {
 size_t i;
 if(!menu)return NULL;
 for(i=0;i<sizeof(bindings)/sizeof(bindings[0]);i++)
  if(bindings[i].menu==menu) return &bindings[i];
 return NULL;
}
const char *ab_if_option_id(int option) {
 size_t i;for(i=0;i<sizeof(ab_if_options)/sizeof(ab_if_options[0]);i++)
  if(ab_if_options[i].option==option)return ab_if_options[i].id;
 return NULL;
}
void ab_if_static(const char *context,const char *widget,const char *id) {
 ab_ui_static(context,widget,id);
}
void ab_if_menu_bind(struct menu *menu,const char *context,
 const char *title_id,const char *prompt_id,const char *const *row_ids,
 size_t row_count) {
 size_t i;struct ab_if_binding *b=binding(menu);
 if(!menu || !context || row_count>512)return;
 if(!b)for(i=0;i<sizeof(bindings)/sizeof(bindings[0]);i++)
  if(!bindings[i].menu){b=&bindings[i];break;}
 if(!b)return;
 *b=(struct ab_if_binding){menu,context,title_id,prompt_id,row_ids,row_count,NULL};
}
void ab_if_menu_projector(struct menu *menu,void (*project)(struct menu*,int)) {
 struct ab_if_binding *b=binding(menu);if(b)b->project=project;
}
const char *ab_if_feature_id(int feature) {
 switch(feature) {
#define FEAT(code) case FEAT_##code:return ab_ui_terrain_id(#code);
#include "list-terrain.h"
#undef FEAT
 default:return NULL;
 }
}
void ab_if_menu_begin(struct menu *menu) {
 struct ab_if_binding *b=binding(menu);
 if(!b)return;
 ab_ui_scope_begin(b->context,true);
 if(b->title_id)ab_ui_static(NULL,"title",b->title_id);
 if(b->prompt_id)ab_ui_static(NULL,"prompt",b->prompt_id);
}
void ab_if_menu_end(struct menu *menu) {
 if(binding(menu))ab_ui_scope_end();
}
void ab_if_menu_leave(struct menu *menu) {
 struct ab_if_binding *b=binding(menu);
 if(b)ab_ui_reset(b->context);
}
void ab_if_menu_forget(struct menu *menu) {
 struct ab_if_binding *b=binding(menu);
 if(b){ab_ui_reset(b->context);memset(b,0,sizeof(*b));}
}
void ab_if_row_text(const char *context,int index,const char *id,
 const struct ab_ui_param *params,size_t count) {
 char widget[48];if(index<0 || index>65535 || !id)return;
 snprintf(widget,sizeof(widget),"row.%d.name",index);
 ab_ui_emit(context,widget,id,params,count);
}
void ab_if_menu_text(struct menu *menu,int oid,const char *id,
 const struct ab_ui_param *params,size_t count) {
 struct ab_if_binding *b=binding(menu);
 if(b)ab_if_row_text(b->context,oid,id,params,count);
}
void ab_if_menu_row(struct menu *menu,int oid,char key,bool selected,int color) {
 struct ab_if_binding *b=binding(menu);struct ab_semantic_event event;
 char widget[48],token[2]={key,0};
 if(!b || oid<0 || oid>65535)return;
 if(b->row_ids && (size_t)oid<b->row_count && b->row_ids[oid])
  ab_if_row_text(b->context,oid,b->row_ids[oid],NULL,0);
 snprintf(widget,sizeof(widget),"__row:%d",oid);
 ab_semantic_event_begin(&event,"","ui",b->context,widget,0,-1);
 if(key>=0x21 && key<=0x7e){
  ab_semantic_param_begin(&event,"key","display_token");
  ab_semantic_json_string(&event,token);ab_semantic_param_end(&event);
  ab_semantic_param_begin(&event,"activation_key","integer");
  ab_semantic_json_int32(&event,(unsigned char)key);ab_semantic_param_end(&event);
 }
 ab_semantic_param_begin(&event,"selected","boolean");
 ab_semantic_json_bool(&event,selected);ab_semantic_param_end(&event);
 ab_semantic_param_begin(&event,"color","integer");
 ab_semantic_json_int32(&event,color);ab_semantic_param_end(&event);
 ab_semantic_event_emit_control(&event);
 if(b->project)b->project(menu,oid);
}
void ab_if_named_buffer(const char *context,int index,const char *native_buffer,
 const char *type) {
 struct ab_naming_snapshot snapshot={0};struct ab_semantic_event event;
 char widget[48];if(!context || index<0 || index>65535)return;
 if(!strcmp(type,"KnownObjectDescription"))ab_naming_copy_object_snapshot(&snapshot,native_buffer);
 else ab_naming_copy_monster_snapshot(&snapshot,native_buffer);
 snprintf(widget,sizeof(widget),"row.%d.name",index);
 ab_semantic_event_begin(&event,!strcmp(type,"KnownObjectDescription")?"interface.items.row.name":"interface.monsters.row.name","ui",context,widget,0,-1);
 ab_naming_param_snapshot(&event,!strcmp(type,"KnownObjectDescription")?"object":"monster",type,&snapshot);
 ab_semantic_event_emit(&event);ab_naming_snapshot_release(&snapshot);
}
void ab_if_items_begin(const char *context,bool enabled) {
 item_context=enabled?context:NULL;
 if(item_context)ab_ui_scope_begin(item_context,true);
}
void ab_if_items_end(void) {
 if(item_context)ab_ui_scope_end();item_context=NULL;
}
void ab_if_items_name(int index,const char *native_buffer,bool object) {
 if(!item_context)return;
 if(object)ab_if_named_buffer(item_context,index,native_buffer,"KnownObjectDescription");
 else ab_if_row_text(item_context,index,"interface.items.row.empty",NULL,0);
}
void ab_if_items_key(int index,char key,bool selected,int color) {
 struct ab_semantic_event event;char widget[48],token[2]={key,0};
 if(!item_context || index<0 || index>65535)return;
 snprintf(widget,sizeof(widget),"__row:%d",index);
 ab_semantic_event_begin(&event,"","ui",item_context,widget,0,-1);
 if(key>=0x21 && key<=0x7e){
  ab_semantic_param_begin(&event,"key","display_token");ab_semantic_json_string(&event,token);ab_semantic_param_end(&event);
  ab_semantic_param_begin(&event,"activation_key","integer");ab_semantic_json_int32(&event,(unsigned char)key);ab_semantic_param_end(&event);
 }
 ab_semantic_param_begin(&event,"selected","boolean");ab_semantic_json_bool(&event,selected);ab_semantic_param_end(&event);
 ab_semantic_param_begin(&event,"color","integer");ab_semantic_json_int32(&event,color);ab_semantic_param_end(&event);
 ab_semantic_event_emit_control(&event);
}
void ab_if_items_number(int index,const char *field,const char *id,
 const char *parameter,int value,bool tenths) {
 char widget[64];struct ab_ui_param p=tenths?AB_UI_DECIMAL(parameter,value):AB_UI_INT(parameter,value);
 if(!item_context || index<0 || index>65535)return;
 snprintf(widget,sizeof(widget),"row.%d.%s",index,field);
 ab_ui_emit(item_context,widget,id,&p,1);
}
void ab_if_menu_number(struct menu *menu,int index,const char *field,
 const char *id,const char *parameter,int value,bool tenths) {
 struct ab_if_binding *b=binding(menu);char widget[64];
 struct ab_ui_param p=tenths?AB_UI_DECIMAL(parameter,value):AB_UI_INT(parameter,value);
 if(!b || index<0 || index>65535)return;
 snprintf(widget,sizeof(widget),"row.%d.%s",index,field);
 ab_ui_emit(b->context,widget,id,&p,1);
}
#endif
