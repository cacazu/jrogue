#!/usr/bin/env python3
"""Prepare an exact official-source consumer gate; execution requires --run.

Default work is Python source/hash/offset inspection only.  The parent must
grant the sole compiler/Node slot before invoking --run.  No existing source,
data, browser asset, or engine manifest is modified by either mode.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

OWN = Path(__file__).resolve().parent
ROOT = OWN.parents[2]
BUILD = ROOT / "build" / "data-consumer-qa"
OFFICIAL = ROOT / "upstream" / "NetHack-5.0.0"
WORKING = ROOT / "work" / "phase4" / "NetHack-5.0.0"
FUNCTIONS = ("unpadline", "init_rumors", "get_rnd_line",
             "init_oracles", "outoracle")
GENERATED = ("data", "oracles", "rumors", "bogusmon", "engrave", "epitaph")
EXPECTED_MACROS = {"UNIX": 1, "WIN32": 0, "MSDOS": 0, "_WIN32": 0,
                   "DLBLIB": 1, "CROSS_TO_WASM": 1}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8", newline="\n")


def matching(text: str, start: int, opening: str, closing: str) -> int:
    """Balance C delimiters while ignoring comments and quoted literals."""
    depth, i = 0, start
    while i < len(text):
        if text.startswith("/*", i):
            i = text.index("*/", i + 2) + 2
            continue
        if text.startswith("//", i):
            end = text.find("\n", i + 2)
            i = len(text) if end < 0 else end
            continue
        if text[i] in "\"'":
            quote = text[i]
            i += 1
            while i < len(text):
                if text[i] == "\\":
                    i += 2
                elif text[i] == quote:
                    i += 1
                    break
                else:
                    i += 1
            continue
        if text[i] == opening:
            depth += 1
        elif text[i] == closing:
            depth -= 1
            if not depth:
                return i
        i += 1
    raise ValueError("Unbalanced source delimiter")


def body(text: str, name: str, *, pristine: bool = False) -> tuple[str, int, int]:
    for match in re.finditer(r"\b" + re.escape(name) + r"\s*\(", text):
        paren = text.index("(", match.start())
        endparen = matching(text, paren, "(", ")")
        cursor = endparen + 1
        while cursor < len(text):
            if text[cursor].isspace():
                cursor += 1
            elif text.startswith("/*", cursor):
                cursor = text.index("*/", cursor + 2) + 2
            elif text.startswith("//", cursor):
                cursor = text.index("\n", cursor + 2)
            else:
                break
        if cursor >= len(text) or text[cursor] != "{":
            continue
        end = matching(text, cursor, "{", "}") + 1
        start = text.rfind("\n", 0, match.start()) + 1
        if pristine:
            # Official definitions place return type on the preceding line.
            start = text.rfind("\n", 0, start - 1) + 1
        return text[start:end], start, end
    raise ValueError(f"No source definition of {name}")


def target_flags() -> list[str]:
    # Evaluate only the existing return-expression function, without importing
    # the builder or invoking setup/native utilities/compilation.
    tree = ast.parse((ROOT / "tools" / "build-upstream.py").read_text("utf-8"))
    fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
              and n.name == "target_flags")
    if len(fn.body) != 1 or not isinstance(fn.body[0], ast.Return):
        raise ValueError("Review changed target_flags before probing")
    code = compile(ast.Module(body=[fn], type_ignores=[]), "target_flags", "exec")
    env = {"SOURCE": WORKING}
    exec(code, env)
    return env["target_flags"]()


def archive_members(blob: bytes) -> dict[str, bytes]:
    lines = blob.split(b"\n", 1)
    rev, count, namesize, first, total = map(int, lines[0].split())
    if rev != 1 or total != len(blob):
        raise ValueError("Original DLB archive header mismatch")
    records = lines[1].split(b"\n", count)
    directory = []
    for raw in records[:count]:
        name, offset = raw[1:].split()
        if raw[:1] != b"n":
            raise ValueError("Expected original uncompressed DLB member")
        directory.append((name.decode("ascii"), int(offset)))
    if directory[0] != ("Directory", 0) or directory[1][1] != first:
        raise ValueError("Original DLB directory/start mismatch")
    if sum(len(name) + 1 for name, _ in directory) != namesize:
        raise ValueError("Original DLB string-space mismatch")
    answer = {}
    for i, (name, offset) in enumerate(directory[1:], 1):
        end = directory[i + 1][1] if i + 1 < count else total
        if name in answer or not first <= offset <= end <= total:
            raise ValueError("Original DLB member boundaries invalid")
        answer[name] = blob[offset:end]
    return answer


def xcrypt(blob: bytes) -> bytes:
    # Independent byte oracle for the original reversible encryption format;
    # actual results are produced by the compiled pristine hacklib.c function.
    return bytes(c ^ (1 << (i % 5)) if c & 96 else c
                 for i, c in enumerate(blob))


def offsets_oracles(data: bytes) -> dict:
    lines = data.splitlines(keepends=True)
    count = int(lines[1])
    offsets = [int(v.strip(), 16) for v in lines[2:count + 3]]
    header_end = sum(len(v) for v in lines[:count + 3])
    groups = []
    if len(offsets) != count + 1 or offsets[-1] != len(data):
        raise ValueError("Original oracle count/EOF offset mismatch")
    separator = data[header_end:offsets[0]]
    if separator not in (b"---\n", b"---\r\n"):
        raise ValueError("Original oracle first offset/marker mismatch")
    for i, start in enumerate(offsets[:-1]):
        end = offsets[i + 1]
        group = data[start:end]
        if not group.endswith(separator):
            raise ValueError("Original oracle indexed end mismatch")
        raw_lines = group[:-len(separator)].splitlines(keepends=True)
        # Model the original COLNO-1 byte cap, including resets of xcrypt for
        # each returned chunk.  This is an expected-output calculation only;
        # no generated file or offset is rewritten or normalized.
        plaintext = []
        for raw_line in raw_lines:
            clean_line = raw_line.rstrip(b"\r\n") + b"\n"
            for pos in range(0, len(clean_line), 79):
                plaintext.append(xcrypt(clean_line[pos:pos + 79].split(b"\n", 1)[0]))
        groups.append({"index": i, "start": start, "end": end,
                       "source_line_count": len(raw_lines),
                       "clean_lines_hex": [v.hex() for v in plaintext]})
    return {"count": count, "offsets": offsets, "header_end": header_end,
            "separator_hex": separator.hex(), "groups": groups}


def random_sections(members: dict[str, bytes]) -> dict:
    rumors = members["rumors"]
    header = rumors.splitlines(keepends=True)[:2]
    match = re.fullmatch(rb"(\d+),(\d+),([0-9a-f]+);(\d+),(\d+),([0-9a-f]+);0,0,([0-9a-f]+)\r?\n", header[1])
    if not match:
        raise ValueError("Original rumors header format changed")
    true_count, true_size, true_start, false_count, false_size, false_start, eof = [
        int(value, 16 if i in (2, 5, 6) else 10)
        for i, value in enumerate(match.groups())]
    if not (true_start == sum(map(len, header))
            and true_start + true_size == false_start
            and false_start + false_size == eof == len(rumors)):
        raise ValueError("Original rumors physical boundaries invalid")
    sections = [("rumors.true", rumors, true_start, false_start, 60, true_count),
                ("rumors.false", rumors, false_start, eof, 60, false_count)]
    for name in ("bogusmon", "engrave", "epitaph"):
        data = members[name]
        start = len(data.splitlines(keepends=True)[0])
        sections.append((name, data, start, len(data), 20 if name == "bogusmon" else 60, None))
    answer = {}
    for name, data, start, end, padding, count in sections:
        lines = data[start:end].splitlines(keepends=True)
        if count is not None and count != len(lines):
            raise ValueError(f"Original {name} count mismatch")
        if any(len(v) > 255 for v in lines):
            raise ValueError("Review original BUFSZ chunking before comparing")
        positions = []
        pos = start
        for line in lines:
            positions.append(pos)
            pos += len(line)
        rows = []
        for i, line in enumerate(lines):
            previous = i - 1 if i else len(lines) - 1
            clean_previous = lines[previous].rstrip(b"\r\n") + b"\n"
            rows.append({"index": i, "source_position": positions[i],
                         "selected_offset": positions[previous] - start,
                         "clean_rng_calls": 1 if len(clean_previous) <= padding + 1 else 10,
                         "clean_hex": xcrypt(line.rstrip(b"\r\n")).rstrip(b"_").hex()})
        answer[name] = {"start": start, "end": end, "padding": padding,
                        "count": len(lines), "rows": rows}
    return answer


def prepare(data_dir: Path, run_dir: Path) -> dict:
    source_path = OFFICIAL / "src" / "rumors.c"
    source_bytes = source_path.read_bytes()
    text = source_bytes.decode("utf-8")
    fragments, source_records = [], []
    for name in FUNCTIONS:
        snippet, start, end = body(text, name, pristine=True)
        # Exact UTF-8 byte coordinates bind the immutable official function.
        byte_start, byte_end = len(text[:start].encode()), len(text[:end].encode())
        original = source_bytes[byte_start:byte_end]
        if original != snippet.encode():
            raise ValueError("Original function slice is not byte-exact")
        line = text.count("\n", 0, start) + 1
        fragments.append(f'#line {line} "upstream/NetHack-5.0.0/src/rumors.c"\n' + snippet)
        source_records.append({"function": name, "source": "src/rumors.c",
                               "line": line, "start_byte": byte_start,
                               "end_byte": byte_end, "sha256": sha(original)})
    template = (OWN / "probe-template.c").read_text("utf-8")
    if template.count("/*@@ORIGINAL_FUNCTIONS@@*/") != 1:
        raise ValueError("Probe template insertion marker changed")
    generated = template.replace("/*@@ORIGINAL_FUNCTIONS@@*/", "\n\n".join(fragments))
    run_dir.mkdir(parents=True, exist_ok=True)
    cfile = run_dir / "original-consumer.c"
    cfile.write_text(generated, encoding="utf-8", newline="\n")
    blob = (data_dir / "nhdat").read_bytes()
    members = archive_members(blob)
    for name in GENERATED:
        if name not in members:
            raise ValueError(f"Missing actual packaged {name}")
    oracle = offsets_oracles(members["oracles"])
    sections = random_sections(members)
    if data_dir.resolve() == (ROOT / "work" / "phase4" / "wasm-data").resolve():
        for name in GENERATED:
            if members[name] != (WORKING / "dat" / name).read_bytes():
                raise ValueError(f"Actual Phase4 archive differs from generated dat/{name}")
    assets = run_dir / "assets"
    assets.mkdir(exist_ok=True)
    (assets / "nhdat").write_bytes(blob)  # byte-identical, never normalized
    manifest = {
        "status": "prepared-not-executed", "official_commit": "16ff59115315917b93185d026aeefea06db9b0f4",
        "scope": "Only an isolated process; no live game/state/RNG/save/presentation",
        "actual_archive": str(data_dir / "nhdat"), "archive_bytes": len(blob), "archive_sha256": sha(blob),
        "archive_member_count": len(members), "target_flags": target_flags(),
        "official_functions": source_records,
        "official_c": {n: sha((OFFICIAL / n).read_bytes())
                       for n in ("src/dlb.c", "src/hacklib.c", "src/alloc.c", "util/panic.c", "src/rumors.c", "util/makedefs.c")},
        "working_headers": {p.relative_to(WORKING).as_posix(): sha(p.read_bytes())
                            for p in sorted((WORKING / "include").glob("*.h"))},
        "builder_sha256": sha((ROOT / "tools" / "build-upstream.py").read_bytes()),
        "candidate_manifest_sha256": sha((ROOT / "build" / "phase4" / "engine-manifest.json").read_bytes()),
        "probe_c_sha256": sha(cfile.read_bytes()),
        "probe_template_sha256": sha((OWN / "probe-template.c").read_bytes()),
        "members": {n: {"bytes": len(members[n]), "sha256": sha(members[n]),
                        "crlf": members[n].count(b"\r\n"), "lf": members[n].count(b"\n")}
                    for n in GENERATED},
        "oracle": oracle, "random_sections": sections,
        "macro_expectation_unproved": EXPECTED_MACROS,
        "consumer_execution_proved": False,
    }
    write_json(run_dir / "prepared.json", manifest)
    return manifest


def run_command(command: list[str], run_dir: Path, log: str) -> tuple[int, str]:
    env = dict(os.environ)
    env.update(EMCC_CORES="1", BINARYEN_CORES="1", EMCC_BATCH_BUILD="0")
    start = time.monotonic()
    proc = subprocess.run(command, cwd=ROOT, env=env, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, timeout=180)
    output = proc.stdout.decode("utf-8", errors="replace")
    (run_dir / log).write_bytes(proc.stdout)
    write_json(run_dir / (log + ".command.json"), {
        "command": command, "returncode": proc.returncode,
        "duration_seconds": round(time.monotonic() - start, 6),
        "compiler_limits": {k: env[k] for k in ("EMCC_CORES", "BINARYEN_CORES", "EMCC_BATCH_BUILD")},
        "output_sha256": sha(proc.stdout)})
    return proc.returncode, output


def verify_output(output: str, prepared: dict) -> dict:
    rows = [line.split("\t") for line in output.splitlines()]
    def by(kind: str) -> list[list[str]]:
        return [row for row in rows if row[0] == kind]
    macros = {k: int(v) for k, v in (s.split("=") for s in by("MACROS")[0][1:])}
    failures, assertions = [], []
    def check(label: str, condition: bool) -> None:
        assertions.append({"label": label, "passed": bool(condition)})
        if not condition:
            failures.append(label)
    check("exact actual target platform macros", macros == EXPECTED_MACROS)
    check("original UNIX archive filename", by("DLB_ARCHIVE") == [["DLB_ARCHIVE", "nhdat"]])
    check("original consumer process completed", ["COMPLETE"] in rows)
    oracle = prepared["oracle"]
    check("original oracle header count and actual member size", by("ORACLE_HEADER") == [
        ["ORACLE_HEADER", str(oracle["count"]), str(prepared["members"]["oracles"]["bytes"]) ]])
    check("every original oracle offset incl EOF", by("ORACLE_OFFSET") == [
        ["ORACLE_OFFSET", str(i), str(v)] for i, v in enumerate(oracle["offsets"])])
    oracle_results = {int(row[1]): list(map(int, row[2:])) for row in by("ORACLE_RESULT")}
    actual_oracle_lines = {}
    for row in by("ORACLE_LINE"):
        index, seq = int(row[1]), int(row[2])
        actual_oracle_lines.setdefault(index, []).append((seq, row[3]))
    oracle_observations = []
    for group in oracle["groups"]:
        index = group["index"]
        expected_lines = [b"The message reads:".hex(), ""] + group["clean_lines_hex"]
        actual = actual_oracle_lines.get(index, [])
        check(f"oracle {index} stops at original indexed paragraph delimiter", actual == list(enumerate(expected_lines)))
        result = oracle_results.get(index)
        expected_tail = [0, 0, oracle["count"]] if index == 0 else [1, oracle["count"] - 1, oracle["count"] - 1]
        check(f"oracle {index} original selection/state updates", result is not None and result[2:] == expected_tail)
        oracle_observations.append({"index": index, "expected_public_lines": len(expected_lines),
                                    "observed_public_lines": len(actual),
                                    "observed_cr_lines": result[1] if result else None,
                                    "consumer_result": result})
    random_rows = {(row[1], int(row[2])): row[3:] for row in by("RANDOM_RESULT")}
    random_observations = []
    for name, section in prepared["random_sections"].items():
        check(f"{name} actual header and byte offsets", ["RANDOM_HEADER", name, str(section["count"]),
              str(section["start"]), str(section["end"]), str(section["padding"])] in by("RANDOM_HEADER"))
        text_failures, rng_failures = [], []
        for expected in section["rows"]:
            index = expected["index"]
            actual = random_rows.get((name, index))
            check(f"{name} {index} original chosen offset and range", actual is not None and
                  int(actual[0]) == expected["selected_offset"] and
                  int(actual[2]) == section["end"] - section["start"])
            clean = actual is not None and actual[4] == expected["clean_hex"]
            same_rng = actual is not None and int(actual[1]) == expected["clean_rng_calls"]
            check(f"{name} {index} original plaintext and underscore unpadding", clean)
            check(f"{name} {index} target-native LF selection RNG call count", same_rng)
            if not clean:
                text_failures.append(index)
            if not same_rng:
                rng_failures.append(index)
        random_observations.append({"section": name, "tested_records": section["count"],
                                    "plaintext_mismatch_indices": text_failures,
                                    "lf_selection_rng_mismatch_indices": rng_failures})
    expected_total = sum(s["count"] for s in prepared["random_sections"].values())
    check("all original random-record consumers executed once", len(random_rows) == expected_total)
    return {"status": "passed" if not failures else "failed-data-consumer-parity",
            "actual_target_macros": macros, "oracle_observations": oracle_observations,
            "random_observations": random_observations, "assertions": assertions,
            "assertion_count": len(assertions), "failed_assertion_count": len(failures),
            "failures": failures, "consumer_execution_proved": True}


def execute(prepared: dict, run_dir: Path, sdk: Path, node: Path) -> dict:
    emcc = [str(sdk / "python" / "3.13.3_64bit" / "python.exe"),
            str(sdk / "upstream" / "emscripten" / "emcc.py")]
    flags = prepared["target_flags"]
    original_dlb = str(OFFICIAL / "src" / "dlb.c")
    code, macros = run_command(emcc + flags + ["-E", "-dM", original_dlb], run_dir, "target-macros.log")
    if code:
        raise RuntimeError("Exact target macro preprocessing failed; see target-macros.log")
    code, processed = run_command(emcc + flags + ["-E", "-P", original_dlb], run_dir, "target-dlb-preprocessed.c")
    if code:
        raise RuntimeError("Original target DLB preprocessing failed")
    reader, _, _ = body(processed, "lib_dlb_fgets")
    macro_names = {line.split()[1] for line in macros.splitlines() if line.startswith("#define ")}
    measured = {name: int(name in macro_names) for name in EXPECTED_MACROS}
    macro_report = {"actual_target_macros": measured,
                    "matches_expected": measured == EXPECTED_MACROS,
                    "original_reader_preprocessed_sha256": sha(reader.encode()),
                    "cr_normalization_compiled": "strchr(buf, '\\r')" in reader,
                    "reader": reader,
                    "target_macros_sha256": sha((run_dir / "target-macros.log").read_bytes())}
    write_json(run_dir / "macro-evidence.json", macro_report)
    sources = [str(run_dir / "original-consumer.c")] + [str(OFFICIAL / n)
               for n in ("src/dlb.c", "src/hacklib.c", "src/alloc.c", "util/panic.c")]
    command = emcc + flags + sources + ["--embed-file", str(run_dir / "assets") + "@/",
              "-sENVIRONMENT=node", "-o", str(run_dir / "original-consumer.cjs")]
    code, _ = run_command(command, run_dir, "compile.log")
    if code:
        raise RuntimeError("Original consumer compilation failed; see compile.log")
    code, output = run_command([str(node), str(run_dir / "original-consumer.cjs")], run_dir, "consumer.log")
    if code:
        raise RuntimeError(f"Original consumer returned {code}; see consumer.log")
    answer = verify_output(output, prepared)
    answer.update({"source_evidence": "prepared.json", "prepared_sha256": sha((run_dir / "prepared.json").read_bytes()),
                   "archive_sha256": prepared["archive_sha256"], "macro_evidence": macro_report,
                   "consumer_log_sha256": sha((run_dir / "consumer.log").read_bytes()),
                   "consumer_js_sha256": sha((run_dir / "original-consumer.cjs").read_bytes()),
                   "consumer_wasm_sha256": sha((run_dir / "original-consumer.wasm").read_bytes())})
    write_json(run_dir / "verification.json", answer)
    return answer


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true", help="Parent-serialized exact compiler/Node gate")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "work" / "phase4" / "wasm-data")
    parser.add_argument("--run-name", default="phase4")
    parser.add_argument("--sdk", type=Path, default=Path(r"C:\Users\kit\emsdk"))
    parser.add_argument("--node", type=Path, default=Path(r"C:\Program Files\nodejs\node.exe"))
    args = parser.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", args.run_name):
        parser.error("run-name must be one simple owned directory name")
    run_dir = BUILD / args.run_name
    if not args.data_dir.resolve().is_relative_to(ROOT.resolve()):
        parser.error("data-dir must be inside the authorized nethack staging root")
    if (run_dir / "verification.json").exists() or (run_dir / "compile.log").exists():
        parser.error("Preserve existing execution evidence; choose a fresh run-name")
    prepared = prepare(args.data_dir, run_dir)
    if not args.run:
        print(json.dumps({"status": prepared["status"], "report": str(run_dir / "prepared.json"),
                          "source_function_count": len(FUNCTIONS), "archive_sha256": prepared["archive_sha256"],
                          "oracle_count": prepared["oracle"]["count"],
                          "random_record_count": sum(s["count"] for s in prepared["random_sections"].values()),
                          "consumer_execution_proved": False}))
        return 0
    answer = execute(prepared, run_dir, args.sdk, args.node)
    print(json.dumps({k: answer[k] for k in ("status", "archive_sha256", "assertion_count", "failed_assertion_count")}))
    return 0 if answer["status"] == "passed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
