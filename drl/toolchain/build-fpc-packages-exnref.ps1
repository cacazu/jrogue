param([string[]]$Packages=@('rtl-objpas','rtl-generics','rtl-unicode','rtl-extra','hash','paszlib','fcl-base','fcl-xml','fcl-json'))
$ErrorActionPreference = 'Stop'
$toolRoot = Split-Path -Parent $PSCommandPath
$sourceRoot = Join-Path $toolRoot 'fpc-src'
$outputRoot = Join-Path $toolRoot 'packages-exnref'
$compiler = Join-Path $sourceRoot 'compiler\ppcwasm32.exe'
$rtlOutput = Join-Path $outputRoot 'units\wasm32-wasip1\rtl'
New-Item -ItemType Directory -Force -Path $rtlOutput | Out-Null
Copy-Item -Path (Join-Path $toolRoot 'rtl-exnref\*') -Destination $rtlOutput -Force
# Task-local installed-package metadata for the already compiled official RTL.
# FPC's package loader requires a Package.fpc marker for installed package paths.
[IO.File]::WriteAllText((Join-Path $rtlOutput 'Package.fpc'), '[package]'+[Environment]::NewLine+'name=rtl'+[Environment]::NewLine+'version=3.3.1'+[Environment]::NewLine)
$runs = @()
if(Test-Path -LiteralPath (Join-Path $outputRoot 'build-runs.json')){$runs=@(Get-Content -LiteralPath (Join-Path $outputRoot 'build-runs.json') -Raw | ConvertFrom-Json)}
foreach ($package in $Packages) {
  if($package -notin @('rtl-objpas','rtl-generics','rtl-unicode','rtl-extra','hash','paszlib','fcl-base','fcl-xml','fcl-json')){throw 'Unreviewed WASI package selection'}
  $sourcePackage = Join-Path $sourceRoot ('packages\'+$package)
  $shadowPackage = Join-Path $outputRoot $package
  New-Item -ItemType Directory -Force -Path $shadowPackage | Out-Null
  foreach ($directory in @('src','namespaced')) {
    $sourceDirectory = Join-Path $sourcePackage $directory
    if (Test-Path -LiteralPath $sourceDirectory) {
      if (-not (Test-Path -LiteralPath (Join-Path $shadowPackage $directory))) {
        Copy-Item -LiteralPath $sourceDirectory -Destination $shadowPackage -Recurse
      }
    }
  }
  foreach ($file in @('fpmake.pp','namespaces.lst')) {
    $sourceFile = Join-Path $sourcePackage $file
    if (Test-Path -LiteralPath $sourceFile) { Copy-Item -LiteralPath $sourceFile -Destination $shadowPackage -Force }
  }
  $arguments = @('compile',('--localunitdir='+$outputRoot),('--globalunitdir='+$outputRoot),
    '--os=wasip1','--cpu=wasm32','--threads=2','--skipallprograms',
    '-o','-n','-o','-Twasip1','-o','-Pwasm32','-o','-CTwasmexceptions',('--compiler='+$compiler),'-bu')
  $started = [DateTime]::UtcNow.ToString('o')
  Push-Location -LiteralPath $shadowPackage
  try {
    $fpmake = Join-Path $sourcePackage 'fpmake.exe'
    & $fpmake @arguments > build.log 2>&1
    $exitCode = $LASTEXITCODE
  } finally { Pop-Location }
  $runs += [ordered]@{package=$package;executable=$fpmake;arguments=$arguments;workingDirectory=$shadowPackage;
    startedUtc=$started;finishedUtc=[DateTime]::UtcNow.ToString('o');exitCode=$exitCode}
  $runs | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $outputRoot 'build-runs.json')
  Write-Output "$package exit=$exitCode"
  Get-Content (Join-Path $shadowPackage 'build.log') -Tail 5
  if ($exitCode -ne 0) { throw "$package exnref build failed" }
}
