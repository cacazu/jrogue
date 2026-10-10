# Retained ToME 1.7.6 checkpoint boundary

This is a source audit and a source-only adapter proposal. It does not establish a working browser save/resume implementation. Original C/Lua owns the game graph, simulation and randomness. Rust/platform code coordinates input, persistence and presentation. No Rust gameplay replacement is proposed.

Evidence is from the pristine `tome-1.7.6` distribution in `tome/upstream/t-engine4-src-1.7.6`; unchanged selected Lua members are copied under `source/`. `source-provenance.json` records member/file SHA-256 values. The archive acquired by the parent has SHA-256 `989DEA00803F8CDCADE024F4647D480BB1AC0D437C254292C07549C272A4680C`. References below are original member lines, not adapter lines.

## Preserve the actual graph serializer

| Original location | Required behavior |
| --- | --- |
| `engine/class.lua:236` / `:362` | `cloneForSave()` preserves cycles/shared references and table keys, honors `__SAVEINSTEAD`, preserves metatables, suppresses `cloned()` callbacks, and treats `__threads` specially. JSON cannot substitute for it. |
| `engine/class.lua:443` | `class.save()` respects selected fields and `_no_save_fields`; uses actual `core.serial.new()` naming/processing callbacks and `s:toZip(self)`. |
| `engine/Savefile.lua:142` | `saveObject()` traverses actual class graph, invokes each `onSaving()` and `save()`, and yields when configured. |
| `mod/class/Game.lua:744` | Game save updates playtime on the saved object, then invokes the original selected-field serializer. |
| `mod/class/Game.lua:2812` | `onSavefilePush()` intentionally stops original running/resting. Preserve this save action. |
| `mod/class/Game.lua:2854` | `saveGame()` updates high score/hotkeys, queues the original game, then original world; it may also perform configured character-sheet work. |
| `mod/class/World.lua:36` | `saveWorld()` queues the same singleton pipe with an empty save name. Persist world/profile metadata as well as the character directory. |
| `engine/SavefilePipe.lua:103` | Push takes the game screenshot at line 116, clones at 125, creates a save-version UUID at 129, and registers the actual save coroutine at 135. |
| `engine/SavefilePipe.lua:157` | `doThread()` serializes all queued objects, starts native save work at 186, consumes its completion queue at 190, validates/retries at 200–215, invokes original object callbacks, and finally runs all generic callbacks at 237–241. |

`SavefilePipe` is a singleton (`engine/SavefilePipe.lua:35–37`). A second instance is invalid. Do not bypass its coroutine with a new serializer, and do not consume `core.serial.popSaveReturn()` outside the original pipe: doing so steals the notification the pipe needs to finish.

Original completion is weaker than browser durability. `src/serial.c:139` deletes the previous final file, renames `.tmp`, then posts its name; original rename/delete return values are unchecked. `engine/Savefile.lua:747` only checks that the mounted archive has a `main` member. Browser integration needs explicit write/close/rename error propagation and archive/hash validation. Preserve original queue/ZIP/graph logic while replacing only the unsupported worker scheduling service. The parent assigned that platform adaptation to `serial-platform-work`; this adapter does not fabricate its readiness.

## Required concrete save phases

1. Stop new commands and frame reentry at a real living-player input boundary (`game.paused`, player has energy, no birth/dialog operation). Finish earlier autosaves, logical FOV/input work, simulation callbacks and level-generation jobs. Account for held keys and record repeat events. Stage a separate working generation so an error cannot delete the prior durable checkpoint.
2. Enter an exclusive original-Lua/native barrier. The host must prove the native save queue pump is usable, no gameplay/WFC RNG job is in flight, all particle jobs are parked/accounted for, and any save-triggered draws use the classified presentation boundary described in `RENDER-BOUNDARY.md`. Prevent `game:tick()` from concurrently resuming the same coroutine. Background saving must be configured already; this adapter does not change user settings.
3. Invoke the original `game:saveGame()`. This intentionally calls original screenshot, run/rest stopping, hotkey, game/world graph and metadata paths. Resume the original `savefile_pipe.co` once per host poll. The source-only adapter calls the real `core.serial.browserPump(1,65536)` before each resume; the original pipe remains the sole completion consumer. One Lua resume is a cooperative step, not a guaranteed elapsed-time budget: original callbacks can do substantial work.
4. Wait for the original coroutine to be dead and all `pipe`, `waiton`, `saving` and `on_done` work to be empty. Validate final archives and preserve all generation-owned files. Do not treat a `.tmp`, a posted filename or an empty input queue alone as completion.
5. While still quiescent, capture **all three** original gameplay RNG components atomically: SFMT, `rng.normalFloat()`'s cached Gaussian state, and the SDK libc `rand()` state used by bundled Lua `math.random()`. Write the versioned RNG sidecar and generation manifest. Do not reseed as a substitute for restoration. Capture must describe the same logical state as the saved clone; callbacks between clone and capture must be classified and tested. RNG restoration alone cannot fix later draw-triggered gameplay mutations.
6. Commit graph files, sidecar and active-generation metadata under one browser persistence mount. Report success only after the real IndexedDB transaction completes. On write/quota/transaction errors retain the previous generation and a visible failure state; do not silently continue with a claimed successful checkpoint.
7. Release the native/application barrier after durable success. Presentation may resume on its independent visual stream. Do not automatically retry a partial original save against a different live graph.

The original pipe calls `forceWait()` when the same save is pending, its queue reaches `max_before_wait`, or background saving is disabled (`engine/SavefilePipe.lua:107–143`). Its tight resume loop at 258 blocks the host event loop, so an external pump cannot progress the save there. Actual parent browser birth reached this path and stalled after `threadSave`. `make_savepipe_platform_overlay.py` therefore emits the narrow browser-only `generated/engine/SavefilePipe.lua` leaf: it calls the real native pump inside each original loop cycle, checks readiness/error/status, and propagates failed coroutine resumes. Completion still comes exclusively from the original `doThread` consumer/callbacks. Exact reverse replacement recovers pristine bytes; this task has not executed the overlay. Parent/boot agent owns the live integration and browser verification.

This synchronous birth save is not an asynchronous UI budget guarantee. The explicit checkpoint adapter separately requires an initially empty pipe, background saving and capacity greater than the two base game/world saves. Addons/callbacks may enqueue more: selected content must be audited before claiming bounded operation. On native-pump failure, fail explicitly; never poll forever waiting for an unsupported SDL worker.

Save creates UUID metadata after cloning (`mod/class/Game.lua:2801`, pipe 129) and forces actual redraws during serialization (`engine/Savefile.lua:185,264,358,395,429`). The required consistency point therefore cannot be reduced to “copy game fields, save RNG, draw later.” There is no demonstrated whole-graph checkpoint boundary yet.

## Versioned RNG envelope

Existing source seams are in `kernel-bindings-work`, with the parent SFMT wrapper in `native-core-work`:

| Component | Explicit bytes | Restoration seam |
| --- | ---: | --- |
| Original SFMT | 2524 | `tome_rng_snapshot_*` |
| Original cached normal draws | 36 | `tome_normal_snapshot_*` |
| SDK 6.0.8 musl libc `rand` | 28 | `tome_libc_rng_snapshot_*` |

The combined adapter validates every immutable buffer before mutating any component. Checksums detect accidental corruption, not adversarial modification. The normal cache relocation preserves the original algorithm and its odd-draw reseed behavior: `rng.seed()` does not clear an already cached normal draw. SDK `srand(0)` keeps the original unsigned subtraction semantics. The Gaussian/libc mixed executable fixture exists but remains unexecuted under the parent's build/memory constraint. Parent SFMT tests are separate evidence, not proof of the entire save boundary.

Generation metadata must include schema version, original engine/module version and source digest, adapter version, Lua 5.1 ABI, native target/rand-family identifier, selected addons/configuration relevant to rules, each archive path/length/SHA-256, all three RNG component sizes/digests, and commit state. Keep engine save-version tokens intact. A semantically valid legacy `.teag` without the new RNG envelope can be offered as an explicitly nondeterministic legacy import; it is not a deterministic resume.

The three components do not cover every arbitrary native object or addon generator. WFC has its own C++ generator and asynchronous result userdata (`src/wfc/lua_wfc.cpp:95,120,132,150`); require completed jobs before checkpoint rather than claiming those states are serialized. Noise creation/lazy wavelet initialization also consumes SFMT (`src/libtcod_import/noise_c.c:97,103,680`). Particle VM jobs share global native RNG and require the separate treatment in the render plan.

## Load through the original module path

Populate the browser filesystem before initializing/mounting the original engine. Validate generation metadata, all byte hashes and every RNG envelope before invoking a loader that may mutate or delete saves. Copy the chosen durable generation to a working slot and preserve a fallback.

Use the original `/loader/pre-init.lua` and `/loader/init.lua` module bootstrap with `new_game=false`, the selected save name and original module metadata. `engine/Module.lua:1105–1122` does the required sequence:

```lua
local g, delay = save:loadGame()
_G.game = g
delay()                      -- required original delayed loaded() methods
save:close()
core.wait.enableManualTick(false)
_G.game:prerun()
_G.game:run()
```

This is an explanatory excerpt; call the original module flow rather than copying a partial loader. It also loads/runs original world before game, restores hotkeys, and establishes original key/display/module services. `engine/Savefile.lua:557` returns both game and deferred `loaded()` callback. `SavefilePipe:doLoad()` retains only one return and is unsuitable for game resume. `Entity:loaded()` remaps UIDs and display callbacks; `Map:loaded()` reconstructs native map userdata; `Game:loaded()` recreates UI/input and deferred character work. Preserve these callbacks and original graph identity.

After original load, `prerun`, `run`, necessary logical initialization and classified visual setup complete, establish the same application/native barrier and restore all three validated gameplay RNG components atomically before the first accepted command. Validate loaded semantic state against the pre-save state; arbitrary `loaded()`/zone hooks may affect logical state and need actual differential evidence. Restoration does not retroactively undo such changes.

The current isolated birth probe `bootstrap-work/real-core-probe.lua:201` passes `new_game=true`. Original `Module.lua:1115` then deletes existing saves. Never run that probe against a resume slot. Root/boot agent owns any production loader change; this task does not modify bootstrap files.

## Browser durable commit

Local SDK 6.0.8 `src/lib/libidbfs.js:116` routes `syncfs`; `reconcile` opens a read/write transaction at 357. Its `onerror`/`onabort` call the error callback at 368; only `transaction.oncomplete` calls success at 373. Call `FS.syncfs(true, callback)` to populate before game initialization; `FS.syncfs(false, callback)` commits after graph/RNG/generation staging. Multiple mounts use separate transactions. Keep all generation-owned files in the same persist mount and disable automatic partial sync during the checkpoint. Ensure changed files have observable modification metadata. The native ZIP graph and RNG sidecar must belong to the same committed generation.

## Source-only adapter contract

`save_boundary.lua` returns a module with `new(host)`, whose object provides `begin(generation)`, `poll()` and `status()`. Load it independently of the unchanged bootstrap and keep its operation metadata outside the saved game graph. It supports the first narrow living-player checkpoint milestone, not death, all dialogs, arbitrary addons or all campaign flows.

Host functions use plain function calls (no implicit Lua `self` argument):

| Host function | Required behavior |
| --- | --- |
| `preflight(generation, save_name)` | Return `true` only after the genuine boundary above exists; stage the working generation and hold native/application exclusivity. On rejection leave no barrier or partially active operation behind. |
| `barrier_held(generation)` | Return `true` only while the same real barrier remains valid; must not mutate simulation/RNG. |
| `begin_graph(generation)` | Return `true` after original writable filesystem paths point at the staged working generation. |
| `graph_complete(generation, save_name)` | Validate all final original files; capture the three RNG components under the proven boundary; write manifest/sidecar and start durable persistence. Return `true` for started, not committed. |
| `poll_commit(generation)` | Return `pending`, `committed` or `failed`, plus an optional error. `committed` requires actual IndexedDB transaction completion. |
| `finish(generation)` | Publish the verified generation and release the boundary; return `true`. |
| `failed(generation, code, detail)` | Preserve prior durable generation and retain a recoverable error/barrier policy. No fabricated rollback of original mutations. |

The adapter requires the actual source-stage serial platform APIs `browserWorkerReady`, `browserPump`, `browserStatus` and `browserError`, rejects missing/not-ready service before starting, propagates terminal pump errors, and checks physical native idle plus zero unconsumed completions after the original coroutine drains. It does not implement the rendering/RNG/barrier/IndexedDB host services. Until they exist, `preflight` must reject. Static source/API checks are supplied separately; no runtime correctness or deterministic save compatibility is claimed.

Required future runtime verification: original graph save/load with party/shared-reference/native-map reconstruction; game and world completion/error paths; no-tick coroutine exclusivity; exact post-resume SFMT/Gaussian/libc draws; malformed sidecar atomicity; held-key/dialog/save-screenshot paths; pending particle/WFC jobs; browser reload; storage quota/abort; repeated PC/mobile commands; and semantic state equality after different render counts. Normalize known UID remapping and documented save metadata only, never omit mechanics to manufacture equality.
