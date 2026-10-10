#!/usr/bin/env python3
"""Inventory an immutable NetHack tree; never write inside that tree.

This is lexical evidence, not a C preprocessor, Lua interpreter, translation,
or proof of gameplay parity. All outputs record that distinction explicitly.
Only Python's standard library is required.
"""
from __future__ import annotations

import argparse
import bisect
import hashlib
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path


SUBSYSTEMS = {
    "turn_state_rng": ("Turn scheduling, global state, deterministic randomness", "allmain decl isaac64 rnd track"),
    "identity_progression": ("Roles, initial inventory, attributes, alignment, experience", "attrib exper role u_init insight"),
    "movement_terrain": ("Movement, doors, stairs, bridges, digging, light and visibility", "hack dig lock dbridge stairs vision light"),
    "level_generation": ("Dungeon branches, room/maze/map generation and special levels", "dungeon mklev mkmap mkmaze mkroom extralev sp_lev rect region selvar"),
    "object_identity": ("Object definitions, creation, naming, artifacts and identification", "objects mkobj o_init objnam artifact do_name"),
    "inventory_equipment": ("Inventory, pickup, wielding, armor, equipment effects and punishment", "invent pickup do_wear wield worn weapon ball"),
    "player_actions": ("Command routing, occupations, kicking, throwing, applying and writing", "cmd do dokick dothrow apply iactions getpos write"),
    "combat_projectiles": ("Player/monster combat, damage, monster throwing and explosions", "uhitm mhitu mhitm mthrowu explode"),
    "monsters_ai": ("Monster definitions, creation, movement, items, pets and special identities", "monst mondata makemon mon monmove dog dogmove muse minion mplayer were worm steed steal"),
    "magic_status": ("Spells, monster casting, potions, scrolls, wands, polymorph and timed effects", "spell mcastu potion read zap polyself timeout detect"),
    "survival_hazards": ("Eating, hunger, traps, fountains, sitting and teleportation", "eat trap fountain sit teleport"),
    "religion_quests_endgame": ("Prayer, priests, role quests, quest prose, wizard and victory", "pray priest quest questpgr wizard end rip"),
    "economy_world_interactions": ("Shops, bills, shopkeeper names, vaults, engraving, music and ambience", "shk shknam vault engrave music sounds"),
    "persistence_scores": ("Save/restore, bones, files, record lists and serialization formats", "save restore bones files topten sfbase sfstruct"),
    "presentation_text": ("Glyphs, drawing, status, messages, help, rumors and window abstraction", "display drawing glyphs botl pline pager rumors windows symbols utf8map coloratt report nhlsel"),
    "configuration_platform": ("Options, configuration, startup arguments, OS services, mail and version", "options cfgfiles earlyarg sys mail version date calendar"),
    "runtime_libraries": ("Allocation, utilities, data library, Lua bridge, MD4 and generic object support", "alloc hacklib strutil dlb nhlua nhmd4 nhlobj mdlib"),
    "debug_tools": ("Wizard commands and diagnostics", "wizcmds"),
}
FILE_SUBSYSTEM = {name: key for key, (_, names) in SUBSYSTEMS.items() for name in names.split()}

# The format argument index follows the upstream API signature. Calls with
# computed/conditional formats remain unresolved instead of inventing English.
MESSAGE_SINKS = {
    **{name: 0 for name in (
        "pline pline1 urgent_pline pline_The Norep You Your You_feel You_cant You_hear You_see "
        "There verbalize raw_print raw_print_bold raw_printf impossible panic "
        "config_error_add Your1 You1 verbalize1 You_hear1 panic1 "
        "dumplogmsg putmsghistory genl_putmsghistory exit_nhwindows suspend_nhwindows"
    ).split()},
    "custompline": 1,
    "pline_dir": 1,
    "pline_xy": 2,
    "pline_mon": 1,
    "livelog_printf": 1,
    "dump_forward_putstr": 2,
    "putstr": 2,
    "putmixed": 2,
    # 5.0 adds a color argument: text is the eighth parameter (zero-based 7).
    "add_menu": 7,
    "add_menu_str": 1,
    "end_menu": 1,
    "message_menu": 2,
    "livelog_add": 1,
    "gamelog_add": 2,
    "add_menu_heading": 1,
    "getlin": 0,
    "yn_function": 0,
    "ynq": 0,
    "y_n": 0,
    "nyaq": 0,
    "nyNaq": 0,
    "YN": 0,
    "ynNaq": 0,
    "ynaq": 0,
}
FORMATTERS = {"Sprintf": 1, "Sprintf1": 1, "sprintf": 1, "Snprintf": 2, "snprintf": 2}
PLAIN_TEXT_SINKS = set("pline1 Your1 You1 verbalize1 You_hear1 panic1 Sprintf1 raw_print raw_print_bold putstr putmixed add_menu add_menu_str add_menu_heading end_menu message_menu livelog_add gamelog_add dumplogmsg putmsghistory genl_putmsghistory exit_nhwindows suspend_nhwindows getlin yn_function ynq y_n nyaq nyNaq YN ynNaq ynaq dump_forward_putstr".split())
C_SOURCE_EXTENSIONS = {".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx"}
RNG_NAMES = set("rn2 rnd rn1 d rnl rne rnz random rn2_on_display_rng init_random set_random".split())
C_PATTERN = re.compile(
    r"(?P<comment>/\*.*?\*/|//[^\n]*)|"
    r'(?P<rawstring>(?:u8|[uUL])?R"(?P<delimiter>[^\s()\\]{0,16})\((?P<rawbody>[\s\S]*?)\)(?P=delimiter)")|'
    r'(?P<string>(?:u8|[uUL])?"(?:\\[\s\S]|[^"\\])*")|'
    r"(?P<char>(?:[uUL])?'(?:\\[\s\S]|[^'\\])*')|"
    r"(?P<identifier>[A-Za-z_]\w*)|(?P<space>\s+)|(?P<other>.)", re.S
)
PRINTF_PATTERN = re.compile(r"%(?:\d+\$)?[-+ #0']*(?:\*|\d+)?(?:\.(?:\*|\d+))?(?:hh|ll|[hljztL])?[diuoxXfFeEgGaAcspn%]")


@dataclass
class Token:
    kind: str
    text: str
    start: int
    end: int


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def lines_of(text: str) -> list[int]:
    return [0] + [match.end() for match in re.finditer("\n", text)]


def at_line(offset: int, line_starts: list[int]) -> int:
    return bisect.bisect_right(line_starts, offset)


def read_text(path: Path) -> tuple[str | None, str | None]:
    raw = path.read_bytes()
    if b"\x00" in raw:
        return None, None
    try:
        return raw.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        # Lossless byte-to-codepoint fallback, with the encoding disclosed.
        return raw.decode("latin-1"), "latin-1-byte-preserving"


def decode_c_string(raw: str) -> str:
    raw_match = re.fullmatch(r'(?:u8|[uUL])?R"([^\s()\\]{0,16})\(([\s\S]*)\)\1"', raw)
    if raw_match:
        return raw_match.group(2)
    body = raw[raw.index('"') + 1:-1]
    escapes = {"a": "\a", "b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t", "v": "\v", "\\": "\\", '"': '"', "'": "'", "?": "?"}
    pattern = r"\\(?:\r?\n|x[0-9A-Fa-f]+|[0-7]{1,3}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|.)"

    def replace(match: re.Match[str]) -> str:
        value = match.group()[1:]
        if value in ("\n", "\r\n"):
            return ""
        if value in escapes:
            return escapes[value]
        try:
            if value[0] in "xuU":
                return chr(int(value[1:], 16))
            if value[0] in "01234567":
                return chr(int(value, 8))
        except (ValueError, OverflowError):
            pass
        return "\\" + value

    return re.sub(pattern, replace, body)


def semantic_candidate(namespace: str, text: str) -> str:
    words = re.findall(r"[a-z][a-z0-9]*", text.lower())[:7]
    phrase = "_".join(words)[:80] or "symbol_or_empty"
    # Names convey the source subsystem/function and English phrase. The suffix
    # disambiguates repeated strings; it is not the semantic namespace itself.
    return namespace + "." + phrase + "." + digest_bytes(text.encode("utf-8"))[:10]


def c_tokens(text: str) -> list[Token]:
    return [Token("string" if m.lastgroup == "rawstring" else m.lastgroup or "other", m.group(), m.start(), m.end()) for m in C_PATTERN.finditer(text) if m.lastgroup not in ("space", "comment")]


def delimiters(tokens: list[Token]) -> dict[int, int]:
    pairs: dict[int, int] = {}
    stack: list[tuple[str, int]] = []
    opens = {"(": ")", "[": "]", "{": "}"}
    for index, token in enumerate(tokens):
        if token.kind in ("string", "char"):
            continue
        if token.text in opens:
            stack.append((token.text, index))
        elif token.text in opens.values():
            if stack and opens[stack[-1][0]] == token.text:
                _, start = stack.pop()
                pairs[start] = index
                pairs[index] = start
            # Conditional-preprocessor branches can unbalance lexical braces.
            # Do not guess matches across an unmatched delimiter.
    return pairs


def function_regions(tokens: list[Token], pairs: dict[int, int], line_starts: list[int]) -> list[dict]:
    regions = []
    for index, token in enumerate(tokens):
        if token.text != "{" or index < 3 or tokens[index - 1].text != ")":
            continue
        opening = pairs.get(index - 1)
        closing = pairs.get(index)
        if opening is None or closing is None or opening < 1:
            continue
        name = tokens[opening - 1]
        if name.kind != "identifier" or name.text in {"if", "while", "for", "switch"}:
            continue
        if any(r["start"] <= name.start <= r["end"] for r in regions):
            continue
        regions.append({"name": name.text, "line": at_line(name.start, line_starts), "end_line": at_line(tokens[closing].end, line_starts), "start": name.start, "end": tokens[closing].end})
    return regions


def context_function(offset: int, regions: list[dict]) -> str:
    for region in regions:
        if region["start"] <= offset < region["end"]:
            return region["name"]
    return "file_scope"


def call_arguments(tokens: list[Token], opening: int, closing: int, text: str) -> list[dict]:
    result = []
    beginning = opening + 1
    depth = 0
    for index in range(beginning, closing + 1):
        token = tokens[index]
        if index == closing or (token.text == "," and depth == 0):
            part = tokens[beginning:index]
            if part:
                result.append({"expression": text[part[0].start:part[-1].end], "tokens": part})
            elif index != closing:
                result.append({"expression": "", "tokens": []})
            beginning = index + 1
        elif token.kind not in ("string", "char"):
            if token.text in ("(", "[", "{"):
                depth += 1
            elif token.text in (")", "]", "}"):
                depth -= 1
    return result


def scan_c(relative: str, text: str) -> tuple[list[dict], list[dict], list[dict], Counter, list[dict]]:
    tokens = c_tokens(text)
    line_starts = lines_of(text)
    pairs = delimiters(tokens)
    regions = function_regions(tokens, pairs, line_starts)
    literals, messages, formatters, calls = [], [], [], Counter()
    module = Path(relative).stem.lower()
    for token in tokens:
        if token.kind != "string":
            continue
        value = decode_c_string(token.text)
        fn = context_function(token.start, regions)
        literals.append({"source": relative, "line": at_line(token.start, line_starts), "function_candidate": fn, "raw_literal": token.text, "english_source_literal": value, "english_id_candidate": semantic_candidate(f"nethack.source.{module}.{fn.lower()}", value), "status": "lexical-string-not-reviewed-for-user-visibility"})
    for index in range(len(tokens) - 1):
        token = tokens[index]
        if token.kind != "identifier" or tokens[index + 1].text != "(":
            continue
        closing = pairs.get(index + 1)
        if closing is None:
            continue
        if closing + 1 < len(tokens) and tokens[closing + 1].text == "{":
            continue
        if token.text in {"if", "while", "for", "switch", "sizeof", "_Alignof"}:
            continue
        calls[token.text] += 1
        if token.text not in MESSAGE_SINKS and token.text not in FORMATTERS:
            continue
        args = call_arguments(tokens, index + 1, closing, text)
        fmt_index = (MESSAGE_SINKS | FORMATTERS)[token.text]
        fmt_arg = args[fmt_index] if fmt_index < len(args) else None
        fn = context_function(token.start, regions)
        literal_tokens = fmt_arg["tokens"] if fmt_arg else []
        exact = bool(literal_tokens) and all(t.kind == "string" for t in literal_tokens)
        literal = "".join(decode_c_string(t.text) for t in literal_tokens) if exact else None
        namespace = f"nethack.message.{module}.{fn.lower()}.{token.text.lower()}"
        printf_like = token.text not in PLAIN_TEXT_SINKS
        record = {"source": relative, "line": at_line(token.start, line_starts), "function_candidate": fn, "api": token.text, "format_argument_index": fmt_index, "argument_expressions": [a["expression"] for a in args], "format_expression": fmt_arg["expression"] if fmt_arg else None, "english_source_template": literal, "english_id_candidate": semantic_candidate(namespace, literal) if exact else None, "format_semantics": "printf-like" if printf_like else "plain-display-text", "format_specifiers": [m.group() for m in PRINTF_PATTERN.finditer(literal or "") if m.group() != "%%"] if printf_like else [], "argument_binding": [{"id_candidate": f"arg_{i + 1}", "source_expression": a["expression"]} for i, a in enumerate(args[fmt_index + 1:])] if printf_like else [], "resolution": "literal-format-lexically-resolved" if exact else "dynamic-or-macro-format-requires-dataflow-review", "translation_status": "not-translated", "runtime_catalog_status": "not-integrated"}
        (messages if token.text in MESSAGE_SINKS else formatters).append(record)
    symbols = [{k: v for k, v in r.items() if k not in ("start", "end")} for r in regions]
    return literals, messages, formatters, calls, symbols


def scan_lua(relative: str, text: str) -> list[dict]:
    """Lex Lua strings/comments; no attempt to interpret level generation."""
    pattern = re.compile(r"(?P<longcomment>--\[(?P<ceq>=*)\[[\s\S]*?\](?P=ceq)\])|(?P<comment>--[^\n]*)|(?P<long>\[(?P<eq>=*)\[(?P<body>[\s\S]*?)\](?P=eq)\])|(?P<quoted>\"(?:\\[\s\S]|[^\"\\])*\"|'(?:\\[\s\S]|[^'\\])*')", re.S)
    starts = lines_of(text)
    records = []
    for match in pattern.finditer(text):
        if match.lastgroup in ("longcomment", "comment") or match.group("longcomment") or match.group("comment"):
            continue
        if match.group("long"):
            value = match.group("body")
            if value.startswith("\n"):
                value = value[1:]
        else:
            quoted = match.group("quoted")
            value = quoted[1:-1]
            value = re.sub(r"\\([\\\"'nrt])", lambda m: {"n": "\n", "r": "\r", "t": "\t"}.get(m.group(1), m.group(1)), value)
        prefix = text[max(0, match.start() - 160):match.start()]
        key_match = re.search(r"([A-Za-z_]\w*)\s*=\s*$", prefix)
        key = key_match.group(1).lower() if key_match else "value"
        records.append({"source": relative, "line": at_line(match.start(), starts), "context_key_candidate": key, "english_source_literal": value, "english_id_candidate": semantic_candidate(f"nethack.data.{Path(relative).stem.lower()}.{key}", value), "status": "lua-string-may-be-map-identifier-code-or-user-text", "translation_status": "not-translated", "runtime_catalog_status": "not-integrated"})
    return records


def surface_kind(relative: str) -> str:
    path = Path(relative)
    if relative.startswith("dat/"):
        if path.suffix == ".lua":
            return "lua-quest-text" if path.name == "quest.lua" else "lua-runtime-support" if path.stem in {"nhcore", "nhlib"} else "lua-dungeon-or-special-level"
        if path.name in {"rumors.tru", "rumors.fal", "oracles.txt", "epitaph.txt", "engrave.txt", "bogusmon.txt", "data.base", "tribute"}:
            return "narrative-or-encyclopedia-data"
        if path.name == "license":
            return "license-notice-preserve-verbatim"
        if path.name in {"help", "hh", "cmdhelp", "keyhelp", "opthelp", "optmenu", "usagehlp", "wizhelp", "history"}:
            return "user-help-or-history"
        return "data-configuration-or-metadata"
    if relative.startswith("doc/"):
        return "manual-documentation-or-processed-document"
    if path.suffix.lower() in C_SOURCE_EXTENSIONS:
        return "c-family-source-or-header"
    if relative.startswith("win/") or relative.startswith("sound/"):
        return "platform-asset-or-source"
    return "build-license-project-or-other-source-surface"


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def generate(source: Path, output: Path) -> dict:
    source = source.resolve(strict=True)
    output = output.resolve()
    if output == source or source in output.parents:
        raise ValueError("Output must be outside the immutable upstream source tree")
    catalog = output / "catalog"
    docs = output / "docs"
    catalog.mkdir(parents=True, exist_ok=True)
    docs.mkdir(parents=True, exist_ok=True)
    all_files, mechanics, surfaces = [], [], []
    c_literals, messages, formats, lua_literals, data_lines = [], [], [], [], []
    ignored = {".git", "node_modules", "target", "__pycache__"}
    for path in sorted(source.rglob("*")):
        if not path.is_file() or any(p in ignored for p in path.relative_to(source).parts):
            continue
        relative = path.relative_to(source).as_posix()
        raw = path.read_bytes()
        text, encoding = read_text(path)
        fact = {"source": relative, "bytes": len(raw), "sha256": digest_bytes(raw), "text_encoding": encoding, "lines": len(text.splitlines()) if text is not None else None, "surface_kind": surface_kind(relative)}
        all_files.append(fact)
        if text is not None and path.suffix.lower() in C_SOURCE_EXTENSIONS:
            literals, sinks, formatters, calls, symbols = scan_c(relative, text)
            c_literals.extend(literals)
            messages.extend(sinks)
            formats.extend(formatters)
            if relative.startswith("src/") and path.suffix.lower() == ".c":
                subsystem = FILE_SUBSYSTEM.get(path.stem, "unclassified-requires-review")
                mechanics.append({**fact, "subsystem": subsystem, "subsystem_description": SUBSYSTEMS.get(subsystem, ("Unclassified", ""))[0], "function_definition_candidates": symbols, "function_definition_candidate_count": len(symbols), "message_sink_call_candidates": len(sinks), "c_string_literal_occurrences": len(literals), "rng_call_candidates": {name: count for name, count in sorted(calls.items()) if name in RNG_NAMES}, "all_call_candidates": dict(sorted(calls.items())), "rust_gameplay_parity": "not-evaluated", "evidence_type": "lexical-source-inventory"})
        if relative.startswith(("dat/", "doc/")):
            surfaces.append(fact)
            if text is not None and path.suffix == ".lua":
                lua_literals.extend(scan_lua(relative, text))
            elif text is not None and relative.startswith("dat/"):
                for number, value in enumerate(text.splitlines(), 1):
                    if not value.strip() or value.lstrip().startswith(("#", "/*", "*", "//")):
                        continue
                    data_lines.append({"source": relative, "line": number, "english_source_line": value, "english_id_candidate": semantic_candidate(f"nethack.data.{re.sub('[^a-z0-9_]', '_', path.name.lower())}", value), "surface_kind": fact["surface_kind"], "status": "data-line-requires-structural-and-visibility-review", "translation_status": "not-translated", "runtime_catalog_status": "not-integrated"})
    subsystem_counts = Counter(m["subsystem"] for m in mechanics)
    counts = {"source_files": len(all_files), "source_bytes": sum(f["bytes"] for f in all_files), "source_text_files": sum(f["text_encoding"] is not None for f in all_files), "src_c_files": len(mechanics), "src_c_lines": sum(m["lines"] for m in mechanics), "src_function_definition_candidates": sum(m["function_definition_candidate_count"] for m in mechanics), "src_unclassified_files": subsystem_counts.get("unclassified-requires-review", 0), "c_string_literal_occurrences_all_tree": len(c_literals), "message_sink_call_candidates_all_tree": len(messages), "message_literal_formats_resolved_all_tree": sum(m["english_source_template"] is not None for m in messages), "message_dynamic_formats_unresolved_all_tree": sum(m["english_source_template"] is None for m in messages), "formatting_call_candidates_all_tree": len(formats), "dat_doc_surface_files": len(surfaces), "dat_files": sum(s["source"].startswith("dat/") for s in surfaces), "doc_files": sum(s["source"].startswith("doc/") for s in surfaces), "dat_lua_files": sum(s["source"].startswith("dat/") and s["source"].endswith(".lua") for s in surfaces), "dat_lua_string_occurrences": len(lua_literals), "dat_noncomment_nonblank_line_candidates": len(data_lines), "japanese_translations_provided_by_inventory": 0, "rust_parity_claims": 0}
    common = {"schema_version": 1, "source_tree": source.name, "scope": "entire-extracted-official-source-tree-file-fingerprints", "literal_extraction_extensions": sorted(C_SOURCE_EXTENSIONS), "method": "deterministic-standard-library-lexical-scan", "limitations": ["No preprocessor configurations are evaluated; mutually exclusive branches remain present.", "Function and call extraction is lexical and can include declarations or macros.", "C-family strings include internal, structural, debug, platform, and user-visible text; non-C-family resources are fingerprinted but not parsed as string literals.", "Dynamic formats and compositional naming/grammar need dataflow and human review.", "Generated English IDs are candidates, not accepted semantic runtime catalog keys.", "The scan does not translate text, execute Lua, or establish Rust gameplay parity."]}
    write_json(catalog / "source-files.json", {**common, "counts": counts, "files": all_files})
    write_json(catalog / "source-mechanics.json", {**common, "counts": counts, "subsystems": {key: {"description": description, "src_c_files": subsystem_counts.get(key, 0)} for key, (description, _) in SUBSYSTEMS.items()}, "files": mechanics})
    write_json(catalog / "source-text-surfaces.json", {**common, "counts": counts, "surfaces": surfaces, "data_line_candidates": data_lines})
    write_json(catalog / "source-text-literals.json", {**common, "counts": counts, "c_literals": c_literals, "lua_literals": lua_literals})
    write_json(catalog / "source-text-messages.json", {**common, "counts": counts, "sink_argument_indexes": MESSAGE_SINKS, "messages": messages, "intermediate_formatters": formats})
    write_json(catalog / "source-summary.json", {**common, "counts": counts, "subsystem_counts": dict(sorted(subsystem_counts.items()))})
    table = "\n".join(f"| {key} | {subsystem_counts.get(key, 0)} | {desc} |" for key, (desc, _) in SUBSYSTEMS.items())
    modules = "\n".join(f"| `{m['source']}` | {m['subsystem']} | {m['lines']} | {m['function_definition_candidate_count']} | {m['message_sink_call_candidates']} |" for m in mechanics)
    (docs / "MECHANICS_INVENTORY.md").write_text(f"""# Official source mechanics inventory

This inventory is evidence for the complete upstream scope. It makes **no claim that these mechanics have been ported to Rust**. `catalog/source-mechanics.json` contains one row for every `src/*.c` file, its SHA-256, size, lines, lexical function locations, API call counts, and RNG calls. `catalog/source-files.json` fingerprints every extracted file, including assets and platform implementations.

The pinned extracted tree is `{source.name}`. Provenance, release verification and license obligations are maintained by the parent source audit; this scanner does not substitute for that audit. The user's confirmed integration target preserves original C gameplay and separates display/input/platform in Rust. The schema's Rust gameplay parity field tracks an optional future audit dimension and is not a current release gate.

- Source files: {counts['source_files']:,}; uncompressed file bytes: {counts['source_bytes']:,}.
- Core C files: {counts['src_c_files']}; core lines: {counts['src_c_lines']:,}.
- Core function definition candidates: {counts['src_function_definition_candidates']:,}.
- Unclassified core files: {counts['src_unclassified_files']}.
- Rust parity status of every file: `not-evaluated`.

Function extraction is lexical. Conditional C branches and macros may prevent exact function recognition. Call totals are candidate counts, not executed-path or behavioral coverage measurements. Every file remains represented even when function extraction fails.

## Subsystems

| Subsystem | Core files | Scope |
| --- | ---: | --- |
{table}

The categories organize review; cross-subsystem dependencies remain substantial. In particular, monster AI calls object use and combat, shops interact with pickup and death, polymorph affects equipment and physiology, and quest progression depends on roles, branches, and artifacts.

## Every core C file

| Source file | Subsystem | Lines | Function candidates | Message sink candidates |
| --- | --- | ---: | ---: | ---: |
{modules}

Regenerate from the unchanged upstream tree:

```text
python nethack/tools/inventory_source.py --source official-source-audit/NetHack-5.0.0 --output nethack
```
""", encoding="utf-8", newline="\n")
    (docs / "TEXT_COVERAGE.md").write_text(f"""# Upstream text coverage evidence

The inventory fingerprints the **whole upstream tree**, including `src`, `include`, `sys`, `win`, `util`, `outdated`, `dat`, and `doc`. Literal extraction processes C-family files (`.c`, `.h`, `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hh`, `.hxx`), including Qt platform strings; Lua strings are extracted from `dat`. Other resource formats are fingerprinted without pretending to parse their user text. Counts are source occurrences across all platforms/configurations, not unique player messages and not Japanese translation coverage.

| Evidence | Exact scanned count |
| --- | ---: |
| C-family source/header string literal occurrences | {counts['c_string_literal_occurrences_all_tree']:,} |
| Recognized message/menu/prompt API call candidates | {counts['message_sink_call_candidates_all_tree']:,} |
| Calls with immediately resolvable literal formats | {counts['message_literal_formats_resolved_all_tree']:,} |
| Calls with dynamic/macro/conditional formats requiring review | {counts['message_dynamic_formats_unresolved_all_tree']:,} |
| Intermediate formatting call candidates | {counts['formatting_call_candidates_all_tree']:,} |
| `dat` files | {counts['dat_files']:,} |
| `doc` files | {counts['doc_files']:,} |
| `dat` Lua files | {counts['dat_lua_files']:,} |
| `dat` Lua string occurrences | {counts['dat_lua_string_occurrences']:,} |
| Nonblank, noncomment candidate lines in other `dat` surfaces | {counts['dat_noncomment_nonblank_line_candidates']:,} |
| Japanese translations supplied by this inventory | 0 |

`source-text-messages.json` records the API, source file, 1-based line, function candidate, exact format expression, source argument expressions, printf specifiers, and named argument candidates. Calls such as `You(...)` add prose through upstream helpers; their stored template is the literal argument, not a falsely reconstructed complete utterance. `source-text-literals.json` retains C-family literals (including C++ raw strings) and Lua strings so text outside recognized sinks remains discoverable. `source-text-surfaces.json` fingerprints every `dat`/`doc` file and lists source lines from non-Lua `dat` surfaces.

## Semantic IDs and arguments

Generated candidates use an English namespace, for example `nethack.message.trap.<function>.you.<english_phrase>.<disambiguator>`. These are extraction aids. A reviewed runtime ID should express the event meaning, for example `player.fell_into_pit`, and contain named typed arguments such as `damage`, `monster`, or `item`. Do not use the English text itself as the key or copy C `printf` strings as the runtime interface.

Before admitting an ID to `en.json` and `ja.json`, review its actual call path and context, replace positional candidates with semantic argument names, and define locale-specific grammar, articles, plural forms and entity naming. Japanese must be a reviewed translation; copying English into `ja.json` is not translation coverage. Catalog validation must compare key and argument schemas, not merely file lengths.

Compositional strings require extra work: object and monster names, possessives, pronouns, indefinite/definite articles, plurals, verb conjugation, blindness/hallucination descriptions, shop names, role names, status abbreviations, menu alignment, command prompts, and quoted monster speech. Quest Lua uses `%` substitutions distinct from C printf. Preserve those expressions until the quest argument language is explicitly modeled. Maps, symbol names, filenames, Lua code keys, and structural commands must not be translated as prose.

## Scope limits and completion gate

This is a lexical scan, not static analysis. It does not resolve macro-defined strings, concatenated buffers, indirect function pointers, every custom UI wrapper, all resource-file formats, or documentation layout. It scans mutually exclusive platform code together. All these limitations are explicit in JSON, and dynamic formats remain unresolved rather than receiving invented text.

A complete translation audit must reconcile every source surface and unresolved call against a reviewed ledger: translated runtime ID, intentionally unlocalized structural text, legal notice preserved verbatim, developer-only diagnostic, obsolete platform text, or out-of-scope documentation with an explicit rationale. The native and browser application must select Japanese by default, support English switching, and render event ID plus typed arguments without advancing gameplay or RNG. Full text coverage is not established by this inventory.
""", encoding="utf-8", newline="\n")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(generate(args.source, args.output), indent=2))


if __name__ == "__main__":
    main()
