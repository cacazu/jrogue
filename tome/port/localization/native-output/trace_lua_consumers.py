"""Read selected archive Lua members and record actual native error consumers."""
import json
from pathlib import Path
import re
import zipfile

SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
ROOT = Path(__file__).resolve().parent
PATTERN = re.compile(r"checkError|LuaError|core\.sound\.load|core\.serial\.new|core\.display\.newFont|fs\.zip|\bzip:add\(")


def main():
    matches = []
    for relative in ("game/engines/te4-1.7.6.teae", "game/modules/tome-1.7.6.team"):
        with zipfile.ZipFile(SOURCE / relative) as archive:
            for member in archive.infolist():
                if not member.filename.endswith(".lua"): continue
                text = archive.read(member).decode("utf-8", errors="replace")
                for line_number, line in enumerate(text.splitlines(), 1):
                    if PATTERN.search(line):
                        matches.append({"archive": relative, "source": member.filename, "line": line_number, "text": line.strip()})
    report = {"source_ref": "tome-1.7.6", "scope": "bounded native API/error UI search; candidate callers require review", "matches": matches}
    (ROOT / "lua-consumer-candidates.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    highlighted = [row for row in matches if any(token in row["text"] for token in ("checkError", "LuaError", "core.sound.load", "core.serial.new", "zip:add"))]
    print(json.dumps({"candidate_count": len(matches), "error_sound_save_routes": highlighted}, ensure_ascii=True))


if __name__ == "__main__":
    main()
