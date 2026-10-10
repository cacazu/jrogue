"""Exactly one reviewed Node counter probe inside the unchanged exercised owner."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import struct
import sys
import types

HERE = Path(__file__).resolve().parent
OWNER_SHA = "0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb"
GUARD_SHA = "ae54cce5dbbe2e769d52572528f750b0573ef37fb172cc29db8ab8fa8208a8c3"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    require(__debug__ and sys.platform == "win32" and struct.calcsize("P") == 8,
            "unoptimized 64-bit Windows Python required")
    parser = argparse.ArgumentParser()
    parser.add_argument("--parent-released-window", action="store_true", required=True)
    parser.add_argument("--plan-sha256", required=True)
    parser.add_argument("--invoker-sha256", required=True)
    options = parser.parse_args()
    require(options.parent_released_window, "explicit parent slot required")
    source = Path(__file__).read_bytes()
    require(re.fullmatch(r"[a-f0-9]{64}", options.invoker_sha256) and
            hashlib.sha256(source).hexdigest() == options.invoker_sha256, "reviewed invoker changed")
    plan_bytes = (HERE / "owned-plan-2.json").read_bytes()
    require(re.fullmatch(r"[a-f0-9]{64}", options.plan_sha256) and
            hashlib.sha256(plan_bytes).hexdigest() == options.plan_sha256, "reviewed plan changed")
    plan = json.loads(plan_bytes)
    owner_path = Path(plan["owner"]["path"])
    owner_bytes = owner_path.read_bytes()
    require(hashlib.sha256(owner_bytes).hexdigest() == OWNER_SHA and
            plan["owner"]["sha256"] == OWNER_SHA and plan["guard"]["sha256"] == GUARD_SHA,
            "frozen exact owner/helper changed")
    owner = types.ModuleType("cdda_counter_probe_private_exact_owner")
    owner.__file__ = str(owner_path)
    exec(compile(owner_bytes, str(owner_path), "exec", dont_inherit=True, optimize=0), owner.__dict__)
    require(plan["launchGate"] == {"minimumPhysicalFreeBytes": 4 * 1024**3,
            "minimumExactCommitHeadroomBytes": 6 * 1024**3}, "fresh launch gate changed")
    require(plan["ownedResourceGuard"] == {"maximumOwnedTreePrivateBytes": 1024**3,
            "maximumOwnedTreeWorkingSetBytes": 1024**3, "minimumPhysicalFreeBytes": 2 * 1024**3,
            "minimumExactCommitHeadroomBytes": 2 * 1024**3, "maximumStageSeconds": 180}, "owner limits changed")
    require(len(plan["commands"]) == 1, "one exact Node probe command required")
    command = plan["commands"][0]
    powershell = Path(plan["installedTools"]["powershell"]["path"]).resolve()
    transient_path = str(powershell.parent)
    require(command == {"stage": "guard-counter-node-child", "executable": plan["installedTools"]["node"]["path"],
            "argv": [str(HERE / "run.mjs")], "cwd": str(HERE.parent.parent),
            "environment": {"CDDA_GUARD_PROBE_SLOT": "parent-reviewed-counter-probe", "PATH": transient_path}}, "probe command changed")
    require(plan["rustEnvironment"] == {} and plan["removeInheritedEnvironment"] == ["NODE_OPTIONS", "NODE_PATH"],
            "only transient known Node overrides permitted")
    expected = {"resource-guard-v2.ps1", "owned-identities.ps1", "verify-teardown-v2.ps1", "memory.ps1",
                "guard-counter-probe/run.mjs", "guard-counter-probe/owned-node.mjs"}
    require({item["relative"] for item in plan["inputs"]} == expected, "exact six inner sources required")
    owner.validate_pins([*plan["inputs"], *plan["installedTools"].values(), plan["owner"],
                         plan["guard"], plan["originalGuardPlan"], plan["invoker"]])
    require(Path(plan["installedTools"]["python"]["path"]).resolve() == Path(sys.executable).resolve(),
            "exact reviewed Python required")
    # No shell: close executable selection for inner bare powershell.exe without changing its frozen source.
    windows = powershell.parents[3]
    search_directories = [Path(command["cwd"]), Path(command["executable"]).parent,
                          windows / "System32", windows / "SysWOW64", windows / "System", windows, powershell.parent]
    for directory in search_directories:
        candidate = directory / "powershell.exe"
        require(not candidate.exists() or candidate.resolve() == powershell,
                "competing powershell.exe in executable search directory: " + str(candidate))
    resolved = shutil.which("powershell.exe", path=transient_path)
    require(resolved and Path(resolved).resolve() == powershell, "fixed transient PowerShell resolution failed")
    guard = owner.load_guard(plan)
    destination = HERE / "owned-output" / "counter-probe-1"
    destination.mkdir(parents=True, exist_ok=False)
    before = {item["relative"]: owner.digest(item["path"]) for item in plan["inputs"]}
    terminal = {"startedAtScope": "single reviewed actual counter prerequisite only", "planSha256": options.plan_sha256,
                "invokerSha256": options.invoker_sha256, "ownerSha256": OWNER_SHA, "chromeStarted": False,
                "browserCandidateConsumed": False, "actualProbeReport": None,
                "powerShellResolution": {"pathOverride": transient_path, "resolved": str(Path(resolved).resolve()),
                                         "competingSearchDirectoryExecutablesAbsent": True}}
    failure = None
    try:
        result = owner.run_owned(guard, command, destination)
        lines = (destination / "guard-counter-node-child.stdout.log").read_text(encoding="utf-8").splitlines()
        reports = []
        for line in lines:
            try:
                value = json.loads(line)
                if value.get("status") == "passed-real-counter-and-exact-identity-probe":
                    reports.append(value)
            except (json.JSONDecodeError, AttributeError):
                pass
        require(len(reports) == 1, "exact one inner counter/identity pass missing")
        inner = Path(reports[0]["output"]).resolve()
        require(inner.is_relative_to((HERE / "output").resolve()), "inner evidence outside owned path")
        report_bytes = (inner / "report.json").read_bytes()
        report = json.loads(report_bytes)
        require(report["status"] == "passed-real-counter-and-exact-identity-probe" and report["assertions"] == 11 and
                report["teardown"]["allRecordedOwnedProcessesExited"] and report["guardExitCode"] == 0,
                "inner exact identity/private/teardown proof incomplete")
        terminal.update(status="passed-real-counter-probe-with-kernel-owner", actualProbeReport=str(inner / "report.json"),
                        actualProbeReportSha256=hashlib.sha256(report_bytes).hexdigest(),
                        jobPeakPrivateBytes=result["jobPeakPrivateBytes"], durationSeconds=result["durationSeconds"])
    except BaseException as error:
        failure = error
        terminal.update(status="failed-stopped-owned-probe", error=repr(error))
    finally:
        after = {item["relative"]: owner.digest(item["path"]) for item in plan["inputs"]}
        terminal["sixInnerSourceFingerprintsUnchanged"] = before == after
        cleanup_path = destination / "guard-counter-node-child.outer-cleanup.json"
        if cleanup_path.exists():
            cleanup = json.loads(cleanup_path.read_text(encoding="utf-8"))
            terminal["outerCleanup"] = cleanup
            terminal["probeRootActuallyLaunched"] = bool(cleanup["rootsCreated"])
        (destination / "terminal.json").write_text(json.dumps(terminal, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(terminal), flush=True)
    require(before == after, "frozen inner source changed")
    if failure is not None:
        raise failure


if __name__ == "__main__":
    main()
