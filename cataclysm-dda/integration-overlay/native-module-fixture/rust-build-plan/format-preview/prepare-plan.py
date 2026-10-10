"""Source-only single-file rustfmt preview plan; never launch or copy back."""
from pathlib import Path
import hashlib
import json
import tomllib

HERE = Path(__file__).resolve().parent
RUST = HERE.parent
ROOT = HERE.parents[3]


def pin(path):
    path = Path(path).resolve()
    state = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": state.hexdigest()}


def checked_json(path, expected):
    data = Path(path).read_bytes()
    assert hashlib.sha256(data).hexdigest() == expected
    return json.loads(data)


def collect(value, records):
    if isinstance(value, dict):
        if all(key in value for key in ["path", "bytes", "sha256"]):
            item = {key: value[key] for key in ["path", "bytes", "sha256"]}
            key = str(Path(item["path"]).resolve())
            assert key not in records or records[key] == item
            records[key] = item
        for child in value.values():
            collect(child, records)
    elif isinstance(value, list):
        for child in value:
            collect(child, records)


base = checked_json(RUST / "rust-consumer-plan.json", "3f0e4c50fd2cdce787420caffd86f5895df3fc39e51e60466ec95b5102d15422")
proof = checked_json(RUST / "rust-consumer-verification.json", "ee82525ae96abf2d6e2d5ff10bdea513db980beadc79aea4e8983dcd728fa58a")
accepted_path = RUST / "execution/native-json-rust-initial/accepted-input-copies.json"
accepted = checked_json(accepted_path, "421212a022b5bded75c5fdf089697ee321b811e49c31c33b66687ccc2815947a")
readiness = checked_json(RUST / "package-tool-readiness.json", "9dcaeb8e4adb6d12a591a2d38f95b21a29080380aa1de02713ef6e22c662d7e0")
assert proof["genuineRustNativeByteConsumerTests"] == 4 and proof["allOwnedJobsClosed"]
manifest_path = RUST.parent / "rust-consumer/Cargo.toml"
manifest = tomllib.loads(manifest_path.read_text(encoding="utf-8"))
assert manifest["package"]["edition"] == "2024"
source = pin(RUST.parent / "rust-consumer/src/lib.rs")
original = next(item for item in base["inputs"] if item["path"] == source["path"])
assert source == original
source_copy = next(item["acceptedCopy"] for item in accepted["copies"] if item["original"] == source)
assert pin(source_copy["path"]) == source_copy
rustfmt = next(item for item in readiness["tools"] if Path(item["path"]).name == "rustfmt.exe")
assert pin(rustfmt["path"]) == rustfmt
reference = ROOT / "semantic-parameter-slice/format-next"
records = {}
collect(base, records)
collect(accepted, records)
collect(proof, records)
for path in [RUST / "rust-consumer-plan.json", RUST / "run-rust-window.py", RUST / "rust-consumer-verification.json",
             RUST / "package-tool-readiness.json", accepted_path, HERE / "rustfmt.toml", HERE / "prepare-plan.py",
             reference / "run-preview.py", reference / "preview-plan.json"]:
    collect(pin(path), records)
collect(rustfmt, records)
collect(pin(ROOT / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"), records)
python = pin(Path("C:/Users/kit/emsdk/python/3.13.3_64bit/python.exe"))
collect(python, records)
for item in records.values():
    assert pin(item["path"]) == item
result = {"schemaVersion": 1, "status": "source-only-one-workcopy-format-preview-not-executed",
    "sourceCommit": base["sourceCommit"], "sourceFile": source, "acceptedInitialSourceCopy": source_copy,
    "sourceEdition": "2024", "installedRustfmt": rustfmt, "installedPython": python,
    "config": pin(HERE / "rustfmt.toml"), "pins": [records[key] for key in sorted(records)],
    "preparedUniquePinCount": len(records), "originalInitialRustProof": pin(RUST / "rust-consumer-verification.json"),
    "acceptedInitialCopiesManifest": pin(accepted_path), "cpp2Helper": pin(ROOT / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"),
    "referencePattern": {"owner": pin(reference / "run-preview.py"), "plan": pin(reference / "preview-plan.json"),
                         "usedForSourcePatternOnlyNotExecuted": True},
    "command": {"stage": "native-fixture-rustfmt-workcopy-preview", "executable": rustfmt["path"],
        "argvTemplate": ["--edition", "2024", "--config-path", str(HERE / "rustfmt.toml"),
                         "--config", "skip_children=true", "{work_lib}"], "cwdTemplate": "{work}"},
    "launchGate": base["launchGate"], "ownedResourceGuard": base["ownedResourceGuard"],
    "browserPriorityGate": base["browserPriorityGate"], "guard": base["guard"],
    "removeInheritedEnvironment": base["removeInheritedEnvironment"],
    "rustEnvironment": {"CARGO_NET_OFFLINE": "true", "CARGO_BUILD_JOBS": "1", "RUST_TEST_THREADS": "1", "RAYON_NUM_THREADS": "1"},
    "originalsMayChange": False, "copybackAuthorized": False, "initialProofMayChange": False,
    "RustfmtExecuted": False, "CargoExecuted": False, "ClippyExecuted": False,
    "originalInputContextExecuted": False, "wholeGameVerified": False,
    "policy": "One exact trusted rustfmt process under fixed run_owned. Fresh per-attempt workcopy is created only after launch decision. Only working-copy bytes and own evidence/diff may change. Preserve every accepted initial source/native/proof byte. No copyback until root reviews exact diff and separately authorizes a reviewed source update."}
destination = HERE / "preview-plan.json"
destination.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"plan": pin(destination), "uniquePins": len(records), "sourceEdition": "2024", "RustfmtExecuted": False}))
