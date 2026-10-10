$ErrorActionPreference = 'Stop'
$taskWorkspace = (Get-Location).Path
$archivePath = Join-Path $taskWorkspace 'toolchain\acquisition\fpc-3.3.1.x86_64-win64.built.on.i386-win32.zip'
$extractionRoot = [IO.Path]::GetFullPath((Join-Path $taskWorkspace 'toolchain\fpc-win64-snapshot'))
$extractionPrefix = $extractionRoot.TrimEnd('\') + '\'
$zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $entries = foreach ($entry in $zip.Entries) {
    $relative = $entry.FullName.Replace('/', '\')
    $resolved = [IO.Path]::GetFullPath((Join-Path $extractionRoot $relative))
    if ([IO.Path]::IsPathRooted($relative) -or $relative.Contains(':') -or
        -not ($resolved.StartsWith($extractionPrefix, [StringComparison]::OrdinalIgnoreCase) -or $resolved -eq $extractionRoot)) {
      throw "unsafe archive path: $($entry.FullName)"
    }
    $unixType = ($entry.ExternalAttributes -shr 16) -band 0xF000
    if ($unixType -eq 0xA000) { throw "archive contains a symbolic link: $($entry.FullName)" }
    [pscustomobject]@{
      path = $entry.FullName
      bytes = $entry.Length
      compressedBytes = $entry.CompressedLength
      archiveTimestamp = $entry.LastWriteTime.ToString('o')
      externalAttributes = $entry.ExternalAttributes
    }
  }
  $summary = [ordered]@{
    schemaVersion = 1
    archive = $archivePath
    safePathInspectionPassed = $true
    symbolicLinks = 0
    entries = $entries.Count
    totalUncompressedBytes = ($entries | Measure-Object -Property bytes -Sum).Sum
    compilerExecutables = @($entries | Where-Object { $_.path -match '(^|/)(ppc[^/]*|fpc)\.exe$' } | Select-Object path,bytes)
    buildToolExecutables = @($entries | Where-Object { $_.path -match '(^|/)(make|fpcmake|as|ld|wasm-ld|ar)\.exe$' } | Select-Object path,bytes)
    unitTargets = @($entries.path | ForEach-Object { if ($_ -match '(^|/)units/([^/]+)/') { $Matches[2] } } | Sort-Object -Unique)
    wasmRelatedPaths = @($entries | Where-Object { $_.path -match 'wasm|wasi' } | Select-Object path,bytes)
    licensePaths = @($entries | Where-Object { $_.path -match '(^|/)(copying[^/]*|license[^/]*|readme[^/]*)$' } | Select-Object path,bytes)
    firstEntries = @($entries | Select-Object -First 12 path,bytes)
    extractionRoot = $extractionRoot
  }
  $entryPath = Join-Path $taskWorkspace 'toolchain\acquisition\fpc-archive-entries.json'
  [IO.File]::WriteAllText($entryPath, ($entries | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText((Join-Path $taskWorkspace 'toolchain\acquisition\fpc-archive-inspection.json'), ($summary | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
} finally { $zip.Dispose() }
if (Test-Path -LiteralPath $extractionRoot) { throw "extraction target already exists; refuse overwrite: $extractionRoot" }
[IO.Compression.ZipFile]::ExtractToDirectory($archivePath, $extractionRoot)
$compilerFiles = Get-ChildItem -LiteralPath $extractionRoot -Recurse -File |
  Where-Object { $_.Name -match '^(ppc[^/]*|fpc)\.exe$' }
$compilerEvidence = foreach ($file in $compilerFiles) {
  $stream = [IO.File]::OpenRead($file.FullName)
  try {
    $reader = [IO.BinaryReader]::new($stream)
    $stream.Position = 0x3c
    $peOffset = $reader.ReadInt32()
    $stream.Position = $peOffset
    $signature = $reader.ReadUInt32()
    if ($signature -ne 0x4550) { throw "not a PE compiler: $($file.FullName)" }
    $machine = $reader.ReadUInt16()
    [pscustomobject]@{
      path = $file.FullName
      bytes = $file.Length
      sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      peMachine = ('0x{0:x4}' -f $machine)
      hostArchitecture = switch ($machine) { 0x8664 { 'x86_64'; break } 0x14c { 'i386'; break } 0xAA64 { 'aarch64'; break } default { 'unknown' } }
    }
  } finally { $stream.Dispose() }
}
[IO.File]::WriteAllText((Join-Path $taskWorkspace 'toolchain\acquisition\fpc-compiler-pe-evidence.json'), ($compilerEvidence | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
$summary | ConvertTo-Json -Depth 8
$compilerEvidence | ConvertTo-Json -Depth 5

