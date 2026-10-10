# Original yes/no dialog roundtrip candidate

This source-only increment prepares one real original dialog for Rust UI projection/input. It has not run in Lua, native C, Rust, or a browser. It is an integration diagnostic that calls the original `engine.ui.Dialog:yesnoPopup`, with the current original born player and original game stack. It does not supply replacement dialog/game objects, geometry, keys, rules, or RNG. It is not the full game UI and must not be published as a complete game.

## Exact original boundary

The factory is `engine/ui/Dialog.lua:148–166`, not a separate YesNo class. It constructs the original Textzone and Buttons, calls original `loadUI`, focuses Yes, calls `setupUI`, registers the dialog, and returns its identity. `setupUI` preserves the three widget identities/order. `Button.lua:65` binds ACCEPT; dialog ACCEPT is not bound. The original factory's closures execute `preexit(value) → game:unregisterDialog(d) → fct(value)`. Yes is `true`, No is `false`, and the default EXIT value is `nil`.

`make_dialog_metadata_overlay.py` verifies the pristine member hash and adds an optional ninth argument only to this factory. Existing callers pass no argument and follow all original lines unchanged. Four explicit role tokens attach to the actual title/Textzone/Buttons immediately before original registration. Hooks observing registration therefore see construction provenance. The extension does not search rendered English or alter another popup factory. Byte reversal restores the original full member, including its license. The generated leaf is 37,976 bytes with SHA256 `0f4f9ac6094ed48594c4c4dd1403c8e2e2c6b6d51e78a3e52a4cc417818db2ae`.

`en.json` and `ja.json` contain four new diagnostic text IDs. The body uses `{character_name}`, bound to raw original `player.name` as an external parameter. Names are never translated. The generated small Lua catalog renders only these explicitly selected templates; returned external bytes are not rescanned. Merge the same four entries into the Rust presentation catalog before displaying the projected dialog. These entries do not represent existing game-text coverage.

## Installation in the current original VM

The parent owns mounting, loader changes, native linking, runtime scheduling and execution. Add exactly these leaves to its explicit mounted-file manifest; keep other Game/FOV opt-in overlays disabled:

| Local source | Mounted path |
|---|---|
| `generated/engine/ui/Dialog.lua` | A separately mounted engine overlay at `/engine/ui/Dialog.lua` |
| `install_at_original_game_require.lua` | `/adapter/install_at_original_game_require.lua` |
| `original-yesno-roundtrip.lua` | `/adapter/original-yesno-roundtrip.lua` |
| `generated/ui-roundtrip-catalog.lua` | `/adapter/ui-roundtrip-catalog.lua` |
| Existing `rust-kernel-adapter-work/lua/original-dialog-view.lua` | `/adapter/original-dialog-view.lua` |

Mount the exact Dialog leaf before the **first** `require("engine.ui.Dialog")`; reject an already cached unextended class. The generator also provides `transform(bytes, exact_upstream=False)`/`--input` for parent-composed source transforms while checking exact factory anchors and reversible input preservation. It must be composed rather than replacing an independent semantic source overlay.

At the existing driver `engine.Game` require hook, immediately after `original_require(module_name)` returns and before capturing `result.registerDialog` for birth automation, call:

```lua
local install_ui = assert(loadfile("/adapter/install_at_original_game_require.lua"))()
install_ui(result, original_require)
```

Install before `mod.class.Game` inherits engine.Game. Original `engine.class.inherit` caches multiple-inheritance methods, so patching the base after `mod.class.Game` loads misses its cached registration functions. Replacing exported `Dialog.new` also misses the original factory's captured module-environment `new` binding. This candidate uses neither late assumption. The early installation function delegates to the existing original UI adapter, reuses an already installed compatible adapter, and does not load another game/loader.

Link `native_yesno_roundtrip.c` together with existing `native_ui_exports.c` and retained native main accessors. Export these six symbols in the parent Emscripten target:

```text
tome_native_ui_roundtrip_install
tome_native_ui_roundtrip_open
tome_native_ui_roundtrip_status
tome_native_ui_roundtrip_verify_closed
tome_native_ui_roundtrip_verify_stale
tome_native_ui_roundtrip_last_error
```

The additive C candidate uses `tome_main_get_state()` and protected calls in that current original VM. It creates no VM or game. It restores the original Lua stack on every path and queries same-VM module ownership each time rather than retaining borrowed table pointers. A NULL response is failure; read its own last-error export then. Successful JSON is one C-owned buffer valid until the next successful **roundtrip** export, separate from the existing UI response buffer. Host copies it immediately and never frees it. Host must serialize all native UI/game calls; the candidate's own reentry guard does not coordinate other native exports. New/rebooted original VMs need early UI installation and roundtrip installation again.

## Parent's actual runtime acceptance sequence

After the real original birth completes and the original stack is empty:

1. Call roundtrip `install`, then `open("ja")`. Neither call drives a simulation tick. Open invokes the genuine original factory and allocates real native UI resources through the original classes. Failure is terminal for that attempt: inspect the actual stack/status and do not automatically repeat open.
2. Read existing `tome_native_ui_snapshot`. Require a live top original Dialog, real finite bounds, three real components, title/body/Yes/No semantic IDs, and the exact external original name in the body token. The returned roundtrip status contains the actual opaque dialog/Yes/No handles captured from that original snapshot; it is a separate diagnostic JSON shape, not a Rust `UiSnapshot` packet.
3. Copy all three native RNG components and actual core snapshot before and after repeated UI snapshot queries. They must match. Also compare callback counters and original stack identities; queries must not allocate IDs, focus, generate fonts, call `isEnabled`, sample time or RNG, or advance ticks. The diagnostic status itself only reads adapter observations and stack identity.
4. Respect original `disable_until` input gates. If a command is temporarily disabled, await the real gate and then issue it once. Do not zero an original field, manufacture time, bypass `isEnabled`, or retry a callback after ambiguous native failure.
5. For Yes, use existing `tome_native_ui_command(dialog_handle, yes_handle, "ACCEPT")`. This routes through the original Button KeyBind and factory closures. Require `verify_closed("true")`: exactly one preexit and one outcome, original dialog present during preexit, absent during outcome, and the original stack restored. The diagnostic also observes canonical read-only `engine.Key.current` and `engine.Mouse.current`: original registration must own them, and original unregister must restore the exact baseline handler identities before outcome. It calls no `setCurrent`/`isEnabled` for observation. Cleanup/unload and any custom cleanup hooks remain original and require actual runtime verification.
6. Run `verify_stale()` after closure. It attempts the same real handle through the existing adapter's live-stack guard, expects a stale-handle failure, and requires unchanged callback counts/stack. Original factory closures themselves lack one-shot guards; the bridge must reject stale input before them.
7. Separate new opens may test No with its actual Button ACCEPT and `verify_closed("false")`, and EXIT with empty target plus `verify_closed("nil")`. Preserve nil vs false. Each attempt uses a new real factory dialog and real handles. Repeated opens are allowed only after the original prior outcome completed once.
8. Parent then tests Rust JA/EN rendering, mouse/touch controls that dispatch the same typed original actions, default Japanese, and actual native CJK font/layout behavior. Fonts and other widgets remain concrete coverage gaps; do not infer their validity from these source checks.

The narrow module records its callback observations in adapter-owned locals, never on the save/game/player graph. It does not clear dialogs directly or reconstruct state. No profile, shop, online purchase, external-message, billing, save, or credential action is exercised by this diagnostic popup. Full production pure map rendering remains pending and no generic redraw has been moved to the visual RNG bank.

## Source validation and limits

`validate_ui_roundtrip_sources.py` checks source hashes and excerpt correspondence, exact reversible original overlay, matching four EN/JA keys and placeholders, original factory/VM references, and native symbol/stack-return structure. `source-validation.json` records those checks and deliverable hashes. These checks do not parse or execute Lua, compile C, validate the native ABI at runtime, prove projection purity, or establish PC/mobile accessibility. The parent must perform the actual sequence above before treating this dialog milestone as tested.
