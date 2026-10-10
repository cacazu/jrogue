# DCSS runtime semantic parity plan

Prepared 2026-10-02 from official DCSS 0.34.1, upstream commit
`1eebc1a2892e1c89776a0d7a10691f8dac8d9796`, and the installed DCSS boundary
source. This document records proposed execution and source-grounded test
constraints. The reviewer has not built or run an engine, Rust, Cargo, or a
browser during this pass. The coordinator released the heavy-work hold for
one C++ compilation job; C++ headers, sources, library JS and link inputs were
left untouched by this reviewer.

## Essential next tests

Run one engine/browser at a time after the coordinator confirms the rebuilt
artifacts. Record exact artifact hashes, upstream/source patch hashes, seed,
startup arguments, fixture input, and whether the observer is absent, captures
events, or deliberately throws. An old artifact passing does not validate the
new source adapter.

| Priority | Concrete test | Required evidence |
|---|---|---|
| 1 | Start a normal seeded Human Fighter; cancel a real wield prompt and attempt to unwield again after becoming unarmed. | Actual source-origin callback reaches the Worker, Rust validation and Japanese panel; original canonical English still reaches the native console. Record the original prompt and selected command, not just a mock event. |
| 2 | Repeat the identical initialized checkpoint and command trace with observer absent, capturing, and throwing. | Canonical messages/hooks/turn/position/HP and all 45 persistent PCG states agree; observer failures produce diagnostics without engine termination or command reentry. |
| 3 | Add a client-Lua `c_message` hook that records its arguments and emits one unique raw nested message for a known canned source message. | Hook receives canonical colour-prefixed English and channel; raw nested output never inherits the canned ID; outer accepted event follows the nested native buffer emission. |
| 4 | Apply one exact-English mute rule, then force-more/flash rules to that canned source path. | Initialized muted output has no semantic event. Original notes/interruption stages, pause counts and native rendering remain unchanged; accepted `more`, `flash` and effective `join` match actual original decisions. |
| 5 | Retain a real accepted event, change locale repeatedly and redraw/resize the page. | State and all 45 PCG words/counters remain byte-for-byte equal; event copies, emphasis and sequence remain immutable; locale redraws do not reannounce the entire log. |
| 6 | Save a live seeded game, reload it, then repeat the next actual command. | Native restored state/PCG words and next-command result match. Semantic session history is explicitly not persisted. |
| 7 | Complete controlled official-engine combat, branch transition, death and victory fixtures in separate disposable games. | Actual prompts, native frames/files and terminal-session protocol; no status-0 false fatal. Mark these as controlled fixtures, not a manually played full game. |

The first normal source triggers are supported by `cmd-keys.h:56` (`w`),
`main.cc:2259` (`use_an_item(OPER_WIELD)`), and
`item-use.cc:1684–1702`: trying to unwield with no weapon calls
`canned_msg(MSG_EMPTY_HANDED_ALREADY)`. The original item-use prompt offers
`-` for none (`item-use.cc:155–157`). Drive the actual prompt rather than
blindly sending a whole string; menus can differ by inventory and equipment.
Cancelling an actual item prompt selects an original `MSG_OK` source site.
`MSG_OK` is PROMPT and cancels command repetition (`message.cc:1991–1994`);
it is not an ordinary history line.

The existing `tests/core-browser.mjs` already starts a real engine, checks
45 streams, redraw purity, native save/resume, keyboard wait and mobile input.
Extend its actual-engine evidence rather than treating the Node protocol
stubs as engine evidence. Its older English-development-build scope and
artifact receipt must be updated when testing rebuilt artifacts.

## What the existing interfaces can actually prove

`engine/platform_console.cc::dcss_snapshot_json` exports position, HP/max HP,
turn, XL, branch, depth, seed and all 45 persistent RNG entries. Each entry
contains decimal-string `state`, `sequence` and `draws`. Compare by generator
index and exact strings. Do not round through JavaScript `Number`, sort the
streams by current values, or replace equality with uniqueness checks.

`rng::generators_to_vector()` stores every persistent PCG state
(`random.cc:29–35`). `rng::get_states()` returns the corresponding draw counts
(`37–46`), which are debug counters and are not saved. Consequently:

- Within one live session, compare all words and counters before/after
  presentation actions and between identically initialized traces.
- Across native reload, compare all state/sequence words and the deterministic
  next-command result; record counter resets instead of claiming saved counts.
- The current snapshot does not expose a temporary subgenerator or the
  currently selected generator. All 45 persistent entries passing does not
  alone prove temporary-generator restoration. A bounded native fixture can
  check the next draw from a seeded `rng::subgenerator` and the enclosing
  generator before/after a canned call (`random.cc:62–103`).

Only call the current exported state/save/repaint methods while Asyncify is
safely suspended for input, through the Worker request protocol. Do not call
back into the engine from `dcssSemantic`, an error reporter, a rendering
callback or a Lua-message observer on the main thread.

The canned observer in `engine/semantic-canned.inc` is enabled only under
`__EMSCRIPTEN__`. A native console run can establish canonical mechanics and
message parity, but does not execute `dcss_semantic_canned`. The present WASM
exports listed in `tools/engine-build.py` do not include a direct canned-message
test entry. `l-crawl.cc` and `l-you.cc` do not register a `canned_msg` Lua API.
Printing matching English with `crawl.mpr` is a raw-message test, not a test
of source-origin semantic identity.

## Exhaustive source-emitter coverage after the current build

The exact bounded target is the installed source map's **37 enums, 40 original
print sites, 45 whole-message variants**. A real C++/WASM emitter fixture is
needed to call `canned_msg` itself for every enum and establish the following
predicate partitions. Any test-only entry/binding must be added to a separate
recognized test worktree or artifact after the active build; it is not a
present production export and must not be advertised as one.

| Partition | Original predicate or call | Fixture requirement |
|---|---|---|
| Something appears, two variants | `player_has_feet()` (`message.cc:1955–1957`). It includes fishtail, mutation and current-form state (`player.cc:1066–1081`). | Set a valid state for each actual predicate outcome; assert that outcome before calling the enum. Do not substitute an assumed species-only flag. |
| Empty weapon, eight variants | Already/now, then `MUT_NO_GRASPING`, usable claws, usable tentacles, otherwise hands (`2014–2027`). | Both enum values in each branch with the original precedence. `has_usable_claws(true)` and `has_usable_tentacles(true)` are state predicates, not entity-label membership. |
| Magic drain, two variants | `MUT_HP_CASTING` (`2071–2077`). | HP-casting gives PLAIN; ordinary drain gives WARN. Preserve the two complete English/Japanese meanings. |
| Remaining 33 single variants | Original unmodified `canned_msg` cases. | Exact source-map ID/call/channel/nojoin and one callback for each accepted emission. |

For each of the 45 variants, record the canonical trace, callback descriptor,
original player/control state, all persistent RNG words/counters and the next
real command result. Compare a baseline recognized unpatched engine with a
recognized patched engine built using the same compiler, flags and data. An
observer-disabled patched run separately checks observer noninterference; it
does not substitute for baseline source parity.

Important side effects must remain once: nine original cases cancel command
repetition; only `MSG_YOU_RESIST` learns `HINT_YOU_RESIST`; only
`MSG_YOU_DIE` calls `mpr_nojoin`. Channels are PLAIN except OK/PROMPT,
Huh/EXAMINE_FILTER, and ordinary magic drain/WARN. Source locations and
receipts are in `locales/gameplay/canned-source-map.json` and
`docs/CANNED-MESSAGES-REVIEW.md`. The 45-variant fixture is independent of
testing all 45 persistent RNG generators.

## Suppression, recursion and control matrix

| Case | Actual source support | Assert |
|---|---|---|
| Initialized mute | `prepare_message` colour mappings (`message.cc:1810–1841`); `_mpr` muted return only when `io_inited` (`1553–1558`). | No callback and no Lua `c_message` hook for the muted target. Preserve any earlier note/interruption effects. |
| Message suppression | `msg::suppress` constructors/destructor (`message.cc:1072–1104`) and `prepare_message:1815–1816`. | Suppressed initialized canned target has no observation; scope restoration allows the next ordinary canned event. |
| Crash state | `crawl_state.game_crashed`; `_mpr` returns before preparation (`message.cc:1510–1525`). | Zero event; pending source ID is consumed without contaminating the next raw or accepted message. Use an isolated state fixture, not an intentional process crash. |
| Noninitialized I/O | Muted return is conditional; accepted buffer path precedes the no-I/O return (`1553`, `1588–1592`). | Preserve the actual original exception: noninitialized muted text can continue into the buffer/observer. Do not assert that every muted value is always rejected. Lua `crawl.mpr` itself refuses no-I/O calls (`l-crawl.cc:63–64`), so this needs C++ fixture access. |
| Recursive client Lua | `_doing_c_message_hook` guard and hook (`message.cc:1563–1568`). | Unique raw nested message is not relabelled; outer descriptor follows completed nested emission. |
| Earlier interrupt recursion | `mpr_check_patterns` calls `interrupt_activity` before `c_message` (`1765–1792`); `c_interrupt_activity`/`c_interrupt_macro` may emit messages (`delay.cc:953–985`). | Consume outer pending ID before `prepare_message`. A raw nested message produced by an active real delay never inherits it. A stopped/empty delay does not prove this case (`delay.cc:1102–1103`). |
| Force-more and flash | `_check_more` and `_check_flash_screen` ignore level generation and off-current-level excursions (`message.cc:1368–1396`). | Original prompt/flash happens once; descriptor snapshots its decision. Include current-level, generating-level and off-level fixtures. |
| Effective join/repeat | `message_line` canonical width rule (`117–122`) and native repeat/short merging (`145–191`). | Callback carries actual `msg.join`, not preliminary `_mpr` join. Accepted-event log may have multiple events while native text condenses repeats; do not demand identical log rows. |
| Temporary messages | `msgwin_set_temporary`, `msgwin_temporary_mode`, `msgwin_clear_temporary` (`1478–1506`). | Native rollback still clears its original message window/history. Current semantic log records accepted emissions and has no rollback event; label it as a separate observation panel. |
| Fake language | `fake_lang = butt` is registered (`initfile.cc:4422`); transform draws UI RNG (`lang-fake.cc:524–550`). | Original transform/draw happens once and is identical with observer absent/present. Japanese projection and redraw do not rerun it. It remains an unlocalized optional setting. |
| Quad emphasis | Original transform after Lua (`message.cc:1579–1585`). | Snapshot `shout` at that original point. Change duration after acceptance, then redraw: historical English uppercase/Japanese emphasis remain unchanged. |

`buffer.add` may flush a previous message and suspend for input before the
current accepted callback. Trace accepted completion and pause order rather
than assuming every callback is sent before every more prompt. Native history
excludes PROMPT/EQUIPMENT/EXAMINE_FILTER and stores canonical text, not IDs
(`message.cc:1795–1805`, `2214–2256`).

## Safe source-supported rc and Lua setup

Use fresh disposable games. The active build defines `CLUA_BINDINGS` and
`WIZARD` (`tools/engine-build.py:194`). The official default wizard setting in
a regular wizard-capable build is WIZ_NO, not automatic wizard mode
(`initfile.cc:974–987`); entering it has a real confirmation and changes the
game's scoring state (`wizard.cc:300–323`). Do not treat the compile flag as
evidence that a current player is already a wizard.

`&` is the official default wizard command (`cmd-keys.h:124`). At its command
prompt, `*` followed by a letter is the source-supported Control substitute
(`wizard.cc:342–343`). Therefore `&*u` selects the client Lua interpreter and
`&*t` the dungeon Lua interpreter (`151`, `155`). Verify the actual prompts
and exit the interpreter with Escape. These routes are test fixture setup,
not production user actions or API exports.

Client-Lua setup for the canonical-hook fixture can use the real global hook:

```lua
dcss_review_trace = {}
function c_message(text, channel)
  dcss_review_trace[#dcss_review_trace + 1] = {text, channel}
  if channel == "plain"
      and text:find("You are already empty-handed.", 1, true) then
    crawl.mpr("DCSS-REVIEW-RAW-NESTED", "plain")
  end
end
```

This is a proposed owned test snippet; it has not been executed. Native
`_doing_c_message_hook` supplies the recursion guard. `crawl.mpr` accepts a
numeric or canonical named channel (`l-crawl.cc:61–84`). The hook gets the
original colour prefix and English; a Japanese display label must never be
fed back as a control string. Capture the recorded data through the existing
interpreter/logging route while safely at its input prompt, then remove the
hook in that disposable game.

The real `crawl.setopt` accepts original rc syntax and calls
`read_options(s, true)` (`l-crawl.cc:644–660`). Proposed exact-English rules:

```lua
crawl.setopt("message_colour += mute:plain:You are already empty-handed.")
crawl.setopt("force_more_message += plain:You are already empty-handed.")
crawl.setopt("flash_screen_message += plain:You are already empty-handed.")
```

Run these in separate fresh fixture games, not all at once: muting removes the
later force-more/flash path. The channel prefix is parsed by
`message_filter::message_filter` (`initfile.cc:3372–3392`); colour mappings
consume the first colon and recognize literal `mute` (`3395–3418`). Keep any
preexisting default rules in the receipt. Observe notes/interruption at their
original stages rather than assuming a mute mapping prevents earlier effects.
`crawl.messages(n)` returns native buffer text (`l-crawl.cc:748–752`), but
is not a semantic-history API.

Do not use `crawl.random2` or `crawl.rng_wrap` to sample a RNG state in a test:
they run code/draws rather than inspect state. Dungeon `rng_wrap` creates a
subgenerator with source RNG seed/sequence draws (`l-crawl.cc:1791–1832`);
that is fixture activity whose RNG changes must be included in the baseline.

## Normal session completion and last-frame contract

The original engine distinguishes lifecycle reasons internally. `end_game`
maps kill types to death/win/leave/quit (`end.cc:234–243`, `275–321`) and calls
`game_ended` (`431`). Normal `game_ended_condition` is caught in
`main.cc:399–403`; `_reset_game` closes Lua, clears player/message state and
the native screen (`352–377`). When restart is not selected, `main` then
calls `end(0)` (`343–347`). Crashes use `end(1)` (`end.cc:443–455`);
bad-save exceptions use `end(1)` (`main.cc:410–416`).

At this review's source baseline, `web/core-worker.js` incorrectly routes
`onExit(0)` through fatal `fail`. Suggested JS-only terminal contract:

- Numeric status 0 transitions once to a generic completed-session state,
  stops input, clears keys/wake, and settles pending requests.
- Retain already accepted semantic history and the last delivered native
  frame. Reject later state/save/repaint/gameplay calls without C++ reentry;
  diagnostic filesystem access can be a separate explicit policy.
- Nonzero exit and `onAbort` remain fatal. Handle an expected Emscripten
  `ExitStatus(0)` only in a verified completed transition; do not swallow a
  different late exception.
- Exercise completion during startup, completion from an input callback,
  duplicate callbacks, queued requests, late messages and nonzero/abort paths
  in host tests, then confirm actual controlled engine endings.

Status 0 is not a typed death or win descriptor: save, quit, leave and other
normal modes share it. The current platform exports no original exit reason;
post-exit player state has already been reset. Do not infer lifecycle identity
by matching English or an HP value. Capture a real game-over native frame and
fixture identity before dismissing its popup. The final delivered frame may
be a source cleanup frame, so terminal UI must not promise that it always
contains the death screen. A later typed source lifecycle emitter can carry
the original `game_exit`; adding it requires a separately rebuilt artifact.

## Controlled lifecycle fixtures

| Flow | Official source-supported fixture | Evidence and limits |
|---|---|---|
| Combat | `&m` opens `wizard_create_spec_monster_name` (`wizard.cc:121–122`, `wiz-mon.cc:53–70`); choose a valid source monster spec and observe its placement, then use normal movement/attack or a genuine equipped attack. | Real monster turn, HP/damage, death/removal or loot as applicable; compare exact trace/PCG before and after. Wizard fsim is a different simulation and does not prove browser combat flow. |
| Branch transition | `&~` invokes `wizard_interlevel_travel`, the actual level chooser and `_wizard_go_to_level` (`wizard.cc:192`, `wiz-dgn.cc:134–192`). | Actual load, branch/depth change, new level frame and native save/resume there. It bypasses normal branch-entry requirements; use actual stairs separately to verify the user flow. |
| Death | In dungeon interpreter, official `you.die()` invokes `ouch(INSTANT_DEATH, KILLED_BY_SOMETHING)` (`l-you.cc:1679`, registered `1921`). | With a wizard character, answer the real `Die?` prompt with yes (`ouch.cc:1550–1557`), then handle genuine more/inventory/game-over prompts. Verify `MSG_YOU_DIE` has nojoin and normal terminal handling. |
| Victory | `&o` opens item creation; class key `0` creates `OBJ_ORBS/ORB_ZOT` at the player (`wizard.cc:129`, `wiz-item.cc:95–125`). Pick it up normally with `g`, verify `you.have_orb()` through a supported Lua context, reach D:1's genuine dungeon exit and use `<`. | `stairs.cc:888–893` uses KILLED_BY_WINNING only when `player_has_orb()`. Record real Orb pickup, exit, game-over popup and status-0 completion. This fixture bypasses acquiring runes and completing branches. |

For controlled death, `crawl -test` is not a substitute: the WIZARD path
always restores life when `crawl_state.test` is true (`ouch.cc:1557–1565`).
The upstream `test/youdie.lua` checks that test-mode death is handled, not that
a real game reaches terminal death. `&Z` is explicitly
`wizard_unobtain_runes_and_orb` (`wizard.cc:177`, `wiz-item.cc:1434–1441`), not
a command to grant runes or the Orb. Do not use
`crawl.mark_game_won()` as proof of an Orb victory; it is a tutorial-oriented
exit override (`l-crawl.cc:1789`, `end.cc:436–440`).

Upstream `-test`/`-script` modes and their Lua files are useful separate source
tests (`initfile.cc:5915–5955`, `ctest.cc:126–151`, `191–225`). Their available
files, DEBUG_TESTS configuration and DATA_DIR_PATH search must be verified
in the built artifact; `ctest.cc` warns that source-tree tests are not generally
set up with DATA_DIR_PATH. Do not invent a test command or silently count an
unavailable suite as passed.

## Scope still open after these runtime checks

All controlled fixtures and parity checks are implementation evidence. A
full normal real-play flow, PC/mobile input and IME, CJK rows/wrapping,
assistive-technology announcements, storage compatibility, complete Japanese
text coverage and publication require their own completed evidence.

The reviewed startup catalogs remain preparation for phase 2: 51 bilingual
IDs/37 selected sites are embedded in Rust, but native startup has no typed
source emitter. Its external names and seed values, species/job reference
contexts, ordinary item-name dependency, rich/padded rows and command tokens
must follow the declared descriptor contract. None may be introduced through
global replacement or English-message matching.
