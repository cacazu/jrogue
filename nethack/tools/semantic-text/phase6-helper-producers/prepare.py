"""Generate isolated selected-public-helper inspection fixtures (NGPL).

No apply/compiler/browser/runtime command exists. All writes stay in this
directory; public transforms accept pristine or otherwise composed source.
Native source selection is preserved; no English-byte-to-ID lookup is emitted.
"""
from __future__ import annotations

import argparse
from collections import Counter
import difflib
import hashlib
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
PHASE = Path(__file__).resolve().parent
ROOT = PHASE.parents[2]
UPSTREAM = ROOT / "upstream/NetHack-5.0.0"
COMMIT = "16ff59115315917b93185d026aeefea06db9b0f4"
PINNED = {
    "src/do_name.c": "64c6cb5e7f4034e9edbd8fac983b313a7df0e029b4812bd3a9327852d12ad9d1",
    "src/polyself.c": "2f2f3dc74c2cbdd122f7a1401bd3e4e77efbc37ff6c499371cb8e57c9e39a5c8",
    "src/mondata.c": "c7a19d003c169fed7dde555ecad9069627f059309142b7d8104314572f90a685",
    "src/weapon.c": "75769f6a3113224ea20414f75fc8b1159b6712bc7154905443e4fc1a4912bc2d",
    "include/hack.h": "2840a9bd41fb0c09384839fafdbd427a5d8705ad8d3eb5e2a0308cccea36813b",
    "src/hacklib.c": "9f9710dcd8fe0b3735c0b319eb7c26b7fb4148d32a5851ffe72ed94c3bbfeae2",
    "src/objnam.c": "445d0b8697ceeb93f1249599b16caffb101a832ee425d76f9eb3fd65088f1dd3",
    "include/decl.h": "4782c5f522f6de63503cda131c0e2485aef31506d83dcfb32defeebf984fb470",
    "include/you.h": "d19cfa0233582f1ad550b9dfc788f26166f3ff21225e3d8a0cd43b6de2094289",
    "src/role.c": "d6f9341da2a6dff5197442f78cb322c8b22437c95646c44350810fbc058f25a8",
}
PRONOUN_FIELDS = {"he": ("pronoun_subject", "NH_PHASE6_PRONOUN_SUBJECT"),
                  "him": ("pronoun_object", "NH_PHASE6_PRONOUN_OBJECT"),
                  "his": ("pronoun_possessive", "NH_PHASE6_PRONOUN_POSSESSIVE")}
PRONOUN_MACROS = ("uhe", "uhim", "uhis", "mhe", "mhim", "mhis",
                  "noit_mhe", "noit_mhim", "noit_mhis")
LEX = re.compile(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_]\w*|\d+|\S', re.S)
STRING = re.compile(r'"(?:\\.|[^"\\])*"')
TABLE_SPECS = {
    "src/polyself.c": [(name + "_parts", "body", 19) for name in (
        "humanoid", "jelly", "animal", "bird", "horse", "sphere", "fungus",
        "vortex", "snake", "worm", "spider", "fish")],
    "src/do_name.c": [("hcolors", "color", 74), ("hliquids", "liquid", 40)],
    "src/mondata.c": [(name, "motion", 4) for name in (
        "levitate", "flys", "flyl", "slither", "ooze", "immobile", "crawl")],
    "src/weapon.c": [("odd_skill_names", "skill", 15),
                     ("barehands_or_martial", "skill", 2)],
}


def sha(value: str | bytes) -> str:
    return hashlib.sha256(value.encode("utf-8") if isinstance(value, str) else value).hexdigest()


def strict_json(path: Path) -> dict:
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError(f"Duplicate JSON key {key!r} in {path}")
            result[key] = value
        return result
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs)


def mask_comments(text: str) -> str:
    return LEX.sub(lambda m: re.sub(r"[^\n]", " ", m.group())
                   if m.group().startswith(("/*", "//")) else m.group(), text)


def tokens(text: str) -> list[str]:
    return [m.group() for m in LEX.finditer(text)
            if not m.group().startswith(("/*", "//"))]


def function_span(text: str, name: str) -> tuple[int, int]:
    """Select an exact original function body, without touching other calls."""
    pattern = re.compile(r"(?m)^" + re.escape(name) + r"\(")
    found = list(pattern.finditer(mask_comments(text)))
    if len(found) != 1:
        raise ValueError(f"Expected one definition for {name}: {len(found)}")
    start = found[0].start()
    opening = text.index("{", start)
    depth = 0
    for m in LEX.finditer(text, opening):
        if m.group() == "{": depth += 1
        elif m.group() == "}":
            depth -= 1
            if not depth: return start, m.end()
    raise ValueError(f"Unbalanced {name}")


def table_entries(text: str, source: str, name: str, family: str) -> list[dict]:
    masked = mask_comments(text)
    anchor = re.search(r"\b" + re.escape(name) + r"\s*(?:\[\s*\])?\s*=\s*\{", masked)
    if not anchor:
        raise ValueError(f"Missing original table {name}")
    opening = masked.index("{", anchor.start())
    closing = masked.index("}", opening)
    expression = text[opening:closing + 1]
    lexical = mask_comments(expression)
    entries = []
    for ordinal, match in enumerate(STRING.finditer(lexical)):
        original = expression[match.start():match.end()]
        entries.append({
            "source": source, "source_blob_sha256": PINNED[source],
            "table": name, "table_index": ordinal, "family": family,
            "producer_expression": expression,
            "producer_declaration_start_line": text.count("\n", 0, anchor.start()) + 1,
            "line": text.count("\n", 0, opening + match.start()) + 1,
            "source_literal_ordinal": ordinal,
            "source_literal_start_offset": match.start(),
            "source_literal_end_offset": match.end(),
            "original_literal_token": original,
            "english": json.loads(original),
            "role": "selected-output-literal",
            "runtime_binding_approved": False,
        })
    return entries


def gender_entries(text: str) -> dict[str, list[dict]]:
    """Original public pronoun columns only; never publish row/gender metadata."""
    source = "src/role.c"
    start = text.index("const struct Gender genders[] = {")
    end = text.index("\n};", start)
    declaration = text[start:end]
    rows = list(re.finditer(r"\{[^{}]*\}", mask_comments(declaration)))
    if len(rows) != 4: raise ValueError("Expected four original public pronoun rows")
    result = {"genders_" + field: [] for field in PRONOUN_FIELDS}
    for row_index, row in enumerate(rows):
        expression = declaration[row.start():row.end()]
        literals = list(STRING.finditer(mask_comments(expression)))
        if len(literals) != 5: raise ValueError("Original Gender literal field layout changed")
        for literal_index, (field, (family, _)) in enumerate(PRONOUN_FIELDS.items(), 1):
            literal = literals[literal_index]
            token = expression[literal.start():literal.end()]
            record = {
                "source": source, "source_blob_sha256": PINNED[source],
                "table": "genders", "table_index": row_index,
                "selected_public_field": field, "family": family,
                "producer_expression": expression,
                "producer_declaration_start_line": text.count("\n", 0, start + row.start()) + 1,
                "line": text.count("\n", 0, start + row.start() + literal.start()) + 1,
                "source_literal_ordinal": literal_index,
                "source_literal_start_offset": literal.start(),
                "source_literal_end_offset": literal.end(),
                "original_literal_token": token, "english": json.loads(token),
                "role": "selected-output-literal", "runtime_binding_approved": False,
            }
            result["genders_" + field].append(record)
    return result


def macro(text: str, name: str) -> str:
    anchor = "#define " + name + "("
    if text.count(anchor) != 1: raise ValueError("Expected exact original macro " + name)
    start = end = text.index(anchor)
    while True:
        stop = text.find("\n", end)
        if stop < 0: return text[start:]
        if not text[end:stop].endswith("\\"): return text[start:stop]
        end = stop + 1


def semantic_id(family: str, english: str) -> str:
    if family == "plural":
        key = "one" if not english else "many"
    else:
        key = re.sub(r"[^a-z0-9]+", "_", english.lower()).strip("_")
        if english[:1].isupper(): key += "_capitalized"
    return f"nethack.helper.{family}.{key}"


def deferred(authored: dict, family: str, english: str) -> bool:
    return english in authored.get("deferred_literals", {}).get(family, {})


def leaf_id(authored: dict, family: str, english: str) -> str | None:
    if english not in authored[family]:
        raise ValueError(f"Missing Japanese leaf {family}/{english!r}")
    return None if deferred(authored, family, english) else semantic_id(family, english)


def once(text: str, old: str, new: str, operations: list[dict], source: str,
         contract: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f"Expected one original anchor for {contract}: {old!r}")
    operations.append({"source": source, "source_contract": contract,
                       "original": old, "replacement": new,
                       "runtime_binding_approved": False})
    return text.replace(old, new, 1)


def wrapped_table(kind: str, name: str, index: str, tables: dict) -> str:
    return (f"nh_phase6_selected_table({kind}, {name}, nh_phase6_ids_{name}, "
            f"{len(tables[name])}, {index})")


def literal_evidence(text: str, source: str, name: str, family: str,
                     authored: dict) -> list[dict]:
    a, b = function_span(text, name)
    body = text[a:b]
    masked = mask_comments(body)
    ret = re.compile(r"\breturn\s+(.*?);", re.S)
    evidence = []
    for branch, match in enumerate(ret.finditer(masked)):
        expression = body[match.start(1):match.end(1)]
        for ordinal, literal in enumerate(STRING.finditer(mask_comments(expression))):
            token = expression[literal.start():literal.end()]
            english = json.loads(token)
            leaf_id(authored, family, english)
            evidence.append({
                "source": source, "source_blob_sha256": PINNED[source],
                "function": name, "return_branch_ordinal": branch,
                "family": family, "producer_expression": expression,
                "producer_declaration_start_line": text.count("\n", 0, a + match.start(1)) + 1,
                "line": text.count("\n", 0, a + match.start(1) + literal.start()) + 1,
                "source_literal_ordinal": ordinal,
                "source_literal_start_offset": literal.start(),
                "source_literal_end_offset": literal.end(),
                "original_literal_token": token, "english": english,
                "role": "selected-output-literal", "runtime_binding_approved": False,
            })
    return evidence


def add_includes(text: str, source: str, operations: list[dict]) -> str:
    return once(text, '#include "hack.h"',
                '#include "hack.h"\n#include "nh-phase6-helper.h"\n'
                '#include "nh-phase6-helper-labels.h"',
                operations, source, "isolated-helper-headers")


def transform_source(text: str, source: str, tables: dict, authored: dict
                     ) -> tuple[str, list[dict]]:
    """Pure composition API. Does not read/write caller source or game state."""
    if "nh_phase6_selected_" in text or "nh_phase6_plur_value" in text:
        raise ValueError("Phase 6 source hooks already present")
    changed, operations = text, []
    if source == "src/polyself.c":
        a, b = function_span(changed, "mbodypart")
        body = changed[a:b]
        masked = mask_comments(body)
        ret = re.compile(r"\breturn\s+(.*?);", re.S)
        replacements = []
        for match in ret.finditer(masked):
            old = body[match.start(1):match.end(1)]
            new = old
            for table in [n for n in tables if n.endswith("_parts")]:
                new = re.sub(r"\b" + table + r"\[part\]",
                             lambda _: wrapped_table("NH_PHASE6_BODY", table, "part", tables), new)
            # Only literals in actual return expressions; predicate strings,
            # comments and diagnostic format text never become public leaves.
            new = STRING.sub(lambda m: "nh_phase6_selected_const(NH_PHASE6_BODY, "
                             + m.group() + ", "
                             + json.dumps(leaf_id(authored, "body", json.loads(m.group())))
                             + ")", new)
            if new == old:
                raise ValueError(f"Uncovered mbodypart return {old}")
            replacements.append((match.start(1), match.end(1), old, new))
        for start, end, old, new in reversed(replacements):
            body = body[:start] + new + body[end:]
            operations.append({"source": source, "source_contract": "mbodypart.selected-return",
                               "original": old, "replacement": new,
                               "runtime_binding_approved": False})
        changed = changed[:a] + body + changed[b:]
        changed = add_includes(changed, source, operations)
    elif source == "src/do_name.c":
        changed = once(changed, "hcolors[rn2_on_display_rng(SIZE(hcolors))]",
                       wrapped_table("NH_PHASE6_COLOR", "hcolors",
                                     "rn2_on_display_rng(SIZE(hcolors))", tables),
                       operations, source, "hcolor.original-selected-display-rng-index")
        changed = once(changed, "return hliquids[indx];",
                       "return " + wrapped_table("NH_PHASE6_LIQUID", "hliquids", "indx", tables) + ";",
                       operations, source, "hliquid.original-selected-index")
        changed = add_includes(changed, source, operations)
    elif source == "src/mondata.c":
        for name, kind in (("locomotion", "NH_PHASE6_LOCOMOTION"),
                           ("stagger", "NH_PHASE6_STAGGER")):
            a, b = function_span(changed, name)
            body = changed[a:b]
            for table in [n for n in tables if tables[n][0]["family"] == "motion"]:
                old = f"{table}[locoindx]"
                new = wrapped_table(kind, table, "locoindx", tables)
                if body.count(old) != 1: raise ValueError(f"Missing exact {name}/{table}")
                body = body.replace(old, new, 1)
                operations.append({"source": source, "source_contract": name + ".selected-motion",
                                   "original": old, "replacement": new,
                                   "runtime_binding_approved": False})
            changed = changed[:a] + body + changed[b:]
        changed = add_includes(changed, source, operations)
    elif source == "include/hack.h":
        old = '#define plur(x) (((x) == 1) ? "" : "s")'
        # The original macro remains byte-for-byte intact. The opt-in typed
        # replacement repeats its exact original predicate and original type.
        new = (old + '\n#include "nh-phase6-helper.h"\n'
               '#define nh_phase6_plur_value(x) \\\n'
               '    (((x) == 1) ? nh_phase6_leaf_value("", "nethack.helper.plural.one") \\\n'
               '                : nh_phase6_leaf_value("s", "nethack.helper.plural.many"))')
        changed = once(changed, old, new, operations, source, "plur.original-typed-predicate-once")
    elif source == "src/weapon.c":
        anchor = '#define P_NAME(type)'
        start = changed.index(anchor)
        end = changed.index('\n\n', start)
        old = changed[start:end]
        typed = old.replace("#define P_NAME(type)", "#define nh_phase6_p_name_value(type)", 1)
        typed = typed.replace("OBJ_NAME(objects[skill_names_indices[type]])",
                              "nh_phase6_fallback_value(OBJ_NAME(objects[skill_names_indices[type]]))")
        for table, index in (("barehands_or_martial", "martial_bonus()"),
                             ("odd_skill_names", "-skill_names_indices[type]")):
            typed = typed.replace(f"{table}[{index}]",
                                  f"nh_phase6_table_value({table}, nh_phase6_ids_{table}, "
                                  f"{len(tables[table])}, {index})")
        changed = once(changed, old, old + '\n\n' + typed,
                       operations, source, "P_NAME.original-macro-evaluation-counts")
        changed = add_includes(changed, source, operations)
    elif source == "include/you.h":
        for name in PRONOUN_MACROS:
            old = macro(changed, name)
            selection = re.search(r"genders\[(.*?)\]\.(he|him|his)", old, re.S)
            if not selection: raise ValueError("Original pronoun selection changed: " + name)
            index, field = selection.group(1), selection.group(2)
            kind = PRONOUN_FIELDS[field][1]
            replacement = f"nh_phase6_pronoun_table_value(genders, {index}, {kind})"
            typed = old.replace("#define " + name + "(", "#define nh_phase6_" + name + "_value(", 1)
            typed = typed.replace(selection.group(), replacement, 1)
            changed = once(changed, old, old + "\n" + typed, operations, source,
                           name + ".original-public-pronoun-index-once")
        anchor = "extern const struct Gender genders[]; /* table of available genders */"
        changed = once(changed, anchor, anchor + '\n#include "nh-phase6-helper.h"',
                       operations, source, "owned-pronoun-value-prototype")
    else:
        raise ValueError(f"Not an owned helper transform: {source}")
    return changed, operations


def restore_source(changed: str, operations: list[dict]) -> str:
    for op in reversed(operations):
        new, old = op["replacement"], op["original"]
        # Repeated body return expressions may legitimately be equal. The
        # reverse positional transform is generated in source occurrence order;
        # global replacements below recover the same original bytes everywhere.
        if new not in changed: raise ValueError(f"Cannot reverse {op['source_contract']}")
        changed = changed.replace(new, old, 1)
    return changed


def native_calls(text: str) -> Counter:
    ts = tokens(text)
    result = Counter()
    for i, name in enumerate(ts[:-1]):
        if not re.fullmatch(r"[A-Za-z_]\w*", name) or ts[i + 1] != "(": continue
        if name.startswith("nh_") or name in {"if", "while", "for", "switch", "sizeof", "return"}: continue
        depth, end = 1, i + 2
        while end < len(ts) and depth:
            if ts[end] == "(": depth += 1
            elif ts[end] == ")": depth -= 1
            end += 1
        if depth: raise ValueError("Unbalanced native calls")
        result[(name, tuple(ts[i + 2:end - 1]))] += 1
    return result


def build() -> dict:
    authored = strict_json(PHASE / "labels.authored.json")
    if authored["runtime_binding_approved"] is not False:
        raise ValueError("Source-only labels must remain unapproved")
    sources = {}
    for source, expected in PINNED.items():
        raw = (UPSTREAM / source).read_bytes()
        if sha(raw) != expected: raise ValueError(f"Pinned official source changed: {source}")
        sources[source] = raw.decode("utf-8")
    tables, evidence = {}, []
    for source, specs in TABLE_SPECS.items():
        for name, family, expected_count in specs:
            entries = table_entries(sources[source], source, name, family)
            if len(entries) != expected_count:
                raise ValueError(f"Wrong selected table size {name}: {len(entries)} != {expected_count}")
            tables[name] = entries
            evidence.extend(entries)
    pronouns = gender_entries(sources["src/role.c"])
    tables.update(pronouns)
    evidence.extend(record for entries in pronouns.values() for record in entries)
    evidence.extend(literal_evidence(sources["src/polyself.c"], "src/polyself.c", "mbodypart", "body", authored))
    # Macro literal source identities are independent of any count or state.
    line = sources["include/hack.h"].splitlines()[1519]
    for ordinal, m in enumerate(STRING.finditer(line)):
        evidence.append({"source": "include/hack.h", "source_blob_sha256": PINNED["include/hack.h"],
                         "line": 1520, "producer_declaration_start_line": 1520,
                         "function": "plur", "family": "plural", "producer_expression": line,
                         "source_literal_ordinal": ordinal,
                         "source_literal_start_offset": m.start(), "source_literal_end_offset": m.end(),
                         "original_literal_token": m.group(), "english": json.loads(m.group()),
                         "role": "selected-output-literal", "runtime_binding_approved": False})
    by_id = {}
    for record in evidence:
        family, english = record["family"], record["english"]
        identity = semantic_id(family, english)
        if identity in by_id and by_id[identity]["en"] != english:
            raise ValueError(f"Semantic ID slug collision {identity}")
        record["semantic_source_identity"] = identity
        record["descriptor_enabled"] = leaf_id(authored, family, english) is not None
        item = by_id.setdefault(identity, {
            "id": identity, "en": english, "ja": authored[family][english],
            "arguments": [], "argument_schemas": [[]],
            "source_translation_review_status": ("requires-public-semantic-disambiguation"
                                                  if deferred(authored, family, english)
                                                  else "faithful-official-selected-public-output"),
            "source_translation_approved": not deferred(authored, family, english),
            "runtime_binding_approved": False, "descriptor_enabled": record["descriptor_enabled"],
            "source_literals": [],
        })
        item["source_literals"].append(record)
        if family == "plural":
            item["localization_disposition"] = "English-only-number-agreement-suffix"
            item["translation_notes"] = "Japanese uses no English plural suffix. The whole message retains its full original argument union and meaningful numeric count; omission requires its original source-reviewed message contract."
        if family == "motion":
            item["translation_notes"] = "English capitalized and lowercase selected returns are distinct IDs. Japanese has no letter case. Native highc predicate is not repeated; later copy/case/tense transforms require their own completed-value contract."
        if family.startswith("pronoun_"):
            item["translation_notes"] = "Only the originally selected public he/him/his field and its grammatical role are represented. Original hero/visibility/no-it/hallucination index expression executes once; true hidden gender is not queried or exported. Subject/object Japanese keeps a pronoun stem so the source-reviewed whole message supplies its case particle. Possessive Japanese includes の and must not receive a second automatic possessive suffix. No pronoun is replaced with an empty prefix; later case/copy/reflexive/precision composition needs its own exact original public output contract."
        if deferred(authored, family, english):
            item["translation_notes"] = authored["deferred_literals"][family][english]
    # Reject unused dictionary mistakes rather than silently carrying a toy set.
    for family in ("body", "color", "liquid", "motion", "skill", "plural", *[v[0] for v in PRONOUN_FIELDS.values()]):
        seen = {r["english"] for r in evidence if r["family"] == family}
        if seen != set(authored[family]):
            raise ValueError(f"Authored coverage mismatch {family}: missing={seen-set(authored[family])}, extra={set(authored[family])-seen}")
    labels = ["/* Generated source-selected public IDs; source-only NGPL. */",
              "#ifndef JROGUE_NH_PHASE6_HELPER_LABELS_H",
              "#define JROGUE_NH_PHASE6_HELPER_LABELS_H"]
    for name, entries in tables.items():
        labels.append(f"static const char *const nh_phase6_ids_{name}[] = {{")
        for entry in entries:
            selected = leaf_id(authored, entry["family"], entry["english"])
            labels.append("    " + (json.dumps(selected) if selected else "0") + ",")
        labels.append("};")
    labels.append("#endif")
    generated = {"nh-phase6-helper-labels.h": "\n".join(labels) + "\n",
                 "nh-phase6-helper.h": (PHASE / "bridge.h.in").read_text(encoding="utf-8"),
                 "nh-phase6-helper.c": (PHASE / "bridge.c.in").read_text(encoding="utf-8")}
    operations, diffs, checks = [], [], []
    for source in sorted(TABLE_SPECS.keys() | {"include/hack.h", "include/you.h"}):
        changed, ops = transform_source(sources[source], source, tables, authored)
        restored = restore_source(changed, ops)
        if restored != sources[source]: raise ValueError(f"Original byte restoration failed: {source}")
        if native_calls(restored) != native_calls(sources[source]):
            raise ValueError(f"Original native call argument tokens changed: {source}")
        if source not in {"src/weapon.c", "include/hack.h", "include/you.h"} and native_calls(changed) != native_calls(sources[source]):
            raise ValueError(f"Transformed native call arguments/counts changed: {source}")
        generated[source] = changed
        operations.extend(ops)
        diffs.extend(difflib.unified_diff(sources[source].splitlines(True), changed.splitlines(True),
                                         fromfile="a/" + source, tofile="b/" + source))
        checks.append({"source": source, "byte_exact_reversal": True,
                       "original_native_call_argument_tokens_restored": True,
                       "transformed_native_call_arguments_unchanged": source not in {"src/weapon.c", "include/hack.h", "include/you.h"},
                       "original_source_sha256": PINNED[source],
                       "transformed_utf8_sha256": sha(changed)})
    catalog = {"schema_version": 1, "source_commit": COMMIT, "license": "NGPL",
               "runtime_binding_approved": False, "entries": list(by_id.values())}
    source_counts = Counter(r["family"] for r in evidence)
    id_counts = Counter(i["id"].split(".")[2] for i in by_id.values())
    manifest = {
        "schema_version": 1, "status": "source-only-inspection-proposal",
        "source_commit": COMMIT, "source_hashes": PINNED,
        "runtime_binding_approved": False, "integration_approved": False,
        "catalog_unique_ids": len(by_id), "selected_literal_evidence_records": len(evidence),
        "selected_literal_records_by_family": dict(source_counts), "unique_ids_by_family": dict(id_counts),
        "descriptor_enabled_ids": sum(i["descriptor_enabled"] for i in by_id.values()),
        "source_approved_japanese_ids": sum(i["source_translation_approved"] for i in by_id.values()),
        "table_sizes": {n: len(v) for n, v in tables.items()},
        "transformed_sources": checks, "operations": operations,
        "producer_contracts": [
            {"producer": "body_part/mbodypart", "covered": "All 29 originally selected return expressions, 12 original tables, and 14 selected literal tokens; gill remains explicitly unbound. body_part forwards once to the original mbodypart.", "fallback": "Unscoped calls; multiple same-kind completions; deferred ambiguous gill; modified/copied/capitalized returns; unsupported consumer precision."},
            {"producer": "hcolor", "covered": "Original hcolors display-RNG table branch, original RNG expression once.", "fallback": "Original preference branch and any caller transformation without a completed source producer contract."},
            {"producer": "hliquid", "covered": "Original hliquids[indx] return only; original gameover/Hallucination predicates, optional preference count, RNG and IndexOk unchanged.", "fallback": "Original liquidpref return, including its originally selected optional random preference; no inferred default token."},
            {"producer": "locomotion/stagger", "covered": "All seven active selected tables, four original capitalization/verb offsets; public word IDs contain no table family or species. Commented swim table excluded.", "fallback": "Original def return, later transformations, ambiguous/multiple captures."},
            {"producer": "plur", "covered": "Opt-in typed macro retains original arbitrary numeric type and exactly one (x)==1 evaluation; completed selected empty/s suffix event.", "fallback": "Unreplaced original macro; full message count/argument-union proof pending."},
            {"producer": "P_NAME", "covered": "Opt-in typed macro retains original argument evaluation counts, native predicates, skill index, and martial_bonus once; selected odd_skill_names/barehands_or_martial public label only.", "fallback": "Positive OBJ_NAME branch; actual caller may copy/alter the label and must have its own completed-output contract. Unused no-skill/bare-hands table entries are lexical evidence, not claimed executed outputs."},
            {"producer": "uhe/uhim/uhis; mhe/mhim/mhis; noit_mhe/noit_mhim/noit_mhis", "covered": "Nine opt-in owned-value macros preserve the original selected he/him/his field and original computed index once. Four original rows provide 12 public tokens with distinct subject/object/possessive contracts. Original pronoun_gender body, visibility/no-it/Hallucination predicates and rn2(4) are untouched. IDs expose only selected public pronoun and grammatical role, never hidden gender or table row.", "fallback": "Unreplaced original macros, downstream mutable/capitalized/reflexive copies, unproven consumed prefixes or printf precision. No actual uhes/He/His helper declaration exists in this pinned source; no synthetic helper or hidden-gender lookup is added."},
        ],
        "deferrals": [
            {"producer": "otense/vtense", "source": "src/objnam.c", "lines": [2531, 2653], "reason": "Original nextobuf allocation occurs before native parsing/copy. Require owned typed input-lemma and public subject snapshots before allocation, one original is_plural/native branch result, completed tense recipe and original case. A verb input token is not a completed phrase. No hooks generated."},
            {"producer": "s_suffix", "source": "src/hacklib.c", "lines": [345, 359], "reason": "Single static buffer may alias input/previous result. Require owned public input snapshot before original copy/overwrite, exact native it/you/s/default branch once, buffer generation and complete output integrity. No source-string matching or helper rerun. No hooks generated."},
            {"producer": "urole", "source": "include/decl.h", "lines": [981, 981], "reason": "urole is mutable gu.urole data, not a function. Role initialization may change it. Need original selected public field/name gender/rank source contract; no export of hidden role identity or new lookup. No hooks generated."},
            {"producer": "body.gill", "reason": authored["deferred_literals"]["body"]["gill"]},
            {"producer": "ordinary helper preferences/default verbs and mutable downstream copies", "reason": "Source-issued input IDs must be proven to denote the selected completed public return, with original lifetime/case. Until then whole original English, never raw English reverse lookup or native predicate/RNG/name rerun."},
        ],
        "integration_constraints": [
            "Keep returned owning struct as emitter formal value; never return a pointer into a temporary event_json array via a Phase4 value.",
            "Native helper return APIs remain unchanged; source-call replacement wrappers preserve argument tokens and one original call. Parent must review original callback/API argument evaluation order before composition.",
            "Descriptor failure/unproven precision or consumed-prefix binding disables whole-message Japanese and passes all exact original C values to the original formatter.",
            "No new state, knowledge, true-species, anatomy, naming, RNG, hallucination or branch query. Only original selected public output labels become events.",
            "One synchronous engine thread is assumed by the live scope root. Threading/reentry/nonlocal exits need reviewed cleanup/engine-context ownership before runtime approval.",
            "Current descriptor array bound is 192 bytes and scope public-byte snapshot bound is 96. Generated literal and ID bounds are checked; stack size/ABI require later compiler and execution measurement.",
            "Source-only selected tables do not prove coverage of every caller, executed semantic binding, browser Japanese, or complete-gameplay parity.",
        ],
        "verification": {"python_only": True, "compiler_run": False, "runtime_run": False,
                         "pristine_source_unchanged": True, "checks": checks},
    }
    return {"generated": generated, "diff": "".join(diffs), "catalog": catalog,
            "manifest": manifest, "evidence": evidence, "tables": tables}


def emit(artifacts: dict) -> None:
    out = PHASE / "generated"
    for name, text in artifacts["generated"].items():
        target = out / name
        if PHASE not in target.resolve().parents: raise ValueError("Write outside owned phase")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8", newline="\n")
    for name, payload in (("catalog.source-reviewed.json", artifacts["catalog"]),
                           ("coverage.manifest.json", artifacts["manifest"])):
        (PHASE / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PHASE / "selected-helpers.source-only.patch").write_text(artifacts["diff"], encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Read/validate source only; write nothing")
    options = parser.parse_args()
    result = build()
    if not options.check: emit(result)
    print(json.dumps({"status": "source-only-check-passed", "written": not options.check,
                      "catalog_unique_ids": result["manifest"]["catalog_unique_ids"],
                      "selected_literal_evidence_records": result["manifest"]["selected_literal_evidence_records"],
                      "descriptor_enabled_ids": result["manifest"]["descriptor_enabled_ids"],
                      "runtime_binding_approved": False}))


if __name__ == "__main__": main()
