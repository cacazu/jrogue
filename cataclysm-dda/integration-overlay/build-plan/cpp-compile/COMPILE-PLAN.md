# Two translation-unit compile check

`compile-plan.json` is source preparation only: no compiler, Cargo, engine or
browser execution. Parent must review the manifest, prioritize browser
recovery and reserve a new exclusive slot before a trial.

The targets are patched `input_context.cpp` and the new
`browser_input_snapshot.cpp`. Exactly those files and their new sibling
snapshot header are staged byte-for-byte under `sources/src`; `input.cpp`,
all original class headers, pristine source and baseline objects stay intact.
The manifest pins the accepted 438-unit baseline, actual original command,
144 original MMD dependencies, SDK/cache/port inputs and staged bytes.

Both exact command arrays retain the accepted `-Os`, signed-char, C++17,
exceptions, TILES/localization/SDL flags and explicit `-DEMSCRIPTEN`. The
incomplete no-legacy-macro attempt is excluded. Additions are the staged
include directory, verbose diagnostics and an explicitly quoted distinct
`CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID`. Both remain `-c -MMD -MP` with isolated
objects/dependency files; no linking or old object replacement is included.
The retained actual SDK is 6.0.8; upstream's official recipe originally named
3.1.51, and that difference remains visible in the provenance.

The staged folder has no original class headers. Its new snapshot header is
resolved beside the staged CPP files; unchanged headers resolve through the
baseline pristine `src` and keep their original sibling resolution. Existing
generated, third-party and SDL include paths retain their baseline order.
MMD excludes system headers, so actual compiler/dependency output must still
establish complete include selection. This plan does not claim preprocessing.

The owned SDK config sets `FROZEN_CACHE = True`, using existing
`engine-build/cache` and `engine-build/ports`. Missing variants must stop
without downloads, regeneration, installation or global configuration changes.
One worker, fresh 4 GiB physical / 6 GiB exact commit gates before each TU,
a 1 GiB kernel hard aggregate job-memory/private cap, a 1 GiB summed
working-set stop threshold sampled every 250 ms, 2 GiB running floors and a
180-second timeout remain mandatory. Browser recovery takes priority when
its 7/9 gate fits. Future execution must reuse the reviewed fail-closed
`presentation-snapshot-overlay/run-parser-window.py::run_owned` function;
the historical `run_stage` alone is forbidden and the parser-only CLI cannot
accept these C++ commands. Stable wrapper hash and parent release are gates.
The working-set threshold is monitored rather than a kernel hard aggregate
working-set ceiling. Counters use `GlobalMemoryStatusEx` and the exact
`GetPerformanceInfo` committed/limit page difference. Unrelated foreground
applications are outside ownership and are never stopped by this runner.

The original accepted source-preparation manifest is preserved byte-for-byte
as `compile-plan.accepted-source-preparation.json`. Current `compile-plan.json`
corrects only guard metadata to the actual fixed primitive; source bytes,
command arrays, SDK/cache selection and thresholds remain identical. The
prepared narrow runner and exact command/proof scope are in [RUNNER-PLAN.md](RUNNER-PLAN.md).

The original `input_context.cpp` compiled successfully in 4.549 seconds.
Neither it nor the new module has an attributed recorded memory peak:
compile results contain elapsed/exit only, the general checkpoint lacks TU
attribution, and link/optimizer peaks measure a different process. **1 GiB
fit is unknown for both TUs.** The guarded trial must measure fit; a cap stop
is a resource result rather than proof of a source defect.

Independent source review found no concrete type/access/declaration issue.
Successful objects would establish TU validity and EM_JS lowering only.
Final exports/linking, Asyncify/host notifications, original producer execution,
host copying, native/Rust parity, state/RNG purity and browser/game flows remain
pending. Historical source-review/preparation files stay unchanged.
