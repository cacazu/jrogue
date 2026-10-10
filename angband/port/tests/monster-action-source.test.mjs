import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripRecentAnnotations} from './native-annotations.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const port=path.resolve(here,'..');
const dir=path.join(port,'migration/monster-action-message-data');
const read=f=>readFileSync(path.join(port,f),'utf8');
const json=f=>JSON.parse(readFileSync(path.join(dir,f),'utf8'));
const en=json('en.json'),ja=json('ja.json'),schema=json('schema.json'),manifest=json('source-manifest.json');
const slots=s=>[...s.matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort();
const reconstruct=s=>s.replace(/\/\* AB_MON_ACTION_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_MON_ACTION_INLINE_END \*\//g,'')
 .replace(/\/\* AB_MON_ACTION_BEGIN \*\/[\s\S]*?\/\* AB_MON_ACTION_END \*\//g,'');

test('39 reviewed bilingual templates retain exact declared named facts',()=>{
 assert.equal(Object.keys(en).length,39);
 assert.deepEqual(Object.keys(en).sort(),Object.keys(ja).sort());
 assert.deepEqual(Object.keys(en).sort(),Object.keys(schema.entries).sort());
 for(const[id,shape]of Object.entries(schema.entries)){
  const parameters=shape.parameters.map(p=>p.name).sort();
  assert.deepEqual(slots(en[id]),parameters,id+' English');assert.deepEqual(slots(ja[id]),parameters,id+' Japanese');
 }
 assert.equal(schema.entries['angband.monster_action.death.dies'].parameters[0].type,'CapitalizedMonsterDescription');
});

test('all ten original formatted producers have authored callsite provenance',()=>{
 assert.deepEqual(manifest.reviewed_source_indices,[98,99,111,125,136,137,172,173,176,177]);
 assert.equal(manifest.source_callsites.length,10);
 for(const call of manifest.source_callsites){
  const baseline=readFileSync(path.join(dir,'source-baseline',path.basename(call.source.file)),'utf8');
  assert.ok(baseline.includes(call.original_call),call.source.file+':'+call.source.upstream_line);
  assert.ok(call.semantic_ids.length>0);
  assert.ok(call.semantic_ids.every(id=>Object.hasOwn(en,id)));
 }
 assert.equal(manifest.complete_game_translation,false);
});

test('all six engine files retain every accepted byte when only additive annotations are removed',()=>{
 const baseline=json('integration-baseline.json');
 assert.equal(Object.keys(baseline.files).length,6);
 for(const [name,facts]of Object.entries(baseline.files)){
  const bytes=readFileSync(path.join(dir,'source-baseline',name));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),facts.sha256);
  assert.equal(bytes.length,facts.bytes);
  assert.equal(stripRecentAnnotations(reconstruct(read('logic/'+name))),stripRecentAnnotations(bytes.toString('utf8')),name);
 }
});

test('all original attack-effect death notes bind their exact source role and existing visible damage fact',()=>{
 const effects=read('logic/effect-handler-attack.c'),helper=read('logic/web-monster-action-message.c');
 assert.match(effects,/AB_MON_ACTION_LITERAL_NOTE\(AB_MON_ACTION_DESTROYED_EXCLAIM,[\s\S]{0,60}" is destroyed!"/);
 assert.match(effects,/AB_MON_ACTION_LITERAL_NOTE\(AB_MON_ACTION_DRAINED_DRY,[\s\S]{0,60}" is drained dry!"/);
 assert.match(effects,/AB_MON_ACTION_CURSE_NOTE\(display_dam,dam,[\s\S]{0,60}passed_note/);
 assert.equal((effects.match(/ab_mon_action_note_end\(\)/g)||[]).length,3);
 assert.match(effects,/if \(display_dam\) \{[\s\S]*?strnfmt\(note, sizeof\(note\), " dies! \(%d\)", dam\);[\s\S]*?passed_note = note;[\s\S]*?passed_note = " dies!";/);
 assert.match(helper,/displayed\?AB_MON_ACTION_DIES_DAMAGE_EXCLAIM:AB_MON_ACTION_DIES_EXCLAIM/);
 assert.match(helper,/if\(displayed && note_depth && note_depth<=N_ELEMENTS\(notes\)\)notes\[note_depth-1\]\.damage=damage/);
 assert.match(helper,/if\(selected && selected->selected==AB_MON_ACTION_DIES_DAMAGE_EXCLAIM\)integer\(&e,"damage",selected->damage\)/);
 const prefix='angband.monster_action.death.';
 for(const role of ['destroyed_exclaim','dies_exclaim','dies_exclaim_damage','drained_dry'])assert.ok(Object.hasOwn(en,prefix+role));
 assert.equal(en[prefix+'dies_exclaim_damage'],'{actor} dies! ({damage})');
 assert.equal(schema.entries[prefix+'dies_exclaim_damage'].parameters[1].type,'integer');
 assert.equal(manifest.additional_selector_sources.filter(s=>s.file==='src/effect-handler-attack.c').length,3);
 assert.equal(manifest.note_source_bindings.length,4);
 for(const source of manifest.note_source_bindings){
  const baseline=readFileSync(path.join(dir,'source-baseline',path.basename(source.source.file)),'utf8');
  assert.ok(baseline.includes(source.original_call),source.function);
  assert.ok(source.semantic_ids.every(id=>Object.hasOwn(en,id)),source.function);
 }
});

test('ranged lexical provenance follows original winning source assignments and transfer before free',()=>{
 const attack=read('logic/player-attack.c'),slays=read('logic/obj-slays.c'),helper=read('logic/web-monster-action-message.c');
 assert.match(slays,/my_strcpy\(verb, b->verb, 20\);[\s\S]{0,140}ab_mon_action_verb_brand\(verb,i,range\)/);
 assert.match(slays,/my_strcpy\(verb, s->range_verb, 20\);[\s\S]{0,140}ab_mon_action_verb_slay\(verb,i,range\)/);
 assert.equal((slays.match(/if \(best_mult < mult\)/g)||[]).length,2);
 const copy=attack.indexOf('my_strcpy(hit_verb, result.hit_verb, sizeof(hit_verb))');
 const transfer=attack.indexOf('ab_mon_action_verb_transfer(hit_verb,result.hit_verb)',copy);
 const free=attack.indexOf('mem_free(result.hit_verb)',copy);
 assert.ok(copy<transfer&&transfer<free);
 assert.equal((attack.match(/ab_mon_action_verb_init\(hit_verb\)/g)||[]).length,2);
 assert.match(attack,/my_strcpy\(hit_verb, "fails to harm", sizeof\(hit_verb\)\);[\s\S]{0,140}ab_mon_action_verb_fails\(hit_verb\)/);
 assert.match(helper,/ab_knowledge_brand_id\(selected->index,true\)/);
 assert.match(helper,/ab_knowledge_slay_id\(selected->index,2\)/);
 assert.doesNotMatch(helper,/strcmp\([^\n]*(?:native_buffer|buffer|actor|object|target|note|hit_verb)/);
 assert.match(helper,/ab_mon_action_verb_forget\(source\)/);
});

test('original selected note and capitalization are source facts, while project note branch remains intact',()=>{
 const attack=read('logic/player-attack.c'),util=read('logic/mon-util.c'),helper=read('logic/web-monster-action-message.c');
 assert.match(attack,/AB_MON_ACTION_DESTROYED_VALUE\(&ab_note_kind,[\s\S]{0,60}monster_is_destroyed\(mon\)/);
 const start=attack.indexOf('ab_mon_action_note_begin(note_dies,ab_note_kind)');
 const damage=attack.indexOf('if (!mon_take_hit(mon, p, dmg, &fear, note_dies))',start);
 const end=attack.indexOf('ab_mon_action_note_end()',damage);
 assert.ok(start<damage&&damage<end);
 assert.match(util,/AB_MON_ACTION_ARENA_NOTE\([\s\S]{0,60}" is defeated!"/);
 assert.match(util,/if \(strlen\(note\) <= 1\)/);
 assert.match(util,/my_strcap\(m_name\);[\s\S]{0,170}AB_MON_ACTION_DEATH\(&ab_death_actor,note,soundfx\)/);
 const first=util.indexOf('ab_mon_action_actor_capture(&ab_death_actor,m_name)');
 const notice=util.indexOf('notice_stuff(p)',first);
 assert.ok(first<notice,'owned original descriptor precedes possible cache churn');
 assert.ok(helper.includes('\\"schema_version\\":2,\\"subject\\":'));
 assert.ok(helper.includes('\\"capitalize\\":true'));
 assert.match(helper,/notes\[note_depth-1\]\.pointer==note/);
 assert.doesNotMatch(helper,/strlen\(note\)|strcmp\(note|strstr\(note/);
});

test('single original gear label and visibility decisions are preserved before consuming calls',()=>{
 const blows=read('logic/mon-blows.c'),attack=read('logic/player-attack.c'),helper=read('logic/web-monster-action-message.c');
 assert.match(blows,/AB_MON_ACTION_LABEL\(o_name,split,[\s\S]{0,60}gear_to_label\(context->p, obj\)/);
 const label=blows.indexOf('AB_MON_ACTION_LABEL(o_name,split,');
 assert.ok(label<blows.indexOf('stolen = gear_object_for_use',label));
 assert.match(helper,/ab_mon_action_stolen_label\(const char \*object,bool split,int native_label\)/);
 assert.match(helper,/return native_label/);
 assert.match(attack,/dmg_text = format\(" \(%d\)", dmg\);[\s\S]{0,140}ab_show_damage=true/);
 assert.match(helper,/if\(show_damage\)integer\(&e,"damage",damage\)/);
 assert.doesNotMatch(helper,/Rand_|randint|monster_desc\(|object_desc\(|gear_to_label\(|monster_is_|react_to_slay\(|improve_attack_modifier\(/);
});

test('quality comes from original reviewed static table identity; no extra gameplay lookup',()=>{
 const attack=read('logic/player-attack.c'),helper=read('logic/web-monster-action-message.c');
 assert.match(attack,/ranged_hit_types\[\] = \{[\s\S]*?MSG_HIT_GOOD, "It was a good hit!"[\s\S]*?MSG_HIT_GREAT, "It was a great hit!"[\s\S]*?MSG_HIT_SUPERB, "It was a superb hit!"/);
 assert.equal((attack.match(/ranged_helper\(player, obj, dir, range, shots, attack, ranged_hit_types/g)||[]).length,2);
 assert.match(helper,/quality==2\)quality_id=AB_MON_ACTION_ID\("quality.good_hit"\)/);
 assert.match(helper,/quality==3\)quality_id=AB_MON_ACTION_ID\("quality.great_hit"\)/);
 assert.match(helper,/quality==4\)quality_id=AB_MON_ACTION_ID\("quality.superb_hit"\)/);
});

test('actual melee sinks retain both native branches and the original visible damage evaluation once',()=>{
 const source=read('logic/player-attack.c');
 const body=source.slice(source.indexOf('bool py_attack_real('),source.indexOf('static bool attempt_shield_bash'));
 assert.equal((body.match(/AB_MON_ACTION_MELEE\(/g)||[]).length,2);
 assert.match(body,/AB_MON_ACTION_MELEE\(&ab_melee_actor,verb,\(int\)i,ab_melee_show_damage,dmg,msg_type\)/);
 assert.match(body,/if \(OPT\(p, show_damage\)\)\s*dmg_text = \/\* AB_MON_ACTION_INLINE_BEGIN \*\/AB_MON_ACTION_DAMAGE\(&ab_melee_show_damage,[\s\S]{0,75}format\(" \(%d\)", dmg\)/);
 assert.equal((body.match(/format\(" \(%d\)", dmg\)/g)||[]).length,1);
 const first=body.indexOf('monster_desc(m_name, sizeof(m_name), mon, MDESC_TARG)');
 const freeze=body.indexOf('ab_mon_action_actor_capture(&ab_melee_actor,m_name)');
 assert.ok(first<freeze&&freeze<body.indexOf('monster_race_track'));
 assert.equal(manifest.melee_coverage.consumer_capitalization,false);
});

test('melee metadata follows every original winning branch and final shape or no-damage override',()=>{
 const source=read('logic/player-attack.c'),slays=read('logic/obj-slays.c'),helper=read('logic/web-monster-action-message.c');
 const body=source.slice(source.indexOf('bool py_attack_real('),source.indexOf('static bool attempt_shield_bash'));
 assert.match(body,/my_strcpy\(verb, "punch", sizeof\(verb\)\);[\s\S]{0,130}ab_mon_action_verb_melee_init\(verb,false\)/);
 assert.match(body,/my_strcpy\(verb, "hit", sizeof\(verb\)\);[\s\S]{0,130}ab_mon_action_verb_melee_init\(verb,true\)/);
 assert.match(slays,/my_strcpy\(verb, s->melee_verb, 20\);[\s\S]{0,130}ab_mon_action_verb_slay\(verb,i,range\)/);
 assert.equal((helper.match(/slot && slot->range==range/g)||[]).length,2);
 const modifier=body.lastIndexOf('improve_attack_modifier('),shape=body.indexOf('ab_mon_action_verb_shape(verb,p->shape->sidx,ab_melee_shape_choice)'),failure=body.indexOf('ab_mon_action_verb_fails(verb)');
 assert.ok(modifier<shape&&shape<failure);
 assert.match(helper,/ab_knowledge_slay_id\(selected->index,1\)/);
 assert.match(helper,/ab_domain_id\(AB_DOMAIN_SHAPE,selected->index,AB_DOMAIN_BLOW,selected->shape_slot\)/);
});

test('all 29 original shape choices retain runtime reversed-list identity without a second random draw',()=>{
 const source=read('logic/player-attack.c'),bindings=manifest.melee_coverage.shape_bindings;
 const body=source.slice(source.indexOf('bool py_attack_real('),source.indexOf('static bool attempt_shield_bash'));
 assert.equal((body.match(/randint0\(p->shape->num_blows\)/g)||[]).length,1);
 assert.match(body,/AB_MON_ACTION_CHOICE\(&ab_melee_shape_choice,[\s\S]{0,65}randint0\(p->shape->num_blows\)/);
 assert.match(body,/while \(choice--\) \{\s*blow = blow->next;/);
 assert.equal(bindings.length,29);
 const groups=Map.groupBy(bindings,b=>b.sidx);assert.equal(groups.size,8);
 for(const group of groups.values()){
  assert.deepEqual(group.map(b=>b.runtime_blow_ordinal).sort((a,b)=>a-b),Array.from({length:group.length},(_,i)=>i));
  for(const b of group)assert.equal(b.runtime_blow_ordinal,group.length-1-b.source_blow_ordinal);
 }
 assert.equal(manifest.melee_coverage.source_selected_lexemes.length,41);
 assert.equal(new Set(manifest.melee_coverage.source_selected_lexemes.map(b=>b.id)).size,41);
});

test('melee owns and releases descriptor and verb facts at both early returns and before mutable side effects',()=>{
 const source=read('logic/player-attack.c'),helper=read('logic/web-monster-action-message.c');
 const body=source.slice(source.indexOf('bool py_attack_real('),source.indexOf('static bool attempt_shield_bash'));
 assert.equal((body.match(/ab_mon_action_actor_release\(&ab_melee_actor\)/g)||[]).length,3);
 assert.equal((body.match(/ab_mon_action_verb_forget\(verb\)/g)||[]).length,3);
 const release=body.lastIndexOf('ab_mon_action_actor_release(&ab_melee_actor)');
 assert.ok(release<body.indexOf('blow_side_effects(p, mon)')&&release<body.indexOf('mon_take_hit(mon'));
 for(const position of [...body.matchAll(/return false;/g)].map(m=>m.index))
  assert.match(body.slice(position-220,position),/ab_mon_action_actor_release\(&ab_melee_actor\);\s*ab_mon_action_verb_forget\(verb\);/);
 assert.match(helper,/ab_naming_param_snapshot\(&e,"target","MonsterDescription",target\?&target->snapshot:NULL\)/);
 assert.match(helper,/Empty unknown reference is deliberately rejected by Rust/);
});

test('all five original melee critical qualities and authored Japanese case forms are enumerated',()=>{
 const source=read('logic/player-attack.c'),helper=read('logic/web-monster-action-message.c');
 assert.match(source,/MSG_HIT_HI_GREAT, "It was a \*GREAT\* hit!"/);
 assert.match(source,/MSG_HIT_HI_SUPERB, "It was a \*SUPERB\* hit!"/);
 for(const [i,role]of [[2,'good_hit'],[3,'great_hit'],[4,'superb_hit'],[5,'high_great_hit'],[6,'high_superb_hit']])
  assert.ok(helper.includes(`quality==${i})quality_id=AB_MON_ACTION_ID("quality.${role}")`));
 const byId=new Map(manifest.melee_coverage.source_selected_lexemes.map(b=>[b.id,b.grammar]));
 for(const role of ['shock','poison','zap'])assert.equal(byId.get('angband.knowledge.brand.verb.'+role),'angband.monster_action.grammar.melee_to');
 assert.equal(byId.get('angband.knowledge.brand.verb.sicken'),'angband.monster_action.grammar.melee_possessive');
 for(const b of manifest.melee_coverage.shape_bindings)
  assert.equal(byId.get(b.id),'angband.monster_action.grammar.melee_'+(b.original_english==='bite'?'to':'transitive'));
});

test('ranged brand case correction reuses frozen canonical identities and preserves all 37 earlier bilingual values',()=>{
 const previous=json('catalog-before-ranged-cases.json'),helper=read('logic/web-monster-action-message.c');
 assert.equal(Object.keys(previous.en).length,37);
 for(const[id,value]of Object.entries(previous.en))assert.equal(en[id],value,id);
 for(const[id,value]of Object.entries(previous.ja))assert.equal(ja[id],value,id);
 const prefix='angband.monster_action.grammar.';
 for(const role of ['to','possessive']){
  assert.equal(en[prefix+'ranged_brand_'+role],en[prefix+'ranged_brand']);
  assert.deepEqual(schema.entries[prefix+'ranged_brand_'+role].parameters,[{name:'verb',type:'localized_text'}]);
  assert.deepEqual(schema.entries[prefix+'ranged_brand_'+role].source_indices,[176,177]);
 }
 assert.equal(ja[prefix+'ranged_brand_to'],'に{verb}');
 assert.equal(ja[prefix+'ranged_brand_possessive'],'の{verb}');
 const correction=manifest.ranged_case_correction;
 assert.equal(correction.native_source_changed,false);assert.equal(correction.english_templates_unchanged,true);
 assert.equal(Object.keys(correction.selected_canonical_verbs).length,4);
 for(const role of ['shock','poison','zap'])assert.equal(correction.selected_canonical_verbs['angband.knowledge.brand.verb.'+role],prefix+'ranged_brand_to');
 assert.equal(correction.selected_canonical_verbs['angband.knowledge.brand.verb.sicken'],prefix+'ranged_brand_possessive');
 assert.match(helper,/lexeme=ab_knowledge_brand_id\(selected->index,true\);id=ranged_brand_grammar\(lexeme\)/);
 assert.match(helper,/const char \*selected=melee_grammar\(lexeme\);/);
 assert.doesNotMatch(helper,/strcmp\([^\n]*(?:native_buffer|buffer|actor|object|target|note|hit_verb)/);
});
