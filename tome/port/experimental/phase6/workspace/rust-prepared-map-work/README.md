# Original map packet contract

This standalone, unpublished crate is a source-only decoder for the separate original ToME map observer. It does not join the existing game crates or change the verified baseline. Original C/Lua retains all gameplay and performs one effectful preparation. Rust consumes only an immediate owned copy of its sealed observer bytes. No full renderer is delivered by this crate.

The decoder matches `../mechanics-audit-work/prepared-map/packet-schema.json` and the actual source observer in `tome_prepared_map_capture.c`. Pristine original `src/map.c` is SHA256 `7b0a56f096faad003551da02e7073948c390cf5fc6c646ac594855881ee69917`; the generated reversible observer is SHA256 `3936536c16b1220357ad00417653b331003c71c34a2e798dfb2e8d283580ddc1`. The capture's `source-validation.json` records its exact inputs, 16 reversible additions and independent native/Lua source review. All source-derived adapters remain GPL-3.0-or-later.

## Actual ownership and source order

`OwnedPacket::decode(Vec<u8>, ExpectedPreparation)` takes the host's copied bytes and validates TMP1 before yielding a packet. It owns the original vertices, texture coordinates, colors, transforms, source cells/layers and final CPU seen texture bytes. Getters borrow these immutable arrays. The crate contains no unsafe code, FFI, global state, browser/time service, RNG or simulation implementation. It never queries an original map or runs an original callback.

The host supplies a nonzero VM generation and the exact expected application epoch. The epoch is validated against the packet; generation is retained as host provenance because TMP1 does not encode one. **This is not proof of native VM generation.** The host must use a fresh modularized WASM instance for the current reset/resume path and must stop a frame attempt after any original failure. A reused Lua-state pointer cannot certify ownership. Future same-instance VM replacement needs explicit native generation invalidation.

Source slots retain the actual batch/object callback/z callback/native-tail FOV ordering. Quads retain their individual selected native layers and source map cells. A native batch can contain quads from multiple layers before a flush; the event prefix records the layer at flush time. The decoder never requires every quad's layer to equal that prefix, sorts geometry, flattens visibility into map tiles, substitutes ASCII, clamps colors/UVs or recalculates lighting. Exact finite f32 bit patterns, including signed zero, are preserved.

Reader operations check all byte ranges, bounded counts, source sequence, complete begin/end pairs, monotonic native layer traversal, terminal native-tail FOV ordering, final seen-copy position, header agreement, flags and original entry/return counts. Missing render capabilities remain visible diagnostic flags; they do not imply a working renderer. The maximum input is64MiB and the conservative owned storage estimate is128MiB. Input coexists during decoding, so the process peak for this call can approach192MiB; parent must account for the native packet and WASM heap too. There is no asynchronous decode or hidden allocation outside bounded typed storage.

## Exclusive host integration

Use the frozen capture README for the native compilation/mount/export list. This crate changes no native call contract. The sequence remains one host-exclusive operation:

1. Keep original desktop/display callbacks from preparing independently. Reject a foreign save/resume checkpoint hold.
2. Run genuine original tick settling under that same exclusive preparation operation until the existing paused, living, energy-ready, no-dialog/no-pending-tick-end gate holds. Do not clear a callback queue, relax the gate or introduce simulation work in a getter.
3. Begin a monotonically increasing exact epoch, run **one** genuine original baseline preparation and verify original frame success. Seal that same actual map identity/epoch only after it returns.
4. Copy the native pointer/length immediately into host-owned bytes without another native invocation; validate metadata and expected epoch. A WebAssembly memory view alone is insufficient ownership because release/reallocation invalidates it.
5. Release native observer storage. Pass the copied bytes to `OwnedPacket::decode`; retain the host VM generation. Repeated Rust reads involve only owned data.

Original Lua failure, lifecycle change, missing return or FBO cache hit cannot be recovered by retrying the draw in this candidate. Preserve evidence, stop the instance and use a fresh one. Releasing an in-flight observer or forcing `map.changed` to manufacture geometry is unsupported. Metadata/native checks remain the parent's actual runtime responsibility; Rust's decoder cannot retroactively certify their success.

## Immutable WebGL command boundary

`ObservedDrawCommand` is an immutable typed description of actual native geometry and the observed subset of GL state. Its process-local texture/program/FBO names are deliberately named `Native*Id`, not resource leases. `full_renderer_ready()` always returns false and `require_full_replay()` always rejects. Caller-supplied flags or a resource URL cannot turn TMP1 into a production command stream.

The next schema must provide actual, immutable resource versions and the complete ordered presentation stream before there is an executable WebGL frame. Necessary commands and data include:

| Boundary | Required retained-source capture | Pure Rust/WebGL replay |
| --- | --- | --- |
| Texture creation/upload/deletion | Actual format, dimensions, bytes, parameters, revision, lifetime and sampler unit | Upload owned versioned bytes and bind the same immutable revision; never call original texture generators |
| Program and uniforms | Actual source/code version, locations, values, samplers and preparation-time time uniforms | Use owned program/uniform versions; never sample current time or use cached native names as proof |
| Framebuffers/compositor | Actual attachment versions, pass ordering, clear/load state, viewport/scissor/blend/depth/stencil/color masks | Execute copied pass commands in source order with private platform resources |
| Foreign object/z callbacks | Their actual GL output at original source slots, preserving any original mutations once | Replay copied commands; never dispatch those original callbacks |
| Native seen cache | Per-use texture revision, including earlier reads before the final seen copy | Bind captured per-use revision; final BGRA alone cannot restore earlier versions |
| Particles/weather/gridlines/UI | Actual ordered geometry and complete state, not regenerated effects | Draw immutable prepared geometry without advancing emitters or Lua cleanup |

No such future capture is fabricated here. `ReplayRejection` retains the actual gap flags. A later version needs a nonforgeable validated-frame construction boundary: every resource reference must resolve to an owned or truly leased matching generation/revision and every command/state field must be covered. It must reject unknown uniform/resource/foreign GL classes rather than omit them. Normal gameplay mutations made during original preparation must retain their exact original source ordering; neither blanket VISUAL execution nor blind RNG/state restoration is faithful.

Live particles remain outside this byte packet. Saving their continuation needs real original emitter and worker Lua state, particles, deferred removal queue, main-VM callbacks, named RNG banks and a real worker barrier. Meteor `on_remove` can damage/stun/change terrain after native map drawing. Pure replay must never execute that lifecycle work. The separate verified baseline full save/resume does not establish prepared-renderer purity.

## Verification status

The twelve tests in `src/tests.rs` were authored and reviewed as adversarial wire examples during this delegated source-only task; they are not alternate game models or original browser fixtures. They cover exact source data/order, every byte truncation of a bounded batch, stale/lifecycle/protocol failures, nonfinite/oversize fields, original callback ledger pairing and layer/tail ordering, exact BGRA channel order, final seen-copy ordering, repeated immutable reads and fail-closed replay. This delegated task invoked neither Cargo nor a Rust compiler/test runtime. Parent independently reported all twelve actual Cargo tests passing. Its first Clippy run found only `large_enum_variant` for the intentionally inline `Event` storage; parent owns the documented local allow and repeat verification. Those reports do not establish actual native packet decoding or renderer purity.

Parent may execute `cargo test --manifest-path rust-prepared-map-work/Cargo.toml` when its memory/build policy permits. An actual captured native packet must then be added as an independent fixture with its source/build/epoch metadata. Compare parsed arrays/layers/callback order to actual original draw observations; confirm repeated packet reads and replay leave the original full state and all RNG unchanged; test real invisibility/ESP/dynamic light/memory/ASCII/foreign shader/particle paths. Those checks and the complete renderer remain pending.
