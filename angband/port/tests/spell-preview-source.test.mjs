// SPDX-License-Identifier: GPL-2.0-only
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {stripEffect} from '../migration/effect-description-data/integrate.mjs';
import {functionSpan} from '../migration/stat-message-data/integrate.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir='migration/spell-preview-data/';
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),load=f=>JSON.parse(read(dir+f));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('preview labels are canonical source fields with complete bilingual parameter parity',()=>{
 const bindings=load('source-bindings.json').effects,en=load('en.json'),ja=load('ja.json'),schema=load('schema.json').entries;
 assert.equal(bindings.length,112);assert.deepEqual(Object.keys(en),Object.keys(ja));assert.deepEqual(Object.keys(en),Object.keys(schema));
 const slots=s=>[...s.matchAll(/\{([a-z_]+)\}/g)].map(m=>m[1]).sort();
 for(const [id,english]of Object.entries(en)){assert.deepEqual(slots(english),slots(ja[id]),id);assert.deepEqual(slots(english),schema[id].parameters.map(p=>p.name).sort(),id);assert.ok(schema[id].sources.length,id);for(const source of schema[id].sources)assert.ok(source.line>0,id);}
 for(const binding of bindings)if(binding.id)assert.ok(en[binding.id]);
});
test('all original calculations, duplicate gates and native newline bytes reconstruct exactly',()=>{
 const snapshots=load('producer-snapshots.json').snapshots,upstream=read('migration/effect-description-data/upstream-snapshots/player-spell.c');assert.equal(snapshots.length,5);
 for(const item of snapshots){const source=read(item.file),[start,end]=functionSpan(source,item.function),actual=Buffer.from(stripEffect(source.slice(start,end))),accepted=Buffer.from(item.base64,'base64');assert.equal(sha(accepted),item.sha256);assert.ok(actual.equals(accepted),item.function);if(item.file==='logic/player-spell.c'){const [a,b]=functionSpan(upstream,item.function);assert.ok(actual.equals(Buffer.from(upstream.slice(a,b))),item.function+' official source');}}
});
test('capture is owning, consumed at the original worked row and clears every other state',()=>{
 const helper=read('logic/web-spell-preview.c'),rows=read('logic/web-spell-text.c');
 assert.doesNotMatch(helper,/\b(?:dice_roll|dice_evaluate|dice_random_value|randcalc|randint0|randint1|effect_info|object_desc|monster_desc|strstr|strcmp|strncmp)\s*\(/);
 assert.ok(helper.includes('ab_semantic_json_int32(json,value)'));assert.ok(helper.includes('current_spell==spell_index'));assert.ok(helper.includes('ab_semantic_event_emit(event);ab_spell_preview_reset();'));
 assert.ok(rows.includes('if(state==AB_SPELL_WORKED)'));assert.ok(rows.includes('ab_spell_preview_emit(&event,spell->sidx)'));assert.ok(rows.includes('__clear:row.%d.info'));
 assert.ok(helper.includes('"{\\"schema_version\\":0,\\"parts\\":[]}"'));
});
test('source captures native winning branches and special40/Info capacity boundaries',()=>{
 const source=read('logic/player-spell.c');
 assert.ok(source.includes('ab_spell_preview_begin(spell_index,len)'));assert.ok(source.includes('ab_spell_preview_finish()'));
 for(const role of ['special.heal','special.random','special.radius','special.sphere_default','special.ball_default','special.length','special.swarm'])assert.ok(source.includes('angband.effect_info.spell_preview.'+role),role);
 assert.ok(source.includes('ab_spell_preview_append_special()'));assert.ok(source.includes('ab_spell_preview_label(effect->index)'));
 assert.ok(source.includes('sizeof(special)'));assert.ok(read('logic/ui-spell.c').includes('char help[30]'));
});
// Independent native branch oracle: effect calculations are not executed.
function nativeDice(rv){let s='';if(rv.base>0){s+=rv.base;if(rv.dice>0&&rv.sides>0)s+='+';}if(rv.dice===1&&rv.sides>0)s+='d'+rv.sides;else if(rv.dice>1&&rv.sides>0)s+=rv.dice+'d'+rv.sides;return s;}
function semanticDice(rv,en){const p='angband.effect_info.spell_preview.',render=(role,params={})=>en[p+role].replace(/\{([a-z_]+)\}/g,(_,n)=>String(params[n]));const parts=[];if(rv.base>0){parts.push(render('dice.base',{base:rv.base}));if(rv.dice>0&&rv.sides>0)parts.push(render('dice.plus'));}if(rv.dice===1&&rv.sides>0)parts.push(render('dice.single',{sides:rv.sides}));else if(rv.dice>1&&rv.sides>0)parts.push(render('dice.roll',{dice:rv.dice,sides:rv.sides}));return parts.join('');}
test('reviewed dice roles preserve one-die and hidden nonpositive-base grammar at full i32 widths',()=>{
 const en=load('en.json');for(const base of [-2147483648,-1,0,1,2147483647])for(const dice of [-1,0,1,2,2147483647])for(const sides of [-1,0,1,2147483647]){const rv={base,dice,sides};assert.equal(semanticDice(rv,en),nativeDice(rv));}
});
test('Info30 clips native ASCII once while Japanese keeps selected suffix facts',()=>{
 const en=load('en.json'),ja=load('ja.json'),p='angband.effect_info.spell_preview.';
 const values={radius:2147483647},format=(s)=>s.replace(/\{([a-z_]+)\}/g,(_,n)=>values[n]);
 const english=' dam 2147483647+2147483647d2147483647'+format(en[p+'special.radius']);
 assert.equal(Buffer.from(english).subarray(0,29).toString('ascii'),' dam 2147483647+2147483647d21');
 assert.equal(format(ja[p+'special.radius']),'、半径2147483647');
 assert.equal(en[p+'special.ball_default'],'rad 2');assert.equal(en[p+'special.sphere_default'],', rad 2');
});
