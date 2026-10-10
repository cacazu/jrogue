"""Prepare only; no Rust tool, resolver, Windows guard, browser or engine launch."""
from pathlib import Path
import hashlib
import json
import re
import copy

HERE = Path(__file__).resolve().parent
SLICE = HERE.parent
ROOT = SLICE.parent
OLD = ROOT / "integration-overlay/native-module-fixture/rust-build-plan/rust-consumer-plan.json"
CPP2 = ROOT / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"

def pin(path):
    path = Path(path).resolve()
    data = path.read_bytes()
    return {"path": str(path), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

def all_pins(value):
    result = {}
    def visit(item):
        if isinstance(item, dict):
            if all(key in item for key in ("path", "bytes", "sha256")):
                record = {key:item[key] for key in ("path", "bytes", "sha256")}
                assert record["path"] not in result or result[record["path"]] == record
                result[record["path"]] = record
            for child in item.values():
                visit(child)
        elif isinstance(item, list):
            for child in item:
                visit(child)
    visit(value)
    return list(result.values())

def validate(item):
    if pin(item["path"]) != {key:item[key] for key in ("path", "bytes", "sha256")}:
        raise RuntimeError("changed frozen input: " + item["path"])

old = json.loads(OLD.read_bytes())
proof_path = SLICE / "ORIGINAL-CONTEXT-VERIFICATION.json"
proof_pin = pin(proof_path)
assert proof_pin["sha256"] == "dbc812584b6d7bd26e3e752be84dada30ddf1851b7b4daa88f7736844356fd53"
proof = json.loads(proof_path.read_bytes())
assert proof["nativeJsonRecordCount"] == 24 and proof["selectedOriginalClassMembersExecuted"]
assert proof["all246ProtectedFilesUnchanged"] and proof["allOwnedRootsAndJobsClosed"]
assert not proof["liveEngineIntegrated"] and not proof["wholeGameVerified"]
plan = copy.deepcopy(old)
kept = [item for item in old["inputs"] if "/rust-snapshot-consumer/" in item["path"].replace("\\", "/") or item["path"].endswith(("cargo.exe", "rustc.exe", "x86_64-w64-mingw32-gcc.exe", "run-consumer-window.py", "run-parser-window.py"))]
assert len(kept) == 12
inputs = kept + [pin(SLICE / p) for p in ["rust-consumer/Cargo.toml", "rust-consumer/Cargo.lock", "rust-consumer/src/lib.rs", "continuation-interner/module-build-id.txt", "SOURCE-SELECTION.json", "generated/original-members.cpp", "fixture-leaves.cpp", "INITIAL-NATIVE-VERIFICATION.json", "continuation-interner/execution/wasm-results/verification.json"]] + [proof_pin, pin(__file__), pin(OLD), pin(CPP2)]
for key in ("wasm", "terminal", "plan", "owner", "actualOriginalInterner"):
    inputs.append(proof[key])
records = proof["exactNativeJsonRecords"]
assert len(records) == 24
assert len(old["dependencyArchives"]) == 11 and len(old["dependencyRegularFilePins"]) == 473
for item in all_pins(inputs + records + old["dependencyArchives"] + old["dependencyRegularFilePins"]):
    validate(item)
source = (SLICE / "rust-consumer/src/lib.rs").read_text(encoding="utf-8")
names = sorted("tests::" + x for x in re.findall(r"#\[test\]\s+fn ([a-z0-9_]+)\(\)", source))
assert len(names) == len(set(names)) == 5
frozen_lock = (ROOT / "integration-overlay/rust-snapshot-consumer/Cargo.lock").read_text(encoding="utf-8")
new_lock = (SLICE / "rust-consumer/Cargo.lock").read_text(encoding="utf-8")
package = '\n[[package]]\nname = "cdda-original-context-consumer"\nversion = "0.1.0"\ndependencies = [\n "cdda-live-input-snapshot-consumer",\n]\n'
assert new_lock.count(package) == 1 and new_lock.replace(package, "") == frozen_lock
command = copy.deepcopy(old["commands"][0])
command.update(stage="actual-original-context-rust-consumer", cwd=str(SLICE), expectedTests=5)
command["argv"] = ["test", "--offline", "--locked", "--jobs", "1", "--manifest-path", str(SLICE / "rust-consumer/Cargo.toml"), "--target", "x86_64-pc-windows-gnu", "--target-dir", str(HERE / "target"), "--lib", "--", "--test-threads=1"]
plan.update(schemaVersion=1, status="source-prepared-five-actual-original-context-consumers-no-cargo-run", inputs=inputs, actualNativeJsonPins=records, expectedOrderedTests=names, commands=[command], originalInputContextExecutedInPriorNativeWindow=True, selectedOriginalClassMembersExecutedInPriorNativeWindow=True, originalActionContextsLookupVerifiedInPriorNativeWindow=True, originalInputContextExecutedInThisRustWindow=False, RustActualOriginalRecordConsumersExecuted=False, rustNativeFixtureConsumersExecuted=False, wholeGameVerified=False, liveEngineIntegrated=False, commandOwnershipVerified=False, cargoExecuted=False, sourceScope="Exact frozen selected-original-class outputs, not transport callbacks fixture or full live engine", rawUsernameScope="Snapshot ABI contains context/binding metadata; CJK raw username itself is separate C++/Node raw getter proof and is not reclassified as a Rust ABI input", observationPurityScope=proof["observationPurityScope"], priorNativeProof=proof_pin, nativeJsonSubstitutionAllowed=False)
plan.pop("originalInputContextExecuted",None)
plan.pop("originalActionContextsLookupVerified",None)
plan["guard"]["reviewStatus"] = "Reuses pinned reviewed CPP2 helper and fail-closed outer; this five-test owner requires independent review and separate root release"
plan["guard"]["note"] = "Rust-only offline package test, one worker, fresh owned output. No compiler/link/browser/native re-execution. Exact fixed outer owns jobs and root handles."
plan["requiredOwner"] = "Pinned CPP2 load_wrapper and fixed fail-closed run_owned; exact source owner review plus separate parent sole-heavy-slot release; no retry"
plan["lockPolicy"] = "Prepared bytes equal accepted frozen consumer Cargo.lock plus exactly the new local root package; offline locked Cargo acceptance pending"
unique = {x["path"]:x for x in all_pins(inputs + records + old["dependencyArchives"] + old["dependencyRegularFilePins"])}
plan["expectedPreparedUniqueFiles"] = len(unique)
plan["expectedFinalUniqueFiles"] = len(unique) + 2  # plan/owner; CPP2 helper already protected
(HERE / "rust-consumer-plan.json").write_text(json.dumps(plan, indent=2)+"\n", encoding="utf-8")
print(json.dumps({"status":plan["status"],"plan":pin(HERE / "rust-consumer-plan.json"),"inputCount":len(inputs),"preparedUniqueFiles":len(unique),"finalUniqueFiles":len(unique)+2,"expectedOrderedTests":names}))
