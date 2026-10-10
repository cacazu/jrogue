"""Pin optional package-only formatting/lint commands without running any tool."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
PLAN_PATH = HERE / "rust-consumer-plan.json"
PLAN_SHA = "3f0e4c50fd2cdce787420caffd86f5895df3fc39e51e60466ec95b5102d15422"


def pin(path):
    path = Path(path).resolve()
    state = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": state.hexdigest()}


data = PLAN_PATH.read_bytes()
assert hashlib.sha256(data).hexdigest() == PLAN_SHA
plan = json.loads(data)
command = plan["commands"][0]
cargo = Path(command["executable"])
manifest = str(HERE.parent / "rust-consumer/Cargo.toml")
package = "cdda-snapshot-native-fixture-consumer"
tools = [cargo, cargo.parent / "rustfmt.exe", cargo.parent / "cargo-clippy.exe", cargo.parent / "clippy-driver.exe"]
result = {"schemaVersion": 1, "status": "separate-source-only-package-tool-readiness-not-executed",
          "testPlanSha256": PLAN_SHA, "tools": [pin(path) for path in tools],
          "sourcePins": [item for item in plan["inputs"] if item["path"] in [manifest, str(HERE.parent / "rust-consumer/src/lib.rs")]],
          "commands": [
              {"purpose": "package-only-check-no-write", "executable": str(cargo),
               "argv": ["fmt", "--manifest-path", manifest, "--package", package, "--", "--check"]},
              {"purpose": "package-only-clippy-no-dependency-lints", "executable": str(cargo),
               "argv": ["clippy", "--offline", "--locked", "--jobs", "1", "--manifest-path", manifest,
                        "--package", package, "--target", "x86_64-pc-windows-gnu", "--target-dir", str(HERE / "target"),
                        "--lib", "--tests", "--no-deps", "--", "-D", "warnings"]}],
          "environment": command["environment"], "launchGate": plan["launchGate"],
          "ownedResourceGuard": plan["ownedResourceGuard"],
          "currentFourTestPlanExpanded": False, "FormattingValidated": False,
          "CargoExecuted": False, "RustfmtExecuted": False, "ClippyExecuted": False,
          "policy": "Separate optional future reservation/owner review required. Source changes after a formatting preview invalidate current test-plan pins and require refreshed review; no formatting mutation or automatic execution here."}
destination = HERE / "package-tool-readiness.json"
destination.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"readiness": pin(destination), "fourTestPlanExpanded": False, "toolsExecuted": False}))
