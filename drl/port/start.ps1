$ErrorActionPreference='Stop'
$drlLocalRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location -LiteralPath $drlLocalRoot
try{
  & (Get-Command node.exe -ErrorAction Stop).Source port/web/server.mjs
  if($LASTEXITCODE -ne 0){throw 'DRL local Node server exited with an error'}
}finally{Pop-Location}
