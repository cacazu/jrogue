"""Thin source-pinned six-TU adapter to the unchanged exercised CPP2 outer owner.
Validation mode loads no Windows guard and launches no compiler/process.
"""
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
PLAN_PATH = HERE / "COMPILE-WINDOW-PLAN.json"
PLAN_SHA = "d9023bbce0f8a4b567c71fb630e0db8b3af29ca3a37c19122e7757c32cbf1379"
CPP2_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
WRAPPER_SHA = "0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb"
STAGES = ["compile-help", "compile-input", "compile-input_context", "compile-cdda_help_semantic", "compile-cdda_help_transport", "compile-original-producer-fixture"]


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def checked_bytes(path, expected):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected, "fixed source/plan changed: " + str(path))
    return data


def load_sources():
    data = checked_bytes(PLAN_PATH, PLAN_SHA)
    plan = json.loads(data)
    helper_path = Path(plan["cpp2Helper"]["path"])
    helper_data = checked_bytes(helper_path, CPP2_SHA)
    helper = types.ModuleType("cdda_help_transport_private_fixed_cpp2")
    helper.__file__ = str(helper_path)
    exec(compile(helper_data, str(helper_path), "exec", dont_inherit=True, optimize=0), helper.__dict__)
    require(plan["sourceCommit"] == "7b2efa5cea38e4d4d97dd0e63b28b9148623da59", "source identity")
    require(plan["browserRecoveryHasPriority"] and plan["parentExclusiveSlotReleaseRequired"], "priority/ownership")
    require([x["stage"] for x in plan["commands"]] == STAGES, "exact six compile-only commands")
    require(plan["guard"]["currentWrapper"]["sha256"] == WRAPPER_SHA, "fixed outer owner changed")
    require(plan["launchGate"]["minimumPhysicalFreeBytes"] == 4 * helper.GIB and
            plan["launchGate"]["minimumExactCommitHeadroomBytes"] == 6 * helper.GIB, "fresh 4/6 gate")
    guard = plan["ownedResourceGuard"]
    require(guard["maximumOwnedTreePrivateBytes"] == helper.GIB and
            guard["maximumOwnedTreeWorkingSetBytes"] == helper.GIB and
            guard["minimumPhysicalFreeBytes"] == 2 * helper.GIB and
            guard["minimumExactCommitHeadroomBytes"] == 2 * helper.GIB and
            guard["maximumStageSeconds"] == 180 and guard["sampleIntervalMilliseconds"] == 250, "fixed caps/floors/time")
    require(plan["rustEnvironment"] == {} and plan["affectedOriginalUnitsBeforeFullRelink"] == 231, "bounded scope")
    require(plan["stagedTree"]["fileCount"] == 969 and Path(plan["stagedTree"]["path"]) == HERE / "build/sources/src", "coherent staged tree")
    for parent in [HERE, HERE / "build", HERE / "build/sources", HERE / "build/sources/src"]:
        state = parent.lstat()
        require(parent.is_dir() and not parent.is_symlink() and not getattr(state, "st_file_attributes", 0) & 0x400, "unsafe owned parent")
    for output_parent in [HERE / "build/objects", HERE / "execution"]:
        if output_parent.exists():
            state = output_parent.lstat()
            require(output_parent.is_dir() and not output_parent.is_symlink() and not getattr(state, "st_file_attributes", 0) & 0x400, "unsafe output/attempt parent")
    helper.metadata_tree(HERE / "build/sources/src")  # reject nested junction/symlink members
    files = sorted(str(p.resolve()) for p in (HERE / "build/sources/src").rglob("*") if p.is_file())
    staged_pins = [x for x in plan["pins"] if helper.within(x["path"], HERE / "build/sources/src")]
    require(files == sorted(str(Path(x["path"]).resolve()) for x in staged_pins), "coherent source membership changed")
    for command in plan["commands"]:
        require(Path(command["cwd"]) == HERE / "build", "owned compiler cwd")
        require(helper.within(command["outputObject"], HERE / "build/objects") and
                Path(command["outputDependencyFile"]) == Path(command["outputObject"]).with_suffix(".d"), "owned exact outputs")
        argv = command["argv"]
        require(argv[:3] == [plan["commands"][0]["argv"][0], "-v", "-I" + str(HERE / "build/sources/src")], "source include priority")
        require(argv[3:-6] == plan["exactBaseFlags"] and
                argv[-6:] == ["-MMD", "-MP", "-c", command["source"], "-o", command["outputObject"]], "exact compile-only argv")
        require(command["environment"] == {"EM_CONFIG": str(HERE / "build/.emscripten"),
                "EM_CACHE": plan["frozenSDK"]["cache"], "EM_PORTS": plan["frozenSDK"]["ports"],
                "EMSDK_PYTHON": command["executable"], "EMCC_CORES": "1", "EMCC_BATCH_BUILD": "0", "BINARYEN_CORES": "1"}, "frozen one-worker env")
    records = [*plan["pins"], helper.pin(PLAN_PATH), helper.pin(__file__)]
    helper.validate_pin_records(records)
    helper.validate_inherited_environment()
    require((HERE / "build/.emscripten").read_text(encoding="utf-8").splitlines()[-1] == "FROZEN_CACHE = True", "frozen SDK config")
    return plan, helper, records, data, helper_data


def verify_outputs(command, records, helper):
    obj, dep = Path(command["outputObject"]), Path(command["outputDependencyFile"])
    require(obj.is_file() and dep.is_file() and obj.stat().st_size > 8, "TU outputs absent")
    require(obj.open("rb").read(8) == b"\x00asm\x01\x00\x00\x00", "WASM v1 object")
    line = re.sub(r"\\\r?\n", " ", dep.read_text(encoding="utf-8")).splitlines()[0]
    separator = line.find(": ")
    require(separator > 0, "MMD target format")
    resolved = sorted({str(Path(x).resolve()) for x in line[separator + 2:].split()})
    known = {str(Path(x["path"]).resolve()): x for x in records}
    require(not [x for x in resolved if x not in known], "actual non-system dependencies lack protected byte pins")
    require(str(Path(command["source"]).resolve()) in resolved and
            str((HERE / "build/sources/src/cdda_help_semantic.h").resolve()) in resolved, "source/semantic sibling header missing")
    return [known[x] for x in resolved]


def archive(command, destination, helper):
    result = []
    target = destination / "outputs" / command["stage"]
    target.mkdir(parents=True, exist_ok=False)
    for key in ["outputObject", "outputDependencyFile"]:
        source = Path(command[key])
        if source.exists():
            require(helper.within(source, HERE / "build/objects") and source.is_file() and not source.is_symlink() and not getattr(source.lstat(), "st_file_attributes", 0) & 0x400, "output path/type")
            copy = target / source.name
            shutil.copyfile(source, copy)
            require(helper.digest(source) == helper.digest(copy), "output archive mismatch")
            result.append({"role": key, **helper.pin(source), "archive": helper.pin(copy)})
    return result


def execute(plan, helper, records, data, helper_data, options):
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized 64-bit Windows")
    require(options.parent_released_window and options.runner_sha256 == helper.digest(__file__), "exact separately released runner")
    require(all(not Path(c[k]).exists() for c in plan["commands"] for k in ["outputObject", "outputDependencyFile"]), "no output overwrite/retry")
    destination = HERE / "execution" / options.attempt_name
    require(helper.within(destination, HERE / "execution"), "attempt containment")
    destination.mkdir(parents=True, exist_ok=False)
    temporary = destination / "temporary"
    temporary.mkdir()
    (destination / "accepted-plan.json").write_bytes(data)
    (destination / "accepted-cpp2-helper.py").write_bytes(helper_data)
    shutil.copyfile(__file__, destination / "accepted-owner.py")
    terminal = {"schemaVersion": 1, "status": "preparing-owned-window", "planSha256": PLAN_SHA,
                "runnerSha256": helper.digest(__file__), "cpp2HelperSha256": CPP2_SHA, "stages": [],
                "originalProducerExecuted": False, "RustExecuted": False, "linkExecuted": False,
                "browserExecuted": False, "wholeGameAccepted": False, "affectedOriginalUnitsBeforeFullRelink": 231}
    before, trees, source_tree = None, None, None
    controlled = {**helper.CONTROLLED_INHERITED, "TEMP": str(temporary), "TMP": str(temporary)}
    old = {k: os.environ.get(k) for k in controlled}
    try:
        before = helper.fingerprints(records)
        trees = {k: helper.metadata_tree(plan["frozenSDK"][k]) for k in ["cache", "ports"]}
        source_tree = helper.metadata_tree(HERE / "build/sources/src")
        helper.write_json(destination / "source-tree-before.json", source_tree)
        helper.write_json(destination / "pins-before.json", before)
        helper.write_json(destination / "frozen-metadata-before.json", trees)
        os.environ.update(controlled)
        wrapper, guard = helper.load_wrapper(plan)
        for command in plan["commands"]:
            helper.validate_pin_records(records)
            require(helper.metadata_tree(HERE / "build/sources/src") == source_tree, "coherent source membership/metadata changed")
            require(all(helper.metadata_tree(plan["frozenSDK"][k]) == trees[k] for k in trees), "frozen cache/ports changed")
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
            require(time.monotonic() - captured <= 15, "stale counters")
            (HERE / "build/objects").mkdir(exist_ok=True)
            try:
                result = wrapper.run_owned(guard, command, destination)
                cleanup = json.loads((destination / (command["stage"] + ".outer-cleanup.json")).read_bytes())
                require(cleanup["passed"] and not cleanup["remainingOwnedJobHandles"], "owned job cleanup incomplete")
                require(result["passed"] and result["exitCode"] == 0 and not result["remainingOwnedPidsBeforeJobClose"], "owned compiler stage failed")
                stage.update(status="compile-only-passed", durationSeconds=result["durationSeconds"],
                             jobPeakPrivateBytes=result["jobPeakPrivateBytes"],
                             maximumSampledWorkingSetBytes=max((x["ownedWorkingSetBytes"] for x in result["samples"]), default=0),
                             actualNonSystemDependencies=verify_outputs(command, records, helper))
            except BaseException as error:
                stage.update(status="failed-owned-stage", failure=repr(error))
                raise
            finally:
                stage["outputs"] = archive(command, destination, helper)
                helper.write_json(destination / (command["stage"] + ".verdict.json"), stage)
            require(helper.fingerprints(records) == before, "protected input bytes changed")
        else:
            terminal["status"] = "six-translation-units-compile-only-passed"
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-window", failure=repr(error))
    finally:
        for key, value in old.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        try:
            after = helper.fingerprints(records)
            after_trees = {k: helper.metadata_tree(plan["frozenSDK"][k]) for k in ["cache", "ports"]}
            helper.write_json(destination / "pins-after.json", after)
            helper.write_json(destination / "frozen-metadata-after.json", after_trees)
            terminal["protectedPinnedBytesUnchanged"] = before is not None and before == after
            terminal["frozenMetadataUnchanged"] = trees is not None and trees == after_trees
            after_source_tree = helper.metadata_tree(HERE / "build/sources/src")
            helper.write_json(destination / "source-tree-after.json", after_source_tree)
            terminal["sourceTreeUnchanged"] = source_tree is not None and source_tree == after_source_tree
            require(terminal["protectedPinnedBytesUnchanged"] and terminal["frozenMetadataUnchanged"] and terminal["sourceTreeUnchanged"], "final input audit")
        except BaseException as error:
            terminal.update(status="failed-terminal-input-audit", terminalAuditFailure=repr(error))
        cleanups = []
        for stage in terminal["stages"]:
            if stage["decision"] != "launch":
                continue
            path = destination / (stage["stage"] + ".outer-cleanup.json")
            try:
                record = json.loads(path.read_bytes())
                cleanups.append({"stage": stage["stage"], "passed": record["passed"],
                                 "remainingOwnedJobHandles": record["remainingOwnedJobHandles"],
                                 "rootsCreated": record["rootsCreated"], "evidence": helper.pin(path)})
            except BaseException as error:
                cleanups.append({"stage": stage["stage"], "passed": False, "failure": repr(error)})
        terminal["cleanupRecords"] = cleanups
        terminal["ownedJobsClosedAndRootsWaited"] = all(x["passed"] and not x.get("remainingOwnedJobHandles", []) for x in cleanups)
        if not terminal["ownedJobsClosedAndRootsWaited"]:
            terminal["status"] = "failed-owned-cleanup-uncertain"
        helper.write_json(destination / "terminal.json", terminal)
    print(json.dumps({"status": terminal["status"], "stages": len(terminal["stages"]),
                      "ownedJobsClosedAndRootsWaited": terminal["ownedJobsClosedAndRootsWaited"]}), flush=True)
    require(terminal["status"] in ["six-translation-units-compile-only-passed", "deferred-browser-priority", "blocked-fresh-4-6-gate"], "inspect preserved terminal")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--attempt-name", default="validation-only")
    options = parser.parse_args()
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name), "attempt name")
    ast.parse(Path(__file__).read_bytes(), filename=__file__)
    plan, helper, records, data, helper_data = load_sources()
    if not options.run:
        result = {"schemaVersion": 1, "status": "thin-owner-source-validated-no-windows-guard-loaded",
                  "runnerSha256": helper.digest(__file__), "planSha256": PLAN_SHA,
                  "protectedFiles": len(records), "compilerExecuted": False, "linkExecuted": False,
                  "originalProducerExecuted": False, "RustExecuted": False, "WindowsGuardLoaded": False}
        helper.write_json(HERE / "OWNER-SOURCE-VALIDATION.json", result)
        print(json.dumps(result), flush=True)
        return
    execute(plan, helper, records, data, helper_data, options)


if __name__ == "__main__":
    main()
