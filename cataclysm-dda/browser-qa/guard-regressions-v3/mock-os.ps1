param([string]$FixturePath,[string]$OutputPath,[string]$ProductionPath,[string]$GuardRecordPath,[string]$CleanupRecordPath)
# Pure fixture: all process/memory/stop operations below are mocks. No native cmdlet fallback.
$ErrorActionPreference='Stop'
$global:cddaQaMock=Get-Content -LiteralPath $FixturePath -Raw | ConvertFrom-Json
$global:cddaQaGeneration=0
$global:cddaQaMetricSeen=@{}
$global:cddaQaFilterCalls=@{}
$global:cddaQaStopped=[System.Collections.Generic.List[int]]::new()
$global:cddaQaMockOutput=$OutputPath
$global:cddaQaMockStop=$OutputPath+'.stop'
function Convert-MockProcess($Record) {
    if(!$Record){return $null}
    [pscustomobject]@{ProcessId=[int]$Record.pid;ParentProcessId=[int]$Record.parentPid;CreationDate=[datetime]::Parse($Record.createdAt);Name='mock-owned.exe';CommandLine=($Record.commandLine)}
}
function Get-CimInstance {
    param([string]$ClassName,[string]$Filter)
    if($ClassName -eq 'Win32_PerfFormattedData_PerfOS_Memory') {
        return [pscustomobject]@{AvailableBytes=10GB;CommittedBytes=4GB;CommitLimit=16GB}
    }
    if($ClassName -ne 'Win32_Process'){throw 'Unmocked CIM class forbidden'}
    if(!$Filter) {
        $global:cddaQaGeneration++
        $index=[Math]::Min($global:cddaQaGeneration-1,$global:cddaQaMock.snapshots.Count-1)
        foreach($record in $global:cddaQaMock.snapshots[$index]) {Convert-MockProcess $record}
        return
    }
    $id=[int]($Filter -replace '^ProcessId=','')
    $global:cddaQaFilterCalls[$id]=[int]$global:cddaQaFilterCalls[$id]+1
    if($global:cddaQaMock.filterDisappearAfter.pid -eq $id -and $global:cddaQaFilterCalls[$id] -ge $global:cddaQaMock.filterDisappearAfter.call) {return $null}
    $override=$global:cddaQaMock.alwaysLiveOverrides | Where-Object {$_.pid -eq $id} | Select-Object -First 1
    if($override) {return Convert-MockProcess $override}
    if($global:cddaQaGeneration -eq 0 -and $global:cddaQaMock.initialRoot -and $id -eq 100) {return Convert-MockProcess $global:cddaQaMock.initialRoot}
    if($global:cddaQaMetricSeen.ContainsKey($id)) {
        $race=$global:cddaQaMock.races | Where-Object {$_.pid -eq $id} | Select-Object -First 1
        if($race.throwOnRead) {throw 'Mock identity recheck unreadable'}
        if($race) {return Convert-MockProcess $race.replacement}
    }
    $index=[Math]::Min([Math]::Max(0,$global:cddaQaGeneration-1),$global:cddaQaMock.snapshots.Count-1)
    $record=$global:cddaQaMock.snapshots[$index] | Where-Object {$_.pid -eq $id} | Select-Object -First 1
    return Convert-MockProcess $record
}
function Get-Process {
    param([int]$Id,[object]$ErrorAction)
    $global:cddaQaMetricSeen[$Id]=$true
    $record=Get-CimInstance Win32_Process -Filter ('ProcessId='+$Id)
    $config=$global:cddaQaMock.metrics | Where-Object {$_.pid -eq $Id} | Select-Object -First 1
    if($config.kind -eq 'throw' -or !$record) {throw 'Mock process metric unavailable'}
    $start=$record.CreationDate
    if($config.kind -eq 'start-mismatch') {$start=$start.AddTicks(10)}
    if($config.kind -eq 'start-offset') {$start=$start.AddTicks([long]$config.ticks)}
    $private=if($config.kind -eq 'null-private'){$null}elseif($config.privateBytes){[long]$config.privateBytes}else{[long]50000000}
    $metrics=[pscustomobject]@{StartTime=$start;PrivateMemorySize64=$private;WorkingSet64=[long]60000000;TotalProcessorTime=[timespan]::FromMilliseconds(12);Threads=@(1,2)}
    if($config.kind -eq 'private-throws') {$metrics.PSObject.Properties.Remove('PrivateMemorySize64');$metrics|Add-Member ScriptProperty PrivateMemorySize64 {throw 'Mock private read failure'}}
    if($config.kind -eq 'optional-throws') {
        foreach($name in @('WorkingSet64','TotalProcessorTime','Threads')) {$metrics.PSObject.Properties.Remove($name);$metrics|Add-Member ScriptProperty $name {throw 'Mock optional metric read failure'}}
    }
    return $metrics
}
function Stop-Process {
    param([int]$Id,[object]$ErrorAction)
    $global:cddaQaStopped.Add($Id)
    @($global:cddaQaStopped) | ConvertTo-Json | Set-Content -LiteralPath ($global:cddaQaMockOutput+'.stops.json') -Encoding utf8
}
function Start-Sleep {
    param([int]$Milliseconds)
    if($global:cddaQaGeneration -ge [int]$global:cddaQaMock.stopAfterGeneration) {Set-Content -LiteralPath $global:cddaQaMockStop -Value 'mock-only stop marker'}
}
if($global:cddaQaMock.operation -eq 'verify') {
    & $ProductionPath -GuardPath $GuardRecordPath -CleanupPath $CleanupRecordPath -OutputPath $OutputPath
} elseif($global:cddaQaMock.operation -eq 'close') {
    & $ProductionPath -OwnedRootPid 100 -ExpectedProfile 'mock-profile' -OutputPath $OutputPath -StopPath $global:cddaQaMockStop -RecordedGuardPath $GuardRecordPath -CloseOwned
} else {
    if($global:cddaQaMock.stopImmediately) {Set-Content -LiteralPath $global:cddaQaMockStop -Value 'mock-only stop marker'}
    & $ProductionPath -OwnedRootPid 100 -ExpectedProfile 'mock-profile' -OutputPath $OutputPath -StopPath $global:cddaQaMockStop -PrivateBudgetBytes 1073741824 -RemainingFloorBytes 2147483648 -MaximumSeconds 180
}

exit $LASTEXITCODE
