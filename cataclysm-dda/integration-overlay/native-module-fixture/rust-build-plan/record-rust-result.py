"""Condense the completed owned Rust4 attempt; no Cargo or guard invocation."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ATTEMPT = HERE / "execution/native-json-rust-initial"
STAGE = "actual-native-json-rust-consumer"
PLAN_SHA = "3f0e4c50fd2cdce787420caffd86f5895df3fc39e51e60466ec95b5102d15422"
OWNER_SHA = "119a444966b54ac2cd4b9a77f18ef20f218d61eb2783dfe9a748225941bd56e8"


def pin(path):
    path = Path(path).resolve()
    state = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": state.hexdigest()}


def read_json(path):
    return json.loads(Path(path).read_bytes())


def time_strings(value):
    if isinstance(value, dict):
        return {key: str(child) if "filetime" in key.lower() and type(child) is int else time_strings(child)
                for key, child in value.items()}
    if isinstance(value, list):
        return [time_strings(child) for child in value]
    return value


def find_identities(value):
    rows = []
    if isinstance(value, dict):
        if "pid" in value and any("filetime" in key.lower() for key in value):
            rows.append(time_strings(value))
        for child in value.values():
            rows.extend(find_identities(child))
    elif isinstance(value, list):
        for child in value:
            rows.extend(find_identities(child))
    return rows


plan_bytes = (HERE / "rust-consumer-plan.json").read_bytes()
assert hashlib.sha256(plan_bytes).hexdigest() == PLAN_SHA
assert pin(HERE / "run-rust-window.py")["sha256"] == OWNER_SHA
plan = json.loads(plan_bytes)
terminal = read_json(ATTEMPT / "terminal.json")
metrics = read_json(ATTEMPT / (STAGE + ".json"))
cleanup = read_json(ATTEMPT / (STAGE + ".outer-cleanup.json"))
assert terminal["status"] == "actual-native-byte-rust-consumer-four-tests-passed"
assert terminal["allFourRustTestsPassed"] and terminal["rustNativeFixtureConsumersExecuted"]
assert terminal["planSha256"] == PLAN_SHA and terminal["runnerSha256"] == OWNER_SHA
assert terminal["protectedPinnedBytesUnchanged"] and terminal["protectedPinnedFileCount"] == 518
assert terminal["allOwnedJobsAndExactRootHandlesClosed"]
assert len(terminal["stages"]) == 1 and terminal["stages"][0]["reports"] == [
    {"name": name, "passed": True} for name in plan["expectedOrderedTests"]]
assert metrics["passed"] and metrics["exitCode"] == 0 and not metrics["remainingOwnedPidsBeforeJobClose"]
assert cleanup["passed"] and not cleanup["errors"] and not cleanup["remainingOwnedJobHandles"]
assert len(cleanup["rootsCreated"]) == 1
root = cleanup["rootsCreated"][0]
assert any(row.get("processHandle") == root["processHandle"] and row["action"] == "close-owned-process-handle"
           for row in cleanup["outerActions"])
identities = find_identities(metrics)
root_identities = [row for row in identities if row["pid"] == root["pid"]]
assert root_identities and all(isinstance(value, str) and value.isdecimal()
    for row in identities for key, value in row.items() if "filetime" in key.lower())
before = read_json(ATTEMPT / "input-fingerprints-before.json")
after = read_json(ATTEMPT / "input-fingerprints-after.json")
assert before == after and len(before) == 518
for item in after.values():
    assert pin(item["path"]) == item
native = plan["actualNativeJsonPins"]
assert len(native) == 9 and terminal["actualNativeJsonPins"] == native
for item in native.values():
    assert pin(item["path"]) == item
binaries = sorted((HERE / "target/x86_64-pc-windows-gnu/debug/deps").glob("cdda_snapshot_native_fixture_consumer-*.exe"))
assert len(binaries) == 1 and not binaries[0].is_symlink()
proof = {"schemaVersion": 1, "status": "genuine-frozen-rust-consumer-accepted-nine-native-module-records-four-tests-passed",
    "sourceCommit": plan["sourceCommit"], "moduleBuildIdentity": plan["moduleBuildIdentity"],
    "plan": pin(HERE / "rust-consumer-plan.json"), "owner": pin(HERE / "run-rust-window.py"),
    "terminal": pin(ATTEMPT / "terminal.json"), "stageMetrics": pin(ATTEMPT / (STAGE + ".json")),
    "outerCleanup": pin(ATTEMPT / (STAGE + ".outer-cleanup.json")),
    "stdout": pin(ATTEMPT / (STAGE + ".stdout.log")), "stderr": pin(ATTEMPT / (STAGE + ".stderr.log")),
    "executedOwnedTestBinary": pin(binaries[0]), "exactOrderedTests": terminal["stages"][0]["reports"],
    "acceptedActualNativeJsonPins": native, "durationSeconds": metrics["durationSeconds"],
    "jobPeakPrivateBytes": metrics["jobPeakPrivateBytes"],
    "maximumSampledWorkingSetBytes": max(row["ownedWorkingSetBytes"] for row in metrics["samples"]),
    "minimumAvailablePhysicalBytes": min(row["physicalFreeBytes"] for row in metrics["samples"]),
    "minimumExactCommitHeadroomBytes": min(row["exactCommitHeadroomBytes"] for row in metrics["samples"]),
    "ownedRoot": root, "ownedRootIdentityWithFiletimeStrings": root_identities[0],
    "ownedObservedIdentitiesWithFiletimeStrings": identities, "rawFiletimeDigitsPreservedAsStrings": True,
    "remainingOwnedPidsBeforeJobClose": metrics["remainingOwnedPidsBeforeJobClose"],
    "remainingOwnedJobHandles": cleanup["remainingOwnedJobHandles"], "cleanupErrors": cleanup["errors"],
    "exactRootHandleExplicitlyClosed": True, "allOwnedJobsClosed": True,
    "all518ProtectedPinnedFilesUnchanged": True, "ordinaryCargoCacheMetadataAllowed": True,
    "preparedLockAcceptedOfflineLocked": True, "registryPackages": 11, "archiveEqualRegularSourceFiles": 473,
    "genuineRustNativeByteConsumerTests": 4, "genuineNativeRecordsAccepted": 9,
    "callbackContextsAreSynthetic": True, "commandAuthorization": "Denied(UntrackedNativeReaders)",
    "originalInputContextExecuted": False, "originalActionContextsLookupVerified": False,
    "liveEngineIntegrated": False, "gameplayOwnershipVerified": False, "wholeGameVerified": False,
    "RustfmtExecuted": False, "ClippyExecuted": False, "additionalRuntimeAttempted": False}
destination = HERE / "rust-consumer-verification.json"
destination.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"proof": pin(destination), "genuineRustTests": 4, "actualNativeRecords": 9,
                  "rootIdentity": proof["ownedRootIdentityWithFiletimeStrings"], "allOwnedJobsClosed": True}))
