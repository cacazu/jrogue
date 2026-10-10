param([string]$OutputPath)
# Read-only: each query is for a PID recorded by these two preserved runs.
# A reused PID receives no Get-Process/counter read; no Stop-Process exists here.
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'owned-identities.ps1')
$cddaQaInputs=[System.Collections.Generic.List[object]]::new()
$cddaQaLedger=@{}
foreach($cddaQaRun in @('2026-10-02T19-14-25-977Z','2026-10-02T19-30-37-264Z')) {
    $cddaQaPath=Join-Path $PSScriptRoot ('output\'+$cddaQaRun+'\memory-guard.json')
    $cddaQaRecord=Get-Content -LiteralPath $cddaQaPath -Raw | ConvertFrom-Json
    $cddaQaOriginal=Read-CddaQaRecordedIdentities $cddaQaRecord
    $cddaQaInputs.Add([ordered]@{path=$cddaQaPath;sha256=(Get-FileHash -LiteralPath $cddaQaPath -Algorithm SHA256).Hash.ToLowerInvariant();recordedUniqueIdentities=$cddaQaOriginal.Count})
    foreach($cddaQaIdentity in $cddaQaOriginal.Values) {$cddaQaLedger[(Get-CddaQaIdentityKey $cddaQaIdentity)]=$cddaQaIdentity}
}
$cddaQaChecks=@(foreach($cddaQaIdentity in @($cddaQaLedger.Values | Sort-Object pid,createdAt)) {
    $cddaQaCheck=[ordered]@{pid=$cddaQaIdentity.pid;recordedCreatedAt=$cddaQaIdentity.createdAt;checkedAt=(Get-Date).ToUniversalTime().ToString('o');status='unexamined';currentCreatedAt=$null;getProcessStartTime=$null;currentPrivateBytes=$null;privateAccountingComplete=$false;error=$null}
    try {
        $cddaQaActual=Get-CimInstance Win32_Process -Filter ('ProcessId='+$cddaQaIdentity.pid)
        if(!$cddaQaActual) {$cddaQaCheck.status='recorded-identity-exited'}
        else {
            $cddaQaCheck.currentCreatedAt=Get-CddaQaCreationStamp $cddaQaActual
            if($cddaQaCheck.currentCreatedAt -ne $cddaQaIdentity.createdAt) {$cddaQaCheck.status='pid-reused-no-counter-read'}
            else {
                $cddaQaMetrics=Get-Process -Id $cddaQaIdentity.pid -ErrorAction Stop
                $cddaQaCheck.getProcessStartTime=$cddaQaMetrics.StartTime.ToUniversalTime().ToString('o')
                if($cddaQaCheck.getProcessStartTime -ne $cddaQaIdentity.createdAt) {throw 'Counter handle start time differs from exact recorded creation identity.'}
                $cddaQaPrivate=$cddaQaMetrics.PrivateMemorySize64
                if($null -eq $cddaQaPrivate -or [long]$cddaQaPrivate -lt 0) {throw 'Live exact private counter unavailable.'}
                $cddaQaRecheck=Get-CimInstance Win32_Process -Filter ('ProcessId='+$cddaQaIdentity.pid)
                if($cddaQaRecheck -and (Get-CddaQaCreationStamp $cddaQaRecheck) -eq $cddaQaIdentity.createdAt) {
                    $cddaQaCheck.status='live-exact-recorded-identity';$cddaQaCheck.currentPrivateBytes=[long]$cddaQaPrivate;$cddaQaCheck.privateAccountingComplete=$true
                } else {$cddaQaCheck.status='recorded-identity-exited-or-reused-during-counter-read'}
            }
        }
    } catch {$cddaQaCheck.status='identity-or-counter-read-error';$cddaQaCheck.error=$_.Exception.Message}
    $cddaQaCheck
})
$cddaQaLive=@($cddaQaChecks | Where-Object {$_.status -eq 'live-exact-recorded-identity'})
$cddaQaResult=[ordered]@{checkedAt=(Get-Date).ToUniversalTime().ToString('o');scope='Read-only exact42 historical recorded pairs. Current counters only for still-matching identities; no historical peak reconstruction, no process stop.';inputs=$cddaQaInputs;uniqueRecordedIdentities=$cddaQaLedger.Count;checks=$cddaQaChecks;liveExactRecordedIdentities=$cddaQaLive;oldEvidenceModified=$false;processesStopped=0}
if(Test-Path -LiteralPath $OutputPath) {throw 'Audit output must be a new evidence file.'}
Write-CddaQaAtomicJson $OutputPath $cddaQaResult
[ordered]@{output=$OutputPath;checkedIdentities=$cddaQaLedger.Count;liveExact=$cddaQaLive.Count;reused=@($cddaQaChecks|Where-Object{$_.status -eq 'pid-reused-no-counter-read'}).Count;errors=@($cddaQaChecks|Where-Object{$_.error}).Count;processesStopped=0}|ConvertTo-Json -Compress
