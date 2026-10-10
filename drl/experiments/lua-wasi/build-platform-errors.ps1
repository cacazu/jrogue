param([string]$CompilerRoot=$(if($env:DRL_LLVM_BIN){$env:DRL_LLVM_BIN}else{Join-Path $env:USERPROFILE 'emsdk\upstream\bin'}))
$ErrorActionPreference='Stop'
$probeRoot=$PSScriptRoot;$out=Join-Path $probeRoot 'build'
& node.exe (Join-Path $probeRoot 'prepare.mjs')
if($LASTEXITCODE -ne 0){throw 'Source preparation failed'}
$archive=Join-Path $out 'lua5.1.a'
$snapshot=Join-Path $out 'lua5.1-c-only-validated.a'
if(!(Test-Path -LiteralPath $snapshot)){Copy-Item -LiteralPath $archive -Destination $snapshot}
$clang=Join-Path $CompilerRoot 'clang.exe'
$sysroot=Join-Path $probeRoot 'toolchain\wasi-sysroot-34.0'
$flags=@('--target=wasm32-wasip1',"--sysroot=$sysroot",'-O1','-g','-D_WASI_EMULATED_PROCESS_CLOCKS','-mllvm','-wasm-enable-sjlj','-mllvm','-wasm-use-legacy-eh=false',('-I'+(Join-Path $probeRoot 'lua-src')))
$records=@();$objects=@()
foreach($name in @('liolib','loslib')){
  $source=Join-Path $probeRoot ('lua-src\'+$name+'.c');$object=Join-Path $out ($name+'.o')
  $arguments=$flags+@('-c',$source,'-o',$object)
  & $clang @arguments *> (Join-Path $out ($name+'-semantic.log'));$compileExit=$LASTEXITCODE
  $records+=@{source=$name+'.c';command=@($clang)+$arguments;exit_code=$compileExit;source_sha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()}
  if($compileExit -ne 0){Get-Content -LiteralPath (Join-Path $out ($name+'-semantic.log'));throw 'Platform-error source compile failed'}
  $objects+=$object
}
& (Join-Path $CompilerRoot 'llvm-ar.exe') rcs $archive @objects
if($LASTEXITCODE -ne 0){throw 'Platform-error archive update failed'}
[ordered]@{commands=$records;archive_sha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant();completed_utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 7|Set-Content -LiteralPath (Join-Path $probeRoot 'platform-errors-build-manifest.json') -Encoding utf8
