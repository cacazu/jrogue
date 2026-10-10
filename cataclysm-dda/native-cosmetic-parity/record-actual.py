"""Validate archived execution evidence; never launch a compiler or game."""
import datetime
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
ATTEMPT = ROOT / "execution" / "native-cosmetic-parity-initial"
EXPECTED_PLAN = "432bd2b499a63ebbb2fa0287a68497da36be7b6cdd48c89b7d1eb63f6f7b9f79"
EXPECTED_OWNER = "5f0f6a99f12086adf38487d03ba46d199d11c3a9a1caa5a30f774b5e7a5aa815"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def pin(file):
    file = pathlib.Path(file)
    data = file.read_bytes()
    return {"path": str(file), "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest()}


def pairs(rows):
    result = {}
    for key, value in rows:
        require(key not in result, "duplicate JSON key")
        result[key] = value
    return result


def load(file):
    return json.loads(pathlib.Path(file).read_bytes().decode("utf-8"),
                      object_pairs_hook=pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))


def identity(row):
    require(type(row["pid"]) is int and row["pid"] > 0, "invalid PID")
    require(type(row["creationFiletime"]) is int and row["creationFiletime"] > 0,
            "FILETIME must be parsed directly as a Python integer")
    return {"pid": row["pid"], "creationFiletimeDecimal": str(row["creationFiletime"])}


plan_pin = pin(ATTEMPT / "accepted-plan.json")
owner_pin = pin(ATTEMPT / "accepted-owner.py")
require(plan_pin["sha256"] == EXPECTED_PLAN == pin(ROOT / "WINDOW-PLAN.json")["sha256"],
        "frozen accepted plan differs")
require(owner_pin["sha256"] == EXPECTED_OWNER == pin(ROOT / "run-window.py")["sha256"],
        "frozen accepted owner differs")
plan = load(ATTEMPT / "accepted-plan.json")
terminal = load(ATTEMPT / "terminal.json")
require(terminal["status"] == "actual-cpp-rust-parity-passed" and terminal["checks"] == 23,
        "actual terminal did not pass")
require(terminal["planSha256"] == EXPECTED_PLAN and terminal["runnerSha256"] == EXPECTED_OWNER,
        "terminal identity differs")
for flag in ("actualCppRuntimePassed", "actualRustRuntimePassed", "protectedBytesUnchanged",
             "executionContextMetadataUnchanged", "preparationContextMetadataEqual",
             "ownedJobsClosedAndRootsWaited"):
    require(terminal[flag] is True, "missing passed gate: " + flag)
for flag in ("originalCallersExecuted", "originalRngProved", "saveResumeProved",
             "browserExecuted", "wholeGameAccepted"):
    require(terminal[flag] is False, "unsupported acceptance flag: " + flag)
before = load(ATTEMPT / "pins-before.json")
after = load(ATTEMPT / "pins-after.json")
trees_before = load(ATTEMPT / "trees-before.json")
trees_after = load(ATTEMPT / "trees-after.json")
require(before == after and len(before) == 10910, "protected byte records differ")
require(trees_before == trees_after == plan["preparationContextTrees"],
        "exact archived metadata differs")
preparation = load(ROOT / "prepared" / "SOURCE-PREPARATION.json")
source_pins = []
for record in ([preparation["frozenSourcePlan"], preparation["cppOriginal"],
                preparation["headerOriginal"], preparation["expectedOriginal"]]
               + preparation["RustSourcePins"] + preparation["outputs"]):
    observed = pin(record["path"])
    require(observed == record, "original/prepared source changed: " + record["path"])
    source_pins.append(observed)
library = (ROOT / "prepared/rust/src/authoritative-lib.rs").read_bytes()
require((ROOT / "prepared/rust/src/main.rs").read_bytes()
        == library + b'\ninclude!("parity-harness.rs");\n', "Rust body/prefix changed")
expected = (ROOT / "prepared/expected-stdout.txt").read_bytes()
require(len(expected) == 919 and expected.count(b"\n") == 23
        and expected.endswith(b'{"summary":true,"checks":23,"failed":0}\n'),
        "frozen complete stream changed")
streams = []
for file in (ROOT / "prepared/expected-stdout.txt", ATTEMPT / "run-cpp.stdout.log",
             ATTEMPT / "run-rust.stdout.log"):
    require(file.read_bytes() == expected, "complete actual stream differs")
    file.read_bytes().decode("utf-8", errors="strict")
    streams.append(pin(file))
stages = []
for stage, verdict in zip(("compile-cpp", "run-cpp", "compile-rust", "run-rust"), terminal["stages"]):
    metrics = load(ATTEMPT / (stage + ".json"))
    cleanup = load(ATTEMPT / (stage + ".outer-cleanup.json"))
    require(metrics["stage"] == verdict["stage"] == stage and metrics["passed"] is True
            and metrics["exitCode"] == 0 and verdict["status"] == "passed", "stage failed")
    require(metrics["argv"] == verdict["argv"], "actual command differs")
    require(metrics["remainingOwnedPidsBeforeJobClose"] == [], "owned PIDs remain")
    require(cleanup["passed"] is True and cleanup["errors"] == []
            and cleanup["remainingOwnedJobHandles"] == [], "owned handles remain")
    require(len(cleanup["rootsCreated"]) == 1
            and cleanup["rootsCreated"][0]["pid"] == metrics["rootIdentity"]["pid"],
            "cleanup root identity differs")
    decision = load(ATTEMPT / (stage + ".launch-decision.json"))
    require(decision["freshCounters"] == verdict["freshCounters"], "owner launch snapshot differs")
    # The owner and the inner guard make separate, adjacent observations.
    # In run-rust the physical counter changed by 45,056 bytes between them.
    for snapshot in (metrics["freshGate"], verdict["freshCounters"]):
        require(snapshot["physicalFreeBytes"] >= 4294967296
                and snapshot["exactCommitHeadroomBytes"] >= 6442450944,
                "launch resource gate did not pass")
    require((ATTEMPT / (stage + ".stderr.log")).read_bytes() == b"", "unexpected stderr")
    for output in verdict["outputs"]:
        require(pin(output["source"]["path"]) == output["source"]
                and pin(output["archive"]["path"]) == output["archive"], "artifact changed")
    stages.append({"stage": stage, "capturedUtc": verdict["capturedUtc"],
                   "durationSeconds": metrics["durationSeconds"],
                   "jobPeakPrivateBytes": metrics["jobPeakPrivateBytes"],
                   "ownerLaunchCounters": verdict["freshCounters"],
                   "innerGuardLaunchCounters": metrics["freshGate"],
                   "rootIdentity": identity(metrics["rootIdentity"]),
                   "observedJobMembers": [identity(row) for row in metrics["identities"]],
                   "ownedJobsClosedAndRootWaited": True, "artifacts": verdict["outputs"]})
require(len(terminal["stages"]) == 4, "extra terminal stages")
raw_files = sorted(ATTEMPT.glob("*"))
proof = {
    "schemaVersion": 1,
    "status": "actual-cpp-rust-parity-passed-archived-evidence-verified",
    "recordedUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "sourceCommit": plan["sourceCommit"],
    "actualAttempt": str(ATTEMPT),
    "plan": plan_pin, "owner": owner_pin,
    "sourceRecords": source_pins, "checks": 23, "dataRecords": 22,
    "completeStreamsByteExact": True, "newlineNormalizationRequired": False,
    "streams": streams, "stages": stages,
    "protectedByteRecords": len(before), "archivedBeforeAfterBytesEqual": True,
    "executionAndPreparationMetadataExact": True,
    "metadataMembers": {name: len(rows) for name, rows in trees_before.items()},
    "rawEvidence": [pin(file) for file in raw_files if file.is_file()],
    "distinctBoundedRustUnitTests": 62, "newDistinctRustUnitTests": 0,
    "originalCallersExecuted": False, "originalRngProved": False,
    "saveResumeProved": False, "browserExecuted": False, "wholeGameAccepted": False,
    "recorderLaunchesNoCompilerRuntimeOrBrowser": True,
    "identityEncoding": "Raw JSON integers parsed directly by Python; FILETIME copied to decimal strings.",
}
target = ROOT / "ACTUAL-VERIFICATION.json"
with target.open("x", encoding="utf-8", newline="\n") as output:
    json.dump(proof, output, ensure_ascii=False, indent=2)
    output.write("\n")
print(json.dumps({"status": proof["status"], "checks": 23, "proof": pin(target)}))
