param([switch]$SkipTests)
$ErrorActionPreference='Stop'
$portRoot=Split-Path -Parent $PSScriptRoot
Push-Location $portRoot
try {
  if (-not $SkipTests) { cargo test --workspace --offline --locked; if($LASTEXITCODE -ne 0){throw 'Rust tests failed'} }
  cargo build -p tome-platform --release --target wasm32-unknown-unknown --offline --locked
  if($LASTEXITCODE -ne 0){throw 'WASM build failed'}
  Copy-Item -LiteralPath (Join-Path $portRoot 'target\wasm32-unknown-unknown\release\tome_platform.wasm') -Destination (Join-Path $portRoot 'dist\tome_platform.wasm')
  foreach($localeName in @('ja','en')) {Copy-Item -LiteralPath (Join-Path $portRoot "crates\presentation\locales\$localeName.json") -Destination (Join-Path $portRoot "dist\$localeName.json")}
  Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $portRoot 'dist\tome_platform.wasm')
} finally {Pop-Location}
