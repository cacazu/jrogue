"""One held WASM --no-run stage; default performs only frozen source validation."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import ast
import copy
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
QUALITY = HERE.parent
PLAN_PATH = HERE / "continuation-plan.json"
PLAN_SHA = "99c9a2c84bc41dae59919e34237a1e23eadecedc2b0da0bc8e437213aa89d842"
QUALITY_OWNER_SHA = "2518ef1ae96719329a91b3920be238661abb2dd8d71a0304ecc41a1971ff8008"
QUALITY_PLAN_SHA = "e550a5d2674bd803e6804b6acd9b6077b607b9d3b5e1d4d822800255b5525faa"
QUALITY_PROOF_SHA = "32dbd4e36c6eaf3b490b9bdb7af9990dedddf4a2360e3d447f62608899a51cf6"
QUALITY_TERMINAL_SHA = "5f5d0ee7b87903307a447d50b82fb86cea54e25115d2d0121ff2dd9f9c627cba"
STAGE = "original-context-wasm-five-tests-no-run"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def checked_bytes(path, digest):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == digest, "fixed source/evidence changed: " + str(path))
    return data


def buffer_pin(path, data):
    return {"path": str(Path(path).resolve()), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def exact_integer_strings(value, location="$", rows=None):
    if rows is None:
        rows = []
    if type(value) is int and abs(value) > 2**53 - 1:
        rows.append({"jsonPath": location, "decimal": str(value)})
    elif isinstance(value, dict):
        for key, child in value.items():
            exact_integer_strings(child, location + "[" + json.dumps(key) + "]", rows)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            exact_integer_strings(child, location + "[" + str(index) + "]", rows)
    return rows


def ordinary_directory_ancestry(path):
    for directory in [path, *path.parents]:
        if directory.exists():
            require(directory.is_dir() and not directory.is_symlink() and
                    not (getattr(directory.lstat(), "st_file_attributes", 0) & 0x400), "owned output ancestry must be ordinary")


def load_sources():
    plan_data = checked_bytes(PLAN_PATH, PLAN_SHA)
    plan = json.loads(plan_data)
    owner_path = QUALITY / "run-quality-window.py"
    owner_data = checked_bytes(owner_path, QUALITY_OWNER_SHA)
    quality = types.ModuleType("cdda_wasm_continuation_accepted_quality_source")
    quality.__file__ = str(owner_path)
    exec(compile(owner_data, str(owner_path), "exec", dont_inherit=True, optimize=0), quality.__dict__)
    prior, prior_records, helper, initial, prior_plan_data, helper_data, initial_data = quality.load_sources()
    require(len(prior_records) == 594, "accepted protected quality set must remain exact594")
    require(buffer_pin(QUALITY / "quality-plan.json", prior_plan_data) == plan["previousQualityPlan"] and
            plan["previousQualityPlan"]["sha256"] == QUALITY_PLAN_SHA and
            buffer_pin(owner_path, owner_data) == plan["previousQualityOwner"], "exact accepted owner/plan provenance required")
    for key in ["sourceCommit", "cpp2Helper", "installedTools", "guard", "launchGate", "ownedResourceGuard", "browserPriorityGate",
                "removeInheritedEnvironment", "rustEnvironment", "config", "derivedPackageSource", "expectedOrderedTests", "actualNativeJsonPins", "acceptedOriginalProof"]:
        require(plan[key] == prior[key], "inherited accepted contract changed: " + key)
    require(plan["newOwnedTarget"] == str(HERE / "target") and
            plan["previousQualityTargetMustRemainUnchanged"] == prior["newOwnedTarget"] and
            plan["initialExecutedTargetMustRemainUnchanged"] == prior["initialExecutedTargetMustRemainUnchanged"], "fresh own target required")
    expected = copy.deepcopy(prior["commands"][3])
    expected["argv"][expected["argv"].index("--target-dir") + 1] = str(HERE / "target")
    require(plan["commands"] == [expected] and expected["stage"] == STAGE and
            expected["argv"][0] == "test" and "--no-run" in expected["argv"] and expected["argv"][-1] == "--lib",
            "only exact held WASM test-harness compile may launch")
    require(plan["previousFirstThreeStagesMustNotRerun"] is True and plan["WasmNoRunProcessPreparedOnly"] is True and
            plan["RustTestsExecutedInThisContinuation"] is False and type(plan["distinctTestsAdded"]) is int and plan["distinctTestsAdded"] == 0,
            "no rerun, runtime or new-count credit allowed")
    require(plan["launchDecisionEvidence"] == {"capturedUTCRequired": True, "utcClock": "datetime.now(timezone.utc).isoformat()",
            "monotonicClock": "time.monotonic_ns()", "monotonicAgeRequiredImmediatelyBeforeOwnedLaunch": True,
            "maximumAgeMilliseconds": 15000, "negativeAgeBlocksLaunch": True}, "explicit fresh UTC/monotonic decision contract required")
    proof_path = QUALITY / "QUALITY-VERIFICATION.json"
    proof_data = checked_bytes(proof_path, QUALITY_PROOF_SHA)
    proof = json.loads(proof_data)
    terminal_path = QUALITY / "execution/original-context-quality-initial/terminal.json"
    terminal_data = checked_bytes(terminal_path, QUALITY_TERMINAL_SHA)
    terminal = json.loads(terminal_data)
    require(buffer_pin(proof_path, proof_data) == plan["previousQualityProof"] and
            buffer_pin(terminal_path, terminal_data) == plan["previousQualityTerminal"] and
            proof["terminalEvidence"] == plan["previousQualityTerminal"], "frozen accepted prior evidence required")
    require(proof["status"] == terminal["status"] == "blocked-fresh-4-6-gate" and
            proof["planSha256"] == QUALITY_PLAN_SHA and proof["ownerSha256"] == QUALITY_OWNER_SHA, "prior proof scope/identity changed")
    for source in [proof, terminal]:
        for key in ["formatCheckPassed", "sameFiveTestsPassed", "ClippyPassed", "all594ProtectedPinnedBytesUnchanged", "allOwnedJobsAndExactRootHandlesClosed"]:
            require(source[key] is True, "prior pass/closure absent: " + key)
        require(source["WasmNoRunCompilePassed"] is False, "prior fourth stage must remain uncompiled")
    require(proof["WasmNoRunProcessCreated"] is False and type(proof["sameFiveTestsNewCount"]) is int and proof["sameFiveTestsNewCount"] == 0,
            "prior WASM launch/new-count credit forbidden")
    require(len(terminal["stages"]) == 4 and len(terminal["ownedCleanupRecords"]) == 3, "exact prior attempted stage count changed")
    for index, stage in enumerate(terminal["stages"]):
        command = prior["commands"][index]
        require(stage["stage"] == command["stage"] and stage["argv"] == [command["executable"], *command["argv"]], "prior exact argv changed")
        if index < 3:
            require(stage["decision"] == "launch" and stage["status"] == "passed", "prior first-three pass changed")
        else:
            require(stage["decision"] == "blocked-fresh-4-6-gate" and "status" not in stage, "prior fourth stage must have no execution verdict")
    require(len(plan["expectedOrderedTests"]) == 5 and len(plan["actualNativeJsonPins"]) == 24, "same five tests/24 actual native records required")
    root_strings = []
    for command in prior["commands"][:3]:
        metrics_path = QUALITY / "execution/original-context-quality-initial" / (command["stage"] + ".json")
        metrics = json.loads(metrics_path.read_bytes())
        require(type(metrics["rootIdentity"]["creationFiletime"]) is int, "raw FILETIME must remain exact")
        root_strings.append({"stage": command["stage"], "metrics": helper.pin(metrics_path),
                             "exactIntegerStrings": exact_integer_strings(metrics["rootIdentity"])})
    require(plan["previousMetricRootIntegerStrings"] == root_strings, "prior exact root decimal strings changed")
    require(len(plan["pins"]) == plan["preparedUniquePinCount"], "prepared pin count changed")
    records = helper.collect_pins([plan["pins"], buffer_pin(PLAN_PATH, plan_data), helper.pin(__file__)])
    require(len(records) == len(plan["pins"]) + 2, "fresh plan/owner must add exactly two protected files")
    expected_pins = helper.collect_pins([prior_records, plan["previousQualityProof"], plan["previousQualityTerminal"], proof["evidence"], terminal["evidenceFiles"], helper.pin(HERE / "prepare-continuation.py")])
    require(helper.collect_pins([plan["pins"]]) == expected_pins, "exact accepted source/raw-evidence plus preparer pin set required")
    helper.validate_pin_records(records)
    helper.validate_inherited_environment()
    ordinary_directory_ancestry(HERE)
    ordinary_directory_ancestry(HERE / "execution")
    return plan, records, helper, plan_data, helper_data, owner_data, proof_data, terminal_data


def execute(plan, records, helper, plan_data, helper_data, owner_data, proof_data, terminal_data, options):
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized64-bit Windows Python required")
    require(options.parent_released_window and options.runner_sha256 == helper.digest(__file__), "separate root release/current owner hash required")
    require(not os.path.lexists(HERE / "target"), "refuse previous/partial target; no automatic retry")
    destination = HERE / "execution" / options.attempt_name
    require(helper.within(destination, HERE / "execution"), "attempt escapes owned evidence")
    ordinary_directory_ancestry(destination.parent)
    destination.mkdir(parents=True, exist_ok=False)
    (destination / "temporary").mkdir()
    (destination / "accepted-plan.json").write_bytes(plan_data)
    (destination / "accepted-cpp2-helper.py").write_bytes(helper_data)
    (destination / "accepted-prior-quality-owner.py").write_bytes(owner_data)
    (destination / "accepted-prior-quality-proof.json").write_bytes(proof_data)
    (destination / "accepted-prior-quality-terminal.json").write_bytes(terminal_data)
    shutil.copyfile(__file__, destination / "accepted-continuation-owner.py")
    terminal = {"schemaVersion": 1, "status": "preparing-owned-wasm-no-run-continuation", "planSha256": PLAN_SHA,
        "runnerSha256": helper.digest(__file__), "previousQualityProof": plan["previousQualityProof"], "stages": [],
        "priorFirstThreeStagesPassed": True, "FormatCheckExecuted": False, "RustTestsExecuted": False, "ClippyExecuted": False,
        "WasmNoRunCompilePassed": False, "WasmNoRunProcessCreated": False, "sameFiveSourceTestCount": 5, "distinctTestsAdded": 0,
        "actualNativeJsonPins": plan["actualNativeJsonPins"], "expectedOrderedTests": plan["expectedOrderedTests"],
        "actualSourceEdited": False, "initialProofChanged": False, "originalInputContextExecutedInThisContinuation": False,
        "WasmCodeExecuted": False, "WasmBrowserExecutionProved": False, "actualBrowserRustAdapterExecuted": False,
        "commandOwnershipVerified": False, "liveEngineIntegrated": False, "wholeGameVerified": False,
        "commandAuthorization": "Denied(UntrackedNativeReaders)"}
    controlled = {**helper.CONTROLLED_INHERITED, "TEMP": str(destination / "temporary"), "TMP": str(destination / "temporary")}
    previous = {key: os.environ.get(key) for key in controlled}
    before = None
    try:
        before = helper.fingerprints(records)
        helper.write_json(destination / "input-fingerprints-before.json", before)
        helper.write_json(destination / "input-fingerprint-integer-strings-before.json", exact_integer_strings(before))
        os.environ.update(controlled)
        wrapper, guard = helper.load_wrapper(plan)
        command = plan["commands"][0]
        helper.validate_pin_records(records)
        captured = time.monotonic_ns()
        captured_utc = datetime.now(timezone.utc).isoformat()
        counters = guard.counters()
        completed = time.monotonic_ns()
        decision = helper.choose_launch(counters)
        decided = time.monotonic_ns()
        age = (decided - captured) / 1_000_000_000
        require(captured <= completed <= decided and 0 <= age <= 15, "fresh counter capture/decision stale")
        stage = {"stage": command["stage"], "decision": decision, "freshCounters": counters,
            "capturedUTC": captured_utc, "monotonicClock": "time.monotonic_ns()",
            "capturedMonotonicNs": str(captured), "countersCompletedMonotonicNs": str(completed),
            "decisionMonotonicNs": str(decided), "decisionAgeSeconds": age, "maximumAgeSeconds": 15,
            "argv": [command["executable"], *command["argv"]]}
        terminal["stages"].append(stage)
        decision_path = destination / (STAGE + ".launch-decision.json")
        helper.write_json(decision_path, stage)
        if decision != "launch":
            terminal["status"] = decision
        else:
            launch_requested = time.monotonic_ns()
            stage["launchRequestedMonotonicNs"] = str(launch_requested)
            stage["preLaunchAgeSeconds"] = (launch_requested - captured) / 1_000_000_000
            require(0 <= stage["preLaunchAgeSeconds"] <= 15, "fresh counter measurement stale before owned launch")
            helper.write_json(decision_path, stage)
            require(0 <= time.monotonic_ns() - captured <= 15_000_000_000, "fresh counter measurement stale immediately before owned launch")
            terminal["WasmNoRunProcessCreated"] = None
            result = wrapper.run_owned(guard, command, destination)
            metrics = json.loads((destination / (STAGE + ".json")).read_bytes())
            require(result["passed"] and result["exitCode"] == 0 and not result["remainingOwnedPidsBeforeJobClose"], "owned no-run compile failed")
            cleanup = json.loads((destination / (STAGE + ".outer-cleanup.json")).read_bytes())
            terminal["WasmNoRunProcessCreated"] = bool(cleanup["rootsCreated"])
            require(cleanup["passed"] and not cleanup["errors"] and not cleanup["remainingOwnedJobHandles"], "owned compile closure uncertain")
            stage.update(status="passed", durationSeconds=result["durationSeconds"], jobPeakPrivateBytes=result["jobPeakPrivateBytes"],
                         maximumSampledWorkingSetBytes=max((row["ownedWorkingSetBytes"] for row in result["samples"]), default=0))
            terminal["WasmNoRunCompilePassed"] = True
            terminal["status"] = "same-five-wasm-no-run-compile-passed"
            helper.write_json(destination / (STAGE + ".verdict.json"), stage)
            require(helper.fingerprints(records) == before, "protected accepted/current bytes changed")
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-wasm-no-run-continuation", failure=repr(error))
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        try:
            after = helper.fingerprints(records)
            helper.write_json(destination / "input-fingerprints-after.json", after)
            helper.write_json(destination / "input-fingerprint-integer-strings-after.json", exact_integer_strings(after))
            terminal["allProtectedPinnedBytesUnchanged"] = before is not None and before == after
            terminal["protectedUniqueFiles"] = len(records)
            require(terminal["allProtectedPinnedBytesUnchanged"], "terminal protected byte audit failed")
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
                terminal["WasmNoRunProcessCreated"] = bool(cleanup["rootsCreated"])
                require(cleanup["passed"] and not cleanup["errors"] and not cleanup["remainingOwnedJobHandles"] and
                        not metrics["remainingOwnedPidsBeforeJobClose"], "owned stage closure incomplete")
                roots = cleanup["rootsCreated"]
                require(len(roots) == 1 and all(any(row.get("processHandle") == root["processHandle"] and
                    row["action"] == "close-owned-process-handle" for row in cleanup["outerActions"]) for root in roots), "exact returned root handle must close")
                cleanups.append({"stage": STAGE, "passed": True, "rootsCreated": roots,
                                 "rootIdentityExactIntegerStrings": exact_integer_strings(metrics["rootIdentity"]),
                                 "remainingOwnedJobHandles": [], "evidence": helper.pin(cleanup_path)})
            except BaseException as error:
                cleanups.append({"stage": STAGE, "passed": False, "failure": repr(error)})
        terminal["ownedCleanupRecords"] = cleanups
        terminal["allOwnedJobsAndExactRootHandlesClosed"] = all(row["passed"] for row in cleanups)
        if not terminal["allOwnedJobsAndExactRootHandlesClosed"]:
            terminal["status"] = "failed-owned-cleanup-uncertain"
        terminal["ordinaryCargoCacheMetadataAllowed"] = True
        terminal["evidenceFiles"] = [helper.pin(path) for path in sorted(destination.rglob("*"))
            if path.is_file() and "temporary" not in path.relative_to(destination).parts and path.name != "terminal.json"]
        helper.write_json(destination / "terminal.json", terminal)
    print(json.dumps({key: terminal[key] for key in ["status", "WasmNoRunCompilePassed", "WasmNoRunProcessCreated", "allOwnedJobsAndExactRootHandlesClosed"]}), flush=True)
    require(terminal["status"] in ["same-five-wasm-no-run-compile-passed", "deferred-browser-priority", "blocked-fresh-4-6-gate"],
            "compile-only continuation stopped; preserve diagnostics, no automatic retry")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--attempt-name", default="validation-only")
    options = parser.parse_args()
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name), "invalid fresh attempt name")
    ast.parse(Path(__file__).read_bytes(), filename=__file__)
    plan, records, helper, plan_data, helper_data, owner_data, proof_data, terminal_data = load_sources()
    if not options.run:
        result = {"schemaVersion": 1, "status": "one-stage-continuation-source-validated-no-guard-loaded",
            "runnerSha256": helper.digest(__file__), "planSha256": PLAN_SHA, "protectedUniqueFiles": len(records),
            "newOwnedTarget": plan["newOwnedTarget"], "expectedOrderedTests": plan["expectedOrderedTests"],
            "FirstThreeStagesRerun": False, "RustTestsExecuted": False, "WasmNoRunCompileExecuted": False,
            "WindowsGuardLoaded": False, "WasmCodeExecuted": False, "actualBrowserRustAdapterExecuted": False,
            "capturedUTCRequiredAtFutureLaunch": True, "monotonicFreshnessRequiredAtFutureLaunch": True}
        helper.write_json(HERE / "runner-source-validation.json", result)
        print(json.dumps(result), flush=True)
        return
    execute(plan, records, helper, plan_data, helper_data, owner_data, proof_data, terminal_data, options)


if __name__ == "__main__":
    main()
