// Production main-host probe with an authored Worker/storage model only.
// No native, WASM, Rust compiler, browser or game process is launched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
const audit = path.dirname(fileURLToPath(import.meta.url));
const trial = process.env.DCSS_REPOSITORY || path.resolve(audit, '..');
const hostSource = path.join(trial, 'web/core-debug.mjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourcePin = 'fbed3c99784de9db3e797ad4e5af49ee7a902707204812bec928d86518aabafb';
assert.equal(sha(fs.readFileSync(hostSource)), sourcePin, 'reviewed frozen main-host source');
const instances = [], database = new Map();
let holdNextPut = false, heldPut = null;
globalThis.WebAssembly = { Suspending() {}, promising() {} };
globalThis.Worker = class {
  constructor() { this.turn = 0; this.transport = []; this.terminated = false; instances.push(this); }
  postMessage(value) {
    this.transport.push(structuredClone(value));
    if (value.type === 'key') { this.turn++; return; }
    // The authored model captures on request arrival, just as the real Worker
    // schedules operations from arrival sequence. It never reads a real heap.
    const captureTurn = this.turn;
    queueMicrotask(() => {
      let response = true;
      if (value.op === 'save' || value.op === 'files') {
        response = [{ path: 'saves/Fifo.cs', bytes: [captureTurn] }];
      } else if (value.op === 'state') response = { turn: captureTurn };
      this.onmessage({ data: { type: 'response', id: value.id, ok: true, value: response } });
    });
  }
  terminate() { this.terminated = true; }
};
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class {};
globalThis.location = { href: 'http://localhost/?core=1' };
const nodes = { '#player': { value: 'Fifo' }, '#seed': { value: '42' },
  '#species': { value: 'Hu' }, '#job': { value: 'Fi' },
  '#console': { focus() {} }, '#status': { textContent: '' } };
globalThis.document = { querySelector: selector => nodes[selector] };
globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        close() {}, transaction() {
          const tx = { error: null, aborted: false,
            abort() { tx.aborted = true; queueMicrotask(() => tx.onabort?.()); },
            objectStore() { return {
              put(value, key) {
                const finish = () => { if (!tx.aborted) { database.set(key, value); tx.oncomplete?.(); } };
                if (holdNextPut) { holdNextPut = false; heldPut = finish; }
                else queueMicrotask(finish);
              },
            }; },
          };
          return tx;
        },
      };
      request.onsuccess();
    });
    return request;
  },
};
const { startCore } = await import(pathToFileURL(hostSource).href);
const harness = {
  setEngine() {}, restoreCoreHistory() {},
  semanticCheckpoint: () => null,
  call(command) {
    assert.equal(command.op, 'pack_native');
    return { value: { save: JSON.stringify({ files: command.files, semantic: command.semantic }) } };
  },
};
const tick = () => new Promise(setImmediate);
function transport(worker) {
  return worker.transport.filter(value => value.type === 'key' || !['boot', 'start'].includes(value.op))
    .map(value => value.type === 'key' ? 'key:' + value.key : 'request:' + value.op);
}
const probes = [];
{
  const api = await startCore(harness), worker = instances.at(-1);
  const save = api.save(); api.queue(46);
  const pack = JSON.parse(await save);
  probes.push({ name: 'save then mutation in one JS turn',
    expected_transport: ['request:save', 'key:46'], actual_transport: transport(worker),
    expected_saved_turn: 0, actual_saved_turn: pack.files[0].bytes[0],
    requirement_met: JSON.stringify(transport(worker)) === JSON.stringify(['request:save', 'key:46'])
      && pack.files[0].bytes[0] === 0 });
}
{
  const api = await startCore(harness), worker = instances.at(-1);
  const save = api.save(), files = api.files(); await Promise.all([save, files]);
  probes.push({ name: 'save then file observation in one JS turn',
    expected_transport: ['request:save', 'request:files'], actual_transport: transport(worker),
    requirement_met: JSON.stringify(transport(worker)) === JSON.stringify(['request:save', 'request:files']) });
}
{
  const api = await startCore(harness), worker = instances.at(-1);
  holdNextPut = true; heldPut = null;
  const first = api.save(); await tick();
  assert.equal(typeof heldPut, 'function', 'first storage commit deliberately held');
  const second = api.save(); api.queue(46);
  const beforeRelease = transport(worker); heldPut();
  const packs = (await Promise.all([first, second])).map(value => JSON.parse(value));
  probes.push({ name: 'queued save then mutation while prior storage is pending',
    expected_transport: ['request:save', 'request:save', 'key:46'],
    actual_transport: transport(worker), before_storage_release: beforeRelease,
    expected_saved_turns: [0, 0], actual_saved_turns: packs.map(pack => pack.files[0].bytes[0]),
    requirement_met: JSON.stringify(transport(worker)) === JSON.stringify(['request:save', 'request:save', 'key:46'])
      && packs.every(pack => pack.files[0].bytes[0] === 0) });
}
assert.equal(sha(fs.readFileSync(hostSource)), sourcePin, 'production source remained frozen');
const receipt = { kind: 'Independent production-host save/input FIFO regression probes',
  time: new Date().toISOString(), source_sha256: sourcePin, probes,
  all_requirements_met: probes.every(probe => probe.requirement_met),
  actual_engine_executed: false, actual_rust_executed: false, actual_wasm_executed: false,
  browser_executed: false, native_rng_executed: false, source_modified: false };
fs.writeFileSync(path.join(audit, 'SAVE-INPUT-FIFO-RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.all_requirements_met) process.exitCode = 1;
