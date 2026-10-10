"""Install the verified candidate locally, retaining the preceding local artifacts."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--archive-sha256", required=True)
    parser.add_argument("--audit", required=True)
    parser.add_argument("--audit-sha256", required=True)
    args = parser.parse_args()
    config_path = (ROOT / args.config).resolve()
    audit_path = (ROOT / args.audit).resolve()
    config_path.relative_to(ROOT)
    audit_path.relative_to(ROOT)
    assert digest(audit_path) == args.audit_sha256
    config = json.loads(config_path.read_text(encoding="utf8"))
    candidate = (ROOT / config["web_root"]).resolve()
    candidate.relative_to(ROOT)
    verification_path = ROOT / "build/phase6/verification.json"
    verification = json.loads(verification_path.read_text(encoding="utf8"))
    assert verification["actual_checks"]["combined_boundary_and_browser_passed"] == 64
    assert verification["full_original_request_complete"] is False
    assert verification["runtime_sha256"] == config["expected_runtime_sha256"]
    assert any(item["path"] == config_path.relative_to(ROOT).as_posix()
               and item["sha256"] == digest(config_path)
               for item in verification["evidence"])
    audit = json.loads(audit_path.read_text(encoding="utf8"))
    assert audit["status"] in {"passed_source_integrity", "passed_integrity_and_offline_rebuild_setup"}, "Source archive audit must pass first"
    assert audit["archive"]["sha256"] == args.archive_sha256
    assert Path(audit["archive"]["path"]).resolve() == (candidate / "downloads/corresponding-source.tar.gz").resolve()
    assert all(item["status"] in {"passed", "skipped"} for item in audit["checks"])
    passed_checks = {item["name"] for item in audit["checks"] if item["status"] == "passed"}
    assert {
        "all_archive_bytes_match_frozen_selected_input_snapshot",
        "actual_phase6_source_manifest_and_engine_lineage_binding",
        "complete_compiled_sources_and_actual_engine_artifact_binding",
        "packaged_final_host_and_actual_wasm_boundary_evidence_binding",
        "packaged_selected_rust_sources_match_actual_offline_locked_tests",
    } <= passed_checks
    selected = dict(config["expected_runtime_sha256"])
    selected["downloads/NGPL.txt"] = "93a3ae2cb8dee482daddfaebe53bcffe5b114b603def19b4dca21621cbc5a747"
    selected["downloads/corresponding-source.tar.gz"] = args.archive_sha256
    for name, expected in selected.items():
        assert digest(candidate / name) == expected, name
    history = ROOT / "build/history/pre-phase6-promotion"
    assert not history.exists(), "Use a fresh promotion history directory"
    output = ROOT / "build/local-phase6-promotion.json"
    assert not output.exists(), "Use a fresh promotion report"
    destinations = [(candidate / name, ROOT / "web" / name) for name in selected]
    destinations.append((verification_path, ROOT / "verification.json"))
    preserved = {}
    for source, destination in destinations:
        assert not destination.is_symlink(), str(destination)
        if destination.exists():
            name = destination.relative_to(ROOT).as_posix()
            saved = history / name
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(destination, saved)
            assert digest(saved) == digest(destination), name
            preserved[name] = {"bytes": saved.stat().st_size, "sha256": digest(saved)}
    history.mkdir(parents=True, exist_ok=True)
    (history / "preservation-manifest.json").write_text(json.dumps({"files": preserved}, indent=2) + "\n", encoding="utf8")
    installed = {}
    for source, destination in destinations:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        assert digest(source) == digest(destination)
        installed[destination.relative_to(ROOT).as_posix()] = {"bytes": destination.stat().st_size, "sha256": digest(destination)}
    report = {"status": "passed", "scope": "Owned local web and verification only; no external hosting or Git", "config_sha256": digest(config_path), "source_audit_sha256": digest(audit_path), "installed": installed, "preserved": preserved}
    with output.open("x", encoding="utf8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"status": "passed", "installed_files": len(installed), "report": str(output)}))


if __name__ == "__main__":
    main()
