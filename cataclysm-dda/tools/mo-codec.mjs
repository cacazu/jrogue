import assert from 'node:assert/strict';

/** GNU gettext revision-zero little-endian catalog; strings are UTF-8. */
export function encodeMo(entries) {
  const pairs = entries.map(entry => ({ original: Buffer.from(entry.original), translated: Buffer.from(entry.translated) }));
  pairs.sort((a, b) => Buffer.compare(a.original, b.original));
  for (let i = 1; i < pairs.length; i++) assert.ok(!pairs[i - 1].original.equals(pairs[i].original), 'duplicate MO key');
  const count = pairs.length, originalTable = 28, translatedTable = 28 + count * 8;
  let size = 28 + count * 16;
  const originalOffsets = pairs.map(pair => { const offset = size; size += pair.original.length + 1; return offset; });
  const translatedOffsets = pairs.map(pair => { const offset = size; size += pair.translated.length + 1; return offset; });
  assert.ok(size <= 0xffffffff, 'MO offset overflow');
  const result = Buffer.alloc(size);
  for (const [offset, value] of [[0, 0x950412de], [4, 0], [8, count], [12, originalTable], [16, translatedTable], [20, 0], [24, 0]]) result.writeUInt32LE(value, offset);
  pairs.forEach((pair, i) => {
    result.writeUInt32LE(pair.original.length, originalTable + i * 8);
    result.writeUInt32LE(originalOffsets[i], originalTable + i * 8 + 4);
    result.writeUInt32LE(pair.translated.length, translatedTable + i * 8);
    result.writeUInt32LE(translatedOffsets[i], translatedTable + i * 8 + 4);
    pair.original.copy(result, originalOffsets[i]);
    pair.translated.copy(result, translatedOffsets[i]);
  });
  const decoded = decodeMo(result);
  assert.equal(decoded.length, pairs.length);
  decoded.forEach((pair, i) => {
    assert.equal(pair.original, pairs[i].original.toString('utf8'));
    assert.equal(pair.translated, pairs[i].translated.toString('utf8'));
  });
  return result;
}

/** Read tables from the binary, independently of the writer's offset lists. */
export function decodeMo(bytes) {
  assert.ok(bytes.length >= 28, 'short MO header');
  assert.equal(bytes.readUInt32LE(0), 0x950412de, 'unsupported MO byte order');
  assert.equal(bytes.readUInt32LE(4), 0, 'unsupported MO revision');
  const count = bytes.readUInt32LE(8), originals = bytes.readUInt32LE(12), translations = bytes.readUInt32LE(16);
  assert.ok(originals + count * 8 <= bytes.length && translations + count * 8 <= bytes.length, 'MO table outside file');
  function string(table, index) {
    const length = bytes.readUInt32LE(table + index * 8), offset = bytes.readUInt32LE(table + index * 8 + 4);
    assert.ok(offset + length < bytes.length && bytes[offset + length] === 0, 'MO string outside file or unterminated');
    return bytes.subarray(offset, offset + length).toString('utf8');
  }
  return Array.from({ length: count }, (_, index) => ({ original: string(originals, index), translated: string(translations, index) }));
}
