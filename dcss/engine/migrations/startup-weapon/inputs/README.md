This directory stages one actual native startup display conversion. It is not installed in the game workspace and has not been compiled or exercised in the full engine, Rust WASM, or a browser.

The sole converted site is official DCSS 0.34.1 `newgame.cc:1837`, `_prompt_weapon`: `startup.weapon.prompt`, empty parameters, English `You have a choice of weapons.`, Japanese `武器を選べます。`. Its original `CYAN` colour and all predicates, focus, menu identities, hotkeys, help, cancellation and weapon-selection rules are retained. Removing the private helper block and inverting this one constructor expression recovers the exact normalized original source.

Files staged for parent review:

- `engine/newgame.cc`: replacement for the work-copy source only. A private helper and import declaration avoid any new or changed public header. Only this C++ unit must be recompiled.
- `engine/library.js`: adds a synchronous caller-buffer import; existing imports are retained. This is a link change.
- `web/startup-text.mjs`: a separate Worker-local Rust WASM instance, strict artifact/catalog/source receipt verification, both-language preflight, and a pure synchronous `Text` operation wrapper.
- `web/core-worker.js`: loads and preflights the bridge before the native factory and supplies the synchronous callback.
- `web/core-debug.mjs`: sends the main harness language (Japanese default), validates it before constructing a Worker, exposes `__dcssCore.nativeLanguage`, and treats failed native text conversion as fatal.
- `source-receipts.json`: exact original and staged hashes and destination mappings.
- `base/`: byte-preserved review snapshots, never deployment inputs.
- `prepare.mjs`: verifies the snapshots and generates these staged transforms only; it does not install files.
- `tests/bridge.test.mjs`: tiny source/mock tests. Their WASM instantiator is a JavaScript mock; the real Rust binary is read for its size/hash only.

The Rust binary is pinned at 701,559 bytes, SHA-256 `b35e93f807923e5320ccb7d11d9edf84bc296d713a4cd6056c11306c31577f2c`. Startup EN/JA/source-map hashes are also pinned. A deliberate rebuild requires a reviewed pin update; hashes must not be replaced automatically just to make preflight pass. The source receipt identifies upstream commit `1eebc1a2892e1c89776a0d7a10691f8dac8d9796` and pristine `newgame.cc` SHA-256 `b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c`.

Worker boot rechecks its terminal state after both asynchronous module import and startup preflight. Deferred mock regressions verify that an invalid key or duplicate boot received during preflight prevents native-script loading/factory construction and does not resurrect the failed request.

The C++ caller owns a 512-byte buffer. The host copies only one exact reviewed EN or JA UTF-8 string into it, including its terminator, then C++ copies into an owned string. No pointer crosses between C++ and Rust memories. Rust input/output allocations are released with their exact lengths, fresh memory views handle growth, and aliases or invalid ranges are rejected rather than passed to an unsafe deallocator. Invalid descriptors may leave an unknowable output allocation unreleased; the failed instance is discarded. Accepted requests release both allocations.

The new import has no async metadata, Promise, native-export reentry, input, storage, clock, RNG, or main-thread request. SDK UTF-8 helpers use the internal current heap; no unexported `Module.HEAPU8` getter is touched. English is retained in the source receipt and non-Emscripten original path. A failed Japanese formatter is not accepted as an English fallback. The helper reports failure and calls existing `end(1)` without an error-popup string: upstream `end(1, false, message)` could open a fatal popup and require another key.

Native locale is fixed for the session. Changing the main-thread language still changes its existing catalog labels/log projection, but cannot update already constructed C++ widgets. Live native switching is pending descriptor-driven `Text::set_text` and native layout invalidation at a safe input boundary. The first prompt has no external names, nested entities, plurals or markup. The native Text/CJK width/frame route handles its glyphs. No startup observation was added, so construction cannot be confused with an accepted `mpr` message or enter the canned sequence.

Run the bounded staging checks with the installed Node executable:

```powershell
& 'C:\Users\kit\emsdk\node\24.19.0_64bit\node.exe' '.\prepare.mjs'
& 'C:\Users\kit\emsdk\node\24.19.0_64bit\node.exe' '.\tests\bridge.test.mjs'
```

Parent integration must compare current installed hashes before merging. If host files changed, rebase the small reviewed edits rather than copying stale whole files. Publish `web/startup-text.mjs` at the documented path; the local HTTP server must serve the pinned boundary and all three startup catalog/receipt paths. Node native fixtures need the same preflight bridge initialized with a local read-only fetch adapter before `createDcssEngine`, then `dcssFormatStartup: bridge.format`. They must not bypass the formatter with a literal translation.

Remaining acceptance is a real compiled Japanese weapon-choice frame, both-language control traces, all 45 PCG states/counts and native save parity, and repeated formatting/redraw purity. None of those full-runtime results are claimed by the mock probes. Other startup prose, menu item names and full game localization remain unconverted. The next small native slice is the ten fixed weapon submenu labels/descriptions at original `newgame.cc:1783–1793`.
