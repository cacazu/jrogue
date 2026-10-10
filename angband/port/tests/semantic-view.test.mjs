import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EMPTY_PRESENTATION_MODEL, parsePresentationModel, renderPresentationModel, renderPresentationMessages } from '../web/semantic-view.js';

const paragraph = (text, overrides = {}) => ({ kind: 'paragraph', key: 'row.0.name', text, selected: false, color: null, activation_key: null, ...overrides });
function model(blocks = [], overrides = {}) {
  return { schema_version: 1, locale: 'ja', state_summary: '', sections: [{ key: 'opaque-surface', heading: '表示', blocks }],
    messages: [], message_ids: [], missing_ids: [], semantic: { scopes: [], messages: [] }, ...overrides };
}
class Node {
  children = []; textContent = ''; style = {}; attributes = {}; listeners = {};
  constructor(tag = '') { this.tag = tag; }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  set innerHTML(_) { throw new Error('HTML injection attempted'); }
}
const document_ = { createElement: tag => new Node(tag) };

test('owned Rust presentation models preserve opaque Unicode and are deeply immutable', () => {
  const source = model([paragraph('山田{hero}<img> 🐉')]);
  const captured = parsePresentationModel(source);
  source.sections[0].blocks[0].text = 'changed';
  assert.equal(captured.sections[0].blocks[0].text, '山田{hero}<img> 🐉');
  assert.ok(Object.isFrozen(captured.sections[0].blocks));
  assert.throws(() => { captured.sections[0].blocks[0].text = 'changed'; }, TypeError);
});

test('state summaries arrive composed by Rust and are never rebuilt from gameplay fields in the browser', () => {
  const summary = 'ターン 51 · 深さ 1 · HP 7/10';
  const captured = parsePresentationModel(model([], { state_summary: summary }));
  assert.equal(captured.state_summary, summary);
  assert.throws(() => parsePresentationModel(model([], { state_summary: { turn: 51 } })), /version/);
  const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
  const render = source.slice(source.indexOf('function renderState()'), source.indexOf('function renderMessages()'));
  assert.match(render, /latestPresentation\.state_summary/);
  assert.doesNotMatch(render, /latestState\.|state\.summary|interpolate/);
});

test('model wire bounds, hostile keys and invalid technical rendering fields are rejected', () => {
  assert.throws(() => parsePresentationModel('{"schema_version":1,"__proto__":{}}'), /key/);
  assert.throws(() => parsePresentationModel(model([paragraph('x', { activation_key: 0xd800 })])), /paragraph/);
  assert.throws(() => parsePresentationModel(model([paragraph('x', { color: 29 })])), /paragraph/);
  assert.throws(() => parsePresentationModel(model([{ kind: 'table', key: 't', class_name: 'bad class', headers: [], rows: [] }])), /table/);
  assert.throws(() => parsePresentationModel(model([paragraph('x'.repeat(128 * 1024 + 1))])), /string size/);
});

test('generic DOM rendering consumes composed Rust text and never interprets semantic widget keys', () => {
  const captured = parsePresentationModel(model([paragraph('魔法の矢 · レベル 1 · 魔力 2 · 失敗率 17%'), paragraph('レベル +12', { key: 'not-a-gameplay-widget' })]));
  const container = new Node();
  renderPresentationModel(container, captured, null, document_);
  assert.equal(container.children[0].children[1].textContent, captured.sections[0].blocks[0].text);
  assert.equal(container.children[0].children[2].textContent, 'レベル +12');
  const source = readFileSync(new URL('../web/semantic-view.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /event\.params|__spell_row|clearTransient|replaceLocalized|semantic\.spell|stat_label/);
});

test('Rust table shape is rendered without recomputing stat bonuses or filling missing facts', () => {
  const table = { kind: 'table', key: 'stats', class_name: 'semantic-stats', headers: ['', '基本', '種族', '職業', '装備', '最大', '現在'],
    rows: [['腕力', '14', '+0', '-2', '+0', '12', '12'], ['知力', '17', '+0', '+3', '', '18/20', '18/20']] };
  const container = new Node();
  renderPresentationModel(container, parsePresentationModel(model([table])), null, document_);
  const rendered = container.children[0].children[1];
  assert.equal(rendered.className, 'semantic-stats');
  assert.deepEqual(rendered.children[2].children.map(cell => cell.textContent), table.rows[1]);
  assert.equal(rendered.children[2].children[4].textContent, '');
});

test('menu action keys originate in the Rust model and are sent only after user activation', () => {
  const container = new Node(); const keys = [];
  const captured = parsePresentationModel(model([paragraph('a) 短剣', { selected: true, color: 9, activation_key: 97 })]));
  renderPresentationModel(container, captured, key => keys.push(key), document_);
  const row = container.children[0].children[1];
  assert.equal(row.tag, 'button');
  assert.equal(row.attributes['aria-current'], 'true');
  assert.equal(row.style.color, '#c0c0c0');
  assert.deepEqual(keys, []);
  row.listeners.click();
  assert.deepEqual(keys, [97]);
});

test('generic owned highlight runs preserve Unicode text and markup remains literal', () => {
  const runs = [{ text: '説明 ', highlighted: false }, { text: '<img>魔法', highlighted: true }, { text: ' 山田', highlighted: false }];
  const captured = parsePresentationModel(model([paragraph('説明 <img>魔法 山田', { runs })]));
  const container = new Node();
  renderPresentationModel(container, captured, null, document_);
  const row = container.children[0].children[1];
  assert.deepEqual(row.children.map(node => node.tag), ['span', 'mark', 'span']);
  assert.equal(row.children.map(node => node.textContent).join(''), captured.sections[0].blocks[0].text);
  assert.ok(Object.isFrozen(captured.sections[0].blocks[0].runs[1]));
  assert.throws(() => parsePresentationModel(model([paragraph('different', { runs })])), /text runs/);
  assert.throws(() => parsePresentationModel(model([paragraph('x', { runs: [{ text: 'x', highlighted: 'true' }] })])), /text runs/);
});

test('full model replacement removes stale rows and preserves immutable diagnostic captures', () => {
  const packet = { event: { params: { name: { type: 'character_name', value: '山田' } } }, text: '山田', locale: 'ja', json: '{}' };
  const captured = parsePresentationModel(model([paragraph('山田')], { semantic: { scopes: [{ context: 'name-editor', widgets: [packet] }], messages: [] } }));
  const container = new Node();
  renderPresentationModel(container, captured, null, document_);
  renderPresentationModel(container, EMPTY_PRESENTATION_MODEL, null, document_);
  assert.deepEqual(container.children, []);
  assert.equal(captured.semantic.scopes[0].widgets[0].event.params.name.value, '山田');
  assert.ok(Object.isFrozen(captured.semantic.scopes[0].widgets[0].event.params.name));
});

test('Rust message order and text are displayed unchanged without browser locale substitution', () => {
  const captured = parsePresentationModel(model([], { messages: [{ id: 'game.first', text: '先' }, { id: 'game.dynamic', text: '現在の場所は危険だ。' }, { id: 'game.last', text: '後' }] }));
  const container = new Node();
  renderPresentationMessages(container, captured, document_);
  assert.deepEqual(container.children.map(node => node.textContent), ['先', '現在の場所は危険だ。', '後']);
});

test('repeated adapter rendering is pure and does not use RNG', () => {
  const captured = parsePresentationModel(model([paragraph('外部名 <img>')], { messages: [{ id: 'game.first', text: '表示' }] }));
  const before = JSON.stringify(captured); const previousRandom = Math.random;
  Math.random = () => { throw new Error('renderer consumed RNG'); };
  try {
    const container = new Node();
    for (let index = 0; index < 20; index++) {
      renderPresentationModel(container, captured, null, document_);
      renderPresentationMessages(new Node(), captured, document_);
    }
    assert.equal(JSON.stringify(captured), before);
  } finally { Math.random = previousRandom; }
});

test('WASM capture bridge copies both spans before producer buffers change', () => {
  const heap = new Uint8Array(4096);
  const decode = (pointer, size = 4096) => {
    let end = pointer;
    while (end < Math.min(heap.length, pointer + size) && heap[end]) end++;
    return new TextDecoder().decode(heap.slice(pointer, end));
  };
  let callback;
  const sandbox = { LibraryManager: { library: {} }, mergeInto: Object.assign, HEAPU8: heap, UTF8ToString: decode, Module: { abSemanticEvent: (json, text) => { callback = { json, text }; } } };
  vm.runInNewContext(readFileSync(new URL('../web/library.js', import.meta.url), 'utf8'), sandbox);
  const json = '{"schema_version":1,"id":"ui.sidebar.level.label","params":{},"channel":"ui","context":"sidebar","widget":"level"}';
  const bytes = new TextEncoder().encode(json);
  heap.set(bytes, 8); heap.set(new TextEncoder().encode('レベル'), 2048);
  sandbox.LibraryManager.library.ab_host_semantic_event(8, bytes.length, 2048);
  heap.fill(0);
  assert.deepEqual(callback, { json, text: 'レベル' });
});

test('locale adapter calls only Rust model reformatting and never core redraw, RNG or input', () => {
  const calls = [], emitted = [];
  const output = JSON.stringify(EMPTY_PRESENTATION_MODEL);
  const mock = { _ab_rs_set_locale() {}, ccall(name, _return, _types, args) { calls.push({ name, args }); return name === 'ab_rs_present_locale' ? 16 : 0; }, UTF8ToString: () => output };
  const sandbox = { self: { postMessage: message => emitted.push(message) }, mock, TextEncoder };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../web/worker.js', import.meta.url), 'utf8'), sandbox);
  vm.runInContext('engine=mock', sandbox);
  sandbox.self.onmessage({ data: { type: 'locale', payload: 'ja' } });
  assert.deepEqual(calls.map(call => call.name), ['ab_rs_set_locale', 'ab_rs_present_locale', 'ab_rs_present_status']);
  assert.equal(emitted[0].type, 'presentation');
  assert.equal(emitted[0].payload, output);
});

test('already emitted state is copied into the pure Rust presentation API without querying simulation', () => {
  const calls = [], emitted = [], heap = new Uint8Array(4096);
  const state = { turn: 51, depth: 1, hp: 7, maxhp: 10, generated: true, command: true, rng: [1, 2, 3] };
  const mock = { HEAPU8: heap, _malloc: () => 32, _free(pointer) { calls.push({ name: 'free', pointer }); },
    ccall(name, _return, _types, args) {
      calls.push({ name, args, capture: name === 'ab_rs_present_state' ? new TextDecoder().decode(heap.slice(args[0], args[0] + args[1])) : null });
      return 0;
    } };
  const sandbox = { self: { postMessage: message => emitted.push(message) }, mock, TextEncoder, Uint8Array, capture: JSON.stringify(state) };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../web/worker.js', import.meta.url), 'utf8'), sandbox);
  vm.runInContext("engine=mock;capturedPresentation('ab_rs_present_state',capture)", sandbox);
  assert.deepEqual(calls.map(call => call.name), ['ab_rs_present_state', 'ab_rs_present_status', 'free']);
  assert.deepEqual(JSON.parse(calls[0].capture), state);
  assert.deepEqual(emitted, []);
  assert.ok(heap[32] !== 0);
});
