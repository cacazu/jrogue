$ErrorActionPreference='Stop'
$drlPristineTask=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$drlPristineTarget=[IO.Path]::GetFullPath('C:\Users\kit\gameme\jnethack\jrouge\drl\upstream')
$drlExpectedOwned=[IO.Path]::GetFullPath('C:\Users\kit\gameme\jnethack\jrouge\drl')
if([IO.Path]::GetDirectoryName($drlPristineTarget) -ne $drlExpectedOwned){throw 'Pristine target escaped owned DRL folder'}
$drlSources=@(
  @{name='drl';repository='https://github.com/chaosforgeorg/drl';commit='a6f965072b3a25b768c91dbced00367f1b57d865'},
  @{name='fpcvalkyrie';repository='https://github.com/chaosforgeorg/fpcvalkyrie';commit='f89735a741a968997656c2d48a003ec569db7f22'},
  @{name='lua-5.1.5';repository='https://www.lua.org/ftp/lua-5.1.5.tar.gz';archive_sha256='2640fc56a795f29d28ef15e13c34a47e223960b0240e8cb0a82d9b0738695333'}
)
$drlPristineRecords=[Collections.Generic.List[object]]::new()
foreach($project in $drlSources){
  $sourceRoot=[IO.Path]::GetFullPath((Join-Path $drlPristineTask ('upstream/'+$project.name)))
  if($project.commit){
    $actual=(& git.exe -C $sourceRoot rev-parse HEAD).Trim()
    if($LASTEXITCODE -ne 0 -or $actual -ne $project.commit){throw 'Original upstream commit differs'}
    $status=@(& git.exe -C $sourceRoot status --porcelain --untracked-files=normal)
    if($LASTEXITCODE -ne 0 -or $status.Count){throw 'Original upstream checkout is modified'}
  }
  foreach($file in Get-ChildItem -LiteralPath $sourceRoot -Recurse -File){
    $relative=$file.FullName.Substring($sourceRoot.Length+1).Replace('\','/')
    if($relative -match '^\.git(/|$)'){continue}
    if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Original upstream source symlink rejected'}
    $target=[IO.Path]::GetFullPath((Join-Path $drlPristineTarget ($project.name+'/'+$relative)))
    if(!$target.StartsWith($drlPristineTarget+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Pristine file escaped DRL upstream'}
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $target -Force
    $sha=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha){throw 'Pristine copy byte verification failed'}
    $drlPristineRecords.Add(@{path=$project.name+'/'+$relative;bytes=$file.Length;sha256=$sha})
  }
}
$drlPristineManifest=@{schema=1;scope='local pristine acquisition, separate from adapted port; not a publication asset grant';projects=$drlSources;copied_utc=[DateTime]::UtcNow.ToString('o');source_files=$drlPristineRecords;source_executed_by_copy=$false;publish_pristine_tree=$false;restrictions='Bundled optional native SDK/runtime/audio/font payloads retain their upstream restrictions; publication uses separately audited source/assets only.'}
[IO.File]::WriteAllText((Join-Path $drlPristineTarget 'acquisition.json'),($drlPristineManifest|ConvertTo-Json -Depth 8)+"`n",[Text.UTF8Encoding]::new($false))
Write-Output (@{destination=$drlPristineTarget;files=$drlPristineRecords.Count;bytes=($drlPristineRecords|Measure-Object -Property bytes -Sum).Sum;verified=$true;published=$false}|ConvertTo-Json -Compress)
