import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { nativeMouseButton } from '../web/core.js';
import { parsePresentationModel, renderPresentationModel } from '../web/semantic-view.js';

const originalMouse = () => ({ x: 11, y: 8, button: 1, mods: 0 });
const row = (overrides = {}) => ({ kind: 'paragraph', key: 'row.3.name', text: '\u8a73\u7d30\u306a\u547d\u4ee4', selected: true, color: 9,
  activation_key: null, activation_mouse: originalMouse(), ...overrides });
const model = (blocks = [row()], locale = 'ja') => ({ schema_version: 1, locale, state_summary: '',
  sections: [{ key: 'context-menu.0', heading: '', blocks }], messages: [], message_ids: [], missing_ids: [],
  semantic: { scopes: [], messages: [] } });
class Element {
  children = []; textContent = ''; style = {}; attributes = {}; listeners = new Map();
  constructor(tag = 'root') { this.tag = tag; }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(event, callback) {
    const callbacks = this.listeners.get(event) ?? [];
    callbacks.push(callback); this.listeners.set(event, callbacks);
  }
  click() { for (const callback of this.listeners.get('click') ?? []) callback(); }
  set innerHTML(_) { throw new Error('context row attempted HTML injection'); }
}
const document_ = { createElement: tag => new Element(tag) };
const rendered = container => container.children[0].children[0];

test('context mouse wire accepts only the owned four native activation facts', () => {
  for (const mouse of [originalMouse(), { x: 0, y: 0, button: 1, mods: 0 }, { x: 255, y: 255, button: 1, mods: 0 }, null]) {
    assert.doesNotThrow(() => parsePresentationModel(model([row({ activation_mouse: mouse })])));
  }
  for (const mouse of [
    {}, { ...originalMouse(), x: -1 }, { ...originalMouse(), x: 256 },
    { ...originalMouse(), y: -1 }, { ...originalMouse(), y: 256 },
    { ...originalMouse(), x: 11.5 }, { ...originalMouse(), y: '8' },
    { ...originalMouse(), button: 2 }, { ...originalMouse(), mods: 1 },
    { ...originalMouse(), kind: 'mouse' }, { ...originalMouse(), key: 97 },
    { ...originalMouse(), command: 'CMD_PICKUP' }, { ...originalMouse(), cursor: true },
    [11, 8, 1, 0], '11,8', false,
  ]) {
    assert.throws(() => parsePresentationModel(model([row({ activation_mouse: mouse })])), /paragraph/, JSON.stringify(mouse));
  }
});

test('context mouse activation is owned immutable data and each click sends a fresh native event', () => {
  const source = model();
  const capture = parsePresentationModel(source);
  const mouse = capture.sections[0].blocks[0].activation_mouse;
  assert.ok(Object.isFrozen(mouse));
  source.sections[0].blocks[0].activation_mouse.x = 90;
  assert.deepEqual(mouse, originalMouse());
  assert.throws(() => { mouse.x = 90; }, TypeError);
  const events = [], container = new Element();
  renderPresentationModel(container, capture, null, document_, event => {
    events.push(event); event.x = 90;
  });
  const button = rendered(container);
  assert.equal(button.tag, 'button');
  assert.equal(button.type, 'button');
  assert.equal(button.attributes['data-source-context'], 'context-menu.0');
  assert.equal(button.attributes['data-source-widget'], 'row.3.name');
  assert.equal(button.attributes['aria-current'], 'true');
  button.click(); button.click();
  assert.equal(events.length, 2);
  assert.notEqual(events[0], events[1]);
  assert.notEqual(events[0], mouse);
  assert.deepEqual(mouse, originalMouse());
});

test('one context click delegates mouse once and never invokes an accompanying key shortcut', () => {
  const capture = parsePresentationModel(model([row({ activation_key: 97 })]));
  const keys = [], mouseEvents = [], container = new Element();
  renderPresentationModel(container, capture, key => keys.push(key), document_, mouse => mouseEvents.push(mouse));
  rendered(container).click();
  assert.deepEqual(keys, []);
  assert.deepEqual(mouseEvents, [originalMouse()]);
  assert.equal(rendered(container).listeners.get('click').length, 1);
  // Browser knows no flags, double-tap state, callbacks or confirmations. The
  // exact single native event lets the original controller enforce those rules.
});

test('inactive native parent and invalid rows render as paragraphs without activation', () => {
  const capture = parsePresentationModel(model([
    row({ activation_key: null, activation_mouse: null }),
    row({ key: 'row.4.name', selected: false, activation_key: null, activation_mouse: null }),
  ]));
  const events = [], container = new Element();
  renderPresentationModel(container, capture, key => events.push(key), document_, mouse => events.push(mouse));
  for (const element of container.children[0].children) {
    assert.equal(element.tag, 'p');
    assert.equal(element.listeners.has('click'), false);
    element.click();
  }
  assert.deepEqual(events, []);
});

test('context rerender and locale replacement preserve original mouse facts without RNG or mutation', () => {
  const japanese = parsePresentationModel(model());
  const english = parsePresentationModel(model([row({ text: 'Detailed commands' })], 'en'));
  const before = [JSON.stringify(japanese), JSON.stringify(english)];
  const random = Math.random;
  Math.random = () => { throw new Error('context renderer consumed RNG'); };
  try {
    const container = new Element();
    const events = [];
    for (let index = 0; index < 8; index++) {
      for (const capture of [japanese, english]) {
        renderPresentationModel(container, capture, null, document_, mouse => events.push(mouse));
        rendered(container).click();
        assert.equal(container.children.length, 1);
        assert.equal(container.children[0].children.length, 1);
      }
    }
    assert.equal(events.length, 16);
    assert.ok(events.every(mouse => JSON.stringify(mouse) === JSON.stringify(originalMouse())));
    assert.deepEqual([JSON.stringify(japanese), JSON.stringify(english)], before);
  } finally { Math.random = random; }
});

test('canvas pointer mapping preserves original left, right/escape and middle policy', () => {
  assert.deepEqual([0, 1, 2, 3, 4, -1, undefined].map(nativeMouseButton), [1, 3, 2, 0, 0, 0, 0]);
});

test('application context mouse gate sends the exact native event once only within current terminal/session', () => {
  const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('function sendNativeMouse(mouse)');
  const end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, 'source-owned mouse adapter function');
  const packets = [];
  const worker = { postMessage: packet => packets.push(packet) };
  const baseline = { active: true, loading: false, pendingSave: null, worker, latestFrame: { width: 80, height: 24 } };
  const context = vm.createContext({ ...baseline });
  vm.runInContext(source.slice(start, end), context, { filename: 'source-sendNativeMouse.js' });
  const mouse = originalMouse();
  assert.equal(context.sendNativeMouse(mouse), true);
  assert.equal(packets.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(packets[0])), { type: 'event', payload: { kind: 'mouse', ...originalMouse() } });
  mouse.x = 99;
  assert.equal(packets[0].payload.x, 11, 'queued event owns its source coordinate');
  for (const overrides of [{ active: false }, { loading: true }, { pendingSave: {} }, { worker: null }, { latestFrame: null }]) {
    Object.assign(context, baseline, overrides);
    assert.equal(context.sendNativeMouse(originalMouse()), false);
  }
  Object.assign(context, baseline);
  for (const invalid of [{ x: -1 }, { x: 80 }, { y: -1 }, { y: 24 }, { button: 2 }, { mods: 1 }]) {
    assert.equal(context.sendNativeMouse({ ...originalMouse(), ...invalid }), false);
  }
  assert.equal(packets.length, 1, 'rejected events never enter the native queue');
});
