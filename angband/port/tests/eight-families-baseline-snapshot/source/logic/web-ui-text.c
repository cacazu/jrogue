/* SPDX-License-Identifier: GPL-2.0-only */
#include "angband.h"
#include "player.h"
#include "player-timed.h"
#include "option.h"
#include "web-semantic.h"
#include "web-ui-text.h"
#include "web-history.h"
#ifdef __EMSCRIPTEN__
#include "ui-event.h"
#include "web-naming.h"
#include "cmd-core.h"
#include <stdlib.h>
#include "web-check-commands.h"
/* A bounded presentation stack; it is never part of simulation/save state. */
static const char *ui_scopes[16];
static unsigned ui_depth;
static bool ui_batches[16];
static bool ui_compact;
static bool ui_history_is_edited;
static const char *ui_context(const char *explicit_context) {
 return explicit_context ? explicit_context : (ui_depth ? ui_scopes[ui_depth-1] : NULL);
}
static void ui_value(struct ab_semantic_event *e,const struct ab_ui_param *p,unsigned depth);
static void ui_parameters(struct ab_semantic_event *e,const struct ab_ui_param *p,size_t count,unsigned depth) {
 size_t i;
 for (i=0;i<count;i++) {
  if(i) ab_semantic_json_literal(e,",");
  ab_semantic_json_string(e,p[i].name);
  ab_semantic_json_literal(e,":{\"type\":");
  ab_semantic_json_string(e,p[i].type);
  ab_semantic_json_literal(e,",\"value\":");
  ui_value(e,&p[i],depth);
  ab_semantic_json_literal(e,"}");
 }
}
static void ui_value(struct ab_semantic_event *e,const struct ab_ui_param *p,unsigned depth) {
 size_t i;
 if(depth>8) { e->valid=false;return; }
 if(!strcmp(p->type,"integer") || !strcmp(p->type,"signed_integer") || !strcmp(p->type,"decimal_one_place")) {
  ab_semantic_json_int32(e,p->number);
 } else if(!strcmp(p->type,"localized_text")) {
  if(!p->text) { e->valid=false;return; }
  ab_semantic_json_literal(e,"{\"id\":");
  ab_semantic_json_string(e,p->text);
  if(p->nested_count) {
   ab_semantic_json_literal(e,",\"params\":{");
   ui_parameters(e,p->nested,p->nested_count,depth+1);
   ab_semantic_json_literal(e,"}");
  }
  ab_semantic_json_literal(e,"}");
 } else if(!strcmp(p->type,"localized_text_list")) {
  ab_semantic_json_literal(e,"{\"ids\":[");
  for(i=0;i<p->id_count;i++) {
   if(i)ab_semantic_json_literal(e,",");
   if(!p->ids[i]) { e->valid=false;return; }
   ab_semantic_json_string(e,p->ids[i]);
  }
  ab_semantic_json_literal(e,"],\"style\":\"birth_realm_conjunction\"}");
 } else {
  /* Opaque values always go through the shared UTF-8 JSON escaper. */
  ab_semantic_json_string(e,p->text ? p->text : "");
 }
}
static void ui_dispatch(const char *context,const char *widget,const char *id,const struct ab_ui_param *params,size_t count,bool control) {
 struct ab_semantic_event event;
 size_t i;
 context=ui_context(context);
 if(!context || !widget || !id || count>16) return;
 ab_semantic_event_begin(&event,id,"ui",context,widget,0,-1);
 for(i=0;i<count;i++) {
  ab_semantic_param_begin(&event,params[i].name,params[i].type);
  ui_value(&event,&params[i],0);
  ab_semantic_param_end(&event);
 }
 if(control) ab_semantic_event_emit_control(&event);
 else ab_semantic_event_emit(&event);
}
void ab_ui_emit(const char *context,const char *widget,const char *id,const struct ab_ui_param *params,size_t count) {
 if(id)ui_dispatch(context,widget,id,params,count,false);
}
void ab_ui_static(const char *context,const char *widget,const char *id) { ab_ui_emit(context,widget,id,NULL,0); }
void ab_ui_scope_begin(const char *context,bool replace) {
 bool own_batch;
 if(!context || ui_depth>=N_ELEMENTS(ui_scopes))return;
 own_batch=!ui_depth || strcmp(ui_scopes[ui_depth-1],context);
 ui_scopes[ui_depth]=context;ui_batches[ui_depth]=own_batch;ui_depth++;
 if(own_batch)ui_dispatch(context,replace?"__begin_replace":"__begin_patch","",NULL,0,true);
}
void ab_ui_scope_commit(void) {
 unsigned i;
 if(!ui_depth)return;
 i=ui_depth;
 while(i && !strcmp(ui_scopes[i-1],ui_scopes[ui_depth-1])) {
  i--;
  if(ui_batches[i]) { ui_dispatch(NULL,"__end","",NULL,0,true);ui_batches[i]=false;break; }
 }
}
void ab_ui_scope_end(void) {
 if(!ui_depth)return;
 if(ui_batches[ui_depth-1])ui_dispatch(NULL,"__end","",NULL,0,true);
 ui_depth--;
}
void ab_ui_reset(const char *context) { ui_dispatch(context,"__reset","",NULL,0,true); }
void ab_ui_clear(const char *widget) {
 char key[128];
 if(!widget)return;
 strnfmt(key,sizeof(key),"__clear:%s",widget);
 ui_dispatch(NULL,key,"",NULL,0,true);
}
bool ab_ui_in(const char *context) { const char *active=ui_context(NULL);return active && !strcmp(active,context); }
void ab_ui_number(const char *widget,int32_t value) {
 char key[128];struct ab_ui_param p=AB_UI_INT("number",value);
 strnfmt(key,sizeof(key),"__value:%s",widget);
 ui_dispatch(NULL,key,"",&p,1,true);
}
void ab_ui_scalar(const char *widget,int32_t value,bool force_sign) {
 char key[128];struct ab_ui_param p=force_sign?AB_UI_SIGN("number",value):AB_UI_INT("number",value);
 strnfmt(key,sizeof(key),"__value:%s",widget);ui_dispatch(NULL,key,"",&p,1,true);
}
void ab_ui_sidebar_mode(bool compact) { ui_compact=compact; }
bool ab_ui_sidebar_compact(void) { return ui_compact; }
void ab_ui_history_edited(void) { ui_history_is_edited=true; }
void ab_ui_history_reset(void) { ui_history_is_edited=false; }
void ab_ui_history(const char *widget,const char *text) {
 struct ab_history_snapshot source;
 const char *context=ui_context(NULL);
 ab_history_current_snapshot(&source);
 if(!context || !widget)return;
 if(!ab_history_snapshot_matches(&source,text))source.origin=AB_HISTORY_UNKNOWN;
 if(source.origin==AB_HISTORY_GENERATED) {
  struct ab_semantic_event event;size_t i;
  ab_semantic_event_begin(&event,"player.sheet.generated_history.value","ui",context,widget,0,-1);
  ab_semantic_param_begin(&event,"history","GeneratedHistory");
  ab_semantic_json_literal(&event,"{\"grammar_version\":");
  ab_semantic_json_int32(&event,AB_HISTORY_GRAMMAR_VERSION);
  ab_semantic_json_literal(&event,",\"catalog_sha256\":");
  ab_semantic_json_string(&event,ab_history_catalog_sha256());
  ab_semantic_json_literal(&event,",\"start_chart\":");
  ab_semantic_json_int32(&event,source.start_chart);
  ab_semantic_json_literal(&event,",\"choices\":[");
  for(i=0;i<source.count;i++) {
   if(i)ab_semantic_json_literal(&event,",");
   ab_semantic_json_literal(&event,"{\"chart\":");
   ab_semantic_json_int32(&event,source.choices[i].chart);
   ab_semantic_json_literal(&event,",\"cutoff\":");
   ab_semantic_json_int32(&event,source.choices[i].cutoff);
   ab_semantic_json_literal(&event,"}");
  }
  ab_semantic_json_literal(&event,"]}");
  ab_semantic_param_end(&event);ab_semantic_event_emit(&event);
 } else if(source.origin==AB_HISTORY_AUTHORED) {
  struct ab_ui_param p=AB_UI_OPAQUE("history","verbatim_user_text",text);
  ab_ui_emit(NULL,widget,"player.sheet.history.value",&p,1);
 } else {
  char key[128];strnfmt(key,sizeof(key),"__unsupported:%s",widget);
  ui_dispatch(NULL,key,"",NULL,0,true);
 }
}

struct ui_key_id { const char *key;const char *id; };
static const char *ui_lookup(const struct ui_key_id *table,size_t count,const char *key) {
 size_t i;if(!key)return NULL;
 for(i=0;i<count;i++)if(!strcmp(table[i].key,key))return table[i].id;
 return NULL;
}
static const char *const ui_race_ids[] = {
 "angband.player_race.human.name",
 "angband.player_race.half_elf.name",
 "angband.player_race.elf.name",
 "angband.player_race.hobbit.name",
 "angband.player_race.gnome.name",
 "angband.player_race.dwarf.name",
 "angband.player_race.half_orc.name",
 "angband.player_race.half_troll.name",
 "angband.player_race.dunadan.name",
 "angband.player_race.high_elf.name",
 "angband.player_race.kobold.name",
};

static const char *const ui_class_ids[] = {
 "angband.player_class.warrior.name",
 "angband.player_class.mage.name",
 "angband.player_class.druid.name",
 "angband.player_class.priest.name",
 "angband.player_class.necromancer.name",
 "angband.player_class.paladin.name",
 "angband.player_class.rogue.name",
 "angband.player_class.ranger.name",
 "angband.player_class.blackguard.name",
};

static const char *const ui_title_ids[][10] = {

 { "angband.player_class.warrior.title.level_01_05", "angband.player_class.warrior.title.level_06_10", "angband.player_class.warrior.title.level_11_15", "angband.player_class.warrior.title.level_16_20", "angband.player_class.warrior.title.level_21_25", "angband.player_class.warrior.title.level_26_30", "angband.player_class.warrior.title.level_31_35", "angband.player_class.warrior.title.level_36_40", "angband.player_class.warrior.title.level_41_45", "angband.player_class.warrior.title.level_46_50" },

 { "angband.player_class.mage.title.level_01_05", "angband.player_class.mage.title.level_06_10", "angband.player_class.mage.title.level_11_15", "angband.player_class.mage.title.level_16_20", "angband.player_class.mage.title.level_21_25", "angband.player_class.mage.title.level_26_30", "angband.player_class.mage.title.level_31_35", "angband.player_class.mage.title.level_36_40", "angband.player_class.mage.title.level_41_45", "angband.player_class.mage.title.level_46_50" },

 { "angband.player_class.druid.title.level_01_05", "angband.player_class.druid.title.level_06_10", "angband.player_class.druid.title.level_11_15", "angband.player_class.druid.title.level_16_20", "angband.player_class.druid.title.level_21_25", "angband.player_class.druid.title.level_26_30", "angband.player_class.druid.title.level_31_35", "angband.player_class.druid.title.level_36_40", "angband.player_class.druid.title.level_41_45", "angband.player_class.druid.title.level_46_50" },

 { "angband.player_class.priest.title.level_01_05", "angband.player_class.priest.title.level_06_10", "angband.player_class.priest.title.level_11_15", "angband.player_class.priest.title.level_16_20", "angband.player_class.priest.title.level_21_25", "angband.player_class.priest.title.level_26_30", "angband.player_class.priest.title.level_31_35", "angband.player_class.priest.title.level_36_40", "angband.player_class.priest.title.level_41_45", "angband.player_class.priest.title.level_46_50" },

 { "angband.player_class.necromancer.title.level_01_05", "angband.player_class.necromancer.title.level_06_10", "angband.player_class.necromancer.title.level_11_15", "angband.player_class.necromancer.title.level_16_20", "angband.player_class.necromancer.title.level_21_25", "angband.player_class.necromancer.title.level_26_30", "angband.player_class.necromancer.title.level_31_35", "angband.player_class.necromancer.title.level_36_40", "angband.player_class.necromancer.title.level_41_45", "angband.player_class.necromancer.title.level_46_50" },

 { "angband.player_class.paladin.title.level_01_05", "angband.player_class.paladin.title.level_06_10", "angband.player_class.paladin.title.level_11_15", "angband.player_class.paladin.title.level_16_20", "angband.player_class.paladin.title.level_21_25", "angband.player_class.paladin.title.level_26_30", "angband.player_class.paladin.title.level_31_35", "angband.player_class.paladin.title.level_36_40", "angband.player_class.paladin.title.level_41_45", "angband.player_class.paladin.title.level_46_50" },

 { "angband.player_class.rogue.title.level_01_05", "angband.player_class.rogue.title.level_06_10", "angband.player_class.rogue.title.level_11_15", "angband.player_class.rogue.title.level_16_20", "angband.player_class.rogue.title.level_21_25", "angband.player_class.rogue.title.level_26_30", "angband.player_class.rogue.title.level_31_35", "angband.player_class.rogue.title.level_36_40", "angband.player_class.rogue.title.level_41_45", "angband.player_class.rogue.title.level_46_50" },

 { "angband.player_class.ranger.title.level_01_05", "angband.player_class.ranger.title.level_06_10", "angband.player_class.ranger.title.level_11_15", "angband.player_class.ranger.title.level_16_20", "angband.player_class.ranger.title.level_21_25", "angband.player_class.ranger.title.level_26_30", "angband.player_class.ranger.title.level_31_35", "angband.player_class.ranger.title.level_36_40", "angband.player_class.ranger.title.level_41_45", "angband.player_class.ranger.title.level_46_50" },

 { "angband.player_class.blackguard.title.level_01_05", "angband.player_class.blackguard.title.level_06_10", "angband.player_class.blackguard.title.level_11_15", "angband.player_class.blackguard.title.level_16_20", "angband.player_class.blackguard.title.level_21_25", "angband.player_class.blackguard.title.level_26_30", "angband.player_class.blackguard.title.level_31_35", "angband.player_class.blackguard.title.level_36_40", "angband.player_class.blackguard.title.level_41_45", "angband.player_class.blackguard.title.level_46_50" },

};

static const char *const ui_shape_ids[] = {
 "player.shape.normal.name",
 "player.shape.fox.name",
 "player.shape.pukel_man.name",
 "player.shape.bear.name",
 "player.shape.eagle.name",
 "player.shape.bat.name",
 "player.shape.warg.name",
 "player.shape.vampire.name",
 "player.shape.werewolf.name",
};

const char *ab_ui_race_id(int index) { return index>=0 && (size_t)index<N_ELEMENTS(ui_race_ids) ? ui_race_ids[index] : NULL; }

const char *ab_ui_class_id(int index) { return index>=0 && (size_t)index<N_ELEMENTS(ui_class_ids) ? ui_class_ids[index] : NULL; }

const char *ab_ui_shape_id(int index) { return index>=0 && (size_t)index<N_ELEMENTS(ui_shape_ids) ? ui_shape_ids[index] : NULL; }

const char *ab_ui_title_id(int class_index,int rank) { return class_index>=0 && (size_t)class_index<N_ELEMENTS(ui_title_ids) && rank>=0 && rank<10 ? ui_title_ids[class_index][rank] : NULL; }

static const struct ui_key_id ui_realm_ids[] = {
 { "arcane", "magic.realm.arcane.name" },
 { "divine", "magic.realm.divine.name" },
 { "nature", "magic.realm.nature.name" },
 { "shadow", "magic.realm.shadow.name" },
};

const char *ab_ui_realm_id(const char *key) { return ui_lookup(ui_realm_ids,N_ELEMENTS(ui_realm_ids),key); }

static const struct ui_key_id ui_terrain_ids[] = {
 { "NONE", "terrain.none.name" },
 { "FLOOR", "terrain.floor.name" },
 { "CLOSED", "terrain.closed.name" },
 { "OPEN", "terrain.open.name" },
 { "BROKEN", "terrain.broken.name" },
 { "LESS", "terrain.less.name" },
 { "MORE", "terrain.more.name" },
 { "STORE_GENERAL", "terrain.store_general.name" },
 { "STORE_ARMOR", "terrain.store_armor.name" },
 { "STORE_WEAPON", "terrain.store_weapon.name" },
 { "STORE_BOOK", "terrain.store_book.name" },
 { "STORE_ALCHEMY", "terrain.store_alchemy.name" },
 { "STORE_MAGIC", "terrain.store_magic.name" },
 { "STORE_BLACK", "terrain.store_black.name" },
 { "HOME", "terrain.home.name" },
 { "SECRET", "terrain.secret.name" },
 { "RUBBLE", "terrain.rubble.name" },
 { "MAGMA", "terrain.magma.name" },
 { "QUARTZ", "terrain.quartz.name" },
 { "MAGMA_K", "terrain.magma_k.name" },
 { "QUARTZ_K", "terrain.quartz_k.name" },
 { "GRANITE", "terrain.granite.name" },
 { "PERM", "terrain.perm.name" },
 { "LAVA", "terrain.lava.name" },
 { "PASS_RUBBLE", "terrain.pass_rubble.name" },
};

const char *ab_ui_terrain_id(const char *key) { return ui_lookup(ui_terrain_ids,N_ELEMENTS(ui_terrain_ids),key); }

static const struct ui_key_id ui_trap_ids[] = {
 { "no trap", "trap.label.no_trap" },
 { "glyph of warding", "trap.label.glyph_of_warding" },
 { "decoy", "trap.label.decoy" },
 { "door lock", "trap.label.door_lock" },
 { "web", "trap.label.web" },
 { "trap door", "trap.label.trap_door" },
 { "pit", "trap.label.pit" },
 { "spiked pit", "trap.label.pit" },
 { "poison pit", "trap.label.pit" },
 { "rune of summon foe", "trap.label.strange_rune" },
 { "rune of summoning", "trap.label.strange_rune" },
 { "rune of necromancy", "trap.label.strange_rune" },
 { "rune of dragonsong", "trap.label.strange_rune" },
 { "hellhole", "trap.label.strange_rune" },
 { "teleport rune", "trap.label.strange_rune" },
 { "fire trap", "trap.label.discolored_spot" },
 { "acid trap", "trap.label.discolored_spot" },
 { "slow dart", "trap.label.dart_trap" },
 { "strength loss dart", "trap.label.dart_trap" },
 { "dexterity loss dart", "trap.label.dart_trap" },
 { "constitution loss dart", "trap.label.dart_trap" },
 { "blinding gas trap", "trap.label.gas_trap" },
 { "confusion gas trap", "trap.label.gas_trap" },
 { "poison gas trap", "trap.label.gas_trap" },
 { "sleep gas trap", "trap.label.gas_trap" },
 { "aggravation trap", "trap.label.alarm" },
 { "siren", "trap.label.alarm" },
 { "mine trap", "trap.label.explosion" },
 { "blast trap", "trap.label.explosion" },
 { "mind blasting trap", "trap.label.mind_blast_trap" },
 { "brain smashing trap", "trap.label.mind_blast_trap" },
 { "rock fall trap", "trap.label.ancient_mechanism" },
 { "earthquake trap", "trap.label.ancient_mechanism" },
 { "block fall trap", "trap.label.ancient_mechanism" },
 { "area blast trap", "trap.label.ancient_mechanism" },
 { "blinding flash trap", "trap.label.trap" },
 { "blinding trap", "trap.label.trap" },
 { "mana drain trap", "trap.label.trap" },
 { "knife trap", "trap.label.trap" },
 { "petrifying trap", "trap.label.trap" },
};
const char *ab_ui_trap_id(const char *canonical_desc) { return ui_lookup(ui_trap_ids,N_ELEMENTS(ui_trap_ids),canonical_desc); }

struct ui_timed_id { int effect;int grade;const char *id; };
static const struct ui_timed_id ui_timed_ids[] = {

 { TMD_FAST, 1, "ui.status.timed.fast.grade_1" },

 { TMD_SLOW, 1, "ui.status.timed.slow.grade_1" },

 { TMD_BLIND, 1, "ui.status.timed.blind.grade_1" },

 { TMD_PARALYZED, 1, "ui.status.timed.paralyzed.grade_1" },

 { TMD_CONFUSED, 1, "ui.status.timed.confused.grade_1" },

 { TMD_AFRAID, 1, "ui.status.timed.afraid.grade_1" },

 { TMD_IMAGE, 1, "ui.status.timed.image.grade_1" },

 { TMD_POISONED, 1, "ui.status.timed.poisoned.grade_1" },

 { TMD_CUT, 1, "ui.status.timed.cut.grade_1" },

 { TMD_CUT, 2, "ui.status.timed.cut.grade_2" },

 { TMD_CUT, 3, "ui.status.timed.cut.grade_3" },

 { TMD_CUT, 4, "ui.status.timed.cut.grade_4" },

 { TMD_CUT, 5, "ui.status.timed.cut.grade_5" },

 { TMD_CUT, 6, "ui.status.timed.cut.grade_6" },

 { TMD_CUT, 7, "ui.status.timed.cut.grade_7" },

 { TMD_STUN, 1, "ui.status.timed.stun.grade_1" },

 { TMD_STUN, 2, "ui.status.timed.stun.grade_2" },

 { TMD_STUN, 3, "ui.status.timed.stun.grade_3" },

 { TMD_FOOD, 1, "ui.status.timed.food.grade_1" },

 { TMD_FOOD, 2, "ui.status.timed.food.grade_2" },

 { TMD_FOOD, 3, "ui.status.timed.food.grade_3" },

 { TMD_FOOD, 4, "ui.status.timed.food.grade_4" },

 { TMD_FOOD, 5, "ui.status.timed.food.grade_5" },

 { TMD_FOOD, 6, "ui.status.timed.food.grade_6" },

 { TMD_PROTEVIL, 1, "ui.status.timed.protevil.grade_1" },

 { TMD_INVULN, 1, "ui.status.timed.invuln.grade_1" },

 { TMD_HERO, 1, "ui.status.timed.hero.grade_1" },

 { TMD_SHERO, 1, "ui.status.timed.shero.grade_1" },

 { TMD_SHIELD, 1, "ui.status.timed.shield.grade_1" },

 { TMD_BLESSED, 1, "ui.status.timed.blessed.grade_1" },

 { TMD_SINVIS, 1, "ui.status.timed.sinvis.grade_1" },

 { TMD_SINFRA, 1, "ui.status.timed.sinfra.grade_1" },

 { TMD_OPP_ACID, 1, "ui.status.timed.opp_acid.grade_1" },

 { TMD_OPP_ELEC, 1, "ui.status.timed.opp_elec.grade_1" },

 { TMD_OPP_FIRE, 1, "ui.status.timed.opp_fire.grade_1" },

 { TMD_OPP_COLD, 1, "ui.status.timed.opp_cold.grade_1" },

 { TMD_OPP_POIS, 1, "ui.status.timed.opp_pois.grade_1" },

 { TMD_OPP_CONF, 1, "ui.status.timed.opp_conf.grade_1" },

 { TMD_AMNESIA, 1, "ui.status.timed.amnesia.grade_1" },

 { TMD_TELEPATHY, 1, "ui.status.timed.telepathy.grade_1" },

 { TMD_STONESKIN, 1, "ui.status.timed.stoneskin.grade_1" },

 { TMD_TERROR, 1, "ui.status.timed.terror.grade_1" },

 { TMD_SPRINT, 1, "ui.status.timed.sprint.grade_1" },

 { TMD_BOLD, 1, "ui.status.timed.bold.grade_1" },

 { TMD_SCRAMBLE, 1, "ui.status.timed.scramble.grade_1" },

 { TMD_TRAPSAFE, 1, "ui.status.timed.trapsafe.grade_1" },

 { TMD_FASTCAST, 1, "ui.status.timed.fastcast.grade_1" },

 { TMD_ATT_ACID, 1, "ui.status.timed.att_acid.grade_1" },

 { TMD_ATT_ELEC, 1, "ui.status.timed.att_elec.grade_1" },

 { TMD_ATT_FIRE, 1, "ui.status.timed.att_fire.grade_1" },

 { TMD_ATT_COLD, 1, "ui.status.timed.att_cold.grade_1" },

 { TMD_ATT_POIS, 1, "ui.status.timed.att_pois.grade_1" },

 { TMD_ATT_CONF, 1, "ui.status.timed.att_conf.grade_1" },

 { TMD_ATT_EVIL, 1, "ui.status.timed.att_evil.grade_1" },

 { TMD_ATT_DEMON, 1, "ui.status.timed.att_demon.grade_1" },

 { TMD_ATT_VAMP, 1, "ui.status.timed.att_vamp.grade_1" },

 { TMD_HEAL, 1, "ui.status.timed.heal.grade_1" },

 { TMD_COMMAND, 1, "ui.status.timed.command.grade_1" },

 { TMD_ATT_RUN, 1, "ui.status.timed.att_run.grade_1" },

 { TMD_COVERTRACKS, 1, "ui.status.timed.covertracks.grade_1" },

 { TMD_POWERSHOT, 1, "ui.status.timed.powershot.grade_1" },

 { TMD_TAUNT, 1, "ui.status.timed.taunt.grade_1" },

 { TMD_BLOODLUST, 1, "ui.status.timed.bloodlust.grade_1" },

 { TMD_BLOODLUST, 2, "ui.status.timed.bloodlust.grade_2" },

 { TMD_BLOODLUST, 3, "ui.status.timed.bloodlust.grade_3" },

 { TMD_BLOODLUST, 4, "ui.status.timed.bloodlust.grade_4" },

 { TMD_BLOODLUST, 5, "ui.status.timed.bloodlust.grade_5" },

 { TMD_BLOODLUST, 6, "ui.status.timed.bloodlust.grade_6" },

 { TMD_BLACKBREATH, 1, "ui.status.timed.blackbreath.grade_1" },

 { TMD_STEALTH, 1, "ui.status.timed.stealth.grade_1" },

 { TMD_FREE_ACT, 1, "ui.status.timed.free_act.grade_1" },

};
const char *ab_ui_timed_id(int effect,int grade) { size_t i;for(i=0;i<N_ELEMENTS(ui_timed_ids);i++)if(ui_timed_ids[i].effect==effect && ui_timed_ids[i].grade==grade)return ui_timed_ids[i].id;return NULL; }

static const char *const ui_long_stat_ids[][2] = {

 { "ui.sidebar.stat.str.healthy", "ui.sidebar.stat.str.drained" },

 { "ui.sidebar.stat.int.healthy", "ui.sidebar.stat.int.drained" },

 { "ui.sidebar.stat.wis.healthy", "ui.sidebar.stat.wis.drained" },

 { "ui.sidebar.stat.dex.healthy", "ui.sidebar.stat.dex.drained" },

 { "ui.sidebar.stat.con.healthy", "ui.sidebar.stat.con.drained" },

};

static const char *const ui_short_stat_ids[][2] = {

 { "ui.topbar.stat.str.healthy.label", "ui.topbar.stat.str.drained.label" },

 { "ui.topbar.stat.int.healthy.label", "ui.topbar.stat.int.drained.label" },

 { "ui.topbar.stat.wis.healthy.label", "ui.topbar.stat.wis.drained.label" },

 { "ui.topbar.stat.dex.healthy.label", "ui.topbar.stat.dex.drained.label" },

 { "ui.topbar.stat.con.healthy.label", "ui.topbar.stat.con.drained.label" },

};

const char *ab_ui_stat_id(int stat,bool drained,bool compact) {
 if(stat<0 || stat>=STAT_MAX)return NULL;
 return compact?ui_short_stat_ids[stat][drained?1:0]:ui_long_stat_ids[stat][drained?1:0];
}
void ab_ui_stat_value(const char *widget,int value) {
 const char *id;struct ab_ui_param p;size_t count;
 if(value>18) {
  int bonus=value-18;
  if(bonus>=220) {id="player.stat.notation.capped";count=0;}
  else {id=bonus>=100?"player.stat.notation.above_100":"player.stat.notation.above_18";p=AB_UI_INT("bonus",bonus);count=1;}
 } else {id="player.stat.notation.ordinary";p=AB_UI_INT("stat",value);count=1;}
 ab_ui_emit(NULL,widget,id,count?&p:NULL,count);
}

struct ui_ability_id { const char *type;int index;const char *id; };
static const struct ui_ability_id ui_ability_ids[] = {

 { "player", PF_ROCK, "player.ability.player.rock.name" },

 { "player", PF_KNOW_MUSHROOM, "player.ability.player.know_mushroom.name" },

 { "player", PF_KNOW_ZAPPER, "player.ability.player.know_zapper.name" },

 { "player", PF_SEE_ORE, "player.ability.player.see_ore.name" },

 { "player", PF_FAST_SHOT, "player.ability.player.fast_shot.name" },

 { "player", PF_BRAVERY_30, "player.ability.player.bravery_30.name" },

 { "player", PF_BLESS_WEAPON, "player.ability.player.bless_weapon.name" },

 { "player", PF_ZERO_FAIL, "player.ability.player.zero_fail.name" },

 { "player", PF_BEAM, "player.ability.player.beam.name" },

 { "player", PF_CHOOSE_SPELLS, "player.ability.player.choose_spells.name" },

 { "player", PF_NO_MANA, "player.ability.player.no_mana.name" },

 { "player", PF_CHARM, "player.ability.player.charm.name" },

 { "player", PF_UNLIGHT, "player.ability.player.unlight.name" },

 { "player", PF_STEAL, "player.ability.player.steal.name" },

 { "player", PF_SHIELD_BASH, "player.ability.player.shield_bash.name" },

 { "player", PF_EVIL, "player.ability.player.evil.name" },

 { "player", PF_COMBAT_REGEN, "player.ability.player.combat_regen.name" },

 { "object", OF_SUST_STR, "player.ability.object.sust_str.name" },

 { "object", OF_SUST_INT, "player.ability.object.sust_int.name" },

 { "object", OF_SUST_WIS, "player.ability.object.sust_wis.name" },

 { "object", OF_SUST_DEX, "player.ability.object.sust_dex.name" },

 { "object", OF_SUST_CON, "player.ability.object.sust_con.name" },

 { "object", OF_PROT_FEAR, "player.ability.object.prot_fear.name" },

 { "object", OF_PROT_BLIND, "player.ability.object.prot_blind.name" },

 { "object", OF_PROT_CONF, "player.ability.object.prot_conf.name" },

 { "object", OF_PROT_STUN, "player.ability.object.prot_stun.name" },

 { "object", OF_SLOW_DIGEST, "player.ability.object.slow_digest.name" },

 { "object", OF_FEATHER, "player.ability.object.feather.name" },

 { "object", OF_REGEN, "player.ability.object.regen.name" },

 { "object", OF_TELEPATHY, "player.ability.object.telepathy.name" },

 { "object", OF_SEE_INVIS, "player.ability.object.see_invis.name" },

 { "object", OF_FREE_ACT, "player.ability.object.free_act.name" },

 { "object", OF_HOLD_LIFE, "player.ability.object.hold_life.name" },

 { "object", OF_IMPACT, "player.ability.object.impact.name" },

 { "object", OF_IMPAIR_HP, "player.ability.object.impair_hp.name" },

 { "object", OF_IMPAIR_MANA, "player.ability.object.impair_mana.name" },

 { "object", OF_AFRAID, "player.ability.object.afraid.name" },

 { "object", OF_NO_TELEPORT, "player.ability.object.no_teleport.name" },

 { "object", OF_AGGRAVATE, "player.ability.object.aggravate.name" },

 { "object", OF_DRAIN_EXP, "player.ability.object.drain_exp.name" },

 { "object", OF_TRAP_IMMUNE, "player.ability.object.trap_immune.name" },

};
static const char *const ui_element_ids[] = {

 [ELEM_ACID] = "element.acid.name",

 [ELEM_ELEC] = "element.elec.name",

 [ELEM_FIRE] = "element.fire.name",

 [ELEM_COLD] = "element.cold.name",

 [ELEM_POIS] = "element.pois.name",

 [ELEM_LIGHT] = "element.light.name",

 [ELEM_DARK] = "element.dark.name",

 [ELEM_SOUND] = "element.sound.name",

 [ELEM_SHARD] = "element.shard.name",

 [ELEM_NEXUS] = "element.nexus.name",

 [ELEM_NETHER] = "element.nether.name",

 [ELEM_CHAOS] = "element.chaos.name",

 [ELEM_DISEN] = "element.disen.name",

 [ELEM_WATER] = "element.water.name",

 [ELEM_ICE] = "element.ice.name",

 [ELEM_GRAVITY] = "element.gravity.name",

 [ELEM_INERTIA] = "element.inertia.name",

 [ELEM_FORCE] = "element.force.name",

 [ELEM_TIME] = "element.time.name",

 [ELEM_PLASMA] = "element.plasma.name",

 [ELEM_METEOR] = "element.meteor.name",

 [ELEM_MISSILE] = "element.missile.name",

 [ELEM_MANA] = "element.mana.name",

 [ELEM_HOLY_ORB] = "element.holy_orb.name",

 [ELEM_ARROW] = "element.arrow.name",

};

void ab_ui_ability(const char *widget,const struct player_ability *ability) {
 struct ab_ui_param arg;size_t i;
 if(!ability)return;
 if(!strcmp(ability->type,"element")) {
  const char *id=NULL;struct ab_ui_param element;
  if((size_t)ability->index>=N_ELEMENTS(ui_element_ids))return;
  element=AB_UI_REF("element",ui_element_ids[ability->index]);
  if(ability->value==1)id="player.ability.element.resistance.name";
  else if(ability->value==3)id="player.ability.element.immunity.name";
  else if(ability->value==-1)id="player.ability.element.vulnerability.name";
  if(!id || !element.text)return;
  arg=AB_UI_NESTED("ability",id,&element,1);
  ab_ui_emit(NULL,widget,"birth.ability.line",&arg,1);
 } else {
  for(i=0;i<N_ELEMENTS(ui_ability_ids);i++) {
   if(!strcmp(ability->type,ui_ability_ids[i].type) && ability->index==ui_ability_ids[i].index) {
    arg=AB_UI_REF("ability",ui_ability_ids[i].id);
    ab_ui_emit(NULL,widget,"birth.ability.line",&arg,1);return;
   }
  }
 }
}
/* Preparation performs no host callback. JSON owns every parameter before a
 * native event flush, More wait, descriptor reuse, deletion or locale change. */
#define AB_CHECK_MAX_BYTES (16U*1024U)
static struct { char *json; size_t length; const char *prompt; bool priced; int32_t price; } ui_pending_check;
static struct { const char *prompt,*id,*action; } ui_pending_verify;
static struct ab_naming_snapshot ui_check_object;
void ab_ui_check_discard(void) {
 free(ui_pending_check.json);memset(&ui_pending_check,0,sizeof(ui_pending_check));
 ab_naming_snapshot_release(&ui_check_object);
 memset(&ui_pending_verify,0,sizeof(ui_pending_verify));
}
static void check_reference_begin(struct ab_semantic_event *event,const char *id) {
 memset(event,0,sizeof(*event));event->valid=id!=NULL;
 ab_semantic_json_literal(event,"{\"id\":");ab_semantic_json_string(event,id);
 ab_semantic_json_literal(event,",\"params\":{");
}
static void check_reference_finish(struct ab_semantic_event *event) {
 ab_semantic_json_literal(event,"}}");ab_ui_check_discard();
 if(event->valid && !event->parameter_open && event->length<=AB_CHECK_MAX_BYTES) {
  ui_pending_check.json=event->data;ui_pending_check.length=event->length;event->data=NULL;
 }
 ab_semantic_event_discard(event);
}
const char *ab_ui_check_parameters(const char *id,const struct ab_ui_param *params,size_t count,const char *prompt) {
 struct ab_semantic_event event;check_reference_begin(&event,id);
 if(count>16 || (count && !params))event.valid=false;
 else ui_parameters(&event,params,count,0);
 check_reference_finish(&event);ui_pending_check.prompt=prompt;return prompt;
}
const char *ab_ui_check_source(const char *id,const char *prompt) {return ab_ui_check_parameters(id,NULL,0,prompt);}
static void check_object(const char *id,const char *buffer,const char *action) {
 struct ab_semantic_event event;struct ab_naming_snapshot snapshot={0};
 ab_naming_copy_object_snapshot(&snapshot,buffer);check_reference_begin(&event,id);
 ab_naming_param_snapshot(&event,"object","KnownObjectDescription",&snapshot);
 if(action){ab_semantic_param_begin(&event,"action","localized_text");ab_semantic_json_string(&event,action);ab_semantic_param_end(&event);}
 ab_naming_snapshot_release(&snapshot);check_reference_finish(&event);
}
void ab_ui_check_object_prepare(const char *id,const char *buffer) {check_object(id,buffer,NULL);}
void ab_ui_check_object_capture(const char *buffer) {
 ab_ui_check_discard();ab_naming_copy_object_snapshot(&ui_check_object,buffer);
}
const char *ab_ui_check_object_select(const char *id,const char *token) {
 struct ab_semantic_event event;bool priced=ui_pending_check.priced;int32_t price=ui_pending_check.price;
 check_reference_begin(&event,id);ab_naming_param_snapshot(&event,"object","KnownObjectDescription",&ui_check_object);
 check_reference_finish(&event);ui_pending_check.priced=priced;ui_pending_check.price=price;return token;
}
const char *ab_ui_check_prompt(const char *prompt) {ui_pending_check.prompt=prompt;return prompt;}
void ab_ui_check_verify_source(const char *id,const char *prompt) {
 ab_ui_check_discard();ui_pending_verify.prompt=prompt;ui_pending_verify.id=id;
}
void ab_ui_check_verify_command(int command,const char *verb,const char *prompt) {
 size_t i;const char *id=NULL;
 for(i=0;i<N_ELEMENTS(ab_check_commands);i++)if(ab_check_commands[i].command==command){
  /* Verify the immutable field selected by the original cmd_verb call. */
  if(verb && !strcmp(verb,ab_check_commands[i].lexeme))id=ab_check_commands[i].id;
  break;
 }
 if(i==N_ELEMENTS(ab_check_commands) && verb && !strcmp(verb,"do that with"))id="interface.check.command.unknown";
 ab_ui_check_discard();ui_pending_verify.prompt=prompt;ui_pending_verify.id="interface.check.object.action";ui_pending_verify.action=id;
}
void ab_ui_check_verify_object(const char *prompt,const char *buffer) {
 const char *id=ui_pending_verify.prompt==prompt?ui_pending_verify.id:NULL;
 const char *action=ui_pending_verify.prompt==prompt?ui_pending_verify.action:NULL;
 if(id && !strcmp(id,"interface.check.object.action") && !action)id=NULL;
 check_object(id,buffer,action);
}
void ab_ui_check_price(int32_t price) {ui_pending_check.priced=true;ui_pending_check.price=price;}
static void check_action(const char *name,const char *id,int32_t key) {
 char widget[64];struct ab_semantic_event event;
 strnfmt(widget,sizeof(widget),"action.%s.label",name);ab_ui_static(NULL,widget,id);
 strnfmt(widget,sizeof(widget),"__action:%s",name);ab_semantic_event_begin(&event,"","ui","confirmation",widget,0,-1);
 ab_semantic_param_begin(&event,"activation_key","integer");ab_semantic_json_int32(&event,key);ab_semantic_param_end(&event);
 ab_semantic_event_emit_control(&event);
}
void ab_ui_check_begin(const char *prompt,bool store_policy) {
 if(ui_depth>=N_ELEMENTS(ui_scopes))quit("Confirmation presentation scope capacity exceeded");
 struct ab_semantic_event event;
 char *owned=ui_pending_check.json;
 char *reference=ui_pending_check.prompt==prompt?owned:NULL;
 bool priced=reference && ui_pending_check.priced;int32_t price=ui_pending_check.price;
 /* Detach and consume before the first callback can open another check. */
 ui_pending_check.json=NULL;ab_ui_check_discard();if(!reference)free(owned);
 ab_ui_scope_begin("confirmation",true);
 if(reference){
  ab_semantic_event_begin(&event,store_policy?"interface.check.store.confirm":"interface.check.confirm","ui","confirmation","prompt",0,-1);
  ab_semantic_param_begin(&event,"prompt","localized_text");ab_semantic_json_literal(&event,reference);ab_semantic_param_end(&event);
  free(reference);ab_semantic_event_emit(&event);
 }else ui_dispatch(NULL,"__unsupported:prompt","",NULL,0,true);
 if(priced){struct ab_ui_param p=AB_UI_INT("price",price);ab_ui_emit(NULL,"price","interface.check.store.price",&p,1);}
 check_action("yes",store_policy?"interface.check.store.accept":"interface.check.yes",'y');
 check_action("no",store_policy?"interface.check.store.cancel":"interface.check.no",store_policy?ESCAPE:'n');
}
void ab_ui_check_end(void) {if(!ab_ui_in("confirmation"))quit("Unpaired confirmation presentation scope");ab_ui_scope_end();ab_ui_reset("confirmation");}
void ab_ui_input(const char *widget,const char *text,const char *type) {
 char key[128];struct ab_ui_param p=AB_UI_OPAQUE("text",type,text);
 strnfmt(key,sizeof(key),"__input:%s",widget);ui_dispatch(NULL,key,"",&p,1,true);
}
void ab_ui_leave_birth(void) {
 static const char *const scopes[] = {"birth","birth-menu","birth-race-help","birth-class-help","birth-options","name-editor","history-editor","character"};
 size_t i;for(i=0;i<N_ELEMENTS(scopes);i++)ab_ui_reset(scopes[i]);
 ab_ui_check_discard();
}
void ab_ui_sidebar_stat(int stat,int value,bool drained,bool compact) {
 char label[64],number[64];
 if(!ab_ui_in("sidebar"))return;
 strnfmt(label,sizeof(label),"stat.%d.label",stat);
 strnfmt(number,sizeof(number),"stat.%d.value",stat);
 ab_ui_static(NULL,label,ab_ui_stat_id(stat,drained,compact));
 ab_ui_stat_value(number,value);
}
void ab_ui_sidebar_level(int level,bool drained,bool compact) {
 const char *id=compact?(drained?"ui.topbar.level.drained.label":"ui.topbar.level.healthy.label"):(drained?"ui.sidebar.level.drained.label":"ui.sidebar.level.healthy.label");
 if(!ab_ui_in("sidebar"))return;
 ab_ui_static(NULL,"level.label",id);ab_ui_number("level",level);
}
void ab_ui_sidebar_experience(int32_t xp,bool current,bool drained,bool compact) {
 const char *id;
 if(!ab_ui_in("sidebar"))return;
 if(compact)id=current?(drained?"ui.topbar.experience.current.drained.label":"ui.topbar.experience.current.healthy.label"):(drained?"ui.topbar.experience.remaining.drained.label":"ui.topbar.experience.remaining.healthy.label");
 else id=current?(drained?"ui.sidebar.experience.current.drained.label":"ui.sidebar.experience.current.healthy.label"):(drained?"ui.sidebar.experience.remaining.drained.label":"ui.sidebar.experience.remaining.healthy.label");
 ab_ui_static(NULL,"experience.label",id);ab_ui_number("experience",xp);
}
void ab_ui_sidebar_resource(bool spell,int current,int maximum,bool compact) {
 const char *slot=spell?"sp.value":"hp.value";struct ab_ui_param p[2]={AB_UI_INT("current",current),AB_UI_INT("maximum",maximum)};
 const char *id=compact?(spell?"ui.topbar.spell_points.label":"ui.topbar.hit_points.label"):(spell?"ui.sidebar.spell_points.label":"ui.sidebar.hit_points.label");
 if(!ab_ui_in("sidebar"))return;
 ab_ui_static(NULL,spell?"sp.label":"hp.label",id);
 ab_ui_emit(NULL,slot,"player.sheet.resource.value",p,2);
}
void ab_ui_sidebar_hide(int slot) {
 static const char *const widgets[]={"race","title","class","level","experience","gold",NULL,"stat.0","stat.1","stat.2","stat.3","stat.4",NULL,"armor","hp","sp",NULL,NULL,NULL,NULL,"speed","depth"};
 if(slot>=0 && (size_t)slot<N_ELEMENTS(widgets) && widgets[slot])ab_ui_clear(widgets[slot]);
}
struct ui_option_id { int option;const char *id; };
static const struct ui_option_id ui_option_ids[] = {
 { OPT_birth_randarts, "birth.options.randarts.description" },
 { OPT_birth_connect_stairs, "birth.options.connect_stairs.description" },
 { OPT_birth_force_descend, "birth.options.force_descend.description" },
 { OPT_birth_no_recall, "birth.options.no_recall.description" },
 { OPT_birth_no_artifacts, "birth.options.no_artifacts.description" },
 { OPT_birth_stacking, "birth.options.stacking.description" },
 { OPT_birth_lose_arts, "birth.options.lose_arts.description" },
 { OPT_birth_feelings, "birth.options.feelings.description" },
 { OPT_birth_no_selling, "birth.options.no_selling.description" },
 { OPT_birth_start_kit, "birth.options.start_kit.description" },
 { OPT_birth_ai_learn, "birth.options.ai_learn.description" },
 { OPT_birth_know_runes, "birth.options.know_runes.description" },
 { OPT_birth_know_flavors, "birth.options.know_flavors.description" },
 { OPT_birth_levels_persist, "birth.options.levels_persist.description" },
 { OPT_birth_percent_damage, "birth.options.percent_damage.description" },
};
const char *ab_ui_option_id(int option) { size_t i;for(i=0;i<N_ELEMENTS(ui_option_ids);i++)if(ui_option_ids[i].option==option)return ui_option_ids[i].id;return NULL; }
#endif /* __EMSCRIPTEN__ */

#ifdef __EMSCRIPTEN__
void ab_ui_scope_begin_required(const char *context,bool replace) {
 if(ui_depth>=N_ELEMENTS(ui_scopes))quit("Browser presentation scope capacity exceeded");
 ab_ui_scope_begin(context,replace);
}
#endif
