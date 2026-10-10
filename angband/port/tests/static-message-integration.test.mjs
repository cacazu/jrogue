import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {stripRecentAnnotations} from './native-annotations.mjs';
import {reconstructInterface} from '../migration/interface-data/native-parity.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('migration/message-data/static-manifest.json'));
const review=JSON.parse(read('migration/message-data/static-review.json'));
const en=JSON.parse(read('locales/review-en.json')),ja=JSON.parse(read('locales/review-ja.json'));
const marker=/\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g;
const dynamicMarker=/\/\* AB_GAME_DYNAMIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_DYNAMIC_END \*\//g;
const namingMarker=/\/\* AB_NAMING_BEGIN \*\/[\s\S]*?\/\* AB_NAMING_END \*\//g;

test('all reviewed static messages have source identity, exact English and Japanese catalog values',()=>{
 assert.equal(review.entries.length,316);
 assert.equal(manifest.entries.length,359);
 assert.equal(manifest.entries.reduce((n,e)=>n+e.sources.length,0),368);
 const texts=new Map(review.entries.map(e=>[e.english,e.japanese]));
 for(const entry of manifest.entries){
  assert.ok(entry.id.length<=127);
  assert.deepEqual(entry.parameters,[]);
  assert.equal(en[entry.id],entry.english);
  assert.equal(ja[entry.id],texts.get(entry.english));
  assert.match(ja[entry.id],/[\u3040-\u30ff\u3400-\u9fff]/);
  for(const source of entry.sources){assert.ok(source.function&&source.call&&source.upstreamLine);}
 }
});

test('removing static captures reconstructs every previously accepted native producer byte for byte',()=>{
 assert.equal(manifest.integration.applied.length,47);
 for(const file of manifest.integration.applied){
  assert.equal(file.sourceApplied,true);
  const baseline=fs.readFileSync(path.join(root,'tests/static-message-source-snapshot',file.file));
  assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'),file.acceptedSourceSha256);
  const source=read('logic/'+file.file);
  for(const tag of source.matchAll(/\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g)) {
   if(!tag[0].includes('AB_STATIC_MSG(')) continue;
   assert.match(source.slice(tag.index+tag[0].length),/^msgt?\s*\(/,file.file+' capture is immediately before its C producer');
  }
  // Strip the same owned interface projections from both immutable baseline
  // and current source. Their browser-only newline changes are excluded;
  // every surviving native byte still compares exactly, without normalization.
  const stripOther=bytes=>reconstructInterface(stripRecentAnnotations(bytes.toString('utf8'))).replace(namingMarker,'').replace(dynamicMarker,'');
  assert.deepEqual(Buffer.from(stripOther(Buffer.from(source)).replace(marker,''),'utf8'),Buffer.from(stripOther(baseline),'utf8'),file.file);
  const ids=[...source.matchAll(/AB_STATIC_MSG\("([^\"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids.sort(),file.bindings.map(b=>b.id).sort(),file.file);
 }
});

test('static emitter transports only reviewed ID and existing scalar sound without gameplay or RNG work',()=>{
 const source=read('logic/web-static-text.c').replace(/\/\*[\s\S]*?\*\//g,'');
 assert.match(source,/ab_semantic_event_begin\(&event, id, "message", "command", "log", 0, sound\)/);
 assert.match(source,/ab_semantic_event_emit\(&event\)/);
 assert.doesNotMatch(source,/\b(?:msg|msgt|randint0|randint1|object_desc|monster_desc|disturb|sound)\s*\(/);
 assert.match(read('logic/web-static-text.h'),/#else\s*#define AB_STATIC_MSG\(id, sound\) \(\(void\)0\)/);
 assert.deepEqual(manifest.integration.pendingFiles,[],'every reviewed static producer is source-connected');
 assert.equal(manifest.integration.applied.reduce((count,file)=>count+file.bindings.length,0),368);
});
