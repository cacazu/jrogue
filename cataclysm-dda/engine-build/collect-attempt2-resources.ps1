$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$runDirectory = Join-Path $PSScriptRoot 'candidates\o1-conservative-asyncify\attempts\attempt-2'
$samples = @(Get-Content -LiteralPath (Join-Path $runDirectory 'resource-samples.ndjson') | ForEach-Object { $_ | ConvertFrom-Json })
$observed = @{}
foreach ($sample in $samples) {
    foreach ($ownedProcess in $sample.processes) {
        $key = "$($ownedProcess.pid):$($ownedProcess.startUtc)"
        $observed[$key] = $ownedProcess
    }
}
$closure = @()
foreach ($entry in $observed.Values) {
    $currentProcess = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
    $sameIdentityAlive = $false
    if ($null -ne $currentProcess) {
        $sameIdentityAlive = $currentProcess.StartTime.ToUniversalTime().ToString('o') -eq ([DateTimeOffset]::Parse($entry.startUtc).UtcDateTime.ToString('o'))
    }
    $closure += [PSCustomObject]@{ pid = $entry.pid; name = $entry.name; startUtc = $entry.startUtc; sameIdentityAlive = $sameIdentityAlive }
}
$os = Get-CimInstance Win32_OperatingSystem
$memory = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$result = [PSCustomObject]@{
    timestampUtc = [DateTimeOffset]::UtcNow.ToString('o')
    allObservedCandidateIdentitiesEnded = @($closure | Where-Object sameIdentityAlive).Count -eq 0
    closure = @($closure | Sort-Object pid)
    physicalFreeBytes = [uint64]$os.FreePhysicalMemory * 1024
    exactCommitHeadroomBytes = [uint64]$memory.CommitLimit - [uint64]$memory.CommittedBytes
    exactCommitSource = 'Win32_PerfFormattedData_PerfOS_Memory'
    originalProcessState = 'parent-authorized-ended-after-identity-verification'
    processChangesPerformed = $false
}
$json = $result | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText((Join-Path $runDirectory 'evidence\terminal-process-resource.json'), $json + "`n", [Text.UTF8Encoding]::new($false))
$json
