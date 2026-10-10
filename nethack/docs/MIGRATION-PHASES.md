# Tested migration phases and release gates

This document is a work plan, not evidence that the phases have completed. Refer to `verification.json` for measured terminal status.

| Phase | Deliverable | Required evidence |
|---|---|---|
| 0: provenance | Official 5.0.0 source, release SHA, exact archive checksum, untouched tree, licenses | Every source file matches original archive; isolated project ownership |
| 1: complete reference engine | Official WASM C/Lua engine with all game data and shim | Real new game, all 13 roles/5 races constraints, dungeon branches/Lua loading, real movement/combat, inventory/prompt/menus |
| 2: four boundaries | Rust typed input/events/presentation/platform with browser adapters | Native Rust tests; same seeded command stream across language/re-render; no gameplay import from display |
| 3: text migration | English semantic IDs + typed args for every text producer, Japanese JSON | Whole-source inventory closed; dynamic entities obey knowledge; catalog/placeholder parity; no fallback for all supported branches |
| 4: persistence/input | Real save and fresh-instance load, PC/mobile/gamepad | Restore exact world/turn/RNG, prompt states, corrupt/version-mismatched saves rejected; touch keyboard/menu/count/text input tested |
| 5: faithful native gameplay | Preserve official C mechanics through boundary changes; no gameplay rewrite | Full source/data inclusion and behavioral fixtures: RNG state, world state, public text/glyphs and saves |
| 6: private publication | Checked source and tested full-game artifact through Sites workflow | Pushed source commit, archive from same commit, successful terminal native deployment status and literal URL; actual text coverage and phase disclosed |

## Gameplay coverage sequence

The user explicitly confirmed original-language gameplay with Rust display/input/environment adapters. Keep the official engine throughout: scalar types and canonical state; RNG; tables and entity IDs; command/prompt state machine; dungeon/level Lua interpretation; perception/knowledge/glyphs; movement and timed effects; objects/equipment/identification; combat and monster AI; food/prayer/spells; shops/temples/pets; traps/terrain/special levels; quests/artifacts/branches; death/score/ascension; save/bones/replay. Every mechanic and source producer in the inventory must stay accounted for. No full Rust gameplay rewrite is required or planned.

No reduced dungeon, finite demo monster table, simplified potion rules, mock save or a random-movement toy counts as NetHack. A tested complete native-core browser engine with Rust adapters is a valid reference phase; its untranslated game text must be disclosed. Do not publish a loading screen or an untested browser adapter.
