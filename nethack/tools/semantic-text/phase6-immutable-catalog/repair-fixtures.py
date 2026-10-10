"""Repair only missing copied-source fixtures; never rewrite Rust or failed evidence."""
from pathlib import Path
import hashlib
import json
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect_includes():
    results = []
    for source in sorted((HERE / "rust-copy").rglob("*.rs")):
        for match in re.finditer(r'include_(bytes|str)!\s*\(\s*"([^"\n]+)"\s*\)', source.read_text(encoding="utf-8")):
            destination = (source.parent / match.group(2)).resolve()
            if not destination.is_relative_to(HERE):
                raise ValueError("literal include escapes portable proposal: " + str(source))
            if not destination.is_file():
                raise ValueError("literal include missing: " + str(destination))
            results.append({"source": str(source.relative_to(HERE)).replace("\\", "/"),
                "macro": "include_" + match.group(1), "literal_path": match.group(2),
                "resolved_path": str(destination.relative_to(HERE)).replace("\\", "/"),
                "sha256": digest(destination)})
    return results


def repair():
    rust_sources = [path for path in (HERE / "rust-copy/src").glob("*.rs")] + [HERE / "rust-copy/Cargo.toml", HERE / "rust-copy/Cargo.lock"]
    before = {str(path.relative_to(HERE)).replace("\\", "/"): digest(path) for path in rust_sources}
    evidence = ROOT / "build/phase6-rust"
    preserved = {str(path.relative_to(ROOT)).replace("\\", "/"): digest(path)
        for path in [evidence / "native-test-resource.json", evidence / "native-test-resource.log"] if path.exists()}
    source = ROOT / "locales/gameplay-core.json"
    if digest(source) != "c79fe2a3e4b74811bf83c28e6defb63d44b25fb9a610b1931f055b88d11337d4":
        raise ValueError("original canonical fixture changed")
    target = HERE / "locales/gameplay-core.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(source.read_bytes())
    includes = inspect_includes()
    for path in rust_sources:
        if digest(path) != before[str(path.relative_to(HERE)).replace("\\", "/")]:
            raise ValueError("copied Rust source changed")
    for path, expected in preserved.items():
        if digest(ROOT / path) != expected:
            raise ValueError("failed native build evidence changed")
    report = {"schema_version":1,"status":"compile-time-fixture-repaired-source-only",
        "repair_compiler_executed":False,"repair_javascript_executed":False,
        "rust_tests_executed_by_repair":False,"speedup_claimed":False,
        "parent_native_attempt":"Initial native build failed with missing ../../locales fixture; failed reports preserved; no Rust tests ran.",
        "historical_preparation_sha256":digest(HERE / "preparation.json"),
        "fixture":{"destination":"locales/gameplay-core.json","source":"locales/gameplay-core.json","sha256":digest(target),
            "role":"unchanged old canonical compile-time test fixture, not Phase6 runtime catalog",
            "source_package_mapping":"When selected rust-copy is packaged as nethack/rust, retain this fixture as nethack/locales/gameplay-core.json; runtime selected catalog remains separately under web."},
        "copied_rust_source_unchanged":True,"current_canonical_fixture_unchanged":digest(source)==digest(target),
        "current_copied_rust_source_sha256":before,"preserved_failed_build_evidence_sha256":preserved,
        "literal_include_count":len(includes),"literal_include_audit":includes,
        "updated_preparer_sha256":digest(HERE / "prepare.py"),"repair_script_sha256":digest(HERE / "repair-fixtures.py")}
    (HERE / "fixture-repair.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
    return report


if __name__ == "__main__":
    report = repair()
    print(json.dumps({"status":report["status"],"literal_include_count":report["literal_include_count"],
                      "copied_rust_source_unchanged":True,"failed_evidence_preserved":True}))
