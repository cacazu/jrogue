"""Bounded read-only evidence for additional retained native randomness."""
import json
from pathlib import Path
import re
import zipfile

SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
ROOT = Path(__file__).resolve().parent


def main():
    files = list((SOURCE / "src").glob("*.c"))
    files += list((SOURCE / "src/libtcod_import").glob("*.c"))
    files += list((SOURCE / "src/wfc").glob("*.cpp"))
    files += list((SOURCE / "src/wfc").rglob("*.hpp"))
    files += [SOURCE / "src/lua/lmathlib.c"]
    pattern = re.compile(r"\b(?:srand|rand|random|srandom|time|init_gen_rand|genrand_real\d*|gen_rand32|rand_div|TCOD_random_[A-Za-z_]+|mt19937|random_device)\s*\(|std::(?:mt19937|random_device|uniform_[A-Za-z_]+)")
    matches = []
    for path in files:
        for number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if pattern.search(line):
                matches.append({"source": path.relative_to(SOURCE).as_posix(), "line": number, "text": line.strip()})
    lua_matches = []
    lua_pattern = re.compile(r"\b(?:math\.(?:random|randomseed)|rng\.seed|os\.(?:time|clock))\s*\(")
    for archive in (SOURCE / "game/engines/te4-1.7.6.teae", SOURCE / "game/modules/tome-1.7.6.team"):
        with zipfile.ZipFile(archive) as opened:
            for member in opened.infolist():
                if not member.filename.endswith(".lua"):
                    continue
                text = opened.read(member).decode("utf-8", errors="replace")
                for number, line in enumerate(text.splitlines(), 1):
                    if lua_pattern.search(line):
                        lua_matches.append({"archive": archive.relative_to(SOURCE).as_posix(), "source": member.filename, "line": number, "text": line.strip()})
    report = {"source_ref": "tome-1.7.6", "scope": "top-level native TEngine C, libtcod imports, WFC C++/headers, bundled Lua math library and stable engine/module Lua archives; candidate calls, not runtime traces", "matches": matches, "lua_matches": lua_matches}
    target = ROOT / "native-random-candidates.json"
    target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(target), "native_matches": matches, "lua_candidate_count": len(lua_matches), "lua_math_candidates": [item for item in lua_matches if "math.random" in item["text"]]}))


if __name__ == "__main__":
    main()
