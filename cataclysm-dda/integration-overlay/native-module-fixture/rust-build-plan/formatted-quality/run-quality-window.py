"""Three exact package checks; default validates frozen inputs without loading a job."""
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
RUST = HERE.parent
FIXTURE = RUST.parent
PLAN_PATH = HERE / "quality-plan.json"
PLAN_SHA = "504c67c4e405cf373941e121686941b77fc2a8037287161a38b5be5249d39895"
HELPER_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
INITIAL_OWNER_SHA = "119a444966b54ac2cd4b9a77f18ef20f218d61eb2783dfe9a748225941bd56e8"
STAGES = ["native-fixture-package-format-check", "native-fixture-same-four-tests-after-formatting",
          "native-fixture-package-clippy-after-formatting"]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def checked_bytes(path, expected):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected, "fixed buffer changed: " + str(path))
    return data


def buffer_pin(path, data):
    return {"path": str(Path(path).resolve()), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def ordinary_directory_ancestry(path):
    for directory in [path, *path.parents]:
        if directory.exists():
            require(directory.is_dir() and not directory.is_symlink() and
                    not (getattr(directory.lstat(), "st_file_attributes", 0) & 0x400), "owned output ancestry must be ordinary")


def load_sources():
    plan_data = checked_bytes(PLAN_PATH, PLAN_SHA)
    plan = json.loads(plan_data)
    helper_path = Path(plan["cpp2Helper"]["path"])
    helper_data = checked_bytes(helper_path, HELPER_SHA)
    helper = types.ModuleType("cdda_native_quality_private_cpp2")
    helper.__file__ = str(helper_path)
    exec(compile(helper_data, str(helper_path), "exec", dont_inherit=True, optimize=0), helper.__dict__)
    initial_path = RUST / "run-rust-window.py"
    initial_data = checked_bytes(initial_path, INITIAL_OWNER_SHA)
    initial = types.ModuleType("cdda_native_quality_private_exact_report_parser")
    initial.__file__ = str(initial_path)
    exec(compile(initial_data, str(initial_path), "exec", dont_inherit=True, optimize=0), initial.__dict__)
    require(len(plan["pins"]) == plan["preparedUniquePinCount"] == 575, "reviewed pin counts changed")
    require([item["stage"] for item in plan["commands"]] == STAGES, "exact three stages required")
    require(plan["guard"]["currentWrapper"]["sha256"] == helper.WRAPPER_SHA256 and
            plan["guard"]["historicalHelper"]["sha256"] == helper.GUARD_SHA256, "fixed guards changed")
    gate, limits = plan["launchGate"], plan["ownedResourceGuard"]
    require(gate["minimumPhysicalFreeBytes"] == 4 * helper.GIB and
            gate["minimumExactCommitHeadroomBytes"] == 6 * helper.GIB and gate["soleOwnedHeavySlotParentConfirmed"], "fresh4/6 parent gate changed")
    require(limits["maximumOwnedTreePrivateBytes"] == helper.GIB and limits["maximumOwnedTreeWorkingSetBytes"] == helper.GIB and
            limits["minimumPhysicalFreeBytes"] == 2 * helper.GIB and limits["minimumExactCommitHeadroomBytes"] == 2 * helper.GIB and
            limits["maximumStageSeconds"] == 180 and limits["sampleIntervalMilliseconds"] == 250, "fixed running bounds changed")
    require(plan["browserPriorityGate"] == {"physicalGiB": 7, "exactCommitGiB": 9}, "browser priority changed")
    require(plan["newOwnedTarget"] == str(HERE / "target") and plan["initialExecutedTargetMustRemainUnchanged"] == str(RUST / "target"),
            "fresh target must be distinct from preserved initial binary")
    manifest = str(FIXTURE / "rust-consumer/Cargo.toml")
    common = ["--manifest-path", manifest, "--package", "cdda-snapshot-native-fixture-consumer"]
    expected = [["fmt", *common, "--", "--check", "--config-path", str(HERE / "rustfmt.toml")],
        ["test", "--offline", "--locked", "--jobs", "1", *common, "--target", "x86_64-pc-windows-gnu",
         "--target-dir", str(HERE / "target"), "--lib", "--", "--test-threads=1"],
        ["clippy", "--offline", "--locked", "--jobs", "1", *common, "--target", "x86_64-pc-windows-gnu",
         "--target-dir", str(HERE / "target"), "--lib", "--tests", "--no-deps", "--", "-D", "warnings"]]
    for command, argv in zip(plan["commands"], expected):
        require(command["executable"] == plan["installedTools"]["cargo"]["path"] and command["argv"] == argv and
                command["cwd"] == str(FIXTURE / "rust-consumer") and not command.get("environment"), "exact package-only command required")
    environment = plan["rustEnvironment"]
    require(environment["RUSTFMT"] == plan["installedTools"]["rustfmt"]["path"] and
            environment["PATH"].split(os.pathsep)[0] == str(Path(plan["installedTools"]["cargo"]["path"]).parent),
            "pinned GNU command dispatch required")
    require(environment["CARGO_NET_OFFLINE"] == "true" and environment["CARGO_INCREMENTAL"] == "0" and
            all(environment[key] == "1" for key in ["CARGO_BUILD_JOBS", "RUST_TEST_THREADS", "RAYON_NUM_THREADS",
                "CARGO_PROFILE_DEV_CODEGEN_UNITS", "CARGO_PROFILE_TEST_CODEGEN_UNITS"]), "one-worker offline environment changed")
    change = plan["authorizedCurrentSourceChange"]
    require(change["path"] == str(FIXTURE / "rust-consumer/src/lib.rs") and
            change["beforeSha256"] == "e286ee35b93c4bd4ad659472be2661ee608d1e3be963933906e78d8bd6453dd1" and
            change["afterSha256"] == "0b7004be0abe150f79f6dc23bebc9f6fc5d3ba75459c45b6baf05b37d9f87b43", "only approved source change allowed")
    config_data = checked_bytes(plan["config"]["path"], plan["config"]["sha256"])
    require(b"make_backup" not in config_data and b'edition = "2024"' in config_data, "supported separate config required")
    source_data = checked_bytes(change["path"], change["afterSha256"])
    names = sorted("tests::" + name for name in re.findall(r"#\[test\]\s+fn ([a-z0-9_]+)\(\)", source_data.decode("utf-8")))
    require(len(names) == 4 and names == plan["expectedOrderedTests"], "same exact four test functions required")
    records = helper.collect_pins([plan["pins"], buffer_pin(PLAN_PATH, plan_data), helper.pin(__file__)])
    require(len(records) == 577, "expected577 final protected files")
    helper.validate_pin_records(records)
    helper.validate_inherited_environment()
    ordinary_directory_ancestry(HERE)
    ordinary_directory_ancestry(HERE / "execution")
    return plan, records, helper, initial, plan_data, helper_data, initial_data


def execute(plan, records, helper, initial, plan_data, helper_data, initial_data, options):
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized64-bit Windows Python required")
    require(options.parent_released_window and options.runner_sha256 == helper.digest(__file__), "separate root reservation/current owner hash required")
    require(not os.path.lexists(HERE / "target"), "refuse previous/partial new target; no automatic retry")
    destination = HERE / "execution" / options.attempt_name
    require(helper.within(destination, HERE / "execution"), "attempt escapes owned evidence")
    ordinary_directory_ancestry(destination.parent)
    destination.mkdir(parents=True, exist_ok=False)
    (destination / "temporary").mkdir()
    (destination / "accepted-plan.json").write_bytes(plan_data)
    (destination / "accepted-cpp2-helper.py").write_bytes(helper_data)
    (destination / "accepted-report-parser.py").write_bytes(initial_data)
    shutil.copyfile(__file__, destination / "accepted-quality-owner.py")
    terminal = {"schemaVersion": 1, "status": "preparing-owned-quality-window", "planSha256": PLAN_SHA,
        "runnerSha256": helper.digest(__file__), "stages": [], "formatCheckPassed": False, "sameFourTestsPassed": False,
        "ClippyPassed": False, "actualNativeJsonPins": plan["actualNativeJsonPins"], "expectedOrderedTests": plan["expectedOrderedTests"],
        "actualSourceEdited": False, "initialProofChanged": False, "originalInputContextExecuted": False,
        "commandOwnershipVerified": False, "liveEngineIntegrated": False, "wholeGameVerified": False}
    controlled = {**helper.CONTROLLED_INHERITED, "TEMP": str(destination / "temporary"), "TMP": str(destination / "temporary")}
    previous = {key: os.environ.get(key) for key in controlled}
    before = None
    try:
        before = helper.fingerprints(records)
        helper.write_json(destination / "input-fingerprints-before.json", before)
        os.environ.update(controlled)
        wrapper, guard = helper.load_wrapper(plan)
        for command in plan["commands"]:
            helper.validate_pin_records(records)
            captured = time.monotonic()
            counters = guard.counters()
            decision = helper.choose_launch(counters)
            stage = {"stage": command["stage"], "decision": decision, "freshCounters": counters,
                     "argv": [command["executable"], *command["argv"]]}
            terminal["stages"].append(stage)
            helper.write_json(destination / (command["stage"] + ".launch-decision.json"), stage)
            if decision != "launch":
                terminal["status"] = decision
                break
            require(time.monotonic() - captured <= 15, "fresh counter measurement stale")
            result = wrapper.run_owned(guard, command, destination)
            require(result["passed"] and result["exitCode"] == 0 and not result["remainingOwnedPidsBeforeJobClose"], "owned stage failed")
            cleanup = json.loads((destination / (command["stage"] + ".outer-cleanup.json")).read_bytes())
            require(cleanup["passed"] and not cleanup["errors"] and not cleanup["remainingOwnedJobHandles"], "owned closure uncertain")
            if command["stage"] == STAGES[1]:
                text = (destination / (command["stage"] + ".stdout.log")).read_text(encoding="utf-8")
                stage["reports"] = initial.exact_test_reports(text, plan["expectedOrderedTests"])
            stage.update(status="passed", durationSeconds=result["durationSeconds"], jobPeakPrivateBytes=result["jobPeakPrivateBytes"],
                         maximumSampledWorkingSetBytes=max((row["ownedWorkingSetBytes"] for row in result["samples"]), default=0))
            terminal[{STAGES[0]: "formatCheckPassed", STAGES[1]: "sameFourTestsPassed", STAGES[2]: "ClippyPassed"}[command["stage"]]] = True
            helper.write_json(destination / (command["stage"] + ".verdict.json"), stage)
            require(helper.fingerprints(records) == before, "protected current/initial byte pins changed")
        else:
            terminal["status"] = "three-package-quality-checks-passed"
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-quality-window", failure=repr(error))
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        try:
            after = helper.fingerprints(records)
            helper.write_json(destination / "input-fingerprints-after.json", after)
            terminal["all577ProtectedPinnedBytesUnchanged"] = before is not None and before == after
            require(terminal["all577ProtectedPinnedBytesUnchanged"], "terminal protected byte audit failed")
        except BaseException as error:
            terminal.update(status="failed-terminal-input-audit", terminalAuditFailure=repr(error))
        cleanups = []
        for stage in terminal["stages"]:
            if stage["decision"] != "launch":
                continue
            try:
                cleanup_path = destination / (stage["stage"] + ".outer-cleanup.json")
                cleanup = json.loads(cleanup_path.read_bytes())
                metrics = json.loads((destination / (stage["stage"] + ".json")).read_bytes())
                require(cleanup["passed"] and not cleanup["errors"] and not cleanup["remainingOwnedJobHandles"] and
                        not metrics["remainingOwnedPidsBeforeJobClose"], "owned stage closure incomplete")
                roots = cleanup["rootsCreated"]
                require(len(roots) == 1 and all(any(row.get("processHandle") == root["processHandle"] and
                    row["action"] == "close-owned-process-handle" for row in cleanup["outerActions"]) for root in roots), "exact root handle must close")
                cleanups.append({"stage": stage["stage"], "passed": True, "rootsCreated": roots,
                                 "remainingOwnedJobHandles": [], "evidence": helper.pin(cleanup_path)})
            except BaseException as error:
                cleanups.append({"stage": stage["stage"], "passed": False, "failure": repr(error)})
        terminal["ownedCleanupRecords"] = cleanups
        terminal["allOwnedJobsAndExactRootHandlesClosed"] = all(row["passed"] for row in cleanups)
        if not terminal["allOwnedJobsAndExactRootHandlesClosed"]:
            terminal["status"] = "failed-owned-cleanup-uncertain"
        terminal["ordinaryCargoCacheMetadataAllowed"] = True
        terminal["evidenceFiles"] = [helper.pin(path) for path in sorted(destination.rglob("*"))
            if path.is_file() and "temporary" not in path.relative_to(destination).parts and path.name != "terminal.json"]
        helper.write_json(destination / "terminal.json", terminal)
    print(json.dumps({key: terminal[key] for key in ["status", "formatCheckPassed", "sameFourTestsPassed", "ClippyPassed", "allOwnedJobsAndExactRootHandlesClosed"]}), flush=True)
    require(terminal["status"] in ["three-package-quality-checks-passed", "deferred-browser-priority", "blocked-fresh-4-6-gate"],
            "quality window stopped; preserve diagnostics and do not retry automatically")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--attempt-name", default="validation-only")
    options = parser.parse_args()
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name), "invalid fresh attempt name")
    ast.parse(Path(__file__).read_bytes(), filename=__file__)
    plan, records, helper, initial, plan_data, helper_data, initial_data = load_sources()
    if not options.run:
        result = {"schemaVersion": 1, "status": "three-check-owner-source-validated-no-guard-loaded", "runnerSha256": helper.digest(__file__),
            "planSha256": PLAN_SHA, "protectedUniqueFiles": len(records), "newOwnedTarget": plan["newOwnedTarget"],
            "expectedOrderedTests": plan["expectedOrderedTests"], "FormatCheckExecuted": False, "RustTestsExecuted": False,
            "ClippyExecuted": False, "WindowsGuardLoaded": False}
        helper.write_json(HERE / "runner-source-validation.json", result)
        print(json.dumps(result), flush=True)
        return
    execute(plan, records, helper, initial, plan_data, helper_data, initial_data, options)


if __name__ == "__main__":
    main()
