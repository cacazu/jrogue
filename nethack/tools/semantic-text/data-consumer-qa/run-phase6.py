#!/usr/bin/env python3
"""Gate regenerated target data with the frozen original consumer probe.

Default mode performs source/hash/physical-offset checks only.  --run belongs
to the parent's sole monitored compiler/Node slot.  Phase4 evidence is read
only and is never overwritten.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("frozen_data_consumer_qa", HERE / "prepare.py")
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

GENERATOR_SOURCES = ("util/makedefs.c", "src/monst.c", "src/objects.c", "src/date.c",
                     "src/alloc.c", "src/hacklib.c", "util/panic.c")
GENERATOR_INPUTS = ("dat/data.base", "dat/rumors.tru", "dat/rumors.fal", "dat/oracles.txt",
                    "dat/epitaph.txt", "dat/engrave.txt", "dat/bogusmon.txt")


def encyclopedia_index(data):
    lines = data.splitlines(keepends=True)
    base = int(lines[1], 16)
    position = len(lines[0]) + len(lines[1])
    entries, names, sentinel = [], 0, False
    for line in lines[2:]:
        position += len(line)
        if line.rstrip(b"\r\n") == b".":
            sentinel = True
            continue
        match = re.fullmatch(rb"(\d+),(\d+)\r?\n", line)
        if match:
            offset, count = map(int, match.groups())
            if sentinel:
                if count or position != base or base + offset != len(data):
                    raise ValueError("Encyclopedia index/text/EOF boundaries invalid")
                break
            entries.append({"offset": offset, "line_count": count})
        else:
            if sentinel:
                raise ValueError("Missing encyclopedia EOF index")
            names += 1
    else:
        raise ValueError("Missing encyclopedia sentinel")
    prior_end = base
    for entry in entries:
        start = base + entry["offset"]
        if start != prior_end:
            raise ValueError("Encyclopedia text records are not contiguous indexed bytes")
        chunks = data[start:].split(b"\n", entry["line_count"])
        if len(chunks) != entry["line_count"] + 1:
            raise ValueError("Encyclopedia declared line count exceeds EOF")
        end = start + sum(len(v) + 1 for v in chunks[:-1])
        entry.update(start=start, end=end)
        prior_end = end
    if prior_end != len(data):
        raise ValueError("Encyclopedia text counts do not cover original body bytes")
    return {"text_start": base, "eof": len(data), "index_name_rows": names,
            "entry_count": len(entries), "entries": entries,
            "reader_runtime_verified": False}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run", action="store_true")
    p.add_argument("--run-name", default="phase6")
    p.add_argument("--source-root", type=Path, default=qa.ROOT / "work/phase6/NetHack-5.0.0")
    p.add_argument("--data-dir", type=Path, default=qa.ROOT / "work/phase6/wasm-data")
    p.add_argument("--generator-manifest", type=Path, default=qa.ROOT / "build/phase6/target-data-manifest.json")
    p.add_argument("--sdk", type=Path, default=Path(r"C:\Users\kit\emsdk"))
    p.add_argument("--node", type=Path, default=Path(r"C:\Program Files\nodejs\node.exe"))
    a = p.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", a.run_name) or a.run_name == "phase4":
        p.error("Use a fresh owned run name; Phase4 evidence remains immutable")
    for value in (a.source_root, a.data_dir, a.generator_manifest):
        if not value.resolve().is_relative_to(qa.ROOT.resolve()):
            p.error("Every read target must be inside authorized nethack staging")
    qa.WORKING = a.source_root.resolve()
    target_flags = qa.target_flags()
    generator = json.loads(a.generator_manifest.read_text("utf-8"))
    if generator.get("generator") != "original target-WASM makedefs" or generator.get("source_only") is not False:
        raise ValueError("Require executed original target-WASM generator evidence")
    if generator.get("target_flags") != target_flags or generator.get("options") != "-drhs123v":
        raise ValueError("Generator target flags/options mismatch")
    source_hashes = {n: qa.sha((qa.OFFICIAL / n).read_bytes()) for n in GENERATOR_SOURCES}
    if generator.get("original_sources") != source_hashes:
        raise ValueError("Require hashes of all seven exact original generator C sources")
    input_hashes = {}
    for name in GENERATOR_INPUTS:
        original = (qa.OFFICIAL / name).read_bytes()
        if (qa.WORKING / name).read_bytes() != original:
            raise ValueError("Original generator input changed: " + name)
        input_hashes[name] = qa.sha(original)
    if generator.get("original_data_inputs") != input_hashes:
        raise ValueError("Require exact untouched official data-input hashes")
    before_headers = generator.get("working_headers_before")
    if not isinstance(before_headers, dict) or not before_headers:
        raise ValueError("Require pre-generation working-header hashes")
    for name, digest in before_headers.items():
        path = (qa.WORKING / name).resolve()
        if not path.is_relative_to((qa.WORKING / "include").resolve()):
            raise ValueError("Generator header escapes working include root")
        if name != "include/date.h" and qa.sha(path.read_bytes()) != digest:
            raise ValueError("Generator/consumer working header changed: " + name)
    utility_root = a.generator_manifest.parent
    utility = {"js_sha256": qa.sha((utility_root / "target-makedefs.cjs").read_bytes()),
               "wasm_sha256": qa.sha((utility_root / "target-makedefs.wasm").read_bytes())}
    if generator.get("utility") != utility:
        raise ValueError("Generator executable artifacts do not match recorded hashes")
    outputs = {v["path"]: v for v in generator["files"]}
    for name in (*qa.GENERATED, "options"):
        data = (qa.WORKING / "dat" / name).read_bytes()
        if b"\r" in data or qa.sha(data) != outputs["dat/" + name]["sha256"]:
            raise ValueError("Generated target output is not certified exact LF bytes: " + name)
    if qa.sha((qa.WORKING / "include/date.h").read_bytes()) != outputs["include/date.h"]["sha256"]:
        raise ValueError("Original target generator date.h output mismatch")
    run_dir = qa.BUILD / a.run_name
    if (run_dir / "compile.log").exists() or (run_dir / "verification.json").exists():
        p.error("Preserve existing execution evidence and choose a fresh run-name")
    prepared = qa.prepare(a.data_dir.resolve(), run_dir)
    members = qa.archive_members((a.data_dir / "nhdat").read_bytes())
    for name in (*qa.GENERATED, "options"):
        if members[name] != (qa.WORKING / "dat" / name).read_bytes():
            raise ValueError("Packaged member differs from certified generated output: " + name)
    prepared["reference_phase4_manifest_sha256"] = prepared.pop("candidate_manifest_sha256")
    prepared.update(source_phase="phase6", working_source_root=str(qa.WORKING),
                    generator_manifest_sha256=qa.sha(a.generator_manifest.read_bytes()),
                    generator_original_sources=source_hashes, generator_original_data_inputs=input_hashes,
                    generator_utility=utility, generated_data_lf_verified=True,
                    encyclopedia_index=encyclopedia_index(members["data"]),
                    runner_sha256=qa.sha(Path(__file__).read_bytes()))
    candidate = utility_root / "engine-manifest.json"
    if candidate.exists():
        prepared["candidate_manifest_sha256"] = qa.sha(candidate.read_bytes())
    qa.write_json(run_dir / "prepared.json", prepared)
    if not a.run:
        print(json.dumps({"status": "prepared-not-executed", "report": str(run_dir / "prepared.json"),
                          "all_six_generated_assets_lf": True, "original_inputs_unchanged": True,
                          "consumer_execution_proved": False}))
        return 0
    result = qa.execute(prepared, run_dir, a.sdk, a.node)
    print(json.dumps({k: result[k] for k in ("status", "assertion_count", "failed_assertion_count", "archive_sha256")}))
    return 0 if result["status"] == "passed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
