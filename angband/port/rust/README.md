# Angband Rust browser boundaries

This crate implements the three Rust layers specified in the user's plan. The
fourth layer remains the original Angband 4.2.6 C logic at commit
`f3082213b73f3e463e3d0d60bff4b00462beae6e`. It contains no replacement gameplay
simulation, random number generator, or original-save parser.

- **Presentation:** a 100 × 32 terminal, clipped text/wipe operations, cursor,
  detached immutable snapshots, and stable numeric JSON. Rendering cannot
  access C gameplay state, RNG, input, or storage.
- **Input/application commands:** exact upstream `ui-event.h` special-key and
  modifier rules, validated Unicode input, and a sequential command journal.
  Original C command/event dispatch still decides what each input means.
- **Platform:** a bounded versioned save envelope around the unchanged opaque
  C save payload, exact source/version compatibility checks, and IEEE CRC-32
  corruption detection. Schema 2 also retains a complete C-supplied boundary
  RNG checkpoint, since original native-load startup changes the WELL state.
  Rust preserves these words without advancing or simulating the generator.
  The browser adapter supplies filesystem persistence.

`catalogs/en.json` and `catalogs/ja.json` cover the ten new browser frontend
system messages only. Japanese is the default. Typed IDs and named parameter
validation reject missing/unknown IDs and mismatched placeholders. External
names are copied verbatim. These files do **not** constitute a Japanese
translation of original gameplay text, names, plural forms, errors, or help.
That migration remains separately inventoried by the parent project.

`text::GameCatalog` additionally embeds `../locales/game-en.json` and
`game-ja.json`: 44 reviewed, parameter-free static game message IDs. It extracts
only the top-level `messages` JSON object with a bracket/string scanner, then
uses the same strict flat string parser. Metadata records the deferred original
texts. Game messages are selected by semantic IDs in original C callsites;
completed English text is never searched or replaced. Duplicate IDs,
placeholders, and unknown IDs are explicit errors.

## FFI contract

All calls are synchronous and must use the same browser thread. The crate uses
thread-local ownership, and callers must copy returned buffers before replacing
them. C `wchar_t` must be a 32-bit code point on the Emscripten target.

| Symbol | Contract |
| --- | --- |
| `ab_rs_clear()` | Clear screen and cursor, leaving input/storage state intact. |
| `ab_rs_text(x,y,n,color,s)` | Read initialized aligned `u32[n]`; copy visible cells. Invalid scalar values become U+FFFD. |
| `ab_rs_wipe(x,y,n)` | Wipe the visible part of a horizontal span. |
| `ab_rs_cursor(x,y)` | Set cursor or hide it for coordinates outside the screen. |
| `ab_rs_frame()` | NUL-terminated UTF-8 JSON valid until the next frame call. |
| `ab_rs_input(code,mods)` | Return normalized packed input and journal it; return zero for rejected input. |
| `ab_rs_journal_reset()` | Reset history when starting a new character. |
| `ab_rs_save_wrap(bytes,len)` | Return a versioned save envelope or null on error. |
| `ab_rs_save_unwrap(bytes,len)` | Validate envelope and restore journal; return original C bytes or null on error. |
| `ab_rs_save_len()` | Latest successful wrap/unwrap output length; zero after failure. |
| `ab_rs_save_status()` | Zero on success; stable error code below after failure. |
| `ab_rs_checkpoint_rng(values,len)` | Validate and copy exactly 38 RNG words for the next successful wrap; return 0, 8, or 9. |
| `ab_rs_take_restored_rng(out,len)` | Copy a restored 38-word checkpoint once; return 0 copied, 1 absent, 8 bad pointer/alignment, or 9 bad length. |
| `ab_rs_set_locale(locale)` | 0 selects English; 1 selects Japanese/default. Does not change screen, journal, or save state. |
| `ab_rs_message(id)` | Read a trusted NUL-terminated semantic ID of at most 127 bytes; return localized NUL-terminated UTF-8 valid until the next message call. Unknown IDs return a visible missing-ID diagnostic. |

Frame schema is `{"width":100,"height":32,"cursor":[x,y],"cells":[[code,color],...]}`.
Cursor can be `null`. Cells are flat, row-major, exactly 3200 entries. Colors are
original Angband palette indices; ASCII and non-ASCII scalars are preserved.

Packed input uses bits 0–20 for the key code (`packed & 0x001fffff`), and bits
21–25 for modifiers (`(packed >> 21) & 0x1f`). Modifier masks are Control=1,
Shift=2, Alt=4, Meta=8, Keypad=16. The original special key codes are defined in
`input::browser_key`. Ctrl-@ becomes zero and is rejected by this no-input ABI.

The current save format is the 8-byte signature `ABRSAVE\0`, little-endian u16
envelope version 2, 40-byte source commit, 5-byte upstream version, u32 payload
length, u32 journal entry count, u16 RNG word count (0 or 38), optional RNG words
as little-endian u32 values, opaque payload, entries of u64 sequence + u32 packed
input, and a trailing u32 CRC of all prior bytes including RNG. Schema 1 is
still accepted with its original 63-byte header, unchanged native payload and
journal; it has no RNG metadata (`rng=None`). Newly encoded files always use
schema 2. CRC detects accidental
corruption; it is not authentication. Maximum payload is 32 MiB; maximum journal
is 262,144 commands. Gameplay input continues after journal overflow, but saving
explicitly fails instead of silently persisting incomplete history.

Save status codes: 1 invalid signature, 2 envelope version, 3 source/game
version, 4 size/journal limit, 5 length mismatch, 6 checksum, 7 invalid journal,
8 invalid null buffer, 9 invalid RNG shape/control fields. The host must not
call the C loader after unwrap failure.
Envelope acceptance alone does not validate the internal original C save; the
original loader retains responsibility for that. A failed C load should be
reported separately by the browser.

RNG snapshot order exactly matches the browser's existing `state.rng`:
`[quick, Rand_value, state_i, z0, z1, z2, STATE[0..31]]`. `quick` (index 0)
must be 0 or 1; `state_i` (index 2) must be less than 32. Checkpoint before
wrapping at the same quiescent boundary as the native save. Apply restored
words in C **after** native-load startup and **before** the next game command.
The native payload itself stays byte-for-byte unchanged. A successful wrap
consumes the pending checkpoint; every save needs a fresh checkpoint. A
successful take consumes restored metadata; invalid output buffers preserve it.
Legacy or failed unwrap clears any earlier pending restore to avoid applying
one character's checkpoint to another. RNG FFI status codes are returned
directly and do not modify `ab_rs_save_status`; status 1 means no checkpoint.
Starting a new journal also clears pending RNG metadata. This checkpoint alone
does not establish deterministic continuation: the combined game must still
verify identical future inputs across all native startup side effects.

## Verification

```powershell
cargo fmt --check
cargo test --offline --target x86_64-pc-windows-gnu
cargo check --offline --target wasm32-unknown-emscripten
cargo build --offline --release --target wasm32-unknown-emscripten
```

Output is `target/wasm32-unknown-emscripten/release/libangband_layers.a`, which
the parent C/Emscripten build links into the real game. The crate has no external
Cargo dependencies. Unit tests exercise clipping, immutable snapshots, Unicode,
actual key codes, modifier normalization, lossless deterministic save transport,
version/corruption/length rejection, journal validation, complete **frontend**
catalog coverage, JSON escape handling, placeholder errors, opaque names, and
the real exported FFI screen/save boundary. Four additional game localization
tests cover the 44 matching keys, zero placeholders, nested/escaped JSON
extraction, explicit unknown IDs, and runtime locale switching with unchanged
screen/journal state. These additions are awaiting the parent's serial test run.
Five schema 2/RNG tests additionally cover exact snapshot bytes, checksum
protection of every word, control/length validation, schema 1 compatibility,
and one-time runtime restore with failed-output preservation. These are also
awaiting the parent's serial verification; this follow-up launches no builds.
Full game/RNG and browser flow tests
belong to the combined original-C browser build.
