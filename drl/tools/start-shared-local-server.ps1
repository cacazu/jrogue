$ErrorActionPreference='Stop'
$drlTaskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$drlSharedRoot=[IO.Path]::GetFullPath('C:\Users\kit\gameme\jnethack\jrouge\drl')
$drlRepository=[IO.Path]::GetFullPath('C:\Users\kit\gameme\jnethack\jrouge')
if([IO.Path]::GetDirectoryName($drlSharedRoot) -ne $drlRepository -or [IO.Path]::GetFileName($drlSharedRoot) -ne 'drl'){throw 'DRL confinement failed'}
if(!(Test-Path -LiteralPath (Join-Path $drlRepository '.git'))){throw 'Expected repository absent'}
for($drlAncestor=$drlSharedRoot;$drlAncestor;$drlAncestor=[IO.Path]::GetDirectoryName($drlAncestor)){
  if((Get-Item -LiteralPath $drlAncestor).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Shared root ancestor link rejected'}
}
$drlExpected=Get-Content -LiteralPath (Join-Path $drlSharedRoot 'port/dist/build.json') -Raw -Encoding utf8|ConvertFrom-Json
$drlBundle=Get-Content -LiteralPath (Join-Path $drlSharedRoot 'port/dist/source-bundle.json') -Raw -Encoding utf8|ConvertFrom-Json
$drlBrowser=Get-Content -LiteralPath (Join-Path $drlTaskRoot 'docs/SHARED-LOCAL-BROWSER-EVIDENCE.json') -Raw -Encoding utf8|ConvertFrom-Json
if($drlBrowser.result -ne 'pass' -or $drlBrowser.checks.Count -ne 3){throw 'Actual shared-checkout browser smoke must pass first'}
$drlPort=4189
$drlUrl='http://127.0.0.1:4189'
$drlListeners=@(Get-NetTCPConnection -State Listen -LocalPort $drlPort -ErrorAction SilentlyContinue)
$drlStarted=$false
if($drlListeners.Count -eq 0){
  $drlOldPort=$env:DRL_PORT
  try{
    $env:DRL_PORT=[string]$drlPort
    $drlProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('port/web/server.mjs') -WorkingDirectory $drlSharedRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $drlSharedRoot 'docs/local-server.stdout.log') -RedirectStandardError (Join-Path $drlSharedRoot 'docs/local-server.stderr.log') -PassThru
  }finally{
    if($null -eq $drlOldPort){Remove-Item -LiteralPath Env:DRL_PORT -ErrorAction SilentlyContinue}else{$env:DRL_PORT=$drlOldPort}
  }
  $drlStarted=$true
  $drlUntil=[DateTime]::UtcNow.AddSeconds(15)
  do{
    Start-Sleep -Milliseconds 100
    $drlListeners=@(Get-NetTCPConnection -State Listen -LocalPort $drlPort -ErrorAction SilentlyContinue)
    $drlProcess.Refresh()
    if($drlProcess.HasExited){throw ('Owned local Node server exited: '+$drlProcess.ExitCode)}
  }while($drlListeners.Count -eq 0 -and [DateTime]::UtcNow -lt $drlUntil)
  if($drlListeners.Count -eq 0){throw 'Owned local server did not listen'}
  if(@($drlListeners|Where-Object OwningProcess -ne $drlProcess.Id).Count){throw 'Port ownership changed; no process was terminated'}
}
if(@($drlListeners|Where-Object LocalAddress -ne '127.0.0.1').Count){throw 'Existing listener is not confined to loopback; no process was changed'}
$drlPid=($drlListeners|Select-Object -First 1).OwningProcess
$drlOwner=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$drlPid)
if(!$drlOwner -or $drlOwner.Name -ne 'node.exe' -or $drlOwner.CommandLine -notmatch 'port[\\/]web[\\/]server\.mjs'){throw 'Existing listener is not the expected Node server; no process was changed'}
$drlClient=[Net.Http.HttpClient]::new()
$drlClient.Timeout=[TimeSpan]::FromSeconds(30)
$drlRecords=[Collections.Generic.List[object]]::new()
function Test-DrlHttp([string]$Relative,[string]$ExpectedFile){
  $drlLocal=Join-Path $drlSharedRoot ('port/dist/'+$ExpectedFile)
  $drlHash=(Get-FileHash -LiteralPath $drlLocal -Algorithm SHA256).Hash.ToLowerInvariant()
  $drlSize=(Get-Item -LiteralPath $drlLocal).Length
  $drlResponse=$drlClient.GetAsync($drlUrl+$Relative,[Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  try{
    $drlResponse.EnsureSuccessStatusCode()|Out-Null
    $drlStream=$drlResponse.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    try{
      $drlHasher=[Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256)
      try{
        $drlBuffer=[byte[]]::new(65536);[long]$drlReadTotal=0
        while(($drlRead=$drlStream.Read($drlBuffer,0,$drlBuffer.Length)) -gt 0){$drlHasher.AppendData($drlBuffer,0,$drlRead);$drlReadTotal+=$drlRead}
        $drlHttpHash=[Convert]::ToHexString($drlHasher.GetHashAndReset()).ToLowerInvariant()
      }finally{$drlHasher.Dispose()}
    }finally{$drlStream.Dispose()}
    if($drlHttpHash -ne $drlHash -or $drlReadTotal -ne $drlSize){throw ('Existing HTTP listener serves different DRL bytes: '+$Relative)}
    $drlRecords.Add(@{url=$drlUrl+$Relative;size=$drlReadTotal;sha256=$drlHttpHash;status=200;content_type=[string]$drlResponse.Content.Headers.ContentType})
  }finally{$drlResponse.Dispose()}
}
try{
  Test-DrlHttp '/' 'game.html'
  Test-DrlHttp '/index.html' 'game.html'
  Test-DrlHttp '/game.html' 'game.html'
  Test-DrlHttp '/build.json' 'build.json'
  Test-DrlHttp ('/'+$drlExpected.core.file) $drlExpected.core.file
  Test-DrlHttp ('/'+$drlExpected.adapter.file) $drlExpected.adapter.file
  Test-DrlHttp '/source-bundle.json' 'source-bundle.json'
  Test-DrlHttp '/source.zip' 'source.zip'
}finally{$drlClient.Dispose()}
if($drlBrowser.core_sha256 -ne $drlExpected.core.sha256 -or $drlBrowser.adapter_sha256 -ne $drlExpected.adapter.sha256 -or $drlBrowser.source_archive_sha256 -ne $drlBundle.sha256){throw 'Shared browser proof does not match served files'}
$drlReceipt=@{schema=1;result='pass';recorded_utc=[DateTime]::UtcNow.ToString('o');url=$drlUrl+'/game.html';cwd=$drlSharedRoot;pid=$drlPid;started_here=$drlStarted;loopback_only=$true;hidden_window=$true;files=$drlRecords;core_sha256=$drlExpected.core.sha256;adapter_sha256=$drlExpected.adapter.sha256;source_archive_sha256=$drlBundle.sha256;browser_receipt='docs/SHARED-LOCAL-BROWSER-EVIDENCE.json';external_deployment=$false;full_port_complete=$false}
$drlReceiptJson=($drlReceipt|ConvertTo-Json -Depth 8)+[Environment]::NewLine
foreach($drlRoot in @($drlTaskRoot,$drlSharedRoot)){[IO.File]::WriteAllText((Join-Path $drlRoot 'docs/LOCAL-SERVER-EVIDENCE.json'),$drlReceiptJson,[Text.UTF8Encoding]::new($false))}
Write-Output (@{result='pass';url=$drlReceipt.url;pid=$drlPid;served_hash_checks=$drlRecords.Count;full_port_complete=$false}|ConvertTo-Json -Compress)
