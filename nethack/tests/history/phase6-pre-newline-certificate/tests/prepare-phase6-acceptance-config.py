#!/usr/bin/env python3
"""Hash an installed Phase6 candidate only after its exact data-consumer gate.

This reads files, writes a new config, and starts no engine/browser/compiler.
A config never grants the parent's serial execution slot.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ["engine/nethack.js", "engine/nethack.wasm", "app.mjs", "shim-host.mjs",
         "registered-catalog-host.mjs", "dom-ui.mjs", "save-store.mjs",
         "browser-ui.json", "gameplay-core.json", "index.html", "style.css"]


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def scoped(name, *, exists=True):
    path = (ROOT / name).resolve(strict=exists)
    assert path.is_relative_to(ROOT), f"Path escaped NetHack subtree: {name}"
    return path


def document(name):
    path = scoped(name)
    return json.loads(path.read_text("utf8")), {"path": path.relative_to(ROOT).as_posix(), "sha256": digest(path)}


def artifact_reference(name, expected):
    path = scoped(name)
    assert digest(path) == expected, f"Separate probe artifact changed: {name}"
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": expected}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-root", default="build/phase6/web")
    parser.add_argument("--data-binding", default="build/phase6/data-consumer-binding.json")
    parser.add_argument("--consumer-report", default="build/data-consumer-qa/phase6/verification.json")
    parser.add_argument("--report-directory", default="build/phase6/acceptance")
    parser.add_argument("--output", default="build/phase6/acceptance-config.json")
    parser.add_argument("--port", type=int, default=0)
    opts = parser.parse_args()
    assert 0 <= opts.port <= 65535
    build = scoped("build")
    web = scoped(opts.web_root)
    reports = scoped(opts.report_directory, exists=False)
    output = scoped(opts.output, exists=False)
    assert web.is_relative_to(build) and web != build
    assert reports.is_relative_to(build) and reports != build and not reports.is_relative_to(web)
    assert output.is_relative_to(build) and not output.is_relative_to(web)
    assert not output.exists(), "Never overwrite a previously frozen acceptance config; select a new --output"
    assert reports.is_relative_to(build / "phase6"), "Reports must stay under the isolated Phase6 build"
    assert not reports.exists(), "Choose a fresh report directory; never overwrite prior failures or artifacts"
    runtime = {}
    for name in FILES:
        artifact = (web / name).resolve(strict=True)
        assert artifact.is_relative_to(web), f"Artifact escaped staged web root: {name}"
        runtime[name] = digest(artifact)
    engine, engine_ref = document("build/phase6/engine-manifest.json")
    source, source_ref = document("work/phase6/semantic-generated/source-manifest.json")
    generator, generator_ref = document("build/phase6/target-data-manifest.json")
    binding, binding_ref = document(opts.data_binding)
    consumer, consumer_ref = document(opts.consumer_report)
    assert binding["status"] == consumer["status"] == "passed"
    assert consumer["consumer_execution_proved"] is True and consumer["failed_assertion_count"] == 0
    assert binding["candidate_engine_wasm_sha256"] == runtime["engine/nethack.wasm"]
    assert binding["engine_manifest_sha256"] == engine_ref["sha256"]
    assert binding["consumer_report_sha256"] == consumer_ref["sha256"]
    assert binding["generator_manifest_sha256"] == generator_ref["sha256"]
    proof_name = consumer["source_evidence"]
    assert proof_name == "prepared.json", "Pin the exact original consumer preparation evidence"
    prepared, prepared_ref = document(str(Path(consumer_ref["path"]).parent / proof_name))
    assert prepared_ref["sha256"] == consumer["prepared_sha256"]
    assert prepared["candidate_manifest_sha256"] == engine_ref["sha256"]
    assert prepared["generator_manifest_sha256"] == generator_ref["sha256"]
    assert prepared["source_phase"] == "phase6" and prepared["generated_data_lf_verified"] is True
    assert prepared["official_commit"] == engine["official_commit"]
    assert consumer["actual_target_macros"] == {"UNIX": 1, "WIN32": 0, "MSDOS": 0, "_WIN32": 0, "DLBLIB": 1, "CROSS_TO_WASM": 1}
    assert engine["target_macros"] == consumer["actual_target_macros"]
    assert consumer["macro_evidence"]["matches_expected"] is True
    assert consumer["macro_evidence"]["cr_normalization_compiled"] is False
    archive = scoped("work/phase6/wasm-data/nhdat")
    assert binding["archive_sha256"] == consumer["archive_sha256"] == digest(archive)
    assert binding["datafile_expected_actual_bytes"] == archive.stat().st_size
    assert prepared["archive_sha256"] == digest(archive)
    assert prepared["archive_bytes"] == archive.stat().st_size
    assert Path(prepared["actual_archive"]).resolve() == archive
    probe_directory = Path(consumer_ref["path"]).parent
    consumer_js_ref = artifact_reference(str(probe_directory / "original-consumer.cjs"), consumer["consumer_js_sha256"])
    consumer_wasm_ref = artifact_reference(str(probe_directory / "original-consumer.wasm"), consumer["consumer_wasm_sha256"])
    assert engine["frontend"]["registered_catalog"] is True
    assert engine["isolated_phase6"]["source_manifest_sha256"] == source_ref["sha256"]
    assert engine["isolated_phase6"]["target_data_manifest_sha256"] == generator_ref["sha256"]
    assert source["catalog"]["sha256"] == runtime["gameplay-core.json"]
    native_root = scoped(engine["source_lineage"]["actual_source_root"])
    assert Path(prepared["working_source_root"]).resolve() == native_root
    def normalize_flags(flags):
        result = []
        for flag in flags:
            if flag.startswith("-I"):
                include = Path(flag[2:]).resolve()
                assert include.is_relative_to(native_root)
                flag = "-I" + include.relative_to(native_root).as_posix()
            result.append(flag)
        return result
    assert normalize_flags(prepared["target_flags"]) == normalize_flags(generator["target_flags"]) == normalize_flags(engine["target_flags"])
    embedded = engine["embedded_data"]
    assert embedded["generator_manifest_sha256"] == generator_ref["sha256"]
    assert embedded["archive"]["sha256"] == embedded["link"]["archive_sha256_at_link"] == digest(archive)
    assert Path(embedded["archive"]["source_path"]).resolve() == archive
    entry = embedded["datafile_entry"]
    assert entry["name"].lstrip("/") == "nhdat"
    assert embedded["archive"]["bytes"] == entry["expected_bytes"] == entry["actual_bytes"] == archive.stat().st_size
    assert entry["actual_sha256"] == digest(archive)
    assert embedded["emitted_js"]["sha256"] == runtime["engine/nethack.js"]
    assert embedded["emitted_wasm"]["sha256"] == runtime["engine/nethack.wasm"]
    assert len(embedded["emitted_js"]["loader_sha256"]) == 64
    assert isinstance(embedded["link"]["argv"], list) and embedded["link"]["embed_argument"] in embedded["link"]["argv"]
    assert len(embedded["link"]["command_sha256"]) == 64

    native = {}
    for row in engine["compiled_input_hashes"] + engine["compiled_header_hashes"]:
        path = (native_root / row["path"]).resolve(strict=True)
        assert path.is_relative_to(native_root)
        assert digest(path) == row["sha256"], f"Actual compiled source changed: {row['path']}"
        if row["path"] in native:
            assert native[row["path"]] == row["sha256"]
        native[row["path"]] = row["sha256"]
    assert len(engine["compiled_input_hashes"]) >= 174
    assert len(engine["compiled_header_hashes"]) >= 20
    for name, expected in prepared["working_headers"].items():
        assert native[name] == expected, f"Probe/engine shared header mismatch: {name}"
    official_functions = {"unpadline": "112b4268882487df8eac4a85d6249736622ac27c796e7e2d9cc2136aaf429d29",
        "init_rumors": "6744cd9c32a1fa4b8c056fbbb81eca5b499a58245da8df097103d3bb32a6c4aa",
        "get_rnd_line": "a22cd4c9afd09476a4aa15779016b7753d7c94ad1218cdc37e2a7039c6dacdf2",
        "init_oracles": "3b79135a7b9717e3b0d474086f60058e5db8f276f23465fa1bfd2024b96c8c39",
        "outoracle": "be862c86a222160a5cc6d85ffbb36e78074454353465051ea2f126b1900e4757"}
    assert {row["function"]: row["sha256"] for row in prepared["official_functions"]} == official_functions
    units = engine["compile_evidence"]["units"]
    assert len(units) == len(engine["compiled_input_hashes"])
    unit_sources = set()
    for unit in units:
        name = (native_root / unit["source"]).resolve().relative_to(native_root).as_posix()
        assert name not in unit_sources, f"Duplicate successful compiler unit: {name}"
        unit_sources.add(name)
        assert unit["status"] == "passed" and unit["source_sha256"] == native[name]
        assert "-c" in unit["argv"] and len(unit["command_sha256"]) == 64
    assert unit_sources == {Path(row["path"]).as_posix() for row in engine["compiled_input_hashes"]}

    frontend = {row["path"]: row["sha256"] for row in engine["frontend"]["files"]}
    for name in FILES:
        if not name.startswith("engine/"):
            assert frontend[name] == runtime[name], f"Installed frontend differs from compiled manifest: {name}"
    metadata_names = ["locales/gameplay-core.metadata.json",
        "work/phase4/semantic-generated/phase4-inputs/metadata.json",
        "work/phase4/semantic-generated/phase4-inputs/diagnostic-wrappers/metadata.json",
        "tools/semantic-text/phase6-native-api/generated/metadata.json"]
    refs = [document(name)[1] for name in metadata_names]
    test_names = ["tests/browser-host-phase6-stage.mjs", "tests/browser-host-phase6-cdp.mjs",
        "tests/browser-host-phase6-lifecycle.mjs", "tests/browser-host-phase6-browser.mjs",
        "tests/browser-host-phase6-name-producers.mjs", "tools/serve-integration.mjs",
        "tests/prepare-phase6-acceptance-config.py", "tests/browser-host-semantic-cdp.mjs", "tools/run-monitored.py", "tools/semantic-text/phase6-immutable-catalog/tests/registered-catalog-wasm.mjs"]
    test_sources = [{"path": name, "sha256": digest(scoped(name))} for name in test_names]
    extras = {
        "engine_manifest": engine_ref, "source_manifest": source_ref,
        "generator_manifest": generator_ref, "data_binding": binding_ref,
        "consumer_report": consumer_ref, "consumer_prepared": prepared_ref,
        "consumer_js": consumer_js_ref, "consumer_wasm": consumer_wasm_ref,
        "producer_audit": document("work/phase6/semantic-generated/audit.json")[1],
        "appearance_audit": document("work/phase6/semantic-generated/public-appearance-audit.json")[1],
    }
    phase7 = None
    if source["phase7"]["enabled"]:
        phase7 = {"plan": document("tools/semantic-text/phase7-buffer-producers/tests/browser-host-phase7-plan.json")[1],
            "audit": document("work/phase6/semantic-generated/phase7-audit.json")[1]}
        for name in ["browser-host-phase7-scenarios.mjs", "browser-host-phase7-compiled-format.mjs"]:
            path = scoped("tools/semantic-text/phase7-buffer-producers/tests/" + name)
            phase7[name] = {"path": path.relative_to(ROOT).as_posix(), "sha256": digest(path)}
    config = {"schema_version": 1, "stage": "phase6-7-isolated-candidate",
        "runtime_status": "installed-frozen-candidate", "render_export": "nh_rust_format_registered",
        "web_root": web.relative_to(ROOT).as_posix(), "native_source_root": native_root.relative_to(ROOT).as_posix(),
        "catalog_path": "gameplay-core.json", "port": opts.port,
        "report_directory": reports.relative_to(ROOT).as_posix(), "expected_runtime_sha256": runtime,
        "expected_native_source_sha256": native, "metadata_paths": refs, "test_sources": test_sources, "phase7": phase7, **extras,
        "archive": {"path": archive.relative_to(ROOT).as_posix(), "sha256": digest(archive), "bytes": archive.stat().st_size},
        "execution_note": "Requires separate parent serial slot and fresh >=2GiB physical AND commit headroom. Data probe is not the full engine. No exhaustive 148-member consumer or encyclopedia-reader claim."}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf8", newline="\n")
    print(json.dumps({"config": output.relative_to(ROOT).as_posix(), "sha256": digest(output),
        "wasm_sha256": runtime["engine/nethack.wasm"], "catalog_sha256": runtime["gameplay-core.json"],
        "runtime_files": len(runtime), "actual_source_and_headers": len(native), "runtime_invoked": False}))


if __name__ == "__main__":
    main()
