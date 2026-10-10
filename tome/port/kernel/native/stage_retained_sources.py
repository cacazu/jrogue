"""Stage a manifest-selected local checkpoint; never copy original asset archives.

Preparation is import-safe. Only main() writes the owned tome-port staging tree.
The parent runs this after its measured jobs have finished, followed by
stage_current_checkpoint.py. This script does not launch tools or edit upstream.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path, PurePosixPath, PureWindowsPath
import hashlib
import json
import os
import shutil

WORK = Path(__file__).resolve().parent.parent
PORT = WORK / "tome-port"
TOME = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome")
UPSTREAM = TOME / "upstream"
SOURCE_COMMIT = "624a67329fe2ad440c5b344785a9c73fcf22ae63"
ALLOWED_EXTENSIONS = {
    ".c", ".h", ".inc", ".py", ".ps1", ".sh", ".mjs", ".cjs", ".js",
    ".html", ".css", ".lua", ".rs", ".toml", ".lock", ".json", ".md",
    ".txt", ".patch",
}
EXCLUDED_DIRECTORIES = {
    "target", "source", "syntax-build", "lua-map", "full-build", "objects",
    "__pycache__", ".git", ".codex", ".agents", ".aws", "node_modules",
    "gaussian-test", "named-rng-test", "browser-build", "build", "dist",
    "logs", "validation", "semantic-validation", "runtime", "artifacts",
    "artifact", "node-runtime-home", "browser-probe", "original-browser-probe",
    "original-browser-scenario", "graphics-browser-probe", "retained-browser-probe",
    "semantic-browser-probe", "full-save-probe", "ui-roundtrip-probe",
    "japanese-save-resume-probe", "play-mobile-probe", "shared-local-probe", "inventory-output",
}
# Generated C/Lua adapters and reviewed JSON catalogs are usable source, and
# intentionally remain included. Generated objects, archives and runtime homes
# are excluded by directories/extensions instead of excluding all "generated".
SOURCE_GROUPS = {
    "build-plan-work": "kernel/build-plan",
    "kernel-bindings-work": "kernel/bindings",
    "bootstrap-work": "kernel/bootstrap",
    "native-core-work": "kernel/native",
    "rust-kernel-adapter-work": "retained",
    "localization-kernel-work": "localization",
    "localization-c-output-work": "localization/native-output",
    "localization-wasm-work": "localization/wasm",
    "localization-review-work": "localization/review",
    "localization-native-plan-work": "localization/native-plan",
    "unknown-runtime-audit-work": "localization/runtime-audit",
    "save-resume-work": "kernel/save",
    "serial-platform-work": "kernel/serial",
    "particle-platform-work": "kernel/particles",
    "mechanics-audit-work": "kernel/mechanics",
}
DISTRIBUTIONS = {
    "native-core-work/browser-build/tome-native.mjs": "dist/native/tome-native.mjs",
    "native-core-work/browser-build/tome-native.wasm": "dist/native/tome-native.wasm",
    "rust-kernel-adapter-work/target/wasm32-unknown-unknown/release/tome_core_environment.wasm": "dist/retained/tome_core_environment.wasm",
    "localization-wasm-work/target/wasm32-unknown-unknown/release/tome_text_wasm.wasm": "dist/semantic/tome_text_wasm.wasm",
}
# Evidence is curated explicitly. Character/save archives and the several
# hundred MB original .team/.teae/.tar.bz2 assets never enter this selection.
EVIDENCE = {
    "kernel-bindings-work/gaussian-test/results.json": "kernel/evidence/compound-rng/results.json",
    "kernel-bindings-work/gaussian-test/execute-test.log": "kernel/evidence/compound-rng/execute-test.log",
    "native-core-work/browser-build/link-result.json": "kernel/evidence/native-link/result.json",
    "native-core-work/named-rng-test/results.json": "kernel/evidence/named-rng/results.json",
    "native-core-work/full-build-results.json": "kernel/evidence/native-build/results.json",
    "native-core-work/shared-cli-launch-evidence.json": "kernel/evidence/shared-local-probe/cli-launch-evidence.json",
    "native-core-work/original-browser-probe/evidence.json": "kernel/evidence/original-browser-birth/evidence.json",
    "native-core-work/original-browser-probe/desktop.png": "kernel/evidence/original-browser-birth/desktop.png",
    "native-core-work/graphics-browser-probe/evidence.json": "kernel/evidence/graphics-browser/evidence.json",
    "native-core-work/graphics-browser-probe/desktop.png": "kernel/evidence/graphics-browser/desktop.png",
    "rust-kernel-adapter-work/validation/results.json": "kernel/evidence/retained-rust/results.json",
    "native-core-work/semantic-validation/results.json": "kernel/evidence/semantic-validation/results.json",
}
for _group in ("original-browser-scenario", "retained-browser-probe", "semantic-browser-probe"):
    for _name in ("evidence.json", "scenario-evidence.json", "desktop.png", "mobile-scenario.png",
                  "rust-desktop.png", "rust-mobile.png", "semantic-desktop.png", "semantic-mobile.png"):
        EVIDENCE[f"native-core-work/{_group}/{_name}"] = f"kernel/evidence/{_group}/{_name}"
for _name in (
    "browser-link", "compound-rng", "named-rng", "original-browser", "original-scenario",
    "graphics-browser", "retained-browser", "retained-rust", "semantic-browser",
    "semantic-native-link", "semantic-validation", "save-link", "full-save", "ui-roundtrip",
    "japanese-save-resume", "play-mobile", "shared-local",
):
    EVIDENCE[f"native-core-work/{_name}-resource.json"] = f"kernel/evidence/resources/{_name}.json"
for _group, _names in {
    "full-save-probe": ("evidence.json", "full-save-resume-evidence.json", "full-save-resume.png"),
    "ui-roundtrip-probe": ("evidence.json", "ui-roundtrip-evidence.json", "ui-original-desktop.png", "ui-original-mobile.png"),
    "japanese-save-resume-probe": ("evidence.json", "japanese-save-resume-evidence.json",
                                   "desktop.png", "japanese-save-resume.png"),
    "play-mobile-probe": ("evidence.json", "play-mobile-evidence.json", "play-desktop.png", "play-mobile.png"),
    "shared-local-probe": ("evidence.json", "play-mobile-evidence.json", "play-desktop.png", "play-mobile.png"),
}.items():
    for _name in _names:
        EVIDENCE[f"native-core-work/{_group}/{_name}"] = f"kernel/evidence/{_group}/{_name}"
for _name in ("rust-tests.log", "rust-clippy.log", "wasm-build.log", "wasm-mailbox.log",
              "native-host-contract.log", "browser-session-contract.log"):
    EVIDENCE[f"rust-kernel-adapter-work/validation/{_name}"] = f"kernel/evidence/retained-rust/{_name}"


def digest_file(file: Path) -> str:
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        for block in iter(lambda: stream.read(128 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def checked_relative(value: str) -> Path:
    if not isinstance(value, str):
        raise ValueError("Checkpoint relative paths must be strings")
    pure = PurePosixPath(value)
    if ("\\" in value or PureWindowsPath(value).drive
            or pure.is_absolute() or ".." in pure.parts or not pure.parts):
        raise ValueError(f"Unexpected checkpoint relative path: {value}")
    return Path(*pure.parts)


def write_json(file: Path, value) -> None:
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_name(file.name + ".staging.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(file)


def source_files(directory: Path):
    if not directory.is_dir():
        raise FileNotFoundError(f"Required authored source directory absent: {directory}")
    for current, directories, files in os.walk(directory, topdown=True, followlinks=False):
        directories[:] = sorted(name for name in directories if name not in EXCLUDED_DIRECTORIES
                                and not (Path(current) / name).is_symlink())
        for name in sorted(files):
            file = Path(current) / name
            if file.is_symlink():
                raise ValueError(f"Checkpoint source symlink is not accepted: {file}")
            if file.suffix.lower() not in ALLOWED_EXTENSIONS and name != "LICENSE" and not name.endswith("COPYRIGHT"):
                continue
            if file.name.endswith(".staging.tmp"):
                continue
            if file.relative_to(WORK).as_posix() in EVIDENCE:
                continue  # Curated once below, rather than treating reports as authored source.
            if not file.resolve().is_relative_to(directory.resolve()):
                raise ValueError(f"Source escaped its selected directory: {file}")
            yield file


def prefix_tail(value: str, prefix: Path):
    normalized = value.replace("\\", "/")
    base = prefix.as_posix().rstrip("/")
    if normalized.casefold() == base.casefold():
        return ""
    if normalized.casefold().startswith(base.casefold() + "/"):
        tail = normalized[len(base) + 1:]
        if ".." in PurePosixPath(tail).parts:
            raise ValueError("Operational manifest path contains traversal")
        return tail
    return None


def rebase_vfs_path(value: str, manifest_folder: Path) -> str:
    tail = prefix_tail(value, UPSTREAM)
    if tail is not None:
        original = UPSTREAM / checked_relative(tail) if tail else UPSTREAM
        return Path(os.path.relpath(original, TOME / "port" / manifest_folder)).as_posix()
    for source, destination in SOURCE_GROUPS.items():
        tail = prefix_tail(value, WORK / source)
        if tail is not None:
            mapped = PORT / destination / checked_relative(tail) if tail else PORT / destination
            return Path(os.path.relpath(mapped, PORT / manifest_folder)).as_posix()
    # Absolute unrecognized paths are rejected instead of exposing arbitrary
    # local directories through the original read-only range server.
    raise ValueError(f"VFS input must have an explicit reviewed source mapping: {value}")


def transformed_bytes(file: Path, relative: Path):
    if relative.as_posix() in {
        "kernel/bootstrap/browser-vfs-inputs.json",
        "kernel/bootstrap/ui-browser-vfs-inputs.json",
        "kernel/save/browser-vfs-inputs.json",
    }:
        document = json.loads(file.read_text(encoding="utf-8"))
        changed = []
        for index, entry in enumerate(document.get("inputs", [])):
            entry["physical"] = rebase_vfs_path(entry["physical"], relative.parent)
            changed.append(f"inputs[{index}].physical")
        overlay = document.get("build_overlay")
        if overlay:
            for key in ("original", "staged"):
                overlay[key] = rebase_vfs_path(overlay[key], relative.parent)
                changed.append("build_overlay." + key)
        document["checkpoint_path_layout"] = relative.parent.as_posix() + " with own relative source/upstream paths; local only"
        return (json.dumps(document, ensure_ascii=False, indent=2) + "\n").encode("utf-8"), changed
    if relative.as_posix() == "localization/wasm/Cargo.toml":
        content = file.read_text(encoding="utf-8")
        old = 'path = "../localization-kernel-work"'
        if content.count(old) != 1:
            raise ValueError("Semantic Rust dependency no longer has the one reviewed path")
        return content.replace(old, 'path = ".."').encode("utf-8"), ["dependencies.tome-text-kernel.path"]
    return None, []


def stage_file(source: Path, relative: Path, kind: str):
    if source.suffix.lower() in {".teac", ".teag", ".teaw"}:
        raise ValueError("Original character/Game/World runtime archives are outside this checkpoint selection")
    if source.is_symlink() or not source.resolve().is_relative_to(WORK.resolve()):
        raise ValueError("Selected source must be a regular file inside the task workspace")
    target = PORT / relative
    if not target.resolve().is_relative_to(PORT.resolve()):
        raise ValueError("Selected staging target escaped tome-port")
    before = source.stat()
    original_hash = digest_file(source)
    transformed, fields = transformed_bytes(source, relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + ".staging.tmp")
    if transformed is None:
        with source.open("rb") as incoming, temporary.open("wb") as outgoing:
            shutil.copyfileobj(incoming, outgoing, 128 * 1024)
    else:
        temporary.write_bytes(transformed)
    after = source.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns) or digest_file(source) != original_hash:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"Input changed during staging; rerun after the parent's job finishes: {source}")
    staged_hash = digest_file(temporary)
    if transformed is None and staged_hash != original_hash:
        raise RuntimeError("Byte copy hash differs from unchanged source")
    temporary.replace(target)
    return {"source": source.relative_to(WORK).as_posix(), "staged": relative.as_posix(), "kind": kind,
            "source_bytes": before.st_size, "source_mtime_ns": before.st_mtime_ns,
            "source_sha256": original_hash, "staged_bytes": target.stat().st_size,
            "staged_sha256": staged_hash, "rebased_fields": fields}


def main() -> None:
    if PORT.resolve() != WORK.resolve() / "tome-port":
        raise ValueError("Staging must remain in this task's tome-port directory")
    records, counts, absent_evidence = [], {}, []
    selected = set()
    # Record authored delivery documents in place so the selected shared copy
    # includes current instructions and notices, without copying onto itself.
    documents = [PORT / "README.md", PORT / "THIRD-PARTY-NOTICES.md"]
    documents += sorted((PORT / "docs").glob("*.md"))
    documents += sorted(file for file in (PORT / "licenses").rglob("*") if file.is_file())
    for file in documents:
        if file.is_symlink() or not file.resolve().is_relative_to(PORT.resolve()):
            raise ValueError("Delivery documentation must remain inside staging")
        relative = file.relative_to(PORT).as_posix()
        if relative in selected:
            raise ValueError("Duplicate delivery document: " + relative)
        selected.add(relative)
        stamp, digest = file.stat(), digest_file(file)
        records.append({"source": file.relative_to(WORK).as_posix(), "staged": relative,
                        "kind": "documentation", "source_bytes": stamp.st_size,
                        "source_mtime_ns": stamp.st_mtime_ns, "source_sha256": digest,
                        "staged_bytes": stamp.st_size, "staged_sha256": digest, "rebased_fields": []})
    for source, destination in SOURCE_GROUPS.items():
        count = 0
        root = WORK / source
        for file in source_files(root):
            relative = checked_relative(destination) / file.relative_to(root)
            key = relative.as_posix()
            if key in selected:
                raise ValueError("Duplicate selected staging path: " + key)
            selected.add(key)
            records.append(stage_file(file, relative, "source"))
            count += 1
        counts[source] = count
    for name in ("inventory-tome.mjs", "analyze-locales.mjs"):
        records.append(stage_file(WORK / "inventory-work" / name,
                                  Path("localization/inventory-tools") / name, "inventory_tool"))
    for source, destination in DISTRIBUTIONS.items():
        file = WORK / checked_relative(source)
        if not file.is_file():
            raise FileNotFoundError("Required compiled checkpoint distribution absent: " + source)
        records.append(stage_file(file, checked_relative(destination), "compiled_distribution"))
    for source, destination in EVIDENCE.items():
        file = WORK / checked_relative(source)
        if file.is_file():
            records.append(stage_file(file, checked_relative(destination), "curated_evidence"))
        else:
            absent_evidence.append(source)
    ui_proof = WORK / "native-core-work/ui-roundtrip-probe"
    if ui_proof.is_dir():
        for file in sorted(ui_proof.glob("ui-roundtrip-*.png")):
            if file.is_symlink():
                raise ValueError("UI evidence symlink is not accepted")
            records.append(stage_file(file, Path("kernel/evidence/ui-roundtrip-probe") / file.name, "curated_evidence"))
    for record in records:
        if digest_file(WORK / checked_relative(record["source"])) != record["source_sha256"]:
            raise RuntimeError("Input changed after its copy; checkpoint must be staged only after jobs finish")
    manifest = {"schema_version": 1, "prepared_at_utc": datetime.now(timezone.utc).isoformat(),
                "source_commit": SOURCE_COMMIT, "delivery_scope": "local HTML and Node only",
                "complete": False, "source_groups": SOURCE_GROUPS, "source_counts": counts,
                "files": records, "optional_evidence_absent": absent_evidence,
                "compiled_distribution_bytes": sum(row["staged_bytes"] for row in records if row["kind"] == "compiled_distribution"),
                "original_asset_archives_copied": False, "character_save_archives_copied": False,
                "original_graph_save_archives_copied": False,
                "build_runtime_artifact_directories_copied": False,
                "external_site_created_or_published": False,
                "old_unselected_staging_files_are_not_part_of_this_checkpoint": True}
    write_json(PORT / "STAGING-MANIFEST.json", manifest)
    print(json.dumps({"source_counts": counts, "selected_files": len(records),
                      "distribution_bytes": manifest["compiled_distribution_bytes"],
                      "manifest": str(PORT / "STAGING-MANIFEST.json"), "complete": False}))


if __name__ == "__main__":
    main()
