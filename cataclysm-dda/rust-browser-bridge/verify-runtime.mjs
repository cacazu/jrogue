import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createBridge, loadBridge } from './browser-bridge.mjs';

const own = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(own, 'target', 'wasm32-unknown-unknown', 'release', 'cdda_rust_browser_bridge.wasm');
const bytes = await readFile(wasmPath);
const module = await WebAssembly.compile(bytes);
const imports = WebAssembly.Module.imports(module);
assert.deepEqual(imports, [], 'No RNG, clock, engine, browser or storage capability import');
const instance = await WebAssembly.instantiate(module, {});
const manifest = JSON.parse(await readFile(path.join(own, 'text-manifest.json')));
const bridge = createBridge(instance, manifest);
let assertions = 1;
const equal = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
const rejects = (callback, message) => { assert.throws(callback, message); assertions++; };
const wrongManifest = structuredClone(manifest);
wrongManifest.entries[0].id = 'unrelated.semantic_id';
rejects(() => createBridge(instance, wrongManifest), /compiled text ID mismatch/);
const shortManifest = structuredClone(manifest);
shortManifest.entries.pop();
rejects(() => createBridge(instance, shortManifest), /text count mismatch/);
const keys = ['ArrowUp','u','ArrowRight','n','ArrowDown','b','ArrowLeft','y'];
for (let direction = 0; direction < 8; direction++) {
  equal(bridge.gamepadDirection(direction, 'gameplay'), keys[direction]);
  equal(bridge.gamepadDirection(direction, 'menu'), keys[direction]);
  equal(bridge.gamepadDirection(direction, 'character_name'), null);
}
for (const [control, key] of [['pause','.'], ['wait_minutes','|'], ['save_quit','S'],
  ['inventory','i'], ['examine','e'], ['pickup','g']]) equal(bridge.touch(control, 'gameplay'), key);
equal(bridge.touch('confirm', 'menu'), 'Enter');
equal(bridge.touch('cancel', 'character_name'), 'Escape');
equal(bridge.touch('save_quit', 'character_name'), null);
equal(bridge.gamepadButton(5), 'i');
equal(bridge.gamepadButton(7), '.');
equal(bridge.gamepadButton(0, 'menu'), null);
equal(bridge.gamepadButton(256), null);
equal(bridge.gamepadDirection(8), null);
equal(bridge.resolveHelperKey('Tab'), {key:'Tab', resolvedBy:'original-cpp-native-key'});
equal(bridge.resolveHelperKey('s', 'gameplay'), {key:'s', resolvedBy:'original-cpp-native-key'});
equal(bridge.resolveHelperKey('猫', 'character_name'), {key:'猫', resolvedBy:'original-cpp-native-key'});
equal(bridge.resolveHelperKey('S', 'gameplay').key, 'S');
equal(bridge.resolveHelperKey('.', 'menu'), {key:'.', resolvedBy:'original-cpp-native-key'});
rejects(() => bridge.touch('north', 'invented'), RangeError);

const sourceCatalogs = Object.fromEntries(await Promise.all(['en', 'ja'].map(async locale =>
  [locale, JSON.parse(await readFile(path.join(own, 'locales', `${locale}.json`)))])));
for (const locale of ['en', 'ja']) {
  for (const entry of manifest.entries) {
    const parameters = Object.fromEntries(Object.entries(entry.parameters).map(([name, kind]) =>
      [name, kind === 'count' ? 7 : 'Alice猫🦀{%s}<script>姓名</script>\0']));
    const expected = sourceCatalogs[locale].entries[entry.id].other.replace(/\{([a-z_]+)\}/g,
      (_, name) => String(parameters[name]));
    equal(bridge.formatText(locale, entry.id, parameters), expected);
  }
}
equal(bridge.defaultLocale, 'ja');
equal(bridge.formatText(undefined, 'command.save_quit'), '保存して終了');
equal(bridge.formatText('en', 'save.exported', {count:18446744073709551615n, bytes:4294967296n}),
  'Exported 18446744073709551615 files (4294967296 bytes).');
for (const callback of [
  () => bridge.formatText('ja', 'runtime.preparing', {completed:1}),
  () => bridge.formatText('ja', 'runtime.preparing', {completed:1, total:2, extra:3}),
  () => bridge.formatText('ja', 'runtime.preparing', {completed:-1, total:2}),
  () => bridge.formatText('ja', 'runtime.preparing', {completed:1.5, total:2}),
  () => bridge.formatText('ja', 'save.exported', {count:Number.MAX_SAFE_INTEGER + 1, bytes:2}),
  () => bridge.formatText('ja', 'save.exported', {count:1n << 64n, bytes:2}),
  () => bridge.formatText('ja', 'runtime.failure', {reason:3}),
  () => bridge.formatText('ja', 'runtime.failure', {reason:'\ud800'}),
  () => bridge.formatText('ja', 'runtime.failure', {reason:'🦀'.repeat(16385)}),
  () => bridge.formatText('ja', 'unregistered.id'),
  () => bridge.formatText('unsupported', 'command.confirm')
]) rejects(callback);
equal(instance.exports.cdda_bridge_touch(0xffffffff, 1), 0);
equal(instance.exports.cdda_bridge_text_push_scalar(0xd800), 1);
equal(instance.exports.cdda_bridge_text_prepare(5, 0, 0, 0, 0, 0), 1);
equal(instance.exports.cdda_bridge_text_len(), 0);
equal(instance.exports.cdda_bridge_text_prepare(0, 0xffffffff, 0, 0, 0, 0), 2);
equal(instance.exports.cdda_bridge_text_len(), 0);

const sequence = () => [bridge.touch('save_quit','gameplay'), bridge.gamepadButton(5),
  bridge.formatText('ja','runtime.preparing',{completed:5,total:7}),
  bridge.formatText('ja','save.failed',{reason:'Player猫🦀{%s}'}), bridge.resolveHelperKey('Tab')];
const expectedSequence = sequence();
for (let iteration = 0; iteration < 500; iteration++) equal(sequence(), expectedSequence);
const fresh = createBridge(await WebAssembly.instantiate(module, {}), manifest);
equal(fresh.formatText('ja', 'runtime.preparing', {completed:5,total:7}), expectedSequence[2]);
const loaded = await loadBridge({fetchImpl:async url => ({ok:true,
  arrayBuffer:async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  json:async () => manifest })});
equal(loaded.touch('pause','gameplay'), '.');
await mkdir(path.join(own,'evidence'), {recursive:true});
const result = {schemaVersion:1, node:process.version, target:'wasm32-unknown-unknown', runtime:'Node WebAssembly',
  passed:true, assertions, deterministicSequences:500, shellIds:27, boundedCatalogIds:manifest.entries.length,
  imports, exports:WebAssembly.Module.exports(module), wasm:{bytes:bytes.length,
    sha256:createHash('sha256').update(bytes).digest('hex')},
  claims:{boundedRustInputAndShellFormatting:true, originalCppEngineIntegration:false,
    fullGameplayRendering:false, browserValidation:false, completeGameplayLocalization:false},
  purityEvidence:'No host imports; input and formatter ABI accepts numeric values only, has no engine handle and only writes private formatter scratch memory.'};
await writeFile(path.join(own,'evidence','wasm-runtime.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
