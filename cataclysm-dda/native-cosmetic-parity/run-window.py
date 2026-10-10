"""Four separately guarded genuine C++/Rust stages; default is source validation."""
from pathlib import Path
import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import struct
import sys
import time
import types

HERE = Path(__file__).resolve().parent
CPP2_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
WRAPPER_SHA = "0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb"
STAGES = ["compile-cpp", "run-cpp", "compile-rust", "run-rust"]


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def ordinary(path):
    path = Path(path).absolute()
    for parent in [*reversed(path.parents), path]:
        state = parent.lstat()
        require(not parent.is_symlink() and not getattr(state, "st_file_attributes", 0) & 0x400,
                "unsafe ancestry: " + str(parent))
    return path


def fresh(path):
    try:
        Path(path).lstat()
    except FileNotFoundError:
        return
    raise RuntimeError("output or dangling link already exists: " + str(path))


def no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate JSON key")
        result[key] = value
    return result


def read_plan(path):
    raw = ordinary(path).read_bytes()
    require(0 < len(raw) <= 16 * 1024 * 1024, "bounded source plan")
    plan = json.loads(raw.decode("utf-8"), object_pairs_hook=no_duplicates,
                      parse_constant=lambda value: (_ for _ in ()).throw(RuntimeError("nonfinite JSON")))
    return plan, raw


def trees(plan, helper):
    result = {}
    for name, root in plan["treeRoots"].items():
        ordinary(root)
        current = helper.metadata_tree(root)
        expected = plan["preparationContextTrees"][name]
        require(set(current) == set(expected), "frozen membership changed: " + name)
        require(all(current[key][0] == expected[key][0] for key in current), "frozen file size/type changed: " + name)
        # Metadata can differ between sandbox and scoped execution contexts.
        # Every file byte is pinned; the exact executing-context metadata must
        # remain unchanged throughout the owned window and is retained in full.
        result[name] = current
    return result


def load_sources(options):
    ast.parse(Path(__file__).read_bytes(), filename=__file__)
    plan, raw = read_plan(HERE / "WINDOW-PLAN.json")
    sha = hashlib.sha256(raw).hexdigest()
    require(options.plan_sha256 == sha, "exact separately frozen plan required")
    require(plan["sourceCommit"] == "7b2efa5cea38e4d4d97dd0e63b28b9148623da59" and
            plan["expectedChecks"] == 23 and plan["parentExclusiveSlotReleaseRequired"] is True and
            plan["browserRecoveryHasPriority"] is True, "source/scope/ownership")
    helper_path = ordinary(plan["cpp2Helper"]["path"])
    helper_data = helper_path.read_bytes()
    require(hashlib.sha256(helper_data).hexdigest() == CPP2_SHA, "fixed CPP2 changed")
    helper = types.ModuleType("cdda_native_parity_fixed_cpp2")
    helper.__file__ = str(helper_path)
    exec(compile(helper_data, str(helper_path), "exec", dont_inherit=True, optimize=0), helper.__dict__)
    require(plan["guard"]["currentWrapper"]["sha256"] == WRAPPER_SHA, "fixed outer wrapper changed")
    guard = plan["ownedResourceGuard"]
    require(plan["launchGate"]["minimumPhysicalFreeBytes"] == 4 * helper.GIB and
            plan["launchGate"]["minimumExactCommitHeadroomBytes"] == 6 * helper.GIB, "fresh 4/6 gate")
    require(guard["maximumOwnedTreePrivateBytes"] == helper.GIB and
            guard["maximumOwnedTreeWorkingSetBytes"] == helper.GIB and
            guard["minimumPhysicalFreeBytes"] == 2 * helper.GIB and
            guard["minimumExactCommitHeadroomBytes"] == 2 * helper.GIB and
            guard["maximumStageSeconds"] == 180 and guard["sampleIntervalMilliseconds"] == 250, "fixed cap/floors/time")
    require([row["stage"] for row in plan["commands"]] == STAGES, "exact four stages")
    require(plan["commands"][0]["argv"][1:5] == ["-O0", "-std=c++17", "-fsigned-char", "-fexceptions"], "native flags")
    config = Path(plan["commands"][0]["environment"]["EM_CONFIG"])
    require(config.read_text(encoding="utf-8").splitlines()[-1] == "FROZEN_CACHE = True", "cache must remain frozen")
    build = HERE / "owned-build"
    for command in plan["commands"]:
        require(Path(command["cwd"]) == build and isinstance(command["argv"], list) and
                all(isinstance(value, str) for value in command["argv"]), "owned exact command")
        require(all(Path(output).parent == build for output in command["outputs"]), "owned output scope")
    require(plan["outputFiles"] == [str(build / "fixture.cjs"), str(build / "fixture.wasm"), str(build / "rust-parity.exe")], "exact artifact names")
    require(Path(plan["expectedStdout"]) == HERE / "prepared/expected-stdout.txt", "frozen expected stream")
    records = [*plan["pins"], helper.pin(HERE / "WINDOW-PLAN.json")]
    require(len(records) == len({str(Path(row["path"]).resolve()).casefold() for row in records}), "unique protected paths")
    for record in records:
        ordinary(record["path"])
    helper.validate_pin_records(records)
    require(any(Path(row["path"]).resolve() == Path(__file__).resolve() for row in records), "owner source must be pinned")
    protected = {str(Path(row["path"]).resolve()).casefold() for row in records}
    for root in plan["treeRoots"].values():
        require(all(str(path.resolve()).casefold() in protected for path in Path(root).rglob("*") if path.is_file()), "every frozen tree file requires a byte pin")
    helper.validate_inherited_environment()
    tree_state = trees(plan, helper)
    return plan, raw, sha, helper, helper_data, records, tree_state


def complete_stream(path):
    raw = ordinary(path).read_bytes()
    require(0 < len(raw) <= 65_536 and not raw.startswith(b"\xef\xbb\xbf"), "bounded BOM-free whole stdout")
    text = raw.decode("utf-8", errors="strict")
    require(text.endswith("\n") and not ("\r" in text and re.search(r"(?<!\r)\n", text)), "uniform complete LF/CRLF stream")
    normalized = text.replace("\r\n", "\n")
    require("\r" not in normalized, "bare carriage return")
    return normalized


def execute(options, loaded):
    plan, raw, plan_sha, helper, helper_data, records, initial_trees = loaded
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized 64-bit Windows")
    require(options.parent_released_window and options.runner_sha256 == helper.digest(__file__), "exact parent-released owner")
    execution = HERE / "execution"
    if not execution.exists():
        fresh(execution)
        ordinary(HERE)
        execution.mkdir()
    ordinary(execution)
    destination = execution / options.attempt_name
    require(destination.parent == execution, "attempt scope")
    fresh(destination)
    build = HERE / "owned-build"
    fresh(build)
    for output in plan["outputFiles"]:
        fresh(output)
    destination.mkdir()
    ordinary(destination)
    temporary = destination / "temporary"
    temporary.mkdir()
    (destination / "accepted-plan.json").write_bytes(raw)
    (destination / "accepted-owner.py").write_bytes(Path(__file__).read_bytes())
    (destination / "accepted-cpp2-helper.py").write_bytes(helper_data)
    terminal = {"schemaVersion": 1, "status": "preparing", "planSha256": plan_sha,
                "runnerSha256": helper.digest(__file__), "stages": [], "checks": 0,
                "preparationContextMetadataEqual": initial_trees == plan["preparationContextTrees"],
                "actualCppRuntimePassed": False, "actualRustRuntimePassed": False,
                "originalCallersExecuted": False, "originalRngProved": False,
                "saveResumeProved": False, "browserExecuted": False, "wholeGameAccepted": False}
    before = helper.fingerprints(records)
    require(len(before) == len(records), "complete protected fingerprint map")
    helper.write_json(destination / "pins-before.json", before)
    helper.write_json(destination / "trees-before.json", initial_trees)
    artifacts = {}
    controlled = {**helper.CONTROLLED_INHERITED, "TEMP": str(temporary), "TMP": str(temporary)}
    old = {key: os.environ.get(key) for key in controlled}
    try:
        os.environ.update(controlled)
        wrapper, guard = helper.load_wrapper(plan)
        for command in plan["commands"]:
            helper.validate_pin_records(records)
            require(helper.fingerprints(records) == before and trees(plan, helper) == initial_trees, "frozen input changed before stage")
            for path, pin in artifacts.items():
                ordinary(path)
                require(helper.pin(path) == pin, "owned compiled artifact changed")
            captured = time.monotonic()
            utc = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            counters = guard.counters()
            decision = helper.choose_launch(counters)
            stage = {"stage": command["stage"], "decision": decision, "capturedUtc": utc,
                     "freshCounters": counters, "argv": [command["executable"], *command["argv"]]}
            terminal["stages"].append(stage)
            helper.write_json(destination / (command["stage"] + ".launch-decision.json"), stage)
            if decision != "launch":
                terminal["status"] = decision
                break
            if not build.exists():
                fresh(build)
                build.mkdir()
            ordinary(build)
            require(time.monotonic() - captured <= 15, "stale counters")
            try:
                result = wrapper.run_owned(guard, command, destination)
                cleanup = json.loads((destination / (command["stage"] + ".outer-cleanup.json")).read_bytes())
                require(cleanup["passed"] is True and not cleanup["remainingOwnedJobHandles"], "exact owned cleanup failed")
                require(result["passed"] is True and result["exitCode"] == 0 and not result["remainingOwnedPidsBeforeJobClose"], "owned stage failed")
                stage.update(status="passed", durationSeconds=result["durationSeconds"], jobPeakPrivateBytes=result["jobPeakPrivateBytes"])
                for output in command["outputs"]:
                    path = ordinary(output)
                    require(path.is_file() and path.stat().st_size > 8, "compiled output absent")
                    if path.suffix == ".wasm":
                        require(path.open("rb").read(8) == b"\x00asm\x01\x00\x00\x00", "WASM v1 artifact")
                    if path.suffix == ".exe":
                        require(path.open("rb").read(2) == b"MZ", "native PE artifact")
                    artifacts[output] = helper.pin(path)
                if command["stage"] in ["run-cpp", "run-rust"]:
                    actual = complete_stream(destination / (command["stage"] + ".stdout.log"))
                    expected = complete_stream(plan["expectedStdout"])
                    require(len(expected.splitlines()) == 23 and expected.splitlines()[-1] == '{"summary":true,"checks":23,"failed":0}', "exact expected typed stream")
                    require(actual == expected, "entire actual stream differs; no ignored output or value coercion")
                    terminal["actualCppRuntimePassed" if command["stage"] == "run-cpp" else "actualRustRuntimePassed"] = True
            except BaseException as error:
                stage.update(status="failed", failure=repr(error))
                raise
            finally:
                try:
                    archive = destination / "outputs" / command["stage"]
                    archive.mkdir(parents=True, exist_ok=False)
                    stage["outputs"] = []
                    for output in command["outputs"]:
                        try:
                            Path(output).lstat()
                        except FileNotFoundError:
                            continue
                        source = ordinary(output)
                        target = archive / source.name
                        require(source.is_file() and source.parent == build, "ordinary owned artifact required")
                        shutil.copyfile(source, target)
                        require(helper.digest(source) == helper.digest(target), "archived artifact changed")
                        stage["outputs"].append({"source": helper.pin(source), "archive": helper.pin(target)})
                except BaseException as error:
                    stage.update(status="failed-artifact-archive", archiveFailure=repr(error))
                    raise
                finally:
                    helper.write_json(destination / (command["stage"] + ".verdict.json"), stage)
        else:
            terminal.update(status="actual-cpp-rust-parity-passed", checks=23)
            require(complete_stream(destination / "run-cpp.stdout.log") == complete_stream(destination / "run-rust.stdout.log"), "entire genuine streams differ")
    except BaseException as error:
        terminal.update(status="failed-stopped-window", failure=repr(error))
    finally:
        for key, value in old.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        try:
            helper.validate_pin_records(records)
            after = helper.fingerprints(records)
            final_trees = trees(plan, helper)
            helper.write_json(destination / "pins-after.json", after)
            helper.write_json(destination / "trees-after.json", final_trees)
            terminal["protectedBytesUnchanged"] = len(after) == len(records) and before == after
            terminal["executionContextMetadataUnchanged"] = initial_trees == final_trees
            require(terminal["protectedBytesUnchanged"] and terminal["executionContextMetadataUnchanged"], "final input audit")
        except BaseException as error:
            terminal.update(status="failed-final-input-audit", auditFailure=repr(error))
        cleanups = []
        for stage in terminal["stages"]:
            if stage["decision"] != "launch":
                continue
            try:
                path = destination / (stage["stage"] + ".outer-cleanup.json")
                cleanup = json.loads(path.read_bytes())
                cleanups.append({"stage": stage["stage"], "passed": cleanup["passed"],
                                 "remainingOwnedJobHandles": cleanup["remainingOwnedJobHandles"], "evidence": helper.pin(path)})
            except BaseException as error:
                cleanups.append({"stage": stage["stage"], "passed": False, "failure": repr(error)})
        terminal["cleanupRecords"] = cleanups
        terminal["ownedJobsClosedAndRootsWaited"] = all(row["passed"] is True and not row.get("remainingOwnedJobHandles", []) for row in cleanups)
        if not terminal["ownedJobsClosedAndRootsWaited"]:
            terminal["status"] = "failed-owned-cleanup-uncertain"
        helper.write_json(destination / "terminal.json", terminal)
    print(json.dumps(terminal), flush=True)
    require(terminal["status"] in ["actual-cpp-rust-parity-passed", "deferred-browser-priority", "blocked-fresh-4-6-gate"], "inspect preserved terminal; no automatic retry")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--plan-sha256", required=True)
    parser.add_argument("--attempt-name", default="validation-only")
    options = parser.parse_args()
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name), "ordinary attempt name")
    loaded = load_sources(options)
    if not options.run:
        print(json.dumps({"status": "source-validated-no-guard-or-execution", "protectedFiles": len(loaded[5]), "planSha256": loaded[2],
                          "compilerExecuted": False, "runtimeExecuted": False, "WindowsGuardLoaded": False}), flush=True)
        return
    execute(options, loaded)


if __name__ == "__main__":
    main()
