param([string]$Source='probe-mixed.pas',[string]$Output='mixed-probe.wasm',[switch]$HeapPatch,[switch]$ShadowStartup,[switch]$Jspi,
  [string]$CompilerRoot=$(if($env:DRL_LLVM_BIN){$env:DRL_LLVM_BIN}else{Join-Path $env:USERPROFILE 'emsdk\upstream\bin'}))
$ErrorActionPreference='Stop'
if($Jspi -and $Output -eq 'mixed-probe.wasm'){$Output='mixed-probe-jspi.wasm'}
$probeRoot=$PSScriptRoot;$taskRoot=Split-Path (Split-Path $probeRoot -Parent) -Parent
$variant=if($Jspi){'-jspi'}else{''}
$compiler=Join-Path $taskRoot 'toolchain\fpc-src\compiler\ppcwasm32.exe'
$rtl=Join-Path $taskRoot 'toolchain\rtl-exnref'
$out=Join-Path $probeRoot 'mixed-build';New-Item -ItemType Directory -Path $out -Force|Out-Null
function Get-ProbeInputRecord([string]$File,[string]$Kind){
  $absolute=[IO.Path]::GetFullPath($File)
  return @{path=$absolute;kind=$Kind;sha256=(Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant()}
}
if($ShadowStartup){
  & node.exe (Join-Path $probeRoot 'prepare-startup.mjs');if($LASTEXITCODE -ne 0){throw 'Startup preparation failed'}
  $shadow=Join-Path $probeRoot 'startup-overlay'
  & $compiler '-n' '-Twasip1' '-CTwasmexceptions' '-Cn' ('-Fu'+$rtl) ('-FU'+$shadow) (Join-Path $shadow 'si_prc.pp') *> (Join-Path $shadow 'compile.log')
  if($LASTEXITCODE -ne 0){Get-Content -LiteralPath (Join-Path $shadow 'compile.log');throw 'Shadow startup compile failed'}
}
$wasiLib=Join-Path $probeRoot 'toolchain\wasi-sysroot-34.0\lib\wasm32-wasip1'
$archives=@((Join-Path $probeRoot 'build\drl-lua-bridge.a'),(Join-Path $probeRoot 'build\lua5.1.a'),(Join-Path $wasiLib 'libc.a'),(Join-Path $wasiLib 'libsetjmp.a'),(Join-Path $wasiLib 'libwasi-emulated-process-clocks.a'),(Join-Path $probeRoot 'toolchain\libclang_rt-34.0\wasm32-unknown-wasip1\libclang_rt.builtins.a'))
$sourcePath=[IO.Path]::GetFullPath((Join-Path $probeRoot $Source))
$mapPath=Join-Path $out ('mixed'+$variant+'.map')
$inputCandidates=@(Get-ProbeInputRecord $compiler 'compiler')
foreach($archive in $archives){$inputCandidates+=Get-ProbeInputRecord $archive 'archive'}
$inputCandidates+=Get-ProbeInputRecord $sourcePath 'pascal-source'
foreach($file in Get-ChildItem -LiteralPath (Join-Path $probeRoot 'pascal-overlay') -File | Where-Object {$_.Extension -in @('.pas','.pp','.inc')}){
  $inputCandidates+=Get-ProbeInputRecord $file.FullName 'pascal-overlay-source'
}
# Capture all candidate objects before linking, then retain only map-selected objects.
# All PPU hashes are retained conservatively, including type-only dependencies without code.
foreach($file in Get-ChildItem -LiteralPath $rtl -File | Where-Object {$_.Extension -in @('.ppu','.o')}){
  $kind=if($file.Extension -eq '.ppu'){'rtl-ppu'}else{'rtl-object'}
  $inputCandidates+=Get-ProbeInputRecord $file.FullName $kind
}
if($ShadowStartup){foreach($name in @('si_prc.pp','si_prc.ppu','si_prc.o')){
  $inputCandidates+=Get-ProbeInputRecord (Join-Path $shadow $name) 'shadow-startup'
}}
$startedUtc=[DateTime]::UtcNow.ToString('o')
# Rebuild authored Pascal units so their captured source is not substituted by stale PPUs.
$args=@('-n','-B','-Twasip1','-CTwasmexceptions','-Xe',('-FD'+$CompilerRoot),('-Fu'+$rtl),('-Fl'+(Join-Path $probeRoot 'build')),('-Fl'+$wasiLib),('-Fl'+(Join-Path $probeRoot 'toolchain\libclang_rt-34.0\wasm32-unknown-wasip1')),('-FE'+$out),('-FU'+$out),('-o'+(Join-Path $out $Output)),'-k--export-memory','-k--export=__heap_base','-k--export=__stack_pointer',('-k--Map='+$mapPath))
$args+=('-Fu'+(Join-Path $probeRoot 'pascal-overlay'))
$args+='-k--max-memory=67108864'
$args+='-k--threads=2'
if($ShadowStartup){$args=@('-Fu'+$shadow)+$args}
if($HeapPatch){$args+='-k--wrap=FPC_WASM_SETINITIALHEAPBLOCKSTART'}
if($Jspi){$args+='-dDRL_PROBE_JSPI'}
foreach($archive in $archives){$args+=('-k'+$archive)}
$args+=$sourcePath
Push-Location -LiteralPath $taskRoot
try{& $compiler @args *> (Join-Path $out ($Source+$variant+'.log'));$exitCode=$LASTEXITCODE}
finally{Pop-Location}
$outputHash=$null;if($exitCode -eq 0){$outputHash=(Get-FileHash -LiteralPath (Join-Path $out $Output) -Algorithm SHA256).Hash.ToLowerInvariant()}
$mapHash=$null;$usedRtlObjects=@();$provenanceErrors=@()
if($exitCode -eq 0){
  $mapText=Get-Content -LiteralPath $mapPath -Raw
  $mapHash=(Get-FileHash -LiteralPath $mapPath -Algorithm SHA256).Hash.ToLowerInvariant()
  foreach($match in [regex]::Matches($mapText,'(?m)^\s*(?:-|[0-9a-fA-F]+)\s+(?:-|[0-9a-fA-F]+)\s+[0-9a-fA-F]+\s+(.+?\.o):\(')){
    $objectPath=$match.Groups[1].Value
    if(-not [IO.Path]::IsPathRooted($objectPath)){$objectPath=Join-Path $taskRoot $objectPath}
    $objectPath=[IO.Path]::GetFullPath($objectPath)
    if($objectPath.StartsWith($rtl+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){$usedRtlObjects+=$objectPath}
  }
  $usedRtlObjects=@($usedRtlObjects | Sort-Object -Unique)
  if($usedRtlObjects.Count -eq 0){$provenanceErrors+='No used RTL objects identified in final map'}
}
$inputsBefore=@($inputCandidates | Where-Object {$_.kind -ne 'rtl-object' -or $_.path -in $usedRtlObjects})
$inputsAfter=@();foreach($inputRecord in $inputsBefore){
  $afterRecord=Get-ProbeInputRecord $inputRecord.path $inputRecord.kind;$inputsAfter+=$afterRecord
  if($afterRecord.sha256 -ne $inputRecord.sha256){$provenanceErrors+=('Build input changed: '+$inputRecord.path)}
}
foreach($objectPath in $usedRtlObjects){if(-not ($inputsBefore | Where-Object {$_.path -eq $objectPath})){$provenanceErrors+=('Used RTL object was not captured before compilation: '+$objectPath)}}
$archiveRecords=@($inputsBefore | Where-Object {$_.kind -eq 'archive'} | ForEach-Object {@{path=$_.path;sha256=$_.sha256}})
$compilerHash=($inputsBefore | Where-Object {$_.kind -eq 'compiler'}).sha256
$provenance=@{schema_version=1;started_utc=$startedUtc;inputs_before=$inputsBefore;inputs_after=$inputsAfter;used_rtl_objects=$usedRtlObjects;inputs_stable=($provenanceErrors.Count -eq 0);errors=$provenanceErrors;map_path=$mapPath;map_sha256=$mapHash;module_path=(Join-Path $out $Output);module_sha256=$outputHash;ppu_scope='All candidate RTL PPUs; map-selected RTL objects only'}
@{command=@($compiler)+$args;exit_code=$exitCode;compiler_sha256=$compilerHash;archives=$archiveRecords;output_sha256=$outputHash;provenance=$provenance;completed_utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $probeRoot ($Source+$variant+'-commands.json')) -Encoding utf8
Get-Content -LiteralPath (Join-Path $out ($Source+$variant+'.log'))
if($exitCode -ne 0){throw 'Mixed ABI compile/link failed'}
if($provenanceErrors.Count -ne 0){throw ('Mixed ABI build input provenance failed: '+($provenanceErrors -join '; '))}
