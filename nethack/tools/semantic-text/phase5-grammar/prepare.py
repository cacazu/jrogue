"""Prepare isolated, source-only propagation through an/An/the/The (NGPL).

No apply/build/compiler/game/browser command exists here. The public transform
can compose after frozen message and object-name hooks. Default generated
objnam.c is an inspection fixture composed with the existing object transform.
Only this phase5 directory is writable by this generator.
"""
from __future__ import annotations

import argparse
from collections import Counter
import difflib
import hashlib
import json
from pathlib import Path
import re
import runpy
import sys

sys.dont_write_bytecode = True
PHASE = Path(__file__).resolve().parent
ROOT = PHASE.parents[2]
UPSTREAM = ROOT / "upstream/NetHack-5.0.0/src/objnam.c"
BASE = ROOT / "tools/semantic-text"
PINNED = {
    "objnam.c": "445d0b8697ceeb93f1249599b16caffb101a832ee425d76f9eb3fd65088f1dd3",
    "nh-semantic-name.c": "0a5282555eb156c19d56c0deedea599c5e796ec2d508f1b4ed0cbc9a7e1d40b4",
    "nh-semantic-name.h": "7342dbc2282cfdd3fe98c623fabbb9420aed7ff4f37e7f47b07b3b12b35ab301",
}
RECIPES = {
    "an": "nethack.name.grammar.indefinite",
    "An": "nethack.name.grammar.indefinite_capitalized",
    "the": "nethack.name.grammar.definite",
    "The": "nethack.name.grammar.definite_capitalized",
}
LEX = re.compile(r"/\*.*?\*/|//[^\n]*|\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'|[A-Za-z_]\w*|\d+|\S", re.S)


def sha(data: str | bytes) -> str:
    return hashlib.sha256(data.encode("utf-8") if isinstance(data, str) else data).hexdigest()


def once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f"Expected one exact anchor: {old[:100]!r}")
    return text.replace(old, new, 1)


def tokens(text: str) -> list[str]:
    return [m.group() for m in LEX.finditer(text)
            if not m.group().startswith(("/*", "//"))]


def function(text: str, name: str) -> tuple[int, int, str]:
    anchor = f"char *\n{name}(const char *str)\n{{"
    if text.count(anchor) != 1:
        raise ValueError(f"Expected one original {name} definition")
    start = text.index(anchor)
    opening = start + len(anchor) - 1
    depth = 0
    for m in LEX.finditer(text, opening):
        if m.group() == "{": depth += 1
        elif m.group() == "}":
            depth -= 1
            if depth == 0:
                return start, m.end(), text[start:m.end()]
    raise ValueError(f"Unbalanced original function {name}")


def native_calls(text: str) -> Counter:
    ts = tokens(text)
    calls = []
    for i, name in enumerate(ts[:-1]):
        if not re.fullmatch(r"[A-Za-z_]\w*", name) or ts[i + 1] != "(": continue
        if name.startswith("nh_") or name in {"if", "while", "for", "switch", "sizeof"}: continue
        depth, end = 1, i + 2
        while end < len(ts) and depth:
            if ts[end] == "(": depth += 1
            elif ts[end] == ")": depth -= 1
            end += 1
        if depth: raise ValueError("Unbalanced native argument tokens")
        calls.append((name, tuple(ts[i + 2:end - 1])))
    return Counter(calls)


def transform_articles(source: str) -> tuple[str, list[dict]]:
    """Pure transform; accepts pristine or composed source and preserves peers.

    The original append capacity expression moves to one size_t local, with
    the same conversion originally applied by strncat. No original predicate,
    argument, naming call, highc/lowc or allocation is repeated.
    """
    if "nh_text_name_grammar_capture" in source:
        raise ValueError("Article hooks already present")
    changed = source
    operations = []
    for name in RECIPES:
        start, end, body = function(changed, name)
        old = body
        if name in ("an", "the"):
            body = once(body, "    char *buf = nextobuf();",
                        "    struct nh_name_grammar_snapshot nh_grammar_snapshot;\n"
                        "    char *buf;")
            if name == "an":
                body = once(body, "    char *buf;\n\n",
                            "    char *buf;\n\n"
                            "    nh_text_name_grammar_capture(&nh_grammar_snapshot, str);\n"
                            "    buf = nextobuf();\n\n")
            else:
                body = once(body, "    boolean insert_the = FALSE;\n\n",
                            "    boolean insert_the = FALSE;\n\n"
                            "    nh_text_name_grammar_capture(&nh_grammar_snapshot, str);\n"
                            "    buf = nextobuf();\n\n")
                body = once(body, "        Strcpy(&buf[1], str + 1);\n        return buf;",
                            "        Strcpy(&buf[1], str + 1);\n"
                            "        nh_text_name_grammar_case(&nh_grammar_snapshot, buf,\n"
                            "                                  NH_NAME_GRAMMAR_LOWER,\n"
                            f'                                  "{RECIPES[name]}");\n'
                            "        return buf;")
            body = once(body, "    return strncat(buf, str, BUFSZ - 1 - Strlen(buf));",
                        "    {\n"
                        "        size_t nh_grammar_capacity = BUFSZ - 1 - Strlen(buf);\n"
                        "        char *nh_grammar_result = strncat(buf, str, nh_grammar_capacity);\n"
                        "        nh_text_name_grammar_append(&nh_grammar_snapshot,\n"
                        "                                    nh_grammar_result, str, nh_grammar_capacity,\n"
                        f'                                    "{RECIPES[name]}");\n'
                        "        return nh_grammar_result;\n"
                        "    }")
        else:
            called = "an" if name == "An" else "the"
            body = once(body, f"    char *tmp = {called}(str);\n\n",
                        f"    char *tmp = {called}(str);\n"
                        "    struct nh_name_grammar_snapshot nh_grammar_snapshot;\n\n"
                        "    nh_text_name_grammar_capture(&nh_grammar_snapshot, tmp);\n")
            body = once(body, "    *tmp = highc(*tmp);\n    return tmp;",
                        "    *tmp = highc(*tmp);\n"
                        "    nh_text_name_grammar_case(&nh_grammar_snapshot, tmp,\n"
                        "                              NH_NAME_GRAMMAR_UPPER,\n"
                        f'                              "{RECIPES[name]}");\n'
                        "    return tmp;")
        operations.append({"function": name, "original": old, "changed": body})
        changed = changed[:start] + body + changed[end:]
    include = '#include "hack.h"'
    new_include = include + '\n#include "nh-semantic-name-grammar.h"'
    changed = once(changed, include, new_include)
    operations.append({"function": "include", "original": include, "changed": new_include})
    return changed, operations


def restore(changed: str, operations: list[dict]) -> str:
    for operation in reversed(operations):
        changed = once(changed, operation["changed"], operation["original"])
    return changed


def extend_registry(source: str) -> str:
    """Add presentation-only generation tokens in the separate bridge copy."""
    source = once(source, "    const char *pointer;\n", "    const char *pointer;\n    uint64_t generation;\n")
    source = once(source, "static unsigned nh_name_next;", "static unsigned nh_name_next;\nstatic uint64_t nh_name_generation;")
    source = once(source, "        if (nh_names[i].pointer == pointer) nh_names[i].pointer = NULL;",
                  "        if (nh_names[i].pointer == pointer) {\n"
                  "            nh_names[i].pointer = NULL; nh_names[i].generation = 0;\n"
                  "        }")
    source = once(source, "        if (candidate >= start && candidate - start < length)\n            nh_names[i].pointer = NULL;",
                  "        if (candidate >= start && candidate - start < length) {\n"
                  "            nh_names[i].pointer = NULL; nh_names[i].generation = 0;\n"
                  "        }")
    if source.count("slot->pointer = NULL;") != 3 or source.count("    slot->pointer = buffer;") != 2:
        raise ValueError("Canonical registry layout changed")
    source = source.replace("slot->pointer = NULL;", "slot->pointer = NULL; slot->generation = 0;")
    source = source.replace("    slot->pointer = buffer;",
                            "    if (nh_name_generation == UINT64_MAX) return;\n"
                            "    slot->generation = ++nh_name_generation;\n"
                            "    slot->pointer = buffer;")
    return source + "\n" + (PHASE / "bridge-extension.c.in").read_text("utf-8")


def verify_native_tokens(source: str, changed: str, operations: list[dict]) -> dict:
    if restore(changed, operations) != source:
        raise ValueError("Reversible source preservation proof failed")
    checked = {}
    for name in RECIPES:
        _, _, old = function(source, name)
        _, _, new = function(changed, name)
        before, after = native_calls(old), native_calls(new)
        if name in ("an", "the"):
            original = ("strncat", tuple(tokens("buf, str, BUFSZ - 1 - Strlen(buf)")))
            copied = ("strncat", tuple(tokens("buf, str, nh_grammar_capacity")))
            if before[original] != 1 or after[copied] != 1:
                raise ValueError("Original append call missing or repeated")
            del before[original]; del after[copied]
            if new.count("BUFSZ - 1 - Strlen(buf)") != 1:
                raise ValueError("Original append capacity duplicated")
        if before != after:
            raise ValueError(f"Original native calls/argument tokens changed: {name}")
        checked[name] = {"native_calls_and_argument_tokens_preserved": True,
                         "capacity_expression_evaluated_once": name in ("an", "the"),
                         "snapshot_before_original_mutation": True,
                         "error_returns_unmodified": True}
    return checked


def generate(output: Path, composed_source: Path | None = None) -> dict:
    output = output.resolve()
    if not output.is_relative_to(PHASE):
        raise ValueError("Output must remain inside the assigned phase5-grammar directory")
    inputs = {"objnam.c": UPSTREAM, "nh-semantic-name.c": BASE / "nh-semantic-name.c",
              "nh-semantic-name.h": BASE / "nh-semantic-name.h"}
    for name, path in inputs.items():
        if sha(path.read_bytes()) != PINNED[name]: raise ValueError(f"Pinned input changed: {name}")
    original = UPSTREAM.read_text("utf-8")
    if composed_source:
        source = composed_source.read_text("utf-8")
    else:
        object_transform = runpy.run_path(str(ROOT / "tools/instrument-semantic-objects.py"))["instrument_text"]
        source, _ = object_transform(original)
    if "nh_text_name_invalidate_range(obufs[obufidx], sizeof obufs[obufidx])" not in source:
        raise ValueError("Composition requires the existing original nextobuf range invalidator")
    changed, operations = transform_articles(source)
    native = verify_native_tokens(source, changed, operations)
    pristine_changed, pristine_ops = transform_articles(original)
    verify_native_tokens(original, pristine_changed, pristine_ops)
    bridge = extend_registry(inputs["nh-semantic-name.c"].read_text("utf-8"))
    catalog = (PHASE / "catalog-fragment.json").read_text("utf-8")
    table = json.loads(catalog)
    if set(table["en"]) != set(RECIPES.values()) or set(table["ja"]) != set(RECIPES.values()):
        raise ValueError("Catalog recipe coverage mismatch")
    for identifier in RECIPES.values():
        if table["en"][identifier] != "{original}" or table["ja"][identifier] != "{inner}" \
                or table["argument_schemas"][identifier] != ["original", "inner"]:
            raise ValueError("Catalog must preserve complete source union and neutral Japanese grammar")
    deliverables = {
        "src/objnam.c": changed,
        "src/nh-semantic-name.c": bridge,
        "include/nh-semantic-name.h": inputs["nh-semantic-name.h"].read_text("utf-8"),
        "include/nh-semantic-name-grammar.h": (PHASE / "bridge-extension.h.in").read_text("utf-8"),
        "article-only.patch": "".join(difflib.unified_diff(source.splitlines(True), changed.splitlines(True), fromfile="a/src/objnam.c", tofile="b/src/objnam.c")),
        "articles-pristine.patch": "".join(difflib.unified_diff(original.splitlines(True), pristine_changed.splitlines(True), fromfile="a/src/objnam.c", tofile="b/src/objnam.c")),
        "catalog-fragment.json": catalog,
    }
    output.mkdir(parents=True, exist_ok=True)
    for relative, text in deliverables.items():
        path = output / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
    audit = {"schema_version": 1, "official_commit": "16ff59115315917b93185d026aeefea06db9b0f4",
             "status": "source-prepared-uncompiled", "compiled": False, "runtime_verified": False,
             "input_sha256": PINNED, "composed_input_sha256": sha(source),
             "composition": "After original message wrappers and existing object-name hooks; article bodies retain their incoming native queries and argument tokens exactly once.",
             "functions": native, "recipes": RECIPES,
             "bounds": {"registry_slots": 32, "event_json_bytes": 4096, "snapshot_event_json_bytes": 4096, "public_text_bytes": "BUFSZ including NUL", "generation": "uint64_t, overflow fails closed", "formatter_depth": "existing Rust depth 0..8; deeper events fall back"},
             "snapshot": "Stack-owned completed public input/event copied before allocation/case mutation. Capture validates pointer, exact public bytes and live registry generation; owned observations survive later intentional registry invalidation, with source/output byte integrity checked before binding.",
             "fallback": "Original native completed English on missing/stale/truncated/overwritten/overflowed/invalid capture; no reverse English lookup or additional game/name/grammar/RNG call.",
             "output_sha256": {relative: sha(text) for relative, text in deliverables.items()},
             "unverified": ["Compilation/linkage", "Original native full gameplay execution", "Browser article-path regression and state/world/RNG checksum comparison", "Full phase4 producer/catalog composition"]}
    (output / "source-audit.json").write_text(json.dumps(audit, indent=2) + "\n", "utf-8")
    return audit


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=PHASE / "generated")
    parser.add_argument("--source", type=Path, help="Read-only source already composed with object-name hooks")
    args = parser.parse_args()
    print(json.dumps(generate(args.output, args.source), indent=2))
