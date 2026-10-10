# Actual original map observer browser source

This additive local source candidate starts one fresh original ToME instance, completes the first genuine full save, then attempts one original baseline frame with the native map observer installed. It compares copied native bytes with the separate Rust decoder and records read purity. It delivers no full renderer. The author did not start a server/browser, compile, parse with Node, execute Lua, or run this scenario.

The parent owns `native_frame_error_observer.c` and `error-source-provenance.json` in this folder. Every other integration file is authored by this child. Original source, default builds, existing baseline/save adapters, and other games are unchanged.

## Parent-owned build and server configuration

Use a separate native capture variant with the retained fullsave/snapshot/three-component RNG ABI, all eight prepared-map exports, and the two additional error-observer exports:

```text
tome_native_prepared_map_lua_error_pending -> number 0/1
tome_native_prepared_map_lua_error_message -> bounded string (empty is valid)
```

Link the parent's new error observer translation unit. It reads the original pending error list without consuming its dialog or calling Lua/RNG. The original `draw_baseline` return alone cannot prove Game.display success; the page requires both pending-error exports and checks the genuine original pending error state before and after the frame, together with original printed errors and exact map entry/return/depth.

Import `observer_server.mjs` and call `createTomeServer` with explicit `nativeBuildRoot` and `rustWasmFile` options. `nativeBuildRoot` must contain the actual experimental `tome-native.mjs`/`.wasm`; `rustWasmFile` must name the actual built raw `tome_map_packet_wasm.wasm` from `rust-prepared-map-work/wasm-wrapper`. No default build is silently substituted. The server returns an unstarted HTTP server; the parent supplies `listen`, lifetime, port, browser profile, and monitoring.

```js
const server=await createTomeServer({
  nativeBuildRoot: actualCaptureBuildDirectory,
  rustWasmFile: actualRustWrapperArtifact,
});
// Parent listens on 127.0.0.1 and opens /prepared-map-observer.html.
```

The server delegates existing source/range/native/bootstrap routes to the original range server. The separate VFS manifest retains every baseline input and adds exactly the original map gate at `/adapter/original-map-packet.lua`; it adds no loader or Game overlay. Checkpoint store/flow/ZIP validator modules are served unchanged from `save-resume-work`. The original packet gate must remain mounted before its explicit install after fullsave completion.

Use a fresh private browser profile and fresh origin/store. After store initialization, an existing verified durable head fails closed and is reported. This page never deletes IndexedDB, clears an existing home, resumes a generation, reseeds, or manufactures a first generation.

## Actual operation and failure gates

The page mounts original inputs, initializes IDBFS, then calls original init/start once. It does **not** make an initial baseline draw. The retained `saveBaselineCheckpoint` flow owns original tick settling, saveGame screenshot preparation, graph serialization, ZIP verification, durable commit, and native checkpoint release. Only a completed durable first fullsave with the native checkpoint gate released permits observer installation/begin.

All keyboard and canvas pointer/touch input is intercepted before native SDL handlers are installed. There is no command route, button that retries, draw loop, queue clear, forced map.changed, extra frame, synthetic cache invalidation, or renderer fallback. The observer runs exactly one external `tome_native_draw_baseline` call. A natural FBO/map cache hit, zero geometry, skipped/repeated/incomplete map call, pending original Lua error, callback error, lifecycle change, overflow, or nonfinite capture fails closed with phase, status, exception, and printed source context. An original failure stops the candidate VM lifetime; the page never resets, releases a failed in-flight capture, or retries callbacks.

On successful sealing, the page immediately copies native packet bytes into JS ownership and checks repeated getters. It then releases native observer storage before loading/using the separate Rust WASM instance. Rust receives sequential little-endian words with exact final valid-byte count, epoch halves, and host VM-generation halves. WASM word output is always converted with `>>>0`, retaining high-bit/signed-zero float bits. Every event, draw GL metadata, matrix, position/UV/color word, source quad word, and seen byte is compared against byte spans in the actual C packet. The independent byte reader implements no game mechanic or renderer.

`full_renderer_ready` remains false. The Rust `full_replay` export must return zero on every attempt. Missing textures/resource generations, uniforms, foreign callback commands, full GL state, and enclosing presentation commands remain concrete gaps even when observation checks pass.

Before Rust instantiation, the page inspects the actual compiled module and requires zero imports. Separate fresh Rust instances reject a mutated version, truncation, nonfinite actual vertex, out-of-map source layer, stale expected epoch, and nonsequential/incomplete word coverage. These probes alter only copies of the actual native packet after native release, implement no alternate game, and never call or restore the original VM. Their failure metadata and the actual Rust artifact hash are recorded.

## Separate purity comparisons

Effectful preparation has original snapshot/RNG observations before and after; differences are recorded and are permitted. These views are the retained finite characterization seam, not a full save graph or complete gameplay-equivalence proof.

Native getter checks compare that finite original snapshot and the full three-component RNG around Lua status/binary getters. Lua status/snapshot allocate and are excluded from a native byte-purity claim. A separate whole-memory check brackets only warmed repeated binary pointer/size getters and copies. It hashes every consecutive 1 MiB native WASM memory chunk with SHA-256, checks length/buffer stability, compares every chunk, and masks nothing. C stack residue or concurrent worker changes are reported as actual differences rather than excluded.

After native release, a second whole-memory bracket surrounds only Rust instantiation/transport/getters/replay rejection/release, with zero original native calls inside. Original snapshot/RNG comparisons happen outside this bracket. Chunk hashing uses bounded temporary JS storage instead of copying the entire large native heap twice. The parent must still budget the native packet/heap, owned packet, Rust decode representation, graphics/assets, and browser memory. Actual worker quiescence and the source-only observer limitations remain required interpretation of results.

## Runnable page and evidence

The page's start predicate is a fresh profile/origin, actual capture build plus error exports, actual Rust wrapper artifact, original source assets, supported WebGL/IDBFS, and parent server lifetime. It runs automatically once. `window.tomePreparedMapReport.completed===true` means a concrete success or failure report is ready; only `.passed===true` denotes all observation checks passing. A failed-closed report is a real unsupported/failed capture result, not a rendering milestone.

The parent generic CDP harness may use `prepared_map_scenario.mjs` and its exported `runScenario({call,evaluate,evidence,output})`. It writes the actual copied TMP1 binary when available, independently hashes it in Node, writes cached original observations and the complete evidence report, and captures the actual browser screen without another game draw. Its probes return cached/owned JS data and never invoke original code. No alternate game fixture or fabricated geometry is used.

`source-status.json` records exact routes, bytes/hashes, required configuration, ABI inputs, and source-only status. Runtime, compilation, full renderer, mobile/CJK/full campaign, and publication claims require the parent's separate validation; none follows from these authored files.
