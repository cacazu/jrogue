"""Package complete corresponding source for the built browser engine.

New integration script, 2026-10-02; distributed under the NGPL (see notices).
Unused source sound samples are excluded from distribution, with notices kept.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "web" / "downloads" / "corresponding-source.tar.gz")
    parser.add_argument("--engine-source", type=Path, default=ROOT / "work" / "NetHack-5.0.0")
    parser.add_argument("--rust-root", type=Path, default=ROOT / "rust",
                        help="Tested Rust source tree; may be an isolated copied crate")
    parser.add_argument("--engine-manifest", type=Path, default=ROOT / "build" / "engine-manifest.json")
    parser.add_argument("--source-changes", type=Path, default=ROOT / "build" / "source-changes.json")
    parser.add_argument("--adapter-patch", type=Path, default=ROOT / "build" / "upstream-adapter.patch")
    parser.add_argument("--web-root", type=Path, default=ROOT / "web")
    parser.add_argument("--verification", type=Path, default=ROOT / "verification.json")
    parser.add_argument("--stage-evidence", type=Path, action="append", default=[],
                        help="Repeat for isolated build evidence directories; no profiles, binaries or save data")
    parser.add_argument("--rebuild-input", type=Path, action="append", default=[],
                        help="Additional pinned source foundation needed by the selected generator")
    args = parser.parse_args()
    for option in (args.engine_source, args.rust_root, args.engine_manifest, args.source_changes,
                   args.adapter_patch, args.web_root, args.verification):
        if not option.resolve().is_relative_to(ROOT.resolve()):
            raise SystemExit(f"source selection escaped this owned nethack project: {option}")
    modified = args.engine_source.resolve()
    lua = modified / "lib" / "lua-5.4.8"
    if not modified.exists() or not lua.exists():
        raise SystemExit("build the real engine first; modified source and pinned Lua are required")
    required = [ROOT / "provenance.json", args.engine_manifest, args.source_changes,
                args.adapter_patch, args.rust_root / "Cargo.lock", args.verification]
    if not all(x.is_file() for x in required):
        raise SystemExit("source provenance, actual engine manifest and locked Rust dependencies are required")
    members: list[tuple[Path, str]] = []
    for directory in ("tools", "docs", "rust", "web", "catalog", "locales", "licenses", "tests"):
        selected_tree = (args.web_root.resolve() if directory == "web" else
                         args.rust_root.resolve() if directory == "rust" else ROOT / directory)
        for p in sorted(selected_tree.rglob("*")):
            if not p.is_file() or any(x in p.parts for x in ("target", "downloads", "node_modules", ".sites-runtime", "results", "__pycache__")):
                continue
            if p.suffix.lower() in (".wasm", ".data", ".save", ".sav") or p.name.lower().endswith(".save.json"):
                continue
            members.append((p, "nethack/" + directory + "/" + p.relative_to(selected_tree).as_posix()))
    for tree, archive_prefix in ((ROOT / "upstream" / "NetHack-5.0.0", "nethack/upstream/NetHack-5.0.0/"), (modified, "nethack/engine-source/")):
        for p in sorted(tree.rglob("*")):
            if not p.is_file() or "obj" in p.parts or "native" in p.parts:
                continue
            if p.suffix.lower() in (".save", ".sav") or p.name.lower().endswith(".save.json"):
                continue
            if p.suffix.lower() in (".wav", ".uu", ".o", ".obj", ".exe", ".dll", ".a", ".lib") and p.name != "Makefile.lib":
                continue
            members.append((p, archive_prefix + p.relative_to(tree).as_posix()))
    for filename in ("README.md", "THIRD-PARTY-NOTICES.md", "provenance.json", ".gitignore"):
        p = ROOT / filename
        if p.is_file():
            members.append((p, "nethack/" + filename))
    for p in sorted((ROOT / "build").glob("*.json")):
        if p.name.lower().endswith(".save.json"):
            continue
        if p.name in ("source-check-report.json", "engine-manifest.json", "source-changes.json"):
            continue
        members.append((p, "nethack/build/" + p.name))
    for p in sorted((ROOT / "build").glob("*.patch")):
        if p.name == "upstream-adapter.patch":
            continue
        members.append((p, "nethack/build/" + p.name))
    # Include selected actual test transcripts, without browser profiles/storage.
    for name in ("rust-phase3-final-test.log", "rust-phase3-clippy.log", "rust-final-release.log", "link-final.log"):
        p = ROOT / "build" / name
        if p.is_file():
            members.append((p, "nethack/build/" + name))
    for selected_evidence in args.stage_evidence:
        evidence = selected_evidence.resolve()
        if not evidence.is_relative_to((ROOT / "build").resolve()):
            raise SystemExit("isolated evidence must stay inside this project's build directory")
        for p in sorted(evidence.rglob("*")):
            if not p.is_file() or any(part in ("web", "browser-profiles", "screenshots", "target", "__pycache__", "node_modules") for part in p.relative_to(evidence).parts):
                continue
            captured_probe_source = (p.parent == ROOT / "build/data-consumer-qa/phase6"
                                     and p.name in ("original-consumer.c", "target-dlb-preprocessed.c"))
            if p.suffix.lower() in (".save", ".sav") or p.name.lower().endswith(".save.json"):
                continue
            if p.suffix.lower() not in (".json", ".patch", ".log") and not captured_probe_source:
                continue
            members.append((p, "nethack/build/" + p.relative_to(ROOT / "build").as_posix()))
    for supplied in args.rebuild_input:
        foundation = supplied.resolve(strict=True)
        if not foundation.is_dir() or not foundation.is_relative_to((ROOT / "work").resolve()):
            raise SystemExit("rebuild foundations must be directories inside this project's work tree")
        for p in sorted(foundation.rglob("*")):
            if not p.is_file() or any(part in ("obj", "native", "__pycache__", "browser-profiles", "node_modules")
                                      for part in p.relative_to(foundation).parts):
                continue
            if p.name.lower().endswith(".save.json"):
                continue
            if p.suffix.lower() in (".wav", ".uu", ".o", ".obj", ".exe", ".dll", ".a", ".lib", ".wasm", ".save", ".sav") and p.name != "Makefile.lib":
                continue
            members.append((p, "nethack/" + p.relative_to(ROOT).as_posix()))
    members.append((args.engine_manifest, "nethack/build/engine-manifest.json"))
    members.append((args.source_changes, "nethack/build/source-changes.json"))
    members.append((args.adapter_patch, "nethack/build/upstream-adapter.patch"))
    members.append((args.verification, "nethack/verification.json"))
    # Each virtual source path names exactly one selected artifact.
    if len({name for _, name in members}) != len(members):
        raise SystemExit("duplicate corresponding-source archive paths")
    # Bind the exact selected bytes, including source-only work. Concurrent edits
    # make this attempt fail instead of publishing a mixed source snapshot.
    snapshot_name = "nethack/build/packaged-input-manifest.json"
    if any(name == snapshot_name for _, name in members):
        raise SystemExit("reserved packaged source snapshot path")
    snapshot = {name: {"bytes": p.stat().st_size, "sha256": digest(p)}
                for p, name in members}
    snapshot_bytes = (json.dumps({"schema_version": 1, "files": snapshot},
                                sort_keys=True, indent=2) + "\n").encode("utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=args.output.name + ".", suffix=".partial", dir=args.output.parent)
    # mkstemp owns an open descriptor; tarfile opens the same path separately.
    os.close(fd)
    temporary = Path(temporary_name)
    try:
        with tarfile.open(temporary, "w:gz") as archive:
            for p, name in members:
                info = archive.gettarinfo(str(p), arcname=name)
                info.uid = info.gid = 0
                info.uname = info.gname = ""
                with p.open("rb") as stream:
                    archive.addfile(info, stream)
            info = tarfile.TarInfo(snapshot_name)
            info.size = len(snapshot_bytes)
            info.mode = 0o644
            archive.addfile(info, io.BytesIO(snapshot_bytes))
        with tarfile.open(temporary, "r|gz") as archive:
            names = set()
            for member in archive:
                names.add(member.name)
                if member.name == snapshot_name:
                    continue
                expected = snapshot[member.name]
                with archive.extractfile(member) as stream:
                    actual_digest = hashlib.file_digest(stream, "sha256").hexdigest()
                if member.size != expected["bytes"] or actual_digest != expected["sha256"]:
                    raise SystemExit(f"source changed while packaging: {member.name}")
            for expected in ("nethack/upstream/NetHack-5.0.0/dat/license", "nethack/engine-source/dat/license", "nethack/engine-source/lib/lua-5.4.8/src/lua.h", "nethack/rust/Cargo.lock", "nethack/tools/build-upstream.py"):
                if expected not in names:
                    raise SystemExit(f"missing required corresponding source: {expected}")
        for p, name in members:
            expected = snapshot[name]
            if p.stat().st_size != expected["bytes"] or digest(p) != expected["sha256"]:
                raise SystemExit(f"source changed before package commit: {name}")
        temporary.replace(args.output)
    finally:
        if temporary.exists():
            temporary.unlink()
    with args.output.open("rb") as stream:
        archive_digest = hashlib.file_digest(stream, "sha256").hexdigest()
    print(json.dumps({"result": "pass", "file": str(args.output), "files": len(members) + 1, "bytes": args.output.stat().st_size, "sha256": archive_digest, "excluded": "unused sound recordings and compiled build tools"}))


if __name__ == "__main__":
    main()
