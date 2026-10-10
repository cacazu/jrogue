# Bounded JSPI prerequisite result

The installed Chrome **154.0.8037.97**, V8 **15.4.80.20**, passed all **16 assertions** with `WebAssembly.Suspending`, `WebAssembly.promising`, and `WebAssembly.SuspendError` available without enabling a JSPI feature flag.

Successful final run: `output/2026-10-02T18-24-54-055Z/evidence.json`, 2026-10-02 18:24:54–18:25:00 UTC. The authored raw module is **108 bytes**, SHA-256 `ec7055dcdabaa7f7829e42b84c6b5e7e2f845c6b235deff21bcac21047976815`; its exact emitted binary is retained beside the evidence. No Emscripten compile, Cataclysm gameplay module, SDL path, full-engine candidate, or public deployment was executed.

The probe verifies an actual timer-backed asynchronous import and continuation, a running browser event loop during suspension, rejection identity, 32 rapid concurrent continuations with independent results, a synchronous export while continuations are suspended, and a promising wrapper around a synchronous export. It also tests both the supported and unsupported reentrancy boundaries:

- Wasm → ordinary JavaScript → synchronous Wasm succeeds.
- Wasm → ordinary JavaScript → suspending Wasm fails with `SuspendError: trying to suspend JS frames`.
- A suspending export entered without a promising wrapper fails with `SuspendError: trying to suspend without WebAssembly.promising`.
- An explicitly suspending import can await a separately promising nested Wasm call; rejection propagates through the same wrapping pair.

All rejected Promises were handled, with zero `unhandledrejection` events and zero browser runtime exceptions. These observed limits agree with the [WebAssembly JSPI proposal](https://github.com/WebAssembly/js-promise-integration/blob/main/proposals/js-promise-integration/Overview.md) and [JavaScript API specification](https://webassembly.github.io/js-promise-integration/js-api/). [V8's JSPI explanation](https://v8.dev/blog/jspi) describes the paired import/export boundary.

The probe-specific start gate required at least 4 GiB physical and 4 GiB commit headroom. Fresh start readings were 6.29 GiB physical and 6.01 GiB commit. Its guard limited the owned Chrome tree to 1 GiB private memory and required at least 3 GiB remaining physical/commit memory. Two samples recorded a **247.25 MiB sampled private-memory peak**, a **5.93 GiB physical minimum**, and a **5.52 GiB commit minimum**. This is a sampled maximum, not a continuous process-memory peak. The guard completed, the local server closed, and all 11 recorded owned Chrome process IDs were confirmed absent afterward. Existing browser profiles and other processes were untouched.

An earlier run passed the same 16 browser assertions but its final PowerShell 5 summary calculation failed while reading dictionary properties. That failed overall run is retained at `output/2026-10-02T18-23-46-642Z`; the summary implementation was fixed and the bounded probe was rerun once. The final run's overall status is `passed`.

This establishes the installed browser's small-module JSPI capability and its JavaScript-frame restriction. It does **not** establish Cataclysm's full call graph, SDL callback safety, Emscripten glue compatibility, gameplay determinism, performance, memory use, mobile/browser compatibility, or publication readiness. The full-engine entry/import audit and real browser gameplay validation remain separate gates.

Reproduce with `node optimizer-diagnosis/jspi-probe/run.mjs` under the authorized Windows executor. The runner uses an isolated profile under this probe directory, installed Chrome, one hidden headless browser, a loopback Node server, and a fresh memory preflight. It starts no browser if that gate fails. Its output directory contains exact browser flags/version, resource samples, script result, raw Wasm, and screenshot.
