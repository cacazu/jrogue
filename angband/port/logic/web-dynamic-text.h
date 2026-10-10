/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_DYNAMIC_TEXT_H
#define ANGBAND_WEB_DYNAMIC_TEXT_H
#ifdef __EMSCRIPTEN__
#include <stdarg.h>
/* Source-authored schema consumes exactly the unchanged printf arguments. */
void ab_dynamic_message_capture(const char *id,const char *schema,int sound,va_list arguments);
void ab_dynamic_msg(const char *id,const char *schema,const char *format,...);
void ab_dynamic_msgt(const char *id,const char *schema,unsigned int type,const char *format,...);
#endif
#endif
