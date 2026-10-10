param(
    [Parameter(Mandatory=$true)][int]$BuildProcessId,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [ValidateRange(2,5)][int]$IntervalSeconds = 3
)

$ErrorActionPreference = 'Stop'
$outputAbsolute = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = [System.IO.Path]::GetDirectoryName($outputAbsolute)
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$writer = New-Object System.IO.StreamWriter($outputAbsolute, $false, (New-Object System.Text.UTF8Encoding($false)))
$writer.AutoFlush = $true
$known = @{}
$peaks = @{}
$samples = 0
$peakRss = [uint64]0
$peakPrivate = [uint64]0
$peakLive = 0
$minimumPhysical = [uint64]::MaxValue
$minimumCommit = [uint64]::MaxValue
$emptyAfterRoot = 0
$started = [DateTime]::UtcNow
$rootIdentity = $null
$completed = $false
$stopReason = 'monitor-interrupted'
$failureMessage = $null
$firstSampleUtc = $null
$rootCreatedUtc = $null
$rootWallSeconds = $null
$observedCpuSeconds = 0.0

function Identity($process) {
    return ('{0}|{1}' -f $process.ProcessId, $process.CreationDate.ToUniversalTime().ToString('o'))
}

try {
    while ($true) {
        $now = [DateTime]::UtcNow
        $processes = @(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,CreationDate,WorkingSetSize,PrivatePageCount,KernelModeTime,UserModeTime,Name)
        $byId = @{}
        foreach ($process in $processes) { $byId[[int]$process.ProcessId] = $process }
        if ($known.Count -eq 0) {
            if (-not $byId.ContainsKey($BuildProcessId)) { throw 'Build root exited before the first monitor sample.' }
            $known[$BuildProcessId] = Identity $byId[$BuildProcessId]
            $rootIdentity = $known[$BuildProcessId]
            $rootCreatedUtc = $byId[$BuildProcessId].CreationDate.ToUniversalTime()
        }

        # Repeatedly expand descendants from matching process identities. Creation
        # timestamps prevent a reused PID from being attributed to this build.
        $changed = $true
        while ($changed) {
            $changed = $false
            foreach ($process in $processes) {
                $childId = [int]$process.ProcessId
                $parentId = [int]$process.ParentProcessId
                if ($known.ContainsKey($childId) -and (Identity $process) -eq $known[$childId]) { continue }
                if (-not $known.ContainsKey($parentId)) { continue }
                if (-not $byId.ContainsKey($parentId) -or (Identity $byId[$parentId]) -ne $known[$parentId]) { continue }
                if ($process.CreationDate -lt $byId[$parentId].CreationDate) { continue }
                $known[$childId] = Identity $process
                $changed = $true
            }
        }

        $live = @()
        $rss = [uint64]0
        $private = [uint64]0
        foreach ($process in $processes) {
            $processIdValue = [int]$process.ProcessId
            if (-not $known.ContainsKey($processIdValue) -or (Identity $process) -ne $known[$processIdValue]) { continue }
            $row = [ordered]@{
                pid = $processIdValue
                parentPid = [int]$process.ParentProcessId
                name = $process.Name
                createdUtc = $process.CreationDate.ToUniversalTime().ToString('o')
                rssBytes = [uint64]$process.WorkingSetSize
                privateBytes = [uint64]$process.PrivatePageCount
                userCpuSeconds = [double]$process.UserModeTime / 10000000.0
                kernelCpuSeconds = [double]$process.KernelModeTime / 10000000.0
                cpuSeconds = ([double]$process.UserModeTime + [double]$process.KernelModeTime) / 10000000.0
            }
            $live += $row
            $rss += $row.rssBytes
            $private += $row.privateBytes
            $identity = $known[$processIdValue]
            if (-not $peaks.ContainsKey($identity)) {
                $peaks[$identity] = [ordered]@{pid=$processIdValue; name=$process.Name; createdUtc=$row.createdUtc; peakRssBytes=[uint64]0; peakPrivateBytes=[uint64]0; observedCpuSeconds=0.0}
            }
            if ($row.rssBytes -gt $peaks[$identity].peakRssBytes) { $peaks[$identity].peakRssBytes = $row.rssBytes }
            if ($row.privateBytes -gt $peaks[$identity].peakPrivateBytes) { $peaks[$identity].peakPrivateBytes = $row.privateBytes }
            if ($row.cpuSeconds -gt $peaks[$identity].observedCpuSeconds) { $peaks[$identity].observedCpuSeconds = $row.cpuSeconds }
        }

        $observedCpuSeconds = 0.0
        foreach ($entry in $peaks.Values) { $observedCpuSeconds += $entry.observedCpuSeconds }
        $rootWallSeconds = [Math]::Max(0.0, ($now - $rootCreatedUtc).TotalSeconds)

        $os = Get-CimInstance Win32_OperatingSystem -Property FreePhysicalMemory,TotalVisibleMemorySize
        $memory = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory -Property CommittedBytes,CommitLimit
        $freePhysical = [uint64]$os.FreePhysicalMemory * 1024
        $commitHeadroom = [uint64]0
        if ([uint64]$memory.CommitLimit -ge [uint64]$memory.CommittedBytes) {
            $commitHeadroom = [uint64]$memory.CommitLimit - [uint64]$memory.CommittedBytes
        }
        if ($rss -gt $peakRss) { $peakRss = $rss }
        if ($private -gt $peakPrivate) { $peakPrivate = $private }
        if ($live.Count -gt $peakLive) { $peakLive = $live.Count }
        if ($freePhysical -lt $minimumPhysical) { $minimumPhysical = $freePhysical }
        if ($commitHeadroom -lt $minimumCommit) { $minimumCommit = $commitHeadroom }
        $rootAlive = $byId.ContainsKey($BuildProcessId) -and (Identity $byId[$BuildProcessId]) -eq $rootIdentity
        $sample = [ordered]@{
            schemaVersion=1; sampledUtc=$now.ToString('o'); buildRootPid=$BuildProcessId
            rootAlive=$rootAlive; intervalSeconds=$IntervalSeconds
            rootCreatedUtc=$rootCreatedUtc.ToString('o'); rootWallSeconds=$rootWallSeconds
            observedCpuSecondsLowerBound=$observedCpuSeconds
            groupRssBytes=$rss; groupPrivateBytes=$private; groupLiveProcesses=$live.Count
            freePhysicalBytes=$freePhysical; totalPhysicalBytes=([uint64]$os.TotalVisibleMemorySize * 1024)
            committedBytes=[uint64]$memory.CommittedBytes; commitLimitBytes=[uint64]$memory.CommitLimit
            commitHeadroomBytes=$commitHeadroom; processes=$live
        }
        $writer.WriteLine(($sample | ConvertTo-Json -Compress -Depth 5))
        if ($samples -eq 0) { $firstSampleUtc = $now.ToString('o') }
        $samples += 1
        if (-not $rootAlive -and $live.Count -eq 0) { $emptyAfterRoot += 1 } else { $emptyAfterRoot = 0 }
        if ($emptyAfterRoot -ge 2) {
            $completed = $true
            $stopReason = 'root-and-observed-descendants-exited'
            break
        }
        Start-Sleep -Seconds $IntervalSeconds
    }
} catch {
    $failureMessage = $_.Exception.Message
    $stopReason = 'monitor-error'
    throw
} finally {
    $writer.Dispose()
    $minimumPhysicalOutput = $null
    $minimumCommitOutput = $null
    if ($samples -gt 0) {
        $minimumPhysicalOutput = $minimumPhysical
        $minimumCommitOutput = $minimumCommit
    }
    $summary = [ordered]@{
        schemaVersion=1; buildRootPid=$BuildProcessId; startedUtc=$started.ToString('o')
        finishedUtc=[DateTime]::UtcNow.ToString('o'); samples=$samples; intervalSeconds=$IntervalSeconds
        firstSampleUtc=$firstSampleUtc; completed=$completed; stopReason=$stopReason; error=$failureMessage
        rootCreatedUtc=$rootCreatedUtc; rootWallSeconds=$rootWallSeconds; observedCpuSecondsLowerBound=$observedCpuSeconds
        peakGroupRssBytes=$peakRss; peakGroupPrivateBytes=$peakPrivate; peakLiveProcesses=$peakLive
        minimumFreePhysicalBytes=$minimumPhysicalOutput; minimumCommitHeadroomBytes=$minimumCommitOutput
        processPeaks=@($peaks.Values | Sort-Object pid)
        measurement='Win32_Process WorkingSetSize and PrivatePageCount; summed per-process RSS can count shared pages repeatedly. Recursive creation-time identities include child/parent chronology; sample peaks are lower bounds between samples.'
        limitations='A monitor attached after launch omits earlier startup; an intermediate process born and exited between snapshots can hide its surviving descendants. Recorded peaks describe the observed sampled process tree.'
    }
    $summaryPath = [System.IO.Path]::ChangeExtension($outputAbsolute, '.summary.json')
    [System.IO.File]::WriteAllText($summaryPath, ($summary | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
    $summary | ConvertTo-Json -Depth 5
}
