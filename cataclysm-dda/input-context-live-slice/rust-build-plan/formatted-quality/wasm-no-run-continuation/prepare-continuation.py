"""Prepare one source-only continuation; never load a guard or run a toolchain."""
from pathlib import Path
import argparse
import ast
import copy
import hashlib
import json
import os

HERE = Path(__file__).resolve().parent
QUALITY = HERE.parent
PLAN_SHA = "e550a5d2674bd803e6804b6acd9b6077b607b9d3b5e1d4d822800255b5525faa"
OWNER_SHA = "2518ef1ae96719329a91b3920be238661abb2dd8d71a0304ecc41a1971ff8008"
PROOF_SHA = "32dbd4e36c6eaf3b490b9bdb7af9990dedddf4a2360e3d447f62608899a51cf6"
TERMINAL_SHA = "5f5d0ee7b87903307a447d50b82fb86cea54e25115d2d0121ff2dd9f9c627cba"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def pin(path, expected=None):
    path = Path(path).resolve()
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if expected is not None:
        require(digest == expected, "accepted source/evidence changed: " + str(path))
    return {"path": str(path), "bytes": len(data), "sha256": digest}


def collect(records):
    unique = {}
    for record in records:
        path = str(Path(record["path"]).resolve())
        key = os.path.normcase(path)
        row = {"path": path, "bytes": record["bytes"], "sha256": record["sha256"]}
        require(key not in unique or unique[key] == row, "conflicting normalized source pins")
        unique[key] = row
    return [unique[key] for key in sorted(unique)]


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh-unexecuted-source", action="store_true")
    options = parser.parse_args()
    prior_plan_pin = pin(QUALITY / "quality-plan.json", PLAN_SHA)
    prior_owner_pin = pin(QUALITY / "run-quality-window.py", OWNER_SHA)
    proof_pin = pin(QUALITY / "QUALITY-VERIFICATION.json", PROOF_SHA)
    terminal_pin = pin(QUALITY / "execution/original-context-quality-initial/terminal.json", TERMINAL_SHA)
    prior = json.loads(Path(prior_plan_pin["path"]).read_bytes())
    proof = json.loads(Path(proof_pin["path"]).read_bytes())
    terminal = json.loads(Path(terminal_pin["path"]).read_bytes())
    require(len(prior["pins"]) == 592 and len(prior["commands"]) == 4, "accepted quality plan shape changed")
    require(proof["status"] == terminal["status"] == "blocked-fresh-4-6-gate", "prior attempt must remain held after three passes")
    require(proof["terminalEvidence"] == terminal_pin and proof["planSha256"] == PLAN_SHA and proof["ownerSha256"] == OWNER_SHA,
            "prior proof identity changed")
    for source in (proof, terminal):
        for key in ("formatCheckPassed", "sameFiveTestsPassed", "ClippyPassed", "all594ProtectedPinnedBytesUnchanged", "allOwnedJobsAndExactRootHandlesClosed"):
            require(source[key] is True, "prior accepted pass/closure absent: " + key)
        require(source["WasmNoRunCompilePassed"] is False, "fourth stage must remain uncompiled")
    require(proof["WasmNoRunProcessCreated"] is False and type(proof["sameFiveTestsNewCount"]) is int and proof["sameFiveTestsNewCount"] == 0,
            "prior WASM launch/new test credit forbidden")
    require(len(terminal["stages"]) == 4 and terminal["stages"][3]["decision"] == "blocked-fresh-4-6-gate", "prior final stage gate changed")
    for index, stage in enumerate(terminal["stages"]):
        command = prior["commands"][index]
        require(stage["stage"] == command["stage"] and stage["argv"] == [command["executable"], *command["argv"]], "prior stage argv changed")
        if index < 3:
            require(stage["decision"] == "launch" and stage["status"] == "passed", "prior first-three pass changed")
    plan = copy.deepcopy(prior)
    plan["status"] = "source-only-one-stage-wasm-no-run-continuation-not-executed"
    plan["newOwnedTarget"] = str(HERE / "target")
    plan["previousQualityTargetMustRemainUnchanged"] = prior["newOwnedTarget"]
    command = copy.deepcopy(prior["commands"][3])
    target_index = command["argv"].index("--target-dir") + 1
    command["argv"][target_index] = str(HERE / "target")
    plan["commands"] = [command]
    plan["previousQualityPlan"] = prior_plan_pin
    plan["previousQualityOwner"] = prior_owner_pin
    plan["previousQualityProof"] = proof_pin
    plan["previousQualityTerminal"] = terminal_pin
    plan["previousMetricRootIntegerStrings"] = []
    for command in prior["commands"][:3]:
        metrics_path = QUALITY / "execution/original-context-quality-initial" / (command["stage"] + ".json")
        metrics = json.loads(metrics_path.read_bytes())
        root = metrics["rootIdentity"]
        require(type(root["creationFiletime"]) is int, "raw FILETIME must remain an exact Python integer")
        plan["previousMetricRootIntegerStrings"].append({"stage": command["stage"], "metrics": pin(metrics_path),
                                                       "exactIntegerStrings": exact_integer_strings(root)})
    plan["previousFirstThreeStagesMustNotRerun"] = True
    plan["WasmNoRunProcessPreparedOnly"] = True
    plan["RustTestsExecutedInThisContinuation"] = False
    plan["distinctTestsAdded"] = 0
    plan["launchDecisionEvidence"] = {
        "capturedUTCRequired": True,
        "utcClock": "datetime.now(timezone.utc).isoformat()",
        "monotonicClock": "time.monotonic_ns()",
        "monotonicAgeRequiredImmediatelyBeforeOwnedLaunch": True,
        "maximumAgeMilliseconds": 15000,
        "negativeAgeBlocksLaunch": True,
    }
    plan["policy"] = "One held same-five WASM test-harness compilation only, offline/locked/jobs1/--no-run, fresh continuation target. Preserve all accepted formatted-quality source/provenance, initial native/Rust proof, prior three-pass quality proof and raw evidence. Explicit UTC and monotonic freshness before root-released owned launch; raw FILETIME/mtimeNs remain Python arbitrary integers with supplemental decimal strings. No first-three rerun, no new test count, Rust adapter execution, browser, native input, live engine or command ownership claim. Same pinned helper/guard/resource/closure contract; no automatic retry."
    plan["pins"] = collect([*prior["pins"], prior_plan_pin, prior_owner_pin, proof_pin, terminal_pin,
                            *proof["evidence"], *terminal["evidenceFiles"], pin(__file__)])
    plan["preparedUniquePinCount"] = len(plan["pins"])
    for record in plan["pins"]:
        require(pin(record["path"]) == record, "protected source/evidence differs: " + record["path"])
    plan_data = (json.dumps(plan, indent=2) + "\n").encode("utf-8")
    digest = hashlib.sha256(plan_data).hexdigest()
    owner = HERE / "run-continuation-window.py"
    owner_data = owner.read_bytes()
    marker = b'PLAN_SHA = "PREPARED_PLAN_SHA256"'
    if options.refresh_unexecuted_source:
        require(not os.path.lexists(HERE / "target") and not os.path.lexists(HERE / "execution"), "source refresh forbidden after any attempted execution")
        previous_plan = HERE / "continuation-plan.json"
        require(previous_plan.is_file() and not previous_plan.is_symlink() and
                not (getattr(previous_plan.lstat(), "st_file_attributes", 0) & 0x400), "ordinary unexecuted source plan required")
        previous_sha = hashlib.sha256(previous_plan.read_bytes()).hexdigest()
        marker = ('PLAN_SHA = "' + previous_sha + '"').encode("ascii")
    require(owner_data.count(marker) == 1, "refuse regenerated or previously edited owner")
    updated_owner = owner_data.replace(marker, ('PLAN_SHA = "' + digest + '"').encode("ascii"))
    ast.parse(updated_owner, filename=str(owner))
    with (HERE / "continuation-plan.json").open("wb" if options.refresh_unexecuted_source else "xb") as output:
        output.write(plan_data)
    owner.write_bytes(updated_owner)
    print(json.dumps({"status": "prepared-source-only-no-guard-no-toolchain", "plan": pin(HERE / "continuation-plan.json"),
                      "owner": pin(owner), "preparedUniquePinCount": len(plan["pins"]), "finalProtectedUniqueFiles": len(plan["pins"]) + 2,
                      "command": plan["commands"][0], "WindowsGuardLoaded": False, "CargoExecuted": False, "WasmExecuted": False}), flush=True)


if __name__ == "__main__":
    main()
