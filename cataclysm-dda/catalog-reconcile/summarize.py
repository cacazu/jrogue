"""Stream exact records into compact, actionable deduplicated review files."""
from collections import Counter, defaultdict
import json
from pathlib import Path

import reconcile

OUT = Path(__file__).resolve().parent / "output"


def main():
    summary = json.loads((OUT / "summary.json").read_text(encoding="utf-8"))
    gaps = {}
    plural_reviews = {}
    binding_types, semantic_collisions = Counter(), {}
    candidates = {}
    for name in ("json-records.jsonl", "cpp-records.jsonl"):
        with (OUT / name).open(encoding="utf-8") as stream:
            for line in stream:
                row = json.loads(line)
                pair = reconcile.key(row)
                binding = {k: row[k] for k in ("sourceFile", "ownerPointer", "ownerType", "ownerIdentity", "jsonPointers", "bindingStatus", "semanticId", "semanticStatus") if k in row}
                if "references" in row:
                    binding["references"] = row["references"]
                if row["catalogStatus"] not in ("translated", "patched"):
                    target = gaps.setdefault(pair, {"context": pair[0], "singular": pair[1], "plurals": [], "catalogStatuses": [], "bindings": []})
                    if row.get("plural") not in target["plurals"]:
                        target["plurals"].append(row.get("plural"))
                    if row["catalogStatus"] not in target["catalogStatuses"]:
                        target["catalogStatuses"].append(row["catalogStatus"])
                    target["bindings"].append(binding)
                    target["existingJa"] = row.get("ja")
                    target["catalogLine"] = row.get("catalogLine")
                if row["pluralMatch"] in ("explicit-plural-mismatch", "implicit-plural-review"):
                    target = plural_reviews.setdefault(pair, {"context": pair[0], "singular": pair[1], "plurals": [], "statuses": [], "bindings": []})
                    if row.get("plural") not in target["plurals"]:
                        target["plurals"].append(row.get("plural"))
                    if row["pluralMatch"] not in target["statuses"]:
                        target["statuses"].append(row["pluralMatch"])
                    target["bindings"].append(binding)
                if name == "json-records.jsonl":
                    if row["bindingStatus"] != "exact-pointer":
                        binding_types[(row["bindingStatus"], row["ownerType"])] += 1
                    sid = row.get("semanticId")
                    if sid:
                        candidate = candidates.setdefault(sid, {"semanticId": sid, "context": pair[0], "singular": pair[1], "plural": row["plural"], "ja": row.get("ja"), "status": row["semanticStatus"], "bindings": []})
                        candidate["bindings"].append(binding)
                        if (candidate["context"], candidate["singular"]) != pair:
                            collision = semantic_collisions.setdefault(sid, {"semanticId": sid, "keys": [[candidate["context"], candidate["singular"]]], "bindings": list(candidate["bindings"])})
                            if list(pair) not in collision["keys"]:
                                collision["keys"].append(list(pair))
                            collision["bindings"].append(binding)
    catalog = {reconcile.key(e): e for e in reconcile.po_entries(reconcile.DEFAULT_SOURCE / "lang/po/ja.po") if e.get("singular") and not e["obsolete"]}
    for pair, row in plural_reviews.items():
        row["catalogPlural"] = catalog[pair].get("plural")
        row["ja"] = catalog[pair]["translations"].get("0")
    unique_counts = Counter(status for row in gaps.values() for status in row["catalogStatuses"])
    (OUT / "source-catalog-gaps.json").write_text(json.dumps({"sourceCommit": reconcile.COMMIT, "counts": dict(unique_counts), "records": list(gaps.values())}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "source-plural-reviews.json").write_text(json.dumps({"sourceCommit": reconcile.COMMIT, "counts": dict(Counter(s for r in plural_reviews.values() for s in r["statuses"])), "records": list(plural_reviews.values())}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (OUT / "semantic-id-collisions.jsonl").open("w", encoding="utf-8") as stream:
        for record in semantic_collisions.values():
            reconcile.emit(stream, record)
    with (OUT / "semantic-definition-candidates.jsonl").open("w", encoding="utf-8") as stream:
        for sid, record in candidates.items():
            if record["status"] == "definition-field" and sid not in semantic_collisions:
                reconcile.emit(stream, record)
    (OUT / "compact-summary.json").write_text(json.dumps({"sourceCommit": reconcile.COMMIT, "catalogGapUniqueKeys": dict(unique_counts), "missingKeys": sum("missing-source-key" in r["catalogStatuses"] for r in gaps.values()), "pluralReviewUniqueKeys": dict(Counter(s for r in plural_reviews.values() for s in r["statuses"])), "nonExactBindingTypes": {k + ":" + t: v for (k, t), v in binding_types.items()}, "semanticCandidateUniqueIds": len(candidates), "semanticCollisionUniqueIds": len(semantic_collisions), "semanticDefinitionUncollidedUniqueIds": sum(r["status"] == "definition-field" and sid not in semantic_collisions for sid, r in candidates.items()), "runtimeConnected": False}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print((OUT / "compact-summary.json").read_text(encoding="utf-8"))
    print("Missing JSON sample:")
    for row in list(gaps.values())[:8]:
        print(json.dumps({k: row[k] for k in ("singular", "catalogStatuses", "bindings")}, ensure_ascii=False)[:1000])
    print("Explicit plural conflicts:")
    for row in plural_reviews.values():
        if "explicit-plural-mismatch" in row["statuses"]:
            print(json.dumps({k: row[k] for k in ("singular", "plurals", "catalogPlural", "bindings")}, ensure_ascii=False)[:2000])


if __name__ == "__main__":
    main()
