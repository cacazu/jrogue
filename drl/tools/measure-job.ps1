param(
  [Parameter(Mandatory=$true)][string]$Executable,
  [string[]]$JobArguments=@(),
  [Parameter(Mandatory=$true)][string]$Evidence,
  [string]$WorkingDirectory=(Get-Location).Path,
  [int]$TimeoutSeconds=300
)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DrlJobMeasure {
  [StructLayout(LayoutKind.Sequential)] public struct Basic {
    public long UserTime, JobTime; public uint Flags;
    public UIntPtr MinWorkingSet, MaxWorkingSet; public uint Active;
    public UIntPtr Affinity; public uint Priority, Scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] public struct Io {
    public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes;
  }
  [StructLayout(LayoutKind.Sequential)] public struct Extended {
    public Basic Basic; public Io Io;
    public UIntPtr ProcessLimit, JobLimit, PeakProcessMemory, PeakJobMemory;
  }
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern IntPtr CreateJobObject(IntPtr security,string name);
  [DllImport("kernel32.dll",SetLastError=true)] public static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
  [DllImport("kernel32.dll",SetLastError=true)] public static extern bool QueryInformationJobObject(IntPtr job,int kind,IntPtr info,uint length,IntPtr returned);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr value);
  public static Extended Read(IntPtr job) {
    int size=Marshal.SizeOf(typeof(Extended)); IntPtr p=Marshal.AllocHGlobal(size);
    try { if(!QueryInformationJobObject(job,9,p,(uint)size,IntPtr.Zero)) throw new System.ComponentModel.Win32Exception(); return Marshal.PtrToStructure<Extended>(p); }
    finally {Marshal.FreeHGlobal(p);}
  }
  public static int[] Pids(IntPtr job) {
    const int size=65536; IntPtr p=Marshal.AllocHGlobal(size);
    try { if(!QueryInformationJobObject(job,3,p,size,IntPtr.Zero)) throw new System.ComponentModel.Win32Exception(); int count=Marshal.ReadInt32(p,4); if(count<0||count>(size-8)/IntPtr.Size) throw new Exception("Invalid job process count"); int[] ids=new int[count]; for(int i=0;i<count;i++)ids[i]=(int)Marshal.ReadIntPtr(p,8+i*IntPtr.Size); return ids; }
    finally {Marshal.FreeHGlobal(p);}
  }
}
'@
$initial=Get-CimInstance Win32_OperatingSystem
$job=[DrlJobMeasure]::CreateJobObject([IntPtr]::Zero,$null)
if($job -eq [IntPtr]::Zero){throw 'Could not create measurement job'}
$records=@{}; $peakWorkingSet=0L; $samples=0; $started=[DateTime]::UtcNow
$minimumFreePhysical=[long]$initial.FreePhysicalMemory*1024
$minimumFreeCommit=[long]$initial.FreeVirtualMemory*1024
try {
  $start=New-Object Diagnostics.ProcessStartInfo
  $start.FileName=$Executable; $start.WorkingDirectory=$WorkingDirectory
  $start.UseShellExecute=$false; $start.CreateNoWindow=$true
  $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
  foreach($argument in $JobArguments){$start.ArgumentList.Add($argument)}
  $process=[Diagnostics.Process]::Start($start)
  $stdoutTask=$process.StandardOutput.ReadToEndAsync()
  $stderrTask=$process.StandardError.ReadToEndAsync()
  if(![DrlJobMeasure]::AssignProcessToJobObject($job,$process.Handle)){throw ('Could not isolate measurement job: '+[Runtime.InteropServices.Marshal]::GetLastWin32Error())}
  do {
    $workingSet=0L
    foreach($processId in [DrlJobMeasure]::Pids($job)) {
      try {
        $member=[Diagnostics.Process]::GetProcessById($processId); $member.Refresh()
        $workingSet+=$member.WorkingSet64
        $key=[string]$processId
        if(!$records.ContainsKey($key)){$records[$key]=@{pid=$processId;name=$member.ProcessName;peak_working_set_bytes=0L;peak_private_bytes=0L}}
        $records[$key].peak_working_set_bytes=[Math]::Max($records[$key].peak_working_set_bytes,$member.PeakWorkingSet64)
        $records[$key].peak_private_bytes=[Math]::Max($records[$key].peak_private_bytes,$member.PrivateMemorySize64)
      } catch [ArgumentException] { }
    }
    $peakWorkingSet=[Math]::Max($peakWorkingSet,$workingSet);$samples++
    if($samples%10 -eq 0){
      $during=Get-CimInstance Win32_OperatingSystem
      $minimumFreePhysical=[Math]::Min($minimumFreePhysical,[long]$during.FreePhysicalMemory*1024)
      $minimumFreeCommit=[Math]::Min($minimumFreeCommit,[long]$during.FreeVirtualMemory*1024)
    }
    if(([DateTime]::UtcNow-$started).TotalSeconds -gt $TimeoutSeconds){$process.Kill($true);throw 'Measured DRL job exceeded its bounded timeout'}
    Start-Sleep -Milliseconds 100
    $process.Refresh()
  } while(!$process.HasExited)
  $process.WaitForExit();$exitCode=$process.ExitCode
  $stdout=$stdoutTask.GetAwaiter().GetResult();$stderr=$stderrTask.GetAwaiter().GetResult()
  $stdoutPath=[IO.Path]::GetFullPath($Evidence+'.stdout.log')
  $stderrPath=[IO.Path]::GetFullPath($Evidence+'.stderr.log')
  [IO.File]::WriteAllText($stdoutPath,$stdout,(New-Object Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText($stderrPath,$stderr,(New-Object Text.UTF8Encoding($false)))
  $measured=[DrlJobMeasure]::Read($job)
  $final=Get-CimInstance Win32_OperatingSystem
  $result=[ordered]@{
    schema=1;command=@($Executable)+$JobArguments;started_utc=$started.ToString('o');completed_utc=[DateTime]::UtcNow.ToString('o');exit_code=$exitCode
    headroom_before=@{free_physical_bytes=[long]$initial.FreePhysicalMemory*1024;free_commit_bytes=[long]$initial.FreeVirtualMemory*1024}
    headroom_after=@{free_physical_bytes=[long]$final.FreePhysicalMemory*1024;free_commit_bytes=[long]$final.FreeVirtualMemory*1024}
    exact_job_peak_commit_bytes=$measured.PeakJobMemory.ToUInt64();exact_process_peak_commit_bytes=$measured.PeakProcessMemory.ToUInt64()
    sampled_group_peak_working_set_bytes=$peakWorkingSet;sample_interval_ms=100;samples=$samples;observed_processes=@($records.Values)
    minimum_sampled_headroom_bytes=@{physical=$minimumFreePhysical;commit=$minimumFreeCommit}
    stdout_log=$stdoutPath;stderr_log=$stderrPath
  }
  [IO.File]::WriteAllText([IO.Path]::GetFullPath($Evidence),($result|ConvertTo-Json -Depth 6),(New-Object Text.UTF8Encoding($false)))
  Write-Output (@{evidence=[IO.Path]::GetFullPath($Evidence);exit_code=$exitCode;peak_commit_bytes=$result.exact_job_peak_commit_bytes;sampled_peak_working_set_bytes=$peakWorkingSet;minimum_headroom_bytes=$result.minimum_sampled_headroom_bytes;processes=$records.Count}|ConvertTo-Json -Depth 4 -Compress)
  if($exitCode -ne 0){Write-Output (($stdout+$stderr).Substring([Math]::Max(0,($stdout+$stderr).Length-8000)))}
  if($exitCode -ne 0){exit $exitCode}
} catch {
  if($process -and !$process.HasExited){$process.Kill($true)}
  throw
} finally { [DrlJobMeasure]::CloseHandle($job)|Out-Null }
