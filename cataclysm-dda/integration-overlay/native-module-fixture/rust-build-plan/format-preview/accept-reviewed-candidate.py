"""Apply only the root-reviewed one-file formatting candidate; no runtime checks."""
from pathlib import Path
import hashlib
import json
import shutil

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent.parent / "rust-consumer/src/lib.rs"
CANDIDATE = HERE / "execution/formatting-preview-initial/work/src/lib.rs"
BEFORE = "e286ee35b93c4bd4ad659472be2661ee608d1e3be963933906e78d8bd6453dd1"
AFTER = "0b7004be0abe150f79f6dc23bebc9f6fc5d3ba75459c45b6baf05b37d9f87b43"


def pin(path):
    data = Path(path).read_bytes()
    return {"path": str(Path(path).resolve()), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


proof_path = HERE / "preview-verification.json"
proof_data = proof_path.read_bytes()
assert hashlib.sha256(proof_data).hexdigest() == "9fc28d2899edb7228d3c2d160e9020714b51b069840c4d8b5e1d93c3a171023b"
proof = json.loads(proof_data)
assert proof["all567ProtectedPinnedBytesUnchanged"] and proof["exactReturnedRootHandleClosed"]
assert proof["remainingOwnedPidsBeforeJobClose"] == proof["remainingOwnedJobHandles"] == proof["cleanupErrors"] == []
assert pin(SOURCE)["sha256"] == BEFORE and pin(CANDIDATE)["sha256"] == AFTER
before_pin = pin(SOURCE)
shutil.copyfile(CANDIDATE, SOURCE)
assert pin(SOURCE)["sha256"] == AFTER and pin(CANDIDATE)["sha256"] == AFTER
assert pin(proof_path)["sha256"] == "9fc28d2899edb7228d3c2d160e9020714b51b069840c4d8b5e1d93c3a171023b"
result = {"schemaVersion": 1, "status": "one-root-reviewed-formatting-candidate-accepted",
    "rootDiffAndLogReviewAuthorizedThisExactCopy": True, "before": before_pin, "after": pin(SOURCE),
    "candidate": pin(CANDIDATE), "frozenPreviewProof": pin(proof_path),
    "initialAcceptedSourcesAndProofsRemainFrozen": True,
    "CargoExecuted": False, "ClippyExecuted": False, "additionalFormatterExecuted": False}
destination = HERE / "reviewed-copyback.json"
destination.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"acceptance": pin(destination), "after": pin(SOURCE), "runtimeChecksLaunched": False}))
