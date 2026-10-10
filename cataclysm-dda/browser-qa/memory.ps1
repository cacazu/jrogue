$ErrorActionPreference='Stop'
$cddaQaMemory=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
[pscustomobject]@{at=(Get-Date).ToUniversalTime().ToString('o');availableBytes=[double]$cddaQaMemory.AvailableBytes;committedBytes=[double]$cddaQaMemory.CommittedBytes;commitLimitBytes=[double]$cddaQaMemory.CommitLimit;freeCommitBytes=([double]$cddaQaMemory.CommitLimit-[double]$cddaQaMemory.CommittedBytes)} | ConvertTo-Json -Compress
