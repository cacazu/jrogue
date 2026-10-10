"""Independent source/provenance/ownership checks; no C compilation (NGPL)."""
from __future__ import annotations

from collections import Counter
import argparse
import hashlib
import json
from pathlib import Path
import re
import runpy
import sys

sys.dont_write_bytecode = True
PHASE = Path(__file__).resolve().parent
ROOT = PHASE.parents[2]
UPSTREAM = ROOT / "upstream/NetHack-5.0.0"
TOKEN = re.compile(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_]\w*|\d+|\S', re.S)
STRING = re.compile(r'"(?:\\.|[^"\\])*"')


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def macro(text: str, name: str) -> str:
    start = text.index("#define " + name + "(")
    end = start
    while True:
        stop = text.find("\n", end)
        if stop < 0: return text[start:]
        line = text[end:stop]
        if not line.endswith("\\"): return text[start:stop]
        end = stop + 1


def split_args(text: str) -> list[str]:
    depth, begin, args = 0, 0, []
    for match in TOKEN.finditer(text):
        token = match.group()
        if token in {"(", "[", "{"}: depth += 1
        elif token in {")", "]", "}"}: depth -= 1
        elif token == "," and not depth:
            args.append(text[begin:match.start()].strip())
            begin = match.end()
    args.append(text[begin:].strip())
    return args


def unwrap(text: str, name: str, replacement) -> str:
    pattern = re.compile(r"\b" + name + r"\(")
    while match := pattern.search(text):
        start, opening = match.start(), match.end() - 1
        depth, closing = 0, None
        for token in TOKEN.finditer(text, opening):
            if token.group() == "(": depth += 1
            elif token.group() == ")":
                depth -= 1
                if not depth:
                    closing = token.end()
                    break
        if closing is None: raise AssertionError(f"Unbalanced {name}")
        args = split_args(text[opening + 1:closing - 1])
        text = text[:start] + replacement(args) + text[closing:]
    return text


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", action="store_true", help="Write verified results/hashes inside this owned phase directory")
    options = parser.parse_args()
    prepare = runpy.run_path(str(PHASE / "prepare.py"))
    artifacts = prepare["build"]()
    catalog, manifest = artifacts["catalog"], artifacts["manifest"]
    checks = []
    ids = set()
    family_counts = Counter()
    record_count = 0
    for item in catalog["entries"]:
        assert item["id"] not in ids
        ids.add(item["id"])
        assert item["runtime_binding_approved"] is False
        assert item["arguments"] == [] and item["argument_schemas"] == [[]]
        assert "%" not in item["ja"] and "{arg_" not in item["ja"]
        encoded = json.dumps({"id": item["id"], "args": {}}, separators=(",", ":")).encode()
        assert len(encoded) + 1 <= 192
        assert len(item["en"].encode()) + 1 <= 96
        assert re.fullmatch(r"[a-z0-9._]+", item["id"])
        assert "parts" not in item["id"] and "species" not in item["id"]
        family_counts[item["id"].split(".")[2]] += 1
        for record in item["source_literals"]:
            record_count += 1
            source = UPSTREAM / record["source"]
            raw = source.read_bytes()
            assert digest(raw) == record["source_blob_sha256"]
            original = raw.decode()
            expression = record["producer_expression"]
            occurrences = [m.start() for m in re.finditer(re.escape(expression), original)]
            matching = [offset for offset in occurrences
                        if original.count("\n", 0, offset) + 1 == record["producer_declaration_start_line"]]
            assert len(matching) == 1, (record["source"], record["line"], "exact declaration")
            offset = matching[0]
            a, b = record["source_literal_start_offset"], record["source_literal_end_offset"]
            assert expression[a:b] == record["original_literal_token"]
            assert json.loads(expression[a:b]) == item["en"]
            assert original.count("\n", 0, offset + a) + 1 == record["line"]
            lexical = TOKEN.sub(lambda m: re.sub(r"[^\n]", " ", m.group())
                                if m.group().startswith(("/*", "//")) else m.group(), expression)
            strings = list(STRING.finditer(lexical))
            chosen = strings[record["source_literal_ordinal"]]
            assert (chosen.start(), chosen.end()) == (a, b)
            assert record["role"] == "selected-output-literal"
            assert record["runtime_binding_approved"] is False
            assert record["descriptor_enabled"] == item["descriptor_enabled"]
    assert record_count == 415
    assert len(ids) == 321
    assert dict(family_counts) == {"body": 152, "color": 74, "liquid": 40,
                                   "motion": 24, "skill": 17, "plural": 2,
                                   "pronoun_subject": 4, "pronoun_object": 4, "pronoun_possessive": 4}
    checks.append("415 exact original token slices/ordinals/lines and 321 unique public lexical IDs")

    # Independently unwrap newly inserted source observers, proving the original
    # return/predicate/index expressions remain intact without trusting the
    # generator's operation reversal as the sole check.
    for path in ("src/do_name.c", "src/polyself.c", "src/mondata.c"):
        changed = artifacts["generated"][path]
        assert prepare["native_calls"](changed) == prepare["native_calls"]((UPSTREAM / path).read_text())
        changed = unwrap(changed, "nh_phase6_selected_table",
                         lambda args: args[1] + "[" + args[4] + "]")
        changed = unwrap(changed, "nh_phase6_selected_const", lambda args: args[1])
        changed = changed.replace('#include "nh-phase6-helper.h"\n', "")
        changed = changed.replace('#include "nh-phase6-helper-labels.h"\n', "")
        assert changed == (UPSTREAM / path).read_text()
    checks.append("independent observer unwrapping restores all three helper source files byte for byte; native argument tokens/counts identical")

    weapon = artifacts["generated"]["src/weapon.c"]
    old_pname = macro((UPSTREAM / "src/weapon.c").read_text(), "P_NAME")
    assert macro(weapon, "P_NAME") == old_pname
    new_pname = macro(weapon, "nh_phase6_p_name_value")
    new_pname = unwrap(new_pname, "nh_phase6_fallback_value", lambda args: args[0])
    new_pname = unwrap(new_pname, "nh_phase6_table_value",
                       lambda args: args[0] + "[" + args[3] + "]")
    new_pname = new_pname.replace("#define nh_phase6_p_name_value(type)", "#define P_NAME(type)")
    assert new_pname == old_pname
    # Numeric macro keeps arbitrary original C type, avoiding a new int/long
    # parameter conversion. Its sole comparison and selected native suffixes
    # normalize exactly to the original expression.
    hack = artifacts["generated"]["include/hack.h"]
    old_plur = macro((UPSTREAM / "include/hack.h").read_text(), "plur")
    assert macro(hack, "plur") == old_plur
    new_plur = unwrap(macro(hack, "nh_phase6_plur_value"), "nh_phase6_leaf_value",
                      lambda args: args[0])
    old_expression = old_plur.split(" ", 2)[2]
    new_expression = new_plur.replace("\\\n", " ").split(")", 1)[1].strip()
    assert re.sub(r"\s+", "", new_expression) == re.sub(r"\s+", "", old_expression)
    checks.append("P_NAME control/index/martial_bonus and plur original typed predicate normalize exactly; original macros retained")

    you = artifacts["generated"]["include/you.h"]
    original_you = (UPSTREAM / "include/you.h").read_text()
    fields = {"NH_PHASE6_PRONOUN_SUBJECT": "he", "NH_PHASE6_PRONOUN_OBJECT": "him",
              "NH_PHASE6_PRONOUN_POSSESSIVE": "his"}
    for name in prepare["PRONOUN_MACROS"]:
        original_macro = macro(original_you, name)
        assert macro(you, name) == original_macro
        typed = macro(you, "nh_phase6_" + name + "_value")
        typed = unwrap(typed, "nh_phase6_pronoun_table_value",
                       lambda args: args[0] + "[" + args[1] + "]." + fields[args[2]])
        typed = typed.replace("#define nh_phase6_" + name + "_value(", "#define " + name + "(")
        assert typed == original_macro
        assert original_macro.count("pronoun_gender(") <= 1
    assert not re.search(r"#define (?:uhes|He|His)\(", original_you)
    checks.append("nine opt-in pronoun macros unwrap to exact original fields/indices; visibility/no-it/Hallu/gender predicate and RNG counts unchanged; originals retained")

    bridge = artifacts["generated"]["nh-phase6-helper.c"]
    assert 'const char prefix[] = "{\\"id\\":\\"";' in bridge
    assert 'const char suffix[] = "\\",\\"args\\":{}}";' in bridge
    assert 'text_id' not in bridge
    for forbidden in ("rn2", "Hallucination", "program_state", "mon->", "ptr->",
                      "mons[", "gu.", "gy.", "xname(", "is_plural(", "highc(",
                      "nh_text_name_event(", "malloc(", "strcpy(", "flags.female",
                      "pronoun_gender(", "canspotmon(", ".adj", ".filecode", ".allow"):
        assert forbidden not in bridge, forbidden
    expected_calls = {"body_part": "part", "mbodypart": "mon, part",
                      "hcolor": "preference", "hliquid": "preference",
                      "locomotion": "ptr, def", "stagger": "ptr, def"}
    for native, arguments in expected_calls.items():
        assert len(re.findall(r"\b" + native + r"\s*\(", bridge)) == 1
        assert f"original = {native}({arguments});" in bridge
        wrapper = "nh_phase6_" + native + "_value"
        a, b = prepare["function_span"](bridge, wrapper)
        body = bridge[a:b]
        assert body.index("nh_phase6_open(") < body.index(f"original = {native}(") < body.index("nh_phase6_close(")
        assert "struct nh_phase6_helper_scope scope;" in body
    assert "char event_json[NH_PHASE6_HELPER_JSON]" in artifacts["generated"]["nh-phase6-helper.h"]
    assert "const char *event_json" not in artifacts["generated"]["nh-phase6-helper.h"]
    assert bridge.count("static struct nh_phase6_helper_scope *") == 1
    assert "nh_phase6_current_scope = s->parent" in bridge
    assert "s->observations = 2" in bridge and "s->valid = 0" in bridge
    assert "s->original == original" in bridge
    assert "memcmp(s->original_bytes, original, s->original_length + 1)" in bridge
    for field in ("he", "him", "his"):
        assert bridge.count("original = table[index]." + field + ";") == 1
    pronoun_ids = [item for item in catalog["entries"] if ".pronoun_" in item["id"]]
    assert len(pronoun_ids) == 12
    assert all(item["ja"] and item["descriptor_enabled"] for item in pronoun_ids)
    assert all(item["ja"].endswith("\u306e") for item in pronoun_ids if ".pronoun_possessive." in item["id"])
    assert all(not re.search(r"(?:male|female|neuter|group|row_\d)", item["id"]) for item in pronoun_ids)
    checks.append("six original native helper calls once; automatic expected-helper scope; owned inline descriptor; no RNG/state/name/pointer registry/heap")
    checks.append("12 pronoun role IDs read only original selected public fields once; possessive の distinct; no empty pronoun or hidden row/gender query")

    assert not any("new coke" in i["en"] for i in catalog["entries"])
    assert "nethack.helper.motion.swim" not in ids
    gill = [i for i in catalog["entries"] if i["id"] == "nethack.helper.body.gill"]
    assert len(gill) == 1 and not gill[0]["descriptor_enabled"]
    assert gill[0]["ja"] == gill[0]["en"] == "gill"
    assert sum(not i["descriptor_enabled"] for i in catalog["entries"]) == 1
    assert [d["producer"] for d in manifest["deferrals"]][:3] == ["otense/vtense", "s_suffix", "urole"]
    checks.append("commented table/literals excluded; ambiguous gill and unproven tense/possessive/role/default producers explicitly deferred")

    # Generated bytes are reproducible, and the --check path writes nothing.
    repeat = prepare["build"]()
    assert artifacts["generated"] == repeat["generated"]
    assert artifacts["diff"] == repeat["diff"]
    assert artifacts["catalog"] == repeat["catalog"]
    assert artifacts["manifest"] == repeat["manifest"]
    for relative, text in artifacts["generated"].items():
        emitted = PHASE / "generated" / relative
        if emitted.exists(): assert emitted.read_bytes() == text.encode("utf-8")
    for name, key in (("catalog.source-reviewed.json", "catalog"),
                       ("coverage.manifest.json", "manifest")):
        emitted = PHASE / name
        if emitted.exists(): assert json.loads(emitted.read_text(encoding="utf-8")) == artifacts[key]
    checks.append("two independent builds deterministic; existing generated artifacts match source-only proposal")
    report = {"status": "passed", "checks": checks, "catalog_ids": len(ids),
              "literal_records": record_count, "runtime_binding_approved": False,
              "compiler_run": False, "engine_run": False}
    if options.report:
        report["files"] = {
            str(path.relative_to(PHASE)).replace("\\", "/"):
                {"bytes": path.stat().st_size, "sha256": digest(path.read_bytes())}
            for path in sorted(PHASE.rglob("*"))
            if path.is_file() and path.name != "source-checks.results.json"
        }
        (PHASE / "source-checks.results.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "files"}, ensure_ascii=True))


if __name__ == "__main__": main()
