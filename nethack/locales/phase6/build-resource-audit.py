"""Source-only resource/producer ledger; never infer visibility from rendered English.

This does not instrument C/Lua, change the frozen catalog, or establish translation
rights for third-party excerpts. Its queues require separate authoring and binding.
"""
from __future__ import annotations
import collections
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

BASE = Path(__file__).resolve().parents[2]
WORKSPACE = BASE.parent
SOURCE = WORKSPACE / "official-source-audit" / "NetHack-5.0.0"
OUT = Path(__file__).resolve().parent
PIN = "16ff59115315917b93185d026aeefea06db9b0f4"

def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value

inv = module(BASE / "tools/inventory_source.py", "phase6_inventory")
catalog = module(BASE / "locales/build-gameplay-catalog.py", "phase6_catalog")

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def write(name, value):
    encoded = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    path = OUT / name
    if not path.exists() or path.read_bytes() != encoded:
        path.write_bytes(encoded)
    return {"path": str(path.relative_to(BASE)).replace("\\", "/"),
            "sha256": hashlib.sha256(encoded).hexdigest(), "bytes": len(encoded)}

def line(text, offset):
    return text.count("\n", 0, offset) + 1

def ident(namespace, text):
    namespace = ".".join(re.sub(r"[^a-z0-9_]", "_", part.lower()) for part in namespace.split("."))
    return inv.semantic_candidate(namespace, text)

def source(relative):
    path = SOURCE / relative
    raw = path.read_bytes()
    return raw.decode("utf-8", errors="replace"), hashlib.sha256(raw).hexdigest()

def notice(relative):
    text, sha = source(relative)
    lines = text.splitlines()
    found = [{"line": i + 1, "text": value} for i, value in enumerate(lines[:45])
             if re.search(r"copyright|redistribut|license|permission|attribution", value, re.I)]
    return {"source": relative, "sha256": sha, "notice_lines": found,
            "license_reference": "official-source-audit/NetHack-5.0.0/dat/license and nethack/THIRD-PARTY-NOTICES.md; original source preserved",
            "no_new_translation_rights_inferred": True}

CONSUMERS = {
    "help": [("src/pager.c", "dohelp/display_file"), ("src/windows.c", "genl_display_file")],
    "keyhelp": [("src/pager.c", "whatdoes_help; leading whitespace removed, # comments skipped")],
    "cmdhelp": [("src/pager.c", "whatdoes; original CMDHELPFILE implementation is #if 0")],
    "data.base": [("src/pager.c", "checkfile; original English wildcard lookup keys select body"),
                  ("util/makedefs.c", "do_data; generated DLB offsets")],
    "oracles.txt": [("src/rumors.c", "outoracle; original chosen oracle offset")],
    "rumors.tru": [("src/rumors.c", "getrumor/outrumor; original selected public text only")],
    "rumors.fal": [("src/rumors.c", "getrumor/outrumor; preserve false statements, do not reveal truth class")],
    "engrave.txt": [("src/engrave.c", "random_engraving; original get_rnd_text/rn2 choice")],
    "epitaph.txt": [("src/engrave.c", "make_grave; original get_rnd_text/rn2 choice")],
    "bogusmon.txt": [("src/do_name.c", "rndmonnam; original get_rnd_text/display RNG choice")],
    "tribute": [("src/files.c", "read_tribute; original section/title/passage selection and line display")],
    "quest.lua": [("src/questpgr.c", "com_pager_core/convert_line; original chosen table and public substitution snapshots")],
}

units = []
structures = []
rights = []

def add(relative, start, end, english, kind, *, status="requires-source-selected-binding",
        extra=None, rights_status="original-upstream-prose-review-required"):
    _, sha = source(relative)
    stem = Path(relative).stem.replace(".", "_")
    # Truth/false source filenames deliberately do not appear in player IDs.
    stem = "rumor" if relative in ("dat/rumors.tru", "dat/rumors.fal") else stem
    unit = {"id": ident("nethack.resource." + stem, english), "source": relative,
            "source_start_line": start, "source_end_line": end, "source_sha256": sha,
            "kind": kind, "english_source_literal": english,
            "english_named_template": catalog.escape(english), "argument_schemas": [],
            "typed_arguments": [], "format_semantics": "literal-resource-text-not-printf",
            "consumer_evidence": CONSUMERS.get(Path(relative).name, CONSUMERS["help"]),
            "binding_status": status, "runtime_binding_approved": False,
            "translation_status": "not-authored", "rights_status": rights_status,
            "knowledge_guard": "emit only the unit already selected and exposed by the original native consumer; no RNG/name/state replay"}
    if extra:
        unit.update(extra)
    units.append(unit)

def structural(relative, lineno, raw, reason):
    structures.append({"source": relative, "line": lineno, "original": raw,
                       "consumer_backed_disposition": reason, "change_native_source": False})

HELP = ["help", "hh", "history", "keyhelp", "cmdhelp", "opthelp", "optmenu", "usagehlp", "wizhelp"]
for filename in HELP:
    relative = "dat/" + filename
    text, sha = source(relative)
    rights.append(notice(relative))
    for n, raw in enumerate(text.splitlines(), 1):
        if not raw.strip():
            structural(relative, n, raw, "blank/indentation layout retained by original file display")
        elif raw.startswith("#") and filename == "keyhelp":
            structural(relative, n, raw, "whatdoes_help explicitly skips # comments; src/pager.c:2435-2436")
        else:
            add(relative, n, n, raw, "help-or-history-line", extra={
                "source_syntax_guard": "preserve actual command letters, control notation, option input names, glyph diagrams and original line indentation; translate only their explanation",
                "preprocessor_active_source_proven": False,
                "source_eligibility_notes": ["cmdhelp's old reader is inside #if 0; lexical resource existence is not an active callback"] if filename == "cmdhelp" else []})

for filename in ["rumors.tru", "rumors.fal", "engrave.txt", "epitaph.txt", "bogusmon.txt"]:
    relative = "dat/" + filename
    text, sha = source(relative)
    rights.append(notice(relative))
    for n, raw in enumerate(text.splitlines(), 1):
        if not raw or raw.startswith("#"):
            structural(relative, n, raw, "blank/comment excluded by original resource preprocessing; preserve file")
            continue
        prefix = raw[0] if filename == "bogusmon.txt" and raw[0] in "-_+|=" else ""
        visible = raw[1:] if prefix else raw
        add(relative, n, n, visible, "original-random-selected-line", extra={
            "original_resource_line": raw,
            "original_bogusmon_prefix_code": prefix or None,
            "source_transformation_evidence": "src/do_name.c:1379-1383 strips original prefix; code retained in original native grammar" if prefix else None,
            "no_truth_class_in_player_event": filename.startswith("rumors"),
            "public_name_guard": "for bogusmon capture the displayed hallucination label, never the real monster identity" if filename == "bogusmon.txt" else None,
            "generated_resource_offset_mapping": "requires actual makedefs output/source-index mapping; never rendered-English lookup"})

relative = "dat/oracles.txt"
text, sha = source(relative)
rights.append(notice(relative))
block = []
begin = 0
for n, raw in enumerate(text.splitlines() + ["-----"], 1):
    if raw == "-----":
        if block:
            add(relative, begin, n - 1, "\n".join(block), "oracle-paragraph")
            block = []
        if n <= len(text.splitlines()):
            structural(relative, n, raw, "oracle delimiter; original selected offset unchanged")
    else:
        if not block:
            begin = n
        block.append(raw)

relative = "dat/data.base"
text, sha = source(relative)
info = notice(relative)
info.update({"rights_status": "mixed-original-prose-and-third-party-attributed-excerpts",
             "translation_blocker": "NGPL redistribution notice does not establish derivative translation rights for every attributed book/poem excerpt; source-specific rights or original fact-only replacement need review"})
rights.append(info)
keys = []
body = []
body_start = 0
citations = []
def flush_encyclopedia(end):
    global keys, body, body_start, citations
    if body:
        eng = "\n".join(body)
        citations = re.findall(r"\[[\s\S]*?\]", eng)
        external = any(value.strip() not in ("[]", "[ ]") for value in citations)
        add(relative, body_start, end, eng, "encyclopedia-body",
            status="blocked-third-party-translation-rights" if external else "requires-source-selected-binding",
            rights_status="third-party-attributed-excerpt-unresolved" if external else "unattributed-upstream-entry-review-required",
            extra={"original_lookup_keys": list(keys), "original_attributions": list(citations),
                   "lookup_guard": "retain original English keys/wildcards/exclusion keys in C lookup; localize only originally selected body",
                   "translation_authoring_allowed": False if external else "requires-author-confirmation-of-original-prose",
                   "unit_rights_evidence": {"source_notice": "dat/data.base:3-5 NGPL redistribution wrapper",
                       "entry_attribution_text": list(citations),
                       "entry_source_span": [body_start, end],
                       "permission_status": "no excerpt-specific translation permission supplied" if external else "source explicitly has [] attribution or no citation; original authorship not yet established; not treated as exempt"}})
    keys, body, citations = [], [], []
for n, raw in enumerate(text.splitlines(), 1):
    if raw.startswith("#"):
        structural(relative, n, raw, "makedefs comment; retained source notice")
    elif raw and not raw[0].isspace():
        if body:
            flush_encyclopedia(n - 1)
        keys.append({"line": n, "key": raw})
        structural(relative, n, raw, "original wildcard encyclopedia lookup key; parser contract dat/data.base:9-21")
    elif keys:
        if not body:
            body_start = n
        content = raw[1:] if raw.startswith("\t") else raw
        body.append(content)
        if "[" in content and "]" in content:
            citations.append(content.strip())
flush_encyclopedia(len(text.splitlines()))

relative = "dat/tribute"
text, sha = source(relative)
info = notice(relative)
info.update({"rights_status": "third-party-literary-excerpts-and-attributed-quotes",
             "translation_blocker": "preserved upstream NGPL wrapper and attributions do not establish permission to translate proprietary book excerpts; no full translated passage authored"})
rights.append(info)
block = []
begin = 0
section = title = passage = None
title_line = section_line = passage_line = 0
preceding_comments = []
for n, raw in enumerate(text.splitlines() + ["%e passage"], 1):
    if raw.startswith("%"):
        if block:
            add(relative, begin, n - 1, "\n".join(block), "tribute-selected-passage",
                status="blocked-third-party-translation-rights",
                rights_status="third-party-excerpt-translation-rights-unresolved",
                extra={"original_section_key": section, "original_title_key": title,
                       "original_passage_key": passage, "translation_authoring_allowed": False,
                       "unit_rights_evidence": {"source_notice": "dat/tribute:2-8 wrapper copyright, NGPL redistribution and Terry Pratchett tribute attribution",
                           "original_title_line": title_line, "original_section_line": section_line,
                           "original_passage_directive_line": passage_line,
                           "original_attribution_comments": list(preceding_comments),
                           "permission_status": "named Pratchett book or Death quote with source page attribution; no excerpt-specific translation permission supplied"}})
            block = []
        if raw.lower().startswith("%section "):
            section = raw[9:]
            section_line = n
        elif raw.lower().startswith("%title "):
            title = raw[7:]
            title_line = n
            preceding_comments = []
        elif raw.lower().startswith("%passage "):
            passage = raw[9:]
            passage_line = n
            begin = n + 1
        elif raw.lower().startswith("%e"):
            passage = None
        if n <= len(text.splitlines()):
            structural(relative, n, raw, "original read_tribute section/title/passage parser directive; src/files.c:3510-3592")
    elif raw.startswith("#"):
        preceding_comments.append({"line": n, "text": raw})
        preceding_comments = preceding_comments[-12:]
        structural(relative, n, raw, "source attribution/comment retained verbatim")
    elif passage is not None:
        if not block:
            begin = n
        block.append(raw)

# The original quest converter already has a reviewed exact source token union.
# Refer to it, rather than introducing a second parser with different modifiers.
frozen = read_json(BASE / "locales/gameplay-core.metadata.json")
quest_entries = [entry for entry in frozen["entries"] if entry["category"] == "quest-text"]
quest_refs = [{"id": entry["id"], "source": entry["source"], "source_path": entry["path"],
               "source_line": entry["official_line"], "argument_schemas": [arg["name"] for arg in entry["arguments"]],
               "source_contract": "frozen gameplay-core.metadata.json, original convert_arg/convert_line snapshots",
               "runtime_binding_approved": False} for entry in quest_entries]

def lua_tokens(text):
    result = []
    i = 0
    def long_open(at):
        return re.match(r"\[(=*)\[", text[at:])
    while i < len(text):
        if text.startswith("--", i):
            match = long_open(i + 2)
            if match:
                closer = "]" + match.group(1) + "]"
                end = text.find(closer, i + 2 + len(match.group()))
                i = len(text) if end < 0 else end + len(closer)
            else:
                end = text.find("\n", i)
                i = len(text) if end < 0 else end + 1
            continue
        start = i
        match = long_open(i)
        if match:
            closer = "]" + match.group(1) + "]"
            body = i + len(match.group())
            end = text.find(closer, body)
            if end < 0:
                raise ValueError("unterminated Lua long string")
            value = text[body:end]
            if value.startswith("\r\n"):
                value = value[2:]
            elif value.startswith("\n"):
                value = value[1:]
            i = end + len(closer)
            result.append(("string", value, start, i))
        elif text[i] in "\"'":
            q = text[i]
            i += 1
            value = []
            while i < len(text) and text[i] != q:
                if text[i] == "\\" and i + 1 < len(text):
                    i += 1
                    escapes = {"n": "\n", "r": "\r", "t": "\t", "a": "\a", "b": "\b", "f": "\f", "v": "\v"}
                    if text[i].isdigit():
                        digits = re.match(r"\d{1,3}", text[i:]).group()
                        value.append(chr(int(digits)))
                        i += len(digits)
                        continue
                    value.append(escapes.get(text[i], text[i]))
                else:
                    value.append(text[i])
                i += 1
            i += 1
            result.append(("string", "".join(value), start, i))
        elif text[i].isalpha() or text[i] == "_":
            match = re.match(r"[A-Za-z_][A-Za-z_0-9]*", text[i:])
            i += len(match.group())
            result.append(("identifier", match.group(), start, i))
        elif not text[i].isspace():
            result.append(("punct", text[i], start, i + 1))
            i += 1
        else:
            i += 1
    return result

lua_ledger = []
lua_visible = []
lua_invariants = []
for path in sorted((SOURCE / "dat").glob("*.lua")):
    relative = str(path.relative_to(SOURCE)).replace("\\", "/")
    text, sha = source(relative)
    tokens = lua_tokens(text)
    des_scopes = []
    for at in range(len(tokens) - 3):
        if [token[1] for token in tokens[at:at + 2]] == ["des", "."] and tokens[at + 3][1] == "(":
            depth = 0
            for until in range(at + 3, len(tokens)):
                if tokens[until][1] == "(":
                    depth += 1
                elif tokens[until][1] == ")":
                    depth -= 1
                    if depth == 0:
                        des_scopes.append((at + 3, until, "des." + tokens[at + 2][1]))
                        break
    for index, (kind, value, start, end) in enumerate(tokens):
        if kind != "string":
            continue
        prev = [tok[1] for tok in tokens[max(0, index - 5):index]]
        key = prev[-2] if len(prev) >= 2 and prev[-1] == "=" else None
        call = None
        if len(prev) >= 4 and prev[-1] == "(" and prev[-3] == ".":
            call = prev[-4] + "." + prev[-2]
        containing = [scope for scope in des_scopes if scope[0] < index < scope[1]]
        owner_call = min(containing, key=lambda scope: scope[1] - scope[0])[2] if containing else None
        visible = call in {"des.message", "nh.pline", "nh.verbalize", "nh.text", "nh.getlin"}
        exact_literal_call = visible and index + 1 < len(tokens) and tokens[index + 1][1] in {",", ")"}
        inquest = relative == "dat/quest.lua"
        record = {"source": relative, "line": line(text, start), "start": start, "end": end,
                  "source_sha256": sha, "english_source_literal": value,
                  "id_candidate": ident("nethack.resource.lua." + path.stem, value),
                  "lua_key_candidate": key, "direct_consumer_call": call,
                  "containing_des_call": owner_call,
                  "visibility_disposition": "covered-by-frozen-quest-contract" if inquest else
                      "source-proven-direct-public-consumer" if exact_literal_call else
                      "direct-public-consumer-dynamic-expression" if visible else
                      "consumer-review-required-not-exempt",
                  "runtime_binding_approved": False}
        lua_ledger.append(record)
        public_field = ((key == "text" and owner_call in {"des.engraving", "des.grave"}) or (key == "name" and owner_call in {"des.monster", "des.object"})) and index + 1 < len(tokens) and tokens[index + 1][1] in {",", "}"}
        if public_field:
            record["visibility_disposition"] = "source-proven-public-persistent-field-original-state-guard"
            add(relative, record["line"], line(text, end), value, "lua-public-persistent-field",
                extra={"lua_literal_start": start, "lua_literal_end": end, "lua_consumer_call": owner_call,
                       "lua_field": key, "consumer_evidence": [("src/sp_lev.c", {
                           "des.engraving": "lspo_engraving:3908 original text; degradation/gameplay spelling unchanged",
                           "des.grave": "lspo_grave:4262,make_grave:4274 original text",
                           "des.monster": "lspo_monster:3295 original public custom name",
                           "des.object": "lspo_object:3637 original custom object name"}[owner_call])],
                       "persistent_state_guard": "retain native engraving/name text for game rules/save/degradation; translate only proven source-origin intact public presentation; original altered/custom text falls back literally, never matched by English",
                       "native_mechanical_token_guard": "Elbereth and command/name keys remain original game-data spelling; no state mutation for localization"})
        elif (owner_call == "des.map" and (call == "des.map" or key == "map")) or (owner_call in {"des.monster", "des.object"} and key == "id") or (owner_call == "des.levregion" and key == "name"):
            record["visibility_disposition"] = "consumer-proven-native-map-or-lookup-identity"
            proof = "src/sp_lev.c:6110-6129 mapfrag_fromstr" if owner_call == "des.map" else (
                "src/sp_lev.c:3169 monster input ID lookup" if owner_call == "des.monster" else
                "src/sp_lev.c:3541 object input ID lookup" if owner_call == "des.object" else
                "src/sp_lev.c:5490 levregion destination identity")
            lua_invariants.append({"source": relative, "line": record["line"], "start": start,
                                   "original": value, "source_sha256": sha, "consumer_evidence": proof,
                                   "native_data_must_remain_original": True,
                                   "display_guard": "separate public localized labels may be selected by native producer; do not alter this input identity"})
        if exact_literal_call:
            lua_visible.append(record)
            # Level messages use original quest substitution (%d included).
            token_pending = call == "des.message" and "%" in value
            add(relative, record["line"], line(text, end), value, "lua-direct-public-message",
                status="requires-original-quest-token-union" if token_pending else "requires-source-selected-binding",
                extra={"lua_literal_start": start, "lua_literal_end": end, "lua_consumer_call": call,
                       "consumer_evidence": [("src/sp_lev.c", "lspo_message:3076-3106; original accumulated gl.lev_message"),
                                             ("src/questpgr.c", "deliver_splev_message:655 and original convert_line")]
                                           if call == "des.message" else [("src/nhlua.c", {
                                               "nh.pline": "nhl_pline:634-642; raw first argument becomes pline %s",
                                               "nh.verbalize": "nhl_verbalize:650; original quoted message helper",
                                               "nh.text": "nhl_text:810; original text window delivery",
                                               "nh.getlin": "nhl_getlin:695; original prompt/input call"}[call])],
                       "argument_union_status": "pending exact original native quest substitutions; empty union is not yet emission-approved" if token_pending else "no printf parsing of resource content"})
            if token_pending:
                template, substitutions = catalog.quest_template(value)
                units[-1].update({"english_named_template": template,
                                  "typed_arguments": substitutions,
                                  "argument_schemas": sorted({arg["name"] for arg in substitutions}),
                                  "format_semantics": "original-quest-convert-line-substitutions-not-printf",
                                  "argument_union_status": "source-derived original eligible quest token union; capture already-computed original substitutions only, binding pending"})

def brace_fields(tokens, opening, closing):
    result = []
    depth = 0
    begin = opening + 1
    for index in range(opening + 1, closing):
        value = tokens[index].text
        if value in ("{", "(", "["):
            depth += 1
        elif value in ("}", ")", "]"):
            depth -= 1
        elif value == "," and depth == 0:
            result.append(tokens[begin:index])
            begin = index + 1
    if begin < closing:
        result.append(tokens[begin:closing])
    return result

def find_close(tokens, opening, left="{", right="}"):
    depth = 0
    for index in range(opening, len(tokens)):
        if tokens[index].text == left:
            depth += 1
        elif tokens[index].text == right:
            depth -= 1
            if not depth:
                return index
    raise ValueError("unclosed source structure")

labels = []
invariants = []
def label(relative, token, category, evidence, extra=None):
    text, sha = source(relative)
    parts = token if isinstance(token, list) else [token]
    english = "".join(inv.decode_c_string(part.text) for part in parts)
    original_literal = english
    if category == "deity" and english.startswith("_"):
        english = english[1:]
    token = parts[0]
    record = {"id": ident("nethack.label." + category, english), "source": relative,
              "line": line(text, token.start), "source_literal_start": token.start,
              "source_literal_end": parts[-1].end, "source_sha256": sha,
              "source_literal_tokens": [{"start": part.start, "end": part.end,
                                         "raw": part.text} for part in parts],
              "english_source_literal": english, "english_named_template": catalog.escape(english),
              "original_c_literal_value": original_literal,
              "source_transformation_evidence": "src/pray.c:2552-2553 align_gname strips leading goddess underscore; native gender/selection retained" if category == "deity" and original_literal.startswith("_") else None,
              "typed_arguments": [], "argument_schemas": [], "category": category,
              "consumer_evidence": evidence, "translation_status": "not-authored",
              "runtime_binding_approved": False,
              "knowledge_guard": "original native already selected this public label; retain original parser/lookup values and source state; no second selection"}
    if extra:
        record.update(extra)
    labels.append(record)

role_relative = "src/role.c"
text, sha = source(role_relative)
tokens = inv.c_tokens(text)
schemas = {
    "roles": {0: "role", 1: "rank", 2: "deity", 3: "deity", 4: "deity", 6: "quest_home", 7: "quest_destination"},
    "races": {0: "race_noun", 1: "race_adjective", 2: "race_collective", 4: "race_gender_name"},
    "genders": {0: "gender_label", 1: "pronoun_subject", 2: "pronoun_object", 3: "pronoun_possessive"},
    "aligns": {0: "alignment_noun", 1: "alignment_adjective"},
}
for array, field_schema in schemas.items():
    found = next(i for i, token in enumerate(tokens) if token.text == array and i + 1 < len(tokens) and tokens[i + 1].text == "[")
    opening = next(i for i in range(found, len(tokens)) if tokens[i].text == "{")
    closing = find_close(tokens, opening)
    rows = brace_fields(tokens, opening, closing)
    for row_index, row in enumerate(rows):
        if not row or row[0].text != "{":
            continue
        fields = brace_fields(row, 0, len(row) - 1)
        for field_index, field in enumerate(fields):
            for token in field:
                if token.kind != "string":
                    continue
                if field_index in field_schema:
                    label(role_relative, token, field_schema[field_index],
                          "original const struct " + array + " array field " + str(field_index),
                          {"source_array": array, "row": row_index, "field": field_index,
                           "deity_prefix_guard": "leading underscore marks goddess in original source; capture original native gender separately" if field_schema[field_index] == "deity" else None})
                else:
                    invariants.append({"source": role_relative, "line": line(text, token.start),
                                       "original": inv.decode_c_string(token.text), "array": array,
                                       "field": field_index, "reason": "role/race/gender/alignment filecode used as parser/quest selection key; native source unchanged"})

relative = "include/optlist.h"
text, sha = source(relative)
tokens = inv.c_tokens(text)
for index, token in enumerate(tokens):
    if token.text not in {"NHOPTB", "NHOPTC", "NHOPTP", "NHOPTO"} or index + 1 >= len(tokens) or tokens[index + 1].text != "(":
        continue
    closing = find_close(tokens, index + 1, "(", ")")
    fields = brace_fields(tokens, index + 1, closing)
    strings = [value for value in fields[-1] if value.kind == "string"] if fields else []
    if not strings:
        continue  # macro definitions do not contain a description literal
    label(relative, strings, "option_description", "NHOPT_PARSE emits final description field; include/optlist.h:74-86",
          {"source_macro": token.text,
           "option_key_expression": "".join(value.text for value in fields[2 if token.text == 'NHOPTO' else 0]),
           "syntax_guard": "option names/aliases/example configuration syntax remain original input tokens"})
    for field in fields[:-1]:
        for value in field:
            if value.kind == "string":
                invariants.append({"source": relative, "line": line(text, value.start),
                                   "original": inv.decode_c_string(value.text),
                                   "reason": "NHOPT alias/name argument consumed by original option parser; localize description field only"})

relative = "src/cmd.c"
text, sha = source(relative)
tokens = inv.c_tokens(text)
found = next(i for i, token in enumerate(tokens) if token.text == "extcmdlist"
             and [value.text for value in tokens[i + 1:i + 5]] == ["[", "]", "=", "{"])
opening = next(i for i in range(found, len(tokens)) if tokens[i].text == "{")
closing = find_close(tokens, opening)
for row in brace_fields(tokens, opening, closing):
    if not row or row[0].text != "{":
        continue
    fields = brace_fields(row, 0, len(row) - 1)
    if len(fields) < 3:
        continue
    key_strings = [token for token in fields[1] if token.kind == "string"]
    description_strings = [token for token in fields[2] if token.kind == "string"]
    if description_strings:
        label(relative, description_strings, "command_description", "ext_func_tab description field; original native extcmdlist selection",
              {"original_command_token": inv.decode_c_string(key_strings[0].text) if key_strings else None,
               "input_guard": "retain command key/name/function/flags; localized description is presentation only"})
    for token in key_strings:
        invariants.append({"source": relative, "line": line(text, token.start),
                           "original": inv.decode_c_string(token.text),
                           "reason": "extcmdlist command token is original input/parser identity; localized display descriptor must not replace it"})

for relative, array in [("src/botl.c", "enc_stat"), ("src/eat.c", "hu_stat")]:
    text, sha = source(relative)
    tokens = inv.c_tokens(text)
    found = next(i for i, token in enumerate(tokens) if token.text == array and tokens[i + 1].text == "[")
    opening = next(i for i in range(found, len(tokens)) if tokens[i].text == "{")
    closing = find_close(tokens, opening)
    for token in tokens[opening:closing]:
        if token.kind == "string":
            label(relative, token, "status_" + array, "original status table index selected by C botl/eat; empty label is structural")

messages = read_json(BASE / "catalog/source-text-messages.json")
producer_ledger = []
for record in messages["intermediate_formatters"]:
    if not record["source"].startswith("src/"):
        continue
    value = dict(record)
    value["producer_status"] = "lexical-native-format-producer-consumer-not-yet-proven"
    value["runtime_binding_approved"] = False
    value["consumer_contract_required"] = "trace original completed producer to public consumer and source-selected immutable args; no buffer-English parsing or repeated native calls"
    if value.get("english_source_template") is not None:
        try:
            en, args, conversions = catalog.convert_printf(value["english_source_template"])
            value["english_named_template"] = en
            value["typed_arguments"] = args
            value["printf_conversions"] = conversions
            value["argument_schemas"] = [arg["name"] for arg in args]
            value["typed_contract_status"] = "format-derived-only; original promoted C types/public consumption require source binding"
        except ValueError as error:
            value["typed_contract_status"] = "requires-specialized-native-contract"
            value["typed_contract_error"] = str(error)
    else:
        value["typed_contract_status"] = "dynamic-format-origin-review-required"
    producer_ledger.append(value)

literals = read_json(BASE / "catalog/source-text-literals.json")
label_files = {"src/role.c", "src/botl.c", "src/calendar.c", "src/options.c", "src/cmd.c", "src/objnam.c", "src/do_name.c", "src/nhlua.c", "include/optlist.h", "include/botl.h", "src/drawing.c"}
known_positions = {(entry["source"], line(source(entry["source"])[0], token["start"]),
                    inv.decode_c_string(token["raw"])) for entry in labels for token in entry["source_literal_tokens"]}
raw_label_candidates = []
for literal in literals["c_literals"]:
    if literal["source"] not in label_files:
        continue
    if (literal["source"], literal["line"], literal["english_source_literal"]) in known_positions:
        continue
    value = dict(literal)
    value["consumer_disposition"] = "unclassified-label-format-identifier-or-code; not exempt and not proven visible"
    value["runtime_binding_approved"] = False
    raw_label_candidates.append(value)

surface_inventory = read_json(BASE / "catalog/source-text-surfaces.json")
surface_ledger = []
covered_sources = {entry["source"] for entry in units} | {"dat/quest.lua"}
for item in surface_inventory["surfaces"]:
    record = dict(item)
    record["coverage_disposition"] = "resource-unit-ledger" if item["source"] in covered_sources else (
        "lua-token-consumer-ledger" if item["source"].endswith(".lua") else
        "verbatim-original-legal-notice" if Path(item["source"]).name == "license" else
        "packaging-and-visible-consumer-review-required")
    record["runtime_binding_approved"] = False
    surface_ledger.append(record)

unit_ids = {entry["id"] for entry in units}
label_ids = {entry["id"] for entry in labels}
summary = {"schema_version": 1, "source_commit": PIN,
           "scope": "source-only additional resources, typed native producer candidates, labels; separate denominators from5984 literal direct calls",
           "counts": {"resource_unit_sites": len(units), "unique_resource_unit_ids": len(unit_ids),
                      "resource_sites_by_kind": dict(collections.Counter(entry["kind"] for entry in units)),
                      "resource_sites_by_rights_status": dict(collections.Counter(entry["rights_status"] for entry in units)),
                      "structural_or_lookup_source_lines": len(structures),
                      "frozen_quest_unit_refs": len(quest_refs), "lua_comment_aware_string_tokens": len(lua_ledger),
                      "lua_source_proven_direct_literal_consumers": len(lua_visible),
                      "lua_token_dispositions": dict(collections.Counter(entry["visibility_disposition"] for entry in lua_ledger)),
                      "lua_consumer_proven_native_input_invariants": len(lua_invariants),
                      "source_proven_label_sites": len(labels), "unique_label_ids": len(label_ids),
                      "source_proven_label_categories": dict(collections.Counter(entry["category"] for entry in labels)),
                      "native_input_identity_invariants": len(invariants),
                      "remaining_selected_file_c_literal_candidates": len(raw_label_candidates),
                      "core_intermediate_formatter_lexical_origins": len(producer_ledger),
                      "core_formatter_contract_status": dict(collections.Counter(entry["typed_contract_status"] for entry in producer_ledger)),
                      "surface_files_accounted": len(surface_ledger), "runtime_approved_added_ids": 0},
           "limits": ["Lexical/source provenance is not active-preprocessor/runtime coverage.",
                      "No native producer, DLB offset, Lua/save origin or public name binding is installed here.",
                      "Only explicitly traced lookup/parser identities are verbatim invariants; unknown strings remain review-required.",
                      "Do not union resource, label, formatter and direct-call denominators: producers can feed existing calls.",
                      "Third-party quoted book text is blocked from translation without established permissions; original attribution and notices retained."],
           "artifacts": []}
summary["artifacts"].append(write("resource-units.json", {"source_commit": PIN, "entries": units, "structural_source_lines": structures, "quest_contract_refs": quest_refs}))
summary["artifacts"].append(write("lua-consumer-ledger.json", {"source_commit": PIN, "method": "comment-aware quoted/long-bracket string lexer; public API literal/field and original map/lookup consumer proof only", "entries": lua_ledger, "original_input_invariants": lua_invariants}))
summary["artifacts"].append(write("public-label-queues.json", {"source_commit": PIN, "entries": labels, "original_input_invariants": invariants, "unclassified_literal_candidates": raw_label_candidates}))
summary["artifacts"].append(write("native-producer-ledger.json", {"source_commit": PIN, "entries": producer_ledger}))
summary["artifacts"].append(write("resource-rights-audit.json", {"source_commit": PIN, "resources": rights, "translation_runtime_approved": False, "original_source_and_notices_preserved": True}))
summary["artifacts"].append(write("surface-ledger.json", {"source_commit": PIN, "entries": surface_ledger}))

# Small queues are only source-grounded prose/labels. Proprietary excerpt bodies
# and unresolved-token expressions do not enter authoring queues.
queue_classes = {
    "help-history": [entry for entry in units if entry["kind"] == "help-or-history-line"],
    "random-selected-text": [entry for entry in units if entry["kind"] == "original-random-selected-line"],
    "oracle": [entry for entry in units if entry["kind"] == "oracle-paragraph"],
    "lua-direct-message": [entry for entry in units if entry["kind"] == "lua-direct-public-message"],
    "lua-public-field": [entry for entry in units if entry["kind"] == "lua-public-persistent-field"],
    "public-label": labels,
}
batch_manifest = {"source_commit": PIN, "runtime_binding_approved": False, "batches": [],
                  "not_queued": {"third_party_rights_blocked_or_uncertain": sum(entry["kind"] in ("encyclopedia-body", "tribute-selected-passage") for entry in units)},
                  "source_rights_guard": "human author must check each original source notice; no third-party excerpt translation rights inferred"}
for category, entries in queue_classes.items():
    by_id = {}
    for entry in entries:
        if entry["id"] not in by_id:
            by_id[entry["id"]] = {"id": entry["id"], "english_named_template": entry["english_named_template"],
                                  "typed_arguments": entry["typed_arguments"], "argument_schemas": entry["argument_schemas"],
                                  "source_records": []}
        by_id[entry["id"]]["source_records"].append(entry)
    unique = list(by_id.values())
    for index in range(0, len(unique), 100):
        batch = index // 100 + 1
        name = category + "-batch-" + str(batch) + ".json"
        result = write(name, {"schema_version": 1, "source_commit": PIN, "category": category,
                             "runtime_binding_approved": False,
                             "authoring_contract": "faithful official source Japanese; exact named typed union; preserve parser keys/glyphs/layout/attributions; no English reverse mapping or native calls",
                             "entries": unique[index:index + 100]})
        batch_manifest["batches"].append({**result, "category": category, "unique_ids": len(unique[index:index + 100])})
summary["artifacts"].append(write("resource-authoring-batches.json", batch_manifest))
write("resource-summary.json", summary)
print(json.dumps(summary["counts"], ensure_ascii=False))
