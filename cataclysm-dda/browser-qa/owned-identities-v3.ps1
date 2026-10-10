function Get-CddaQaCreationStamp($Process) {
    if(!$Process -or $Process.CreationDate -isnot [datetime]) {throw 'Unsupported CIM creation timestamp type.'}
    $utc=$Process.CreationDate.ToUniversalTime()
    if(($utc.Ticks % [long]10) -ne 0) {throw 'Noncanonical CIM creation timestamp: microsecond quantum required.'}
    return $utc.ToString('o')
}
function Get-CddaQaNativeCimQuantumStamp($NativeTime) {
    if($NativeTime -isnot [datetime]) {throw 'Unsupported native creation timestamp type.'}
    $utc=$NativeTime.ToUniversalTime()
    [long]$ticks=$utc.Ticks
    [long]$remainder=$ticks % [long]10
    [long]$canonicalTicks=$ticks-$remainder
    return ([datetime]::new($canonicalTicks,[DateTimeKind]::Utc)).ToString('o')
}
# Microsoft CIM_DATETIME uses six microsecond digits; native FILETIME uses 100ns ticks.
# This exact integer quantum conversion is not rounding or a tolerance interval.
function Get-CddaQaIdentityKey($Identity) {return ([string]$Identity.pid+'|'+[string]$Identity.createdAt)}
function Read-CddaQaRecordedIdentities($Record) {
    $ledger=@{}
    $all=@($Record.recordedOwnedIdentities)+@($Record.cleanupChecks)+@($Record.checkedIdentities)
    foreach($sample in @($Record.samples)) {$all+=@($sample.ownedProcesses)}
    if($Record.rootCreatedAt) {$all+=@([pscustomobject]@{pid=$Record.ownedRootPid;createdAt=$Record.rootCreatedAt;parentPid=$null;name='recorded-root'})}
    foreach($identity in $all) {
        if($null -eq $identity -or [int]$identity.pid -le 0 -or !$identity.createdAt) {continue}
        $time=([datetime]::Parse($identity.createdAt)).ToUniversalTime()
        if(($time.Ticks % [long]10) -ne 0) {throw 'Noncanonical recorded CIM creation timestamp.'}
        $stamp=$time.ToString('o')
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
