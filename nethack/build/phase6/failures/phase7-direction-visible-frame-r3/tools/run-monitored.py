"""Run one owned Windows process tree with kernel-accounted job memory peaks.

Added 2026-10-02; distributed under the NGPL. Creates no global settings and
records only the selected command/resource options, never the environment.
"""
from __future__ import annotations
import argparse
import ctypes as c
from ctypes import wintypes as w
import datetime
import json
import msvcrt
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
SIZE = c.c_size_t
kernel = c.WinDLL("kernel32", use_last_error=True)
psapi = c.WinDLL("psapi", use_last_error=True)


class BASIC_LIMIT(c.Structure):
    _fields_ = [("PerProcessUserTimeLimit", c.c_longlong), ("PerJobUserTimeLimit", c.c_longlong),
                ("LimitFlags", w.DWORD), ("MinimumWorkingSetSize", SIZE),
                ("MaximumWorkingSetSize", SIZE), ("ActiveProcessLimit", w.DWORD),
                ("Affinity", SIZE), ("PriorityClass", w.DWORD), ("SchedulingClass", w.DWORD)]


class IO_COUNTERS(c.Structure):
    _fields_ = [(name, c.c_ulonglong) for name in
                ("ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
                 "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]


class EXTENDED_LIMIT(c.Structure):
    _fields_ = [("BasicLimitInformation", BASIC_LIMIT), ("IoInfo", IO_COUNTERS),
                ("ProcessMemoryLimit", SIZE), ("JobMemoryLimit", SIZE),
                ("PeakProcessMemoryUsed", SIZE), ("PeakJobMemoryUsed", SIZE)]


class PERF_INFO(c.Structure):
    _fields_ = [("cb", w.DWORD)] + [(name, SIZE) for name in
                ("CommitTotal", "CommitLimit", "CommitPeak", "PhysicalTotal", "PhysicalAvailable",
                 "SystemCache", "KernelTotal", "KernelPaged", "KernelNonpaged", "PageSize")] + [
                 (name, w.DWORD) for name in ("HandleCount", "ProcessCount", "ThreadCount")]


class STARTUP_INFO(c.Structure):
    _fields_ = [("cb", w.DWORD), ("lpReserved", w.LPWSTR), ("lpDesktop", w.LPWSTR),
                ("lpTitle", w.LPWSTR), ("dwX", w.DWORD), ("dwY", w.DWORD),
                ("dwXSize", w.DWORD), ("dwYSize", w.DWORD), ("dwXCountChars", w.DWORD),
                ("dwYCountChars", w.DWORD), ("dwFillAttribute", w.DWORD), ("dwFlags", w.DWORD),
                ("wShowWindow", w.WORD), ("cbReserved2", w.WORD), ("lpReserved2", c.c_void_p),
                ("hStdInput", w.HANDLE), ("hStdOutput", w.HANDLE), ("hStdError", w.HANDLE)]


class PROCESS_INFO(c.Structure):
    _fields_ = [("hProcess", w.HANDLE), ("hThread", w.HANDLE),
                ("dwProcessId", w.DWORD), ("dwThreadId", w.DWORD)]


class MEMORY_COUNTERS(c.Structure):
    _fields_ = [("cb", w.DWORD), ("PageFaultCount", w.DWORD)] + [(name, SIZE) for name in
                ("PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage", "QuotaPagedPoolUsage",
                 "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]


kernel.CreateJobObjectW.argtypes = [c.c_void_p, w.LPCWSTR]
kernel.CreateJobObjectW.restype = w.HANDLE
kernel.SetInformationJobObject.argtypes = [w.HANDLE, c.c_int, c.c_void_p, w.DWORD]
kernel.QueryInformationJobObject.argtypes = [w.HANDLE, c.c_int, c.c_void_p, w.DWORD, c.c_void_p]
kernel.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]
kernel.CreateProcessW.argtypes = [w.LPCWSTR, w.LPWSTR, c.c_void_p, c.c_void_p, w.BOOL, w.DWORD,
                                c.c_void_p, w.LPCWSTR, c.POINTER(STARTUP_INFO), c.POINTER(PROCESS_INFO)]
kernel.ResumeThread.argtypes = [w.HANDLE]
kernel.ResumeThread.restype = w.DWORD
kernel.WaitForSingleObject.argtypes = [w.HANDLE, w.DWORD]
kernel.WaitForSingleObject.restype = w.DWORD
kernel.GetExitCodeProcess.argtypes = [w.HANDLE, c.POINTER(w.DWORD)]
kernel.CloseHandle.argtypes = [w.HANDLE]
kernel.TerminateProcess.argtypes = [w.HANDLE, w.UINT]
kernel.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
kernel.OpenProcess.restype = w.HANDLE
psapi.GetPerformanceInfo.argtypes = [c.POINTER(PERF_INFO), w.DWORD]
psapi.GetProcessMemoryInfo.argtypes = [w.HANDLE, c.POINTER(MEMORY_COUNTERS), w.DWORD]


def check(result):
    if not result:
        raise c.WinError(c.get_last_error())
    return result


def headroom() -> dict:
    info = PERF_INFO()
    info.cb = c.sizeof(info)
    check(psapi.GetPerformanceInfo(c.byref(info), info.cb))
    page = info.PageSize
    return {"physical_available_bytes": info.PhysicalAvailable * page,
            "commit_available_bytes": (info.CommitLimit - info.CommitTotal) * page,
            "system_commit_bytes": info.CommitTotal * page, "commit_limit_bytes": info.CommitLimit * page}


def working_set(job) -> tuple[int, int]:
    # Bounded owned PID inventory. Exited processes may disappear before sampling.
    storage = c.create_string_buffer(8 + c.sizeof(SIZE) * 256)
    check(kernel.QueryInformationJobObject(job, 3, storage, c.sizeof(storage), None))
    assigned, count = (w.DWORD * 2).from_buffer(storage)
    if assigned > 256 or count > 256:
        raise RuntimeError("Owned process tree exceeds monitored PID bound")
    pids = (SIZE * count).from_buffer(storage, 8)
    total = 0
    for pid in pids:
        process = kernel.OpenProcess(0x1000 | 0x0010, False, int(pid))
        if not process:
            continue
        try:
            info = MEMORY_COUNTERS()
            info.cb = c.sizeof(info)
            if psapi.GetProcessMemoryInfo(process, c.byref(info), info.cb):
                total += info.WorkingSetSize
        finally:
            kernel.CloseHandle(process)
    return total, int(count)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cwd", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--minimum-free-gib", type=float, default=2.0)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command: parser.error("An explicit executable/argument vector is required")
    task_cwd = args.cwd.resolve(strict=True)
    if not task_cwd.is_relative_to(ROOT): parser.error("cwd must remain in the owned NetHack tree")
    for destination in (args.report, args.log):
        if not destination.resolve().is_relative_to(ROOT): parser.error("Outputs must remain in NetHack")
        destination.parent.mkdir(parents=True, exist_ok=True)
    initial = headroom()
    required = int(args.minimum_free_gib * 1024**3)
    if min(initial["physical_available_bytes"], initial["commit_available_bytes"]) < required:
        print(json.dumps({"status": "not_started_insufficient_headroom", "required_bytes": required,
                          "fresh_headroom": initial}))
        return 75
    job = check(kernel.CreateJobObjectW(None, None))
    process = PROCESS_INFO()
    started = time.monotonic()
    peak_ws = samples = peak_count = 0
    minimum = initial.copy()
    try:
        limits = EXTENDED_LIMIT()
        limits.BasicLimitInformation.LimitFlags = 0x2000  # KILL_ON_JOB_CLOSE, owned tree only.
        check(kernel.SetInformationJobObject(job, 9, c.byref(limits), c.sizeof(limits)))
        with args.log.open("wb") as log, open("NUL", "rb") as null:
            os.set_inheritable(log.fileno(), True)
            os.set_inheritable(null.fileno(), True)
            startup = STARTUP_INFO()
            startup.cb = c.sizeof(startup)
            startup.dwFlags = 0x101  # explicit stdin/log and hidden window
            startup.hStdInput = msvcrt.get_osfhandle(null.fileno())
            startup.hStdOutput = startup.hStdError = msvcrt.get_osfhandle(log.fileno())
            line = c.create_unicode_buffer(subprocess.list2cmdline(command))
            check(kernel.CreateProcessW(command[0], line, None, None, True, 0x08000004,
                                        None, str(task_cwd), c.byref(startup), c.byref(process)))
            # Suspended launch guarantees all descendants belong to this job from inception.
            if not kernel.AssignProcessToJobObject(job, process.hProcess):
                kernel.TerminateProcess(process.hProcess, 76)
                raise c.WinError(c.get_last_error())
            if kernel.ResumeThread(process.hThread) == 0xFFFFFFFF:
                raise c.WinError(c.get_last_error())
            while True:
                available = headroom()
                for key in ("physical_available_bytes", "commit_available_bytes"):
                    minimum[key] = min(minimum[key], available[key])
                ws, count = working_set(job)
                peak_ws, peak_count = max(peak_ws, ws), max(peak_count, count)
                samples += 1
                waited = kernel.WaitForSingleObject(process.hProcess, 100)
                if waited == 0: break
                if waited != 258: raise c.WinError(c.get_last_error())
            exit_code = w.DWORD()
            check(kernel.GetExitCodeProcess(process.hProcess, c.byref(exit_code)))
            check(kernel.QueryInformationJobObject(job, 9, c.byref(limits), c.sizeof(limits), None))
            _, remaining = working_set(job)
        report = {"schema_version": 1, "recorded_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  "command": command, "cwd": str(task_cwd), "exit_code": exit_code.value,
                  "duration_seconds": round(time.monotonic() - started, 3),
                  "fresh_headroom": initial, "minimum_sampled_headroom": minimum,
                  "kernel_accounted_job_peak_commit_bytes": limits.PeakJobMemoryUsed,
                  "kernel_accounted_largest_process_peak_commit_bytes": limits.PeakProcessMemoryUsed,
                  "sampled_process_tree_peak_working_set_bytes": peak_ws,
                  "sample_interval_ms": 100, "samples": samples, "peak_sampled_owned_process_count": peak_count,
                  "owned_processes_remaining_before_close": remaining,
                  "memory_method": "Suspended launch into Windows Job Object; kernel job peaks + 100ms WS/headroom samples",
                  "resource_options": {key: os.environ.get(key) for key in
                                       ("CARGO_BUILD_JOBS", "CARGO_PROFILE_DEV_CODEGEN_UNITS", "CARGO_PROFILE_TEST_CODEGEN_UNITS")},
                  "reference": "https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information"}
        args.report.write_text(json.dumps(report, indent=2) + "\n", "utf-8")
        print(json.dumps(report))
        return int(exit_code.value)
    finally:
        for handle in (process.hThread, process.hProcess, job):
            if handle: kernel.CloseHandle(handle)


if __name__ == "__main__":
    raise SystemExit(main())
