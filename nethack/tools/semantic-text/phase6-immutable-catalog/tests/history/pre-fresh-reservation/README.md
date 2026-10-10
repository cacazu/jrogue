This isolated suite checks the compiled registered-catalog boundary after the parent completes the Phase6 engine, reader-data binding and acceptance config. Its current checkpoint proves only Python source guards and exact frozen input bytes; no JavaScript, Wasm, browser or compiler was started to prepare it.

Run from the workspace root in the parent's measured serial slot:

```powershell
$env:NETHACK_PARENT_SERIAL_SLOT = 'phase6'
& 'C:\Program Files\nodejs\node.exe' --max-old-space-size=128 nethack/tools/semantic-text/phase6-immutable-catalog/tests/registered-catalog-wasm.mjs --stage-config nethack/build/phase6/acceptance-config.json
```

The shared stage reader pins all eleven installed runtime files, actual C/Lua/header inputs, test dependencies, source manifests, and the real target reader-data gate. Before importing the selected engine, this suite additionally pins final Rust proof `d115a3d6b82dcba2233f15a70be052d2c1895fb931cde6f8edcee49dac667ff3`, its selected crate/fixtures/header/library, and exact library agreement with the engine manifest. It uses one module with `noInitialRun:true`.

The 32 grouped cases cover registration of the complete merged catalog, caller-owned JSON disposal, monotonically increasing module-local handles, eight-catalog admission/release, foreign-module host rejection, registered/stateless EN/JA equivalence, UTF8 and numeric transport, nested fallback and locale-specific argument unions, quest completion, node/argument/depth/output limits, query/short/error canaries and final teardown. Native checksums are read before and after repeated pure rendering. A separate test verifies that the native getter returns no event outside actual callback scope.

The output is `<config.report_directory>/compiled-verification.json`. It reports `status`, `failed`, the actual executed `total_passed`, `wasm_sha256`, `runtime_sha256` and `source_sha256`. Runtime paths use source-offer aliases `web/<name>`; selected Rust files use `rust/<leaf>`; actual compiled C/Lua/headers use `engine-source/<name>`. `source_inputs` records each alias's actual project path. Config, stage references and selected Rust proof/library remain separate evidence references. The source package auditor can resolve these aliases directly.

Errors in fixtures produce failed cases and exit code 1. Failed hash/data/execution gates stop before engine import and cannot produce a passing report. Synthetic semantic values do not prove actual C producer capture or lifetime; the report explicitly sets `native_callback_semantics_verified:false` and `compiled_pipeline_verified:false`. Numeric handles must never be carried into a replacement module. This one-instance suite does not test actual module replacement, concurrent release or eventual handle exhaustion, and it makes no speedup claim. Browser acceptance and the same100 accumulated-history benchmark remain separate gates.

To reproduce the lightweight source checkpoint without running any runtime:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 nethack/tools/semantic-text/phase6-immutable-catalog/tests/prepare-source-checkpoint.py
```
