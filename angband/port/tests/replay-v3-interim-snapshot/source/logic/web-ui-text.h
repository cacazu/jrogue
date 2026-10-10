/* SPDX-License-Identifier: GPL-2.0-only */
/* Pure browser UI projections. Native English terminal paths are unchanged. */
#ifndef ANGBAND_WEB_UI_TEXT_H
#define ANGBAND_WEB_UI_TEXT_H
#ifdef __EMSCRIPTEN__
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
struct player_ability;
struct ab_ui_param {
 const char *name;
 const char *type;
 int32_t number;
 const char *text;
 const struct ab_ui_param *nested;
 size_t nested_count;
 const char *const *ids;
 size_t id_count;
};
#define AB_UI_INT(n,v) ((struct ab_ui_param){ .name=(n), .type="integer", .number=(int32_t)(v) })
#define AB_UI_SIGN(n,v) ((struct ab_ui_param){ .name=(n), .type="signed_integer", .number=(int32_t)(v) })
#define AB_UI_DECIMAL(n,v) ((struct ab_ui_param){ .name=(n), .type="decimal_one_place", .number=(int32_t)(v) })
#define AB_UI_REF(n,id) ((struct ab_ui_param){ .name=(n), .type="localized_text", .text=(id) })
#define AB_UI_OPAQUE(n,t,v) ((struct ab_ui_param){ .name=(n), .type=(t), .text=(v) })
#define AB_UI_NESTED(n,id,p,c) ((struct ab_ui_param){ .name=(n), .type="localized_text", .text=(id), .nested=(p), .nested_count=(c) })
#define AB_UI_LIST(n,a,c) ((struct ab_ui_param){ .name=(n), .type="localized_text_list", .ids=(a), .id_count=(c) })
void ab_ui_emit(const char *context,const char *widget,const char *id,const struct ab_ui_param *params,size_t count);
void ab_ui_static(const char *context,const char *widget,const char *id);
void ab_ui_scope_begin(const char *context,bool replace);
void ab_ui_scope_end(void);
/* Flush a batch before input without leaving the logical live-update context. */
void ab_ui_scope_commit(void);
void ab_ui_reset(const char *context);
void ab_ui_clear(const char *widget);
bool ab_ui_in(const char *context);
void ab_ui_number(const char *widget,int32_t value);
void ab_ui_scalar(const char *widget,int32_t value,bool force_sign);
const char *ab_ui_race_id(int index);
const char *ab_ui_class_id(int index);
const char *ab_ui_title_id(int class_index,int rank);
const char *ab_ui_shape_id(int index);
const char *ab_ui_realm_id(const char *canonical_key);
const char *ab_ui_terrain_id(const char *canonical_code);
const char *ab_ui_trap_id(const char *canonical_desc);
const char *ab_ui_timed_id(int effect,int grade);
const char *ab_ui_option_id(int option);
const char *ab_ui_stat_id(int stat,bool drained,bool compact);
void ab_ui_stat_value(const char *widget,int value);
void ab_ui_ability(const char *widget,const struct player_ability *ability);
void ab_ui_sidebar_stat(int stat,int value,bool drained,bool compact);
void ab_ui_sidebar_level(int level,bool drained,bool compact);
void ab_ui_sidebar_experience(int32_t xp,bool current,bool drained,bool compact);
void ab_ui_sidebar_resource(bool spell,int current,int maximum,bool compact);
void ab_ui_sidebar_hide(int slot);
void ab_ui_sidebar_mode(bool compact);
bool ab_ui_sidebar_compact(void);
/* Owned source references are consumed once by exact original prompt address. */
const char *ab_ui_check_source(const char *id,const char *native_prompt);
const char *ab_ui_check_parameters(const char *id,const struct ab_ui_param *params,size_t count,const char *native_prompt);
void ab_ui_check_object_prepare(const char *id,const char *native_buffer);
void ab_ui_check_object_capture(const char *native_buffer);
const char *ab_ui_check_object_select(const char *id,const char *native_token);
const char *ab_ui_check_prompt(const char *native_prompt);
void ab_ui_check_verify_command(int command,const char *native_verb,const char *native_prompt);
void ab_ui_check_verify_source(const char *id,const char *native_prompt);
void ab_ui_check_verify_object(const char *native_prompt,const char *native_buffer);
void ab_ui_check_price(int32_t price);
void ab_ui_check_begin(const char *native_prompt,bool store_policy);
void ab_ui_check_end(void);
void ab_ui_check_discard(void);
void ab_ui_input(const char *widget,const char *text,const char *type);
void ab_ui_leave_birth(void);
void ab_ui_history_edited(void);
void ab_ui_history_reset(void);
void ab_ui_history(const char *widget,const char *text);
#endif
#ifdef __EMSCRIPTEN__
#define AB_CHECK_SOURCE(i,p) ab_ui_check_source((i),(p))
#define AB_CHECK_PARAMS(i,a,n,p) ab_ui_check_parameters((i),(a),(n),(p))
#define AB_CHECK_PROMPT(p) ab_ui_check_prompt(p)
#define AB_CHECK_VERIFY(i,p,call) (ab_ui_check_verify_source((i),(p)),(call))
#define AB_CHECK_VERIFY_COMMAND(c,v,p,call) (ab_ui_check_verify_command((c),(v),(p)),(call))
#define AB_CHECK_PRICE(v,call) (ab_ui_check_price(v),(call))
#define AB_CHECK_OBJECT_SELECT(i,t) ab_ui_check_object_select((i),(t))
#else
#define AB_CHECK_SOURCE(i,p) (p)
#define AB_CHECK_PARAMS(i,a,n,p) (p)
#define AB_CHECK_PROMPT(p) (p)
#define AB_CHECK_VERIFY(i,p,call) (call)
#define AB_CHECK_VERIFY_COMMAND(c,v,p,call) (call)
#define AB_CHECK_PRICE(v,call) (call)
#define AB_CHECK_OBJECT_SELECT(i,t) (t)
#endif
#endif
