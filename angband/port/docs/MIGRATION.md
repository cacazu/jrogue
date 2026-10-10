# Angband browser migration contract

The actual user plan was read from https://chatgpt.com/space/page_2ca2b2b56c0481919dc6359685d3bf4f on 2026-10-02. It permits the original C logic layer while converting presentation, input/application, and platform responsibilities to Rust. The Rogue pattern was inspected as a reference. Latest user scope requires HTML plus local Node and actual-browser verification; external hosting is excluded.

| Layer | Current boundary | Remaining separation |
|---|---|---|
| Gameplay/domain | Full pinned Angband C rules and data; original command dispatch and WELL RNG | Original C still combines some UI/perception work with rules |
| Application/use cases | Rust owned commands, validated events and deterministic replay journal; original C executes commands | Complete all native prompt lifecycle paths and campaign acceptance |
| Presentation | Rust owned cell frame, typed source descriptors, EN/JA grammar and semantic models; browser draws cached output | Complete every original text producer and native UI composition |
| Platform/adapters | Rust checked save/replay envelopes and byte spans; WASM worker and browser input/storage adapters | Optional sound, graphics, secondary terminals and controllers |

The retained game is the actual Angband engine, not an unrelated simplified rules implementation. Original native frontends and optional Borg remain in source; they are not compiled into this browser frontend. Source and license provenance are in PROVENANCE.md.

## Inventory and preservation

The pinned active data includes11 races,9 classes,163 player spells across30 books,163 activations,624 monsters,375 object kinds,138 fixed artifacts,107 ego items,27 curses,53 player timed effects,91 monster-spell records,500 room templates and162 vaults. The full source occurrence inventories live in inventory/. Counts of literals or authored IDs overlap internal identities, visible prose and compositional fragments and do not measure runtime coverage.

Preserved original systems include birth/stat allocation/history; town/home/shops/day-night; depth1–100 generation/FOV/memory/terrain/pathfinding; energy/speed; melee/ranged/throwing; monster AI/spells/summons/groups; knowledge/runes/flavors/inscriptions; inventory/equipment/quiver/stacks/consumables/devices; curses/artifacts; death, victory/retirement/history/scores; help/options/keymaps/repeats; and native save parsing. Representative browser flows establish specific paths, not a complete100-level campaign.

## Text and rendering contract

Semantic IDs are selected at original producers with source-selected numeric facts, identity bindings, ordered lists and bounded owned snapshots. Rust formats reviewed EN/JA templates and validates exact parameter types. It does not identify messages by matching rendered English. Parser keys and arbitrary external/user text remain opaque. Japanese semantic content reflows beside the original ASCII terminal. Generated catalogs reject missing/extra placeholders and replacement characters; counts and source hashes are recorded in the verification report.

Browser locale changes, redraw, font changes and viewport reflow draw the cached Rust frame and do not advance original simulation or RNG. Original ui-map.c and cave-map.c hallucination perception still uses original native RNG inside engine execution; separating that native perception work remains a later source migration. Do not claim that the entire original C UI is a pure renderer.

## Save and replay contract

Version3 stores a source/data/engine-bound genesis plus owned input journal. It reconstructs the original process and verifies native state, all38 RNG words, native wait, semantic cache and frame. It can preserve a nested selection prompt and an unsent Japanese draft. It does not pretend the original native save file serializes the C stack. Version1/2 legacy native-envelope compatibility and the earlier native-block byte comparisons have separate evidence. Cross-engine v3 migration is not promised.

## Acceptance and remaining work

Compile only a coherent frozen source set. Verify Rust gameplay/input/save/descriptor bounds, source-byte reconstruction, catalog/schema equality and placeholders, and original full-RNG deterministic continuation. Run actual desktop/mobile browser tests and additional store, item, spell, death and wizard-assisted endgame paths. Wizard mode disables ranked scoring; an endgame fixture must kill both original quest bosses and assert that native scoring restriction rather than bypass it.

Package HTML/WASM/data and exact corresponding GPL source with notices, then run the packaged HTML under Node. verification.json is the authoritative current evidence; dated snapshots and older integration documents preserve their historical milestones. Until all source producers and campaign paths have acceptance evidence, completeRequestedPort and completeCoverage remain false. Shared-repository Git changes are coordinated by the parent.
