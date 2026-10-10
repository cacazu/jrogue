param([int]$OwnedRootPid,[string]$ExpectedProfile,[string]$OutputPath,[string]$StopPath,[long]$PrivateBudgetBytes=4294967296,[long]$RemainingFloorBytes=2147483648,[int]$MaximumSeconds=1800,[switch]$CloseOwned,[string]$RecordedGuardPath)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'owned-identities-v3.ps1')
$cddaQaLedger=@{}
$cddaQaSamples=[System.Collections.Generic.List[object]]::new()
$cddaQaCleanup=[System.Collections.Generic.List[object]]::new()
$cddaQaResult=[ordered]@{ownedRootPid=$OwnedRootPid;profile=$ExpectedProfile;status='monitoring';privateBudgetBytes=$PrivateBudgetBytes;remainingFloorBytes=$RemainingFloorBytes;maximumSeconds=$MaximumSeconds;identityPolicy='Exact recorded CIM creation identity; descendants not older than verified snapshot parent. No PID-only/profile-only fallback.';workingSetSemantics='Sum of per-process working sets; shared pages can repeat, not unique physical footprint.';compilerThreadAttribution='Unavailable; process CPU/thread counts do not identify V8 compiler work.';samples=$cddaQaSamples;cleanupChecks=$cddaQaCleanup}
$cddaQaClock=[Diagnostics.Stopwatch]::StartNew()
$cddaQaExitCode=0
function Write-CddaQaGuard {
    $cddaQaResult['recordedOwnedIdentities']=@($cddaQaLedger.Values | Sort-Object pid,createdAt)
    Write-CddaQaAtomicJson $OutputPath $cddaQaResult
}
try {
    if($CloseOwned) {
        if(!$RecordedGuardPath) {throw 'Cleanup requires the original recorded guard; no fresh profile-only discovery.'}
        $cddaQaRecorded=Get-Content -LiteralPath $RecordedGuardPath -Raw | ConvertFrom-Json
        if($cddaQaRecorded.ownedRootPid -ne $OwnedRootPid -or $cddaQaRecorded.profile -ne $ExpectedProfile -or !$cddaQaRecorded.rootCreatedAt) {throw 'Recorded cleanup root/profile/creation identity missing or mismatched.'}
        $cddaQaLedger=Read-CddaQaRecordedIdentities $cddaQaRecorded
        $cddaQaResult['rootCreatedAt']=$cddaQaRecorded.rootCreatedAt
        Stop-CddaQaRecordedIdentities $cddaQaLedger $cddaQaCleanup
        $cddaQaResult.status='closed-recorded-owned-identities'
    } else {
        $cddaQaRoot=Get-CimInstance Win32_Process -Filter ('ProcessId='+$OwnedRootPid)
        if(!$cddaQaRoot) {$cddaQaResult.status='root-already-exited-before-identity';$cddaQaExitCode=1}
        elseif(!$cddaQaRoot.CommandLine -or !$cddaQaRoot.CommandLine.Contains('--user-data-dir='+$ExpectedProfile)) {throw 'Owned Chrome root/profile mismatch; no process will be stopped.'}
        else {
            $cddaQaRootStamp=Get-CddaQaCreationStamp $cddaQaRoot
            $cddaQaResult['rootCreatedAt']=$cddaQaRootStamp
            $cddaQaRootIdentity=[pscustomobject]@{pid=$OwnedRootPid;createdAt=$cddaQaRootStamp;parentPid=[int]$cddaQaRoot.ParentProcessId;name=$cddaQaRoot.Name}
            $cddaQaLedger[(Get-CddaQaIdentityKey $cddaQaRootIdentity)]=$cddaQaRootIdentity
            do {
                $cddaQaAll=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate,Name,CommandLine)
                $cddaQaSnapshotByPid=@{};foreach($cddaQaSnapshot in $cddaQaAll) {$cddaQaSnapshotByPid[[int]$cddaQaSnapshot.ProcessId]=$cddaQaSnapshot}
                $cddaQaRootSnapshot=$cddaQaSnapshotByPid[$OwnedRootPid]
                if($cddaQaRootSnapshot -and (Get-CddaQaCreationStamp $cddaQaRootSnapshot) -ne $cddaQaRootStamp) {throw 'Root PID reused in global enumeration; unrelated root is never seeded.'}
                $cddaQaCurrentRoot=Get-CimInstance Win32_Process -Filter ('ProcessId='+$OwnedRootPid)
                if($cddaQaCurrentRoot -and (Get-CddaQaCreationStamp $cddaQaCurrentRoot) -ne $cddaQaRootStamp) {throw 'Root PID reused after enumeration; unrelated root is never seeded.'}
                if(!$cddaQaRootSnapshot -and $cddaQaCurrentRoot) {throw 'Owned root is live but absent from global snapshot; discovery is incomplete.'}
                $cddaQaLive=@{}
                foreach($cddaQaIdentity in @($cddaQaLedger.Values)) {
                    $cddaQaSnapshot=$cddaQaSnapshotByPid[[int]$cddaQaIdentity.pid]
                    if($cddaQaSnapshot -and (Get-CddaQaCreationStamp $cddaQaSnapshot) -eq $cddaQaIdentity.createdAt) {$cddaQaLive[[int]$cddaQaIdentity.pid]=$cddaQaSnapshot}
                    elseif(!$cddaQaSnapshot) {
                        $cddaQaRecordedNow=Get-CimInstance Win32_Process -Filter ('ProcessId='+$cddaQaIdentity.pid)
                        if($cddaQaRecordedNow -and (Get-CddaQaCreationStamp $cddaQaRecordedNow) -eq $cddaQaIdentity.createdAt) {throw 'Recorded owned process is live but absent from snapshot; discovery is incomplete.'}
                    }
                }
                do {
                    $cddaQaAdded=$false
                    foreach($cddaQaSnapshot in $cddaQaAll) {
                        $cddaQaParent=$cddaQaLive[[int]$cddaQaSnapshot.ParentProcessId]
                        if(!$cddaQaLive.ContainsKey([int]$cddaQaSnapshot.ProcessId) -and $cddaQaParent -and $cddaQaSnapshot.CreationDate.ToUniversalTime() -ge $cddaQaParent.CreationDate.ToUniversalTime()) {
                            $cddaQaParentNow=Get-CimInstance Win32_Process -Filter ('ProcessId='+$cddaQaParent.ProcessId)
                            if($cddaQaParentNow -and (Get-CddaQaCreationStamp $cddaQaParentNow) -eq (Get-CddaQaCreationStamp $cddaQaParent)) {
                                $cddaQaLive[[int]$cddaQaSnapshot.ProcessId]=$cddaQaSnapshot
                                $cddaQaIdentity=[pscustomobject]@{pid=[int]$cddaQaSnapshot.ProcessId;createdAt=(Get-CddaQaCreationStamp $cddaQaSnapshot);parentPid=[int]$cddaQaSnapshot.ParentProcessId;parentCreatedAt=(Get-CddaQaCreationStamp $cddaQaParent);name=$cddaQaSnapshot.Name}
                                $cddaQaLedger[(Get-CddaQaIdentityKey $cddaQaIdentity)]=$cddaQaIdentity;$cddaQaAdded=$true
                            } else {throw 'Owned parent disappeared or was reused during child discovery; accounting is indeterminate, unverified child is not adopted.'}
                        }
                    }
                } while($cddaQaAdded)
                if(!$cddaQaLive.Count) {$cddaQaResult.status='recorded-owned-tree-exited';break}
                $cddaQaPrivate=[long]0;$cddaQaWorkingSet=[long]0;$cddaQaCpuMilliseconds=[double]0
                $cddaQaIncomplete=[System.Collections.Generic.List[object]]::new()
                $cddaQaOwned=@(foreach($cddaQaSnapshot in @($cddaQaLive.Values | Sort-Object ProcessId)) {
                    $cddaQaStamp=Get-CddaQaCreationStamp $cddaQaSnapshot
                    $cddaQaEntry=[ordered]@{pid=[int]$cddaQaSnapshot.ProcessId;parentPid=[int]$cddaQaSnapshot.ParentProcessId;createdAt=$cddaQaStamp;name=$cddaQaSnapshot.Name;accountingStatus='pending';privateBytes=$null;workingSetBytes=$null;cpuTotalMilliseconds=$null;threadCount=$null;getProcessStartTime=$null;getProcessStartUtcTicksDecimalString=$null;getProcessCimQuantumStartTime=$null;privateError=$null;optionalMetricErrors=@()}
                    $cddaQaEntry['processTypeFromOwnedCommandLine']=if($cddaQaEntry.pid -eq $OwnedRootPid){'browser-root'}else{'owned-unspecified'}
                    $cddaQaEntry['utilitySubtypeFromOwnedCommandLine']=$null
                    if($cddaQaSnapshot.CommandLine -match '(?:^|\s)--type=([^\s]+)') {$cddaQaEntry.processTypeFromOwnedCommandLine=$Matches[1]}
                    if($cddaQaSnapshot.CommandLine -match '(?:^|\s)--utility-sub-type=([A-Za-z0-9_.$-]+)') {$cddaQaEntry.utilitySubtypeFromOwnedCommandLine=$Matches[1]}
                    try {
                        $cddaQaMetrics=Get-Process -Id $cddaQaEntry.pid -ErrorAction Stop
                        $cddaQaNativeStart=$cddaQaMetrics.StartTime.ToUniversalTime()
                        $cddaQaEntry.getProcessStartTime=$cddaQaNativeStart.ToString('o')
                        $cddaQaEntry.getProcessStartUtcTicksDecimalString=[string]$cddaQaNativeStart.Ticks
                        $cddaQaEntry.getProcessCimQuantumStartTime=Get-CddaQaNativeCimQuantumStamp $cddaQaNativeStart
                        if($cddaQaEntry.getProcessCimQuantumStartTime -ne $cddaQaStamp) {throw 'Native creation witness is in a different exact CIM microsecond; no cross-quantum tolerance/substitution.'}
                        $cddaQaValue=$cddaQaMetrics.PrivateMemorySize64
                        if($null -eq $cddaQaValue -or [long]$cddaQaValue -lt 0) {throw 'Required private counter is missing or invalid.'}
                        $cddaQaEntry.privateBytes=[long]$cddaQaValue
                    } catch {$cddaQaEntry.privateError=$_.Exception.Message}
                    $cddaQaActual=Get-CimInstance Win32_Process -Filter ('ProcessId='+$cddaQaEntry.pid)
                    if(!$cddaQaActual -or (Get-CddaQaCreationStamp $cddaQaActual) -ne $cddaQaStamp) {
                        $cddaQaEntry.accountingStatus='exited-or-pid-reused-during-sample';$cddaQaEntry.privateBytes=$null
                        if($cddaQaActual) {$cddaQaEntry['actualCreatedAt']=Get-CddaQaCreationStamp $cddaQaActual}
                    } elseif($null -eq $cddaQaEntry.privateBytes) {
                        $cddaQaEntry.accountingStatus='live-required-private-unreadable';$cddaQaIncomplete.Add($cddaQaEntry)
                    } else {
                        $cddaQaEntry.accountingStatus='complete';$cddaQaPrivate+=$cddaQaEntry.privateBytes
                        try {$cddaQaOptional=$cddaQaMetrics.WorkingSet64;if($null -eq $cddaQaOptional){throw 'Optional working set unavailable'};$cddaQaEntry.workingSetBytes=[long]$cddaQaOptional;$cddaQaWorkingSet+=$cddaQaEntry.workingSetBytes} catch {$cddaQaEntry.optionalMetricErrors+=('working-set: '+$_.Exception.Message)}
                        try {$cddaQaOptional=$cddaQaMetrics.TotalProcessorTime;if($null -eq $cddaQaOptional){throw 'Optional CPU unavailable'};$cddaQaEntry.cpuTotalMilliseconds=$cddaQaOptional.TotalMilliseconds;$cddaQaCpuMilliseconds+=$cddaQaEntry.cpuTotalMilliseconds} catch {$cddaQaEntry.optionalMetricErrors+=('cpu: '+$_.Exception.Message)}
                        try {$cddaQaOptional=$cddaQaMetrics.Threads;if($null -eq $cddaQaOptional){throw 'Optional threads unavailable'};$cddaQaEntry.threadCount=$cddaQaOptional.Count} catch {$cddaQaEntry.optionalMetricErrors+=('threads: '+$_.Exception.Message)}
                    }
                    $cddaQaEntry
                })
                $cddaQaMemory=& (Join-Path $PSScriptRoot 'memory.ps1') | ConvertFrom-Json
                $cddaQaSamples.Add([ordered]@{at=$cddaQaMemory.at;privateAccountingComplete=($cddaQaIncomplete.Count -eq 0);ownedPrivateBytes=$cddaQaPrivate;ownedWorkingSetBytes=$cddaQaWorkingSet;ownedCpuTotalMilliseconds=$cddaQaCpuMilliseconds;freePhysicalBytes=$cddaQaMemory.availableBytes;freeCommitBytes=$cddaQaMemory.freeCommitBytes;systemCommittedBytes=$cddaQaMemory.committedBytes;systemCommitLimitBytes=$cddaQaMemory.commitLimitBytes;ownedProcessIds=@($cddaQaLive.Keys);ownedProcesses=$cddaQaOwned})
                $cddaQaReasons=@()
                if($cddaQaIncomplete.Count) {$cddaQaReasons+='incomplete-private-accounting';$cddaQaResult['incompletePrivateIdentities']=@($cddaQaIncomplete)}
                if($cddaQaPrivate -gt $PrivateBudgetBytes) {$cddaQaReasons+='owned-private-cap'}
                if($cddaQaMemory.availableBytes -lt $RemainingFloorBytes) {$cddaQaReasons+='physical-floor'}
                if($cddaQaMemory.freeCommitBytes -lt $RemainingFloorBytes) {$cddaQaReasons+='commit-floor'}
                if($cddaQaClock.Elapsed.TotalSeconds -gt $MaximumSeconds) {$cddaQaReasons+='maximum-seconds'}
                if($cddaQaReasons.Count) {
                    $cddaQaResult.status=if($cddaQaIncomplete.Count){'incomplete-private-accounting'}else{'aborted-budget-or-time'}
                    $cddaQaResult['stopReasons']=$cddaQaReasons;Write-CddaQaGuard
                    Stop-CddaQaRecordedIdentities $cddaQaLedger $cddaQaCleanup;$cddaQaExitCode=2;break
                }
                Write-CddaQaGuard
                if(Test-Path -LiteralPath $StopPath) {break}
                Start-Sleep -Milliseconds 1000
            } while($true)
            if($cddaQaResult.status -eq 'monitoring') {$cddaQaResult.status='completed'}
        }
    }
} catch {
    $cddaQaResult.status='guard-error';$cddaQaResult['error']=$_.Exception.Message;$cddaQaExitCode=1
    Stop-CddaQaRecordedIdentities $cddaQaLedger $cddaQaCleanup
}
Write-CddaQaGuard
exit $cddaQaExitCode
