# Original renderer, input, and random-state separation

ToME 1.7.6 has a functioning original rendering entrypoint, but source inspection proves it is not a pure paint function. Retain it as the first real game/dialog baseline; do not advertise render purity or deterministic checkpointing until the boundaries below are implemented and tested. This task performs source-only work and makes no browser/runtime claim.

## Exact original baseline API

`src/main.h:57–64` exports `redraw_now(redraw_type_t)` with `redraw_type_normal`, `redraw_type_user_screenshot` and `redraw_type_savefile_screenshot`. `core.display.forceRedraw()` calls the normal form in `src/core_lua.c:2574`; `forceRedrawForScreenshot()` calls the screenshot form at 2580.

Actual frame path:

```text
browser/native display boundary with actual GL context
  -> redraw_now(kind)                  src/main.c:782
  -> on_redraw()                       src/main.c:710
     clear / identity / native frame clock
  -> call_draw(nb - last_keyframe)     src/main.c:652
     draw_waiting or original particle notifications
  -> registered current_game:display(nb_keyframes)
     original ToME UI / dialogs / map / tooltips
  -> original GL swap (except screenshot)
```

Use a root native ABI wrapper only after actual Lua/game/GL readiness and application reentry checks. The original engine catches/logs Lua display errors through its existing `docall` path; a wrapper's successful call alone does not prove a successful frame. Do not consume `core.game.checkError()` merely for a frame status if that would steal the original UI error report.

Direct `game:display(n)` omits native GL clearing, screenshot gamma handling, swap, frame counters, wait handling and particle notification. It is not the original frame API. Retain real measured fonts, textures, shaders and source images required by original birth dialogs/UI. Replacing these with zero-size/dummy assets breaks original layout and is not a viable baseline.

## Confirmed non-pure operations

| Source | Operation | Correct classification |
| --- | --- | --- |
| `mod/class/Game.lua:1843–1851` | Changes screen-shake state and calls `rng.range()` twice. Even zero keyframes consume RNG while shake is active. | Presentation animation and visual RNG, but original stored fields must be accounted for. |
| `mod/class/Game.lua:1857` / `:1825` | On a changed map, calls `updateFOV()` -> real `player:playerFOV()`. | Actual visibility/effect/combat preparation before snapshot; never substitute a display approximation for invisibility/ESP rules. |
| `mod/class/Game.lua:1962` | Sets `player.changed=false`. | Presentation invalidation flag. A raw graph comparison is not proof of unchanged domain state. |
| `mod/class/Game.lua:1969–1970` | Updates keyboard modifier state for tooltips. | Input/presentation state; presentation must not reinterpret unrecorded input as a simulation command. |
| `mod/class/Game.lua:1986–1990` | Decrements held-WASD timer, resets it and schedules `executeWASD()` through `onTickEnd`. | **Gameplay input scheduling from draw.** Must move to the application input scheduler with original command methods and documented timing units. RNG swapping cannot solve this. |
| `mod/class/Game.lua:1867+` | Calls level display preparation/background/foreground/weather hooks and native map display. | Arbitrary original hooks; each reachable callback needs classification. No whole-game purity coverage claimed. |
| `src/main.c:659` / `src/particles.c:1127` | Sends keyframe semaphore jobs to original particle workers. | Asynchronous presentation generation; jobs use shared native RNG today. |
| `engine/interface/GameSound.lua:42` | Selects a sound variant with original `rng.range()`. | Often called during simulation, so phase must be explicit; do not globally replace `rng` based on visual-looking function names. |

Counterexample to name-based classification: `mod/class/Game.lua:1592–1593` calls `displayDelayedLogMessages()`/`displayDelayedLogDamage()` from the original tick. Flyer RNG at 1756,1761,1763 executes there. `engine/interface/ActorTemporaryEffects.lua:153–156` also selects flyer values during effect application. Moving all these draws to a visual stream changes original simulation call order. Keep their original rule/tick ordering in the first faithful baseline; split only with explicit differential characterization and recorded behavior changes.

FOV is actual mechanics: `mod/class/Player.lua:575–577` marks traps known and remembers/updates map cells; Arcane Eye sets `EFF_ARCANE_EYE_SEEN` at 619. `playerFOV():749` calls `Actor:postFOVCombatCheck():8303`, `enterCombatStatus():8315`, and potentially `fireTalentCheck("callbackOnCombat", true/false)` at 8360–8362. `Actor:canSeeNoCache():7421` consumes invisibility/stealth RNG; `canSee():7491` caches it and updates native actor display. These calls must remain under original gameplay context, with their original methods unchanged.

## Minimal source-preserving migration seam

Keep original `playerFOV()` and `executeWASD()` implementations. Separate their scheduling from paint through a narrow source overlay with a verified reverse patch and original source hash:

1. At an accepted application command/input-repeat boundary, run required original logical FOV preparation using the original map-changed policy before taking the read-only view snapshot. Preserve all visibility/ESP/seen-map mechanics and event order. Test changes after movement, lighting, invisibility, map changes and party changes. Do not call FOV from a Rust snapshot getter.
2. Route original WASD repeat bookkeeping to an application input timer using the same original `base_cd` units and key-up/held-key policy. The recorded command/input timing determines repeats; paint count must not. Invoke the original `executeWASD()` once per recorded repeat and retain all original command behavior. Literal desktop behavior depends on frames, so this boundary changes scheduling deliberately; disclose and test it rather than claiming identical desktop draw-dependent streams.
3. Produce a read-only presentation view from logical state. Rust paint reads it and consumes its own presentation state; it does not call simulation resolvers, FOV, RNG or command methods. Retained original dialogs may continue on the explicitly stateful baseline path until their UI behavior has a real adapter.
4. Classify source display hooks and native map/particle/shader callbacks. Arbitrary addon hooks cannot be declared pure without an inventory and observed rule-state checks. Keep unclassified hooks out of any API labeled pure.
5. Only then expose a pure paint ABI and verify identical normalized gameplay graph + all three gameplay RNG states before/after repeated paints at different counts and display sizes. Do not erase changes to make the test pass.

`make_game_render_overlay.py` now emits a four-site, exact-source, reversible overlay at `generated/mod/class/Game.lua`, plus `generated/original_wasd_schedule.lua` containing the verbatim original WASD timer/scheduling block. Original source SHA-256 is `dcd6dc85d9b2cf74741e82ac9156128b782193d23a459d53f7cda324b099092a`; emitted Game SHA-256 is `f46c0e521e07d9e73f48b415af2301ac56773b79fcdecbe4553d833f7913142e`. `game-render-overlay-provenance.json` records every original/replacement anchor and proves reversal recovers original bytes. Original `playerFOV`, `executeWASD`, key-up handlers, combat/talents and simulation methods are unchanged.

The overlay is explicitly opt-in per real game instance through `render_boundary.lua`; startup/birth/dialog baseline remains original while disabled. It has not been executed here. Mounting the overlay alone does not establish purity. Root may first keep only the SavefilePipe leaf mounted, avoiding accidental early activation.

Source-stage application sequence after actual birth/load:

```lua
local make_boundary = assert(loadfile("/adapter/render_boundary.lua"))()
local schedule = assert(loadfile("/adapter/original_wasd_schedule.lua"))()
__TOME_WEB_RENDER_BOUNDARY = make_boundary.new(real_host, schedule)
-- In actual original gameplay context, after birth/load:
__TOME_WEB_RENDER_BOUNDARY:enableFor(game)

-- For each recorded application input/repeat event, still in gameplay context:
__TOME_WEB_RENDER_BOUNDARY:beforeTick(game, epoch, recorded_repeat_delta)
-- Deliver original input and run original on_tick()/Game:tick() to its boundary.
-- afterTick returns nil if FOV caused more original tick-end work; drain through
-- original ticks and retry. Never drop the pending callbacks.
assert(__TOME_WEB_RENDER_BOUNDARY:afterTick(game, epoch))
-- Read-only view may now use original accepted visibility decisions.

-- Enter the proven native presentation RNG context/worker boundary first:
__TOME_WEB_RENDER_BOUNDARY:beforeFrame(game)
-- Root native ABI calls original redraw_now(redraw_type_normal).
```

The `real_host` contract supplies actual `gameplay_phase_held(game)`, `presentation_phase_held(game)`, `simulation_revision(game)` and `visual_range(lo,hi)` services. Recorded repeat deltas are integers 0–30 in original keyframe units (native `call_draw` cap). They must come from the application's recorded input timing, never the number of paints. `beforeTick` moves only the verbatim original WASD scheduling block; original `Game:tick()` invokes its existing `onTickEndExecute()` at `engine/Game.lua:316`. `afterTick` invokes original FOV only for the original finished/changed-map condition, then stamps epoch, real monotonic simulation revision, turn, map/level/player identity and coordinates. Every logical mutation/input event must invalidate/update that host revision, including original callbacks. Frame guards read/verify the stamp and reject missing preparation. They do not clear `map.changed` or invent a visibility result.

Host must call `beforeFrame` before the native frame even for original early-return display paths. The exact overlay replaces FOV-at-draw with a prepared-state assertion, replaces WASD-at-draw with an assertion, and routes two shake draws to the retained native range algorithm on the actual separate visual context. It still changes screen-shake and presentation dirty state and invokes unclassified display hooks. Thus these four source seams are a limited scheduling milestone, not proof of whole-render purity. Faithful mechanics/order and source scheduling changes require parent runtime differential tests before enabled production use.

Further source audit found the second native FOV operation at `src/map.c:1922–1929`, after object/z callbacks. `make_native_map_overlay.py` now emits the reversible `generated/src/map_prepared.c` guard and read-only callback diagnostics with `tome_map_prepare.h/.inc`. Root must additionally call `prepareNativeFOV(game,epoch)` at that source-tail logical slot under gameplay ownership before `assertNativePrepared` can authorize the native frame. Do not just call the two FOV stages consecutively before unknown callbacks: that can change original ordering. `NATIVE-PARTICLE-CALLBACK-AUDIT.md` gives exact native ownership and source hashes.

The bounded child inventory in `lua-hooks-audit-work/` establishes additional real domain callbacks, including Anomaly Meteor terrain/damage/stun at map particle cleanup. `PREPARED-PRESENTATION-DESIGN.md` specifies ordered original preparation followed by immutable Rust command replay; it rejects a blanket whole-redraw VISUAL wrapper. The current original baseline remains the correct reference while this segmentation is unimplemented.

## Visual random streams and workers

Original native sources share SFMT and the file-scope normal cache across Lua VMs. Each particle worker opens real `luaopen_core()` (`src/particles.c:1047`) and particle emission uses native shared SFMT (`:40`, `:554–589`). It waits at 1073, processes particles while holding its per-thread lock at 1077–1104, and consumes each posted keyframe. `anims_paused` only stops future keyframe posts (`src/main.c:659`); it does not drain existing semaphore jobs. Zero keyframes also do not neutralize the Lua shake/WASD/FOV paths.

There is no existing worker park/idle acknowledgement API. A valid checkpoint barrier must stop new posts, account for pending work, wait until in-flight work is finished/parked, and prevent workers from using global RNG until the gameplay capture/restore ends. Holding a particle mutex only around the snapshot leaves pending jobs that run immediately afterward and is insufficient. Destroying particle threads would erase real visual objects and is not a quiescence operation.

For a permanent split, use separate actual SFMT/normal/libc contexts for presentation, ideally per worker; route only classified presentation consumers to those contexts. A main-thread swap of the three global components is permissible only under a proved exclusive barrier with all workers parked and all callbacks classified. It is not safe while a worker can enter native RNG or an async WFC generator can seed/run. Save the visual context separately when animation continuity is desired; it must not alter the gameplay context.

WFC seed at `src/wfc/lua_wfc.cpp:95` consumes SFMT; worker creation 132 and `getResult()` join 150 manage its own C++ generator/results. Require completed jobs before checkpoint or explicitly serialize that generator and job state; the current three-component RNG envelope does neither. Noise lazy wavelet initialization at `src/libtcod_import/noise_c.c:680` similarly must occur in a classified phase.

## Startup and screenshots

Original save screenshot (`mod/class/Game.lua:2890`, pipe 116) occurs before graph clone. Original save/load serializer functions also force redraw. `on_redraw()` always advances keyframe counters (`src/main.c:749–756`); screenshot mode only suppresses buffer swapping at 760–763. `anims_paused=true` leaves a positive Lua keyframe delta. Loading reconstructs particle/display callbacks through actual `loaded()` methods, which can perform native/shared RNG work.

Do not surround these draws with blind “snapshot RNG / redraw / restore RNG” and claim success. That leaves FOV/input/graph changes and worker races while rewriting shared random progress. Save must first have a consistent logical preparation stage, then a classified visual-only screenshot stage under the actual worker barrier. Load must finish actual graph callbacks and visual reconstruction before validated gameplay RNG restoration and first command. A fresh-process differential save/resume test is needed to prove the result.

## Current native/Rust boundary

Parent source `native-core-work/native_browser_init.c` exports init/start/last-error/snapshot/command; snapshot and command call actual `__TOME_WEB` functions. The Lua driver snapshot intentionally avoids FOV/draw/name resolvers/RNG. Returned C string storage is borrowed until the next bridge response; Rust must copy it promptly.

Current `bootstrap-work/real-core-probe.lua` command is one original virtual-key string, not a JSON object. It refuses commands while any original dialog is registered. Therefore it does not implement original birth/dialog keyboard or mouse input. Use genuine original SDL event delivery (`on_event`) with original `receiveKey`/`receiveMouse` handlers for the first baseline; keep native input polling separate from simulation stepping. The already supplied `kernel-bindings-work/retained_platform_drain.c` drains real events and calls original input, while its separate step function calls actual `on_tick()`. Root owns its runtime integration. Do not send raw browser gameplay commands past an active original dialog.

Remaining concrete work: real GL/frame export and dialog event integration; real serial browser queue pump; original worker park/idle API; FOV/WASD scheduling split with runtime differential checks; display-hook inventory; same-logical-state save/RNG capture; original loader resume; browser durable commit/error tests. None is resolved merely by the original full-C link succeeding.
