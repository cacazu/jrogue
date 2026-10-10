import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'node:test';
import {stripRecentAnnotations} from '../../tests/native-annotations.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const port=path.resolve(here,'../..');
const json=name=>JSON.parse(readFileSync(path.join(here,name),'utf8'));
const inv=json('inventory.json'), manifest=json('source-manifest.json');
const bindings=json('source-bindings.json'), en=json('en.json'), ja=json('ja.json');
const slots=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
test('all 31 pinned data, consumers and canonical enum snapshots remain byte exact',()=>{
  assert.equal(inv.sources.length,31);
  for(const s of inv.sources){
    const bytes=readFileSync(path.join(port,s.file));
    assert.equal(bytes.length,s.bytes,s.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha256,s.file);
  }
});
test('1314 bilingual fields have exact typed placeholder sets and occurrences',()=>{
  assert.equal(Object.keys(en).length,1314);
  assert.deepEqual(Object.keys(en),Object.keys(ja));
  assert.deepEqual(Object.keys(en),Object.keys(manifest.entries));
  for(const [id,e] of Object.entries(manifest.entries)){
    assert.equal(en[id],e.render_en); assert.equal(ja[id],e.render_ja);
    assert.deepEqual(slots(en[id]),slots(ja[id]),id);
    assert.deepEqual([...new Set(slots(en[id]))],Object.keys(e.parameters).sort(),id);
    if(id!=='angband.knowledge.grammar.rune.name.plain' && !e.role.startsWith('object_info.') && !e.role.startsWith('lore.') && !e.role.startsWith('shape_lore.')){
      assert.match(ja[id],/[\u3040-\u30ff\u3400-\u9fff]/u,id);
      assert.notEqual(ja[id],en[id],id);
    }
    assert.equal(typeof e.source_integrated,'boolean'); assert.equal(e.runtime_integrated,false);
  }
});
test('all 623 real monster paragraphs cover 1116 exact desc directives, including aliases',()=>{
  assert.equal(inv.monster_races.length,624);
  assert.equal(inv.monster_prose.length,606);
  assert.equal(inv.monster_races.filter(r=>r.description_id).length,623);
  assert.equal(bindings.monster_races[0].description_id,null);
  const dedup=new Map(); let lines=0;
  for(const race of inv.monster_races.slice(1)){
    const original=race.fields.desc.map(s=>s.value).join('');
    assert.equal(en[race.description_id],original,race.name);
    const entry=manifest.entries[race.description_id];
    const source=entry.associations.find(a=>a.identity.ridx===race.ridx);
    assert.ok(source); assert.deepEqual(source.sources,race.fields.desc);
    assert.equal(source.sources.map(s=>s.value).join(''),original);
    lines+=source.sources.length;
    if(dedup.has(original)) assert.equal(dedup.get(original),race.description_id);
    else dedup.set(original,race.description_id);
  }
  assert.equal(dedup.size,606); assert.equal(lines,1116);
});
test('canonical property selectors and all 198 display source fields are complete',()=>{
  let included=0;
  for(const r of inv.object_properties){
    const b=bindings.object_properties.find(b=>b.pidx===r.pidx);
    assert.equal(b.type,r.type); assert.equal(b.code,r.code); assert.equal(b.type_index,r.type_index);
    const family=['stat','mod'].includes(r.type)?'mod':r.type==='flag'?'flag':'element';
    assert.equal(inv.canonical_codes[family][r.type_index],r.code);
    for(const [role,id] of Object.entries(b.fields)){
      included++; assert.equal(en[id],r.fields[role].map(s=>s.value).join(''));
    }
  }
  assert.equal(included,132);
  const sustain=bindings.object_properties.filter(r=>r.code.startsWith('SUST_'));
  assert.equal(sustain.length,5);
  assert.equal(new Set(sustain.map(r=>r.fields.msg)).size,1);
  assert.equal(sustain[0].fields.msg,'angband.knowledge.object_property.notice.sustain_glow');
  for(const r of bindings.runes.flag) assert.ok(r.rune_eligible);
});
test('existing name and ego descriptions are dependencies, with exact source values',()=>{
  const birth=JSON.parse(readFileSync(path.join(port,'migration/birth-and-sidebar.json'),'utf8'));
  const names=new Map(birth.entries.map(e=>[e.id,e]));
  const domain=JSON.parse(readFileSync(path.join(port,'migration/domain-text-data/inventory.json'),'utf8'));
  const prose=new Map(domain.entries.map(e=>[e.id,e]));
  for(const [id,dep] of Object.entries(manifest.dependencies)){
    assert.ok(!(id in en),id);
    if(dep.owner==='migration/birth-and-sidebar.json'){
      assert.equal(dep.english,names.get(id).english); assert.equal(dep.japanese,names.get(id).japanese);
    }else assert.ok(prose.has(id),id);
  }
  const described=inv.ego_items.filter(e=>e.description_dependency);
  assert.equal(described.length,5);
  for(const e of described) assert.equal(prose.get(e.description_dependency).english,e.description_english);
  assert.equal(inv.ego_items.filter(e=>e.description_english===null).length,102);
  assert.equal(bindings.player_abilities.length,116);
  assert.equal(bindings.player_abilities.filter(a=>a.type==='element').length,75);
  for(const a of bindings.player_abilities.filter(a=>a.type==='element')){
    assert.equal(inv.canonical_codes.element[a.type_index],a.code);
    assert.equal(a.description_params.element.id,'element.'+a.code.toLowerCase()+'.name');
    assert.ok([-1,1,3].includes(a.value));
  }
});
test('source-selected rune grammar preserves six knowledge varieties and curse predicate composition',()=>{
  const grammar=json('grammar.json'); assert.equal(grammar.rules.length,11);
  for(const r of grammar.rules){
    const line=readFileSync(path.join(port,r.source.file),'utf8').split(/\r?\n/)[r.source.line-1];
    assert.ok(line.includes('"'+r.source_english+'"'),r.id);
    assert.deepEqual(slots(r.render_en),slots(r.render_ja),r.id);
  }
  assert.equal(ja['angband.knowledge.grammar.rune.description.resist'],'このアイテムはあなたの{element}耐性に影響する。');
  assert.equal(ja['angband.knowledge.grammar.rune.description.curse'],'このアイテムは{curse_effect}。');
  assert.equal(bindings.runes.resist.length,13);
  assert.equal(bindings.runes.mod.length,16);
  assert.equal(bindings.runes.combat.length,3);
  assert.equal(bindings.slays.length,11); assert.equal(bindings.brands.length,10);
});
test('reviewed mechanics, uncertainty, units, negations and proper names retain meaning',()=>{
  const lore=id=>ja[bindings.monster_races[id].description_id];
  for(const [ridx,n] of [[19,4],[23,3],[24,8],[57,6],[63,2],[78,10],[284,10],[309,12],[332,14],[359,18],[395,20],[486,25],[523,30],[550,40],[560,12]]){
    assert.match(lore(ridx),new RegExp(String(n))); assert.match(lore(ridx),ridx===57?/インチ/:/フィート/);
  }
  assert.match(lore(611),/噂/); assert.match(lore(609),/といわれている/);
  assert.match(lore(373),/わからない/); assert.match(lore(482),/動くことはできない/);
  assert.match(lore(583),/今はそうではない/);
  assert.match(lore(623),/8つ/); assert.match(lore(623),/2つ/);
  assert.match(lore(591),/クルズククルズープ/); assert.match(lore(615),/カルカロス/);
  assert.match(lore(607),/ドルジ/); assert.match(lore(299),/ミム/);
  assert.match(ja['angband.knowledge.player_ability.player.fast_shot.description'],/3レベル/);
  assert.match(ja['angband.knowledge.player_ability.player.bravery_30.description'],/レベル30/);
  assert.match(ja['angband.knowledge.player_ability.player.combat_regen.description'],/半分/);
  assert.match(ja['angband.knowledge.player_ability.player.combat_regen.description'],/失ったHPが多いほど/);
  assert.match(ja['angband.knowledge.player_ability.player.no_mana.description'],/唱えられない/);
  assert.match(ja['angband.knowledge.object_property.flag.fragile.description'],/ことがある/);
});

test('all17 object clauses carry reviewed whole-Japanese grammar and original source identities',()=>{
  const rules=json('object-info-input.json').entries;
  assert.equal(rules.length,17);
  for(const r of rules){
    assert.equal(en[r.id],r.render_en); assert.equal(ja[r.id],r.render_ja);
    assert.deepEqual(json('schema.json')[r.id],r.parameters);
    assert.ok(r.sources.length);
    for(const source of r.sources){
      const line=readFileSync(path.join(port,source.file),'utf8').split(/\r?\n/)[source.line-1];
      assert.ok(line.includes(JSON.stringify(r.source_english)),r.id+':'+source.line);
    }
  }
  assert.equal(ja['angband.knowledge.object_info.modifier.exact'],'{property}{amount}。');
  assert.equal(json('schema.json')['angband.knowledge.object_info.modifier.exact'].amount,'signed_integer');
});
test('owned selected-branch annotations reconstruct the domain-integrated obj-info byte for byte',()=>{
  const before=readFileSync(path.join(here,'integration-baseline/obj-info.c'));
  const source=readFileSync(path.join(port,'logic/obj-info.c'),'utf8');
  const native=source.replace(/\r?\n\/\* AB_KNOWLEDGE_BEGIN \*\/\r?\n[\s\S]*?\/\* AB_KNOWLEDGE_END \*\/\r?\n/g,'')
    .replace(/\/\* AB_KNOWLEDGE_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_KNOWLEDGE_INLINE_END \*\//g,'');
  assert.equal(stripRecentAnnotations(native),stripRecentAnnotations(before.toString('utf8')));
  assert.equal((source.match(/AB_KNOWLEDGE_INLINE_BEGIN/g)||[]).length,281);
  assert.equal((source.match(/AB_KNOWLEDGE_BEGIN/g)||[]).length,15);
  assert.ok(source.includes('AB_KNOWLEDGE_CAPTURE(ab_knowledge_list_weak()), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, "weak ")'));
  assert.ok(source.includes('AB_KNOWLEDGE_CAPTURE(ab_knowledge_list_powerful()), /* AB_KNOWLEDGE_INLINE_END */textblock_append(tb, " (powerfully)")'));
  const helper=readFileSync(path.join(port,'logic/web-knowledge-text.c'),'utf8');
  for(const forbidden of ['player_knows','object_flavor_is_aware','of_has(','randint','rng_'])assert.ok(!helper.includes(forbidden),forbidden);
  assert.ok(helper.includes('ab_domain_info_context()'));
  assert.ok(helper.includes('AB_UI_NESTED(name,"angband.knowledge.object_info.list.pair"'));
});

test('complete151-site lore capture preserves native branches and exact typed source arguments',()=>{
  const proof=json('lore-integration-proof.json'), input=json('lore-prose-input.json');
  assert.equal(proof.append_count,151);assert.equal(input.entries.length,151);
  const source=readFileSync(path.join(port,'logic/mon-lore.c'),'utf8');
  const native=source.replace(/\r?\n\/\* AB_KNOWLEDGE_BEGIN \*\/\r?\n[\s\S]*?\/\* AB_KNOWLEDGE_END \*\/\r?\n/g,'')
    .replace(/\/\* AB_KNOWLEDGE_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_KNOWLEDGE_INLINE_END \*\//g,'');
  assert.equal(stripRecentAnnotations(native),stripRecentAnnotations(readFileSync(path.join(here,'integration-baseline/mon-lore.c'),'utf8')));
  for(const e of input.entries){
    assert.ok(source.includes(JSON.stringify(e.id)),e.id);
    assert.equal(proof.append_connections.filter(c=>c.id===e.id).length,1,e.id);
    assert.deepEqual(slots(en[e.id]),e.parameters.map(p=>p.name).sort(),e.id);
  }
  const mappings=bindings.lore.lexemes.filter(r=>r.id.includes('.race_flag.'));
  assert.equal(mappings.length,43);assert.equal(mappings.flatMap(r=>r.identities).length,45);
  assert.equal(mappings.find(r=>r.id.endsWith('.fire')).identities.length,2);
});
test('message and UI rune consumers share one actual getter capture and fail closed on mismatch',()=>{
  const helper=readFileSync(path.join(port,'logic/web-knowledge-text.c'),'utf8');
  assert.match(helper,/ab_knowledge_param_last_rune\(struct ab_semantic_event \*event/);
  assert.match(helper,/last_rune\.oid!=oid \|\| last_rune\.description!=description/);
  assert.match(helper,/last_rune\.valid=false;/);
  const consume=helper.slice(helper.indexOf('void ab_knowledge_param_last_rune'),helper.indexOf('const char *ab_knowledge_element_id'));
  assert.ok(consume.includes('ab_knowledge_take_rune'));
  assert.ok(consume.includes('event->valid=false'));
  assert.ok(consume.includes('knowledge_value(event,&value,0)'));
  for(const forbidden of ['rune_name(','rune_desc(','player_knows','randint'])assert.ok(!consume.includes(forbidden));
});

test('all119 object append calls are classified and all135 new bilingual roles preserve exact source slots',()=>{
  const input=json('object-prose-input.json'), proof=json('object-prose-integration-proof.json');
  const pristine=readFileSync(path.join(here,'producer-snapshots/obj-info.c'),'utf8');
  assert.equal(input.append_inventory.length,119);
  assert.equal(input.append_inventory.filter(r=>r.status==='excluded_owned_elsewhere').length,37);
  for(const row of input.append_inventory){
    assert.ok(pristine.includes(row.original_call),String(row.source.line));
    assert.ok(pristine.split(/\r?\n/)[row.source.line-1].includes(row.original_call.split(/\r?\n/)[0]));
  }
  const rules=[...input.entries,...input.lexemes,...input.whole_statements];assert.equal(rules.length,135);
  for(const rule of rules){
    assert.equal(en[rule.id],rule.english);assert.equal(ja[rule.id],rule.japanese);
    assert.deepEqual(slots(en[rule.id]),slots(ja[rule.id]));
  }
  assert.equal(proof.connected_remaining_append_count,77);
  assert.equal(new Set(proof.connections.map(r=>r.source_line)).size,77);
  assert.equal(proof.unemitted_layout_roles.length,5);
});
test('grouped range, breakage and intensity capture their original arguments at their native closing calls',()=>{
  const input=json('object-prose-input.json');
  const groups=input.whole_statements.filter(r=>r.direct_statement);assert.equal(groups.length,3);
  for(const group of groups){
    assert.equal(group.emit_after_source_line,group.original_calls.at(-1).line);
    for(const parameter of group.parameters){
      const call=group.original_calls[parameter.argument_call];
      assert.equal(call.arguments[parameter.argument_index],parameter.original_argument);
    }
  }
  const source=readFileSync(path.join(port,'logic/obj-info.c'),'utf8');
  const helper=readFileSync(path.join(port,'logic/web-knowledge-text.c'),'utf8');
  assert.ok(source.includes('AB_KNOWLEDGE_ORIGIN_ARTICLE('));
  assert.equal((source.match(/is_a_vowel\(dropper\[0\]\)/g)||[]).length,1);
  for(const query of ['obj_known_damage(','o_obj_known_damage(','obj_known_blows(','obj_known_digging(','obj_known_effect(','turn_energy(','calc_bonuses('])assert.ok(!helper.includes(query),query);
  assert.ok(helper.includes('ab_domain_info_event_begin(&section_event,"angband.knowledge.object_info.section")'));
});
test('private origin aliases coalesce and all fixed race names fit the original80byte name buffer',()=>{
  const input=json('object-prose-input.json');assert.equal(input.origin_bindings.length,26);
  const visible=input.origin_bindings.filter(r=>r.visible);assert.equal(visible.length,22);
  assert.equal(new Set(visible.filter(r=>r.args===2).map(r=>r.id)).size,1);
  for(const race of inv.monster_races){assert.ok(Buffer.byteLength(race.name)+3+1<80,race.name);}
  const b=bindings.object_prose;assert.deepEqual(b.origin_bindings,input.origin_bindings);
});

test('all shape prose roles bind exact pinned source and ordinary typed refs',()=>{
  const shape=json('shape-prose-input.json');
  assert.equal(shape.entries.length,25);
  assert.equal(shape.spell_bindings.length,163);
  assert.deepEqual(shape.contract.new_empty_ids,[]);
  assert.equal(shape.contract.new_descriptor,false);
  for(const e of shape.entries){
    const source=readFileSync(path.join(port,e.source.file),'utf8').replace(/\r\n/g,'\n');
    assert.ok(source.includes(e.source.exact_source),e.id);
    assert.ok(source.split('\n')[e.source.line-1].includes(e.source.exact_source.split('\n')[0]),e.id);
    assert.equal(en[e.id],e.english);assert.equal(ja[e.id],e.japanese);
    assert.deepEqual(slots(e.english),slots(e.japanese),e.id);
    assert.deepEqual([...new Set(slots(e.english))],Object.keys(e.parameters).sort(),e.id);
  }
  const character=JSON.parse(readFileSync(path.join(port,'migration/character-data/source-manifest.json'),'utf8'));
  const names=new Map(character.entries.map(e=>[e.id,e]));
  for(const b of shape.spell_bindings){
    assert.equal(names.get(b.spell_id).identity.cidx,b.cidx);
    assert.equal(names.get(b.spell_id).identity.bidx,b.bidx);
    assert.equal(names.get(b.spell_id).identity.book_spell_index,b.book_spell_index);
    assert.equal(names.get(b.book_id).identity.bidx,b.bidx);
    assert.equal(names.get(b.class_id).identity.cidx,b.cidx);
  }
});
test('shape additions preserve multi-owner native bytes and every previous catalog value',()=>{
  const proof=json('shape-prose-integration-proof.json');
  assert.equal(proof.existing_1289_values_unchanged,true);
  assert.equal(proof.native_byte_reconstruction,true);
  const before=readFileSync(path.join(port,proof.ui_before_file),'utf8');
  const current=readFileSync(path.join(port,'logic/ui-knowledge.c'),'utf8');
  assert.equal(createHash('sha256').update(before).digest('hex'),proof.before_sha256);
  assert.equal(stripRecentAnnotations(current),stripRecentAnnotations(before));
  assert.match(current,/AB_KNOWLEDGE_SHAPE_NUMBER\(&ab_shape/);
  assert.equal((current.match(/AB_KNOWLEDGE_SHAPE_NUMBER\(&ab_shape/g)||[]).length,6);
  assert.match(current,/ab_knowledge_shape_spell\(c->cidx,ibook,ispell\)/);
  assert.match(current,/effect->subtype == s->sidx/);
  assert.match(readFileSync(path.join(port,'logic/web-knowledge-text.c'),'utf8'),/AB_UI_SIGN\("amount",item->amount\)/);
});
test('canonical Japanese corpus has valid text and exact manifest mapping',()=>{
  for(const [id,text]of Object.entries(ja)){
    assert.ok(!text.includes('\uFFFD'),id);
    assert.equal(manifest.entries[id].render_ja,text,id);
  }
  const proof=json('static-ja-unicode-proof.json');
  assert.equal(proof.replacement_codepoints,0);
  assert.ok(proof.catalogs.length>=5);
  for(const row of proof.catalogs){
    const bytes=readFileSync(path.join(port,row.file));
    if(row.file==='migration/knowledge-text-data/ja.json') assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,row.file); // Other owners may legitimately regenerate their dictionaries.
    assert.ok(!bytes.toString('utf8').includes('\uFFFD'),row.file);
  }
});
