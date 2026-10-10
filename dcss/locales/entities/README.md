# Species and background name catalogs

Added 2026-10-02 from the pristine official DCSS 0.34.1 source, commit
`1eebc1a2892e1c89776a0d7a10691f8dac8d9796`. English names are exact original values; Japanese names
were translated manually by enum identity. These are separate, disconnected
catalogs. They do not change C++ game mechanics or the active Rust/browser UI.

## Verified scope

| Kind | Selectable current starts | Current evolved forms | Deprecated compatibility/history | Total source records |
|---|---:|---:|---:|---:|
| Species | 27 | 8 Draconian colours | 12 | 47 |
| Backgrounds/jobs | 26 | 0 | 7 | 33 |

Each record has a primary display name and the original two-character code:
94 species IDs and 66 background IDs, or **160 IDs in each language**. Codes
are identity/input abbreviations and remain unchanged in Japanese. The
deprecated names are retained for compatibility and history, not added to the
new-game choices. Draconian colour forms are current in-game species forms,
not eight extra selectable starting species. The source's
`TAG_MAJOR_VERSION == 34` is a compatibility-format condition, not a claim
that a deprecated record is playable in release 0.34.1.

Sources are `crawl-ref/source/dat/species/*.yaml` and
`crawl-ref/source/dat/jobs/*.yaml`. The seven historical jobs are defined
in `crawl-ref/source/util/job-gen/job-data-deprecated-jobs.txt`; there are no
job YAML files for them in this pinned source. The original enum header
templates are checked too, so an enum-only real entity cannot be silently
omitted. Alias assignments and random/viable/unknown sentinels are not real
entity records and are excluded. In particular `SP_UNKNOWN`'s internal
`Yak` fallback and `JOB_UNKNOWN`'s `Unemployed` fallback are outside these
species/background counts.

The primary YAML `name` field and effective `short_name` are covered. When
`short_name` is absent, both original generators use `name[:2]`; the
catalog stores that original English code. Species adjectives, genus names,
Beogh's orc names, child names, fake-mutation text, prose descriptions,
background category labels, equipment names, and full gameplay messages
remain outside this bounded milestone. They require their own explicit
semantic forms and source mapping; these catalogs do not imply full text
coverage.

## Identity and name contract

IDs are based on stable original enum identities, never on an English phrase:
`species.sp_deep_elf.name`, `species.sp_deep_elf.abbrev`,
`job.job_fighter.name`, and `job.job_fighter.abbrev`.

The disconnected, tested lookup exported from the validation tool accepts:

`{ kind: "species", identity: "SP_DEEP_ELF", form: "name" }`

or the corresponding `job` identity, with `form` limited to `name` or
`abbrev`. Language defaults to Japanese. It validates descriptor shape and
identity, rejects absent IDs, and returns plain text. It never replaces an
English fragment inside another message. A separate
`{ kind: "external_player", value: string }` descriptor preserves arbitrary
usernames exactly, including mixed scripts and brace characters. A browser
must insert the result through `textContent` or a text node.

Name entries have **zero parameters**. A count/quantity cannot currently be
passed to this singular-label contract; the validator tests that it fails.
The next grammar milestone must add explicit semantic message templates and
per-entity forms, using a nonnegative integer quantity plus a typed entity
reference. English singular/plural forms and Japanese counters must be
declared and tested independently. Do not append `s`, globally replace an
English name, pass an already rendered name as engine identity, or infer a
Japanese counter from a display string. No generic plural implementation is
claimed by this name-only milestone.

## Terminology

These are project translations, not a claim of official Japanese DCSS
terminology. A background/job is a **職業（開始時の経歴）**, a species is a
**種族**, and a source abbreviation is a **識別コード**. Deep Elf/Deep Dwarf
use **深層**, Mountain Dwarf uses **山岳**, and Draconian colour forms use
**色 + ドラコニアン** consistently. Conjurer is **妖術師**, Summoner is
**召喚術師**, and Enchanter/Hexslinger use **呪術**; these distinct roles are
not collapsed into one translated name. Elementalists consistently use
**精霊術師**, with **風・地・炎・氷** for their elements. Naga, Spriggan,
Coglin and other fantasy identities retain consistent transliterations;
the identity code, not the spelling of a translation, controls gameplay.

## Validation and provenance

Run from the DCSS directory:

`node tools/check-entity-catalogs.mjs --self-test`

For a corresponding-source archive that intentionally omits Git metadata, add
`--archive`. That explicit mode checks the pinned source-map commit and exact
source SHA-256 parity; its result states that Git HEAD was not checked. The
default checkout mode also verifies the original Git HEAD. Neither mode
silently claims a Git check from an archive without repository metadata.

Only Node built-ins are required. No installer, dependency download, upstream
generator, or original game code is executed. The validator reads only the
single-line top-level naming/identity scalar syntax actually present in the
pinned YAML and fails on unsupported naming syntax. It is not a general YAML
parser and does not interpret mechanics. It reads the original historical
job initializer names, compares every real enum identity, validates duplicate
catalog keys and exact bilingual ID/placeholder sets, checks English names and
both language codes against source, and requires nonempty Japanese names.

`source-map.json` records all 80 identities, original paths and lines,
classifications, display names/codes, source commit, and SHA-256 hashes of the
76 source files consulted. The checker independently re-extracts that data
and rejects source drift, an incomplete manifest, missing/extra IDs, changed
English names/codes, or introduced placeholders. Fifteen positive/negative
self-test assertions exercise lookup, external-name preservation, duplicate
keys, invalid descriptors, source-name mismatches, missing/extra IDs, code
changes, and forbidden quantity/placeholder parameters.

English names and source mappings derive from upstream GPL-2.0-or-later data;
retain the upstream notices and corresponding-source obligations documented
in the parent source audit. These files reuse no artwork, sound, or fonts.

## Species source mapping

| Upstream identity | English name | 日本語名 | Code | Classification | Original source |
|---|---|---|---|---|---|
| `SP_ARMATAUR` | Armataur | アルマタウル | `At` | current_start | [armataur.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/armataur.yaml#L3) |
| `SP_BARACHI` | Barachi | バラキ | `Ba` | current_start | [barachi.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/barachi.yaml#L3) |
| `SP_BASE_DRACONIAN` | Draconian | ドラコニアン | `Dr` | current_start | [draconian-base.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/draconian-base.yaml#L3) |
| `SP_BLACK_DRACONIAN` | Black Draconian | 黒色ドラコニアン | `Dr` | current_subspecies | [draconian-black.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/draconian-black.yaml#L3) |
| `SP_CENTAUR` | Centaur | ケンタウロス | `Ce` | deprecated_compatibility | [deprecated-centaur.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-centaur.yaml#L4) |
| `SP_COGLIN` | Coglin | コグリン | `Co` | current_start | [coglin.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/coglin.yaml#L3) |
| `SP_DEEP_DWARF` | Deep Dwarf | 深層ドワーフ | `DD` | deprecated_compatibility | [deprecated-deep-dwarf.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-deep-dwarf.yaml#L4) |
| `SP_DEEP_ELF` | Deep Elf | 深層エルフ | `DE` | current_start | [deep-elf.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deep-elf.yaml#L3) |
| `SP_DEMIGOD` | Demigod | 半神 | `Dg` | current_start | [demigod.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/demigod.yaml#L3) |
| `SP_DEMONSPAWN` | Demonspawn | 魔神の末裔 | `Ds` | current_start | [demonspawn.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/demonspawn.yaml#L3) |
| `SP_DJINNI` | Djinni | ジン | `Dj` | current_start | [djinni.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/djinni.yaml#L3) |
| `SP_FELID` | Felid | 猫人 | `Fe` | current_start | [felid.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/felid.yaml#L3) |
| `SP_FORMICID` | Formicid | 蟻人 | `Fo` | current_start | [formicid.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/formicid.yaml#L3) |
| `SP_GARGOYLE` | Gargoyle | ガーゴイル | `Gr` | current_start | [gargoyle.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/gargoyle.yaml#L3) |
| `SP_GHOUL` | Ghoul | グール | `Gh` | deprecated_compatibility | [deprecated-ghoul.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-ghoul.yaml#L4) |
| `SP_GNOLL` | Gnoll | ノール | `Gn` | current_start | [gnoll.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/gnoll.yaml#L3) |
| `SP_GREEN_DRACONIAN` | Green Draconian | 緑色ドラコニアン | `Dr` | current_subspecies | [draconian-green.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/draconian-green.yaml#L3) |
| `SP_GREY_DRACONIAN` | Grey Draconian | 灰色ドラコニアン | `Dr` | current_subspecies | [draconian-grey.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/draconian-grey.yaml#L3) |
| `SP_HALFLING` | Halfling | ハーフリング | `Ha` | deprecated_compatibility | [deprecated-halfling.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-halfling.yaml#L4) |
| `SP_HIGH_ELF` | High Elf | ハイエルフ | `HE` | deprecated_compatibility | [deprecated-high-elf.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-high-elf.yaml#L4) |
| `SP_HILL_ORC` | Hill Orc | 丘オーク | `HO` | deprecated_compatibility | [deprecated-hill-orc.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-hill-orc.yaml#L4) |
| `SP_HUMAN` | Human | 人間 | `Hu` | current_start | [human.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/human.yaml#L3) |
| `SP_KOBOLD` | Kobold | コボルド | `Ko` | current_start | [kobold.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/kobold.yaml#L3) |
| `SP_LAVA_ORC` | Lava Orc | 溶岩オーク | `LO` | deprecated_compatibility | [deprecated-lava-orc.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-lava-orc.yaml#L4) |
| `SP_MAYFLYTAUR` | Mayflytaur | カゲロウタウル | `My` | deprecated_compatibility | [deprecated-mayflytaur.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-mayflytaur.yaml#L4) |
| `SP_MERFOLK` | Merfolk | 人魚 | `Mf` | current_start | [merfolk.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/merfolk.yaml#L3) |
| `SP_METEORAN` | Meteoran | メテオラン | `Me` | deprecated_compatibility | [deprecated-meteoran.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-meteoran.yaml#L4) |
| `SP_MINOTAUR` | Minotaur | ミノタウロス | `Mi` | current_start | [minotaur.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/minotaur.yaml#L3) |
| `SP_MOTTLED_DRACONIAN` | Mottled Draconian | 斑模様のドラコニアン | `Dr` | deprecated_compatibility | [deprecated-draconian-mottled.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-draconian-mottled.yaml#L4) |
| `SP_MOUNTAIN_DWARF` | Mountain Dwarf | 山岳ドワーフ | `MD` | current_start | [mountain-dwarf.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/mountain-dwarf.yaml#L3) |
| `SP_MUMMY` | Mummy | ミイラ | `Mu` | current_start | [mummy.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/mummy.yaml#L3) |
| `SP_NAGA` | Naga | ナーガ | `Na` | current_start | [naga.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/naga.yaml#L3) |
| `SP_OCTOPODE` | Octopode | オクトポード | `Op` | current_start | [octopode.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/octopode.yaml#L3) |
| `SP_ONI` | Oni | 鬼 | `On` | current_start | [oni.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/oni.yaml#L3) |
| `SP_PALE_DRACONIAN` | Pale Draconian | 淡色ドラコニアン | `Dr` | current_subspecies | [draconian-pale.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/draconian-pale.yaml#L3) |
| `SP_POLTERGEIST` | Poltergeist | ポルターガイスト | `Po` | current_start | [poltergeist.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/poltergeist.yaml#L3) |
| `SP_PURPLE_DRACONIAN` | Purple Draconian | 紫色ドラコニアン | `Dr` | current_subspecies | [draconian-purple.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/draconian-purple.yaml#L3) |
| `SP_RED_DRACONIAN` | Red Draconian | 赤色ドラコニアン | `Dr` | current_subspecies | [draconian-red.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/draconian-red.yaml#L3) |
| `SP_REVENANT` | Revenant | レヴナント | `Re` | current_start | [revenant.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/revenant.yaml#L3) |
| `SP_SLUDGE_ELF` | Sludge Elf | 泥エルフ | `SE` | deprecated_compatibility | [deprecated-sludge-elf.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-sludge-elf.yaml#L4) |
| `SP_SPRIGGAN` | Spriggan | スプリガン | `Sp` | current_start | [spriggan.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/spriggan.yaml#L3) |
| `SP_TENGU` | Tengu | 天狗 | `Te` | current_start | [tengu.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/tengu.yaml#L3) |
| `SP_TROLL` | Troll | トロル | `Tr` | current_start | [troll.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/troll.yaml#L3) |
| `SP_VAMPIRE` | Vampire | 吸血鬼 | `Vp` | deprecated_compatibility | [deprecated-vampire.yaml:4](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/deprecated-vampire.yaml#L4) |
| `SP_VINE_STALKER` | Vine Stalker | 蔓の潜行者 | `VS` | current_start | [vine-stalker.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/vine-stalker.yaml#L3) |
| `SP_WHITE_DRACONIAN` | White Draconian | 白色ドラコニアン | `Dr` | current_subspecies | [draconian-white.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/draconian-white.yaml#L3) |
| `SP_YELLOW_DRACONIAN` | Yellow Draconian | 黄色ドラコニアン | `Dr` | current_subspecies | [draconian-yellow.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/species/draconian-yellow.yaml#L3) |

## Background source mapping

| Upstream identity | English name | 日本語名 | Code | Classification | Original source |
|---|---|---|---|---|---|
| `JOB_ABYSSAL_KNIGHT` | Abyssal Knight | 深淵の騎士 | `AK` | deprecated_compatibility | [job-data-deprecated-jobs.txt:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/util/job-gen/job-data-deprecated-jobs.txt#L2) |
| `JOB_AIR_ELEMENTALIST` | Air Elementalist | 風の精霊術師 | `AE` | current_start | [air-elementalist.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/air-elementalist.yaml#L2) |
| `JOB_ALCHEMIST` | Alchemist | 錬金術師 | `Al` | current_start | [alchemist.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/alchemist.yaml#L2) |
| `JOB_ARTIFICER` | Artificer | 魔道具使い | `Ar` | current_start | [artificer.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/artificer.yaml#L2) |
| `JOB_BERSERKER` | Berserker | 狂戦士 | `Be` | current_start | [berserker.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/berserker.yaml#L2) |
| `JOB_BRIGAND` | Brigand | 盗賊 | `Br` | current_start | [brigand.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/brigand.yaml#L2) |
| `JOB_CHAOS_KNIGHT` | Chaos Knight | 混沌の騎士 | `CK` | current_start | [chaos-knight.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/chaos-knight.yaml#L2) |
| `JOB_CINDER_ACOLYTE` | Cinder Acolyte | 燃え殻の侍祭 | `CA` | current_start | [cinder-acolyte.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/cinder-acolyte.yaml#L2) |
| `JOB_CONJURER` | Conjurer | 妖術師 | `Cj` | current_start | [conjurer.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/conjurer.yaml#L2) |
| `JOB_DEATH_KNIGHT` | Death Knight | 死の騎士 | `DK` | deprecated_compatibility | [job-data-deprecated-jobs.txt:16](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/util/job-gen/job-data-deprecated-jobs.txt#L16) |
| `JOB_DELVER` | Delver | 探索者 | `De` | current_start | [delver.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/delver.yaml#L2) |
| `JOB_EARTH_ELEMENTALIST` | Earth Elementalist | 地の精霊術師 | `EE` | current_start | [earth-elementalist.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/earth-elementalist.yaml#L2) |
| `JOB_ENCHANTER` | Enchanter | 呪術師 | `En` | current_start | [enchanter.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/enchanter.yaml#L2) |
| `JOB_FIGHTER` | Fighter | 戦士 | `Fi` | current_start | [fighter.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/fighter.yaml#L2) |
| `JOB_FIRE_ELEMENTALIST` | Fire Elementalist | 炎の精霊術師 | `FE` | current_start | [fire-elementalist.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/fire-elementalist.yaml#L2) |
| `JOB_FORGEWRIGHT` | Forgewright | 鍛造術師 | `Fw` | current_start | [forgewright.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/forgewright.yaml#L2) |
| `JOB_GLADIATOR` | Gladiator | 剣闘士 | `Gl` | current_start | [gladiator.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/gladiator.yaml#L2) |
| `JOB_HEALER` | Healer | 治療師 | `He` | deprecated_compatibility | [job-data-deprecated-jobs.txt:26](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/util/job-gen/job-data-deprecated-jobs.txt#L26) |
| `JOB_HEDGE_WIZARD` | Hedge Wizard | 野の魔術師 | `HW` | current_start | [hedge-wizard.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/hedge-wizard.yaml#L2) |
| `JOB_HEXSLINGER` | Hexslinger | 呪術射手 | `Hs` | current_start | [hexslinger.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/hexslinger.yaml#L2) |
| `JOB_HUNTER` | Hunter | 狩人 | `Hu` | current_start | [hunter.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/hunter.yaml#L2) |
| `JOB_ICE_ELEMENTALIST` | Ice Elementalist | 氷の精霊術師 | `IE` | current_start | [ice-elementalist.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/ice-elementalist.yaml#L2) |
| `JOB_JESTER` | Jester | 道化師 | `Jr` | deprecated_compatibility | [job-data-deprecated-jobs.txt:36](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/util/job-gen/job-data-deprecated-jobs.txt#L36) |
| `JOB_MONK` | Monk | 修行僧 | `Mo` | current_start | [monk.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/monk.yaml#L2) |
| `JOB_NECROMANCER` | Necromancer | 死霊術師 | `Ne` | current_start | [necromancer.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/necromancer.yaml#L2) |
| `JOB_PRIEST` | Priest | 司祭 | `Pr` | deprecated_compatibility | [job-data-deprecated-jobs.txt:46](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/util/job-gen/job-data-deprecated-jobs.txt#L46) |
| `JOB_REAVER` | Reaver | 略奪者 | `Re` | current_start | [reaver.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/reaver.yaml#L2) |
| `JOB_SHAPESHIFTER` | Shapeshifter | 変身術師 | `Sh` | current_start | [shapeshifter.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/shapeshifter.yaml#L2) |
| `JOB_SKALD` | Skald | 吟遊詩人 | `Sk` | deprecated_compatibility | [job-data-deprecated-jobs.txt:6](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/util/job-gen/job-data-deprecated-jobs.txt#L6) |
| `JOB_STALKER` | Stalker | 潜行者 | `St` | deprecated_compatibility | [job-data-deprecated-jobs.txt:56](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/util/job-gen/job-data-deprecated-jobs.txt#L56) |
| `JOB_SUMMONER` | Summoner | 召喚術師 | `Su` | current_start | [summoner.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/summoner.yaml#L2) |
| `JOB_WANDERER` | Wanderer | 放浪者 | `Wn` | current_start | [wanderer.yaml:3](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/wanderer.yaml#L3) |
| `JOB_WARPER` | Warper | 転移術師 | `Wr` | current_start | [warper.yaml:2](https://github.com/crawl/crawl/blob/1eebc1a2892e1c89776a0d7a10691f8dac8d9796/crawl-ref/source/dat/jobs/warper.yaml#L2) |

## Monster base-name catalogs

The monster catalogs contain **803 English/Japanese semantic IDs** from DCSS 0.34.1, pinned to upstream commit `1eebc1a2892e1c89776a0d7a10691f8dac8d9796`. This covers all **795 real monster enum identities** at the source's default `TAG_MAJOR_VERSION=34`: 671 current YAML records and 124 compatibility records. Eight fixed naming returns are cataloged separately. These are base names only; the C++ game's runtime name composition is not integrated or completely translated by this catalog.

| Source record classification | Count |
|---|---:|
| Current monster definitions | 638 |
| Genus labels | 18 |
| Category/player/sensed placeholders | 11 |
| Nonspawning definition | 1 |
| Debug definitions | 3 |
| Deprecated version-34 compatibility definitions | 124 |
| Fixed naming returns | 8 |

- `monsters.en.json` preserves every exact source base name, including the original `removed ` prefix for compatibility records.
- `monsters.ja.json` supplies individually authored Japanese names for the same ID set. Shared species/background terms follow the existing entity catalogs. These localizations are project terminology, not asserted official Japanese translations.
- `monsters-source-map.json` records the source enum or fixed branch identity, semantic ID, original name, exact source line, classification, and SHA-256 provenance for 680 source files. It separates compatibility records and fixed naming constants from current monsters.

IDs use the actual generator identity, for example `monster.mons_adder.name`; lookup is by identity, never by matching an English display string. `mon-gen.py` derives most identities from the declared name, while explicit enum overrides remain authoritative. Distinct identities with the same English name (including the Bai Suzhen forms and Serpents of Hell) retain separate IDs. All English names match the pinned source bytes and every Japanese ID is present; there is no English fallback or global replacement.

Every base record declares `grammatical_form: "base"` and an empty typed `parameters` object. Fixed naming returns declare `base`, `possessive`, or `diagnostic` as appropriate. None of these 803 names accepts interpolation parameters. The unobservable-monster branch has separate plain `something` / `何か`, possessive `something's` / `何かの`, and diagnostic `it (buggy)` / `それ（不具合）` entries. Random/wandering enum sentinels retain their five exact labels. Sensed monster base categories are covered through their own YAML identities.

Articles, capitalization, plurals, quantity/head-count grammar, the `sensed ` descriptor prefix, colour/job combinations, zombie/spectral/item-derived names, generated proper names, and `mname` composition remain outside this base-name coverage. The static player/ghost/illusion labels are translated; external player usernames, ghost identities, and generated or customized proper names are preserved verbatim. The checker includes a disconnected descriptor lookup with Japanese as its default and verifies external-name passthrough; this is not wired into the game runtime.

Run `node tools/check-monster-catalogs.mjs --self-test` from the DCSS folder. The check validates pristine upstream Git HEAD, all 680 source hashes, all real enum identities, original English names, exact bilingual IDs, duplicate-key rejection, grammatical metadata, and empty placeholder parity. Its 21 probes also cover enum overrides, shared display names, compatibility prefixes, missing/extra IDs, malformed catalogs, invalid identities, and external-name preservation. For a source archive without `upstream/.git`, `--archive` explicitly validates the pinned manifest and source-byte hashes without claiming Git HEAD evidence.

The official source attribution and license obligations continue to apply as recorded in the repository notices. This catalog does not establish full gameplay, help/error/settings localization, dynamic-name coverage, browser-game verification, or publication readiness.
