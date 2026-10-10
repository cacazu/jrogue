# Source-only selected helper producers

This isolated proposal captures completed public returns from the original NetHack 5.0.0 helper branches. It contains no compiler, game, browser, or apply command. Runtime and integration approval remain false. Original source is pinned to commit `16ff59115315917b93185d026aeefea06db9b0f4`; all ten inspected file hashes are in `coverage.manifest.json`. Keep the upstream NetHack General Public License and notices, and provide the corresponding modified source with any distribution.

`prepare.py` writes only inside this directory. Its pure `transform_source` function can be reviewed for composition by the engine owner. The generated upstream copies and patch are inspection fixtures; the real upstream tree, canonical catalogs, and active build inputs remain untouched. `prepare.py --check` and `check.py` perform Python source checks only.

The source catalog contains 321 unique public English label IDs and 415 original selected literal token records. There are 320 source-reviewed Japanese labels with proposed descriptors. The ambiguous original public spelling `gill` remains unbound and keeps whole native English: the same word is a fungal lamella or a respiratory gill, and exporting a hidden table family to choose Japanese would add anatomy information. The manifest distinguishes lexical table evidence from executed caller coverage.

| Producer | Source-only coverage | Explicit fallback |
| --- | --- | --- |
| `body_part` / `mbodypart` | 29 original returns, 12 tables of 19 slots, 14 selected direct literal tokens. `body_part` forwards once to the original `mbodypart`. | Ambiguous `gill`, an unscoped call, multiple matching observations, or a transformed/copied result. |
| `hcolor` | 74 original table labels; the exact original display RNG index runs once. | Original preference return. |
| `hliquid` | 40 original table labels at the already selected `indx`; original predicates, optional preference candidate, RNG and `IndexOk` remain intact. | Original preference return, including its optional originally selected random candidate. |
| `locomotion` / `stagger` | Seven active tables, four original verb/capitalization slots; 24 distinct public labels. | Original default verb; downstream case/tense/copy transformations. The commented swim table is excluded. |
| `plur` | An opt-in typed macro preserves the original arbitrary numeric type and exactly one comparison; chosen `""` or `"s"` has a complete suffix event. | Original macro, or a whole-message contract that has not proved the English-only grammar omission and full argument union. |
| `P_NAME` | An opt-in typed macro preserves the original repeated `type` evaluations and `martial_bonus()` once; two original tables contain 17 label tokens. | Positive `OBJ_NAME` branch and any subsequent modification of the selected label. Unused table entries remain source evidence, not claimed executions. |
| `uhe` / `uhim` / `uhis`; `mhe` / `mhim` / `mhis`; `noit_mhe` / `noit_mhim` / `noit_mhis` | Nine opt-in owned-value macros preserve the original he/him/his field and original computed index once. Twelve exact public literals from four original rows have distinct subject, object, and possessive roles. | Downstream case, copy, reflexive, consumed-prefix or precision operations need their own completed-output contract. The original visibility/no-it/Hallucination predicates and `rn2(4)` are untouched. |

`otense` / `vtense`, `s_suffix`, and `gu.urole` are audited deferrals, with source ranges and required contracts in the manifest. Tense needs owned public subject/lemma snapshots before `nextobuf()`, the original completed tense branch, and original case. A bare verb input is not a completed phrase. Possessive composition needs an owned public input before the static buffer is copied or overwritten, its generation, and the one original native branch. `urole` is mutable role data rather than a helper function. No helper, state, name, RNG, anatomy, or knowledge query is added to resolve these deferrals.

## Owned value interface

Use source-call replacements such as `nh_phase6_body_part_value(original_part_expression)` only at reviewed original emission argument sites. The wrapper keeps the original arguments, creates a small automatic expected-helper scope, invokes the original helper once, and closes the scope. A hook in the original already selected return records a public lexical label into that scope. Calls without a scope remain inert. Only one observation of the expected kind, the exact completed return pointer, and intact copied original bytes produce a descriptor. The bytes check integrity and never choose an ID.

`struct nh_phase6_helper_value` owns `event_json[192]`, an `event_valid` flag, and the original native pointer. Its descriptor uses the existing name-event ABI, `{"id":"nethack.helper.…","args":{}}`. The public output snapshot bound inside its temporary scope is 96 bytes. Both bounds cover every generated literal and ID; `check.py` verifies them and the event field names. These are bounded byte arrays, without heap allocation or 4096-byte per-argument buffers. Compiler-confirmed layout and total emitter stack use still require later measurement. On a conventional 64-bit C layout the returned struct is approximately 208 bytes, so 23 returned values would occupy about 4.8 KiB before other locals; this is an estimate rather than a compiled measurement.

The emitter wrapper must retain the owning struct as its formal value until the semantic capture copies the JSON, then invoke the original C API using `value.original`. **Do not return a `nh_phase4_text_value.event_json` pointer into a temporary inline struct from an intermediate function.** Copying the owning struct is safe; retaining a pointer into an expired temporary is not. The engine owner reviewed this interface as compatible in principle; actual composition remains unapproved.

The original helpers retain their existing return APIs. The original `plur` and `P_NAME` macros also stay byte for byte intact; only separate opt-in value macros are generated. The opt-in `plur` macro avoids introducing an `int` or `long` conversion. The opt-in `P_NAME` macro preserves its original branch-specific argument evaluation counts rather than trying to evaluate its parameter only once.

The scope root points only to live automatic frames, without a persistent pointer registry or cache. C compilers can pool identical static literal pointers, so pointer plus original bytes cannot safely identify a producer outside that scope. Public IDs depend on the selected public label and original capitalization, not a hidden body-table family, species, role, or pointer. The original synchronous engine is assumed; threading, reentry through engine callbacks, or nonlocal exits need reviewed context ownership and cleanup before runtime approval.

Only a fully source-proven completed value may reach a Japanese whole-message template. Unsupported nested expressions, mutable downstream copies, sidecar failures, unused branches, or unproven `%s` precision and consumed prefixes keep the complete original English frame. Preserve every original printf type, flag, slot name, argument union, helper meaning, predicate, callback/API argument evaluation order, and original formatter value. This proposal does not prove all caller coverage or executed Japanese.

## Verification

Run with the workspace Python:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' .\prepare.py
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' .\prepare.py --check
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' .\check.py
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' .\check.py --report
```

The optional report command writes only `source-checks.results.json` here, including verified result fields and artifact hashes. The checks verify exact official source hashes; every literal token, ordinal, byte slice and line; ID/JSON/output bounds; independent unwrapping of return hooks to byte-identical original source; unchanged native predicate/RNG/helper argument tokens and counts; exact normalization of both opt-in macros to original control expressions; six original wrapper calls exactly once; inline ownership; no bridge state/name/RNG query or static-pointer registry; explicit excluded comments and deferrals; and deterministic generated artifacts. C compilation, executed lifetime/case/overwrite behavior, semantic callback parity, browser Japanese, and gameplay coverage remain integration work for the engine owner.
