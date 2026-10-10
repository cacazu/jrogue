# Parent integration recipe: new isolated game-flow profile

Do not edit the running/default server or link recipe in place. Current reference inputs are `native-core-work/link_textbox.py` (not textbox-web/link_textbox.py), `native-core-work/textbox-web/server.mjs`, root's distinct textbox-overlay input manifest/driver, and the existing physical integration web modules. Parent derives a separate profile/server and pins its own final source hashes. This packet contains no server launcher or compilation invocation.

## Native link

Derive new `physical-input-compat-game-flow` from the already-tested physical-input-compat-textbox path, keeping its generated main switch source guard, root nested-focus physical_input derivative, original untouched units, checkpoint exclusion derivative, planar compatibility, display contract, native nested-focus/textbox diagnostics and swallowed-frame-error observer. Extend the exact textbox-only branch and resize tuple to include the NEW profile in the derived recipe, without altering the original recipe. Append this packet's `tome_game_flow_native.c` as one seam, with existing original/includes plus bindings (tome_main_platform.h/retained_platform_drain.h) and save (checkpoint_gate.h). It has no SDL_ttf-specific requirement. Link once to `native-core-work/physical-input-compat-game-flow-build`; never overwrite the existing textbox/default artifacts.

Four KEEPALIVE exports: `_tome_game_flow_install`, `_tome_game_flow_attach_hooks`, `_tome_game_flow_snapshot_json`, `_tome_game_flow_error`. Existing ccall/string/number runtime methods are sufficient; no new native malloc/free API is exposed. Snapshot uid uses a native uint32, exactly represented as a Lua number. Zero requests no chosen target. The C source depends only on same original-main state/current_game/tickPaused/exit_engine and existing physical/checkpoint busy/reboot exports, not an invented graph or mock.

## HTTP source routes

Add `/game-flow/native-game-flow-probe.mjs`, `/game-flow/visible-flow-observer.lua`, `/game-flow/observer-provenance.json`, `/game-flow/i18n/en.json` and `/game-flow/i18n/ja.json` to the separate server's explicit sourceFiles map. Serve unchanged bytes/UTF8 with no-store. Native factory points only to the NEW output directory. No new original VFS mount is needed for the observer: trusted source bytes are submitted to its additive C seam before original start. Keep the existing unique three-leaf textbox-overlay mount and original source guards; do not replace package.loaded entries or conflate a duplicate PhysFS mount with reprioritization.

The observer source hash is the derivative_sha256 in observer-provenance.json, verified against the exact served bytes before install. A wrong/truncated/changed hash rejects before native source evaluation. Keep the diagnostic catalogue separate from the existing strict54 static input labels. It contains13 exact EN/JA IDs (the original8 plus5 bridge failures), with no template parameters.

## Actual lifecycle anchors

At module scope in the derived browser script:

```js
import {installNativeGameFlowObserver,NativeGameFlowProbe}
  from '/game-flow/native-game-flow-probe.mjs';
let flowInstallation,flowProbe;
```

Within the existing retained session `beforeStart:async ({module})=>{ ... }`, after actual native init and before its sole original start invocation, finish this source install. It can sit immediately after the existing installNativeTextboxFixture call; both are source-only module preparation, with no original UI class requirements:

```js
const provenance=await fetchJson('/game-flow/observer-provenance.json');
flowInstallation=await installNativeGameFlowObserver(module,
  '/game-flow/visible-flow-observer.lua',provenance.derivative_sha256);
```

Keep existing genuine semantic registry/font preferences/physical prepare/compat setup, and retain the session's sole original.start. Do NOT independently invoke tome_native_init/start, birth_done, makeDefault, actor/name configuration, callbacks or virtual movement to make this integration pass.

After the original start/birth and the current textbox profile's `initial_focus_settlement` followed by the real `originalVisualFrame();physicalOwner.host.completedOriginalFrame();`, construct and attach the causal observer. These are exact reviewed source APIs; no extra pumps/frame are introduced:

```js
flowProbe=new NativeGameFlowProbe({module:native,original:physicalOwner.original,
  ownerDiagnostic:()=>physicalOwner.diagnostic(),canObserve:()=>mayRead(),
  installation:flowInstallation});
report.game_flow_installation=flowProbe.attachAfterBirth();
window.tomeGameFlowProbe=flowProbe.readOnlyFacade();
```

The native attach additionally requires raw actual `__TOME_WEB.ready===true` set only by original birth_done_script, the same current registry/global Game table, tickPaused, no pending original tick-end callbacks, no physical/checkpoint busy, no modal and no exit/reboot. It appends nil-return original class.bindHook listeners once. Attachment is explicit diagnostic preparation outside the pure bracket. No automatic recovery, forced WAIT, actor edit, RNG restoration or hook rollback is allowed. Any failed/partial attach requires fresh document/VM and retained error evidence.

`mayRead()` should remain the existing host gate. If root exposes the facade after report.passed is set, its first snapshot must be taken only then. Calls before a completed source-owned boundary fail rather than advancing it. The JS owner busy/queued/error check is supplementary; C checks current original state independently. Reads of this new snapshot, physical status, original raw/RNG/display/focus and frame errors belong outside any synchronous Rust-only/native-byte comparison bracket. The new facade has no game command, tick/frame, source install or hook attach method exposed on window.

## Evidence prerequisites and withheld claims

Run the old physical/menu/textbox/save proofs independently with their unchanged input paths. For a game-flow milestone retain source hashes, actual startup installation metadata, original frame error queue, real SDL binding admission and zero virtual-command counts. A repeated snapshot may preserve selected domain/RNG bytes but writes native diagnostic memory; do not label it whole-heap pure.

The finite navigation projection exposes only eight adjacent currently-seen raw terrain cells and cached-confirmed actor facts. It does not decide walkability/hostility, enumerate level actors or create a route. The seed176 road proposal from mechanics remains unreviewed. Parent must preflight actual map/visible neighbors and stop for any unexpected actor, dialog, target-cache absence or original state transition before recording each trusted CDP input.

Combat hook data is phase-specific: Combat.lua1144-1145 is inside attackTargetHitProcs, entered from attackTargetWith only without no_procs; hook absence does not justify fabrication. Health/net damage and a positive requested damage hook are independent. Adventure can naturally resurrect in Eidolon without a terminal menu. Actual Chat letter bindings exist only after original condition filtering; current raw dialogs expose class/title, not their dynamic choices. Terminal Chat/DeathDialog choices therefore require separate real UI evidence or a source-reviewed bounded active-entry projection before any key is scripted. Original lifecycle reboot/changed-VM bridge and full victory/campaign remain unverified.