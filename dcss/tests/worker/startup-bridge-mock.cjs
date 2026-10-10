'use strict';
// Test-only V2 import seam. No native engine or compiled WASM is executed.
// The production JS bridge verifies pinned bytes; instantiate returns mock ABI
// exports. WebAssembly.Memory is used solely as a bounded data buffer.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { webcrypto, createHash } = require('node:crypto');

const IMPORT = "import('/web/startup-text.mjs')";
const ID = 'startup.weapon.prompt';
const PIN_SHA256 = 'e05f9c90ae5be2d9c18593f1f2da6e130e50c717aef2336c38ef360f740e670a';
const FIXTURE_SHA256 = 'dc1ae79a47eb12eabb2987b53718a25e7b44e83b360ade1168c30d07f701b968';
const WORKER_SHA256 = '310f3501394d9c2ed86eb6e8f3d7593da6ab6142af784bf7b32d400c6fe6145f';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function repositoryPath() {
  return process.env.DCSS_REPOSITORY || path.resolve(__dirname, '../..');
}
function workerPath() {
  return process.env.DCSS_WORKER_SOURCE || path.join(repositoryPath(), 'web/core-worker.js');
}
function bridgePath() {
  return process.env.DCSS_STARTUP_BRIDGE_SOURCE || path.join(repositoryPath(), 'web/startup-text.mjs');
}
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const pinFile = path.join(repositoryPath(), 'tools/startup-fixture-v2-pin.json');
const pinBytes = fs.readFileSync(pinFile);
assert.equal(hash(pinBytes), PIN_SHA256, 'independently reviewed V2 pin bytes');
const reviewed = JSON.parse(pinBytes);
const PIN = freeze(reviewed.pin);
const EXPECTED = freeze(reviewed.identity);
assert.equal(EXPECTED.schema_version, 2);
assert.equal(EXPECTED.source, 'startup-text-v2');
assert.equal(PIN.ids.length, 45);
assert.equal(new Set(PIN.ids).size, 45);
assert.deepEqual(EXPECTED.ids, PIN.ids);
assert.deepEqual(Object.keys(PIN.messages).sort(), [...PIN.ids].sort());
assert.equal(PIN.catalogs.length, 14);
assert.equal(EXPECTED.boundary_sha256, PIN.boundary.sha256);
assert.equal(EXPECTED.boundary_bytes, PIN.boundary.bytes);
const fixtureFile = path.join(repositoryPath(), 'tools/startup-fixture.cjs');
assert.equal(hash(fs.readFileSync(fixtureFile)), FIXTURE_SHA256, 'reviewed pure V2 expected-text fixture');
// Requiring this module reads its immutable pin and defines functions only.
// createStartupFixture is never called: its real WASM path is excluded here.
const { expectedText, EXPECTED: fixtureIdentity } = require(fixtureFile);
assert.deepEqual(fixtureIdentity, EXPECTED);
assert.equal(typeof expectedText, 'function');
function readWorkerSource() {
  const bytes = fs.readFileSync(workerPath());
  assert.equal(hash(bytes), WORKER_SHA256, 'reviewed unmodified production Worker');
  return bytes.toString('utf8');
}
function assertPin(pin) {
  assert.deepEqual(pin, PIN, 'complete reviewed V2 pin, typed schemas, catalogs and entity registry');
}
function createMockExports(pin, events, requests, releases) {
  assertPin(pin);
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  return {
    memory,
    dcss_allocate(length) { assert(Number.isInteger(length) && length > 0 && length <= 4096); return 256; },
    dcss_request(pointer, length) {
      assert.equal(pointer, 256);
      assert(Number.isInteger(length) && length > 0 && length <= 4096);
      const request = JSON.parse(decoder.decode(new Uint8Array(memory.buffer, pointer, length)));
      assert.deepEqual(Object.keys(request).sort(), ['language', 'message', 'op']);
      assert.equal(request.op, 'text');
      assert(request.language === 'ja' || request.language === 'en');
      assert(request.message && typeof request.message === 'object' && !Array.isArray(request.message));
      assert.deepEqual(Object.keys(request.message).sort(), ['id', 'params']);
      // The separately pinned pure fixture checks every selected ID, exact
      // top-level/nested fields, entity identity and verbatim actor descriptors.
      const text = expectedText(request.message.id, request.message.params, request.language);
      requests.push(structuredClone(request)); events.push('rust-text:' + request.language);
      const bytes = encoder.encode(JSON.stringify({ ok: true, value: null, session: null,
        messages: [request.message], text: [text] }));
      assert(bytes.length > 0 && bytes.length <= 8192);
      new Uint8Array(memory.buffer, 8192, bytes.length).set(bytes);
      return (BigInt(bytes.length) << 32n) | 8192n;
    },
    dcss_release(pointer, length) { releases.push([pointer, length]); },
  };
}
function createStartupModule(options = {}) {
  const events = options.events || [], requests = [], releases = [], assetPaths = [];
  let bridge, loadCalls = 0, instantiateCalls = 0;
  const importer = async () => {
    events.push('bridge-import:start');
    if (options.importGate) await options.importGate;
    if (options.importError) throw options.importError;
    assert.equal(hash(fs.readFileSync(bridgePath())), EXPECTED.bridge_sha256,
      'reviewed JS bridge before importing executable source');
    const actual = await import(pathToFileURL(bridgePath()).href);
    assertPin(actual.STARTUP_TEXT_PIN);
    events.push('bridge-import:finish');
    return {
      async loadStartupTextBridge(language = 'ja') {
        events.push('preflight:start:' + language); loadCalls++;
        if (options.preflightGate) await options.preflightGate;
        if (options.preflightError) throw options.preflightError;
        const exports = createMockExports(actual.STARTUP_TEXT_PIN, events, requests, releases);
        bridge = await actual.loadStartupTextBridge(language, {
          crypto: webcrypto,
          async fetcher(assetPath, request) {
            assert.equal(request.cache, 'no-store');
            assert([...actual.STARTUP_TEXT_PIN.catalogs.map(pin => pin.path),
              actual.STARTUP_TEXT_PIN.boundary.path].includes(assetPath), 'fixed V2 startup artifact path');
            events.push('asset:' + assetPath); assetPaths.push(assetPath);
            let bytes = fs.readFileSync(path.join(repositoryPath(), assetPath.slice(1)));
            if (options.corruptAsset === assetPath) { bytes = Buffer.from(bytes); bytes[0] ^= 1; }
            return { ok: true, async arrayBuffer() {
              return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            } };
          },
          async instantiate(bytes, imports) {
            assert.equal(bytes.byteLength, actual.STARTUP_TEXT_PIN.boundary.bytes);
            assert.deepEqual(imports, {});
            events.push('instantiate:mock'); instantiateCalls++;
            return { instance: { exports } };
          },
        });
        events.push('preflight:finish:' + language);
        return bridge;
      },
    };
  };
  return { importer, events, requests, releases, assetPaths,
    get loadCalls() { return loadCalls; }, get instantiateCalls() { return instantiateCalls; },
    get bridge() { return bridge; } };
}
function runWorkerInContext(source, context, options = {}) {
  // Exactly one import expression changes; restoring it restores the complete
  // production Worker source. Engine factories and native exports are stubs
  // provided by the calling protocol suite.
  assert.equal(hash(Buffer.from(source, 'utf8')), WORKER_SHA256,
    'reviewed unmodified production Worker at every VM entry');
  assert.equal(source.split(IMPORT).length - 1, 1, 'exactly one fixed startup bridge import');
  const state = createStartupModule(options);
  context.__dcssStartupModule = state.importer;
  const evaluated = source.replace(IMPORT, '__dcssStartupModule()');
  assert.equal(evaluated.replace('__dcssStartupModule()', IMPORT), source, 'exact import seam inversion');
  vm.runInNewContext(evaluated, context, { filename: workerPath() });
  return state;
}
module.exports = { ID, PIN, EXPECTED, IMPORT, PIN_SHA256, FIXTURE_SHA256, WORKER_SHA256,
  repositoryPath, workerPath, bridgePath, readWorkerSource, createStartupModule, runWorkerInContext };
