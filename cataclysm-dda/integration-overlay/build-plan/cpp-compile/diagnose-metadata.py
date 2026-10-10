"""Classify archived prelaunch stat differences; bounded read-only stat probe."""
from pathlib import Path
import hashlib
import json
import os
import stat
import sys

HERE = Path(__file__).resolve().parent
ATTEMPT = HERE / "execution/cpp2-initial"
FIELDS = ["st_size", "st_mtime_ns", "st_mode", "st_file_attributes"]


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def fields(value):
    return [value.st_size, value.st_mtime_ns, value.st_mode, getattr(value, "st_file_attributes", 0)]


def main():
    before_file, after_file = [ATTEMPT / ("frozen-tree-metadata-" + moment + ".json") for moment in ["before", "after"]]
    before, after = [json.loads(path.read_bytes()) for path in [before_file, after_file]]
    plan = json.loads((ATTEMPT / "accepted-compile-plan.json").read_bytes())
    terminal = json.loads((ATTEMPT / "terminal.json").read_bytes())
    groups = {}
    all_changes = []
    for group in ["cache", "ports"]:
        old, new = before[group], after[group]
        added, removed = sorted(new.keys() - old.keys()), sorted(old.keys() - new.keys())
        changes = []
        for path in sorted(old.keys() & new.keys()):
            if old[path] != new[path]:
                changed = [name for index, name in enumerate(FIELDS) if old[path][index] != new[path][index]]
                kind = "directory" if stat.S_ISDIR(old[path][2]) and stat.S_ISDIR(new[path][2]) else "regular-file" if stat.S_ISREG(old[path][2]) and stat.S_ISREG(new[path][2]) else "other-or-type-changed"
                record = {"tree": group, "path": path, "kind": kind, "changedFields": changed,
                          "before": old[path], "after": new[path]}
                changes.append(record)
        groups[group] = {"beforeEntries": len(old), "afterEntries": len(new), "added": added,
                         "removed": removed, "changed": len(changes),
                         "directorySizeOnlyChanges": sum(item["kind"] == "directory" and item["changedFields"] == ["st_size"] for item in changes),
                         "regularFileChanges": sum(item["kind"] == "regular-file" for item in changes),
                         "anyOtherChange": sum(item["kind"] != "directory" or item["changedFields"] != ["st_size"] for item in changes)}
        all_changes.extend(changes)
    samples = all_changes[:3] + [item for item in all_changes if item["tree"] == "ports"][:3]
    probes = []
    for item in samples:
        path = Path(plan["frozenSDK"][item["tree"]]) / item["path"]
        repeated = [fields(path.lstat()) for _ in range(3)]
        with os.scandir(path.parent) as entries:
            entry_stat = next(fields(entry.stat(follow_symlinks=False)) for entry in entries if entry.name == path.name)
        probes.append({"path": str(path), "pathLstatThreeReads": repeated, "parentScandirEntryStat": entry_stat,
                       "historicalBefore": item["before"], "historicalAfter": item["after"]})
    files = []
    for record in [plan["frozenSDK"]["sanity"], plan["baseline"]["sdkHeaderInputs"][0]]:
        path = Path(record["path"])
        files.append({"path": str(path), "stat": fields(path.lstat()), "sha256": digest(path),
                      "matchesReviewedPin": digest(path) == record["sha256"]})
    result = {"schemaVersion": 1, "scope": "Archived metadata classification plus six existing-directory/two-existing-file read-only probes; no helper/job/compiler load",
              "pythonVersion": sys.version, "beforeMetadataSha256": digest(before_file), "afterMetadataSha256": digest(after_file),
              "groups": groups, "totalChangedEntries": len(all_changes), "changes": all_changes,
              "onlyDirectorySizeDiffs": all(not value["added"] and not value["removed"] and not value["anyOtherChange"] for value in groups.values()),
              "directoryProbes": probes, "fileProbes": files,
              "originalTerminalStatus": terminal["status"], "original207PinnedBytesUnchanged": terminal["protectedPinnedBytesUnchanged"],
              "compilerLaunchAttempted": terminal["compilerLaunchAttempted"], "ownedRootCount": terminal["ownedRootCount"],
              "originalCleanupRecords": terminal["ownedCleanupRecords"], "compilerExecuted": False, "WindowsGuardLoadedByDiagnosis": False,
              "metadataOnlyCannotProveAllUnpinnedFileContentsUnchanged": True}
    (ATTEMPT / "metadata-diagnosis.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"groups": groups, "totalChangedEntries": len(all_changes),
                      "onlyDirectorySizeDiffs": result["onlyDirectorySizeDiffs"], "directoryProbes": probes,
                      "compilerExecuted": False, "WindowsGuardLoadedByDiagnosis": False}))


if __name__ == "__main__":
    main()
