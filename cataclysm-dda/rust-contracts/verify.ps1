# Serial, isolated verification. No download, Git operation, or upstream build.
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot
$cargoTool = 'C:\Users\kit\.cargo\bin\cargo.exe'
$rustcTool = 'C:\Users\kit\.cargo\bin\rustc.exe'
$verificationDir = Join-Path $PSScriptRoot 'verification'
New-Item -ItemType Directory -Path $verificationDir -Force | Out-Null
$checks = [Collections.Generic.List[object]]::new()
function Invoke-ContractCheck {
    param([string]$Name, [string[]]$Arguments)
    $started = [DateTime]::UtcNow.ToString('o')
    $log = Join-Path $verificationDir ($Name + '.log')
    [IO.File]::WriteAllText($log, [string]::Empty, [Text.UTF8Encoding]::new($false))
    & $cargoTool @Arguments 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath $log
    $exitCode = $LASTEXITCODE
    $checks.Add([ordered]@{ name=$Name; command=('cargo ' + ($Arguments -join ' ')); exit_code=$exitCode; started_utc=$started; finished_utc=[DateTime]::UtcNow.ToString('o'); log=('verification/' + $Name + '.log') })
    if ($exitCode -ne 0) { throw ($Name + ' failed with exit code ' + $exitCode) }
}
$fixtureExpected = [ordered]@{
    'fixtures/keybindings.json'='5b55b23960b42f52249398254a7557303a0987ce6a7f5a23f0f39ef1e00be3b3'
    'fixtures/action.cpp'='dad9b0a62e0f08aa2cdcf72d81f600a608ee248a6013c8c8ff974af0fbe14f99'
    'fixtures/input.h'='56d8db0e9fdf18c07620ddf23fb690bca05fed8f5d4ef3218ed5678174e58416'
}
foreach ($path in $fixtureExpected.Keys) {
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot $path)).Hash.ToLowerInvariant()
    if ($actual -ne $fixtureExpected[$path]) { throw ('pristine fixture mismatch: ' + $path) }
}
try {
    Invoke-ContractCheck -Name 'format' -Arguments @('fmt','--all')
    Invoke-ContractCheck -Name 'format-check' -Arguments @('fmt','--all','--','--check')
    Invoke-ContractCheck -Name 'clippy' -Arguments @('clippy','--workspace','--all-targets','--offline','--locked','-j','1','--','-D','warnings')
    Invoke-ContractCheck -Name 'native-tests' -Arguments @('test','--workspace','--offline','--locked','-j','1')
    Invoke-ContractCheck -Name 'wasm-compile' -Arguments @('check','--workspace','--target','wasm32-unknown-unknown','--offline','--locked','-j','1')
    $metadataText = & $cargoTool metadata --offline --locked --format-version 1
    if ($LASTEXITCODE -ne 0) { throw 'cargo metadata failed' }
    $metadata = $metadataText | ConvertFrom-Json
    $metadata.packages | Select-Object name,version,license,source | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $verificationDir 'dependency-licenses.json') -Encoding utf8
    $testLog = [IO.File]::ReadAllText((Join-Path $verificationDir 'native-tests.log'))
    $testCount = 0
    foreach ($match in [regex]::Matches($testLog, 'test result: ok\. (\d+) passed')) { $testCount += [int]$match.Groups[1].Value }
    $result = [ordered]@{
        status='passed'; scope='Pure Rust boundary contracts; no original simulation, browser runtime, or Site deployment'
        upstream_sha='7b2efa5cea38e4d4d97dd0e63b28b9148623da59'; port_abi='cdda-browser-contract/1'
        rustc=(& $rustcTool --version); cargo=(& $cargoTool --version)
        native_tests_passed=$testCount; native_tests_failed=0; contract_catalog_ids=30
        wasm_target='wasm32-unknown-unknown'; wasm_evidence='compile check only, not a JS export or runnable frontend'
        fixtures=$fixtureExpected; checks=$checks
    }
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $verificationDir 'results.json') -Encoding utf8
} catch {
    [ordered]@{ status='failed'; error=$_.ToString(); checks=$checks } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $verificationDir 'results.json') -Encoding utf8
    throw
}
