"""Audit inventory integrity, index actual gameplay tables and critical code."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import re

HERE=Path(__file__).parent
summary=json.loads((HERE/"summary.json").read_text(encoding="utf-8"))
SOURCE=Path(summary["upstream"]["source_root"])


def read_rows(name):
    with (HERE/name).open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream]


def save(name,value):
    (HERE/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


strings=read_rows("source_strings.jsonl")
directives=read_rows("gamedata_directives.jsonl")
data_text=read_rows("gamedata_text_candidates.jsonl")
functions=read_rows("source_functions.jsonl")
files=json.loads((HERE/"source_file_manifest.json").read_text(encoding="utf-8"))
source_cache={}


def source(path):
    if path not in source_cache: source_cache[path]=(SOURCE/path).read_text(encoding="utf-8",errors="replace")
    return source_cache[path]


def evidence(path,pattern,before=2,after=3):
    if not (SOURCE/path).exists(): return []
    lines=source(path).splitlines()
    return [{"path":path,"line":index+1,"snippet_start":max(1,index+1-before),"snippet":"\n".join(lines[max(0,index-before):index+after+1])} for index,line in enumerate(lines) if re.search(pattern,line)]


content={
    "player_races":("p_race.txt","name"), "active_classes":("class.txt","name"),
    "active_spells":("class.txt","spell"), "active_spell_books":("class.txt","book"),
    "class_advancement_titles":("class.txt","title"), "monster_records_including_player_sentinel":("monster.txt","name"),
    "monster_explicit_plural_forms":("monster.txt","plural"), "monster_bases":("monster_base.txt","name"),
    "monster_spell_types":("monster_spell.txt","name"), "monster_spell_power_variants":("monster_spell.txt","lore"),
    "object_kind_records_including_sentinels":("object.txt","name"), "object_base_types":("object_base.txt","name"),
    "artifacts":("artifact.txt","name"), "ego_item_templates":("ego_item.txt","name"),
    "activations":("activation.txt","name"), "player_timed_effects":("player_timed.txt","name"),
    "player_timed_grades":("player_timed.txt","grade"), "monster_pain_types":("pain.txt","type"),
    "monster_pain_messages":("pain.txt","message"), "terrain_records":("terrain.txt","code"),
    "trap_records_including_no_trap_sentinel":("trap.txt","name"), "chest_trap_records":("chest_trap.txt","name"),
    "shapes":("shape.txt","name"), "curses":("curse.txt","name"), "stores":("store.txt","store"),
    "store_owners":("store.txt","owner"), "quests":("quest.txt","name"), "realm_types":("realm.txt","name"),
    "history_chart_steps":("history.txt","chart"), "flavor_records":("flavor.txt","flavor"),
    "fixed_flavor_records":("flavor.txt","fixed"), "procedural_name_seed_words":("names.txt","word"),
    "room_templates":("room_template.txt","name"), "vault_templates":("vault.txt","name"),
    "pit_profiles":("pit.txt","name"), "dungeon_profiles":("dungeon_profile.txt","name"),
    "world_levels":("world.txt","level"), "hints":("hints.txt","H")
}
census={name:{"count":summary["data_counts_by_file"][filename].get(field,0),"source":"lib/gamedata/"+filename,"directive":field} for name,(filename,field) in content.items()}

macro_lists={}
for path in sorted((SOURCE/"src").glob("list-*.h")):
    entries=[]
    for line,value in enumerate(path.read_text(encoding="utf-8",errors="replace").splitlines(),1):
        match=re.match(r"\s*([A-Z][A-Z_0-9]*)\s*\(\s*([A-Z_a-z0-9]+)",value)
        if match: entries.append({"line":line,"macro":match[1],"symbol":match[2],"source":value})
    macro_lists[path.name]={"count":len(entries),"entries":entries}

command_tables=[]
ui=source("src/ui-game.c")
for match in re.finditer(r"struct cmd_info\s+(\w+)\[\]\s*=\s*\{([\s\S]*?)\n\};",ui):
    start=ui.count("\n",0,match.start())+1
    rows=[]
    for offset,value in enumerate(match[2].splitlines()):
        label=re.match(r'\s*\{\s*"((?:[^"\\]|\\.)*)"',value)
        if label: rows.append({"line":start+offset+1,"label":label[1],"raw":value,"command_symbols":re.findall(r"\bCMD_[A-Z0-9_]+\b",value)})
    command_tables.append({"name":match[1],"path":"src/ui-game.c","line":start,"count":len(rows),"entries":rows})

families=[
    ("birth_and_advancement","Race/class selection, point-buy/rolling, stats, age/history, equipment, leveling, spell learning and titles.",["src/player-birth.c","src/player-calcs.c","src/player-spell.c","src/player-history.c","src/ui-birth.c","src/ui-player.c"]),
    ("turns_and_commands","Energy/speed scheduling, command queue and repetition, walking/running/pathfinding, rest, terrain interaction and world updates.",["src/cmd-core.c","src/cmd-cave.c","src/cmd-misc.c","src/game-world.c","src/player-path.c","src/player-util.c"]),
    ("dungeon_and_perception","Town/dungeon generation, profiles, pits/rooms/vaults, stairs, grids, lighting, line of sight, visibility, exploration and targeting.",["src/generate.c","src/gen-cave.c","src/gen-room.c","src/gen-util.c","src/cave.c","src/cave-map.c","src/cave-view.c","src/target.c"]),
    ("combat_and_projectiles","Player melee/shoot/throw, monster blows, criticals, brands/slays, armor, damage, resistances and projections.",["src/player-attack.c","src/mon-attack.c","src/mon-blows.c","src/project.c","src/project-player.c","src/project-mon.c","src/project-obj.c","src/project-feat.c"]),
    ("monsters_and_lore","Generation, movement/AI, groups, summoning, timed states, spellcasting, drops, uniques, kills, recall and knowledge.",["src/mon-make.c","src/mon-move.c","src/mon-group.c","src/mon-spell.c","src/mon-timed.c","src/mon-util.c","src/mon-lore.c","src/mon-list.c","src/mon-msg.c"]),
    ("objects_inventory_and_knowledge","Kinds/flavors, stacking/gear/equipment, charging/use, identification/runes, curses, artifacts/random artifacts, ego items, ignoring and inscriptions.",["src/obj-make.c","src/obj-gear.c","src/obj-knowledge.c","src/obj-desc.c","src/obj-info.c","src/obj-ignore.c","src/obj-randart.c","src/obj-util.c","src/cmd-obj.c","src/cmd-pickup.c"]),
    ("magic_effects_and_status","Class/book/realm spells, activations, effect chains/dice/expressions, status grades, healing/food, damage and player shape changes.",["src/effects.c","src/effect-handler-general.c","src/effect-handler-attack.c","src/effects-info.c","src/player-spell.c","src/player-timed.c","src/player-util.c","src/player-calcs.c"]),
    ("stores_and_economy","All eight stores, home, owners, buying/selling/pricing, stock and turnover.",["src/store.c","src/ui-store.c"]),
    ("traps_and_chests","Floor traps, glyphs/webs, chest traps, disarm/open/close/tunnel, trap saving and damage.",["src/trap.c","src/obj-chest.c","src/cmd-cave.c"]),
    ("quests_death_and_victory","Sauron/Morgoth quest rules, dungeon feelings, death/retirement/victory, score/history and record presentation.",["src/player-quest.c","src/player-util.c","src/ui-death.c","src/ui-score.c","src/player-history.c"]),
    ("ui_commands_help_settings","Original/roguelike keysets, all visible/hidden/debug command families, messages, lists, knowledge, options, help, preferences and menus.",["src/ui-game.c","src/ui-command.c","src/ui-menu.c","src/ui-help.c","src/ui-options.c","src/ui-knowledge.c","src/ui-keymap.c","src/ui-prefs.c","src/ui-input.c"]),
    ("persistence_rng_and_platform","Upstream saves/load validation, RNG, data parsers, terminal/event handling and all native frontends; browser adapters must preserve rules.",["src/save.c","src/load.c","src/savefile.c","src/z-rand.c","src/init.c","src/parser.c","src/message.c","src/game-event.c","src/ui-term.c"]),
]
family_rows=[]
for name,description,paths in families:
    present=[path for path in paths if (SOURCE/path).exists()]
    family_rows.append({"name":name,"features":description,"source_files":present,"lexical_function_count":sum(f["path"] in present for f in functions),"not_found_expected_names":[path for path in paths if path not in present]})

save("feature_inventory.json",{"upstream":summary["upstream"],"content_census":census,"source_xmacro_tables":macro_lists,"ui_command_tables":command_tables,"feature_families":family_rows,"scope_note":"Source-backed feature index and content census; these are upstream capabilities, not a claim that any port implements them."})

critical={
    "message_sinks":evidence("src/message.c",r"^void msg(?:t)?\("),
    "monster_name_grammar":evidence("src/mon-desc.c",r"^(?:void|static .*) (?:plural_aux|get_mon_name|monster_desc)\("),
    "object_name_grammar_and_mutation":evidence("src/obj-desc.c",r"object_desc\(|obj_desc_name_format\(|everseen\s*="),
    "monster_spell_brace_expansion":evidence("src/mon-spell.c",r"spell_tag_lookup|SPELL_TAG_|randint0\("),
    "monster_message_plurality":evidence("src/mon-msg.c",r"get_subject\(|get_message_text\(|MSG_PARSE_SINGLE|MSG_PARSE_PLURAL"),
    "timed_grade_schema":evidence("src/player-timed.c",r'parser_reg\(p, "(?:grade|on-|name|desc)'),
    "render_randomness_and_width":[],
    "name_flavor_history_randomness":[],
    "save_rng_content_version":[]
}
for path in ["src/cave-map.c","src/ui-map.c","src/ui-display.c","src/ui-output.c","src/obj-desc.c","src/mon-desc.c","src/ui-term.c"]:
    critical["render_randomness_and_width"]+=evidence(path,r"\brandint\d*\(|\brand_\w*\(|Rand_quick|text_mbstowcs|utf8|wcwidth|image_monster|image_object")
for path in ["src/obj-init.c","src/obj-randart.c","src/player-birth.c","src/player-history.c","src/mon-blows.c","src/mon-attack.c","src/z-rand.c"]:
    critical["name_flavor_history_randomness"]+=evidence(path,r"randname|Rand_quick|flavor_init|flavor_assign|act_msg|method->act|history|randint\d*\(")
for path in ["src/save.c","src/load.c","src/savefile.c"]:
    critical["save_rng_content_version"]+=evidence(path,r"wr_randomizer|rd_randomizer|Rand_|VERSION|version|randart_seed|seed_flavor")
save("critical_boundaries.json",critical)

binary_resources=[]
for path in sorted((SOURCE/"src").rglob("*")):
    if path.is_file() and path.suffix in {".nib",".docx",".icns",".png",".dll",".lib",".ico",".3ds",".smdh"}:
        data=path.read_bytes()
        binary_resources.append({"path":path.relative_to(SOURCE).as_posix(),"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),"classification":"binary_native_asset_or_resource_requires_format_and_license_review","text_extracted":False})
save("binary_source_resource_manifest.json",binary_resources)

errors=[]
assert len(strings)==summary["counts"]["c_string_occurrences_after_adjacent_concatenation"]
assert len(directives)==summary["counts"]["gamedata_directives"]
assert len(data_text)==summary["counts"]["gamedata_logical_visible_text_candidates"]
for entry in files:
    actual=hashlib.sha256((SOURCE/entry["path"]).read_bytes()).hexdigest()
    if actual!=entry["sha256"]: errors.append({"kind":"source_hash_changed","path":entry["path"]})
for row in strings:
    body=source(row["path"])
    lines=body.splitlines(keepends=True)
    for fragment in row["raw_fragments"]:
        offset=sum(len(line) for line in lines[:fragment["line"]-1])+fragment["column"]-1
        if body[offset:offset+len(fragment["raw"])]!=fragment["raw"]:
            errors.append({"kind":"literal_location_mismatch","path":row["path"],"line":fragment["line"]})
for path in (SOURCE/"lib/gamedata").glob("*.txt"):
    expected={i:line for i,line in enumerate(path.read_text(encoding="utf-8",errors="replace").splitlines(),1) if line.strip() and not line.lstrip().startswith("#")}
    actual={row["line"]:row["raw"] for row in directives if row["path"]==path.relative_to(SOURCE).as_posix()}
    if actual!=expected: errors.append({"kind":"directive_coverage_mismatch","path":path.relative_to(SOURCE).as_posix()})
    fields={row["field"] for row in directives if row["path"]==path.relative_to(SOURCE).as_posix()}
    obvious={field for field in fields if field in {"desc","description","text","phrase","title","message","lore","adjective","neg-adjective","verb","on-end","on-increase","on-decrease","effect-msg","msg-death","blind-desc","player-desc","lash-desc","label","label2","label5","monster-category"} or field.startswith("message-")}
    selected={row["field"] for row in directives if row["path"]==path.relative_to(SOURCE).as_posix() and row["text_segments"]}
    if obvious-selected: errors.append({"kind":"obvious_text_field_unselected","path":path.relative_to(SOURCE).as_posix(),"fields":sorted(obvious-selected)})
review_counts={"unreviewed_c_literal_occurrences":sum(row["classification"]=="unreviewed_literal" for row in strings),"source_proposals_with_collisions":sum(row["proposed_id_collision_count"]>1 for row in strings),"macro_printf_fragments_requiring_preprocessing":sum(row["requires_preprocessor_format_resolution"] for row in strings),"data_ids_requiring_semantic_review":len(data_text),"binary_source_resources_without_text_extraction":len(binary_resources),"accepted_semantic_ids":0,"japanese_translations_created":0}
verification={"source_unchanged":not any(e["kind"]=="source_hash_changed" for e in errors),"literal_locations_verified":not any(e["kind"]=="literal_location_mismatch" for e in errors),"all_gamedata_directives_covered":not any(e["kind"]=="directive_coverage_mismatch" for e in errors),"obvious_text_directives_selected":not any(e["kind"]=="obvious_text_field_unselected" for e in errors),"errors":errors,"review_counts":review_counts,"counts":summary["counts"]}
save("verification.json",verification)
print(json.dumps({"content_census":{key:value["count"] for key,value in census.items()},"command_table_counts":{row["name"]:row["count"] for row in command_tables},"verification":verification},ensure_ascii=False,indent=2))
if errors: raise SystemExit(1)
