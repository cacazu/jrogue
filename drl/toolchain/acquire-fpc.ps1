$ErrorActionPreference = 'Stop'
$taskWorkspace = (Get-Location).Path
$acquisitionRoot = Join-Path $taskWorkspace 'toolchain\acquisition'
New-Item -ItemType Directory -Path $acquisitionRoot -Force | Out-Null
$archiveUrl = 'https://downloads.freepascal.org/fpc/snapshot/trunk/x86_64-win64/fpc-3.3.1.x86_64-win64.built.on.i386-win32.zip'
$readmeUrl = 'https://downloads.freepascal.org/fpc/snapshot/trunk/x86_64-win64/readme-win64.txt'
$archivePath = Join-Path $acquisitionRoot 'fpc-3.3.1.x86_64-win64.built.on.i386-win32.zip'
$partialPath = "$archivePath.part"
if ((Test-Path -LiteralPath $archivePath) -or (Test-Path -LiteralPath $partialPath) -or
    (Test-Path -LiteralPath (Join-Path $acquisitionRoot 'fpc-portable-manifest.json'))) {
  throw 'acquisition already exists; preserve its pinned bytes and provenance and use a distinct directory for a new mutable snapshot acquisition'
}
$readmeBefore = Invoke-WebRequest -Uri $readmeUrl -MaximumRedirection 5
[IO.File]::WriteAllText((Join-Path $acquisitionRoot 'readme-win64-before.txt'), $readmeBefore.Content, [Text.UTF8Encoding]::new($false))
$startedUtc = [DateTime]::UtcNow.ToString('o')
$response = Invoke-WebRequest -Uri $archiveUrl -OutFile $partialPath -PassThru -MaximumRedirection 5
$completedUtc = [DateTime]::UtcNow.ToString('o')
$bytes = (Get-Item -LiteralPath $partialPath).Length
$sha256 = (Get-FileHash -LiteralPath $partialPath -Algorithm SHA256).Hash.ToLowerInvariant()
$readmeAfter = Invoke-WebRequest -Uri $readmeUrl -MaximumRedirection 5
[IO.File]::WriteAllText((Join-Path $acquisitionRoot 'readme-win64-after.txt'), $readmeAfter.Content, [Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $partialPath -Destination $archivePath
$headers = [ordered]@{}
foreach ($header in $response.Headers.GetEnumerator()) { $headers[$header.Key] = @($header.Value) }
$readmeCommit = [regex]::Match($readmeBefore.Content, 'commit ([0-9a-f]{40})').Groups[1].Value
$manifest = [ordered]@{
  schemaVersion = 1
  purpose = 'Bounded DRL native-core compiler capability probe; no installer executed'
  officialDevelopmentPage = 'https://www.freepascal.org/develop.html'
  officialArchiveIndex = 'https://downloads.freepascal.org/fpc/snapshot/trunk/x86_64-win64/'
  requestedUrl = $archiveUrl
  effectiveUrl = $response.BaseResponse.RequestMessage.RequestUri.AbsoluteUri
  httpStatus = [int]$response.StatusCode
  httpHeaders = $headers
  acquisitionStartedUtc = $startedUtc
  acquisitionCompletedUtc = $completedUtc
  file = $archivePath
  bytes = $bytes
  sha256 = $sha256
  mutableSnapshotUrl = $true
  advertisedGenerationDate = '2026-09-25'
  advertisedSourceCommit = $readmeCommit
  readmeUrl = $readmeUrl
  readmeUnchangedDuringAcquisition = ($readmeBefore.Content -ceq $readmeAfter.Content)
  externalPublisherChecksumFound = $false
  integrityMeaning = 'Local SHA-256 pins the acquired bytes; no publisher signature/checksum has been verified'
  platform = [ordered]@{
    os = [Environment]::OSVersion.ToString()
    processArchitecture = [Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()
    osArchitecture = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
  }
}
[IO.File]::WriteAllText((Join-Path $acquisitionRoot 'fpc-portable-manifest.json'), ($manifest | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
[pscustomobject]@{Archive=$archivePath;Bytes=$bytes;SHA256=$sha256;ReadmeUnchanged=$manifest.readmeUnchangedDuringAcquisition;SourceCommit=$readmeCommit} | ConvertTo-Json
