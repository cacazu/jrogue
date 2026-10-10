#!/usr/bin/env python3
"""Partition remaining category IDs into disjoint source author inputs."""
import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def load(name):
    return json.loads((HERE / name).read_text("utf8"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def module(path, name):
    import sys
    spec = spec_from_file_location(name, path)
    value = module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--official-source", type=Path, default=ROOT.parent / "official-source-audit/NetHack-5.0.0")
    parser.add_argument("--category", choices=("a", "b", "c", "d"), default="c")
    parser.add_argument("--batches", type=int, default=3)
    options = parser.parse_args()
    if not 1 <= options.batches <= 3:
        raise ValueError("Use one to three source batches")
    source = load("source-pair-review.json")
    reviewed = load("reviewed-translations.metadata.json")
    core = module(ROOT / "locales/build-gameplay-catalog.py", "phase4_author_core")
    helper = module(HERE / "build-reviewed-translations.py", "phase4_author_review")
    scanner = module(ROOT / "tools/inventory_source.py", "phase4_author_scanner")
    protected = {p: sha(ROOT / p) for p in source["frozen_phase3_sha256"]}
    if protected != source["frozen_phase3_sha256"]:
        raise ValueError("Frozen inputs differ")
    frozen = set(json.loads((ROOT / "locales/gameplay-core.json").read_text("utf8"))["en"])
    approved = {e["id"] for e in reviewed["entries"]}
    deferred = {e["id"] for e in reviewed["rejected_or_missing_context"]}
    category_c = [r for r in source["rows"] if r["category"] == options.category]
    c_ids = {i for r in category_c for i in r["official_ids"]}
    target = c_ids - frozen - approved - deferred
    rows_by_id = defaultdict(list)
    for row in category_c:
        for ident in row["official_ids"]:
            if ident in target:
                rows_by_id[ident].append(row)
    ledger = json.loads((ROOT / "catalog/source-text-messages.json").read_text("utf8"))["messages"]
    native_by_id = defaultdict(list)
    for row in ledger:
        if row["english_id_candidate"] in target:
            native_by_id[row["english_id_candidate"]].append(row)
    ids_by_file = defaultdict(list)
    for ident, rows in rows_by_id.items():
        files = {r["source"] for r in rows}
        if len(files) != 1:
            raise ValueError("Semantic namespace crosses files")
        ids_by_file[next(iter(files))].append(ident)
    # A file belongs to exactly one author. Balance distinct IDs, never row
    # indexes or approximate pair ordering. The fixed tie-breaks are reproducible.
    buckets = [{"files": [], "ids": []} for _ in range(options.batches)]
    for path, ids in sorted(ids_by_file.items(), key=lambda item: (-len(item[1]), item[0])):
        bucket = min(enumerate(buckets), key=lambda pair: (len(pair[1]["ids"]), pair[0]))[1]
        bucket["files"].append(path)
        bucket["ids"].extend(ids)
    common_instructions = [
        "Author faithful whole Japanese messages from original official English facts and argument meanings. Pinned Japanese is evidence for review, not authority for extra gameplay facts.",
        "Retain exact English semantic IDs and original arg_1/arg_2 names. Preserve source printf flags, width, precision, length and types. Integer-byte %c must not silently become a string/Unicode argument.",
        "Include the original helper meaning: You/Your/You_cant/You_feel/You_hear/You_see/There/pline_The, quotation for verbalize, and source-captured helper variants where required.",
        "Use only original C values already computed and exposed at the original call. Never add field/state/naming/grammar/RNG queries, execute the Japanese fork branch, or reverse-match completed English at runtime.",
        "If a dynamic English argument is a selected source literal, provide authored literal translations with original argument name, source-expression token position and semantic source identity. Capture the original selected literal once at its producer; do not replay its predicate.",
        "If an argument is an original public name/description, raw English may remain an explicit fallback. A full Japanese result requires an original producer descriptor; do not guess hidden entity type, identity, gender, appearance, attributes or hallucination choices.",
        "Do not pad unused slots with %.0s. If Japanese legitimately omits an English-only grammatical slot, record the reason and retain the full original source union in explicit argument_schemas; no meaningful original fact may be omitted.",
        "Inspect every original call site for an ID. A single template must support all its original argument contracts, not just the pinned block's first occurrence.",
        "When provenance, meaning, type or capture is unproved, mark rejected-extra-context or requires-source-producer-contract with concrete evidence. Do not insert blank JA, guessed translations, or approve runtime coverage.",
        "Write output only to your assigned new phase4 fragment. Do not edit frozen phase-three maps, current reviewed maps, upstream sources, engine/applied files, Git, web artifacts or another author's batch."]
    if options.category == "a":
        common_instructions.append("Category A requires public name/grammar provenance review. Current ordinary xname/monster name hooks can supply only their source-proven public branches; quantity/BUC/artifact/custom/shopkeeper/priest/hallucination/possessive/capitalized composition remains explicit fallback unless its original producer is bound. Do not infer any descriptor from a completed English name.")
    elif options.category == "b":
        common_instructions.append("Category B needs explicit original typed conversion/permutation review. Preserve original C slot names/types; a fork's %c-to-%s or changed helper call is not permission to add conversions/native calls. Pure locale formatting may reorder slots while retaining their original public contract.")
    elif options.category == "d":
        common_instructions.append("Category D contains fork ambiguity/extra facts. Reject those fork-only values/queries, but author an original-English-equivalent Japanese frame where the original public slots suffice. Every added descriptor must originate in an original computation, not the Japanese branch.")
    summaries = []
    total_sites = 0
    for index, bucket in enumerate(buckets, 1):
        entries, blockers, imported = [], Counter(), set()
        for ident in sorted(bucket["ids"]):
            rows = rows_by_id[ident]
            first = rows[0]
            english = first["english"]
            if any(any(r["english"][key] != english[key] for key in ("api", "literal", "format_semantics")) for r in rows[1:]):
                raise ValueError("ID has inconsistent original format/API")
            local_blockers = []
            try:
                converted, arguments, conversions = core.convert_printf(english["literal"], english["format_semantics"] == "printf-like")
                en = core.whole_message(english["api"], converted, "")[0]
            except ValueError as error:
                en, arguments, conversions = None, [], []
                local_blockers.append(str(error))
            if any(a["type"] == "floating-number" for a in arguments):
                local_blockers.append("Rust typed floating-number emission/format contract is not approved")
            native_sites = native_by_id[ident]
            if not native_sites:
                raise ValueError("No original native call")
            contracts = []
            for site in native_sites:
                bindings = site["argument_binding"]
                if len(bindings) != len(arguments) and english["format_semantics"] == "printf-like":
                    local_blockers.append("Original printf call's expression count differs from converted typed contract; preserve native evaluation and review before binding")
                arg_contracts = []
                for position, binding in enumerate(bindings):
                    source_literals = [{"source_literal_ordinal": ordinal, "english_source_literal": value,
                                        "source_expression_literal_start": start, "source_expression_literal_end": end}
                                       for ordinal, (value, start, end) in enumerate(helper.literals(scanner, binding["source_expression"]))]
                    arg_contracts.append({**binding, "typed_conversion": arguments[position] if position < len(arguments) else None,
                                          "source_literal_candidates": source_literals,
                                          "knowledge_guard": "Original visible argument only; any translated name/grammar/literal descriptor must be captured from this original producer once."})
                contracts.append({"source": site["source"], "line": site["line"], "api": site["api"],
                                  "function_candidate": site["function_candidate"], "format_argument_index": site["format_argument_index"],
                                  "original_argument_expressions": site["argument_expressions"], "arguments": arg_contracts,
                                  "source_evidence": helper.source_context(options.official_source, site, radius=10)})
            total_sites += len(contracts)
            local_blockers = sorted(set(local_blockers))
            blockers.update(local_blockers)
            imported.update(r["source"] for r in rows)
            entries.append({"id": ident, "source_translation_approved": False, "authoring_status": "awaiting-official-source-equivalent-Japanese-review",
                            "runtime_binding_approved": False, "runtime_integration": False,
                            "original_api": english["api"], "original_english_literal": english["literal"],
                            "english_whole_named_template": en, "original_format_semantics": english["format_semantics"],
                            "original_format_specifiers": english["format_specifiers"], "typed_arguments": arguments,
                            "printf_conversions": conversions, "typed_contract_review_blockers": local_blockers,
                            "official_source_contracts": contracts,
                            "required_helper_variants": sorted(core.variants(english["api"], english["literal"], "").keys()),
                            "pinned_japanese_evidence": [{"source": r["source"], "jp_block_line": r["jp_block_line"],
                                 "original_english_in_pinned_block": r["english"], "japanese_candidates": r["japanese_candidates"],
                                 "pinned_blob_sha256": r["pinned_blob_sha256"], "original_pairing_status": r["pairing_status"]} for r in rows]})
        provenance = {"official": {"pinned_commit": helper.OFFICIAL_PIN},
                      "jnethack": {"pinned_commit": helper.PIN, "origin": source["provenance"]["jnethack"]["origin"],
                                   "license": "NetHack General Public License", "authors": source["provenance"]["jnethack"]["authors"],
                                   "imported_paths": sorted(imported),
                                   "input_blobs": {p: source["provenance"]["jnethack"]["input_blobs"][p] for p in sorted(imported)}}}
        value = {"schema_version": 1, "batch": index, "purpose": f"nonoverlapping category-{options.category.upper()} official-equivalent authoring input; untranslated review queue",
                 "counts": {"distinct_official_ids": len(entries), "official_call_sites": sum(len(e["official_source_contracts"]) for e in entries),
                            "source_files": len(imported), "apis": dict(Counter(e["original_api"] for e in entries)),
                            "entries_with_typed_contract_review_blockers": sum(bool(e["typed_contract_review_blockers"]) for e in entries)},
                 "assigned_files": sorted(bucket["files"]), "author_instructions": common_instructions,
                 "output_fragment_path": f"category-{options.category}-batch-{index}.authored.json",
                 "output_entry_fields": ["id", "whole_message_ja", "source_translation_review_status", "translation_notes", "required_source_literal_translations", "requires_public_name_or_grammar_producer", "source_capture_constraints", "runtime_binding_approved:false"],
                 "runtime_integration": False, "translation_approved_count": 0, "provenance": provenance,
                 "frozen_phase3_sha256": protected, "entries": entries}
        path = HERE / f"category-{options.category}-batch-{index}.json"
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        summaries.append({"path": path.name, "sha256": sha(path), **value["counts"], "assigned_files": value["assigned_files"]})
    union = set().union(*(set(b["ids"]) for b in buckets))
    if union != target or sum(len(b["ids"]) for b in buckets) != len(target):
        raise ValueError("Batch identity union/overlap mismatch")
    if sum(len(b["files"]) for b in buckets) != len(ids_by_file):
        raise ValueError("Files overlap between authors")
    if {p: sha(ROOT / p) for p in protected} != protected:
        raise ValueError("Frozen inputs changed")
    summary = {"schema_version": 1, f"category_{options.category}_original_rows": len(category_c), f"category_{options.category}_original_distinct_ids": len(c_ids),
               "excluded_already_reviewed_ids": sorted(c_ids & approved), "excluded_reviewed_deferrals": sorted(c_ids & deferred),
               "excluded_frozen_ids": sorted(c_ids & frozen), "batch_distinct_ids": len(target), "official_call_sites": total_sites,
               "batch_ids_are_disjoint": True, "batch_files_are_disjoint": True, f"all_remaining_category_{options.category}_ids_assigned": True,
               "translation_approved_count": 0, "runtime_integration": False, "batches": summaries}
    (HERE / f"category-{options.category}-batches.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"remaining_distinct_ids": len(target), "batches": [{k: b[k] for k in ("path", "distinct_official_ids", "official_call_sites", "source_files", "entries_with_typed_contract_review_blockers")} for b in summaries]}))


if __name__ == "__main__":
    main()
