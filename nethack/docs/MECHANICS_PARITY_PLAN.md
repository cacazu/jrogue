# NetHack mechanics parity and release phases

This plan follows the user's [generalization Page](https://chatgpt.com/space/page_2ca2b2b56c0481919dc6359685d3bf4f), read by the parent at sequence 675, [ARCHITECTURE.md](ARCHITECTURE.md), and the user's subsequent explicit clarification: preserve gameplay in its original language and separate display, input and environment-dependent work in Rust. The target is therefore original C logic plus three Rust layers. A Rust gameplay rewrite is outside this task's target and is not a release gate.

Existing Rogue boundary and test documents informed this plan through [EXISTING-ARCHITECTURE-AUDIT.md](EXISTING-ARCHITECTURE-AUDIT.md). Their recorded successes are not NetHack test results. Browser play takes priority; dedicated smartphone controls must be verified for this game.

## Evidence and state ownership

`catalog/source-mechanics.json` lists every core C file, subsystem, function candidate, source location, SHA-256, and RNG/message call candidates. `catalog/source-summary.json` provides exact scan totals. The extraction schema's `rust_gameplay_parity: not-evaluated` field records no Rust port claim; that optional audit dimension is outside the confirmed target. Current fidelity review must establish preservation of the original C behavior through the new boundaries. Assigning a subsystem category does not establish gameplay parity.

Logic owns turns, occupations, monster actions, rules, knowledge, and RNG. Input/application converts a keyboard, mouse, or touch intent into an explicit command in the current command/prompt/menu/text context. Logic returns events with English semantic IDs and typed arguments plus immutable observations. Rust display resolves EN/JA catalogs and assembles frames; platform validates and persists saves. Application orchestration belongs to the input/logic boundary and does not silently add a fifth top-level layer.

Rendering a frame again, changing language, scrolling, changing font size, resizing, exposing an accessibility label, or restoring message history must not consume input, advance the turn, or draw randomness. Source functions using `rn2_on_display_rng` need explicit migration review; a separate cosmetic RNG stream still cannot be advanced by arbitrary redraws. Resolve random public observations in the logic observation step and retain them in the snapshot for repeatable rendering. Preserve upstream behavior for gameplay actions such as looking, gaze checks, and hallucination; do not convert those actions into paint callbacks.

Typed descriptors reveal only upstream-visible knowledge. Unknown object effects, blessing/curse, enchantments, charges, traps, invisible/hallucinated identities, and undiscovered map cells must remain unavailable until the source rules reveal them. User names, labels, wishes, fruit, and percent characters remain UTF-8 data and cannot become format strings or translation keys.

## Phases and their exit evidence

| Phase | Implementation scope | Required evidence |
| --- | --- | --- |
| P0: pinned immutable reference | Preserve the official release archive/tree, release commit, digest, license and assets audit. Generate core mechanics and whole-tree text inventories. | Official-source provenance and archive digest; complete file manifest; scanner extraction tests and source-manifest verification. This phase alone is not a playable product. |
| P1: full behavioral reference | Build official 5.0.0 rules with pinned Lua, all dungeon/quest/special-level data, and the full shim/library window interface. Isolate instrumentation/build edits in a work copy. | Reproducible native/WASM artifacts; startup and all input callback classes; reference trace format; upstream/work-tree differences and artifact hashes. No omitted Lua or simulated frontend rules. |
| P2: Rust boundary foundation | Implement Rust input/application contexts, typed events/visible snapshots, display, and platform adapters. Preserve command timing, occupations, interruption, initial choices and RNG ownership in the original C logic. | Same-command reference observations; repaint/language/resize invariance; unknown-state protection; deterministic seed/state behavior; native and WASM boundary tests. |
| P3: complete C-logic preservation | Retain all source-derived rules, including generation, terrain, objects, equipment, monsters, combat, magic, hazards, survival, religion, economy, pets, quests and endgame. Limit work-copy changes to explicit semantic output/observation and platform-boundary adaptation. | Per-module source-change ledger, branch fixtures and seeded traces against the pinned C reference; state/RNG/input-position comparisons after each accepted command; documented differences and source-linked evidence. No reduced frontend substitute. |
| P4: full semantic text and Japanese | Capture output before formatting; review every message/data surface and unresolved dynamic call; implement entity/grammar descriptors; integrate stable English semantic IDs plus typed args with paired `en.json`/`ja.json`. | Complete reviewed disposition ledger; key/argument-schema validation; Japanese-default startup; naming/wish/quest/menu/help/status/death coverage; no missing IDs or fallback along executed tests; explicit residual coverage gaps. Extraction candidates are not runtime translation coverage. |
| P5: browser persistence and PC/mobile play | Connect the verified engine to all menus, commands, text entry, targeting, movement, look/help, inventory, messages and endings. Persist saves with IndexedDB and import/export; implement a usable smartphone interface. | Fresh-instance resume at command, direction, item, menu, More and unfinished text contexts; pending input journal fidelity; actual IndexedDB transaction/reload tests; corrupt/incompatible save rejection; desktop and touch browser scenarios without hidden keyboard dependence. |
| P6: tested local HTML delivery | Package tested local HTML/JavaScript/WASM artifacts, reviewed licenses, notices, actual corresponding source and reproducible build instructions. The user's final scope is local HTML with Node/browser verification. | Actual local artifact paths and Node/browser test evidence; correct isolation headers if the integration requires SAB; save/load across refresh; mobile controls; artifact/source/catalog hashes; corresponding source availability. Delivery acceptance remains pending while C-logic fidelity, Rust boundary, full Japanese, or browser usability gates remain incomplete. |

Implementation may proceed in parallel where dependencies allow. A phase is complete only when its observed evidence is recorded; building a reference engine cannot be relabeled as completion of P3, P4, or P5.

## Mechanics scenarios to cover

The source inventory is organized into 18 subsystems. The parity ledger must also track concrete behavior across their boundaries:

- Initial role/race/gender/alignment combinations, starting inventories, attributes, experience, conduct, skills and intrinsics.
- Turn cost, speed, monster scheduling, occupations, repeated commands, running/travel, interruptions, free commands, death/quit and regeneration.
- Dungeon topology, branches, stairs, room/maze generation, special Lua levels, Sokoban constraints, the Quest, Gehennom, the invocation and elemental/astral planes.
- Movement, terrain, doors/locks, bridges, digging, boulders, water/lava, pits/holes, visibility, light, blindness, map memory and secret features.
- Object generation, appearance randomization, discovery, naming/wishing, artifacts, stacking/splitting, pickup/drop, containers, equipment, curses, charges, erosion, shop bills and unpaid goods.
- Melee/ranged/thrown/kicked combat, damage types, resistances, weapon skills, enchantment, ammunition, explosions, engulfing, grappling, stealing and death causes.
- Every monster family and special behavior, spawning, movement/AI, item/spell use, pets/tameness, riding, were-creatures, worms, minions, players, priests and shopkeepers.
- Potions, scrolls, spells, wands, polymorph, invisibility, hallucination, confusion/stun, timed effects, teleportation, detection and cancelled/failed actions.
- Hunger, food/corpses, nutrition, eating occupations, sickness, poisoning, petrification, sliming, strangulation, traps, fountains, sinks, thrones and encumbrance.
- Prayer, sacrifice, altars, alignment, priests, quest dialogue/progression, nemeses, Wizard harassment, the Amulet, disclosure, scoring, bones and ascension.
- Engravings, music, rumors, oracles, encyclopedia/help text, messaging, menus, status fields and all player-facing text contexts.

These are review dimensions, not a claim of exhaustive combinatorial testing. Include rare rule branches and interactions explicitly rather than inferring coverage from a long normal-game replay.

## Differential trace and evidence format

Each comparison must pin release/configuration/dependency versions, source/build hashes, seed/RNG state, role/race/alignment choices and the exact consumed command stream. Observe logical turn/input position, player state/status, current level/terrain/knowledge, object/monster identities and fields, inventory/equipment, branch/quest flags, occupations/waits, and RNG progression. Keep public presentation observations separate from private state used by the test harness. Normalize addresses and pointer ordering without discarding rule-relevant state.

Compare after commands and meaningful substeps, not only the final score or a screenshot. Save/restore must continue in a fresh instance and produce the same next outcomes. Shared reference/product adapters can hide a shared defect, so supplement differential tests with independent protocol, visibility, storage, and actual browser tests. Boundary unit tests, fixtures, traces and browser scenarios are different evidence kinds; do not add their counts into a fictional full-game compatibility total.

For each adapted C module, record upstream/work-copy differences, semantic-output and Rust boundary paths, covered functions/mechanics, branch fixtures, cross-subsystem scenarios, unresolved differences, and actual artifact/source hashes. Record original-behavior preservation only after reviewing the module's evidence. A future optional Rust gameplay migration would require a separate acceptance ledger; the scan does not initiate or certify one.

## Terminal state and local delivery gate

This document and the inventory establish the integration scope. They do not establish C gameplay fidelity through the new boundaries, Japanese completeness, browser persistence or mobile usability. Those gates remain governed by the parent task's actual verification record. The current task ends in verified local HTML artifacts and source availability; external publication is outside the final authorized scope. Until every required gate passes, retain tested intermediate artifacts and explicit blockers without labeling them a completed localized game.
