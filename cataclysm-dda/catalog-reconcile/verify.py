"""Verify all compact handoffs against the actual extracted source corpus."""
from collections import Counter
import json
from pathlib import Path
import subprocess
import sys

import reconcile

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output"


def main():
    summary = json.loads((OUT / "summary.json").read_text(encoding="utf-8"))
    gaps = json.loads((OUT / "current-source-gaps.json").read_text(encoding="utf-8"))
    compact = json.loads((OUT / "compact-summary.json").read_text(encoding="utf-8"))
    assert summary["sourceCommit"] == reconcile.COMMIT
    assert summary["collectorSha256"] == reconcile.digest(ROOT / "reconcile.py")
    assert summary["sourceCatalogSha256"] == reconcile.digest(reconcile.DEFAULT_SOURCE / "lang/po/ja.po")
    assert summary["patchesSha256"] == reconcile.digest(ROOT.parent / "ja-completion/ja-reviewed-patches.json")
    for record in summary["extraction"]["parserManifest"]:
        assert record["sha256"] == reconcile.digest(reconcile.DEFAULT_SOURCE / record["path"])
    assert summary["json"].get("unknownTypes", 0) == 0
    assert summary["json"].get("parserErrors", 0) == 0
    assert summary["json"].get("fileErrors", 0) == 0
    assert len(gaps["records"]) == gaps["count"] == 539
    gap_keys = [reconcile.key(r) for r in gaps["records"]]
    assert len(set(gap_keys)) == len(gap_keys)
    chunks = []
    for i, expected in enumerate((180, 180, 179), 1):
        chunk = json.loads((OUT / f"current-source-gaps-{i}.json").read_text(encoding="utf-8"))
        assert len(chunk["records"]) == chunk["count"] == expected
        chunks.extend(chunk["records"])
    assert chunks == gaps["records"]
    source_keys, missing_keys, counts = set(), set(), Counter()
    with (OUT / "current-source-key-manifest.jsonl").open(encoding="utf-8") as stream:
        for line in stream:
            record = json.loads(line)
            pair = reconcile.key(record)
            assert pair not in source_keys
            source_keys.add(pair)
            counts["currentKeysWithJa"] += bool(record.get("ja"))
            if not record.get("ja"):
                missing_keys.add(pair)
            if record["pluralSelectionStatus"] == "multiple-source-plurals-preserved":
                counts["multipleSourcePluralKeys"] += 1
    assert len(source_keys) == summary["combinedUniqueSourceKeys"] == 105003
    assert missing_keys == set(gap_keys)
    assert compact["missingKeys"] == 539
    assert compact["catalogGapUniqueKeys"]["plural-mismatch"] == 15
    cpp_outside = []
    with (OUT / "cpp-inventory-reconciliation.jsonl").open(encoding="utf-8") as stream:
        for line in stream:
            row = json.loads(line)
            if row["status"] == "not-in-official-extraction":
                cpp_outside.append(row["source"])
    assert len(cpp_outside) == 5 and all(r["file"].startswith("tests/") for r in cpp_outside)
    tests = subprocess.run([sys.executable, "-X", "utf8", str(ROOT / "test_reconcile.py")], capture_output=True, text=True, encoding="utf-8")
    assert tests.returncode == 0, tests.stdout + tests.stderr
    result = {"sourceCommit": reconcile.COMMIT, "status": "passed", "collectorUnitTests": 11,
              "collectorUnitTestOutput": tests.stdout + tests.stderr, "currentSourceKeys": len(source_keys),
              "missingCurrentKeys": len(missing_keys), "chunkCounts": [180, 180, 179],
              "sourceParserAndJaCatalogFingerprintsVerified": True,
              "unknownTypes": 0, "upstreamParserErrors": 0, "jsonFileErrors": 0,
              "officialCppWarnings": summary["extraction"]["cpp"]["warnings"],
              "cppInventoryOutsideOfficialScope": {"count": 5, "kind": "test-only calls"},
              "counts": dict(counts), "runtimeConnected": False,
              "artifactDigests": {name: reconcile.digest(OUT / name) for name in ("summary.json", "current-source-gaps.json", "current-source-key-manifest.jsonl", "source-plural-reviews.json", "semantic-definition-candidates.jsonl")}}
    (OUT / "verification.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
