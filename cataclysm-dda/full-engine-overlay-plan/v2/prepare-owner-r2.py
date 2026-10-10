"""Fresh source-only owner revision; no Windows guard, compiler, WASM or browser."""
from pathlib import Path
import ast
import hashlib
import json
import types

HERE = Path(__file__).resolve().parent
OLD_OWNER_SHA = "6823c76e1210e1de375cdeb851a6d8eb562188e02815ef742b65a60b4ff9dae8"
OLD_PACKET_SHA = "9852d2255f5a420ad56260e603dbd3d0b42b060c27b05550f3bd6602b65492a1"
PLAN_SHA = "208c9b5dffb6822752dc155e80fb7ad187fd9735fccb80ab9eb0264655546b03"


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def replace_once(text, old, new):
    require(text.count(old) == 1, "exact source revision anchor changed: " + old[:100])
    return text.replace(old, new)


source = (HERE / "run-owner-window.py").read_bytes()
require(sha(source) == OLD_OWNER_SHA, "immutable r1 owner changed")
packet_bytes = (HERE / "OWNER-PINS.json").read_bytes()
require(sha(packet_bytes) == OLD_PACKET_SHA, "immutable r1 packet changed")
full_bytes = (HERE / "FULL-INTEGRATION-PLAN.json").read_bytes()
require(sha(full_bytes) == PLAN_SHA, "immutable v2 source plan changed")
full = json.loads(full_bytes)
text = source.decode("utf-8").replace('"OWNER-PINS.json"', '"OWNER-PINS-r2.json"')
text = replace_once(text, '"OWNER-SOURCE-VALIDATION-"', '"OWNER-SOURCE-VALIDATION-r2-"')
text = replace_once(text, "from pathlib import Path", "from pathlib import Path, PurePosixPath")

addition = '''def expected_fingerprints(records):
    # Already validated exact pin records; no repeated artifact/source hashing.
    return {row["path"]: {"path": str(Path(row["path"]).resolve()), "bytes": row["bytes"],
                          "sha256": row["sha256"]} for row in records}


def capture_accepted_trees(full, cpp2):
    candidate = ordinary_owned(full["candidateDirectory"], directory=True)
    paths = {"cache": Path(full["frozenSDK"]["cache"]), "ports": Path(full["frozenSDK"]["ports"]),
             "coherentSources": candidate / "sources/src", "generated": candidate / "generated"}
    for name, directory in paths.items():
        state = directory.lstat()
        require(stat.S_ISDIR(state.st_mode) and not directory.is_symlink() and
                not (getattr(state, "st_file_attributes", 0) & 0x400), "accepted tree root is not ordinary: " + name)
        if name in ["coherentSources", "generated"]:
            ordinary_owned(directory, directory=True)
    trees = {name: cpp2.metadata_tree(directory) for name, directory in paths.items()}
    expected = {"coherentSources": {Path(row["path"]).relative_to(paths["coherentSources"]).as_posix()
                                   for row in full["staging"]["pins"]},
                "generated": {"version.h", "prefix.h"}}
    for name, files in expected.items():
        actual_files = {member for member, value in trees[name].items() if stat.S_ISREG(value[2])}
        actual_dirs = {member for member, value in trees[name].items() if stat.S_ISDIR(value[2])}
        expected_dirs = {parent.as_posix() for member in files for parent in PurePosixPath(member).parents
                         if parent.as_posix() != "."}
        require(actual_files == files and actual_dirs == expected_dirs and
                len(actual_files) + len(actual_dirs) == len(trees[name]), "accepted exact tree membership changed: " + name)
    return trees


'''
text = replace_once(text, "def load_cpp2():", addition + "def load_cpp2():")
text = replace_once(text, '    cpp2.metadata_tree(candidate / "sources/src")  # reject all nested source reparse members',
                    '    require(packet["ownerRevision"] == "r2" and\n'
                    '            capture_accepted_trees(full, cpp2) == packet["acceptedTreeBaselines"],\n'
                    '            "exact reviewed source/generated/cache/ports metadata baseline changed")')
text = text.replace("def verify_receipt(full, index, cpp2, records, bridge):",
                    "def verify_receipt(full, index, cpp2, records, bridge, packet):")
for old in ["verify_receipt(full, index, cpp2, records, bridge)",
            "verify_receipt(full, index, cpp2, records, compile_bridge)",
            "verify_receipt(full, options.index, cpp2, records, bridge)"]:
    require(old in text, "receipt call anchor missing")
    text = text.replace(old, old[:-1] + ", packet)")
text = replace_once(text, '    require(len(terminal["archivedArtifactPins"]) == 2, "exact output archive pair missing")',
                    '''    expected = expected_fingerprints(records)
    require(json.loads((attempt / "input-fingerprints-before.json").read_bytes()) == expected and
            json.loads((attempt / "input-fingerprints-after.json").read_bytes()) == expected,
            "receipt fingerprint maps omit or differ from the exact protected closure")
    require(set(packet["acceptedTreeBaselines"]) == {"cache", "ports", "coherentSources", "generated"} and
            json.loads((attempt / "frozen-tree-metadata-before.json").read_bytes()) == packet["acceptedTreeBaselines"] and
            json.loads((attempt / "frozen-tree-metadata-after.json").read_bytes()) == packet["acceptedTreeBaselines"] and
            terminal["protectedCoherentSourceAndGeneratedMetadataUnchanged"] is True,
            "receipt metadata omits or differs from the reviewed exact four-tree baseline")
    require(len(terminal["archivedArtifactPins"]) == 2, "exact output archive pair missing")''')
text = replace_once(text, '    trees = {name: cpp2.metadata_tree(full["frozenSDK"][name]) for name in ["cache", "ports"]}',
                    '    require(before == expected_fingerprints(records), "exact protected fingerprint closure changed")\n'
                    '    trees = capture_accepted_trees(full, cpp2)\n'
                    '    require(trees == packet["acceptedTreeBaselines"], "accepted four-tree baseline changed before window")')
text = replace_once(text, '        require(all(cpp2.metadata_tree(full["frozenSDK"][name]) == trees[name] for name in trees), "frozen SDK metadata changed")',
                    '        require(capture_accepted_trees(full, cpp2) == trees == packet["acceptedTreeBaselines"],\n'
                    '                "accepted source/generated/frozen SDK metadata changed")')
text = replace_once(text, '            after_trees = {name: cpp2.metadata_tree(full["frozenSDK"][name]) for name in trees}',
                    '            after_trees = capture_accepted_trees(full, cpp2)')
text = replace_once(text, '            require(before == after and trees == after_trees, "protected source/baseline/SDK changed")',
                    '            require(before == after == expected_fingerprints(records) and\n'
                    '                    trees == after_trees == packet["acceptedTreeBaselines"], "protected source/baseline/SDK changed")\n'
                    '            terminal["protectedCoherentSourceAndGeneratedMetadataUnchanged"] = True')
text = replace_once(text, '"fullLinkGenuineCompileReceiptsPresent": sum(receipt_file(full, index).exists() for index in range(235)),',
                    '"compileReceiptFilesPresentUnverified": sum(os.path.lexists(receipt_file(full, index)) for index in range(235)),\n'
                    '                  "receiptProofValidationOccursBeforeExecution": True,')
ast.parse(text)
runner = HERE / "run-owner-window-r2.py"
require(not runner.exists() and not (HERE / "OWNER-PINS-r2.json").exists(), "fresh r2 artifacts required")
with runner.open("x", encoding="utf-8", newline="\n") as stream:
    stream.write(text)
module = types.ModuleType("cdda_source_only_owner_r2_preparer")
module.__file__ = str(runner)
exec(compile(text, str(runner), "exec", dont_inherit=True, optimize=0), module.__dict__)
cpp2 = module.load_cpp2()  # Only reviewed standard-library definitions, no Windows guard.
packet = json.loads(packet_bytes)
cpp2.validate_pin_records(packet["pins"])
packet["ownerRevision"] = "r2"
packet["runnerSha256"] = module.digest(runner)
packet["previousOwnerPacket"] = module.pin(HERE / "OWNER-PINS.json")
packet["acceptedTreeBaselines"] = module.capture_accepted_trees(full, cpp2)
packet["exactProtectedFingerprintClosureRequired"] = True
packet["sourceAndGeneratedMembershipRetainedAcrossEveryWindow"] = True
records = {row["path"].lower(): row for row in packet["pins"]}
for file in [runner, Path(__file__), HERE / "OWNER-PINS.json"]:
    row = module.pin(file)
    records[row["path"].lower()] = row
packet["pins"] = sorted(records.values(), key=lambda row: row["path"].lower())
cpp2.validate_pin_records(packet["pins"])
require(packet["acceptedTreeBaselines"] == module.capture_accepted_trees(full, cpp2), "metadata changed during source preparation")
module.write_json(HERE / "OWNER-PINS-r2.json", packet)  # Python preserves integer nanoseconds exactly.
print(json.dumps({"status": "fresh-r2-owner-and-exact-tree-baselines-prepared-no-launch",
                  "runnerSha256": packet["runnerSha256"], "packetSha256": module.digest(HERE / "OWNER-PINS-r2.json"),
                  "protectedFiles": len(packet["pins"]), "treeMembers": {name: len(tree) for name, tree in packet["acceptedTreeBaselines"].items()},
                  "WindowsGuardLoaded": False, "compilerExecuted": False}), flush=True)
