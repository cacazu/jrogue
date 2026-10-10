"""Independent, read-only source traversal for all final translation bindings."""
from collections import Counter
import json
from pathlib import Path

import reconcile

OUT = Path(__file__).resolve().parent / "output"


def traverse(document, pointer):
    node = document
    for part in pointer.split("/")[1:]:
        part = part.replace("~1", "/").replace("~0", "~")
        node = node[int(part)] if isinstance(node, list) else node[part]
    return node


def main():
    handoff = json.loads((OUT / "current-source-gaps.json").read_text(encoding="utf-8"))
    prior = json.loads((OUT / "verification.json").read_text(encoding="utf-8"))
    summary = json.loads((OUT / "summary.json").read_text(encoding="utf-8"))
    chunks, chunk_hashes = [], {}
    for n in range(1, 4):
        p = OUT / f"current-source-gaps-{n}.json"
        chunk_hashes[p.name] = reconcile.digest(p)
        chunks.extend(json.loads(p.read_text(encoding="utf-8"))["records"])
    failures, checks, documents, file_hashes = [], Counter(), {}, {}

    def document(file):
        if file not in documents:
            path = reconcile.DEFAULT_SOURCE / file
            documents[file] = json.loads(path.read_text(encoding="utf-8"))
            file_hashes[file] = reconcile.digest(path)
        return documents[file]

    def check_value(file, pointer, singular, plurals, context, role, index):
        checks[role + "PointersChecked"] += 1
        try:
            value = traverse(document(file), pointer)
            if isinstance(value, str):
                source_singular = value
            elif isinstance(value, dict):
                source_singular = value.get("str_sp") if any(plurals) and "str_sp" in value else value.get("str")
                if isinstance(value.get("ctxt"), str) and value["ctxt"] != context:
                    raise ValueError("gettext context differs")
                if any(plurals) and "str_pl" in value and value["str_pl"] not in plurals:
                    raise ValueError("explicit plural is absent from source plural variants")
                if any(plurals) and "str_sp" in value and value["str_sp"] not in plurals:
                    raise ValueError("invariant plural is absent from source plural variants")
            else:
                raise ValueError("bound source field is neither string nor translation object")
            if source_singular != singular:
                raise ValueError("bound source English differs from record")
        except Exception as exc:
            failures.append({"index": index, "role": role, "file": file, "pointer": pointer, "singular": singular, "error": str(exc)})

    for row in chunks:
        checks["translationRecordsChecked"] += 1
        for binding in row["sourceBindings"]:
            if "sourceFile" not in binding:
                checks["cppRecordsUsingOfficialExtraction"] += 1
                continue
            checks["jsonBindingsChecked"] += 1
            file = binding["sourceFile"]
            if binding["bindingStatus"] != "exact-pointer":
                failures.append({"index": row["index"], "error": "non-exact binding in missing source key handoff", "binding": binding})
                continue
            try:
                owner = traverse(document(file), binding["ownerPointer"])
                checks["ownerDefinitionsChecked"] += 1
                assert owner["type"].lower() == binding["ownerType"], "owner type differs"
                assert reconcile.owner_identity(owner)[0] == binding["ownerIdentity"], "owner identity differs"
            except Exception as exc:
                failures.append({"index": row["index"], "role": "owner", "file": file, "pointer": binding["ownerPointer"], "error": str(exc)})
            for pointer in binding["jsonPointers"]:
                check_value(file, pointer, row["singular"], row["pluralVariants"], row["context"], "translation", row["index"])
        for sample in row["nearbyTranslatedTerminology"]:
            for pointer in sample["jsonPointers"]:
                # Nearby samples do not carry plural metadata. Accept either
                # translation-object singular representation without guessing a
                # plural key; this verifies the English terminology reference.
                try:
                    value = traverse(document(sample["file"]), pointer)
                    actual = value if isinstance(value, str) else value.get("str", value.get("str_sp"))
                    checks["nearbyTerminologyPointersChecked"] += 1
                    assert actual == sample["singular"], "nearby English source differs"
                except Exception as exc:
                    failures.append({"index": row["index"], "role": "nearby-terminology", "file": sample["file"], "pointer": pointer, "error": str(exc)})
    current_gap_hash = reconcile.digest(OUT / "current-source-gaps.json")
    checks["chunksExactlyEqualFullHandoff"] = chunks == handoff["records"]
    checks["fullHandoffHashMatchesFinalVerification"] = current_gap_hash == prior["artifactDigests"]["current-source-gaps.json"]
    if not checks["chunksExactlyEqualFullHandoff"] or not checks["fullHandoffHashMatchesFinalVerification"]:
        failures.append({"error": "handoff or chunks differ from final verification"})
    result = {"sourceCommit": reconcile.COMMIT, "sourceVersion": "0.I-1", "status": "passed" if not failures else "failed", "checks": dict(checks),
              "failures": failures, "currentSourceRoot": str(reconcile.DEFAULT_SOURCE), "checkedSourceFileSha256": file_hashes,
              "chunkInputSha256": chunk_hashes, "fullHandoffSha256": current_gap_hash,
              "finalSummarySha256": reconcile.digest(OUT / "summary.json"),
              "finalSummaryHashMatchesPriorVerification": reconcile.digest(OUT / "summary.json") == prior["artifactDigests"]["summary.json"],
              "psychicKnacks": {"file": "data/mods/MindOverMatter/help_files.json", "pointer": "/7/name", "actualEnglish": traverse(document("data/mods/MindOverMatter/help_files.json"), "/7/name"), "fileSha256": file_hashes["data/mods/MindOverMatter/help_files.json"]},
              "artifactsRegenerated": False, "runtimeConnected": False,
              "scope": "Independent immutable-source JSON pointer, translation-object English/plural/context and owner-identity traversal for all 539 final gap records; 14 C++ keys rely on the previously verified official xgettext extraction. No broad runtime, dynamic expression or semantic-ID completeness claim."}
    (OUT / "539-binding-verification.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "checkedSourceFileSha256"}, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
