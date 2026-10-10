/* SPDX-License-Identifier: GPL-2.0-only */
#ifndef ANGBAND_WEB_TEXT_CAPTURE_H
#define ANGBAND_WEB_TEXT_CAPTURE_H
#include "angband.h"

#ifdef __EMSCRIPTEN__
#define AB_TEXT_CAPTURE(expression) (expression)
struct chunk;
struct feature;
struct monster;
struct object;
struct object_kind;
struct trap_kind;

enum ab_text_digging_method { AB_TEXT_DIG_HANDS, AB_TEXT_DIG_WEAPON,
 AB_TEXT_DIG_SWAP_DIGGER };
enum ab_text_feeling_join { AB_TEXT_FEEL_AND, AB_TEXT_FEEL_YET };
/* Owned public facts, frozen at the original monster_desc point. No entity ID. */
struct ab_text_monster_projection {
 uint32_t length;
 char json[4096];
};
const char *ab_text_terrain_name_id(int feature_index);
const char *ab_text_trap_name_id(const struct trap_kind *kind);
const char *ab_text_money_name_id(const struct object_kind *kind);
void ab_text_emit_digging(const char *id, enum ab_text_digging_method method);
void ab_text_emit_terrain_digging(const char *id, struct chunk *known_cave,
 struct loc grid, enum ab_text_digging_method method);
void ab_text_emit_terrain_error(const char *id, const struct feature *feature);
void ab_text_emit_trap(const char *id, const struct trap_kind *kind, int sound);
void ab_text_capture_monster(struct ab_text_monster_projection *projection,
 const struct monster *monster, int original_mode);
void ab_text_emit_monster(const char *id, const struct monster *monster,
 int original_mode, int sound);
void ab_text_emit_actor(const char *id,
 const struct ab_text_monster_projection *actor);
/* Address must be frozen while the object is live, before a consuming call. */
bool ab_text_object_address_is_live(uintptr_t address);
void ab_text_emit_monster_drop(const char *id,
 const struct ab_text_monster_projection *actor, const struct object *object);
void ab_text_emit_object_feeling(const char *id, int32_t grade);
void ab_text_emit_monster_feeling(const char *id, int32_t grade);
void ab_text_emit_combined_feeling(const char *id, int32_t monster_grade,
 enum ab_text_feeling_join join, int32_t object_grade);
void ab_text_emit_gold(const char *id, int32_t amount, bool single_kind,
 const char *money_name_id, int sound);
#else
/* Arguments are deliberately not evaluated on the original native path. */
#define AB_TEXT_CAPTURE(expression) ((void)0)
#endif /* __EMSCRIPTEN__ */
#endif /* ANGBAND_WEB_TEXT_CAPTURE_H */
