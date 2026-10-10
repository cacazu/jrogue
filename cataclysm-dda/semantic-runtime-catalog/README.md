# Source-bound Rust catalog preparation

This isolated milestone converts **315 of the 539 reviewed current-source
additions** into the actual `RawCatalog` / `RawEntry` JSON schema consumed by
`rust-contracts/presentation/src/lib.rs::Catalog::from_json`. The remaining
**224 IDs are explicitly excluded with exact source bindings and reasons**.
These files do not replace the original game's gettext/MO consumer, and they
do not establish complete semantic migration or actual runtime integration.

The subsequently authorized native build window passed **all seven genuine
Rust consumer tests** with `--offline --locked`, one build worker and one test
thread. Current scoped evidence is
[`output/genuine-consumer-verification.json`](output/genuine-consumer-verification.json).
The earlier conversion and Node files remain preparation snapshots; their
false consumer flags describe that earlier stage. Original producer/FFI and
live-game runtime integration remain pending.

The source is Cataclysm: DDA 0.I-1, commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. The immutable upstream, the existing
539-entry companion catalogs, reviewed translations, ID registry, and Rust
packages are read-only inputs. No gameplay, source translation, public ID,
native plural selection, or RNG behavior is modified here.

## Deliverables

| File | Purpose |
| --- | --- |
| `output/en.json`, `output/ja.json` | Actual Rust catalog schema, matching 315 existing normalized public IDs |
| `output/provenance.json` | Exact source pointers/owners, gettext contexts, candidate aliases, ID mapping, original text hashes, immutable source fingerprints |
| `output/blockers.json` | All 224 rejected identities, their exact English/Japanese strings, bindings and every applicable reason |
| `output/conversion-summary.json` | Input hashes, counts, source verification, pending consumer/runtime work |
| `output/node-verification.json` | Passing Node model tests and byte-level artifact/input evidence |
| `output/rust-verification-status.json` | Retained historical preparation snapshot; superseded for consumer execution by the genuine proof |
| `output/genuine-consumer-verification.json` | Seven actual Rust consumer passes, compiled source/catalog/lock hashes, exact command/logs and bounded resource evidence |
| `rust-verification/tests/catalog.rs` | Isolated tests using the existing Rust dependencies and public APIs |

The prepared catalogs have only `schema_version`, `locale`, and `entries` at
the root. Every entry has `parameters: {}` and `other`. Provenance is kept in
separate files because the actual Rust structs reject unknown fields.
`Catalog::validate_contract_pair` deliberately validates a different, bounded
30-ID contract; it must not be used as the coverage check for these 315 IDs.

## Fidelity and limitations

The converter retains every normalized public ID exactly. Original gettext
contexts remain in the provenance records even though Rust's current ID-based
catalog has no context field. Source candidate IDs are aliases for review,
never additional runtime entries or silently renamed identities.

Before conversion, the collector directly traverses all 613 affected immutable
JSON pointers and owner definitions, compares their exact English values and
owner identities, and checks source fingerprints against the independent
539-record verification. The 14 C++ records retain the earlier exact official
xgettext evidence; this lightweight milestone does not rerun that extraction.

The only permitted template transformation doubles each literal `{` and `}`.
The inspected Rust tokenizer then yields the exact original visible text,
including whitespace, punctuation and UTF-8. None of these 315 actual pairs
contain braces; ten adversarial fixtures establish the transformation in the
Node mirror; the corresponding genuine Rust fixtures subsequently passed.

Printf-like directives are detected independently from both original strings,
and their type/position signatures must match the companion metadata. No
named roles are invented from `%s` or argument position. Two exact help
paragraphs contain literal percentages that resemble printf grammar. Their
exception is bound to their existing IDs, both exact string hashes, and help
definition ownership. The immutable `src/help.cpp:244` / `:278` consumer
translates these paragraphs into `scrollable_text` directly without printf;
its fingerprint is recorded. Any change to the reviewed texts removes the
exception. Other unknown producer interpretations still require a real
consumer mapping before runtime connection.

The **primary, mutually exclusive partition of the 224 exclusions** is:

| Reason | Entries | Required next mapping |
| --- | ---: | --- |
| Native plural | 155 | Actual call-site count selector and English/JA term behavior |
| Snippet ownership | 40 | Preserve selected snippet identity, native expansion and RNG in C++ |
| Printf parameters | 12 | Reviewed named roles and typed parameter producers |
| Rich text / dynamic angle tokens | 11 | Structured tokens and explicit consumers, including color and name tokens |
| Dialogue control prefix | 6 | Original `*` / `&` behavior at the dialogue consumer |

Reasons can overlap. The full non-exclusive inventory has 17 rich/dynamic
angle-token records, alongside 155 native plural, 40 snippet, 12 printf and
6 dialogue-prefix records. All applicable reasons are stored per identity.
The literal-only profile blocks every native-plural and snippet-owned entry
even when its text could technically be stored without parameters.

## Verification

The standard-library Node preparation/checks run without npm packages:

```powershell
& 'C:\Program Files\nodejs\node.exe' semantic-runtime-catalog/convert.mjs
& 'C:\Program Files\nodejs\node.exe' semantic-runtime-catalog/test.mjs
& 'C:\Program Files\nodejs\node.exe' semantic-runtime-catalog/convert.mjs --check
```

The Node suite verifies strict schema and grammar, exact 630 literal formats,
the complete 315/224 ID partition, provenance/alias parity, blockers,
independent printf detection, brace fixtures, malformed Unicode and template
rejection, plural schema fixtures, deterministic generation and unchanged
inputs. Its formatter is an explicitly labeled mirror of inspected Rust
code; passing these checks does not establish actual Rust consumption.

The isolated Cargo manifest depends on the existing `cdda-logic-contract` and
`cdda-presentation` packages plus the same pinned, already-used `serde_json`.
Its seven tests directly load both generated catalogs, format all 315 entries
against exact original text, check all 224 IDs stay absent, retain public
identities, enforce Japanese default, test braces/UTF-8, reject extra
parameters, unknown schema fields, malformed templates and lone surrogate
escapes. The current `Catalog` API has no implicit locale fallback; missing
IDs must return `MissingId` in both locales. A future host fallback policy
requires separate explicit implementation and verification.

The exact executed command, environment and guard are recorded in
[`build-plan/consumer-build-plan.json`](build-plan/consumer-build-plan.json)
and [`build-plan/consumer-results.json`](build-plan/consumer-results.json).
Repeating any compiler work requires a newly released parent slot and fresh
memory gates. The tested Cargo arguments were:

```powershell
cargo test --offline --locked --jobs 1 --manifest-path semantic-runtime-catalog/rust-verification/Cargo.toml --target x86_64-pc-windows-gnu --target-dir semantic-runtime-catalog/rust-verification/target --test catalog -- --test-threads=1
```

The genuine proof establishes catalog-consumer compatibility for these 315
entries. It records `rustConsumerVerified: true`, while `runtimeConnected`
and whole-game semantic migration remain false. No browser or original-game
producer was exercised. The original C++ producer/FFI and real game flows are
further gates. Source, translations, catalog bytes, locks and frozen cache
sanity were unchanged through the bounded build.

Original game texts and translations retain their upstream licensing and
attribution obligations (CC BY-SA 3.0). This directory does not grant a new
license for those texts or remove their source-provenance requirements.
