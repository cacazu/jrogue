/* Source-generated private canonical identities. Never serialized. */
static const char *const ab_stat_adjectives[3][STAT_MAX] = {
 {"game.stat.adjective.str.negative","game.stat.adjective.int.negative","game.stat.adjective.wis.negative","game.stat.adjective.dex.negative","game.stat.adjective.con.negative"},
 {"game.stat.adjective.str.positive","game.stat.adjective.int.positive","game.stat.adjective.wis.positive","game.stat.adjective.dex.positive","game.stat.adjective.con.positive"},
 {"game.stat.adjective.str.project","game.stat.adjective.int.project","game.stat.adjective.wis.project","game.stat.adjective.dex.project","game.stat.adjective.con.project"},
};
static const char *ab_stat_projection_id(int type,bool blind) { switch(type) {
 case PROJ_ACID: return blind?"game.stat.projection.blind.acid":"game.stat.projection.description.acid";
 case PROJ_ELEC: return blind?"game.stat.projection.blind.lightning":"game.stat.projection.description.lightning";
 case PROJ_FIRE: return blind?"game.stat.projection.blind.fire":"game.stat.projection.description.fire";
 case PROJ_COLD: return blind?"game.stat.projection.blind.cold":"game.stat.projection.description.cold";
 case PROJ_POIS: return blind?"game.stat.projection.blind.poison":"game.stat.projection.description.poison";
 case PROJ_LIGHT: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.light";
 case PROJ_DARK: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.dark";
 case PROJ_SOUND: return blind?"game.stat.projection.blind.noise":"game.stat.projection.description.sound";
 case PROJ_SHARD: return blind?"game.stat.projection.blind.something_sharp":"game.stat.projection.description.shards";
 case PROJ_NEXUS: return blind?"game.stat.projection.blind.something_strange":"game.stat.projection.description.nexus";
 case PROJ_NETHER: return blind?"game.stat.projection.blind.something_cold":"game.stat.projection.description.nether";
 case PROJ_CHAOS: return blind?"game.stat.projection.blind.something_strange":"game.stat.projection.description.chaos";
 case PROJ_DISEN: return blind?"game.stat.projection.blind.something_strange":"game.stat.projection.description.disenchantment";
 case PROJ_WATER: return blind?"game.stat.projection.blind.water":"game.stat.projection.description.water";
 case PROJ_ICE: return blind?"game.stat.projection.blind.something_sharp":"game.stat.projection.description.ice";
 case PROJ_GRAVITY: return blind?"game.stat.projection.blind.something_strange":"game.stat.projection.description.gravity";
 case PROJ_INERTIA: return blind?"game.stat.projection.blind.something_strange":"game.stat.projection.description.inertia";
 case PROJ_FORCE: return blind?"game.stat.projection.blind.something_hard":"game.stat.projection.description.force";
 case PROJ_TIME: return blind?"game.stat.projection.blind.something_strange":"game.stat.projection.description.time";
 case PROJ_PLASMA: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.plasma";
 case PROJ_METEOR: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.a_meteor";
 case PROJ_MISSILE: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.a_missile";
 case PROJ_MANA: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.mana";
 case PROJ_HOLY_ORB: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.a_holy_orb";
 case PROJ_ARROW: return blind?"game.stat.projection.blind.something_sharp":"game.stat.projection.description.an_arrow";
 case PROJ_LIGHT_WEAK: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.light";
 case PROJ_DARK_WEAK: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.darkness";
 case PROJ_KILL_WALL: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.rock_remover";
 case PROJ_KILL_DOOR: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.destroys_doors";
 case PROJ_KILL_TRAP: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.disables_traps";
 case PROJ_MAKE_DOOR: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.creates_doors";
 case PROJ_MAKE_TRAP: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.creates_traps";
 case PROJ_AWAY_UNDEAD: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.teleports_undead_away";
 case PROJ_AWAY_SPIRIT: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.teleports_monsters_with_a_spirit_away";
 case PROJ_AWAY_EVIL: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.teleports_evil_monsters_away";
 case PROJ_AWAY_ALL: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.teleports_monsters_away";
 case PROJ_TURN_UNDEAD: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.turns_undead";
 case PROJ_TURN_EVIL: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.frightens_evil_monsters";
 case PROJ_TURN_LIVING: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.scares_living_monsters";
 case PROJ_TURN_ALL: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.causes_monsters_to_flee";
 case PROJ_DISP_UNDEAD: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.damages_undead";
 case PROJ_DISP_EVIL: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.damages_evil_monsters";
 case PROJ_DISP_ALL: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.damages_all_monsters";
 case PROJ_SLEEP_UNDEAD: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.attempts_to_put_undead_to_sleep";
 case PROJ_SLEEP_EVIL: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.attempts_to_put_evil_monsters_to_sleep";
 case PROJ_SLEEP_ALL: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.attempts_to_put_all_monsters_to_sleep";
 case PROJ_MON_CLONE: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.hastes_heals_and_magically_duplicates_monsters";
 case PROJ_MON_POLY: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.polymorphs_monsters_into_other_kinds_of_creatures";
 case PROJ_MON_HEAL: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.heals_monsters";
 case PROJ_MON_SPEED: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.hastes_monsters";
 case PROJ_MON_SLOW: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.attempts_to_slow_monsters";
 case PROJ_MON_CONF: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.attempts_to_confuse_monsters";
 case PROJ_MON_HOLD: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.attempts_to_hold_monsters_still";
 case PROJ_MON_STUN: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.attempts_to_stun_monsters";
 case PROJ_MON_DRAIN: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.damages_living_monsters";
 case PROJ_MON_CRUSH: return blind?"game.stat.projection.blind.something":"game.stat.projection.description.kills_monsters_below_a_hitpoint_threshold";
 default:return NULL; } }
