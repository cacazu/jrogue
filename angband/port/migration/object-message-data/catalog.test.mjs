// SPDX-License-Identifier: GPL-2.0-only
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import{fileURLToPath}from'node:url';
import{rows}from'./authored.mjs';import{stripObjects}from'./integrate.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(directory,'../..');
const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
const source=name=>fs.readFileSync(path.join(root,'logic',name),'utf8');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
test('all 23 reserved original producers have reviewed Japanese and exact typed placeholders',()=>{
 const en=read('en.json'),ja=read('ja.json'),schema=read('schema.json').entries,manifest=read('source-manifest.json');
 assert.equal(rows.length,85);assert.equal(Object.keys(en).length,85);assert.deepEqual(Object.keys(en),Object.keys(ja));assert.deepEqual(Object.keys(en),Object.keys(schema));
 const covered=[...new Set(rows.flatMap(row=>row.source_indices))].sort((a,b)=>a-b);
 assert.deepEqual(covered,manifest.source_callsites.map(row=>row.source_index).sort((a,b)=>a-b));assert.equal(covered.length,23);
 assert.ok(!covered.includes(98)&&!covered.includes(99));
 for(const row of rows){
  const slots=text=>[...text.matchAll(/\{([a-z_]+)\}/g)].map(m=>m[1]).sort();
  assert.deepEqual(slots(en[row.id]),row.parameters.map(p=>p.name).sort());assert.deepEqual(slots(ja[row.id]),slots(en[row.id]));
  assert.ok(ja[row.id]&&!ja[row.id].includes('\uFFFD'));assert.notEqual(en[row.id],ja[row.id]);
 }
});
test('each source hash binds an untouched official producer or canonical slot declaration',()=>{
 const pristine='C:/Users/kit/gameme/jnethack/jrouge/angband/upstream/angband-4.2.6',manifest=read('source-manifest.json');
 assert.equal(manifest.upstream_commit,'f3082213b73f3e463e3d0d60bff4b00462beae6e');assert.equal(manifest.source_hashes.length,8);
 for(const entry of manifest.source_hashes){const bytes=fs.readFileSync(path.join(pristine,entry.file));assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);}
});
test('six applied producer files preserve every native byte with other owners annotations intact',()=>{
 const evidence=read('integration-evidence.json');assert.equal(evidence.files.length,6);
 for(const file of evidence.files){
  const baseline=fs.readFileSync(path.join(directory,'source-baseline',file.file),'utf8');assert.equal(sha(baseline),file.baseline_sha256);
  let cursor=0,modified='';for(const insertion of file.insertions){assert.ok(insertion.offset_chars>=cursor);modified+=baseline.slice(cursor,insertion.offset_chars)+insertion.source;cursor=insertion.offset_chars;}modified+=baseline.slice(cursor);
  assert.equal(sha(modified),file.modified_sha256);assert.equal(stripObjects(modified),baseline);
 }
 assert.equal(evidence.source_indices.length,23);
});
test('naming snapshots own original outputs before inventory mutation and are released on all curse branches',()=>{
 const wield=source('cmd-obj.c'),gear=source('obj-gear.c'),effect=source('effect-handler-general.c');
 assert.match(wield,/ab_object_snapshot\(&ab_object_name,o_name\);[\s\S]*?inven_wield\(obj, slot\)/);
 assert.match(gear,/ab_object_snapshot\(&ab_object_name,o_name\);[\s\S]*?player->body.slots\[slot\]\.obj = NULL/);
 for(const fn of ['CURSE_ARMOR','CURSE_WEAPON']){
  const start=effect.indexOf('bool effect_handler_'+fn+'('),end=effect.indexOf('\n/**',start),body=effect.slice(start,end);
  assert.equal((body.match(/ab_naming_snapshot_release\(&ab_object_name\)/g)||[]).length,2);
 }
 const helper=source('web-object-messages.c');
 assert.doesNotMatch(helper,/object_desc\(|object_kind_name\(|object_is_carried\(|randint|one_in_|object_flavor_is_aware|player_knows/);
 assert.match(helper,/if\(owned\)ab_naming_snapshot_release\(owned\)/);
});
test('native random selection and last applicable elemental verb remain original source decisions',()=>{
 const effect=source('effect-handler-general.c'),projection=source('project-obj.c');
 assert.match(effect,/one_in_\(2\) \? [^\n]*AB_OBJECT_WORD\("object.brand.flame"/);
 assert.match(effect,/one_in_\(3\) \? [^\n]*AB_OBJECT_WORD\("object.brand.flame"/);
 for(const fn of ['PLASMA','METEOR']){
  const start=projection.indexOf('static void project_object_handler_'+fn+'('),end=projection.indexOf('\n}',start),body=projection.slice(start,end);
  assert.equal((body.match(/project_object_elemental\(context/g)||[]).length,2);
 }
 assert.match(projection,/note_kill = context.note_kill/);
 assert.match(projection,/ab_object_word_id\(note_kill,false\)/);
 assert.doesNotMatch(source('web-object-messages.c'),/strcmp\([^\n]*(native_word|native_buffer)/);
});
test('the original heavy-equipment predicate and source body-slot identity are retained',()=>{
 const gear=source('obj-gear.c'),helper=source('web-object-messages.c');
 assert.match(gear,/type == EQUIP_WEAPON && p->state.heavy_shoot/);
 assert.match(gear,/ab_object_relation_capture\(p->race->body,slot,type,true,false\)/);
 assert.match(helper,/body==0 && slot>=0 && slot<\(int\)N_ELEMENTS\(slot_semantic\) && type==slot_types\[slot\]/);
 assert.match(helper,/AB_UI_NESTED\("relation",id,&relation_slot,1\)/);
});
