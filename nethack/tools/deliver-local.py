"""Copy only this owned project to the user's named nethack directory.

New integration script, 2026-10-02, NGPL. No deletes or Git operations.
Previously copied files changed by somebody else are never overwritten.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = Path(r"C:\Users\kit\gameme\jnethack\jrouge")
TARGET = REPOSITORY / "nethack"


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if TARGET.resolve().parent != REPOSITORY.resolve() or TARGET.name != "nethack":
        raise SystemExit("target is outside the explicitly owned nethack directory")
    marker = TARGET / ".codex-nethack-delivery.json"
    old: dict[str, str] = {}
    if TARGET.exists():
        if not marker.is_file():
            raise SystemExit("existing target lacks this task's delivery ownership marker")
        document = json.loads(marker.read_text(encoding="utf-8"))
        if document.get("source_commit") != "16ff59115315917b93185d026aeefea06db9b0f4":
            raise SystemExit("target is owned by a different source delivery")
        old = document["files"]
    selected = []
    for source in sorted(ROOT.rglob("*")):
        relative = source.relative_to(ROOT)
        if not source.is_file() or source.is_symlink():
            continue
        if any(x in relative.parts for x in ("work", "target", ".git", ".sites-runtime", "node_modules", "__pycache__", "browser-profiles")):
            continue
        if relative.parts[:2] in (("build", "em-cache"), ("build", "native"), ("build", "source-check")):
            continue
        if source.name.lower().endswith(".save.json"):
            continue
        if source.suffix.lower() in (".o", ".obj", ".exe", ".dll", ".a", ".lib", ".wav", ".uu", ".save", ".sav") and source.name != "Makefile.lib":
            continue
        name = relative.as_posix()
        sha = digest(source)
        destination = TARGET / relative
        if destination.is_symlink():
            raise SystemExit(f"unexpected destination symlink: {name}")
        if destination.exists():
            current = digest(destination)
            if current != sha and old.get(name) != current:
                raise SystemExit(f"destination was independently edited; preserve it: {name}")
        selected.append((source, destination, name, sha))
    if args.dry_run:
        print(json.dumps({"result": "ready", "target": str(TARGET), "files": len(selected)}))
        return
    TARGET.mkdir(parents=True, exist_ok=True)
    for source, destination, name, sha in selected:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or digest(destination) != sha:
            shutil.copyfile(source, destination)
        if digest(destination) != sha:
            raise SystemExit(f"copy verification failed: {name}")
    hashes = dict(old)
    hashes.update({name: sha for _, _, name, sha in selected})
    temporary = marker.with_suffix(".tmp")
    temporary.write_text(json.dumps({"source_commit": "16ff59115315917b93185d026aeefea06db9b0f4", "source_workspace": str(ROOT), "files": hashes}, indent=2) + "\n", encoding="utf-8")
    temporary.replace(marker)
    print(json.dumps({"result": "pass", "target": str(TARGET), "files_verified": len(selected), "scope": "nethack only; no deletes or Git mutations"}))


if __name__ == "__main__":
    main()
