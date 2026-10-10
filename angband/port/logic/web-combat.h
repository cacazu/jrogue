/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_COMBAT_H
#define ANGBAND_WEB_COMBAT_H
#include "angband.h"
#ifdef __EMSCRIPTEN__
#include "web-semantic.h"
#include "web-naming.h"
struct monster_race;
struct ab_combat_reaction {
 struct ab_combat_reaction *previous;
 const char *kind, *name_id, *plural_form, *body_id, *format;
 int count, sound;
 bool offscreen, unique, comma;
};
struct ab_combat_template {
 struct ab_semantic_event value;
 unsigned int name_count, pronoun_count, target_count, type_count, oftype_count;
 unsigned int oftarget_count, has_count;
 bool nested;
};
struct ab_combat_blow {
 struct ab_combat_blow *previous;
 struct ab_naming_snapshot actor;
 struct ab_semantic_event action;
 bool period, emitted;
};
/* Parsed immutable source pointers are registered by pinned canonical record
 * coordinates. No English contents participate in runtime identity selection. */
const char *ab_combat_text_id(const char *selected_source);
void ab_combat_reset_catalog_bindings(void);
void ab_combat_reaction_begin(struct ab_combat_reaction *s,int count,bool offscreen,int sound);
void ab_combat_subject_hidden(void);
void ab_combat_subject_visible(const struct monster_race *race,bool unique,const char *plural_form);
void ab_combat_subject_comma(void);
void ab_combat_reaction_body(int code,const char *selected_source,bool plural);
void ab_combat_reaction_format(const char *form);
int ab_combat_reaction_damage(int displayed_damage);
void ab_combat_reaction_emit(void);
void ab_combat_spell_begin(struct ab_combat_template *s,const char *selected_source,int sound);
void ab_combat_template_monster(struct ab_combat_template *s,const char *tag,const char *native_buffer,bool semantic_reference);
void ab_combat_template_player(struct ab_combat_template *s,const char *tag,bool possessive);
void ab_combat_template_lash(struct ab_combat_template *s,const char *tag,const char *selected_lash,bool optional_of);
void ab_combat_template_has(struct ab_combat_template *s,bool monster_target);
void ab_combat_spell_end(struct ab_combat_template *s);
void ab_combat_save(const char *selected_source);
void ab_combat_blow_begin(struct ab_combat_blow *s,const char *native_actor_buffer);
void ab_combat_blow_action_begin(struct ab_combat_template *s,const char *selected_source);
void ab_combat_blow_action_end(struct ab_combat_template *s);
void ab_combat_blow_stop(bool period);
void ab_combat_blow_emit(struct ab_combat_blow *s,int sound,bool show_damage,int damage);
void ab_combat_blow_end(struct ab_combat_blow *s);
#define AB_COMBAT_REACTION_DAMAGE(value) ab_combat_reaction_damage(value)
#else
#define AB_COMBAT_REACTION_DAMAGE(value) (value)
#endif
#endif
