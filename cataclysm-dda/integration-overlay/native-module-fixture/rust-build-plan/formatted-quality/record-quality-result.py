"""Condense one completed quality window; no tool or guard invocation."""
from pathlib import Path
import hashlib
import json
import shutil

HERE = Path(__file__).resolve().parent
ATTEMPT = HERE / "execution/native-fixture-formatted-initial"
PLAN_SHA = "504c67c4e405cf373941e121686941b77fc2a8037287161a38b5be5249d39895"
OWNER_SHA = "eff148bd2557c7018d19a6bc34e9be1e91c412aba60dfa28b5737aa79615e51d"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def pin(path):
    path = Path(path).resolve()
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": digest.hexdigest()}


def read_json(path):
    return json.loads(Path(path).read_bytes())


def time_strings(value):
    if isinstance(value, dict):
        return {key: str(child) if "filetime" in key.lower() and type(child) is int else time_strings(child)
                for key, child in value.items()}
    if isinstance(value, list):
        return [time_strings(child) for child in value]
    return value


def identities(value):
    result = []
    if isinstance(value, dict):
        if "pid" in value and any("filetime" in key.lower() for key in value):
            result.append(time_strings(value))
        for child in value.values():
            result.extend(identities(child))
    elif isinstance(value, list):
        for child in value:
            result.extend(identities(child))
    return result


plan_data = (HERE / "quality-plan.json").read_bytes()
require(hashlib.sha256(plan_data).hexdigest() == PLAN_SHA, "plan changed")
require(pin(HERE / "run-quality-window.py")["sha256"] == OWNER_SHA, "owner changed")
plan = json.loads(plan_data)
terminal = read_json(ATTEMPT / "terminal.json")
require(terminal["status"] == "three-package-quality-checks-passed" and
        all(terminal[key] for key in ["formatCheckPassed", "sameFourTestsPassed", "ClippyPassed",
                                     "all577ProtectedPinnedBytesUnchanged", "allOwnedJobsAndExactRootHandlesClosed"]),
        "three genuine checks and complete audits required")
require(terminal["planSha256"] == PLAN_SHA and terminal["runnerSha256"] == OWNER_SHA, "run pins differ")
before = read_json(ATTEMPT / "input-fingerprints-before.json")
after = read_json(ATTEMPT / "input-fingerprints-after.json")
require(before == after and len(after) == 577, "protected input audit differs")
for record in after.values():
    require(pin(record["path"]) == record, "current protected input changed")
require([stage["stage"] for stage in terminal["stages"]] == [stage["stage"] for stage in plan["commands"]],
        "exact three stages required")
stages = []
for stage in terminal["stages"]:
    name = stage["stage"]
    require(stage["status"] == "passed", "stage did not pass")
    metrics = read_json(ATTEMPT / (name + ".json"))
    cleanup = read_json(ATTEMPT / (name + ".outer-cleanup.json"))
    require(metrics["passed"] and metrics["exitCode"] == 0 and not metrics["remainingOwnedPidsBeforeJobClose"],
            "owned stage failed or PIDs remain")
    require(cleanup["passed"] and not cleanup["errors"] and not cleanup["remainingOwnedJobHandles"], "owned closure uncertain")
    roots = cleanup["rootsCreated"]
    require(len(roots) == 1 and any(row.get("processHandle") == roots[0]["processHandle"] and
        row["action"] == "close-owned-process-handle" for row in cleanup["outerActions"]), "exact root handle not closed")
    observed = identities(metrics)
    require(observed and all(isinstance(value, str) and value.isdecimal() for record in observed
        for key, value in record.items() if "filetime" in key.lower()), "FILETIME digits must remain exact strings")
    stages.append({"stage": name, "durationSeconds": metrics["durationSeconds"],
        "jobPeakPrivateBytes": metrics["jobPeakPrivateBytes"],
        "maximumSampledWorkingSetBytes": max(row["ownedWorkingSetBytes"] for row in metrics["samples"]),
        "minimumPhysicalFreeBytes": min(row["physicalFreeBytes"] for row in metrics["samples"]),
        "minimumExactCommitHeadroomBytes": min(row["exactCommitHeadroomBytes"] for row in metrics["samples"]),
        "root": roots[0], "observedIdentitiesWithFiletimeStrings": observed,
        "remainingOwnedPidsBeforeJobClose": [], "remainingOwnedJobHandles": [], "cleanupErrors": [],
        "exactRootHandleClosed": True,
        "artifacts": {kind: pin(ATTEMPT / (name + suffix)) for kind, suffix in
            [("metrics", ".json"), ("outerCleanup", ".outer-cleanup.json"),
             ("stdout", ".stdout.log"), ("stderr", ".stderr.log"), ("verdict", ".verdict.json")]}})
expected = [{"name": name, "passed": True} for name in plan["expectedOrderedTests"]]
require(terminal["stages"][1]["reports"] == expected, "same exact four tests required")
native = plan["actualNativeJsonPins"]
require(len(native) == 9 and terminal["actualNativeJsonPins"] == native, "actual native records differ")
for record in native.values():
    require(pin(record["path"]) == record, "actual native byte record changed")
initial = read_json(HERE.parent / "rust-consumer-verification.json")
require(pin(initial["executedOwnedTestBinary"]["path"]) == initial["executedOwnedTestBinary"], "initial binary changed")
binaries = list((HERE / "target/x86_64-pc-windows-gnu/debug/deps").glob("cdda_snapshot_native_fixture_consumer-*.exe"))
require(len(binaries) == 1 and not binaries[0].is_symlink(), "one executed package test binary required")
source_copies = ATTEMPT / "accepted-formatted-source"
source_copies.mkdir(exist_ok=False)
copies = []
for source, relative in [(Path(plan["authorizedCurrentSourceChange"]["path"]), "src/lib.rs"),
                         (HERE.parent.parent / "rust-consumer/Cargo.toml", "Cargo.toml"),
                         (HERE.parent.parent / "rust-consumer/Cargo.lock", "Cargo.lock"),
                         (HERE / "rustfmt.toml", "rustfmt.toml")]:
    target = source_copies / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    source_pin = pin(source)
    shutil.copyfile(source, target)
    target_pin = pin(target)
    require(source_pin["bytes"] == target_pin["bytes"] and source_pin["sha256"] == target_pin["sha256"], "accepted copy differs")
    copies.append({"original": source_pin, "acceptedCopy": target_pin})
proof = {"schemaVersion": 1, "status": "package-fmt-same-four-native-byte-tests-and-clippy-passed",
    "plan": pin(HERE / "quality-plan.json"), "owner": pin(HERE / "run-quality-window.py"),
    "terminal": pin(ATTEMPT / "terminal.json"), "stages": stages, "exactOrderedTests": expected,
    "actualNativeJsonPins": native, "executedFormattedTestBinary": pin(binaries[0]),
    "preservedInitialTestBinary": initial["executedOwnedTestBinary"], "acceptedFormattedSourceCopies": copies,
    "all577ProtectedFilesUnchanged": True, "allOwnedJobsAndExactRootHandlesClosed": True,
    "rawFiletimeDigitsPreservedAsStrings": True, "packageOnlyFmtCheckPassed": True,
    "sameFourConsumerTestsPassed": True, "packageOnlyClippyWarningsDeniedPassed": True,
    "newDistinctRustTestsAddedByRetest": 0, "actualNativeRecordsConsumed": 9,
    "ordinaryCargoCacheMetadataAllowed": True, "syntheticCallbackContexts": True,
    "commandAuthorization": "Denied(UntrackedNativeReaders)", "originalInputContextExecuted": False,
    "liveEngineIntegrated": False, "gameplayOwnershipVerified": False, "wholeGameVerified": False,
    "sourceMutationDuringChecks": False, "automaticRetryPerformed": False}
path = HERE / "formatted-quality-verification.json"
path.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"proof": pin(path), "stages": [{key: stage[key] for key in
    ["stage", "durationSeconds", "jobPeakPrivateBytes", "maximumSampledWorkingSetBytes"]} for stage in stages],
    "exactTestNames": plan["expectedOrderedTests"], "allOwnedJobsClosed": True}))
