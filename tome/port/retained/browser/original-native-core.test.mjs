// Source-prepared tests. Do not execute until the parent's resource hold is released.
import assert from 'node:assert/strict';
import { NativeCoreError, OriginalNativeCore } from './original-native-core.mjs';

function nativeFixture(overrides = {}) {
  const calls = [];
  const exports = {
    tome_native_init: () => 1, tome_native_start: () => 1,
    tome_native_last_error: () => 'original diagnostic',
    tome_native_snapshot: () => '{"protocol":1,"ready":false}',
    tome_native_command: key => JSON.stringify({ command: key }),
    ...overrides,
  };
  const module = {
    ccall(name, returnType, types, values) {
      calls.push({ name, returnType, types, values });
      return exports[name](...values);
    },
  };
  for (const name of Object.keys(exports)) module[`_${name}`] = exports[name];
  return { module, calls };
}

{
  const { module, calls } = nativeFixture();
  const native = new OriginalNativeCore(module);
  assert.throws(() => native.snapshotJson(), error => error.textId === 'error.core.not_ready');
  native.initialize(); native.initialize();
  native.start(); native.start();
  const snapshot = native.snapshotJson();
  const text = new TextDecoder('utf-8', { fatal: true }).decode(snapshot);
  assert.equal(text, '{"protocol":1,"ready":false}');
  assert.equal(new TextDecoder().decode(native.commandJson('MOVE_STAY')), '{"command":"MOVE_STAY"}');
  assert.equal(new TextDecoder().decode(snapshot), text); // A later native call cannot overwrite the copy.
  for (const key of ['game.player.life=999', 'MOVE_STAY\0', 'ATTACK_OR_MOVE_STAY', 'RUN']) {
    assert.throws(() => native.commandJson(key), error => error.textId === 'error.core.request');
  }
  assert.deepEqual(calls.map(call => call.name), [
    'tome_native_init', 'tome_native_start', 'tome_native_snapshot', 'tome_native_command',
  ]);
  assert.deepEqual(calls[3], { name: 'tome_native_command', returnType: 'string',
    types: ['string'], values: ['MOVE_STAY'] });
}

for (const failedName of ['tome_native_init', 'tome_native_start']) {
  const { module, calls } = nativeFixture({ [failedName]: () => 0 });
  const native = new OriginalNativeCore(module);
  if (failedName === 'tome_native_start') native.initialize();
  const attempt = () => failedName === 'tome_native_start' ? native.start() : native.initialize();
  assert.throws(attempt, error => error instanceof NativeCoreError && error.detail === 'original diagnostic');
  assert.throws(attempt, NativeCoreError);
  assert.equal(calls.filter(call => call.name === failedName).length, 1);
  assert.equal(calls.filter(call => call.name === 'tome_native_last_error').length, 1);
  assert.equal(native.phase, 'failed');
}

{
  const { module, calls } = nativeFixture({ tome_native_command: () => null });
  const native = new OriginalNativeCore(module);
  native.initialize(); native.start();
  assert.throws(() => native.commandJson('MOVE_LEFT'), error => error.textId === 'error.core.failed');
  assert.equal(native.phase, 'started'); // A failed action is not retried or a new character.
  native.snapshotJson(); // Read the still-owned original state explicitly.
  assert.equal(calls.filter(call => call.name === 'tome_native_command').length, 1);
}

assert.throws(() => new OriginalNativeCore({ ccall() {} }), error => error.textId === 'error.core.native_exports');
console.log('Native ABI seam fixtures passed; these fixtures do not execute original gameplay.');
