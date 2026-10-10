/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_INTERFACE_TEXT_H
#define ANGBAND_WEB_INTERFACE_TEXT_H
#ifdef __EMSCRIPTEN__
#include "ui-menu.h"
#include "web-ui-text.h"
#include "web-menu-controller.h"
void ab_if_static(const char *context, const char *widget, const char *id);
void ab_if_menu_bind(struct menu *menu, const char *context,
 const char *title_id, const char *prompt_id, const char *const *row_ids,
 size_t row_count);
void ab_if_menu_begin(struct menu *menu);
void ab_if_menu_end(struct menu *menu);
void ab_if_menu_leave(struct menu *menu);
void ab_if_menu_forget(struct menu *menu);
void ab_if_menu_row(struct menu *menu, int oid, char key,
 bool selected, int color);
void ab_if_menu_text(struct menu *menu, int oid, const char *id,
 const struct ab_ui_param *params, size_t count);
void ab_if_menu_projector(struct menu *menu,void (*project)(struct menu*,int));
const char *ab_if_feature_id(int feature);
void ab_if_row_text(const char *context, int index, const char *id,
 const struct ab_ui_param *params, size_t count);
const char *ab_if_option_id(int option);
void ab_if_items_begin(const char *context, bool enabled);
void ab_if_items_end(void);
const char *ab_if_item_prompt(const char *id,const char *native_prompt);
const char *ab_if_item_prompt_take(const char *native_prompt);
void ab_if_item_header_start(void);
void ab_if_item_header_field(const char *widget,const char *id);
void ab_if_item_header_action(const char *name,const char *id,int activation_key);
void ab_if_item_header_emit(void);
void ab_if_items_name(int index, const char *native_buffer, bool object);
void ab_if_items_key(int index, char key, bool selected, int color);
void ab_if_items_number(int index, const char *field, const char *id,
 const char *parameter, int value, bool tenths);
void ab_if_named_buffer(const char *context, int index,
 const char *native_buffer, const char *type);
void ab_if_menu_number(struct menu *menu, int index, const char *field,
 const char *id, const char *parameter, int value, bool tenths);
#define AB_IF_TEXT(i,c,w,call) (ab_if_static((c),(w),(i)), (call))
#define AB_IF_ROW_NUMBER(i,f,id,p,v,t,call) (ab_if_items_number((i),(f),(id),(p),(v),(t)), (call))
#define AB_IF_ROW_EMPTY(i,call) (ab_if_items_name((i),NULL,false), (call))
#define AB_IF_MENU_NUMBER(m,i,f,id,p,v,t,call) (ab_if_menu_number((m),(i),(f),(id),(p),(v),(t)), (call))
#define AB_IF_NAME_ROW(c,i,b,t,call) ((call), ab_if_named_buffer((c),(i),(b),(t)))
#define AB_IF_KNOWLEDGE_KILLS(i,v,call) (ab_if_row_text("knowledge-items",(i),"interface.knowledge.row.kills",(const struct ab_ui_param[]){AB_UI_INT("kills",(v))},1), (call))
#define AB_IF_ITEM_PROMPT(i,call) ab_if_item_prompt((i),(call))
#define AB_IF_ITEM_HEADER(w,i,call) (ab_if_item_header_field((w),(i)),(call))
#define AB_IF_ITEM_ACTION(n,i,k,call) (ab_if_item_header_action((n),(i),(k)),(call))
#else
#define AB_IF_TEXT(i,c,w,call) call
#define AB_IF_ROW_NUMBER(i,f,id,p,v,t,call) call
#define AB_IF_ROW_EMPTY(i,call) call
#define AB_IF_MENU_NUMBER(m,i,f,id,p,v,t,call) call
#define AB_IF_NAME_ROW(c,i,b,t,call) call
#define AB_IF_KNOWLEDGE_KILLS(i,v,call) call
#define AB_IF_ITEM_PROMPT(i,call) call
#define AB_IF_ITEM_HEADER(w,i,call) call
#define AB_IF_ITEM_ACTION(n,i,k,call) call
#endif
#endif
