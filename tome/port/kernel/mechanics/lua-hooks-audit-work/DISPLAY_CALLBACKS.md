# Original ToME 1.7.6 display callback audit

Static source audit only. No original Lua, build, or browser execution was performed for this audit. All paths below identify unchanged retained upstream members. `E:` means `game/engines/te4-1.7.6.teae`, `T:` means `game/modules/tome-1.7.6.team`, `G:` means `game/modules/tome-1.7.6-gfx.team`, and `N:` means the native source tree. The accompanying callback JSON records edges and classifications. `source-evidence.json` retains bounded original line snapshots and SHA256 hashes of the full unchanged members used for those snapshots.

The original display entry is **not observationally pure**, including at a zero keyframe count. The most material finding is a real combat/world callback attached to particle removal. A renderer replay must not call these Lua/C display entries, even if replay supplies zero keyframes. An application-owned preparation stage must handle the original event/callback effects once **at their original ordered slots**, then produce replayable rendering data. The findings do not establish purity of all transitive methods or addon overrides.

## Preserve the original order

For the normal map branch, the concrete order is: explicit Lua FOV at `T:mod/class/Game.lua:1857`; optional FBO `display_prepare` (1869); background (1871/1894); Lua `Map:display` -> native map draw (1872/1895); foreground (1873/1897); weather (1874–1875/1898–1899); later ambient (1908), emotes (1913), and gestures (1916/1918). Native map draw contains map-object `cb_ref` callbacks (`N:src/map.c:1508`) interleaved with its ordered z-layer callbacks (1887), which invoke Lua zDisplay/visibility/particles/effects. **The second native FOV call (1922–1929) occurs after those map-object/z callbacks, before native map draw returns.** Only after that return does Lua `Map:display` invoke `removeParticleEmitters` (615), including Meteor `on_remove` combat. Cleanup then clears `map.changed` / sets `clean_fov` (619–620), and the outer game resumes foreground/weather.

The larger game display reaches UI drawing, `player.changed=false` (1962), inherited display/profile events/timers (1964), mouse/control handling (1967–1970), tooltip target writes (1975/1977), then WASD processing (1986 onward). A callback moved across these slots can change what later rendering or rules observe, what FOV includes, or which RNG values later code consumes. A generic strategy that defers all domain callbacks to the end of a frame does not preserve the original mechanics. Record ordered preparation slots and effects; preserve relative order while each original callback runs once. Separate repeated Rust draw replay from this ordered preparation.

## Simulation and command-relevant callback edges

1. **Meteor damage and world changes occur during display cleanup.** `E:engine/Map.lua:606` calls `removeParticleEmitters()` at 615. That method calls arbitrary `e:on_remove()` at 1444, removes the particle from `particles`/`z_particles`, sets `e.dead`, and clears the removal queue (1435–1448). `displayParticles()` queues dead emitters at 1496, or emitters without coordinates at 1499. A queue already populated is flushed even by a zero-frame display.

   The original main module has a concrete `on_remove` assignment in `T:data/talents/chronomancy/anomalies.lua:1956`, the Anomaly Meteor talent. The closure consumes gameplay RNG (`rng.percent`, 1967), clones/resolves/replaces terrain (1968–1970), schedules temporary lava terrain entities with energy and an `act` function (1980–1995), projects meteor damage (1998), projects stun (1999–2008), and changes the player's `meteoric_crash` attribute (2010). This is a causal simulation path, not just a stale graphics cache. The lexical main-module assignment search found this one literal assignment; dynamic/addon registrations remain possible.

2. **Profile events, timers, and tweens enter from display.** `T:mod/class/Game.lua:1964` invokes the inherited game display. `E:engine/Game.lua:194` calls `handleEvents()`, which drains `profile:popEvent()` and invokes overridable `self:handleProfileEvent(evt)` (231–237; default delegates `profile:handleEvent`, 243). This is unconditional with respect to keyframes. Display also decrements registered timer state and invokes stored `cb()` at 197–207, and calls `tween.update` at 211, when keyframes are positive. Registered callbacks and profile handlers are arbitrary application callbacks; the audit does not assume they merely paint. Dialogs `d:display()` / `d:toScreen()` (188–189) and ToME `uiset:display()` (1957) are further polymorphic entry points.

3. **Native map drawing can call back into FOV.** `N:src/map.c:1922–1929` calls global `game:updateFOV()` when `always_show && changed`. `T:mod/class/Game.lua:1872` and 1895 pass `config.settings.tome.smooth_fov` as the map display `always_show` argument. This native path is in addition to the explicit Lua `updateFOV` at 1857. Relocating only the explicit Lua call leaves this edge reachable.

4. **Tooltip display writes the current target.** `T:mod/class/Game.lua:1975` / 1977 call targeting-tooltip display. `E:engine/interface/GameTargeting.lua:67–88` assigns `self.target.target.x/y` at 84 and `self.target.old_tmx/old_tmy` at 87, without a keyframe guard. Targeting is application/game command state. `T:mod/class/Tooltip.lua:36` dispatches `map:checkEntity(..., "tooltip", viewer)` for terrain/actor/object/trap entities, and calls projectile `e:check("tooltip")` at 58. These are arbitrary entity property callbacks. `E:engine/Tooltip.lua:270–304` also mutates tooltip caches at 279, 284–285 and calls `getTooltipAtMap` at 286. Actor tooltip calls visibility/reaction APIs (`T:mod/class/Actor.lua:2009` onward); this audit does not certify their transitive purity.

5. **Ambient effects consume the shared Lua RNG.** `T:mod/class/Game.lua:1908` calls `GameState:playAmbientSounds`. `T:mod/class/GameState.lua:900–921` mutates level `_sound` state, calls `rng.chance` (906), `rng.table` (907), and `rng.float` (911) when keyframes are positive. Several original level background/foreground hooks consume the same RNG, some even when keyframes are zero; see the hook inventory below.

6. **Lazy particle recreation executes particle source in the main Lua VM.** Map-object callbacks call `Particles:checkDisplay()`; `E:engine/Particles.lua:135–137` calls `loaded()` when `ps` is absent. `loaded` loads the particle Lua source, sets its environment with `__index=_G`, and executes `f()` in the main VM (66–71), before creating the worker emitter at 115. `G:data/gfx/particles/lightning.lua` consumes RNG in its top-level initializer at 27, 42–43, and 46–48. `G:data/gfx/particles/eagle.lua:32` consumes RNG at top level if `size` is a table. This is distinct from the native particle worker's separate VM update/generator callbacks. Keeping worker callbacks isolated does not remove the main-VM lazy-initialization edge.

## Native and entity map callback registrations

`N:src/map.c:506` and 1508 invoke stored map-object `dm->cb_ref` Lua callbacks. The former passes `(dx, dy, dw, dh, 1, false)`; the map-grid draw path passes `(dx, dy, scaled_tile_w, scaled_tile_h, scale, true, tldx, tldy)`. `N:src/map.c:1887` invokes registered z callbacks with `(z, nb_keyframes, prevfbo)`. These callbacks run on the main VM and are not confined to native paint operations.

`E:engine/Map.lua:278–282` registers a z callback that calls `self:zDisplay(z, nb_keyframes, prevfbo)`. `zDisplay` (624–628) calls `calcEffectVisibility`, `displayParticles`, and `displayEffects`. `calcEffectVisibility` writes `e.seen_grids` / `e.seen` (1191–1192). `displayEffects` creates shader texture caches and animation counters (1215–1227), updates `cnt` (1246), and advances `cur` (1249). These are original level/map state writes, even if some are purely visual in intent. Actual effect damage/duration processing lives separately in `processEffects` (1258 onward).

Concrete registered map-object closure families:

| Original member and registration | Observed callback behavior |
| --- | --- |
| `E:engine/Entity.lua:339–354` (also nested display 441–445) | Particle `checkDisplay`, `shift`, `toScreen`, removal. Lazy recreation can enter source/RNG as above. `shift` writes `_adx/_ady` (`E:engine/Particles.lua:153`). |
| `E:engine/Actor.lua:206`, 212, 216 | Tactical frame and particle callback family; dynamic actor methods remain overridable. |
| `T:mod/class/Actor.lua:1369`, 1376, 1381 | Tactical helpers (1299–1320), front particles (1322–1344), back particles (1346–1366); lazy textures, `checkDisplay`, particle shifting/removal. |
| `T:mod/class/FortressPC.lua:101`, 103 | Particle callbacks, including lazy `checkDisplay` and removal (87–98). |
| `T:mod/class/WorldNPC.lua:81` | Tactical helper calls (88/91) and particle `checkDisplay`/`shift`/removal (99–107). |
| `T:mod/class/WildernessGrid.lua:35` | Entrance glow `checkDisplay`, `toScreen`, and removal (38–40). |
| `T:mod/class/StellarBody.lua:45` | Reads `level.data.frames` (47) and paints a sphere; no direct gameplay mutation/RNG observed in that closure. |
| `T:data/zones/shertul-fortress/grids.lua:34` | Energy monitor reads quest energy and updates captured cached texture/frame state. |
| `T:data/zones/shertul-fortress/grids.lua:291` | Training monitor writes `game.zone.training_dummies.last_turn` (295), `changed=false` (300), and `damtypes.changed=false` (310), as well as texture/frame caches. |
| `T:data/zones/shertul-fortress/grids.lua:373` | Mirror calls `player:toScreen(..., false, false)` (376), suppressing nested callback/shader flags; `Entity:toScreen` still calls `getMapObjects` (716), so lazy map-object preparation remains possible. |

`T:mod/class/Actor.lua:smallTacticalFrame` (1009 onward) and `bigTacticalFrame` (1193–1274) read reaction/life state and build cached textures. Big frame dynamically calls `map:faction_danger_check` at 1255/1258; its original main-module definition is a rank-only predicate (`T:mod/load.lua:43`). No direct command/RNG call was observed in these tactical bodies. This does not certify addon overrides or transitive entity APIs.

Map-object creation is itself an extensibility seam: `E:engine/Entity.lua:384–391` uses property `check` calls, texture functions are invoked at 452/479, `alterMakeMapObject` is invoked at 487, and `Shader.new` at 491 can lazily execute Lua shader source. `getMapObjects` updates `_mo` / `_last_mo` and defines callbacks at 531–540.

## Level hooks, weather, gestures, and emotes

`T:mod/class/Game.lua:1869` invokes arbitrary `level.data.display_prepare(level, dx, dy, nb)` in the FBO path only. Background is invoked at 1871/1894, foreground at 1873/1897, and weather/weather-shader at 1874–1875/1898–1899. The static main-module scan found no literal `display_prepare` definition and 34 active `background=function` / `foreground=function` definitions (plus one commented test-zone hook). Dynamic assignments and addons are not excluded.

Observed level-hook families with gameplay RNG or shared-state writes:

| Original hook | Observed effects |
| --- | --- |
| `data/zones/abashed-expanse/zone.lua:243`; `data/general/events/fearscape-portal.lua:109` | Sphere rotations written at 272–273 / 138–139. `rng.float(...) * nb` is still evaluated at `nb=0`. |
| `data/zones/tempest-peak/zone.lua:78`; `data/quests/lightning-overload.lua:121`; `data/general/events/thunderstorm.lua:27` | Unguarded lightning `rng.chance` / `rng.range`, particle creation, sound. Thunderstorm chains the previous background callback at 36. Particle lightning initializer also consumes main-VM RNG. |
| `data/zones/trollmire/zone.lua:137`, 265 | Foreground particles; random sound guarded by positive keyframes at 142/270. |
| `data/zones/town-derth/zone.lua:75`; `data/zones/town-irkkk/zone.lua:62`; `data/zones/south-beach/zone.lua:60` | Positive-frame guarded spawn RNG, writes level bird/eagle particle fields, creates particles, clears dead particle fields. Removal branches are not all guarded by positive frames. |
| `data/zones/stellar-system-shandral/zone.lua:56` | Increments `level.data.frames` at 57; stellar map-object callbacks read that counter. |
| `data/zones/scintillating-caves/zone.lua:81`, 162; `data/zones/dreamscape-talent/zone.lua:51`; `data/zones/sludgenest/zone.lua:150` | Reads wall clock and writes native map shown/obscure tint state (`setShown`/`setObscure`). |

The remaining original hooks paint particle/shader backgrounds, update shader uniforms, chain an old foreground (snowstorm), or are empty. Their exact registrations are retained in the JSON. None is assumed pure merely because its direct body paints.

Weather particle display ignores its keyframe argument: `T:mod/class/GameState.lua:941–946` calls `ps:toScreen(dx,dy,true,1)` at 944. Weather shader display updates uniforms at 964 and renders (956–970). Main-VM particle initialization and worker advancement are separate effects to account for.

`E:engine/Gestures.lua:235–241` checks wall-clock timeout and resets expired gesture state. `display` (243–271) updates fade state at 265/267. The actual command-producing `useGesture` (189–192) invokes the bound function; the default binding calls `triggerVirtual` at 72. Neither inspected `update` nor `display` invokes `useGesture`, so a command from a gesture during those methods was **not** established.

`T:mod/class/Game.lua:1913` calls `map:displayEmotes(nb_keyframe or 1)` using singular `nb_keyframe`, while the function parameter is plural `nb_keyframes`. Ordinarily the singular global is absent, so the display call advances emotes by one even when the supplied plural count is zero. `E:engine/Map.lua:1553` calls each emote's `update`, sets `dead` at 1555, and removes expired entries at 1562. Original `E:engine/Emote.lua:59–62` decrements duration. This is presentation lifecycle state, not proven arbitrary gameplay commands for the original Emote implementation. Separately, `E:engine/Map.lua:607` assigns the plural global `nb_keyframes` even though that function parameter is singular; this is another actual global write.

## Shader source callbacks and limits

`E:engine/Shader.lua:88` evaluates function-valued shader constructor arguments. `.shad` lazy access executes `loaded()` (72–79), which executes the Lua shader source (`f()`, 189) and calls `resetargs` functions (223). A static scan of all 79 original `G:data/gfx/shaders/*.lua` members found 28 function definitions: 27 clock reads via `core.game.getFrameTime` or `getTime`, plus `boneshield.lua:31` reading `self.args.chargesCount`. No literal `rng.` calls were found in those 79 shader files. This is a bounded original-source observation, not a proof for arbitrary constructor argument functions or replacements. No per-frame Lua callback edge was found in the inspected native shader source; the confirmed Lua callbacks occur at construction/lazy loading/reset.

Recommended verification boundary: snapshot domain/RNG plus target/event queues before and after each ordered preparation slot; explicitly exercise a pending Anomaly Meteor removal, smooth-FOV changed-map draw, tooltip target motion, lightning hooks, lazy particle reload, timers/profile events, emote expiry, and the fortress monitor. Verify native second-FOV-before-Meteor-cleanup order explicitly. Replaying the resulting Rust rendering data must avoid the original Lua/C callbacks entirely. This audit supplies source evidence; it does not claim these regression cases have been executed.
