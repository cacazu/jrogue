# Retained ToME C/Lua core adapters

This workspace stages Rust input, display, and environment adapters for the original ToME 1.7.6 C/Lua runtime. The original runtime owns actors, all gameplay rules, turn progression, RNG, map/FOV state, class graphs, userdata, and savefiles. Rust holds only copied observations and transport/UI state. The earlier Rust scalar-rule workbench is a separate reference test harness and is not a dependency of these crates.

| Boundary | Owner | Files |
| --- | --- | --- |
| Gameplay | Original C/Lua | Pristine upstream and retained native bindings; no replacement here |
| Projection contract | Rust/Lua adapter seam | `contracts/src/lib.rs`, agreed with `bootstrap-work/real-core-probe.lua` |
| Browser input | Rust | `input/src/lib.rs` maps original arrow/keypad defaults to original `MOVE_*` virtual actions |
| Display | Rust | `display/src/lib.rs` renders immutable projections; Japanese UI default |
| Environment | Rust + browser host | `environment/src/lib.rs`, `browser/retained-core-adapter.mjs` |

The Lua seam exposes `__TOME_WEB.snapshot_json()` and `__TOME_WEB.command_json(original_virtual_key)`. The latter delegates to the original `game.key:triggerVirtual` and original `game:tick`, returning a before/after observation. Rust does not execute those operations. Native seed initialization stays in the original driver. The caller supplies callbacks that invoke these functions through the actual native runtime; C export names and memory-copy ownership stay outside this reusable adapter.

## Protocol and source mapping

Protocol 1 snapshots are `{protocol, ready, game?}`. The game projection contains optional original `turn`, `paused`, `player`, and `level` records so original bootstrap/birth may remain incomplete. Ready is supplied by the original birth hook and requires an original player and map. Map cells are zero-indexed row-major and retain separate terrain, actor, object, and trap layers. Rust verifies schema/topology/finite numbers without changing values.

| Projected field/action | Original source |
| --- | --- |
| Actor `uid/name/x/y/level/energy.value/energy.mod` | `engine.Entity`, `engine.Actor` |
| Actor `life/max_life/energyBase/dead` | `mod.class.Actor` and original actor interfaces |
| Entity `display/color_r/color_g/color_b` | `engine.Entity:init` |
| Map `w/h/map/seens/remembers` and layer identities | `engine.Map` |
| `MOVE_*`, `MOVE_STAY` | `data/keybinds/move.lua`; `mod.class.Game:setupCommands` bindings |
| `ATTACK_OR_MOVE_*` | Original `mod.class.Game` bindings |

Command results are `{protocol:1, command:"MOVE_...", ticks, before, after}`. The adapter checks that the action matches the pending call, then caches the original after observation. Invalid/native failures clear transport pending state without retrying, rolling back, or fabricating gameplay. A subsequent snapshot can inspect the still-owned original runtime.

The diagnostic Lua projection currently omits unseen actors/objects/traps, but it is not a complete invisibility/ESP policy. Production rendering must preserve the original caches and display behavior. Dialogs, complete action routing, full original text-ID integration, and original save/load invocation remain separate integration work. These adapter snapshots cannot be imported as native savefiles.

The new source-only browser lifecycle wiring is described in `BROWSER-INTEGRATION.md`. The separately staged original dialog/component projection, Rust rendering/input and optional native UI exports are described in `UI-PROJECTION.md`. Those additions have not yet been built, tested or linked into the actual original runtime; the existing WASM artifact must be rebuilt. They extend the same mailbox with UI kinds 3/4 while retaining original native callback ownership.

## WASM host use

Build `tome-core-environment` for `wasm32-unknown-unknown` and instantiate it without imports. The safe byte mailbox has no Rust pointers or foreign-memory references. All exports use the `tome_adapter_` prefix. Input reset/byte/request exports receive UI JSON; pending kind/length/byte exports supply a native call. Kind 1 requests a snapshot; kind 2 supplies UTF-8 bytes of the original action ID. Core-result receives the copied native JSON reply; core-failed reports an original runtime failure. Output length/byte exports return UI JSON with `handled`, `error_id`, and a localized read-only view.

```js
import { RetainedCoreAdapter, keyInput } from './browser/retained-core-adapter.mjs';

const adapter = new RetainedCoreAdapter(rustInstance.exports, {
  snapshotJson: () => nativeRuntime.snapshotJson(),
  commandJson: key => nativeRuntime.commandJson(key),
});
adapter.request({ op: 'snapshot' });
draw(await adapter.fulfill());

window.addEventListener('keydown', async event => {
  const response = adapter.request({ op: 'key', input: keyInput(event) });
  if (response.handled) event.preventDefault();
  draw(await adapter.fulfill());
});
```

View and locale requests make no native call. Browser touch controls submit actual virtual IDs, for example `{op:"touch",key:"MOVE_STAY"}`. The browser host owns storage/audio/network adaptation and native memory lifetimes; this module supplies none of those gameplay effects. Arrow/keypad mapping preserves original defaults; `.` is original RUN and is not silently remapped to wait. Text entry, IME, repeated keys, and modifiers remain unhandled.

## Validation

Run `cargo test --offline`, `cargo clippy --offline --all-targets -- -D warnings`, and build the release WASM target. Run `node browser/bridge.test.mjs` against the compiled WASM artifact. Native unit tests and the actual WASM ABI test exercise protocol fixtures and transport replay, not native gameplay. Real original boot/birth/command/save/browser proof must be provided by the retained C/Lua integration separately.
