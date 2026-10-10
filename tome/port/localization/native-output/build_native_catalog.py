"""Build reviewed call-site metadata and bounded native EN/JA seed catalogs.

This generator never patches upstream or replaces runtime strings. The seed
source templates select evidence for human-authored semantic IDs; integration
must attach those IDs and typed parameters at exact native call sites.
"""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
FORMAT = re.compile(r"%%|%[sdcfp]")
PLACEHOLDER = re.compile(r"\{([a-z_][a-z0-9_]*)\}")
PRINTF = re.compile(r"%%|%(?:\d+\$)?[-+ #0]*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|ll|[hljztL])?[diuoxXfFeEgGaAcspn]")


def source_bytes(relative):
    return (SOURCE / relative).read_bytes()


def source_text(relative):
    raw = source_bytes(relative)
    try: return raw.decode("utf-8")
    except UnicodeDecodeError: return raw.decode("latin-1")


def preprocessor_context(relative, source_line):
    stack = []
    for line in source_text(relative).splitlines()[:source_line]:
        stripped = line.strip()
        if re.match(r"#\s*(if|ifdef|ifndef)\b", stripped): stack.append(stripped)
        elif re.match(r"#\s*elif\b", stripped) and stack: stack[-1] = stripped
        elif re.match(r"#\s*else\b", stripped) and stack: stack[-1] = "#else branch of " + stack[-1]
        elif re.match(r"#\s*endif\b", stripped) and stack: stack.pop()
    return stack


def parameters(row, names):
    api = row["api"]
    start = 2 if api in ("luaL_error", "lua_pushfstring") else 0
    expressions = row["arguments"][start:] if start else []
    specifiers = [match.group() for match in FORMAT.finditer(row["source_text"]) if match.group() != "%%"]
    if len(specifiers) != len(names): raise ValueError("placeholder arity: " + row["source_text"])
    if names and len(expressions) != len(names): raise ValueError("source argument arity: " + row["expression"])
    output = []
    for name, specifier, expression in zip(names, specifiers, expressions):
        kind = {"%s": "opaque_utf8_text", "%d": "signed_integer", "%c": "character", "%f": "number", "%p": "address"}[specifier]
        if name in ("source_file", "font_path", "file_path", "sound_path"): kind = "verbatim_path"
        if name in ("function_name", "module_name", "field_name", "value_type", "expected_type", "actual_type", "coroutine_state", "stream_name", "operation"): kind = "verbatim_technical_token"
        output.append({"name": name, "source_format": specifier, "c_expression": expression, "kind": kind})
    return output


def english_template(raw, names):
    index = 0
    def substitute(match):
        nonlocal index
        if match.group() == "%%": return "%"
        value = "{" + names[index] + "}"
        index += 1
        return value
    result = FORMAT.sub(substitute, raw)
    if index != len(names): raise ValueError("template arity")
    return result


def route(row):
    relative, function = row["source"], row["function"]
    if relative == "src/music.c":
        return {"native_api": "core.sound.load", "normal_consumers": ["engine/interface/GameSound.lua:57-63", "engine/interface/GameMusic.lua:46-49"], "display": "normal consumers catch failure with pcall and log/skip audio; uncaught direct calls can reach the standard error dialog"}
    if function == "lua_zip_add":
        return {"native_api": "fs ZIP userdata add", "display": "returns nil,error; no active Lua UI consumer established by this bounded search; Savefile zip:add examples found were comments"}
    if relative == "src/serial.c":
        return {"native_api": "core.serial.new", "normal_consumers": ["engine/class.lua:460-474"], "display": "lua_error; uncaught failures can reach standard error dialog"}
    if relative == "src/struct.c":
        return {"native_api": "struct.pack/unpack/size helpers", "display": "Lua argument/error stack; uncaught failures can reach standard error dialog"}
    if function == "sdl_new_font":
        return {"native_api": "core.display.newFont", "normal_consumers": ["engine/FontPackage.lua:100", "engine/utils.lua:1444-1461"], "display": "luaL_error; boot/game error routing requires functioning fallback font/display resources"}
    if function == "lua_check_error":
        return {"native_api": "core.game.checkError", "normal_consumers": ["engine/Game.lua:284-289", "engine/Module.lua:911-916"], "display": "direct formatted error-stack rows consumed by ShowErrorStack or BootErrorHandler"}
    if relative == "src/physfs.c":
        return {"native_api": "fs path access guards", "display": "lua_error when a Lua state is supplied; uncaught failures can reach standard error dialog; separate path-bearing printf remains console-only"}
    if relative.startswith("src/lua/"):
        return {"native_api": "original Lua C library " + relative.rsplit("/", 1)[-1], "display": "conditional on builtin call and caller error handling; thrown failures reach standard error dialog only if uncaught; returned/search diagnostics require caller propagation"}
    return {"native_api": "not established", "display": "unverified; not a complete runtime coverage claim"}


def main():
    candidates = json.loads((ROOT / "native-output-candidates.json").read_text(encoding="utf-8"))["records"]
    seeds = json.loads((ROOT / "native-seed-definitions.json").read_text(encoding="utf-8"))
    english, japanese, messages = {}, {}, []
    selected_sites = set()
    for identity, raw, ja, names in seeds:
        if identity in english: raise ValueError("duplicate semantic ID")
        matching = [row for row in candidates if row["source_text"] == raw and row["candidate_class"] != "console_diagnostic"]
        if identity.startswith("native.error.sound."): matching = [row for row in matching if row["source"] == "src/music.c"]
        if not matching: raise ValueError("seed has no retained source evidence: " + identity)
        en = english_template(raw, names)
        if sorted(PLACEHOLDER.findall(en)) != sorted(names) or sorted(PLACEHOLDER.findall(ja)) != sorted(names):
            raise ValueError("EN/JA named placeholder mismatch: " + identity)
        sites = []
        for row in matching:
            selected_sites.add((row["source"], row["line"], row["api"]))
            sites.append({
                "source": row["source"], "line": row["line"], "function": row["function"],
                "output_api": row["api"], "source_expression": row["expression"],
                "source_arguments": row["arguments"], "parameters": parameters(row, names),
                "preprocessor_context": preprocessor_context(row["source"], row["line"]),
                "lua_ui_route": route(row), "verification": "static source/control-flow evidence; no runtime/browser test",
            })
        english[identity], japanese[identity] = en, ja
        messages.append({"id": identity, "source_format": raw, "parameter_names": names, "sites": sites})
    manifest = {
        "schema_version": 1, "source_ref": "tome-1.7.6", "default_locale": "ja",
        "scope": "bounded reviewed native error seed; top-level TEngine src/*.c plus five original Lua C library files; not full source or text coverage",
        "integration_status": "catalog and exact call-site metadata only; original C strings and Lua runtime unmodified",
        "messages": messages,
        "error_display_chain": ["src/main.c:201 traceback", "src/main.c:212-217 recorded native error stack", "src/core_lua.c:555-570 lua_check_error", "engine/Game.lua:284-289 -> engine/dialogs/ShowErrorStack.lua:init", "engine/Module.lua:911-916 -> engine/BootErrorHandler.lua:29-48 -> ShowErrorStack", "engine/dialogs/ShowErrorStack.lua:31 concatenates native rows;106 Textzone.new{text=display_errs} displays them without _t"],
        "macro_resolution": {"LUA_QL": "src/lua/luaconf.h:201", "LUA_QS": "src/lua/luaconf.h:202"},
        "parameter_policy": "paths, technical identifiers and external/user-provided text remain verbatim; unknown opaque error reasons are not globally replaced",
        "remaining_gaps": ["unselected Lua VM/parser/dependency errors", "PHYSFS/SDL/errno opaque reasons and source operation/type/state tokens require separate structured catalogs", "arbitrary Lua assert/error messages owned by the Lua content seam", "runtime transport of semantic IDs from C call sites", "actual CJK rendering and browser failure-flow tests"],
    }
    console = [{**{key: row[key] for key in ("source", "line", "function", "api", "source_text", "arguments", "expression")}, "printf_format_specifiers": [match.group() for match in PRINTF.finditer(row["source_text"])], "lua_ui_route": "none established; original console diagnostic", "verification": "lexical source candidate; may include commented or inactive diagnostics; not runtime UI coverage"} for row in candidates if row["candidate_class"] == "console_diagnostic"]
    excluded = [row for row in candidates if row["candidate_class"] == "lua_value" and (row["source"], row["line"], row["api"]) not in selected_sites]
    examined = sorted({row["source"] for row in candidates})
    source_hashes = {relative: hashlib.sha256(source_bytes(relative)).hexdigest() for relative in examined}
    for name, content in (("en.native.json", english), ("ja.native.json", japanese), ("native-callsite-manifest.json", manifest), ("console-output-manifest.json", {"scope": "separate original console output; includes debug logs/startup failures; no claim of Lua UI display", "translated_into_ui_catalog": False, "records": console}), ("unselected-lua-values.json", {"scope": "protocol keys, debug tostring values, dynamic or unreviewed returned messages; not translation targets by default", "records": excluded}), ("source-hashes.json", source_hashes)):
        (ROOT / name).write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {"selected_semantic_ids": len(messages), "selected_call_sites": len(selected_sites), "console_records_separate": len(console), "unselected_lua_values": len(excluded), "source_files_with_output_candidates": len(examined), "en_ja_key_and_placeholder_coverage_for_selected_seed": "pass", "runtime_integration": "not performed"}
    (ROOT / "validation-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
