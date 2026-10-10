#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Policy/loader fixtures only. No Lua, original engine, RNG, WASM or browser.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { parseUniqueJson, validateDelta, mergeReviewedDelta, applyExactRouteGuard } from './merge-delta.mjs';
import { streamMergeJson } from './stream-merge.mjs';

const directory = import.meta.dirname, output = path.join(directory, 'candidate');
let assertions = 0;
const equal = (left, right, message) => { assertions++; assert.deepEqual(left, right, message); };
const truth = (condition, message) => { assertions++; assert.ok(condition, message); };
const rejects = (fn, message) => { assertions++; assert.throws(fn, undefined, message); };
const json = name => parseUniqueJson(fs.readFileSync(path.join(output, name), 'utf8'));
const delta = json('semantic-route-delta.json'), manifest = json('source-manifest.json');
truth(validateDelta(delta));
equal(Object.keys(json('en.json')).sort(), Object.keys(json('ja.json')).sort());
equal(json('ja.json'), json('ja-supplement.json'));
for (const artifact of manifest.artifacts) {
  const bytes = fs.readFileSync(path.join(output, artifact.file));
  equal(bytes.length, artifact.bytes);
  equal(crypto.createHash('sha256').update(bytes).digest('hex'), artifact.sha256);
}
for (const overlay of manifest.overlays) {
  const bytes = fs.readFileSync(path.join(output, overlay.derived.file));
  equal(bytes.length, overlay.derived.bytes);
  equal(crypto.createHash('sha256').update(bytes).digest('hex'), overlay.derived.sha256);
  const source = bytes.toString('utf8');
  equal(crypto.createHash('sha256').update(source.replace(overlay.splice.after, overlay.splice.before)).digest('hex'), overlay.original.sha256, 'Byte-exact overlay reversal');
  truth(source.startsWith('-- TE4 - T-Engine 4\n-- Copyright (C) 2009 - 2019 Nicolas Casalini\n'), 'Original license header retained');
}

const commit = delta.source_commit;
const baseEntry = { owner: 'fixture.base', tag: 'talent name', japanese_args_order: [], special_tokens: [], printf_contract: { safe: true }, source_locations: [] };
const base = { english: { 'fixture.base.name': 'Berserker' }, japanese: { 'fixture.base.name': '狂戦士' },
  registry: { schema_version: 1, source_commit: commit, default_locale: 'ja_JP', entries: { 'fixture.base.name': baseEntry },
    routes: [{ source: 'Berserker', tag: 'talent name', default_id: 'fixture.base.name', aliases: ['fixture.base.name'], format_ambiguity: false }],
    japanese_configuration: [{ fixture: 'keep original font/CJK/randart config' }], untouched_metadata: { value: 7 } },
  supplements: { 'fixture.old.supplement': '以前の補完' } };
const before = JSON.stringify(base), merged = mergeReviewedDelta(base, delta);
equal(JSON.stringify(base), before, 'Loader does not mutate the base');
equal(Object.keys(merged.english).length, 21);
equal(Object.keys(merged.japanese).length, 21);
equal(merged.registry.routes.length, 21);
equal(merged.registry.entries['fixture.base.name'], baseEntry);
equal(merged.registry.japanese_configuration, base.registry.japanese_configuration);
equal(merged.registry.untouched_metadata, base.registry.untouched_metadata);
equal(merged.supplements['fixture.old.supplement'], '以前の補完');
for (const id of Object.keys(delta.english)) {
  equal(merged.english[id], delta.english[id]);
  equal(merged.japanese[id], null, 'Official-missing status remains accurate');
  equal(merged.supplements[id], delta.japanese_supplement[id]);
}
rejects(() => mergeReviewedDelta({ ...base, english: { ...base.english, [Object.keys(delta.english)[0]]: 'collision' } }, delta));
rejects(() => mergeReviewedDelta({ ...base, registry: { ...base.registry, routes: [...base.registry.routes, { source: 'Heat', tag: 'entity name' }] } }, delta));
rejects(() => mergeReviewedDelta({ ...base, registry: { ...base.registry, source_commit: 'future' } }, delta));
const changed = structuredClone(delta); changed.japanese_base[Object.keys(changed.english)[0]] = 'pretend official';
rejects(() => validateDelta(changed));
const missing = structuredClone(delta); delete missing.japanese_supplement[Object.keys(missing.english)[0]];
rejects(() => validateDelta(missing));
const placeholder = structuredClone(delta); placeholder.japanese_supplement[Object.keys(placeholder.english)[0]] = '%s';
rejects(() => validateDelta(placeholder));
const duplicate = structuredClone(delta); duplicate.registry.routes[1] = structuredClone(duplicate.registry.routes[0]);
rejects(() => validateDelta(duplicate));

equal(JSON.stringify(parseUniqueJson('{"null":null,"escape":"a\\\"b","nest":[{},true,false,-1.25e+2]}').nest), JSON.stringify([{}, true, false, -125]));
equal(parseUniqueJson('{"__proto__":{"safe":true}}').__proto__.safe, true);
truth(Object.getPrototypeOf(parseUniqueJson('{"__proto__":1}')) === null);
for (const text of ['{"a":1,"a":2}', '{"x":{"a":1,"a":2}}', '{"a":1,"\\u0061":2}', '{"a":1,}', '[1,]', '01', 'true trailing', '\u00a0null']) rejects(() => parseUniqueJson(text));

let calls = 0;
const fixture = { resolve(source, tag, file, line, locale) { calls++; return { ok: true, result: { source, tag, file, line, locale } }; } };
const originalResolve = fixture.resolve;
for (const variant of ['original', 'overlay']) {
  const guard = applyExactRouteGuard(fixture, delta.route_index, { variant });
  for (const row of delta.route_index.routes) {
    const location = row[variant + '_consumer'];
    const virtual = location.file.replace(/^game\/engines\/default\//, '');
    truth(fixture.resolve(row.source, row.tag, '@/' + virtual, location.line, 'ja_JP').ok, 'Exact virtual native context accepted');
    truth(fixture.resolve(row.source, row.tag, 'C:\\original\\' + location.file.replaceAll('/', '\\'), location.line, 'en_US').ok, 'Exact original physical context accepted');
    const count = calls;
    for (const args of [
      [row.source, 'entity name', '@/' + virtual, location.line, 'ja_JP'],
      [row.source, row.tag, '@/mod/class/Player.lua', location.line, 'ja_JP'],
      [row.source, row.tag, '@/' + virtual, location.line + 1, 'ja_JP'],
      [row.source, row.tag, '@' + path.basename(location.file), location.line, 'ja_JP'],
      [row.source, row.tag, null, location.line, 'ja_JP'],
      [row.source, row.tag, '@/' + virtual, null, 'ja_JP'],
    ]) equal(fixture.resolve(...args), { ok: false, reason: 'unknown_source_tag' }, 'Guard mismatch delegates to original native text');
    equal(calls, count, 'Rejected contexts do not enter the resolver');
  }
  const externalName = 'wolf';
  equal(fixture.resolve(externalName, 'entity name', '@/mod/class/Actor.lua', 2005, 'ja_JP').result.source, externalName);
  for (const value of ['夢', '再生', ...json('unfinished-placeholder-policy.json').labels.map(row => row.source)]) {
    equal(fixture.resolve(value, 'talent name', '@/engine/interface/ActorTalents.lua', 88, 'ja_JP').result.source, value, 'Japanese reentry/opaque values not intercepted');
  }
  guard.uninstall(); equal(fixture.resolve, originalResolve, 'Reversible guard ownership');
}
rejects(() => applyExactRouteGuard(fixture, delta.route_index, { variant: 'all' }));
const protect = applyExactRouteGuard(fixture, delta.route_index); fixture.resolve = function() {};
rejects(() => protect.uninstall(), 'Do not silently overwrite another owner');
fixture.resolve = originalResolve;
equal(json('unfinished-placeholder-policy.json').remaining_japanese_label_semantics_unresolved, 4);
equal(json('already-japanese-policy.json').new_translations_added, 0);
async function streamed(source, insertions, chunkBytes = 19, expectedHash) {
  const bytes = Buffer.from(source, 'utf8'), chunks = [];
  for (let at = 0; at < bytes.length; at += chunkBytes) chunks.push(bytes.subarray(at, at + chunkBytes));
  const produced = [];
  const result = await streamMergeJson(Readable.from(chunks), async chunk => { produced.push(chunk); }, insertions,
    expectedHash ?? crypto.createHash('sha256').update(bytes).digest('hex'));
  const output = Buffer.concat(produced);
  equal(result.source_bytes, bytes.length);
  equal(result.output_bytes, output.length);
  equal(result.output_sha256, crypto.createHash('sha256').update(output).digest('hex'));
  return parseUniqueJson(output.toString('utf8'));
}
for (const chunkBytes of [1, 7, 19, 65536]) {
  const source = '{"base":"狂戦士","braces":"a \\\" { [ ] }", "entries":{"base":{"text":"inside { routes"}}, "routes":[{"source":"base"}], "config":{"locale":"ja_JP"}}\n';
  const parsed = parseUniqueJson(source);
  const combined = await streamed(source, { entries: delta.registry.entries, routes: delta.registry.routes }, chunkBytes);
  equal(combined.base, parsed.base); equal(combined.braces, parsed.braces); equal(combined.config, parsed.config);
  equal(Object.keys(combined.entries).length, 21); equal(combined.entries.base, parsed.entries.base); equal(combined.routes[0], parsed.routes[0]);
  equal(combined.routes.length, 21);
  equal(await streamed('{ }', { root: { label: '日本語' } }, chunkBytes), parseUniqueJson('{"label":"日本語"}'));
  equal(await streamed('{"entries":{},"routes":[]}', { entries: {}, routes: [] }, chunkBytes), parseUniqueJson('{"entries":{},"routes":[]}'));
}
// Actual base keys reach 2,152 characters. Preserve them byte-for-byte across
// streaming chunk boundaries, and retain a finite 4,096-character JSON-key bound.
const longKey = 'source.narrative.' + 'x'.repeat(2152 - 'source.narrative.'.length);
const longSource = JSON.stringify({ [longKey]: 'existing narrative', short: 'keep' });
for (const chunkBytes of [1, 7, 19, 65536]) {
  equal(await streamed(longSource, { root: { added: 'new route' } }, chunkBytes),
    parseUniqueJson(JSON.stringify({ [longKey]: 'existing narrative', short: 'keep', added: 'new route' })));
}
assertions++; await assert.rejects(() => streamed(JSON.stringify({ ['x'.repeat(4095)]: 'oversized' }),
  { root: { added: 1 } }, 7), /oversized root JSON key/);
assertions++; await assert.rejects(() => streamed('{}', { root: { x: 1 } }, 7, '0'.repeat(64)), /SHA mismatch/);
assertions++; await assert.rejects(() => streamed('{"entries":{}}', { entries: {}, routes: [] }), /insertion containers/);
assertions++; await assert.rejects(() => streamed('{"entries":[],"routes":[]}', { entries: {}, routes: [] }), /insertion container/);
const result = { passed: true, assertions, test_kind: 'source_integrity_and_loader_guard_fixtures',
  source_commit: commit, source_manifest_sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(output, 'source-manifest.json'))).digest('hex'),
  gameplay_or_rng_executed: false, actual_native_or_browser_runtime_verified: false, build_executed: false,
  final_memory: process.memoryUsage() };
fs.writeFileSync(path.join(directory, 'source-test-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
