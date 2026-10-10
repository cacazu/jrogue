# JSPI indirect suspension and exception fixture

This isolated fixture compares the installed Emscripten SDK's JavaScript-based
C++ exception handling (`-fexceptions`) with native Wasm exception handling
(`-fwasm-exceptions`) at the same `-O1` level. It contains no DCSS gameplay code.
The fixture has been prepared and reviewed as source only; it has not been built
or run by its author.

`caller.cpp` reads an external volatile function pointer defined in `callee.cpp`.
Both calls occur inside C++ try blocks. The unexported callee yields through the
callback-style `Asyncify.handleSleep` library import. On the first deferred wake
it returns 101; on the second it throws integer 102, which the caller must catch.
Separate translation units, no LTO, and the external volatile pointer retain the
indirect boundary. The JS-EH run additionally requires an actual `invoke_ii`
function import, parsed from the Wasm bytes without compiling a second module.

The driver requires an exported-main Promise resolving numeric zero, exactly two
deferred wakes, the ordered return/catch markers, and `FIXTURE PASS`. It reports
imports, stdout, stderr, and events as JSON. Timer callback failures and a bounded
main timeout report failure; a fulfilled Promise alone cannot pass the fixture.
The ten-second watchdog starts after factory readiness and `callMain` returns;
it bounds a pending main, not module loading or a synchronous hang.

Run only after the current engine build/link has finished. Run the following
PowerShell commands sequentially; these paths match the installed SDK. They
write only this fixture's `out` subdirectory and do not load a DCSS artifact.
The initial diagnostic's SDK standard-library build ran without these worker
caps. Its receipts are historical evidence; the commands below cap future
compilations and links to one SDK compiler worker and one Binaryen worker.

```powershell
$env:EMCC_CORES = '1'
$env:BINARYEN_CORES = '1'
$fixture = 'C:\Users\kit\gameme\jnethack\jrouge\dcss\tests\jspi-suspension'
$sdkPython = 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe'
$emxx = 'C:\Users\kit\emsdk\upstream\emscripten\em++.py'
$sdkNode = 'C:\Users\kit\emsdk\node\24.19.0_64bit\node.exe'
$jsEh = Join-Path $fixture 'out\js-eh'
$wasmEh = Join-Path $fixture 'out\wasm-eh'
New-Item -ItemType Directory -Force -Path $jsEh,$wasmEh | Out-Null

function Invoke-FixtureEmxx {
    param([string[]]$CompilerArguments)
    & $sdkPython $emxx @CompilerArguments
    if ($LASTEXITCODE -ne 0) { throw "fixture compiler/link failed: $LASTEXITCODE" }
}

# JavaScript-based EH: fresh objects, then one link, then one driver run.
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fexceptions','-c',(Join-Path $fixture 'caller.cpp'),'-o',(Join-Path $jsEh 'caller.o'))
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fexceptions','-c',(Join-Path $fixture 'callee.cpp'),'-o',(Join-Path $jsEh 'callee.o'))
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fexceptions',(Join-Path $jsEh 'caller.o'),(Join-Path $jsEh 'callee.o'),'--js-library',(Join-Path $fixture 'library.js'),'-sJSPI=1','-sJSPI_EXPORTS=["main"]','-sEXPORTED_FUNCTIONS=["_main"]','-sEXPORTED_RUNTIME_METHODS=["callMain"]','-sMODULARIZE=1','-sEXPORT_NAME=createJspiSuspensionFixture','-sENVIRONMENT=node','-sINVOKE_RUN=0','-sEXIT_RUNTIME=1','-sASSERTIONS=1','-o',(Join-Path $jsEh 'fixture.js'))
& $sdkNode --experimental-wasm-jspi (Join-Path $fixture 'driver.cjs') (Join-Path $jsEh 'fixture.js') --require-invoke
$jsEhDriverExit = $LASTEXITCODE

# Native Wasm EH: independently compiled objects and a separate output path.
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fwasm-exceptions','-c',(Join-Path $fixture 'caller.cpp'),'-o',(Join-Path $wasmEh 'caller.o'))
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fwasm-exceptions','-c',(Join-Path $fixture 'callee.cpp'),'-o',(Join-Path $wasmEh 'callee.o'))
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fwasm-exceptions',(Join-Path $wasmEh 'caller.o'),(Join-Path $wasmEh 'callee.o'),'--js-library',(Join-Path $fixture 'library.js'),'-sJSPI=1','-sJSPI_EXPORTS=["main"]','-sEXPORTED_FUNCTIONS=["_main"]','-sEXPORTED_RUNTIME_METHODS=["callMain"]','-sMODULARIZE=1','-sEXPORT_NAME=createJspiSuspensionFixture','-sENVIRONMENT=node','-sINVOKE_RUN=0','-sEXIT_RUNTIME=1','-sASSERTIONS=1','-o',(Join-Path $wasmEh 'fixture.js'))
& $sdkNode --experimental-wasm-jspi (Join-Path $fixture 'driver.cjs') (Join-Path $wasmEh 'fixture.js')
$wasmEhDriverExit = $LASTEXITCODE
[pscustomobject]@{ jsEhDriverExit=$jsEhDriverExit; wasmEhDriverExit=$wasmEhDriverExit }
```

Exit zero means this fixture passed. Nonzero JSON identifies an unsupported JSPI
host, a missing indirect boundary, a rejected main, timeout, or incorrect return
or catch behavior. Preserve both results, even if the first run fails. An absent
`invoke_ii` in the JS-EH build invalidates that run's intended boundary.

This checks one indirect `int(int)` suspension and integer catch. A pass does not
establish arbitrary Lua/virtual-call parity, DCSS save reentry safety, or behavior
at other optimization levels. Do not mix flag-specific object files or export
the callee; exporting it could change selective JSPI table wrapping.

Relevant installed SDK evidence: `src/lib/libasync.js:161-175,463-476`,
`tools/js_manipulation.py:128-150`, `src/lib/libcore.js:1915-1918`, and
`tools/link.py:65-68,1735-1738`. The C++ link driver is deliberate:
`src/settings.js:2098` defaults `DEFAULT_TO_CXX` to false; `tools/link.py:1789`
selects C++ mode from `em++`, and `tools/system_libs.py:2482-2485` selects the
C++/exception ABI libraries from that mode.

Define `FIXTURE_CTOR` to add a global constructor that calls the same external
volatile target inside a try block with mode zero. That callee path returns 73
before the yield import. The driver requires `FIXTURE CTOR value=73` during
factory initialization, with no yield, when passed `--expect-ctor`. Main still
performs its original two deferred yields and integer catch. This variant checks
whether the synchronous constructor path through `invoke_ii` can run before the
promising main entry. Use fresh output paths and both flags on the JS-EH driver:

```powershell
# Uses the SDK/path variables and Invoke-FixtureEmxx function defined above.
$ctorJsEh = Join-Path $fixture 'out\ctor-js-eh'
$ctorWasmEh = Join-Path $fixture 'out\ctor-wasm-eh'
New-Item -ItemType Directory -Force -Path $ctorJsEh,$ctorWasmEh | Out-Null
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fexceptions','-DFIXTURE_CTOR','-c',(Join-Path $fixture 'caller.cpp'),'-o',(Join-Path $ctorJsEh 'caller.o'))
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fexceptions','-DFIXTURE_CTOR','-c',(Join-Path $fixture 'callee.cpp'),'-o',(Join-Path $ctorJsEh 'callee.o'))
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fexceptions',(Join-Path $ctorJsEh 'caller.o'),(Join-Path $ctorJsEh 'callee.o'),'--js-library',(Join-Path $fixture 'library.js'),'-sJSPI=1','-sJSPI_EXPORTS=["main"]','-sEXPORTED_FUNCTIONS=["_main"]','-sEXPORTED_RUNTIME_METHODS=["callMain"]','-sMODULARIZE=1','-sEXPORT_NAME=createJspiSuspensionFixture','-sENVIRONMENT=node','-sINVOKE_RUN=0','-sEXIT_RUNTIME=1','-sASSERTIONS=1','-o',(Join-Path $ctorJsEh 'fixture.js'))
& $sdkNode --experimental-wasm-jspi (Join-Path $fixture 'driver.cjs') (Join-Path $ctorJsEh 'fixture.js') --require-invoke --expect-ctor
$ctorJsEhDriverExit = $LASTEXITCODE
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fwasm-exceptions','-DFIXTURE_CTOR','-c',(Join-Path $fixture 'caller.cpp'),'-o',(Join-Path $ctorWasmEh 'caller.o'))
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fwasm-exceptions','-DFIXTURE_CTOR','-c',(Join-Path $fixture 'callee.cpp'),'-o',(Join-Path $ctorWasmEh 'callee.o'))
Invoke-FixtureEmxx -CompilerArguments @('-O1','-fwasm-exceptions',(Join-Path $ctorWasmEh 'caller.o'),(Join-Path $ctorWasmEh 'callee.o'),'--js-library',(Join-Path $fixture 'library.js'),'-sJSPI=1','-sJSPI_EXPORTS=["main"]','-sEXPORTED_FUNCTIONS=["_main"]','-sEXPORTED_RUNTIME_METHODS=["callMain"]','-sMODULARIZE=1','-sEXPORT_NAME=createJspiSuspensionFixture','-sENVIRONMENT=node','-sINVOKE_RUN=0','-sEXIT_RUNTIME=1','-sASSERTIONS=1','-o',(Join-Path $ctorWasmEh 'fixture.js'))
& $sdkNode --experimental-wasm-jspi (Join-Path $fixture 'driver.cjs') (Join-Path $ctorWasmEh 'fixture.js') --expect-ctor
$ctorWasmEhDriverExit = $LASTEXITCODE
[pscustomobject]@{ ctorJsEhDriverExit=$ctorJsEhDriverExit; ctorWasmEhDriverExit=$ctorWasmEhDriverExit }
```
