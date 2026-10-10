"""Condense completed compile-only evidence; never invoke a build or process."""
from pathlib import Path
import hashlib
import json
import re

HERE = Path(__file__).resolve().parent
ATTEMPT = HERE / "execution/cpp2-corrected-preflight"


def load(path):
    return json.loads(Path(path).read_bytes())


def pin(path):
    source = Path(path)
    state = hashlib.sha256()
    with source.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            state.update(block)
    return {"path": str(source.resolve()), "bytes": source.stat().st_size, "sha256": state.hexdigest()}


def main():
    terminal = load(ATTEMPT / "terminal.json")
    if terminal["status"] != "two-translation-units-compile-only-passed" or not all(terminal[key] for key in
            ["protectedPinnedBytesUnchanged", "frozenTreeMetadataUnchanged", "ownedJobsClosedAndRootsWaited"]):
        raise RuntimeError("completed success/cleanup/input evidence required")
    stages = []
    for stage in terminal["stages"]:
        metrics_path = ATTEMPT / (stage["stage"] + ".json")
        cleanup_path = ATTEMPT / (stage["stage"] + ".outer-cleanup.json")
        metrics, cleanup = load(metrics_path), load(cleanup_path)
        if not metrics["passed"] or metrics["exitCode"] != 0 or metrics["remainingOwnedPidsBeforeJobClose"] or \
                not cleanup["passed"] or cleanup["remainingOwnedJobHandles"]:
            raise RuntimeError("non-terminal owned stage")
        stderr_path = ATTEMPT / (stage["stage"] + ".stderr.log")
        stderr = stderr_path.read_text(encoding="utf-8")
        warnings = [line for line in stderr.splitlines() if "warning:" in line]
        errors = [line for line in stderr.splitlines() if re.search(r"\b(?:fatal )?error:", line)]
        if errors:
            raise RuntimeError("unexpected compiler errors")
        artifacts = []
        for item in stage["outputs"]:
            current, archived = pin(item["path"]), pin(item["archive"]["path"])
            if current["sha256"] != item["sha256"] or archived["sha256"] != item["sha256"]:
                raise RuntimeError("completed artifact bytes changed")
            artifacts.append({"role": item["role"], "current": current, "archive": archived})
        stages.append({"stage": stage["stage"], "compilerExitCode": 0,
                       "durationSeconds": metrics["durationSeconds"], "jobPeakPrivateBytes": metrics["jobPeakPrivateBytes"],
                       "maximumSampledWorkingSetBytes": max(sample["ownedWorkingSetBytes"] for sample in metrics["samples"]),
                       "minimumSampledPhysicalFreeBytes": min(sample["physicalFreeBytes"] for sample in metrics["samples"]),
                       "minimumSampledExactCommitHeadroomBytes": min(sample["exactCommitHeadroomBytes"] for sample in metrics["samples"]),
                       "freshLaunchGate": metrics["freshGate"], "sampleCount": len(metrics["samples"]),
                       "rootIdentity": metrics["rootIdentity"], "ownedMemberIdentities": metrics["identities"],
                       "ownedRootAndJobClosed": True, "actualNonSystemDependencyCount": len(stage["actualNonSystemDependencies"]),
                       "actualNonSystemDependencyPins": stage["actualNonSystemDependencies"],
                       "warnings": warnings, "compilerErrors": errors, "artifacts": artifacts,
                       "metricsEvidence": pin(metrics_path), "cleanupEvidence": pin(cleanup_path), "diagnosticsEvidence": pin(stderr_path)})
    result = {"schemaVersion": 1, "status": "two-actual-cpp-translation-units-compiled-no-link-or-runtime",
              "sourceCommit": "7b2efa5cea38e4d4d97dd0e63b28b9148623da59",
              "planSha256": terminal["planSha256"], "runnerSha256": terminal["runnerSha256"],
              "terminalEvidence": pin(ATTEMPT / "terminal.json"),
              "originalPrelaunchFailurePreserved": pin(HERE / "execution/cpp2-initial/terminal.json"),
              "stages": stages, "actualTranslationUnitsCompiled": 2, "ownedRootCount": terminal["ownedRootCount"],
              "allOwnedJobsClosed": True, "all207PinnedBytesUnchanged": True, "frozenNormalizedMetadataUnchanged": True,
              "cppTypeAccessAndCompileHandlingVerified": True, "measuredFitOneGiBForTheseCompiles": True,
              "nativeNotificationExecuted": False, "snapshotProducerExecuted": False,
              "linkedEngineCandidate": False, "originalProducerConnected": False, "liveRustConnected": False,
              "browserExecuted": False, "stateRngPurityVerified": False, "wholeGameSemanticMigrationComplete": False,
              "limits": ["Compile-only wasm32 objects; no final exports/link/JS/Asyncify validation",
                         "MMD verifies exact non-system dependencies; system-header/import closure is not complete byte pinning",
                         "Working-set maxima are sampled; only aggregate job memory has kernel hard enforcement",
                         "Both owned jobs ended; current engine package, pristine source and accepted baseline objects preserved"]}
    (HERE / "compile-verification.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "stages": [{key: stage[key] for key in
        ["stage", "durationSeconds", "jobPeakPrivateBytes", "maximumSampledWorkingSetBytes", "actualNonSystemDependencyCount", "warnings"]} for stage in stages],
        "allOwnedJobsClosed": True, "compileVerificationSha256": pin(HERE / "compile-verification.json")["sha256"]}))


if __name__ == "__main__":
    main()
