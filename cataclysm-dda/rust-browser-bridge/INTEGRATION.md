# Exact baseline shell integration

Apply these changes only in the owning baseline/browser task after the bridge
passes `verify.ps1`. Keep the current `sendKey` implementation and its original
SDL keyboard event properties. Copy the contents of `dist/` into the browser
output directory as `rust-browser-bridge/`.

In `baseline-preview/shell/baseline-shell.js`, alongside the existing shell
state variables, add:

```js
let rustBridge;
```

At the beginning of `async function start()`, before starting the C++ engine,
add:

```js
const { loadBridge } = await import('./rust-browser-bridge/browser-bridge.mjs');
rustBridge = await loadBridge();
window.cddaRustBridge = rustBridge; // Read-only API for browser QA.
diagnostics.rustBridge = {
  abi: 1,
  scope: 'bounded-shell-and-helper-input',
  defaultLocale: rustBridge.defaultLocale
};
```

Replace the body of the existing `t(id, parameters = {})` with:

```js
return rustBridge.formatText(language, id, parameters);
```

The existing shell locale fetch can remain for its existing startup sequencing.
Runtime formatting now runs through Rust's compiled JSON catalog; it must not
fall back to global string replacement if loading the Rust module fails.

Replace only the existing `[data-key]` helper listener body with:

```js
const resolved = rustBridge.resolveHelperKey(button.dataset.key, 'menu');
sendKey(resolved.key);
record('rust-helper-input', resolved);
```

Keep the original text-input-form listener and all physical keyboard listeners
unchanged. A submitted name or arbitrary gameplay key goes directly to
`sendKey`; it must never call `resolveHelperKey`.

The above `menu` context explicitly reflects the available baseline contract.
It must be replaced with a context from the original engine before introducing
context-sensitive gameplay helpers. The existing arrow, Enter, Escape, Tab, and
period helpers preserve native semantics; unsupported helpers are passed
through, rather than discarded. Rust preserves `.`, `|`, and uppercase `S`
as distinct stable source keys.

For a future calibrated gamepad adapter, `gamepadButton(index, context)` and
`gamepadDirection(clockwiseIndex, context)` return native keys or `null` for
unsupported controls. They do not poll gamepads or emit DOM events. Coordinate
native SDL gamepad handling to avoid delivering each press twice; do not attach
an additional poller as part of the basic shell hook.

Required integration validation is separate from the component's Node tests:
verify that the original menu boots, Rust diagnostic scope is present, helper
arrows/confirm/cancel work, all 27 shell messages format in both languages,
Japanese names preserve their bytes, and the original full save/resume flow
still works. Test this on desktop and mobile viewport sizes. Do not mark the
full game's Rust presentation/input migration or publication gates complete
based solely on this bounded hook.
