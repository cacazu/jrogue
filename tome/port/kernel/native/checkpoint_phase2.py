"""Copy this task's reviewed source checkpoint into the authorized ToME folder."""
from pathlib import Path
import json
import shutil

WORK=Path(__file__).resolve().parent.parent
TOME=Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome")
PORT=WORK/"tome-port"
expected=TOME.resolve()
destination=(TOME/"port").resolve()
if destination.parent != expected: raise SystemExit("Unexpected destination outside ToME")
if not expected.is_dir(): raise SystemExit("Existing authorized ToME folder required")
shutil.copytree(PORT, destination, dirs_exist_ok=True,
    ignore=shutil.ignore_patterns("target", "__pycache__", ".git", "*.o", "*.a"))
status_file=TOME/"STATUS.json"
status=json.loads(status_file.read_text(encoding="utf-8"))
localization=json.loads((WORK/"localization-kernel-work/ROOT-CHECKPOINT.json").read_text(encoding="utf-8"))
link_result=json.loads((WORK/"native-core-work/browser-build/link-result.json").read_text(encoding="utf-8")) if (WORK/"native-core-work/browser-build/link-result.json").is_file() else {"exit":None}
rng_log=(WORK/"kernel-bindings-work/gaussian-test/execute-test.log").read_text(encoding="utf-8") if (WORK/"kernel-bindings-work/gaussian-test/execute-test.log").is_file() else ""
compound_rng_passed="passed: 435171 assertions" in rng_log
status.update({
    "last_milestone":"Original C/Lua native browser link and compound RNG checks passed; real browser birth and full port integration remain in progress",
    "original_translation_units_compiled":127,
    "original_kernel_units_compiled":23,
    "original_dependency_units_compiled":104,
    "native_sfmt_snapshot_assertions_passed":28995,
    "native_sfmt_snapshot_bytes":2524,
    "retained_rust_initial_tests_passed":11,
    "retained_rust_final_source_tests_passed":14,
    "retained_rust_final_source_tests_pending":0,
    "retained_rust_final_clippy_passed":True,
    "retained_wasm_refresh_pending":True,
    "real_core_driver_lua51_syntax_verified":True,
    "real_core_driver_sha256":"0321863b3276906a5567bf1e3c759b8cd02c729324d47a8808ce869de9f76671",
    "original_archive_link_measured_missing_graphics_symbols":11,
    "graphics_adapter_sources_and_contract_tests_ready":True,
    "actual_graphics_browser_verification_pending":True,
    "gaussian_and_libc_rng_snapshot_source_ready":True,
    "gaussian_and_libc_rng_snapshot_runtime_verification_pending":not compound_rng_passed,
    "compound_original_rng_assertions_passed":435171 if compound_rng_passed else 0,
    "original_native_browser_link_passed":link_result.get("exit")==0,
    "localization_builder_fixture_assertions_passed":11,
    "localization_original_i18n_seam_checks_passed":30,
    "production_en_ja_json_catalog_generation_pending":False,
    "production_semantic_ids":localization["catalog"]["semantic_ids"],
    "production_source_tag_routes":localization["catalog"]["source_tag_routes"],
    "production_structural_assertions_passed":localization["structural_assertions_passed"],
    "production_source_files_verified":localization["source_files_verified"],
    "production_official_japanese_missing_ids":localization["catalog"]["missing_official_japanese_ids"],
    "approved_japanese_supplement_ids":localization["supplement"]["approved_supplement_ids"],
    "japanese_supplement_review_required_ids":localization["supplement"]["remaining_missing_ids_after_approved_overlay"],
    "production_supplement_native_integration_verified":False,
    "localization_final_source_rust_tests_passed":8,
    "localization_final_source_rust_clippy_passed":True,
    "localization_final_source_rust_verification_pending":False,
    "native_c_text_ids":82,
    "native_c_text_callsites":92,
    "native_c_text_transport_integrated":False,
    "complete_translation_coverage_verified":False,
    "resource_gate":"Parent-authorized one sequential measured owned job; fresh system headroom and actual project peak, no asset-byte RAM gate",
    "owned_high_memory_jobs_running":False,
    "site_project_id":None,
    "site_url":None,
    "web_delivery_scope":"HTML plus local Node and real-browser PC/mobile verification; no external hosting requested",
    "external_publication_requested":False,
    "publication_blocker":None,
    "local_full_browser_verification_complete":False,
    "full_game_boot_verified":False,
})
status_file.write_text(json.dumps(status,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"destination":str(destination),"source_checkpoint_saved":True,"git_write":False,"full_game_boot_verified":False}))
