# Build only the official JSON units used by the presentation sidecars.
# Full fpmake includes jsonfpcunit and its unrelated test-package dependencies.
$ErrorActionPreference='Stop'
$drlJsonToolRoot=$PSScriptRoot
$drlJsonSource=Join-Path $drlJsonToolRoot 'fpc-src'
$drlJsonPackage=Join-Path $drlJsonSource 'packages/fcl-json/src'
$drlJsonCompiler=Join-Path $drlJsonSource 'compiler/ppcwasm32.exe'
$drlJsonOutput=Join-Path $drlJsonToolRoot 'packages-exnref/fcl-json/units/wasm32-wasip1'
New-Item -ItemType Directory -Path $drlJsonOutput -Force|Out-Null
$drlJsonPaths=@((Join-Path $drlJsonToolRoot 'rtl-exnref'))
foreach($package in @('rtl-objpas','rtl-generics','rtl-unicode','rtl-extra','hash','paszlib','fcl-base','fcl-xml')){
  $drlJsonPaths+=Join-Path $drlJsonToolRoot ('packages-exnref/'+$package+'/units/wasm32-wasip1')
}
$drlJsonArguments=@('-n','-Twasip1','-CTwasmexceptions','-Cn',('-Fu'+$drlJsonPackage),('-FU'+$drlJsonOutput))
$drlJsonArguments+=@($drlJsonPaths|ForEach-Object{'-Fu'+$_})
$drlJsonArguments+=Join-Path $drlJsonPackage 'jsonparser.pp'
$drlJsonLog=Join-Path $drlJsonOutput 'compile.log'
& $drlJsonCompiler @drlJsonArguments *> $drlJsonLog
$drlJsonExit=$LASTEXITCODE
$drlJsonUnits=@()
foreach($name in @('fpjson','jsonscanner','jsonreader','jsonparser')){
  $source=Join-Path $drlJsonPackage ($name+'.pp')
  $unit=Join-Path $drlJsonOutput ($name+'.ppu')
  $drlJsonUnits+=@{name=$name;source=$source;source_sha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant();built=(Test-Path -LiteralPath $unit)}
}
$drlJsonEvidence=@{schema=1;scope='Required fcl-json runtime subset; jsonfpcunit/tests/examples excluded';command=@($drlJsonCompiler)+$drlJsonArguments;compiler_sha256=(Get-FileHash -LiteralPath $drlJsonCompiler -Algorithm SHA256).Hash.ToLowerInvariant();exit_code=$drlJsonExit;units=$drlJsonUnits;completed_utc=[DateTime]::UtcNow.ToString('o')}
$drlJsonEvidence|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $drlJsonOutput 'build-evidence.json') -Encoding utf8
Get-Content -LiteralPath $drlJsonLog
if($drlJsonExit -ne 0 -or @($drlJsonUnits|Where-Object{!$_.built}).Count -ne 0){throw 'Official JSON WASI runtime-unit build failed'}
Write-Output ($drlJsonEvidence|ConvertTo-Json -Depth 6 -Compress)
