"""Record only executed, source-only checks; full original browser remains gated."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json

WORK = Path(__file__).resolve().parent.parent
LOCALIZATION = WORK / "localization-kernel-work"
ADAPTERS = WORK / "rust-kernel-adapter-work"

def load(directory, name):
    return json.loads((directory / name).read_text(encoding="utf-8"))

def save(directory, name, value):
    (directory / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

catalog = load(LOCALIZATION, "catalog-build-result.json")
structure = load(LOCALIZATION, "catalog-validation-result.json")
locations = load(LOCALIZATION, "source-location-audit.json")
supplement = load(LOCALIZATION, "supplement-validation-result.json")
memory = load(LOCALIZATION, "catalog-build-memory.json")
checkpoint = load(LOCALIZATION, "CHECKPOINT.json")
checkpoint["status"] = "generated_validated_pending_native_integration"
checkpoint["verified_at_utc"] = datetime.now(timezone.utc).isoformat()
checkpoint["validation"]["rust"] = {
    "current_source_compile": "passed via cargo test --offline --jobs 1",
    "unit_tests_passed": 8,
    "full_catalogue_loaded": True,
    "clippy_all_targets_deny_warnings": "passed",
    "original_gameplay_executed": False,
}
checkpoint["catalogue"]["generation_snapshot"] = catalog
checkpoint["final_structural_validation"] = structure
checkpoint["final_source_locations"] = locations
checkpoint["reviewed_supplements"] = supplement
checkpoint["final_generation_memory"] = {
    key: value for key, value in memory.items() if key != "memory_samples"
}
checkpoint["native_runtime_integration_verified"] = False
checkpoint["complete_translation_coverage_claimed"] = False
save(LOCALIZATION, "CHECKPOINT.json", checkpoint)

adapter_validation = load(ADAPTERS, "validation.json")
adapter_validation["completed_checks"]["final_native_unit_tests"] = {"passed": 14, "failed": 0}
adapter_validation["completed_checks"]["clippy_all_targets_deny_warnings"] = "passed final source, offline single job"
adapter_validation["pending_due_to_parent_memory_hold"] = ["Rebuild final-source WASM and rerun browser/bridge.test.mjs"]
adapter_validation["existing_wasm_matches_final_source"] = False
save(ADAPTERS, "validation.json", adapter_validation)

root_checkpoint = {
    "verified_at_utc": checkpoint["verified_at_utc"],
    "upstream_version": "1.7.6",
    "upstream_commit": "624a67329fe2ad440c5b344785a9c73fcf22ae63",
    "gameplay_language": "unchanged original C/Lua",
    "rust_layers": "input, immutable display, platform adapters; reference Rust rules are fixtures",
    "catalog": catalog,
    "structural_assertions_passed": structure["structural_assertions_passed"],
    "source_files_verified": locations["distinct_source_files"],
    "source_locations_verified": locations["checked_locations"],
    "supplement": supplement,
    "original_i18n_lua_checks_passed": 30,
    "localization_rust_unit_tests_passed": 8,
    "retained_adapter_rust_unit_tests_passed": 14,
    "both_rust_workspaces_clippy_final_source": "passed",
    "native_c_output_ids": 82,
    "native_c_output_sites": 92,
    "original_source_modified": False,
    "new_original_engine_build_link_or_browser_started": False,
    "existing_adapter_wasm_matches_final_source": False,
    "full_game_boot_verified": False,
    "original_save_resume_verified": False,
    "gaussian_libc_snapshot_runtime_verified": False,
    "complete_translation_coverage_claimed": False,
    "site_project_id": None,
    "site_url": None,
    "git_index_commit_push_performed": False,
    "resource_gate": "Parent's original-engine, asset-packaging and browser hold remains active",
    "next_resource_work": {
        "original_link": "Ten prepared seams plus existing 127-unit artifacts, followed by native combined RNG tests; final peak not measured yet, use a separate monitored slot",
        "asset_bytes": 450441318,
        "preload_two_copies_bytes": 900882636,
        "browser": "Separate budget for preload copies, WASM, textures and browser overhead; actual PC/mobile flows precede private user-requested Site creation",
    },
}
source_hashes = {}
for directory in (LOCALIZATION, WORK / "localization-c-output-work"):
    for source in directory.rglob("*"):
        if not source.is_file() or any(part in {"target", "__pycache__"} for part in source.relative_to(directory).parts):
            continue
        if source.name in {"SOURCE-MANIFEST.json", "ROOT-CHECKPOINT.json"}:
            continue
        if source.suffix not in {".json", ".mjs", ".cjs", ".lua", ".rs", ".toml", ".lock", ".py", ".md"}:
            continue
        source_hashes[str(source.relative_to(WORK)).replace("\\", "/")] = hashlib.sha256(source.read_bytes()).hexdigest()
root_checkpoint["deliverable_sha256"] = source_hashes
save(LOCALIZATION, "ROOT-CHECKPOINT.json", root_checkpoint)
print(json.dumps({"catalog_ids": catalog["semantic_ids"], "source_files_verified": locations["distinct_source_files"], "approved_supplement_ids": supplement["approved_supplement_ids"], "review_required_ids": supplement["remaining_missing_ids_after_approved_overlay"], "rust_tests": [8, 14], "native_browser_started": False, "site_url": None}))
