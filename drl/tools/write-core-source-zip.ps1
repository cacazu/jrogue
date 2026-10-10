param([Parameter(Mandatory=$true)][string]$Plan,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
$drlPlan=Get-Content -LiteralPath $Plan -Raw -Encoding utf8 | ConvertFrom-Json
if($drlPlan.blockers.Count){throw 'Source plan has unresolved blockers'}
$drlArchivePath=[IO.Path]::GetFullPath($Destination)
$drlArchiveParent=[IO.Path]::GetDirectoryName($drlArchivePath)
New-Item -ItemType Directory -Path $drlArchiveParent -Force | Out-Null
$drlCandidate=$drlArchivePath+'.candidate'
$drlArchiveStream=[IO.File]::Open($drlCandidate,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None)
$drlZip=[IO.Compression.ZipArchive]::new($drlArchiveStream,[IO.Compression.ZipArchiveMode]::Create,$false)
$drlSeen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$drlPublic=[Collections.Generic.List[object]]::new()
$drlExpectedEntries=@{}
try{
  foreach($entry in $drlPlan.files){
    $relative=[string]$entry.path
    if($relative -match '(^[/\\])|(^[A-Za-z]:)|((^|/)\.\.(/|$))|\\|:'){throw 'Unsafe source archive path'}
    $name='drl-original-core/'+$relative
    if(!$drlSeen.Add($name)){throw 'Duplicate source archive path'}
    $source=Get-Item -LiteralPath $entry.source
    if(($source.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $source.Length -ne $entry.size){throw ('Source file differs: '+$relative)}
    $expected=[string]$entry.sha256
    if((Get-FileHash -LiteralPath $source.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw ('Source changed before packaging: '+$relative)}
    $compression=if($source.Extension -in @('.zip','.crate')){[IO.Compression.CompressionLevel]::NoCompression}else{[IO.Compression.CompressionLevel]::Optimal}
    $zipEntry=$drlZip.CreateEntry($name,$compression)
    $inputStream=[IO.File]::OpenRead($source.FullName)
    $entryStream=$zipEntry.Open()
    try{$inputStream.CopyTo($entryStream,1048576)}finally{$entryStream.Dispose();$inputStream.Dispose()}
    if((Get-FileHash -LiteralPath $source.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw ('Concurrent source change: '+$relative)}
    $drlPublic.Add(@{path=$relative;size=$entry.size;sha256=$expected})
    $drlExpectedEntries[$name]=$expected
  }
  $drlPublicPlan=[ordered]@{}
  foreach($property in $drlPlan.PSObject.Properties){if($property.Name -ne 'files'){$drlPublicPlan[$property.Name]=$property.Value}}
  $drlPublicPlan.files=$drlPublic
  $drlManifest=$drlZip.CreateEntry('drl-original-core/SOURCE-BUNDLE.json',[IO.Compression.CompressionLevel]::Optimal)
  $drlManifestStream=$drlManifest.Open()
  $drlManifestBytes=[Text.UTF8Encoding]::new($false).GetBytes(($drlPublicPlan|ConvertTo-Json -Depth 20)+"`n")
  $drlManifestHash=[Security.Cryptography.SHA256]::Create()
  try{$drlExpectedEntries['drl-original-core/SOURCE-BUNDLE.json']=[BitConverter]::ToString($drlManifestHash.ComputeHash($drlManifestBytes)).Replace('-','').ToLowerInvariant()}finally{$drlManifestHash.Dispose()}
  try{$drlManifestStream.Write($drlManifestBytes,0,$drlManifestBytes.Length)}finally{$drlManifestStream.Dispose()}
}finally{$drlZip.Dispose();$drlArchiveStream.Dispose()}
# Re-read and hash every decompressed entry before replacing the deliverable.
$drlCheckStream=[IO.File]::OpenRead($drlCandidate)
$drlCheckZip=[IO.Compression.ZipArchive]::new($drlCheckStream,[IO.Compression.ZipArchiveMode]::Read,$false)
try{
  if($drlCheckZip.Entries.Count -ne $drlPublic.Count+1){throw 'Source archive entry count differs'}
  foreach($entry in $drlCheckZip.Entries){
    $stream=$entry.Open();$sha=[Security.Cryptography.SHA256]::Create()
    try{$actual=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose();$stream.Dispose()}
    if(!$drlExpectedEntries.ContainsKey($entry.FullName) -or $actual -ne $drlExpectedEntries[$entry.FullName]){throw ('Source archive readback hash differs: '+$entry.FullName)}
  }
}finally{$drlCheckZip.Dispose();$drlCheckStream.Dispose()}
Move-Item -LiteralPath $drlCandidate -Destination $drlArchivePath -Force
$drlRecord=@{schema=1;file=[IO.Path]::GetFileName($drlArchivePath);size=(Get-Item -LiteralPath $drlArchivePath).Length;sha256=(Get-FileHash -LiteralPath $drlArchivePath -Algorithm SHA256).Hash.ToLowerInvariant();core_sha256=$drlPlan.core.sha256;source_files=$drlPublic.Count;publication=$false}
[IO.File]::WriteAllText((Join-Path $drlArchiveParent 'source-bundle.json'),($drlRecord|ConvertTo-Json -Depth 5)+"`n",[Text.UTF8Encoding]::new($false))
Write-Output ($drlRecord|ConvertTo-Json -Compress)
