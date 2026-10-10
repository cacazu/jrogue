# Pending-prompt save continuation plan

Status: source-reviewed architecture, approved for source implementation after the first WASM build finishes. No compiler, browser, package or publication acceptance is asserted by this document. The current delivery scope is local HTML and Node browser execution.

The engine remains the official Angband 4.2.6 C rules implementation, upstream commit `f3082213b73f3e463e3d0d60bff4b00462beae6e`. Rust owns input validation, bounded transport and replay bookkeeping; it does not simulate the game or advance its RNG.

## Required behavior

A save made while a direction, item, quantity, spell, store, target, menu, More, name or biography prompt is pending must restore that same pending prompt, its immutable native frame, current semantic context and complete RNG state. Reconstruct the active C stack by replaying original inputs from a reproducible base. Do not serialize pointers or a live C stack, substitute a different command boundary, or rerun an extra descriptor/redraw to obtain evidence.

## Concrete source findings

- `main-web.c` currently saves only generated command boundaries accepted by `ab_web_checkpoint_can_save()`; nested prompts are refused. Its host queue contains packed nonzero keyboard values only.
- `ui-input.c:76` performs nonblocking terminal polls with a scan cutoff; `SCAN_INSTANT` and movement delay use empty results. Replaying only nonzero keys changes those decisions. Blocking host polls inside `main-web.c`'s 16 ms loop do not return to native code, so those idle iterations may be collapsed.
- `Term_inkey()` can peek and then consume the same event. Journal platform delivery, not each native key retrieval. Capture actual `Term_keypress`/`Term_mousepress` return values; the current adapter ignores enqueue failure.
- `Term_resize()` changes native window buffers and pushes an `EVT_RESIZE` at the front. Rust's current `Screen` is fixed at 100 by 32; typed resize support is not connected until a bounded dynamic renderer is accepted.
- `mon-make.c:229` reads the system date; seasonal races are eligible only December 24 through 26. Different replay dates can change selection and RNG consumption.
- Store maintenance uses game `turn` and saved `daycount`, not OS time. `randname.c`'s time seed is under `RANDNAME_TESTING` and is outside the browser engine.
- `Rand_simple()` uses a private static seed, time and, when compiled for UNIX, PID to generate save temporary names. Record the actual environment inputs and execute the original arithmetic; do not replay a result while leaving that private seed unadvanced.
- Retirement/death timestamps, `ctime`, score dates and forced output filenames use OS time/calendar results. `file_exists` affects overwrite prompts; `file_newer` affects panic-save selection/deletion.
- Direct `savefile_save()` writes `CharOutput.txt`, creates/moves/deletes temporary files and changes `character_saved`. `save_game_checked()` also disturbs, flushes, redraws, changes `died_from` and writes prefs/lore. Automatic anchors must use a pure memory sink around the unchanged block writers.
- `wr_messages()` retains only 80 messages and omits their repetition counts. `rd_messages()` uses a 128-byte string buffer. The live message queue holds up to 2048 entries.
- `new_level_display_update()` recenters terminal offsets when loading. Current checkpoints omit panel offsets, terminal state, private animation phase, keymaps, visuals, palette/message colors and keylog.
- `do_animation()` uses gameplay RNG for multi-hued monsters; `map_info()` uses it for hallucination rendering. A saved RNG followed by an extra native redraw does not reproduce the saved hallucinated frame.

## Version 3 bases

Version 1 and 2 remain readable as direct legacy checkpoints. Their key-only journals do not contain enough information to become replay continuations. Never infer their timing or anchor position.

The initial complete version 3 route uses a deterministic bootstrap:

1. **New game:** selected seed, full post-initialization 38-word RNG, original startup environment/FS overlay, exact engine/data/input contract identity and the ordered journal beginning before birth input.
2. **Loaded game:** the complete original native payload, its RNG and the actual resumed startup environment. Enable this mode only after the native startup-frame and setup-state proof is accepted. It reproduces the state exposed by that bootstrap; missing historical provenance in legacy saves is not recovered by guessing.

Retain the complete bootstrap continuation while an optimized stable anchor is incomplete. A future stable anchor may replace the prefix only after its native payload and ancillary UI/config/FS state reproduce the entire start state and subsequent same-input behavior. Do not silently enable a partial fast path.

## Ordered journal

Use owned, typed entries with a monotonically increasing event sequence. Also maintain terminal request ordinal and accepted-delivery ordinal as separate 64-bit values. Use low/high words or decimal strings at JavaScript boundaries rather than lossy JSON numbers.

- Terminal outcome: expected wait/scan mode and context digest; `None` for a nonblocking poll, or an attempted keyboard/mouse/button/resize delivery with its native acceptance result.
- Flush: the owned discarded pending queue and exact order.
- Environment outcome: stable source-site ID, typed time/calendar/PID/FS decision and owned result. Replay must reject a different next site/type.
- Text origin: committed Unicode text/IME group and exact scalar order. The native engine still receives its original keyboard scalars. Composition preedit is a browser draft, not an invented native event.

Do not journal replayed entries again. Do not coalesce empty native polls across separate terminal requests or advancing simulation. Multiple empty host polls within one blocking request are collapsible.

## Input contract

Keyboard retains the existing Angband normalization and special codes. Mouse coordinates are native terminal cells, bounded to the native byte coordinate range, with low-four-bit button and control/shift/alt/meta modifiers. Existing HTML touch controls remain keyboard-origin events. Genuine native `EVT_BUTTON` has a separate typed representation.

Logical resize is distinct from CSS/font scaling. Preserve the native resize acceptance and front-push ordering. Keep the first accepted engine build at 100 by 32 until Root supplies the dynamic renderer.

Text and IME commits preserve owned Unicode without translation. Suppress composing keydown and commit composition exactly once. Preserve unsent draft text and selection separately at the save barrier; no input is silently dropped to fit a queue.

## Save and resume protocol

At a save barrier, freeze incoming browser input, copy the pending typed queue and draft, and capture the current terminal request before delivering another event. The target includes request/delivery ordinals, all 38 RNG words, wait/scan flags, screen-save depth, terminal size/offset/queue state, cached native frame and semantic-context evidence. Read cached presentation; do not request native redraws.

Resume in a fresh isolated worker. Validate the entire envelope and identities before applying bytes. Install the original mutable FS overlay and metadata, run the correct bootstrap, then restore/verify the post-init or loaded boundary RNG at its exact source seam. Feed recorded outcomes in order until the saved target request. A blocking target stays pending for new input; a nonblocking target retains its original continuation semantics.

During catch-up the native engine performs its original logging and side effects once in the reconstructed worker. Suppress outward frame/log/audio/storage/download delivery, while still rebuilding the owned Rust presentation state. Expose one final rebuilt model at the target after RNG/frame/context/metadata validation. Replay failure leaves the current live session and previous persisted save intact.

Clock veneers are browser-only and source-specific: live execution calls the original OS function once and captures its actual result; replay supplies the recorded result. Preserve calendar fields as well as epochs so timezone changes cannot change source branches. Do not globally intercept `Date` or modify Asyncify sleeps. FS replay uses the original isolated overlay and source-identified decisions; preserve relevant mtimes.

## Ownership and ABI coordination

The replay owner reserves `main-web.c`, `rust/src/platform.rs`, `rust/src/input.rs`, the new Rust replay module, environment adapter C/H, audited original clock/FS callsites, and the subsequently delegated browser worker/library/protocol. The Rust bridge owner provides `replay_bridge.rs`. Root owns `lib.rs` registration, app/core, build exports, identity generation, presentation dimensions and future pure-memory/ancillary anchor integration. Current source implementation and executed lightweight checks are documented in `REPLAY_V3_SOURCE_INTEGRATION.md`.

Proposed root-facing FFI operations (all byte spans copied synchronously): bootstrap installation; enter terminal wait; obtain recorded typed event; commit actual native result; flush; environment begin/result/commit; prepare owned save; dedicated mode/status/length accessors. No borrowed C data or Rust state borrow may survive a host callback or Asyncify yield.

The typed event bridge uses 16 `u32` words: kind, code, modifiers, x, y, button, width, height, origin, group low/high, scalar index/count, then three zero reserved words. Typed platform models, not raw words, are the persisted Rust contract.

Versioned extension sections have owned validated bytes and separate bootstrap/target roles. Restore bootstrap metadata before `ab_run`; target metadata is comparison evidence until replay reaches that target. Reserved sections:

- `angband.death_cause`, version 1, at most 16 KiB.
- `angband.death_scores`, version 1, at most 512 KiB and 100 records, keyed by complete original score bytes.

Missing legacy provenance is explicit. Do not install target death/score metadata before replay or silently evict it to fit.

## Approved bounds

All lengths and section sums are checked before allocation. Total version 3 envelope is at most 40 MiB; native bootstrap at most 16 MiB; mutable FS at most 4 MiB; journal at most 8 MiB and 262144 entries; target cached presentation at most 8 MiB; aggregate extension metadata at most 1 MiB; pending queue at most 256 events; individual text/IME commit at most 64 KiB. Retain the legacy envelope limit of 36700381 bytes for versions 1 and 2.

No silent truncation, continuation eviction, wrong-anchor fallback or unbounded allocation. If recording reaches a cap, keep the game playable but refuse the new save explicitly and retain its predecessor. Move owned buffers rather than cloning full envelopes through the Rust adapter. Root measures actual peak memory at the later build/browser gate.

## Acceptance gates

First use lightweight source extraction and Rust codec/model tests under Root's job gate. Validate strict v1/v2 migration, v3 round trips, bounds/overflow/truncation/checksum/order rejection, normalized input, mouse/resize/text grouping, zero-poll semantics and replay cursor failure atomicity.

The later measured browser gate compares uninterrupted execution against save/resume at birth/name/biography/stat-roll, nested command prompts, store/menu/target/More, help/options, death, mouse and committed text/IME. Include Christmas/non-Christmas source clock outcomes, changed device timezone, panic/overwrite FS branches, queued-input flush, hallucination, multi-hued animation and manually changed viewport. Compare exact RNG, native frame, owned context, metadata and the next identical inputs through a stable native save with every block compared. Renderer calls must not change simulation/RNG.

No compiler, engine/browser run or packaging step is authorized to this child before Root's build gate. No external publication is part of this milestone.
