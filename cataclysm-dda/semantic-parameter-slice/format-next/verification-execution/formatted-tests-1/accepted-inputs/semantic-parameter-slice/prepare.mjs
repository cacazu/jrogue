import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { literalTemplate, validateCatalog, validId } from '../semantic-runtime-catalog/model.mjs';
import { CONVERTED, WITNESSES, NATIVE_MESSAGE_READERS, blockedOwnership, SOURCE_COMMIT, UPSTREAM } from './bindings.mjs';

export const OWN = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.dirname(OWN);
export const INPUTS = ['ja-current/en.json', 'ja-current/ja.json', 'ja-current/semantic-id-registry.json',
  'ja-current/verification.json', 'semantic-runtime-catalog/output/blockers.json',
  'semantic-runtime-catalog/output/en.json', 'semantic-runtime-catalog/output/ja.json',
  'semantic-runtime-catalog/output/provenance.json', 'semantic-runtime-catalog/model.mjs',
  'semantic-plural-slice/output/en.json', 'semantic-plural-slice/output/ja.json',
  'semantic-plural-slice/output/consumer-inventory.json',
  'rust-contracts/logic/src/lib.rs', 'rust-contracts/presentation/src/lib.rs'];
export const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const read = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
export function pins() { return Object.fromEntries(INPUTS.map(relative => [relative, sha(fs.readFileSync(path.join(ROOT, relative)))])); }
function pointer(value, text) { return text.split('/').slice(1).reduce((node, part) => node[part.replaceAll('~1','/').replaceAll('~0','~')], value); }
export function singleNamedTerm(text, name) {
  // Bounded transformation of an independently reviewed single string slot.
  // It never replaces ordinary prose globally or handles rich/recursive programs.
  const matches = [...text.matchAll(/%(?:1\$)?s/g)];
  assert.equal(matches.length, 1); assert.equal(text.replace(matches[0][0], '').includes('%'), false);
  const [{ index, 0: specifier }] = matches;
  return literalTemplate(text.slice(0, index)) + '{' + name + '}' + literalTemplate(text.slice(index + specifier.length));
}
export function prepare() {
  const inputHashes = pins(), enSource = read('ja-current/en.json'), jaSource = read('ja-current/ja.json');
  const blockers = read('semantic-runtime-catalog/output/blockers.json');
  assert.equal(blockers.sourceCommit, SOURCE_COMMIT);
  const selected = blockers.records.filter(record => record.reasons.some(reason => reason.code === 'printf-parameters-need-named-schema'));
  assert.equal(selected.length, 12);
  const sourcePins = {}, documents = new Map();
  function source(file) {
    if (!documents.has(file)) {
      const bytes = fs.readFileSync(path.join(UPSTREAM, file));
      sourcePins[file] = { bytes: bytes.length, sha256: sha(bytes) }; documents.set(file, bytes.toString('utf8'));
    }
    return documents.get(file);
  }
  for (const [file, fragments] of Object.entries(WITNESSES))
    for (const fragment of fragments) assert.ok(source(file).includes(fragment), 'source witness mismatch: ' + file + ': ' + fragment);
  for (const [file, reader] of Object.entries(NATIVE_MESSAGE_READERS)) {
    source(file); assert.equal(sourcePins[file].sha256, reader.sha256, 'independently reviewed reader pin changed');
  }
  const en = { schema_version: 1, locale: 'en', entries: {} }, ja = { schema_version: 1, locale: 'ja', entries: {} };
  const inventory = selected.map(record => {
    assert.ok(validId(record.id));
    assert.equal(record.en, enSource.entries[record.id].text); assert.equal(record.ja, jaSource.entries[record.id].text);
    for (const binding of record.sourceBindings.filter(binding => binding.sourceFile)) {
      const document = JSON.parse(source(binding.sourceFile));
      const owner = pointer(document, binding.ownerPointer);
      assert.equal(owner[binding.ownerIdentity.field], binding.ownerIdentity.value);
      for (const location of binding.jsonPointers) assert.equal(pointer(document, location), record.en);
    }
    const mapping = CONVERTED[record.id];
    if (mapping) {
      en.entries[record.id] = { parameters: { [mapping.parameter]: 'term' }, other: singleNamedTerm(record.en, mapping.parameter) };
      ja.entries[record.id] = { parameters: { [mapping.parameter]: 'term' }, other: singleNamedTerm(record.ja, mapping.parameter) };
    }
    return { ...record, publicIdUnchanged: true, catalogPrepared: Boolean(mapping),
      ownership: mapping ?? blockedOwnership(record.id), producerConnected: false,
      countScope: mapping ? 'constant1 matches default achievement translation / explicit base itype nname(1); no displayed numeric Count' : null,
      nativeLookupRule: 'Native producer must emit already selected definition identity/binding and argument program; observers must never invoke game/input/visibility/RNG decisions.',
      unresolved: mapping ? ['Live source-bound loaded-definition→existing TextId registration/override lifecycle',
        'Actual C++ event capture and FFI integration; unknown/changed definitions must report unavailable',
        'Original wrapper green color/newline assembly stays native where applicable'] : [blockedOwnership(record.id).reason] };
  });
  assert.deepEqual(Object.keys(en.entries).sort(), Object.keys(CONVERTED).sort());
  validateCatalog(en); validateCatalog(ja);
  // Exact original definition leaves for synthetic formatter tests only.
  // They are not asserted to be an actual selectable requirement/fault-bearing item.
  const fixtureIds = ['cdda.core.achievement.achievement_reach_balthazar.name', 'cdda.core.item.roller_blades.name'];
  const baseEn = read('semantic-runtime-catalog/output/en.json'), baseJa = read('semantic-runtime-catalog/output/ja.json');
  const pluralEn = read('semantic-plural-slice/output/en.json'), pluralJa = read('semantic-plural-slice/output/ja.json');
  const baseInventory = read('semantic-runtime-catalog/output/provenance.json').entries;
  const pluralInventory = read('semantic-plural-slice/output/consumer-inventory.json').records;
  const fixtures = { en: { schema_version: 1, locale: 'en', entries: {} }, ja: { schema_version: 1, locale: 'ja', entries: {} } };
  const fixtureBindings = fixtureIds.map(id => {
    const record = [...baseInventory, ...pluralInventory].find(record => record.id === id);
    assert.ok(record && record.sourceBindings.length === 1);
    const binding = record.sourceBindings[0], definition = JSON.parse(source(binding.sourceFile));
    assert.equal(pointer(definition, binding.ownerPointer)[binding.ownerIdentity.field], binding.ownerIdentity.value);
    const raw = pointer(definition, binding.jsonPointers[0]);
    assert.equal(typeof raw === 'string' ? raw : raw.str ?? raw.str_sp, record.singular);
    for (const [locale, base, plural] of [['en',baseEn,pluralEn],['ja',baseJa,pluralJa]]) {
      const entry = base.entries[id] ?? plural.entries[id];
      assert.deepEqual(entry.parameters, {}); fixtures[locale].entries[id] = entry;
    }
    return { id, binding, syntheticParameterChoice: true, actualRequirementOrFaultApplicabilityClaimed: false };
  });
  validateCatalog(fixtures.en); validateCatalog(fixtures.ja);
  assert.deepEqual(pins(), inputHashes, 'frozen input was modified');
  const output = path.join(OWN, 'output'); fs.mkdirSync(output, { recursive: true });
  const artifacts = { 'en.json': en, 'ja.json': ja, 'term-fixtures.en.json': fixtures.en, 'term-fixtures.ja.json': fixtures.ja,
    'source-inventory.json': { schemaVersion: 1, sourceCommit: SOURCE_COMMIT, inputHashes, sourcePins,
      inspectedSourceWitnesses: WITNESSES, reviewedNativeMessageReaders: NATIVE_MESSAGE_READERS,
      runtimeConnected: false, rustConsumerExecuted: false, records: inventory, fixtureBindings },
    'remaining-blockers.json': { sourceCommit: SOURCE_COMMIT, records: inventory.filter(record => !record.catalogPrepared) },
    'summary.json': { sourceCommit: SOURCE_COMMIT, printfExclusionsAudited: 12, messageTemplatesPrepared: 3,
      remainingExcludedMessageTemplates: 9, syntheticSourceLeafFixtures: 2, unchangedPublicIds: true,
      newParameterKinds: 0, sourceOnly: true, nodeVerification: 'Recorded separately in output/node-verification.json',
      genuineRustTestsPrepared: fs.existsSync(path.join(OWN, 'rust-verification/src/tests.rs')),
      genuineRustTestsExecuted: false, rustFormatClippyExecuted: false,
      originalProducerConnected: false, runtimeConnected: false, browserExecuted: false,
      completeTranslationCoverage: false, frozenPackageAndPristineSourcesUnchanged: true } };
  for (const [name, value] of Object.entries(artifacts)) fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
  console.log(JSON.stringify(artifacts['summary.json'], null, 2));
  return artifacts;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepare();
