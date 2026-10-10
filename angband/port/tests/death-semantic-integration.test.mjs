import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
import{reconstructDeath}from'../migration/death-data/native-parity.mjs';
import{stripRecentAnnotations}from'./native-annotations.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('migration/death-data/source-manifest.json'));
const normalize=s=>s.replaceAll('\r\n','\n');
test('all fourteen causal native sources reconstruct byte-for-byte after owned annotations and clock veneers',()=>{
 for(const file of manifest.source_files){const got=stripRecentAnnotations(reconstructDeath(read(file))),expected=stripRecentAnnotations(read(manifest.baseline+'/'+file));
  let i=0;while(i<got.length&&got[i]===expected[i])i++;
  assert.equal(got===expected,true,`${file} first difference byte ${i}: ${JSON.stringify(got.slice(i-50,i+80))}`);
 }
});
test('death catalog contains26 strict source causes and exact EN/JA typed placeholder sets',()=>{
 const en=JSON.parse(read('migration/interface-data/en.json')),ja=JSON.parse(read('migration/interface-data/ja.json'));
 const causes=manifest.entries.filter(e=>e.id.startsWith('interface.death.cause.'));assert.equal(causes.length,26);
 for(const e of manifest.entries){assert.equal(en[e.id],e.english);assert.equal(ja[e.id],e.japanese);const names=e.parameters.map(p=>p.name).sort();
  for(const text of[e.english,e.japanese])assert.deepEqual([...text.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map(m=>m[1]).sort(),names,e.id);
 }
 assert.equal(manifest.cause_section.max_bytes,16384);assert.equal(manifest.scores_section.max_bytes,524288);
});
test('lethal commit and cheat recovery remain at the exact original native branch',()=>{
 const code=read('logic/player-util.c');const lethal=code.indexOf('my_strcpy(p->died_from, kb_str');
 assert.ok(lethal>=0);assert.ok(code.indexOf('ab_dc_commit(kb_str)',lethal)>lethal);
 assert.ok(code.indexOf('ab_dc_commit(kb_str)',lethal)<code.indexOf('!get_check(',lethal));
 const clear=code.indexOf('ab_dc_clear()',lethal);assert.ok(clear>code.indexOf('!get_check(',lethal));assert.ok(clear<code.indexOf('event_signal(EVENT_CHEAT_DEATH)',lethal));
 const native=normalize(reconstructDeath(code));assert.equal((native.match(/\btake_hit\s*\(/g)||[]).length,3);
});
test('owned descriptors are captured before later effects and reused across projectile damage',()=>{
 for(const[file,call,capture,next]of[
  ['logic/mon-attack.c','monster_desc(ddesc','ab_dc_capture_monster(&ab_death, ddesc)','/* Scan through all blows */'],
  ['logic/project-player.c','monster_desc(killer','ab_dc_capture_monster(&ab_death, killer)','update_smart_learn(mon'],
  ['logic/effect-handler-attack.c','monster_desc(killer','ab_dc_capture_monster(&ab_death, killer)','case SRC_TRAP'],
 ]){const s=read(file);assert.ok(s.indexOf(capture)>s.indexOf(call));assert.ok(s.indexOf(capture)<s.indexOf(next,s.indexOf(call)));}
 const p=read('logic/project-player.c');assert.equal((p.match(/AB_DC_AROUND\(&ab_death, killer, take_hit/g)||[]).length,2);assert.equal((p.match(/ab_dc_capture_release\(&ab_death\)/g)||[]).length,1);
 const helper=read('logic/web-death-cause.c');assert.ok(!/\b(?:object_desc|monster_desc|randint[01]|dice_roll|take_hit|highscore_where|highscore_add)\s*\(/.test(helper));
 assert.ok(helper.includes('pending[16]'));assert.ok(helper.includes('pending[depth-1].buffer==buffer'));
});
test('six selected effect fields reuse reviewed catalogs and do not revive native no-effect branches',()=>{
 const rust=read('rust/src/death_cause.rs'),helper=read('logic/web-death-cause.c'),init=read('logic/init.c');
 const ids=[...rust.matchAll(/"((?:domain\.shape\.(?:bat|warg|vampire)\.effect_message|angband\.player_class\.necromancer[^"\n]*death_reason))"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,6);
 const character=JSON.parse(read('migration/character-data/ja.json')),domain=JSON.parse(read('migration/domain-text-data/ja.json'));
 for(const id of ids){assert.ok(character[id]||domain[id],id);assert.ok(helper.includes('"'+id+'"'));}
 for(const[name,register]of[['parse_shape_effect_msg','ab_dc_register_shape_effect'],['parse_class_effect_msg','ab_dc_register_class_effect']]){
  const begin=init.indexOf('static enum parser_error '+name),end=init.indexOf('\nstatic ',begin+1),fn=init.slice(begin,end);
  assert.ok(fn.indexOf('if (effect == NULL)')<fn.indexOf(register));
  assert.ok(fn.indexOf('ab_dc_unregister_source_message(effect->msg)')<fn.indexOf('effect->msg = string_append'));
  assert.ok(fn.indexOf(register)>fn.indexOf('effect->msg = string_append'));
 }
 assert.ok(helper.includes('effect->index!=EF_DAMAGE'));assert.ok(helper.includes('AB_DC_SOURCE_ROWS 2048U'));
 const lookup=helper.slice(helper.indexOf('const char *ab_dc_source_message_id'),helper.indexOf('void ab_dc_unregister_source_message'));
 assert.ok(lookup.includes('(uintptr_t)address'));assert.ok(!lookup.includes('strcmp')&&!lookup.includes('strlen'));
});
test('score provenance follows native retention and keeps live predictions ephemeral',()=>{
 const score=read('logic/score.c');assert.ok(score.indexOf('ab_dc_score_enter(&entry')>score.indexOf('highscore_add(&entry'));
 assert.ok(score.indexOf('ab_dc_score_enter(&entry')<score.indexOf('highscore_write(scores'));
 const rust=read('rust/src/death_cause.rs');assert.ok(rust.includes('SCORE_RECORD_BYTES: usize = 126'));assert.ok(rust.includes('preview: Option<([u8; SCORE_RECORD_BYTES], Cause)>'));
 const snapshot=rust.slice(rust.indexOf('pub fn snapshot_scores'),rust.indexOf('pub fn restore_scores'));
 assert.ok(!snapshot.includes('preview'));assert.ok(snapshot.includes('scores_overflowed'));
 assert.ok(read('logic/ui-score.c').includes('ab_dc_score_preview(&the_score)'));
 assert.ok(read('logic/web-death-cause.c').includes('!memcmp(entry,&scores[i],sizeof(*entry))'));
});
test('score identity derives from all fourteen untouched native char fields rather than an assumed record size',()=>{
 const score=read('logic/score.h');assert.equal(score,read(manifest.baseline+'/logic/score.h'));
 const body=score.match(/struct high_score\s*\{([\s\S]*?)\};/)[1].replace(/\/\*[\s\S]*?\*\//g,'');
 const fields=[...body.matchAll(/char\s+([a-z_]+)\[(\d+)\]\s*;/g)].map(m=>({name:m[1],bytes:Number(m[2])}));
 assert.equal(fields.length,14);assert.equal(body.replace(/char\s+[a-z_]+\[\d+\]\s*;/g,'').trim(),'');
 assert.deepEqual(fields,manifest.scores_section.native_identity_fields);
 const bytes=fields.reduce((sum,field)=>sum+field.bytes,0);assert.equal(bytes,126);assert.equal(manifest.scores_section.identity_bytes,bytes);
 const helper=read('logic/web-death-cause.c');assert.ok(helper.includes('sizeof(struct high_score)==126'));
 assert.ok(helper.includes('ab_rs_death_score((const uint8_t*)score,(uint32_t)sizeof(*score))'));
 const rust=read('rust/src/death_cause.rs');assert.ok(rust.includes('SCORE_RECORD_BYTES: usize = '+bytes));
 assert.ok(rust.includes('score_identity(&"0".repeat(128*2)).is_err()'));
});
