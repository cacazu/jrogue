#!/usr/bin/env python3
"""Read-only source triage. It generates no translations or runtime bindings.

Japanization source evidence remains copyright the JNetHack authors under NGPL.
Pinned inputs and their complete corresponding notices are tracked separately.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
LOCALES = ROOT.parent
PIN = "25adee135c4bbd43ac8567664f600b565332435c"
PUBLIC_NAME_FUNCTIONS = {"mon_nam", "Monnam", "a_monnam", "Amonnam", "l_monnam", "distant_monnam", "x_monnam",
                         "xname", "Xname", "doname", "Doname", "simpleonames", "simple_typename", "obj_typename",
                         "corpse_xname", "body_part", "mbodypart", "mhe", "mhim", "mhis", "Mhe", "Mhis",
                         "m_monnam", "pmname", "obj_pmname", "rndmonnam", "shkname", "s_suffix", "makeplural",
                         "an", "An", "the", "The", "hcolor", "hliquid", "uhim", "uhis", "rank_of", "surface"}
HELPER_APIS = {"pline", "pline_The", "You", "Your", "You_hear", "You_feel", "You_see", "You_cant", "There",
               "Norep", "You1", "Your1", "You_hear1", "verbalize", "pline_mon", "pline_xy", "pline_dir", "urgent_pline"}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


def write(name, value):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def call_view(call, block, branch):
    return {"api": call["api"], "literal": call["literal"], "line": block[branch + "_line"] + call["call_line_offset"],
            "format_semantics": call["format_semantics"], "format_specifiers": call["format_specifiers"],
            "argument_expressions": call["argument_expressions"], "signature_arguments": call["all_argument_expressions"]}


def functions(expressions):
    return sorted(set(re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(", " ".join(expressions))))


def member_reads(expressions):
    return set(re.findall(r"\b[A-Za-z_][A-Za-z0-9_]*(?:\s*->\s*|\.\s*)[A-Za-z_][A-Za-z0-9_]*", " ".join(expressions)))


def identifiers(expressions):
    return set(re.findall(r"\b[A-Za-z_][A-Za-z0-9_]*\b", " ".join(expressions)))


def triage(en, ja, helper):
    """Heuristic review queue, explicitly never approval of a source mapping."""
    if ja is None:
        return "d", ["No unambiguous paired Japanese call; original source authoring/pair resolution required."]
    added_members = sorted(member_reads(ja["argument_expressions"]) - member_reads(en["argument_expressions"]))
    en_contract = helper.printf_argument_contract(en["literal"], len(en["tail_args"])) if en["format_semantics"] == "printf-like" else []
    ja_contract = helper.printf_argument_contract(ja["literal"], len(ja["tail_args"])) if ja["format_semantics"] == "printf-like" else []
    if len(ja["tail_args"]) > len(en["tail_args"]):
        return "d", ["Japanese call consumes additional arguments not captured by original English call.", "Reject import until original-public snapshot proof or source-equivalent authoring."]
    if added_members:
        return "d", ["Japanese argument reads direct native fields absent from original computed arguments: " + ", ".join(added_members)]
    name_functions = sorted(set(functions(en["argument_expressions"])) & PUBLIC_NAME_FUNCTIONS)
    if name_functions and en_contract is not None and ja_contract is not None:
        return "a", ["Original call computes public name/grammar descriptor through " + ", ".join(name_functions),
                     "Review immutable descriptor capture at that original producer; do not execute Japanese naming helper or recall native state."]
    if en["tail_args"] == ja["tail_args"] and en_contract is not None and ja_contract is not None:
        return "b", ["Original argument expressions agree; printf token/role/API contract differs and needs explicit typed source conversion."]
    if en_contract is not None and ja_contract is not None and len(en_contract) == len(ja_contract):
        common = identifiers(en["argument_expressions"]) & identifiers(ja["argument_expressions"])
        if common and any(a["c_type"] != b["c_type"] for a,b in zip(en_contract, ja_contract)):
            return "b", ["Potential scalar/text conversion with shared original symbols: " + ", ".join(sorted(common)),
                         "Shared symbol evidence alone does not prove equivalent values or side effects."]
    return "c", ["Paired translation/arguments differ; author Japanese from exact official English and preserve only original captured facts."]


def choose_candidates(en, japanese):
    same = [ja for ja in japanese if ja["api"] == en["api"]]
    if same:
        return same, "same-api-candidate"
    helper = [ja for ja in japanese if ja["api"] in HELPER_APIS and en["api"] in HELPER_APIS]
    return helper, "helper-api-change-candidate" if helper else "no-comparable-api"


def dynamic_origins(data, official):
    formatters = data["intermediate_formatters"]
    by_function = defaultdict(list)
    for formatter in formatters:
        if formatter["source"].startswith("src/"):
            by_function[(formatter["source"], formatter["function_candidate"])].append(formatter)
    rows, categories = [], Counter()
    for call in data["messages"]:
        if not call["source"].startswith("src/") or call["english_source_template"] is not None:
            continue
        expression = call["format_expression"]
        expression_symbols = identifiers([expression])
        related = []
        for formatter in by_function[(call["source"], call["function_candidate"])]:
            args = formatter["argument_expressions"]
            destination = args[0] if args else ""
            symbols = identifiers([destination])
            if expression_symbols & symbols:
                related.append({"source": formatter["source"], "line": formatter["line"], "api": formatter["api"],
                                "destination_expression": destination, "english_id_candidate": formatter["english_id_candidate"],
                                "english_source_template": formatter["english_source_template"], "argument_expressions": args})
        category = "same-function-formatter-symbol-candidate" if related else "source-branch-array-alias-or-interprocedural-review"
        categories[category] += 1
        rows.append({"source": call["source"], "line": call["line"], "function_candidate": call["function_candidate"], "api": call["api"],
                     "format_expression": expression, "argument_expressions": call["argument_expressions"], "category": category,
                     "candidate_formatters": related, "runtime_integration": False,
                     "guard": "lexical symbol overlap only; branch, lifetime, overwrites and array selection must be proved before semantic IDs are emitted"})
    return {"schema_version": 1, "counts": {"core_dynamic_calls": len(rows), "all_intermediate_formatters": len(formatters),
                                             "core_intermediate_formatters": sum(f["source"].startswith("src/") for f in formatters),
                                             "categories": dict(categories)}, "runtime_integration": False, "rows": rows}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--jnethack", type=Path, default=Path(r"C:\Users\kit\gameme\jnethack\jnethack\source"))
    parser.add_argument("--official-source", type=Path, default=LOCALES.parent.parent / "official-source-audit/NetHack-5.0.0")
    args = parser.parse_args()
    protected = [LOCALES / n for n in ["gameplay-core.json", "gameplay-core.en.json", "gameplay-core.ja.json", "gameplay-core.metadata.json", "build-gameplay-catalog.py", "gameplay-reuse-calls.py", "gameplay-quest-authored.ja.json"]]
    protected += [LOCALES / n for n in ["source-seed.en.json", "source-seed.ja.json", "source-seed.metadata.json", "translation-status.json"]]
    protected += [LOCALES.parent / "catalog/source-text-messages.json"]
    frozen = {str(p.relative_to(LOCALES.parent)): digest(p) for p in protected}
    helper = module(LOCALES / "gameplay-reuse-calls.py", "frozen_phase3_reuse")
    scanner = helper.load_scanner()
    source_catalog = LOCALES.parent / "catalog/source-text-messages.json"
    data = json.loads(source_catalog.read_text(encoding="utf-8"))
    by_file = defaultdict(lambda: defaultdict(list))
    for message in data["messages"]:
        if message["source"].startswith("src/"):
            by_file[message["source"]][message["line"]].append(message)
    core = json.loads((LOCALES / "gameplay-core.metadata.json").read_text(encoding="utf-8"))
    current_ids = {r["id"] for r in core["entries"] if r["category"] == "message"}
    tracked = subprocess.run(["git", "-C", str(args.jnethack), "ls-tree", "-r", "--name-only", PIN, "src"], capture_output=True, check=True).stdout.decode().splitlines()
    rows, counts, inputs, imported_paths = [], Counter(), {}, set()
    for relative in sorted(p for p in tracked if p.endswith(".c")):
        path = args.official_source / relative
        if not path.is_file():
            continue
        original = path.read_bytes()
        raw = helper.pinned_blob(args.jnethack, relative)
        inputs[relative] = {"commit": PIN, "sha256": helper.sha256(raw), "bytes": len(raw)}
        lookup = helper.official_calls(helper.normalized_source(original), scanner, by_file[relative], scanner.MESSAGE_SINKS)
        for block in helper.paired_blocks(helper.normalized_source(raw)):
            if not helper.JAPANESE.search(block["japanese"]):
                continue
            english = helper.literal_calls(block["english"], scanner)
            japanese = [ja for ja in helper.literal_calls(block["japanese"], scanner) if helper.JAPANESE.search(ja["literal"])]
            edges, reverse = defaultdict(list), Counter()
            for ei,en in enumerate(english):
                for ji,ja in enumerate(japanese):
                    if helper.compatible_calls(en,ja) is not None:
                        edges[ei].append(ji)
                        reverse[ji] += 1
            for ei,en in enumerate(english):
                matches = edges.get(ei, [])
                if len(matches) == 1 and reverse[matches[0]] == 1:
                    continue
                status = "ambiguous" if matches else "unpaired"
                counts[status + "_english_calls"] += 1
                official_matches = lookup.get(en["call"], [])
                candidates, candidate_status = choose_candidates(en,japanese)
                is_unique = len(candidates) == 1 and status != "ambiguous"
                category, reasons = triage(en, candidates[0] if is_unique else None, helper)
                if not official_matches:
                    category, reasons = "d", ["English call is not an exact original release source call; no official semantic ID can be safely assigned."]
                counts["category_" + category] += 1
                ids = sorted({r["english_id_candidate"] for r in official_matches})
                counts["exact_official_call_rows"] += bool(ids)
                counts["already_in_phase3_rows"] += bool(set(ids) & current_ids)
                if candidates:
                    imported_paths.add(relative)
                rows.append({"source": relative, "jp_block_line": block["opening_line"], "pairing_status": status,
                             "english": call_view(en,block,"english"), "japanese_candidates": [call_view(ja,block,"japanese") for ja in candidates],
                             "candidate_api_relation": candidate_status, "unique_candidate": is_unique, "category": category,
                             "category_status": "heuristic-triage-requires-human-source-review", "reasons": reasons, "official_ids": ids,
                             "official_call_sites": [{k:r[k] for k in ["source", "line", "function_candidate", "api", "format_argument_index", "argument_expressions", "argument_binding", "english_id_candidate"]} for r in official_matches],
                             "already_in_phase3_ids": sorted(set(ids)&current_ids), "pinned_blob_sha256": helper.sha256(raw), "official_blob_sha256": helper.sha256(original),
                             "runtime_integration": False, "mapping_approved": False, "gameplay_logic_imported": False})
    if counts["unpaired_english_calls"] != 1056 or counts["ambiguous_english_calls"] != 5:
        raise ValueError("frozen phase-three rejected-pair counts changed")
    counts["rows"] = len(rows)
    counts["distinct_exact_official_ids"] = len({i for row in rows for i in row["official_ids"]})
    counts["distinct_exact_official_ids_not_in_phase3"] = len({i for row in rows for i in row["official_ids"]} - current_ids)
    report = {"schema_version": 1, "purpose": "phase-four review queue only; does not enlarge frozen phase-three catalogs/bindings", "counts": dict(counts),
              "categories": {"a": "original public name/grammar descriptor capture review", "b": "explicit source-typed conversion/permutation review", "c": "author official-English-equivalent Japanese", "d": "reject ambiguity/unknown facts/nonofficial source; may require separate source authoring"},
              "provenance": {"jnethack": {"pinned_commit": PIN, "origin": "https://github.com/jnethack/jnethack-alpha.git", "authors": helper.AUTHORS,
                                            "imported_paths": sorted(imported_paths), "input_blobs": inputs, "notice": "all quoted Japanese source remains JNetHack authorship under NGPL; phase-four corresponding notices/inputs need packaging review before distribution"}},
              "frozen_phase3_sha256": frozen, "runtime_integration": False, "mapping_approved_count": 0, "rows": rows}
    dynamic = dynamic_origins(data,args.official_source)
    write("source-pair-review.json",report)
    write("dynamic-origin-review.json",dynamic)
    write("classification-summary.json",{"schema_version":1,"pairs":dict(counts),"dynamic":dynamic["counts"],"phase3_unchanged":True,"runtime_integration":False})
    for path in protected:
        if digest(path) != frozen[str(path.relative_to(LOCALES.parent))]:
            raise ValueError("frozen phase-three input/output changed")
    print(json.dumps({"pairs":dict(counts),"dynamic":dynamic["counts"],"phase3_unchanged":True},indent=2))


if __name__ == "__main__":
    main()
