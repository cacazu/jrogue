param([switch]$Contract)
$ErrorActionPreference = 'Stop'
$probeRoot = $PSScriptRoot
$taskRoot = Split-Path (Split-Path $probeRoot -Parent) -Parent
$compiler = Join-Path $taskRoot 'toolchain\fpc-src\compiler\ppcwasm32.exe'
$out = Join-Path $probeRoot 'build'
New-Item -ItemType Directory -Path $out -Force | Out-Null
& node (Join-Path $probeRoot 'prepare.mjs')
if ($LASTEXITCODE -ne 0) { throw 'VTIG overlay hash guard failed' }
if ($Contract) {
  & node (Join-Path $probeRoot 'prepare-harness.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'VTIG contract harness hash guard failed' }
  $source = 'text-contract-probe.pas'
  $wasm = 'text-contract-probe.wasm'
} else { $source = 'probe.pas'; $wasm = 'vtig-cjk.wasm' }
$args = @('-n','-Sc','-Twasip1','-CTwasmexceptions','-Xe','-dDRL_WASM','-dDRL_BROWSER',
  '-FDC:\Users\kit\emsdk\upstream\bin',
  ('-Fu'+(Join-Path $taskRoot 'toolchain\rtl-exnref')),
  ('-Fu'+(Join-Path $taskRoot 'core-overlay\fpcvalkyrie\src')),
  ('-Fu'+(Join-Path $taskRoot 'core-adapted\fpcvalkyrie\src')),
  ('-Fu'+(Join-Path $taskRoot 'core-adapted\fpcvalkyrie\libs')),
  ('-Fi'+(Join-Path $taskRoot 'core-adapted\fpcvalkyrie\src')),
  ('-FE'+$out),('-FU'+$out),('-o'+(Join-Path $out $wasm)),'-k--export-memory')
foreach ($package in @('rtl-objpas','rtl-generics','rtl-unicode','rtl-extra','hash','paszlib','fcl-base','fcl-xml')) {
  $args += ('-Fu'+(Join-Path $taskRoot ('toolchain\packages-exnref\'+$package+'\units\wasm32-wasip1')))
}
$args += (Join-Path $probeRoot $source)
& $compiler @args *> (Join-Path $out ($source+'.log'))
$result = $LASTEXITCODE
@{command=@($compiler)+$args;exit_code=$result;contract_harness=[bool]$Contract} | ConvertTo-Json -Depth 5 |
  Set-Content -LiteralPath (Join-Path $probeRoot ($source+'-commands.json')) -Encoding utf8
Get-Content -LiteralPath (Join-Path $out ($source+'.log'))
if ($result -ne 0) { throw 'VTIG CJK probe compile/link failed' }
