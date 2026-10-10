function Get-CddaQaCreationStamp($Process) {return $Process.CreationDate.ToUniversalTime().ToString('o')}
function Get-CddaQaIdentityKey($Identity) {return ([string]$Identity.pid+'|'+[string]$Identity.createdAt)}
function Read-CddaQaRecordedIdentities($Record) {
    $ledger=@{}
    $all=@($Record.recordedOwnedIdentities)+@($Record.cleanupChecks)+@($Record.checkedIdentities)
    foreach($sample in @($Record.samples)) {$all+=@($sample.ownedProcesses)}
    if($Record.rootCreatedAt) {$all+=@([pscustomobject]@{pid=$Record.ownedRootPid;createdAt=$Record.rootCreatedAt;parentPid=$null;name='recorded-root'})}
    foreach($identity in $all) {
        if($null -eq $identity -or [int]$identity.pid -le 0 -or !$identity.createdAt) {continue}
        $stamp=([datetime]::Parse($identity.createdAt)).ToUniversalTime().ToString('o')
        $copy=[pscustomobject]@{pid=[int]$identity.pid;createdAt=$stamp;parentPid=$identity.parentPid;name=$identity.name}
        $ledger[(Get-CddaQaIdentityKey $copy)]=$copy
    }
    return $ledger
}
function Write-CddaQaAtomicJson($Path,$Record) {
    $temporary=$Path+'.next'
    $json=$Record | ConvertTo-Json -Depth 12
    [System.IO.File]::WriteAllText($temporary,$json,[System.Text.UTF8Encoding]::new($false))
    if([System.IO.File]::Exists($Path)) {[System.IO.File]::Replace($temporary,$Path,($Path+'.previous'))}
    else {[System.IO.File]::Move($temporary,$Path)}
}
function Stop-CddaQaRecordedIdentities($Ledger,$Checks) {
    foreach($identity in @($Ledger.Values | Sort-Object createdAt -Descending)) {
        $check=[ordered]@{pid=$identity.pid;createdAt=$identity.createdAt;at=(Get-Date).ToUniversalTime().ToString('o');status='unexamined'}
        try {
            $actual=Get-CimInstance Win32_Process -Filter ('ProcessId='+$identity.pid)
            if(!$actual) {$check.status='already-exited'}
            elseif((Get-CddaQaCreationStamp $actual) -ne $identity.createdAt) {$check.status='pid-reused-not-stopped';$check.actualCreatedAt=Get-CddaQaCreationStamp $actual}
            else {Stop-Process -Id $identity.pid -ErrorAction Stop;$check.status='stop-requested-exact-recorded-identity'}
        } catch {$check.status='cleanup-read-or-stop-error';$check.error=$_.Exception.Message}
        $Checks.Add($check)
    }
}
