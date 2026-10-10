"""Verify the official release archive and preserve its immutable source tree."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import tarfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_SHA256 = "2959b7886aac76185b90aea0c9f80d14343f604de0ae96b3dd2a760f7ab3bde9"
ARCHIVE_BYTES = 10_793_920
COMMIT = "16ff59115315917b93185d026aeefea06db9b0f4"


def main() -> None:
    local_archive = ROOT / "archives" / "nethack-500-src.tgz"
    source_archive = local_archive if local_archive.is_file() else ROOT.parent / "nethack-500-src.tgz"
    with source_archive.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != ARCHIVE_SHA256 or source_archive.stat().st_size != ARCHIVE_BYTES:
        raise SystemExit("official source archive digest or size mismatch")
    target = ROOT / "upstream"
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(source_archive, "r:gz") as archive:
        for member in archive.getmembers():
            p = Path(member.name)
            if p.is_absolute() or ".." in p.parts or member.issym() or member.islnk():
                raise SystemExit(f"unexpected archive member: {member.name}")
        if not (target / "NetHack-5.0.0").exists():
            archive.extractall(target, filter="data")
    preserved = ROOT / "archives"
    preserved.mkdir(exist_ok=True)
    if source_archive.resolve() != (preserved / source_archive.name).resolve():
        shutil.copyfile(source_archive, preserved / source_archive.name)
    files = []
    tree = target / "NetHack-5.0.0"
    for path in sorted(tree.rglob("*")):
        if path.is_file():
            with path.open("rb") as stream:
                sha = hashlib.file_digest(stream, "sha256").hexdigest()
            files.append({"path": path.relative_to(tree).as_posix(), "bytes": path.stat().st_size, "sha256": sha})
    archive_members = {}
    with tarfile.open(source_archive, "r:gz") as archive:
        for member in archive.getmembers():
            if member.isfile():
                stream = archive.extractfile(member)
                if stream is None:
                    raise SystemExit("archive member not readable")
                archive_members[Path(member.name).relative_to("NetHack-5.0.0").as_posix()] = hashlib.file_digest(stream, "sha256").hexdigest()
    if {row["path"]: row["sha256"] for row in files} != archive_members:
        raise SystemExit("preserved source is not byte-identical to official archive")
    manifest = {
        "game": "NetHack", "version": "5.0.0", "released": "2026-05-02",
        "source_url": "https://www.nethack.org/download/5.0.0/nethack-500-src.tgz",
        "checksum_url": "https://www.nethack.org/v500/download-src.html",
        "repository": "https://github.com/NetHack/NetHack", "tag": "NetHack-5.0.0_Released", "release_commit": COMMIT,
        "archive": {"path": "archives/nethack-500-src.tgz", "bytes": ARCHIVE_BYTES, "sha256": digest},
        "source": {"path": "upstream/NetHack-5.0.0", "file_count": len(files), "bytes": sum(x["bytes"] for x in files), "files": files},
        "license": "NetHack General Public License", "license_path": "upstream/NetHack-5.0.0/dat/license",
        "note": "Archive and Git release SHA are separately pinned; byte-identical archive extraction is verified. No archive/Git tree equivalence is asserted."
    }
    (ROOT / "provenance.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"result": "pass", "archive_sha256": digest, "source_file_count": len(files), "source_bytes": manifest["source"]["bytes"]}))


if __name__ == "__main__":
    main()
