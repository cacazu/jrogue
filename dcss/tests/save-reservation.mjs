import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testFile = fileURLToPath(import.meta.url);
const testDirectory = path.dirname(testFile);
const repository = path.resolve(process.env.DCSS_REPOSITORY || path.join(testDirectory, '..'));
const moduleFile = path.join(repository, 'web', 'native-save-coordinator.mjs');
const expectedModuleSha = '0946f78a49d743215dc0314424645434082b1caa4fe6321775db0b3e0ab2c02d';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = { module: sha(moduleFile), test: sha(testFile) };
assert.equal(before.module, expectedModuleSha, 'this suite must inspect the reviewed proposal');
assert(process.execArgv.includes('--max-old-space-size=128'), 'run this authored suite with the 128 MiB heap cap');
const { createNativeSaveCoordinator } = await import(pathToFileURL(moduleFile).href);

const unhandled = [];
const onUnhandled = reason => { unhandled.push(reason); };
process.on('unhandledRejection', onUnhandled);
const turn = () => new Promise(resolve => setImmediate(resolve));
const observe = promise => promise.then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }));
function callBoundary(save) {
  let promise;
  assert.doesNotThrow(() => { promise = save(); }, 'save() must never throw at its call boundary');
  assert(promise instanceof Promise, 'save() must return a Promise immediately');
  return observe(promise);
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fulfilled(outcome, expected) {
  assert.equal(outcome.status, 'fulfilled');
  assert.equal(outcome.value, expected);
}
function rejected(outcome, expected) {
  assert.equal(outcome.status, 'rejected');
  assert.equal(outcome.reason, expected, 'caller retains the exact error identity');
}
const tests = [];
const add = (name, run) => tests.push({ name, run });

add('first and second native captures reserve synchronously before subsequent input; commit order survives out-of-order capture resolution', async () => {
  const captures = [deferred(), deferred()];
  const firstCommit = deferred();
  const trace = [];
  const writes = [];
  let captureCount = 0;
  const save = createNativeSaveCoordinator({
    capture() { const index = captureCount++; trace.push(`capture:${index + 1}`); return captures[index].promise; },
    pack(checkpoint) { trace.push(`pack:${checkpoint}`); return `save:${checkpoint}`; },
    async commit(value) { trace.push(`commit:${value}`); if (value === 'save:first') await firstCommit.promise; writes.push(value); },
  });
  const first = observe(save());
  const second = observe(save());
  trace.push('input');
  try {
    assert.equal(captureCount, 2);
    assert.deepEqual(trace, ['capture:1', 'capture:2', 'input']);
    captures[1].resolve('second');
    await turn();
    assert.deepEqual(writes, []);
    assert.equal(trace.some(value => value.startsWith('pack:')), false);
    captures[0].resolve('first');
    await turn();
    assert.deepEqual(trace.slice(3), ['pack:first', 'commit:save:first']);
    assert.deepEqual(writes, []);
    firstCommit.resolve();
    const outcomes = await Promise.all([first, second]);
    fulfilled(outcomes[0], 'save:first');
    fulfilled(outcomes[1], 'save:second');
    assert.deepEqual(writes, ['save:first', 'save:second']);
    assert.deepEqual(trace.slice(3), ['pack:first', 'commit:save:first', 'pack:second', 'commit:save:second']);
  } finally {
    captures[0].resolve('first'); captures[1].resolve('second'); firstCommit.resolve();
    await Promise.all([first, second]);
  }
});

add('later asynchronous capture rejection is handled while an earlier commit is pending and the next save recovers', async () => {
  const firstCommit = deferred();
  const laterCapture = deferred();
  const captureCalls = [];
  const packed = [];
  const writes = [];
  const failure = new Error('later reserved native capture failed');
  const countBefore = unhandled.length;
  const save = createNativeSaveCoordinator({
    capture() { const index = captureCalls.length; captureCalls.push(index); return index === 1 ? laterCapture.promise : `checkpoint:${index}`; },
    pack(checkpoint) { packed.push(checkpoint); return `save:${checkpoint}`; },
    async commit(value) { if (value === 'save:checkpoint:0') await firstCommit.promise; writes.push(value); },
  });
  const first = observe(save());
  await turn();
  const later = observe(save());
  const recovered = observe(save());
  try {
    assert.deepEqual(captureCalls, [0, 1, 2]);
    laterCapture.reject(failure);
    await turn(); await turn();
    assert.equal(unhandled.length, countBefore, 'reserved capture rejection must already have a handler');
    assert.deepEqual(packed, ['checkpoint:0']);
    assert.deepEqual(writes, []);
    firstCommit.resolve();
    const outcomes = await Promise.all([first, later, recovered]);
    fulfilled(outcomes[0], 'save:checkpoint:0');
    rejected(outcomes[1], failure);
    fulfilled(outcomes[2], 'save:checkpoint:2');
    assert.deepEqual(packed, ['checkpoint:0', 'checkpoint:2']);
    assert.deepEqual(writes, ['save:checkpoint:0', 'save:checkpoint:2']);
  } finally {
    firstCommit.resolve(); laterCapture.resolve('unused');
    await Promise.all([first, later, recovered]);
  }
});

add('synchronous capture throw returns a rejecting promise and a later queued save recovers', async () => {
  const failure = new Error('synchronous native capture failure');
  const packed = [];
  const writes = [];
  let calls = 0;
  const save = createNativeSaveCoordinator({
    capture() { if (++calls === 1) throw failure; return 'second'; },
    pack(value) { packed.push(value); return `save:${value}`; },
    commit(value) { writes.push(value); },
  });
  let firstPromise;
  assert.doesNotThrow(() => { firstPromise = save(); });
  assert(firstPromise instanceof Promise);
  const first = observe(firstPromise);
  const second = observe(save());
  assert.equal(calls, 2);
  const outcomes = await Promise.all([first, second]);
  rejected(outcomes[0], failure);
  fulfilled(outcomes[1], 'save:second');
  assert.deepEqual(packed, ['second']);
  assert.deepEqual(writes, ['save:second']);
});

add('second synchronous reservation failure behind a pending commit returns a Promise and later FIFO saves recover', async () => {
  const firstCommit = deferred();
  const failure = new Error('second synchronous reservation failed while first storage was pending');
  const captures = [];
  const writes = [];
  let calls = 0;
  const save = createNativeSaveCoordinator({
    capture() { const index = calls++; captures.push(index); if (index === 1) throw failure; return index; },
    pack(checkpoint) { return `save:${checkpoint}`; },
    async commit(value) { if (value === 'save:0') await firstCommit.promise; writes.push(value); },
  });
  const pending = [callBoundary(save)];
  try {
    await turn();
    let secondSettled = false;
    pending.push(callBoundary(save).then(outcome => { secondSettled = true; return outcome; }));
    pending.push(callBoundary(save));
    assert.deepEqual(captures, [0, 1, 2], 'the second failure and third capture reserve at call time');
    await turn();
    assert.equal(secondSettled, false, 'second caller outcome follows the pending first save in FIFO');
    assert.deepEqual(writes, []);
    firstCommit.resolve();
    const outcomes = await Promise.all(pending);
    fulfilled(outcomes[0], 'save:0');
    rejected(outcomes[1], failure);
    fulfilled(outcomes[2], 'save:2');
    assert.deepEqual(writes, ['save:0', 'save:2']);
  } finally {
    firstCommit.resolve();
    await Promise.all(pending);
  }
});

add('terminal session before save makes no native request, pack, or commit and returns rejected Promises', async () => {
  const controller = new AbortController();
  const reason = new Error('session already terminal');
  const calls = [];
  controller.abort(reason);
  const save = createNativeSaveCoordinator({
    signal: controller.signal,
    capture() { calls.push('capture'); return 'unused'; },
    pack() { calls.push('pack'); return 'unused'; },
    commit() { calls.push('commit'); },
  });
  const outcomes = await Promise.all([callBoundary(save), callBoundary(save)]);
  rejected(outcomes[0], reason); rejected(outcomes[1], reason);
  assert.deepEqual(calls, []);
});

add('terminal session after both reservations suppresses every pack and commit and handles a reserved rejection', async () => {
  const controller = new AbortController();
  const reason = new Error('session ended after reservations');
  const captures = [deferred(), deferred()];
  const calls = [];
  let index = 0;
  const save = createNativeSaveCoordinator({
    signal: controller.signal,
    capture() { calls.push('capture'); return captures[index++].promise; },
    pack() { calls.push('pack'); return 'unused'; },
    commit() { calls.push('commit'); },
  });
  const outcomesPending = [callBoundary(save), callBoundary(save)];
  assert.deepEqual(calls, ['capture', 'capture']);
  controller.abort(reason);
  captures[0].resolve('first');
  captures[1].reject(new Error('native request rejected after terminal'));
  const outcomes = await Promise.all(outcomesPending);
  rejected(outcomes[0], reason); rejected(outcomes[1], reason);
  await turn(); await turn();
  assert.deepEqual(calls, ['capture', 'capture']);
});

for (const mode of ['pack-throw', 'commit-throw', 'commit-reject']) {
  add(`${mode} releases FIFO, preserves exact caller outcomes, and commits later saves once in order`, async () => {
    const failure = new Error(`authored ${mode} failure`);
    const failedCommit = deferred();
    const captures = [];
    const packed = [];
    const attempts = [];
    const writes = [];
    let stored;
    const save = createNativeSaveCoordinator({
      capture() { const value = `checkpoint:${captures.length}`; captures.push(value); return value; },
      pack(value) { packed.push(value); if (mode === 'pack-throw' && value === 'checkpoint:0') throw failure; return `save:${value}`; },
      commit(value) {
        attempts.push(value);
        if (value === 'save:checkpoint:0') {
          if (mode === 'commit-throw') throw failure;
          if (mode === 'commit-reject') return failedCommit.promise;
        }
        writes.push(value); stored = value;
      },
    });
    const pending = [observe(save()), observe(save()), observe(save())];
    try {
      assert.deepEqual(captures, ['checkpoint:0', 'checkpoint:1', 'checkpoint:2']);
      if (mode === 'commit-reject') {
        await turn();
        assert.deepEqual(packed, ['checkpoint:0']);
        assert.deepEqual(attempts, ['save:checkpoint:0']);
        assert.deepEqual(writes, []);
        failedCommit.reject(failure);
      }
      const outcomes = await Promise.all(pending);
      rejected(outcomes[0], failure);
      fulfilled(outcomes[1], 'save:checkpoint:1');
      fulfilled(outcomes[2], 'save:checkpoint:2');
      assert.deepEqual(packed, ['checkpoint:0', 'checkpoint:1', 'checkpoint:2']);
      assert.deepEqual(attempts, mode === 'pack-throw' ? ['save:checkpoint:1', 'save:checkpoint:2'] : ['save:checkpoint:0', 'save:checkpoint:1', 'save:checkpoint:2']);
      assert.deepEqual(writes, ['save:checkpoint:1', 'save:checkpoint:2']);
      assert.equal(stored, 'save:checkpoint:2', 'an earlier failure cannot overwrite the later successful commit');
    } finally {
      failedCommit.resolve();
      await Promise.all(pending);
    }
  });
}

add('invalid packed value rejects its caller without storage and does not block a later valid save', async () => {
  const writes = [];
  let calls = 0;
  const save = createNativeSaveCoordinator({
    capture() { return ++calls; },
    pack(value) { return value === 1 ? { invalid: true } : 'second-save'; },
    commit(value) { writes.push(value); },
  });
  const outcomes = await Promise.all([observe(save()), observe(save())]);
  assert.equal(outcomes[0].status, 'rejected');
  assert.equal(outcomes[0].reason.message, 'native pack did not return a save string');
  fulfilled(outcomes[1], 'second-save');
  assert.deepEqual(writes, ['second-save']);
});

const results = [];
for (const test of tests) {
  const unhandledBefore = unhandled.length;
  try {
    await test.run();
    await turn(); await turn();
    assert.equal(unhandled.length, unhandledBefore, 'authored case must produce no unhandled rejection');
    results.push({ name: test.name, pass: true });
  } catch (error) {
    results.push({ name: test.name, pass: false, error: String(error), stack: error.stack });
  }
}
await turn(); await turn();
process.removeListener('unhandledRejection', onUnhandled);
const after = { module: sha(moduleFile), test: sha(testFile) };
const stable = before.module === after.module && before.test === after.test;
const passed = results.every(test => test.pass) && unhandled.length === 0 && stable;
const receipt = {
  schema_version: 1,
  scope: 'dcss-v2-save-reservation-authored-node-suite',
  executed_utc: new Date().toISOString(),
  repository, module: moduleFile, test: testFile,
  source_sha256_before: before, source_sha256_after: after, source_stable: stable,
  process: { pid: process.pid, node: process.version, exec_argv: process.execArgv, heap_cap_mib: 128 },
  imports: ['node:assert/strict', 'node:fs', 'node:path', 'node:crypto', 'node:url', 'web/native-save-coordinator.mjs'],
  actual_test_count: results.length, actual_pass_count: results.filter(test => test.pass).length,
  test_count: results.length, passed_test_count: results.filter(test => test.pass).length,
  unhandled_rejection_count: unhandled.length, unhandled_rejections: unhandled.map(reason => String(reason)),
  checks: results, results, passed,
  native_rust_wasm_browser_build_or_installed_trial_mutation: false,
  scope_limit: 'Authored Node tests of the coordinator proposal with mocked capture/pack/commit callbacks; no claim of native helper or real browser execution.',
  evidence_directory: process.env.DCSS_SAVE_RESERVATION_EVIDENCE_DIR ? path.resolve(process.env.DCSS_SAVE_RESERVATION_EVIDENCE_DIR) : null,
};
if (receipt.evidence_directory) {
  if (receipt.evidence_directory === testDirectory) throw new Error('choose a separate save reservation evidence directory');
  const logFile = path.join(receipt.evidence_directory, 'save-reservation.log');
  const receiptFile = path.join(receipt.evidence_directory, 'save-reservation.receipt.json');
  if (fs.existsSync(logFile) || fs.existsSync(receiptFile)) throw new Error('save reservation evidence must use new exclusive files');
  fs.mkdirSync(receipt.evidence_directory, { recursive: true });
  const log = results.map(test => `${test.pass ? 'PASS' : 'FAIL'} ${test.name}${test.pass ? '' : `\n${test.stack}`}`).join('\n') + `\n${receipt.actual_pass_count}/${receipt.actual_test_count} authored cases passed; unhandled=${unhandled.length}; source_stable=${stable}\n`;
  fs.writeFileSync(logFile, log, { flag: 'wx' });
  fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  receipt.evidence_files = [logFile, receiptFile].map(file => ({ path: file, sha256: sha(file) }));
}
console.log(JSON.stringify(receipt, null, 2));
if (!passed) process.exitCode = 1;
