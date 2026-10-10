# Official DCSS browser core bridge

The upstream C++ gameplay engine, full Lua interpreter, SQLite descriptions, zlib save compressor and complete official vault data are compiled together. The terminal bridge replaces native curses I/O. Pristine upstream files remain unchanged; build copies and explicit semantic-source observers are separate. See [BUILD.md](BUILD.md) and [ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Runtime selection and lifetime

The classic Worker retains fixed runtime paths: `asyncify` loads `engine/build`, and `jspi` loads `engine/build-jspi`. The installed browser host selects JSPI and rejects an explicit Asyncify request before Worker creation; the retained Asyncify Worker protocol is used for historical diagnostic fixtures. JSPI uses native WebAssembly exceptions and requires `WebAssembly.Suspending` and `WebAssembly.promising`; unsupported hosts receive `jspi-unsupported`. Main-thread code does not instantiate the complete module or invoke its C++ exports.

Await `createDcssEngine(options)` once and create `/persist` before calling `module.callMain(arguments)` once. In JSPI, that call returns the game's lifetime Promise. Observe its completion/rejection without awaiting it before serving game input. Expected status-zero termination completes the session; an unexpected abort/error fails it. Either path settles queued requests and rejects later helper calls. Do not restart main or invoke exports after completion.

The original CLI supports `-name`, `-seed`, `-species` and `-background`; there is no `-weapon` CLI flag. Weapon selection uses the genuine original menu or verified init-file options. Official data loads at `/data` and user/native persistence at `/persist`.

## Host callbacks

| Callback | Contract |
|---|---|
| `dcssFrame(cells, columns, rows, cursorX, cursorY, cursorEnabled, clusters)` | Copied `Uint32Array` with three words per cell: scalar, foreground, background. Zero-based cursor; current terminal 80×30. Foreground low byte is base colour; remaining bits may hold original highlight flags. Optional copied `{cell, text}` entries carry exact base-plus-combining UTF-8 sequences. |
| `dcssReadKey(wakeUp)` | Resolve one suspended original input with one official integer key. The SDK's Asyncify/JSPI import handles suspension; the callback does not call rules or RNG. |
| `dcssHasKey()` | Reports whether an already queued key exists. |
| `dcssSemantic(event)` | Optional copied schema-v1 `canned-v1` observation after the canonical message's `buffer.add`. Includes source commit, decimal sequence/turn, channel/parameter, colour, join/nojoin/more/flash/shout and a semantic Message with empty params. Rust validates the 45-ID source registry. |
| `dcssSemanticError(reason)` | Optional diagnostic for an isolated observation failure. It does not abort/repeat the canonical engine message. |

Semantic callbacks observe completed original decisions and never instruct the host to replay message control effects. A missing or throwing observer retains canonical native output. These callbacks do not provide a complete translated or persisted message history. A separate source-selected startup bridge formats only `startup.weapon.prompt` through Rust and supplies the result to the original native print site. It retains CYAN and native menu controls, uses the session-start language, and does not intercept arbitrary formatted-English text. See [SEMANTIC-INTEGRATION.md](../docs/SEMANTIC-INTEGRATION.md).

Input is Unicode scalar integers, ASCII controls or the exact negative `CK_*` constants from the pinned headers. Rust maps browser keys and excludes IME composition from game commands. It preserves arbitrary external player-name data; any native name-entry validation remains the original game’s rule.

Paint all frame backgrounds before glyphs. Scalar zero is the second cell of a two-column glyph and must not erase its leading glyph. At a cluster cell, draw exact `text` rather than reconstructing or normalizing Unicode. Copied frames and language changes must not affect simulation or RNG.

## Safe exports and save serialization

These exports may be observed only while the original game is suspended for input and no helper operation is active:

| Export | Result |
|---|---|
| `_dcss_repaint()` | Copies the existing console. No rules, RNG or semantic events are invoked. |
| `_dcss_clusters_json()` | Pointer to a static UTF-8 JSON array of `{cell,text}`. Copy it immediately. |
| `_dcss_snapshot_json()` | Pointer to static UTF-8 JSON containing logical player fields, seed and all 45 PCG state/sequence/draw records. Copy immediately with `UTF8ToString`. u64 fields are decimal strings; native saves do not persist diagnostic draw counts. |
| `_dcss_save()` | Official Lua persistence, `save_level(current)` and `save_game(false)`. Returns 1 for an invoked living-player checkpoint, or 0 before a usable game/current level. The JSPI export returns a Promise for this result; there is no separate `promising_dcss_save` export. |

Save can itself yield for Lua input/message/delay. The Worker serializes it: stash the main game's input resolver, route nested helper suspension/input independently, prevent competing state/repaint/save exports, await completion, capture file bytes, then restore/drain the original resolver and ordered queued operations. Pending keys remain ordered; a nested save prompt must not deadlock behind a blocked state request. Abort/end settles every pending request. All C++ FS access and exports stay in the Worker.

Capture unchanged native `/persist` files only after the complete checkpoint finishes. The exact regenerable `saves/db` and `saves/des` subtrees are excluded from transport and rebuilt by original startup from pinned data. Preserve all other native bytes, including player chunks, preferences and user Lua persistence. Rust checks the versioned envelope's source/ABI/checksum, path conflicts and bounds before restoration. IndexedDB success follows transaction completion.

## Verified scope

The complete native-EH core's Node and ordinary-browser baseline checks verify genuine no-spells source events, all 45 RNG streams, redraw neutrality, complete native checkpoint/resume, browser/Worker responsiveness and normal original ending. The earlier font-free package separately passed controlled original combat, branch/save/resume, death and victory browser fixtures. Those browser receipts retain their historical artifact scope.

The selected native-prompt artifact passed eight Japanese Node smoke checks and five fresh-process Japanese resume checks. Its raw native prompt is eight characters over 16 CYAN cells and formats once; all 75 smoke redraws preserve state, and resumed character creation is not repeated. Resume preserves non-cache file bytes, every persistent PCG word and three following turns while official caches regenerate.

Eighteen actual ordinary-Chrome checks now cover the bare default root, native Japanese/CJK/menu input, original quickstart via physical `?`, `^` and Escape, all-45-stream neutral render/locale observation, PC/mobile commands, Rust/IndexedDB resume and native ending. Seventeen JA/EN and cross-locale resume comparisons match every exposed snapshot field and every ordered PCG state/sequence/count, with no ignored exposed fields. This does not compare independent generated clock-bearing save bytes across runs or parse all native tags. The exact current artifact also passed 26 controlled combat/branch/death/victory checks. Those prepare conditions with original wizard controls and do not establish an unassisted full playthrough.

The canonical console and English-sensitive rc/Lua control path remain intact. The 45 canned variants and one of the 51 startup IDs are connected. Proposed future 11-ID conversions remain source-only. Most gameplay prose remains English. A catalog/event slice and controlled game fixtures do not establish a completed Japanese game or an unassisted full playthrough. The current delivery is local HTML served by Node, with no external Site. Default-route JSPI passes both 88 protocol-mock checks and the separate current-artifact actual-browser gate; these two evidence types remain distinct.
