# NetHack browser architecture

The source of truth is the user's generalization Page, read at sequence 675 on 2026-10-02: https://chatgpt.com/space/page_2ca2b2b56c0481919dc6359685d3bf4f . It explicitly separates logic, display, platform, and input; requires display/platform/input in Rust; replaces logic output with IDs; and puts browser play before terminal support. Existing Rogue follows a C logic plus Rust three-layer arrangement.

The user subsequently confirmed the exact boundary: 「ゲーム本体の処理は元の言語で残し、表示・入力・環境依存部分をRustで分離」. This supersedes the initial delegated Rust-gameplay wording. The official C gameplay core remains; Rust owns display, input and platform adapters. No wholesale gameplay rewrite is part of this task.

## Boundaries

1. **Gameplay/domain:** The complete, pinned official C engine owns all turns, random draws, state, role/race rules, objects, monsters, terrain, branches, quests, combat, death and ascension. Its immutable source is `upstream/NetHack-5.0.0`; builds use `work/`. Port changes stay at output/input/platform boundaries and must not simplify rules.
2. **Input/application:** Rust accepts keyboard/touch/gamepad intents and produces explicit game commands; prompts, menus and text entry are distinct contexts. A command is the only pathway allowed to advance gameplay. Application events carry semantic text IDs and typed arguments, visible glyph data, menus and input requests.
3. **Presentation:** Rust resolves English semantic IDs against JSON catalogs. Japanese is the default. Arbitrary player text is preserved as data. The browser displays snapshots and manages DOM focus; drawing, language changes, resizing and replaying a frame have no callback into gameplay or RNG. Unknown IDs are audit evidence and explicit failures of complete translation, never inferred from completed English strings.
4. **Platform:** Rust validates versioned save envelopes, source identity, checksums and size bounds. Browser IndexedDB and import/export are storage adapters. A valid container does not itself prove that the official engine can resume: that requires an actual fresh-instance restore test.

## Data direction

`PC/touch/gamepad -> input intent -> application command -> gameplay -> typed events -> presentation -> DOM`

`save command -> official engine serialization -> platform envelope -> IndexedDB/export`

State and RNG may not travel backward from presentation. Unknown object identity, enchantment, blessing/curse, monster identity under hallucination, traps or map cells must not be disclosed through text arguments or accessibility labels. Localization observes what the original engine decided to reveal.

## Full engine reference

NetHack 5.0.0's official `sys/libnh` and `win/shim` support a complete Emscripten module and all window procedures. Lua dungeon/level/quest sources and runtime Lua are required. Rendering callbacks are not an alternate game implementation. Source text instrumentation must occur before formatting so events carry IDs and typed arguments instead of trying to reverse a rendered English sentence.

## Completion gate

Full gameplay, all command/prompt contexts, browser restore, PC/mobile usability, no rendering-driven mutation, Japanese semantic text and corresponding source availability are distinct checks. Passing a Rust formatter test or starting the official C engine does not satisfy the others. A tested full-game private reference build may be published as a documented phase with its actual language limitations; an untested placeholder may not be published, and a reference phase may not be described as completed Japanese translation.
