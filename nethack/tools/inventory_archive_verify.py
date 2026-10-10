#!/usr/bin/env python3
"""Compare extracted upstream files against a pinned archive without extraction."""
from __future__ import annotations

import argparse
import hashlib
import json
import tarfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


def verify(archive: Path, source: Path, expected_sha256: str) -> dict:
    archive_digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if archive_digest != expected_sha256.lower():
        raise ValueError("Archive SHA-256 does not match the official pinned digest")
    members = set()
    total_bytes = 0
    with tarfile.open(archive, "r:gz") as bundle:
        for member in bundle.getmembers():
            if not member.isfile():
                continue
            path = PurePosixPath(member.name)
            if path.is_absolute() or ".." in path.parts or path.parts[0] != source.name:
                raise ValueError(f"Unexpected archive member path: {member.name}")
            relative = PurePosixPath(*path.parts[1:]).as_posix()
            if relative in members:
                raise ValueError(f"Duplicate regular archive member: {member.name}")
            members.add(relative)
            stream = bundle.extractfile(member)
            if stream is None:
                raise ValueError(f"Cannot read archive member: {member.name}")
            original = stream.read()
            observed = (source / relative).read_bytes()
            if original != observed:
                raise ValueError(f"Extracted official source has changed: {relative}")
            total_bytes += len(original)
    observed_members = {p.relative_to(source).as_posix() for p in source.rglob("*") if p.is_file()}
    if observed_members != members:
        raise ValueError(f"Extracted source file set differs from the pinned archive; missing={members-observed_members}, extra={observed_members-members}")
    return {"result": "pass", "verified_at_utc": datetime.now(timezone.utc).isoformat(), "archive": archive.name, "archive_bytes": archive.stat().st_size, "archive_sha256": archive_digest, "source_tree": source.name, "regular_files_compared_byte_for_byte": len(members), "source_file_bytes_compared": total_bytes, "extracted_source_matches_official_pinned_archive": True, "archive_was_extracted_or_modified_by_verifier": False, "tool_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    report = args.report.resolve()
    if report == source or source in report.parents:
        parser.error("--report must be outside the immutable upstream tree")
    result = verify(args.archive.resolve(strict=True), source, args.expected_sha256)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
