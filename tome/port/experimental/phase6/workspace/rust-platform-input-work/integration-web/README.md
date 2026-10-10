# Isolated physical-input browser integration

The tested default delivery is unchanged. The generator reads the existing
`bootstrap-work/play-browser.html` and `.mjs`, verifies each integration anchor,
and writes only this directory's derivatives and source provenance. It preserves
the real original birth, Japanese semantic hydration, native visual frame, Rust
view projection, original full-save controller and actual IDBFS checkpoint store.

Parent source preparation:

```powershell
python rust-platform-input-work/integration-web/prepare_integration.py
```

The server factory is `physical_server.mjs`; it has no listener or process launch.
It wraps the existing baseline factory/current save VFS and selects
`native-core-work/physical-input-build` for the already compiled separate native
profile. Physical browser modules, actual standalone Rust WASM and the existing
31-ID EN/JA catalogs are served under `/physical/`. No original asset archive is
copied or preloaded. The parent must keep all served inputs frozen during a job.

Actual entry: `/physical-play-browser.html`; report: `window.tomePlayReport`.
For the existing measured browser harness, use:

```text
--server-module rust-platform-input-work/integration-web/physical_server.mjs
--entry /physical-play-browser.html
--report-expression window.tomePlayReport
--scenario-module rust-platform-input-work/integration-web/physical-browser-scenario.mjs
```

The server's `/play-browser.html` and `/play-browser.mjs` aliases are the exact
same derivative bytes, so the existing browser harness hashes the actually used
candidate source. Default baseline source/routes in other servers stay intact.

`OriginalPhysicalInput.prepare()` runs after the one genuine native initializer,
before original start and config/module loading. `FocusedInputHost` claims input
after real birth. The derivative disables the older window virtual-key owner;
cached Rust locale/view projection remains independent. Accepted physical batches
execute original SDL backend transitions, dispatch and ticking; each completed
batch then owns one explicit effectful original visual frame and fresh snapshot.
Full saving suspends/drains the physical host before acquiring the checkpoint
gate, and resumes it only after that real gate has released.

`window.tomePhysicalProbe` exposes copied actual `status()`, `backend()`, `ui()`,
`settled()`, `diagnostic()`, `raw()`, `rng()`, `calls()` and `gateExclusion()`.
The root-owned experimental derivative also exposes `frameErrors()` using the
actual `tome_native_prepared_map_lua_error_pending` and
`tome_native_prepared_map_lua_error_message` exports. It copies the original error
head without consuming its popup. The scenario requires pending zero before and
after each physical operation and actual original-frame entry/settled return.
Returned draw status alone cannot establish that the original Lua draw succeeded;
the parent must also retain printed native errors in the measured browser report.
The last diagnostic begins a valid empty native transaction, attempts a genuine
full-save settle, compares original state/RNG and every `/persist` file byte,
then closes that transaction normally through end/pump. It subsequently completes
a real full save and samples a rejected physical begin while the checkpoint gate
is held. It never forces idle, resets a gate, rolls back original state or injects
a failing transaction.

The scenario uses actual PC inventory/talents/quests/Escape keys, native dialog
counts, native SDL modifier/pressed-key/mouse getters, and native-canvas PNGs.
Menu source owners are the original `mod/class/Game.lua` handlers:
`SHOW_INVENTORY` at 2309, `USE_TALENTS` at 2343, `SHOW_QUESTS` at 2372 and
`EXIT`/GameMenu at 2434. Absent DOM menu text is not treated as a failure.
The mobile test uses real Chrome touch compatibility mouse events at one canvas
coordinate while an original quest dialog is current. Complete IME, touch/pen,
campaign UI and a separate original SDK A/B browser comparison remain unverified.

Artifacts are `physical-input-evidence.json`, four `physical-*-desktop.png`
menu screenshots and `physical-quests-mobile.png`. This source handoff performs
no game/build/browser/server execution. Parent owns measured execution and visual
inspection. New adapter sources retain GPL-3.0-or-later; original and SDK license
obligations remain with the retained source distributions.
