"""Generate bounded reviewed realm/spell catalogs from the pinned original.

No compiler, engine execution, network, RNG or source-code mutation.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\angband\upstream\angband-4.2.6")
COMMIT = "f3082213b73f3e463e3d0d60bff4b00462beae6e"
SOURCE_INDICES = {29, 30, 178, 179, 180, 181, 182, 183, 189}

def emit_json(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

def generate():
    census = json.loads((ROOT / "migration/residual-message-review.json").read_text(encoding="utf-8"))
    group = next(value for value in census["groups"] if value["role"] == "realm_spell_knowledge")
    sites = group["callsites"]
    assert {site["source_index"] for site in sites} == SOURCE_INDICES and len(sites) == 9
    realm_path = UPSTREAM / "lib/gamedata/realm.txt"
    realm_bytes = realm_path.read_bytes()
    realm_lines = realm_bytes.decode("utf-8").splitlines()
    records = []
    for line, text in enumerate(realm_lines, 1):
        if text.startswith("name:"):
            records.append({"name": text[5:], "name_line": line})
        elif records and text.startswith(("verb:", "spell-noun:")):
            field, value = text.split(":", 1)
            records[-1][field] = value
            records[-1][field + "_line"] = line
    assert [r["name"] for r in records] == ["arcane", "divine", "nature", "shadow"]
    authored = {
        "arcane": ("spell", "cast", "呪文", "唱える"),
        "divine": ("prayer", "recite", "祈祷", "捧げる"),
        "nature": ("verse", "chant", "詠唱", "行う"),
        "shadow": ("ritual", "perform", "儀式", "執り行う"),
    }
    en, ja, entries = {}, {}, {}
    for record in records:
        code = record["name"]
        noun, verb, noun_ja, verb_ja = authored[code]
        assert record["spell-noun"] == noun and record["verb"] == verb
        for suffix, english, japanese, source_field in [
            ("spell_noun_singular", noun, noun_ja, "spell-noun"),
            ("spell_noun_plural", noun + "s", noun_ja, "spell-noun"),
            ("verb", verb, verb_ja, "verb"),
        ]:
            identity = f"magic.realm.{code}.{suffix}"
            en[identity], ja[identity] = english, japanese
            entries[identity] = {
                "parameters": [], "role": "realm_selected_lexeme",
                "sources": [{"file": "lib/gamedata/realm.txt", "line": record[source_field + "_line"],
                             "field": source_field, "value": record[source_field]}],
                "identity": {"realm_parser_key": code, "form": suffix},
            }
    templates = [
        ("realm.message.cast.insufficient_mana", "You do not have enough mana to {verb} this {noun}.",
         "この{noun}を{verb}には、マナが足りない。", [("verb", "localized_text"), ("noun", "localized_text")], [29]),
        ("realm.message.study.book_no_learnable_spells", "You cannot learn any {noun} in that book.",
         "その本からは{noun}を習得できない。", [("noun", "localized_text")], [30]),
        ("realm.message.spell.forgotten", "You have forgotten the {noun} of {spell}.",
         "{noun}「{spell}」を忘れてしまった。", [("noun", "localized_text"), ("spell", "localized_text")], [178, 179]),
        ("realm.message.spell.remembered", "You have remembered the {noun} of {spell}.",
         "{noun}「{spell}」を思い出した。", [("noun", "localized_text"), ("spell", "localized_text")], [180]),
        ("realm.message.spell.learned", "You have learned the {noun} of {spell}.",
         "{noun}「{spell}」を習得した。", [("noun", "localized_text"), ("spell", "localized_text")], [182]),
        ("realm.message.study.more_realms", "You can learn {count} more {realms}.",
         "あと{count}種類の{realms}を習得できる。", [("count", "integer"), ("realms", "localized_text_list")], [181]),
        ("realm.message.study.more_single_realm", "You can learn {count} more {noun}.",
         "あと{count}種類の{noun}を習得できる。", [("count", "integer"), ("noun", "localized_text")], [183]),
        ("realm.message.study.none_remaining", "You cannot learn any new {realms}!",
         "これ以上、新たな{realms}を習得できない！", [("realms", "localized_text_list")], [189]),
    ]
    files = {"lib/gamedata/realm.txt": hashlib.sha256(realm_bytes).hexdigest()}
    source_files = {}
    for site in sites:
        relative = "src/" + Path(site["source"]["file"]).name
        if relative not in source_files:
            raw = (UPSTREAM / relative).read_bytes()
            source_files[relative] = raw.decode("utf-8")
            files[relative] = hashlib.sha256(raw).hexdigest()
        # Pin each census source literal to the actual original source region.
        source = source_files[relative]
        line = site["source"]["upstream_line"]
        region = "\n".join(source.splitlines()[max(0, line - 4):line + 4])
        assert json.dumps(site["original_english"], ensure_ascii=False) in region, (relative, line)
    for identity, english, japanese, params, indices in templates:
        en[identity], ja[identity] = english, japanese
        sources = []
        for index in indices:
            site = next(site for site in sites if site["source_index"] == index)
            sources.append({"file": "src/" + Path(site["source"]["file"]).name,
                            "line": site["source"]["upstream_line"],
                            "function": site["source"]["function"], "source_index": index,
                            "original_english": site["original_english"]})
        entries[identity] = {"parameters": [{"name": name, "type": kind} for name, kind in params],
                             "sources": sources, "role": "realm_spell_message"}
        expected = {name for name, _ in params}
        assert set(re.findall(r"\{(\w+)\}", english)) == expected
        assert set(re.findall(r"\{(\w+)\}", japanese)) == expected
    schema = {"schema_version": 1, "upstream_commit": COMMIT, "complete_game_translation": False,
              "catalog_entries": len(entries), "entries": dict(sorted(entries.items()))}
    manifest = {"schema_version": 1, "upstream_commit": COMMIT, "catalog_entries": len(entries),
                "reviewed_source_indices": sorted(SOURCE_INDICES), "inputs": files,
                "realm_source_order": [r["name"] for r in records],
                "realm_runtime_prepend_order": [r["name"] for r in reversed(records)],
                "native_code_field_initialized": False,
                "capture": {"list_source": "original class_magic_realms result, before first free",
                            "singular_plural": "original PLURAL(count) or explicit count>1 branch",
                            "noun_plural": "reviewed endpoint, no runtime English suffix parsing",
                            "conjunction": "original ordered disjunction, EN no Oxford comma",
                            "spell_identity": "original selected class_spell cidx/bidx/sidx, no repeated lookup"}}
    return {"en.json": dict(sorted(en.items())), "ja.json": dict(sorted(ja.items())),
            "schema.json": schema, "source-manifest.json": manifest}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = generate()
    for name, value in outputs.items():
        expected = emit_json(value)
        path = OUT / name
        if args.check:
            assert path.read_bytes() == expected, f"stale catalog: {name}"
        else:
            path.write_bytes(expected)
    print(f"realm catalogs {'checked' if args.check else 'generated'}: 20 bilingual IDs; 9 source producers")

if __name__ == "__main__":
    main()
