param([int]$CandidateRootPid,[int]$OriginalPid,[string]$RunDirectory)
$ErrorActionPreference='Stop'
$cddaLimit=2147483648
$cddaPrivateLimit=4294967296
$cddaPeakPrivate=[uint64]0
$cddaPeakWs=[uint64]0
$cddaSamples=0
$cddaUtf8=[Text.UTF8Encoding]::new($false)
try {
  while (Test-Path -LiteralPath (Join-Path $RunDirectory 'monitor-active.flag')) {
    if (-not (Get-Process -Id $CandidateRootPid -ErrorAction SilentlyContinue)) { break }
    $cddaProcesses=@(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name,ReadOperationCount,WriteOperationCount,ReadTransferCount,WriteTransferCount)
    $cddaDepth=@{}; $cddaDepth[$CandidateRootPid]=0
    do {
      $cddaAdded=$false
      foreach($cddaProcess in $cddaProcesses) {
        if(-not $cddaDepth.ContainsKey([int]$cddaProcess.ProcessId) -and $cddaDepth.ContainsKey([int]$cddaProcess.ParentProcessId)) {
          $cddaDepth[[int]$cddaProcess.ProcessId]=$cddaDepth[[int]$cddaProcess.ParentProcessId]+1; $cddaAdded=$true
        }
      }
    } while($cddaAdded)
    $cddaRows=@(foreach($cddaProcess in $cddaProcesses) {
      if(-not $cddaDepth.ContainsKey([int]$cddaProcess.ProcessId)) { continue }
      $cddaLive=Get-Process -Id $cddaProcess.ProcessId -ErrorAction SilentlyContinue
      if(-not $cddaLive) { continue }
      try {
        [pscustomobject]@{pid=[int]$cddaLive.Id; name=$cddaProcess.Name; depth=$cddaDepth[[int]$cddaLive.Id]; startUtc=$cddaLive.StartTime.ToUniversalTime().ToString('o'); cpuSeconds=$cddaLive.CPU; privateBytes=[uint64]$cddaLive.PrivateMemorySize64; workingSetBytes=[uint64]$cddaLive.WorkingSet64; readOperations=[uint64]$cddaProcess.ReadOperationCount; writeOperations=[uint64]$cddaProcess.WriteOperationCount; readTransferBytes=[uint64]$cddaProcess.ReadTransferCount; writeTransferBytes=[uint64]$cddaProcess.WriteTransferCount}
      } catch { continue }
    })
    if(@($cddaRows | Where-Object {$_.pid -eq $OriginalPid}).Count) { throw 'Original optimizer unexpectedly appears in candidate tree; refusing any termination.' }
    $cddaOs=Get-CimInstance Win32_OperatingSystem
    $cddaPerf=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
    $cddaFree=[uint64]$cddaOs.FreePhysicalMemory*1024
    $cddaHeadroom=[uint64]$cddaPerf.CommitLimit-[uint64]$cddaPerf.CommittedBytes
    $cddaPrivate=[uint64](($cddaRows | Measure-Object -Property privateBytes -Sum).Sum)
    $cddaWs=[uint64](($cddaRows | Measure-Object -Property workingSetBytes -Sum).Sum)
    $cddaPeakPrivate=[Math]::Max($cddaPeakPrivate,$cddaPrivate); $cddaPeakWs=[Math]::Max($cddaPeakWs,$cddaWs); $cddaSamples++
    $cddaSample=[pscustomobject]@{timestampUtc=[DateTime]::UtcNow.ToString('o'); physicalFreeBytes=$cddaFree; exactCommitHeadroomBytes=$cddaHeadroom; ownedTreePrivateBytes=$cddaPrivate; ownedTreeWorkingSetBytes=$cddaWs; sampledPeakPrivateBytes=$cddaPeakPrivate; sampledPeakWorkingSetBytes=$cddaPeakWs; sampleCount=$cddaSamples; processes=$cddaRows}
    [IO.File]::AppendAllText((Join-Path $RunDirectory 'resource-samples.ndjson'),($cddaSample | ConvertTo-Json -Depth 5 -Compress)+"`n",$cddaUtf8)
    [IO.File]::WriteAllText((Join-Path $RunDirectory 'resource-current.json'),($cddaSample | ConvertTo-Json -Depth 5),$cddaUtf8)
    if($cddaFree -lt $cddaLimit -or $cddaHeadroom -lt $cddaLimit -or $cddaPrivate -gt $cddaPrivateLimit) {
      $cddaConstraint=[pscustomobject]@{result='resource-constraint'; observed=$cddaSample; minimumPhysicalAndCommitBytes=$cddaLimit; maximumCandidatePrivateBytes=$cddaPrivateLimit; originalPidPreserved=$OriginalPid}
      [IO.File]::WriteAllText((Join-Path $RunDirectory 'constraint-triggered.json'),($cddaConstraint | ConvertTo-Json -Depth 7),$cddaUtf8)
      foreach($cddaRow in ($cddaRows | Sort-Object depth -Descending)) {
        if($cddaRow.pid -eq $CandidateRootPid -or $cddaRow.pid -eq $PID -or $cddaRow.pid -eq $OriginalPid) { continue }
        $cddaTarget=Get-Process -Id $cddaRow.pid -ErrorAction SilentlyContinue
        if($cddaTarget -and $cddaTarget.StartTime.ToUniversalTime().ToString('o') -eq $cddaRow.startUtc) {
          Stop-Process -Id $cddaRow.pid -ErrorAction SilentlyContinue
        }
      }
      break
    }
    Start-Sleep -Seconds 5
  }
} catch {
  [IO.File]::WriteAllText((Join-Path $RunDirectory 'monitor-error.json'),([pscustomobject]@{timestampUtc=[DateTime]::UtcNow.ToString('o'); error=$_.Exception.Message} | ConvertTo-Json),$cddaUtf8)
  exit 1
}
