/* SPDX-License-Identifier: GPL-2.0-only */
/* Pinned canonical display bindings; no parser strings or rendered-English lookup. */
#include "web-spell-text.h"
#ifdef __EMSCRIPTEN__
#include "angband.h"
#include "player.h"
#include "web-semantic.h"
#include <stdio.h>

struct ab_book_binding { unsigned cidx; int bidx; const char *name_id; };
struct ab_spell_binding {
 unsigned cidx; int bidx, sidx; const char *name_id, *description_id;
};
static const struct ab_book_binding ab_books[] = {
 { 1, 0, "angband.player_class.mage.book.first_spells.name" },
 { 1, 1, "angband.player_class.mage.book.attacks_and_knowledge.name" },
 { 1, 2, "angband.player_class.mage.book.magical_defences.name" },
 { 1, 3, "angband.player_class.mage.book.arcane_control.name" },
 { 1, 4, "angband.player_class.mage.book.wizards_tome_of_power.name" },
 { 2, 0, "angband.player_class.druid.book.lesser_charms.name" },
 { 2, 1, "angband.player_class.druid.book.gifts_of_nature.name" },
 { 2, 2, "angband.player_class.druid.book.creature_dominion.name" },
 { 2, 3, "angband.player_class.druid.book.nature_craft.name" },
 { 2, 4, "angband.player_class.druid.book.wild_forces.name" },
 { 3, 0, "angband.player_class.priest.book.novices_handbook.name" },
 { 3, 1, "angband.player_class.priest.book.cleansing_power.name" },
 { 3, 2, "angband.player_class.priest.book.healing_and_sanctuary.name" },
 { 3, 3, "angband.player_class.priest.book.battle_blessings.name" },
 { 3, 4, "angband.player_class.priest.book.wrath_of_the_valar.name" },
 { 4, 0, "angband.player_class.necromancer.book.into_the_shadows.name" },
 { 4, 1, "angband.player_class.necromancer.book.dark_rituals.name" },
 { 4, 2, "angband.player_class.necromancer.book.fear_and_torment.name" },
 { 4, 3, "angband.player_class.necromancer.book.deadly_powers.name" },
 { 4, 4, "angband.player_class.necromancer.book.corruption_of_spirit.name" },
 { 5, 0, "angband.player_class.paladin.book.novices_handbook.name" },
 { 5, 1, "angband.player_class.paladin.book.healing_and_sanctuary.name" },
 { 5, 2, "angband.player_class.paladin.book.battle_blessings.name" },
 { 6, 0, "angband.player_class.rogue.book.first_spells.name" },
 { 6, 1, "angband.player_class.rogue.book.arcane_control.name" },
 { 7, 0, "angband.player_class.ranger.book.lesser_charms.name" },
 { 7, 1, "angband.player_class.ranger.book.nature_craft.name" },
 { 8, 0, "angband.player_class.blackguard.book.into_the_shadows.name" },
 { 8, 1, "angband.player_class.blackguard.book.fear_and_torment.name" },
 { 8, 2, "angband.player_class.blackguard.book.deadly_powers.name" },
};
static const struct ab_spell_binding ab_spells[] = {
 { 1, 0, 0, "angband.player_class.mage.book.first_spells.spell.magic_missile.name", "angband.player_class.mage.book.first_spells.spell.magic_missile.description" },
 { 1, 0, 1, "angband.player_class.mage.book.first_spells.spell.light_room.name", "angband.player_class.mage.book.first_spells.spell.light_room.description" },
 { 1, 0, 2, "angband.player_class.mage.book.first_spells.spell.find_traps_doors_stairs.name", "angband.player_class.mage.book.first_spells.spell.find_traps_doors_stairs.description" },
 { 1, 0, 3, "angband.player_class.mage.book.first_spells.spell.phase_door.name", "angband.player_class.mage.book.first_spells.spell.phase_door.description" },
 { 1, 0, 4, "angband.player_class.mage.book.first_spells.spell.electric_arc.name", "angband.player_class.mage.book.first_spells.spell.electric_arc.description" },
 { 1, 0, 5, "angband.player_class.mage.book.first_spells.spell.detect_monsters.name", "angband.player_class.mage.book.first_spells.spell.detect_monsters.description" },
 { 1, 0, 6, "angband.player_class.mage.book.first_spells.spell.fire_ball.name", "angband.player_class.mage.book.first_spells.spell.fire_ball.description" },
 { 1, 1, 7, "angband.player_class.mage.book.attacks_and_knowledge.spell.recharging.name", "angband.player_class.mage.book.attacks_and_knowledge.spell.recharging.description" },
 { 1, 1, 8, "angband.player_class.mage.book.attacks_and_knowledge.spell.identify_rune.name", "angband.player_class.mage.book.attacks_and_knowledge.spell.identify_rune.description" },
 { 1, 1, 9, "angband.player_class.mage.book.attacks_and_knowledge.spell.treasure_detection.name", "angband.player_class.mage.book.attacks_and_knowledge.spell.treasure_detection.description" },
 { 1, 1, 10, "angband.player_class.mage.book.attacks_and_knowledge.spell.frost_bolt.name", "angband.player_class.mage.book.attacks_and_knowledge.spell.frost_bolt.description" },
 { 1, 1, 11, "angband.player_class.mage.book.attacks_and_knowledge.spell.reveal_monsters.name", "angband.player_class.mage.book.attacks_and_knowledge.spell.reveal_monsters.description" },
 { 1, 1, 12, "angband.player_class.mage.book.attacks_and_knowledge.spell.acid_spray.name", "angband.player_class.mage.book.attacks_and_knowledge.spell.acid_spray.description" },
 { 1, 2, 13, "angband.player_class.mage.book.magical_defences.spell.disable_traps_destroy_doors.name", "angband.player_class.mage.book.magical_defences.spell.disable_traps_destroy_doors.description" },
 { 1, 2, 14, "angband.player_class.mage.book.magical_defences.spell.teleport_self.name", "angband.player_class.mage.book.magical_defences.spell.teleport_self.description" },
 { 1, 2, 15, "angband.player_class.mage.book.magical_defences.spell.teleport_other.name", "angband.player_class.mage.book.magical_defences.spell.teleport_other.description" },
 { 1, 2, 16, "angband.player_class.mage.book.magical_defences.spell.resistance.name", "angband.player_class.mage.book.magical_defences.spell.resistance.description" },
 { 1, 2, 17, "angband.player_class.mage.book.magical_defences.spell.tap_magical_energy.name", "angband.player_class.mage.book.magical_defences.spell.tap_magical_energy.description" },
 { 1, 2, 18, "angband.player_class.mage.book.magical_defences.spell.mana_channel.name", "angband.player_class.mage.book.magical_defences.spell.mana_channel.description" },
 { 1, 3, 19, "angband.player_class.mage.book.arcane_control.spell.door_creation.name", "angband.player_class.mage.book.arcane_control.spell.door_creation.description" },
 { 1, 3, 20, "angband.player_class.mage.book.arcane_control.spell.mana_bolt.name", "angband.player_class.mage.book.arcane_control.spell.mana_bolt.description" },
 { 1, 3, 21, "angband.player_class.mage.book.arcane_control.spell.teleport_level.name", "angband.player_class.mage.book.arcane_control.spell.teleport_level.description" },
 { 1, 3, 22, "angband.player_class.mage.book.arcane_control.spell.detection.name", "angband.player_class.mage.book.arcane_control.spell.detection.description" },
 { 1, 3, 23, "angband.player_class.mage.book.arcane_control.spell.dimension_door.name", "angband.player_class.mage.book.arcane_control.spell.dimension_door.description" },
 { 1, 3, 24, "angband.player_class.mage.book.arcane_control.spell.thrust_away.name", "angband.player_class.mage.book.arcane_control.spell.thrust_away.description" },
 { 1, 4, 25, "angband.player_class.mage.book.wizards_tome_of_power.spell.shock_wave.name", "angband.player_class.mage.book.wizards_tome_of_power.spell.shock_wave.description" },
 { 1, 4, 26, "angband.player_class.mage.book.wizards_tome_of_power.spell.explosion.name", "angband.player_class.mage.book.wizards_tome_of_power.spell.explosion.description" },
 { 1, 4, 27, "angband.player_class.mage.book.wizards_tome_of_power.spell.banishment.name", "angband.player_class.mage.book.wizards_tome_of_power.spell.banishment.description" },
 { 1, 4, 28, "angband.player_class.mage.book.wizards_tome_of_power.spell.mass_banishment.name", "angband.player_class.mage.book.wizards_tome_of_power.spell.mass_banishment.description" },
 { 1, 4, 29, "angband.player_class.mage.book.wizards_tome_of_power.spell.mana_storm.name", "angband.player_class.mage.book.wizards_tome_of_power.spell.mana_storm.description" },
 { 2, 0, 0, "angband.player_class.druid.book.lesser_charms.spell.detect_life.name", "angband.player_class.druid.book.lesser_charms.spell.detect_life.description" },
 { 2, 0, 1, "angband.player_class.druid.book.lesser_charms.spell.fox_form.name", "angband.player_class.druid.book.lesser_charms.spell.fox_form.description" },
 { 2, 0, 2, "angband.player_class.druid.book.lesser_charms.spell.remove_hunger.name", "angband.player_class.druid.book.lesser_charms.spell.remove_hunger.description" },
 { 2, 0, 3, "angband.player_class.druid.book.lesser_charms.spell.stinking_cloud.name", "angband.player_class.druid.book.lesser_charms.spell.stinking_cloud.description" },
 { 2, 0, 4, "angband.player_class.druid.book.lesser_charms.spell.confuse_monster.name", "angband.player_class.druid.book.lesser_charms.spell.confuse_monster.description" },
 { 2, 0, 5, "angband.player_class.druid.book.lesser_charms.spell.slow_monster.name", "angband.player_class.druid.book.lesser_charms.spell.slow_monster.description" },
 { 2, 1, 6, "angband.player_class.druid.book.gifts_of_nature.spell.cure_poison.name", "angband.player_class.druid.book.gifts_of_nature.spell.cure_poison.description" },
 { 2, 1, 7, "angband.player_class.druid.book.gifts_of_nature.spell.resist_poison.name", "angband.player_class.druid.book.gifts_of_nature.spell.resist_poison.description" },
 { 2, 1, 8, "angband.player_class.druid.book.gifts_of_nature.spell.turn_stone_to_mud.name", "angband.player_class.druid.book.gifts_of_nature.spell.turn_stone_to_mud.description" },
 { 2, 1, 9, "angband.player_class.druid.book.gifts_of_nature.spell.sense_surroundings.name", "angband.player_class.druid.book.gifts_of_nature.spell.sense_surroundings.description" },
 { 2, 1, 10, "angband.player_class.druid.book.gifts_of_nature.spell.lightning_strike.name", "angband.player_class.druid.book.gifts_of_nature.spell.lightning_strike.description" },
 { 2, 1, 11, "angband.player_class.druid.book.gifts_of_nature.spell.earth_rising.name", "angband.player_class.druid.book.gifts_of_nature.spell.earth_rising.description" },
 { 2, 2, 12, "angband.player_class.druid.book.creature_dominion.spell.trance.name", "angband.player_class.druid.book.creature_dominion.spell.trance.description" },
 { 2, 2, 13, "angband.player_class.druid.book.creature_dominion.spell.mass_sleep.name", "angband.player_class.druid.book.creature_dominion.spell.mass_sleep.description" },
 { 2, 2, 14, "angband.player_class.druid.book.creature_dominion.spell.become_pukel_man.name", "angband.player_class.druid.book.creature_dominion.spell.become_pukel_man.description" },
 { 2, 2, 15, "angband.player_class.druid.book.creature_dominion.spell.eagles_flight.name", "angband.player_class.druid.book.creature_dominion.spell.eagles_flight.description" },
 { 2, 2, 16, "angband.player_class.druid.book.creature_dominion.spell.bear_form.name", "angband.player_class.druid.book.creature_dominion.spell.bear_form.description" },
 { 2, 3, 17, "angband.player_class.druid.book.nature_craft.spell.tremor.name", "angband.player_class.druid.book.nature_craft.spell.tremor.description" },
 { 2, 3, 18, "angband.player_class.druid.book.nature_craft.spell.haste_self.name", "angband.player_class.druid.book.nature_craft.spell.haste_self.description" },
 { 2, 3, 19, "angband.player_class.druid.book.nature_craft.spell.revitalize.name", "angband.player_class.druid.book.nature_craft.spell.revitalize.description" },
 { 2, 3, 20, "angband.player_class.druid.book.nature_craft.spell.rapid_regeneration.name", "angband.player_class.druid.book.nature_craft.spell.rapid_regeneration.description" },
 { 2, 3, 21, "angband.player_class.druid.book.nature_craft.spell.herbal_curing.name", "angband.player_class.druid.book.nature_craft.spell.herbal_curing.description" },
 { 2, 4, 22, "angband.player_class.druid.book.wild_forces.spell.meteor_swarm.name", "angband.player_class.druid.book.wild_forces.spell.meteor_swarm.description" },
 { 2, 4, 23, "angband.player_class.druid.book.wild_forces.spell.rift.name", "angband.player_class.druid.book.wild_forces.spell.rift.description" },
 { 2, 4, 24, "angband.player_class.druid.book.wild_forces.spell.ice_storm.name", "angband.player_class.druid.book.wild_forces.spell.ice_storm.description" },
 { 2, 4, 25, "angband.player_class.druid.book.wild_forces.spell.volcanic_eruption.name", "angband.player_class.druid.book.wild_forces.spell.volcanic_eruption.description" },
 { 2, 4, 26, "angband.player_class.druid.book.wild_forces.spell.river_of_lightning.name", "angband.player_class.druid.book.wild_forces.spell.river_of_lightning.description" },
 { 3, 0, 0, "angband.player_class.priest.book.novices_handbook.spell.call_light.name", "angband.player_class.priest.book.novices_handbook.spell.call_light.description" },
 { 3, 0, 1, "angband.player_class.priest.book.novices_handbook.spell.detect_evil.name", "angband.player_class.priest.book.novices_handbook.spell.detect_evil.description" },
 { 3, 0, 2, "angband.player_class.priest.book.novices_handbook.spell.minor_healing.name", "angband.player_class.priest.book.novices_handbook.spell.minor_healing.description" },
 { 3, 0, 3, "angband.player_class.priest.book.novices_handbook.spell.bless.name", "angband.player_class.priest.book.novices_handbook.spell.bless.description" },
 { 3, 0, 4, "angband.player_class.priest.book.novices_handbook.spell.sense_invisible.name", "angband.player_class.priest.book.novices_handbook.spell.sense_invisible.description" },
 { 3, 0, 5, "angband.player_class.priest.book.novices_handbook.spell.heroism.name", "angband.player_class.priest.book.novices_handbook.spell.heroism.description" },
 { 3, 1, 6, "angband.player_class.priest.book.cleansing_power.spell.orb_of_draining.name", "angband.player_class.priest.book.cleansing_power.spell.orb_of_draining.description" },
 { 3, 1, 7, "angband.player_class.priest.book.cleansing_power.spell.spear_of_light.name", "angband.player_class.priest.book.cleansing_power.spell.spear_of_light.description" },
 { 3, 1, 8, "angband.player_class.priest.book.cleansing_power.spell.dispel_undead.name", "angband.player_class.priest.book.cleansing_power.spell.dispel_undead.description" },
 { 3, 1, 9, "angband.player_class.priest.book.cleansing_power.spell.dispel_evil.name", "angband.player_class.priest.book.cleansing_power.spell.dispel_evil.description" },
 { 3, 1, 10, "angband.player_class.priest.book.cleansing_power.spell.protection_from_evil.name", "angband.player_class.priest.book.cleansing_power.spell.protection_from_evil.description" },
 { 3, 1, 11, "angband.player_class.priest.book.cleansing_power.spell.remove_curse.name", "angband.player_class.priest.book.cleansing_power.spell.remove_curse.description" },
 { 3, 2, 12, "angband.player_class.priest.book.healing_and_sanctuary.spell.portal.name", "angband.player_class.priest.book.healing_and_sanctuary.spell.portal.description" },
 { 3, 2, 13, "angband.player_class.priest.book.healing_and_sanctuary.spell.remembrance.name", "angband.player_class.priest.book.healing_and_sanctuary.spell.remembrance.description" },
 { 3, 2, 14, "angband.player_class.priest.book.healing_and_sanctuary.spell.word_of_recall.name", "angband.player_class.priest.book.healing_and_sanctuary.spell.word_of_recall.description" },
 { 3, 2, 15, "angband.player_class.priest.book.healing_and_sanctuary.spell.healing.name", "angband.player_class.priest.book.healing_and_sanctuary.spell.healing.description" },
 { 3, 2, 16, "angband.player_class.priest.book.healing_and_sanctuary.spell.restoration.name", "angband.player_class.priest.book.healing_and_sanctuary.spell.restoration.description" },
 { 3, 2, 17, "angband.player_class.priest.book.healing_and_sanctuary.spell.clairvoyance.name", "angband.player_class.priest.book.healing_and_sanctuary.spell.clairvoyance.description" },
 { 3, 3, 18, "angband.player_class.priest.book.battle_blessings.spell.enchant_weapon.name", "angband.player_class.priest.book.battle_blessings.spell.enchant_weapon.description" },
 { 3, 3, 19, "angband.player_class.priest.book.battle_blessings.spell.enchant_armour.name", "angband.player_class.priest.book.battle_blessings.spell.enchant_armour.description" },
 { 3, 3, 20, "angband.player_class.priest.book.battle_blessings.spell.smite_evil.name", "angband.player_class.priest.book.battle_blessings.spell.smite_evil.description" },
 { 3, 3, 21, "angband.player_class.priest.book.battle_blessings.spell.glyph_of_warding.name", "angband.player_class.priest.book.battle_blessings.spell.glyph_of_warding.description" },
 { 3, 3, 22, "angband.player_class.priest.book.battle_blessings.spell.demon_bane.name", "angband.player_class.priest.book.battle_blessings.spell.demon_bane.description" },
 { 3, 4, 23, "angband.player_class.priest.book.wrath_of_the_valar.spell.banish_evil.name", "angband.player_class.priest.book.wrath_of_the_valar.spell.banish_evil.description" },
 { 3, 4, 24, "angband.player_class.priest.book.wrath_of_the_valar.spell.word_of_destruction.name", "angband.player_class.priest.book.wrath_of_the_valar.spell.word_of_destruction.description" },
 { 3, 4, 25, "angband.player_class.priest.book.wrath_of_the_valar.spell.holy_word.name", "angband.player_class.priest.book.wrath_of_the_valar.spell.holy_word.description" },
 { 3, 4, 26, "angband.player_class.priest.book.wrath_of_the_valar.spell.spear_of_orome.name", "angband.player_class.priest.book.wrath_of_the_valar.spell.spear_of_orome.description" },
 { 3, 4, 27, "angband.player_class.priest.book.wrath_of_the_valar.spell.light_of_manwe.name", "angband.player_class.priest.book.wrath_of_the_valar.spell.light_of_manwe.description" },
 { 4, 0, 0, "angband.player_class.necromancer.book.into_the_shadows.spell.nether_bolt.name", "angband.player_class.necromancer.book.into_the_shadows.spell.nether_bolt.description" },
 { 4, 0, 1, "angband.player_class.necromancer.book.into_the_shadows.spell.sense_invisible.name", "angband.player_class.necromancer.book.into_the_shadows.spell.sense_invisible.description" },
 { 4, 0, 2, "angband.player_class.necromancer.book.into_the_shadows.spell.create_darkness.name", "angband.player_class.necromancer.book.into_the_shadows.spell.create_darkness.description" },
 { 4, 0, 3, "angband.player_class.necromancer.book.into_the_shadows.spell.bat_form.name", "angband.player_class.necromancer.book.into_the_shadows.spell.bat_form.description" },
 { 4, 0, 4, "angband.player_class.necromancer.book.into_the_shadows.spell.read_minds.name", "angband.player_class.necromancer.book.into_the_shadows.spell.read_minds.description" },
 { 4, 1, 5, "angband.player_class.necromancer.book.dark_rituals.spell.tap_unlife.name", "angband.player_class.necromancer.book.dark_rituals.spell.tap_unlife.description" },
 { 4, 1, 6, "angband.player_class.necromancer.book.dark_rituals.spell.crush.name", "angband.player_class.necromancer.book.dark_rituals.spell.crush.description" },
 { 4, 1, 7, "angband.player_class.necromancer.book.dark_rituals.spell.sleep_evil.name", "angband.player_class.necromancer.book.dark_rituals.spell.sleep_evil.description" },
 { 4, 1, 8, "angband.player_class.necromancer.book.dark_rituals.spell.shadow_shift.name", "angband.player_class.necromancer.book.dark_rituals.spell.shadow_shift.description" },
 { 4, 1, 9, "angband.player_class.necromancer.book.dark_rituals.spell.disenchant.name", "angband.player_class.necromancer.book.dark_rituals.spell.disenchant.description" },
 { 4, 2, 10, "angband.player_class.necromancer.book.fear_and_torment.spell.frighten.name", "angband.player_class.necromancer.book.fear_and_torment.spell.frighten.description" },
 { 4, 2, 11, "angband.player_class.necromancer.book.fear_and_torment.spell.vampire_strike.name", "angband.player_class.necromancer.book.fear_and_torment.spell.vampire_strike.description" },
 { 4, 2, 12, "angband.player_class.necromancer.book.fear_and_torment.spell.dispel_life.name", "angband.player_class.necromancer.book.fear_and_torment.spell.dispel_life.description" },
 { 4, 2, 13, "angband.player_class.necromancer.book.fear_and_torment.spell.dark_spear.name", "angband.player_class.necromancer.book.fear_and_torment.spell.dark_spear.description" },
 { 4, 2, 14, "angband.player_class.necromancer.book.fear_and_torment.spell.warg_form.name", "angband.player_class.necromancer.book.fear_and_torment.spell.warg_form.description" },
 { 4, 3, 15, "angband.player_class.necromancer.book.deadly_powers.spell.banish_spirits.name", "angband.player_class.necromancer.book.deadly_powers.spell.banish_spirits.description" },
 { 4, 3, 16, "angband.player_class.necromancer.book.deadly_powers.spell.annihilate.name", "angband.player_class.necromancer.book.deadly_powers.spell.annihilate.description" },
 { 4, 3, 17, "angband.player_class.necromancer.book.deadly_powers.spell.gronds_blow.name", "angband.player_class.necromancer.book.deadly_powers.spell.gronds_blow.description" },
 { 4, 3, 18, "angband.player_class.necromancer.book.deadly_powers.spell.unleash_chaos.name", "angband.player_class.necromancer.book.deadly_powers.spell.unleash_chaos.description" },
 { 4, 3, 19, "angband.player_class.necromancer.book.deadly_powers.spell.fume_of_mordor.name", "angband.player_class.necromancer.book.deadly_powers.spell.fume_of_mordor.description" },
 { 4, 3, 20, "angband.player_class.necromancer.book.deadly_powers.spell.storm_of_darkness.name", "angband.player_class.necromancer.book.deadly_powers.spell.storm_of_darkness.description" },
 { 4, 4, 21, "angband.player_class.necromancer.book.corruption_of_spirit.spell.power_sacrifice.name", "angband.player_class.necromancer.book.corruption_of_spirit.spell.power_sacrifice.description" },
 { 4, 4, 22, "angband.player_class.necromancer.book.corruption_of_spirit.spell.zone_of_unmagic.name", "angband.player_class.necromancer.book.corruption_of_spirit.spell.zone_of_unmagic.description" },
 { 4, 4, 23, "angband.player_class.necromancer.book.corruption_of_spirit.spell.vampire_form.name", "angband.player_class.necromancer.book.corruption_of_spirit.spell.vampire_form.description" },
 { 4, 4, 24, "angband.player_class.necromancer.book.corruption_of_spirit.spell.curse.name", "angband.player_class.necromancer.book.corruption_of_spirit.spell.curse.description" },
 { 4, 4, 25, "angband.player_class.necromancer.book.corruption_of_spirit.spell.command.name", "angband.player_class.necromancer.book.corruption_of_spirit.spell.command.description" },
 { 5, 0, 0, "angband.player_class.paladin.book.novices_handbook.spell.bless.name", "angband.player_class.paladin.book.novices_handbook.spell.bless.description" },
 { 5, 0, 1, "angband.player_class.paladin.book.novices_handbook.spell.detect_evil.name", "angband.player_class.paladin.book.novices_handbook.spell.detect_evil.description" },
 { 5, 0, 2, "angband.player_class.paladin.book.novices_handbook.spell.call_light.name", "angband.player_class.paladin.book.novices_handbook.spell.call_light.description" },
 { 5, 0, 3, "angband.player_class.paladin.book.novices_handbook.spell.minor_healing.name", "angband.player_class.paladin.book.novices_handbook.spell.minor_healing.description" },
 { 5, 0, 4, "angband.player_class.paladin.book.novices_handbook.spell.sense_invisible.name", "angband.player_class.paladin.book.novices_handbook.spell.sense_invisible.description" },
 { 5, 0, 5, "angband.player_class.paladin.book.novices_handbook.spell.heroism.name", "angband.player_class.paladin.book.novices_handbook.spell.heroism.description" },
 { 5, 1, 6, "angband.player_class.paladin.book.healing_and_sanctuary.spell.protection_from_evil.name", "angband.player_class.paladin.book.healing_and_sanctuary.spell.protection_from_evil.description" },
 { 5, 1, 7, "angband.player_class.paladin.book.healing_and_sanctuary.spell.remove_curse.name", "angband.player_class.paladin.book.healing_and_sanctuary.spell.remove_curse.description" },
 { 5, 1, 8, "angband.player_class.paladin.book.healing_and_sanctuary.spell.word_of_recall.name", "angband.player_class.paladin.book.healing_and_sanctuary.spell.word_of_recall.description" },
 { 5, 1, 9, "angband.player_class.paladin.book.healing_and_sanctuary.spell.healing.name", "angband.player_class.paladin.book.healing_and_sanctuary.spell.healing.description" },
 { 5, 1, 10, "angband.player_class.paladin.book.healing_and_sanctuary.spell.clairvoyance.name", "angband.player_class.paladin.book.healing_and_sanctuary.spell.clairvoyance.description" },
 { 5, 2, 11, "angband.player_class.paladin.book.battle_blessings.spell.smite_evil.name", "angband.player_class.paladin.book.battle_blessings.spell.smite_evil.description" },
 { 5, 2, 12, "angband.player_class.paladin.book.battle_blessings.spell.demon_bane.name", "angband.player_class.paladin.book.battle_blessings.spell.demon_bane.description" },
 { 5, 2, 13, "angband.player_class.paladin.book.battle_blessings.spell.enchant_weapon.name", "angband.player_class.paladin.book.battle_blessings.spell.enchant_weapon.description" },
 { 5, 2, 14, "angband.player_class.paladin.book.battle_blessings.spell.enchant_armour.name", "angband.player_class.paladin.book.battle_blessings.spell.enchant_armour.description" },
 { 5, 2, 15, "angband.player_class.paladin.book.battle_blessings.spell.single_combat.name", "angband.player_class.paladin.book.battle_blessings.spell.single_combat.description" },
 { 6, 0, 0, "angband.player_class.rogue.book.first_spells.spell.detect_monsters.name", "angband.player_class.rogue.book.first_spells.spell.detect_monsters.description" },
 { 6, 0, 1, "angband.player_class.rogue.book.first_spells.spell.phase_door.name", "angband.player_class.rogue.book.first_spells.spell.phase_door.description" },
 { 6, 0, 2, "angband.player_class.rogue.book.first_spells.spell.object_detection.name", "angband.player_class.rogue.book.first_spells.spell.object_detection.description" },
 { 6, 0, 3, "angband.player_class.rogue.book.first_spells.spell.detect_stairs.name", "angband.player_class.rogue.book.first_spells.spell.detect_stairs.description" },
 { 6, 0, 4, "angband.player_class.rogue.book.first_spells.spell.recharging.name", "angband.player_class.rogue.book.first_spells.spell.recharging.description" },
 { 6, 0, 5, "angband.player_class.rogue.book.first_spells.spell.reveal_monsters.name", "angband.player_class.rogue.book.first_spells.spell.reveal_monsters.description" },
 { 6, 1, 6, "angband.player_class.rogue.book.arcane_control.spell.teleport_self.name", "angband.player_class.rogue.book.arcane_control.spell.teleport_self.description" },
 { 6, 1, 7, "angband.player_class.rogue.book.arcane_control.spell.hit_and_run.name", "angband.player_class.rogue.book.arcane_control.spell.hit_and_run.description" },
 { 6, 1, 8, "angband.player_class.rogue.book.arcane_control.spell.teleport_other.name", "angband.player_class.rogue.book.arcane_control.spell.teleport_other.description" },
 { 6, 1, 9, "angband.player_class.rogue.book.arcane_control.spell.teleport_level.name", "angband.player_class.rogue.book.arcane_control.spell.teleport_level.description" },
 { 7, 0, 0, "angband.player_class.ranger.book.lesser_charms.spell.remove_hunger.name", "angband.player_class.ranger.book.lesser_charms.spell.remove_hunger.description" },
 { 7, 0, 1, "angband.player_class.ranger.book.lesser_charms.spell.detect_life.name", "angband.player_class.ranger.book.lesser_charms.spell.detect_life.description" },
 { 7, 0, 2, "angband.player_class.ranger.book.lesser_charms.spell.herbal_curing.name", "angband.player_class.ranger.book.lesser_charms.spell.herbal_curing.description" },
 { 7, 0, 3, "angband.player_class.ranger.book.lesser_charms.spell.resist_poison.name", "angband.player_class.ranger.book.lesser_charms.spell.resist_poison.description" },
 { 7, 0, 4, "angband.player_class.ranger.book.lesser_charms.spell.turn_stone_to_mud.name", "angband.player_class.ranger.book.lesser_charms.spell.turn_stone_to_mud.description" },
 { 7, 0, 5, "angband.player_class.ranger.book.lesser_charms.spell.sense_surroundings.name", "angband.player_class.ranger.book.lesser_charms.spell.sense_surroundings.description" },
 { 7, 1, 6, "angband.player_class.ranger.book.nature_craft.spell.cover_tracks.name", "angband.player_class.ranger.book.nature_craft.spell.cover_tracks.description" },
 { 7, 1, 7, "angband.player_class.ranger.book.nature_craft.spell.create_arrows.name", "angband.player_class.ranger.book.nature_craft.spell.create_arrows.description" },
 { 7, 1, 8, "angband.player_class.ranger.book.nature_craft.spell.haste_self.name", "angband.player_class.ranger.book.nature_craft.spell.haste_self.description" },
 { 7, 1, 9, "angband.player_class.ranger.book.nature_craft.spell.decoy.name", "angband.player_class.ranger.book.nature_craft.spell.decoy.description" },
 { 7, 1, 10, "angband.player_class.ranger.book.nature_craft.spell.brand_ammunition.name", "angband.player_class.ranger.book.nature_craft.spell.brand_ammunition.description" },
 { 8, 0, 0, "angband.player_class.blackguard.book.into_the_shadows.spell.seek_battle.name", "angband.player_class.blackguard.book.into_the_shadows.spell.seek_battle.description" },
 { 8, 0, 1, "angband.player_class.blackguard.book.into_the_shadows.spell.berserk_strength.name", "angband.player_class.blackguard.book.into_the_shadows.spell.berserk_strength.description" },
 { 8, 0, 2, "angband.player_class.blackguard.book.into_the_shadows.spell.whirlwind_attack.name", "angband.player_class.blackguard.book.into_the_shadows.spell.whirlwind_attack.description" },
 { 8, 0, 3, "angband.player_class.blackguard.book.into_the_shadows.spell.shatter_stone.name", "angband.player_class.blackguard.book.into_the_shadows.spell.shatter_stone.description" },
 { 8, 0, 4, "angband.player_class.blackguard.book.into_the_shadows.spell.leap_into_battle.name", "angband.player_class.blackguard.book.into_the_shadows.spell.leap_into_battle.description" },
 { 8, 0, 5, "angband.player_class.blackguard.book.into_the_shadows.spell.grim_purpose.name", "angband.player_class.blackguard.book.into_the_shadows.spell.grim_purpose.description" },
 { 8, 1, 6, "angband.player_class.blackguard.book.fear_and_torment.spell.maim_foe.name", "angband.player_class.blackguard.book.fear_and_torment.spell.maim_foe.description" },
 { 8, 1, 7, "angband.player_class.blackguard.book.fear_and_torment.spell.howl_of_the_damned.name", "angband.player_class.blackguard.book.fear_and_torment.spell.howl_of_the_damned.description" },
 { 8, 1, 8, "angband.player_class.blackguard.book.fear_and_torment.spell.relentless_taunting.name", "angband.player_class.blackguard.book.fear_and_torment.spell.relentless_taunting.description" },
 { 8, 1, 9, "angband.player_class.blackguard.book.fear_and_torment.spell.venom.name", "angband.player_class.blackguard.book.fear_and_torment.spell.venom.description" },
 { 8, 1, 10, "angband.player_class.blackguard.book.fear_and_torment.spell.werewolf_form.name", "angband.player_class.blackguard.book.fear_and_torment.spell.werewolf_form.description" },
 { 8, 2, 11, "angband.player_class.blackguard.book.deadly_powers.spell.bloodlust.name", "angband.player_class.blackguard.book.deadly_powers.spell.bloodlust.description" },
 { 8, 2, 12, "angband.player_class.blackguard.book.deadly_powers.spell.unholy_reprieve.name", "angband.player_class.blackguard.book.deadly_powers.spell.unholy_reprieve.description" },
 { 8, 2, 13, "angband.player_class.blackguard.book.deadly_powers.spell.forceful_blow.name", "angband.player_class.blackguard.book.deadly_powers.spell.forceful_blow.description" },
 { 8, 2, 14, "angband.player_class.blackguard.book.deadly_powers.spell.quake.name", "angband.player_class.blackguard.book.deadly_powers.spell.quake.description" },
};

/* Scope and slots are independent of terminal redraws and formatted output. */
static void ab_spell_control(const char *widget)
{
 struct ab_semantic_event event;
 ab_semantic_event_begin(&event, "", "ui", "spells", widget, 0, -1);
 ab_semantic_event_emit_control(&event);
}

static void ab_spell_text(const char *widget, const char *id)
{
 struct ab_semantic_event event;
 ab_semantic_event_begin(&event, id, "ui", "spells", widget, 0, -1);
 ab_semantic_event_emit(&event);
}

static const struct ab_spell_binding *ab_spell_binding_for(
 const struct player *p, int bidx, int sidx)
{
 size_t i;
 if (!p || !p->class || bidx < 0 || sidx < 0 ||
  bidx >= p->class->magic.num_books || sidx >= p->class->magic.total_spells)
  return NULL;
 for (i = 0; i < sizeof(ab_spells) / sizeof(ab_spells[0]); i++) {
  const struct ab_spell_binding *binding = &ab_spells[i];
  if (binding->cidx == p->class->cidx && binding->bidx == bidx &&
   binding->sidx == sidx) return binding;
 }
 return NULL;
}

const char *ab_spell_name_id(const struct player *p,const struct class_spell *spell)
{
 const struct ab_spell_binding *binding=spell?
  ab_spell_binding_for(p,spell->bidx,spell->sidx):NULL;
 return binding?binding->name_id:NULL;
}

void ab_spell_menu_begin(const struct player *p, int first_spell_index)
{
 size_t i, j;
 ab_spell_control("__begin_replace");
 if (p && p->class) {
  /* The original collector already selected a readable object/book. Resolve
   * its first canonical spell index, without another object/core lookup. */
  for (i = 0; i < sizeof(ab_spells) / sizeof(ab_spells[0]); i++) {
   if (ab_spells[i].cidx != p->class->cidx ||
    ab_spells[i].sidx != first_spell_index) continue;
   for (j = 0; j < sizeof(ab_books) / sizeof(ab_books[0]); j++) {
    if (ab_books[j].cidx == p->class->cidx &&
     ab_books[j].bidx == ab_spells[i].bidx) {
     ab_spell_text("book", ab_books[j].name_id);
     break;
    }
   }
   break;
  }
 }
 ab_spell_control("__end");
}

void ab_spell_menu_end(void)
{
 ab_spell_control("__reset");
}

static void ab_spell_integer(struct ab_semantic_event *event,
 const char *name, int value)
{
 ab_semantic_param_begin(event, name, "integer");
 ab_semantic_json_int32(event, value);
 ab_semantic_param_end(event);
}

static void ab_spell_token(struct ab_semantic_event *event,
 const char *name, const char *value)
{
 ab_semantic_param_begin(event, name, "display_token");
 ab_semantic_json_string(event, value);
 ab_semantic_param_end(event);
}

void ab_spell_row(const struct player *p, const struct class_spell *spell,
 char key, int color, int fail, enum ab_spell_row_state state)
{
 static const char *const states[] = {
  "illegible", "forgotten", "worked", "untried", "unknown", "difficult"
 };
 const struct ab_spell_binding *binding;
 struct ab_semantic_event event;
 char widget[64], token[2] = { key, '\0' };
 if (!spell || key < 0x20 || key > 0x7e || state < AB_SPELL_ILLEGIBLE ||
  state > AB_SPELL_DIFFICULT) return;
 binding = ab_spell_binding_for(p, spell->bidx, spell->sidx);
 if (!binding) return;
 ab_spell_control("__begin_patch");
 snprintf(widget, sizeof(widget), "row.%d.name", spell->sidx);
 if (state != AB_SPELL_ILLEGIBLE) {
  ab_spell_text(widget, binding->name_id);
 } else {
  snprintf(widget, sizeof(widget), "__clear:row.%d.name", spell->sidx);
  ab_spell_control(widget);
 }
 snprintf(widget, sizeof(widget), "__spell_row:%d", spell->sidx);
 ab_semantic_event_begin(&event, "", "ui", "spells", widget, 0, -1);
 ab_spell_token(&event, "key", token);
 ab_spell_token(&event, "state", states[state]);
 ab_spell_integer(&event, "color", color);
 /* Original illegible rows disclose neither names nor numeric fields. */
 if (state != AB_SPELL_ILLEGIBLE) {
  ab_spell_integer(&event, "level", spell->slevel);
  ab_spell_integer(&event, "mana", spell->smana);
  ab_spell_integer(&event, "fail", fail);
 }
 ab_semantic_event_emit_control(&event);
 ab_spell_control("__end");
}

void ab_spell_description(const struct player *p,
 const struct class_spell *spell, bool visible)
{
 const struct ab_spell_binding *binding = spell ?
  ab_spell_binding_for(p, spell->bidx, spell->sidx) : NULL;
 ab_spell_control("__begin_patch");
 /* This is the original show_description gate, with no added knowledge rule.
  * Worked-only average damage is separate, unsupported grammar. */
 if (visible && binding) ab_spell_text("description", binding->description_id);
 else ab_spell_control("__clear:description");
 ab_spell_control("__end");
}
#endif /* __EMSCRIPTEN__ */
