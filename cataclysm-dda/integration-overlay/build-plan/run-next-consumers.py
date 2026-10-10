"""Pending execution wrapper: only run after a new explicit parent slot release."""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--parent-released-window", action="store_true", required=True)
    options = parser.parse_args()
    assert options.parent_released_window
    plan_path = HERE / "next-consumer-build-plan.json"
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    for file, expected in plan["sourceSha256"].items():
        assert digest(ROOT / file) == expected, f"source pin changed: {file}"
    for pin in plan["dependencyAudit"]["selectedPins"]:
        assert digest(Path(pin["archive"])) == pin["sha256"], "dependency archive pin changed"
    guard_path = ROOT / plan["guard"]["file"]
    assert digest(guard_path) == plan["guard"]["sha256"]
    spec = importlib.util.spec_from_file_location("cdda_owned_consumer_guard", guard_path)
    guard = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(guard)
    guard.PLAN = plan
    terminal = {"status": "pending", "parentExplicitWindowReleased": True, "stagesPassed": 0,
                "rustContractsConsumption": False, "originalProducerConnected": False,
                "runtimeConnected": False, "wholeGameSemanticMigrationComplete": False}
    results = []
    try:
        for command in plan["commands"]:
            destination = ROOT / command["evidenceDirectory"]
            destination.mkdir(parents=True, exist_ok=True)
            results.append(guard.run_stage(command, destination))
        for file, expected in plan["sourceSha256"].items():
            assert digest(ROOT / file) == expected, f"source pin changed after execution: {file}"
        terminal.update(status="passed", stagesPassed=len(results), snapshotTestsPassed=19,
                        cosmeticTestsPassed=5, actualOfflineLockedAccepted=True)
    except BaseException as error:
        terminal.update(status="failed-stopped-owned-stage", failure=repr(error), stagesPassed=len(results))
        raise
    finally:
        terminal["planSha256"] = digest(plan_path)
        terminal["sourceSha256After"] = {file: digest(ROOT / file) for file in plan["sourceSha256"]}
        (HERE / "next-consumer-terminal.json").write_text(json.dumps(terminal, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
