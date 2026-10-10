
/* AB_KNOWLEDGE_BEGIN */
#include "web-knowledge-text.h"
/* AB_KNOWLEDGE_END */
/* AB_GAME_DYNAMIC_BEGIN */
#include "web-dynamic-text.h"
/* AB_GAME_DYNAMIC_END *//**
 * \file mon-lore.c
 * \brief Monster memory code.
 *
 * Copyright (c) 1997-2007 Ben Harrison, James E. Wilson, Robert A. Koeneke
 *
 * This work is free software; you can redistribute it and/or modify it
 * under the terms of either:
 *
 * a) the GNU General Public License as published by the Free Software
 *    Foundation, version 2, or
 *
 * b) the "Angband licence":
 *    This software may be copied and distributed for educational, research,
 *    and not for profit purposes provided that this copyright and statement
 *    are included in all such copies.  Other copyrights may also apply.
 */

#include "angband.h"
#include "effects.h"
#include "game-world.h"
#include "init.h"
#include "mon-attack.h"
#include "mon-blows.h"
#include "mon-init.h"
#include "mon-lore.h"
#include "mon-make.h"
#include "mon-predicate.h"
#include "mon-spell.h"
#include "mon-util.h"
#include "obj-gear.h"
#include "obj-tval.h"
#include "obj-util.h"
#include "player-attack.h"
#include "player-calcs.h"
#include "player-timed.h"
#include "project.h"
#include "z-textblock.h"

/**
 * Monster genders
 */
enum monster_sex {
	MON_SEX_NEUTER = 0,
	MON_SEX_MALE,
	MON_SEX_FEMALE,
	MON_SEX_MAX,
};

typedef enum monster_sex monster_sex_t;

/**
 * Determine the color to code a monster spell
 *
 * This function assigns a color to each monster spell, depending on how
 * dangerous the attack is to the player given current state. Spells may be
 * colored green (least dangerous), yellow, orange, or red (most dangerous).
 */
static int spell_color(struct player *p, const struct monster_race *race,
					   int spell_index)
{
	const struct monster_spell *spell = monster_spell_by_index(spell_index);
	struct monster_spell_level *level = spell->level;
	struct effect *eff = spell ? spell->effect : NULL;

	/* No spell */
	if (!spell) return COLOUR_DARK;

	/* Get the right level */
	while (level->next && race->spell_power >= level->next->power) {
		level = level->next;
	}

	/* Unresistable spells just use the default color */
	if (!level->lore_attr_resist && !level->lore_attr_immune) {
		return level->lore_attr;
	}

	/* Spells with a save */
	if (level->save_message) {
		/* Mixed results if the save may fail, perfect result if it can't */
		if (p->known_state.skills[SKILL_SAVE] < 100) {
			if (eff->index == EF_TELEPORT_LEVEL) {
				/* Special case - teleport level */
				if (p->known_state.el_info[ELEM_NEXUS].res_level > 0) {
					return level->lore_attr_resist;
				} else {
					return level->lore_attr;
				}
			} else if (eff->index == EF_TIMED_INC) {
				/* Simple timed effects */
				if (player_inc_check(p, eff->subtype, true)) {
					return level->lore_attr;
				} else {
					return level->lore_attr_resist;
				}
			} else if (level->lore_attr_immune) {
				/* Multiple timed effects plus damage */
				for (; eff; eff = eff->next) {
					if (eff->index != EF_TIMED_INC) continue;
					if (player_inc_check(p, eff->subtype, true)) {
						return level->lore_attr;
					}
				}
				return level->lore_attr_resist;
			} else {
				/* Straight damage */
				return level->lore_attr;
			}
		} else if (level->lore_attr_immune) {
			return level->lore_attr_immune;
		} else {
			return level->lore_attr_resist;
		}
	}

	/* Bolts, balls and breaths */
	if ((eff->index == EF_BOLT) || (eff->index == EF_BALL) ||
		(eff->index == EF_BREATH)) {
		/* Treat by element */
		switch (eff->subtype) {
			/* Special case - sound */
			case ELEM_SOUND:
				if (p->known_state.el_info[ELEM_SOUND].res_level > 0) {
					return level->lore_attr_immune;
				} else if (of_has(p->known_state.flags, OF_PROT_STUN)) {
					return level->lore_attr_resist;
				} else {
					return level->lore_attr;
				}
				break;
			/* Special case - nexus */
			case ELEM_NEXUS:
				if (p->known_state.el_info[ELEM_NEXUS].res_level > 0) {
					return level->lore_attr_immune;
				} else if (p->known_state.skills[SKILL_SAVE] >= 100) {
					return level->lore_attr_resist;
				} else {
					return level->lore_attr;
				}
				break;
			/* Elements that stun or confuse */
			case ELEM_FORCE:
			case ELEM_ICE:
			case ELEM_PLASMA:
			case ELEM_WATER:
				if (!of_has(p->known_state.flags, OF_PROT_STUN)) {
					return level->lore_attr;
				} else if (!of_has(p->known_state.flags, OF_PROT_CONF) &&
						   (eff->subtype == ELEM_WATER)){
					return level->lore_attr;
				} else {
					return level->lore_attr_resist;
				}
				break;
			/* All other elements */
			default:
				if (p->known_state.el_info[eff->subtype].res_level == 3) {
					return level->lore_attr_immune;
				} else if (p->known_state.el_info[eff->subtype].res_level > 0) {
					return level->lore_attr_resist;
				} else {
					return level->lore_attr;
				}
		}
	}

	return level->lore_attr;
}

/**
 * Determine the color to code a monster melee blow effect
 *
 * This function assigns a color to each monster blow effect, depending on how
 * dangerous the attack is to the player given current state. Blows may be
 * colored green (least dangerous), yellow, orange, or red (most dangerous).
 */
static int blow_color(struct player *p, int blow_idx)
{
	const struct blow_effect *blow = &blow_effects[blow_idx];

	/* Some blows just use the default color */
	if (!blow->lore_attr_resist && !blow->lore_attr_immune) {
		return blow->lore_attr;
	}

	/* Effects with immunities are straightforward */
	if (blow->lore_attr_immune) {
		int i;

		for (i = ELEM_ACID; i < ELEM_POIS; i++) {
			if (proj_name_to_idx(blow->name) == i) {
				break;
			}
		}

		if (p->known_state.el_info[i].res_level == 3) {
			return blow->lore_attr_immune;
		} else if (p->known_state.el_info[i].res_level > 0) {
			return blow->lore_attr_resist;
		} else {
			return blow->lore_attr;
		}
	}

	/* Now look at what player attributes can protect from the effects */
	if (streq(blow->effect_type, "theft")) {
		if (p->lev + adj_dex_safe[p->known_state.stat_ind[STAT_DEX]] >= 100) {
			return blow->lore_attr_resist;
		} else {
			return blow->lore_attr;
		}
	} else if (streq(blow->effect_type, "drain")) {
		int i;
		bool found = false;
		for (i = 0; i < z_info->pack_size; i++) {
			struct object *obj = p->upkeep->inven[i];
			if (obj && tval_can_have_charges(obj) && obj->pval) {
				found = true;
				break;
			}
		}
		if (found) {
			return blow->lore_attr;
		} else {
			return blow->lore_attr_resist;
		}
	} else if (streq(blow->effect_type, "eat-food")) {
		int i;
		bool found = false;
		for (i = 0; i < z_info->pack_size; i++) {
			struct object *obj = p->upkeep->inven[i];
			if (obj && tval_is_edible(obj)) {
				found = true;
				break;
			}
		}
		if (found) {
			return blow->lore_attr;
		} else {
			return blow->lore_attr_resist;
		}
	} else if (streq(blow->effect_type, "eat-light")) {
		int light_slot = slot_by_name(p, "light");
		struct object *obj = slot_object(p, light_slot);
		if (obj && obj->timeout && !of_has(obj->flags, OF_NO_FUEL)) {
			return blow->lore_attr;
		} else {
			return blow->lore_attr_resist;
		}
	} else if (streq(blow->effect_type, "element")) {
		if (p->known_state.el_info[blow->resist].res_level > 0) {
			return blow->lore_attr_resist;
		} else {
			return blow->lore_attr;
		}
	} else if (streq(blow->effect_type, "flag")) {
		if (of_has(p->known_state.flags, blow->resist)) {
			return blow->lore_attr_resist;
		} else {
			return blow->lore_attr;
		}
	} else if (streq(blow->effect_type, "all_sustains")) {
		if (of_has(p->known_state.flags, OF_SUST_STR) &&
			of_has(p->known_state.flags, OF_SUST_INT) &&
			of_has(p->known_state.flags, OF_SUST_WIS) &&
			of_has(p->known_state.flags, OF_SUST_DEX) &&
			of_has(p->known_state.flags, OF_SUST_CON)) {
			return blow->lore_attr_resist;
		} else {
			return blow->lore_attr;
		}
	}

	return blow->lore_attr;
}

void lore_learn_spell_if_has(struct monster_lore *lore, const struct monster_race *race, int flag)
{
	if (rsf_has(race->spell_flags, flag)) {
		rsf_on(lore->spell_flags, flag);
	}
}

void lore_learn_spell_if_visible(struct monster_lore *lore, const struct monster *mon, int flag)
{
	if (monster_is_visible(mon)) {
		rsf_on(lore->spell_flags, flag);
	}
}

void lore_learn_flag_if_visible(struct monster_lore *lore, const struct monster *mon, int flag)
{
	if (monster_is_visible(mon)) {
		rf_on(lore->flags, flag);
	}
}


/**
 * Update which bits of lore are known
 */
void lore_update(const struct monster_race *race, struct monster_lore *lore)
{
	int i;
	bitflag mask[RF_SIZE];

	if (!race || !lore) return;

	/* Assume some "obvious" flags */
	create_mon_flag_mask(mask, RFT_OBV, RFT_MAX);
	rf_union(lore->flags, mask);

	/* Blows */
	for (i = 0; i < z_info->mon_blows_max; i++) {
		if (!race->blow) break;
		if (lore->blow_known[i] || lore->blows[i].times_seen ||
			lore->all_known) {
			lore->blow_known[i] = true;
			lore->blows[i].method = race->blow[i].method;
			lore->blows[i].effect = race->blow[i].effect;
			lore->blows[i].dice = race->blow[i].dice;
		}
	}

	/* Killing a monster reveals some properties */
	if ((lore->tkills > 0) || lore->all_known) {
		lore->armour_known = true;
		lore->drop_known = true;
		create_mon_flag_mask(mask, RFT_RACE_A, RFT_RACE_N, RFT_DROP, RFT_MAX);
		rf_union(lore->flags, mask);
		rf_on(lore->flags, RF_FORCE_DEPTH);
	}

	/* Awareness */
	if ((((int)lore->wake * (int)lore->wake) > race->sleep) ||
	    (lore->ignore == UCHAR_MAX) || lore->all_known ||
	    ((race->sleep == 0) && (lore->tkills >= 10)))
		lore->sleep_known = true;

	/* Spellcasting frequency */
	if (lore->cast_innate > 50 || lore->all_known) {
		lore->innate_freq_known = true;
	}
	if (lore->cast_spell > 50 || lore->all_known) {
		lore->spell_freq_known = true;
	}

	/* Flags for probing and cheating */
	if (lore->all_known) {
		rf_setall(lore->flags);
		rsf_copy(lore->spell_flags, race->spell_flags);
	}
}

/**
 * Learn everything about a monster.
 *
 * Sets the all_known variable, all flags and all relevant spell flags.
 */
void cheat_monster_lore(const struct monster_race *race, struct monster_lore *lore)
{
	assert(race);
	assert(lore);

	/* Full knowledge */
	lore->all_known = true;
	lore_update(race, lore);
}

/**
 * Forget everything about a monster.
 */
void wipe_monster_lore(const struct monster_race *race, struct monster_lore *lore)
{
	struct monster_blow *blows;
	bool *blow_known;
	struct monster_drop *d;
	struct monster_friends *f;
	struct monster_friends_base *fb;
	struct monster_mimic *mk;

	assert(race);
	assert(lore);

	d = lore->drops;
	while (d) {
		struct monster_drop *dn = d->next;
		mem_free(d);
		d = dn;
	}
	f = lore->friends;
	while (f) {
		struct monster_friends *fn = f->next;
		mem_free(f);
		f = fn;
	}
	fb = lore->friends_base;
	while (fb) {
		struct monster_friends_base *fbn = fb->next;
		mem_free(fb);
		fb = fbn;
	}
	mk = lore->mimic_kinds;
	while (mk) {
		struct monster_mimic *mkn = mk->next;
		mem_free(mk);
		mk = mkn;
	}
	/*
	 * Keep the blows and blow_known pointers - other code assumes they
	 * are not NULL.  Wipe the pointed to memory.
	 */
	blows = lore->blows;
	memset(blows, 0, z_info->mon_blows_max * sizeof(*blows));
	blow_known = lore->blow_known;
	memset(blow_known, 0, z_info->mon_blows_max * sizeof(*blow_known));
	memset(lore, 0, sizeof(*lore));
	lore->blows = blows;
	lore->blow_known = blow_known;
}

/**
 * Learn about a monster (by "probing" it)
 */
void lore_do_probe(struct monster *mon)
{
	struct monster_lore *lore = get_lore(mon->race);
	
	lore->all_known = true;
	lore_update(mon->race, lore);

	/* Update monster recall window */
	if (player->upkeep->monster_race == mon->race)
		player->upkeep->redraw |= (PR_MONSTER);
}

/**
 * Determine whether the monster is fully known
 */
bool lore_is_fully_known(const struct monster_race *race)
{
	unsigned i;
	struct monster_lore *lore = get_lore(race);

	/* Check if already known */
	if (lore->all_known)
		return true;
		
	if (!lore->armour_known)
		return false;
	/* Only check spells if the monster can cast them */
	if (!lore->spell_freq_known && race->freq_innate + race->freq_spell)
		return false;
	if (!lore->drop_known)
		return false;
	if (!lore->sleep_known)
		return false;
		
	/* Check if blows are known */
	for (i = 0; i < z_info->mon_blows_max; i++){
		/* Only check if the blow exists */
		if (!race->blow[i].method)
			break;
		if (!lore->blow_known[i])
			return false;
		
	}
		
	/* Check all the flags */
	for (i = 0; i < RF_SIZE; i++)
		if (!lore->flags[i])
			return false;
		
		
	/* Check spell flags */
	for (i = 0; i < RSF_SIZE; i++)
		if (lore->spell_flags[i] != race->spell_flags[i])			
			return false;
	
	/* The player knows everything */
	lore->all_known = true;
	lore_update(race, lore);
	return true;
}
	
	
/**
 * Take note that the given monster just dropped some treasure
 *
 * Note that learning the "GOOD"/"GREAT" flags gives information
 * about the treasure (even when the monster is killed for the first
 * time, such as uniques, and the treasure has not been examined yet).
 *
 * This "indirect" method was used to prevent the player from learning
 * exactly how much treasure a monster can drop from observing only
 * a single example of a drop.  This method actually observes how much
 * gold and items are dropped, and remembers that information to be
 * described later by the monster recall code.  It gives the player a chance
 * to learn if a monster drops only objects or only gold.
 */
void lore_treasure(struct monster *mon, int num_item, int num_gold)
{
	struct monster_lore *lore = get_lore(mon->race);

	assert(num_item >= 0);
	assert(num_gold >= 0);

	/* Note the number of things dropped */
	if (num_item > lore->drop_item) {
		lore->drop_item = num_item;
	}
	if (num_gold > lore->drop_gold) {
		lore->drop_gold = num_gold;
	}

	/* Learn about drop quality */
	rf_on(lore->flags, RF_DROP_GOOD);
	rf_on(lore->flags, RF_DROP_GREAT);

	/* Have a chance to learn ONLY_ITEM and ONLY_GOLD */
	if (num_item && (lore->drop_gold == 0) && one_in_(4)) {
		rf_on(lore->flags, RF_ONLY_ITEM);
	}
	if (num_gold && (lore->drop_item == 0) && one_in_(4)) {
		rf_on(lore->flags, RF_ONLY_GOLD);
	}

	/* Update monster recall window */
	if (player->upkeep->monster_race == mon->race) {
		player->upkeep->redraw |= (PR_MONSTER);
	}
}

/**
 * Copies into `flags` the flags of the given monster race that are known
 * to the given lore structure (usually the player's knowledge).
 *
 * Known flags will be 1 for present, or 0 for not present. Unknown flags
 * will always be 0.
 */
void monster_flags_known(const struct monster_race *race,
						 const struct monster_lore *lore,
						 bitflag flags[RF_SIZE])
{
	rf_copy(flags, race->flags);
	rf_inter(flags, lore->flags);
}

/**
 * Return a description for the given monster race awareness value.
 *
 * Descriptions are in a table within the function. Returns a sensible string
 * for values not in the table.
 *
 * \param awareness is the inactivity counter of the race (monster_race.sleep).
 */
static const char *lore_describe_awareness(int16_t awareness)
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
static const char *const ab_ids[]={"angband.knowledge.lore.lexeme.awareness.ignores","angband.knowledge.lore.lexeme.awareness.very_inattentive","angband.knowledge.lore.lexeme.awareness.inattentive","angband.knowledge.lore.lexeme.awareness.overlooks","angband.knowledge.lore.lexeme.awareness.very_slow_to_notice","angband.knowledge.lore.lexeme.awareness.slow_to_notice","angband.knowledge.lore.lexeme.awareness.fairly_observant","angband.knowledge.lore.lexeme.awareness.observant","angband.knowledge.lore.lexeme.awareness.very_observant","angband.knowledge.lore.lexeme.awareness.vigilant"};
#endif
/* AB_KNOWLEDGE_END */

	/* Value table ordered descending, for priority. Terminator is
	 * {SHRT_MAX, NULL}. */
	static const struct lore_awareness {
		int16_t threshold;
		const char *description;
	} lore_awareness_description[] = {
		{200,	"prefers to ignore"},
		{95,	"pays very little attention to"},
		{75,	"pays little attention to"},
		{45,	"tends to overlook"},
		{25,	"takes quite a while to see"},
		{10,	"takes a while to see"},
		{5,		"is fairly observant of"},
		{3,		"is observant of"},
		{1,		"is very observant of"},
		{0,		"is vigilant for"},
		{SHRT_MAX,	NULL},
	};
	const struct lore_awareness *current = lore_awareness_description;

	while (current->threshold != SHRT_MAX && current->description != NULL) {
		if (awareness > current->threshold)
			return /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_SELECT(ab_ids[current-lore_awareness_description],/* AB_KNOWLEDGE_INLINE_END */current->description/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */;

		current++;
	}

	/* Values zero and less are the most vigilant */
	return /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_SELECT("angband.knowledge.lore.lexeme.awareness.ever_vigilant",/* AB_KNOWLEDGE_INLINE_END */"is ever vigilant for"/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */;
}

/**
 * Return a description for the given monster race speed value.
 *
 * Descriptions are in a table within the function. Returns a sensible string
 * for values not in the table.
 *
 * \param speed is the speed rating of the race (monster_race.speed).
 */
static const char *lore_describe_speed(uint8_t speed)
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
static const char *const ab_ids[]={"angband.knowledge.lore.lexeme.speed.incredibly_quickly","angband.knowledge.lore.lexeme.speed.very_quickly","angband.knowledge.lore.lexeme.speed.quickly","angband.knowledge.lore.lexeme.speed.fairly_quickly","angband.knowledge.lore.lexeme.speed.normal_speed","angband.knowledge.lore.lexeme.speed.slowly","angband.knowledge.lore.lexeme.speed.very_slowly","angband.knowledge.lore.lexeme.speed.incredibly_slowly"};
#endif
/* AB_KNOWLEDGE_END */

	/* Value table ordered descending, for priority. Terminator is
	 * {UCHAR_MAX, NULL}. */
	static const struct lore_speed {
		uint8_t threshold;
		const char *description;
	} lore_speed_description[] = {
		{130,	"incredibly quickly"},
		{120,	"very quickly"},
		{115,	"quickly"},
		{110,	"fairly quickly"},
		{109,	"normal speed"}, /* 110 is normal speed */
		{99,	"slowly"},
		{89,	"very slowly"},
		{0,		"incredibly slowly"},
		{UCHAR_MAX,	NULL},
	};
	const struct lore_speed *current = lore_speed_description;

	while (current->threshold != UCHAR_MAX && current->description != NULL) {
		if (speed > current->threshold)
			return /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_SELECT(ab_ids[current-lore_speed_description],/* AB_KNOWLEDGE_INLINE_END */current->description/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */;

		current++;
	}

	/* Return a weird description, since the value wasn't found in the table */
	return /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_SELECT("angband.knowledge.lore.lexeme.speed.erroneously",/* AB_KNOWLEDGE_INLINE_END */"erroneously"/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */;
}

/**
 * Append the monster speed, in words, to a textblock.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 */
static void lore_adjective_speed(textblock *tb, const struct monster_race *race)
{
	/* "at" is separate from the normal speed description in order to use the
	 * normal text colour */
	if (race->speed == 110)
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("speed_adjective","normal_speed_preposition","angband.knowledge.lore.speed_adjective.normal_speed_preposition")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "at ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("speed_adjective","adjective_description","angband.knowledge.lore.speed_adjective.adjective_description")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_SELECTED("speed",/* AB_KNOWLEDGE_INLINE_END */lore_describe_speed(race->speed)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
}

/**
 * Append the monster speed, in multipliers, to a textblock.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 */
static void lore_multiplier_speed(textblock *tb, const struct monster_race *race)
{
	// moves at 2.3x normal speed (0.9x your current speed)
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("speed_multiplier","multiplier_preposition","angband.knowledge.lore.speed_multiplier.multiplier_preposition")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "at ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

	char buf[8] = "";
	int multiplier = 10 * extract_energy[race->speed] / extract_energy[110];
	uint8_t int_mul = multiplier / 10;
	uint8_t dec_mul = multiplier % 10;
	uint8_t attr = COLOUR_ORANGE;

	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_number("angband.knowledge.lore.statement.speed_multiplier.normal_factor",int_mul,dec_mul,"tenths")), /* AB_KNOWLEDGE_INLINE_END */strnfmt(buf, sizeof(buf), "%d.%dx", int_mul, dec_mul);
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("speed_multiplier","normal_multiplier","angband.knowledge.lore.speed_multiplier.normal_multiplier")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_PREPARED("factor",false,/* AB_KNOWLEDGE_INLINE_END */buf/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("speed_multiplier","relative_speed_transition","angband.knowledge.lore.speed_multiplier.relative_speed_transition")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " normal speed, which is ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	multiplier = 100 * extract_energy[race->speed]
		/ extract_energy[player->state.speed];
	int_mul = multiplier / 100;
	dec_mul = multiplier % 100;
	if (!dec_mul) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_number("angband.knowledge.lore.statement.speed_multiplier.player_factor_integer",int_mul,0,NULL)), /* AB_KNOWLEDGE_INLINE_END */strnfmt(buf, sizeof(buf), "%dx", int_mul);
	} else if (!(dec_mul % 10)) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_number("angband.knowledge.lore.statement.speed_multiplier.player_factor_tenths",int_mul,dec_mul / 10,"tenths")), /* AB_KNOWLEDGE_INLINE_END */strnfmt(buf, sizeof(buf), "%d.%dx", int_mul, dec_mul / 10);
	} else {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_number("angband.knowledge.lore.statement.speed_multiplier.player_factor_hundredths",int_mul,dec_mul,"hundredths")), /* AB_KNOWLEDGE_INLINE_END */strnfmt(buf, sizeof(buf), "%d.%02dx", int_mul, dec_mul);
	}

	if (player->state.speed > race->speed) {
		attr = COLOUR_L_GREEN;
	} else if (player->state.speed < race->speed) {
		attr = COLOUR_RED;
	}
	if (player->state.speed == race->speed) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("speed_multiplier","same_as_player","angband.knowledge.lore.speed_multiplier.same_as_player")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "the same as you")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	} else {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("speed_multiplier","player_multiplier","angband.knowledge.lore.speed_multiplier.player_multiplier")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */attr/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_PREPARED("factor",false,/* AB_KNOWLEDGE_INLINE_END */buf/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("speed_multiplier","player_speed_unit","angband.knowledge.lore.speed_multiplier.player_speed_unit")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " your speed")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}
}

/**
 * Return a value describing the sex of the provided monster race.
 */
static monster_sex_t lore_monster_sex(const struct monster_race *race)
{
	if (rf_has(race->flags, RF_FEMALE))
		return MON_SEX_FEMALE;
	else if (rf_has(race->flags, RF_MALE))
		return MON_SEX_MALE;

	return MON_SEX_NEUTER;
}

/**
 * Return a pronoun for a monster; used as the subject of a sentence.
 *
 * Descriptions are in a table within the function. Table must match
 * monster_sex_t values.
 *
 * \param sex is the gender value (as provided by `lore_monster_sex()`.
 * \param title_case indicates whether the initial letter should be
 * capitalized; `true` is capitalized, `false` is not.
 */
static const char *lore_pronoun_nominative(monster_sex_t sex, bool title_case)
{
	static const char *lore_pronouns[MON_SEX_MAX][2] = {
		{"it", "It"},
		{"he", "He"},
		{"she", "She"},
	};

	int pronoun_index = MON_SEX_NEUTER, case_index = 0;

	if (sex < MON_SEX_MAX)
		pronoun_index = sex;

	if (title_case)
		case_index = 1;

	return lore_pronouns[pronoun_index][case_index];
}

/**
 * Return a possessive pronoun for a monster.
 *
 * Descriptions are in a table within the function. Table must match
 * monster_sex_t values.
 *
 * \param sex is the gender value (as provided by `lore_monster_sex()`.
 * \param title_case indicates whether the initial letter should be
 * capitalized; `true` is capitalized, `false` is not.
 */
static const char *lore_pronoun_possessive(monster_sex_t sex, bool title_case)
{
	static const char *lore_pronouns[MON_SEX_MAX][2] = {
		{"its", "Its"},
		{"his", "His"},
		{"her", "Her"},
	};

	int pronoun_index = MON_SEX_NEUTER, case_index = 0;

	if (sex < MON_SEX_MAX)
		pronoun_index = sex;

	if (title_case)
		case_index = 1;

	return lore_pronouns[pronoun_index][case_index];
}

/**
 * Append a clause containing a list of descriptions of monster flags from
 * list-mon-race-flags.h to a textblock.
 *
 * The text that joins the list is drawn using the default attributes. The list
 * uses a serial comma ("a, b, c, and d").
 *
 * \param tb is the textblock we are adding to.
 * \param f is the set of flags to be described.
 * \param attr is the attribute each list item will be drawn with.
 * \param start is a string to start the clause.
 * \param conjunction is a string that is added before the last item.
 * \param end is a string that is added after the last item.
 */
static void lore_append_clause(textblock *tb, bitflag *f, uint8_t attr,
							   const char *start, const char *conjunction,
							   const char *end)
{
	int count = rf_count(f);
	bool comma = count > 2;

	if (count) {
		int flag;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("clause","clause_start","angband.knowledge.lore.clause.clause_start")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_PREPARED("start",true,/* AB_KNOWLEDGE_INLINE_END */start/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		for (flag = rf_next(f, FLAG_START); flag; flag = rf_next(f, flag + 1)) {
			/* First entry starts immediately */
			if (flag != rf_next(f, FLAG_START)) {
				if (comma) {
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("clause","serial_comma","angband.knowledge.lore.clause.serial_comma")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ",")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				}
				/* Last entry */
				if (rf_next(f, flag + 1) == FLAG_END) {
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("clause","before_conjunction_space","angband.knowledge.lore.clause.before_conjunction_space")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("clause","conjunction","angband.knowledge.lore.clause.conjunction")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("conjunction",(ab_knowledge_caller_is_alternative()?"angband.knowledge.lore.lexeme.morphology.or":"angband.knowledge.lore.lexeme.morphology.and"),/* AB_KNOWLEDGE_INLINE_END */conjunction/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				}
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("clause","item_separator_space","angband.knowledge.lore.clause.item_separator_space")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			}
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("clause","race_flag_description","angband.knowledge.lore.clause.race_flag_description")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */attr/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("description",ab_knowledge_race_flag_id(flag),/* AB_KNOWLEDGE_INLINE_END */describe_race_flag(flag)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		}
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("clause","clause_end","angband.knowledge.lore.clause.clause_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("end",(ab_knowledge_caller_has_end()?"angband.knowledge.lore.lexeme.projection.clause_sentence_end":"angband.knowledge.lore.lexeme.projection.clause_continues"),/* AB_KNOWLEDGE_INLINE_END */end/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}
}


/**
 * Append a list of spell descriptions.
 *
 * This is a modified version of `lore_append_clause()` to format spells.
 *
 * \param tb is the textblock we are adding to.
 * \param f is the set of flags to be described.
 * \param know_hp is whether the player knows the monster's AC.
 * \param race is the monster race.
 * \param conjunction is a string that is added before the last item.
 * \param end is a string that is added after the last item.
 */
static void lore_append_spell_clause(textblock *tb, bitflag *f, bool know_hp,
									 const struct monster_race *race,
									 const char *conjunction,
									 const char *end)
{
	int count = rsf_count(f);
	bool comma = count > 2;

	if (count) {
		int spell;
		for (spell = rsf_next(f, FLAG_START); spell;
			 spell = rsf_next(f, spell + 1)) {
			int color = spell_color(player, race, spell);
			int damage = mon_spell_lore_damage(spell, race, know_hp);

			/* First entry starts immediately */
			if (spell != rsf_next(f, FLAG_START)) {
				if (comma) {
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spell_clause","serial_comma","angband.knowledge.lore.spell_clause.serial_comma")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ",")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				}
				/* Last entry */
				if (rsf_next(f, spell + 1) == FLAG_END) {
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spell_clause","before_conjunction_space","angband.knowledge.lore.spell_clause.before_conjunction_space")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spell_clause","conjunction","angband.knowledge.lore.spell_clause.conjunction")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("conjunction",(ab_knowledge_caller_is_alternative()?"angband.knowledge.lore.lexeme.morphology.or":"angband.knowledge.lore.lexeme.morphology.and"),/* AB_KNOWLEDGE_INLINE_END */conjunction/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				}
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spell_clause","item_separator_space","angband.knowledge.lore.spell_clause.item_separator_space")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			}
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spell_clause","spell_description","angband.knowledge.lore.spell_clause.spell_description")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */color/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%s",
							   /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COMBAT("description",/* AB_KNOWLEDGE_INLINE_END */mon_spell_lore_description(spell, race)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			if (damage > 0) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spell_clause","spell_damage","angband.knowledge.lore.spell_clause.spell_damage")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */color/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, " (%d)", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("damage",/* AB_KNOWLEDGE_INLINE_END */damage/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			}
		}
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spell_clause","clause_end","angband.knowledge.lore.spell_clause.clause_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("end",(ab_knowledge_caller_has_end()?"angband.knowledge.lore.lexeme.projection.clause_sentence_end":"angband.knowledge.lore.lexeme.projection.clause_continues"),/* AB_KNOWLEDGE_INLINE_END */end/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}
}

/**
 * Append the kill history to a texblock for a given monster race.
 *
 * Known race flags are passed in for simplicity/efficiency.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 * \param lore is the known information about the monster race.
 * \param known_flags is the preprocessed bitfield of race flags known to the
 *        player.
 */
void lore_append_kills(textblock *tb, const struct monster_race *race,
					   const struct monster_lore *lore,
					   const bitflag known_flags[RF_SIZE])
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("kills");
#endif
/* AB_KNOWLEDGE_END */

	monster_sex_t msex = MON_SEX_NEUTER;
	bool out = true;

	assert(tb && race && lore);

	/* Extract a gender (if applicable) */
	msex = lore_monster_sex(race);

	/* Treat by whether unique, then by whether they have any player kills */
	if (rf_has(known_flags, RF_UNIQUE)) {
		/* Determine if the unique is "dead" */
		bool dead = (race->max_num == 0) ? true : false;

		/* We've been killed... */
		if (lore->deaths) {
			/* Killed ancestors */
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","unique_ancestors_slain","angband.knowledge.lore.kills.unique_ancestors_slain")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s has slain %d of your ancestors",
							 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_nominative(msex, true)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("deaths",/* AB_KNOWLEDGE_INLINE_END */lore->deaths/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

			/* But we've also killed it */
			if (dead)
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","unique_revenge_taken","angband.knowledge.lore.kills.unique_revenge_taken")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", but you have taken revenge!  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

			/* Unavenged (ever) */
			else
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","unique_unavenged","angband.knowledge.lore.kills.unique_unavenged")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", who %s unavenged.  ",
								 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("agreement",(lore->deaths==1?"angband.knowledge.lore.lexeme.morphology.remains":"angband.knowledge.lore.lexeme.morphology.remain"),/* AB_KNOWLEDGE_INLINE_END */VERB_AGREEMENT(lore->deaths, "remains",
												"remain")/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		} else if (dead) { /* Dead unique who never hurt us */
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","unique_foe_slain","angband.knowledge.lore.kills.unique_foe_slain")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "You have slain this foe.  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		} else {
			/* Alive and never killed us */
			out = false;
		}
	} else if (lore->deaths) {
		/* Dead ancestors */
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","ancestors_slain","angband.knowledge.lore.kills.ancestors_slain")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%d of your ancestors %s been killed by this creature, ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("deaths",/* AB_KNOWLEDGE_INLINE_END */lore->deaths/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("agreement",(lore->deaths==1?"angband.knowledge.lore.lexeme.morphology.has":"angband.knowledge.lore.lexeme.morphology.have"),/* AB_KNOWLEDGE_INLINE_END */VERB_AGREEMENT(lore->deaths, "has", "have")/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		if (lore->pkills) {
			/* Some kills this life */
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","current_life_extermination","angband.knowledge.lore.kills.current_life_extermination")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "and you have exterminated at least %d of the creatures.  ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("kills",/* AB_KNOWLEDGE_INLINE_END */lore->pkills/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		} else if (lore->tkills) {
			/* Some kills past lives */
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","ancestral_extermination","angband.knowledge.lore.kills.ancestral_extermination")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "and your ancestors have exterminated at least %d of the creatures.  ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("kills",/* AB_KNOWLEDGE_INLINE_END */lore->tkills/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		} else {
			/* No kills */
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","never_defeated","angband.knowledge.lore.kills.never_defeated")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_RED/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "and %s is not ever known to have been defeated.  ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,false),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_nominative(msex, false)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		}
	} else {
		if (lore->pkills) {
			/* Killed some this life */
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","current_life_kills","angband.knowledge.lore.kills.current_life_kills")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "You have killed at least %d of these creatures.  ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("kills",/* AB_KNOWLEDGE_INLINE_END */lore->pkills/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		} else if (lore->tkills) {
			/* Killed some last life */
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","ancestral_kills","angband.knowledge.lore.kills.ancestral_kills")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "Your ancestors have killed at least %d of these creatures.  ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("kills",/* AB_KNOWLEDGE_INLINE_END */lore->tkills/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		} else {
			/* Killed none */
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","no_lethal_battles","angband.knowledge.lore.kills.no_lethal_battles")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "No battles to the death are recalled.  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		}
	}

	/* Separate */
	if (out)
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("kills","section_break","angband.knowledge.lore.kills.section_break")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "\n")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Append the monster race description to a textblock.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 */
void lore_append_flavor(textblock *tb, const struct monster_race *race)
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("flavor");
#endif
/* AB_KNOWLEDGE_END */

	assert(tb && race);

	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("flavor","race_description","angband.knowledge.lore.flavor.race_description")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s\n", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("description",ab_knowledge_monster_description_id(race),/* AB_KNOWLEDGE_INLINE_END */race->text/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Append the monster type, location, and movement patterns to a textblock.
 *
 * Known race flags are passed in for simplicity/efficiency.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 * \param lore is the known information about the monster race.
 * \param known_flags is the preprocessed bitfield of race flags known to the
 *        player.
 */
void lore_append_movement(textblock *tb, const struct monster_race *race,
						  const struct monster_lore *lore,
						  bitflag known_flags[RF_SIZE])
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("movement");
#endif
/* AB_KNOWLEDGE_END */

	int f;
	bitflag flags[RF_SIZE];

	assert(tb && race && lore);

	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","subject_introduction","angband.knowledge.lore.movement.subject_introduction")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "This")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

	/* Get adjectives */
	create_mon_flag_mask(flags, RFT_RACE_A, RFT_MAX);
	rf_inter(flags, race->flags);
	for (f = rf_next(flags, FLAG_START); f; f = rf_next(flags, f + 1)) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","race_adjective","angband.knowledge.lore.movement.race_adjective")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, " %s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("adjective",ab_knowledge_race_flag_id(f),/* AB_KNOWLEDGE_INLINE_END */describe_race_flag(f)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

	/* Get noun */
	create_mon_flag_mask(flags, RFT_RACE_N, RFT_MAX);
	rf_inter(flags, race->flags);
	f = rf_next(flags, FLAG_START);
	if (f) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","race_noun","angband.knowledge.lore.movement.race_noun")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, " %s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("noun",ab_knowledge_race_flag_id(f),/* AB_KNOWLEDGE_INLINE_END */describe_race_flag(f)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	} else {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","generic_creature","angband.knowledge.lore.movement.generic_creature")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, " creature")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

	/* Describe location */
	if (race->level == 0) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","town_location","angband.knowledge.lore.movement.town_location")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " lives in the town")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	} else {
		uint8_t colour = (race->level > player->max_depth) ?
			COLOUR_RED : COLOUR_L_BLUE;

		if (rf_has(known_flags, RF_FORCE_DEPTH))
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","forced_depth_presence","angband.knowledge.lore.movement.forced_depth_presence")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " is found ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		else
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","normal_depth_presence","angband.knowledge.lore.movement.normal_depth_presence")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " is normally found ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","depth_introduction","angband.knowledge.lore.movement.depth_introduction")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "at depths of ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","depth_feet","angband.knowledge.lore.movement.depth_feet")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */colour/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("feet",/* AB_KNOWLEDGE_INLINE_END */race->level * 50/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","depth_level_transition","angband.knowledge.lore.movement.depth_level_transition")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " feet (level ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","depth_level","angband.knowledge.lore.movement.depth_level")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */colour/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("level",/* AB_KNOWLEDGE_INLINE_END */race->level/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","depth_close","angband.knowledge.lore.movement.depth_close")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ")")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","movement_transition","angband.knowledge.lore.movement.movement_transition")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", and moves")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

	/* Random-ness */
	if (flags_test(known_flags, RF_SIZE, RF_RAND_50, RF_RAND_25, FLAG_END)) {
		/* Adverb */
		if (rf_has(known_flags, RF_RAND_50) && rf_has(known_flags, RF_RAND_25))
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","erratic_extreme","angband.knowledge.lore.movement.erratic_extreme")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " extremely")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		else if (rf_has(known_flags, RF_RAND_50))
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","erratic_somewhat","angband.knowledge.lore.movement.erratic_somewhat")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " somewhat")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		else if (rf_has(known_flags, RF_RAND_25))
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","erratic_slight","angband.knowledge.lore.movement.erratic_slight")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " a bit")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* Adjective */
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","erratic_movement","angband.knowledge.lore.movement.erratic_movement")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " erratically")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* Occasional conjunction */
		if (race->speed != 110) /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","speed_transition","angband.knowledge.lore.movement.speed_transition")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", and")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

	/* Speed */
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","speed_spacing","angband.knowledge.lore.movement.speed_spacing")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

	if (OPT(player, effective_speed))
		lore_multiplier_speed(tb, race);
	else
		lore_adjective_speed(tb, race);

	/* The speed description also describes "attack speed" */
	if (rf_has(known_flags, RF_NEVER_MOVE)) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","pursuit_contrast","angband.knowledge.lore.movement.pursuit_contrast")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", but ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","never_chases_intruders","angband.knowledge.lore.movement.never_chases_intruders")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
						   "does not deign to chase intruders")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

	/* End this sentence */
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("movement","sentence_end","angband.knowledge.lore.movement.sentence_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ".  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Append the monster AC, HP, and hit chance to a textblock.
 *
 * Known race flags are passed in for simplicity/efficiency.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 * \param lore is the known information about the monster race.
 * \param known_flags is the preprocessed bitfield of race flags known to the
 *        player.
 */
void lore_append_toughness(textblock *tb, const struct monster_race *race,
						   const struct monster_lore *lore,
						   bitflag known_flags[RF_SIZE])
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("toughness");
#endif
/* AB_KNOWLEDGE_END */

	monster_sex_t msex = MON_SEX_NEUTER;
	struct object *weapon = equipped_item_by_slot_name(player, "weapon");

	assert(tb && race && lore);

	/* Extract a gender (if applicable) */
	msex = lore_monster_sex(race);

	/* Describe monster "toughness" */
	if (lore->armour_known) {
		/* Hitpoints */
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","life_rating_subject","angband.knowledge.lore.toughness.life_rating_subject")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s has a", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_nominative(msex, true)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		if (!rf_has(known_flags, RF_UNIQUE))
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","average_life_rating","angband.knowledge.lore.toughness.average_life_rating")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "n average")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","life_rating_label","angband.knowledge.lore.toughness.life_rating_label")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " life rating of ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","life_rating_value","angband.knowledge.lore.toughness.life_rating_value")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("hp",/* AB_KNOWLEDGE_INLINE_END */race->avg_hp/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* Armor */
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","armor_rating_label","angband.knowledge.lore.toughness.armor_rating_label")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", and an armor rating of ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","armor_rating_value","angband.knowledge.lore.toughness.armor_rating_value")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("armor",/* AB_KNOWLEDGE_INLINE_END */race->ac/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","ratings_end","angband.knowledge.lore.toughness.ratings_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ".  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* Player's base chance to hit */
		random_chance c;
		hit_chance(&c, chance_of_melee_hit_base(player, weapon), race->ac);
		int percent = random_chance_scaled(c, 100);

		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","player_hit_subject","angband.knowledge.lore.toughness.player_hit_subject")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "You have a")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		if (percent == 8 || percent / 10 == 8)
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","hit_article_vowel","angband.knowledge.lore.toughness.hit_article_vowel")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "n")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","player_hit_percent","angband.knowledge.lore.toughness.player_hit_percent")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, " %d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("percent",/* AB_KNOWLEDGE_INLINE_END */percent/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("toughness","player_hit_end","angband.knowledge.lore.toughness.player_hit_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%% chance to hit such a creature in melee (if you can see it).  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Append the experience value description to a textblock.
 *
 * Known race flags are passed in for simplicity/efficiency.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 * \param lore is the known information about the monster race.
 * \param known_flags is the preprocessed bitfield of race flags known to the
 *        player.
 */
void lore_append_exp(textblock *tb, const struct monster_race *race,
					 const struct monster_lore *lore,
					 bitflag known_flags[RF_SIZE])
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("experience");
#endif
/* AB_KNOWLEDGE_END */

	const char *ordinal, *article;
	char buf[20] = "";
	long exp_integer, exp_fraction;
	int16_t level;

	/* Check legality and that this is a placeable monster */
	assert(tb && race && lore);
	if (!race->rarity) /* AB_KNOWLEDGE_INLINE_BEGIN */{ AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_end()); /* AB_KNOWLEDGE_INLINE_END */return;/* AB_KNOWLEDGE_INLINE_BEGIN */ }/* AB_KNOWLEDGE_INLINE_END */

	/* Introduction */
	if (rf_has(known_flags, RF_UNIQUE))
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("experience","unique_kill_subject","angband.knowledge.lore.experience.unique_kill_subject")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "Killing")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	else
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("experience","normal_kill_subject","angband.knowledge.lore.experience.normal_kill_subject")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "A kill of")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("experience","creature_kill_subject","angband.knowledge.lore.experience.creature_kill_subject")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " this creature")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

	/* calculate the integer exp part */
	exp_integer = (long)race->mexp * race->level / player->lev;

	/* calculate the fractional exp part scaled by 100, must use long
	 * arithmetic to avoid overflow */
	exp_fraction = ((((long)race->mexp * race->level % player->lev) *
					 (long)1000 / player->lev + 5) / 10);

	/* Calculate textual representation */
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_number("angband.knowledge.lore.statement.experience.integer_value",(int)exp_integer,0,NULL)), /* AB_KNOWLEDGE_INLINE_END */strnfmt(buf, sizeof(buf), "%ld", exp_integer);
	if (exp_fraction)
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_number("angband.knowledge.lore.statement.experience.hundredths_value",(int)exp_integer,(int)exp_fraction,"hundredths")), /* AB_KNOWLEDGE_INLINE_END */my_strcat(buf, format(".%02ld", exp_fraction), sizeof(buf));

	/* Mention the experience */
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("experience","experience_transition","angband.knowledge.lore.experience.experience_transition")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " is worth ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("experience","experience_points","angband.knowledge.lore.experience.experience_points")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%s point%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_PREPARED("experience",false,/* AB_KNOWLEDGE_INLINE_END */buf/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("plural",(((exp_integer == 1) && (exp_fraction == 0))==1?"angband.knowledge.lore.lexeme.morphology.singular":"angband.knowledge.lore.lexeme.morphology.plural"),/* AB_KNOWLEDGE_INLINE_END */PLURAL((exp_integer == 1) && (exp_fraction == 0))/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

	/* Take account of annoying English */
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_morphology_select(false,"angband.knowledge.lore.lexeme.morphology.ordinal_th")), /* AB_KNOWLEDGE_INLINE_END */ordinal = "th";
	level = player->lev % 10;
	if ((player->lev / 10) == 1) /* nothing */;
	else if (level == 1) /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_morphology_select(false,"angband.knowledge.lore.lexeme.morphology.ordinal_st")), /* AB_KNOWLEDGE_INLINE_END */ordinal = "st";
	else if (level == 2) /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_morphology_select(false,"angband.knowledge.lore.lexeme.morphology.ordinal_nd")), /* AB_KNOWLEDGE_INLINE_END */ordinal = "nd";
	else if (level == 3) /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_morphology_select(false,"angband.knowledge.lore.lexeme.morphology.ordinal_rd")), /* AB_KNOWLEDGE_INLINE_END */ordinal = "rd";

	/* Take account of "leading vowels" in numbers */
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_morphology_select(true,"angband.knowledge.lore.lexeme.morphology.article_a")), /* AB_KNOWLEDGE_INLINE_END */article = "a";
	level = player->lev;
	if ((level == 8) || (level == 11) || (level == 18)) /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_morphology_select(true,"angband.knowledge.lore.lexeme.morphology.article_an")), /* AB_KNOWLEDGE_INLINE_END */article = "an";

	/* Mention the dependance on the player's level */
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("experience","player_level_qualification","angband.knowledge.lore.experience.player_level_qualification")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " for %s %u%s level character.  ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("article",ab_knowledge_morphology_id(true),/* AB_KNOWLEDGE_INLINE_END */article/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
					 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("level",/* AB_KNOWLEDGE_INLINE_END */level/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("ordinal",ab_knowledge_morphology_id(false),/* AB_KNOWLEDGE_INLINE_END */ordinal/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Append the monster drop description to a textblock.
 *
 * Known race flags are passed in for simplicity/efficiency.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 * \param lore is the known information about the monster race.
 * \param known_flags is the preprocessed bitfield of race flags known to the
 *        player.
 */
void lore_append_drop(textblock *tb, const struct monster_race *race,
					  const struct monster_lore *lore,
					  bitflag known_flags[RF_SIZE])
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("drop");
#endif
/* AB_KNOWLEDGE_END */

	int n = 0, nspec = 0;
	monster_sex_t msex = MON_SEX_NEUTER;

	assert(tb && race && lore);
	if (!lore->drop_known) /* AB_KNOWLEDGE_INLINE_BEGIN */{ AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_end()); /* AB_KNOWLEDGE_INLINE_END */return;/* AB_KNOWLEDGE_INLINE_BEGIN */ }/* AB_KNOWLEDGE_INLINE_END */

	/* Extract a gender (if applicable) */
	msex = lore_monster_sex(race);

	/* Count maximum drop */
	n = mon_create_drop_count(race, true, false, &nspec);

	/* Drops gold and/or items */
	if (n > 0 || nspec > 0) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","carry_subject","angband.knowledge.lore.drop.carry_subject")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s may carry",
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_nominative(msex, true)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* Report general drops */
		if (n > 0) {
			bool only_item = rf_has(known_flags, RF_ONLY_ITEM);
			bool only_gold = rf_has(known_flags, RF_ONLY_GOLD);

			if (n == 1) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","general_single_quantity","angband.knowledge.lore.drop.general_single_quantity")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
					" a single ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			} else if (n == 2) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","general_one_or_two_quantity","angband.knowledge.lore.drop.general_one_or_two_quantity")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
					" one or two ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			} else {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","general_maximum_prefix","angband.knowledge.lore.drop.general_maximum_prefix")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " up to ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","general_maximum_quantity","angband.knowledge.lore.drop.general_maximum_quantity")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("count",/* AB_KNOWLEDGE_INLINE_END */n/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			}

			/* Quality */
			if (rf_has(known_flags, RF_DROP_GREAT)) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","exceptional_quality","angband.knowledge.lore.drop.exceptional_quality")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
					"exceptional ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			} else if (rf_has(known_flags, RF_DROP_GOOD)) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","good_quality","angband.knowledge.lore.drop.good_quality")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "good ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			}

			/* Objects or treasures */
			if (only_item && only_gold) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","invalid_drop_kind","angband.knowledge.lore.drop.invalid_drop_kind")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
					"error%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("plural",((n)==1?"angband.knowledge.lore.lexeme.morphology.singular":"angband.knowledge.lore.lexeme.morphology.plural"),/* AB_KNOWLEDGE_INLINE_END */PLURAL(n)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			} else if (only_item && !only_gold) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","object_drop_kind","angband.knowledge.lore.drop.object_drop_kind")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
					"object%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("plural",((n)==1?"angband.knowledge.lore.lexeme.morphology.singular":"angband.knowledge.lore.lexeme.morphology.plural"),/* AB_KNOWLEDGE_INLINE_END */PLURAL(n)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			} else if (!only_item && only_gold) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","treasure_drop_kind","angband.knowledge.lore.drop.treasure_drop_kind")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
					"treasure%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("plural",((n)==1?"angband.knowledge.lore.lexeme.morphology.singular":"angband.knowledge.lore.lexeme.morphology.plural"),/* AB_KNOWLEDGE_INLINE_END */PLURAL(n)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			} else if (!only_item && !only_gold) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","object_or_treasure_drop_kind","angband.knowledge.lore.drop.object_or_treasure_drop_kind")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
					"object%s or treasure%s",
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("objects_plural",((n)==1?"angband.knowledge.lore.lexeme.morphology.singular":"angband.knowledge.lore.lexeme.morphology.plural"),/* AB_KNOWLEDGE_INLINE_END */PLURAL(n)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("treasure_plural",((n)==1?"angband.knowledge.lore.lexeme.morphology.singular":"angband.knowledge.lore.lexeme.morphology.plural"),/* AB_KNOWLEDGE_INLINE_END */PLURAL(n)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			}
		}

		/*
		 * Report specific drops (just maximum number, no types,
		 * does not include quest artifacts).
		 */
		if (nspec > 0) {
			if (n > 0) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","specific_drop_conjunction","angband.knowledge.lore.drop.specific_drop_conjunction")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " and")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			}
			if (nspec == 1) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","specific_single_quantity","angband.knowledge.lore.drop.specific_single_quantity")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " a single")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			} else if (nspec == 2) {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","specific_one_or_two_quantity","angband.knowledge.lore.drop.specific_one_or_two_quantity")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " one or two")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			} else {
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","specific_maximum_prefix","angband.knowledge.lore.drop.specific_maximum_prefix")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " up to")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","specific_maximum_quantity","angband.knowledge.lore.drop.specific_maximum_quantity")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, " %d",
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("count",/* AB_KNOWLEDGE_INLINE_END */nspec/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			}
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","specific_items","angband.knowledge.lore.drop.specific_items")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " specific items")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		}

		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("drop","carry_end","angband.knowledge.lore.drop.carry_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ".  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Append the monster abilities (resists, weaknesses, other traits) to a
 * textblock.
 *
 * Known race flags are passed in for simplicity/efficiency. Note the macros
 * that are used to simplify the code.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 * \param lore is the known information about the monster race.
 * \param known_flags is the preprocessed bitfield of race flags known to the
 *        player.
 */
void lore_append_abilities(textblock *tb, const struct monster_race *race,
						   const struct monster_lore *lore,
						   bitflag known_flags[RF_SIZE])
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("abilities");
#endif
/* AB_KNOWLEDGE_END */

	int flag;
	char start[40];
	const char *initial_pronoun;
	bool prev = false;
	bitflag current_flags[RF_SIZE], test_flags[RF_SIZE];
	monster_sex_t msex = MON_SEX_NEUTER;

	assert(tb && race && lore);

	/* Extract a gender (if applicable) and get a pronoun for the start of
	 * sentences */
	msex = lore_monster_sex(race);
	initial_pronoun = lore_pronoun_nominative(msex, true);

	/* Describe environment-shaping abilities. */
	create_mon_flag_mask(current_flags, RFT_ALTER, RFT_MAX);
	rf_inter(current_flags, known_flags);
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_start("angband.knowledge.lore.statement.clause_start.alter_prefix",msex,true)), /* AB_KNOWLEDGE_INLINE_END */strnfmt(start, sizeof(start), "%s can ", initial_pronoun);
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_caller("alter")), /* AB_KNOWLEDGE_INLINE_END */lore_append_clause(tb, current_flags, COLOUR_WHITE, start, "and", ".  ");

	/* Describe detection traits */
	create_mon_flag_mask(current_flags, RFT_DET, RFT_MAX);
	rf_inter(current_flags, known_flags);
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_start("angband.knowledge.lore.statement.clause_start.detection_prefix",msex,true)), /* AB_KNOWLEDGE_INLINE_END */strnfmt(start, sizeof(start), "%s is ", initial_pronoun);
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_caller("detection")), /* AB_KNOWLEDGE_INLINE_END */lore_append_clause(tb, current_flags, COLOUR_WHITE, start, "and", ".  ");

	/* Describe special things */
	if (rf_has(known_flags, RF_UNAWARE))
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("abilities","disguise","angband.knowledge.lore.abilities.disguise")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s disguises itself as something else.  ",
						 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */initial_pronoun/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	if (rf_has(known_flags, RF_MULTIPLY))
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("abilities","explosive_breeding","angband.knowledge.lore.abilities.explosive_breeding")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_ORANGE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%s breeds explosively.  ",
						   /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */initial_pronoun/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	if (rf_has(known_flags, RF_REGENERATE))
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("abilities","rapid_regeneration","angband.knowledge.lore.abilities.rapid_regeneration")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s regenerates quickly.  ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */initial_pronoun/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

	/* Describe light */
	if (race->light > 1) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("abilities","lights_surroundings","angband.knowledge.lore.abilities.lights_surroundings")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s illuminates %s surroundings.  ",
						 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */initial_pronoun/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("possessive",ab_knowledge_pronoun_id(msex,true,false),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_possessive(msex, false)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	} else if (race->light == 1) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("abilities","self_illuminated","angband.knowledge.lore.abilities.self_illuminated")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s is illuminated.  ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */initial_pronoun/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	} else if (race->light == -1) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("abilities","self_darkened","angband.knowledge.lore.abilities.self_darkened")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s is darkened.  ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */initial_pronoun/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	} else if (race->light < -1) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("abilities","darkens_surroundings","angband.knowledge.lore.abilities.darkens_surroundings")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s shrouds %s surroundings in darkness.  ",
						 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */initial_pronoun/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("possessive",ab_knowledge_pronoun_id(msex,true,false),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_possessive(msex, false)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

	/* Collect susceptibilities */
	create_mon_flag_mask(current_flags, RFT_VULN, RFT_VULN_I, RFT_MAX);
	rf_inter(current_flags, known_flags);
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_start("angband.knowledge.lore.statement.clause_start.vulnerability_prefix",msex,true)), /* AB_KNOWLEDGE_INLINE_END */strnfmt(start, sizeof(start), "%s is hurt by ", initial_pronoun);
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_caller("vulnerability")), /* AB_KNOWLEDGE_INLINE_END */lore_append_clause(tb, current_flags, COLOUR_VIOLET, start, "and", "");
	if (!rf_is_empty(current_flags)) {
		prev = true;
	}

	/* Collect immunities and resistances */
	create_mon_flag_mask(current_flags, RFT_RES, RFT_MAX);
	rf_inter(current_flags, known_flags);

	/* Note lack of vulnerability as a resistance */
	create_mon_flag_mask(test_flags, RFT_VULN, RFT_MAX);
	for (flag = rf_next(test_flags, FLAG_START); flag;
		 flag = rf_next(test_flags, flag + 1)) {
		if (rf_has(lore->flags, flag) && !rf_has(known_flags, flag)) {
			rf_on(current_flags, flag);
		}
	}
	if (prev) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_start("angband.knowledge.lore.statement.clause_start.resistance_continuation",msex,false)), /* AB_KNOWLEDGE_INLINE_END */my_strcpy(start, ", but resists ", sizeof(start));
	} else {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_start("angband.knowledge.lore.statement.clause_start.resistance_prefix",msex,true)), /* AB_KNOWLEDGE_INLINE_END */strnfmt(start, sizeof(start), "%s resists ", initial_pronoun);
	}
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_caller("resistance")), /* AB_KNOWLEDGE_INLINE_END */lore_append_clause(tb, current_flags, COLOUR_L_UMBER, start, "and", "");
	if (!rf_is_empty(current_flags)) {
		prev = true;
	}

	/* Collect known but average susceptibilities */
	rf_wipe(current_flags);
	create_mon_flag_mask(test_flags, RFT_RES, RFT_MAX);
	for (flag = rf_next(test_flags, FLAG_START); flag;
		 flag = rf_next(test_flags, flag + 1)) {
		if (rf_has(lore->flags, flag) && !rf_has(known_flags, flag)) {
			rf_on(current_flags, flag);
		}
	}

	/* Vulnerabilities need to be specifically removed */
	create_mon_flag_mask(test_flags, RFT_VULN_I, RFT_MAX);
	rf_inter(test_flags, known_flags);
	for (flag = rf_next(test_flags, FLAG_START); flag;
		 flag = rf_next(test_flags, flag + 1)) {
		int susc_flag;
		for (susc_flag = rf_next(current_flags, FLAG_START); susc_flag;
			 susc_flag = rf_next(current_flags, susc_flag + 1)) {
			if (streq(describe_race_flag(flag), describe_race_flag(susc_flag)))
				rf_off(current_flags, susc_flag);
		}
	}
	if (prev) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_start("angband.knowledge.lore.statement.clause_start.nonresistance_continuation",msex,false)), /* AB_KNOWLEDGE_INLINE_END */my_strcpy(start, ", and does not resist ", sizeof(start));
	} else {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_start("angband.knowledge.lore.statement.clause_start.nonresistance_prefix",msex,true)), /* AB_KNOWLEDGE_INLINE_END */strnfmt(start, sizeof(start), "%s does not resist ",
			initial_pronoun);
	}

	/* Special case for undead */
	if (rf_has(known_flags, RF_UNDEAD)) {
		rf_off(current_flags, RF_IM_NETHER);
	}

	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_caller("nonresistance")), /* AB_KNOWLEDGE_INLINE_END */lore_append_clause(tb, current_flags, COLOUR_L_UMBER, start, "or", "");
	if (!rf_is_empty(current_flags)) {
		prev = true;
	}

	/* Collect non-effects */
	create_mon_flag_mask(current_flags, RFT_PROT, RFT_MAX);
	rf_inter(current_flags, known_flags);
	if (prev) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_start("angband.knowledge.lore.statement.clause_start.effect_immunity_continuation",msex,false)), /* AB_KNOWLEDGE_INLINE_END */my_strcpy(start, ", and cannot be ", sizeof(start));
	} else {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_prepare_start("angband.knowledge.lore.statement.clause_start.effect_immunity_prefix",msex,true)), /* AB_KNOWLEDGE_INLINE_END */strnfmt(start, sizeof(start), "%s cannot be ", initial_pronoun);
	}
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_caller("effect_immunity")), /* AB_KNOWLEDGE_INLINE_END */lore_append_clause(tb, current_flags, COLOUR_L_UMBER, start, "or", "");
	if (!rf_is_empty(current_flags)) {
		prev = true;
	}

	if (prev)
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("abilities","resistance_sentence_end","angband.knowledge.lore.abilities.resistance_sentence_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ".  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Append how the monster reacts to intruders and at what distance it does so.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 * \param lore is the known information about the monster race.
 * \param known_flags is the preprocessed bitfield of race flags known to the
 *        player.
 */
void lore_append_awareness(textblock *tb, const struct monster_race *race,
						   const struct monster_lore *lore,
						   bitflag known_flags[RF_SIZE])
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("awareness");
#endif
/* AB_KNOWLEDGE_END */

	monster_sex_t msex = MON_SEX_NEUTER;

	assert(tb && race && lore);

	/* Extract a gender (if applicable) */
	msex = lore_monster_sex(race);

	/* Do we know how aware it is? */
	if (lore->sleep_known)
	{
		const char *aware = lore_describe_awareness(race->sleep);
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("awareness","awareness_subject_predicate","angband.knowledge.lore.awareness.awareness_subject_predicate")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s %s intruders, which %s may notice from ",
						 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_nominative(msex, true)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("awareness",ab_knowledge_last_lexeme(),/* AB_KNOWLEDGE_INLINE_END */aware/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */,
						 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("observer",ab_knowledge_pronoun_id(msex,false,false),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_nominative(msex, false)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("awareness","notice_distance","angband.knowledge.lore.awareness.notice_distance")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("feet",/* AB_KNOWLEDGE_INLINE_END */10 * race->hearing/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("awareness","notice_distance_end","angband.knowledge.lore.awareness.notice_distance_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " feet.  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Append information about what other races the monster appears with and if
 * they work together.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 * \param lore is the known information about the monster race.
 * \param known_flags is the preprocessed bitfield of race flags known to the
 *        player.
 */
void lore_append_friends(textblock *tb, const struct monster_race *race,
						 const struct monster_lore *lore,
						 bitflag known_flags[RF_SIZE])
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("friends");
#endif
/* AB_KNOWLEDGE_END */

	monster_sex_t msex = MON_SEX_NEUTER;

	assert(tb && race && lore);

	/* Extract a gender (if applicable) */
	msex = lore_monster_sex(race);

	/* Describe friends */
	if (race->friends || race->friends_base) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("friends","other_monsters","angband.knowledge.lore.friends.other_monsters")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s may appear with other monsters",
						 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_nominative(msex, true)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		if (rf_has(known_flags, RF_GROUP_AI))
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("friends","pack_hunting","angband.knowledge.lore.friends.pack_hunting")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " and hunts in packs")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("friends","sentence_end","angband.knowledge.lore.friends.sentence_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ".  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Append the monster's attack spells to a textblock.
 *
 * Known race flags are passed in for simplicity/efficiency. Note the macros
 * that are used to simplify the code.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 * \param lore is the known information about the monster race.
 * \param known_flags is the preprocessed bitfield of race flags known to the
 *        player.
 */
void lore_append_spells(textblock *tb, const struct monster_race *race,
						const struct monster_lore *lore,
						bitflag known_flags[RF_SIZE])
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("spells");
#endif
/* AB_KNOWLEDGE_END */

	monster_sex_t msex = MON_SEX_NEUTER;
	bool innate = false;
	bool breath = false;
	const char *initial_pronoun;
	bool know_hp;
	bitflag current_flags[RSF_SIZE], test_flags[RSF_SIZE];
	const struct monster_race *old_ref;

	assert(tb && race && lore);

	/* Set the race for expressions in the spells. */
	old_ref = ref_race;
	ref_race = race;

	know_hp = lore->armour_known;

	/* Extract a gender (if applicable) and get a pronoun for the start of
	 * sentences */
	msex = lore_monster_sex(race);
	initial_pronoun = lore_pronoun_nominative(msex, true);

	/* Collect innate (non-breath) attacks */
	create_mon_spell_mask(current_flags, RST_INNATE, RST_NONE);
	rsf_inter(current_flags, lore->spell_flags);
	create_mon_spell_mask(test_flags, RST_BREATH, RST_NONE);
	rsf_diff(current_flags, test_flags);
	if (!rsf_is_empty(current_flags)) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","innate_subject","angband.knowledge.lore.spells.innate_subject")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s may ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */initial_pronoun/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_caller("innate")), /* AB_KNOWLEDGE_INLINE_END */lore_append_spell_clause(tb, current_flags, know_hp, race, "or", "");
		innate = true;
	}

	/* Collect breaths */
	create_mon_spell_mask(current_flags, RST_BREATH, RST_NONE);
	rsf_inter(current_flags, lore->spell_flags);
	if (!rsf_is_empty(current_flags)) {
		if (innate) {
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","breath_transition","angband.knowledge.lore.spells.breath_transition")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", and may ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		} else {
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","breath_subject","angband.knowledge.lore.spells.breath_subject")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s may ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */initial_pronoun/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		}
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","breath_action","angband.knowledge.lore.spells.breath_action")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_RED/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "breathe ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_caller("breath")), /* AB_KNOWLEDGE_INLINE_END */lore_append_spell_clause(tb, current_flags, know_hp, race, "or", "");
		breath = true;
	}

	/* End the sentence about innate spells and breaths */
	if ((innate || breath) && race->freq_innate) {
		if (lore->innate_freq_known) {
			/* Describe the spell frequency */
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","innate_exact_frequency_separator","angband.knowledge.lore.spells.innate_exact_frequency_separator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "; ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","innate_exact_frequency_numerator","angband.knowledge.lore.spells.innate_exact_frequency_numerator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "1")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","innate_exact_frequency_unit","angband.knowledge.lore.spells.innate_exact_frequency_unit")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " time in ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","innate_exact_frequency_denominator","angband.knowledge.lore.spells.innate_exact_frequency_denominator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d",
							   /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("denominator",/* AB_KNOWLEDGE_INLINE_END */100 / race->freq_innate/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		} else if (lore->cast_innate) {
			/* Guess at the frequency */
			int approx_frequency = MAX(((race->freq_innate + 9) / 10) * 10, 1);
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","innate_approx_frequency_separator","angband.knowledge.lore.spells.innate_approx_frequency_separator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "; about ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","innate_approx_frequency_numerator","angband.knowledge.lore.spells.innate_approx_frequency_numerator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "1")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","innate_approx_frequency_unit","angband.knowledge.lore.spells.innate_approx_frequency_unit")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " time in ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","innate_approx_frequency_denominator","angband.knowledge.lore.spells.innate_approx_frequency_denominator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d",
							   /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("denominator",/* AB_KNOWLEDGE_INLINE_END */100 / approx_frequency/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		}

		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","innate_frequency_end","angband.knowledge.lore.spells.innate_frequency_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ".  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

	/* Collect spell information */
	rsf_copy(current_flags, lore->spell_flags);
	create_mon_spell_mask(test_flags, RST_BREATH, RST_INNATE, RST_NONE);
	rsf_diff(current_flags, test_flags);
	if (!rsf_is_empty(current_flags)) {
		/* Intro */
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","magic_subject","angband.knowledge.lore.spells.magic_subject")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s may ", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */initial_pronoun/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* Verb Phrase */
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","cast_spells","angband.knowledge.lore.spells.cast_spells")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_RED/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "cast spells")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* Adverb */
		if (rf_has(known_flags, RF_SMART))
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","intelligent_casting","angband.knowledge.lore.spells.intelligent_casting")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " intelligently")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* List */
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","spell_list_transition","angband.knowledge.lore.spells.spell_list_transition")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " which ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_caller("magic")), /* AB_KNOWLEDGE_INLINE_END */lore_append_spell_clause(tb, current_flags, know_hp, race, "or", "");

		/* End the sentence about innate/other spells */
		if (race->freq_spell) {
			if (lore->spell_freq_known) {
				/* Describe the spell frequency */
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","magic_exact_frequency_separator","angband.knowledge.lore.spells.magic_exact_frequency_separator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "; ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","magic_exact_frequency_numerator","angband.knowledge.lore.spells.magic_exact_frequency_numerator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "1")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","magic_exact_frequency_unit","angband.knowledge.lore.spells.magic_exact_frequency_unit")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " time in ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","magic_exact_frequency_denominator","angband.knowledge.lore.spells.magic_exact_frequency_denominator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d",
								   /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("denominator",/* AB_KNOWLEDGE_INLINE_END */100 / race->freq_spell/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			} else if (lore->cast_spell) {
				/* Guess at the frequency */
				int approx_frequency = MAX(((race->freq_spell + 9) / 10) * 10,
										   1);
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","magic_approx_frequency_separator","angband.knowledge.lore.spells.magic_approx_frequency_separator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "; about ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","magic_approx_frequency_numerator","angband.knowledge.lore.spells.magic_approx_frequency_numerator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "1")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","magic_approx_frequency_unit","angband.knowledge.lore.spells.magic_approx_frequency_unit")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " time in ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","magic_approx_frequency_denominator","angband.knowledge.lore.spells.magic_approx_frequency_denominator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d",
								   /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("denominator",/* AB_KNOWLEDGE_INLINE_END */100 / approx_frequency/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			}
		}

		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("spells","magic_sentence_end","angband.knowledge.lore.spells.magic_sentence_end")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ".  ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}

	/* Restore the previous reference. */
	ref_race = old_ref;

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Append the monster's melee attacks to a textblock.
 *
 * Known race flags are passed in for simplicity/efficiency.
 *
 * \param tb is the textblock we are adding to.
 * \param race is the monster race we are describing.
 * \param lore is the known information about the monster race.
 * \param known_flags is the preprocessed bitfield of race flags known to the
 *        player.
 */
void lore_append_attack(textblock *tb, const struct monster_race *race,
						const struct monster_lore *lore,
						bitflag known_flags[RF_SIZE])
{
/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_begin("attacks");
#endif
/* AB_KNOWLEDGE_END */

	int i, known_attacks, total_attacks, described_count, total_centidamage;
	monster_sex_t msex = MON_SEX_NEUTER;

	assert(tb && race && lore);

	/* Extract a gender (if applicable) */
	msex = lore_monster_sex(race);

	/* Notice lack of attacks */
	if (rf_has(known_flags, RF_NEVER_BLOW)) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","no_physical_attacks","angband.knowledge.lore.attacks.no_physical_attacks")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s has no physical attacks.  ",
						 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_nominative(msex, true)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */{ AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_end()); /* AB_KNOWLEDGE_INLINE_END */return;/* AB_KNOWLEDGE_INLINE_BEGIN */ }/* AB_KNOWLEDGE_INLINE_END */
	}

	total_attacks = 0;
	known_attacks = 0;

	/* Count the number of defined and known attacks */
	for (i = 0; i < z_info->mon_blows_max; i++) {
		/* Skip non-attacks */
		if (!race->blow[i].method) continue;

		total_attacks++;
		if (lore->blow_known[i])
			known_attacks++;
	}

	/* Describe the lack of knowledge */
	if (known_attacks == 0) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","attacks_unknown","angband.knowledge.lore.attacks.attacks_unknown")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_ORANGE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "Nothing is known about %s attack.  ",
						 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("possessive",ab_knowledge_pronoun_id(msex,true,false),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_possessive(msex, false)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		/* AB_KNOWLEDGE_INLINE_BEGIN */{ AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_end()); /* AB_KNOWLEDGE_INLINE_END */return;/* AB_KNOWLEDGE_INLINE_BEGIN */ }/* AB_KNOWLEDGE_INLINE_END */
	}

	described_count = 0;
	total_centidamage = 99; // round up the final result to the next higher point

	/* Describe each melee attack */
	for (i = 0; i < z_info->mon_blows_max; i++) {
		random_value dice;
		const char *effect_str = NULL;

		/* Skip unknown and undefined attacks */
		if (!race->blow[i].method || !lore->blow_known[i]) continue;

		/* Extract the attack info */
		dice = race->blow[i].dice;
		effect_str = race->blow[i].effect->desc;

		/* Introduce the attack description */
		if (described_count == 0)
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","attack_subject","angband.knowledge.lore.attacks.attack_subject")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s can ",
							 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("subject",ab_knowledge_pronoun_id(msex,false,true),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_nominative(msex, true)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		else if (described_count < known_attacks - 1)
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","attack_item_separator","angband.knowledge.lore.attacks.attack_item_separator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
		else
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","attack_final_separator","angband.knowledge.lore.attacks.attack_final_separator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", and ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* Describe the method */
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","attack_method","angband.knowledge.lore.attacks.attack_method")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COMBAT("method",/* AB_KNOWLEDGE_INLINE_END */race->blow[i].method->desc/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

		/* Describe the effect (if any) */
		if (effect_str && strlen(effect_str) > 0) {
			int index = blow_index(race->blow[i].effect->name);
			/* Describe the attack type */
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","attack_effect_transition","angband.knowledge.lore.attacks.attack_effect_transition")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " to ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","attack_effect","angband.knowledge.lore.attacks.attack_effect")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */blow_color(player, index)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%s", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COMBAT("effect",/* AB_KNOWLEDGE_INLINE_END */effect_str/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","attack_details_open","angband.knowledge.lore.attacks.attack_details_open")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " (")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			/* Describe damage (if known) */
			if (dice.base || (dice.dice && dice.sides) || dice.m_bonus) {
				if (dice.base)
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","damage_base","angband.knowledge.lore.attacks.damage_base")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("base",/* AB_KNOWLEDGE_INLINE_END */dice.base/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

				if (dice.dice && dice.sides)
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","damage_dice","angband.knowledge.lore.attacks.damage_dice")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%dd%d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("dice",/* AB_KNOWLEDGE_INLINE_END */dice.dice/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("sides",/* AB_KNOWLEDGE_INLINE_END */dice.sides/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

				if (dice.m_bonus)
					/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","damage_level_bonus","angband.knowledge.lore.attacks.damage_level_bonus")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "M%d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("bonus",/* AB_KNOWLEDGE_INLINE_END */dice.m_bonus/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

				/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","damage_hit_separator","angband.knowledge.lore.attacks.damage_hit_separator")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", ")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			}

			/* Describe hit chances */
			random_chance c;
			hit_chance(&c, chance_of_monster_hit_base(race, race->blow[i].effect),
				player->state.ac + player->state.to_a);
			int percent = random_chance_scaled(c, 100);
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","attack_hit_percent","angband.knowledge.lore.attacks.attack_hit_percent")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_BLUE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, "%d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("percent",/* AB_KNOWLEDGE_INLINE_END */percent/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
			/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","attack_details_close","angband.knowledge.lore.attacks.attack_details_close")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "%%)")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

			total_centidamage += (percent * randcalc(dice, 0, AVERAGE));
		}

		described_count++;
	}

	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","average_damage_prefix","angband.knowledge.lore.attacks.average_damage_prefix")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, ", averaging")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	if (known_attacks < total_attacks) {
		/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","average_damage_lower_bound","angband.knowledge.lore.attacks.average_damage_lower_bound")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_ORANGE/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, " at least")/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	}
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","average_damage_value","angband.knowledge.lore.attacks.average_damage_value")), /* AB_KNOWLEDGE_INLINE_END */textblock_append_c(tb, /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_COLOR(/* AB_KNOWLEDGE_INLINE_END */COLOUR_L_GREEN/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */, " %d", /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_INT("damage",/* AB_KNOWLEDGE_INLINE_END */total_centidamage/100/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;
	/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_begin("attacks","average_damage_per_turn","angband.knowledge.lore.attacks.average_damage_per_turn")), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " damage on each of %s turns.  ",
					 /* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_TEXT("possessive",ab_knowledge_pronoun_id(msex,true,false),/* AB_KNOWLEDGE_INLINE_END */lore_pronoun_possessive(msex, false)/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */)/* AB_KNOWLEDGE_INLINE_BEGIN */, AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())/* AB_KNOWLEDGE_INLINE_END */;

/* AB_KNOWLEDGE_BEGIN */
#ifdef __EMSCRIPTEN__
ab_knowledge_section_end();
#endif
/* AB_KNOWLEDGE_END */
}

/**
 * Get the lore record for this monster race.
 */
struct monster_lore *get_lore(const struct monster_race *race)
{
	assert(race);
	return &l_list[race->ridx];
}


/**
 * Write the monster lore
 */
static void write_lore_entries(ang_file *fff)
{
	int i, n;

	for (i = 0; i < z_info->r_max; i++) {
		/* Current entry */
		struct monster_race *race = &r_info[i];
		struct monster_lore *lore = &l_list[i];

		/* Ignore non-existent or unseen monsters */
		if (!race->name) continue;
		if (!lore->sights && !lore->all_known) continue;

		/* Output 'name' */
		file_putf(fff, "name:%s\n", race->name);

		/* Output base if we're remembering everything */
		if (lore->all_known)
			file_putf(fff, "base:%s\n", race->base->name);

		/* Output counts */
		file_putf(fff, "counts:%d:%d:%d:%d:%d:%d:%d\n", lore->sights,
				  lore->deaths, lore->tkills, lore->wake, lore->ignore,
				  lore->cast_innate, lore->cast_spell);

		/* Output blow (up to max blows) */
		for (n = 0; n < z_info->mon_blows_max; n++) {
			/* End of blows */
			if (!lore->blow_known[n] && !lore->all_known) continue;
			if (!lore->blows[n].method) continue;

			/* Output blow method */
			file_putf(fff, "blow:%s", lore->blows[n].method->name);

			/* Output blow effect (may be none) */
			file_putf(fff, ":%s", lore->blows[n].effect->name);

			/* Output blow damage (may be 0) */
			file_putf(fff, ":%d+%dd%dM%d", lore->blows[n].dice.base,
					lore->blows[n].dice.dice,
					lore->blows[n].dice.sides,
					lore->blows[n].dice.m_bonus);

			/* Output number of times that blow has been seen */
			file_putf(fff, ":%d", lore->blows[n].times_seen);

			/* Output blow index */
			file_putf(fff, ":%d", n);

			/* End line */
			file_putf(fff, "\n");
		}

		/* Output flags */
		write_flags(fff, "flags:", lore->flags, RF_SIZE, r_info_flags);

		/* Output spell flags (multiple lines) */
		rsf_inter(lore->spell_flags, race->spell_flags);
		write_flags(fff, "spells:", lore->spell_flags, RSF_SIZE,
					r_info_spell_flags);

		/* Output 'drop' */
		if (lore->drops) {
			struct monster_drop *drop = lore->drops;
			char name[120] = "";

			while (drop) {
				struct object_kind *kind = drop->kind;

				if (kind) {
					object_short_name(name, sizeof name, kind->name);
					file_putf(fff, "drop:%s:%s:%d:%d:%d\n",
							  tval_find_name(kind->tval), name,
							  drop->percent_chance, drop->min, drop->max);
					drop = drop->next;
				} else {
					file_putf(fff, "drop-base:%s:%d:%d:%d\n",
							  tval_find_name(drop->tval), drop->percent_chance,
							  drop->min, drop->max);
					drop = drop->next;
				}
			}
		}

		/* Output 'friends' */
		if (lore->friends) {
			struct monster_friends *f = lore->friends;

			while (f) {
				if (f->role == MON_GROUP_MEMBER) {
					file_putf(fff, "friends:%d:%dd%d:%s\n", f->percent_chance,
							  f->number_dice, f->number_side, f->race->name);
				} else {
					char *role_name = NULL;
					if (f->role == MON_GROUP_SERVANT) {
						role_name = string_make("servant");
					} else if (f->role == MON_GROUP_BODYGUARD) {
						role_name = string_make("bodyguard");
					}
					file_putf(fff, "friends:%d:%dd%d:%s:%s\n",
							  f->percent_chance, f->number_dice,
							  f->number_side, f->race->name, role_name);
					string_free(role_name);
				}
				f = f->next;
			}
		}

		/* Output 'friends-base' */
		if (lore->friends_base) {
			struct monster_friends_base *b = lore->friends_base;

			while (b) {
				if (b->role == MON_GROUP_MEMBER) {
					file_putf(fff, "friends-base:%d:%dd%d:%s\n",
							  b->percent_chance, b->number_dice,
							  b->number_side, b->base->name);
				} else {
					char *role_name = NULL;
					if (b->role == MON_GROUP_SERVANT) {
						role_name = string_make("servant");
					} else if (b->role == MON_GROUP_BODYGUARD) {
						role_name = string_make("bodyguard");
					}
					file_putf(fff, "friends-base:%d:%dd%d:%s:%s\n",
							  b->percent_chance, b->number_dice,
							  b->number_side, b->base->name, role_name);
					string_free(role_name);
				}
				b = b->next;
			}
		}

		/* Output 'mimic' */
		if (lore->mimic_kinds) {
			struct monster_mimic *m = lore->mimic_kinds;
			struct object_kind *kind = m->kind;
			char name[120] = "";

			while (m) {
				object_short_name(name, sizeof name, kind->name);
				file_putf(fff, "mimic:%s:%s\n",
						  tval_find_name(kind->tval), name);
				m = m->next;
			}
		}

		file_putf(fff, "\n");
	}
}


/**
 * Save the lore to a file in the user directory.
 *
 * \param name is the filename
 *
 * \returns true on success, false otherwise.
 */
bool lore_save(const char *name)
{
	char path[1024];

	/* Write to the user directory */
	path_build(path, sizeof(path), ANGBAND_DIR_USER, name);

	if (text_lines_to_file(path, write_lore_entries)) {
		/* AB_GAME_DYNAMIC_BEGIN */
#ifdef __EMSCRIPTEN__
ab_dynamic_msg("game.message.mon_lore.lore_save.failed_to_create_file_path_new", "path:F;", "Failed to create file %s.new", path);
#else
/* AB_GAME_DYNAMIC_END */msg("Failed to create file %s.new", path);/* AB_GAME_DYNAMIC_BEGIN */
#endif
/* AB_GAME_DYNAMIC_END */
		return false;
	}

	return true;
}
