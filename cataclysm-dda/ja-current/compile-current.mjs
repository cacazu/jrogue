import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parsePo, catalogKey } from '../inventory-tools/inventory.mjs';
import { encodeMo } from '../tools/mo-codec.mjs';
import { validateRegistry, normalizeReviewedRecord, normalizeAdditionsDocument, normalizeCompanionDocument, assertTextId, registryMappingHash } from './apply-semantic-registry.mjs';

const require = createRequire(import.meta.url);
const { printfSignature } = require('../ja-completion/checks.cjs');
const [sourcePo, outputDir = 'ja-current/generated'] = process.argv.slice(2);
if (!sourcePo) throw new Error('usage: node ja-current/compile-current.mjs PRISTINE_JA_PO [OUTPUT_DIR]');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const load = async file => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const oldPatch = await load('ja-completion/ja-reviewed-patches.json');
const semanticRegistry = validateRegistry(await load('ja-current/semantic-id-registry.json'));
assert.equal(semanticRegistry.sourceCommit, oldPatch.sourceCommit, 'registry source commit changed');
const sourceBytes = await readFile(sourcePo);
assert.equal(hash(sourceBytes), oldPatch.sourceCatalog.sha256, 'pristine catalog changed');
const source = parsePo(sourceBytes.toString('utf8'), 'lang/po/ja.po');
assert.equal(source.errors.length, 0);
assert.equal(source.language, 'ja');
assert.equal(source.nplurals, 1);
const header = source.entries.find(entry => entry.singular === '' && !entry.obsolete);
assert.ok(header, 'missing PO header');

const patchByKey = new Map(oldPatch.records.map(record => [record.catalogKey, record]));
const newByKey = new Map();
const newSemanticIds = new Set();
const fingerprints = [];
const tags = text => [...text.matchAll(/<[^<>\n]+>/g)].map(match => match[0]).sort();
const braces = text => [...text.matchAll(/\{[^{}\n]+\}/g)].map(match => match[0]).sort();
const newlineRuns = text => [...text.matchAll(/\n+/g)].map(match => match[0].length);
const literalPercentHelp = record =>
  (record.index === 316 && record.singular.startsWith('Unlike learning spells, psionics are not guaranteed.')) ||
  (record.index === 319 && record.singular.startsWith('Powers have a chance to fail based on a number of factors.'));
const numericPercentages = text => [...text.matchAll(/\d+(?:\.\d+)?%/g)].map(match => match[0]).sort();
for (let part = 1; part <= 3; part++) {
  const chunkFile = `catalog-reconcile/output/current-source-gaps-${part}.json`;
  const translatedFile = `ja-current/part-${part}.json`;
  const chunkBytes = await readFile(chunkFile), translatedBytes = await readFile(translatedFile);
  if (part === 1) assert.equal(hash(translatedBytes), semanticRegistry.scope.inputSha256, 'reviewed registry/part-1 fingerprint changed');
  const chunk = JSON.parse(chunkBytes), translated = JSON.parse(translatedBytes);
  assert.ok(Array.isArray(translated.records), 'translator records missing');
  assert.equal(translated.records.length, chunk.records.length, 'incomplete translator part');
  const translatedMap = new Map(translated.records.map(record => [record.catalogKey, record]));
  assert.equal(translatedMap.size, chunk.records.length, 'duplicate translation key');
  for (const record of chunk.records) {
    const translation = translatedMap.get(record.catalogKey);
    assert.ok(translation, 'missing current key ' + record.catalogKey);
    for (const field of Object.keys(record)) assert.deepEqual(translation[field], record[field], 'source field changed: ' + field);
    assert.deepEqual(Object.keys(translation.translations), ['0']);
    const ja = translation.translations['0'];
    assert.ok(typeof ja === 'string' && ja.trim() && !ja.includes('\uFFFD'), 'empty or malformed translation');
    if (literalPercentHelp(record)) {
      assert.equal(record.sourceBindings.length, 1);
      assert.equal(record.sourceBindings[0].sourceFile, 'data/mods/MindOverMatter/help_files.json');
      assert.deepEqual(record.sourceBindings[0].jsonPointers, [record.index === 316 ? '/2/messages/4' : '/3/messages/1']);
      assert.deepEqual(numericPercentages(ja), numericPercentages(record.singular), 'literal probabilities changed');
      assert.equal((ja.match(/%/g) ?? []).length, numericPercentages(ja).length, 'format placeholder inserted in literal help');
      assert.equal((record.singular.match(/%/g) ?? []).length, numericPercentages(record.singular).length);
    } else {
      assert.deepEqual(printfSignature(ja).args, printfSignature(record.singular).args, 'printf arguments changed: ' + translation.semanticId);
    }
    assert.deepEqual(tags(ja), tags(record.singular), 'tags changed: ' + translation.semanticId);
    assert.deepEqual(braces(ja), braces(record.singular), 'braces changed: ' + translation.semanticId);
    assert.deepEqual(newlineRuns(ja), newlineRuns(record.singular), 'paragraphs changed: ' + translation.semanticId);
    assert.equal(/^[&*]/.exec(ja)?.[0] ?? '', /^[&*]/.exec(record.singular)?.[0] ?? '', 'dialogue action changed');
    assert.ok(typeof translation.semanticId === 'string' && translation.semanticId.trim() && !/\s/.test(translation.semanticId), 'invalid semantic ID');
    const normalizedTranslation = normalizeReviewedRecord(translation, semanticRegistry);
    assertTextId(normalizedTranslation.semanticId);
    assert.ok(!newSemanticIds.has(normalizedTranslation.semanticId), 'duplicate current semantic ID');
    newSemanticIds.add(normalizedTranslation.semanticId);
    assert.ok(!newByKey.has(record.catalogKey), 'duplicate across chunks');
    newByKey.set(record.catalogKey, normalizedTranslation);
  }
  fingerprints.push({ part, source_chunk_sha256: hash(chunkBytes), translation_sha256: hash(translatedBytes), records: chunk.records.length });
}
assert.equal(newByKey.size, 539);

const pairs = [{ original: '', translated: header.translations['0'] + '\nX-Jrogue-Source-Commit: ' + oldPatch.sourceCommit + '\nX-Jrogue-Current-Source-Keys: 105003\n' }];
const appliedOld = new Set(), appliedNew = new Set(), seen = new Set();
let count = 0, sourcePluralAlternatives = 0;
const inheritedWhitespaceFragments = [];
const normalizedPlurals = [];
for await (const line of createInterface({ input: createReadStream('catalog-reconcile/output/current-source-key-manifest.jsonl'), crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  const current = JSON.parse(line);
  const key = catalogKey(current.context, current.singular);
  assert.ok(!seen.has(key), 'duplicate current-source key');
  seen.add(key);
  let ja = current.ja;
  const patch = patchByKey.get(key), added = newByKey.get(key);
  if (patch) { ja = patch.translations['0']; appliedOld.add(key); }
  if (added) { assert.equal(current.catalogStatus, 'missing-source-key'); ja = added.translations['0']; appliedNew.add(key); }
  assert.ok(typeof ja === 'string' && ja.length > 0, 'untranslated current source: ' + key);
  if (!ja.trim()) {
    assert.ok(!patch && !added && ['The ', '  '].includes(current.singular) && current.context === '', 'unreviewed whitespace translation');
    inheritedWhitespaceFragments.push({ context: current.context, singular: current.singular, ja, references: current.references, reason: current.singular === 'The ' ? 'Existing Japanese article omission in a compositional monster message; Japanese has no English definite article.' : 'Existing intentional layout/dialogue spacing.' });
  }
  // Japanese has one form. Preserve the extractor's actual plural choice;
  // retain alternatives in evidence rather than inventing an English plural.
  const plural = current.plural;
  if (current.pluralVariants.length > 1) {
    sourcePluralAlternatives++;
    normalizedPlurals.push({ context: current.context, singular: current.singular, selected: plural, variants: current.pluralVariants, status: current.pluralSelectionStatus });
  }
  pairs.push({ original: (current.context ? current.context + '\x04' : '') + current.singular + (plural === null ? '' : '\0' + plural), translated: ja });
  count++;
}
assert.equal(count, 105003);
assert.equal(appliedOld.size, 163, 'stale reviewed source key must be excluded');
assert.equal(appliedNew.size, 539);
assert.equal(inheritedWhitespaceFragments.length, 2);
const mo = encodeMo(pairs);
const moPath = path.join(outputDir, 'lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo');
await mkdir(path.dirname(moPath), { recursive: true });
await writeFile(moPath, mo);
const quote = text => JSON.stringify(text);
const po = pairs.map(pair => {
  const contextual = pair.original.split('\x04');
  const original = contextual.at(-1).split('\0');
  return (contextual.length === 2 ? 'msgctxt ' + quote(contextual[0]) + '\n' : '') + 'msgid ' + quote(original[0]) + '\n' + (original.length === 2 ? 'msgid_plural ' + quote(original[1]) + '\nmsgstr[0] ' : 'msgstr ') + quote(pair.translated) + '\n';
}).join('\n');
await writeFile(path.join(outputDir, 'current-ja.po'), po);
await writeFile(path.join(outputDir, 'source-plural-alternatives.json'), JSON.stringify(normalizedPlurals, null, 2) + '\n');
await writeFile('ja-current/inherited-whitespace-fragments.json', JSON.stringify(inheritedWhitespaceFragments, null, 2) + '\n');
const entries = [...newByKey.values()].map(record => ({ index: record.index, semanticId: record.semanticId, context: record.context, singular: record.singular, plural: record.plural, pluralVariants: record.pluralVariants, translations: record.translations, sourceBindings: record.sourceBindings, references: record.references, ...(record.sourceCandidateIds ? { sourceCandidateIds: record.sourceCandidateIds } : {}) }));
const additionsDocument = normalizeAdditionsDocument({ schemaVersion: 1, sourceCommit: oldPatch.sourceCommit, language: 'ja', pluralForms: 'nplurals=1; plural=0;', scope: '539 individually reviewed current-source additions; not whole-game semantic-ID migration', records: entries }, semanticRegistry);
await writeFile('ja-current/reviewed-current-additions.json', JSON.stringify(additionsDocument, null, 2) + '\n');
for (const locale of ['en', 'ja']) {
  const localized = Object.fromEntries(entries.map(entry => [entry.semanticId, {
    context: entry.context,
    text: locale === 'ja' ? entry.translations['0'] : entry.singular,
    ...(locale === 'en' && entry.plural !== null ? { plural: entry.plural, pluralVariants: entry.pluralVariants } : {}),
    printfParameters: literalPercentHelp(entry) ? [] : printfSignature(entry.singular).args.map(([position, type]) => ({ position, type })),
  }]));
  const companionDocument = normalizeCompanionDocument({ schema_version: 1, locale, source_commit: oldPatch.sourceCommit, scope: '539 reviewed additions; gettext bridge not yet replaced by semantic calls', entries: localized }, semanticRegistry);
  await writeFile(`ja-current/${locale}.json`, JSON.stringify(companionDocument, null, 2) + '\n');
}
const pluralReviews = await load('catalog-reconcile/output/source-plural-reviews.json');
assert.equal(pluralReviews.records.length, 22);
await writeFile('ja-current/plural-reviews.json', JSON.stringify({ schema_version: 1, source_commit: oldPatch.sourceCommit, result: 'reviewed', scope: 'source-versus-catalog English plural metadata, unchanged invariant Japanese translations', records: pluralReviews.records.map(record => ({ ...record, decision: 'Keep the original Japanese item/monster term for all counts; compile current-source plural metadata and retain definition alternatives. No gameplay or upstream English JSON modification.', english_plural_semantic_migration_complete: false })) }, null, 2) + '\n');
const evidence = { schema_version: 1, result: 'pass', source_commit: oldPatch.sourceCommit, scope: 'all 105003 officially extracted current-source gettext keys; not unmarked/dynamic texts or full semantic-ID conversion', source_po_sha256: hash(sourceBytes), current_keys: count, binary_entries: pairs.length, untranslated_current_keys: 0, new_translations: appliedNew.size, old_reviewed_records_applied: appliedOld.size, stale_old_reviewed_records_excluded: 1, source_plural_alternative_keys: sourcePluralAlternatives, japanese_plural_forms: 1, new_translation_placeholder_mismatches: 0, new_unique_semantic_ids: newSemanticIds.size, reviewed_addition_text_id_grammar_valid: true, semantic_registry_mapping_sha256: registryMappingHash(semanticRegistry), semantic_registry_runtime_consumer_complete: false, whole_game_semantic_ids_complete: false, actual_game_consumer_verified: false, original_source_modified: false, mo_bytes: mo.length, mo_sha256: hash(mo), translators: fingerprints };
await writeFile(moPath + '.json', JSON.stringify(evidence, null, 2) + '\n');
await writeFile('ja-current/verification.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
