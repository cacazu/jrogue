/* Actual compiled phase 3 ABI checks. Synthetic formatter envelopes are
 * explicitly distinct from native producer callbacks/browser gameplay QA.
 * Run only after parent BUILD_DONE + CLIPPY_DONE and fresh memory headroom. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import createNetHackModule from '../web/engine/nethack.js';
import { RustLayers, serializeGameplayEnvelope } from '../web/shim-host.mjs';

const module = await createNetHackModule({noInitialRun:true,wasmBinary:new Uint8Array(readFileSync(new URL('../web/engine/nethack.wasm',import.meta.url)))});
const uiCatalog = JSON.parse(readFileSync(new URL('../web/browser-ui.json',import.meta.url),'utf8'));
const catalog = JSON.parse(readFileSync(new URL('../web/gameplay-core.json',import.meta.url),'utf8'));
const layers = new RustLayers(module,uiCatalog);
layers.setGameplayCatalog(catalog);
const text = value => ({type:'text',value});
const reference = value => ({type:'text_id',value});
const nested = value => ({type:'event',value});
const envelope = (id,args = {},context = {}) => ({event:{id,args},context:{api:'pline',helperVariant:'plain',...context}});
function isolated(paired) { const result = new RustLayers(module,uiCatalog); result.setGameplayCatalog(paired); return result; }
function withBuffer(bytes,fn) {
  const value = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const pointer = module._malloc(Math.max(1,value.length)); assert(pointer);
  module.HEAPU8.set(value,pointer);
  try { return fn(pointer,value.length); } finally { module._free(pointer); }
}
function rawFormat(layer,event,locale = 0,output = 0,capacity = 0) {
  return withBuffer(typeof event === 'string' ? event : serializeGameplayEnvelope(event),(pointer,length) => module.ccall('nh_rust_format_gameplay','number',['number','number','number','number','number','number','number'],[layer.gameplayCatalogPtr,layer.gameplayCatalogBytes.length,pointer,length,locale,output,capacity]));
}
const checksums = () => Object.fromEntries(['nh_abi_state_checksum','nh_abi_world_checksum','nh_abi_rng_checksum'].map(name => [name,module.ccall(name,'number',[],[])]));
const quest = (lineIndex = 1,complete = true) => ({sequence:1,lineIndex,lineCount:2,final:lineIndex === 1,captureComplete:complete,window:7,resolvedSection:'Wiz',resolvedMessageId:'nemesis_wantsit',itemIndex:0,field:'text',sourceTemplate:'Native source diagnostics only.',decodedLine:'Original accepted line.'});

test('new compiled exports exist and native semantic getter cannot forge events outside actual callback scope',() => {
  for (const name of ['_nh_abi_semantic_event','_nh_rust_format_gameplay','_nh_rust_format_gameplay_fallback']) assert.equal(typeof module[name],'function',name);
  assert.equal(module.ccall('nh_rust_default_locale','number',[],[]),0);
  const before = checksums();
  for (const name of ['shim_putstr','shim_raw_print','shim_add_menu','shim_end_menu','shim_yn_function','unknown']) for (const window of [-1,0,1,7]) assert.equal(module.ccall('nh_abi_semantic_event','number',['string','number'],[name,window]),0);
  assert.deepEqual(checksums(),before);
});

test('actual Rust parses the complete installed catalog and renders source hash IDs in both locales',() => {
  assert.equal(Object.keys(catalog.en).length,3026); assert.equal(Object.keys(catalog.ja).length,3026);
  for (const id of ['nethack.entity.monster.orc.name_neutral','nethack.entity.object.pot_healing.name','nethack.message.eat.cpostfx.pline.yum_that_was_real_brain_food.ce60299dbd','nethack.message.eat.eataccessory.you_feel.wide_awake.e4c97871d0']) {
    for (const locale of ['ja','en']) assert.deepEqual(layers.formatEvent(envelope(id),locale),{text:catalog[locale][id],usedFallback:false,locale});
  }
});

test('actual Rust selects frozen dream/underwater helper variants and preserves captured accessibility text',() => {
  const id = 'nethack.message.dbridge.destroy_drawbridge.you_hear.a_loud_crash.375d03f6b7';
  for (const helperVariant of ['plain','dream','underwater']) for (const locale of ['ja','en']) {
    const lookup = helperVariant === 'plain' ? id : `variant.${helperVariant}.${id}`;
    assert.equal(layers.formatEvent(envelope(id,{}, {api:'You_hear',helperVariant}),locale).text,catalog[locale][lookup]);
  }
  const qualified = envelope(id,{}, {api:'You_hear',locationPrefix:'north 100% {public_coordinate}'});
  const japanese = layers.formatEvent(qualified,'ja');
  assert.equal(japanese.text,catalog.ja['context.location_prefix'].replace('{location}','north 100% {public_coordinate}').replace('{text}',catalog.ja[id]));
  assert.equal(japanese.usedFallback,true);
  assert.equal(layers.formatEvent(qualified,'en').usedFallback,false);
});

test('actual printf character, signed decimal, octal and hex conversions preserve original source semantics',() => {
  const yuck = 'nethack.message.eat.eatspecial.pline.yuck_c.dbe94b5155';
  assert.equal(layers.formatEvent(envelope(yuck,{arg_1:{type:'integer',value:33}}),'en').text,'Yuck!');
  assert.equal(layers.formatEvent(envelope(yuck,{arg_1:{type:'integer',value:46}}),'en').text,'Yuck.');
  const id = 'nethack.message.pager.dowhatdoes.pline.no_such_command_s_char_code_d.2fa35947a9';
  const source = envelope(id,{arg_1:text('?'),arg_2:{type:'integer',value:63},arg_3:{type:'unsigned',value:63},arg_4:{type:'unsigned',value:63}});
  assert.equal(layers.formatEvent(source,'en').text,"No such command '?', char code 63 (0077 or 0x3f).");
});

test('actual typed i64/u64/boolean/literal text stays exact across JSON and compiled formatter',() => {
  const template = '{signed:%ld} | {unsigned} | {boolean} | {literal:%s}';
  const isolatedLayers = isolated({en:{'game.typed.20eac40c70':template},ja:{'game.typed.20eac40c70':template}});
  const source = envelope('game.typed.20eac40c70',{signed:{type:'integer',value:-(1n<<63n)},unsigned:{type:'unsigned',value:(1n<<64n)-1n},boolean:{type:'boolean',value:true},literal:text('自由 100% {literal} 🐈')});
  assert.equal(isolatedLayers.formatEvent(source,'ja').text,'-9223372036854775808 | 18446744073709551615 | true | 自由 100% {literal} 🐈');
  assert.equal(isolatedLayers.formatEvent(source,'ja').usedFallback,false);
});

test('actual nested public-name grammar renders captured appearance without introducing unknown identity',() => {
  const appearance = 'nethack.entity.object.pot_healing.appearance';
  const name = {id:'nethack.name.object.potion_appearance',args:{original:text('captured public potion appearance'),name:reference(appearance)}};
  const source = envelope('nethack.message.eat.cprefx.you_feel.that_eating_the_s_was_a_bad.5b005af7f0',{arg_1:nested(name)},{api:'You_feel'});
  const ja = layers.formatEvent(source,'ja'), en = layers.formatEvent(source,'en');
  assert(ja.text.includes(catalog.ja[appearance])); assert(!ja.text.includes(catalog.ja['nethack.entity.object.pot_healing.name']));
  assert(en.text.includes('captured public potion appearance')); assert.equal(ja.usedFallback,false);
  const monster = {id:'nethack.name.monster',args:{article:text('the '),invisible:reference('nethack.name.empty'),saddled:reference('nethack.name.empty'),name:reference('nethack.entity.monster.orc.name_neutral')}};
  assert.equal(layers.formatEvent(envelope('nethack.name.monster',monster.args),'ja').text,catalog.ja['nethack.entity.monster.orc.name_neutral']);
});

test('actual nested English fallback propagates through a localized enclosing message',() => {
  const isolatedLayers = isolated({en:{'game.observation':'See {name:%s}.','name.pending':'unknown public label'},ja:{'game.observation':'{name:%s}が見える。'}});
  const result = isolatedLayers.formatEvent(envelope('game.observation',{name:nested({id:'name.pending',args:{}})}),'ja');
  assert.equal(result.text,'unknown public labelが見える。'); assert.equal(result.usedFallback,true);
});

test('actual whole-quest formatting requires a final complete source union and preserves source input',() => {
  const id = 'nethack.quest.wiz.nemesis_wantsit.text';
  const source = envelope(id,{quest_quest_artifact:text('PUBLIC_ARTIFACT'),quest_quest_artifact_modifier_C:text('The PUBLIC_ARTIFACT')},{quest:quest()});
  const before = serializeGameplayEnvelope(source);
  const ja = layers.formatEvent(source,'ja'); assert(ja.text.includes('PUBLIC_ARTIFACT')); assert.equal(ja.usedFallback,false);
  assert.equal(layers.formatEvent(source,'en').text,catalog.en[id].replaceAll('{quest_quest_artifact_modifier_C}','The PUBLIC_ARTIFACT'));
  assert.equal(serializeGameplayEnvelope(source),before);
  for (const context of [quest(0),quest(1,false)]) assert.throws(() => layers.formatEvent({...source,context:{...source.context,quest:context}},'ja'));
  const missing = structuredClone(source); delete missing.event.args.quest_quest_artifact; assert.throws(() => layers.formatEvent(missing,'en'));
});

test('actual UTF8 query/copy reports byte length and leaves short or invalid-output canaries untouched',() => {
  const isolatedLayers = isolated({en:{'game.copy':'Hello {name}'},ja:{'game.copy':'こんにちは {name}'}});
  const source = envelope('game.copy',{name:text('猫 % {name} 🐈')});
  const expected = new TextEncoder().encode('こんにちは 猫 % {name} 🐈');
  const needed = rawFormat(isolatedLayers,source); assert.equal(needed,expected.length);
  const pointer = module._malloc(needed+2); assert(pointer);
  try {
    module.HEAPU8.fill(0xa5,pointer,pointer+needed+2);
    assert.equal(rawFormat(isolatedLayers,source,0,pointer+1,needed-1),needed);
    assert(module.HEAPU8.subarray(pointer,pointer+needed+2).every(byte => byte === 0xa5));
    assert.equal(rawFormat(isolatedLayers,source,0,pointer+1,needed),needed);
    assert.deepEqual(module.HEAPU8.subarray(pointer+1,pointer+1+needed),expected);
    assert.equal(module.HEAPU8[pointer],0xa5); assert.equal(module.HEAPU8[pointer+needed+1],0xa5);
    module.HEAPU8.fill(0xa5,pointer,pointer+needed+2);
    assert.equal(rawFormat(isolatedLayers,'{}',0,pointer+1,needed),-3);
    assert(module.HEAPU8.subarray(pointer,pointer+needed+2).every(byte => byte === 0xa5));
  } finally { module._free(pointer); }
});

test('actual C ABI rejects malformed quest context, missing variants and invalid arguments without output writes',() => {
  const isolatedLayers = isolated({en:{'game.test':'{value}'},ja:{'game.test':'{value}'}});
  const pointer = module._malloc(64); assert(pointer);
  try {
    for (const source of [envelope('game.test',{value:text('x')},{api:'You_feel',helperVariant:'dream'}),envelope('game.test',{wrong:text('x')}),envelope('game.test',{value:text('x')},{quest:{...quest(),sequence:0}}),{...envelope('game.test',{value:text('x')}),context:{api:'pline',helperVariant:'plain',hiddenKnowledge:1}}]) {
      module.HEAPU8.fill(0xa5,pointer,pointer+64);
      assert.equal(rawFormat(isolatedLayers,JSON.stringify(source),0,pointer,64),-3);
      assert(module.HEAPU8.subarray(pointer,pointer+64).every(byte => byte === 0xa5));
    }
  } finally { module._free(pointer); }
});

test('actual accessibility composition preserves a rendered body above the captured-literal limit',() => {
  const isolatedLayers = isolated({en:{'game.long_body':'{first}{second}','context.location_prefix':'{location}: {text}'},ja:{'game.long_body':'{first}{second}','context.location_prefix':'{location}: {text}'}});
  const source = envelope('game.long_body',{first:text('a'.repeat(33000)),second:text('b'.repeat(33000))},{locationPrefix:'north'});
  const result = isolatedLayers.formatEvent(source,'ja');
  assert.equal(new TextEncoder().encode(result.text).length,66007);
  assert.equal(result.text,'north: '+'a'.repeat(33000)+'b'.repeat(33000)); assert.equal(result.usedFallback,true);
});

test('actual ABI rejects oversized envelopes and null nonempty inputs before any output mutation',() => {
  const pointer = module._malloc(16); assert(pointer);
  try {
    module.HEAPU8.fill(0xa5,pointer,pointer+16);
    assert.equal(rawFormat(layers,' '.repeat(256*1024+1),0,pointer,16),-6);
    assert(module.HEAPU8.subarray(pointer,pointer+16).every(byte => byte === 0xa5));
    const result = module.ccall('nh_rust_format_gameplay','number',['number','number','number','number','number','number','number'],[0,1,0,0,0,pointer,16]);
    assert.equal(result,-1); assert(module.HEAPU8.subarray(pointer,pointer+16).every(byte => byte === 0xa5));
  } finally { module._free(pointer); }
});

test('actual nested depth and expansion budgets fail closed including unrendered union values',() => {
  const isolatedLayers = isolated({en:{'name.wrap':'{name}','name.leaf':'leaf','quest.only':'complete'},ja:{'name.wrap':'{name}','name.leaf':'葉','quest.only':'完成'},argument_schemas:{'quest.only':['unused']}});
  let name = {id:'name.leaf',args:{}};
  for (let depth=0;depth<8;depth++) name = {id:'name.wrap',args:{name:nested(name)}};
  assert.equal(isolatedLayers.formatEvent(envelope(name.id,name.args),'ja').text,'葉');
  const tooDeep = {id:'quest.only',args:{unused:nested(name)}};
  assert.equal(rawFormat(isolatedLayers,JSON.stringify(envelope(tooDeep.id,tooDeep.args))),-3);
  const expansionLayers = isolated({en:{'name.wrap':'{name}'.repeat(8),'name.leaf':''},ja:{'name.wrap':'{name}'.repeat(8),'name.leaf':''}});
  let repeated = {id:'name.leaf',args:{}};
  for (let depth=0;depth<8;depth++) repeated = {id:'name.wrap',args:{name:nested(repeated)}};
  assert.equal(rawFormat(expansionLayers,envelope(repeated.id,repeated.args)),-3);
});

test('actual repeated Japanese/English formatting and off-scope getter reads preserve all native state/RNG checksums',() => {
  const before = checksums();
  const id = 'nethack.message.eat.eatspecial.pline.yuck_c.dbe94b5155';
  for (let iteration=0;iteration<20;iteration++) {
    assert.equal(module.ccall('nh_abi_semantic_event','number',['string','number'],['shim_putstr',1]),0);
    assert(layers.formatEvent(envelope(id,{arg_1:{type:'integer',value:33}}),iteration%2 ? 'en' : 'ja').text.length > 0);
  }
  assert.deepEqual(checksums(),before);
});
