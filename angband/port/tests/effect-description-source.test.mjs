// SPDX-License-Identifier: GPL-2.0-only
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {stripEffect} from '../migration/effect-description-data/integrate.mjs';
import {functionSpan} from '../migration/stat-message-data/integrate.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir='migration/effect-description-data/';
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),load=f=>JSON.parse(read(dir+f));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('all upstream fields, twenty format cases and bilingual declared slots are inventoried',()=>{
 const manifest=load('source-manifest.json'),schema=load('schema.json').entries,en=load('en.json'),ja=load('ja.json');
 assert.equal(manifest.records.length,112);assert.equal(manifest.format_cases.length,20);
 assert.equal(manifest.description_count,108);assert.equal(manifest.menu_count,93);
 assert.equal(Object.keys(en).length,423);assert.deepEqual(Object.keys(en),Object.keys(ja));assert.deepEqual(Object.keys(en),Object.keys(schema));
 const slots=s=>[...s.matchAll(/\{([a-z_]+)\}/g)].map(m=>m[1]).sort();
 for(const [id,english]of Object.entries(en)){assert.deepEqual(slots(english),slots(ja[id]),id);assert.deepEqual(slots(english),schema[id].parameters.map(p=>p.name).sort(),id);assert.ok(schema[id].sources.length,id);for(const source of schema[id].sources){assert.ok(source.line>0,id);assert.ok(source.file.startsWith('src/')||source.file.startsWith('lib/'),id);}}
 const original=read(dir+'upstream-snapshots/list-effects.h');
 for(const record of manifest.records){assert.ok(original.includes('EFFECT('+record.code+','));assert.ok(original.includes(JSON.stringify(record.description)));assert.ok(original.includes(JSON.stringify(record.menu)));}
});
test('every accepted original function and line ending reconstructs independently',()=>{
 const snapshots=load('producer-snapshots.json').snapshots;assert.equal(snapshots.length,10);
 for(const record of snapshots){const source=read(record.file),[start,end]=functionSpan(source,record.function),actual=Buffer.from(stripEffect(source.slice(start,end))),accepted=Buffer.from(record.base64,'base64');assert.equal(sha(accepted),record.sha256);assert.ok(actual.equals(accepted),record.file+' '+record.function);}
});
test('pristine official source evidence remains pinned and carries original licenses',()=>{
 const lock=load('upstream-source-lock.json');assert.equal(lock.upstream_commit,'f3082213b73f3e463e3d0d60bff4b00462beae6e');assert.equal(lock.records.length,6);
 for(const record of lock.records){const bytes=fs.readFileSync(path.join(root,dir,'upstream-snapshots',path.basename(record.file)));assert.equal(sha(bytes),record.sha256);assert.equal(bytes.length,record.bytes);assert.ok(!bytes.includes(Buffer.from('AB_EFFECT_BEGIN')));if(record.file.endsWith('.c'))assert.ok(bytes.includes(Buffer.from('GNU General Public License')),record.file);}
});
// Stateful statement hooks must be outside all expression parentheses. This
// catches misplaced annotations even while the exact-original proof passes.
function statementHookPositions(source){let depth=0,mode='',escape=false;for(let i=0;i<source.length;i++){const c=source[i],n=source[i+1];if(mode==='/*'){if(c==='*'&&n==='/'){mode='';i++;}continue;}if(mode==='//'){if(c==='\n')mode='';continue;}if(mode==='"'||mode==="'"){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===mode)mode='';continue;}if(source.startsWith('/* AB_EFFECT_BEGIN */',i)){const end=source.indexOf('/* AB_EFFECT_END */',i);assert.ok(end>i);const block=source.slice(i,end);if(block.includes('#ifdef')){assert.equal(depth,0,'statement capture inside native expression');const previous=source.slice(0,i).trimEnd().at(-1);assert.ok(!['=',',','('].includes(previous),'statement capture after incomplete native assignment');}mode='/*';i++;continue;}if(c==='/'&&(n==='*'||n==='/')){mode=c+n;i++;continue;}if(c==='"'||c==="'"){mode=c;continue;}if(c==='(')depth++;else if(c===')')depth--;assert.ok(depth>=0,'unbalanced source expression');}assert.equal(depth,0);}
test('browser statement captures retain complete C expression boundaries',()=>{
 for(const file of ['logic/effects-info.c','logic/obj-info.c','logic/ui-knowledge.c','logic/ui-effect.c'])statementHookPositions(read(file));
});
test('the only approved native display corrections select enums and keep the computed dice string',()=>{
 const manifest=load('source-manifest.json'),fixed=manifest.records.filter(r=>r.presentation_fix);assert.deepEqual(fixed.map(r=>r.code),['MOVE_ATTACK','MELEE_BLOWS','SWEEP']);
 const helper=read('logic/web-effect-description.c'),source=read('logic/effects-info.c');
 for(const r of fixed){assert.match(r.description,/%d/);assert.ok(helper.includes('case EF_'+r.code+':return '+JSON.stringify(r.description.replace('%d','%s'))));}
 assert.ok(source.includes('AB_EFFECT_DICE_FORMAT(e->index,'));assert.ok(source.includes('AB_EFFECT_BUFFER(desc,"dice",'));
 assert.ok(read('logic/web-effect-description.h').includes('#define AB_EFFECT_DICE_FORMAT(i,v) (v)'));
});
test('capture helpers have no simulation, dice, entity description or native-English lookup interface',()=>{
 const helper=read('logic/web-effect-description.c');assert.doesNotMatch(helper,/\b(?:dice_roll|dice_evaluate|dice_random_value|randcalc|randint0|randint1|object_desc|monster_desc|effect_calculate_value)\s*\(/);
 assert.doesNotMatch(helper,/\b(?:strstr|strcasestr|strcmp|strncmp)\s*\(/);
 assert.ok(helper.includes('return value;'));assert.ok(helper.includes('"{\\"schema_version\\":0,\\"parts\\":[]}"'));
 assert.ok(helper.includes('ab_semantic_event_discard(&child->graph.json)'));
});
test('source family selection follows actual printed fields, including absent NULL strings',()=>{
 const maps=load('source-bindings.json');assert.equal(maps.effects.length,112);assert.equal(maps.projections.length,56);assert.equal(maps.stats.length,5);assert.equal(maps.summons.length,17);
 const schema=load('schema.json').entries;for(const record of maps.projections)for(const role of ['description','player','lash']){assert.ok(record[role+'_id']);assert.ok(schema[record[role+'_id']]);}
 const source=read('logic/effects-info.c');assert.ok(source.includes('AB_EFFECT_LEX(desc,"condition",AB_EFFECT_TIMED,e->subtype,'));assert.ok(source.includes('AB_EFFECT_INT(desc,"length",'));assert.ok(source.includes('ab_effect_graph_result(&ab_effect_graph,NULL)'));
 assert.ok(source.includes('AB_EFFECT_LIST(breaths,"angband.effect_info.grammar.join.oxford_or",'));
});
test('immutable source corpus and full-width numeric facts fit existing formatter limits',()=>{
 const bounds=load('bounds-evidence.json');assert.equal(bounds.maximum_linked_effects,14);assert.ok(bounds.maximum_wire_depth<=32);assert.ok(bounds.conservative_semantic_nodes_upper<=512);assert.ok(bounds.conservative_capture_bytes_upper<=131072);
 for(const locale of bounds.locales){assert.ok(locale.linked_chain_output_upper_bytes<8192);assert.ok(locale.condensed_recipe_upper_bytes<8192);}
});
