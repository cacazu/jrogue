param([int]$OwnedRootPid,[string]$ExpectedMarker,[string]$OutputPath,[string]$StopPath,[int]$MaximumSeconds=90,[switch]$AbortOwned)
$ErrorActionPreference='Stop'
$cddaBridgeSamples=[System.Collections.Generic.List[object]]::new()
$cddaBridgeResult=[ordered]@{ownedRootPid=$OwnedRootPid;marker=$ExpectedMarker;status='monitoring';budgetBytes=1073741824;remainingFloorBytes=3221225472;maximumSeconds=$MaximumSeconds;samples=$cddaBridgeSamples}
$cddaBridgeClock=[Diagnostics.Stopwatch]::StartNew()
try {
    $cddaBridgeRoot=Get-CimInstance Win32_Process -Filter ('ProcessId='+$OwnedRootPid)
    if (!$cddaBridgeRoot) { $cddaBridgeResult.status='completed-child-exited' }
    elseif (!$cddaBridgeRoot.CommandLine.Contains($ExpectedMarker)) { throw 'Owned command identity mismatch; no process will be stopped.' }
    else {
        do {
            $cddaBridgeAll=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId)
            $cddaBridgeIds=[System.Collections.Generic.HashSet[int]]::new();[void]$cddaBridgeIds.Add($OwnedRootPid)
            do { $cddaBridgeAdded=$false;foreach($cddaBridgeProcess in $cddaBridgeAll) { if($cddaBridgeIds.Contains([int]$cddaBridgeProcess.ParentProcessId) -and $cddaBridgeIds.Add([int]$cddaBridgeProcess.ProcessId)) {$cddaBridgeAdded=$true} } } while($cddaBridgeAdded)
            if($AbortOwned) {foreach($cddaBridgeId in $cddaBridgeIds){Stop-Process -Id $cddaBridgeId -ErrorAction SilentlyContinue};$cddaBridgeResult.status='closed-owned';break}
            $cddaBridgePrivate=[long]0
            foreach($cddaBridgeId in $cddaBridgeIds) { $cddaBridgeProcess=Get-Process -Id $cddaBridgeId -ErrorAction SilentlyContinue;if($cddaBridgeProcess){$cddaBridgePrivate+=$cddaBridgeProcess.PrivateMemorySize64} }
            $cddaBridgeMemory=& (Join-Path $PSScriptRoot '..\jspi-probe\measure-memory.ps1') | ConvertFrom-Json
            $cddaBridgeSamples.Add([ordered]@{at=$cddaBridgeMemory.at;elapsedSeconds=$cddaBridgeClock.Elapsed.TotalSeconds;ownedPrivateBytes=$cddaBridgePrivate;freePhysicalBytes=$cddaBridgeMemory.freePhysicalBytes;freeCommitBytes=$cddaBridgeMemory.freeCommitBytes;ownedProcessIds=@($cddaBridgeIds)})
            if($cddaBridgePrivate -gt 1073741824 -or $cddaBridgeMemory.freePhysicalBytes -lt 3221225472 -or $cddaBridgeMemory.freeCommitBytes -lt 3221225472 -or $cddaBridgeClock.Elapsed.TotalSeconds -gt $MaximumSeconds) {
                $cddaBridgeResult.status='aborted-budget-or-time';$cddaBridgeResult | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
                foreach($cddaBridgeId in $cddaBridgeIds) {Stop-Process -Id $cddaBridgeId -ErrorAction SilentlyContinue};exit 2
            }
            $cddaBridgeResult | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
            Start-Sleep -Milliseconds 500
        } while(!(Test-Path -LiteralPath $StopPath))
        $cddaBridgeResult.status='completed'
    }
} catch {$cddaBridgeResult.status='guard-error';$cddaBridgeResult['error']=$_.Exception.Message}
$cddaBridgeResult | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
if($cddaBridgeResult.status -eq 'guard-error'){exit 1}
