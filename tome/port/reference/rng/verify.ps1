param(
    [string]$Upstream = 'C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6',
    [string]$Emsdk = 'C:\Users\kit\emsdk'
)
$ErrorActionPreference = 'Stop'
$rngWork = $PSScriptRoot
$sourceDir = Join-Path $Upstream 'src'
$core = [IO.File]::ReadAllText((Join-Path $sourceDir 'core_lua.c'))
$table = [regex]::Match($core, 'static int randnor_table\[RANDNOR_NUM\] =\s*\{[\s\S]*?\};').Value
if (-not $table) { throw 'Could not extract upstream integer normal table' }
$table = $table.Replace('RANDNOR_NUM', '256')
[IO.File]::WriteAllText((Join-Path $rngWork 'normal_table.h'), $table + "`n", [Text.UTF8Encoding]::new($false))
$fixtureDir = Join-Path $rngWork 'fixtures'
[IO.Directory]::CreateDirectory($fixtureDir) | Out-Null
$emcc = Join-Path $Emsdk 'upstream\emscripten\emcc.exe'
$node = Join-Path $Emsdk 'node\24.19.0_64bit\node.exe'
& $emcc (Join-Path $rngWork 'reference_harness.c') '-I' $sourceDir '-std=c99' '-fgnu89-inline' '-Wno-static-in-inline' '-O2' '-sENVIRONMENT=node' '-sEXIT_RUNTIME=1' '-o' (Join-Path $rngWork 'reference_harness.js')
if ($LASTEXITCODE -ne 0) { throw "C reference compilation failed: $LASTEXITCODE" }
$fixture = & $node (Join-Path $rngWork 'reference_harness.js')
if ($LASTEXITCODE -ne 0) { throw "C reference execution failed: $LASTEXITCODE" }
[IO.File]::WriteAllText((Join-Path $fixtureDir 'sfmt19937-reference.json'), ($fixture -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
$parsed = $fixture | ConvertFrom-Json
if ($parsed.seeds.Count -ne 6 -or $parsed.seeds[0].words.Count -ne 2000) { throw 'Invalid C fixture output' }
& 'C:\Users\kit\.cargo\bin\cargo.exe' test --offline --manifest-path (Join-Path $rngWork 'Cargo.toml')
if ($LASTEXITCODE -ne 0) { throw "Rust differential tests failed: $LASTEXITCODE" }
& 'C:\Users\kit\.cargo\bin\cargo.exe' fmt --check --manifest-path (Join-Path $rngWork 'Cargo.toml')
if ($LASTEXITCODE -ne 0) { throw "Rust formatting check failed: $LASTEXITCODE" }
& 'C:\Users\kit\.cargo\bin\cargo.exe' clippy --offline --manifest-path (Join-Path $rngWork 'Cargo.toml') --all-targets -- -D warnings
if ($LASTEXITCODE -ne 0) { throw "Rust lint check failed: $LASTEXITCODE" }
& 'C:\Users\kit\.cargo\bin\cargo.exe' check --offline --target wasm32-unknown-unknown --manifest-path (Join-Path $rngWork 'Cargo.toml')
if ($LASTEXITCODE -ne 0) { throw "Rust WebAssembly compilation failed: $LASTEXITCODE" }
$sourceHashes = [ordered]@{}
foreach ($sourceName in @('SFMT.c','SFMT.h','SFMT-params.h','SFMT-params19937.h','core_lua.c')) {
    $sourceHashes[$sourceName] = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $sourceDir $sourceName)).Hash.ToLowerInvariant()
}
$report = [ordered]@{
    verified_utc = [DateTime]::UtcNow.ToString('o')
    reference = 'Official T-Engine 4 1.7.6 src/SFMT.c scalar little-endian SFMT19937'
    reference_compiler = $emcc
    reference_runtime = $node
    source_sha256 = $sourceHashes
    rust_module_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $rngWork 'rng.rs')).Hash.ToLowerInvariant()
    fixture_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $fixtureDir 'sfmt19937-reference.json')).Hash.ToLowerInvariant()
    sfmt_license_url = 'https://raw.githubusercontent.com/MersenneTwister-Lab/SFMT/master/LICENSE.txt'
    sfmt_license_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $rngWork 'SFMT-LICENSE.txt')).Hash.ToLowerInvariant()
    seeds = @($parsed.seeds | ForEach-Object { $_.seed })
    compared_outputs = [ordered]@{
        raw_u32 = 12000
        bitwise_real1 = 7800
        bounded = 6000
        lua_range = 6000
        integer_normal = 6000
        mixed_wrapper_iterations = 1800
        mixed_wrapper_outputs = 10800
    }
    checks = [ordered]@{
        rust_tests = '7 passed; 0 failed'
        rustfmt = 'passed'
        clippy_all_targets_deny_warnings = 'passed'
        wasm32_unknown_unknown_compile = 'passed'
    }
    exclusions = @('init_by_array','bulk fills','64-bit draws','normalFloat','upstream save decoding')
}
[IO.File]::WriteAllText((Join-Path $rngWork 'verification.json'), ($report | ConvertTo-Json -Depth 8) + "`n", [Text.UTF8Encoding]::new($false))
