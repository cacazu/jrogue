"""Extract/check the reviewed, display-only 4.2.6 character catalogs.

Uses the actual init.c attachment rules for active p_race.txt and class.txt.
Does not modify game data, runtime source, parser identifiers, or RNG tables.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import unicodedata

HERE = Path(__file__).resolve().parent
PORT = HERE.parents[1]
COMMIT = "f3082213b73f3e463e3d0d60bff4b00462beae6e"
SOURCE_SHA256 = {
    "p_race.txt": "ff18fc8d0d115e2ff4c021d020fa36cdb5bec3e489db975f625bb8c637600ed3",
    "class.txt": "8ce147c62f343b8089a9e7c7c1e3462e55dda6698e8a725dffd2b1286d6617da",
}
RACES = ["Human", "Half-Elf", "Elf", "Hobbit", "Gnome", "Dwarf", "Half-Orc",
         "Half-Troll", "Dunadan", "High-Elf", "Kobold"]
CLASSES = ["Warrior", "Mage", "Druid", "Priest", "Necromancer", "Paladin",
           "Rogue", "Ranger", "Blackguard"]
TEXT_DIRECTIVES = {"name", "title", "book", "spell", "effect-msg", "desc"}


def key(value):
    # These reviewed identity slugs are catalog IDs, never parser lookup keys.
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = value.replace("'", "")
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def source_lines(filename):
    path = PORT / "data" / "gamedata" / filename
    content = path.read_bytes()
    actual_sha = hashlib.sha256(content).hexdigest()
    if actual_sha != SOURCE_SHA256[filename]:
        raise ValueError(f"Pinned source changed: {filename}. Review identities and wording before updating the catalog; never silently regenerate new IDs.")
    result = []
    for n, raw in enumerate(content.decode("utf-8").splitlines(), 1):
        if not raw or raw.lstrip().startswith("#"):
            continue
        directive, separator, value = raw.partition(":")
        if not separator:
            raise ValueError(f"Missing colon: {filename}:{n}")
        result.append({"file": "data/gamedata/" + filename, "line": n,
                       "directive": directive, "raw_line": raw, "value": value})
    return result, {"file": "data/gamedata/" + filename,
                    "sha256": actual_sha,
                    "bytes": len(content), "active_directive_lines": len(result)}


def extract():
    en, entries, exclusions = {}, [], []
    race_rows, race_source = source_lines("p_race.txt")
    class_rows, class_source = source_lines("class.txt")
    records = {"races": [], "classes": []}
    counts = Counter()

    def add(identifier, role, pieces, identity, notes=None, field=None):
        if identifier in en:
            raise ValueError("Duplicate ID " + identifier)
        values = [p["value"] if field is None else p["value"].split(":")[field]
                  for p in pieces]
        english = "".join(values)
        en[identifier] = english
        counts[role] += 1
        mapped = []
        for p, value in zip(pieces, values):
            occurrence = dict(p)
            occurrence["exact_value"] = value
            if field is not None:
                occurrence["field_index_zero_based"] = field
            mapped.append(occurrence)
        entries.append({"id": identifier, "role": role, "english": english,
                        "identity": dict(identity), "sources": mapped,
                        "source_join": "verbatim concatenation; no inserted separator",
                        "parameters": {}, "notes": notes or [],
                        "review": "context-reviewed display catalog; runtime insertion pending"})

    race = None
    for row in race_rows:
        if row["directive"] == "name":
            i = len(records["races"])
            race = {"race_key": key(row["value"]), "upstream_name": row["value"],
                    "ridx": i, "source_header_line": row["line"]}
            records["races"].append(race)
            add(f"angband.player_race.{race['race_key']}.name", "race_name",
                [row], race, ["Keep upstream race name and ridx unchanged in parsing and saves."])
        else:
            assert race is not None
            exclusions.append({**row, "identity": dict(race),
                               "reason": "Rule/lookup value, not a display text field."})

    class_record = book = spell = effect = None
    for row in class_rows:
        directive = row["directive"]
        if directive == "name":
            class_record = {"class_key": key(row["value"]), "upstream_name": row["value"],
                            "cidx": len(records["classes"]), "source_header_line": row["line"],
                            "titles": [], "books": [], "spell_count": 0}
            records["classes"].append(class_record)
            book = spell = effect = None
            add(f"angband.player_class.{class_record['class_key']}.name", "class_name",
                [row], {k: v for k, v in class_record.items() if k not in {"titles", "books", "spell_count"}},
                ["Keep upstream class name and cidx unchanged in parsing and saves."])
        else:
            assert class_record is not None
            root = f"angband.player_class.{class_record['class_key']}"
            identity = {"class_key": class_record["class_key"],
                        "upstream_class_name": class_record["upstream_name"],
                        "cidx": class_record["cidx"]}
            if directive == "title":
                i = len(class_record["titles"])
                start, end = i * 5 + 1, i * 5 + 5
                identifier = f"{root}.title.level_{start:02}_{end:02}"
                title = {"title_index": i, "level_min": start, "level_max": end,
                         "id": identifier, "upstream_title": row["value"]}
                class_record["titles"].append(title)
                add(identifier, "advancement_title", [row], {**identity, **title},
                    ["Upstream chooses title[(player_level - 1) / 5]; retain all ten ordered bands."])
            elif directive == "book":
                fields = row["value"].split(":")
                assert len(fields) == 5
                book = {"book_key": key(fields[2]), "bidx": len(class_record["books"]),
                        "upstream_book_name": fields[2], "tval": fields[0],
                        "quality": fields[1], "declared_spell_capacity": int(fields[3]),
                        "realm_lookup_key": fields[4], "spells": []}
                class_record["books"].append(book)
                spell = effect = None
                add(f"{root}.book.{book['book_key']}.name", "book_name", [row],
                    {**identity, **{k: v for k, v in book.items() if k != "spells"}},
                    ["Square brackets are a literal book-title convention, not plural markup.",
                     "write_book_kind() shares object kinds by exact English key across classes; localize only its display descriptor.",
                     "Keep tval/realm/quality/sval allocation and shared-book identity unchanged."], field=2)
            elif directive == "spell":
                assert book is not None
                fields = row["value"].split(":")
                assert len(fields) == 5
                spell = {"spell_key": key(fields[0]), "upstream_spell_name": fields[0],
                         "book_spell_index": len(book["spells"]),
                         "sidx": class_record["spell_count"], "level": int(fields[1]),
                         "mana": int(fields[2]), "fail": int(fields[3]), "exp": int(fields[4]),
                         "effects": [], "description_sources": []}
                class_record["spell_count"] += 1
                book["spells"].append(spell)
                effect = None
                spell_identity = {**identity, "book_key": book["book_key"], "bidx": book["bidx"],
                                  **{k: v for k, v in spell.items() if k not in {"effects", "description_sources"}}}
                add(f"{root}.book.{book['book_key']}.spell.{spell['spell_key']}.name",
                    "spell_name", [row], spell_identity,
                    ["Retain sidx/bidx, exact upstream spell key and ordered effect/dice data."], field=0)
            elif directive == "effect":
                assert spell is not None
                effect = {"effect_index": len(spell["effects"]),
                          "effect_lookup_key": row["value"].split(":")[0],
                          "definition": row["value"], "source_line": row["line"],
                          "message_sources": []}
                spell["effects"].append(effect)
                exclusions.append({**row, "identity": {**identity, "book_key": book["book_key"],
                    "spell_key": spell["spell_key"], "sidx": spell["sidx"], "bidx": book["bidx"]},
                    "reason": "Rule effect identifier/arguments; preserve verbatim."})
            elif directive == "desc":
                assert spell is not None
                spell["description_sources"].append(row)
            elif directive == "effect-msg":
                assert effect is not None
                effect["message_sources"].append(row)
            else:
                exclusions.append({**row, "identity": {**identity,
                    **({"book_key": book["book_key"], "bidx": book["bidx"]} if book else {}),
                    **({"spell_key": spell["spell_key"], "sidx": spell["sidx"]} if spell else {})},
                    "reason": "Rule/lookup/equipment/glyph/colour value; presentation labels from other subsystems are separate."})

    for c in records["classes"]:
        for b in c["books"]:
            assert len(b["spells"]) <= b["declared_spell_capacity"]
            for s in b["spells"]:
                identity = {"class_key": c["class_key"], "cidx": c["cidx"],
                            "upstream_class_name": c["upstream_name"],
                            "book_key": b["book_key"], "bidx": b["bidx"],
                            "upstream_book_name": b["upstream_book_name"],
                            **{k: v for k, v in s.items() if k not in {"effects", "description_sources"}}}
                base = f"angband.player_class.{c['class_key']}.book.{b['book_key']}.spell.{s['spell_key']}"
                assert s["description_sources"], f"No description for {base}"
                notes = ["All desc directives attach to this spell, not its class or book.",
                         "Resolve from a structured (cidx, bidx, sidx) display descriptor; never replace rendered English.",
                         "Numeric/dice text is literal documentation, not a formatting placeholder."]
                if s["upstream_spell_name"] == "Command":
                    notes.append("Preserve upstream d/m/r command letters while translating their labels; no key rebinding.")
                add(base + ".description", "spell_description", s["description_sources"], identity, notes)
                for e in s["effects"]:
                    if e["message_sources"]:
                        assert e["effect_lookup_key"] == "DAMAGE"
                        add(base + ".effect.self_damage.death_reason", "effect_death_reason",
                            e["message_sources"], {**identity, **{k: v for k, v in e.items() if k != "message_sources"}},
                            ["DAMAGE effect copies context->msg to killer (effect-handler-attack.c); this is a death-cause noun phrase, not a complete message.",
                             "Future typed death/history events must carry the cause ID, not concatenate an English article."])

    assert [r["upstream_name"] for r in records["races"]] == RACES
    assert [c["upstream_name"] for c in records["classes"]] == CLASSES
    assert all(len(c["titles"]) == 10 for c in records["classes"])
    assert sum(c["spell_count"] for c in records["classes"]) == 163
    assert sum(len(c["books"]) for c in records["classes"]) == 30
    covered_lines = {(p["file"], p["line"]) for e in entries for p in e["sources"]}
    expected_lines = {(r["file"], r["line"]) for r in race_rows + class_rows
                      if r["directive"] in TEXT_DIRECTIVES}
    assert covered_lines == expected_lines
    directives = Counter(r["directive"] for r in race_rows + class_rows)
    manifest = {
        "schema_version": 1, "game": "Angband", "version": "4.2.6", "upstream_commit": COMMIT,
        "catalog_kind": "reviewed flat display-only English/Japanese catalog",
        "runtime_integrated": False, "complete_game_localization": False,
        "source_integrated": True, "integration_status": "source_connected_unbuilt",
        "wording_review": "migration/character-data/wording-review.json",
        "source_integration": {
            "kind": "Conditional browser source instrumentation; no build/runtime acceptance",
            "documentation": "docs/SPELL_TEXT_INTEGRATION.md",
            "owned_book_name_endpoints": 30, "owned_spell_name_endpoints": 163,
            "owned_spell_description_endpoints": 163,
            "race_class_title_endpoints_owned_by_birth_sidebar": 110,
            "death_reason_endpoints_unconnected": 3,
        },
        "id_policy": "Reviewed race/class/book/spell identity plus field role; freeze IDs across future wording changes. No source-line hashes or rendered-English lookup.",
        "sources": [race_source, class_source],
        "schema_review": [
            {"file": "logic/init.c", "lines": [2792, 2813, 4081, 4120], "note": "Actual parser registration, not obsolete file-header name schema."},
            {"file": "logic/init.c", "lines": [208, 2817, 2830, 3682, 3790, 4016, 4051, 4124, 4139], "note": "Shared book-kind lookup; race/class ordered indices; latest-book/latest-spell/latest-effect attachment; verbatim string_append."},
            {"file": "logic/ui-display.c", "lines": [189], "note": "Advancement band title[(lev - 1) / 5]."},
            {"file": "logic/effect-handler-attack.c", "lines": [516, 517], "note": "Player DAMAGE effect-msg is copied to killer, hence death_reason role."}
        ],
        "coverage": {
            "races": len(records["races"]), "classes": len(records["classes"]),
            "class_book_associations": 30,
            "unique_upstream_book_names": len({b["upstream_book_name"] for c in records["classes"] for b in c["books"]}),
            "spell_records": 163, "catalog_entries": len(en), "entries_by_role": dict(counts),
            "active_text_source_lines": len(expected_lines), "mapped_text_source_lines": len(covered_lines),
            "active_directives_by_type": dict(directives), "excluded_nontext_source_lines": len(exclusions),
            "race_descriptions_present": 0, "class_descriptions_present": 0,
            "all_active_race_class_display_fields_mapped": True,
            "all_json_keys_and_placeholders_checked": True,
        },
        "global_parameters_policy": "These fields contain no interpolation parameters. External player/user/inscription values stay verbatim in future surrounding typed events; never add them to a translation table.",
        "translation_review_notes": [
            "Sleep Evil English is preserved exactly; Japanese follows the actual RF_NO_SLEEP rule. See wording-review.json for source-backed upstream description errata.",
            "Crush retains the strict less-than four-times-level HP threshold.",
            "Priest Heroism starts at level 20, Paladin Heroism at level 15; these are separate descriptions.",
            "Druid Herbal Curing includes nourishment; Ranger Herbal Curing does not.",
            "Brand Ammunition English is preserved exactly; Japanese reflects brand_object cost/artifact/ego eligibility, without inventing a blanket curse exclusion.",
            "Leap into Battle retains rounding without inventing a rounding direction.",
            "Vampire Form's English source typo 'than' and half-HP wording are preserved exactly; Japanese follows the vampire shape PLAYER_HP / 4 effect.",
            "Tolkien setting names are authored game proper names; external player/user/inscription names remain untouched parameters in future events."
        ],
        "unresolved_integration": [
            "Wire race/class/title/book/spell descriptors to Rust presentation without changing upstream parser or save keys.",
            "Books have a class association and a shared object-kind identity; integrate the localized book name with object base/article/count grammar.",
            "Use cidx, bidx, sidx and effect index for identity; retain original spell/effect order, capacities, dice/RNG and realm lookups.",
            "Carry death_reason IDs in semantic death/history events; upstream C killer/save fields still contain English phrases.",
            "Lay out Japanese spell descriptions using grapheme/display-cell-aware wrapping rather than fixed upstream byte buffers.",
            "Birth help, race/class skill/property descriptions, character history, realm labels, generic spell UI/errors, monster/object names and external proper values come from other source files and remain outside this catalog."
        ],
        "excluded_files": [
            {"file": "data/gamedata/old_class.txt", "reason": "Inactive legacy classes; actual init parser loads class.txt."},
            {"file": "data/gamedata/names.txt", "reason": "Random proper-name seed words; must remain unchanged and ordered."},
            {"file": "data/gamedata/history.txt", "reason": "Separate ordered/chance-weighted birth-history subsystem; not descriptions in p_race/class schema."},
            {"file": "data/gamedata/realm.txt", "reason": "Separate realm labels and grammar fields; keep realm lookup keys here unchanged."}
        ],
        "records": records, "entries": entries, "excluded_nontext_directives": exclusions,
    }
    return en, manifest


def pairs_checked(path):
    def reject_duplicates(pairs):
        obj = {}
        for k, v in pairs:
            if k in obj:
                raise ValueError(f"Duplicate key {k} in {path.name}")
            obj[k] = v
        return obj
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates)


def validate(en, ja):
    assert set(en) == set(ja), {"missing": sorted(set(en)-set(ja)), "orphan": sorted(set(ja)-set(en))}
    for identifier, value in en.items():
        assert isinstance(ja[identifier], str) and ja[identifier].strip(), identifier
        assert not re.search(r"\{[^{}]*\}", value + ja[identifier]), identifier
        # Percentages in these plain data fields are literal (33% and 25%).
        # The following word in '33% for' must not be mistaken for a % f code.
        assert not re.search(r"(?<!\d)%(?:\d+\$)?[-+#0 ]*(?:\d+|\*)?(?:\.(?:\d+|\*))?[hljztL]*[diuoxXfFeEgGaAcspn]", value), identifier
        assert "\ufffd" not in ja[identifier], identifier
        assert re.search(r"[\u3040-\u30ff\u3400-\u9fff]", ja[identifier]), identifier
        # A hyphen in English 'radius-2' is punctuation, not a negative radius.
        numeric_source = re.sub(r"\bradius-(\d+)", r"radius \1", value)
        for literal in re.findall(r"[+-]?\d+(?:\+\d*d\d+|d\d+|%)?", numeric_source):
            assert literal in ja[identifier], (identifier, "missing numeric/dice literal", literal)
        if identifier.endswith(".spell.command.description"):
            assert all(f"（{letter}）" in ja[identifier] for letter in "dmr"), identifier
        if ".book." in identifier and ".spell." not in identifier and identifier.endswith(".name"):
            assert ja[identifier].startswith("[") and ja[identifier].endswith("]"), identifier


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate without rewriting files")
    args = parser.parse_args()
    en, manifest = extract()
    ja = pairs_checked(HERE / "ja.json")
    validate(en, ja)
    if args.check:
        assert pairs_checked(HERE / "en.json") == en
        assert pairs_checked(HERE / "source-manifest.json") == manifest
    else:
        for filename, content in [("en.json", en), ("source-manifest.json", manifest)]:
            (HERE / filename).write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": True, **manifest["coverage"], "runtime_integrated": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
