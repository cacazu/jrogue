"""Bind actual phase-three Cargo results and measured resources to frozen sources.

Added 2026-10-02; NGPL. Does not run a compiler or carry old runtime passes forward.
"""
import argparse
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def net_hack_path(value):
    """Resolve CLI relative paths from nethack/, preserving existing defaults."""
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option, default in (
        ("checkpoint", "rust/source-checkpoint-phase3.json"),
        ("resource", "build/rust-phase3-test-resource.json"),
        ("log", "build/rust-phase3-test.log"),
        ("output", "build/rust-phase3-test-verification.json"),
    ):
        parser.add_argument(
            f"--{option}", default=default,
            help=f"Path relative to nethack/ or absolute (default: {default})",
        )
    parser.add_argument("--expected-tests", type=int, default=49)
    args = parser.parse_args()
    if args.expected_tests <= 0:
        parser.error("--expected-tests must be positive")

    checkpoint_path = net_hack_path(args.checkpoint)
    checkpoint = json.loads(checkpoint_path.read_text("utf-8"))
    for item in checkpoint["sourceFiles"]:
        source = ROOT / "rust" / item["path"]
        if sha(source) != item["sha256"]:
            raise SystemExit(f"Test source changed from reviewed checkpoint: {source}")
    catalog_path = ROOT / "locales/gameplay-core.json"
    if sha(catalog_path) != checkpoint["frozenGameplayCatalog"]["sha256"]:
        raise SystemExit("Gameplay catalog differs from the tested source checkpoint")
    resource_path = net_hack_path(args.resource)
    resource = json.loads(resource_path.read_text("utf-8"))
    log_path = net_hack_path(args.log)
    log = log_path.read_text("utf-8")
    expected = args.expected_tests
    result = re.search(
        rf"test result: ok\. ({expected}) passed; (0) failed; (0) ignored; "
        r"(0) measured; (0) filtered out", log,
    )
    if resource["exit_code"] != 0 or not result or f"running {expected} tests" not in log:
        raise SystemExit(
            f"Actual Cargo log/resource report does not prove all {expected} tests passed"
        )
    report = {
        "schema_version": 1, "status": "native_rust_phase3_tests_passed",
        "recorded_at_utc": resource["recorded_at_utc"], "tests_passed": expected,
        "failed": 0, "ignored": 0, "filtered_out": 0,
        "command": resource["command"], "source_checkpoint_sha256": sha(checkpoint_path),
        "gameplay_catalog_sha256": sha(catalog_path), "test_log_sha256": sha(log_path),
        "resource_report_sha256": sha(resource_path),
        "duration_seconds": resource["duration_seconds"],
        "kernel_accounted_job_peak_commit_bytes": resource["kernel_accounted_job_peak_commit_bytes"],
        "sampled_process_tree_peak_working_set_bytes": resource["sampled_process_tree_peak_working_set_bytes"],
        "full_engine_linkage_verified": False, "native_c_semantic_association_verified": False,
        "browser_japanese_gameplay_verified": False, "full_japanese_coverage": False,
        "qualification": "Actual native Rust tests include the frozen 3026-pair catalog; engine/browser tests are separate",
    }
    output_path = net_hack_path(args.output)
    output_path.write_text(json.dumps(report, indent=2) + "\n", "utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
