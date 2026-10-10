"""Read bounded upstream native TEngine files; enumerate source output sites."""
import json
from pathlib import Path
import re

SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
ROOT = Path(__file__).resolve().parent
APIS = re.compile(r"\b(luaL_error|luaL_argerror|luaL_argcheck|luaL_checkstack|lua_pushfstring|lua_pushstring|lua_pushliteral|fprintf|printf|puts|new_lua_error)\s*\(")
FUNCTIONS = re.compile(r"^[ \t]*(?:(?:static|inline|extern|const)\s+)*[A-Za-z_][\w \t*]+?[ \t*]([A-Za-z_]\w*)\s*\([^;{}]*?\)\s*\{", re.MULTILINE)


def arguments(text, offset):
    values, start = [], offset
    depth, quoted, escaped = 1, False, False
    for position in range(offset, len(text)):
        char = text[position]
        if quoted:
            if escaped: escaped = False
            elif char == "\\": escaped = True
            elif char == '"': quoted = False
        elif char == '"': quoted = True
        elif char in "([{": depth += 1
        elif char in ")]}":
            depth -= 1
            if depth == 0:
                values.append(text[start:position].strip())
                return values, position + 1
        elif char == "," and depth == 1:
            values.append(text[start:position].strip()); start = position + 1
    raise ValueError("unclosed source call")


def literal(expression):
    # luaconf.h explicitly defines these source quoting macros. Unknown macros
    # remain unresolved candidates rather than being guessed or evaluated.
    expression = expression.replace("LUA_QS", '"\'%s\'"')
    expression = re.sub(r'LUA_QL\(\s*("(?:[^"\\]|\\.)*")\s*\)', lambda match: '"\'" ' + match.group(1) + ' "\'"', expression)
    quoted = re.findall(r'"(?:[^"\\]|\\.)*"', expression)
    if not quoted or re.sub(r'"(?:[^"\\]|\\.)*"', '', expression).strip(): return None
    # Source strings in the selected files use ordinary C escapes. Decode only
    # those, without treating the source expression as executable code.
    return "".join(bytes(value[1:-1], "utf-8").decode("unicode_escape") for value in quoted)


def main():
    records = []
    files = sorted((SOURCE / "src").glob("*.c"))
    files += [SOURCE / "src/lua" / name for name in ("lauxlib.c", "lbaselib.c", "liolib.c", "lstrlib.c", "loadlib.c")]
    for path in files:
        raw = path.read_bytes()
        try: text = raw.decode("utf-8")
        except UnicodeDecodeError: text = raw.decode("latin-1")
        functions = [(match.start(), match.group(1)) for match in FUNCTIONS.finditer(text)]
        for match in APIS.finditer(text):
            args, end = arguments(text, match.end())
            api = match.group(1)
            index = 3 if api == "luaL_argcheck" else 2 if api in ("luaL_argerror", "luaL_checkstack") else 1 if api in ("luaL_error", "lua_pushfstring", "lua_pushstring", "lua_pushliteral", "fprintf") else 0
            message = literal(args[index]) if len(args) > index else None
            if message is None: continue
            current = next((name for start, name in reversed(functions) if start <= match.start() and name not in ("if", "while", "switch", "for")), "<translation-unit>")
            line = text.count("\n", 0, match.start()) + 1
            records.append({"source": path.relative_to(SOURCE).as_posix(), "line": line, "function": current, "api": api, "source_text": message, "arguments": args, "expression": text[match.start():end], "candidate_class": "lua_error" if api.startswith("luaL_") else "lua_value" if api.startswith("lua_") else "console_diagnostic"})
    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / "native-output-candidates.json").write_text(json.dumps({"source_ref": "tome-1.7.6", "scope": "only top-level src/*.c literal output candidates, not coverage", "records": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    selected = [{"index": index, **row} for index, row in enumerate(records) if row["candidate_class"] == "lua_error"]
    print(json.dumps({"total_candidates": len(records), "lua_error_call_sites": len(selected), "lua_error_unique_source_templates": len({row["source_text"] for row in selected})}, ensure_ascii=True))


if __name__ == "__main__":
    main()
