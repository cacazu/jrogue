/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_CHARACTER_MATRIX_H
#define ANGBAND_WEB_CHARACTER_MATRIX_H
#ifdef __EMSCRIPTEN__
#include "web-ui-text.h"
#include <stdbool.h>
#include <stddef.h>
struct ui_entry;
const char *ab_ui_entry_source_name(const struct ui_entry *entry);
enum ab_character_matrix_backend { AB_MATRIX_RESIST, AB_MATRIX_FLAG, AB_MATRIX_SIGNED, AB_MATRIX_SUSTAIN };
void ab_character_matrix_begin(void);
void ab_character_matrix_end(void);
void ab_character_matrix_region(int region);
void ab_character_matrix_row_begin(const struct ui_entry *entry,int row,bool known_rune,int equipment_slots);
void ab_character_matrix_row_end(void);
void ab_character_matrix_selected(enum ab_character_matrix_backend backend,int index,int palette_index,int color,int x,int y,int width);
bool ab_character_export_active(void);
bool ab_character_export_valid(void);
void ab_character_export_reject(void);
void ab_character_export_observe_ui(const char *context,const char *widget,const char *id,const struct ab_ui_param *params,size_t count,bool control);
void ab_character_export_begin(const char *build);
void ab_character_export_end(void);
bool ab_character_export_widget(char *out,size_t size);
void ab_character_export_emit(const char *id,const struct ab_ui_param *params,size_t count);
void ab_character_export_heading(const char *role);
void ab_character_export_object(char slot,const char *native_buffer);
int ab_character_export_slot(const char *native_buffer,int selected_slot);
void ab_character_export_option(int option,bool value,const char *canonical_key);
void ab_character_export_death(bool retired);
bool ab_character_export_retired(bool retired);
const char *ab_character_export_option_key(int option,bool value,const char *key);
void ab_character_export_message(int age);
#define AB_CHARACTER_EXPORT_SLOT(b,v) ab_character_export_slot((b),(v))
#define AB_CHARACTER_EXPORT_RETIRED(v) ab_character_export_retired(v)
#define AB_CHARACTER_EXPORT_OPTION_KEY(o,v,k) ab_character_export_option_key((o),(v),(k))
#else
#define AB_CHARACTER_EXPORT_SLOT(b,v) (v)
#define AB_CHARACTER_EXPORT_RETIRED(v) (v)
#define AB_CHARACTER_EXPORT_OPTION_KEY(o,v,k) (k)
#endif
#endif
