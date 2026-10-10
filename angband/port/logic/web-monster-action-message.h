/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_MONSTER_ACTION_MESSAGE_H
#define ANGBAND_WEB_MONSTER_ACTION_MESSAGE_H
#include "angband.h"
#ifdef __EMSCRIPTEN__
#include "web-naming.h"
enum ab_mon_action_note { AB_MON_ACTION_DIES, AB_MON_ACTION_DESTROYED, AB_MON_ACTION_DEFEATED,
 AB_MON_ACTION_DESTROYED_EXCLAIM, AB_MON_ACTION_DIES_EXCLAIM,
 AB_MON_ACTION_DIES_DAMAGE_EXCLAIM, AB_MON_ACTION_DRAINED_DRY };
struct ab_mon_action_actor { struct ab_naming_snapshot snapshot; };
void ab_mon_action_actor_capture(struct ab_mon_action_actor *out,const char *original_buffer);
void ab_mon_action_actor_release(struct ab_mon_action_actor *out);
void ab_mon_action_push(const struct ab_mon_action_actor *actor,const struct ab_mon_action_actor *target,bool kill);
void ab_mon_action_shape(const char *actor);
bool ab_mon_action_note_destroyed(enum ab_mon_action_note *selected,bool native_value);
void ab_mon_action_note_begin(const char *note,enum ab_mon_action_note selected);
void ab_mon_action_note_end(void);
const char *ab_mon_action_note_literal(enum ab_mon_action_note selected,const char *note);
const char *ab_mon_action_curse_note(bool displayed,int damage,const char *note);
const char *ab_mon_action_arena_note(const char *note);
void ab_mon_action_arena_end(void);
void ab_mon_action_death(const struct ab_mon_action_actor *actor,const char *note,int sound);
void ab_mon_action_failed_steal(const char *actor,const char *object,bool split);
int ab_mon_action_stolen_label(const char *object,bool split,int native_label);
void ab_mon_action_verb_init(const char *native_buffer);
void ab_mon_action_verb_melee_init(const char *native_buffer,bool armed);
void ab_mon_action_verb_shape(const char *native_buffer,int shape_index,int original_choice);
int ab_mon_action_shape_choice(int *captured,int native_choice);
const char *ab_mon_action_damage_visible(bool *captured,const char *native_text);
void ab_mon_action_melee(const struct ab_mon_action_actor *target,const char *verb,
 int quality,bool show_damage,int damage,int sound);
void ab_mon_action_verb_brand(const char *native_buffer,int index,bool range);
void ab_mon_action_verb_slay(const char *native_buffer,int index,bool range);
void ab_mon_action_verb_transfer(const char *destination,const char *source);
void ab_mon_action_verb_fails(const char *native_buffer);
void ab_mon_action_verb_forget(const char *native_buffer);
void ab_mon_action_ranged(const char *object,const char *verb,const char *target,
 int quality,bool show_damage,int damage,int sound);
#define AB_MON_ACTION_LABEL(o,s,v) ab_mon_action_stolen_label((o),(s),(v))
#define AB_MON_ACTION_DESTROYED_VALUE(p,v) ab_mon_action_note_destroyed((p),(v))
#define AB_MON_ACTION_ARENA_NOTE(v) ab_mon_action_arena_note(v)
#define AB_MON_ACTION_LITERAL_NOTE(r,v) ab_mon_action_note_literal((r),(v))
#define AB_MON_ACTION_CURSE_NOTE(s,d,v) ab_mon_action_curse_note((s),(d),(v))
#define AB_MON_ACTION_PUSH(a,t,k) ab_mon_action_push((a),(t),(k))
#define AB_MON_ACTION_SHAPE(a) ab_mon_action_shape(a)
#define AB_MON_ACTION_DEATH(a,n,s) ab_mon_action_death((a),(n),(s))
#define AB_MON_ACTION_FAILED_STEAL(a,o,s) ab_mon_action_failed_steal((a),(o),(s))
#define AB_MON_ACTION_RANGED(o,v,t,q,s,d,n) ab_mon_action_ranged((o),(v),(t),(q),(s),(d),(n))
#define AB_MON_ACTION_MELEE(t,v,q,s,d,n) ab_mon_action_melee((t),(v),(q),(s),(d),(n))
#define AB_MON_ACTION_CHOICE(p,v) ab_mon_action_shape_choice((p),(v))
#define AB_MON_ACTION_DAMAGE(p,v) ab_mon_action_damage_visible((p),(v))
#else
#define AB_MON_ACTION_LABEL(o,s,v) (v)
#define AB_MON_ACTION_DESTROYED_VALUE(p,v) (v)
#define AB_MON_ACTION_ARENA_NOTE(v) (v)
#define AB_MON_ACTION_LITERAL_NOTE(r,v) (v)
#define AB_MON_ACTION_CURSE_NOTE(s,d,v) (v)
#define AB_MON_ACTION_PUSH(a,t,k) ((void)0)
#define AB_MON_ACTION_SHAPE(a) ((void)0)
#define AB_MON_ACTION_DEATH(a,n,s) ((void)0)
#define AB_MON_ACTION_FAILED_STEAL(a,o,s) ((void)0)
#define AB_MON_ACTION_RANGED(o,v,t,q,s,d,n) ((void)0)
#define AB_MON_ACTION_MELEE(t,v,q,s,d,n) ((void)0)
#define AB_MON_ACTION_CHOICE(p,v) (v)
#define AB_MON_ACTION_DAMAGE(p,v) (v)
#endif
#endif
