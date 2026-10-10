#!/usr/bin/env python3
"""Bounded source-flow review of dynamic formats; no core/catalog mutation."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

from importlib.util import spec_from_file_location, module_from_spec

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PIN = "25adee135c4bbd43ac8567664f600b565332435c"


def module(path, name):
    import sys
    spec = spec_from_file_location(name, path)
    value = module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


def sha(data):
    return hashlib.sha256(data).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def declaration(text, scanner, symbol):
    tokens = scanner.c_tokens(text)
    found = []
    for i, token in enumerate(tokens):
        if token.text != symbol or i + 4 >= len(tokens):
            continue
        if [t.text for t in tokens[i + 1:i + 4]] == ["[", "]", "="] and tokens[i + 4].kind == "string":
            literal = tokens[i + 4]
            found.append({"symbol": symbol, "english_literal": scanner.decode_c_string(literal.text),
                          "line": text[:token.start].count("\n") + 1,
                          "literal_start_offset": literal.start, "literal_end_offset": literal.end})
    if len(found) != 1:
        raise ValueError(f"Not one source array declaration: {symbol}")
    return found[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--official-source", type=Path, default=ROOT.parent / "official-source-audit/NetHack-5.0.0")
    parser.add_argument("--jnethack-checkout", type=Path, default=Path(r"C:\Users\kit\gameme\jnethack\jnethack\source"))
    opts = parser.parse_args()
    reviewed = module(HERE / "build-reviewed-translations.py", "phase4_review_reader")
    core = module(ROOT / "locales/build-gameplay-catalog.py", "phase4_dynamic_catalog_reader")
    scanner = module(ROOT / "tools/inventory_source.py", "phase4_dynamic_source_reader")
    manifest = json.loads((HERE / "source-pair-review.json").read_text("utf8"))
    frozen = {n: sha((ROOT / n).read_bytes()) for n in manifest["frozen_phase3_sha256"]}
    if frozen != manifest["frozen_phase3_sha256"]:
        raise ValueError("Frozen checkpoint differs")
    ledger = json.loads((ROOT / "catalog/source-text-messages.json").read_text("utf8"))["messages"]
    origins = json.loads((HERE / "dynamic-origin-review.json").read_text("utf8"))["rows"]
    official_bytes = (opts.official_source / "src/apply.c").read_bytes()
    text = official_bytes.decode("utf8")
    pinned = subprocess.check_output(["git", "-C", str(opts.jnethack_checkout), "show", f"{PIN}:src/apply.c"])
    jp_source = pinned.decode("utf8").replace("\r\n", "\n")
    if sha(pinned) != manifest["provenance"]["jnethack"]["input_blobs"]["src/apply.c"]["sha256"]:
        raise ValueError("Pinned Git blob differs")
    declarations = {name: declaration(text, scanner, name) for name in ("hollow_str", "whistle_str", "alt_whistle_str")}
    expected = {"hollow_str": "a hollow sound.  This must be a secret %s!",
                "whistle_str": "produce a %s whistling sound.",
                "alt_whistle_str": "produce a %s, sharp vibration."}
    for name, literal in expected.items():
        if declarations[name]["english_literal"] != literal:
            raise ValueError("Official constant changed")
    catalog = {"en": {}, "ja": {}}
    messages, fragments = [], {}
    plans = [
        ("use_stethoscope", [454, 460], "hollow_str", "うつろな音が聞こえた。秘密の{arg_1:%s}に違いない！", {"door": "扉", "passage": "通路"}),
        ("use_whistle", [486], "whistle_str", "{arg_1:%s}笛の音を立てた。", {"shrill": "耳をつんざくような", "high": "高い"}),
        ("use_magic_whistle", [507], "whistle_str", "{arg_1:%s}笛の音を立てた。", {"normal": "普通の", "strange, high-pitched": "奇妙で高い調子の", "strange": "奇妙な"}),
        ("use_magic_whistle", [507], "alt_whistle_str", "{arg_1:%s}鋭い振動を起こした。", {"normal": "普通の", "strange, high-pitched": "奇妙で高い調子の", "strange": "奇妙な"}),
    ]
    seen_origins = set()
    for function, lines, symbol, japanese, authored in plans:
        original_literal = declarations[symbol]["english_literal"]
        ident = scanner.semantic_candidate(f"nethack.message.apply.{function}.you_hear" if function == "use_stethoscope" else f"nethack.message.apply.{function}.you", original_literal)
        sites = [r for r in ledger if r["source"] == "src/apply.c" and r["line"] in lines]
        if len(sites) != len(lines) or any(r["english_source_template"] is not None for r in sites):
            raise ValueError("Not the original dynamic origin")
        if any(r["function_candidate"] != function for r in sites):
            raise ValueError("Original source function differs")
        for site in sites:
            seen_origins.add((site["source"], site["line"]))
        api = sites[0]["api"]
        eng, args, conversions = core.convert_printf(original_literal)
        eng, japanese = core.whole_message(api, eng, japanese)
        if core.names(eng) != core.names(japanese) or len(args) != 1 or args[0]["type"] != "text":
            raise ValueError("Dynamic printf source contract changed")
        fragment_ids = []
        source_literals = set()
        for site in sites:
            expression = site["argument_expressions"][site["format_argument_index"] + 1]
            for ordinal, (value, start, end) in enumerate(reviewed.literals(scanner, expression)):
                source_literals.add(value)
                if value not in authored:
                    raise ValueError("An original branch literal is untranslated")
                leaf_id = scanner.semantic_candidate(f"nethack.fragment.apply.{function}.arg_1.leaf_{ordinal}", value)
                if leaf_id in fragments:
                    if fragments[leaf_id]["english_source_literal"] != value or fragments[leaf_id]["japanese"] != authored[value]:
                        raise ValueError("Shared literal descriptor mismatch")
                    if site["line"] not in fragments[leaf_id]["native_call_lines"]:
                        fragments[leaf_id]["native_call_lines"].append(site["line"])
                else:
                    fragments[leaf_id] = {"id": leaf_id, "source": "src/apply.c", "native_call_lines": [site["line"]],
                                         "source_expression": expression, "source_literal_ordinal": ordinal,
                                         "source_expression_literal_start": start, "source_expression_literal_end": end,
                                         "english_source_literal": value, "japanese": authored[value],
                                         "runtime_binding_approved": False,
                                         "capture_contract": "source-selected original literal identity; original predicate evaluated once; no rendered-English matching"}
                    catalog["en"][leaf_id], catalog["ja"][leaf_id] = core.escape(value), core.escape(authored[value])
                if leaf_id not in fragment_ids:
                    fragment_ids.append(leaf_id)
        if source_literals != set(authored):
            raise ValueError("Authoring map exceeds original literal union")
        if ident in catalog["en"]:
            raise ValueError("Duplicate resolved message")
        catalog["en"][ident], catalog["ja"][ident] = eng, japanese
        messages.append({"id": ident, "source_translation_approved": True, "source_origin_resolution_approved": True,
                         "runtime_binding_approved": False, "runtime_integration": False,
                         "identity_status": "new source-resolved semantic ID; original dynamic inventory ID was null",
                         "whole_message_en": eng, "whole_message_ja": japanese, "original_api": api,
                         "definition": declarations[symbol], "original_format_expressions": [s["format_expression"] for s in sites],
                         "arguments": args, "printf_conversions": conversions, "source_selected_literal_ids": fragment_ids,
                         "source_evidence": [reviewed.source_context(opts.official_source, s) for s in sites],
                         "format_selection_contract": "For Deaf ? alt_whistle_str : whistle_str, tag the original selected format in the original expression; do not recall Deaf in presentation.",
                         "origin_proof": "A file-static const character array is never overwritten; original calls directly use that symbol or select between the two immutable symbols.",
                         "knowledge_guard": "capture only original selected format/argument literal identities; preserve original source branch and RNG work exactly once",
                         "japanese_origin": "human-authored official-English-equivalent adaptation after pinned source review",
                         "authored_date": "2026-10-02"})
        for variant, (ven, vja) in core.variants(api, original_literal, japanese).items():
            # The native English prefix comes from the original helper. Convert
            # the variant's printf arguments after prefix selection.
            catalog["en"][f"variant.{variant}.{ident}"] = core.convert_printf(ven)[0]
            catalog["ja"][f"variant.{variant}.{ident}"] = vja
    defers = []
    review_cases = [
        ("src/allmain.c", 738, "no-visible-title", "end_menu(WIN_INVEN, (char *) 0) has a null title; retain native menu semantics and clear any prior text sidecar. Do not invent a translated empty message."),
        ("src/alloc.c", 65, "declaration-not-runtime-emission", "This lexical candidate is a panic function declaration, not a runtime visible message call. Exclude from semantic emission approval."),
        ("src/allmain.c", 914, "requires-composite-producer-context", "The new_game branch selects distinct welcome formats with greeting/player/role/race/gender composition. Resolve original visible descriptors once before approving JA; no role/name helper recall."),
        ("src/apply.c", 1064, "requires-semantic-color-producer", "Original hcolor(NULL) can select a hallucination color. Capture its actual selected public identity at that call; Japanese hcolor or RNG must not run again."),
    ]
    for source, line, status, reason in review_cases:
        matches = [r for r in origins if r["source"] == source and r["line"] == line]
        if len(matches) != 1:
            raise ValueError("Dynamic review case not in original ledger")
        defers.append({"review_status": status, "reason": reason, "source_translation_approved": False,
                       "runtime_binding_approved": False, "original_origin": matches[0],
                       "source_evidence": reviewed.source_context(opts.official_source, matches[0])})
    # Exact pinned excerpts retain translated declaration/branch authorship.
    jp_lines = jp_source.splitlines()
    jp_evidence = [{"source": "src/apply.c", "start_line": a, "end_line": b,
                    "text": "\n".join(f"{i}: {jp_lines[i - 1]}" for i in range(a, b + 1))}
                   for a, b in [(422, 425), (647, 653), (675, 678), (707, 717)]]
    metadata = {"schema_version": 1, "purpose": "separate bounded dynamic-format source review; no runtime integration",
                "counts": {"source_resolved_message_ids": len(messages), "approved_dynamic_origin_sites": len(seen_origins),
                           "source_literal_fragment_ids": len(fragments), "helper_variant_ids": sum(k.startswith("variant.") for k in catalog["en"]),
                           "catalog_ids_per_locale": len(catalog["en"]), "non_visible_or_declaration_origins": 2,
                           "missing_context_origins": 2, "runtime_binding_approved_ids": 0},
                "runtime_integration": False, "full_japanese_gameplay": False, "frozen_phase3_sha256": frozen,
                "provenance": {"official": {"pinned_commit": reviewed.OFFICIAL_PIN, "src_apply_blob_sha256": sha(official_bytes)},
                               "jnethack": {"pinned_commit": PIN, "origin": manifest["provenance"]["jnethack"]["origin"],
                                            "license": "NetHack General Public License", "authors": manifest["provenance"]["jnethack"]["authors"],
                                            "imported_paths": ["src/apply.c"], "input_blobs": {"src/apply.c": manifest["provenance"]["jnethack"]["input_blobs"]["src/apply.c"]}}},
                "entries": messages, "source_literal_fragments": list(fragments.values()),
                "rejected_or_missing_context": defers, "pinned_japanese_evidence": jp_evidence,
                "remaining_core_dynamic_origin_candidates": 963 - len(seen_origins) - len(defers),
                "guards": ["The 963 count is lexical inventory candidates; reviewed declarations/null titles do not become gameplay message coverage.",
                           "Keep original C text when any required source format/literal identity is unavailable.",
                           "No format string, completed English text, source predicate, name helper, native state, or RNG is evaluated in a renderer."]}
    if {n: sha((ROOT / n).read_bytes()) for n in frozen} != frozen:
        raise ValueError("Frozen checkpoint was mutated")
    dump(HERE / "reviewed-dynamic-translations.json", catalog)
    dump(HERE / "reviewed-dynamic-translations.metadata.json", metadata)
    print(json.dumps(metadata["counts"]))


if __name__ == "__main__":
    main()
