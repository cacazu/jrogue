param([switch]$Test)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$portDirectory = Join-Path $PSScriptRoot 'port'
Push-Location -LiteralPath $portDirectory
try {
    if ($Test) { cargo test --offline --locked; if ($LASTEXITCODE -ne 0) { throw 'Rust tests failed' } }
    cargo build --offline --locked --release --target wasm32-unknown-unknown
    if ($LASTEXITCODE -ne 0) { throw 'Rust WASM build failed' }
    $buildDirectory = Join-Path $PSScriptRoot 'build'
    New-Item -ItemType Directory -Force -Path $buildDirectory | Out-Null
    Copy-Item -LiteralPath (Join-Path $portDirectory 'target\wasm32-unknown-unknown\release\dcss_boundary.wasm') -Destination (Join-Path $buildDirectory 'boundary.wasm')
} finally { Pop-Location }
