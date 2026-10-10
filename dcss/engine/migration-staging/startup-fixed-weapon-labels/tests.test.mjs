// Source/ABI mocks for the separately staged fixed weapon slice. No build or real WASM executes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const prior = path.dirname(root);
const installed = process.env.DCSS_REPOSITORY || 'C:/Users/kit/gameme/jnethack/jrouge/dcss';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = (base, relative) => fs.readFileSync(path.join(base, relative));
const normalized = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n');
const receipt = JSON.parse(read(root, 'source-receipts.json'));
const { STARTUP_TEXT_PIN: pin, createStartupTextBridge, loadStartupTextBridge } = await import('./web/startup-text.mjs');
const checks = [];
function check(label, action) { action(); checks.push(label); }
async function checkAsync(label, action) { await action(); checks.push(label); }
const ids = ['startup.weapon.prompt', ...['recommended', 'aptitudes', 'help', 'random', 'back']
  .flatMap(name => ['label', 'description'].map(role => 'startup.weapon.' + name + '.' + role))];
const sourcesBefore = new Map();
for (const [relative, expected] of Object.entries(receipt.source_pins)) {
  const bytes = read(installed, relative); sourcesBefore.set(relative, hash(bytes));
  check('pinned original ' + relative, () => assert.equal(hash(bytes), expected));
}
const cppOriginal = normalized(read(installed, 'upstream/crawl-ref/source/newgame.cc'));
const outer = normalized(read(installed, 'upstream/crawl-ref/source/outer-menu.cc'));
const sourceMap = JSON.parse(read(installed, 'locales/startup/source-map.json'));
const catalogs = Object.fromEntries(['en', 'ja'].map(language => [language,
  JSON.parse(read(installed, 'locales/startup/' + language + '.json'))]));
const cpp = normalized(read(root, 'engine/newgame.cc'));
const librarySource = read(root, 'engine/library.js').toString('utf8');
check('exact 11-ID fixed scope, frozen dictionaries and empty-parameter binding set', () => {
  assert.equal(pin.scope, 'startup-fixed-weapon-v1'); assert.equal(pin.version, 1);
  assert.deepEqual(pin.ids, ids); assert.deepEqual(receipt.ids, ids);
  assert.deepEqual(Object.keys(pin.messages), ids); assert(Object.isFrozen(pin));
  assert(Object.isFrozen(pin.ids)); assert(Object.isFrozen(pin.messages));
});
for (const [relative, transformation] of Object.entries(receipt.transformations)) {
  check('exact candidate inversion ' + relative, () => {
    const bytes = read(root, relative), base = read(prior, relative);
    assert.equal(hash(bytes), transformation.staged_sha256);
    assert.equal(hash(base), transformation.base_sha256);
    sourcesBefore.set('prior:' + relative, hash(base));
    let reconstructed = bytes.toString('utf8');
    for (const { before, after } of [...transformation.patches].reverse()) {
      assert.equal(reconstructed.split(after).length - 1, 1, 'unique after expression');
      reconstructed = reconstructed.replace(after, before);
    }
    assert.equal(hash(Buffer.from(reconstructed)), hash(base), 'byte-for-byte inverse');
  });
}
check('whole native unit restores upstream after removing prior one-ID adapter', () => {
  let original = normalized(read(prior, 'engine/newgame.cc'));
  const start = original.indexOf('// BEGIN jrogue startup-weapon-prompt adapter v1\n');
  const marker = '// END jrogue startup-weapon-prompt adapter v1\n\n';
  const end = original.indexOf(marker, start);
  assert(start > 0 && end > start); original = original.slice(0, start) + original.slice(end + marker.length);
  original = original.replace('formatted_string(_dcss_startup_weapon_prompt(), CYAN)',
    'formatted_string("You have a choice of weapons.", CYAN)');
  assert.equal(original, cppOriginal);
});
for (const binding of receipt.bindings) {
  check('exact original span/catalog/condition binding ' + binding.id, () => {
    const source = cppOriginal.split('\n').slice(binding.line - 1, binding.end_line).join('\n');
    const message = sourceMap.messages.find(value => value.id === binding.id);
    const site = sourceMap.output_sites.find(value => value.message_ids.includes(binding.id));
    assert.equal(source, binding.original_expression); assert.equal(hash(Buffer.from(source)), binding.expression_sha256);
    assert.equal(site.source_condition, binding.condition); assert.deepEqual(site.control, binding.control);
    assert.equal(message.expected_en, binding.en); assert.deepEqual(message.params, {});
    assert.equal(message.source_sites[0], binding.source_site); assert.deepEqual(binding.params, {});
    for (const language of ['en', 'ja']) {
      assert.equal(pin.messages[binding.id][language], catalogs[language][binding.id]);
      assert.equal(binding[language], catalogs[language][binding.id]);
      assert(Object.isFrozen(pin.messages[binding.id]));
      assert(Buffer.byteLength(binding[language]) <= 511); assert(!binding[language].includes('\0'));
      for (const token of binding.required_command_tokens) assert(binding[language].includes(token));
    }
    const call = '_dcss_startup_fixed_text(' + JSON.stringify(binding.id) + ', ' + JSON.stringify(binding.en) + ')';
    assert.equal(cpp.split(call).length - 1, 1);
  });
}
function functionBody(source, signature) {
  const start = source.indexOf(signature); assert(start >= 0, signature);
  const end = source.indexOf('\n}\n', start); assert(end > start, signature);
  return source.slice(start, end + 3);
}
const constructor = functionBody(cpp, 'static void _construct_weapon_menu(');
const originalConstructor = functionBody(cppOriginal, 'static void _construct_weapon_menu(');
const nativePrompt = functionBody(cpp, 'static bool _prompt_weapon(');
for (const [name, x, y, hotkey, action] of [
  ['recommended', 0, 0, "'+'", 'M_VIABLE'], ['aptitudes', 0, 1, "'%'", 'M_APTITUDES'],
  ['help', 0, 2, "'?'", 'M_HELP'], ['random', 1, 0, "'*'", 'WPN_RANDOM'],
  ['back', 1, 1, 'CK_BKSP', 'M_ABORT'],
]) {
  check('fixed ' + name + ' label/description retains native position/hotkey/action', () => {
    const label = receipt.bindings.find(value => value.id === 'startup.weapon.' + name + '.label');
    const description = receipt.bindings.find(value => value.id === 'startup.weapon.' + name + '.description');
    const start = constructor.indexOf('_add_menu_sub_item(sub_items, ' + x + ', ' + y + ',');
    assert(start >= 0); const call = constructor.slice(start, constructor.indexOf(');', start) + 2);
    assert(call.includes(JSON.stringify(label.id))); assert(call.includes(JSON.stringify(description.id)));
    assert(call.includes(hotkey)); assert(call.includes(action));
    assert.equal(label.role, 'visible_control_label'); assert.equal(description.role, 'description_assignment');
  });
}
check('labels stay BROWN; descriptions assigned with separate control identity', () => {
  const helper = functionBody(cpp, 'static void _add_menu_sub_item(');
  assert(helper.includes('formatted_string(text, BROWN)'));
  assert(helper.includes('btn->description = description;')); assert(helper.includes('btn->hotkey = letter;'));
  assert(helper.includes('btn->id = id;')); assert(helper.includes('STARTUP_HIGHLIGHT_CONTROL'));
});
check('five description assignments have no visible weapon description pane', () => {
  assert.equal(receipt.bindings.filter(value => value.role === 'description_assignment').length, 5);
  assert(!nativePrompt.includes('descriptions')); assert(!constructor.includes('descriptions'));
  assert(outer.includes('if (descriptions)\n    {\n        auto desc_text = make_shared<Text>(formatted_string(btn->description, WHITE));'));
  assert(outer.includes('desc_text->set_wrap_text(true);'));
  for (const value of receipt.bindings.filter(value => value.role === 'description_assignment'))
    assert.equal(value.console_weapon_visibility, 'not_displayed_no_descriptions_switcher');
});
check('prompt colour, popup conditions, controls and random-resolution code remain exact', () => {
  assert(nativePrompt.includes('), CYAN)')); assert(nativePrompt.includes('formatted_string(_welcome(ng), BROWN)'));
  for (const signature of ['static void _resolve_weapon(', 'static vector<weap_choice> _get_weapons('])
    assert.equal(functionBody(cpp, signature), functionBody(cppOriginal, signature));
  const originalChoose = cppOriginal.slice(cppOriginal.indexOf('// Returns false if aborted, else an actual weapon choice'));
  const stagedChoose = cpp.slice(cpp.indexOf('// Returns false if aborted, else an actual weapon choice'));
  assert.equal(functionBody(stagedChoose, 'static bool _choose_weapon('), functionBody(originalChoose, 'static bool _choose_weapon('));
});
check('native helper retains bounded caller buffer, NUL/length checks and end(1) error path', () => {
  const helper = functionBody(cpp, 'static string _dcss_startup_fixed_text(');
  assert(helper.includes('char text[512] = {};'));
  assert(helper.includes('dcss_host_startup_text(id, "{}",'));
  assert(helper.includes('text, sizeof(text));')); assert(helper.includes('length <= 0 || length >= static_cast<int>(sizeof(text))'));
  assert(helper.includes("text[length] != '\\0'")); assert(helper.includes("string(text, length).find('\\0') != string::npos"));
  assert(helper.includes('end(1);')); assert(helper.includes('return string(text, length);'));
  assert(helper.includes('#else\n    return canonical_english;'));
  assert(!/getch|dcss_host_read_key|random2|one_chance_in|_dcss_snapshot|dcssSemantic/.test(helper));
});
check('dynamic welcome/name/seed/weapon rows/default/aptitudes remain outside the fixed slice', () => {
  const excluded = ['startup.welcome.output', 'startup.name.character.output', 'startup.seed.title.output',
    'startup.weapon.unarmed.output', 'startup.weapon.row.output', 'startup.weapon.aptitude.output', 'startup.weapon.default.output'];
  for (const id of excluded) {
    const site = sourceMap.output_sites.find(value => value.id === id); assert(site, id);
    assert(cpp.includes(site.original_expression), id + ' remains original');
  }
  assert.equal((cppOriginal.match(/_welcome\((?:ng|m_ng)\)/g) || []).length, 3);
  assert.equal((cpp.match(/_welcome\((?:ng|m_ng)\)/g) || []).length, 3);
  assert(originalConstructor.includes('species::has_claws(ng.species) ? "claws" : "unarmed"'));
  assert(constructor.includes('max_text_width = max(max_text_width, strwidth(choice.label))'));
});

function mockAbi() {
  const state = { requests: [], releases: [], mutate: null, raw: null, descriptor: null, onRequest: null,
    growAllocate: false, growRequest: false };
  const memory = new WebAssembly.Memory({ initial: 1 });
  const decoder = new TextDecoder('utf-8', { fatal: true }), encoder = new TextEncoder();
  state.exports = {
    memory,
    dcss_allocate(length) { assert(length > 0 && length <= 1024); if (state.growAllocate) { memory.grow(1); state.growAllocate = false; } return 256; },
    dcss_request(pointer, length) {
      const request = JSON.parse(decoder.decode(new Uint8Array(memory.buffer, pointer, length)));
      assert.equal(request.op, 'text'); assert(ids.includes(request.message.id)); assert.deepEqual(request.message.params, {});
      assert(['en', 'ja'].includes(request.language)); state.requests.push(request);
      if (state.onRequest) state.onRequest(request);
      if (state.descriptor !== null) return state.descriptor;
      if (state.growRequest) { memory.grow(1); state.growRequest = false; }
      let response = { ok: true, value: null, session: null, messages: [request.message],
        text: [pin.messages[request.message.id][request.language]] };
      if (state.mutate) response = state.mutate(response, request);
      const bytes = state.raw || encoder.encode(JSON.stringify(response));
      new Uint8Array(memory.buffer, 4096, bytes.length).set(bytes);
      return (BigInt(bytes.length) << 32n) | 4096n;
    },
    dcss_release(pointer, length) { state.releases.push([pointer, length]); },
  };
  return state;
}
function loaderDependencies(abi, mutation = null, trustedDigest = false) {
  const paths = []; let currentPin;
  const assets = [...pin.catalogs, pin.boundary];
  const dependencies = {
    crypto: trustedDigest ? { subtle: { async digest() { return Uint8Array.from(Buffer.from(currentPin.sha256, 'hex')).buffer; } } } : webcrypto,
    async fetcher(assetPath, request) {
      assert.equal(request.cache, 'no-store'); currentPin = assets.find(value => value.path === assetPath); assert(currentPin);
      paths.push(assetPath); let bytes = read(installed, assetPath.slice(1));
      if (mutation) bytes = mutation(assetPath, bytes);
      return { ok: true, async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } };
    },
    async instantiate(bytes, imports) {
      assert.equal(bytes.length, pin.boundary.bytes); assert.deepEqual(imports, {}); abi.instantiated = (abi.instantiated || 0) + 1;
      return { instance: { exports: abi.exports } };
    },
  };
  return { dependencies, paths };
}
function libraryFixture(formatter) {
  let library; const heap = new Uint8Array(8192); heap.fill(0x5a);
  const state = { heap, diagnostics: [], formats: 0, keys: 0, module: {} };
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
  state.module.dcssFormatStartup = (id, params) => { state.formats++; assert.equal(JSON.stringify(params), '{}'); return formatter(id, params); };
  state.module.dcssStartupTextError = error => state.diagnostics.push(error);
  state.module.dcssReadKey = () => { state.keys++; throw new Error('must not fabricate input'); };
  const context = {
    LibraryManager: { library: {} }, mergeInto(_target, value) { library = value; }, Module: state.module, HEAPU8: heap,
    UTF8ToString(pointer, maximum) {
      const end = pointer + maximum; let cursor = pointer;
      while (cursor < end && heap[cursor] !== 0) cursor++;
      return decoder.decode(heap.subarray(pointer, cursor));
    },
    lengthBytesUTF8: text => encoder.encode(text).length,
    stringToUTF8(text, pointer, capacity) { const bytes = encoder.encode(text); assert(bytes.length < capacity); context.HEAPU8.set(bytes, pointer); context.HEAPU8[pointer + bytes.length] = 0; },
  };
  vm.runInNewContext(librarySource, context);
  state.replaceHeap = replacement => { context.HEAPU8 = replacement; state.heap = replacement; };
  state.call = ({ id = ids[0], params = '{}', idPtr = 128, paramsPtr = 256, destination = 1024, capacity = 512 } = {}) => {
    heap.fill(0x5a);
    if (idPtr > 0 && idPtr + Buffer.byteLength(id) + 1 <= heap.length) { heap.set(encoder.encode(id), idPtr); heap[idPtr + Buffer.byteLength(id)] = 0; }
    if (paramsPtr > 0 && paramsPtr + Buffer.byteLength(params) + 1 <= heap.length) { heap.set(encoder.encode(params), paramsPtr); heap[paramsPtr + Buffer.byteLength(params)] = 0; }
    state.destination = destination; return library.dcss_host_startup_text(idPtr, paramsPtr, destination, capacity);
  };
  return state;
}
const languages = {};
for (const language of ['en', 'ja']) {
  const abi = mockAbi(), deps = loaderDependencies(abi);
  await checkAsync('real JS loader verifies four pinned assets and all 22 EN/JA preflights for session ' + language, async () => {
    languages[language] = await loadStartupTextBridge(language, deps.dependencies);
    assert.equal(languages[language].language, language); assert.equal(abi.instantiated, 1);
    assert.deepEqual(deps.paths, pin.catalogs.map(value => value.path).concat(pin.boundary.path));
    assert.deepEqual(abi.requests.map(value => [value.message.id, value.language]), ids.flatMap(id => [[id, 'en'], [id, 'ja']]));
    assert.equal(abi.releases.length, 44);
  });
  for (const binding of receipt.bindings) {
    check('caller-buffer exact UTF-8 + NUL + sentinels ' + language + ' ' + binding.id, () => {
      const fixture = libraryFixture((id, params) => languages[language].format(id, params));
      const result = fixture.call({ id: binding.id });
      assert.equal(result, Buffer.byteLength(binding[language])); assert.equal(fixture.formats, 1);
      assert.equal(Buffer.from(fixture.heap.subarray(1024, 1024 + result)).toString('utf8'), binding[language]);
      assert.equal(fixture.heap[1024 + result], 0); assert.equal(fixture.heap[1023], 0x5a);
      assert.equal(fixture.heap[1536], 0x5a); assert.equal(fixture.keys, 0); assert.deepEqual(fixture.diagnostics, []);
    });
  }
}
for (const id of ['startup.weapon.row', 'startup.weapon.default.label', 'startup.welcome.empty', 'startup.seed.title', '__proto__', 'toString']) {
  check('bridge rejects unreviewed/dynamic ID ' + id, () => assert.throws(() => languages.ja.format(id, {}), /reviewed ID/));
}
for (const params of [null, [], 'text', { weapon_name: 'dagger' }, { unexpected: 1 }]) {
  check('bridge rejects nonempty/nonobject parameters ' + JSON.stringify(params), () => assert.throws(() => languages.en.format(ids[0], params), /reviewed ID/));
}
check('unsupported language and incompatible ABI reject before formatting', () => {
  assert.throws(() => createStartupTextBridge(mockAbi().exports, 'de'), /unsupported native/);
  assert.throws(() => createStartupTextBridge({ memory: {} }), /unsupported Rust startup ABI/);
  const state = mockAbi(); state.exports.dcss_allocate = function() {};
  assert.throws(() => createStartupTextBridge(state.exports), /unsupported Rust startup ABI/); assert.equal(state.requests.length, 0);
});
for (const [label, mutation, pattern] of [
  ['wrong locale', response => ({ ...response, text: [pin.messages[ids[0]].en] }), /differs from the reviewed locale/],
  ['embedded NUL', response => ({ ...response, text: [response.text[0] + '\0'] }), /differs from the reviewed locale/],
  ['unknown response key', response => ({ ...response, added: 1 }), /invalid Rust startup Text response/],
  ['message identity mismatch', response => ({ ...response, messages: [{ id: ids[1], params: {} }] }), /invalid Rust startup Text response/],
  ['response params', response => ({ ...response, messages: [{ id: ids[0], params: { x: 1 } }] }), /invalid Rust startup Text response/],
  ['oversize native text', response => ({ ...response, text: ['\u6b66'.repeat(171)] }), /differs from the reviewed locale/],
]) {
  check('bridge response rejection and release cleanup: ' + label, () => {
    const state = mockAbi(), bridge = createStartupTextBridge(state.exports, 'ja'); const before = state.releases.length;
    state.mutate = mutation; assert.throws(() => bridge.format(ids[0], {}), pattern);
    assert.equal(state.releases.length - before, 2); state.mutate = null; assert.equal(bridge.format(ids[0], {}), pin.messages[ids[0]].ja);
  });
}
check('fatal UTF-8, invalid descriptor and aliasing reject with owned input released', () => {
  const state = mockAbi(), bridge = createStartupTextBridge(state.exports); let before = state.releases.length;
  state.raw = Uint8Array.from([0x80]); assert.throws(() => bridge.format(ids[0], {}), TypeError); assert.equal(state.releases.length - before, 2);
  state.raw = null;
  for (const descriptor of [0n, 1, (2n << 32n) | 256n, (2049n << 32n) | 4096n]) {
    before = state.releases.length; state.descriptor = descriptor; assert.throws(() => bridge.format(ids[0], {}), /invalid Rust startup response|aliases its input|too large/);
    assert.equal(state.releases.length - before, 1);
  }
});
check('fresh memory views survive growth and reentrant formatting cleans up', () => {
  const state = mockAbi(), bridge = createStartupTextBridge(state.exports, 'ja');
  state.growAllocate = true; state.growRequest = true; assert.equal(bridge.format(ids[1], {}), pin.messages[ids[1]].ja);
  state.onRequest = () => bridge.format(ids[0], {}); assert.throws(() => bridge.format(ids[0], {}), /reentrant/);
  state.onRequest = null; assert.equal(bridge.format(ids[0], {}), pin.messages[ids[0]].ja);
});
for (const [label, options] of [['unknown ID', { id: 'startup.weapon.row' }], ['prototype ID', { id: '__proto__' }],
  ['dynamic params', { params: '{"x":1}' }], ['params missing brace', { params: '{ ' }],
  ['capacity511', { capacity: 511 }], ['capacity513', { capacity: 513 }], ['null destination', { destination: 0 }],
  ['negative destination', { destination: -1 }], ['destination bounds', { destination: 8192 - 511 }],
  ['descriptor bounds', { idPtr: 8192 - 80 }], ['null descriptor', { idPtr: 0 }]]) {
  check('library rejects ' + label + ' before formatter or output writes', () => {
    const fixture = libraryFixture(() => { throw Error('formatter must not be reached'); });
    assert.equal(fixture.call(options), -1); assert.equal(fixture.formats, 0);
    assert.equal(fixture.heap[1024], 0x5a); assert.equal(fixture.diagnostics.length, 1); assert.equal(fixture.keys, 0);
  });
}
for (const [label, formatter] of [['absent', null], ['throws', () => { throw Error('formatter rejected'); }],
  ['empty', () => ''], ['Promise', () => Promise.resolve(pin.messages[ids[0]].ja)],
  ['unreviewed', () => 'translated approximately'], ['embeddedNUL', () => pin.messages[ids[0]].ja + '\0']]) {
  check('library fails closed for formatter ' + label + ' without key fabrication', () => {
    const fixture = libraryFixture(formatter || (() => ''));
    if (!formatter) delete fixture.module.dcssFormatStartup;
    assert.equal(fixture.call(), -1); assert.equal(fixture.heap[1024], 0x5a);
    assert.equal(fixture.diagnostics.length, 1); assert.equal(fixture.keys, 0);
  });
}
check('library rechecks destination after formatter and contains a throwing diagnostic', () => {
  const fixture = libraryFixture(() => { fixture.replaceHeap(new Uint8Array(1)); return pin.messages[ids[0]].ja; });
  fixture.module.dcssStartupTextError = () => { throw Error('diagnostic failed'); };
  assert.equal(fixture.call(), -1); assert.equal(fixture.formats, 1); assert.equal(fixture.keys, 0);
});
await checkAsync('real checksum rejects changed source map before mock instantiate', async () => {
  const state = mockAbi(), deps = loaderDependencies(state, (assetPath, bytes) => {
    if (assetPath !== '/locales/startup/source-map.json') return bytes;
    const copy = Buffer.from(bytes); copy[0] ^= 1; return copy;
  });
  await assert.rejects(loadStartupTextBridge('ja', deps.dependencies), /checksum mismatch/); assert.equal(state.instantiated || 0, 0);
});
for (const [label, mutate] of [
  ['source commit', value => { value.commit = 'unreviewed'; }],
  ['fixed source site', value => { value.messages.find(message => message.id === ids[1]).source_sites = ['wrong.site']; }],
  ['receipt params', value => { value.messages.find(message => message.id === ids[1]).params = { x: 'text' }; }],
]) {
  await checkAsync('isolated loader source-contract rejection: ' + label, async () => {
    const state = mockAbi(), deps = loaderDependencies(state, (assetPath, bytes) => {
      if (assetPath !== '/locales/startup/source-map.json') return bytes;
      const value = JSON.parse(bytes); mutate(value); return Buffer.from(JSON.stringify(value));
    }, true); // Only this source-contract test stubs digests; the success/corruption cases use real SHA-256.
    await assert.rejects(loadStartupTextBridge('ja', deps.dependencies), /source identity mismatch|fixed text source mismatch/);
    assert.equal(state.instantiated || 0, 0); assert(!deps.paths.includes(pin.boundary.path));
  });
}
check('installed source/catalog and current one-ID candidate files stayed byte-identical', () => {
  for (const [relative, before] of sourcesBefore) {
    const base = relative.startsWith('prior:') ? prior : installed;
    const file = relative.replace(/^prior:/, ''); assert.equal(hash(read(base, file)), before, relative);
  }
});
console.log(JSON.stringify({ kind: 'future 11-ID fixed weapon source/ABI mocks', count: checks.length, checks,
  ids: ids.length, fixed_new_bindings: 10, visible_new_labels: 5, description_assignments: 5,
  descriptions_displayed_in_weapon_popup: false, preflight_calls_per_bridge: 22,
  actual_engine_executed: false, actual_wasm_executed: false, actual_wasm_instantiated: false,
  production_bridge_js_executed: true, real_asset_hash_checks_executed: true,
  browser_or_sdk_or_build_executed: false, installed_or_current_candidate_modified: false,
  native_frames_save_rng_or_cjk_width_proved: false }, null, 2));
