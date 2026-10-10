# Original native map command capture candidate

This isolated source milestone observes genuine original map preparation. It copies the original native geometry before its scratch buffers are overwritten. It does not reconstruct actors, substitute ASCII, repeat rules, return rendered pixels, or claim a complete renderer. No compiler, Lua/native runtime, browser or Rust replay was executed for this candidate.

## Why capture at emission

Original `engine.Map:updateMap` creates a local `mos` list, applying original trap knowledge, actor invisibility, ESP and display replacements, then passes it to native `_map:setGrid`. There is no complete Lua per-cell prepared draw list in this inspected path. Generic and genuine ASCII modes use different selected layer stacks. Raw `map.seens` contains assembled numeric sight/ESP/dynamic-light results; `map.lites` alone omits dynamic illumination. Default and ESP actor cache keys differ. Reconstructing from gameplay map tables would lose these decisions.

`src/map.c:1863–1872` selects the accepted native object stack, then unchanged `display_map_quad` computes actual movement/animation/tint. `do_quad:1464–1487` fills vertices/UV/colors, and `unbatchQuads:1429–1433` draws and resets scratch indices. The existing arrays are reused, so reading them after a frame would recover only residual contents. The candidate records actual per-quad source layer/cell at append and copies whole original batches immediately before their original GL draw. It reads real GL matrices/viewport/scissor/blend/binding state, and copies the real CPU seen-texture cache after the original native map call's FOV slot. No new visibility computation occurs.

The observer preserves original object/z callbacks, original FOV and original GL calls, including their ordering and original error handling. Source markers surround those original callback slots; their foreign GL output is explicitly missing. The source-selected quad metadata also handles batches spanning multiple layers. No callback/UID pointer is exposed as permission to invoke code, and no hidden gameplay-grid scan is performed.

## Exact variant integration

Use a **separate capture build** so default milestone artifacts/hashes remain unchanged. Parent owns compilation and tests. Apply/reuse the baseline's actual include/define/SDL/OpenGL/libpng flags, Lua interpreter and original dependency objects; this candidate introduces no additional system library.

1. Run the Python source generator, or use its frozen output. Replace only the original `src/map.c` translation unit with `generated/map_capture.c`. Do not link both original and replacement map objects. Add this folder to the C include search path.
2. Compile and link the additional `tome_prepared_map_capture.c` and `native_prepared_map_exports.c` against the original headers, original native main accessor and existing `save-resume-work/checkpoint_gate.h/.c`. Retain every other original C/Lua unit. `QUAD_CAPACITY=5000` matches pristine `map.c:705` exactly. Install and Begin reject an already held save/resume exclusion, including the direct native-map Begin method.
3. Export the eight names below in addition to the variant's existing baseline ABI. Existing original `tome_native_init/start/draw_baseline` remain unchanged.
4. Mount only `original-map-packet.lua` at `/adapter/original-map-packet.lua`. No loader source overlay, Game scheduling overlay or broad generated-root mount is required. Native map methods are registered by the replacement C unit. Install the additive Lua adapter in the **current actual main VM**, after original init/start/birth.

```text
tome_native_prepared_map_install             number(),1success
tome_native_prepared_map_begin               string(number_epoch,number_byte_budget)
tome_native_prepared_map_seal                string(number_epoch)
tome_native_prepared_map_status              string()
tome_native_prepared_map_release             string()
tome_native_prepared_map_packet_ptr          number(),borrowedCpointer
tome_native_prepared_map_packet_size         number(),bytecount
tome_native_prepared_map_last_error          string()
```

The generator accepts `--input <parent-composed-map-source>` for composition with separately reviewed native seams, checking exact remaining anchors and reversing its own additions to recover the input bytes. It adds observation only; it does not activate the earlier FOV relocation or move any callback into the visual bank. The pristine original member SHA256 is `7b0a56f096faad003551da02e7073948c390cf5fc6c646ac594855881ee69917`; generated source SHA is recorded in `map-capture-provenance.json`.

Use one host-exclusive **whole preparation operation**, not a lock released between individual native calls. First settle pending original tick-end/coroutine/serial work through the existing retained original tick-settle path to paused+enoughEnergy+no pending callbacks. This settling belongs to the same application preparation lease; do not relax Begin, clear queues, directly invoke deferred callbacks, or dispatch new input meanwhile. A currently held save/resume generation gate is a conflict, not a map-preparation lease: existing `draw_baseline` rejects it. A future native preparation mode/internal frame route is a separate integration seam. On partial original failure, retain the host failure hold and stop the instance; do not release into ordinary commands.

Example host sequence, after original settling inside that exclusive operation:

```js
if (module.ccall('tome_native_prepared_map_install','number',[],[]) !== 1) throw new Error('install failed');
const epoch = recordedApplicationEventEpoch;
const started = JSON.parse(module.ccall('tome_native_prepared_map_begin','string',
  ['number','number'],[epoch,16*1024*1024]));
// ONE genuine original baseline draw, using original GL context and original
// preparation ordering. It can have the documented original domain effects.
module.ccall('tome_native_draw_baseline','number',[],[]);
const sealed = JSON.parse(module.ccall('tome_native_prepared_map_seal','string',['number'],[epoch]));
const ptr = module.ccall('tome_native_prepared_map_packet_ptr','number',[],[]);
const len = module.ccall('tome_native_prepared_map_packet_size','number',[],[]);
if (!ptr || !len || sealed.full_renderer_ready) throw new Error('invalid candidate state');
const owned = module.HEAPU8.slice(ptr,ptr+len); // Copy before another native call.
module.ccall('tome_native_prepared_map_release','string',[],[]);
// Rust may validate/store owned as a diagnostic command packet. Its production
// renderer MUST reject the explicit incomplete resources/foreignGL/state gaps.
```

This is an actual call recipe, not a tested program. The existing baseline draw return is not by itself proof that the original Lua frame succeeded. Parent must also verify original frame error reporting without consuming the game's error dialog. Begin requires the original paused/living/energy-ready player, no dialog or pending tick-end work. It holds the actual original game/world/level/Lua map/native map/player identities outside the save graph. Exactly one original native `map_to_screen` must enter/return. A natural FBO cache hit or another display path can skip that call: reject this unsupported capture attempt; do not set `map.changed` or manufacture an extra frame to force success.

If original unprotected native-tail FOV throws, Lua can unwind past the observer leave hook. Missing return/depth cannot be treated as a sealed packet. **That preparation attempt is terminal for this candidate VM/WASM instance.** Stop and preserve original error evidence; use a fresh instance. No callback retry, queue clear, domain rollback or blind post-unwind depth reset is provided. Successful release discards only owned observer bytes after sealing and preserves original game state.

## Typed bytes, ownership and conservative gaps

`packet-schema.json` specifies explicit little-endian fields; no raw C structs/pointers cross the interface. Header is 64 bytes, record prefix 16, batch payload 216 plus actual float arrays and 12 bytes per source quad, and seen payload 16 plus actual BGRA bytes. Event sequence follows original batch/callback/FOV slot order. Source quads include the original selected mode's native z and original cell coordinates. Native texture/program/framebuffer IDs are process-local resource identifiers, not asset URLs or immutable leases.

Seal freezes owned bytes. The binary getters read only that owned buffer and current main-state identity; they invoke no Lua, draw, RNG, FOV, name resolver or gameplay query. Metadata status reads actual lifecycle fields and the pure original tick-end existence accessor. Host copies both metadata and binary buffers immediately. Binary storage is valid until the next successful begin/release; JSON has separate storage replaced by the next successful metadata call. A single host must serialize all native calls and keep the original SDL/display loop from independently preparing frames. Direct C getters require the current baseline lifecycle: one original VM initialization per modularized WASM instance, and a fresh WASM instance for reset/resume. They have no independent VM-generation token; closing/recreating a VM in the same native instance could reuse a state address and expose an old packet. That unsupported lifecycle must first gain explicit invalidation/generation checks before production use.

The packet always sets missing-resource-leases and partial-GL-state flags and returns `full_renderer_ready=false`. Shader uniform/sampler gaps, foreign object/z callback rendering, client-array mismatches, budget/finite errors and lifecycle problems add explicit bits. Missing/error conditions never create fake geometry, silently filter commands, run another frame, or report a production-ready renderer. The parent must validate real GL queries under its legacy-GL WebAssembly variant; this source stage cannot establish their support or performance.

## Concrete next production boundaries

The captured regular native map batches are a real first segment, not the complete ToME frame. Capture immutable texture creation/upload/deletion versions (including native seen-mask revisions and FBO attachments), actual shader code/uniform/sampler/time values, all required GL state, enclosing map FBO/compositor/seen-overlay/gridline draws, and original particle/foreign callback geometry. Arrays/resources must be copied or held by real versioned leases before Rust accepts them. Current shader/FBO cache IDs and one final CPU seen buffer are insufficient for historical resource versions consumed earlier in the same frame.

Keep original effectful preparation separate from pure replay. Object/z callbacks precede native-tail FOV; later Lua particle cleanup can perform Meteor terrain/damage/stun; foreground/weather/UI/timer work follows. A later snapshot of map caches cannot reconstruct an earlier command's state. Preserve source slots, callback results and any original mutations once. Unknown callbacks remain original gameplay authority until explicitly classified; a blanket VISUAL redraw remains invalid.

Live particle continuation also needs original emitter/worker Lua state, particles, deferred-death queue and original on_remove lifecycle ownership, with named RNG banks and a real worker barrier. This byte packet is neither those saved objects nor their serializer. Pure replay must never advance particles, dispatch Meteor cleanup, sample native time or execute callbacks. Default full saves/resumes and their verified baseline remain separate from this isolated observer experiment.

Parent acceptance should compare captured batch arrays/layers/ordering against the real original map call, verify repeated packet getters and Rust replay leave full original state/RNG unchanged, check invisibility/ESP/dynamic light/memory/ASCII mode, and reject deliberately incomplete foreign shader/particle paths. Compile/runtime/browser and CJK/full-game claims remain pending.
