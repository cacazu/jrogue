"""One reserved seven-test window; reuse the frozen, exercised handle owner."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import struct
import sys
import types

HERE = Path(__file__).resolve().parent
PLAN_PATH = HERE / "build-plan/consumer-build-plan.json"
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
    require(options.parent_released_window, "parent reservation required")
    require(re.fullmatch(r"[a-z0-9_-]{1,48}", options.attempt_name), "invalid attempt name")
    plan_bytes = PLAN_PATH.read_bytes()
    require(re.fullmatch(r"[a-f0-9]{64}", options.plan_sha256) and
            hashlib.sha256(plan_bytes).hexdigest() == options.plan_sha256,
            "reviewed plan bytes changed")
    plan = json.loads(plan_bytes)
    owner_path = Path(plan["owner"]["path"])
    owner_bytes = owner_path.read_bytes()
    require(hashlib.sha256(owner_bytes).hexdigest() == OWNER_SHA and
            plan["owner"]["sha256"] == OWNER_SHA, "exact handle owner changed")
    owner = types.ModuleType("cdda_parameter_private_handle_owner")
    owner.__file__ = str(owner_path)
    exec(compile(owner_bytes, str(owner_path), "exec", dont_inherit=True, optimize=0), owner.__dict__)
    require(plan["launchGate"]["minimumPhysicalFreeBytes"] == 4 * 1024**3 and
            plan["launchGate"]["minimumExactCommitHeadroomBytes"] == 6 * 1024**3,
            "launch thresholds changed")
    limits = plan["ownedResourceGuard"]
    require(limits["maximumOwnedTreePrivateBytes"] == 1024**3 and
            limits["maximumOwnedTreeWorkingSetBytes"] == 1024**3 and
            limits["minimumPhysicalFreeBytes"] == 2 * 1024**3 and
            limits["minimumExactCommitHeadroomBytes"] == 2 * 1024**3 and
            limits["maximumStageSeconds"] == 180, "owned limits changed")
    require(len(plan["commands"]) == 1, "exactly one reserved Cargo command required")
    command = plan["commands"][0]
    require(command["stage"] == "parameter-genuine-rust-consumer" and
            command["executable"] == plan["installedTools"]["cargo"]["path"] and
            not command.get("environment"), "unexpected command/override")
    argv = command["argv"]
    require(argv[:2] == ["test", "--lib"] and "--offline" in argv and "--locked" in argv and
            argv[argv.index("--jobs") + 1] == "1" and
            argv[-2:] == ["--", "--test-threads=1"], "bounded test argv changed")
    environment = plan["rustEnvironment"]
    require(environment["CARGO_BUILD_JOBS"] == "1" and environment["RUST_TEST_THREADS"] == "1" and
            environment["CARGO_NET_OFFLINE"] == "true", "bounded environment changed")
    require(environment["CARGO_HOME"] == plan["cachePolicy"]["existingCargoHome"], "cache root changed")
    expected = plan["expectedTests"]
    require(len(expected) == 7 and len(set(expected)) == 7, "exact seven tests required")
    protected = [*plan["inputs"], *plan["cachedPayloadPins"], *plan["cachedExtractionMarkerPins"]]
    owner.validate_pins(protected)
    owner.validate_pins(plan["installedTools"].values())
    owner.validate_pins([plan["owner"], plan["guard"], plan["originalGuardPlan"],
                         plan["dependencyAudit"], *plan["exercisedEvidence"]])
    for directory in plan["inspectedAncestorCargoConfigDirectories"]:
        require(not (Path(directory) / ".cargo/config").exists() and
                not (Path(directory) / ".cargo/config.toml").exists(), "new Cargo config appeared")
    cargo_home = Path(environment["CARGO_HOME"])
    require(not (cargo_home / "config").exists() and not (cargo_home / "config.toml").exists(),
            "new Cargo home config appeared")
    guard = owner.load_guard(plan)
    destination = Path(plan["outputs"]["executionDirectory"]) / options.attempt_name
    destination.mkdir(parents=True, exist_ok=False)
    def fingerprints():
        return {item["relative"]: owner.digest(item["path"]) for item in protected}
    before = fingerprints()
    (destination / "input-fingerprints-before.json").write_text(json.dumps(before, indent=2) + "\n", encoding="utf-8")
    terminal = {"parentWindowExplicitlyReleased": True, "planSha256": options.plan_sha256,
                "ownerSha256": OWNER_SHA, "originalProducerConnected": False,
                "browserExecuted": False, "runtimeConnected": False,
                "scope": "existing Catalog with synthetic source-leaf choices only"}
    failure = None
    try:
        result = owner.run_owned(guard, command, destination)
        stdout = (destination / (command["stage"] + ".stdout.log")).read_text(encoding="utf-8", errors="strict")
        actual = re.findall(r"^test (tests::[a-z_]+) \.\.\. ok$", stdout, flags=re.MULTILINE)
        require(sorted(actual) == sorted(expected), "exact seven test names did not pass")
        require(re.search(r"test result: ok\. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out;", stdout),
                "exact seven-test summary missing")
        terminal.update(status="passed", testsPassed=actual, testCount=7,
                        jobPeakPrivateBytes=result["jobPeakPrivateBytes"])
    except BaseException as error:
        failure = error
        terminal.update(status="failed-stopped-owned-stage", failure=repr(error))
    finally:
        try:
            after = fingerprints()
            unchanged = before == after
            terminal["inputFingerprintsUnchanged"] = unchanged
            (destination / "input-fingerprints-after.json").write_text(json.dumps(after, indent=2) + "\n", encoding="utf-8")
            require(unchanged, "protected source/lock/catalog/registry payload changed")
        except BaseException as error:
            failure = failure or error
            terminal.update(status="failed-stopped-owned-stage", fingerprintFailure=repr(error))
        (destination / "terminal.json").write_text(json.dumps(terminal, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(terminal), flush=True)
    if failure is not None:
        raise failure


if __name__ == "__main__":
    main()
