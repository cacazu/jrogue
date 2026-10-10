Phase four is an isolated source preparation for the pinned official NetHack
5.0.0 commit `16ff59115315917b93185d026aeefea06db9b0f4`. The frozen phase-three
catalog, generated patch, applied working engine and compiled browser remain
unchanged. Added 2026-10-02; preserve the upstream NGPL notices.

Run these Python-only checks from the nethack directory:

```powershell
& C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe tools\instrument-semantic-phase4.py
& C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe tools\semantic-text\phase4\prepare-impossible.py
& C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe tools\semantic-text\phase4\prepare-dynamic-literals.py
& C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe tools\semantic-text\phase4\audit-frozen-visibility.py
& C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe tools\test-semantic-phase4.py
& C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe tools\build-upstream.py --phase4-semantic-text --prepare-only --jobs 1
& C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe tools\test-combined-semantic.py
```

The handoff is `../phase4-generated/`:

| File | Meaning |
| --- | --- |
| `metadata.json` | Exact primary source IDs, API/prototypes, promoted printf types, original argument expressions, helper variants and conditional branch evidence. |
| `catalog.json` | Additive EN/JA runtime-shaped resource. Unreviewed IDs have no JA entry. |
| `untranslated-primary-ids.json` | Disjoint authoring priorities: 1,636 zero-argument IDs, 20 numeric-only IDs and 2,535 text/mixed IDs. |
| `audit.json` | Every core literal-call disposition; no deferred visible error is removed from the full denominator. |
| `call-operations.json` | Exact original calls and replacements for pure joint source composition. |
| `phase4.patch` | Review diff against pristine source, not a patch to apply over the frozen engine blindly. |
| `bridge-delta.patch` | Separate exact `getlin` callback eligibility change. |
| `source-checks.json` | Source-test results and file hashes; no compiler/runtime claim. |
| `diagnostic-contract/` | Original first-`impossible` ownership/truncation preparation. |
| `diagnostic-wrappers/` | 559 exact original diagnostic IDs at 564 sites, with one text-precision scope excluded. |
| `dynamic-literals/` | Separate 59 original selected-format origins, 126 EN-only primary IDs and an exact accepted/rejected visibility ledger. |
| `frozen-visibility-audit.json` | Read-only C771/786-site audit: no text precision, unconsumed variadic slot or JA-only source union field. |

The lexical core denominator is 6,175 literal call sites representing 5,984
distinct source IDs, plus 963 dynamic origins. Phase three covers 771 IDs at
786 exact sites. This preparation adds 4,229 IDs at 4,393 static sites, including
one extra site of an existing phase-three ID, and four reviewed dynamic
origins. Together the literal source preparations cover 5,000/5,984 IDs
(83.6%) at 5,179/6,175 sites (83.9%). These numbers describe source contracts;
they do not establish executed output, active preprocessor branches, or full
Japanese coverage. The four prepared dynamic origins leave 959 dynamic
origins without runtime bindings. The separate dynamic-literal preparation
adds 59 source-only origins with 126 primary EN IDs and 33 helper variant IDs;
900/963 origins still lack any source preparation. Its JA catalog is empty.

The combined preparation also captures the first original `impossible`
diagnostic under 559 exact literal IDs. This raises literal source-contract
coverage to 5,559/5,984 IDs. Fatal diagnostics, configuration queues, live logs,
dump-forwarded text and the exit message remain visible deferred contracts.
The combined source uses 5,020 additional exact call replacements across 107
original C files; none establishes a runtime callback or full Japanese coverage.

Three broad static IDs (five text slots) use printf precision, so their wrapper
calls the original API directly without constructing a semantic scope or JSON.
The public-prefix producer is pending; complete computed names must never be
serialized merely because Rust can truncate them later. This leaves 4,390 of
the 4,393 added static sites eligible for semantic capture. The dynamic-literal
preparation rejects text precision, opaque values and any selected branch that
leaves an original argument unconsumed. Every eligible branch consumes the
same full promoted union. All original predicates and argument evaluations
remain in C exactly once, including rejected/unused private values.

Only the separate reviewed 38 static and four dynamic message IDs, their
reviewed literal fragments/variants, and the single existing-ID extension have
JA entries here. The 4,191 untranslated prepared primary IDs still require
faithful Japanese authoring and the applicable public argument descriptors.
The 600 conditionally guarded prepared sites retain original guard evidence;
the compiled translation-unit list does not prove those branches active.

Wrappers retain original C literal and expression tokens, preserve unspecified
C argument order, and evaluate each original argument once. Typed captured
values are passed to the original API. A selected literal value or immutable
format becomes a small typed struct in its original conditional branch; the
condition is never reevaluated. Reviewed raw public fragments become an
EN-only nested event so Japanese formatting reports fallback explicitly.
Player-entered text remains plain text. Name descriptors require the whole
original source argument to be a reviewed direct public-name call, optionally
wrapped by original article helpers. The isolated copied bridge adds a
default-zero permission flag; raw literals, tables, variables and other
composed values perform no registry lookup. Identical bytes or a compiler-pooled
pointer are not producer provenance. Allowed name producers without a valid
sidecar retain whole native English. Selected literal structs carry their
explicit original-branch descriptor. There is no name, knowledge, RNG or
gameplay query. Allocation, bounds, UTF-8 or descriptor failures retain exact
native English output.

The original helper implements prefixes, filters, history, sound and game
state changes. The semantic resource contains each complete helper message;
the existing helper snapshot selects dream/underwater/blind variants. The
native English helper remains authoritative. `%zu` retains its original C
expression and a `size_t` formal parameter; a compile-time wasm32 assertion
allows the pure resource to use the numerically equivalent `%u` specifier.
No 64-bit integer is truncated to accommodate JavaScript.

`getlin` claims its logical owner at original entry and brackets only the
original `win_getlin` callback. The getter additionally requires API `getlin`,
callback `shim_getlin` and window sentinel `-1`. Native queued-input echo
continues through its original `pline`; it does not inherit the prompt event.
The input buffer, command queue, response bytes and input state are unchanged.

Joint generation performs the frozen call API renames and original core,
quest, monster-name and object-name hooks first, then calls the pure
`compose_calls_before_core(source,name,operations)`. The historical function
name does not describe this final ordering. It requires exactly the remaining
original calls and pairs equal contracts in original source order; an uncertain
count fails closed. Headers must be included after `hack.h`, and generated
sources copied into a new reviewed working tree. Apply `getlin_delivery` to
the native windows body and `getlin_getter` to the bridge as part of that
reviewed generation. The separate impossible transform must run before
message-call substitutions: it forwards only the original first diagnostic
pline and rejects semantic capture when the already-formatted buffer would
be truncated by the original BUFSZ terminator. Ancillary log/report messages
remain distinct native emissions. The builder's explicit optional
`--phase4-semantic-text` scope writes only `work/phase4` and `build/phase4`.
After a successful future build its web root is `build/phase4/web` and the
existing fetch path remains `gameplay-core.json`. Existing default generation
remains byte-identical across all 69 source/header/audit/patch outputs.

The final source snapshot lives under `work/phase4/semantic-generated`.
`catalog-audit.json` records activated producer-free frames and queued
descriptor-dependent frames; source approval alone does not install a frame.
`name-eligibility-audit.json` records every text slot's original expression
and registry permission. `source-eligibility-overlay.json` discloses constant
`#if 0` branches. `source-manifest.json` binds source scripts, all generated
headers/helpers, patched C, exact author inputs and merged catalog bytes.
The runtime catalog must stay below the existing 16MiB Rust input limit.

The next build would add one C helper to the existing 173 compiled units,
for 174 total. A fresh isolated build requires all 174 units; a verified object
cache could limit a later change to 107 patched units and four helper units.
Source estimates cannot establish peak memory. The parent must
grant the heavy-build slot and keep one compile job total, including Cargo,
EMCC_CORES/BINARYEN_CORES and task-local Rust codegen units. Rust formatting
needs no ABI addition for these contracts. No such build has run here.

The remaining visible classes include configuration errors, fatal diagnostics,
native history presentation, opaque dynamic/macro formats, local composed
buffers, menu/option/command description tables, help/data prose, rumors and
unbound public name grammar. None is declared complete because its source
is deferred. Platform-only inactive code may be excluded only after an exact
target/preprocessor audit. Legal notices remain verbatim with explicit provenance.

A systematic next producer stage should bind lexical table/resource IDs at
the original selected index or file/section/line, and preserve typed arguments
before the original formatter. Local buffer capture needs an explicit lifetime,
generation and byte-integrity contract; a reused stack pointer cannot be a
global identity. Capture already-selected public branches and name descriptors
without repeating predicates, name functions, RNG or hidden-state reads. Any
unsupported modification/composition invalidates the descriptor and falls
back to the original English. Configuration queues and message history require
presentation sidecars aligned to their original records; translated text must
never replace native records used by filters, saves or gameplay logic. Broad
JA authoring, reviewed descriptor bindings, joint source composition, compiler
checks and actual native/browser fixtures all remain completion gates.
