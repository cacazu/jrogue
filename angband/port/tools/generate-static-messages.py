"""Bind authored static translations to lexical C producers, never runtime text.

The pinned occurrence inventory is the review identity; the current source is
lexed to locate its unchanged producer. Native statements remain byte-for-byte
reconstructible by removing AB_GAME_STATIC additions. Run --apply only after
catalog review. Reserved agent files are recorded as pending, not overwritten.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
COMMIT = "f3082213b73f3e463e3d0d60bff4b00462beae6e"
spec = importlib.util.spec_from_file_location("source_inventory", ROOT / "inventory/inventory.py")
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)
RESERVED = {"player-birth.c", "ui-birth.c", "ui-store.c", "ui-object.c", "ui-knowledge.c",
            "ui-target.c", "ui-death.c", "ui-score.c", "ui-curse.c", "ui-keymap.c",
            "ui-visuals.c", "ui-command.c", "ui-menu.c", "ui-options.c", "obj-chest.c"}
TAG = re.compile(r"/\* AB_GAME_STATIC_BEGIN \*/[\s\S]*?/\* AB_GAME_STATIC_END \*/")

def read_json(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))

def original_positions(text):
    """Map universal-newline character offsets through mixed CRLF/LF input."""
    positions, cursor = [], 0
    while cursor < len(text):
        positions.append(cursor)
        cursor += 2 if text.startswith("\r\n", cursor) else 1
    positions.append(len(text))
    return positions

def producer_id(row):
    file = inventory.slug(Path(row["path"]).stem).replace("effect_handler_", "effect_")
    function = inventory.slug(row["function"] or "message").removeprefix("effect_handler_").removeprefix("do_cmd_")
    words = inventory.slug(row["text"]).split("_")
    prefix = "game.message." + file + "." + function + "."
    phrase = "_".join(words[:9])
    while len(prefix + phrase) > 127 and "_" in phrase:
        phrase = phrase.rsplit("_", 1)[0]
    value = prefix + phrase
    if len(value) > 127:
        raise ValueError("producer namespace needs semantic review: " + value)
    return value

def call_start(text, row):
    tokens = [(m.lastgroup, m.group(), m.start(), m.end()) for m in inventory.TOKEN.finditer(text)
              if m.lastgroup not in {"comment", "space"}]
    for index in range(len(tokens) - 1, -1, -1):
        kind, value, start, end = tokens[index]
        if start >= row["offset"] or kind != "identifier" or value != row["call"]:
            continue
        if index + 1 == len(tokens) or tokens[index + 1][1] != "(":
            continue
        depth = 0
        for token in tokens[index + 1:]:
            if token[1] == "(": depth += 1
            elif token[1] == ")":
                depth -= 1
                if depth == 0:
                    if token[2] >= row["offset_end"]:
                        return start
                    break
    raise ValueError("Cannot locate reviewed call " + repr(row))

def main():
    args = argparse.ArgumentParser()
    args.add_argument("--apply", action="store_true")
    args.add_argument("--release", nargs="*", default=[])
    args.add_argument("--repair", action="store_true")
    options = args.parse_args()
    source = read_json("migration/message-data/static-source.json")
    review = read_json("migration/message-data/static-review.json")
    assert review["reviewed"] and review["upstreamCommit"] == COMMIT
    translations = {entry["english"]: entry["japanese"] for entry in review["entries"]}
    assert len(translations) == len(source["strings"]) == 316
    assert set(translations) == set(source["strings"])
    entries = {}
    bindings = {}
    for row in source["occurrences"]:
        key = producer_id(row)
        if key in entries:
            assert entries[key]["english"] == row["text"], "semantic ID collision: " + key
        else:
            entries[key] = {"id": key, "english": row["text"], "japanese": translations[row["text"]],
                            "parameters": [], "role": "source_static_message", "sources": []}
        origin = {"file": "logic/" + Path(row["path"]).name, "function": row["function"],
                  "upstreamLine": row["line"], "call": row["call"],
                  "formatArgumentIndex": row["argument_index"],
                  "originalLiteral": row["raw_fragments"], "reviewSourceIndex": source["strings"].index(row["text"])}
        entries[key]["sources"].append(origin)
        bindings[(Path(row["path"]).name, row["function"], row["call"], row["text"])] = key
    snapshot = ROOT / "tests/static-message-source-snapshot"
    snapshot.mkdir(exist_ok=True)
    changes, pending = [], []
    previous_path = ROOT / "migration/message-data/static-manifest.json"
    previous = read_json("migration/message-data/static-manifest.json") if previous_path.exists() else None
    applied = {entry["file"]: entry for entry in previous["integration"]["applied"]} if previous else {}
    for name in sorted({binding[0] for binding in bindings}):
        if name in RESERVED and name not in options.release:
            pending.append(name)
            continue
        filename = ROOT / "logic" / name
        original = filename.read_bytes()
        text = original.decode("utf-8")
        if TAG.search(text) and not options.repair:
            assert name in applied, "missing immutable static-message baseline: " + name
            changes.append(applied[name])
            continue
        if options.repair:
            text = TAG.sub("", text)
            original = text.encode("utf-8")
        # Inventory normalizes newlines. Keep source mutations on original bytes.
        normalized = text.replace("\r\n", "\n")
        positions = original_positions(text)
        if options.repair:
            lexical_input = ROOT / "tests" / "static-repair-input.c"
            lexical_input.write_bytes(original)
            rows, _ = inventory.c_inventory(lexical_input, ROOT)
            lexical_input.unlink()
        else:
            rows, _ = inventory.c_inventory(filename, ROOT)
        modifications = []
        matched = []
        for row in rows:
            key = (name, row["function"], row["call"], row["text"])
            if key not in bindings:
                continue
            if row["argument_index"] != (0 if row["call"] == "msg" else 1):
                continue
            offset = call_start(normalized, row)
            sound = "MSG_GENERIC"
            if row["call"] == "msgt":
                prefix = normalized[offset:row["offset"]]
                prefix = re.sub(r"/\*[\s\S]*?\*/|//[^\n]*", "", prefix)
                atom = re.fullmatch(r"msgt\s*\(\s*([A-Za-z_][A-Za-z_0-9]*|[0-9]+)\s*,\s*", prefix)
                if not atom:
                    raise ValueError("Sound producer needs one-evaluation review: " + repr(row))
                # Constants and existing local scalar reads have no evaluation
                # effects. The synchronous pure capture cannot mutate the value.
                sound = atom[1]
            original_offset = positions[offset]
            assert re.match(r"msgt?\s*\(", text[original_offset:]), (name, semantic if 'semantic' in locals() else key)
            semantic = bindings[key]
            addition = '/* AB_GAME_STATIC_BEGIN */AB_STATIC_MSG("' + semantic + '", ' + sound + '), /* AB_GAME_STATIC_END */'
            modifications.append((original_offset, addition))
            matched.append({"id": semantic, "function": row["function"], "call": row["call"],
                            "sourceLineBefore": row["line"], "sound": sound})
        expected = [row for row in source["occurrences"] if Path(row["path"]).name == name]
        assert len(modifications) == len(expected), (name, len(modifications), len(expected))
        for offset, addition in sorted(modifications, reverse=True):
            text = text[:offset] + addition + text[offset:]
        nl = "\r\n" if "\r\n" in text else "\n"
        header = '/* AB_GAME_STATIC_BEGIN */' + nl + '#include "web-static-text.h"' + nl + '/* AB_GAME_STATIC_END */'
        # Keep the separator inside the removable tag; native reconstruction
        # includes the original first byte and every original line ending.
        text = header + text
        assert TAG.sub("", text).encode("utf-8") == original, name
        baseline = snapshot / name
        sha = hashlib.sha256(baseline.read_bytes() if options.repair and baseline.exists() else original).hexdigest()
        if options.apply:
            if not options.repair or not baseline.exists(): baseline.write_bytes(original)
            filename.write_bytes(text.encode("utf-8"))
        changes.append({"file": name, "acceptedSourceSha256": sha, "bindings": matched,
                        "sourceApplied": options.apply})
    manifest = {"schema_version": 1, "upstream_commit": COMMIT, "reviewed": True,
                "complete_game_translation": False, "entries": sorted(entries.values(), key=lambda e: e["id"]),
                "reviewedStrings": 316, "reviewedCallsites": len(source["occurrences"]),
                "integration": {"applied": changes, "pendingFiles": pending, "engineBuilt": False}}
    (ROOT / "migration/message-data/static-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"reviewedIds": len(entries), "reviewedCallsites": len(source["occurrences"]),
                      "appliedFiles": sum(bool(row["sourceApplied"]) for row in changes), "candidateFiles": len(changes), "pendingFiles": pending}))

if __name__ == "__main__":
    main()
