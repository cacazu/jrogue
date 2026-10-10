/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_NAMING_H
#define ANGBAND_WEB_NAMING_H
#include "angband.h"
#ifdef __EMSCRIPTEN__
#include "web-semantic.h"
struct object;
struct object_kind;
struct artifact;
struct ego_item;
struct chest_trap;
struct monster;
struct monster_race;
#define AB_NAMING_CAPTURE(expression) (expression)
#define AB_NAMING_OBJECT_FINISH(value) ab_naming_object_finish(value)
#define AB_NAMING_MONEY_IGNORE(value) ab_naming_money_ignore(value)
#define AB_NAMING_NUMBER(kind, value) ab_naming_number_result(kind, value)
#define AB_NAMING_MON_ARTICLE(value) ab_naming_monster_article(value)
#define AB_NAMING_SNAPSHOT_MAX_BYTES (128U * 1024U)
#define AB_NAMING_MONSTER_SNAPSHOT_BYTES 4096U
#define AB_NAMING_CACHE_ENTRIES 64U
#define AB_NAMING_CACHE_MAX_BYTES (1024U * 1024U)
struct ab_naming_snapshot { char *json; uint32_t length; };
struct ab_naming_session {
 struct ab_semantic_event value;
 struct ab_naming_session *previous;
 uintptr_t buffer_address, subject_address;
 uint32_t mode;
 size_t native_max_bytes;
 unsigned part_count, inscription_count;
 bool object, capital, complete, modifier_used, inscriptions_open;
 const char *base_id, *reason;
 const struct object_kind *modifier_kind;
 const char *modifier_text;
 int32_t money_amount;
 const struct object_kind *money_kind;
};
/* Native calls own their original output exactly once. Hooks copy facts only. */
void ab_naming_object_kind_begin(struct ab_naming_session *s,char *buffer,size_t max,const struct object_kind *kind);
void ab_naming_object_base_begin(struct ab_naming_session *s,char *buffer,size_t max);
void ab_naming_object_base_name(int tval,bool plural);
void ab_naming_object_flavor(const struct object_kind *kind);
void ab_naming_object_begin(struct ab_naming_session *s,char *buffer,size_t max,uint32_t mode,const struct object *obj);
size_t ab_naming_object_finish(size_t native_result);
void ab_naming_monster_begin(struct ab_naming_session *s,char *buffer,size_t max,uint32_t mode,const struct monster *mon);
void ab_naming_monster_list_begin(struct ab_naming_session *s,char *buffer,size_t max,const struct monster_race *race);
void ab_naming_monster_finish(void);
void ab_naming_literal(const char *role);
void ab_naming_literal_buffer(char *buffer,size_t max,const char *role);
const char *ab_naming_monster_name_id(const struct monster_race *race);
const char *ab_naming_ego_name_id(const struct ego_item *ego);
void ab_naming_money_prepare(int32_t amount,const struct object_kind *kind);
bool ab_naming_money_ignore(bool ignored);
void ab_naming_select_kind_base(const struct object_kind *kind);
void ab_naming_select_base(const char *role);
void ab_naming_object_base(const struct object_kind *kind,const char *modifier,bool plural);
void ab_naming_object_prefix(const char *form,int32_t number);
void ab_naming_artifact_suffix(const struct artifact *artifact);
void ab_naming_ego_suffix(const struct ego_item *ego);
void ab_naming_kind_suffix(const char *form,const struct object_kind *kind);
void ab_naming_chest_state(const char *role);
void ab_naming_chest_record(const struct chest_trap *trap);
void ab_naming_number(const char *kind,int32_t value);
int32_t ab_naming_number_result(const char *kind,int32_t value);
void ab_naming_dice(int32_t dice,int32_t sides);
void ab_naming_bonus_pair(int32_t hit,int32_t damage);
void ab_naming_bonus_single(const char *form,int32_t value);
void ab_naming_armor(const char *form,int32_t base,int32_t bonus);
void ab_naming_modifiers(const int *values,size_t count);
void ab_naming_charging(void);
void ab_naming_inscription_user(const char *text);
void ab_naming_inscription_tag(const char *role);
void ab_naming_inscriptions_finish(void);
void ab_naming_store_annotation(const char *role);
void ab_naming_monster_pronoun(int32_t code);
void ab_naming_monster_reflexive(const char *gender);
void ab_naming_monster_prefix(const char *form);
bool ab_naming_monster_article(bool an);
void ab_naming_monster_race(const struct monster_race *race,bool strip_appositive,const char *plural_form);
void ab_naming_monster_marker(const char *kind);
void ab_naming_monster_capital(void);
void ab_naming_monster_list_prefix(bool unique,int32_t number);
/* Balanced token: false at saturation must not release an outer scope. */
bool ab_naming_notice_suppress_begin(void);
void ab_naming_notice_suppress_end(bool acquired);
/* Copy immediately after native output; neither API reads the output text. */
bool ab_naming_copy_object_snapshot(struct ab_naming_snapshot *out,const char *native_buffer);
bool ab_naming_copy_monster_snapshot(struct ab_naming_snapshot *out,const char *native_buffer);
/* Internal command handoff only: the same path must just have executed its
 * original descriptor with this subject and exact mode. Never use as a live
 * entity lookup, after deletion, or across commands/address reuse. */
bool ab_naming_copy_object_subject_snapshot(struct ab_naming_snapshot *out,const struct object *object,uint32_t mode);
bool ab_naming_copy_monster_subject_snapshot(struct ab_naming_snapshot *out,const struct monster *monster,uint32_t mode);
void ab_naming_snapshot_release(struct ab_naming_snapshot *snapshot);
void ab_naming_param_snapshot(struct ab_semantic_event *event,const char *name,const char *type,const struct ab_naming_snapshot *snapshot);
/* Writes the currently open typed value; false emits an explicit missing value. */
bool ab_naming_copy_json_for_buffer(struct ab_semantic_event *event,const char *native_buffer,const char *kind);
void ab_naming_invalidate_buffer(const char *native_buffer);
#else
#define AB_NAMING_CAPTURE(expression) ((void)0)
#define AB_NAMING_OBJECT_FINISH(value) (value)
#define AB_NAMING_MONEY_IGNORE(value) (value)
#define AB_NAMING_NUMBER(kind, value) (value)
#define AB_NAMING_MON_ARTICLE(value) (value)
#endif
#endif
