$ErrorActionPreference='Stop'
$drlFsRoot=$PSScriptRoot
$drlFsCompiler=Join-Path $drlFsRoot 'fpc-src/compiler/ppcwasm32.exe'
$drlFsSource=Join-Path $drlFsRoot 'wasm-probe/filesystem.pas'
$drlFsOutput=Join-Path $drlFsRoot 'wasm-probe'
$drlFsLinker=if($env:DRL_LLVM_BIN){$env:DRL_LLVM_BIN}else{Join-Path $env:USERPROFILE 'emsdk/upstream/bin'}
$drlFsLayoutSource=Join-Path $drlFsOutput 'wasi-layout.c'
$drlFsLayoutObject=Join-Path $drlFsOutput 'wasi-layout.o'
$drlFsClang=Join-Path $drlFsLinker 'clang.exe'
$drlFsClangArguments=@('--target=wasm32-wasip1','-O1','-c',$drlFsLayoutSource,'-o',$drlFsLayoutObject)
& $drlFsClang @drlFsClangArguments *> (Join-Path $drlFsOutput 'compile-layout.log')
if($LASTEXITCODE -ne 0){Get-Content -LiteralPath (Join-Path $drlFsOutput 'compile-layout.log');throw 'External linker layout bridge failed'}
$drlFsArguments=@('-n','-Twasip1','-CTwasmexceptions','-Xe',('-FD'+$drlFsLinker),('-Fu'+(Join-Path $drlFsRoot 'rtl-exnref')),('-FU'+$drlFsOutput),('-FE'+$drlFsOutput),('-o'+(Join-Path $drlFsOutput 'filesystem.wasm')),'-k--threads=2','-k--max-memory=67108864','-k--wrap=FPC_WASM_SETINITIALHEAPBLOCKSTART','-k--export=__heap_base','-k--export=__stack_pointer',('-k'+$drlFsLayoutObject),$drlFsSource)
$drlFsSourceHash=(Get-FileHash -LiteralPath $drlFsSource -Algorithm SHA256).Hash.ToLowerInvariant()
& $drlFsCompiler @drlFsArguments *> (Join-Path $drlFsOutput 'compile-filesystem.log')
$drlFsExit=$LASTEXITCODE
$drlFsEvidence=@{command=@($drlFsCompiler)+$drlFsArguments;clang_command=@($drlFsClang)+$drlFsClangArguments;layout_source_sha256=(Get-FileHash -LiteralPath $drlFsLayoutSource -Algorithm SHA256).Hash.ToLowerInvariant();layout_object_sha256=(Get-FileHash -LiteralPath $drlFsLayoutObject -Algorithm SHA256).Hash.ToLowerInvariant();source_sha256=$drlFsSourceHash;source_unchanged=($drlFsSourceHash -eq (Get-FileHash -LiteralPath $drlFsSource -Algorithm SHA256).Hash.ToLowerInvariant());exit_code=$drlFsExit;browser_executed=$false}
if($drlFsExit -eq 0){$drlFsEvidence.wasm_sha256=(Get-FileHash -LiteralPath (Join-Path $drlFsOutput 'filesystem.wasm') -Algorithm SHA256).Hash.ToLowerInvariant()}
$drlFsEvidence|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $drlFsOutput 'filesystem.compile.json') -Encoding utf8
Get-Content -LiteralPath (Join-Path $drlFsOutput 'compile-filesystem.log')
if($drlFsExit -ne 0 -or !$drlFsEvidence.source_unchanged){throw 'Authored filesystem probe compile/link failed'}
