# Reviewed semantic text: implemented Rust adapter and JSON ABI

Status: source integrated and native Rust tested. The latest dependency-free adapter run passed **54/54 tests** (29 new tests plus the original 25). This does not validate the new C producer hooks, a complete engine link, the corresponding WASM, browser behavior, CJK reflow, packaging, or publication. Those require the separately coordinated whole-engine milestone.

Upstream is Angband 4.2.6 commit `f3082213b73f3e463e3d0d60bff4b00462beae6e`. The implementation is [localization.rs](../rust/src/localization.rs), [its bounded JSON parser](../rust/src/localization/json.rs), and [text_parameters.rs](../rust/src/text_parameters.rs), registered by [lib.rs](../rust/src/lib.rs). The old message, rendering, input, RNG-checkpoint, save and journal APIs remain in place.

## Catalog availability and scope

The generated [review-en.json](../locales/review-en.json), [review-ja.json](../locales/review-ja.json), and [review-schema.json](../locales/review-schema.json) contain **941 matching reviewed IDs**: 469 character-data entries, 413 birth/sidebar entries, 48 command entries, and 11 money names. They are generated from the reviewed inventories by [generate-reviewed-catalogs.mjs](../tools/generate-reviewed-catalogs.mjs); edit those inventories and regenerate rather than inventing a second ID set.

The adapter validates exact EN/JA/schema key coverage, unique declarations, and required placeholder sets for every template. Current classification is 857 parameter-free templates, 45 primitive-only templates, and 39 descriptor-dependent templates. These are catalog/API availability counts, not counts of localized engine callsites. Four envelopes require unavailable full monster/object grammar. Generated and unknown-provenance history also remains outside translated projection; observed user-edited history may be copied verbatim.

The canonical 22 parameterized or composed command IDs match [commands-text.json](../migration/commands-text.json) and the closed Rust declarations. The remaining 26 parameter-free command support IDs form a separate descriptor fragment vocabulary. For C source hook coverage and its remaining boundaries, see [COMMAND_TEXT_INTEGRATION.md](COMMAND_TEXT_INTEGRATION.md). Complete game translation remains false.

## Implemented C ABI

The new renderer accepts owned JSON events synchronously:

```c
#include <stdint.h>

const char *ab_rs_review_static(const uint8_t *id, uint32_t id_len);
const char *ab_rs_review_event(const uint8_t *json, uint32_t json_len);
uint32_t ab_rs_review_status(void);
const char *ab_rs_review_error(void);
```

A static call succeeds only for a parameter-free reviewed ID. A parameterized ID with no arguments reports missing-argument status 7. The event shape is:

```json
{
  "schema_version": 1,
  "id": "game.dig.terrain.progress",
  "channel": "message",
  "context": "command",
  "widget": "log",
  "severity": 0,
  "sound": 0,
  "params": {
    "terrain": {
      "type": "ApparentTerrain",
      "value": {"name_id": "terrain.granite.name"}
    },
    "digging_method": {"type": "DiggingMethod", "value": "hands"}
  }
}
```

Required fields are schema_version=1, id and params. Optional channel is message or ui; context and widget are strings up to 127 UTF-8 bytes; severity and sound are signed int32 facts. Other top-level fields are rejected. Layout hints and nontext UI controls belong to the host projection rather than the string formatter.

Each named parameter contains type and value. An optional origin is accepted only as origin=user for verbatim_user_text; generated or unknown provenance is explicitly unsupported. Parameter objects reject other fields. Object keys are unique throughout JSON, including escaped spellings that decode to the same key.

Successful calls return a Rust-owned NUL-terminated UTF-8 pointer. It remains valid until the next review_static or review_event call on the same thread. A failed call returns NULL, invalidates prior result availability, and stores a status and developer diagnostic. Status/error accessors do not invalidate either buffer. Review buffers are independent of legacy message, frame, and save buffers.

The C bridge calls ab_rs_review_event, then ab_host_semantic_event(json,length,localized). The host must copy both JSON and localized text synchronously before C event storage is released or another renderer call occurs. NULL is forwarded as an explicit renderer failure. The original engine msg/msgt path, sound category, feedback gates and More behavior remain the responsibility of the C producer; neither an error nor a callback authorizes rerunning the command.

The native JSON builder can admit broader intermediate bounds than Rust. Rust's stricter limits below govern renderer acceptance: currently all producers fit within six parameters and their small native buffers. Future producers must not infer a 32-parameter or 128-KiB individual-string Rust allowance from the C builder.

## Typed values and formatting policy

| Canonical schema type | Accepted wire value |
| --- | --- |
| integer | Signed integer; integer or int32 transport tag |
| int32 | Signed integer within [-2147483648,2147483647] |
| signed_integer | Signed integer, formatted with explicit + for zero/nonnegative values; integer/int32 aliases permitted |
| decimal_one_place | Signed integer tenths, never a float |
| character_name, verbatim_user_text | Opaque UTF-8 string; opaque_text alias permitted |
| canonical_identity | Unchanged ASCII parser identity with letters/digits/underscore/hyphen, 1–127 bytes; opaque_text alias permitted |
| display_token | Canonical decimal 0–10, or ?, *, $ |
| localized_text | Reviewed semantic ID reference; text_id alias permitted |
| localized_text_list | Ordered reviewed references with a reviewed list style; text_id_list alias permitted |
| Reviewed command descriptor class | Its class-specific owned semantic value below |

Decimal values are primitive facts rather than completed C display strings. Generic integers use signed 64-bit storage; an int32 wire tag additionally enforces int32 bounds. Decimal tenths format without floating-point conversion, including a negative fractional sign. Explicit plus signs are selected only by the source-defined signed_integer schema. The overweight whole component uses ordinary integer because upstream uses %d.

Two source-defined stat IDs select minimum zero padding from their identity, without changing the supplied integer or its schema type: player.stat.notation.above_18 uses width 2 (1 becomes 01), and player.stat.notation.above_100 uses width 3. Larger values are never clipped. C cell alignment spaces are outside these semantic templates.

An external string is copied once and never localized, reparsed as a template, or used as a printf format. Usernames, inscriptions, braces and percent characters remain verbatim. C callers must use msg("%s",rendered) or the corresponding msgt category after checking for NULL.

A localized_text value is a reviewed static ID string or an object containing id and optional typed params. For example, an ability wrapper can reference player.ability.element.resistance.name, whose element references element.fire.name. A completed English name is not a catalog key or a permitted opaque substitute for localized_text.

The sole reviewed list style is birth_realm_conjunction, for birth.class.learns_realms. Its ordered IDs must belong to magic.realm.*.name. English joins A; A and B; or A, B and C without an Oxford comma. Japanese joins with 、. An ordered array is shorthand for that style at that envelope; an explicit value is {"style":"birth_realm_conjunction","ids":[...]}. Other styles fail explicitly.

## Descriptor resolution boundaries

Descriptor values are resolved from reviewed IDs, enums and immutable captured facts. They are not already-formatted m_name, o_name, with_clause, join, or gold buf strings.

| Class | Accepted owned value and source resolution |
| --- | --- |
| DiggingMethod | hands, weapon, swap_digger; resolves the three game.dig.method.* fragments |
| ApparentTerrain | {"name_id":"terrain.*.name"}, derived from original player-known feature/mimic |
| TerrainDiagnosticReference | Exactly one of name_id (actual diagnostic terrain family) or terrain_index:int32; the index branch uses game.terrain.diagnostic.index |
| TrapName | {"name_id":"trap.label.*"}, preserving the exact reviewed name-field alias |
| MoneyKindName | {"name_id":"money.*.name"}, one of the reviewed money catalog identities |
| ObjectFeeling | grade 0–10 and embedded_clause/combined_clause context matching the envelope |
| MonsterFeeling | grade 0–9 and standalone_clause/combined_clause context matching the envelope |
| FeelingConjunction | and or yet; resolves the reviewed joining fragment |
| GoldPickupMessage | single_kind with gold_amount:int32 and treasure:{name_id:...}, or mixed_kinds with amount and no individual treasure |
| MonsterDescription, KnownObjectDescription | Owned capture records are carried by C, but full descriptor rendering is unavailable and returns status 26 |

Known feeling grades select reviewed fragments only after the original source disclosure gate. A monster-only envelope contains no object grade. The original conjunction predicate selects and/yet in C; Rust renders that captured choice without recomputing simulation decisions. Japanese fragments and their envelope punctuation are authored separately rather than assembled in English and replaced.

Gold composition preserves the existing total, original single/mixed discriminator and selected semantic key copied before object deletion. The renderer selects a full reviewed branch, then inserts a typed result into game.pickup.gold.summary. Mixed captures containing an individual treasure are rejected. English retains upstream “gold pieces” even at amount 1. The C producer retains verbal/nonzero gates, ignored-object accumulation, purse updates and sound thresholds.

A live entity ID is insufficient to render a past event: actors or objects can be deleted, changed, or have IDs reused before later display. Capture visibility, knowledge and disclosed identity at emission into owned immutable facts. Preserve exact MDESC/ODESC mode, observer, quantity, relevant grammar, appositives/offscreen state and external text. The renderer never queries live C pointers or recovers undisclosed names from IDs. Full monster pronoun/name/unique/article grammar and known-object flavor/artifact/ego/charge/inscription grammar require further reviewed resolution; the current adapter does not claim those are implemented.

Unmapped named-descriptor sentinel values such as {"complete":false,"reason":"UnsupportedCatalogIdentity"} intentionally fail strict named-capture validation with status 27, because supported named values contain only name_id. An unknown name_id reports unknown-ID status 1. These explicit failures do not silently fall back to English. The native source message remains available through its original path.

## Bounds, ownership and purity

Templates use named {name} placeholders, escaped {{ and }}, and names matching [a-z][a-z0-9_]{0,62}. Declarations and arguments are unique and form the exact required set. Repeated use of a declared placeholder is valid and uses the same immutable value. Malformed braces, unknown placeholders, missing/extra arguments and wrong types are explicit errors; output is never truncated.

Formatter bounds are 16 parameters, 63-byte names, 8,192-byte templates and values, 128 placeholder occurrences, and 32,768-byte output. The event parser admits at most 128 KiB, depth 32, 8,192 JSON value nodes and 8,192 bytes per decoded string. Nested semantic formatting has a separate recursion limit of 8. JSON numbers are integer-only: fractions, exponents, leading-zero numbers and out-of-int64 values are rejected.

Schema parsing is separately bounded to 8 MiB, depth 32, 100,000 value nodes and 32,768 bytes per metadata string. Flat catalogs are bounded to 8 MiB each, ID lengths to 127 bytes, template/value lengths to 8,192 bytes, and schema records to 4,096. Schema metadata is not interpreted as gameplay text. Every EN/JA key must have exactly one schema record.

For nonzero input spans, C promises allocated, initialized, readable memory live for the synchronous call. IDs use 1–127 bytes; event spans use 1–131,072 bytes. Rust detects null, zero/oversized lengths and address overflow before slice construction; u8 alignment is one. It validates UTF-8 and rejects NUL before producing a C string. It cannot prove that an arbitrary foreign pointer is allocated or still live. Any JavaScript address wrapper must validate current heap bounds and checked span arithmetic before forwarding a pointer.

The selected locale is shared with ab_rs_set_locale: 0 English, 1 Japanese, Japanese default. Unsupported locale numbers retain the established Japanese-default behavior. A locale change affects the next call and does not rewrite a previously returned historical string.

Formatting uses immutable catalogs/captures and changes only its dedicated output/error cache. It does not draw RNG, journal input, disturb the player, change repetitions, mutate knowledge or access gameplay state. Original descriptor side effects, such as object_desc everseen updates, remain on the original C path exactly once; semantic capture must not rerun those routines. Native purity tests cover legacy Rust screen/journal/save/message/frame and checkpoint metadata; they do not establish C gameplay-state or browser purity.

## Status and error API

| Status | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Unknown semantic/catalog ID |
| 2–6 | Invalid parameter name, duplicate schema, undeclared/missing placeholder, malformed braces |
| 7–10 | Missing/extra/duplicate argument or wrong primitive/descriptor class |
| 11 | int32 out of range |
| 12–13 | Descriptor unavailable or locale mismatch |
| 14–18 | Parameter/reference/template/value/output bounds |
| 19 | Detectable invalid foreign span contract |
| 20–21 | Invalid UTF-8 or embedded NUL |
| 24 | Invalid/unavailable reviewed catalog |
| 25 | Malformed JSON, duplicate object key, or parser bound |
| 26 | Unimplemented descriptor/list/provenance integration |
| 27 | Invalid typed capture, field, tag, family or clause context |
| 28 | Nested semantic recursion limit |

This status space is independent of save/RNG/legacy message APIs. ab_rs_review_error exposes developer details, not an English gameplay replacement. Arbitrary dangling memory is outside the foreign caller contract; status 19 does not promise to recover every invalid pointer.

## Verification and remaining milestone

The first native run passed 52/52 tests (27 new plus 25 existing). After source-defined stat padding and regenerated schemas, the latest run passed **54/54** (29 new plus 25 existing), including all 941 generated template schemas. New cases cover parser Unicode/surrogates and numeric/duplicate/bound failures, canonical schema parity, opaque external text, nested IDs, list order/style, integer sign/tenths/padding, terrain/trap families, feeling disclosure shape, gold composition, unsupported grammar, and independent FFI transport buffers.

Evidence is [rust-test.log](../tests/source-integration-evidence/rust-test.log) and [rust-test-resources.json](../tests/source-integration-evidence/rust-test-resources.json). The parent ran cargo test --offline --lib --jobs 1 in an isolated native target directory. Latest wall time was 4.203 s including compilation; sampled aggregate process working-set peak was 223,113,216 bytes (about 212.8 MiB). Sampling every 20 ms can miss brief peaks. These measurements apply to the native Rust adapter job, not a C engine/WASM/browser build.

The remaining milestone must compile/link the actual source producer hooks, confirm all four exported symbols, verify copied capture facts and error/lifetime behavior at native yield/deletion points, compare C RNG/save/replay state, and exercise the whole browser game on PC/mobile with CJK layout and resume. Full names/plurals, generated-history grammar, help, errors/settings and other unreviewed game text remain separate migration work. A catalog's availability and the passing Rust suite do not authorize claiming all 941 IDs are already displayed correctly in the accepted browser deployment.
