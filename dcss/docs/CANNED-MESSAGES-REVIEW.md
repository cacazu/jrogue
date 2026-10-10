# Canned-message semantic catalog review

This bounded catalog covers every identity in the original DCSS 0.34.1
canned_message_type enum and every text-producing branch of canned_msg.
It adds 45 complete English/Japanese render IDs for 37 enum identities and
40 original emitter call sites. It does not establish complete gameplay
localization or runtime/browser integration.

Pristine source provenance: commit 1eebc1a2892e1c89776a0d7a10691f8dac8d9796. No Git command was
run for this task. The checker verifies exact original byte hashes for
message.cc, canned-message-type.h and mpr.h; those receipts identify the
pinned source, while commit/release metadata retains the established upstream
provenance. The original source and English console are unchanged.

## Coverage and event contract

| Source identity group | Enum identities | Fully expanded render IDs |
| --- | ---: | ---: |
| MSG_SOMETHING_APPEARS | 1 | 2 |
| MSG_EMPTY_HANDED_ALREADY and MSG_EMPTY_HANDED_NOW | 2 | 8 |
| MSG_MAGIC_DRAIN | 1 | 2 |
| All other singleton identities | 33 | 33 |
| Total | 37 | 45 |

IDs have namespace game.canned.* and derive from enum identity plus a stable
context branch. Canonical full events use source="canned-v1", a registry ID
and params={}. Each Catalog entry uses {"text":"...","params":{}}. No entry
accepts substitutions, counts, English fragments or external usernames.
The C++ emitter must select its ID at the original branch using the original
predicate values; it must not infer an ID from a formatted English sentence.
Rendering uses plain text and Japanese as the presentation default.

Appearance uses player_has_feet(), not a species-name approximation. Empty
weapon state preserves the original branch priority: MUT_NO_GRASPING mouth;
otherwise usable claws; otherwise usable tentacles; otherwise hands. Each
body branch remains distinct for already and now. Magic drain preserves
MUT_HP_CASTING and its different wording/channel. There is no halo branch in
this pinned canned_msg switch.

| Original channel | Verified numeric enum value | Render IDs |
| --- | ---: | ---: |
| MSGCH_PLAIN | 0 | 42 |
| MSGCH_PROMPT | 2 | 1 (MSG_OK) |
| MSGCH_WARN | 6 | 1 (non-HP-casting MSG_MAGIC_DRAIN) |
| MSGCH_EXAMINE_FILTER | 24 | 1 (MSG_HUH) |

Only MSG_YOU_DIE requests nojoin=true. All other caller nojoin flags are false;
actual later joining can still change due to original force-more logic. Every
original canned emitter uses channel parameter 0 and capitalization true.
The registry nojoin flag describes the original caller request, not a promise
about buffer.join or locale layout.

## Japanese wording and independent review

All 45 Japanese variants were manually authored and independently reviewed
by the source localization audit agent against the original branches. The
audit found no blocking meaning, branch or schema issue. Its two terminology
suggestions were adopted: empty-body variants explicitly say 武器 to describe
no wielded weapon rather than empty inventory or an absent shield; the god
refusal identifies 信仰する神, preserving "your god". These are project
translations, not claimed official Japanese wording.

| Meaning | Reviewed Japanese treatment | Source/context receipt |
| --- | --- | --- |
| Nothing appears to happen | 何も起きていないようだ preserves uncertainty. | message.cc:1960 |
| Berserk vs confused blockers | 狂戦士化 and 混乱 remain separate states. | message.cc:1973,1977 |
| Empty weapon state | Mouth/claws/tentacles/hands and すでに/今は remain distinct; 武器 clarifies equipment scope. | message.cc:2014–2027; item-use.cc:1681–1702 |
| Blink | 短距離転移 means nearby magical relocation, never eye blinking. | message.cc:2030; teleport.cc:27–45 |
| Stasis | 停滞感 describes a sensed obstruction and does not assert paralysis. | message.cc:2033 |
| Maximum magic capacity | 容量 changes remain distinct from replenishment. | message.cc:2039,2042 |
| Restored magic | 魔力が戻ってくる describes recovery. | message.cc:2069 |
| HP-casting drain | 一瞬、消耗したように感じる omits magical energy. | message.cc:2073–2074 |
| Other magic drain | Loss of 魔力 retains sudden warning and exclamation. | message.cc:2076 |
| Ghostly outline | おぼろげな輪郭 leaves the occupying creature unidentified. | message.cc:2057; spl-summoning.cc:2198–2222 |
| Not yet / god not now | まだ and 今 retain temporary qualifiers. | message.cc:1988,2086 |

The checker establishes source completeness and schema/placeholder parity.
It cannot prove Japanese meaning through a CJK-character test; the manual
context review above provides the semantic review for this bounded scope.

## Original-control preservation

Keep the canonical original English/control tuple on the original _mpr path.
Only a separate semantic presentation observation may use these catalog IDs.
Nine cases still call crawl_state.cancel_cmd_repeat: TOO_BERSERK, PRESENT_FORM,
NOTHING_CARRIED, CANNOT_DO_YET, OK, UNTHINKING_ACT, NOTHING_THERE,
NOTHING_CLOSE_ENOUGH and HUH. YOU_RESIST still calls
learned_something_new(HINT_YOU_RESIST). Locale selection must not change these
effects or predicate evaluation count/order.

Common source gates also remain authoritative: _mpr at message.cc:1510–1603
uses rng::UI, dump state, channel preparation, Lua c_message at 1566–1567,
original-English force_more/flash filters at 1570–1571, joining, capitalization
and language filters, and buffer/history updates. prepare_message at
message.cc:1771–1804 handles note regexes, interrupt_activity, history-channel
exclusions and related bookkeeping. Original channel values, colour, more,
flash and actual join state must survive the presentation adapter unchanged.
Changing canonical message text can change behavior even when mechanics
appear unchanged in an isolated example.

## Complete source and translation ledger

Every row below has prefix game.canned. Source line triples are
canned-message-type.h declaration / message.cc case / message.cc emitter.
The source map contains exact conditional block text receipts for every row,
including both labels of the shared empty-body block.

| Semantic ID suffix | Enum identity | Declaration / case / emission line | Original channel/flags | C++ predicate values | Exact expanded English | Japanese |
| --- | --- | --- | --- | --- | --- | --- |
| something_appears.at_feet | MSG_SOMETHING_APPEARS | 5 / 1955 / 1956 | MSGCH_PLAIN=0 | player_has_feet()=true | Something appears at your feet! | 足元に何かが現れた！ |
| something_appears.before_you | MSG_SOMETHING_APPEARS | 5 / 1955 / 1956 | MSGCH_PLAIN=0 | player_has_feet()=false | Something appears before you! | 目の前に何かが現れた！ |
| nothing_happens | MSG_NOTHING_HAPPENS | 6 / 1959 / 1960 | MSGCH_PLAIN=0 | unconditional | Nothing appears to happen. | 何も起きていないようだ。 |
| you_unaffected | MSG_YOU_UNAFFECTED | 7 / 1962 / 1963 | MSGCH_PLAIN=0 | unconditional | You are unaffected. | 影響を受けなかった。 |
| you_resist | MSG_YOU_RESIST | 8 / 1965 / 1966 | MSGCH_PLAIN=0 | unconditional | You resist. | 抵抗した。 |
| you_partially_resist | MSG_YOU_PARTIALLY_RESIST | 9 / 1969 / 1970 | MSGCH_PLAIN=0 | unconditional | You partially resist. | 部分的に抵抗した。 |
| too_berserk | MSG_TOO_BERSERK | 10 / 1972 / 1973 | MSGCH_PLAIN=0 | unconditional | You are too berserk! | 狂戦士化しているため、それはできない！ |
| too_confused | MSG_TOO_CONFUSED | 11 / 1976 / 1977 | MSGCH_PLAIN=0 | unconditional | You are too confused! | 混乱がひどすぎる！ |
| present_form | MSG_PRESENT_FORM | 12 / 1979 / 1980 | MSGCH_PLAIN=0 | unconditional | You can't do that in your present form. | 今の姿ではそれはできない。 |
| nothing_carried | MSG_NOTHING_CARRIED | 13 / 1983 / 1984 | MSGCH_PLAIN=0 | unconditional | You aren't carrying anything. | 何も所持していない。 |
| cannot_do_yet | MSG_CANNOT_DO_YET | 14 / 1987 / 1988 | MSGCH_PLAIN=0 | unconditional | You can't do that yet. | まだそれはできない。 |
| ok | MSG_OK | 15 / 1991 / 1992 | MSGCH_PROMPT=2 | unconditional | Okay, then. | では、それで。 |
| unthinking_act | MSG_UNTHINKING_ACT | 16 / 1995 / 1996 | MSGCH_PLAIN=0 | unconditional | Why would you want to do that? | なぜそんなことをしたいのだろう？ |
| nothing_there | MSG_NOTHING_THERE | 17 / 1999 / 2000 | MSGCH_PLAIN=0 | unconditional | There's nothing there! | そこには何もない！ |
| nothing_close_enough | MSG_NOTHING_CLOSE_ENOUGH | 18 / 2003 / 2004 | MSGCH_PLAIN=0 | unconditional | There's nothing close enough! | 届くほど近くには何もない！ |
| spell_fizzles | MSG_SPELL_FIZZLES | 19 / 2007 / 2008 | MSGCH_PLAIN=0 | unconditional | The spell fizzles. | 呪文は不発に終わった。 |
| huh | MSG_HUH | 20 / 2010 / 2011 | MSGCH_EXAMINE_FILTER=24 | unconditional | Huh? | えっ？ |
| empty_handed_already.mouth | MSG_EMPTY_HANDED_ALREADY | 21 / 2014 / 2020 | MSGCH_PLAIN=0 | which_message == MSG_EMPTY_HANDED_ALREADY=true; you.has_mutation(MUT_NO_GRASPING)=true | Your mouth is already empty. | すでに口には武器をくわえていない。 |
| empty_handed_already.claws | MSG_EMPTY_HANDED_ALREADY | 21 / 2014 / 2022 | MSGCH_PLAIN=0 | which_message == MSG_EMPTY_HANDED_ALREADY=true; you.has_mutation(MUT_NO_GRASPING)=false; you.has_usable_claws(true)=true | You are already empty-clawed. | すでに爪で武器を握っていない。 |
| empty_handed_already.tentacles | MSG_EMPTY_HANDED_ALREADY | 21 / 2014 / 2024 | MSGCH_PLAIN=0 | which_message == MSG_EMPTY_HANDED_ALREADY=true; you.has_mutation(MUT_NO_GRASPING)=false; you.has_usable_claws(true)=false; you.has_usable_tentacles(true)=true | You are already empty-tentacled. | すでに触手で武器を持っていない。 |
| empty_handed_already.hands | MSG_EMPTY_HANDED_ALREADY | 21 / 2014 / 2026 | MSGCH_PLAIN=0 | which_message == MSG_EMPTY_HANDED_ALREADY=true; you.has_mutation(MUT_NO_GRASPING)=false; you.has_usable_claws(true)=false; you.has_usable_tentacles(true)=false | You are already empty-handed. | すでに手に武器を持っていない。 |
| empty_handed_now.mouth | MSG_EMPTY_HANDED_NOW | 22 / 2015 / 2020 | MSGCH_PLAIN=0 | which_message == MSG_EMPTY_HANDED_ALREADY=false; you.has_mutation(MUT_NO_GRASPING)=true | Your mouth is now empty. | 今は口に武器をくわえていない。 |
| empty_handed_now.claws | MSG_EMPTY_HANDED_NOW | 22 / 2015 / 2022 | MSGCH_PLAIN=0 | which_message == MSG_EMPTY_HANDED_ALREADY=false; you.has_mutation(MUT_NO_GRASPING)=false; you.has_usable_claws(true)=true | You are now empty-clawed. | 今は爪で武器を握っていない。 |
| empty_handed_now.tentacles | MSG_EMPTY_HANDED_NOW | 22 / 2015 / 2024 | MSGCH_PLAIN=0 | which_message == MSG_EMPTY_HANDED_ALREADY=false; you.has_mutation(MUT_NO_GRASPING)=false; you.has_usable_claws(true)=false; you.has_usable_tentacles(true)=true | You are now empty-tentacled. | 今は触手で武器を持っていない。 |
| empty_handed_now.hands | MSG_EMPTY_HANDED_NOW | 22 / 2015 / 2026 | MSGCH_PLAIN=0 | which_message == MSG_EMPTY_HANDED_ALREADY=false; you.has_mutation(MUT_NO_GRASPING)=false; you.has_usable_claws(true)=false; you.has_usable_tentacles(true)=false | You are now empty-handed. | 今は手に武器を持っていない。 |
| you_blink | MSG_YOU_BLINK | 23 / 2029 / 2030 | MSGCH_PLAIN=0 | unconditional | You blink. | あなたは短距離転移した。 |
| strange_stasis | MSG_STRANGE_STASIS | 24 / 2032 / 2033 | MSGCH_PLAIN=0 | unconditional | You feel a strange sense of stasis. | 不思議な停滞感を覚えた。 |
| no_spells | MSG_NO_SPELLS | 25 / 2035 / 2036 | MSGCH_PLAIN=0 | unconditional | You don't know any spells. | 呪文を一つも習得していない。 |
| mana_increase | MSG_MANA_INCREASE | 26 / 2038 / 2039 | MSGCH_PLAIN=0 | unconditional | You feel your magic capacity increase. | 魔力の容量が増したのを感じる。 |
| mana_decrease | MSG_MANA_DECREASE | 27 / 2041 / 2042 | MSGCH_PLAIN=0 | unconditional | You feel your magic capacity decrease. | 魔力の容量が減ったのを感じる。 |
| disoriented | MSG_DISORIENTED | 28 / 2044 / 2045 | MSGCH_PLAIN=0 | unconditional | You feel momentarily disoriented. | 一瞬、方向感覚を失った。 |
| detect_nothing | MSG_DETECT_NOTHING | 29 / 2047 / 2048 | MSGCH_PLAIN=0 | unconditional | You detect nothing. | 何も感知しない。 |
| cannot_move | MSG_CANNOT_MOVE | 30 / 2050 / 2051 | MSGCH_PLAIN=0 | unconditional | You cannot move. | 動けない。 |
| you_die | MSG_YOU_DIE | 31 / 2053 / 2054 | MSGCH_PLAIN=0; nojoin | unconditional | You die... | あなたは死んだ…… |
| ghostly_outline | MSG_GHOSTLY_OUTLINE | 32 / 2056 / 2057 | MSGCH_PLAIN=0 | unconditional | You see a ghostly outline there, and the spell fizzles. | そこにおぼろげな輪郭が見え、呪文は不発に終わった。 |
| full_health | MSG_FULL_HEALTH | 33 / 2059 / 2060 | MSGCH_PLAIN=0 | unconditional | Your health is already full. | 体力はすでに最大だ。 |
| full_magic | MSG_FULL_MAGIC | 34 / 2062 / 2063 | MSGCH_PLAIN=0 | unconditional | Your reserves of magic are already full. | 魔力はすでに満ちている。 |
| gain_health | MSG_GAIN_HEALTH | 35 / 2065 / 2066 | MSGCH_PLAIN=0 | unconditional | You feel better. | 体調がよくなった。 |
| gain_magic | MSG_GAIN_MAGIC | 36 / 2068 / 2069 | MSGCH_PLAIN=0 | unconditional | You feel your power returning. | 魔力が戻ってくるのを感じる。 |
| magic_drain.hp_casting | MSG_MAGIC_DRAIN | 37 / 2071 / 2074 | MSGCH_PLAIN=0 | you.has_mutation(MUT_HP_CASTING)=true | You feel momentarily drained. | 一瞬、消耗したように感じる。 |
| magic_drain.magic_energy | MSG_MAGIC_DRAIN | 37 / 2071 / 2076 | MSGCH_WARN=6 | you.has_mutation(MUT_HP_CASTING)=false | You suddenly feel drained of magical energy! | 突然、魔力が失われたのを感じる！ |
| something_in_way | MSG_SOMETHING_IN_WAY | 38 / 2079 / 2080 | MSGCH_PLAIN=0 | unconditional | There's something in the way. | 何かが邪魔をしている。 |
| cannot_see | MSG_CANNOT_SEE | 39 / 2082 / 2083 | MSGCH_PLAIN=0 | unconditional | You can't see that place. | その場所は見えない。 |
| god_declines | MSG_GOD_DECLINES | 40 / 2085 / 2086 | MSGCH_PLAIN=0 | unconditional | Your god isn't willing to do this for you now. | 信仰する神は今、あなたのためにそれを行うつもりはない。 |
| no_available_space | MSG_NO_AVAILABLE_SPACE | 41 / 2088 / 2089 | MSGCH_PLAIN=0 | unconditional | There is no available space! | 空いている場所がない！ |

## Lightweight verification and remaining gates

Run from the installed dcss folder after checking memory:

~~~powershell
& 'C:\Program Files\nodejs\node.exe' --max-old-space-size=64 'tools/check-canned-catalogs.mjs' --self-test
~~~

The standalone Node checker uses no dependencies and executes no game code.
It extracts the actual enum/case order and emitter calls, verifies all three
pinned source hashes, all 45 receipts/control tuples/branch predicates, exact
original English expansions, duplicate JSON keys, bilingual ID parity, empty
parameter schemas and placeholder absence. Thirty self-test probes reject
missing/extra IDs, English fallback, forged English/channel/nojoin/commit/
conditional receipts, bad schemas and unknown interpolation parameters.
No Git, Cargo, engine compilation/link, packaging or browser was executed.

Runtime gates remain with the parent: Rust Catalog loading and duplicate-ID
checks, source="canned-v1" registry validation, emitted ID/channel/nojoin parity
for all four contextual identities and every singleton, no missing/double
event across crash/mute/early-return gates, and equal canonical control and
all PCG streams with observation enabled/disabled and across en/ja/repaint.
Browser CJK layout/input/history and native save/resume remain separate gates
when the memory restriction is lifted. This catalog has no dynamic names;
external usernames remain untouched by the canonical engine name path.
Unmigrated messages, names, item/monster descriptions, help, errors, settings
and dynamic grammar remain outside this canned-message coverage.
