"""Bounded four-stage actual key/help fixture owner; default is stdlib source validation only."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import sys
import time
import types

HERE = Path(__file__).resolve().parent.parent
KEY = HERE / "key-scope"
PLAN_PATH = KEY / "KEY-SCOPE-WINDOW-PLAN.json"
PLAN_SHA = "407751c2377af984fb9e4d6d67d37d71691306538ad25f35f8d6c683ae8015de"
PACKET_SHA = "dd0c03eeb452408eeddbe79d8c0c922608c9b14bfcaf5ff29f0ba1dc2c84258b"
CPP2_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
PIN_COUNT = 1425
GIB = 1024 ** 3
STAGES = ["compile-selected-original-key-support", "compile-original-key-help-fixture",
          "strict-link-original-key-help-scope", "execute-original-key-help-scope"]
LINK_FLAGS = ['-O0', '-fexceptions', '--no-entry', '-Wl,--threads=1', '-Wl,--gc-sections', '-sERROR_ON_UNDEFINED_SYMBOLS=1', '-sDISABLE_EXCEPTION_CATCHING=0', '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=node', '-sINVOKE_RUN=0', '-sEXIT_RUNTIME=0', '-sFILESYSTEM=1', '-sNODERAWFS=0', '-sDYNAMIC_EXECUTION=0', '-sASSERTIONS=1', '-sALLOW_MEMORY_GROWTH=1', '-sINITIAL_MEMORY=33554432', '-sMAXIMUM_MEMORY=134217728', '-sSTACK_SIZE=1048576', '-sEXPORTED_FUNCTIONS=["_cdda_original_key_help_fixture_run","_cdda_fixture_diagnostic_call_count"]']


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    value = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def ordinary(path):
    state = Path(path).lstat()
    require(not Path(path).is_symlink() and not getattr(state, "st_file_attributes", 0) & 0x400,
            "reparse/symlink path: " + str(path))


def ordinary_chain(path):
    candidate = Path(path).absolute()
    for current in [candidate, *candidate.parents]:
        ordinary(current)


def checked(path, expected):
    ordinary_chain(path)
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected, "fixed source bytes changed: " + str(path))
    return data


def pin(path):
    ordinary_chain(path)
    p = Path(path).resolve()
    require(p.is_file(), "protected ordinary file")
    return {"path": str(p), "bytes": p.stat().st_size, "sha256": digest(p)}


def within(path, parent):
    try:
        Path(path).resolve().relative_to(Path(parent).resolve())
        return True
    except ValueError:
        return False


def validate_pin_records(records):
    known = {}
    for record in records:
        require(set(record) == {"path", "bytes", "sha256"}, "exact pin schema")
        require(type(record["bytes"]) is int and record["bytes"] >= 0 and
                type(record["sha256"]) is str and re.fullmatch(r"[a-f0-9]{64}", record["sha256"]), "pin types")
        require(record["path"] not in known, "duplicate protected pin")
        require(pin(record["path"]) == record, "protected bytes changed: " + record["path"])
        known[record["path"]] = record


def metadata_tree(root):
    ordinary_chain(root)
    result = {}
    for directory, dirs, files in os.walk(root, followlinks=False):
        for name in [*dirs, *files]:
            file = Path(directory) / name
            ordinary(file)
            state = file.lstat()
            result[str(file)] = [None if file.is_dir() else state.st_size, state.st_mtime_ns,
                                 state.st_mode, getattr(state, "st_file_attributes", 0)]
    return result


def write_json(path, value):
    data = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    ordinary_chain(Path(path).parent)
    if os.path.lexists(path):
        ordinary_chain(path)
        require(Path(path).read_bytes() == data, "immutable source validation result changed")
    else:
        with Path(path).open("xb") as stream:
            stream.write(data)


def mmd_paths(file):
    line = re.sub(r"\\\r?\n", " ", Path(file).read_text(encoding="utf-8")).splitlines()[0]
    separator = line.find(": ")
    require(separator > 0, "MMD target separator")
    return line[:separator], sorted({str(Path(x).resolve()) for x in line[separator + 2:].split()})


def load_sources():
    # This function reads source and metadata only. No build-helper import, guard or counter call.
    data = checked(PLAN_PATH, PLAN_SHA)
    plan = json.loads(data)
    packet_data = checked(KEY / "KEY-SCOPE-SOURCE-PACKET.json", PACKET_SHA)
    packet = json.loads(packet_data)
    require(plan["sourceCommit"] == "7b2efa5cea38e4d4d97dd0e63b28b9148623da59", "official source")
    require(plan["sourcePacketSha256"] == PACKET_SHA and
            plan["browserRecoveryHasPriority"] is True and plan["parentExclusiveSlotReleaseRequired"] is True,
            "priority/source packet")
    require([x["stage"] for x in plan["commands"]] == STAGES, "exact four stages")
    require(len(plan["pins"]) == PIN_COUNT and packet["originalCoreReuse"]["count"] == 23 and
            packet["coherentCompiledReuse"]["count"] == 5, "exact reuse/pin counts")
    require(plan["exactLinkFlags"] == LINK_FLAGS and plan["affectedOriginalUnitsBeforeFullRelink"] == 231,
            "strict link/full rebuild distinction")
    require(plan["launchGate"]["minimumPhysicalFreeBytes"] == 4 * GIB and
            plan["launchGate"]["minimumExactCommitHeadroomBytes"] == 6 * GIB, "fresh 4/6 gate")
    guard = plan["ownedResourceGuard"]
    require(guard["maximumOwnedTreePrivateBytes"] == GIB and guard["maximumOwnedTreeWorkingSetBytes"] == GIB and
            guard["minimumPhysicalFreeBytes"] == 2 * GIB and guard["minimumExactCommitHeadroomBytes"] == 2 * GIB and
            guard["maximumStageSeconds"] == 180 and guard["sampleIntervalMilliseconds"] == 250,
            "fixed owned caps/floors/time")
    for item in [HERE, KEY, HERE / "build", HERE / "build/sources/src", HERE / "build/objects", HERE / "execution"]:
        ordinary_chain(item)
        require(item.is_dir(), "ordinary source/output ancestry")
    output = HERE / "build/key-scope-run"
    require(Path(plan["outputDirectory"]) == output, "owned exact output directory")
    if os.path.lexists(output):
        ordinary_chain(output)
        require(output.is_dir(), "output directory type")
    metadata_tree(HERE / "build/sources/src")
    source_files = sorted(str(p.resolve()) for p in (HERE / "build/sources/src").rglob("*") if p.is_file())
    staged_pins = sorted(x["path"] for x in plan["pins"] if within(x["path"], HERE / "build/sources/src"))
    require(len(source_files) == 969 and source_files == staged_pins, "coherent exact source membership")
    old = json.loads(checked(HERE / "COMPILE-WINDOW-PLAN.json",
                            "d9023bbce0f8a4b567c71fb630e0db8b3af29ca3a37c19122e7757c32cbf1379"))
    for command, source, stem in zip(plan["commands"][:2],
                                    [KEY / "generated-selected-key-support.cpp", KEY / "original-key-help.cpp"],
                                    ["selected-key-support", "original-key-help-fixture"]):
        expected = [*old["commands"][0]["argv"][:-6], "-MMD", "-MP", "-c", str(source),
                    "-o", str(output / (stem + ".o"))]
        require(command["source"] == str(source) and command["argv"] == expected, "exact coherent compile")
        require(command["outputObject"] == str(output / (stem + ".o")) and
                command["outputDependencyFile"] == str(output / (stem + ".d")) and
                command["outputs"] == [command["outputObject"], command["outputDependencyFile"]], "exact compile outputs")
    expected_objects = [*[x["object"]["path"] for x in packet["originalCoreReuse"]["objects"]],
                        *[x["object"]["path"] for x in packet["coherentCompiledReuse"]["objects"]],
                        *[x["outputObject"] for x in plan["commands"][:2]]]
    require(plan["linkObjects"] == expected_objects and len(expected_objects) == 30, "exact original closure")
    link, runtime = plan["commands"][2:]
    require(link["argv"] == [old["commands"][0]["argv"][0], "-v", *expected_objects, *LINK_FLAGS,
                              "-o", str(output / "original-key-help.mjs")], "strict exact mainless link")
    require(link["outputs"] == [str(output / "original-key-help.mjs"), str(output / "original-key-help.wasm")],
            "exact link outputs")
    require(runtime["argv"] == [str(KEY / "run-original-key-help.mjs")] and runtime["outputs"] == [], "exact driver")
    require(Path(runtime["executable"]).name.casefold() == "node.exe", "pinned native Node")
    for command in plan["commands"]:
        require(command["cwd"] == str(HERE / "build") and command["environment"] == old["commands"][0]["environment"],
                "fixed cwd/frozen one-worker environment")
        for file in command["outputs"]:
            require(within(file, output) and Path(file).parent == output, "output containment")
    require(all(x["executable"] == old["commands"][0]["executable"] for x in plan["commands"][:3]),
            "official Python compiler executable")
    require(len(packet["originalCoreReuse"]["objects"]) == 23 and len(packet["coherentCompiledReuse"]["objects"]) == 5,
            "reuse row counts")
    for row in packet["originalCoreReuse"]["objects"]:
        target, paths = mmd_paths(row["dependencyFile"]["path"])
        require(Path(target).resolve() == Path(row["object"]["path"]).resolve() and paths == sorted(row["actualMmdPaths"]),
                "actual original MMD membership/target")
        require(not any(Path(x).name in ["input.h", "input_context.h", "help.h"] for x in paths), "changed class header reuse")
        require(type(row["success"]["code"]) is int and row["success"]["code"] == 0, "actual original success log")
        for dependency in row["unchangedDependencies"]:
            candidate = HERE / "build/sources" / dependency["file"]
            require(candidate.stat().st_size == dependency["bytes"] and digest(candidate) == dependency["sha256"],
                    "core object prerequisite differs from coherent tree")
    for row in packet["coherentCompiledReuse"]["objects"]:
        target, paths = mmd_paths(row["dependencyFile"]["path"])
        require(Path(target).resolve() == Path(row["object"]["path"]).resolve() and paths == sorted(row["actualMmdPaths"]),
                "actual coherent MMD membership/target")
        receipt = json.loads(Path(row["successfulCompileReceipt"]["path"]).read_bytes())
        command = row["actualCommand"]
        require(receipt["passed"] is True and type(receipt["exitCode"]) is int and receipt["exitCode"] == 0 and
                receipt["argv"] == [command["executable"], *command["argv"]] and receipt["cwd"] == command["cwd"] and
                not receipt["remainingOwnedPidsBeforeJobClose"], "genuine coherent compile receipt")
        cleanup = json.loads(Path(row["closedOuterCleanup"]["path"]).read_bytes())
        require(cleanup["passed"] is True and not cleanup["remainingOwnedJobHandles"], "closed coherent compile job")
        require(str(Path(command["source"]).resolve()) in paths, "actual compiled coherent source")
    for row in [*packet["originalCoreReuse"]["objects"], *packet["coherentCompiledReuse"]["objects"]]:
        require(Path(row["object"]["path"]).read_bytes()[:8] == b"\0asm\1\0\0\0", "actual original/coherent object")
    require(packet["officialHelpPath"] == "data/core/help.json" and packet["officialBindingEntries"] == 620 and
            packet["expectedNativeChecksPerCall"] == 36 and packet["plannedNativeCalls"] == 2 and
            packet["plannedNativeChecks"] == 72 and packet["actualNativeChecks"] == 0, "actual data/planned scope")
    require(plan["requiredExports"] == ["cdda_original_key_help_fixture_run", "cdda_fixture_diagnostic_call_count",
                "cdda_help_snapshot_pin", "cdda_help_snapshot_data", "cdda_help_snapshot_size", "cdda_help_snapshot_release"],
            "fixture plus actual KEEPALIVE transport exports")
    records = [*plan["pins"], pin(PLAN_PATH), pin(__file__)]
    validate_pin_records(records)
    wrapper = checked(plan["guard"]["currentWrapper"]["path"],
                      "0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb").decode("utf-8")
    require(wrapper.count('(command["stage"] + ".stdout.log")') == 1, "fixed stdout suffix")
    require((HERE / "build/.emscripten").read_text(encoding="utf-8").splitlines()[-1] == "FROZEN_CACHE = True",
            "frozen SDK configuration")
    helper_path = HERE.parent / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"
    helper_data = checked(helper_path, CPP2_SHA)
    return plan, records, data, packet_data, helper_data


def load_execution_helper(helper_data, options):
    # The fixed build framework is imported only after an explicit, exact future release.
    require(options.run and options.parent_released_window and options.runner_sha256 == digest(__file__),
            "guard import requires exact separately released owner")
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized64 Windows")
    helper_path = HERE.parent / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"
    require(hashlib.sha256(helper_data).hexdigest() == CPP2_SHA, "fixed build helper bytes")
    helper = types.ModuleType("cdda_key_help_private_fixed_cpp2")
    helper.__file__ = str(helper_path)
    exec(compile(helper_data, str(helper_path), "exec", dont_inherit=True, optimize=0), helper.__dict__)
    helper.validate_inherited_environment()
    return helper

def wasm_exports(data):
    require(data[:8] == b"\0asm\1\0\0\0", "actual linked WASM header")
    cursor = 8

    def integer():
        nonlocal cursor
        result = 0
        for index in range(5):
            require(cursor < len(data), "truncated WASM integer")
            byte = data[cursor]
            cursor += 1
            require(index != 4 or byte <= 15, "WASM u32 overflow")
            result |= (byte & 127) << (7 * index)
            if not byte & 128:
                return result
        raise RuntimeError("invalid WASM integer")

    while cursor < len(data):
        section = data[cursor]
        cursor += 1
        size = integer()
        end = cursor + size
        require(end <= len(data), "truncated WASM section")
        if section == 7:
            names = []
            for _ in range(integer()):
                length = integer()
                require(cursor + length < end, "truncated WASM export")
                name = data[cursor:cursor + length].decode("utf-8", "strict")
                cursor += length
                kind = data[cursor]
                cursor += 1
                integer()
                if kind == 0:
                    names.append(name)
            require(cursor == end, "WASM export payload")
            return names
        cursor = end
    raise RuntimeError("WASM export section absent")


def strict_runtime_result(raw, expected):
    require(type(raw) is str and len(raw.encode("utf-8")) <= 16384 and
            len(raw.splitlines()) == 1 and raw.strip(), "exact one complete stdout JSON line")

    def unique_object(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, "duplicate stdout JSON key")
            value[key] = item
        return value

    def invalid_constant(value):
        raise RuntimeError("nonfinite stdout JSON constant: " + value)

    actual = json.loads(raw, object_pairs_hook=unique_object, parse_constant=invalid_constant)
    require(type(actual) is dict and set(actual) == set(expected), "exact runtime result schema")
    require(all(type(expected[k]) in [str, int, bool] and type(actual[k]) is type(expected[k])
                for k in expected), "exact runtime primitive types")
    require(actual == expected, "exact genuine original producer values")
    return actual


def validate_runtime_result_contract(expected):
    canonical = json.dumps(expected, separators=(",", ":")) + "\n"
    require(strict_runtime_result(canonical, expected) == expected, "canonical stdout result")
    failures = ["warning\n" + canonical, canonical + "{}\n",
                canonical + "\n", "[]\n",
                canonical.rstrip()[:-1] + ',"status":"' + expected["status"] + '"}\n']
    for key, value in [("diagnosticCalls", False), ("originalChecksPerRun", 36.0),
                       ("runs", 2.0), ("browserExecuted", 0)]:
        changed = dict(expected)
        changed[key] = value
        failures.append(json.dumps(changed) + "\n")
    changed = dict(expected)
    changed["diagnosticCalls"] = float("nan")
    failures.append(json.dumps(changed) + "\n")
    changed = dict(expected)
    changed["unexpected"] = True
    failures.append(json.dumps(changed) + "\n")
    for raw in failures:
        try:
            strict_runtime_result(raw, expected)
        except (RuntimeError, ValueError, TypeError):
            continue
        raise RuntimeError("malformed or mistyped runtime stdout was accepted")
    return len(failures) + 1



def verify_stage(command, plan, records):
    if command["stage"] in STAGES[:2]:
        obj = Path(command["outputObject"])
        require(obj.read_bytes()[:8] == b"\0asm\1\0\0\0", "actual fixture/support object WASM header")
        target, paths = mmd_paths(command["outputDependencyFile"])
        require(Path(target).resolve() == obj.resolve(), "actual compiled MMD target")
        known = {str(Path(x["path"]).resolve()) for x in records}
        require(not [x for x in paths if x not in known], "unprotected actual compile dependency")
        required = (["translations.h", "output.h", "debug.h", "input.h", "input_context.h"]
                    if command["stage"] == STAGES[0] else
                    ["help.h", "input.h", "input_context.h", "cdda_help_semantic.h", "cdda_help_transport.h"])
        for name in required:
            require(str((HERE / "build/sources/src" / name).resolve()) in paths, "coherent compiled declaration " + name)
        require(str(Path(command["source"]).resolve()) in paths, "actual selected source")
        return {"actualNonSystemDependencies": paths}
    if command["stage"] == STAGES[2]:
        exports = wasm_exports(Path(command["outputs"][1]).read_bytes())
        require({x for x in exports if x.startswith("cdda_")} == set(plan["requiredExports"]),
                "exact fixture and real transport exports")
        require(Path(command["outputs"][0]).stat().st_size > 0, "actual generated native Node glue")
        return {"actualFunctionExports": exports, "strictLinkClosureProven": True}
    return {}

def archive_outputs(command, destination, helper):
    ordinary_chain(HERE / "build/key-scope-run")
    ordinary_chain(destination)
    results = []
    target = destination / "outputs" / command["stage"]
    target.mkdir(parents=True, exist_ok=False)
    for file in command["outputs"]:
        source = Path(file)
        if source.exists():
            ordinary_chain(source)
            require(source.is_file() and helper.within(source, HERE / "build/key-scope-run"), "owned output")
            copy = target / source.name
            shutil.copyfile(source, copy)
            require(helper.digest(copy) == helper.digest(source), "output archive mismatch")
            results.append({"current": helper.pin(source), "archive": helper.pin(copy)})
    return results


def execute(plan, helper, records, data, packet_data, helper_data, options):
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized64 Windows")
    require(options.parent_released_window and options.runner_sha256 == helper.digest(__file__),
            "exact separately released owner")
    require(re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", options.attempt_name), "attempt name")
    require(all(not os.path.lexists(f) for c in plan["commands"] for f in c["outputs"]), "fresh outputs; no retry or broken-link overwrite")
    destination = HERE / "execution" / options.attempt_name
    require(helper.within(destination, HERE / "execution"), "attempt containment")
    ordinary_chain(destination.parent)
    require(not os.path.lexists(destination), "fresh exact attempt; no retries")
    destination.mkdir(parents=True, exist_ok=False)
    output = Path(plan["outputDirectory"])
    ordinary_chain(output.parent)
    if os.path.lexists(output):
        ordinary_chain(output)
    output.mkdir(exist_ok=True)
    temporary = destination / "temporary"
    temporary.mkdir()
    (destination / "accepted-plan.json").write_bytes(data)
    (destination / "accepted-source-packet.json").write_bytes(packet_data)
    (destination / "accepted-cpp2-helper.py").write_bytes(helper_data)
    shutil.copyfile(__file__, destination / "accepted-owner.py")
    terminal = {"schemaVersion": 1, "status": "preparing-original-key-help-window",
                "planSha256": PLAN_SHA, "runnerSha256": helper.digest(__file__), "stages": [],
                "strictLinkClosureProven": False, "originalProducerExecuted": False,
                "originalKeynameExecuted": False, "originalGetDescExecuted": False, "helpDisplayExecuted": False,
                "selectedHelpScopeExecuted": False, "originalTransportPinOwnershipExecuted": False, "syntheticTransportExecuted": False,
                "RustExecuted": False, "fullEngineLinked": False, "browserExecuted": False,
                "wholeGameAccepted": False, "affectedOriginalUnitsBeforeFullRelink": 231}
    controlled = {**helper.CONTROLLED_INHERITED, "TEMP": str(temporary), "TMP": str(temporary)}
    old_environment = {key: os.environ.get(key) for key in controlled}
    before, trees, source_tree = None, None, None
    output_records = []
    try:
        before = helper.fingerprints(records)
        trees = {k: helper.metadata_tree(plan["frozenSDK"][k]) for k in ["cache", "ports"]}
        source_tree = helper.metadata_tree(HERE / "build/sources/src")
        helper.write_json(destination / "pins-before.json", before)
        helper.write_json(destination / "frozen-metadata-before.json", trees)
        helper.write_json(destination / "source-tree-before.json", source_tree)
        os.environ.update(controlled)
        wrapper, guard = helper.load_wrapper(plan)
        for command in plan["commands"]:
            ordinary_chain(output)
            ordinary_chain(destination)
            ordinary_chain(temporary)
            helper.validate_pin_records([*records, *output_records])
            require(helper.metadata_tree(HERE / "build/sources/src") == source_tree, "coherent source changed")
            require(all(helper.metadata_tree(plan["frozenSDK"][k]) == trees[k] for k in trees), "frozen SDK changed")
            captured = time.monotonic()
            counters = guard.counters()
            decision = helper.choose_launch(counters)
            stage = {"stage": command["stage"], "decision": decision, "freshCounters": counters,
                     "argv": [command["executable"], *command["argv"]], "cwd": command["cwd"]}
            terminal["stages"].append(stage)
            helper.write_json(destination / (command["stage"] + ".launch-decision.json"), stage)
            if decision != "launch":
                terminal["status"] = decision
                break
            require(time.monotonic() - captured <= 15, "stale counters")
            try:
                result = wrapper.run_owned(guard, command, destination)
                cleanup = json.loads((destination / (command["stage"] + ".outer-cleanup.json")).read_bytes())
                require(cleanup["passed"] and not cleanup["remainingOwnedJobHandles"], "owned job cleanup")
                require(result["passed"] and result["exitCode"] == 0 and
                        not result["remainingOwnedPidsBeforeJobClose"], "owned stage failed")
                stage.update(status="passed", durationSeconds=result["durationSeconds"],
                             jobPeakPrivateBytes=result["jobPeakPrivateBytes"],
                             maximumSampledWorkingSetBytes=max((x["ownedWorkingSetBytes"] for x in result["samples"]), default=0),
                             **verify_stage(command, plan, [*records, *output_records]))
                if command["stage"] == STAGES[2]:
                    terminal["strictLinkClosureProven"] = True
                if command["stage"] == STAGES[3]:
                    raw = (destination / (command["stage"] + ".stdout.log")).read_text(encoding="utf-8")
                    actual = strict_runtime_result(raw, plan["expectedRuntimeResult"])
                    stage["actualOriginalProducerResult"] = actual
                    terminal["originalProducerExecuted"] = True
                    terminal["originalKeynameExecuted"] = True
                    terminal["originalGetDescExecuted"] = True
                    terminal["selectedHelpScopeExecuted"] = True
                    terminal["originalTransportPinOwnershipExecuted"] = True
            except BaseException as error:
                stage.update(status="failed", error=type(error).__name__ + ": " + str(error))
                terminal["status"] = "stage-failed-no-retry"
                break
            finally:
                stage["outputs"] = archive_outputs(command, destination, helper)
                output_records.extend(x["current"] for x in stage["outputs"])
            helper.validate_pin_records([*records, *output_records])
        else:
            terminal["status"] = "selected-original-key-help-scope-passed"
    except BaseException as error:
        terminal["status"] = "owner-failed-no-retry"
        terminal["error"] = type(error).__name__ + ": " + str(error)
    finally:
        try:
            helper.validate_pin_records([*records, *output_records])
            after = helper.fingerprints(records)
            after_trees = {k: helper.metadata_tree(plan["frozenSDK"][k]) for k in ["cache", "ports"]}
            after_source = helper.metadata_tree(HERE / "build/sources/src")
            helper.write_json(destination / "pins-after.json", after)
            helper.write_json(destination / "frozen-metadata-after.json", after_trees)
            helper.write_json(destination / "source-tree-after.json", after_source)
            require(before == after and trees == after_trees and source_tree == after_source,
                    "protected bytes/metadata changed")
            terminal["protectedSourceAndFrozenSDKUnchanged"] = True
        except BaseException as error:
            terminal["status"] = "final-protection-failed"
            terminal["protectionError"] = type(error).__name__ + ": " + str(error)
        for key, value in old_environment.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        helper.write_json(destination / "TERMINAL.json", terminal)
    print(json.dumps({"status": terminal["status"], "stages": len(terminal["stages"]),
                      "originalProducerExecuted": terminal["originalProducerExecuted"],
                      "strictLinkClosureProven": terminal["strictLinkClosureProven"],
                      "evidenceDirectory": str(destination)}, separators=(",", ":")))
    return 0 if terminal["status"] == "selected-original-key-help-scope-passed" else 1



def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--attempt-name", default="semantic-key-help-initial")
    options = parser.parse_args()
    plan, records, data, packet_data, helper_data = load_sources()
    strict_checks = validate_runtime_result_contract(plan["expectedRuntimeResult"])
    if not options.run:
        require(not options.parent_released_window and options.runner_sha256 is None,
                "no-run validation cannot consume a parent release")
        result = {"status": "source-only-key-help-owner-validated", "planSha256": PLAN_SHA,
                  "sourcePacketSha256": PACKET_SHA, "runnerSha256": digest(__file__),
                  "protectedFiles": len(records), "stdoutContractSuffix": ".stdout.log",
                  "strictRuntimeResultSourceChecks": strict_checks, "stages": STAGES,
                  "pristineCoreReuseObjects": 23, "coherentCompiledReuseObjects": 5,
                  "plannedOriginalChecksPerCall": 36, "plannedOriginalCalls": 2, "plannedOriginalChecks": 72,
                  "actualOriginalChecks": 0, "buildHelperImported": False, "guardInvoked": False,
                  "nativeCompilerExecuted": False, "originalProducerExecuted": False, "linkExecuted": False,
                  "helpDisplayExecuted": False, "RustExecuted": False, "browserExecuted": False,
                  "fullEngineLinked": False, "wholeGameAccepted": False}
        write_json(KEY / "KEY-SCOPE-OWNER-SOURCE-VALIDATION.json", result)
        print(json.dumps(result, separators=(",", ":")))
        return 0
    helper = load_execution_helper(helper_data, options)
    return execute(plan, helper, records, data, packet_data, helper_data, options)


if __name__ == "__main__":
    sys.exit(main())
