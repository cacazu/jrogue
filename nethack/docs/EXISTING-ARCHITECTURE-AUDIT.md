# NetHack architecture audit

Read-only investigation completed on 2026-10-02. The target repository is `C:\Users\kit\gameme\jnethack\jrouge`; its physical folder spelling is `jrouge`, while its remote repository is named `jrogue`. No source, build, Git index, or project settings outside this report were changed by this audit.

## Authoritative generalization plan

The user’s Page, [ローグライク一般化計画](https://chatgpt.com/space/page_2ca2b2b56c0481919dc6359685d3bf4f), was read successfully through the Pages connector. The returned snapshot was sequence 675, last updated 2026-10-02T08:48:46.486144Z. Its complete relevant instructions are:

- Localize foreign roguelikes into Japanese and make them playable in a browser, including a smartphone input interface.
- Prioritize the browser; terminal support is deferred.
- Use `C:\Users\kit\gameme\jnethack\jrouge` as the working folder.
- Separate logic, display, platform, and input layers.
- Replace text output within the logic layer with IDs and render translated text from JSON entries associated with those IDs.
- Replace display, platform, and input layers with Rust.
- Build keyboard/mouse interfaces first, then smartphone and gamepad interfaces.
- Check each game’s license to confirm modification and publication are allowed.

The Page does **not** require the logic layer to be rewritten in Rust. The user subsequently resolved the initial delegated ambiguity explicitly: 「ゲーム本体の処理は元の言語で残し、表示・入力・環境依存部分をRustで分離」. A faithful official C engine with Rust display/input/platform is the confirmed target. No full Rust-domain rewrite is planned or required.

## Existing Rogue implementation

Sources inspected: `rogue-nihon/README.md`, `docs/IMPLEMENTATION-ja.md`, `docs/SEMANTIC-SCHEMA-ja.md`, `docs/PROVENANCE-ja.md`, `docs/RUST-LAYERS-TEST-ja.md`, `tests/BASELINE-ja.md`, `tests/RESULTS-ja.md`, `web/README.md`, `contract/rogue_abi.h`, `rust/Cargo.toml`, and `build.ps1`.

| Layer | Existing implementation | Responsibility |
| --- | --- | --- |
| Logic | Original RRP Rogue 5.4.4 C plus isolated adapters | Rules, turns, combat, items, RNG, knowledge state, semantic observation, logical checkpoint |
| Display | Rust `display.rs`, `entities.rs`, `presentation.rs` | Translation, visible item/entity descriptions, grammar, localized screens and message history |
| Input | Rust `input.rs` and host callbacks | Browser event to original game keys, explicit text editor mode and UTF-8 |
| Platform | Rust `platform.rs` and save callbacks | Save version/source/ABI/checksum validation, checkpoint plus consumed-input replay |
| Browser adapters | `web/` JavaScript | DOM and Canvas, Worker/SAB, IndexedDB, browser server |

The C game stack runs synchronously inside a Worker. Only input waits use `Atomics.wait`; Asyncify is not used. A new game or restore creates a new Worker/Wasm instance. Raw browser events enter a shared ring queue, then Rust maps them to game commands. Unicode is accepted only during an explicitly declared text-entry mode; normal commands remain the original ASCII keys.

Presentation receives immutable frame/semantic data. Redraw and resize use the last recorded frame and never send game input. Original ASCII English cells remain separately available for regression observation. Map glyphs use Canvas; Japanese messages, status, names, lists, help, settings, and endings use UTF-8 DOM. Text wrapping and screen width do not change More boundaries, turns, or RNG.

The authoritative ABI is a single header, `contract/rogue_abi.h`, from which Rust and JavaScript constants are generated. It uses fixed-width integers, byte lengths, borrowed buffers with explicit lifetimes, and paired ownership/free operations. C `WINDOW`, `THING`, `FILE`, unions, and callback pointers do not cross the boundary. Diagnostic snapshot/repaint exports must not advance a turn.

## Text and knowledge rules to preserve

Rogue captures semantic IDs and typed arguments at the original output call site, including the entity appearance/name and random combat verb already selected by the game. Rust does not parse completed English text to infer hidden game meaning and does not rerun RNG during translation.

Descriptors expose only game-visible knowledge: unknown item effects have no effect index; hidden curses and unknown enchantments are absent; hallucinated and invisible monster names expose the game-selected public description. User names, fruit, and labels remain arbitrary UTF-8 data, including percent characters. Copied descriptors cannot outlive or be confused by the C static buffer that originally supplied them.

Six paired EN/JA catalog families cover game messages, game UI, entities and grammar, runtime, endings, and browser UI. Existing documented counts are 277 game IDs, 137 game UI IDs, 408 entity IDs plus 35 grammar entries, 41 runtime IDs, 27 ending IDs, and 83 browser UI IDs. Two shared IDs are cross-checked, so these numbers should not simply be added as a unique total. Stable IDs survive regeneration. Missing IDs and fallback use are explicit diagnostics, not silently counted as successful Japanese coverage.

For NetHack, the same principles must extend to menus, yes/no questions, extended commands, inventory descriptors, player selection, status, messages, death/disclosure, quest and oracle text, help/data files, wishes and naming, and hidden-state safety. Directly copying the existing catalog cannot provide NetHack coverage.

## Save and replay pattern

The existing C logical container has separate game, knowledge, and runtime/wait-state sections. Rust save envelope v2 adds source hash, ABI, bounds, checksum, UTF-8 input, and semantic presentation history. Only commands actually consumed by the core enter the replay journal.

Save occurs at an outer command checkpoint plus the subsequently consumed input journal. A fresh module reconstructs pending item selection, More, accelerated multi-action waits, and unfinished text editing. Saving an unfinished text field updates its draft without sending Enter. The IndexedDB adapter reports success only after the write transaction completes. Restore validation precedes any game input or mutation. Old terminal raw saves are not implicitly compatible.

The browser host also supports download of the same save envelope. Storage is scoped to browser origin; production URL/origin changes affect availability of existing local saves.

## Build and integration pattern

`rogue-nihon/build.ps1` uses an existing local SDK rather than running upstream configure/install scripts:

1. Run `generate-abi.ps1` and the Python catalog generator.
2. Run `cargo build --offline --manifest-path rust/Cargo.toml --release --lib --target wasm32-unknown-emscripten`.
3. Compile an explicit list of 38 C units together with `librogue_layers.a` and the Emscripten JavaScript import library.
4. Record output sizes and SHA-256 in a build manifest.

Existing toolchain records are Rust 1.98.1, Emscripten 6.0.8, Node 24.19.0. `SdkRoot` defaults to `C:\Users\kit\emsdk`; Python is `python\3.13.3_64bit\python.exe`. Cargo dependencies are fixed in `Cargo.lock`; `Cargo.toml` uses exactly pinned serde 1.0.229 and serde_json 1.0.151. The library emits staticlib/rlib and disables FFI library tests; pure modules are compiled into standalone test bins.

Relevant linker flags are `-std=gnu11`, `-fwrapv`, `-fno-strict-aliasing`, `-O1`, `--no-entry`, `-sMODULARIZE=1`, `-sENVIRONMENT=web,worker,node`, `-sALLOW_MEMORY_GROWTH=1`, `-sSTACK_SIZE=4194304`, and `-sASSERTIONS=1`. JavaScript runtime exports include `ccall`, `FS`, and `UTF8ToString`. `EM_CONFIG` and `EM_CACHE` are scoped to the process and restored afterwards; no global PATH/security setting changes are required.

A Worker/SAB integration requires HTTP response headers `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Hosting must be verified with those headers and a real browser. If the publication provider cannot supply them, an explicit alternative asynchronous integration is necessary; disabling browser isolation is not an acceptable workaround.

## Existing verification patterns

These are reviewed records from Rogue, not tests rerun by this audit and not evidence for NetHack:

- A separately prepared baseline preserves original C rules. Its 21/33 original C units are byte-identical; 34 source checks audit the integration changes. Product differences are separately hashed and recorded.
- Same-seed/input comparisons include all 20 observed state words, persistent input position, every raw English frame, and final outcome. The baseline shares adapters and thus does not prove those common adapters independently correct.
- 36 compiled-game tests passed: seven normal cases, 17 fixtures, five localized UI cases, six combat/end/consumable cases, and one actual More save/restore case. No failure or skip was reported.
- Redelivering the same presentation frame 100 times preserved core state and input-read count.
- Pure Rust layer checks passed 109 items, entity checks passed 694 items, and four native bin unit tests passed. They do not verify C gameplay or browser persistence.
- Real Chrome testing passed 19 scenarios; host/catalog tests passed ten cases. The recorded scenario had no browser exception and zero translation fallback/missing IDs along executed paths.
- Additional UTF-8 editor, semantic descriptor, corrupted-save, queue rollover, IME, and IndexedDB tests target actual boundary risks.
- Verification records bind artifacts to source/catalog SHA-256 before and after execution. Old evidence is rejected if its source has changed. Distinct kinds of counts are not combined into an inflated compatibility claim.

Important scope differences: old Rogue explicitly excludes smartphone-specific controls, gamepad, public hosting, terminal support, and persistent ranking. NetHack’s current request includes PC/mobile browser play and publication, so those cannot be claimed from old Rogue evidence. Fixture scenarios are not proof of every naturally generated path or all combinations.

## Adjacent old NetHack work

`C:\Users\kit\gameme\jnethack\jnethack` contains `source`, `dist`, `build.cmd`, and `build.log`. The source has a `.git` configuration whose origin is `https://github.com/jnethack/jnethack-alpha.git` and fetch mapping names `v5.0.0-0.2`. Its distribution includes `JNetHack-5.0.0-0.2-win-x64-gui-fix` and a ZIP of that name.

Its `README.md` identifies JNetHack as a Japanese localization and says current support is Windows/TTY, untranslated portions and warnings remain, source is UTF-8, and Windows runtime remains Shift-JIS. This is a Japanese fork, not the official English upstream and not the requested browser product.

Its local `source/AGENTS.md` explicitly describes a Japanese-only game with no English/language toggle. It requires C changes/additions/deletions to retain English originals in `/*JP*/` conditional/comment wrappers and gives `cd src; nmake package` as the build process. These instructions govern that adjacent fork; they are not inherited by a new sibling `jrouge/nethack` official-upstream worktree.

`C:\Users\kit\gameme\jnethack\NetHack-5.0.0` contains a separate plain source tree with standard NetHack directories (`src`, `include`, `dat`, `sys`, `win`, etc.). It is useful as read-only historical reference; its local name alone does not establish the source URL, release status, exact commit, archive hash, or target provenance. The new target must pin and preserve official source independently.

No changes were made in either adjacent tree. No old executable, installer, or package script was executed. No old fork text/assets were copied, and no old fork was selected as the official target.

## Instructions and metadata checks

No `AGENTS.md` was found in `C:\`, `C:\Users`, `C:\Users\kit`, `gameme`, `gameme\jnethack`, or `gameme\jnethack\jrouge`, nor under the inspected `jrouge` projects. The user-wide `C:\Users\kit\.codex\AGENTS.md` and narrowly inspected project metadata locations returned no instruction content. Credential files, unrelated session histories, and memory databases were not dumped. The authoritative connected Page and existing project documents provide the relevant plan.

## Integration conclusions

Preserve full official gameplay before claiming completion. The Page supports reuse of upstream C logic with Rust display/input/platform; keep the distinction explicit if a later Rust logic migration is requested. Make the new ABI and typed text descriptor design NetHack-specific rather than relying on raw terminal-text replacement. Verify localization/repaint invariance, knowledge visibility, all command families, save at every input-context class, PC/mobile interactions, and actual production isolation headers. Preserve official source, copyright/license notices, source availability obligations, and catalog/artifact provenance. A download or untranslated engine running in a terminal canvas is an intermediate phase, not a Japanese browser completion.
