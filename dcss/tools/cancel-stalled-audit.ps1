# DCSS task-local helper. Added 2026-10-02; GPL-2.0-or-later.
param([switch]$Stop)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$auditPattern = 'dcss[\\/]tools[\\/](?:inventory|verify-inventory|license-inventory)\.mjs'
$auditProcesses = @()
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='powershell.exe'" | ForEach-Object {
    if ($_.ProcessId -eq $PID) { return }
    $auditCommand = $_.CommandLine
    if ($auditCommand -match '(?i)-EncodedCommand\s+([A-Za-z0-9+/=]+)') {
        $auditCommand = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($Matches[1]))
    }
    if ($auditCommand -match $auditPattern) {
        $auditProcesses += [PSCustomObject]@{ ProcessId=$_.ProcessId; Name=$_.Name; CommandLine=$auditCommand }
    }
}
$auditProcesses | ConvertTo-Json -Depth 3
if ($Stop) {
    foreach ($auditProcess in $auditProcesses) {
        Stop-Process -Id $auditProcess.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
