"""Rebuild formatted Rust and reuse the recorded complete C/Lua objects.

Added 2026-10-02; NGPL. No source preparation, global SDK edits or publication.
Run under run-monitored.py to guard and measure this one owned build tree.
"""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
SDK = Path(r"C:\Users\kit\emsdk")
CARGO = Path(r"C:\Users\kit\.cargo\bin\cargo.exe")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bound_file(path, directory):
    path = Path(path).resolve(strict=True)
    if not path.is_relative_to(directory.resolve()) or not path.is_file():
        raise RuntimeError(f"Recorded build input outside owned directory: {path}")
    return path


def main():
    started = time.monotonic()
    manifest_path = BUILD / "engine-provenance.json"
    manifest = json.loads(manifest_path.read_text("utf-8"))
    command = manifest["link_command"]
    if command[:2] != [str(SDK / "python/3.13.3_64bit/python.exe"),
                       str(SDK / "upstream/emscripten/emcc.py")]:
        raise RuntimeError("Unexpected recorded compiler entrypoint")
    if command[-2:] != ["-o", str(BUILD / "nethack.js")]:
        raise RuntimeError("Unexpected recorded engine output")
    objects = [bound_file(p, ROOT / "work/objects") for p in command if p.endswith(".o")]
    if len(objects) != 173 or len(set(objects)) != 173:
        raise RuntimeError("The complete 173-unit engine object set is required")
    before_objects = {str(p.relative_to(ROOT)): sha(p) for p in objects}
    changes = json.loads((BUILD / "source-changes.json").read_text("utf-8"))
    for item in changes:
        path = bound_file(ROOT / "work/NetHack-5.0.0" / item["path"], ROOT / "work/NetHack-5.0.0")
        if sha(path) != item["sha256"]:
            raise RuntimeError(f"Compiled C source changed before Rust-only relink: {path}")
    library = bound_file(command[2], ROOT / "rust/target/wasm32-unknown-emscripten/release")
    if library.name != "libnethack_layers.a":
        raise RuntimeError("Unexpected Rust library")
    old_library = sha(library)
    old_artifacts = manifest["artifacts"]
    env = dict(os.environ)
    env.update({"EM_CONFIG": str(SDK / ".emscripten"), "EMSDK": str(SDK),
                "EMSDK_NODE": str(SDK / "node/24.19.0_64bit/node.exe"),
                "EM_CACHE": str(ROOT / "work/emscripten-cache"), "EMCC_CORES": "1",
                "BINARYEN_CORES": "1", "CARGO_BUILD_JOBS": "1",
                "CARGO_PROFILE_RELEASE_CODEGEN_UNITS": "1"})
    rust_command = [str(CARGO), "build", "--offline", "--locked", "--release", "--jobs", "1",
                    "--target", "wasm32-unknown-emscripten"]
    for argv, cwd, log in [(rust_command, ROOT / "rust", BUILD / "rust-final-release.log"),
                            (command, ROOT / "work/NetHack-5.0.0", BUILD / "link-final.log")]:
        with log.open("wb") as stream:
            result = subprocess.run(argv, cwd=cwd, env=env, stdout=stream, stderr=subprocess.STDOUT)
        output = log.read_text("utf-8", errors="replace")
        if result.returncode or "undefined symbol:" in output:
            print(output[-16000:], flush=True)
            raise RuntimeError(f"Final source-aligned build failed: {log.name}")
        print(f"Passed {log.name}", flush=True)
    if before_objects != {str(p.relative_to(ROOT)): sha(p) for p in objects}:
        raise RuntimeError("Cached C/Lua object bytes changed during Rust-only relink")
    artifacts = {p.name: {"bytes": p.stat().st_size, "sha256": sha(p)}
                 for p in [BUILD / "nethack.js", BUILD / "nethack.wasm"]}
    rust_sources = {str(p.relative_to(ROOT)): sha(p) for p in sorted((ROOT / "rust/src").glob("*.rs"))}
    refresh = {"recorded_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
               "duration_seconds": round(time.monotonic() - started, 3),
               "rust_command": rust_command, "link_command": command,
               "rust_source_sha256": rust_sources,
               "old_rust_library_sha256": old_library, "new_rust_library_sha256": sha(library),
               "preserved_c_lua_objects": before_objects, "old_artifacts": old_artifacts,
               "new_artifacts": artifacts, "compile_jobs": 1,
               "runtime_tested": False, "browser_japanese_gameplay_verified": False}
    manifest["rust_library"] = {"bytes": library.stat().st_size, "sha256": sha(library)}
    manifest["artifacts"] = artifacts
    manifest["rust_source_refresh"] = refresh
    for name in ["engine-provenance.json", "engine-manifest.json"]:
        (BUILD / name).write_text(json.dumps(manifest, indent=2) + "\n", "utf-8")
    (BUILD / "rust-final-link-verification.json").write_text(json.dumps(refresh, indent=2) + "\n", "utf-8")
    destination = ROOT / "web/engine"
    destination.mkdir(parents=True, exist_ok=True)
    for name, info in artifacts.items():
        shutil.copyfile(BUILD / name, destination / name)
        if sha(destination / name) != info["sha256"]:
            raise RuntimeError(f"Runtime copy differs: {name}")
    shutil.copyfile(ROOT / "locales/gameplay-core.json", ROOT / "web/gameplay-core.json")
    if sha(ROOT / "web/gameplay-core.json") != sha(ROOT / "locales/gameplay-core.json"):
        raise RuntimeError("Runtime gameplay catalog copy differs")
    print(json.dumps(artifacts, indent=2), flush=True)


if __name__ == "__main__":
    main()
