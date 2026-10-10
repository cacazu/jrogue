// Tiny source/mock contract tests. No real Rust WASM, DCSS or browser is run.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { createStartupTextBridge, loadStartupTextBridge, STARTUP_TEXT_PIN as pin } from '../web/startup-text.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const installed = 'C:\\Users\\kit\\gameme\\jnethack\\jrouge\\dcss';
const encode = new TextEncoder();
const decode = new TextDecoder('utf-8', { fatal: true });
const results = [];
function probe(name, fn) { fn(); results.push(name); }
async function asyncProbe(name, fn) { await fn(); results.push(name); }
const okResponse = (request, text = pin[request.language]) => ({
  ok: true, value: null, session: null, messages: [request.message], text: [text],
});

function mockBoundary(options = {}) {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const allocations = new Map(), requests = [], releases = [];
  let next = 256;
  const exports = {
    memory,
    dcss_allocate(length) {
      if (options.allocateFail) return 0;
      if (options.growAllocate) memory.grow(1);
      const pointer = next; next += length + 16;
      allocations.set(pointer, length);
      return pointer;
    },
    dcss_request(pointer, length) {
      const request = JSON.parse(decode.decode(new Uint8Array(memory.buffer, pointer, length)));
      requests.push(request);
      if (options.onRequest) options.onRequest(request);
      if (options.requestThrow) throw new Error('mock request failed');
      if (options.descriptor !== undefined) return options.descriptor;
      if (options.alias) return (BigInt(length) << 32n) | BigInt(pointer);
      if (options.growRequest) memory.grow(1);
      const response = options.response ? options.response(request) : okResponse(request);
      const bytes = options.rawResponse ?? encode.encode(JSON.stringify(response));
      const output = next; next += bytes.length + 16;
      new Uint8Array(memory.buffer, output, bytes.length).set(bytes);
      allocations.set(output, bytes.length);
      return (BigInt(bytes.length) << 32n) | BigInt(output);
    },
    dcss_release(pointer, length) {
      assert.equal(allocations.get(pointer), length, 'release owns the exact allocation');
      allocations.delete(pointer); releases.push([pointer, length]);
      if (options.releaseThrow && releases.length === 1) throw new Error('mock release failed');
    },
  };
  return { exports, requests, releases, allocations };
}

probe('both-language preflight and pinned Japanese session', () => {
  const mock = mockBoundary();
  const bridge = createStartupTextBridge(mock.exports);
  assert.deepEqual(mock.requests.map(r => r.language), ['en', 'ja']);
  assert.equal(bridge.format(pin.id, {}), pin.ja);
  assert.equal(bridge.language, 'ja');
  assert.equal(mock.allocations.size, 0);
  assert.equal(mock.releases.length, 6);
  assert.ok(Object.isFrozen(bridge));
});
probe('English session source parity', () => {
  const mock = mockBoundary();
  assert.equal(createStartupTextBridge(mock.exports, 'en').format(pin.id, {}), pin.en);
  assert.equal(mock.allocations.size, 0);
});
probe('fresh memory views after allocation and request growth', () => {
  const mock = mockBoundary({ growAllocate: true, growRequest: true });
  assert.equal(createStartupTextBridge(mock.exports).format(pin.id, {}), pin.ja);
  assert.equal(mock.allocations.size, 0);
});
for (const [name, language] of [['invalid locale', 'fr'], ['numeric locale', 1]]) {
  probe(name, () => assert.throws(() => createStartupTextBridge(mockBoundary().exports, language)));
}
for (const [name, id, params] of [
  ['unknown semantic ID', 'startup.name.prompt', {}],
  ['extra parameters', pin.id, { player_name: 'External' }],
  ['array parameters', pin.id, []], ['null parameters', pin.id, null],
]) {
  probe(name, () => {
    const mock = mockBoundary(); const bridge = createStartupTextBridge(mock.exports);
    assert.throws(() => bridge.format(id, params)); assert.equal(mock.requests.length, 2);
    assert.equal(mock.allocations.size, 0);
  });
}
probe('missing and wrong-arity ABI rejected before request', () => {
  const mock = mockBoundary(); delete mock.exports.dcss_release;
  assert.throws(() => createStartupTextBridge(mock.exports));
  const other = mockBoundary(); other.exports.dcss_request = function() {};
  assert.throws(() => createStartupTextBridge(other.exports));
  assert.equal(mock.requests.length + other.requests.length, 0);
});
for (const [name, options] of [
  ['null allocation', { allocateFail: true }],
  ['request exception releases input', { requestThrow: true }],
  ['zero descriptor', { descriptor: 0n }],
  ['negative descriptor', { descriptor: -1n }],
  ['numeric descriptor', { descriptor: 12 }],
  ['u64 overflow descriptor', { descriptor: 1n << 64n }],
  ['out-of-range output pointer', { descriptor: (1n << 32n) | 0xfffffff0n }],
  ['oversized output', { descriptor: (2049n << 32n) | 8192n }],
  ['aliased output never double-freed', { alias: true }],
  ['invalid UTF-8 rejected', { rawResponse: Uint8Array.of(0xff, 0xfe) }],
  ['malformed response JSON', { rawResponse: encode.encode('{') }],
  ['failed Text response', { response: () => ({ ok: false }) }],
  ['extra response fields', { response: r => ({ ...okResponse(r), extra: true }) }],
  ['session mutation response', { response: r => ({ ...okResponse(r), session: 'state' }) }],
  ['value mutation response', { response: r => ({ ...okResponse(r), value: { action: 1 } }) }],
  ['wrong echoed ID', { response: r => ({ ...okResponse(r), messages: [{ id: 'wrong', params: {} }] }) }],
  ['wrong echoed parameters', { response: r => ({ ...okResponse(r), messages: [{ id: pin.id, params: { x: 1 } }] }) }],
  ['two rendered messages', { response: r => ({ ...okResponse(r), text: [pin.en, pin.ja] }) }],
  ['embedded NUL', { response: r => okResponse(r, pin[r.language] + '\0') }],
  ['wrong locale text', { response: r => okResponse(r, 'fallback') }],
]) {
  probe(name, () => {
    const mock = mockBoundary(options);
    assert.throws(() => createStartupTextBridge(mock.exports));
    assert.equal(mock.allocations.size, 0);
  });
}
probe('output-release failure still releases the input', () => {
  const mock = mockBoundary({ releaseThrow: true });
  assert.throws(() => createStartupTextBridge(mock.exports));
  assert.equal(mock.allocations.size, 0); assert.equal(mock.releases.length, 2);
});
probe('reentrancy blocked and allocations recovered', () => {
  let bridge;
  const mock = mockBoundary({ onRequest() { if (bridge) bridge.format(pin.id, {}); } });
  bridge = createStartupTextBridge(mock.exports);
  assert.throws(() => bridge.format(pin.id, {}), /reentrant/);
  assert.equal(mock.allocations.size, 0);
});
probe('50 renders use only immutable Text requests and release both allocations', () => {
  const mock = mockBoundary(); const bridge = createStartupTextBridge(mock.exports);
  for (let i = 0; i < 50; i++) assert.equal(bridge.format(pin.id, {}), pin.ja);
  assert.ok(mock.requests.every(r => r.op === 'text' && Object.keys(r).sort().join() === 'language,message,op'));
  assert.equal(mock.allocations.size, 0);
});

function fetchFiles(change) {
  return async path => {
    let bytes = readFileSync(join(installed, path.slice(1)));
    if (change) bytes = change(path, bytes);
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  };
}
await asyncProbe('actual source/artifact hashes preflight with mocked WASM only', async () => {
  const mock = mockBoundary(); let instantiated = 0;
  const bridge = await loadStartupTextBridge('ja', {
    fetcher: fetchFiles(), crypto: webcrypto,
    instantiate: async (bytes, imports) => {
      assert.equal(bytes.length, pin.boundary.bytes); assert.deepEqual(imports, {});
      instantiated++; return { instance: { exports: mock.exports } };
    },
  });
  assert.equal(instantiated, 1); assert.equal(bridge.format(pin.id, {}), pin.ja);
});
for (const path of [...pin.catalogs.map(p => p.path), pin.boundary.path]) {
  await asyncProbe('checksum rejects before instantiate: ' + path, async () => {
    let instantiated = 0;
    await assert.rejects(loadStartupTextBridge('ja', {
      fetcher: fetchFiles((p, bytes) => p === path ? Buffer.concat([bytes.subarray(0, bytes.length - 1), Buffer.of(bytes.at(-1) ^ 1)]) : bytes),
      crypto: webcrypto, instantiate: async () => { instantiated++; return {}; },
    }), /checksum/);
    assert.equal(instantiated, 0);
  });
}
await asyncProbe('failed fetch rejects before instantiate', async () => {
  await assert.rejects(loadStartupTextBridge('ja', {
    fetcher: async () => ({ ok: false }), crypto: webcrypto,
    instantiate: async () => { throw new Error('must never instantiate'); },
  }), /fetch/);
});
await asyncProbe('source identity validation rejects an independently malformed receipt', async () => {
  let digests = 0, instantiated = 0;
  const fakeCrypto = { subtle: { async digest() {
    const digest = pin.catalogs[digests++].sha256;
    return Uint8Array.from(digest.match(/../g), pair => parseInt(pair,16)).buffer;
  } } };
  await assert.rejects(loadStartupTextBridge('ja', {
    fetcher: fetchFiles((path, bytes) => {
      if (!path.endsWith('source-map.json')) return bytes;
      const source = JSON.parse(bytes.toString()); source.commit = 'wrong';
      return Buffer.from(JSON.stringify(source));
    }), crypto: fakeCrypto,
    instantiate: async () => { instantiated++; return {}; },
  }), /source identity/);
  assert.equal(instantiated, 0);
});
await asyncProbe('artifact size mismatch rejects before mocked instantiation', async () => {
  let instantiated = 0;
  await assert.rejects(loadStartupTextBridge('ja', {
    fetcher: fetchFiles((path, bytes) => path.endsWith('boundary.wasm') ? bytes.subarray(1) : bytes),
    crypto: webcrypto, instantiate: async () => { instantiated++; return {}; },
  }), /size mismatch/);
  assert.equal(instantiated, 0);
});

const library = readFileSync(join(root, 'engine/library.js'), 'utf8');
function nativeLibrary(callback = () => pin.ja, errorCallback = () => {}) {
  const heap = new Uint8Array(8192).fill(0xee); let definitions, forbiddenReads = 0;
  const Module = { dcssFormatStartup: callback, dcssStartupTextError: errorCallback };
  Object.defineProperty(Module, 'HEAPU8', { get() { forbiddenReads++; throw new Error('unexported heap getter'); } });
  for (const name of ['_dcss_snapshot_json', '_dcss_repaint', '_dcss_save', 'dcssReadKey']) {
    Object.defineProperty(Module, name, { get() { forbiddenReads++; throw new Error('native reentry'); } });
  }
  const write = (text, ptr) => { const bytes = encode.encode(text); heap.set(bytes, ptr); heap[ptr + bytes.length] = 0; };
  write(pin.id, 100); write('{}', 200);
  const context = { Module, HEAPU8: heap, LibraryManager: { library: {} },
    mergeInto(_target, value) { definitions = value; },
    UTF8ToString(ptr, max) {
      const end = heap.subarray(ptr, ptr + max).indexOf(0);
      return decode.decode(heap.subarray(ptr, ptr + (end < 0 ? max : end)));
    }, lengthBytesUTF8: text => encode.encode(text).length,
    stringToUTF8(text, ptr, cap) {
      const bytes = encode.encode(text); assert.ok(bytes.length < cap); heap.set(bytes, ptr); heap[ptr + bytes.length] = 0;
    },
  };
  vm.runInNewContext(library, context);
  return { heap, write, definitions, call: (...args) => definitions.dcss_host_startup_text(...args),
    get forbiddenReads() { return forbiddenReads; } };
}
probe('native import copies exact UTF-8 and terminator into caller memory', () => {
  const lib = nativeLibrary((id, params) => { assert.equal(id, pin.id); assert.deepEqual(Object.keys(params), []); return pin.ja; });
  assert.equal(lib.call(100, 200, 300, 512), 24);
  assert.deepEqual(lib.heap.slice(300, 324), encode.encode(pin.ja));
  assert.equal(lib.heap[324], 0); assert.equal(lib.heap[299], 0xee); assert.equal(lib.heap[812], 0xee);
  assert.equal(lib.forbiddenReads, 0);
});
for (const [name, callback] of [
  ['throwing formatter', () => { throw new Error('formatter failed'); }],
  ['Promise formatter', () => Promise.resolve(pin.ja)],
  ['empty formatter', () => ''], ['NUL formatter', () => 'bad\0text'],
  ['unreviewed formatter', () => 'fallback'], ['oversized formatter', () => 'x'.repeat(512)],
]) {
  probe('native ' + name + ' is contained without writes or native reentry', () => {
    let diagnostics = 0; const lib = nativeLibrary(callback, () => { diagnostics++; throw new Error('observer failed'); });
    assert.equal(lib.call(100, 200, 300, 512), -1); assert.equal(diagnostics, 1);
    assert.ok(lib.heap.slice(300, 812).every(byte => byte === 0xee));
    assert.equal(lib.forbiddenReads, 0);
  });
}
for (const args of [[100,200,300,511], [100,200,8000,512], [0,200,300,512], [100,8191,300,512]]) {
  probe('native pointer/capacity rejection ' + args.join(','), () => {
    let calls = 0; const lib = nativeLibrary(() => { calls++; return pin.ja; });
    assert.equal(lib.call(...args), -1); assert.equal(calls, 0);
  });
}
probe('native exact ID/params whitelist', () => {
  let calls = 0; const lib = nativeLibrary(() => { calls++; return pin.ja; });
  lib.write('startup.weapon.other', 100); assert.equal(lib.call(100,200,300,512), -1);
  lib.write(pin.id, 100); lib.write('[]',200); assert.equal(lib.call(100,200,300,512), -1);
  assert.equal(calls, 0);
});

probe('reversible one-site native source patch preserves every original control byte', () => {
  const original = readFileSync(join(root,'base/newgame.cc'),'utf8').replace(/\r\n/g,'\n');
  const staged = readFileSync(join(root,'engine/newgame.cc'),'utf8');
  const inverted = staged.replace(/\/\/ BEGIN jrogue startup-weapon-prompt adapter v1\n[\s\S]*?\/\/ END jrogue startup-weapon-prompt adapter v1\n\n/, '')
    .replace('formatted_string(_dcss_startup_weapon_prompt(), CYAN)', 'formatted_string("You have a choice of weapons.", CYAN)');
  assert.equal(inverted, original);
  assert.match(staged, /char text\[512\] = \{\};/); assert.match(staged, /end\(1\);/);
  assert.doesNotMatch(staged.slice(staged.indexOf('// BEGIN jrogue'), staged.indexOf('// END jrogue')), /random2\(|mpr\(|getch\(/);
});
probe('preflight precedes factory/main and locale is session-pinned', () => {
  const worker = readFileSync(join(root,'web/core-worker.js'),'utf8');
  const debug = readFileSync(join(root,'web/core-debug.mjs'),'utf8');
  assert.ok(worker.indexOf('await loadStartupTextBridge') < worker.indexOf('engine = await self.createDcssEngine'));
  assert.ok(debug.indexOf('unsupported native startup locale') < debug.indexOf('new Worker('));
  assert.match(debug, /files, runtime, language: nativeLanguage/); assert.match(debug, /get nativeLanguage/);
  assert.doesNotMatch(worker, /op === 'language'|startupText\.language\s*=/);
  assert.doesNotMatch(library, /dcss_host_startup_text__async/);
});

function workerHost(loadBridge) {
  const messages = [], order = []; let options;
  const self = { postMessage(message) { messages.push(message); }, addEventListener() {},
    async createDcssEngine(value) { order.push('factory'); options = value; return { FS: { mkdirTree() {} } }; } };
  const source = readFileSync(join(root,'web/core-worker.js'),'utf8').replace(
    "import('/web/startup-text.mjs')", 'Promise.resolve({ loadStartupTextBridge: mockLoadStartupTextBridge })');
  vm.runInNewContext(source, { self, WebAssembly, Error, queueMicrotask,
    mockLoadStartupTextBridge: async language => { order.push('preflight'); return loadBridge(language); },
    importScripts() { order.push('load-native-script'); },
  });
  return { self, messages, order, get options() { return options; } };
}
await asyncProbe('mock Worker preflight failure never loads or constructs the native factory', async () => {
  const host = workerHost(() => { throw new Error('bad startup checksum'); });
  await host.self.onmessage({ data: { type: 'request', id: 1, op: 'boot', runtime: 'asyncify', language: 'ja', files: [] } });
  assert.deepEqual(host.order, ['preflight']);
  assert.ok(host.messages.some(message => message.type === 'fatal' && message.error.includes('bad startup checksum')));
});
await asyncProbe('mock Worker boots only after preflight and keeps a synchronous session formatter', async () => {
  const mock = mockBoundary();
  const host = workerHost(language => createStartupTextBridge(mock.exports, language));
  await host.self.onmessage({ data: { type: 'request', id: 2, op: 'boot', runtime: 'asyncify', language: 'en', files: [] } });
  assert.deepEqual(host.order, ['preflight','load-native-script','factory']);
  assert.equal(host.options.noInitialRun, true);
  assert.equal(host.options.dcssFormatStartup(pin.id, {}), pin.en);
  assert.ok(host.messages.some(message => message.type === 'response' && message.id === 2 && message.ok === true));
  host.options.dcssStartupTextError('display conversion failed');
  assert.ok(host.messages.some(message => message.type === 'startup-text-error'));
  assert.ok(!host.messages.some(message => message.type === 'semantic'));
  host.options.onExit(1);
  assert.throws(() => host.options.dcssFormatStartup(pin.id, {}));
  assert.equal(mock.allocations.size, 0);
});
for (const interruption of ['invalid-key', 'duplicate-boot']) {
  await asyncProbe('deferred mock Worker preflight stops after asynchronous ' + interruption + ' failure', async () => {
    let release;
    const host = workerHost(() => new Promise(resolve => { release = resolve; }));
    const boot = host.self.onmessage({ data: { type:'request', id:10, op:'boot', runtime:'asyncify', language:'ja', files:[] } });
    // Advance the import microtask only; no timers or native execution.
    for (let i=0; i<4 && !release; i++) await Promise.resolve();
    assert.equal(typeof release, 'function');
    if (interruption === 'invalid-key') {
      await host.self.onmessage({ data:{ type:'key', key:1.5 } });
    } else {
      await host.self.onmessage({ data:{ type:'request', id:11, op:'boot', runtime:'asyncify', language:'ja', files:[] } });
    }
    assert.equal(host.messages.filter(message => message.type === 'fatal').length, 1);
    release({ language:'ja', format() { throw new Error('must not format after terminal failure'); } });
    await boot;
    assert.deepEqual(host.order, ['preflight']);
    assert.equal(host.options, undefined);
    assert.equal(host.messages.filter(message => message.type === 'fatal').length, 1);
    assert.ok(!host.messages.some(message => message.type === 'response' && message.id === 10 && message.ok));
  });
}
probe('staged source hashes match transformation receipts', () => {
  const receipts = JSON.parse(readFileSync(join(root,'source-receipts.json'),'utf8'));
  for (const [path, receipt] of Object.entries({ ...receipts.transformations, ...receipts.new_files, ...receipts.review_files })) {
    const hash = createHash('sha256').update(readFileSync(join(root,path))).digest('hex');
    assert.equal(hash, receipt.staged_sha256);
  }
});
const report = { ok: true, probes: results.length, results,
  tested_utc: new Date().toISOString(),
  scope: 'source and mock boundaries only; zero real Rust WASM/engine/browser executions' };
writeFileSync(join(root, 'test-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, probes: results.length, report: 'test-results.json', scope: report.scope }));
