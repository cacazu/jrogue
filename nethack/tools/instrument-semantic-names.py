"""Prepare reviewable, source-only hooks for original public monster names.

Added 2026-10-02, NGPL. No compiler or game is invoked. Default is patch/audit
generation only; apply is limited to a caller-supplied verified working tree.
"""
from __future__ import annotations
import argparse
import difflib
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = ROOT / "upstream/NetHack-5.0.0"
TEMPLATES = ROOT / "tools/semantic-text"
NOTICE = "/* Modified 2026-10-02: observe completed public names; original gameplay retained. */\n"


def change_once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f"Expected one original source anchor: {old[:80]!r}")
    return text.replace(old, new, 1)


def guards_by_line(source: str) -> dict[int, list[str]]:
    stack: list[str] = []
    result: dict[int, list[str]] = {}
    for number, line in enumerate(source.splitlines(), 1):
        directive = re.match(r"^\s*#\s*(if|ifdef|ifndef|elif|else|endif)\b(.*)", line)
        if directive:
            kind, expression = directive.groups()
            expression = re.sub(r"/\*.*?\*/", "", expression).strip()
            if kind == "if": stack.append(expression)
            elif kind == "ifdef": stack.append(f"defined({expression})")
            elif kind == "ifndef": stack.append(f"!defined({expression})")
            elif kind == "endif": stack.pop()
            else:
                # No entity rows use these top-level macro-selection branches.
                stack[-1] = "0"
        result[number] = stack.copy()
    return result


def transform(source: str) -> tuple[str, list[str]]:
    """Compose name hooks after token-preserving message instrumentation."""
    changed = change_once(source, '#include "hack.h"', '#include "hack.h"\n#include "nh-semantic-name.h"')
    changed = change_once(changed, "    return bufs[bufidx];", "    nh_text_name_invalidate(bufs[bufidx]);\n    return bufs[bufidx];")
    start = changed.index("char *\nx_monnam(")
    end = changed.index("\nchar *\nl_monnam(", start)
    name_function = changed[start:end]
    name_function = change_once(name_function, "    char *bp, buf2[BUFSZ];",
                               "    char *bp, buf2[BUFSZ];\n    boolean nh_ordinary_name = FALSE, nh_saddled = FALSE;")
    name_function = change_once(name_function, '        Strcat(buf, "saddled ");',
                               '        { Strcat(buf, "saddled "); nh_saddled = TRUE; }')
    name_function = change_once(name_function, "    } else {\n        Strcat(buf, pm_name);",
                               "    } else {\n        nh_ordinary_name = TRUE;\n        Strcat(buf, pm_name);")
    anchor = "    return buf;\n}"
    insertion = ("    if (nh_ordinary_name && !adjective)\n"
                 "        nh_text_name_monster(buf, do_mappear ? &mons[mtmp->mappearance] : mdat,\n"
                 "                              pm_name, insertbuf2 ? buf2 : \"\",\n"
                 "                              do_invis, nh_saddled);\n"
                 "    return buf;\n}")
    name_function = change_once(name_function, anchor, insertion)
    # buf2 contains the full name after Strcat; preserve its original article before that append.
    name_function = change_once(name_function, "    boolean nh_ordinary_name = FALSE, nh_saddled = FALSE;",
                               "    boolean nh_ordinary_name = FALSE, nh_saddled = FALSE;\n    char nh_article[8] = { 0 };")
    name_function = change_once(name_function, "    if (insertbuf2) {\n        Strcat(buf2, buf);",
                               "    if (insertbuf2) {\n        memcpy(nh_article, buf2, strlen(buf2) + 1);\n        Strcat(buf2, buf);")
    name_function = name_function.replace('pm_name, insertbuf2 ? buf2 : "",', 'pm_name, nh_article,')
    changed = NOTICE + changed[:start] + name_function + changed[end:]
    return changed, ["nextmbuf invalidation", "x_monnam ordinary public name", "native article snapshot"]


def generate(metadata: Path, output: Path, apply: Path | None = None) -> dict:
    raw_metadata = metadata.read_bytes()
    records = json.loads(raw_metadata)["entries"]
    entries = [entry for entry in records if entry["category"] == "monster-label"]
    header_source = (UPSTREAM / "include/monsters.h").read_text("utf-8")
    guards = guards_by_line(header_source)
    rows: dict[str, dict] = {}
    for entry in entries:
        enum = entry["source_enum"]
        row = rows.setdefault(enum, {"guards": guards[entry["official_line"]], "fields": {}})
        if row["guards"] != guards[entry["official_line"]]:
            raise ValueError(f"Inconsistent configuration guards: {enum}")
        row["fields"][entry["source_field"]] = entry["id"]
    header = [NOTICE, "/* Exact official enum/gender fields, including their configuration guards. */\n",
              "static const char *const nh_semantic_monster_labels[NUMMONS][NUM_MGENDERS] = {\n"]
    genders = {"name_male": "MALE", "name_female": "FEMALE", "name_neutral": "NEUTRAL"}
    for enum, row in sorted(rows.items()):
        if row["guards"]: header.append("#if " + " && ".join(f"({x})" for x in row["guards"]) + "\n")
        fields = ", ".join(f"[{genders[field]}] = {json.dumps(identifier)}"
                           for field, identifier in sorted(row["fields"].items()))
        header.append(f"    [PM_{enum}] = {{ {fields} }},\n")
        if row["guards"]: header.append("#endif\n")
    header.append("};\n")
    object_source = (UPSTREAM / "include/objects.h").read_text("utf-8")
    object_guards = guards_by_line(object_source)
    object_rows: dict[str, dict] = {}
    object_entries = [entry for entry in records if entry["category"] == "object-label"]
    for entry in object_entries:
        row = object_rows.setdefault(entry["source_enum"],
                                     {"guards": object_guards[entry["official_line"]], "fields": {}})
        if row["guards"] != object_guards[entry["official_line"]]:
            raise ValueError(f"Inconsistent object guards: {entry['source_enum']}")
        row["fields"][entry["source_field"]] = entry["id"]
    object_header = [NOTICE, "static const char *const nh_semantic_object_labels[NUM_OBJECTS][2] = {\n"]
    for enum, row in sorted(object_rows.items()):
        if row["guards"]:
            object_header.append("#if " + " && ".join(f"({x})" for x in row["guards"]) + "\n")
        fields = []
        for field, identifier in sorted(row["fields"].items()):
            index = "NH_NAME_OBJECT_APPEARANCE" if field == "appearance" else "NH_NAME_OBJECT_NAME"
            fields.append(f"[{index}] = {json.dumps(identifier)}")
        object_header.append(f"    [{enum}] = {{ {', '.join(fields)} }},\n")
        if row["guards"]: object_header.append("#endif\n")
    object_header.append("};\n")
    original = (UPSTREAM / "src/do_name.c").read_text("utf-8")
    changed, hooks = transform(original)
    output.mkdir(parents=True, exist_ok=True)
    patch = "".join(difflib.unified_diff(original.splitlines(True), changed.splitlines(True),
                                       fromfile="a/src/do_name.c", tofile="b/src/do_name.c"))
    (output / "names.patch").write_text(patch, "utf-8")
    (output / "nh-semantic-monster-labels.h").write_text("".join(header), "utf-8")
    (output / "nh-semantic-object-labels.h").write_text("".join(object_header), "utf-8")
    audit = {"schema_version": 1, "date": "2026-10-02", "compiled": False, "runtime_verified": False,
             "metadata_sha256": hashlib.sha256(raw_metadata).hexdigest(), "monster_label_ids": len(entries),
             "lexical_monster_records": len(rows), "producer": "x_monnam completed ordinary branch", "hooks": hooks,
             "object_label_ids": len(object_entries), "lexical_object_records": len(object_rows),
             "source_sha256": hashlib.sha256(original.encode()).hexdigest(),
             "patched_sha256": hashlib.sha256(changed.encode()).hexdigest(),
             "knowledge": "do_it branches never register; computed do_mappear selects public apparent form",
             "unsupported": ["arbitrary adjectives", "custom names", "priests", "shopkeepers", "hallucination",
                             "mplayer ranks", "capitalization/suffix transforms", "objects"],
             "fallback": "original public English; no text reverse lookup or second name/RNG calls"}
    (output / "names-audit.json").write_text(json.dumps(audit, indent=2) + "\n", "utf-8")
    if apply:
        source = apply / "src/do_name.c"
        working = source.read_text("utf-8")
        if working != original:
            raise ValueError("Apply requires do_name.c to match preserved official source exactly")
        source.write_text(changed, "utf-8", newline="\n")
        for filename in ("nh-semantic-name.h",):
            (apply / "include" / filename).write_bytes((TEMPLATES / filename).read_bytes())
        (apply / "include/nh-semantic-monster-labels.h").write_text("".join(header), "utf-8")
        (apply / "include/nh-semantic-object-labels.h").write_text("".join(object_header), "utf-8")
        (apply / "src/nh-semantic-name.c").write_bytes((TEMPLATES / "nh-semantic-name.c").read_bytes())
    return audit


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata", type=Path, default=ROOT / "locales/gameplay-core.metadata.json")
    parser.add_argument("--output", type=Path, default=TEMPLATES / "generated-names")
    parser.add_argument("--apply", type=Path)
    args = parser.parse_args()
    print(json.dumps(generate(args.metadata, args.output, args.apply), indent=2))
