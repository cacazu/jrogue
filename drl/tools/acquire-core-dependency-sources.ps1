param([switch]$IncludeCompilerRuntime)
$ErrorActionPreference='Stop'
$drlDependencyRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$drlDependencies=@(
  @{Name='wasi-libc';Url='https://github.com/WebAssembly/wasi-libc.git';Commit='2e6fb9d8ee0cdf9e431fbcabe8af3115de000a13';Sparse=@()},
  @{Name='wasi-sdk';Url='https://github.com/WebAssembly/wasi-sdk.git';Commit='5a0bf653a1a06e1c18867567c5937006d3394a69';Sparse=@()},
  @{Name='wasi-libc/tools/wasi-headers/WASI';Url='https://github.com/WebAssembly/WASI';Commit='59cbe140561db52fc505555e859de884e0ee7f00';Sparse=@()}
)
if($IncludeCompilerRuntime){
  $drlDependencies+=@{Name='llvm-project';Url='https://github.com/llvm/llvm-project.git';Commit='895aa2c896ada719451be2e3673c83da8ddf1141';Sparse=@('compiler-rt/lib/builtins','compiler-rt/cmake','compiler-rt/include','cmake','llvm/cmake','llvm/include','third-party/siphash')}
}
function Invoke-DrlGit([string]$Directory,[string[]]$Arguments){
  & git.exe -C $Directory @Arguments
  if($LASTEXITCODE -ne 0){throw ('Pinned source Git action failed: '+($Arguments -join ' '))}
}
$drlAcquired=@()
foreach($drlDependency in $drlDependencies){
  $drlDirectory=[IO.Path]::GetFullPath((Join-Path $drlDependencyRoot ('upstream/'+$drlDependency.Name)))
  $drlAllowed=[IO.Path]::GetFullPath((Join-Path $drlDependencyRoot 'upstream'))+[IO.Path]::DirectorySeparatorChar
  if(!$drlDirectory.StartsWith($drlAllowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Dependency path escaped DRL workspace'}
  New-Item -ItemType Directory -Path $drlDirectory -Force | Out-Null
  if(!(Test-Path -LiteralPath (Join-Path $drlDirectory '.git'))){
    Invoke-DrlGit $drlDirectory @('init','--quiet')
    Invoke-DrlGit $drlDirectory @('remote','add','origin',$drlDependency.Url)
  }
  $drlRemote=(& git.exe -C $drlDirectory remote get-url origin).Trim()
  if($LASTEXITCODE -ne 0 -or $drlRemote -ne $drlDependency.Url){throw 'Existing dependency remote differs from official source'}
  Invoke-DrlGit $drlDirectory @('config','pack.threads','1')
  Invoke-DrlGit $drlDirectory @('config','pack.windowMemory','16m')
  Invoke-DrlGit $drlDirectory @('config','core.deltaBaseCacheLimit','16m')
  Invoke-DrlGit $drlDirectory @('config','core.autocrlf','false')
  Invoke-DrlGit $drlDirectory @('config','gc.auto','0')
  $drlStarted=[DateTime]::UtcNow.ToString('o')
  Invoke-DrlGit $drlDirectory @('fetch','--depth=1','--filter=blob:none','origin',$drlDependency.Commit)
  if($drlDependency.Sparse.Count){
    Invoke-DrlGit $drlDirectory @('sparse-checkout','init','--cone')
    Invoke-DrlGit $drlDirectory (@('sparse-checkout','set')+$drlDependency.Sparse)
  }
  Invoke-DrlGit $drlDirectory @('checkout','--detach',$drlDependency.Commit)
  $drlActual=(& git.exe -C $drlDirectory rev-parse HEAD).Trim()
  if($LASTEXITCODE -ne 0 -or $drlActual -ne $drlDependency.Commit){throw 'Dependency commit verification failed'}
  $drlStatus=@(& git.exe -C $drlDirectory status --porcelain --untracked-files=normal)
  if($LASTEXITCODE -ne 0 -or $drlStatus.Count){throw 'Official dependency checkout is not pristine'}
  $drlGitlinks=@(& git.exe -C $drlDirectory ls-tree -r HEAD | Where-Object {$_ -match '^160000 '})
  $drlAcquired+=@{name=$drlDependency.Name;repository=$drlRemote;commit=$drlActual;sparse_paths=$drlDependency.Sparse;gitlinks=$drlGitlinks;source_code_executed=$false;started_utc=$drlStarted;completed_utc=[DateTime]::UtcNow.ToString('o')}
}
$drlOutput=Join-Path $drlDependencyRoot 'docs/core-dependency-source-acquisition.json'
[IO.File]::WriteAllText($drlOutput,(@{schema=1;scope='official source acquisition only; no compiler/runtime/build started';records=$drlAcquired}|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
Write-Output (@{sources=$drlAcquired.Count;manifest=$drlOutput;source_code_executed=$false}|ConvertTo-Json -Compress)
