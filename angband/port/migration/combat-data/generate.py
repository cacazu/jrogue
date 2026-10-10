"""Pinned monster combat text extraction. Python stdlib, no game execution.

Only declared upstream text fields are read. Runtime complete English strings
are never searched. IDs coalesce equal visible lexical templates across private
source record aliases, including unseen spell variants.
"""
from pathlib import Path
import hashlib
import json
import re
import unicodedata
import argparse

HERE = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\angband\upstream\angband-4.2.6")
COMMIT = "f3082213b73f3e463e3d0d60bff4b00462beae6e"
PREFIX = "angband.combat."
CHECK_MODE = False

# Composition roles are tied to the original format/branch, never to a
# completed English message. Empty roles are intentional selected omissions.
GRAMMAR = {
 "reaction.message": ("{subject}{body}", "{subject}{body}", {"subject":"MonsterAggregateSubject","body":"localized_text"}, "src/mon-msg.c"),
 "reaction.damage": ("{subject}{body} ({damage})", "{subject}{body}（{damage}）", {"subject":"MonsterAggregateSubject","body":"localized_text","damage":"integer"}, "src/mon-msg.c"),
 "reaction.average": ("{subject}{body} (average {damage})", "{subject}{body}（平均{damage}）", {"subject":"MonsterAggregateSubject","body":"localized_text","damage":"integer"}, "src/mon-msg.c"),
 "subject.hidden.single": ("It", "それ", {}, "src/mon-msg.c"),
 "subject.hidden.multiple": ("{count} monsters", "{count}体のモンスター", {"count":"integer"}, "src/mon-msg.c"),
 "subject.visible.single": ("The {name}", "{name}", {"name":"localized_text"}, "src/mon-msg.c"),
 "subject.visible.multiple": ("{count}{counter} {name}", "{count}{counter}の{name}", {"count":"integer","counter":"localized_text","name":"localized_text"}, "src/mon-msg.c"),
 "subject.separator": (" ", "", {}, "src/mon-msg.c"),
 "target.player.object": ("you", "あなた", {}, "src/mon-spell.c"),
 "target.player.possessive": ("your", "あなたの", {}, "src/mon-blows.c"),
 "projection.of": (" of {type}", "{type}の", {"type":"localized_text"}, "src/mon-spell.c"),
 "none": ("", "", {}, "src/mon-spell.c"),
 "has.monster": ("has", "", {}, "src/mon-blows.c"),
 "has.player": ("have", "", {}, "src/mon-blows.c"),
 "stop.period": (".", "。", {}, "src/mon-blows.c"),
 "stop.none": ("", "", {}, "src/mon-blows.c"),
 "blow.message": ("{actor} {action}{stop}", "{actor}{action}{stop}", {"actor":"MonsterDescription","action":"localized_text","stop":"localized_text"}, "src/mon-blows.c"),
 "blow.damage": ("{actor} {action}{stop} ({damage})", "{actor}{action}{stop}（{damage}）", {"actor":"MonsterDescription","action":"localized_text","stop":"localized_text","damage":"integer"}, "src/mon-blows.c"),
}


def read(relative):
    data = (UPSTREAM / relative).read_bytes()
    return data.decode("utf-8"), {
        "file": relative, "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(), "upstream_commit": COMMIT,
    }


def write(name, value):
    content = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if CHECK_MODE:
        if not (HERE / name).exists() or (HERE / name).read_text(encoding="utf-8") != content:
            raise ValueError("generated source drift: " + name)
    else:
        (HERE / name).write_text(content, encoding="utf-8")


def header(aliases):
    def quoted(text): return "NULL" if text is None else json.dumps(text, ensure_ascii=True)
    lines = ["/* SPDX-License-Identifier: GPL-2.0-only */",
        "/* Generated from pristine Angband 4.2.6 " + COMMIT + ".",
        " * Canonical private source coordinates; never completed-text lookup. */",
        "#ifndef ANGBAND_WEB_COMBAT_DATA_H", "#define ANGBAND_WEB_COMBAT_DATA_H"]
    def table(name, declaration, records):
        lines.append("static const struct { " + declaration + " } " + name + "[] = {")
        lines.extend(" {" + ", ".join(record) + "}," for record in records)
        lines.append("};")
    table("ab_combat_repository_aliases", "int code; bool plural; const char *id;",
        [("MON_MSG_"+r["message_symbol"], "true" if r["plural"] else "false", quoted(r["id"]))
         for r in aliases if r["kind"] == "repository"])
    pain = {}
    for row in aliases:
        if row["kind"] == "pain": pain.setdefault((row["pain_index"], row["band"]), {})[row["plural"]] = row["id"]
    table("ab_combat_pain_aliases", "int index, band; const char *singular, *plural;",
        [(str(index),str(band),quoted(ids[False]),quoted(ids[True])) for (index,band),ids in sorted(pain.items())])
    fields = {"message-vis":0,"message-invis":1,"message-miss":2,"message-save":3,"lore":4}
    table("ab_combat_spell_aliases", "int index, power, field; const char *id;",
        [("RSF_"+r["spell_code"],str(r["power_cutoff"]),str(fields[r["field"]]),quoted(r["id"]))
         for r in aliases if r["kind"] == "spell_level"])
    alt = {"message-vis":"MON_ALTMSG_SEEN","message-invis":"MON_ALTMSG_UNSEEN","message-miss":"MON_ALTMSG_MISS"}
    table("ab_combat_alternate_aliases", "int race, index, kind; const char *id;",
        [(str(r["private_race_index"]),"RSF_"+r["spell_code"],alt[r["field"]],quoted(r["id"]))
         for r in aliases if r["kind"] == "alternate_spell"])
    table("ab_combat_projection_aliases", "int code; const char *id;",
        [("PROJ_"+r["projection_code"],quoted(r["id"])) for r in aliases if r["kind"] == "projection_lash"])
    table("ab_combat_blow_aliases", "const char *method; int source_ordinal; const char *id;",
        [(quoted(r["method_code"]),str(r["source_choice_ordinal"]),quoted(r["id"])) for r in aliases if r["kind"] == "blow_action"])
    table("ab_combat_blow_lore_aliases", "const char *method, *id;",
        [(quoted(r["method_code"]),quoted(r["id"])) for r in aliases if r["kind"] == "blow_lore"])
    lines.append("#endif")
    content = "\n".join(lines) + "\n"
    # The authoring copy supports source review; the compiled header lives in
    # logic so the standard C build-input fingerprint includes every byte.
    for path in (HERE / "web-combat-data.h", HERE.parent.parent / "logic" / "web-combat-data.h"):
        if CHECK_MODE:
            if not path.exists() or path.read_text(encoding="utf-8") != content: raise ValueError("generated combat header drift: " + str(path))
        else: path.write_text(content, encoding="utf-8")


def load(name):
    def pairs(items):
        out = {}
        for key, value in items:
            if key in out: raise ValueError("duplicate JSON key: " + key)
            out[key] = value
        return out
    return json.loads((HERE / name).read_text(encoding="utf-8"), object_pairs_hook=pairs)


def assemble(manifest, allow_pending=False):
    reactions = load("reaction-ja.json")["templates"]
    blow = load("blow-projection-ja.json")
    spell = load("spell-ja.json") if (HERE / "spell-ja.json").exists() else {}
    japanese, needed_reactions, expected_blow, expected_spell = {}, set(), set(), set()
    for key, entry in manifest["entries"].items():
        if entry["role"] == "reaction":
            source = entry["sources"][0]
            pattern = source.get("raw_template", source.get("value"))
            needed_reactions.add(pattern)
            translated = reactions.get(pattern)
            if isinstance(translated, dict): translated = translated[key.rsplit(".", 1)[1]]
        elif entry["role"] in ("blow_action", "blow_lore", "projection_lash"):
            expected_blow.add(key)
            translated = blow.get(key)
        elif entry["role"] == "grammar":
            translated = GRAMMAR[key.removeprefix(PREFIX+"grammar.")][1]
        else:
            expected_spell.add(key)
            translated = spell.get(key)
        if translated is None:
            if allow_pending: continue
            raise ValueError("unauthored Japanese ID: " + key)
        if not isinstance(translated, str) or (not translated and entry["role"] != "grammar"):
            raise ValueError("empty/nonstring Japanese template: " + key)
        referenced = set(re.findall(r"\{([a-z][a-z0-9_]*)\}", translated))
        if referenced != set(entry["parameters"]):
            raise ValueError("Japanese parameter-set mismatch: " + key)
        japanese[key] = translated
    if set(reactions) != needed_reactions:
        raise ValueError("reaction review extra/missing declared fields: " + str(set(reactions) ^ needed_reactions))
    if set(blow) != expected_blow:
        raise ValueError("blow/projection extra/missing IDs: " + str(set(blow) ^ expected_blow))
    if set(spell) - expected_spell:
        raise ValueError("spell review extra IDs: " + str(set(spell) - expected_spell))
    schema = {"schema_version": 1, "upstream_commit": COMMIT,
        "complete_game_translation": False, "catalog_entries": len(manifest["entries"]),
        "entries": {key: {"parameters": [{"name": name, "type": kind} for name, kind in entry["parameters"].items()],
            "sources": entry["sources"], "role": entry["role"]} for key, entry in manifest["entries"].items()}}
    write("schema.json", schema)
    write("ja.partial.json" if allow_pending and len(japanese) != len(manifest["entries"]) else "ja.json", japanese)
    return {"authored_japanese": len(japanese), "required": len(manifest["entries"]),
            "pending": len(manifest["entries"]) - len(japanese)}


def directives(relative):
    text, source = read(relative)
    rows = []
    for line, raw in enumerate(text.splitlines(), 1):
        if not raw or raw.startswith("#") or ":" not in raw:
            continue
        field, value = raw.split(":", 1)
        rows.append({"file": relative, "line": line, "field": field, "value": value})
    return rows, source


def slug(text):
    text = re.sub(r"\{[A-Za-z]+\}", "", text)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return text[:90] or "empty"


def bracket_expand(text, plural):
    out, state = [], 0
    for c in text:
        if state == 0 and c == "[": state = 1
        elif state == 1 and c == "|": state = 2
        elif state != 0 and c == "]": state = 0
        elif state == 0 or (state == 1 and not plural) or (state == 2 and plural): out.append(c)
    if state != 0:
        raise ValueError("unclosed source plural form: " + text)
    return "".join(out)


def normalize_tags(text, family):
    supported = {"spell": {"name", "pronoun", "target", "type", "oftype"},
                 "blow_action": {"target", "oftarget", "has"}}[family]
    counts, parameters, occurrences = {}, {}, []
    def tag(match):
        name = match.group(1)
        if name not in supported:
            raise ValueError("unknown upstream tag: " + name)
        index = counts.get(name, 0)
        counts[name] = index + 1
        parameter = name + "_" + str(index)
        parameters[parameter] = "MonsterDescription" if name in ("name", "pronoun") else "localized_text"
        following = text[match.end():match.end()+1]
        # C determines COMMA from the source punctuation before rendering, not
        # from localized templates. Empty following text is punctuation in C:
        # strchr(punct, '\0') returns the terminator.
        comma = bool(following) and following not in ".!?;:,'"
        occurrences.append({"parameter": parameter, "tag": name,
                            "source_byte_offset": len(text[:match.start()].encode("utf-8")),
                            "leading": match.start() == 0, "source_following": following,
                            "comma": comma})
        return "{" + parameter + "}"
    normalized = re.sub(r"\{([A-Za-z]+)\}", tag, text)
    if "{" in re.sub(r"\{[A-Za-z0-9_]+\}", "", normalized):
        raise ValueError("invalid upstream brace spelling: " + text)
    return normalized, parameters, occurrences


def main():
    global CHECK_MODE
    parser = argparse.ArgumentParser()
    parser.add_argument("--assemble", action="store_true")
    parser.add_argument("--allow-pending", action="store_true")
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    CHECK_MODE = arguments.check
    entries, aliases, sources, keys = {}, [], [], {}
    def add(family, raw, source_rows, private_alias, form=None):
        if raw == "":
            aliases.append({**private_alias, "id": None, "suppressed": True, "sources": source_rows})
            return
        if family in ("spell", "blow_action"):
            render, params, occurrences = normalize_tags(raw, family)
        else:
            render, params, occurrences = raw, {}, []
        identity = (family, raw, form)
        if identity not in keys:
            stem = PREFIX + family + "." + slug(raw)
            if form: stem += "." + form
            key = stem
            if key in entries:
                key += "_" + hashlib.sha256(raw.encode()).hexdigest()[:10]
            keys[identity] = key
            entries[key] = {"source_english": raw, "render_en": render,
                            "parameters": params, "occurrences": occurrences,
                            "role": family, "sources": []}
        key = keys[identity]
        entries[key]["sources"].extend(source_rows)
        aliases.append({**private_alias, "id": key, "sources": source_rows})

    message_text, source = read("src/list-mon-message.h")
    sources.append(source)
    repository_count = 0
    for line, raw in enumerate(message_text.splitlines(), 1):
        match = re.match(r'MON_MSG\(\s*([A-Z0-9_]+)\s*,\s*([A-Z0-9_]+)\s*,\s*(true|false)\s*,\s*("(?:[^"\\]|\\.)*")\s*\)', raw)
        if not match: continue
        symbol, msg_type, omit, encoded = match.groups()
        body = json.loads(encoded)
        if symbol == "MAX" or body == "": continue
        repository_count += 1
        for plural in (False, True):
            add("reaction", bracket_expand(body, plural), [{"file": "src/list-mon-message.h", "line": line, "raw_template": body}],
                {"kind": "repository", "message_symbol": symbol, "plural": plural,
                 "omit_subject": omit == "true", "message_type": msg_type}, "plural" if plural else "singular")

    rows, source = directives("lib/gamedata/pain.txt")
    sources.append(source)
    pain_type, band, pain_count = None, 0, 0
    for row in rows:
        if row["field"] == "type": pain_type, band = int(row["value"]), 0
        elif row["field"] == "message":
            if band >= 7: raise ValueError("too many pain bands")
            pain_count += 1
            for plural in (False, True):
                add("reaction", bracket_expand(row["value"], plural), [row],
                    {"kind": "pain", "pain_index": pain_type, "band": band, "plural": plural}, "plural" if plural else "singular")
            band += 1

    rows, source = directives("lib/gamedata/monster_spell.txt")
    sources.append(source)
    spell, cutoff, level_rows = None, 0, {}
    for row in rows:
        field = row["field"]
        if field == "name": spell, cutoff = row["value"], 0
        elif field == "power-cutoff": cutoff = int(row["value"])
        elif field in ("message-vis", "message-invis", "message-miss", "message-save", "lore"):
            level_rows.setdefault((spell, cutoff, field), []).append(row)
    for (spell, cutoff, field), record_rows in level_rows.items():
        family = "spell" if field in ("message-vis", "message-invis", "message-miss") else "spell_save" if field == "message-save" else "spell_lore"
        add(family, "".join(row["value"] for row in record_rows), record_rows,
            {"kind": "spell_level", "spell_code": spell, "power_cutoff": cutoff, "field": field})

    rows, source = directives("lib/gamedata/monster.txt")
    sources.append(source)
    race, race_index = None, -1
    alternate_count = 0
    for row in rows:
        if row["field"] == "name": race, race_index = row["value"], race_index + 1
        elif row["field"] in ("message-vis", "message-invis", "message-miss"):
            spell, raw = (row["value"].split(":", 1) + [""])[:2]
            alternate_count += 1
            add("spell", raw, [row], {"kind": "alternate_spell", "private_race_index": race_index,
                "private_race_name": race, "spell_code": spell, "field": row["field"]})

    rows, source = directives("lib/gamedata/blow_methods.txt")
    sources.append(source)
    method, choice = None, 0
    method_count, action_count = 0, 0
    for row in rows:
        if row["field"] == "name": method, choice = row["value"], 0; method_count += 1
        elif row["field"] == "act":
            action_count += 1
            add("blow_action", row["value"], [row], {"kind": "blow_action", "method_code": method,
                "source_choice_ordinal": choice, "parser_order": "reverse_source_choice_order"})
            choice += 1
        elif row["field"] == "desc": add("blow_lore", row["value"], [row], {"kind": "blow_lore", "method_code": method})

    rows, source = directives("lib/gamedata/projection.txt")
    sources.append(source)
    projection, projection_count = None, 0
    for row in rows:
        if row["field"] == "code": projection = row["value"]
        elif row["field"] == "lash-desc":
            projection_count += 1
            add("projection_lash", row["value"], [row], {"kind": "projection_lash", "projection_code": projection})

    for relative in ("src/mon-msg.c", "src/mon-spell.c", "src/mon-blows.c", "src/mon-init.c"):
        _, source = read(relative); sources.append(source)
    for role, (english, japanese, parameters, relative) in GRAMMAR.items():
        key = PREFIX + "grammar." + role
        entries[key] = {"source_english": english, "render_en": english,
            "parameters": parameters, "occurrences": [], "role": "grammar",
            "sources": [{"file": relative, "field": "selected composition branch"}],
            "intentional_empty": english == "" or japanese == ""}
    manifest = {"schema_version": 1, "upstream_commit": COMMIT,
        "complete_game_translation": False, "scope": "Pinned monster reaction/spell/blow declared text fields",
        "identity_policy": "Shared visible lexical template + role; private aliases are not runtime event metadata",
        "sources": sources, "counts": {"repository_bodies": repository_count, "pain_rows": pain_count,
            "spells": len({r["spell_code"] for r in aliases if r["kind"] == "spell_level"}),
            "spell_power_levels": len({(r["spell_code"], r["power_cutoff"]) for r in aliases if r["kind"] == "spell_level"}),
            "spell_text_fields": sum(r["kind"] == "spell_level" for r in aliases),
            "alternate_spell_rows": alternate_count, "blow_methods": method_count, "blow_action_rows": action_count,
            "projection_lash_rows": projection_count, "catalog_entries": len(entries)},
        "entries": dict(sorted(entries.items())), "private_source_aliases": aliases}
    write("source-manifest.json", manifest)
    write("en.json", {key: entry["render_en"] for key, entry in sorted(entries.items())})
    header(aliases)
    print(json.dumps(manifest["counts"]))
    if arguments.assemble:
        print(json.dumps(assemble(manifest, arguments.allow_pending)))


if __name__ == "__main__": main()
