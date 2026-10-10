"""Preserve accepted source plan; describe the actual unchanged fixed runner."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
OLD_SHA = "64944ad062935850e922d241ab3b4bfc8215b6cca03f3a5cd95af1914c38063c"
source = HERE / "compile-plan.json"
old_bytes = source.read_bytes()
if hashlib.sha256(old_bytes).hexdigest() != OLD_SHA:
    raise RuntimeError("run this correction only once on exact accepted source plan")
archive = HERE / "compile-plan.accepted-source-preparation.json"
with archive.open("xb") as output:
    output.write(old_bytes)
plan = json.loads(old_bytes)
plan["acceptedSourcePreparation"] = {"path": str(archive), "bytes": len(old_bytes), "sha256": OLD_SHA,
    "correctionScope": "Guard metadata only; commands, sources, dependencies, SDK selection and resource thresholds unchanged"}
gate = plan["launchGate"]
gate["counters"] = ["GlobalMemoryStatusEx.ullAvailPhys",
    "GetPerformanceInfo.(CommitLimit - CommitTotal) * PageSize"]
gate.pop("unrelatedChromeOrOtherHeavyJobMustBeAbsentOrParentConfirmedFinished")
gate["soleOwnedHeavySlotParentConfirmed"] = True
gate["unrelatedForegroundApplicationsRemainOutsideOwnership"] = True
guard = plan["ownedResourceGuard"]
guard["sampleIntervalMilliseconds"] = 250
guard["ownership"] = "Fresh unnamed Windows job: exact Popen root handle created suspended, PID/creation FILETIME recorded, assigned before resume; descendants inherit job membership. Fixed outer cleanup owns only returned job/process handles, including setup/query failures."
guard["failurePolicy"] = "Fixed run_owned outer finally stops/closes only this owned job or an exact returned unassigned suspended-root handle on resource breach, monitor/setup failure, timeout or command failure; no process-name/PID-tree cleanup, no unrelated application stops."
plan["guard"]["reviewStatus"] = "Fixed wrapper source hash reviewed by parent; new CPP2 adapter runner needs independent source review before its separately reserved execution window"
source.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"archivedAcceptedSourcePlanSha256": OLD_SHA,
    "currentCompilePlanSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "compilerExecuted": False}))
