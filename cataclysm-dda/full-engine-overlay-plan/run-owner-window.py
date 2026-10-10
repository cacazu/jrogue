"""Exact one-command owner; default is source/pin validation, never a launch.

Compile scope is fixed at all 235 ordered units, one command per invocation. A separate
full-link mode remains blocked until all 235 genuine compile receipts exist.
The unchanged CPP2 byte-buffer loader supplies reviewed run_owned cleanup.
"""
from pathlib import Path
import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import struct
import sys
import time
import types

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PLAN_SHA = "0367b240d5c36234f4e9ce8ea77dd6d55c44a90b0ac1033ae98b6476ed368b11"
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


def load_cpp2():
    file = ROOT / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"
    source = file.read_bytes()
    require(hashlib.sha256(source).hexdigest() == CPP2_SHA, "exact CPP2 loader changed")
    module = types.ModuleType("cdda_full_owner_private_cpp2_loader")
    module.__file__ = str(file)
    exec(compile(source, str(file), "exec", dont_inherit=True, optimize=0), module.__dict__)
    return module


def validate(options):
    source = Path(__file__).read_bytes()
    ast.parse(source, filename=__file__)
    packet_file = HERE / "OWNER-PINS.json"
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
    require(packet["fullPlanSha256"] == PLAN_SHA and packet["cpp2Sha256"] == CPP2_SHA,
            "packet source/loader binding changed")
    cpp2 = load_cpp2()  # standard-library definitions only; no Windows guard load
    records = packet["pins"]
    require(len({str(Path(row["path"]).resolve()) for row in records}) == len(records), "duplicate protected pins")
    cpp2.validate_pin_records(records)
    cpp2.validate_inherited_environment()
    candidate = Path(full["candidateDirectory"]).resolve()
    require(candidate.is_relative_to(HERE) and candidate.parent == HERE, "candidate ownership escape")
    for folder in [candidate, candidate / "sources", candidate / "sources/src", candidate / "objects",
                   candidate / "generated", candidate / "output", candidate / "evidence"]:
        state = folder.lstat()
        require(folder.is_dir() and not folder.is_symlink() and not (getattr(state, "st_file_attributes", 0) & 0x400),
                "candidate directory/reparse point rejected")
    config = candidate / ".emscripten"
    require(config.read_text(encoding="utf-8").splitlines()[-1] == "FROZEN_CACHE = True", "frozen cache config missing")
    expected_env = {"EM_CONFIG": str(config), "EM_CACHE": full["frozenSDK"]["cache"],
                    "EM_PORTS": full["frozenSDK"]["ports"], "EMSDK_PYTHON": full["compileCommands"][0]["executable"],
                    "EMCC_CORES": "1", "EMCC_BATCH_BUILD": "0", "BINARYEN_CORES": "1"}
    for command in [*full["compileCommands"], full["linkCommand"]]:
        require(command["cwd"] == str(candidate), "candidate cwd changed")
        require(command["environment"] == expected_env, "frozen single-worker environment changed")
        require(command["automaticRetry"] is False, "automatic retry forbidden")
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


def verify_receipt(full, index, cpp2):
    file = receipt_file(full, index)
    receipt = json.loads(file.read_bytes())
    command = full["compileCommands"][index]
    require(receipt["status"] == "genuine-original-tuple-compile-passed" and receipt["fullPlanSha256"] == PLAN_SHA,
            "successful genuine compile receipt required")
    require(receipt["index"] == index and receipt["command"] == command and receipt["ownedCleanupPassed"] is True,
            "receipt command/closure mismatch")
    cpp2.validate_pin_records(receipt["artifactPins"])
    verdict = json.loads(Path(receipt["guardVerdict"]["path"]).read_bytes())
    require(pin(receipt["guardVerdict"]["path"]) == receipt["guardVerdict"], "guard verdict changed")
    require(verdict["passed"] and verdict["exitCode"] == 0 and not verdict["remainingOwnedPidsBeforeJobClose"],
            "genuine guard result missing")
    return receipt


def verify_dependencies(command, records, full):
    obj, dep = Path(command["outputObject"]), Path(command["outputDependencyFile"])
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
    require(options.packet_sha256 == digest(HERE / "OWNER-PINS.json"), "exact independently reviewed packet required")
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name or "") is not None, "fresh attempt required")
    candidate = Path(full["candidateDirectory"])
    if options.mode == "compile":
        for index in range(options.index):
            verify_receipt(full, index, cpp2)
        for name in ["outputObject", "outputDependencyFile"]:
            require(not Path(command[name]).exists(), "prior output preserved; fresh reviewed source/attempt needed")
        require(not receipt_file(full, options.index).exists(), "successful command cannot be rerun")
    else:
        for index in range(235):
            verify_receipt(full, index, cpp2)
        require(not Path(command["outputJavascript"]).exists() and not Path(command["outputWasm"]).exists(),
                "existing full-engine artifact cannot be replaced")
    destination = HERE / "execution" / options.attempt_name
    require(destination.resolve().parent == (HERE / "execution").resolve(), "attempt containment")
    destination.mkdir(parents=True, exist_ok=False)
    temporary = destination / "temporary"
    temporary.mkdir()
    for file in [HERE / "FULL-INTEGRATION-PLAN.json", HERE / "OWNER-PINS.json", Path(__file__)]:
        shutil.copyfile(file, destination / file.name)
    before = cpp2.fingerprints(records)
    trees = {name: cpp2.metadata_tree(full["frozenSDK"][name]) for name in ["cache", "ports"]}
    write_json(destination / "input-fingerprints-before.json", before)
    write_json(destination / "frozen-tree-metadata-before.json", trees)
    terminal = {"schemaVersion": 1, "status": "preparing", "mode": options.mode, "index": options.index,
                "fullPlanSha256": PLAN_SHA, "runnerSha256": digest(__file__), "packetSha256": options.packet_sha256,
                "exactCommand": command, "compilerLaunchAttempted": False, "ownedCleanupPassed": False,
                "originalEngineOrBrowserAcceptance": False, "automaticRetry": False}
    changed_environment = {"PYTHONDONTWRITEBYTECODE": "1", "PYTHONNOUSERSITE": "1",
                           "TEMP": str(temporary), "TMP": str(temporary)}
    previous = {key: os.environ.get(key) for key in changed_environment}
    result = None
    actual_dependencies = None
    try:
        os.environ.update(changed_environment)
        cpp2.validate_pin_records(records)
        require(all(cpp2.metadata_tree(full["frozenSDK"][name]) == trees[name] for name in trees), "frozen SDK metadata changed")
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
            require(cleanup["passed"] and not cleanup["remainingOwnedJobHandles"] and not cleanup["errors"], "owned cleanup failed")
            require(result["passed"] and result["exitCode"] == 0 and not result["remainingOwnedPidsBeforeJobClose"], "owned command failed")
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
            after_trees = {name: cpp2.metadata_tree(full["frozenSDK"][name]) for name in trees}
            write_json(destination / "input-fingerprints-after.json", after)
            write_json(destination / "frozen-tree-metadata-after.json", after_trees)
            require(before == after and trees == after_trees, "protected source/baseline/SDK changed")
            terminal["protectedPinnedBytesAndFrozenSdkUnchanged"] = True
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
        artifact_pins = []
        names = ["outputObject", "outputDependencyFile"] if options.mode == "compile" else ["outputWasm", "outputJavascript"]
        archive = destination / "outputs"
        archive.mkdir()
        for name in names:
            file = Path(command[name])
            if file.exists():
                require(file.is_file() and not file.is_symlink() and file.resolve().is_relative_to(candidate), "output containment")
                target = archive / file.name
                shutil.copyfile(file, target)
                require(digest(file) == digest(target), "output archive mismatch")
                artifact_pins.append(pin(file))
        terminal["artifactPins"] = artifact_pins
        terminal["actualNonSystemDependencies"] = actual_dependencies
        write_json(destination / "terminal.json", terminal)
    if terminal["status"] == "genuine-original-tuple-compile-passed":
        receipt = {"status": terminal["status"], "fullPlanSha256": PLAN_SHA, "index": options.index,
                   "command": command, "artifactPins": terminal["artifactPins"], "ownedCleanupPassed": True,
                   "guardVerdict": pin(destination / (command["stage"] + ".json")),
                   "terminal": pin(destination / "terminal.json"), "actualNonSystemDependencies": actual_dependencies}
        write_json(receipt_file(full, options.index), receipt)
    print(json.dumps({key: terminal.get(key) for key in ["status", "mode", "index", "compilerLaunchAttempted",
        "ownedCleanupPassed", "protectedPinnedBytesAndFrozenSdkUnchanged", "failure", "terminalFailure", "cleanupFailure"]}), flush=True)
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
                  "runnerSha256": digest(__file__), "packetSha256": digest(HERE / "OWNER-PINS.json"),
                  "fullPlanSha256": PLAN_SHA, "protectedFileCount": len(records), "command": command,
                  "launchGate": bridge["launchGate"], "ownedResourceGuard": bridge["ownedResourceGuard"],
                  "WindowsGuardLoaded": False, "compilerExecuted": False, "browserExecuted": False,
                  "fullLinkGenuineCompileReceiptsPresent": sum(receipt_file(full, index).exists() for index in range(235)),
                  "fullLinkRequiresAll235Receipts": True, "rootSeparateReleaseRequired": True}
        write_json(HERE / ("OWNER-SOURCE-VALIDATION-" + options.mode + ".json"), result)
        print(json.dumps({key: value for key, value in result.items() if key != "command"}), flush=True)
        return
    execute(full, packet, cpp2, records, command, bridge, options)


if __name__ == "__main__":
    main()
