"""Generate exact-source C semantic producers without compiling or running a game.

Added 2026-10-02; integration code distributed under the NGPL.
Default operation writes reviewable generated headers, a patch and audit only.
--apply changes a verified working copy; the pristine upstream tree is immutable.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import difflib
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "tools" / "semantic-text"
COMMIT = "16ff59115315917b93185d026aeefea06db9b0f4"
DATE = "2026-10-02"
NOTICE = f"/* Modified {DATE}: source-selected semantic presentation bridge; upstream preserved below. */\n"

# Exact official 5.0 prototypes; C printf promotions are declared per seed.
MESSAGE_APIS = {"pline", "You", "Your", "You_feel", "You_cant", "You_hear",
                "You_see", "There", "pline_The", "Norep", "urgent_pline", "verbalize"}
API = {name: {"types": ["const char *"], "format": 0, "return": "void", "kind": "NH_TEXT_MESSAGE", "direct": False}
       for name in MESSAGE_APIS}
API.update({
    "pline_dir": {"types": ["int", "const char *"], "format": 1, "return": "void", "kind": "NH_TEXT_MESSAGE", "direct": False},
    "pline_mon": {"types": ["struct monst *", "const char *"], "format": 1, "return": "void", "kind": "NH_TEXT_MESSAGE", "direct": False},
    "pline_xy": {"types": ["coordxy", "coordxy", "const char *"], "format": 2, "return": "void", "kind": "NH_TEXT_MESSAGE", "direct": False},
    "livelog_printf": {"types": ["long", "const char *"], "format": 1, "return": "void", "kind": "NH_TEXT_DEFERRED", "direct": False},
    "config_error_add": {"types": ["const char *"], "format": 0, "return": "void", "kind": "NH_TEXT_DEFERRED", "direct": False},
    "raw_printf": {"types": ["const char *"], "format": 0, "return": "void", "kind": "NH_TEXT_RAW", "direct": False},
    "raw_print": {"types": ["const char *"], "format": 0, "return": "void", "kind": "NH_TEXT_RAW", "direct": True},
    "putstr": {"types": ["winid", "int", "const char *"], "format": 2, "return": "void", "kind": "NH_TEXT_PUTSTR", "direct": True},
    "end_menu": {"types": ["winid", "const char *"], "format": 1, "return": "void", "kind": "NH_TEXT_MENU_END", "direct": True},
    "add_menu_str": {"types": ["winid", "const char *"], "format": 1, "return": "void", "kind": "NH_TEXT_MENU_ROW", "direct": False},
    "add_menu_heading": {"types": ["winid", "const char *"], "format": 1, "return": "void", "kind": "NH_TEXT_MENU_ROW", "direct": False},
    "add_menu": {"types": ["winid", "const glyph_info *", "const anything *", "char", "char", "int", "int", "const char *", "unsigned int"],
                 "format": 7, "return": "void", "kind": "NH_TEXT_MENU_ROW", "direct": False},
    "yn_function": {"types": ["const char *", "const char *", "char", "boolean"], "format": 0, "return": "char", "kind": "NH_TEXT_QUESTION", "direct": False},
    "y_n": {"types": ["const char *"], "format": 0, "return": "char", "kind": "NH_TEXT_QUESTION", "direct": False},
})
HELPERS = {"You_feel": "NH_TEXT_FEEL", "You_hear": "NH_TEXT_HEAR", "You_see": "NH_TEXT_SEE", "verbalize": "NH_TEXT_QUOTED"}
TOKEN = re.compile(r'''(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_]\w*|\d+(?:\.\d*)?(?:[A-Za-z_]+)?|->|\+\+|--|<<|>>|<=|>=|==|!=|&&|\|\||\+=|-=|\*=|/=|%=|&=|\|=|\^=|\S)''')


def sha(data: str | bytes) -> str:
    return hashlib.sha256(data.encode("utf8") if isinstance(data, str) else data).hexdigest()


def generator_module(filename: str):
    spec = importlib.util.spec_from_file_location(filename.replace("-", "_"), ROOT / "tools" / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def quoted_end(source: str, offset: int) -> int:
    quote = source[offset]
    offset += 1
    while offset < len(source):
        if source[offset] == "\\":
            offset += 2
        elif source[offset] == quote:
            return offset + 1
        else:
            offset += 1
    raise ValueError("unterminated C string/character literal")


def without_comments(source: str) -> str:
    chunks = []
    i = 0
    while i < len(source):
        if source[i] in "\"'":
            end = quoted_end(source, i)
            chunks.append(source[i:end]); i = end
        elif source.startswith("/*", i):
            end = source.find("*/", i + 2)
            if end < 0:
                raise ValueError("unterminated C comment")
            chunks.append(" "); i = end + 2
        elif source.startswith("//", i):
            end = source.find("\n", i + 2)
            chunks.append(" "); i = len(source) if end < 0 else end
        else:
            chunks.append(source[i]); i += 1
    return "".join(chunks)


def tokens(source: str) -> tuple[str, ...]:
    return tuple(TOKEN.findall(without_comments(source)))


def call_arguments(source: str, opening: int) -> tuple[list[str], int]:
    if source[opening] != "(":
        raise ValueError("expected original call opening parenthesis")
    start = opening + 1
    i = start
    parens, brackets, braces = 1, 0, 0
    result = []
    while i < len(source):
        c = source[i]
        if c in "\"'":
            i = quoted_end(source, i); continue
        if source.startswith("/*", i):
            end = source.find("*/", i + 2)
            if end < 0:
                raise ValueError("unterminated call comment")
            i = end + 2; continue
        if source.startswith("//", i):
            end = source.find("\n", i + 2)
            i = len(source) if end < 0 else end; continue
        if c == "(": parens += 1
        elif c == ")":
            parens -= 1
            if parens == 0:
                result.append(source[start:i].strip())
                return result, i + 1
        elif c == "[": brackets += 1
        elif c == "]": brackets -= 1
        elif c == "{": braces += 1
        elif c == "}": braces -= 1
        elif c == "," and parens == 1 and brackets == 0 and braces == 0:
            result.append(source[start:i].strip()); start = i + 1
        i += 1
    raise ValueError("unterminated original C call")


def argument_type(argument: dict) -> tuple[str, str]:
    kind = argument.get("type")
    length = argument.get("c_length_modifier", "")
    if kind in ("text", "string"):
        if length:
            raise ValueError("wide-character strings are not a validated UTF8 contract")
        return "const char *", "NH_TEXT_TEXT"
    if kind in ("integer", "signed-integer", "character-promoted-to-int"):
        if length not in ("", "h", "hh", "l"):
            raise ValueError(f"unsupported signed printf length: {length}")
        return "long" if length == "l" else "int", "NH_TEXT_INTEGER"
    if kind == "unsigned":
        if length not in ("", "h", "hh", "l"):
            raise ValueError(f"unsupported unsigned printf length: {length}")
        return "unsigned long" if length == "l" else "unsigned int", "NH_TEXT_UNSIGNED"
    raise ValueError(f"unhandled typed printf argument: {kind}")


def replace_once(source: str, old: str, new: str, contract: str) -> str:
    count = source.count(old)
    if count != 1:
        raise ValueError(f"hook {contract}: expected 1 exact original anchor, found {count}")
    return source.replace(old, new, 1)


def emission(original: str, owner: str, indent: str) -> str:
    return (indent + "{ /* Semantic ownership surrounds only this original native emission. */\n" +
            indent + "    struct nh_text_scope *nh_previous = nh_text_emit(" + owner + ");\n" +
            indent + "    " + original.strip() + "\n" + indent + "    nh_text_emit(nh_previous);\n" + indent + "}")


def core_hooks(source: str, name: str) -> tuple[str, list[str]]:
    changes = []
    def change(old: str, new: str, label: str) -> None:
        nonlocal source
        source = replace_once(source, old, new, label)
        changes.append(label)
    if name == "src/pline.c":
        change('staticfn void putmesg(const char *);', 'staticfn void putmesg(const char *, struct nh_text_scope *);', "putmesg-owner-prototype")
        change('putmesg(const char *line)\n{', 'putmesg(const char *line, struct nh_text_scope *nh_owner)\n{', "putmesg-owner-parameter")
        change('    putstr(WIN_MESSAGE, attr, line);', emission('putstr(WIN_MESSAGE, attr, line);', 'nh_owner', '    '), "accepted-message-window-emission")
        change('vpline(const char *line, va_list the_args)\n{', 'vpline(const char *line, va_list the_args)\n{\n    struct nh_text_scope *nh_owner = nh_text_claim(NH_TEXT_MESSAGE);', "logical-message-owner-claim")
        change('        vpline(tmp, the_args);', '        nh_text_location(nh_owner, dirstr);\n        nh_text_forward(nh_owner);\n        vpline(tmp, the_args);\n        nh_text_forward(NULL);', "accessibility-already-computed-prefix-forward")
        change('        raw_print(line);', emission('raw_print(line);', 'nh_owner', '        '), "early-or-recursive-message-raw-emission")
        change('    if (ln > BUFSZ - 1) {', '    if (ln > BUFSZ - 1) {\n        nh_text_truncated(nh_owner);', "truncated-message-native-fallback")
        change('    putmesg(line);', '    putmesg(line, nh_owner);', "accepted-message-owner-delivery")
        change('vraw_printf(const char *line, va_list the_args)\n{', 'vraw_printf(const char *line, va_list the_args)\n{\n    struct nh_text_scope *nh_owner = nh_text_claim(NH_TEXT_RAW);', "logical-raw-owner-claim")
        change('    if ((int) strlen(line) > BUFSZ - 1) {', '    if ((int) strlen(line) > BUFSZ - 1) {\n        nh_text_truncated(nh_owner);', "truncated-raw-native-fallback")
        change('\n    raw_print(line);\n', '\n' + emission('raw_print(line);', 'nh_owner', '    ') + '\n', "accepted-raw-window-emission")
    elif name == "src/windows.c":
        change('    if (!str) {\n        /* if \'str\' is Null, just return without adding any menu entry */',
               '    struct nh_text_scope *nh_owner = nh_text_claim(NH_TEXT_MENU_ROW);\n    if (!str) {\n        /* if \'str\' is Null, just return without adding any menu entry */', "logical-menu-row-owner-claim")
        old = '    (*windowprocs.win_add_menu)(window, glyphinfo, identifier,\n                                ch, gch, attr, color, str, itemflags);'
        change(old, emission('(*windowprocs.win_add_menu)(window, glyphinfo, identifier,\n                                    ch, gch, attr, color, str, itemflags);', 'nh_owner', '    '), "accepted-menu-row-window-emission")
    elif name == "src/cmd.c":
        change('staticfn boolean yn_function_menu(const char *, const char *, char, char *);',
               'staticfn boolean yn_function_menu(const char *, const char *, char, char *, struct nh_text_scope *);', "question-menu-owner-prototype")
        change('    char *res)\n{', '    char *res,\n    struct nh_text_scope *nh_owner)\n{', "question-menu-owner-parameter")
        change('        end_menu(win, query);', emission('end_menu(win, query);', 'nh_owner', '        '), "alternate-question-menu-title-emission")
        change("    char res = '\\033', qbuf[QBUFSZ];", "    struct nh_text_scope *nh_owner = nh_text_claim(NH_TEXT_QUESTION);\n    char res = '\\033', qbuf[QBUFSZ];", "logical-question-owner-claim")
        change('        if (!yn_function_menu(query, resp, def, &res)) {',
               '        if (!yn_function_menu(query, resp, def, &res, nh_owner)) {', "question-menu-owner-forward")
        change('            res = (*windowprocs.win_yn_function)(query, resp, def);',
               emission('res = (*windowprocs.win_yn_function)(query, resp, def);', 'nh_owner', '            '), "accepted-question-native-input-emission")
    return source, changes


def quest_hooks(source: str) -> tuple[str, list[str]]:
    """Observe only original selected quest values and accepted delivery."""
    changes = []
    def change(old: str, new: str, label: str) -> None:
        nonlocal source
        source = replace_once(source, old, new, label)
        changes.append(label)
    change('            if (*(c + 1)) {\n                convert_arg(*(++c));',
           '            if (*(c + 1)) {\n                char *nh_start = cc;\n                const char *nh_code_position;\n                char nh_code, nh_modifier;\n                convert_arg(*(++c));\n                nh_code = *c;\n                nh_modifier = *(c + 1);\n                nh_code_position = c;\n                nh_quest_base(nh_code, gc.cvt_buf);',
           "quest-base-after-original-convert-arg")
    for expression, label in (("An(gc.cvt_buf)", "article-upper"),
                              ("an(gc.cvt_buf)", "article-lower"),
                              ("&gc.cvt_buf[4]", "strip-the")):
        indent = "                        " if label == "strip-the" else "                    "
        old = indent + f'Strcat(cc, {expression});\n' + indent + 'cc += strlen(cc);\n' + indent + 'continue; /* for */'
        new = old.replace(indent + 'continue; /* for */',
            indent + 'nh_quest_modified(nh_code, nh_modifier, nh_start,\n' +
            indent + '                  cc <= &out_line[BUFSZ - 1] ? (size_t) (cc - nh_start) : SIZE_MAX);\n' +
            indent + 'continue; /* for */')
        change(old, new, "quest-modified-original-" + label + "-slice")
    old = '                Strcat(cc, gc.cvt_buf);\n                cc += strlen(gc.cvt_buf);'
    change(old, old + '\n                nh_quest_modified(nh_code, c == nh_code_position ? \'\\0\' : nh_modifier,\n                                  nh_start, cc <= &out_line[BUFSZ - 1]\n                                      ? (size_t) (cc - nh_start) : SIZE_MAX);',
           "quest-modified-original-normal-slice")
    old = '        convert_line(in_line, out_line);\n        pline("%s", out_line);'
    new = '        convert_line(in_line, out_line);\n        {\n            struct nh_text_scope *nh_owner = nh_quest_line(NH_TEXT_MESSAGE, WIN_MESSAGE, out_line);\n            pline("%s", out_line);\n            nh_quest_line_done(nh_owner);\n        }'
    change(old, new, "quest-original-message-line-owner")
    old = '        convert_line(in_line, out_line);\n        putstr(datawin, 0, out_line);'
    new = '        convert_line(in_line, out_line);\n        {\n            struct nh_text_scope *nh_owner = nh_quest_line(NH_TEXT_PUTSTR, datawin, out_line);\n            struct nh_text_scope *nh_previous = nh_text_emit(nh_owner);\n            putstr(datawin, 0, out_line);\n            nh_text_emit(nh_previous);\n            nh_quest_line_done(nh_owner);\n        }'
    change(old, new, "quest-original-window-line-owner")
    change('    int output;\n    lua_State *L;',
           '    int output;\n    uint32_t nh_item_index = 0;\n    struct nh_quest_group *nh_quest_owner = NULL;\n    lua_State *L;',
           "quest-presentation-group-locals")
    change('        nelems = rn2(nelems) + 1;',
           '        nelems = rn2(nelems) + 1;\n        nh_item_index = (uint32_t) nelems;',
           "quest-original-selected-random-index-snapshot")
    old = '    if (output == 0 || output == 1)\n        deliver_by_pline(text);\n    else\n        deliver_by_window(text, (output == 3) ? NHW_MENU : NHW_TEXT);'
    change(old, '    nh_quest_owner = nh_quest_begin(section, fallback_msgid ? fallback_msgid : msgid,\n                                     nh_item_index, text);\n' + old + '\n    nh_quest_end(nh_quest_owner);\n    nh_quest_owner = NULL;',
           "quest-resolved-source-selection-group-only-public-delivery")
    return source, changes


def quest_data(document: dict, output: Path) -> dict:
    entries = [e for e in document["entries"] if e.get("category") == "quest-text"]
    bindings, descriptors, seen, rows = [], [], set(), []
    for index, entry in enumerate(entries):
        path = entry["path"]
        if len(path) != 3 or not all(isinstance(s, str) for s in path[:2]):
            raise ValueError(f"unsupported original quest path: {path}")
        field = "item" if isinstance(path[2], int) else path[2]
        item = path[2] if field == "item" else 0
        if field not in ("text", "item", "synopsis") or item < 0:
            raise ValueError(f"unsupported original quest field: {path}")
        key = (*path[:2], field, item)
        if key in seen: raise ValueError(f"duplicate source-selected quest descriptor: {key}")
        seen.add(key)
        arguments = entry["arguments"]
        if len(arguments) > 64 or len({a["name"] for a in arguments}) != len(arguments):
            raise ValueError(f"invalid quest argument union: {entry['id']}")
        name = f"nh_quest_bindings_{index}"
        if arguments:
            bindings.append(f"static const struct nh_quest_binding {name}[] = {{")
            for argument in arguments:
                code, modifier = argument["code"], argument["modifier"]
                if len(code) != 1 or code not in "pcrRsSl iOongGH aAdDCNLxZ%".replace(" ", "") or len(modifier) > 1:
                    raise ValueError(f"unsupported quest substitution: {argument}")
                if modifier in "hHiIjJ" and modifier and code.lower() not in "dlno":
                    raise ValueError(f"metadata consumes an ineligible quest pronoun modifier: {entry['id']}:{argument['source_token']}")
                if modifier and modifier not in "AaChHiIjJPpSst":
                    raise ValueError(f"unsupported original quest modifier: {argument}")
                bindings.append(f"    {{{json.dumps(argument['name'])}, '{code}', " + (f"'{modifier}'" if modifier else "'\\0'") + "},")
            bindings.append("};")
        source_template = entry["source_english_literal"]
        if "\0" in source_template or len(source_template.encode("utf8")) > 65536:
            raise ValueError(f"invalid original quest template: {entry['id']}")
        descriptors.append("    {" + ", ".join(json.dumps(v) for v in (*path[:2], field, entry["id"], source_template)) +
                           f", {item}, " + (name if arguments else "NULL") + f", {len(arguments)}" + "},")
        rows.append({"id": entry["id"], "path": path, "argument_union": arguments,
                     "source_template_sha256": sha(source_template),
                     "native_producer": "core-history-only English fallback" if field == "synopsis" else "source-selected quest paragraph group",
                     "extra_source_codes": entry.get("japanese_source_codes_not_in_original_english", [])})
    data = NOTICE + "\n".join(bindings) + "\nstatic const struct nh_quest_descriptor nh_quest_descriptors[] = {\n" + "\n".join(descriptors) + "\n};\n"
    (output / "include" / "nh-quest-semantic-data.h").write_text(data, encoding="utf8", newline="\n")
    return {"catalog_ids": len(entries), "display_ids": sum(r["path"][-1] != "synopsis" for r in rows),
            "history_only_ids": sum(r["path"][-1] == "synopsis" for r in rows), "descriptors": rows,
            "rawtext_contract": "no capture, conversion, semantic event or replacement; original English gameplay checks untouched",
            "selection": "original resolved section/message and native selected array index; never repeated rn2",
            "line_group_contract": "all accepted unique ordered original rows and final full argument union required; otherwise native English retained"}


def wrapper(entry: dict, site: dict, function: str) -> tuple[str, dict]:
    api = site["api"]
    if api not in API:
        raise ValueError(f"unsupported original producer API: {api}")
    contract = API[api]
    arguments = entry.get("arguments", entry.get("typed_arguments", []))
    base_types = contract["types"]
    if site["format_argument_index"] != contract["format"]:
        raise ValueError(f"unexpected original format slot for {api}")
    if len(site["argument_expressions"]) != len(base_types) + len(arguments):
        raise ValueError(f"argument arity does not match typed contract for {api}")
    if arguments and api not in MESSAGE_APIS | {"pline_dir", "pline_mon", "pline_xy", "raw_printf", "livelog_printf", "config_error_add"}:
        raise ValueError(f"nonvariadic {api} cannot accept inferred printf values")
    captured = [argument_type(a) for a in arguments]
    c_types = base_types + [c for c, _ in captured]
    formal = ", ".join(f"{kind} nh_p{i}" for i, kind in enumerate(c_types))
    lines = [f"static inline {contract['return']} {function}({formal}) {{",
             "    static const struct nh_text_descriptor nh_descriptor = {",
             f"        {json.dumps(entry['id'])}, {json.dumps(api)}, {contract['kind']}, {HELPERS.get(api, 'NH_TEXT_PLAIN')}", "    };"]
    if arguments:
        lines.append("    const struct nh_text_argument nh_arguments[] = {")
        for i, (argument, (_, kind)) in enumerate(zip(arguments, captured, strict=True)):
            p = len(base_types) + i
            value = f"nh_p{p}, 0" if kind == "NH_TEXT_TEXT" else f"NULL, (int64_t)nh_p{p}"
            lines.append(f"        {{{json.dumps(argument['name'])}, {kind}, {value}, NULL}},")
        lines.append("    };")
    window = "nh_p0" if base_types[0] == "winid" else "-1"
    lines.append(f"    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, {'nh_arguments' if arguments else 'NULL'}, {len(arguments)}, {window});")
    if contract["direct"]:
        lines.append("    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);")
    actual = [f"nh_p{i}" for i in range(len(c_types))]
    for i, (_, kind) in enumerate(captured):
        if kind == "NH_TEXT_TEXT":
            p = len(base_types) + i
            actual[p] = f"nh_text_captured_text(nh_scope, {i}, nh_p{p})"
    call = f"{api}({', '.join(actual)})"
    if contract["return"] == "void":
        lines.append("    " + call + ";")
    else:
        lines.append(f"    {contract['return']} nh_result = {call};")
    if contract["direct"]:
        lines.append("    nh_text_emit(nh_previous);")
    lines.append("    nh_text_end(nh_scope);")
    if contract["return"] != "void":
        lines.append("    return nh_result;")
    lines.append("}")
    return "\n".join(lines) + "\n", {"formal_c_types": c_types, "typed_arguments": arguments,
        "original_api": api, "return_c_type": contract["return"], "channel": contract["kind"],
        "single_evaluation": "original argument-expression tokens retained once; fixed typed values forwarded",
        "string_forwarding": "same owned public UTF8 snapshots; original pointer fallback when capture is invalid"}


def generate(metadata: Path, upstream: Path, output: Path, source: Path | None = None,
             *, additional_source_files=(), pre_core_transform=None, post_source_transform=None) -> dict:
    # Added 2026-10-02: opt-in pure source composition for isolated later phases.
    # Empty defaults preserve the frozen generator's output bytes and behavior.
    document = json.loads(metadata.read_text(encoding="utf8"))
    if document.get("official_commit", COMMIT) != COMMIT:
        raise ValueError("semantic metadata is not pinned to the verified official engine commit")
    entries = [e for e in document["entries"] if e.get("category", "message") == "message"]
    grouped = defaultdict(list)
    for entry in entries:
        if not entry.get("source_call_sites"):
            raise ValueError(f"base message has no exact source call: {entry['id']}")
        for site in entry["source_call_sites"]:
            grouped[site["source"]].append((entry, site))
    for name in ("src/pline.c", "src/windows.c", "src/cmd.c", "src/questpgr.c", "src/do_name.c", "src/objnam.c"):
        grouped.setdefault(name, [])
    for name in additional_source_files:
        grouped.setdefault(name, [])
    output.mkdir(parents=True, exist_ok=True)
    generated_include = output / "include"
    (generated_include / "nh-semantic").mkdir(parents=True, exist_ok=True)
    (output / "src").mkdir(exist_ok=True)
    for name in ("nh-semantic.h", "nh-semantic.c", "nh-quest-semantic.h", "nh-quest-semantic.c", "nh-semantic-name.h", "nh-semantic-name.c"):
        shutil.copy2(TEMPLATES / name, (generated_include if name.endswith(".h") else output / "src") / name)
    audit = {"schema_version": 1, "date": DATE, "official_commit": COMMIT,
        "metadata_sha256": sha(metadata.read_bytes()), "base_message_ids": len(entries),
        "catalog_only_categories": dict(Counter(e.get("category", "message") for e in document["entries"] if e.get("category", "message") != "message")),
        "runtime_integration": False, "compiled_or_browser_tested": False, "sites": [], "files": [], "unhandled_contracts": [],
        "argument_transport": "text and C32 signed/unsigned numbers; %c remains promoted integer with original printf conversion",
        "association": "one-shot logical owner claim, explicit accessibility forwarding, exact native-emission brackets; getter read-only",
        "bounds": {"arguments": 64, "string_bytes": 65536, "json_bytes": 262144, "id_bytes": 160},
        "fallback_contracts": ["invalid UTF8/control escaping or allocation/size failure emits no semantic event",
            "native pline/vraw truncation emits exact original English only", "unseeded producers/status/quest/entity descriptor bindings remain explicit original output",
            "already-computed accessibility location qualifier captured without its colon; locale formatter reports raw-location fallback",
            "public string arguments are observed snapshots; complete entity localization is not claimed"]}
    audit["quest"] = quest_data(document, output)
    name_generator = generator_module("instrument-semantic-names.py")
    name_generator.UPSTREAM = upstream
    names_output = output / "names"
    audit["public_names"] = name_generator.generate(metadata, names_output)
    for name in ("nh-semantic-monster-labels.h", "nh-semantic-object-labels.h"):
        shutil.copy2(names_output / name, generated_include / name)
    object_generator = generator_module("instrument-semantic-objects.py")
    audit["public_objects"] = object_generator.generate(output / "objects", upstream=upstream)
    audit["deferred_producers"] = {"livelog_printf": "native live-log file output; no synchronous UI callback association",
                                   "config_error_add": "deferred config-error buffer; later presentation binding pending"}
    patches, patched = [], {}
    seen_sites = {}
    for name, rows in sorted(grouped.items()):
        original_path = (upstream / name).resolve()
        if not original_path.is_relative_to(upstream.resolve()):
            raise ValueError("source metadata escaped immutable upstream root")
        original = original_path.read_text(encoding="utf8")
        line_offsets = [0] + [m.end() for m in re.finditer("\n", original)]
        edits, wrappers = [], []
        header_name = "sites-" + Path(name).stem + ".h"
        for entry, site in rows:
            api = site["api"]
            line = site["line"]
            begin = line_offsets[line - 1]
            end = line_offsets[line] if line < len(line_offsets) else len(original)
            candidates = []
            for match in re.finditer(r"\b" + re.escape(api) + r"\s*\(", original[begin:end]):
                offset = begin + match.start()
                opening = original.find("(", offset)
                args, closing = call_arguments(original, opening)
                if len(args) == len(site["argument_expressions"]) and all(tokens(a) == tokens(b) for a, b in zip(args, site["argument_expressions"], strict=True)):
                    candidates.append((offset, args, closing))
            if len(candidates) != 1:
                raise ValueError(f"{name}:{line}:{api}: exact original expression binding matched {len(candidates)} calls")
            offset, args, closing = candidates[0]
            key = (name, offset)
            if key in seen_sites:
                raise ValueError(f"same original producer claimed twice by {seen_sites[key]} and {entry['id']}")
            seen_sites[key] = entry["id"]
            function = "nh_text_site_" + sha(f"{entry['id']}|{name}|{line}|{offset}")[:16]
            generated, contract = wrapper(entry, site, function)
            wrappers.append(generated)
            edits.append((offset, offset + len(api), function))
            audit["sites"].append({"id": entry["id"], "source": name, "line": line, "api": api,
                "wrapper": function, "original_call_sha256": sha(original[offset:closing]),
                "original_argument_expressions": args, "original_argument_token_sha256": [sha(json.dumps(tokens(arg))) for arg in args],
                "source_english_literal": entry.get("source_english_literal", entry.get("en")), **contract})
        transformed = original
        for start, end, replacement in sorted(edits, reverse=True):
            transformed = transformed[:start] + replacement + transformed[end:]
        # This exact structural check proves source instrumentation changes only
        # API identifiers; every original expression/literal token remains once.
        reverted = transformed
        for start, end, replacement in sorted(edits):
            # Offsets shift after replacements, so revert by unique generated name.
            reverted = replace_once(reverted, replacement, original[start:end], "source-token-preservation")
        if reverted != original:
            raise ValueError(f"argument/literal token preservation failed: {name}")
        phase_hooks = []
        if pre_core_transform:
            transformed, phase_hooks = pre_core_transform(transformed, name)
        transformed, hooks = core_hooks(transformed, name)
        hooks = phase_hooks + hooks
        includes = '#include "nh-semantic.h"\n'
        if name == "src/questpgr.c":
            transformed, quest_changes = quest_hooks(transformed)
            hooks.extend(quest_changes)
            includes += '#include "nh-quest-semantic.h"\n'
        if name == "src/do_name.c":
            transformed, name_changes = name_generator.transform(transformed)
            hooks.extend(name_changes)
        if name == "src/objnam.c":
            transformed, object_changes = object_generator.instrument_text(transformed)
            hooks.extend(object_changes)
        if post_source_transform:
            transformed, later_changes = post_source_transform(transformed, name)
            hooks.extend(later_changes)
        if wrappers:
            includes += f'#include "nh-semantic/{header_name}"\n'
            guard = "JROGUE_" + header_name.upper().replace("-", "_").replace(".", "_")
            header = NOTICE + f"#ifndef {guard}\n#define {guard}\n#include \"nh-semantic.h\"\n\n" + "\n".join(wrappers) + "\n#endif\n"
            (generated_include / "nh-semantic" / header_name).write_text(header, encoding="utf8", newline="\n")
        transformed = replace_once(transformed, '#include "hack.h"\n', '#include "hack.h"\n' + includes, "bridge-header-inclusion")
        transformed = NOTICE + transformed
        patched[name] = transformed
        patches.extend(difflib.unified_diff(original.splitlines(True), transformed.splitlines(True), fromfile="upstream/" + name, tofile="work/" + name))
        audit["files"].append({"source": name, "original_sha256": sha(original), "patched_sha256": sha(transformed),
                                "producer_sites": len(rows), "emission_hooks": hooks})
    audit["producer_sites"] = len(audit["sites"])
    audit["producer_api_counts"] = dict(sorted(Counter(s["api"] for s in audit["sites"]).items()))
    audit["source_only_status"] = "all exact source contracts generated and token-preserved; no compiler/linker/browser executed"
    audit["generated_files"] = [{"path": str(p.relative_to(output)).replace("\\", "/"),
                                 "sha256": sha(p.read_bytes()), "bytes": p.stat().st_size}
                                for folder in (generated_include, output / "src")
                                for p in sorted(folder.rglob("*")) if p.is_file()]
    (output / "semantic.patch").write_text("".join(patches), encoding="utf8", newline="\n")
    (output / "audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf8", newline="\n")
    if source:
        source = source.resolve()
        if source == upstream.resolve() or not source.is_relative_to(ROOT.resolve()):
            raise ValueError("--apply requires a working copy within this nethack workspace")
        # Never overwrite a working source change owned by another phase/agent.
        for item in audit["files"]:
            current = source / item["source"]
            content = current.read_text(encoding="utf8")
            if sha(content) not in (item["original_sha256"], item["patched_sha256"]):
                raise ValueError(f"working source has an unrecognized change: {item['source']}")
        for name, content in patched.items():
            (source / name).write_text(content, encoding="utf8", newline="\n")
        shutil.copytree(generated_include, source / "include", dirs_exist_ok=True)
        for generated_source in (output / "src").glob("*.c"):
            shutil.copy2(generated_source, source / "src" / generated_source.name)
    return audit


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata", type=Path, default=ROOT / "locales" / "gameplay-core.metadata.json")
    parser.add_argument("--upstream", type=Path, default=ROOT / "upstream" / "NetHack-5.0.0")
    parser.add_argument("--output", type=Path, default=TEMPLATES / "generated")
    parser.add_argument("--apply", type=Path, help="Apply to this verified working copy; never the pristine source")
    args = parser.parse_args()
    audit = generate(args.metadata.resolve(), args.upstream.resolve(), args.output.resolve(), args.apply)
    print(json.dumps({"status": "source-only-pass", "base_message_ids": audit["base_message_ids"],
        "producer_sites": audit["producer_sites"], "source_files": len(audit["files"]),
        "unhandled_contracts": audit["unhandled_contracts"], "applied": bool(args.apply), "output": str(args.output)}))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf8")
    main()
