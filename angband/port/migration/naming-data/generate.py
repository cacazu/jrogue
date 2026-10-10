"""Pinned naming data extraction. Python stdlib only; no Angband execution."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import unicodedata

HERE = Path(__file__).resolve().parent
PORT = HERE.parents[1]
PREFIX = "angband.naming."


def load(name):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError(f"duplicate key {key}: {name}")
            result[key] = value
        return result
    return json.loads((HERE / name).read_text("utf-8"), object_pairs_hook=pairs)


def write(name, data):
    (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", "utf-8")


def slug(value):
    value = value.replace("*", " star ")
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = value.replace("'", "")
    value = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    assert value
    return value


def rows(filename):
    result = []
    for line, raw in enumerate((PORT / filename).read_text("utf-8").splitlines(), 1):
        if not raw or raw.startswith("#") or ":" not in raw:
            continue
        directive, value = raw.split(":", 1)
        result.append({"file": filename, "line": line, "directive": directive,
                       "raw_line": raw, "value": value})
    return result


def records(filename):
    result = []
    for row in rows(filename):
        if row["directive"] == "name":
            result.append({"source_ordinal": len(result), "name": row["value"],
                           "header": row, "fields": {}})
        elif result:
            result[-1]["fields"].setdefault(row["directive"], []).append(row)
    return result


def values(record, directive):
    return [row["value"] for row in record["fields"].get(directive, [])]


def one(record, directive, default=None):
    found = values(record, directive)
    assert len(found) <= 1, (record["name"], directive)
    return found[0] if found else default


def english_ast(raw):
    """The exact selected source grammar, never a completed description."""
    result = []
    i = 0
    while i < len(raw):
        start = i
        if raw[i] == "&":
            while i < len(raw) and raw[i] in "& ":
                i += 1
            result.append({"kind": "article_marker", "raw": raw[start:i], "offset": start})
        elif raw[i] == "~":
            result.append({"kind": "plural_suffix", "singular": "",
                           "plural": "es" if raw[i - 1] in "shx" else "s",
                           "raw": "~", "offset": i})
            i += 1
        elif raw[i] == "|":
            middle = raw.index("|", i + 1)
            end = raw.index("|", middle + 1)
            result.append({"kind": "plural_alternative", "singular": raw[i + 1:middle],
                           "plural": raw[middle + 1:end], "raw": raw[i:end + 1], "offset": i})
            i = end + 1
        elif raw[i] == "#":
            result.append({"kind": "modifier", "parameter": "modifier", "raw": "#", "offset": i})
            i += 1
        else:
            while i < len(raw) and raw[i] not in "&~|#":
                i += 1
            result.append({"kind": "literal", "text": raw[start:i], "raw": raw[start:i], "offset": start})
    assert "".join(part["raw"] for part in result) == raw
    return result


def english_singular(raw):
    out = []
    for part in english_ast(raw):
        if part["kind"] == "literal":
            out.append(part["text"])
        elif part["kind"] == "plural_alternative":
            out.append(part["singular"])
        elif part["kind"] == "modifier":
            out.append("#")
    return "".join(out)


def source_inventory():
    pinned = load("pinned-sources.json")
    for source in pinned["sources"]:
        content = (PORT / source["file"]).read_bytes()
        assert hashlib.sha256(content).hexdigest() == source["sha256"], source["file"]
    tval_text = (HERE / "producer-snapshots/list-tvals.h").read_text("utf-8")
    tvals = [{"tval": index, "code": code, "lookup": lookup, "key": slug(lookup)}
             for index, (code, lookup) in enumerate(re.findall(r'TV\((\w+), "([^"]+)"\)', tval_text))]
    def tval(value):
        normalized = value.lower().replace("armour", "armor")
        found = [t for t in tvals if t["lookup"] == normalized]
        assert len(found) == 1, value
        return found[0]
    bases = records("data/gamedata/monster_base.txt")
    base_by_name = {base["name"]: base for base in bases}
    races = records("data/gamedata/monster.txt")
    for race in races:
        race["ridx"] = race["source_ordinal"]
        race["key"] = slug(race["name"])
        race["base"] = one(race, "base")
        inherited = values(base_by_name[race["base"]], "flags")
        flags = {f.strip() for value in inherited + values(race, "flags") for f in value.split("|")}
        flags.difference_update(f.strip() for value in values(race, "flags-off") for f in value.split("|"))
        race["naming_flags"] = sorted(flags & {"UNIQUE", "NAME_COMMA", "MALE", "FEMALE"})
    assert len({r["key"] for r in races}) == len(races)
    for base in bases:
        base["key"] = slug(base["name"])
    kinds = records("data/gamedata/object.txt")
    sval_counts = Counter()
    for kind in kinds:
        kind["kidx"] = kind["source_ordinal"]
        kind["type"] = tval(one(kind, "type"))
        kind["key"] = slug(english_singular(kind["name"]))
        sval_counts[kind["type"]["tval"]] += 1
        kind["sval"] = sval_counts[kind["type"]["tval"]]
        kind["origin"] = "object_file"
    # finish_parse_object reserves one unnamed slot before parser-generated kinds.
    reserved_kidx = len(kinds)
    next_kidx = reserved_kidx + 1
    books = []
    seen_book = {}
    for cls in records("data/gamedata/class.txt"):
        for bidx, row in enumerate(cls["fields"].get("book", [])):
            type_name, quality, title, capacity, realm = row["value"].split(":")
            if title not in seen_book:
                kind = {"name": title, "header": row, "fields": {}, "kidx": next_kidx,
                        "type": tval(type_name), "key": slug(title), "origin": "class_book"}
                sval_counts[kind["type"]["tval"]] += 1
                kind["sval"] = sval_counts[kind["type"]["tval"]]
                next_kidx += 1
                kinds.append(kind)
                seen_book[title] = kind
            books.append({"cidx": cls["source_ordinal"], "bidx": bidx,
                          "class_key": slug(cls["name"]), "realm": realm, "source": row,
                          "kidx": seen_book[title]["kidx"], "name": title,
                          "character_id": f"angband.player_class.{slug(cls['name'])}.book.{slug(title)}.name"})
    artifacts = records("data/gamedata/artifact.txt")
    for art in artifacts:
        art["aidx"] = art["source_ordinal"] + 1
        art["key"] = slug(art["name"])
        type_name, base_name = one(art, "base-object").split(":", 1)
        art["type"] = tval(type_name)
        art["base_name"] = base_name
        matches = [kind for kind in kinds if kind["type"]["tval"] == art["type"]["tval"] and
                   english_singular(kind["name"]).lower() == base_name.lower()]
        assert len(matches) <= 1
        if not matches:
            source = art["fields"]["base-object"][0]
            kind = {"name": f"& {base_name}~", "header": source, "fields": {}, "kidx": next_kidx,
                    "type": art["type"], "key": slug(base_name), "origin": "artifact_dummy",
                    "source_base_name": base_name, "generated_by": "write_dummy_object_record"}
            sval_counts[kind["type"]["tval"]] += 1
            kind["sval"] = sval_counts[kind["type"]["tval"]]
            next_kidx += 1
            kinds.append(kind)
            matches = [kind]
        art["base_kidx"] = matches[0]["kidx"]
        art["sval"] = matches[0]["sval"]
    # Exact names can repeat for egos with different item groups. Canonical eidx
    # is a frozen accepted source identity, not a rendered-string match.
    egos = records("data/gamedata/ego_item.txt")
    for ego in egos:
        ego["eidx"] = ego["source_ordinal"]
        ego["key"] = slug(ego["name"])
    object_bases = []
    for row in rows("data/gamedata/object_base.txt"):
        if row["directive"] != "name":
            continue
        fields = row["value"].split(":", 1)
        object_bases.append({"type": tval(fields[0]), "name": fields[1] if len(fields) == 2 else None,
                             "source": row})
    flavors = []
    current_type = None
    for row in rows("data/gamedata/flavor.txt"):
        if row["directive"] == "kind":
            current_type = tval(row["value"].split(":", 1)[0])
        elif row["directive"] in {"flavor", "fixed"}:
            fixed = row["directive"] == "fixed"
            fields = row["value"].split(":", 3 if fixed else 2)
            flavor = {"fidx": int(fields[0]), "type": current_type, "fixed": fixed,
                      "color": fields[2 if fixed else 1], "name": fields[3 if fixed else 2] if len(fields) > (3 if fixed else 2) else None,
                      "source": row}
            if fixed:
                matching = [kind for kind in kinds if kind["type"]["tval"] == current_type["tval"] and english_singular(kind["name"]).lower() == fields[1].lower()]
                assert len(matching) == 1, fields[1]
                flavor["fixed_sval"] = matching[0]["sval"]
                flavor["fixed_kind_key"] = fields[1]
            flavors.append(flavor)
    assert len(races) == 624 and len(bases) == 56
    assert len(egos) == 107 and len(artifacts) == 138
    assert len(flavors) == 302 and len(object_bases) == 34
    assert len({k["kidx"] for k in kinds}) == len(kinds)
    identities = Counter((k["type"]["key"], k["key"]) for k in kinds)
    assert len(identities) == len(kinds), [k for k in kinds if identities[(k["type"]["key"], k["key"])] > 1]
    return {"schema_version": 1, "upstream_commit": pinned["upstream_commit"],
            "sources": pinned["sources"], "tvals": tvals, "monster_races": races,
            "monster_bases": bases, "object_kinds": kinds, "object_bases": object_bases,
            "flavors": flavors, "artifacts": artifacts, "egos": egos,
            "class_book_associations": books, "reserved_unnamed_object_kidx": reserved_kidx,
            "realms": records("data/gamedata/realm.txt"),
            "chest_traps": records("data/gamedata/chest_trap.txt")}


def object_counter(type_key, name):
    counters = {"sword": "hon", "hafted": "hon", "polearm": "hon", "digger": "hon",
                "staff": "hon", "wand": "hon", "rod": "hon", "arrow": "hon", "bolt": "hon",
                "boots": "soku", "gloves": "sou", "shield": "mai", "scroll": "kan", "potion": "fuku",
                "soft_armor": "ryou", "hard_armor": "ryou", "dragon_armor": "ryou", "cloak": "chaku",
                "magic_book": "satsu", "prayer_book": "satsu", "nature_book": "satsu", "shadow_book": "satsu", "other_book": "satsu"}
    if type_key == "bow":
        return "tei" if "Crossbow" in name else "chou" if "Bow" in name else "ko"
    if type_key == "light" and "Torch" in name:
        return "hon"
    return counters.get(type_key, "ko")


def bindings(inventory):
    result = {"schema_version": 1, "upstream_commit": inventory["upstream_commit"],
              "lookup_policy": "Canonical pinned record identity, optionally verify exact raw source lexeme; no completed-description lookup",
              "generated_policy": {"scroll_title": "owned origin=generated_scroll_title display_token; unchanged random seed/order",
                                   "randart": "Fixed aidx only valid after exact raw artifact source name verification; otherwise owned origin=runtime_artifact_name proper lexeme",
                                   "external_name": "Verbatim owned opaque name/inscription; never translated"},
              "reserved_unnamed_object_kidx": inventory["reserved_unnamed_object_kidx"],
              "monster_races": [], "monster_bases": [], "object_kinds": [], "object_bases": [],
              "flavors": [], "artifacts": [], "egos": [], "chest_traps": [], "realm_naming": [],
              "class_book_associations": inventory["class_book_associations"]}
    for race in inventory["monster_races"]:
        base = PREFIX + f"monster.race.{race['key']}"
        comma = race["name"].find(",")
        stem = "NAME_COMMA" in race["naming_flags"] and 0 <= comma < 1024
        plural = one(race, "plural")
        counter = "nin" if race["base"] in {"person", "townsfolk", "humanoid", "player"} else "hiki" if race["base"] in {"ant", "bat", "bird", "canine", "centipede", "dragon fly", "feline", "insect", "killer beetle", "quadruped", "reptile", "rodent", "snake", "spider", "zephyr hound"} else "ko" if race["base"] in {"worm", "mold", "mushroom", "creeping coins"} else "tai"
        result["monster_races"].append({"ridx": race["ridx"], "raw_english": race["name"], "name_id": base + ".name",
            "counter_id": PREFIX + "grammar.counter." + counter,
            "plural_id": base + ".plural" if plural is not None else None, "raw_plural": plural,
            "regular_plural_rule": "append_es_if_trailing_s_else_s", "japanese_plural_rule": "same_noun_count_separate",
            "possessive_name_id": PREFIX + f"monster.race.{slug(race['name'][:comma])}.possessive_name" if stem else base + ".name",
            "raw_possessive_name": race["name"][:comma] if stem else race["name"],
            "naming_flags": race["naming_flags"], "base_key": race["base"]})
    for base in inventory["monster_bases"]:
        result["monster_bases"].append({"parser_key": base["name"], "name_id": PREFIX + f"monster.base.{base['key']}.name",
            "description_id": PREFIX + f"monster.base.{base['key']}.description", "raw_english": base["name"],
            "raw_description": "".join(values(base, "desc"))})
    for kind in inventory["object_kinds"]:
        result["object_kinds"].append({"kidx": kind["kidx"], "tval": kind["type"]["tval"], "tval_key": kind["type"]["key"],
            "sval": kind["sval"], "origin": kind["origin"], "raw_english": kind["name"],
            "name_id": PREFIX + f"object.kind.{kind['key']}.name",
            "counter_id": PREFIX + "grammar.counter." + object_counter(kind["type"]["key"], kind["name"])})
    for base in inventory["object_bases"]:
        result["object_bases"].append({"tval": base["type"]["tval"], "tval_key": base["type"]["key"], "raw_english": base["name"],
            "name_id": PREFIX + f"object.base.{base['type']['key']}.name" if base["name"] is not None else None,
            "counter_id": PREFIX + "grammar.counter." + object_counter(base["type"]["key"], "")})
    for flavor in inventory["flavors"]:
        base = PREFIX + f"object.flavor.{slug(flavor['name'])}" if flavor["name"] is not None else None
        result["flavors"].append({"fidx": flavor["fidx"], "tval": flavor["type"]["tval"], "tval_key": flavor["type"]["key"],
            "fixed": flavor["fixed"], "fixed_sval": flavor.get("fixed_sval"), "raw_english": flavor["name"],
            "name_id": base + ".name" if flavor["name"] is not None else None,
            "modifier_id": base + ".modifier" if flavor["name"] is not None else None,
            "origin": "authored_flavor" if flavor["name"] is not None else "generated_scroll_title"})
    for art in inventory["artifacts"]:
        result["artifacts"].append({"aidx": art["aidx"], "raw_english": art["name"], "base_kidx": art["base_kidx"],
            "tval": art["type"]["tval"], "sval": art["sval"], "name_id": PREFIX + f"artifact.{art['key']}.name",
            "attachment": "of" if art["name"].startswith("of ") else "quoted" if art["name"].startswith("'") else "literal"})
    for ego in inventory["egos"]:
        base = PREFIX + f"ego.{ego['key']}"
        result["egos"].append({"eidx": ego["eidx"], "raw_english": ego["name"], "name_id": base + ".name",
                               "modifier_id": base + ".modifier", "attachment": "prefix_modifier"})
    for trap in inventory["chest_traps"]:
        result["chest_traps"].append({"code": one(trap, "code"), "raw_english": trap["name"],
                                     "name_id": PREFIX + f"object.chest_trap.{slug(trap['name'])}.name"})
    for realm in inventory["realms"]:
        result["realm_naming"].append({"parser_key": realm["name"], "fields": {
            field: {"raw_english": one(realm, field),
                    "id": PREFIX + f"realm.{slug(realm['name'])}.{field.replace('-', '_')}"}
            for field in ["verb", "spell-noun", "book-noun"]}})
    return result


def grammar_inventory():
    """Load authored source-backed grammar without executing game code."""
    import sys
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("naming_grammar", HERE / "grammar-input.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.catalog()


def full_catalog(inventory, mapping, grammar):
    monster_ja = load("monster-ja.json")["races"]
    object_ja = load("object-ja.json")["kinds"]
    flavor_ja = load("flavor-ja.json")["flavors"]
    artifact_ja = load("artifact-ja.json")["artifacts"]
    ego_ja = load("ego-ja.json")["egos"]
    base_ja = load("base-ja.json")
    assert set(monster_ja) == {str(r["ridx"]) for r in inventory["monster_races"]}
    assert set(object_ja) == {str(k["kidx"]) for k in inventory["object_kinds"]}
    assert set(artifact_ja) == {str(a["aidx"]) for a in inventory["artifacts"]}
    assert set(flavor_ja) == {f["name"] for f in inventory["flavors"] if f["name"] is not None}
    assert set(ego_ja) == {e["name"] for e in inventory["egos"]}
    assert set(base_ja["monster_bases"]) == {b["name"] for b in inventory["monster_bases"]}
    assert set(base_ja["object_bases"]) == {b["type"]["key"] for b in inventory["object_bases"] if b["name"] is not None}
    assert set(base_ja["realms"]) == {r["name"] for r in inventory["realms"]}
    assert set(base_ja["chest_traps"]) == {c["name"] for c in inventory["chest_traps"]}
    entries = {}

    def source(row, identity, extraction="exact directive value", selected_value=None):
        result = dict(row)
        result["identity"] = identity
        result["extraction"] = extraction
        result["exact_selected_english"] = row["value"] if selected_value is None else selected_value
        return result

    def add(id_, en, ja, role, sources, parameters=None, note="", **metadata):
        assert isinstance(en, str) and isinstance(ja, str), id_
        parameters = parameters or {}
        if id_ in entries:
            old = entries[id_]
            assert (old["english"], old["japanese"], old["parameters"], old["role"]) == (en, ja, parameters, role), (id_, en, ja, old)
            old["sources"].extend(s for s in sources if s not in old["sources"])
            return
        entries[id_] = {"id": id_, "english": en, "japanese": ja, "parameters": parameters,
                        "role": role, "sources": sources, "note": note, **metadata}

    for race, binding in zip(inventory["monster_races"], mapping["monster_races"]):
        ja = monster_ja[str(race["ridx"])]
        assert ja["english"] == race["name"]
        identity = {"domain": "monster_race", "ridx": race["ridx"], "parser_base": race["base"], "field": "name"}
        add(binding["name_id"], race["name"], ja["name"], "monster_race_name",
            [source(race["header"], identity)], counter_id=binding["counter_id"],
            unique="UNIQUE" in race["naming_flags"], naming_flags=race["naming_flags"],
            note="Authored Japanese noun; proper names transcribed. Native knowledge/visibility decides whether this lexeme is selected.")
        if binding["plural_id"]:
            row = race["fields"]["plural"][0]
            add(binding["plural_id"], row["value"], ja["plural"], "monster_race_explicit_plural",
                [source(row, {**identity, "field": "plural"})], counter_id=binding["counter_id"],
                note="Explicit native plural; Japanese uses the same noun with the separately selected count/counter.")
        else:
            assert "plural" not in ja
        if binding["possessive_name_id"] != binding["name_id"]:
            assert "possessive_name" in ja
            add(binding["possessive_name_id"], binding["raw_possessive_name"], ja["possessive_name"], "monster_race_possessive_stem",
                [source(race["header"], {**identity, "field": "name_possessive_stem"},
                        "source substring before first comma; only RF_NAME_COMMA and comma offset < 1024", binding["raw_possessive_name"])],
                counter_id=binding["counter_id"], source_span={"start": 0, "end": race["name"].index(",")},
                note="Derived from the original successful comma-stripping producer branch, not a translated completed description.")
        else:
            assert "possessive_name" not in ja
    for base, binding in zip(inventory["monster_bases"], mapping["monster_bases"]):
        identity = {"domain": "monster_base", "parser_key": base["name"]}
        ja = base_ja["monster_bases"][base["name"]]
        add(binding["name_id"], base["name"], ja["name"], "monster_base_display_name",
            [source(base["header"], {**identity, "field": "name"})], note="Parser base identity remains unchanged; this entry is a display lexeme.")
        add(binding["description_id"], binding["raw_description"], ja["description"], "monster_base_display_category",
            [source(row, {**identity, "field": "desc"}) for row in base["fields"].get("desc", [])],
            note="Reviewed short category label; full monster lore desc fields are excluded.")
    for kind, binding in zip(inventory["object_kinds"], mapping["object_kinds"]):
        ja = object_ja[str(kind["kidx"])]
        assert ja["english"] == kind["name"]
        identity = {"domain": "object_kind", "kidx": kind["kidx"], "tval": kind["type"]["tval"],
                    "tval_key": kind["type"]["key"], "sval": kind["sval"], "origin": kind["origin"], "field": "name"}
        extraction = {"object_file": "exact name directive value",
                      "class_book": "third colon-delimited book field; canonical shared book title",
                      "artifact_dummy": "base-object second field wrapped by native write_dummy_object_record as '& ' + field + '~'"}[kind["origin"]]
        add(binding["name_id"], kind["name"], ja["name"], "object_kind_name",
            [source(kind["header"], identity, extraction, kind["name"])], english_grammar=english_ast(kind["name"]),
            note="Identical exact source lexemes coalesce across hidden kind identities; quantity policy comes from the selected visible basename context.")
    for base, binding in zip(inventory["object_bases"], mapping["object_bases"]):
        if base["name"] is None:
            assert binding["name_id"] is None
            continue
        add(binding["name_id"], base["name"], base_ja["object_bases"][base["type"]["key"]], "object_base_name",
            [source(base["source"], {"domain": "object_base", "tval": base["type"]["tval"], "parser_key": base["type"]["key"], "field": "name"},
                    "second colon-delimited name field", base["name"])],
            english_grammar=english_ast(base["name"]), counter_id=binding["counter_id"])
    for flavor, binding in zip(inventory["flavors"], mapping["flavors"]):
        if flavor["name"] is None:
            assert binding["name_id"] is None and binding["modifier_id"] is None
            continue
        ja = flavor_ja[flavor["name"]]
        identity = {"domain": "object_flavor", "fidx": flavor["fidx"], "tval": flavor["type"]["tval"], "fixed": flavor["fixed"]}
        provenance = source(flavor["source"], identity, "optional flavor description field (fourth fixed or third flavor field)", flavor["name"])
        add(binding["name_id"], flavor["name"], ja["name"], "object_flavor_name", [provenance],
            english_grammar=english_ast(flavor["name"]), note="Exact visible flavor lexemes coalesce across kinds/types; shuffled flavor association and random tables are unchanged.")
        add(binding["modifier_id"], flavor["name"], ja["modifier"], "object_flavor_modifier", [provenance],
            english_grammar=english_ast(flavor["name"]), note="Authored Japanese attributive phrase selected only when native flavor display chooses it.")
    for art, binding in zip(inventory["artifacts"], mapping["artifacts"]):
        ja = artifact_ja[str(art["aidx"])]
        assert ja["english"] == art["name"]
        add(binding["name_id"], art["name"], ja["name"], "artifact_name",
            [source(art["header"], {"domain": "artifact", "aidx": art["aidx"], "field": "name"})],
            attachment=binding["attachment"], japanese_lexeme_policy="Authored proper-name lexeme without source leading 'of ' or surrounding quotes; attachment grammar supplies these relations.",
            note="Fixed identity is valid only when selected raw name still equals pinned source; generated randart names remain opaque owned proper lexemes.")
    for ego, binding in zip(inventory["egos"], mapping["egos"]):
        ja = ego_ja[ego["name"]]
        provenance = source(ego["header"], {"domain": "ego", "eidx": ego["eidx"], "field": "name"})
        add(binding["name_id"], ego["name"], ja["name"], "ego_name", [provenance],
            note="Source name repeats for multiple eligible item groups; one public lexeme does not expose the hidden eidx.")
        add(binding["modifier_id"], ego["name"], ja["modifier"], "ego_modifier", [provenance],
            note="Authored Japanese adjective/possessive prefix; source suffix placement remains exact in English.")
    for trap, binding in zip(inventory["chest_traps"], mapping["chest_traps"]):
        add(binding["name_id"], trap["name"], base_ja["chest_traps"][trap["name"]], "chest_trap_name",
            [source(trap["header"], {"domain": "chest_trap", "code": binding["code"], "field": "name"})],
            note="Only the native winning chest_trap_name branch selects this displayed label; duplicated gas/needle labels coalesce without leaking the hidden code.")
    for realm, binding in zip(inventory["realms"], mapping["realm_naming"]):
        for field, endpoint in binding["fields"].items():
            row = realm["fields"][field][0]
            add(endpoint["id"], row["value"], base_ja["realms"][realm["name"]][field], "realm_" + field.replace("-", "_"),
                [source(row, {"domain": "realm", "parser_key": realm["name"], "field": field})],
                note="Realm display names are owned by birth/sidebar; this entry covers the source naming noun/verb only.")
    for rule in grammar["rules"]:
        add(rule["id"], rule["source_english"], rule["render"]["ja"], "naming_grammar",
            rule["sources"], rule["parameters"], rule["note"], grammar_role=rule["role"], render=rule["render"],
            authored_composition=rule.get("authored_composition", False),
            **({"english_grammar": english_ast(rule["source_english"])} if rule["role"].startswith("object.basename.") else {}),
            **({"counter_id": rule["counter_id"]} if "counter_id" in rule else {}))
    sorted_entries = [entries[id_] for id_ in sorted(entries)]
    en = {e["id"]: e["english"] for e in sorted_entries}
    ja = {e["id"]: e["japanese"] for e in sorted_entries}
    assert len(en) == len(ja)
    source_locations = {(s["file"], s["line"]) for e in sorted_entries for s in e["sources"]}
    excluded = {}
    for pinned in inventory["sources"]:
        if not pinned["file"].startswith("data/gamedata/"):
            continue
        omitted = Counter(row["directive"] for row in rows(pinned["file"]) if (row["file"], row["line"]) not in source_locations)
        excluded[pinned["file"]] = {"active_directives_not_naming_lexemes": dict(sorted(omitted.items())),
            "note": "Numeric mechanics, parser identities, effect definitions and non-naming prose belong to other domains. Monster/object/artifact/ego lore descriptions and trap messages are inventoried but excluded from this naming catalog."}
    coverage = {"catalog_ids": len(en), "role_counts": dict(sorted(Counter(e["role"] for e in sorted_entries).items())),
                "monster_races": len(inventory["monster_races"]), "explicit_monster_plurals": sum(b["plural_id"] is not None for b in mapping["monster_races"]),
                "monster_possessive_stems": sum(b["name_id"] != b["possessive_name_id"] for b in mapping["monster_races"]),
                "monster_bases": len(inventory["monster_bases"]), "object_named_kinds": len(inventory["object_kinds"]),
                "source_object_kinds": sum(k["origin"] == "object_file" for k in inventory["object_kinds"]),
                "class_generated_unique_book_kinds": sum(k["origin"] == "class_book" for k in inventory["object_kinds"]),
                "artifact_generated_dummy_kinds": sum(k["origin"] == "artifact_dummy" for k in inventory["object_kinds"]),
                "class_book_associations": len(inventory["class_book_associations"]),
                "object_bases": len(inventory["object_bases"]), "named_object_bases": sum(b["name"] is not None for b in inventory["object_bases"]),
                "flavor_records": len(inventory["flavors"]), "named_flavor_records": sum(f["name"] is not None for f in inventory["flavors"]),
                "distinct_flavor_lexemes": len(flavor_ja), "generated_scroll_title_records": sum(f["name"] is None for f in inventory["flavors"]),
                "fixed_artifacts": len(inventory["artifacts"]), "ego_records": len(inventory["egos"]), "distinct_ego_lexemes": len(ego_ja),
                "realm_naming_fields": 12, "chest_trap_records": len(inventory["chest_traps"]), "grammar_rules": len(grammar["rules"]),
                "distinct_source_locations": len(source_locations), "complete_game_localization": False}
    manifest = {"schema_version": 1, "upstream_version": "4.2.6", "upstream_commit": inventory["upstream_commit"],
                "status": "reviewed_catalog_inputs", "runtime_integrated": False,
                "scope": "Complete pinned monster/object naming lexemes and selected-part grammar only; no executable acceptance or complete game localization claim.",
                "id_policy": "Source-identified lexical role with frozen private canonical index bindings; equal visible raw lexemes coalesce within each role. No completed-English substitution.",
                "english_policy": "Flat English retains exact selected upstream source lexemes/literals. Native parser-generated kind patterns and authored composition templates are explicitly identified; render.en normalizes reviewed printf slots only in grammar metadata.",
                "japanese_policy": "Authored Japanese nouns, proper-name transcription, modifiers, counters and relations; no untranslated-English fallback. Generated scroll/randart/external names remain owned opaque values.",
                "parameter_policy": "Naming grammar declares a locale-union typed parameter set. Each locale consumes only its authored placeholders (English plural_suffix, Japanese counter); generic FFI event schemas remain exact. Literal native inscription/store braces are punctuation, not parameter slots.",
                "counter_policy": "Counters are explicit reviewed metadata on private records and selected generic basename rules. Shared effect-name kind IDs may have different private tvals; the selected visible basename supplies the counter, never the hidden kind identity.",
                "producer_snapshots": "producer-snapshots preserve pinned official naming code byte-for-byte for historical provenance and source parity; no code is executed by extraction.",
                "coverage": coverage, "sources": inventory["sources"], "entries": sorted_entries,
                "exclusions": excluded,
                "remaining_integration": ["Catalogs do not establish WASM/browser runtime acceptance.",
                    "Selected-part C/Rust adapters are owned separately; native knowledge/visibility gates, mutations, RNG and key selection must remain unchanged.",
                    "Generated scroll title words/seed/order, generated randart names and external names/inscriptions stay opaque.",
                    "Monster lore, object/artifact/ego lore, effects, trap messages and remaining full-game UI/messages are separate translation domains."]}
    return en, ja, manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory-only", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    inventory = source_inventory()
    mapping = bindings(inventory)
    outputs = {"source-records.json": inventory, "source-bindings.json": mapping}
    if not args.inventory_only:
        grammar = grammar_inventory()
        en, ja, manifest = full_catalog(inventory, mapping, grammar)
        outputs.update({"grammar.json": grammar, "en.json": en, "ja.json": ja, "source-manifest.json": manifest})
    if args.check:
        for name, data in outputs.items():
            assert load(name) == data, f"stale generated output: {name}"
    else:
        for name, data in outputs.items():
            write(name, data)
    print(json.dumps({"source_inventory_passed": True,
                      "catalog_ids": len(outputs.get("en.json", {})),
                      "counts": {key: len(inventory[key]) for key in ["monster_races", "monster_bases", "object_kinds", "object_bases", "flavors", "artifacts", "egos", "class_book_associations"]}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
