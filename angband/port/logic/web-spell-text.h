/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_SPELL_TEXT_H
#define ANGBAND_WEB_SPELL_TEXT_H
#ifdef __EMSCRIPTEN__
#include <stdbool.h>
struct player;
struct class_spell;
enum ab_spell_row_state {
 AB_SPELL_ILLEGIBLE, AB_SPELL_FORGOTTEN, AB_SPELL_WORKED,
 AB_SPELL_UNTRIED, AB_SPELL_UNKNOWN, AB_SPELL_DIFFICULT
};
void ab_spell_menu_begin(const struct player *p, int first_spell_index);
void ab_spell_menu_end(void);
void ab_spell_row(const struct player *p, const struct class_spell *spell,
 char key, int color, int fail, enum ab_spell_row_state state);
void ab_spell_description(const struct player *p,
 const struct class_spell *spell, bool visible);
/* The original caller already selected this spell; no spell_by_index call. */
const char *ab_spell_name_id(const struct player *p,const struct class_spell *spell);
#endif
#endif
