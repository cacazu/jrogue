"""Run one explicitly reserved parser stage with the exact exercised job guard.

This wrapper keeps the shared helper untouched. It fixes cleanup gaps by recording
new jobs and returned suspended roots immediately, before the helper's queries.
Only those owned handles are eligible for outer-finally teardown.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import struct
import subprocess
import sys
import types

HERE = Path(__file__).resolve().parent
PLAN_PATH = HERE / "build-plan/parser-build-plan.json"
GUARD_SHA256 = "ae54cce5dbbe2e769d52572528f750b0573ef37fb172cc29db8ab8fa8208a8c3"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    state = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return state.hexdigest()


def validate_pins(records):
    for record in records:
        path = Path(record["path"])
        require(path.stat().st_size == record["bytes"] and digest(path) == record["sha256"],
                "pinned file changed: " + str(path))


def fingerprints(plan):
    return {record["relative"]: digest(record["path"]) for record in plan["inputs"]}


def load_guard(plan):
    guard_path = Path(plan["guard"]["path"])
    source = guard_path.read_bytes()
    require(hashlib.sha256(source).hexdigest() == GUARD_SHA256, "exact exercised guard bytes changed")
    module = types.ModuleType("cdda_parser_private_owned_job_guard")
    module.__file__ = str(guard_path)
    # Explicit optimize=0 also retains the helper's resource assertions.
    exec(compile(source, str(guard_path), "exec", dont_inherit=True, optimize=0), module.__dict__)
    module.PLAN = plan
    return module


def handle_number(handle):
    return int(handle.value if hasattr(handle, "value") else handle)


def run_owned(guard, command, destination):
    """Reuse run_stage, with an unconditional outer owner around all setup paths."""
    kernel = guard.KERNEL
    original_create = kernel.CreateJobObjectW
    original_assign = kernel.AssignProcessToJobObject
    original_close = kernel.CloseHandle
    original_subprocess = guard.subprocess
    jobs = {}
    roots = {}
    cleanup = {"jobsCreated": [], "rootsCreated": [], "outerActions": [], "errors": []}
    result = None
    failure = None

    def create_job(*arguments):
        handle = original_create(*arguments)
        if handle:
            number = handle_number(handle)
            require(number not in jobs, "new job collided with still-owned job handle")
            jobs[number] = handle
            cleanup["jobsCreated"].append(number)
        return handle

    def close_handle(handle):
        number = handle_number(handle)
        success = original_close(handle)
        if success:
            jobs.pop(number, None)
        return success

    def create_root(*arguments, **keywords):
        require(keywords.get("creationflags") == 0x08000000 | 0x4,
                "root must be hidden and created suspended")
        require(arguments[0] == [command["executable"], *command["argv"]], "unexpected root command")
        process = subprocess.Popen(*arguments, **keywords)
        number = int(process._handle)
        require(number not in roots, "returned owned process handle collided")
        roots[number] = {"process": process, "job": None}
        cleanup["rootsCreated"].append({"pid": process.pid, "processHandle": number,
                                        "ownership": "exact handle returned by owned suspended Popen"})
        return process

    def assign_job(job, process_handle):
        job_number, root_number = handle_number(job), handle_number(process_handle)
        require(job_number in jobs and root_number in roots, "assignment involved an unowned handle")
        success = original_assign(job, process_handle)
        if success:
            roots[root_number]["job"] = job_number
        return success

    kernel.CreateJobObjectW = create_job
    kernel.AssignProcessToJobObject = assign_job
    kernel.CloseHandle = close_handle
    # Keep monkey-patching private to this loaded module, not global subprocess.
    guard.subprocess = types.SimpleNamespace(Popen=create_root, DEVNULL=subprocess.DEVNULL)
    try:
        result = guard.run_stage(command, destination)
    except BaseException as error:
        failure = repr(error)
    finally:
        # Track successful inner closes to avoid double-closing a reused handle.
        for number, handle in list(jobs.items()):
            try:
                assigned = any(root["job"] == number for root in roots.values())
                if assigned:
                    success = kernel.TerminateJobObject(handle, 97)
                    cleanup["outerActions"].append({"jobHandle": number, "action": "terminate-owned-job", "success": bool(success)})
                    if not success:
                        cleanup["errors"].append("owned job termination API failed")
            except BaseException as error:
                cleanup["errors"].append("owned job termination: " + repr(error))
            finally:
                try:
                    success = original_close(handle)
                    cleanup["outerActions"].append({"jobHandle": number, "action": "close-owned-job", "success": bool(success)})
                    if success:
                        jobs.pop(number, None)
                    else:
                        cleanup["errors"].append("owned job handle close failed")
                except BaseException as error:
                    cleanup["errors"].append("owned job close: " + repr(error))
        for number, root in roots.items():
            process = root["process"]
            try:
                if root["job"] is None and process.poll() is None:
                    # Never resumed: assignment precedes resume in pinned helper.
                    # kill uses this Popen's exact process handle, not a reused PID.
                    process.kill()
                    cleanup["outerActions"].append({"processHandle": number, "action": "kill-owned-unassigned-suspended-root"})
                process.wait(timeout=10)
            except BaseException as error:
                cleanup["errors"].append("owned root wait/cleanup: " + repr(error))
            finally:
                try:
                    # Explicitly retire the retained Popen process handle after
                    # waiting; do not leave it to delayed Python collection.
                    process._handle.Close()
                    cleanup["outerActions"].append({"processHandle": number, "action": "close-owned-process-handle"})
                except BaseException as error:
                    cleanup["errors"].append("owned process handle close: " + repr(error))
        kernel.CreateJobObjectW = original_create
        kernel.AssignProcessToJobObject = original_assign
        kernel.CloseHandle = original_close
        guard.subprocess = original_subprocess
        cleanup["remainingOwnedJobHandles"] = sorted(jobs)
        cleanup["passed"] = not cleanup["errors"] and not jobs
        (destination / (command["stage"] + ".outer-cleanup.json")).write_text(
            json.dumps(cleanup, indent=2) + "\n", encoding="utf-8")
    require(cleanup["passed"], "outer owned-handle cleanup failed; inspect evidence")
    require(failure is None, "guarded stage failed: " + str(failure))
    return result


def verify_test_output(command, destination, expected):
    stdout = (destination / (command["stage"] + ".stdout.log")).read_text(encoding="utf-8", errors="strict")
    actual = re.findall(r"^test (tests::[a-z_]+) \.\.\. ok$", stdout, flags=re.MULTILINE)
    require(sorted(actual) == sorted(expected), "exact five expected parser tests did not pass")
    require(re.search(r"test result: ok\. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out;", stdout) is not None,
            "exact five-test summary missing")
    return actual


def main():
    require(__debug__, "optimized Python would disable inherited guard assertions")
    require(sys.platform == "win32" and struct.calcsize("P") == 8,
            "the exercised job member ABI requires 64-bit Windows Python")
    parser = argparse.ArgumentParser()
    parser.add_argument("--parent-released-window", action="store_true", required=True)
    parser.add_argument("--plan-sha256", required=True)
    parser.add_argument("--stage", choices=["rust-parser-native-tests", "rust-parser-format-check", "rust-parser-clippy-check"],
                        default="rust-parser-native-tests")
    parser.add_argument("--attempt-name", required=True)
    options = parser.parse_args()
    require(options.parent_released_window, "explicit parent reservation missing")
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name) is not None, "invalid fresh attempt directory")
    plan_bytes = PLAN_PATH.read_bytes()
    require(re.fullmatch(r"[a-f0-9]{64}", options.plan_sha256) is not None and
            hashlib.sha256(plan_bytes).hexdigest() == options.plan_sha256,
            "reviewed parent plan hash mismatch")
    plan = json.loads(plan_bytes)
    require(plan["guard"]["sha256"] == GUARD_SHA256, "guard plan pin mismatch")
    require(plan["launchGate"]["minimumPhysicalFreeBytes"] == 4 * 1024**3 and
            plan["launchGate"]["minimumExactCommitHeadroomBytes"] == 6 * 1024**3, "launch threshold changed")
    require(plan["ownedResourceGuard"]["maximumOwnedTreePrivateBytes"] == 1024**3 and
            plan["ownedResourceGuard"]["maximumOwnedTreeWorkingSetBytes"] == 1024**3 and
            plan["ownedResourceGuard"]["minimumPhysicalFreeBytes"] == 2 * 1024**3 and
            plan["ownedResourceGuard"]["minimumExactCommitHeadroomBytes"] == 2 * 1024**3 and
            plan["ownedResourceGuard"]["maximumStageSeconds"] == 180, "owned guard threshold changed")
    commands = [item for item in plan["commands"] if item["stage"] == options.stage]
    require(len(commands) == 1, "unique explicitly selected stage required")
    command = commands[0]
    require(not command.get("environment"), "stage cannot override bounded environment")
    require(plan["rustEnvironment"]["CARGO_BUILD_JOBS"] == "1" and
            plan["rustEnvironment"]["RUST_TEST_THREADS"] == "1" and
            plan["rustEnvironment"]["CARGO_NET_OFFLINE"] == "true", "bounded Rust environment changed")
    require(command["executable"] == plan["installedTools"]["cargo"]["path"], "Cargo executable changed")
    if options.stage != "rust-parser-format-check":
        require("--offline" in command["argv"] and "--locked" in command["argv"] and
                command["argv"][command["argv"].index("--jobs") + 1] == "1", "Cargo must stay offline/locked/job1")
    if options.stage == "rust-parser-native-tests":
        require(command["argv"][-2:] == ["--", "--test-threads=1"] and "--lib" in command["argv"], "single-thread lib tests required")
    validate_pins(plan["inputs"])
    validate_pins(plan["installedTools"].values())
    validate_pins([plan["guard"], plan["originalGuardPlan"], *plan["exercisedEvidence"]])
    for directory in plan["inspectedAncestorCargoConfigDirectories"]:
        require(not (Path(directory) / ".cargo/config").exists() and
                not (Path(directory) / ".cargo/config.toml").exists(), "new ancestor Cargo configuration appeared")
    guard = load_guard(plan)
    destination = Path(plan["outputs"]["executionDirectory"]) / options.attempt_name
    destination.mkdir(parents=True, exist_ok=False)
    before = fingerprints(plan)
    (destination / "input-fingerprints-before.json").write_text(json.dumps(before, indent=2) + "\n", encoding="utf-8")
    terminal = {"parentWindowExplicitlyReleased": True, "stage": options.stage,
                "planSha256": options.plan_sha256, "guardSha256": GUARD_SHA256,
                "originalCppCompiled": False, "liveNativeRustConnected": False, "browserExecuted": False}
    try:
        result = run_owned(guard, command, destination)
        if options.stage == "rust-parser-native-tests":
            terminal["testsPassed"] = verify_test_output(command, destination, plan["expectedTests"])
            terminal["testCount"] = 5
        require(fingerprints(plan) == before, "owned parser/fixture/lock/protected producer bytes changed")
        terminal.update(status="passed", jobPeakPrivateBytes=result["jobPeakPrivateBytes"])
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-stage", failure=repr(error))
        raise
    finally:
        after = fingerprints(plan)
        terminal["inputFingerprintsUnchanged"] = before == after
        (destination / "input-fingerprints-after.json").write_text(json.dumps(after, indent=2) + "\n", encoding="utf-8")
        (destination / "terminal.json").write_text(json.dumps(terminal, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(terminal), flush=True)


if __name__ == "__main__":
    main()
