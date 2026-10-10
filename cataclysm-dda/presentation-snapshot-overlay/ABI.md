# Source-only native text-submission ABI v1

The new family is `cdda-native-text-submissions/1`, independent from existing input/help families. No compiled export or actual host/Rust connection has been verified. Only the original engine thread may invoke it; thread safety is not supplied.

| Export | Exact contract |
|---|---|
| `uint32_t cdda_text_snapshot_pin(void)` | Pins latest owned bytes. Returns nonzero opaque handle or 0 for unavailable/full/exhausted/reentrant state. Four slots; monotonically increasing handles never recycle. |
| `const uint8_t *cdda_text_snapshot_data(uint32_t)` | Exact pin's read-only bytes, valid until release; null for unknown/released/reentrant handles. Not NUL terminated. |
| `size_t cdda_text_snapshot_size(uint32_t)` | Exact byte size; 0 for invalid handle. WASM32 expected. |
| `void cdda_text_snapshot_release(uint32_t)` | Releases only that exact pin. Unknown/zero/reentrant requests do nothing. |

Reads/releases change observer ownership metadata only. No C++ window/font/container pointer, exception, action, clock or RNG crosses this API. Existing pins survive latest replacement or invalidation. Unreleased pins retain memory; consumers must release them.

All numeric fields are little-endian. Signed fields retain their exact two's-complement word. Raw cells have explicit lengths and need not be UTF-8. Build identity is a coordinated UTF-8 string; producer build macro must be independently reviewed/validated. Source commit is fixed ASCII.

| Frame header, in order | Size |
|---|---:|
| Magic `CDTP` | 4 bytes |
| ABI version `1` | u16 |
| Flags `0`; complete canvas unsupported | u16 |
| Publication, nonzero monotonically increasing | u64 |
| Exact upstream commit | 40 ASCII bytes |
| Build identity length, ≤256 | u32 |
| Build identity bytes | that length |
| Window-submission count, ≤64 | u32 |
| Ordered length-prefixed window records | count records |

Frame header length is `64 + build_identity_length`. Zero submissions is a valid partial observation, not a blank screen. No command, authoritative turn, input epoch or time is inferred from publication.

Each window starts with a u32 record-byte length. Its fixed portion is **128 bytes**, in this order:

| Window field | Encoding |
|---|---|
| Font role: UI=1/map=2/overmap=3/unknown=4 | u32 |
| Cell origin x/y, width/height, cell cursor x/y | six i32 |
| Selected font width/height | two i32 |
| Native glyph pixel offset x/y | two i32 |
| Native clipping width/height | two i32 |
| Native scale | i32 |
| In-use, original draw, ASCII-line option, reserved=0 | four u8 |
| Window raw FG/BG | two i16 |
| Selected font's exact 16 RGBA colors | 64 bytes |

Then exactly `height` rows follow. Each row stores one touched boolean u8 and exactly `width` cells. Full cells of untouched rows are copied; their touched bit controls whether native drawing occurred. Every cell stores:

| Cell field | Encoding |
|---|---|
| Raw byte length, ≤4096 | u32 |
| Original `cursecell.ch` bytes | exact raw length |
| Raw FG/BG | two i16 |
| Native first codepoint | u32 |
| Native width including UNKNOWN→1 override | i32 |
| Native ASCII-line decision | boolean u8 |
| Native line ID / original first byte | u8 |

Each cell is `18 + raw_length` bytes. Empty continuation cells keep empty bytes, codepoint/width zero and false/zero line fields. Ordinary raw border bytes `0xA0..0xAA` keep codepoint `0xFFFD`, width 1, true line decision and the original raw byte as line ID. Known Unicode box aliases use the native option and exact native line IDs. Native space/empty/width<1 early exits still precede any actual drawing; the flags are observations, not a browser draw command.

The Rust parser validates shape/bounds/booleans/record ends, source/build/version/publication, exact native first-codepoint rules and line metadata, and empty/UNKNOWN/space width invariants. It retains raw bytes privately with shared accessors. Full Unicode width-table agreement, palette rasterization/font fallback and browser coordinate conversion remain unimplemented. It does not claim to validate native world state or semantic text meaning.

Frame limits: 4 MiB serialized bytes, 65,536 total cells, 64 submissions, positive axis ≤1,024, positive font/clip/scale and 4,096 raw bytes per cell. Allocation/shape/byte failure invalidates the whole pending/latest batch; original game behavior continues. No misleading truncation. Native values outside observer limits remain native; observation is unavailable.

The deferred notice is frozen `{kind:2,publicationLow,publicationHigh,availability}`. Both halves and availability are explicitly normalized with `>>>0` at the WASM import boundary. `availability` 1 is ready, 2 is failed/unavailable; terminal generation exhaustion uses zero halves and availability 3. Zero generation is not an older valid frame. There is no availability-0 current-scope clear because these are historical committed submissions, not an active input context.

The notice can be stale. Future host tracking must compare u64 generation using BigInt, pin/copy synchronously, match the copied publication/build and ignore obsolete notices. Failure/unavailable/terminal state clears presentation observation availability; it never authorizes input or discards native events. Asyncify/microtask ordering remains an actual-browser acceptance requirement. No notice tracker is connected here.

`host-copy.mjs` obtains data/size, then reads **current** `Module.HEAPU8`, checks `size <= heap_length - pointer`, copies immediately and releases in `finally`. It must not retain borrowed views or cross an async boundary. Return bytes are owned. The separate Rust parser then copies raw cells into owned records; no pointer sharing occurs between WASM modules. Source mock tests are not actual export/memory/Rust verification.
