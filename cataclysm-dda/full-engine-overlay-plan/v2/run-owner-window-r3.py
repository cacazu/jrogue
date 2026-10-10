"""Exact one-command owner; default is source/pin validation, never a launch.

Compile scope is fixed at all 235 ordered units, one command per invocation. A separate
full-link mode remains blocked until all 235 genuine compile receipts exist.
The unchanged CPP2 byte-buffer loader supplies reviewed run_owned cleanup.
"""
from pathlib import Path, PurePosixPath
import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import stat
import struct
import sys
import time
import types

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PLAN_SHA = "208c9b5dffb6822752dc155e80fb7ad187fd9735fccb80ab9eb0264655546b03"
CPP2_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
WRAPPER_SHA = "0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb"
GUARD_SHA = "ae54cce5dbbe2e769d52572528f750b0573ef37fb172cc29db8ab8fa8208a8c3"
GIB = 1024 ** 3
INITIAL_SOURCES = ["src/browser_input_snapshot.cpp", "src/browser_text_snapshot.cpp",
                   "src/cdda_help_semantic.cpp", "src/cdda_help_transport.cpp",
                   "src/input_context.cpp", "src/input.cpp", "src/help.cpp", "src/sdltiles.cpp"]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def ordinary_owned(path, *, anchor=None, directory=False, allow_missing=False):
    """Check lexical containment and every ordinary ancestor before resolving."""
    anchor = Path(os.path.abspath(anchor or HERE))
    path = Path(os.path.abspath(path))
    require(path.is_relative_to(anchor), "owned lexical path escape: " + str(path))
    chain = [anchor]
    for part in path.relative_to(anchor).parts:
        chain.append(chain[-1] / part)
    for index, member in enumerate(chain):
        if not os.path.lexists(member):
            require(allow_missing, "owned member absent: " + str(member))
            return path
        state = member.lstat()
        require(not stat.S_ISLNK(state.st_mode) and not member.is_symlink() and
                not (getattr(state, "st_file_attributes", 0) & 0x400),
                "owned symlink/reparse member rejected: " + str(member))
        if index < len(chain) - 1 or directory:
            require(stat.S_ISDIR(state.st_mode), "owned ancestor is not an ordinary directory: " + str(member))
        else:
            require(stat.S_ISREG(state.st_mode), "owned file is not ordinary: " + str(member))
    require(path.resolve() == path, "owned ancestry resolves elsewhere: " + str(path))
    return path


def fresh_owned_file(path, *, anchor=None):
    path = ordinary_owned(path, anchor=anchor, allow_missing=True)
    require(not os.path.lexists(path), "existing or dangling output preserved: " + str(path))
    return path


def owned_directory(path):
    path = ordinary_owned(path, directory=True, allow_missing=True)
    path.mkdir(parents=True, exist_ok=True)
    return ordinary_owned(path, directory=True)


def checked_owned_pin(record, expected):
    path = ordinary_owned(record["path"])
    require(path == Path(os.path.abspath(expected)), "evidence path does not equal the planned owned path")
    require(pin(path) == record, "owned evidence bytes changed: " + str(path))
    return path


def digest(path):
    state = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            state.update(block)
    return state.hexdigest()


def pin(path):
    path = Path(path).resolve()
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": digest(path)}


def write_json(path, value):
    with Path(path).open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(value, indent=2) + "\n")


def expected_fingerprints(records):
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


def load_cpp2():
    file = ROOT / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"
    source = file.read_bytes()
    require(hashlib.sha256(source).hexdigest() == CPP2_SHA, "exact CPP2 loader changed")
    module = types.ModuleType("cdda_full_owner_private_cpp2_loader")
    module.__file__ = str(file)
    exec(compile(source, str(file), "exec", dont_inherit=True, optimize=0), module.__dict__)
    return module


def validate(options):
    ordinary_owned(HERE, anchor=ROOT, directory=True)
    source = Path(__file__).read_bytes()
    ast.parse(source, filename=__file__)
    packet_file = HERE / "OWNER-PINS-r3.json"
    packet_bytes = packet_file.read_bytes()
    packet = json.loads(packet_bytes)
    require(packet["runnerSha256"] == hashlib.sha256(source).hexdigest(), "owner source changed")
    full_file = HERE / "FULL-INTEGRATION-PLAN.json"
    full_bytes = full_file.read_bytes()
    require(hashlib.sha256(full_bytes).hexdigest() == PLAN_SHA, "fixed full source/command plan changed")
    full = json.loads(full_bytes)
    require(full["sourceCommit"] == "7b2efa5cea38e4d4d97dd0e63b28b9148623da59", "source commit changed")
    require(full["compilerExecuted"] is False and full["browserExecuted"] is False, "preparation proof changed")
    require([command["source"] for command in full["compileCommands"][:8]] == INITIAL_SOURCES,
            "exact initial ordered sources changed")
    require(len(full["compileCommands"]) == 235 and full["linkResponse"]["totalObjects"] == 442,
            "full object closure changed")
    identity = full["buildIdentity"]
    require(identity == "cdda-authoritative-observers-cosmetic-v2-e3ff38d8bc59cf07ddbb48ce-sdk6.0.8" and
            len(identity.encode("ascii")) == 74 and packet["buildIdentity"] == identity,
            "exact shared v2 identity changed")
    require(packet["fullPlanSha256"] == PLAN_SHA and packet["cpp2Sha256"] == CPP2_SHA,
            "packet source/loader binding changed")
    require(packet["orderedCompileIndices"] == list(range(235)) and
            packet["newHelperCompileTuplesRequiredFresh"] == [{"index": index, "command": command}
                for index, command in enumerate(full["compileCommands"][:4])],
            "all ordered stages and four fresh v2 helper command bindings required")
    cpp2 = load_cpp2()  # standard-library definitions only; no Windows guard load
    records = packet["pins"]
    require(len({str(Path(row["path"]).resolve()) for row in records}) == len(records), "duplicate protected pins")
    cpp2.validate_pin_records(records)
    cpp2.validate_inherited_environment()
    candidate = ordinary_owned(full["candidateDirectory"], directory=True)
    require(candidate.is_relative_to(HERE) and candidate.parent == HERE, "candidate ownership escape")
    for folder in [candidate, candidate / "sources", candidate / "sources/src", candidate / "objects",
                   candidate / "generated", candidate / "output", candidate / "evidence"]:
        ordinary_owned(folder, directory=True)
    require(packet["ownerRevision"] == "r3" and
            capture_accepted_trees(full, cpp2) == packet["acceptedTreeBaselines"],
            "exact reviewed source/generated/cache/ports metadata baseline changed")
    ordinary_owned(HERE / "execution", directory=True, allow_missing=True)
    config = candidate / ".emscripten"
    require(config.read_text(encoding="utf-8").splitlines()[-1] == "FROZEN_CACHE = True", "frozen cache config missing")
    expected_env = {"EM_CONFIG": str(config), "EM_CACHE": full["frozenSDK"]["cache"],
                    "EM_PORTS": full["frozenSDK"]["ports"], "EMSDK_PYTHON": full["compileCommands"][0]["executable"],
                    "EMCC_CORES": "1", "EMCC_BATCH_BUILD": "0", "BINARYEN_CORES": "1"}
    for command in [*full["compileCommands"], full["linkCommand"]]:
        require(command["cwd"] == str(candidate), "candidate cwd changed")
        require(command["environment"] == expected_env, "frozen single-worker environment changed")
        require(command["automaticRetry"] is False, "automatic retry forbidden")
    macros = ['-DCDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID="' + identity + '"',
              '-DCDDA_TEXT_SNAPSHOT_BUILD_ID="' + identity + '"']
    for command in full["compileCommands"]:
        require(all(command["argv"].count(macro) == 1 for macro in macros), "v2 identity compile tuple changed")
        for name in ["outputObject", "outputDependencyFile"]:
            ordinary_owned(command[name], anchor=candidate, allow_missing=True)
    for name in ["outputWasm", "outputJavascript"]:
        ordinary_owned(full["linkCommand"][name], anchor=candidate, allow_missing=True)
    prior = json.loads((ROOT / "integration-overlay/build-plan/cpp-compile/compile-plan.json").read_bytes())
    require(prior["guard"]["currentWrapper"]["sha256"] == WRAPPER_SHA and
            prior["guard"]["historicalHelper"]["sha256"] == GUARD_SHA, "reviewed guard binding changed")
    compile_gate = full["resources"]["compilation"]["launchGate"]
    compile_guard = full["resources"]["compilation"]["ownedResourceGuard"]
    require(compile_gate["minimumPhysicalFreeBytes"] == 4 * GIB and
            compile_gate["minimumExactCommitHeadroomBytes"] == 6 * GIB, "compile gate changed")
    require(compile_guard["maximumOwnedTreePrivateBytes"] == GIB and
            compile_guard["maximumOwnedTreeWorkingSetBytes"] == GIB and
            compile_guard["maximumStageSeconds"] == 180, "compile budget changed")
    require(compile_guard["minimumPhysicalFreeBytes"] == 2 * GIB and
            compile_guard["minimumExactCommitHeadroomBytes"] == 2 * GIB, "global running floors changed")
    mode_guard = dict(compile_guard)
    gate = dict(compile_gate)
    if options.mode == "full-link":
        require(options.index is None, "link accepts no compile selector")
        proposal = full["resources"]["fullLinkProposalNotApprovedForExecution"]
        require(proposal["proposedPhysicalLaunchBytes"] == proposal["proposedExactCommitLaunchBytes"] == 6 * GIB,
                "full link gate changed")
        require(proposal["maximumOwnedPrivateBytes"] == proposal["maximumOwnedWorkingSetBytes"] == 4 * GIB and
                proposal["deadlineSeconds"] == 600 and proposal["runningPhysicalAndCommitFloorsBytes"] == 2 * GIB,
                "full link cap/deadline/floors changed")
        gate.update(minimumPhysicalFreeBytes=6 * GIB, minimumExactCommitHeadroomBytes=6 * GIB)
        mode_guard.update(maximumOwnedTreePrivateBytes=4 * GIB, maximumOwnedTreeWorkingSetBytes=4 * GIB,
                          maximumStageSeconds=600)
        command = full["linkCommand"]
    else:
        require(type(options.index) is int and 0 <= options.index < 235, "only reviewed 235 ordered indices accepted")
        command = full["compileCommands"][options.index]
    bridge = {"guard": prior["guard"], "launchGate": gate, "ownedResourceGuard": mode_guard,
              "rustEnvironment": {}, "removeInheritedEnvironment": prior["removeInheritedEnvironment"]}
    return full, packet, cpp2, records, command, bridge


def receipt_file(full, index):
    return Path(full["candidateDirectory"]) / "evidence" / ("compile-%03d-success.json" % index)


def verify_guard_evidence(verdict, cleanup, command, bridge):
    require(verdict["stage"] == command["stage"] and
            verdict["argv"] == [command["executable"], *command["argv"]] and
            verdict["cwd"] == command["cwd"] and verdict["environmentOverrides"] == command["environment"] and
            verdict["removedInheritedEnvironment"] == bridge["removeInheritedEnvironment"],
            "guard stage/argv/cwd/frozen environment does not bind the planned command")
    require(verdict["passed"] is True and verdict["exitCode"] == 0 and
            verdict["remainingOwnedPidsBeforeJobClose"] == [], "genuine guard result missing")
    gate, budget = bridge["launchGate"], bridge["ownedResourceGuard"]
    for key in ["physicalFreeBytes", "exactCommitHeadroomBytes"]:
        require(type(verdict["freshGate"][key]) is int and verdict["freshGate"][key] >= gate[
                "minimumPhysicalFreeBytes" if key == "physicalFreeBytes" else "minimumExactCommitHeadroomBytes"],
                "guard exact fresh resource gate failed")
    require(type(verdict["jobPeakPrivateBytes"]) is int and
            0 <= verdict["jobPeakPrivateBytes"] <= budget["maximumOwnedTreePrivateBytes"], "guard job peak exceeds cap")
    require(isinstance(verdict["durationSeconds"], (int, float)) and
            0 <= verdict["durationSeconds"] <= budget["maximumStageSeconds"], "guard duration exceeds deadline")
    require(len(verdict["samples"]) > 0, "actual owned resource samples missing")
    for sample in verdict["samples"]:
        for key, limit in [("ownedPrivateBytes", "maximumOwnedTreePrivateBytes"),
                           ("ownedWorkingSetBytes", "maximumOwnedTreeWorkingSetBytes")]:
            require(type(sample[key]) is int and 0 <= sample[key] <= budget[limit], "sample exceeds owned resource cap")
        for key, floor in [("physicalFreeBytes", "minimumPhysicalFreeBytes"),
                           ("exactCommitHeadroomBytes", "minimumExactCommitHeadroomBytes")]:
            require(type(sample[key]) is int and sample[key] >= budget[floor], "sample breaches global floor")
    root = verdict["rootIdentity"]
    require(type(root["pid"]) is int and root["pid"] > 0 and
            type(root["creationFiletime"]) is int and root["creationFiletime"] > 0,
            "original owned root exact identity missing")
    identities = verdict["identities"]
    require(root in identities and len({row["pid"] for row in identities}) == len(identities) and
            all(type(row["pid"]) is int and row["pid"] > 0 and type(row["creationFiletime"]) is int and
                row["creationFiletime"] > 0 for row in identities), "owned root/job identity closure mismatch")
    require(cleanup["passed"] is True and cleanup["remainingOwnedJobHandles"] == [] and cleanup["errors"] == [] and
            len(cleanup["jobsCreated"]) == len(cleanup["rootsCreated"]) == 1,
            "exact one-command owned job/root closure missing")
    require(type(cleanup["jobsCreated"][0]) is int and cleanup["jobsCreated"][0] > 0, "owned job handle missing")
    created = cleanup["rootsCreated"][0]
    require(created["pid"] == root["pid"] and type(created["processHandle"]) is int and created["processHandle"] > 0 and
            created["ownership"] == "exact handle returned by owned suspended Popen", "outer root handle binding failed")
    require(sum(action.get("action") == "close-owned-process-handle" and
                action.get("processHandle") == created["processHandle"] for action in cleanup["outerActions"]) == 1,
            "exact returned root handle close missing")
    require(all(action.get("processHandle", created["processHandle"]) == created["processHandle"] and
                action.get("jobHandle", cleanup["jobsCreated"][0]) == cleanup["jobsCreated"][0]
                for action in cleanup["outerActions"]), "cleanup action references an unowned root/job handle")


def verify_receipt(full, index, cpp2, records, bridge, packet):
    file = receipt_file(full, index)
    ordinary_owned(file)
    receipt = json.loads(file.read_bytes())
    command = full["compileCommands"][index]
    require(receipt["status"] == "genuine-original-tuple-compile-passed" and receipt["fullPlanSha256"] == PLAN_SHA,
            "successful genuine compile receipt required")
    require(receipt["index"] == index and receipt["command"] == command and receipt["ownedCleanupPassed"] is True,
            "receipt command/closure mismatch")
    require(receipt["buildIdentity"] == full["buildIdentity"], "receipt v2 helper/engine identity changed")
    require(len(receipt["artifactPins"]) == 2, "exact planned object and dependency artifacts required")
    for record, key in zip(receipt["artifactPins"], ["outputObject", "outputDependencyFile"]):
        checked_owned_pin(record, command[key])
    terminal_path = ordinary_owned(receipt["terminal"]["path"])
    attempt = terminal_path.parent
    require(attempt.parent == HERE / "execution" and re.fullmatch(r"[a-z0-9_-]{1,48}", attempt.name),
            "receipt terminal outside fresh owned attempt")
    checked_owned_pin(receipt["terminal"], attempt / "terminal.json")
    terminal = json.loads(terminal_path.read_bytes())
    require(terminal["status"] == receipt["status"] and terminal["mode"] == "compile" and terminal["index"] == index and
            terminal["fullPlanSha256"] == PLAN_SHA and terminal["runnerSha256"] == digest(__file__) and
            terminal["packetSha256"] == digest(HERE / "OWNER-PINS-r3.json") and terminal["exactCommand"] == command and
            terminal["buildIdentity"] == full["buildIdentity"] and terminal["compilerLaunchAttempted"] is True and
            terminal["rootSeparateReleaseAsserted"] is True and
            terminal["ownedCleanupPassed"] is True and terminal["protectedPinnedBytesAndFrozenSdkUnchanged"] is True and
            terminal["artifactPins"] == receipt["artifactPins"] and terminal["automaticRetry"] is False,
            "terminal does not bind the exact v2 command, protected inputs and cleanup")
    for record, expected in zip(terminal["inputAuditPins"], ["input-fingerprints-before.json", "input-fingerprints-after.json",
            "frozen-tree-metadata-before.json", "frozen-tree-metadata-after.json"]):
        checked_owned_pin(record, attempt / expected)
    require(len(terminal["inputAuditPins"]) == 4 and
            json.loads((attempt / "input-fingerprints-before.json").read_bytes()) ==
            json.loads((attempt / "input-fingerprints-after.json").read_bytes()) and
            json.loads((attempt / "frozen-tree-metadata-before.json").read_bytes()) ==
            json.loads((attempt / "frozen-tree-metadata-after.json").read_bytes()), "actual protected audit changed")
    expected = expected_fingerprints(records)
    require(json.loads((attempt / "input-fingerprints-before.json").read_bytes()) == expected and
            json.loads((attempt / "input-fingerprints-after.json").read_bytes()) == expected,
            "receipt fingerprint maps omit or differ from the exact protected closure")
    require(set(packet["acceptedTreeBaselines"]) == {"cache", "ports", "coherentSources", "generated"} and
            json.loads((attempt / "frozen-tree-metadata-before.json").read_bytes()) == packet["acceptedTreeBaselines"] and
            json.loads((attempt / "frozen-tree-metadata-after.json").read_bytes()) == packet["acceptedTreeBaselines"] and
            terminal["protectedCoherentSourceAndGeneratedMetadataUnchanged"] is True,
            "receipt metadata omits or differs from the reviewed exact four-tree baseline")
    require(len(terminal["archivedArtifactPins"]) == 2, "exact output archive pair missing")
    for record, key in zip(terminal["archivedArtifactPins"], ["outputObject", "outputDependencyFile"]):
        checked_owned_pin(record, attempt / "outputs" / Path(command[key]).name)
    require(all(copy["bytes"] == source["bytes"] and copy["sha256"] == source["sha256"]
                for copy, source in zip(terminal["archivedArtifactPins"], receipt["artifactPins"])),
            "archived artifacts differ from the exact planned outputs")
    verdict_path = checked_owned_pin(receipt["guardVerdict"], attempt / (command["stage"] + ".json"))
    cleanup_path = checked_owned_pin(terminal["ownedCleanupEvidence"], attempt / (command["stage"] + ".outer-cleanup.json"))
    verify_guard_evidence(json.loads(verdict_path.read_bytes()), json.loads(cleanup_path.read_bytes()), command, bridge)
    actual = verify_dependencies(command, records, full)
    require(receipt["actualNonSystemDependencies"] == terminal["actualNonSystemDependencies"] == actual,
            "actual MMD dependency closure does not match success evidence")
    return receipt


def verify_dependencies(command, records, full):
    obj, dep = Path(command["outputObject"]), Path(command["outputDependencyFile"])
    ordinary_owned(obj); ordinary_owned(dep)
    require(obj.is_file() and dep.is_file(), "compiled object/MMD missing")
    with obj.open("rb") as stream:
        require(stream.read(8) == b"\x00asm\x01\x00\x00\x00", "actual wasm object header required")
    line = re.sub(r"\\\r?\n", " ", dep.read_text(encoding="utf-8")).splitlines()[0]
    match = re.fullmatch(r"(.+\.o):\s+(.+)", line)
    require(match and Path(match[1]).resolve() == obj.resolve(), "actual MMD target mismatch")
    dependencies = sorted({str(Path(token).resolve()) for token in match[2].split()})
    known = {str(Path(row["path"]).resolve()): row for row in records}
    require(not [file for file in dependencies if file not in known], "unreviewed actual dependency blocks success")
    require(str(Path(command["argv"][command["argv"].index("-c") + 1]).resolve()) in dependencies,
            "actual source not in MMD")
    pristine = Path(json.loads((ROOT / "engine-build/build-manifest.json").read_bytes())["upstream"]).resolve()
    require(not any(Path(file).is_relative_to(pristine) for file in dependencies),
            "mixed pristine sibling dependency blocks coherent compile")
    return [known[file] for file in dependencies]


def execute(full, packet, cpp2, records, command, bridge, options):
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized 64-bit Windows required")
    require(options.parent_released_window and options.runner_sha256 == digest(__file__),
            "separate root window release and exact reviewed owner SHA required")
    require(options.packet_sha256 == digest(HERE / "OWNER-PINS-r3.json"), "exact independently reviewed packet required")
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name or "") is not None, "fresh attempt required")
    candidate = Path(full["candidateDirectory"])
    if options.mode == "compile":
        for index in range(options.index):
            verify_receipt(full, index, cpp2, records, bridge, packet)
        for name in ["outputObject", "outputDependencyFile"]:
            fresh_owned_file(command[name], anchor=candidate)
            owned_directory(Path(command[name]).parent)
        fresh_owned_file(receipt_file(full, options.index))
    else:
        compile_bridge = dict(bridge, launchGate=full["resources"]["compilation"]["launchGate"],
                              ownedResourceGuard=full["resources"]["compilation"]["ownedResourceGuard"])
        for index in range(235):
            verify_receipt(full, index, cpp2, records, compile_bridge, packet)
        for name in ["outputJavascript", "outputWasm"]:
            fresh_owned_file(command[name], anchor=candidate)
            owned_directory(Path(command[name]).parent)
    destination = HERE / "execution" / options.attempt_name
    ordinary_owned(HERE / "execution", directory=True, allow_missing=True)
    owned_directory(HERE / "execution")
    ordinary_owned(destination, directory=True, allow_missing=True)
    require(not os.path.lexists(destination), "fresh ordinary attempt required")
    destination.mkdir(exist_ok=False)
    ordinary_owned(destination, directory=True)
    temporary = destination / "temporary"
    temporary.mkdir()
    for file in [HERE / "FULL-INTEGRATION-PLAN.json", HERE / "OWNER-PINS-r3.json", Path(__file__)]:
        shutil.copyfile(file, destination / file.name)
    before = cpp2.fingerprints(records)
    require(before == expected_fingerprints(records), "exact protected fingerprint closure changed")
    trees = capture_accepted_trees(full, cpp2)
    require(trees == packet["acceptedTreeBaselines"], "accepted four-tree baseline changed before window")
    write_json(destination / "input-fingerprints-before.json", before)
    write_json(destination / "frozen-tree-metadata-before.json", trees)
    terminal = {"schemaVersion": 1, "status": "preparing", "mode": options.mode, "index": options.index,
                "buildIdentity": full["buildIdentity"],
                "fullPlanSha256": PLAN_SHA, "runnerSha256": digest(__file__), "packetSha256": options.packet_sha256,
                "exactCommand": command, "compilerLaunchAttempted": False, "ownedCleanupPassed": False,
                "rootSeparateReleaseAsserted": True,
                "originalEngineOrBrowserAcceptance": False, "automaticRetry": False}
    changed_environment = {"PYTHONDONTWRITEBYTECODE": "1", "PYTHONNOUSERSITE": "1",
                           "TEMP": str(temporary), "TMP": str(temporary)}
    previous = {key: os.environ.get(key) for key in changed_environment}
    result = None
    actual_dependencies = None
    try:
        os.environ.update(changed_environment)
        cpp2.validate_pin_records(records)
        require(capture_accepted_trees(full, cpp2) == trees == packet["acceptedTreeBaselines"],
                "accepted source/generated/frozen SDK metadata changed")
        wrapper, guard = cpp2.load_wrapper(bridge)
        captured = time.monotonic()
        counters = guard.counters()
        terminal["freshCounters"] = counters
        require(type(counters["physicalFreeBytes"]) is int and type(counters["exactCommitHeadroomBytes"]) is int,
                "exact counter type failure")
        if counters["physicalFreeBytes"] >= 7 * GIB and counters["exactCommitHeadroomBytes"] >= 9 * GIB:
            terminal["status"] = "deferred-browser-priority"
        elif counters["physicalFreeBytes"] < bridge["launchGate"]["minimumPhysicalFreeBytes"] or \
                counters["exactCommitHeadroomBytes"] < bridge["launchGate"]["minimumExactCommitHeadroomBytes"]:
            terminal["status"] = "blocked-fresh-resource-gate"
        else:
            require(time.monotonic() - captured <= 15, "counter capture expired")
            terminal["compilerLaunchAttempted"] = True
            result = wrapper.run_owned(guard, command, destination)
            cleanup = json.loads((destination / (command["stage"] + ".outer-cleanup.json")).read_bytes())
            verify_guard_evidence(result, cleanup, command, bridge)
            terminal["ownedCleanupPassed"] = True
            if options.mode == "compile":
                actual_dependencies = verify_dependencies(command, records, full)
                terminal["status"] = "genuine-original-tuple-compile-passed"
            else:
                wasm, javascript = Path(command["outputWasm"]), Path(command["outputJavascript"])
                require(wasm.is_file() and javascript.is_file(), "full-engine outputs missing")
                with wasm.open("rb") as stream:
                    require(stream.read(8) == b"\x00asm\x01\x00\x00\x00", "full-engine WASM header invalid")
                text = javascript.read_text(encoding="utf-8")
                for export in full["exportContract"]["explicitExports"]:
                    require('Module["' + export + '"]' in text or "Module['" + export + "']" in text,
                            "required actual generated export missing: " + export)
                terminal["status"] = "full-authoritative-engine-linked-not-runtime-accepted"
    except BaseException as error:
        terminal.update(status="failed-owned-window", failure=repr(error))
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        try:
            after = cpp2.fingerprints(records)
            after_trees = capture_accepted_trees(full, cpp2)
            write_json(destination / "input-fingerprints-after.json", after)
            write_json(destination / "frozen-tree-metadata-after.json", after_trees)
            require(before == after == expected_fingerprints(records) and
                    trees == after_trees == packet["acceptedTreeBaselines"], "protected source/baseline/SDK changed")
            terminal["protectedCoherentSourceAndGeneratedMetadataUnchanged"] = True
            terminal["protectedPinnedBytesAndFrozenSdkUnchanged"] = True
            terminal["inputAuditPins"] = [pin(destination / name) for name in ["input-fingerprints-before.json",
                "input-fingerprints-after.json", "frozen-tree-metadata-before.json", "frozen-tree-metadata-after.json"]]
        except BaseException as error:
            terminal.update(status="failed-terminal-input-audit", terminalFailure=repr(error))
        cleanup_path = destination / (command["stage"] + ".outer-cleanup.json")
        if terminal["compilerLaunchAttempted"]:
            try:
                cleanup = json.loads(cleanup_path.read_bytes())
                terminal["ownedCleanupPassed"] = cleanup["passed"] and not cleanup["remainingOwnedJobHandles"] and not cleanup["errors"]
                terminal["ownedCleanupEvidence"] = pin(cleanup_path)
                require(terminal["ownedCleanupPassed"], "owned cleanup unresolved")
            except BaseException as error:
                terminal.update(status="failed-owned-cleanup", cleanupFailure=repr(error))
        artifact_pins, archived_pins = [], []
        names = ["outputObject", "outputDependencyFile"] if options.mode == "compile" else ["outputWasm", "outputJavascript"]
        archive = destination / "outputs"
        try:
            ordinary_owned(archive, directory=True, allow_missing=True)
            require(not os.path.lexists(archive), "fresh output archive required")
            archive.mkdir()
            for name in names:
                file = Path(command[name])
                if os.path.lexists(file):
                    ordinary_owned(file, anchor=candidate)
                    target = fresh_owned_file(archive / file.name)
                    shutil.copyfile(file, target)
                    require(digest(file) == digest(target), "output archive mismatch")
                    artifact_pins.append(pin(file))
                    archived_pins.append(pin(target))
            if terminal["status"] in ["genuine-original-tuple-compile-passed", "full-authoritative-engine-linked-not-runtime-accepted"]:
                require(len(artifact_pins) == len(names), "exact successful output archive incomplete")
        except BaseException as error:
            terminal.update(status="failed-output-archive", archiveFailure=repr(error),
                            archiveFailurePreservedAfterOwnedCleanup=True)
        terminal["artifactPins"] = artifact_pins
        terminal["archivedArtifactPins"] = archived_pins
        terminal["actualNonSystemDependencies"] = actual_dependencies
        try:
            fresh_owned_file(destination / "terminal.json")
            write_json(destination / "terminal.json", terminal)
        except BaseException as error:
            terminal.update(status="failed-terminal-write", terminalWriteFailure=repr(error))
            print(json.dumps(terminal), flush=True)
            raise
    if terminal["status"] == "genuine-original-tuple-compile-passed":
        receipt = {"status": terminal["status"], "fullPlanSha256": PLAN_SHA, "index": options.index,
                   "buildIdentity": full["buildIdentity"],
                   "command": command, "artifactPins": terminal["artifactPins"], "ownedCleanupPassed": True,
                   "guardVerdict": pin(destination / (command["stage"] + ".json")),
                   "terminal": pin(destination / "terminal.json"), "actualNonSystemDependencies": actual_dependencies}
        fresh_owned_file(receipt_file(full, options.index))
        write_json(receipt_file(full, options.index), receipt)
        verify_receipt(full, options.index, cpp2, records, bridge, packet)
    print(json.dumps({key: terminal.get(key) for key in ["status", "mode", "index", "compilerLaunchAttempted",
        "ownedCleanupPassed", "protectedPinnedBytesAndFrozenSdkUnchanged", "failure", "terminalFailure", "cleanupFailure", "archiveFailure"]}), flush=True)
    require(terminal["status"] in ["genuine-original-tuple-compile-passed", "full-authoritative-engine-linked-not-runtime-accepted",
                                  "deferred-browser-priority", "blocked-fresh-resource-gate"], "read archived failure; no automatic retry")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["compile", "full-link"], default="compile")
    parser.add_argument("--index", type=int)
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--packet-sha256")
    parser.add_argument("--attempt-name")
    options = parser.parse_args()
    if options.mode == "compile" and options.index is None:
        options.index = 0
    full, packet, cpp2, records, command, bridge = validate(options)
    if not options.run:
        result = {"status": "exact-owner-source-pins-validated-no-launch", "mode": options.mode, "index": options.index,
                  "runnerSha256": digest(__file__), "packetSha256": digest(HERE / "OWNER-PINS-r3.json"),
                  "fullPlanSha256": PLAN_SHA, "protectedFileCount": len(records), "command": command,
                  "launchGate": bridge["launchGate"], "ownedResourceGuard": bridge["ownedResourceGuard"],
                  "WindowsGuardLoaded": False, "compilerExecuted": False, "browserExecuted": False,
                  "compileReceiptFilesPresentUnverified": sum(os.path.lexists(receipt_file(full, index)) for index in range(235)),
                  "receiptProofValidationOccursBeforeExecution": True,
                  "fullLinkRequiresAll235Receipts": True, "rootSeparateReleaseRequired": True}
        write_json(HERE / ("OWNER-SOURCE-VALIDATION-r3-" + options.mode + ".json"), result)
        print(json.dumps({key: value for key, value in result.items() if key != "command"}), flush=True)
        return
    execute(full, packet, cpp2, records, command, bridge, options)


if __name__ == "__main__":
    main()
