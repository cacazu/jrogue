/* Real compiled Rust/engine boundary checks; no game is started. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import createNetHackModule from '../web/engine/nethack.js';
import { RustLayers, EngineMemory, SOURCE_COMMIT, HOST_ABI } from '../web/shim-host.mjs';
import { SaveStore, bytesToBase64, AUXILIARY_FORMAT } from '../web/save-store.mjs';

const wasmBinary = new Uint8Array(readFileSync(new URL('../web/engine/nethack.wasm',import.meta.url)));
const module = await createNetHackModule({noInitialRun:true,wasmBinary});
const catalog = JSON.parse(readFileSync(new URL('../web/browser-ui.json',import.meta.url),'utf8'));
const layers = new RustLayers(module,catalog);
const store = new SaveStore(module);

test('compiled C ABI layout is accepted by the host, not guessed from an old release',() => {
  const layout = JSON.parse(module.ccall('nh_abi_layout_json','string',[],[]));
  const memory = new EngineMemory(module,layout);
  assert.equal(memory.layout.anythingSize,8); assert.equal(memory.layout.menuItemSize,16);
  assert.equal(layout.menuCountOffset,8); assert.equal(layout.menuFlagsOffset,12);
  assert.equal(layout.playerNameSize,32); assert.equal(layout.lineBufferSize,256);
});
test('every browser UI ID formats identically through the actual Rust ABI in both locales',() => {
  for (const locale of ['ja','en']) {
    for (const [id,template] of Object.entries(catalog[locale])) {
      const args = {count:3,max:255,reason:'日本語 % {literal}'};
      const expected = template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g,(_,key) => String(args[key]));
      const required = Object.fromEntries([...template.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(match => [match[1],args[match[1]]]));
      assert.equal(layers.format(id,required,locale),expected,`${locale}:${id}`);
    }
  }
  assert.equal(module.ccall('nh_rust_default_locale','number',[],[]),0);
});
test('actual Rust keyboard/direction mapping preserves command bytes and numeric/phone/QWERTZ options',() => {
  assert.equal(layers.keycode('s',0,0),115); assert.equal(layers.keycode('S',4,0),83);
  assert.equal(layers.keycode('p',1,0),16); assert.equal(layers.keycode('p',2,0),240);
  assert.equal(layers.keycode('日',0,0),-2); assert.equal(layers.keycode('r',8,0),-2);
  assert.equal(layers.direction(-1,-1,false,1,0),121); assert.equal(layers.direction(-1,-1,false,1,1),55);
  assert.equal(layers.direction(-1,-1,true,0,1),183); assert.equal(layers.direction(-1,-1,false,1,2),49);
  assert.equal(layers.direction(-1,-1,false,1,3),122);
});
test('completed Unicode text crosses the real Rust boundary literally and NUL is rejected',() => {
  assert.equal(layers.textInsert('日本語 % {item} 🗝'), '日本語 % {item} 🗝');
  assert.equal(layers.textInsert(''),''); assert.throws(() => layers.textInsert('x\u0000y'),/Invalid text input/);
});
test('real Rust envelope round-trip restores original save file bytes and source metadata',() => {
  const payload = {format:'nethack-completed-save-files-v1',source:SOURCE_COMMIT,abi:HOST_ABI,playerName:'日本語',files:[{name:'0日本語',data:bytesToBase64(new Uint8Array([0,255,128,10]))}]};
  const envelope = store.encode(payload); const decoded = store.decode(envelope);
  assert.equal(decoded.playerName,'日本語'); assert.deepEqual(Array.from(decoded.files[0].bytes),[0,255,128,10]);
  // This checks the compiled platform boundary. Core restore compatibility is
  // independently verified using real game-produced saves in browser QA.
  const corrupted = JSON.parse(envelope);
  corrupted.payload = (corrupted.payload[0] === '0' ? '1' : '0') + corrupted.payload.slice(1);
  assert.throws(() => store.decode(JSON.stringify(corrupted)),/validation/);
});
test('actual Rust envelopes keep auxiliary history independent, portable, and compatible with game-only imports',() => {
  const payload = {format:'nethack-completed-save-files-v1',source:SOURCE_COMMIT,abi:HOST_ABI,playerName:'Player',files:[{name:'0Player',data:'AP+A'}]};
  const auxiliary = {format:AUXILIARY_FORMAT,source:SOURCE_COMMIT,abi:HOST_ABI,files:[{name:'record',data:'U2NvcmUK'},{name:'xlogfile',data:''},{name:'bonQVal.L',data:'AP+A'}]};
  const state = {latest:store.encode(payload),auxiliary:store.encodeAuxiliary(auxiliary)};
  const exported = store.exportState(state);
  assert.deepEqual(store.importState(exported,{latest:null,auxiliary:null}),state);
  assert.equal(store.importState(state.latest,state).auxiliary,state.auxiliary);
  const historyOnly = store.exportState({...state,latest:null});
  const restored = store.importState(historyOnly,{latest:null,auxiliary:null});
  assert.equal(restored.latest,null); assert.equal(restored.auxiliary,state.auxiliary);
  assert.deepEqual(Array.from(store.decodeAuxiliary(restored.auxiliary).files[2].bytes),[0,255,128]);
  assert.throws(() => store.encode({...payload,auxiliary:{...auxiliary,files:[{name:'nhdat',data:'AQ=='}]}}),/Unsafe/);
  const damaged = JSON.parse(historyOnly); damaged.payload = (damaged.payload[0] === '0' ? '1' : '0') + damaged.payload.slice(1);
  assert.throws(() => store.importState(JSON.stringify(damaged),state),/validation/);
});
