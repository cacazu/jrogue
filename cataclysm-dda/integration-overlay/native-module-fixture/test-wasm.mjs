// Pending genuine WASM tests. This script does not model the C++ encoder or state.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(here, 'fixture-plan.json'), 'utf8'));
const expectedBuildId = manifest.moduleBuildIdentity;
const output = path.join(here, 'execution', 'wasm-results');
const modulePath = path.join(here, 'build', 'snapshot-fixture.mjs');
const factory = (await import(pathToFileURL(modulePath))).default;
const reports = [], notices = [], nativeFixtures = new Map();
const originalCallback = globalThis.cddaInputSnapshotAvailable;
const originalError = console.error;
const originalQueue = globalThis.queueMicrotask;
let app;

function check(name, fn) { fn(); reports.push({ name, passed: true }); }
async function asyncCheck(name, fn) { await fn(); reports.push({ name, passed: true }); }
function deferred() { return new Promise(resolve => originalQueue(resolve)); }
function pin() { return app._cdda_browser_snapshot_pin(1) >>> 0; }
function bytes(handle) {
  const address = app._cdda_browser_snapshot_data(handle) >>> 0;
  const size = app._cdda_browser_snapshot_size(handle) >>> 0;
  assert.ok(address > 0 && size > 0 && size <= 262144);
  assert.ok(address + size <= app.HEAPU8.byteLength);
  // Copy before release. Every call reacquires the current heap view.
  return app.HEAPU8.slice(address, address + size);
}
function record(handle) { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes(handle))); }
function current() {
  const handle = pin(); assert.ok(handle > 0);
  try { return record(handle); } finally { app._cdda_browser_snapshot_release(handle); }
}
function capture(name) {
  const handle = pin(); assert.ok(handle > 0);
  try {
    const copied = bytes(handle);
    nativeFixtures.set(name, copied);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(copied));
  } finally { app._cdda_browser_snapshot_release(handle); }
}
function assertIdentity(value) {
  assert.equal(value.schema_version, 1);
  assert.equal(value.interface, 'cdda-live-input-snapshot/1');
  assert.equal(value.source_commit, manifest.sourceCommit);
  assert.equal(value.engine_build_id, expectedBuildId);
  assert.match(value.publication_sequence, /^[1-9][0-9]*$/);
  assert.match(value.context_epoch, /^[1-9][0-9]*$/);
}

try {
  globalThis.cddaInputSnapshotAvailable = notice => notices.push(notice);
  app = await factory({ print: () => {}, printErr: () => {} });
  await mkdir(output, { recursive: true });
  check('out-of-scope and unknown handles are unavailable', () => {
    assert.equal(pin(), 0);
    assert.equal(app._cdda_browser_snapshot_pin(0), 0);
    assert.equal(app._cdda_browser_snapshot_pin(2), 0);
    for (const handle of [0, 0xFFFFFFFF, 123456]) {
      assert.equal(app._cdda_browser_snapshot_data(handle), 0);
      assert.equal(app._cdda_browser_snapshot_size(handle), 0);
      app._cdda_browser_snapshot_release(handle);
    }
  });
  const beforeNotice = notices.length;
  check('publication has no synchronous observer reentry', () => {
    assert.equal(app._fixture_push(1), 1);
    assert.equal(notices.length, beforeNotice);
  });
  const oldHandle = pin(), oldBytes = bytes(oldHandle), root = record(oldHandle);
  nativeFixtures.set('root', oldBytes);
  check('actual JSON encoder preserves UTF-8 and escapes raw user text', () => {
    assertIdentity(root);
    assert.equal(root.category, 'FIXTURE_ROOT');
    assert.equal(root.text_policy, 'native_context');
    assert.deepEqual(root.actions.map(a => a.origin), ['context', 'missing', 'default']);
    const binding = root.actions[0].bindings[0];
    assert.deepEqual(binding.modifiers, ['ctrl', 'shift']);
    assert.deepEqual(binding.sequence, [97, 13]);
    assert.equal(binding.text, '山田 <player>\\"\n\t\0');
    assert.equal(binding.edit, '編集中');
    assert.equal(binding.edit_refresh, true);
    assert.ok(new TextDecoder().decode(oldBytes).includes('山田'));
    assert.ok(new TextDecoder().decode(oldBytes).includes('\\u0000'));
  });
  await asyncCheck('notifications are deferred, frozen and match publication', async () => {
    await deferred();
    const notice = notices.at(-1);
    assert.ok(Object.isFrozen(notice));
    assert.equal(notice.kind, 1); assert.equal(notice.availability, 1);
    assert.equal((BigInt(notice.publicationHigh) << 32n | BigInt(notice.publicationLow)).toString(), root.publication_sequence);
  });
  assert.equal(app._fixture_mutate_root(), 1);
  assert.equal(app._fixture_push(2), 2);
  const nested = capture('nested');
  check('old pin survives nested/current publication and parent mutation', () => {
    assertIdentity(nested); assert.equal(nested.depth, 2);
    assert.equal(nested.parent_context_epoch, root.context_epoch);
    assert.deepEqual(bytes(oldHandle), oldBytes);
    assert.equal(record(oldHandle).category, 'FIXTURE_ROOT');
  });
  assert.equal(app._fixture_pop(), 1);
  const restored = capture('restored');
  check('scope restore refreshes actual callback values with stable epoch', () => {
    assert.equal(restored.context_epoch, root.context_epoch);
    assert.equal(restored.category, 'FIXTURE_ROOT_CHANGED');
    assert.deepEqual(restored.actions[0].bindings[0].sequence, [122]);
    assert.ok(BigInt(restored.publication_sequence) > BigInt(nested.publication_sequence));
    assert.deepEqual(bytes(oldHandle), oldBytes);
  });
  app._fixture_clear();
  check('last-scope exit clears latest without invalidating old pins', () => {
    assert.equal(pin(), 0); assert.deepEqual(bytes(oldHandle), oldBytes);
  });
  app._cdda_browser_snapshot_release(oldHandle);
  assert.equal(app._fixture_push(3), 1);
  const stringInput = capture('string-input');
  check('STRING_INPUT retains raw username and native enum descriptors', () => {
    assert.equal(stringInput.text_policy, 'raw_utf8');
    assert.equal(stringInput.preferred_keyboard_mode, 'keychar');
    assert.equal(stringInput.actions[0].bindings[0].text, root.actions[0].bindings[0].text);
  });
  const handles = Array.from({ length: 16 }, () => pin());
  check('actual pin capacity, release, and nonreused handles', () => {
    assert.equal(new Set(handles).size, 16); assert.ok(handles.every(h => h > 0));
    assert.equal(pin(), 0);
    app._cdda_browser_snapshot_release(handles[5]);
    assert.equal(app._cdda_browser_snapshot_size(handles[5]), 0);
    const replacement = pin(); assert.ok(replacement > 0);
    assert.ok(!handles.includes(replacement));
    assert.equal(pin(), 0);
    app._cdda_browser_snapshot_release(replacement);
    for (const h of handles) app._cdda_browser_snapshot_release(h);
  });
  const growthPin = pin(), growthBytes = bytes(growthPin), stale = app.HEAPU8;
  check('small heap growth requires fresh JS view and preserves pinned native bytes', () => {
    const oldSize = app._fixture_heap_bytes() >>> 0;
    assert.ok(oldSize < 64 * 1024 * 1024);
    assert.equal(app._fixture_grow_heap(), 1);
    const newSize = app._fixture_heap_bytes() >>> 0;
    assert.ok(newSize > oldSize && newSize <= 64 * 1024 * 1024);
    assert.notEqual(app.HEAPU8.buffer, stale.buffer);
    assert.equal(stale.byteLength, 0);
    assert.deepEqual(bytes(growthPin), growthBytes);
  });
  app._cdda_browser_snapshot_release(growthPin); app._fixture_clear();
  for (const id of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19]) {
    await asyncCheck(`actual encoder rejects invalid/beyond-limit case ${id}`, async () => {
      assert.equal(app._fixture_push(id), 1); assert.equal(pin(), 0);
      await deferred(); assert.equal(notices.at(-1).availability, id === 6 ? 3 : 2);
      app._fixture_clear();
    });
  }
  for (const [id, inspect] of [
    [14, v => assert.equal(Buffer.byteLength(v.category), 16384)],
    [15, v => assert.equal(v.actions.length, 2048)],
    [16, v => assert.equal(v.actions[0].bindings.length, 128)],
    [17, v => assert.equal(v.actions[0].bindings[0].sequence.length, 64)],
    [18, v => assert.equal(v.category, 'quote" slash\\ nul\0 end')],
  ]) {
    check(`actual encoder accepts boundary case ${id}`, () => {
      assert.equal(app._fixture_push(id), 1);
      inspect(capture(`boundary-${id}`)); app._fixture_clear();
    });
  }
  await asyncCheck('actual depth limit restores the 64th context after rejected 65th', async () => {
    for (let i = 1; i <= 64; ++i) assert.equal(app._fixture_push(1), i);
    assert.equal(current().depth, 64);
    assert.equal(app._fixture_push(1), 65); assert.equal(pin(), 0);
    await deferred(); assert.equal(notices.at(-1).availability, 3);
    assert.equal(app._fixture_pop(), 64); assert.equal(current().depth, 64);
    app._fixture_clear(); assert.equal(pin(), 0);
  });
  await deferred();
  await asyncCheck('deferred host and logging exceptions never escape native publication', async () => {
    const previousError = console.error;
    let callbackCalls = 0, loggingCalls = 0;
    globalThis.cddaInputSnapshotAvailable = () => {
      callbackCalls++; throw new Error('synthetic observer failure');
    };
    console.error = () => { loggingCalls++; throw new Error('synthetic logging failure'); };
    try {
      assert.equal(app._fixture_push(1), 1); await deferred(); assertIdentity(current());
      assert.equal(callbackCalls, 1); assert.equal(loggingCalls, 1);
    } finally {
      app._fixture_clear(); await deferred(); console.error = previousError;
    }
    assert.equal(callbackCalls, 2); assert.equal(loggingCalls, 2);
  });
  check('scheduling and logging exceptions are contained by actual EM_JS', () => {
    let schedulingCalls = 0, loggingCalls = 0;
    globalThis.queueMicrotask = () => {
      schedulingCalls++; throw new Error('synthetic scheduling failure');
    };
    console.error = () => { loggingCalls++; throw new Error('synthetic logging failure'); };
    try {
      assert.equal(app._fixture_push(1), 1); assertIdentity(current());
      assert.equal(schedulingCalls, 1); assert.equal(loggingCalls, 1);
      app._fixture_clear();
      assert.equal(schedulingCalls, 2); assert.equal(loggingCalls, 2);
    }
    finally { globalThis.queueMicrotask = originalQueue; console.error = originalError; }
  });
  const fixturePins = {};
  for (const [name, value] of nativeFixtures) {
    // Archive exact bytes copied from the actual C++ string, without reserialization.
    await writeFile(path.join(output, `${name}.json`), value);
    fixturePins[name] = { bytes: value.length, sha256: createHash('sha256').update(value).digest('hex') };
  }
  const artifacts = {};
  for (const name of ['snapshot-fixture.mjs', 'snapshot-fixture.wasm']) {
    const data = await readFile(path.join(here, 'build', name));
    artifacts[name] = { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  }
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({
    schemaVersion: 1, status: 'actual-snapshot-module-wasm-synthetic-callback-fixture-passed',
    actualModuleExecuted: true, genuineWasmExportTests: reports.length, reports, artifacts, fixturePins,
    callbackContextsAreSynthetic: true, originalInputContextExecuted: false,
    originalActionContextsLookupVerified: false, liveEngineIntegration: false,
    gameplayOwnershipVerified: false, RustConsumerExecuted: false, wholeGameProof: false,
  }, null, 2) + '\n');
  console.log(`Actual snapshot-module WASM fixture: ${reports.length} scoped checks passed.`);
} finally {
  try { app?._fixture_clear(); } catch {}
  globalThis.cddaInputSnapshotAvailable = originalCallback;
  globalThis.queueMicrotask = originalQueue;
  console.error = originalError;
}
