# Additive original native Unicode textbox fixture

Source-only candidate. Parent owns generation, compilation, genuine SDL/browser execution and deployment. This diagnostic widget registers an original Dialog/Textbox; it does not change any player/name/actor graph. The nested layout container is explicitly authored fixture code composing original Base, Focusable and UIGroup. This is not complete IME or full UI support.

Use a distinct fresh physical-input-compat-resize profile. Do not change the current tested/default artifact.

1. Generate the guarded UTF-8 Textbox/UIGroup presentation overlay using the existing utf8-textbox-candidate generator. Mount those three modules before original class loading. The parent already verified its bundled-Lua 21-case fixture; that interpreter lacked the real native UTF-8 iterator, so native evidence remains required.
2. Generate a NEW physical input derivative:
   node rust-platform-input-work/audit-new/textbox-native-candidate/generate-focus-derivative.mjs rust-platform-input-work/native/physical_input.c native-core-work/NEW_PROFILE_FOCUS_OUTPUT
   Parent must create the output parent first. Source SHA is pinned to 83364976d5858620be91d057a0cdb6909e5a121074c10e860b9f0cc92410e209. The generator replaces only the one-level focused_unicode body, adds one include, retains original bytes separately and proves reverse-byte equality before writing.
3. Compile generated physical_input.c instead of the frozen unit, and add tome_nested_focus.c plus tome_textbox_native.c. Include this candidate directory. Existing original source/SDL/SDL_ttf/Lua include and link inputs stay authoritative. The source uses SDL_ttf 2.20.2 TTF_GlyphIsProvided and the same physical/checkpoint gates.
4. Expose the six new native exports listed below; keep existing physical exports. After genuine native init, before original start, call installNativeTextboxFixture(module, fixtureLuaURL). The installer rejects already cached original Textbox/UIGroup classes and duplicate VM installation. It does not require any UI class at that early font-sensitive stage.
5. Complete original Japanese start and its real initial frame. Construct NativeTextboxFixture with the actual existing inputHost, OriginalPhysicalInput, and that variant's real onOriginalFrame callback. Localized title/field/cancel strings come from this separate checked EN/JA diagnostic catalogue. External initial text is passed unchanged.
6. fixture.open(initial,{title,field,cancel}) acquires the existing single-flight host drain, opens the real original dialog, then explicitly drains native pending focus work through actual begin/end/pump with zero physical packets, and requests the caller's real original frame. There is no fabricated SDL key, WAIT, text event or actor action. Ordinary dispatch's nonempty-packet contract stays unchanged.
7. Drive all actual edits/ACCEPT/EXIT through the existing Rust mapper -> SDL backend -> original KeyBind/on_input. C close is an explicit diagnostic convenience that uses original unregisterDialog, not a replacement for Escape/Enter evidence.

Native exports:

- int tome_textbox_native_install(const char *source,unsigned int length)
- int tome_textbox_native_open(const char *initial,const char *title,const char *field_title,const char *cancel_text)
- int tome_textbox_native_close(void)
- const char *tome_textbox_native_status(void)
- const char *tome_textbox_native_error(void)
- const char *tome_textbox_focus_status(void)

The non-exported integration helper is int tome_textbox_nested_focused_unicode(int *dialog_count,int *depth). It returns -1 for unknown, traverses at most 32 actual raw focus_ui.ui wrappers, guards cycles/types and restores stack height.

Every native string is borrowed scratch and must be copied immediately via ccall string. Status includes exact external text/scalar cursor/change/accept/cancel counts, real input-zone and visual origins, native iterator identity, focus depth/opaque live key+mouse object identities, and genuine retained mono-font BMP glyph indices for U+65E5/U+672C/U+8A9E. No callbacks/metamethods/RNG occur in focus traversal or Lua status. Native status stack/scratch and TTF glyph-cache writes are outside the independent synchronous Rust/native heap comparison bracket. Positive width does not establish Japanese glyph coverage. The existing active newly-created widget/font is held strongly; no font close, replacement, yield or finalization is permitted during the synchronous probe.

Fixture guards include a genuine Textbox constructor with 日本語 even when the requested external text is ASCII/empty. It must have exactly three scalar entries and cursor four. The actual main field must preserve its input bytes, callback must be key.on_input, and the original native iterator must match core.display.stringNextUTF. Original popup animation is disabled through the source-supported eighth Dialog argument, so reported settled layout coordinates are its rendered geometry. Mouse-zone x and text visual origin are distinct; use the actual mouse_zone_x/y/w fields for caret-hit evidence.

Required actual evidence is specified in NATIVE-SCENARIO-SPEC.md. This child performed only source reads/writes; no compile/test/browser was launched.