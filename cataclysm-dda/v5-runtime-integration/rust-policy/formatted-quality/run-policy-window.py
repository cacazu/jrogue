"""Four exact v5 policy checks, using the reviewed CPP2 owned-job wrapper."""
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
POLICY = HERE.parent
PLAN_PATH = HERE / "quality-plan.json"
PLAN_SHA = "edb9d8c006d67f839bbe888f7e1ccb5d0b787a919af66409624cd884a3af18a1"
HELPER_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
STAGES = ["v5-policy-format-check", "v5-policy-five-native-tests", "v5-policy-package-clippy", "v5-policy-wasm-release-build"]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def checked_bytes(path, expected):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected, "fixed buffer changed: " + str(path))
    return data


def ordinary_directory_ancestry(path):
    for directory in [path, *path.parents]:
        if directory.exists():
            require(directory.is_dir() and not directory.is_symlink() and
                    not (getattr(directory.lstat(), "st_file_attributes", 0) & 0x400), "owned output ancestry must be ordinary")


def exact_test_reports(text, expected):
    reports = re.findall(r"^test ([a-z0-9_:]+) \.\.\. (ok|FAILED|ignored)$", text, re.MULTILINE)
    require(len(reports) == len(expected) == 5, "five unique reported test rows required")
    require(sorted(name for name, status in reports) == expected and all(status == "ok" for name, status in reports),
            "exact prepared tests must pass once each")
    summaries = re.findall(r"^test result: ok\. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in .*?$", text, re.MULTILINE)
    require(len(summaries) == 1, "single five-test passing summary required")
    return [{"name": name, "status": status} for name, status in reports]


def load_sources():
    plan_data = checked_bytes(PLAN_PATH, PLAN_SHA)
    plan = json.loads(plan_data)
    helper_path = Path(plan["cpp2Helper"]["path"])
    helper_data = checked_bytes(helper_path, HELPER_SHA)
    helper = types.ModuleType("cdda_v5_policy_private_cpp2")
    helper.__file__ = str(helper_path)
    exec(compile(helper_data, str(helper_path), "exec", dont_inherit=True, optimize=0), helper.__dict__)
    require([command["stage"] for command in plan["commands"]] == STAGES, "only four exact stages permitted")
    require(plan["guard"]["currentWrapper"]["sha256"] == helper.WRAPPER_SHA256 and
            plan["guard"]["historicalHelper"]["sha256"] == helper.GUARD_SHA256, "reviewed guard hashes changed")
    gate, limits = plan["launchGate"], plan["ownedResourceGuard"]
    require(gate["minimumPhysicalFreeBytes"] == 4 * helper.GIB and
            gate["minimumExactCommitHeadroomBytes"] == 6 * helper.GIB and
            gate["maximumAgeMilliseconds"] == 15000 and gate["soleOwnedHeavySlotParentConfirmed"], "fresh 4/6 root gate changed")
    require(limits["maximumOwnedTreePrivateBytes"] == helper.GIB and
            limits["maximumOwnedTreeWorkingSetBytes"] == helper.GIB and
            limits["minimumPhysicalFreeBytes"] == 2 * helper.GIB and
            limits["minimumExactCommitHeadroomBytes"] == 2 * helper.GIB and
            limits["maximumStageSeconds"] == 180 and limits["sampleIntervalMilliseconds"] == 250, "fixed running limits changed")
    require(plan["browserPriorityGate"] == {"physicalGiB": 7, "exactCommitGiB": 9}, "browser priority gate changed")
    require(plan["newOwnedTarget"] == str(HERE / "owned-target"), "new exact owned target required")
    require(plan["wasmOutput"] == str(HERE / "owned-target/wasm32-unknown-unknown/release/cdda_v5_platform_policy.wasm"),
            "fixed Wasm output required")
    manifest = str(POLICY / "Cargo.toml")
    common = ["--manifest-path", manifest, "--package", "cdda-v5-platform-policy"]
    offline = ["--offline", "--locked", "--jobs", "1"]
    target = str(HERE / "owned-target")
    expected = [
        ["fmt", *common, "--", "--check", "--config-path", str(POLICY / "rustfmt.toml")],
        ["test", *offline, *common, "--target", "x86_64-pc-windows-gnu", "--target-dir", target, "--lib", "--", "--test-threads=1"],
        ["clippy", *offline, *common, "--target", "x86_64-pc-windows-gnu", "--target-dir", target, "--lib", "--tests", "--no-deps", "--", "-D", "warnings"],
        ["build", "--release", *offline, *common, "--target", "wasm32-unknown-unknown", "--target-dir", target, "--lib"],
    ]
    for command, argv in zip(plan["commands"], expected):
        require(command["executable"] == plan["installedTools"]["cargo"]["path"] and command["argv"] == argv and
                command["cwd"] == str(POLICY) and not command.get("environment"), "fixed package-only command required")
    environment = plan["rustEnvironment"]
    require(environment["RUSTFMT"] == plan["installedTools"]["rustfmt"]["path"] and
            environment["RUSTC"] == plan["installedTools"]["rustc"]["path"] and
            environment["PATH"].split(os.pathsep)[0] == str(Path(plan["installedTools"]["cargo"]["path"]).parent), "pinned GNU tool dispatch required")
    require(environment["CARGO_NET_OFFLINE"] == "true" and environment["CARGO_INCREMENTAL"] == "0" and
            all(environment[key] == "1" for key in ["CARGO_BUILD_JOBS", "RUST_TEST_THREADS", "RAYON_NUM_THREADS",
                "CARGO_PROFILE_DEV_CODEGEN_UNITS", "CARGO_PROFILE_TEST_CODEGEN_UNITS", "CARGO_PROFILE_RELEASE_CODEGEN_UNITS"]),
            "one-worker offline Rust environment required")
    source_data = (POLICY / "src/tests.rs").read_bytes()
    names = sorted("tests::" + name for name in re.findall(r"#\[test\]\s+fn ([a-z0-9_]+)\(\)", source_data.decode("utf-8")))
    require(len(names) == 5 and names == plan["expectedOrderedTests"], "five exact prepared test functions required")
    require(len(plan["actualParentAssetPins"]) == 6 and len(plan["pins"]) == plan["preparedUniquePinCount"], "exact source/asset pin counts required")
    require(not any(name in (POLICY / "rustfmt.toml").read_text(encoding="utf-8") for name in ["make_backup", "skip_children"]),
            "stable config must check child test module too")
    records = helper.collect_pins([plan["pins"], {"path": str(PLAN_PATH), "bytes": len(plan_data), "sha256": PLAN_SHA}, helper.pin(__file__)])
    require(len(records) == plan["preparedUniquePinCount"] + 2, "plan/owner must add two distinct pins")
    helper.validate_pin_records(records)
    helper.validate_inherited_environment()
    ordinary_directory_ancestry(HERE)
    ordinary_directory_ancestry(HERE / "execution")
    return plan, records, helper, plan_data, helper_data


def execute(plan, records, helper, plan_data, helper_data, options):
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized 64-bit Windows Python required")
    require(options.root_released_window and options.runner_sha256 == helper.digest(__file__), "separate root release/current owner hash required")
    require(not os.path.lexists(HERE / "owned-target"), "refuse previous/partial target; no automatic retry")
    destination = HERE / "execution" / options.attempt_name
    require(helper.within(destination, HERE / "execution"), "attempt escapes owned evidence")
    ordinary_directory_ancestry(destination.parent)
    destination.mkdir(parents=True, exist_ok=False)
    (destination / "temporary").mkdir()
    (destination / "accepted-plan.json").write_bytes(plan_data)
    (destination / "accepted-cpp2-helper.py").write_bytes(helper_data)
    shutil.copyfile(__file__, destination / "accepted-policy-owner.py")
    for relative in ["Cargo.toml", "Cargo.lock", "rustfmt.toml", "NOTICE.txt", "src/lib.rs", "src/tests.rs"]:
        accepted = destination / "accepted-policy-source" / relative
        accepted.parent.mkdir(parents=True, exist_ok=True)
        accepted.write_bytes((POLICY / relative).read_bytes())
    terminal = {"schemaVersion": 1, "status": "preparing-v5-policy-owned-window", "planSha256": PLAN_SHA,
        "runnerSha256": helper.digest(__file__), "stages": [], "formatCheckPassed": False, "fiveNativeTestsPassed": False,
        "ClippyPassed": False, "WasmBuildPassed": False, "actualParentAssetPins": plan["actualParentAssetPins"],
        "expectedOrderedTests": plan["expectedOrderedTests"], "engineRuntimeVerified": False,
        "existingProfilePreservedInActualEngine": False, "allGameArtworkComplete": False, "externalPublication": False}
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
            require(time.monotonic() - captured <= 15, "fresh resource counters stale")
            result = wrapper.run_owned(guard, command, destination)
            require(result["passed"] and result["exitCode"] == 0 and not result["remainingOwnedPidsBeforeJobClose"], "owned stage failed")
            cleanup = json.loads((destination / (command["stage"] + ".outer-cleanup.json")).read_bytes())
            require(cleanup["passed"] and not cleanup["errors"] and not cleanup["remainingOwnedJobHandles"], "owned closure uncertain")
            if command["stage"] == STAGES[1]:
                text = (destination / (command["stage"] + ".stdout.log")).read_text(encoding="utf-8")
                stage["reports"] = exact_test_reports(text, plan["expectedOrderedTests"])
            stage.update(status="passed", durationSeconds=result["durationSeconds"], jobPeakPrivateBytes=result["jobPeakPrivateBytes"],
                         maximumSampledWorkingSetBytes=max((row["ownedWorkingSetBytes"] for row in result["samples"]), default=0))
            terminal[{STAGES[0]: "formatCheckPassed", STAGES[1]: "fiveNativeTestsPassed", STAGES[2]: "ClippyPassed", STAGES[3]: "WasmBuildPassed"}[command["stage"]]] = True
            helper.write_json(destination / (command["stage"] + ".verdict.json"), stage)
            require(helper.fingerprints(records) == before, "protected source/tool/parent-art bytes changed")
        else:
            wasm = Path(plan["wasmOutput"])
            require(wasm.is_file() and not wasm.is_symlink(), "owned Wasm output missing")
            terminal["wasmArtifact"] = helper.pin(wasm)
            terminal["status"] = "four-v5-policy-checks-passed"
    except BaseException as error:
        terminal.update(status="failed-stopped-v5-policy-window", failure=repr(error))
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        try:
            after = helper.fingerprints(records)
            helper.write_json(destination / "input-fingerprints-after.json", after)
            terminal["allProtectedPinnedBytesUnchanged"] = before is not None and before == after
            require(terminal["allProtectedPinnedBytesUnchanged"], "terminal protected-byte audit failed")
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
        terminal["evidenceFiles"] = [helper.pin(path) for path in sorted(destination.rglob("*"))
            if path.is_file() and "temporary" not in path.relative_to(destination).parts and path.name != "terminal.json"]
        helper.write_json(destination / "terminal.json", terminal)
    print(json.dumps({key: terminal[key] for key in ["status", "formatCheckPassed", "fiveNativeTestsPassed", "ClippyPassed", "WasmBuildPassed", "allOwnedJobsAndExactRootHandlesClosed"]}), flush=True)
    require(terminal["status"] in ["four-v5-policy-checks-passed", "deferred-browser-priority", "blocked-fresh-4-6-gate"],
            "owned window stopped; preserve diagnostics, do not retry automatically")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--root-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--attempt-name", default="validation-only")
    options = parser.parse_args()
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name), "invalid fresh attempt name")
    ast.parse(Path(__file__).read_bytes(), filename=__file__)
    plan, records, helper, plan_data, helper_data = load_sources()
    if not options.run:
        result = {"schemaVersion": 1, "status": "v5-policy-owner-source-validated-no-guard-loaded", "runnerSha256": helper.digest(__file__),
            "planSha256": PLAN_SHA, "protectedUniqueFiles": len(records), "newOwnedTarget": plan["newOwnedTarget"],
            "expectedOrderedTests": plan["expectedOrderedTests"], "FormatCheckExecuted": False, "RustTestsExecuted": False,
            "ClippyExecuted": False, "WasmBuildExecuted": False, "WindowsGuardLoaded": False}
        helper.write_json(HERE / "runner-source-validation.json", result)
        print(json.dumps(result), flush=True)
        return
    execute(plan, records, helper, plan_data, helper_data, options)


if __name__ == "__main__":
    main()
