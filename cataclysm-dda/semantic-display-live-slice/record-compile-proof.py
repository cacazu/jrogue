"""Audit immutable original raw six-stage evidence; never rerun any stage."""
from pathlib import Path
import hashlib
import json
import re

HERE=Path(__file__).resolve().parent
ATTEMPT=HERE / "execution/semantic-help-compile-initial"
PLAN_SHA="d9023bbce0f8a4b567c71fb630e0db8b3af29ca3a37c19122e7757c32cbf1379"
OWNER_SHA="84c5690d8cee425d7767871b54b73af19f8ec2223c9540bb9a1d292da1773496"
GIB=1024**3

def pin(path):
    path=Path(path);b=path.read_bytes()
    return {"path":str(path.resolve()),"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest()}

def require(value,message):
    if not value:raise RuntimeError(message)

terminal=json.loads((ATTEMPT / "terminal.json").read_bytes())
require(terminal["status"]=="six-translation-units-compile-only-passed","six stages not passed")
require(terminal["planSha256"]==PLAN_SHA and terminal["runnerSha256"]==OWNER_SHA,"accepted identity")
require(all(terminal[k] is True for k in ["protectedPinnedBytesUnchanged","frozenMetadataUnchanged","sourceTreeUnchanged","ownedJobsClosedAndRootsWaited"]),"final integrity/ownership")
require(all(terminal[k] is False for k in ["originalProducerExecuted","RustExecuted","linkExecuted","browserExecuted","wholeGameAccepted"]),"scope")
for left,right in [("pins-before.json","pins-after.json"),("frozen-metadata-before.json","frozen-metadata-after.json"),("source-tree-before.json","source-tree-after.json")]:
    require(json.loads((ATTEMPT / left).read_bytes())==json.loads((ATTEMPT / right).read_bytes()),"raw typed integrity audit "+left)
before=json.loads((ATTEMPT / "pins-before.json").read_bytes())
require(len(before)==1210,"protected file count")
for path,row in before.items():require(pin(path)==row,"current input differs from actual before "+path)
accepted_plan=pin(ATTEMPT / "accepted-plan.json")
require(accepted_plan["sha256"]==PLAN_SHA and pin(ATTEMPT / "accepted-owner.py")["sha256"]==OWNER_SHA,"actual executed byte copies")
rows=[];identities={};artifacts=[];warnings=[]
for stage in terminal["stages"]:
    name=stage["stage"]
    raw=json.loads((ATTEMPT / (name+".json")).read_bytes())
    cleanup=json.loads((ATTEMPT / (name+".outer-cleanup.json")).read_bytes())
    require(raw["passed"] and raw["exitCode"]==0 and not raw["remainingOwnedPidsBeforeJobClose"],"stage execution/remaining pid")
    require(cleanup["passed"] and not cleanup["remainingOwnedJobHandles"] and not cleanup["errors"],"actual owned cleanup")
    require(len(cleanup["rootsCreated"])==1 and len(cleanup["jobsCreated"])==1,"one exact root/job per stage")
    handle=cleanup["rootsCreated"][0]["processHandle"]
    require(any(x.get("processHandle")==handle and x["action"]=="close-owned-process-handle" for x in cleanup["outerActions"]),"returned root process handle not closed")
    root=raw["rootIdentity"]
    require(root in raw["identities"] and root["pid"]==cleanup["rootsCreated"][0]["pid"],"actual root identity")
    for identity in raw["identities"]:
        require(type(identity["creationFiletime"]) is int,"exact raw FILETIME must remain integer")
        key=(identity["pid"],identity["creationFiletime"])
        identities[key]={"pid":identity["pid"],"creation_filetime_decimal":str(identity["creationFiletime"])}
    require(raw["jobPeakPrivateBytes"]<=GIB,"actual kernel private cap")
    for sample in raw["samples"]:
        require(sample["ownedWorkingSetBytes"]<=GIB and sample["physicalFreeBytes"]>=2*GIB and sample["exactCommitHeadroomBytes"]>=2*GIB,"actual sampled caps/floors")
    for output in stage["outputs"]:
        current=pin(output["path"]);copy=pin(output["archive"]["path"])
        require(current=={k:output[k] for k in ["path","bytes","sha256"]} and copy==output["archive"],"actual output/archive byte pin")
        require(current["sha256"]==copy["sha256"],"actual output copy mismatch")
        artifacts.append({"role":output["role"],**current,"archive":copy})
    text=(ATTEMPT / (name+".stderr.log")).read_text(encoding="utf-8")
    warning_lines=[x for x in text.splitlines() if "warning:" in x]
    require(all("enum_traits.h:" in x and "unused function template 'operator" in x for x in warning_lines),"unexpected warning")
    warnings.append({"stage":name,"warnings":warning_lines})
    rows.append({"stage":name,"duration_seconds":raw["durationSeconds"],"job_peak_private_bytes":raw["jobPeakPrivateBytes"],
                 "maximum_sampled_working_set_bytes":max(x["ownedWorkingSetBytes"] for x in raw["samples"]),
                 "minimum_sampled_physical_free_bytes":min(x["physicalFreeBytes"] for x in raw["samples"]),
                 "minimum_sampled_exact_commit_bytes":min(x["exactCommitHeadroomBytes"] for x in raw["samples"]),
                 "actual_non_system_dependencies":len(stage["actualNonSystemDependencies"]),
                 "root_identity":{"pid":root["pid"],"creation_filetime_decimal":str(root["creationFiletime"]),"closed_process_handle":handle},
                 "closed_job_handles":cleanup["jobsCreated"],"remaining_owned_pids":[],"remaining_owned_job_handles":[],"cleanup_errors":[],"passed":True})
require(len(rows)==6,"exact six rows")
raw_pins=[pin(p) for p in sorted(ATTEMPT.rglob('*')) if p.is_file() and "temporary" not in p.relative_to(ATTEMPT).parts]
result={"schema_version":1,"status":"six_original_and_helper_translation_units_compile_only_passed","source_commit":"7b2efa5cea38e4d4d97dd0e63b28b9148623da59",
        "accepted_plan_sha256":PLAN_SHA,"executed_owner_sha256":OWNER_SHA,"protected_files":1210,"protected_bytes_unchanged":True,
        "frozen_cache_ports_metadata_unchanged":True,"coherent_source_metadata_membership_unchanged":True,
        "duration_stage_sum_seconds":round(sum(x["duration_seconds"] for x in rows),3),
        "maximum_kernel_job_private_bytes":max(x["job_peak_private_bytes"] for x in rows),
        "maximum_sampled_working_set_bytes":max(x["maximum_sampled_working_set_bytes"] for x in rows),
        "minimum_sampled_physical_free_bytes":min(x["minimum_sampled_physical_free_bytes"] for x in rows),
        "minimum_sampled_exact_commit_bytes":min(x["minimum_sampled_exact_commit_bytes"] for x in rows),
        "stages":rows,"all_exact_jobs_and_process_handles_closed":True,"unique_exact_process_identities":list(identities.values()),
        "actual_outputs":artifacts,"raw_evidence_pins":raw_pins,"existing_native_warnings":warnings,
        "original_producer_executed":False,"synthetic_transport_fixture_executed":False,"rust_help_consumer_executed":False,
        "full_engine_relinked":False,"real_browser_verified":False,"whole_game_complete":False,
        "full_relink_requires_existing_header_dependent_units":231,
        "next":"Strict actual original loader fixture link/execute with real JSON/translation/paths; no fake producer implementations or unresolved-symbol suppression. Separate source review and single resource reservation are required."}
(HERE / "COMPILE-VERIFICATION.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"status":result["status"],"protected":1210,"unique_identities":len(identities),"raw_artifacts":len(raw_pins),"peak_private_bytes":result["maximum_kernel_job_private_bytes"],"all_exact_jobs_closed":True}),flush=True)
