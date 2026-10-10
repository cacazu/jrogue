# Native plural leaf preparation

This separate source-bound milestone prepares **155 existing public IDs**
through the actual typed Rust `Catalog` term API: **149 item names, three
monster names and three event-statistic descriptions**. All retain their
normalized IDs and exact source forms. It does not modify the earlier
315-entry package, MO, translations, shared Rust APIs, original C++ or gameplay.

The source is Cataclysm: DDA 0.I-1,
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. This remains an **unconnected
candidate catalog and adapter**. Genuine Rust consumption, native selector
fixture execution subsequently passed in an explicitly released build window;
original producer annotation and FFI integration remain pending.
The inventory establishes exact raw leaf contracts and specific caller
witnesses, not an exhaustive native caller graph or complete name assembly.

## Deliverables and verified scope

| File | Contents |
| --- | --- |
| `output/en.json`, `output/ja.json` | Actual Rust catalog schema: 155 unchanged public term IDs plus one internal test binder |
| `output/consumer-inventory.json` | Every source binding, owner/variant identity, plural derivation, exact consumer/selector interface, C++ source fingerprints and actual Japanese MO evidence |
| `output/blocked-identities.json` | Zero currently ambiguous raw leaf identities; this does not remove the live producer blockers below |
| `output/summary.json` | Exact coverage, unresolved producer situations and explicit runtime gates |
| `output/node-verification.json` | 14 passing lightweight source/model tests, 2,500 exact modeled formats, original input and unchanged 315-package hashes |
| `output/pending-consumer-tests.json` | Retained historical source-preparation snapshot |
| `output/genuine-consumer-verification.json` | Five actual Rust tests and the compiled/executed standalone wasm32 C++ selector fixture, with exact scoped evidence |
| `selector.mjs` | Strict source-bound selector fixture model; rejects unknown routes and unsupported narrowing |
| `rust-verification/src/lib.rs` | Isolated unconnected adapter using existing `ParameterValue::Term`, `TextEvent` and `TextId` |
| `native-selector-fixtures.cpp` | Compiled original-language boundary fixtures; still separate from the original engine producer |

There are **200 exact JSON pointer/owner bindings** for these 155 IDs:
135 base item names, 59 variant names, three monster names and three statistic
descriptions. Duplicate strings/source aliases share their existing public
ID, while each binding retains its separate producer route. Native loading
derives 34 forms as `raw + "s"`, reads 159 invariant `str_sp` forms, and reads
seven explicit `str_pl` forms, counted per binding. The converter independently
checks these native rules against every immutable definition and the existing
source inventory; it does not regenerate English plural forms from grammar.

All 155 exact Japanese translations and singular/plural source bindings match
the real generated MO. Its SHA-256 is
`336dc66ccd4d1e828832a38756cddcc165e0f1af917f546752b5655ff02705e7`;
its actual header specifies `nplurals=1; plural=0;`. The check uses bounded
random access and a streaming hash instead of loading the whole MO into one
allocation. All current leaf contexts are empty; contexts are still retained
and checked in the inventory. Missing Japanese translations would invoke the
original English fallback, so count invariance is claimed only for these
verified present entries.

## Actual consumer and selector mapping

| Definition / source consumer | Native selector and scope |
| --- | --- |
| Base item `name`; `itype::load`, `src/item_factory.cpp:4127–4128` → `itype::nname`, `src/itype.cpp:107–114` | `unsigned int quantity`; the **live resolved** `LIQUID` phase forces quantity to 1 before `translation::translated(int)` |
| Variant `name`; `itype_variant_data::load`, `src/item_factory.cpp:3011–3015` → `item::type_name`, `src/item.cpp:15416–15417` | Selected variant's `alt_name.translated(quantity)` directly; **no liquid clamp** |
| Monster `name`; `mtype::load`, `src/monstergenerator.cpp:754–755` → `mtype::nname`, `src/mtype.cpp:341–343` | Quantity passes directly to `translation::translated(int)` |
| Statistic `description`; `event_statistic::load`, `src/event_statistics.cpp:1217–1223` → `score::description`, `:1274–1288` | Current `int_` value supplies `val.get<int>()`; non-integer variants use default count 1 |
| Same statistic description → `text_for_requirement`, `src/achievement.cpp:482–508` | Integer requirements select with **target**, not current value; `anything` uses default 1; custom descriptions bypass this leaf |

`translation::translated(int)`, `src/translation.cpp:296–326`, dispatches a
plural-enabled object through `n_gettext` or contextual `npgettext`. Native
`n_gettext` takes `std::size_t`; the contextual path first accepts
`unsigned long long`, then the manager uses `std::size_t`. The original
fallback selects singular exactly when final native `n == 1`, otherwise
plural (`src/translation_manager_impl.cpp:178–190`, `:218–233`). It does not
clamp negative inputs or take an absolute value.

The prepared native C++ fixture computes the actual native conversion and
freezes **One/Other**. The Rust adapter consumes that frozen category and maps
it to declared term-selector representatives 1/0. These are **not displayed
quantities** and are used only for this English/Japanese pair. Rust performs
no unsigned cast, phase inference, count extraction from visible text, or
selection of target versus current value.

Node fixtures cover `0, 1, 2, -1, INT_MIN, INT_MAX`. For already valid int32
inputs, the pinned native `n == 1` condition has the same category as
`num == 1`; the mirror tests this category without fabricating a cast value.
Non-liquid/variant/monster quantities beyond `INT_MAX` require the original
C++ frozen selector and are rejected by the Node mirror. A base liquid
quantity up to `UINT32_MAX` remains safe because the original clamp to 1
precedes conversion. The standalone fixture subsequently compiled with the
pinned installed Clang and ran under Node for wasm32. Both native narrowing
ABI gates, signed/contextual conversions and liquid/unclamped boundary cases
passed. The source-mirrored fixture does not call the original engine's
translation cache, MO or loaded producer.

## Existing Rust API usage

English term entries have `parameters: {}`, `one` equal to the exact singular,
and `other` equal to the exact native plural. Japanese entries have only
`parameters: {}` and invariant `other`. Literal braces are doubled solely to
preserve the formatter's visible text. No `{count}` is inserted into names or
descriptions.

The existing `Catalog::term` resolves a parameter-free term using its external
`ParameterValue::Term { id, count }`. A top-level `TextEvent::plain` cannot
select an external count and formats `other`; it must not be presented as
faithful singular/plural consumption. The candidate therefore adds one
distinct **internal test-only**, unconnected binder:
`cdda_internal_test.native_plural_leaf_dispatch`, with typed adapter operand
`leaf: term` and template `{leaf}`. This binder is absent from all 539 existing
public IDs and both sides of the reviewed registry. It is not an upstream
text or an inferred printf parameter role.

Original quirks remain explicit. The monster plural `velites` drops the
singular's `Parallax-3E` prefix; generated `zombie military polices` remains
unchanged. The diary selects names using cumulative kills even when displaying
a delta (`src/diary.cpp:266`, `:289`, `:298–300`). The score kill list uses
default singular `m.nname()` while displaying kill totals separately
(`src/scores_ui.cpp:175`). Compass names use an aggregate count
(`src/display.cpp:1392`). These witnessed caller choices are preserved,
not replaced with a blanket displayed-count rule.

## Explicit live producer blockers

No inspected raw leaf has conflicting native forms or an unsupported template
after exact source checks. The following situations remain blocked even
though its catalog entry can be prepared:

- The original resolved item phase is missing. Raw JSON omits explicit phase
  for all current bindings, and inheritance/mod overrides remain native.
- The selected item variant, resolved type, definition origin or caller route
  is unknown. Native identity annotation and mod load precedence are pending.
- An unsigned quantity requires narrowing and the original C++ selector has
  not been frozen. Node must not guess that conversion.
- A statistic's current value is substituted for an achievement target, or an
  integer selector is invented for a non-integer/default-one route.
- A dynamic item/monster/score result is supplied as this raw leaf. Item
  variables, blood names, conditional names and corpse qualifiers remain
  original (`src/item.cpp:15401–15501`). Monster nicknames replace the name;
  unique and fused names add contextual wrappers (`src/monster.cpp:706–725`).
- A missing translation needs fallback, or a final loaded definition no
  longer matches this immutable source binding. No live fallback/override
  policy is implemented here.

## Verification commands

The original standard-library Node preparation checks were:

```powershell
& 'C:\Program Files\nodejs\node.exe' semantic-plural-slice/prepare.mjs
& 'C:\Program Files\nodejs\node.exe' semantic-plural-slice/test.mjs
& 'C:\Program Files\nodejs\node.exe' semantic-plural-slice/prepare.mjs --check
```

Five genuine Rust consumer tests subsequently passed against the existing packages.
They load both catalogs, format all 155 terms through the actual typed API,
check both English forms and Japanese invariance, retain the irregular plural,
exercise frozen boundary fixture categories, and verify plain-event and
missing-ID behavior. They do not execute C++ selector functions.

The exact executed commands and limits are in
[`../semantic-runtime-catalog/build-plan/consumer-results.json`](../semantic-runtime-catalog/build-plan/consumer-results.json).
Repeating compiler work requires a newly released parent slot and fresh gates.
The tested Rust arguments were:

```powershell
cargo test --offline --locked --jobs 1 --manifest-path semantic-plural-slice/rust-verification/Cargo.toml --target x86_64-pc-windows-gnu --target-dir semantic-plural-slice/rust-verification/target --test plural -- --test-threads=1
```

Current genuine proof records `rustConsumerVerified: true` and a passing
standalone native selector fixture. Earlier generated conversion/model files
retain their historical preparation flags. `originalProducerConnected`,
`runtimeConnected`, full caller-graph verification and whole-game semantic
migration remain false. Actual C++ producer/FFI, complete name assembly and
real game flows are still required. No browser, npm, packing, upstream write
or Git action occurred in the consumer window. The initial sandbox SDK spawn
failure and successful scoped escalation are preserved separately; no ACL,
security, global SDK configuration or frozen cache regeneration was performed.

Original texts and translations retain upstream CC BY-SA 3.0 licensing and
attribution/source-provenance obligations.
