$ErrorActionPreference = 'Stop'
$cddaProbeOs = Get-CimInstance Win32_OperatingSystem
$cddaProbeMemory = Get-Counter '\Memory\Committed Bytes', '\Memory\Commit Limit'
$cddaProbeCounter = @{}
foreach ($cddaProbeSample in $cddaProbeMemory.CounterSamples) {
    $cddaProbeCounter[$cddaProbeSample.Path.Split('\')[-1]] = $cddaProbeSample.CookedValue
}
[pscustomobject]@{
    at = (Get-Date).ToUniversalTime().ToString('o')
    freePhysicalBytes = ([long]$cddaProbeOs.FreePhysicalMemory * 1024)
    totalPhysicalBytes = ([long]$cddaProbeOs.TotalVisibleMemorySize * 1024)
    committedBytes = $cddaProbeCounter['committed bytes']
    commitLimitBytes = $cddaProbeCounter['commit limit']
    freeCommitBytes = ($cddaProbeCounter['commit limit'] - $cddaProbeCounter['committed bytes'])
} | ConvertTo-Json -Compress
