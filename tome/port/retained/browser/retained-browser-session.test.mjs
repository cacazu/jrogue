// Source-prepared ABI test; requires a rebuilt final-source Rust WASM artifact.
// Native callback data here is synthetic, never evidence of original gameplay.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { OriginalNativeCore } from './original-native-core.mjs';
import { createRetainedBrowserSession, RetainedBrowserSession } from './retained-browser-session.mjs';

const bytes = await readFile(process.argv[2] ||
  new URL('../target/wasm32-unknown-unknown/release/tome_core_environment.wasm', import.meta.url));
const world = turn => ({ protocol: 1, ready: true, game: { turn, paused: true,
  player: { uid: 71, name: '外部名 {text} <script>', x: 0, y: 0, level: 1, life: 100, max_life: 100 },
  level: { level: 1, map: { w: 1, h: 1, cells: [
    { x: 0, y: 0, seen: true, remembered: true, terrain: { uid: 17, display: '.' } },
  ] } },
} });

const calls = [];
let current = world(12);
const native = {
  ccall(name, returnType, types, values) {
    calls.push(name);
    if (name === 'tome_native_init' || name === 'tome_native_start') return 1;
    if (name === 'tome_native_snapshot') return JSON.stringify(current);
    if (name === 'tome_native_command') {
      const before = current;
      current = world(22);
      return JSON.stringify({ protocol: 1, command: values[0], ticks: 10, before, after: current });
    }
    throw new Error('Unexpected native ABI call');
  },
};
for (const name of ['init', 'start', 'last_error', 'snapshot', 'command']) native[`_tome_native_${name}`] = () => {};
const presented = [];
const session = await createRetainedBrowserSession({
  rustWasmBytes: bytes, canvas: {},
  nativeFactory: async options => {
    assert.equal(options.noInitialRun, true);
    assert.ok(options.canvas);
    calls.push('factory');
    return native;
  },
  mountBeforeInit: async module => {
    assert.equal(module, native);
    assert.deepEqual(calls, ['factory']);
    calls.push('mount');
  },
  onPresentation: presentation => presented.push(presentation),
});
assert.deepEqual(calls, ['factory', 'mount']);
const firstStartup = session.start();
assert.equal(session.start(), firstStartup);
assert.equal((await firstStartup).phase, 'ready');
assert.deepEqual(calls, ['factory', 'mount', 'tome_native_init', 'tome_native_start', 'tome_native_snapshot']);
assert.equal(presented[0].locale, 'ja');
for (const response of presented) assert.equal(typeof response.labels[response.status_id], 'string');

const action = session.dispatch({ op: 'key', input: { key: 'ArrowRight' } });
assert.equal(action.immediate.handled, true);
assert.equal(action.immediate.view.game.turn, 12);
assert.equal((await action.completion).view.game.turn, 22);
assert.equal(calls.filter(name => name === 'tome_native_command').length, 1);
const after = JSON.stringify(current);
for (const request of [
  { op: 'view' }, { op: 'locale', locale: 'en' },
  { op: 'key', input: { key: 'ArrowLeft', composing: true } },
]) await session.dispatch(request).completion;
assert.equal(JSON.stringify(current), after);
assert.equal(calls.filter(name => name === 'tome_native_snapshot').length, 1);
assert.equal(calls.filter(name => name === 'tome_native_command').length, 1);

// Startup failure is terminal and localized; pure locale changes remain possible.
const { instance } = await WebAssembly.instantiate(bytes, {});
const brokenCalls = [];
const broken = { ...native, ccall(name) {
  brokenCalls.push(name);
  return name === 'tome_native_last_error' ? 'failed original initialization' : 0;
} };
const failed = new RetainedBrowserSession(instance.exports);
failed.attach(new OriginalNativeCore(broken));
assert.equal((await failed.start()).error_id, 'error.core.native_init');
await failed.start();
await failed.dispatch({ op: 'touch', key: 'MOVE_STAY' }).completion;
assert.deepEqual(brokenCalls, ['tome_native_init', 'tome_native_last_error']);
assert.equal((await failed.dispatch({ op: 'locale', locale: 'en' }).completion).error_id, 'error.core.native_init');
console.log('Session ABI fixtures passed: mount/init/start order, single startup/action, pure display, semantic failures.');
