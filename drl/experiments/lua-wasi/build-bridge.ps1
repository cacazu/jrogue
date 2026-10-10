param([string]$CompilerRoot=$(if($env:DRL_LLVM_BIN){$env:DRL_LLVM_BIN}else{Join-Path $env:USERPROFILE 'emsdk\upstream\bin'}))
$ErrorActionPreference='Stop'
$probeRoot=$PSScriptRoot;$out=Join-Path $probeRoot 'build'
$sysroot=Join-Path $probeRoot 'toolchain\wasi-sysroot-34.0'
$clang=Join-Path $CompilerRoot 'clang.exe'
$args=@('--target=wasm32-wasip1',"--sysroot=$sysroot",'-O1','-g','-fno-builtin-malloc','-fno-builtin-calloc','-fno-builtin-realloc','-fno-builtin-free','-mllvm','-wasm-enable-sjlj','-mllvm','-wasm-use-legacy-eh=false',('-I'+(Join-Path $probeRoot 'lua-src')),'-c',(Join-Path $probeRoot 'bridge.c'),'-o',(Join-Path $out 'bridge.o'))
& $clang @args *> (Join-Path $out 'bridge.log');$compileExit=$LASTEXITCODE
if($compileExit -ne 0){Get-Content -LiteralPath (Join-Path $out 'bridge.log');throw 'Bridge compile failed'}
$archive=Join-Path $out 'drl-lua-bridge.a'
& (Join-Path $CompilerRoot 'llvm-ar.exe') rcs $archive (Join-Path $out 'bridge.o')
if($LASTEXITCODE -ne 0){throw 'Bridge archive failed'}
[ordered]@{command=@($clang)+$args;compile_exit=$compileExit;source_sha256=(Get-FileHash -LiteralPath (Join-Path $probeRoot 'bridge.c') -Algorithm SHA256).Hash.ToLowerInvariant();archive_sha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant();completed_utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $probeRoot 'bridge-build-manifest.json') -Encoding utf8
