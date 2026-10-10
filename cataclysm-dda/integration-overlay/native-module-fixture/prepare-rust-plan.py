"""Source-only four-test plan and streaming audit of already cached crates; no Cargo."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import tarfile
import tomllib

HERE = Path(__file__).resolve().parent
DESTINATION = HERE / "rust-build-plan"
ROOT = HERE.parents[1]


def digest(path):
    state = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return state.hexdigest()


def pin(path):
    path = Path(path).resolve()
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": digest(path)}


def main():
    DESTINATION.mkdir(exist_ok=True)
    old_path = HERE.parent / "build-plan/next-consumer-build-plan.json"
    old = json.loads(old_path.read_bytes())
    base_path = HERE.parent / "build-plan/cpp-compile/compile-plan.json"
    base_bytes = base_path.read_bytes()
    assert hashlib.sha256(base_bytes).hexdigest() == "f5e5f97a1cd2c8540f73675cc3d0bf8fc4cc462d48fa5f55a1b983c2ae1f3f0e"
    base = json.loads(base_bytes)
    module_proof = json.loads((HERE / "module-verification.json").read_bytes())
    assert module_proof["genuineNodeWasmChecksPassed"] == 29
    assert module_proof["allThreeOwnedJobsClosedAndExactRootHandlesClosed"]
    raw = module_proof["actualNativeJsonFixtures"]
    assert len(raw) == 9
    registry = old["dependencyAudit"]["selectedPins"]
    own_lock = tomllib.loads((HERE / "rust-consumer/Cargo.lock").read_text())
    selected = [item for item in own_lock["package"] if "source" in item]
    assert len(selected) == 11
    assert {(item["name"], item["version"], item["checksum"]) for item in selected} == {
        (item["name"], item["version"], item["sha256"]) for item in registry}

    dependencies, dependency_files = [], []
    for item in registry:
        archive = Path(item["archive"])
        assert digest(archive) == item["sha256"]
        unpacked = Path(item["unpackedManifest"]).parent
        prefix = item["name"] + "-" + item["version"]
        verified = 0
        with tarfile.open(archive, "r|gz") as stream:
            for member in stream:
                relative = PurePosixPath(member.name)
                assert not relative.is_absolute() and ".." not in relative.parts and relative.parts[0] == prefix
                assert not member.issym() and not member.islnk()
                if not member.isfile():
                    continue
                path = unpacked.joinpath(*relative.parts[1:])
                assert path.is_file() and path.stat().st_size == member.size
                source = stream.extractfile(member)
                state = hashlib.sha256()
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    state.update(block)
                actual = pin(path)
                assert actual["sha256"] == state.hexdigest(), str(path)
                dependency_files.append(actual)
                verified += 1
        dependencies.append({"name": item["name"], "version": item["version"],
                             "archive": pin(archive), "regularFilesEqualArchive": verified})
    cargo = Path(old["commands"][0]["executable"])
    environment = dict(old["rustEnvironment"])
    environment["CARGO_HOME"] = str(Path(registry[0]["archive"]).parents[3])
    command = {"stage": "actual-native-json-rust-consumer", "executable": str(cargo),
        "argv": ["test", "--offline", "--locked", "--jobs", "1", "--manifest-path",
                 str(HERE / "rust-consumer/Cargo.toml"), "--target", "x86_64-pc-windows-gnu",
                 "--target-dir", str(DESTINATION / "target"), "--lib", "--", "--test-threads=1"],
        "cwd": str(HERE), "environment": environment, "expectedTests": 4}
    tests = ["tests::actual_module_json_is_accepted_at_all_prepared_boundaries",
             "tests::native_controls_cjk_and_raw_username_match_frozen_rust_rules",
             "tests::actual_restoration_and_owned_old_records_remain_distinct",
             "tests::frozen_consumer_rejects_invalid_utf8_size_and_identity"]
    files = [HERE / "rust-consumer/Cargo.toml", HERE / "rust-consumer/Cargo.lock",
             HERE / "rust-consumer/src/lib.rs", HERE / "module-build-id.txt",
             HERE / "module-verification.json", HERE / "execution/wasm-results/verification.json",
             HERE / "execution/snapshot-module-initial/terminal.json", old_path, base_path,
             HERE / "prepare-rust-plan.py", Path(base["guard"]["historicalHelper"]["path"]),
             Path(base["guard"]["currentWrapper"]["path"]), cargo,
             Path(environment["RUSTC"]), Path(environment["CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER"])]
    consumer = HERE.parent / "rust-snapshot-consumer"
    files.extend([consumer / "Cargo.toml", consumer / "Cargo.lock"])
    files.extend(sorted((consumer / "src").glob("*.rs")))
    files.extend(Path(item["path"]) for item in raw.values())
    inputs = [pin(path) for path in files]
    for item in raw.values():
        assert pin(item["path"]) == item
    result = {"schemaVersion": 1, "status": "source-prepared-four-native-byte-rust-tests-not-executed",
        "sourceCommit": module_proof["sourceCommit"], "moduleBuildIdentity": module_proof["moduleBuildIdentity"],
        "inputs": inputs, "actualNativeJsonPins": raw, "dependencyArchives": dependencies,
        "dependencyRegularFilePins": dependency_files, "registryPackages": 11,
        "expectedOrderedTests": sorted(tests), "commands": [command],
        "launchGate": base["launchGate"], "ownedResourceGuard": base["ownedResourceGuard"],
        "removeInheritedEnvironment": base["removeInheritedEnvironment"], "rustEnvironment": {},
        "guard": base["guard"], "browserPriorityGate": {"physicalGiB": 7, "exactCommitGiB": 9},
        "requiredOwner": "Pinned fixed presentation wrapper.load_guard/run_owned; no direct historical run_stage or parser CLI. Exact-byte one-stage adapter needs review before separate root launch reservation.",
        "cargoCachePolicy": "Allow ordinary Cargo-owned cache metadata/locks/last-use indexes/extraction markers. Do not freeze registry directory timestamps or metadata membership. Protect exact crate archives and every archive-verified regular source file; protect all game/consumer/fixture/manifest/lock content. Build outputs only in owned target/evidence; no network/new dependencies/config/security changes.",
        "lockPolicy": "Prepared lock graph equals the previously accepted frozen consumer graph plus one local root package; actual offline/locked acceptance remains pending",
        "resourceEvidence": {"previousGenuine19SnapshotTestsSeconds": 23.414,
                             "previousGenuine19SnapshotTestsPeakPrivateBytes": 296194048,
                             "newTargetResourcePeakUnmeasured": True},
        "nativeJsonSubstitutionAllowed": False, "cargoExecuted": False,
        "rustNativeFixtureConsumersExecuted": False, "WindowsGuardLoaded": False,
        "originalInputContextExecuted": False, "originalActionContextsLookupVerified": False,
        "commandOwnershipVerified": False, "liveEngineIntegrated": False, "wholeGameVerified": False}
    path = DESTINATION / "rust-consumer-plan.json"
    path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"plan": pin(path), "registryPackages": 11,
                      "archiveEqualRegularFiles": len(dependency_files), "nativeJsonPins": 9,
                      "preparedTests": 4, "cargoExecuted": False, "sourceInputs": len(inputs)}))


if __name__ == "__main__":
    main()
