"""Preview standard rustfmt on two owned copies; never edit actual Rust sources."""
from pathlib import Path
import argparse
import difflib
import hashlib
import json
import re
import struct
import sys
import types

HERE = Path(__file__).resolve().parent
PLAN_PATH = HERE / "preview-plan.json"
CORE_SHA256 = "0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def load_core(plan):
    file = Path(plan["ownedCleanup"]["path"])
    source = file.read_bytes()
    require(hashlib.sha256(source).hexdigest() == CORE_SHA256, "reviewed owned cleanup bytes changed")
    module = types.ModuleType("cdda_format_preview_private_owner")
    module.__file__ = str(file)
    exec(compile(source, str(file), "exec", dont_inherit=True, optimize=0), module.__dict__)
    return module


def snapshot(plan, core):
    return {record["path"]: core.digest(record["path"]) for record in plan["inputs"]}


def main():
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8,
            "preview requires nonoptimized 64-bit Windows Python")
    parser = argparse.ArgumentParser()
    parser.add_argument("--parent-released-window", action="store_true", required=True)
    parser.add_argument("--plan-sha256", required=True)
    parser.add_argument("--attempt-name", required=True)
    options = parser.parse_args()
    require(options.parent_released_window, "explicit parent reservation required")
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name) is not None, "invalid fresh attempt name")
    plan_bytes = PLAN_PATH.read_bytes()
    require(re.fullmatch(r"[a-f0-9]{64}", options.plan_sha256) is not None and
            hashlib.sha256(plan_bytes).hexdigest() == options.plan_sha256, "reviewed preview plan hash mismatch")
    plan = json.loads(plan_bytes)
    require(plan["ownedCleanup"]["sha256"] == CORE_SHA256, "owned cleanup plan pin mismatch")
    require(not plan["originalsMayChange"] and [item["name"] for item in plan["sourceFiles"]] == ["lib.rs", "tests.rs"],
            "preview source boundary changed")
    require(plan["launchGate"]["minimumPhysicalFreeBytes"] == 4 * 1024**3 and
            plan["launchGate"]["minimumExactCommitHeadroomBytes"] == 6 * 1024**3, "fresh 4/6 gate required")
    limits = plan["ownedResourceGuard"]
    require(limits["maximumOwnedTreePrivateBytes"] == 1024**3 and
            limits["maximumOwnedTreeWorkingSetBytes"] == 1024**3 and
            limits["minimumPhysicalFreeBytes"] == 2 * 1024**3 and
            limits["minimumExactCommitHeadroomBytes"] == 2 * 1024**3 and limits["maximumStageSeconds"] == 180,
            "owned caps/floors/timeout changed")
    require(plan["rustEnvironment"]["CARGO_BUILD_JOBS"] == "1" and
            plan["rustEnvironment"]["RUST_TEST_THREADS"] == "1" and
            plan["rustEnvironment"]["CARGO_NET_OFFLINE"] == "true", "bounded environment changed")
    require(plan["command"]["executable"] == plan["installedTools"]["rustfmt"]["path"], "pinned rustfmt required")
    expected_arguments = ["--edition", "2021", "--config-path", plan["config"]["path"],
                          "--emit", "files", "{work_lib}", "{work_tests}"]
    require(plan["command"]["argvTemplate"] == expected_arguments, "rustfmt argument boundary changed")
    core = load_core(plan)
    core.validate_pins([*plan["inputs"], *plan["installedTools"].values(), plan["guard"],
                        plan["originalGuardPlan"], plan["originalParserPlan"], *plan["exercisedEvidence"]])
    destination = Path(plan["executionDirectory"]) / options.attempt_name
    destination.mkdir(parents=True, exist_ok=False)
    work, archived = destination / "work", destination / "before"
    work.mkdir()
    archived.mkdir()
    before = snapshot(plan, core)
    for record in plan["sourceFiles"]:
        source = Path(record["path"]).read_bytes()
        require(hashlib.sha256(source).hexdigest() == record["sha256"], "actual Rust source changed")
        (archived / record["name"]).write_bytes(source)
        (work / record["name"]).write_bytes(source)
    command = {"stage": plan["command"]["stage"], "executable": plan["command"]["executable"],
               "argv": [str(work / "lib.rs") if arg == "{work_lib}" else
                        str(work / "tests.rs") if arg == "{work_tests}" else arg for arg in expected_arguments],
               "cwd": str(work)}
    terminal = {"planSha256": options.plan_sha256, "parentWindowExplicitlyReleased": True,
                "originalCppCompiled": False, "actualRustSourcesEdited": False,
                "compilerLaunched": False, "browserExecuted": False, "candidates": []}
    (destination / "input-fingerprints-before.json").write_text(json.dumps(before, indent=2) + "\n", encoding="utf-8")
    try:
        guard = core.load_guard(plan)
        result = core.run_owned(guard, command, destination)
        require(sorted(item.name for item in work.iterdir()) == ["lib.rs", "tests.rs"], "unexpected workcopy output")
        patch = []
        for record in plan["sourceFiles"]:
            original = (archived / record["name"]).read_bytes()
            formatted = (work / record["name"]).read_bytes()
            patch.extend(difflib.unified_diff(original.decode("utf-8").splitlines(keepends=True),
                         formatted.decode("utf-8").splitlines(keepends=True),
                         fromfile="a/rust/src/" + record["name"], tofile="b/rust/src/" + record["name"]))
            terminal["candidates"].append({"name": record["name"], "beforeSha256": hashlib.sha256(original).hexdigest(),
                                            "afterSha256": hashlib.sha256(formatted).hexdigest(), "bytes": len(formatted)})
        (destination / "format-preview.patch").write_text("".join(patch), encoding="utf-8", newline="")
        require(snapshot(plan, core) == before, "actual source/fixture/protected input changed during preview")
        terminal.update(status="preview-ready-for-parent-diff-review", jobPeakPrivateBytes=result["jobPeakPrivateBytes"])
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-preview", failure=repr(error))
        raise
    finally:
        try:
            after = snapshot(plan, core)
            terminal["actualInputFingerprintsUnchanged"] = before == after
            (destination / "input-fingerprints-after.json").write_text(json.dumps(after, indent=2) + "\n", encoding="utf-8")
            require(before == after, "actual input changed at final preserved-input check")
        except BaseException as error:
            terminal.update(status="failed-stopped-owned-preview", fingerprintFailure=repr(error))
        (destination / "terminal.json").write_text(json.dumps(terminal, indent=2) + "\n", encoding="utf-8")
    require(terminal["status"] == "preview-ready-for-parent-diff-review", "preview did not satisfy preserved-input checks")
    print(json.dumps(terminal), flush=True)


if __name__ == "__main__":
    main()
