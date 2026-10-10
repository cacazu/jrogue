# Tales of Maj’Eyal / T-Engine source inventory

Source root_1: C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6
Source root_2: C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\unpacked
Version claim supplied by caller: 1.7.6

Scanned 6,903 files (867,601,937 bytes), including 2,384 Lua files (33,829,517 bytes).

Found 7,161 recognized source declarations, 426,779 string literals, and 30,620 potential text literals requiring review. Lexer diagnostics: 0.

## Explicit declaration callsites

| Kind | Count |
| --- | ---: |
| newEntity | 3742 |
| newTalent | 1348 |
| newEffect | 604 |
| newChat | 427 |
| newTalentType | 305 |
| newLore | 303 |
| newDamageType | 188 |
| newAchievement | 154 |
| newBirthDescriptor | 90 |

## Source areas (overlapping categories)

| Area | Lua files | Declarations | Potential text literals |
| --- | ---: | ---: | ---: |
| other | 602 | 732 | 2147 |
| zones | 564 | 1080 | 2479 |
| talents | 275 | 1638 | 5595 |
| engine | 209 | 0 | 1896 |
| maps | 136 | 0 | 609 |
| dialogs | 130 | 0 | 2759 |
| objects | 105 | 1524 | 2972 |
| chats | 100 | 427 | 1567 |
| classes | 88 | 0 | 2806 |
| npcs | 74 | 439 | 809 |
| quests | 53 | 0 | 764 |
| lore | 41 | 323 | 700 |
| birth | 28 | 90 | 1180 |
| gfx | 28 | 0 | 1 |
| ai | 18 | 0 | 306 |
| artifacts | 18 | 637 | 1812 |
| achievements | 15 | 154 | 351 |
| keybindings | 11 | 0 | 209 |
| effects | 5 | 586 | 3388 |
| damage_types | 4 | 188 | 677 |
| resolvers | 2 | 0 | 67 |
| factions | 1 | 0 | 6 |

## Modules and engine

| Scope | Lua files | Declarations | Potential text literals |
| --- | ---: | ---: | ---: |
| addon.tome_addon_dev | 27 | 0 | 229 |
| addon.tome_items_vault | 14 | 4 | 73 |
| addon.tome_possessors | 26 | 56 | 315 |
| addon.tome_remote_designer | 46 | 0 | 60 |
| bootstrap | 1 | 0 | 9 |
| build | 3 | 0 | 17 |
| engine | 205 | 0 | 1859 |
| game | 80 | 0 | 400 |
| module.boot | 117 | 64 | 398 |
| module.example | 28 | 19 | 63 |
| module.example_realtime | 28 | 19 | 62 |
| module.tome | 1782 | 6999 | 26967 |
| premake4_lua | 1 | 0 | 0 |
| src | 26 | 0 | 168 |

## Files and source locators

- `files.jsonl`: per-Lua-file SHA-256, category and counts.
- `features.jsonl`: recognized declarations plus zone/quest/chat source files, identity and locator.
- `declarations.jsonl`: definition identity, top-level fields, file, line and column.
- `literals.jsonl`: every lexed Lua string literal; internal and unclassified strings retained for audit.
- `text-candidates.jsonl`: potential text callsites/fields with context-based semantic ID suggestions, placeholders and composition flags.
- `diagnostics.jsonl`: malformed/unsupported lexical construct findings.
- `summary.json`: machine-readable totals and scope/category distributions.

## Limits and next review

- Potential text classification is evidence-based and requires review; all literals are not user-visible text.
- Semantic IDs are suggestions derived from definition identity / source context; manual stable key selection and collision review are required.
- Dynamic table creation, inheritance, runtime-generated names, text concatenation and non-Lua resources require additional runtime/manual inventory.
- Declarations are explicit recognized newX table callsites only; counts are source definitions, not instantiated runtime features.
- Zone/quest/chat file counts identify static source units, not playable or reachable runtime content.
- Archive containers (.team/.teae/.teaa) must be separately unpacked and supplied as non-overlapping source roots; this scanner does not silently execute or extract archives.
- Total file bytes cover selected physical roots, including any archive containers and unpacked assets; this is not a deduplicated release download size.
- Static lexical scanner is not a full Lua parser or execution-based coverage tool.

Do not ship these candidate suggestions as a complete localization catalogue. Review declaration keys, classify unclassified literals, trace dynamic text and dialogue tables, and establish gameplay/runtime coverage before claiming complete English/Japanese text coverage.
