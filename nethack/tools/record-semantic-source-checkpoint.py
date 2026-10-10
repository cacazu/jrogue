"""Record source-only progress without carrying historical runtime passes forward.

Added 2026-10-02, distributed under the NGPL. No compiler, browser, game or
publication command is invoked. Historical evidence is retained unchanged.
"""
from __future__ import annotations
import datetime
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(path: Path) -> dict:
    data = path.read_bytes()
    return {"path": path.relative_to(ROOT).as_posix(), "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest()}


def compact_counts(value):
    if isinstance(value, dict):
        return {key: compact_counts(item) for key, item in value.items()}
    if isinstance(value, list):
        return {"items": len(value), "details": "See canonical catalog metadata"}
    if isinstance(value, str) and len(value) > 240:
        return value[:240] + "... [see canonical metadata]"
    return value


def main() -> None:
    verification = ROOT / "verification.json"
    previous = json.loads(verification.read_text("utf-8"))
    reference = ROOT / "build/reference-phase2-verification.json"
    if not reference.exists():
        if previous.get("status") != "tested_complete_original_game_reference":
            raise SystemExit("Missing original hash-bound reference verification")
        reference.write_bytes(verification.read_bytes())
    catalog = ROOT / "locales/gameplay-core.metadata.json"
    metadata = json.loads(catalog.read_text("utf-8"))
    source_files = set()
    for pattern in ("tools/instrument-semantic*.py", "tools/semantic-text/*.c", "tools/semantic-text/*.h",
                    "tools/build-upstream.py", "tools/preserve-japanese-notices.py",
                    "tools/record-semantic-source-checkpoint.py", "docs/PHASE3-EXECUTION-PLAN.md",
                    "rust/**/*.rs", "rust/include/*.h", "web/*.mjs", "locales/gameplay-core*.json",
                    "locales/build-gameplay-catalog.py", "locales/gameplay-reuse-calls.py",
                    "locales/gameplay-quest-authored.ja.json", "tests/*semantic*.*"):
        source_files.update(path for path in ROOT.glob(pattern) if path.is_file()
                            and "vendor" not in path.parts and "target" not in path.parts)
    reports = []
    for name in ("tools/semantic-text/generated/audit.json",
                 "tools/semantic-text/generated-names/names-audit.json",
                 "tools/semantic-text/generated-objects/objects-audit.json",
                 "build/browser-semantic-source-verification.json",
                 "rust/source-checkpoint-phase3.json",
                 "licenses/jnethack/PROVENANCE.json"):
        path = ROOT / name
        if path.exists(): reports.append(digest(path))
    report = {"schema_version": 1,
              "recorded_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "status": "source_only_translation_checkpoint",
              "publication_ready": False, "full_original_request_complete": False,
              "current_source_compiled": False, "current_source_browser_verified": False,
              "compiled_japanese_pipeline_verified": False,
              "architecture": "Official C gameplay; Rust application/input/presentation/platform boundaries",
              "source": {"version": "5.0.0", "official_commit": "16ff59115315917b93185d026aeefea06db9b0f4",
                         "jnethack_translation_commit": metadata["provenance"]["jnethack"]["pinned_commit"]},
              "catalog": {"counts": compact_counts(metadata["counts"]), "runtime_localized_message_count_verified": 0,
                          "full_japanese_coverage": False, "metadata": digest(catalog)},
              "source_only_reports": reports,
              "lightweight_evidence": {"catalog_generator_checks_passed": 10,
                  "translation_reuse_parser_checks_passed": 14,
                  "native_source_generator_checks_passed": 5,
                  "browser_pure_mock_checks_passed": 47,
                  "browser_source_syntax_checks_passed": 5,
                  "rust_embedded_json_syntax_checks_passed": 50,
                  "rust_test_sources_not_executed": 49,
                  "qualification": "Source and mock checks only; no compiled/native/browser passes for this revision"},
              "source_files": [digest(path) for path in sorted(source_files)],
              "historical_reference": {"site_url": "https://jrogue-nethack-500.poromin.chatgpt.site",
                  "access": "owner-private", "publication_status": "succeeded",
                  "site_commit": "6cf359dc5e615093aacdac09804cebc3909af6a3",
                  "verification": digest(reference),
                  "qualification": "English gameplay reference; its passes do not verify current edited sources"},
              "resource_wait": {"reason": "Parent requires a heavy-job slot before compilation/browser execution",
                  "permission_received": False, "planned_compile_parallelism": 1,
                  "peak_memory_measured": False,
                  "estimated_incremental_budget_gib": [2, 4],
                  "estimate_is_not_an_upper_bound": True,
                  "required_next_evidence": "Measure owned serial build process-tree memory before asserting a peak"},
              "remaining": ["Complete source producer coverage, including dynamic names and data text",
                            "Compile and test the changed Rust/C ABI after resource permission",
                            "Verify Japanese gameplay, hidden knowledge, locale/RNG, save/load and mobile behavior",
                            "Repackage corresponding source and notices against verified runtime artifacts",
                            "Update the existing private Site and owned target only after verification"]}
    encoded = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    (ROOT / "build/semantic-source-checkpoint.json").write_text(encoded, "utf-8")
    verification.write_text(encoded, "utf-8")
    print(json.dumps({"status": report["status"], "source_files": len(source_files),
                      "publication_ready": False, "historical_runtime_evidence_retained": str(reference)},
                     ensure_ascii=True))


if __name__ == "__main__":
    main()
