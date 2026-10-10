/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_UI_RESIDUAL_TEXT_H
#define ANGBAND_WEB_UI_RESIDUAL_TEXT_H
#ifdef __EMSCRIPTEN__
#include "web-ui-text.h"
#include "web-naming.h"
struct ab_semantic_event;
struct monster_race;
struct trap_kind;
struct ab_ur_quantity_call { char *reference; int maximum,initial; bool active; };
struct ab_ur_store_quantity { int operation,owned; bool has_owned; };
void ab_ur_quantity_capture(struct ab_ur_quantity_call *call,const char *prompt,int maximum,int initial);
void ab_ur_quantity_begin(struct ab_ur_quantity_call *call);
bool ab_ur_quantity_result(struct ab_ur_quantity_call *call,bool result);
int ab_ur_quantity_return(struct ab_ur_quantity_call *call,int result);
void ab_ur_quantity_editor(const char *text,size_t limit);
const char *ab_ur_quantity_word(struct ab_ur_store_quantity *facts,int operation,const char *word);
const char *ab_ur_quantity_owned(struct ab_ur_store_quantity *facts,bool has_owned,int owned,const char *fragment);
void ab_ur_quantity_store(const struct ab_ur_store_quantity *facts,int maximum,const char *prompt);
const char *ab_ur_choice_source(int kind,const char *id,const char *prompt);
void ab_ur_choice_command(int command,const char *prompt);
void ab_ur_choice_begin(const char *prompt,const char *options,size_t len,char fallback);
void ab_ur_choice_end(void);
void ab_ur_message(const char *id,int sound,const struct ab_ui_param *params,size_t count);
void ab_ur_message_object(const char *id,int sound,const char *parameter,
 const struct ab_naming_snapshot *object,const struct ab_ui_param *params,size_t count);
const char *ab_ur_source(const char *id,const char *native_source);
void ab_ur_message_source(const char *native_source,int sound);
void ab_ur_generation(const char *native_error);
const char *ab_ur_parser_error(int error);
const char *ab_ur_tval_name(int tval);
const char *ab_ur_trap_name(const struct trap_kind *kind);
void ab_ur_object_capture(struct ab_naming_snapshot *owned,const char *native_buffer);
void ab_ur_title_begin(struct ab_naming_snapshot *object,const char *native_title);
void ab_ur_title_end(void);
int ab_ur_title_result(int native_result);
void ab_ur_title_message(const char *native_title);
void ab_ur_property_begin(const struct ab_naming_snapshot *object,const char *native_name);
void ab_ur_property_end(void);
void ab_ur_property_message(int flag,const char *native_name);
void ab_ur_note_prepare(int branch,const char *name,const char *text);
void ab_ur_note_message(void);
void ab_ur_preferences_begin(const char *category_id);
void ab_ur_preferences_end(void);
void ab_ur_preferences_message(bool saved);
const char *ab_ur_rune_name(size_t oid,const char *native_name);
#define AB_UR_QUANTITY_RESULT(o,call) ab_ur_quantity_result((o),(call))
#define AB_UR_QUANTITY_RETURN(o,v) ab_ur_quantity_return((o),(v))
#define AB_UR_QUANTITY_WORD(o,k,v) ab_ur_quantity_word((o),(k),(v))
#define AB_UR_QUANTITY_OWNED(o,h,n,v) ab_ur_quantity_owned((o),(h),(n),(v))
#define AB_UR_CHOICE_SOURCE(k,i,v) ab_ur_choice_source((k),(i),(v))
#define AB_UR_CHOICE_COMMAND(c,p,call) (ab_ur_choice_command((c),(p)),(call))
#define AB_UR_BEFORE(effect,call) ((effect),(call))
#define AB_UR_SOURCE(i,v) ab_ur_source((i),(v))
#define AB_UR_TITLE(o,t,call) (ab_ur_title_begin((o),(t)),ab_ur_title_result(call))
#define AB_UR_PROPERTY(o,n,call) (ab_ur_property_begin((o),(n)),(call),ab_ur_property_end())
#define AB_UR_NOTE(b,n,t,call) (ab_ur_note_prepare((b),(n),(t)),(call))
#define AB_UR_PREF(i,call) (ab_ur_preferences_begin((i)),(call),ab_ur_preferences_end())
#define AB_UR_RUNE(i,call) ab_ur_rune_name((i),(call))
#define AB_UR_RETURN(o,call) do {ab_naming_snapshot_release(o);call} while(0)
#else
#define AB_UR_QUANTITY_RESULT(o,call) (call)
#define AB_UR_QUANTITY_RETURN(o,v) (v)
#define AB_UR_QUANTITY_WORD(o,k,v) (v)
#define AB_UR_QUANTITY_OWNED(o,h,n,v) (v)
#define AB_UR_CHOICE_SOURCE(k,i,v) (v)
#define AB_UR_CHOICE_COMMAND(c,p,call) (call)
#define AB_UR_BEFORE(effect,call) (call)
#define AB_UR_SOURCE(i,v) (v)
#define AB_UR_TITLE(o,t,call) (call)
#define AB_UR_PROPERTY(o,n,call) (call)
#define AB_UR_NOTE(b,n,t,call) (call)
#define AB_UR_PREF(i,call) (call)
#define AB_UR_RUNE(i,call) (call)
#define AB_UR_RETURN(o,call) call
#endif
#endif
