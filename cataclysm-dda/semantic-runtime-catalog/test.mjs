import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {DIRECTORY, ROOT, INPUTS, SOURCE_COMMIT, loadInputs, buildArtifacts, classify, printfEvidence, serialized, sha256} from './convert.mjs';
import {validId, literalTemplate, tokenize, validateCatalog, renderLiteralEntry} from './model.mjs';

// This suite intentionally uses the real immutable inputs and independently
// inspected source pointers, but only a Node mirror of the Rust formatter.
// The isolated genuine Rust suite is prepared separately and remains pending.
const input = loadInputs();
const artifacts = buildArtifacts(input);
const en = artifacts['en.json'], ja = artifacts['ja.json'];
const converted = artifacts['provenance.json'].entries;
const blocked = artifacts['blockers.json'].records;
const results = [];
function test(name, verify) {
  verify();
  results.push({name, status: 'passed'});
}
function catalog(entry, locale = 'en', id = 'fixture.literal') {
  return {schema_version: 1, locale, entries: {[id]: entry}};
}
function plain(text) { return {parameters: {}, other: text}; }
function fixtureRecord(overrides = {}) { return {pluralVariants: [null], sourceBindings: [], ...overrides}; }
function fixtureText(text, printfParameters = []) { return {text, printfParameters}; }
function codes(record, english, japanese = english) { return classify(record, english, japanese).map(reason => reason.code); }

test('both 315-entry files use the exact strict RawCatalog and RawEntry schema', () => {
  assert.equal(validateCatalog(en), true); assert.equal(validateCatalog(ja), true);
  assert.deepEqual(Object.keys(en), ['schema_version', 'locale', 'entries']);
  assert.deepEqual(Object.keys(ja), ['schema_version', 'locale', 'entries']);
  assert.equal(en.locale, 'en'); assert.equal(ja.locale, 'ja');
  assert.equal(Object.keys(en.entries).length, 315);
  assert.deepEqual(Object.keys(en.entries), Object.keys(ja.entries));
  for (const file of [en, ja]) for (const entry of Object.values(file.entries)) {
    assert.deepEqual(Object.keys(entry), ['parameters', 'other']);
    assert.deepEqual(entry.parameters, {});
  }
});

test('all 630 literal formats preserve exact original UTF-8 text and public identity', () => {
  for (const id of Object.keys(en.entries)) {
    assert.ok(validId(id));
    for (const [runtime, original] of [[en, input.en], [ja, input.ja]]) {
      const rendered = renderLiteralEntry(runtime.entries[id]);
      assert.deepEqual(Buffer.from(rendered), Buffer.from(original.entries[id].text), id);
      assert.ok(tokenize(runtime.entries[id].other).every(token => 'literal' in token));
    }
  }
});

test('converted provenance retains exact source bindings, context and normalized alias mapping', () => {
  const records = new Map(input.reviewed.records.map(record => [record.semanticId, record]));
  for (const binding of converted) {
    const original = records.get(binding.id);
    assert.equal(binding.sourceIndex, original.index);
    assert.equal(binding.context, original.context);
    assert.equal(binding.singular, original.singular);
    assert.deepEqual(binding.sourceBindings, original.sourceBindings);
    assert.deepEqual(binding.sourceCandidateAliases, original.sourceCandidateIds ?? []);
    assert.deepEqual(binding.idMapping, {inputPublicId: binding.id, runtimePublicId: binding.id, unchanged: true});
    assert.equal(binding.enSourceSha256, sha256(input.en.entries[binding.id].text));
    assert.equal(binding.jaSourceSha256, sha256(input.ja.entries[binding.id].text));
    for (const alias of binding.sourceCandidateAliases) if (alias in input.registry.idMap) {
      assert.equal(input.registry.idMap[alias], binding.id);
    }
  }
  assert.deepEqual(input.sourceVerification, {records: 539, jsonPointers: 613, ownerDefinitions: 613, cppReferencesUsingPreviousOfficialExtraction: 14});
});

test('315 prepared and 224 explicitly blocked IDs partition the entire current 539 set', () => {
  assert.equal(converted.length, 315); assert.equal(blocked.length, 224);
  const preparedIds = new Set(converted.map(record => record.id));
  const blockedIds = new Set(blocked.map(record => record.id));
  assert.equal(preparedIds.size, 315); assert.equal(blockedIds.size, 224);
  assert.ok([...blockedIds].every(id => !preparedIds.has(id)));
  assert.deepEqual([...preparedIds, ...blockedIds].sort(), Object.keys(input.en.entries).sort());
  const primary = {}, all = {};
  for (const record of blocked) {
    assert.ok(record.reasons.length > 0);
    assert.equal(record.en, input.en.entries[record.id].text);
    assert.equal(record.ja, input.ja.entries[record.id].text);
    primary[record.reasons[0].code] = (primary[record.reasons[0].code] ?? 0) + 1;
    for (const reason of record.reasons) all[reason.code] = (all[reason.code] ?? 0) + 1;
  }
  assert.deepEqual(primary, artifacts['conversion-summary.json'].blockersPrimaryPartition);
  assert.deepEqual(all, artifacts['conversion-summary.json'].blockersNonExclusive);
  assert.equal(Object.values(primary).reduce((a, b) => a + b, 0), 224);
});

test('every unsafe semantic category has an explicit blocker without guessed parameters', () => {
  const literal = fixtureText('literal');
  assert.deepEqual(codes(fixtureRecord(), literal), []);
  assert.deepEqual(codes(fixtureRecord(), fixtureText('%s', ['s'])), ['printf-parameters-need-named-schema']);
  assert.deepEqual(codes(fixtureRecord({pluralVariants: [null, 'items']}), fixtureText('item')), ['native-plural-consumer-and-selector-required']);
  assert.deepEqual(codes(fixtureRecord({sourceBindings: [{ownerType: 'snippet'}]}), literal), ['snippet-selection-or-expansion-provenance-required']);
  assert.deepEqual(codes(fixtureRecord(), fixtureText('<npcname>')), ['rich-text-or-dynamic-angle-token-unsupported']);
  assert.deepEqual(codes(fixtureRecord(), literal, fixtureText('<color_red>文字</color>')), ['rich-text-or-dynamic-angle-token-unsupported']);
  assert.deepEqual(codes(fixtureRecord({sourceBindings: [{ownerType: 'talk_topic'}]}), fixtureText('*shivers')), ['dialogue-control-prefix-needs-structured-consumer']);
  assert.deepEqual(codes(fixtureRecord(), fixtureText('100%%')), ['printf-literal-percent-escape-consumer-required']);
  assert.deepEqual(codes(fixtureRecord(), fixtureText('nul\0byte')), ['embedded-nul-unsupported-in-this-profile']);
  assert.deepEqual(codes(fixtureRecord({pluralVariants: ['items'], sourceBindings: [{ownerType: 'snippet'}]}), fixtureText('<name> %d', ['d'])), [
    'printf-parameters-need-named-schema', 'native-plural-consumer-and-selector-required',
    'snippet-selection-or-expansion-provenance-required', 'rich-text-or-dynamic-angle-token-unsupported',
  ]);
});

test('independent printf detection cannot be bypassed by clearing both cached signatures', () => {
  const name = 'cdda.core.fault.fault_blade_cracked.description';
  const record = input.reviewed.records.find(entry => entry.semanticId === name);
  const english = {...input.en.entries[name], printfParameters: []};
  const japanese = {...input.ja.entries[name], printfParameters: []};
  assert.ok(codes(record, english, japanese).includes('printf-parameters-need-named-schema'));
  for (const text of ['%s', '%*.*f', '%1$s', '%n']) assert.ok(printfEvidence(text).length > 0, text);
  const helpIds = ['cdda.mod.mind_over_matter.help.awakening.chance_and_latent_trait', 'cdda.mod.mind_over_matter.help.using_powers.failure_factors'];
  for (const id of helpIds) {
    const source = input.reviewed.records.find(entry => entry.semanticId === id);
    assert.deepEqual(codes(source, input.en.entries[id], input.ja.entries[id]), []);
    const changedEnglish = {...input.en.entries[id], text: input.en.entries[id].text + ' %s'};
    assert.ok(codes(source, changedEnglish, input.ja.entries[id]).includes('printf-parameters-need-named-schema'));
  }
});

const braceFixtures = ['', '{', '}', '{}', '{{}}', '{not_parameter}', '{{user}}', '}unbalanced{', '猫{名前}\n  文🌸 }', 'e\u0301% 日本語  '];
test('literal brace escaping roundtrips ten adversarial Unicode and whitespace fixtures', () => {
  for (const source of braceFixtures) {
    const entry = plain(literalTemplate(source));
    validateCatalog(catalog(entry));
    assert.equal(renderLiteralEntry(entry), source);
    assert.ok(tokenize(entry.other).every(token => 'literal' in token));
  }
  assert.equal(literalTemplate('{name}'), '{{name}}');
  assert.equal(literalTemplate('{{name}}'), '{{{{name}}}}');
});

test('TextId and parameter grammars reject final newlines and non-ASCII bytes like Rust', () => {
  for (const id of ['a', 'a.b_2', 'a'.repeat(160)]) assert.ok(validId(id));
  for (const id of ['', 'a'.repeat(161), 'a\n', 'a\r\n', 'a..b', 'a.2', 'a.%s', 'A', 'é', 'a.猫', '_a']) assert.equal(validId(id), false, JSON.stringify(id));
  for (const name of ['count\n', '2', '猫', 'user-name']) {
    assert.throws(() => validateCatalog(catalog({parameters: {[name]: 'user_text'}, other: `{${name}}`})), undefined, JSON.stringify(name));
  }
});

test('modeled tokenizer rejects malformed unescaped placeholders', () => {
  for (const template of ['{', '}', '{user', '{0}', '{user:>2}', '{name\n}', '{{{', '}}}']) assert.throws(() => tokenize(template), undefined, JSON.stringify(template));
  assert.deepEqual(tokenize('{{user}}'), [{literal: '{user}'}]);
  assert.deepEqual(tokenize('a{user}b{user}'), [{literal: 'a'}, {parameter: 'user'}, {literal: 'b'}, {parameter: 'user'}]);
});

test('strict schema rejects unknown fields, wrong types and placeholder/parameter drift', () => {
  for (const mutate of [
    file => { file.extra = 1; }, file => { file.schema_version = 2; }, file => { file.locale = 'fr'; },
    file => { file.entries['fixture.literal'].context = ''; }, file => { file.entries['fixture.literal'].parameters = []; },
    file => { file.entries['fixture.literal'].other = null; }, file => { file.entries['fixture.literal'].one = 3; },
    file => { file.entries['fixture.literal'].parameters = {user: 'unknown'}; },
    file => { file.entries['fixture.literal'].other = '{missing}'; },
    file => { file.entries['fixture.literal'].parameters = {unused: 'user_text'}; },
  ]) {
    const file = catalog(plain('text')); mutate(file); assert.throws(() => validateCatalog(file));
  }
  assert.ok(validateCatalog(catalog({parameters: {user: 'user_text'}, other: '{user} {user}'})));
});

test('modeled Rust String validation rejects lone surrogates and preserves paired supplementary characters', () => {
  for (const text of ['\ud800', '\udfff', 'prefix\ud800suffix']) assert.throws(() => validateCatalog(catalog(plain(text))));
  assert.throws(() => validateCatalog(catalog({parameters: {}, one: '\ud800', other: 'other'})));
  assert.ok(validateCatalog(catalog(plain('🌸\ud83d\ude00猫'))));
});

test('native plural validation permits explicit English Count fixtures and rejects unsupported forms', () => {
  const entry = {parameters: {count: 'count'}, plural_parameter: 'count', one: '{count} item', other: '{count} items'};
  assert.ok(validateCatalog(catalog(entry)));
  assert.ok(validateCatalog(catalog({parameters: {count: 'count'}, other: '{count}個'}, 'ja')));
  for (const invalid of [
    catalog(entry, 'ja'), catalog({...entry, one: null}),
    catalog({...entry, parameters: {count: 'user_text'}}),
    catalog({...entry, plural_parameter: 'missing'}), catalog({...entry, one: 'item'}),
  ]) assert.throws(() => validateCatalog(invalid));
});

test('artifact bytes are deterministic across record order and match all files on disk', () => {
  const repeat = buildArtifacts(input);
  const reversed = buildArtifacts({...input, reviewed: {...input.reviewed, records: [...input.reviewed.records].reverse()}});
  for (const [name, artifact] of Object.entries(artifacts)) {
    assert.equal(serialized(artifact), serialized(repeat[name]), name);
    assert.equal(serialized(artifact), serialized(reversed[name]), name);
    assert.equal(readFileSync(path.join(DIRECTORY, 'output', name), 'utf8'), serialized(artifact), name);
  }
});

test('inputs remain unchanged and consumer/game/runtime completion gates stay false', () => {
  for (const name of INPUTS) assert.equal(sha256(readFileSync(path.join(ROOT, name))), input.hashes[name], name);
  for (const name of ['provenance.json', 'blockers.json', 'conversion-summary.json']) {
    assert.equal(artifacts[name].rustConsumerVerified, false);
    assert.equal(artifacts[name].runtimeConnected, false);
  }
});

const evidenceFiles = ['convert.mjs', 'model.mjs', 'test.mjs', 'rust-verification/Cargo.toml', 'rust-verification/tests/catalog.rs'];
const evidence = {
  schemaVersion: 1, status: 'passed', sourceCommit: SOURCE_COMMIT,
  validationEngine: 'Node standard-library model of inspected Rust source; not an actual Rust consumer',
  nodeVersion: process.version, testsPassed: results.length, tests: results,
  preparedRuntimeEntries: 315, explicitlyBlockedEntries: 224, exactLiteralFormatsChecked: 630,
  braceFixtureFormatsChecked: braceFixtures.length, sourceVerification: input.sourceVerification,
  inputSha256: input.hashes,
  converterAndPreparedTestsSha256: Object.fromEntries(evidenceFiles.map(name => [name, sha256(readFileSync(path.join(DIRECTORY, name)))])),
  artifactSha256: Object.fromEntries(Object.keys(artifacts).map(name => [name, sha256(readFileSync(path.join(DIRECTORY, 'output', name)))])),
  rustConsumerVerified: false, runtimeConnected: false, wholeGameSemanticMigrationComplete: false,
  genuineRustTests: {status: 'prepared-not-executed', manifest: 'semantic-runtime-catalog/rust-verification/Cargo.toml', reason: 'Parent has reserved the heavy engine build slot; cargo requires a subsequent build window'},
};
writeFileSync(path.join(DIRECTORY, 'output', 'node-verification.json'), serialized(evidence), 'utf8');
const rustSource = readFileSync(path.join(DIRECTORY, 'rust-verification/tests/catalog.rs'), 'utf8');
const rustEvidence = {
  schemaVersion: 1, status: 'prepared-not-executed', sourceCommit: SOURCE_COMMIT,
  actualRustConsumerCompiled: false, actualRustConsumerTestsPassed: null, runtimeConnected: false,
  reason: evidence.genuineRustTests.reason,
  manifest: evidence.genuineRustTests.manifest,
  consumerApis: ['cdda_presentation::Catalog::from_json', 'cdda_presentation::Catalog::format', 'cdda_logic_contract::TextId::new', 'cdda_logic_contract::TextEvent::plain'],
  preparedTests: [...rustSource.matchAll(/#\[test\]\s+fn\s+(\w+)/g)].map(match => match[1]),
  inputSha256: input.hashes,
  catalogSha256: {en: evidence.artifactSha256['en.json'], ja: evidence.artifactSha256['ja.json']},
  preparedFilesSha256: Object.fromEntries(Object.entries(evidence.converterAndPreparedTestsSha256).filter(([name]) => name.startsWith('rust-verification/'))),
  futureCommandAfterGrantedWindow: 'cargo test --offline --jobs 1 --manifest-path semantic-runtime-catalog/rust-verification/Cargo.toml --target-dir semantic-runtime-catalog/rust-verification/target',
  fallbackPolicy: 'The existing Rust Catalog has no implicit cross-locale fallback; tests require MissingId for absent/blocked identities in both locales and Locale::default() == Ja',
};
assert.equal(rustEvidence.preparedTests.length, 7);
writeFileSync(path.join(DIRECTORY, 'output', 'rust-verification-status.json'), serialized(rustEvidence), 'utf8');
console.log(JSON.stringify({status: evidence.status, testsPassed: results.length, prepared: 315, blocked: 224, rustConsumerVerified: false}));
