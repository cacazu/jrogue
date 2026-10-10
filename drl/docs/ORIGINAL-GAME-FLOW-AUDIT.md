# Original DRL new-game, combat and save/resume flow audit

This is a source-reviewed execution plan, not a passed gameplay test. Inspection
on 2026-10-02 used DRL commit `a6f965072b3a25b768c91dbced00367f1b57d865` and
Valkyrie commit `f89735a741a968997656c2d48a003ec569db7f22`, as pinned in
[game.mjs:6–7](../port/web/game.mjs#L6). No browser, compiler, Cargo or server was
started for this audit. Only this new document was written.

The inspected [browser suite](../port/tests/original-game-browser.mjs) has SHA256
`441e93258298854beefa40cd5cd656152f2fcb6be21f29080134a570b4c3972b`; inspected
[game.mjs](../port/web/game.mjs) has SHA256
`722f8f75e53e242ec2edf957a48977d8e436912d3bb95c35462a7ba7909994df`.
References to generated `core-adapted/` files describe the inspected checkpoint;
regeneration can change their line numbers. Original upstream references are the
mechanics authority.

## What runs after selecting the first trait

| Phase | Actual original transition | Test observation before the next action |
| --- | --- | --- |
| Class | Choosing Marine stores its native class ID, changes to `MAINMENU_TRAIT`, and pushes `TPlayerView.CreateTrait(True, klass)` ([drlmainmenuview.pas:783–790](../upstream/drl/src/drlmainmenuview.pas#L783)). | Native trait window and selected Ironman description are present. |
| Trait | Enter on an available trait sets `FTraitPick` and closes that layer ([drlplayerview.pas:739–747](../upstream/drl/src/drlplayerview.pas#L739)). The main menu then copies `TraitPick` to its result and enables the name field unless always-name/random-name settings skip it ([drlmainmenuview.pas:259–277](../upstream/drl/src/drlmainmenuview.pas#L259)). | Native name prompt appears; browser text entry becomes active. No additional trait confirmation is required. |
| Name | Native text-field confirmation stores the entered name, stops text input, and finishes the main menu ([drlmainmenuview.pas:640–655](../upstream/drl/src/drlmainmenuview.pas#L640)). | Text entry becomes inactive; classify the following native screen before sending another key. |
| Player | `Run` applies the menu result, prepares the game seed and creates the player ([drlbase.pas:1371–1389](../upstream/drl/src/drlbase.pas#L1371)). `CreatePlayer` assigns class/name, runs Marine `OnPick`, upgrades the class core trait, runs `OnCreatePlayer`, then upgrades the selected trait ([drlbase.pas:1603–1629](../upstream/drl/src/drlbase.pas#L1603)). | Runtime failures here must retain the last native screen, console error, pending physical action and packet/presentation receipts. A missing name prompt is not an invitation to advance other screens blindly. |
| Plot | A new game runs `OnIntro` before episode generation ([drlbase.pas:1392–1400](../upstream/drl/src/drlbase.pas#L1392)). Default intro has three sequential plot views ([plot.lua:3–38](../upstream/drl/bin/data/drl/plot.lua#L3)). Enter first boosts a partially displayed plot; a later confirmation closes it ([drlplotview.pas:47–67](../upstream/drl/src/drlplotview.pas#L47)). | Identify the current plot by its semantic text/prefix; confirm only that known plot. Do not assume a fixed number of Enter presses. |
| Episode/level | Episode slot 1 uses script `intro` and its derived level seed ([main.lua:601](../upstream/drl/bin/data/drl/main.lua#L601)). `Run` initializes/scripts the level, calculates vision, sets `DSPlaying`, then performs `PreEnter`, a tick and `PreAction` for a new level ([drlbase.pas:1420–1466](../upstream/drl/src/drlbase.pas#L1420)). | Require `DSPlaying=4`, player and level present, seed 5489, seeded mode, difficulty 1, level index 1 and visible translated level name. |
| Entry | Intro explicitly places the player at `(4,10)` ([intro.lua:205–210](../upstream/drl/bin/data/drl/levels/intro.lua#L205)). `CreatePlayer`'s temporary `(4,4)` is earlier than this script. | Assert `(4,10)` at the first genuine playing seam, then capture the original scene and starting equipment before movement. |

Marine starts with a pistol, 40 reserve 10mm rounds and two small medkits
([klass.lua:49–52](../upstream/drl/bin/data/drl/klass.lua#L49)). The pistol has
capacity 6 ([items.lua:538–556](../upstream/drl/bin/data/drl/items/items.lua#L538));
the Pascal loader fills omitted initial ammo to capacity
([dfitem.pas:236–239](../upstream/drl/src/dfitem.pas#L236)). Therefore inspect
native HUD/equipment for **6/6 loaded and 40 reserve**, rather than assuming the
easy difficulty doubles the explicit starting kit. Ironman modifies HP and
resistances ([traits.lua:18–25](../upstream/drl/bin/data/drl/traits.lua#L18)).

## Native semantic labels to use

Resolve these exact IDs from the current English/Japanese catalogs. Strip only
VTIG style markup for test matching; retain dynamic parameters and external
names. Do not search all unrelated catalog entries when an explicit ID exists.

| ID | Native English label | Japanese label |
| --- | --- | --- |
| `menu.main.new` | New game | 新しいゲーム |
| `menu.new.seeded.name` | Seeded game | シード指定 |
| `menu.seed.prompt` | Enter a seed (1..999999) | シードを入力（1〜999999） |
| `menu.seed.invalid` | Seed not in range! | シードが範囲外です！ |
| `menu.new.regular.name` | Regular game | 通常のゲーム |
| `term.difficulty.too-young.name` | I'm Too Young To Die! | 死ぬには若すぎる！ |
| `term.klass.marine.name` | Marine | 海兵隊員 |
| `view.traits.choose-upgrade` | Select trait to upgrade | 強化する特性を選択 |
| `term.trait.ironman.name` | Ironman | 鉄人 |
| `menu.name.prompt` | Type a name for your character | キャラクターの名前を入力してください |
| `term.level.intro.name` | Phobos Base Entry | フォボス基地入口 |
| `view.inventory.title` | Inventory | 所持品 |
| `view.equipment.title` | Equipment | 装備 |
| `view.menu.save-quit` | Save & Quit | 保存して終了 |
| `menu.main.continue` | Continue game | 続きから |
| `menu.main.exit` | Exit | 終了 |
| `message.game-loaded` | Game loaded. | ゲームを読み込んだ。 |

The matching catalog lines are identical in both files: menu entries
[en.json:1060–1101](../localization/en.json#L1060) /
[ja.json:1060–1101](../localization/ja.json#L1060); difficulty/class/level/trait
at 2561/2921/2961/3342; inventory/equipment/save/trait-window at
3541/3481/3595/3671. The three intro IDs are
`message.plot.intro-wait`, `message.plot.intro-contact`, and
`message.plot.intro-silence`, at [en.json:1562–1564](../localization/en.json#L1562)
and [ja.json:1562–1564](../localization/ja.json#L1562).

One concrete combat text gap exists in the inspected generated source:
[drlbase.pas:836](../core-adapted/drl/src/drlbase.pas#L836) still assigns literal
`Choose fire target:`; no matching current catalog entry exists. The initial,
warming and full alternate-fire titles at 842–844 are also literals. Native
target mode renders that action name verbatim
([drlhudviews.pas:320–324](../upstream/drl/src/drlhudviews.pas#L320)). Recommend
guarded semantic patches and en/ja entries for these titles before a Japanese
combat pass. A test may record the current English leakage as a failing finding;
it must not invent an existing ID or silently accept it as localized.

## Add initial combat through actual controls

The current suite only moves, waits and later lists combat as a remaining gate
([original-game-browser.mjs:386–392](../port/tests/original-game-browser.mjs#L386),
[436](../port/tests/original-game-browser.mjs#L436)). Add two distinct checks:
native firing/reload capability, then an observed hostile encounter.

| Physical action | Original binding and behavior | Required observation |
| --- | --- | --- |
| Arrow/diagonal movement | Defaults at [drlkeybindings.pas:134–141](../upstream/drl/src/drlkeybindings.pas#L134); command decisions at [drlbase.pas:664–705](../upstream/drl/src/drlbase.pas#L664). An occupied hostile tile becomes melee; a door can become a door action; blocked movement need not spend a turn. | Read the resulting position, level time and native messages after each action. Never treat every arrow as a successful move. |
| `w` | Wait binding at [drlkeybindings.pas:142](../upstream/drl/src/drlkeybindings.pas#L142); dispatch at [drlbase.pas:546](../upstream/drl/src/drlbase.pas#L546). | Position stays fixed; an accepted wait advances native simulation time. |
| `t` | Manual targeting at [drlkeybindings.pas:169](../upstream/drl/src/drlkeybindings.pas#L169), [drlbase.pas:529](../upstream/drl/src/drlbase.pas#L529). | Target UI and reticle appear. Ordinary arrows move the reticle; Tab selects the next target; Escape cancels ([drlhudviews.pas:338–373](../upstream/drl/src/drlhudviews.pas#L338)). |
| Enter / `f` / `t` / Space in target mode | Native confirmation set at [drlhudviews.pas:391–392](../upstream/drl/src/drlhudviews.pas#L391). | Confirm a witnessed non-player target. Confirming the player tile does not fire ([461–471](../upstream/drl/src/drlhudviews.pas#L461)). |
| `f` during play | Uses `Setting_AutoTarget` ([drlbase.pas:527](../upstream/drl/src/drlbase.pas#L527)); its default is true ([dfdata.pas:167](../upstream/drl/src/dfdata.pas#L167)). | A valid current target can fire immediately. No valid target reports `message.target-invalid-period` and returns without a gameplay command ([drlbase.pas:850–856](../upstream/drl/src/drlbase.pas#L850)). Do not expect F to always open a modal screen. |
| `r` | Reload dispatch at [drlbase.pas:547](../upstream/drl/src/drlbase.pas#L547); checks at [dfbeing.pas:811–838](../upstream/drl/src/dfbeing.pas#L811). | After spending ammo, magazine increases and reserve decreases. A full magazine is a rejected reload, not evidence of a successful action. |

Actionable sequence:

1. At the initial playing seam, save a screenshot, text transcript, current
   projection, bounded DRLP and the native equipment/HUD ammo display. Clear the
   touch Shift/Ctrl checkboxes. Do not modify original configuration or gameplay
   state to manufacture an encounter.
2. Press `t`, observe the native target screen, move the reticle once, then
   Escape. Require no shot/ammo expenditure and unchanged observed simulation
   fields/RNG. This proves target navigation/cancellation, not combat.
3. For a firing capability check, select an observed legal non-player tile
   through target controls and confirm once. Require magazine 6→5, an accepted
   native action and a newer playing frame. Read native weapon descriptions
   containing `[ammo/capacity]` ([dfitem.pas:373–376](../upstream/drl/src/dfitem.pas#L373));
   the HUD also shows reserve count ([drlio.pas:920–932](../upstream/drl/src/drlio.pas#L920)).
   Reload and verify magazine 5→6 and reserve 40→39 if no intervening ammo event
   occurred. Pin the actual observed before/after values in the fixture.
4. Record a bounded physical movement trace until a visible hostile is actually
   witnessed. Intro generation chooses a random tile/prototype variant and
   scatters trees ([intro.lua:200–205](../upstream/drl/bin/data/drl/levels/intro.lua#L200));
   clearing nearby items does not prove a route to an enemy. Seed 5489 alone is
   not evidence for enemy coordinates. Do not infer prototype placement by
   reading its `(12,3)` call without the generator's coordinate handling
   ([generator.lua:242–254](../upstream/drl/bin/data/core/generator.lua#L242)).
5. Use the observed native target identity/description, fire through the original
   controller, and retain shot/miss/damage/kill text, ammo and XP before/after.
   Native attacks can miss ([dfbeing.pas:2509–2521](../upstream/drl/src/dfbeing.pas#L2509));
   do not require a first-shot kill. Bound attempts; stop on death, runtime error,
   no witnessed target or an exhausted fixture instead of declaring combat passed.
6. Keep a versioned seed/difficulty/class/trait/action fixture with exact build
   hashes and the observed encounter. Independently replay it once before adding
   exact enemy positions or outcome assertions to the automated suite.

DRLP currently has position/HP/XP, inventory count, level time and exact RNG,
but **no weapon ammo, enemy identity/HP or enemy count**
([drlbrowserprobe.pas:38–65](../core-overlay/drl/src/drlbrowserprobe.pas#L38)).
Changed ticks/RNG do not prove a hit or kill. If native screen witnesses are
insufficient for precise combat assertions, propose a separate versioned,
read-only combat diagnostic; it must neither execute hooks nor change the game.

## Save, native exit, fresh resume and deterministic continuation

1. Finish the combat fixture at a genuine paused playing seam with no queued
   input. Capture bounded DRLP/RNG, native ammo/target/XP witnesses and a screenshot.
2. Click browser `#save`, which only sends Escape
   ([game.mjs:537](../port/web/game.mjs#L537)). Require the native seven-entry menu,
   then choose its last **Save & Quit** entry with End/Enter. Original entries
   are Continue, Help, Settings, Message history, Assemblies, Abandon Run, Save &
   Quit; the last sets `DSSaving` ([drlingamemenuview.pas:42–77](../upstream/drl/src/drlingamemenuview.pas#L42)).
3. Require the browser's committed save generation to increase and a checksummed
   `/user/user/drl/save` native file in the stored snapshot. Module path creation
   is explicit ([drl_browser.lpr:41–47](../core-overlay/drl/src/drl_browser.lpr#L41)).
   Original stream closure precedes level clear; the generated completion witness
   follows native save and display sidecars ([core-adapted/drlbase.pas:1807–1821](../core-adapted/drl/src/drlbase.pas#L1807)).
   `drlGame.saveGeneration` is updated only after `storage.save` resolves
   ([game.mjs:413–425](../port/web/game.mjs#L413)), so it already represents the
   browser commit. Also assert the active storage error is clear.
4. With original `MenuReturn=true` ([config.lua:79](../upstream/drl/bin/config.lua#L79)),
   Save & Quit returns to the main menu; it does not necessarily terminate WASM
   ([drlbase.pas:1561–1600](../upstream/drl/src/drlbase.pas#L1561)). Add an explicit
   native main-menu **Exit** step, using the witnessed Exit label then End/Enter
   ([drlmainmenuview.pas:389–393](../upstream/drl/src/drlmainmenuview.pas#L389)).
   Wait for `running=false` and successful exit status without mutating the saved
   snapshot. This covers `Run→UnLoad→Reset` and final cleanup
   ([drl_browser.lpr:48–56](../core-overlay/drl/src/drl_browser.lpr#L48)).
5. Navigate to a fresh page, click `#resume`, then choose native **Continue game**.
   The DOM launch restores a fresh Rust candidate and instantiates fresh Pascal
   WASM ([game.mjs:489–507](../port/web/game.mjs#L489)); native Continue calls
   `LoadSaveFile` ([drlmainmenuview.pas:358–364](../upstream/drl/src/drlmainmenuview.pas#L358)).
   Require playing state, exact external name, position/HP/XP/ammo/level witnesses
   and bounded DRLP/RNG equality. Resume skips new-game plot/episode creation
   ([drlbase.pas:1376–1400](../upstream/drl/src/drlbase.pas#L1376)) and skips the
   new-level PreEnter/tick ([1445–1466](../upstream/drl/src/drlbase.pas#L1445)).
6. Require consumed native save deletion to be committed. The original loader
   closes the stream, deletes `save`, then reports `Game loaded.`
   ([drlbase.pas:1692–1702](../upstream/drl/src/drlbase.pas#L1692)); the browser
   adaptation records the completed deletion
   ([core-adapted/drlbase.pas:1710–1718](../core-adapted/drl/src/drlbase.pas#L1710)).
7. Run a recorded continuation containing actual movement, firing and reload,
   not just right/wait. Reinstall only the exact earlier committed native file
   fixture into the isolated temporary test profile, load fresh again, and repeat
   the same physical actions. Compare bounded DRLP/RNG plus native ammo/XP and
   observed outcomes at every step. Do not require subsequent saves to be byte
   identical: native `OnSaveFile` increments save count and elapsed real time
   ([drlstatistics.pas:104–107](../upstream/drl/src/drlstatistics.pas#L104)).

The existing suite already performs snapshot hashing, fresh-instance loading,
consumed-save deletion and two-load continuation
([original-game-browser.mjs:410–434](../port/tests/original-game-browser.mjs#L410)).
Add explicit native Exit and combat-state witnesses; retain its exact fixture
restoration rather than synthesizing saves or editing live gameplay memory.

## Desktop and mobile action coverage

Desktop physical down/up events currently go from the canvas to Rust normalized
input ([game.mjs:357–365](../port/web/game.mjs#L357),
[545–546](../port/web/game.mjs#L545)). Touch controls use the same keys and native
commands ([game.html:44–64](../port/web/game.html#L44)); modifier checkbox values
are explicit ([game.mjs:555–557](../port/web/game.mjs#L555)). Quick touch release
waits for an original presentation acknowledging the down packet
([game.mjs:150–203](../port/web/game.mjs#L150),
[372–375](../port/web/game.mjs#L372), [558–572](../port/web/game.mjs#L558)).

| Fixture | Desktop action | Mobile action | Assertion |
| --- | --- | --- | --- |
| Safe single step/wait | ArrowRight and `w` | Touch `[data-code="Numpad6"]`, then `[data-code="KeyW"]` | Exactly one native action per tap where the witnessed cell allows it; drained input, released key and later presented receipt. |
| Diagonal and return | Home or Numpad7; inverse diagonal | Touch Numpad7/Numpad3 | Use observed unobstructed cells; compare native position and accepted tick costs. Home/End select list endpoints in native menus, but become diagonals during play. |
| Inventory/equipment | `i`, `e`, Escape | Touch KeyI, KeyE, Escape | Exact native semantic titles; navigation/cancel has no ammo or observed simulation changes. |
| Target/cancel/fire/reload | `t`, arrows/Tab, Escape; `t` + Enter; `r` | Touch KeyT, direction/Tab, Escape/Enter; KeyR | Same original modal behavior; compare actual ammo/actions and encounter outcomes from a restored fixture. |
| Menu save and exit | Escape, End, Enter | Touch Escape, End, Enter | Correct current native menu before selection; generation after commit; return to menu and native Exit. |
| Modifier routing | Shift+direction; Ctrl+direction | Touch Shift/Ctrl checkbox plus direction | Shift invokes repeat movement; Ctrl adjusts the current target. Test in a reviewed fixture, require interruption/release, and do not infer movement from a modifier tap. Bindings at [drlkeybindings.pas:146–164](../upstream/drl/src/drlkeybindings.pas#L146). |
| Input cancellation | Release key, canvas blur and window blur | Pointer cancel/lost capture, background/blur | No stuck key or duplicate native action; handlers at [game.mjs:567–596](../port/web/game.mjs#L567). |
| Name entry | Focus native input; committed ASCII/Japanese text; editing keys | Native input/IME; text Done button | One committed text route, exact external name, no command leak during composition. Handlers at [game.mjs:580–589](../port/web/game.mjs#L580); Japanese UTF8 behavior must be tested against the browser adaptation, not assumed from the upstream ASCII filter ([vtig.pas:1429–1432](../upstream/fpcvalkyrie/src/vtig.pas#L1429)). |

Restore the same committed native fixture before comparing desktop and mobile
combat traces. Keep raw 80×25 scrolling, fit and 200% font checks, and inspect the
resulting screenshots for Japanese clipping; unchanged DRLP alone is not visual
evidence. Mobile touch buttons do not prove physical gamepad coverage.

## Concrete suite changes for the runtime owner

- Replace the up-to-14 blind post-name Enter loop
  ([original-game-browser.mjs:338–342](../port/tests/original-game-browser.mjs#L338))
  with bounded, known phase classification: name closed → each identified plot
  → genuine playing entry. Capture an unknown screen and stop. Apply the same
  rule to first-run/credits confirmations at 293–301; an engine mismatch or
  corrupted/incompatible-save screen must not be acknowledged accidentally.
- Give trait/save/inventory/equipment labels their exact preferred IDs above
  rather than relying on English-literal reverse lookup at 156–161. Keep English
  leakage as recorded failure evidence, and fail the final Japanese gate.
- Extend `healthy()` at 211–217 to reject a non-null `failedPresentation` and
  record consumed, enqueued and presented receipts with the active native phase.
  Preserve the existing physical key/presentation acknowledgement at 242–254.
- Add native starting-kit, manual target cancel, one-shot/reload and witnessed
  hostile encounter checks before save. Keep acceptance of missed shots separate
  from a verified damage/kill result. Name an encounter timeout as unverified
  combat, not a passed campaign.
- Add native Exit after committed Save & Quit and before fresh-page resume.
  Expand deterministic continuation to include recorded combat and ammunition
  witnesses. The existing DRLP byte comparison remains bounded evidence.
- Make mobile tests cover target/cancel/fire/reload and pointer release, using
  the same fixture and actual touch selectors above, rather than only one right
  movement at 394–408.
- Label the existing 50 `drlGame.replay()` check at 351–360 as cached presentation
  replay purity. It does not invoke every original render hook. For native redraw
  purity, observe a newer original frame at a paused seam with no gameplay action;
  verify the native displayed locale actually changes as well as checking DRLP.

At the start of this audit, [original-game evidence](../port/tests/output/original-game/evidence.json)
contained the earlier `2026-10-02T19:19:27.862Z–19:19:40.115Z` class-selection
failure, before the later flow assertions; only its browser/artifact boot check
passed. The runtime owner is rerunning the suite after subsequent fixes and may
replace that file. This source audit does not reclassify runtime results or
establish completed new-game, combat, save/resume or mobile gameplay.
