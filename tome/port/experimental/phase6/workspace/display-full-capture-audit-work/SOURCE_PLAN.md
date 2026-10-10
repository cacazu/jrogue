# Complete original-frame capture: concrete source plan

This is a source-only audit of ToME/T-Engine 1.7.6, commit
624a67329fe2ad440c5b344785a9c73fcf22ae63. It changes no upstream source, existing
observer, default native build, Rust crate or shared checkpoint. The resource
contract is a reviewed draft, not an implemented renderer or an accepted packet
schema. Full renderer readiness remains false.

The smallest faithful seam is a hybrid whole-frame observation boundary: copy
actual original native client arrays at every original draw before legacy SDK
conversion, and retain the actual context's resource/program/pass state and
consumed draw stream. A map-only packet cannot cover original UI, foreign
callbacks, particles, FBO composition or cached texture producers. A context-only
packet may replay a faulty SDK conversion faithfully while failing the upstream
array contract. The two streams need an explicit verified association.

## Exact source boundaries

All original locators below are retained with full-member SHA256 and bounded
excerpts in source-evidence.json. The selected native members expose 68 lexical
GL function names in native-gl-callsite-inventory.json; this is an inventory,
not proof that every API or rendering mode ran.

| Boundary | Actual source anchors | Capture requirement |
| --- | --- | --- |
| Ordinary map geometry | src/map.c:1429-1438,1464-1489,1780-1937 | Copy original batches at emission, keep source layer/cell order and the original callback/FOV ledger. |
| Map object/entity texture output | src/map.c:408-654 | Capture float3 positions, GL_QUADS, additional texture units, nested callbacks and offscreen output. |
| Original UI and arbitrary vertex buffers | src/core_lua.c:1640-1774,1844-1923,2080-2297,3450-3492 | Capture every native draw; source stack arrays are overwritten between calls and may retain the same address. |
| SDL/font/ASCII texture bytes | src/core_lua.c:245-320,886-927,1926-2078 | Copy bytes during real upload before surfaces are freed; retain source format, stride/unpack and accepted normalized bytes. Font rasterization remains original. |
| CPU seen and minimap texture revisions | src/map.c:671-703,1175-1304,1314-1359,1971-2091 | Capture each real upload version at its source slot. A final BGRA cache cannot recover an earlier read. |
| 3D noise resources | src/noise.c:240-304; src/map.c:452,613,1601,1645,1730 | Preserve original GL_TEXTURE_3D bytes/depth/parameters and sampled target. Unsupported profile is a concrete rejection, never a 2D substitute. |
| Particles | src/particles.c:343-529 | Freeze produced geometry at draw: float positions/colors and GL_SHORT UVs; preserve blend mode, chunk first/count, transforms and original source slot. |
| FBO resources and composition | src/core_lua.c:2713-2990 | Record creation/deletion, attachments, draw buffers, clear/load, view/projection, sampled attachment versions and ping-pong ordering. |
| Temporary FBO texture rendering | src/core_lua.c:2421-2528; src/map.c:535-654 | Raw binds bypass gl_c_fbo; capture actual bindings, not only cached IDs. |
| Programs/effective uniforms | src/shaders.c:35-79,82-215,223-246,349-506,508-656 | Freeze actual shader/link resources and effective uniform state per draw, including samplers and actual tick values. |
| Whole original presentation order | src/main.c:668-773; mod/class/Game.lua:1838-1993 | Enclose the original redraw, UI, map, weather, targets, dialogs, tooltip and final full-FBO composition. |

Existing authored seams remain useful but incomplete. The map observer at
mechanics-audit-work/prepared-map/tome_prepared_map_capture.c:112-136 records
matrices/viewport/scissor/blend plus raw numeric names; :125 flags uniforms
missing and :202 sets resource/state gaps. It must retain those flags. The
graphics adapter at build-plan-work/graphics-adapter/tome_graphics_adapter.c
already hooks GLctx texture allocations, including SDL/JS uploads, and its
upload2d path copies and normalizes actual RGB/BGR/RGBA/BGRA bytes. Extend a
separate variant at that actual context boundary, preserving its existing
semantics and state restoration.

The current native adapter creates/makes the context current at
native-core-work/native_browser_init.c:79-83, before original resource creation.
A new ledger installation belongs immediately after that actual make-current
and before GLEW/original setup. Its current baseline sets fbo_active,
multitexture_active and shaders_active false at :89-91; successful baseline
frames therefore do not validate full shader/FBO/3D capabilities. The original
draw export at :191-196 calls redraw_now once and already states its original
side effects. A separate full-capability variant needs actual capability
verification; it must not simply set unsupported flags true.

## Immutable commands and resources

frame-capture-contract.json enumerates the exact minimal ownership/state set.
Use context generation plus object generation plus revision; native GL names
and cached handles are only provenance. Store source/native and accepted WebGL
program identities separately. Every draw refers to immutable texture content,
program-link/effective-uniform, vertex-input and render-target revisions.
Uniform locations must resolve through the captured program generation and
name/array/type reflection rather than portable numeric locations.

Record original source topology and typed client arrays, including first/count
and enabled-array/current-value semantics. Float2 map vertices are one case:
entity texture draws use float3 and particles use short UVs. Track actual native
client-pointer setter submissions independently of the tgl cache; direct
glVertexPointer/glColorPointer/glTexCoordPointer also occur. Record native
transforms or equivalent accepted uniform values exactly. Associate each native
draw with its actual SDK/context draws and validated type/topology conversion.

Observe actual accepted uniform values without consuming the original GL error
queue. Shader clones share a GL program (shaders.c:182-215) but have independent
reset lists. useShader writes tick/color/coordinates, then traverses reset nodes
(35-79); prepending duplicate nodes makes older writes execute later. Fast
vec3/vec4 source setters call glUniform2fvARB (469,488), and the scalar-array
setter indexes is[i*4] (235-239). The capture must reflect the actual accepted
state; rebuilding intended Lua values or fixing these source quirks would alter
semantics. Time-derived uniforms are frozen preparation values, not a new
renderer time sample.

Texture versions may use bounded immutable base bytes plus ordered subimage
patches; no need to duplicate an unchanged image for every draw. FBO versions
may retain a verified pure producer-command dependency graph. Clear coverage
and predecessor contents must be explicit: allocation with null bytes or a raw
live texture is not an assumed immutable image. Retain all sampled units,
including FBO multiple attachments and noise textures. Copy any input bytes
before their original native owner can free or overwrite them.

Capture effective blend/depth/stencil/color masks, viewport/scissor/depth range,
cull/sample/polygon state, target attachment/draw-buffer state and all vertex
inputs used by the active program. Maintain an explicit supported-class set.
Unknown resource formats, uniforms, targets, extensions, source uploads or
raster classes produce a concrete incomplete reason. Do not silently omit them
or declare completeness from caller flags.

## Cache-hit continuation

The actual unchanged-map branch is not a native-draw cache hit.
engine.Map:display calls toScreen at :611, removes particle emitters at :615,
then returns at :618 if unchanged. Native map_to_screen has no FBO-cache early
return. Its scroll/animation/callback/FOV work still belongs to one original
preparation. Zero batches alone proves neither a valid cached image nor a
successful whole frame. Never set map.changed to force a new capture.

Genuine cached producers include engine.Dialog:display:219,
ActorsSeenDisplay:84, HotkeysDisplay:92, HotkeysIconsDisplay:135, and
Entity:getEntityFinalTexture:662-680. Retain a context ledger through original
boot, commands and frames so an unchanged producer can supply the exact
previously captured texture/content revision. Capture the consumer's newly
emitted geometry and current uniforms/state. Do not call its old producer,
drawDialog, getMapObjects, FOV, RNG or any Lua callback again to fill a gap.

If recording starts after a resource was created and a first cache hit has no
owned history, reject the frame with missing_resource_revision. It can be
seeded only through an independently verified resource-bootstrap snapshot, or
a fresh original instance with capture installed before creation. A renderer
replaying a sealed packet initializes its private resources from immutable
predecessor bytes/commands, not from an arbitrary later mutable GPU state.
Native deletion/handle reuse leaves owned old revisions valid until all packet
dependents and renderer-private platform fences retire them. Size limits and
retirement policy must bound retained history rather than evict a still-needed
revision silently.

FBO/resource writes outside map batches remain ordered: Game.displayMap calls
level preparation/background, native map and effectful z callbacks, then
foreground/weather; native-tail FOV precedes Lua particle-removal flush;
posteffects/target/emotes/UI/tooltip/full-FBO work follows in original order.
Meteor on_remove can affect domain state. The observer records that original
execution once; Rust replay dispatches only owned commands and invokes no
original lifecycle cleanup.

## Bridge fidelity gate

The Rust UI owner identified a source-grounded pinned-SDK hypothesis:
libglemu.js:2896 can skip planar recopy when modifiedClientAttributes is false;
:2955-2996 rewrites pointer descriptors to restrided data. Original tgl caches
CPU addresses while UI arrays can be rewritten at the same stack address.
The proposed fresh-VM refresh/restoration candidate is separately staged in
rust-platform-input-work/audit-new and is not causally verified by this audit.

Do not label consumed context geometry as correct original geometry solely
because it replays. Retain native source-array hashes/typed values, the accepted
context buffer/attribute representation, program mappings, the exact pinned
SDK/candidate hash and their validated association. Until the parent establishes
that relationship on actual UI/map/particle frames, native-to-WebGL fidelity is
an explicit readiness gap.

## Synchronous replay ownership proof

Native SDL redraw/realtime timer callbacks can legitimately write event queues,
stack/pending fields while a host awaits fetch or hashing. A whole-heap comparison
across such an asynchronous gap does not isolate renderer writes. Keep native
and Rust WASM memories separate and unshared, prepare all resource bytes and
Rust code before the comparison, then bracket only synchronous Rust replay with
host byte copies of native memory. No await, fetch, hash callback, original
native diagnostic call, timer pause, event mask or rollback belongs inside that
bracket. Main/native timer activity outside it remains original dispatcher work.
A shared-memory/worker variant needs its own real ownership proof; browser
single-thread execution is not a general worker barrier.

## Staged integration owned by the parent

1. Resource/bootstrap variant: install a per-context ledger before original
   resources exist. Observe uploads, parameters, program sources/link/uniforms,
   buffer inputs, target attachments and deletion. Preserve normal original
   calls exactly once. Seal owned resource versions; getters only read sealed
   buffers. Cover typed-array and actual SDL/JS paths, 2D/3D classes and budgets.
2. Draw/frame variant: extend the native draw/client-array wrappers outside
   the old TMP1 map protocol and enclose one complete original redraw in the
   same command/turn exclusion. Capture all foreign, particle and UI draws and
   all ordered passes/state. Keep original callback markers as diagnostics;
   their output is ordinary captured commands, never callback permissions.
3. Pure Rust presentation boundary: decode an owned validated frame plus its
   immutable resource dependency set. Keep platform resource creation/drawing
   behind adapters. Reject unknown or missing classes. Repeated replay restores
   the packet predecessor state and cannot call the original VM, time or RNG.
4. Parent actual acceptance: compare original typed arrays to accepted bridge
   data and the Rust result across map visibility/ESP/memory, ASCII/images,
   smooth scrolling, dialogs/CJK/tooltip, cache hits, FBO multiple passes,
   shader clones/reset uniforms, seen-mask revisions and particles/weather.
   Check full original graph and all actual RNG banks before/after repeated
   replay. Test natural missing-resource, allocation-budget, deletion/reuse,
   context-loss, lifecycle changes and original partial failures. No callback
   retry or changed-flag forcing is a valid recovery.

A complete reversible implementation touches native draw/client-state wrappers,
the context resource ledger, frame/lifecycle exports, typed owned packet
validation and renderer-private platform resources. That is not a safely small
patch. This task deliberately stages the concrete source plan and contract
instead of adding stub hooks or clearing TMP1's mandatory gap flags. The parent
controls all actual compilation/browser work and fresh variants.

The first source-evidence collection ran as a bounded read-only data scan under a
64 MiB V8 heap cap, sampling 66,109,440 bytes RSS. It ran no original game/GL,
tests, build, browser or shared staging operation.
