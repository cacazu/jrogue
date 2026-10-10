Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$dcssRoot = Split-Path -Parent $PSScriptRoot
$upstreamPath = Join-Path $dcssRoot 'upstream'
$expectedCommit = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796'
if (-not (Test-Path -LiteralPath $upstreamPath)) {
    $drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($dcssRoot).Substring(0,1))
    if ($drive.Free -lt 2GB) { throw 'At least 2 GB free space is required for acquisition and a separate build copy.' }
    git clone --depth 1 --branch 0.34.1 https://github.com/crawl/crawl.git $upstreamPath
    if ($LASTEXITCODE -ne 0) { throw 'Official source acquisition failed' }
}
$actualCommit = git -C $upstreamPath rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $actualCommit -ne $expectedCommit) { throw 'Existing upstream source does not match the pinned official commit; it was preserved.' }
git -C $upstreamPath submodule update --init --recursive --depth 1
if ($LASTEXITCODE -ne 0) { throw 'Exact official dependency acquisition failed' }
Write-Output "DCSS 0.34.1 complete source acquired: $expectedCommit"
