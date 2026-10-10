"""Record passing local gates without changing the immutable engine manifest."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf8"))


def reference(path):
    return {"path": path.relative_to(ROOT).as_posix(), "bytes": path.stat().st_size, "sha256": digest(path)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--output", default="build/phase6/verification.json")
    args = parser.parse_args()
    config_path = (ROOT / args.config).resolve()
    output = (ROOT / args.output).resolve()
    config_path.relative_to(ROOT)
    output.relative_to(ROOT)
    assert not output.exists(), "Choose a fresh verification output"
    config = read(config_path)
    reports = ROOT / config["report_directory"]
    web = ROOT / config["web_root"]
    config_hash = digest(config_path)
    engine_path = ROOT / config["engine_manifest"]["path"]
    engine = read(engine_path)
    assert digest(engine_path) == config["engine_manifest"]["sha256"]
    assert engine["commit"] == "16ff59115315917b93185d026aeefea06db9b0f4"
    assert len(engine["compile_evidence"]["units"]) == 177
    assert all(unit["status"] == "passed" for unit in engine["compile_evidence"]["units"])
    for name, expected in config["expected_runtime_sha256"].items():
        assert digest(web / name) == expected, name
    proofs = {}
    paths = [config_path, engine_path]
    for suite, expected in (("compiled", 32), ("browser", 18), ("native-name", 14)):
        path = reports / f"{suite}-verification.json"
        proof = read(path)
        assert proof["status"] == "passed", suite
        if suite == "compiled":
            assert proof["total_passed"] == expected and proof["failed"] == 0
            assert proof["config_sha256"] == config_hash
        else:
            assert len(proof["tests"]) == expected
            assert all(test["status"] == "passed" for test in proof["tests"])
            assert proof["stage"]["config_sha256"] == config_hash
        proofs[suite] = proof
        resource = reports / f"{suite}-resources.json"
        record = read(resource)
        assert record["exit_code"] == 0
        assert record["command"][-2:] == ["--stage-config", config_path.relative_to(ROOT).as_posix()]
        for key in ("fresh_headroom", "minimum_sampled_headroom"):
            assert record[key]["physical_available_bytes"] >= 2 * 1024**3
            assert record[key]["commit_available_bytes"] >= 2 * 1024**3
        paths.extend((path, resource, reports / f"{suite}.log"))
    rust_path = ROOT / "build/phase6-rust/actual-proof.json"
    rust = read(rust_path)
    assert rust["status"] == "native_rust_phase6_tests_passed" and rust["tests_passed"] == 67 and rust["failed"] == 0
    assert rust["rustLibrary"]["sha256"] == engine["rust_library"]["sha256"]
    assert set(rust["validation"]) == {"native", "clippy", "fmt", "release"}
    for kind, item in rust["validation"].items():
        assert item["status"] == "passed", kind
        resource = ROOT / item["resourcePath"]
        log = ROOT / item["logPath"]
        assert digest(resource) == item["resourceSha256"] and digest(log) == item["logSha256"], kind
        recorded = read(resource)
        assert recorded["exit_code"] == 0 and recorded["command"] == item["command"], kind
        paths.extend((resource, log))
    assert "--offline" in rust["validation"]["clippy"]["command"]
    assert "--locked" in rust["validation"]["clippy"]["command"]
    assert rust["validation"]["clippy"]["command"][-3:] == ["--", "-D", "warnings"]
    consumer_path = ROOT / config["consumer_report"]["path"]
    consumer = read(consumer_path)
    assert consumer["status"] == "passed" and consumer["failed_assertion_count"] == 0 and consumer["assertion_count"] == 4859
    assert consumer["consumer_execution_proved"] is True
    assert digest(consumer_path) == config["consumer_report"]["sha256"]
    paths.extend((rust_path, consumer_path, reports / "syntax-verification.json", reports / "syntax-resources.json"))
    syntax = read(reports / "syntax-verification.json")
    assert syntax["status"] == "passed" and syntax["total_passed"] == 17 and syntax["config_sha256"] == config_hash
    assert read(reports / "syntax-resources.json")["exit_code"] == 0
    paths.extend((ROOT / "build/phase6/hallucination-source-proof.json",
                  ROOT / "tools/semantic-text/phase6-hallucination-source-proof/freeze-manifest.json",
                  ROOT / "tools/semantic-text/source-offer-rebuild-check/closure.manifest.json",
                  ROOT / "tools/semantic-text/source-offer-rebuild-check/verification.json"))
    for key in ("source_manifest", "generator_manifest", "data_binding", "consumer_prepared", "js_normalization_proof"):
        item = config[key]
        path = ROOT / item["path"]
        assert digest(path) == item["sha256"], key
        paths.append(path)
    catalog = read(web / "gameplay-core.json")
    native = proofs["native-name"]
    report = {
        "schema_version": 2, "recorded_at_utc": datetime.now(timezone.utc).isoformat(),
        "status": "local_original_engine_and_phase6_pipeline_verified_translation_incomplete",
        "delivery_scope": "Local HTML and Node/browser verification only; no external hosting action",
        "full_original_request_complete": False, "full_japanese_coverage": False,
        "architecture": "Complete official C gameplay/state/RNG; Rust application/input, pure presentation and platform adapters",
        "official_source": {"version": "5.0.0", "commit": engine["commit"], "pristine_files": 1265, "complete_compiled_c_lua_units": 177},
        "selected_web_root": config["web_root"], "runtime_artifacts": engine["artifacts"],
        "runtime_sha256": config["expected_runtime_sha256"],
        "catalog": {"en_ids": len(catalog["en"]), "ja_ids": len(catalog["ja"]), "catalog": reference(web / "gameplay-core.json"), "qualification": "Representative original native branches exercised; catalog/source counts are not exhaustive runtime coverage"},
        "actual_checks": {"native_rust_passed": 67, "strict_clippy_passed": True, "syntax_passed": 17, "boundary_passed": 32, "browser_passed": 18, "native_name_browser_passed": 14, "combined_boundary_and_browser_passed": 64, "original_target_data_assertions_passed": 4859, "browser_roles": 13, "native_save_and_fresh_restore": True, "pc_and_mobile_viewport_input": True, "physical_ios_safari_tested": False},
        "native_evidence_flags": {key: value for key, value in native.items() if key.endswith("Verified") and isinstance(value, bool)},
        "native_callback_semantics_verified": native["native_callback_semantics_verified"],
        "compiled_pipeline_verified": native["compiled_pipeline_verified"],
        "repaint_measurements": native.get("repaintMeasurements", []), "speedup_claimed": False,
        "evidence": [reference(path) for path in dict.fromkeys(paths)],
        "remaining": ["Complete Japanese coverage: 900 dynamic origins remain runtime-unresolved; authored resource proposals are not all wired", "Quest/accessibility and five original debug-gated Phase7 branches require native evidence", "Original encyclopedia reader runtime and exhaustive 148-asset consumer coverage remain unproved", "Semantic history sidecars across native restores, exact RNG continuation, death/bones and a complete campaign remain unproved", "Per-unit third-party translation provenance/rights remain unresolved; selected compiler_builtins source attribution is certified separately, while final WASM member retention remains unproved", "Physical iOS/Safari and same-history legacy performance comparison remain untested"],
    }
    with output.open("x", encoding="utf8", newline="\n") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(json.dumps({"verification": reference(output), "full_original_request_complete": False}))


if __name__ == "__main__":
    main()
