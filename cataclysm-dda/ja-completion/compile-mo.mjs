import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parsePo, catalogKey } from '../inventory-tools/inventory.mjs';

const [sourcePo, patchFile, outputMo] = process.argv.slice(2);
if (!sourcePo || !patchFile || !outputMo) throw new Error('usage: node compile-mo.mjs SOURCE_JA_PO REVIEWED_PATCH_JSON OUTPUT_MO');
const sourceBytes = await readFile(sourcePo);
const patchBytes = await readFile(patchFile);
const patches = JSON.parse(patchBytes.toString('utf8').replace(/^\uFEFF/, ''));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha256(sourceBytes) !== patches.sourceCatalog.sha256) throw new Error('pristine catalog identity mismatch');
const parsed = parsePo(sourceBytes.toString('utf8'), 'lang/po/ja.po');
if (parsed.errors.length || parsed.language !== 'ja' || parsed.nplurals !== 1) throw new Error('invalid Japanese source catalog');
const byKey = new Map(patches.records.map(record => [record.catalogKey, record]));
if (byKey.size !== patches.records.length) throw new Error('duplicate reviewed patch keys');
const applied = new Set();
const pairs = [];
for (const entry of parsed.entries) {
  if (entry.obsolete || entry.flags.includes('fuzzy')) continue;
  const key = catalogKey(entry.context, entry.singular);
  const patch = byKey.get(key);
  let forms = entry.translations;
  if (patch) {
    if (entry.plural !== patch.plural || JSON.stringify(entry.translations) !== JSON.stringify(patch.originalTranslations)) throw new Error('reviewed patch no longer matches source entry: ' + patch.semanticId);
    forms = patch.translations;
    applied.add(key);
  }
  const values = Object.keys(forms).sort((a, b) => Number(a) - Number(b)).map(form => forms[form]);
  if (entry.singular && (values.length !== 1 || values.some(value => !value))) throw new Error('empty or incomplete active Japanese entry: ' + key);
  if (values.length === 0) continue;
  const original = (entry.context ? entry.context + '\x04' : '') + entry.singular + (entry.plural === null ? '' : '\0' + entry.plural);
  if (entry.singular === '') {
    values[0] += '\nX-Jrogue-Source-Commit: ' + patches.sourceCommit + '\nX-Jrogue-Reviewed-Patches: ' + patches.records.length + '\n';
  }
  pairs.push({ original: Buffer.from(original, 'utf8'), translated: Buffer.from(values.join('\0'), 'utf8') });
}
if (applied.size !== byKey.size) throw new Error('reviewed source patch key not found');
pairs.sort((a, b) => Buffer.compare(a.original, b.original));
for (let i = 1; i < pairs.length; i++) if (pairs[i - 1].original.equals(pairs[i].original)) throw new Error('duplicate GNU MO original key');
const count = pairs.length, originalTable = 28, translatedTable = 28 + count * 8;
let size = 28 + count * 16;
const originalOffsets = pairs.map(pair => { const offset = size; size += pair.original.length + 1; return offset; });
const translatedOffsets = pairs.map(pair => { const offset = size; size += pair.translated.length + 1; return offset; });
if (size > 0xffffffff) throw new Error('GNU MO size exceeds 32-bit offsets');
const mo = Buffer.alloc(size);
for (const [offset, value] of [[0, 0x950412de], [4, 0], [8, count], [12, originalTable], [16, translatedTable], [20, 0], [24, 0]]) mo.writeUInt32LE(value, offset);
pairs.forEach((pair, i) => {
  mo.writeUInt32LE(pair.original.length, originalTable + i * 8);
  mo.writeUInt32LE(originalOffsets[i], originalTable + i * 8 + 4);
  mo.writeUInt32LE(pair.translated.length, translatedTable + i * 8);
  mo.writeUInt32LE(translatedOffsets[i], translatedTable + i * 8 + 4);
  pair.original.copy(mo, originalOffsets[i]);
  pair.translated.copy(mo, translatedOffsets[i]);
});
// Validate the actual generated binary independently from its offset lists.
for (let i = 0; i < count; i++) {
  const readString = table => {
    const length = mo.readUInt32LE(table + i * 8), offset = mo.readUInt32LE(table + i * 8 + 4);
    if (offset + length >= mo.length || mo[offset + length] !== 0) throw new Error('invalid GNU MO string extent');
    return mo.subarray(offset, offset + length);
  };
  if (!readString(mo.readUInt32LE(12)).equals(pairs[i].original) || !readString(mo.readUInt32LE(16)).equals(pairs[i].translated)) throw new Error('GNU MO binary round-trip mismatch');
}
await mkdir(path.dirname(outputMo), { recursive: true });
await writeFile(outputMo, mo);
const evidence = { schema_version: 1, result: 'pass', scope: 'patched immutable upstream Japanese PO compiled to GNU MO; not whole-game semantic ID migration or runtime coverage', source_commit: patches.sourceCommit, source_po_sha256: sha256(sourceBytes), reviewed_patch_sha256: sha256(patchBytes), mo_sha256: sha256(mo), mo_bytes: mo.length, binary_entries: count, active_messages: count - 1, reviewed_records_applied: applied.size, empty_active_entries: 0, binary_round_trip_entries: count, original_po_modified: false, current_source_drift_remaining: true };
await writeFile(outputMo + '.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
