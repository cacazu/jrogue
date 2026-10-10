/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_SPELL_PREVIEW_H
#define ANGBAND_WEB_SPELL_PREVIEW_H
#ifdef __EMSCRIPTEN__
#include <stddef.h>
#include "web-semantic.h"
/* All values originate in a winning native formatting branch. No dice roll,
 * effect_info call, knowledge query or rendered buffer read is performed. */
void ab_spell_preview_begin(int spell_index,size_t native_capacity);
void ab_spell_preview_special(const char *id,const char *parameter,int value,
 size_t native_capacity);
void ab_spell_preview_leaf(const char *id,const char *first,int first_value,
 const char *second,int second_value);
void ab_spell_preview_label(int effect_index);
void ab_spell_preview_append_special(void);
void ab_spell_preview_finish(void);
void ab_spell_preview_emit(struct ab_semantic_event *event,int spell_index);
void ab_spell_preview_reset(void);
#endif
#endif
