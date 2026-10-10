"""Archive initial source-only drafts and verify the three reviewed revisions.

Writes only the owned initial archive and separate revision proof checkpoint.
Does not build, alter frozen inputs/locks, or enable native/runtime bindings.
"""
import argparse
import hashlib
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[1]
HISTORY = BASE / "source-history/random-selected-text-batches13-16-initial"
REVIEW = ROOT / "tools/semantic-text/phase6-integration-review/random13-16-fidelity-review.json"
REVIEW_SHA = "269b25bee398cba065473614120128bc82c41e43b179f61ab988d5af7e517d17"
MANIFEST_SHA = "a860641aca07e53b78c055ad3e67085aa05ef0ed226a8e5ccee35593258b61a8"
INITIAL_HASHES = {
    13: "3f0ae312014fa3f9333e35cfbf44572ec97d48fe381a12a38a13a4c34f27f484",
    14: "25206647da9d5fafe84db3e0ecdae340ef64d0637d9649a620054150b7b270e5",
    15: "c7f0b5287ef9fa078841675df1b0bd4983d9a2a77f9f27ad70d11f2e6591db45",
    16: "39dbdf95b57d249e00e263b7782e36a36765a609f7f856d1a3a699e26390fec0",
}
CHANGES = {
    (13, 8): ("ダンテの店へようこそ。何層になさいますか？", "ダンテのところへようこそ。何層になさいますか？"),
    (15, 51): ("兵馬俑の戦士", "テラコッタの戦士"),
    (15, 86): ("重し入りのコンパニオン・キューブ", "重み付きのコンパニオン・キューブ"),
}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def save(path, value):
    path.write_bytes((json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))

def archive():
    assert sha(REVIEW) == REVIEW_SHA
    assert sha(BASE / "resource-authoring-batches.json") == MANIFEST_SHA
    assert not HISTORY.exists(), "Initial history already exists; never overwrite"
    files = [BASE / ("random-selected-text-batch-%d%s" % (n, suffix))
             for n in range(13, 17)
             for suffix in (".json", ".authored.json", ".resource-verification.json")]
    files += [BASE / "random-selected-text-batches-13-16.author.py",
              BASE / "random-selected-text-batches-13-16.translation-data.json", REVIEW]
    for n, expected in INITIAL_HASHES.items():
        assert sha(BASE / ("random-selected-text-batch-%d.authored.json" % n)) == expected
    HISTORY.mkdir(parents=True)
    artifacts = []
    for source in files:
        target = HISTORY / source.name
        raw = source.read_bytes()
        target.write_bytes(raw)
        assert target.read_bytes() == raw
        artifacts.append({"name": target.name, "bytes": len(raw), "sha256": sha(target),
                          "original_path": str(source.relative_to(ROOT)).replace("\\", "/")})
    checkpoint = {"schema_version": 1, "status": "complete-initial-source-authoring-archive",
                  "reviewed_ids": 400, "source_records": 400,
                  "initial_authored_sha256": INITIAL_HASHES,
                  "independent_fidelity_review_sha256": REVIEW_SHA,
                  "input_manifest_sha256": MANIFEST_SHA,
                  "artifacts": artifacts, "byte_identical_initial_copies": True,
                  "runtime_binding_approved": False,
                  "scope": "Prior full source-only catalogs, inputs, verification reports, repro/data and independent review retained before author revisions. No runtime approval."}
    target = HISTORY / "initial-checkpoint.json"
    save(target, checkpoint)
    print(json.dumps({"archive": str(HISTORY.relative_to(ROOT)), "files": len(files),
                      "checkpoint_sha256": sha(target), "runtime_approved_ids": 0}))

def verify():
    checkpoint_path = HISTORY / "initial-checkpoint.json"
    checkpoint = load(checkpoint_path)
    assert sha(REVIEW) == REVIEW_SHA
    assert sha(BASE / "resource-authoring-batches.json") == MANIFEST_SHA
    first = load(BASE / "random-selected-text-batches-13-16.first-regeneration.json")
    assert first["generator_sha256"] == sha(BASE / "random-selected-text-batches-13-16.author.py")
    assert first["translation_data_sha256"] == sha(BASE / "random-selected-text-batches-13-16.translation-data.json")
    for name, expected_sha in first["authored_sha256"].items():
        assert sha(BASE / name) == expected_sha, "Two regenerations differ: " + name
    for record in checkpoint["artifacts"]:
        assert sha(HISTORY / record["name"]) == record["sha256"]
    artifacts, changes = [], []
    source_records = 0
    for number in range(13, 17):
        filename = "random-selected-text-batch-%d.authored.json" % number
        current_path = BASE / filename
        initial = load(HISTORY / filename)
        current = load(current_path)
        input_path = BASE / ("random-selected-text-batch-%d.json" % number)
        original = load(input_path)
        assert sha(input_path) == sha(HISTORY / input_path.name) == current["input_sha256"]
        assert current["source_commit"] == initial["source_commit"]
        assert current["runtime_binding_approved"] is initial["runtime_binding_approved"] is False
        assert len(current["entries"]) == len(initial["entries"]) == len(original["entries"]) == 100
        for index, (old, new, source) in enumerate(zip(initial["entries"], current["entries"], original["entries"]), 1):
            assert new["id"] == old["id"] == source["id"]
            assert new["english_named_template"] == old["english_named_template"] == source["english_named_template"]
            assert new["source_records"] == old["source_records"] == source["source_records"]
            assert new["argument_schemas"] == old["argument_schemas"] == source["argument_schemas"]
            assert new["typed_arguments"] == old["typed_arguments"] == source["typed_arguments"]
            assert new["runtime_binding_approved"] is old["runtime_binding_approved"] is False
            assert new["source_review_status"] == old["source_review_status"] == "faithful-official-source-equivalent"
            source_records += len(new["source_records"])
            position = (number, index)
            if position in CHANGES:
                expected_old, expected_new = CHANGES[position]
                assert old["whole_message_ja"] == expected_old
                assert new["whole_message_ja"] == expected_new
                changes.append({"batch": number, "entry_index_one_based": index,
                                "id": new["id"], "english": new["english_named_template"],
                                "initial_japanese": expected_old, "revised_japanese": expected_new,
                                "review_disposition": "accepted source-only ambiguity/narrowing correction"})
            else:
                assert new["whole_message_ja"] == old["whole_message_ja"]
            allowed = {"whole_message_ja", "translation_notes"} if position in CHANGES else set()
            assert {k: v for k, v in new.items() if k not in allowed} == {k: v for k, v in old.items() if k not in allowed}
        validation_path = input_path.with_name(input_path.stem + ".resource-verification.json")
        validation = load(validation_path)
        assert validation["error_count"] == 0 and validation["runtime_approved_ids"] == 0
        assert validation["checks"]["authored_ids"] == 100
        artifacts.append({"batch": number, "ids": 100,
                          "initial_authored_sha256": INITIAL_HASHES[number],
                          "authored": filename, "authored_sha256": sha(current_path),
                          "bytes": current_path.stat().st_size,
                          "input_sha256": sha(input_path),
                          "source_verification_sha256": sha(validation_path),
                          "source_verification_assertions": validation["checks"]["assertions"]})
    assert len(changes) == 3 and source_records == 400
    data_path = BASE / "random-selected-text-batches-13-16.translation-data.json"
    assert all(load(BASE / a["authored"])["translation_data_sha256"] == sha(data_path) for a in artifacts)
    report = {"schema_version": 1, "status": "source-only-reviewed-revisions-verified",
              "ids": 400, "source_records": source_records, "changed_japanese_frames": 3,
              "initial_archive": str(HISTORY.relative_to(ROOT)).replace("\\", "/"),
              "initial_checkpoint_sha256": sha(checkpoint_path),
              "independent_fidelity_review_sha256": REVIEW_SHA,
              "input_manifest_sha256": MANIFEST_SHA,
              "artifacts": artifacts, "accepted_changes": changes,
              "generator_sha256": sha(BASE / "random-selected-text-batches-13-16.author.py"),
              "translation_data_sha256": sha(data_path),
              "two_regenerations_byte_identical": True,
              "first_regeneration_record_sha256": sha(BASE / "random-selected-text-batches-13-16.first-regeneration.json"),
              "runtime_binding_approved": False, "runtime_approved_ids": 0,
              "compiled_pipeline_verified": False, "browser_invoked": False, "node_invoked": False,
              "scope": "Whole source-selected texts only; unchanged English IDs/source ownership/input hashes/typed unions and byte-identical preserved initial evidence. Three reviewed Japanese refinements accepted. No source lock, engine, Rust, native capture, runtime or publication approval."}
    target = BASE / "random-selected-text-batches-13-16.revised-source-verification.json"
    save(target, report)
    print(json.dumps({"path": target.name, "sha256": sha(target), "ids": 400,
                      "source_records": source_records, "changed_japanese_frames": len(changes),
                      "artifacts": artifacts, "runtime_approved_ids": 0}))

def record_first():
    assert HISTORY.exists()
    generator = BASE / "random-selected-text-batches-13-16.author.py"
    data = BASE / "random-selected-text-batches-13-16.translation-data.json"
    value = {"schema_version": 1, "scope": "First revised regeneration hash record; source only",
             "generator_sha256": sha(generator), "translation_data_sha256": sha(data),
             "authored_sha256": {"random-selected-text-batch-%d.authored.json" % n:
                                  sha(BASE / ("random-selected-text-batch-%d.authored.json" % n))
                                  for n in range(13, 17)}, "runtime_binding_approved": False}
    target = BASE / "random-selected-text-batches-13-16.first-regeneration.json"
    assert not target.exists(), "Never overwrite the first regeneration proof"
    save(target, value)
    print(json.dumps({"path": target.name, "sha256": sha(target), "runtime_approved_ids": 0}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-initial", action="store_true")
    parser.add_argument("--record-first-generation", action="store_true")
    options = parser.parse_args()
    if options.archive_initial:
        archive()
    elif options.record_first_generation:
        record_first()
    else:
        verify()
