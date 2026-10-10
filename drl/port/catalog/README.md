# DRL source text inventory

Source commit: `a6f965072b3a25b768c91dbced00367f1b57d865`. This catalog inventories pristine upstream; it does not claim that the Rust port or Japanese localization is complete.

Regenerate from the staged DRL directory with `node port/tools/inventory-texts.mjs`. Run scanner tests with `node --test port/tests/text-inventory.test.mjs`. Paths can be overridden with `--source <directory> --out <directory>`. The script never executes upstream Pascal/Lua and rejects output paths inside upstream.

## Discovery coverage

- 142 Pascal/Lua source files, 13759 literal occurrences, 5833 unique decoded values.
- 60 text/help/manual/ASCII/support documents, 5009 nonempty lines; 8 in-game help files.
- 753 dynamic name/plural/article/format/history source candidates, including calls with no static literal.
- 107 literals with printf-style placeholders; 2474 literals flagged for dynamic assembly review.
- 0 lexical/encoding/provenance diagnostics; 0 translated occurrences.

All source files are hashed in the manifest. Every literal includes relative file, one-based line/column, UTF-16 offset/endOffset, exact raw syntax, decoded value, syntax type, context, placeholder candidates, markup candidates, and a structural semantic ID candidate. Comments and Pascal compiler directives are excluded. Pascal doubled quotes and numeric character codes, Lua quoted escapes and arbitrary-equals long brackets are retained. Text documents use line records so titles, key labels, body text and ASCII layouts remain discoverable. Blank lines remain in upstream; line numbers preserve their positions.

## Review queues

| Classification | Occurrences |
| --- | ---: |
| ambiguous | 7675 |
| empty-or-layout | 491 |
| internal | 696 |
| internal-candidate | 1919 |
| text-fragment | 123 |
| user-facing-candidate | 2855 |

`user-facing-candidate` means a likely display field or output API argument, not a proof of display use. `internal-candidate` still needs review: identifiers, paths, dice expressions and logs must not be blindly translated. `ambiguous` literals are retained, never silently dropped. Empty strings, character literals, spacing, and dynamic concatenations are retained. A given API can mix text, identifier and parameter arguments. Classification and structure are conservative heuristics rather than a full Pascal/Lua AST.

Candidate IDs use file, registry entity (where lexically available), procedure/function or call/key anchors, and an occurrence ordinal. These IDs are **unreviewed**. After review, assign stable meaning-based public IDs; do not expose occurrence ordinals as final localization contracts. Function and call anchors can be imprecise for nested/anonymous functions, chained calls, or complex table construction.

The `dynamicSources` review queue includes `TItem.GetName/GetExtName/Preposition`, `TBeing.GetName/Preposition`, plural suffix formation in Hall of Fame/mortem records, `Format`/`Emote` and Lua `format`/`tostring` constructions. Migrate complete messages with typed parameters, entity-name IDs, Japanese counters/articles/plural rules and grammatical variants; translating string fragments independently cannot preserve grammar. External player/user names must remain parameters. Review all settings, keybindings, help, errors, plots, entity names/descriptions, awards/history and dynamically loaded modules.

DRL markup such as `{!Escape}`, `{rControls}` and color tags is flagged separately from interpolation. Named braces are candidates requiring formatter review. Percent values such as `20%` are not printf arguments. Preserve the exact format specification and typed/positional argument meaning while replacing the formatter with semantic parameters.

## Highest literal counts

| File | Occurrences |
| --- | ---: |
| `bin/data/drl/challenge.lua` | 727 |
| `src/dfhof.pas` | 604 |
| `bin/data/drl/items/items.lua` | 484 |
| `bin/data/drl/beings.lua` | 468 |
| `bin/data/drl/main.lua` | 467 |
| `bin/data/drl/awards.lua` | 359 |
| `src/drlkeybindings.pas` | 320 |
| `bin/data/drl/items/eitems.lua` | 308 |
| `bin/data/drl/items/uitems.lua` | 289 |
| `src/dfitem.pas` | 280 |
| `src/drlplayerview.pas` | 255 |
| `bin/data/drlhq/audio.lua` | 252 |
| `bin/data/drllq/audio.lua` | 252 |
| `src/drlmainmenuview.pas` | 246 |
| `src/dfbeing.pas` | 243 |
| `bin/data/drl/levels/centralprocessing.lua` | 232 |
| `bin/data/drl/traits.lua` | 231 |
| `makefile.lua` | 231 |
| `bin/data/drl/klass.lua` | 228 |
| `src/drlio.pas` | 228 |

## Completion requirements

1. Review every record, including ambiguous/internal candidates, and document exclusions by actual role.
2. Reconcile text-bearing files outside scanned extensions and resources in external Valkyrie/dependency sources; user-created modules require separate catalogs. Binary assets may contain embedded/painted text and need a visual asset audit.
3. Map complete application/domain events to reviewed semantic IDs and typed parameters. Keep drawing and language lookup independent of deterministic simulation/RNG.
4. Produce reviewed `en.json` and `ja.json` with identical IDs and placeholder contracts; measure coverage against the migrated event/API surface and this inventory. No Japanese translations are invented by this discovery step.
5. Verify Japanese terminology, plural/counter behavior, CJK wrapping, keybinding hints, errors, help, settings and dynamic names in complete browser flows.

Source assets and story names may have different licensing constraints from code. This extraction is an internal engineering catalog; it is not authorization to publish game assets or upstream texts.

## Concrete dynamic source review

- `bin/data/core/main.lua`: `register_corpse` appends `" corpse"` to a being name; `register_being` supplies `name_plural = name .. "s"` and a default `"ranged attack"` natural weapon name. These defaults need language-specific semantic constructions.
- The same core registration code builds class badge names/descriptions and Bronze/Silver/Gold/Platinum/Diamond badge names. Preserve identifiers while translating displayed tier/name composition.
- `bin/data/drl/main.lua` and core mortem/history functions construct episode/floor/chapter names and death/result descriptions. DRL `@1`, `@2` history substitutions are inventoried as positional parameter candidates, independently of color markup.
- `src/dfbeing.pas`: `GetWoundStatus`, `Emote`, `Fail`, `GetName`, and `Preposition`; `src/dfitem.pas`: `GetName`, `GetExtName`, `Description`, and `Preposition`; `src/dfhof.pas`: plural suffixes and paged report composition.
- `bin/config.lua` message wildcards can make behavior depend on English text. Port behavior must use event/semantic IDs and matching rules, with a documented migration for user configuration.
- Upstream uses `AnsiString`, byte-length/cell assumptions, and CP437/VTIG control markup. Japanese requires Unicode text, measured CJK display cells/wrapping, and explicit separation of markup from display strings.

These are engineering findings from actual source review, not a claim that all runtime constructions are already migrated or translated.
