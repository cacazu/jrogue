"""Preserve revalidated bytes used by the completed initial Rust4 run; no tool launch."""
from pathlib import Path
import hashlib
import json
import shutil

HERE = Path(__file__).resolve().parent
ATTEMPT = HERE / "execution/native-json-rust-initial"
PLAN_SHA = "3f0e4c50fd2cdce787420caffd86f5895df3fc39e51e60466ec95b5102d15422"


def pin(path):
    path = Path(path).resolve()
    state = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": state.hexdigest()}


data = (HERE / "rust-consumer-plan.json").read_bytes()
assert hashlib.sha256(data).hexdigest() == PLAN_SHA
plan = json.loads(data)
proof = json.loads((HERE / "rust-consumer-verification.json").read_bytes())
assert proof["genuineRustNativeByteConsumerTests"] == 4 and proof["all518ProtectedPinnedFilesUnchanged"]
destination = ATTEMPT / "accepted-input-copies"
destination.mkdir(exist_ok=False)
records = []


def preserve(item, relative, group):
    source, target = Path(item["path"]), destination / relative
    assert pin(source) == item
    target.parent.mkdir(parents=True, exist_ok=True)
    assert not target.exists()
    shutil.copyfile(source, target)
    copied = pin(target)
    assert all(copied[key] == item[key] for key in ["bytes", "sha256"])
    records.append({"group": group, "original": item, "acceptedCopy": copied})


roots = {"fixture-crate": HERE.parent / "rust-consumer",
         "frozen-consumer": HERE.parent.parent / "rust-snapshot-consumer"}
for group, root in roots.items():
    for item in plan["inputs"]:
        path = Path(item["path"])
        if path.is_relative_to(root):
            preserve(item, Path(group) / path.relative_to(root), group)
identity = next(item for item in plan["inputs"] if Path(item["path"]) == HERE.parent / "module-build-id.txt")
preserve(identity, Path("fixture-identity/module-build-id.txt"), "fixture-identity")
for name, item in plan["actualNativeJsonPins"].items():
    preserve(item, Path("native-json") / (name + ".json"), "native-json")
for item in plan["dependencyArchives"]:
    preserve(item["archive"], Path("dependency-archives") / Path(item["archive"]["path"]).name, "dependency-archive")
binary = proof["executedOwnedTestBinary"]
preserve(binary, Path("executed-binary") / Path(binary["path"]).name, "executed-test-binary")
counts = {name: sum(row["group"] == name for row in records) for name in sorted({row["group"] for row in records})}
assert counts["fixture-crate"] == 3 and counts["frozen-consumer"] == 7 and counts["native-json"] == 9
assert counts["dependency-archive"] == 11 and counts["fixture-identity"] == 1 and counts["executed-test-binary"] == 1
manifest = {"schemaVersion": 1, "status": "initial-accepted-input-bytes-revalidated-copied-and-frozen",
    "planSha256": PLAN_SHA, "verification": pin(HERE / "rust-consumer-verification.json"),
    "archivedAfterCompletedRunFromRevalidatedPinnedBytes": True, "copies": records, "groupCounts": counts,
    "additionalRuntimeExecuted": False, "originalInputContextExecuted": False, "wholeGameVerified": False}
path = ATTEMPT / "accepted-input-copies.json"
path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"manifest": pin(path), "counts": counts, "additionalRuntimeExecuted": False}))
