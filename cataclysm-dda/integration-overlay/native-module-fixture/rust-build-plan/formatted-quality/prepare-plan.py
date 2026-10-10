"""Prepare three bounded package-only quality commands; no Cargo/tool launch."""
from pathlib import Path
import hashlib
import json
import os
import tomllib

HERE = Path(__file__).resolve().parent
RUST = HERE.parent
FIXTURE = RUST.parent
ROOT = HERE.parents[3]
SOURCE = FIXTURE / "rust-consumer/src/lib.rs"
BEFORE_SHA = "e286ee35b93c4bd4ad659472be2661ee608d1e3be963933906e78d8bd6453dd1"
AFTER_SHA = "0b7004be0abe150f79f6dc23bebc9f6fc5d3ba75459c45b6baf05b37d9f87b43"


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


current_source = pin(SOURCE)
assert current_source["sha256"] == AFTER_SHA
records = {}


def collect(value):
    if isinstance(value, dict):
        if all(key in value for key in ["path", "bytes", "sha256"]):
            item = {key: value[key] for key in ["path", "bytes", "sha256"]}
            key = str(Path(item["path"]).resolve())
            # The root explicitly approved only this exact after hash. Historical
            # before bytes live in accepted copies; all other current pins stay fixed.
            if key == str(SOURCE.resolve()):
                assert item["sha256"] in [BEFORE_SHA, AFTER_SHA]
                item = current_source
            assert key not in records or records[key] == item
            records[key] = item
        for child in value.values():
            collect(child)
    elif isinstance(value, list):
        for child in value:
            collect(child)


base_path = RUST / "rust-consumer-plan.json"
base = checked_json(base_path, "3f0e4c50fd2cdce787420caffd86f5895df3fc39e51e60466ec95b5102d15422")
initial_proof_path = RUST / "rust-consumer-verification.json"
initial = checked_json(initial_proof_path, "ee82525ae96abf2d6e2d5ff10bdea513db980beadc79aea4e8983dcd728fa58a")
archive_path = RUST / "execution/native-json-rust-initial/accepted-input-copies.json"
archive = checked_json(archive_path, "421212a022b5bded75c5fdf089697ee321b811e49c31c33b66687ccc2815947a")
preview_proof_path = RUST / "format-preview/preview-verification.json"
preview = checked_json(preview_proof_path, "9fc28d2899edb7228d3c2d160e9020714b51b069840c4d8b5e1d93c3a171023b")
acceptance_path = RUST / "format-preview/reviewed-copyback.json"
acceptance = checked_json(acceptance_path, "81dc79f5cc1e03151bb08abcfca6a8aabba0329970401dcdc17462a3973f7c38")
assert acceptance["after"] == current_source and acceptance["before"]["sha256"] == BEFORE_SHA
collect([base, initial, archive, preview, acceptance])
manifest = FIXTURE / "rust-consumer/Cargo.toml"
package = tomllib.loads(manifest.read_text(encoding="utf-8"))["package"]
assert package["name"] == "cdda-snapshot-native-fixture-consumer" and package["edition"] == "2024"
initial_source_copy = next(item["acceptedCopy"] for item in archive["copies"]
    if Path(item["original"]["path"]) == SOURCE)
assert initial_source_copy["sha256"] == BEFORE_SHA and pin(initial_source_copy["path"]) == initial_source_copy
cargo = Path(base["commands"][0]["executable"])
tools = {name: pin(cargo.parent / filename) for name, filename in [
    ("cargo", "cargo.exe"), ("rustc", "rustc.exe"), ("rustfmt", "rustfmt.exe"),
    ("cargo-fmt", "cargo-fmt.exe"), ("cargo-clippy", "cargo-clippy.exe"), ("clippy-driver", "clippy-driver.exe")]}
tools["linker"] = pin(base["commands"][0]["environment"]["CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER"])
environment = dict(base["commands"][0]["environment"])
environment.update(RUSTFMT=tools["rustfmt"]["path"], RAYON_NUM_THREADS="1",
                   PATH=str(cargo.parent) + os.pathsep + os.environ.get("PATH", ""))
target = HERE / "target"
assert not os.path.lexists(target)
cwd = str(FIXTURE / "rust-consumer")
common = ["--manifest-path", str(manifest), "--package", package["name"]]
commands = [
    {"stage": "native-fixture-package-format-check", "executable": str(cargo),
     "argv": ["fmt", *common, "--", "--check", "--config-path", str(HERE / "rustfmt.toml")], "cwd": cwd},
    {"stage": "native-fixture-same-four-tests-after-formatting", "executable": str(cargo),
     "argv": ["test", "--offline", "--locked", "--jobs", "1", *common, "--target", "x86_64-pc-windows-gnu",
              "--target-dir", str(target), "--lib", "--", "--test-threads=1"], "cwd": cwd},
    {"stage": "native-fixture-package-clippy-after-formatting", "executable": str(cargo),
     "argv": ["clippy", "--offline", "--locked", "--jobs", "1", *common, "--target", "x86_64-pc-windows-gnu",
              "--target-dir", str(target), "--lib", "--tests", "--no-deps", "--", "-D", "warnings"], "cwd": cwd}]
reference = ROOT / "semantic-parameter-slice/FORMAT-CLIPPY-NEXT.json"
helper = ROOT / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"
for path in [base_path, initial_proof_path, archive_path, preview_proof_path, acceptance_path,
             RUST / "run-rust-window.py", HERE / "rustfmt.toml", HERE / "prepare-plan.py", reference, helper]:
    collect(pin(path))
collect(tools)
for item in records.values():
    assert pin(item["path"]) == item
result = {"schemaVersion": 1, "status": "source-only-three-package-checks-not-executed",
    "sourceCommit": base["sourceCommit"], "moduleBuildIdentity": base["moduleBuildIdentity"],
    "pins": [records[key] for key in sorted(records)], "preparedUniquePinCount": len(records),
    "commands": commands, "rustEnvironment": environment, "installedTools": tools,
    "cpp2Helper": pin(helper), "config": pin(HERE / "rustfmt.toml"),
    "launchGate": base["launchGate"], "ownedResourceGuard": base["ownedResourceGuard"],
    "browserPriorityGate": base["browserPriorityGate"], "guard": base["guard"],
    "removeInheritedEnvironment": base["removeInheritedEnvironment"],
    "expectedOrderedTests": base["expectedOrderedTests"], "actualNativeJsonPins": base["actualNativeJsonPins"],
    "authorizedCurrentSourceChange": {"path": str(SOURCE), "beforeSha256": BEFORE_SHA, "afterSha256": AFTER_SHA,
        "unchangedFrozenBeforeCopy": initial_source_copy, "reviewedAcceptance": pin(acceptance_path)},
    "initialGenuineProof": pin(initial_proof_path), "newOwnedTarget": str(target),
    "initialExecutedTargetMustRemainUnchanged": str(RUST / "target"),
    "cargoCachePolicy": base["cargoCachePolicy"], "referencePackageToolPattern": pin(reference),
    "FormatCheckExecuted": False, "RustTestsExecuted": False, "ClippyExecuted": False,
    "originalInputContextExecuted": False, "commandOwnershipVerified": False, "wholeGameVerified": False,
    "policy": "Three sequential exact commands only after separate root reservation/current source review. Pinned GNU bin is first on per-process PATH; RUSTFMT is exact pinned executable. No --all/--workspace or dependency lints. No actual-source mutation, old target replacement, cache metadata freeze, network, new dependency graph, SDK/config/security change, browser or original-engine work."}
destination = HERE / "quality-plan.json"
destination.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"plan": pin(destination), "uniquePins": len(records), "stages": 3,
                  "checksExecuted": False, "newTarget": str(target)}))
