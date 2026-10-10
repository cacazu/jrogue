$ErrorActionPreference = 'Stop'
$taskWorkspace = (Get-Location).Path
$compilerPath = Join-Path $taskWorkspace 'toolchain\fpc-win64-snapshot\bin\i386-win32\ppcrossx64.exe'
$probeRoot = Join-Path $taskWorkspace 'toolchain\probe'
$buildRoot = Join-Path $probeRoot 'build'
$rtlRoot = Join-Path $taskWorkspace 'toolchain\fpc-win64-snapshot\units\x86_64-win64\rtl'
$helloSource = Join-Path $probeRoot 'hello.pas'
New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
$evidence = [Collections.Generic.List[object]]::new()
function Invoke-Probe {
  param([string]$Name, [string]$Executable, [string[]]$Arguments)
  $started = [DateTime]::UtcNow.ToString('o')
  $output = @(& $Executable @Arguments 2>&1 | ForEach-Object { $_.ToString() })
  $exitCode = $LASTEXITCODE
  $logPath = Join-Path $probeRoot "$Name.log"
  [IO.File]::WriteAllText($logPath, ($output -join [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
  $record = [pscustomobject]@{
    name = $Name
    executable = $Executable
    arguments = $Arguments
    startedUtc = $started
    completedUtc = [DateTime]::UtcNow.ToString('o')
    exitCode = $exitCode
    log = $logPath
    output = $output
  }
  $evidence.Add($record)
  $record
}
Invoke-Probe -Name 'compiler-info' -Executable $compilerPath -Arguments @('-n','-i') | ConvertTo-Json -Depth 5
Invoke-Probe -Name 'compiler-version' -Executable $compilerPath -Arguments @('-n','-iVDW') | ConvertTo-Json -Depth 5
Invoke-Probe -Name 'wasip1-info-attempt' -Executable $compilerPath -Arguments @('-n','-Twasip1','-i') | ConvertTo-Json -Depth 5
$native = Invoke-Probe -Name 'native-hello-compile' -Executable $compilerPath -Arguments @('-n', "-Fu$rtlRoot", "-FU$buildRoot", "-FE$buildRoot", '-ohello.exe', $helloSource)
$native | ConvertTo-Json -Depth 5
if ($native.exitCode -eq 0) {
  Invoke-Probe -Name 'native-hello-run' -Executable (Join-Path $buildRoot 'hello.exe') -Arguments @() | ConvertTo-Json -Depth 5
  [pscustomobject]@{ AuthoredHelloExeSha256=(Get-FileHash -LiteralPath (Join-Path $buildRoot 'hello.exe') -Algorithm SHA256).Hash.ToLowerInvariant() } | ConvertTo-Json
}
Invoke-Probe -Name 'wasm-hello-compile-attempt' -Executable $compilerPath -Arguments @('-n','-Pwasm32','-Twasip1', "-FU$buildRoot", "-FE$buildRoot", '-ohello.wasm', $helloSource) | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText((Join-Path $probeRoot 'compiler-capability.json'), ($evidence | ConvertTo-Json -Depth 7), [Text.UTF8Encoding]::new($false))

