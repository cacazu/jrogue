"""Run one owned Windows process tree and measure actual job/process memory.

Windows Job Objects retain the kernel's aggregate peak committed memory even
between samples. Working-set peaks and global headroom are sampled every 200ms.
The job contains only this command's descendants; closing it cannot affect other
games. No fixed multi-GiB admission threshold or asset-size RAM estimate is used.
"""
import argparse
import ctypes as c
from ctypes import wintypes as w
import json
from pathlib import Path
import subprocess
import time

SIZE = c.c_size_t
CREATE_SUSPENDED = 0x00000004  # Win32 flag, not exported by subprocess
kernel = c.WinDLL("kernel32", use_last_error=True)
psapi = c.WinDLL("psapi", use_last_error=True)
ntdll = c.WinDLL("ntdll")

class BasicLimits(c.Structure):
    _fields_ = [("process_time", c.c_int64), ("job_time", c.c_int64), ("flags", w.DWORD), ("min_ws", SIZE), ("max_ws", SIZE), ("active_limit", w.DWORD), ("affinity", SIZE), ("priority", w.DWORD), ("scheduling", w.DWORD)]
class IO(c.Structure):
    _fields_ = [(name, c.c_uint64) for name in ("read_ops", "write_ops", "other_ops", "read_bytes", "write_bytes", "other_bytes")]
class ExtendedLimits(c.Structure):
    _fields_ = [("basic", BasicLimits), ("io", IO), ("process_limit", SIZE), ("job_limit", SIZE), ("peak_process_commit", SIZE), ("peak_job_commit", SIZE)]
class BasicAccounting(c.Structure):
    _fields_ = [(name, c.c_int64) for name in ("user_time", "kernel_time", "period_user_time", "period_kernel_time")] + [(name, w.DWORD) for name in ("page_faults", "total_processes", "active_processes", "limit_terminated_processes")]
class ProcessMemory(c.Structure):
    _fields_ = [("cb", w.DWORD), ("page_faults", w.DWORD)] + [(name, SIZE) for name in ("peak_ws", "ws", "quota_peak_paged", "quota_paged", "quota_peak_nonpaged", "quota_nonpaged", "pagefile", "peak_pagefile", "private")]
class Performance(c.Structure):
    _fields_ = [("cb", w.DWORD)] + [(name, SIZE) for name in ("commit", "commit_limit", "commit_peak", "physical", "available", "cache", "kernel", "kernel_paged", "kernel_nonpaged", "page_size")] + [(name, w.DWORD) for name in ("handles", "processes", "threads")]

kernel.CreateJobObjectW.argtypes = [w.LPVOID, w.LPCWSTR]; kernel.CreateJobObjectW.restype = w.HANDLE
kernel.SetInformationJobObject.argtypes = [w.HANDLE, c.c_int, w.LPVOID, w.DWORD]; kernel.SetInformationJobObject.restype = w.BOOL
kernel.QueryInformationJobObject.argtypes = [w.HANDLE, c.c_int, w.LPVOID, w.DWORD, w.LPVOID]; kernel.QueryInformationJobObject.restype = w.BOOL
kernel.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]; kernel.AssignProcessToJobObject.restype = w.BOOL
kernel.TerminateJobObject.argtypes = [w.HANDLE, w.UINT]; kernel.TerminateJobObject.restype = w.BOOL
kernel.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]; kernel.OpenProcess.restype = w.HANDLE
kernel.CloseHandle.argtypes = [w.HANDLE]; kernel.CloseHandle.restype = w.BOOL
kernel.QueryFullProcessImageNameW.argtypes = [w.HANDLE, w.DWORD, w.LPWSTR, c.POINTER(w.DWORD)]; kernel.QueryFullProcessImageNameW.restype = w.BOOL
# Popen closes CreateProcess's primary-thread handle before returning, so
# ResumeThread is unavailable here. Resume the owned, suspended process using
# its retained process handle; NTSTATUS is signed, and failures are explicit.
ntdll.NtResumeProcess.argtypes = [w.HANDLE]; ntdll.NtResumeProcess.restype = w.LONG
ntdll.RtlNtStatusToDosError.argtypes = [w.LONG]; ntdll.RtlNtStatusToDosError.restype = w.ULONG
psapi.GetProcessMemoryInfo.argtypes = [w.HANDLE, w.LPVOID, w.DWORD]; psapi.GetProcessMemoryInfo.restype = w.BOOL
psapi.GetPerformanceInfo.argtypes = [w.LPVOID, w.DWORD]; psapi.GetPerformanceInfo.restype = w.BOOL

def require(ok):
    if not ok: raise c.WinError(c.get_last_error())

def global_memory():
    info = Performance(); info.cb = c.sizeof(info)
    require(psapi.GetPerformanceInfo(c.byref(info), info.cb))
    return {"free_physical_bytes": info.available * info.page_size, "physical_bytes": info.physical * info.page_size, "committed_bytes": info.commit * info.page_size, "commit_limit_bytes": info.commit_limit * info.page_size, "commit_headroom_bytes": (info.commit_limit - info.commit) * info.page_size}

def job_memory(job):
    info = ExtendedLimits()
    require(kernel.QueryInformationJobObject(job, 9, c.byref(info), c.sizeof(info), None))
    accounting = BasicAccounting()
    require(kernel.QueryInformationJobObject(job, 1, c.byref(accounting), c.sizeof(accounting), None))
    capacity = 64
    while True:
        buffer = c.create_string_buffer(8 + c.sizeof(SIZE) * capacity)
        returned_bytes = w.DWORD()
        ok = kernel.QueryInformationJobObject(job, 3, buffer, c.sizeof(buffer), c.byref(returned_bytes))
        error = c.get_last_error() if not ok else 0
        assigned = c.cast(buffer, c.POINTER(w.DWORD))[0]
        count = c.cast(c.byref(buffer, 4), c.POINTER(w.DWORD))[0]
        if ok and assigned <= count:
            pids = list((SIZE * count).from_buffer(buffer, 8))
            break
        if not ok and error != 234:  # ERROR_MORE_DATA
            raise c.WinError(error)
        capacity = max(capacity * 2, assigned, (returned_bytes.value - 8) // c.sizeof(SIZE))
    working = private = 0
    members = []
    unreadable = 0
    for pid in pids:
        process = kernel.OpenProcess(0x1000 | 0x10, False, pid)
        if not process:
            unreadable += 1
            members.append({"pid": int(pid), "executable": None, "open_error": c.get_last_error()})
            continue
        try:
            executable = c.create_unicode_buffer(32768)
            executable_size = w.DWORD(len(executable))
            identity_ok = kernel.QueryFullProcessImageNameW(process, 0, executable, c.byref(executable_size))
            identity_error = c.get_last_error() if not identity_ok else None
            member = {"pid": int(pid), "executable": executable.value if identity_ok else None, "identity_error": identity_error}
            memory = ProcessMemory(); memory.cb = c.sizeof(memory)
            if psapi.GetProcessMemoryInfo(process, c.byref(memory), memory.cb):
                working += memory.ws; private += memory.private
                member.update({"private_bytes": memory.private, "working_set_bytes": memory.ws})
            else:
                unreadable += 1
                member["memory_error"] = c.get_last_error()
            members.append(member)
        finally:
            kernel.CloseHandle(process)
    return {"kernel_peak_job_committed_bytes": info.peak_job_commit, "kernel_peak_process_committed_bytes": info.peak_process_commit, "sampled_group_private_bytes": private, "sampled_group_working_set_bytes": working, "job_total_assigned_processes": accounting.total_processes, "job_active_processes": accounting.active_processes, "job_limit_terminated_processes": accounting.limit_terminated_processes, "job_user_time_100ns": accounting.user_time, "job_kernel_time_100ns": accounting.kernel_time, "enumerated_process_count": len(pids), "unreadable_process_count": unreadable, "members": members}

def resume_owned_process(process):
    status = ntdll.NtResumeProcess(w.HANDLE(int(process._handle)))
    if status < 0:
        raise c.WinError(ntdll.RtlNtStatusToDosError(status))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command: raise SystemExit("Expected one command after --")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    initial = global_memory()
    print(json.dumps({"admission_snapshot": initial, "command": command, "parallel_owned_jobs": 1}), flush=True)
    job = kernel.CreateJobObjectW(None, None); require(job)
    limits = ExtendedLimits(); limits.basic.flags = 0x2000  # kill ONLY owned descendants on close
    require(kernel.SetInformationJobObject(job, 9, c.byref(limits), c.sizeof(limits)))
    started = time.monotonic(); peak_ws = peak_private = peak_job = peak_process = 0
    min_free = initial["free_physical_bytes"]; min_commit = initial["commit_headroom_bytes"]
    samples = []; abort_reason = None; process = None; root_exited_at = None; descendant_cleanup = None
    observed_executables = set(); observed_processes = {}
    try:
        with args.log.open("w", encoding="utf-8") as log:
            # Assignment must precede execution: otherwise a fast launcher can
            # create an unassigned child before AssignProcessToJobObject runs.
            process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW | CREATE_SUSPENDED)
            require(kernel.AssignProcessToJobObject(job, w.HANDLE(int(process._handle))))
            resume_owned_process(process)
            while True:
                memory = job_memory(job); system = global_memory()
                peak_ws = max(peak_ws, memory["sampled_group_working_set_bytes"])
                peak_private = max(peak_private, memory["sampled_group_private_bytes"])
                peak_job = max(peak_job, memory["kernel_peak_job_committed_bytes"])
                peak_process = max(peak_process, memory["kernel_peak_process_committed_bytes"])
                min_free = min(min_free, system["free_physical_bytes"]); min_commit = min(min_commit, system["commit_headroom_bytes"])
                sample = {"elapsed_seconds": round(time.monotonic()-started, 3), **memory, **system}
                for member in memory["members"]:
                    executable = member.get("executable")
                    if executable:
                        observed_executables.add(executable)
                        key = (member["pid"], executable)
                        observed_processes.setdefault(key, {"pid": member["pid"], "executable": executable, "first_observed_seconds": sample["elapsed_seconds"]})["last_observed_seconds"] = sample["elapsed_seconds"]
                if not samples or sample["elapsed_seconds"]-samples[-1]["elapsed_seconds"] >= 1 or process.poll() is not None:
                    samples.append(sample)
                if system["commit_headroom_bytes"] < 64 * 1024 * 1024:
                    abort_reason = "Actual global committed-memory headroom fell below64MiB; stopped only this owned job"
                    require(kernel.TerminateJobObject(job, 97)); process.wait(); break
                # Memory queries may fail for a live member, or miss an exiting
                # process. Kernel accounting determines when the job is empty.
                if process.poll() is not None and memory["job_active_processes"] == 0: break
                if process.poll() is not None:
                    if root_exited_at is None: root_exited_at = time.monotonic()
                    elif time.monotonic()-root_exited_at >= 10:
                        # Chrome can launch a background updater inside its
                        # owned job. The workload is finished; bound cleanup
                        # and terminate only these owned remaining helpers.
                        descendant_cleanup={"reason":"Owned descendants remained ten seconds after workload exit",
                            "members":memory["members"],"root_exit_code":process.returncode}
                        require(kernel.TerminateJobObject(job, 98))
                time.sleep(0.2)
            code = process.wait()
        final = job_memory(job)
        peak_job = max(peak_job, final["kernel_peak_job_committed_bytes"])
        peak_process = max(peak_process, final["kernel_peak_process_committed_bytes"])
        result = {"command": command, "root_pid": process.pid, "launch_mode": "CREATE_SUSPENDED, assign owned job, checked NtResumeProcess", "exit_code": code, "elapsed_seconds": round(time.monotonic()-started, 3), "admission_snapshot": initial, "kernel_peak_job_committed_bytes": peak_job, "kernel_peak_process_committed_bytes": peak_process, "sampled_peak_group_private_bytes": peak_private, "sampled_peak_group_working_set_bytes": peak_ws, "job_total_assigned_processes": final["job_total_assigned_processes"], "job_active_processes_at_finish": final["job_active_processes"], "job_limit_terminated_processes": final["job_limit_terminated_processes"], "job_user_time_100ns": final["job_user_time_100ns"], "job_kernel_time_100ns": final["job_kernel_time_100ns"], "observed_executables": sorted(observed_executables), "observed_processes": list(observed_processes.values()), "executable_observation_interval_seconds": 0.2, "executable_history_complete": False, "minimum_free_physical_bytes": min_free, "minimum_commit_headroom_bytes": min_commit, "abort_reason": abort_reason, "sample_interval_seconds":0.2, "other_games_affected":False, "samples":samples}
        result["owned_descendant_cleanup"]=descendant_cleanup
        args.report.write_text(json.dumps(result, indent=2)+"\n", encoding="utf-8")
        print(json.dumps({key:value for key,value in result.items() if key not in {"samples","observed_processes"}}), flush=True)
        raise SystemExit(code)
    finally:
        # If assignment or resume failed, the root can still be suspended and
        # outside the owned job. Do not leave that process behind on failure.
        if process is not None and process.poll() is None:
            process.terminate()
            process.wait()
        kernel.CloseHandle(job)

if __name__ == "__main__": main()
