/* SPDX-License-Identifier: GPL-2.0-only */
/* Source array identities; not English matching. */
static const char *const context_cmd_item[] = {
 "context.command.item.inscribe",
 "context.command.item.uninscribe",
 "context.command.item.wield",
 "context.command.item.takeoff",
 "context.command.item.examine",
 "context.command.item.drop",
 "context.command.item.fire",
 "context.command.item.use_staff",
 "context.command.item.use_wand",
 "context.command.item.use_rod",
 "context.command.item.activate",
 "context.command.item.eat",
 "context.command.item.quaff",
 "context.command.item.read_scroll",
 "context.command.item.refill",
 "context.command.item.use",
};
static const char *const context_cmd_action[] = {
 "context.command.action.disarm",
 "context.command.action.rest",
 "context.command.action.look",
 "context.command.action.target",
 "context.command.action.target_closest",
 "context.command.action.tunnel",
 "context.command.action.go_up",
 "context.command.action.go_down",
 "context.command.action.open",
 "context.command.action.close",
 "context.command.action.fire_nearest",
 "context.command.action.throw",
 "context.command.action.jump",
};
static const char *const context_cmd_item_manage[] = {
 "context.command.item_manage.equipment",
 "context.command.item_manage.inventory",
 "context.command.item_manage.quiver",
 "context.command.item_manage.pickup",
 "context.command.item_manage.ignore",
};
static const char *const context_cmd_info[] = {
 "context.command.info.browse",
 "context.command.info.study",
 "context.command.info.abilities",
 "context.command.info.cast",
 "context.command.info.map",
 "context.command.info.toggle_ignore",
 "context.command.info.objects",
 "context.command.info.monsters",
 "context.command.info.locate",
 "context.command.info.help",
 "context.command.info.identify_symbol",
 "context.command.info.character",
 "context.command.info.knowledge",
 "context.command.info.feeling",
 "context.command.info.previous_message",
 "context.command.info.message_recall",
};
static const char *const context_cmd_util[] = {
 "context.command.util.options",
 "context.command.util.save",
 "context.command.util.save_quit",
 "context.command.util.retire",
 "context.command.util.redraw",
 "context.command.util.screen_dump",
};
static const char *const context_cmd_hidden[] = {
 "context.command.hidden.note",
 "context.command.hidden.version",
 "context.command.hidden.pref_line",
 "context.command.hidden.toggle_windows",
 "context.command.hidden.alter",
 "context.command.hidden.steal",
 "context.command.hidden.walk",
 "context.command.hidden.run",
 "context.command.hidden.explore",
 "context.command.hidden.hold",
 "context.command.hidden.center_map",
 "context.command.hidden.wizard",
 "context.command.hidden.repeat",
 "context.command.hidden.autopickup",
 "context.command.hidden.debug",
#ifdef ALLOW_BORG
 "context.command.hidden.borg",
#endif
};
static const char *const context_cmd_debug[] = {
 "context.command.debug.items",
 "context.command.debug.player",
 "context.command.debug.teleport",
 "context.command.debug.effects",
 "context.command.debug.summon",
 "context.command.debug.files",
 "context.command.debug.statistics",
 "context.command.debug.query",
 "context.command.debug.miscellaneous",
};
static const char *const context_cmd_debug_obj[] = {
 "context.command.debug_obj.create_object",
 "context.command.debug_obj.create_artifact",
 "context.command.debug_obj.create_tval",
 "context.command.debug_obj.acquire_good",
 "context.command.debug_obj.acquire_great",
 "context.command.debug_obj.edit_item",
};
static const char *const context_cmd_debug_player[] = {
 "context.command.debug_player.cure_all",
 "context.command.debug_player.advance",
 "context.command.debug_player.experience",
 "context.command.debug_player.rerate",
 "context.command.debug_player.edit",
 "context.command.debug_player.learn_objects",
 "context.command.debug_player.recall_monster",
 "context.command.debug_player.wipe_recall",
};
static const char *const context_cmd_debug_tele[] = {
 "context.command.debug_tele.location",
 "context.command.debug_tele.near",
 "context.command.debug_tele.far",
 "context.command.debug_tele.level",
};
static const char *const context_cmd_debug_effects[] = {
 "context.command.debug_effects.detect_local",
 "context.command.debug_effects.detect_monsters",
 "context.command.debug_effects.map",
 "context.command.debug_effects.attack_los",
 "context.command.debug_effects.perform",
 "context.command.debug_effects.demo",
};
static const char *const context_cmd_debug_summon[] = {
 "context.command.debug_summon.named",
 "context.command.debug_summon.random",
};
static const char *const context_cmd_debug_files[] = {
 "context.command.debug_files.spoilers",
 "context.command.debug_files.map",
};
static const char *const context_cmd_debug_stats[] = {
 "context.command.debug_stats.objects_monsters",
 "context.command.debug_stats.pits",
 "context.command.debug_stats.disconnected",
 "context.command.debug_stats.objects_monsters_alternate",
};
static const char *const context_cmd_debug_query[] = {
 "context.command.debug_query.feature",
 "context.command.debug_query.square_flag",
 "context.command.debug_query.noise_scent",
 "context.command.debug_query.keylog",
};
static const char *const context_cmd_debug_misc[] = {
 "context.command.debug_misc.light",
 "context.command.debug_misc.trap",
 "context.command.debug_misc.banish",
 "context.command.debug_misc.push",
 "context.command.debug_misc.quit",
};
static const char *const context_categories[] = {
 "context.category.item",
 "context.category.action",
 "context.category.item_manage",
 "context.category.info",
 "context.category.util",
 "context.category.hidden",
 "context.category.debug",
 "context.category.debug_obj",
 "context.category.debug_player",
 "context.category.debug_tele",
 "context.category.debug_effects",
 "context.category.debug_summon",
 "context.category.debug_files",
 "context.category.debug_stats",
 "context.category.debug_query",
 "context.category.debug_misc",
};
static const struct { const char *const *ids; size_t count; } context_commands[] = {
 {context_cmd_item,N_ELEMENTS(context_cmd_item)},
 {context_cmd_action,N_ELEMENTS(context_cmd_action)},
 {context_cmd_item_manage,N_ELEMENTS(context_cmd_item_manage)},
 {context_cmd_info,N_ELEMENTS(context_cmd_info)},
 {context_cmd_util,N_ELEMENTS(context_cmd_util)},
 {context_cmd_hidden,N_ELEMENTS(context_cmd_hidden)},
 {context_cmd_debug,N_ELEMENTS(context_cmd_debug)},
 {context_cmd_debug_obj,N_ELEMENTS(context_cmd_debug_obj)},
 {context_cmd_debug_player,N_ELEMENTS(context_cmd_debug_player)},
 {context_cmd_debug_tele,N_ELEMENTS(context_cmd_debug_tele)},
 {context_cmd_debug_effects,N_ELEMENTS(context_cmd_debug_effects)},
 {context_cmd_debug_summon,N_ELEMENTS(context_cmd_debug_summon)},
 {context_cmd_debug_files,N_ELEMENTS(context_cmd_debug_files)},
 {context_cmd_debug_stats,N_ELEMENTS(context_cmd_debug_stats)},
 {context_cmd_debug_query,N_ELEMENTS(context_cmd_debug_query)},
 {context_cmd_debug_misc,N_ELEMENTS(context_cmd_debug_misc)},
};
