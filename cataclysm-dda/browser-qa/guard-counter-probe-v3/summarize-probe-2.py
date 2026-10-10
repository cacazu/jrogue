import datetime
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "browser-qa/guard-counter-probe-v3"
INNER = BASE / "output/2026-10-02T22-25-02-688Z"
OUTER = BASE / "owned-output/counter-probe-2"


def read(path):
    return json.loads(path.read_bytes())


def pin(path):
    raw = path.read_bytes()
    return {"path": str(path.relative_to(ROOT)), "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest()}


inner = read(INNER / "report.json")
stage = read(OUTER / "guard-counter-node-child.json")
terminal = read(OUTER / "terminal.json")
cleanup = read(OUTER / "guard-counter-node-child.outer-cleanup.json")
assert inner["status"] == "passed-real-counter-and-exact-identity-probe"
assert inner["assertions"] == 11 and inner["guardExitCode"] == 0
assert terminal["status"] == "passed-real-counter-probe-with-kernel-owner"
assert stage["passed"] and stage["exitCode"] == 0
assert terminal["sixInnerSourceFingerprintsUnchanged"]
assert cleanup["passed"] and not cleanup["errors"]
assert not cleanup["remainingOwnedJobHandles"]
assert not stage["remainingOwnedPidsBeforeJobClose"]
assert terminal["allOwnedRootHandlesExplicitlyClosed"]
assert inner["teardown"]["allRecordedOwnedProcessesExited"]
assert not inner["teardown"]["remaining"]
assert not inner["teardown"]["identityReadErrors"]

samples = inner["memoryGuard"]["samples"]
assert len(samples) == 3 and all(s["privateAccountingComplete"] for s in samples)
witnesses = []
for process in samples[0]["ownedProcesses"]:
    native_ticks = int(process["getProcessStartUtcTicksDecimalString"])
    assert process["createdAt"] == process["getProcessCimQuantumStartTime"]
    assert process["accountingStatus"] == "complete" and process["privateBytes"] > 0
    witnesses.append({key: process[key] for key in (
        "pid", "parentPid", "name", "createdAt", "privateBytes",
        "workingSetBytes", "cpuTotalMilliseconds", "threadCount",
        "getProcessStartTime", "getProcessStartUtcTicksDecimalString",
        "getProcessCimQuantumStartTime")})
    witnesses[-1]["nativeSubmicrosecondTicks"] = native_ticks % 10
assert sum(w["privateBytes"] for w in witnesses) == samples[0]["ownedPrivateBytes"]
assert 35584 not in {identity["pid"] for identity in stage["identities"]}

paths = [INNER / "report.json", INNER / "memory-guard.json", INNER / "cleanup.json", INNER / "teardown.json",
         OUTER / "guard-counter-node-child.json",
         OUTER / "guard-counter-node-child.outer-cleanup.json", OUTER / "terminal.json"]
# Keep full native FILETIME integers exact as decimal strings for JavaScript readers.
identities = [{"pid": identity["pid"],
               "creationFiletimeDecimalString": str(identity["creationFiletime"])}
              for identity in stage["identities"]]
root = stage["rootIdentity"]
summary = {
    "writtenAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "scope": "Single actual tiny Node counter/identity prerequisite; no game/Chrome acceptance",
    "status": terminal["status"], "assertions": inner["assertions"],
    "planSha256": terminal["planSha256"], "invokerSha256": terminal["invokerSha256"],
    "ownerSha256": terminal["ownerSha256"], "outerFreshGate": stage["freshGate"],
    "innerPreSpawnMemory": inner["preSpawnMemory"],
    "kernelHardPrivateCapBytes": 1073741824,
    "sampledWorkingSetStopThresholdBytes": 1073741824,
    "runningPhysicalAndCommitFloorsBytes": 2147483648, "maximumSeconds": 180,
    "durationSeconds": stage["durationSeconds"],
    "kernelJobPeakPrivateBytes": stage["jobPeakPrivateBytes"],
    "ownedWorkingSetSemantics": "Per-process sum; shared pages can repeat",
    "outerPeakSampledWorkingSetBytes": max(s["ownedWorkingSetBytes"] for s in stage["samples"]),
    "innerSampleCount": len(samples), "allInnerPrivateAccountingComplete": True,
    "innerOwnedPrivateBytesEachSample": [s["ownedPrivateBytes"] for s in samples],
    "exactWitnesses": witnesses,
    "outerIdentities": identities,
    "outerRoot": {"pid": root["pid"], "creationFiletimeDecimalString": str(root["creationFiletime"])},
    "innerTeardown": inner["teardown"], "innerGuardCleanupChecks": inner["memoryGuard"]["cleanupChecks"],
    "outerRemainingPidsBeforeJobClose": stage["remainingOwnedPidsBeforeJobClose"],
    "outerCleanup": cleanup, "allOwnedRootHandlesExplicitlyClosed": True,
    "sixInnerSourceFingerprintsUnchanged": True, "previewServerPid35584InsideOwnedJob": False,
    "chromeStarted": False, "browserCandidateConsumed": False,
    "historicalV2AndProbe1BytesUnchanged": True,
    "artifacts": [pin(path) for path in paths],
    "gameWorldSaveResumeMobileAcceptance": "pending"
}
destination = BASE / "counter-probe-2-summary.json"
with destination.open("x", encoding="utf-8", newline="\n") as output:
    json.dump(summary, output, indent=2, ensure_ascii=False)
    output.write("\n")
print(json.dumps(pin(destination)))
