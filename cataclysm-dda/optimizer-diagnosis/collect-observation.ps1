$ErrorActionPreference = 'Stop'
$taskDiagRoot = Split-Path -Parent $PSCommandPath
$taskBuildRoot = Join-Path (Split-Path -Parent $taskDiagRoot) 'engine-build'
$taskObserved = [DateTimeOffset]::UtcNow
$taskProcess = Get-CimInstance Win32_Process -Filter 'ProcessId=39680'
$taskCpu = Get-Process -Id 39680
$taskMemory = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$taskFiles = @(
  'C:\Users\kit\emsdk\upstream\emscripten\tools\link.py',
  'C:\Users\kit\emsdk\upstream\emscripten\tools\building.py',
  'C:\Users\kit\emsdk\upstream\emscripten\src\settings.js',
  'C:\Users\kit\emsdk\upstream\bin\wasm-opt.exe'
)
$taskPins = foreach ($taskFile in $taskFiles) {
  $taskStat = Get-Item -LiteralPath $taskFile
  [pscustomobject]@{path=$taskFile;bytes=$taskStat.Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$taskLog = Get-Item -LiteralPath (Join-Path $taskBuildRoot 'logs\link-engine.log')
$taskWasm = Get-Item -LiteralPath (Join-Path $taskBuildRoot 'output\cataclysm-tiles.wasm')
$taskCurrent = [ordered]@{
  observedUTC=$taskObserved.ToString('o')
  sdkVersion=(Get-Content -LiteralPath 'C:\Users\kit\emsdk\upstream\emscripten\emscripten-version.txt' -Raw).Trim().Trim('"')
  binaryenVersion=(& 'C:\Users\kit\emsdk\upstream\bin\wasm-opt.exe' --version | Out-String).Trim()
  process=[ordered]@{
    pid=39680;parentPid=$taskProcess.ParentProcessId;commandLine=$taskProcess.CommandLine
    linkLaunchUTC='2026-10-02T15:17:58.9096822Z'
    optimizerCreationUTC=$taskProcess.CreationDate.ToUniversalTime().ToString('o')
    elapsedSeconds=($taskObserved-[DateTimeOffset]::Parse('2026-10-02T15:17:58.9096822Z')).TotalSeconds
    cpuSeconds=$taskCpu.CPU;privateBytes=$taskCpu.PrivateMemorySize64;workingSetBytes=$taskCpu.WorkingSet64;threads=$taskCpu.Threads.Count
    readTransferCount=$taskProcess.ReadTransferCount;writeTransferCount=$taskProcess.WriteTransferCount
    readOperations=$taskProcess.ReadOperationCount;writeOperations=$taskProcess.WriteOperationCount
  }
  memory=[ordered]@{availablePhysicalBytes=$taskMemory.AvailableBytes;commitLimitBytes=$taskMemory.CommitLimit;committedBytes=$taskMemory.CommittedBytes;commitHeadroomBytes=([uint64]$taskMemory.CommitLimit-[uint64]$taskMemory.CommittedBytes)}
  artifacts=[ordered]@{logBytes=$taskLog.Length;logModifiedUTC=$taskLog.LastWriteTimeUtc.ToString('o');wasmBytes=$taskWasm.Length;wasmModifiedUTC=$taskWasm.LastWriteTimeUtc.ToString('o');javascriptExists=(Test-Path -LiteralPath (Join-Path $taskBuildRoot 'output\cataclysm-tiles.js'))}
  firstObserved=[ordered]@{utc='2026-10-02T17:58:29.1676895Z';cpuSeconds=9451.25;privateBytes=2238885888;workingSetBytes=477327360;readTransferCount=42396753;writeTransferCount=0;readOperations=10350;writeOperations=0}
  secondObserved=[ordered]@{utc='2026-10-02T18:01:15.5780772Z';cpuSeconds=9615.21875;privateBytes=2238885888;workingSetBytes=479006720;readTransferCount=42396753;writeTransferCount=0;readOperations=10350;writeOperations=0;threads=1}
  measuredDelta=[ordered]@{seconds=166.4103877;cpuSeconds=163.96875;oneCoreUtilization=(163.96875/166.4103877);readBytes=0;writeBytes=0;privateByteChange=0}
  sdkFilePins=$taskPins
  profilerAvailability=[ordered]@{wprExists=(Test-Path -LiteralPath 'C:\Windows\System32\wpr.exe');wasmOptPdbExists=(Test-Path -LiteralPath 'C:\Users\kit\emsdk\upstream\bin\wasm-opt.pdb');cdbOnPath=[bool](Get-Command cdb.exe -ErrorAction SilentlyContinue);windbgOnPath=[bool](Get-Command windbg.exe -ErrorAction SilentlyContinue);procdumpOnPath=[bool](Get-Command procdump.exe -ErrorAction SilentlyContinue)}
  limits=@('CPU and IO counters do not identify the active Binaryen pass or prove termination.','No debugger attachment, process interruption, ETW recording, duplicate link, or SDK mutation performed.','Zero IO is compatible with both in-memory useful optimizer work and a pathological loop.','Non-build work and overall compiler elapsed require owner session timestamps, not summed per-unit durations.')
}
$taskCurrent | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $taskDiagRoot 'observed-process.json') -Encoding utf8
[pscustomobject]@{utc=$taskCurrent.observedUTC;elapsedSeconds=$taskCurrent.process.elapsedSeconds;cpuSeconds=$taskCurrent.process.cpuSeconds;privateBytes=$taskCurrent.process.privateBytes;commitHeadroomBytes=$taskCurrent.memory.commitHeadroomBytes;javascriptExists=$taskCurrent.artifacts.javascriptExists;profiler=$taskCurrent.profilerAvailability} | ConvertTo-Json -Depth 4
