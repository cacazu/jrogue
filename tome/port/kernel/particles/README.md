# Original particle worker: cooperative browser platform

Source-ready integration candidate, **not compiled or runtime validated**. This work changes scheduling around ToME / T-Engine 4 **1.7.6**. It does not replace particle effects with a different simulator. The owning parent performs browser/build verification and decides when to activate it.

`original/particles.c` and `original/particles.h` are pristine copies of the official source. `generated/particles_cooperative.c` retains the first **27,988 bytes** of `src/particles.c` byte for byte, including original Lua emitter/generator/updater registration, emission formulas, integration, geometry generation, drawing, userdata lifecycle and worker helpers. `provenance.json` records hashes and exact extraction boundaries. GPL-3.0-or-later, Nicolas Casalini (2009–2018), original notice retained. Supply the upstream GPL license and corresponding generated source/adapter sources with a distribution. This adapter grants no additional rights to gfx assets.

## Retained API and new platform API

| API | Browser scheduling behavior |
| --- | --- |
| `create_particles_thread()` | Allocates one lane and the original mutex; queues original worker VM initialization for the next visual barrier. Creates no SDL thread or semaphore. |
| `thread_add(ps)` | Original head insertion and reference ownership, with a missing/faulted-lane check. The original particle definition and serialized arguments remain attached to `ps`. |
| `thread_particle_new_keyframes(n)` | Records each positive keyframe in an integer queue. An overflow faults the adapter. |
| `tome_particles_pump(budget)` | Runs original VM initialization and up to `budget` exact original keyframe traversals. Requires idle VISUAL phase and the original main GL context already current. Unconsumed keyframes stay queued. |
| `tome_particles_prepare_at_barrier(budget)` | Performs one checked GAMEPLAY→VISUAL→pump→GAMEPLAY pair for the application. Cannot be called from an active retained callback. |
| `free_particles_thread()` | Retires the current lane without running worker Lua or GC in the enclosing gameplay call. Original shutdown also abandons its queued semaphore work. |
| `tome_particles_shutdown_at_barrier()` | Drains retired lanes, including faulted/partially initialized VMs, under VISUAL before GL/PhysFS teardown. Returns 0 when ownership is retired, -1 when it is not. |

Original initialization occupies the first traversal for each emitter; it does not also perform an update in that traversal. List order, creation/emission, updater calls and each later `particles_update(ps, TRUE, FALSE)` are preserved. The extracted traversal text is identical after newline normalization. Two macro aliases route original init/death calls through fresh live panic guards without changing the extracted body; the original update already owns its panic guard. Before the original `__threaddata` handler is registered, a bootstrap guard protects allocating Lua registration. On a death panic, pristine code performs all potentially failing Lua operations before its C frees, so the adapter can release the still-owned C node and retire the faulted VM safely. Faults stop further keyframes; shutdown remains available.

No `/particle-thread` path exists in the verified original source. VM setup loads **`/loader/pre-init.lua`**, then each genuine **`ps->name_def`** from mounted original gfx archives. Loader helpers set `package.path = '/?.lua'`, RNG/serialization helpers and optional JIT support. Use the original PhysFS mount behavior and actual archives; the platform cannot substitute empty definitions or silent no-op emitters. The bootstrapping agent confirmed the genuine loader is already in the VFS manifest.

## Named ownership of all original random state

Compile `tome_rng_phases.c` with the existing `tome_rng_snapshot`, `tome_normal_snapshot`, `tome_libc_rng_snapshot` and `tome_combined_rng_snapshot` seams. It calls their actual writers, validators and combined restore directly. Each named bank contains:

| Original state | Existing codec bytes |
| --- | ---: |
| SFMT19937 state/index/initialization | 2524 |
| `normalFloat` Box–Muller cache, including spare value | 36 |
| Original musl `rand`/`srand` LCG state | 28 |
| One complete bank | 2588 |

Initialize once with `tome_rng_phases_initialize_at_barrier()` after the original seed/setup, with every RNG consumer stopped. It clones that complete initial state without drawing or reseeding; thereafter GAMEPLAY and VISUAL advance independently. This establishes a deterministic browser partition. It does not reproduce a historical native build's nondeterministic global-RNG interleaving, and the initially cloned sequences can coincide until consumption diverges.

The application wraps one outer retained gameplay invocation in `activity_begin(GAMEPLAY)` / `activity_end(GAMEPLAY)`; all inner callbacks inherit that guard. FOV, combat, traps, invisibility, onTickEnd and other domain callbacks must complete while GAMEPLAY is installed. End the invocation and reach a real quiescent barrier before switching. Then enter VISUAL, perform the original classified visual preparation (including the cooperative lane) in a fixed order, and leave VISUAL. Renderer and the single particle lane may share that same VISUAL bank; do not switch banks inside a Lua/C callback. `pump` owns its own outer VISUAL activity guard, so the application must not wrap `pump` in another activity guard. It may run other visual invocations before or after it under separate guards while the same VISUAL bank remains installed.

Barriers are **ownership checks on one browser thread, not operating-system locks**. The integration must stop all other original RNG consumers, including any WFC worker, before invoking them. Foreign direct calls that bypass guards are not detected. The phase manager never blindly restores an entire draw call: it captures the current bank on explicit entry/exit and commits each bank's legitimate consumption. FAULT fails closed if a validated state cannot be installed.

## Integration and save format

Replace the original `particles.c` compilation unit with `generated/particles_cooperative.c`; do not compile both. Keep the original `particles.h`, add `particle-platform-work` to includes, and compile `tome_rng_phases.c` alongside the existing codec implementations. Initialize the phase service before activating partitioned callbacks. Call original create through the real engine lifecycle; the current bootstrap may bypass the original `main` path and needs an explicit real call. Keep GL current throughout preparation. After the main Lua state's original particle userdata GC, retire/drain worker VMs before destroying GL or PhysFS.

Once banks are active, singleton native RNG snapshot/restore exports must use `tome_rng_phase_snapshot_*` rather than storing only the active globals. The portable envelope is **5208 bytes**, hex length **10416**. Header bytes 0–31 are `TBRN`, little-endian version 1, header length 32, total length 5208, bank length 2588, bank count 2, and fixed tags `GAME` / `VISU`; payload is gameplay then visual, each existing SFMT/normal/libc envelope in that order. Both banks and all six existing component validations precede any restore. The write operation captures the current gameplay bank, and saves the cached visual bank. Calls require idle GAMEPLAY and a stopped consumer boundary. Do not serialize the raw C struct as a save format. Existing 2588-byte singleton exports remain comparison-only until updated; the new codec rejects them.

These functions save random state, **not the original full game or live particle Lua closures/arrays**. The original gameplay save/load and its visual-effect reconstruction must still be used and verified. Recording pending keyframes, visual preparation order, frame timing and other visual state is necessary when exact visual replay/resume is required; two RNG banks alone do not preserve a live particle scene.

`i18n/en.json`, `i18n/ja.json` and their manifest cover all **30** newly introduced semantic diagnostic IDs. They are developer diagnostics, currently not rendered directly to players, with no parameters or external usernames. The source generator checks exact ID-set coverage; this delta is separate from the much larger original-game text catalog.

## Scope of verification still owned by integration

Only source extraction/generation and source review were performed here. Parent must compile/link the candidate, exercise actual browser particle VM initialization/definitions/update/death/reload/shutdown and GL use, compare retained effect trajectories under controlled visual bank state and command/keyframe order, check budget splitting and callback reentry, and verify corruption rejection plus both-bank continuation at SFMT refill and Box–Muller spare boundaries. Test both gameplay-bank invariance under extra visual preparation and visual-bank advancement; an unchanged gameplay bank alone does not establish renderer purity.

Original C drawing can rebuild geometry and original Lua display hooks remain partly unclassified. Native `map_to_screen` can call `game.updateFOV` while drawing when `always_show && changed`; the Lua four-site FOV overlay alone does not remove that callback. Root/mechanics audit owns the guarded map source seam and all domain/visual classifications. This deliverable makes **no render-purity, full port, full save/resume or tested publication claim**. Its actual particle simulation is effectful application visual preparation; the eventual pure Rust renderer replays prepared presentation commands.
