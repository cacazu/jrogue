# Independent Rust TMP1 source review

Reviewed statically on 2026-10-02 using the Rust review guidance. Only this review file was written. No Rust compiler, Cargo, Clippy, Lua, native game, WASM, or browser was run.

The final reviewed decoder agrees with the C/schema field offsets and bounded payload sizes. No remaining material arithmetic, ownership, source-order acceptance, or obvious compile/type defect was found in the reviewed revisions. This conclusion is source-only; the twelve protocol example tests have not been executed by this reviewer and are not evidence of an actual captured game frame.

## Reviewed revisions

SHA-256 values below cover complete file bytes.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/lib.rs` | 20905 | `6934c73d171572b56b33d65284c38131c11e277749083c54b0021725633c61d9` |
| `src/tests.rs` | 9799 | `4805b61b983304e022a766b1c04a6b9e26d9228a2ec81c5b2c34a90e8e0fb03c` |
| `Cargo.toml` | 280 | `d1c2412b13e69b0d4def18bf894f4b68c3221bea4d657b980964516cea7cb658` |
| `../mechanics-audit-work/prepared-map/tome_prepared_map_capture.c` | 12622 | `958a3bf1ca0f2a5c0d3d711204e16ea16ddf3a5f087cc77f6474f5a9c4db5554` |
| `../mechanics-audit-work/prepared-map/packet-schema.json` | 3391 | `5dbd9bcc4ee01dd1ce90e47e3213728dfd2f5e4ee12b4ed89c130eb076e28472` |

The root subsequently added two explanatory comments and a local `#[allow(clippy::large_enum_variant)]` to `Event`. The derivative `src/lib.rs` is 21089 bytes, SHA-256 `5a3a853802ea7dc1e2367bd8eab60e7307734527b2cf1beb8ad4689f56377c67`. Removing exactly that added comment/attribute block in a read-only hash calculation reconstructs the frozen reviewed SHA above. This derivative changes neither algorithm nor storage representation. The parent reports all twelve tests passed in its separate execution; this reviewer did not execute them, and the strict Clippy rerun remains the parent's check.

The retained original `src/map.c` compared during the native review is SHA-256 `7b0a56f096faad003551da02e7073948c390cf5fc6c646ac594855881ee69917`. Native source-order and Lua cache limitations are documented separately in `../mechanics-audit-work/prepared-map/lua-read-audit/REVIEW.md`, `PREPARED_MAP_READS.md`, and their hashed original-source evidence. This Rust review does not supersede the native terminal-failure/lifetime requirements.

## Offsets, arithmetic, and structural ledger

The 64-byte header is consumed in its written order, including signed keyframes at 48, entries/returns at 52/56, and zero reserved field at 60. Each 16-byte event prefix retains kind, complete record length, sequence, and signed selected native layer. Batch decoding consumes the C fixed payload of 216 bytes, then `2N` position floats, `2N` UV floats, `4N` color floats, and `3Q` signed source metadata values. Thus total batch bytes remain `232 + 32N + 12Q = 232 + 204Q` with `N=6Q`. The seen record remains `32 + 4WH` bytes and preserves copied BGRA channels.

`Reader::take` checks every range with checked addition; array products and seen dimensions use checked arithmetic before allocation. Exhaustion checks reject trailing record or packet bytes. Vertex counts are positive multiples of six, at most 30000; quad counts must agree. Map/source coordinates and selected layers are checked against the header; GL box widths/heights are nonnegative. Finite f32 decoding preserves the original bit patterns, including signed zero, without clamping UV/color values or transposing matrices.

The final ledger checks preserve genuine source order without requiring every quad layer to equal its later batch-flush prefix:

- Event prefixes never move backward in the native z traversal.
- Source quad layers never move backward within a batch or across batches, and never exceed their batch prefix.
- Object/z/FOV begin/end pairs must match both kind and selected layer; nested slots or native batches inside a foreign callback slot are rejected.
- The native FOV source slot is terminal before the optional seen copy, and both FOV markers and the final seen copy must be at `zdepth-1`.
- Sequences, event and batch totals, FOV/callback flags, and original entry/return counts must agree.
- Every batch retains mandatory missing-resource/partial-state bits 1 and 8; a nonzero cached program also requires missing-uniform bit 4.

Earlier source review found incomplete FOV-tail and traversal checks. The final revisions above include the corresponding checks and protocol mutation cases. The checks match the original increasing outer z loop and the native FOV branch after all ordinary batches/callbacks. Real cross-layer batches remain accepted: accumulated earlier-layer quads can flush under a later layer prefix.

## Ownership, allocation, and type review

The crate forbids unsafe code and contains no FFI, VM/map queries, time, RNG, callback dispatch, or global mutable state. Decoding takes owned input bytes and copies geometry, source metadata, and seen pixels into privately held boxed slices. Public packet getters borrow immutable data; returned header/preparation values are copies. Native texture/program/FBO identifiers remain explicitly process-local numeric names, not resource leases.

Packet length is limited to 64 MiB. Typed event storage and encoded-payload bounds are checked against a conservative 128 MiB decoded representation estimate; reservations use `try_reserve_exact`. Input coexists during decoding, so that estimate is not a 128 MiB total-process memory ceiling: the call can approach 192 MiB before accounting for allocator overhead, existing input capacity, the native packet, or the WASM heap. The host must budget those separately.

No obvious Rust syntax/type error was found. Const array sizes for viewport/scissor/blend factors infer from their concrete struct fields; numeric conversions and counter bounds are compatible with the declared edition 2021 and Rust 1.74. The final `Option::is_some_and` use is available since Rust 1.70. This is a manual compatibility review, not a compilation result.

The inline `Event::Draw` variant is substantially larger than the marker/seen variants. Strict Clippy may report `large_enum_variant`; it was not run here. The inline representation is included in the `size_of::<Event>()` storage budget. Address a confirmed lint with a documented local allowance for that choice, or revise boxing and the allocation estimate together; this review does not claim clean Clippy output.

`ExpectedPreparation.vm_generation` is validated only as a nonzero host assertion and retained as provenance. TMP1 contains an epoch, not a VM generation. The decoder checks the expected epoch against the wire value; it cannot prove that the host copied bytes from the matching live VM. The application must independently enforce exclusive original preparation, successful complete Lua-frame return, immediate owned copying, and the native accessor's epoch/VM lifetime guard. After an original preparation exception or missing return, that VM lifetime must end without retrying gameplay callbacks.

## Test examples and rendering authority

The twelve tests construct independent wire examples and mutations. Their header/geometry/seen offsets are consistent with the schema. In particular, the two-batch traversal case copies a 640-byte record, corrects its second sequence at absolute 712, and changes the second batch's first quad layer at absolute 1320. The malformed batch table uses absolute 108 for mandatory flags and 92 for the untracked nonzero program. These are valid protocol examples, not original runtime fixtures.

`full_renderer_ready()` returns false unconditionally. `require_full_replay()` returns `Err` unconditionally, including for structurally valid packets and packets retaining callback/overflow/lifecycle/nonfinite error flags. Accepting such flags for diagnostic inspection does not authorize their rendering or continuation as a successful frame.

Compilation, Cargo/Clippy checks, actual retained-kernel packet acceptance, and real browser/FOV/ESP/invisibility/light/particle paths remain unverified by this reviewer. Texture/resource ownership, uniforms, foreign GL commands, complete GL state, and the enclosing original presentation stream remain absent from TMP1. The final source is suitable for the parent's planned compiler/protocol-test milestone; it provides no full renderer or publication readiness claim.
