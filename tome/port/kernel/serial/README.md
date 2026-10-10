# Browser save worker adaptation

`serial_browser.c` is a generated, GPL-3.0-or-later copy of the acquired official T-Engine 1.7.6 `src/serial.c`. The original copyright/license header is retained. The pristine upstream is never modified. `make-browser-serial.mjs` checks exact replacement anchors and hashes the original and generated files in `provenance.json`; the 5,119-byte graph serializer region is byte-identical. The original ZIP entry metadata and compression options are copied rather than rewritten.

Build this source instead of the original `serial.c` object, using the parent's original include directories, archives, defines, and SDK. It adds no build library dependency and needs no linker wrapper. A direct C caller can include `browser-serial.h`; otherwise the original `core.serial` Lua library exposes the additional APIs below. No compile, engine run, test, or browser run was performed by this source-only task.

The original `new`, `toZip`, `threadSave`, and `popSaveReturn` interface remains. `threadSave` activates the same queued graph payloads but starts no SDL worker. The browser host owns one sequential pump and must keep an exclusive save barrier while original Lua graph serialization and ZIP writing proceed. Only the original save-pipe coroutine may call `popSaveReturn`; the adapter never steals its completion names or invokes its callbacks itself.

- `core.serial.browserWorkerReady()` returns a boolean.
- `core.serial.browserPump(max_entries, max_bytes)` returns `0` for physical queue idle, `1` for remaining work, or `-1` for a terminal native save error. Defaults are four completed entries and 65,536 payload bytes per call. Zero budgets perform no work. Each deflate input chunk is at most 65,536 bytes, with no added flush operation.
- `core.serial.browserStatus()` returns `ready`, `activated`, `queued_entries`, `entry_inflight`, `archive_inflight`, `completions`, `entries_written`, `payload_bytes_written`, `idle`, and `error`. `queued_entries` excludes the current entry. Physical `idle` does not imply that the original Lua completion callbacks have run; `completions` can still be nonzero.
- `core.serial.browserError()` returns the first error string, or nil.

ZIP entry open/write/close, archive close, existing-file deletion, final rename, and queue allocation failures are checked. A failed archive never posts a completion name. The original worker uses deflate level four, zero ZIP timestamps, raw-deflate window bits, default memory level and strategy; those settings and the serialized graph data remain unchanged. Splitting the deflate input across pump calls preserves the save format and payload; compressed archive bytes are not asserted to be byte-identical.

The final archive is renamed only after `zipClose` succeeds. The adapter recognizes the actual `.tmp` suffix with a length guard, replacing the original unsafe OR expression. For the original game's `.tmp` save names the successful behavior is the same: delete an existing final save, rename the temporary archive, enqueue its final name. A rename failure is reported and does not manufacture completion.

Entry/payload budgets bound the number of processed entries and deflate input bytes. Minizip entry close and archive central-directory close, and PhysFS rename, are indivisible calls here; these budgets do not promise a wall-time limit for those completion steps. Terminal errors retain diagnostics and require caller recovery or instance reinitialization. Successful MEMFS completion is also separate from browser persistence: the host must await its IndexedDB/storage write before acknowledging a durable browser save.

Parent verification still required: compile/link, actual original save-pipe graph flow, bounded progress across multiple pump calls, ZIP members/CRC/decompressed graph, close/rename failure propagation, original callback completion, and browser persistence/reload. This document makes no claim that those tests have run.
