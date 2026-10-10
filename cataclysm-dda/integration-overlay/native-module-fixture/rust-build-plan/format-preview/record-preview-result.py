"""Pin the completed preview and compare literal bytes; no formatter/tool launch."""
from pathlib import Path
import hashlib
import json
import re

HERE = Path(__file__).resolve().parent
ATTEMPT = HERE / "execution/formatting-preview-initial"
STAGE = "native-fixture-rustfmt-workcopy-preview"


def pin(path):
    path = Path(path).resolve()
    state = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": state.hexdigest()}


def read_json(path):
    return json.loads(Path(path).read_bytes())


terminal = read_json(ATTEMPT / "terminal.json")
metrics = read_json(ATTEMPT / (STAGE + ".json"))
cleanup = read_json(ATTEMPT / (STAGE + ".outer-cleanup.json"))
assert terminal["status"] == "preview-ready-for-parent-diff-and-log-review"
assert terminal["RustfmtExecuted"] and terminal["all567ProtectedPinnedBytesUnchanged"]
assert terminal["allOwnedJobsAndExactRootHandlesClosed"] and not terminal["actualRustSourceEdited"]
assert not terminal["copybackAuthorized"] and not terminal["CargoExecuted"] and not terminal["ClippyExecuted"]
assert metrics["passed"] and metrics["exitCode"] == 0 and not metrics["remainingOwnedPidsBeforeJobClose"]
assert cleanup["passed"] and not cleanup["remainingOwnedJobHandles"] and not cleanup["errors"]
assert len(cleanup["rootsCreated"]) == 1 and any(row["action"] == "close-owned-process-handle" and
    row.get("processHandle") == cleanup["rootsCreated"][0]["processHandle"] for row in cleanup["outerActions"])
candidate = terminal["candidates"][0]
for item in candidate.values():
    assert pin(item["path"]) == item
before = Path(candidate["beforeCopy"]["path"]).read_bytes()
after = Path(candidate["formattedWorkcopy"]["path"]).read_bytes()
before.decode("utf-8")
after.decode("utf-8")
# These exact authored files use ordinary quoted literals, not raw strings.
# This is a bounded byte-token witness, not a full Rust AST equivalence proof.
pattern = rb'"(?:[^"\\]|\\.)*"'
literals_before, literals_after = re.findall(pattern, before), re.findall(pattern, after)
assert literals_before == literals_after
tests_before = sorted(re.findall(rb"#\[test\]\s+fn ([a-z0-9_]+)\(\)", before))
tests_after = sorted(re.findall(rb"#\[test\]\s+fn ([a-z0-9_]+)\(\)", after))
assert tests_before == tests_after and len(tests_before) == 4
stdout, stderr = ATTEMPT / (STAGE + ".stdout.log"), ATTEMPT / (STAGE + ".stderr.log")
warning = stderr.read_text(encoding="utf-8")
assert warning.strip() == "Warning: can't set `make_backup = false`, unstable features are only available in nightly channel."
assert stdout.stat().st_size == 0
root = metrics["rootIdentity"]
assert type(root["creationFiletime"]) is int
proof = {"schemaVersion": 1, "status": "one-workcopy-rustfmt-preview-ready-for-root-diff-and-log-review",
    "terminal": pin(ATTEMPT / "terminal.json"), "metrics": pin(ATTEMPT / (STAGE + ".json")),
    "outerCleanup": pin(ATTEMPT / (STAGE + ".outer-cleanup.json")), "candidate": candidate,
    "stdout": pin(stdout), "stderr": pin(stderr), "stderrWarningExact": warning,
    "unsupportedBackupConfigIgnoredByStableTool": True, "observedWorkcopyHasOnlyLibRsNoBackup": True,
    "durationSeconds": metrics["durationSeconds"], "jobPeakPrivateBytes": metrics["jobPeakPrivateBytes"],
    "maximumSampledWorkingSetBytes": max(row["ownedWorkingSetBytes"] for row in metrics["samples"]),
    "minimumAvailablePhysicalBytes": min(row["physicalFreeBytes"] for row in metrics["samples"]),
    "minimumExactCommitHeadroomBytes": min(row["exactCommitHeadroomBytes"] for row in metrics["samples"]),
    "rootIdentity": {"pid": root["pid"], "creationFiletime": str(root["creationFiletime"])},
    "remainingOwnedPidsBeforeJobClose": metrics["remainingOwnedPidsBeforeJobClose"],
    "remainingOwnedJobHandles": cleanup["remainingOwnedJobHandles"], "cleanupErrors": cleanup["errors"],
    "exactReturnedRootHandleClosed": True, "all567ProtectedPinnedBytesUnchanged": True,
    "ordinaryQuotedLiteralTokensUnchanged": True, "ordinaryQuotedLiteralTokenCount": len(literals_before),
    "exactFourTestFunctionNamesUnchanged": [name.decode("ascii") for name in tests_before],
    "fullRustAstEquivalenceClaimed": False, "actualSourceCopybackPerformed": False,
    "CargoExecuted": False, "ClippyExecuted": False, "additionalRuntimeAttempted": False}
path = HERE / "preview-verification.json"
path.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"proof": pin(path), "literalTokensUnchanged": len(literals_before),
                  "rootIdentity": proof["rootIdentity"], "actualSourceCopybackPerformed": False}))
