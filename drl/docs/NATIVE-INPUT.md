# Original-core browser input

`port/src/platform/native_input.rs` converts bounded browser DTOs into the original
core's explicit 128-byte little-endian event wire. It does not select gameplay
actions, consume random numbers, or mutate original state. Original Pascal key
bindings, Lua configuration, modal behavior and controller deadzones remain
authoritative.

The source contracts are `vioevent.inc`, `vioevent.pas`, `vsdlio.pas` and
`viopadstate.pas` at Valkyrie commit
`f89735a741a968997656c2d48a003ec569db7f22`, with the bridge decoder in
`core-overlay/fpcvalkyrie/src/vbrowserio.pas`. The new Rust adapter is GPL-2.0-only
under the enclosing port's license. Pristine sources are not edited.

## API

```rust
pub fn normalize(request: &Request) -> Result<Normalized, InputError>;
```

`Normalized` serializes as `{ "packets": [[/* 128 bytes */]], "captured": true }`.
`pad_trigger` additionally returns `"trigger_down": true|false`. Ignored input
returns an empty packet array and `captured: false`; invalid requests return a
specific `InputError`. Root owns the outer WASM JSON request wrapper.

The inner `Request` is an enum tagged with `kind`. Unknown fields and wrong JSON
types are rejected. Accepted variants are:

| kind | Fields |
| --- | --- |
| `keyboard` | `phase: "down"|"up"`, `event: KeyboardEvent` |
| `text` | `text: string`, committed text only |
| `mouse_move` | `x`, `y`, `relative_x`, `relative_y`, `buttons`, optional `modifiers` |
| `mouse_button` | `x`, `y`, `button`, `pressed`, optional `modifiers` |
| `wheel` | `x`, `y`, `delta_y`, optional `modifiers` |
| `pad_axis` | `which`, `axis: 0..3`, `value: -1..1` |
| `pad_button` | `which`, `button: standard browser index`, `pressed` |
| `pad_trigger` | `which`, `button: 6|7`, `value: 0..1`, `was_down` |
| `pad_device` | `which`, `event: "added"|"removed"|"remapped"` |

`KeyboardEvent` has DOM field names `key`, `code`, `location`, `shiftKey`,
`ctrlKey`, `altKey`, `metaKey`, `isComposing`, `repeat`, `editableTarget` and
`keyCode`; omitted fields have empty/false/zero defaults. Keyboard `key` is at
most 64 UTF-8 bytes, `code` at most 32, location is 0..3, and legacy keyCode is
0..65535. `Modifiers` is `{ "shift": false, "control": false, "alt": false }`,
with false defaults.

Example physical mobile movement request:

```json
{"kind":"keyboard","phase":"down","event":{"key":"1","code":"Numpad1","location":3}}
```

This yields original `VKEY_END`, not a translated/default Rust movement action.
Touch buttons must send physical-key equivalents through the same adapter.

## Keyboard and committed text

All original navigation/control codes and F1..F12 (131..142) are preserved.
Physical Numpad1..9 retain the original SDL navigation aliases regardless of
NumLock; NumpadEnter is Enter. Other keypad keys have no alias in this pinned
driver and are ignored. Top-row digits remain printable quick-slot key codes.

Printable ASCII keeps the actual character in `Key.ASCII`, while `Key.Code`
uses the exact 95-byte original `Keys32_126` unshift table. Uppercase and shifted
punctuation infer Shift as original `PrintableToIOEvent` does, including
CapsLock-generated uppercase. Native modifier masks are Shift=256, Alt=512 and
Control=1024. Alt and Control chords survive for original custom bindings.
Key-down flags preserve pressed/repeated; key-up is unpressed and never repeated.

Editable targets, composition, legacy keyCode 229 and all Meta chords are
ignored. Alt+Tab/Escape/F4/Space and Alt+Left/Right are also ignored to preserve
OS/browser navigation. Browser Ctrl+R/L/T/W/N/P/S/F/D/O/H/J/K, Ctrl+Tab/F4 and
Ctrl+plus/equal/minus/underscore/zero are ignored, including Shift variants.
These browser-reserved chords cannot be rebound through this adapter. Original
Ctrl+navigation bindings, including PageUp/PageDown, remain captured; Ctrl+Alt
custom chords remain available. Unrecognized keys, non-ASCII key values, dead keys and
modifier-only keys do not become native commands. The browser should call
`preventDefault` only when a keyboard result is captured, and only while the
game input surface owns focus.

Actual typed input travels separately as `VEVENT_TEXT`. The browser must emit
only committed text while `drl_host.text_input` is enabled, avoid forwarding
interim composition updates, and deduplicate `compositionend`/`beforeinput`.
The browser-only Pascal bridge suppresses the original ASCII key-down append;
inherited text-event handling decodes UTF-8. `Key.ASCII` remains available to
command/modal logic and is never populated with UTF-8 bytes.

Text requests are bounded to 4096 UTF-8 bytes. Nonempty printable text splits
losslessly into packets of at most 63 bytes, preserving whole extended graphemes
including combining marks, CJK and emoji/ZWJ sequences. No tail is discarded.
NUL or other control characters, and a single grapheme larger than 63 bytes,
reject the entire request. Every text packet is NUL-terminated with zeroed
unused bytes. This proves wire integrity, not removal of original editor/name
length limits or all native wide-character layout limits. External names remain
verbatim and receive no localization.

## Pointer and controller conversion

Pointer `x`/`y` are integer, zero-based cells in the complete 80x25 console.
The adapter validates half-open bounds and adds one for the original console
mouse coordinates. Frame and draw coordinates remain zero-based. Out-of-console
pointers are ignored. Relative motion is bounded to +/-80 columns and +/-25
rows. DOM button 0/1/2 becomes original left/middle/right 1/2/3; extra buttons
3/4 retain original UNKNOWN=0. DOM `buttons` accepts bits0..4 and converts to the
original enum bitset. Mouse modifier masks are retained.

Finite negative browser wheel deltaY produces original WHEEL_UP=4; positive
produces WHEEL_DOWN=5. Each wheel event produces one pressed mouse-down packet,
matching the original driver, and zero delta produces none.

Standard browser gamepad buttons 0..3 retain A/B/X/Y. Bumpers 4/5 become native
9/10, Back/Start 8/9 become 4/6, stick buttons 10/11 become 7/8, D-pad 12..15
become 11..14, and Guide 16 becomes 5. Standard trigger buttons 6/7 must use
`pad_trigger`; other nonstandard button layouts are rejected until a supported
mapping is supplied. Browser gamepad indices are bounded to 0..31.

Stick axes retain native axis ordinals 0..3. Finite values in -1..1 convert to
the full signed 16-bit range (-32768..32767), rounding to nearest with ties away
from zero; the adapter adds no deadzone. Trigger values 0..1 become axes4/5 in
0..32767. The original strict hysteresis presses above 10000 and releases below
8000. The axis packet comes first, followed by a native LEFTTRIGGER=26 or
RIGHTTRIGGER=27 down/up packet only when state changes, matching original SDL
pending-event order.

Trigger held state is explicit input/output to a pure function. The browser
transport stores it per selected controller and resets both held values on
device changes. Select one active controller, matching the original driver's
single active gamepad; do not combine independent pads into the same original
modal held-button state. Device ordinals are Added=0, Removed=1, Remapped=2.

## Event wire

The first 64 bytes are sixteen little-endian 32-bit words; the second 64 bytes
are a zero-filled text buffer. Signed coordinates/axis/which use signed 32-bit
two's-complement byte representation, not JSON/compiler record serialization.

| Word | Field |
| --- | --- |
| 0 | version 1 |
| 1 | type: key-down1, key-up2, mouse-move3, mouse-down4, mouse-up5, pad-axis6, pad-down7, pad-up8, pad-device9, text10 |
| 2 | key code / pad axis / pad device ordinal |
| 3 | printable key ASCII, otherwise zero |
| 4 | native modifier mask |
| 5 | pressed bit0, repeated bit1 |
| 6, 7 | native mouse x/y, one-based |
| 8, 9 | relative mouse x/y |
| 10 | native mouse/pad button ordinal |
| 11 | native mouse button-state bitset |
| 12 | signed pad axis value |
| 13 | signed pad controller index |
| 14 | reserved system code, zero for these adapter requests |
| 15 | UTF-8 text byte length, at most 63 |

## Verification status

Sixteen Rust integration tests were authored for exact source key constants,
all 95 printable ASCII mappings, NumLock/keypad identity, modifiers, key-up and
repeat, IME/focus/OS shortcut exclusion, CJK/combining/astral text boundaries,
pointer coordinates/button bits, wheel validation, standard pad mapping, axis
ranges, exact trigger hysteresis boundaries/event order, JSON DTO rejection and
repeatability. `rustfmt --edition 2024` parsed/formatted the owned Rust files.

Compilation and execution are pending the parent's shared Windows resource
hold. No Cargo build/link or browser process was launched for this milestone.
Actual original-game input/IME/controller behavior must be verified after the
module is wired into the newly built WASM and original-core browser page.
