"""Two compile-only TUs, launched only after a separately released parent window.

Default/validation mode performs file and source checks only. It does not load the
Windows job helper, create a process, compile, link or open a browser.
"""
from pathlib import Path
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
ROOT = HERE.parents[2]
PLAN_PATH = HERE / "compile-plan.json"
PINS_PATH = HERE / "runner-pins.json"
PLAN_SHA256 = "f5e5f97a1cd2c8540f73675cc3d0bf8fc4cc462d48fa5f55a1b983c2ae1f3f0e"
WRAPPER_SHA256 = "0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb"
GUARD_SHA256 = "ae54cce5dbbe2e769d52572528f750b0573ef37fb172cc29db8ab8fa8208a8c3"
# Set only after prepare-runner-pins.py has read and verified the actual files.
RUNNER_PINS_SHA256 = "8af61c2fafff3bb1f7ef33361293893a0a7d150c517c30653ff372e1760274db"
GIB = 1024**3
STAGES = ["compile-overlay-input_context", "compile-overlay-browser_input_snapshot"]
UNSAFE_INHERITED = ["EMCC_LOCAL_PORTS", "EMCC_USE_CURL", "EM_LLVM_ROOT", "EM_BINARYEN_ROOT",
                    "EM_NODE_JS", "EM_PYTHON", "EMSCRIPTEN", "PYTHONPATH", "PYTHONHOME",
                    "EM_FROZEN_CACHE", "EM_COMPILER_WRAPPER", "EM_CLANG_ADD_VERSION",
                    "EM_LLVM_ADD_VERSION", "EMCC_TEMP_DIR", "EMCC_SKIP_SANITY_CHECK",
                    "EMCC_DEBUG_SAVE", "EM_HAVE_TEMP_DIR_LOCK", "CPATH", "CPLUS_INCLUDE_PATH",
                    "C_INCLUDE_PATH", "CLANG_CONFIG_FILE_USER_DIR", "CLANG_CONFIG_FILE_SYSTEM_DIR"]
CONTROLLED_INHERITED = {"PYTHONDONTWRITEBYTECODE": "1", "PYTHONNOUSERSITE": "1"}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    state = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return state.hexdigest()


def pin(path):
    path = Path(path)
    return {"path": str(path.resolve()), "bytes": path.stat().st_size, "sha256": digest(path)}


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def within(path, parent):
    return Path(path).resolve().is_relative_to(Path(parent).resolve())


def collect_pins(value):
    records = {}

    def visit(item):
        if isinstance(item, dict):
            if all(name in item for name in ["path", "bytes", "sha256"]):
                key = str(Path(item["path"]).resolve())
                record = {name: item[name] for name in ["path", "bytes", "sha256"]}
                require(key not in records or records[key] == record, "conflicting path pins")
                records[key] = record
            for child in item.values():
                visit(child)
        elif isinstance(item, list):
            for child in item:
                visit(child)

    visit(value)
    return [records[key] for key in sorted(records)]


def validate_pin_records(records):
    for item in records:
        require(pin(item["path"]) == {name: item[name] for name in ["path", "bytes", "sha256"]},
                "pinned file changed: " + item["path"])


def fingerprints(records):
    return {item["path"]: pin(item["path"]) for item in records}


def metadata_record(state):
    # Python defines st_size for regular files/symlinks, not directories.
    # Keep directory identity/time/mode/attributes and every regular-file size.
    return [None if stat.S_ISDIR(state.st_mode) else state.st_size, state.st_mtime_ns,
            state.st_mode, getattr(state, "st_file_attributes", 0)]


def metadata_tree(directory):
    """Stable tree metadata; directory lengths excluded, not byte identity."""
    root = Path(directory).resolve()
    require(root.is_dir(), "frozen cache/ports missing")
    records = {}
    for current, directories, files in os.walk(root, followlinks=False):
        for name in [*directories, *files]:
            path = Path(current) / name
            state = path.lstat()
            require(not path.is_symlink() and not (getattr(state, "st_file_attributes", 0) & 0x400),
                    "cache/ports reparse-point traversal is forbidden")
            records[path.relative_to(root).as_posix()] = metadata_record(state)
    return records


def output_paths(plan):
    return [Path(command[name]) for command in plan["commands"]
            for name in ["outputObject", "outputDependencyFile"]]


def validate_inherited_environment():
    # The SDK distinguishes missing from present-empty EM_<CONFIG_KEY> overrides.
    require(not [key for key in UNSAFE_INHERITED if key in os.environ], "unsafe inherited SDK/Python override present")


def validate_plan():
    plan_bytes, pins_bytes = PLAN_PATH.read_bytes(), PINS_PATH.read_bytes()
    require(hashlib.sha256(plan_bytes).hexdigest() == PLAN_SHA256, "fixed accepted compile plan hash mismatch")
    require(hashlib.sha256(pins_bytes).hexdigest() == RUNNER_PINS_SHA256, "supplemental runner pins hash mismatch")
    plan, extra = json.loads(plan_bytes), json.loads(pins_bytes)
    require(extra["acceptedCompilePlanSha256"] == PLAN_SHA256, "supplemental plan binding changed")
    require(plan["sourceCommit"] == "7b2efa5cea38e4d4d97dd0e63b28b9148623da59", "upstream commit changed")
    require(plan["browserRecoveryHasPriority"] and plan["parentExclusiveSlotReleaseRequired"], "parent/browser gate changed")
    require([item["stage"] for item in plan["commands"]] == STAGES, "exact sequential two-stage scope required")
    require(len(plan["stagedFiles"]) == 3 and len(plan["baseline"]["originalDependencies"]) == 144,
            "exact staged-source/baseline dependency counts required")
    require(plan["guard"]["historicalHelper"]["sha256"] == GUARD_SHA256 and
            plan["guard"]["currentWrapper"]["sha256"] == WRAPPER_SHA256, "reviewed guards changed")
    gate, guard = plan["launchGate"], plan["ownedResourceGuard"]
    require(gate["minimumPhysicalFreeBytes"] == 4 * GIB and
            gate["minimumExactCommitHeadroomBytes"] == 6 * GIB and gate["recaptureBeforeEveryCompileStage"], "4/6 gate changed")
    require(guard["maximumOwnedTreePrivateBytes"] == GIB and guard["maximumOwnedTreeWorkingSetBytes"] == GIB and
            guard["minimumPhysicalFreeBytes"] == 2 * GIB and guard["minimumExactCommitHeadroomBytes"] == 2 * GIB and
            guard["maximumStageSeconds"] == 180, "1 GiB/2 GiB floor/180s guard changed")
    require(guard["sampleIntervalMilliseconds"] == 250 and
            gate["soleOwnedHeavySlotParentConfirmed"] and gate["unrelatedForegroundApplicationsRemainOutsideOwnership"],
            "actual job sampling/ownership metadata changed")
    require(plan["rustEnvironment"] == {}, "C++ window must not gain Rust commands/environment")
    staged = HERE / "sources/src"
    for folder in [HERE / "sources", staged, HERE / "objects", HERE / "execution"]:
        if folder.exists():
            state = folder.lstat()
            require(not folder.is_symlink() and not (getattr(state, "st_file_attributes", 0) & 0x400),
                    "owned staging/output directory cannot be a reparse point")
    require(sorted(path.name for path in staged.iterdir()) ==
            ["browser_input_snapshot.cpp", "browser_input_snapshot.h", "input_context.cpp"], "staged directory has unexpected headers/files")
    require(Path(plan["frozenSDK"]["config"]["path"]).read_text(encoding="utf-8").splitlines()[-1] ==
            "FROZEN_CACHE = True", "frozen SDK configuration missing")
    for name, command in zip(["input_context", "browser_input_snapshot"], plan["commands"]):
        source, obj = staged / (name + ".cpp"), HERE / "objects" / (name + ".o")
        expected = [plan["commands"][0]["argv"][0], "-v", "-I" + str(staged),
                    *plan["baseline"]["exactBaseFlagsPreserved"], plan["buildIdentity"]["argvMacro"],
                    "-MMD", "-MP", "-c", str(source), "-o", str(obj)]
        require(command["argv"] == expected, "exact baseline-compatible compile argv changed")
        require(command["executable"] == plan["installedTools"][0]["path"] and
                Path(command["argv"][0]).resolve() == Path(plan["installedTools"][1]["path"]).resolve(), "installed Python/em++ changed")
        require(command["cwd"] == str(HERE) and command["outputObject"] == str(obj) and
                command["outputDependencyFile"] == str(obj.with_suffix(".d")), "isolated compile outputs changed")
        require(command["environment"] == {"EM_CONFIG": plan["frozenSDK"]["config"]["path"],
                "EM_CACHE": plan["frozenSDK"]["cache"], "EM_PORTS": plan["frozenSDK"]["ports"],
                "EMSDK_PYTHON": command["executable"], "EMCC_CORES": "1", "EMCC_BATCH_BUILD": "0", "BINARYEN_CORES": "1"},
                "frozen one-worker environment changed")
    records = collect_pins([plan, extra])
    validate_pin_records(records)
    for item in extra["portDetails"]:
        require(Path(item["markerPath"]).read_text(encoding="utf-8").strip() == item["acquisitionUrl"], "official port URL marker changed")
    validate_inherited_environment()
    return plan, records


def load_wrapper(plan):
    path = Path(plan["guard"]["currentWrapper"]["path"])
    source = path.read_bytes()
    require(hashlib.sha256(source).hexdigest() == WRAPPER_SHA256, "fixed wrapper changed")
    module = types.ModuleType("cdda_cpp2_private_fixed_outer_guard")
    module.__file__ = str(path)
    exec(compile(source, str(path), "exec", dont_inherit=True, optimize=0), module.__dict__)
    # The wrapper's generic load_guard expects the old flat guard record. This
    # adapter changes that in-memory interface only; accepted plan bytes stay fixed.
    guard_plan = dict(plan)
    guard_plan["guard"] = plan["guard"]["historicalHelper"]
    guard = module.load_guard(guard_plan)
    guard.PLAN = plan
    return module, guard


def choose_launch(counters):
    require(type(counters["physicalFreeBytes"]) is int and type(counters["exactCommitHeadroomBytes"]) is int,
            "invalid exact counter types")
    require(counters["physicalFreeBytes"] >= 0 and counters["exactCommitHeadroomBytes"] >= 0, "negative exact counters")
    if counters["physicalFreeBytes"] >= 7 * GIB and counters["exactCommitHeadroomBytes"] >= 9 * GIB:
        return "deferred-browser-priority"
    if counters["physicalFreeBytes"] < 4 * GIB or counters["exactCommitHeadroomBytes"] < 6 * GIB:
        return "blocked-fresh-4-6-gate"
    return "launch"


def archive_outputs(command, destination):
    result = []
    archive = destination / "outputs" / command["stage"]
    archive.mkdir(parents=True, exist_ok=False)
    for name in ["outputObject", "outputDependencyFile"]:
        source = Path(command[name])
        if source.exists():
            require(within(source, HERE / "objects") and source.is_file() and not source.is_symlink(), "unexpected output path/type")
            target = archive / source.name
            shutil.copyfile(source, target)
            require(digest(source) == digest(target), "output archival mismatch")
            result.append({"role": name, **pin(source), "archive": pin(target)})
    return result


def verify_outputs(command, records):
    obj, dep = Path(command["outputObject"]), Path(command["outputDependencyFile"])
    require(obj.is_file() and dep.is_file() and obj.stat().st_size > 8, "successful TU outputs missing")
    with obj.open("rb") as stream:
        require(stream.read(8) == b"\x00asm\x01\x00\x00\x00", "output is not a version-one wasm object")
    line = re.sub(r"\\\r?\n", " ", dep.read_text(encoding="utf-8")).splitlines()[0]
    separator = line.find(": ")
    require(separator > 0, "unsupported MMD target format")
    tokens = line[separator + 2:].split()
    known = {str(Path(item["path"]).resolve()): item for item in records}
    resolved = sorted({str(Path(token).resolve()) for token in tokens})
    unknown = [path for path in resolved if path not in known]
    require(not unknown, "actual non-system dependencies lack reviewed byte pins: " + repr(unknown))
    require(str(Path(command["argv"][-3]).resolve()) in resolved and
            str((HERE / "sources/src/browser_input_snapshot.h").resolve()) in resolved, "source/new header absent from MMD")
    return [known[path] for path in resolved]


def execute(plan, records, options):
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8, "unoptimized 64-bit Windows Python required")
    require(options.parent_released_window and options.runner_sha256 == digest(__file__), "explicit parent reservation/exact reviewed runner pin required")
    require(all(not path.exists() for path in output_paths(plan)), "refuse replacement of any previous compile-check object/dependency; fresh reviewed attempt required")
    destination = HERE / "execution" / options.attempt_name
    require(within(destination, HERE / "execution"), "attempt path escaped owned folder")
    destination.mkdir(parents=True, exist_ok=False)
    (destination / "temporary").mkdir()
    shutil.copyfile(PLAN_PATH, destination / "accepted-compile-plan.json")
    shutil.copyfile(PINS_PATH, destination / "accepted-runner-pins.json")
    shutil.copyfile(__file__, destination / "accepted-runner.py")
    before = fingerprints(records)
    write_json(destination / "input-fingerprints-before.json", before)
    trees = {name: metadata_tree(plan["frozenSDK"][name]) for name in ["cache", "ports"]}
    write_json(destination / "frozen-tree-metadata-before.json", trees)
    terminal = {"schemaVersion": 1, "status": "preparing-owned-window", "planSha256": PLAN_SHA256,
                "runnerSha256": digest(__file__), "wrapperSha256": WRAPPER_SHA256, "guardSha256": GUARD_SHA256,
                "supplementalPinsSha256": RUNNER_PINS_SHA256, "parentWindowExplicitlyReleased": True,
                "frozenTreeComparisonPolicy": "Directory st_size only normalized to null; entry membership/mtime/mode/attributes and all regular-file sizes retained; all207 byte pins remain enforced",
                "browserRecoveryHasPriority": True, "stages": [], "compilerLaunchAttempted": False,
                "compilerDriverRootCreated": False, "ownedRootCount": 0,
                "linkExecuted": False, "browserExecuted": False, "originalProducerConnected": False,
                "runtimeConnected": False, "wholeGameSemanticMigrationComplete": False,
                "controlledInheritedEnvironment": {**CONTROLLED_INHERITED, "TEMP": str(destination / "temporary"), "TMP": str(destination / "temporary")}}
    old_environment = {key: os.environ.get(key) for key in terminal["controlledInheritedEnvironment"]}
    try:
        os.environ.update(terminal["controlledInheritedEnvironment"])
        wrapper, guard = load_wrapper(plan)
        for command in plan["commands"]:
            validate_pin_records(records)
            require(all(metadata_tree(plan["frozenSDK"][name]) == trees[name] for name in trees), "frozen cache/ports metadata changed")
            captured = time.monotonic()
            counters = guard.counters()
            decision = choose_launch(counters)
            stage = {"stage": command["stage"], "counterCaptureSeconds": captured,
                     "freshCounters": counters, "decision": decision, "argv": [command["executable"], *command["argv"]]}
            terminal["stages"].append(stage)
            write_json(destination / (command["stage"] + ".launch-decision.json"), stage)
            if decision != "launch":
                terminal["status"] = decision
                break
            require(time.monotonic() - captured <= 15, "counter capture became stale")
            terminal["compilerLaunchAttempted"] = True
            # run_owned catches setup/query exceptions and always records its
            # owned-job/root cleanup. Never invoke historical run_stage directly.
            try:
                result = wrapper.run_owned(guard, command, destination)
                cleanup = json.loads((destination / (command["stage"] + ".outer-cleanup.json")).read_bytes())
                require(cleanup["passed"] and not cleanup["remainingOwnedJobHandles"], "owned cleanup did not close all jobs")
                require(result["passed"] and result["exitCode"] == 0 and not result["remainingOwnedPidsBeforeJobClose"], "owned TU did not finish empty")
                stage["actualNonSystemDependencies"] = verify_outputs(command, records)
                stage.update(status="compile-only-passed", durationSeconds=result["durationSeconds"],
                             jobPeakPrivateBytes=result["jobPeakPrivateBytes"],
                             maximumSampledWorkingSetBytes=max(sample["ownedWorkingSetBytes"] for sample in result["samples"]))
            except BaseException as error:
                stage.update(status="failed-owned-stage", guardOrOutputFailure=repr(error))
                raise
            finally:
                stage["outputs"] = archive_outputs(command, destination)
                write_json(destination / (command["stage"] + ".verdict.json"), stage)
            require(fingerprints(records) == before, "protected byte fingerprints changed")
        else:
            terminal["status"] = "two-translation-units-compile-only-passed"
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-window", failure=repr(error))
    finally:
        for key, value in old_environment.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        try:
            after = fingerprints(records)
            write_json(destination / "input-fingerprints-after.json", after)
            terminal["protectedPinnedBytesUnchanged"] = before == after
            after_trees = {name: metadata_tree(plan["frozenSDK"][name]) for name in trees}
            write_json(destination / "frozen-tree-metadata-after.json", after_trees)
            terminal["frozenTreeMetadataUnchanged"] = trees == after_trees
            require(before == after and trees == after_trees, "protected input/frozen tree changed")
        except BaseException as error:
            terminal.update(status="failed-terminal-input-audit", terminalAuditFailure=repr(error))
        cleanup_records = []
        for stage in terminal["stages"]:
            if stage["decision"] == "launch":
                path = destination / (stage["stage"] + ".outer-cleanup.json")
                try:
                    record = json.loads(path.read_bytes())
                    terminal["ownedRootCount"] += len(record["rootsCreated"])
                    cleanup_records.append({"stage": stage["stage"], "passed": record["passed"],
                                            "remainingOwnedJobHandles": record["remainingOwnedJobHandles"],
                                            "evidence": pin(path)})
                except BaseException as error:
                    cleanup_records.append({"stage": stage["stage"], "passed": False, "failure": repr(error)})
        terminal["ownedCleanupRecords"] = cleanup_records
        terminal["compilerDriverRootCreated"] = terminal["ownedRootCount"] > 0
        terminal["ownedJobsClosedAndRootsWaited"] = all(record["passed"] and
            not record.get("remainingOwnedJobHandles", []) for record in cleanup_records)
        if not terminal["ownedJobsClosedAndRootsWaited"]:
            terminal["status"] = "failed-owned-cleanup-incomplete"
        terminal["evidenceFiles"] = [pin(path) for path in sorted(destination.rglob("*"))
                                     if path.is_file() and "temporary" not in path.relative_to(destination).parts and path.name != "terminal.json"]
        write_json(destination / "terminal.json", terminal)
    print(json.dumps(terminal), flush=True)
    require(terminal["status"] in ["two-translation-units-compile-only-passed", "deferred-browser-priority", "blocked-fresh-4-6-gate"],
            "CPP2 window failed; read archived terminal/cleanup/diagnostics")
    return terminal


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--parent-released-window", action="store_true")
    parser.add_argument("--runner-sha256")
    parser.add_argument("--attempt-name", default="validation-only")
    options = parser.parse_args()
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name) is not None, "invalid fresh attempt name")
    ast.parse(Path(__file__).read_text(encoding="utf-8"), filename=__file__)
    plan, records = validate_plan()
    if not options.run:
        write_json(HERE / "runner-source-validation.json", {"status": "source-pins-and-argv-validated-no-compiler-run",
                   "planSha256": PLAN_SHA256, "runnerSha256": digest(__file__), "wrapperSha256": WRAPPER_SHA256,
                   "guardSha256": GUARD_SHA256, "supplementalPinsSha256": RUNNER_PINS_SHA256,
                   "uniquePinnedFileCount": len(records), "stagedSourceCount": 3, "originalDependencyCount": 144,
                   "commands": plan["commands"], "compilerExecuted": False, "WindowsGuardLoaded": False,
                   "browserExecuted": False, "launchResourceBehaviorExecuted": False,
                   "cppCompileValidityEstablished": False, "originalProducerConnected": False})
        print(json.dumps({"status": "source-validation-passed", "uniquePinnedFiles": len(records),
                          "runnerSha256": digest(__file__), "compilerExecuted": False}), flush=True)
        return
    execute(plan, records, options)


if __name__ == "__main__":
    main()
