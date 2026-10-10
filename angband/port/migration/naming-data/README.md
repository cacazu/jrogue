# Pinned naming catalogs

These source-identified English/Japanese inputs cover Angband 4.2.6 naming at
commit `f3082213b73f3e463e3d0d60bff4b00462beae6e`. The actual pinned
`obj-desc.c`, `mon-desc.c`, parser code and record context were reviewed before
authoring the translations. No Angband code is executed by the extractor.

The flat dictionaries contain **2,130 IDs**. Record totals differ from lexical
totals because equal visible source lexemes share one ID within each role.
That prevents a selected name from identifying a hidden item group or
suppressed monster title.

| Domain | Active records | Covered lexical fields |
|---|---:|---|
| Monster races | 624 | 624 names, 96 explicit plurals, 60 selected possessive stems sharing 59 IDs |
| Monster bases | 56 | 56 display names and 56 short category labels |
| Object kinds | 409 | 375 source kinds, 20 shared generated book kinds, 14 artifact dummy kinds; 364 lexical IDs |
| Object bases | 34 | All 33 named bases; gold has no source name |
| Flavors | 302 | All 251 named records sharing 202 nouns and 202 modifier phrases; 51 generated scroll titles remain opaque |
| Fixed artifacts | 138 | All names and explicit attachment policy |
| Ego items | 107 | 79 shared nouns and 79 attributive phrases |
| Realm naming | 4 | All 12 book nouns, spell nouns and verbs; realm display names belong to birth/sidebar |
| Chest traps | 7 | All selected labels sharing 5 IDs, with exact private trap-code bindings |
| Naming grammar | — | 125 source fragments/compositions, including articles, quantities, pronouns, annotations, numeric units and the selected `treasure` literal |

`source-manifest.json` maps every entry to its exact original file, line,
directive, selected value and private record identity. It records 1,895 distinct
source locations, exclusions, typed parameters and English grammar ASTs.
`source-records.json` inventories all active record context; lore prose and
mechanics remain untranslated in this naming task. `pinned-sources.json` pins
10 data files and nine unchanged official code snapshots by SHA-256.

The production inputs are `en.json`, `ja.json`, `grammar.json` and
`source-bindings.json`. The `*-ja.json` inputs are authored per source record or
shared source lexeme. `generate.py` joins those identities and rejects missing
records, duplicate JSON keys, conflicting coalesced translations and changed
pinned sources. It never locates a translation by a completed English
description. The private index maps preserve all parser keys, ordering and
the unnamed reserved kind slot 375.

English keeps exact source lexemes, including `&`, `~`, `#`,
`|singular|plural|`, leading `of ` and quote marks. Explicit grammar metadata
binds source printf slots to named parameters. Parser-generated dummy names
are identified as the native `& ` + base name + `~` transformation; authored
whole-name compositions are identified separately from source literals.

Japanese uses authored nouns and attributive phrases. Artifact `.name` is the
proper lexeme without the source `of ` or surrounding quotes; attachment
metadata supplies `{suffix}の{base}` or `{base}『{suffix}』`. Flavor and ego
`.modifier` entries provide natural attributive forms. Book titles match the
frozen character catalog across all 30 class associations. Counters are
explicit source-reviewed metadata. Shared effect-name kind IDs use the counter
of the **selected visible basename**, rather than the hidden kind identity.

Japanese omits English articles and the native monster comma. Full authored
appositives are closed parentheses; a selected possessive stem such as
`蛇の舌` becomes `蛇の舌の`. The two Beorn stems share a single ID. Native
English punctuation remains exact. The four identical terse `Book~` roles may
use their first canonical lexical ID privately; the distinct `Tome~` source
remains distinct.

Naming grammar declares the union of locale parameter slots: Japanese consumes
`counter`, while English charge text consumes `plural_suffix`. Each locale
validates its actual authored slots. Generic FFI events still require exact
reviewed parameter schemas. Native store/inscription braces are literal
punctuation. Dice, signed bonuses, count, charge and turn units are preserved.

Generated scroll titles, generated artifact names, external player names and
inscriptions remain owned opaque text. Fixed artifact IDs require private
identity plus exact pinned raw-name verification because random-artifact
generation can reuse an index with a different name. No random seed words,
association tables or simulation state are changed. Original C decides
knowledge, visibility, plurality, prefix/suffix, annotations and numeric facts;
the naming catalog does not independently reveal hidden data.

`wording-fixes.json` records concrete terminology/grammar corrections.
`wording-review.json` records the final reviewed scope and checks. Upstream
copyright/license headers remain in every code snapshot; the project notices
and distribution decisions are in [the acquisition provenance](../../docs/PROVENANCE.md)
and [licenses](../../licenses/copying.rst).

Run lightweight checks from the port directory:

```powershell
python migration/naming-data/generate.py --check
node --test migration/naming-data/naming-data.test.mjs
```

These deliverables establish reviewed catalog inputs. They do not establish
WASM/browser acceptance, full game localization or publication. The separately
owned C/Rust adapters must preserve the native selected branches, mutations,
RNG, keys and order. Monster/object/artifact/ego lore, effects, trap messages,
and other full-game UI/message text remain separate domains.
