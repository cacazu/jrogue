# Official Windows-hosted FPC WASI build

The compiler gate is cleared for pure Pascal: an official source-built **Windows x64-hosted FPC 3.3.1 compiler**, wasm32/wasip1 RTL and required auxiliary packages are now available in the task-local toolchain. Both branchful and current WebAssembly exception builds of an authored Pascal test compile and execute successfully in Node 24's WASI host. This is a compiler/RTL capability milestone; it does not certify the mixed Lua ABI, original DRL campaign or browser publication.

## Acquired official source and tools

| Input | Verified identity |
| --- | --- |
| FPC source | Official [repository](https://gitlab.com/freepascal.org/fpc/source), commit `843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d` |
| Source archive | [Immutable API archive](https://gitlab.com/api/v4/projects/freepascal.org%2Ffpc%2Fsource/repository/archive.zip?sha=843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d), 79,307,009 bytes, SHA-256 `fb97cbb1ac458df86d7345312380587cb81bda4407ae7077eb06b87f7ef701bf` |
| ZIP inspection | All 28,142 entries inspected; 350,348,786 uncompressed bytes; no rooted/traversal/colon paths or symlinks |
| Bootstrap compiler | Previously inspected [official portable snapshot](FPC-PROBE.md): `3.3.1 2026/09/22 3.3.1-20895-g843eb4a6ac`; i386/Win32 host generating x86_64/Win64; SHA-256 `fc3a8184a70722be726264faac4357fe11851e3edb899be8ced0aea82d4e9cb0` |
| Windows GNU helpers | Official [FPC Build repository](https://gitlab.com/freepascal.org/fpc/build), pinned commit `30a84683adc33fa8ce5e57cfc2f587c071cd266d`, `install/binw32/` files fetched through immutable API URLs |
| GNU make | 3.82, i686-pc-mingw32; SHA-256 `a63d7e325319418325a2c8579cb774aa5236604faa153d16466446af104e4b1a` |

The initial GitLab webpage archive request encountered its Cloudflare challenge. The official GitLab API archive succeeded with HTTP 200; no browser challenge bypass was used. Initial source response headers were not retained. The archive's local SHA-256 and the immutable Git revision pin the acquired input; no publisher signature was independently verified. [The manifest](../toolchain/fpc-wasm-build-manifest.json) states these limits explicitly and hashes the build helpers, output compiler, units and notices.

The [official development instructions](https://www.freepascal.org/develop.html) recommend stable 3.2.2 as bootstrap. The already acquired matching development snapshot successfully built the cross compiler directly with its matching Win64 RTL. This demonstrated route avoids running or unpacking a stable installer. It does not claim a full native compiler bootstrap cycle or byte-for-byte reproducibility across build dates.

## Actual build commands

All build stages are sequential and use at most two make jobs. PATH changes are process-local. `-n` prevents reads of global FPC configuration. No installer, global installation, security setting or Git mutation was performed. The reproducible command recipe is [build-fpc-wasm.ps1](../toolchain/build-fpc-wasm.ps1); its official source archive checksum is checked before the build. The pinned archive remains pristine under `toolchain/acquisition/wasm-build/`; the extracted build tree under `toolchain/fpc-src/` contains normal generated artifacts.

From the task workspace, the successful compiler command is equivalent to:

```powershell
toolchain/build-tools/make.exe -j2 -C toolchain/fpc-src/compiler wasm32 `
  FPC=<absolute task>/toolchain/fpc-win64-snapshot/bin/i386-win32/ppcrossx64.exe `
  CPU_TARGET=x86_64 OS_TARGET=win64 `
  'OPT=-n -Fu<absolute task>/toolchain/fpc-win64-snapshot/units/x86_64-win64/rtl'
```

This `wasm32` make target selects the compiler's wasm32 backend while the bootstrap generates a native Win64 compiler executable. It also builds the matching host RTL and message converter. Exit code 0 is retained in [build-compiler-run.json](../toolchain/acquisition/wasm-build/build-compiler-run.json) and [the full log](../toolchain/acquisition/wasm-build/build-compiler.log).

The WASI RTL builds use the produced compiler, not the earlier x64-only compiler:

```powershell
make.exe -j2 -C toolchain/fpc-src/rtl all FPC=<absolute compiler>/ppcwasm32.exe `
  CPU_TARGET=wasm32 OS_TARGET=wasip1 OPT=-n
make.exe -j2 -C toolchain/fpc-src/rtl all FPC=<absolute compiler>/ppcwasm32.exe `
  CPU_TARGET=wasm32 OS_TARGET=wasip1 'OPT=-n -CTwasmexceptions' `
  COMPILER_UNITTARGETDIR=<absolute task>/toolchain/rtl-exnref
```

Each RTL has 78 PPU units. Default exception mode is branchful, as the pinned `compiler/options.pas:5778` explicitly selects. `-CTwasmexceptions` selects current native WASM exceptions with exnref. `-CTlegacyexceptions` is also supported by this compiler but was not selected or tested. Use the matching RTL and code-generation mode for each application build.

The official package build tooling was compiled for Win64 using the bootstrap and matching host RTL. Eight selected packages built for WASI with `FPC=<WASM compiler>`, `FPCFPMAKE=<Win64 bootstrap>`, `CPU_TARGET=wasm32`, `OS_TARGET=wasip1`, `CPU_SOURCE=x86_64`, `OS_SOURCE=win64`, `OPT=-n`:

| Package | PPU units | Key DRL dependency |
| --- | ---: | --- |
| rtl-objpas | 18 | StrUtils, DateUtils, variants |
| rtl-generics | 6 | Generics support |
| rtl-unicode | 19 | Unicode utilities |
| rtl-extra | 4 | Hash dependency |
| hash | 7 | Paszlib dependency |
| paszlib | 19 | ZStream, ZIP compression |
| fcl-base | 45 | FCL utilities |
| fcl-xml | 20 | DOM/XML |

The initial paszlib/hash attempts reported missing dependency directories; building `rtl-extra → hash → paszlib` resolved them without source patches. Successful branchful package outputs are at `toolchain/fpc-src/packages/<package>/units/wasm32-wasip1/`.

The same eight packages were subsequently compiled successfully with current WASM exceptions into **separate** `toolchain/packages-exnref/<package>/units/wasm32-wasip1/` directories. [build-fpc-packages-exnref.ps1](../toolchain/build-fpc-packages-exnref.ps1) copies only unchanged official package sources, invokes the already-built official Win64 `fpmake` with `--threads=2` and `-CTwasmexceptions`, and records every invocation in [build-runs.json](../toolchain/packages-exnref/build-runs.json). The separate dependency tree includes byte-identical exnref RTL copies under `units/wasm32-wasip1/rtl` with an authored installed-package marker. This keeps dependency discovery within the matching exception mode and leaves the branchful PPU files intact. Select these separate paths for the mixed Lua current-EH core.

## Executable and test evidence

| Output | Verified result |
| --- | --- |
| `toolchain/fpc-src/compiler/ppcwasm32.exe` | 5,691,478 bytes; PE machine `0x8664` (Win64 host); SHA-256 `5ac9eaad7c3276872ac0bd9f832c010214cec41562d3116b2d455be14028aa15` |
| Source/target queries | `-iSP/-iSO`: x86_64/win64; `-iTP/-iTO`: wasm32/wasip1; all exit 0 |
| Supported targets | wasip1, wasip1threads, wasip2 and embedded reported; only single-threaded wasip1 tested |
| Self-report | `3.3.1 2026/10/02 3.3.1`; extracted archive lacks Git metadata, so revision is established by input archive, not self-report |
| Branchful authored probe | 2,425,122 bytes; SHA-256 `23196b52afeee182c08e923a1f276ad1ce978e3195c96e1ef8268f021bec906b`; compile 0, execution 0 |
| Current-EH authored probe | 2,314,193 bytes; SHA-256 `46b992f339ae8634151d464a171502e5da60f3a48513da42af3645454225b1f2`; compile 0, execution 0 |

The [authored Pascal source](../toolchain/wasm-probe/hello.pas) checks 32-bit pointers, cdecl function pointers, managed strings, heap allocations, memory-stream read/write, Pascal exception recovery, and ties-to-even Round. [run.mjs](../toolchain/wasm-probe/run.mjs) actually instantiates each module in Node 24.19.0 WASI Preview1 with empty arguments/environment and **no filesystem preopens**. Full actual imports/exports are retained in [branchful execution](../toolchain/wasm-probe/hello.wasm.execution.json) and [current-EH execution](../toolchain/wasm-probe/hello-exnref.wasm.execution.json). These tests contain no original DRL simulation or Lua calls.

The initial authored compile used an unquoted PowerShell `-o` argument and generated an extensionless WASM file, so the first Node loader could not find `hello.wasm`. Using an explicit argument array fixed the output path. The final probe derives rounding inputs from a value restored through a memory stream, so its Round checks execute at runtime. The remaining unreachable-code warning checks the compile-time pointer width; the compiler and application exit successfully.

## Browser continuation and remaining integration

The pinned `rtl/wasicommon/si_prc.pp` exports `_start`, `_start_promising`, `wasiAlloc` and `wasiFree`. FPC's special `promising`/`suspending` wrappers add an externref suspender parameter (`compiler/symcreat.pas:953`), reflecting an older JSPI interface. Their presence is evidence of compiler syntax support, **not proof of compatibility with current browser JSPI**. A narrow current-browser candidate is an ordinary external input import wrapped with `new WebAssembly.Suspending(...)` and ordinary `_start` wrapped by `WebAssembly.promising(...)`. The browser host task must prove nested Pascal/Lua call-stack suspension and resumption before choosing this route.

An authored [suspend.pas](../toolchain/wasm-probe/suspend.pas) was compiled with the current-EH RTL for that browser proof. It imports ordinary `drl_host.sleep(i32)`, keeps three levels of Pascal stack arrays and managed strings across suspension, restores a memory stream after two sleeps, and recovers from a subsequent exception. [suspend.compile.json](../toolchain/wasm-probe/suspend.compile.json) records the module/import audit: 2,314,474 bytes, SHA-256 `a0c6bc44e3c9b5a42cdbbd35d1e70dd68e2bd900285afac78ca736c88245d176`. Compilation is verified; execution belongs to the browser-host task and is not asserted here.

The mixed external-LLD linkage investigation found an additional startup layout requirement. Pure Pascal's internal-linker RTL initializes the heap at `__stack_pointer` (`si_prc.pp:61`), and `system.pp:506` derives StackBottom from that heap start. A mixed C link may place static data above that stack pointer while `__heap_base` starts later. The independent Lua ABI task is adapting startup in its own shadow RTL to obtain external LLD heap/stack bounds separately. The common toolchain units have not been altered for that experiment; successful pure Pascal tests do not certify external C heap layout.

The actual next gates are static Pascal/Lua linkage, integer/debug-record ABI, common allocator ownership, C/Pascal protected errors, platform imports and original browser game flows. The independent Lua ABI and original core adapter tasks have been supplied the compiled toolchain paths. There is no compiler feature failure in these authored tests and no remaining approval decision required for this toolchain milestone. The compiler archive, build tools and pristine source remain local ignored material and were not published.

The [dependency license audit](CORE-DEPENDENCY-LICENSES.md) retains the actual compiler GPL text, RTL LGPL text/link exception, package exception and inherited Paszlib/LazUtils/WASI notices. Optional native SDK bindings require their own treatment; the engine MIT grant does not replace those notices.

An additional authored [filesystem.pas](../toolchain/wasm-probe/filesystem.pas) checks absolute `/user` create/read/seek/rename/enumeration/delete and read-only `/data` access for the browser WASI host. It was authored during the shared executor resource hold and has not yet been compiled or executed. The pinned RTL's `system.pp:320–356` explicitly recognizes a root `/` preopen and converts absolute paths to its relative path for WASI calls; actual browser behavior remains to be tested.
