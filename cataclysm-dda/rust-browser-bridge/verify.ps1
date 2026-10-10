$ErrorActionPreference = 'Stop'
$ownPath = $PSScriptRoot
$evidencePath = Join-Path $ownPath 'evidence'
New-Item -ItemType Directory -Path $evidencePath -Force | Out-Null
$memorySamples = [System.Collections.Generic.List[object]]::new()
$checks = [System.Collections.Generic.List[object]]::new()

function Run-Tracked([string]$name, [string]$program, [string[]]$arguments) {
    $stdoutPath = Join-Path $evidencePath ($name + '.stdout.log')
    $stderrPath = Join-Path $evidencePath ($name + '.stderr.log')
    $startTime = [DateTime]::UtcNow
    $process = Start-Process -FilePath $program -ArgumentList $arguments -WorkingDirectory $ownPath -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    $ownedIds = [System.Collections.Generic.HashSet[int]]::new()
    $ownedIds.Add($process.Id) | Out-Null
    $peakOwnedBytes = [int64]0
    $minimumFreeBytes = [int64]::MaxValue
    do {
        $children = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
        foreach ($child in $children) {
            if ($ownedIds.Contains([int]$child.ParentProcessId)) { $ownedIds.Add([int]$child.ProcessId) | Out-Null }
        }
        $ownedBytes = [int64]0
        foreach ($ownedId in $ownedIds) {
            $ownedProcess = Get-Process -Id $ownedId -ErrorAction SilentlyContinue
            if ($ownedProcess) { $ownedBytes += $ownedProcess.WorkingSet64 }
        }
        $freeBytes = [int64](Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory * 1024
        $peakOwnedBytes = [Math]::Max($peakOwnedBytes, $ownedBytes)
        $minimumFreeBytes = [Math]::Min($minimumFreeBytes, $freeBytes)
        $memorySamples.Add([ordered]@{check=$name; utc=[DateTime]::UtcNow.ToString('o'); ownedWorkingSetBytes=$ownedBytes; hostFreePhysicalBytes=$freeBytes})
        Start-Sleep -Milliseconds 500
        $process.Refresh()
    } while (-not $process.HasExited)
    $process.WaitForExit()
    $result = [ordered]@{name=$name; exitCode=$process.ExitCode; elapsedSeconds=([DateTime]::UtcNow-$startTime).TotalSeconds; peakOwnedWorkingSetBytes=$peakOwnedBytes; minimumHostFreePhysicalBytes=$minimumFreeBytes; arguments=$arguments}
    $checks.Add($result)
    Write-Output ($result | ConvertTo-Json -Compress)
    $memorySamples | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidencePath 'memory-samples.json') -Encoding utf8
    $checks | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidencePath 'build-checks.json') -Encoding utf8
    if ($process.ExitCode -ne 0) {
        Get-Content -LiteralPath $stderrPath -Tail 40
        Get-Content -LiteralPath $stdoutPath -Tail 20
        throw "$name failed"
    }
}

Push-Location $ownPath
try {
    $nodePath = (Get-Command node).Source
    $cargoPath = (Get-Command cargo).Source
    & $nodePath (Join-Path $ownPath 'prepare-catalogs.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Catalog preparation failed' }
    if (-not (Test-Path -LiteralPath (Join-Path $ownPath 'Cargo.lock'))) {
        Copy-Item -LiteralPath (Join-Path (Split-Path $ownPath -Parent) 'rust-contracts\Cargo.lock') -Destination (Join-Path $ownPath 'Cargo.lock')
        Run-Tracked 'lockfile-offline' $cargoPath @('generate-lockfile','--offline')
    }
    Run-Tracked 'format' $cargoPath @('fmt','--package','cdda-rust-browser-bridge')
    Run-Tracked 'format-check' $cargoPath @('fmt','--package','cdda-rust-browser-bridge','--','--check')
    Run-Tracked 'native-tests' $cargoPath @('test','--offline','--locked','--jobs','1')
    Run-Tracked 'clippy' $cargoPath @('clippy','--offline','--locked','--jobs','1','--all-targets','--','-D','warnings')
    Run-Tracked 'wasm-release' $cargoPath @('build','--offline','--locked','--jobs','1','--release','--target','wasm32-unknown-unknown')
    Run-Tracked 'wasm-runtime' $nodePath @('verify-runtime.mjs')
} finally {
    Pop-Location
}
