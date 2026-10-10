param([string]$Destination='C:\Users\kit\gameme\jnethack\jrouge\drl')
$ErrorActionPreference='Stop'
$drlRuntimeRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$drlRuntimeDestination=[IO.Path]::GetFullPath($Destination)
$drlRuntimeParent=[IO.Path]::GetFullPath('C:\Users\kit\gameme\jnethack\jrouge')
if([IO.Path]::GetDirectoryName($drlRuntimeDestination) -ne $drlRuntimeParent -or [IO.Path]::GetFileName($drlRuntimeDestination) -ne 'drl'){throw 'Runtime destination must be the authorized shared DRL folder'}
if(!(Test-Path -LiteralPath (Join-Path $drlRuntimeParent '.git'))){throw 'Expected shared repository is absent'}
$drlDistSource=Join-Path $drlRuntimeRoot 'port/dist'
$drlDistTarget=[IO.Path]::GetFullPath((Join-Path $drlRuntimeDestination 'port/dist'))
if(!$drlDistTarget.StartsWith($drlRuntimeDestination+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Dist confinement failed'}
function Get-DrlSha([string]$Path){return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
$drlEvidence=Get-Content -LiteralPath (Join-Path $drlRuntimeRoot 'docs/ORIGINAL-GAME-RUNTIME-EVIDENCE.json') -Raw -Encoding utf8|ConvertFrom-Json
if($drlEvidence.result -ne 'pass' -or $drlEvidence.browser_errors.Count -ne 0){throw 'Successful original-game browser evidence is required'}
$drlCoreSha=Get-DrlSha (Join-Path $drlDistSource 'drl-core.wasm')
$drlRustSha=Get-DrlSha (Join-Path $drlDistSource 'drl_web_port.wasm')
if($drlEvidence.artifacts.'drl-core.wasm'.sha256 -ne $drlCoreSha -or $drlEvidence.artifacts.'drl_web_port.wasm'.sha256 -ne $drlRustSha){throw 'Browser evidence does not match runtime binaries'}
$drlBundle=Get-Content -LiteralPath (Join-Path $drlDistSource 'source-bundle.json') -Raw -Encoding utf8|ConvertFrom-Json
if($drlBundle.core_sha256 -ne $drlCoreSha -or $drlBundle.sha256 -ne (Get-DrlSha (Join-Path $drlDistSource 'source.zip'))){throw 'Corresponding source archive does not match original core'}
foreach($alias in @('index.html','game.html')){if((Get-DrlSha (Join-Path $drlDistSource $alias)) -ne (Get-DrlSha (Join-Path $drlDistSource 'game.html'))){throw 'HTML alias must open the original engine'}}
$drlRuntimeRecords=[Collections.Generic.List[object]]::new()
foreach($item in (Get-ChildItem -LiteralPath $drlDistSource -Recurse -File)){
  if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Runtime source symlink rejected'}
  $relative=$item.FullName.Substring($drlDistSource.Length+1)
  if($relative -match '(^|[\\/])[^\\/]+\.candidate$'){throw 'Unfinished runtime candidate exists'}
  $target=[IO.Path]::GetFullPath((Join-Path $drlDistTarget $relative))
  if(!$target.StartsWith($drlDistTarget+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Runtime target escaped DRL dist'}
  $sourceSha=Get-DrlSha $item.FullName
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force|Out-Null
  Copy-Item -LiteralPath $item.FullName -Destination $target -Force
  if((Get-DrlSha $target) -ne $sourceSha -or (Get-DrlSha $item.FullName) -ne $sourceSha){throw ('Runtime copy/source changed: '+$relative)}
  $drlRuntimeRecords.Add(@{path='port/dist/'+$relative.Replace('\','/');bytes=$item.Length;sha256=$sourceSha})
}
$drlReceipt=@{schema=1;scope='original-game local HTML runtime and matching source checkpoint';copied_utc=[DateTime]::UtcNow.ToString('o');source_commit='a6f965072b3a25b768c91dbced00367f1b57d865';core_sha256=$drlCoreSha;rust_sha256=$drlRustSha;source_zip_sha256=$drlBundle.sha256;browser_checks=$drlEvidence.checks.Count;basic_original_game_browser_verified=$true;full_port_complete=$false;external_deployment_requested=$false;site_url=$null;files=$drlRuntimeRecords}
$drlReceiptJson=$drlReceipt|ConvertTo-Json -Depth 8
New-Item -ItemType Directory -Path (Join-Path $drlRuntimeDestination 'docs') -Force|Out-Null
[IO.File]::WriteAllText((Join-Path $drlRuntimeDestination 'docs/LOCAL-RUNTIME-CHECKPOINT.json'),$drlReceiptJson+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $drlRuntimeRoot 'docs/LOCAL-RUNTIME-CHECKPOINT.json'),$drlReceiptJson+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
Write-Output (@{copied_files=$drlRuntimeRecords.Count;hashes_verified=$drlRuntimeRecords.Count;core_sha256=$drlCoreSha;source_zip_sha256=$drlBundle.sha256;destination=$drlRuntimeDestination;full_port_complete=$false}|ConvertTo-Json -Compress)
