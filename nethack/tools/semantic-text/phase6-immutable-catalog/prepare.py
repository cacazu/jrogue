"""Prepare an isolated additive catalog registration proposal; no compiler/runtime."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RUST = ROOT / "rust"
DEST = HERE / "rust-copy"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe(path):
    path = path.resolve()
    if not path.is_relative_to(HERE):
        raise ValueError("source proposal must remain in phase6-immutable-catalog")
    return path


def prepare():
    relatives = ["Cargo.toml", "Cargo.lock", ".cargo/config.toml"] + [
        "src/" + name for name in
        ["application.rs", "domain.rs", "ffi.rs", "lib.rs", "platform.rs", "presentation.rs"]
    ]
    protected = {"rust/" + name: digest(RUST / name) for name in relatives}
    for name in ["rust/source-checkpoint-phase3-formatted.json", "locales/gameplay-core.json",
                 "locales/gameplay-core.metadata.json"] + [
                 "web/" + name for name in ["app.mjs", "browser-ui.json", "dom-ui.mjs",
                 "gameplay-core.json", "index.html", "save-store.mjs", "shim-host.mjs", "style.css"]]:
        protected[name] = digest(ROOT / name)
    for name in relatives:
        output = safe(DEST / name)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes((RUST / name).read_bytes())
    ffi_base = (RUST / "src/ffi.rs").read_bytes()
    (DEST / "src/ffi.rs").write_bytes(ffi_base + (HERE / "ffi-additions.rs.in").read_bytes())
    lib_base = (RUST / "src/lib.rs").read_bytes()
    (DEST / "src/lib.rs").write_bytes(lib_base + b"\n/// Explicit immutable catalog initialization (isolated proposal).\npub mod registered_catalog;\n")
    (DEST / "src/registered_catalog.rs").write_bytes((HERE / "registered_catalog.rs.in").read_bytes())
    vendor_source = (RUST / "vendor").resolve()
    vendor_packages = sorted(path.name for path in vendor_source.iterdir() if path.is_dir())
    if len(vendor_packages) != 11:
        raise ValueError("expected the eleven exact canonical locked vendor packages")
    vendor_hashes = {}
    for source in sorted(vendor_source.rglob("*")):
        if source.is_symlink() or not source.resolve().is_relative_to(vendor_source):
            raise ValueError("vendor source escapes canonical vendor directory")
        if not source.is_file():
            continue
        relative = source.relative_to(vendor_source)
        target = safe(DEST / "vendor" / relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        data = source.read_bytes()
        target.write_bytes(data)
        vendor_hashes[str(relative).replace("\\", "/")] = hashlib.sha256(data).hexdigest()
    (DEST / ".cargo/config.toml").write_text('[source.crates-io]\nreplace-with = "vendored-sources"\n'
        '[source.vendored-sources]\ndirectory = "vendor"\n', encoding="utf-8")
    # Reuse the prepared public semantic-contract tests, without executing them.
    contracts = ROOT / "tools/semantic-text/phase6-integration-review/rust-copy"
    for source in list((contracts / "fixtures").glob("*.json")) + list((contracts / "tests").glob("*.rs")):
        target = safe(DEST / source.relative_to(contracts))
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())
    # Preserve the original presentation.rs ../../locales compile-time fixture.
    # This is the old canonical source test fixture, not the selected runtime catalog.
    baseline_fixture = safe(HERE / "locales/gameplay-core.json")
    baseline_fixture.parent.mkdir(parents=True, exist_ok=True)
    baseline_fixture.write_bytes((ROOT / "locales/gameplay-core.json").read_bytes())
    if any(digest(ROOT / name) != expected for name, expected in protected.items()):
        raise ValueError("protected active input changed")
    result = {
        "schema_version": 1, "status": "source-prepared-uncompiled-unbenchmarked",
        "compiler_executed": False, "runtime_executed": False, "rust_tests_executed": False,
        "speedup_claimed": False, "runtime_binding_approved": False,
        "protected_input_sha256": protected, "protected_inputs_unchanged": True,
        "additive_exports": ["nh_rust_catalog_register", "nh_rust_catalog_release", "nh_rust_format_registered"],
        "existing_stateless_ffi_prefix_bytes": len(ffi_base),
        "existing_stateless_ffi_prefix_sha256": hashlib.sha256(ffi_base).hexdigest(),
        "existing_lib_prefix_bytes": len(lib_base),
        "new_registry_unit_test_sources": 6, "new_ffi_unit_test_sources": 2,
        "semantic_contract_test_sources": 10,
        "portable_vendor_packages": vendor_packages,
        "canonical_vendor_file_sha256": vendor_hashes,
        "portable_vendor_config": 'directory = "vendor"',
        "original_compile_time_fixture": {"path": "locales/gameplay-core.json",
            "source": "locales/gameplay-core.json", "sha256": digest(baseline_fixture),
            "role": "unchanged old canonical fixture for original presentation tests, separate from runtime merged catalog"},
        "host_preparation_sha256": digest(HERE / "host-preparation.json") if (HERE / "host-preparation.json").exists() else None,
        "registered_catalog_bounds": {"count": 8, "accepted_source_bytes": 33554432,
            "individual_source_bytes": 16777216, "host_reusable_output_bytes": 131072},
        "baseline_measurements_reported_by_parent_and_browser_owner": {
            "normal_100_transition_ms": 27531,
            "getlin_startup_and_100_transition_ms": 37821,
            "accumulated_nested_name_100_transition_ms": 130013,
            "nested_name_stateless_formatter_calls": 28200,
            "accumulated_hallucination_100_transition_ms": 173572,
            "whole_browser_job_ms": 360828,
            "whole_browser_job_peak_commit_bytes": 809287680,
            "comparison_limit": "These are reported existing frozen-candidate baselines, not a benchmark of this uncompiled proposal."
        },
        "proposal_sha256": {str(path.relative_to(HERE)).replace("\\", "/"): digest(path)
            for path in sorted(HERE.rglob("*")) if path.is_file() and path.name not in
            ["preparation.json", "source-verification.json", "source-tests.log"]},
    }
    (HERE / "preparation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return result


if __name__ == "__main__":
    result = prepare()
    print(json.dumps({"status": result["status"], "protected_inputs_unchanged": True,
                      "new_exports": result["additive_exports"], "speedup_claimed": False}))
