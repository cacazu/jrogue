'use strict';
const assert = require('node:assert/strict');

// Mirrors the engine's flag set and recognizes typed, positional and * args.
// It intentionally does not decide whether ordinary prose is a format string.
const spec = /^%(?:(\d+)\$)?([#0 +'\-I]*)(\d+|\*(?:\d+\$)?)?(?:\.(\d*|\*(?:\d+\$)?))?(hh|ll|h|l|j|z|t|L)?([diuoxXfFeEgGaAcspn%])/;
function printfSignature(text) {
  let next = 1;
  const args = [];
  const tokens = [];
  const unknownPercentOffsets = [];
  for (let offset = 0; offset < text.length; offset++) {
    if (text[offset] !== '%') continue;
    if (text[offset + 1] === '%') { offset++; continue; }
    const match = spec.exec(text.slice(offset));
    if (!match) { unknownPercentOffsets.push(offset); continue; }
    const [token, position, flags, width, precision, length = '', conversion] = match;
    tokens.push(token);
    const consumeStar = value => {
      if (!value || !value.startsWith('*')) return;
      const starPosition = /^\*(\d+)\$$/.exec(value);
      args.push([starPosition ? Number(starPosition[1]) : next++, 'signed:int']);
    };
    consumeStar(width);
    consumeStar(precision);
    if (conversion !== '%') {
      let type;
      if ('di'.includes(conversion)) type = 'signed:' + (length || 'int');
      else if ('uoxX'.includes(conversion)) type = 'unsigned:' + (length || 'int');
      else if ('fFeEgGaA'.includes(conversion)) type = length === 'L' ? 'long-double' : 'double';
      else if (conversion === 's') type = length === 'l' ? 'wide-string' : 'string';
      else if (conversion === 'c') type = length === 'l' ? 'wide-character' : 'character';
      else if (conversion === 'p') type = 'pointer';
      else type = 'write-count-pointer:' + (length || 'int');
      args.push([position ? Number(position) : next++, type]);
    }
    offset += token.length - 1;
  }
  args.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  return { args, tokens, unknownPercentOffsets };
}
const angleTags = text => [...text.matchAll(/<([^<>\n]+)>/g)].map(x => x[1]).sort();
const braceTokens = text => [...text.matchAll(/\{[^{}\n]+\}/g)].map(x => x[0]).sort();
const actionPrefix = text => /^[&*]/.test(text) ? text[0] : '';
const stars = text => (text.match(/\*/g) || []).length;
const paragraphs = text => (text.match(/\n\n/g) || []).length;
function checkText(record, source) {
  const text = record.translations['0'];
  assert.equal(typeof text, 'string', record.semanticId + ': translation type');
  assert.ok(text.trim(), record.semanticId + ': empty translation');
  assert.ok(!text.includes('\uFFFD'), record.semanticId + ': replacement character');
  assert.deepEqual(angleTags(text), angleTags(source.singular), record.semanticId + ': exact tags, including multiplicity');
  assert.deepEqual(braceTokens(text), braceTokens(source.singular), record.semanticId + ': brace placeholders');
  assert.equal(actionPrefix(text), actionPrefix(source.singular), record.semanticId + ': leading dialogue marker');
  assert.equal(stars(text), stars(source.singular), record.semanticId + ': asterisk markup count');
  assert.equal(paragraphs(text), paragraphs(source.singular), record.semanticId + ': paragraph breaks');
  assert.equal((text.match(/\n/g) || []).length, (source.singular.match(/\n/g) || []).length,
    record.semanticId + ': intentional line breaks');
  const basis = record.validationBasis || 'singular';
  if (basis === 'literal-percent-prose') {
    assert.equal(record.auditGroup, 'rejected');
    assert.equal(record.auditIndex, 13, 'Only audited help prose may use this annotation');
    assert.deepEqual(source.references, ['data/mods/MindOverMatter/help_files.json'],
      'Literal-percent exception must be the individually reviewed unformatted help field');
    assert.ok(source.singular.startsWith('Unlike learning spells, psionics are not guaranteed.'),
      'Literal-percent exception must retain the exact audited prose identity');
    assert.deepEqual([...text.matchAll(/\d+(?:\.\d+)?%/g)].map(x => x[0]).sort(),
      [...source.singular.matchAll(/\d+(?:\.\d+)?%/g)].map(x => x[0]).sort(), 'Preserve literal percentages');
    assert.equal((text.match(/%/g) || []).length,
      [...text.matchAll(/\d+(?:\.\d+)?%/g)].length,
      'Literal-percent exception cannot add a format placeholder');
    return;
  }
  assert.ok(['singular', 'plural'].includes(basis), 'Unrecognized format validation basis');
  if (basis === 'plural') {
    assert.equal(record.auditGroup, 'rejected');
    assert.ok([2, 4, 5].includes(record.auditIndex), 'Only source-inspected call sites may use plural validation');
    assert.equal(typeof source.plural, 'string');
    assert.ok(record.review.explanation.includes('supplies') || record.review.explanation.includes('passes'),
      'Plural validation must document supplied arguments');
  }
  const original = printfSignature(basis === 'plural' ? source.plural : source.singular);
  const translated = printfSignature(text);
  assert.deepEqual(translated.args, original.args, record.semanticId + ': typed positional printf arguments');
  if (source.flags.includes('c-format')) {
    assert.equal(translated.unknownPercentOffsets.length, 0, record.semanticId + ': invalid percent in format text');
  }
  // Preserve the specific upstream apostrophe token; the engine accepts it.
  if (record.auditGroup === 'rejected' && record.auditIndex === 14) {
    assert.ok(text.includes("%1$'s"), 'Source apostrophe flag must remain exact');
  }
  if (source.singular.includes('[$400]')) assert.ok(text.includes('[$400]'), 'Fixed payment annotation changed');
}

function checkCatalog(patch, audits) {
  assert.equal(patch.schemaVersion, 1);
  assert.equal(patch.language, 'ja');
  assert.equal(patch.pluralForms, 'nplurals=1; plural=0;');
  assert.equal(patch.runtimeConnected, false, 'Standalone patch must not claim runtime integration');
  const identities = new Set();
  const seen = { missing: new Set(), rejected: new Set() };
  const counts = { missing: 0, rejected: 0, actualPlaceholderRepairs: 0, pluralReviews: 0, literalPercentReviews: 0 };
  for (const record of patch.records) {
    assert.ok(/^[a-z][a-z0-9_.]+$/.test(record.semanticId), 'Invalid semantic ID');
    assert.ok(!identities.has(record.semanticId), 'Duplicate semantic ID: ' + record.semanticId);
    identities.add(record.semanticId);
    assert.ok(Object.hasOwn(audits, record.auditGroup), 'Unknown audit group');
    assert.ok(Number.isInteger(record.auditIndex), 'Non-integer audit index');
    assert.ok(!seen[record.auditGroup].has(record.auditIndex), 'Duplicate audit row');
    seen[record.auditGroup].add(record.auditIndex);
    const source = audits[record.auditGroup].entries[record.auditIndex];
    assert.ok(source, 'Out-of-range audit row');
    assert.equal(record.catalogKey, source.catalogKey, 'Catalog key changed');
    assert.equal(record.context, source.context, 'Context changed');
    assert.equal(record.singular, source.singular, 'English singular changed');
    assert.equal(record.plural, source.plural, 'English plural changed');
    assert.deepEqual(record.originalTranslations, source.translations, 'Original translations changed');
    assert.deepEqual(record.references, source.references, 'Source references changed');
    assert.deepEqual(record.flags, source.flags, 'Source flags changed');
    assert.deepEqual(record.comments, source.comments, 'Translator comments changed');
    assert.equal(record.poLine, source.line, 'PO source line changed');
    assert.deepEqual(Object.keys(record.translations), ['0'], 'Japanese has precisely one form');
    assert.ok(record.review.explanation && record.review.explanation.trim(), 'Review explanation missing');
    checkText(record, source);
    counts[record.auditGroup]++;
    if (record.auditGroup === 'rejected') {
      if (record.validationBasis === 'plural') counts.pluralReviews++;
      else if (record.validationBasis === 'literal-percent-prose') counts.literalPercentReviews++;
      else counts.actualPlaceholderRepairs++;
    }
  }
  for (const [group, expected] of [['missing', 142], ['rejected', 22]]) {
    assert.equal(audits[group].count, expected, group + ': unexpected audit inventory');
    assert.equal(audits[group].entries.length, expected, group + ': audit count disagreement');
    assert.equal(seen[group].size, expected, group + ': exhaustive coverage');
    for (let i = 0; i < expected; i++) assert.ok(seen[group].has(i), group + ': missing row ' + i);
  }
  assert.equal(patch.records.length, 164);
  assert.equal(counts.actualPlaceholderRepairs, 18);
  assert.equal(counts.pluralReviews, 3);
  assert.equal(counts.literalPercentReviews, 1);
  assert.deepEqual(patch.counts, counts, 'Declared summary differs from validation');
  return counts;
}
module.exports = { printfSignature, angleTags, checkText, checkCatalog };
