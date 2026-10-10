param([string]$GuardPath,[string]$OutputPath)
$ErrorActionPreference='Stop'
$cddaQaGuard=Get-Content -LiteralPath $GuardPath -Raw | ConvertFrom-Json
$cddaQaRemaining=[System.Collections.Generic.List[object]]::new()
$cddaQaChecked=@($cddaQaGuard.samples[-1].ownedProcesses)
foreach($cddaQaIdentity in $cddaQaChecked){
    $cddaQaCurrent=Get-CimInstance Win32_Process -Filter ('ProcessId='+$cddaQaIdentity.pid)
    if($cddaQaCurrent -and $cddaQaCurrent.CreationDate.ToUniversalTime().ToString('o') -eq $cddaQaIdentity.createdAt){$cddaQaRemaining.Add($cddaQaIdentity)}
}
[ordered]@{checkedAt=(Get-Date).ToUniversalTime().ToString('o');ownedRootPid=$cddaQaGuard.ownedRootPid;profile=$cddaQaGuard.profile;checkedIdentities=$cddaQaChecked;remaining=$cddaQaRemaining;allRecordedOwnedProcessesExited=($cddaQaRemaining.Count -eq 0)} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
