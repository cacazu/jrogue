import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodeMo } from './mo-codec.mjs';
import { parsePo } from '../inventory-tools/inventory.mjs';

const [moFile, gnuPoFile, evidenceFile] = process.argv.slice(2);
if (!moFile || !gnuPoFile || !evidenceFile) throw new Error('usage: node verify-gettext-roundtrip.mjs MO GNU_MSGUNFMT_PO EVIDENCE_JSON');
const moBytes = await readFile(moFile), poBytes = await readFile(gnuPoFile);
const pairs = decodeMo(moBytes);
const po = parsePo(poBytes.toString('utf8'), gnuPoFile);
assert.equal(po.errors.length, 0);
assert.equal(po.language, 'ja');
assert.equal(po.nplurals, 1);
const consumerPairs = new Map(po.entries.filter(entry => !entry.obsolete).map(entry => [
  (entry.context ? entry.context + '\x04' : '') + entry.singular + (entry.plural === null ? '' : '\0' + entry.plural),
  Object.entries(entry.translations).sort(([a], [b]) => Number(a) - Number(b)).map(([, text]) => text).join('\0'),
]));
assert.equal(consumerPairs.size, pairs.length, 'independent consumer entry count mismatch');
for (const pair of pairs) assert.equal(consumerPairs.get(pair.original), pair.translated, 'independent gettext consumer string mismatch');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const result = { schema_version: 1, result: 'pass', independent_consumer: 'GNU msgunfmt 0.22', all_original_and_translation_strings_equal: true, binary_entries: pairs.length, japanese_plural_forms: po.nplurals, mo_sha256: sha256(moBytes), gnu_po_sha256: sha256(poBytes), actual_game_consumer_verified: false };
await writeFile(evidenceFile, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
