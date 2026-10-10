"""Audit the completed owned window; no Cargo, guard, process, or Wasm execution."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re

HERE = Path(__file__).resolve().parent
POLICY = HERE.parent
EXECUTION = HERE / "execution/v5-policy-formatted-initial"
PLAN_SHA = "edb9d8c006d67f839bbe888f7e1ccb5d0b787a919af66409624cd884a3af18a1"
OWNER_SHA = "6a8a00b1fc20981c4ba6440c8be700aab8db3b49c69c9d9e3a1d182c661e07b9"
STAGES = ["v5-policy-format-check", "v5-policy-five-native-tests", "v5-policy-package-clippy", "v5-policy-wasm-release-build"]
GIB = 1024 ** 3


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def pin(path):
    path = Path(path).resolve()
    state = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(64 * 1024), b""):
            state.update(block)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": state.hexdigest()}


def checked_json(path, expected=None):
    raw = Path(path).read_bytes()
    if expected is not None:
        require(hashlib.sha256(raw).hexdigest() == expected, "fixed proof bytes changed")
    return json.loads(raw)


plan = checked_json(HERE / "quality-plan.json", PLAN_SHA)
require(pin(HERE / "run-policy-window.py")["sha256"] == OWNER_SHA, "fixed owner changed")
terminal_path = EXECUTION / "terminal.json"
terminal = checked_json(terminal_path)
keys = ["formatCheckPassed", "fiveNativeTestsPassed", "ClippyPassed", "WasmBuildPassed",
        "allProtectedPinnedBytesUnchanged", "allOwnedJobsAndExactRootHandlesClosed"]
require(terminal["status"] == "four-v5-policy-checks-passed" and all(terminal[key] is True for key in keys), "all four actual checks must pass")
require(terminal["planSha256"] == PLAN_SHA and terminal["runnerSha256"] == OWNER_SHA, "accepted identities changed")
require([stage["stage"] for stage in terminal["stages"]] == STAGES, "exact four stage order required")
for record in terminal["evidenceFiles"]:
    require(pin(record["path"]) == record, "terminal evidence byte mismatch")
for record in plan["pins"]:
    require(pin(record["path"]) == record, "protected source/tool/asset byte mismatch")
before = checked_json(EXECUTION / "input-fingerprints-before.json")
after = checked_json(EXECUTION / "input-fingerprints-after.json")
require(before == after and len(before) == plan["preparedUniquePinCount"] + 2 == 110, "all 110 exact byte pins required")
for path, record in before.items():
    require(pin(path) == record, "current protected pin changed after execution")
require(terminal["wasmArtifact"] == pin(plan["wasmOutput"]), "actual executed Wasm artifact mismatch")
require(Path(plan["wasmOutput"]).read_bytes()[:8] == b"\x00asm\x01\x00\x00\x00", "Wasm magic/version missing")
for relative in ["Cargo.toml", "Cargo.lock", "rustfmt.toml", "NOTICE.txt", "src/lib.rs", "src/tests.rs"]:
    original = pin(POLICY / relative)
    accepted = pin(EXECUTION / "accepted-policy-source" / relative)
    require((original["bytes"], original["sha256"]) == (accepted["bytes"], accepted["sha256"]), "accepted source-copy mismatch")
stages = []
for stage, expected in zip(terminal["stages"], plan["commands"]):
    name = stage["stage"]
    metrics_path = EXECUTION / (name + ".json")
    cleanup_path = EXECUTION / (name + ".outer-cleanup.json")
    metrics = checked_json(metrics_path)
    cleanup = checked_json(cleanup_path)
    require(stage["status"] == "passed" and stage["decision"] == "launch", "actual stage pass required")
    require(metrics["passed"] is True and metrics["exitCode"] == 0 and not metrics.get("failure"), "raw command failed")
    require(metrics["argv"] == [expected["executable"], *expected["argv"]] and metrics["cwd"] == expected["cwd"], "exact raw command required")
    require(not metrics["remainingOwnedPidsBeforeJobClose"] and cleanup["passed"] is True and
            not cleanup["errors"] and not cleanup["remainingOwnedJobHandles"], "raw owned closure incomplete")
    require(len(cleanup["rootsCreated"]) == len(cleanup["jobsCreated"]) == 1, "one exact job/root required")
    root = cleanup["rootsCreated"][0]
    require(root["pid"] == metrics["rootIdentity"]["pid"] and any(action.get("processHandle") == root["processHandle"] and
            action["action"] == "close-owned-process-handle" for action in cleanup["outerActions"]), "exact root handle closure missing")
    require(0 < metrics["jobPeakPrivateBytes"] <= GIB and 0 < metrics["durationSeconds"] <= 180, "fixed actual job limits exceeded")
    samples = metrics["samples"]
    require(samples and all(row["physicalFreeBytes"] >= 2 * GIB and row["exactCommitHeadroomBytes"] >= 2 * GIB and
            row["ownedPrivateBytes"] <= GIB and row["ownedWorkingSetBytes"] <= GIB for row in samples), "actual sampled limits exceeded")
    for counters in [stage["freshCounters"], metrics["freshGate"]]:
        require(counters["physicalFreeBytes"] >= 4 * GIB and counters["exactCommitHeadroomBytes"] >= 6 * GIB and
                not (counters["physicalFreeBytes"] >= 7 * GIB and counters["exactCommitHeadroomBytes"] >= 9 * GIB), "fresh/priority gates changed")
    identities = sorted({(row["pid"], row["creationFiletime"]) for row in metrics["identities"]})
    require(all(type(pid) is int and pid > 0 and type(filetime) is int and filetime > 0 for pid, filetime in identities), "exact integer native identities required")
    require((metrics["rootIdentity"]["pid"], metrics["rootIdentity"]["creationFiletime"]) in identities, "root identity missing")
    reports = None
    if name == STAGES[1]:
        stdout = (EXECUTION / (name + ".stdout.log")).read_text(encoding="utf-8")
        reports = re.findall(r"^test ([a-z0-9_:]+) \.\.\. (ok|FAILED|ignored)$", stdout, re.MULTILINE)
        require(len(reports) == 5 and sorted(name for name, status in reports) == plan["expectedOrderedTests"] and
                all(status == "ok" for name, status in reports), "five unique real Rust reports required")
    stages.append({"stage": name, "passed": True, "durationSeconds": metrics["durationSeconds"],
        "jobPeakPrivateBytes": metrics["jobPeakPrivateBytes"], "maximumSampledWorkingSetBytes": max(row["ownedWorkingSetBytes"] for row in samples),
        "minimumPhysicalFreeBytes": min(row["physicalFreeBytes"] for row in samples),
        "minimumExactCommitHeadroomBytes": min(row["exactCommitHeadroomBytes"] for row in samples),
        "freshCounters": stage["freshCounters"], "exactRoot": {"pid": root["pid"], "processHandle": root["processHandle"],
            "creationFiletime": str(metrics["rootIdentity"]["creationFiletime"])},
        "allNativeIdentities": [{"pid": pid, "creationFiletime": str(filetime)} for pid, filetime in identities],
        "allOwnedJobsAndExactRootHandlesClosed": True, "remainingOwnedPids": [], "remainingOwnedJobHandles": [], "errors": [],
        "metrics": pin(metrics_path), "cleanup": pin(cleanup_path), "testReports": reports})
result = {"schemaVersion": 1, "status": "four-v5-policy-checks-passed", "checkedAt": datetime.now(timezone.utc).isoformat(),
    **{key: True for key in keys}, "protectedUniqueFiles": 110, "rawTerminal": pin(terminal_path),
    "plan": pin(HERE / "quality-plan.json"), "owner": pin(HERE / "run-policy-window.py"),
    "wasmArtifact": terminal["wasmArtifact"], "expectedOrderedTests": plan["expectedOrderedTests"], "uniqueNativeTestsPassed": 5,
    "stages": stages, "actualParentAssetPins": plan["actualParentAssetPins"],
    "sourceValidation": pin(HERE / "source-validation.json"), "copyback": pin(HERE / "format-copyback.json"),
    "initialSafeFormatStopPreserved": pin(POLICY / "execution/v5-policy-initial/terminal.json"),
    "engineRuntimeVerified": False, "existingProfilePreservedInActualEngine": False,
    "wasmImportsVerified": False, "allGameArtworkComplete": False, "externalPublication": False,
    "scope": "Five genuine native policy tests and original byte-pinned parent metadata. Standalone Wasm was built but not instantiated here. No actual game/render/map/save flow proof."}
(HERE / "policy-verification.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": result["status"], "proof": pin(HERE / "policy-verification.json"), "wasmArtifact": result["wasmArtifact"],
                  "uniqueNativeTestsPassed": 5, "allOwnedJobsAndExactRootHandlesClosed": True}))
