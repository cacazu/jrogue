# Prepare once with original semantics; replay immutable display commands

This design keeps original C/Lua rules/callbacks. Rust renders a frozen presentation packet and never executes a callback, FOV, RNG or a gameplay action during repaint. It is a proposed source boundary, not an implemented full renderer or a claim of complete callback coverage.

## Separate preparation from replay, not all redraw from gameplay

Preparation is an application operation, driven by a recorded input/animation event. It can legitimately change original game state through the original callbacks identified in the audit. Replay is pure: resizing/repainting a prepared packet does not advance a timer, particle, input repeat, weather RNG, profile event or domain callback. The original baseline renderer remains available until all required capture paths are supported.

The original frame contains interleaved logical and visual operations, not one safe VISUAL invocation. For example, object/z display callbacks occur before the second native FOV; particle cleanup and its Meteor damage callback occur after native map drawing; base Game profile/timer work is called after ToME UI/map work at `mod/class/Game.lua:1964`. A preparation queue must preserve that observed source order. Moving all logical callbacks before all visual callbacks changes mechanics.

Use an ordered ledger of **explicit source segments**. Each entry has a monotonic sequence, source semantic slot, original receiver/closure identity, original argument values, bank classification and result dependency. Original callbacks execute once in that order. Domain entries retain the original closure and gameplay bank. Proven visual entries retain original visual algorithms and a separate visual bank. Unknown entries cannot receive a `pure` label or silently run in VISUAL. Callbacks whose return changes later logic must complete before dependent entries are generated/executed.

Do not replace an in-stack native callback with “enqueue and return” without preserving its result and control-flow order. Lua 5.1 cannot arbitrarily yield across existing C callback frames. Segment the original source at real call boundaries, preserving its local state/results, and invoke those segments from the application while native phase switching is legal and no outer activity is held. The guarded second FOV seam verifies such preparation; it does not implement this scheduler by itself.

In particular, do not enqueue every callback at frame end. Original `Map:removeParticleEmitters()` has its own removal/dead/array changes around `on_remove()`, and later source work observes those results. Preserve the complete original operation and relative placement. On a callback error that may have partially mutated state, stop that preparation and preserve the diagnostic; automatic retry can duplicate damage or world changes.

## Source slots that must be represented

The child ledger records additional exact source/lines. The following relative order is established by the inspected original path:

| Slot | Classification and ordering requirement |
| --- | --- |
| Recorded input/repeat -> original input/tick boundary | Original physical/virtual input and WASD key-up behavior; held-repeat delta is recorded separately in original keyframe units. Use unchanged original command/tick methods. |
| Primary FOV at `Game:displayMap` entry | Original sensing, memory, effects, combat entry and gameplay RNG; finish resulting original tick-end work before accepted state projections. |
| Level background/preparation and map object callbacks | Classify exact selected zone/entity functions. Some are visual; some have RNG or domain-owned state. Preserve original arguments/source placement. |
| Native map z callbacks | Original effect/particle/shader preparation; callback authority is the real main VM and can reach shared graph. |
| Native-tail FOV | The second original FOV call occurs after native callbacks and before seen-texture update. Its guard requires separately proved execution in gameplay context. |
| Map particle cleanup | Original removal plus `on_remove()`; Meteor demonstrates real damage, terrain and status changes. Execute once at the original slot. |
| Later map hooks/ambient/emotes/gestures | Preserve callback/source ordering; zero frame delta is not a generic purity switch. Ambient/zone RNG needs explicit bank classification. |
| Base Game events/timers/tweens | Actual profile handler and arbitrary timer/tween callbacks; dispatch their original domain operations at their source slot, not as cosmetic drawing. |
| Target/tooltip/dialog preparation | Target coordinates and arbitrary tooltip callbacks can affect shared state. Prepare text/geometry/results once; expose only accepted original visibility decisions. |

There are alternate UI/map paths, FBO and non-FBO branches, dialogs, addons and zone hooks. This table is not a complete frame DAG for all game flows. Root must retain the baseline for uncovered paths and expand the ledger through source/runtime evidence.

## Frozen packet boundary

After each ordered preparation segment produces display operations, copy their values into owned presentation storage. A packet should carry schema version, source/adapter version, packet sequence, recorded application event/epoch, start/end logical revision, asset revision and ordered render commands. Carry source/semantic text IDs plus parameters for labels; preserve external names as data. Capture original clipping, dimensions, fonts/glyph runs, positions, colors, blend/depth/FBO ordering, texture coordinates, shader uniform values and particle vertex/color/texture streams. If a native array/texture is mutable, copy or version its actual content before handing the packet to Rust.

Opaque Lua/native pointers, callbacks, borrowed C strings and mutable map/particle arrays are not an immutable packet. The Rust boundary must copy borrowed response data and retain owned buffer/asset lifetime. Capture time-dependent shader/uniform values once; replay must not query original `core.game.getTime()` or read new Lua state. A frame may intentionally show geometry prepared before a later original domain callback, as the original ordering did; the next preparation records subsequent visible changes.

Rust replay translates the packet to the browser graphics service and returns without calling original gameplay/render preparation. PC/mobile repaint, view scaling and Japanese CJK layout use captured geometry/text and separate UI state. Repeated replays may update browser/GPU resource caches, but cannot change either original gameplay graph or any original gameplay RNG bank. Visual interpolation, if supplied, is separately specified and never feeds a gameplay timer or callback.

## Quiescent checkpoint relationship

The preparation ledger must have no pending/in-flight domain callback or lifetime-triggered cleanup job at a deterministic checkpoint. Finish original input/tick/deferred effects in source order; park/account native visual jobs; then run the actual graph save and capture RNG at the same logical boundary. Save screenshots and serializer `forceRedraw()` calls must consume a prepared immutable packet or a source-classified preparation that cannot repeat domain operations. Original load reconstruction can create visual objects and invoke original callbacks; finish that ordering before validated gameplay-bank restoration and first command.

Existing source `render_boundary.lua`, native FOV guard, callback diagnostic getter and named-bank source APIs are prerequisites, not a complete implementation. No blanket `activity_begin(VISUAL); redraw_now(); activity_end()` is valid for the original call graph.

## Verification that would prove a milestone

Use the real original game/actors/VM. For a selected fully covered source path, prepare once, freeze its packet, and compare read-only semantic domain state plus complete gameplay RNG before/after many replay counts at PC/mobile sizes. Compare original source-operation ledger/results against a stateful baseline with the same recorded preparation events. Include Meteor particle death/damage/stun/terrain, smooth FOV combat-entry effects, targeting coordinates, expired timers, profile events, training monitor, ambient sounds and zone callbacks. Assert every original callback is invoked exactly once at its recorded slot and retain original error behavior. FNV callback fingerprints alone cannot prove these claims.

Save/resume tests must use original full graph serialization and source callbacks, verifying shared references/native map reconstruction and post-resume draws/commands. Diagnostics can normalize original UID remapping and documented playtime/save metadata; do not omit damage/effects/terrain/timers or hidden state to manufacture equality. Coverage must name the tested source paths and leave unclassified paths explicit.
