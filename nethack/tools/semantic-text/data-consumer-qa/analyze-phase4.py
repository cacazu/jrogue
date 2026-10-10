#!/usr/bin/env python3
"""Read frozen actual Phase4 consumer evidence and classify every failure."""
import importlib.util
import json
from pathlib import Path

own = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("consumer_qa", own / "prepare.py")
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
run = qa.BUILD / "phase4"
actual = json.loads((run / "verification.json").read_text("utf-8"))
prepared = json.loads((run / "prepared.json").read_text("utf-8"))
source_checks = json.loads((qa.BUILD / "source-checks.json").read_text("utf-8"))
rows = [line.split("\t") for line in (run / "consumer.log").read_text("utf-8").splitlines()]
random = {(row[1], int(row[2])): row[3:] for row in rows if row[0] == "RANDOM_RESULT"}
classification = []
for name, section in prepared["random_sections"].items():
    observation = next(v for v in actual["random_observations"] if v["section"] == name)
    cr_explained = []
    retry_explained = []
    for row in section["rows"]:
        values = random[name, row["index"]]
        emitted = bytes.fromhex(values[4])
        if row["index"] in observation["plaintext_mismatch_indices"]:
            # Diagnosis only: source bytes, original test, and archive are
            # immutable.  This does not normalize any generated asset.
            if emitted.endswith(b"\r") and emitted[:-1].rstrip(b"_").hex() == row["clean_hex"]:
                cr_explained.append(row["index"])
        if row["index"] in observation["lf_selection_rng_mismatch_indices"]:
            if int(values[1]) == 10 and row["clean_rng_calls"] == 1:
                retry_explained.append(row["index"])
    classification.append({"asset_section": name, "tested_records": section["count"],
                           "plaintext_failures": len(observation["plaintext_mismatch_indices"]),
                           "trailing_cr_and_unremoved_padding_explain": len(cr_explained),
                           "selection_retry_differences": len(observation["lf_selection_rng_mismatch_indices"]),
                           "original_ten_retry_vs_lf_one_retry_explain": len(retry_explained)})
classified = sum(v["plaintext_failures"] + v["selection_retry_differences"] for v in classification)
oracle_failures = len([f for f in actual["failures"] if "indexed paragraph delimiter" in f])
classified += oracle_failures
all_explained = classified == actual["failed_assertion_count"] and all(
    v["plaintext_failures"] == v["trailing_cr_and_unremoved_padding_explain"] and
    v["selection_retry_differences"] == v["original_ten_retry_vs_lf_one_retry_explain"]
    for v in classification)
independent_checks_pass = all(item["passed"] for item in actual["assertions"] if
                              "plaintext and underscore" not in item["label"] and
                              "LF selection RNG call count" not in item["label"] and
                              "indexed paragraph delimiter" not in item["label"])
report = {
    "status": "confirmed-target-data-generation-defect" if all_explained and independent_checks_pass else "requires-investigation",
    "source_only_analysis": True, "new_compiler_preprocessor_node_runs": 0,
    "actual_assertions": actual["assertion_count"], "actual_failures": actual["failed_assertion_count"],
    "actual_target_macros": actual["actual_target_macros"],
    "actual_cr_normalization_compiled": actual["macro_evidence"]["cr_normalization_compiled"],
    "oracle_delimiter_failures": oracle_failures,
    "oracle_first": actual["oracle_observations"][0],
    "random_failure_classification": classification,
    "all_failures_explained_by_original_crlf_consumers": all_explained,
    "headers_offsets_selected_ranges_and_oracle_state_assertions_pass": independent_checks_pass,
    "original_function_and_phase4_reader_source_checks": source_checks["status"],
    "source_assertion_count": source_checks["assertion_count"],
    "root_cause": [
        "Native Windows makedefs emitted CRLF assets packaged unchanged for a UNIX/WASM reader.",
        "Target preprocessing excludes original MSDOS/WIN32 CR normalization.",
        "Original outoracle compares exactly ---\\n; stored ---\\r\\n is emitted and scanning continues to EOF.",
        "Original get_rnd_line strips LF only; residual CR prevents original unpadline from reaching trailing underscores.",
        "At 24 deliberately selected prior-line starts, added CR changes the original padlength+1 test from one to ten selection calls."
    ],
    "limits": [
        "The isolated probe executes exact official consumers and actual packaged bytes, not a full game campaign.",
        "Its deterministic callback observes original selection calls without linking or mutating any live gameplay RNG.",
        "All six generated text assets are CRLF; this small runtime gate covers oracles and five random sections, while encyclopedia reader parity still needs its own gate."
    ],
    "verification_sha256": qa.sha((run / "verification.json").read_bytes()),
    "prepared_sha256": qa.sha((run / "prepared.json").read_bytes()),
    "consumer_log_sha256": qa.sha((run / "consumer.log").read_bytes()),
    "macro_evidence_sha256": qa.sha((run / "macro-evidence.json").read_bytes()),
    "analyzer_sha256": qa.sha(Path(__file__).read_bytes()),
}
qa.write_json(qa.BUILD / "phase4-analysis.json", report)
print(json.dumps({k: report[k] for k in ("status", "actual_assertions", "actual_failures", "oracle_delimiter_failures", "all_failures_explained_by_original_crlf_consumers")}))
raise SystemExit(0 if report["status"] == "confirmed-target-data-generation-defect" else 1)
