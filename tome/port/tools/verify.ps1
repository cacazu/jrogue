param([switch]$Rebuild)
$ErrorActionPreference='Stop'
$portRoot=Split-Path -Parent $PSScriptRoot
$evidenceDir=Join-Path $portRoot 'tests\output'
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
Push-Location $portRoot
try {
  & cargo fmt --all --check
  if($LASTEXITCODE -ne 0){throw 'Rust formatting check failed'}
  & cargo test --workspace --offline --locked 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'rust-tests.log')
  if($LASTEXITCODE -ne 0){throw 'Rust tests failed'}
  & cargo clippy --workspace --all-targets --offline --locked -- -D warnings 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'clippy.log')
  if($LASTEXITCODE -ne 0){throw 'Rust lint check failed'}
  if($Rebuild){& (Join-Path $PSScriptRoot 'build.ps1') -SkipTests}
  & node (Join-Path $portRoot 'tests\browser.mjs')
  if($LASTEXITCODE -ne 0){throw 'Actual browser check failed'}
} finally {Pop-Location}
