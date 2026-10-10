# Independent source-only review of the original yes/no candidate

No blocking source discrepancy was found in the four requested files. This conclusion is limited to static callback/identity/installation and obvious Lua/C API compatibility. No Lua was executed, C compiled, browser opened, or candidate source changed. Only this review file was written.

Reviewed revisions:

| File under `mechanics-audit-work/ui-roundtrip` | SHA256 |
| --- | --- |
| `original-yesno-roundtrip.lua` | `20c2684a04f9ad74b336397a7939c7f6167257481277ad3259b06392e3233887` |
| `install_at_original_game_require.lua` | `530595162a21a07c58fb62f814b82a6174a685cf3b1980708d498ef6d50404ff` |
| `generated/engine/ui/Dialog.lua` | `0f4f9ac6094ed48594c4c4dd1403c8e2e2c6b6d51e78a3e52a4cc417818db2ae` |
| `native_yesno_roundtrip.c` | `0749d137a532bf699836c6b7389d76cad9309cd5b05748e0727704478f621d7b` |

The original archived Dialog member was compared directly with the generated leaf using a text diff. Supporting source contracts are recorded in the prior audit notes/source-evidence files in this folder. The existing `rust-kernel-adapter-work/lua/original-dialog-view.lua`, native roundtrip header, generated diagnostic catalogue, and parent README were also read to resolve cross-file contracts.

## Original mechanics and construction identity

The generated factory at150–184 adds the optional ninth argument and provenance validation/binding. Original yes/no closures at165/166 and EXIT at167 retain the exact original callback sequence and values: optional preexit, original game unregister, then outcome; true/false/exact escape respectively. The original default escape remains nil. Measurement, original module-local `new`, original Textzone/Buttons, focus, setup, registration and returned instance remain in their original relative order. No replacement Dialog or geometry is introduced.

Provenance binds at178–181, before original registration183. The body uses the original first widget; yes/no use actual local Button identities. Original `setupUI` preserves the short factory's `body1/yes2/no3` object sequence, so binding after setup is consistent. The extension applies only to the named short yes/no factory; it does not apply those roles to another popup shape. Existing calls without the ninth argument bypass the metadata branch.

The diagnostic calls the genuine factory at `original-yesno-roundtrip.lua87–94`, passes raw original player.name into an explicitly external argument, and checks projected role shape at100–105. The existing adapter's `command` at106–127 locates the current top dialog by opaque identity, locates the actual live target widget, focuses it, and triggers that widget's original ACCEPT. This is the correct Button dispatch path; dialog ACCEPT is not substituted. EXIT uses the dialog's bound virtual with empty target.

`verify_closed` at131–141 proves one preexit and outcome, event order, removal between those callbacks, decision equality including nil, and restoration of the original stack identities. `verify_stale` at145–152 reaches the existing adapter's stale top-dialog guard before it can invoke a closed Button again. Its expected error text matches the actual adapter assertion at110. This matters because the original closures themselves are repeatable after unregister becomes a no-op.

## Installation and inherited methods

`install_at_original_game_require.lua` is consistent with the required deadline: it delegates installation on the returned original engine.Game class before ToME's multiple-base class copies registration methods. The delegate wraps that class's registration lifecycle, so the later cached copies contain the wrappers. It does not rely on replacing exported Dialog.new; that would miss the old module-environment binding. The generated leaf supplies metadata inside the retained original function instead.

The function alone cannot establish when its owner calls it. The parent's loader must actually invoke it at the first completed engine.Game require, before capturing registration for birth automation and before mod.class.Game inheritance. The generated Dialog leaf must already be mounted before first engine.ui.Dialog require. Marker assertions reject the unextended cached Dialog class. A preexisting `__TOME_WEB_UI` is accepted by protocol/functions rather than reinstalling; this assumes it belongs to the same correctly installed original VM/class lifecycle, as the README states.

The original engine/UI module initialization order is otherwise important: early loading of UI Base allocates fonts; ToME font/theme changes and runInherited must remain in the retained original loader sequence. The candidate neither fabricates fonts nor claims that Japanese native layout has passed.

## Lua and C compatibility observations

The Lua uses Lua 5.1-compatible constructs and the existing adapter's actual function signatures. The generated diagnostic catalogue is mounted to the path the helper loads; all four identifiers and the sole character_name placeholder agree with the construction tokens. Formatting is performed only at construction. Returning an external name from the gsub function does not recursively scan its bytes as further placeholders. Diagnostic callback values use explicit strings `true`, `false`, `nil`, preserving default nil rather than collapsing it to false.

The C uses the retained same-VM accessor, Lua 5.1 APIs, and protected calls for module loading/method execution. `finish` restores the saved Lua stack and clears its own busy guard on its handled success/error/allocation paths. It copies successful Lua strings to a separate owned C buffer before restoring the Lua stack. Missing module/method errors place a string on the stack for the same finish path. Invalid locale/expectation returns before entering the VM. No second VM, game, or native event loop is created.

Its borrowed response lifetime and own-only reentry guard agree with the header/README: the host must copy returned bytes immediately and serialize calls across all original native exports. ABI/link/export wiring is not established by this review and remains a runtime/build check for the parent.

## Handler checks and pending acceptance

The latest diagnostic source addresses the initial handler-observation gap: canonical Key/Mouse class imports at9–10; read-only baseline identity capture at70–71; preexit/outcome ownership observations at79–80; open ownership assertion at96; copied event flags at119; read-only current/baseline status comparisons at127–128; and callback transfer/baseline restoration assertions at137/140. These accesses match the original defining-module fields below. No observer invokes `setCurrent` or `isEnabled`, samples time/RNG, or writes the original handler fields. No blocking source issue was found in those additions.

Actual handler restoration is still a runtime acceptance check; these assertions were only read. Arbitrary widget cleanup callback execution remains separately unobserved by the diagnostic. The generated diff retains original unregister, whose source calls cleanup/unload and restores handlers, so no source regression was found in that lifecycle path.

Open failure is terminal for that diagnostic attempt: the helper sets its current record before invoking the factory, and a failed construction/projection cannot be retried through open unless the original outcome completed. This is explicitly documented in README53; it is not silently treated as a recoverable retry. If failure occurs after registration, inspect the original stack and do not dispatch again after an ambiguous native callback failure.

Pending parent checks: actual loader/mount deadline; original-VM linkage; yes/no/default-nil EXIT callbacks; registration-time metadata visibility; cleanup/current-handler restoration; stale handles; repeated snapshot domain/RNG invariance; Rust Japanese/English rendering and actual PC/mobile input/CJK layout. Static review does not mark those checks passed.

## Followup: exact read-only key/mouse ownership fields

The canonical key owner is **`engine.Key.current`**. `engine.KeyBind` inherits `engine.KeyCommand`, which inherits `engine.Key`; the retained `setCurrent` method is defined in `engine.Key`, and its `_M.current` assignment writes that defining module. `engine.KeyCommand.current` may be readable through single-base inheritance, but `rawget(engine.KeyCommand,"current")` is not the defining owner. Use the canonical class field explicitly.

The canonical mouse owner is **`engine.Mouse.current`**. Both fields are Lua ownership mirrors assigned immediately after the corresponding original native `set_current_handler` call. They are not a separate native getter API, but reading them observes the original retained ownership path without installing wrappers or invoking input methods.

Suitable observations in the current original VM, using already loaded class tables:

```lua
local Key = require "engine.Key"
local Mouse = require "engine.Mouse"
local before_key = rawget(Key, "current")
local before_mouse = rawget(Mouse, "current")
-- After the original popup factory returns its registered d:
local popup_has_handlers = rawget(Key, "current") == d.key
    and rawget(Mouse, "current") == d.mouse
-- After the retained original callback closes it:
local handlers_restored = rawget(Key, "current") == before_key
    and rawget(Mouse, "current") == before_mouse
```

Capture the baseline before opening and retain those actual object references only in the diagnostic record. In the helper's empty-stack precondition, the original unregister path restores `game.key`/`game.mouse`; an established baseline should agree with those. Keep status observation read-only. Do not call `key:isEnabled()` merely to observe ownership: E:engine/Key.lua33–41 reads time, can log, and clears `disable_until` on expiry. Requiring these classes at this already initialized boundary uses their existing cached tables; it need not create new handlers.

The following excerpts were read directly from `game/engines/te4-1.7.6.teae`; hashes cover the full original member bytes. `handler-source-evidence.json` provides the same four members in the existing members/excerpts schema, including Key.isEnabled33–42 to distinguish mutating input-gate methods from field reads.

| Member | SHA256 |
| --- | --- |
| `engine/KeyBind.lua` | `6a3d97f0d9ccf67585621a582ff7d79ef28db20714587c8c8ec8eb28a93dbd30` |
| `engine/KeyCommand.lua` | `8bb31b4d99eef99a7ea2f43a8cb14edfc1f8a85368964a5dd08077e3dabe1eaf` |
| `engine/Key.lua` | `6b941ea075e35bb0794dc58cc4ce0b9d1de2950203bc2b96e2f36bd00071794c` |
| `engine/Mouse.lua` | `e0735962e4ddc0d15bfb732a4640bbee813933adb9a44222bd0930f1fc1f5ccd` |

```lua
-- engine/KeyBind.lua:20–26
require "config"
require "engine.class"
require "engine.KeyCommand"

--- Handles key binds to "virtual" actions
-- @classmod engine.KeyBind
module(..., package.seeall, class.inherit(engine.KeyCommand))

-- engine/KeyCommand.lua:20–26
require "config"
require "engine.class"
require "engine.Key"

--- Receives keypresses and acts upon them
-- @classmod engine.KeyCommand
module(..., package.seeall, class.inherit(engine.Key))

-- engine/Key.lua:89–94
--- Setup as the current game keyhandler
function _M:setCurrent()
	core.key.set_current_handler(self)
--	if game then game.key = self end
	_M.current = self
end

-- engine/Mouse.lua:117–122
--- Setups as the current game keyhandler
function _M:setCurrent()
	core.mouse.set_current_handler(self)
--	if game then game.mouse = self end
	_M.current = self
end
```

These source observations make handler-restoration checks possible without additional runtime interception. They do not by themselves prove arbitrary widget cleanup callbacks ran; that remains distinct from handler restoration.
