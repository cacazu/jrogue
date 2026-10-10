"""Parent-only companion writer for four actual isolated phase6 CLI proofs.

Source authoring runs nothing. This script never builds/tests/launches servers or
browsers, changes frozen216/default496 files, activates defaults or publishes.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

OWN = Path(__file__).resolve().parent
WORK = OWN.parent
SELECT = OWN / "runtime-selection.json"
CHUNK = 128 * 1024
COMMIT = "624a67329fe2ad440c5b344785a9c73fcf22ae63"


def relative(value):
    path = PurePosixPath(value.replace("\\", "/"))
    if path.is_absolute() or not path.parts or any(p in ("", ".", "..") or ":" in p for p in path.parts):
        raise ValueError("Unconfined relative path: " + value)
    return Path(*path.parts)


def digest(file):
    value, size = hashlib.sha256(), 0
    with file.open("rb") as stream:
        while chunk := stream.read(CHUNK):
            value.update(chunk); size += len(chunk)
    return {"bytes": size, "sha256": value.hexdigest()}


def same(a, b):
    return a["bytes"] == b["bytes"] and a["sha256"] == b["sha256"]


def json_data(file):
    if file.stat().st_size > 16 * 1024 * 1024:
        raise ValueError("Only bounded proof metadata is decoded")
    return json.loads(file.read_bytes().decode("utf-8"))


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def regular(file):
    if not file.is_file() or file.is_symlink() or file.is_junction():
        raise ValueError("Missing/unreviewed file: " + str(file))


def target_guard(port, phase):
    if phase.resolve() != port.resolve() / "experimental" / "phase6" or not phase.resolve().is_relative_to(port.resolve()):
        raise ValueError("Phase6 resolved outside its literal authorized destination")
    for folder in [port / "experimental", phase, phase / "validation", phase / "validation/local-cli"]:
        if folder.is_symlink() or folder.is_junction():
            raise ValueError("Companion output may not use symlinks or junctions")
    output = phase / "validation/local-cli"
    if output.resolve() != phase.resolve() / "validation/local-cli":
        raise ValueError("Companion target resolution changed")


def configured():
    selection = json_data(SELECT)
    tome = Path(selection["tome_root"]).resolve()
    if tome != Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome").resolve():
        raise ValueError("Unauthorized root")
    port, phase = tome / "port", tome / relative(selection["target_relative"])
    target_guard(port, phase)
    if selection["target_relative"] != "port/experimental/phase6" or selection["source_commit"] != COMMIT:
        raise ValueError("Only the exact local phase6 companion is supported")
    sources, targets = set(), set()
    for row in selection["files"]:
        relative(row["source"]); relative(row["target"])
        if row["source"] in sources or row["target"] in targets:
            raise ValueError("Duplicate companion selection")
        if not row["target"].startswith("validation/local-cli/"):
            raise ValueError("Companion copy escaped the additive validation directory")
        if Path(row["source"]).suffix.lower() in (".zip", ".team", ".teae", ".teag", ".teaw", ".bz2", ".wasm", ".o", ".a"):
            raise ValueError("Runtime companion never copies assets, saves, compiled code or objects")
        sources.add(row["source"]); targets.add(row["target"])
    return selection, tome, port, phase


def immutable_guard(selection, tome, port, phase):
    manifest_path, freeze_path = phase / "PHASE6-MANIFEST.json", phase / "APPROVED-FREEZE.json"
    regular(manifest_path); regular(freeze_path)
    if not same(digest(manifest_path), selection["immutable_manifest_identity"]) or not same(digest(freeze_path), selection["immutable_freeze_identity"]):
        raise ValueError("Frozen authoring manifest/freeze bytes changed")
    if digest(freeze_path)["sha256"] != selection["approved_freeze_sha256"]:
        raise ValueError("Approved freeze differs")
    manifest = json_data(manifest_path)
    if manifest["approved_freeze_sha256"] != selection["approved_freeze_sha256"] or manifest["complete"] is not False or manifest["full_renderer_ready"] is not False:
        raise ValueError("Incomplete immutable authoring scope differs")
    if manifest["portable_wrapper_and_rebased_vfs_runtime_verified"] is not False:
        raise ValueError("Authoring snapshot must retain its historical false runtime flag")
    if len(manifest["files"]) != selection["expected_frozen_file_count"]:
        raise ValueError("Expected unchanged216 frozen targets")
    frozen = {}
    for row in manifest["files"]:
        key = row["target"]; file = phase / relative(key); regular(file)
        if key in frozen or not file.resolve().is_relative_to(phase.resolve()):
            raise ValueError("Duplicate/unconfined frozen target")
        actual = digest(file)
        if not same(actual, row):
            raise ValueError("Frozen216 target changed: " + key)
        frozen[key] = actual
    default = manifest["shared_default_identity"]
    if len(default["files"]) != selection["expected_default_file_count"]:
        raise ValueError("Expected unchanged496 default targets")
    default_manifest = json_data(port / "STAGING-MANIFEST.json")
    if len(default_manifest["files"]) != selection["expected_default_file_count"]:
        raise ValueError("Default manifest count changed")
    for key, expected in default["files"].items():
        file = port / relative(key); regular(file)
        if not file.resolve().is_relative_to(port.resolve()) or not same(digest(file), expected):
            raise ValueError("Default496 target changed: " + key)
    for key, expected in default["metadata"].items():
        file = tome / relative(key); regular(file)
        if not same(digest(file), expected):
            raise ValueError("Default checkpoint/status metadata changed: " + key)
    return manifest, frozen


def checks(rows, label):
    if not isinstance(rows, list) or not rows or any(row.get("passed") is not True for row in rows):
        raise ValueError("Actual check group missing/failed: " + label)
    return len(rows)


def resource_result(file, expected_exit=0):
    report = json_data(file)
    expected = {"exit_code": expected_exit, "job_active_processes_at_finish": 0,
                "job_limit_terminated_processes": 0, "abort_reason": None, "other_games_affected": False}
    for key, value in expected.items():
        if key not in report or report[key] != value:
            raise ValueError("Measured owned job not closed as required: " + file.name + ": " + key)
    result = {key: report[key] for key in expected}
    for key in ["elapsed_seconds", "kernel_peak_job_committed_bytes", "sampled_peak_group_working_set_bytes",
                "job_total_assigned_processes", "executable_history_complete", "owned_descendant_cleanup", "command"]:
        result[key] = report.get(key)
    return report, result


def route_identity(route, profile, config, phase, port):
    if route.startswith("/vfs/"):
        manifest_file = phase / relative(config["manifest"])
        original = json_data(manifest_file)
        virtual = route[len("/vfs"):]
        rows = [row for row in original["inputs"] if row["virtual"] == virtual and row["type"] == "file"]
        if len(rows) != 1:
            raise ValueError("Served VFS proof requires an exact reviewed leaf: " + route)
        file = (manifest_file.parent / rows[0]["physical"]).resolve()
        if not file.is_relative_to(port.resolve()) and not file.is_relative_to(port.parent.resolve() / "upstream"):
            raise ValueError("Unreviewed VFS artifact source")
        location = {"namespace": "vfs", "virtual": virtual, "manifest": config["manifest"]}
    else:
        location = config["routes"].get(route)
        if location is None or location["namespace"] not in ("phase6", "port"):
            raise ValueError("Actual served artifact has no frozen route: " + route)
        root = phase if location["namespace"] == "phase6" else port
        file = root / relative(location["file"])
        if not file.resolve().is_relative_to(root.resolve()):
            raise ValueError("Resolved route escaped frozen source root")
    regular(file)
    return digest(file), location


def review_profile(row, selection, config, phase, port):
    profile = row["profile"]
    proof = json_data(WORK / relative(row["proof"]))
    if proof.get("passed") is not True or proof.get("exceptions") != []:
        raise ValueError("Actual CLI/browser proof failed: " + profile)
    runtime, scenario = proof["runtime"], proof["scenario"]
    if runtime.get("completed") is not True or runtime.get("passed") is not True or scenario.get("passed") is not True:
        raise ValueError("Actual runtime/scenario did not complete")
    groups = {"scenario": checks(scenario["checks"], profile)}
    if groups["scenario"] != row["expected_scenario_checks"]:
        raise ValueError("Actual explicit scenario check scope differs")
    if profile == "prepared":
        groups["runtime"] = checks(runtime["checks"], "prepared.runtime")
        if runtime.get("full_renderer_ready") is not False:
            raise ValueError("Prepared proof must retain incomplete renderer scope")
    if profile == "planar":
        groups["control"] = checks(scenario["control"]["checks"], "planar.control")
        groups["patched"] = checks(scenario["patched"]["checks"], "planar.patched")
    if sum(groups.values()) != row["expected_total_checks"]:
        raise ValueError("Counted-once actual proof check total differs")
    resource, result = resource_result(WORK / relative(row["resource"]))
    launch = json_data(WORK / relative(row["launch"]))
    reported = launch["reported"]
    actual_url, printed_url = urlsplit(proof["url"]), urlsplit(reported["url"])
    if actual_url.scheme != "http" or actual_url.hostname != "127.0.0.1" or reported["host"] != "127.0.0.1":
        raise ValueError("CLI proof is not exact localhost")
    if actual_url != printed_url or reported["profile"] != profile or reported["entry"] != config["entry"]:
        raise ValueError("Printed CLI origin/profile differs from actual browser proof")
    if actual_url.port != reported["port"] or reported["approvedFreezeSha"] != selection["approved_freeze_sha256"]:
        raise ValueError("Launch freeze/port mismatch")
    cli = phase / "portable/run-local.mjs"
    if launch["cli_sha256"] != digest(cli)["sha256"] or Path(launch["argv"][0]).resolve() != cli.resolve():
        raise ValueError("Actual CLI bytes/path differs from frozen staged CLI")
    expected_argv = [str(cli), "--profile", profile, "--port", "0", "--expected-freeze-sha256", selection["approved_freeze_sha256"]]
    if launch["argv"][1:] != expected_argv[1:] or Path(launch["cwd"]).resolve() != phase.resolve():
        raise ValueError("Actual staged CLI arguments/root differ")
    if launch["pid"] not in {process["pid"] for process in resource["observed_processes"]}:
        raise ValueError("Reported CLI process was not observed in this closed owned job")
    artifacts = {}
    for artifact in proof["served_artifacts"] + scenario.get("served_artifacts", []):
        if artifact.get("status", 200) != 200:
            raise ValueError("Actual served request failed")
        measured, location = route_identity(artifact["route"], profile, config, phase, port)
        if not same(measured, artifact):
            raise ValueError("Actual served bytes differ from immutable staged/shared source: " + artifact["route"])
        if artifact["route"] in artifacts and not same(artifacts[artifact["route"]], artifact):
            raise ValueError("Conflicting actual route identities")
        artifacts[artifact["route"]] = measured | {"location": location}
    return {"profile": profile, "passed": True, "counted_once_check_groups": groups,
            "total_checks": sum(groups.values()), "observed_label_count": len(scenario.get("actual_labels", [])),
            "historical_test_url": proof["url"], "active_server_url": None,
            "test_started_at": proof["started_at"], "test_completed_at": proof["completed_at"],
            "launch_at": launch["launched_at"], "reported_cli_pid": launch["pid"],
            "cli_sha256": launch["cli_sha256"], "approved_freeze_sha256": reported["approvedFreezeSha"],
            "recorded_owned_processes_at_finish": 0, "current_server_liveness_claim": False,
            "resource": result, "served_artifacts": artifacts,
            "evidence": "validation/local-cli/" + profile + "/evidence.json",
            "resource_evidence": "validation/local-cli/" + profile + "/resource.json",
            "launch_evidence": "validation/local-cli/" + profile + "/launch.json",
            "complete": False, "full_renderer_ready": False}


def failed_launch():
    resource_file = WORK / "phase6-staging-work/prepared-cli-resource.json"
    _, report = resource_result(resource_file, expected_exit=1)
    log = (WORK / "phase6-staging-work/prepared-cli.log").read_bytes().decode("utf-8")
    if "Actual shared CLI did not print its origin" not in log or "15000" not in log:
        raise ValueError("Expected recorded15-second launch deadline failure")
    if (WORK / "phase6-staging-work/prepared-cli-browser-probe/evidence.json").exists():
        raise ValueError("First failed launch unexpectedly has a browser proof; review required")
    return {"profile": "prepared", "passed": False, "kind": "Earlier facade readiness timeout before any generated browser evidence",
            "reported_origin_present": False, "browser_evidence_generated": False,
            "facade_deadline_ms": 15000, "successful_rerun_facade_deadline_ms": 60000,
            "earlier_failed_launch_has_origin_or_cli_hash_receipt": False,
            "successful_rerun_verified_against_immutable_approved_freeze": True,
            "resource": report, "log": "validation/local-cli/prepared-first-failed-launch/launch-failure.log",
            "resource_evidence": "validation/local-cli/prepared-first-failed-launch/resource.json"}


def run(selection_sha, check_only):
    regular(SELECT)
    if digest(SELECT)["sha256"] != selection_sha:
        raise ValueError("Root-reviewed runtime selection SHA differs")
    selection, tome, port, phase = configured()
    manifest, frozen = immutable_guard(selection, tome, port, phase)
    config = json_data(phase / "portable/profile-config.json")
    status_file = phase / "STATUS.json"; regular(status_file)
    status_before = digest(status_file); status = json_data(status_file)
    if status["approved_freeze_sha256"] != selection["approved_freeze_sha256"] or status["complete"] is not False or status["full_renderer_ready"] is not False:
        raise ValueError("Experimental status scope differs")
    reviewed = [review_profile(row, selection, config["profiles"][row["profile"]], phase, port) for row in selection["profiles"]]
    earlier = failed_launch()
    inputs = []
    for row in selection["files"]:
        source = WORK / relative(row["source"]); regular(source)
        if not source.resolve().is_relative_to(WORK.resolve()) or row["target"] in frozen:
            raise ValueError("Companion input/destination overlaps unreviewed/frozen source")
        inputs.append(row | digest(source))
    if check_only:
        return {"source_ready": True, "copied_files": 0, "planned_files": len(inputs),
                "total_checks": sum(row["total_checks"] for row in reviewed),
                "default496_and_frozen216_verified": True, "shared_written": False}
    target_guard(port, phase)
    output = phase / "validation/local-cli"
    runtime_file = phase / "RUNTIME-VALIDATION.json"
    temporary_status = phase / "STATUS.runtime-update.tmp"
    if runtime_file.exists() or temporary_status.exists() or output.exists() and any(output.iterdir()):
        raise ValueError("Companion destination occupied; no automatic overwrite/delete")
    immutable_guard(selection, tome, port, phase)
    if not same(digest(status_file), status_before):
        raise ValueError("Experimental status changed before the approved update")
    target_guard(port, phase)  # Repeat immediately before the first write.
    output.mkdir(parents=True, exist_ok=True)
    copied = []
    for row in inputs:
        source, destination = WORK / relative(row["source"]), phase / relative(row["target"])
        if not destination.resolve().is_relative_to(output.resolve()):
            raise ValueError("Resolved companion destination escaped")
        destination.parent.mkdir(parents=True, exist_ok=True)
        with source.open("rb") as src, destination.open("xb") as dst:
            while chunk := src.read(CHUNK):
                dst.write(chunk)
        actual = digest(destination)
        if not same(actual, row):
            raise ValueError("Companion stream copy differs from reviewed source")
        copied.append({"source": row["source"], "target": row["target"], "kind": row["kind"], **actual})
    immutable_guard(selection, tome, port, phase)
    for row in inputs:
        if not same(digest(WORK / relative(row["source"])), row):
            raise ValueError("Companion proof changed during copy")
    now = datetime.now(timezone.utc).isoformat()
    runtime_report = {"schema_version": 1, "recorded_at_utc": now, "source_commit": COMMIT,
                      "scope": "Four exact immutable phase6 localhost CLI profiles after actual browser execution",
                      "approved_freeze_sha256": selection["approved_freeze_sha256"],
                      "immutable_manifest_identity": selection["immutable_manifest_identity"],
                      "immutable_freeze_identity": selection["immutable_freeze_identity"],
                      "runtime_selection_identity": digest(SELECT), "companion_writer_identity": digest(Path(__file__)),
                      "profiles": reviewed, "counted_once_total_checks": sum(row["total_checks"] for row in reviewed),
                      "earlier_failed_launch_retained": earlier, "copied_files": copied,
                      "default496_and_frozen216_verified_before_and_after": True,
                      "authoring_manifest_runtime_flag_remains_false": True,
                      "portable_wrapper_and_rebased_vfs_runtime_verified": True,
                      "active_server_url": None, "current_server_liveness_claim": False,
                      "complete": False, "full_renderer_ready": False, "default_activation": False,
                      "external_sites_requested": False, "external_site_created_or_published": False}
    with runtime_file.open("xb") as out:
        out.write(json_bytes(runtime_report))
    if not same(digest(status_file), status_before):
        raise ValueError("Experimental status changed before atomic replacement")
    status.update({"runtime_validation_at_utc": now,
                   "runtime_validation": {"file": "RUNTIME-VALIDATION.json", **digest(runtime_file),
                                          "profiles": {row["profile"]: row["total_checks"] for row in reviewed}},
                   "portable_wrapper_and_rebased_vfs_runtime_verified": True,
                   "default496_and_frozen216_preserved": True,
                   "historical_test_urls": {row["profile"]: row["historical_test_url"] for row in reviewed},
                   "active_server_url": None, "current_server_liveness_claim": False,
                   "complete": False, "full_renderer_ready": False, "default_activation": False})
    pending = "The portable overlay factory and rebased VFS require their own measured browser rerun."
    status["outstanding"] = [text for text in status["outstanding"] if text != pending]
    with temporary_status.open("xb") as out:
        out.write(json_bytes(status))
    target_guard(port, phase)
    os.replace(temporary_status, status_file)
    immutable_guard(selection, tome, port, phase)
    return {"runtime_validation": str(runtime_file), **digest(runtime_file), "copied_files": len(copied),
            "profiles": {row["profile"]: row["total_checks"] for row in reviewed},
            "recorded_owned_processes_at_finish": 0, "default496_and_frozen216_preserved": True,
            "active_server_url": None, "complete": False, "full_renderer_ready": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reviewed-selection-sha256", required=True)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(args.reviewed_selection_sha256, args.check_only)))


if __name__ == "__main__":
    main()
