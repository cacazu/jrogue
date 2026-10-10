import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {stripRecentAnnotations} from './native-annotations.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const manifest=JSON.parse(read('migration/message-data/dynamic-manifest.json'));
const en=JSON.parse(read('locales/review-en.json')),ja=JSON.parse(read('locales/review-ja.json'));
const marker=/\/\* AB_GAME_DYNAMIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_DYNAMIC_END \*\//g;
const namingMarker=/\/\* AB_NAMING_BEGIN \*\/[\s\S]*?\/\* AB_NAMING_END \*\//g;
const staticMarker=/\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g;

test('reviewed producers use semantic templates, unchanged original argument order and distinct typed captures',()=>{
 assert.equal(manifest.integration.selectedCallsites,93);
 assert.equal(manifest.entries.reduce((count,entry)=>count+entry.sources.length,0),93);
 for(const entry of manifest.entries){
  assert.equal(en[entry.id],entry.english);assert.equal(ja[entry.id],entry.japanese);
  const placeholders=text=>[...text.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map(m=>m[1]).sort();
  assert.deepEqual(placeholders(entry.english),entry.parameters.map(p=>p.name).sort());
  assert.deepEqual(placeholders(entry.japanese),entry.parameters.map(p=>p.name).sort());
  for(const source of entry.sources){
   assert.match(source.upstreamSha256,/^[a-f0-9]{64}$/);
   assert.equal(source.originalArguments.length,entry.parameters.length+(source.call==='msgt'?2:1));
  }
 }
});
test('native producer bytes and original message queue/sound/event path reconstruct exactly',()=>{
 for(const file of manifest.integration.applied){
  const baseline=fs.readFileSync(path.join(root,'tests/dynamic-message-source-snapshot',file.file));
  assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'),file.baselineSha256);
  const removeOther=text=>stripRecentAnnotations(text).replace(namingMarker,'').replace(staticMarker,'');
  assert.deepEqual(Buffer.from(removeOther(read('logic/'+file.file).replace(marker,'')),'utf8'),Buffer.from(removeOther(baseline.toString('utf8')),'utf8'),file.file);
  assert.equal(file.sourceApplied,true);
 }
 assert.deepEqual(Buffer.from(stripRecentAnnotations(read('logic/message.c')).replace(marker,''),'utf8'),Buffer.from(stripRecentAnnotations(read('tests/dynamic-message-source-snapshot/message.c')),'utf8'));
});
test('owned varargs projection copies arguments once without native-English identification or descriptor recomputation',()=>{
 const wrapper=read('logic/message.c').match(/\/\* AB_GAME_DYNAMIC_BEGIN \*\/[\s\S]*?void ab_dynamic_msg\([\s\S]*?\/\* AB_GAME_DYNAMIC_END \*\//)?.[0];
 assert.ok(wrapper);assert.match(wrapper,/va_copy\(semantic, vp\)/);
 assert.equal((wrapper.match(/va_copy\(semantic, vp\)/g)||[]).length,2);
 const adapter=read('logic/web-dynamic-text.c').replace(/\/\*[\s\S]*?\*\//g,'');
 assert.match(adapter,/ab_naming_copy_json_for_buffer\(&event,native_buffer,kind\)/);
 assert.doesNotMatch(adapter,/\b(?:strcmp|strstr|randint0|randint1|object_desc|monster_desc|sound|msg|msgt)\s*\(/);
 assert.match(adapter,/case 'I':[\s\S]*va_arg\(arguments,int\)/);
 assert.ok(manifest.integration.remainingLiteralCallsites>0,'remaining producers stay explicitly pending');
});
