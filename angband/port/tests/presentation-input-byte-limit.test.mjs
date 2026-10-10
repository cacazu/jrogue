import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PRESENTATION_MODEL, parsePresentationModel } from '../web/semantic-view.js';

function model(overrides = {}) {
  return { schema_version: 1, locale: 'ja', state_summary: '', sections: [], messages: [],
    message_ids: [], missing_ids: [], semantic: { scopes: [], messages: [] }, ...overrides };
}

test('owned Rust input limits retain exact zero, quantity6 and65536 wire bounds', () => {
  for (const maximum of [0, 6, 65536]) {
    const source = model({ input_max_bytes: maximum });
    for (const input of [source, JSON.stringify(source)]) {
      const captured = parsePresentationModel(input);
      assert.equal(captured.input_max_bytes, maximum);
      assert.equal(JSON.parse(JSON.stringify(captured)).input_max_bytes, maximum);
      assert.ok(Object.isFrozen(captured));
    }
  }
});

test('absent and null input limits remain uncapped without inheriting an earlier model', () => {
  const limited = parsePresentationModel(model({ input_max_bytes: 6 }));
  const absent = parsePresentationModel(model());
  const uncapped = parsePresentationModel(model({ input_max_bytes: null }));
  assert.equal(limited.input_max_bytes, 6);
  assert.equal(absent.input_max_bytes, undefined);
  assert.equal(Object.hasOwn(absent, 'input_max_bytes'), false);
  assert.equal(uncapped.input_max_bytes, null);
  assert.equal(EMPTY_PRESENTATION_MODEL.input_max_bytes, undefined);
  assert.equal(limited.input_max_bytes, 6);
});

test('presentation parser rejects wrong input-limit types, fractions and out-of-range integers', () => {
  for (const maximum of ['6', true, false, [], {}, -1, 65537, 6.5, 1e308]) {
    assert.throws(() => parsePresentationModel(model({ input_max_bytes: maximum })),
      /presentation input byte limit/, 'accepted ' + JSON.stringify(maximum));
  }
});

test('captured input limit is owned and immutable while later full-model replacements clear it', () => {
  const source = model({ input_max_bytes: 6 });
  const limited = parsePresentationModel(source);
  source.input_max_bytes = 65537;
  assert.equal(limited.input_max_bytes, 6);
  assert.throws(() => { limited.input_max_bytes = 65537; }, TypeError);
  const closed = parsePresentationModel(JSON.stringify(model({ input_max_bytes: null })));
  assert.equal(closed.input_max_bytes, null);
  assert.equal(limited.input_max_bytes, 6);
});
