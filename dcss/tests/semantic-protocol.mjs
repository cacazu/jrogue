// Bounded host tests only: no engine, browser, Rust compiler or WASM execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import startupMock from './worker/startup-bridge-mock.cjs';
const { runWorkerInContext } = startupMock;

const root = process.env.DCSS_REPOSITORY || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { SemanticLog } = await import(pathToFileURL(path.join(root, 'web/semantic-log.mjs')).href);
const checks = [];
const fixture = (sequence = '1') => ({
  version: 1, source: 'canned-v1', upstream: '1eebc1a2892e1c89776a0d7a10691f8dac8d9796',
  sequence, turn: 7, channel: 0, param: 0, colour: 7, join: true,
  nojoin: false, more: false, flash: false, shout: false,
  message: { id: 'game.canned.nothing_happens', params: {} },
});

let library;
let payload = JSON.stringify(fixture('18446744073709551615'));
let reads = 0;
const options = {};
const context = {
  LibraryManager: { library: {} }, Module: options,
  mergeInto: (_, entries) => { library = entries; },
  UTF8ToString: () => { reads++; return payload; },
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'engine/library.js'), 'utf8'), context);
library.dcss_host_semantic(1);
assert.equal(reads, 0);
checks.push('absent semantic observer does not parse or affect the canonical route');
let received;
options.dcssSemantic = value => { received = value; };
library.dcss_host_semantic(1);
assert.equal(received.sequence, '18446744073709551615');
received.message.id = 'changed.by.host';
assert.equal(JSON.parse(payload).message.id, 'game.canned.nothing_happens');
checks.push('callback JSON is copied and retains exact maximum u64 sequence');
const diagnostics = [];
options.dcssSemantic = () => { throw new Error('observer failure'); };
options.dcssSemanticError = reason => diagnostics.push(reason);
assert.doesNotThrow(() => library.dcss_host_semantic(1));
assert.match(diagnostics.pop(), /observer failure/);
checks.push('observer exception is diagnosed without throwing into gameplay');
options.dcssSemanticError = () => { throw new Error('diagnostic failure'); };
assert.doesNotThrow(() => library.dcss_host_semantic(1));
checks.push('diagnostic callback exception cannot throw into gameplay');
payload = '{';
options.dcssSemanticError = reason => diagnostics.push(reason);
assert.doesNotThrow(() => library.dcss_host_semantic(1));
assert.equal(diagnostics.length, 1);
checks.push('malformed transport JSON has a separate diagnostic route');

const posted = [];
let workerOptions, finishBoot;
const booted = new Promise(resolve => { finishBoot = resolve; });
const self = {
  postMessage(value) {
    posted.push(structuredClone(value));
    if (value.type === 'response' && value.id === 1) finishBoot(value);
  },
  addEventListener() {},
  createDcssEngine: async value => {
    workerOptions = value;
    return { FS: { mkdirTree() {} }, callMain() {} };
  },
};
runWorkerInContext(startupMock.readWorkerSource(), {
  self, importScripts() {}, queueMicrotask, Uint32Array, Uint8Array,
  setTimeout, console,
});
await self.onmessage({ data: { type: 'request', id: 1, op: 'boot', files: [] } });
await booted;
const event = fixture('18446744073709551615');
workerOptions.dcssSemantic(event);
event.message.id = 'mutated.after.delivery';
assert.equal(posted.at(-1).type, 'semantic');
assert.equal(posted.at(-1).event.sequence, '18446744073709551615');
assert.equal(posted.at(-1).event.message.id, 'game.canned.nothing_happens');
checks.push('Worker forwards an independent semantic observation without an engine export');
workerOptions.dcssSemanticError('locale failure');
assert.deepEqual(posted.at(-1), { type: 'semantic-error', error: 'locale failure' });
assert.equal(posted.some(value => value.type === 'fatal'), false);
checks.push('locale transport failure is distinct from an engine fatal error');

const mainWorkers = [];
// Capability stubs for the main-host probe; no WASM module is instantiated.
globalThis.WebAssembly = { Suspending() {}, promising() {} };
globalThis.Worker = class {
  constructor() { this.terminated = false; mainWorkers.push(this); }
  postMessage(value) {
    if (value.type === 'key') return;
    queueMicrotask(() => this.onmessage({ data: {
      type: 'response', id: value.id, ok: true,
      value: value.op === 'state' ? { turn: 7 } : true,
    } }));
  }
  terminate() { this.terminated = true; }
};
globalThis.window = { dispatchEvent() {} };
globalThis.location = { href: 'http://localhost/?core=1' };
globalThis.CustomEvent = class {};
const elements = {
  '#player': { value: 'external-name' }, '#seed': { value: '42' },
  '#species': { value: 'Hu' }, '#job': { value: 'Fi' },
  '#console': { focus() {} }, '#status': { textContent: '' },
};
globalThis.document = { querySelector: selector => elements[selector] };
const { startCore } = await import(pathToFileURL(process.env.DCSS_CORE_DEBUG_SOURCE || path.join(root, 'web/core-debug.mjs')).href);
const main = await startCore({
  setEngine() {},
  acceptCoreMessage() { throw new Error('render observer rejects'); },
  rejectCoreMessage() { throw new Error('diagnostic observer rejects'); },
});
mainWorkers[0].onmessage({ data: { type: 'semantic', event: fixture() } });
assert.equal(main.error, null);
assert.equal(mainWorkers[0].terminated, false);
assert.deepEqual(await main.state(), { turn: 7 });
checks.push('main-thread semantic and reporting exceptions do not terminate canonical play');
mainWorkers[0].onmessage({ data: { type: 'semantic-error', error: 'source locale failure' } });
assert.equal(main.error, null);
assert.equal(mainWorkers[0].terminated, false);
main.queue(46);
checks.push('semantic transport diagnostics leave normalized input and state inspection available');

const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/gameplay/canned.en.json'), 'utf8'));
const ja = JSON.parse(fs.readFileSync(path.join(root, 'locales/gameplay/canned.ja.json'), 'utf8'));
const fixedText = entry => typeof entry === 'string' ? entry : entry.text;
let language = 'ja';
let requests = 0;
const fakeBoundary = command => {
  // This is a display-only mock; strict Rust validation has its own pending tests.
  assert.equal(command.op, 'game_message');
  requests++;
  const text = fixedText((language === 'ja' ? ja : en)[command.event.message.id]);
  assert.equal(typeof text, 'string');
  return { value: { event: structuredClone(command.event) }, text: [text] };
};
const log = new SemanticLog(fakeBoundary, 2);
assert.deepEqual(log.render(), []);
assert.equal(requests, 0);
checks.push('empty semantic projection performs no boundary or engine request');
const source = fixture('1');
log.append(source);
source.message.id = 'external.mutation';
const retained = log.snapshot();
assert.equal(retained[0].message.id, 'game.canned.nothing_happens');
retained[0].message.id = 'returned.copy.mutation';
assert.equal(log.snapshot()[0].message.id, 'game.canned.nothing_happens');
checks.push('source and returned copies cannot mutate retained semantic history');
const before = JSON.stringify(log.snapshot());
for (let n = 0; n < 50; n++) assert.equal(log.render()[0].text, fixedText(ja['game.canned.nothing_happens']));
assert.equal(JSON.stringify(log.snapshot()), before);
language = 'en';
assert.equal(log.render()[0].text, fixedText(en['game.canned.nothing_happens']));
assert.equal(JSON.stringify(log.snapshot()), before);
checks.push('50 redraws and language switching retain the exact same event descriptors');
log.append(fixture('2'));
log.append(fixture('18446744073709551615'));
assert.deepEqual(log.snapshot().map(value => value.sequence), ['2', '18446744073709551615']);
checks.push('bounded history preserves exact sequence identities without numeric rounding');
const stable = JSON.stringify(log.snapshot());
assert.throws(() => log.append(fixture('18446744073709551615')), /repeated or reordered/);
assert.throws(() => log.append(fixture('3')), /repeated or reordered/);
assert.equal(JSON.stringify(log.snapshot()), stable);
checks.push('repeated or earlier accepted descriptors do not enter retained history');
let reject = false;
const rejecting = new SemanticLog(command => {
  if (reject) throw new Error('Rust rejection mock');
  return fakeBoundary(command);
});
rejecting.append(fixture('1'));
reject = true;
assert.throws(() => rejecting.append(fixture('2')), /Rust rejection mock/);
assert.equal(rejecting.length, 1);
checks.push('rejected boundary response does not advance or append semantic history');
assert.throws(() => new SemanticLog(fakeBoundary, 0));
assert.throws(() => new SemanticLog(fakeBoundary, 1001));
checks.push('history capacity has a declared bound');

console.log(JSON.stringify({
  kind: 'semantic host/projection stubs only', checks, count: checks.length,
  actual_engine_executed: false, actual_rust_executed: false,
  browser_executed: false, native_history_persisted: false,
}, null, 2));
