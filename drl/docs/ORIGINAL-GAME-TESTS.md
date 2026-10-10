# Original DRL browser verification

The real-game suite is `port/tests/original-game-browser.mjs`. It executes the
original Pascal/Lua core through the production browser shell and Rust adapters.
It does not accept the earlier Rust reference lab as game evidence.

Current verified status: the **2026-10-02 22:35–22:36 UTC** real Chrome run passed **15 primary checks**, with no browser exceptions or recorded localization findings, on original core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`, Rust `54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e` and 97 assets. The separate **22:45–22:46 UTC** combat/autorun run passed **six bounded checks**, and the **23:31–23:32 UTC** native death/report/profile run passed **eight checks** on that same pair. [Primary evidence](ORIGINAL-GAME-RUNTIME-EVIDENCE.json), [combat/autorun evidence](ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json) and [current visual review](ORIGINAL-GAME-VISUAL-QA.json) remain distinct records. One measured DRL heavy job at a time is authorized. Full campaign/localization/state coverage remains incomplete.

The earlier 2026-10-02 21:02 UTC 13-check checkpoint used core `6b8e1e78e52ce8d387d1f3b9c39401e5cfd3a88684db321f51a7cf985f544120` with the same Rust adapter. It remains historical evidence; the current receipts below identify core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`.

## Commands and prerequisites

Run these bounded helper/source checks before a new runtime run:

```powershell
node --check port/tests/original-game-browser.mjs
node port/tests/original-game-browser.mjs --self-test
```

After the parent releases the shared heavy-work slot and the original core has
passed the Pascal/Lua allocator, exception, suspension and host contracts:

```powershell
node port/tests/original-game-browser.mjs
```

This command starts one temporary Chrome profile and one local static server.
It uses the installed Chrome executable at
`C:\Program Files\Google\Chrome\Application\chrome.exe`; `DRL_CHROME` can select
another already installed Chrome executable. There are no experimental JSPI,
SharedArrayBuffer, cross-origin isolation or feature-enabling flags.

Required `port/dist` files:

- `game.html`, `game.mjs`, `game.css`, `core-host.mjs` and both game UI catalogs.
- `build.json` with the original-core identity and current core/adapter hashes.
- `drl-core.wasm` with `_start`, native file-generation witnesses and DRLP exports.
- `drl_web_port.wasm` with native input, text, VFS and CJK exports.
- `core-assets.json` and every hashed immutable original Lua/help/ASCII asset.

The suite checks artifact identity, exact byte counts and SHA-256 before starting
Chrome. Missing artifacts, old lab `build.json`, missing exports, unsafe imports,
stale assets, bootstrap failure and runtime errors fail the gate. They do not
produce a simulated or skipped pass.

An explicit `DRL_ORIGINAL_BROWSER_SKIP=1` writes a result of `skipped` and starts
no browser. This is for an external runner which cannot run the browser; a
skipped result is never publication evidence.

## Native action driver

Menu order and event semantics come from the pinned upstream files:

| Source | Source-backed behavior used by the test |
| --- | --- |
| `upstream/drl/src/drlbase.pas` | `DSPlaying=4`; original seed preparation, tick loop, save/load and consumed-save deletion |
| `upstream/drl/src/drlmainmenuview.pas` | First-run/credits confirmation; new-game, seeded game, range validation, difficulty, class, trait and name flow |
| `upstream/drl/src/drlplayerview.pas` | Original inventory/equipment panels and first trait selection |
| `upstream/drl/src/drlingamemenuview.pas` | Seven menu entries: Continue, Help, Settings, Message history, Assemblies, Abandon Run, Save & Quit |
| `upstream/drl/src/drlhelpview.pas` | First selectable help topic is Getting started; PageDown scrolls the help body |
| `upstream/drl/src/drlsettingsview.pas` | Gameplay is category index 2; End selects Apply settings; apply closes the original view |
| `upstream/drl/src/drlkeybindings.pas` | Arrows move, W waits, I opens inventory, H opens help and Escape opens/cancels menus |
| `upstream/fpcvalkyrie/src/vtig.pas` | Home/End set first/last selection; normal name characters include ASCII letters, digits, apostrophe, space and underscore |
| `upstream/drl/bin/data/drl/levels/intro.lua` | Original entry location is `(4,10)`; the nearby radius is cleared of trees, allowing the bounded initial rightward moves |

The browser driver sends CDP physical key down/up events to the focused canvas
or enabled original text field. Committed text is sent through `Input.insertText`
and the production DOM input handler. It does not manufacture native wire
packets, invoke Lua gameplay commands, edit gameplay memory, add items, alter
player health or bypass original menu selections.

Actions wait for the original loop to suspend, the input queue to drain and the
bounded DRLP observation to stabilize. Confirmation through first-run and intro
pages has a fixed attempt limit. If the expected original menu fails to appear,
the test stops; it does not continue sending blind gameplay inputs.

Native labels are matched against the semantic English/Japanese catalogs. An
English literal fallback lets the suite collect the remaining functional
evidence, but the final Japanese gate fails if any tested native label lacks its
Japanese projection. These findings are recorded in `localization_findings`.
English text is never silently accepted as complete Japanese coverage.

## Scope of the verified 15-check primary browser checkpoint

The recorded run verifies the following scope; the numbered flow summary below groups assertions rather than duplicating the receipt's 15 check names:

1. Actual Chrome boot of the pinned original core and Rust module, Japanese by
   default, modern JSPI available, and no unsupported platform operation invoked.
2. Original seeded-game selection rejects `0`, then accepts `5489`; easiest
   difficulty, Marine, first Ironman trait and `BrowserMarine_5489` are selected
   through the original menus. The external ASCII name must display exactly.
3. All three original plot pages reach Phobos Base Entry and its original player
   placement. The game probe must identify seed 5489, seeded mode, difficulty 1
   and the complete serialized 624-word MT state.
4. Fifty cached replays, PC resizing, canvas font changes and EN/JA changes leave
   every DRLP byte unchanged. This includes the entire original RNG stream state.
5. Inventory opens, changes to equipment, and closes; help opens its first topic,
   scrolls and closes. These view operations must preserve the complete probe.
6. Original Settings opens Gameplay, returns, applies unchanged settings and
   commits its closed settings file to IndexedDB without RNG draws.
7. A real keyboard move reaches `(5,10)` and waiting advances original level time.
   A real mobile touch on the right control moves exactly once to `(6,10)`.
8. A 390px mobile layout has no page-level horizontal overflow. The 80-column
   original canvas remains scrollable, coordinate mapping stays 80×25, and fit
   plus 200% UI font changes preserve the original diagnostic and RNG bytes.
9. The original Escape menu's Save & Quit completes its native save before the
   browser commit is recognized. The committed native file must have a verified
   SHA-256. A fresh page and fresh Rust/Pascal instances load it through original
   Continue game and restore every diagnostic/RNG byte and external name.
10. Original LoadSaveFile deletes the consumed native save, and that deletion
    must reach browser storage. The test then reinstates the exact native file
    snapshot it previously captured, loads it in another fresh instance, and
    repeats the same right/wait commands. Every resulting diagnostic and full
    original RNG state must match the first continuation.

The actual run also verifies manual target cancellation, an empty-tile pistol shot and reload (`6/6 → 5/6 → 6/6`, reserve `40 → 40 → 39`); the nonempty original `history.intro.journey` ledger with its unchanged English guard; and original main-menu Exit preserving the native save and ledger through the final commit. Hostile combat is outside that empty-tile primary check; the separate bounded encounter below observes it without exact enemy identity/HP or player-kill attribution. Snapshot version 2 preserves exact file/root timestamps; supporting strict storage tests separately cover version 1 migration and invalid metadata.

The last step writes only a byte-exact, previously committed file snapshot back
to the browser's temporary test profile. It does not synthesize a save or mutate
a running core. This isolates deterministic native save continuation while
respecting the original game's one-use in-progress save behavior.

## Evidence and interpretation

`port/tests/output/original-game/evidence.json` contains the result, source
commits, actual artifact hashes/imports/exports, Chrome version, per-check
results, the physical action trace, compact state/RNG hashes, localization
findings, console/runtime failures and screenshot hashes. A failed attempt also
tries to capture `failure.png` without hiding the original failure.

`native-save-snapshot.json` contains the synthetic test character's exact native
file fixture and its per-file hashes. It is local verification output and must
not be shipped as an example player's save. Screenshots include the initial PC
game, scrolled help, mobile touch, mobile fit/zoom and resumed continuation.
Raw screenshot `inspected` fields are not the review record. [The separate visual-QA receipt](ORIGINAL-GAME-VISUAL-QA.json) identifies the six inspected current images, including English Help and findings. Each later runtime must supply matching image hashes and independent inspection for any changed images.

DRLP is deliberately bounded. It observes seed, difficulty, player position,
health, experience, score, level/class/inventory count, selected level properties
and exact original RNG serialization. It is neither the original save format nor
a serialization of all beings, inventories, Lua fields, statistics, particles or
UI state. Equality proves purity of those observed values; it must not be
described as a proof that every internal field is unchanged. Native save/load is
additionally exercised through the original file and original loader.

The suite sets `complete_campaign:false` even when all default checks pass.
Do not translate `result:pass` into a complete DRL port or all gameplay systems
verified.

## Remaining original-game acceptance flows

The following wider scenarios still need real execution and independently reviewed action fixtures. The primary suite and separate six-check encounter/interruption gate close only the bounded observations stated above; they do not close these wider mechanics/campaign requirements.

| Flow | Reviewable execution fixture | Required observations |
| --- | --- | --- |
| Wider combat and attribution | Extend the seeded, observed-door/visible-hostile fixture with read-only enemy identity/HP witnesses and representative source-backed mechanics | Exact enemy UID/HP and player-kill attribution; melee, armor/resistance, explosion, alternate-fire and wider AI boundaries. Named hit/death/player-damage/XP/fresh-Look observations already pass the bounded gate. |
| Pickup, use, drop, swap, unload and quickslots | Record a native inventory/ground-item action sequence from a seed fixed in the fixture | Original inventory/equipment and ground changes; turn costs; exact quickslot key routing; full save/resume of resulting items |
| Chain fire and controller repetition | Extend the passed RunDelay=0 physical Shift+Right/Escape fixture with a native chain-fire weapon and held-controller flow | Escape interrupts attack/controller repetition; no duplicate command; full-state/visual-RNG/attack-count purity beyond the current bounded stable20-frame autorun witness. |
| Stair/lever and wider door/generated-floor flows | Record movement to a real door, lever and stairs; use the original action key and choose native confirmations | Correct cell/action semantics, native next-level state and seeded generation; no source edits or direct teleportation |
| Wider death/rank/profile branches | Extend the passed bounded zero-HP/mortem/HOF/profile/fresh-file-persistence fixture with different native causes/challenges/rank outcomes | Exact killer attribution, wider rank/award/archive/recovery behavior and compatible save unavailability; the eight-check native death/report/profile gate already passes for its recorded branch. |
| Win | A captured ordinary native campaign input trace, or a native save obtained during an ordinary original game and reviewed against the pinned source | Real final boss/exit condition, original win hook/plot, post-mortem victory result, medals/badges/profile updates and menu return; no debug `GameWon` assignments |
| Challenges, classes, traits, specials and assemblies | One versioned native action/save fixture per meaningful feature branch from the inventory | Original unlock checks, costs, effects, conditional text parameters and save compatibility; fixtures cannot replace the original content |
| Invalid/corrupt/incompatible saves | Alter a copy of a fixture in an isolated temporary browser profile, keeping the active game's good committed snapshot separately | Native corrupt/incompatible UI; correct keep/delete choice; profiles intact; failed browser restore never replaces a good active candidate |
| Native input breadth | PC numpad, shifted/controlled directions, focus/IME guards, mouse/menu cells, wheel, mobile diagonals/modifiers and real gamepad | Correct original bindings, one committed text route, held input releases on blur, trigger hysteresis and absence of browser shortcut capture |
| Full local text/asset delivery | Run complete text inventory/placeholder coverage, inspect game screens, check selected link-map licenses and corresponding source archive | Japanese baseline coverage including generated names/plurals; exact upstream attribution and no excluded SDK/audio assets; local HTML/Node game uses tested current hashes |

Fixture records should pin both source commits, build hashes, seed, difficulty,
class/traits and external name; list the exact physical action sequence and
expected native observations; preserve any native save as checksummed bytes; and
record whether every action was independently replayed in the browser. A
terminal death/win screen must be retained as a screenshot plus native result
files. An unexecuted fixture is a plan, not a passed check.

The Help/fixed-input refresh, browser `RunDelay = 0` override and read-only delay/MultiMove getters are compiled in the current core. The primary 15-check receipt verifies the same open official Help body/title/fixed keys through Japanese → English → Japanese on later native frames, including the scrolled page, with unchanged DRLP/MT bytes. The separate six-check combat/autorun receipt verifies native zero delay, physical Shift+Right followed by Escape, inactive MultiMove and twenty stable later native frames. Other cached views, messages, plots and reports still need semantic refresh work.

Historical source milestone: the first nonlaboratory archive for core6b8 contained 27,571 files / 543,888,352 source bytes, ZIP 166,288,072 bytes, SHA-256 `b5ff2c3aa0e2347f31af37ae7742656e2cf06f779afd1b74119cebe420c93aed`. It passed entry hash readback and is retained as earlier evidence, separate from the reconstructed 881/core20e21 baseline.

## Reconstructed-source browser verification

The verified corresponding-source reconstruction baseline is ZIP SHA-256 `881cff21b198f6f9cfe3f24ed9674586d719c18147f1b99978667be64b9b45b2`: **27,630 files / 545,460,758 source bytes**, ZIP **166,497,281 bytes**, matched to original core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`. Every decompressed archive entry passed full hash readback. Fresh whole extraction restored the 26,172-file FPC baseline and verified all 13,776 linked-source mappings; all 23 Cargo packages resolved offline from the restored vendor tree. [The clean-build receipt](SOURCE-CLEAN-BUILD-EVIDENCE.json) verifies a fresh 139-source original-game compile and Rust adapter build without copying game objects or an existing game WASM. External pinned standard compiler/units/libraries were reused; full toolchain bootstrap remains unverified.

The original core rebuild is byte-exact. Rust rebuilt as `dbec616a8d1a9021eb75242121e99b37c45fde280a760cc63518e2730dc3c02e` rather than deployed `54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e`, so the raw receipt retains `result: compiled-artifact-differs`, `clean_compile_verified: true` and `adapter_byte_exact: false`. [The strict adapter audit](CLEAN-RUST-ADAPTER-DIFF.json) passes: all instruction opcodes/locals match, every changed operand/address maps to the same logical data target, and only dependency source-location strings, their lengths, static-address relocations and zero padding account for the 512-byte difference. [Actual clean-pair Chrome](CLEAN-SOURCE-BROWSER-EVIDENCE.json) then passes all 15 primary checks, with [six-image visual QA](CLEAN-SOURCE-VISUAL-QA.json); its measured job peak was **602,259,456 bytes**. This proves the bounded tested reconstructed game flow, not full world/campaign/text coverage.

The coordinator is preparing a final authored recipe/evidence recut containing the corrected workflow helpers, frozen prose/status and added gates/receipts. It preserves the compiled core/source closure and does not yet have an asserted final ZIP identity here. Use the exact [source-bundle receipt](../port/dist/source-bundle.json) for the resulting download; the 881 archive above is the baseline actually reconstructed and tested.

## Separate observed encounter and autorun gate

```powershell
node port/tests/original-combat-browser.mjs --mode=all
```

Run after the primary suite supplies its exact committed native-save fixture, and pin the same core/Rust pair. [The separate combat/autorun receipt](ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json) passed six bounded checks on the same current pair. Physical movement and three observed native doors acquired a visible hostile; original named targeting and two pistol shots produced ammo consumption and a named hit, player damage was observed, and a named hostile death was followed by increased XP and fresh native Look at the still-visible corpse tile. The receipt does not establish exact enemy UID/HP or player-kill attribution, full-world equivalence, broader combat mechanics or a campaign.

The zero-delay gate introspects native delay 0 and MultiMove, observes one accepted Shift+Right turn with autorun active, sends physical Escape, requires the original stop message without an escape menu, and compares bounded DRLP/MT over twenty later native frames. The six receipt entries include two corroborating autorun/delay checks; they are not six separate encounters.

[The actual native death/report/profile receipt](ORIGINAL-DEATH-RUNTIME-EVIDENCE.json) passed **eight checks at 2026-10-02 23:31–23:32 UTC** on deployed core20e21/Rust54931. A bounded observed-door/hostile route and physical waits reached zero HP and the Japanese death prompt; native `DSFinished` produced the mortem with the exact full external character name and Japanese body/version markers. Native memorial writing changed and committed mortem, profile and score files. The hall of fame respected its original 17-byte name field. The original flow returned to the Japanese menu with no live player and opened the player profile; fresh original instances reloaded the exact persisted native files, score and profile, then returned to the Japanese menu. This closes that exercised death/report/profile/storage flow, not every death/rank/challenge branch or exact killer attribution.

The death receipt preserves concrete localization findings: the native `Post mortem` title (`drlbase.pas:1583`) and footer `<上,下> scroll, <左,右> pages, <Enter,Escape> exit` (`drlpagedview.pas:68`) retain English text. The known Japanese death/mortem phase guards pass independently; complete localization, full-world state, campaign/win/challenge coverage and exact killer attribution remain false/unverified. Screenshot capture is recorded by the actual receipt; independent visual review remains a separate record.
