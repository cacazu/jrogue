"""Bind current local engine tests without advancing full-translation claims.

Added 2026-10-02; NGPL. Read-only validation plus two owned JSON report writes.
No compiler, browser, shared Git or external hosting operation is performed.
"""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(name):
    return json.loads((ROOT / name).read_text("utf-8"))


def record(name):
    path = ROOT / name
    return {"path": name, "bytes": path.stat().st_size, "sha256": sha(path)}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    manifest = load("build/engine-manifest.json")
    require(len(manifest["compiled_sources"]) == 173, "Complete engine source set is required")
    for name, info in manifest["artifacts"].items():
        path = ROOT / "web/engine" / name
        require(sha(path) == info["sha256"] and path.stat().st_size == info["bytes"], "Installed engine differs")
    for name, expected in manifest["rust_source_refresh"]["rust_source_sha256"].items():
        require(sha(ROOT / name) == expected, "Compiled Rust source differs")
    for item in load("build/source-changes.json"):
        require(sha(ROOT / "work/NetHack-5.0.0" / item["path"]) == item["sha256"], "Compiled C source differs")
    native = load("build/rust-phase3-final-test-verification.json")
    checkpoint_path = ROOT / "rust/source-checkpoint-phase3-formatted.json"
    checkpoint = load("rust/source-checkpoint-phase3-formatted.json")
    require(native["tests_passed"] == 49 and native["failed"] == 0, "Final native Rust suite did not pass")
    require(sha(checkpoint_path) == native["source_checkpoint_sha256"], "Executed Rust source checkpoint differs")
    for item in checkpoint["sourceFiles"]:
        path = (ROOT / "rust" / item["path"]).resolve()
        require(path.is_relative_to(ROOT) and sha(path) == item["sha256"], "Executed Rust source differs")
    boundary = load("build/browser-semantic-compiled-verification.json")
    require(boundary["status"] == "passed" and boundary["failed"] == 0, "Compiled boundary suite did not pass")
    for name, expected in boundary["runtime_sha256"].items():
        require(sha(ROOT / name) == expected, "Boundary runtime differs")
    for name, expected in boundary["source_sha256"].items():
        require(sha(ROOT / name) == expected, "Boundary source differs")
    browser = load("build/browser-semantic-browser-verification.json")
    require(browser["status"] == "passed" and len(browser["tests"]) == 18
            and all(test["status"] == "passed" for test in browser["tests"]), "Current browser suite did not pass")
    require(browser["native_callback_semantics_verified"] and browser["compiled_pipeline_verified"], "No actual native callback proof")
    for info in browser["artifacts"]:
        path = ROOT / "web" / info["name"]
        require(sha(path) == info["sha256"] and path.stat().st_size == info["bytes"], "Browser-tested runtime differs")
    names = load("build/browser-semantic-name-verification.json")
    require(names["status"] == "passed" and len(names["tests"]) == 10
            and all(test["status"] == "passed" for test in names["tests"]), "Native-name browser suite did not pass")
    for info in names["artifacts"]:
        path = ROOT / "web" / info["name"]
        require(sha(path) == info["sha256"] and path.stat().st_size == info["bytes"], "Native-name-tested runtime differs")
    require(names["nativeNestedNameProducerVerified"] and names["nativeMonsterHallucinationNameProducerVerified"],
            "Native-name producer proof is absent")
    require(sha(ROOT / "web/gameplay-core.json") == sha(ROOT / "locales/gameplay-core.json"), "Installed catalog differs")
    metadata = load("locales/gameplay-core.metadata.json")
    measured = []
    for name in ("engine-phase3-build-resource.json", "rust-final-link-resource.json",
                 "rust-phase3-final-test-resource.json", "rust-phase3-clippy-resource.json",
                 "browser-semantic-compiled-memory.json", "browser-semantic-browser-memory.json",
                 "browser-semantic-name-memory.json"):
        report = load("build/" + name)
        require(report["exit_code"] == 0, "Measured build/test stage failed")
        measured.append({"report": record("build/" + name),
                         "duration_seconds": report["duration_seconds"],
                         "kernel_accounted_job_peak_commit_bytes": report["kernel_accounted_job_peak_commit_bytes"],
                         "sampled_process_tree_peak_working_set_bytes": report["sampled_process_tree_peak_working_set_bytes"]})
    report = {"schema_version": 2, "recorded_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "status": "local_original_engine_and_phase3_japanese_pipeline_verified_translation_incomplete",
              "delivery_scope": "Local HTML and Node/browser verification only; no external hosting action authorized",
              "full_original_request_complete": False, "full_japanese_coverage": False,
              "current_active_c_rust_runtime_compiled": True, "current_active_runtime_browser_verified": True,
              "compiled_japanese_pipeline_verified": True, "native_message_callback_semantics_verified": True,
              "native_quest_name_accessibility_producers_verified": False,
              "native_nested_known_monster_name_producer_verified": True,
              "native_hallucination_name_visibility_verified": True,
              "native_unknown_object_appearance_literal_visibility_verified": True,
              "native_unknown_object_article_semantic_producer_verified": False,
              "native_quest_producer_verified": False, "native_typed_accessibility_producer_verified": False,
              "architecture": "Complete official C gameplay/state/RNG; Rust application/input, pure presentation and platform adapters",
              "official_source": {"version": "5.0.0", "commit": manifest["commit"],
                                  "pristine_files": 1265, "complete_compiled_c_lua_units": 173},
              "runtime_artifacts": manifest["artifacts"], "catalog": {"en_ids": metadata["counts"]["english_catalog_ids"],
                  "ja_ids": metadata["counts"]["japanese_catalog_ids"], "base_c_message_ids": 771,
                  "bound_source_sites": 786, "catalog": record("locales/gameplay-core.json"),
                  "qualification": "All catalog entries validated; runtime tests exercise representative native emissions, not all game branches"},
              "actual_checks": {"native_rust_passed": 49, "strict_clippy_passed": True,
                                "boundary_passed": boundary["total_passed"], "browser_passed": 18,
                                "native_name_browser_passed": 10, "combined_boundary_and_browser_passed": 95,
                                "browser_roles": 13, "locale_repaint_invariance_operations": 100,
                                "native_save_and_fresh_restore": True, "pc_and_mobile_viewport_input": True,
                                "physical_ios_safari_tested": False},
              "evidence": [record(name) for name in ("build/engine-manifest.json", "build/source-changes.json",
                  "build/rust-final-link-verification.json", "build/rust-phase3-final-test-verification.json",
                  "build/browser-semantic-compiled-verification.json", "build/browser-semantic-browser-verification.json",
                  "build/browser-semantic-name-verification.json", "build/browser-semantic-acceptance-summary.json",
                  "build/browser-semantic-debug-identity-blocker.json",
                  "licenses/jnethack/PROVENANCE.json")], "measured_owned_jobs": measured,
              "remaining": ["Close the remaining public static, dynamic, name/grammar, help/data and history Japanese text coverage",
                            "Finish actual native quest, unknown-object article, and accessibility producer acceptance",
                            "Compile and verify reviewed broader bindings before installing them",
                            "Package/audit matching corresponding source and deliver only the nethack folder"],
              "historical_remote_reference": {"status": "Unchanged; existing owner-private English reference is historical",
                                             "current_goal": False, "access_or_deployment_changed": False},
              "shared_root_git_operations": False, "other_game_projects_modified": False}
    encoded = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    (ROOT / "verification.json").write_text(encoded, "utf-8")
    (ROOT / "build/local-phase3-verification.json").write_text(encoded, "utf-8")
    print(json.dumps({"status": report["status"], "native_rust_passed":49,
                      "boundary_passed":boundary["total_passed"], "browser_passed":18,
                      "full_original_request_complete":False}))


if __name__ == "__main__":
    main()
