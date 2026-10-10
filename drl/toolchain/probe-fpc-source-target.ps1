$ErrorActionPreference = 'Stop'
$taskWorkspace = (Get-Location).Path
$sourceCommit = '843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d'
$sourceRoot = Join-Path $taskWorkspace 'toolchain\acquisition\fpc-pinned-source'
$licenseRecords = foreach ($relative in @('LICENSE', 'README.md', 'rtl/inc/systemh.inc')) {
  $url = "https://gitlab.com/freepascal.org/fpc/source/-/raw/$sourceCommit/$relative"
  $destination = Join-Path $sourceRoot $relative.Replace('/', '__')
  $response = Invoke-WebRequest -Uri $url -OutFile $destination -PassThru -MaximumRedirection 5
  [pscustomobject]@{
    sourceCommit=$sourceCommit;relativeSourcePath=$relative;url=$url
    acquiredUtc=[DateTime]::UtcNow.ToString('o');httpStatus=[int]$response.StatusCode
    bytes=(Get-Item -LiteralPath $destination).Length
    sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    file=$destination
  }
}
[IO.File]::WriteAllText((Join-Path $sourceRoot 'license-evidence-manifest.json'), ($licenseRecords | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
$compilerPath = Join-Path $taskWorkspace 'toolchain\fpc-win64-snapshot\bin\i386-win32\ppcrossx64.exe'
$queries = foreach ($query in @('-iSP','-iSO','-iTP','-iTO')) {
  $output = @(& $compilerPath -n $query 2>&1 | ForEach-Object { $_.ToString() })
  [pscustomobject]@{argument=$query;exitCode=$LASTEXITCODE;output=$output;queriedUtc=[DateTime]::UtcNow.ToString('o')}
}
[IO.File]::WriteAllText((Join-Path $taskWorkspace 'toolchain\probe\compiler-source-target-info.json'), ($queries | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
$licenseRecords | Select-Object relativeSourcePath,httpStatus,bytes,sha256 | ConvertTo-Json
$queries | ConvertTo-Json
Select-String -LiteralPath (Join-Path $sourceRoot 'rtl__inc__systemh.inc') -Pattern 'Copyright|COPYING|Library General|special exception|license' -Context 1,1

