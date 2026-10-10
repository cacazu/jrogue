/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_EFFECT_DESCRIPTION_H
#define ANGBAND_WEB_EFFECT_DESCRIPTION_H
#ifdef __EMSCRIPTEN__
#include <stddef.h>
#include <stdbool.h>
#include "web-semantic.h"
struct ab_effect_graph { struct ab_semantic_event json; unsigned count; bool open; };
enum ab_effect_lexical_family { AB_EFFECT_PROJECTION_DESC,AB_EFFECT_PROJECTION_PLAYER,
 AB_EFFECT_PROJECTION_LASH,AB_EFFECT_TIMED,AB_EFFECT_STAT,AB_EFFECT_SUMMON };
void ab_effect_graph_begin(struct ab_effect_graph *graph);
void ab_effect_graph_ref(struct ab_effect_graph *graph,const char *id);
void ab_effect_graph_prefix(struct ab_effect_graph *graph,const char *native_prefix);
void ab_effect_graph_buffer(struct ab_effect_graph *graph,const char *native_buffer);
void ab_effect_graph_child(struct ab_effect_graph *graph,const void *native_textblock);
void ab_effect_graph_result(struct ab_effect_graph *graph,const void *native_textblock);
const char *ab_effect_prefix(const char *id,const char *native_prefix);
const char *ab_effect_random_prefix(const char *native_prefix);
const char *ab_effect_safe_dice_format(int effect_index,const char *native_format);
const char *ab_effect_description_id(int effect_index,bool menu);
void ab_effect_buffer_begin(const char *buffer,size_t capacity,const char *id);
void ab_effect_buffer_append(const char *buffer,const char *id);
void ab_effect_buffer_end_ref(const char *buffer);
void ab_effect_buffer_list_begin(const char *buffer,size_t capacity);
void ab_effect_buffer_list_ref(const char *buffer,const char *id);
const char *ab_effect_list_literal(const char *buffer,const char *id,const char *native_value);
void ab_effect_buffer_list_lexeme(const char *buffer,enum ab_effect_lexical_family family,int index);
int ab_effect_integer(const char *buffer,const char *name,int native_value);
const char *ab_effect_lexeme(const char *buffer,const char *name,
 enum ab_effect_lexical_family family,int index,const char *native_value);
const char *ab_effect_graph_lexeme(const char *buffer,const char *name,
 enum ab_effect_lexical_family family,int index,const char *native_value);
const char *ab_effect_reference(const char *buffer,const char *name,const char *id,const char *native_value);
const char *ab_effect_selected(const char *buffer,const char *name,const char *native_value);
const char *ab_effect_nested_buffer(const char *buffer,const char *name,const char *native_value);
void ab_effect_emit_result(const void *native_textblock);
void ab_effect_emit_menu(const char *native_buffer,unsigned row);
void ab_effect_menu_begin(void);
void ab_effect_menu_random(unsigned row);
void ab_effect_menu_prompt(const char *native_prompt);
void ab_effect_menu_end(void);
#define AB_EFFECT_CAPTURE(expr) (expr)
#define AB_EFFECT_INT(b,n,v) ab_effect_integer((b),(n),(v))
#define AB_EFFECT_LEX(b,n,f,i,v) ab_effect_lexeme((b),(n),(f),(i),(v))
#define AB_EFFECT_GRAPH_LEX(b,n,f,i,v) ab_effect_graph_lexeme((b),(n),(f),(i),(v))
#define AB_EFFECT_LIST(b,i,v) ab_effect_list_literal((b),(i),(v))
#define AB_EFFECT_REF(b,n,i,v) ab_effect_reference((b),(n),(i),(v))
#define AB_EFFECT_SELECTED(b,n,v) ab_effect_selected((b),(n),(v))
#define AB_EFFECT_BUFFER(b,n,v) ab_effect_nested_buffer((b),(n),(v))
#define AB_EFFECT_PREFIX(i,v) ab_effect_prefix((i),(v))
#define AB_EFFECT_RANDOM_PREFIX(v) ab_effect_random_prefix(v)
#define AB_EFFECT_DICE_FORMAT(i,v) ab_effect_safe_dice_format((i),(v))
#else
#define AB_EFFECT_CAPTURE(expr) ((void)0)
#define AB_EFFECT_INT(b,n,v) (v)
#define AB_EFFECT_LEX(b,n,f,i,v) (v)
#define AB_EFFECT_GRAPH_LEX(b,n,f,i,v) (v)
#define AB_EFFECT_LIST(b,i,v) (v)
#define AB_EFFECT_REF(b,n,i,v) (v)
#define AB_EFFECT_SELECTED(b,n,v) (v)
#define AB_EFFECT_BUFFER(b,n,v) (v)
#define AB_EFFECT_PREFIX(i,v) (v)
#define AB_EFFECT_RANDOM_PREFIX(v) (v)
#define AB_EFFECT_DICE_FORMAT(i,v) (v)
#endif
#endif
