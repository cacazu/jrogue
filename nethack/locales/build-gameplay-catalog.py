#!/usr/bin/env python3
"""Reproduce source-selected EN/JA catalogs without changing either engine tree.

Copyright (c) 2026 NetHack browser integration contributors.
Imported Japanization strings remain copyright their JNetHack authors under
the NetHack General Public License. See generated provenance and READMEj1.txt.
This tool performs offline source alignment, never runtime English matching.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
PIN = "25adee135c4bbd43ac8567664f600b565332435c"
ORIGIN = "https://github.com/jnethack/jnethack-alpha.git"
DEFAULT_CHECKOUT = Path(r"C:\Users\kit\gameme\jnethack\jnethack\source")
OFFICIAL_COMMIT = "16ff59115315917b93185d026aeefea06db9b0f4"
PRINTF = re.compile(r"%(?:(\d+)\$)?([-+ #0']*)(\*|\d+)?(?:\.(\*|\d+))?(hh|ll|[hljztL])?([diuoxXfFeEgGaAcspn%])")
PREFIX = {"You": "You ", "You1": "You ", "Your": "Your ", "Your1": "Your ",
          "You_cant": "You can't ", "You_feel": "You feel ", "You_hear": "You hear ",
          "You_hear1": "You hear ", "You_see": "You see ", "There": "There ", "pline_The": "The "}
JNET_AUTHORS = ["Issei Numata", "HAMADA Naoki", "Shigehiro Miyashita", "Tomoyuki Shiraishi",
                "Kazuhiro FUjieda", "Kunedog", "Shinkou Awatsu", "Takeshi Nishimura", "高田幸治",
                "SHIRAKATA Kentaro", "板倉充洋", "樋口雄一", "Haruko Numata"]
QUEST_NAMES = {"p": "player_name", "c": "role_name", "r": "current_rank", "R": "minimum_quest_rank",
               "s": "sibling_term", "S": "child_term", "l": "quest_leader", "i": "intermediate_destination",
               "o": "quest_artifact", "O": "short_quest_artifact", "n": "quest_nemesis", "g": "quest_guardian",
               "G": "alignment_title", "H": "quest_home", "a": "original_alignment", "A": "current_alignment",
               "d": "original_alignment_deity", "D": "lawful_deity", "C": "chaotic_alignment",
               "N": "neutral_alignment", "L": "lawful_alignment", "x": "perception_verb", "Z": "dungeon_name"}
QUEST_MODIFIERS = set("aAC hHiIjJpPsSt".replace(" ", ""))


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


def normalized(data):
    return data.decode("utf-8").replace("\r", "")


def pinned(checkout, path, inputs):
    raw = subprocess.run(["git", "-C", str(checkout), "show", f"{PIN}:{path}"], check=True, capture_output=True).stdout
    inputs[path] = {"commit": PIN, "path": path, "sha256": sha(raw), "bytes": len(raw), "read_method": "git-show-pinned-commit"}
    return normalized(raw)


def escape(text):
    return text.replace("{", "{{").replace("}", "}}")


def convert_printf(text, printf_like=True, argument_map=None):
    """Keep exact C conversion syntax in placeholders; stars name their slots."""
    if not printf_like:
        return escape(text), [], []
    output, arguments, conversions = [], [], []
    offset, index = 0, 1
    def argument_name(position):
        original = f"arg_{position}"
        return argument_map.get(original, original) if argument_map else original
    for match in PRINTF.finditer(text):
        output.append(escape(text[offset:match.start()]))
        position, flags, width, precision, length, conversion = match.groups()
        if position or conversion in "pn":
            raise ValueError("positional/pointer/writeback printf contract is not supported")
        if conversion == "%":
            output.append("%")
            offset = match.end()
            continue
        star_width, star_precision = None, None
        if width == "*":
            star_width = argument_name(index)
            arguments.append({"name": star_width, "type": "integer", "c_type": "int", "purpose": "width"})
            index += 1
        if precision == "*":
            star_precision = argument_name(index)
            arguments.append({"name": star_precision, "type": "integer", "c_type": "int", "purpose": "precision"})
            index += 1
        name = argument_name(index)
        index += 1
        kind = "text" if conversion == "s" else "integer" if conversion in "dic" else "unsigned" if conversion in "uoxX" else "floating-number"
        argument = {"name": name, "type": kind, "purpose": "value", "c_length_modifier": length or "",
                    "c_conversion": conversion, "source_format_specifier": match.group(),
                    "raw_visible_fallback": conversion == "s", "semantic_entity_binding": False}
        arguments.append(argument)
        spec = "%" + flags + ("*[" + star_width + "]" if star_width else width or "")
        if precision is not None:
            spec += "." + ("*[" + star_precision + "]" if star_precision else precision)
        spec += (length or "") + conversion
        output.append("{" + name + ":" + spec + "}")
        conversions.append({"argument": name, "source_specifier": match.group(), "catalog_specifier": spec,
                            "flags": flags, "width": width, "precision": precision, "length": length or "",
                            "width_argument": star_width, "precision_argument": star_precision, "conversion": conversion})
        offset = match.end()
    output.append(escape(text[offset:]))
    return "".join(output), arguments, conversions


def names(template):
    """Validate current plus additive Rust printf placeholder syntax."""
    result = set()
    offset = 0
    while offset < len(template):
        if template.startswith("{{", offset) or template.startswith("}}", offset):
            offset += 2
        elif template[offset] == "{":
            end = template.find("}", offset)
            if end < 0:
                raise ValueError("unclosed template")
            item = template[offset + 1:end]
            name, _, spec = item.partition(":")
            if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}", name):
                raise ValueError(f"invalid template argument: {name}")
            result.add(name)
            result.update(re.findall(r"\*\[([A-Za-z][A-Za-z0-9_]*)\]", spec))
            offset = end + 1
        elif template[offset] == "}":
            raise ValueError("unescaped closing brace")
        else:
            offset += 1
    return result


def whole_message(api, en, ja):
    if api == "verbalize":
        return '"' + en + '"', "「" + ja + "」"
    return PREFIX.get(api, "") + en, ja


def variants(api, english_literal, japanese):
    # These wrappers use a source-selected context, never translated text lookup.
    # Blind fallback retains the translated observation as quoted perception.
    if api == "You_feel":
        return {"dream": ("You dream that you feel " + english_literal, "夢の中で、" + japanese)}
    if api in ("You_hear", "You_hear1"):
        return {"dream": ("You dream that you hear " + english_literal, "夢の中で、" + japanese),
                "underwater": ("You barely hear " + english_literal, "水中でかすかに、" + japanese)}
    if api == "You_see":
        # The official helper says callers should already have caught Blind.
        # Preserve that rare helper branch without asserting actual vision.
        return {"dream": ("You dream that you see " + english_literal, "夢の中で、" + japanese),
                "blind": ("You sense " + english_literal, "「" + japanese + "」という様子を感じ取った。")}
    return {}


def add_message(store, row, origin):
    identifier, raw_en, raw_ja = row["id"], row["en"], row["ja"]
    calls = row["source_call_sites"]
    api = calls[0]["api"]
    if any(call["api"] != api for call in calls):
        raise ValueError("one candidate ID has conflicting helper APIs")
    en, ja = whole_message(api, raw_en, raw_ja)
    printf_like = row.get("format_semantics", "printf-like") == "printf-like"
    en_template, arguments, conversions = convert_printf(en, printf_like)
    permutation = row.get("japanese_to_official_arg_map")
    ja_template, ja_arguments, ja_conversions = convert_printf(ja, printf_like, permutation)
    en_formats = {a["name"]: a["source_format_specifier"] for a in arguments if a["purpose"] == "value"}
    ja_formats = {a["name"]: a["source_format_specifier"] for a in ja_arguments if a["purpose"] == "value"}
    if names(en_template) != names(ja_template) or en_formats != ja_formats:
        raise ValueError(f"EN/JA typed printf contract changed: {identifier}")
    record = {"id": identifier, "category": "message", "en": en_template, "ja": ja_template,
              "source_english_literal": raw_en, "source_japanese_literal": raw_ja,
              "source_call_sites": calls, "api": api, "format_semantics": row.get("format_semantics", "printf-like"),
              "arguments": arguments, "printf_conversions": conversions, "helper_prefix": PREFIX.get(api),
              "japanese_printf_conversions": ja_conversions, "japanese_to_official_arg_map": permutation,
              "helper_quotation": api == "verbalize", "origin": origin,
              "runtime_integration": False, "entity_binding_status": "raw-already-visible-string-until-source-semantic-binding"}
    if identifier in store:
        existing = store[identifier]
        if existing["source_english_literal"] != raw_en:
            raise ValueError("candidate ID/source English collision")
        if origin["kind"] == "jnethack-import" and existing["origin"]["kind"] == "authored-source-seed":
            existing.setdefault("deduplicated_jnethack_alternatives", []).append(record)
            return False
        if existing["ja"] != ja_template:
            raise ValueError(f"authored translation collision: {identifier}")
        known = {json.dumps(call, sort_keys=True) for call in existing["source_call_sites"]}
        existing["source_call_sites"].extend(call for call in calls if json.dumps(call, sort_keys=True) not in known)
        return False
    store[identifier] = record
    for variant, (variant_en, variant_ja) in variants(api, raw_en, raw_ja).items():
        variant_id = f"variant.{variant}.{identifier}"
        ve, va, vc = convert_printf(variant_en, printf_like)
        vj, _, _ = convert_printf(variant_ja, printf_like, permutation)
        if names(ve) != names(vj):
            raise ValueError("helper variant schema mismatch")
        store[variant_id] = {**record, "id": variant_id, "category": "helper-variant", "en": ve, "ja": vj,
                             "base_id": identifier, "helper_variant": variant, "arguments": va, "printf_conversions": vc,
                             "variant_translation_adaptation": "2026-10-02 source-informed Japanization wrapper; base authorship retained"}
    return True


def without_defines(text):
    lines, continuation = [], False
    for line in text.splitlines(keepends=True):
        remove = continuation or bool(re.match(r"\s*#\s*define\b", line))
        continuation = remove and line.rstrip().endswith("\\")
        lines.append("\n" if remove else line)
    return "".join(lines)


def macro_records(text, kind, scanner):
    text = without_defines(text)
    tokens = scanner.c_tokens(text)
    pairs = scanner.delimiters(tokens)
    result = {}
    object_macros = set("OBJECT GENERIC WEAPON PROJECTILE BOW ARMOR HELM CLOAK SHIELD GLOVES BOOTS DRGN_ARMR RING AMULET TOOL CONTAINER EYEWEAR WEPTOOL FOOD POTION SCROLL XTRA_SCROLL_LABEL SPELL WAND COIN GEM ROCK".split())
    allowed = {"MON"} if kind == "monster" else object_macros
    for index, token in enumerate(tokens[:-1]):
        if token.text not in allowed or tokens[index + 1].text != "(" or index + 1 not in pairs:
            continue
        args = scanner.call_arguments(tokens, index + 1, pairs[index + 1], text)
        if not args:
            continue
        key = args[-1]["expression"].strip()
        if not re.fullmatch(r"[A-Z][A-Z0-9_]+", key):
            continue
        if kind == "monster":
            literal_tokens = [t for t in args[0]["tokens"] if t.kind == "string"]
            slots = ["name_neutral"] if len(literal_tokens) == 1 else ["name_male", "name_female", "name_neutral"]
            if len(literal_tokens) not in (1, 3):
                raise ValueError(f"unexpected monster name cardinality: {key}")
        elif token.text == "OBJECT":
            literal_tokens = [t for t in args[0]["tokens"] if t.kind == "string"]
            # OBJ(name,desc) can omit either slot. Use lexical inner arguments.
            inner = args[0]["tokens"]
            inner_open = next((i for i,t in enumerate(inner) if t.text == "("), None)
            inner_text = args[0]["expression"]
            inner_tokens = scanner.c_tokens(inner_text)
            inner_pairs = scanner.delimiters(inner_tokens)
            inner_args = scanner.call_arguments(inner_tokens, 1, inner_pairs[1], inner_text)
            slots = []
            for slot, part in zip(["name", "appearance"], inner_args):
                if any(t.kind == "string" for t in part["tokens"]):
                    slots.append(slot)
        elif token.text == "GENERIC":
            literal_tokens = [t for t in args[0]["tokens"] if t.kind == "string"]
            slots = ["generic_class_label"]
        elif token.text == "XTRA_SCROLL_LABEL":
            literal_tokens = [t for t in args[0]["tokens"] if t.kind == "string"]
            slots = ["appearance"]
        else:
            literal_tokens, slots = [], []
            for slot, arg in zip(["name", "appearance"], args[:2]):
                strings = [t for t in arg["tokens"] if t.kind == "string"]
                if strings:
                    literal_tokens.extend(strings)
                    slots.extend([slot] * len(strings))
        values = [scanner.decode_c_string(t.text) for t in literal_tokens]
        if not values:
            continue
        if len(slots) != len(values) or key in result:
            raise ValueError(f"ambiguous entity field alignment: {key}")
        result[key] = {"key": key, "macro": token.text, "line": text.count("\n", 0, token.start) + 1,
                       "fields": list(zip(slots, values)), "configuration_guard": "lexical-record; includes disabled/configuration-dependent source records"}
    return result


def import_entities(store, checkout, official, inputs, scanner):
    counts = {}
    for kind, path in [("monster", "include/monsters.h"), ("object", "include/objects.h")]:
        en_text = normalized((official / path).read_bytes())
        ja_text = pinned(checkout, path, inputs)
        en = macro_records(en_text, kind, scanner)
        ja = macro_records(ja_text, kind, scanner)
        matched, slots, japanese_slots = 0, 0, 0
        for key in sorted(en.keys() & ja.keys()):
            er, jr = en[key], ja[key]
            if [field for field,_ in er["fields"]] != [field for field,_ in jr["fields"]]:
                raise ValueError(f"entity field cardinality changed: {key}")
            matched += 1
            for (field, english), (_, japanese) in zip(er["fields"], jr["fields"]):
                identifier = f"nethack.entity.{kind}.{key.lower()}.{field}"
                translated = english != japanese and bool(re.search(r"[\u3040-\u30ff\u3400-\u9fff]", japanese))
                store[identifier] = {"id": identifier, "category": f"{kind}-label", "en": escape(english),
                                     "ja": escape(japanese) if translated else None, "source_enum": key,
                                     "source_field": field, "source": path, "official_line": er["line"], "japanese_line": jr["line"],
                                     "source_english_literal": english, "source_japanese_literal": japanese,
                                     "arguments": [], "origin": {"kind": "jnethack-import", "commit": PIN, "path": path,
                                                                  "blob_sha256": inputs[path]["sha256"]},
                                     "configuration_guard": er["configuration_guard"],
                                     "knowledge_guard": "publish this descriptor ID only when native source already selected it as visible; never expose unidentified true type",
                                     "name_composition_guard": "source label/appearance fragment only; locale grammar, articles, inflection and shuffled appearance binding remain unimplemented",
                                     "runtime_integration": False}
                slots += 1
                japanese_slots += translated
        counts[kind] = {"official_records": len(en), "pinned_jnethack_records": len(ja), "matched_records": matched,
                        "label_slots": slots, "japanese_slots": japanese_slots,
                        "official_unmatched_keys": sorted(en.keys() - ja.keys()), "japanese_unmatched_keys": sorted(ja.keys() - en.keys())}
    return counts


LUA_TOKEN = re.compile(r"(?P<space>\s+)|(?P<comment>--\[(?P<ceq>=*)\[.*?\](?P=ceq)\]|--[^\n]*)|(?P<long>\[(?P<eq>=*)\[.*?\](?P=eq)\])|(?P<string>\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*')|(?P<identifier>[A-Za-z_][A-Za-z0-9_]*)|(?P<number>\d+)|(?P<punct>.)", re.S)


def lua_string(raw):
    if raw.startswith("["):
        match = re.match(r"\[(=*)\[", raw)
        value = raw[len(match.group()):-(len(match.group()))]
        return value[1:] if value.startswith("\n") else value
    content = raw[1:-1]
    escapes = {"a": "\a", "b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t", "v": "\v", "\\": "\\", '"': '"', "'": "'"}
    return re.sub(r"\\(\d{1,3}|x[0-9a-fA-F]{2}|.)", lambda m: chr(int(m[1])) if m[1].isdigit() else chr(int(m[1][1:],16)) if m[1].startswith("x") else escapes.get(m[1], m[1]), content)


def lua_leaves(text):
    tokens = [(m.lastgroup, m.group(), text.count("\n", 0, m.start()) + 1) for m in LUA_TOKEN.finditer(text) if m.lastgroup not in ("space", "comment")]
    index = next(i for i,t in enumerate(tokens) if t[1] == "questtext") + 2
    leaves = {}

    def value(path):
        nonlocal index
        kind, raw, line = tokens[index]
        if raw == "{":
            index += 1
            array_index = 1
            while tokens[index][1] != "}":
                key = array_index
                if tokens[index][0] == "identifier" and tokens[index + 1][1] == "=":
                    key = tokens[index][1]
                    index += 2
                elif tokens[index][1] == "[":
                    index += 1
                    key = lua_string(tokens[index][1]) if tokens[index][0] in ("string", "long") else int(tokens[index][1])
                    index += 1
                    if tokens[index][1] != "]" or tokens[index + 1][1] != "=":
                        raise ValueError("unsupported computed Lua key")
                    index += 2
                else:
                    array_index += 1
                value(path + (key,))
                if tokens[index][1] in (",", ";"):
                    index += 1
            index += 1
        elif kind in ("string", "long"):
            if path in leaves:
                raise ValueError("duplicate Lua leaf path")
            leaves[path] = {"text": lua_string(raw), "line": line}
            index += 1
        elif kind in ("number", "identifier"):
            index += 1
        else:
            raise ValueError(f"unsupported Lua value: {raw}")
    value(())
    return leaves


def quest_template(text):
    result, substitutions = [], []
    index = 0
    while index < len(text):
        if text[index] != "%":
            next_percent = text.find("%", index)
            next_percent = len(text) if next_percent < 0 else next_percent
            result.append(escape(text[index:next_percent]))
            index = next_percent
            continue
        if index + 1 >= len(text):
            raise ValueError("truncated quest substitution")
        code = text[index + 1]
        if code == "%":
            result.append("%")
            index += 2
            continue
        if code not in QUEST_NAMES:
            raise ValueError(f"unknown quest substitution: %{code}")
        modifier = text[index + 2] if index + 2 < len(text) and text[index + 2] in QUEST_MODIFIERS else ""
        # Official convert_line undoes its increment for an ineligible pronoun
        # suffix. In %shood, h is ordinary literal text, not a pronoun request.
        if modifier in "hHiIjJ" and code.lower() not in "dlno":
            modifier = ""
        name = "quest_" + QUEST_NAMES[code] + ("_modifier_" + modifier if modifier else "")
        result.append("{" + name + "}")
        substitutions.append({"name": name, "code": code, "modifier": modifier, "source_token": "%" + code + modifier,
                              "type": "text", "resolver_status": "requires-source-selected-per-locale-quest-substitution-and-name-grammar"})
        index += 2 + bool(modifier)
    return "".join(result), substitutions


def import_quest(store, checkout, official, inputs):
    path = "dat/quest.lua"
    source_bytes = (official / path).read_bytes()
    en = lua_leaves(normalized(source_bytes))
    ja = lua_leaves(pinned(checkout, path, inputs))
    authored_document = load(ROOT / "gameplay-quest-authored.ja.json")
    if authored_document["source_sha256"] != sha(source_bytes):
        raise ValueError("authored quest translations target a different official source blob")
    authored = authored_document["translations"]
    adaptations = authored_document.get("adapted_pinned_translations", {})
    authored_used = set()
    adaptations_used = set()
    matched = en.keys() & ja.keys()
    candidates, visible, japanese, pinned_japanese, compatible, missing, unresolved, union_only_codes = [], 0, 0, 0, 0, [], [], []
    for key in sorted(matched, key=str):
        if key[0] == "msg_fallbacks" or key[-1] == "output" or not (key[-1] in ("text", "synopsis") or isinstance(key[-1], int)):
            continue
        visible += 1
        english, japanese_text = en[key]["text"], ja[key]["text"]
        pinned_japanese += bool(re.search(r"[\u3040-\u30ff\u3400-\u9fff]", japanese_text))
        path_key = ".".join(map(str,key))
        pinned_original = japanese_text
        adapted_translation = path_key in adaptations
        if adapted_translation:
            japanese_text = adaptations[path_key]
            adaptations_used.add(path_key)
        authored_translation = path_key in authored
        if authored_translation:
            if re.search(r"[\u3040-\u30ff\u3400-\u9fff]", japanese_text):
                raise ValueError("authored synopsis would overwrite an existing pinned Japanese translation")
            japanese_text = authored[path_key]
            authored_used.add(path_key)
        translated = bool(re.search(r"[\u3040-\u30ff\u3400-\u9fff]", japanese_text))
        japanese += translated
        # Static path is a source semantic key, not an English phrase lookup.
        parts = [f"item_{x}" if isinstance(x,int) else re.sub(r"[^A-Za-z0-9_]", "_", x).lower() for x in key]
        identifier = "nethack.quest." + ".".join(parts)
        et, ea = quest_template(english)
        jt, jaa = quest_template(japanese_text)
        schema_equal = names(et) == names(jt)
        record = {"id": identifier, "category": "quest-text", "path": list(key), "source": path,
                  "official_line": en[key]["line"], "japanese_line": ja[key]["line"],
                  "source_english_literal": english, "source_japanese_literal": japanese_text,
                  "en": et, "ja": jt if translated else None, "arguments": ea,
                  "japanese_substitutions": jaa, "origin": {"kind": "jnethack-import", "commit": PIN, "path": path, "blob_sha256": inputs[path]["sha256"]},
                  "source_substitution_grammar": "questpgr.c convert_arg/convert_line, not C printf",
                  "resolver_guard": "all quest substitutions must be source-selected and locale-aware; catalog alone does not implement pronouns/articles/inflection or reveal hidden entities",
                  "runtime_integration": False, "japanese_argument_schema_equal": schema_equal}
        union = sorted(names(et) | names(jt)) if translated else sorted(names(et))
        all_arguments = {a["name"]: a for a in ea + jaa}
        record["argument_schema"] = union
        record["arguments"] = [all_arguments[name] for name in union]
        record["english_substitutions"] = ea
        record["source_base_capture_contract"] = "capture convert_arg base once before original modifier; capture modified result after original branch; derive JA-only unmodified slot from that base without engine recall/RNG"
        if authored_translation:
            record["origin"] = {"kind": "authored-quest-translation", "date": "2026-10-02", "path": path, "input": "gameplay-quest-authored.ja.json", "official_sha256": sha(source_bytes)}
            record["pinned_japanese_original_literal"] = ja[key]["text"]
        if adapted_translation:
            record["pinned_japanese_original_literal"] = pinned_original
            record["origin"]["authored_adaptation"] = {"date": "2026-10-02", "input": "gameplay-quest-authored.ja.json", "notice": authored_document["adaptation_notice"]}
        new_codes = sorted({a["code"] for a in jaa} - {a["code"] for a in ea})
        record["japanese_source_codes_not_in_original_english"] = new_codes
        if new_codes:
            union_only_codes.append({"id": identifier, "codes": new_codes, "guard": "must not resolve uncaptured native context or reveal unknown identity; needs explicit already-public source snapshot evidence"})
        store[identifier] = record
        candidates.append(identifier)
        if translated and schema_equal:
            compatible += 1
        elif translated:
            unresolved.append({"id": identifier, "reason": "declared source-public argument union required; per-locale subsets preserve original modifiers and gender", "en_argument_names": sorted(names(et)), "ja_argument_names": sorted(names(jt)), "japanese_candidate_template": jt})
    for key in sorted(en.keys() - ja.keys(), key=str):
        missing.append(list(key))
        if key[0] == "msg_fallbacks" or key[-1] == "output" or not (key[-1] in ("text", "synopsis") or isinstance(key[-1], int)):
            continue
        parts = [f"item_{x}" if isinstance(x,int) else re.sub(r"[^A-Za-z0-9_]", "_", x).lower() for x in key]
        identifier = "nethack.quest." + ".".join(parts)
        et, ea = quest_template(en[key]["text"])
        path_key = ".".join(map(str,key))
        japanese_text = authored.get(path_key)
        jt, jaa = quest_template(japanese_text) if japanese_text else (None, [])
        union = sorted(names(et) | (names(jt) if jt else set()))
        all_arguments = {a["name"]: a for a in ea + jaa}
        if japanese_text:
            authored_used.add(path_key)
        store[identifier] = {"id": identifier, "category": "quest-text", "path": list(key), "source": path,
                             "official_line": en[key]["line"], "source_english_literal": en[key]["text"],
                             "source_japanese_literal": japanese_text, "en": et, "ja": jt,
                             "arguments": [all_arguments[name] for name in union], "argument_schema": union,
                             "english_substitutions": ea, "japanese_substitutions": jaa,
                             "origin": {"kind": "authored-quest-translation" if jt else "official-english-fallback", "commit": OFFICIAL_COMMIT, "path": path, "date": "2026-10-02"},
                             "runtime_integration": False, "pinned_source_status": "official visible source leaf absent from pinned JNetHack"}
    if authored_used != set(authored):
        raise ValueError(f"authored quest paths did not match source: {sorted(set(authored) - authored_used)}")
    if adaptations_used != set(adaptations):
        raise ValueError("adapted quest paths did not match pinned source")
    if union_only_codes:
        raise ValueError("Japanese quest translation introduced official-source-absent state codes")
    return {"official_string_leaves": len(en), "pinned_jnethack_string_leaves": len(ja), "matched_string_paths": len(matched),
            "visible_matched_paths": visible, "pinned_japanese_visible_candidates": pinned_japanese,
            "japanese_visible_candidates_after_authoring": japanese, "english_visible_fallbacks": visible - japanese,
            "authored_japanese_paths": len(authored_used), "authored_pinned_adaptations": len(adaptations_used), "japanese_catalog_strict_schema_compatible": compatible,
            "japanese_declared_union_schema_paths": len(unresolved), "japanese_only_source_code_paths": len(union_only_codes),
            "missing_official_paths": missing, "union_binding_contracts": unresolved, "japanese_only_source_code_guards": union_only_codes}


def self_test():
    class SourceCatalogContractTests(unittest.TestCase):
        def test_radix_width_precision_and_literal_braces(self):
            template, arguments, conversions = convert_printf("0x%02x / %.3s / %% / {literal}")
            self.assertEqual(template, "0x{arg_1:%02x} / {arg_2:%.3s} / % / {{literal}}")
            self.assertEqual([a["type"] for a in arguments], ["unsigned", "text"])
            self.assertEqual(conversions[1]["precision"], "3")

        def test_star_slots_are_not_lost(self):
            template, arguments, _ = convert_printf("%*.*s")
            self.assertEqual(template, "{arg_3:%*[arg_1].*[arg_2]s}")
            self.assertEqual(names(template), {"arg_1", "arg_2", "arg_3"})
            self.assertEqual([a["purpose"] for a in arguments], ["width", "precision", "value"])

        def test_japanese_permutation_keeps_native_argument_identity(self):
            template, arguments, _ = convert_printf("%sの%s", argument_map={"arg_1": "arg_2", "arg_2": "arg_1"})
            self.assertEqual(template, "{arg_2:%s}の{arg_1:%s}")
            self.assertEqual([a["name"] for a in arguments], ["arg_2", "arg_1"])

        def test_character_is_c_promoted_integer(self):
            _, arguments, _ = convert_printf("%c")
            self.assertEqual(arguments[0]["type"], "integer")
            self.assertEqual(arguments[0]["c_conversion"], "c")

        def test_unsafe_pointer_writeback_contract_rejected(self):
            for source in ("%p", "%n", "%1$s"):
                with self.assertRaises(ValueError):
                    convert_printf(source)

        def test_quest_modifiers_and_locale_subsets_remain_explicit(self):
            english, ea = quest_template("%nC defeats %ni; %%")
            japanese, ja = quest_template("%nが倒した。")
            self.assertEqual(english, "{quest_quest_nemesis_modifier_C} defeats {quest_quest_nemesis_modifier_i}; %")
            self.assertEqual(japanese, "{quest_quest_nemesis}が倒した。")
            union = names(english) | names(japanese)
            self.assertEqual(len(union), 3)
            self.assertEqual([x["modifier"] for x in ea], ["C", "i"])
            self.assertEqual(ja[0]["modifier"], "")

        def test_pronoun_suffix_eligibility_matches_official_convert_line(self):
            template, substitutions = quest_template("%shood %sHood %Di %Oi")
            self.assertEqual(template, "{quest_sibling_term}hood {quest_sibling_term}Hood {quest_lawful_deity_modifier_i} {quest_short_quest_artifact_modifier_i}")
            self.assertEqual([item["modifier"] for item in substitutions], ["", "", "i", "i"])

        def test_lua_paths_long_strings_arrays_and_comments(self):
            leaves = lua_leaves('questtext = { -- ignored "fake"\n Arc = { a = { text = [[\nhello]], "one", "two\\n" } } }')
            self.assertEqual(leaves[("Arc", "a", "text")]["text"], "hello")
            self.assertEqual(leaves[("Arc", "a", 2)]["text"], "two\n")

        def test_visible_entity_slot_pairing(self):
            scanner = module(ROOT.parent / "tools/inventory_source.py", "gameplay_entity_test_scanner")
            monsters = macro_records('MON(NAMS("king", "queen", "ruler"), 0, RULER),', "monster", scanner)
            self.assertEqual(monsters["RULER"]["fields"], [("name_male", "king"), ("name_female", "queen"), ("name_neutral", "ruler")])
            objects = macro_records('EYEWEAR("lenses", "glass", 0, LENSES),', "object", scanner)
            self.assertEqual(objects["LENSES"]["fields"], [("name", "lenses"), ("appearance", "glass")])

        def test_helper_state_and_quotations_are_source_informed(self):
            self.assertEqual(whole_message("verbalize", "Hello", "こんにちは"), ('"Hello"', "「こんにちは」"))
            self.assertEqual(variants("You_hear", "a noise.", "音が聞こえる。")["underwater"][0], "You barely hear a noise.")
            self.assertEqual(variants("You_see", "something.", "何かが見える。")["blind"][0], "You sense something.")
    result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(SourceCatalogContractTests))
    return result.wasSuccessful()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--jnethack", type=Path, default=DEFAULT_CHECKOUT)
    parser.add_argument("--official-source", type=Path, default=ROOT.parent.parent / "official-source-audit" / "NetHack-5.0.0")
    parser.add_argument("--self-test", action="store_true", help="run lightweight parser/schema regression checks without writing catalogs")
    args = parser.parse_args()
    if args.self_test:
        if not self_test():
            raise SystemExit(1)
        return
    inputs, store = {}, {}
    seed = load(ROOT / "source-seed.metadata.json")["entries"]
    extra = load(ROOT.parent / "tools/source-seed-fragments/combat-inventory-detection-extra.json")
    seeds = seed + extra
    frozen = {str(path.relative_to(ROOT.parent)): sha(path.read_bytes()) for path in [ROOT / "source-seed.en.json", ROOT / "source-seed.ja.json", ROOT / "source-seed.metadata.json", ROOT / "translation-status.json", ROOT.parent / "catalog/source-text-messages.json"]}
    for row in seeds:
        add_message(store, row, {"kind": "authored-source-seed", "attribution": "2026 Codex source-reviewed authored translation", "inputs": ["source-seed.metadata.json", "../tools/source-seed-fragments/combat-inventory-detection-extra.json"]})
    unique_seed_ids = {r["id"] for r in seeds}
    if len(unique_seed_ids) != 483:
        raise ValueError(f"expected 483 validated seed IDs, got {len(unique_seed_ids)}")
    calls = module(ROOT / "gameplay-reuse-calls.py", "gameplay_reuse_calls")
    reused = calls.extract(args.jnethack, args.official_source, ROOT.parent / "catalog/source-text-messages.json")
    imported_ids, deduplicated_ids = set(), set()
    for row in reused.get("all_candidates", reused["candidates"]):
        for identifier in row["official_ids"]:
            exact_calls = [c for c in row["official_call_sites"] if c.get("english_id_candidate", c.get("id")) == identifier]
            if not exact_calls:
                raise ValueError("missing exact source call evidence")
            source_calls = [{k: c[k] for k in ("source", "line", "function_candidate", "api", "format_argument_index", "argument_expressions", "argument_binding")} for c in exact_calls]
            new_row = {"id": identifier, "en": row["en"], "ja": row["ja"], "source_call_sites": source_calls,
                       "format_semantics": row.get("format_semantics", "printf-like"),
                       "japanese_to_official_arg_map": row.get("japanese_to_official_arg_map")}
            origin = {"kind": "jnethack-import", "commit": PIN, "path": row["source"], "japanese_line": row["japanese_line"],
                      "blob_sha256": row["jnet_blob_sha256"], "match_method": row.get("evidence", "exact-entire-official-call-and-ordered-printf-and-argument-expressions"),
                      "argument_permutation": row.get("argument_permutation", False), "canonical_argument_evidence": row.get("canonical_argument_evidence"), "control_flow_imported": False}
            if identifier in unique_seed_ids:
                deduplicated_ids.add(identifier)
            else:
                imported_ids.add(identifier)
            add_message(store, new_row, origin)
    inputs.update(reused.get("input_blobs", {}))
    scanner = module(ROOT.parent / "tools/inventory_source.py", "source_inventory_for_gameplay")
    entity_counts = import_entities(store, args.jnethack, args.official_source, inputs, scanner)
    quest_counts = import_quest(store, args.jnethack, args.official_source, inputs)
    store["context.location_prefix"] = {"id": "context.location_prefix", "category": "context-grammar",
                                        "en": "{location}: {text}", "ja": "{location}：{text}",
                                        "arguments": [{"name": "location", "type": "text", "raw_visible_fallback": True}, {"name": "text", "type": "text"}],
                                        "origin": {"kind": "source-informed-adapter", "source": "src/pline.c", "date": "2026-10-02"},
                                        "runtime_integration": False, "japanese_used_fallback": True,
                                        "knowledge_guard": "only already-computed accessibility qualifier captured by native context; raw qualifier not translated"}
    for identifier, english, japanese in [
        ("nethack.name.empty", "", ""),
        ("nethack.name.adjective.invisible", "invisible ", "透明な"),
        ("nethack.name.adjective.saddled", "saddled ", "鞍を付けた"),
        ("nethack.name.monster", "{article}{invisible}{saddled}{name}", "{invisible}{saddled}{name}"),
    ]:
        record = {"id": identifier, "category": "name-grammar", "en": english, "ja": japanese,
                  "origin": {"kind": "authored-source-informed-name-grammar", "source": "src/monnam.c", "date": "2026-10-02"},
                  "runtime_integration": False,
                  "knowledge_guard": "only exact native completed ordinary monster-name branch and final article capture; never recall gender/name helpers or expose unidentified true type",
                  "excluded_branches": ["arbitrary adjective", "custom name", "priest", "shopkeeper", "hallucination", "player monster rank", "capitalized descriptor"],
                  "arguments": []}
        if identifier == "nethack.name.monster":
            record["argument_schema"] = ["article", "invisible", "saddled", "name"]
            record["arguments"] = [{"name": "article", "type": "text", "purpose": "exact-already-computed-English-article-prefix"}] + [{"name": name, "type": "text_id", "purpose": "already-public-no-argument-label"} for name in ["invisible", "saddled", "name"]]
        store[identifier] = record
    object_presentation_path = "src/objnam.c"
    object_presentation = pinned(args.jnethack, object_presentation_path, inputs)
    recipe_names = "label amulet_appearance potion_name potion_appearance scroll_name scroll_label scroll_appearance wand_name wand_appearance ring_name ring_appearance spellbook_name spellbook_appearance gem_appearance stone_appearance gem_stone".split()
    for recipe in recipe_names:
        identifier = f"nethack.name.object.{recipe}"
        store[identifier] = {"id": identifier, "category": "object-name-grammar", "en": "{original}",
                             "ja": "{name}薬" if recipe == "potion_appearance" else "{name}",
                             "argument_schema": ["original", "name"],
                             "arguments": [{"name": "original", "type": "text", "purpose": "exact-native-completed-name"}, {"name": "name", "type": "text_id", "purpose": "source-selected-public-name-or-appearance-label"}],
                             "origin": {"kind": "jnethack-import", "commit": PIN, "path": object_presentation_path, "blob_sha256": inputs[object_presentation_path]["sha256"], "authored_adaptation": {"date": "2026-10-02", "notice": "selected original class recipe plus paired Japanese full-label composition; no source gameplay logic imported"}},
                             "runtime_integration": False,
                             "knowledge_guard": "exact native source name/appearance selection and completed branch snapshot only; never identify hidden effect, call native naming twice or infer shuffle from true type",
                             "composition_guard": "imported Japanese labels already include class nouns except potion appearance adjective; no duplicate class suffix; scroll inscription slot already contains full labeled-scroll phrase",
                             "excluded_branches": ["custom called/name", "blessed/cursed water", "diluted potion", "corpse/statue species", "novel title", "artifact override", "pluralization", "arbitrary prefix/suffix", "capitalized descriptor"]}
    for class_name, english, japanese in [
        ("amulet", "amulet", "魔除け"), ("potion", "potion", "薬"), ("scroll", "scroll", "巻物"),
        ("wand", "wand", "杖"), ("ring", "ring", "指輪"), ("spellbook", "spellbook", "魔法書"),
        ("book", "book", "本"), ("gem", "gem", "宝石"), ("stone", "stone", "石"),
        ("shield", "shield", "盾"), ("smooth_shield", "smooth shield", "すべすべした盾"),
    ]:
        if '"' + japanese + '"' not in object_presentation:
            raise ValueError("generic object noun missing from pinned Japanese presentation source")
        identifier = f"nethack.name.object.generic.{class_name}"
        store[identifier] = {"id": identifier, "category": "object-name-grammar", "en": english, "ja": japanese, "arguments": [],
                             "origin": {"kind": "jnethack-import", "commit": PIN, "path": object_presentation_path, "blob_sha256": inputs[object_presentation_path]["sha256"], "authored_adaptation": {"date": "2026-10-02", "notice": "source-selected generic noun assigned English semantic ID"}},
                             "runtime_integration": False, "knowledge_guard": "only generic noun already selected by original native name branch; no hidden type/effect lookup"}
    readme = pinned(args.jnethack, "READMEj1.txt", inputs)
    license_text = pinned(args.jnethack, "dat/license", inputs)
    catalog = {"en": {}, "ja": {}, "argument_schemas": {}}
    for identifier, row in sorted(store.items()):
        catalog["en"][identifier] = row["en"]
        if "argument_schema" in row:
            declared = set(row["argument_schema"])
            if not names(row["en"]) <= declared or row.get("ja") is not None and not names(row["ja"]) <= declared:
                raise ValueError(f"undeclared quest argument: {identifier}")
            catalog["argument_schemas"][identifier] = sorted(declared)
        if row.get("ja") is not None:
            if "argument_schema" not in row and names(row["en"]) != names(row["ja"]):
                raise ValueError(f"schema mismatch: {identifier}")
            catalog["ja"][identifier] = row["ja"]
    if not catalog["ja"].keys() <= catalog["en"].keys():
        raise ValueError("Japanese entries missing English")
    categories = Counter(row["category"] for row in store.values())
    imported_paths = set()
    for row in store.values():
        for imported in [row] + row.get("deduplicated_jnethack_alternatives", []):
            if imported["origin"]["kind"] == "jnethack-import":
                imported_paths.add(imported["origin"]["path"])
    metadata = {"schema_version": 1, "generated_date": "2026-10-02", "source_tree": "NetHack-5.0.0", "official_commit": OFFICIAL_COMMIT,
                "runtime_catalog": "gameplay-core.json", "schema": "Rust Catalog {en:{EnglishSemanticID:template},ja:{EnglishSemanticID:template},argument_schemas:{sourceID:[source-public argument name union]}}",
                "template_contract": {"arguments": "existing source seed names arg_1,arg_2 preserved; sourceC vararg order", "printf": "{arg_1:%ld}; dynamic width/precision {arg_3:%*[arg_1].*[arg_2]s}; exact flags/width/precision/length retained",
                                      "braces": "literal braces escaped as {{ and }}", "helper_variants": "variant.<dream|underwater|blind>.<baseID> source-selected immutable context", "dynamic_strings": "raw already-visible fallback until source semantic identity binding", "quest": "named exact sourcecode+modifier; per-locale subsets of explicitly declared source-public union; locale resolver required; no hidden padding slots"},
                "counts": {"authored_seed_ids": len(unique_seed_ids), "jnethack_exact_call_candidates": len(reused["candidates"]),
                           "jnethack_broader_source_pair_candidates": len(reused.get("broader_candidates", [])), "jnethack_broader_extraction": reused.get("broader_counts", {}),
                           "jnethack_distinct_call_ids": len(imported_ids | deduplicated_ids), "jnethack_message_ids_added": len(imported_ids), "jnethack_message_ids_deduplicated": len(deduplicated_ids),
                           "categories": dict(categories), "english_catalog_ids": len(catalog["en"]), "japanese_catalog_ids": len(catalog["ja"]), "english_fallback_ids": len(catalog["en"]) - len(catalog["ja"]),
                           "max_id_bytes": max(map(len, catalog["en"])), "entities": entity_counts, "quest": quest_counts},
                "runtime_integration": False, "runtime_localized_message_count": 0, "runtime_coverage_claim": "not-tested-or-integrated-by-this-catalog-generator",
                "full_japanese_coverage": False, "source_event_guard": "source IDs and typed args captured before printf only; runtime rendered-English reverse mapping prohibited",
                "provenance": {"jnethack": {"origin": ORIGIN, "pinned_commit": PIN, "tag_description": "v5.0.0-0.2", "read_method": "git show pinned-commit:path; dirty worktree excluded", "authors": JNET_AUTHORS,
                                             "imported_paths": sorted(imported_paths),
                                             "original_readme_copyright_license_notice": readme, "original_netHack_general_public_license": license_text, "input_blobs": inputs,
                                             "modifications": "2026-10-02: source alignment, English semantic ID assignment, escaped named templates and source-informed helper wrappers; imported base Japanese literals preserved",
                                             "corresponding_source_requirement": "distribution must include pinned imported source blobs, READMEj1.txt, dat/license, this builder/helper and generated provenance; parent packaging verification pending"},
                               "frozen_input_sha256": frozen}, "entries": [store[k] for k in sorted(store)]}
    for name, value in [("gameplay-core.en.json", catalog["en"]), ("gameplay-core.ja.json", catalog["ja"]), ("gameplay-core.json", catalog), ("gameplay-core.metadata.json", metadata)]:
        (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    for relative, expected in frozen.items():
        if sha((ROOT.parent / relative).read_bytes()) != expected:
            raise ValueError(f"frozen input changed: {relative}")
    console_counts = {**metadata["counts"], "quest": {k: v for k,v in quest_counts.items() if k not in ("union_binding_contracts", "japanese_only_source_code_guards")}}
    print(json.dumps(console_counts, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
