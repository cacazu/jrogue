# Incremental semantic text integration

The next implementation should connect a small, source-bound set of original
C++ UI text producers to the existing Rust formatter. Gameplay, interaction
predicates, item/monster state, turn advancement and random choices remain in
C++. Rust presentation resolves semantic IDs and typed arguments using checked
English/Japanese JSON. This follows [ARCHITECTURE.md](ARCHITECTURE.md) and the
transport plan in [CPP-RUST-BOUNDARY-NEXT.md](CPP-RUST-BOUNDARY-NEXT.md).

This document is grounded in official **0.I-1**, commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. All source paths below refer to that
immutable upstream tree. Future changes belong in the separate port source and
adapter crates. No upstream source, translations or executable artifacts were
changed for this plan.

## What is established, and what remains separate

The official JSON parsers and GNU xgettext mark **105,003 distinct
context/singular keys**: 93,512 JSON keys and 11,881 C++ keys, with 390 shared.
The current JA compiler has filled the 539 actual-source deficits and applied
163 current reviewed earlier patches; the one stale earlier patch is excluded.
`ja-current/verification.json` reports zero untranslated marked keys and
`ja-current/gettext-consumer-verification.json` verifies the independent GNU
consumer. These results establish a source-current gettext catalog. They do not
establish actual-game consumer coverage, unmarked text coverage, semantic
emissions or Rust-rendered gameplay.

The 539 companion JSON entries are an individually reviewed subset, not the
whole game's English/Japanese semantic catalog. A narrow audit of the actual
`ja-current/en.json` and `ja.json` found **359 IDs accepted by the current Rust
`TextId` grammar and 180 rejected**. All 180 rejected IDs contain percent-escaped
inventory-candidate components; 20 also contain numeric-only positional
components. For example:

```text
data.core.mod_migration.id%3DStatsThroughSkills.removal_reason
data.core.achievement.id%3Dachievement_reach_balthazar.requirements.0.description
```

The 359 reviewed `cdda.*` identifiers are a different population from the raw
inventory candidates and should retain their identities. Even the grammar-valid
entries cannot yet be passed directly to `Catalog::from_json`: the companion
schema uses `context`, `text` and `printfParameters`, while the Rust formatter
requires typed `parameters`, `other` and optional `one`/`plural_parameter`.
`source_commit` and `scope` are also extra root fields under the formatter's
current `deny_unknown_fields` rule. Conversion must be explicit and reviewed.
See [SEMANTIC-ID-COMPATIBILITY.json](SEMANTIC-ID-COMPATIBILITY.json) for exact
counts, examples, hashes and the mirrored Rust grammar. That audit records the
files before registry application. The subsequent reviewed
`ja-current/semantic-id-registry.json` normalizes all 180 candidates, preserves
their aliases and exact content/bindings, and establishes grammar validity for
all 539 current public IDs. Runtime schema conversion remains pending.

## Existing producer and consumer entry points

| Existing source | Function or interface | Integration implication |
|---|---|---|
| `src/translations.h:55` and `src/translation_cache.h:18` | `_` → local translation cache → `detail::_translate_internal` | Runtime lookup currently takes English prose. A global lookup hook can measure legacy traffic, but cannot recover the caller's semantic meaning or already-lost argument names. |
| `src/translations.h:64` | `n_gettext` | Calls `TranslationManager::TranslatePlural` with singular, plural and count. Preserve the actual count and per-definition English plural in the new event. |
| `src/translations.h:72` and `:80` | `pgettext`, `npgettext` | Context is part of identity. Identical English with different contexts must remain distinguishable. |
| `src/translations.h:17` and `:25` | `translate_marker`, `translate_marker_context` | Extraction markers only; they do not translate at runtime. Migration must follow the later consumer of each marked value. |
| `src/translation.h:35` | `to_translation`, `pl_translation`, `no_translation`, `make_plural` | Deferred translation and literal data are separate existing concepts. Keep that distinction; `no_translation` must not become an implicit catalog lookup. |
| `src/translation.cpp:124` and `:179` | `translation::deserialize(JsonValue/JsonObject)` | JSON accepts a string or a translation object with `ctxt`, `str`, `str_pl`, `str_sp`, and translator comments. Plural support depends on the receiving object's plural mode. |
| `src/translation.cpp:296` | `translation::translated(num)` | Dispatches singular/plural/context combinations and caches by language generation and count. Add an explicit semantic reference at the owning definition/producer; keep the legacy object during incremental migration. |
| `src/translation_manager.cpp:31` and `src/translation_manager_impl.cpp:162` | `Translate`, `TranslatePlural`, `TranslateWithContext`, `TranslatePluralWithContext` | Current MO consumer boundary. Do not replace this globally with an English-to-ID map and call that semantic integration. |
| `src/translations.cpp:78` | `set_language` | Changes the manager, invalidates caches, resets grammatical-gender checks, reloads snippet names and changes the title. Measure these existing side effects; a Rust locale toggle alone is not proof of original-engine purity. |
| `src/translation_gendered.cpp:33` | `gettext_gendered` | Builds contextual grammatical-gender selectors. Preserve subject identity and the selected grammar context, instead of folding all variants into one sentence. |
| `src/init.cpp:143`, `:280`, `:577` | `DynamicDataLoader::load_object`, help registration, `load_all_from_json` | Original data loading and source/mod identity remain authoritative. Attach semantic metadata at the relevant owning loader, preserving the original dispatch. |
| `src/generic_factory.h:231` and `:295` | Inheritance/definition loading | `copy-from`, abstract definitions, aliases and later overrides require field provenance. A source-file path alone cannot identify the effective loaded definition. |
| `src/input.cpp:237` and `:270` | `input_manager::load` | `action_attributes.name` is loaded by `(category, id)`, with missing category mapped to `default`. Keep user preferences and built-in definitions distinguishable. |
| `src/input_context.cpp:187` and `:1202` | `register_action` override; `get_action_name` | Preserve override → category-specific name → global fallback → literal action ID precedence. Register semantic overrides explicitly; do not infer them from the resulting translated string. |
| `src/help.cpp:55` and `:240` | `help::load_object`, text preparation in `display_help` | Loads title/messages as `translation` objects, then resolves special direction/color blocks and `<press_ACTION>` bindings. These are typed content operations, not global string substitutions. |
| `src/messages.h:46` and `src/messages.cpp:464` | Formatted `add_msg` overloads; `Messages::add_msg` | Most arguments have already been formatted by the message-log boundary. Add a semantic emission overload at the original producer before `string_format`, retaining existing message severity/timestamps/cooldown behavior. |
| `src/messages.cpp:108` and `:115` | Historical message deserialize/serialize | Native saves store already-rendered message strings. Preserve those as legacy literal history; do not guess their IDs or translate them by matching substrings. |

The authoritative extraction specifications are `lang/update_pot.sh`,
`lang/string_extractor/parser.py`, `write_text.py` and the individual official
parser modules. They describe what upstream marks for translation; they are not
runtime semantic-ID interfaces. The independent source-binding evidence is
`catalog-reconcile/output/539-binding-verification.json`: all 539 reviewed
records, 613 JSON pointers/owners and 1,899 nearby terminology pointers match the
immutable source.

## Stable ID registry and source binding rules

Use a checked, versioned registry keyed by meaning and original definition
identity. Separate the public port ID from its provenance. A registry record
should carry:

```json
{
  "id": "input.keybinding.pickup.up.name",
  "source": {
    "namespace": "core",
    "type": "keybinding",
    "definition": {"category": "PICKUP", "id": "UP"},
    "field": "name"
  },
  "bindings": [{"file": "data/raw/keybindings.json", "pointer": "reviewed source pointer"}],
  "legacy": {"context": "", "singular": "Previous item", "plural": null},
  "parameters": {},
  "stability": "reviewed"
}
```

The source strings and JSON pointers are validation metadata, never the public
ID. Preserve leading/trailing whitespace and exact contexts in legacy metadata.
An English wording change should require catalog review but should not rename
the semantic ID. A file move or array insertion updates the binding, not the ID.

For named definitions, begin with content namespace, definition type, exact
upstream identifier or aliases, and field. Add domain-specific discriminators
that the loader actually uses. The keybinding example requires category:
`UP` is “Pan up” in `default`, “Previous item” in `PICKUP`, and “Move cursor up”
in `BIONICS`. Context, variant ID and recipe `result`/`id_suffix` are other
relevant discriminators. Preserve effective mod/override provenance; inherited
text must resolve to the originating field while an overriding field gets its
own explicit binding.

Use readable lowercase ASCII components accepted by current `TextId`, with a
checked maximum of 160 bytes. The deterministic **proposal** procedure is:
derive from structured identity, split CamelCase/acronym boundaries, replace
structural separators with underscores, and assign meaningful role/context
components. For example, propose
`data.core.mod_migration.stats_through_skills.removal_reason` for the first
rejected example. Store the original exact upstream identifier alongside it.
Run collision review before accepting the proposal; case folding is not an
injective mapping of original IDs. Do not strip percent escapes blindly, append
a text hash, or resolve collisions by scan-order counters. Preserve existing
359 accepted reviewed IDs and keep aliases from their old candidate identifiers
for artifact/version migration.

Anonymous definitions and positional fields require an explicit reviewed
identity. Examples include help sections, unnamed snippet entries, response
arrays and requirement descriptions. For the source help object whose current
binding is `data/core/help.json:/1`, assign `help.core.movement` from its meaning;
neither array index 1 nor `order: 1` is the permanent identity. Give its prose
blocks stable role names. For a snippet or nested variant with an existing `id`,
use that ID. For an unnamed entry, maintain a reviewed sidecar binding with a
logical name and update its pointer on reordering. Do not treat category alone
as unique: many snippets share a category. Until reviewed, keep positional
candidates out of the accepted runtime registry.

Generated text needs its generating definition and rule recorded. The remaining
540 official generated occurrences consist of **381 vehicle-part labels** from
variant/base label composition in `lang/string_extractor/parsers/vehicle_part.py`
and **159 recipe-category labels** derived from category identifiers in
`recipe_category.py`. Preserve variant/base IDs and category/subcategory IDs,
then define a presentation composition rule or an explicit reviewed message.
They are not direct source-string pointers.

## Typed parameters, names, plural and rich text

The current Rust contracts already provide `TextId`, `TextEvent`,
`ParameterValue::{UserText, Count, Term}` and an immutable formatter in
`rust-contracts/{logic,presentation}/src/lib.rs`. Reuse these where sufficient.
The first integration must not silently force signed values, decimal measures,
durations, units, key bindings, grammatical selectors or rich text into
`UserText`. Add reviewed parameter types as their original consumers are
migrated, with an ABI/schema version change when the wire contract changes.

Translate each existing printf argument position/type into a named schema at
its source callsite. Keep repeated placeholders, positional reordering,
width/precision arguments and literal percent signs distinct. For example, an
item label, health value and key binding are three different meanings even if
all currently occupy `%s` or `%d`. Numeric formatting, rounding, signs and units
must match the original source behavior. The 539 additions' `printfParameters`
prove position/type preservation for that subset; they do not establish these
semantic names. Never format a translated template as a second printf program.

For English, retain the actual source's singular/plural variants per definition;
for Japanese, use the invariant form with the same required count parameters.
Do not use a blanket “append s” rule. `itype::nname` (`src/itype.cpp:107`) forces
liquid names to singular, while `mtype::nname` (`src/mtype.cpp:341`) delegates
quantity to its translation. These original decisions remain in C++ and must
be represented in the name observation. The source audit has 15 distinct
explicit PO/source plural mismatches and seven implicit reviews; 22 source keys
have multiple nonempty source plural variants. The current compiler separately
records 545 keys with source plural alternatives, a broader count that includes
singular/plural alternatives. These populations must not be conflated.

Dynamic names must be structured observations. `item::tname` and
`item::display_name` (`src/item.cpp:6944`, `:6989`) combine type, variant,
conditional name, faults, damage, contents, custom labels and other state through
`src/item_tname.cpp`. C++ keeps the conditions and visible state authoritative;
Rust formats selected name parts without recomputing mechanics. A monster name
(`src/monster.cpp:706`) may use a type term, nickname, unique name or fused-mission
wrapper. External usernames, player-entered item names, nicknames and free text
remain literal UTF-8. Story-defined/localizable names need explicit term IDs;
never translate an externally supplied name merely because it equals an English
catalog entry.

Preserve color/style tags, emphasis, dialogue action markers, `<npcname>`,
`<press_ACTION>` and snippet symbols as distinct typed tokens. Build a checked
rich-text representation with allowed token kinds; browser adapters render text
and style nodes safely. A direction grid is a structured UI block, not a prose
translation. `help::display_help` currently translates first and resolves
`<press_ACTION>` tokens afterward; the migrated producer should expose the
semantic action identities and current bindings explicitly. Arbitrary user text
is not parsed as a template, markup or HTML.

## Random choices and deterministic persistence

The source already contains display-adjacent RNG consumers:
`snippet_library::random_from_category(category)` calls `rng_bits()` at
`src/text_snippets.cpp:289`, `random_id_from_category` consumes it at `:279`,
`snippet_library::expand` recursively chooses replacements at `:250`, and
`help.cpp::get_hint` invokes random snippet selection. These cannot be called
again from Rust render, locale switching, resizing or repeated observation.

At the original C++ interaction/command boundary, select the same weighted
snippet/name branch as before and freeze its identity, grammar selectors,
resolved variable values and rich-text dependencies. Where the source already
accepts an explicit seed, preserve that seed's original semantics; adding a seed
argument alone is not proof that repaint stopped consuming the gameplay RNG.
Conditional dialogue in `npctalk.cpp::dialogue::dynamic_line` and `parse_tags`
also stays in C++; presentation receives selected branches and parameter values.
Tests must compare RNG engine/distribution state and turn counters around real
producer/observer paths.

Keep original native save payloads and historical literal message strings intact.
`translation::serialize` is deliberately deleted (`translation.h:92`) because
resaving raw prose can break future translation. Persist migrated text records
in a versioned port sidecar/envelope, with semantic ID, typed parameters,
definition/catalog version, selected random identities and explicit migration
aliases. Load existing native history as literal legacy records; do not perform
sentence matching. Persist pending dialogue/snippet selection before save so
resume does not reroll it. Actual native save compatibility remains a separate
integration gate.

## Source-bound review backlog

These counts describe the verified extraction snapshot; they are not additive
across rows and are not a count of successfully migrated runtime consumers.

| Population | Verified count | Remaining action |
|---|---:|---|
| Current marked gettext keys | 105,003 | Connect real producers/consumers and track migration by source binding. MO coverage alone does not satisfy this. |
| Official JSON translation occurrences | 135,074 | Preserve loader, context, plural and generated-text behavior per occurrence. |
| Exact JSON source pointers | 134,534 | Convert approved meaning/parameter mappings and attach them at loaders/producers. |
| Definition-field candidate occurrences | 96,960 | Validate actual loader discriminators and override behavior. |
| Unique uncollided definition-field candidate IDs | 92,174 | These are review candidates, not importable or runtime-connected IDs. |
| Positional-field occurrences | 36,073 | Assign persistent logical field/entry identities. |
| Other needs-review occurrences | 2,041 | Includes the 540 generated occurrences; remaining 1,501 exact-pointer occurrences lack an accepted top-level identity under the audit's derivation rules. |
| Distinct candidate-ID collisions | 386 | Resolve using original category/variant/context/override identity, with source evidence. |
| Nonliteral C++ expressions | 185 | Trace definition → assignment → translated use → parameters; an overlapping catalog key is not proof. |
| C++ literal inventory occurrences | 13,899 | 13,894 are in official extraction; five valid test-only calls are outside its runtime POT scope. |
| Official dummy-parser objects / untyped objects | 14,766 / 48 | Explicitly outside this marked-text proof; review runtime/unmarked producers before declaring whole-game coverage. |
| Reviewed addition IDs formerly incompatible with Rust grammar | 180 of 539 | Reviewed registry applied; all 539 now pass grammar with aliases preserved. Runtime schema/consumer conversion remains pending. |

The official seven file exclusions and `data/mods/TEST_DATA` exclusion also remain
explicit. Report runtime-migrated IDs, source occurrences, unmigrated legacy
lookups and tested feature paths separately; do not collapse these into one
“translation percentage.”

## Bounded next implementation milestone

Implement **original help and keybinding text in Rust**, keeping C++ source
loading, input-context decisions and gameplay intact. The bounded registry has
**14 textual entries plus one structured direction-grid block**:

- Seven named keybinding labels from `data/raw/keybindings.json`: `default/UP`,
  `PICKUP/UP`, `BIONICS/UP`, and `DEFAULTMODE/{pause,pickup,inventory,help}`.
  Example IDs are `input.keybinding.default.up.name` and
  `input.keybinding.pickup.up.name`. All resolve using real category/override
  precedence, not a global action-ID map.
- The core Movement help topic: name at `/1/name` and five prose blocks at
  `/1/messages/{0,2,3,4,5}` in `data/core/help.json`. Assign reviewed IDs such as
  `help.core.movement.name`, `.controls`, `.movement_cost`, `.melee`, `.doors`
  and `.safe_mode`. The `/1/messages/1` sentinel is the structured grid.
- The C++ help heading emitted by `help::display_help`/`scrollable_text` at
  `src/help.cpp:278`, assigned `ui.help.title`.

The implementation should make these concrete changes in the **port copy**:

1. Add reviewed source-bound registry entries and en/ja templates in the current
   Rust catalog schema, leaving legacy gettext metadata in a separate manifest.
   Add the needed `KeyBinding`/rich-text block types explicitly rather than
   placing action glyphs in free-form template parameters.
2. Extend `action_attributes` or a tightly scoped parallel UI metadata record
   (`src/input.h:138`), attach refs in `input_manager::load`, and expose a
   semantic action-name resolver alongside `get_action_name`. Support explicit
   semantic refs for `register_action` overrides; classify unconverted overrides
   as legacy rather than assigning a guessed ID.
3. Attach reviewed help-section/prose refs in `help::load_object`; provide an
   owned help observation that includes the selected topic, semantic messages,
   current key bindings and direction-grid data. Preserve original help topic
   ordering and C++ navigation decisions. Keep legacy paths available for
   unmigrated topics.
4. Export the observation through the bounded bridge in
   `CPP-RUST-BOUNDARY-NEXT.md`, with explicit byte lengths and schema version;
   Rust formats the selected real game help/keybinding UI. A detached mock or
   diagnostic-only page is not completion of this consumer milestone.
5. Add source-binding/registry and actual-consumer tests, then record the exact
   14 textual bindings as runtime-migrated. Continue the remaining system
   migrations; do not publish this milestone as whole-game semantic completion.

This first slice intentionally contains no item-name or random-snippet rule
rewrite. The following slice should introduce original `itype::nname`/
`mtype::nname` observations and one real formatted message emitter, with the
original count, liquid rule, custom-name precedence and printf parameter
semantics. Further slices cover item-name segments, message history, dialogue
condition/grammar branches, snippet selection, settings/errors, crafting,
vehicles and remaining loaded content, each with explicit legacy residuals.

## Tests that establish consumer coverage

Registry tests must traverse the pinned original JSON, check owner identity and
context/plural forms, reject collisions, verify aliases, and validate all en/ja
IDs and named parameter types against the actual Rust parser. Reordering source
arrays or changing English wording in a controlled port fixture must preserve
accepted semantic IDs while producing an intentional binding/catalog review.
All 180 normalized addition IDs need parity and alias tests before adoption.

Original C++ loader tests must exercise actual `input_manager::load` and help
loading, including category/global fallback, semantic overrides, user-created
literal names, mod/source order and reload. A test that constructs a TextEvent
directly in Rust does not verify those producers. For a migrated feature,
instrument legacy lookup traffic at the original manager and semantic producer
traffic separately; require the scoped original UI path to emit registered refs
and zero unexpected legacy fallbacks. Leave other feature traffic explicitly
unmigrated.

Differential consumer tests must compare original C++ English and Rust English
on the same actual loaded records, including bound/unbound actions, `<press_>`
dependencies, direction-grid orientation, newline/markup semantics and English
plural selections. Japanese tests assert actual catalog choices and terminology,
one-form plural behavior, CJK width/wrapping and preservation of external names.
Mismatches require source evidence and a documented intentional change; do not
normalize whitespace merely to make comparisons pass.

Real-game tests open Movement help and keybindings from the full engine on
desktop and mobile, change bindings, scroll/resize, switch en/ja, return to the
game and verify unchanged turn/RNG snapshots for repeated observations and
rendering. Save/resume tests later freeze selected snippets/dialogue and migrated
message parameters, preserve native save compatibility, and reject incompatible
text/ABI envelopes. ABI malformed-input, lifetime and bounded-size tests apply
to the transport. These tests are planned acceptance gates; this document's
source inspection and ID grammar audit have not executed them.
