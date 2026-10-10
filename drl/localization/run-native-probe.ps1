param(
  [ValidateSet('semantic','feeling','item','history','json-contract')][string]$Probe='semantic',
  [ValidateRange(1,60)][int]$TimeoutSeconds=60,
  [switch]$StrictJSONProposal
)
# ROOT-OWNED measured execution only. Preparation/review does not run this file.
# Starts one official compiler and then one task-local native fixture sequentially.
$ErrorActionPreference='Stop'
$drlProbeRoot=$PSScriptRoot
$drlProbeTaskRoot=Split-Path -Parent $drlProbeRoot
$drlProbeNames=@{semantic='native-semantic-probe';feeling='native-feeling-probe';item='native-item-name-probe';history='native-history-probe';'json-contract'='native-json-contract-probe'}
$drlProbeName=$drlProbeNames[$Probe]
$drlProbeSource=Join-Path $drlProbeRoot ($drlProbeName+'.pas')
$drlProbeCompiler=Join-Path $drlProbeTaskRoot 'toolchain/fpc-win64-snapshot/bin/i386-win32/ppcrossx64.exe'
$drlProbeTrustedCompilerSha256='fc3a8184a70722be726264faac4357fe11851e3edb899be8ced0aea82d4e9cb0'
$drlProbeUnits=Join-Path $drlProbeTaskRoot 'toolchain/fpc-win64-snapshot/units/x86_64-win64'
$drlProbeOverlay=Join-Path $drlProbeRoot 'overlay/src'
$drlProbeVerification=Get-Content -LiteralPath (Join-Path $drlProbeRoot 'verification.json') -Raw | ConvertFrom-Json
$drlProbeUnitHashes=[ordered]@{}
foreach($drlProbeFrozenUnit in @('drlsemantictext.pas','drlsemanticfeelings.pas','drlsemanticitemnames.pas','drlsemantichistory.pas')){
  $drlProbeExpected=$drlProbeVerification.files.PSObject.Properties[$drlProbeFrozenUnit].Value.sha256
  foreach($drlProbeCandidate in @((Join-Path $drlProbeRoot $drlProbeFrozenUnit),(Join-Path $drlProbeOverlay $drlProbeFrozenUnit))){
    if((Get-FileHash -LiteralPath $drlProbeCandidate -Algorithm SHA256).Hash.ToLowerInvariant() -ne $drlProbeExpected){throw ('Frozen native unit mismatch: '+$drlProbeCandidate)}
  }
  $drlProbeUnitHashes[$drlProbeFrozenUnit]=$drlProbeExpected
}
$drlProbeGeneratedHashes=[ordered]@{
  'drlsemanticfeelcatalog.pas'=$drlProbeVerification.feelings.validatorUnitSha256
  'drlsemanticitemcatalog.pas'=$drlProbeVerification.itemNames.catalogUnitSha256
  'drlsemantichistorycatalog.pas'=$drlProbeVerification.history.catalogUnitSha256
  'drlsemanticregistry.pas'=$drlProbeVerification.registry.semanticUnitSha256
}
foreach($drlProbeGeneratedUnit in $drlProbeGeneratedHashes.Keys){
  $drlProbeGeneratedPath=Join-Path $drlProbeOverlay $drlProbeGeneratedUnit
  if((Get-FileHash -LiteralPath $drlProbeGeneratedPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $drlProbeGeneratedHashes[$drlProbeGeneratedUnit]){throw ('Generated native unit mismatch: '+$drlProbeGeneratedUnit)}
  $drlProbeUnitHashes[$drlProbeGeneratedUnit]=$drlProbeGeneratedHashes[$drlProbeGeneratedUnit]
}
$drlProbeArguments=@('-n','-Sc','-FcUTF8')
if($StrictJSONProposal){
  $drlProbeProposalRoot=Join-Path $drlProbeRoot 'strict-json-proposal'
  $drlProbeProposal=Get-Content -LiteralPath (Join-Path $drlProbeProposalRoot 'proposal.json') -Raw | ConvertFrom-Json
  if($drlProbeVerification.files.'drlsemanticfeelings.pas'.sha256 -notin @($drlProbeProposal.canonicalSourceSha256,$drlProbeProposal.proposalSha256)){throw 'JSON proposal source-unit guard mismatch'}
  if((Get-FileHash -LiteralPath (Join-Path $drlProbeProposalRoot 'drlsemanticfeelings.pas') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $drlProbeProposal.proposalSha256){throw 'JSON proposal byte hash mismatch'}
  $drlProbeArguments+=('-Fu'+$drlProbeProposalRoot)
}
$drlProbeArguments+=('-Fu'+$drlProbeOverlay)
foreach($drlProbePackage in @('rtl','rtl-objpas','rtl-generics','rtl-unicode','fcl-base','fcl-json')){
  $drlProbePackagePath=Join-Path $drlProbeUnits $drlProbePackage
  if(-not(Test-Path -LiteralPath $drlProbePackagePath -PathType Container)){throw ('Missing official native package: '+$drlProbePackagePath)}
  $drlProbeArguments+=('-Fu'+$drlProbePackagePath)
}
if(-not(Test-Path -LiteralPath $drlProbeSource -PathType Leaf)){throw ('Prepare fixture first: '+$drlProbeSource)}
if(-not(Test-Path -LiteralPath $drlProbeCompiler -PathType Leaf)){throw 'Missing official native compiler'}
if((Get-FileHash -LiteralPath $drlProbeCompiler -Algorithm SHA256).Hash.ToLowerInvariant() -ne $drlProbeTrustedCompilerSha256){throw 'Official native compiler hash mismatch before launch'}
$drlProbePrepared=Get-Content -LiteralPath (Join-Path $drlProbeRoot 'native-probes-preparation.json') -Raw | ConvertFrom-Json
$drlProbePreparedHash=$drlProbePrepared.files.PSObject.Properties[$drlProbeName+'.pas'].Value.sha256
if((Get-FileHash -LiteralPath $drlProbeSource -Algorithm SHA256).Hash.ToLowerInvariant() -ne $drlProbePreparedHash){throw 'Prepared native fixture source mismatch'}
$drlProbeRunId=$drlProbeName+'-'+[Guid]::NewGuid().ToString('N')
$drlProbeBuildRoot=Join-Path $drlProbeRoot ('native-probe-build/'+$drlProbeRunId)
New-Item -ItemType Directory -Path $drlProbeBuildRoot | Out-Null
$drlProbeExe=Join-Path $drlProbeBuildRoot ($drlProbeName+'.exe')
$drlProbeData=Join-Path $drlProbeBuildRoot 'isolated-sidecar.json'
$drlProbeBuildSource=Join-Path $drlProbeBuildRoot ($drlProbeName+'.pas')
Copy-Item -LiteralPath $drlProbeSource -Destination $drlProbeBuildSource
if((Get-FileHash -LiteralPath $drlProbeBuildSource -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $drlProbeSource -Algorithm SHA256).Hash){throw 'Native fixture copied bytes mismatch'}
$drlProbeArguments+=@(('-FU'+$drlProbeBuildRoot),('-FE'+$drlProbeBuildRoot),('-o'+$drlProbeExe),$drlProbeBuildSource)
function Invoke-DRLProbeProcess([string]$Executable,[string[]]$Arguments,[string]$Label){
  $drlProbeInfo=[Diagnostics.ProcessStartInfo]::new()
  $drlProbeInfo.FileName=$Executable;$drlProbeInfo.WorkingDirectory=$drlProbeBuildRoot
  $drlProbeInfo.UseShellExecute=$false;$drlProbeInfo.CreateNoWindow=$true
  $drlProbeInfo.RedirectStandardOutput=$true;$drlProbeInfo.RedirectStandardError=$true
  foreach($drlProbeArgument in $Arguments){$drlProbeInfo.ArgumentList.Add($drlProbeArgument)}
  $drlProbeProcess=[Diagnostics.Process]::new();$drlProbeProcess.StartInfo=$drlProbeInfo
  $drlProbeStarted=[DateTime]::UtcNow.ToString('o')
  $drlProbeStdout='';$drlProbeStderr='';$drlProbeFinished=$false;$drlProbeTimedOut=$false
  $drlProbeExitCode=125;$drlProbeCleanupNotes=@()
  try{
    if(-not $drlProbeProcess.Start()){throw ('Unable to start '+$Label)}
    $drlProbeStdoutTask=$drlProbeProcess.StandardOutput.ReadToEndAsync()
    $drlProbeStderrTask=$drlProbeProcess.StandardError.ReadToEndAsync()
    $drlProbeFinished=$drlProbeProcess.WaitForExit($TimeoutSeconds*1000)
    $drlProbeTimedOut=-not $drlProbeFinished
    if($drlProbeTimedOut){
      try{if(-not $drlProbeProcess.HasExited){$drlProbeProcess.Kill($true)}}catch{$drlProbeCleanupNotes+=('Kill result: '+$_.Exception.Message)}
      $drlProbeFinished=$drlProbeProcess.WaitForExit(2000)
      if(-not $drlProbeFinished){$drlProbeCleanupNotes+='Owned process cleanup exceeded 2 seconds'}
    }
    foreach($drlProbeStream in @(@{name='stdout';task=$drlProbeStdoutTask},@{name='stderr';task=$drlProbeStderrTask})){
      try{
        $drlProbeStreamFinished=$drlProbeStream.task.Wait(1000)
        if($drlProbeStreamFinished){
          $drlProbeStreamText=$drlProbeStream.task.GetAwaiter().GetResult()
          if($drlProbeStream.name -eq 'stdout'){$drlProbeStdout=$drlProbeStreamText}else{$drlProbeStderr=$drlProbeStreamText}
        }else{$drlProbeCleanupNotes+=($drlProbeStream.name+' drain exceeded 1 second; incomplete output omitted')}
      }catch{$drlProbeCleanupNotes+=($drlProbeStream.name+' drain failed: '+$_.Exception.Message)}
    }
    if($drlProbeTimedOut){$drlProbeExitCode=124}
    elseif($drlProbeFinished -and $drlProbeCleanupNotes.Count -eq 0){$drlProbeExitCode=$drlProbeProcess.ExitCode}
  }catch{$drlProbeStderr+=('Fixture process error: '+$_.Exception.Message)}
  finally{
    [IO.File]::WriteAllText((Join-Path $drlProbeBuildRoot ($Label+'.stdout.log')),$drlProbeStdout,[Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText((Join-Path $drlProbeBuildRoot ($Label+'.stderr.log')),$drlProbeStderr,[Text.UTF8Encoding]::new($false))
    $drlProbeProcess.Dispose()
  }
  return [pscustomobject]@{command=@($Executable)+$Arguments;startedUtc=$drlProbeStarted;finishedUtc=[DateTime]::UtcNow.ToString('o');exitCode=$drlProbeExitCode;timedOut=$drlProbeTimedOut;cleanupNotes=$drlProbeCleanupNotes;stdout=$drlProbeStdout;stderr=$drlProbeStderr}
}
$drlProbeCompilation=Invoke-DRLProbeProcess $drlProbeCompiler $drlProbeArguments 'compile'
$drlProbeExecution=$null
if($drlProbeCompilation.exitCode -eq 0){
  $drlProbeRuntimeArguments=@()
  if($Probe -in @('feeling','item','history')){$drlProbeRuntimeArguments=@($drlProbeData)}
  $drlProbeExecution=Invoke-DRLProbeProcess $drlProbeExe $drlProbeRuntimeArguments 'run'
}
$drlProbeRecord=[ordered]@{schema=1;probe=$Probe;sourceCommit=$drlProbeVerification.sourceCommit;source=$drlProbeSource;compiledSource=$drlProbeBuildSource;sourceSha256=(Get-FileHash -LiteralPath $drlProbeSource -Algorithm SHA256).Hash.ToLowerInvariant();compiler=$drlProbeCompiler;compilerSha256=(Get-FileHash -LiteralPath $drlProbeCompiler -Algorithm SHA256).Hash.ToLowerInvariant();unitSearch=$drlProbeArguments;compilation=$drlProbeCompilation;execution=$drlProbeExecution;buildDirectory=$drlProbeBuildRoot;nativeUnitsExecuted=($null -ne $drlProbeExecution);passed=($null -ne $drlProbeExecution -and $drlProbeExecution.exitCode -eq 0);fullOriginalGameExecuted=$false;browserExecuted=$false;knownJSONGapDiagnostic=($Probe -eq 'json-contract');strictJSONProposal=[bool]$StrictJSONProposal}
$drlProbeRecord['unitSourceSha256']=$drlProbeUnitHashes
$drlProbeRecord['verificationSha256']=(Get-FileHash -LiteralPath (Join-Path $drlProbeRoot 'verification.json') -Algorithm SHA256).Hash.ToLowerInvariant()
if($StrictJSONProposal){$drlProbeRecord['jsonProposal']=$drlProbeProposal}
if(Test-Path -LiteralPath $drlProbeExe -PathType Leaf){$drlProbeRecord['executableSha256']=(Get-FileHash -LiteralPath $drlProbeExe -Algorithm SHA256).Hash.ToLowerInvariant()}
$drlProbeRecord | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath (Join-Path $drlProbeBuildRoot 'result.json') -Encoding utf8
Write-Output ('Native fixture result: '+(Join-Path $drlProbeBuildRoot 'result.json'))
Write-Output $drlProbeCompilation.stdout
Write-Output $drlProbeCompilation.stderr
if($null -ne $drlProbeExecution){Write-Output $drlProbeExecution.stdout;Write-Output $drlProbeExecution.stderr}
if(-not $drlProbeRecord.passed){throw ('Actual native '+$Probe+' fixture failed; inspect result/logs above. A failed JSON-contract diagnostic is not a passed test.')}
