// Source-prepared actual WASM transport tests; run only in a parent resource slot.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { createSemanticTextWasm } from '../browser/semantic-text-wasm.mjs';
import { installNativeSemanticBridge } from '../browser/native-semantic-bridge.mjs';

const wasmBytes = await readFile(new URL('../target/wasm32-unknown-unknown/release/tome_text_wasm.wasm', import.meta.url));
const fixtureEntries = Object.fromEntries(['accept','article','gap','special'].map(name => [`fixture.${name}`, {
  owner: `UI.${name}`, tag: '_t', japanese_args_order: [],
  special_tokens: name === 'special' ? [{kind:'original_special'}] : [],
  printf_contract: {safe:name !== 'special'}, source_locations: [],
}]));
const english = {'fixture.accept':'Accept %s','fixture.article':'an','fixture.gap':'Missing %s','fixture.special':'Special %s'};
const japanese = {'fixture.accept':'%sを承諾','fixture.article':'','fixture.gap':null,'fixture.special':'特別な%s'};
const registry = {schema_version:1,japanese_configuration:[],entries:fixtureEntries,
  routes:Object.entries(english).map(([id,source]) => ({source,tag:'_t',default_id:id,aliases:[id],format_ambiguity:false}))};
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
const splitStream = value => ({body:new ReadableStream({start(controller) {
  const input = bytes(value);
  for (let offset=0;offset<input.length;offset+=3) controller.enqueue(input.slice(offset,offset+3));
  controller.close();
}})});
const resolver = await createSemanticTextWasm(wasmBytes, {
  english:splitStream(english), japanese:splitStream(japanese), registry:splitStream(registry),
  supplements:bytes({'fixture.gap':'%sが不足'}),
}, {expectedIds:4});
assert.equal(resolver.status.default_locale,'ja_JP');
assert.equal(resolver.resolve('Accept %s','_t').result.template,'%sを承諾');
assert.equal(resolver.resolve('Accept %s','_t',null,null,'en_US').result.template,'Accept %s');
assert.equal(resolver.resolve('an','_t').result.template,'');
assert.equal(resolver.resolve('Missing %s','_t').result.missing_official_japanese,true);
assert.equal(resolver.resolve('Missing %s','_t').result.template,'Missing %s');
assert.equal(resolver.supplement('fixture.gap').supplement,'%sが不足');
assert.equal(resolver.resolve('Special %s','_t').result.delegate_native_special,true);
assert.equal(resolver.resolve('Special %s','_t').result.delegate_native_format_review,true);
assert.equal(resolver.resolve('external username','_t').reason,'unknown_source_tag');
assert.equal(resolver.resolve('Accept %s','_t',null,null,'fr_FR').reason,'native_locale_outside_semantic_catalogue');
assert.equal(resolver.request({op:'resolve',source:'Accept %s',tag:'_t',parameters:['外部名']}).reason,'invalid_request');

let registrations=0;
const module={_tome_native_semantic_register(){},ccall(name,kind,types,args) {
  assert.equal(name,'tome_native_semantic_register');assert.equal(kind,'number');
  assert.deepEqual(types,[]);assert.deepEqual(args,[]);registrations++;return 1;
}};
const host = installNativeSemanticBridge(module,resolver);
const lease = host.beginResolve('an','_t',null,-1,'ja_JP');
assert.equal(host.hasResult(lease),true);assert.equal(host.string(lease,2),'');host.release(lease);
const missingLease=host.beginResolve('external username','_t',null,-1,'ja_JP');
assert.equal(host.hasResult(missingLease),false);assert.equal(host.string(missingLease,0),'unknown_source_tag');host.release(missingLease);
const supplementLease=host.beginSupplement('fixture.gap');
assert.equal(host.hasSupplement(supplementLease),true);assert.equal(host.string(supplementLease,5),'%sが不足');host.release(supplementLease);
assert.equal(host.outstandingLeases(),0);assert.equal(registrations,1);
const before=JSON.stringify(resolver.request({op:'status'}));
for(let index=0;index<10;index++) resolver.resolve('Accept %s','_t');
assert.equal(JSON.stringify(resolver.request({op:'status'})),before);
console.log('Actual semantic WASM fixture transport passed; original Lua/native integration remains separate.');

if (process.argv.includes('--full-catalog')) {
  const catalogRoot=new URL('../../localization-kernel-work/catalogs/',import.meta.url);
  const stream=url => ({body:Readable.toWeb(createReadStream(url))});
  const inputs={english:stream(new URL('en.json',catalogRoot)),japanese:stream(new URL('ja.json',catalogRoot)),registry:stream(new URL('registry.json',catalogRoot))};
  const finalSupplement=new URL('../../localization-review-work/final-review/ja-supplement-complete.json',import.meta.url);
  const finalPolicies=new URL('../../localization-review-work/final-review/format-policy.json',import.meta.url);
  const dreamDelta=new URL('../../localization-review-work/dream-stage/dream-registry-extension.json',import.meta.url);
  try {await access(finalSupplement);inputs.supplements=stream(finalSupplement);}
  catch {inputs.supplements=stream(new URL('ja-supplement.json',catalogRoot));}
  try {await access(finalPolicies);inputs.formatPolicies=stream(finalPolicies);} catch {}
  try {await access(dreamDelta);inputs.extension=stream(dreamDelta);} catch {}
  const full=await createSemanticTextWasm(wasmBytes,inputs);
  assert.ok(full.status.base_ids>=24825);
  assert.equal(full.resolve('Berserker','birth descriptor name').result.template,'狂戦士');
  if(inputs.extension) {
    const dream=full.resolve('dream','effect damage label death_dream');
    assert.equal(dream.result.id,'game.modules.tome.data.timed_effects.other.effect.death_dream.method.on_timeout.property.damage_label');
    assert.equal(dream.result.template,'夢');assert.equal(dream.result.missing_official_japanese,false);
  }
  console.log('Full immutable catalog WASM initialization passed: '+JSON.stringify(full.status));
}
