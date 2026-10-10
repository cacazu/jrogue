/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_MENU_CONTROLLER_H
#define ANGBAND_WEB_MENU_CONTROLLER_H
#ifdef __EMSCRIPTEN__
#include <stdint.h>
/* Owned repr(C) ABI. An effect pointer is copied before every C callback. */
struct ab_menu_event { uint32_t kind,code,mods,x,y,button; };
struct ab_menu_facts {
 uint32_t mode,skin;
 int32_t cursor,top,count,col,row,width,page_rows;
 uint32_t flags,notify,has_get_tag,has_context,no_action;
 int32_t previous_cursor;
};
struct ab_menu_span { const uint8_t *bytes;uint32_t len,present; };
struct ab_menu_policy {
 struct ab_menu_span selections,cmd_keys,switch_keys,inscriptions;
};
struct ab_menu_reply { int32_t value;struct ab_menu_event event;struct ab_menu_facts facts;struct ab_menu_policy policy; };
struct ab_menu_effect {
 uint32_t op;int32_t argument,cursor,top;struct ab_menu_event event;uint32_t result;
};
_Static_assert(sizeof(struct ab_menu_event)==24,"Rust menu Event ABI");
_Static_assert(sizeof(struct ab_menu_facts)==60,"Rust menu Facts ABI");
_Static_assert(sizeof(struct ab_menu_span)==12,"Rust menu ByteSpan ABI");
_Static_assert(sizeof(struct ab_menu_policy)==48,"Rust menu PolicySpans ABI");
_Static_assert(sizeof(struct ab_menu_reply)==136,"Rust menu ReplyCapture ABI");
_Static_assert(sizeof(struct ab_menu_effect)==44,"Rust menu Effect ABI");
extern uint32_t ab_rs_menu_open(const struct ab_menu_facts*,const struct ab_menu_policy*,const struct ab_menu_event*,const struct ab_menu_event*);
extern const struct ab_menu_effect *ab_rs_menu_effect(uint32_t);
extern const struct ab_menu_effect *ab_rs_menu_reply(uint32_t,const struct ab_menu_reply*);
extern uint32_t ab_rs_menu_close(uint32_t);
extern uint32_t ab_rs_menu_status(void);
extern int32_t ab_rs_menu_top(uint32_t,int32_t,int32_t,int32_t,int32_t);
enum { AB_MENU_SKIN_TAG=1,AB_MENU_ROW_TAG,AB_MENU_VALIDITY,AB_MENU_DIRECTION,
 AB_MENU_ACTION,AB_MENU_CONTEXT,AB_MENU_REFRESH,AB_MENU_RESIZE,
 AB_MENU_TERM_WIDTH,AB_MENU_DONE };
enum { AB_MENU_RETURN=1,AB_MENU_EAT=2,AB_MENU_MOUSE_HANDLED=4 };
#endif
#endif
