param([string]$SourceRoot=(Join-Path $PSScriptRoot '..'),[switch]$VendorOnly)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 7){throw 'Source restore requires PowerShell7 with System.Formats.Tar support'}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.Formats.Tar
$drlRestoreRoot=[IO.Path]::GetFullPath($SourceRoot)
if(!(Test-Path -LiteralPath (Join-Path $drlRestoreRoot 'SOURCE-BUNDLE.json'))){throw 'Run restore only in a newly extracted DRL source bundle'}
function Get-DrlSourceTarget([string]$Base,[string]$Relative){
  if(!$Relative -or $Relative -match '(^[/\\])|(^[A-Za-z]:)|((^|/)\.\.(/|$))|\\|:'){throw 'Unsafe source archive path'}
  $checkedBase=[IO.Path]::GetFullPath($Base)
  $target=[IO.Path]::GetFullPath((Join-Path $checkedBase $Relative))
  if(!$target.StartsWith($checkedBase+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Source archive target escaped extraction directory'}
  return $target
}
if(!$VendorOnly){
  $archivePath=Join-Path $drlRestoreRoot 'toolchain/acquisition/wasm-build/fpc-source.zip'
  $expected='fb97cbb1ac458df86d7345312380587cb81bda4407ae7077eb06b87f7ef701bf'
  if((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'Pinned FPC source archive checksum differs'}
  $output=Join-Path $drlRestoreRoot 'toolchain/fpc-src'
  if(Test-Path -LiteralPath $output){throw 'FPC restore requires a fresh extraction directory'}
  $archiveStream=[IO.File]::OpenRead($archivePath)
  $archive=[IO.Compression.ZipArchive]::new($archiveStream,[IO.Compression.ZipArchiveMode]::Read,$false)
  try{
    $roots=@($archive.Entries | ForEach-Object {$_.FullName.Split('/')[0]} | Sort-Object -Unique)
    $bytes=($archive.Entries | Measure-Object -Property Length -Sum).Sum
    if($roots.Count -ne 1 -or $archive.Entries.Count -ne 28142 -or $bytes -ne 350348786){throw 'Unexpected pinned FPC source inventory'}
    $prefix=$roots[0]+'/'
    foreach($entry in $archive.Entries){
      if(!$entry.FullName.StartsWith($prefix,[StringComparison]::Ordinal)){throw 'FPC archive root differs'}
      $relative=$entry.FullName.Substring($prefix.Length).TrimEnd('/')
      if(!$relative){continue}
      if((($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960){throw 'FPC source symlink rejected'}
      $target=Get-DrlSourceTarget $output $relative
      if($entry.FullName.EndsWith('/')){New-Item -ItemType Directory -Path $target -Force | Out-Null;continue}
      New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
      $inputStream=$entry.Open();$outputStream=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
      try{$inputStream.CopyTo($outputStream,1048576)}finally{$inputStream.Dispose();$outputStream.Dispose()}
    }
  }finally{$archive.Dispose();$archiveStream.Dispose()}
  $bundle=Get-Content -LiteralPath (Join-Path $drlRestoreRoot 'SOURCE-BUNDLE.json') -Raw -Encoding utf8 | ConvertFrom-Json
  foreach($mapping in $bundle.core.sourceMappings){
    $buildPath=[string]$mapping.buildPath
    $sourcePath=[string]$mapping.sourcePath
    if($buildPath -notmatch '^toolchain/(fpc-src/(rtl|packages)/|packages-exnref/)' -or
       $sourcePath -ne ('linked-source/'+$buildPath) -or
       $buildPath -notmatch '\.(pas|pp|inc|c|h|lua|lpr|json|mjs|ps1)$'){
      throw 'Unreviewed linked source restore path'
    }
    $source=Get-DrlSourceTarget $drlRestoreRoot $sourcePath
    if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $mapping.sha256){
      throw ('Linked source snapshot checksum differs: '+$buildPath)
    }
    $target=Get-DrlSourceTarget $drlRestoreRoot $buildPath
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
    if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $mapping.sha256){
      throw ('Linked source restore checksum differs: '+$buildPath)
    }
  }
}
$lock=Get-Content -LiteralPath (Join-Path $drlRestoreRoot 'port/Cargo.lock') -Raw -Encoding utf8
$vendorRoot=Join-Path $drlRestoreRoot 'vendor'
if(Test-Path -LiteralPath $vendorRoot){throw 'Cargo source restore requires a fresh vendor directory'}
$drlVendorBytes=0L;$drlVendorPackages=0
foreach($block in ($lock -split '\[\[package\]\]')){
  if($block -notmatch 'source = "registry\+'){continue}
  $packageName=[regex]::Match($block,'(?m)^name = "([\w-]+)"').Groups[1].Value
  $packageVersion=[regex]::Match($block,'(?m)^version = "([\w.+-]+)"').Groups[1].Value
  $packageChecksum=[regex]::Match($block,'(?m)^checksum = "([a-f0-9]{64})"').Groups[1].Value
  if(!$packageName -or !$packageVersion -or !$packageChecksum){throw 'Malformed locked Cargo source package'}
  $package=$packageName+'-'+$packageVersion
  $crate=Join-Path $drlRestoreRoot ('vendor-archives/'+$package+'.crate')
  if((Get-FileHash -LiteralPath $crate -Algorithm SHA256).Hash.ToLowerInvariant() -ne $packageChecksum){throw ('Cargo.lock source checksum differs: '+$package)}
  $output=Join-Path $vendorRoot $package
  $checksums=[ordered]@{}
  $compressed=[IO.File]::OpenRead($crate)
  $gzip=[IO.Compression.GZipStream]::new($compressed,[IO.Compression.CompressionMode]::Decompress,$false)
  $tar=[System.Formats.Tar.TarReader]::new($gzip,$false)
  try{
    while($null -ne ($entry=$tar.GetNextEntry($false))){
      if(!$entry.Name.StartsWith($package+'/',[StringComparison]::Ordinal) -and $entry.Name -ne $package){throw 'Cargo source archive root differs'}
      $relative=$entry.Name.Substring($package.Length).TrimStart('/').TrimEnd('/')
      if(!$relative){continue}
      $target=Get-DrlSourceTarget $output $relative
      if($entry.EntryType -eq [System.Formats.Tar.TarEntryType]::Directory){New-Item -ItemType Directory -Path $target -Force | Out-Null;continue}
      if($entry.EntryType -notin @([System.Formats.Tar.TarEntryType]::RegularFile,[System.Formats.Tar.TarEntryType]::V7RegularFile)){throw 'Cargo source links or special files rejected'}
      $drlVendorBytes+=$entry.Length
      if($entry.Length -gt 67108864 -or $drlVendorBytes -gt 536870912){throw 'Cargo source extraction exceeds bounds'}
      New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
      $stream=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
      try{$entry.DataStream.CopyTo($stream,1048576)}finally{$stream.Dispose()}
      $checksums[$relative]=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }finally{$tar.Dispose();$gzip.Dispose();$compressed.Dispose()}
  [IO.File]::WriteAllText((Join-Path $output '.cargo-checksum.json'),(@{files=$checksums;package=$packageChecksum}|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
  $drlVendorPackages++
}
$config=Join-Path $drlRestoreRoot 'port/.cargo/config.toml'
New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($config)) -Force | Out-Null
[IO.File]::WriteAllText($config,"[source.crates-io]`nreplace-with = `"drl-vendored`"`n[source.drl-vendored]`ndirectory = `"../vendor`"`n",[Text.UTF8Encoding]::new($false))
Write-Output (@{vendor_packages=$drlVendorPackages;vendor_bytes=$drlVendorBytes;fpc_restored=(!$VendorOnly);upstream_code_executed=$false}|ConvertTo-Json -Compress)
