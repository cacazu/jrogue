param([switch]$VerifyBrowser)
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot '..\tools\build-original-local.ps1') -VerifyBrowser:$VerifyBrowser
