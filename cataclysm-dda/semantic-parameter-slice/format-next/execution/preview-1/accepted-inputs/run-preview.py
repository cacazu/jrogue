"""Preview the exact root-level future command on two owned copies only."""
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
FUTURE_PATH = HERE.parent / "FORMAT-CLIPPY-NEXT.json"
OWNER_SHA = "0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8,
            "unoptimized 64-bit Windows Python required")
    parser = argparse.ArgumentParser()
    parser.add_argument("--parent-released-window", action="store_true", required=True)
    parser.add_argument("--plan-sha256", required=True)
    parser.add_argument("--attempt-name", required=True)
    options = parser.parse_args()
    require(options.parent_released_window, "explicit parent reservation required")
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name), "invalid fresh attempt name")
    plan_bytes = PLAN_PATH.read_bytes()
    require(re.fullmatch(r"[a-f0-9]{64}", options.plan_sha256) and
            hashlib.sha256(plan_bytes).hexdigest() == options.plan_sha256, "reviewed preview plan changed")
    plan = json.loads(plan_bytes)
    future_bytes = FUTURE_PATH.read_bytes()
    require(hashlib.sha256(future_bytes).hexdigest() == plan["futurePlan"]["sha256"],
            "root-level future plan changed")
    future = json.loads(future_bytes)
    owner_path = Path(plan["owner"]["path"])
    owner_bytes = owner_path.read_bytes()
    require(hashlib.sha256(owner_bytes).hexdigest() == OWNER_SHA and
            plan["owner"]["sha256"] == OWNER_SHA, "exact fixed owner changed")
    core = types.ModuleType("cdda_parameter_preview_private_owner")
    core.__file__ = str(owner_path)
    exec(compile(owner_bytes, str(owner_path), "exec", dont_inherit=True, optimize=0), core.__dict__)
    require(plan["launchGate"]["minimumPhysicalFreeBytes"] == 4 * 1024**3 and
            plan["launchGate"]["minimumExactCommitHeadroomBytes"] == 6 * 1024**3, "fresh4/6 gate required")
    limits = plan["ownedResourceGuard"]
    require(limits["maximumOwnedTreePrivateBytes"] == 1024**3 and
            limits["maximumOwnedTreeWorkingSetBytes"] == 1024**3 and
            limits["minimumPhysicalFreeBytes"] == 2 * 1024**3 and
            limits["minimumExactCommitHeadroomBytes"] == 2 * 1024**3 and
            limits["maximumStageSeconds"] == 180, "owned limits changed")
    require(plan["rustEnvironment"]["RAYON_NUM_THREADS"] == "1", "single formatter worker required")
    commands = [item for item in future["commands"] if item["stage"] == "parameter-rustfmt-workcopy-preview"]
    require(len(commands) == 1 and commands[0] == plan["command"], "exact unique future preview command required")
    command = dict(commands[0])
    require(not command.get("environment") and command["executable"] == plan["installedTools"]["rustfmt"]["path"],
            "only pinned rustfmt with inherited bounded environment allowed")
    work = HERE / "workcopy"
    require(command["cwd"] == str(work) and command["argv"] ==
            ["--edition", "2024", "--config-path", str(HERE / "rustfmt.toml"),
             "--config", "skip_children=true", str(work / "src/lib.rs"), str(work / "src/tests.rs")],
            "workcopy-only argument boundary changed")
    require([item["name"] for item in plan["sourceFiles"]] == ["lib.rs", "tests.rs"],
            "exact two original owned sources required")
    require(not plan["originalsMayChange"] and
            all(Path(item["path"]) == HERE.parent / "rust-verification/src" / item["name"]
                for item in plan["sourceFiles"]), "actual source boundary changed")
    core.validate_pins([*plan["inputs"], *plan["installedTools"].values(), plan["owner"],
                        plan["guard"], plan["originalGuardPlan"], *plan["exercisedEvidence"]])
    destination = HERE / "execution" / options.attempt_name
    destination.mkdir(parents=True, exist_ok=False)
    archived = destination / "before"
    archived.mkdir()
    # A fresh fixed workcopy is deliberate: retries cannot reuse candidates.
    work.mkdir(exist_ok=False)
    (work / "src").mkdir()
    def snapshot():
        return {item["path"]: core.digest(item["path"]) for item in plan["inputs"]}
    before = snapshot()
    for item in plan["sourceFiles"]:
        source = Path(item["path"]).read_bytes()
        require(hashlib.sha256(source).hexdigest() == item["sha256"], "original Rust source changed")
        (archived / item["name"]).write_bytes(source)
        (work / "src" / item["name"]).write_bytes(source)
    (destination / "input-fingerprints-before.json").write_text(json.dumps(before, indent=2) + "\n", encoding="utf-8")
    terminal = {"parentWindowExplicitlyReleased": True, "planSha256": options.plan_sha256,
                "futurePlanSha256": plan["futurePlan"]["sha256"], "ownerSha256": OWNER_SHA,
                "actualRustSourcesEdited": False, "compilerLaunched": False, "browserExecuted": False,
                "candidates": [], "copybackAuthorized": False}
    failure = None
    try:
        guard = core.load_guard(plan)
        result = core.run_owned(guard, command, destination)
        require(sorted(str(item.relative_to(work)) for item in work.rglob("*") if item.is_file()) ==
                [str(Path("src/lib.rs")), str(Path("src/tests.rs"))], "unexpected workcopy file output")
        require(all(not item.is_symlink() for item in work.rglob("*")), "unexpected workcopy symlink")
        patch = []
        for item in plan["sourceFiles"]:
            original = (archived / item["name"]).read_bytes()
            require(hashlib.sha256(original).hexdigest() == item["sha256"], "archived before bytes changed")
            candidate = (work / "src" / item["name"]).read_bytes()
            patch.extend(difflib.unified_diff(original.decode("utf-8").splitlines(keepends=True),
                         candidate.decode("utf-8").splitlines(keepends=True),
                         fromfile="a/rust-verification/src/" + item["name"],
                         tofile="b/rust-verification/src/" + item["name"]))
            terminal["candidates"].append({"name": item["name"], "beforeSha256": item["sha256"],
                                            "afterSha256": hashlib.sha256(candidate).hexdigest(),
                                            "bytes": len(candidate), "path": str(work / "src" / item["name"])})
        (destination / "format-preview.patch").write_text("".join(patch), encoding="utf-8", newline="")
        terminal["logs"] = []
        for suffix in [".stdout.log", ".stderr.log"]:
            log = destination / (command["stage"] + suffix)
            contents = log.read_bytes()
            terminal["logs"].append({"path": str(log), "bytes": len(contents),
                                     "sha256": hashlib.sha256(contents).hexdigest()})
        terminal.update(status="preview-ready-for-parent-diff-and-log-review",
                        jobPeakPrivateBytes=result["jobPeakPrivateBytes"])
    except BaseException as error:
        failure = error
        terminal.update(status="failed-stopped-owned-preview", failure=repr(error))
    finally:
        try:
            after = snapshot()
            terminal["actualInputFingerprintsUnchanged"] = before == after
            (destination / "input-fingerprints-after.json").write_text(json.dumps(after, indent=2) + "\n", encoding="utf-8")
            require(before == after, "protected actual source/proof/cache changed at final audit")
        except BaseException as error:
            failure = failure or error
            terminal.update(status="failed-stopped-owned-preview", fingerprintFailure=repr(error))
        (destination / "terminal.json").write_text(json.dumps(terminal, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(terminal), flush=True)
    if failure is not None:
        raise failure


if __name__ == "__main__":
    main()
