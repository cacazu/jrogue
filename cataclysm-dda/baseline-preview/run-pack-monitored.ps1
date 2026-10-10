$ErrorActionPreference = 'Stop'
$ownerRoot = $PSScriptRoot
$taskRoot = Split-Path -Parent $ownerRoot
$candidateRoot = Join-Path $taskRoot 'engine-build\candidates\o1-conservative-asyncify\attempts\attempt-2'
$nodePath = 'C:\Users\kit\emsdk\node\24.19.0_64bit\node.exe'
$packScript = Join-Path $ownerRoot 'package-local.mjs'
$reportPath = Join-Path $ownerRoot 'packaging-monitored-outcome.json'
$samplesPath = Join-Path $ownerRoot 'packaging-resource-samples.ndjson'
$stdoutPath = Join-Path $ownerRoot 'packaging-driver.stdout.log'
$stderrPath = Join-Path $ownerRoot 'packaging-driver.stderr.log'
if (Test-Path -LiteralPath $reportPath) { throw 'A monitored pack outcome already exists; inspect it before any further job.' }
if (Test-Path -LiteralPath (Join-Path $ownerRoot '.packaging.lock')) { throw 'A packing lock already exists.' }
function Read-Memory {
    $m = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Memory
    [pscustomobject]@{ observedUtc=(Get-Date).ToUniversalTime().ToString('o'); availableBytes=[double]$m.AvailableBytes;
        commitHeadroomBytes=([double]$m.CommitLimit-[double]$m.CommittedBytes) }
}
$gate = Read-Memory
if ($gate.availableBytes -lt 4GB -or $gate.commitHeadroomBytes -lt 6GB) {
    $gate | ConvertTo-Json -Compress | Write-Output
    throw 'Fresh pack launch gate requires 4 GiB physical and 6 GiB commit headroom.'
}
$arguments = @($packScript, '--package', '--ja-mo', (Join-Path $taskRoot 'ja-current\generated\lang\mo\ja\LC_MESSAGES\cataclysm-dda.mo'),
    '--engine-dir', (Join-Path $candidateRoot 'output'), '--engine-evidence', (Join-Path $candidateRoot 'evidence\full-engine-build.json'))
$env:CDDA_PACKING_SLOT = 'parent-coordinated'
$started = (Get-Date).ToUniversalTime()
$rootProcess = Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
$rootIdentity = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$($rootProcess.Id)"
if (-not $rootIdentity -or $rootIdentity.CommandLine -notlike "*$packScript*") { throw 'Started pack process identity was not verified.' }
$known = @{}
$known[$rootProcess.Id] = [pscustomobject]@{ pid=$rootProcess.Id; created=$rootIdentity.CreationDate.ToUniversalTime().Ticks;
    executable=$rootIdentity.ExecutablePath; commandLine=$rootIdentity.CommandLine; maximumCpuSeconds=0.0 }
$peakPrivate = 0.0
$minimumPhysical = [double]::PositiveInfinity
$minimumCommit = [double]::PositiveInfinity
$constraint = $null
$samples = 0
[pscustomobject]@{ startedUtc=$started.ToString('o'); packPid=$rootProcess.Id; launchGate=$gate; onePackJob=$true } | ConvertTo-Json -Compress -Depth 5 | Write-Output
while ($true) {
    $memory = Read-Memory
    $allProcesses = @(Get-CimInstance -ClassName Win32_Process)
    $owned = @{}
    foreach ($process in $allProcesses) {
        $record = $known[[int]$process.ProcessId]
        if ($record -and $record.created -eq $process.CreationDate.ToUniversalTime().Ticks) { $owned[[int]$process.ProcessId] = $process }
    }
    do {
        $added = $false
        foreach ($process in $allProcesses) {
            $pidValue = [int]$process.ProcessId
            if (-not $owned.ContainsKey($pidValue) -and $owned.ContainsKey([int]$process.ParentProcessId)) {
                $owned[$pidValue] = $process
                $known[$pidValue] = [pscustomobject]@{ pid=$pidValue; created=$process.CreationDate.ToUniversalTime().Ticks;
                    executable=$process.ExecutablePath; commandLine=$process.CommandLine; maximumCpuSeconds=0.0 }
                $added = $true
            }
        }
    } while ($added)
    $privateBytes = 0.0
    foreach ($process in $owned.Values) {
        $privateBytes += [double]$process.PrivatePageCount
        $cpuSeconds = ([double]$process.KernelModeTime + [double]$process.UserModeTime) / 10000000
        $record = $known[[int]$process.ProcessId]
        $record.maximumCpuSeconds = [Math]::Max($record.maximumCpuSeconds, $cpuSeconds)
    }
    $peakPrivate = [Math]::Max($peakPrivate, $privateBytes)
    $minimumPhysical = [Math]::Min($minimumPhysical, $memory.availableBytes)
    $minimumCommit = [Math]::Min($minimumCommit, $memory.commitHeadroomBytes)
    $sample = [pscustomobject]@{ observedUtc=$memory.observedUtc; ownedPids=@($owned.Keys); ownedPrivateBytes=$privateBytes;
        availableBytes=$memory.availableBytes; commitHeadroomBytes=$memory.commitHeadroomBytes }
    $sample | ConvertTo-Json -Compress -Depth 5 | Add-Content -LiteralPath $samplesPath -Encoding utf8
    $samples++
    if ($memory.availableBytes -lt 2GB -or $memory.commitHeadroomBytes -lt 2GB -or $privateBytes -gt 3GB) {
        $constraint = $sample
        # Recheck every PID's creation identity immediately before stopping it.
        # Never use a name, broad tree kill, or unverified recycled parent PID.
        foreach ($pidValue in @($owned.Keys | Sort-Object -Descending)) {
            $live = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$pidValue"
            if ($live -and $known[$pidValue].created -eq $live.CreationDate.ToUniversalTime().Ticks) {
                Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
            }
        }
        break
    }
    $rootProcess.Refresh()
    if ($rootProcess.HasExited -and $owned.Count -eq 0) { break }
    Start-Sleep -Seconds 2
}
$rootProcess.WaitForExit()
$ended = (Get-Date).ToUniversalTime()
$cpuTotal = ($known.Values | Measure-Object -Property maximumCpuSeconds -Sum).Sum
$result = [pscustomobject]@{ result=$(if ($constraint) {'resource-constrained'} elseif ($rootProcess.ExitCode -eq 0) {'pack-completed'} else {'pack-failed'});
    exitCode=$rootProcess.ExitCode; startedUtc=$started.ToString('o'); endedUtc=$ended.ToString('o'); elapsedSeconds=($ended-$started).TotalSeconds;
    launchGate=$gate; sampleIntervalSeconds=2; samples=$samples; sampledPeakOwnedPrivateBytes=$peakPrivate;
    minimumAvailableBytes=$minimumPhysical; minimumCommitHeadroomBytes=$minimumCommit; observedOwnedCpuSeconds=$cpuTotal;
    cpuMeasurement='Sum of last observed process CPU; short-lived children may fall between samples.';
    ownedIdentities=@($known.Values); constraint=$constraint; browserStarted=$false; externalHosting=$false }
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding utf8
$result | ConvertTo-Json -Compress -Depth 8 | Write-Output
if ($rootProcess.ExitCode -ne 0 -or $constraint) { exit 1 }
