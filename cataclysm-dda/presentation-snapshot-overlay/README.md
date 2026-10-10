# Native text-presentation snapshot preparation

This reversible, source-only increment observes **complete raw cells of each actual SDL text-window submission**, then publishes the ordered submissions at the original presentation commit. It targets official Cataclysm:DDA **0.I-1**, commit `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. It changes only original `src/sdltiles.cpp` and adds one header/CPP. No original header, class layout, method signature, gameplay rule, tile or asset changes.

The C++ patch is **unapplied and uncompiled**. The formatted isolated std-only Rust owned parser passed **Cargo fmt check, all five fixture tests, and Clippy with warnings denied** under the sequential reserved bounded Windows jobs. `RUST-FORMATTED-VERIFICATION.json` records the accepted source/plan hashes, UTC observations, memory and cleanup evidence. `RUST-VERIFICATION.json` and its archives preserve the earlier preformat verification unchanged. The fixtures are synthetic and the parser remains unconnected to the original producer/browser. `SOURCE-CHECKS.json` and `SOURCE-REVIEW.md` preserve earlier source-only evidence; host-copy tests use mocks. No original C++ compiler, browser, server, heavy engine build, source extraction, packing, Git or external publishing action was run for this slice. WEB delivery remains Node localhost only.

The user's actual layer plan is preserved: original C++ logic, Rust presentation/input/platform. See `../docs/ARCHITECTURE.md` and `../docs/CPP-RUST-BOUNDARY-NEXT.md`. This slice prepares immutable presentation records, not an alternate game or a toy renderer. The original engine continues to own input and all drawing until real consumers are connected and accepted.

## Exact native observation

The browser's ncurses-style interface is implemented by **cata_cursesport**, not system ncurses. `cursesport.h:40–74` stores complete `WINDOW` rows/cells, per-cell raw string/FG/BG, row `touched`, shape, origin, cursor and window state. `catacurses::window` uses shared native ownership (`cursesdef.h:54–76`); its const getter still returns a mutable pointer, so the new producer explicitly binds to `const WINDOW&` and retains no window/font pointer.

The hook is in the actual `draw_window(Font_Ptr&,window,offset)` at `sdltiles.cpp:1235`, after the original ASCII-lines option is read and before the original row loop clears damage (`1263`) or window draw state (`1347`). It receives the already selected font and glyph offset. It copies **all** raw cells and original row damage; untouched rows are observation data and are not asserted to have been drawn. Only actual calls to this original text renderer are observed.

The commit hook runs after `refresh_display` restores `display_buffer` at `sdltiles.cpp:568`. Hooking only `doupdate` would miss presentations from native SDL input/update paths. No observer export calls `draw_window`, `refresh_display`, a UI callback, gameplay, input polling or RNG. The original renderer still performs its own work, including existing RNG-consuming branches; observing those results does not certify whole-game render purity.

Cell strings are **not universally UTF-8**. `string_from_int` (`output.cpp:80–123`) and `output.h:58–68` produce ordinary borders as single bytes `0xA0..0xAA`. Native SDL intentionally treats these as ASCII-line IDs. A strict UTF-8 JSON string representation would reject normal game UI. The binary record therefore keeps exact length-prefixed raw bytes, including zero bytes, invalid UTF-8 borders, grouped combining sequences and empty CJK continuation cells. It neither substitutes replacement glyphs nor invents translations.

The producer records the native first codepoint, `UNKNOWN_UNICODE → width 1` override, native width and ASCII-line decision/ID. `UTF8_getch`, `utf8_width(...,false)` and `mk_wcwidth` were read and are text/table calculations; they use no input, clock, world or RNG. Rust validates first-codepoint and line metadata against the pinned original decoder and aliases, plus exact empty/UNKNOWN/space width invariants. It **does not independently port/validate every mk_wcwidth width-table result**. That remaining width verification is a real renderer acceptance requirement. For example, this upstream returns width **1** for U+1F408, whereas Japanese U+732B is width 2; the synthetic fixtures preserve those original decisions.

The record includes selected font role and metrics, actual 16-entry RGBA palette, cell origin/cursor, native glyph offset, original clipping dimensions and scaling factor. Native row erase origin is `window.pos × selected font metrics` (`1259`), while default glyph offset uses `window.pos × global font metrics` (`1357`). Those differ for map/overmap fonts and must not be collapsed into one coordinate. Rust exposes both relationships without pretending they are already browser Canvas coordinates.

## Honest frame boundary

The family is `cdda-native-text-submissions/1`. Every frame flag is zero, and both producer/parser report **full_canvas_complete=false**. A batch contains full window-cell observations in actual submission order since the prior observed present; it is **not** a retained screen, active-window list, semantic UI tree or screenshot. Empty batches do not mean a blank canvas. Window lifetime/deletion is not inferred from submissions, and retained native display pixels are not reconstructed here.

These original screen paths bypass or overwrite cells and remain unresolved:

| Actual source | Concrete missing output |
|---|---|
| `sdltiles.cpp:1368–1446`, `cata_tiles::draw` | Terrain sprites, geometry color blocks and directly drawn overlay strings |
| `sdltiles.cpp:1473–1476` | Tiled overmap sprites |
| `sdltiles.cpp:1480–1492` | Pixel minimap, including clear after its text-window prepass |
| `sdltiles.cpp:588` and other geometry/render-target calls | Direct clears, clipping, blend/render-target state and retained canvas effects |
| `cata_imgui.cpp:575–583`, `ui_manager.cpp:358–474` | Native ImGui draw commands, deferred/restarted UI frames and cursor behavior |
| `ncurses_def.cpp` | Separate opaque system-ncurses backend; terminal support remains deferred |

Native fonts, tiles, palettes and fallback assets remain unchanged. Their rasterization/fallback/line geometry has not been implemented in Rust. Captured cells already contain formatted native text and **no semantic IDs or parameters**. The existing source-bound 14-help/rich-keybinding adapter is a distinct semantic producer family; passing raw text frames through that adapter or the current small catalog would fabricate coverage. The complete semantic English/Japanese producer migration remains open.

## Input ownership

This slice grants **no input authority**. Rust's only `InputAuthority` variant is `NativeOnly`. The existing live-input observer remains separately versioned and supports its own kind `1`; these new exports and kind `2` notifications do not change it. Its native contexts, exact registered actions, empty local overrides, original key sequences/modifiers and text policy remain the applicable observation contract. Input and presentation publication counters are independent; a historic frame or pin cannot authorize an action or imply a current context.

`input_context::handle_input` still consumes native events and resolves actions; `input_manager::get_input_event` (`sdltiles.cpp:3926–4001`) still starts/stops text input, refreshes, polls, reads timeouts/mouse state and returns the original event. Direct SDL/ImGui waits remain untracked by the current live-input scope and can coexist with a stale parent context. Japanese IME, raw usernames, keychar/keycode capability fallback, isometric transforms, mouse coordinate targets, touch/gamepad and cancellation remain native until their exact producer/consumer contracts are connected. No browser-callable `do_turn` or raw key helper is added.

The smallest next input milestone is an observational receipt at the **actual consumed event/action return**, plus explicit unsupported notices around each bypass reader. It must identify raw event, context epoch, accepted source action, timeout/UI-only/automatic progression and completed turn separately. Replacing native event consumption requires differential input tests across these contexts before the Rust input layer can claim ownership. The existing observer parser's always-denied command policy is preserved.

## Ownership and rebuild cost

`ABI.md` specifies exact little-endian bytes and four synchronous pin/data/size/release exports. Published buffers are immutable `shared_ptr<const vector<uint8_t>>`; four independent pins preserve old bytes through later publications/failures. Handles never recycle. Shape/byte/counter/allocation failures invalidate the **whole** batch without truncating misleading UI and leave the original game running. Notification is deferred and normalizes signed WASM i32 halves with `>>>0`.

`host-copy.mjs` is source-only platform glue: it reads the current original `HEAPU8` after scalar calls, validates WASM32 address/size, immediately copies into owned bytes, and releases in `finally`. It performs no rendering, context resolution or game command. Source tests use synthetic/mock heaps; actual heap growth, Asyncify/microtask order, export linkage and fail paths remain untested.

`REBUILD-EVIDENCE.json` read all **438 existing .d records / 12,537,685 bytes**. This patch alone requires **one existing TU (`sdltiles.cpp`) + one new TU (`browser_text_snapshot.cpp`) and full relink**. No header fanout or object reuse was performed. Hypothetical original-header dependency counts are `cursesdef.h` 242, `cursesport.h` 8, `sdl_font.h` 3, `input_context.h` 227; their union is 248. These are recorded baseline counts, not the affected set for this header-free patch.

There is no original-file overlap with the live-input, help-semantic or cosmetic-purity overlays. A coordinated full isolated copy/combined manifest is still required because each prepared generator checks pristine hashes. Combined help header changes independently expand rebuild requirements. The new helper needs explicit `CDDA_TEXT_SNAPSHOT_BUILD_ID` as a nonempty ≤256-byte C++ string literal and its CPP added to the coordinated build. No active build manifest/source was edited.

Logical caps are 4 MiB per batch, 64 submitted windows, 65,536 total cells, 1,024 per axis, 4,096 raw bytes per cell and four pins. These are observer limits, not new native-game limits; exceedance makes observation unavailable. Pins can hold four historical payloads plus latest; builders, vector capacity and owned Rust metadata add memory overhead. PC/mobile latency and memory measurements are pending. The observer does not make realtime or mobile-memory claims.

To reproduce only source preparation and lightweight evidence from staging:

```powershell
node presentation-snapshot-overlay/generate-overlay.mjs
node presentation-snapshot-overlay/prepare-fixtures.mjs
node presentation-snapshot-overlay/validate.mjs
```

All writes stay in this folder. The commands do not apply patches or compile. `source-pins.json` contains 18 actual-file hashes matched to the existing audit. `SOURCE-REVIEW.md` records independent review and corrected findings. `LICENSE-UPSTREAM.txt`/`NOTICE.md` preserve original obligations. No assets are copied or published.

## Concrete next acceptance milestone

1. Coordinate a complete isolated original-source copy, apply/check the reversible patches, record combined source/build identity, compile the affected TUs plus helpers with consistent flags and relink once. Isolated host Rust formatting/tests/Clippy have passed; actual WASM/FFI acceptance needs a separately coordinated window.
2. Observe the actual main menu, Japanese help/key editor, overlapping dialogs, inventory/crafting/world screens, resize/zoom, raw text/IME, pause/resume and both tiled/ASCII overmap. Validate binary fields against native cells before/after original damage clearing, exact raw borders/combining/CJK/font/palette behavior, ordered submissions and no false complete-screen declaration.
3. Connect only the owned observer to Rust while original input and original graphics remain active. Measure current-heap copy, bounded failures, held pins/replacement, nested UI/Asyncify notification order and observer state/RNG/turn neutrality. Trace native render/input RNG separately; full purity is not inferred from a pure Rust parser.
4. Prepare source-bound native graphics/clear/ImGui/cursor output records before drawing them in Rust. Emit the **already selected** original texture/frame/geometry/state values without invoking simulation or RNG from a getter. Preserve original asset hashes/variants/rotation/visibility and fallback semantics. A Rust text-only layer may be a bounded hybrid milestone; it cannot be marked full Rust presentation.
5. Add consumed-input/command/turn receipts and bypass-reader scopes, then connect tested Rust input/platform dispatch without duplicate native/Rust consumption. Complete semantic en/ja producer coverage and native save+RNG resume across real browser PC/mobile full-game flows. HTML/Node localhost completion remains blocked until those actual tests pass.
