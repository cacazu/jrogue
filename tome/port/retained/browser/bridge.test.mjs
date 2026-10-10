import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RetainedCoreAdapter, keyInput } from './retained-core-adapter.mjs';

const wasmPath = process.argv[2] || new URL('../target/wasm32-unknown-unknown/release/tome_core_environment.wasm', import.meta.url);
const { instance } = await WebAssembly.instantiate(await readFile(wasmPath), {});
let snapshotCalls = 0;
let commandCalls = 0;
const observation = turn => ({
  protocol: 1, ready: true,
  game: { turn, paused: true,
    player: { uid: 71, name: '外部 {seed} <script>', x: 0, y: 0, level: 1,
      life: 100, max_life: 100, energy: { value: 1000, mod: 1 }, energyBase: 0 },
    level: { level: 1, map: { w: 1, h: 1,
      cells: [{ x: 0, y: 0, seen: true, remembered: true,
        terrain: { uid: 17, name: 'floor', display: '.', color_r: 255 } }] } },
  },
});
let current = observation(12);
const original = {
  async snapshotJson() { snapshotCalls++; return JSON.stringify(current); },
  async commandJson(key) {
    commandCalls++;
    const before = current;
    current = observation(22);
    return JSON.stringify({ protocol: 1, command: key, ticks: 10, before, after: current });
  },
};
const adapter = new RetainedCoreAdapter(instance.exports, original);
assert.equal(adapter.request({ op: 'snapshot' }).pending_kind, 1);
assert.equal((await adapter.fulfill()).error_id, null);
assert.equal(snapshotCalls, 1);
assert.equal(commandCalls, 0);
const initial = adapter.request({ op: 'key', input: { key: 'ArrowRight' } });
assert.equal(initial.handled, true);
assert.equal(initial.view.game.turn, 12); // Rust does not predict or advance the original core.
const pending = adapter.fulfill();
const samePending = adapter.fulfill();
assert.equal((await pending).view.game.turn, 22);
await samePending;
assert.equal(commandCalls, 1); // Concurrent fulfillment never executes the original action twice.
for (const request of [
  { op: 'view' }, { op: 'locale', locale: 'en' }, { op: 'locale', locale: 'ja' },
  { op: 'key', input: { key: 'ArrowRight', composing: true } },
  { op: 'key', input: { key: '.', code: 'Period' } },
]) {
  const response = adapter.request(request);
  assert.equal(response.handled, false);
  assert.equal(response.pending_kind, 0);
  assert.equal(response.view.game.turn, 22);
  assert.equal(response.view.game.player.name, '外部 {seed} <script>');
  await adapter.fulfill();
}
assert.equal(snapshotCalls, 1);
assert.equal(commandCalls, 1);
assert.equal(adapter.request({ op: 'view', extra: true }).error_id, 'error.core.request');
assert.equal(keyInput({ key: 'ArrowLeft', keyCode: 229, target: { tagName: 'INPUT' } }).editable, true);
assert.equal(keyInput({ key: 'ArrowLeft', keyCode: 229 }).composing, true);
console.log('WASM bridge tests passed: exact original command transport, one native callback per action, pure locale/view, protected input');
console.log('Native callbacks in this test are synthetic protocol fixtures; real retained-core boot/gameplay proof remains separate.');
