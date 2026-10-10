// Narrow production-host adapter checks: no browser, engine, Rust or WASM.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
const audit = path.dirname(fileURLToPath(import.meta.url));
const trial = process.env.DCSS_REPOSITORY || path.resolve(audit, '..');
const source = path.join(trial, 'web/native-save-coordinator.mjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pinned = '0946f78a49d743215dc0314424645434082b1caa4fe6321775db0b3e0ab2c02d';
assert.equal(hash(fs.readFileSync(source)), pinned);
const { createNativeSaveCoordinator } = await import(pathToFileURL(source).href);
const checks = [];
const tick = () => new Promise(setImmediate);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

{
  const terminal = new AbortController(), captured = deferred();
  let captures = 0, packs = 0, commits = 0;
  const save = createNativeSaveCoordinator({ signal: terminal.signal,
    capture() { captures++; return captured.promise; },
    pack() { packs++; return 'portable'; }, commit() { commits++; },
  });
  const first = save(), second = save();
  const results = Promise.allSettled([first, second]);
  await tick(); assert.equal(captures, 2);
  const reason = Error('terminal during capture'); terminal.abort(reason);
  captured.resolve({ files: [], semantic: null });
  const settled = await results;
  assert(settled.every(result => result.status === 'rejected' && result.reason === reason));
  assert.deepEqual([captures, packs, commits], [2, 0, 0]);
  checks.push('termination during reserved captures blocks all queued pack/commit');
}
{
  const terminal = new AbortController(); let commits = 0;
  const reason = Error('terminal during pack');
  const save = createNativeSaveCoordinator({ signal: terminal.signal,
    capture: () => ({ files: [] }),
    pack() { terminal.abort(reason); return 'portable'; },
    commit() { commits++; },
  });
  await assert.rejects(save(), error => error === reason);
  assert.equal(commits, 0);
  checks.push('termination during synchronous packing blocks any storage commit');
}
{
  const terminal = new AbortController(), committing = deferred();
  let captures = 0, packs = 0, commits = 0;
  const save = createNativeSaveCoordinator({ signal: terminal.signal,
    capture() { captures++; return {}; }, pack() { packs++; return 'portable'; },
    commit() { commits++; return committing.promise; },
  });
  const results = Promise.allSettled([save(), save()]); await tick();
  assert.deepEqual([captures, packs, commits], [2, 1, 1]);
  const reason = Error('abortable storage rejected on terminal'); terminal.abort(reason);
  committing.reject(reason);
  assert((await results).every(result => result.status === 'rejected' && result.reason === reason));
  assert.deepEqual([captures, packs, commits], [2, 1, 1]);
  checks.push('aborted in-flight storage settles the active save and prevents packing reserved successors');
}
{
  const captureGate = deferred(); let captures = 0;
  const commits = [];
  const save = createNativeSaveCoordinator({
    capture() { captures++; return captures === 1 ? captureGate.promise : { index: captures }; },
    pack: checkpoint => JSON.stringify(checkpoint), commit: portable => commits.push(portable),
  });
  const results = Promise.allSettled([save(), save()]); await tick();
  const failure = Error('first native capture failed'); captureGate.reject(failure);
  const settled = await results;
  assert.equal(settled[0].status, 'rejected'); assert.equal(settled[0].reason, failure);
  assert.equal(settled[1].status, 'fulfilled'); assert.equal(settled[1].value, '{"index":2}');
  assert.deepEqual(commits, ['{"index":2}']);
  checks.push('queued valid saves recover after capture rejection without overwriting an earlier result');
}
{
  let asyncPack = true, commits = 0;
  const save = createNativeSaveCoordinator({ capture: () => ({}),
    pack: () => asyncPack ? Promise.resolve('bad asynchronous pack') : 'valid synchronous pack',
    commit() { commits++; },
  });
  await assert.rejects(save(), /did not return a save string/); assert.equal(commits, 0);
  asyncPack = false; assert.equal(await save(), 'valid synchronous pack'); assert.equal(commits, 1);
  checks.push('an unsupported asynchronous pack never reaches storage and releases the save queue');
}
assert.equal(hash(fs.readFileSync(source)), pinned, 'production host source unchanged');
console.log(JSON.stringify({ kind: 'additional production save coordinator host checks',
  source_sha256: pinned, checks, count: checks.length, actual_engine_executed: false,
  actual_rust_executed: false, actual_wasm_executed: false, browser_executed: false,
  native_rng_executed: false }, null, 2));
