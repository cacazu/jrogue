#!/usr/bin/env python3
"""Build and verify source-grounded EN/JA templates; no runtime text matching."""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CATALOG = ROOT.parent / "catalog/source-text-messages.json"
FRAGMENTS = [ROOT / "seed-core.json", ROOT / "seed-hack.json", ROOT / "seed-eat.json",
             ROOT.parent / "tools/source-seed-fragments/combat-inventory-detection-extra.json"]
PRINTF = re.compile(r"%(?:(\d+)\$)?([-+ #0']*)(\*|\d+)?(?:\.(\*|\d+))?(hh|ll|[hljztL])?([diuoxXfFeEgGaAcspn%])")
HELPER_PREFIXES = {"You": "You ", "You1": "You ", "Your": "Your ", "Your1": "Your ", "You_cant": "You can't ", "You_feel": "You feel ", "You_hear": "You hear ", "You_hear1": "You hear ", "You_see": "You see ", "There": "There ", "pline_The": "The "}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, document) -> None:
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def tokens(template: str, printf_like: bool) -> list[str]:
    return [match.group() for match in PRINTF.finditer(template)] if printf_like else []


def argument_schema(template: str, printf_like: bool) -> list[dict]:
    result = []
    if not printf_like:
        return result
    for match in PRINTF.finditer(template):
        position, _, width, precision, length, conversion = match.groups()
        if conversion == "%":
            continue
        if position:
            raise ValueError("Positional C printf arguments need explicit source review; no silent reindexing")
        for purpose, value in (("width", width), ("precision", precision)):
            if value == "*":
                result.append({"name": f"arg_{len(result)+1}", "type": "signed-integer", "printf_token": match.group(), "purpose": purpose, "c_length_modifier": ""})
        if conversion in "di":
            kind = "signed-integer"
        elif conversion in "uoxX":
            kind = "unsigned-integer"
        elif conversion in "fFeEgGaA":
            kind = "floating-number"
        elif conversion == "s":
            kind = "string"
        elif conversion == "c":
            kind = "character-promoted-to-int"
        else:
            raise ValueError(f"Pointer/write-back format not admitted to this display seed: {match.group()}")
        result.append({"name": f"arg_{len(result)+1}", "type": kind, "printf_token": match.group(), "purpose": "value", "c_length_modifier": length or "", "semantic_entity_type": "requires-source-instrumentation-review" if conversion == "s" else None})
    return result


def build() -> dict:
    original_catalog_hash = sha(CATALOG)
    catalog = load(CATALOG)
    calls = catalog["messages"]
    by_location = defaultdict(list)
    by_id = defaultdict(list)
    for message in calls:
        by_location[(message["source"], message["line"])].append(message)
        if message["english_id_candidate"] is not None:
            by_id[message["english_id_candidate"]].append(message)
    merged = {}
    for fragment in FRAGMENTS:
        for authored in load(fragment):
            candidates = [m for m in by_location[(authored["source"], authored["line"])] if m["english_source_template"] == authored["en"] and ("api" not in authored or m["api"] == authored["api"]) and ("id" not in authored or m["english_id_candidate"] == authored["id"])]
            if len(candidates) != 1:
                raise ValueError(f"Authored row must match one exact source call: {fragment.name} {authored['source']}:{authored['line']} ({len(candidates)} matches)")
            message = candidates[0]
            identity = message["english_id_candidate"]
            if not identity or not identity.startswith("nethack.message."):
                raise ValueError("Every entry must retain its exact English semantic candidate ID")
            if not authored["ja"] or authored["en"] == authored["ja"] or not re.search(r"[\u3040-\u30ff\u3400-\u9fff]", authored["ja"]):
                raise ValueError(f"Missing actual Japanese translation: {identity}")
            printf_like = message["format_semantics"] == "printf-like"
            if tokens(authored["en"], printf_like) != tokens(authored["ja"], printf_like):
                raise ValueError(f"Printf token/order mismatch: {identity}")
            schema = argument_schema(authored["en"], printf_like)
            if len(schema) != len(message["argument_binding"]):
                raise ValueError(f"Typed argument count differs from source expressions: {identity}")
            if [t for t in tokens(authored["en"], printf_like) if t != "%%"] != message["format_specifiers"]:
                raise ValueError(f"Printf contract differs from source inventory: {identity}")
            if identity in merged:
                if (merged[identity]["en"], merged[identity]["ja"]) != (authored["en"], authored["ja"]):
                    raise ValueError(f"Conflicting translations for repeated source ID: {identity}")
                continue
            sites = []
            for occurrence in by_id[identity]:
                if occurrence["english_source_template"] != authored["en"]:
                    raise ValueError(f"English candidate ID collision: {identity}")
                sites.append({key: occurrence[key] for key in ("source", "line", "function_candidate", "api", "format_argument_index", "argument_expressions", "argument_binding")})
            merged[identity] = {"id": identity, "en": authored["en"], "ja": authored["ja"], "source_call_sites": sites, "format_semantics": message["format_semantics"], "printf_specifiers": message["format_specifiers"], "typed_arguments": schema, "english_helper_prefix": HELPER_PREFIXES.get(message["api"]), "helper_rendering_requirement": "emit-and-render-the-whole-semantic-message-with-locale-aware-helper-context" if message["api"] in HELPER_PREFIXES else "direct-semantic-template", "argument_value_localization_required": any(a["type"] == "string" for a in schema), "notes": authored.get("notes", []), "runtime_integration": False, "review_status": "codex-authored-source-reviewed-translation-seed"}
    if not 150 <= len(merged) <= 483:
        raise ValueError(f"Expected bounded 150-483 entry seed; got {len(merged)}")
    english = {identity: row["en"] for identity, row in sorted(merged.items())}
    japanese = {identity: row["ja"] for identity, row in sorted(merged.items())}
    write(ROOT / "source-seed.en.json", english)
    write(ROOT / "source-seed.ja.json", japanese)
    write(ROOT / "source-seed.metadata.json", {"schema_version": 1, "source_tree": catalog["source_tree"], "source_catalog_sha256": original_catalog_hash, "runtime_integration": False, "contract_status": "printf-types-and-source-expressions-preserved-semantic-entity-binding-not-yet-integrated", "entries": [merged[identity] for identity in sorted(merged)]})
    if load(ROOT / "source-seed.en.json").keys() != load(ROOT / "source-seed.ja.json").keys():
        raise AssertionError("Serialized EN/JA keys differ")
    if sha(CATALOG) != original_catalog_hash:
        raise AssertionError("Source inventory changed while generating translations")
    literal_ids = {m["english_id_candidate"] for m in calls if m["english_id_candidate"] is not None}
    status = {"schema_version": 1, "result": "pass", "source_tree": catalog["source_tree"], "source_catalog_sha256": original_catalog_hash, "english_seed_entries": len(english), "japanese_seed_entries": len(japanese), "selected_exact_source_candidate_ids": len(merged), "source_call_occurrences_referenced": sum(len(row["source_call_sites"]) for row in merged.values()), "seed_no_argument_entries": sum(not row["typed_arguments"] for row in merged.values()), "seed_with_argument_entries": sum(bool(row["typed_arguments"]) for row in merged.values()), "seed_entries_requiring_argument_value_localization": sum(row["argument_value_localization_required"] for row in merged.values()), "entries_by_source_file": dict(sorted(Counter(row["source_call_sites"][0]["source"] for row in merged.values()).items())), "all_tree_literal_format_call_candidates": catalog["counts"]["message_literal_formats_resolved_all_tree"], "all_tree_unique_literal_candidate_ids": len(literal_ids), "literal_candidate_ids_not_selected_by_seed": len(literal_ids-set(merged)), "all_tree_dynamic_format_call_candidates_unresolved": catalog["counts"]["message_dynamic_formats_unresolved_all_tree"], "runtime_integration": False, "runtime_localized_message_count": 0, "full_japanese_coverage": False, "authorship": "Codex-authored Japanese seed reviewed against exact upstream source literals; not a claim of independent human review", "validation": {"exact_source_ids_preserved": True, "exact_english_literals_preserved": True, "source_locations_apis_and_arguments_preserved": True, "english_japanese_key_sets_match": True, "ordered_printf_specifiers_and_argument_types_match": True, "all_selected_values_contain_japanese_translation": True, "source_catalog_unchanged": True, "runtime_rendered_english_reverse_mapping": False}, "remaining_work": ["Instrument original C source emission with semantic IDs before formatting.", "Bind visible entity/action/color/body-part arguments without inferring identity from completed English.", "Review complete helper messages and locale-specific grammar at runtime.", "Review all unselected source surfaces and unresolved dynamic formats with explicit dispositions.", "Run actual Japanese gameplay, prompt/menu/save/restore and hidden-knowledge tests."], "artifact_sha256": {name: sha(ROOT/name) for name in ("source-seed.en.json", "source-seed.ja.json", "source-seed.metadata.json")}, "authored_fragment_sha256": {fragment.name: sha(fragment) for fragment in FRAGMENTS}, "builder_sha256": sha(Path(__file__))}
    write(ROOT / "translation-status.json", status)
    return status


if __name__ == "__main__":
    print(json.dumps(build(), indent=2))
