# DRL upstream and publication audit

Audited 2026-10-02 using official upstream files and GitHub REST metadata. This is a bounded source audit, not a port implementation or publication approval.

## Immutable baseline

The official current repository is [chaosforgeorg/drl](https://github.com/chaosforgeorg/drl). Older ChaosForge/doomrl URLs redirect there. GitHub marks [0_10_11a](https://github.com/chaosforgeorg/drl/releases/tag/0_10_11a) as its latest non-prerelease, published **2026-08-24T20:12:27Z**. Its exact commit is **a6f965072b3a25b768c91dbced00367f1b57d865** ([commit](https://github.com/chaosforgeorg/drl/commit/a6f965072b3a25b768c91dbced00367f1b57d865)).

The pinned tree is not truncated. It contains **274 files, 33,607,601 bytes**, including **55 Pascal source files / 928,959 bytes** and **83 Lua files / 825,844 bytes**. These are tree-file counts, not archive size or line counts. There are no gitlinks or `.gitmodules`; the engine is a separate repository rather than a submodule. Both core and module declare engine/module and save version **0.10.11** despite the hotfix tag suffix.

Official source archive endpoint: `https://github.com/chaosforgeorg/drl/archive/a6f965072b3a25b768c91dbced00367f1b57d865.zip`. Acquisition of that archive, local SHA-256 and extraction belongs to the implementation agent; this audit only fetched plain-text files and REST metadata.

The matching separately available engine is [FPC Valkyrie tag 0_10_11](https://github.com/chaosforgeorg/fpcvalkyrie/tree/0_10_11), exact hash **f89735a741a968997656c2d48a003ec569db7f22**, under [MIT](https://raw.githubusercontent.com/chaosforgeorg/fpcvalkyrie/0_10_11/LICENSE). This tag is an appropriate explicit dependency baseline, but has not been build-tested here. Upstream CI checks out mutable `development`; its exact dependency for the historical binary cannot be established merely from that workflow. A historical branch lookup around release time returned `9ad3aa2c262ca436b7b1468bcd39a775ec90e9ac`, which is supplementary evidence, not proof of the release's build input.

The [README](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/README.md) is stale about version 0.10.0. It identifies Free Pascal/Lazarus, Valkyrie, and **Lua 5.1 specifically**. Rules are Lua source and native engine code is Pascal. Native `makewad` produces rule/graphics WAD archives; prebuilt WADs are unnecessary when source is compiled. The [pinned CI workflow](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/.github/workflows/ci.yml) provides a build recipe and downloads excluded audio from prior 0_10_9a release packages with fixed SHA-256s. The game/rules source is available; the upstream source archive is not an entirely free multimedia/runtime distribution.

## Licenses and excluded material

| Material | Evidence and publication treatment |
| --- | --- |
| DRL Pascal/Lua code | README explicitly grants GPL 2.0; retain [GPL text](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/LICENSE), copyright and change notices. The original-core browser adaptation should remain GPL-compatible and provide complete corresponding source alongside the distributed WASM/build scripts. Do not casually claim GPL-2.0-or-later without a separate granting notice. |
| Original and additional graphics | README names Derek Yu and Łukasz Śliwiński and grants CC BY-SA 4.0 for art. Retain creators, notices, [graphics license](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/bin/data/drl/graphics/LICENSE), source link and modification notices; adaptations share alike. This license does not grant trademark rights. |
| Original MIDI/sound effects | [Manual credits](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/bin/manual.txt) identify id Software. No downstream open asset license was found. Exclude MIDI/WAV from publication. |
| HQ soundtrack/sounds | Manual credits Sonic Clang remixes and Per Kristian Risvik recreations as used with permission. That is not evidence of a general redistribution/adaptation grant. Simon Volpert special-level tracks also lack a separate open grant in audited notices. Exclude MP3/WAV from publication. |
| Full native binary bundle | [Installer notice](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/install/install_license.txt) still describes freeware with author notification for redistribution. This is not the GPL code grant; do not use it to claim bundled assets are open. Redistributing the original package requires separate treatment. |
| FMOD | Repository contains `ext/windows/fmod64.dll` and `ext/linux/libfmod.so`. [FMOD licensing](https://www.fmod.com/licensing) describes project licensing for engine distribution; no open source grant is shown. Exclude from Web and public-source deliverables. |
| Steam runtime | Repository contains `ext/windows/steam_api64.dll` and `ext/linux/libsteam_api.so`; the commercial Jupiter Hell Classic packaging path is present in build scripts. Do not bundle this runtime or JHC data as free DRL content. |
| Lua | Preserving the original core requires Lua 5.1. If a Lua implementation is bundled, its [MIT copyright notice](https://www.lua.org/license.html) must be retained. A wholesale Rust rules replacement is outside the clarified scope. |
| Fonts and other binaries | Do not assume unspecified binary assets inherit GPL. Web system/CJK fonts avoid ambiguous native font assets. SDL headers/runtimes, if reused, need their respective notice/source audit; a browser adapter can omit them entirely. |

The permitted concrete asset-free alternative is the same DRL mechanics and GPL-derived code rendered as ASCII/CSS/canvas using browser system fonts, silent audio or newly authored original tones, and no imported Doom/third-party audio or proprietary native libraries. Verified CC BY-SA art may be used with attribution/share-alike compliance. Audio exclusion does not justify omitting game mechanics.

Retain pristine upstream locally and outside public build outputs. The pristine tree itself includes proprietary runtime binaries, so committing the entire extracted source tree or archive into a public repository would redistribute those binaries. Keep that acquisition ignored/private; public corresponding source should contain the preserved/adapted Pascal/Valkyrie/Lua core, bundled Lua C runtime, Rust display/input/platform code, translations, tests, build scripts and licenses.

## Gameplay inventory from the pinned source

**Later complete source-ledger evidence supersedes the bounded counts below.** [feature-inventory.json](feature-inventory.json) schema 2 distinguishes active/inactive/generated definitions and records 22 categories, 26 active maps, 15 challenges, 35 traits, 40 beings, 151 explicit items plus 21 generated natural attacks, 28 explicit cells plus 23 generated corpses, 42 assemblies, 35 being groups, 73 hook types and 13 inactive definitions. The earlier table remains audit history; it is not the authoritative final count. See [feature-inventory.md](feature-inventory.md) for original-core subsystem mapping and definition details.

Counts below are explicit registration declarations, not executed registry totals: auto-generated monster weapons and shared helpers can create additional entries. Preserve complete source-based registries and hooks rather than assuming a count is the complete game model.

| System | Verified baseline and primary source locations |
| --- | --- |
| Campaign and generated world | Main campaign, procedural maps, room/BSP generators, level events, Phobos/Deimos/Hell progression, bosses, ending conditions and optional special-level branches: `bin/data/drl/main.lua`, `generator.lua`, `generators.lua`, `rooms.lua`, `plot.lua`; core `generator.lua`, `bsp.lua`, `level.lua`. |
| Special levels | **24** level Lua files, including intro, arena, labs, central processing, toxin refinery, armory, walls/vaults, limbo/mortuary, Mt. Erebus, lava pits, boss arenas, containment: `bin/data/drl/levels/`. Several files can register more than one variant. |
| Actors and AI | **38 explicit enemy IDs**, including ordinary, elite/nightmare variants and bosses. AI styles, ranged/melee abilities, resistances, death/corpse behavior and source callbacks: `beings.lua`, `ai.lua`, core `aitk.lua`, native `dfbeing.pas`. Enrage and infighting were added in 0.10. |
| Character setup | **5 difficulties** with accuracy, experience/score/ammo/power factors, unlock thresholds, speed and Nightmare resurrection. **3 visible classes** (Marine/Scout/Technician) plus hidden `soldat` class. Class-specific starting gear and trait constraints: `difficulty.lua`, `klass.lua`. |
| Progression | **36 explicit traits** including basic/advanced/master traits, prerequisites, exclusions, levels and class matrices; perks; XP/leveling. `traits.lua`, `klass.lua`, `perks.lua`, native `drltraits.pas`, `drlperk.pas`, `dfplayer.pas`. |
| Challenges | **19 explicit challenge definitions**, plus dual/secondary challenge behavior and Archangel variations implemented by callbacks. They alter loadout, map/generation, weapon rules, healing, visibility, inventory, progression and win conditions: `challenge.lua`, `archi.lua`. |
| Items/equipment | **126 explicit item declarations**: 61 common, 38 exotic, 27 unique/artifact entries. Ranged/melee weapons, alternate fire/reload, magazines/ammunition, consumables, armor/boots durability/resistances, powerups, mod packs, levers, barrels and schematics. Sources: `items/items.lua`, `items/eitems.lua`, `items/uitems.lua`, native `dfitem.pas`. |
| Modding/assemblies | **42 explicit assembly recipes** with order/type, trait prerequisites and item/stat/callback mutations; known-assembly persistence, disassembly/scavenging, item sets: `assemblies.lua`, `traits.lua`, `drlassemblyview.pas`. |
| Combat/movement | Turn/energy/time scheduling, eight directions, doors, melee, projectile paths, shotgun patterns, explosions, splash, range/accuracy, dodge, knockback, run/tired tactics, prepared weapon swap, unloading, terrain interactions, corner shooting and AI item behavior: native `dfbeing.pas`, `dflevel.pas`, `dfplayer.pas`, `drlcommand.pas`; Lua rules. |
| Environment/status | Terrain/cells, destructibility, fluids/hazards, corpses/blood, barrels/chain explosions, flooding/levers, timed powerups/status effects, radiation protection, invulnerability, berserk, tracking and scripted events: `cells.lua`, `affects.lua`, `events.lua`, native world code. |
| Metagame/persistence | Awards/badges/medals, skill and experience ranks, unlocks, item/monster kill statistics, assemblies, score/highscores, player history, mortems and run result screens. **38 explicit rank rows** across skill/experience paths: `awards.lua`, `ranks.lua`, core `mortem.lua`, `dfhof.pas`, `drlstatistics.pas`. Native saves use source-specific serialization, not a browser-compatible format. |
| UI/control/configuration | Main/setup menus; inventory/equipment/traits/character panels; targeting/look/help/messages; quick slots; mouse and controller help; settings/key/controller bindings; minimap; save/quit/abandon; custom module and workshop handling. Source views, `drlio.pas`, `drlgfxio.pas`, `drltextio.pas`, `drlconfig*.pas`, help `.hlp` files. |

The [0.10 release description](https://github.com/chaosforgeorg/drl/releases/tag/0_10_0e) corroborates infighting, enrage, new special levels and fluids. Full mechanics fidelity must be checked against current native and Lua source, not against the earlier manual's partial beginner explanation.

## Text migration inventory

User-visible English spans Lua `name`, `desc`, `description`, kill descriptions, plot/menu fragments, contextual messages and hooks; native Pascal views/commands/errors/configuration; all help `.hlp` files; credits; highscore/mortem/award/rank text and conditional statistics. The source uses inline formatting/color markers and concatenation. Text extraction must distinguish stable registry IDs, executable Lua/Pascal expressions, formatting markup and external/player names from translatable display text.

Required semantic keys should derive from stable content IDs and roles (for example `being.imp.name`, `trait.ironman.description`, `command.reload.no_ammo`) with named parameters for actor/item/quantity/damage/place. Save content IDs rather than translated strings; external/player names remain supplied values. English and Japanese JSON must have equal key sets and identical placeholder sets, including dynamic messages/plurals, errors, help and settings. Japanese CJK width/layout is a presentation concern. A substring replacement table cannot establish coverage.

## Four-layer mapping after the original-language-core clarification

1. **Logic, original Pascal/Lua:** preserve maps, actors, IDs, items, time/turn order, RNG, combat/AI/generation/status/traits/challenges/win rules, command validation, sessions/progression and original serialization. A thin original-language facade exposes commands/snapshots; no wholesale Rust domain rewrite.
2. **Display, Rust:** immutable views, semantic text resolution/CJK layout, targeting/inventory/help/settings screens, draw calls and animations. No rule changes or gameplay RNG consumption while rendering.
3. **Input, Rust:** browser keyboard/mouse/touch/controller intentions become typed commands; the original core validates and executes gameplay.
4. **Platform, Rust/browser glue:** core WASM ABI/WASI host, timers, browser storage/import/export and permitted audio. Native alternatives isolated here; core and UI memory ownership explicit.

Rust numeric/RNG code is reference verification only. The source-supported toolchain investigation and concrete mixed Pascal/Lua ABI work are recorded in [docs/ORIGINAL-CORE-WASM.md](docs/ORIGINAL-CORE-WASM.md).

Milestones should record exact upstream systems ported and tests proving behavior. A browser arena with a pistol is not complete DRL. Entire campaign, variants/traits/challenges/items/special levels/profile/help must remain explicit in the completion ledger. Unported systems are concrete scope blockers to a complete-port claim; replace or omit restricted audio with clear attribution instead of treating assets as a gameplay blocker.

## Audit deliverables

- `drl-pinned-tree.json`: official REST recursive tree snapshot for pinned commit, including blob hashes and sizes.
- `drl-release-and-dependency.json`: latest release metadata, sizes/URLs, dependency tags/hashes.
- `audit-input/`: selected official plain-text source and notices used for this audit; no downloaded executable was run.

No shared repository file, Git index, build, installer, browser deployment or Site was modified by this research task.
