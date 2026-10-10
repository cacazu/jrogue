// Lightweight source/model checks only. This never calls prepare or runs Rust.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { literalTemplate, tokenize, validId, validateCatalog } from '../semantic-runtime-catalog/model.mjs';
import { OWN, ROOT, INPUTS, pins, read, sha, singleNamedTerm } from './prepare.mjs';
import { CONVERTED, WITNESSES, SOURCE_COMMIT, UPSTREAM } from './bindings.mjs';

const IDS = [
  'cdda.character_creation.profession.requirement_completed',
  'cdda.character_creation.scenario.requirement_completed',
  'cdda.core.fault.fault_blade_cracked.description',
];
const LEAVES = [
  'cdda.core.achievement.achievement_reach_balthazar.name',
  'cdda.core.item.roller_blades.name',
];
const artifactNames = ['en.json', 'ja.json', 'term-fixtures.en.json', 'term-fixtures.ja.json',
  'source-inventory.json', 'remaining-blockers.json', 'summary.json'];
const artifactBytes = Object.fromEntries(artifactNames.map(name =>
  [name, fs.readFileSync(path.join(OWN, 'output', name))]));
const artifacts = Object.fromEntries(Object.entries(artifactBytes).map(([name, bytes]) =>
  [name, JSON.parse(bytes.toString('utf8'))]));
const inventory = artifacts['source-inventory.json'];
const summary = artifacts['summary.json'];
const frozenBefore = pins();
const sourcesBefore = Object.fromEntries(Object.keys(inventory.sourcePins).map(file =>
  [file, fs.readFileSync(path.join(UPSTREAM, file))]));
const catalogs = Object.fromEntries(['en', 'ja'].map(locale => [locale, {
  messages: artifacts[locale + '.json'],
  leaves: artifacts['term-fixtures.' + locale + '.json'],
}]));
const tests = [];
let exactFormats = 0;
let rustPreparation = { status: 'source-files-not-yet-complete', tests: [], consumerExecuted: false };

function test(name, action) {
  action();
  tests.push({ name, status: 'passed' });
}
function merged(locale) {
  const { messages, leaves } = catalogs[locale];
  assert.ok(Object.keys(leaves.entries).every(id => !Object.hasOwn(messages.entries, id)));
  return { schema_version: 1, locale, entries: { ...messages.entries, ...leaves.entries } };
}
function termEvent(message, leaf) {
  assert.ok(Object.hasOwn(CONVERTED, message), 'unsupported source message');
  assert.ok(validId(leaf), 'invalid leaf TextId');
  return { id: message, parameters: {
    [CONVERTED[message].parameter]: { type: 'term', value: { id: leaf, count: 1 } },
  } };
}
function u64(value) {
  assert.ok((typeof value === 'number' && Number.isSafeInteger(value)) || typeof value === 'bigint',
    'the Node model refuses imprecise Count values');
  const integer = BigInt(value);
  assert.ok(integer >= 0n && integer <= 18446744073709551615n, 'invalid u64');
  return integer;
}
function plainLeaf(catalog, id, count) {
  assert.ok(validId(id) && Object.hasOwn(catalog.entries, id), 'unknown term TextId');
  const entry = catalog.entries[id];
  assert.deepEqual(entry.parameters, {}, 'a Term must be a zero-parameter leaf');
  const integer = u64(count);
  const selected = catalog.locale === 'en' && integer === 1n ? entry.one ?? entry.other : entry.other;
  return tokenize(selected).map(token => {
    assert.ok(Object.hasOwn(token, 'literal'), 'recursive parameterized Term');
    return token.literal;
  }).join('');
}
function modeledFormat(catalog, event) {
  // Explicit JS model of the inspected Catalog API, never a Rust test result.
  validateCatalog(catalog);
  assert.ok(validId(event.id) && Object.hasOwn(catalog.entries, event.id), 'unknown message TextId');
  const entry = catalog.entries[event.id];
  assert.deepEqual(Object.keys(event.parameters).sort(), Object.keys(entry.parameters).sort(),
    'missing or extra event parameter');
  for (const [name, kind] of Object.entries(entry.parameters)) {
    assert.equal(event.parameters[name].type, kind, 'wrong ParameterKind');
  }
  const plural = entry.plural_parameter ? u64(event.parameters[entry.plural_parameter].value) : null;
  const selected = catalog.locale === 'en' && plural === 1n ? entry.one ?? entry.other : entry.other;
  return tokenize(selected).map(token => {
    if (Object.hasOwn(token, 'literal')) return token.literal;
    const argument = event.parameters[token.parameter];
    if (argument.type === 'term') return plainLeaf(catalog, argument.value.id, argument.value.count);
    if (argument.type === 'user_text') {
      assert.equal(typeof argument.value, 'string');
      return argument.value;
    }
    assert.equal(argument.type, 'count', 'unknown ParameterKind');
    return u64(argument.value).toString();
  }).join('');
}
function singlePrintf(template, value) {
  // The original reviewed format has exactly one unadorned/positional string slot.
  const slots = [...template.matchAll(/%(?:1\$)?s/g)];
  assert.equal(slots.length, 1);
  const slot = slots[0];
  const prefix = template.slice(0, slot.index);
  const suffix = template.slice(slot.index + slot[0].length);
  assert.ok(!(prefix + suffix).includes('%'), 'outside the reviewed single-slot profile');
  return prefix + value + suffix;
}

test('exact three existing IDs are disjoint from nine retained exclusions in the twelve-record audit', () => {
  assert.deepEqual(Object.keys(CONVERTED).sort(), [...IDS].sort());
  assert.deepEqual(Object.keys(catalogs.en.messages.entries).sort(), [...IDS].sort());
  assert.deepEqual(Object.keys(catalogs.ja.messages.entries).sort(), [...IDS].sort());
  const original = read('semantic-runtime-catalog/output/blockers.json');
  const selected = original.records.filter(record =>
    record.reasons.some(reason => reason.code === 'printf-parameters-need-named-schema'));
  assert.equal(selected.length, 12);
  assert.equal(inventory.records.length, 12);
  assert.equal(new Set(inventory.records.map(record => record.id)).size, 12);
  assert.deepEqual(inventory.records.map(record => record.id).sort(), selected.map(record => record.id).sort());
  const converted = inventory.records.filter(record => record.catalogPrepared);
  const blocked = inventory.records.filter(record => !record.catalogPrepared);
  assert.deepEqual(converted.map(record => record.id).sort(), [...IDS].sort());
  assert.equal(blocked.length, 9);
  assert.deepEqual(artifacts['remaining-blockers.json'].records, blocked);
  for (const locale of ['en', 'ja']) {
    const source = read('ja-current/' + locale + '.json');
    for (const record of inventory.records) {
      assert.equal(record[locale], source.entries[record.id].text);
      assert.equal(record.publicIdUnchanged, true);
      assert.equal(record.producerConnected, false);
    }
  }
});

test('both languages and the two leaf fixtures use the existing strict Catalog schema', () => {
  for (const locale of ['en', 'ja']) {
    const { messages, leaves } = catalogs[locale];
    validateCatalog(messages);
    validateCatalog(leaves);
    validateCatalog(merged(locale));
    assert.deepEqual(Object.keys(leaves.entries).sort(), [...LEAVES].sort());
    for (const id of IDS) {
      const parameter = CONVERTED[id].parameter;
      const entry = messages.entries[id];
      assert.deepEqual(Object.keys(entry).sort(), ['other', 'parameters']);
      assert.deepEqual(entry.parameters, { [parameter]: 'term' });
      assert.deepEqual(tokenize(entry.other).filter(token => 'parameter' in token),
        [{ parameter }]);
      assert.equal(entry.other, singleNamedTerm(inventory.records.find(record => record.id === id)[locale], parameter));
      assert.deepEqual(catalogs.en.messages.entries[id].parameters, catalogs.ja.messages.entries[id].parameters);
    }
  }
});

test('source event model binds exactly one existing typed Term at constant count one', () => {
  for (const id of IDS) {
    assert.equal(CONVERTED[id].kind, 'term');
    assert.equal(CONVERTED[id].count, 1);
    const event = termEvent(id, id === IDS[2] ? LEAVES[1] : LEAVES[0]);
    assert.deepEqual(Object.keys(event.parameters), [CONVERTED[id].parameter]);
    assert.deepEqual(event.parameters[CONVERTED[id].parameter],
      { type: 'term', value: { id: id === IDS[2] ? LEAVES[1] : LEAVES[0], count: 1 } });
  }
  assert.throws(() => termEvent('fixture.unsupported_message', LEAVES[0]));
  assert.throws(() => termEvent(IDS[0], 'English name'));
});

test('all six modeled formats equal original single printf slots including quotes and exact newline difference', () => {
  for (const locale of ['en', 'ja']) {
    const catalog = merged(locale);
    for (const id of IDS) {
      const record = inventory.records.find(record => record.id === id);
      const leaf = id === IDS[2] ? LEAVES[1] : LEAVES[0];
      const value = plainLeaf(catalog, leaf, 1);
      assert.equal(modeledFormat(catalog, termEvent(id, leaf)), singlePrintf(record[locale], value));
      exactFormats++;
    }
    const profession = modeledFormat(catalog, termEvent(IDS[0], LEAVES[0]));
    const scenario = modeledFormat(catalog, termEvent(IDS[1], LEAVES[0]));
    assert.equal(profession, scenario + '\n');
    assert.ok(!scenario.endsWith('\n'));
  }
  assert.equal(modeledFormat(merged('en'), termEvent(IDS[0], LEAVES[0])), 'Completed "Bunker Robot(s)"\n');
  assert.equal(modeledFormat(merged('en'), termEvent(IDS[1], LEAVES[0])), 'Completed "Bunker Robot(s)"');
});

test('JS model rejects unknown message or leaf and wrong missing extra or unrepresentable typed parameters', () => {
  for (const locale of ['en', 'ja']) {
    const catalog = merged(locale);
    const original = termEvent(IDS[1], LEAVES[0]);
    for (const value of [
      { type: 'user_text', value: 'external username %s {achievement_name}' },
      { type: 'count', value: 1 },
      { type: 'unknown', value: 'uninvented kind' },
    ]) {
      const event = structuredClone(original);
      event.parameters.achievement_name = value;
      assert.throws(() => modeledFormat(catalog, event));
    }
    const missing = structuredClone(original);
    missing.parameters = {};
    assert.throws(() => modeledFormat(catalog, missing));
    const extra = structuredClone(original);
    extra.parameters.extra = { type: 'count', value: 1 };
    assert.throws(() => modeledFormat(catalog, extra));
    assert.throws(() => modeledFormat(catalog, { id: 'fixture.absent', parameters: {} }));
    assert.throws(() => modeledFormat(catalog, termEvent(IDS[1], 'fixture.absent')));
    for (const count of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1, 18446744073709551616n]) {
      const bad = structuredClone(original);
      bad.parameters.achievement_name.value.count = count;
      assert.throws(() => modeledFormat(catalog, bad));
    }
  }
});

test('parameterized recursive Terms and all nine excluded messages remain unavailable in the JS model', () => {
  for (const locale of ['en', 'ja']) {
    const catalog = merged(locale);
    assert.throws(() => modeledFormat(catalog, termEvent(IDS[0], IDS[1])));
    for (const record of artifacts['remaining-blockers.json'].records) {
      assert.ok(!Object.hasOwn(catalog.entries, record.id));
      assert.throws(() => modeledFormat(catalog, { id: record.id, parameters: {} }));
    }
  }
});

test('single-slot conversion escapes literal braces and resolved leaf text is never recursively substituted', () => {
  const raw = 'A {literal} "%1$s"\n';
  assert.equal(singleNamedTerm(raw, 'leaf'), 'A {{literal}} "{leaf}"\n');
  for (const invalid of ['literal only', '%s %s', '%2$s', '%s %%', '%d']) {
    assert.throws(() => singleNamedTerm(invalid, 'leaf'));
  }
  const value = 'literal {leaf} %s "quoted"\n';
  const fixture = { schema_version: 1, locale: 'en', entries: {
    'fixture.message': { parameters: { leaf: 'term' }, other: singleNamedTerm(raw, 'leaf') },
    'fixture.leaf': { parameters: {}, other: literalTemplate(value) },
  } };
  const event = { id: 'fixture.message', parameters: { leaf: { type: 'term', value: { id: 'fixture.leaf', count: 1 } } } };
  assert.equal(modeledFormat(fixture, event), singlePrintf(raw, value));
});

test('actual source hashes and recorded witness fragments are conserved without invoking producers', () => {
  assert.equal(inventory.sourceCommit, SOURCE_COMMIT);
  assert.deepEqual(inventory.inputHashes, frozenBefore);
  assert.deepEqual(Object.keys(inventory.inputHashes).sort(), [...INPUTS].sort());
  assert.deepEqual(inventory.inspectedSourceWitnesses, WITNESSES);
  for (const [file, pin] of Object.entries(inventory.sourcePins)) {
    const bytes = sourcesBefore[file];
    assert.equal(bytes.length, pin.bytes, file);
    assert.equal(sha(bytes), pin.sha256, file);
    for (const fragment of WITNESSES[file] ?? []) assert.ok(bytes.toString('utf8').includes(fragment), file);
  }
});

test('synthetic leaf and source-only flags do not attest requirement applicability or live definition ownership', () => {
  assert.equal(summary.printfExclusionsAudited, 12);
  assert.equal(summary.messageTemplatesPrepared, 3);
  assert.equal(summary.remainingExcludedMessageTemplates, 9);
  assert.equal(summary.syntheticSourceLeafFixtures, 2);
  assert.equal(summary.newParameterKinds, 0);
  assert.equal(summary.unchangedPublicIds, true);
  assert.equal(summary.sourceOnly, true);
  for (const flag of ['originalProducerConnected', 'runtimeConnected', 'browserExecuted', 'completeTranslationCoverage']) {
    assert.equal(summary[flag], false);
  }
  assert.equal(inventory.runtimeConnected, false);
  assert.equal(inventory.rustConsumerExecuted, false);
  assert.deepEqual(inventory.fixtureBindings.map(record => record.id).sort(), [...LEAVES].sort());
  for (const fixture of inventory.fixtureBindings) {
    assert.equal(fixture.syntheticParameterChoice, true);
    assert.equal(fixture.actualRequirementOrFaultApplicabilityClaimed, false);
  }
});

test('genuine seven-test Catalog source preparation uses existing Rust types and exact relative fixture files when complete', () => {
  const directory = path.join(OWN, 'rust-verification');
  const manifestFile = path.join(directory, 'Cargo.toml');
  const libFile = path.join(directory, 'src/lib.rs');
  const testFile = path.join(directory, 'src/tests.rs');
  if (![manifestFile, libFile, testFile].every(file => fs.existsSync(file))) return;
  const manifest = fs.readFileSync(manifestFile, 'utf8');
  const lib = fs.readFileSync(libFile, 'utf8');
  const source = fs.readFileSync(testFile, 'utf8');
  const names = [...source.matchAll(/#\[test\]\s*fn\s+([a-z_]+)\s*\(/g)].map(match => match[1]);
  assert.equal(names.length, 7);
  assert.equal(new Set(names).size, 7);
  assert.ok(manifest.includes('[workspace]'));
  for (const dependency of ['logic', 'presentation']) {
    const relative = '../../rust-contracts/' + dependency;
    assert.ok(manifest.includes('path = "' + relative + '"'));
    assert.ok(fs.existsSync(path.resolve(directory, relative, 'Cargo.toml')));
  }
  assert.ok(source.includes('Catalog::from_json('));
  assert.ok(source.includes('catalog.format('));
  assert.match(lib, /ParameterValue::Term\s*\{\s*id:\s*observed_leaf,\s*count:\s*1\s*,?\s*\}/);
  assert.ok(lib.includes('does not attest native owner/lifecycle identity'));
  const included = [...source.matchAll(/include_str!\("([^"]+)"\)/g)].map(match => match[1]);
  assert.deepEqual([...new Set(included)].sort(), [
    '../../output/en.json', '../../output/ja.json',
    '../../output/term-fixtures.en.json', '../../output/term-fixtures.ja.json',
  ].sort());
  for (const relative of included) {
    const file = path.resolve(path.dirname(testFile), relative);
    assert.ok(file.startsWith(path.join(OWN, 'output') + path.sep));
    validateCatalog(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  rustPreparation = { status: 'seven-genuine-Catalog-tests-prepared-not-executed', tests: names,
    consumerExecuted: false, nativeOwnerAttested: false,
    sourceSha256: { manifest: sha(fs.readFileSync(manifestFile)), lib: sha(fs.readFileSync(libFile)),
      tests: sha(fs.readFileSync(testFile)) } };
});

test('repeated modeled formatting preserves owned events and all frozen artifacts and pristine sources', () => {
  const event = termEvent(IDS[1], LEAVES[0]);
  const before = structuredClone(event);
  const catalog = merged('ja');
  const formatted = modeledFormat(catalog, event);
  for (let index = 0; index < 32; index++) {
    assert.equal(modeledFormat(catalog, event), formatted);
    assert.deepEqual(event, before);
  }
  assert.deepEqual(pins(), frozenBefore);
  for (const [file, bytes] of Object.entries(sourcesBefore)) {
    assert.ok(fs.readFileSync(path.join(UPSTREAM, file)).equals(bytes), file);
  }
  for (const [name, bytes] of Object.entries(artifactBytes)) {
    assert.ok(fs.readFileSync(path.join(OWN, 'output', name)).equals(bytes), name);
  }
});

const result = {
  schemaVersion: 1, status: 'passed', sourceCommit: SOURCE_COMMIT, nodeVersion: process.version,
  engine: 'Node standard-library schema/source checks and explicit JS formatter model; no genuine Rust or native producer execution',
  testsPassed: tests.length, tests, modeledExactFormatsChecked: exactFormats,
  preparedMessageIds: IDS, auditedPrintfRecords: 12, remainingExcludedRecords: 9,
  syntheticLeafFixtureIds: LEAVES, rustPreparation, frozenInputSha256Unchanged: frozenBefore,
  artifactSha256Unchanged: Object.fromEntries(Object.entries(artifactBytes).map(([name, bytes]) => [name, sha(bytes)])),
  originalProducerConnected: false, rustConsumerExecuted: false, runtimeConnected: false,
  browserExecuted: false, nativeOwnerAttested: false, completeTranslationCoverage: false,
};
fs.writeFileSync(path.join(OWN, 'output/node-verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, testsPassed: tests.length,
  modeledExactFormatsChecked: exactFormats, rustPreparation: rustPreparation.status,
  rustConsumerExecuted: false, runtimeConnected: false }));
