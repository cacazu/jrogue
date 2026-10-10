"""Summarize existing read-only evidence; never inspect or modify SDK trees."""
from pathlib import Path
import hashlib
import json
from collections import defaultdict

HERE = Path(__file__).resolve().parent
source = HERE / "METADATA-DELTA-index000-SCOPED.json"
raw = source.read_bytes()
evidence = json.loads(raw)
trees = {}
for name, row in evidence["phases"]["beforeFixedHelperImports"].items():
    groups = defaultdict(lambda: {"added": 0, "removed": 0, "changed": 0,
                                  "files": 0, "directories": 0, "fileBytes": 0})
    for delta in row["changes"]:
        group = "/".join(delta["member"].split("/")[:2])
        out = groups[group]
        before, after = delta["beforeMetadata"], delta["afterMetadata"]
        out["added" if before is None else "removed" if after is None else "changed"] += 1
        if after is not None:
            size = after[0]
            out["directories" if size is None else "files"] += 1
            if size is not None:
                out["fileBytes"] += int(size)
    trees[name] = {"membersBefore": row["membersBefore"],
                   "membersAfter": row["membersAfter"],
                   "changes": len(row["changes"]), "groups": dict(sorted(groups.items()))}
summary = {
    "status": "exact-scoped-metadata-delta-summary",
    "sourceEvidence": {"path": str(source), "bytes": len(raw),
                       "sha256": hashlib.sha256(raw).hexdigest()},
    "failedSourceOwnerSession": evidence["failedSourceOwnerSession"],
    "failedSourceOwnerExitCode": evidence["failedSourceOwnerExitCode"],
    "all4220BytePinsUnchanged": evidence["all4220BytePinsUnchanged"],
    "trees": trees,
    "otherEvidenceProperties": {key: value for key, value in evidence.items()
                                if key not in {"phases"} and key not in {
                                    "status", "failedSourceOwnerSession",
                                    "failedSourceOwnerExitCode", "all4220BytePinsUnchanged"}},
    "inference": "The scoped and default contexts enumerate different ports membership; no writer is identified by this evidence.",
    "noLaunch": "No guard/compiler/native attempt or baseline refresh performed."
}
destination = HERE / "METADATA-DELTA-index000-SCOPED-SUMMARY.json"
destination.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(summary, ensure_ascii=False, indent=2))
