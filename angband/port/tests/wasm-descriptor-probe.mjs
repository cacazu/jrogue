// Actual compiled formatter acceptance only. Native parser/gameplay and input
// dispatch are never started; original producer reachability has separate tests.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = path.join(root, 'build');
const evidence = path.join(root, 'tests', 'wasm-descriptor-evidence', 'results.json');
const upstream = 'f3082213b73f3e463e3d0d60bff4b00462beae6e';
const fixturePaths = ['migration/knowledge-text-data/shape-semantic-fixtures.json',
  'migration/spell-preview-data/probe-fixtures.json',
  'migration/store-welcome-message-data/semantic-fixtures.json'];
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const result = { schema_version: 1, upstreamCommit: upstream, startedAt: new Date().toISOString(),
  scope: 'isolated compiled formatter; no original gameplay/producer execution',
  checks: [], passed: false, stable: false, engineStableDuringRun: false, engine: { outputs: [], stable: false },
  fixtures: [], runtimeOutput: [], errors: [], observability: {} };
let engine, pinned, pinnedFixtures;
const trace = [];
const allowed = new Set(['ab_rs_set_locale', 'ab_rs_review_event', 'ab_rs_review_status', 'ab_rs_review_error',
  'ab_rs_frame', 'ab_rs_save_len', 'ab_rs_save_status', 'ab_rs_present_locale', 'ab_rs_present_status',
  'ab_rs_replay_enabled', 'ab_rs_replay_status', 'ab_rs_replay_target_pending_count',
  'ab_rs_replay_target_context_data', 'ab_rs_replay_target_context_len']);
function check(name, details = {}) { result.checks.push({ name, passed: true, details }); }
async function pinEngine() {
  const names = ['game.js', 'game.wasm', 'game.data'];
  const outputs = await Promise.all(names.map(async name => {
    const bytes = await readFile(path.join(build, name));
    return { name, bytes: bytes.length, sha256: hash(bytes) };
  }));
  const bytes = await readFile(path.join(build, 'manifest.json'));
  const manifest = JSON.parse(bytes.toString('utf8'));
  assert.equal(manifest.upstreamCommit, upstream);
  assert.equal(manifest.engineVersion, '4.2.6');
  for (const output of outputs) assert.deepEqual(output, manifest.outputs.find(item => item.name === output.name));
  return { outputs, manifest_sha256: hash(bytes), inputFingerprint: manifest.inputFingerprint };
}
function call(name, args = []) {
  assert.ok(allowed.has(name), 'formatter probe attempted an unapproved API: ' + name);
  assert.equal(typeof engine['_' + name], 'function', 'compiled export unavailable: ' + name);
  trace.push(name);
  return engine.ccall(name, 'number', args.map(() => 'number'), args);
}
function span(pointer, length, cap) {
  pointer >>>= 0;
  assert.ok(Number.isInteger(length) && length >= 0 && length <= cap, 'foreign span length');
  if (length === 0) return new Uint8Array();
  assert.ok(pointer && pointer <= engine.HEAPU8.length - length, 'foreign span bounds');
  return engine.HEAPU8.slice(pointer, pointer + length);
}
function cString(pointer, cap = 8 * 1024 * 1024) {
  pointer >>>= 0;
  assert.ok(pointer && pointer < engine.HEAPU8.length, 'foreign string pointer');
  const heap = engine.HEAPU8, end = Math.min(heap.length, pointer + cap + 1);
  let cursor = pointer;
  while (cursor < end && heap[cursor] !== 0) cursor++;
  assert.ok(cursor < end, 'foreign string terminator/bound');
  return decoder.decode(heap.slice(pointer, cursor));
}
function formatBytes(bytes) {
  assert.ok(bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= 128 * 1024);
  trace.push('malloc');
  const input = engine._malloc(bytes.length) >>> 0;
  assert.ok(input && input <= engine.HEAPU8.length - bytes.length, 'input allocation');
  let output;
  try {
    engine.HEAPU8.set(bytes, input);
    const pointer = call('ab_rs_review_event', [input, bytes.length]) >>> 0;
    const status = call('ab_rs_review_status');
    const error = cString(call('ab_rs_review_error'), 32768);
    const text = pointer ? cString(pointer, 8192) : null;
    // Status/error accessors must preserve the current successful output.
    if (pointer) assert.equal(cString(pointer, 8192), text);
    output = { pointer, status, error, text };
  } finally {
    engine._free(input);
    trace.push('free');
  }
  // The owned Rust result must survive release of the copied foreign input.
  if (output.pointer) assert.equal(cString(output.pointer, 8192), output.text);
  return output;
}
function formatEvent(event) { return formatBytes(encoder.encode(JSON.stringify(event))); }
function observable(locale) {
  const frame = cString(call('ab_rs_frame'));
  JSON.parse(frame);
  // This reformat-only API changes locale/output metadata, never its captures.
  const presentation = cString(call('ab_rs_present_locale', [locale === 'en' ? 0 : 1]));
  assert.equal(call('ab_rs_present_status'), 0);
  const model = JSON.parse(presentation);
  const contextLength = call('ab_rs_replay_target_context_len');
  const context = span(call('ab_rs_replay_target_context_data'), contextLength, 4096);
  return { frame: { bytes: encoder.encode(frame).length, sha256: hash(frame) },
    presentation: { bytes: encoder.encode(presentation).length, sha256: hash(presentation),
      scopes: model.semantic.scopes.length, messages: model.semantic.messages.length },
    save: { length: call('ab_rs_save_len'), status: call('ab_rs_save_status') },
    inputReplay: { enabled: call('ab_rs_replay_enabled'), status: call('ab_rs_replay_status'),
      targetPending: call('ab_rs_replay_target_pending_count'), contextLength, contextSha256: hash(context) } };
}
function preserved(before, locale, name) {
  assert.deepEqual(observable(locale), before, 'formatter changed observable transport: ' + name);
  check('Observable frame/cache/save/replay state preserved: ' + name);
}
function positive(fixture, locale, before) {
  const output = formatEvent(fixture.event);
  assert.equal(output.status, 0, output.error);
  assert.equal(output.error, '');
  assert.ok(output.pointer);
  assert.equal(output.text, fixture.expected[locale], fixture.name + ' ' + locale);
  decoder.decode(encoder.encode(output.text));
  if (fixture.nativeBudget !== undefined) assert.ok(encoder.encode(output.text).length <= fixture.nativeBudget);
  check('Compiled ' + locale + ' formatter: ' + fixture.name, { id: fixture.event.id,
    captureSha256: hash(JSON.stringify(fixture.event)), text: output.text, bytes: encoder.encode(output.text).length });
  preserved(before, locale, fixture.name + ' ' + locale);
}
function noteFixtures() {
  const name = '山田 🐉', text = '界'.repeat(26);
  const user = value => ({ type: 'verbatim_user_text', value, origin: 'user' });
  const event = (id, params) => ({ schema_version: 1, id, params, channel: 'message', context: 'command', widget: 'log' });
  return [
    { name: 'source86-note-say', nativeBudget: 86,
      event: event('ui.residual.note.say', { name: { type: 'character_name', value: name }, text: user(text) }),
      expected: { en: name + ' says: "' + '界'.repeat(22), ja: name + 'の発言：「' + '界'.repeat(20) } },
    { name: 'source86-note-action', nativeBudget: 86,
      event: event('ui.residual.note.action', { name: { type: 'character_name', value: name }, text: user(' ' + text) }),
      expected: { en: name + ' ' + '界'.repeat(24), ja: name + ' ' + '界'.repeat(24) } },
    { name: 'source86-note-plain', nativeBudget: 86,
      event: event('ui.residual.note.plain', { text: user(text) }),
      expected: { en: 'Note: ' + '界'.repeat(26), ja: 'メモ：' + '界'.repeat(25) } },
    { name: 'short-note-preserves-opaque-braces-and-markup', nativeBudget: 86,
      event: event('ui.residual.note.plain', { text: user('<img>{hero} 山田') }),
      expected: { en: 'Note: <img>{hero} 山田', ja: 'メモ：<img>{hero} 山田' } },
  ];
}
try {
  pinned = await pinEngine();
  result.engine = { ...pinned, stable: false };
  check('Actual engine outputs match the pinned build manifest', { outputs: pinned.outputs });
  pinnedFixtures = await Promise.all(fixturePaths.map(async relative => {
    const bytes = await readFile(path.join(root, relative));
    const data = JSON.parse(bytes.toString('utf8'));
    assert.equal(data.schema_version, 1);
    if (data.upstream_commit) assert.equal(data.upstream_commit, upstream);
    assert.ok(Array.isArray(data.fixtures) && data.fixtures.length > 0);
    return { relative, sha256: hash(bytes), data };
  }));
  result.fixtures = pinnedFixtures.map(({ relative, sha256, data }) => ({ path: relative, sha256, count: data.fixtures.length, sourceStatus: data.status }));
  const fixtures = pinnedFixtures.flatMap(({ relative, data }) => data.fixtures.map((fixture, index) => {
    const event = fixture.event ?? { schema_version: 1, id: fixture.id, params: fixture.params };
    const expected = fixture.expected ?? { en: fixture.expected_en, ja: fixture.expected_ja };
    assert.equal(event.schema_version, 1);
    assert.equal(typeof event.id, 'string');
    assert.equal(typeof expected.en, 'string');
    assert.equal(typeof expected.ja, 'string');
    return { name: fixture.name ?? relative + ':' + index, event, expected };
  }));
  assert.ok(fixtures.some(fixture => fixture.event.id === 'angband.effect_info.description'));
  assert.ok(fixtures.some(fixture => fixture.event.id === 'angband.effect_info.spell_preview.description'));
  fixtures.push(...noteFixtures());
  const factory = createRequire(import.meta.url)(path.join(build, 'game.js'));
  assert.equal(typeof factory, 'function', 'build/game.js must expose the isolated modularized Node factory');
  engine = await factory({ noInitialRun: true, arguments: [], locateFile: filename => path.join(build, filename),
    print: text => result.runtimeOutput.push(String(text)), printErr: text => result.runtimeOutput.push(String(text)) });
  for (const name of allowed) assert.equal(typeof engine['_' + name], 'function', 'missing compiled export: ' + name);
  assert.equal(typeof engine._malloc, 'function');
  assert.equal(typeof engine._free, 'function');
  check('Existing compiled formatter/read-only exports are available without native parser/gameplay initialization');
  for (const locale of ['en', 'ja']) {
    call('ab_rs_set_locale', [locale === 'en' ? 0 : 1]);
    const before = observable(locale);
    assert.deepEqual(before.save, { length: 0, status: 0 });
    assert.equal(before.presentation.scopes, 0);
    assert.equal(before.presentation.messages, 0);
    assert.equal(before.inputReplay.enabled, 0);
    assert.equal(before.inputReplay.targetPending, 0);
    result.observability[locale] = before;
    for (const fixture of fixtures) positive(fixture, locale, before);
    const unsupported = structuredClone(fixtures.find(fixture => fixture.event.id === 'angband.effect_info.description').event);
    unsupported.params.description.value.schema_version = 0;
    const rejected = formatEvent(unsupported);
    assert.equal(rejected.pointer, 0);
    assert.notEqual(rejected.status, 0);
    assert.ok(rejected.error);
    check('Incomplete owned effect graph is explicitly rejected: ' + locale, { status: rejected.status, error: rejected.error });
    preserved(before, locale, 'rejected effect graph ' + locale);
    positive(fixtures[0], locale, before);
  }
  const before = observable('ja');
  for (const [name, bytes, expectedStatus] of [
    ['invalid allocated UTF8 span', new Uint8Array([255]), 20],
    ['embedded NUL in allocated span', new Uint8Array([...encoder.encode(JSON.stringify(fixtures[0].event)), 0]), 21],
  ]) {
    const rejected = formatBytes(bytes);
    assert.equal(rejected.pointer, 0);
    assert.equal(rejected.status, expectedStatus);
    assert.ok(rejected.error);
    check('Foreign span rejection: ' + name, { status: rejected.status, error: rejected.error });
    preserved(before, 'ja', name);
  }
  positive(fixtures[0], 'ja', before);
  assert.equal(trace.filter(name => name === 'malloc').length, trace.filter(name => name === 'free').length);
  assert.ok(trace.every(name => allowed.has(name) || name === 'malloc' || name === 'free'));
  result.calls = Object.fromEntries([...new Set(trace)].sort().map(name => [name, trace.filter(item => item === name).length]));
  result.journal = { directlyObserved: false, reason: 'No public read-only journal getter exists; no input/journal/save mutation API is invoked', mutationApiCalls: [] };
  result.gameplay = { nativeParserStarted: false, nativeRunStarted: false, inputDispatched: false, rngApiCalls: [] };
  check('Probe foreign allocations are freed and no native gameplay/input/RNG/save/cache mutation API is invoked');
} catch (error) {
  result.errors.push(error.stack || String(error));
  console.error(error);
} finally {
  if (pinned) {
    try {
      const after = await pinEngine();
      assert.deepEqual(after, pinned, 'engine artifacts changed during formatter evidence capture');
      for (const fixture of pinnedFixtures ?? []) assert.equal(hash(await readFile(path.join(root, fixture.relative))), fixture.sha256, 'golden fixture changed during probe');
      result.stable = true;
      result.engineStableDuringRun = true;
      result.engine.stable = true;
      check('Engine artifacts and source golden fixtures remained byte-identical during the probe');
    } catch (error) { result.errors.push(error.stack || String(error)); console.error(error); }
  }
  result.passed = result.errors.length === 0 && result.stable;
  result.finishedAt = new Date().toISOString();
  await mkdir(path.dirname(evidence), { recursive: true });
  await writeFile(evidence, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, stable: result.stable, checks: result.checks.length, evidence }));
  if (!result.passed) process.exitCode = 1;
}
