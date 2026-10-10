import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {prepare, DIRECTORY, ROOT, INPUT_FILES} from './prepare.mjs';
import {sha256, serialized, SOURCE_COMMIT} from '../semantic-runtime-catalog/convert.mjs';
import {validateCatalog, literalTemplate} from '../semantic-runtime-catalog/model.mjs';
import {DISPATCH_ID, INT_MIN, INT_MAX, translatedIntSelector, quantitySelector, statisticSelector, termEvent, modeledTermFormat} from './selector.mjs';

const unchangedLiteralFiles = ['en.json', 'ja.json', 'provenance.json', 'blockers.json', 'conversion-summary.json', 'node-verification.json', 'rust-verification-status.json'];
const literalPackageBefore = Object.fromEntries(unchangedLiteralFiles.map(name => [name, sha256(readFileSync(path.join(ROOT, 'semantic-runtime-catalog/output', name)))]));
const artifacts = prepare();
const en = artifacts['en.json'], ja = artifacts['ja.json'];
const inventory = artifacts['consumer-inventory.json'], summary = artifacts['summary.json'];
const originalEn = JSON.parse(readFileSync(path.join(ROOT, 'ja-current/en.json'), 'utf8'));
const originalJa = JSON.parse(readFileSync(path.join(ROOT, 'ja-current/ja.json'), 'utf8'));
const registry = JSON.parse(readFileSync(path.join(ROOT, 'ja-current/semantic-id-registry.json'), 'utf8'));
const tests = [];
function test(name, action) { action(); tests.push({name, status: 'passed'}); }
let exactFormats = 0;
function checkForm(record, category) {
  const event = termEvent(record.id, category);
  assert.equal(modeledTermFormat(en, event), category === 'one' ? record.en : record.sourcePluralVariants[0]);
  assert.equal(modeledTermFormat(ja, event), record.ja);
  exactFormats += 2;
}

test('156 entries use actual strict schema and retain all 155 public IDs', () => {
  assert.ok(validateCatalog(en)); assert.ok(validateCatalog(ja));
  assert.equal(Object.keys(en.entries).length, 156);
  assert.deepEqual(Object.keys(en.entries), Object.keys(ja.entries));
  for (const record of inventory.records) {
    assert.equal(originalEn.entries[record.id].text, record.en);
    assert.equal(originalJa.entries[record.id].text, record.ja);
    assert.deepEqual(en.entries[record.id].parameters, {});
    assert.equal(en.entries[record.id].one, literalTemplate(record.en));
    assert.equal(en.entries[record.id].other, literalTemplate(record.sourcePluralVariants[0]));
    assert.ok(!('plural_parameter' in en.entries[record.id]));
    assert.deepEqual(Object.keys(ja.entries[record.id]), ['parameters', 'other']);
  }
});

test('every term preserves exact English one/other and count-invariant Japanese', () => {
  for (const record of inventory.records) { checkForm(record, 'one'); checkForm(record, 'other'); }
});

test('155 leaves match 200 actual JSON pointers and verified native Japanese MO entries', () => {
  assert.equal(summary.exactJSONPointersChecked, 200);
  assert.equal(summary.actualJapaneseMOMatches, 155);
  assert.deepEqual(summary.ownerCounts, {item: 149, monster: 3, event_statistic: 3});
  assert.deepEqual(summary.producerBindingCounts, {'itype-base-name': 135, 'item-variant-name': 59, 'mtype-name': 3, 'statistic-description': 3});
  assert.deepEqual(summary.nativePluralDefinitionMethodsPerPointer, {'native-raw-plus-s': 34, 'native-str_sp-invariant': 159, 'native-explicit-str_pl': 7});
  assert.ok(inventory.japaneseNativeMO.header.includes('Plural-Forms: nplurals=1; plural=0;'));
  assert.equal(inventory.japaneseNativeMO.sha256, '336dc66ccd4d1e828832a38756cddcc165e0f1af917f546752b5655ff02705e7');
  assert.ok(inventory.records.every(record => record.japaneseMO.exactTranslationAndPluralVerified));
});

test('irregular and awkward native plurals are retained without regeneration', () => {
  const irregular = inventory.records.find(record => record.id === 'cdda.mod.aftershock_exoplanet.monster.mon_old_imaginifer_laser.name');
  assert.equal(irregular.en, 'Parallax-3E veles'); assert.deepEqual(irregular.sourcePluralVariants, ['velites']);
  const police = inventory.records.find(record => record.id === 'cdda.core.monster.mon_zombie_soldier_lixa_police.name');
  assert.deepEqual(police.sourcePluralVariants, ['zombie military polices']);
  checkForm(irregular, 'other'); checkForm(police, 'other');
});

const integerFixtures = [0, 1, 2, -1, INT_MIN, INT_MAX].map(nativeInt => ({nativeInt, modeledNativeCategory: nativeInt === 1 ? 'one' : 'other'}));
test('source predicate fixtures cover 0, 1, 2, negative int, INT_MIN and INT_MAX without unsigned guesses', () => {
  for (const fixture of integerFixtures) {
    const category = translatedIntSelector(fixture.nativeInt);
    assert.equal(category, fixture.modeledNativeCategory);
    for (const record of inventory.records) checkForm(record, category);
  }
  for (const invalid of [NaN, Infinity, 1.2, INT_MIN - 1, INT_MAX + 1]) assert.throws(() => translatedIntSelector(invalid));
});

test('item liquid clamp precedes conversion while variant and monster paths forward quantity', () => {
  for (const quantity of [0, 1, 2, INT_MAX]) {
    assert.equal(quantitySelector(quantity, 'itype-base-name', 'LIQUID'), 'one');
    assert.equal(quantitySelector(quantity, 'itype-base-name', 'SOLID'), quantity === 1 ? 'one' : 'other');
    assert.equal(quantitySelector(quantity, 'item-variant-name', 'LIQUID'), quantity === 1 ? 'one' : 'other');
    assert.equal(quantitySelector(quantity, 'mtype-name'), quantity === 1 ? 'one' : 'other');
  }
  assert.equal(quantitySelector(4294967295, 'itype-base-name', 'LIQUID'), 'one');
  for (const route of ['itype-base-name', 'item-variant-name', 'mtype-name']) assert.throws(() => quantitySelector(4294967295, route, 'SOLID'));
  assert.throws(() => quantitySelector(2, 'itype-base-name'));
  assert.throws(() => quantitySelector(2, 'unknown'));
  assert.throws(() => quantitySelector(-1, 'mtype-name'));
});

test('statistic caller routes distinguish current value, target, anything and non-int default', () => {
  assert.equal(statisticSelector('score-int-current-value', 2), 'other');
  assert.equal(statisticSelector('achievement-int-target', 1), 'one');
  assert.equal(statisticSelector('score-int-current-value', -1), 'other');
  assert.equal(statisticSelector('score-non-int-default-one'), 'one');
  assert.equal(statisticSelector('achievement-anything-default-one'), 'one');
  assert.throws(() => statisticSelector('achievement-anything-default-one', 2));
  assert.throws(() => statisticSelector('current-value-for-every-caller', 1));
  for (const record of inventory.records.filter(record => record.sourceBindings[0].ownerType === 'event_statistic')) {
    assert.equal(record.producerBindings[0].producer.consumers.length, 4);
    checkForm(record, statisticSelector('score-int-current-value', 2));
    checkForm(record, statisticSelector('achievement-int-target', 1));
  }
});

test('known monster caller quirks retain cumulative-count and default-one selection', () => {
  const monster = inventory.records.find(record => record.sourceBindings[0].ownerType === 'monster');
  const cumulativeKills = 2, displayedDelta = 1;
  assert.notEqual(cumulativeKills, displayedDelta);
  checkForm(monster, quantitySelector(cumulativeKills, 'mtype-name'));
  checkForm(monster, quantitySelector(1, 'mtype-name')); // Scores UI passes default1 despite its displayed total.
  assert.ok(inventory.sourcePins['src/diary.cpp'].witnesses[0].lines.includes(298));
  assert.ok(inventory.sourcePins['src/scores_ui.cpp'].witnesses[0].lines.includes(175));
});

test('internal dispatcher is disjoint from all 539 registry identities and remains test-only', () => {
  assert.ok(!(DISPATCH_ID in originalEn.entries)); assert.ok(!(DISPATCH_ID in originalJa.entries));
  assert.ok(!(DISPATCH_ID in registry.idMap)); assert.ok(!Object.values(registry.idMap).includes(DISPATCH_ID));
  assert.deepEqual(en.entries[DISPATCH_ID], {parameters: {leaf: 'term'}, other: '{leaf}'});
  assert.ok(inventory.records.every(record => record.termApiMapping.dispatchScope === 'internal-test-only-unconnected'));
});

test('term adapter rejects unknown selectors, missing identities and accidental recursive binder', () => {
  const id = inventory.records[0].id;
  for (const category of [null, 1, -1, 'many', 'quantity']) assert.throws(() => termEvent(id, category));
  assert.throws(() => modeledTermFormat(en, termEvent('fixture.absent', 'one')));
  assert.throws(() => modeledTermFormat(en, termEvent(DISPATCH_ID, 'one')));
  assert.throws(() => termEvent('English name', 'one'));
});

test('plural literal brace escaping preserves both forms and Japanese text', () => {
  const fixtureEn = {schema_version: 1, locale: 'en', entries: {
    'fixture.leaf': {parameters: {}, one: literalTemplate('猫{one}'), other: literalTemplate('猫{{other}}\n')},
    [DISPATCH_ID]: {parameters: {leaf: 'term'}, other: '{leaf}'},
  }};
  const fixtureJa = {schema_version: 1, locale: 'ja', entries: {
    'fixture.leaf': {parameters: {}, other: literalTemplate('猫{数は不変}🌸')},
    [DISPATCH_ID]: {parameters: {leaf: 'term'}, other: '{leaf}'},
  }};
  assert.ok(validateCatalog(fixtureEn)); assert.ok(validateCatalog(fixtureJa));
  assert.equal(modeledTermFormat(fixtureEn, termEvent('fixture.leaf', 'one')), '猫{one}');
  assert.equal(modeledTermFormat(fixtureEn, termEvent('fixture.leaf', 'other')), '猫{{other}}\n');
  for (const category of ['one', 'other']) assert.equal(modeledTermFormat(fixtureJa, termEvent('fixture.leaf', category)), '猫{数は不変}🌸');
});

test('all source pins and original definition files retain exact recorded fingerprints', () => {
  const upstream = 'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-' + SOURCE_COMMIT;
  for (const [file, pin] of Object.entries(inventory.sourcePins)) assert.equal(sha256(readFileSync(path.join(upstream, file))), pin.sha256);
  for (const [file, hash] of Object.entries(inventory.definitionFileSha256)) assert.equal(sha256(readFileSync(path.join(upstream, file))), hash);
});

test('byte-deterministic generated files match disk and prior 315 package stays untouched', () => {
  for (const [name, artifact] of Object.entries(artifacts)) assert.equal(readFileSync(path.join(DIRECTORY, 'output', name), 'utf8'), serialized(artifact), name);
  const existing315Ids = Object.keys(JSON.parse(readFileSync(path.join(ROOT, 'semantic-runtime-catalog/output/en.json'), 'utf8')).entries);
  assert.ok(inventory.records.every(record => !existing315Ids.includes(record.id)));
  for (const [name, hash] of Object.entries(literalPackageBefore)) assert.equal(sha256(readFileSync(path.join(ROOT, 'semantic-runtime-catalog/output', name))), hash, name);
  for (const name of INPUT_FILES) assert.equal(sha256(readFileSync(path.join(ROOT, name))), summary.inputSha256[name], name);
});

test('source-only consumer and whole-game/runtime completion flags stay false', () => {
  assert.equal(summary.preparedPublicTermIdentities, 155); assert.equal(summary.blockedIdentities, 0);
  assert.equal(summary.completeNativeCallerGraphVerified, false);
  assert.equal(summary.wholeGameSemanticMigrationComplete, false);
  assert.ok(summary.blockedProducerSituations.length >= 6);
  for (const artifact of [inventory, summary, artifacts['blocked-identities.json']]) {
    assert.equal(artifact.rustConsumerVerified, false); assert.equal(artifact.originalProducerConnected, false); assert.equal(artifact.runtimeConnected, false);
  }
});

const sourceFiles = ['prepare.mjs', 'selector.mjs', 'test.mjs', 'native-selector-fixtures.cpp', 'rust-verification/Cargo.toml', 'rust-verification/src/lib.rs', 'rust-verification/tests/plural.rs'];
const preparedHashes = Object.fromEntries(sourceFiles.map(name => [name, sha256(readFileSync(path.join(DIRECTORY, name)))]));
const artifactHashes = Object.fromEntries(Object.keys(artifacts).map(name => [name, sha256(readFileSync(path.join(DIRECTORY, 'output', name)))]));
const rustTests = [...readFileSync(path.join(DIRECTORY, 'rust-verification/tests/plural.rs'), 'utf8').matchAll(/#\[test\]\s+fn\s+(\w+)/g)].map(match => match[1]);
assert.equal(rustTests.length, 5);
writeFileSync(path.join(DIRECTORY, 'output/node-verification.json'), serialized({
  schemaVersion: 1, status: 'passed', sourceCommit: SOURCE_COMMIT, nodeVersion: process.version,
  engine: 'Node standard-library source-bound model; original C++ and actual Rust tests not executed',
  testsPassed: tests.length, tests, modeledExactFormatsChecked: exactFormats, integerFixtures,
  preparedPublicTermIdentities: 155, internalTestDispatchers: 1, blockedProducerSituations: summary.blockedProducerSituations,
  inputSha256: summary.inputSha256, prior315PackageSha256Unchanged: literalPackageBefore,
  preparedFilesSha256: preparedHashes, artifactSha256: artifactHashes,
  actualNativeCPPSelectorTestPassed: null, rustConsumerVerified: false, originalProducerConnected: false, runtimeConnected: false,
}), 'utf8');
writeFileSync(path.join(DIRECTORY, 'output/pending-consumer-tests.json'), serialized({
  schemaVersion: 1, status: 'prepared-not-executed', sourceCommit: SOURCE_COMMIT,
  nativeCPP: {file: 'native-selector-fixtures.cpp', status: 'uncompiled-unexecuted', sha256: preparedHashes['native-selector-fixtures.cpp']},
  rust: {manifest: 'semantic-plural-slice/rust-verification/Cargo.toml', status: 'uncompiled-unexecuted', tests: rustTests,
    futureCommandAfterGrantedWindow: 'cargo test --offline --jobs 1 --manifest-path semantic-plural-slice/rust-verification/Cargo.toml --target-dir semantic-plural-slice/rust-verification/target'},
  preparedFilesSha256: preparedHashes, catalogSha256: {en: artifactHashes['en.json'], ja: artifactHashes['ja.json']},
  actualNativeCPPSelectorTestPassed: null, rustConsumerVerified: false, originalProducerConnected: false, runtimeConnected: false,
  completeNativeCallerGraphVerified: false, wholeGameSemanticMigrationComplete: false,
}), 'utf8');
console.log(JSON.stringify({status: 'passed', testsPassed: tests.length, modeledFormats: exactFormats, preparedPublicTerms: 155, runtimeConnected: false}));
