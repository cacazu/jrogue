// Narrow authored host fixtures only. No C++, WASM, Rust compiler or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = process.env.DCSS_HISTORY_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { SemanticLog } = await import(pathToFileURL(path.join(root, 'web/semantic-log.mjs')).href);
const { createNativeSaveCoordinator } = await import(pathToFileURL(path.join(root, 'web/native-save-coordinator.mjs')).href);
const { put, get } = await import(pathToFileURL(path.join(root, 'web/storage.mjs')).href);
const UPSTREAM = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const checks = [];
const check = name => checks.push(name);
const tick = () => new Promise(setImmediate);
const event = (sequence = '1') => ({
  version: 1, source: 'canned-v1', upstream: UPSTREAM, sequence, turn: 7,
  channel: 0, param: 0, colour: 7, join: true, nojoin: false,
  more: false, flash: false, shout: false,
  message: { id: 'game.canned.nothing_happens', params: {} },
});
const canonical = text => {
  const n = BigInt(text);
  assert.ok(n > 0n && n <= 18446744073709551615n && String(n) === text);
  return n;
};
// This independent mock enforces the public host contract. Real Rust validation
// is exercised by separate staged Rust tests and the scheduled WASM trial.
function validateCheckpoint(checkpoint) {
  assert.equal(checkpoint.version, 1);
  assert.equal(checkpoint.upstream, UPSTREAM);
  assert.deepEqual(Object.keys(checkpoint).sort(), ['events', 'session', 'upstream', 'version']);
  const current = canonical(checkpoint.session);
  assert.ok(checkpoint.events.length <= 1000);
  assert.ok(Buffer.byteLength(JSON.stringify(checkpoint)) <= 256 * 1024);
  let previousSession = 0n, previousSequence = 0n;
  for (const entry of checkpoint.events) {
    assert.deepEqual(Object.keys(entry).sort(), ['event', 'session']);
    const segment = canonical(entry.session), sequence = canonical(entry.event.sequence);
    assert.ok(segment <= current && (segment > previousSession || segment === previousSession && sequence > previousSequence));
    assert.equal(entry.event.version, 1);
    assert.equal(entry.event.source, 'canned-v1');
    assert.equal(entry.event.upstream, UPSTREAM);
    assert.equal(entry.event.message.id, 'game.canned.nothing_happens');
    assert.deepEqual(entry.event.message.params, {});
    previousSession = segment; previousSequence = sequence;
  }
}
let language = 'ja', failRender = false;
function boundary(command) {
  if (command.op === 'game_message') {
    const value = structuredClone(command.event);
    canonical(value.sequence);
    assert.equal(value.source, 'canned-v1');
    if (failRender) throw Error('render rejected before restore commit');
    return { value: { event: value }, text: [language === 'ja' ? '何も起こらない。' : 'Nothing happens.'] };
  }
  assert.equal(command.op, 'semantic_checkpoint');
  let checkpoint = command.checkpoint ?? { version: 1, upstream: UPSTREAM, session: '1', events: [] };
  validateCheckpoint(checkpoint);
  checkpoint = structuredClone(checkpoint);
  if (command.checkpoint && command.resume) checkpoint.session = String(canonical(checkpoint.session) + 1n);
  canonical(checkpoint.session);
  if (failRender) throw Error('render rejected before restore commit');
  return { value: { checkpoint }, text: checkpoint.events.map(entry =>
    entry.event.shout && language === 'en' ? 'NOTHING HAPPENS.' : language === 'ja' ? '何も起こらない。' : 'Nothing happens.') };
}
const log = new SemanticLog(boundary, 2);
assert.deepEqual(log.restore(null), []);
assert.equal(log.session, '1');
check('legacy/absent history starts an empty first host session');
log.append(event('1')); log.append(event('18446744073709551615'));
const saved = log.checkpoint();
assert.equal(saved.events[1].event.sequence, '18446744073709551615');
assert.equal(saved.events[1].session, '1');
assert.equal(JSON.stringify(saved).includes('Nothing happens.'), false);
assert.equal(JSON.stringify(saved).includes('何も'), false);
check('checkpoint stores exact u64/source descriptors and no rendered language');
saved.events[0].event.message.id = 'mutated.returned.copy';
assert.equal(log.snapshot()[0].message.id, 'game.canned.nothing_happens');
check('checkpoint copies cannot mutate the live display projection');
const checkpoint = log.checkpoint();
language = 'en';
const restored = log.restore(checkpoint);
assert.equal(log.session, '2');
assert.deepEqual(restored.map(entry => entry.text), ['Nothing happens.', 'Nothing happens.']);
assert.deepEqual(log.snapshot(), checkpoint.events.map(entry => entry.event));
check('restore re-renders raw descriptors in the selected locale without callbacks');
log.append(event('1'));
assert.deepEqual(log.history().map(entry => [entry.session, entry.event.sequence]),
  [['1', '18446744073709551615'], ['2', '1']]);
check('fresh native sequence one is admitted after prior maximum sequence in a distinct session');
const stable = JSON.stringify(log.checkpoint());
assert.throws(() => log.append(event('1')), /repeated or reordered/);
assert.equal(JSON.stringify(log.checkpoint()), stable);
check('duplicate/reordered observations still reject inside the current session');
const invalids = [
  value => { value.version = 2; },
  value => { value.upstream = 'other'; },
  value => { value.session = '01'; },
  value => { value.events[0].session = '3'; },
  value => { value.events.reverse(); },
  value => { value.events[0].event.source = 'formatted-english'; },
  value => { value.rendered = 'forbidden'; },
];
for (const mutate of invalids) {
  const value = log.checkpoint(); mutate(value);
  assert.throws(() => log.restore(value));
  assert.equal(JSON.stringify(log.checkpoint()), stable);
}
check('future/corrupt/reordered history rejects atomically without partial restore');
failRender = true;
assert.throws(() => log.restore(log.checkpoint()), /before restore commit/);
assert.equal(JSON.stringify(log.checkpoint()), stable);
failRender = false;
check('failed rendering leaves session and retained entries unchanged');
const before = JSON.stringify(log.checkpoint());
for (let index = 0; index < 25; index++) log.render();
language = 'ja'; assert.equal(log.render()[0].text, '何も起こらない。');
assert.equal(JSON.stringify(log.checkpoint()), before);
check('locale re-render and redraws preserve checkpoint bytes and exact identities');

let releaseCommit, captures = 0;
const commits = [], commitsStarted = [];
const serial = createNativeSaveCoordinator({
  capture: async () => ({ files: [++captures], semantic: { capture: captures } }),
  pack: value => JSON.stringify(value),
  commit: async value => {
    commitsStarted.push(value);
    if (commitsStarted.length === 1) await new Promise(resolve => { releaseCommit = resolve; });
    commits.push(value);
  },
});
const first = serial(), second = serial(); await tick();
assert.equal(captures, 2); assert.equal(commitsStarted.length, 1);
releaseCommit(); const [firstSave, secondSave] = await Promise.all([first, second]);
assert.deepEqual(commits, [firstSave, secondSave]);
assert.deepEqual(JSON.parse(secondSave), { files: [2], semantic: { capture: 2 } });
check('concurrent saves reserve captures at invocation and pack/commit FIFO without storage overwrite races');
let writes = 0, rejectPack = true;
const rejecting = createNativeSaveCoordinator({
  capture: async () => ({ files: [], semantic: { version: 99 } }),
  pack: () => { if (rejectPack) throw Error('future checkpoint'); return 'valid-pack'; },
  commit: async () => { writes++; },
});
await assert.rejects(rejecting(), /future checkpoint/); assert.equal(writes, 0);
rejectPack = false; assert.equal(await rejecting(), 'valid-pack'); assert.equal(writes, 1);
check('rejected pack never reaches storage and later valid saves can proceed');
const terminal = new AbortController(); terminal.abort(Error('session completed'));
const stopped = createNativeSaveCoordinator({
  capture: () => { throw Error('must not capture'); }, pack: () => '', commit: () => { writes++; }, signal: terminal.signal,
});
await assert.rejects(stopped(), /session completed/);
check('terminal queued saves reject before requesting native state or committing');

const database = new Map(); let holdWrites = false, txCreated = 0, closed = 0, currentTx;
globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        close() { closed++; },
        transaction(_name, mode) {
          txCreated++;
          const tx = { error: null, aborted: false, value: null,
            abort() { this.aborted = true; queueMicrotask(() => this.onabort?.()); },
            objectStore() { return {
              put(value, key) {
                tx.value = { value, key };
                if (!holdWrites) queueMicrotask(() => {
                  if (!tx.aborted) { database.set(key, value); tx.oncomplete?.(); }
                });
              },
              get(key) {
                const result = {};
                queueMicrotask(() => { result.result = database.get(key); result.onsuccess?.(); });
                return result;
              },
            }; },
          };
          currentTx = tx; return tx;
        },
      };
      request.onsuccess();
    });
    return request;
  },
};
await put('proof', 'complete-pack'); assert.equal(await get('proof'), 'complete-pack');
check('storage resolves only after atomic transaction completion');
holdWrites = true;
const aborting = new AbortController();
const aborted = put('proof', 'must-not-commit', { signal: aborting.signal }); await tick();
aborting.abort(Error('engine failed during storage'));
await assert.rejects(aborted, /engine failed during storage/);
assert.equal(database.get('proof'), 'complete-pack'); assert.equal(currentTx.aborted, true);
check('terminal abort cancels an in-flight write and preserves the prior complete save');
const transactionsBefore = txCreated;
await assert.rejects(put('proof', 'bad', { signal: aborting.signal }), /engine failed/);
assert.equal(txCreated, transactionsBefore);
check('already-terminal writes reject before opening a transaction');
holdWrites = false; assert.ok(closed >= 3);
check('success and aborted storage operations close their database connections');

const nativeKey = 'dcss.native-development.v1';
const workers = [], reports = [], rawFiles = [{ path: 'saves/Player.cs', bytes: [0, 255, 90] }];
globalThis.WebAssembly = { Suspending() {}, promising() {} };
globalThis.Worker = class {
  constructor() { this.terminated = false; this.sent = []; workers.push(this); }
  postMessage(request) {
    this.sent.push(structuredClone(request));
    if (request.type === 'key') return;
    queueMicrotask(() => {
      if (request.op === 'save') {
        this.onmessage({ data: { type: 'semantic', event: event('3') } });
        this.onmessage({ data: { type: 'response', id: request.id, ok: true, value: structuredClone(rawFiles) } });
        // A later command can already post an observation before the await
        // continuation runs. The save-reply handler must have frozen its cut.
        this.onmessage({ data: { type: 'semantic', event: event('4') } });
      } else {
        this.onmessage({ data: { type: 'response', id: request.id, ok: true,
          value: request.op === 'state' ? { rng: ['untouched'], turn: 7 } : true } });
      }
    });
  }
  terminate() { this.terminated = true; }
};
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class { constructor(type, value) { this.type = type; this.detail = value?.detail; } };
globalThis.location = { href: 'http://localhost/' };
const elements = {
  '#player': { value: 'Player' }, '#seed': { value: '42' }, '#species': { value: 'Mi' },
  '#job': { value: 'Fi' }, '#console': { focus() {} }, '#status': { textContent: '' },
};
globalThis.document = { querySelector: id => elements[id] };
const { startCore } = await import(pathToFileURL(path.join(root, 'web/core-debug.mjs')).href);
function harnessFor(projection, rejectUnpack = false) {
  return {
    language, setEngine() {}, renderCoreFrame() {},
    acceptCoreMessage: source => projection.append(source),
    rejectCoreMessage: reason => reports.push(reason),
    semanticCheckpoint: () => projection.checkpoint(),
    restoreCoreHistory: value => projection.restore(value),
    call(request) {
      if (request.op === 'text') return { text: ['localized status'] };
      if (request.op === 'pack_native') {
        if (request.semantic) validateCheckpoint(request.semantic);
        return { value: { save: JSON.stringify({ version: 2, files: request.files, semantic: request.semantic }) } };
      }
      assert.equal(request.op, 'unpack_native');
      if (rejectUnpack) throw Error('future/corrupt native envelope');
      const saved = JSON.parse(request.save);
      assert.ok(saved.version === 1 || saved.version === 2);
      if (saved.semantic) validateCheckpoint(saved.semantic);
      return { value: { files: saved.files, semantic: saved.semantic ?? null } };
    },
  };
}
const projection = new SemanticLog(boundary);
const api = await startCore(harnessFor(projection));
const worker = workers.at(-1);
worker.onmessage({ data: { type: 'semantic', event: event('1') } });
worker.onmessage({ data: { type: 'semantic', event: event('2') } });
const portable = JSON.parse(await api.save());
assert.equal(portable.version, 2);
assert.deepEqual(portable.files, rawFiles);
assert.deepEqual(portable.semantic.events.map(entry => entry.event.sequence), ['1', '2', '3']);
assert.deepEqual(projection.snapshot().map(value => value.sequence), ['1', '2', '3', '4']);
assert.equal(JSON.parse(database.get(nativeKey)).semantic.events.at(-1).event.sequence, '3');
check('main save cut includes native-save observations and excludes subsequent command observations');
assert.equal(worker.sent.filter(request => request.op === 'save').length, 1);
assert.equal(worker.sent.filter(request => request.op === 'state' || request.op === 'repaint').length, 0);
check('history persistence requests no extra native state/redraw/RNG exports');
api.terminate();

globalThis.location.href = 'http://localhost/?resume=1';
language = 'en';
const resumedLog = new SemanticLog(boundary);
const resumed = await startCore(harnessFor(resumedLog));
assert.equal(resumedLog.session, '2');
assert.deepEqual(resumedLog.snapshot(), portable.semantic.events.map(entry => entry.event));
assert.deepEqual(workers.at(-1).sent.find(request => request.op === 'boot').files, rawFiles);
assert.equal(workers.at(-1).sent.some(request => request.type === 'semantic'), false);
workers.at(-1).onmessage({ data: { type: 'semantic', event: event('1') } });
assert.equal(resumedLog.history().at(-1).session, '2');
assert.equal(resumedLog.history().at(-1).event.sequence, '1');
assert.equal(resumedLog.render()[0].text, 'Nothing happens.');
check('v2 native resume restores raw history in EN and admits new exact seq1 without native observer replay');
resumed.terminate();

database.set(nativeKey, JSON.stringify({ version: 1, files: rawFiles }));
const v1Log = new SemanticLog(boundary);
const v1 = await startCore(harnessFor(v1Log));
assert.equal(v1Log.length, 0); assert.equal(v1Log.session, '1');
assert.deepEqual(workers.at(-1).sent.find(request => request.op === 'boot').files, rawFiles);
check('legacy native v1 restores unchanged bytes with empty observation history');
v1.terminate();
const countBeforeInvalid = workers.length;
database.set(nativeKey, JSON.stringify({ version: 99, files: rawFiles }));
const invalidLog = new SemanticLog(boundary);
await assert.rejects(startCore(harnessFor(invalidLog, true)), /future\/corrupt/);
assert.equal(workers.length, countBeforeInvalid);
assert.equal(invalidLog.length, 0);
assert.equal(JSON.parse(database.get(nativeKey)).version, 99);
check('invalid native envelope rejects before Worker creation without projection/storage changes');

database.set(nativeKey, JSON.stringify({ version: 2, files: rawFiles,
  semantic: { version: 99, upstream: UPSTREAM, session: '1', events: [] } }));
await assert.rejects(startCore(harnessFor(invalidLog)));
assert.equal(workers.length, countBeforeInvalid); assert.equal(invalidLog.session, '1');
check('future semantic checkpoint rejects before Worker creation and native FS restoration');
assert.equal(reports.length, 0);
check('successful restore emits no observer error or announcement replay');

const evidence = { kind: 'semantic checkpoint/projection/storage/main-host authored fixtures',
  checks, count: checks.length, actual_engine_executed: false, actual_rust_executed: false,
  browser_executed: false, native_rng_executed: false };
if (process.env.DCSS_HISTORY_EVIDENCE) fs.writeFileSync(process.env.DCSS_HISTORY_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
