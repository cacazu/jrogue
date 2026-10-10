# Original-core browser page

`port/web/game.html`, `game.mjs` and `game.css` are the separate browser shell
for the preserved original Pascal/Lua game. They do not replace the existing
reference-lab `index.html`, `app.mjs` or `style.css`. The shell refuses to launch
when the original core or its required adapter, manifests or save-completion
witness are missing. Creating the page is not evidence of a playable campaign.

## Artifact contract

The page expects these same-origin distribution files:

- `drl-core.wasm`: the original Pascal/Lua core, WASI preview1 and `drl_host`.
- `drl_web_port.wasm`: the Rust presentation, native-input and virtual-filesystem
  adapter. It has a separate memory and initialized JSON request buffer.
- `core-assets.json`: schema 1, pinned DRL and Valkyrie source commits and
  immutable `files` containing `path`, `url`, `size`, `sha256` and `license`.
- `build.json`: schema version 1, `core` and `adapter` descriptors containing
  `file`, `size` and `sha256`, plus the versioned native-save identity below.
- `gameui-en.json`, `gameui-ja.json`: matching flat semantic UI catalogs copied
  from `port/locales`. Japanese is the initial locale. These catalogs also merge
  into the Rust NativeText catalogs with empty parameter contracts. Before the
  original core starts, every UI label is projected through Rust in both locales
  and checked against the bootstrap files; the page thereafter paints those
  returned presentation labels. The standalone bounded JSON is a necessary
  fallback only for errors and loading controls before the adapter can load.

```json
{
  "schema_version": 1,
  "core": {"file": "drl-core.wasm", "size": 0, "sha256": "<64 hex digits>"},
  "adapter": {"file": "drl_web_port.wasm", "size": 0, "sha256": "<64 hex digits>"},
  "identity": {
    "format": "drl-original-core",
    "source_commit": "a6f965072b3a25b768c91dbced00367f1b57d865",
    "engine_commit": "f89735a741a968997656c2d48a003ec569db7f22",
    "engine_save": "0.10.11",
    "module": "drl",
    "module_save": "0.10.11",
    "platform_abi": 1
  }
}
```

The zero sizes and placeholder hashes above describe the shape; the loader
rejects them. Production metadata must contain actual measured bytes and hashes.
The original asset packager has already produced 97 selected Lua/help/ASCII
files, 823,206 bytes. The loader validates the actual manifest, allowed licenses,
unique portable paths, the `.lua`/`.hlp`/`.asc` allowlist, source commits and
quotas. A file is mounted only after its declared size and SHA-256 match.
Acquisition is sequential and bounded. Individual immutable assets are limited
to 192 KiB so worst-case numeric-byte JSON fits the Rust 1 MiB request buffer.
The aggregate bound is 64 MiB, matching the Rust filesystem. WASM downloads
are separately bounded to 64 MiB.

A fresh Rust platform creates writable `/user` before mounting immutable `/data`
ancestors. It does not expose Windows paths or mount a host directory. Restoring
uses the host's validated fresh candidate; the page selects it only after the
immutable mounts and every saved native file replay have succeeded.

The IndexedDB identity is `drl-original-core:v1:` followed by the SHA-256 of a
canonical, fixed-field-order JSON encoding of the identity object. Presentation
rebuild hashes remain verified separately; native-save compatibility depends on
the original source/module save versions and platform ABI.

## Rendering and input boundaries

The original VTIG console emits all ordered draw commands followed by one DRLF
for that frame. The page accumulates only those commands, sends the complete
batch to Rust, clears it immediately and paints the returned primitives. Multiple
frames before a host sleep cannot accumulate previous overlays. Base CP437 cells,
UTF-8 grapheme columns, palettes, clips, borders and transparent-color behavior
are decoded/projected by Rust. JavaScript draws rectangles and text at those
coordinates; it does not infer CJK widths or run game hooks.

Text-size changes replay the latest immutable Rust projection. Native diagnostic
capture is separate and read-only; neither operation requests an RNG sample.
The 80 by 25 display uses system Japanese-capable fonts. Mobile defaults to a
readable font with horizontal scrolling. Fit-width is an explicit option, and
font-size controls, DOM touch controls and a textual screen transcript remain
available. No bundled proprietary font or graphics/audio are required.

DOM physical input is sent through `{kind:"native_input",event}`. Rust returns
`{input:{packets,captured,trigger_down?}}`. The queue accepts only copied version 1
128-byte packets and preserves peek semantics. Pointer coordinates are zero
based on the displayed canvas; Rust converts them to the original one-based
console convention. Physical keyboard codes, NumLock/location/modifiers, custom
bindings and original controller rules remain authoritative in Rust/Pascal.
Touch buttons send keyboard DTOs for the original standard keys. A selected
standard browser gamepad routes axes/buttons/triggers through Rust; original
trigger hysteresis and core deadzones remain unchanged. Hidden/blurred browser
input releases held physical controls rather than leaving them stuck.

The original core explicitly enables text input. Committed DOM text has one
route, separate from physical command keys: ASCII, paste and IME commits become
Rust text requests. Interim composition events are ignored; a final composition
input event cannot duplicate a previously delivered composition commit.
Oversized or rejected text is not silently truncated or partially enqueued.
The original browser console patch suppresses `KEYDOWN.ASCII` text append so a
physical key and its text event do not append a character twice. Actual browser
IME behavior still requires the runtime check below.

## Continuations, locale and native storage

The page requires standard `WebAssembly.Suspending` and `WebAssembly.promising`
before starting the original loop. The injected host sleep suspends the real
Pascal/Lua call stack and marks a paused seam. No blocking browser wait,
SharedArrayBuffer, experimental flag or JavaScript gameplay coroutine is used.

The save button opens the original Esc menu. The user selects the original
Save & Quit action. The page does not call destructive `WriteSaveFile` as a
fingerprint or invent a serializer for live gameplay state. `drl_save_generation`
is required at startup; the original core increments it only after the native
save operation has completed. At the next paused seam, the page captures the
closed native files and waits for the IndexedDB transaction to commit. The
host verifies each file hash and the versioned identity on restore. A failed
storage attempt is shown explicitly, with a retry button, and does not trigger
unbounded automatic retry work on every sleep. Exiting the core also captures
completed native files. The separate `drl_user_files_generation` export advances
after completed native user-file changes, including save consumption and
profile/settings commits. The next paused seam persists those changes without
mistaking a consumed save or progress-file update for a newly saved live game.
Thus the page can preserve original one-use saves; actual loader/browser proof
remains required.

Locale changes select the Rust semantic resolver for future original UI calls.
Already-projected raw UTF-8 commands are replayed unchanged. The page does not
claim it can translate cached bytes without their semantic ID/parameters.

Read-only `globalThis.drlGame` test hooks expose paused/running state, the latest
Rust projection, committed storage metadata and strict DRLP diagnostic capture.
The probe can only run during a paused seam. The explicit `input()` test hook
uses the same Rust normalization path as real browser input.

## Verification and runtime gate

Executed during the shared memory hold:

```powershell
node --check port/web/game.mjs
node --test port/tests/game-web.test.mjs
```

All 10 lightweight Node contract tests passed. They cover the actual pinned asset
manifest, build/source/save identity, corrupted/truncated/oversized downloads,
atomic packet queues, ordered frame batches, physical DTOs and canvas coordinates,
strict Rust NativeText UI-label projection, single-path ASCII/IME text,
Rust-supplied CJK primitive columns, DRLP byte copying,
and both catalogs' coverage of every HTML semantic label. These are transport
contracts, not original-game browser proof.

No compiler/linker, browser or server was launched under the parent's resource
hold. Required runtime proof remains: actual original-core startup and menus;
PC keyboard/mouse and standard gamepad; 390 px touch layout and enlarged fonts;
ASCII/IME player-name entry without duplication; repeated projection replay and
locale calls with exact original RNG unchanged; original Save & Quit, committed
IndexedDB storage and fresh-instance original loader; consumed-save deletion;
and the complete native game flows. Final distribution must include working
license/attribution and corresponding-source links. This shell is not published
and supplies no Site URL by itself.
