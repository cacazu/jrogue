"""Compare an extracted source-only replay with actual compiled inputs; run no compiler."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    project = Path(args.project).resolve()
    project.relative_to(ROOT)
    output = (ROOT / args.output).resolve()
    output.relative_to(ROOT)
    assert not output.exists()
    original_manifest = ROOT / "build/phase6/engine-manifest.json"
    manifest_path = project / "build/engine-manifest.json"
    assert sha(manifest_path) == sha(original_manifest)
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    assert manifest["commit"] == "16ff59115315917b93185d026aeefea06db9b0f4"
    actual = project / "engine-source"
    replay = project / "work/phase6/NetHack-5.0.0"
    rows = []
    for kind, records in (("compiled_source", manifest["compiled_input_hashes"]),
                          ("recorded_header", manifest["compiled_header_hashes"])):
        for item in records:
            original = actual / item["path"]
            prepared = replay / item["path"]
            assert original.resolve().is_relative_to(actual.resolve())
            assert prepared.resolve().is_relative_to(replay.resolve())
            assert sha(original) == item["sha256"]
            observed = sha(prepared)
            rows.append({"kind": kind, "path": item["path"], "actual_compiled_sha256": item["sha256"],
                         "replayed_sha256": observed, "equal": observed == item["sha256"]})
    source_rows = [row for row in rows if row["kind"] == "compiled_source"]
    changed = [row for row in rows if not row["equal"]]
    assert len(source_rows) == 177 and all(row["equal"] for row in source_rows)
    assert all(row["kind"] == "recorded_header" and row["path"] == "include/date.h" for row in changed), changed
    report = {"status": "passed_source_only_replay_for_compiled_sources", "project": str(project),
              "engine_manifest_sha256": sha(manifest_path), "compiled_sources_equal": len(source_rows),
              "recorded_headers_compared": len(rows) - len(source_rows), "differences": changed,
              "compiler_launched_by_comparison": False, "full_binary_rebuild_performed": False,
              "qualification": "Original target makedefs regenerates date.h during a full build; source-only preparation does not establish identical date-dependent headers, data or binaries.", "inputs": rows}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"status": report["status"], "compiled_sources_equal": len(source_rows),
                      "recorded_headers_compared": report["recorded_headers_compared"], "differences": len(changed), "report_sha256": sha(output)}))


if __name__ == "__main__":
    main()
