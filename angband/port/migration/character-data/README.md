# Reviewed player race and class catalogs

These flat English/Japanese JSON catalogs cover every display text field in
the pinned, active `p_race.txt` and `class.txt` from Angband 4.2.6, commit
`f3082213b73f3e463e3d0d60bff4b00462beae6e`. They are translation preparation;
they do not establish complete game localization. Browser-only source hooks
now map 356 book/spell endpoints, while 110 race/class/title endpoints are owned
by the birth/sidebar integration. These hooks have lightweight source checks
only; no build, browser or runtime acceptance is claimed. Upstream data, rules,
save keys and random tables remain unchanged.

| Field role | Catalog entries |
|---|---:|
| Player race names | 11 |
| Active class names | 9 |
| Advancement titles | 90 |
| Class/book name associations | 30 |
| Spell names | 163 |
| Spell descriptions | 163 |
| Self-damage death causes | 3 |
| **Total, in each locale** | **469** |

All 637 active text directive lines are mapped. The 30 book associations refer
to 20 distinct upstream book names. All 963 nontext directive lines are retained
as exact-value exclusions in `source-manifest.json`; they include statistics,
equipment lookup names, flags, history references, realm keys, effect symbols,
dice, expressions, glyphs and colors. Source hashes and exact file/line mappings
allow the result to be audited against the preserved upstream source.

## IDs and actual parser roles

`logic/init.c` was read to establish the schema. The `class.txt` header has
obsolete comments about a class number: the active `name` parser takes only the
name. Race/class indices follow original record order. Every `desc` line attaches
to the most recently declared spell; these files contain **no race or class
description fields**. Descriptions and effect messages concatenate verbatim,
without an inserted separator. Each catalog English value preserves that result
exactly, including source punctuation, double spaces and the `than` typo in
Vampire Form.

Examples of the frozen, reviewed endpoints:

```text
angband.player_race.half_elf.name
angband.player_class.priest.name
angband.player_class.priest.title.level_01_05
angband.player_class.priest.title.level_46_50
angband.player_class.mage.book.first_spells.name
angband.player_class.mage.book.first_spells.spell.magic_missile.name
angband.player_class.mage.book.first_spells.spell.magic_missile.description
angband.player_class.necromancer.book.dark_rituals.spell.shadow_shift.effect.self_damage.death_reason
```

Titles preserve all ten ordered five-level bands. Semantic IDs describe the
race/class/book/spell identity and field role. Their slugs are catalog identity
labels, not replacements for the exact upstream parser strings. The extractor
rejects any changed source hash; a future content revision requires explicit
identity review rather than silently assigning new IDs to renamed content.

Book names such as `[First Spells]` are exact lookup keys used by
`write_book_kind()` to share object kinds across classes. Their square brackets
are a literal title convention, not singular/plural grammar. Keep that lookup and
`tval/sval/kidx` identity unchanged when implementing the display descriptor.
All three `effect-msg` values belong to player `DAMAGE` effects and are copied
into the death cause; their translations are noun phrases, not full messages.

## Review and terminology

Japanese uses consistent terms: モンスター, アイテム, HP, マナ, 能力値,
命中修正, ダメージ修正, 朦朧, アンデッド, ユニーク・モンスター, 永久壁,
and 耐性で軽減できないダメージ. Classes use 戦士, 魔術師, ドルイド,
司祭, 死霊術師, 聖騎士, 盗賊, 野伏 and 暗黒戦士. Wand and staff are distinguished
as 魔法の杖 and 魔法のスタッフ until the shared object-name subsystem is integrated.

All spell descriptions were reviewed in their class, book and effect context.
Necromancer and Blackguard received a separate read-only translation review.
Distinct class effects retain distinct IDs and wording: Priest Heroism starts
at level 20 and Paladin Heroism at 15; Druid Herbal Curing includes nourishment
and Ranger Herbal Curing does not. `wording-review.json` records all 469 reviewed
IDs, all 75 distinct effect symbols, and every changed exact Japanese value.
Code-backed corrections include Sleep Evil's actual sleep resistance, the
nonmaximum Phase Door distance, fixed Call Light/Create Darkness radius,
Vampire Form's quarter-HP base damage, actual ammunition branding eligibility,
and Berserk Strength's continued HP regeneration. Original English and parser
data remain byte-for-byte preserved; discrepancies are upstream documentation
errata, not rule changes. Missing-HP healing and sense-versus-detect knowledge
are made explicit. Literal numeric/dice values and Command's `d`, `m`, `r`
keys remain preserved. See `docs/TERMINOLOGY.md` for shared stat/effect terms.

None of these source fields has interpolation parameters; every manifest entry
therefore has an empty typed `parameters` object. Percent signs such as `33%`
are literal values. Tolkien setting names are authored content. Player names,
usernames, inscriptions and other external values must remain verbatim typed
parameters in future surrounding semantic events.

## Lightweight verification

From this directory or any working directory:

```text
python extract_catalog.py --check
```

The check rejects duplicate, missing or orphan JSON IDs; verifies all 469 values
in both flat catalogs, Unicode Japanese text, no unintended placeholders,
numeric/dice literals, command keys and book brackets; compares source hashes;
recomputes all source mappings; checks all 637 active text lines are represented;
and confirms the original 11 races, 9 classes, 30 book associations, 163 spells
and ten advancement bands per class. Without `--check`, it regenerates only the
English catalog and manifest, then validates the existing Japanese catalog.
It uses only Python's standard library and does not build or run Angband.

## Remaining descriptor integration

Source integrations now use structured `ridx/cidx`, title band and `bidx/sidx`
projections. `docs/SPELL_TEXT_INTEGRATION.md` describes the 356 source hooks and
remaining acceptance requirements. Resolve additional IDs at their producers,
while preserving C parsing, lookup names, effect/dice order, knowledge and RNG.
Book display must connect to the shared object base/count/article grammar;
death/history events must carry a cause ID instead of the completed English
`killer` string. Japanese descriptions need grapheme-safe, display-cell-aware
wrapping rather than the original fixed byte buffers.

`old_class.txt` is inactive and excluded. Birth histories, random-name seed words,
realm display labels, player-property labels, birth help, generic spell UI,
errors, monster/object naming and all other files remain separate catalog and
integration work. No build, browser, gameplay, save or publication acceptance is
claimed for these catalogs. The game's existing source license and attribution
requirements also apply to these derived catalogs.
