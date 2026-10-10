import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {functionSpan,stripStat} from '../migration/stat-message-data/integrate.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read('migration/stat-message-data/'+file));
const en=json('en.json'),ja=json('ja.json'),schema=json('schema.json'),manifest=json('source-manifest.json'),bindings=json('source-bindings.json');
const snapshots=json('producer-snapshots.json').snapshots;
const helper=read('logic/web-stat-message.c');
const current=new Map(snapshots.map(v=>[v.file,read(v.file)]));
const body=(file,name)=>{const text=current.get(file);const[a,b]=functionSpan(text,name);return text.slice(a,b);};
const placeholders=text=>[...new Set([...text.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map(v=>v[1]))].sort();
test('all14 original producer functions retain every exact native byte and call',()=>{
 assert.equal(snapshots.length,14);assert.equal(manifest.producers.length,16);
 for(const snapshot of snapshots){
  const native=Buffer.from(snapshot.native_base64,'base64');
  assert.equal(crypto.createHash('sha256').update(native).digest('hex'),snapshot.sha256);
  assert.deepEqual(Buffer.from(stripStat(body(snapshot.file,snapshot.function))),native,snapshot.function);
 }
 const calls=[...current.values()].reduce((n,s)=>n+[...s.matchAll(/\/\* AB_STAT_MESSAGE_BEGIN \*\/AB_STAT_MESSAGE\(/g)].length,0);
 assert.equal(calls,16);
 for(const producer of manifest.producers){
  const source=stripStat(body(producer.source.file,producer.source.function));
  assert.ok(source.includes(producer.original_english),String(producer.source_index));
 }
});
test('111 bilingual templates have exact declared named parameters and source provenance',()=>{
 assert.equal(Object.keys(en).length,111);
 assert.deepEqual(Object.keys(en).sort(),Object.keys(ja).sort());
 assert.deepEqual(Object.keys(en).sort(),Object.keys(schema.entries).sort());
 for(const [id,entry]of Object.entries(schema.entries)){
  const names=entry.parameters.map(v=>v.name).sort();
  assert.deepEqual(placeholders(en[id]),names,id+' EN');assert.deepEqual(placeholders(ja[id]),names,id+' JA');
  assert.ok(entry.sources.length,id+' provenance');
  assert.ok((['game.stat.damage.quake.empty','game.stat.damage.quake.empty.with_damage'].includes(id)&&ja[id]===en[id])||
   /[\u3040-\u30ff\u3400-\u9fff]/u.test(ja[id]),id+' Japanese');
 }
 assert.equal(schema.complete_game_translation,false);
 assert.equal(schema.status,'source_connected_unbuilt');
});
test('canonical stat property polarity differs explicitly from projected bright/agile/hale words',()=>{
 const stats=[...read('logic/list-stats.h').matchAll(/^STAT\(([^)]+)\)/gm)].map(v=>v[1]);
 assert.deepEqual(bindings.stats.map(v=>v.code),stats);
 assert.deepEqual(bindings.stats.map(v=>v.index),[0,1,2,3,4]);
 assert.deepEqual(bindings.stats.map(v=>en[v.positive_id]),['strong','smart','wise','dextrous','healthy']);
 assert.deepEqual(bindings.stats.map(v=>en[v.negative_id]),['weak','stupid','naive','clumsy','sickly']);
 assert.deepEqual(bindings.stats.map(v=>en[v.project_id]),['strong','bright','wise','agile','hale']);
 const property=read('data/gamedata/object_property.txt').split(/\r?\n/);
 for(const lexeme of manifest.lexemes.filter(v=>v.source.file.endsWith('object_property.txt')))
  assert.equal(property[lexeme.source.line-1],lexeme.source.field+':'+lexeme.english);
});
test('all56 projection types use canonical enum order and hidden blind lexemes share identities',()=>{
 const canonical=[...read('logic/list-elements.h').matchAll(/^ELEM\(([^)]+)\)/gm),...read('logic/list-projections.h').matchAll(/^PROJ\(([^)]+)\)/gm)].map(v=>v[1]);
 assert.equal(bindings.projections.length,56);assert.deepEqual(bindings.projections.map(v=>v.code),canonical);
 assert.deepEqual(bindings.projections.map(v=>v.index),Array.from({length:56},(_,i)=>i));
 assert.ok(bindings.projections.find(v=>v.code==='AWAY_SPIRIT').index<bindings.projections.find(v=>v.code==='AWAY_EVIL').index);
 const ids=new Map();
 for(const projection of bindings.projections){
  const word=en[projection.blind_id];if(ids.has(word))assert.equal(projection.blind_id,ids.get(word));else ids.set(word,projection.blind_id);
 }
 assert.equal(new Set(bindings.projections.filter(v=>en[v.blind_id]==='something').map(v=>v.blind_id)).size,1);
 const data=read('data/gamedata/projection.txt').split(/\r?\n/);
 for(const entry of Object.values(schema.entries))for(const source of entry.sources)if(source.file.endsWith('projection.txt'))
  assert.equal(data[source.line-1],source.field+':'+source.value);
 const projectionFunction=helper.slice(helper.indexOf('void ab_stat_projection('),helper.indexOf('void ab_stat_summon('));
 assert.doesNotMatch(projectionFunction,/json_int32|number\(/,'private projection index never crosses the event');
});
test('damage amount is gated by the exact winning native formatting predicate rather than completed text',()=>{
 for(const [file,name]of [['logic/effect-handler-attack.c','effect_handler_EARTHQUAKE'],['logic/effect-handler-general.c','uncurse_object'],
  ['logic/effect-handler-general.c','effect_handler_DRAIN_STAT'],['logic/player-util.c','player_over_exert']]){
  const source=body(file,name),predicates=[...source.matchAll(/if \((?:dam|damage) > 0 && OPT\((?:player|p), show_damage\)\) \{/g)];
  assert.ok(predicates.length);
  assert.equal((source.match(/ab_stat_damage_shown=true;/g)??[]).length,predicates.length,name);
  for(const predicate of predicates)assert.match(source.slice(predicate.index,predicate.index+230),/AB_STAT_MESSAGE_BEGIN[\s\S]*?ab_stat_damage_shown=true;/);
 }
 assert.doesNotMatch(helper,/dam_text|hurt_msg|strstr|sscanf|atoi|OPT\s*\(/);
 assert.equal((helper.match(/if\(shown\)number\(&event,"damage",damage\)/g)??[]).length,3);
 for(const id of ['game.stat.message.drain','game.stat.damage.crushed','game.stat.damage.uncursing','game.stat.damage.exertion',
  'game.stat.damage.quake.dodge','game.stat.damage.quake.rubble','game.stat.damage.quake.squeezed']){
  assert.equal(schema.entries[id].parameters.some(v=>v.name==='damage'),false);
  assert.equal(schema.entries[id+'.with_damage'].parameters.some(v=>v.name==='damage'),true);
 }
});
test('courage holds immediate immutable descriptors across original heal feedback and releases once',()=>{
 for(const name of ['effect_handler_MON_HEAL_HP','effect_handler_MON_HEAL_KIN']){
  const source=body('logic/effect-handler-attack.c',name);
  assert.equal((source.match(/monster_desc\(m_name/g)??[]).length,1);
  assert.equal((source.match(/monster_desc\(m_poss/g)??[]).length,1);
  const actor=source.indexOf('monster_desc(m_name'),possessive=source.indexOf('monster_desc(m_poss');
  assert.ok(source.indexOf('ab_naming_copy_monster_snapshot(&ab_stat_actor')>actor);
  assert.ok(source.indexOf('ab_naming_copy_monster_snapshot(&ab_stat_actor')<possessive);
  assert.ok(source.indexOf('ab_naming_copy_monster_snapshot(&ab_stat_possessive')>possessive);
  assert.equal((source.match(/ab_naming_snapshot_release\(&ab_stat_actor\)/g)??[]).length,1);
  assert.equal((source.match(/ab_naming_snapshot_release\(&ab_stat_possessive\)/g)??[]).length,1);
  assert.ok(source.indexOf('ab_stat_courage')<source.indexOf('msg("%s recovers %s courage."'));
  assert.ok(source.lastIndexOf('if (!mon) return true;')<source.indexOf('struct ab_naming_snapshot'));
 }
 assert.doesNotMatch(helper,/cave_monster|monster_desc|monster_is_visible|mon->|hp->/);
});
test('probe stays inside original visibility gate and native singular/other branches stay exact',()=>{
 const source=body('logic/effect-handler-general.c','effect_handler_PROBE');
 const visibility=source.indexOf('if (monster_is_visible(mon))'),native=source.indexOf('monster_desc(m_name'),capture=source.indexOf('ab_stat_probe(m_name,mon->hp)'),lore=source.indexOf('lore_do_probe(mon)');
 assert.ok(visibility<native&&native<capture&&capture<lore);
 assert.equal(en['game.stat.message.probe.one'],'{actor} has {hp} hit point.');
 assert.equal(en['game.stat.message.probe.many'],'{actor} has {hp} hit points.');
 assert.match(helper,/hp==1\?"game.stat.message.probe.one":"game.stat.message.probe.many"/);
 assert.match(helper,/ab_naming_copy_json_for_buffer\(&event,native_buffer,"MonsterDescription"\)/);
 assert.doesNotMatch(helper,/maxhp|cave|race->|ridx|eidx|monster_is_visible|square_isview/);
});
test('pure helper uses only existing typed grammar and never mutates domain, queries RNG or repeats descriptors',()=>{
 const pure=helper.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.doesNotMatch(pure,/\b(?:Rand\w*|randint\w*|one_in_|damroll|take_hit|msg|msgt|desc_stat|lookup_obj_property|object_desc|monster_desc|disturb|update_stuff|file_open)\s*\(/);
 assert.doesNotMatch(pure,/player->|mon->|projections\[/);
 assert.match(read('logic/web-stat-message.h'),/#else[\s\S]*#define AB_STAT_MESSAGE\(expression\) \(\(void\)0\)/);
 const types=new Set(Object.values(schema.entries).flatMap(v=>v.parameters.map(p=>p.type)));
 assert.deepEqual([...types].sort(),['MonsterDescription','integer','localized_text']);
 const adapter=read('rust/src/localization.rs');for(const type of types)assert.ok(adapter.includes('"'+type+'"'),type);
});
