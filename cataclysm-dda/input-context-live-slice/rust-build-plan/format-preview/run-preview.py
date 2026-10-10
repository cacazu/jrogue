"""One trusted formatter on a fresh copy; default validates sources without a guard."""
from pathlib import Path
import argparse
import ast
import difflib
import hashlib
import json
import os
import re
import shutil
import struct
import sys
import time
import tomllib
import types

HERE = Path(__file__).resolve().parent
PLAN_PATH = HERE / "preview-plan.json"
PLAN_SHA = "1cfab4510f13daade7d352ae38545ef52ea245effa061ce031157d465e5953d8"
HELPER_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
STAGE = "actual-original-context-rustfmt-workcopy-preview"


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
                    not (getattr(directory.lstat(), "st_file_attributes", 0) & 0x400),
                    "owned output ancestry must be ordinary directories")


def load_sources():
    plan_data = checked_bytes(PLAN_PATH, PLAN_SHA)
    plan = json.loads(plan_data)
    helper_path = Path(plan["cpp2Helper"]["path"])
    helper_data = checked_bytes(helper_path, HELPER_SHA)
    require(buffer_pin(helper_path, helper_data) == plan["cpp2Helper"], "exact parsed helper pin required")
    helper = types.ModuleType("cdda_native_fixture_formatter_private_cpp2")
    helper.__file__ = str(helper_path)
    exec(compile(helper_data, str(helper_path), "exec", dont_inherit=True, optimize=0), helper.__dict__)
    require(plan["preparedUniquePinCount"] == 557 and len(plan["pins"]) == 557, "reviewed input counts changed")
    require(not plan["originalsMayChange"] and not plan["copybackAuthorized"] and not plan["initialProofMayChange"],
            "original source/initial proof must remain frozen")
    require(plan["guard"]["currentWrapper"]["sha256"] == helper.WRAPPER_SHA256 and
            plan["guard"]["historicalHelper"]["sha256"] == helper.GUARD_SHA256, "exact fixed guards required")
    gate, limits = plan["launchGate"], plan["ownedResourceGuard"]
    require(gate["minimumPhysicalFreeBytes"] == 4 * helper.GIB and
            gate["minimumExactCommitHeadroomBytes"] == 6 * helper.GIB and gate["soleOwnedHeavySlotParentConfirmed"],
            "fresh 4/6 parent gate changed")
    require(limits["maximumOwnedTreePrivateBytes"] == helper.GIB and limits["maximumOwnedTreeWorkingSetBytes"] == helper.GIB and
            limits["minimumPhysicalFreeBytes"] == 2 * helper.GIB and limits["minimumExactCommitHeadroomBytes"] == 2 * helper.GIB and
            limits["maximumStageSeconds"] == 180 and limits["sampleIntervalMilliseconds"] == 250,
            "fixed resource limits changed")
    require(plan["browserPriorityGate"] == {"physicalGiB": 7, "exactCommitGiB": 9}, "browser priority changed")
    require(plan["rustEnvironment"] == {"CARGO_NET_OFFLINE": "true", "CARGO_BUILD_JOBS": "1",
            "RUST_TEST_THREADS": "1", "RAYON_NUM_THREADS": "1"}, "one-worker offline environment required")
    expected = ["--edition", "2024", "--config-path", str(HERE / "rustfmt.toml"),
                "{work_lib}"]
    command = plan["command"]
    require(command == {"stage": STAGE, "executable": plan["installedRustfmt"]["path"],
                       "argvTemplate": expected, "cwdTemplate": "{work}"}, "exact workcopy-only command required")
    original_path = HERE.parent.parent / "rust-consumer/src/lib.rs"
    require(Path(plan["sourceFile"]["path"]) == original_path and plan["sourceEdition"] == "2024", "single fixture source boundary changed")
    manifest_path = original_path.parents[1] / "Cargo.toml"
    manifest_pin = next(item for item in plan["pins"] if Path(item["path"]) == manifest_path)
    manifest_data = checked_bytes(manifest_path, manifest_pin["sha256"])
    require(tomllib.loads(manifest_data.decode("utf-8"))["package"]["edition"] == plan["sourceEdition"], "manifest edition must match")
    source_data = checked_bytes(plan["acceptedInitialSourceCopy"]["path"], plan["acceptedInitialSourceCopy"]["sha256"])
    require(len(source_data) == plan["sourceFile"]["bytes"] and
            hashlib.sha256(source_data).hexdigest() == plan["sourceFile"]["sha256"], "exact initial accepted source required")
    records = helper.collect_pins([plan["pins"], buffer_pin(PLAN_PATH, plan_data), helper.pin(__file__)])
    require(len(records) == 559, "expected 559 final protected byte pins")
    helper.validate_pin_records(records)
    helper.validate_inherited_environment()
    ordinary_directory_ancestry(HERE)
    ordinary_directory_ancestry(HERE / "execution")
    return plan, records, helper, plan_data, helper_data, source_data


def execute(plan, records, helper, plan_data, helper_data, source_data, options):
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized 64-bit Windows Python required")
    require(options.parent_released_window and options.runner_sha256 == helper.digest(__file__),
            "separate parent reservation and exact reviewed owner hash required")
    destination = HERE / "execution" / options.attempt_name
    require(helper.within(destination, HERE / "execution"), "attempt escapes own preview evidence")
    ordinary_directory_ancestry(destination.parent)
    destination.mkdir(parents=True, exist_ok=False)
    (destination / "temporary").mkdir()
    (destination / "accepted-plan.json").write_bytes(plan_data)
    (destination / "accepted-cpp2-helper.py").write_bytes(helper_data)
    shutil.copyfile(__file__, destination / "accepted-preview-owner.py")
    terminal = {"schemaVersion": 1, "status": "preparing-owned-format-preview", "planSha256": PLAN_SHA,
        "runnerSha256": helper.digest(__file__), "stages": [], "RustfmtExecuted": False, "CargoExecuted": False,
        "ClippyExecuted": False, "compilerLaunched": False, "browserExecuted": False, "actualRustSourceEdited": False,
        "copybackAuthorized": False, "initialRustProofChanged": False, "candidates": []}
    controlled = {**helper.CONTROLLED_INHERITED, "TEMP": str(destination / "temporary"), "TMP": str(destination / "temporary")}
    previous = {key: os.environ.get(key) for key in controlled}
    before = None
    try:
        before = helper.fingerprints(records)
        helper.write_json(destination / "input-fingerprints-before.json", before)
        os.environ.update(controlled)
        wrapper, guard = helper.load_wrapper(plan)
        helper.validate_pin_records(records)
        captured = time.monotonic()
        counters = guard.counters()
        decision = helper.choose_launch(counters)
        stage = {"stage": STAGE, "decision": decision, "freshCounters": counters}
        terminal["stages"].append(stage)
        helper.write_json(destination / (STAGE + ".launch-decision.json"), stage)
        if decision != "launch":
            terminal["status"] = decision
        else:
            require(time.monotonic() - captured <= 15, "counter measurement stale")
            work = destination / "work"
            (work / "src").mkdir(parents=True, exist_ok=False)
            (destination / "before").mkdir()
            work_file = work / "src/lib.rs"
            work_file.write_bytes(source_data)
            (destination / "before/lib.rs").write_bytes(source_data)
            command = {"stage": STAGE, "executable": plan["command"]["executable"],
                "argv": [str(work_file) if value == "{work_lib}" else value for value in plan["command"]["argvTemplate"]],
                "cwd": str(work)}
            stage["argv"] = [command["executable"], *command["argv"]]
            terminal["ownedFormatterStageAttempted"] = True
            result = wrapper.run_owned(guard, command, destination)
            require(result["passed"] and result["exitCode"] == 0 and not result["remainingOwnedPidsBeforeJobClose"], "owned formatter failed")
            require(sorted(str(path.relative_to(work)) for path in work.rglob("*") if path.is_file()) == [str(Path("src/lib.rs"))],
                    "unexpected workcopy output membership")
            require(all(not path.is_symlink() and not (getattr(path.lstat(), "st_file_attributes", 0) & 0x400)
                        for path in work.rglob("*")), "workcopy reparse points forbidden")
            candidate = work_file.read_bytes()
            patch = "".join(difflib.unified_diff(source_data.decode("utf-8").splitlines(keepends=True),
                candidate.decode("utf-8").splitlines(keepends=True), fromfile="a/rust-consumer/src/lib.rs", tofile="b/rust-consumer/src/lib.rs"))
            (destination / "format-preview.patch").write_text(patch, encoding="utf-8", newline="")
            terminal["candidates"] = [{"original": plan["sourceFile"], "beforeCopy": helper.pin(destination / "before/lib.rs"),
                                       "formattedWorkcopy": helper.pin(work_file), "diff": helper.pin(destination / "format-preview.patch")}]
            stage.update(status="passed", durationSeconds=result["durationSeconds"], jobPeakPrivateBytes=result["jobPeakPrivateBytes"])
            terminal.update(status="preview-ready-for-parent-diff-and-log-review", RustfmtExecuted=True)
        helper.write_json(destination / (STAGE + ".verdict.json"), stage)
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-preview", failure=repr(error))
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        try:
            after = helper.fingerprints(records)
            helper.write_json(destination / "input-fingerprints-after.json", after)
            terminal["all559ProtectedPinnedBytesUnchanged"] = before is not None and before == after
            require(terminal["all559ProtectedPinnedBytesUnchanged"], "actual source/native/initial proof changed")
        except BaseException as error:
            terminal.update(status="failed-terminal-input-audit", terminalAuditFailure=repr(error))
        cleanups = []
        for stage in terminal["stages"]:
            if stage["decision"] != "launch":
                continue
            try:
                cleanup_path = destination / (STAGE + ".outer-cleanup.json")
                cleanup = json.loads(cleanup_path.read_bytes())
                metrics = json.loads((destination / (STAGE + ".json")).read_bytes())
                require(cleanup["passed"] and not cleanup["errors"] and not cleanup["remainingOwnedJobHandles"] and
                        not metrics["remainingOwnedPidsBeforeJobClose"], "owned formatter cleanup uncertain")
                roots = cleanup["rootsCreated"]
                require(len(roots) == 1 and all(any(row.get("processHandle") == root["processHandle"] and
                    row["action"] == "close-owned-process-handle" for row in cleanup["outerActions"]) for root in roots),
                    "one exact root handle must be explicitly closed")
                cleanups.append({"passed": True, "rootsCreated": roots, "remainingOwnedJobHandles": [], "evidence": helper.pin(cleanup_path)})
            except BaseException as error:
                cleanups.append({"passed": False, "failure": repr(error)})
        terminal["ownedCleanupRecords"] = cleanups
        terminal["allOwnedJobsAndExactRootHandlesClosed"] = all(row["passed"] for row in cleanups)
        if not terminal["allOwnedJobsAndExactRootHandlesClosed"]:
            terminal["status"] = "failed-owned-cleanup-uncertain"
        terminal["evidenceFiles"] = [helper.pin(path) for path in sorted(destination.rglob("*"))
            if path.is_file() and "temporary" not in path.relative_to(destination).parts and path.name != "terminal.json"]
        helper.write_json(destination / "terminal.json", terminal)
    print(json.dumps({key: terminal[key] for key in ["status", "RustfmtExecuted", "allOwnedJobsAndExactRootHandlesClosed"]}), flush=True)
    require(terminal["status"] in ["preview-ready-for-parent-diff-and-log-review", "deferred-browser-priority", "blocked-fresh-4-6-gate"],
            "preview stopped; preserve diagnostics and do not retry automatically")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--attempt-name", default="validation-only")
    options = parser.parse_args()
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name), "invalid fresh attempt name")
    ast.parse(Path(__file__).read_bytes(), filename=__file__)
    plan, records, helper, plan_data, helper_data, source_data = load_sources()
    if not options.run:
        result = {"schemaVersion": 1, "status": "formatter-preview-source-validated-no-guard-loaded", "runnerSha256": helper.digest(__file__),
            "planSha256": PLAN_SHA, "sourceEdition": "2024", "protectedUniqueFiles": len(records),
            "copybackAuthorized": False, "RustfmtExecuted": False, "CargoExecuted": False, "ClippyExecuted": False, "WindowsGuardLoaded": False}
        helper.write_json(HERE / "runner-source-validation.json", result)
        print(json.dumps(result), flush=True)
        return
    execute(plan, records, helper, plan_data, helper_data, source_data, options)


if __name__ == "__main__":
    main()
