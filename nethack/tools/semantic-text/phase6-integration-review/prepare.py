"""Prepare isolated compatibility fixtures; never compile or edit production inputs."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RUST = ROOT / "rust"
SOURCE_PATHS = {
    "baseline": "locales/gameplay-core.json",
    "helper": "tools/semantic-text/phase6-helper-producers/catalog.source-reviewed.json",
    "monster": "tools/semantic-text/phase6-monster-producers/generated/catalog-fragment.json",
    "object": "tools/semantic-text/phase6-object-producers/generated/catalog-fragment.json",
    "native": "tools/semantic-text/phase6-native-api/generated/catalog.json",
}
PROPOSAL_PATHS = [
    "tools/semantic-text/phase6-helper-producers/bridge.c.in",
    "tools/semantic-text/phase6-helper-producers/bridge.h.in",
    "tools/semantic-text/phase6-helper-producers/coverage.manifest.json",
    "tools/semantic-text/phase6-monster-producers/prepare.py",
    "tools/semantic-text/phase6-monster-producers/bridge-extension.c.in",
    "tools/semantic-text/phase6-monster-producers/bridge-extension.h.in",
    "tools/semantic-text/phase6-object-producers/prepare.py",
    "tools/semantic-text/phase6-object-producers/bridge-extension.c.in",
    "tools/semantic-text/phase6-object-producers/bridge-extension.h.in",
    "tools/semantic-text/phase6-object-producers/verification.json",
    "tools/semantic-text/phase6-native-api/prepare.py",
    "tools/semantic-text/phase6-native-api/nh-native-api.c.in",
    "tools/semantic-text/phase6-native-api/nh-native-api.h.in",
    "tools/semantic-text/phase6-native-api/bridge-extension.c.in",
    "tools/semantic-text/phase6-native-api/generated/source-manifest.json",
    "tools/semantic-text/phase6-native-api/generated/source-proof.json",
]
COPY_PATHS = ["Cargo.toml", "Cargo.lock"] + [
    "src/" + name for name in
    ["application.rs", "domain.rs", "ffi.rs", "lib.rs", "platform.rs", "presentation.rs"]
]
PROTECTED_PATHS = ["rust/" + path for path in COPY_PATHS] + [
    "rust/.cargo/config.toml", "rust/source-checkpoint-phase3-formatted.json",
    "locales/gameplay-core.metadata.json", "tools/semantic-text/nh-semantic-name.c",
    "tools/semantic-text/nh-semantic-name.h",
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def safe_output(path: Path) -> Path:
    path = path.resolve()
    if not path.is_relative_to(HERE):
        raise ValueError("outputs must stay inside phase6-integration-review")
    return path


def valid_id(value: str) -> bool:
    if not isinstance(value, str) or not value or len(value.encode("utf-8")) > 160:
        return False
    segments = value.split(".")
    return all(bool(re.fullmatch(r"[a-z][a-z0-9_]*", part)) or
               (index == len(segments) - 1 and index != 0 and
                bool(re.fullmatch(r"[0-9a-f]{10}", part)))
               for index, part in enumerate(segments))


def project(kind: str, data: dict) -> dict:
    """Project reviewed metadata explicitly; do not relax Rust deny_unknown_fields."""
    if kind == "helper":
        en, ja, schemas = {}, {}, {}
        for row in data["entries"]:
            if not row["descriptor_enabled"]:
                continue
            if row["arguments"] != [] or row["argument_schemas"] != [[]]:
                raise ValueError("helper projection supports only its proven leaf schema")
            if not isinstance(row["ja"], str):
                raise ValueError("enabled helper has no reviewed Japanese template")
            if row["id"] in en:
                raise ValueError("duplicate helper ID")
            en[row["id"]], ja[row["id"]], schemas[row["id"]] = row["en"], row["ja"], []
        return {"en": en, "ja": ja, "argument_schemas": schemas}
    return {"en": data["en"], "ja": data["ja"],
            "argument_schemas": data.get("argument_schemas", {})}


def placeholder_names(template: str) -> set[str]:
    # Source-only schema check. Rust parsing/printf execution remains gated.
    escaped = template.replace("{{", "").replace("}}", "")
    return set(re.findall(r"\{([a-zA-Z][a-zA-Z0-9_]*)(?::[^{}]*)?\}", escaped))


def check_catalog(data: dict) -> dict:
    if set(data) != {"en", "ja", "argument_schemas"}:
        raise ValueError("runtime fixture contains metadata keys")
    if not set(data["ja"]).issubset(data["en"]) or not set(data["argument_schemas"]).issubset(data["en"]):
        raise ValueError("non-English source ID")
    max_args, max_id = 0, 0
    for key, english in data["en"].items():
        if not valid_id(key):
            raise ValueError("ID incompatible with actual Rust grammar: " + key)
        max_id = max(max_id, len(key.encode("utf-8")))
        source_names = placeholder_names(english)
        ja_names = placeholder_names(data["ja"][key]) if key in data["ja"] else source_names
        if key in data["argument_schemas"]:
            names = data["argument_schemas"][key]
            if len(set(names)) != len(names) or len(names) > 64:
                raise ValueError("duplicate or over-bound argument union")
            if any(not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_]*", name) or len(name) > 64 for name in names):
                raise ValueError("invalid argument name")
            if not (source_names | ja_names).issubset(names):
                raise ValueError("undeclared placeholder for " + key)
        elif source_names != ja_names:
            raise ValueError("locale-specific names need explicit union for " + key)
        max_args = max(max_args, len(data["argument_schemas"].get(key, source_names)))
    encoded = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if len(encoded) > 16 * 1024 * 1024:
        raise ValueError("over-bound catalog")
    return {"english_ids": len(data["en"]), "japanese_ids": len(data["ja"]),
            "argument_schemas": len(data["argument_schemas"]),
            "max_id_bytes": max_id, "max_argument_union": max_args,
            "json_bytes": len(encoded)}


def write_json(path: Path, data) -> None:
    path = safe_output(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def prepare(output: Path = HERE / "rust-copy") -> dict:
    output = safe_output(output)
    before = {name: digest(ROOT / name) for name in PROTECTED_PATHS}
    catalog_inputs = {name: digest(ROOT / path) for name, path in SOURCE_PATHS.items()}
    if catalog_inputs["baseline"] != "c79fe2a3e4b74811bf83c28e6defb63d44b25fb9a610b1931f055b88d11337d4":
        raise ValueError("frozen baseline differs")
    catalogs = {name: project(name, read_json(ROOT / path)) for name, path in SOURCE_PATHS.items()}
    counts = {name: check_catalog(data) for name, data in catalogs.items()}
    combined = {"en": {}, "ja": {}, "argument_schemas": {}}
    identical_source_overlaps = []
    for kind, data in catalogs.items():
        for section in combined:
            collisions = set(combined[section]) & set(data[section])
            for key in sorted(collisions):
                if combined[section][key] != data[section][key]:
                    raise ValueError("conflicting cross-proposal ID: " + key)
                if section == "en":
                    identical_source_overlaps.append({"id": key, "proposal": kind,
                        "policy": "identical English source only; retain existing Japanese and validate declared union"})
            combined[section].update(data[section])
    counts["combined"] = check_catalog(combined)
    for relative in COPY_PATHS:
        target = safe_output(output / relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((RUST / relative).read_bytes())
    # Read the existing offline vendor in place; no vendor/cache or global config writes.
    config = safe_output(output / ".cargo/config.toml")
    config.parent.mkdir(parents=True, exist_ok=True)
    vendor = str((RUST / "vendor").resolve()).replace("\\", "/")
    config.write_text('[source.crates-io]\nreplace-with = "vendored-sources"\n'
                      '[source.vendored-sources]\ndirectory = ' + json.dumps(vendor) + '\n', encoding="utf-8")
    for name, data in catalogs.items():
        write_json(output / "fixtures" / (name + ".json"), data)
    write_json(output / "fixtures" / "combined.json", combined)
    write_json(output / "fixtures" / "monster-source-metadata.json",
               read_json(ROOT / SOURCE_PATHS["monster"]))
    tests = safe_output(output / "tests/phase6_contracts.rs")
    tests.parent.mkdir(parents=True, exist_ok=True)
    tests.write_bytes((HERE / "phase6_contracts.rs.in").read_bytes())
    after = {name: digest(ROOT / name) for name in PROTECTED_PATHS}
    if before != after:
        raise ValueError("protected source changed during isolated preparation")
    report = {
        "schema_version": 1, "status": "source-only-compatibility-fixtures-prepared",
        "compiler_executed": False, "rust_tests_executed": False, "runtime_binding_approved": False,
        "production_rust_changes_required": False,
        "reason": "Plain context APIs already accept every proposed ASCII API; existing event/union limits support all projected recipes.",
        "rust_test_source_count": tests.read_text(encoding="utf-8").count("#[test]"),
        "source_catalog_checks": counts, "catalog_input_sha256": catalog_inputs,
        "identical_source_overlaps": identical_source_overlaps,
        "proposal_input_sha256": {path: digest(ROOT / path) for path in PROPOSAL_PATHS},
        "protected_inputs_unchanged": True, "protected_input_sha256": before,
        "copied_source_sha256": {relative: digest(output / relative) for relative in COPY_PATHS},
        "config_adaptation": "Isolated offline vendor directory only; original config unchanged.",
        "isolated_artifact_sha256": {
            str(path.relative_to(output)).replace("\\", "/"): digest(path)
            for path in sorted(output.rglob("*")) if path.is_file()
        },
    }
    write_json(HERE / "compatibility-preparation.json", report)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=HERE / "rust-copy")
    args = parser.parse_args()
    result = prepare(args.output)
    print(json.dumps({"status": result["status"], "counts": result["source_catalog_checks"],
                      "rust_tests_executed": False, "protected_inputs_unchanged": True}, ensure_ascii=False))
