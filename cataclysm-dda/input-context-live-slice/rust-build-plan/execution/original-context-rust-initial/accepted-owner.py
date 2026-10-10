"""One actual-original-context Rust consumer stage; default checks sources without a Windows job."""
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
FIXTURE = HERE.parent
CPP2 = FIXTURE.parent / "integration-overlay/build-plan/cpp-compile"
PLAN_PATH = HERE / "rust-consumer-plan.json"
PLAN_SHA = "30ff0efe8bc5c16f44cc980e9bf9a89f9ba748b426400ccca8a62f1ff4cf5481"
HELPER_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
STAGE = "actual-original-context-rust-consumer"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def checked_bytes(path, expected):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected, "fixed buffer changed: " + str(path))
    return data


def buffer_pin(path, data):
    return {"path": str(Path(path).resolve()), "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest()}


def require_owned_directory(path):
    for directory in [path, *path.parents]:
        if directory.exists():
            state = directory.lstat()
            require(directory.is_dir() and not directory.is_symlink() and
                    not (getattr(state, "st_file_attributes", 0) & 0x400),
                    "owned output ancestry must be an ordinary directory")


def exact_test_reports(text, expected):
    rows = re.findall(r"^test ([a-zA-Z0-9_:]+) \.\.\. (ok|FAILED|ignored)$", text, re.MULTILINE)
    require(rows == [(name, "ok") for name in expected], "exact five Rust names/results required")
    summaries = re.findall(r"^test result: (.*)$", text, re.MULTILINE)
    require(len(summaries) == 1 and
            re.fullmatch(r"ok\. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in [0-9.]+s", summaries[0]),
            "exact successful five-test summary required")
    return [{"name": name, "passed": True} for name, _ in rows]


def load_sources():
    plan_data = checked_bytes(PLAN_PATH, PLAN_SHA)
    helper_path = CPP2 / "run-compile-window.py"
    helper_data = checked_bytes(helper_path, HELPER_SHA)
    helper = types.ModuleType("cdda_native_bytes_private_cpp2")
    helper.__file__ = str(helper_path)
    exec(compile(helper_data, str(helper_path), "exec", dont_inherit=True, optimize=0), helper.__dict__)
    plan = json.loads(plan_data)
    require(len(plan["commands"]) == 1 and plan["commands"][0]["stage"] == STAGE, "exact single Rust stage required")
    require(len(plan["inputs"]) == 30 and len(plan["dependencyArchives"]) == 11 and
            len(plan["dependencyRegularFilePins"]) == 473, "reviewed input counts changed")
    require(len(plan["actualNativeJsonPins"]) == 24 and not plan["nativeJsonSubstitutionAllowed"], "actual native bytes required")
    require(plan["guard"]["currentWrapper"]["sha256"] == helper.WRAPPER_SHA256 and
            plan["guard"]["historicalHelper"]["sha256"] == helper.GUARD_SHA256, "fixed guards changed")
    command = plan["commands"][0]
    expected_argv = ["test", "--offline", "--locked", "--jobs", "1", "--manifest-path",
        str(FIXTURE / "rust-consumer/Cargo.toml"), "--target", "x86_64-pc-windows-gnu",
        "--target-dir", str(HERE / "target"), "--lib", "--", "--test-threads=1"]
    require(command["argv"] == expected_argv and command["cwd"] == str(FIXTURE) and
            command["expectedTests"] == 5, "exact package-only Cargo command changed")
    require(command["environment"]["CARGO_NET_OFFLINE"] == "true" and
            all(command["environment"][key] == "1" for key in ["CARGO_BUILD_JOBS", "RUST_TEST_THREADS",
                "CARGO_PROFILE_DEV_CODEGEN_UNITS", "CARGO_PROFILE_TEST_CODEGEN_UNITS"]) and
            command["environment"]["CARGO_INCREMENTAL"] == "0", "one-worker offline environment changed")
    require(plan["rustEnvironment"] == {}, "unexpected generic environment overrides")
    gate, resource = plan["launchGate"], plan["ownedResourceGuard"]
    require(gate["minimumPhysicalFreeBytes"] == 4 * helper.GIB and
            gate["minimumExactCommitHeadroomBytes"] == 6 * helper.GIB and
            gate["soleOwnedHeavySlotParentConfirmed"], "fresh 4/6 parent gate changed")
    require(resource["maximumOwnedTreePrivateBytes"] == helper.GIB and
            resource["maximumOwnedTreeWorkingSetBytes"] == helper.GIB and
            resource["minimumPhysicalFreeBytes"] == 2 * helper.GIB and
            resource["minimumExactCommitHeadroomBytes"] == 2 * helper.GIB and
            resource["maximumStageSeconds"] == 180 and resource["sampleIntervalMilliseconds"] == 250,
            "reviewed resource bounds changed")
    require(plan["browserPriorityGate"] == {"physicalGiB": 7, "exactCommitGiB": 9}, "browser priority changed")
    records = helper.collect_pins(plan)
    require(len(records) == 538, "expected 538 unique prepared file pins")
    source_path = FIXTURE / "rust-consumer/src/lib.rs"
    source_pin = next(item for item in records if Path(item["path"]).resolve() == source_path)
    source_data = checked_bytes(source_path, source_pin["sha256"])
    require(buffer_pin(source_path, source_data) == source_pin, "test buffer must equal final audit pin")
    tests = sorted("tests::" + name for name in
                   re.findall(r"#\[test\]\s+fn ([a-z0-9_]+)\(\)", source_data.decode("utf-8")))
    require(len(tests) == 5 and len(set(tests)) == 5 and tests == plan["expectedOrderedTests"], "exact source test names changed")
    records = helper.collect_pins([records, buffer_pin(PLAN_PATH, plan_data),
                                  buffer_pin(helper_path, helper_data), helper.pin(__file__)])
    require(len(records) == 540, "expected 540 unique final-audit pins")
    helper.validate_pin_records(records)
    helper.validate_inherited_environment()
    require_owned_directory(HERE)
    require_owned_directory(HERE / "execution")
    return plan, records, helper, plan_data, helper_data


def execute(plan, records, helper, plan_data, helper_data, options):
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized 64-bit Windows Python required")
    require(options.parent_released_window and options.runner_sha256 == helper.digest(__file__),
            "separate parent reservation and exact reviewed owner hash required")
    require(not os.path.lexists(HERE / "target"), "refuse a prior or partial target; no automatic retry")
    destination = HERE / "execution" / options.attempt_name
    require(helper.within(destination, HERE / "execution"), "attempt escaped owned evidence root")
    require_owned_directory(destination.parent)
    destination.mkdir(parents=True, exist_ok=False)
    (destination / "temporary").mkdir()
    (destination / "accepted-plan.json").write_bytes(plan_data)
    (destination / "accepted-cpp2-helper.py").write_bytes(helper_data)
    shutil.copyfile(__file__, destination / "accepted-owner.py")
    terminal = {"schemaVersion": 1, "status": "preparing-owned-rust-window", "planSha256": PLAN_SHA,
        "runnerSha256": helper.digest(__file__), "cpp2HelperSha256": HELPER_SHA, "stages": [],
        "expectedOrderedTests": plan["expectedOrderedTests"], "RustActualOriginalRecordConsumersExecuted": False,
        "allFiveRustTestsPassed": False, "actualNativeJsonPins": plan["actualNativeJsonPins"],
        "originalInputContextExecutedInThisRustWindow": False,
        "originalInputContextExecutedInPriorNativeWindow": True, "originalActionContextsLookupVerifiedInPriorNativeWindow": True,
        "commandOwnershipVerified": False, "liveEngineIntegrated": False, "wholeGameVerified": False}
    controlled = {**helper.CONTROLLED_INHERITED, "TEMP": str(destination / "temporary"), "TMP": str(destination / "temporary")}
    previous = {key: os.environ.get(key) for key in controlled}
    before = None
    try:
        before = helper.fingerprints(records)
        helper.write_json(destination / "input-fingerprints-before.json", before)
        os.environ.update(controlled)
        wrapper, guard = helper.load_wrapper(plan)
        command = plan["commands"][0]
        helper.validate_pin_records(records)
        captured = time.monotonic()
        counters = guard.counters()
        decision = helper.choose_launch(counters)
        stage = {"stage": STAGE, "decision": decision, "freshCounters": counters,
                 "argv": [command["executable"], *command["argv"]]}
        terminal["stages"].append(stage)
        helper.write_json(destination / (STAGE + ".launch-decision.json"), stage)
        if decision != "launch":
            terminal["status"] = decision
        else:
            require(time.monotonic() - captured <= 15, "fresh counter measurement stale")
            terminal["ownedCargoStageAttempted"] = True
            result = wrapper.run_owned(guard, command, destination)
            cleanup = json.loads((destination / (STAGE + ".outer-cleanup.json")).read_bytes())
            require(cleanup["passed"] and not cleanup["remainingOwnedJobHandles"] and not cleanup["errors"], "owned cleanup uncertain")
            require(result["passed"] and result["exitCode"] == 0 and
                    not result["remainingOwnedPidsBeforeJobClose"], "owned Cargo stage failed")
            stdout = (destination / (STAGE + ".stdout.log")).read_text(encoding="utf-8")
            stage["reports"] = exact_test_reports(stdout, plan["expectedOrderedTests"])
            stage.update(status="passed", durationSeconds=result["durationSeconds"],
                         jobPeakPrivateBytes=result["jobPeakPrivateBytes"],
                         maximumSampledWorkingSetBytes=max((item["ownedWorkingSetBytes"] for item in result["samples"]), default=0))
            terminal.update(status="actual-native-byte-rust-consumer-five-tests-passed", allFiveRustTestsPassed=True,
                            RustActualOriginalRecordConsumersExecuted=True)
        helper.write_json(destination / (STAGE + ".verdict.json"), stage)
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-rust-window", failure=repr(error))
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        try:
            after = helper.fingerprints(records)
            helper.write_json(destination / "input-fingerprints-after.json", after)
            terminal["protectedPinnedBytesUnchanged"] = before is not None and before == after
            require(terminal["protectedPinnedBytesUnchanged"], "terminal protected byte audit failed")
        except BaseException as error:
            terminal.update(status="failed-terminal-input-audit", terminalAuditFailure=repr(error))
        cleanups = []
        for stage in terminal["stages"]:
            if stage["decision"] != "launch":
                continue
            path = destination / (STAGE + ".outer-cleanup.json")
            try:
                cleanup = json.loads(path.read_bytes())
                metrics = json.loads((destination / (STAGE + ".json")).read_bytes())
                require(cleanup["passed"] and not cleanup["errors"] and
                        not cleanup["remainingOwnedJobHandles"] and not metrics["remainingOwnedPidsBeforeJobClose"],
                        "owned closure records are incomplete")
                roots = cleanup["rootsCreated"]
                require(len(roots) == 1 and all(any(action.get("processHandle") == root["processHandle"] and
                    action["action"] == "close-owned-process-handle" for action in cleanup["outerActions"]) for root in roots),
                    "one exact returned root handle must be explicitly closed")
                cleanups.append({"passed": True, "evidence": helper.pin(path), "metrics": helper.pin(destination / (STAGE + ".json")),
                                 "rootsCreated": roots, "remainingOwnedJobHandles": []})
            except BaseException as error:
                cleanups.append({"passed": False, "failure": repr(error)})
        terminal["ownedCleanupRecords"] = cleanups
        terminal["allOwnedJobsAndExactRootHandlesClosed"] = all(item["passed"] for item in cleanups)
        if not terminal["allOwnedJobsAndExactRootHandlesClosed"]:
            terminal["status"] = "failed-owned-cleanup-uncertain"
        terminal["ordinaryCargoCacheMetadataAllowed"] = True
        terminal["protectedPinnedFileCount"] = len(records)
        terminal["evidenceFiles"] = [helper.pin(path) for path in sorted(destination.rglob("*"))
            if path.is_file() and "temporary" not in path.relative_to(destination).parts and path.name != "terminal.json"]
        helper.write_json(destination / "terminal.json", terminal)
    print(json.dumps({key: terminal[key] for key in ["status", "allFiveRustTestsPassed", "allOwnedJobsAndExactRootHandlesClosed"]}), flush=True)
    require(terminal["status"] in ["actual-native-byte-rust-consumer-five-tests-passed", "deferred-browser-priority", "blocked-fresh-4-6-gate"],
            "window stopped; inspect preserved terminal and diagnostics, do not retry automatically")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--attempt-name", default="validation-only")
    options = parser.parse_args()
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name), "invalid attempt name")
    ast.parse(Path(__file__).read_bytes(), filename=__file__)
    plan, records, helper, plan_data, helper_data = load_sources()
    if not options.run:
        result = {"schemaVersion": 1, "status": "rust-owner-source-validated-no-windows-guard-loaded",
            "runnerSha256": helper.digest(__file__), "planSha256": PLAN_SHA, "cpp2HelperSha256": HELPER_SHA,
            "uniqueProtectedFiles": len(records), "registryPackages": 11, "archiveEqualRegularSourceFiles": 473,
            "actualNativeJsonPins": 24, "expectedOrderedTests": plan["expectedOrderedTests"],
            "cargoExecuted": False, "RustConsumerExecuted": False, "originalInputContextExecutedInPriorNativeWindow": True, "WindowsGuardLoaded": False}
        helper.write_json(HERE / "runner-source-validation.json", result)
        print(json.dumps(result), flush=True)
        return
    execute(plan, records, helper, plan_data, helper_data, options)


if __name__ == "__main__":
    main()
