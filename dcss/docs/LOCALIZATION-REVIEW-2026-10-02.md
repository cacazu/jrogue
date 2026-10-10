# DCSS source localization review — 2026-10-02

Independent, bounded review of the installed DCSS project at
`C:\Users\kit\gameme\jnethack\jrouge\dcss`. The original source is release
0.34.1, commit `1eebc1a2892e1c89776a0d7a10691f8dac8d9796`. Source line
references below refer to the pristine `upstream/crawl-ref/source` tree unless
explicitly identified as adapter files.

This pass reads source and catalogs and uses small Node-only review probes.
It does not build, link, package, execute the C++ or Rust engines, launch a
browser, publish, or change Git. Free physical memory before the review was
4,297,220 KiB; review probes use a 128 MiB V8 old-space limit. This report does
not establish full Japanese gameplay coverage or close the publication gate.

## Reviewed scope and terminology

Read `locales/README.md`, `locales/entities/README.md`, architecture/boundary
documents, the semantic migration backlog, original `message.cc::canned_msg`,
the `_mpr` pipeline, original `ng-input.cc`, and relevant `newgame.cc`/`startup.cc`
conditional startup paths. Additional anchors in `options.h`, `initfile.cc`,
`l-crawl.cc`, `delay.cc`, and `lang-fake.cc` establish the canonical control
contracts. The new Rust event type/application path and JavaScript event
observer/history/display path were reviewed independently as source.

Keep the established distinction: species = **種族**; background/job =
**職業（開始時の経歴）**; source abbreviation = **識別コード**. Existing
project names such as 深層エルフ, 山岳ドワーフ, ドラコニアン, 妖術師,
召喚術師, and 呪術 remain enum-based labels. Starting choices, evolved forms,
deprecated compatibility records, canonical codes, and display names are
different categories. The name-only entity catalog does not supply adjectives,
genus, pronouns, item names, plural forms, or description text.

The canned slice has **37 enums and 45 complete conditional display IDs**.
Its parameters are empty objects because the finite body/location/HP-casting
choices were resolved to separate meaning IDs at the original source branch.
This is a legitimate bounded conversion. It is not a generic raw-English
`game.message { text }` conversion and is not a percentage of all gameplay text.

The startup slice contains **51 bilingual IDs for 37 fixed output sites**:
opening, welcome, name prompts, seed prompts, and weapon-choice text. The
startup catalog declares `runtime_integration: false`,
`full_startup_coverage: false`, and `full_game_localization: false`. Options-read
status, rerolls, species/job menu descriptions, game-mode/map menus, ordinary
item names, help bodies, and the main `startup.cc` menu remain outside this
slice. An enum-name catalog and these fixed message catalogs do not imply
complete startup or game localization.

## Canonical English must retain the original control route

The source has several distinct string phases; a single “English text” field
cannot replace all of them while preserving existing rc/Lua behavior.

| Phase | Source-grounded contract | Localization constraint |
|---|---|---|
| Before `_mpr` | `do_message_print` formats the originating varargs once (`message.cc:1258–1274`). | Resolve a semantic ID/typed data at the originating call; preserve this canonical formatting for original controls. |
| Entry | `_mpr` switches to `rng::UI`, performs crash/debug/stderr handling, and normalizes GOD parameter (`1510–1539`). | The optional observer cannot enter gameplay or replace the canonical function. UI RNG is still an original engine stream. |
| `prepare_message` | Suppression/silence can return muted; note/delay checks run on the original unprefixed input; message-colour regex rules run afterward (`1810–1841`). | Do not match Japanese. A colour mapping to mute can occur after note/interruption effects already happened. Suppressed events must not be displayed by the semantic observer. |
| Tees and mute | A colour prefix is added, tees appended, and an initialized muted message returns before Lua (`1543–1558`). | Raw descriptor notification before this gate would reveal otherwise suppressed prose and misstate acceptance. |
| Lua and patterns | `c_message` receives colour-prefixed canonical text and canonical channel string before capitalization/language filtering; then more/flash/join checks run (`1563–1572`). | Preserve canonical arguments and regex stages. A translated parameter must never become the Lua control string. |
| Formatting/buffer | Quad-damage capitalization, normal capitalization, fake-language filters, `message_line`, and `buffer.add` follow (`1577–1589`). | Export the accepted event after original nested emission order is preserved; snapshot emphasis rather than reread a duration on replay. |
| I/O effects | Errors force interruption, prompts/errors stop auto-clear, and selected more/flash effects execute once (`1591–1609`). | Boolean metadata describes an engine decision; rendering it must not execute `more`, clear history, flash, or interrupt again. |

`message_filter::is_filtered` compares the original channel and regex (`options.h:88–94`).
Rc parsing accepts canonical channel prefixes and legacy literal-colon behavior
(`initfile.cc:3372–3392`). The stock `dat/defaults/messages.txt` contains English
force-more patterns; `dat/defaults/runrest_messages.txt` contains English stop
and ignore rules. Arbitrary user rc regexes cannot be translated automatically.

`c_message` recursion is protected by the original `_doing_c_message_hook`,
but **nested message emission also occurs before this hook**: `prepare_message`
can interrupt a delay; delay Lua hooks run in `delay.cc:953–985`. A pending
semantic ID must be consumed into a local snapshot at `_mpr` entry, before
`prepare_message`, and cleared so nested raw messages cannot inherit the outer
canned ID. If a hook emits another message, that nested message reaches the
original buffer first; the semantic observer must retain that order.

Lua `crawl.mpr` accepts arbitrary authored/user text and canonical channels
(`l-crawl.cc:61–84`). `crawl.messages` reads the canonical message buffer
(`748–752`), and compiled message filters expose canonical matching
(`849–886`). These remain separate open migration paths. Usernames, external
Lua text, inscriptions, and machine identifiers must not be translated by
global replacement or by entity-name substitution inside an English sentence.

## Canned context and control traps

| Family | Source facts | Required Japanese/data behavior |
|---|---|---|
| Something appears | `player_has_feet()` selects “at your feet” versus “before you” (`1955–1957`). | Two IDs; no assumption that every playable form has feet. No concealed entity identity. |
| Resistance | Only `MSG_YOU_RESIST` calls `learned_something_new(HINT_YOU_RESIST)` (`1965–1967`). | Display/replay cannot re-trigger learning; partial resistance remains separate. |
| Repeat cancellation | Nine cases call `cancel_cmd_repeat` (`1972–2012`). | Preserve the original call and its position once; the event must not become a new command. |
| Empty weapon | Already/now × mouth/claws/tentacles/hands (`2014–2027`), with precedence no-grasping → usable claws → usable tentacles → hands. | All eight variants remain distinct. They mean no wielded weapon, not empty inventory or absent shield; original `item-use.cc:1681–1702` supplies the weapon-slot context. |
| Blink | `MSG_YOU_BLINK` (`2029–2031`) is game relocation. | 短距離転移; never literal blinking of the eyes. |
| Capacity/recovery/drain | Capacity increase/decrease (`2038–2043`), full/gain health/magic (`2059–2070`), and HP-casting/magical-energy drain (`2071–2077`) are different notices. | Do not collapse maximum capacity, current resource recovery, and drain. Keep “already”, “momentarily”, “suddenly”, and “now” distinctions. |
| Unseen obstruction | “ghostly outline” and fizzle (`2056–2058`), “something in the way” (`2079–2081`). | Preserve uncertainty. Do not label the outline as an actual ghost monster or reveal a hidden species. |
| Declined god action | “Your god … now” (`2085–2087`). | Preserve the player's worship relationship and temporary refusal; do not report permanent inability. |
| Channel/nojoin | OK is PROMPT, Huh is EXAMINE_FILTER, ordinary magic drain is WARN, other branches are PLAIN; only death calls `mpr_nojoin` (`1991–2012`, `2053–2054`, `2073–2076`). | Preserve source channel numbers and nojoin. Do not infer warning severity from Japanese punctuation. |

Manual review of all 45 drafted Japanese entries found no blocking context or
schema defect. Two wording clarifications were sent to the catalog owner and
adopted: all eight empty-body variants explicitly name **武器**, and declined
divine action names **信仰する神**. These preserve the original display meaning
without altering the original engine string or any mechanics.

## Joining, RNG and native history are separate contracts

The effective join flag is not just `_mpr`'s preliminary boolean:
`message_line` additionally requires canonical `strwidth(pure_text) < 40`
(`message.cc:117–122`). Repeat condensation compares exact original text,
channel and parameter; short-message merging additionally depends on turn,
joining flags, punctuation, and line width (`145–191`). `_ends_in_punctuation`
checks ASCII punctuation only (`49–64`). Do not re-run these English heuristics
on Japanese text to make new engine decisions. The browser log is currently a
separate display projection, not a native history replacement.

Fake language filtering runs once inside `_mpr` after canonical hooks.
The “butt” filter uses RNG (`lang-fake.cc:524–550`); `filter_lang` chooses the
configured transforms (`554–588`). Original UI-stream draws must remain once
per original emission. Localization, redraw, resizing, changing language, and
history replay cannot run these filters or draw again. The present Japanese
canned projection does not localize those optional fake-language settings;
keep that explicit in coverage accounting.

Native `save_messages` writes full rendered canonical text, channel, parameter,
and turn (`message.cc:2214–2224`), not IDs or immutable parameters.
`load_messages` restores stored lines directly (`2227–2256`); history excludes
PROMPT, EQUIPMENT, and EXAMINE_FILTER (`1795–1805`, `2259–2267`). The semantic
log keeps its latest 200 descriptors with a monotonic decimal-u64 session
sequence. It currently has no native/save checkpoint persistence. A new page
or engine instance starts a new sequence domain. Do not reconstruct old IDs
by string matching, nor claim cross-resume semantic history compatibility.

## Startup source-to-ID constraints

Opening screen has version and copyright content (`ng-input.cc:17–24`);
version/copyright identity is data and attribution, not a translated engine
identifier. Options-read success deliberately hides full directory structure
under `DGAMELAUNCH` by using `basefilename` (`26–59`). Any source descriptor
must retain that selected visibility; a translated success message must not
export the otherwise hidden path. Missing versus unreadable options are
different branches. Paths themselves remain untouched data.

`_welcome` has distinct combinations of unknown species/job, absent/present
player name, and the unnamed-character qualifier (`newgame.cc:167–189`).
`newgame_char_description` also distinguishes random and recommended species,
background, and whole-character choices (`147–164`). Convert these by their
state/identity branches rather than parsing a composed phrase. External names
remain exact text, even when they equal an English species name.

The selected character description uses original English `a/an` composition
(`newgame.cc:358–363`, `581–586`); Japanese needs a complete template and typed
entity labels, not translated articles. Starting menu rows use source enum
IDs and hotkeys. Banned combinations are filtered before display; Delver is
omitted for Sprint (`1547–1558`) and evolved/nonstarting species are not added
to an unknown-job starting list (`1595–1604`). Keep source codes, option names,
hotkeys, menu IDs, and machine values canonical.

Prompt contracts differ. Random-combination `[Y/n/q]` accepts many keys by the
existing default and rejects/rerolls by specific tokens (`382–405`). Name
overwrite `[Y/n]` accepts **only uppercase `Y`** (`693–712`). These are not
interchangeable generic yes/no handlers. Japanese prose can describe the
choice while retaining original tokens/default/cancel behavior.

The original recommended-choice description at `newgame.cc:1381` uses the
`other_choice_name`/`choice_name` nouns in an apparently reversed direction
relative to its selected option and `M_VIABLE` handler (`1500–1505`). Preserve
exact source English in this source-faithful catalog and record the upstream
wording discrepancy. A wording correction needs a separately identified
change; it must not be hidden inside localization equivalence claims.

Seed `0` means random, version affects deterministic layouts, and daily seed
uses local-time `%Y%m%d` (`newgame.cc:846–847`, `894–902`, `906–920`). Clipboard
help is conditional on `USE_TILE_LOCAL`, stable-seeding warnings on
`SEEDING_UNRELIABLE`, and the pregeneration toggle visibility on game state.
Do not invent browser clipboard permission, change the seed to a rounded JS
number, regenerate daily seed on rendering, or show unavailable UI controls.
Original name validation uses display width/UTF-8 and platform conditions
(`ng-input.cc:62–96`), while some original edit paths remain byte-based. A
translated label does not close CJK/IME name-entry tests or fix that source UI.

Starting weapon rows have a separate identity contract. The current unarmed
row selects claws using `species::has_claws(ng.species)`
(`newgame.cc:1701–1702`); the prior-default label uses literal unarmed for
`WPN_UNARMED`, regardless of that species predicate (`1797–1802`). Main rows
cannot contain Random or Recommended, while the prior-default label can.
The final source map therefore distinguishes `current_choice` (fixed claws or
unarmed references) from `previous_choice` (fixed unarmed, random or
recommended references). Ordinary weapon item IDs are an explicit later
integration dependency in both contexts. The original row format, label
chopping/padding, selected hotkey, and signed aptitude behavior must still be
implemented and checked with CJK widths; a neutral text template alone does
not reproduce that layout.

Manual review of all 51 startup Japanese entries found no blocking meaning or
schema issue. Eight welcome variants, both English article branches, both
signed-aptitude branches, and all four seed-footer compile variants remain
separate. Version/copyright, external player names and seed echoes, and
ASCII command tokens remain exact data. Shared message metadata now records
the emission condition of each source site rather than implying that its
first condition applies to every occurrence. The recommended-choice wording
discrepancy described above is outside the present 51-ID slice.

## Independent findings and resolution ledger

| Finding | Evidence/action | Status |
|---|---|---|
| Effective join can differ from preliminary flag | Reported `message_line` width rule; staged adapter exports actual `msg.join` after `buffer.add`. | Closed in source review; runtime held. |
| Nested pending ID may leak before Lua | Reported interruption-hook recursion before `c_message`; staged patch consumes the ID at `_mpr` entry before `prepare_message`. | Closed in source review; runtime held. |
| Quad-damage emphasis was absent | Reported source transform; root added immutable `shout` metadata, English uppercase rendering and Japanese emphasis styling. | Source reviewed; runtime held. |
| Error-reporting observer could terminate core | A throwing `rejectCoreMessage` could reach outer `fail`; root added `reportSemanticFailure` with its own no-throw handling in `web/core-debug.mjs:34–40`. | Closed in source; owner host probes include throwing render/report observers. |
| Live history repeatedly reannounced old entries | `replaceChildren` in live OL recreated all retained entries; root keeps nodes keyed by sequence, makes history quiet, and uses a dedicated announcer for newly accepted text. | Closed in source; actual assistive-technology test held. |
| Protocol mock assumed string catalog entries | Final canned values are `{text,params:{}}`; old stub expected strings. Owner added `fixedText` extraction. | Closed in source; execution evidence tracked by root. |
| Empty weapon/divine relationship Japanese wording | Sent 武器 and 信仰する神 clarification; catalog owner adopted both. | Closed in final installed catalogs. |
| Startup weapon reference binding allowed impossible contexts | The previous generic binding accepted Random/Recommended in current rows and claws in prior-default labels. Owner narrowed the two reference contexts; independent probes reject all three combinations. | Closed in source and the disconnected catalog renderer; engine integration held. |
| Shared startup IDs retained only the first emission condition | Seed Begin and unarmed labels occur at different source sites. Owner added `source_emission_conditions` per source site and checks their site parity. | Closed in final source-map metadata. |

Rust `GameMessageEvent` uses `deny_unknown_fields`, a required source/version/
upstream pin, canonical positive decimal-u64 sequence, bounded turn/colour,
zero parameter, exact registered ID/channel/nojoin, and contradictory-join
checks. The application validates before rendering; presentation is an
immutable observation. JavaScript uses structured clones and `BigInt` for
sequence ordering and inserts plain `textContent`. CJK-capable system fonts,
wrapping and a scrollable log are present in source. These observations do
not imply that pending Rust tests or actual browser checks passed.

## Review receipts and remaining evidence

The independent `tests/semantic/review-localization.mjs` probe rechecks the
pinned source hashes, every original receipt, 37 enums/45 conditional IDs,
exact English branch resolution, duplicate root IDs, bilingual ID parity,
empty parameter/placeholder contracts, and channel/nojoin exceptions. It
also verifies the startup source hashes, 37 exact output spans, ten control
receipts, typed placeholder schemas, command-token parity, per-site emission
conditions and weapon reference contexts. It independently reconstructs
the four seed-footer compile variants from pristine source and executes seven
positive/rejection probes against the disconnected startup renderer. It does
not infer translation quality, run source generators, or execute the engine.
Run with the installed Node and `--max-old-space-size=128`.

Additional source SHA-256 receipts for this review:

| Original file | SHA-256 |
|---|---|
| `message.cc` | `63d0aa5d84e3f82301fb948d0f4e4c80bc113971aa273ade7ae539c8844a4784` |
| `canned-message-type.h` | `1802137341109fca9334263f824b3e9b1b45186ddfcbe5404b04abb6ccf09bfd` |
| `mpr.h` | `6931ce4d3d30675dd69dd952e2184f0bb105b01228a1aa51e081a6881449b3a4` |
| `ng-input.cc` | `23758132dc149752d890f8f21bed173286a48d7661bd026acf45a7f902abe978` |
| `newgame.cc` | `b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c` |
| `startup.cc` | `bc50d0c2de6df07233a36c89e9c1f22baa90566abdfc50d222848c961dfc36f5` |
| `options.h` | `148ab724452f3f1eba540bd4c8b90a9a59da5eb60f142baacaafc11559b567da` |
| `initfile.cc` | `0fe713cefa686c761ba60c1323ab7757c49785664fd23d34b592f47ea3b6f14f` |
| `l-crawl.cc` | `5b40b1f0f9bd00003ed2b632d82626c28a97f9ee5f8629952f5b1c8cb01d36ef` |
| `delay.cc` | `a6b42eb7211cacda64f147f0862a1a40e95808da7d73edea8e6df7d2514b0c51` |
| `lang-fake.cc` | `13cc3c72e0e446e915a5fdb792e22b16947f5ceba2596efa0eea2739a1f1acc5` |
| `version.h` | `bbcf4c21e2c100914fa1d42f07ae3e31e16c72ff9db69262888c1eb2426484a4` |
| `externs.h` | `0da9b608627678b4c0586375745e7ccc0221383c64bee5bc0e50136fab437c90` |

Final installed canned catalogs passed the independent Node probe: **37 enums,
45 IDs per language, three original-source hashes and 135 exact line receipts**.
The probe also checked exact English conditional expansion, original numeric
channel values, death-only nojoin, zero parameters/placeholders, and duplicate
root IDs. The final combined probe also passed for **51 startup IDs per
language, 37 exact output sites, four pinned source hashes, ten exact control
receipts, four independently expanded footer variants and seven context
renderer probes**. Free physical memory immediately before this final run
was 6,125,088 KiB. No C++, Rust, or browser artifact was executed.

| Reviewed artifact | SHA-256 |
|---|---|
| `locales/gameplay/canned.en.json` | `068e635a4c6d8d27407976616c22cbbdea4790b0208d377b5a1ed32438366c6c` |
| `locales/gameplay/canned.ja.json` | `e17f1099480b067064437f4dd8bf007e66b78a51d728a9c022bf70e42cbf625f` |
| `locales/gameplay/canned-source-map.json` | `3adb85293888b9e4fe8b0bfdff9e1f82edc385c6a4d3816beca1d1b82888a0a3` |
| `locales/startup/en.json` | `1fe29184d921ff7b809f168394efddd9601681c357481fddb87bda8cc77bb866` |
| `locales/startup/ja.json` | `849f34f6db7f27595bbec292b1ad522baf8757db8c392b82da6c9b0102a629ab` |
| `locales/startup/source-map.json` | `cac159c02ec30ebcadebf8188228d25f15e03af51d1a7533ad25c9c64dec042c` |
| `tools/check-startup-catalogs.mjs` | `e00b2ce9f06d934fa9eaaeeaf4bedd646e18e3b4977bf986bafcf00d06983282` |

The startup owner separately reports 40 catalog self-test assertions passed;
the canned owner reports 30 probes. The coordinator separately reports 16
semantic host/projection stub checks and the existing 27 worker-protocol
checks passed. These are source/catalog/host-test results, not executed
Rust/C++ integration or real browser verification. The independent probe
above supplies this reviewer's execution evidence; the other reported suites
remain coordinator/owner receipts.

Reviewed the staged `apply-semantic-patches.py` and `semantic-canned.inc` as
source only. They bind the original feet predicate once, read quad-damage at
the original post-hook formatting point, wrap all 40 original print sites,
and retain 37 labels/45 IDs. The generator's inverse transform removes only
its wrappers and the feet binding and requires the entire canned region to
equal normalized pristine source. Its source-map checks retain original calls,
channel values, nojoin and parameter 0. This is useful source equivalence
evidence, not an executed native/WASM behavior test. No adapter file or
`engine/work` source was changed by this reviewer.

Still required after the shared lightweight hold is released: compile and
run exact Rust/C++ integration tests; compare canonical rc/Lua behavior,
nested emission ordering, all RNG streams, muted/quiet paths, prompts and
native save behavior with the observer enabled/disabled; real PC/mobile
browser/CJK/IME/assistive-technology checks. Genuine startup-source catalog
integration and the remaining startup sites, dynamic entity/quantity grammar,
all other gameplay/resource text,
semantic save history, and publication remain separately tracked scope.
