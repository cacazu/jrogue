$ErrorActionPreference='Stop'
$drlTaskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$drlDestination=[IO.Path]::GetFullPath('C:\Users\kit\gameme\jnethack\jrouge\drl')
$drlExpectedParent=[IO.Path]::GetFullPath('C:\Users\kit\gameme\jnethack\jrouge')
if ([IO.Path]::GetDirectoryName($drlDestination) -ne $drlExpectedParent -or [IO.Path]::GetFileName($drlDestination) -ne 'drl') { throw 'DRL destination confinement failed' }
if (!(Test-Path -LiteralPath (Join-Path $drlExpectedParent '.git'))) { throw 'Expected shared repository is absent' }
$drlRoots=@('docs','tools','localization','core-overlay','port/src','port/tests','port/web','port/locales','port/licenses','port/tools','experiments/lua-wasi','experiments/vtig-cjk','experiments/state-probe','toolchain/wasm-probe')
$drlSingles=@('.gitignore','README.md','delivery.json','feature-inventory.md','feature-inventory.json','feature-registry-appendix.md','inventory-source.mjs','port/Cargo.toml','port/Cargo.lock','port/build.ps1','port/start.ps1','port/README.md','toolchain/build-fpc-wasm.ps1','toolchain/build-fpc-packages-exnref.ps1','toolchain/build-fcl-json-exnref.ps1','toolchain/build-filesystem-probe.ps1')
$drlFiles=@()
foreach($relative in $drlRoots) {
  $source=Join-Path $drlTaskRoot $relative
  if (Test-Path -LiteralPath $source) { $drlFiles+=Get-ChildItem -LiteralPath $source -Recurse -File }
}
foreach($relative in $drlSingles) {
  $source=Join-Path $drlTaskRoot $relative
  if (Test-Path -LiteralPath $source) { $drlFiles+=Get-Item -LiteralPath $source }
}
$drlRecords=@()
foreach($file in $drlFiles) {
  if (!$file.FullName.StartsWith($drlTaskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Source escaped task workspace' }
  $relative=$file.FullName.Substring($drlTaskRoot.Length+1).Replace('\','/')
  if ($relative -eq 'docs/core-source-package-plan.json' -or $relative -match '(^|/)(build|mixed-build|output|mixed-rtl|probe-build|native-probe-build|tests-output)(/|$)' -or $relative -match '^experiments/[^/]+/toolchain/' -or $relative -match '\.(exe|dll|a|o|ppu|wasm)$') { continue }
  $target=[IO.Path]::GetFullPath((Join-Path $drlDestination $relative))
  if (!$target.StartsWith($drlDestination+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Checkpoint path escaped DRL' }
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $target -Force
  $sha=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
  $sourceSha=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($sha -ne $sourceSha) { throw ('Concurrent source change: '+$relative) }
  $drlRecords+=@{path=$relative;sha256=$sha;bytes=$file.Length}
}
$drlCurrentState=Get-Content -LiteralPath (Join-Path $drlTaskRoot 'docs/CURRENT-CHECKPOINT.json') -Raw -Encoding utf8|ConvertFrom-Json
$drlCheckpoint=@{schema=2;scope='original-game local HTML/Node checkpoint; full campaign, text coverage, and full-state verification pending';copied_utc=[DateTime]::UtcNow.ToString('o');source_commit='a6f965072b3a25b768c91dbced00367f1b57d865';engine_commit='f89735a741a968997656c2d48a003ec569db7f22';full_port_complete=$false;external_deployment_requested=$false;local_browser_verified=$false;basic_original_game_browser_verified=[bool]$drlCurrentState.basic_original_game_browser_verified;site_url=$null;heavy_jobs_held=[bool]$drlCurrentState.heavy_job_hold.active;files=$drlRecords}
$drlJson=$drlCheckpoint | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText((Join-Path $drlDestination 'source-checkpoint.json'),$drlJson,(New-Object Text.UTF8Encoding($false)))
Write-Output (@{copied_files=$drlRecords.Count;hashes_verified=$drlRecords.Count;destination=$drlDestination;full_port_complete=$false} | ConvertTo-Json -Compress)
