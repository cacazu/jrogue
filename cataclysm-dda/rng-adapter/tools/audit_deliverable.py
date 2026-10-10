"""Verify retained evidence hashes and produce a bounded source delivery manifest."""
import hashlib
import json
from pathlib import Path


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    root = Path(__file__).resolve().parents[1]
    verification = json.loads((root / "evidence/verification.json").read_text())
    for name, expected in verification["wasm_sha256"].items():
        assert sha(root / "build" / (name + ".wasm")) == expected, name
    for name in ["original", "adapted", "adapted-repeat", "original-o2", "adapted-o2"]:
        assert sha(root / "evidence" / (name + ".txt")) == verification["differential_output_sha256"], name
    actual_headers = json.loads((root / "evidence/actual-headers.json").read_text())
    for unit in actual_headers["translation_units"]:
        output = Path(unit["command"][-1])
        assert sha(output) == unit["object_sha256"], unit["source"]
    provenance = json.loads((root / "PROVENANCE.json").read_text())
    assert sha(root / "reference/original_rng.cpp") == provenance["source_files"]["src/rng.cpp"]
    assert sha(root / "fixtures/include/rng.h") == provenance["source_files"]["src/rng.h"]
    assert sha(root / "overlay/src/rng.cpp") == provenance["overlay_sha256_lf"]
    functions = {function["name"] for function in provenance["unchanged_original_functions"]}
    assert "djb2_hash" in functions and "rng_get_engine" in functions
    files = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if path.is_file() and relative.parts[0] != "build" and path.name != "SOURCE-MANIFEST.json":
            files[relative.as_posix()] = {"sha256": sha(path), "bytes": path.stat().st_size}
    manifest = {"upstream_commit": verification["upstream_commit"],
                "exclude_from_source_delivery": ["build/"],
                "retained_evidence_hashes_verified": True, "files": files}
    (root / "SOURCE-MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"source_delivery_files": len(files), "source_delivery_bytes": sum(value["bytes"] for value in files.values()),
                      "all_evidence_hashes_verified": True, "provenance_functions": len(functions)}))


if __name__ == "__main__":
    main()
