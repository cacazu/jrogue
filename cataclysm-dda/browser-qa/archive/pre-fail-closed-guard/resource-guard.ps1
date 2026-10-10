param([int]$OwnedRootPid,[string]$ExpectedProfile,[string]$OutputPath,[string]$StopPath,[long]$PrivateBudgetBytes=4294967296,[long]$RemainingFloorBytes=2147483648,[int]$MaximumSeconds=1800,[switch]$CloseOwned)
$ErrorActionPreference='Stop'
$cddaQaSamples=[System.Collections.Generic.List[object]]::new()
$cddaQaResult=[ordered]@{ownedRootPid=$OwnedRootPid;profile=$ExpectedProfile;status='monitoring';privateBudgetBytes=$PrivateBudgetBytes;remainingFloorBytes=$RemainingFloorBytes;maximumSeconds=$MaximumSeconds;workingSetSemantics='Sum of owned per-process working sets; shared pages may be counted repeatedly, not unique physical footprint.';compilerThreadAttribution='Not recorded; process CPU and thread counts do not identify V8 compiler thread work.';samples=$cddaQaSamples}
$cddaQaClock=[Diagnostics.Stopwatch]::StartNew()
try {
    $cddaQaRoot=Get-CimInstance Win32_Process -Filter ('ProcessId='+$OwnedRootPid)
    if (!$cddaQaRoot) {$cddaQaResult.status='root-already-exited'}
    elseif (!$cddaQaRoot.CommandLine.Contains('--user-data-dir='+$ExpectedProfile)) {throw 'Owned Chrome identity mismatch; no process will be stopped.'}
    else {
        $cddaQaResult['rootCreatedAt']=$cddaQaRoot.CreationDate.ToUniversalTime().ToString('o')
        do {
            $cddaQaCurrent=Get-CimInstance Win32_Process -Filter ('ProcessId='+$OwnedRootPid)
            if(!$cddaQaCurrent){$cddaQaResult.status='root-already-exited';break}
            if($cddaQaCurrent.CreationDate -ne $cddaQaRoot.CreationDate){throw 'Root PID was reused; no unrelated process will be stopped.'}
            $cddaQaAll=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate,Name,CommandLine)
            $cddaQaIds=[System.Collections.Generic.HashSet[int]]::new();[void]$cddaQaIds.Add($OwnedRootPid)
            do {$cddaQaAdded=$false;foreach($cddaQaProcess in $cddaQaAll){if($cddaQaIds.Contains([int]$cddaQaProcess.ParentProcessId) -and $cddaQaIds.Add([int]$cddaQaProcess.ProcessId)){$cddaQaAdded=$true}}}while($cddaQaAdded)
            if($CloseOwned){foreach($cddaQaId in $cddaQaIds){$cddaQaExpected=$cddaQaAll | Where-Object {$_.ProcessId -eq $cddaQaId};$cddaQaActual=Get-CimInstance Win32_Process -Filter ('ProcessId='+$cddaQaId);if($cddaQaExpected -and $cddaQaActual -and $cddaQaExpected.CreationDate -eq $cddaQaActual.CreationDate){Stop-Process -Id $cddaQaId -ErrorAction SilentlyContinue}};$cddaQaResult.status='closed-owned';break}
            $cddaQaPrivate=[long]0
            $cddaQaWorkingSet=[long]0
            $cddaQaCpuMilliseconds=[double]0
            $cddaQaOwned=@(foreach($cddaQaSnapshot in $cddaQaAll){if($cddaQaIds.Contains([int]$cddaQaSnapshot.ProcessId)){
                $cddaQaMetrics=Get-Process -Id $cddaQaSnapshot.ProcessId -ErrorAction SilentlyContinue
                $cddaQaPrivateBytes=$null;$cddaQaWorkingSetBytes=$null;$cddaQaCpuTotalMilliseconds=$null;$cddaQaThreadCount=$null
                if($cddaQaMetrics){try{
                    if($cddaQaMetrics.StartTime.ToUniversalTime() -eq $cddaQaSnapshot.CreationDate.ToUniversalTime()){
                        $cddaQaPrivateBytes=[long]$cddaQaMetrics.PrivateMemorySize64;$cddaQaPrivate+=$cddaQaPrivateBytes
                        $cddaQaWorkingSetBytes=[long]$cddaQaMetrics.WorkingSet64;$cddaQaWorkingSet+=$cddaQaWorkingSetBytes
                        $cddaQaCpuTotalMilliseconds=$cddaQaMetrics.TotalProcessorTime.TotalMilliseconds;$cddaQaCpuMilliseconds+=$cddaQaCpuTotalMilliseconds
                        $cddaQaThreadCount=$cddaQaMetrics.Threads.Count
                    }
                }catch{}}
                $cddaQaProcessType=if($cddaQaSnapshot.ProcessId -eq $OwnedRootPid){'browser-root'}else{'owned-unspecified'}
                $cddaQaUtilitySubtype=$null
                if($cddaQaSnapshot.CommandLine -match '(?:^|\s)--type=([^\s]+)'){$cddaQaProcessType=$Matches[1]}
                if($cddaQaSnapshot.CommandLine -match '(?:^|\s)--utility-sub-type=([A-Za-z0-9_.$-]+)'){$cddaQaUtilitySubtype=$Matches[1]}
                [ordered]@{pid=[int]$cddaQaSnapshot.ProcessId;parentPid=[int]$cddaQaSnapshot.ParentProcessId;createdAt=$cddaQaSnapshot.CreationDate.ToUniversalTime().ToString('o');name=$cddaQaSnapshot.Name;processTypeFromOwnedCommandLine=$cddaQaProcessType;utilitySubtypeFromOwnedCommandLine=$cddaQaUtilitySubtype;privateBytes=$cddaQaPrivateBytes;workingSetBytes=$cddaQaWorkingSetBytes;cpuTotalMilliseconds=$cddaQaCpuTotalMilliseconds;threadCount=$cddaQaThreadCount}
            }})
            $cddaQaMemory=& (Join-Path $PSScriptRoot 'memory.ps1') | ConvertFrom-Json
            $cddaQaSamples.Add([ordered]@{at=$cddaQaMemory.at;ownedPrivateBytes=$cddaQaPrivate;ownedWorkingSetBytes=$cddaQaWorkingSet;ownedCpuTotalMilliseconds=$cddaQaCpuMilliseconds;freePhysicalBytes=$cddaQaMemory.availableBytes;freeCommitBytes=$cddaQaMemory.freeCommitBytes;systemCommittedBytes=$cddaQaMemory.committedBytes;systemCommitLimitBytes=$cddaQaMemory.commitLimitBytes;ownedProcessIds=@($cddaQaIds);ownedProcesses=$cddaQaOwned})
            if($cddaQaPrivate -gt $PrivateBudgetBytes -or $cddaQaMemory.availableBytes -lt $RemainingFloorBytes -or $cddaQaMemory.freeCommitBytes -lt $RemainingFloorBytes -or $cddaQaClock.Elapsed.TotalSeconds -gt $MaximumSeconds){
                $cddaQaResult.status='aborted-budget-or-time';$cddaQaResult | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
                foreach($cddaQaId in $cddaQaIds){$cddaQaExpected=$cddaQaAll | Where-Object {$_.ProcessId -eq $cddaQaId};$cddaQaActual=Get-CimInstance Win32_Process -Filter ('ProcessId='+$cddaQaId);if($cddaQaExpected -and $cddaQaActual -and $cddaQaExpected.CreationDate -eq $cddaQaActual.CreationDate){Stop-Process -Id $cddaQaId -ErrorAction SilentlyContinue}};exit 2
            }
            $cddaQaResult | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
            Start-Sleep -Milliseconds 1000
        }while(!(Test-Path -LiteralPath $StopPath))
        if($cddaQaResult.status -eq 'monitoring'){$cddaQaResult.status='completed'}
    }
}catch{$cddaQaResult.status='guard-error';$cddaQaResult['error']=$_.Exception.Message}
$cddaQaResult | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
if($cddaQaResult.status -eq 'guard-error'){exit 1}
