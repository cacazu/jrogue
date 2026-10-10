/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_OBJECT_MESSAGES_H
#define ANGBAND_WEB_OBJECT_MESSAGES_H
#ifdef __EMSCRIPTEN__
#include "web-naming.h"
#include "web-ui-text.h"
void ab_object_snapshot(struct ab_naming_snapshot *owned,const char *native_buffer);
void ab_object_message(const char *id,int sound,struct ab_naming_snapshot *owned,
 const struct ab_ui_param *params,size_t count);
const char *ab_object_word(const char *id,const char *native_word);
const char *ab_object_word_id(const char *native_word,bool capital);
void ab_object_relation_capture(int body,int slot,int type,bool heavy,bool named);
struct ab_ui_param ab_object_relation_parameter(void);
uint32_t ab_object_message_status(void);
#define AB_OBJECT_WORD(id,word) ab_object_word((id),(word))
#define AB_OBJECT_CAPTURE(expression) (expression)
#else
#define AB_OBJECT_WORD(id,word) (word)
#define AB_OBJECT_CAPTURE(expression) ((void)0)
#endif
#endif
