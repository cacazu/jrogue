# Native semantic producer integration

Added 2026-10-02. The integration code follows the NGPL; original NetHack source
headers and copyright notices remain intact in every generated source patch.

`instrument-semantic-text.py` generates fixed C wrappers for every exact base
message call in `locales/gameplay-core.metadata.json`. The current source-only
checkpoint contains 771 source IDs at 786 calls. The composed patch changes
63 original C files, including emission ownership, quest, and public name
observers. Helper variants and lexical entity labels remain separate from
message producer counts. No source-only count implies runtime verification.

The default command writes `generated/semantic.patch`, per-source wrapper
headers, the C bridge and `generated/audit.json`. It does not apply a working
source change, compile, link, launch a browser or change existing artifacts.
Every source call is checked against its immutable official line, API and
ordered expression tokens. A second structural check reverses only the API
identifier replacement and proves that the original argument expressions and
English literal tokens remain exactly once.

Each wrapper receives the original arguments through a fixed C prototype,
captures public string values and C32 numeric values, calls the original API,
then releases its presentation scope. `%s` snapshots are also forwarded to the
original API, so instrumentation cannot overwrite a static naming buffer.
Invalid UTF8 or allocation failures retain the original pointer as the English
fallback. Original argument expressions, including naming or hallucination
producers, are evaluated once; no name function is rerun. C's original
unspecified argument evaluation order remains unspecified.

Original helper, message-type, no-repeat, English history, sounds, logging and
input-response logic remains in the original engine. Narrow hooks claim a
logical owner in `vpline`, `vraw_printf`, `add_menu` and `yn_function`. The owner
becomes visible only around the exact accepted native window callback. Nested
unseeded messages receive no semantic owner. Accessibility recursion forwards
the owner explicitly and snapshots the already-computed `dirstr` without `: `;
it never reruns `coord_desc`. The original native truncation paths invalidate
semantic output and preserve the original truncated English.

The getter is synchronous and read-only:

```c
const char *nh_abi_semantic_event(const char *callback_name, int window);
```

Use the actual window for `shim_putstr`, `shim_add_menu` and `shim_end_menu`;
use `-1` for callbacks without a window. Unbound channels, including status,
return null. A successful return is a NUL-terminated UTF8 JSON envelope:

```json
{"event":{"id":"nethack.message.example","args":{"arg_1":{"type":"text","value":"public text"}}},"context":{"api":"You","helperVariant":"plain"}}
```

Arguments preserve canonical `arg_1` names and explicit `text`, `integer`,
`unsigned`, or nested `event` tags. The public-name sidecar selects a descriptor
by the original buffer pointer and generation; its original byte snapshot
rejects stale or transformed buffers. The descriptor is copied before the
English argument copy, and the original API still receives English. Supported
ordinary monster/object branches are recorded by the independent name/object
audits; custom, composed, hidden, hallucinated, and unmapped paths retain
original public text according to those audits. Integers are int32/uint32,
including WASM's 32-bit `long`, so
JavaScript can preserve their exact numeric values. `%c` remains its promoted
integer and the catalog's `%c` conversion renders the corresponding byte.
`helperVariant` is `plain`, `dream`, `underwater`, `blind` or `quoted`, captured
from the same read-only conditions used by the original helper. Optional
`locationPrefix` contains only the already-observed accessibility qualifier.
Catalogs and the additive Rust formatter own complete helper and variant text;
missing contracts keep the original native English as explicit fallback.

Scopes and JSON live in separate heap allocations across Asyncify callbacks.
Repeated getter calls do not consume or mutate a scope. JSON rejects invalid
UTF8, escapes quotes, backslashes and control bytes, and fails closed at 64
arguments, 65,536 bytes per string, 262,144 bytes per envelope or 160 bytes per
ID. IDs and argument names are generated from validated metadata; the native
bridge is not a general untrusted-ID input API. Unsupported public raw string
arguments remain explicit incomplete entity localization; no rendered-English
lookup or lexicon matching occurs.

Quest descriptors use the original resolved section, message ID, and selected
native array index. Original `rn2`, `convert_arg`, article, pronoun, plural,
possessive, stripping, window delivery and English history processing remain
in place. The observer copies `convert_arg`'s base before the original modifier
and the already-appended result after that original branch. It never repeats a
name producer or selects an extra quest fact for a translated template.

The 943 quest descriptors include 755 public text/array paragraphs and 188
history-only synopsis strings. Synopsis and `rawtext` gameplay consumers keep
the original English and emit no quest semantic UI event. Public paragraphs
carry cumulative typed argument snapshots and this optional context:

```json
{"quest":{"sequence":1,"lineIndex":0,"lineCount":1,"final":true,"captureComplete":true,"window":2,"resolvedSection":"Arc","resolvedMessageId":"encourage","itemIndex":1,"field":"item","sourceTemplate":"original source template","decodedLine":"original converted line"}}
```

Every field is required. Sequence is presentation-only u32, starts at one in
a fresh module, and fails closed on overflow. Line index is zero-based;
line count is 1..4096, computed from pure bytes using the original splitting
semantics. Item index is zero for `text`, otherwise the original 1-based array
selection. `final` means the last original line; `captureComplete` requires the
full catalog argument union. Strings are bounded as above. Diagnostic source
template and decoded line never select an ID or a translation by matching.

The browser must retain every original accepted row and replace that same
presentation group only after all unique ordered indexes and a complete final
event are available. Missing, filtered, duplicate or inconsistent rows,
conflicting argument snapshots, oversized unbroken segments, invalid UTF8 or
allocation failure retain native English. Multiline groups with an observed
accessibility qualifier also retain English until that qualifier has an
explicit complete group rendering contract. Group allocation failure clears
the active observer rather than inheriting an outer quest; that outer capture
then degrades to English without changing native delivery or gameplay.

The build integration is opt-in with `build-upstream.py --semantic-text`.
`--semantic-text --prepare-only` prepares instrumented working source without
starting a compiler. The eventual heavy build requires a freshly rebuilt Rust
static library with the two additive gameplay formatter exports. The opt-in
pipeline rebuilds the default Rust archive instead of reusing the historical
ABI; an explicitly provided archive is still checked by the linker. The pipeline
rejects unresolved linker symbols and records compiled versus runtime-tested
producer status separately. `test-semantic-source.py` checks exact source
bindings, adversarial C expression parsing, original name/RNG/knowledge call
counts and immutable upstream/browser artifact hashes without a compiler.

The previous engine's last incremental pipeline was 48.92 seconds with four
compile jobs. Its object/log tree was 6,032,994 bytes, SDK cache 25,557,558 bytes,
modified upstream/Lua tree 30,790,450 bytes, and Rust WASM release tree
43,187,847 bytes. Peak process RAM was not measured. This phase changes 63
original source files and adds three bridge compilation units; use one
compiler job (`--jobs 1`) and one heavy-build slot,
and measure the compiler/link/Asyncify process tree rather than inventing a
peak-memory figure. This checkpoint has run Python source checks only.

The selected resource plan has 173 C/Lua compilation units: 170 existing and
three bridges. The initial semantic header fingerprint invalidates the 63
changed original units plus the three bridges; setup may also refresh its ABI
or generated utility sources. Header-only metadata changes invalidate those
affected objects instead of leaving stale name/quest tables. Outer C workers,
Cargo jobs, task-local `EMCC_CORES` and `BINARYEN_CORES` all follow `--jobs`.
With `--jobs 1`, task-local `CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1` also caps
Rust release code generation; Cargo.toml, the SDK and global settings remain
unchanged. Native utilities, data probing and the final link run sequentially.
Only these explicit resource selections are written to build provenance.
