"""Thin three-stage owner. Default validates bytes only; execution needs a reserved window."""
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
PLAN_PATH = HERE / "fixture-plan.json"
PLAN_SHA = "047c6aa89403d5be6bc69b8ee2b743b296089c6e1460341ebe5f137a284b759b"
CPP2 = HERE.parent / "build-plan/cpp-compile"
CPP2_HELPER_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
CPP2_PLAN_SHA = "f5e5f97a1cd2c8540f73675cc3d0bf8fc4cc462d48fa5f55a1b983c2ae1f3f0e"
STAGES = ["compile-synthetic-callback-fixture", "link-isolated-actual-snapshot-module",
          "genuine-node-wasm-module-fixture"]
EXPECTED_FIXTURES = ["root", "nested", "restored", "string-input", "boundary-14",
                     "boundary-15", "boundary-16", "boundary-17", "boundary-18"]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def checked_bytes(path, expected):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected, "fixed byte pin changed: " + str(path))
    return data


def buffer_pin(path, data):
    return {"path": str(Path(path).resolve()), "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest()}


def expected_wasm_names(source):
    # Bounded extraction for this exact reviewed script, not a general JS parser.
    reject_match = re.search(r"for \(const id of \[([0-9, ]+)\]\)", source)
    require(reject_match is not None, "reviewed reject-case loop absent")
    rejected = [int(item.strip()) for item in reject_match.group(1).split(",")]
    boundary_marker = "for (const [id, inspect] of ["
    require(source.count(boundary_marker) == 1, "reviewed boundary loop absent/ambiguous")
    region = source.split(boundary_marker, 1)[1].split("]) {", 1)[0]
    boundaries = [int(item) for item in re.findall(r"\[([0-9]+), v =>", region)]
    require(rejected == [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19] and
            boundaries == [14, 15, 16, 17, 18], "reviewed loop case identities changed")
    names = []
    for match in re.finditer(r"\b(?:asyncCheck|check)\((['\"`])(.*?)\1,", source):
        quote, name = match.groups()
        if quote != "`":
            require("${" not in name, "unexpected name interpolation")
            names.append(name)
        elif name == "actual encoder rejects invalid/beyond-limit case ${id}":
            names.extend(name.replace("${id}", str(item)) for item in rejected)
        elif name == "actual encoder accepts boundary case ${id}":
            names.extend(name.replace("${id}", str(item)) for item in boundaries)
        else:
            raise RuntimeError("unsupported reviewed check-name template")
    require(len(names) == 29 and len(set(names)) == 29, "exact 29 unique check names required")
    return names


def load_sources():
    # Each checked source/JSON is loaded once; those same buffers are compiled/parsed.
    plan_data = checked_bytes(PLAN_PATH, PLAN_SHA)
    helper_path = CPP2 / "run-compile-window.py"
    helper_data = checked_bytes(helper_path, CPP2_HELPER_SHA)
    base_data = checked_bytes(CPP2 / "compile-plan.json", CPP2_PLAN_SHA)
    helper = types.ModuleType("cdda_fixture_private_verified_cpp2")
    helper.__file__ = str(helper_path)
    exec(compile(helper_data, str(helper_path), "exec", dont_inherit=True, optimize=0), helper.__dict__)
    plan, base = json.loads(plan_data), json.loads(base_data)
    require([item["stage"] for item in plan["commands"]] == STAGES, "exact three stages required")
    require(plan["resourcePolicy"]["jobs"] == 1 and len(plan["pins"]) == 232, "reviewed worker/pin count changed")
    require(plan["guard"]["currentWrapper"]["sha256"] == helper.WRAPPER_SHA256 and
            plan["guard"]["historicalHelper"]["sha256"] == helper.GUARD_SHA256, "guard pins changed")
    require(plan["commands"][1]["argv"].count("--no-entry") == 1, "mainless fixture required")
    for command in plan["commands"]:
        require(Path(command["cwd"]).resolve() == HERE, "stage cwd must be exact fixture root")
        for output in command["outputs"]:
            require(helper.within(output, HERE), "stage output escapes fixture root")
    require(not plan["pointObjectIncluded"], "point object is outside this exact trial")
    helper.validate_inherited_environment()
    records = list(plan["pins"]) + [buffer_pin(PLAN_PATH, plan_data),
                                   buffer_pin(helper_path, helper_data), helper.pin(__file__)]
    helper.validate_pin_records(records)
    base_pin = next(item for item in plan["pins"] if
                    Path(item["path"]).resolve() == (CPP2 / "compile-plan.json").resolve())
    require(base_pin == buffer_pin(CPP2 / "compile-plan.json", base_data),
            "parsed CPP2 base buffer must remain in final-audit pins")
    host_path = HERE / "test-wasm.mjs"
    host_pin = next(item for item in plan["pins"] if Path(item["path"]).resolve() == host_path)
    host_data = checked_bytes(host_path, host_pin["sha256"])
    plan["expectedWasmCheckNames"] = expected_wasm_names(host_data.decode("utf-8"))
    # Flat runtime fields are the exact proven CPP2 guard policy, never new thresholds.
    guard_plan = dict(plan)
    for key in ["launchGate", "ownedResourceGuard", "removeInheritedEnvironment", "rustEnvironment"]:
        guard_plan[key] = base[key]
    require(guard_plan["launchGate"]["minimumPhysicalFreeBytes"] == 4 * helper.GIB and
            guard_plan["launchGate"]["minimumExactCommitHeadroomBytes"] == 6 * helper.GIB,
            "proven launch thresholds changed")
    resource = guard_plan["ownedResourceGuard"]
    require(resource["maximumOwnedTreePrivateBytes"] == helper.GIB and
            resource["maximumOwnedTreeWorkingSetBytes"] == helper.GIB and
            resource["minimumPhysicalFreeBytes"] == 2 * helper.GIB and
            resource["minimumExactCommitHeadroomBytes"] == 2 * helper.GIB and
            resource["maximumStageSeconds"] == 180, "proven running bounds changed")
    return plan, guard_plan, records, helper, plan_data, helper_data, base_data


def artifacts(command):
    paths = [Path(name) for name in command["outputs"]]
    if command["stage"] == STAGES[2]:
        paths.extend(HERE / "execution/wasm-results" / (name + ".json") for name in EXPECTED_FIXTURES)
    return paths


def archive(command, destination, helper):
    target = destination / "outputs" / command["stage"]
    target.mkdir(parents=True, exist_ok=False)
    result = []
    for source in artifacts(command):
        if source.exists():
            require(helper.within(source, HERE) and source.is_file() and not source.is_symlink() and
                    not (getattr(source.lstat(), "st_file_attributes", 0) & 0x400), "unsafe output type/path")
            copy = target / source.name
            shutil.copyfile(source, copy)
            require(helper.digest(source) == helper.digest(copy), "archive byte mismatch")
            result.append({**helper.pin(source), "archive": helper.pin(copy)})
    return result


def verify(command, records, derived, expected_names, helper):
    if command["stage"] == STAGES[0]:
        compatible = {**command, "outputObject": command["outputs"][0],
                      "outputDependencyFile": command["outputs"][1]}
        # The proven MMD verifier resolves its required header at the real CPP2 root.
        return {"actualNonSystemDependencies": helper.verify_outputs(compatible, records)}
    if command["stage"] == STAGES[1]:
        js, wasm = map(Path, command["outputs"])
        require(js.is_file() and js.stat().st_size > 0 and wasm.is_file(), "linked fixture outputs missing")
        with wasm.open("rb") as stream:
            require(stream.read(8) == b"\x00asm\x01\x00\x00\x00", "linked output is not wasm v1")
        with js.open("r", encoding="utf-8") as stream:
            while stream.read(65536):
                pass
        return {"linkOnly": True, "moduleRuntimeVerified": False}
    proof = json.loads(Path(command["outputs"][0]).read_bytes())
    require(proof["status"] == "actual-snapshot-module-wasm-synthetic-callback-fixture-passed" and
            proof["actualModuleExecuted"] is True and proof["genuineWasmExportTests"] == 29 and
            len(proof["reports"]) == 29 and all(item["passed"] is True for item in proof["reports"]) and
            [item["name"] for item in proof["reports"]] == expected_names,
            "actual WASM assertion proof missing/incomplete")
    require(set(proof["fixturePins"]) == set(EXPECTED_FIXTURES), "exact native JSON fixture set required")
    require(set(proof["artifacts"]) == {"snapshot-fixture.mjs", "snapshot-fixture.wasm"} and
            proof["callbackContextsAreSynthetic"] is True, "exact linked artifacts/synthetic scope required")
    for name in EXPECTED_FIXTURES:
        item = helper.pin(HERE / "execution/wasm-results" / (name + ".json"))
        require(proof["fixturePins"][name] == {key: item[key] for key in ["bytes", "sha256"]}, "native JSON pin mismatch")
    for name, expected in proof["artifacts"].items():
        item = helper.pin(HERE / "build" / name)
        require(expected == {key: item[key] for key in ["bytes", "sha256"]} and
                derived[str(Path(item["path"]).resolve())] == item, "linked input artifact changed")
    require(all(proof[key] is False for key in ["originalInputContextExecuted",
        "originalActionContextsLookupVerified", "liveEngineIntegration", "gameplayOwnershipVerified",
        "RustConsumerExecuted", "wholeGameProof"]), "fixture overclaimed native producer scope")
    return {"actualModuleExecuted": True, "genuineWasmExportTests": 29, "nativeJsonFixtures": 9}


def execute(plan, guard_plan, records, helper, plan_data, helper_data, base_data, options):
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized 64-bit Windows Python required")
    require(options.parent_released_window and options.runner_sha256 == helper.digest(__file__),
            "separate parent reservation and exact reviewed owner hash required")
    require(not (HERE / "build").exists() and not (HERE / "execution/wasm-results").exists(),
            "refuse replacement of prior fixture artifacts; no automatic retry")
    destination = HERE / "execution" / options.attempt_name
    require(helper.within(destination, HERE / "execution"), "attempt escaped owned root")
    destination.mkdir(parents=True, exist_ok=False)
    (destination / "temporary").mkdir()
    (destination / "accepted-fixture-plan.json").write_bytes(plan_data)
    (destination / "accepted-cpp2-helper.py").write_bytes(helper_data)
    (destination / "accepted-cpp2-base-plan.json").write_bytes(base_data)
    shutil.copyfile(__file__, destination / "accepted-owner.py")
    terminal = {"schemaVersion": 1, "status": "preparing-owned-window", "planSha256": PLAN_SHA,
                "runnerSha256": helper.digest(__file__), "cpp2HelperSha256": CPP2_HELPER_SHA,
                "stages": [], "ownedRootCount": 0, "callbackContextsAreSynthetic": True,
                "fixtureCompilePassed": False, "fixtureLinkPassed": False, "WasmTestsPassed": False,
                "originalInputContextRuntimeVerified": False, "originalActionContextsLookupVerified": False,
                "RustExecuted": False, "liveEngineIntegrated": False, "wholeGameVerified": False}
    terminal["expectedWasmCheckNames"] = plan["expectedWasmCheckNames"]
    before, trees, derived = None, None, {}
    controlled = {**helper.CONTROLLED_INHERITED, "TEMP": str(destination / "temporary"), "TMP": str(destination / "temporary")}
    old_environment = {key: os.environ.get(key) for key in controlled}
    try:
        before = helper.fingerprints(records)
        trees = {key: helper.metadata_tree(plan["frozenSDK"][key]) for key in ["cache", "ports"]}
        helper.write_json(destination / "input-fingerprints-before.json", before)
        helper.write_json(destination / "frozen-tree-metadata-before.json", trees)
        os.environ.update(controlled)
        wrapper, guard = helper.load_wrapper(guard_plan)
        for command in plan["commands"]:
            helper.validate_pin_records(records)
            helper.validate_pin_records(list(derived.values()))
            require(all(helper.metadata_tree(plan["frozenSDK"][key]) == trees[key] for key in trees), "frozen cache/ports changed")
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
            require(time.monotonic() - captured <= 15, "counter measurement stale")
            if command["stage"] == STAGES[0]:
                # A no-fit/browser-priority attempt has no fixed build directory.
                # Once launch is selected, retain even partial artifacts on failure.
                (HERE / "build").mkdir(exist_ok=False)
            try:
                result = wrapper.run_owned(guard, command, destination)
                cleanup = json.loads((destination / (command["stage"] + ".outer-cleanup.json")).read_bytes())
                require(cleanup["passed"] and not cleanup["remainingOwnedJobHandles"], "owned cleanup uncertain")
                require(result["passed"] and result["exitCode"] == 0 and
                        not result["remainingOwnedPidsBeforeJobClose"], "owned stage failed/not empty")
                helper.validate_pin_records(list(derived.values()))
                stage.update(verify(command, records, derived, plan["expectedWasmCheckNames"], helper))
                stage.update(status="passed", durationSeconds=result["durationSeconds"],
                             jobPeakPrivateBytes=result["jobPeakPrivateBytes"],
                             maximumSampledWorkingSetBytes=max((item["ownedWorkingSetBytes"] for item in result["samples"]), default=0))
                for path in artifacts(command):
                    derived[str(path.resolve())] = helper.pin(path)
                terminal[{STAGES[0]: "fixtureCompilePassed", STAGES[1]: "fixtureLinkPassed", STAGES[2]: "WasmTestsPassed"}[command["stage"]]] = True
            except BaseException as error:
                stage.update(status="failed-stopped", failure=repr(error))
                raise
            finally:
                stage["artifacts"] = archive(command, destination, helper)
                helper.write_json(destination / (command["stage"] + ".verdict.json"), stage)
            require(helper.fingerprints(records) == before, "protected byte pins changed")
        else:
            terminal["status"] = "actual-module-wasm-synthetic-fixture-passed"
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-window", failure=repr(error))
    finally:
        for key, value in old_environment.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        try:
            after = helper.fingerprints(records)
            after_trees = {key: helper.metadata_tree(plan["frozenSDK"][key]) for key in ["cache", "ports"]}
            helper.write_json(destination / "input-fingerprints-after.json", after)
            helper.write_json(destination / "frozen-tree-metadata-after.json", after_trees)
            terminal["protectedPinnedBytesUnchanged"] = before is not None and before == after
            terminal["frozenMetadataUnchanged"] = trees is not None and trees == after_trees
            require(terminal["protectedPinnedBytesUnchanged"] and terminal["frozenMetadataUnchanged"], "terminal input audit failed")
            helper.validate_pin_records(list(derived.values()))
        except BaseException as error:
            terminal.update(status="failed-terminal-audit", terminalAuditFailure=repr(error))
        cleanups = []
        for stage in terminal["stages"]:
            if stage["decision"] != "launch":
                continue
            path = destination / (stage["stage"] + ".outer-cleanup.json")
            try:
                record = json.loads(path.read_bytes())
                terminal["ownedRootCount"] += len(record["rootsCreated"])
                cleanups.append({"stage": stage["stage"], "passed": record["passed"],
                                 "remainingOwnedJobHandles": record["remainingOwnedJobHandles"], "evidence": helper.pin(path)})
            except BaseException as error:
                cleanups.append({"stage": stage["stage"], "passed": False, "failure": repr(error)})
        terminal["ownedCleanupRecords"] = cleanups
        terminal["ownedJobsClosedAndRootsWaited"] = all(item["passed"] and not item.get("remainingOwnedJobHandles", []) for item in cleanups)
        if not terminal["ownedJobsClosedAndRootsWaited"]:
            terminal["status"] = "failed-owned-cleanup-uncertain"
        terminal["derivedArtifactPins"] = list(derived.values())
        terminal["evidenceFiles"] = [helper.pin(path) for path in sorted(destination.rglob("*"))
                                   if path.is_file() and "temporary" not in path.relative_to(destination).parts and path.name != "terminal.json"]
        helper.write_json(destination / "terminal.json", terminal)
    print(json.dumps({key: terminal[key] for key in ["status", "ownedRootCount", "ownedJobsClosedAndRootsWaited",
                     "fixtureCompilePassed", "fixtureLinkPassed", "WasmTestsPassed"]}), flush=True)
    require(terminal["status"] in ["actual-module-wasm-synthetic-fixture-passed", "deferred-browser-priority", "blocked-fresh-4-6-gate"], "fixture window stopped; inspect archived terminal/diagnostics")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--attempt-name", default="validation-only")
    options = parser.parse_args()
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name), "invalid attempt name")
    require(options.attempt_name != "wasm-results", "attempt name collides with fixed native fixture outputs")
    ast.parse(Path(__file__).read_bytes(), filename=__file__)
    plan, guard_plan, records, helper, plan_data, helper_data, base_data = load_sources()
    if not options.run:
        result = {"schemaVersion": 1, "status": "thin-owner-source-validated-no-windows-guard-loaded",
                  "runnerSha256": helper.digest(__file__), "planSha256": PLAN_SHA,
                  "cpp2HelperSha256": CPP2_HELPER_SHA, "uniquePinnedFiles": len(records),
                  "fixtureCompileExecuted": False, "fixtureLinkExecuted": False,
                  "WasmExecuted": False, "RustExecuted": False, "WindowsGuardLoaded": False}
        result["expectedWasmCheckNames"] = plan["expectedWasmCheckNames"]
        helper.write_json(HERE / "runner-source-validation.json", result)
        print(json.dumps(result), flush=True)
        return
    execute(plan, guard_plan, records, helper, plan_data, helper_data, base_data, options)


if __name__ == "__main__":
    main()
