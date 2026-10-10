"""Source identity inventory for knowledge prose; Python stdlib, no game execution."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import unicodedata

HERE = Path(__file__).resolve().parent
PORT = HERE.parents[1]
PREFIX = "angband.knowledge."


def load(path):
    def pairs(items):
        out = {}
        for key, value in items:
            assert key not in out, (path, key)
            out[key] = value
        return out
    return json.loads(path.read_text("utf-8"), object_pairs_hook=pairs)


def write(name, value):
    (HERE / name).write_text(value if isinstance(value,str) else json.dumps(value, ensure_ascii=False, indent=2) + "\n", "utf-8")


def slug(value):
    value = unicodedata.normalize("NFKD", value.replace("*", " star "))
    value = value.encode("ascii", "ignore").decode().replace("'", "")
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def rows(filename):
    out = []
    for line, text in enumerate((PORT / filename).read_text("utf-8").splitlines(), 1):
        if not text or text.startswith("#") or ":" not in text:
            continue
        directive, value = text.split(":", 1)
        out.append({"file": filename, "line": line, "directive": directive, "raw_line": text, "value": value})
    return out


def records(filename, header="name"):
    out = []
    for row in rows(filename):
        if row["directive"] == header:
            out.append({"source_ordinal": len(out), "header": row, "fields": {header: [row]}})
        elif out:
            out[-1]["fields"].setdefault(row["directive"], []).append(row)
    return out


def one(record, field, default=None):
    found = record["fields"].get(field, [])
    assert len(found) <= 1, (record["source_ordinal"], field)
    return found[0]["value"] if found else default


def joined(record, field):
    return "".join(row["value"] for row in record["fields"].get(field, []))


def macros(file, macro):
    text = (HERE / "producer-snapshots" / file).read_text("utf-8")
    return re.findall(r"^" + macro + r"\(\s*(\w+)", text, re.M)


def inventory():
    pin = load(HERE / "pinned-sources.json")
    for source in pin["sources"]:
        b = (PORT / source["file"]).read_bytes()
        assert len(b) == source["bytes"] and hashlib.sha256(b).hexdigest() == source["sha256"], source["file"]
    stats = macros("list-stats.h", "STAT")
    mods = stats + macros("list-object-modifiers.h", "OBJ_MOD")
    flags = ["NONE"] + macros("list-object-flags.h", "OF")
    player_flags = macros("list-player-flags.h", "PF")
    elements = macros("list-elements.h", "ELEM")
    monster = records("data/gamedata/monster.txt")
    seen = {}
    monster_prose = []
    for race in monster:
        race["ridx"] = race["source_ordinal"]
        race["name"] = one(race, "name")
        text = joined(race, "desc")
        race["description_english"] = text if "desc" in race["fields"] else None
        if race["description_english"] is not None:
            if text not in seen:
                seen[text] = PREFIX + f"monster.{slug(race['name'])}.description"
                monster_prose.append({"id": seen[text], "canonical_ridx": race["ridx"], "canonical_name": race["name"],
                                      "english": text, "sources": [], "private_alias_ridx": []})
            entry = next(p for p in monster_prose if p["id"] == seen[text])
            entry["sources"].extend(race["fields"]["desc"])
            entry["private_alias_ridx"].append(race["ridx"])
            race["description_id"] = seen[text]
        else:
            race["description_id"] = None
    egos = records("data/gamedata/ego_item.txt")
    domain = load(PORT / "migration/domain-text-data/inventory.json")
    domain_entries = domain["entries"]
    domain_entries = list(domain_entries.values()) if isinstance(domain_entries, dict) else domain_entries
    for ego in egos:
        ego["eidx"] = ego["source_ordinal"]
        ego["name"] = one(ego, "name")
        ego["description_english"] = joined(ego, "desc") if "desc" in ego["fields"] else None
        ego["description_dependency"] = "domain.ego_item." + slug(ego["name"]) + ".description" if "desc" in ego["fields"] else None
        if ego["description_dependency"]:
            assert any(e.get("id") == ego["description_dependency"] for e in domain_entries), ego["description_dependency"]
    slays = records("data/gamedata/slay.txt", "code")
    brands = records("data/gamedata/brand.txt", "code")
    for group in [slays, brands]:
        for r in group:
            r["index"] = r["source_ordinal"] + 1
            r["code"] = one(r, "code")
    properties = records("data/gamedata/object_property.txt")
    for prop in properties:
        prop["pidx"] = prop["source_ordinal"] + 1
        prop["name"] = one(prop, "name")
        prop["type"] = one(prop, "type")
        prop["code"] = one(prop, "code")
        codes = mods if prop["type"] in {"stat", "mod"} else flags if prop["type"] == "flag" else elements
        prop["type_index"] = codes.index(prop["code"])
        prop["rune_eligible"] = prop["type"] in {"stat", "mod"} or (prop["type"] == "flag" and one(prop, "subtype") not in {"light", "dig", "throw", "curse-only"})
    abilities = records("data/gamedata/player_property.txt", "type")
    birth = load(PORT / "migration/birth-and-sidebar.json")
    birth_entries = {e["id"]: e for e in birth["entries"]}
    for ability in abilities:
        ability["type"] = one(ability, "type")
        ability["code"] = one(ability, "code")
        ability["name"] = one(ability, "name")
        ability["description_english"] = joined(ability, "desc")
        if ability["type"] == "element":
            ability["value"] = int(one(ability, "value"))
            ability["name_dependency"] = "player.ability.element." + ability["name"].lower() + ".name"
            ability["description_id"] = PREFIX + "player_ability.element." + ability["name"].lower() + ".description"
            ability["element_indices"] = list(range(len(elements)))
        else:
            code = ability["code"]
            codes = player_flags if ability["type"] == "player" else flags
            ability["type_index"] = codes.index(code)
            ability["name_dependency"] = "player.ability." + ability["type"] + "." + code.lower() + ".name"
            ability["description_id"] = PREFIX + "player_ability." + ability["type"] + "." + code.lower() + ".description"
        assert ability["name_dependency"] in birth_entries, ability["name_dependency"]
    assert len(monster) == 624 and len(monster_prose) == 606
    assert len(egos) == 107 and len(slays) == 11 and len(brands) == 10
    assert len(properties) == 79 and len(abilities) == 44
    return {"schema_version": 1, "upstream_commit": pin["upstream_commit"], "sources": pin["sources"],
            "canonical_codes": {"stat": stats, "mod": mods, "flag": flags, "player_flag": player_flags, "element": elements},
            "monster_races": monster, "monster_prose": monster_prose, "ego_items": egos,
            "slays": slays, "brands": brands, "object_properties": properties, "player_abilities": abilities,
            "player_ability_source_equivalent": "player_property.txt is the actual parser source; no player_ability.txt exists. init.c generates 75 element abilities plus 41 ordinary abilities.",
            "prose_gates": {"monster": "lore_append_flavor appends selected race->text; caller owns known race selection, spoilers and flags. No new knownness queries.",
                "ego": "obj-info describe_flavor_text original object_flavor_is_aware/ego and obj->known->ego gates; five domain-owned endpoints referenced.",
                "object_property": "obj-info selects known modifiers/flags/elements and appropriate property subtype; rune init excludes internal light/dig/throw/curse-only flags.",
                "player_ability": "player-properties selects actual race/class/object/element ability; UI knowledge/shape consumers select appropriate flags before rendering.",
                "rune": "Rune variety/index controls grammar; player_knows_rune and caller selection remain authoritative. Brand/slay duplicate targets share native knowledge, not individual multiplier identity."}}


def assemble(inv):
    authored = load(HERE / 'core-ja-input.json')
    lore = load(HERE / 'monster-ja-input.json')
    assert set(lore) == {str(p['canonical_ridx']) for p in inv['monster_prose']}
    entries, en, ja, dependencies = {}, {}, {}, {}
    bindings = {'schema_version': 1, 'upstream_commit': inv['upstream_commit'],
        'policy': 'Private parser identities only. Producers select a reviewed field under existing knowledge gates, then emit only its selected text ID and typed values; never expose unused identity, multiplier, flags or completed English.',
        'monster_races': [], 'ego_items': [], 'object_properties': [], 'slays': [], 'brands': [], 'player_abilities': [], 'runes': {}}
    def add(id, english, japanese, role, sources, identity, parameters=None, source_english=None, notes=''):
        parameters = parameters or {}
        source_english = english if source_english is None else source_english
        assert japanese and re.search(r'[\u3040-\u30ff\u3400-\u9fff]', japanese) or english == japanese == '{property}' or role.startswith('object_info.') or role.startswith('lore.') or role.startswith('shape_lore.')
        for value in (english, japanese):
            assert set(re.findall(r'\{(\w+)\}', value)) == set(parameters), (id, value, parameters)
        if id in entries:
            assert en[id] == english and ja[id] == japanese and entries[id]['parameters'] == parameters, id
            entries[id]['associations'].append({'identity': identity, 'sources': sources})
            return id
        entries[id] = {'id': id, 'role': role, 'source_english': source_english, 'render_en': english,
            'render_ja': japanese, 'parameters': parameters, 'associations': [{'identity': identity, 'sources': sources}],
            'notes': notes, 'source_integrated': False, 'runtime_integrated': False}
        en[id], ja[id] = english, japanese
        return id
    birth_entries = {e['id']: e for e in load(PORT / 'migration/birth-and-sidebar.json')['entries']}
    def dependency(id, owner='birth-and-sidebar'):
        if owner == 'birth-and-sidebar':
            value = birth_entries[id]
            dependencies[id] = {'owner': 'migration/birth-and-sidebar.json', 'english': value['english'], 'japanese': value['japanese'], 'parameters': value['parameters']}
        else:
            dependencies[id] = {'owner': 'migration/domain-text-data', 'field': 'description', 'runtime_integrated': False}
        return id
    for record in inv['monster_races']:
        bindings['monster_races'].append({'ridx': record['ridx'], 'raw_name': record['name'], 'description_id': record['description_id']})
    for paragraph in inv['monster_prose']:
        for ridx in paragraph['private_alias_ridx']:
            record = inv['monster_races'][ridx]
            add(paragraph['id'], paragraph['english'], lore[str(paragraph['canonical_ridx'])], 'monster.description',
                record['fields']['desc'], {'ridx': ridx, 'raw_name': record['name']},
                notes='Exact string_append concatenation, including existing source whitespace. Selected lore race controls visibility; no statistical facts are inferred.')
    for ego in inv['ego_items']:
        id = ego['description_dependency']
        if id: dependency(id, 'domain-text-data')
        bindings['ego_items'].append({'eidx': ego['eidx'], 'raw_name': ego['name'], 'description_dependency': id})
    for prop in inv['object_properties']:
        key = prop['type'] + '.' + prop['code']
        identity = {'pidx': prop['pidx'], 'type': prop['type'], 'code': prop['code'], 'type_index': prop['type_index']}
        binding = dict(identity, rune_eligible=prop['rune_eligible'], fields={})
        for field, authored_key, suffix in [('name','object_property_names','name'), ('desc','object_property_descriptions','description'), ('msg','object_property_notices','notice')]:
            if field not in prop['fields']: continue
            english = joined(prop, field)
            id = PREFIX + 'object_property.' + prop['type'] + '.' + prop['code'].lower() + '.' + suffix
            if field == 'msg' and prop['code'].startswith('SUST_'):
                id = PREFIX + 'object_property.notice.sustain_glow'
            parameters = {'name': 'KnownObjectDescription'} if field == 'msg' else {}
            binding['fields'][field] = add(id, english, authored[authored_key][key], 'object_property.' + suffix,
                prop['fields'][field], identity, parameters,
                notes='Description is a list/predicate fragment; notice is a source-selected event with an already captured object description. Preserve native punctuation and flag/knownness gates at integration.')
        for field in ['adjective', 'neg-adjective']:
            if field not in prop['fields']: continue
            id = PREFIX + 'object_property.' + prop['type'] + '.' + prop['code'].lower() + '.' + field.replace('-', '_')
            binding['fields'][field] = add(id, one(prop,field), authored['stat_adjectives'][key][field], 'stat.' + field,
                prop['fields'][field], identity, notes='Japanese predicate morphology; English source adjective remains exact. Requires the future source-selected stat event grammar, not insertion into an English sentence.')
        bindings['object_properties'].append(binding)
    for slay in inv['slays']:
        identity = {'index': slay['index'], 'code': slay['code']}
        binding = dict(identity, fields={})
        for field in ['name', 'melee-verb', 'range-verb']:
            value = one(slay,field)
            role = 'target' if field == 'name' else 'verb'
            id = PREFIX + 'slay.' + role + '.' + slug(value)
            table = authored['slay_target_names'] if role == 'target' else authored['slay_verbs']
            binding['fields'][field] = add(id, value, table[slug(value)], 'slay.' + role, slay['fields'][field], identity,
                notes='Exact source lexical role coalesced across private multiplier aliases; internal redundancy keys remain unchanged.')
        bindings['slays'].append(binding)
    for brand in inv['brands']:
        code = brand['code'].split('_')[0].lower()
        dep = dependency('element.' + code + '.name')
        assert birth_entries[dep]['english'] == one(brand, 'name')
        verb = one(brand, 'verb')
        id = add(PREFIX + 'brand.verb.' + slug(verb), verb, authored['brand_verbs'][slug(verb)], 'brand.verb',
            brand['fields']['verb'], {'index': brand['index'], 'code': brand['code']})
        bindings['brands'].append({'index': brand['index'], 'code': brand['code'], 'name_dependency': dep, 'verb_id': id,
            'name_sources': brand['fields']['name']})
    for ability in inv['player_abilities']:
        dependency(ability['name_dependency'])
        key = ability['type'] + '.' + (ability['code'] if ability['type'] != 'element' else ability['name'].lower())
        english = ability['description_english']
        parameters = {}
        if ability['type'] == 'element':
            english += ' {element}.'
            parameters = {'element': 'localized_text'}
        identity = {'source_ordinal': ability['source_ordinal'], 'type': ability['type'], 'code': ability['code'], 'value': ability.get('value')}
        add(ability['description_id'], english, authored['player_ability_descriptions'][key], 'player_ability.description',
            ability['fields']['desc'], identity, parameters, source_english=ability['description_english'],
            notes='Element prose is init.c native prefix + space + selected projection name + period. Canonical element index/value remain private; existing UI name dependencies are reused.' if parameters else '')
        if ability['type'] == 'element':
            for index, code in enumerate(inv['canonical_codes']['element']):
                dep = dependency('element.' + code.lower() + '.name')
                bindings['player_abilities'].append({'type':'element', 'type_index':index, 'code':code, 'value':ability['value'], 'name_dependency':ability['name_dependency'], 'description_id':ability['description_id'], 'description_params':{'element':{'id':dep}}, 'source_ordinal':ability['source_ordinal']})
        else:
            bindings['player_abilities'].append({'type':ability['type'], 'type_index':ability['type_index'], 'code':ability['code'], 'name_dependency':ability['name_dependency'], 'description_id':ability['description_id'], 'source_ordinal':ability['source_ordinal']})
    grammar = load(HERE / 'grammar-input.json')
    for rule in grammar['rules']:
        add(rule['id'], rule['render_en'], rule['render_ja'], rule['role'], [rule['source']],
            {'native_function':rule['native_function'], 'role':rule['role']}, rule['parameters'], rule['source_english'],
            notes='Normalized named parameters correspond to selected native printf arguments. Locale-authored grammar composes reviewed refs only; never parse completed English. Curse effect dependencies are authored Japanese predicate fragments.')
    for rule in load(HERE / 'object-info-input.json')['entries']:
        add(rule['id'], rule['render_en'], rule['render_ja'], rule['role'], rule['sources'],
            {'native_function': 'obj-info selected branch', 'role': rule['role']}, rule['parameters'],
            rule['source_english'], notes=rule['notes'])
    def pinned_source(source):
        source=dict(source)
        filename=source.get('file','')
        if filename.startswith('logic/') and any(p['upstream_file']=='src/'+filename[6:] for p in inv['sources']):
            source['upstream_file']='src/'+filename[6:]
            source['file']='migration/knowledge-text-data/producer-snapshots/'+filename[6:]
        return source
    lore_input = load(HERE / 'lore-prose-input.json')
    for category in ['entries', 'lexemes', 'whole_statements']:
        for rule in lore_input[category]:
            sources = [pinned_source(x) for x in [rule['source']] + rule.get('additional_sources', [])]
            params = {p['name']: p['type'] for p in rule['parameters']}
            add(rule['id'], rule['english'], rule['japanese'], 'lore.'+rule['section']+'.'+rule['role'], sources,
                {'native_function': rule.get('function'), 'section':rule['section'], 'role':rule['role'],
                 'identity':rule.get('identity'), 'identities':rule.get('identities'), 'format_policies':rule.get('format_policies',{})}, params,
                rule.get('original_english',rule['english']), notes=rule.get('notes',rule.get('composition','Selected canonical lore lexical/grammar role.')))
    object_input=load(HERE / 'object-prose-input.json')
    for category in ['entries','lexemes','whole_statements']:
        for rule in object_input[category]:
            sources=[pinned_source(rule['source'])]+[pinned_source(x.get('source',x)) for x in rule.get('additional_sources',[])]
            add(rule['id'],rule['english'],rule['japanese'],'object_info.'+rule['section']+'.'+rule['role'],sources,
                {'native_function':rule.get('function'),'section':rule['section'],'role':rule['role'],
                 'identity':rule.get('identity'),'original_call':rule.get('original_call'),
                 'original_calls':rule.get('original_calls'),'source_call_lines':rule.get('source_call_lines')},
                {p['name']:p['type']for p in rule['parameters']},rule.get('original_english',rule['english']),
                notes=rule.get('notes',rule.get('selection',rule.get('composition',''))))
    shape_input=load(HERE/'shape-prose-input.json')
    for rule in shape_input['entries']:
        add(rule['id'],rule['english'],rule['japanese'],'shape_lore.'+rule['role'],[rule['source']],
            {'native_function':rule['source']['function'],'role':rule['role']},rule['parameters'],rule['source_english'],notes=rule['notes'])
    add(PREFIX+'object_info.section','{section}','{section}','object_info.section',
        [{'file':'migration/knowledge-text-data/producer-snapshots/obj-info.c','upstream_file':'src/obj-info.c','line':967}],
        {'role':'source_selected_object_section'},{'section':'KnowledgeSection'},
        notes='Owned selected object knowledge facts. EN retains native leaf order; JA composes complete statements.')
    add(PREFIX+'lore.section', '{section}', '{section}', 'lore.section',
        [{'file':'migration/knowledge-text-data/producer-snapshots/mon-lore.c','upstream_file':'src/mon-lore.c','line':867}],
        {'role':'source_selected_section'}, {'section':'KnowledgeSection'},
        notes='Pure owned selected-section descriptor. EN preserves original leaf order; JA composes reviewed whole statements.')
    rune_source = 'migration/knowledge-text-data/producer-snapshots/obj-knowledge.c'
    lines = (PORT / rune_source).read_text('utf-8').splitlines()
    combat = [('to_a','enchantment to armor','防御力の強化',"Object magically increases the player's armor class",'このアイテムは魔法であなたの防御力を高める。'),
        ('to_h','enchantment to hit','命中の強化',"Object magically increases the player's chance to hit",'このアイテムは魔法であなたの命中率を高める。'),
        ('to_d','enchantment to damage','ダメージの強化',"Object magically increases the player's damage",'このアイテムは魔法であなたのダメージを高める。')]
    combat_bindings = []
    for index,(code,name,name_ja,desc,desc_ja) in enumerate(combat):
        record = {'variety':'combat','index':index,'code':code}
        for field,value,value_ja in [('name',name,name_ja),('description',desc,desc_ja)]:
            matching = [i+1 for i,s in enumerate(lines) if '"'+value+'"' in s]
            assert len(matching)==1
            id = PREFIX + 'rune.combat.' + code + '.' + field
            record[field+'_id'] = add(id,value,value_ja,'rune.combat.'+field,[{'file':rune_source,'upstream_file':'src/obj-knowledge.c','line':matching[0]}],{'variety':'combat','index':index,'code':code})
        combat_bindings.append(record)
    bindings['runes'] = {'combat':combat_bindings, 'mod':[{**{k:r[k] for k in ['type','code','type_index']},'name_id':r['fields']['name']} for r in bindings['object_properties'] if r['type'] in {'stat','mod'}],
        'resist':[{'index':i,'code':code,'name_dependency':dependency('element.'+code.lower()+'.name')} for i,code in enumerate(inv['canonical_codes']['element'][:13])],
        'brand':bindings['brands'], 'slay':bindings['slays'], 'flag':[r for r in bindings['object_properties'] if r['type']=='flag' and r['rune_eligible']],
        'curse_dependency':'migration/domain-text-data canonical curse index bindings', 'grammar':{r['role']:r['id'] for r in grammar['rules']},
        'private_order_policy':'Native init_rune order and same_monsters_slain/brand-name coalescing remain authoritative. No new rune-list ordering or knowledge checks.'}
    bindings['lore'] = {
        'append_sites': [{'id':r['id'], 'section':r['section'], 'role':r['role'], 'source':r['source'],
            'original_call':r['original_call'], 'parameters':r['parameters']} for r in lore_input['entries']],
        'lexemes': [{'id':r['id'], 'identities':r.get('identities',[r.get('identity',{})]),
            'sources':[r['source']]+r.get('additional_sources',[])} for r in lore_input['lexemes']],
        'section_contract':lore_input['section_contract'],
        'status':'source_connected_unaccepted', 'runtime_integrated':False}
    bindings['object_prose']={'append_inventory':object_input['append_inventory'],
        'origin_bindings':object_input['origin_bindings'],'section_contract':object_input['section_contract'],
        'status':'source_connected_unaccepted','runtime_integrated':False}
    bindings['shape_prose']={'source_functions':shape_input['source_functions'],
        'skill_bindings':shape_input['skill_bindings'],'spell_bindings':shape_input['spell_bindings'],
        'contract':shape_input['contract'],'status':'source_connected_unaccepted','runtime_integrated':False}
    rune_fields={r['name_id']for r in bindings['runes']['mod']}|{r['fields']['name']for r in bindings['runes']['flag']}
    no_independent_emit={'angband.knowledge.object_info.'+x for x in ['object_effect.statement_end','object_light.line_end','object_layout.properties_section_end','object_layout.effect_section_end','object_layout.combat_section_end']}
    for entry in entries.values():
        role=entry['role']
        connected=role=='monster.description' or role.startswith('lore.') or role.startswith('object_info.') or role.startswith('shape_lore.') or role in {'object_property.description','object_property.notice','player_ability.description','slay.target','rune.combat.name','rune.combat.description'} or role.startswith('rune.name.') or role.startswith('rune.description.') or entry['id']in rune_fields
        if entry['id']in no_independent_emit:connected=False
        entry['source_integrated']=connected
        entry['status']='source_connected_unaccepted' if connected else 'reviewed_binding_consumer_pending'
    manifest = {'schema_version':1, 'upstream_commit':inv['upstream_commit'], 'source_integrated':True, 'runtime_integrated':False,
        'status':'source_connected_unaccepted', 'entries':entries, 'dependencies':dependencies,
        'coverage':dict(Counter(e['role'] for e in entries.values())),
        'exclusions':{'monster_without_desc':[0], 'ego_without_desc':102, 'ego_descriptions_owned_elsewhere':5,
            'internal_fields':'All parser codes, flag/base selectors, random/dice/stat data, power/multiplier/weights and ordering remain byte-exact; inventory records context but catalogs include only display roles.',
            'other_domain_descriptions':'Objects/artifacts/egos/curses/traps/terrain/shapes are migration/domain-text-data dependencies; spell/blow/lore messages are combat-data dependencies.',
            'remaining_integration':'WASM/browser acceptance remains pending. Selected rune/ability UI and rune/notice message consumers are connected in source. All eight remaining shape-lore list/trigger compositions and introduction are now source-connected. Five object layout leaves have no independent emit. Stat gain/drain/recovery source consumers are connected by the stat owner; player-melee verb/message graph is being completed by its owner. Delegated effect_describe has a separate source owner. Runtime/WASM acceptance remains pending.'}}
    assert len(bindings['player_abilities']) == 116
    assert len(en)==len(ja)==len(entries)
    schema = {id:e['parameters'] for id,e in entries.items()}
    def literal(value): return 'NULL' if value is None else json.dumps(value,ensure_ascii=True)
    header = ['/* SPDX-License-Identifier: GPL-2.0-only */',
        '/* Generated canonical private source bindings: '+inv['upstream_commit']+'. */',
        '#ifndef ANGBAND_WEB_KNOWLEDGE_DATA_H', '#define ANGBAND_WEB_KNOWLEDGE_DATA_H',
        'static const char *const ab_knowledge_monster_ids[] = {']
    header += [' '+literal(r['description_id'])+',' for r in bindings['monster_races']]
    header += ['};','static const char *const ab_knowledge_element_ids[] = {']
    header += [' '+literal('element.'+code.lower()+'.name')+',' for code in inv['canonical_codes']['element']]
    header += ['};','static const struct { int type,index; const char *name,*desc,*notice,*adjective,*negative; } ab_knowledge_property_ids[] = {']
    types={'stat':'STAT','mod':'MOD','flag':'FLAG','ignore':'IGNORE','resistance':'RESIST','vulnerability':'VULN','immunity':'IMM'}
    for r in bindings['object_properties']:
        f=r['fields'];header.append(' {OBJ_PROPERTY_'+types[r['type']]+','+str(r['type_index'])+','+
            ','.join(literal(f.get(k)) for k in ['name','desc','msg','adjective','neg-adjective'])+'},')
    header += ['};','static const struct { const char *type; int index,value; const char *id,*element; } ab_knowledge_ability_ids[] = {']
    for r in bindings['player_abilities']:
        header.append(' {'+literal(r['type'])+','+str(r['type_index'])+','+str(r.get('value',0))+','+literal(r['description_id'])+','+
            literal(r.get('description_params',{}).get('element',{}).get('id'))+'},')
    header += ['};','static const struct { int index; const char *name,*melee,*range; } ab_knowledge_slay_ids[] = {']
    header += [' {'+str(r['index'])+','+','.join(literal(r['fields'][k]) for k in ['name','melee-verb','range-verb'])+'},' for r in bindings['slays']]
    header += ['};','static const struct { int index; const char *name,*verb; } ab_knowledge_brand_ids[] = {']
    header += [' {'+str(r['index'])+','+literal(r['name_dependency'])+','+literal(r['verb_id'])+'},' for r in bindings['brands']]
    header += ['};','static const struct { int index; const char *name,*desc; } ab_knowledge_combat_rune_ids[] = {']
    header += [' {'+str(r['index'])+','+literal(r['name_id'])+','+literal(r['description_id'])+'},' for r in bindings['runes']['combat']]
    header += ['};','static const struct { int flag; const char *id; } ab_knowledge_lore_flag_ids[] = {']
    for rule in lore_input['lexemes']:
        identity=rule.get('identity', {})
        if rule['section']=='lexeme.race_flag':
            identities=rule.get('identities',[identity])
            for item in identities:
                key=item.get('canonical_key')
                if key:header.append(' {RF_'+key+','+literal(rule['id'])+'},')
    header += ['};','static const struct { int origin,args; const char *id; } ab_knowledge_origin_ids[] = {']
    header += [' {'+r['key']+','+str(r['args'])+','+literal(r['id'])+'},'for r in object_input['origin_bindings']]
    header += ['};','static const char *const ab_knowledge_digging_ids[] = {']
    header += [' '+literal(r['id'])+',' for r in sorted((r for r in object_input['lexemes'] if r['section']=='lexeme.digging_terrain'),key=lambda r:r['identity']['native_names_index'])]
    header += ['};','static const struct { int skill; const char *id; } ab_knowledge_shape_skill_ids[] = {']
    header += [' {SKILL_'+r['code']+','+literal(r['id'])+'},' for r in shape_input['skill_bindings'] if r['code']!='UNKNOWN']
    header += ['};','static const struct { unsigned int cidx; int bidx,book_spell_index; const char *class_id,*book_id,*spell_id; } ab_knowledge_shape_spell_ids[] = {']
    header += [' {'+str(r['cidx'])+','+str(r['bidx'])+','+str(r['book_spell_index'])+','+','.join(literal(r[k]) for k in ['class_id','book_id','spell_id'])+'},' for r in shape_input['spell_bindings']]
    header += ['};','#endif','']
    return {'en.json':en,'ja.json':ja,'schema.json':schema,'source-manifest.json':manifest,'source-bindings.json':bindings,'grammar.json':grammar,
        'web-knowledge-data.h':'\n'.join(header)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    inv = inventory()
    outputs = {'inventory.json': inv, **assemble(inv)}
    if args.check:
        for name,value in outputs.items():
            actual=(HERE/name).read_text('utf-8') if isinstance(value,str) else load(HERE/name)
            assert actual==value, 'stale '+name
    else:
        for name,value in outputs.items(): write(name,value)
    print(json.dumps({"inventory_passed": True, "counts": {key: len(inv[key]) for key in
        ["monster_races", "monster_prose", "ego_items", "slays", "brands", "object_properties", "player_abilities"]}}))


if __name__ == "__main__":
    main()
