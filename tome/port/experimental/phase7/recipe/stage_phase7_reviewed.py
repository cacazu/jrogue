"""Root-only explicit phase7 freeze/stage recipe; importing launches nothing.

No subprocess/network/build/test/browser/Git/deletion/default activation. Freeze
writes owned metadata only; stage writes only the new isolated phase7 child.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
from derive_gameflow_reviewed import derive_gameflow_profiles

OWN = Path(__file__).resolve().parent
WORK = OWN.parent
SELECTION = OWN / "selection-reviewed.json"
COMMIT = "624a67329fe2ad440c5b344785a9c73fcf22ae63"
CHUNK = 128 * 1024


def relative(value):
    p = PurePosixPath(value.replace("\\", "/"))
    if p.is_absolute() or not p.parts or any(x in ("", ".", "..") or ":" in x for x in p.parts):
        raise ValueError("Unconfined relative path: " + value)
    return Path(*p.parts)


def inside(path, root):
    return path.resolve().is_relative_to(root.resolve())


def digest(path):
    h, count = hashlib.sha256(), 0
    with path.open("rb") as stream:
        while chunk := stream.read(CHUNK):
            h.update(chunk); count += len(chunk)
    return {"bytes": count, "sha256": h.hexdigest()}


def blob_digest(data):
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def same(a, b):
    return a["bytes"] == b["bytes"] and a["sha256"] == b["sha256"]


def read_json(path):
    if path.stat().st_size > 16 * 1024 * 1024:
        raise ValueError("Only bounded metadata may be parsed: " + str(path))
    return json.loads(path.read_bytes().decode("utf-8"))


def encode(data):
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def reject_links(path, root):
    if not inside(path, root):
        raise ValueError("Path escaped reviewed root: " + str(path))
    current = path
    while current != root:
        if current.is_symlink() or current.is_junction():
            raise ValueError("Symlink/junction is not a reviewed dependency: " + str(current))
        current = current.parent
        if current == current.parent:
            raise ValueError("Nonliteral reviewed root")


def target_guard(port, target):
    resolved_port = port.resolve()
    if target.resolve() != resolved_port / "experimental" / "phase7" or not inside(target, port):
        raise ValueError("Output escaped literal port/experimental/phase7")
    reject_links(target, port)


def configured():
    s = read_json(SELECTION)
    if s["source_commit"] != COMMIT or s["target_relative"] != "port/experimental/phase7":
        raise ValueError("Only authorized separate phase7 is supported")
    if any(s[k] is not False for k in ("complete", "full_renderer_ready", "default_activation", "external_sites_requested")):
        raise ValueError("Incomplete experimental/local-only scope is required")
    if s["selected_profiles"] != ["gameflow", "stairs"] or s["baseline_catalog_ids"] != 24826:
        raise ValueError("Only original baseline-catalog gameflow/stairs profiles are selected")
    tome = Path(s["tome_root"]).resolve()
    if tome != Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome").resolve():
        raise ValueError("Authorized ToME root differs")
    port, phase6, target = tome / "port", tome / "port/experimental/phase6", tome / relative(s["target_relative"])
    target_guard(port, target)
    sources, targets = set(), set()
    for row in s["files"]:
        source, destination = row["source"], row["target"]
        relative(source); relative(destination)
        if source in sources or destination in targets:
            raise ValueError("Duplicate explicit selection")
        if Path(source).suffix.lower() in (".zip", ".teag", ".teaw", ".team", ".teae", ".bz2", ".a", ".o") or "target" in relative(source).parts:
            raise ValueError("Archives/savefiles/targets/objects are excluded")
        sources.add(source); targets.add(destination)
    for source, wanted in s["pinned_current_sources"].items():
        if digest(WORK / relative(source))["sha256"] != wanted:
            raise ValueError("Reviewed current source changed: " + source)
    for source, expected in s["held_recipe_guard"].items():
        if not same(digest(WORK / relative(source)), expected):
            raise ValueError("Held phase7 recipe changed: " + source)
    return s, tome, port, phase6, target


def checked_files(root, rows, target_key, bytes_key="bytes", sha_key="sha256"):
    result = {}
    for row in rows:
        key = row[target_key]
        file = root / relative(key)
        reject_links(file, root)
        if not file.is_file() or key in result:
            raise ValueError("Missing/duplicate preserved leaf: " + key)
        actual = digest(file)
        if not same(actual, {"bytes": row[bytes_key], "sha256": row[sha_key]}):
            raise ValueError("Preserved checkpoint differs from manifest: " + key)
        result[key] = actual
    return result


def preserved_guard(s, tome, port, phase6):
    default_manifest = read_json(port / "STAGING-MANIFEST.json")
    if len(default_manifest["files"]) != s["expected_default_file_count"]:
        raise ValueError("Default496 scope differs")
    default = checked_files(port, default_manifest["files"], "staged", "staged_bytes", "staged_sha256")
    default_metadata = {key: digest(tome / relative(key)) for key in ("port/STAGING-MANIFEST.json", "port/CURRENT-CHECKPOINT.json", "STATUS.json")}
    p6 = read_json(phase6 / "PHASE6-MANIFEST.json")
    if len(p6["files"]) != s["expected_phase6_frozen_count"] or p6["complete"] is not False or p6["default_activation"] is not False:
        raise ValueError("Existing immutable phase6 scope differs")
    p6_files = checked_files(phase6, p6["files"], "target")
    if digest(phase6 / "APPROVED-FREEZE.json")["sha256"] != p6["approved_freeze_sha256"]:
        raise ValueError("Existing phase6 approved freeze changed")
    validation = read_json(phase6 / "RUNTIME-VALIDATION.json")
    if validation["portable_wrapper_and_rebased_vfs_runtime_verified"] is not True or validation["counted_once_total_checks"] != 346:
        raise ValueError("Existing phase6 separate runtime record differs")
    runtime = checked_files(phase6, validation["copied_files"], "target")
    if len(runtime) != 40:
        raise ValueError("Existing phase6 runtime archive selection differs")
    metadata = {key: digest(phase6 / key) for key in ("PHASE6-MANIFEST.json", "APPROVED-FREEZE.json", "RUNTIME-VALIDATION.json", "STATUS.json")}
    return {"default": {"files": default, "metadata": default_metadata, "count": len(default)},
            "phase6": {"files": p6_files, "runtime_files": runtime, "metadata": metadata,
                       "count": len(p6_files), "runtime_count": len(runtime), "approved_freeze_sha256": p6["approved_freeze_sha256"]}}


def clean_resource(file):
    d = read_json(file)
    for key, expected in {"exit_code": 0, "job_active_processes_at_finish": 0, "job_limit_terminated_processes": 0, "abort_reason": None, "other_games_affected": False}.items():
        if d.get(key, "missing") != expected:
            raise ValueError("Measured resource is not clean: " + key)
    return {key: d.get(key) for key in ("exit_code", "job_active_processes_at_finish", "job_limit_terminated_processes", "abort_reason", "other_games_affected", "elapsed_seconds", "kernel_peak_job_committed_bytes", "command", "executable_history_complete")}


def loc(namespace, file):
    relative(file)
    return {"namespace": namespace, "file": file}


def source_reference(key, s, port, phase6, guard, expected=None):
    selected = {r["source"]: r["target"] for r in s["files"]}
    actual = digest(WORK / relative(key))
    if expected is not None and not same(actual, expected):
        raise ValueError("Source identity differs from compiled identity: " + key)
    if key in selected:
        return loc("phase7", selected[key]), actual
    for namespace, root, manifest, source_key, target_key in [
        ("phase6", phase6, read_json(phase6 / "PHASE6-MANIFEST.json")["files"], "source", "target"),
        ("port", port, read_json(port / "STAGING-MANIFEST.json")["files"], "source", "staged")]:
        for row in manifest:
            if row.get(source_key, "").replace("\\", "/") == key:
                target = row[target_key]
                stored = guard["phase6"]["files"][target] if namespace == "phase6" else guard["default"]["files"][target]
                if same(stored, actual):
                    return loc(namespace, target), actual
    raise ValueError("Source has no byte-identical explicit portable reference: " + key)


def source_availability(s, tome, port, phase6, guard):
    key = "native-core-work/physical-input-compat-game-flow-build/link-result.json"
    linked = read_json(WORK / relative(key))
    if linked.get("exit") != 0 or linked.get("profile") != "physical-input-compat-game-flow":
        raise ValueError("Distinct gameflow native link was not successful")
    seams = []
    for row in linked["seam_sources"]:
        file = Path(row["source"]).resolve()
        if not inside(file, WORK):
            raise ValueError("Unexpected native source root")
        source = file.relative_to(WORK).as_posix()
        actual = digest(file)
        if actual["sha256"] != row["sha256"]:
            raise ValueError("Native source changed since compile: " + source)
        reference, _ = source_reference(source, s, port, phase6, guard, actual)
        seams.append({"source": source, "compiled_sha256": row["sha256"], "current_identity": actual, "portable_reference": reference,
                      "historical_object_path_only": row.get("object"), "objects_copied": False})
    if len(seams) != 24:
        raise ValueError("Expected exact24 current compiled native seams")
    dependencies = []
    for role, keys in (("authored_native_header", s["required_authored_headers"]), ("physical_rust_source", s["required_physical_rust_sources"]), ("baseline_rebuild_metadata", s["native_rebuild_metadata"])):
        for source in keys:
            reference, actual = source_reference(source, s, port, phase6, guard)
            dependencies.append({"role": role, "source": source, "identity": actual, "portable_reference": reference})
    return {"schema_version": 1, "source_commit": COMMIT, "link_report": key, "native_seams": seams, "native_seam_count": len(seams),
            "dependencies": dependencies, "pristine_original_source_relative_to_phase7": "../../../upstream/t-engine4-src-1.7.6",
            "unpacked_original_lua_relative_to_phase7": "../../../upstream/unpacked",
            "upstream_archive_sha256": "989dea00803f8cdcade024f4647d480bb1ac0d437c254292c07549c272a4680c",
            "original_code_and_third_party_license_notices_retained_in_pristine_source": True,
            "new_C_Rust_JS_Lua_sources_preserved_or_explicitly_referenced": True,
            "source_binary_obligation_scope": "Local source tree with exact authored sources/headers; no binary-only external distribution authorized",
            "portable_rebuild_verified": False, "isolated_rebuild_projection_required": True,
            "original_archives_assets_objects_copied": False, "complete": False}


def base_configs(s, derived):
    selected = {r["source"]: r["target"] for r in s["files"]}
    def owned(file):
        return loc("phase7", selected[file])
    routes = {route: loc("phase7", "portable/served" + route) for route in derived}
    for ext in ("mjs", "wasm"):
        routes["/native/tome-native." + ext] = loc("phase7", "dist/gameflow/tome-native." + ext)
    for route, file in {
        "/retained/tome_core_environment.wasm": "dist/retained/tome_core_environment.wasm",
        "/semantic/tome_text_wasm.wasm": "dist/semantic-text/tome_text_wasm.wasm",
        "/physical/tome_physical_input.wasm": "dist/physical-rust/tome_physical_input.wasm",
    }.items():
        routes[route] = loc("phase6", file)
    for name in ("retained-browser-session.mjs", "retained-core-adapter.mjs", "original-native-core.mjs", "diagnostic-renderer.mjs"):
        routes["/rust/" + name] = loc("port", "retained/browser/" + name)
    routes["/bootstrap/browser_vfs_mounts.mjs"] = loc("port", "kernel/bootstrap/browser_vfs_mounts.mjs")
    for name in ("source-manifest.json", "checkpoint_store.mjs", "baseline_flow.mjs", "native_archive_validator.mjs"):
        routes["/checkpoint/" + name] = loc("port", "kernel/save/" + name)
    for language in ("en", "ja"):
        routes["/checkpoint/i18n/" + language + ".json"] = loc("port", "kernel/save/i18n/" + language + ".json")
    physical = "rust-platform-input-work/"
    for name in ("physical-input-wasm.mjs", "original-physical-input.mjs"):
        routes["/physical/" + name] = owned(physical + "browser/" + name)
    routes["/physical/focused-input-host-base.mjs"] = owned(physical + "browser/focused-input-host.mjs")
    routes["/physical/native-canvas-contract.mjs"] = owned(physical + "audit-new/resize-candidate/native-canvas-contract.mjs")
    for name in ("native-game-flow-probe.mjs", "visible-flow-observer.lua", "observer-provenance.json"):
        routes["/game-flow/" + name] = owned(physical + "audit-new/game-flow-native-candidate/" + name)
    for language in ("en", "ja"):
        routes["/game-flow/i18n/" + language + ".json"] = owned(physical + "audit-new/game-flow-native-candidate/" + language + ".json")
        routes["/textbox/i18n/" + language + ".json"] = owned(physical + "audit-new/textbox-native-candidate/" + language + ".json")
    routes["/textbox/native-textbox-fixture.mjs"] = owned(physical + "audit-new/textbox-native-candidate/native-textbox-fixture.mjs")
    routes["/textbox/native-textbox-fixture.lua"] = owned("native-core-work/textbox-web/native-textbox-fixture-trace.lua")
    routes["/"] = routes["/physical-play-browser.html"]
    routes["/index.html"] = routes["/physical-play-browser.html"]
    profile = {"entry": s["proof"]["historical_entry"], "report_expression": "window.tomePlayReport", "native_root": "dist/gameflow",
               "manifest_source": "native-core-work/textbox-web/browser-vfs-inputs.json", "manifest": "portable/vfs/gameflow.json", "routes": routes,
               "complete": False, "portable_runtime_revalidated": False, "historical_scenario_checks": 40,
               "reviewed_gameflow_observer_cache_contract_verified": s["reviewed_gameflow_observer_cache_contract_verified"]}
    return {"schema_version": 1, "source_commit": COMMIT, "profiles": {"gameflow": profile}, "complete": False,
            "full_renderer_ready": False, "default_activation": False, "local_only": True, "baseline_catalog_ids": 24826,
            "shared_port_relative": "../..", "phase6_relative": "../phase6"}


def configs(s, derived_profiles):
    common = base_configs(s, derived_profiles["gameflow"])
    selected = {r["source"]: r["target"] for r in s["files"]}
    profiles = {}
    for name in ("gameflow", "stairs"):
        profile = json.loads(json.dumps(common["profiles"]["gameflow"]))
        for route in derived_profiles[name]:
            profile["routes"][route] = loc("phase7", "portable/served/" + name + route)
        profile["routes"]["/"] = profile["routes"]["/physical-play-browser.html"]
        profile["routes"]["/index.html"] = profile["routes"]["/physical-play-browser.html"]
        profile["manifest"] = "portable/vfs/" + name + ".json"
        profile["historical_scenario_checks"] = 40 if name == "gameflow" else 11
        profile["server_source"] = "native-core-work/gameflow-web/" + ("cache-corrected-server.mjs" if name == "gameflow" else "stairs-server.mjs")
        profile["navigation_profile"] = name == "gameflow"
        profile["reviewed_gameflow_observer_cache_contract_verified"] = name == "gameflow"
        profile["production_visibility_or_occupancy_verified"] = False
        profile["player_pointer_identity_verified"] = False
        if name == "gameflow":
            profile["routes"]["/game-flow/visible-flow-observer.lua"] = loc("phase7", selected["mechanics-audit-work/visible-road-continuation/visible-flow-observer-cache-corrected.lua"])
            profile["routes"]["/game-flow/observer-provenance.json"] = loc("phase7", selected["native-core-work/gameflow-web/cache-observer-binding.json"])
        profiles[name] = profile
    common["profiles"] = profiles
    return common


def rebase_vfs(s, tome, port, phase6, target, guard):
    source_key = "native-core-work/textbox-web/browser-vfs-inputs.json"
    source = WORK / relative(source_key)
    data, mapping = read_json(source), {}
    output = target / "portable/vfs/gameflow.json"
    def translated(raw):
        original = Path(raw)
        original = original.resolve() if original.is_absolute() else (source.parent / original).resolve()
        if inside(original, tome / "upstream"):
            destination, role = original, "read_only_pristine_upstream"
        elif inside(original, WORK):
            key = original.relative_to(WORK).as_posix()
            if original.is_file():
                reference, _ = source_reference(key, s, port, phase6, guard)
                root = {"port": port, "phase6": phase6, "phase7": target}[reference["namespace"]]
                destination, role = root / relative(reference["file"]), "explicit_source_reference"
            elif original.is_dir():
                parts = original.relative_to(WORK).parts
                if parts[0] not in s["shared_vfs_prefixes"]:
                    raise ValueError("Unreviewed VFS directory")
                portable = PurePosixPath(s["shared_vfs_prefixes"][parts[0]]) / PurePosixPath(*parts[1:])
                key = portable.as_posix()
                leaves = [k for k in guard["default"]["files"] if k.startswith(key.rstrip("/") + "/")]
                if not leaves:
                    raise ValueError("Shared VFS directory has no explicit preserved leaf")
                # Verify every source leaf actually indexed by the guarded default directory.
                for leaf in leaves:
                    original_leaf = original / Path(leaf).relative_to(Path(key))
                    if not original_leaf.is_file() or not same(digest(original_leaf), guard["default"]["files"][leaf]):
                        raise ValueError("Shared directory source differs: " + leaf)
                destination, role = port / relative(key), "preserved_default_directory"
            else:
                raise ValueError("Missing original VFS source")
        else:
            raise ValueError("VFS locator outside reviewed ToME roots")
        if not original.exists() or original.is_symlink() or original.is_junction():
            raise ValueError("Missing/unreviewed VFS input")
        locator = os.path.relpath(destination, output.parent).replace("\\", "/")
        mapping[str(original)] = {"scope": role, "portable_physical": locator}
        return locator
    def visit(obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key in ("physical", "staged", "original") and isinstance(value, str):
                    obj[key] = translated(value)
                else:
                    visit(value)
        elif isinstance(obj, list):
            for value in obj:
                visit(value)
    visit(data)
    data["phase7_portable_provenance"] = {"source_manifest": source_key, "source_identity": digest(source), "source_commit": COMMIT,
        "physical_locators_only_rebased": True, "virtual_paths_and_mount_order_retained": True, "legacy_bytes_fields_not_promoted_to_current_identity": True,
        "upstream_assets_copied": False, "portable_runtime_revalidated": False, "complete": False}
    return encode(data), mapping


def materialize(s, tome, port, phase6, target, guard):
    derived = derive_gameflow_profiles(WORK)
    config = configs(s, derived)
    generated = {"portable/served/" + name + route: data for name, bodies in derived.items() for route, data in bodies.items()}
    vfs, mapping = rebase_vfs(s, tome, port, phase6, target, guard)
    availability = source_availability(s, tome, port, phase6, guard)
    generated.update({"portable/profile-config.json": encode(config),
        "portable/profile_server.mjs": (OWN / "profile_server_reviewed.mjs").read_bytes(),
        "portable/run-local.mjs": (OWN / "run-local-reviewed.mjs").read_bytes(),
        "SOURCE-AVAILABILITY.json": encode(availability)})
    for name in ("gameflow", "stairs"):
        generated["portable/vfs/" + name + ".json"] = vfs
        generated["portable/" + name + "_server.mjs"] = ("// SPDX-License-Identifier: GPL-3.0-or-later\nimport {createPhase7Server} from './profile_server.mjs';\nexport function createTomeServer(options={}){return createPhase7Server('" + name + "',options);}\n").encode("utf-8")
    return generated, config, mapping, availability


def observer_contract(s, tome):
    binding_file = WORK / "native-core-work/gameflow-web/cache-observer-binding.json"
    binding = read_json(binding_file)
    lua = WORK / "mechanics-audit-work/visible-road-continuation/visible-flow-observer-cache-corrected.lua"
    identity = digest(lua)
    if identity["bytes"] != binding["bytes"] or identity["sha256"] != binding["derivative_sha256"]:
        raise ValueError("Corrected observer binding differs")
    if binding["exact_reversal_passed"] is not True or binding["negative_or_missing_cache_is_unknown"] is not True or binding["complete_visibility_or_occupancy_claim"] is not False or binding["cache_result_read"] != "raw numeric index 1":
        raise ValueError("Corrected cache observer weakened original unknown/visibility policy")
    original = Path(binding["original_cache_rule"]["path"]).resolve()
    if not inside(original, tome / "upstream") or not same(digest(original), binding["original_cache_rule"]):
        raise ValueError("Official original Actor cache schema identity changed")
    provenance_file = WORK / "native-core-work/gameflow-web/CACHE-PROFILE-PROVENANCE.json"
    provenance = read_json(provenance_file)
    if any(provenance[k] is not True for k in ("reversal_exact_bytes", "native_pair_unchanged", "original_code_unchanged")):
        raise ValueError("Corrected profile provenance differs")
    for key, source in (("input_sha256", "stairs-server.mjs"), ("output_sha256", "cache-corrected-server.mjs"), ("binding_sha256", "cache-observer-binding.json")):
        if digest(WORK / "native-core-work/gameflow-web" / source)["sha256"] != provenance[key]:
            raise ValueError("Accepted profile derivative source changed")
    stairs = read_json(WORK / "native-core-work/gameflow-web/STAIRS-V3-PROVENANCE.json")
    for row in stairs["files"]:
        if row["reversal_exact_bytes"] is not True or digest(WORK / "native-core-work/gameflow-web" / row["output"])["sha256"] != row["output_sha256"]:
            raise ValueError("Stairs-v3 derivative source changed")
    return {"corrected_observer_identity": identity, "binding_identity": digest(binding_file), "source_rule": binding["original_cache_rule"],
        "cache_result_read": "raw numeric index 1", "negative_or_missing_cache_is_unknown": True,
        "production_visibility_or_occupancy_verified": False, "player_pointer_identity_verified": False,
        "road_profile_corrected": True, "stairs_profile_original_observer_preserved_without_adjacent_absence_claim": True,
        "profile_provenance_identity": digest(provenance_file)}


def historical_proof(s, port, phase6, guard, generated, config):
    reviews = []
    reverse = {r["target"]: r["source"] for r in s["files"]}
    for scope in s["proofs"]:
        file = WORK / relative(scope["source"])
        proof = read_json(file)
        runtime, scenario = proof["runtime"], proof["scenario"]
        checks = scenario["checks"]
        if proof.get("passed") is not True or proof.get("exceptions") != [] or runtime.get("completed") is not True or runtime.get("passed") is not True or scenario.get("passed") is not True:
            raise ValueError("Accepted original browser proof did not pass cleanly")
        if len(checks) != scope["expected_scenario_checks"] or any(c.get("passed") is not True for c in checks):
            raise ValueError("Only actual40 road /11 stairs checks may be asserted")
        profile = config["profiles"][scope["profile"]]
        routes, artifacts = profile["routes"], {}
        for artifact in proof["served_artifacts"] + scenario.get("served_artifacts", []):
            route = artifact["route"]
            if artifact.get("status", 200) != 200:
                raise ValueError("Historical served artifact was unsuccessful")
            if route.startswith("/vfs/"):
                original = WORK / "native-core-work/textbox-web/browser-vfs-inputs.json"
                rows = [r for r in read_json(original)["inputs"] if r["virtual"] == route[len("/vfs"):]]
                if len(rows) != 1 or rows[0]["type"] != "file":
                    raise ValueError("Unbound accepted VFS leaf")
                path = Path(rows[0]["physical"])
                if not path.is_absolute(): path = original.parent / path
                actual, location = digest(path), {"namespace": "vfs", "virtual": rows[0]["virtual"]}
            else:
                location = routes.get(route)
                if location is None: raise ValueError("Unbound accepted served route: " + route)
                namespace, key = location["namespace"], location["file"]
                if key in generated and namespace == "phase7": actual = blob_digest(generated[key])
                elif namespace == "phase7": actual = digest(WORK / relative(reverse[key]))
                else: actual = guard["default"]["files"][key] if namespace == "port" else guard["phase6"]["files"][key]
            if not same(actual, artifact): raise ValueError("Portable candidate differs from accepted served bytes: " + route)
            if route in artifacts and not same(artifacts[route], actual): raise ValueError("Conflicting accepted served identity")
            artifacts[route] = actual | {"portable_location": location}
        resource = WORK / relative(scope["resource"])
        reviews.append({"profile": scope["profile"], "evidence": scope["source"], "evidence_identity": digest(file), "resource": scope["resource"],
            "resource_identity": digest(resource), "resource_result": clean_resource(resource), "scenario_checks_counted_once": len(checks),
            "historical_url": proof.get("url"), "active_server_url": None, "server_source": profile["server_source"],
            "server_identity": digest(WORK / relative(profile["server_source"])), "served_artifacts_current_bytes_match": artifacts,
            "unrecorded_routes_are_current_frozen_candidates_only": True, "portable_CLI_verified": False,
            "accepted_original_numeric_cache_contract": scope["accepted_observer_numeric_cache_contract"],
            "production_visibility_or_occupancy_verified": False, "player_pointer_identity_verified": False,
            "campaign_combat_death_and_full_renderer_verified": False,
            "stairs_transition_verified": scope["profile"] == "stairs",
            "historical_source_provenance": "Original source-only provenance flags retained; separate accepted evidence records actual40/11 scope"})
    if {r["profile"]: r["scenario_checks_counted_once"] for r in reviews} != {"gameflow": 40, "stairs": 11}:
        raise ValueError("Explicit accepted profiles/counts differ")
    return reviews


def additional_historical_proofs(s):
    result = []
    for item in s.get("historical_additional_proofs", []):
        if item["accepted_for_portable_activation"] is not False:
            raise ValueError("Additional stairs-v2 evidence is historical, not an accepted portable activation proof")
        evidence = WORK / relative(item["source"])
        d = read_json(evidence)
        checks = d["scenario"]["checks"]
        if len(checks) != item["scenario_checks"] or d.get("passed") is not True or any(c.get("passed") is not True for c in checks):
            raise ValueError("Historical additional proof scope differs")
        result.append(item | {"evidence_identity": digest(evidence), "resource_identity": digest(WORK / relative(item["resource"])),
            "resource_result": clean_resource(WORK / relative(item["resource"])), "current_scenario_source_matches_historical_proof": "not established",
            "portable_CLI_verified": False})
    return result


def prepare(selection_sha):
    s, tome, port, phase6, target = configured()
    if digest(SELECTION)["sha256"] != selection_sha:
        raise ValueError("Reviewed selection differs")
    guard = preserved_guard(s, tome, port, phase6)
    rows = []
    for row in s["files"]:
        source = WORK / relative(row["source"])
        reject_links(source, WORK)
        if not source.is_file():
            raise ValueError("Explicit source missing: " + row["source"])
        rows.append(row | digest(source))
    generated, config, mapping, availability = materialize(s, tome, port, phase6, target, guard)
    if {r["target"] for r in rows}.intersection(generated):
        raise ValueError("Derived file collides with explicit selected target")
    proof = historical_proof(s, port, phase6, guard, generated, config)
    link_resource = clean_resource(WORK / "native-core-work/gameflow-native-link-resource.json")
    return {"schema_version": 1, "source_commit": COMMIT, "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "selection_identity": digest(SELECTION), "target": str(target.resolve()), "files": rows,
            "generated": {key: blob_digest(value) for key, value in generated.items()}, "preserved_guard": guard,
            "vfs_provenance": mapping, "source_availability": availability, "historical_proof": proof, "observer_contract": observer_contract(s, tome), "held_recipe_guard": s["held_recipe_guard"], "additional_historical_proofs": additional_historical_proofs(s), "native_link_resource": link_resource,
            "complete": False, "full_renderer_ready": False, "default_activation": False, "portable_CLI_verified": False,
            "external_sites_requested": False, "external_site_created_or_published": False,
            "outstanding": ["Root approval of concrete selection/freeze precedes isolated staging.",
                "Corrected numeric-index cache schema is verified; negative/missing remains unknown and production visibility/occupancy remains incomplete.",
                "Root must measure both actual portable gameflow/stairs CLI/browser profiles after path rebasing.",
                "Menu/mobile/save regression is pending; no untested independent textbox/fullframe profile is enabled.",
                "Trusted visible-road movement and spawn-stair exit were proved; campaign/combat/death remain unproved.",
                "Full Rust renderer resource leases/uniforms/FBO/foreign callback continuation and production turn barriers remain incomplete.",
                "Rebuilding GPL native binary in a new isolated build projection remains unverified; originals, authored sources and headers stay available locally."]}


def write_new(path, data, root):
    reject_links(path, root)
    path.parent.mkdir(parents=True, exist_ok=True)
    reject_links(path, root)
    with path.open("xb") as stream:
        stream.write(data)


def stage(freeze_file, approved_sha):
    if digest(freeze_file)["sha256"] != approved_sha:
        raise ValueError("Root-approved freeze identity differs")
    frozen = read_json(freeze_file)
    s, tome, port, phase6, target = configured()
    if s["reviewed_gameflow_observer_cache_contract_verified"] is not True:
        raise ValueError("Accepted corrected cache contract is required before stage")
    if digest(SELECTION) != frozen["selection_identity"]:
        raise ValueError("Selection changed after root approval")
    guard = preserved_guard(s, tome, port, phase6)
    if guard != frozen["preserved_guard"]:
        raise ValueError("Default or phase6 changed after approval")
    for row in frozen["files"]:
        if not same(digest(WORK / relative(row["source"])), row):
            raise ValueError("Selected source changed after approval")
    generated, config, mapping, availability = materialize(s, tome, port, phase6, target, guard)
    if {key: blob_digest(value) for key, value in generated.items()} != frozen["generated"] or mapping != frozen["vfs_provenance"] or availability != frozen["source_availability"]:
        raise ValueError("Portable generated identity changed")
    if observer_contract(s, tome) != frozen["observer_contract"]:
        raise ValueError("Accepted observer contract changed after approval")
    if historical_proof(s, port, phase6, guard, generated, config) != frozen["historical_proof"]:
        raise ValueError("Historical proof binding changed")
    target_guard(port, target)  # Repeat immediately before the first write.
    if target.exists() and any(target.iterdir()):
        raise ValueError("Phase7 target is not empty; preserve the previous freeze")
    target.mkdir(parents=True, exist_ok=True)
    copied = []
    for row in frozen["files"]:
        source, destination = WORK / relative(row["source"]), target / relative(row["target"])
        reject_links(destination, target); destination.parent.mkdir(parents=True, exist_ok=True); reject_links(destination, target)
        with source.open("rb") as inp, destination.open("xb") as out:
            while chunk := inp.read(CHUNK):
                out.write(chunk)
        actual = digest(destination)
        if not same(actual, row):
            raise ValueError("Streamed exact copy verification failed")
        copied.append(row | actual)
    for key, value in generated.items():
        write_new(target / relative(key), value, target)
        copied.append({"target": key, "kind": "portable_derived_source_or_manifest", **blob_digest(value)})
    if preserved_guard(s, tome, port, phase6) != guard:
        raise ValueError("Default496/phase6216+runtime40 preservation failed after writes")
    write_new(target / "APPROVED-FREEZE.json", freeze_file.read_bytes(), target)
    manifest = {"schema_version": 1, "source_commit": COMMIT, "approved_freeze_sha256": approved_sha, "files": copied,
                "preserved_guard": guard, "historical_proof": frozen["historical_proof"], "additional_historical_proofs": frozen["additional_historical_proofs"], "source_availability": availability, "observer_contract": frozen["observer_contract"], "held_recipe_guard": frozen["held_recipe_guard"],
                "complete": False, "full_renderer_ready": False, "default_activation": False, "portable_CLI_verified": False,
                "default496_phase6216_runtime40_preserved_before_and_after": True, "selected_profiles": ["gameflow", "stairs"],
                "active_server_url": None, "current_server_liveness_claim": False, "archives_assets_savefiles_copied": 0,
                "external_sites_requested": False, "external_site_created_or_published": False, "outstanding": frozen["outstanding"][1:]}
    write_new(target / "PHASE7-MANIFEST.json", encode(manifest), target)
    write_new(target / "STATUS.json", encode({k: v for k, v in manifest.items() if k != "files"}), target)
    return {"destination": str(target), "files": len(copied), "default_preserved": 496, "phase6_preserved": 216, "phase6_runtime_preserved": 40,
            "complete": False, "portable_CLI_verified": False, "manifest_identity": digest(target / "PHASE7-MANIFEST.json")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    freeze = sub.add_parser("freeze")
    freeze.add_argument("--reviewed-selection-sha256", required=True)
    freeze.add_argument("--output", default=str(OWN / "reviewed-cache-stairs-freeze.json"))
    staged = sub.add_parser("stage")
    staged.add_argument("--freeze", required=True)
    staged.add_argument("--approved-freeze-sha256", required=True)
    args = parser.parse_args()
    if args.command == "freeze":
        output = Path(args.output).resolve()
        reject_links(output, OWN)
        frozen = prepare(args.reviewed_selection_sha256)
        write_new(output, encode(frozen), OWN)
        print(json.dumps({"freeze": str(output), **digest(output), "shared_written": False, "complete": False}))
    else:
        print(json.dumps(stage(Path(args.freeze).resolve(), args.approved_freeze_sha256)))


if __name__ == "__main__":
    main()
