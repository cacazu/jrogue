/* SPDX-License-Identifier: GPL-2.0-only */
#include "web-text-capture.h"
#ifdef __EMSCRIPTEN__
#include "web-semantic.h"
#include "web-naming.h"
#include "cave.h"
#include "game-input.h"
#include "mon-desc.h"
#include "mon-predicate.h"
#include "monster.h"
#include "obj-desc.h"
#include "obj-tval.h"
#include "obj-util.h"
#include "trap.h"
#include "z-quark.h"

/* Versioned source identities: no completed English names are matched. */
static const char *const ab_terrain_ids[] = {
 /* 0 NONE */ "terrain.none.name",
 /* 1 FLOOR */ "terrain.floor.name",
 /* 2 CLOSED */ "terrain.closed.name",
 /* 3 OPEN */ "terrain.open.name",
 /* 4 BROKEN */ "terrain.broken.name",
 /* 5 LESS */ "terrain.less.name",
 /* 6 MORE */ "terrain.more.name",
 /* 7 STORE_GENERAL */ "terrain.store_general.name",
 /* 8 STORE_ARMOR */ "terrain.store_armor.name",
 /* 9 STORE_WEAPON */ "terrain.store_weapon.name",
 /* 10 STORE_BOOK */ "terrain.store_book.name",
 /* 11 STORE_ALCHEMY */ "terrain.store_alchemy.name",
 /* 12 STORE_MAGIC */ "terrain.store_magic.name",
 /* 13 STORE_BLACK */ "terrain.store_black.name",
 /* 14 HOME */ "terrain.home.name",
 /* 15 SECRET */ "terrain.secret.name",
 /* 16 RUBBLE */ "terrain.rubble.name",
 /* 17 MAGMA */ "terrain.magma.name",
 /* 18 QUARTZ */ "terrain.quartz.name",
 /* 19 MAGMA_K */ "terrain.magma_k.name",
 /* 20 QUARTZ_K */ "terrain.quartz_k.name",
 /* 21 GRANITE */ "terrain.granite.name",
 /* 22 PERM */ "terrain.perm.name",
 /* 23 LAVA */ "terrain.lava.name",
 /* 24 PASS_RUBBLE */ "terrain.pass_rubble.name"
};
static const char *const ab_trap_ids[] = {
 /* 0 trap.txt:58 */ "trap.label.no_trap",
 /* 1 trap.txt:61 */ "trap.label.glyph_of_warding",
 /* 2 trap.txt:67 */ "trap.label.decoy",
 /* 3 trap.txt:73 */ "trap.label.door_lock",
 /* 4 trap.txt:79 */ "trap.label.web",
 /* 5 trap.txt:89 */ "trap.label.trap_door",
 /* 6 trap.txt:103 */ "trap.label.pit",
 /* 7 trap.txt:117 */ "trap.label.pit",
 /* 8 trap.txt:136 */ "trap.label.pit",
 /* 9 trap.txt:157 */ "trap.label.strange_rune",
 /* 10 trap.txt:169 */ "trap.label.strange_rune",
 /* 11 trap.txt:181 */ "trap.label.strange_rune",
 /* 12 trap.txt:193 */ "trap.label.strange_rune",
 /* 13 trap.txt:205 */ "trap.label.strange_rune",
 /* 14 trap.txt:219 */ "trap.label.strange_rune",
 /* 15 trap.txt:231 */ "trap.label.discolored_spot",
 /* 16 trap.txt:244 */ "trap.label.discolored_spot",
 /* 17 trap.txt:257 */ "trap.label.dart_trap",
 /* 18 trap.txt:272 */ "trap.label.dart_trap",
 /* 19 trap.txt:286 */ "trap.label.dart_trap",
 /* 20 trap.txt:300 */ "trap.label.dart_trap",
 /* 21 trap.txt:314 */ "trap.label.gas_trap",
 /* 22 trap.txt:326 */ "trap.label.gas_trap",
 /* 23 trap.txt:338 */ "trap.label.gas_trap",
 /* 24 trap.txt:350 */ "trap.label.gas_trap",
 /* 25 trap.txt:362 */ "trap.label.alarm",
 /* 26 trap.txt:375 */ "trap.label.alarm",
 /* 27 trap.txt:386 */ "trap.label.explosion",
 /* 28 trap.txt:399 */ "trap.label.explosion",
 /* 29 trap.txt:420 */ "trap.label.mind_blast_trap",
 /* 30 trap.txt:437 */ "trap.label.mind_blast_trap",
 /* 31 trap.txt:460 */ "trap.label.ancient_mechanism",
 /* 32 trap.txt:476 */ "trap.label.ancient_mechanism",
 /* 33 trap.txt:488 */ "trap.label.ancient_mechanism",
 /* 34 trap.txt:500 */ "trap.label.ancient_mechanism",
 /* 35 trap.txt:516 */ "trap.label.trap",
 /* 36 trap.txt:529 */ "trap.label.trap",
 /* 37 trap.txt:544 */ "trap.label.trap",
 /* 38 trap.txt:559 */ "trap.label.trap",
 /* 39 trap.txt:574 */ "trap.label.trap"
};
static const char *const ab_money_ids[] = {
 NULL,
 /* sval 1 */ "money.copper.name",
 /* sval 2 */ "money.silver.name",
 /* sval 3 */ "money.garnets.name",
 /* sval 4 */ "money.gold.name",
 /* sval 5 */ "money.opals.name",
 /* sval 6 */ "money.sapphires.name",
 /* sval 7 */ "money.rubies.name",
 /* sval 8 */ "money.diamonds.name",
 /* sval 9 */ "money.emeralds.name",
 /* sval 10 */ "money.mithril.name",
 /* sval 11 */ "money.adamantite.name"
};

const char *ab_text_terrain_name_id(int feature_index)
{
 if (feature_index < 0 || (size_t)feature_index >=
  sizeof(ab_terrain_ids) / sizeof(ab_terrain_ids[0])) return NULL;
 return ab_terrain_ids[feature_index];
}

const char *ab_text_trap_name_id(const struct trap_kind *kind)
{
 if (!kind || kind->tidx < 0 || (size_t)kind->tidx >=
  sizeof(ab_trap_ids) / sizeof(ab_trap_ids[0])) return NULL;
 return ab_trap_ids[kind->tidx];
}

const char *ab_text_money_name_id(const struct object_kind *kind)
{
 if (!kind || kind->tval != TV_GOLD || kind->sval < 1 ||
  (size_t)kind->sval >= sizeof(ab_money_ids) / sizeof(ab_money_ids[0]))
  return NULL;
 return ab_money_ids[kind->sval];
}

static void ab_text_begin(struct ab_semantic_event *event, const char *id,
 int sound)
{
 ab_semantic_event_begin(event, id, "message", "command", "log", 0, sound);
}

static void ab_text_name_reference(struct ab_semantic_event *event,
 const char *name_id)
{
 if (!name_id) {
  ab_semantic_json_literal(event,
   "{\"complete\":false,\"reason\":\"UnsupportedCatalogIdentity\"}");
  return;
 }
 ab_semantic_json_literal(event, "{\"name_id\":");
 ab_semantic_json_string(event, name_id);
 ab_semantic_json_literal(event, "}");
}

static void ab_text_digging_parameter(struct ab_semantic_event *event,
 enum ab_text_digging_method method)
{
 const char *value = method == AB_TEXT_DIG_HANDS ? "hands" :
  method == AB_TEXT_DIG_WEAPON ? "weapon" : "swap_digger";
 ab_semantic_param_begin(event, "digging_method", "DiggingMethod");
 ab_semantic_json_string(event, value);
 ab_semantic_param_end(event);
}

void ab_text_emit_digging(const char *id, enum ab_text_digging_method method)
{
 struct ab_semantic_event event;
 ab_text_begin(&event, id, MSG_GENERIC);
 ab_text_digging_parameter(&event, method);
 ab_semantic_event_emit(&event);
}

void ab_text_emit_terrain_digging(const char *id, struct chunk *known_cave,
 struct loc grid, enum ab_text_digging_method method)
{
 struct ab_semantic_event event;
 int index = square(known_cave, grid)->feat;
 const struct feature *feature = f_info[index].mimic ?
  f_info[index].mimic : &f_info[index];
 ab_text_begin(&event, id, MSG_GENERIC);
 ab_semantic_param_begin(&event, "terrain", "ApparentTerrain");
 ab_text_name_reference(&event, ab_text_terrain_name_id(feature->fidx));
 ab_semantic_param_end(&event);
 ab_text_digging_parameter(&event, method);
 ab_semantic_event_emit(&event);
}

void ab_text_emit_terrain_error(const char *id, const struct feature *feature)
{
 struct ab_semantic_event event;
 ab_semantic_event_begin(&event, id, "message", "command", "log", 2,
  MSG_GENERIC);
 ab_semantic_param_begin(&event, "terrain", "TerrainDiagnosticReference");
 if (feature->name) {
  ab_text_name_reference(&event, ab_text_terrain_name_id(feature->fidx));
 } else {
  ab_semantic_json_literal(&event, "{\"terrain_index\":");
  ab_semantic_json_int32(&event, feature->fidx);
  ab_semantic_json_literal(&event, "}");
 }
 ab_semantic_param_end(&event);
 ab_semantic_event_emit(&event);
}

void ab_text_emit_trap(const char *id, const struct trap_kind *kind, int sound)
{
 struct ab_semantic_event event;
 ab_text_begin(&event, id, sound);
 ab_semantic_param_begin(&event, "trap", "TrapName");
 ab_text_name_reference(&event, ab_text_trap_name_id(kind));
 ab_semantic_param_end(&event);
 ab_semantic_event_emit(&event);
}

void ab_text_capture_monster(struct ab_text_monster_projection *projection,
 const struct monster *monster, int original_mode)
{
 struct ab_naming_snapshot snapshot;
 memset(projection, 0, sizeof(*projection));
 /* Copy the facts already selected by the original native monster_desc call. */
 if (ab_naming_copy_monster_subject_snapshot(&snapshot, monster,
  (uint32_t)original_mode)) {
  if (snapshot.length < sizeof(projection->json)) {
   memcpy(projection->json, snapshot.json, (size_t)snapshot.length + 1);
   projection->length = snapshot.length;
  }
  ab_naming_snapshot_release(&snapshot);
 }
}

static void ab_text_monster_parameter(struct ab_semantic_event *event,
 const struct ab_text_monster_projection *projection)
{
 struct ab_naming_snapshot snapshot = { NULL, 0 };
 if (projection && projection->length &&
  projection->length < sizeof(projection->json)) {
  snapshot.json = (char *)projection->json;
  snapshot.length = projection->length;
 }
 ab_naming_param_snapshot(event, "monster", "MonsterDescription", &snapshot);
}

void ab_text_emit_monster(const char *id, const struct monster *monster,
 int original_mode, int sound)
{
 struct ab_text_monster_projection projection;
 struct ab_semantic_event event;
 ab_text_capture_monster(&projection, monster, original_mode);
 ab_text_begin(&event, id, sound);
 ab_text_monster_parameter(&event, &projection);
 ab_semantic_event_emit(&event);
}

void ab_text_emit_actor(const char *id,
 const struct ab_text_monster_projection *actor)
{
 struct ab_semantic_event event;
 ab_text_begin(&event, id, MSG_GENERIC);
 ab_text_monster_parameter(&event, actor);
 ab_semantic_event_emit(&event);
}

bool ab_text_object_address_is_live(uintptr_t address)
{
 int index;
 if (!cave || !address) return false;
 for (index = 1; index < cave->obj_max; index++) {
  /* Compare only live table pointers with an address frozen before drop. */
  if ((uintptr_t)cave->objects[index] == address) return true;
 }
 return false;
}

static bool ab_text_object_is_live(const struct object *needle)
{
 return needle && ab_text_object_address_is_live((uintptr_t)needle);
}

static void ab_text_known_object_parameter(struct ab_semantic_event *event,
 const struct object *object)
{
 struct ab_naming_snapshot snapshot = { NULL, 0 };
 /* The source drop guard establishes lifetime; this copies only the immutable
  * capture from its one original object_desc call. No known/real fields read. */
 if (!object || ab_text_object_is_live(object))
  ab_naming_copy_object_subject_snapshot(&snapshot, object,
   ODESC_PREFIX | ODESC_FULL);
 ab_naming_param_snapshot(event, "object", "KnownObjectDescription", &snapshot);
 ab_naming_snapshot_release(&snapshot);
}

void ab_text_emit_monster_drop(const char *id,
 const struct ab_text_monster_projection *actor, const struct object *object)
{
 struct ab_semantic_event event;
 ab_text_begin(&event, id, MSG_GENERIC);
 ab_text_monster_parameter(&event, actor);
 ab_text_known_object_parameter(&event, object);
 ab_semantic_event_emit(&event);
}

static void ab_text_feeling_parameter(struct ab_semantic_event *event,
 const char *name, const char *type, int32_t grade, const char *context)
{
 ab_semantic_param_begin(event, name, type);
 ab_semantic_json_literal(event, "{\"grade\":");
 ab_semantic_json_int32(event, grade);
 ab_semantic_json_literal(event, ",\"context\":");
 ab_semantic_json_string(event, context);
 ab_semantic_json_literal(event, "}");
 ab_semantic_param_end(event);
}

void ab_text_emit_object_feeling(const char *id, int32_t grade)
{
 struct ab_semantic_event event;
 ab_text_begin(&event, id, MSG_GENERIC);
 ab_text_feeling_parameter(&event, "object_feeling", "ObjectFeeling", grade,
  "embedded_clause");
 ab_semantic_event_emit(&event);
}

void ab_text_emit_monster_feeling(const char *id, int32_t grade)
{
 struct ab_semantic_event event;
 ab_text_begin(&event, id, MSG_GENERIC);
 ab_text_feeling_parameter(&event, "monster_feeling", "MonsterFeeling", grade,
  "standalone_clause");
 ab_semantic_event_emit(&event);
}

void ab_text_emit_combined_feeling(const char *id, int32_t monster_grade,
 enum ab_text_feeling_join join, int32_t object_grade)
{
 struct ab_semantic_event event;
 ab_text_begin(&event, id, MSG_GENERIC);
 ab_text_feeling_parameter(&event, "monster_feeling", "MonsterFeeling",
  monster_grade, "combined_clause");
 ab_semantic_param_begin(&event, "conjunction", "FeelingConjunction");
 ab_semantic_json_string(&event, join == AB_TEXT_FEEL_YET ? "yet" : "and");
 ab_semantic_param_end(&event);
 ab_text_feeling_parameter(&event, "object_feeling", "ObjectFeeling",
  object_grade, "combined_clause");
 ab_semantic_event_emit(&event);
}

void ab_text_emit_gold(const char *id, int32_t amount, bool single_kind,
 const char *money_name_id, int sound)
{
 struct ab_semantic_event event;
 ab_text_begin(&event, id, sound);
 ab_semantic_param_begin(&event, "gold_message", "GoldPickupMessage");
 ab_semantic_json_literal(&event, "{\"variant\":");
 ab_semantic_json_string(&event, single_kind ? "single_kind" : "mixed_kinds");
 ab_semantic_json_literal(&event, ",\"gold_amount\":");
 ab_semantic_json_int32(&event, amount);
 if (single_kind) {
  ab_semantic_json_literal(&event, ",\"treasure\":");
  ab_text_name_reference(&event, money_name_id);
 }
 ab_semantic_json_literal(&event, "}");
 ab_semantic_param_end(&event);
 ab_semantic_event_emit(&event);
}
#endif /* __EMSCRIPTEN__ */
