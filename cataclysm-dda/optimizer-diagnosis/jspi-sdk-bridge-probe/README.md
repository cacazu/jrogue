# Prepared SDK legacy-exception / JSPI prerequisite

**Source only; unexecuted.** No compiler, browser, server, resource helper, or syntax-check process was launched for this fixture. The successful 16-check raw JSPI probe is unchanged. [Execution state](execution-state.json) records this boundary.

This authored fixture tests installed Emscripten **6.0.8**, following [the pinned SDK source audit](../JSPI-SOURCE-AUDIT.md). It compiles two small C++ translation units and links two isolated JSPI modules. It uses no game objects, upstream modifications, SDL ports, dependency download, installer, shared cache copy, SDK configuration change, or native Wasm exception switch. An isolated configuration selects the existing SDK cache in frozen/read-only mode; a missing required archive must fail the build.

`fixture.cpp` holds exception-catching callers and bounded native observations. `targets.cpp` holds target functions and a volatile function-pointer accessor. Separate translation units, `-Os` without LTO, and volatile storage prevent an assumed direct-call substitution. The build refuses to proceed if its generated JavaScript lacks the expected `invoke_iii` legacy bridge. This is a planned metadata check, not a currently observed compiled artifact.

The 14 declared cases in [cases.mjs](cases.mjs), repeated for both export selections, cover:

- Default main with a plain `emscripten_sleep` control, main with indirect sleep and RAII, and main with synchronous typed C++ catch.
- An explicitly exported yielding function left unselected versus selected in `JSPI_EXPORTS`.
- Exception-aware indirect sleep, synchronous typed throw, delayed typed throw after sleep, preserved payload/token identity, and the same exception-object address after rethrow.
- Guard constructor/destructor traces and zero remaining live guards after successful return or required unwind.
- `EM_ASYNC_JS` Promise resolution and exact host rejection-object identity, both plain and through C++ cleanup/catch scopes.
- A synchronous C++ callback, invoked while an asynchronous import is pending, whose immediate scalar return and native mutation must remain synchronous.

The plain controls contain no cleanup/catch scope. The RAII and indirect cases deliberately retain the installed legacy `-fexceptions` path. Imported JavaScript rejection is distinguished from a typed C++ exception: the harness records whether it reaches the host unchanged, whether a C++ catch runs, and whether destructors execute. A foreign rejection is not silently converted into a numeric C++ exception or a successful return.

An unselected yielding export's `SuspendError` is a documented negative boundary check. All other outcomes are compatibility assertions and may fail. In particular, the SDK can mark `invoke_*` imports as suspending even when a target is synchronous; an unselected callback/control must be measured rather than assumed safe. Callback errors are caught by the fixture's host callback and reject its pending import, allowing evidence collection instead of leaving an unresolved timer. An observed ordinary-JavaScript-frame restriction, lost destructor, changed callback return, stale state, rejected main, or escaped Promise remains a blocker. These source declarations do not establish that any case passes.

The compile flags are exactly `-std=c++17 -Os -fexceptions -sDISABLE_EXCEPTION_CATCHING=0`. Links retain those exception settings and add `-sJSPI=1 -sWASM_BIGINT=1 -sASSERTIONS=1 -sEXCEPTION_STACK_TRACES=0 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web -sEXIT_RUNTIME=0 -sINITIAL_MEMORY=16MB -sMAXIMUM_MEMORY=64MB -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=65536 -Wl,--threads=1`, the nine exact exported functions, and `callMain`. [build.mjs](build.mjs) contains the full argument arrays. The default link omits `JSPI_EXPORTS`; the explicit link selects `main`, `probe_plain`, `probe_plain_async`, `probe_direct`, `probe_async`, and `probe_indirect`. Native stats/reset and the synchronous callback remain unselected. There is no blanket export selection or wrapper rewrite.

Neither script starts automatically. The coordinator must first reserve an exclusive slot and create a receipt inside this directory, for example `parent-slot.json`, containing:

```json
{"schemaVersion":1,"scope":"cdda-jspi-sdk-bridge-prerequisite","coordinator":"/root","exclusiveHeavySlot":true,"actions":["build","browser"],"expiresAt":"<fresh coordinator-selected UTC expiry>"}
```

After coordination, the separate commands are `node optimizer-diagnosis/jspi-sdk-bridge-probe/build.mjs --parent-slot optimizer-diagnosis/jspi-sdk-bridge-probe/parent-slot.json` and, only after the exact build manifest exists, `node optimizer-diagnosis/jspi-sdk-bridge-probe/run.mjs --parent-slot optimizer-diagnosis/jspi-sdk-bridge-probe/parent-slot.json`. This receipt is a resource reservation, not a request for new user authorization. A missing, expired, wrong-scope receipt or occupied probe lock refuses the phase before resource helper/compiler/browser execution.

Every compiler/link process and the one browser phase require fresh **4 GiB physical and 6 GiB commit headroom**. The owned process-tree guard enforces a **1 GiB private-memory budget**, a **3 GiB remaining physical/commit floor**, and a **90-second phase/process deadline**, sampled using native Windows counters. It verifies the exact source/profile marker before acting, and stops only its owned process tree on failure. Compiler/link jobs are sequential, `EMCC_CORES=1`, `EMCC_BATCH_BUILD=0`. Chrome is hidden/headless with one new isolated profile, extensions/background networking/update/sync disabled, and no JSPI feature flag. The server binds only loopback. Guard measurements and deadlines have sampling granularity and must not be described as continuous peaks.

Future build evidence includes exact commands, source/SDK/audit/artifact hashes, retained invoke wrappers, return codes, logs, and resource samples. Browser evidence includes all 28 individual case records, native traces, errors/rejection identity, lifecycle order, exact browser flags/version, runtime exceptions, resource samples, and a screenshot. The default main's completion and `postRun` are checked together; `onRuntimeInitialized` is not treated as completion. Compatibility failures are retained rather than counted as passes.

A passing future prerequisite would still leave the actual game call graph, SDL event/timer contracts, persistence failures, renderer/input separation, gameplay/save determinism, PC/mobile flows, and publication gates untested. This fixture supplies no permission or technical basis to launch another full-engine candidate.
