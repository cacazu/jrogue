"""Run only an explicitly reserved sequential formatted-source verification."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import struct
import sys
import types

HERE = Path(__file__).resolve().parent
PLAN_PATH = HERE / "verification-plan.json"
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
            hashlib.sha256(plan_bytes).hexdigest() == options.plan_sha256,
            "exact reviewed plan bytes changed")
    plan = json.loads(plan_bytes)
    owner_path = Path(plan["owner"]["path"])
    owner_bytes = owner_path.read_bytes()
    require(hashlib.sha256(owner_bytes).hexdigest() == OWNER_SHA and
            plan["owner"]["sha256"] == OWNER_SHA, "exact fixed owner changed")
    core = types.ModuleType("cdda_parameter_formatted_private_owner")
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
    environment = plan["rustEnvironment"]
    require(environment["CARGO_NET_OFFLINE"] == "true" and
            environment["CARGO_BUILD_JOBS"] == "1" and environment["RUST_TEST_THREADS"] == "1",
            "bounded Rust environment changed")
    commands = plan["commands"]
    require([item["stage"] for item in commands] ==
            ["parameter-format-check", "parameter-seven-tests-formatted", "parameter-clippy-check"],
            "exact sequential three stages required")
    crate = HERE.parent / "rust-verification"
    manifest, target = str(crate / "Cargo.toml"), str(crate / "target")
    config = str(HERE / "rustfmt.toml")
    common = ["--offline", "--locked", "--jobs", "1", "--manifest-path", manifest,
              "--target", "x86_64-pc-windows-gnu", "--target-dir", target]
    expected = [
        ["fmt", "--manifest-path", manifest, "--package", "cdda-source-parameter-slice-verification",
         "--", "--check", "--config-path", config],
        ["test", "--lib", "--verbose", *common, "--", "--test-threads=1"],
        ["clippy", *common, "--lib", "--tests", "--", "-D", "warnings"],
    ]
    for command, argv in zip(commands, expected):
        require(command["executable"] == plan["installedTools"]["cargo"]["path"] and
                command["argv"] == argv and command["cwd"] == str(crate) and
                not command.get("environment"), "exact owned-package argv/cwd/override boundary changed")
    require(len(plan["expectedTests"]) == 7 and len(set(plan["expectedTests"])) == 7,
            "exact seven test names required")
    core.validate_pins([*plan["inputs"], *plan["installedTools"].values(), plan["owner"],
                        plan["guard"], plan["originalGuardPlan"], *plan["exercisedEvidence"]])
    for directory in plan["inspectedAncestorCargoConfigDirectories"]:
        require(not (Path(directory) / ".cargo/config").exists() and
                not (Path(directory) / ".cargo/config.toml").exists(), "new ancestor Cargo config appeared")
    cargo_home = Path(environment["CARGO_HOME"])
    require(not (cargo_home / "config").exists() and not (cargo_home / "config.toml").exists(),
            "new Cargo home config appeared")
    destination = HERE / "verification-execution" / options.attempt_name
    destination.mkdir(parents=True, exist_ok=False)
    def snapshot():
        return {item["path"]: core.digest(item["path"]) for item in plan["inputs"]}
    before = snapshot()
    (destination / "input-fingerprints-before.json").write_text(json.dumps(before, indent=2) + "\n", encoding="utf-8")
    terminal = {"parentWindowExplicitlyReleased": True, "planSha256": options.plan_sha256,
                "ownerSha256": OWNER_SHA, "sourceCommit": plan["sourceCommit"],
                "scope": "formatted owned adapter; actual existing Catalog with synthetic leaf choices",
                "originalProducerConnected": False, "runtimeConnected": False,
                "browserExecuted": False, "stages": []}
    failure = None
    try:
        guard = core.load_guard(plan)
        for command in commands:
            core.validate_pins(plan["inputs"])
            stage_directory = destination / command["stage"]
            stage_directory.mkdir()
            result = core.run_owned(guard, command, stage_directory)
            entry = {"stage": command["stage"], "status": "passed",
                     "jobPeakPrivateBytes": result["jobPeakPrivateBytes"]}
            if command["stage"] == "parameter-seven-tests-formatted":
                stdout = (stage_directory / (command["stage"] + ".stdout.log")).read_text(encoding="utf-8", errors="strict")
                actual = re.findall(r"^test (tests::[a-z_]+) \.\.\. ok$", stdout, flags=re.MULTILINE)
                require(sorted(actual) == sorted(plan["expectedTests"]), "exact seven tests did not pass")
                require(re.search(r"test result: ok\. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out;", stdout),
                        "exact seven-test summary missing")
                entry.update(testsPassed=actual, testCount=7)
            require(snapshot() == before, "protected input changed after owned stage")
            terminal["stages"].append(entry)
        terminal["status"] = "passed-three-formatted-source-checks"
    except BaseException as error:
        failure = error
        terminal.update(status="failed-stopped-owned-stage", failure=repr(error))
    finally:
        try:
            after = snapshot()
            terminal["inputFingerprintsUnchanged"] = before == after
            (destination / "input-fingerprints-after.json").write_text(json.dumps(after, indent=2) + "\n", encoding="utf-8")
            require(before == after, "protected source/cache/proof changed at final audit")
        except BaseException as error:
            failure = failure or error
            terminal.update(status="failed-stopped-owned-stage", fingerprintFailure=repr(error))
        (destination / "terminal.json").write_text(json.dumps(terminal, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(terminal), flush=True)
    if failure is not None:
        raise failure


if __name__ == "__main__":
    main()
