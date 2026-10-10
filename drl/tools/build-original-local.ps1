param([switch]$VerifyBrowser)
$ErrorActionPreference='Stop'
$drlBuildRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$drlNode=(Get-Command node.exe -ErrorAction Stop).Source
$drlCargo=(Get-Command cargo.exe -ErrorAction Stop).Source
foreach($relative in @('toolchain/fpc-src/compiler/ppcwasm32.exe','toolchain/rtl-exnref/system.ppu',
  'experiments/lua-wasi/build/drl-lua-bridge.a','experiments/lua-wasi/build/lua5.1.a')){
  if(!(Test-Path -LiteralPath (Join-Path $drlBuildRoot $relative))){
    throw ('Pinned original-core toolchain input missing: '+$relative+'. See docs/LOCAL-RUN.md and docs/SOURCE-PACKAGING.md.')
  }
}
function Invoke-DrlNode([string[]]$Arguments){
  & $drlNode @Arguments
  if($LASTEXITCODE -ne 0){throw ('DRL preparation/build failed: '+($Arguments -join ' '))}
}
Push-Location -LiteralPath $drlBuildRoot
try{
  Invoke-DrlNode -Arguments @('tools/integrate-locales.mjs')
  Invoke-DrlNode -Arguments @('tools/sync-game-credit.mjs')
  Invoke-DrlNode -Arguments @('tools/adapt-core.mjs')
  Invoke-DrlNode -Arguments @('tools/test-core-overlay.mjs')
  # Discover the restored port/.cargo/config.toml from Cargo's working directory.
  Push-Location -LiteralPath (Join-Path $drlBuildRoot 'port')
  try{
    & $drlCargo test --manifest-path Cargo.toml --offline --locked -j 1
    if($LASTEXITCODE -ne 0){throw 'Original-game Rust adapter tests failed'}
    & $drlCargo build --manifest-path Cargo.toml --offline --locked --release --target wasm32-unknown-unknown -j 1
    if($LASTEXITCODE -ne 0){throw 'Original-game Rust adapter Wasm build failed'}
  }finally{Pop-Location}
  New-Item -ItemType Directory -Path (Join-Path $drlBuildRoot 'port/dist') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $drlBuildRoot 'port/target/wasm32-unknown-unknown/release/drl_web_port.wasm') -Destination (Join-Path $drlBuildRoot 'port/dist/drl_web_port.wasm') -Force
  Invoke-DrlNode -Arguments @('tools/build-browser-core.mjs','--build')
  Copy-Item -LiteralPath (Join-Path $drlBuildRoot 'core-adapted/build/browser-core/drl-core.wasm') -Destination (Join-Path $drlBuildRoot 'port/dist/drl-core.wasm') -Force
  Invoke-DrlNode -Arguments @('tools/prepare-core-dist.mjs')
  if($VerifyBrowser){Invoke-DrlNode -Arguments @('port/tests/original-game-browser.mjs')}
  Write-Output 'Original Pascal/Lua game and Rust adapter built. Run node port/web/server.mjs; open http://127.0.0.1:4189/game.html.'
  Write-Output 'Source archive and full-campaign verification remain separate recorded gates.'
}finally{Pop-Location}
