"""Source-only manifest preparation. No subprocess, compiler, linker or WASM load."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CPP2 = HERE.parent / "build-plan/cpp-compile"
CPP2_PLAN_SHA = "f5e5f97a1cd2c8540f73675cc3d0bf8fc4cc462d48fa5f55a1b983c2ae1f3f0e"
CPP2_EXTRA_SHA = "8af61c2fafff3bb1f7ef33361293893a0a7d150c517c30653ff372e1760274db"
MODULE_SHA = "6b51c020266411687603fa3458e0dc528bc5f8fae86202cfe3ad7ac2d17200e2"
CPP2_TERMINAL_SHA = "05482497f88b7b3cc63bb6fd338adf44c6497d3209b419e52ba87a4aff733ea5"


def digest(path):
    state = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return state.hexdigest()


def pin(path):
    path = Path(path).resolve()
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": digest(path)}


def checked_json(path, expected):
    data = Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise RuntimeError("pinned input changed: " + str(path))
    return json.loads(data)


def collect(value, result):
    if isinstance(value, dict):
        if all(key in value for key in ["path", "bytes", "sha256"]):
            item = {key: value[key] for key in ["path", "bytes", "sha256"]}
            actual = pin(item["path"])
            if actual != item:
                raise RuntimeError("input pin changed: " + item["path"])
            if item["path"] in result and result[item["path"]] != item:
                raise RuntimeError("conflicting pins")
            result[item["path"]] = item
        for child in value.values():
            collect(child, result)
    elif isinstance(value, list):
        for child in value:
            collect(child, result)


def main():
    plan = checked_json(CPP2 / "compile-plan.json", CPP2_PLAN_SHA)
    extra = checked_json(CPP2 / "runner-pins.json", CPP2_EXTRA_SHA)
    terminal_path = CPP2 / "execution/cpp2-corrected-preflight/terminal.json"
    checked_json(terminal_path, CPP2_TERMINAL_SHA)
    command = plan["commands"][1]
    python = Path(command["executable"])
    empp = Path(command["argv"][0])
    sdk = empp.parents[2]
    source = Path(plan["baseline"]["exactBaseFlagsPreserved"][
        plan["baseline"]["exactBaseFlagsPreserved"].index("-isystem") + 1]).parent
    staged = CPP2 / "sources/src"
    module = CPP2 / "objects/browser_input_snapshot.o"
    if digest(module) != MODULE_SHA:
        raise RuntimeError("actual compiled snapshot module changed")
    identity_arg = next(arg for arg in command["argv"]
                        if arg.startswith("-DCDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID="))
    identity = identity_arg.split("=", 1)[1]
    if not (identity.startswith('"') and identity.endswith('"')):
        raise RuntimeError("module build identity must remain a quoted literal")
    identity = identity[1:-1]
    (HERE / "module-build-id.txt").write_text(identity + "\n", encoding="utf-8")

    # Add only our path package to the previously accepted lock graph. No resolver.
    lock = (HERE.parent / "rust-snapshot-consumer/Cargo.lock").read_text(encoding="utf-8")
    entry = ('[[package]]\nname = "cdda-snapshot-native-fixture-consumer"\n'
             'version = "0.1.0"\ndependencies = [\n'
             ' "cdda-live-input-snapshot-consumer",\n]\n\n')
    lock = lock.replace('[[package]]\nname = "itoa"', entry + '[[package]]\nname = "itoa"', 1)
    (HERE / "rust-consumer/Cargo.lock").write_text(lock, encoding="utf-8")

    pins = {}
    collect(plan, pins)
    collect(extra, pins)
    inherited_count = len(pins)
    files = [module, terminal_path, CPP2 / "compile-verification.json",
             CPP2 / "compile-plan.json", CPP2 / "runner-pins.json",
             HERE / "fixture.cpp", HERE / "test-wasm.mjs", HERE / "module-build-id.txt",
             HERE / "rust-consumer/Cargo.toml", HERE / "rust-consumer/Cargo.lock",
             HERE / "rust-consumer/src/lib.rs", HERE / "prepare-plan.py",
             empp.parent / "src/settings.js", empp.parent / "tools/system_libs.py",
             empp.parent / "tools/building.py", empp.parent / "system/include/emscripten/heap.h",
             sdk / "upstream/bin/wasm-ld.exe", sdk / "upstream/bin/llvm-nm.exe"]
    consumer = HERE.parent / "rust-snapshot-consumer"
    files.extend([consumer / "Cargo.toml", consumer / "Cargo.lock"])
    files.extend(sorted((consumer / "src").glob("*.rs")))
    for file in files:
        record = pin(file)
        pins[record["path"]] = record

    build = HERE / "build"
    environment = dict(command["environment"])
    environment.update({"PYTHONDONTWRITEBYTECODE": "1", "PYTHONNOUSERSITE": "1"})
    exports = ["_cdda_browser_snapshot_pin", "_cdda_browser_snapshot_data",
               "_cdda_browser_snapshot_size", "_cdda_browser_snapshot_release",
               "_fixture_push", "_fixture_pop", "_fixture_clear", "_fixture_mutate_root",
               "_fixture_heap_bytes", "_fixture_grow_heap"]
    compile_args = ["-B", str(empp), "-v", "-std=c++17", "-Os", "-fexceptions",
                    "-fsigned-char", "-DEMSCRIPTEN", "-Wall", "-Wextra",
                    "-I" + str(staged), "-I" + str(source), "-MMD", "-MP",
                    "-MF", str(build / "fixture.d"), "-c", str(HERE / "fixture.cpp"),
                    "-o", str(build / "fixture.o")]
    # O0 link avoids a separate optimizer stage; the actual module remains its Os object.
    link_args = ["-B", str(empp), "-v", str(build / "fixture.o"), str(module),
                 "-O0", "-fexceptions", "--no-entry", "-Wl,--threads=1",
                 "-sDISABLE_EXCEPTION_CATCHING=0", "-sMODULARIZE=1", "-sEXPORT_ES6=1",
                 "-sENVIRONMENT=node", "-sINVOKE_RUN=0", "-sEXIT_RUNTIME=0",
                 "-sFILESYSTEM=0", "-sDYNAMIC_EXECUTION=0", "-sASSERTIONS=1",
                 "-sALLOW_MEMORY_GROWTH=1", "-sINITIAL_MEMORY=16777216",
                 "-sMAXIMUM_MEMORY=67108864", "-sSTACK_SIZE=1048576",
                 "-sEXPORTED_FUNCTIONS=" + json.dumps(exports, separators=(",", ":")),
                 '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]',
                 "-o", str(build / "snapshot-fixture.mjs")]
    node = sdk / "node/24.19.0_64bit/node.exe"
    common = {"cwd": str(HERE), "environment": environment, "timeoutSeconds": 180}
    commands = [
        {**common, "stage": "compile-synthetic-callback-fixture", "executable": str(python),
         "argv": compile_args, "outputs": [str(build / "fixture.o"), str(build / "fixture.d")]},
        {**common, "stage": "link-isolated-actual-snapshot-module", "executable": str(python),
         "argv": link_args, "outputs": [str(build / "snapshot-fixture.mjs"), str(build / "snapshot-fixture.wasm")]},
        {**common, "stage": "genuine-node-wasm-module-fixture", "executable": str(node),
         "argv": ["--max-old-space-size=128", "--unhandled-rejections=strict", str(HERE / "test-wasm.mjs")],
         "outputs": [str(HERE / "execution/wasm-results/verification.json")]},
    ]
    fixture_plan = {
        "schemaVersion": 1, "status": "source-prepared-no-fixture-compile-link-or-wasm-execution",
        "sourceCommit": plan["sourceCommit"], "moduleBuildIdentity": identity,
        "actualCompiledModule": pin(module), "moduleSource": plan["stagedFiles"][1],
        "cpp2Terminal": pin(terminal_path), "cpp2PlanSha256": CPP2_PLAN_SHA,
        "inheritedReviewedPins": inherited_count, "pins": [pins[key] for key in sorted(pins)],
        "frozenSDK": plan["frozenSDK"], "guard": plan["guard"],
        "requiredGuardImplementation": "Unchanged pinned presentation wrapper.load_guard + wrapper.run_owned; no direct historical run_stage or parser CLI",
        "resourcePolicy": {
            "freshAvailablePhysicalGiB": 4, "freshAvailableExactCommitGiB": 6,
            "browserPriorityAvailablePhysicalGiB": 7, "browserPriorityAvailableExactCommitGiB": 9,
            "hardOwnedJobPrivateGiB": 1, "sampledOwnedWorkingSetStopGiB": 1,
            "runningPhysicalFloorGiB": 2, "runningCommitFloorGiB": 2,
            "sampleIntervalMs": 250, "timeoutSecondsPerStage": 180, "jobs": 1,
            "commitMeasurement": "GetPerformanceInfo: (CommitLimit - CommitTotal) * PageSize",
            "physicalMeasurement": "GlobalMemoryStatusEx: ullAvailPhys",
            "ownership": "Unnamed Windows job; suspended root assigned before resume; exact returned process handle and creation identity; verified owned cleanup only",
            "unrelatedApplicationsOutsideOwnership": True,
            "stopAfterFailureNoFitOrUncertainCleanup": True,
            "compileLinkAndNodePeakUnmeasured": True,
        },
        "commands": commands, "requiredExports": exports,
        "pointObjectIncluded": False,
        "pointObjectPolicy": "Inline default constructors inspected. Do not add point.o unless actual link reports a concrete point undefined symbol; revise and review manifest first.",
        "cacheVariantReadiness": "Unmeasured; FROZEN_CACHE must fail if the minimal no-SDL exception library variant is absent; never regenerate or download",
        "inputAudit": "All byte pins before/after each stage and terminal; full cache/ports entry/type/mtime/mode/attributes metadata, regular-file sizes retained, only directory st_size normalized to null; reject reparse points",
        "artifactAudit": "Archive command, stdout/stderr, exact object/MMD/mjs/wasm/native JSON hashes, actual non-system MMD dependencies, resources and all job/root handles closed",
        "RustPreparedTests": 4, "RustExecuted": False,
        "fixtureCompileExecuted": False, "fixtureLinkExecuted": False, "WasmExecuted": False,
        "callbackContextsAreSynthetic": True, "originalInputContextRuntimeVerified": False,
        "originalActionContextsLookupVerified": False, "liveEngineIntegrated": False,
        "commandOwnershipVerified": False, "wholeGameVerified": False,
        "nextLaunchGate": "Separate root reservation plus independently reviewed thin guard invoker required; these argv are not permission to launch directly",
    }
    (HERE / "fixture-plan.json").write_text(json.dumps(fixture_plan, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": fixture_plan["status"], "pins": len(pins),
                      "inheritedPins": inherited_count, "stages": len(commands),
                      "planSha256": digest(HERE / "fixture-plan.json"),
                      "fixtureCppSha256": digest(HERE / "fixture.cpp"),
                      "testWasmSha256": digest(HERE / "test-wasm.mjs")}))


if __name__ == "__main__":
    main()
