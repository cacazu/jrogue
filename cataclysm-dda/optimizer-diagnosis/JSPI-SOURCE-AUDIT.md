# Cataclysm: DDA JSPI source prerequisite audit

**Decision: a link-only JSPI conversion of the existing C++ objects is not established as safe.** The immediate gap is the current `-fexceptions` indirect-call bridge: the installed SDK emits ordinary JavaScript `invoke_*` functions that can sit between a promising main entry and a suspending native call. The browser prerequisite independently confirms that suspension across an ordinary JavaScript frame raises `SuspendError`. This establishes a concrete compatibility gate; it does not establish that every CDDA indirect call fails.

The coordinator selected **one separate link-O1 Asyncify candidate**, preserving the running original. This audit launched no compiler, optimizer, profiler, browser, or game, and changed no upstream, SDK, build flags, or running process. Its conclusions come from source and section metadata. Full-engine behavior remains subject to the build owner's measurements and browser validation.

The companion [JSON audit](JSPI-SOURCE-AUDIT.json) contains 37 SHA-256 source pins, all measured module imports/exports, a 17-row entry/caller matrix, and explicit blockers. Local line numbers below refer to those pinned installed files. Official tag links provide provenance; byte identity between installed files and fetched tag pages was not assumed.

## Exact inputs

| Input | Verified value |
| --- | --- |
| CDDA | `0.I-1`, commit `7b2efa5cea38e4d4d97dd0e63b28b9148623da59` |
| Installed Emscripten | `6.0.8`; original upstream recipe names `3.1.51` |
| Installed Binaryen | `132 (version_132-16-g89a81ef9b)` |
| Existing compilation | 438 selected C/C++ units, `-Os -fexceptions`; C++17, `-DEMSCRIPTEN`, no pthread flag |
| Existing link | Asyncify mode 1, `WASM_BIGINT`, full conservative indirect-call handling |
| Measured original optimizer input | 42,382,436 bytes; SHA-256 `6b65cb8bdeab5eca9b7f221e342547d19b77f8643c98e809d4bffcb1387c362a` |
| Section metadata | 561 function imports; 162 distinct `env.invoke_*` imports; 200 total exports, including 188 function exports and 172 `dynCall_*` exports |

Those exports describe the original **pre-terminal Asyncify mode-1 input**, not a final JSPI candidate. Section inspection did not instantiate or execute the module. Neither `cataclysm_is_menu` nor `_cataclysm_is_menu` appears in the actual exports or current baseline shell. The 162 invoke imports and 172 dynCall exports are different counts.

## Installed SDK behavior

`tools/cmdline.py:769–774` maps `JSPI` to `ASYNCIFY=2` and maps its import/export settings to the shared Asyncify settings. `libcore.js:1540` returns the numeric Asyncify mode from `emscripten_has_asyncify()`: it therefore returns **2**, which is truthy, under JSPI. [Official command-line source](https://github.com/emscripten-core/emscripten/blob/6.0.8/tools/cmdline.py), [official runtime source](https://github.com/emscripten-core/emscripten/blob/6.0.8/src/lib/libcore.js).

The trusted SDL `SDL_Delay` checks that function and a default-true `SDL_HINT_EMSCRIPTEN_ASYNCIFY`, then calls `emscripten_sleep` (`SDL_systimer.c:181–195`). No game override of that hint was found in the inspected source/header scan. JSPI does not silently turn the original SDL delays into browser-blocking waits. [SDL timer source](https://github.com/libsdl-org/SDL/blob/release-2.32.10/src/timer/unix/SDL_systimer.c).

Mode 2 wraps selected imports using `WebAssembly.Suspending`, selected exports using `WebAssembly.promising`, and implements shared `handleAsync` with Promise/keepalive handling (`libasync.js:44–67,153–176,452–478`). `EM_ASYNC_JS` emits an `__asyncjs__` import invoking that shared handler. These mechanisms fit CDDA's `mount_idbfs` entry at the source level. They do not remove intervening JavaScript call frames. [Async runtime source](https://github.com/emscripten-core/emscripten/blob/6.0.8/src/lib/libasync.js), [EM_ASYNC_JS header](https://github.com/emscripten-core/emscripten/blob/6.0.8/system/include/emscripten/em_js.h).

`link.py:63–68,1731–1738,3192–3194` supplies default main exports, `__asyncjs__*`, conservative `invoke_*`, and JS-library async imports such as sleep. Its Binaryen Asyncify instrumentation guard is mode 1 only. Settings require **every export that may suspend** to be selected; default main coverage is not a complete secondary-entry audit. [Link source](https://github.com/emscripten-core/emscripten/blob/6.0.8/tools/link.py), [settings source](https://github.com/emscripten-core/emscripten/blob/6.0.8/src/settings.js), [official Asyncify/JSPI guide](https://emscripten.org/docs/porting/asyncify.html).

Mode 2 makes `callMain` asynchronous and awaits native main (`postamble.js:23–91`); `postRun` follows the awaited main completion (`174–180`). The current baseline's `postRun` diagnostic must therefore not be treated as an initial menu-ready signal under JSPI. Shutdown's reference to mode-1 `Asyncify.state` is explicitly guarded by `ASYNCIFY == 1 && ASSERTIONS` (`preamble.js:207–209`). The inspected lifecycle code does not prove a mode-2 shutdown dependency on that field. [Startup source](https://github.com/emscripten-core/emscripten/blob/6.0.8/src/postamble.js), [runtime lifecycle source](https://github.com/emscripten-core/emscripten/blob/6.0.8/src/preamble.js).

## C++ exception and indirect-call gap

`js_manipulation.py:109–156` generates ordinary synchronous `invoke_*` functions: save stack, directly call a table function/dynCall, catch synchronous Emscripten exceptions, restore stack and set the exception flag. There is no JSPI-specific `async`/`await` translation. Existing objects retain that exception ABI. [Official invocation generator](https://github.com/emscripten-core/emscripten/blob/6.0.8/tools/js_manipulation.py).

The distinction between modes matters. `link.py:1011–1015` forces legacy dynCalls for mode 1. Mode 2 can directly use table entries. `libcore.js:1915–1917` does wrap a table entry when its raw function identity is already in the selected async-export set. That is **limited identity-based coverage**, not automatic wrapping of all indirect targets. `dynCall` and compile-time `makeDynCall` default their promising parameter to false (`libcore.js:1810–1869`; `parseTools.mjs:688–768`). [Runtime table-call source](https://github.com/emscripten-core/emscripten/blob/6.0.8/src/lib/libcore.js), [compile-time call generator](https://github.com/emscripten-core/emscripten/blob/6.0.8/src/parseTools.mjs).

Marking an `invoke_*` import as Suspending does not make its synchronous JavaScript body transparent to a nested sleep. If a selected table target were changed to return a Promise, void invoke wrappers discard that result, and a synchronous catch cannot translate a later rejected Promise into the current `setThrew` protocol. A blanket `JSPI_EXPORTS` pattern therefore needs result/exception-contract evidence; it is not a demonstrated repair.

The official JSPI restriction permits only Wasm frames between the promising entry and suspending import. It also leaves shared-state and reentry ordering safety to the application. [WebAssembly JSPI proposal](https://github.com/WebAssembly/js-promise-integration/blob/main/proposals/js-promise-integration/Overview.md).

The separate bounded browser probe at [its report](jspi-probe/REPORT.md) and [successful evidence](jspi-probe/output/2026-10-02T18-24-54-055Z/evidence.json) passed 16 assertions in Chrome **154.0.8037.97**, V8 **15.4.80.20**, without enabling a JSPI flag. Ordinary JS → synchronous Wasm reentry succeeds; ordinary JS → suspending Wasm fails with `SuspendError`. A paired Suspending/promising nested call succeeds. This 108-byte authored raw module did **not** test installed Emscripten C++ exceptions, SDL, or the complete game.

## Actual entries and secondary callers

| Caller/entry | Actual source and contract | JSPI finding / remaining gate |
| --- | --- | --- |
| Native main | `main.cpp:576–611,636` restores IDBFS before options; `ui_adaptor::redraw_invalidated():358–470` yields after resize/redraw `std::function` callbacks; `sdltiles.cpp:3005,3966,3978` delays. | Main is promising by default. Indirect exception frames remain the primary unresolved bridge. |
| C++ indirect exception calls | Actual 162 `env.invoke_*` imports; SDK `js_manipulation.py:109–156`. | Ordinary JS frames; synchronous result and catch contracts. No complete target graph or SDK exception probe. |
| Keyboard, mouse, wheel, touch, pointer lock | SDL registers native callbacks in `SDL_emscriptenevents.c:958–999`; SDK default `makeDynCall`, with EM_BOOL used immediately for `preventDefault`. | Reviewed entry bodies have no direct sleep. Promise conversion would change the Boolean contract; transitive non-suspension and queued-state safety remain unproven. |
| Window resize, fullscreen, focus, visibility, canvas resize | SDL handlers `861–946`; SDK HTML5 callbacks `1041–1106,1718–1745`. | Synchronous calls can run while main is suspended. Native renderer state/function pointers are involved; test selected backend and resize/fullscreen transitions. |
| SDL internal event watchers | `SDL_PushEvent:1156–1202` calls filters/watchers synchronously; renderer watch `SDL_render.c:684–881,1122`; controller watch `SDL_gamecontroller.c:330–410,1924`. | Callback behavior is broader than enqueueing input. The complete rendering/controller graph was not audited. |
| Gamepad connect/disconnect | Actual registration imports; `SDL_sysjoystick.c:41–149,206–225`; SDK `libhtml5.js:1904–1954`. | Synchronous native allocation/device updates/event dispatch. Hotplug behavior and transitive callback safety require real validation. |
| Gamepad timer | `sdl_gamepad.cpp:67–83,115–136` installs a 50 ms timer if a controller exists. SDL timer helper `393–400,421–443`; SDK timeout uses default `makeDynCall('vp')`. | Callback queues a native event and returns Uint32 interval immediately. Async wrapping would change rescheduling semantics. No controller run performed. |
| Native memory/stack/EH helpers | Actual synchronous exports including malloc/free, stack alloc/restore, setThrew and exception helpers. | Pointer/scalar returns must stay synchronous. These mutate memory/stack and are not pure; actual safe reentry needs testing. |
| Embind exception getter | Sole explicit game binding at `emscripten_exception.cpp:1–12`; current shell never calls it. SDK supports async bindings only when `isAsync` is selected. | No async marker; getter invokes virtual `what()` and allocates a string, with no UI yield in its body. Validate handles/lifetime before adding a caller. |
| Signal trampoline | Actual `env.__call_sighandler` import; SDK `libcore.js:1382`; native SIGINT handler installed at `main.cpp:831–835`. `exit_handler:143–166` may show a quit prompt or redraw after cancel. | Potential suspending secondary entry through a synchronous trampoline. Browser SIGINT delivery is not established. No active setitimer import/export was found. |
| Initial IDBFS callback | CPP owns mount; baseline shell `74–106` seeds a new Japanese profile after restore and before resolving CPP mount. | Restore/seeding error rejects the Promise. Test new/existing profiles, rejection handling and retry. |
| Background persistence | `filesystem.cpp:60–81,161–205` and `mapsharing.cpp:166–170` notify the JS sync scheduler; `main.cpp:583–611` schedules JS IDBFS work. | Inspected completion callback logs errors and has no native callback. Writes can continue while persistence is pending; snapshot behavior is untested. |
| Save export | Shell `117–148,209–217` awaits sync then packages existing native files in version-1 JSON. | No native save command or checkpoint lock. This is file packaging, not demonstrated deterministic game saving; save in the original engine before export and test concurrent writes/resume. |
| Shell controls/Rust text bridge | Shell `173–200` dispatches DOM keyboard events; text input sends characters synchronously. | No direct C++ main, malloc/free or menu-helper call. Rapid queue ordering, IME/CJK/mobile flows still need real tests. |
| Immediate menuready listener | Native EM_ASM `main_menu.cpp:656`; shell `224–233` updates UI and focus. | Current listener does not call suspending gameplay. A future native command here would introduce ordinary JS reentry. |
| Shutdown/beforeunload | SDL handler `949–956` sends terminating event synchronously; shell `235–238` prompts on dirty state; SDK mode-2 main completion is awaited. | Cannot await native save/quit from beforeunload. Test normal/canceled quit, final persistence, abort/rejection and no second main entry. |

Callback contracts above come from [official SDL browser handlers](https://github.com/libsdl-org/SDL/blob/release-2.32.10/src/video/emscripten/SDL_emscriptenevents.c), [SDL event dispatch](https://github.com/libsdl-org/SDL/blob/release-2.32.10/src/events/SDL_events.c), [SDL timer callbacks](https://github.com/libsdl-org/SDL/blob/release-2.32.10/src/timer/SDL_timer.c), [SDK HTML5 callbacks](https://github.com/emscripten-core/emscripten/blob/6.0.8/src/lib/libhtml5.js), [SDK event-loop callbacks](https://github.com/emscripten-core/emscripten/blob/6.0.8/src/lib/libeventloop.js) and [SDK Embind dispatch](https://github.com/emscripten-core/emscripten/blob/6.0.8/src/lib/libembind.js). Exact game code is pinned to [the upstream commit](https://github.com/CleverRaven/Cataclysm-DDA/tree/7b2efa5cea38e4d4d97dd0e63b28b9148623da59).

The lexical scan covered all 438 selected C/C++ units. It found no explicit game SDL event-filter/watcher registration, KEEPALIVE export, Emscripten HTML5/main-loop registration, or menu helper. Library registrations above still exist. Lexical hits can include inactive preprocessor branches and identifiers such as a variable named `signal`; this scan is not a resolved call graph. A separate source/header scan located the persistence notifications and confirmed no game override of the Asyncify SDL hint.

## Remaining work and boundaries

A future **tiny installed-SDK C++ probe** should cover `-fexceptions`, RAII destructors, try/catch, indirect call → `emscripten_sleep`, Promise rejection and synchronous exception-result preservation. It is a prerequisite for revisiting link-only JSPI, not an additional experiment needed for the already selected O1 Asyncify run. No such compiler probe was launched here. Switching to `-fwasm-exceptions` would require compatible recompilation rather than reuse of the existing exception objects.

Even a passing exception probe would leave the secondary-entry and callback graph, save/restore errors, rapid input, controller timers/hotplug, resize/fullscreen, canceled quit, mobile input and full game flows to validate. Generic `ASYNCIFY_IGNORE_INDIRECT`, removing instrumentation, or blanket Promise wrappers lack the required actual-call evidence.

The O1 Asyncify choice keeps the original exception bridge, full conservative suspension graph and existing compiled objects. Its build timing, output validity and runtime fidelity are measured separately; this source audit provides no claim that it has finished or passed. Likewise, it provides no current optimizer pass attribution, confirmed Binaryen root cause, or assertion that hours of CPU activity are normal. See [the existing optimizer diagnosis](OFFICIAL-DIAGNOSIS.md) and [prepared exact link diff](candidate-link-diff.json) for that separate evidence.
