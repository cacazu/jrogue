/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_CONTEXT_MENU_H
#define ANGBAND_WEB_CONTEXT_MENU_H
#ifdef __EMSCRIPTEN__
#include "ui-menu.h"
#include "web-ui-text.h"
struct command_list;
struct cmd_info;
void ab_context_open(struct menu *menu,const char *title_id,const char *prompt_id);
void ab_context_close(struct menu *menu);
const char *ab_context_label(struct menu *menu,const char *id,const char *native);
menu_row_validity_t ab_context_valid(struct menu *menu,menu_row_validity_t original);
void ab_context_command_list(struct menu *menu,const struct command_list *list);
void ab_context_command_added(struct menu *menu,const struct cmd_info *commands,int index,const char *shortcut);
void ab_context_categories(struct menu *menu);
void ab_context_category_row(struct menu *menu,int oid);
void ab_context_row_drawn(struct menu *menu,int oid);
void ab_context_shortcut(struct menu *menu,int oid,const char *native_shortcut);
void ab_context_prompt_static(struct menu *menu,const char *id);
void ab_context_prompt_named(struct menu *menu,const char *id,const char *native_buffer,bool object);
void ab_context_prompt_terrain(struct menu *menu,const char *selected_feature_id,const char *selected_prefix_id);
void ab_context_floor_prompt(int total_weight,int difference);
#else
/* The original source expressions remain one evaluation in native builds. */
#define ab_context_label(menu,id,native) (native)
#define ab_context_valid(menu,original) (original)
#endif
#endif