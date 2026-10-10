# Next original DRL browser flow gates

Source-only review dated 2026-10-02. Mechanics authority is pristine DRL
`a6f965072b3a25b768c91dbced00367f1b57d865` and Valkyrie
`f89735a741a968997656c2d48a003ec569db7f22`. No browser, server, compiler,
or original game was run for this review. The new pure helper fixtures passed
9/9 with `node --test port/tests/original-flow-phase.test.mjs`.

The inspected original browser evidence completed at
`2026-10-02T20:10:42.709Z`: 11 checks passed using core SHA-256
`e13315d480a34b6903e12f686a809b43ca2e55c6508464dd05c4263defd3fd98`.
Its combat check fires at an empty tile and reloads; it does not establish a
hostile encounter, hostile damage, player damage, or kill. This document and
the pure tests do not change that runtime result.

## Explicit intro phases

The original [`plot.lua:3`](../native/drl/bin/data/drl/plot.lua#L3) calls exactly
three blocking plot screens in this order:

| Index | Exact semantic ID | Original producer line |
| --- | --- | --- |
| 0 | `message.plot.intro-wait` | `plot.lua:7` |
| 1 | `message.plot.intro-contact` | `plot.lua:12` |
| 2 | `message.plot.intro-silence` | `plot.lua:26` |

[`drlbase.pas:1392`](../native/drl/src/drlbase.pas#L1392) runs this hook before
episode/level generation. [`drlio.pas:1253`](../native/drl/src/drlio.pas#L1253)
pushes the plot and waits for its layer. [`drlplotview.pas:47`](../native/drl/src/drlplotview.pas#L47)
reveals text at 40 milliseconds per position, or 2 after boost. A confirm
boosts when the unboosted position is below 80% of `Length(FMessage)`; otherwise
it finishes the plot. `FPosition` and the threshold count Pascal UTF-8 bytes,
while the browser VTIG renderer spends the reveal budget in display columns
([`vtig.pas:486`](../core-overlay/fpcvalkyrie/src/vtig.pas#L486)). Thus seeing the
whole Japanese page does not guarantee that its first Enter closes it.

Use [original-flow-phase.mjs](../port/tests/original-flow-phase.mjs), binding
`createIntroClassifier(locales.ja)` to the current default language. Its three
eight-glyph prefixes identify the known page; `complete` additionally requires
every catalog glyph, including punctuation and the external name Jake. Only
whitespace from native wrapping/padding is ignored. English fallback is rejected
in Japanese. A blank or unrecognized screen receives no key and eventually
fails with the actual screen retained.

The physical `key()` helper already waits for a down receipt's native
presentation. Preserve two fields on its existing action record:

```js
const downPresented = await until(/* existing down receipt predicate */);
// In the existing physical_key action record:
down_receipt: downReceipt,
down_presented_frame: downPresented.frameGeneration,
```

Replace the blind post-name loop with the following bounded decision sequence:

```js
import {INTRO_PHASE_IDS, createIntroClassifier, introConfirmationAllowed}
  from './original-flow-phase.mjs';
const classifyIntro = createIntroClassifier(locales.ja);

for (const [index, id] of INTRO_PHASE_IDS.entries()) {
  let current = await until(async () => {
    const s = await healthy(), w = classifyIntro(s.text);
    assert.equal(s.locale, 'ja');
    if (w.kind === 'plot') assert.equal(w.id, id, 'Intro phase order');
    assert.notEqual(s.probe?.state, STATE.playing, 'Intro must not skip a page');
    return w.kind === 'plot' && w.complete ? s : false;
  }, `Full original plot ${id}`, 45000);
  let confirmations = 0, activationFrame = null;
  for (;;) {
    assert.equal(introConfirmationAllowed(classifyIntro(current.text), {
      expectedId:id, confirmations, frameGeneration:current.frameGeneration,
      activationFrame,
    }), true);
    evidence.actions.push({kind:'known_intro_confirm', id, confirmations,
      frameGeneration:current.frameGeneration, screen:current.text});
    await key('Enter');
    activationFrame = evidence.actions.at(-1).down_presented_frame;
    confirmations++;
    current = await until(async () => {
      const s = await healthy(), w = classifyIntro(s.text);
      if (s.probe?.state === STATE.playing && s.probe.playerPresent) {
        assert.equal(index, 2, 'Playing may follow only the third plot');
        return s;
      }
      if (w.kind !== 'plot') return false; // no blind confirmation
      if (w.id !== id) {
        assert.equal(w.id, INTRO_PHASE_IDS[index + 1], 'Next intro phase');
        return s;
      }
      return w.complete && s.frameGeneration > activationFrame ? s : false;
    }, `Original plot transition ${id}`, 45000);
    if (current.probe?.state === STATE.playing) { initial = current; break; }
    if (classifyIntro(current.text).id !== id) break;
    // The same full page may get one second confirmation; the helper rejects
    // a third. Retain screen, receipts and phase ID on failure.
  }
}
```

The subsequent existing initial assertions still require seed 5489, seeded mode,
difficulty 1, Marine, player and level presence, first level, exact external name,
and original intro placement `(4,10)` (`intro.lua:205–210`). No Enter is sent in
playing state. The witness recognizes a phase; it does not introspect private
`FBoost`, `FPosition`, or native modal state.

The later-frame condition is necessary: [`vio.pas:149`](../native/fpcvalkyrie/src/vio.pas#L149)
updates a layer, removes it when finished, then renders its already queued
closing text once. A later actual native frame cannot redraw that removed
plot. `drlGame.replay()` does not advance `frameGeneration`, so it cannot create
permission for the second confirmation. Do not substitute a DOM delay or an
unchanged DRLP fingerprint for this presentation witness.

## Native Exit after Save & Quit

`Save & Quit` sets `DSSaving`
([`drlingamemenuview.pas:72`](../native/drl/src/drlingamemenuview.pas#L72)). Original
`MenuReturn=true` ([`config.lua:77`](../native/drl/bin/config.lua#L77)) returns to
the main menu after native save, unload hook and player destruction
([`drlbase.pas:1561`](../native/drl/src/drlbase.pas#L1561), `1594–1600`). Its last
main-menu entry is Exit; selection sets `FResult.Quit` and `MAINMENU_DONE`
([`drlmainmenuview.pas:389`](../native/drl/src/drlmainmenuview.pas#L389)).

Exact catalog values:

| ID | English | Japanese |
| --- | --- | --- |
| `menu.main.exit` | ` {b------} Exit {b--------}` | ` {b------} 終了 {b--------}` |
| `game.exited` (gameui) | The game has closed. Reload this page to launch again. | ゲームを終了しました。再び起動するにはページを再読み込みしてください。 |

After the existing committed native save/hash assertion and before `resume()`:

```js
const exitLabel = label('------ Exit --------', 'menu.main.exit');
await expectLabel(labels.continue); // witnessed main menu with actual save
await expectLabel(exitLabel);
await key('End'); await key('Enter');
await until(async () => {
  const s = await healthy();
  return !s.running && s.paused && s.status === gameui[s.locale]['game.exited']
    ? s : false;
}, 'Original native Exit and final file commit');
const finalFiles = await snapshot();
const finalSave = finalFiles.entries.find(e => e.path === nativeSave.path);
assert.ok(finalSave && finalSave.kind === 'file');
assert.equal(finalSave.sha256, nativeSave.sha256);
assert.deepEqual(finalSave.bytes, nativeSave.bytes);
check('Original main-menu Exit completes native unload/reset and final storage');
```

Read `gameui-en.json`/`gameui-ja.json` from the current verified distribution
alongside the native catalogs; do not hardcode or infer a status from a substring.
`healthy()` continues to reject status/browser/import errors. A `running=false`
sample alone is insufficient: [`core-host.mjs:149`](../port/web/core-host.mjs#L149)
sets it in `finally` before the UI awaits its forced file commit
([`game.mjs:544`](../port/web/game.mjs#L544)). `game.exited` is reported only after
that commit. Native `/user/user/drl/save` must remain byte-identical; other files
such as `runtime.log` may legitimately change, so do not require whole snapshot
identity. Preserve the earlier exact native snapshot for deterministic replay.

The exit covers original `Run→UnLoad→Reset` and final object cleanup
([`drl_browser.lpr:48`](../core-overlay/drl/src/drl_browser.lpr#L48)). Fresh
navigation plus native Continue then retains the existing native-file reload,
exact DRLP/MT, external name, and consumed-save-deletion assertions.

## Bounded hostile encounter

Keep acquisition distinct from replay. Acquire one fixture with observed cells,
named native targets and a bounded physical action trace; independently replay
that exact fixture before treating its route or outcome as an automated oracle.
Do not derive a seed route from the introductory map prototype alone.

The original target controller is the preferred identity witness: `T` enters
manual target mode (`drlbase.pas:529`); Tab changes its target without executing
a gameplay command (`drlhudviews.pas:345–348`); Escape cancels (`338–342`).
`T` a second time, `F`, Enter or action confirms a shot (`391–392`, `461–471`),
so do not use a second T as a harmless inspection step. A visible target's
description contains its native name and wound category
(`dflevel.pas:1696–1701`); an invisible tile reports out of vision (`1713`).
Auto-target enumeration excludes friendly beings and normally invisible beings
(`1635–1649`). Retain the translated target title, actual name/wound description,
projection, screenshot, ammo, player HP/XP, tick count and all MT bytes before
each shot. The ASCII target overlay replaces the target glyph with `X` and its
path with `*` (`drltextio.pas:252–253`); compare ordinary playing frames after
closing the target view.

Explore through actual single-step controls, re-observing after every action.
Use only currently visible/reviewed walkable cells; doors, walls, occupied tiles,
hazards and stairs can change movement semantics (`drlbase.pas:664–705`). Retain
failed moves, do not advance a route index merely because a key was sent. Bound
the acquisition by physical action count and wall-clock deadline. Stop on an
unknown modal screen, new level, death, runtime/storage error, lost target,
exhausted ammo or missing witness. A bound reached without an encounter is an
incomplete fixture, not a passed combat test. No live native memory, Lua hooks,
seed, configuration or item state may be edited to manufacture a target.

For an acquisition run, concrete conservative test budgets are 60 accepted
costly actions total, at most eight enemy-exposure waits and twelve shots, with
an early stop when player HP falls to half HPMax. These are test stopping rules,
not original gameplay rules or a guarantee of finding an enemy. AI can evade,
reload or miss (`bin/data/core/aitk.lua:526–632`); exhausted waits without HP loss
are inconclusive. The fixture should also have a wall-clock deadline.

Coordinate interpretation must be validated rather than guessed:

| Mapping step | Original source |
| --- | --- |
| Map area starts at console `(2,3)` | `drltextio.pas:88` |
| `console = map − shift + area.position − (1,1)` | `fpcvalkyrie/src/vtextmap.pas:243–251` |
| Browser console coordinates become zero-based cells | `vbrowserconsole.pas:33–36` |

Therefore zero-based projection `(x,y) = (mapX−shiftX, mapY+1−shiftY)`. Shift
starts at zero (`vtextmap.pas:121`). Check this against the observed `@` and
paused DRLP player coordinates before selecting any observed cell. This
formula establishes the coordinate mapping, not a route or an enemy position.

Reviewed terrain relevant to intro exploration (`bin/data/drl/cells.lua`): floor
is low-ASCII `.`/high-ASCII 250 (`18–24`); outdoor rock is red `.` without declared
movement/LOS blockers (`531–539`); walls are blocking `#` (`57–67`); closed doors
are blocking/openable `+`, changing to `/` when opened (`236–272`); stairs are
`>` (`324–340`); liquids are `=` and acid/lava can damage on entry (`387–471`).
Intro tree markers become items (`intro.lua:205–208`), so avoid unknown tree/item
tiles rather than interpreting their underlying terrain. Being/item rendering
can override terrain (`dflevel.pas:385–430`). Do not attribute HP loss to combat
after stepping onto a liquid or unknown item tile.

Require separate, honestly named results:

- **Hostile encounter:** original target list selects an actually visible named
  nonfriendly being. The intro former and sergeant both display `h` with different
  colors (`beings.lua:5–54`); the glyph alone cannot identify either.
- **Hostile hit/damage:** a witnessed player shot consumes ammo and produces
  the original named hit outcome (`dfbeing.pas:2534–2556`), preferably followed
  by a worse wound category on the same named living target. Misses are legal
  (`2513–2521`). The same wound category can conceal small damage; do not claim
  an exact HP delta from it.
- **Player damage:** paused DRLP HP decreases after an accepted action, with the
  actual visible hostile attack message retained. HP loss alone can also arise
  from terrain or another effect, and does not identify an attacker.
- **Observed hostile death:** retain the visible named `being:get_name(true,true)
  .. ' dies.'` outcome (`main.lua:330–332`), the prior named target, and its removal
  while the area remains visible. An out-of-view freed-soul scream has no identity.
  XP rises on original death (`dfbeing.pas:1855–1857`), but that path awards XP
  regardless of `aKiller`; XP alone cannot attribute the kill to the player.

To assert specifically **player kill**, additionally prove original kill
attribution, for example a narrowly reviewed read-only original kill-counter
witness. Original `dfplayer.pas:296–301` records the weapon-class kill only when
`aKiller=Self` and `DRL.ActiveBeing=Self`. A sole visible enemy, named missile hit,
named death, ammo decrease and XP increase are useful correlated browser evidence;
they should not silently substitute for exact attribution in ambiguous cases.

Current DRLP exposes player position/HP/XP/level/time and serialized MT, but
neither enemy identity/HP/count/position nor ammo or kill attribution
([`drlbrowserprobe.pas:38`](../core-overlay/drl/src/drlbrowserprobe.pas#L38)). A changed
tick or RNG buffer is not a hit/death witness. A new diagnostic, if needed,
must be versioned, bounded, read-only, side-effect-free, and tested against
original fields; it must never call hooks or alter the fight.

## Deliverables and limits

- `port/tests/original-flow-phase.mjs`: new pure classification/confirmation
  helper. No existing browser test, UI, native source, catalog or overlay edited.
- `port/tests/original-flow-phase.test.mjs`: 9 passing pure fixtures for exact
  EN/JA IDs, wrapping, language leakage, partial pages, name/punctuation changes,
  ambiguity, stale frames and fail-closed confirmation bounds.
- This source audit proposes actual browser gates. It does not pass them;
  runtime owner must integrate and execute against the current pinned artifacts.

No Git/shared writes or external publication performed.
