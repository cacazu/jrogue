"""Read-only source/plan checks; writes only its own evidence JSON, never spawns."""
from pathlib import Path
import hashlib
import json
import tomllib

HERE = Path(__file__).resolve().parent
PLAN_SHA = "047c6aa89403d5be6bc69b8ee2b743b296089c6e1460341ebe5f137a284b759b"


def digest(path):
    state = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return state.hexdigest()


def main():
    data = (HERE / "fixture-plan.json").read_bytes()
    assert hashlib.sha256(data).hexdigest() == PLAN_SHA
    plan = json.loads(data)
    checks = []

    def check(name, condition):
        assert condition, name
        checks.append({"name": name, "passed": True})

    check("fixed manifest preserves reviewed source identity", plan["sourceCommit"] ==
          "7b2efa5cea38e4d4d97dd0e63b28b9148623da59")
    check("exact inherited and supplemental pin counts", len(plan["pins"]) == 232 and
          plan["inheritedReviewedPins"] == 207)
    for item in plan["pins"]:
        path = Path(item["path"])
        assert path.stat().st_size == item["bytes"] and digest(path) == item["sha256"], str(path)
    check("all 232 byte pins remain unchanged", True)
    commands = plan["commands"]
    check("exact three-stage held scope", [item["stage"] for item in commands] == [
        "compile-synthetic-callback-fixture", "link-isolated-actual-snapshot-module",
        "genuine-node-wasm-module-fixture"])
    objects = [arg for arg in commands[1]["argv"] if arg.endswith(".o")]
    check("only synthetic harness and actual snapshot objects are linked", objects == [
        str(HERE / "build/fixture.o"), plan["actualCompiledModule"]["path"]] and
        not plan["pointObjectIncluded"])
    check("no-entry O0 link preserves bounded nonshared heap and exception catches",
          all(flag in commands[1]["argv"] for flag in ["--no-entry", "-O0",
              "-sMAXIMUM_MEMORY=67108864", "-sINITIAL_MEMORY=16777216",
              "-sALLOW_MEMORY_GROWTH=1", "-sDISABLE_EXCEPTION_CATCHING=0"])
          and not any("ASYNCIFY" in flag or "PTHREAD" in flag for flag in commands[1]["argv"]))
    resource = plan["resourcePolicy"]
    check("parent/browser gates and exact bounded resource policy retained",
          [resource[key] for key in ["freshAvailablePhysicalGiB", "freshAvailableExactCommitGiB",
           "browserPriorityAvailablePhysicalGiB", "browserPriorityAvailableExactCommitGiB",
           "hardOwnedJobPrivateGiB", "sampledOwnedWorkingSetStopGiB",
           "runningPhysicalFloorGiB", "runningCommitFloorGiB", "sampleIntervalMs",
           "timeoutSecondsPerStage", "jobs"]] == [4, 6, 7, 9, 1, 1, 2, 2, 250, 180, 1])
    check("frozen single-worker environment is exact", all(command["environment"]["EMCC_CORES"] == "1"
          and command["environment"]["BINARYEN_CORES"] == "1" for command in commands) and
          "FROZEN_CACHE = True" in Path(plan["frozenSDK"]["config"]["path"]).read_text())
    fixture = (HERE / "fixture.cpp").read_text(encoding="utf-8")
    host = (HERE / "test-wasm.mjs").read_text(encoding="utf-8")
    rust = (HERE / "rust-consumer/src/lib.rs").read_text(encoding="utf-8")
    check("Japanese source text is strict UTF-8 with intended codepoints", all(
          "\u5c71\u7530" in text and "\u7de8\u96c6\u4e2d" in text and "\ufffd" not in text
          for text in [fixture, host, rust]))
    check("exception fixtures require actual injected-function invocations", all(
          item in host for item in ["assert.equal(callbackCalls, 1)", "assert.equal(callbackCalls, 2)",
              "assert.equal(schedulingCalls, 1)", "assert.equal(schedulingCalls, 2)",
              "assert.equal(loggingCalls, 1)", "assert.equal(loggingCalls, 2)"]))
    original_lock = tomllib.loads((HERE.parent / "rust-snapshot-consumer/Cargo.lock").read_text())
    prepared_lock = tomllib.loads((HERE / "rust-consumer/Cargo.lock").read_text())
    extra = [package for package in prepared_lock["package"] if
             package["name"] == "cdda-snapshot-native-fixture-consumer"]
    rest = [package for package in prepared_lock["package"] if package not in extra]
    check("prepared Cargo lock reuses exact accepted dependency graph", rest == original_lock["package"]
          and extra == [{"name": "cdda-snapshot-native-fixture-consumer", "version": "0.1.0",
                         "dependencies": ["cdda-live-input-snapshot-consumer"]}])
    check("four prepared Rust tests fail without genuine native fixture bytes", rust.count("#[test]") == 4
          and 'fs::read(path).expect("actual WASM native fixture output required")' in rust
          and "CommandAuthorization::Denied(DenialReason::UntrackedNativeReaders)" in rust)
    check("no native execution artifacts or fixture proof exist", not (HERE / "build").exists()
          and not (HERE / "execution").exists())
    check("runtime/ownership/full-game gates remain false", all(plan[key] is False for key in [
          "fixtureCompileExecuted", "fixtureLinkExecuted", "WasmExecuted", "RustExecuted",
          "originalInputContextRuntimeVerified", "originalActionContextsLookupVerified",
          "liveEngineIntegrated", "commandOwnershipVerified", "wholeGameVerified"]))
    result = {"schemaVersion": 1, "status": "source-manifest-validated-native-execution-pending",
              "planSha256": PLAN_SHA, "validatorSha256": digest(__file__),
              "sourceChecks": len(checks), "checks": checks, "bytePinsVerified": 232,
              "fixtureCompilerExecuted": False, "fixtureLinkExecuted": False,
              "WasmExecuted": False, "RustExecuted": False,
              "sourceChecksAreNotRuntimeTests": True}
    (HERE / "source-validation.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "sourceChecks": len(checks),
                      "pins": 232, "sourceValidationSha256": digest(HERE / "source-validation.json")}))


if __name__ == "__main__":
    main()
