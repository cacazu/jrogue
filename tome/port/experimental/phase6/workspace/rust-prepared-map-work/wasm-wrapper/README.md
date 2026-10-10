# Isolated map observer WASM ABI

This unpublished wrapper references the frozen pure decoder through a path dependency. It introduces no gameplay, native calls, WebGL drawing, RNG, time query or loader. It accepts an owned copy of a real sealed TMP1 packet and exposes immutable validated observation data. Every request for full rendering returns unsupported. It must remain separate from the default native and Rust milestone artifacts.

The crate uses only `std` and the existing local decoder. Build/test/browser execution belongs to the parent. This delegated task has authored source and ten meaningful transport/corruption tests but has executed none of them. Parent may later run:

```powershell
cargo test --manifest-path rust-prepared-map-work/wasm-wrapper/Cargo.toml
cargo clippy --manifest-path rust-prepared-map-work/wasm-wrapper/Cargo.toml --all-targets -- -D warnings
cargo build --manifest-path rust-prepared-map-work/wasm-wrapper/Cargo.toml --target wasm32-unknown-unknown --release
```

Expected artifact is `target/wasm32-unknown-unknown/release/tome_map_packet_wasm.wasm` relative to this wrapper. There is no installation of a toolchain or new dependency in this task. Parent must inspect the actual WASM imports and require zero imports before instantiating it with `{}`. No FFI or original native module is linked into this crate. Export attributes are explicit ABI annotations; function bodies contain no unsafe block or unchecked pointer access.

## Exact numeric ABI

All arguments/results below are numeric u32/i32 values. Callers must validate unsigned argument ranges rather than rely on JavaScript/WASM truncation. Epoch is split into low/high32 words and must be an exact positive integer no greater than2^53-1. VM generation is supplied by the host as a nonzero u64; metadata represents it as a decimal string to avoid JavaScript integer loss. Neither transport nor TMP1 proves a VM generation independently.

| Export `tome_map_wasm_...` | Arguments | Result |
| --- | --- | --- |
| `begin` | byte_length, epoch_low, epoch_high, vm_generation_low, vm_generation_high |1 only after bounded initialized owned input allocation;64bytes..64MiB |
| `write_word` | exact next byte_offset, LE32 word, valid_bytes |1 only for sequential complete coverage;1..4bytes and final word's exact remainder |
| `commit` | none |1 only after every byte is written and the frozen decoder validates the packet |
| `release` | none |1; discards only Rust-owned input/packet/view storage, retaining accepted epoch monotonicity |
| `status` | none |1 and prepares bounded UTF8 JSON metadata |
| `event` | event_index |1 and prepares one original source slot's JSON metadata |
| `draw` | draw_index |1 and prepares actual geometry counts, source sequence/layer and captured GL state JSON |
| `draw_words` | draw_index, array_kind, start_word, word_count |1 and prepares exact LE binary words;1..4096words |
| `seen_bytes` | event_index, start_byte, byte_count |1 and prepares exact final owned BGRA bytes;1..16384bytes |
| `output_kind` | none |0none,1UTF8 JSON,2binary |
| `output_len` | none |Current owned output length, at most16384bytes |
| `output_word` | byte_offset |LE32 word from current output, with final remainder padded by zero; outside range returns0 |
| `error_code` | none |0none;1identity/length,2upload lifecycle,3word coverage,4decode rejected,5view/range unavailable,6bounded allocation/output failed |
| `full_replay` | none |Always0; no mutation, import or native call |

For `draw_words`, array kinds1/2/3 are exact f32 bit patterns for positions/UV/colors. Kind4 is a flattened sequence of original native-layer/cell-x/cell-y i32 bit patterns. JSON gives all array word counts. These source quads remain in original order, including genuine batches spanning layers. Colors/UVs and signed zero are preserved. GL names are native process-local IDs, never manufactured asset references or resource leases.

Input memory is initialized `Vec<u8>` storage, filled exclusively by safe numeric copies. No pointer from JavaScript is dereferenced and no uninitialized byte is decoded. Every write must match the next exact offset and byte count; gaps, duplicate or short words reject. Invalid Begin preserves any previous immutable packet but clears stale output and reports failure. Successful Begin discards the prior packet only after allocating the new bounded upload. Commit of incomplete/corrupt input never exposes a partial packet. Invalid view requests clear stale output but preserve the underlying valid immutable packet. Output getters borrow owned storage and neither allocate nor mutate packet content. Reentrancy fails without invoking a callback; the host must nevertheless serialize calls.

Output JSON records `phase`, `error_code`/bounded reason and optional byte offset, exact epoch/VM generation, source capture flags, original map dimensions/keyframes and counts. Every relevant result includes `full_renderer_ready=false`; `renderer_support` is `unsupported_tmp1`. A decoded packet with source failure flags is only diagnostic evidence, never a production frame. Caller must reject those flags for a successful original preparation claim. View serialization mutates only the wrapper's display buffer; packet content remains immutable.

## Browser evidence boundary

The separate source under `../../mechanics-audit-work/prepared-map/integration-web` integrates the actual native capture build, original range inputs and original full-save flow. Run the real first full save to completion before Begin, verify the original checkpoint exclusion has released, then hold one whole host-exclusive operation for Begin, one original frame, seal, immediate byte copy, getter checks and native release. No original frame retry, callback queue clear, `map.changed` forcing, temporary state restoration or visual blanket bank is allowed. A natural native cache miss/hit is observed and reported honestly.

Instantiate a separate actual Rust WASM module. Upload the copied packet after native release. Compare its metadata and chunked arrays against the captured packet schema, then read every output repeatedly with no native invocation. Native state/RNG before and after pure Rust work must match. Corruption probes use separate fresh Rust wrapper instances or higher valid epochs; they never rerun an original frame. Browser full-memory observations must distinguish actual native binary-getter memory from allocating Lua metadata calls and from normal C stack activity.

The added diagnostic C translation unit reads `last_lua_error_head` without consuming original error popup ownership. Original `tome_native_draw_baseline` returns1 after `redraw_now` even when `docall(display)` swallowed a Lua error. The observer page must require pending-error evidence before/after the frame as well as entered/returned counts and console callback errors. `getLastLuaError` and `del_lua_error` are deliberately absent. Parent compiles/links that extra isolated TU and exports the two names documented by its source provenance.

TMP1 still lacks immutable texture versions, shader/uniform/sampler state, foreign callback/particle GL output, enclosing pass/compositor commands and complete GL state. Current native rendering is original effectful preparation; the Rust wrapper never redraws it and returns no replacement image. Full production replay and live particle continuation remain pending.
