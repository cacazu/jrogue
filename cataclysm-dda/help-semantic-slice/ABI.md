# Prepared help observation ABI

The source-only interface family is `cdda-help-observation/1`. It does not reuse
the live-context four-export ABI, authorize commands, or contain an implemented
serializer. The C++ structs and Rust parser describe the next connection; they
have not been compiled together.

An available wire envelope requires `interface`, `schema_version: 1`, the exact
`source_commit`, the integration `engine_build_id`, canonical unsigned-decimal
string `publication_sequence`, `available: true`, `title`, `topic_name`, literal
`loaded_source`/`loaded_file`, and the six original ordered `blocks`.
The title/name/text records are `{id, key_parameters: [...]}`. Scalar
`TextEvent.parameters` are always `{}`; each key parameter is separately
`{name, value: {category, action, origin, bindings}}` and has reviewed
KeyBinding semantics. None is a free-text substitution or accepted input event.

A binding contains `{native, enabled_for_presentation, single_printable}`.
`native` holds `event_type`, ordered unique modifiers, signed `i32` sequence,
exact UTF-8 `text`, `edit`, and `edit_refresh`. Values match the live-input
observer's source enums: `keyboard_char` and `keyboard_code` remain distinct;
modifier order is `ctrl`, `alt`, `shift`; binding origin is `context`, `default`
or `missing`. A future serializer must map the C++ member `native.type` to
`event_type`, and enum `default_context` to wire `default`, rather than exposing
an enum's numeric implementation value.

Text blocks serialize as `{kind: "text", text: ...}`. The direction block is
`{kind: "structured_direction_grid", grid: {category: "DEFAULTMODE", cells}}`;
it carries no semantic text ID. Cells remain row-major: north-west, north,
north-east, west, pause, east, south-west, south, south-east. Each has two
nullable alternatives. A missing first alternative requires the second also
missing. The selected alternatives must satisfy the original printable,
enabled, single-code keyboard/no-modifier policy. C++ owns that selection;
Rust only checks the copied shape and uses it immutably.

An unavailable envelope contains only identity/publication plus
`available: false`, with all content fields omitted. The default unavailable
C++ struct has empty title/name/block members; a future serializer **must omit
these payload members**, rather than writing invalid empty text IDs. Counter
exhaustion uses sequence `"0"` and unavailable state. A host must clear its
previous help view on unavailable, transfer failure, malformed identity, or
pin failure; it must not retain an older frame as current.

Limits are 262,144 total wire bytes, 16,384 per literal identity/text/edit field,
128 bindings per action, 64 signed codes per binding, three ordered modifiers,
nine cells, two alternatives, six blocks, and the five reviewed named key
parameters. The C++ capture helpers enforce binding count/sequence/text bounds;
the serializer, total byte cap, UTF-8 validation and immutable pin lifecycle are
still missing. The Rust parser has no engine memory, RNG, simulation, storage,
clock or input handle.

Only copied owned UTF-8 JSON may be passed to Rust. Any future pin/data/size/
release boundary must use the live observer's bounded immediate-copy protocol,
refresh the current WASM heap view, release in `finally`, validate source/build
identity and publication, and never retain a borrowed native pointer across an
asynchronous boundary. The existing live-input snapshot cannot be passed
directly to this help parser: these are separately versioned envelope families.

Native key-name/description formatting remains unresolved. The Rust consumer
outputs typed key nodes with long-description intent/light-blue style and
filtered original enabled order. It does not fabricate SDL key names, translate
literal user text, join bindings with an unreviewed separator, or pretend grid
cell descriptors are final glyphs. Original short/long key-name and separator
definitions need their own source-bound semantic migration before this help UI
is actually rendered by Rust.

The C++ sink is currently one synchronous borrowed-record callback, with
observer reentry suppressed and exceptions contained. It has no supported
deferred host delivery or latest-snapshot storage yet. The selected scope clears
on exit; nested key-editor refresh and real Asyncify ordering remain actual
engine/browser test requirements. Untracked direct native input readers remain
explicit and all command authorization is denied.
