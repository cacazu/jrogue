// Bounded host protocol stubs. No C++/WASM, engine build or browser executes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import startupMock from './worker/startup-bridge-mock.cjs';
const { runWorkerInContext } = startupMock;
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = process.env.DCSS_WORKER_SOURCE || path.resolve(directory, '../web/core-worker.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const checks = [];
const check = label => checks.push(label);
const settle = () => new Promise(setImmediate);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture({ supported = true, heldSave = false, holdMain = false } = {}) {
  const posts = [], imports = [], calls = [], mainKeys = [], helperKeys = [], listeners = {};
  const lifetime = deferred(), firstDelay = deferred(), lastDelay = deferred();
  const secondSave = deferred(), saveHold = deferred();
  const fileBytes = new Map([['/persist/native.cs', [1, 2, 3]]]);
  const rng = Array.from({ length: 45 }, (_, index) => ({
    state: (0xffffffffffffffffn - BigInt(index)).toString(),
    sequence: (0xfffffffffffffffdn - BigInt(index) * 2n).toString(), draws: '0',
  }));
  let options, saving = false, phase = 'unstarted', turn = 0, saves = 0, reads = 0;
  function readMain() {
    phase = 'unwinding';
    options.dcssReadKey(key => {
      assert.equal(saving, false, 'main resolver cannot resume during a save helper');
      calls.push('main-key:' + key); mainKeys.push(key); turn++;
      if (holdMain) phase = 'main-delay';
      else readMain();
    });
    if (phase === 'unwinding') phase = 'waiting';
  }
  const engine = {
    FS: {
      mkdirTree() {}, writeFile(name, bytes) { fileBytes.set(name, Array.from(bytes)); },
      readdir() {
        assert.equal(saving, false, 'files cannot be captured during an incomplete save');
        calls.push('files'); reads++; return ['.', '..', 'native.cs'];
      },
      stat() { return { mode: 0 }; }, isDir() { return false; },
      readFile(name) { reads++; return Uint8Array.from(fileBytes.get(name)); },
    },
    callMain() { calls.push('main-start'); readMain(); return lifetime.promise; },
    _dcss_snapshot_json() {
      assert.equal(saving, false); assert.equal(phase, 'waiting');
      calls.push('state:' + turn); return 1;
    },
    UTF8ToString() { return JSON.stringify({ turn, rng }); },
    _dcss_repaint() {
      assert.equal(saving, false); assert.equal(phase, 'waiting'); calls.push('repaint');
      options.dcssFrame(new Uint32Array([0x304b, 7, 0, 0, 7, 0]), 2, 1, 0, 0, true,
        [{ cell: 0, text: '\u304b\u3099' }]);
    },
    _dcss_save() {
      assert.equal(saving, false, 'save helpers must serialize');
      assert.equal(phase, 'waiting'); saving = true; saves++;
      calls.push('save-start:' + saves);
      if (heldSave) return saveHold.promise.then(value => { saving = false; return value; });
      if (saves === 2) return secondSave.promise.then(() => {
        saving = false; fileBytes.set('/persist/native.cs', [9, 8, 7]);
        calls.push('save-finish:2'); return 1;
      });
      return (async () => {
        await firstDelay.promise;
        for (let prompt = 1; prompt <= 2; prompt++) {
          const key = await new Promise(resolve => options.dcssReadKey(resolve));
          helperKeys.push(key); calls.push('save-key:' + key);
        }
        await lastDelay.promise;
        saving = false; fileBytes.set('/persist/native.cs', [4, 5, 6]);
        calls.push('save-finish:1'); return 1;
      })();
    },
  };
  const self = {
    postMessage(value, transfers = []) { posts.push(structuredClone(value, { transfer: transfers })); },
    addEventListener(name, callback) { listeners[name] = callback; },
    createDcssEngine: async value => { options = value; return engine; },
  };
  const context = { self, queueMicrotask, importScripts: name => imports.push(name),
    Uint8Array, Uint32Array, console,
    WebAssembly: supported ? { Suspending() {}, promising() {} } : {},
  };
  runWorkerInContext(source, context);
  const send = async data => { await self.onmessage({ data }); await settle(); };
  const request = (id, op, extra = {}) => send({ type: 'request', id, op, ...extra });
  const response = id => posts.find(post => post.type === 'response' && post.id === id);
  const count = id => posts.filter(post => post.type === 'response' && post.id === id).length;
  return { posts, imports, calls, mainKeys, helperKeys, listeners, send, request, response, count,
    lifetime, firstDelay, lastDelay, secondSave, saveHold,
    get options() { return options; }, get saves() { return saves; }, get reads() { return reads; },
    get rng() { return structuredClone(rng); }, get turn() { return turn; } };
}
async function start(test, runtime = 'jspi') {
  await test.request(1, 'boot', { runtime, files: [] });
  assert.equal(test.response(1).ok, true);
  await test.request(2, 'start', { arguments: ['-name', 'Player'] });
  assert.equal(test.response(2).ok, true);
}
function assertRejectedOnce(test, ids, pattern) {
  for (const id of ids) {
    assert.equal(test.count(id), 1, 'request ' + id + ' must settle exactly once');
    assert.equal(test.response(id).ok, false);
    assert.match(test.response(id).error, pattern);
  }
}

const unsupported = fixture({ supported: false });
await unsupported.request(1, 'boot', { runtime: 'jspi' });
assert.equal(unsupported.response(1).code, 'jspi-unsupported');
assert.equal(unsupported.posts.find(post => post.type === 'fatal').code, 'jspi-unsupported');
assert.deepEqual(unsupported.imports, []);
check('Unsupported JSPI reports its explicit code before loading engine code');

const invalid = fixture();
await invalid.request(1, 'boot', { runtime: '../arbitrary' });
assert.equal(invalid.response(1).ok, false); assert.deepEqual(invalid.imports, []);
check('Runtime accepts only exact asyncify/jspi values and cannot select arbitrary script paths');

const original = fixture({ supported: false });
await original.request(1, 'boot', { files: [] });
assert.equal(original.response(1).ok, true);
assert.deepEqual(original.imports, ['/engine/build/dcss.js']);
assert.equal(original.options.locateFile('dcss.wasm'), '/engine/build/dcss.wasm');
check('Absent runtime remains Asyncify and needs no JSPI capabilities');

const live = fixture();
await start(live);
assert.deepEqual(live.imports, ['/engine/build-jspi/dcss.js']);
assert.equal(live.options.locateFile('dcss.data'), '/engine/build-jspi/dcss.data');
assert.equal(live.posts.some(post => post.type === 'completed' || post.type === 'fatal'), false);
check('JSPI uses only its fixed build and acknowledges start while lifetime main remains suspended');

await live.request(3, 'save');
await live.request(4, 'state'); await live.request(5, 'repaint');
await live.request(6, 'files'); await live.request(7, 'save'); await live.request(8, 'state');
assert.equal(live.saves, 1); assert.equal(live.reads, 0);
for (const id of [3, 4, 5, 6, 7, 8]) assert.equal(live.response(id), undefined);
await live.send({ type: 'key', key: 97 });
assert.deepEqual(live.mainKeys, []); assert.deepEqual(live.helperKeys, []);
check('Suspended save delay blocks main input, other exports, second save and partial file capture');

live.firstDelay.resolve(); await settle();
assert.deepEqual(live.helperKeys, [97]); assert.deepEqual(live.mainKeys, []);
assert.equal(live.posts.at(-1).type, 'waiting'); assert.equal(live.posts.at(-1).value, true);
await live.send({ type: 'key', key: 98 });
assert.deepEqual(live.helperKeys, [97, 98]); assert.deepEqual(live.mainKeys, []);
assert.equal(live.posts.at(-1).value, false);
await live.send({ type: 'key', key: 99 });
assert.equal(live.reads, 0);
check('Two nested save prompts consume their own keys despite earlier queued observations');

live.lastDelay.resolve(); await settle();
assert.deepEqual(live.response(3).value, [{ path: 'native.cs', bytes: [4, 5, 6] }]);
assert.equal(live.response(4).value.turn, 0);
assert.deepEqual(live.response(4).value.rng, live.rng);
assert.equal(live.response(5).ok, true);
assert.deepEqual(live.response(6).value, [{ path: 'native.cs', bytes: [4, 5, 6] }]);
assert.equal(live.saves, 2); assert.equal(live.response(7), undefined); assert.equal(live.response(8), undefined);
assert.deepEqual(live.mainKeys, []);
check('Files are captured after save fulfillment and queued observations precede the next serialized save');

const frame = live.posts.find(post => post.type === 'frame');
assert.equal(frame.clusters[0].text, '\u304b\u3099');
assert.equal(new Uint32Array(frame.buffer)[3], 0);
const semantic = { sequence: '18446744073709551615', turn: 0, channel: 0,
  message: { id: 'game.canned.no_spells', params: {} } };
live.options.dcssSemantic(semantic); semantic.message.id = 'changed.after.post';
assert.equal(live.posts.at(-1).event.message.id, 'game.canned.no_spells');
assert.equal(live.posts.at(-1).event.sequence, '18446744073709551615');
check('Repaint/semantic transport retains exact combining bytes, wide continuation and u64 identity without RNG conversion');

live.secondSave.resolve(); await settle();
assert.deepEqual(live.response(7).value, [{ path: 'native.cs', bytes: [9, 8, 7] }]);
assert.equal(live.response(8).value.turn, 0);
assert.deepEqual(live.response(8).value.rng, live.rng);
assert.deepEqual(live.mainKeys, [99]); assert.equal(live.turn, 1);
assert(live.calls.indexOf('state:0', live.calls.indexOf('save-finish:2')) < live.calls.indexOf('main-key:99'));
for (const id of [3, 4, 5, 6, 7, 8]) assert.equal(live.count(id), 1);
check('Restored main resolver drains queued requests before leftover keys in their original arrival order');
await live.request(9, 'state'); const beforeRng = live.response(9).value.rng;
for (let id = 10; id < 20; id++) await live.request(id, 'repaint');
await live.request(20, 'state');
assert.equal(live.response(20).value.turn, 1); assert.deepEqual(live.response(20).value.rng, beforeRng);
assert.equal(live.posts.filter(post => post.type === 'semantic').length, 1);
check('Ten observer redraws preserve all45 exact stub PCG words/counters and produce no semantic events');

for (const outcome of ['abort', 'complete']) {
  const ended = fixture({ heldSave: true }); await start(ended);
  await ended.request(3, 'save'); await ended.request(4, 'state');
  await ended.request(5, 'repaint'); await ended.request(6, 'files'); await ended.request(7, 'save');
  if (outcome === 'abort') ended.options.onAbort('fixture abort');
  else { ended.options.onExit(0); ended.lifetime.resolve(0); }
  await settle();
  assertRejectedOnce(ended, [3, 4, 5, 6, 7], outcome === 'abort' ? /fixture abort/ : /session completed/);
  const reads = ended.reads, calls = ended.calls.length;
  await ended.send({ type: 'key', key: 100 }); await ended.request(8, 'state');
  ended.saveHold.resolve(1); await settle();
  assert.equal(ended.reads, reads); assert.equal(ended.calls.length, calls);
  assertRejectedOnce(ended, [3, 4, 5, 6, 7, 8], outcome === 'abort' ? /fixture abort/ : /session completed/);
  assert.equal(ended.posts.filter(post => post.type === (outcome === 'abort' ? 'fatal' : 'completed')).length, 1);
  check(outcome + ' settles active and queued requests once; late helper success never captures files or resumes main');
}

const rejected = fixture({ holdMain: true }); await start(rejected);
await rejected.send({ type: 'key', key: 46 }); await rejected.request(3, 'state');
assert.equal(rejected.response(3), undefined);
rejected.lifetime.reject(new Error('lifetime rejected')); await settle();
assertRejectedOnce(rejected, [3], /lifetime rejected/);
assert.equal(rejected.posts.filter(post => post.type === 'fatal').length, 1);
check('Main lifetime rejection is handled immediately and rejects requests waiting behind native delay');

const fulfilled = fixture(); await start(fulfilled); fulfilled.lifetime.resolve(0); await settle();
assert.equal(fulfilled.posts.filter(post => post.type === 'completed').length, 1);
assert.equal(fulfilled.posts.some(post => post.type === 'fatal'), false);
check('Main lifetime numeric status0 completes normally even without a separate onExit callback');

const cannotSave = fixture({ heldSave: true }); await start(cannotSave);
await cannotSave.request(3, 'save'); await cannotSave.request(4, 'state');
await cannotSave.send({ type: 'key', key: 101 });
cannotSave.saveHold.resolve(0); await settle();
assertRejectedOnce(cannotSave, [3], /cannot be saved/);
assert.equal(cannotSave.response(4).ok, true); assert.equal(cannotSave.response(4).value.turn, 0);
assert.deepEqual(cannotSave.mainKeys, [101]);
assert.equal(cannotSave.posts.some(post => post.type === 'fatal'), false);
check('Native save refusal restores main input and ordered requests without converting refusal into engine failure');

const helperRejected = fixture({ heldSave: true }); await start(helperRejected);
await helperRejected.request(3, 'save'); await helperRejected.request(4, 'state');
helperRejected.saveHold.reject(new Error('helper rejected')); await settle();
assertRejectedOnce(helperRejected, [3, 4], /helper rejected/);
assert.equal(helperRejected.reads, 0);
assert.equal(helperRejected.posts.filter(post => post.type === 'fatal').length, 1);
check('Rejected native save Promise settles helper and queued requests without partial file capture');

const badStatus = fixture(); await start(badStatus); badStatus.lifetime.resolve(1); await settle();
assert.equal(badStatus.posts.some(post => post.type === 'completed'), false);
assert.equal(badStatus.posts.filter(post => post.type === 'fatal').length, 1);
check('Nonzero main lifetime status is a failure rather than normal completion');

const expected = fixture(); await start(expected); expected.options.onExit(0);
expected.lifetime.reject({ name: 'ExitStatus', status: 0 }); await settle();
assert.equal(expected.posts.some(post => post.type === 'fatal'), false);
const arbitrary = fixture(); await start(arbitrary); arbitrary.options.onExit(0);
arbitrary.lifetime.reject(new Error('unexpected after completion')); await settle();
assert.equal(arbitrary.posts.some(post => post.type === 'fatal'), true);
check('Only ExitStatus0 after confirmed status0 completion is suppressed; arbitrary late errors remain fatal');

const unconfirmed = fixture(); await start(unconfirmed);
unconfirmed.lifetime.reject({ name: 'ExitStatus', status: 0 }); await settle();
assert.equal(unconfirmed.posts.filter(post => post.type === 'fatal').length, 1);
check('Unconfirmed ExitStatus0 does not bypass the normal completion gate');

console.log(JSON.stringify({ kind: 'JSPI Worker protocol stubs only', count: checks.length, checks,
  actual_engine_executed: false, actual_wasm_executed: false, browser_executed: false,
  native_gameplay_or_rng_proved: false }, null, 2));
