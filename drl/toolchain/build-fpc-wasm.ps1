$ErrorActionPreference = 'Stop'
$toolRoot = Split-Path -Parent $PSCommandPath
$sourceRoot = Join-Path $toolRoot 'fpc-src'
$buildTools = Join-Path $toolRoot 'build-tools'
$bootstrap = (Join-Path $toolRoot 'fpc-win64-snapshot\bin\i386-win32\ppcrossx64.exe').Replace('\','/')
$hostRtl = (Join-Path $toolRoot 'fpc-win64-snapshot\units\x86_64-win64\rtl').Replace('\','/')
$make = Join-Path $buildTools 'make.exe'
$logRoot = Join-Path $toolRoot 'acquisition\wasm-build'
$expectedSourceHash = 'fb97cbb1ac458df86d7345312380587cb81bda4407ae7077eb06b87f7ef701bf'
$sourceArchive = Join-Path $logRoot 'fpc-source.zip'
if ((Get-FileHash -LiteralPath $sourceArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedSourceHash) {
  throw 'Pinned official source archive checksum mismatch'
}
$env:PATH = $buildTools + ';' + $env:PATH
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
function Run-Build([string]$Name, [string[]]$Arguments) {
  $started = [DateTime]::UtcNow.ToString('o')
  $log = Join-Path $logRoot ($Name + '.reproduce.log')
  & $make @Arguments > $log 2>&1
  $result = [ordered]@{ name=$Name; executable=$make; arguments=$Arguments; startedUtc=$started;
    finishedUtc=[DateTime]::UtcNow.ToString('o'); exitCode=$LASTEXITCODE; log=$log }
  $result | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $logRoot ($Name + '.reproduce.json'))
  if ($result.exitCode -ne 0) { throw "$Name failed; see $log" }
}
Run-Build 'compiler' @('-j2','-C',(Join-Path $sourceRoot 'compiler'),'wasm32',"FPC=$bootstrap",'CPU_TARGET=x86_64','OS_TARGET=win64',"OPT=-n -Fu$hostRtl")
$wasmCompiler = (Join-Path $sourceRoot 'compiler\ppcwasm32.exe').Replace('\','/')
Run-Build 'rtl-branchful' @('-j2','-C',(Join-Path $sourceRoot 'rtl'),'all',"FPC=$wasmCompiler",'CPU_TARGET=wasm32','OS_TARGET=wasip1','OPT=-n')
$exnrefOutput = (Join-Path $toolRoot 'rtl-exnref').Replace('\','/')
Run-Build 'rtl-exnref' @('-j2','-C',(Join-Path $sourceRoot 'rtl'),'all',"FPC=$wasmCompiler",'CPU_TARGET=wasm32','OS_TARGET=wasip1','OPT=-n -CTwasmexceptions',"COMPILER_UNITTARGETDIR=$exnrefOutput")
Run-Build 'fpmake' @('-j2','-C',(Join-Path $sourceRoot 'packages'),'fpmake.exe',"FPC=$wasmCompiler", "FPCFPMAKE=$bootstrap",'CPU_TARGET=wasm32','OS_TARGET=wasip1','CPU_SOURCE=x86_64','OS_SOURCE=win64','OPT=-n')
foreach ($package in @('rtl-objpas','rtl-generics','rtl-unicode','rtl-extra','hash','paszlib','fcl-base','fcl-xml','fcl-json')) {
  Run-Build $package @('-j2','-C',(Join-Path $sourceRoot ('packages\'+$package)),'all',"FPC=$wasmCompiler","FPCFPMAKE=$bootstrap",'CPU_TARGET=wasm32','OS_TARGET=wasip1','CPU_SOURCE=x86_64','OS_SOURCE=win64','OPT=-n')
}
Write-Output 'Official task-local FPC wasm32/wasip1 compiler, RTL and selected packages built.'
