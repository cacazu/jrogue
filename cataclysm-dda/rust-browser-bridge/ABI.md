# Scalar ABI and safety audit

The independent WASM module exports memory and uniquely prefixed
`cdda_bridge_*` functions. It has no imported functions, memory, table, RNG,
clock, engine handle, filesystem, DOM, or storage capability. Its Rust source
has no `unsafe` block, unsafe function, static mutable variable, or raw input
pointer dereference. The `#[unsafe(no_mangle)]` attributes name the scalar C ABI
exports and are explained by the safety comment in `src/lib.rs`.

| Export | Arguments/result |
| --- | --- |
| `abi_version` | Returns 1. |
| `init` | Validates immutable catalogs/bindings; returns 1 on success. |
| `text_count` | Returns 56 compiled IDs. |
| `text_id_ptr`, `text_id_len` | Static read-only UTF-8 semantic ID for a checked index; 0 for invalid index. |
| `touch` | Context ID and control ID to native wire key; 0 means unsupported. |
| `gamepad_button` | Context ID and observed JOY button index to wire key. |
| `gamepad_direction` | Context ID and clockwise direction 0–7 to wire key. |
| `text_reset` | Clears only private formatter scratch strings. |
| `text_push_scalar` | Appends valid Unicode scalar to private external-text buffer; rejects surrogate/out-of-range values and more than 65,536 UTF-8 bytes. |
| `text_prepare` | Locale ID, semantic index, two pairs of u32 count halves; formats a validated event. |
| `text_ptr`, `text_len` | Read-only UTF-8 output address/byte length, valid until the next text-mutating call. |

Export names above omit the common `cdda_bridge_` prefix. The host copies the
byte slice immediately, checks it against the actual module memory length,
and decodes with fatal UTF-8 validation. It never writes to Rust memory. The
static ID pointers remain valid for the module's lifetime. Formatter output
uses a thread-local `RefCell` without retaining any borrow across an export.
No callback/import can reenter it.

Contexts: `0=gameplay`, `1=menu`, `2=character_name`. Locales: `0=ja`, `1=en`.
Unknown numeric values fail closed. Counts cover the complete u64 range;
JavaScript rejects unsafe Numbers and accepts validated BigInts instead.

| Control / wire ID | Native key | Actual bounded action |
| --- | --- | --- |
| 1 | ArrowUp | UP |
| 2 | u | RIGHTUP |
| 3 | ArrowRight | RIGHT |
| 4 | n | RIGHTDOWN |
| 5 | ArrowDown | DOWN |
| 6 | b | LEFTDOWN |
| 7 | ArrowLeft | LEFT |
| 8 | y | LEFTUP |
| 9 | Enter | UI CONFIRM |
| 10 | Escape | UI QUIT |
| 11 | i | inventory |
| 12 | e | examine |
| 13 | g | pickup |
| 14 | . | pause |
| 15 | \| | wait |
| 16 | S | save |

Native tests resolve each emitted key through the actual pristine upstream
keybindings fixture and compare the typed command. The original C++ engine
still processes the emitted key in its own active context and binding layer.
UI commands do not fabricate gameplay turns. Formatting cannot access or
advance C++ simulation or its RNG. Node runtime tests verify imports are empty,
all 56 IDs in both locales, strict parameters/UTF-8/u64 bounds, unsupported
fallbacks, and repeated deterministic input/format sequences. This is bounded
structural purity evidence, not a full-engine render/RNG test.

Miri is not installed in this environment. There are no unsafe memory operations
to exercise; native tests and actual WASM runtime bounds/Unicode tests cover
the implemented scalar boundary. No toolchain install is attempted.
