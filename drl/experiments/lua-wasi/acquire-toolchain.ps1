$ErrorActionPreference = 'Stop'
$probeRoot = $PSScriptRoot
$toolRoot = Join-Path $probeRoot 'toolchain'
New-Item -ItemType Directory -Path $toolRoot -Force | Out-Null
$assets = @(
  @{ Name = 'wasi-sysroot-34.0.tar.gz'; Url = 'https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-34/wasi-sysroot-34.0.tar.gz'; Sha256 = '9d813544eeebe38b7b8f2244ed591de46b6db812c6dd1a257ff9f0d2a905a2be' },
  @{ Name = 'libclang_rt-34.0.tar.gz'; Url = 'https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-34/libclang_rt-34.0.tar.gz'; Sha256 = 'eee3e634dcf71aa22b1333391623cf5c9965a637dc428a27b1a858c026c587f1' }
)
$records = @()
foreach ($asset in $assets) {
  $target = Join-Path $toolRoot $asset.Name
  $started = [DateTime]::UtcNow.ToString('o')
  if (-not (Test-Path -LiteralPath $target)) {
    & curl.exe --fail --location --retry 2 --connect-timeout 30 --max-time 240 --output $target $asset.Url
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $($asset.Name)" }
  }
  $digest = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($digest -ne $asset.Sha256) { throw "Checksum mismatch: $($asset.Name)" }
  $entries = & tar.exe -tzf $target
  if ($LASTEXITCODE -ne 0) { throw 'Archive listing failed' }
  foreach ($entry in $entries) {
    if ($entry -match '(^[/\\])|(^[A-Za-z]:)|((^|[/\\])\.\.([/\\]|$))') { throw "Unsafe archive path: $entry" }
  }
  & tar.exe -xzf $target -C $toolRoot
  if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed' }
  $records += [ordered]@{ name=$asset.Name; url=$asset.Url; sha256=$digest; bytes=(Get-Item -LiteralPath $target).Length; started_utc=$started; completed_utc=[DateTime]::UtcNow.ToString('o'); entries=$entries.Count }
}
[ordered]@{ publisher='WebAssembly/wasi-sdk'; tag='wasi-sdk-34'; commit='5a0bf653a1a06e1c18867567c5937006d3394a69'; records=$records } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $probeRoot 'toolchain-acquisition.json') -Encoding utf8
