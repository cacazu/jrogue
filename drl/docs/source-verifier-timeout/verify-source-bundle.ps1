param(
    [string]$Archive = (Join-Path $PSScriptRoot '../port/dist/source.zip'),
    [string]$Evidence,
    [switch]$Restore,
    [int]$ExpectedSourceFiles = 0,
    [long]$ExpectedSourceBytes = 0
)

# This verifier executes no acquired upstream code. -Restore runs only the
# hash-verified authored extraction script, leaving its source tree for later
# clean-build checks. It never deletes a directory or copies installed binaries.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw 'Source bundle verification requires PowerShell 7'
}
Add-Type -AssemblyName System.IO.Compression

$drlTaskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')
$drlTempRoot = [IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Temp')).TrimEnd('\', '/')
$drlMaxEntries = 32768
$drlMaxSourceBytes = 671088640L
$drlMaxEntryBytes = 134217728L
$drlMaxManifestBytes = 16777216L
$drlPrefix = 'drl-original-core/'
$drlHashBuffer = [byte[]]::new(1048576)

function Test-DrlBelow([string]$Path, [string]$Base) {
    return $Path.StartsWith($Base + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
}

function Get-DrlAllowedPath([string]$Path) {
    if (!$Path) { throw 'Missing filesystem path' }
    $full = [IO.Path]::GetFullPath($Path)
    if (!(Test-DrlBelow $full $drlTaskRoot) -and !(Test-DrlBelow $full $drlTempRoot)) {
        throw 'Filesystem path is outside the task workspace and allowed temporary directory'
    }
    return $full
}

function Assert-DrlAncestors([string]$Path, [string]$Base) {
    $checked = [IO.Path]::GetFullPath($Path)
    if ($checked -ne $Base -and !(Test-DrlBelow $checked $Base)) { throw 'Filesystem target escaped its checked base' }
    while ($true) {
        if (Test-Path -LiteralPath $checked) {
            $item = Get-Item -LiteralPath $checked -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Filesystem reparse points are rejected' }
        }
        if ($checked.Equals($Base, [StringComparison]::OrdinalIgnoreCase)) { break }
        $checked = [IO.Path]::GetDirectoryName($checked)
        if (!$checked) { throw 'Filesystem ancestor validation escaped its checked base' }
    }
}

function Assert-DrlAllowedAncestors([string]$Path) {
    $base = if (Test-DrlBelow $Path $drlTaskRoot) { $drlTaskRoot } else { $drlTempRoot }
    Assert-DrlAncestors $Path $base
}

function Assert-DrlRelative([string]$Relative) {
    if (!$Relative -or $Relative.Length -gt 1024 -or
        $Relative -match '[\\:<>{}|"?*\x00-\x1f\x7f]' -or $Relative.StartsWith('/')) {
        throw 'Unsafe source bundle path'
    }
    foreach ($part in $Relative.Split('/')) {
        if (!$part -or $part -in @('.', '..') -or $part.Length -gt 255 -or
            $part.EndsWith('.') -or $part.EndsWith(' ') -or
            $part -match '^(?i:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)') {
            throw 'Noncanonical or Windows-unsafe source bundle path'
        }
    }
}

function Get-DrlTarget([string]$Base, [string]$Relative) {
    Assert-DrlRelative $Relative
    $target = [IO.Path]::GetFullPath((Join-Path $Base $Relative))
    if (!(Test-DrlBelow $target $Base)) { throw 'Source bundle target escaped extraction directory' }
    return $target
}

function Assert-DrlHash([object]$Value) {
    if ($Value -isnot [string] -or $Value -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid lowercase SHA256 value' }
}

function Assert-DrlInteger([object]$Value, [long]$Maximum) {
    if (($Value -isnot [long] -and $Value -isnot [int]) -or $Value -lt 0 -or $Value -gt $Maximum) {
        throw 'Invalid bounded integer value'
    }
}

function Assert-DrlKeys([Collections.IDictionary]$Object, [string[]]$Required, [string[]]$Allowed) {
    if ($null -eq $Object) { throw 'Manifest object is required' }
    foreach ($key in $Required) {
        if (!$Object.Contains($key)) { throw ('Missing manifest field: ' + $key) }
    }
    foreach ($key in $Object.Keys) {
        if ($Allowed -cnotcontains [string]$key) { throw ('Unexpected manifest field: ' + $key) }
    }
}

function Assert-DrlJsonKeys([System.Text.Json.JsonElement]$Element) {
    if ($Element.ValueKind -eq [System.Text.Json.JsonValueKind]::Object) {
        $keys = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        foreach ($property in $Element.EnumerateObject()) {
            if (!$keys.Add($property.Name)) { throw 'Duplicate or case-ambiguous JSON property' }
            Assert-DrlJsonKeys $property.Value
        }
    } elseif ($Element.ValueKind -eq [System.Text.Json.JsonValueKind]::Array) {
        foreach ($child in $Element.EnumerateArray()) { Assert-DrlJsonKeys $child }
    }
}

function Read-DrlJson([byte[]]$Bytes) {
    $text = [Text.UTF8Encoding]::new($false, $true).GetString($Bytes)
    $document = [System.Text.Json.JsonDocument]::Parse($text)
    try { Assert-DrlJsonKeys $document.RootElement } finally { $document.Dispose() }
    return ConvertFrom-Json -InputObject $text -AsHashtable -Depth 100
}

function Get-DrlStreamHash([IO.Stream]$Stream, [long]$ExpectedBytes) {
    $hash = [Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256)
    $count = 0L
    try {
        while (($read = $Stream.Read($drlHashBuffer, 0, $drlHashBuffer.Length)) -gt 0) {
            $count += $read
            if ($count -gt $ExpectedBytes) { throw 'Decompressed source entry exceeds its declared size' }
            $hash.AppendData($drlHashBuffer, 0, $read)
        }
        if ($count -ne $ExpectedBytes) { throw 'Decompressed source entry size differs' }
        return [Convert]::ToHexString($hash.GetHashAndReset()).ToLowerInvariant()
    } finally { $hash.Dispose() }
}

function Write-DrlEvidence([Collections.IDictionary]$Record, [string]$Path) {
    $checked = Get-DrlAllowedPath $Path
    Assert-DrlAllowedAncestors $checked
    if (Test-Path -LiteralPath $checked) { throw 'Evidence file already exists; choose a new path' }
    $parent = [IO.Path]::GetDirectoryName($checked)
    [IO.Directory]::CreateDirectory($parent) | Out-Null
    Assert-DrlAllowedAncestors $checked
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Record | ConvertTo-Json -Depth 12) + "`n")
    $output = [IO.File]::Open($checked, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $output.Write($bytes, 0, $bytes.Length) } finally { $output.Dispose() }
}

$drlArchivePath = Get-DrlAllowedPath $Archive
$drlReceiptPath = Get-DrlAllowedPath (Join-Path ([IO.Path]::GetDirectoryName($drlArchivePath)) 'source-bundle.json')
$drlEvidencePath = if ($Evidence) { Get-DrlAllowedPath $Evidence } else {
    Get-DrlAllowedPath (Join-Path $drlTaskRoot ('docs/source-bundle-verification-' + [Guid]::NewGuid().ToString('N') + '.json'))
}
Assert-DrlAllowedAncestors $drlArchivePath
Assert-DrlAllowedAncestors $drlReceiptPath
Assert-DrlAllowedAncestors $drlEvidencePath
if (Test-Path -LiteralPath $drlEvidencePath) { throw 'Evidence path must be new' }
if ($ExpectedSourceFiles -lt 0 -or $ExpectedSourceBytes -lt 0) { throw 'Expected inventory values cannot be negative' }

$drlRecord = [ordered]@{
    schema = 1
    format = 'drl-source-bundle-verification'
    result = 'running'
    started_utc = [DateTime]::UtcNow.ToString('o')
    archive = $drlArchivePath
    evidence = $drlEvidencePath
    archive_sha256 = $null
    manifest_sha256 = $null
    manifest_schema = $null
    archive_entries = 0
    source_files = 0
    source_bytes = 0L
    archive_hashes_verified = 0
    extracted_hashes_verified = 0
    extracted_root = $null
    extraction_retained = $false
    source_mappings_verified = 0
    vendor_packages = 0
    restore_requested = [bool]$Restore
    authored_restore_script_executed = $false
    fpc_restored = $false
    upstream_code_executed = $false
    existing_binaries_copied = $false
    error = $null
}

$drlArchiveStream = $null
$drlZip = $null
try {
    $archiveItem = Get-Item -LiteralPath $drlArchivePath -Force
    $receiptItem = Get-Item -LiteralPath $drlReceiptPath -Force
    if ($archiveItem.PSIsContainer -or $receiptItem.PSIsContainer -or
        $archiveItem.Length -gt $drlMaxSourceBytes -or $receiptItem.Length -gt 1048576) {
        throw 'Source archive or external receipt exceeds bounds or is not a file'
    }
    $receipt = Read-DrlJson ([IO.File]::ReadAllBytes($drlReceiptPath))
    Assert-DrlKeys $receipt @('schema', 'file', 'size', 'sha256', 'core_sha256', 'source_files', 'publication') @('schema', 'file', 'size', 'sha256', 'core_sha256', 'source_files', 'publication')
    if ($receipt.schema -ne 1 -or $receipt.file -cne [IO.Path]::GetFileName($drlArchivePath) -or
        $receipt.publication -isnot [bool] -or $receipt.publication -ne $false) {
        throw 'External source bundle receipt schema, filename, or publication state differs'
    }
    Assert-DrlHash $receipt.sha256
    Assert-DrlHash $receipt.core_sha256
    Assert-DrlInteger $receipt.size $drlMaxSourceBytes
    Assert-DrlInteger $receipt.source_files ($drlMaxEntries - 1)
    if ($receipt.size -ne $archiveItem.Length) { throw 'External archive size receipt differs' }

    # Holding a read-only share prevents the source archive from changing while
    # its bytes, central directory, manifest, and decompressed content are checked.
    $drlArchiveStream = [IO.File]::Open($drlArchivePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $drlRecord.archive_sha256 = Get-DrlStreamHash $drlArchiveStream $archiveItem.Length
    if ($drlRecord.archive_sha256 -cne $receipt.sha256) { throw 'Archive SHA256 differs from its external receipt' }
    $drlArchiveStream.Position = 0
    $drlZip = [IO.Compression.ZipArchive]::new($drlArchiveStream, [IO.Compression.ZipArchiveMode]::Read, $true)
    $drlRecord.archive_entries = $drlZip.Entries.Count
    if ($drlZip.Entries.Count -lt 2 -or $drlZip.Entries.Count -gt $drlMaxEntries) { throw 'Source archive entry count exceeds bounds' }
    $entries = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::OrdinalIgnoreCase)
    $zipBytes = 0L
    foreach ($entry in $drlZip.Entries) {
        $name = [string]$entry.FullName
        if (!$name.StartsWith($drlPrefix, [StringComparison]::Ordinal)) { throw 'Unexpected source archive root' }
        $relative = $name.Substring($drlPrefix.Length)
        Assert-DrlRelative $relative
        $mode = ($entry.ExternalAttributes -shr 16) -band 61440
        if ($mode -notin @(0, 32768) -or ($entry.ExternalAttributes -band 1040)) {
            throw 'Source archive symlink, reparse point, directory, or special entry rejected'
        }
        if ($relative -match '(?i)\.(exe|dll|so|dylib|a|o|ppu|wasm)$') { throw 'Compiled binaries are not permitted as direct source bundle entries' }
        if ($entry.Length -lt 0 -or $entry.Length -gt $drlMaxEntryBytes) { throw 'Source entry exceeds size bounds' }
        $zipBytes += $entry.Length
        if ($zipBytes -gt $drlMaxSourceBytes + $drlMaxManifestBytes) { throw 'Source archive decompressed inventory exceeds bounds' }
        if (!$entries.TryAdd($relative, $entry)) { throw 'Duplicate case-insensitive source archive path' }
    }
    foreach ($name in $entries.Keys) {
        $ancestor = $name
        while ($ancestor.Contains('/')) {
            $ancestor = $ancestor.Substring(0, $ancestor.LastIndexOf('/'))
            if ($entries.ContainsKey($ancestor)) { throw 'Source file conflicts with an ancestor directory path' }
        }
    }
    if (!$entries.ContainsKey('SOURCE-BUNDLE.json')) { throw 'SOURCE-BUNDLE.json is absent' }
    $manifestEntry = $entries['SOURCE-BUNDLE.json']
    if ($manifestEntry.FullName -cne ($drlPrefix + 'SOURCE-BUNDLE.json')) { throw 'Source manifest filename case differs' }
    if ($manifestEntry.Length -gt $drlMaxManifestBytes) { throw 'Source manifest exceeds bounds' }
    $manifestStream = $manifestEntry.Open()
    $manifestBytes = [IO.MemoryStream]::new()
    try {
        while (($read = $manifestStream.Read($drlHashBuffer, 0, $drlHashBuffer.Length)) -gt 0) {
            if ($manifestBytes.Length + $read -gt $manifestEntry.Length) { throw 'Manifest decompressed bytes exceed declared size' }
            $manifestBytes.Write($drlHashBuffer, 0, $read)
        }
        if ($manifestBytes.Length -ne $manifestEntry.Length) { throw 'Manifest decompressed size differs' }
        $manifest = Read-DrlJson $manifestBytes.ToArray()
        $drlRecord.manifest_sha256 = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($manifestBytes.ToArray())).ToLowerInvariant()
    } finally { $manifestStream.Dispose(); $manifestBytes.Dispose() }
    Assert-DrlKeys $manifest @('schema', 'scope', 'full_port_complete', 'publication_approved', 'created_utc', 'sourceDependencies', 'sourceCompanionArchives', 'lockedRustPackages', 'excludedSdkBindings', 'blockers', 'files', 'core') @('schema', 'scope', 'full_port_complete', 'publication_approved', 'created_utc', 'sourceDependencies', 'sourceCompanionArchives', 'lockedRustPackages', 'excludedSdkBindings', 'blockers', 'files', 'core')
    if ($manifest.schema -ne 1 -or $manifest.blockers -isnot [array] -or $manifest.blockers.Count -ne 0 -or
        $manifest.files -isnot [array] -or $manifest.lockedRustPackages -isnot [array] -or
        $manifest.publication_approved -isnot [bool] -or $manifest.publication_approved -ne $false -or
        $manifest.full_port_complete -isnot [bool] -or $manifest.full_port_complete -ne $false) {
        throw 'Unsupported or blocked source candidate manifest'
    }
    Assert-DrlKeys $manifest.core @('sha256', 'size', 'archives', 'selectedUnits', 'sourceSnapshotSha256', 'sourceMappings') @('sha256', 'size', 'archives', 'selectedUnits', 'sourceSnapshotSha256', 'sourceMappings')
    if ($manifest.core.sourceMappings -isnot [array]) { throw 'Core source mapping array is required' }
    $drlRecord.manifest_schema = $manifest.schema
    Assert-DrlHash $manifest.core.sha256
    if ($manifest.core.sha256 -cne $receipt.core_sha256) { throw 'Core identity differs between manifest and external receipt' }
    $files = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::OrdinalIgnoreCase)
    $sourceBytes = 0L
    foreach ($file in $manifest.files) {
        Assert-DrlKeys $file @('path', 'size', 'sha256') @('path', 'size', 'sha256')
        if ($file.path -isnot [string]) { throw 'Source manifest path must be a string' }
        Assert-DrlRelative $file.path
        Assert-DrlHash $file.sha256
        Assert-DrlInteger $file.size $drlMaxEntryBytes
        if ($file.path -ieq 'SOURCE-BUNDLE.json' -or !$files.TryAdd($file.path, $file)) { throw 'Duplicate source manifest path' }
        if (!$entries.ContainsKey($file.path) -or $entries[$file.path].FullName -cne ($drlPrefix + $file.path) -or $entries[$file.path].Length -ne $file.size) {
            throw ('Archive membership, case, or size differs: ' + $file.path)
        }
        $sourceBytes += $file.size
        if ($sourceBytes -gt $drlMaxSourceBytes) { throw 'Source manifest total exceeds bounds' }
    }
    if ($files.Count -ne $receipt.source_files -or $entries.Count -ne $files.Count + 1 -or $zipBytes -ne $sourceBytes + $manifestEntry.Length) {
        throw 'Source manifest, receipt, and archive counts or total bytes differ'
    }
    if (($ExpectedSourceFiles -and $files.Count -ne $ExpectedSourceFiles) -or ($ExpectedSourceBytes -and $sourceBytes -ne $ExpectedSourceBytes)) {
        throw 'Source inventory differs from the caller supplied expected count or bytes'
    }
    $drlRecord.source_files = $files.Count
    $drlRecord.source_bytes = $sourceBytes
    $mappingPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($mapping in $manifest.core.sourceMappings) {
        Assert-DrlKeys $mapping @('sourcePath', 'buildPath', 'sha256') @('sourcePath', 'buildPath', 'sha256')
        Assert-DrlRelative $mapping.sourcePath
        Assert-DrlRelative $mapping.buildPath
        Assert-DrlHash $mapping.sha256
        if ($mapping.buildPath -cnotmatch '^toolchain/(fpc-src/(rtl|packages)/|packages-exnref/)' -or
            $mapping.sourcePath -cne ('linked-source/' + $mapping.buildPath) -or
            $mapping.buildPath -cnotmatch '\.(pas|pp|inc|c|h|lua|lpr|json|mjs|ps1)$' -or
            !$mappingPaths.Add($mapping.buildPath) -or !$files.ContainsKey($mapping.sourcePath) -or
            $files[$mapping.sourcePath].sha256 -cne $mapping.sha256) { throw 'Invalid or unselected core source mapping' }
    }
    foreach ($file in $files.Values) {
        $input = $entries[$file.path].Open()
        try { $actual = Get-DrlStreamHash $input $file.size } finally { $input.Dispose() }
        if ($actual -cne $file.sha256) { throw ('Archive source SHA256 differs: ' + $file.path) }
        $drlRecord.archive_hashes_verified++
    }

    # No extraction starts until every archive source hash has passed.
    $extraction = Get-DrlAllowedPath (Join-Path $drlTempRoot ('drl-source-verify-' + [Guid]::NewGuid().ToString('N')))
    Assert-DrlAncestors $extraction $drlTempRoot
    if (Test-Path -LiteralPath $extraction) { throw 'Extraction directory must be newly created' }
    New-Item -ItemType Directory -Path $extraction -ErrorAction Stop | Out-Null
    $extractedRoot = Get-DrlTarget $extraction 'drl-original-core'
    $drlRecord.extracted_root = $extractedRoot
    $drlRecord.extraction_retained = $true
    foreach ($entry in $entries.Values) {
        $relative = $entry.FullName.Substring($drlPrefix.Length)
        $target = Get-DrlTarget $extractedRoot $relative
        Assert-DrlAncestors $target $extraction
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
        Assert-DrlAncestors $target $extraction
        $input = $entry.Open()
        $output = [IO.File]::Open($target, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $input.CopyTo($output, 1048576) } finally { $output.Dispose(); $input.Dispose() }
        if ((Get-Item -LiteralPath $target).Length -ne $entry.Length) { throw 'Extracted source size differs' }
        $expectedHash = if ($relative -ceq 'SOURCE-BUNDLE.json') { $drlRecord.manifest_sha256 } else { $files[$relative].sha256 }
        if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedHash) {
            throw ('Extracted source SHA256 differs: ' + $relative)
        }
        $drlRecord.extracted_hashes_verified++
    }
    if ($Restore) {
        $restoreRelative = 'tools/restore-core-source-inputs.ps1'
        if (!$files.ContainsKey($restoreRelative)) { throw 'Authored restore script is not selected in the verified manifest' }
        $restoreScript = Get-DrlTarget $extractedRoot $restoreRelative
        Assert-DrlAncestors $restoreScript $extraction
        if ((Get-FileHash -LiteralPath $restoreScript -Algorithm SHA256).Hash.ToLowerInvariant() -cne $files[$restoreRelative].sha256) {
            throw 'Authored restore script changed after extraction'
        }
        $drlRecord.authored_restore_script_executed = $true
        $restoreOutput = @(& $restoreScript -SourceRoot $extractedRoot)
        if (!$?) { throw 'Authored source restore failed' }
        $restoreReceipt = ConvertFrom-Json -InputObject ([string]$restoreOutput[-1]) -AsHashtable
        if ($restoreReceipt.upstream_code_executed -ne $false -or $restoreReceipt.fpc_restored -ne $true -or $restoreReceipt.vendor_packages -ne 23) {
            throw 'Source restore did not report complete extraction-only FPC and 23 locked vendors'
        }
        $drlRecord.vendor_packages = $restoreReceipt.vendor_packages
        $drlRecord.vendor_bytes = $restoreReceipt.vendor_bytes
        $drlRecord.fpc_restored = $true
        foreach ($mapping in $manifest.core.sourceMappings) {
            $target = Get-DrlTarget $extractedRoot $mapping.buildPath
            Assert-DrlAncestors $target $extraction
            $targetItem = Get-Item -LiteralPath $target -Force
            if ($targetItem.PSIsContainer -or (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $mapping.sha256) {
                throw ('Restored core source mapping SHA256 differs: ' + $mapping.buildPath)
            }
            $drlRecord.source_mappings_verified++
        }
    }
    $drlRecord.result = 'pass'
} catch {
    $drlRecord.result = 'fail'
    $drlRecord.error = $_.Exception.Message
    throw
} finally {
    if ($null -ne $drlZip) { $drlZip.Dispose() }
    if ($null -ne $drlArchiveStream) { $drlArchiveStream.Dispose() }
    $drlRecord.completed_utc = [DateTime]::UtcNow.ToString('o')
    Write-DrlEvidence $drlRecord $drlEvidencePath
    Write-Output ($drlRecord | ConvertTo-Json -Depth 12 -Compress)
}
