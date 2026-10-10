/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_KNOWLEDGE_TEXT_H
#define ANGBAND_WEB_KNOWLEDGE_TEXT_H
#ifdef __EMSCRIPTEN__
#include <stddef.h>
#include <stdbool.h>
#include "web-ui-text.h"
struct monster_race;
struct player_ability;
struct ab_semantic_event;
enum ab_knowledge_property_field { AB_KNOWLEDGE_NAME, AB_KNOWLEDGE_DESCRIPTION,
 AB_KNOWLEDGE_NOTICE, AB_KNOWLEDGE_ADJECTIVE, AB_KNOWLEDGE_NEGATIVE };
const char *ab_knowledge_monster_description_id(const struct monster_race *race);
const char *ab_knowledge_property_id(int type,int index,enum ab_knowledge_property_field field);
const char *ab_knowledge_slay_id(int index,int role);
const char *ab_knowledge_brand_id(int index,bool verb);
void ab_knowledge_emit_ability(const char *context,const char *widget,const struct player_ability *ability);
void ab_knowledge_info_ability(const struct player_ability *ability);
/* Actual private rune_list selection, captured inside the two native getters. */
void ab_knowledge_rune_capture(size_t oid,int variety,int index,bool description);
void ab_knowledge_emit_last_rune(const char *context,const char *widget,size_t oid,bool description);
void ab_knowledge_info_last_rune(size_t oid,bool description);
void ab_knowledge_param_last_rune(struct ab_semantic_event *event,const char *parameter,size_t oid,bool description);
const char *ab_knowledge_element_id(int index);
/* A bounded source-selected lexical list, emitted once as a balanced ref tree. */
void ab_knowledge_list_begin(void);
void ab_knowledge_list_role(const char *role);
void ab_knowledge_list_add(const char *id);
void ab_knowledge_list_powerful(void);
void ab_knowledge_list_weak(void);
void ab_knowledge_list_emit(const char *role);
void ab_knowledge_info_modifier(int index,int amount,bool exact);
void ab_knowledge_info_property(int type,int index);
/* Source-selected shape lists are local to one original native function. */
#define AB_KNOWLEDGE_SHAPE_LIST_MAX 64U
struct ab_knowledge_shape_item {
 const char *id,*slot,*lexeme;
 int amount;
 bool numeric;
};
struct ab_knowledge_shape_list {
 struct ab_knowledge_shape_item items[AB_KNOWLEDGE_SHAPE_LIST_MAX];
 size_t count;
 bool invalid;
};
void ab_knowledge_shape_list_add(struct ab_knowledge_shape_list *list,const char *id);
int ab_knowledge_shape_number(struct ab_knowledge_shape_list *list,const char *id,const char *slot,const char *lexeme,int native_value);
void ab_knowledge_shape_list_emit(struct ab_knowledge_shape_list *list,const char *id);
const char *ab_knowledge_shape_skill_id(int skill);
void ab_knowledge_shape_spell(unsigned int cidx,int bidx,int book_spell_index);
void ab_knowledge_lore_begin(void);
void ab_knowledge_lore_commit(void);
void ab_knowledge_lore_end(void);
void ab_knowledge_lore_emit(const char *id,const struct ab_ui_param *params,size_t count);
void ab_knowledge_section_begin(const char *section);
void ab_knowledge_section_end(void);
void ab_knowledge_object_section_begin(const char *section);
void ab_knowledge_object_statement_begin(const char *id);
void ab_knowledge_object_statement_end(void);
void ab_knowledge_object_target_select(const char *id);
void ab_knowledge_object_target_commit(void);
const char *ab_knowledge_object_target_id(void);
const char *ab_knowledge_digging_terrain_id(int index);
void ab_knowledge_origin_place(bool dungeon);
int ab_knowledge_origin_number(bool level,int value);
void ab_knowledge_origin_race(const char *id);
bool ab_knowledge_origin_article(bool vowel);
const char *ab_knowledge_capture_origin(const char *parameter,int origin,int args,bool unique,bool comma,const char *native_format);

void ab_knowledge_section_caller(const char *caller);
bool ab_knowledge_caller_is_alternative(void);
bool ab_knowledge_caller_has_end(void);
void ab_knowledge_part_begin(const char *section,const char *role,const char *id);
void ab_knowledge_part_end(void);
void ab_knowledge_part_param(const struct ab_ui_param *param);
const char *ab_knowledge_capture_text(const char *name,const char *id,const char *native_text);
int ab_knowledge_capture_integer(const char *name,int native_value);
int ab_knowledge_capture_color(int native_color);
const char *ab_knowledge_capture_combat(const char *name,const char *native_text);
const char *ab_knowledge_pronoun_id(int sex,bool possessive,bool title_case);
const char *ab_knowledge_race_flag_id(int flag);
void ab_knowledge_selected_lexeme(const char *id);
const char *ab_knowledge_last_lexeme(void);
const char *ab_knowledge_select_lexeme(const char *id,const char *native_text);
const char *ab_knowledge_capture_selected(const char *name,const char *native_text);
void ab_knowledge_prepare_number(const char *id,int whole,int fraction,const char *fraction_slot);
void ab_knowledge_prepare_start(const char *id,int sex,bool subject);
const char *ab_knowledge_capture_prepared(const char *name,bool start,const char *native_text);
void ab_knowledge_morphology_select(bool article,const char *id);
const char *ab_knowledge_morphology_id(bool article);
#endif
#ifdef __EMSCRIPTEN__
#define AB_KNOWLEDGE_CAPTURE(call) (call)
#define AB_KNOWLEDGE_TEXT(n,i,v) ab_knowledge_capture_text((n),(i),(v))
#define AB_KNOWLEDGE_INT(n,v) ab_knowledge_capture_integer((n),(v))
#define AB_KNOWLEDGE_COLOR(v) ab_knowledge_capture_color((v))
#define AB_KNOWLEDGE_COMBAT(n,v) ab_knowledge_capture_combat((n),(v))
#define AB_KNOWLEDGE_SELECTED(n,v) ab_knowledge_capture_selected((n),(v))
#define AB_KNOWLEDGE_PREPARED(n,s,v) ab_knowledge_capture_prepared((n),(s),(v))
#define AB_KNOWLEDGE_SELECT(i,v) ab_knowledge_select_lexeme((i),(v))
#define AB_KNOWLEDGE_ORIGIN_INT(l,v) ab_knowledge_origin_number((l),(v))
#define AB_KNOWLEDGE_ORIGIN_ARTICLE(v) ab_knowledge_origin_article(v)
#define AB_KNOWLEDGE_ORIGIN(n,o,a,u,c,v) ab_knowledge_capture_origin((n),(o),(a),(u),(c),(v))
#define AB_KNOWLEDGE_SHAPE_NUMBER(l,i,s,r,v) ab_knowledge_shape_number((l),(i),(s),(r),(v))
#else
#define AB_KNOWLEDGE_CAPTURE(call) ((void)0)
#define AB_KNOWLEDGE_TEXT(n,i,v) (v)
#define AB_KNOWLEDGE_INT(n,v) (v)
#define AB_KNOWLEDGE_COLOR(v) (v)
#define AB_KNOWLEDGE_COMBAT(n,v) (v)
#define AB_KNOWLEDGE_SELECTED(n,v) (v)
#define AB_KNOWLEDGE_PREPARED(n,s,v) (v)
#define AB_KNOWLEDGE_SELECT(i,v) (v)
#define AB_KNOWLEDGE_ORIGIN_INT(l,v) (v)
#define AB_KNOWLEDGE_ORIGIN_ARTICLE(v) (v)
#define AB_KNOWLEDGE_ORIGIN(n,o,a,u,c,v) (v)
#define AB_KNOWLEDGE_SHAPE_NUMBER(l,i,s,r,v) (v)
#endif
#endif
