# Upstream Japanese localization inventory

Official source catalogues are reusable migration inputs. They remain keyed by original English text and tags until deliberately mapped to stable semantic IDs.

Available catalogue locale declarations: fr_FR, ja_JP, ko_KR, test_TEST, zh_hans, zh_hant.

Japanese: 23404 active registrations, 18959 unique English sources, 20221 distinct source/tag pairs, 1590 duplicate source/tag pairs, 0 conflicting source/tag pairs, 168 source keys with differing translations, 31 empty targets, 0 identical targets, 0 non-literal registrations, 75 printf review findings.

## Japanese files

| Source | Active registrations | Empty | Identical | Printf review |
| --- | ---: | ---: | ---: | ---: |
| game/addons/tome-addon-dev/data/locales/ja_JP.lua | 16 | 0 | 0 | 0 |
| game/addons/tome-items-vault/data/locales/ja_JP.lua | 69 | 0 | 0 | 0 |
| game/addons/tome-possessors/data/locales/ja_JP.lua | 265 | 0 | 0 | 0 |
| game/engines/default/data/locales/engine/ja_JP.lua | 1055 | 12 | 0 | 0 |
| game/modules/boot/data/locales/ja_JP.lua | 283 | 0 | 0 | 0 |
| game/modules/tome/data/locales/ja_JP.lua | 21716 | 19 | 0 | 75 |

## Static text candidate matches

| Scope | Candidate callsites | Unique sources | Nonempty Japanese source match | No source match | Ambiguous targets |
| --- | ---: | ---: | ---: | ---: | ---: |
| addon.tome_addon_dev | 229 | 169 | 22 | 207 | 0 |
| addon.tome_items_vault | 73 | 47 | 72 | 1 | 0 |
| addon.tome_possessors | 315 | 271 | 280 | 35 | 5 |
| addon.tome_remote_designer | 60 | 44 | 0 | 60 | 0 |
| bootstrap | 9 | 8 | 0 | 9 | 0 |
| build | 17 | 16 | 0 | 17 | 0 |
| engine | 2016 | 1529 | 776 | 1226 | 0 |
| game | 243 | 200 | 0 | 243 | 0 |
| module.boot | 398 | 313 | 296 | 102 | 6 |
| module.example | 63 | 62 | 28 | 35 | 3 |
| module.example_realtime | 62 | 61 | 28 | 34 | 3 |
| module.tome | 26967 | 20306 | 21833 | 5114 | 326 |
| src | 168 | 91 | 0 | 168 | 0 |

## Migration evidence

- `source-ja-map.json` keys original English source and tag, preserving all registrations, context, reordered arguments and Japanese name/font/line-break configuration. It is explicitly not a semantic-ID catalogue.
- `upstream-ja-catalogue.jsonl` preserves source, target, tag, argument order, special processing tokens and catalogue locator.
- `ja-reuse-candidates.jsonl` joins potential semantic-ID contexts to upstream source-text matches. Ambiguous/context-sensitive matches require review.
- `ja-gaps.json` identifies absent, empty, identical or ambiguous static mappings without copying English into Japanese as translated.
- semantic-suggestion-collisions.json identifies 498 repeated suggestions across files; those are explicitly unfinished key decisions.
- `locale-summary.json` records all inspected locale files and diagnostics, including explicit translation hook counts and exact-tag/fallback evidence.

## Limits

- Active registrations exclude commented untranslated blocks. Identical, empty and non-literal targets are counted separately.
- Matched source literals are static inventory evidence, not proof of reachable runtime or complete gameplay translation.
- Translations are keyed by original English and tag in upstream. Context/argument-order/special processing must be preserved when migrating to semantic IDs.
- Potential text includes internal/debug text requiring review. No global replacement and no translation of external usernames is performed.
- Placeholder review findings require inspection; printf special processing can intentionally change argument representation.
- Original catalogue and font licence obligations must be preserved; source catalogue extraction itself does not license bundled non-code media.
