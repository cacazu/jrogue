"""Prepare isolated monster public-composition observations (NGPL).

Only this directory may receive generated files. No apply/compiler/runtime
entry point exists. Source branch IDs replace no native decisions or calls.
Compose stock core/quest/name/object hooks, phase4, phase5, then this transform.
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
BASE = ROOT / "tools/semantic-text"
UPSTREAM = ROOT / "upstream/NetHack-5.0.0/src/do_name.c"
PIN = "64c6cb5e7f4034e9edbd8fac983b313a7df0e029b4812bd3a9327852d12ad9d1"
LEX = re.compile(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_]\w*|\d+|\S', re.S)
CAPITALIZED = ["Monnam", "noit_Monnam", "Some_Monnam", "YMonnam", "Adjmonnam", "Amonnam"]


def sha(text: str | bytes) -> str:
    return hashlib.sha256(text.encode("utf-8") if isinstance(text, str) else text).hexdigest()


def once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f"Expected one exact native anchor: {old[:100]!r}")
    return text.replace(old, new, 1)


def function(text: str, name: str) -> tuple[int, int, str]:
    match = re.search(r"\n(?:char \*|const char \*)\n" + re.escape(name) + r"\(", text)
    if not match: raise ValueError(f"Native definition missing: {name}")
    start = match.start() + 1
    opening = text.index("{", match.end())
    depth = 0
    for token in LEX.finditer(text, opening):
        if token.group() == "{": depth += 1
        elif token.group() == "}":
            depth -= 1
            if not depth: return start, token.end(), text[start:token.end()]
    raise ValueError(f"Unbalanced native function: {name}")


def normalize_stock_body(body: str) -> str:
    """Remove only the narrower incoming ordinary hook, retaining its allocator
    and native article snapshots. Other incoming instrumentation stays intact.
    """
    if "nh_ordinary_name" not in body: return body
    body = once(body, "boolean nh_ordinary_name = FALSE, nh_saddled = FALSE;",
                "boolean nh_saddled = FALSE;")
    body = once(body, "        nh_ordinary_name = TRUE;\n", "")
    body = once(body,
                "    if (nh_ordinary_name && !adjective)\n"
                "        nh_text_name_monster(buf, do_mappear ? &mons[mtmp->mappearance] : mdat,\n"
                "                              pm_name, nh_article,\n"
                "                              do_invis, nh_saddled);\n", "")
    return body


def transform(source: str) -> tuple[str, list[dict]]:
    if 'nh-semantic-monster-composite.h' in source:
        raise ValueError("Phase6 monster hooks already present")
    changed = source
    operations: list[dict] = []
    start, end, incoming = function(changed, "x_monnam")
    body = normalize_stock_body(incoming)
    if 'char nh_article[8]' not in body:
        body = once(body, "    char *bp, buf2[BUFSZ];",
                    "    char *bp, buf2[BUFSZ];\n"
                    "    boolean nh_saddled = FALSE;\n    char nh_article[8] = { 0 };")
        body = once(body, '        Strcat(buf, "saddled ");',
                    '        { Strcat(buf, "saddled "); nh_saddled = TRUE; }')
        body = once(body, "    if (insertbuf2) {\n        Strcat(buf2, buf);",
                    "    if (insertbuf2) {\n"
                    "        memcpy(nh_article, buf2, strlen(buf2) + 1);\n        Strcat(buf2, buf);")
    body = once(body, "    char *buf = nextmbuf();",
                "    struct nh_monster_composite nh_monster;\n"
                "    char *buf = (nh_text_monster_begin(&nh_monster, adjective), nextmbuf());")
    body = once(body, "    char *bp, buf2[BUFSZ];",
                "    char *bp, buf2[BUFSZ];\n"
                "    const char *nh_shkname = NULL, *nh_ghost_suffix = NULL;\n"
                "    const struct permonst *nh_visible = NULL;\n"
                "    boolean nh_shop_adjective = FALSE, nh_shop_extended = FALSE;\n"
                "    boolean nh_shop_invisible = FALSE;")
    body = once(body, '    if (mtmp == &gy.youmonst)\n        return strcpy(buf, "you");',
                '    if (mtmp == &gy.youmonst) {\n'
                '        char *nh_result = strcpy(buf, "you");\n'
                '        nh_text_monster_leaf(&nh_monster, "nethack.name.monster.phase6.you", "you");\n'
                '        nh_text_monster_leaf_finish(&nh_monster, nh_result);\n'
                '        return nh_result;\n    }')
    original_anon = '        Strcpy(buf, !augment_it ? "it"\n                    : (!do_hallu ? s_one : !rn2(2)) ? "someone"\n                      : "something");'
    mapped_anon = ('        Strcpy(buf, !augment_it ? nh_text_monster_leaf(&nh_monster,\n'
                   '                      "nethack.name.monster.phase6.it", "it")\n'
                   '                    : (!do_hallu ? s_one : !rn2(2))\n'
                   '                      ? nh_text_monster_leaf(&nh_monster,\n'
                   '                          "nethack.name.monster.phase6.someone", "someone")\n'
                   '                      : nh_text_monster_leaf(&nh_monster,\n'
                   '                          "nethack.name.monster.phase6.something", "something"));\n'
                   '        nh_text_monster_leaf_finish(&nh_monster, buf);')
    body = once(body, original_anon, mapped_anon)
    body = once(body, "        return strcpy(buf, name);",
                "        {\n            char *nh_result = strcpy(buf, name);\n"
                "            nh_text_name_invalidate(nh_result);\n"
                "            return nh_result;\n        }")
    body = once(body, "pmname(&mons[mtmp->mappearance], Mgender(mtmp))",
                "pmname((nh_visible = &mons[mtmp->mappearance]), Mgender(mtmp))")
    body = once(body, "        pm_name = mon_pmname(mtmp);",
                "        pm_name = mon_pmname(mtmp);\n        nh_visible = mdat;")
    body = once(body, "        if (adjective && article == ARTICLE_THE) {",
                "        if (adjective && article == ARTICLE_THE) {\n"
                "            nh_shop_adjective = TRUE;")
    if body.count("Strcat(buf, shkname(mtmp));") != 2:
        raise ValueError("Expected exactly two original shopkeeper calls")
    body = body.replace("Strcat(buf, shkname(mtmp));",
                        "Strcat(buf, (nh_shkname = shkname(mtmp)));")
    body = once(body, "            if (mdat != &mons[PM_SHOPKEEPER] || do_invis){",
                "            if (mdat != &mons[PM_SHOPKEEPER] || do_invis){\n"
                "                nh_shop_extended = TRUE;")
    body = once(body, '                if (do_invis)\n                    Strcat(buf, "invisible ");',
                '                if (do_invis) {\n                    Strcat(buf, "invisible ");\n'
                '                    nh_shop_invisible = TRUE;\n                }')
    body = once(body, "        return buf;\n    }\n\n    /* Put the adjectives",
                "        nh_text_monster_shop(&nh_monster, buf, nh_shkname, nh_visible, pm_name,\n"
                "                             nh_shop_adjective, nh_shop_extended, nh_shop_invisible);\n"
                "        return buf;\n    }\n\n    /* Put the adjectives")
    body = once(body, "    has_adjectives = (buf[0] != '\\0');",
                "    has_adjectives = (buf[0] != '\\0');\n"
                "    nh_text_monster_prefix(&nh_monster, buf, do_invis, nh_saddled);")
    body = once(body, "        Strcat(buf, rname);",
                "        Strcat(buf, rname);\n"
                "        nh_text_monster_nested(&nh_monster, buf, rname);")
    body = once(body, '            Sprintf(eos(buf), "%s ghost", s_suffix(name));',
                '            Sprintf(eos(buf), "%s ghost", (nh_ghost_suffix = s_suffix(name)));\n'
                '            nh_text_monster_ghost(&nh_monster, buf, name, nh_ghost_suffix);')
    body = once(body, '            Sprintf(eos(buf), "%s called %s", pm_name, name);',
                '            Sprintf(eos(buf), "%s called %s", pm_name, name);\n'
                '            nh_text_monster_called(&nh_monster, buf,\n'
                '                 nh_visible, pm_name, name);')
    body = once(body, "            Strcat(buf, name);\n            name_at_start = TRUE;",
                "            Strcat(buf, name);\n"
                "            nh_text_monster_nested(&nh_monster, buf, name);\n"
                "            name_at_start = TRUE;")
    body = once(body, "    } else {\n        Strcat(buf, pm_name);",
                "    } else {\n        Strcat(buf, pm_name);\n"
                "        nh_text_monster_label(&nh_monster, buf,\n"
                "                 nh_visible, pm_name);")
    body = once(body, "    return buf;\n}",
                "    nh_text_monster_finish(&nh_monster, buf, article, nh_article);\n"
                "    return buf;\n}")
    operations.append({"function": "x_monnam", "original": incoming, "changed": body})
    changed = changed[:start] + body + changed[end:]
    for name in CAPITALIZED:
        start, end, old = function(changed, name)
        new = once(old, "    *bp = highc(*bp);",
                   "    struct nh_name_grammar_snapshot nh_monster_case;\n\n"
                   "    nh_text_name_grammar_capture(&nh_monster_case, bp);\n"
                   "    *bp = highc(*bp);\n"
                   "    nh_text_name_grammar_case(&nh_monster_case, bp, NH_NAME_GRAMMAR_UPPER,\n"
                   '                               "nethack.name.monster.phase6.capitalized");')
        operations.append({"function": name, "original": old, "changed": new})
        changed = changed[:start] + new + changed[end:]
    start, end, old = function(changed, "rndmonnam")
    new = once(old, "    char *mnam;", "    char *mnam;\n    const char *nh_random_name = NULL;")
    new = once(new, "    if (code)\n        *code = '\\0';",
               "    nh_text_name_invalidate_range(buf, sizeof buf);\n"
               "    if (code)\n        *code = '\\0';")
    new = once(new, "        mnam = strcpy(buf, pmname(&mons[name], rn2_on_display_rng(2)));",
               "        mnam = strcpy(buf, (nh_random_name = pmname(&mons[name], rn2_on_display_rng(2))));\n"
               "        nh_text_monster_selected_random(mnam, &mons[name], nh_random_name);")
    operations.append({"function": "rndmonnam", "original": old, "changed": new})
    changed = changed[:start] + new + changed[end:]
    include = '#include "hack.h"'
    new_include = include + '\n#include "nh-semantic-monster-composite.h"'
    changed = once(changed, include, new_include)
    operations.append({"function": "include", "original": include, "changed": new_include})
    return changed, operations


def restore(changed: str, operations: list[dict]) -> str:
    for operation in reversed(operations):
        changed = once(changed, operation["changed"], operation["original"])
    return changed


def native_calls(text: str) -> Counter:
    """Normalize only exact generated transparent capture constructs, then
    compare every original function and its argument-token sequence.
    """
    text = text.replace('(nh_text_monster_begin(&nh_monster, adjective), nextmbuf())', 'nextmbuf()')
    text = text.replace('(nh_visible = &mons[mtmp->mappearance])', '&mons[mtmp->mappearance]')
    text = re.sub(r'nh_text_monster_leaf\(&nh_monster,\s*"[^"\n]+",\s*("[^"\n]+")\)', r'\1', text)
    for name, original in [
        ("nh_shkname", "shkname(mtmp)"),
        ("nh_ghost_suffix", "s_suffix(name)"),
        ("nh_random_name", "pmname(&mons[name], rn2_on_display_rng(2))"),
    ]:
        text = text.replace(f"({name} = {original})", original)
    ts = [m.group() for m in LEX.finditer(text) if not m.group().startswith(("/*", "//"))]
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


def verify(source: str, changed: str, operations: list[dict]) -> dict:
    if restore(changed, operations) != source:
        raise ValueError("Exact incoming source restoration failed")
    results = {}
    for name in ["x_monnam", *CAPITALIZED, "rndmonnam"]:
        _, _, before = function(source, name)
        _, _, after = function(changed, name)
        # Existing stock article snapshot is intentionally retained. On a
        # pristine fixture, exclude only its new pure memcpy/strlen observers.
        before = normalize_stock_body(before) if name == "x_monnam" else before
        left, right = native_calls(before), native_calls(after)
        if name == "x_monnam" and "char nh_article[8]" not in before:
            right.subtract(native_calls("memcpy(nh_article, buf2, strlen(buf2) + 1);"))
            right += Counter()
        if left != right:
            raise ValueError(f"Native call/argument tokens changed: {name}: {left - right} / {right - left}")
        results[name] = {"exact_native_call_and_argument_tokens": True,
                         "original_native_calls": sum(left.values()),
                         "reversible_incoming_source_bytes": True}
    return results


def generate(output: Path, composed: Path | None = None) -> dict:
    output = output.resolve()
    if not output.is_relative_to(PHASE): raise ValueError("Output escapes assigned phase6 directory")
    if sha(UPSTREAM.read_bytes()) != PIN: raise ValueError("Pinned official do_name.c changed")
    original = UPSTREAM.read_text("utf-8")
    stock = runpy.run_path(str(ROOT / "tools/instrument-semantic-names.py"))
    source = composed.read_text("utf-8") if composed else stock["transform"](original)[0]
    if "nh_text_name_invalidate(bufs[bufidx])" not in source:
        raise ValueError("Composition requires original nextmbuf invalidation")
    changed, operations = transform(source)
    checks = verify(source, changed, operations)
    pristine, pristine_ops = transform(original)
    verify(original, pristine, pristine_ops)
    phase5 = runpy.run_path(str(BASE / "phase5-grammar/prepare.py"))
    bridge = phase5["extend_registry"]((BASE / "nh-semantic-name.c").read_text("utf-8"))
    bridge += "\n" + (PHASE / "bridge-extension.c.in").read_text("utf-8")
    catalog = (PHASE / "catalog-fragment.json").read_text("utf-8")
    payload = json.loads(catalog)
    if set(payload["en"]) != set(payload["ja"]) or set(payload["en"]) != set(payload["argument_schemas"]):
        raise ValueError("Paired catalog/schema IDs differ")
    for identifier in payload["en"]:
        union = set(re.findall(r"\{([a-z_]+)\}", payload["en"][identifier] + payload["ja"][identifier]))
        if union != set(payload["argument_schemas"][identifier]):
            raise ValueError(f"Catalog full union mismatch: {identifier}")
    deliverables = {
        "src/do_name.c": changed,
        "src/nh-semantic-name.c": bridge,
        "include/nh-semantic-name.h": (BASE / "nh-semantic-name.h").read_text("utf-8"),
        "include/nh-semantic-name-grammar.h": (BASE / "phase5-grammar/bridge-extension.h.in").read_text("utf-8"),
        "include/nh-semantic-monster-composite.h": (PHASE / "bridge-extension.h.in").read_text("utf-8"),
        "include/nh-semantic-monster-labels.h": (BASE / "generated-names/nh-semantic-monster-labels.h").read_text("utf-8"),
        "include/nh-semantic-object-labels.h": (BASE / "generated-names/nh-semantic-object-labels.h").read_text("utf-8"),
        "monster-composition.patch": "".join(difflib.unified_diff(source.splitlines(True), changed.splitlines(True), fromfile="a/src/do_name.c", tofile="b/src/do_name.c")),
        "monster-pristine.patch": "".join(difflib.unified_diff(original.splitlines(True), pristine.splitlines(True), fromfile="a/src/do_name.c", tofile="b/src/do_name.c")),
        "catalog-fragment.json": catalog,
    }
    output.mkdir(parents=True, exist_ok=True)
    for relative, text in deliverables.items():
        path = output / relative; path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
    audit = {
        "schema_version": 1, "official_commit": "16ff59115315917b93185d026aeefea06db9b0f4",
        "status": "isolated-source-prepared-uncompiled", "compiled": False, "runtime_verified": False,
        "runtime_binding_approved": False, "official_source_sha256": PIN,
        "composed_input_sha256": sha(source), "native_token_preservation": checks,
        "composition": "After stock name allocator hooks, phase4 wrappers and Phase5 registry/case propagation. This transform replaces only the narrower incoming ordinary x_monnam observer.",
        "bounds": {"registry_slots": 32, "event_json_bytes": 4096, "copied_original_bytes": "BUFSZ including NUL", "generation": "uint64_t overflow fails closed", "stack_owner_bytes_estimate": "~9 KiB when BUFSZ=256; actual C sizeof/stack peak unmeasured", "maximum_formatter_depth": "existing Rust <=8; overflow means whole EN"},
        "covered_source_branches": ["you", "it/someone/something actual selected anonymous leaf", "ordinary source-selected public gender/species label", "named/called only with original creator-certified personal/rank descriptor", "ghost owner plus original selected s_suffix output", "shopkeeper proper/extended/adjective with required adjective descriptor", "original final article/your ownership/invisible/saddle", "six capitalization wrappers", "rndmonnam real selected species (not real target)"],
        "conditional_or_unsupported": ["adjective without exact source descriptor (including present empty adjective)", "MGIVENNAME without original creator provenance (plain/called name both whole EN; allocation/free/replacement invalidation also required)", "priest/minion stays whole EN pending caller-owned completed priestname/deity descriptor and stack-lifetime proof; no generic stack-pointer inference", "named mplayer rank split", "unnamed rank_of result", "rndmonnam bogus-file names and fallback bogon", "distant_monnam/mon_nam_too/monverbself/coyotename and arbitrary suffix/copy callers", "unproven UTF-8/capacity/nested-depth cases"],
        "knowledge": "Only actual appended public source pieces. Original do_mappear selects apparent species; anonymous branches export selected pronoun ID only. Actual native article and conditional adjective appends own their facts. No hidden true species/gender/ownership/state reads in bridge.",
        "fallback": "Missing/stale/clipped/unregistered/ambiguous/oversized descriptor => invalidate result descriptor and preserve entire exact original native English.",
        "output_sha256": {relative: sha(text) for relative, text in deliverables.items()},
        "unverified": ["C compilation/link/ABI", "native original naming paths", "state/world/main RNG/display RNG invariance", "browser localization/English replay", "full producer/catalog/phase4 composition", "all special monster names"]
    }
    (output / "source-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return audit


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=PHASE / "generated")
    parser.add_argument("--source", type=Path, help="Read-only already-composed do_name.c")
    arguments = parser.parse_args()
    print(json.dumps(generate(arguments.output, arguments.source), ensure_ascii=False, indent=2))
