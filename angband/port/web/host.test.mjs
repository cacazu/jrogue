import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { drawFrame, frameText, immutableFrame, immutableState, interpolate, keyboardInput, packKey, parseSeed } from './core.js';
import { MAX_ENVELOPE_BYTES, exportRecord, importRecord, makeSaveRecord, validatePayloadLength, validateSaveRecord } from './storage.js';

const build = JSON.parse(await readFile(new URL('./build-info.json', import.meta.url), 'utf8'));
const english = JSON.parse(await readFile(new URL('./i18n/en.json', import.meta.url), 'utf8'));
const japanese = JSON.parse(await readFile(new URL('./i18n/ja.json', import.meta.url), 'utf8'));
test('Host languages have identical semantic IDs and placeholders', async () => {
  assert.deepEqual(Object.keys(english).sort(), Object.keys(japanese).sort());
  for (const id of Object.keys(english)) {
    const params = value => [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(params(english[id]), params(japanese[id]), id);
    assert.ok(japanese[id].length, id);
  }
  const sources = await Promise.all(['index.html', 'app.js'].map(file => readFile(new URL(file, import.meta.url), 'utf8')));
  for (const source of sources) {
    for (const match of source.matchAll(/(?:data-i18n(?:-aria|-title)?="|\bt\('|\bstatus\(')([a-z][a-z0-9_.]+)/g)) {
      assert.ok(Object.hasOwn(english, match[1]), `Missing semantic ID: ${match[1]}`);
    }
  }
  assert.equal(interpolate('名前 {name}、{count}個', { name: 'Player 1', count: 2 }), '名前 Player 1、2個');
});
test('Input matches Angband specials, control characters and modifiers; IME does not leak', () => {
  assert.equal(keyboardInput({ key: 'Enter' }), packKey(0x9c));
  assert.equal(keyboardInput({ key: 'Escape' }), packKey(0xe000));
  assert.equal(keyboardInput({ key: 'ArrowLeft', shiftKey: true }), packKey(0x81, 2));
  assert.equal(keyboardInput({ key: 's', ctrlKey: true }), packKey(19));
  assert.equal(keyboardInput({ key: '>', shiftKey: true }), packKey(62));
  assert.equal(keyboardInput({ key: '2', location: 3 }), packKey(50, 16));
  assert.equal(keyboardInput({ key: '2', location: 3, shiftKey: true }), packKey(50, 18));
  assert.equal(keyboardInput({ key: 'Process', isComposing: true }), null);
  assert.equal(packKey(0xd800), null);
  assert.equal(packKey(65, 32), null);
  assert.equal(parseSeed('4294967295'), 4294967295);
  assert.equal(parseSeed('4294967296'), null);
  assert.equal(parseSeed('1.5'), null);
});
test('Browser envelope limit matches the Rust payload, journal, RNG and checksum budget', async () => {
  assert.equal(MAX_ENVELOPE_BYTES, 32 * 1024 * 1024 + 262144 * 12 + 65 + 38 * 4 + 4);
  assert.doesNotThrow(() => validatePayloadLength(MAX_ENVELOPE_BYTES));
  assert.throws(() => validatePayloadLength(MAX_ENVELOPE_BYTES + 1), { id: 'save.too_large' });
  const oversizedMetadata = { format: 'jrogue.angband.web-save', ...build, seed: 1, savedAt: '2026-10-02T00:00:00Z', payloadLength: MAX_ENVELOPE_BYTES + 1, payload: new ArrayBuffer(0) };
  await assert.rejects(() => validateSaveRecord(oversizedMetadata, build), { id: 'save.too_large' });
});
test('Redrawing preserves immutable frame and consumes no RNG; output is repeatable', () => {
  const source = { width: 2, height: 2, cells: [[64, 1], [32, 1], [46, 2], [62, 3]], cursor: [0, 0] };
  const frame = immutableFrame(source);
  const before = JSON.stringify(frame);
  source.cells[0][0] = 88;
  assert.equal(frame.cells[0][0], 64);
  const commands = [];
  const context = new Proxy({}, { set(target, property, value) { commands.push([property, value]); target[property] = value; return true; }, get(target, property) { return target[property] ?? ((...args) => commands.push([property, ...args])); } });
  const canvas = { style: {}, getContext: () => context };
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('Rendering consumed RNG'); };
  try {
    drawFrame(canvas, frame);
    const first = JSON.stringify(commands);
    commands.length = 0;
    drawFrame(canvas, frame);
    assert.equal(JSON.stringify(commands), first);
  } finally { Math.random = originalRandom; }
  assert.equal(JSON.stringify(frame), before);
  assert.equal(frameText(frame), '@\n.>');
  assert.throws(() => immutableFrame({ ...source, cells: [] }));
  const state = immutableState({ turn: 10, rng: [1, 2, 3] });
  assert.throws(() => state.rng.push(4));
});
test('Save export round trip preserves opaque Rust envelope and metadata', async () => {
  const bytes = Uint8Array.of(0, 255, 42, 128, 0, 1);
  const record = await makeSaveRecord(bytes, build, 4294967295, new Date('2026-10-02T00:00:00Z'));
  const restored = importRecord(exportRecord(record));
  assert.deepEqual(await validateSaveRecord(restored, build), bytes);
  assert.equal(restored.savedAt, '2026-10-02T00:00:00.000Z');
  await assert.rejects(() => validateSaveRecord(restored, { ...build, upstreamCommit: 'other' }), { id: 'save.incompatible' });
  await assert.rejects(() => validateSaveRecord(restored, { ...build, schemaVersion: 2 }), { id: 'save.incompatible' });
  new Uint8Array(restored.payload)[2] ^= 1;
  await assert.rejects(() => validateSaveRecord(restored, build), { id: 'save.corrupt' });
  assert.throws(() => importRecord('{'), { id: 'save.invalid' });
});
