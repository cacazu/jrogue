# Real original Dialog/Textbox/UIGroup fixture API review

Source-only independent review. No generation, Lua execution, build, test, native dispatch, browser, or live implementation modification. Parent owns the additive native observer, fixture and generator. A fixture may register its own real presentation dialog; it must not modify a player/name/actor graph to manufacture evidence.

## Source identity

ToME 1.7.6, tag `tome-1.7.6`, source commit `624a67329fe2ad440c5b344785a9c73fcf22ae63`.

Original Lua root: `C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\unpacked\game\engines\default\engine`. Original C root: `C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6\src`.

Read SHA-256s:

| Source relative to original engine | SHA-256 |
| --- | --- |
| `ui/Dialog.lua` | `c1fc95e83d7031073324d43fbdcfaef6a6cc1ace8bbd7cdb7ae31adaa3be60bd` |
| `ui/Textbox.lua` | `9d02393e88f968edcec308bd2fd6870d9dce8c7e0a6c326d3ed212759c233dda` |
| `ui/UIGroup.lua` | `d2c9aa3c96856b6012fefc3955899737f7b3297963931694d6c98baef2b95da2` |
| `ui/Base.lua` | `e01ba9e9d24f9dc53c63d61c4f51168b5a745c21cb10f721199674bb9c29c85d` |
| `ui/Focusable.lua` | `7a2360feace84c0dfaeeb8ddde508aaecda3009f71af9cef99d8ee9b8be9bccc` |
| `ui/WithTitle.lua` | `d38c31beb8840a38f8932d08ce246bede2208f048dc2444022f4153b76ca938a` |
| `Game.lua` | `7c8c458c142289fe8b4e59e5c16376303f9a10d34e858fabc48d84c6aa04e523` |
| `KeyBind.lua` | `6a3d97f0d9ccf67585621a582ff7d79ef28db20714587c8c8ec8eb28a93dbd30` |
| `KeyCommand.lua` | `8bb31b4d99eef99a7ea2f43a8cb14edfc1f8a85368964a5dd08077e3dabe1eaf` |
| `class.lua` | `e65f81d273090e02c29855d1d5b0b0452878399f7d6a8bd024ef3ec6fc498928` |
| `utils.lua` | `871f7ae2d26266751811d9249e4525b5b0f9d8c88b35272755d7a617885c2bbf` |
| `../data/keybinds/actions.lua` | `013b30e3cffaaaf9fda44c61a029324b483340d5b025d3837485a8580ee55af2` |

Frozen `rust-platform-input-work/native/physical_input.c` read hash: `83364976d5858620be91d057a0cdb6909e5a121074c10e860b9f0cc92410e209`. This is a derivative seam, not upstream.

## Exact original constructor and layout APIs

`Dialog.new(title,w,h,x,y,alpha,font,showup,skin)` dispatches `Dialog:init` at lines 359–445 through original class.new (class.lua:142–148). The initializer prepares actual skin/frame state, starts empty `uis`, `ui_by_ui` and focus wrappers at 432–435, calls `Base.init(self,{},true)` at 442, then `self:resize(w,h,true)` at 444. Initial width/height are real positive layout inputs; `resize` floors them and centers the dialog using `core.display.size` (447–458). Do not infer that every positional init argument changes fonts: the inspected body initializes Base with an empty table.

`Textbox.new{title=...,text=...,chars=...,fct=function(text)...,max_len=...,on_change=function(text)...,hide=...,filter=...}`:

- Textbox.lua:29 defaults text to an empty string and line 30 stores old_text.
- Lines 34–37 default max_len to 999, require fct and chars, and default the filter to identity.
- Lines 39–42 are original byte storage; the separate guarded overlay changes these to scalar entries. Overlay modules must load before dependent classes are cached.
- Line 44 invokes WithTitle.init. WithTitle.lua:28–33 sets title/size_title and invokes real Base.init.
- Base.lua:87–107 creates real engine.Mouse and engine.KeyBind instances, then invokes the actual generate method.
- Textbox.generate:58–77 computes its input frame using native font metrics, chars and mono width, records max_display, and draws actual input text via updateText.

Layout is `dialog:loadUI{{left=0,top=0,ui=box},...}` then `dialog:setupUI(true,true)` (or reviewed fixed-size alternatives). `loadUI:537–553` stores the wrapper and reverse lookup, focuses its first can_focus child, and calls setFocus(false) on subsequent focusable children. `setupUI:556–723` derives sizes from genuine children, calls resize/generate, calculates real wrapper x/y, writes each child mouse.delegate_offset_x/y at 717–718, and invokes original child:positioned at 719. The resulting pixel origin is dialog.display_x/y plus actual wrapper.x/y; do not invent a mouse offset from requested input dimensions.

`dialog:setFocus(box)` resolves the actual wrapper by object identity (736–751). It first releases old focus, stores focus_ui and focus_ui_id, calls genuine child:setFocus(true), then dialog:on_focus. The numeric id must name an existing wrapper: the original method does not guard a nil ui before dereferencing ui.ui. Avoid invalid fixture ids rather than globally changing the original API.

Original `Game:display:177–189` calls registered dialog:display and dialog:toScreen. Dialog.display at 829 is an empty hook, whereas Dialog.toScreen:929–984 applies popup transforms, draws original frame/title, and calls each actual child's display. A real fixture should use that original game display path, not claim that manually invoking the empty hook rendered its controls. Pass the source-supported showup argument or let the original popup animation settle before pointer/pixel assertions.

## UIGroup is a mixin, not a ready textbox container

UIGroup.lua:24 uses class.make. It has setInnerFocus, moveFocus and on_focus_change, but no widget constructor, layout, rendering or keyboard forwarding. `UIGroup.new()` alone therefore does not create a complete Base/Mouse/KeyBind presentation widget.

Actual original container classes Inventory, EquipDoll and Tabs inherit `Base,Focusable,UIGroup`. Tabs.lua:31–61 creates its own Tab children from title/kind definitions; it is not an arbitrary textbox-content container. Do not pass a textbox as a Tabs definition and assume it becomes the nested child.

A narrowly authored fixture container may compose genuine original Base, Focusable and UIGroup, create a real child wrapper, use UIGroup:setInnerFocus, and provide explicit forwarding/render/mouse methods. Label that container as fixture code, not an original ready-made widget. Original class.inherit:100–137 applies bases from first to last, with later bases replacing earlier shared keys. Consequently `Base,Focusable,UIGroup` preserves UIGroup:on_focus_change rather than Focusable's empty hook.

UIGroup:setInnerFocus:26–42 sets actual focus_ui to an existing `{ui=child,...}` wrapper, calls child:setFocus(true), then on_focus. UIGroup:on_focus_change:59–60 forwards group focus state to the focused original child. Focusable.lua:31–36 sets the focused Boolean, dispatches changed-status hook, then invokes on_focus even when the value is unchanged. Textbox.on_focus:47–49 schedules `self.key:unicodeInput(v)` at game:onTickEnd. This creates real original scheduled presentation work; settle it through the retained original tick path, never a mock immediate scheduler.

Nested container keyboard forwarding must use the original pattern, not replace the global current handler with the leaf. Dialog.generate:512 overrides its own key.receiveKey to route to dialog:keyEvent; Dialog.keyEvent:824–827 invokes focus_ui.ui.key:receiveKey first and falls back to genuine KeyBind.receiveKey. Original Inventory.keyEvent:211–213 supplies the same reviewed return-propagating pattern for a nested container. The nested group needs that actual forwarding path. Its Mouse must delegate to the real child using reviewed offsets; its display must call the real child display and preserve original coordinates.

## Register, ACCEPT, ESCAPE and close

Use `game:registerDialog(dialog)`: Game.lua:420–428 inserts into the actual numeric dialog stack and reverse map, sets stack id, makes dialog's real key and mouse handlers current, and runs original registration hooks. Key.lua:90–93 makes the C current handler through core.key.set_current_handler; do not fake that registry binding.

Textbox.generate:92 binds virtual ACCEPT to `self.fct(self.text)`. Lines 93–96 ignore ESCAPE, TAB, UP and DOWN at the textbox, permitting unhandled key fallback to its genuine parent. The default data/keybinds/actions.lua:118–119 maps unmodified RETURN and KP_ENTER to ACCEPT; 125–126 maps unmodified ESCAPE to virtual EXIT. Saved remappings may alter actual physical keys, so observe active bindings before claiming universal default shortcuts.

Dialog itself has no automatic EXIT callback in this constructor/generate path. A fixture must explicitly add `dialog.key:addBind("EXIT",function() game:unregisterDialog(dialog) end)` or its own reviewed record-and-close callback. Actual textbox fct may record the exact accepted external bytes in fixture-owned state and close via the same actual unregister API. Record callback values/counts without modifying an actor/player name.

`game:unregisterDialog(dialog)`, Game.lua:470–483, verifies membership, removes the actual dialog/reverse map, invokes dialog:cleanup then unload, updates stack positions, restores the prior top-dialog or game's original key/mouse handlers, invokes onUnregisterDialog, then on_recover_focus. Dialog.cleanup:835–841 destroys display particles and runs child cleanup hooks. Do not directly table.remove dialogs or set a surrogate handler. Do not force-clear Unicode flags merely to mimic cleanup: original unregister restores handlers without calling each departed textbox setFocus(false); status should observe actual remaining ownership.

## Actual text callback storage and native Unicode seam

Real KeyCommand.addCommand:113–117 recognizes __TEXTINPUT and delegates to setTextInput. It does not store this callback in `key.commands.__TEXTINPUT` like the earlier bounded fixture's test double. Actual KeyCommand.receiveKey:71–72 invokes `key.on_input(unicode)`. KeyBind.receiveKey:214–216 rejects Unicode unless this genuine receiving handler's use_unicode is true, then falls through to real KeyCommand dispatch. Native original main.c:319–350 passes entire SDL_TEXTINPUT text to Lua as the Unicode argument, not fabricated per-keydown characters. Real fixture evidence must come through SDL/original routing and real on_input, not the doubled command-table API.

KeyBind.lua:121 initializes use_unicode false; unicodeInput:252–253 only sets that Boolean. Game:onTickEnd:342–352 schedules the focus work and requests an original next tick. Game:onTickEndExecute:321–335 drains the actual queue and can reschedule entries. Observe only after that scheduled work settles; native physical status already exports tick_end_pending for this purpose.

Frozen physical_input.c:52–74 has a concrete nested-focus limitation: it traverses only current_game.dialogs[last].focus_ui.ui.key.use_unicode. For Dialog -> genuine UIGroup container -> Textbox, that returns the group key's default false/unknown, not the leaf's true flag. handler_unicode:46–50 separately observes actual current_keyhandler.use_unicode, which is typically the dialog key and is also insufficient. The additive native observer must recursively follow actual raw focus_ui.ui links with cycle/depth/type guards and report the focused leaf's real key Boolean separately from its original focused state. Do not infer focus from classname, dialog title, actor fields or inferred browser state. The new helper projection is currently additive; it does not integrate itself into frozen status.

Readonly observations must restore Lua stack height, avoid Lua callbacks/metamethods, and copy returned C JSON immediately. They allocate/write observer scratch and Lua stack; run them outside the synchronous independent Rust/native-heap purity bracket.

## Font and iterator readiness

Base.lua:33–38 loads actual native `/data/font/DroidSans.ttf`, `DroidSansMono.ttf` and `DroidSans-Bold.ttf`; input/caret use font_mono. Base.init:93–100 changes only self.font when t.font is supplied; supplying a Japanese title font does not replace self.font_mono or establish Japanese textbox coverage.

Original core_lua.c:695–716 loads fonts through actual PhysFS and TTF_OpenFontRW with errors on missing/invalid fonts. `font:size`, 727–739, uses TTF_SizeUTF8; drawing uses TTF_RenderUTF8_Blended. The inspected Lua font API has no demonstrated automatic CJK fallback or glyph-coverage getter. Positive Japanese width can also describe missing-glyph boxes. Establish the actual mono font source/license/cmap or actual distinct native glyph pixels before claiming rendered Japanese support; retain original fonts unless a separate explicitly reviewed local font adapter is applied.

Actual helper readiness is `string.nextUTF = core.display.stringNextUTF` at utils.lua:906 and string.iterateUTF at 1020–1035. Original C stringNextUTF at core_lua.c:966–976 delegates to utf8proc and consumes one byte on malformed sequences. Candidate strict validation must precede the real iterator. Require real native helper identity, valid Japanese/mixed external bytes, exact boundaries and nonempty iteration termination; do not invent a substitute iterator to make native evidence pass. Empty strings need the separate guard already audited.

## Remaining evidence, owned by the implementing parent

No validation was executed here. Required next evidence is a fresh isolated native VM with exact guarded overlay module routes; real original registered dialog and genuine nested focus wrappers; scheduled focus settlement; actual native font pixels/caret; Japanese and mixed external-name bytes through SDL commit, middle insertion/delete, paste once, scalar limit and canceled composition; original ACCEPT value and ESCAPE closure/restored handler; readonly before/after player/RNG evidence proving the fixture did not rewrite gameplay state. Actual rendering/input integration remains a blocker to any complete native-UI claim.

## Actual existing font userdata and BMP glyph probe addendum

The current original native font userdata has a precise pointer representation, not a serialized font struct. `core_lua.c:700` allocates `TTF_Font **f = (TTF_Font**)lua_newuserdata(L,sizeof(TTF_Font*))`; line 701 assigns metatable class `sdl{font}`; line 709 stores the actual `TTF_OpenFontRW` result in `*f`. Existing size binding at 729 checks that class then dereferences the contained pointer. The observer must obtain the genuine resolved Textbox.font_mono value, including original inherited class-table resolution where applicable; a rawget on the widget alone may miss its inherited font. Never substitute Base.font_mono blindly if an instance/class-specific mono font override exists.

The nonthrowing classification contract needs care: original `src/auxiliar.c:147–149`, auxiliar_getclassudata, calls `luaL_checkudata` and can throw, despite an earlier NULL-return comment. auxiliar_checkclass:92–98 additionally raises luaL_argerror. For a structured readonly native observation, explicitly check `lua_type(...) == LUA_TUSERDATA`, `lua_objlen(...) == sizeof(TTF_Font*)`, and equality of the userdata's actual metatable with the registry's `sdl{font}` metatable using lua_rawequal. Only after those checks obtain lua_touserdata as TTF_Font** and require nonnull *f. Restore the original stack on every return. Use reviewed raw table/metatable traversal for inherited font fields; reject unknown function-based lookup rather than invoking an arbitrary __index.

Keep a strong reference to the actual userdata throughout the synchronous probe and establish original lifetime ownership. Original font.close/__gc share sdl_free_font (core_lua.c:719–724; registered at 3602–3603), which calls TTF_CloseFont without clearing the contained pointer. Therefore a nonnull pointer alone does not prove an explicitly closed userdata is live. The newly constructed real fixture must not close or replace its resolved native font, and no teardown/finalization may interleave with the probe. This requires no new font/fallback.

The actual pinned SDL_ttf source is `C:\Users\kit\emsdk\upstream\emscripten\cache\ports\sdl2_ttf\SDL_ttf-release-2.20.2`. Its header `SDL_ttf.h:747` declares `int TTF_GlyphIsProvided(TTF_Font *font, Uint16 ch)`. Header lines 739–743 specify nonzero if provided, zero if absent; it supports BMP scalars. C implementation at `SDL_ttf.c:3034–3036` returns `(int)get_char_index(font,ch)`, thus the actual FreeType glyph index rather than a fabricated Boolean. Query and record each of `0x65E5` (日), `0x672C` (本), `0x8A9E` (語). If any index is zero, glyph coverage is unproven/absent for that actual font; do not replace the font inside this observation or interpret positive string width as a pass. TTF_GlyphIsProvided32 is also present at header 763/C3039–3041, but is unnecessary for these three BMP probes.

`get_char_index`, SDL_ttf.c:2709–2723, can fill `font->cache_index[ch]` and otherwise calls FT_Get_Char_Index. This native probe is appropriate preparation/diagnostics outside the independent Rust heap comparison bracket; do not advertise it as a whole-native-heap-pure getter. Real screenshots are still required to prove the actual Textbox renders the supplied Japanese bytes and correct caret through its original font path.

Read SHA-256s for these exact sources:

- SDL_ttf.c: `379f1f57fbf3c13b46c60482a911a2e18ea2a48da0088989a33609b1519c2cc0`.
- SDL_ttf.h: `530f2592c84201d4086ceec691f81991c8a4196ec672606d9bfc224d6a084db3`.
- Original src/auxiliar.c: `f7620def3f02510bd4f1b0bb011119464f3ccc1e15272e9f4d7324bc0d666a87`.
- Original src/auxiliar.h: `8a5f9818ad0b1986f6be7d37f50a1f6a3ee1080a0b46385e3926d0d581858728`.

No native glyph query was executed in this review.
