"""Bounded, source-only recipe. Parent explicitly freezes, approves and stages.

No subprocess, network, build, browser, test, Git, default activation or deletion.
Only stage writes the isolated port/experimental/phase6 destination.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath

OWN = Path(__file__).resolve().parent
WORK = OWN.parent
SELECTION = OWN / "selection.json"
CHUNK = 128 * 1024
COMMIT = "624a67329fe2ad440c5b344785a9c73fcf22ae63"
MIME = {".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".wasm": "application/wasm"}


def relative(value):
    p = PurePosixPath(value.replace("\\", "/"))
    if p.is_absolute() or not p.parts or any(x in ("", ".", "..") or ":" in x for x in p.parts):
        raise ValueError("Unconfined relative path: " + value)
    return Path(*p.parts)


def inside(path, root):
    return path.resolve().is_relative_to(root.resolve())


def digest(path):
    h = hashlib.sha256()
    count = 0
    with path.open("rb") as stream:
        while chunk := stream.read(CHUNK):
            h.update(chunk)
            count += len(chunk)
    return {"bytes": count, "sha256": h.hexdigest()}


def blob_digest(data):
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def read_json(path):
    if path.stat().st_size > 16 * 1024 * 1024:
        raise ValueError("Only bounded metadata may be parsed: " + str(path))
    return json.loads(path.read_bytes().decode("utf-8"))


def encode_json(data):
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encode_json(data))


def same_digest(a, b):
    return a["bytes"] == b["bytes"] and a["sha256"] == b["sha256"]


def guard_target(port, target):
    # Compare to the literal child of resolved port, never resolve both sides.
    resolved_port = port.resolve()
    expected = resolved_port / "experimental" / "phase6"
    resolved_target = target.resolve()
    if not resolved_target.is_relative_to(resolved_port) or resolved_target != expected:
        raise ValueError("Experimental target resolution escaped its authorized literal path")
    for entry in [port / "experimental", target]:
        if entry.is_symlink() or entry.is_junction():
            raise ValueError("Experimental output may not use a symlink or junction")


def configured():
    s = read_json(SELECTION)
    if s["source_commit"] != COMMIT or s["target_relative"] != "port/experimental/phase6":
        raise ValueError("Only the explicit independent phase6 destination is supported")
    if s["complete"] is not False or s["default_activation"] is not False:
        raise ValueError("Experimental/incomplete guard required")
    tome = Path(s["tome_root"]).resolve()
    if tome != Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome").resolve():
        raise ValueError("Authorized ToME root differs")
    port = tome / "port"
    target = tome / relative(s["target_relative"])
    guard_target(port, target)
    seen_source, seen_target = set(), set()
    for row in s["files"]:
        src, dst = row["source"], row["target"]
        relative(src); relative(dst)
        if src in seen_source or dst in seen_target:
            raise ValueError("Duplicate selection: " + src)
        seen_source.add(src); seen_target.add(dst)
        if Path(src).suffix.lower() in (".zip", ".teag", ".teaw", ".team", ".teae", ".bz2", ".o", ".a"):
            raise ValueError("Archive/save/object copies are excluded: " + src)
        if "target" in relative(src).parts and not (row["kind"] == "compiled_exact_artifact" and src.endswith(".wasm")):
            raise ValueError("Only the four explicit tested WASM target outputs are allowed")
        if any(x in src for x in s["excluded_pending_profiles"]):
            raise ValueError("Pending profile must have a separate root-approved selection")
    return s, tome, port, target


def default_guard(selection, tome, port):
    metadata = {"port/STAGING-MANIFEST.json": digest(port / "STAGING-MANIFEST.json"),
                "port/CURRENT-CHECKPOINT.json": digest(port / "CURRENT-CHECKPOINT.json"),
                "STATUS.json": digest(tome / "STATUS.json")}
    manifest = read_json(port / "STAGING-MANIFEST.json")
    rows = manifest["files"]
    if len(rows) != selection["expected_default_file_count"]:
        raise ValueError("Expected the preserved 496-file default checkpoint")
    guarded = {}
    for row in rows:
        key = row["staged"]
        file = port / relative(key)
        if not inside(file, port) or file.is_symlink() or not file.is_file():
            raise ValueError("Default file is missing/unconfined: " + key)
        actual = digest(file)
        expected = {"bytes": row["staged_bytes"], "sha256": row["staged_sha256"]}
        if not same_digest(actual, expected):
            raise ValueError("Default checkpoint already differs from its manifest: " + key)
        if key in guarded:
            raise ValueError("Duplicate default checkpoint locator")
        guarded[key] = actual
    return {"metadata": metadata, "files": guarded, "selected_files": len(guarded)}


def compat_script():
    # Node's raw read preserves CRLF; do not use Python read_text normalization.
    raw = (WORK / "rust-platform-input-work/integration-web/physical-play-browser.mjs").read_bytes().decode("utf-8")
    anchor = "      report.physical_prepare=physicalOwner.prepare();"
    probe = "    raw,rng,calls:()=>({...nativeCalls}),gateExclusion:()=>physicalOwner.gateExclusion(save)};"
    if raw.count(anchor) != 1 or raw.count(probe) != 1:
        raise ValueError("Exact tested planar startup/probe anchors changed")
    addition = anchor + "\n      report.planar_compat_install=module.ccall('tome_planar_client_array_refresh_install','number',[],[]);\n      if(report.planar_compat_install!==1)throw Error('render.error.client_array_contract');"
    return raw.replace(anchor, addition).replace(probe, "    planarCompat:()=>JSON.parse(module.ccall('tome_planar_client_array_refresh_status','string',[],[])),\n" + probe).encode("utf-8")


def clean_resource(path):
    report = read_json(path)
    wanted = {"exit_code": 0, "job_active_processes_at_finish": 0,
              "job_limit_terminated_processes": 0, "abort_reason": None, "other_games_affected": False}
    for key, expected in wanted.items():
        if key not in report or report[key] != expected:
            raise ValueError("Unclean measured job " + path.name + ": " + key)
    return {key: report[key] for key in wanted} | {
        "elapsed_seconds": report.get("elapsed_seconds"),
        "kernel_peak_job_committed_bytes": report.get("kernel_peak_job_committed_bytes"),
        "executable_history_complete": report.get("executable_history_complete"),
        "command": report.get("command"),
    }


def checked_group(value, name):
    if not isinstance(value, list) or not value or any(row.get("passed") is not True for row in value):
        raise ValueError("Historical proof check group is missing/failing: " + name)
    return len(value)


def loc(namespace, file):
    relative(file)
    return {"namespace": namespace, "file": file}


def profile_configs(selection):
    selected = {r["source"]: r["target"] for r in selection["files"]}
    def owned(file):
        if file not in selected:
            raise ValueError("Undeclared selected runtime source: " + file)
        return loc("phase6", selected[file])
    def shared(file):
        return loc("port", file)
    common = {
        "/retained/tome_core_environment.wasm": loc("phase6", "dist/retained/tome_core_environment.wasm"),
        "/semantic/tome_text_wasm.wasm": loc("phase6", "dist/semantic-text/tome_text_wasm.wasm"),
        "/bootstrap/browser_vfs_mounts.mjs": shared("kernel/bootstrap/browser_vfs_mounts.mjs"),
    }
    for name in ["retained-browser-session.mjs", "retained-core-adapter.mjs", "original-native-core.mjs", "diagnostic-renderer.mjs"]:
        common["/rust/" + name] = shared("retained/browser/" + name)
    for name in ["source-manifest.json", "checkpoint_store.mjs", "baseline_flow.mjs", "native_archive_validator.mjs"]:
        common["/checkpoint/" + name] = shared("kernel/save/" + name)
    for language in ["en", "ja"]:
        common["/checkpoint/i18n/" + language + ".json"] = shared("kernel/save/i18n/" + language + ".json")
    common["/baseline-save-resume.html"] = shared("kernel/save/baseline-save-resume.html")
    profiles = {}
    for name in ["physical", "prepared", "semantic", "planar"]:
        routes = dict(common)
        for ext in ["mjs", "wasm"]:
            routes["/native/tome-native." + ext] = loc("phase6", "dist/" + name + "/tome-native." + ext)
        if name == "physical":
            entry = "/physical-play-browser.html"
            for alias in ["physical-play-browser", "play-browser"]:
                routes["/" + alias + ".html"] = owned("rust-platform-input-work/integration-web/physical-play-browser.html")
                routes["/" + alias + ".mjs"] = loc("phase6", "portable/served/physical-play-browser.mjs")
            routes["/physical/physical-play-owner.mjs"] = owned("rust-platform-input-work/integration-web/physical-play-owner.mjs")
            for file in ["physical-input-wasm.mjs", "original-physical-input.mjs", "focused-input-host.mjs"]:
                routes["/physical/" + file] = owned("rust-platform-input-work/browser/" + file)
            for locale in ["en", "ja"]:
                routes["/physical/i18n/" + locale + ".json"] = owned("rust-platform-input-work/i18n/" + locale + ".json")
            routes["/physical/tome_physical_input.wasm"] = loc("phase6", "dist/physical-rust/tome_physical_input.wasm")
            manifest = "save-resume-work/browser-vfs-inputs.json"
            expression = "window.tomePlayReport"
        elif name == "prepared":
            base = "mechanics-audit-work/prepared-map/integration-web/"
            entry = "/prepared-map-observer.html"
            routes[entry] = owned(base + "prepared-map-observer.html")
            routes["/observer/observer.mjs"] = owned(base + "observer.mjs")
            for locale in ["en", "ja"]:
                routes["/observer/i18n/" + locale + ".json"] = owned(base + "i18n/" + locale + ".json")
            routes["/rust/tome-map-packet.wasm"] = loc("phase6", "dist/prepared-rust/tome_map_packet_wasm.wasm")
            manifest = base + "browser-vfs-inputs.json"
            expression = "window.tomePreparedMapReport"
        elif name == "semantic":
            base = "semantic-missing-routes-work/"
            entry = "/semantic-route-browser.html"
            for route, file in {
                "/missing/merge-delta.mjs": "merge-delta.mjs",
                "/missing/semantic-route-delta.json": "candidate/semantic-route-delta.json",
                "/missing/reviewed-resolver-profile.mjs": "browser/reviewed-resolver-profile.mjs",
                "/missing/native-reviewed-session.mjs": "browser/generated/native-reviewed-session.mjs",
                "/missing/semantic-route-browser.mjs": "browser/generated/semantic-route-browser.mjs",
                "/missing/integration-source-manifest.json": "browser/integration-semantic-source-manifest.json",
                "/missing/source-freeze.json": "browser/source-freeze-semantic.json",
                "/missing/merge-result.json": "merged-candidate/merge-result.json",
                entry: "browser/generated/semantic-route-browser.html",
                "/catalog/en.json": "merged-candidate/english.json",
                "/catalog/ja.json": "merged-candidate/japanese.json",
                "/catalog/registry.json": "merged-candidate/registry.json",
                "/catalog/ja-supplement-complete.json": "merged-candidate/supplements.json",
            }.items():
                routes[route] = owned(base + file)
            routes["/catalog/format-policy.json"] = shared("localization/review/final-review/format-policy.json")
            routes["/catalog/dream-registry-extension.json"] = shared("localization/review/dream-stage/dream-registry-extension.json")
            manifest = base + "browser/generated/semantic-vfs-inputs.json"
            expression = "window.tomeNativeBootReport"
        else:
            entry = "/planar-regression.html"
            for ext in ["html", "mjs"]:
                routes["/planar-regression." + ext] = owned("native-core-work/planar-regression-web/planar-regression." + ext)
            manifest = "bootstrap-work/browser-vfs-inputs.json"
            expression = "window.tomePlanarRegressionReport"
        routes["/"] = routes[entry]
        routes["/index.html"] = routes[entry]
        profiles[name] = {"entry": entry, "report_expression": expression,
                          "native_root": "dist/" + name, "manifest_source": manifest,
                          "manifest": "portable/vfs/" + name + ".json", "routes": routes,
                          "complete": False, "portable_runtime_revalidated": False}
    return {"schema_version": 1, "source_commit": COMMIT, "profiles": profiles,
            "complete": False, "full_renderer_ready": False, "local_only": True,
            "default_activation": False, "shared_port_relative": "../.."}


def rebase_manifest(source_key, selection, tome, port, target, default):
    source = WORK / relative(source_key)
    data = read_json(source)
    selected = {str((WORK / relative(r["source"])).resolve()).casefold(): r["target"] for r in selection["files"]}
    used = {}
    def translate(raw, parent):
        old = Path(raw)
        old = old.resolve() if old.is_absolute() else (source.parent / old).resolve()
        key = str(old).casefold()
        if inside(old, tome / "upstream"):
            destination, scope = old, "read_only_upstream"
        elif key in selected:
            destination, scope = target / relative(selected[key]), "explicit_selected_file"
        elif inside(old, WORK):
            rel = old.relative_to(WORK)
            prefix = rel.parts[0]
            if prefix not in selection["shared_vfs_prefixes"]:
                raise ValueError("No reviewed shared VFS mapping: " + str(rel))
            shared_key = (PurePosixPath(selection["shared_vfs_prefixes"][prefix]) / PurePosixPath(*rel.parts[1:])).as_posix()
            destination, scope = port / relative(shared_key), "preserved_default_dependency"
            if old.is_file() and shared_key not in default["files"]:
                raise ValueError("Shared VFS file is absent from default 496 selection: " + shared_key)
            if old.is_dir() and not any(k.startswith(shared_key.rstrip("/") + "/") for k in default["files"]):
                raise ValueError("Shared VFS directory has no selected default leaf: " + shared_key)
        else:
            raise ValueError("Unknown external VFS source: " + str(old))
        if not old.exists() or old.is_symlink():
            raise ValueError("VFS source missing/unreviewed symlink: " + str(old))
        if scope == "preserved_default_dependency" and not destination.exists():
            raise ValueError("Portable default dependency is missing: " + str(destination))
        result = os.path.relpath(destination, parent).replace("\\", "/")
        used[str(old)] = {"scope": scope, "portable_physical": result}
        return result
    output = target / "portable/vfs" / (next(p["profile"] for p in selection["proofs"] if profile_configs(selection)["profiles"][p["profile"]]["manifest_source"] == source_key) + ".json")
    def visit(obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key in ("physical", "staged", "original") and isinstance(value, str):
                    obj[key] = translate(value, output.parent)
                else:
                    visit(value)
        elif isinstance(obj, list):
            for value in obj:
                visit(value)
    visit(data)
    data["phase6_portable_provenance"] = {
        "original_manifest": source_key, "original_manifest_sha256": digest(source)["sha256"],
        "source_commit": COMMIT, "physical_locators_only_rebased": True,
        "virtual_paths_and_mount_order_retained": True, "complete": False,
        "portable_runtime_revalidated": False, "upstream_assets_copied": False}
    return encode_json(data), used


def artifact_binding(route, config, manifest_bytes, selection, port, target):
    if route.startswith("/vfs/"):
        virtual = route[len("/vfs"):]
        original_manifest = read_json(WORK / relative(config["manifest_source"]))
        rows = [r for r in original_manifest["inputs"] if r["virtual"] == virtual]
        if len(rows) != 1 or rows[0]["type"] != "file":
            raise ValueError("Proof VFS artifact must have one explicit leaf: " + route)
        original = Path(rows[0]["physical"])
        if not original.is_absolute():
            original = (WORK / relative(config["manifest_source"])).parent / original
        measured = digest(original)
        location = {"namespace": "vfs", "virtual": virtual}
    else:
        location = config["routes"].get(route)
        if location is None:
            raise ValueError("Unbound historical served artifact: " + route)
        if location == loc("phase6", "portable/served/physical-play-browser.mjs"):
            measured = blob_digest(compat_script())
        elif location["namespace"] == "port":
            measured = digest(port / relative(location["file"]))
        else:
            reverse = {r["target"]: r["source"] for r in selection["files"]}
            measured = digest(WORK / relative(reverse[location["file"]]))
    return measured, location


def proof_review(selection, configs, port, target):
    reviews = []
    for row in selection["proofs"]:
        report = read_json(WORK / relative(row["evidence"]))
        if report.get("passed") is not True or report.get("exceptions") != []:
            raise ValueError("Historical browser proof is not clean: " + row["profile"])
        runtime, scenario = report["runtime"], report["scenario"]
        if runtime.get("completed") is not True or runtime.get("passed") is not True or scenario.get("passed") is not True:
            raise ValueError("Historical runtime/scenario did not complete successfully")
        count = checked_group(scenario["checks"], row["profile"] + ".scenario")
        if count != row["scenario_checks"]:
            raise ValueError("Explicit scenario check scope changed")
        groups = {"scenario": count}
        if row["profile"] == "prepared":
            groups["runtime"] = checked_group(runtime["checks"], "prepared.runtime")
            if groups["runtime"] != 35 or runtime.get("full_renderer_ready") is not False:
                raise ValueError("Prepared packet scope differs")
        if row["profile"] == "planar":
            groups["control"] = checked_group(scenario["control"]["checks"], "planar.control")
            groups["patched"] = checked_group(scenario["patched"]["checks"], "planar.patched")
            # runtime is the control and is deliberately not counted twice.
        artifact_rows = report["served_artifacts"] + scenario.get("served_artifacts", [])
        bound = {}
        for artifact in artifact_rows:
            if artifact.get("status", 200) != 200:
                raise ValueError("Historical served artifact failed")
            measured, location = artifact_binding(artifact["route"], configs["profiles"][row["profile"]], None, selection, port, target)
            if not same_digest(measured, artifact):
                raise ValueError("Current selected artifact differs from actual served proof: " + artifact["route"])
            if artifact["route"] in bound and bound[artifact["route"]]["sha256"] != artifact["sha256"]:
                raise ValueError("Conflicting historical route identities")
            bound[artifact["route"]] = measured | {"location": location}
        resource = clean_resource(WORK / relative(row["resource"]))
        reviews.append({"profile": row["profile"], "evidence": row["evidence"], "evidence_identity": digest(WORK / relative(row["evidence"])),
                        "resource": row["resource"], "resource_identity": digest(WORK / relative(row["resource"])),
                        "historical_started_at": report.get("started_at"), "historical_completed_at": report.get("completed_at"),
                        "check_groups_counted_once": groups, "historical_checked_total": sum(groups.values()),
                        "actual_label_count": len(scenario.get("actual_labels", [])),
                        "served_artifacts_current_bytes_match": bound, "resource_result": resource,
                        "portable_wrapper_and_rebased_vfs_runtime_verified": False})
    return reviews


def historical_identity(selection):
    path = WORK / "semantic-missing-routes-work/browser/source-freeze-semantic.json"
    old = read_json(path)
    rows = []
    for row in old["files"]:
        file = WORK / relative(row["file"])
        actual = digest(file) if file.is_file() else None
        rows.append({"file": row["file"], "historical_identity": {"bytes": row["bytes"], "sha256": row["sha256"]},
                     "current_identity": actual, "current_matches_historical": actual is not None and same_digest(actual, row)})
    return {"original_freeze_identity": digest(path), "role": "Historical validation input, not a claim that today's harness has identical bytes",
            "rows": rows, "current_mismatches": sum(not r["current_matches_historical"] for r in rows)}


def native_source_bindings(selection, port, default):
    # Native link reports carry actual compile-time seam hashes. Object files
    # are historical names only and never selected/copied.
    default_rows = read_json(port / "STAGING-MANIFEST.json")["files"]
    defaults = {r["source"].replace("\\", "/"): r["staged"] for r in default_rows}
    selected = {r["source"]: r["target"] for r in selection["files"]}
    result = []
    for row in selection["files"]:
        if row["kind"] != "historical_link_evidence":
            continue
        report = read_json(WORK / relative(row["source"]))
        sources = []
        for seam in report["seam_sources"]:
            source = Path(seam["source"]).resolve()
            if not inside(source, WORK):
                raise ValueError("Unknown native seam source root: " + str(source))
            key = source.relative_to(WORK).as_posix()
            actual = digest(source)
            if actual["sha256"] != seam["sha256"]:
                raise ValueError("Native seam source changed since recorded compile: " + key)
            reference = loc("phase6", selected[key]) if key in selected else loc("port", defaults[key]) if key in defaults else None
            if reference is not None and reference["namespace"] == "port":
                if not same_digest(default["files"][reference["file"]], actual):
                    raise ValueError("Recorded native seam differs from preserved default: " + key)
            sources.append({"source": key, "compile_time_sha256": seam["sha256"],
                            "current_identity": actual, "current_matches_recorded_compile": True,
                            "portable_source_reference": reference,
                            "source_rebuild_requires_original_workspace_input": reference is None})
        result.append({"link_report": row["source"], "source_bindings": sources,
                       "binding_count": len(sources), "current_matches_recorded_compile": True})
    return result


def materialize(selection, tome, port, target, default):
    configs = profile_configs(selection)
    generated = {"portable/served/physical-play-browser.mjs": compat_script(),
                 "portable/profile-config.json": encode_json(configs),
                 "portable/profile_server.mjs": (OWN / "profile_server.mjs").read_bytes(),
                 "portable/run-local.mjs": (OWN / "run-local.mjs").read_bytes()}
    vfs_mapping = {}
    for name, profile in configs["profiles"].items():
        data, used = rebase_manifest(profile["manifest_source"], selection, tome, port, target, default)
        generated[profile["manifest"]] = data
        vfs_mapping[name] = used
        wrapper = "// SPDX-License-Identifier: GPL-3.0-or-later\nimport {createPhase6Server} from './profile_server.mjs';\nexport function createTomeServer(options={}){return createPhase6Server('" + name + "',options);}\n"
        generated["portable/" + name + "_server.mjs"] = wrapper.encode("utf-8")
    return generated, configs, vfs_mapping


def prepare_freeze(selection_sha):
    selection, tome, port, target = configured()
    if digest(SELECTION)["sha256"] != selection_sha:
        raise ValueError("Root-approved explicit selection SHA does not match")
    default = default_guard(selection, tome, port)
    sources = []
    for row in selection["files"]:
        source = WORK / relative(row["source"])
        if not inside(source, WORK) or source.is_symlink() or not source.is_file():
            raise ValueError("Explicit source missing/unconfined: " + row["source"])
        sources.append(row | digest(source))
    for row in sources:
        if row["kind"] == "measured_resource":
            clean_resource(WORK / relative(row["source"]))
        if row["kind"] == "historical_link_evidence":
            if read_json(WORK / relative(row["source"])).get("exit") != 0:
                raise ValueError("Native link report did not pass")
    generated, configs, vfs_mapping = materialize(selection, tome, port, target, default)
    proofs = proof_review(selection, configs, port, target)
    return {"schema_version": 1, "source_commit": COMMIT, "freeze_at_utc": datetime.now(timezone.utc).isoformat(),
            "selection_identity": digest(SELECTION), "target": str(target.resolve()),
            "complete": False, "full_renderer_ready": False, "default_activation": False,
            "external_sites_requested": False, "external_site_created_or_published": False, "original_assets_or_save_archives_copied": False,
            "default_guard": default, "files": sources,
            "generated": {key: blob_digest(value) for key, value in generated.items()},
            "vfs_provenance": vfs_mapping, "historical_proofs": proofs,
            "historical_semantic_source_freeze_review": historical_identity(selection),
            "native_link_source_bindings": native_source_bindings(selection, port, default),
            "portable_wrapper_and_rebased_vfs_runtime_verified": False,
            "outstanding": ["Root must approve this concrete freeze before isolated staging.",
                            "The portable overlay factory and rebased VFS require their own measured browser rerun.",
                            "Prepared TMP1 packets omit resource leases, shader uniform state, callbacks and FBO continuation; full renderer is incomplete.",
                            "Fresh geometry/UTF8/busy-collector changes remain separate from these approved primary profiles and auxiliary planar regression.",
                            "Production turn barriers, named RNG phase activation, full UI/campaign and full text coverage remain incomplete."]}


def stage(freeze_path, approved_sha):
    if digest(freeze_path)["sha256"] != approved_sha:
        raise ValueError("Root-approved concrete freeze SHA differs")
    freeze = read_json(freeze_path)
    selection, tome, port, target = configured()
    if digest(SELECTION) != freeze["selection_identity"]:
        raise ValueError("Selection changed after approval")
    # Validate every selected byte and all 496 default files before any mutation.
    if default_guard(selection, tome, port) != freeze["default_guard"]:
        raise ValueError("Default checkpoint changed after freeze")
    for row in freeze["files"]:
        if not same_digest(digest(WORK / relative(row["source"])), row):
            raise ValueError("Selected source changed after root approval: " + row["source"])
    generated, configs, mappings = materialize(selection, tome, port, target, freeze["default_guard"])
    if {key: blob_digest(data) for key, data in generated.items()} != freeze["generated"]:
        raise ValueError("Portable derived bytes changed after root approval")
    proof_review(selection, configs, port, target)
    if native_source_bindings(selection, port, freeze["default_guard"]) != freeze["native_link_source_bindings"]:
        raise ValueError("Recorded native source binding changed after approval")
    guard_target(port, target)  # Repeat immediately before the first write.
    if target.exists() and any(target.iterdir()):
        raise ValueError("Experimental target already has files; do not overwrite a distinct freeze")
    target.mkdir(parents=True, exist_ok=True)
    staged = []
    for row in freeze["files"]:
        source, destination = WORK / relative(row["source"]), target / relative(row["target"])
        if not inside(destination, target):
            raise ValueError("Resolved output escaped phase6")
        destination.parent.mkdir(parents=True, exist_ok=True)
        with source.open("rb") as inp, destination.open("xb") as out:
            while chunk := inp.read(CHUNK):
                out.write(chunk)
        actual = digest(destination)
        if not same_digest(actual, row):
            raise ValueError("Streamed copy verification failed")
        staged.append({"source": row["source"], "target": row["target"], "kind": row["kind"],
                       "original_source_identity": {"bytes": row["bytes"], "sha256": row["sha256"]}, **actual,
                       "portable_rebased": False})
    for key, data in generated.items():
        destination = target / relative(key)
        if not inside(destination, target):
            raise ValueError("Generated destination escaped phase6")
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("xb") as out:
            out.write(data)
        staged.append({"target": key, "kind": "portable_derived_source_or_manifest", **blob_digest(data), "portable_rebased": True})
    if default_guard(selection, tome, port) != freeze["default_guard"]:
        raise ValueError("Default preservation guard failed after isolated writes")
    write_json(target / "APPROVED-FREEZE.json", freeze)
    manifest = {"schema_version": 1, "source_commit": COMMIT, "approved_freeze_sha256": approved_sha,
                "complete": False, "full_renderer_ready": False, "default_activation": False,
                "external_sites_requested": False, "external_site_created_or_published": False, "files": staged,
                "shared_default_identity": freeze["default_guard"],
                "historical_proofs": freeze["historical_proofs"],
                "historical_semantic_source_freeze_review": freeze["historical_semantic_source_freeze_review"],
                "native_link_source_bindings": freeze["native_link_source_bindings"],
                "default_checkpoint_preserved_before_and_after": True,
                "portable_wrapper_and_rebased_vfs_runtime_verified": False,
                "selected_asset_or_save_archives_copied": 0,
                "selected_compiled_bytes": sum(r["bytes"] for r in staged if r["kind"] == "compiled_exact_artifact"),
                "outstanding": freeze["outstanding"][1:]}
    write_json(target / "PHASE6-MANIFEST.json", manifest)
    write_json(target / "STATUS.json", {k: v for k, v in manifest.items() if k != "files"})
    return {"destination": str(target), "files": len(staged), "default_files_preserved": 496,
            "complete": False, "portable_runtime_verified": False,
            "manifest_sha256": digest(target / "PHASE6-MANIFEST.json")["sha256"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    freeze_command = commands.add_parser("freeze")
    freeze_command.add_argument("--reviewed-selection-sha256", required=True)
    freeze_command.add_argument("--output", default=str(OWN / "reviewed-freeze.json"))
    stage_command = commands.add_parser("stage")
    stage_command.add_argument("--freeze", required=True)
    stage_command.add_argument("--approved-freeze-sha256", required=True)
    args = parser.parse_args()
    if args.command == "freeze":
        out = Path(args.output).resolve()
        if not inside(out, OWN):
            raise ValueError("Freeze metadata must remain in the owned source recipe directory")
        frozen = prepare_freeze(args.reviewed_selection_sha256)
        write_json(out, frozen)
        print(json.dumps({"freeze": str(out), **digest(out), "complete": False, "shared_written": False}))
    else:
        print(json.dumps(stage(Path(args.freeze).resolve(), args.approved_freeze_sha256)))


if __name__ == "__main__":
    main()
