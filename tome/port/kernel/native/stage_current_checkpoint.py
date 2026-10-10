"""Copy only the current staging manifest to ToME and derive honest local status.

Run stage_retained_sources.py first, after measured jobs finish. --check-only
performs read-only validation. No build, browser, Git or hosting action exists.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import argparse
import json
import re
import shutil
from urllib.parse import urlsplit

from stage_retained_sources import (
    WORK, PORT, TOME, SOURCE_COMMIT, checked_relative, digest_file, write_json,
)

ROUTE_FILES = {
    "/native/tome-native.mjs": "dist/native/tome-native.mjs",
    "/native/tome-native.wasm": "dist/native/tome-native.wasm",
    "/retained/tome_core_environment.wasm": "dist/retained/tome_core_environment.wasm",
    "/semantic/tome_text_wasm.wasm": "dist/semantic/tome_text_wasm.wasm",
    "/play-browser.html": "kernel/bootstrap/play-browser.html",
    "/play-browser.mjs": "kernel/bootstrap/play-browser.mjs",
    "/ui-roundtrip-browser.html": "kernel/bootstrap/ui-roundtrip-browser.html",
    "/retained-browser.html": "kernel/bootstrap/retained-browser.html",
    "/original-browser-boot.html": "kernel/bootstrap/original-browser-boot.html",
    "/semantic-resume.html": "kernel/save/semantic-resume.html",
    "/baseline-save-resume.html": "kernel/save/baseline-save-resume.html",
    "/bootstrap/browser_vfs_mounts.mjs": "kernel/bootstrap/browser_vfs_mounts.mjs",
    "/checkpoint/source-manifest.json": "kernel/save/source-manifest.json",
}
RUST_BROWSER_ROUTES = {
    "/rust/retained-browser-session.mjs", "/rust/retained-core-adapter.mjs",
    "/rust/original-native-core.mjs", "/rust/diagnostic-renderer.mjs",
}
PROOF_DRIVER_FILES = {
    "original-browser-scenario": "kernel/bootstrap/real-core-probe.lua",
    "retained-browser-probe": "kernel/bootstrap/real-core-probe.lua",
    "semantic-browser-probe": "kernel/bootstrap/real-core-probe.lua",
    "full-save-probe": "kernel/save/generated/baseline-birth-driver.lua",
    "ui-roundtrip-probe": "kernel/bootstrap/generated/ui-roundtrip-driver.lua",
    "japanese-save-resume-probe": "kernel/save/generated/baseline-birth-driver.lua",
    "play-mobile-probe": "kernel/save/generated/baseline-birth-driver.lua",
    "shared-local-probe": "kernel/save/generated/baseline-birth-driver.lua",
}
PROOFS = {
    "original_browser": ("original-browser-scenario", "original-scenario"),
    "retained_browser": ("retained-browser-probe", "retained-browser"),
    "semantic_browser": ("semantic-browser-probe", "semantic-browser"),
    "full_save_resume": ("full-save-probe", "full-save"),
    "ui_roundtrip": ("ui-roundtrip-probe", "ui-roundtrip"),
    "japanese_save_resume": ("japanese-save-resume-probe", "japanese-save-resume"),
    "combined_play_pc_mobile": ("play-mobile-probe", "play-mobile"),
    "shared_folder_cli_pc_mobile": ("shared-local-probe", "shared-local"),
}
LOCALE_HYDRATION_OUTSTANDING = "Saved English/Japanese locale hydration and original language-selector VM reboot need end-to-end verification."
OUTSTANDING = [
    "Whole-game combat, inventory, talents, quests, death and victory flows have not been exhaustively verified.",
    "Original graphical UI, production CJK layout and native SDL desktop/mobile input need broader actual-browser verification; diagnostic projections are narrower evidence.",
    "Full campaign semantic text coverage remains unverified; observed unknown source/tag callsites require source-context classification.",
    "Native special/order metadata paths absent from official JA were not exercised by zero-entry checks.",
    "Prepared pure Rust map presentation and full original UI projection still need production integration and render-purity verification.",
    "Production callbacks need audited command/turn barriers and activation of separate named RNG banks across actual simulation and visual phases.",
]


def load_json(file: Path):
    # Compact catalogs are copied/hashed without parsing. Only bounded proof
    # reports are decoded here; accidental giant archive/inventory input fails.
    if file.stat().st_size > 16 * 1024 * 1024:
        raise ValueError("Unexpected oversized checkpoint metadata: " + str(file))
    return json.loads(file.read_text(encoding="utf-8"))


def selected_json(records, relative):
    if relative not in records:
        return None
    return load_json(PORT / checked_relative(relative))


def exit_code(value):
    if isinstance(value, dict):
        return value.get("exit_code", value.get("exit"))
    return None


def stage_results(value):
    if isinstance(value, list):
        return value
    if isinstance(value, dict) and isinstance(value.get("stages"), list):
        return value["stages"]
    return []


def summarize_stages(records, relative):
    value = selected_json(records, relative)
    rows = stage_results(value)
    return {"evidence": relative if value is not None else None,
            "evidence_sha256": records[relative]["staged_sha256"] if relative in records else None,
            "stage_count": len(rows), "passed_stage_count": sum(exit_code(row) == 0 for row in rows),
            "all_recorded_stages_passed": bool(rows) and all(exit_code(row) == 0 for row in rows),
            "stages": [{"stage": row.get("stage"), "exit_code": exit_code(row)} for row in rows],
            "source_freshness_proven_by_test_report": False}


def served_path(route, group):
    if route == "/vfs/adapter/real-core-probe.lua":
        return PROOF_DRIVER_FILES.get(group)
    if not isinstance(route, str):
        return None
    if route in ROUTE_FILES:
        return ROUTE_FILES[route]
    # Match the actual portable server's retained/browser source layout. A
    # reported route cannot turn into an arbitrary path outside this selection.
    for prefix, directory in (("/rust/", "retained/browser"),
                              ("/semantic/", "localization/wasm/browser")):
        if route.startswith(prefix) and route.endswith(".mjs"):
            try:
                return (Path(directory) / checked_relative(route[len(prefix):])).as_posix()
            except ValueError:
                return None
    return None


def browser_summary(records, group, resource_name):
    proof_path = f"kernel/evidence/{group}/evidence.json"
    resource_path = f"kernel/evidence/resources/{resource_name}.json"
    proof, resource = selected_json(records, proof_path), selected_json(records, resource_path)
    if not isinstance(proof, dict):
        return {"state": "not_recorded", "evidence": None, "resource": resource_path if resource else None,
                "coherent_passed": False, "current_distribution_passed": False}
    runtime = proof.get("runtime", {})
    scenario = proof.get("scenario", {})
    if not isinstance(runtime, dict): runtime = {}
    if not isinstance(scenario, dict): scenario = {}
    checks = scenario.get("checks", proof.get("checks", []))
    if not isinstance(checks, list): checks = []
    passed_checks = sum(isinstance(check, dict) and check.get("passed") is True for check in checks)
    proof_passed = proof.get("passed") is True
    runtime_completed = runtime.get("completed") is True
    runtime_passed = runtime.get("passed") is True
    scenario_passed = scenario.get("passed") is True if scenario else proof_passed
    exceptions = proof.get("exceptions", [])
    proof_consistent = proof_passed and runtime_completed and runtime_passed and scenario_passed
    proof_consistent = proof_consistent and bool(checks) and passed_checks == len(checks) and not exceptions
    resource_clean = (isinstance(resource, dict) and exit_code(resource) == 0
                      and resource.get("job_active_processes_at_finish") == 0
                      and resource.get("abort_reason") is None
                      and resource.get("job_limit_terminated_processes", 0) == 0)
    resource_after_proof = (resource_path in records
                            and records[resource_path]["source_mtime_ns"] >= records[proof_path]["source_mtime_ns"])
    command = resource.get("command", []) if isinstance(resource, dict) else []
    command_matches_proof = group in " ".join(str(part).replace("\\", "/") for part in command)
    coherent = bool(resource_clean and resource_after_proof and command_matches_proof)
    artifacts, unmatched_routes = [], []
    for artifact in proof.get("served_artifacts", []):
        route = artifact.get("route")
        path = served_path(route, group)
        if not path or path not in records:
            unmatched_routes.append(route)
            continue
        record = records[path]
        artifacts.append({"route": route, "staged": path, "observed_sha256": artifact.get("sha256"),
                          "actual_sha256": record["staged_sha256"],
                          "matched": artifact.get("sha256") == record["staged_sha256"]
                                     and artifact.get("bytes") == record["staged_bytes"] and artifact.get("status") == 200})
    observed_routes = {row["route"] for row in artifacts}
    required_routes = {"/native/tome-native.mjs", "/native/tome-native.wasm", "/vfs/adapter/real-core-probe.lua"}
    if group in {"semantic-browser-probe", "japanese-save-resume-probe", "play-mobile-probe", "shared-local-probe"}:
        required_routes.add("/semantic/tome_text_wasm.wasm")
    if group in {"retained-browser-probe", "ui-roundtrip-probe", "japanese-save-resume-probe", "play-mobile-probe", "shared-local-probe"}:
        required_routes.add("/retained/tome_core_environment.wasm")
        required_routes.update(RUST_BROWSER_ROUTES)
    if group == "ui-roundtrip-probe":
        required_routes.add("/ui-roundtrip-browser.html")
    if group in {"japanese-save-resume-probe", "play-mobile-probe", "shared-local-probe"}:
        required_routes.update({"/play-browser.html", "/play-browser.mjs"})
    required_artifacts_present = required_routes.issubset(observed_routes)
    artifact_match = (bool(artifacts) and required_artifacts_present and not unmatched_routes
                      and all(row["matched"] for row in artifacts))
    cli_launch = None
    if group == "shared-local-probe":
        launch_path, cli_path = "kernel/evidence/shared-local-probe/cli-launch-evidence.json", "kernel/bootstrap/run-local.mjs"
        launch = selected_json(records, launch_path)
        launch = launch if isinstance(launch, dict) else {}
        reported = launch.get("reported", {})
        reported = reported if isinstance(reported, dict) else {}
        printed_url, observed_url = urlsplit(reported.get("url", "")), urlsplit(proof.get("url", ""))
        cli_matched = (cli_path in records and launch.get("cli_sha256") == records[cli_path]["staged_sha256"]
                       and reported.get("mode") == "play" and reported.get("bind") == "127.0.0.1"
                       and reported.get("sourceCommit") == SOURCE_COMMIT and reported.get("assetBytesCopied") == 0
                       and printed_url.hostname == "127.0.0.1" and printed_url.scheme == "http"
                       and printed_url.netloc == observed_url.netloc and printed_url.path == "/play-browser.html")
        cli_launch = {"evidence": launch_path, "printed_url": reported.get("url"),
                      "observed_url": proof.get("url"), "matched": bool(cli_matched),
                      "scope": "Actual shared CLI printed origin; no proxy server"}
        artifact_match = artifact_match and bool(cli_matched)
    source_bundle = None
    if group in {"full-save-probe", "japanese-save-resume-probe"}:
        bundle_path = "kernel/save/source-manifest.json"
        bundle = selected_json(records, bundle_path)
        observed_bundle = scenario.get("manifest", {}).get("compatibility", {}).get("adapter_sources_sha256")
        actual_bundle = bundle.get("bundle_sha256") if isinstance(bundle, dict) else None
        matched_bundle = (isinstance(bundle, dict) and bundle.get("schema") == 1
                          and isinstance(actual_bundle, str) and re.fullmatch(r"[0-9a-f]{64}", actual_bundle) is not None
                          and observed_bundle == actual_bundle)
        source_bundle = {"metadata": bundle_path if bundle is not None else None,
                         "metadata_sha256": records[bundle_path]["staged_sha256"] if bundle_path in records else None,
                         "schema": bundle.get("schema") if isinstance(bundle, dict) else None,
                         "observed_sha256": observed_bundle, "actual_sha256": actual_bundle,
                         "matched": matched_bundle}
        artifact_match = artifact_match and matched_bundle
    localization = runtime.get("localization", {})
    if not isinstance(localization, dict): localization = {}
    diagnostics = localization.get("diagnostics", {}) if isinstance(localization, dict) else {}
    contracts = diagnostics.get("contracts", {}) if isinstance(diagnostics, dict) else {}
    coverage = scenario.get("coverageAfter", scenario.get("coverageBefore", localization.get("coverage", {})))
    japanese_hydration = None
    if group == "japanese-save-resume-probe":
        resumed = scenario.get("localization_resumed", {})
        if not isinstance(resumed, dict): resumed = {}
        font, player = resumed.get("font", {}), resumed.get("player", {})
        if not isinstance(font, dict): font = {}
        if not isinstance(player, dict): player = {}
        resumed_status = resumed.get("status", {})
        if not isinstance(resumed_status, dict): resumed_status = {}
        resume_report = scenario.get("resume_report", {})
        if not isinstance(resume_report, dict): resume_report = {}
        hydration = resume_report.get("hydration", {})
        if not isinstance(hydration, dict): hydration = {}
        saved_locale = scenario.get("manifest", {}).get("loader", {}).get("preferred_locale")
        locale_observed = (saved_locale == "ja_JP" and hydration.get("preferred_locale") == saved_locale
                           and hydration.get("hydrated_from_actual_verified_generation") is True
                           and hydration.get("enable_fresh_called") is False
                           and resumed_status.get("installed") is True and resumed_status.get("locale") == saved_locale)
        names_observed = (isinstance(player.get("name"), str) and player.get("get_name") == player["name"]
                          and resumed_status.get("external_player_names_protected") is True)
        font_observed = all(font.get(key) is True for key in (
            "japanese_package_loaded", "actual_font_exists", "matches_japanese_package", "break_text_all_character"))
        japanese_hydration = {"saved_locale": saved_locale, "hydration": hydration,
                              "locale_observed": locale_observed, "external_name_preserved": names_observed,
                              "genuine_japanese_font_observed": font_observed,
                              "current_distribution_verified": bool(proof_consistent and coherent and artifact_match
                                                                     and locale_observed and names_observed and font_observed),
                              "scope": "One original Japanese full Game/World checkpoint and finite continuation; English and language-selector reboot remain unverified"}
        coverage = resumed.get("coverage", coverage)
        contracts = resumed.get("contracts", contracts)
    return {"state": "passed" if proof_consistent and coherent else "partial_or_incoherent",
            "evidence": proof_path, "evidence_sha256": records[proof_path]["staged_sha256"],
            "resource": resource_path if resource else None,
            "resource_sha256": records[resource_path]["staged_sha256"] if resource_path in records else None,
            "resource_exit_code": exit_code(resource), "resource_finished_cleanly": bool(resource_clean),
            "resource_written_after_proof": bool(resource_after_proof), "resource_command_matches_proof": command_matches_proof,
            "proof_started_at": proof.get("started_at"), "proof_passed": proof_passed,
            "runtime_completed": runtime_completed, "runtime_passed": runtime_passed,
            "scenario_passed": scenario_passed, "checks_passed": passed_checks, "checks_total": len(checks),
            "exception_count": len(exceptions) if isinstance(exceptions, list) else None,
            "coherent_passed": bool(proof_consistent and coherent),
            "served_artifact_comparisons": artifacts, "unmapped_served_routes": unmatched_routes,
            "required_served_routes": sorted(required_routes), "required_served_artifacts_present": required_artifacts_present,
            "current_distribution_hashes_match": artifact_match,
            "current_distribution_passed": bool(proof_consistent and coherent and artifact_match),
            "versioned_save_source_bundle": source_bundle,
            "shared_local_cli_launch": cli_launch,
            "japanese_locale_hydration": japanese_hydration,
            "scope": scenario.get("scope", runtime.get("scope", proof.get("scope"))),
            "semantic_catalogue": runtime.get("semanticCatalogue"),
            "localization_coverage": coverage,
            "native_special_sources_exercised": contracts.get("verified_special", 0),
            "native_order_sources_exercised": contracts.get("verified_order", 0),
            "pngs": sorted(path for path in records if path.startswith(f"kernel/evidence/{group}/") and path.endswith(".png"))}


def verify_current_inputs(manifest):
    records = {}
    for record in manifest.get("files", []):
        relative = record["staged"]
        if relative in records:
            raise ValueError("Duplicate selected checkpoint path: " + relative)
        source = WORK / checked_relative(record["source"])
        staged = PORT / checked_relative(relative)
        if not source.resolve().is_relative_to(WORK.resolve()) or not staged.resolve().is_relative_to(PORT.resolve()):
            raise ValueError("Checkpoint input escaped its authorized tree")
        if not source.is_file() or not staged.is_file():
            raise FileNotFoundError("Selected checkpoint file is absent: " + relative)
        if digest_file(source) != record["source_sha256"] or digest_file(staged) != record["staged_sha256"]:
            raise RuntimeError("A source/staged input changed; rerun staging after jobs finish: " + relative)
        if source.stat().st_mtime_ns != record["source_mtime_ns"]:
            raise RuntimeError("Source metadata changed after staging: " + relative)
        records[relative] = record
    if not records:
        raise ValueError("Empty current checkpoint selection")
    return records


def status_from_evidence(records, manifest):
    milestones = {name: browser_summary(records, *paths) for name, paths in PROOFS.items()}
    semantic = milestones["semantic_browser"]
    full_save = milestones["full_save_resume"]
    ui = milestones["ui_roundtrip"]
    japanese_resume = milestones["japanese_save_resume"]
    japanese_hydration = japanese_resume.get("japanese_locale_hydration") or {}
    stages = {"retained_rust": summarize_stages(records, "kernel/evidence/retained-rust/results.json"),
              "semantic_wasm": summarize_stages(records, "kernel/evidence/semantic-validation/results.json"),
              "named_rng": summarize_stages(records, "kernel/evidence/named-rng/results.json"),
              "compound_rng": summarize_stages(records, "kernel/evidence/compound-rng/results.json")}
    link = selected_json(records, "kernel/evidence/native-link/result.json")
    supplement = selected_json(records, "localization/review/final-review/merge-final-review-result.json")
    catalog = selected_json(records, "localization/catalog-build-result.json")
    unit_counts = {}
    log_path = "kernel/evidence/retained-rust/rust-tests.log"
    if log_path in records:
        text = (PORT / log_path).read_text(encoding="utf-8")
        matches = re.findall(r"test result: ok\. (\d+) passed; (\d+) failed;", text)
        unit_counts = {"passed": sum(int(passed) for passed, _ in matches),
                       "failed": sum(int(failed) for _, failed in matches), "evidence": log_path,
                       "evidence_sha256": records[log_path]["staged_sha256"]}
    pending = list(OUTSTANDING)
    if japanese_hydration.get("current_distribution_verified") is True:
        pending.append("Saved English locale hydration and original language-selector VM reboot remain unverified; the current Japanese checkpoint proof is narrower evidence.")
    else:
        pending.append(LOCALE_HYDRATION_OUTSTANDING)
    if not semantic["current_distribution_passed"]:
        pending.append("Current semantic browser distribution requires coherent successful proof/resource reports and matching served hashes.")
    if not full_save["current_distribution_passed"]:
        pending.append("Current native graph save/new-VM resume scenario remains unverified by coherent current-distribution evidence.")
    if not ui["current_distribution_passed"]:
        pending.append("Current original-dialog UI round trip remains unverified by coherent current-distribution evidence.")
    if not japanese_resume["current_distribution_passed"]:
        pending.append("Current combined Japanese full-save/resume requires coherent measured reports, matching served source/binary hashes and the unchanged versioned save source bundle.")
    current_birth = any(proof["current_distribution_passed"] for proof in milestones.values())
    return {"schema_version": 3, "checkpoint_at_utc": datetime.now(timezone.utc).isoformat(),
            "upstream_version": "1.7.6", "upstream_commit": SOURCE_COMMIT,
            "last_milestone": "Manifest-selected retained C/Lua and Rust adapter local checkpoint; see scoped actual evidence",
            "complete": False, "full_port_complete": False,
            "web_delivery_scope": "Local HTML + Node with source-backed browser verification",
            "external_publication_requested": False, "site_project_id": None, "site_url": None,
            "external_site_created_or_published": False,
            "gameplay_implementation": "Retained original C/Lua rules behind application/presentation/platform adapter boundaries",
            "local_entrypoint": "port/kernel/bootstrap/run-local.mjs",
            "original_native_browser_link_passed": isinstance(link, dict) and exit_code(link) == 0,
            "current_distribution_birth_verified": current_birth,
            "semantic_native_integration_verified": semantic["current_distribution_passed"],
            "original_save_resume_verified": full_save["current_distribution_passed"],
            "original_dialog_round_trip_verified": ui["current_distribution_passed"],
            "original_japanese_save_resume_verified": japanese_hydration.get("current_distribution_verified") is True,
            "complete_translation_coverage_verified": False,
            "whole_campaign_and_full_game_flows_verified": False,
            "milestones": milestones, "recorded_source_checks": stages, "retained_rust_unit_results": unit_counts,
            "production_catalog_build": catalog, "reviewed_japanese_overlay": supplement,
            "current_distribution": {path: {"bytes": row["staged_bytes"], "sha256": row["staged_sha256"]}
                                     for path, row in records.items() if row["kind"] == "compiled_distribution"},
            "current_source_sha256": {path: row["staged_sha256"] for path, row in records.items()
                                      if row["kind"] in {"source", "inventory_tool"}},
            "staging_manifest_sha256": digest_file(PORT / "STAGING-MANIFEST.json"),
            "checkpoint_selected_files": len(records), "original_asset_archives_copied": False,
            "character_save_archives_copied": False, "git_index_commit_push_performed": False,
            "original_graph_save_archives_copied": False,
            "outstanding": pending, "optional_evidence_absent": manifest.get("optional_evidence_absent", [])}


def copy_selected(records, destination):
    for relative, record in records.items():
        source = PORT / checked_relative(relative)
        target = destination / checked_relative(relative)
        if not target.resolve().is_relative_to(destination.resolve()):
            raise ValueError("Checkpoint target escaped ToME port")
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + ".checkpoint.tmp")
        with source.open("rb") as incoming, temporary.open("wb") as outgoing:
            shutil.copyfileobj(incoming, outgoing, 128 * 1024)
        if digest_file(temporary) != record["staged_sha256"]:
            raise RuntimeError("Copied checkpoint hash mismatch")
        temporary.replace(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-only", action="store_true", help="Validate source/staging hashes and summarize; no filesystem writes")
    options = parser.parse_args()
    manifest = load_json(PORT / "STAGING-MANIFEST.json")
    if manifest.get("schema_version") != 1 or manifest.get("source_commit") != SOURCE_COMMIT:
        raise ValueError("Unexpected staging manifest/version")
    records = verify_current_inputs(manifest)
    status = status_from_evidence(records, manifest)
    summary = {"selected_files": len(records), "complete": False, "check_only": options.check_only,
               "browser_states": {key: value["state"] for key, value in status["milestones"].items()},
               "current_distribution_sha256": {key: value["sha256"] for key, value in status["current_distribution"].items()}}
    inconsistent_success = [name for name, proof in status["milestones"].items()
                            if proof.get("proof_passed") and not proof["coherent_passed"]]
    summary["successful_proofs_without_coherent_resource"] = inconsistent_success
    summary["current_semantic_distribution_verified"] = status["semantic_native_integration_verified"]
    if options.check_only:
        print(json.dumps(summary))
        return
    if inconsistent_success or not status["semantic_native_integration_verified"]:
        raise RuntimeError("Shared checkpoint requires coherent successful semantic/current-binary evidence; "
                           "finish the measured rerun and restage first: " + json.dumps(summary))
    expected = TOME.resolve()
    destination = (TOME / "port").resolve()
    if destination.parent != expected or not expected.is_dir():
        raise ValueError("Existing authorized ToME/port destination required")
    previous = TOME / "STATUS.json"
    if previous.is_file():
        prior = load_json(previous)
        status["previous_status_sha256"] = digest_file(previous)
        stable_keys = {"upstream", "source_archive_sha256", "source_archive", "source_provenance",
                       "code_license", "asset_licenses", "licenses", "acquisition_provenance"}
        status["preserved_acquisition_provenance"] = {key: value for key, value in prior.items() if key in stable_keys}
    # All validation occurs before any shared write; only selected current files
    # are copied. Stale unselected tome-port targets/builds are never traversed.
    copy_selected(records, destination)
    verify_current_inputs(manifest)
    write_json(destination / "STAGING-MANIFEST.json", manifest)
    write_json(destination / "CURRENT-CHECKPOINT.json", status)
    write_json(TOME / "STATUS.json", status)
    print(json.dumps({**summary, "destination": str(destination), "status": str(TOME / "STATUS.json"),
                      "shared_checkpoint_saved": True, "git_write": False, "external_site": False}))


if __name__ == "__main__":
    main()
