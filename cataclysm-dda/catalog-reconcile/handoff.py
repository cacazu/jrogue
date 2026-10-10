"""Build translator chunks and a source-current corpus for catalog compilers."""
from collections import Counter, defaultdict
import json
from pathlib import Path

import reconcile

OUT = Path(__file__).resolve().parent / "output"


def read_records(name):
    with (OUT / name).open(encoding="utf-8") as stream:
        for line in stream:
            yield json.loads(line)


def main():
    gap_data = json.loads((OUT / "source-catalog-gaps.json").read_text(encoding="utf-8"))
    missing = [r for r in gap_data["records"] if "missing-source-key" in r["catalogStatuses"]]
    previous_handoff = OUT / "current-source-gaps.json"
    if previous_handoff.exists():
        previous = json.loads(previous_handoff.read_text(encoding="utf-8"))
        previous_order = {reconcile.key(r): r["index"] for r in previous["records"]}
        missing.sort(key=lambda r: previous_order.get(reconcile.key(r), len(previous_order)))
    by_file = defaultdict(list)
    for row in missing:
        for binding in row["bindings"]:
            if binding.get("sourceFile"):
                by_file[binding["sourceFile"]].append(row)
    nearby = defaultdict(list)
    for row in read_records("json-records.jsonl"):
        if row["sourceFile"] in by_file and row.get("ja") and row["catalogStatus"] in ("translated", "patched"):
            nearby[row["sourceFile"]].append({"file": row["sourceFile"], "jsonPointers": row["jsonPointers"], "ownerPointer": row["ownerPointer"], "ownerType": row["ownerType"], "context": row["context"], "singular": row["singular"], "ja": row["ja"]})
    collisions = {r["semanticId"] for r in read_records("semantic-id-collisions.jsonl")}
    translated = []
    for number, row in enumerate(missing):
        bindings = row["bindings"]
        refs, samples, semantic_ids, field_types = [], [], [], []
        for b in bindings:
            if b.get("semanticId") and b["semanticId"] not in semantic_ids:
                semantic_ids.append(b["semanticId"])
            if "sourceFile" in b:
                for p in b["jsonPointers"]:
                    refs.append({"file": b["sourceFile"], "jsonPointer": p, "ownerType": b["ownerType"], "ownerIdentity": b["ownerIdentity"], "bindingStatus": b["bindingStatus"]})
                    field = p.rsplit("/", 1)[-1]
                    if field not in field_types:
                        field_types.append(field)
                if not b["jsonPointers"]:
                    refs.append({"file": b["sourceFile"], "ownerPointer": b["ownerPointer"], "ownerType": b["ownerType"], "ownerIdentity": b["ownerIdentity"], "bindingStatus": b["bindingStatus"]})
                candidates = nearby[b["sourceFile"]]
                owner_index = int(b["ownerPointer"][1:]) if b["ownerPointer"][1:].isdigit() else 0
                def distance(sample):
                    p = sample["ownerPointer"][1:]
                    return abs(int(p) - owner_index) if p.isdigit() else 100000
                for sample in sorted(candidates, key=distance)[:4]:
                    if sample not in samples:
                        samples.append(sample)
            else:
                refs.extend({"cppReference": r} for r in b.get("references", []))
                if "cpp-literal" not in field_types:
                    field_types.append("cpp-literal")
        semantic_status = "reviewed-definition-field-candidate" if all(b.get("semanticStatus") == "definition-field" and b.get("semanticId") not in collisions for b in bindings) else "semantic-review-required"
        translated.append({"index": number, "catalogKey": json.dumps([row["context"], row["singular"]], ensure_ascii=False, separators=(",", ":")),
                           "context": row["context"], "singular": row["singular"], "plural": row["plurals"][0] if row["plurals"] else None,
                           "pluralVariants": row["plurals"], "fieldTypes": field_types, "references": refs, "sourceBindings": bindings,
                           "semanticIds": semantic_ids, "semanticStatus": semantic_status, "nearbyTranslatedTerminology": samples[:6], "ja": None})
    document = {"sourceCommit": reconcile.COMMIT, "sourceVersion": "0.I-1", "count": len(translated), "scope": "Current official C++ and JSON extracted keys absent from active JA catalog; excludes 15 independent raw-source explicit-plural fidelity reviews.", "records": translated}
    (OUT / "current-source-gaps.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for i, (start, stop) in enumerate(((0, 180), (180, 360), (360, 539)), 1):
        chunk = {**document, "count": stop - start, "range": [start, stop - 1], "records": translated[start:stop]}
        (OUT / f"current-source-gaps-{i}.json").write_text(json.dumps(chunk, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    corpus = {}
    for name in ("cpp-records.jsonl", "json-records.jsonl"):
        for row in read_records(name):
            pair = reconcile.key(row)
            item = corpus.setdefault(pair, {"context": pair[0], "singular": pair[1], "plural": None, "pluralVariants": [], "explicitPluralVariants": [], "sourceKinds": [], "references": [], "ja": row.get("ja"), "catalogStatus": row["catalogStatus"]})
            if row.get("plural") not in item["pluralVariants"]:
                item["pluralVariants"].append(row.get("plural"))
            if row.get("plural"):
                # C++ extraction precedes JSON, matching official update_pot.
                if not item["plural"]:
                    item["plural"] = row["plural"]
                if name == "cpp-records.jsonl" or row.get("explicitPlural"):
                    if row["plural"] not in item["explicitPluralVariants"]:
                        item["explicitPluralVariants"].append(row["plural"])
                    if name == "json-records.jsonl" and not ("cpp" in item["sourceKinds"] and item["plural"]):
                        item["plural"] = row["plural"]
            kind = "cpp" if name == "cpp-records.jsonl" else "json"
            if kind not in item["sourceKinds"]:
                item["sourceKinds"].append(kind)
            if kind == "cpp":
                for ref in row["references"]:
                    if ref not in item["references"]:
                        item["references"].append(ref)
            else:
                ref = {"file": row["sourceFile"], "jsonPointers": row["jsonPointers"], "ownerPointer": row["ownerPointer"], "ownerType": row["ownerType"], "semanticId": row["semanticId"], "semanticStatus": row["semanticStatus"]}
                item["references"].append(ref)
    with (OUT / "current-source-key-manifest.jsonl").open("w", encoding="utf-8") as stream:
        for record in corpus.values():
            record["pluralSelectionStatus"] = "multiple-source-plurals-preserved" if len({p for p in record["pluralVariants"] if p}) > 1 else "unambiguous-source"
            reconcile.emit(stream, record)
    stats = {"missingKeys": len(translated), "chunks": [180, 180, 179], "sourceKeyManifest": len(corpus), "missingFieldTypes": dict(Counter(t for r in translated for t in r["fieldTypes"])), "missingWithPluralVariants": sum(any(r["pluralVariants"]) for r in translated), "missingSourceKindCounts": dict(Counter("cpp" if all("cppReference" in x for x in r["references"]) else "json" for r in translated))}
    (OUT / "handoff-summary.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
