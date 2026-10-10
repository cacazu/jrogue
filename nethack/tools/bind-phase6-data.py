"""Added 2026-10-02, NGPL: bind an executed reader gate to its engine.

This creates evidence only after checking the actual files. It does not execute
or modify an engine, probe, archive, generator or existing report.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MACROS = {"UNIX": 1, "WIN32": 0, "MSDOS": 0, "_WIN32": 0,
          "DLBLIB": 1, "CROSS_TO_WASM": 1}
ENGINE_MACROS = {**MACROS, "CROSSCOMPILE": 1, "CROSSCOMPILE_TARGET": 1,
                 "__EMSCRIPTEN__": 1}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def scoped(name):
    path = (ROOT / name).resolve()
    require(path.is_relative_to(ROOT), "Evidence path escaped NetHack")
    return path


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(name):
    path = scoped(name)
    return path, json.loads(path.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--consumer-report", default="build/data-consumer-qa/phase6/verification.json")
    parser.add_argument("--output", default="build/phase6/data-consumer-binding.json")
    args = parser.parse_args()
    engine_path, engine = read("build/phase6/engine-manifest.json")
    generator_path, _ = read("build/phase6/target-data-manifest.json")
    consumer_path, consumer = read(args.consumer_report)
    output = scoped(args.output)
    require(not output.exists(), "Preserve existing evidence; choose a new binding output")
    require(consumer["status"] == "passed" and consumer["consumer_execution_proved"] is True
            and consumer["failed_assertion_count"] == 0, "Original consumer execution did not pass")
    require(consumer["source_evidence"] == "prepared.json", "Unexpected consumer source evidence")
    prepared_path = consumer_path.parent / "prepared.json"
    require(sha(prepared_path) == consumer["prepared_sha256"], "Consumer preparation changed")
    prepared = json.loads(prepared_path.read_text(encoding="utf-8"))
    require(prepared["source_phase"] == "phase6" and prepared["generated_data_lf_verified"] is True,
            "Consumer did not use certified Phase6 target outputs")
    require(prepared["candidate_manifest_sha256"] == sha(engine_path), "Candidate manifest differs")
    require(prepared["generator_manifest_sha256"] == sha(generator_path), "Generator manifest differs")
    require(prepared["official_commit"] == engine["commit"], "Official source pin differs")
    require(consumer["actual_target_macros"] == MACROS
            and engine["target_macros"] == ENGINE_MACROS,
            "Executed target macros differ")
    require(consumer["macro_evidence"]["matches_expected"] is True
            and consumer["macro_evidence"]["cr_normalization_compiled"] is False,
            "Original target reader configuration differs")
    archive = scoped("work/phase6/wasm-data/nhdat")
    archive_sha, archive_bytes = sha(archive), archive.stat().st_size
    embedded = engine["embedded_data"]
    entry = embedded["datafile_entry"]
    require(entry["name"] == "/nhdat", "Unexpected embedded data entry")
    require(consumer["archive_sha256"] == prepared["archive_sha256"]
            == embedded["archive"]["sha256"] == entry["actual_sha256"] == archive_sha,
            "Reader archive differs from the embedded payload")
    require(prepared["archive_bytes"] == embedded["archive"]["bytes"]
            == entry["expected_bytes"] == entry["actual_bytes"] == archive_bytes,
            "Reader and embedded byte counts differ")
    require(Path(prepared["actual_archive"]).resolve() == archive, "Consumer archive path differs")
    wasm = scoped("build/phase6/web/engine/nethack.wasm")
    wasm_sha = sha(wasm)
    require(engine["artifacts"]["nethack.wasm"]["sha256"]
            == embedded["emitted_wasm"]["sha256"] == wasm_sha,
            "Actual engine WASM differs from the recorded candidate")
    require(engine["isolated_phase6"]["target_data_manifest_sha256"] == sha(generator_path),
            "Engine generator binding differs")
    binding = {"status": "passed", "candidate_engine_wasm_sha256": wasm_sha,
        "engine_manifest_sha256": sha(engine_path), "archive_sha256": archive_sha,
        "consumer_report_sha256": sha(consumer_path),
        "generator_manifest_sha256": sha(generator_path),
        "datafile_expected_actual_bytes": archive_bytes}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(binding, indent=2) + "\n")
    print(json.dumps({"status": "passed", "binding_sha256": sha(output),
        "engine_wasm_sha256": wasm_sha, "archive_bytes": archive_bytes}))


if __name__ == "__main__":
    main()
