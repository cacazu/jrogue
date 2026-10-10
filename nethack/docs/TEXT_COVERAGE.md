# Upstream text coverage evidence

The inventory fingerprints the **whole upstream tree**, including `src`, `include`, `sys`, `win`, `util`, `outdated`, `dat`, and `doc`. Literal extraction processes C-family files (`.c`, `.h`, `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hh`, `.hxx`), including Qt platform strings; Lua strings are extracted from `dat`. Other resource formats are fingerprinted without pretending to parse their user text. Counts are source occurrences across all platforms/configurations, not unique player messages and not Japanese translation coverage.

| Evidence | Exact scanned count |
| --- | ---: |
| C-family source/header string literal occurrences | 40,122 |
| Recognized message/menu/prompt API call candidates | 7,841 |
| Calls with immediately resolvable literal formats | 6,674 |
| Calls with dynamic/macro/conditional formats requiring review | 1,167 |
| Intermediate formatting call candidates | 2,136 |
| `dat` files | 154 |
| `doc` files | 65 |
| `dat` Lua files | 131 |
| `dat` Lua string occurrences | 7,759 |
| Nonblank, noncomment candidate lines in other `dat` surfaces | 17,285 |
| Japanese translations supplied by this inventory | 0 |

`source-text-messages.json` records the API, source file, 1-based line, function candidate, exact format expression, source argument expressions, printf specifiers, and named argument candidates. Calls such as `You(...)` add prose through upstream helpers; their stored template is the literal argument, not a falsely reconstructed complete utterance. `source-text-literals.json` retains C-family literals (including C++ raw strings) and Lua strings so text outside recognized sinks remains discoverable. `source-text-surfaces.json` fingerprints every `dat`/`doc` file and lists source lines from non-Lua `dat` surfaces.

## Semantic IDs and arguments

Generated candidates use an English namespace, for example `nethack.message.trap.<function>.you.<english_phrase>.<disambiguator>`. These are extraction aids. A reviewed runtime ID should express the event meaning, for example `player.fell_into_pit`, and contain named typed arguments such as `damage`, `monster`, or `item`. Do not use the English text itself as the key or copy C `printf` strings as the runtime interface.

Before admitting an ID to `en.json` and `ja.json`, review its actual call path and context, replace positional candidates with semantic argument names, and define locale-specific grammar, articles, plural forms and entity naming. Japanese must be a reviewed translation; copying English into `ja.json` is not translation coverage. Catalog validation must compare key and argument schemas, not merely file lengths.

Compositional strings require extra work: object and monster names, possessives, pronouns, indefinite/definite articles, plurals, verb conjugation, blindness/hallucination descriptions, shop names, role names, status abbreviations, menu alignment, command prompts, and quoted monster speech. Quest Lua uses `%` substitutions distinct from C printf. Preserve those expressions until the quest argument language is explicitly modeled. Maps, symbol names, filenames, Lua code keys, and structural commands must not be translated as prose.

## Scope limits and completion gate

This is a lexical scan, not static analysis. It does not resolve macro-defined strings, concatenated buffers, indirect function pointers, every custom UI wrapper, all resource-file formats, or documentation layout. It scans mutually exclusive platform code together. All these limitations are explicit in JSON, and dynamic formats remain unresolved rather than receiving invented text.

A complete translation audit must reconcile every source surface and unresolved call against a reviewed ledger: translated runtime ID, intentionally unlocalized structural text, legal notice preserved verbatim, developer-only diagnostic, obsolete platform text, or out-of-scope documentation with an explicit rationale. The native and browser application must select Japanese by default, support English switching, and render event ID plus typed arguments without advancing gameplay or RNG. Full text coverage is not established by this inventory.
