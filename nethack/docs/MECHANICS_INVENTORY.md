# Official source mechanics inventory

This inventory is evidence for the complete upstream scope. It makes **no claim that these mechanics have been ported to Rust**. `catalog/source-mechanics.json` contains one row for every `src/*.c` file, its SHA-256, size, lines, lexical function locations, API call counts, and RNG calls. `catalog/source-files.json` fingerprints every extracted file, including assets and platform implementations.

The pinned extracted tree is `NetHack-5.0.0`. Provenance, release verification and license obligations are maintained by the parent source audit; this scanner does not substitute for that audit. The user's confirmed integration target preserves original C gameplay and separates display/input/platform in Rust. The schema's Rust gameplay parity field tracks an optional future audit dimension and is not a current release gate.

- Source files: 1,265; uncompressed file bytes: 29,061,195.
- Core C files: 130; core lines: 250,249.
- Core function definition candidates: 5,238.
- Unclassified core files: 0.
- Rust parity status of every file: `not-evaluated`.

Function extraction is lexical. Conditional C branches and macros may prevent exact function recognition. Call totals are candidate counts, not executed-path or behavioral coverage measurements. Every file remains represented even when function extraction fails.

## Subsystems

| Subsystem | Core files | Scope |
| --- | ---: | --- |
| turn_state_rng | 5 | Turn scheduling, global state, deterministic randomness |
| identity_progression | 5 | Roles, initial inventory, attributes, alignment, experience |
| movement_terrain | 7 | Movement, doors, stairs, bridges, digging, light and visibility |
| level_generation | 10 | Dungeon branches, room/maze/map generation and special levels |
| object_identity | 6 | Object definitions, creation, naming, artifacts and identification |
| inventory_equipment | 7 | Inventory, pickup, wielding, armor, equipment effects and punishment |
| player_actions | 8 | Command routing, occupations, kicking, throwing, applying and writing |
| combat_projectiles | 5 | Player/monster combat, damage, monster throwing and explosions |
| monsters_ai | 14 | Monster definitions, creation, movement, items, pets and special identities |
| magic_status | 8 | Spells, monster casting, potions, scrolls, wands, polymorph and timed effects |
| survival_hazards | 5 | Eating, hunger, traps, fountains, sitting and teleportation |
| religion_quests_endgame | 7 | Prayer, priests, role quests, quest prose, wizard and victory |
| economy_world_interactions | 6 | Shops, bills, shopkeeper names, vaults, engraving, music and ambience |
| persistence_scores | 7 | Save/restore, bones, files, record lists and serialization formats |
| presentation_text | 13 | Glyphs, drawing, status, messages, help, rumors and window abstraction |
| configuration_platform | 8 | Options, configuration, startup arguments, OS services, mail and version |
| runtime_libraries | 8 | Allocation, utilities, data library, Lua bridge, MD4 and generic object support |
| debug_tools | 1 | Wizard commands and diagnostics |

The categories organize review; cross-subsystem dependencies remain substantial. In particular, monster AI calls object use and combat, shops interact with pickup and death, polymorph affects equipment and physiology, and quest progression depends on roles, branches, and artifacts.

## Every core C file

| Source file | Subsystem | Lines | Function candidates | Message sink candidates |
| --- | --- | ---: | ---: | ---: |
| `src/allmain.c` | turn_state_rng | 1003 | 17 | 12 |
| `src/alloc.c` | runtime_libraries | 285 | 12 | 10 |
| `src/apply.c` | player_actions | 4558 | 76 | 335 |
| `src/artifact.c` | object_identity | 2843 | 76 | 77 |
| `src/attrib.c` | identity_progression | 1364 | 34 | 17 |
| `src/ball.c` | inventory_equipment | 1104 | 21 | 33 |
| `src/bones.c` | persistence_scores | 843 | 16 | 8 |
| `src/botl.c` | presentation_text | 4582 | 77 | 75 |
| `src/calendar.c` | configuration_platform | 229 | 11 | 0 |
| `src/cfgfiles.c` | configuration_platform | 2076 | 99 | 39 |
| `src/cmd.c` | player_actions | 5704 | 151 | 165 |
| `src/coloratt.c` | presentation_text | 1168 | 28 | 8 |
| `src/date.c` | configuration_platform | 178 | 2 | 0 |
| `src/dbridge.c` | movement_terrain | 1021 | 28 | 31 |
| `src/decl.c` | turn_state_rng | 1205 | 3 | 1 |
| `src/detect.c` | magic_status | 2418 | 43 | 64 |
| `src/dig.c` | movement_terrain | 2329 | 38 | 108 |
| `src/display.c` | presentation_text | 3822 | 75 | 22 |
| `src/dlb.c` | runtime_libraries | 550 | 23 | 0 |
| `src/do.c` | player_actions | 2488 | 44 | 139 |
| `src/do_name.c` | object_identity | 1663 | 55 | 31 |
| `src/do_wear.c` | inventory_equipment | 3504 | 79 | 134 |
| `src/dog.c` | monsters_ai | 1395 | 21 | 22 |
| `src/dogmove.c` | monsters_ai | 1547 | 20 | 19 |
| `src/dokick.c` | player_actions | 1971 | 22 | 98 |
| `src/dothrow.c` | player_actions | 2735 | 39 | 78 |
| `src/drawing.c` | presentation_text | 144 | 3 | 0 |
| `src/dungeon.c` | level_generation | 3734 | 112 | 63 |
| `src/earlyarg.c` | configuration_platform | 812 | 13 | 10 |
| `src/eat.c` | survival_hazards | 3970 | 79 | 168 |
| `src/end.c` | religion_quests_endgame | 1948 | 30 | 77 |
| `src/engrave.c` | economy_world_interactions | 1770 | 34 | 76 |
| `src/exper.c` | identity_progression | 402 | 9 | 6 |
| `src/explode.c` | combat_projectiles | 1069 | 8 | 24 |
| `src/extralev.c` | level_generation | 355 | 6 | 9 |
| `src/files.c` | persistence_scores | 3720 | 72 | 89 |
| `src/fountain.c` | survival_hazards | 828 | 16 | 91 |
| `src/getpos.c` | player_actions | 1169 | 22 | 32 |
| `src/glyphs.c` | presentation_text | 1324 | 35 | 4 |
| `src/hack.c` | movement_terrain | 4575 | 95 | 177 |
| `src/hacklib.c` | runtime_libraries | 1015 | 48 | 2 |
| `src/iactions.c` | player_actions | 716 | 5 | 3 |
| `src/insight.c` | identity_progression | 3506 | 46 | 47 |
| `src/invent.c` | inventory_equipment | 5679 | 120 | 150 |
| `src/isaac64.c` | turn_state_rng | 180 | 8 | 0 |
| `src/light.c` | movement_terrain | 985 | 29 | 28 |
| `src/lock.c` | movement_terrain | 1320 | 20 | 91 |
| `src/mail.c` | configuration_platform | 803 | 14 | 21 |
| `src/makemon.c` | monsters_ai | 2614 | 42 | 18 |
| `src/mcastu.c` | magic_status | 1014 | 26 | 62 |
| `src/mdlib.c` | runtime_libraries | 874 | 14 | 0 |
| `src/mhitm.c` | combat_projectiles | 1514 | 22 | 51 |
| `src/mhitu.c` | combat_projectiles | 2642 | 31 | 153 |
| `src/minion.c` | monsters_ai | 567 | 14 | 35 |
| `src/mklev.c` | level_generation | 2661 | 56 | 19 |
| `src/mkmap.c` | level_generation | 488 | 14 | 2 |
| `src/mkmaze.c` | level_generation | 2110 | 45 | 24 |
| `src/mkobj.c` | object_identity | 3851 | 99 | 49 |
| `src/mkroom.c` | level_generation | 1099 | 30 | 3 |
| `src/mon.c` | monsters_ai | 6088 | 129 | 152 |
| `src/mondata.c` | monsters_ai | 1671 | 59 | 2 |
| `src/monmove.c` | monsters_ai | 2396 | 52 | 40 |
| `src/monst.c` | monsters_ai | 89 | 5 | 0 |
| `src/mplayer.c` | monsters_ai | 379 | 6 | 2 |
| `src/mthrowu.c` | combat_projectiles | 1561 | 28 | 56 |
| `src/muse.c` | monsters_ai | 3309 | 45 | 137 |
| `src/music.c` | economy_world_interactions | 945 | 14 | 61 |
| `src/nhlobj.c` | runtime_libraries | 685 | 21 | 0 |
| `src/nhlsel.c` | presentation_text | 1051 | 34 | 0 |
| `src/nhlua.c` | runtime_libraries | 3138 | 98 | 34 |
| `src/nhmd4.c` | runtime_libraries | 298 | 4 | 0 |
| `src/o_init.c` | object_identity | 1221 | 28 | 43 |
| `src/objects.c` | object_identity | 38 | 1 | 0 |
| `src/objnam.c` | object_identity | 5700 | 87 | 43 |
| `src/options.c` | configuration_platform | 10225 | 239 | 259 |
| `src/pager.c` | presentation_text | 2967 | 47 | 73 |
| `src/pickup.c` | inventory_equipment | 4057 | 68 | 148 |
| `src/pline.c` | presentation_text | 719 | 33 | 17 |
| `src/polyself.c` | magic_status | 2286 | 34 | 128 |
| `src/potion.c` | magic_status | 2930 | 66 | 162 |
| `src/pray.c` | religion_quests_endgame | 2721 | 45 | 164 |
| `src/priest.c` | religion_quests_endgame | 944 | 23 | 34 |
| `src/quest.c` | religion_quests_endgame | 523 | 22 | 12 |
| `src/questpgr.c` | religion_quests_endgame | 668 | 21 | 12 |
| `src/read.c` | magic_status | 3410 | 62 | 178 |
| `src/rect.c` | level_generation | 219 | 10 | 2 |
| `src/region.c` | level_generation | 1408 | 38 | 21 |
| `src/report.c` | presentation_text | 665 | 10 | 9 |
| `src/restore.c` | persistence_scores | 1622 | 32 | 30 |
| `src/rip.c` | religion_quests_endgame | 167 | 2 | 5 |
| `src/rnd.c` | turn_state_rng | 312 | 17 | 5 |
| `src/role.c` | identity_progression | 3024 | 48 | 46 |
| `src/rumors.c` | presentation_text | 956 | 17 | 45 |
| `src/save.c` | persistence_scores | 1191 | 26 | 14 |
| `src/selvar.c` | level_generation | 812 | 26 | 2 |
| `src/sfbase.c` | persistence_scores | 1117 | 109 | 0 |
| `src/sfstruct.c` | persistence_scores | 631 | 14 | 7 |
| `src/shk.c` | economy_world_interactions | 6125 | 138 | 241 |
| `src/shknam.c` | economy_world_interactions | 928 | 18 | 10 |
| `src/sit.c` | survival_hazards | 764 | 7 | 95 |
| `src/sounds.c` | economy_world_interactions | 2222 | 44 | 69 |
| `src/sp_lev.c` | level_generation | 6504 | 144 | 28 |
| `src/spell.c` | magic_status | 2427 | 43 | 91 |
| `src/stairs.c` | movement_terrain | 237 | 17 | 0 |
| `src/steal.c` | monsters_ai | 900 | 16 | 26 |
| `src/steed.c` | monsters_ai | 934 | 15 | 59 |
| `src/strutil.c` | runtime_libraries | 158 | 9 | 1 |
| `src/symbols.c` | presentation_text | 1103 | 27 | 8 |
| `src/sys.c` | configuration_platform | 185 | 2 | 1 |
| `src/teleport.c` | survival_hazards | 2294 | 38 | 72 |
| `src/timeout.c` | magic_status | 2777 | 56 | 123 |
| `src/topten.c` | persistence_scores | 1487 | 24 | 17 |
| `src/track.c` | turn_state_rng | 107 | 6 | 1 |
| `src/trap.c` | survival_hazards | 7211 | 125 | 349 |
| `src/u_init.c` | identity_progression | 1420 | 17 | 1 |
| `src/uhitm.c` | combat_projectiles | 6447 | 102 | 281 |
| `src/utf8map.c` | presentation_text | 222 | 6 | 0 |
| `src/vault.c` | economy_world_interactions | 1288 | 25 | 53 |
| `src/version.c` | configuration_platform | 859 | 19 | 15 |
| `src/vision.c` | movement_terrain | 2188 | 24 | 2 |
| `src/weapon.c` | inventory_equipment | 1845 | 40 | 36 |
| `src/were.c` | monsters_ai | 239 | 8 | 4 |
| `src/wield.c` | inventory_equipment | 1086 | 26 | 62 |
| `src/windows.c` | presentation_text | 1903 | 82 | 25 |
| `src/wizard.c` | religion_quests_endgame | 885 | 21 | 15 |
| `src/wizcmds.c` | debug_tools | 2029 | 48 | 124 |
| `src/worm.c` | monsters_ai | 1001 | 28 | 17 |
| `src/worn.c` | inventory_equipment | 1421 | 27 | 40 |
| `src/write.c` | player_actions | 420 | 4 | 26 |
| `src/zap.c` | magic_status | 6447 | 85 | 193 |

Regenerate from the unchanged upstream tree:

```text
python nethack/tools/inventory_source.py --source official-source-audit/NetHack-5.0.0 --output nethack
```
