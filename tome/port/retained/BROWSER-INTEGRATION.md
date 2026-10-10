# Retained-core browser wiring

This source milestone connects the existing Rust byte mailbox to the actual exports in `native-core-work/native_browser_init.c`. It is a diagnostic integration seam. The complete original game UI, content localization, saves, and browser gameplay have not been verified through this seam. No compiler, test runner, native runtime, browser, or server was executed while preparing this followup under the parent's resource hold.

## Concrete host API

`browser/original-native-core.mjs` calls `tome_native_init`, `tome_native_start`, `tome_native_snapshot`, and `tome_native_command` through the native module's actual Emscripten `ccall`. It reads `tome_native_last_error` only after failure. The native JSON response is one C-owned buffer replaced by the next successful snapshot/command. A string-returning `ccall` copies it immediately, then this adapter produces an independent UTF-8 byte array. It never frees that buffer or holds its address. The native source caps each reply at 8 MiB; Rust separately caps its transport at 16 MiB.

`browser/retained-browser-session.mjs` creates the original module with the real canvas and `noInitialRun:true`, awaits `mountBeforeInit(module)`, initializes original SDL/C/Lua, starts the original loader/Birther once, and requests the original snapshot through Rust. Duplicate callers join the same startup promise. A partially failed native init/start is terminal for that session; a fresh page/runtime is needed. It does not restart birth or retry an original action after failure.

```js
import nativeFactory from '../native-core-work/browser-build/tome-native.mjs';
import { mountOriginalInputs } from '../bootstrap-work/browser_vfs_mounts.mjs';
import { createRetainedBrowserSession } from './browser/retained-browser-session.mjs';
import { renderDiagnostic } from './browser/diagnostic-renderer.mjs';

const rustWasmBytes = await fetch('./tome_core_environment.wasm').then(response => {
  if (!response.ok) throw new Error('Rust WASM fetch failed');
  return response.arrayBuffer();
});
const session = await createRetainedBrowserSession({
  nativeFactory,
  canvas: document.querySelector('#native-canvas'),
  rustWasmBytes,
  mountBeforeInit: module => mountOriginalInputs(module, '/vfs-manifest.json'),
  locateFile: name => new URL('../native-core-work/browser-build/' + name, import.meta.url).href,
  onPresentation: presentation => renderDiagnostic(document.querySelector('#diagnostic'), presentation),
});
await session.start();
const unbind = session.bindControls({ controlsRoot: document.querySelector('#diagnostic') });
```

The VFS mounting module/server is separately owned by `bootstrap-work`; the exact published URL layout must be supplied by the integrating host. This module does not preload archives, install a filesystem, make network requests for original assets, or claim redistribution permission. The real initializer still requires original fonts/SDL/OpenGL and source archives, even when Rust displays the copied diagnostic view.

The DOM renderer recognizes `data-text-id="ui.core.title"` and any other Rust catalog ID, `data-tome-status`, and `data-tome-field="name|turn|life|max_life|level|energy|x|y"`. Controls carry `data-tome-command="MOVE_STAY"` or a verified original movement ID, `data-tome-op="snapshot"`, or `data-tome-locale="ja|en"`. All visible labels/status come from matching Rust EN/JA catalogs; original actor names remain unchanged and use `textContent`. A movement control is disabled before birth, during a pending call, or after terminal lifecycle failure. The renderer has no native callback and computes no FOV, RNG, or simulation.

## Input and simulation ownership

Physical keys go to Rust immediately so the browser can call `preventDefault` only for a handled action. The capture handler also stops propagation of owned inputs by default. The host must keep the original SDL/main-loop input and tick dispatcher inactive for these same events; otherwise one physical action could reach both input paths. Current native source exposes no public tick/drain or redraw call, and this session invokes none. An original movement command advances only through the retained Lua driver's actual `game.key:triggerVirtual` and `game:tick`. View/language requests require no new native call. Snapshot refresh is explicit; no polling or `requestAnimationFrame` simulation loop exists.

## Concrete completeness gaps and next increments

1. **Original dialogs:** `bootstrap-work/real-core-probe.lua` rejects gameplay commands while `#game.dialogs > 0` and stops its original tick loop when a dialog opens. Protocol 1 does not project the dialog stack, so this UI cannot display or answer those dialogs. Add a source-owned read-only projection of the original top dialog, title/text IDs, selected components and supported actions. Route selection/accept/exit through that dialog's original `key` and component callbacks while retaining `engine.Game:registerDialog/unregisterDialog`. Test an original `Dialog.yesnoPopup` before adding inventory, targeting, character sheets, or talent menus. Do not dismiss a dialog by directly deleting it from the stack.
2. **Birth selection:** the current original driver calls the original Birther `makeDefault` and checks Cornac/Berserker. It preserves original birth rules but supplies one proof choice. Next expose the original Birther selection components and original validation callbacks to Rust presentation/input; retain its descriptors, equipment, zone creation, and completion hook.
3. **World display:** protocol 1 copies direct map/FOV tables and omits object-stack containers without native entity identities. It is insufficient for production invisibility/ESP, remembered images, stacks, targeting markers, animations, and original tooltips. Extract the original cached display decisions at the presentation seam; rendering a Rust frame must never call `updateFOV`, RNG, or rule-bearing helpers. The provided renderer deliberately limits itself to actor/status observations.
4. **Game actions and text:** the current command whitelist covers movement and attack-or-move only. Audit each original `mod.class.Game:setupCommands` handler before expanding typed routes. Original displayed content still needs its inventoried semantic IDs and reviewed parameter-preserving JA catalog; actor/player external names remain external parameters. Rust's static adapter labels cover only this diagnostic shell.
5. **Original saves and platform:** snapshots are not savefiles. Add explicit invocation of the original `engine.Savefile`/game save/load paths and persist their native files under the isolated runtime home, including native userdata/class graph and combined RNG state. Coordinate original audio/system events through the retained platform seam separately; no snapshot reconstruction is permitted.

## Validation waiting for resource release

Prepared `browser/original-native-core.test.mjs` checks exact native ABI arguments, one init/start, response ownership, terminal bootstrap failures, and no action retries. `browser/retained-browser-session.test.mjs` checks real Rust WASM with synthetic native callbacks for mount/init/start order, immediate handled input, one original action, pure display/locale, and localized lifecycle failures. These newly prepared tests have not been executed. The previous WASM artifact predates final source/catalog additions and must be rebuilt before testing or inclusion in a host.

After release, run the existing Rust native tests/clippy, rebuild WASM, and execute all three browser `.test.mjs` scripts. Then separately prove actual original native bootstrap, default birth, snapshot purity including complete native RNG, one original move/wait, a real dialog round trip, original save/resume, and PC/mobile browser flows. Synthetic ABI fixtures establish transport behavior only.
