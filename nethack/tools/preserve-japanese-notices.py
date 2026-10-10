#!/usr/bin/env python3
"""Preserve original notices for pinned, text-only JNetHack reuse.

Added 2026-10-02. Distributed under the NetHack General Public License.
Never reads the fork's working-tree source files or modifies that repository.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

PIN = "25adee135c4bbd43ac8567664f600b565332435c"
ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", type=Path, required=True)
    parser.add_argument("--git", type=Path, required=True)
    parser.add_argument("--additional-provenance", type=Path, action="append", default=[])
    args = parser.parse_args()
    repository = args.repository.resolve(strict=True)
    command = [str(args.git), "-c", f"safe.directory={repository.as_posix()}",
               "-C", str(repository)]

    def git(*arguments: str) -> bytes:
        return subprocess.run(command + list(arguments), check=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout

    metadata = json.loads((ROOT / "locales/gameplay-core.metadata.json").read_text("utf-8"))
    provenance = metadata["provenance"]["jnethack"]
    if provenance["pinned_commit"] != PIN:
        raise SystemExit("Catalog provenance does not match the reviewed JNetHack pin")
    paths = provenance.get("imported_paths")
    if not paths:
        # Older source checkpoints store the exact original path per catalog entry.
        entries = metadata["entries"]
        records = entries.values() if isinstance(entries, dict) else entries
        paths = sorted({entry["jnethack_file"] for entry in records
                        if isinstance(entry, dict) and entry.get("jnethack_file")})
    if not paths:
        raise SystemExit("No canonical imported-path inventory; finalize catalog metadata first")
    paths = set(paths)
    source_inventories = []
    for additional in args.additional_provenance:
        raw = additional.read_bytes()
        extra = json.loads(raw)["provenance"]["jnethack"]
        if extra["pinned_commit"] != PIN:
            raise SystemExit("Additional provenance does not match the reviewed JNetHack pin")
        paths.update(extra["imported_paths"])
        source_inventories.append({"path": additional.resolve().relative_to(ROOT).as_posix(),
                                  "sha256": hashlib.sha256(raw).hexdigest()})
    destination = ROOT / "licenses/jnethack"
    destination.mkdir(parents=True, exist_ok=True)
    files: list[dict] = []
    for path in ["READMEj1.txt", "dat/license", *sorted(set(paths))]:
        if path.startswith("/") or ".." in Path(path).parts:
            raise SystemExit(f"Unsafe imported source path: {path}")
        blob = git("show", f"{PIN}:{path}")
        blob_id = git("rev-parse", f"{PIN}:{path}").decode("ascii").strip()
        if path in ("READMEj1.txt", "dat/license"):
            retained = blob
            target = destination / path
            method = "complete original notice file, unmodified"
        else:
            # Retain exact comment bytes, including leading translator credits.
            comment_matches = list(re.finditer(rb"/\*.*?\*/", blob, re.S))
            blocks = [match.group() for match in comment_matches
                      if re.search(rb"copyright|license|warranty", match.group(), re.I)
                      or not blob[:match.start()].strip()]
            if path.endswith(".lua"):
                lua_header = re.match(rb"(?:[ \t]*--[^\n]*(?:\n|$)|\s*\n)+", blob)
                if lua_header:
                    blocks.insert(0, lua_header.group())
            if not blocks:
                raise SystemExit(f"No source notice found: {path}")
            retained = b"\n\n".join(dict.fromkeys(blocks)) + b"\n"
            target = destination / "source-notices" / (path + ".txt")
            method = "exact original leading/copyright/license/warranty comment blocks"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(retained)
        files.append({"original_path": path, "git_blob": blob_id,
                      "original_bytes": len(blob),
                      "original_sha256": hashlib.sha256(blob).hexdigest(),
                      "retained_path": target.relative_to(ROOT).as_posix(),
                      "retained_bytes": len(retained),
                      "retained_sha256": hashlib.sha256(retained).hexdigest(),
                      "method": method})
    report = {"schema_version": 1, "generated_date": "2026-10-02",
              "origin": provenance["origin"], "pinned_commit": PIN,
              "read_method": "git show pinned-commit:path; dirty worktree excluded",
              "scope": "Japanese text, entity labels and quest templates; no fork gameplay",
              "license": "NetHack General Public License",
              "translation_authors": provenance["authors"],
              "additional_source_inventories": source_inventories,
              "integration_changes": "2026-10-02: semantic IDs, typed templates and authored additions",
              "files": files}
    (destination / "PROVENANCE.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"pinned_commit": PIN, "imported_paths": len(set(paths)),
                      "notice_files": len(files), "retained_bytes": sum(x["retained_bytes"] for x in files)},
                     ensure_ascii=True))


if __name__ == "__main__":
    main()
