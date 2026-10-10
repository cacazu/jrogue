# Original full-save and resume comparison adapter

This folder supplies source for a genuine original ToME 1.7.6 full-game/world save and a fresh WASM/Lua VM resume through the original module loader. It is explicitly `baseline_original_checkpoint` / `baseline_original_resume`. Original screenshot and display effects execute as part of the original operation. This is a comparison milestone; it does not establish pure rendering, callback-free graph cloning, production named-bank activation, or full-campaign compatibility.

This agent executed only source reads, byte comparisons and its own Python source-generation scripts. The parent owns native compilation and actual monitored browser execution. Do not describe an unexecuted scenario as passing.

## Minimal native integration

Compile `checkpoint_gate.c` and `rng_sidecar.c` with the existing original Lua 5.1 headers, Emscripten headers and the parent's actual snapshot/phase headers. Keep the existing SFMT, Box-Muller, musl and combined atomic-restore implementations unchanged. Add this folder to the include paths. Include `checkpoint_gate.h` in the existing native adapter and install `tome_web_checkpoint_gate_install(state)` after real `core.game` registration. It must return true.

Add `native_exports.inc` immediately after the existing `bridge_call` helper. Its signatures match the actual adapter helpers `initialized_adapter`, `fail`, `check_lua_status`, `tome_main_get_state` and `tome_run_original_file`.

Keep the existing command/draw/start exports behind `tome_web_checkpoint_busy()`. Reject external commands, draws and repeated starts while the gate is held. The application's animation/input scheduler must honor the same gate. Original internal save/load screenshot and `core.display.forceRedraw` calls are deliberately allowed in this baseline. The gate is a single-thread external-dispatch exclusion mechanism; it is not a domain-callback or worker barrier.

Add `-lidbfs.js` to the existing link command. Keep classic Emscripten FS. Extend, rather than replace, `EXPORTED_RUNTIME_METHODS` with `FS`, `ccall`, `IDBFS`. The store also accepts actual `FS.filesystems.IDBFS`. Retain the original existing native exports. Add these if an explicit function allowlist is used:

```text
_tome_web_checkpoint_busy
_tome_web_checkpoint_mode
_tome_web_rng_validate_hex
_tome_web_rng_capture_hex
_tome_web_rng_restore_hex
_tome_web_rng_error_id
_tome_native_full_save_begin
_tome_native_full_save_settle
_tome_native_full_save_poll
_tome_native_full_save_persisting
_tome_native_full_save_committed
_tome_native_full_save_failed
_tome_native_set_resume_request
_tome_native_start_resume
_tome_native_resume_poll
_tome_native_resume_restored
```

No new ZIP C source or minizip reader library is required. The upstream bundles a ZIP writer and the PhysFS ZIP reader, not an `unzip.h` API. `native_archive_validator.mjs` validates the actual guest FS bytes with browser ZIP32 parsing, real raw-deflate `DecompressionStream`, size checks and every member's CRC. Original loading continues through the original PhysFS reader. The independent Node verifier uses `node:zlib` only in the actual CDP scenario, not in the browser store.

## Source preparation and actual routes

Run these own source-generation scripts in order after the existing birth driver or original VFS input manifest changes:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' 'save-resume-work\make_resume_driver.py'
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' 'save-resume-work\prepare_browser_inputs.py'
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' 'save-resume-work\prepare_deliverables.py'
```

The final script reads the authorized pristine source directory to verify staged source identity and hashes this source bundle. It must run before the first durable save so the compatibility key is stable. No Lua/engine/build/browser runs are performed by those scripts. A later bundle change intentionally rejects old adapter generations unless an explicit migration is implemented.

`baseline_server.mjs` wraps the existing original read-only binary-range server. It uses its own generated `browser-vfs-inputs.json`; it does not edit the current production/native birth driver or another agent's manifest. The separate test server substitutes `generated/baseline-birth-driver.lua` for its `/adapter/real-core-probe.lua` and adds these actual VFS inputs:

```text
/adapter/baseline-checkpoint.lua
/adapter/resume-support.lua
/adapter/original-resume-driver.lua
```

The minimal browser page is `/baseline-save-resume.html`. Its actual JS/catalog routes are `/checkpoint/{checkpoint_store,baseline_flow,native_archive_validator}.mjs`, `/checkpoint/source-manifest.json`, and `/checkpoint/i18n/{en,ja}.json`. It uses the original `/native/tome-native.mjs` / `.wasm` and the original `/bootstrap/browser_vfs_mounts.mjs` routes. Japanese is the default. Original character names and unstructured developer details are not translated. New adapter IDs have a separate complete en/ja catalog and manifest; they are not part of the original game catalog's coverage count.

For the parent's existing monitored Chrome harness, use:

```text
node native-core-work/browser_probe.mjs
  --server-module save-resume-work/baseline_server.mjs
  --entry /baseline-save-resume.html
  --report-expression window.tomeCheckpointReport
  --scenario-module save-resume-work/full_save_scenario.mjs
  --deadline-ms 180000
  --output native-core-work/full-save-browser
```

Run this through the parent's existing Windows Job Object resource monitor, using the already selected absolute Node executable. This folder's scenario launches no process/server/browser on its own. It receives the real CDP connection from that harness.

## Original operation and ordering

Pristine source paths and exact SHA-256 identities are in `original-source-provenance.json`. The adapter's reads were byte-compared with actual official extracted source, not inferred from predecessor documentation.

`mod/class/Game.lua:2854` calls the original `Game:saveGame`: highscore/hotkey work, original game push/clone and original `world:saveWorld`, with the existing optional charsheet export. `mod/class/World.lua:36` pushes the actual world graph. Original `SavefilePipe:push` captures its actual screenshot and clone; original `doThread` owns serialization, validity/retries, native completion consumption, `on_end` and all `on_done` callbacks. The additive module does not pop save returns or serialize a competing graph.

The save protocol is `settling -> prepared -> idle -> draining-prior? -> serializing -> graph-complete -> persisting -> complete`. The additive application settle step holds the same native gate and calls unchanged original `game:tick` only when original tick-end work remains or its callbacks have not yet returned to a player input boundary. Original paused GameTurnBased ticking processes housekeeping without granting turn energy. No input, pause/energy manufacture, cancelled queue, display or RNG restoration occurs. The step is bounded to 10000 actual original ticks and retains the gate on failure. Prepared passes directly into the unchanged strict original preflight under the same gate. Begin requires a living, paused, energy-ready original player with no birth, dialogs or queued tick-end work. Any prior legitimate original autosave coroutine is pumped and resumed to completion before requesting the new original full save; its callbacks must leave the same valid input boundary. Each poll calls the actual native serial pump and resumes the original coroutine once. Completion requires the original pipe, waiton, callbacks and saving flag drained and the actual native worker idle with zero pending completions. The real platform `forceWait` overlay may also complete synchronous original paths; background settings are not silently altered.

At `graph-complete`, the adapter obtains the actual filenames from original `Savefile:nameLoadGame/nameLoadWorld`, applies the exact original slot sanitization and resolves actual guest paths with `fs.getRealPath`. The store normalizes the original empty world's doubled slash. It captures the actual complete current RNG immediately after graph/callback completion, before its first asynchronous validation/hash/storage step. The original external-dispatch gate stays held until actual durable completion. A status transition alone is not save success.

The store inventories and copies every actual runtime home file, including original game/world/zone files, screenshot/profile/hotkey/log/metadata files when present. It rejects symlinks, unfinished `.tmp` archives, changed lengths, invalid paths and missing mandatory game/world files. Both full graph ZIPs must pass bounded actual byte/CRC/class validation before commit. It never substitutes the initial Party `character.teac` for a full Game or World graph.

## Actual durability and failure handling

`/persist` remains the original working MEMFS home. `/checkpoint-store` is the one durable IDBFS mount, populated with actual `FS.syncfs(true)` before engine initialization. A verified immutable generation contains `home/` with the full original runtime tree, a versioned `rng.json`, and a hash-addressed `manifest.json`; `active.json` contains the current head and an already verified previous head. A single actual `FS.syncfs(false)` persists the candidate. Save success is acknowledged only after its genuine success callback, which the installed SDK wires to the IndexedDB transaction's `oncomplete`.

The inspected SDK's error callback does not itself guarantee transaction rollback: its reconcile error path does not explicitly abort all queued requests. Consequently this code does not claim failed commits leave no partial writes. It does not retry/resync a failed local candidate or release the original gate. A fresh VM validates current bytes/hashes/versions/ZIPs before loading; if that candidate is invalid it validates the immutable previous head. Both generations remain separate from the original writable working slot. No automatic migration, repair or deletion is performed.

The current sidecar schema is 1. Layout 1 is `original-singleton-v1`, 2588 bytes: original SFMT2524 + Box-Muller36 + musl28. It is permitted only in explicit baseline save/resume gate modes. Layout 2 is `original-named-banks-v1`, 5208 bytes, and is accepted by the codec/store only as the separate strict-production format. The named state includes both complete banks and the phase envelope. There is no silent singleton-to-named upgrade; this baseline loader rejects named resume until a real strict host exists. Unknown/future schemas, versions, layouts and differing compatibility metadata fail before the original loader runs.

## Genuine fresh-VM resume and limits

The store validates the durable generation, requires an empty working home and copies the entire verified original home into that fresh MEMFS before `tome_native_init`. A native setter builds the resume request using Lua stack APIs, not source-string interpolation. The generated separate driver calls the actual original `/loader/init.lua` with `new_game=false` and the saved original module extras/profile/save name. The birth driver always uses `true` and must not be used for resume because the original Module deletes that working slot.

Original `engine/Module.lua:1105` retains its real `g,delay=save:loadGame`, `_G.game=g`, `delay()`, `save:close()`, original `prerun()` and `run()` ordering, with original earlier world load/run. Thin observers delegate the real world/game functions and delayed closure, count successful calls, and are removed after the original module returns. This module does not call `SavefilePipe:doLoad`, which drops the delayed return.

After original loading, this baseline performs one genuine original display initialization and settles original pending work through the actual native save pump and original `game:tick` as needed, with a 10000-original-tick runaway guard that keeps the gate/callbacks intact on failure. Required original dialogs are reported, not auto-dismissed. Only at a living, paused, energy-ready input boundary with drained actual pipe/native queue does it request native validation/restoration of the saved complete singleton RNG. The host compares the actual resulting bytes exactly, acknowledges restoration, then releases the gate and enables commands.

Original load/`loaded`/`prerun`/`run`, post-load display and settling can mutate serialized domain state. Restoring RNG afterwards cannot undo those changes. The actual scenario must therefore compare the original post-save and fresh-resume observations and command continuation, and report a concrete mismatch if present. It normalizes only original Entity UID remapping in the existing finite bridge view; all other observed turn/energy/player/map fields and exact RNG bytes must match. A successful finite observation is not equality of every field in the campaign graph.

`full_save_scenario.mjs` performs two actual complete durable full saves to establish a real previous head, independently validates both exact graph ZIP exports with the Node parser, verifies malformed RNG/future schema/corrupt graph rejection, and tests actual validated previous-head selection after temporary local corruption. Those rejection probes restore all bytes without syncing corruption; they do not inject or prove recovery from an IndexedDB transaction failure. It then reloads the same page through CDP on the same actual Node origin and Chrome profile, creates a fresh WASM/Lua VM, resumes from populated IndexedDB, compares checkpoint state and two original command continuations, and retains real ZIP artifacts/evidence/screenshot. Default ZIP limits are 16MiB archived, 64MiB inflated and 8192 entries per full graph; larger real campaign archives fail clearly and require a reviewed capacity increase.

Strict production integration remains separate: the existing mechanics `save_boundary.lua` must be backed by a real classified domain/visual preparation barrier, no pending gameplay-producing display/lifetime callback, real original worker accounting, frozen screenshot replay, and both RNG banks. The baseline exclusion gate and successful comparison tests do not provide that implementation.
