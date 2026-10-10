"""Bind actual selected Phase6 Cargo evidence; never invoke a compiler/runtime."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def path(value: str | Path) -> Path:
    value = Path(value)
    return value.resolve() if value.is_absolute() else (ROOT / value).resolve()


def command_path(value: str, cwd: str) -> Path:
    value = Path(value)
    return value.resolve() if value.is_absolute() else (path(cwd) / value).resolve()


def leaf(file: Path, base: Path) -> dict:
    if file.is_symlink() or not file.resolve().is_relative_to(base.resolve()):
        raise ValueError("source leaf escapes selected root")
    return {"path": file.relative_to(base).as_posix(), "bytes": file.stat().st_size, "sha256": sha(file)}


def source_files(crate: Path) -> list[dict]:
    files = [crate / "Cargo.toml", crate / "Cargo.lock", crate / ".cargo/config.toml"]
    files += sorted((crate / "src").glob("*.rs")) + sorted((crate / "tests").glob("*.rs"))
    return [leaf(file, crate) for file in files]


def includes(crate: Path) -> dict[Path, list[str]]:
    result = {}
    for source in sorted((crate / "src").glob("*.rs")) + sorted((crate / "tests").glob("*.rs")):
        for match in re.finditer(r'include_(?:bytes|str)!\s*\(\s*"([^"\n]+)"\s*\)', source.read_text(encoding="utf-8")):
            target = (source.parent / match.group(1)).resolve()
            if not target.is_file():
                raise ValueError("missing compile-time fixture: " + str(target))
            result.setdefault(target, []).append(source.relative_to(crate).as_posix())
    return result


def approved_fixtures(crate: Path, manifest: Path) -> list[dict]:
    raw = json.loads(manifest.read_text(encoding="utf-8"))
    declared = {}
    for row in raw["fixtures"]:
        target = path(row["project_path"])
        if target in declared or not re.fullmatch(r"[a-f0-9]{64}", row["sha256"]):
            raise ValueError("duplicate/invalid approved fixture")
        declared[target] = row
    result = []
    for target, users in includes(crate).items():
        if target not in declared:
            raise ValueError("unknown compile-time fixture: " + str(target))
        row = declared[target]
        if sha(target) != row["sha256"]:
            raise ValueError("compile-time fixture changed: " + str(target))
        result.append({"project_path": row["project_path"], "source_package_path": row["source_package_path"],
            "sha256": row["sha256"], "included_by": sorted(set(users)), "role": row["role"]})
    if not any(row["sha256"] == "c79fe2a3e4b74811bf83c28e6defb63d44b25fb9a610b1931f055b88d11337d4" and
               row["source_package_path"] == "nethack/locales/gameplay-core.json" for row in result):
        raise ValueError("the original canonical compile-time fixture is absent")
    return sorted(result, key=lambda row: row["source_package_path"])


def snapshot(crate: Path, fixtures: Path, header: Path, host: Path) -> dict:
    provenance = [leaf(header, ROOT), leaf(host, ROOT)]
    return {"schema_version": 1, "status": "selected_phase6_rust_source_checkpoint",
        "phase": 6, "recorded_at_utc": datetime.now(timezone.utc).isoformat(),
        "crateRoot": crate.relative_to(ROOT).as_posix(), "sourcePackageAlias": "nethack/rust",
        "sourceFiles": source_files(crate), "projectProvenance": provenance,
        "approvedFixtureManifest": leaf(fixtures, ROOT), "tested_fixtureSha256": approved_fixtures(crate, fixtures),
        "compiler_executed_by_recorder": False, "actual_tests_claimed_by_checkpoint": False}


def verify_checkpoint(crate: Path, checkpoint: dict, fixtures: Path, header: Path, host: Path) -> None:
    current = snapshot(crate, fixtures, header, host)
    for key in ["crateRoot", "sourcePackageAlias", "sourceFiles", "projectProvenance", "approvedFixtureManifest", "tested_fixtureSha256"]:
        if checkpoint.get(key) != current[key]:
            raise ValueError("selected source differs from checkpoint: " + key)


def validate_native_log(log: str, expected: int) -> list[int]:
    if expected <= 0 or "test result: FAILED" in log or re.search(r"(?m)^error(?:\[|:)", log):
        raise ValueError("native tests failed or expected count invalid")
    marker = re.compile(r"(?m)^running (\d+) tests?\s*$|^test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out; finished in [0-9.]+s\s*$")
    pending, groups = None, []
    for match in marker.finditer(log):
        if match.group(1) is not None:
            if pending is not None:
                raise ValueError("truncated native test group")
            pending = int(match.group(1))
        else:
            counts = [int(match.group(index)) for index in range(2, 7)]
            if pending is None or counts[0] != pending or any(counts[1:]):
                raise ValueError("native group count/result mismatch")
            groups.append(counts[0])
            pending = None
    if pending is not None or not groups or sum(groups) != expected:
        raise ValueError("native log does not prove every expected test passed")
    return groups


def evidence(kind: str, resource_path: Path, log_path: Path, crate: Path, expected: int) -> dict:
    resource = json.loads(resource_path.read_text(encoding="utf-8"))
    log = log_path.read_text(encoding="utf-8")
    command = resource.get("command")
    if type(resource.get("exit_code")) is not int or resource["exit_code"] != 0 or not isinstance(command, list) or not all(isinstance(arg, str) for arg in command):
        raise ValueError(kind + " resource is not a completed successful command")
    subcommand = {"native": "test", "clippy": "clippy", "fmt": "fmt", "release": "build"}[kind]
    if len(command) < 2 or Path(command[0]).name.lower() not in ["cargo", "cargo.exe"] or command[1] != subcommand or "--manifest-path" not in command:
        raise ValueError(kind + " resource command does not identify selected Cargo operation")
    position = command.index("--manifest-path")
    cwd = resource.get("cwd")
    if not isinstance(cwd, str) or not cwd or position + 1 >= len(command) or command_path(command[position + 1], cwd) != crate / "Cargo.toml":
        raise ValueError(kind + " command targets another crate")
    if re.search(r"(?m)^error(?:\[|:)", log):
        raise ValueError(kind + " log contains compiler/formatter error")
    groups = None
    if kind == "native":
        if not all(flag in command for flag in ["--offline", "--locked", "--lib", "--tests"]):
            raise ValueError("native command omitted exact offline/lib/test scope")
        groups = validate_native_log(log, expected)
    elif kind == "fmt":
        if "--check" not in command:
            raise ValueError("format evidence must be a successful explicit --check")
    elif kind == "clippy":
        if "--all-targets" not in command or not any(command[index:index + 2] == ["-D", "warnings"] for index in range(len(command) - 1)):
            raise ValueError("clippy evidence is not strict all-targets validation")
        if not re.search(r"Finished .+ profile", log):
            raise ValueError("clippy completion log is missing/truncated")
    elif kind == "release":
        if "--release" not in command or "--target" not in command or command[command.index("--target") + 1] != "wasm32-unknown-emscripten":
            raise ValueError("release command does not prove the selected Wasm target")
        if not re.search(r"Finished .?release.? profile", log):
            raise ValueError("release completion log is missing/truncated")
    for key in ["recorded_at_utc", "duration_seconds", "kernel_accounted_job_peak_commit_bytes", "sampled_process_tree_peak_working_set_bytes"]:
        if key not in resource:
            raise ValueError(kind + " resource report omits " + key)
    return {"status": "passed", "command": command, "cwd": cwd, "resourcePath": resource_path.relative_to(ROOT).as_posix(),
        "resourceSha256": sha(resource_path), "logPath": log_path.relative_to(ROOT).as_posix(),
        "logSha256": sha(log_path), "recorded_at_utc": resource["recorded_at_utc"],
        "duration_seconds": resource["duration_seconds"],
        "kernel_accounted_job_peak_commit_bytes": resource["kernel_accounted_job_peak_commit_bytes"],
        "sampled_process_tree_peak_working_set_bytes": resource["sampled_process_tree_peak_working_set_bytes"],
        "testGroups": groups}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--crate-root", default=str(HERE / "rust-copy"))
    parser.add_argument("--fixture-manifest", default=str(HERE / "approved-fixtures.json"))
    parser.add_argument("--header", default=str(HERE / "registered-catalog.h"))
    parser.add_argument("--host-provenance", default=str(HERE / "host-preparation.json"))
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--snapshot", action="store_true", help="Only snapshot current selected sources; claim no executed checks")
    parser.add_argument("--expected-tests", type=int, default=67)
    parser.add_argument("--output")
    parser.add_argument("--rust-lib")
    for kind in ["native", "clippy", "fmt", "release"]:
        parser.add_argument("--" + kind + "-resource")
        parser.add_argument("--" + kind + "-log")
    args = parser.parse_args()
    crate, fixture_manifest, header, host = map(path, [args.crate_root, args.fixture_manifest, args.header, args.host_provenance])
    checkpoint_path = path(args.checkpoint)
    if args.snapshot:
        result = snapshot(crate, fixture_manifest, header, host)
        checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        checkpoint_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"status": result["status"], "actual_tests_claimed": False, "checkpoint_sha256": sha(checkpoint_path)}))
        return
    required = [args.output, args.rust_lib] + [getattr(args, kind + suffix) for kind in ["native", "clippy", "fmt", "release"] for suffix in ["_resource", "_log"]]
    if any(value is None for value in required):
        parser.error("actual proof requires all four operation resource/log pairs, output, and rust-lib")
    checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8"))
    verify_checkpoint(crate, checkpoint, fixture_manifest, header, host)
    checked = {kind: evidence(kind, path(getattr(args, kind + "_resource")), path(getattr(args, kind + "_log")), crate, args.expected_tests)
        for kind in ["native", "clippy", "fmt", "release"]}
    library = path(args.rust_lib)
    release_command = checked["release"]["command"]
    if "--target-dir" not in release_command or release_command.index("--target-dir") + 1 >= len(release_command):
        raise ValueError("release evidence must identify its isolated target directory")
    target_directory = command_path(release_command[release_command.index("--target-dir") + 1], checked["release"]["cwd"])
    expected_library = target_directory / "wasm32-unknown-emscripten/release/libnethack_layers.a"
    if library != expected_library.resolve():
        raise ValueError("selected Rust library differs from the proved release target")
    if library.stat().st_size <= 8:
        raise ValueError("selected Rust static library contains no archive members")
    with library.open("rb") as stream:
        if stream.read(8) != b"!<arch>\n":
            raise ValueError("selected Rust static library is not a nonempty ar archive")
    result = {"schema_version": 1, "status": "native_rust_phase6_tests_passed", "phase": 6,
        "tests_passed": args.expected_tests, "failed": 0, "ignored": 0, "filtered_out": 0,
        "source_checkpoint_sha256": sha(checkpoint_path), "sourceFiles": checkpoint["sourceFiles"],
        "sourcePackageAlias": "nethack/rust", "selectedRustRoot": crate.relative_to(ROOT).as_posix(),
        "projectProvenance": checkpoint["projectProvenance"], "tested_fixtureSha256": checkpoint["tested_fixtureSha256"],
        "fixture_manifest_sha256": sha(fixture_manifest), "validation": checked,
        "rustLibrary": leaf(library, ROOT), "recorderSha256": sha(Path(__file__)),
        "full_engine_linkage_verified": False, "native_c_semantic_association_verified": False,
        "browser_japanese_gameplay_verified": False, "speedup_claimed": False,
        "qualification": "Actual selected-crate tests/fmt/strict Clippy/Wasm staticlib evidence only; engine/browser fidelity and same100-history benchmark are separate."}
    output = path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "tests_passed": result["tests_passed"], "proof_sha256": sha(output)}))


if __name__ == "__main__":
    main()
