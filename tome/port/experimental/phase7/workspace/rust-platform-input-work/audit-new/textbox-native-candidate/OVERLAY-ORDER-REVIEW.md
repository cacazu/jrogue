# UTF8 overlay mount ordering source review

Source-only review, 2026-10-02. No build/runtime/browser or implementation edits. Original ToME 1.7.6 tag tome-1.7.6, commit 624a67329fe2ad440c5b344785a9c73fcf22ae63.

No confirmed early Textbox/UIGroup/UTF8TextboxPresentation cache was found in the current inspected bootstrap and original transitive dependency closure. The SavefilePipe mount precedes those exact three leaves, but does NOT precede all UI classes: original UI Dialog/Base load earlier. Actual live cache and VFS provenance remain runtime guards, not source-proven facts.

Paths: E = C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\unpacked\game\engines\default; R = C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6. Workspace files below are relative to task-10.

## Exact reviewed order

- bootstrap-work/real-core-probe.lua179–191 executes semantic bootstrap and diagnostics before require wrapper193–251. native_semantic_bootstrap.lua5–19 loadfiles semantic_i18n/options/native_i18n_install and constructs observer. Inspected semantic modules have no require/dofile engine UI dependency. Diagnostics collect is a later function, not called at load time.
- Driver200–206 mounts settings.root_game/engine-overlay at / with append=false immediately before first original engine.SavefilePipe require208. Current package.loaded guard203 checks SavefilePipe only. Virtual existence check205 also checks that leaf only.
- Driver254 executes original loader/pre-init.lua. Original pre-init21–25 tries jit/jit.opt; no engine UI require. Driver260 executes original loader/init.lua. Original loader127–130 mounts selected engine;154 loads actual base VFS file,188 installs te4 loader,217 dofiles engine/init.lua.
- E/engine/init.lua23–27 dofiles utils/colors/resolvers,29 config,30 I18N,31 Game,32 version,33 GameMusic,34 KeyBind,35 Savefile,36 SavefilePipe. Utils26 requires native lpeg; later Map requires are function bodies. Original thirdparty config2–3 imports standard string/table; tween has no requires.
- native_i18n_install.lua233–256 observes config and primes actual original Japanese I18N. E/data/locales/engine/ja_JP.lua3 calls forceFontPackage(japanese), E/engine/I18N.lua105–107 requires FontPackage. FontPackage20 requires class only;65–67 sets forced package ID. No Textbox/UIGroup load.
- E/engine/Game.lua20–24 imports class, Mouse, DebugConsole, tween, Shader. DebugConsole20–22 imports old engine.Dialog and FontPackage. Old Dialog20–22 imports class/Tiles/KeyBind. Tiles/Mouse/Shader import class. KeyBind20–22 imports config/class/KeyCommand; KeyCommand20–22 imports config/class/Key; Key imports class. No three-leaf import.
- E/engine/Savefile.lua21 imports engine.ui.Dialog BEFORE engine.SavefilePipe. UI Dialog20–23 imports class/KeyBind/UI Base/Particles. Base20–22 imports class/KeyBind/Mouse and creates shared fonts33–39. Particles20 imports class. Additional UI Dialog requires are deferred method bodies; no Textbox/UIGroup top-level import was found. Base/Dialog are already cached at the SavefilePipe mount. Game68 UI Base require is inside defaultMouseCursor, not top-level.

## Required concrete guards

Before actual mount reject package.loaded entries for engine.ui.Textbox, engine.ui.UIGroup, engine.ui.UTF8TextboxPresentation. Existing UI Base/Dialog caches are expected. Do not evict caches or patch live classes as recovery.

Mounting /original/game/engine-overlay at / makes the requested three /original/game/engine-overlay/engine/ui/*.lua files visible as /engine/ui/*.lua. Assert all three exist and prove actual first-require bytes match reviewed generated files; Emscripten staging or existence alone does not establish PhysFS resolution. Original engine/init.lua61 later mounts homepath; source alone cannot prove a user's homepath has no colliding leaf. Preserve original loader/addon order and verify final first-load resolution.

Retain fresh native fixture cache guards and genuine multibyte witness. I18N ordering is favorable, but actual Base.font_mono predates this seam: three-leaf UTF8 overlay cannot retroactively repair a wrong prefont hook. Real native mono glyph indices and original SDL/UI screenshots remain separate validation gates.

No source-only early-cache blocker for these exact three leaves was identified. A UI Base/Dialog replacement at this seam would have a confirmed caching problem and requires a different plan.

## Read-only source SHA-256

- real-core-probe.lua: 47f19cca78007c590d491ad92768f9de9a034f1c0e014e03e9a28fff7c8a480a
- R/game/loader/pre-init.lua: 19964db350dd422979968853a353f26955a37b620ff4b9d625b14af719c05962
- R/game/loader/init.lua: d041dfc534d049d64513b5f682ca5e0aa11d141e715bda039f562923cd84acc2
- E/engine/init.lua: 8aba0c74f105c93c16e905ed3786c8f6a02255303bdccca72d904694107593fb
- E/engine/Savefile.lua: 1eca1669f3469544a9e561e86fa8b657bc743ef20cc04fd7ff820a9b5862c37a
- E/engine/DebugConsole.lua: 8b96972eba4653637d34f73da04d2724e1902f1f3deb0f574035e8cff8d19a05
- E/engine/Dialog.lua: f19a3a23ec93a04df173c4b3d643cb03bfdaf2f23902b6adf3f2f24cfffacdca
- E/engine/FontPackage.lua: 60d806d3d4a5ad2a5319f9b3626893157bede10aa5410b7bfec9b52490ea8a6f
- native_semantic_bootstrap.lua: 729a73397ceab854ad942355f65ecd05a8388f2d0e8afc94206f6e0bb215d44a
- native_semantic_options.lua: 38ef2de2e0ba8a23dceecae92447f02b2f395e0a612fa72944bc8d24d791e7af
- native_semantic_diagnostics.lua: 7bde5341e8d548daacc70fcc3b9cfd216cf7984c4bc2d37413dbf5475b3a9917
- semantic_i18n.lua: cd7fdc9618f97c67a6126097005f774bf153aeae0287cca930d9b7b71899c6ad
- native_i18n_install.lua: 3bb257892380f905f066c9434fd171b6b31915e5f2437841f40b8c8bdd0a33f3