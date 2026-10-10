# Independent fidelity review

Reviewed 2026-10-02. Scope: the staged NetHack reference build, its preserved source, Rust boundaries, and existing test evidence. This review does not certify completion of the Japanese gameplay text or exhaustive campaign parity.

## Conclusion

The implementation follows the user's resolved architecture: **official C gameplay remains the authority; Rust separates presentation, input, and platform contracts**. It does not rewrite NetHack's mechanics in Rust. All 130 upstream `src/*.c` files appear in the 170-module C/Lua/adapter build. Every upstream core file is byte-identical in the working tree except `rnd.c`, which retains the complete original content and appends a read-only RNG checksum for QA. No combat, movement, AI, generation, item, spell, quest, save, death, or victory rule implementation was replaced or simplified in the reviewed source.

That source finding supports preservation of the original rules, not proof that every browser interaction and every long campaign phase works. The final recorded Chrome run passed **17/17 steps**, including all 13 role startups, desktop and mobile gameplay, native save/fresh restore, native quit and score/log persistence, and repaint invariance. The exact tested runtime bundle remained unchanged throughout. The earlier score fixture was corrected to allow the original game's legitimate zero-score result; it now checks actual native finalization and persistent file bytes rather than assuming visible gold. The test provides a working reference-build gate with the coverage limits below.

## Exact reviewed engine

| Item | Evidence |
|---|---|
| Official source | NetHack 5.0.0, release commit `16ff59115315917b93185d026aeefea06db9b0f4` |
| Original archive | 10,793,920 bytes; SHA-256 `2959b7886aac76185b90aea0c9f80d14343f604de0ae96b3dd2a760f7ab3bde9` |
| Preserved tree | All 1,265 file sizes and hashes match `provenance.json`; no missing original files in the working tree |
| Final WASM | 6,446,012 bytes; SHA-256 `298ae4f9e6c81695cdee9c2d7c410961215092cd877a64b4bcc9c671eb0ee55d` |
| Final loader | 101,408 bytes; SHA-256 `d1c946f1cc64cb5aedb64a2a5b35b212009688d50a573101ec59ed32afa83c9a` |
| Rust static library | SHA-256 `7e7383983da11db6c60896f9d0be6a56d5ab3c9a40a93c305da63e029a93c8c0` |
| Dungeon data | All 131 original Lua files plus 17 text/generated assets in `/nhdat`; all 148 official WASM DLB reads match source sizes and checksums |

The shipped browser WASM and loader match the build manifest. The review independently reconciled all 14 entries of `build/source-changes.json` with the actual working tree and hashes. Rust and browser boundary verification hashes still match the reviewed files.

## Changes classified

| Working-tree change | Effect on original behavior |
|---|---|
| `src/rnd.c` | Adds a function that hashes the existing ISAAC RNG bytes without advancing or writing them. Original RNG implementation is intact. |
| `sys/libnh/libnhmain.c` | Renames a stale duplicate showpaths function; accepts the complete C character byte range in callback marshalling. Adds `NETHACK_TEST_SEED` only when an explicit harness environment variable is supplied. Normal play retains the original entropy path. The test hook is a deliberate conditional change to initial seeding, not a rule change. |
| `win/shim/winshim.c` | Corrects native menu identifiers to pointers, the short return type, and allocated `char*` return marshalling. These make the browser obey the original C window-port ABI. |
| `sys/libnh/jrogue-abi.c` | Adds compiled layout/accessor functions, read-only QA digests, platform UUIDs using Web Crypto, native environment setup, and a numeric-prompt result setter. The latter writes the user's count as the native input contract requires. QA accessors do not implement turns or feed hidden world state to the renderer. |
| Eight `dat/*` generated files and two generated headers | Derived by original data/build utilities. `options` is generated with the actual WASM target configuration. All original Lua dungeon and quest scripts remain unchanged. |

The target uses the original shim configuration with ASCII glyph rendering; mail integration, native terminal interfaces, optional tiles, and sound assets are outside this browser reference build. The unchanged C save/restore, bones, score and log code is compiled, but the browser persistence adapter needs the separate runtime checks below. No claim is made that omitted native interface features are supported.

## Boundaries and rendering

Rust `domain.rs` contains typed public text IDs and arguments, not a second gameplay state. `application.rs` maps keyboard/touch/gamepad intents without reading engine state. `presentation.rs` formats JSON templates without engine imports or RNG. `platform.rs` validates a versioned envelope around opaque native save bytes; it does not interpret or generate NetHack worlds. Rust unsafe code is limited to documented borrowed-buffer FFI. Existing evidence records 24 native tests, formatting and strict Clippy success; Miri was not run because it is unavailable.

The JS window adapter stores public glyph/status descriptors. Its `frame()` and `redraw()` read those descriptors, and canvas drawing, scrolling, resizing and locale changes do not invoke gameplay exports. Chrome evidence for **100 locale/repaint iterations** shows equal before/after hero scalars, raw current-instance state checksum, checked current-level digest, ISAAC RNG checksum, and input consumed/queued counts. This verifies the exercised rendering path. The current-level digest is a selected-field checksum, not a cryptographic or exhaustive serialization of every engine field.

Native save-and-quit and restore in a fresh WASM instance preserved the checked hero state, current-level digest and visible glyph map. The report explicitly records a different RNG checksum after restore; it does **not** establish continuation of an identical random stream across save/restore. The original native save/restore implementation was left unchanged.

## Evidence and remaining limits

- `build/engine-verification.json`: exact artifact hashes, ABI smoke, all 148 DLB assets, no undefined-link warnings.
- `build/browser-boundary-verification.json`: 23 focused host checks and 6 compiled Rust/C boundary checks passed, 0 failed or skipped; these are separate from gameplay.
- `tests/results/browser-latest.json`, measured `2026-10-02T15:40:45.691Z`: 17/17 passed; Chrome `154.0.8037.97`. All 13 roles reached real upstream game startup, and a 390×844 mobile viewport exercised touch menus, text, directions and inventory. Native `#quit` completed its original end-of-game prompts, persisted score/log files, and retained identical file bytes in a fresh Knight game. No browser exceptions or failed game resource requests were recorded.
- `tests/results/browser-resource-final.json`: the integration reviewer records sequential WASM pages, four visually checked screenshots and zero owned Node/Chrome processes after completion. This fidelity reviewer started no compiler or browser. Native bones generation during an actual death was not part of the 17-step suite; auxiliary-file filtering/roundtrip checks and compilation of the original bones code do not establish that death path.
- Browser UI has 147 matching English/Japanese semantic keys and Japanese is the default. **Game prose and native menus remain English.** The explicit UI notice describes this limitation.
- `locales/translation-status.json` now validates 483 paired source seed translations, but says `runtime_integration=false`, `runtime_localized_message_count=0`, and `full_japanese_coverage=false`. Those seeds are not runtime-localized gameplay events; 1,167 dynamic-format candidates and other catalog surfaces still need source-side instrumentation and review.
- No rendered-English reverse lookup is used to pretend that native text already has semantic IDs. Native text is explicitly marked `upstream.untranslated`.
- Source inventory, compilation, role startup and short interaction checks do not exhaustively test branches, special levels, quest progression, ascension, unusual item/spell interactions, all deaths, or long campaigns. Physical mobile devices and other browser engines are not covered by this Chrome viewport test.
- This review does not approve a publication or replace the final corresponding-source/license audit. A private reference publication must clearly retain the text-coverage limitation and bind its artifacts to successful final runtime evidence.

Machine-readable checks and the exact evidence hashes for this review are in [`../build/fidelity-review.json`](../build/fidelity-review.json). They are bound to the final successful browser report and unchanged engine; any later runtime change requires renewed evidence.
