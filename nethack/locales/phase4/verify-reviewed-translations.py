#!/usr/bin/env python3
"""Verify proposed emission contracts against the unchanged source ledger."""
import hashlib
import json
from pathlib import Path

from importlib.util import spec_from_file_location, module_from_spec

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def read(name):
    return json.loads((HERE / name).read_text("utf8"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    import sys
    spec = spec_from_file_location("phase4_verification_core", ROOT / "locales/build-gameplay-catalog.py")
    core = module_from_spec(spec)
    sys.modules[spec.name] = core
    spec.loader.exec_module(core)
    literal_catalog, literal_meta = read("reviewed-translations.json"), read("reviewed-translations.metadata.json")
    dynamic_catalog, dynamic_meta = read("reviewed-dynamic-translations.json"), read("reviewed-dynamic-translations.metadata.json")
    ledger = json.loads((ROOT / "catalog/source-text-messages.json").read_text("utf8"))["messages"]
    all_ids = {r["english_id_candidate"] for r in ledger if r["english_id_candidate"]}
    core_ids = {r["english_id_candidate"] for r in ledger if r["source"].startswith("src/") and r["english_id_candidate"]}
    frozen_catalog = json.loads((ROOT / "locales/gameplay-core.json").read_text("utf8"))
    baseline = {i for i in frozen_catalog["en"] if i.startswith("nethack.message.")}
    plans, catalogs = [], [literal_catalog, dynamic_catalog]
    checks = []
    def check(condition, label):
        if not condition:
            raise AssertionError(label)
        checks.append(label)
    check(literal_meta["frozen_phase3_sha256"] == dynamic_meta["frozen_phase3_sha256"], "one identical frozen checkpoint")
    check(all(sha(ROOT / p) == value for p, value in literal_meta["frozen_phase3_sha256"].items()), "all 12 frozen catalogs, builders and inventories remain byte-identical")
    check(set(literal_catalog["en"]) == set(literal_catalog["ja"]) and set(dynamic_catalog["en"]) == set(dynamic_catalog["ja"]), "paired language key sets")
    check(not (set(literal_catalog["en"]) & set(dynamic_catalog["en"])), "separate proposals have no duplicate IDs")
    check(not ((set(literal_catalog["en"]) | set(dynamic_catalog["en"])) & set(frozen_catalog["en"])), "proposal does not replace frozen entries")
    check(all(core.names(c["en"][i]) == core.names(c["ja"][i]) for c in catalogs for i in c["en"]), "every proposed frame retains the exact English argument-name set")
    check(max(len(i.encode("ascii")) for c in catalogs for i in c["en"]) <= 160, "all English semantic IDs fit the Rust ID bound")
    check(all(len(t.encode("utf8")) <= 65536 for c in catalogs for lang in ("en", "ja") for t in c[lang].values()), "all templates fit the Rust text bound")
    for e in literal_meta["entries"]:
        sites = [r for r in ledger if r["english_id_candidate"] == e["id"]]
        check(bool(sites), f"exact original literal ID: {e['id']}")
        for a in e["arguments"]:
            position = int(a["name"].removeprefix("arg_")) - 1
            check(any(r["argument_binding"][position]["source_expression"] == a["source_expression"] for r in sites), f"original public argument: {e['id']}/{a['name']}")
        check(all(not r["runtime_binding_approved"] for r in [e]), f"source approval remains distinct from runtime: {e['id']}")
        plans.append({"id": e["id"], "original_api": e["original_api"], "native_sites": [{"source": c["source"], "line": c["line"]} for c in e["source_evidence"]],
                      "original_arguments": [{"name": a["name"], "source_expression": a["source_expression"], "native_type": a["type"],
                                              "source_specifier": a["source_format_specifier"], "presentation_type": a["presentation_argument_type"]} for a in e["arguments"]],
                      "source_contract_status": e["source_contract_status"], "source_literal_ids": e["source_selected_literal_ids"],
                      "raw_visible_fallback_arguments": e["raw_visible_fallback_arguments"],
                      "runtime_binding_approved": False})
    # The numeric alignment diagnostic retains only the two original integers;
    # it does not add a Japanese-only attribute/entity query.
    quest = next(e for e in literal_meta["entries"] if e["id"].endswith("a07d6abc76"))
    check([a["type"] for a in quest["arguments"]] == ["integer", "integer"] and len(quest["arguments"]) == 2, "alignment diagnostic retains the exact two original integer slots")
    restore = next(e for e in literal_meta["entries"] if e["id"].endswith("512eb0ddc3"))
    check("地下" not in restore["whole_message_ja"] and "{arg_1:%d}" in restore["whole_message_ja"], "restore depth preserves numeric level without inventing underground semantics")
    punct = [e for e in literal_meta["entries"] if any(c["conversion"] == "c" for c in e["printf_conversions"])]
    check(len(punct) == 2 and all("%c}" in e["whole_message_ja"] for e in punct), "both original integer-byte punctuation slots are preserved as %c")
    hear = next(e for e in literal_meta["entries"] if e["id"].endswith("0d45a181dc"))
    check(hear["original_api"] == "You" and not any("variant." + v + "." + hear["id"] in literal_catalog["en"] for v in ("dream", "underwater")), "hear-nothing call preserves You helper, not You_hear")
    check(all(e["id"] not in literal_catalog["ja"] for e in literal_meta["rejected_or_missing_context"]), "rejected/unknown producer contracts cannot silently gain JA frames")
    check(dynamic_meta["counts"]["approved_dynamic_origin_sites"] == 4 and len(dynamic_meta["entries"]) == 4, "four static-format native origins produce four source-resolved IDs")
    check(sum(e["review_status"] in ("no-visible-title", "declaration-not-runtime-emission") for e in dynamic_meta["rejected_or_missing_context"]) == 2, "null title and declaration are excluded from semantic emission coverage")
    literal_new = {e["id"] for e in literal_meta["entries"]}
    pair_queue = read("source-pair-review.json")
    queue_ids = {i for r in pair_queue["rows"] for i in r["official_ids"]} - baseline
    deferred_ids = {e["id"] for e in literal_meta["rejected_or_missing_context"]}
    counts = {"core_distinct_literal_ids": len(core_ids), "all_tree_distinct_literal_ids": len(all_ids),
              "frozen_core_message_ids_with_JA_catalog_templates": len(baseline & core_ids),
              "new_reviewed_core_literal_ids": len(literal_new & core_ids),
              "source_template_covered_core_literal_ids_if_proposal_integrated": len((baseline | literal_new) & core_ids),
              "core_literal_ids_without_JA_template_after_proposal": len(core_ids - baseline - literal_new),
              "all_tree_literal_ids_without_JA_template_after_proposal": len(all_ids - baseline - literal_new),
              "pending_pair_queue_distinct_not_frozen_ids": len(queue_ids),
              "pending_pair_queue_ids_remaining_unreviewed": len(queue_ids - literal_new - deferred_ids),
              "core_dynamic_origin_candidates": 963, "new_reviewed_dynamic_origin_sites": 4,
              "dynamic_non_visible_or_declaration_origins": 2, "dynamic_origins_reviewed_but_missing_context": 2,
              "dynamic_origin_candidates_remaining_unreviewed": 955,
              "new_message_ids_proposed_total": len(literal_new) + len(dynamic_meta["entries"]),
              "new_argument_fragment_ids": len(literal_meta["source_literal_fragments"]) + len(dynamic_meta["source_literal_fragments"]),
              "new_helper_variant_ids": literal_meta["counts"]["helper_variant_ids"] + dynamic_meta["counts"]["helper_variant_ids"],
              "new_catalog_ids_total_per_locale": sum(len(c["en"]) for c in catalogs),
              "runtime_verified_new_ids": 0}
    integration = {"schema_version": 1, "runtime_integration": False, "counts": counts,
                   "source_only_literal_proposals": plans,
                   "source_only_dynamic_proposals": dynamic_meta["entries"],
                   "rejected_or_missing_context": literal_meta["rejected_or_missing_context"] + dynamic_meta["rejected_or_missing_context"],
                   "required_sequence": [
                       "Finish and retain current phase-three local Rust/Node/browser QA before changing its catalog/native artifact.",
                       "Add 14 direct wrappers using each exact original C argument once and the immutable original helper context; preserve native English fallback.",
                       "Bind 24 literal-dependent messages and four resolved dynamic formats at original producer positions; capture selected source identity plus original public value without re-evaluating predicates, naming, or RNG.",
                       "Add the reviewed paired proposal files to a separate source checkpoint, retaining pinned NGPL notices; do not rewrite frozen catalog inputs during QA.",
                       "Validate original-vs-instrumented native state/RNG, printf contracts, C/Lua build, Rust formatter, Node/browser locale repaint and native-English fallback before reporting runtime coverage.",
                       "Review the 997 remaining pinned-pair IDs first, then source-author remaining official literals and resolve dynamic origin/formatter branches with immutable source descriptors.",
                       "Audit other dat/help/rumor/lore/menu surfaces and source-selected public name/grammar producers; catalog templates alone do not prove complete Japanese gameplay."],
                   "full_japanese_gameplay": False,
                   "guard": "The source-covered counts are template proposals, not native/runtime/browser verified coverage. Dynamic totals include lexical nonmessage candidates."}
    report = {"schema_version": 1, "verification": "passed", "checks_passed": len(checks), "checks": checks,
              "counts": counts, "frozen_inputs_sha256": literal_meta["frozen_phase3_sha256"],
              "proposal_sha256": {name: sha(HERE / name) for name in ("reviewed-translations.json", "reviewed-translations.metadata.json", "reviewed-dynamic-translations.json", "reviewed-dynamic-translations.metadata.json")},
              "runtime_verified": False}
    for name, value in [("integration-plan.json", integration), ("reviewed-verification.json", report)]:
        (HERE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"checks_passed": len(checks), "counts": counts}))


if __name__ == "__main__":
    main()
