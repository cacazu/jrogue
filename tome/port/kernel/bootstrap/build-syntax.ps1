$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = 'C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6'
$compiler = 'C:\Users\kit\emsdk\upstream\emscripten\emcc.exe'
$buildRoot = Join-Path $PSScriptRoot 'syntax-build'
New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $taskRoot 'lua-work\stdio_physfs_adapter.c') -Destination (Join-Path $buildRoot 'stdio_physfs_adapter.c')
$env:EM_CONFIG = 'C:\Users\kit\emsdk\.emscripten'
$env:EM_CACHE = Join-Path $buildRoot 'em-cache'
$arguments = @((Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'src\lua') -Filter '*.c' -File | Where-Object { $_.Name -notin @('luac.c', 'print.c') }).FullName)
$arguments += @((Join-Path $PSScriptRoot 'syntax_main.c'), (Join-Path $buildRoot 'stdio_physfs_adapter.c'))
$arguments += @('-I', (Join-Path $sourceRoot 'src\lua'), '-I', (Join-Path $sourceRoot 'src\physfs'))
$arguments += @('-O0', '-sENVIRONMENT=node', '-sEXIT_RUNTIME=1', '--embed-file', ((Join-Path $PSScriptRoot 'real-core-probe.lua') + '@/real-core-probe.lua'), '-o', (Join-Path $buildRoot 'syntax.js'))
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw "Official Lua parser compile failed: $LASTEXITCODE" }
& 'C:\Program Files\nodejs\node.exe' (Join-Path $buildRoot 'syntax.js')
if ($LASTEXITCODE -ne 0) { throw "Bootstrap Lua syntax verification failed: $LASTEXITCODE" }
