/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_STORE_WELCOME_H
#define ANGBAND_WEB_STORE_WELCOME_H
#include <stddef.h>
#ifdef __EMSCRIPTEN__
void ab_sw_clear(void);
void ab_sw_forget(void);
void ab_sw_hint_begin(void);
void ab_sw_hint_select(int native_list_ordinal);
const char *ab_sw_hint_result(int native_count,const char *native_hint);
const char *ab_sw_hint_message(size_t native_format_index,const char *native_hint);
int ab_sw_title_rank(unsigned int cidx,int native_rank);
const char *ab_sw_customer_player(const char *native_name);
const char *ab_sw_customer_valued(const char *native_name);
const char *ab_sw_greeting(size_t native_index,const char *native_owner,const char *native_customer,const char *native_formatted);
#define AB_SW_HINT_WIN(i,v) (ab_sw_hint_select(i),(v))
#define AB_SW_HINT_RESULT(n,v) ab_sw_hint_result((n),(v))
#define AB_SW_HINT_MESSAGE(i,v) ab_sw_hint_message((i),(v))
#define AB_SW_TITLE_RANK(c,r) ab_sw_title_rank((c),(r))
#define AB_SW_CUSTOMER_PLAYER(v) ab_sw_customer_player(v)
#define AB_SW_CUSTOMER_VALUED(v) ab_sw_customer_valued(v)
#define AB_SW_GREETING(i,o,c,v) ab_sw_greeting((i),(o),(c),(v))
#else
#define AB_SW_HINT_WIN(i,v) (v)
#define AB_SW_HINT_RESULT(n,v) (v)
#define AB_SW_HINT_MESSAGE(i,v) (v)
#define AB_SW_TITLE_RANK(c,r) (r)
#define AB_SW_CUSTOMER_PLAYER(v) (v)
#define AB_SW_CUSTOMER_VALUED(v) (v)
#define AB_SW_GREETING(i,o,c,v) (v)
#endif
#endif
