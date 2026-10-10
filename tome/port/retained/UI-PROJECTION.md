# Original UI projection and callback seam

This is source-prepared integration for the retained ToME 1.7.6 UI. It is not an implemented full-game UI port or a tested original dialog round trip. Four Rust crates remain separated from original C/Lua gameplay. No Rust actor, energy, RNG, savefile, focus, list-selection, or native callback state is reconstructed.

## Install in the existing original loader

Mount `lua/original-dialog-view.lua` at an isolated adapter path, and add `lua/native_ui_exports.c` to the retained native link after source review. The new C file uses the actual `tome_main_get_state()` and creates no VM. It exports `tome_native_ui_snapshot()`, `tome_native_ui_command(dialog,target,key)`, and `tome_native_ui_last_error()`. UI JSON has its own C-owned reused buffer with the same immediate-copy ownership rule and 8 MiB cap as the existing world bridge.

At the existing driver's `require("engine.Game")` interception, before capturing its original `registerDialog` for default birth, install once:

```lua
local ui = assert(loadfile("/adapter/original-dialog-view.lua"))()
ui.install(result, original_require("engine.ui.Dialog"))
```

Do not run another loader/pre-init or another Birther. The adapter delegates the entire original register/unregister/replace implementation and original UI load/setup/replace methods. It then assigns opaque handles in adapter-owned weak tables. Original focus, cleanup, stack positions, mouse handler selection, and on-register callbacks stay original. Handles are also synchronized only after original input completes; snapshot queries do not allocate identities.

Queries copy `dialog.display_x/display_y/w/h`, `uis[i].x/y`, component `w/h`, focus, hidden flags, original list rows/selection/scroll, and the available original callback IDs. They copy `key.disable_until`; they never query `isEnabled`, which can mutate expired gates and log. They do not call any `generate`, `display`, texture/font draw, `getTime`, name resolver, FOV method, or RNG. Geometry must already exist from the original UI setup; absent geometry is a reported projection failure.

## Protocol and Rust ownership

The existing safe WASM mailbox retains its export names. Pending kind 1 is an original world snapshot and 2 an original movement command. Kind 3 requests the separate original UI snapshot. Kind 4 contains a JSON typed command `{dialog,target?,key}`; the browser decodes that trusted Rust payload and calls C with three strings, never generated Lua or `eval`.

| Layer | Concrete source addition |
| --- | --- |
| Original gameplay and UI callbacks | `lua/original-dialog-view.lua` delegates original `KeyBind:triggerVirtual`, `Dialog:setFocus`, registration and component methods |
| Rust contract | `contracts/src/ui.rs`: ordered original dialog stack, opaque handles, geometry, component state, semantic text, trace validation |
| Rust input | `input/src/lib.rs`: modal Enter/Escape/arrows, original focused-component priority, protected IME/text/repeat/modifiers |
| Rust presentation | `display/src/ui.rs`: immutable dialog/button/text/list frames and strict semantic ID/parameter resolution |
| Rust environment | `environment/src/lib.rs`: UI observation cache, pending byte transport, stale/modal checks; no local state transition |
| Browser host | `original-native-core.mjs`, `retained-browser-session.mjs`, `diagnostic-renderer.mjs`: actual C exports, owned event dispatch, DOM projection |

Request operations are `ui_snapshot`, `ui {command}`, `ui_key {input}`, and `ui_catalog {locale,entries}`. Small catalog batches can be loaded through the same bounded UI-request transport. UI observations are independent of world readiness, permitting original birth dialogs before a full Actor/Map exists. When an original dialog is known to be active, gameplay commands are rejected in Rust and modal physical keys go to the original dialog. Original callbacks are revalidated against the live top dialog before dispatch; a stale DOM handle cannot invoke a replaced dialog.

The initial callback set is `ACCEPT`, `EXIT`, and `MOVE_UP/DOWN/LEFT/RIGHT`. Button acceptance delegates its original sound/action callback. List movement/acceptance delegates original selection/onSelect/onUse callbacks. Input gating calls original `isEnabled` only at the command boundary. No dialog is removed by changing a table; original handlers invoke their normal unregister/cleanup path. Tab focus traversal, precise mouse/text entry, sliders, trees, nested containers and custom dialog bindings still require explicit extensions after their actual original methods are verified.

The DOM host renders Rust-supplied title/button/text/list content, original stack identity and list selection. It adds action controls that submit those exact opaque handles and callback IDs. It never assigns `list.sel`, calls a callback directly from JavaScript, or locally closes a dialog. CJK text wraps inside the host dialog; original geometry is retained in the Rust frame as source evidence. Native graphics initialization remains a baseline requirement, but this dialog view is drawn from Rust output rather than wrapping the native canvas.

## Text provenance is an integration requirement

`bind_text(owner,field,token)` binds an explicit semantic token at original text construction/assignment. For list rows, the field is the original `display_prop`. Tokens are `{kind="semantic",id=...,args={...}}` or explicitly external `{kind="external",value=...}`. Arguments distinguish external strings, finite numbers and nested text IDs. An original source-ID-aware `_t/:tformat`/constructor overlay must bind this provenance, including title/text updates. Looking up a rendered English sentence, globally replacing text, or labeling all game prose external is not supported.

Missing provenance appears as an explicit unresolved token. Rust rejects it with `error.ui.text`; missing/excess template parameters and missing IDs are also rejected. The reviewed supplemental catalogs retain original printf source strings. Their migration to named Rust templates needs a source-grounded conversion contract preserving each printf conversion, parameter order, markup, and meaning; those supplemental files are not silently treated as ready-to-render Rust templates. The current static shell has matching Japanese/English labels and Yes/No IDs, not complete original UI coverage.

## Full original view extraction increments

The current world snapshot is a trusted diagnostic and must not be promoted to the production map renderer. `map.seens[z]`, `infovs[z]`, `has_seens[z]`, `remembers[z]` and `lites[z]` represent different state; history/LOS alone never permits actor disclosure. Original visibility uses the current `Map.actor_player` and cached `player.can_see_cache[actor]["nil/nil"]` for ordinary sight and `["false/0"]` for the original ESP default context. An absent entry is unknown. Read these existing entries only; `canSee` can allocate, sample `rng.percent` and invoke `onSeen`. Original FOV also performs trap/ArcaneEye/party/combat updates and belongs in the original rules path.

For production, add source-owned emission of already chosen visible/remembered terrain, actor, stack, trap and overlay render commands from the original presentation preparation boundary. Preserve ordinary/ESP contexts and `_mo/onSeen` decisions. Feed copied image/resource handles, placement, tint, text tokens and animation observations to a Rust renderer; keep texture/filesystem/GPU adapters in the environment layer. Unknown policies must remain explicit gaps, not silently copied hidden actors.

Original `Game:display` schedules WASD work through `onTickEnd`, and `displayMap` may update FOV and sample shake RNG. Calling those functions from a supposedly pure view query is invalid. The new original redraw export is for faithful baseline comparison. Capture its effects/order against complete native RNG and state before deciding the production preparation boundary; repeated Rust render/locale/resize must replay immutable commands without additional native draw/rule/RNG calls.

The next concrete validation is an actual original `Dialog:yesnoPopup` projected with explicit title/body/Yes/No semantic tokens, accepted through its original Button callback, with original stack cleanup and native RNG/state purity checks for repeated queries. Then extend original Birther selection, inventory/list variants, targeting, talent allocation, rich text/markup, tooltips, character sheets and remaining audited UI classes. Save/resume must still use original native serializers and file graphs.

## Prepared checks, not executed under hold

Four new Rust tests cover UI shape/stale handles, original modal callback routing, semantic parameters/external names/pure text rendering, and UI transport without Actor mutation. The staged suite contains 18 Rust tests total, including 14 previously passing tests. The two new JavaScript test scripts cover native ABI ownership/one startup/no retry and actual Rust WASM with synthetic native lifecycle callbacks. No new test or build was executed in this followup. The existing WASM artifact is stale and must be refreshed by the parent before any host uses these UI kinds or labels.
