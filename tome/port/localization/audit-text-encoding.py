"""Stream the source manifest and audit Lua encoding without rewriting originals."""
from pathlib import Path
import hashlib
import json
import sys

inventory = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
roots = json.loads((inventory / "summary.json").read_text(encoding="utf-8"))["sourceRoots"]
scanned = 0
invalid = []
literal_replacement = []
with (inventory / "files.jsonl").open(encoding="utf-8") as manifest:
    for line in manifest:
        row = json.loads(line)
        if not row["file"].endswith(".lua"):
            continue
        root = Path(roots[int(row["sourceRootId"].removeprefix("root_")) - 1])
        data = (root / row["file"]).read_bytes()
        scanned += 1
        position = 0
        failures = []
        while position < len(data):
            try:
                data[position:].decode("utf-8", errors="strict")
                break
            except UnicodeDecodeError as error:
                start, end = position + error.start, position + error.end
                failures.append({"byte_offset": start, "byte_hex": data[start:end].hex(), "line": data.count(b"\n", 0, start) + 1, "context_hex": data[max(0, start-20):end+20].hex()})
                position = end
        provenance = {"source_root_id": row["sourceRootId"], "file": row["file"], "sha256": hashlib.sha256(data).hexdigest()}
        if failures:
            invalid.append({**provenance, "invalid_utf8_sequences": failures})
        if b"\xef\xbf\xbd" in data:
            literal_replacement.append({**provenance, "literal_replacement_characters": data.count(b"\xef\xbf\xbd")})
result = {"source_commit": "624a67329fe2ad440c5b344785a9c73fcf22ae63", "lua_files_checked": scanned, "invalid_utf8_files": len(invalid), "invalid_utf8_sequences": sum(len(row["invalid_utf8_sequences"]) for row in invalid), "literal_replacement_character_files": len(literal_replacement), "invalid_files": invalid, "literal_replacement_files": literal_replacement, "source_modified": False, "catalog_reader_policy": "Node UTF-8 decoder preserves valid Unicode and substitutes U+FFFD for invalid byte sequences; any source key containing U+FFFD requires explicit native-byte mapping review before production integration."}
(output / "text-encoding-audit.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key:value for key,value in result.items() if key not in {"invalid_files", "literal_replacement_files"}}))
