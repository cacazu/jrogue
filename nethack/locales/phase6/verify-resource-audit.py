"""Verify source-only phase6 evidence, optionally an authored resource batch.

No native build, browser load, source mutation, or semantic runtime approval.
"""
import argparse
import collections
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

BASE = Path(__file__).resolve().parents[2]
SOURCE = BASE.parent / "official-source-audit/NetHack-5.0.0"
OUT = Path(__file__).resolve().parent

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value

catalog = module(BASE / "locales/build-gameplay-catalog.py", "phase6_verifier_catalog")
inv = module(BASE / "tools/inventory_source.py", "phase6_verifier_inventory")
errors = []
checks = collections.Counter()
cache = {}

def src(relative):
    if relative not in cache:
        raw = (SOURCE / relative).read_bytes()
        cache[relative] = (raw.decode("utf-8", errors="replace"), hashlib.sha256(raw).hexdigest())
    return cache[relative]

def check(condition, context):
    checks["assertions"] += 1
    if not condition:
        errors.append(context)

resource = load(OUT / "resource-units.json")
for entry in resource["entries"]:
    context = entry["id"] + " " + entry["source"] + ":" + str(entry["source_start_line"])
    text, sha = src(entry["source"])
    lines = text.splitlines()
    start, end = entry["source_start_line"], entry["source_end_line"]
    check(sha == entry["source_sha256"], context + " hash")
    check(1 <= start <= end <= len(lines), context + " source span")
    check(entry["runtime_binding_approved"] is False, context + " runtime false")
    check(len(entry["id"]) <= 160 and re.fullmatch(r"[a-z][a-z0-9_.]*", entry["id"]) is not None, context + " bounded semantic ID")
    check(catalog.names(entry["english_named_template"]) == set(entry["argument_schemas"]), context + " exact named union")
    original = "\n".join(lines[start - 1:end])
    kind = entry["kind"]
    if kind == "original-random-selected-line":
        expected = entry["original_resource_line"]
        check(original == expected, context + " original random line")
        prefix = entry.get("original_bogusmon_prefix_code")
        check(entry["english_source_literal"] == (expected[1:] if prefix else expected), context + " native prefix transform")
    elif kind in {"help-or-history-line", "oracle-paragraph"}:
        check(original == entry["english_source_literal"], context + " exact text")
    elif kind == "encyclopedia-body":
        body = [line[1:] if line.startswith("\t") else line for line in lines[start - 1:end] if not line.startswith("#")]
        check("\n".join(body) == entry["english_source_literal"], context + " original makedefs body")
    elif kind == "tribute-selected-passage":
        body = [line for line in lines[start - 1:end] if not line.startswith("#")]
        check("\n".join(body) == entry["english_source_literal"], context + " original tribute selected lines")
        check(entry["translation_authoring_allowed"] is False, context + " proprietary excerpt guard")
    elif kind.startswith("lua-"):
        raw = text[entry["lua_literal_start"]:entry["lua_literal_end"]]
        check(bool(raw) and raw[0] in "[\"'", context + " original Lua token offset")
        # Token text has already been decoded by the comment-aware audit lexer.
        check(text.count("\n", 0, entry["lua_literal_start"]) + 1 == start, context + " Lua source line")
    else:
        errors.append(context + " unknown unit kind")

for entry in resource["structural_source_lines"]:
    text, sha = src(entry["source"])
    lines = text.splitlines()
    check(1 <= entry["line"] <= len(lines) and lines[entry["line"] - 1] == entry["original"],
          entry["source"] + ":" + str(entry["line"]) + " original structural line")

labels = load(OUT / "public-label-queues.json")
for entry in labels["entries"]:
    context = entry["id"]
    text, sha = src(entry["source"])
    check(sha == entry["source_sha256"], context + " label source hash")
    pieces = []
    for token in entry["source_literal_tokens"]:
        check(text[token["start"]:token["end"]] == token["raw"], context + " exact original C token")
        pieces.append(inv.decode_c_string(token["raw"]))
    original = "".join(pieces)
    check(original == entry["original_c_literal_value"], context + " C literal concatenation")
    visible = original[1:] if entry["category"] == "deity" and original.startswith("_") else original
    check(visible == entry["english_source_literal"], context + " original public label transform")
    check(catalog.names(entry["english_named_template"]) == set(), context + " literal label args")
    check(entry["runtime_binding_approved"] is False, context + " label runtime false")

summary = load(OUT / "resource-summary.json")
for artifact in summary["artifacts"]:
    raw = (BASE / artifact["path"]).read_bytes()
    check(hashlib.sha256(raw).hexdigest() == artifact["sha256"], artifact["path"] + " summary hash")

frozen = load(BASE / "locales/phase4/reviewed-translations.metadata.json")["frozen_phase3_sha256"]
for relative, sha in frozen.items():
    path = BASE / Path(relative)
    check(hashlib.sha256(path.read_bytes()).hexdigest() == sha, relative + " frozen phase3 hash")

parser = argparse.ArgumentParser()
parser.add_argument("--input", type=Path)
options = parser.parse_args()
if options.input:
    expected = load(options.input)
    authored_path = options.input.with_name(options.input.stem + ".authored.json")
    authored = load(authored_path)
    expected_ids = [entry["id"] for entry in expected["entries"]]
    entries = authored["entries"]
    check([entry["id"] for entry in entries] == expected_ids, "authored exact ordered input IDs")
    check(len(expected_ids) == len(set(expected_ids)), "input unique IDs")
    by_id = {entry["id"]: entry for entry in expected["entries"]}
    for entry in entries:
        original = by_id[entry["id"]]
        context = entry["id"]
        japanese = entry.get("whole_message_ja")
        check(isinstance(japanese, str), context + " authored Japanese string")
        check(entry.get("argument_schemas") == original["argument_schemas"], context + " full original declared union")
        check(entry.get("runtime_binding_approved") is False, context + " authored runtime false")
        check(entry.get("source_review_status") == "faithful-official-source-equivalent", context + " source-equivalent author disposition")
        if isinstance(japanese, str):
            check(catalog.names(japanese).issubset(set(original["argument_schemas"])), context + " Japanese slots within source union")
            check(bool(japanese) or original["english_named_template"] == "", context + " nonblank translation or original spacer")
        check(bool(entry.get("translation_notes")), context + " concrete meaning/producer/layout notes")
        check(entry.get("source_records") == original["source_records"], context + " exact immutable source evidence")
    input_sha = hashlib.sha256(options.input.read_bytes()).hexdigest()
    check(authored.get("input_sha256") == input_sha, "authored exact source batch hash")
    checks["authored_ids"] = len(entries)

report = {"schema_version": 1, "status": "source-evidence-verified" if not errors else "failed",
          "checks": dict(checks), "error_count": len(errors), "errors": errors,
          "runtime_approved_ids": 0,
          "scope": "source offsets/hash/contracts only; Japanese semantic fidelity and native lifetime/consumer/permissions need review; no compiled/browser coverage claim"}
target = options.input.with_name(options.input.stem + ".resource-verification.json") if options.input else OUT / "resource-verification.json"
target.write_bytes((json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
print(json.dumps({key: report[key] for key in ("status", "checks", "error_count", "runtime_approved_ids")}, ensure_ascii=False))
raise SystemExit(1 if errors else 0)
