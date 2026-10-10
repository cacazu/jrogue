# DRL 0.10.11a source and migration inventory

This is a source audit, not a claim that a browser adaptation implements these features. The reference is the pristine official DRL checkout in `upstream/drl`, tag `0_10_11a`, commit `a6f965072b3a25b768c91dbced00367f1b57d865`. `bin/data/core/main.lua` and `bin/data/drl/main.lua` declare engine, module and save compatibility version `0.10.11`. The README's `0.10.0` heading is stale. The matching engine dependency is official FPC Valkyrie tag `0_10_11`, commit `f89735a741a968997656c2d48a003ec569db7f22`.

The user's clarified architecture is authoritative: preserve the game body's processing in its original Pascal/Lua languages and separate **display, input and platform/environment dependencies into Rust**. The four named layers are therefore original-language logic, Rust display, Rust input and Rust platform. Rust numeric/RNG reference modules are verification aids, not selected replacements for original rules. Pristine upstream remains separate from the adapted original-language tree.

`feature-inventory.json` contains the mechanically extracted category/ID/name/file/line/field inventory, native unit/method index and size measurements. `inventory-source.mjs` regenerates it and `feature-registry-appendix.md` by reading the reference without running upstream game code. Literal, anonymous, runtime-generated and inactive commented definitions are deliberately distinguished: treating raw textual matches as live registry counts includes disabled content, while literal active counts omit generated corpses and natural weapons. Raw table source is retained with every declaration. The separate text audit is authoritative for user-facing string extraction; the Lua literal count here includes programmer IDs as well as display text.

## Measured source size

The pristine DRL tree has 274 non-`.git` files totalling 33,614,945 bytes. Across the whole source distribution there are 55 `.pas` files / 28,691 lines / 928,959 bytes, 83 `.lua` files / 29,238 lines / 825,844 bytes, and two `.lpr` files / 194 lines / 5,419 bytes. These totals include build helpers, old source and bundled modules; they are not all game engine lines. Binary PNG artwork accounts for much of the tree size. The JSON reports every extension separately.

## Native engine subsystem map

| Source units | Responsibility that must be preserved |
| --- | --- |
| `dfdata` | Fixed map dimensions; item/equipment/damage/body target/resistance/status/movement enums; being/item/cell/level/light flags; prototype cell data and constants. Numeric IDs and bit flags cross the Pascal/Lua boundary. |
| `dfthing` | Entity IDs, UIDs, properties, hooks, traits/perks, name/description helpers, position, stream serialization, visual metadata. |
| `dfitem` | Prototype loading, inventory/equipment categories, damage dice, armor/resistance, alternate fire/reload names, descriptions, plural/article/quantity formation, stackability, ammo costs and fire readiness; stream serialization. |
| `drlinventory` | Carried items, equipment slots, capacity, stack splitting/merging, ammo lookup, wear/takeoff/swap and dump-to-world; serialization and Lua API. |
| `dfbeing` | Action costs and speed counter; movement/doors/pushing; pickup/drop/use/wear/takeoff/swap/reload/unload; melee and ranged attacks; hit/dodge/accuracy; burst, scatter, chain fire, knockback, armor degradation and resistance; health/healing, pain/AI state, death/corpses/gibs/XP; pathfinding and Lua API; serialization. Rendering and messages are currently interleaved with these rules. |
| `dfplayer` | Class and trait progression, XP/level up; kills/found-item/award/history tracking; episode transitions; run/path/multi-move stop rules; pre/post action; nuke and death results; mortem generation; save fields and Lua API. |
| `dfmap`, `dflevel` | Cell overlays/light/exploration, level initialization/generated/scripted levels, entity ownership, placement/random-empty selection, visibility and targeting, terrain destruction, blood/corpses, explosions/shotguns, hazards/fluids, resurrection, turn scheduler, nuke countdown, kill-all hooks, map descriptions and serialization. |
| `drlperk`, `drltraits`, `drlhooks` | Perk timers/groups/status display; trait levels, bonuses and master constraints; indexed hook eligibility/chaining. Hook ordering and cancellation are gameplay behavior. |
| `drlstatistics`, `dfhof` | Runtime counters, streak/damage/time/score and save penalties; player/score XML-backed archives, ranks, counted medals/badges/assemblies/uniques/kills, result ordering, reports, backups and achievements. |
| `drlcommand`, `drlbase`, `drlmultimove` | Typed command payloads, command validation and dispatch; complete lifecycle state machine; player creation; input-to-command orchestration; auto-target retention; repeat movement; seeded run and save/resume. |
| `drlua`, `drlmodule`, `drlworkshop` | Lua 5.1 host bridge, class bindings, blueprint/runtime registry loading, WAD/directory module loading, versions and active mod signature, module ordering/error handling; workshop/store integration. Mod support needs an explicit compatibility decision, not silent removal. |
| `drlio`, `drlgfxio`, `drltextio` | Layered UI, event/input acquisition, VTIG, tiles/console rendering, screen geometry, textures/font, mouse/gamepad targeting/panning, screenshots, message grouping/more prompt, visibility-aware audio/animations, visual RNG. |
| `drlaudio`, `drlanimation`, `drlparticles`, `drldecals`, `drlspritemap`, `drlmarkers`, `drlminimap` | Music/sound engines and timing, animation event queue, sprites/emissive/masks/shadows, effects/particles/blood/decal/glow/status/vignette, target/path overlays and minimap. Pure presentation may use a distinct visual RNG. |
| `drlmainmenuview`, `drlingamemenuview`, `drlsettingsview`, `drlplayerview`, `drlhudviews`, `drlmessagesview`, `drlhelpview`, `drlhelp`, `drlassemblyview`, `drlmoreview`, `drlpagedview`, `drlchoiceview`, `drlmodulechoiceview`, `drlconfirmview`, `drlloadingview`, `drlplotview`, `drlrankupview` | All screens and modal states listed below, entity inspection, help and generated reports. |
| `drlconfig`, `drlconfiguration`, `drlkeybindings`, `drlcontrollerbindings`, `drl.pas` | Boot/configuration/path flags, Lua legacy config, settings schema and rebinding, platform startup/shutdown/error handling. |
| `makewad`, `drlwad`, `gmfplayer`, root build scripts | Build/package/archive/audio tooling; not campaign gameplay. |

Valkyrie supplies substantial behavior outside this DRL tree: object/Lua serialization, UID ownership, deterministic RNG and Lua math functions, coordinates/areas/directions/dice/weighted tables, ray/FOV/grid/pathfinding/generation helpers, VTIG, SDL/OpenGL/window/event/gamepad/audio and WAD handling. The preserved logic layer must retain the relevant original dependency behavior and replace environment calls through the Rust boundary; reproducing only DRL's Lua tables does not reproduce its engine.

## Content registries and generated content

Base Lua runtime stores are `cells`, `rooms`, `diff`, `medals`, `badges`, `perks`, `traits`, `ais`, `chal`, `itemsets`, `emitters`, `mod_arrays`, `klasses`, `levels`, `requirements`, `rank_storage`, `being_groups`, `beings`, `items`, `awards` and `generators`. `core/blueprints.lua` defines validation schemas and defaults for these data structures plus nested records; those are schema definitions, not selectable content. The JSON lists every literal category declaration and its source provenance.

Registration has additional rules in `core/main.lua`:

- A being's embedded `weapon` table creates `nat_<being-id>` as an unpickupable natural ranged weapon, with default name `ranged attack`, ammo flags, sound inheritance and `OnCreate` equipment setup.
- A being's numeric/boolean/table `corpse` definition creates `<being-id>corpse` as a cell. The cell inherits name, HP/armor, sprite frames and resurrection behavior. A string corpse reuses an existing cell instead. Soldier reuses `corpse`.
- Missing enemy plurals become `name .. "s"`; this English rule must become explicit localized forms.
- Item sets inject `OnEquip`/`OnUnequip` behavior; item damage strings become dice fields; ammo/content string IDs resolve to numeric IDs; flags derive item category/exotic/unique/shotgun membership; `firstmsg` becomes `OnFirstPickup`; resistance/group properties are copied on creation.
- Class traits resolve requires/blocks to numeric IDs and duplicate class constraints into trait records. Rank registration is array-based: repeated `skill` / `exp` declarations are ordered ranks, not duplicate keyed IDs.
- Core supports generated class/master badges and module awards. The presence of a helper is not evidence that base DRL calls it; computed declarations must be enumerated from actual callers.
- Sprite sheets and emitters are presentation registries and must not consume gameplay RNG.

The bundled `classic.module` has its own legacy campaign/map script; the audit must retain it as separate module scope rather than conflate its registrations with base DRL.

## Campaign, special maps and outcomes

`drl/main.lua:drl.OnCreateEpisode` builds the main route:

| Main indices | Chapter and rule |
| --- | --- |
| 1 | Scripted Phobos entry `intro`. |
| 2–7 | Phobos procedural maps, with chapter style choices and danger increasing with depth. |
| 8 | `hellgate` scripted transition and Bruiser Brothers encounter. |
| 9–15 | Deimos procedural maps. |
| 16 | `tower_of_babel`, Cyberdemon. |
| 17–23 | Hell procedural maps. |
| 24 | `dis`, Spider Mastermind; ordinary or sacrifice ending. |
| 25 | `hell_fortress`, hidden final boss route after nuking Dis and surviving; John Carmack/Apostle special conditions. It is not automatically visited in every run. |

Twelve branch slots choose one script from each pairing below, subject to `canGenerate`, the script's level/range and difficulty/challenge conditions. Branch scripts are appended to the episode array with an exit back to the next main floor; their internal episode array indices are not their displayed main depth.

1. Hell's Arena.
2. Central Processing / Toxin Refinery.
3. The Chained Court (Arena completion changes encounter/rewards).
4. Military Base / Phobos Lab.
5. Hell's Armory / Deimos Lab.
6. The Wall / Containment Area.
7. City of Skulls / Abyssal Plains.
8. Halls of Carnage / Spider's Lair.
9. The Vaults / House of Pain.
10. Unholy Cathedral.
11. The Mortuary / Limbo.
12. The Lava Pits / Mt. Erebus.

There are 26 lexically active base map registrations (21 special branches, entry and four boss-route scripts), plus Classic's separate `phobos_arena`. `the_asmos_den` and its Hellmaster/item definitions are inside a Lua long comment: they are retained as inactive source material, not a registered branch. Every active map has source-specific layouts, item/enemy placement, waves, levers, triggers, kill-all states, escape rules and rewards. The exact registry names and script files are in JSON; preserve the ASCII coordinate maps and translations separately from narrative text.

`plot.lua` defines intro, Phobos/Deimos chapter transitions, normal Mastermind victory, death-by-nuke sacrifice, final John Carmack victory, final nuke/death variant and the Apostle/uberarmor special ending. `GetResultId` records `win`, `final`, `sacrifice`, `nuke`, `suicide`, `killed`, or `unknown`; challenges may override mortem and high-score descriptions. Endings, run result IDs and chapter-transition plot screens are different concepts and need separate tests.

## Classes, traits, difficulties and challenges

Selectable classes are Marine (`marine`), Scout (`scout`) and Technician (`technician`). The hidden Soldier (`soldat`) is also registered. Marine starts with +10 HP, resistances and powerup duration; Scout starts with +10 speed and stair sense; Technician has quick use, map/mod expertise and a tech mod. Equipment/ammo differs by class and difficulty/challenge hooks can subsequently alter it.

There are 35 lexically active traits: the internal Marine class trait, nine baseline traits, advanced requirements, rank caps that change at player level 12, class-native advanced traits, exclusions and 15 selectable class master traits, plus legacy source behavior outside standard trees. Commented trait declarations are listed separately. Exact IDs, labels, descriptions, hooks and class constraints must be migrated; a single simplified perk list is insufficient.

Five difficulties are `ITYTD`, `HNTR`, `HMP`, `UV`, `N!`. Each defines accuracy/experience/score/ammo/power factors; unlock rank requirements; challenge availability; Nightmare enables respawn and a speed factor. The JSON retains actual values, including defaults inferred from the difficulty blueprint.

Fifteen lexically active challenge IDs are Berserk, Marksmanship, Shotgunnery, Light Travel, Impatience, Confidence, Purity, Red Alert, Darkness, Max Carnage, Masochism, 100, Pacifism, Humanity and Overconfidence. Conquest, Haste, D&D and Power remain inside source comments and are inventoried separately as inactive. Challenge source fields govern unlocks, allowed dual-secondary pairings, archangel variants, descriptions, class/trait/item/use restrictions, starting kit/stats, episode rewrites, level hazards, nuke timing, exits and award conditions. Archangel variants are fields of challenge prototypes, not additional literal challenge registry IDs. Dual challenges run both hook sets; their ordering matters.

`ranks.lua` supplies skill and experience ladders and requirement functions (total/melee/pistol kills and acquired badges). `awards.lua`, challenge scripts, enemy scripts, unique items and special maps register badges/medals. Award evaluation includes hidden and win-only awards, replacement/removal of lesser medals, challenge/difficulty/class/weapon/kill/time/damage constraints, and persistent player data.

## Items, enemies, AI, terrain and generation

The item registry spans ordinary/exotic/unique melee and ranged weapons, ammo and prepared ammo packs, armor/boots and sets, consumables/powerups, phase devices, computer maps, backpacks/shards, standard/special mods, assemblies/schematics, barrels/trees/teleporters/levers, level keys/relics and natural attacks. Keep `stubitem` and other internal definitions marked internal, while preserving IDs for script compatibility. Weapon groups are melee/pistol/shotgun/rocket/chain/plasma/BFG. Alternate modes include throw, aimed/single/chain fire, rocket jump, full reload, overload/nuke and item-specific actions; item/perk callbacks drive unique mechanics. Item assembly registration includes basic/advanced/master recipes, mod counts, eligibility and transformation rules. Armor durability, movement/reload/fire/knockback modifiers and physical versus elemental resistance are gameplay, not descriptive decoration.

Enemies include former-human weapon variants, ordinary demons, elite humans, Nightmare variants, special-level enemies, Bruiser Brothers, Shambler, Lava Elemental, Agony Elemental, Angel of Death, Cyberdemon, Spider Mastermind, John Carmack, Apostle, Arena Master and Hellmaster. Prototype data includes HP/armor/accuracy/speed/vision/resistance/flags, level/weight/danger/XP, innate weapons, corpse behavior and special hooks.

The 14 AI prototypes are smart evasive/hybrid, charger, flock, melee ranged, ranged, sequential, arch-vile, spawner, angel, cyberdemon, John Carmack, teleport boss and mastermind. `core/aitk.lua` implements idle/hunt/pursue states, boredom/wander, visibility/target acquisition, group/faction scan, nearest targeting, path retry, flock alerting, follow/stay/hunt programs and friendly/hostile behavior. Special AI adds resurrection, summoning, charging, teleporting and boss attack phases. Infighting and target changes, not just movement toward the player, must be tested. Its safety loop permits state transitions until action time is consumed and errors after 1,000 steps.

Explicit terrain includes normal/cave floors and walls, reinforced/ice/glass walls, destroyed walls, crates, doors/open/locked doors, ordinary/special/yellow stairs, water/mud/acid/lava/blood, bridges/rocks, nuke and ammo/armor crates, blood/corpse overlays plus generated enemy corpses. Cell hooks, fly-versus-walk blocking, hazards, fluid depth/visual masks, permanence, destructibility, armor/HP, resurrection, item destruction and nukability differ by prototype.

Eleven procedural generators are tiled, maze, cave variants, arena, warehouse, architectural blocks, city, single/single-plus and lava. Generation composes BSP/ASCII architecture blocks, floor/wall/door styles, rooms, fluids/rivers/bridges, barrels, weighted monster/item placement, player/stairs placement and level events. Six room types are lever, teleport, ammo, basin (`basain_room` is the upstream ID), warehouse and vault. Generation weights/level/difficulty gates and phase order are rules.

Twelve event perks are ice, permanence, alarm, deadly air, armed nuke, acid/lava/blood flooding, targeted enemies, explosion, lava explosion and darkness. Timed hooks change terrain/entities and stats. Six temporary player affects are tired/running/berserk/invulnerability/environment suit/light. Many other perks implement alternate fire/reload, regeneration/recharge, curses, weapon hits/kills, unique-item and level reward behavior. `drl.OnTick` also enrages remaining demons at 15 minutes (warnings begin earlier), reducing XP and increasing speed/accuracy, with another escalation at 30 minutes; these effects persist for later spawned enemies.

## Commands, menus, settings and persistence

The domain command set in `core/commands.lua` is wait, enter, unload, pickup, drop, alternate fire, fire, use, save, active ability, weapon swap, action, alternate pickup, reload, alternate reload, melee, move, wear, swap, takeoff, quickkey and swap position. Payloads can include coordinates, item UID, equipment slot, alternate flag and content ID. No-op/cancel/failed commands can have different action-cost semantics.

Native input also provides eight-way walking/running/target movement, wait-repeat, look/target cycling/examine, inventory/equipment/traits/player info/messages/assemblies/help, nine quickkeys, sound/music/grid toggles, legacy door/drop/use/save bindings and mouse/gamepad controls. Movement target selection, firing target confirmation, alternate modes, RMB/middle/scroll, controller repeat/deadzone/rumble, cancellation and modal key focus need explicit browser adaptation. Browser mobile controls must expose the full game command vocabulary and diagonals.

Main menu states include first-run text, logo/intro, engine mismatch, continue/new game/high scores/player data/help/settings/promotion/exit; game type selection (Regular/Challenge/Seeded), seed entry (`1..999999`), difficulty, challenge/secondary/archangel selection, class/trait and player-name entry, corrupted/incompatible save handling and module choices. Seeded mode disables Platinum and higher badges. A custom-challenge description is retained in source, but its selectable type constant is commented out; do not present it as active by default. In-game menu includes continue/help/settings/message history/assemblies/abandon/save-and-quit. Other modal screens include inventory/equipment/item actions, character/trait level up, item/enemy/self inspection, paginated reports/help, confirmation/more prompts, plot screens, rank up and loading. External entered usernames remain unchanged.

Modern settings groups are general, display, audio, gameplay, input, controller bindings, seven visible keybinding groups and hidden confirm/cancel bindings. General has intro/default module; display has fullscreen/font/tile/minimap sizes/opacity and shake/flash/pulse/glow/fade/item-drop effects; audio has sound/music volume and menu/heartbeat/wait sounds; gameplay has random names/hints/run-over-items/message grouping/unlock-all; input has empty-fire confirmation/mouse/pan/gamepad/rumble. `bin/config.lua` retains additional legacy settings: graphics/audio engine, colored inventory, fixed name, blind/clear/more messaging, delays/capacity-drop behavior/buffer, archives/backups, menu return/run limits, console locking, intuition display, timestamp/crash save, English message wildcard coloring, colors and filesystem paths. Settings need explicit port support/mapping rather than silent omissions.

Native `drlbase.LoadSaveFile/WriteSaveFile` uses a gzip stream with exact module, engine-save version, module-save version and active-mod signature checks. It serializes UIDs, win/difficulty/challenge/archangel/secondary state, requested seed/seeded flag, complete game RNG state, player state, crash flag, normal level state and particles. Normal load deletes the save file after reading; corruption also deletes it. Crash recovery omits the level and recreates the run's next level using stored player/episode data. Player/entity/inventory/perk/trait/statistic/Kill/episode fields have their own stream order. The Web format can differ, but must version schema/content/RNG, validate before replacing a live run and retain all state required for deterministic continuation. Native-save import is a separate compatibility feature and must be reported explicitly.

Game seed preparation draws an episode seed from `FGameRNG`; Lua generation derives per-level seeds, including script-specific seed mixing. Simulation uses `DRL.GameRNG`/`LuaRNG`, while `core.visual_random` routes to `IO.VisualRNG`. Visual sounds/effects currently occur inside native rules. The Rust split should return semantic events for these without advancing simulation or RNG from rendering, resize, modal layout or animation duration.

## Text and Japanese coverage obligations

English text is embedded in native Pascal messages/errors/HUD/views/configuration/reports and Lua names/plurals/descriptions/quotes/first messages/help/history/mortem/plots/challenges/awards/ranks/levels/events/items. Standalone `.hlp`/`.txt` documents cover intro/start/keys/mouse/gamepad/credits/disclaimer/feedback/manual/version notes. ASCII map blocks and art are structured data, not prose to replace globally. Class names, developer/artist names, credit attributions, entered usernames and source IDs require distinct handling.

Current formation uses `%s/%d`, VTIG `{0}` placeholders, `@1` floor-history substitutions, Lua concatenation, articles/prepositions, plural suffixes, quantity/health labels, English result grammar, markup such as `{R...}` and `{$input_*}`, and byte/ANSI width limits. Semantic IDs must keep parameters typed (entity/item/terrain IDs rendered in the current locale; numbers; untouched username; command/key label), localize whole grammatical messages, and support localized singular/plural/entity forms. Japanese needs CJK-aware wrapping, cell width/input clipping and font coverage in every modal/HUD/report and mobile orientation. JSON parse success or counting raw literals is not full translation coverage.

## Migration dependencies and acceptance gates

| Layer | Selected implementation and boundary |
| --- | --- |
| Logic | Original Pascal `df*` gameplay, original Lua content/AI/hooks/generation/campaign, and original Valkyrie algorithms/RNG/serialization. Expose typed commands, immutable state projections, semantic text/effect events, save operations and modal response requests. Narrow adaptations may remove native IO coupling without rewriting mechanics. |
| Display | Rust rendering/layout/HUD/menus/reports/inspection/effects and English/Japanese semantic text formatting. It reads projections and events; frame timing, resize and language changes cannot advance original game state or game RNG. |
| Input | Rust keyboard/mouse/gamepad/touch/mobile focus, keybindings, targeting/cycling and command construction. Validation and action costs remain in original logic. Cancelled choices return explicit responses to the original callback flow. |
| Platform | Rust browser/storage/audio/window/clock/resource/module adapter. Load permitted assets and original Lua data, bridge the original core's WASM/runtime ABI, persist versioned saves/player data and schedule presentation independently. |

1. Freeze reference source, licenses, assets, dependency hashes, registries/defaults and complete text census. Validate every ID and cross-reference; materialize generated natural attacks/corpses and conditional module content in a reproducible audit. Record exact unsupported features before any playable claim.
2. Prove an original Pascal/Valkyrie/Lua core build/runtime pathway for the real browser. A native executable build or Rust scaffold does not prove this. Verify compiler/runtime/ABI capabilities against actual source dependencies and run original RNG/grid/ray/pathfinding/generation fixtures in that browser runtime.
3. Define a narrow original-core command/state/event ABI and remove native display/input/platform calls through adapters in a separate adapted tree. Preserve integer rounding/caps, UID invalidation, hooks and rule code. Start with real native-core actions and compare resulting state/events to the native reference.
4. Solve native modal continuations explicitly. `drlbase.Run` and actions currently push native UI layers and synchronously `IO.WaitForLayer`; item/trait/level choices can occur inside rule callbacks. Rust browser UI must return choice/cancel responses while preserving the original action's ordering and cost. A synchronous command API alone does not establish full-game compatibility.
5. Route original text emissions/description projections to semantic IDs and typed parameters; keep calculations, content IDs and external usernames unchanged. Retain the full procedural/special maps, campaign/challenges, awards/HOF/mortem and original save logic. Rendering events replace native drawing calls, not rule execution. Native scheduling ticks all entities and executes eligible nonplayers until player speed counter exceeds the readiness threshold; renderer frames cannot replace game ticks.
6. Implement all Rust display/input/platform flows and semantic locales, then browser persistence/audio/accessibility/PC/mobile validation. Publish only after faithful playable milestone coverage is described and tested; an asset catalog or static preview is not the game.

Required acceptance evidence:

- **Content fidelity:** every active reference registry ID (including generated IDs) remains available, field/default/cross-reference parity is checked, and each original source callback executes through the preserved core or has an explicit unresolved integration record. Inactive commented content is separately recorded. Validate all map coordinates/transitions/rewards and all class/challenge restrictions.
- **Determinism:** same reference seed/command trace gives stable state hashes and gameplay events; simulation traces survive render calls, hover/resize/language/mobile layout and disabled audio. Draw/UI inspection must not alter state or gameplay RNG. Distinct animation/visual RNG state may vary without gameplay changes.
- **Rules:** differential fixtures cover movement/corners/doors/pushing, every weapon group and alternate mode, accuracy/dodge/scatter/burst/explosion/knockback, armor/resistance/durability, ammo/stack/full inventory, powerups/perk timers, trait requirements/master blocks, hazards/fluids, resurrection/spawn/infighting, nuke/countdown and enrage.
- **Save:** snapshot at representative campaign/special/challenge/boss states; reload and compare every state field/RNG plus a subsequent command trace. Check bad/unknown schema/content version/mod signature, truncation/corruption, interrupted storage, crash/normal resumes and archive persistence. Never claim native save compatibility without native fixtures.
- **Localization:** zero missing/unknown IDs; matching named-placeholder/type sets in English/Japanese; every dynamic name/plural/help/error/settings/award/result route emits IDs and parameters; no raw upstream English messages reach UI. Preserve usernames and attribution. Verify CJK truncation/wrapping and markup/key-label expansion visually.
- **Full flow:** actual browser fresh launch → seed/difficulty/class/trait/name → movement/combat/inventory/use/reload → every special branch → bosses → ordinary/sacrifice/full/special outcomes → awards/HOF → another run; plus death/abandon/save/resume and all supported challenge modes. Use PC keyboard/mouse and mobile touch in portrait/landscape; confirm modal focus, diagonals, target cycling, scroll and save after tab close/reopen.

Concrete dependencies still requiring separate evidence are native reference execution/compiler availability, the original Pascal/Valkyrie/Lua browser runtime and ABI, native modal continuations, environment-call isolation, materialized conditional registries, permitted audio/asset sourcing, browser fidelity and deploy verification. This inventory supplies the scope and acceptance gates; it does not resolve or waive those dependencies. The original-language core is the selected implementation, and a Rust replacement of its rule systems is outside the clarified scope.
