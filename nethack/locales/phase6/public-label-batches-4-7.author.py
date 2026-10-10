"""Reproduce only source-reviewed public-label catalogs 4--7. No runtime binding.

NetHack source/evidence retains the NetHack General Public License and notices.
Japanese is newly authored from the pinned official public English labels.
"""
import hashlib
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
MANIFEST_SHA = "a860641aca07e53b78c055ad3e67085aa05ef0ed226a8e5ccee35593258b61a8"
INPUT_HASHES = {
    4: "b9a4e6957aa276971c37f2ae25ce4beb3f4479c1449d8c9528fbb0a51cd5c326",
    5: "8e24521287bb17bda6650081575fbd2d0b1d4e8127a3f58e3a4dc8b23228fa5a",
    6: "64d87aeff5c1b8fc8a9366d75aca71d0d1e1a1042f6903b2b7985c72a461640c",
    7: "624b2aa2a1cc3b9251eb5c3548c76b015819c18438ac04c042dfc7da3e19c15c",
}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def notes(original):
    english = original["english_named_template"]
    categories = sorted({r["category"] for r in original["source_records"]})
    note = ("Translate the already selected public " + ", ".join(categories)
            + " label: " + repr(english) + ". Preserve its action/state, scope, qualifiers, "
            "negation, quantities and examples. Exact original source tokens/offsets and "
            "the empty argument union are retained. Capture must follow the original "
            "selected label once; no repeated selection or English reverse lookup. ")
    if "option_description" in categories:
        note += ("This translates the description only. Original option names, aliases, "
                 "option_key_expression, configuration identifiers and key examples "
                 "remain native parser tokens, including any tokens printed in Japanese. ")
    if "command_description" in categories:
        note += ("Original command names, dispatch keys, prefix behavior and debug-only "
                 "guards are unchanged; translation adds no command capability. ")
    if "status_encumbrance" in categories:
        note += ("This is the original selected carried-load severity label, not a "
                 "psychological condition; no weight or threshold is newly queried. ")
    if "status_hu_stat" in categories:
        note += ("The original eight ASCII display cells are represented by eight "
                 "Japanese terminal display cells (two per Japanese character) with "
                 "explicit trailing ASCII spaces. Normal hunger remains eight spaces. "
                 "UTF-8 byte length differs: native formatting/precision, display-cell "
                 "width and consumer capture must be proven before runtime activation; "
                 "otherwise retain the whole original English frame. ")
    if not english.strip():
        note += "Preserve the exact original empty/space-only structural label, not a missing translation. "
    if "little dog" in english or "pony" in english:
        note += "Size/breed is preserved without asserting that the animal is young. "
    if "peaceful" in english:
        note += "Peaceful means nonhostile here; friendliness is not asserted. "
    if "possibly" in english:
        note += "The source's possibility qualifier remains conditional, not a guaranteed action. "
    if "genocided" in english:
        note += "Magical genocide and natural extinction remain separate selected meanings. "
    if "rest one move" in english:
        note += "One move remains one move; no extra claim about global turn scheduling. "
    if "known spells" in english:
        note += "Known spells remain known; unidentified spell contents are not inferred. "
    return note.strip()

def main():
    manifest_path = BASE / "resource-authoring-batches.json"
    assert digest(manifest_path) == MANIFEST_SHA
    manifest = load(manifest_path)
    data_path = BASE / "public-label-batches-4-7.translation-data.json"
    data = load(data_path)
    assert data["input_manifest_sha256"] == MANIFEST_SHA
    assert data["runtime_binding_approved"] is False
    outputs = []
    for number in range(4, 8):
        source_path = BASE / ("public-label-batch-%d.json" % number)
        assert digest(source_path) == INPUT_HASHES[number]
        source = load(source_path)
        japanese = data["batch_%d" % number]
        assert len(japanese) == len(source["entries"]) == (62 if number == 7 else 100)
        entries = []
        for original, translated in zip(source["entries"], japanese):
            assert original["argument_schemas"] == original["typed_arguments"] == []
            assert isinstance(translated, str)
            assert translated or original["english_named_template"] == ""
            entry = {
                "id": original["id"],
                "english_named_template": original["english_named_template"],
                "whole_message_ja": translated,
                "source_review_status": "faithful-official-source-equivalent",
                "translation_notes": notes(original),
                "typed_arguments": original["typed_arguments"],
                "argument_schemas": original["argument_schemas"],
                "source_records": original["source_records"],
                "runtime_binding_approved": False,
            }
            if not original["english_named_template"].strip():
                assert translated == original["english_named_template"]
                entry["localization_disposition"] = "preserved-structural-spacer"
                entry["structural_spacer"] = True
            entries.append(entry)
        target = source_path.with_name(source_path.stem + ".authored.json")
        authored = {
            "schema_version": 1,
            "source_commit": manifest["source_commit"],
            "input_sha256": INPUT_HASHES[number],
            "input_manifest_sha256": MANIFEST_SHA,
            "translation_data_sha256": digest(data_path),
            "source_rights": "Pinned official NetHack source; retain NGPL and original notices. Newly authored Japanese; no third-party proprietary excerpts.",
            "scope": "Whole selected public labels; source review only. Native source hooks, consumer formatting, lifetime and runtime remain unapproved.",
            "runtime_binding_approved": False,
            "entries": entries,
        }
        target.write_bytes((json.dumps(authored, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        outputs.append({"path": target.name, "ids": len(entries), "bytes": target.stat().st_size, "sha256": digest(target)})
    print(json.dumps(outputs))

if __name__ == "__main__":
    main()
