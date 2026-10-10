param([int]$OwnedRootPid, [string]$ExpectedProfile, [string]$OutputPath, [string]$StopPath)
$ErrorActionPreference = 'Stop'
$cddaGuardSamples = [System.Collections.Generic.List[object]]::new()
$cddaGuardResult = [ordered]@{ ownedRootPid=$OwnedRootPid; expectedProfile=$ExpectedProfile; privateBudgetBytes=1073741824; minimumRemainingBytes=3221225472; status='monitoring'; samples=$cddaGuardSamples }
try {
    $cddaGuardRoot = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $OwnedRootPid)
    if (!$cddaGuardRoot -or !$cddaGuardRoot.CommandLine.Contains('--user-data-dir=' + $ExpectedProfile)) { throw 'Owned probe Chrome profile identity did not match; no process will be stopped.' }
    do {
        $cddaGuardAll = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
        $cddaGuardIds = [System.Collections.Generic.HashSet[int]]::new()
        [void]$cddaGuardIds.Add($OwnedRootPid)
        do {
            $cddaGuardAdded = $false
            foreach ($cddaGuardProcess in $cddaGuardAll) {
                if ($cddaGuardIds.Contains([int]$cddaGuardProcess.ParentProcessId)) {
                    if ($cddaGuardIds.Add([int]$cddaGuardProcess.ProcessId)) { $cddaGuardAdded=$true }
                }
            }
        } while ($cddaGuardAdded)
        $cddaGuardPrivate = [long]0
        foreach ($cddaGuardId in $cddaGuardIds) {
            $cddaGuardProcess = Get-Process -Id $cddaGuardId -ErrorAction SilentlyContinue
            if ($cddaGuardProcess) { $cddaGuardPrivate += $cddaGuardProcess.PrivateMemorySize64 }
        }
        $cddaGuardMemory = & (Join-Path $PSScriptRoot 'measure-memory.ps1') | ConvertFrom-Json
        $cddaGuardSample = [ordered]@{at=$cddaGuardMemory.at;freePhysicalBytes=$cddaGuardMemory.freePhysicalBytes;freeCommitBytes=$cddaGuardMemory.freeCommitBytes;ownedPrivateBytes=$cddaGuardPrivate;ownedProcessIds=@($cddaGuardIds)}
        $cddaGuardSamples.Add($cddaGuardSample)
        if ($cddaGuardPrivate -gt 1073741824 -or $cddaGuardMemory.freePhysicalBytes -lt 3221225472 -or $cddaGuardMemory.freeCommitBytes -lt 3221225472) {
            $cddaGuardResult.status='aborted-budget'
            $cddaGuardResult.reason='Owned private-memory budget or remaining-memory floor failed.'
            $cddaGuardResult | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
            foreach ($cddaGuardId in $cddaGuardIds) { Stop-Process -Id $cddaGuardId -ErrorAction SilentlyContinue }
            exit 2
        }
        $cddaGuardResult | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
        Start-Sleep -Milliseconds 500
    } while (!(Test-Path -LiteralPath $StopPath))
    $cddaGuardResult.status='completed'
    $cddaGuardPeak = [long]0
    $cddaGuardMinPhysical = [long]::MaxValue
    $cddaGuardMinCommit = [long]::MaxValue
    foreach ($cddaGuardSample in $cddaGuardSamples) {
        $cddaGuardPeak = [Math]::Max($cddaGuardPeak, [long]$cddaGuardSample['ownedPrivateBytes'])
        $cddaGuardMinPhysical = [Math]::Min($cddaGuardMinPhysical, [long]$cddaGuardSample['freePhysicalBytes'])
        $cddaGuardMinCommit = [Math]::Min($cddaGuardMinCommit, [long]$cddaGuardSample['freeCommitBytes'])
    }
    $cddaGuardResult['peakOwnedPrivateBytes']=$cddaGuardPeak
    $cddaGuardResult['minimumFreePhysicalBytes']=$cddaGuardMinPhysical
    $cddaGuardResult['minimumFreeCommitBytes']=$cddaGuardMinCommit
} catch { $cddaGuardResult.status='guard-error'; $cddaGuardResult.error=$_.Exception.Message }
$cddaGuardResult | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
if ($cddaGuardResult.status -eq 'guard-error') { exit 1 }
