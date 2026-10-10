"""Run the explicitly released four-stage window in one bounded Windows job at a time.

No shell, network, cache regeneration or process-name based termination.
Each root is created suspended, identity-pinned, assigned to a fresh owned job,
then resumed. Job membership and process creation times are recorded.
"""
from pathlib import Path
import argparse
import ctypes as c
from ctypes import wintypes as w
import hashlib
import json
import os
import struct
import subprocess
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PLAN_PATH = HERE / "build-plan/consumer-build-plan.json"
PLAN = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
KERNEL = c.WinDLL("kernel32", use_last_error=True)
PSAPI = c.WinDLL("psapi", use_last_error=True)


class Physical(c.Structure):
    _fields_ = [("length", w.DWORD), ("load", w.DWORD)] + [(name, c.c_ulonglong) for name in
        ["total", "available", "total_page", "available_page", "total_virtual", "available_virtual", "extended"]]


class Performance(c.Structure):
    _fields_ = [("cb", w.DWORD)] + [(name, c.c_size_t) for name in
        ["commit_total", "commit_limit", "commit_peak", "physical_total", "physical_available", "system_cache", "kernel_total", "kernel_paged", "kernel_nonpaged", "page_size"]] + [(name, w.DWORD) for name in ["handles", "processes", "threads"]]


class BasicLimits(c.Structure):
    _fields_ = [("per_process_user", c.c_longlong), ("per_job_user", c.c_longlong), ("flags", w.DWORD),
        ("minimum_ws", c.c_size_t), ("maximum_ws", c.c_size_t), ("active_limit", w.DWORD),
        ("affinity", c.c_size_t), ("priority", w.DWORD), ("scheduling", w.DWORD)]


class IO(c.Structure):
    _fields_ = [(name, c.c_ulonglong) for name in ["read_ops", "write_ops", "other_ops", "read_bytes", "write_bytes", "other_bytes"]]


class ExtendedLimits(c.Structure):
    _fields_ = [("basic", BasicLimits), ("io", IO)] + [(name, c.c_size_t) for name in
        ["process_memory_limit", "job_memory_limit", "peak_process_memory", "peak_job_memory"]]


class Memory(c.Structure):
    _fields_ = [("cb", w.DWORD), ("page_faults", w.DWORD)] + [(name, c.c_size_t) for name in
        ["peak_ws", "working_set", "peak_paged_pool", "paged_pool", "peak_nonpaged_pool", "nonpaged_pool", "pagefile", "peak_pagefile", "private"]]


class ThreadEntry(c.Structure):
    _fields_ = [("size", w.DWORD), ("usage", w.DWORD), ("thread_id", w.DWORD), ("owner_pid", w.DWORD),
                ("base_priority", w.LONG), ("delta_priority", w.LONG), ("flags", w.DWORD)]


def configure(api, args, result=w.BOOL):
    api.argtypes, api.restype = args, result
    return api


configure(KERNEL.GlobalMemoryStatusEx, [c.POINTER(Physical)])
configure(PSAPI.GetPerformanceInfo, [c.POINTER(Performance), w.DWORD])
configure(KERNEL.CreateJobObjectW, [w.LPVOID, w.LPCWSTR], w.HANDLE)
configure(KERNEL.SetInformationJobObject, [w.HANDLE, c.c_int, w.LPVOID, w.DWORD])
configure(KERNEL.QueryInformationJobObject, [w.HANDLE, c.c_int, w.LPVOID, w.DWORD, c.POINTER(w.DWORD)])
configure(KERNEL.AssignProcessToJobObject, [w.HANDLE, w.HANDLE])
configure(KERNEL.TerminateJobObject, [w.HANDLE, w.UINT])
configure(KERNEL.CloseHandle, [w.HANDLE])
configure(KERNEL.OpenProcess, [w.DWORD, w.BOOL, w.DWORD], w.HANDLE)
configure(KERNEL.GetProcessTimes, [w.HANDLE] + [c.POINTER(w.FILETIME)] * 4)
configure(PSAPI.GetProcessMemoryInfo, [w.HANDLE, c.POINTER(Memory), w.DWORD])
configure(KERNEL.CreateToolhelp32Snapshot, [w.DWORD, w.DWORD], w.HANDLE)
configure(KERNEL.Thread32First, [w.HANDLE, c.POINTER(ThreadEntry)])
configure(KERNEL.Thread32Next, [w.HANDLE, c.POINTER(ThreadEntry)])
configure(KERNEL.OpenThread, [w.DWORD, w.BOOL, w.DWORD], w.HANDLE)
configure(KERNEL.ResumeThread, [w.HANDLE], w.DWORD)


def checked(value, message):
    if not value:
        raise OSError(c.get_last_error(), message)
    return value


def counters():
    physical = Physical(length=c.sizeof(Physical))
    performance = Performance(cb=c.sizeof(Performance))
    checked(KERNEL.GlobalMemoryStatusEx(c.byref(physical)), "physical counter failed")
    checked(PSAPI.GetPerformanceInfo(c.byref(performance), c.sizeof(performance)), "exact commit counter failed")
    assert performance.commit_limit >= performance.commit_total and performance.page_size > 0
    return {"physicalFreeBytes": physical.available,
            "exactCommitHeadroomBytes": (performance.commit_limit - performance.commit_total) * performance.page_size,
            "counter": "GlobalMemoryStatusEx + GetPerformanceInfo exact committed/limit pages"}


def identity(handle):
    created, exited, kernel, user = (w.FILETIME() for _ in range(4))
    checked(KERNEL.GetProcessTimes(handle, c.byref(created), c.byref(exited), c.byref(kernel), c.byref(user)), "creation identity failed")
    return (created.dwHighDateTime << 32) | created.dwLowDateTime


def members(job):
    buffer = c.create_string_buffer(65536)
    checked(KERNEL.QueryInformationJobObject(job, 3, buffer, len(buffer), None), "owned job membership query failed")
    assigned, listed = struct.unpack_from("II", buffer.raw)
    assert assigned == listed and listed < 4096
    return [struct.unpack_from("Q", buffer.raw, 8 + i * 8)[0] for i in range(listed)]


def resume_root(pid):
    snapshot = KERNEL.CreateToolhelp32Snapshot(4, 0)
    assert snapshot and snapshot != c.c_void_p(-1).value
    try:
        entry = ThreadEntry(size=c.sizeof(ThreadEntry))
        found = []
        valid = KERNEL.Thread32First(snapshot, c.byref(entry))
        while valid:
            if entry.owner_pid == pid:
                found.append(entry.thread_id)
            valid = KERNEL.Thread32Next(snapshot, c.byref(entry))
        assert len(found) == 1, "suspended owned root must have exactly one initial thread"
        thread = checked(KERNEL.OpenThread(2, False, found[0]), "cannot open owned suspended thread")
        try:
            assert KERNEL.ResumeThread(thread) == 1, "unexpected owned thread suspend count"
        finally:
            KERNEL.CloseHandle(thread)
    finally:
        KERNEL.CloseHandle(snapshot)


def run_stage(command, result_directory):
    name = command["stage"]
    gate = counters()
    assert gate["physicalFreeBytes"] >= PLAN["launchGate"]["minimumPhysicalFreeBytes"], "fresh physical gate failed"
    assert gate["exactCommitHeadroomBytes"] >= PLAN["launchGate"]["minimumExactCommitHeadroomBytes"], "fresh exact commit gate failed"
    job = checked(KERNEL.CreateJobObjectW(None, None), "cannot create isolated owned job")
    limits = ExtendedLimits()
    limits.basic.flags = 0x2000 | 0x200  # Kill only this owned job on handle close; hard job-memory cap.
    limits.job_memory_limit = PLAN["ownedResourceGuard"]["maximumOwnedTreePrivateBytes"]
    checked(KERNEL.SetInformationJobObject(job, 9, c.byref(limits), c.sizeof(limits)), "cannot enforce owned job cap")
    environment = dict(os.environ)
    for key in PLAN["removeInheritedEnvironment"]:
        environment.pop(key, None)
    environment.update(PLAN["rustEnvironment"])
    environment.update(command.get("environment", {}))
    arguments = [command["executable"], *command["argv"]]
    if name == "native-cpp-selector-fixture-build":
        arguments.insert(2, "-v")  # Record installed compiler/linker/cache selections.
        Path(command["argv"][-1]).parent.mkdir(parents=True, exist_ok=True)
    data = {"stage": name, "argv": arguments, "cwd": command["cwd"], "freshGate": gate,
            "environmentOverrides": {**PLAN["rustEnvironment"], **command.get("environment", {})},
            "removedInheritedEnvironment": PLAN["removeInheritedEnvironment"], "ownership": "suspended root assigned to a new Windows job before resume; only job members monitored/terminated", "samples": [], "identities": []}
    process = None
    assigned = False
    observed = {}
    start = time.monotonic()
    failure = None
    try:
        with (result_directory / (name + ".stdout.log")).open("wb") as stdout, (result_directory / (name + ".stderr.log")).open("wb") as stderr:
            process = subprocess.Popen(arguments, cwd=command["cwd"], env=environment, stdin=subprocess.DEVNULL,
                stdout=stdout, stderr=stderr, creationflags=0x08000000 | 0x4)
            root_handle = w.HANDLE(int(process._handle))
            root_created = identity(root_handle)
            data["rootIdentity"] = {"pid": process.pid, "creationFiletime": root_created}
            checked(KERNEL.AssignProcessToJobObject(job, root_handle), "cannot assign suspended owned root to job")
            assigned = True
            assert members(job) == [process.pid]
            resume_root(process.pid)
            while True:
                physical_commit = counters()
                private = working_set = 0
                for pid in members(job):
                    handle = KERNEL.OpenProcess(0x410, False, pid)
                    if not handle:
                        # A job member can exit between membership/open; re-query.
                        assert pid not in members(job), "live owned member memory handle failed"
                        continue
                    try:
                        created = identity(handle)
                        assert pid not in observed or observed[pid] == created, "owned PID creation identity changed"
                        observed[pid] = created
                        memory = Memory(cb=c.sizeof(Memory))
                        if not PSAPI.GetProcessMemoryInfo(handle, c.byref(memory), c.sizeof(memory)):
                            assert pid not in members(job), "live owned member memory query failed"
                            continue
                        private += memory.private
                        working_set += memory.working_set
                    finally:
                        KERNEL.CloseHandle(handle)
                sample = {"elapsedSeconds": round(time.monotonic() - start, 3), **physical_commit,
                          "ownedPrivateBytes": private, "ownedWorkingSetBytes": working_set}
                data["samples"].append(sample)
                assert private <= PLAN["ownedResourceGuard"]["maximumOwnedTreePrivateBytes"], "owned private cap exceeded"
                assert working_set <= PLAN["ownedResourceGuard"]["maximumOwnedTreeWorkingSetBytes"], "owned working-set cap exceeded"
                assert physical_commit["physicalFreeBytes"] >= PLAN["ownedResourceGuard"]["minimumPhysicalFreeBytes"], "physical running floor breached"
                assert physical_commit["exactCommitHeadroomBytes"] >= PLAN["ownedResourceGuard"]["minimumExactCommitHeadroomBytes"], "exact commit running floor breached"
                assert time.monotonic() - start <= PLAN["ownedResourceGuard"]["maximumStageSeconds"], "bounded stage timed out"
                if process.poll() is not None and not members(job):
                    break
                time.sleep(0.25)
            data["exitCode"] = process.returncode
            assert process.returncode == 0, f"stage returned {process.returncode}; inspect owned logs"
    except BaseException as error:
        failure = repr(error)
        data["failure"] = failure
        if assigned:
            checked(KERNEL.TerminateJobObject(job, 97), "owned job termination failed")
        elif process is not None:
            assert identity(w.HANDLE(int(process._handle))) == data["rootIdentity"]["creationFiletime"]
            process.kill()  # Only the suspended, handle-pinned unassigned owned root.
        if process is not None:
            process.wait(timeout=10)
    finally:
        if assigned:
            data["remainingOwnedPidsBeforeJobClose"] = members(job)
            state = ExtendedLimits()
            checked(KERNEL.QueryInformationJobObject(job, 9, c.byref(state), c.sizeof(state), None), "owned peak query failed")
            data["jobPeakPrivateBytes"] = state.peak_job_memory
        KERNEL.CloseHandle(job)
        data["identities"] = [{"pid": pid, "creationFiletime": created} for pid, created in sorted(observed.items())]
        data["durationSeconds"] = round(time.monotonic() - start, 3)
        data["passed"] = failure is None
        (result_directory / (name + ".json")).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    if failure:
        raise RuntimeError(f"{name}: {failure}")
    print(json.dumps({"stage": name, "passed": True, "durationSeconds": data["durationSeconds"], "jobPeakPrivateBytes": data["jobPeakPrivateBytes"]}), flush=True)
    return data


def fingerprints():
    paths = [PLAN_PATH, HERE / "build-plan/dependency-source-audit.json", ROOT / "rust-contracts/Cargo.lock",
             ROOT / "rust-contracts/logic/src/lib.rs", ROOT / "rust-contracts/presentation/src/lib.rs",
             ROOT / "ja-current/en.json", ROOT / "ja-current/ja.json",
             Path(PLAN["nativeFrozenConfig"]["cache"]) / "sanity.txt", Path(PLAN["nativeFrozenConfig"]["file"])]
    for directory in ["semantic-runtime-catalog", "semantic-plural-slice"]:
        paths.extend(sorted((ROOT / directory / "rust-verification").rglob("*.rs")))
        paths.extend([ROOT / directory / "rust-verification/Cargo.toml", ROOT / directory / "rust-verification/Cargo.lock",
                      ROOT / directory / "output/en.json", ROOT / directory / "output/ja.json"])
    paths.append(ROOT / "semantic-plural-slice/native-selector-fixtures.cpp")
    return {str(item): hashlib.sha256(item.read_bytes()).hexdigest() for item in paths if "target" not in item.parts}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--parent-released-window", action="store_true", required=True)
    parser.add_argument("--start-stage", choices=[item["stage"] for item in PLAN["commands"]])
    parser.add_argument("--attempt-name", default="initial")
    options = parser.parse_args()
    assert options.parent_released_window
    assert options.attempt_name.isascii() and all(ch.isalnum() or ch in "-_" for ch in options.attempt_name)
    destination = HERE / "build-plan/execution"
    if options.attempt_name != "initial":
        destination /= options.attempt_name
    destination.mkdir(parents=True, exist_ok=True)
    before = fingerprints()
    (destination / "input-fingerprints-before.json").write_text(json.dumps(before, indent=2) + "\n", encoding="utf-8")
    results = []
    commands = PLAN["commands"]
    if options.start_stage:
        start_index = next(i for i, item in enumerate(commands) if item["stage"] == options.start_stage)
        commands = commands[start_index:]
    terminal = {"parentWindowExplicitlyReleased": True, "wholeGameConsumption": False,
                "selectedStages": [item["stage"] for item in commands]}
    try:
        for command in commands:
            results.append(run_stage(command, destination))
        after = fingerprints()
        assert before == after, "source/catalog/lock/frozen-cache-sanity fingerprints changed"
        selected = {item["stage"] for item in results}
        terminal.update(status="passed", stagesPassed=len(results),
                        literalRustIntegrationTests=7 if "catalog-genuine-rust-consumer" in selected else None,
                        pluralRustIntegrationTests=5 if "plural-genuine-rust-consumer" in selected else None,
                        standaloneCppFixturePassed="native-cpp-selector-fixture-node-execution" in selected,
                        originalCppProducerConnected=False, browserExecuted=False)
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-stage", failure=repr(error), stagesPassed=len(results))
        raise
    finally:
        (destination / "input-fingerprints-after.json").write_text(json.dumps(fingerprints(), indent=2) + "\n", encoding="utf-8")
        (destination / "terminal.json").write_text(json.dumps(terminal, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
