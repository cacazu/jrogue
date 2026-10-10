$ErrorActionPreference='Stop'
$drlRoot=Split-Path -Parent $PSScriptRoot
$drlAcquisition=Join-Path $drlRoot 'upstream'
New-Item -ItemType Directory -Path $drlAcquisition -Force | Out-Null
$drlSources=@(
  @{Name='drl';Url='https://github.com/chaosforgeorg/drl.git';Tag='0_10_11a';Commit='a6f965072b3a25b768c91dbced00367f1b57d865'},
  @{Name='fpcvalkyrie';Url='https://github.com/chaosforgeorg/fpcvalkyrie.git';Tag='0_10_11';Commit='f89735a741a968997656c2d48a003ec569db7f22'}
)
foreach($drlSource in $drlSources){
  $drlDestination=Join-Path $drlAcquisition $drlSource.Name
  if(!(Test-Path -LiteralPath $drlDestination)){
    git clone --depth 1 --branch $drlSource.Tag $drlSource.Url $drlDestination
    if($LASTEXITCODE -ne 0){throw 'Official source acquisition failed'}
  }
  $drlActual=git -c "safe.directory=$($drlDestination.Replace('\','/'))" -C $drlDestination rev-parse HEAD
  if($LASTEXITCODE -ne 0 -or $drlActual.Trim() -ne $drlSource.Commit){throw 'Source pin mismatch'}
  git -c "safe.directory=$($drlDestination.Replace('\','/'))" -C $drlDestination archive --format=zip --output (Join-Path $drlAcquisition "$($drlSource.Name)-$($drlSource.Tag)-pristine.zip") HEAD
  if($LASTEXITCODE -ne 0){throw 'Pinned archive failed'}
}
$drlLuaArchive=Join-Path $drlAcquisition 'lua-5.1.5.tar.gz'
if(!(Test-Path -LiteralPath $drlLuaArchive)){Invoke-WebRequest -Uri 'https://www.lua.org/ftp/lua-5.1.5.tar.gz' -OutFile $drlLuaArchive}
if((Get-FileHash -LiteralPath $drlLuaArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne '2640fc56a795f29d28ef15e13c34a47e223960b0240e8cb0a82d9b0738695333'){throw 'Lua source checksum mismatch'}
if(!(Test-Path -LiteralPath (Join-Path $drlAcquisition 'lua-5.1.5'))){
  $drlEntries=tar -tzf $drlLuaArchive
  if($LASTEXITCODE -ne 0){throw 'Cannot inspect Lua source archive'}
  foreach($drlEntry in $drlEntries){if($drlEntry -notmatch '^lua-5\.1\.5/' -or $drlEntry -match '(^|/)\.\.(/|$)' -or $drlEntry -match '^[A-Za-z]:'){throw 'Unsafe Lua archive path'}}
  tar -xzf $drlLuaArchive -C $drlAcquisition
  if($LASTEXITCODE -ne 0){throw 'Lua source extraction failed'}
}
Write-Output 'Pinned original source acquired. No installer or upstream gameplay/build script was executed.'
