param([string]$CompilerRoot=$(if($env:DRL_LLVM_BIN){$env:DRL_LLVM_BIN}else{Join-Path $env:USERPROFILE 'emsdk\upstream\bin'}))
$ErrorActionPreference='Stop'
$probeRoot=$PSScriptRoot
& node.exe (Join-Path $probeRoot 'prepare.mjs')
if($LASTEXITCODE -ne 0){throw 'Source preparation failed'}
$sysroot=Join-Path $probeRoot 'toolchain\wasi-sysroot-34.0'
$builtins=Join-Path $probeRoot 'toolchain\libclang_rt-34.0\wasm32-unknown-wasip1\libclang_rt.builtins.a'
$out=Join-Path $probeRoot 'build';New-Item -ItemType Directory -Path $out -Force|Out-Null
$clang=Join-Path $CompilerRoot 'clang.exe'
$flags=@('--target=wasm32-wasip1',"--sysroot=$sysroot",'-O1','-g','-D_WASI_EMULATED_PROCESS_CLOCKS','-mllvm','-wasm-enable-sjlj','-mllvm','-wasm-use-legacy-eh=false','-I'+(Join-Path $probeRoot 'lua-src'))
$records=@();$objects=@()
foreach($file in Get-ChildItem -LiteralPath (Join-Path $probeRoot 'lua-src') -Filter '*.c') {
  if($file.Name -in @('lua.c','luac.c','print.c')){continue}
  $obj=Join-Path $out ($file.BaseName+'.o');$args=$flags+@('-c',$file.FullName,'-o',$obj)
  $log=Join-Path $out ($file.BaseName+'.log');& $clang @args *> $log
  $records+=@{source=$file.Name;command=@($clang)+$args;exit_code=$LASTEXITCODE}
  if($LASTEXITCODE -ne 0){Get-Content -LiteralPath $log;throw "Compile failed: $($file.Name)"}
  $objects+=$obj
}
$archive=Join-Path $out 'lua5.1.a'; & (Join-Path $CompilerRoot 'llvm-ar.exe') rcs $archive @objects
if($LASTEXITCODE -ne 0){throw 'Archive failed'}
& $clang @flags -c (Join-Path $probeRoot 'bridge.c') -o (Join-Path $out 'bridge.o') *> (Join-Path $out 'bridge.log')
if($LASTEXITCODE -ne 0){Get-Content -LiteralPath (Join-Path $out 'bridge.log');throw 'Bridge compile failed'}
& (Join-Path $CompilerRoot 'llvm-ar.exe') rcs (Join-Path $out 'drl-lua-bridge.a') (Join-Path $out 'bridge.o')
if($LASTEXITCODE -ne 0){throw 'Bridge archive failed'}
$wasm=Join-Path $out 'lua-probe.wasm'
$wasiLib=Join-Path $sysroot 'lib\wasm32-wasip1'
$link=$flags+@('-nostdlib',(Join-Path $wasiLib 'crt1-command.o'),(Join-Path $probeRoot 'probe.c'),$archive,(Join-Path $out 'drl-lua-bridge.a'),'-L'+$wasiLib,'-lc','-lsetjmp','-lwasi-emulated-process-clocks',$builtins,'-Wl,--stack-first','-Wl,-z,stack-size=1048576','-Wl,--max-memory=67108864','-Wl,--threads=2','-o',$wasm)
& $clang @link *> (Join-Path $out 'link.log')
$records+=@{source='probe.c';command=@($clang)+$link;exit_code=$LASTEXITCODE}
$records|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $probeRoot 'build-commands.json') -Encoding utf8
if($LASTEXITCODE -ne 0){Get-Content -LiteralPath (Join-Path $out 'link.log');throw 'Link failed'}
Get-FileHash -LiteralPath $wasm,$archive -Algorithm SHA256
