"""Stage this project in an isolated Sites checkout; never use the shared Git root."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
CHECKOUT = ROOT / ".sites-runtime" / "checkout"


def main() -> None:
    hosting = ROOT / ".openai" / "hosting.json"
    manifest = json.loads(hosting.read_text(encoding="utf-8"))
    if manifest.get("project_id") != "appgprj_6abfc04613288191bcff5933224000fb":
        raise SystemExit("unexpected Site identity; do not substitute another project")
    manifest["static"] = {"directory": "out"}
    temporary = hosting.with_suffix(".tmp")
    temporary.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    temporary.replace(hosting)
    CHECKOUT.mkdir(parents=True, exist_ok=True)
    files = []
    for source in sorted(ROOT.rglob("*")):
        relative = source.relative_to(ROOT)
        if not source.is_file() or source.is_symlink():
            continue
        if any(part in ("work", "target", ".git", ".sites-runtime", "archives", "node_modules", "__pycache__") for part in relative.parts):
            continue
        if relative.parts[:2] in (("tests", "results"), ("build", "native"), ("build", "em-cache"), ("build", "logs"), ("build", "source-check")):
            continue
        if source.name == ".codex-nethack-delivery.json" or (source.suffix.lower() in (".wav", ".uu", ".o", ".obj", ".exe", ".a", ".lib", ".log") and source.name != "Makefile.lib"):
            continue
        destination = CHECKOUT / relative
        if destination.is_symlink():
            raise SystemExit("unexpected symlink in isolated Site checkout")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        with destination.open("rb") as stream:
            sha = hashlib.file_digest(stream, "sha256").hexdigest()
        files.append({"path": relative.as_posix(), "sha256": sha})
    # The official static packager accepts out/dist/build roots, not web.
    # Keep the tested source directory and stage identical publication bytes.
    for source in sorted((ROOT / "web").rglob("*")):
        if not source.is_file() or source.is_symlink():
            continue
        relative = source.relative_to(ROOT / "web")
        destination = CHECKOUT / "out" / relative
        if destination.is_symlink():
            raise SystemExit("unexpected symlink in static Site output")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        with source.open("rb") as stream:
            source_sha = hashlib.file_digest(stream, "sha256").hexdigest()
        with destination.open("rb") as stream:
            output_sha = hashlib.file_digest(stream, "sha256").hexdigest()
        if source_sha != output_sha:
            raise SystemExit(f"static Site output byte mismatch: {relative}")
    print(json.dumps({"result": "pass", "checkout": str(CHECKOUT), "files": len(files), "static_directory": "out", "static_bytes_match_tested_web": True, "scope": "isolated nethack/.sites-runtime/checkout; shared repository Git untouched"}))


if __name__ == "__main__":
    main()
