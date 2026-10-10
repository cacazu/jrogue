$ErrorActionPreference = 'Stop'
$taskWorkspace = (Get-Location).Path
$sourceCommit = '843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d'
$sourceRoot = Join-Path $taskWorkspace 'toolchain\acquisition\fpc-pinned-source'
New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
$paths = @(
  'Makefile', 'Makefile.fpc', 'compiler/Makefile.fpc',
  'compiler/systems/i_wasi.pas', 'compiler/systems/t_wasi.pas',
  'COPYING.v2', 'COPYING.v3', 'COPYING.FPC'
)
$records = foreach ($relative in $paths) {
  $url = "https://gitlab.com/freepascal.org/fpc/source/-/raw/$sourceCommit/$relative"
  $localName = $relative.Replace('/', '__')
  $destination = Join-Path $sourceRoot $localName
  try {
    $response = Invoke-WebRequest -Uri $url -OutFile $destination -PassThru -MaximumRedirection 5
    $headers = [ordered]@{}
    foreach ($header in $response.Headers.GetEnumerator()) { $headers[$header.Key] = @($header.Value) }
    [pscustomobject]@{
      sourceCommit=$sourceCommit; relativeSourcePath=$relative; requestedUrl=$url
      effectiveUrl=$response.BaseResponse.RequestMessage.RequestUri.AbsoluteUri
      httpStatus=[int]$response.StatusCode; headers=$headers
      acquiredUtc=[DateTime]::UtcNow.ToString('o'); file=$destination
      bytes=(Get-Item -LiteralPath $destination).Length
      sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  } catch {
    [pscustomobject]@{sourceCommit=$sourceCommit;relativeSourcePath=$relative;requestedUrl=$url;error=$_.Exception.Message}
  }
}
[IO.File]::WriteAllText((Join-Path $sourceRoot 'manifest.json'), ($records | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
$records | Select-Object relativeSourcePath,httpStatus,bytes,sha256,error | ConvertTo-Json -Depth 4

