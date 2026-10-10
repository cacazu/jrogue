# DCSS semantic localization migration backlog

Review snapshot: 2026-10-02. Authoritative gameplay remains the original C++
DCSS 0.34.1 engine at `1eebc1a2892e1c89776a0d7a10691f8dac8d9796`.
Rust owns the requested display, input, and platform boundaries. This document
was initially a planning snapshot. The follow-up source milestone is recorded in
[SEMANTIC-INTEGRATION.md](SEMANTIC-INTEGRATION.md): all 37 canned identities
now have 45 source-selected bilingual variants at 40 canonical print sites,
and 37 selected startup sites have 51 catalog IDs. The canned observer is
applied only to the separate work copy and is rebuilt. Genuine no-spells
observations and the single native `startup.weapon.prompt` are exercised in
actual engine tests. The other startup sites and broader gameplay remain
unconverted. The ten semantic conversion phases and whole-game Japanese
completion gates remain open.

## Current coverage and the release gap

The checked-in `locales/en.json` and `ja.json` each contain **135 adapter IDs** (128 and 131 belong to historical boundary snapshots).
The entity catalogs each cover **160 name/code IDs**: 80 manually translated
primary names and 80 unchanged two-character identity codes. Those records are
47 species (27 selectable starts, 8 evolved Draconian colour forms, 12
deprecated compatibility records) and 33 backgrounds (26 current, 7 historical).
These counts must not be described as 47 playable starting species, 33 current
backgrounds, or 160 translated gameplay messages.

`port/src/display.rs::Catalog::embedded` now merges the adapter, species/job,
canned and startup catalogs, giving **391 IDs per language**. The current rebuilt boundary passes 40 tests and
Clippy. The earlier 288-ID artifact is historical evidence.
`web/app.mjs` uses the source mapping to build localized browser selections
from `current_start` records. Values remain the original codes, which can be
passed to the authoritative engine without interpreting a Japanese label.
The source-name checker verifies all 80 original identities, 76 source hashes,
exact name/code coverage, and 15 positive/negative assertions.

Source checks establish catalog coverage for these bounded registered scopes. It
does **not** establish semantic coverage of the original game. In particular,
the engine bridge documented in `engine/HOST-ABI.md` currently supplies console
frames, input, snapshots, and native saves; it has a built canned observation callback but does not expose a complete
typed gameplay-event stream. Original gameplay prose, HUD text, item/monster grammar,
descriptions, speech, help, configuration errors, and death/victory prose still
require conversion at their semantic source sites. The native-Wasm-EH baseline passed 17 ordinary-browser checks, and its first
font-free artifact passed controlled combat/branch/death/victory checks. Those
receipts identify their historical outputs. The current native Japanese
weapon-prompt artifact separately passed Node smoke8, fresh-process resume5
and actual ordinary-Chrome18, including the bare-root Japanese/CJK menu,
physical-key quickstart help, PC/mobile input, native IndexedDB resume,
all-45-stream neutrality and terminal cleanup. Seventeen JA/EN and cross-locale
resume comparisons match every exposed field and every ordered PCG word/count
without ignored fields; they do not compare independent clock-bearing native
save bytes across runs or parse every save tag. The exact current artifact also
passed 26 controlled original-engine combat/branch/death/victory checks; those
fixtures do not establish an unassisted playthrough or complete Japanese text.
Current guarded
startup/default-route protocol mocks passed 88
checks (44 Worker, 19 JSPI, 16 semantic, 9 lifecycle), without executing a native
engine, WASM or browser. Neither historical gameplay checks nor protocol mocks
establish whole-game Japanese completion. Proposed future 11-ID work is
source-only and is not part of the active 391 IDs.

## Inventory evidence and counting rules

`docs/inventory/summary.json` records these lexical discovery counts:

| Artifact | Occurrences |
|---|---:|
| C/C++ quoted/raw literals | 45,636 |
| Conservative script literal candidates | 11,572 |
| Nonempty resource lines | 354,490 |
| Full database description/speech blocks | 17,960 |
| Heuristic likely-player-text classifications across artifacts | 234,962 |

These are **candidate occurrences**, not unique translatable messages or a
release denominator. They include identifiers, developer/test text, inactive
history, foreign-language resources, directives, and fragments. Resource lines
overlap database blocks. Adjacent C++ literals can form one message; generated
names and assembled grammar can form messages absent from any one literal.
The heuristic misses some short labels and includes some non-game prose.
Neither registered-ID counts divided by an inventory count nor subtracting 160 from that count
is a valid localization percentage.

The next ten clusters below were counted directly from
`cpp-literals.jsonl.gz`, selecting the explicitly listed source files. `All`
means all candidate literal rows in those files; `Likely` means the existing
heuristic classification. Files can overlap between clusters, so row totals
must not be added together. Each cluster first converts the bounded slice
described below, then expands through its remaining call graph and data.

| Priority | Conversion cluster | All | Likely |
|---:|---|---:|---:|
| 1 | Message dispatch, prompt contract, menu transport | 350 | 70 |
| 2 | Genuine startup menus and choice prompts | 438 | 136 |
| 3 | Item/monster/terrain names and grammar descriptors | 2,210 | 336 |
| 4 | HUD, durations, mutations, player notices | 3,846 | 1,733 |
| 5 | Movement, doors, stairs, travel safety | 704 | 261 |
| 6 | Combat actions, targeting confirmations, monster death | 1,525 | 693 |
| 7 | Inventory, item use/equipment, shops | 1,588 | 720 |
| 8 | Spells, abilities, religion | 3,196 | 1,874 |
| 9 | Descriptions, help, hints, speech/resource dispatch | 2,894 | 1,247 |
| 10 | Death/victory, saves, configuration errors | 3,328 | 801 |

All source paths and line numbers below refer to the pinned pristine
`upstream/crawl-ref/source` tree. Lines locate evidence, not semantic IDs.

## Ten concrete phases

### 1. Establish semantic dispatch and prompt control before translating prose

Files counted: `message.cc`, `message-stream.cc`, `mpr.h`, `prompt.cc`, `menu.cc`.
Start at `message.cc:1302` (`mprf` overloads), `:1510` (`_mpr`), `:1951`
(`canned_msg`), `:2098` (`simple_monster_message`), and `:2132`
(`simple_god_message`). Prompt/menu consumers include `prompt.cc:130`
(`yesno`), `:336` (`prompt_for_int`), and `menu.cc:1499`/`:1973`
(`Menu::show`/`Menu::process_key`).

First slice: emit explicit IDs for canned messages and generic prompt
outcomes; add an ordered semantic-event host callback with a versioned schema,
channel, sequence, turn, emphasis, joining policy, and prompt token. Retain a
separate counted raw-text route for unconverted developer observations. A
generic `game.message { text: formatted_english }` is still unconverted text,
even if it passes through a JSON catalog.

Risk: `_mpr` already invokes `c_message` Lua hooks, chooses message colour,
checks `force_more_message` and `flash_screen_message`, decides joining, and
can interrupt activity. Its `rng::UI` scope is an engine emission-side concern,
not permission for a Rust redraw to draw RNG. Japanese text must not be fed
into those original English pattern matches and thereby change pauses or
commands. Define and test a deliberate compatibility route for canonical
matching data/control decisions before removing the old prose construction.
Do not silently change existing arbitrary rc regex or Lua-hook behavior.

Exit evidence: original versus semantic events have equal ordering, channel,
joining, interruption, prompt-default, and one-time control effects. Repeated
Rust rendering changes no state or RNG stream. Empty/missing IDs fail release
checks; the remaining raw source sites are enumerated, never relabelled done.

### 2. Convert the engine's startup menus, not only the browser selectors

Files counted: `startup.cc`, `newgame.cc`, `ng-input.cc`, `ng-setup.cc`,
`outer-menu.cc`, `ng-restr.cc`. Anchor functions are `newgame.cc:570`
(`_choose_name`), `:811` (`_choose_seed`), `:1008` (`choose_game`), `:1094`
(`_construct_species_menu`), `_construct_backgrounds_menu`, `:1540`/`:1588`
(`job_group::attach`/`species_group::attach`), and `:1644` (`_prompt_choice`).
`ng-input.cc:17` (`opening_screen`) and `:71` (`validate_player_name`) supply
further first-screen text and validation.

Verified bounded step: `startup.weapon.prompt` is source-selected, formats
once through Rust and appears as eight Japanese characters over 16 CYAN native
cells. Character creation uses the selected session locale; resume formats it
zero times. This does not convert the complete startup/menu phase. Proposed
future 11-ID conversions remain source-only until separately built and tested.

First slice: reuse enum-based entity IDs for native species/background entries;
add IDs for welcome, category headings, difficulty groups, recommendations,
invalid combinations, name/seed validation, random/viable selections, back,
cancel, and weapon-choice prompts. Descriptions are separate phase-9 IDs.

Risks: display labels are not CLI names, enum values, menu letters, or
`ng-restr.cc` restriction predicates. Preserve those machine values and the
original random-choice timing. A user-entered or engine-generated player name
is external/generated name data; translating it through species terminology
would corrupt identity. Test Unicode/IME text entry independently of game keys.

Exit evidence: all 27 current species and 26 backgrounds can be selected with
the same legal/recommended relationships, shortcuts, cancellations, and seed
behavior in both languages. History and evolved forms remain correctly hidden
from starting choices; Japanese category/help text is not an English fallback.

### 3. Add real entity descriptors before converting messages that use names

Files counted: `item-name.cc`, `mon-info.cc`, `mon-util.cc`, `english.cc`,
`stringutil.cc`, `feature.cc`, `artefact.cc`. Exact anchors are
`item-name.cc:76` (`quant_name`), `:136` (`item_def::name`), `:1535`
(`item_def::name_aux`), `:2497` (`make_name`), and `:3738` (`get_corpse_name`);
`mon-info.cc:1010` (`_core_name`), `:1135` (`common_name`), `:1274`
(`full_name`), `:1397` (`pluralised_name`), and `:1421` (`to_string`);
`english.cc:30` (`pluralise`), `:196` (`apostrophise`), `:244`
(`conjugate_verb`), `:286` (`decline_pronoun`), and `:381` (`article_a`).

First slice: implement typed item and perceived-monster name descriptors, plus
explicit terrain IDs. Expand beyond the current species/job `name`/`abbrev`
forms. Engine identity, database lookup name, display noun, authored proper
name, generated name, and user text must be distinct values. Emit descriptors
before composing articles, quantity, enchantment, ego, inscription, and
equipment qualifiers.

Risks: unknown potions/wands/rings must carry visible appearance identity,
not their concealed type/effect. Use immutable knowledge snapshots; replaying
an old message must not reveal properties identified later. Perceived monster
identity must respect invisibility, hallucination, shapeshifting, attitudes,
proper-name flags, and `pronoun_plurality`, rather than exporting hidden
`monster` fields. Corpses, naturally plural armour, named artefacts, and
possessives do not fit `count == 1 ? name : name + "s"`.

Exit evidence: authoritative English output matches the original for known
and unknown appearances, counts 0/1/many, collective nouns, corpses,
artefacts, equipment states, and ownership. Japanese uses declared forms and
counters. External names/inscriptions preserve exact input. Name generation
keeps its original RNG selection; formatting never generates a new name.

### 4. Convert HUD/status schemas and notices as structured observations

Files counted: `output.cc`, `status.cc`, `duration-data.h`, `mutation-data.h`,
`player-notices.cc`. Start at `output.cc:879`/`:947`
(`_print_stats_mp`/`_print_stats_hp`), `:1315` (`_print_status_lights`), `:1413`
(`_redraw_title`), `:1515` (`print_stats`), and `:1628` (`print_stats_level`);
`status.cc:176` (`_fill_inf_from_ddef`), `:208` (`fill_status_info`), `:1198`
(`_describe_poison`), and `:1267` (`_describe_transform`).

First slice: expose an immutable HUD observation and duration/status ID,
severity, expiration state, and numeric values. Assign separate short HUD and
long help IDs to the duration and mutation definitions. Player-change notices
remain events, not inferred differences in a newly rendered HUD.

Risks: short English abbreviations are not safe Japanese labels; truncation,
colour, and expiry indicators carry meaning. Raw C++ fixed columns and byte
width cannot be reused for arbitrary Japanese prose. Displaying the same
snapshot again must not trigger notices, advance durations, or select a new
random presentation variant. A status description must not expose hidden
state absent from the original `status_info`.

Exit evidence: every reachable status has matching short/long bilingual IDs
and typed numeric schemas. HP/MP, attributes, defence, resistances, worship,
mutation, and level/branch panels wrap correctly at desktop/mobile widths;
colour and urgency remain available without relying only on colour.

### 5. Convert ordinary movement and dangerous-action confirmations

Files counted: `movement.cc`, `stairs.cc`, `travel.cc`, `nearby-danger.cc`,
`feature.cc`, `terrain.cc`. Anchors are `movement.cc:338`
(`open_door_action`), `:440` (`close_door_action`), `:945`
(`move_player_action`); `stairs.cc:115` (`check_next_floor_warning`), `:376`
(`_check_stairs`), `:1145` (`take_stairs`), `:1173` (`up_stairs`), `:1345`
(`down_stairs`); and `nearby-danger.cc:239` (`i_feel_safe`). Follow their
`travel.cc` interruption and destination call sites.

First slice: blocked movement, doors, stair requirements, terrain hazards,
travel completion/interruption, and unsafe-rest/autoexplore prompts. Emit
terrain/branch/location descriptors and explicit reasons such as
`movement.blocked`, `travel.interrupted`, and `prompt.confirm.terrain_hazard`.

Risks: known map cells differ from actual unseen terrain. Safety reasons can
contain sensed rather than identified threats. Default answers, prompt tokens,
and interruption reasons must remain engine decisions; translating a string
must not turn cancellation into a paid turn, move the player, or reset a delay.

Exit evidence: identical input traces yield identical positions, turns,
door/stair states, travel stops, and RNG states in both languages. Yes/no,
escape, more, repeated confirmations, and resumed delays work on keyboard,
mouse, and mobile controls with localized text.

### 6. Convert combat at attack phases and preserve information visibility

Files counted: `melee-attack.cc`, `ranged-attack.cc`, `attack.cc`, `beam.cc`,
`fight.cc`, `mon-death.cc`. First anchors are `melee-attack.cc:285`
(`handle_phase_blocked`), `:362` (`handle_phase_dodged`), `:815`
(`handle_phase_hit`), `:1081` (`handle_phase_damaged`), and `:1280`
(`handle_phase_killed`); `fight.cc:424` (`fight_melee`) and `:1389`/`:1453`
(`stop_attack_prompt`). Then follow the equivalent ranged/beam/death paths.

First slice: hit/miss/block, observed damage effects, kill notices, ranged
projectile actions, and friendly-target confirmations. Use attacker/defender
perception descriptors, attack-kind IDs, outcome/severity enums, and only
numbers exposed by the original message.

Risks: real damage/accuracy can exceed information available to the player.
Do not add precise hidden damage to a Japanese descriptor merely because the
engine has it. Actor pronouns, auxiliary attacks, player versus monster
perspective, spectral weapons, reflected beams, and invisible sources cannot
be reconstructed by splitting an English sentence. One action may emit
several ordered messages or no observable message.

Exit evidence: melee/ranged/spell/auxiliary attack traces preserve message
ordering, visible information, attack outcomes, channels, confirmations, and
all RNG draws. Death of a monster is distinct from the player-death lifecycle
in phase 10. An unconverted flavour sentence keeps this phase incomplete.

### 7. Convert inventory and item operations with explicit selection contracts

Files counted: `invent.cc`, `item-use.cc`, `items.cc`, `shopping.cc`,
`quiver.cc`, `player-equip.cc`, `potion.cc`, `evoke.cc`. Exact entry points
include `invent.cc:563` (`no_selectables_message`), `:634`
(`InvMenu::load_inv_items`), `:1219` (`select_items`), `:1502`
(`prompt_drop_items`); `item-use.cc:332` (`UseItemMenu::reset`), `:1835`
(`prompt_inscribe_item`), `:1909` (`drink`), `:2844` (`read`); and
`shopping.cc:1236` (`ShopMenu::purchase_selected`), `:1531` (`shop`).

First slice: inventory titles/actions, selection quantities, pickup/drop,
wield/wear/remove outcomes, consumable targeting and cancellation, and shop
price/affordability/buy confirmations. Apply phase-3 item descriptors throughout
menus and messages, not just in the visible inventory list.

Risks: inventory letters, slot identities, selected quantity, and operation
codes must not be translated. Unknown shop stock and unknown consumable effects
use different knowledge projections. User inscriptions are external text.
Identification may occur before or after a message; capture the correct
knowledge snapshot at each original emission. Price and gold are numeric data,
not English amount fragments.

Exit evidence: paired traces cover stack splitting, selection counts,
equipment restrictions, inscriptions, unknown/identified use, consumable
cancellation, quiver changes, insufficient gold, purchases, and shopping lists.
The same items, prices, turns, knowledge, and engine state result in both locales.

### 8. Convert spell/ability/religion labels, prompts, costs, and outcomes

Files counted: `spl-cast.cc`, `spl-book.cc`, `ability.cc`, `religion.cc`,
`god-abil.cc`, `describe-god.cc`, `spl-data.h`. Anchors are `spl-cast.cc:267`
(`list_spells`), `:867` (`cast_a_spell`), `:2129` (`your_spells`), `:3010`
(`spell_failure_rate_string`); `ability.cc:1329` (`ability_name`), `:1639`
(`activate_ability`), `:4151` (`choose_ability_menu`); and
`religion.cc:2589`/`:2711`/`:2872`/`:3939`
(`gain_piety`/`lose_piety`/`excommunication`/`god_pitch`).

First slice: spell/ability/god enum-based labels, displayed costs and failure
bands, memorization/casting/menu errors, worship selection, and the first
success/failure/confirmation pathways. Then expand to every spell effect and
god-specific branch, including the other `spl-*.cc` and `god-*.cc` files.

Risks: spell lookup/database keys, divine identities, displayed names, hotkeys,
and gameplay eligibility are distinct. Costs can be variable or hidden;
piety/failure displays can intentionally be coarse. Target descriptions reuse
phase-3 perception and phase-5/6 prompt contracts. Japanese descriptions must
not alter spell selection, targeting, miscast rolls, conduct, gifts, or wrath.

Exit evidence: registered enum-backed labels and all reached prompts/outcomes
have bilingual schemas; raw effect messages are accounted for separately.
Tests cover cancel, invalid target, insufficient resources, success/failure,
memorization, worship changes, and representative god-specific behavior.
The inventory's 512 spell/229 ability/31 god tokens include historical or
sentinel values and are not active gameplay counts.

### 9. Convert resource lookup, rich descriptions, hints, and scripted speech

Files counted: `describe.cc`, `lookup-help.cc`, `hints.cc`, `database.cc`,
`mon-speak.cc`, `clua.cc`, `dlua.cc`. Anchors are `describe.cc:2673`
(`get_item_description`), `:4166` (`describe_item`), `:4749`
(`describe_spell`), `:6977` (`describe_monster`);
`lookup-help.cc:1544`/`:1561` (`find_description_of_type`/
`LookupType::find_description`); `database.cc:789`/`:844`/`:933`
(`getLongDescription`/`getSpeakString`/`getHintString`);
`hints.cc:480`/`:503`/`:2847` (`_get_hint`/`print_hint`/`tutorial_msg`);
and `mon-speak.cc:826` (`mons_speaks_msg`).

First slice: species/background descriptions, command help, first tutorial
hints, and common item/monster/spell description pages. Build a reviewed
resource-to-semantic-ID registry; preserve machine lookup keys separately from
translated text. Use structured rich-text spans and command/entity references.
Then convert speech variant dispatch and Lua-authored user-visible text.

Exact resource evidence from `database-blocks.jsonl.gz`:

| Original resource | Blocks |
|---|---:|
| `dat/descript/species.txt` / `backgrounds.txt` | 27 / 26 |
| `dat/descript/monsters.txt` / `spells.txt` | 724 / 402 |
| `dat/descript/items.txt` / `features.txt` | 307 / 290 |
| `dat/descript/status.txt` / `mutations.txt` / `ability.txt` | 237 / 252 / 154 |
| `dat/database/monspeak.txt` / `monspell.txt` / `godspeak.txt` | 731 / 260 / 193 |
| `dat/database/help.txt` / `FAQ.txt` | 13 / 38 |

These block counts are planning evidence, not automatically active or unique
semantic messages. Script discovery additionally records 217 literal
candidates in `dat/dlua/lm_trove.lua`, 225 in `dat/dlua/dungeon.lua`, and 129
in `dat/clua/stash.lua`; review their actual call paths before classification.

Risks: `getSpeakString` chooses randomized strings and executes embedded Lua.
`mons_speaks_msg` performs monster substitution and parses channel prefixes;
speech can deliberately mimic warnings. Preserve weights, chosen variants,
embedded control behavior, visibility/silence checks, and draw counts before
locale formatting. `_get_hint` currently replaces `$1`/`$2`; convert those
arguments at each originating hint call to named typed references, not a new
global replacement pass. Colour tags, command key tags, paragraphs, and
quotation attribution need reviewed structured handling. Never translate
vault maps, Lua identifiers, database keys, executable directives, or HTML.

Exit evidence: resource identities retain source receipts, bilingual keys and
parameter types match, descriptions respect knowledge, tutorial/help keys
resolve, and speech follows identical selection/control traces. Authored
quotations and source availability retain their attribution/licensing evidence.

### 10. Convert lifecycle summaries and failures without changing native formats

Files counted: `ouch.cc`, `end.cc`, `hiscores.cc`, `chardump.cc`, `notes.cc`,
`files.cc`, `initfile.cc`, `game-options.cc`. Anchors are `ouch.cc:1268`
(`_print_endgame_messages`), `:1303` (`ouch`); `end.cc:98`
(`fatal_error_notification`), `:275` (`end_game`);
`hiscores.cc:2173` (`scorefile_entry::death_description`);
`files.cc:2628` (`save_game`), `:3347` (`restore_game`), `:3652`
(`_tagged_chunk_version_compatible`); and `initfile.cc:3835`/`:4666`
(`read_option_line`/`report_error`).

First slice: player death/victory, cause/source attribution, scores and character
summary, save/restore incompatibility or corruption, and invalid-setting errors.
Use typed kill-method, perceived killer, branch/location, score, version, and
error-reason fields. Extend the same contract to notes and character dumps.

Risks: native package/tag formats, score/ghost identities, paths, timestamps,
rc option names, and option values are machine or external data. Do not
translate or rewrite native saves. Original `message.cc` `save_messages`/
`load_messages` persist message history; an additional semantic history needs
its own versioned immutable descriptor schema and coordinated save checkpoint,
without replaying event-side control effects during load. Error reasons must
be semantic enums/IDs; passing a raw English exception as `reason:text` does
not complete Japanese errors. External player/ghost names remain untouched.

Exit evidence: complete death and victory UI, cause/score/dump rendering,
localized failures, native save compatibility, checkpoint restore, message
history replay, and corrupted/mismatched envelope behavior are tested. English
and Japanese resume at the same engine state and next-command/RNG outcome.

## Required typed contracts and shared risks

The current catalog schema accepts scalar text/numeric/boolean/quantity
parameters. It does not yet support nested entity or command descriptors.
Adding those is a versioned boundary change; flattening an entity to an English
`text` parameter would preserve the present localization gap.

| Contract | Required fields and invariant |
|---|---|
| `SemanticEvent` | Stable meaning ID; exact typed parameter schema; source receipt; sequence/turn/channel; one-time control decisions separate from replayable display |
| `ItemLabel` | Public appearance/type identity, quantity, known enchantment/properties, known ego/artefact identity, equipment qualifiers, external inscription; no concealed metadata |
| `ActorLabel` | Player/monster role, perceived identity, authored/generated/external name origin, plurality/pronoun role and visibility; snapshot at emission |
| `Quantity` | Bounded nonnegative integer, noun/counter identity, explicit zero/one/other grammar policy; no inferred `s` or Japanese counter |
| `CommandRef` / `Prompt` | Command enum and input route; active binding rendered from input configuration; stable prompt token, accepted outcomes, default and cancellation semantics |
| `RichText` | Explicit safe span/style/paragraph/link tokens; external text remains text; no untrusted engine/user HTML |
| `ErrorReason` | Domain/host error enum or semantic ID with typed details; paths/user values preserved as data; developer diagnostics quarantined from player prose |

All event parameters must be validated for missing/extra fields, type, bounded
length, numeric range, and supported descriptor forms. Save/event versions pin
upstream and ABI/descriptor schema. Re-rendering, switching locale, resizing,
replaying history, or opening a description must not create simulation events,
generate names, consume gameplay RNG, or introduce knowledge. JavaScript must
not round the engine's 64-bit seed/RNG identities; existing decimal-string
snapshot conventions remain applicable.

## Completion gates and evidence to collect

1. **Reviewed denominator:** assign each candidate and every generated/call-site
   family to player prose, entity/form, external input, machine identifier,
   developer/test-only, inactive compatibility, or a documented exclusion.
   Store a source receipt and owner for every classification. Audit macro
   expansion, generated headers, runtime paths, Lua and resource assembly;
   lexical counts alone cannot close this gate.
2. **Origin conversion:** every reachable gameplay text site emits a durable
   semantic ID with a typed descriptor before English composition. A release
   counter of unconverted player-visible routes is zero. Generic raw-text IDs
   and post-render replacement do not count as conversions.
3. **Catalog closure:** engine-emittable IDs, entity/forms, resources, and both
   locale catalogs have exact coverage/schema parity, with no English fallback
   or empty Japanese entries. Exercise every parameter/form, proper name,
   plural/counter, command binding, hint/help, setting/error, and lifecycle page.
4. **Control and information parity:** original versus migrated event traces
   preserve visibility, unknown appearances, prompts/defaults, rc/Lua hooks,
   message order/joining/interruption, turns, and one-time speech choices.
   Compare canonical engine state and all RNG state/sequence values; diagnostic
   draw counters are useful within a session but are not native-save fields.
5. **Rendering and persistence:** redraw/language/mobile resize/history tests
   preserve state and RNG; native plus semantic checkpoint restore reproduces
   the next command. CJK width/wrapping, rich spans, IME, mouse/touch targeting,
   cancellation, save/resume, death, and a complete seeded victory are verified
   in actual browsers. Catalog tests do not substitute for these flows.
6. **Local WEB delivery evidence:** preserve the full official engine and data,
   matching corresponding source/build tools and all notices, verified artifact
   hashes, full required Japanese semantic coverage and actual desktop/mobile
   browser parity. The user defines WEB delivery as local HTML served by Node,
   with reproducible run/test commands and the loopback URL. External Sites
   creation or deployment is out of scope. The installed default JSPI route
   has its own 18-check actual-browser evidence for the current artifact;
   full Japanese coverage and the broader lifecycle/system gates remain open.
   A raw English development console, protocol mocks or a tested migration
   panel cannot close the unresolved whole-game Japanese delivery gate.

The ten phases prioritize broad player-visible boundaries; they are not an
exclusion list. Remaining `spl-*.cc`, `god-*.cc`, monster AI/abilities, mutations,
forms, traps/clouds, special branches, vault markers, procedural names, arena,
Sprint/tutorial/wizard modes, Lua/user macros, and other files still require
the same reviewed reachability and semantic coverage audit. Keep each open
source cluster and remaining raw-event count visible until those gates pass.
