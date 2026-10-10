/**
 * \file web-checkpoint.c
 * \brief Extra state omitted by native saves at a browser command boundary.
 *
 * Copyright (c) 2026 Angband browser port contributors
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * This supplements the original save blocks.  It does not serialize C structs,
 * pointers, an executing command, the call stack, or pending terminal input.
 * The browser adapter restores its separately versioned full RNG snapshot only
 * after this block and UI startup have completed successfully.
 */
#include "angband.h"
#include "web-checkpoint.h"

#ifdef __EMSCRIPTEN__
#include "cave.h"
#include "cmd-core.h"
#include "game-world.h"
#include "init.h"
#include "mon-blows.h"
#include "mon-group.h"
#include "mon-lore.h"
#include "monster.h"
#include "object.h"
#include "player-util.h"
#include "savefile.h"
#include "target.h"
#include "ui-display.h"
#include "ui-input.h"
#include "ui-output.h"

#define AB_WEB_CHECKPOINT_VERSION 1
#define AB_WEB_LORE_LIST_LIMIT 4096
#define AB_WEB_CHUNK_LIMIT 4096
#define AB_WEB_NULL_INDEX UINT16_MAX

bool ab_web_checkpoint_restore_requested;
bool ab_web_checkpoint_loaded;

static bool rd_bool(bool *out)
{
	uint8_t value;
	rd_byte(&value);
	if (value > 1) return false;
	*out = value != 0;
	return true;
}

static void wr_int(int value) { wr_s32b(value); }
static void rd_int(int *value)
{
	int32_t stored;
	rd_s32b(&stored);
	*value = stored;
}

static void wr_loc(struct loc value)
{
	wr_int(value.x);
	wr_int(value.y);
}

static void rd_loc(struct loc *value)
{
	rd_int(&value->x);
	rd_int(&value->y);
}

static bool valid_native_loc(struct loc value)
{
	return value.x >= 0 && value.x <= 255 &&
		value.y >= 0 && value.y <= 255;
}

static void wr_target_value(const struct target *value)
{
	wr_loc(value->grid);
	wr_int(value->midx);
}

static bool rd_target_value(struct target *value)
{
	rd_loc(&value->grid);
	rd_int(&value->midx);
	return valid_native_loc(value->grid) && value->midx >= 0 &&
		value->midx < z_info->level_monster_max;
}

/* Enumerated primitive fields, rather than a platform-dependent struct dump. */
#define AB_WEB_PLAYER_STATE_INTS(X) \
	X(speed) X(num_blows) X(num_shots) X(num_moves) X(ammo_mult) \
	X(ammo_tval) X(ac) X(dam_red) X(perc_dam_red) X(to_a) X(to_h) \
	X(to_d) X(see_infra) X(cur_light)
#define AB_WEB_PLAYER_STATE_BOOLS(X) \
	X(heavy_wield) X(heavy_shoot) X(bless_wield) X(cumber_armor)

static void wr_player_state(const struct player_state *state)
{
	int i;
	for (i = 0; i < STAT_MAX; i++) {
		wr_int(state->stat_add[i]);
		wr_int(state->stat_ind[i]);
		wr_int(state->stat_use[i]);
		wr_int(state->stat_top[i]);
	}
	for (i = 0; i < SKILL_MAX; i++) wr_int(state->skills[i]);
#define WR_STATE_INT(field) wr_int(state->field);
	AB_WEB_PLAYER_STATE_INTS(WR_STATE_INT)
#undef WR_STATE_INT
#define WR_STATE_BOOL(field) wr_byte(state->field ? 1 : 0);
	AB_WEB_PLAYER_STATE_BOOLS(WR_STATE_BOOL)
#undef WR_STATE_BOOL
	for (i = 0; i < OF_SIZE; i++) wr_byte(state->flags[i]);
	for (i = 0; i < PF_SIZE; i++) wr_byte(state->pflags[i]);
	for (i = 0; i < ELEM_MAX; i++) {
		wr_s16b(state->el_info[i].res_level);
		wr_byte(state->el_info[i].flags);
	}
}

static bool rd_player_state(struct player_state *state)
{
	int i;
	for (i = 0; i < STAT_MAX; i++) {
		rd_int(&state->stat_add[i]);
		rd_int(&state->stat_ind[i]);
		rd_int(&state->stat_use[i]);
		rd_int(&state->stat_top[i]);
		if (state->stat_ind[i] < 0 || state->stat_ind[i] >= STAT_RANGE)
			return false;
	}
	for (i = 0; i < SKILL_MAX; i++) rd_int(&state->skills[i]);
#define RD_STATE_INT(field) rd_int(&state->field);
	AB_WEB_PLAYER_STATE_INTS(RD_STATE_INT)
#undef RD_STATE_INT
#define RD_STATE_BOOL(field) if (!rd_bool(&state->field)) return false;
	AB_WEB_PLAYER_STATE_BOOLS(RD_STATE_BOOL)
#undef RD_STATE_BOOL
	for (i = 0; i < OF_SIZE; i++) rd_byte(&state->flags[i]);
	for (i = 0; i < PF_SIZE; i++) rd_byte(&state->pflags[i]);
	for (i = 0; i < ELEM_MAX; i++) {
		rd_s16b(&state->el_info[i].res_level);
		rd_byte(&state->el_info[i].flags);
	}
	return true;
}

static bool valid_chunk(const struct chunk *c)
{
	return c && c->height > 0 && c->height <= 256 &&
		c->width > 0 && c->width <= 256 && c->squares &&
		c->noise.grids && c->scent.grids && c->monsters &&
		c->monster_groups && c->mon_max > 0 &&
		c->mon_max <= z_info->level_monster_max && c->mon_cnt < c->mon_max;
}

/* Group order matters: group AI selects the first eligible tracking member. */
static void wr_groups(const struct chunk *c)
{
	int i;
	uint16_t count = 0;
	for (i = 0; i < z_info->level_monster_max; i++)
		if (c->monster_groups[i]) count++;
	wr_u16b(count);
	for (i = 0; i < z_info->level_monster_max; i++) {
		const struct monster_group *group = c->monster_groups[i];
		const struct mon_group_list_entry *entry;
		uint16_t members = 0;
		if (!group) continue;
		for (entry = group->member_list; entry; entry = entry->next)
			members++;
		wr_u16b(i);
		wr_int(group->index);
		wr_int(group->leader);
		wr_u16b(members);
		for (entry = group->member_list; entry; entry = entry->next)
			wr_int(entry->midx);
	}
}

static void free_group_entries(struct monster_group *group)
{
	struct mon_group_list_entry *entry = group->member_list;
	while (entry) {
		struct mon_group_list_entry *next = entry->next;
		mem_free(entry);
		entry = next;
	}
	mem_free(group);
}

static bool rd_groups(struct chunk *c)
{
	uint16_t count, n;
	int i;
	bool *seen = NULL;
	struct monster_group **groups = NULL;
	bool okay = false;

	rd_u16b(&count);
	if (count > z_info->level_monster_max) return false;
	seen = mem_zalloc(z_info->level_monster_max * sizeof(*seen));
	groups = mem_zalloc(z_info->level_monster_max * sizeof(*groups));
	for (n = 0; n < count; n++) {
		uint16_t slot, members, j;
		struct monster_group *group;
		struct mon_group_list_entry **tail;
		rd_u16b(&slot);
		if (slot >= z_info->level_monster_max || seen[slot]) goto cleanup;
		seen[slot] = true;
		group = mem_zalloc(sizeof(*group));
		groups[slot] = group;
		rd_int(&group->index);
		rd_int(&group->leader);
		rd_u16b(&members);
		if (group->index != slot || group->leader < 0 ||
			group->leader >= c->mon_max || members > c->mon_cnt)
			goto cleanup;
		if (group->leader && !c->monsters[group->leader].race) goto cleanup;
		tail = &group->member_list;
		for (j = 0; j < members; j++) {
			int midx;
			struct mon_group_list_entry *entry;
			rd_int(&midx);
			if (midx <= 0 || midx >= c->mon_max ||
				!c->monsters[midx].race) goto cleanup;
			entry = mem_zalloc(sizeof(*entry));
			entry->midx = midx;
			*tail = entry;
			tail = &entry->next;
		}
	}
	for (i = 0; i < z_info->level_monster_max; i++) {
		if (c->monster_groups[i]) free_group_entries(c->monster_groups[i]);
		c->monster_groups[i] = groups[i];
		groups[i] = NULL;
	}
	okay = true;
cleanup:
	for (i = 0; i < z_info->level_monster_max; i++)
		if (groups[i]) free_group_entries(groups[i]);
	mem_free(groups);
	mem_free(seen);
	return okay;
}

static void wr_chunk(const struct chunk *c)
{
	int x, y, i, j;
	wr_u16b(c->height);
	wr_u16b(c->width);
	wr_u16b(c->obj_max);
	wr_u16b(c->mon_max);
	wr_u16b(c->mon_cnt);
	wr_int(c->depth);
	wr_u32b(c->obj_rating);
	wr_u32b(c->mon_rating);
	wr_byte(c->good_item ? 1 : 0);
	wr_loc(c->decoy);
	wr_int(c->mon_current);
	wr_int(c->num_repro);
	for (i = 0; i <= FEAT_MAX; i++) wr_int(c->feat_count[i]);
	for (y = 0; y < c->height; y++) {
		for (x = 0; x < c->width; x++) {
			const struct square *sq = &c->squares[y][x];
			wr_byte(sq->feat);
			for (i = 0; i < SQUARE_SIZE; i++) wr_byte(sq->info[i]);
			wr_int(sq->light);
			wr_u16b(c->noise.grids[y][x]);
			wr_u16b(c->scent.grids[y][x]);
		}
	}
	for (i = 1; i < c->mon_max; i++) {
		const struct monster *mon = &c->monsters[i];
		wr_byte(mon->race ? 1 : 0);
		if (!mon->race) continue;
		wr_target_value(&mon->target);
		wr_byte(mon->cdis);
		wr_byte(mon->attr);
		wr_byte(mon->min_range);
		wr_byte(mon->best_range);
		for (j = 0; j < MFLAG_SIZE; j++) wr_byte(mon->mflag[j]);
		for (j = 0; j < PF_SIZE; j++) wr_byte(mon->known_pstate.pflags[j]);
	}
	wr_groups(c);
}

static bool rd_chunk(struct chunk *c)
{
	uint16_t height, width, obj_max, mon_max, mon_cnt;
	int x, y, i, j;
	rd_u16b(&height);
	rd_u16b(&width);
	rd_u16b(&obj_max);
	rd_u16b(&mon_max);
	rd_u16b(&mon_cnt);
	if (!valid_chunk(c) || height != c->height || width != c->width ||
		obj_max != c->obj_max || mon_max != c->mon_max ||
		mon_cnt != c->mon_cnt) return false;
	rd_int(&c->depth);
	if (c->depth < 0 || c->depth >= z_info->max_depth) return false;
	rd_u32b(&c->obj_rating);
	rd_u32b(&c->mon_rating);
	if (!rd_bool(&c->good_item)) return false;
	rd_loc(&c->decoy);
	rd_int(&c->mon_current);
	rd_int(&c->num_repro);
	if (!valid_native_loc(c->decoy) ||
		(!loc_is_zero(c->decoy) && !square_in_bounds(c, c->decoy)) ||
		c->mon_current < -1 || c->mon_current >= c->mon_max ||
		c->num_repro < 0 || c->num_repro > c->mon_cnt) return false;
	for (i = 0; i <= FEAT_MAX; i++) {
		rd_int(&c->feat_count[i]);
		if (c->feat_count[i] < 0 ||
			c->feat_count[i] > c->height * c->width) return false;
	}
	for (y = 0; y < c->height; y++) {
		for (x = 0; x < c->width; x++) {
			struct square *sq = &c->squares[y][x];
			rd_byte(&sq->feat);
			if (sq->feat >= FEAT_MAX) return false;
			for (i = 0; i < SQUARE_SIZE; i++) rd_byte(&sq->info[i]);
			rd_int(&sq->light);
			rd_u16b(&c->noise.grids[y][x]);
			rd_u16b(&c->scent.grids[y][x]);
		}
	}
	for (i = 1; i < c->mon_max; i++) {
		struct monster *mon = &c->monsters[i];
		bool present;
		if (!rd_bool(&present) || present != (mon->race != NULL)) return false;
		if (!present) continue;
		if (!rd_target_value(&mon->target)) return false;
		rd_byte(&mon->cdis);
		rd_byte(&mon->attr);
		rd_byte(&mon->min_range);
		rd_byte(&mon->best_range);
		for (j = 0; j < MFLAG_SIZE; j++) rd_byte(&mon->mflag[j]);
		for (j = 0; j < PF_SIZE; j++) rd_byte(&mon->known_pstate.pflags[j]);
	}
	return rd_groups(c);
}

static uint16_t method_index(const struct blow_method *value)
{
	uint16_t i;
	if (!value) return AB_WEB_NULL_INDEX;
	for (i = 0; i < z_info->blow_methods_max; i++)
		if (value == &blow_methods[i]) return i;
	return AB_WEB_NULL_INDEX;
}

static uint16_t effect_index(const struct blow_effect *value)
{
	uint16_t i;
	if (!value) return AB_WEB_NULL_INDEX;
	for (i = 0; i < z_info->blow_effects_max; i++)
		if (value == &blow_effects[i]) return i;
	return AB_WEB_NULL_INDEX;
}

static uint16_t kind_index(const struct object_kind *value)
{
	uint16_t i;
	if (!value) return AB_WEB_NULL_INDEX;
	for (i = 0; i < z_info->k_max; i++)
		if (value == &k_info[i]) return i;
	return AB_WEB_NULL_INDEX;
}

static uint16_t race_index(const struct monster_race *value)
{
	uint16_t i;
	if (!value) return AB_WEB_NULL_INDEX;
	for (i = 0; i < z_info->r_max; i++)
		if (value == &r_info[i]) return i;
	return AB_WEB_NULL_INDEX;
}

static uint16_t base_count(void)
{
	const struct monster_base *base;
	uint16_t count = 0;
	for (base = rb_info; base; base = base->next) count++;
	return count;
}

static uint16_t base_index(const struct monster_base *value)
{
	const struct monster_base *base;
	uint16_t index = 0;
	if (!value) return AB_WEB_NULL_INDEX;
	for (base = rb_info; base; base = base->next, index++)
		if (base == value) return index;
	return AB_WEB_NULL_INDEX;
}

static struct monster_base *base_by_index(uint16_t index)
{
	struct monster_base *base = rb_info;
	while (base && index) { base = base->next; index--; }
	return base;
}

#define AB_WEB_LORE_U16(X) X(sights) X(deaths) X(pkills) X(thefts) X(tkills)
#define AB_WEB_LORE_U8(X) \
	X(wake) X(ignore) X(drop_gold) X(drop_item) X(cast_innate) X(cast_spell)
#define AB_WEB_LORE_BOOLS(X) \
	X(all_known) X(armour_known) X(drop_known) X(sleep_known) \
	X(spell_freq_known) X(innate_freq_known)

#define AB_WEB_FREE_LIST(head) do { \
	while (head) { \
		void *ab_web_old_entry = (head); \
		(head) = (head)->next; \
		mem_free(ab_web_old_entry); \
	} \
} while (0)

static void wr_lore_lists(const struct monster_lore *lore)
{
	const struct monster_drop *drop;
	const struct monster_friends *friend;
	const struct monster_friends_base *friend_base;
	const struct monster_mimic *mimic;
	uint16_t count;

	count = 0;
	for (drop = lore->drops; drop; drop = drop->next) count++;
	wr_u16b(count);
	for (drop = lore->drops; drop; drop = drop->next) {
		wr_u16b(kind_index(drop->kind));
		wr_u32b(drop->tval);
		wr_u32b(drop->percent_chance);
		wr_u32b(drop->min);
		wr_u32b(drop->max);
	}
	count = 0;
	for (friend = lore->friends; friend; friend = friend->next) count++;
	wr_u16b(count);
	for (friend = lore->friends; friend; friend = friend->next) {
		/* name is freed by finish_parse_lore; only race remains valid. */
		wr_u16b(race_index(friend->race));
		wr_int(friend->role);
		wr_u32b(friend->percent_chance);
		wr_u32b(friend->number_dice);
		wr_u32b(friend->number_side);
	}
	count = 0;
	for (friend_base = lore->friends_base; friend_base;
		friend_base = friend_base->next) count++;
	wr_u16b(count);
	for (friend_base = lore->friends_base; friend_base;
		friend_base = friend_base->next) {
		wr_u16b(base_index(friend_base->base));
		wr_int(friend_base->role);
		wr_u32b(friend_base->percent_chance);
		wr_u32b(friend_base->number_dice);
		wr_u32b(friend_base->number_side);
	}
	count = 0;
	for (mimic = lore->mimic_kinds; mimic; mimic = mimic->next) count++;
	wr_u16b(count);
	for (mimic = lore->mimic_kinds; mimic; mimic = mimic->next)
		wr_u16b(kind_index(mimic->kind));
}

static bool rd_lore_lists(struct monster_lore *lore)
{
	uint16_t count, n, index;
	struct monster_drop **drop_tail;
	struct monster_friends **friend_tail;
	struct monster_friends_base **base_tail;
	struct monster_mimic **mimic_tail;

	AB_WEB_FREE_LIST(lore->drops);
	AB_WEB_FREE_LIST(lore->friends);
	AB_WEB_FREE_LIST(lore->friends_base);
	AB_WEB_FREE_LIST(lore->mimic_kinds);
	rd_u16b(&count);
	if (count > AB_WEB_LORE_LIST_LIMIT) return false;
	drop_tail = &lore->drops;
	for (n = 0; n < count; n++) {
		struct monster_drop *drop;
		rd_u16b(&index);
		if (index != AB_WEB_NULL_INDEX && index >= z_info->k_max) return false;
		drop = mem_zalloc(sizeof(*drop));
		*drop_tail = drop;
		drop_tail = &drop->next;
		drop->kind = index == AB_WEB_NULL_INDEX ? NULL : &k_info[index];
		rd_u32b(&drop->tval);
		rd_u32b(&drop->percent_chance);
		rd_u32b(&drop->min);
		rd_u32b(&drop->max);
	}
	rd_u16b(&count);
	if (count > AB_WEB_LORE_LIST_LIMIT) return false;
	friend_tail = &lore->friends;
	for (n = 0; n < count; n++) {
		struct monster_friends *friend;
		int role;
		rd_u16b(&index);
		if (index != AB_WEB_NULL_INDEX && index >= z_info->r_max) return false;
		rd_int(&role);
		if (role < MON_GROUP_LEADER || role > MON_GROUP_SUMMON) return false;
		friend = mem_zalloc(sizeof(*friend));
		*friend_tail = friend;
		friend_tail = &friend->next;
		friend->race = index == AB_WEB_NULL_INDEX ? NULL : &r_info[index];
		friend->role = role;
		rd_u32b(&friend->percent_chance);
		rd_u32b(&friend->number_dice);
		rd_u32b(&friend->number_side);
	}
	rd_u16b(&count);
	if (count > AB_WEB_LORE_LIST_LIMIT) return false;
	base_tail = &lore->friends_base;
	for (n = 0; n < count; n++) {
		struct monster_friends_base *friend_base;
		int role;
		struct monster_base *base;
		rd_u16b(&index);
		base = index == AB_WEB_NULL_INDEX ? NULL : base_by_index(index);
		if (index != AB_WEB_NULL_INDEX && !base) return false;
		rd_int(&role);
		if (role < MON_GROUP_LEADER || role > MON_GROUP_SUMMON) return false;
		friend_base = mem_zalloc(sizeof(*friend_base));
		*base_tail = friend_base;
		base_tail = &friend_base->next;
		friend_base->base = base;
		friend_base->role = role;
		rd_u32b(&friend_base->percent_chance);
		rd_u32b(&friend_base->number_dice);
		rd_u32b(&friend_base->number_side);
	}
	rd_u16b(&count);
	if (count > AB_WEB_LORE_LIST_LIMIT) return false;
	mimic_tail = &lore->mimic_kinds;
	for (n = 0; n < count; n++) {
		struct monster_mimic *mimic;
		rd_u16b(&index);
		if (index != AB_WEB_NULL_INDEX && index >= z_info->k_max) return false;
		mimic = mem_zalloc(sizeof(*mimic));
		*mimic_tail = mimic;
		mimic_tail = &mimic->next;
		mimic->kind = index == AB_WEB_NULL_INDEX ? NULL : &k_info[index];
	}
	return true;
}

static void wr_lore(void)
{
	int i, j;
	for (i = 0; i < z_info->r_max; i++) {
		const struct monster_lore *lore = &l_list[i];
		wr_int(lore->ridx);
		wr_byte(r_info[i].max_num);
		wr_int(r_info[i].cur_num);
#define WR_LORE_U16(field) wr_u16b(lore->field);
		AB_WEB_LORE_U16(WR_LORE_U16)
#undef WR_LORE_U16
#define WR_LORE_U8(field) wr_byte(lore->field);
		AB_WEB_LORE_U8(WR_LORE_U8)
#undef WR_LORE_U8
#define WR_LORE_BOOL(field) wr_byte(lore->field ? 1 : 0);
		AB_WEB_LORE_BOOLS(WR_LORE_BOOL)
#undef WR_LORE_BOOL
		for (j = 0; j < RF_SIZE; j++) wr_byte(lore->flags[j]);
		for (j = 0; j < RSF_SIZE; j++) wr_byte(lore->spell_flags[j]);
		for (j = 0; j < z_info->mon_blows_max; j++) {
			const struct monster_blow *blow = &lore->blows[j];
			wr_u16b(method_index(blow->method));
			wr_u16b(effect_index(blow->effect));
			wr_int(blow->dice.base);
			wr_int(blow->dice.dice);
			wr_int(blow->dice.sides);
			wr_int(blow->dice.m_bonus);
			wr_int(blow->times_seen);
			wr_byte(lore->blow_known[j] ? 1 : 0);
		}
		wr_lore_lists(lore);
	}
}

static bool rd_lore(void)
{
	int i, j;
	for (i = 0; i < z_info->r_max; i++) {
		struct monster_lore *lore = &l_list[i];
		rd_int(&lore->ridx);
		if (lore->ridx < 0 || lore->ridx >= z_info->r_max) return false;
		rd_byte(&r_info[i].max_num);
		rd_int(&r_info[i].cur_num);
		if (r_info[i].cur_num < 0) return false;
#define RD_LORE_U16(field) rd_u16b(&lore->field);
		AB_WEB_LORE_U16(RD_LORE_U16)
#undef RD_LORE_U16
#define RD_LORE_U8(field) rd_byte(&lore->field);
		AB_WEB_LORE_U8(RD_LORE_U8)
#undef RD_LORE_U8
#define RD_LORE_BOOL(field) if (!rd_bool(&lore->field)) return false;
		AB_WEB_LORE_BOOLS(RD_LORE_BOOL)
#undef RD_LORE_BOOL
		for (j = 0; j < RF_SIZE; j++) rd_byte(&lore->flags[j]);
		for (j = 0; j < RSF_SIZE; j++) rd_byte(&lore->spell_flags[j]);
		for (j = 0; j < z_info->mon_blows_max; j++) {
			struct monster_blow *blow = &lore->blows[j];
			uint16_t method, effect;
			rd_u16b(&method);
			rd_u16b(&effect);
			if ((method != AB_WEB_NULL_INDEX &&
				method >= z_info->blow_methods_max) ||
				(effect != AB_WEB_NULL_INDEX &&
				effect >= z_info->blow_effects_max)) return false;
			blow->next = NULL; /* The parsing-only link has no runtime role. */
			blow->method = method == AB_WEB_NULL_INDEX ? NULL : &blow_methods[method];
			blow->effect = effect == AB_WEB_NULL_INDEX ? NULL : &blow_effects[effect];
			rd_int(&blow->dice.base);
			rd_int(&blow->dice.dice);
			rd_int(&blow->dice.sides);
			rd_int(&blow->dice.m_bonus);
			rd_int(&blow->times_seen);
			if (blow->times_seen < 0 || !rd_bool(&lore->blow_known[j])) return false;
		}
		if (!rd_lore_lists(lore)) return false;
	}
	/* Do not call lore_update(): even derived flags must match the snapshot. */
	return true;
}

static bool valid_groups(const struct chunk *c)
{
	int i;
	for (i = 0; i < z_info->level_monster_max; i++) {
		const struct monster_group *group = c->monster_groups[i];
		const struct mon_group_list_entry *entry;
		unsigned int count = 0;
		if (!group) continue;
		if (group->index != i || group->leader < 0 ||
			group->leader >= c->mon_max ||
			(group->leader && !c->monsters[group->leader].race)) return false;
		for (entry = group->member_list; entry; entry = entry->next) {
			if (++count > c->mon_cnt || entry->midx <= 0 ||
				entry->midx >= c->mon_max ||
				!c->monsters[entry->midx].race) return false;
		}
	}
	return true;
}

static bool valid_lore(void)
{
	int i, j;
	if (!l_list || !blow_methods || !blow_effects) return false;
	for (i = 0; i < z_info->r_max; i++) {
		const struct monster_lore *lore = &l_list[i];
		const struct monster_drop *drop;
		const struct monster_friends *friend;
		const struct monster_friends_base *friend_base;
		const struct monster_mimic *mimic;
		unsigned int count;
		if (!lore->blows || !lore->blow_known) return false;
		for (j = 0; j < z_info->mon_blows_max; j++) {
			const struct monster_blow *blow = &lore->blows[j];
			if ((blow->method && method_index(blow->method) == AB_WEB_NULL_INDEX) ||
				(blow->effect && effect_index(blow->effect) == AB_WEB_NULL_INDEX))
				return false;
		}
		count = 0;
		for (drop = lore->drops; drop; drop = drop->next) {
			if (++count > AB_WEB_LORE_LIST_LIMIT ||
				(drop->kind && kind_index(drop->kind) == AB_WEB_NULL_INDEX))
				return false;
		}
		count = 0;
		for (friend = lore->friends; friend; friend = friend->next) {
			if (++count > AB_WEB_LORE_LIST_LIMIT ||
				(friend->race && race_index(friend->race) == AB_WEB_NULL_INDEX))
				return false;
		}
		count = 0;
		for (friend_base = lore->friends_base; friend_base;
			friend_base = friend_base->next) {
			if (++count > AB_WEB_LORE_LIST_LIMIT ||
				(friend_base->base &&
				base_index(friend_base->base) == AB_WEB_NULL_INDEX)) return false;
		}
		count = 0;
		for (mimic = lore->mimic_kinds; mimic; mimic = mimic->next) {
			if (++count > AB_WEB_LORE_LIST_LIMIT ||
				(mimic->kind && kind_index(mimic->kind) == AB_WEB_NULL_INDEX))
				return false;
		}
	}
	return true;
}

bool ab_web_checkpoint_can_save(void)
{
	uint16_t i;
	struct ab_web_target_checkpoint targets;
	const struct player_upkeep *upkeep;
	if (!z_info || !player || !player->upkeep || !character_generated ||
		!character_dungeon || player->is_dead || !inkey_flag ||
		screen_save_depth != 0 || !valid_chunk(cave) ||
		!valid_chunk(player->cave) || chunk_list_max > AB_WEB_CHUNK_LIMIT)
		return false;
	upkeep = player->upkeep;
	if (!upkeep->playing || upkeep->generate_level || upkeep->only_partial ||
		upkeep->dropping || upkeep->energy_use || upkeep->resting ||
		upkeep->running || upkeep->steps || upkeep->update ||
		cave->mon_current != -1 || cmd_get_nrepeats() ||
		!ab_web_cmdq_can_checkpoint() || (inkey_next && inkey_next->code))
		return false;
	ab_web_target_export(&targets);
	if (targets.fixed || !valid_groups(cave) ||
		!valid_groups(player->cave)) return false;
	for (i = 0; i < chunk_list_max; i++)
		if (!valid_chunk(chunk_list[i]) || !valid_groups(chunk_list[i])) return false;
	return valid_lore();
}

static void wr_schema(void)
{
	const uint16_t dimensions[] = {
		STAT_MAX, SKILL_MAX, OF_SIZE, PF_SIZE, ELEM_MAX, MFLAG_SIZE,
		RF_SIZE, RSF_SIZE, SQUARE_SIZE, FEAT_MAX, z_info->r_max,
		z_info->k_max, z_info->mon_blows_max, z_info->blow_methods_max,
		z_info->blow_effects_max, z_info->level_monster_max, base_count()
	};
	size_t i;
	wr_u16b(N_ELEMENTS(dimensions));
	for (i = 0; i < N_ELEMENTS(dimensions); i++) wr_u16b(dimensions[i]);
}

static bool rd_schema(void)
{
	const uint16_t dimensions[] = {
		STAT_MAX, SKILL_MAX, OF_SIZE, PF_SIZE, ELEM_MAX, MFLAG_SIZE,
		RF_SIZE, RSF_SIZE, SQUARE_SIZE, FEAT_MAX, z_info->r_max,
		z_info->k_max, z_info->mon_blows_max, z_info->blow_methods_max,
		z_info->blow_effects_max, z_info->level_monster_max, base_count()
	};
	uint16_t count, value;
	size_t i;
	rd_u16b(&count);
	if (count != N_ELEMENTS(dimensions)) return false;
	for (i = 0; i < N_ELEMENTS(dimensions); i++) {
		rd_u16b(&value);
		if (value != dimensions[i]) return false;
	}
	return true;
}

void wr_web_checkpoint(void)
{
	uint16_t i;
	struct ab_web_target_checkpoint targets;
	const struct player_upkeep *upkeep = player->upkeep;
	bool active = ab_web_checkpoint_can_save();
	wr_u32b(AB_WEB_CHECKPOINT_VERSION);
	wr_byte(active ? 1 : 0);
	/* Native UI save hooks can run in menus.  Those saves have no browser
	 * continuation block and must not be accepted as a command checkpoint. */
	if (!active) return;
	wr_schema();
	wr_u16b(chunk_list_max);
	wr_chunk(cave);
	wr_chunk(player->cave);
	for (i = 0; i < chunk_list_max; i++) wr_chunk(chunk_list[i]);
	wr_lore();
	wr_player_state(&player->state);
	wr_player_state(&player->known_state);
	wr_loc(player->old_grid);
	wr_byte(player->skip_cmd_coercion);
	wr_int(upkeep->command_wrk);
	wr_int(upkeep->recharge_pow);
	wr_int(upkeep->new_spells);
	wr_u32b(upkeep->notice);
	wr_byte(upkeep->create_up_stair ? 1 : 0);
	wr_byte(upkeep->create_down_stair ? 1 : 0);
	wr_byte(upkeep->light_level ? 1 : 0);
	wr_byte(upkeep->arena_level ? 1 : 0);
	wr_byte(upkeep->running_firststep ? 1 : 0);
	wr_int(upkeep->step_count);
	wr_loc(upkeep->path_dest);
	ab_web_target_export(&targets);
	wr_byte(targets.set ? 1 : 0);
	wr_byte(targets.fixed ? 1 : 0);
	wr_target_value(&targets.current);
	wr_target_value(&targets.previous);
	ab_web_wr_command_checkpoint();
	ab_web_wr_rest_checkpoint();
}

int rd_web_checkpoint(void)
{
	uint32_t version;
	uint16_t chunks, i;
	struct ab_web_target_checkpoint targets;
	struct player_upkeep *upkeep;
	bool active;
	ab_web_checkpoint_loaded = false;
	rd_u32b(&version);
	if (version != AB_WEB_CHECKPOINT_VERSION || !rd_bool(&active)) return -1;
	if (!active) return ab_web_checkpoint_restore_requested ? -1 : 0;
	if (!z_info || !player || !player->upkeep || player->is_dead ||
		!character_dungeon || !rd_schema()) return -1;
	rd_u16b(&chunks);
	if (chunks > AB_WEB_CHUNK_LIMIT || chunks != chunk_list_max) return -1;
	if (!rd_chunk(cave) || !rd_chunk(player->cave)) return -1;
	for (i = 0; i < chunks; i++) if (!rd_chunk(chunk_list[i])) return -1;
	if (!rd_lore() || !rd_player_state(&player->state) ||
		!rd_player_state(&player->known_state)) return -1;
	rd_loc(&player->old_grid);
	if (!valid_native_loc(player->old_grid)) return -1;
	rd_byte(&player->skip_cmd_coercion);
	upkeep = player->upkeep;
	rd_int(&upkeep->command_wrk);
	rd_int(&upkeep->recharge_pow);
	rd_int(&upkeep->new_spells);
	rd_u32b(&upkeep->notice);
	if (!rd_bool(&upkeep->create_up_stair) ||
		!rd_bool(&upkeep->create_down_stair) || !rd_bool(&upkeep->light_level) ||
		!rd_bool(&upkeep->arena_level) || !rd_bool(&upkeep->running_firststep))
		return -1;
	rd_int(&upkeep->step_count);
	rd_loc(&upkeep->path_dest);
	/* An inactive path can retain a negative failure count or a sentinel
	 * destination.  Neither is followed while steps/running are absent. */
	if (!rd_bool(&targets.set) || !rd_bool(&targets.fixed) ||
		!rd_target_value(&targets.current) ||
		!rd_target_value(&targets.previous) || !ab_web_target_import(&targets))
		return -1;
	if (ab_web_rd_command_checkpoint() || ab_web_rd_rest_checkpoint()) return -1;
	/* All executing-command state is excluded by the writer's boundary gate. */
	upkeep->energy_use = 0;
	upkeep->resting = 0;
	upkeep->running = 0;
	upkeep->dropping = false;
	upkeep->generate_level = false;
	upkeep->only_partial = false;
	upkeep->update = 0;
	ab_web_checkpoint_loaded = ab_web_checkpoint_restore_requested;
	return 0;
}
#endif /* __EMSCRIPTEN__ */
