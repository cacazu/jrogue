# Metadata-only amendment of an authenticated, already built source ZIP.
# Run serially after the normal writer and the five prose/status edits finish.
# Requires PowerShell 7.4+; neither gameplay compilation nor a browser is run.
param([string]$Plan='', [string]$Destination='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if($PSVersionTable.PSVersion -lt [Version]'7.4'){throw 'Use the retained official PowerShell 7.4+ portable/system runtime'}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.Text.Json
$drlTask=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$drlPlanPath=Join-Path $drlTask 'docs/core-source-package-plan.json'
$drlArchivePath=Join-Path $drlTask 'port/dist/source.zip'
if($Plan -and [IO.Path]::GetFullPath($Plan) -ne $drlPlanPath){throw 'Only this task source plan is permitted'}
if($Destination -and [IO.Path]::GetFullPath($Destination) -ne $drlArchivePath){throw 'Only this task port/dist/source.zip is permitted'}
$drlReceiptPath=Join-Path $drlTask 'port/dist/source-bundle.json'
$drlAuditPath=Join-Path $drlTask 'docs/METADATA-AMENDMENT-EVIDENCE.json'
$drlSelfPath=Join-Path $drlTask 'tools/amend-source-metadata.ps1'
if([IO.Path]::GetFullPath($PSCommandPath) -ne $drlSelfPath){throw 'Run this script from its own task tools directory'}
$drlExpectedPlanHash='704d7230a0ba1baa6438e75f0f8784ad7bc13c548bea761e7ce21d0e23d3b359'
$drlExpectedCore='20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60'
$drlExpectedSnapshot='12046f7aca6df64164114c03065834dd8e3dffdf79c5c374ca10d012112c99c4'
$drlOldPins=[ordered]@{
  'docs/LOCAL-RUN.md'=@{size=12921L;sha256='6c59a90ab962a654446206c7221e4e42812314aea36ac052c23d164cfbe19423'}
  'docs/CURRENT-CHECKPOINT.json'=@{size=39826L;sha256='24b4e36c9484df932b310e73165bde43db39c053b3e0436c8ca29cf7acd75da0'}
  'README.md'=@{size=7492L;sha256='37e6a396e2f3144e82b1cf426b488bd73378e745524792b794acfdccdd874d0b'}
  'docs/MIGRATION-STATUS.md'=@{size=22166L;sha256='98103db9fb7f19bda1958b24d5a5e761c31fc5cc64fd8df5d2e7b19c340cfa43'}
  'delivery.json'=@{size=39420L;sha256='9efa1cca7f216bf8f730bc9d2ed734664e881f09cadd128790a7e0d2143bffb9'}
}
$drlUtf8=[Text.UTF8Encoding]::new($false,$true)
$drlJsonOptions=[Text.Json.JsonSerializerOptions]::new()
$drlJsonOptions.WriteIndented=$true
function Assert-DrlNoLinks([string]$Path,[bool]$MayBeMissing=$false){
  $absolute=[IO.Path]::GetFullPath($Path)
  if($absolute -ne $drlTask -and !$absolute.StartsWith($drlTask+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Path escaped task root'}
  for($q=$absolute;$q;$q=[IO.Path]::GetDirectoryName($q)){
    if([IO.File]::Exists($q) -or [IO.Directory]::Exists($q)){
      if(([IO.File]::GetAttributes($q) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw ('Reparse point rejected: '+$q)}
    }elseif($q -eq $absolute -and $MayBeMissing){}else{throw ('Missing path/ancestor: '+$q)}
    if($q -eq [IO.Path]::GetPathRoot($absolute)){break}
  }
}
function Get-DrlHash([byte[]]$Bytes){return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes)).ToLowerInvariant()}
function Get-DrlFileHash([string]$Path){
  Assert-DrlNoLinks $Path
  $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try{return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant()}finally{$stream.Dispose()}
}
function Get-DrlStreamHash($Stream){return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Stream)).ToLowerInvariant()}
function Assert-DrlRelative([string]$Name){
  if(!$Name -or $Name.Length -gt 1024 -or $Name -match '[\\:<>{}|"?*\x00-\x1f\x7f]' -or $Name.StartsWith('/')){throw 'Unsafe archive path'}
  foreach($part in $Name.Split('/')){if(!$part -or $part -in @('.','..') -or $part -match '[. ]$' -or $part -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)'){throw ('Unsafe archive component: '+$Name)}}
}
function Get-DrlNodeCanonicalHash([Text.Json.Nodes.JsonNode]$Node){return Get-DrlHash ($drlUtf8.GetBytes($Node.ToJsonString()))}
function Get-DrlTextRecord([string]$Relative){
  # This exact allowlist admits no compiled source, mapping, translation, or runtime.
  if(!$drlOldPins.Contains($Relative) -and $Relative -ne 'tools/amend-source-metadata.ps1'){throw 'Undeclared metadata source'}
  Assert-DrlRelative $Relative
  $source=[IO.Path]::GetFullPath((Join-Path $drlTask $Relative));Assert-DrlNoLinks $source
  $item=Get-Item -LiteralPath $source
  if($item.PSIsContainer -or $item.Length -gt 1048576){throw 'Metadata text is not an ordinary bounded file'}
  $bytes=[IO.File]::ReadAllBytes($source)
  if($bytes.Length -ne $item.Length -or [Array]::IndexOf($bytes,[byte]0) -ge 0){throw 'Metadata text size/NUL check failed'}
  $text=$drlUtf8.GetString($bytes)
  if($Relative.EndsWith('.json')){$check=[Text.Json.JsonDocument]::Parse($text.TrimStart([char]0xfeff));$check.Dispose()}
  $hash=Get-DrlHash $bytes
  if((Get-DrlFileHash $source) -ne $hash){throw 'Metadata source changed while read'}
  return @{path=$Relative;source=$source;size=[long]$bytes.Length;sha256=$hash;bytes=$bytes}
}
function Assert-DrlFrozenSources($Records){
  foreach($r in $Records.Values){if((Get-DrlFileHash $r.source) -ne $r.sha256 -or ([IO.FileInfo]$r.source).Length -ne $r.size){throw ('Concurrent metadata source change: '+$r.path)}}
}
function Write-DrlNewBytes([string]$Path,[byte[]]$Bytes){
  Assert-DrlNoLinks $Path $true
  $s=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$s.Write($Bytes,0,$Bytes.Length);$s.Flush($true)}finally{$s.Dispose()}
}
function Get-DrlPublicManifestBytes([Text.Json.Nodes.JsonNode]$Node){
  $memory=[IO.MemoryStream]::new();$options=[Text.Json.JsonWriterOptions]::new();$options.Indented=$true
  $writer=[Text.Json.Utf8JsonWriter]::new($memory,$options)
  try{
    $writer.WriteStartObject()
    foreach($property in $Node.AsObject()){
      $writer.WritePropertyName($property.Key)
      # The authenticated old writer parsed created_utc as DateTime, shortening
      # the one pinned .320Z spelling to .32Z. Preserve the public manifest's
      # exact existing value, while the local plan retains its original value.
      if($property.Key -eq 'archiveDelta' -and $drlPreservedArchiveDelta){$drlPreservedArchiveDelta.WriteTo($writer);continue}
      if($property.Key -ne 'files'){$property.Value.WriteTo($writer);continue}
      $writer.WriteStartArray()
      foreach($record in $Node['files'].AsArray()){
        $writer.WriteStartObject();$writer.WriteString('path',[string]$record['path']);$writer.WriteNumber('size',[long]([string]$record['size']));$writer.WriteString('sha256',[string]$record['sha256']);$writer.WriteEndObject()
      }
      $writer.WriteEndArray()
    }
    $writer.WriteEndObject();$writer.Flush()
    return ,$memory.ToArray()
  }finally{$writer.Dispose();$memory.Dispose()}
}

# Authenticate the completed base archive, its selected plan, and public manifest.
foreach($p in @($drlPlanPath,$drlArchivePath,$drlReceiptPath,$drlSelfPath)){Assert-DrlNoLinks $p}
if(Test-Path -LiteralPath $drlAuditPath){throw 'A metadata amendment receipt already exists; no implicit repeat/rebase'}
$drlPlanBytes=[IO.File]::ReadAllBytes($drlPlanPath)
if((Get-DrlHash $drlPlanBytes) -ne $drlExpectedPlanHash){throw 'Frozen base plan checksum differs'}
$drlPlanNode=[Text.Json.Nodes.JsonNode]::Parse($drlUtf8.GetString($drlPlanBytes))
$drlPlanBytes=$null
$drlReceiptBytes=[IO.File]::ReadAllBytes($drlReceiptPath)
$drlReceiptHash=Get-DrlHash $drlReceiptBytes
$drlBase=ConvertFrom-Json -InputObject ($drlUtf8.GetString($drlReceiptBytes))
if($drlBase.schema -ne 1 -or $drlBase.file -ne 'source.zip' -or $drlBase.publication -ne $false -or $drlBase.source_files -ne 27664 -or $drlBase.core_sha256 -ne $drlExpectedCore -or $drlBase.sha256 -notmatch '^[a-f0-9]{64}$'){throw 'Completed base archive receipt identity differs'}
if(([IO.FileInfo]$drlArchivePath).Length -ne $drlBase.size -or $drlBase.size -gt 268435456 -or (Get-DrlFileHash $drlArchivePath) -ne $drlBase.sha256){throw 'Completed base ZIP size/hash differs'}
if([string]$drlPlanNode['schema'] -ne '1' -or $drlPlanNode['blockers'].AsArray().Count -ne 0 -or [string]$drlPlanNode['core']['sha256'] -ne $drlExpectedCore -or $drlPlanNode['core']['selectedUnits'].AsArray().Count -ne 139 -or $drlPlanNode['core']['sourceMappings'].AsArray().Count -ne 13776 -or [string]$drlPlanNode['core']['sourceSnapshotSha256'] -ne $drlExpectedSnapshot -or $drlPlanNode['files'].AsArray().Count -ne 27664 -or [string]$drlPlanNode['sourceBytes'] -ne '546303532'){throw 'Base compiled/all-source closure differs'}
$drlCoreMetadataHash=Get-DrlNodeCanonicalHash $drlPlanNode['core']
$drlByPath=[Collections.Generic.Dictionary[string,object]]::new([StringComparer]::Ordinal)
$drlNames=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$drlTotal=0L
foreach($r in $drlPlanNode['files'].AsArray()){
  $name=[string]$r['path'];Assert-DrlRelative $name
  $size=[long]([string]$r['size']);$hash=[string]$r['sha256']
  if(!$drlNames.Add($name) -or $size -lt 0 -or $size -gt 134217728 -or $hash -notmatch '^[a-f0-9]{64}$'){throw 'Malformed/duplicate base source record'}
  $drlByPath.Add($name,$r);$drlTotal+=$size
}
if($drlTotal -ne 546303532){throw 'Base source-byte sum differs'}
$drlArchiveStream=[IO.File]::OpenRead($drlArchivePath)
$drlOldZip=[IO.Compression.ZipArchive]::new($drlArchiveStream,[IO.Compression.ZipArchiveMode]::Read,$false)
$drlManifestDocument=$null
$drlPreservedArchiveDelta=$null
$drlBaseDateNormalization=$null
try{
  if($drlOldZip.Entries.Count -ne 27665){throw 'Base ZIP entry count differs'}
  $manifest=$drlOldZip.GetEntry('drl-original-core/SOURCE-BUNDLE.json')
  if(!$manifest -or $manifest.Length -gt 16777216){throw 'Base public manifest missing/over quota'}
  $inputStream=$manifest.Open()
  try{$drlManifestDocument=[Text.Json.JsonDocument]::Parse($inputStream)}finally{$inputStream.Dispose()}
  $old=$drlManifestDocument.RootElement
  if($old.GetProperty('files').GetArrayLength() -ne 27664){throw 'Base manifest record count differs'}
  $drlPropertyNames=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach($prop in $old.EnumerateObject()){
    if(!$drlPropertyNames.Add($prop.Name) -or !$drlPlanNode.AsObject().ContainsKey($prop.Name)){throw 'Unexpected/duplicate base manifest field'}
    if($prop.Name -ne 'files'){
      $oldNode=[Text.Json.Nodes.JsonNode]::Parse($prop.Value.GetRawText())
      if(![Text.Json.Nodes.JsonNode]::DeepEquals($drlPlanNode[$prop.Name],$oldNode)){
        # Permit only the actually observed, exact frozen baseline timestamp
        # spelling pair. No generic timestamp/string normalization is allowed.
        if($prop.Name -ne 'archiveDelta' -or [string]$drlPlanNode['archiveDelta']['created_utc'] -ne '2026-10-02T23:38:10.320Z' -or [string]$oldNode['created_utc'] -ne '2026-10-02T23:38:10.32Z'){throw ('Base plan/public manifest metadata differs: '+$prop.Name)}
        $comparison=$drlPlanNode['archiveDelta'].DeepClone()
        $comparison['created_utc']=[Text.Json.Nodes.JsonValue]::Create('2026-10-02T23:38:10.32Z')
        if(![Text.Json.Nodes.JsonNode]::DeepEquals($comparison,$oldNode)){throw 'Base archiveDelta has differences beyond the pinned writer timestamp spelling'}
        $drlPreservedArchiveDelta=$oldNode
        $drlBaseDateNormalization=[ordered]@{path='archiveDelta.created_utc';plan='2026-10-02T23:38:10.320Z';public_manifest='2026-10-02T23:38:10.32Z';cause='Existing PowerShell ConvertFrom-Json DateTime round-trip';public_manifest_value_preserved=$true;plan_value_preserved=$true;other_values_structurally_identical=$true}
        $comparison=$null
      }
      $oldNode=$null
    }
  }
  if($drlPropertyNames.Count -ne $drlPlanNode.AsObject().Count){throw 'Base plan/public manifest fields differ'}
  $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach($f in $old.GetProperty('files').EnumerateArray()){
    $name=$f.GetProperty('path').GetString()
    if(!$seen.Add($name) -or !$drlByPath.ContainsKey($name) -or @($f.EnumerateObject()).Count -ne 3){throw 'Unexpected/duplicate public source record'}
    $r=$drlByPath[$name]
    if($f.GetProperty('size').GetInt64() -ne [long]([string]$r['size']) -or $f.GetProperty('sha256').GetString() -ne [string]$r['sha256']){throw ('Base plan/manifest record differs: '+$name)}
  }
  $zipNames=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach($e in $drlOldZip.Entries){
    if(!$zipNames.Add($e.FullName) -or !$e.FullName.StartsWith('drl-original-core/')){throw 'Unexpected/duplicate ZIP name'}
    if($e.FullName -eq 'drl-original-core/SOURCE-BUNDLE.json'){continue}
    $name=$e.FullName.Substring(18);Assert-DrlRelative $name
    if(!$drlByPath.ContainsKey($name) -or $e.Length -ne [long]([string]$drlByPath[$name]['size']) -or (($e.ExternalAttributes -shr 16) -band 0xf000) -eq 0xa000){throw ('Base ZIP inventory differs: '+$name)}
  }
  foreach($name in $drlOldPins.Keys){
    $r=$drlByPath[$name];$pin=$drlOldPins[$name]
    if(!$r -or [string]$r['sha256'] -ne $pin.sha256 -or [long]([string]$r['size']) -ne $pin.size -or [IO.Path]::GetFullPath([string]$r['source']) -ne (Join-Path $drlTask $name)){throw ('Pinned old authored record differs: '+$name)}
    $e=$drlOldZip.GetEntry('drl-original-core/'+$name);$s=$e.Open()
    try{if((Get-DrlStreamHash $s) -ne $pin.sha256){throw ('Pinned old metadata ZIP bytes differ: '+$name)}}finally{$s.Dispose()}
  }
}finally{if($drlManifestDocument){$drlManifestDocument.Dispose()};$drlOldZip.Dispose();$drlArchiveStream.Dispose()}

# Exactly five authored amendments plus this self-contained recipe. All compiled
# selections/mappings and complete-source snapshot metadata retain their identity.
$drlNew=[ordered]@{};$drlCorrections=[Collections.Generic.List[object]]::new()
foreach($name in @($drlOldPins.Keys)+@('tools/amend-source-metadata.ps1')){
  foreach($u in $drlPlanNode['core']['selectedUnits'].AsArray()){if([string]$u['path'] -eq $name){throw 'Metadata is a compiled source input'}}
  foreach($m in $drlPlanNode['core']['sourceMappings'].AsArray()){if([string]$m['sourcePath'] -eq $name -or [string]$m['buildPath'] -eq $name){throw 'Metadata is a linked source mapping'}}
  $r=Get-DrlTextRecord $name;$drlNew[$name]=$r
  if($drlOldPins.Contains($name)){
    $previous=$drlByPath[$name]
    if($r.sha256 -eq [string]$previous['sha256']){throw ('Expected authored correction has not changed: '+$name)}
    $drlCorrections.Add([ordered]@{path=$name;previous=@{size=[long]([string]$previous['size']);sha256=[string]$previous['sha256']};current=@{size=$r.size;sha256=$r.sha256}})
    $drlTotal+=$r.size-[long]([string]$previous['size'])
    $previous['size']=[Text.Json.Nodes.JsonValue]::Create([long]$r.size);$previous['sha256']=[Text.Json.Nodes.JsonValue]::Create([string]$r.sha256)
  }else{
    if($drlNames.Contains($name)){throw 'Amendment recipe unexpectedly already selected'}
    $node=[Text.Json.Nodes.JsonNode]::Parse((@{path=$name;source=$r.source;size=$r.size;sha256=$r.sha256}|ConvertTo-Json -Compress))
    $drlPlanNode['files'].AsArray().Add($node);$drlByPath.Add($name,$node);$drlTotal+=$r.size
  }
}
if($drlCorrections.Count -ne 5 -or $drlPlanNode['files'].AsArray().Count -ne 27665){throw 'Amendment allowlist/count differs'}
$drlPlanNode['sourceFiles']=[Text.Json.Nodes.JsonValue]::Create(27665)
$drlPlanNode['sourceBytes']=[Text.Json.Nodes.JsonValue]::Create($drlTotal)
$drlMetadata=[ordered]@{schema=1;created_utc=[DateTime]::UtcNow.ToString('o');base_archive_sha256=$drlBase.sha256;base_plan_sha256=$drlExpectedPlanHash;base_source_files=27664;base_source_bytes=546303532;updated=$drlCorrections.ToArray();added=@(@{path='tools/amend-source-metadata.ps1';size=$drlNew['tools/amend-source-metadata.ps1'].size;sha256=$drlNew['tools/amend-source-metadata.ps1'].sha256});compiled_source_records=139;source_mappings=13776;core_source_metadata_unchanged=$true;runtime_or_compiled_source_changed=$false;base_manifest_datetime_normalization=$drlBaseDateNormalization;publication=$false}
$drlPlanNode['metadataCorrections']=[Text.Json.Nodes.JsonNode]::Parse(($drlMetadata|ConvertTo-Json -Depth 12 -Compress))
if((Get-DrlNodeCanonicalHash $drlPlanNode['core']) -ne $drlCoreMetadataHash){throw 'Compiled/all-source metadata changed'}
$drlPublicBytes=Get-DrlPublicManifestBytes $drlPlanNode
$drlPublicHash=Get-DrlHash $drlPublicBytes
$drlUpdatedPlanBytes=$drlUtf8.GetBytes($drlPlanNode.ToJsonString($drlJsonOptions)+"`n")
$drlPlanCandidate=$drlPlanPath+'.metadata-candidate'
$drlArchiveCandidate=$drlArchivePath+'.metadata-candidate'
$drlReceiptCandidate=$drlReceiptPath+'.metadata-candidate'
foreach($p in @($drlPlanCandidate,$drlArchiveCandidate,$drlReceiptCandidate,$drlAuditPath)){Assert-DrlNoLinks $p $true;if(Test-Path -LiteralPath $p){throw ('Candidate/receipt already exists: '+$p)}}
Assert-DrlFrozenSources $drlNew
if((Get-DrlFileHash $drlPlanPath) -ne $drlExpectedPlanHash -or (Get-DrlFileHash $drlReceiptPath) -ne $drlReceiptHash -or (Get-DrlFileHash $drlArchivePath) -ne $drlBase.sha256){throw 'Concurrent base mutation before candidate copy'}
[IO.File]::Copy($drlArchivePath,$drlArchiveCandidate,$false)
Assert-DrlNoLinks $drlArchiveCandidate
if((Get-DrlFileHash $drlArchiveCandidate) -ne $drlBase.sha256){throw 'Copied base ZIP checksum differs'}
$drlUpdateStream=[IO.File]::Open($drlArchiveCandidate,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$drlUpdateZip=[IO.Compression.ZipArchive]::new($drlUpdateStream,[IO.Compression.ZipArchiveMode]::Update,$false)
try{
  foreach($r in $drlNew.Values){
    $name='drl-original-core/'+$r.path;$existing=$drlUpdateZip.GetEntry($name)
    if($drlOldPins.Contains($r.path)){if(!$existing){throw 'Old correction entry vanished'};$existing.Delete()}elseif($existing){throw 'Recipe ZIP entry already exists'}
    $entry=$drlUpdateZip.CreateEntry($name,[IO.Compression.CompressionLevel]::Optimal);$s=$entry.Open()
    try{$s.Write($r.bytes,0,$r.bytes.Length)}finally{$s.Dispose()}
  }
  $drlUpdateZip.GetEntry('drl-original-core/SOURCE-BUNDLE.json').Delete()
  $entry=$drlUpdateZip.CreateEntry('drl-original-core/SOURCE-BUNDLE.json',[IO.Compression.CompressionLevel]::Optimal);$s=$entry.Open()
  try{$s.Write($drlPublicBytes,0,$drlPublicBytes.Length)}finally{$s.Dispose()}
}finally{$drlUpdateZip.Dispose();$drlUpdateStream.Dispose()}

# Stream every decompressed candidate entry, including the exact new manifest.
# No complete expanded archive, recursive filesystem operation, or global install.
$drlReadStream=[IO.File]::OpenRead($drlArchiveCandidate)
$drlReadZip=[IO.Compression.ZipArchive]::new($drlReadStream,[IO.Compression.ZipArchiveMode]::Read,$false)
try{
  if($drlReadZip.Entries.Count -ne 27666){throw 'Candidate ZIP count differs'}
  $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach($e in $drlReadZip.Entries){
    if(!$seen.Add($e.FullName) -or !$e.FullName.StartsWith('drl-original-core/')){throw 'Candidate duplicate/foreign entry'}
    if($e.FullName -eq 'drl-original-core/SOURCE-BUNDLE.json'){$size=$drlPublicBytes.Length;$expected=$drlPublicHash}else{
      $name=$e.FullName.Substring(18);Assert-DrlRelative $name
      if(!$drlByPath.ContainsKey($name)){throw 'Candidate undeclared source entry'}
      $r=$drlByPath[$name];$size=[long]([string]$r['size']);$expected=[string]$r['sha256']
    }
    if($e.Length -ne $size -or (($e.ExternalAttributes -shr 16) -band 0xf000) -eq 0xa000){throw ('Candidate entry size/type differs: '+$e.FullName)}
    $s=$e.Open();try{$actual=Get-DrlStreamHash $s}finally{$s.Dispose()}
    if($actual -ne $expected){throw ('Full candidate readback hash differs: '+$e.FullName)}
  }
}finally{$drlReadZip.Dispose();$drlReadStream.Dispose()}
Assert-DrlFrozenSources $drlNew
$drlFinalHash=Get-DrlFileHash $drlArchiveCandidate
$drlFinalSize=([IO.FileInfo]$drlArchiveCandidate).Length
if($drlFinalSize -gt 268435456){throw 'Amended ZIP exceeded outer quota'}
$drlRecord=[ordered]@{schema=1;file='source.zip';size=$drlFinalSize;sha256=$drlFinalHash;core_sha256=$drlExpectedCore;source_files=27665;publication=$false}
Write-DrlNewBytes $drlPlanCandidate $drlUpdatedPlanBytes
Write-DrlNewBytes $drlReceiptCandidate ($drlUtf8.GetBytes(($drlRecord|ConvertTo-Json -Depth 5)+"`n"))
if((Get-DrlFileHash $drlPlanCandidate) -ne (Get-DrlHash $drlUpdatedPlanBytes)){throw 'Updated source plan readback differs'}
if((Get-DrlFileHash $drlPlanPath) -ne $drlExpectedPlanHash -or (Get-DrlFileHash $drlReceiptPath) -ne $drlReceiptHash -or (Get-DrlFileHash $drlArchivePath) -ne $drlBase.sha256){throw 'Concurrent base mutation before replacement'}
Assert-DrlFrozenSources $drlNew
foreach($p in @($drlArchivePath,$drlArchiveCandidate,$drlPlanPath,$drlPlanCandidate,$drlReceiptPath,$drlReceiptCandidate)){Assert-DrlNoLinks $p}
# Each existing file receives a same-directory atomic replacement. The outer
# receipt is last, so an interrupted multi-file commit cannot falsely authenticate.
# NullString supplies an actual CLR null for the optional backup filename;
# ordinary PowerShell $null binds to an empty string for this overload.
[IO.File]::Replace($drlArchiveCandidate,$drlArchivePath,[NullString]::Value)
[IO.File]::Replace($drlPlanCandidate,$drlPlanPath,[NullString]::Value)
[IO.File]::Replace($drlReceiptCandidate,$drlReceiptPath,[NullString]::Value)
Assert-DrlFrozenSources $drlNew
if((Get-DrlFileHash $drlArchivePath) -ne $drlFinalHash -or (Get-DrlFileHash $drlPlanPath) -ne (Get-DrlHash $drlUpdatedPlanBytes)){throw 'Final replacement readback differs'}
$drlAudit=[ordered]@{schema=1;result='pass';completed_utc=[DateTime]::UtcNow.ToString('o');scope='Five authored metadata/prose amendments plus the self-contained amendment recipe; no runtime/compiled-source changes';base_archive_sha256=$drlBase.sha256;base_plan_sha256=$drlExpectedPlanHash;archive_sha256=$drlFinalHash;archive_size=$drlFinalSize;plan_sha256=(Get-DrlHash $drlUpdatedPlanBytes);manifest_sha256=$drlPublicHash;source_files=27665;source_bytes=$drlTotal;entries_readback_verified=27666;core_sha256=$drlExpectedCore;compiled_source_records=139;source_mappings=13776;source_snapshot_sha256=$drlExpectedSnapshot;metadataCorrections=$drlMetadata;unchanged_prior_records=27659;full_decompressed_readback=$true;before_after_source_hashes_verified=$true;publication=$false;full_port_complete=$false}
Write-DrlNewBytes $drlAuditPath ($drlUtf8.GetBytes(($drlAudit|ConvertTo-Json -Depth 16)+"`n"))
Write-Output ($drlRecord|ConvertTo-Json -Compress)
