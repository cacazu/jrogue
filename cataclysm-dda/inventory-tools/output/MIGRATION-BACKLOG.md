# Gameplay and four-layer migration backlog

This inventory preserves the complete original source and data. It records migration work; it does not claim a complete Rust port or mechanically verified coverage.

| Feature family | Source files | Data types | Status |
| --- | ---: | ---: | --- |
| Game initialization, worlds, scenarios, character creation, turns and commands | 46 | 7 | Retained upstream; migration/parity checks pending |
| Overmaps, terrain, furniture, map generation, reality bubble, vision and navigation | 92 | 61 | Retained upstream; migration/parity checks pending |
| Body parts, wounds, healing, fatigue, sleep, thirst, hunger, calories, disease, temperature and morale | 65 | 26 | Retained upstream; migration/parity checks pending |
| Skills, proficiencies, traits, mutations, bionics, professions and backgrounds | 25 | 42 | Retained upstream; migration/parity checks pending |
| Item types, containers, pockets, inventory, wear, wield, charges, food, use actions and item migrations | 89 | 220 | Retained upstream; migration/parity checks pending |
| Activities, crafting, recipes, disassembly, building, repairing, farming, fishing, foraging and butchery | 37 | 18 | Retained upstream; migration/parity checks pending |
| Melee, ranged fire, aiming, throwing, martial arts, defenses, projectiles, explosives and damage | 19 | 19 | Retained upstream; migration/parity checks pending |
| Creatures, monster attacks, behavior, spawning, movement, NPC schedules and companions | 77 | 19 | Retained upstream; migration/parity checks pending |
| Dialogue, dynamic text, trade, missions, quests, events, achievements, faction camps and jobs | 85 | 40 | Retained upstream; migration/parity checks pending |
| Vehicles, parts, driving, physics, collision, autopilot, engines, batteries, electrical grids and appliances | 28 | 11 | Retained upstream; migration/parity checks pending |
| Calendar, time, weather, wind, scent, light, fields, traps and simulation sounds | 33 | 8 | Retained upstream; migration/parity checks pending |
| Spells, enchantments, relics and optional fantasy content | 14 | 58 | Retained upstream; migration/parity checks pending |
| Save/load, compatibility, content loading, migrations, deterministic RNG and serialization | 42 | 71 | Retained upstream; migration/parity checks pending |
| Terminal and tile drawing, ImGui, menus, panels, help, messages, localization, Unicode and fonts | 168 | 15 | Retained upstream; migration/parity checks pending |
| Keyboard, pointer, touch, keybinding contexts, action maps and text entry | 14 | 1 | Retained upstream; migration/parity checks pending |
| Filesystem, browser integration, platform services, audio assets, crashes and runtime utilities | 31 | 2 | Retained upstream; migration/parity checks pending |
| Shared utilities, containers, third-party libraries and source maintenance tools | 167 | 6 | Retained upstream; migration/parity checks pending |

0 source files and 0 JSON types still need classification review. Every residual is included in `feature-manifest.json`; none is silently omitted. Families overlap where a feature crosses systems.

## Required milestones

- **M0: Immutable source and exact inventories.** Verified source hash/license manifest; all relevant files and residual classifications accounted for; exact PO plurals/contexts and JSON source spans retained.
- **M1: Full engine browser baseline.** Compile official engine for Emscripten; retain required data/mods/assets and licenses; Japanese input/fonts and localization; create world/character and playable full turn loop in PC/mobile browser.
- **M2: Rust presentation/platform/input boundaries.** Frame rendering consumes immutable snapshot; keyboard/touch commands isolated; persistent browser storage and audio adapters; no rendering-caused simulation/RNG change.
- **M3: Versioned deterministic save and commands.** Command/event boundary, seeded replay and RNG state; load old supported saves; save/resume world, character, inventory, NPCs, vehicles, weather and pending activities; deterministic serialization checks.
- **M4: Reviewed semantic English/Japanese JSON.** Catalog contains every production text ID, context/plural/parameter contract; missing entries and rejected placeholders reviewed; all JSON extractor handlers reconciled; user names preserved; CJK layouts verified.
- **M5: Incremental gameplay logic migration.** Migrate each listed feature family against reference parity tests; maintain complete original engine between milestones; resolve every residual source/data type classification.
- **M6: Private independent Site deployment.** Verified full flows, portable WASM packaging, license/source obligations and real browser smoke checks; publish only tested release artifact; record exact deployment URL.

## Exact packaging evidence

- build-scripts/prepare-web.sh:4: `rm -rf web_bundle`
- build-scripts/prepare-web.sh:9: `cp -R data/{core,font,fontdata.json,json,mods,names,raw,motd,credits,title} $DATA_DIR/`
- build-scripts/prepare-web.sh:10: `cp -R gfx $BUNDLE_DIR/`
- build-scripts/prepare-web.sh:13: `find web_bundle -name ".DS_Store" -type f -exec rm {} \;`
- build-scripts/prepare-web.sh:15: `# Remove obsolete mods.`
- build-scripts/prepare-web.sh:16: `echo "Removing obsolete mods..."`
- build-scripts/prepare-web.sh:17: `for MOD_DIR in $DATA_DIR/mods/*/ ; do`
- build-scripts/prepare-web.sh:20: `        rm -rf $MOD_DIR`
- build-scripts/prepare-web.sh:25: `rm -rf $DATA_DIR/mods/MA`
- build-scripts/prepare-web.sh:26: `echo "Removing Ultica_iso tileset..."`
- build-scripts/prepare-web.sh:27: `rm -rf $BUNDLE_DIR/gfx/Ultica_iso`
- build-scripts/prepare-web.sh:29: `$EMSDK/upstream/emscripten/tools/file_packager cataclysm-tiles.data --js-output=cataclysm-tiles.data.js --no-node --preload "$BUNDLE_DIR""@/" --lz4`
- build-scripts/prepare-web.sh:34: `  cataclysm-tiles.{data,data.js,js,wasm} \`

The upstream Web preparation script is a filtered bundle. The release must account for every omitted category and every content/assets license; use the recorded script lines and file inventory before deciding what to retain.

## Translation coverage verification

The upstream has 98 JSON localization parser modules. Heuristic JSON candidates must be reconciled with those modules. The complete list, boundary/RNG candidates, source assignments and JSON type assignments are in `feature-manifest.json`.
