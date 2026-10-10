# Startup text: bounded first-slice review

Added 2026-10-02 for official DCSS 0.34.1, source commit
1eebc1a2892e1c89776a0d7a10691f8dac8d9796. The retained upstream files were read,
not executed or changed. This work adds disconnected catalog data and a Node
checker. Catalog availability does not convert the native startup emitter.

## Verified boundary

There are **51 IDs in each language for 37 selected output sites**. Counts refer
to physical C++ presentation expressions: labels and nonempty tooltips count
separately; repeated Begin setters count separately; composed sentences count as
one site. The weapon-row format is included. Raw data echoes and protocol values
are recorded separately.

| Area | Selected source | Output sites | Bilingual IDs |
|---|---|---:|---:|
| Opening | ng-input.cc, opening_screen() | 1 | 2 |
| Character welcome | newgame.cc, _welcome() | 1 | 8 |
| Name | _choose_name() and choose_game() missing-name failure | 8 | 9 |
| Seed | SeedTextEntry::update_buttons() and _choose_seed() | 11 | 12 |
| Weapon | _construct_weapon_menu() and _prompt_weapon() | 16 | 20 |
| Total | | 37 | 51 |

locales/startup/source-map.json classifies every selected output site and records
its exact source path, original line range, function, original expression and
string literals, semantic IDs, parameter bindings, branch conditions, and
control/action metadata. Ten additional source ranges document silent validation
and input transitions. Four untranslated outputs record the player-name echo,
two generated decimal seed echoes, and the ordinary weapon-name dependency.
Two Web serialization mirrors reuse existing text and retain protocol keys.
Expression hashes normalize line endings to LF; whole-file hashes cover exact
source bytes.

The source map and checker pin these official file hashes:

| File under crawl-ref/source/ | SHA-256 |
|---|---|
| newgame.cc | b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c |
| ng-input.cc | 23758132dc149752d890f8f21bed173286a48d7661bd026acf45a7f902abe978 |
| version.h | bbcf4c21e2c100914fa1d42f07ae3e31e16c72ff9db69262888c1eb2426484a4 |
| externs.h | 0da9b608627678b4c0586375745e7ccc0221383c64bee5bc0e50136fab437c90 |

## Text and identity decisions

Fixed entries are strings; parameterized entries use the current catalog shape
{ "text": "...", "params": { ... } }. Parameter kinds are only text, unsigned,
and integer. Both languages have identical IDs, parameter schemas, and
placeholder sets. Rich source binding metadata stays in the source map.
There is no English text matching, fallback, or global string replacement.

The eight welcome variants cover all combinations of a present player name,
known species, and known background. Existing species.sp_*.name and
job.job_*.name IDs supply translated entity names. The disconnected checker
resolves those IDs against the existing 160-entry bilingual entity set; it
rejects literal English species/job names. External player text and version
metadata are inserted once and preserved verbatim, including braces that look
like placeholders. The official game title and complete original copyright
notice remain unchanged.

The name title has explicit English a/an variants, with identical Japanese
templates. Aptitude has nonnegative and negative variants to preserve %+d,
including +0, while accepting typed integers. The source's four seed-footer
variants cover the independent USE_TILE_LOCAL clipboard section and
SEEDING_UNRELIABLE warning. Empty tooltips are metadata, not missing messages.
Shared IDs retain an emission condition for each physical source site.
Current weapon rows allow claws/unarmed fixed-name references; previous-choice
labels allow random/recommended/unarmed references. These sets deliberately
differ. Ordinary weapon IDs still require item-catalog integration.

Japanese wording was independently reviewed. 開始 denotes the genuine new-game
action. 素手 and 爪 remain distinct; the old-choice label deliberately uses
素手 even where the current choice row says 爪, matching upstream.
技能訓練適性 describes training rates. Recommended random selection is
おすすめからランダム選択, not a promise to select the highest aptitude.
Bksp - キャラクター選択に戻る returns to character selection.
ASCII command tokens such as Enter, Tab, Shift-Tab, Bksp, Esc, +, *, %, ?, d, p,
and ctrl-v retain their original meanings.

## Source controls that must survive conversion

- The name UI is compiled only without DGAMELAUNCH and is requested after
  character selection when the configured name is empty. Enter trims input;
  blank input attempts to generate an unused random name. The generic invalid
  name feedback is translated as その名前は使えません！; the validator emits no
  individual error reason.
- The overwrite prompt retains [Y/n]. Actual confirmation accepts uppercase
  ASCII Y only; other input dismisses the prompt without overwriting. No new
  confirmation hint or changed key behavior was added.
- Name validation uses filename-safe nonemptiness, Unicode iswalnum, allowed
  punctuation (- . _ space), and a display-width limit of 30. Windows additionally
  rejects CON/NUL/PRN and all LPT-prefixed names. The name UI buffer is 31 bytes,
  so UTF-8 capacity and display-width limit differ. Unicode acceptance also
  depends on the native runtime locale. Catalog rendering tests do not establish
  native Japanese-name input correctness.
- Seed input accepts ASCII digits and editing keys. Begin is enabled by
  nonempty input, not complete numerical validation. The source notes that
  oversized unsigned scanning may saturate at the maximum without emitting an
  error; this slice invents no overflow or invalid-seed message. Generated
  64-bit decimal seed text must not pass through JavaScript Number.
- The daily action formats the local environment date as YYYYMMDD, not
  necessarily UTC. [-] clears input and disables Begin. Pregeneration is hidden
  under DGAMELAUNCH. Web control has a specific focus bypass for Begin.
- Banned weapon choices are removed before display; restricted choices can
  remain selectable. Recommended random selection samples unrestricted choices
  and falls back to all legal choices. A single legal choice is automatic; jobs
  without weapon choice and species without grasping skip the popup. Backspace,
  Escape, and Space return to character choice; X/Ctrl-Q exits. Help and aptitude
  actions remain in the popup.

## Verification and remaining source conversion

Run from the DCSS folder:

    node tools/check-startup-catalogs.mjs --self-test

Verified with installed Node 24.19.0 on Windows after checking memory headroom:
four exact source hashes, 37 output-site receipts, all 51 bilingual IDs, 160
entity reference IDs, and 40 assertions. Negative probes cover duplicate JSON
keys at multiple depths, malformed JSON, changed English, missing IDs, English
fallbacks, placeholder/schema mismatch, raw English entity references, unknown
IDs, changed command keys, wrong numeric types/ranges, and unsupported languages.
Positive probes preserve external names and metadata without recursive
interpolation, explicit aptitude signs, copyright, and the claws/unarmed
distinction. The checker is read-only and location-independent. No engine/Cargo
build, link, browser, Git operation, or packaging job was run for this slice.
Independent source review closed two metadata defects: shared source conditions
were made explicit per site, and current/prior weapon-name reference sets were
narrowed to their respective original branches. Exact padded weapon-row/CJK
layout rendering remains pending; the rendering probe checks a text template.

The next source conversion is to make the selected native emitters produce
semantic IDs plus typed descriptors at these exact sites. _welcome() needs a
structured name/species/job descriptor, not localized English fragments.
The weapon rows and prior-choice label additionally need the ordinary item-name
catalog mapped by WPN_* identity. Root-level catalog embedding alone does not
perform this conversion.

After this slice, the adjacent options_read_status() has three assembled
variants; filenames must remain external and its readable-file branch must
preserve the DGAMELAUNCH basename restriction. The remaining UINewGameMenu
species/background controls, random reroll, mode/map menus, startup main menu,
and help bodies require separate source receipts. The original recommended-choice
description at newgame.cc:1381 has a noun-order issue that must be documented
before any intentional behavior/text correction.

This is complete for the explicitly selected fixed-label/prompt slice.
Runtime startup localization, full startup coverage, ordinary item labels,
native Japanese input, browser flow verification, and full game localization
remain unverified by this work.
