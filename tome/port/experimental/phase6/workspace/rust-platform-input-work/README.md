# Original physical input candidate

This is an isolated, source-ready increment. It is not integrated into the tested default browser page. The actual original C/Lua engine owns gameplay, KeyBind, actors, dialogs, userdata, saves and RNG. Rust owns typed physical input translation and its byte mailbox. The browser host collects DOM events and submits the resulting packets to the actual SDL backend. Full Rust map/dialog rendering is a separate milestone; an original visual frame remains explicitly effectful.

No build, test, browser, server or game execution was launched by this agent. The crate includes **16 unrun tests**: 14 mapper tests and two mailbox tests. Parent-generated main source and its hash are recorded separately in `generated/main_physical_state.provenance.json`.

## Files and ownership

- `rust/`: standalone `tome_physical_input` Rust cdylib/rlib; no dependency on a gameplay crate or native original module.
- `browser/physical-input-wasm.mjs`: actual importless WASM byte-word mailbox.
- `browser/original-physical-input.mjs`: copied borrowed native response buffers; single-flight original dispatch and bounded settling.
- `browser/focused-input-host.mjs`: canvas-owned physical events and an optional explicit textarea for committed IME text.
- `native/physical_input.c`: original SDL backend event injection, exact original dispatch, platform scheduling and readonly state getters.
- `native/sdl_private_input_2_32_10.h`: version-pinned private SDL declarations; no copied backend implementation.
- `generate_original_dispatch.py`: exact source extraction into this directory only. It never builds or executes original code.
- `i18n/en.json`, `i18n/ja.json`: 31 matching semantic IDs for error/display integration, Japanese default. Technical SDL identifiers are preserved.

## Original source contracts

Pinned ToME/T-Engine commit: `624a67329fe2ad440c5b344785a9c73fcf22ae63`, source version 1.7.6. Original `src/main.c` SHA256: `8359b9c86572d3b5ad5c5e6db632f3225e3a1154b2d1e30d3aae0503b581e79b`.

The original dispatcher is `on_event`, not `handle_event`:

- `main.c:319–350`: `SDL_TEXTINPUT` forwards the complete native event text and actual global `SDL_GetModState()` into current KeyBind.
- `main.c:353–403`: keydown/up forwards SDL scancode, native keycode and original modifier semantics. It reads global SDL modifier state, not just the event's `keysym.mod`.
- `main.c:406–496`: mouse coordinates use original `screen_zoom`; wheel reads actual global `SDL_GetMouseState()`.
- `main.c:621–635`: `on_tick` invokes the actual current Game tick and records its paused result.
- `main.c:1195`: desktop `boot_lua` clears the original boot marker. This candidate prepares that marker only during restricted native initialization, before any Game exists.
- `main.c:1559`: original startup activates text input.
- `main.c:1598–1710`: complete original SDL system-event switch is retained verbatim, including resize, focus, quit, audio, timer, redraw and default input.
- `engine/Game.lua:420–425`: original dialog registration appends to `dialogs`, then makes original dialog key/mouse handlers current.
- `engine/ui/Dialog.lua:736–756`: `focus_ui` stores the wrapper; actual focused component is `focus_ui.ui`.
- `engine/KeyBind.lua:216,252–255`: original `use_unicode` controls text delivery. Getter-only focus checks return unknown rather than guessing.

Original default inventory (`i`), equipment (`Shift+e`), talents (`m`), quests (`j`/`Ctrl+q`), acceptance and escape keys remain ordinary physical key packets. Their gameplay/UI handlers are never reimplemented. Actual menu reachability is pending parent browser verification.

SDK dependency: Emscripten 6.0.8, official SDL release 2.32.10. The candidate is deliberately pinned to this private ABI. `SDL_SendKeyboardKeyAndKeycode`, `SDL_SendKeyboardText`, `SDL_SendMouseMotion`, `SDL_SendMouseButton`, `SDL_SendMouseWheel` update **SDL's actual backend state** before polling original events. Plain `SDL_PushEvent` cannot provide that equivalence. Packet modifier state is reconciled after SDL's key primitive to avoid double lock-key toggles. Native text keeps SDL's original UTF-8-safe chunking. Wheel scaling matches the pinned Emscripten backend.

## Parent integration, separate variant only

Run the source transform again after all source changes:

```powershell
python rust-platform-input-work/generate_original_dispatch.py --original C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6\src\main.c --retained kernel-bindings-work/generated/main_platform_state.c --output rust-platform-input-work/generated/main_physical_state.c
```

The generator checks exact original SHA and requires the retained bytes to begin with the entire pristine original. It records switch SHA, full generated SHA and changed slots. The complete switch-body bytes remain identical. The complete generated main body intentionally differs at the extraction call, declaration and helper appendix. Current tested source is never overwritten.

In a separate native build profile replace only the existing generated main object with `generated/main_physical_state.c`; add `native/physical_input.c`. Keep original native sources, `retained_platform_drain`, checkpoint gate, existing original initialization and VFS. Add this native directory to include paths; retain existing Lua/original/SDL include paths. Link actual pinned SDK SDL, not a substitute. Preserve original/GPL and SDK/zlib license notices in the resulting distribution.

Native exports required by the browser are:

```text
tome_physical_prepare() -> borrowed JSON char*
tome_physical_claim(canvasSelector) -> borrowed JSON char*
tome_physical_status() -> borrowed JSON char*
tome_physical_backend_state() -> borrowed JSON char*
tome_physical_busy() -> int
tome_physical_begin(sequence) -> borrowed JSON char*
tome_physical_key(sequence,down,scancode,keycode,modifiers) -> borrowed JSON char*
tome_physical_text(sequence,UTF8,modifiers) -> borrowed JSON char*
tome_physical_motion(sequence,relative,x,y,modifiers) -> borrowed JSON char*
tome_physical_button(sequence,down,button,x,y,modifiers) -> borrowed JSON char*
tome_physical_wheel(sequence,x,y,mouse_x,mouse_y,modifiers) -> borrowed JSON char*
tome_physical_end(sequence) -> borrowed JSON char*
tome_physical_pump(sequence,budget) -> borrowed JSON char*
```

The C `EMSCRIPTEN_KEEPALIVE` attributes expose these names; preserve the build's existing `ccall` runtime export. Every JSON response is copied/parses immediately. Native response memory belongs to C and is reused; never retain or free pointers.

Parent's next sequential validation/build commands, not executed here:

```powershell
cargo test --offline --manifest-path rust-platform-input-work/rust/Cargo.toml
cargo clippy --offline --manifest-path rust-platform-input-work/rust/Cargo.toml --all-targets -- -D warnings
cargo build --offline --release --target wasm32-unknown-unknown --manifest-path rust-platform-input-work/rust/Cargo.toml
```

Serve the actual resulting `tome_physical_input.wasm` and three browser `.mjs` files with WASM/module MIME types. The mailbox exports are `tome_physical_input_reset`, `word`, `request`, `output_len`, `output_word`; values are little-endian byte words, with 64 KiB input/128 KiB output limits. No raw pointer exchange, unsafe body or native gameplay imports exist. `reset` is fresh construction only; a live host must first drain Blur releases.

Browser setup order:

1. Create actual Rust mapper and actual original native module; mount original VFS and initialize existing checkpoint store before native initialization.
2. Call the genuine `tome_native_init` once. Construct `OriginalPhysicalInput` around that exact module; call `prepare()` before original startup. It accepts only fresh initialized original `te4core` metadata with id `-1`, no current Game and no reboot fields, then performs original `boot_lua`'s marker reset. Do not use this on an already started VM.
3. Register the actual semantic resolver/locale hooks at their verified lifecycle stage. Start the original game once through existing `OriginalNativeCore` lifecycle.
4. Construct `FocusedInputHost` using the actual canvas and optional explicit textarea; `start()` transfers only pinned SDK input callbacks. Disable the variant's old virtual-key listener. Keep original window focus/blur/resize/fullscreen/visibility/pointer-lock lifecycle callbacks.
5. `onSettled` may draw one explicitly effectful original baseline frame, then refresh the actual snapshot/Rust view. Pure locale repaint must not call this input transport, native draw, callbacks or ticks.
6. Serialize **all** native actions: physical input, existing virtual/UI commands, frames and full saves. Existing checkpoint gate rejects physical input while saving; the older gate does not itself know this new candidate's busy flag. Before full saving, await `host.suspendAndDrain()`, then use the existing stronger full-save settle/pump/controller. Resume input only after the checkpoint gate has released. Await host disposal/release before constructing another input owner.

## Ordering and bounds

Each browser batch is an ordered queue of at most 512 packets/1 MiB. Native input is drained before the next packet so per-event global modifier/mouse state remains correct. Earlier original system events are handled first. Original tick-end queues are inspected with raw readonly table access; pending work runs through existing original `on_tick` scheduling. No direct actor, queue, energy, pause or RNG mutation is introduced.

Native slices drain at most 128 SDL events and pump at most 32 original ticks per call (browser requests 16). A transaction is capped at 8,192 events/10,000 direct ticks and tracks the exact original Lua VM/Game identity. The browser yields between bounded pumps. Exit, reboot, state changes and exceeded limits fail closed; executed original actions are never replayed or rolled back. Completion requires original paused state, zero original tick-end work and an empty drained queue. Original redraw/system handlers remain effectful and are not described as pure views.

The native `backendState()` getter reports actual SDL modifier state, pressed scancodes, mouse coordinates/buttons and text-input activation. Parent should use it for equivalence comparisons; Rust's held-key bookkeeping is not evidence of native state. Native status exposes actual dialog count and readonly focused Unicode state for menu proof/screenshots.

## Remaining verification and limitations

Parent must compile/link the actual private SDL symbols and test actual inventory, talents, quests, settings/escape, mouse callbacks, held modifiers/repeat/releases, DPI/resize, real IME commit/cancel, original tick settling and checkpoint exclusion. Compare SDL backend state against the original SDK path; button/wheel packets explicitly update physical position first, and that extra original motion callback must be reviewed in the comparison.

Only focused canvas or its owned text proxy handles disruptive application keys. External editables and browser/OS shortcuts remain available. Committed text is unchanged; preedit stays in the browser because the original C dispatcher lacks an `SDL_TEXTEDITING` branch. Commit/input duplicate handling must be verified in actual browsers/IME; nested text focus can remain unknown. Original Textbox stores incoming UTF-8 chunks with existing cursor semantics, so complete Japanese cursor/editing behavior is not established by mapper tests. Touch/pen/controller equivalents and full prepared Rust rendering remain separate increments. Original menu-triggered MEMFS saves are not automatically a durable browser checkpoint.

No claim of full port, complete menu coverage, rendering purity or tested browser integration is made by this source handoff.
