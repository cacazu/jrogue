# NetHack Rust boundaries

The official NetHack 5.0.0 C engine owns gameplay rules, RNG, turns, knowledge,
and logical save data. This crate implements pure boundaries around that engine.
It is not a Rust rewrite of the NetHack gameplay engine.

| Module | Responsibility |
| --- | --- |
| `domain` | Validated English semantic text IDs and typed, already-public observations |
| `application` | Context-aware keyboard, touch, and gamepad command intents; complete UTF-8 text insertions |
| `presentation` | EN/JA JSON template formatting, Japanese default, explicit fallback diagnostics |
| `platform` | Opaque engine-save envelopes with source, ABI, version, size, encoding, and CRC32 checks |
| `ffi` | Borrowed-buffer adapter for the engine module's C/Wasm memory |

Formatting, repeated rendering, changing language, and input mapping never call
the engine or RNG. The C adapter must capture text IDs and visible arguments at
the source output call. This crate does not infer gameplay meaning from completed
English prose, and its tests do not establish complete game-text coverage.

Catalog JSON has `en` and `ja` maps, for example:

```json
{"en":{"game.you_hit":"You hit {monster} for {damage}."},"ja":{"game.you_hit":"{monster}に{damage}のダメージ。"}}
```

An event contains a semantic ID and typed arguments:

```json
{"id":"game.you_hit","args":{"monster":{"type":"text","value":"オーク"},"damage":{"type":"integer","value":4}}}
```

Argument types are `text`, `integer`, `unsigned`, `boolean`, `text_id`, and `event`.
`text_id` resolves an already-public, argument-free name in the catalog; names
with source arguments are rejected in every locale. `event` carries an owned
nested `{id,args}` observation for locale-specific public name composition:

```json
{"id":"game.hit","args":{"target":{"type":"event","value":{"id":"name.custom","args":{"name":{"type":"text_id","value":"entity.orc"},"label":{"type":"text","value":"100% {custom} 🐈"}}}}}}
```

Plain placeholders and `%s` render nested events recursively and propagate any
inner English fallback. Producers supply already-public article, quantity,
invisibility, saddle, and custom-name facts; the formatter never calls native
name routines or infers hidden properties. The root event has depth zero;
nested depths one through eight are valid. The entire tree permits at most 512
events, 4096 argument slots, 64 slots per event, and 256 KiB of cumulative UTF-8
literal, ID, and argument-name bytes. Validation includes union arguments unused
by the selected locale. Owned Rust boxes form a tree; browser adapters reject
cycles before copying or serializing JavaScript objects.
Each render call also permits at most 8192 event/placeholder expansions so
repeated empty nested names cannot multiply work while evading output bounds.
Exhausting this local budget returns an error and retains native fallback.

Free text remains literal UTF-8, including
percent signs, braces, and emoji. Templates use `{name}`, and `{{`/`}}` escape
literal braces. Unknown IDs, malformed templates, missing/extra arguments, and
different EN/JA argument schemas return errors. A missing Japanese entry falls
back to English with a separate diagnostic flag.

The semantic source checkpoint extends templates with a colon and an explicit
native printf specifier, such as `{arg_1:%ld}`, `{arg_2:%03o}`, or
`{arg_3:%.20s}`. Argument names match the source contract (`arg_1`, `arg_2`, ...);
numeric payloads are signed/unsigned JSON numbers, not preformatted strings.
Supported core conversions are `d`, `i`, `u`, `o`, `x`, `X`, `s`, and `c`, with
the native `-`, `+`, space, `#`, and `0` flags where defined; constant widths and
precisions; and integer lengths `hh`, `h`, `l`, `ll`, `j`, `z`, and `t`.
Dynamic width/precision references use unambiguous bracketed argument names:
`{arg_3:%*[arg_1].*[arg_2]s}`. The referenced dimensions remain separate signed
integer arguments. Negative width means left alignment; negative precision is
omitted. All dimensions and final output are bounded by 128 KiB.

`%c` follows C's promoted integer-to-unsigned-byte conversion, then renders an
ASCII byte. Thus integer 33 becomes `!`, not `33`. NUL and non-ASCII single bytes
return an error so the host retains the exact native fallback; arbitrary integers
are not interpreted as Unicode scalar values. UTF-8 strings remain literal.
String precision counts bytes and stops at the preceding UTF-8 boundary rather
than splitting a code point. Pointers, `%n`, floating conversions, positional
`$` formats, and unbound `*` specifiers are rejected. The observed official core
inventory uses the supported conversions; resource-language substitutions are
separate semantic contracts, not printf conversions.

Catalogs may declare an optional `argument_schemas` map for locale grammar:

```json
{"en":{"quest.challenge":"{quest_nemesis_modifier_a} challenges you."},"ja":{"quest.challenge":"{quest_nemesis}が挑んでくる。"},"argument_schemas":{"quest.challenge":["quest_nemesis_modifier_a","quest_nemesis"]}}
```

Each locale may use a different subset of the explicitly declared source-public
union. The event must contain that exact union, and used types must be compatible.
Without a declaration, the existing exact EN/JA argument-name rule remains.
Producers capture the already selected base value and original post-modifier
value without repeating a game lookup or random choice. A declaration does not
authorize exposing hidden state, and no unused dummy formatter is needed.

An optional `context.quest` records the native quest sequence, original output
line identity, source selection, and capture completeness. Its exact fields are
`sequence` (nonzero u32), `lineIndex`, `lineCount` (1..4096), `final`,
`captureComplete`, `window` (i32), `resolvedSection`, `resolvedMessageId`,
`itemIndex`, `field` (`text` or `item`), `sourceTemplate`, and `decodedLine`.
`final` must identify the last zero-based native line. Text fields use item index
zero; selected array items use a positive index. Resolved section/message names
are bounded to 160 bytes; copied diagnostic source/decoded text is bounded to
64 KiB and never used for runtime matching or semantic decoding.

The formatter rejects quest envelopes until `final` and `captureComplete` are
both true and the event contains the complete declared source argument union.
The browser assembles actual accepted native rows by frozen sequence/window
identity, requires equal repeated argument values, and keeps native originals
on incomplete or conflicting groups. Locale paragraph line breaks may differ
from original English rows. Rust holds no mutable quest aggregation state and
never repeats `convert_arg`, name selection, RNG, or Lua lookup. Native history
and synopsis remain explicit English fallback until separately bound.

Gameplay catalogs are separate from the browser UI catalog. The additive
`nh_rust_format_gameplay` and `nh_rust_format_gameplay_fallback` APIs accept the
frozen native envelope:

```json
{"event":{"id":"nethack.message.example.0123456789","args":{"arg_1":{"type":"integer","value":33}}},"context":{"api":"You_feel","helperVariant":"dream","locationPrefix":null}}
```

Gameplay catalog entries contain complete English and Japanese helper messages.
Plain/quoted context retains the original ID. Dream, underwater, and blind
context selects `variant.dream.<ID>`, `variant.underwater.<ID>`, or
`variant.blind.<ID>`. Missing variants return an error rather than losing their
meaning by rendering a plain message. IDs retain the original readable English
segments and terminal ten-digit lowercase hexadecimal source fingerprint;
only that terminal fingerprint may start with a digit.

`locationPrefix` contains the accessibility qualifier already computed by C,
without its following colon. `context.location_prefix` composes its literal
value with the message using locale-owned punctuation. The qualifier remains
visible and Japanese rendering reports fallback until the qualifier has its
own semantic translation. No Rust formatter repeats `coord_desc`, inspects game
state, guesses meaning from completed English, or changes message suppression.
The location rule contains the two plain slots `{location}` and `{text}`;
composition keeps the rendered body's 128 KiB bound rather than treating it as
a new 64 KiB captured source string.

Limits remain 16 MiB per catalog, 64 arguments per event, 160 bytes per semantic ID,
64 KiB per public string, and 128 KiB per rendered observation. The additive
gameplay envelope accepts 256 KiB to include escaped typed strings and context.
The v1 direct-event exports and ABI version remain available. The 49 native Rust
tests cover numeric formatting, character punctuation, UTF-8 boundaries, declared
quest unions, frozen variants, accessibility qualifiers, nested name grammar,
aggregate/work bounds, inner fallback, exact numeric round trips, and incomplete
quest capture. The parent recorded an initial actual 49-test pass, applied Cargo
formatting, and passed strict Clippy with `-D warnings`. Final native tests over
the formatted source and the aligned release Wasm build remain pending their
separate reports. Native Rust results establish these adapter contracts; actual
C producer association, Wasm linkage, and browser gameplay require their own
integration evidence.

`verification.json` describes the historical compiled v1 source.
`source-checkpoint-phase3.json` preserves the original source-only, uncompiled
checkpoint. `source-checkpoint-phase3-formatted.json` binds the later formatted
Cargo/source/header/docs and the frozen 3,026-pair gameplay catalog, records the
initial native test/formatting/Clippy results, and leaves final formatted native
results pending until their actual report is supplied. Local HTML/Node delivery
is the current target; this checkpoint does not establish a hosted Site.

`nethack_layers.h` defines the C ABI. Contexts are command=0, direction=1,
menu=2, More=3, text=4, yes/no=5. Movement controls only produce movement keys in
command/direction contexts. Operating-system Meta shortcuts are ignored; Alt
encodes the original NetHack meta high bit. Unicode insertions use the text
adapter rather than being narrowed to command bytes. Browser adapters own
composition handling, gamepad deadzones, repeat timing, and engine prompt state.
`nh_rust_direction_pad` accepts the public layout reported by the engine:
vi=0, number-pad=1, phone-pad=2, QWERTZ=3. Number-pad running emits the original
Meta digit rather than uppercase or an invented command. These mappings follow
official `src/cmd.c` direction tables and run bindings; options stay in the engine.
`nh_rust_text_insert` validates and copies a complete UTF-8 text submission in
text context. Embedded NUL is rejected; empty completed text is valid. It does
not submit commands or mutate the engine.

All input buffers are borrowed. Callers allocate/free output with the linked
engine module's `malloc`/`free`. Buffer functions return required byte lengths,
without NUL terminators; null output with zero capacity queries the size.
Insufficient capacity writes nothing. Negative error values are in the header.
Pointers and buffers must be valid, immutable/writable as appropriate, and
nonoverlapping. The adapter cannot validate a fabricated nonnull pointer.

Save format `jrogue.nethack.save` v1 accepts at most 16 MiB of opaque engine
payload, encoded as canonical lowercase hex. It binds release 5.0.0, official
commit `16ff59115315917b93185d026aeefea06db9b0f4`, and ABI
`nethack-shim-5.0.0-v1`. Restore validates the whole envelope before returning
payload bytes. CRC32 detects accidental corruption; it is not authentication.
The engine adapter must supply an actual valid save checkpoint and restore it
in a fresh compatible module. Native raw saves from other ABIs are incompatible.

Dependencies are exactly pinned to cached serde 1.0.229 and serde_json 1.0.151;
the lockfile pins transitive crates. Build/verification from `nethack/`:

```powershell
cargo fmt --manifest-path rust/Cargo.toml --check
cargo test --offline --manifest-path rust/Cargo.toml
cargo clippy --offline --manifest-path rust/Cargo.toml --all-targets -- -D warnings
cargo build --offline --manifest-path rust/Cargo.toml --release --lib --target wasm32-unknown-emscripten
```

The output `rust/target/wasm32-unknown-emscripten/release/libnethack_layers.a`
links directly into the official C engine module. The library contains no C/JS
imports. Tests cover adapter errors and input/text/save boundaries, not gameplay,
browser storage transactions, production hosting, or full Japanese translation.
Miri is recommended for CI over valid-pointer FFI tests when a compatible nightly
toolchain is available; no toolchain installation is required by this crate.

The report recorder only binds existing test logs and resource reports to their
checkpoint; it never runs Cargo. Its default paths preserve the initial report
workflow. A final formatted run can use explicit paths, relative to `nethack/`:

```powershell
python tools/record-rust-phase3-tests.py --checkpoint rust/source-checkpoint-phase3-formatted.json --resource build/rust-phase3-formatted-test-resource.json --log build/rust-phase3-formatted-test.log --output build/rust-phase3-formatted-test-verification.json
```

The recorder rejects changed source/catalog hashes, nonzero test exits, or a
test log that does not prove all 49 tests passed. It does not carry historical
engine/browser passes into a new native Rust report.
