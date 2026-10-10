# Installation timing and factory-specific widget shapes

Source-only followup using unchanged T-Engine/ToME 1.7.6. No code execution or projection modifications. `E:` denotes `game/engines/te4-1.7.6.teae`; `T:` denotes `game/modules/tome-1.7.6.team`. `inheritance-source-evidence.json` contains bounded original excerpts and full-member hashes.

## Minimum timing depends on the hook target

For a direct original `Dialog:yesnoPopup(...)` roundtrip, the projection factory wrapper can be installed **after `require("engine.ui.Dialog")` completes, before the first targeted popup call**. The concrete factory uses the actual global `game` when it registers (E:engine/ui/Dialog.lua164); construction requires initialized UI fonts/theme and a live game's dimensions/handlers/dialog stack. Requiring the module early is itself not inert: E:engine/ui/Base.lua33–39 creates native fonts at module load. Original ToME sets UI theme/font fields in T:mod/load.lua47–57, and the official Module loader calls `mod.load("init")`, `class:runInherited()`, then creates the game at E:engine/Module.lua1084–1086. Leave the original font/theme setup order intact; install the roundtrip before invoking the factory on the established game.

A **base-class registration wrapper** has an earlier deadline. E:engine/class.lua101–138 recursively copies non-skip fields into classes with multiple bases. `registerDialog` and `unregisterDialog` are not in `skip_key` (90), so T:mod/class/Game.lua62's four-base declaration caches those engine methods. Installing `engine.Game.registerDialog = wrapper` after `mod.class.Game` loads does not update its cached method. Either install the base wrapper before the `mod.class.Game` class declaration, or wrap the actual live `game.registerDialog`/`unregisterDialog` instance methods after construction and before the popup. A specific-game wrapper does not depend on propagating a change through already cached subclasses. If hooking game class `onRegisterDialog`, preserve ToME's own method at T:mod/class/Game.lua1996–2003 (tooltip reset, player shader, WASD reset).

Single-base classes instead use `setmetatable(c,{__index=bases[1]})` (E:engine/class.lua141); absent own methods can see later base-table updates. Multi-base classes can own cached copies. Thus install-time reasoning must use the actual receiver/method, not assume all descendants remain dynamically linked to the base.

## Internal module bindings and constructor interception

The engine overrides Lua `module`: E:engine/class.lua39–48 copies the module table fields into a separate environment and gives upstream declarations a proxy that writes both environment and module table. Outside writes to a loaded class table do not also write that preexisting environment.

Consequently, assigning `Dialog.new = wrapper` externally does **not** replace the original `yesnoPopup` function's unqualified `new` binding at E:engine/ui/Dialog.lua150. It retains the function captured in that module environment. A constructor-interception scheme relying solely on replacing exported `Dialog.new` will miss this path. Likewise, externally replacing a helper field does not rewrite already captured local function variables or cached inherited method copies.

The actual class constructor (E:engine/class.lua142–148) creates an object whose `__index` is class `c`, then dynamically evaluates `obj.init` and calls `obj:init(...)`. A correctly scoped wrapper on the actual `Dialog.init` class method can therefore see construction, even when the old module-local `new` is used. A factory wrapper plus exact-instance registration hook is another seam. Both must keep nested construction context/error restoration correct. This is static reachability evidence, not implementation or a tested recommendation for a particular projection module.

## Registration consumers see metadata immediately

E:engine/Game.lua420–429 inserts `d`, installs current key/mouse handlers, then calls `d:on_register()` (427) and `self:onRegisterDialog(d)` (428). To expose semantic metadata to those consumers, attach it before entering the retained original registration method. Metadata attached only after the old factory returns misses both callback slots. Wrapping only `d.on_register` also misses earlier consumers in a registration wrapper and must preserve any original callback; a construction-time role sidecar avoids that ambiguity.

The actual ToME game hooks at T:mod/class/Game.lua1996–2012 mutate tooltip/WASD/player shader state. The projection's registration hook must invoke them in the original lifecycle order, rather than replace them with a UI-only event.

## Exact original shapes are factory-specific

`loadUI` (E:engine/ui/Dialog.lua537–553) resets lists unless `no_reset` is set, appends input entries in `ipairs` order, and indexes `ui_by_ui` by the **actual widget object**. `setupUI` walks the same `self.uis` list in order (568 and627), rewrites layout dependencies/geometry (570–573,634–655,715–719), and may regenerate widgets for `calc_width`/`calc_height` (657–679). It does not reorder or replace the `uis` widget identities in this original method. Therefore the original short yes/no indices survive its `setupUI(true,true)` call.

| Factory | Original `d.uis` structure | Source |
| --- | --- | --- |
| `yesnoPopup` | 1 body Textzone; 2 yes Button; 3 no Button | 156–160 |
| `yesnoLongPopup` | 1 body Textzone; 2 yes Button; 3 no Button | 180–184 |
| `yesnocancelPopup` | 1 body Textzone; 2 yes; 3 no; 4 cancel | 202–207 |
| `yesnocancelLongPopup` | 1 body Textzone; 2 yes; 3 no; 4 cancel | 224–229 |
| `simplePopup` | 1 body; optional appended close Button at2; no close when `no_leave` | 113–119 (`no_reset=true` append) |
| `simpleLongPopup` | 1 body; optional appended close Button at2 | 135–140 |
| `listPopup` | 1 description; 2 Separator; 3 List; **not two Buttons** | 96–100 |
| `multiButtonPopup` | 1 body; following entries are the actually placed Buttons; creation capped at50, layout can cut off trailing rows | 266–319 |

All source line numbers in this table refer to E:engine/ui/Dialog.lua. Do not apply the short yes/no `2=yes,3=no` mapping to arbitrary Dialog instances, lists, or multiple-choice popups. The semantic factory marker must be attached during that named factory's construction. Use original local `ok`/`cancel` object identities as action targets; the numeric indices are verified structure for that factory, not a universal UI ABI.

Original `replaceUI` (725–734) can replace a widget in an existing slot, and a subsequent `loadUI` can reset the list. Before dispatching a projected handle, verify its retained object still matches the live factory role and dialog generation. Recompute rendered geometry after original setup; preserve semantic identity independently of coordinates and displayed labels.

No runtime roundtrip was executed here. Parent integration should verify installation reaches the actual live game receiver, metadata is present inside registration callbacks, and the projected role identities survive original setup while stale replacements are rejected.
