param([string]$GuardPath,[string]$OutputPath,[string]$CleanupPath)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'owned-identities.ps1')
$cddaQaGuard=Get-Content -LiteralPath $GuardPath -Raw | ConvertFrom-Json
$cddaQaLedger=Read-CddaQaRecordedIdentities $cddaQaGuard
if($CleanupPath -and (Test-Path -LiteralPath $CleanupPath)) {
    $cddaQaCleanup=Get-Content -LiteralPath $CleanupPath -Raw | ConvertFrom-Json
    foreach($cddaQaIdentity in (Read-CddaQaRecordedIdentities $cddaQaCleanup).Values) {$cddaQaLedger[(Get-CddaQaIdentityKey $cddaQaIdentity)]=$cddaQaIdentity}
}
$cddaQaRemaining=[System.Collections.Generic.List[object]]::new()
$cddaQaErrors=[System.Collections.Generic.List[object]]::new()
$cddaQaChecked=@($cddaQaLedger.Values | Sort-Object pid,createdAt)
foreach($cddaQaIdentity in $cddaQaChecked) {
    try {
        $cddaQaCurrent=Get-CimInstance Win32_Process -Filter ('ProcessId='+$cddaQaIdentity.pid)
        if($cddaQaCurrent -and (Get-CddaQaCreationStamp $cddaQaCurrent) -eq $cddaQaIdentity.createdAt) {$cddaQaRemaining.Add($cddaQaIdentity)}
    } catch {$cddaQaErrors.Add([ordered]@{pid=$cddaQaIdentity.pid;createdAt=$cddaQaIdentity.createdAt;error=$_.Exception.Message})}
}
$cddaQaRootRecorded=([int]$cddaQaGuard.ownedRootPid -gt 0 -and !!$cddaQaGuard.rootCreatedAt -and $cddaQaLedger.ContainsKey(([string]$cddaQaGuard.ownedRootPid+'|'+[string]$cddaQaGuard.rootCreatedAt)))
[ordered]@{checkedAt=(Get-Date).ToUniversalTime().ToString('o');ownedRootPid=$cddaQaGuard.ownedRootPid;profile=$cddaQaGuard.profile;rootIdentityRecorded=$cddaQaRootRecorded;checkedIdentities=$cddaQaChecked;remaining=$cddaQaRemaining;identityReadErrors=$cddaQaErrors;allRecordedOwnedProcessesExited=($cddaQaRootRecorded -and $cddaQaRemaining.Count -eq 0 -and $cddaQaErrors.Count -eq 0);scope='All deduplicated recorded identities across samples/root/cleanup; no undiscovered descendant claim.'} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutputPath -Encoding utf8
