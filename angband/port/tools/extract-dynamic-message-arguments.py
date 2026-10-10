"""Read-only producer argument inventory, never a runtime text lookup."""
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("ab_inventory", ROOT / "inventory/inventory.py")
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)
PRISTINE = inventory.DEFAULT_SOURCE
rows = json.loads((ROOT / "migration/message-data/dynamic-source.json").read_text(encoding="utf-8"))
output = []
for row in rows:
    source = (PRISTINE / row["path"]).read_text(encoding="utf-8")
    tokens = [(m.lastgroup, m.group(), m.start(), m.end()) for m in inventory.TOKEN.finditer(source)
              if m.lastgroup not in {"comment", "space"}]
    call = None
    for index, token in enumerate(tokens):
        if token[1] != row["call"] or index + 1 >= len(tokens) or tokens[index + 1][1] != "(":
            continue
        depth = 0
        for end in range(index + 1, len(tokens)):
            if tokens[end][1] == "(": depth += 1
            elif tokens[end][1] == ")":
                depth -= 1
                if depth == 0:
                    if token[2] <= row["offset"] and tokens[end][3] >= row["offset_end"]:
                        call = (index, end)
                    break
        if call: break
    if not call: raise ValueError("missing reviewed producer " + repr(row))
    index, end = call
    start = tokens[index + 1][3]
    args = []
    depth = 0
    for token in tokens[index + 2:end]:
        if token[1] in {"(", "[", "{"}: depth += 1
        elif token[1] in {")", "]", "}"}: depth -= 1
        elif token[1] == "," and depth == 0:
            args.append(source[start:token[2]].strip())
            start = token[3]
    args.append(source[start:tokens[end][2]].strip())
    output.append({**row, "arguments": args,
                   "producer_source": source[tokens[index][2]:tokens[end][3]],
                   "upstream_file_sha256": __import__("hashlib").sha256((PRISTINE / row["path"]).read_bytes()).hexdigest()})
(ROOT / "migration/message-data/dynamic-arguments.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
for index, row in enumerate(output):
    print(json.dumps({"index": index, "file": Path(row["path"]).name,
                      "function": row["function"], "english": row["text"],
                      "arguments": row["arguments"][row["argument_index"] + 1:]}, ensure_ascii=True))
