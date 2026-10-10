# Prepared native map packet source review

Reviewed statically on 2026-10-02. No compiler, Lua execution, native game, WASM, or browser was run for this review. This is an incomplete geometry observation candidate; it is not evidence that a full original renderer or pure simulation/presentation boundary is ready.

## Exact reviewed revisions

Paths below are relative to `mechanics-audit-work/prepared-map/`; hashes are SHA-256 of complete file bytes.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `tome_prepared_map_capture.c` | 12410 | `1377013ef425ff2a9f36a1ccf1936ed62932280b414abf8fbc2bab8187311f29` |
| `tome_prepared_map_capture.h` | 1753 | `8cbf365b06a316b4c63648ded390f773ea1e1e54d1c95090e63d00b13f44374c` |
| `generated/map_capture.c` | 65113 | `3936536c16b1220357ad00417653b331003c71c34a2e798dfb2e8d283580ddc1` |
| `original-map-packet.lua` | 4085 | `248d3562728d0d8fdfd1b4c843eb3a766940445dd2ccad5d00838aec8ad614ac` |

The generated file was compared with the unchanged retained upstream `src/map.c`, SHA-256 `7b0a56f096faad003551da02e7073948c390cf5fc6c646ac594855881ee69917`. The diff contains the capture include, map-close notification, batch/quad/callback/FOV/lifetime observations, and five Lua method registrations. It does not reorder the original draw, callback, or FOV operations. Hashed original Lua excerpts and lifecycle analysis are in sibling `source-evidence.json` and `PREPARED_MAP_READS.md`.

## Required lifecycle contracts

1. **An original preparation that throws or fails to return exactly once must terminate that WASM/VM lifetime.** The original unprotected `lua_call` in the native FOV branch (`src/map.c:1922–1929`; generated `map_capture.c:1935–1947`) can unwind past `tome_prepared_map_leave`. Capture then retains nonzero depth. C abort refuses nonzero depth (`capture.c:231–234`), seal requires exactly one native return (`201–205`), and the Lua gate exposes release only after sealing (`original-map-packet.lua:72–76`). Retrying the draw or resetting the gate would repeat stateful callbacks without proof of which operations completed. The integrating application must treat missing successful Lua-frame return, missing native return, or any original preparation exception as terminal; it must not retry preparation or reuse that VM. A native `returned==1` alone is insufficient: Lua cleanup, foreground/weather, and the rest of the original frame still run after native return and can throw. The current baseline redraw does not supply a structured successful-Lua-frame proof; supplying and enforcing that proof is a concrete integration requirement.

2. **The borrowed C accessor needs an application lifetime/epoch guard.** `tome_prepared_map_packet` (`capture.c:236–238`) checks only sealed state and equality of the `lua_State *` address. It does not check expected epoch, map identity, or VM generation. Static capture state is not invalidated by Lua VM teardown, and `closed` marks only an active preparation (`153–155`). A later VM allocated at the same address can therefore satisfy the direct accessor's owner test before beginning a new operation. The Lua `M.bytes` path has its separate operation/identity checks and is not the same exposure. The host must invalidate access when the owning VM ends and validate its expected epoch/generation before reading or copying this direct C result; otherwise the API needs a corresponding explicit lifetime argument/invalidation path. Borrowed bytes must be copied before a successful new begin or abort, as documented in the header.

3. **Sealed does not mean complete or acceptable for publication.** Seal writes a packet even when lifecycle, callback, array, nonfinite, or overflow flags are present (`201–214`). The consumer must reject those failures and must inspect final header flags, not only the flag value captured inside an earlier batch. Resource leases and partial GL state are always flagged at begin (`198`), so even a successful capture explicitly remains unsuitable as a complete renderer. C status and Lua status both report `full_renderer_ready=false`.

These are integration requirements for this source candidate, not promises of ordinary recovery after failed gameplay callbacks. No runtime recovery was attempted or validated.

## Observation order and visibility meaning

The quad hook runs after the original geometry/color arrays are populated and before the vertex count advances (`generated/map_capture.c:1491`). Batch observation runs immediately before the unchanged `glDrawArrays` and before scratch offsets reset (`1432`). Map-object callback markers follow the original batch flush; z-callback markers likewise follow the layer's batch flush (`1500–1518`, `1890–1902`). They preserve the exact foreign callback slots and do not capture foreign GL commands emitted inside those callbacks.

The native FOV markers remain after all ordinary layer and z-callback work (`1935–1947`). The existing CPU seen-texture bytes are copied at native leave (`capture.c:162–173`), after that conditional FOV/update-seen-texture branch. Native return is still followed by original `engine/Map.lua:615` particle removal and its arbitrary `on_remove` callbacks, then `changed=false`/`clean_fov=true` at 619–620, and later Game foreground/weather work. In particular, Anomaly Meteor's original cleanup callback can perform RNG, terrain/entity changes, damage, and stun. None of those operations may be deferred to the end as a substitute for their original slot.

Consequently the packet's batch geometry is what was emitted before the second native FOV, while its seen bytes are the existing cache after that branch and before Lua removal callbacks. These are deliberately different source-order observations. Do not label the final seen bytes as the visibility state used for every earlier batch, or infer a unified final gameplay snapshot from them. `TOME_MAP_NATIVE_FOV_EXECUTED` is set upon entry to the conditional native FOV branch, before checking whether `game.updateFOV` is a function; outside the normal retained Game contract it proves branch entry rather than successful method completion.

Original Lua caches alone remain insufficient for reconstruction: `seens/lites/infovs/has_seens/remembers` are distinct arrays; extra dynamic light updates seen state; ESP has no separate provenance buffer; default actor visibility and ESP use different cached `can_see_cache` keys. Original `Map:updateMap` uses temporary `mos` and persists the selected layers through native `setGrid`, not a complete Lua draw buffer. Original ASCII mode also changes slot selection. Capturing emitted native geometry avoids recomputing those decisions, but does not supply missing shader/resource/FBO/foreign-command state.

## Binary layout and boundedness

The layout arithmetic is internally consistent in the reviewed source:

| Structure | Bytes |
| --- | ---: |
| Packet header | 64 |
| Every record header | 16 |
| Batch fixed payload | 216 |
| Batch per vertex: position XY, UV, RGBA | 32 |
| Batch per quad metadata: layer, x, y | 12 |
| Complete batch with `q` quads / `6q` vertices | `232 + 204q` |
| Callback/FOV event record | 16 |
| Complete seen-byte record | `32 + 4 × width × height` |

The fixed batch fields end at byte 216: modelview starts at 88 and projection at 152, each 64 bytes (`capture.c:124–139`). The maximum original 5000-quad batch therefore occupies 1,020,232 bytes. The original fixed scratch capacity is retained; count must be a multiple of six, no more than 30000 vertices, and its metadata count must agree. Cached client array pointers and component sizes must match the original scratch arrays before dereferencing. Float geometry, UV, colors, and matrices are checked for finiteness. Packet reservation is bounded by a 4096–67108864-byte budget, checks addition before growth, and marks overflow rather than changing original drawing. All record integers and float bit patterns are written explicitly little-endian. Float representation/platform GL query behavior still require compilation and actual retained-kernel validation.

No arithmetic overlap or original-operation reorder was found in this source comparison. Runtime ABI, GL query support, link compatibility, and consumer decoding have not been checked here.

## Lua read boundary and retained limitations

The latest Lua adapter includes strictly increasing exact positive epochs, stable game/world/level/map/native/player identity, a living paused player with sufficient energy, and no dialog/tick-end callback at begin (`37–46`). JSON wrappers serialize only returned owned metadata (`8–25`, `79–82`). Their sorting/formatting and the getter paths do not invoke original draw, FOV, visibility calculation, RNG, or game tick.

Canonical retained `engine/Game.lua:364–368` implements `onTickEndExists` by selecting the pending callback table and reading its length; canonical `engine/Actor.lua:472–475` implements `enoughEnergy` by reading the energy value and required threshold. The wrapper does not establish safety for arbitrary replacements of these methods. It also does not establish a complete Lua-frame return proof itself: the application must perform the actual original preparation once and enforce the terminal-failure contract before sealing/continuing.

The packet contains numeric GL object identifiers, not texture pixel ownership, asset licenses, resource generations/leases, shader sources/uniform values, complete GL state, arbitrary foreign callback commands, or the complete original Game/FBO pipeline. Callback error flags report the original caught callback errors but do not roll back their partial effects. `full_renderer_ready=false` and the missing-resource/foreign-GL/uniform/partial-GL flags accurately communicate these limits. This review approves only the consistency of the bounded observation source and its stated incomplete scope, conditional on the lifecycle requirements above; it makes no successful build, runtime, browser, or full-renderer claim.
