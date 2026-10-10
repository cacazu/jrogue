import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEXT_ID_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const serialize = value => JSON.stringify(value, null, 2) + '\n';
const registryPath = 'ja-current/semantic-id-registry.json';
const companionFiles = ['ja-current/en.json', 'ja-current/ja.json'];
const additionsPath = 'ja-current/reviewed-current-additions.json';
const protectedFiles = [
  'ja-current/part-1.json', 'ja-current/part-2.json', 'ja-current/part-3.json',
  'ja-current/generated/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo',
];

export function assertTextId(id) {
  assert.ok(typeof id === 'string' && id.startsWith('cdda.') &&
    id.length <= 160 && TEXT_ID_PATTERN.test(id), 'invalid public TextId: ' + id);
}

export function validateRegistry(registry) {
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.scope.recordCount, 180);
  assert.equal(registry.records.length, 180);
  assert.equal(Object.keys(registry.idMap).length, 180);
  const oldIds = new Set(), newIds = new Set();
  for (const record of registry.records) {
    assert.equal(record.status, 'reviewed', 'pending registry role cannot be applied');
    assertTextId(record.newId);
    assert.equal(registry.idMap[record.oldId], record.newId);
    assert.ok(!oldIds.has(record.oldId) && !newIds.has(record.newId), 'registry collision');
    oldIds.add(record.oldId);
    newIds.add(record.newId);
  }
  return registry;
}

export function registryMappingHash(registry) {
  return sha256(JSON.stringify(registry.idMap));
}

const registrationFor = (id, registry) => registry.records.find(record =>
  record.oldId === id || record.newId === id);

export function normalizeReviewedRecord(record, registry) {
  const registration = registrationFor(record.semanticId, registry);
  if (!registration) {
    assertTextId(record.semanticId);
    return { ...record };
  }
  for (const field of ['index', 'context', 'singular', 'plural', 'pluralVariants', 'sourceBindings']) {
    assert.deepEqual(record[field], registration[field], 'registry/source record mismatch: ' + field);
  }
  if (record.sourceCandidateIds !== undefined) {
    assert.deepEqual(record.sourceCandidateIds, [registration.oldId], 'candidate provenance changed');
  }
  return {
    ...record,
    semanticId: registration.newId,
    // These strings preserve extracted candidate identity as provenance. They
    // are deliberately separate from the grammar-checked public semanticId.
    sourceCandidateIds: [registration.oldId],
  };
}

function registryMetadata(registry) {
  return {
    path: 'semantic-id-registry.json',
    mapping_sha256: registryMappingHash(registry),
    scope: '180 reviewed candidate-to-public ID mappings within 539 additions',
    aliases_are_source_provenance: true,
    runtime_consumer_complete: false,
  };
}

export function normalizeAdditionsDocument(document, registry) {
  assert.equal(document.sourceCommit, registry.sourceCommit);
  assert.equal(document.records.length, 539);
  const records = document.records.map(record => normalizeReviewedRecord(record, registry));
  assert.equal(new Set(records.map(record => record.semanticId)).size, 539, 'record ID collision');
  return { ...document, records, semanticIdRegistry: registryMetadata(registry) };
}

export function normalizeCompanionDocument(document, registry) {
  assert.equal(document.source_commit, registry.sourceCommit);
  assert.equal(Object.keys(document.entries).length, 539);
  const entries = {};
  for (const [id, entry] of Object.entries(document.entries)) {
    const publicId = registry.idMap[id] ?? id;
    assertTextId(publicId);
    assert.ok(!Object.hasOwn(entries, publicId), 'companion ID collision: ' + publicId);
    entries[publicId] = entry;
  }
  for (const publicId of Object.values(registry.idMap)) {
    assert.ok(Object.hasOwn(entries, publicId), 'mapped companion entry absent: ' + publicId);
  }
  return {
    ...document,
    entries,
    semantic_id_registry: registryMetadata(registry),
    source_candidate_aliases: { ...registry.idMap },
  };
}

async function fileHash(file) {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  return digest.digest('hex');
}

async function hashes(files) {
  const result = {};
  for (const file of files) result[file] = await fileHash(file);
  return result;
}

function verifyContentPreservation(before, after, registry, records = false) {
  if (records) {
    assert.equal(before.records.length, after.records.length);
    for (let index = 0; index < before.records.length; index++) {
      const previous = before.records[index], current = after.records[index];
      const { semanticId: oldId, sourceCandidateIds: oldCandidates, ...oldContent } = previous;
      const { semanticId: newId, sourceCandidateIds: newCandidates, ...newContent } = current;
      assert.equal(newId, registry.idMap[oldId] ?? oldId);
      assert.deepEqual(newContent, oldContent, 'reviewed record content changed');
      const registration = registrationFor(newId, registry);
      if (registration) assert.deepEqual(newCandidates, [registration.oldId]);
      else assert.deepEqual(newCandidates, oldCandidates);
    }
  } else {
    assert.equal(Object.keys(before.entries).length, Object.keys(after.entries).length);
    for (const [oldId, entry] of Object.entries(before.entries)) {
      assert.deepEqual(after.entries[registry.idMap[oldId] ?? oldId], entry,
        'localized text/parameters/plurals/context changed');
    }
  }
  for (const key of Object.keys(before)) {
    if (!['entries', 'records', 'semanticIdRegistry', 'semantic_id_registry', 'source_candidate_aliases'].includes(key)) {
      assert.deepEqual(after[key], before[key], 'document metadata changed: ' + key);
    }
  }
}

async function main() {
  assert.ok(['--apply', '--check'].includes(process.argv[2]) && process.argv.length === 3,
    'usage: node ja-current/apply-semantic-registry.mjs --apply|--check');
  const apply = process.argv[2] === '--apply';
  const registryBytes = await readFile(registryPath);
  const registry = validateRegistry(JSON.parse(registryBytes));
  const protectedBefore = await hashes(protectedFiles);
  assert.equal(protectedBefore['ja-current/part-1.json'], registry.scope.inputSha256,
    'reviewed registry fingerprint does not match part-1');
  const files = [...companionFiles, additionsPath];
  const initialBytes = {}, original = {}, normalized = {};
  for (const file of files) {
    initialBytes[file] = await readFile(file);
    original[file] = JSON.parse(initialBytes[file]);
    normalized[file] = file === additionsPath ?
      normalizeAdditionsDocument(original[file], registry) :
      normalizeCompanionDocument(original[file], registry);
    verifyContentPreservation(original[file], normalized[file], registry, file === additionsPath);
    const repeat = file === additionsPath ?
      normalizeAdditionsDocument(normalized[file], registry) :
      normalizeCompanionDocument(normalized[file], registry);
    assert.deepEqual(repeat, normalized[file], 'normalization is not idempotent');
  }
  const publicIds = Object.keys(normalized[companionFiles[0]].entries);
  assert.equal(publicIds.length, 539);
  assert.deepEqual([...publicIds].sort(), Object.keys(normalized[companionFiles[1]].entries).sort(), 'en/ja ID parity');
  assert.deepEqual([...publicIds].sort(), normalized[additionsPath].records.map(record => record.semanticId).sort(), 'record/companion ID parity');
  publicIds.forEach(assertTextId);
  if (!apply) {
    assert.equal(registry.applied, true, 'registry has not been applied');
    for (const file of files) assert.deepEqual(original[file], normalized[file], 'artifact still needs normalization: ' + file);
  }
  if (apply) {
    for (const file of files) {
      const bytes = Buffer.from(serialize(normalized[file]));
      if (!bytes.equals(initialBytes[file])) await writeFile(file, bytes);
      assert.deepEqual(JSON.parse(await readFile(file)), normalized[file], 'output readback changed');
    }
  }
  const protectedAfter = await hashes(protectedFiles);
  assert.deepEqual(protectedAfter, protectedBefore, 'translator parts or existing MO changed');
  const artifactHashes = await hashes(files);
  const evidence = {
    scope: 'Public IDs/provenance of the 539 companion additions only; unchanged gettext MO and translator records',
    command: 'node ja-current/apply-semantic-registry.mjs --apply',
    verification_command: 'node ja-current/apply-semantic-registry.mjs --check',
    helper_sha256: await fileHash(fileURLToPath(import.meta.url)),
    registry_mapping_sha256: registryMappingHash(registry),
    public_ids: 539,
    registry_mappings_applied: 180,
    other_public_ids_unchanged: 359,
    ids_passing_grammar: 539,
    maximum_public_id_length: Math.max(...publicIds.map(id => id.length)),
    unique_public_ids: 539,
    en_ja_record_id_parity: true,
    exact_translation_parameter_plural_context_preservation: true,
    exact_source_bindings_and_record_content_preservation: true,
    normalization_idempotent: true,
    source_candidate_aliases_preserved: 180,
    runtime_consumer_complete: false,
    protected_artifacts_unchanged: true,
    protected_artifact_sha256: protectedAfter,
    output_artifact_sha256: artifactHashes,
  };
  if (registry.applied) {
    assert.deepEqual(registry.application.output_artifact_sha256, artifactHashes, 'applied artifact evidence no longer matches');
    assert.deepEqual(registry.application.protected_artifact_sha256, protectedAfter, 'protected artifact evidence no longer matches');
  } else if (apply) {
    registry.applied = true;
    registry.status = 'companion_ids_applied_runtime_unconnected';
    registry.verification.verificationStage = 'registry_preparation_before_application';
    registry.application = {
      ...evidence,
      registry_preparation_sha256: sha256(registryBytes),
      input_artifact_sha256: Object.fromEntries(files.map(file => [file, sha256(initialBytes[file])])),
    };
    await writeFile(registryPath, serialize(registry));
  }
  console.log(JSON.stringify({ status: 'pass', mode: apply ? 'apply' : 'check', ...evidence }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
