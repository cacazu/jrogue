# Source audit of invisible original menus

Parent's actual physical-input browser run opened original inventory, talents, quests and main-menu dialogs: native `dialog_count` became one and the readonly original Lua error queue remained empty. The screenshots under `native-core-work/physical-input-browser-probe/physical-*-desktop.png` do not show usable modal frames. I viewed the inventory screenshot and observed malformed thin triangles/lines in the map as well. Registration and callback dispatch are established; visible menu correctness is not.

This report and the additive candidate change only `rust-platform-input-work/audit-new`. No browser, native/generated source indexed by the live job was modified. No compile, test or runtime was launched by this agent.

## Actual original rendering path

| Source | Contract and finding |
| --- | --- |
| `native-core-work/native_browser_init.c:191–196` | Actual `tome_native_draw_baseline` calls `redraw_now(redraw_type_normal)`. The existing checkpoint gate excludes a save overlap. |
| Original `src/main.c:782–812` | `redraw_now` sets `current_redraw_type` and invokes original `on_redraw`. It does not bypass original Game display. |
| Original `src/main.c:710–780` | `on_redraw` computes native keyframe progress, clears, invokes `call_draw`, then swaps the original SDL GL window. A zero-keyframe-only explanation is **not** supported: this path accumulates progress and emits positive deltas. |
| Original `src/main.c:652–669` | `call_draw` invokes current original Game's `display`. It routes errors through `docall`; the parent's actual empty error queue rules out an observed Lua exception for these frames. |
| Original `mod/class/Game.lua:1942–1993` | Original module display draws its UI then calls `engine.GameTurnBased.display`, which inherits engine Game display. Full-FBO and tooltip paths remain effectful; startup uses the original safe-mode capability policy. |
| Original `engine/Game.lua:176–193` | Ordinary display walks the actual dialog stack and calls `d:display()` then `d:toScreen`. Dialogs are excluded when drawing a savefile screenshot. Baseline explicitly requests normal redraw, so source alone does not establish this exclusion as the cause. |
| Original `engine/ui/Dialog.lua:369–374,929–990` | Dialogs default to pop-progress two. `toScreen` translates to dialog center, optionally pushes/scales matrix, draws frame/title/components, and restores scale/translation. `__hidden` can suppress drawing, so a getter should inspect it. Source does not set every new dialog hidden. |
| Original `src/core_lua.c:2301–2316` | These presentation transforms call actual `glPushMatrix/glScalef/glPopMatrix/glTranslatef`. They have not been replaced by the Rust UI adapter. |
| `rust-kernel-adapter-work/lua/original-dialog-view.lua:67–101` | Current semantic projection recognizes only Button/Textzone/List and requires explicit provenance. Unsupported original menu trees are not rendered by the Rust dialog view. It does not suppress original `toScreen`. An unavailable Rust snapshot does not establish that native drawing succeeded. |

The original rendering implementation is present. The observed outcome requires verification below the registration layer and below Lua error checks. Do not declare these menus visible or campaign-ready from dialog counts alone.

## Concrete pinned SDK incompatibility

Installed SDK is Emscripten 6.0.8, using `src/lib/libglemu.js` through actual `-sLEGACY_GL_EMULATION=1` in `native-core-work/link_browser.py`.

Exact installed `libglemu.js` SHA256: `9e33abcedf6944fc5f4929c48246cead690ae2e2249ae9b3a5b28019af8bf349`. Root should verify this hash before compiling the candidate against a different SDK. This file is read from `C:/Users/kit/emsdk/upstream/emscripten/src/lib/libglemu.js`; no SDK file is modified.

1. Original `src/tgl.h:74–88` caches vertex/color/UV pointer addresses and suppresses repeated pointer calls when its descriptor appears unchanged. This is valid for desktop client arrays: a draw reads the bytes currently stored at those CPU addresses.
2. Original `src/core_lua.c` UI/texture routines create and rewrite small planar stack arrays, then submit `glVertexPointer/glColorPointer/glTexCoordPointer` and `glDrawArrays`. Concrete vertex slots include lines 1669–1674,1916–1921,2116–2121,2236–2241 and 2290–2295. Repeated calls can reuse the same stack addresses with different contents.
3. SDK `libglemu.js:2896–2909` returns early from `prepareClientAttributes` when `modifiedClientAttributes` is false. That updates the draw count but does not recopy planar source data.
4. Its planar/hybrid path at `libglemu.js:2955–2996` interleaves current CPU arrays into `restrideBuffer`, and **assigns each live attribute's `pointer` to a location in that temporary buffer**. Those descriptors alias `clientAttributes`, so their original source pointer is no longer present unless a subsequent real pointer call supplies it again.
5. SDK `libglemu.js:3504–3516` prepares and uploads `vertexData` for a draw from that resulting buffer. Correct matrix state and a successful texture upload cannot compensate for stale/corrupted vertex bytes.

This establishes a source-level client-array compatibility problem for retained original draw patterns. It is a plausible cause of the observed malformed quads and missing modal frame/text. Actual causation for the screenshots remains a hypothesis until the isolated candidate changes the real original result. No assertion that every rendering fault is explained by this one problem is made.

The swapped count comparisons in original `tgl.h` color/UV macros are also present, but they are upstream behavior and this candidate does not change them. They can cause one attribute to be resubmitted while others remain cached; that does not solve the SDK's mutated pointer problem.

## Minimal additive candidate

`tome_planar_client_array_refresh.c` wraps the actual SDK private `GLImmediate.prepareClientAttributes` at fresh startup. It preserves original C/Lua calls and arguments. For CPU client arrays outside begin/end it:

- Saves enabled attributes' original CPU pointer descriptors.
- Marks client attributes modified so the SDK recopies current bytes on each draw.
- Calls the exact original SDK implementation once.
- Restores only original input pointers afterwards, leaving the SDK's GPU-facing offsets/stride/temporary buffer/vertex pointer prepared for this draw.

Real GPU-array and begin/end paths call the original implementation unchanged. No texture, matrix, shader, event, timer, actor, dialog, rule or RNG replacement is introduced. This uses a private version-specific SDK implementation and is not a generic OpenGL fix.

Pointer restoration occurs **after preparation and before rendering**, deliberately. For this exact SDK, pointer consumers are source copies/offset construction at lines 2948,2981,2988,2992,3004 and the readonly pointer query at852. Renderer preparation at2599–2664 uses each attribute's `offset`; `glDrawArrays` at3512 uses the separate prepared `GLImmediate.vertexPointer` and its copied `vertexData`. Neither field is changed by the candidate. Thus restoring input `attr.pointer` after preparation preserves this draw's prepared GPU bytes while keeping original source pointers for the next draw. Delaying pointer restoration until after rendering is not required by these source consumers. Actual two-draw browser pixel/state verification is still mandatory; source analysis is not runtime proof.

For a separate parent-controlled physical variant only, compile this candidate along with the actual retained objects and unchanged adapters. Keep `-sLEGACY_GL_EMULATION=1`. Existing includes must provide Lua, `tome_main_platform.h` and `checkpoint_gate.h`; the physical profile provides `tome_physical_busy`.

Call actual `tome_planar_client_array_refresh_install()` after genuine native initialization and before original startup or first rendering. It additionally requires no current Game, no checkpoint/input transaction, and pristine SDK preparation state. Returns: `1` installed; `-1` absent/incompatible SDK private contract; `-2` busy; `-3` wrong/late stage; `-4` duplicate installation. Do not install mid-session to repair already mutated descriptors. Create a fresh original module.

`tome_planar_client_array_refresh_status()` returns copied borrowed JSON counters. It invokes no draw, pump, callback or RNG. Exceptions use diagnostic semantic ID `render.error.client_array_contract`; an integration must surface a localized failure and stop rather than hiding it. The candidate has not been compiled or run.

## Required next actual proof

First run a real-browser source-sized planar-array regression: keep the same native CPU pointers, mutate two quads' positions/UV/colors between draws, apply original translate/scale, and verify actual pixels for both draws. This must use the real compiled SDK and native GL calls. A JS recorder alone cannot establish correctness here.

Then fresh-boot original Japanese Game and reopen the four actual menus. Record actual top dialog bounds, `__hidden`, `__showup` and frame/title presence with getter-only raw fields. Capture screenshots while open and after original Escape. Confirm readable Japanese labels, correct frame/rows, original focus/selection and at least one meaningful original item/talent action; preserve the external player name. Inspect the GL error channel as an explicit diagnostic, separately from pure views, because `glGetError` consumes that channel.

If native frame remains absent, instrument original Game display/Dialog toScreen at their actual source slots before class inheritance, preserving each original call exactly once, and capture the original matrices/viewport/client-array descriptors and actual WebGL command boundary. Original `engine/class.lua:99–139` copies inherited methods for multiple bases; patching a base after classes have loaded is insufficient evidence that a probe ran. Do not add a guessed HTML modal or alter actors to make the screenshot pass.

Keep pure Rust repaint separate from the effectful original frame. Re-run state/RNG and checkpoint exclusion checks after any graphics integration. Existing mobile, text-input and complete Rust-renderer gaps remain; see `SDL-MOBILE-AUDIT.md` and `TEXT-IME-AUDIT.md`.
