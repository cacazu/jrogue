# DCSS migration boundaries — V2

The user's [plan](https://chatgpt.com/space/page_2ca2b2b56c0481919dc6359685d3bf4f), read earlier in this session, names logic, display, platform and input. The confirmed mapping keeps original game processing in C++ and separates display/input/environment through Rust. Complete DCSS 0.34.1 at `1eebc1a2892e1c89776a0d7a10691f8dac8d9796` owns original rules and state.

| Layer | Actual files | Responsibility |
|---|---|---|
| Logic/domain | pristine `upstream/crawl-ref/source`, `engine/work-wasm-eh`, `port/src/logic` | Complete original rules/state/45 PCG streams; isolated Rust differential functions and invariants. |
| Input/application | `port/src/input.rs`, `application.rs`, `semantic.rs` | Original keys, commands/use cases, strict typed observations and session-qualified events. |
| Display/presentation | `port/src/display.rs`, `dynamic_text.rs`, `dynamic_text_requests.rs`, locales | Source-selected semantic IDs, parameters, EN/JA, rich text/CJK and exact external names. |
| Platform/adapters | `port/src/platform.rs`, `wasm.rs`, web | Worker RPC, browser input/Canvas/IndexedDB, versioned native-file envelopes and ABI. |

Pristine source is distinct from work copies. Full console graph retains Lua, SQLite, zlib, generated parsers/vault metadata and all 143 vaults. Browser adapters do not implement replacement gameplay.

## Worker and display purity

The classic Worker runs native WebAssembly exceptions/JSPI. The main thread owns Rust validation, Canvas and IndexedDB; gameplay exports run in the Worker at safe suspension points. callMain's lifetime promise is observed while input continues. Yielding save has a separate resolver; competing exports wait and terminal/failure settles pending requests.

ConsoleFrame validates Unicode cells/colors, combining sequences and cursor; zero denotes a CJK continuation cell. Canvas paints backgrounds before glyphs. External names are not normalized or translated. Rendering cannot access RNG or issue gameplay commands. Native locale is fixed at boot; copied Rust descriptors can redraw by locale. V2 does not make every native widget a descriptor for live switching.

At 390px desktop emulation the outer Japanese controls wrap cleanly. The original fixed-column terminal pans horizontally/vertically, its HUD starts to the right of the default map viewport, and page scrolling reaches the controls. This is not physical-mobile or IME verification.

## Source-selected text

45 native display IDs comprise 11 fixed startup controls, 12 startup variants and 22 HUD labels, with 36 source-site IDs/32 expression spans. Five descriptions are assigned but invisible. Native whitelist schemas are 34 parameter-free/11 parameterized; the catalog's 456 IDs are 409 parameter-free/47 parameterized. Catalog closure is not whole-game coverage.

`newgame.cc` and `output.cc` privately declare:

    int dcss_host_startup_text(const char* id, const char* params,
                               char* dest, int capacity);

The link-only synchronous formatter has reviewed source/catalog/ABI pins, finite typed schemas and UTF-8/capacity checks. Colors, width, hotkeys, choice order and original control behavior remain canonical. No public-header or compiler-flag changes, English-to-ID lookup or global replacement occurs. Actor/species/weapon/quiver/place/welcome and endings remain English. Player names remain opaque exact data.

## Canonical messages and save ordering

Canned observations carry source IDs/parameters plus original turn/channel/parameter/color and join/nojoin/more/flash/shout controls. C++ keeps canonical English for Lua, filters, joining, control and serialization. Rust renders copied descriptors without repeating those controls.

V2 keeps the unchanged native sequence within a host session; both are canonical positive u64 strings. Fresh Workers start a new session because native sequence restarts. Events are validated against pinned source registry and catalogs. Retention defaults to 200 events, maximum 1,000, checkpoint cap 256KiB. This bounded projection is not complete replay history.

The version-2 envelope keeps semantic history beside opaque original files; V1 imports have empty semantic history. It does not identify native message-buffer rows, relocalize Ctrl-P or replay callbacks. Native saves persist Lua, current level, then player `save_game(false)` before collection. Exclude only regenerable db/des caches. Rust validates format/version/ABI/upstream/kind/checksum/path/count/size before restore; the original loader owns save-tag compatibility. 45 states/increments persist; diagnostic draw counters reset on restore.

FIFO reserves order at save-request arrival, holds later input, and captures semantic projection synchronously at the completed matching Worker save response. Save-generated events are included and later input events excluded. Success, rejection, terminal and abort settle reservations; IndexedDB success waits for transaction completion. Actual branch resume preserves `(1,1)`, resets the new session's baseline to 0 and accepts `(2,1)` `game.canned.no_spells` without replay.

## Evidence and remaining work

Actual V2 gates passed Rust 63, formatter 470, complete native link, six Node runs/36 assertions, 17 locale comparisons and ten fresh Chrome cases/62 labels. Authored 129 and independent seven are mocks; integrated 13 re-runs an existing subset. Comparisons cover recorded exported snapshots and ordered PCG witnesses, not every native save field.

The actual installed postinstall-smoke-a core run passed all23 original labels with ordinary Chrome compilation/tier-up, separate from the pre-promotion ten-case/62-label matrix. Owned SDK Node18276 exited0; raw evidence SHA87e9c7852a6de998755355bb25aadd9a860e79e7bee309dd183fbb0516675aea and seal SHA c159ce25c6c633e55e70d7107ba5d894c6a9884eae81aee2ebfd40c16da6a50b pin this result. It verifies45 PCG streams, logical resume and the next wait, excluding only diagnostic count/draws. One expected async status0 console notice is retained; runtimeErrors is absent, so no global zero-console claim is made. The original harness partial-canned scope wording is retained; actual V2 scope is45 native display IDs with broad English text remaining.

Local HTML/Node/Chrome is the current scope. Retain modified corresponding source, actual recipes and licenses. Controlled WIZARD endings are genuine native flows with English remaining; no full Japanese, physical mobile, IME or unassisted campaign claim is made.


The parent also visually inspected fresh installed desktop and390x844 screenshots: Japanese HUD captions and wrapper controls are readable; original English actor/title/species/weapon/quiver/place/welcome remains. The mobile wrapper wraps cleanly, map is visible, native terminal pans horizontally/vertically, HUD is offscreen to the right, and lower controls are below the fold. This is desktop emulation, not physical-mobile or native IME evidence.
