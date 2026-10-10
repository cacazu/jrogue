"""Additive correction overlay; frozen resource queues stay byte-exact."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = ROOT.parent / "official-source-audit/NetHack-5.0.0"

def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value

def main():
    inv = module(ROOT / "tools/inventory_source.py", "resource_overlay_inventory")
    cat = module(ROOT / "locales/build-gameplay-catalog.py", "resource_overlay_catalog")
    manifest_path = HERE / "resource-authoring-batches.json"
    before = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    data = json.loads((HERE / "resource-units.json").read_text(encoding="utf-8"))
    cpath = SOURCE / "src/rumors.c"
    craw = cpath.read_bytes()
    ctext = craw.decode("utf-8")
    marker = "[cookie] "
    assert 'static const char *cookie_marker = "[cookie] ";' in ctext
    assert "if (!exclude_cookie\n        && !strncmp(rumor_buf, cookie_marker, marklen))" in ctext
    rows = []
    for entry in data["entries"]:
        if entry["source"] not in {"dat/rumors.tru", "dat/rumors.fal"}:
            continue
        original = entry["english_source_literal"]
        if not original.startswith(marker):
            continue
        public = original[len(marker):]
        public_id = inv.semantic_candidate("nethack.resource.rumor", public)
        rows.append({"private_original_source_unit_id": entry["id"],
                     "source": entry["source"], "source_line": entry["source_start_line"],
                     "source_sha256": entry["source_sha256"], "original_resource_line": original,
                     "native_transformation": "getrumor conditionally removes the fixed cookie_marker at its original branch",
                     "original_marker_literal": marker, "original_marker_byte_length": len(marker),
                     "original_branch_evidence": {"source": "src/rumors.c", "source_sha256": hashlib.sha256(craw).hexdigest(),
                         "marker_lines": [125,126], "selection_filter_lines": [169,170], "removal_lines": [180,188],
                         "predicate": "!exclude_cookie && !strncmp(rumor_buf, cookie_marker, marklen)",
                         "capture_requirement": "capture the original branch outcome where it already executes; do not rerun its predicate/RNG or infer it from final English bytes"},
                     "public_event_after_original_removal": {"id": public_id, "en": cat.escape(public), "argument_schemas": []},
                     "public_event_if_removal_not_executed": "native literal fallback pending exact exceptional-source contract; preserve original callback/error behavior and any originally visible marker",
                     "japanese_build_time_contract": "Current authored source fragment retains the exact literal marker. Future source-ID-selected converter asserts that prefix and removes exactly its nine ASCII bytes at build time for the declared removal branch; no runtime English/Japanese string matching.",
                     "runtime_marker_bearing_template_approval": False,
                     "no_truth_bucket_in_player_id_or_args": True,
                     "runtime_binding_approved": False})
    assert len(rows) == 17
    assert len({row["public_event_after_original_removal"]["id"] for row in rows}) == 17
    assert before == hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    output = {"schema_version": 1, "kind": "additive-source-transformation-overlay",
              "frozen_authoring_manifest_sha256": before,
              "frozen_queues_and_authored_fragments_modified": False,
              "source_correction": "cookie control markers are not ordinary public rumor text after the native removal branch",
              "entries": rows, "runtime_binding_approved": False,
              "reconciliation_required": "Future catalog/binding merger must apply this overlay by original source origin before claiming public resource coverage; original source IDs remain offline author/provenance identifiers only."}
    path = HERE / "resource-transformations.overlay.json"
    raw = (json.dumps(output, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    path.write_bytes(raw)
    print(json.dumps({"source_corrections": len(rows), "frozen_manifest_unchanged": True,
                      "runtime_approved": 0, "sha256": hashlib.sha256(raw).hexdigest()}))

if __name__ == "__main__":
    main()
