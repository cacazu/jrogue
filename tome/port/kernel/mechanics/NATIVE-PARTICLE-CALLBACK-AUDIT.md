# Native particle and map callback authority

Scope: pristine ToME 1.7.6 source inspection only. The parent reports actual original browser birth/initial saves succeeded; this task did not execute that runtime. These findings constrain source-stage phase separation and command capture.

## Callback ownership is concrete

The pristine `src/particles.h:43–92` `particles_type` has no `callback_L` member. Its `plist` at 106–115 stores `generator_ref`, `updator_ref`, `emit_ref` and the owning particle thread pointer. The thread owns its own Lua state at 120. Do not attribute worker callbacks to a nonexistent main-VM pointer, or replace their VM with the main game VM as an innocent platform change.

| Callback path | Actual VM/source | State authority |
| --- | --- | --- |
| `thread_particle_init()` | `src/particles.c:777`, `L=pt->L` at 779 | Loads the real particle definition and serialized args; constructs an environment against this VM's globals at 827–838; invokes it at 842. |
| `thread_particle_run()` | `src/particles.c:732`, `L=pt->L` at 734 | Looks up original updater/emit table in this VM's `__fcts`; invokes updater at 758, then updates native particles. |
| Emitter generator | `src/particles.c:594–602` | Invokes the original generator in the emitter VM to get particle fields. Native no-generator branch consumes shared SFMT at 554–589. |
| Worker construction | `src/particles.c:1038–1064` | Creates separate Lua state and opens original core/native/pre-init. RNG/native globals can still be shared; a different Lua VM does not imply separate SFMT/normal/libc state. |
| Native object display closure | `src/map.c:158–162`, `:493–506`, `:1495–1508` | `displayCallback()` stores an opaque Lua registry reference. Native drawing calls it in the Lua state used for that map call, ordinarily the real main game VM. |
| Native map z closure | `src/map.c:938–947`, `:1877–1887` | Stores/calls the original per-layer Lua closure, ordinarily `Map:zDisplay()` and its effects/particle callbacks. |

Worker args are serialized and reloaded; worker definition callbacks are not the main Lua closure from `Particles:loaded()`. Conversely, `engine/Particles.lua:53` explicitly also executes the definition in the main game VM: `setfenv(f, setmetatable(self.args, {__index=_G}))` at 70 and `f()` at 71. `self.args` is the actual Lua args table, so there can be shared references/authority. The main call occurs during creation/load and lazily through `checkDisplay():135–137`; it happens before `core.particles.newEmitter()` at 115. Native worker isolation alone does not classify this main call as visual-only. Main shader creation may execute more retained Lua definitions.

Known particle definitions consume top-level RNG in the main call: `data/gfx/particles/lightning.lua:27,42–43,46–48` and `eagle.lua:32` (see child source snapshots). Preserve the original algorithm/context and explicitly classify the invocation; do not globally route arbitrary main-Lua closures to VISUAL by their filename.

## Native second FOV call

`map_to_screen()` at `src/map.c:1780` takes `always_show` from Lua argument 5 and `changed` from argument 6. After drawing object callbacks and z callbacks, it executes a **second original FOV call** at 1922–1929 when both are true, then updates the seen texture at 1933. ToME `Game:displayMap()` supplies `smooth_fov` as `always_show`. The primary Lua FOV invocation at `mod/class/Game.lua:1857` is a separate earlier source call.

FOV can set effects, trap knowledge and combat-entry talent callbacks and consume gameplay RNG. Four Lua source seams therefore do not isolate the full render call chain. Native-tail preparation must preserve this second original operation and its ordering, not silently drop it as apparently redundant.

`make_native_map_overlay.py` emits `generated/src/map_prepared.c` with the exact original FOV body retained behind an explicit guard. In disabled baseline mode the original body runs. In enabled mode `tome_map_fov_prepared_guard()` invokes only the configured `assertNativePrepared(game,native_map)` check, requiring proof that the original operation already ran under gameplay context. Seen-texture update retains its original position. Original source SHA-256 is `7b0a56f096faad003551da02e7073948c390cf5fc6c646ac594855881ee69917`; generated SHA-256 is `4ae8b74282fc148ccefe76954eac7fc34395ad668e293719822435edc141f53f`. All replacements/suffix are independently reversible to pristine bytes.

`render_boundary.lua:prepareNativeFOV(game,epoch)` explicitly invokes unchanged `game:updateFOV()` for the original smooth/finished/changed-map condition while gameplay ownership is held, then stamps a native-tail token. It is deliberately separate from primary `afterTick()` preparation. The application must reach that source slot through segmented preparation after earlier domain callbacks. Calling it immediately after primary FOV before unclassified map callbacks is an ordering change, not demonstrated faithful behavior. Unknown receiver maps are rejected rather than given a fabricated token.

Root should replace the original map object with the generated one and include `mechanics-audit-work` for `tome_map_prepare.h/.inc`; do not link both original and replacement map objects. This task has not compiled/linked/run the source seam.

## Read-only callback diagnostics

The same append-only helper exposes native-map methods `webCallbackInventory(max_visits)` and `webCallbackRef(x,y,z,chain_index)`. They read actual stored native callback refs/UIDs without invoking a callback, FOV or RNG. Inventory scans layer/row/column/chain order with a bounded visit budget and returns callback counts, a hexadecimal FNV-1a fingerprint and `truncated`. Getter refs are opaque and process-local; they are not stable semantic IDs, functions or permissions to invoke unknown code. The C header exposes the typed summary getter for parent diagnostics.

FNV is only an accidental-change diagnostic; it neither proves no domain mutation nor supplies a security/integrity hash. Full/incomplete inventories must be distinguished by `truncated`. Root may resolve actual closure provenance through source registration/instrumentation, but diagnostics must not become a player view of hidden map contents.

## Confirmed domain effect from particle cleanup

`engine/Map.lua:606` calls native map drawing first, then `removeParticleEmitters()` at 615. That cleanup at 1435–1448 executes retained `e:on_remove()` at 1444. `displayParticles()` detects death and queues removal at 1496; the next map display flushes the callback. Zero keyframes still flush an already pending removal.

The literal callback in `data/talents/chronomancy/anomalies.lua:1956–2010` for Anomaly Meteor performs real mechanics: gameplay RNG at 1967, terrain clone/resolve/replacement at 1968–1970, temporary actors/terrain at 1980–1995, projected damage at 1998, stun at 2003 and player attribute updates at 2010. This is a concrete counterexample to labeling particle lifecycle entirely cosmetic.

The sequential native particle lane may use its distinct visual bank for proven particle generation/update. However, the unchanged `on_remove` closure and surrounding domain-owned cleanup must execute as an ordered gameplay operation at the original cleanup slot. Advance visual lifetime only once per recorded preparation/animation event; if it causes death, dispatch the original domain closure exactly once under gameplay RNG, outside visual activity. Pure Rust paint replay must never advance lifetime, repeat cleanup or invoke the closure. Do not defer all such callbacks to the end of the frame: their original slot precedes subsequent display/UI work and can affect world state observed later.

Other confirmed main-VM paths and source owners are recorded by `lua-hooks-audit-work/`. They include profile events, arbitrary UI timers/tweens, targeting coordinates, arbitrary tooltips, training-monitor state and ambient/zone callbacks. Those require separate source slots/classification; blanket redraw-in-VISUAL is invalid.
