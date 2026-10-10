# Original Dialog.yesnoPopup construction and roundtrip

Static audit of retained upstream ToME/T-Engine 1.7.6. No original Lua, browser, build, or input execution was performed. All `E:` paths are members of `game/engines/te4-1.7.6.teae`. The corresponding source-evidence JSON records original excerpts and full-member SHA256 hashes. The projection implementation elsewhere in the workspace was not modified.

## Original factory and exact outcomes

The real factory is `E:engine/ui/Dialog.lua:148–166`:

`Dialog:yesnoPopup(title, text, fct, yes_text, no_text, no_leave, escape, preexit_fct)`

The eight positional arguments after `self` are title/body strings, mandatory outcome callback, optional yes/no labels, optional flag disabling EXIT, exact escape outcome value, and optional preexit callback. The factory returns the actual Dialog instance. It uses `new(title,1,1)` at150, rather than a separate Popup subclass.

| Original construction slot | Result |
| --- | --- |
| 149 | Measures body using `self.font:size(text)`. |
| 150 | Creates `d` through the original Dialog constructor. |
| 153 | Creates `ok` Button with `yes_text or _t"Yes"`; callback is `preexit_fct(true)` if present, then `game:unregisterDialog(d)`, then `fct(true)`. |
| 154 | Creates `cancel` Button with `no_text or _t"No"`; same order with `false`. |
| 155 | If `not no_leave`, installs dialog `EXIT`; callback is `preexit_fct(escape)` if present, unregister, `fct(escape)`. The default escape value is **nil**, not false. |
| 156–160 | Calls `loadUI` with body Textzone, yes Button, no Button in that order. |
| 161 | Calls `d:setFocus(ok)`, making the yes button the default focused widget. |
| 162 | Calls `d:setupUI(true,true)` for measured layout. |
| 164 | Registers the actual dialog in the game. |
| 165 | Returns `d`. |

`yesnoLongPopup` at169–189 uses the same callback values/order, but creates buttons before the dialog, takes explicit width, and calls `setupUI(false,true)`. A construction seam for the short factory must not silently assume the long variant has the same creation order. The yes/no/cancel variants at193–235 use two outcome booleans and are a different contract.

## Dispatch through retained original controls

`E:engine/ui/Button.lua:33–43` assigns `self.text=t.text` and `self.fct=t.fct`, then calls `Base.init`; Base creates a Mouse and KeyBind at `E:engine/ui/Base.lua:87–89` and invokes `generate()` at107. Button generation binds `ACCEPT` at65 to `self:sound("button"); self.fct()`. Mouse activation at63 requires `button=="left"` and `event=="button"`, and also runs sound followed by the same callback. `E:engine/Mouse.lua:71` maps mouse release to `"button"`, press to `"button-down"`.

The dialog has no `ACCEPT` binding added by `yesnoPopup`. **Calling `d.key:triggerVirtual("ACCEPT")` does not choose yes.** An application action handle should retain the exact live `ok`/`cancel` object and dispatch `widget.key:triggerVirtual("ACCEPT")`; `E:engine/KeyBind.lua:263–265` invokes the already installed virtual callback. This preserves Button sound and the original outcome closure. Calling `widget.fct()` directly skips Button sound.

For actual keyboard events, original `Dialog:keyEvent(...)` (`E:engine/ui/Dialog.lua:824–827`) first calls the focused widget's `key:receiveKey(...)`; only unhandled keys go to the dialog's KeyBind. `generate` installs this forwarding handler at512. Thus initial keyboard accept reaches the focused yes Button. Original tab/arrow handlers at513–519 call `moveFocus`; `setFocus` maps object identity to the `uis` index at736–752. `KeyBind:receiveKey` at214–247 invokes matched virtual callbacks with key arguments, normally on key-down unless the binding permits up/down.

EXIT dispatch is `d.key:triggerVirtual("EXIT")`, retaining the factory's nil/false/custom escape value. Dialog generation also routes a left mouse release outside the window to EXIT (`E:engine/ui/Dialog.lua:508`); with `no_leave=true`, the factory provides no EXIT callback and that activation has no factory outcome. Button choices remain available.

## Registration, removal, and one-shot projection handles

`E:engine/Game.lua:420–429` checks refusal, appends the dialog, records `dialogs[d]` and `d.__stack_id`, sets dialog key/mouse as current, then calls `d:on_register()` and `game:onRegisterDialog(d)` if defined. Attaching metadata only after the factory returns is too late for those registration callbacks.

`unregisterDialog` at470–484 checks membership, removes the dialog, calls `d:cleanup()` then `d:unload()`, repairs stack indices, restores the current handlers of the next dialog or game, calls `game:onUnregisterDialog(d)`, and calls recovered dialog `on_recover_focus()` if defined. `Dialog:cleanup` at836–842 kills dialog particles and invokes widget `on_dialog_cleanup` callbacks; `unload` at832–833 is the default empty method.

Original yes/no closures have no one-shot guard. A retained stale Button callback can run `preexit_fct` and `fct` again even after `unregisterDialog` becomes an idempotent no-op. Before dispatch, the projection must verify the instance generation, `game.dialogs[d]`, and that the selected widget still belongs to that instance. Consume the opaque browser action handle once. This guard belongs to the application input boundary; it must not replace the original outcome callback sequence. If `d.__refuse_dialog` prevents registration, do not expose actions as live.

## Metadata insertion at actual construction

Use an explicit semantic payload from the caller/localization resolver, never title/body/label string matching. Keep the already resolved original strings in the original constructor arguments: body measurement at149 expects the rendered string; `Textzone:init` converts `t.text` through `tostring` at `E:engine/ui/Textzone.lua:30`, so passing an ID/parameter table as text is not a transparent substitution.

The concrete short-factory seam is **after `loadUI` at160 and before `game:registerDialog(d)` at164**. At that point the exact original instances are available: `d`; local `ok`; local `cancel`; body `d.uis[1].ui`; yes `d.uis[2].ui==ok`; no `d.uis[3].ui==cancel`. `loadUI` retains objects as `uis` entries and keys `ui_by_ui` by object identity (537–553), and `setupUI` preserves their identity while setting geometry (715–719).

Attach sidecar fields or identity-keyed weak-table metadata for:

- Dialog: opaque instance/generation, explicit factory kind `yesnoPopup`, caller-owned title ID+parameters, body ID+parameters, and EXIT availability/value.
- Body Textzone: caller-owned body ID+parameters and role `body`.
- Yes Button: role `yes`, explicit label ID+parameters, opaque action handle bound to this exact object's original ACCEPT closure.
- No Button: role `no`, explicit label ID+parameters, opaque action handle bound likewise.

Default button IDs should be the catalogue entries for the original `_t"Yes"` / `_t"No"` source sites at153/154. Caller-supplied labels need their explicit IDs and parameters; they cannot inherit a default ID just because their displayed text coincides. Title/body similarly need callsite provenance or explicit metadata. Do not infer content IDs from the generic Dialog title. Upstream's Button/Base constructors do not copy arbitrary `t.semantic_*` fields; a wrapper receiving such constructor metadata must explicitly attach it to the returned widget.

A wrapper that only receives `d` after calling the old factory can attach metadata before a later rendering pass, but misses registration-time consumers. To support those consumers while preserving the original body, use a scoped constructor/factory context consumed at the register boundary for the exact newly created instance, or add an explicit optional metadata argument to the retained factory and attach before164. Restore scoped hooks/context on errors and nested construction. These are integration options; this audit does not implement either.

## Proposed original-factory roundtrip assertions

Create three separate real `Dialog:yesnoPopup` instances with instrumented `preexit_fct`/`fct` event logs and explicit semantic payloads. Verify the registered object is the returned original instance; its three original widgets, measured geometry, initial yes focus and live action handles are projected. For yes and no, dispatch the respective original Button ACCEPT virtual callback and assert `preexit(value)` precedes unregister lifecycle and `fct(value)` follows removal. For EXIT, assert exact supplied escape value, including nil via explicit event argument-count/value records. Verify handler restoration and cleanup. Test `no_leave=true` rejects EXIT while both buttons still work, and stale/duplicate handles cannot call original callbacks twice. Read semantic IDs from construction metadata and verify Japanese formatting with parameters, independent of displayed English/Japanese text. These checks are proposed, not executed in this source-only task.
