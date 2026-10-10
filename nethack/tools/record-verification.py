"""Bind existing test evidence to the exact delivered source and runtime.

New integration utility, 2026-10-02, NGPL; it runs no gameplay and makes no
claims beyond the recorded measurements. Publication requires browser success.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def sha(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def require_hash(path: Path, expected: str) -> None:
    if not path.is_file() or sha(path) != expected:
        raise SystemExit(f"verification evidence does not match current file: {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pending", action="store_true", help="record incomplete checks honestly; never certifies publication readiness")
    parser.add_argument("--pending-reason", default="")
    args = parser.parse_args()
    provenance = read("provenance.json")
    for entry in provenance["source"]["files"]:
        require_hash(ROOT / provenance["source"]["path"] / entry["path"], entry["sha256"])
    require_hash(ROOT / provenance["archive"]["path"], provenance["archive"]["sha256"])
    engine = read("build/engine-manifest.json")
    for name, entry in engine["artifacts"].items():
        require_hash(ROOT / "web" / "engine" / name, entry["sha256"])
        require_hash(ROOT / "build" / name, entry["sha256"])
    rust = read("rust/verification.json")
    for entry in rust["source_files"]:
        require_hash(ROOT / "rust" / entry["path"], entry["sha256"])
    scanner = read("catalog/source-verification.json")
    for name, expected in scanner["catalog_sha256"].items():
        require_hash(ROOT / "catalog" / name, expected)
    for name, expected in scanner["tool_sha256"].items():
        require_hash(ROOT / "tools" / name, expected)
    browser = read("tests/results/browser-latest.json")
    browser_passed = browser["status"] == "passed" and bool(browser["tests"]) and all(t["status"] == "passed" for t in browser["tests"])
    if not browser_passed and not args.pending:
        raise SystemExit("full real-browser verification must pass before recording release readiness")
    role_check = next((t for t in browser["tests"] if t["name"] == "All 13 roles start through actual upstream menus"), None)
    if role_check is None and not args.pending:
        raise SystemExit("release evidence must include all 13 role starts, not a debug subset")
    for entry in browser["artifacts"]:
        require_hash(ROOT / "web" / entry["name"], entry["sha256"])
    boundaries = read("build/browser-boundary-verification.json")
    if boundaries.get("status") != "passed":
        raise SystemExit("final host and compiled Rust boundary evidence must pass")
    if boundaries.get("wasm_sha256") != engine["artifacts"]["nethack.wasm"]["sha256"]:
        raise SystemExit("boundary evidence belongs to a different engine build")
    for relative, expected in boundaries["runtime_sha256"].items():
        require_hash(ROOT / relative, expected)
    for relative, expected in boundaries["source_sha256"].items():
        require_hash(ROOT / relative, expected)
    seed = read("locales/translation-status.json")
    (ROOT / "build" / "browser-gameplay-verification.json").write_text(json.dumps(browser, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "build" / "server-verification.json").write_text(json.dumps(read("tests/results/server.json"), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    evidence_paths = ["provenance.json", "build/engine-manifest.json", "build/engine-verification.json",
        "build/data-probe.json", "build/node-smoke.json", "rust/verification.json",
        "build/browser-boundary-verification.json", "catalog/source-verification.json",
        "locales/translation-status.json", "build/server-verification.json", "build/browser-gameplay-verification.json"]
    result = {
        "verified_at_utc": datetime.now(timezone.utc).isoformat(),
        "status": "checks_pending" if args.pending else "tested_complete_original_game_reference",
        "publication_ready": browser_passed and role_check is not None and not args.pending,
        "pending_reason": args.pending_reason if args.pending else None,
        "architecture": "Original C gameplay plus Rust presentation, input/application commands and platform adapters",
        "source": {k: provenance[k] for k in ("game", "version", "release_commit", "source_url", "checksum_url", "tag")},
        "original_archive": provenance["archive"],
        "pristine_source_files_verified": len(provenance["source"]["files"]),
        "engine_artifacts": engine["artifacts"],
        "rust_native_tests": rust["native_tests"],
        "rust_formatting": rust["formatting"],
        "rust_clippy": rust["clippy"],
        "source_scanner_tests": {k: scanner[k] for k in ("scanner_unit_tests_run", "scanner_unit_test_failures", "scanner_unit_test_errors", "scanner_unit_tests_skipped")},
        "browser_boundary_tests": boundaries,
        "real_browser": {"status": browser["status"], "measured_at": browser["measuredAt"], "browser": browser.get("browser"),
            "checks_passed": sum(t["status"] == "passed" for t in browser["tests"]),
            "checks_failed": sum(t["status"] == "failed" for t in browser["tests"]),
            "checks": [{"name": t["name"], "status": t["status"]} for t in browser["tests"]], "artifacts": browser["artifacts"],
            "report": "build/browser-gameplay-verification.json", "local_screenshots": ["tests/results/" + p for p in browser.get("screenshots", [])]},
        "localization": {"default_ui_locale": "ja", "ui_semantic_ids_through_compiled_rust": True,
            "game_text_locale": "en", "japanese_game_seed_entries": seed["japanese_seed_entries"],
            "game_seed_runtime_integration": seed["runtime_integration"], "full_japanese_gameplay_complete": False},
        "remaining_work": ["Full original gameplay text producer instrumentation with semantic IDs and typed arguments",
            "Complete Japanese game catalogs and dynamic/data-text coverage with knowledge-safe entity arguments"],
        "full_original_request_complete": False,
        "publication": "pending; only delivery.json may record native terminal deployment success",
        "evidence": [{"path": p, "sha256": sha(ROOT / p)} for p in evidence_paths],
    }
    (ROOT / "verification.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"result": "pending" if args.pending else "pass", "browser_checks_passed": sum(t["status"] == "passed" for t in browser["tests"]), "original_files": len(provenance["source"]["files"]),
        "verification": str(ROOT / "verification.json"), "full_japanese_gameplay_complete": False}))


if __name__ == "__main__":
    main()
