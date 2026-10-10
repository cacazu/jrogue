# Original default editor in the Rust application layer

The browser default `askfor_aux_keypress` policy is source-connected to pure
`rust/src/application_text.rs`, pinned to Angband 4.2.6 commit
`f3082213b73f3e463e3d0d60bff4b00462beae6e`. The original native C body and both
default initialization statements remain in native branches. Removing the
`AB_TEXT_PURE` and `AB_TEXT_BRANCH` annotations with `native-parity.mjs`, then
the previously accepted interface/UI/game annotations, reconstructs the accepted
`ui-input.c` bytes exactly, including original CRLF line endings.

The pure reducer receives an initialized UTF-8 string, byte capacity including
NUL, scalar cursor, first-time flag, key code and native modifiers. It returns
an owned string, scalar cursor/count and explicit effects. C executes an
original bell once if requested and applies a completely validated edit once.
There is no C fallback after a failed capture, duplicate keystroke, engine
query, RNG, input queue, terminal call, save operation or text translation in
the pure Rust reducer. Names, authored history and search queries remain external
opaque text. The original name handler's `*` random-name command is unchanged.

The original default handler ignores modifiers and event type; this seam does
the same. It recognizes the actual native `ESCAPE=0xE000`, `KC_ENTER=0x9C`,
left/right arrows, backspace and DELETE. ASCII 27 is an unprintable literal key,
not a second Escape identity. Home/End and other special keys have no original
default-editor action and still request a bell. First-time Enter accepts the
default; Escape leaves this handler's text unchanged and sets cursor zero.
The original outer caller retains accept/cancel policy. First-time arrows move
to the respective end, and first-time delete/backspace clears the default.
Printable first input clears the default before capacity testing, even when
the replacement scalar cannot fit.

Printability follows original `ui-event.c:95` and `z-util.c:268` fixed Unicode
intervals, plus `utf32_to_utf8` scalar validity. It deliberately uses neither
locale-dependent `iswprint` nor Rust `char::is_control`. Combining marks and
private-use characters are accepted; original excluded variation selectors,
selected noncharacters and planes 4 through 14 remain excluded. Cursor units
are Unicode scalars, not grapheme clusters. There is no new scalar-count limit;
the original byte capacity remains authoritative, bounded to 65,536 bytes for
this adapter. Capacity refusal does not ring a bell.

DELETE fixes the actual original `utf8_fskip(buf + *curs, 1, NULL)` scalar/byte
mix-up. All insert/delete spans use valid Rust scalar boundaries. Original
`askfor_aux` and `askfor_aux_ext` default truncation can also split a CJK scalar;
their browser initialization now asks Rust for the last complete scalar in the
same bounded prefix. ASCII results are byte-identical. Incomplete final UTF-8
caused by the boundary is removed; malformed earlier bytes refuse the invocation
without applying partial data. The original key loops and terminal layout stay
intact. Help now calls the shared editor once and has no separate DELETE policy.

## Snapshot/effect ABI

The isolated `AB_TEXT_FFI_BOUNDARY` section owns the pointer adapters. Root
registers the module and export build list; it need not duplicate adapters in
`rust/src/lib.rs`:

```c
int32_t ab_rs_text_edit(const uint8_t *text, uint32_t length,
    uint32_t capacity, uint32_t cursor, uint32_t code, uint32_t modifiers,
    uint32_t first_time, uint8_t *output, uint32_t output_capacity,
    uint32_t *effect, uint32_t effect_words);
int32_t ab_rs_text_truncate(const uint8_t *prefix, uint32_t length,
    uint32_t capacity, uint32_t *terminator);
```

Edit effect has exactly eight u32 words:
`[1, scalar_cursor, byte_length, scalar_count, flags, 0, 0, 0]`.
Flags: `DONE=1`, `BELL=2`, `CHANGED=4`, `CAPACITY_REFUSED=8`.
Statuses: capacity `-300`, buffer/UTF-8 `-301`, cursor `-302`, modifiers `-303`.
Successful edit writes complete UTF-8 plus NUL to distinct output storage.
Adapters validate checked address ranges/overflow/alignment and bounded counts,
current wasm32 linear-memory bounds, every input/output/effect overlap, `first_time<=1`,
`modifiers<=255`, capacity 1..65,536, input length below capacity, output capacity
equal to the captured capacity, and exactly eight writable effect words. The
pure result and effect must both be ready before any output is written; errors
leave all outputs untouched. Input/output/effect spans are disjoint and owned by
the C caller for the synchronous call. Null input is allowed only for length zero.

Truncate receives at most capacity-1 bytes before the first NUL and returns only
a validated NUL offset, `offset<=length<capacity`. It does not read beyond that
prefix. Root registers `pub mod application_text` and the two exports; no new
C source file or build dependency is needed.

## Evidence and remaining acceptance

`node --test tests/text-input-integration.test.mjs` passes seven source checks.
Together with help/history/UI checks, 33/33 pass. Ten Rust tests are authored:
first-time controls, every CJK/emoji/combining-scalar deletion cursor, byte-limit
insertion, literal modifiers/printability, invalid capture/effect words, every
default truncation boundary, and an independent original ASCII byte-editor
oracle across all native keys 0..0x9F plus Escape/cursors/capacities, plus three
actual FFI tests for CJK canary guards, transactional malformed/alias/alignment
rejections and every initialization boundary.
`tests/fixtures/text-input-cases.json` supplies 15 exact adapter expectations.

This agent ran no compiler, engine build, Rust tests or browser. Root must execute
the actual FFI/Rust tests and browser name/help/IME editing before reporting
runtime acceptance. Custom key handlers, mouse/context editing, multiline
biography editing and terminal cell reflow remain their original producers;
this migration covers only the shared default handler and bounded initializers.

Additive implementation, tests and documentation are GPL-2.0-only; original
source copyright and license notices remain intact.
