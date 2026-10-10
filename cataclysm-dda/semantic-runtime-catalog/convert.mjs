import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, mkdirSync, writeFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validId, literalTemplate, validateCatalog, renderLiteralEntry} from './model.mjs';

export const DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.dirname(DIRECTORY);
export const SOURCE_COMMIT = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
export const UPSTREAM = 'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-' + SOURCE_COMMIT;
export const INPUTS = [
  'ja-current/en.json', 'ja-current/ja.json', 'ja-current/reviewed-current-additions.json',
  'ja-current/semantic-id-registry.json', 'catalog-reconcile/output/current-source-gaps.json',
  'catalog-reconcile/output/539-binding-verification.json',
  'rust-contracts/logic/src/lib.rs', 'rust-contracts/presentation/src/lib.rs',
];
export function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
export function serialized(value) { return JSON.stringify(value, null, 2) + '\n'; }
function pair(record) { return JSON.stringify([record.context, record.singular]); }
function traverse(document, pointer) {
  let value = document;
  for (const part of pointer.split('/').slice(1)) {
    const token = part.replace(/~1/g, '/').replace(/~0/g, '~');
    value = value[token];
  }
  return value;
}
function canonicalOwner(owner, identity) {
  if (identity === null) return null;
  if (identity.field === 'result+id_suffix') return String(owner.result) + String(owner.id_suffix ?? '');
  const value = owner[identity.field];
  return Array.isArray(value) ? 'aliases=' + value.join(',') : value;
}
function tokensIn(text) { return [...text.matchAll(/<[^<>\r\n]+>/g)].map(match => match[0]); }

// A conservative detector, not a conversion to named parameter roles. Its
// evidence is checked independently of the companion metadata. printf-like
// fragments in two help paragraphs are exact, source-bound literal exceptions:
// src/help.cpp translates them directly into scrollable_text without printf.
const LITERAL_PERCENT_HELP = {
  'cdda.mod.mind_over_matter.help.awakening.chance_and_latent_trait': {
    en: 'b3a7c47c551ddbb109bee500d02e2f4bec7eaa50ddcabd015eff904d14b53cb9',
    ja: '3f6126604fe91c6c150e9a87b44c443ff97376729242d71f932c0e4d6113d8d3',
  },
  'cdda.mod.mind_over_matter.help.using_powers.failure_factors': {
    en: 'f2993fd67522396cd0bdc7cf99ab3a9332ae5e1edc8d1ad4c6c40ff67f7700f2',
    ja: '071a6911f77669c8fa03db1116531e9aabb761622936dddb2aed42443546b07b',
  },
};
export function printfEvidence(text) {
  const pattern = /%(?:(\d+)\$)?[-+#0 ']*(?:(\*(?:\d+\$)?)|\d+)?(?:\.(?:(\*(?:\d+\$)?)|\d+))?(?:hh|ll|[hljztL])?([diuoxXfFeEgGaAcspn%])/g;
  return [...text.matchAll(pattern)].filter(match => match[4] !== '%').map(match => ({
    specifier: match[0], offset: match.index, explicitPosition: match[1] ? Number(match[1]) : null,
    widthArgument: match[2] ?? null, precisionArgument: match[3] ?? null, conversion: match[4],
  }));
}
function literalPercentHelp(record, en, ja) {
  const review = LITERAL_PERCENT_HELP[record.semanticId];
  return Boolean(review && sha256(en.text) === review.en && sha256(ja.text) === review.ja &&
    record.sourceBindings.length > 0 && record.sourceBindings.every(binding => binding.ownerType === 'help'));
}
function cachedPrintfSignature(evidence) {
  const parameters = new Map();
  let next = 1;
  const add = (position, type) => {
    assert.ok(!parameters.has(position) || parameters.get(position) === type, 'conflicting printf argument types');
    parameters.set(position, type);
  };
  for (const item of evidence) {
    for (const star of [item.widthArgument, item.precisionArgument]) if (star !== null) {
      add(star === '*' ? next++ : Number(star.slice(1, -1)), 'integer');
    }
    const type = item.conversion === 's' ? 'string' : /[fFeEgGaA]/.test(item.conversion) ? 'float' :
      item.conversion === 'p' || item.conversion === 'n' ? 'pointer' : 'integer';
    add(item.explicitPosition ?? next++, type);
  }
  return [...parameters].sort((a, b) => a[0] - b[0]).map(([position, type]) => ({position, type}));
}

export function classify(record, en, ja) {
  const reasons = [];
  const detected = literalPercentHelp(record, en, ja) ? {en: [], ja: []} : {en: printfEvidence(en.text), ja: printfEvidence(ja.text)};
  if (en.printfParameters.length || ja.printfParameters.length || detected.en.length || detected.ja.length) reasons.push({code: 'printf-parameters-need-named-schema', en: en.printfParameters, ja: ja.printfParameters, independentTextEvidence: detected});
  const plurals = [...new Set(record.pluralVariants.filter(value => value !== null))];
  if (plurals.length) reasons.push({code: 'native-plural-consumer-and-selector-required', sourcePlurals: plurals});
  const snippetBindings = record.sourceBindings.filter(binding => binding.ownerType === 'snippet');
  if (snippetBindings.length) reasons.push({code: 'snippet-selection-or-expansion-provenance-required', bindings: snippetBindings});
  const angle = {en: tokensIn(en.text), ja: tokensIn(ja.text)};
  if (angle.en.length || angle.ja.length) reasons.push({code: 'rich-text-or-dynamic-angle-token-unsupported', tokens: angle});
  if (record.sourceBindings.some(binding => ['talk_topic', 'npc', 'mission_definition'].includes(binding.ownerType)) && /^[*&]/.test(en.text)) reasons.push({code: 'dialogue-control-prefix-needs-structured-consumer', prefix: en.text[0]});
  if (en.text.includes('%%') || ja.text.includes('%%')) reasons.push({code: 'printf-literal-percent-escape-consumer-required'});
  if (en.text.includes('\0') || ja.text.includes('\0')) reasons.push({code: 'embedded-nul-unsupported-in-this-profile'});
  return reasons;
}

export function loadInputs() {
  const buffers = Object.fromEntries(INPUTS.map(name => [name, readFileSync(path.join(ROOT, name))]));
  const hashes = Object.fromEntries(Object.entries(buffers).map(([name, buffer]) => [name, sha256(buffer)]));
  const json = name => JSON.parse(buffers[name].toString('utf8'));
  const en = json('ja-current/en.json'), ja = json('ja-current/ja.json');
  const reviewed = json('ja-current/reviewed-current-additions.json');
  const registry = json('ja-current/semantic-id-registry.json');
  const authoritative = json('catalog-reconcile/output/current-source-gaps.json');
  const bindingVerification = json('catalog-reconcile/output/539-binding-verification.json');
  assert.equal(en.source_commit, SOURCE_COMMIT); assert.equal(ja.source_commit, SOURCE_COMMIT);
  assert.equal(reviewed.sourceCommit, SOURCE_COMMIT); assert.equal(registry.sourceCommit, SOURCE_COMMIT);
  assert.equal(authoritative.sourceCommit, SOURCE_COMMIT); assert.equal(bindingVerification.sourceCommit, SOURCE_COMMIT);
  assert.equal(bindingVerification.status, 'passed');
  assert.equal(bindingVerification.fullHandoffSha256, hashes['catalog-reconcile/output/current-source-gaps.json']);
  assert.deepEqual(Object.keys(en.entries).sort(), Object.keys(ja.entries).sort());
  assert.equal(Object.keys(en.entries).length, 539);
  assert.equal(reviewed.records.length, 539);
  const sourceRecords = new Map(authoritative.records.map(record => [pair(record), record]));
  const seen = new Set();
  const sourceDocuments = new Map(), checkedSourceHashes = {};
  let checkedPointers = 0, checkedOwners = 0, cppReferences = 0;
  for (const record of reviewed.records) {
    assert.ok(validId(record.semanticId), `not normalized: ${record.semanticId}`);
    assert.ok(!seen.has(record.semanticId), 'duplicate reviewed ID'); seen.add(record.semanticId);
    const sourceRecord = sourceRecords.get(pair(record));
    assert.ok(sourceRecord, 'record not in current official corpus');
    assert.equal(record.index, sourceRecord.index);
    assert.deepEqual(record.pluralVariants, sourceRecord.pluralVariants);
    assert.deepEqual(record.sourceBindings, sourceRecord.sourceBindings);
    const english = en.entries[record.semanticId], japanese = ja.entries[record.semanticId];
    assert.ok(english && japanese, 'reviewed ID missing in catalog');
    assert.equal(english.text, record.singular, 'English changed');
    assert.equal(japanese.text, record.translations['0'], 'Japanese changed');
    assert.equal(english.context, record.context); assert.equal(japanese.context, record.context);
    assert.ok(Array.isArray(english.printfParameters) && Array.isArray(japanese.printfParameters));
    assert.deepEqual(english.printfParameters, japanese.printfParameters, 'printf type/position parity');
    const independent = literalPercentHelp(record, english, japanese) ? {en: [], ja: []} : {en: printfEvidence(english.text), ja: printfEvidence(japanese.text)};
    assert.deepEqual(english.printfParameters, cachedPrintfSignature(independent.en), 'English cached printf metadata differs from exact string');
    assert.deepEqual(japanese.printfParameters, cachedPrintfSignature(independent.ja), 'Japanese cached printf metadata differs from exact string');
    for (const candidate of record.sourceCandidateIds ?? []) {
      if (candidate in registry.idMap) assert.equal(registry.idMap[candidate], record.semanticId);
    }
    for (const binding of record.sourceBindings) {
      if (!binding.sourceFile) { cppReferences++; continue; }
      assert.equal(binding.bindingStatus, 'exact-pointer');
      if (!sourceDocuments.has(binding.sourceFile)) {
        const buffer = readFileSync(path.join(UPSTREAM, binding.sourceFile));
        const hash = sha256(buffer);
        assert.equal(hash, bindingVerification.checkedSourceFileSha256[binding.sourceFile], 'immutable source fingerprint differs');
        sourceDocuments.set(binding.sourceFile, JSON.parse(buffer.toString('utf8')));
        checkedSourceHashes[binding.sourceFile] = hash;
      }
      const document = sourceDocuments.get(binding.sourceFile), owner = traverse(document, binding.ownerPointer);
      assert.equal(owner.type.toLowerCase(), binding.ownerType); checkedOwners++;
      if (binding.ownerIdentity !== null) assert.equal(canonicalOwner(owner, binding.ownerIdentity), binding.ownerIdentity.value);
      for (const pointer of binding.jsonPointers) {
        const value = traverse(document, pointer);
        const singular = typeof value === 'string' ? value : (record.pluralVariants.some(Boolean) && 'str_sp' in value ? value.str_sp : value.str);
        assert.equal(singular, record.singular, 'source pointer English differs');
        if (typeof value === 'object' && typeof value.ctxt === 'string') assert.equal(value.ctxt, record.context);
        if (typeof value === 'object' && record.pluralVariants.some(Boolean) && 'str_pl' in value) assert.ok(record.pluralVariants.includes(value.str_pl));
        checkedPointers++;
      }
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(en.entries).sort());
  const logic = buffers['rust-contracts/logic/src/lib.rs'].toString('utf8');
  const presentation = buffers['rust-contracts/presentation/src/lib.rs'].toString('utf8');
  // These guards anchor the Node model to the inspected current source. They
  // do not replace running the real Rust parser after a granted build window.
  for (const fragment of ['value.len() > 160', 'part.as_bytes()[0].is_ascii_lowercase()', 'pub enum ParameterKind', 'UserText', 'Count', 'Term']) assert.ok(logic.includes(fragment), 'Rust contract changed; inspect before using Node model');
  for (const fragment of ['struct RawCatalog', 'struct RawEntry', 'parameters: BTreeMap<String, ParameterKind>', 'other: String', 'fn tokenize(template: &str)', "'{' if chars.peek() == Some(&'{')", 'raw.locale == Locale::Ja']) assert.ok(presentation.includes(fragment), 'Rust parser changed; review Node model');
  const helpSource = readFileSync(path.join(UPSTREAM, 'src/help.cpp'));
  for (const fragment of ['std::string line_proc = line.translated();', 'scrollable_text( get_w_help_border']) assert.ok(helpSource.toString('utf8').includes(fragment), 'help literal-percent consumer changed');
  return {en, ja, reviewed, registry, hashes, checkedSourceHashes,
    consumerReview: {literalPercentHelp: {sourceFile: 'src/help.cpp', sha256: sha256(helpSource), lines: [244, 278], exactTextExceptions: LITERAL_PERCENT_HELP}},
    sourceVerification: {records: seen.size, jsonPointers: checkedPointers, ownerDefinitions: checkedOwners, cppReferencesUsingPreviousOfficialExtraction: cppReferences}};
}

export function buildArtifacts(input) {
  const en = {schema_version: 1, locale: 'en', entries: {}}, ja = {schema_version: 1, locale: 'ja', entries: {}};
  const converted = [], blocked = [], reasonCounts = {}, primaryCounts = {};
  for (const record of [...input.reviewed.records].sort((a, b) => a.semanticId < b.semanticId ? -1 : a.semanticId > b.semanticId ? 1 : 0)) {
    const id = record.semanticId, english = input.en.entries[id], japanese = input.ja.entries[id];
    const reasons = classify(record, english, japanese);
    const provenance = {id, sourceIndex: record.index, context: record.context, singular: record.singular,
      sourcePlural: record.plural, sourcePluralVariants: record.pluralVariants,
      sourceCandidateAliases: record.sourceCandidateIds ?? [], sourceBindings: record.sourceBindings,
      references: record.references, idMapping: {inputPublicId: id, runtimePublicId: id, unchanged: true}};
    if (reasons.length) {
      blocked.push({...provenance, en: english.text, ja: japanese.text, reasons});
      for (const reason of reasons) reasonCounts[reason.code] = (reasonCounts[reason.code] ?? 0) + 1;
      primaryCounts[reasons[0].code] = (primaryCounts[reasons[0].code] ?? 0) + 1;
    } else {
      en.entries[id] = {parameters: {}, other: literalTemplate(english.text)};
      ja.entries[id] = {parameters: {}, other: literalTemplate(japanese.text)};
      assert.equal(renderLiteralEntry(en.entries[id]), english.text);
      assert.equal(renderLiteralEntry(ja.entries[id]), japanese.text);
      converted.push({...provenance, profile: 'source-bound-literal-v1', templateTransformation: {method: 'double-each-literal-brace', enBraces: (english.text.match(/[{}]/g) ?? []).length, jaBraces: (japanese.text.match(/[{}]/g) ?? []).length}, enSourceSha256: sha256(english.text), jaSourceSha256: sha256(japanese.text)});
    }
  }
  validateCatalog(en); validateCatalog(ja);
  assert.deepEqual(Object.keys(en.entries), Object.keys(ja.entries));
  const common = {schemaVersion: 1, sourceCommit: SOURCE_COMMIT, inputSha256: input.hashes, rustConsumerVerified: false, runtimeConnected: false};
  const summary = {...common, profile: 'source-bound-literal-v1', inputEntries: input.reviewed.records.length,
    preparedRuntimeEntries: converted.length, blockedEntries: blocked.length, blockersNonExclusive: reasonCounts,
    blockersPrimaryPartition: primaryCounts, braceEscapedEntryPairs: converted.filter(r => r.templateTransformation.enBraces || r.templateTransformation.jaBraces).length,
    sourceVerification: input.sourceVerification, idMappingPolicy: 'Existing normalized public IDs are preserved exactly; candidate aliases retained only in provenance',
    generatedSchema: 'Actual Rust RawCatalog/RawEntry schema; Node modeled validation only',
    sourcePreservation: 'Rendering prepared literal templates through the Node mirror returns the exact original en/ja strings, including whitespace, punctuation and UTF-8',
    pending: ['Actual Rust Catalog::from_json load/format tests after parent grants build window', 'Original C++ producer/FFI consumer integration', 'Named parameter roles and dynamic names', 'Native plural/count consumer mapping', 'Snippet selection/expansion and rich-text tokens', 'Actual game/browser and render/RNG purity tests'],
    exclusions: 'Conservative literal-only profile: all snippet-owned entries and all native-plural entries remain blocked even when their text could be stored as literals; consumer semantics must be explicit'};
  return {'en.json': en, 'ja.json': ja, 'provenance.json': {...common, checkedSourceFileSha256: input.checkedSourceHashes, consumerReview: input.consumerReview, entries: converted}, 'blockers.json': {...common, records: blocked}, 'conversion-summary.json': summary};
}

export function main(check = false) {
  const artifacts = buildArtifacts(loadInputs());
  if (!check) mkdirSync(path.join(DIRECTORY, 'output'), {recursive: true});
  for (const [name, value] of Object.entries(artifacts)) {
    const target = path.join(DIRECTORY, 'output', name), data = serialized(value);
    if (check) { assert.ok(existsSync(target), 'missing artifact: ' + name); assert.equal(readFileSync(target, 'utf8'), data, 'stale/non-deterministic artifact: ' + name); }
    else writeFileSync(target, data, 'utf8');
  }
  console.log(JSON.stringify(artifacts['conversion-summary.json'], null, 2));
  return artifacts;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.includes('--check'));
