// A Node verification model of the inspected Rust parser, not a Rust consumer.
import assert from 'node:assert/strict';

// Use an explicit absolute end assertion and exactly Rust's ASCII alphabet.
export const ID_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*(?![\s\S])/;
export const PARAMETER_PATTERN = /^[a-z][a-z0-9_]*(?![\s\S])/;
export function validId(id) {
  return typeof id === 'string' && Buffer.byteLength(id, 'utf8') <= 160 && ID_PATTERN.test(id);
}
export function literalTemplate(text) {
  assert.equal(typeof text, 'string');
  return text.replace(/[{}]/g, character => character + character);
}
export function tokenize(template) {
  assert.equal(typeof template, 'string');
  const characters = [...template], tokens = [];
  let literal = '';
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index];
    if ((character === '{' || character === '}') && characters[index + 1] === character) {
      literal += character;
      index++;
    } else if (character === '{') {
      if (literal) tokens.push({literal});
      literal = '';
      let name = '', closed = false;
      while (++index < characters.length) {
        if (characters[index] === '}') { closed = true; break; }
        name += characters[index];
      }
      assert.ok(closed && PARAMETER_PATTERN.test(name), 'invalid named placeholder');
      tokens.push({parameter: name});
    } else {
      assert.notEqual(character, '}', 'unmatched closing brace');
      literal += character;
    }
  }
  if (literal) tokens.push({literal});
  return tokens;
}
function object(value, label) {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), label);
}
function allowedFields(value, allowed, label) {
  for (const name of Object.keys(value)) assert.ok(allowed.includes(name), `${label}: unknown field ${name}`);
}
function placeholders(template, parameters) {
  const actual = [...new Set(tokenize(template).filter(t => 'parameter' in t).map(t => t.parameter))].sort();
  assert.deepEqual(actual, Object.keys(parameters).sort(), 'placeholder/schema mismatch');
}
function validUnicode(text) {
  // A Rust String cannot contain unpaired UTF-16 surrogate escapes, although
  // JavaScript JSON.parse accepts them. Supplementary character pairs remain
  // valid because iteration yields their full Unicode code point.
  return [...text].every(character => {
    const point = character.codePointAt(0);
    return point < 0xd800 || point > 0xdfff;
  });
}
export function validateCatalog(catalog) {
  object(catalog, 'catalog');
  allowedFields(catalog, ['schema_version', 'locale', 'entries'], 'RawCatalog');
  assert.equal(catalog.schema_version, 1);
  assert.ok(catalog.locale === 'en' || catalog.locale === 'ja');
  object(catalog.entries, 'entries');
  for (const [id, entry] of Object.entries(catalog.entries)) {
    assert.ok(validId(id), `invalid TextId: ${id}`);
    object(entry, id);
    allowedFields(entry, ['parameters', 'plural_parameter', 'one', 'other'], 'RawEntry');
    object(entry.parameters, 'parameters');
    assert.equal(typeof entry.other, 'string');
    assert.ok(validUnicode(entry.other), 'unpaired surrogate unsupported by Rust String');
    for (const [name, kind] of Object.entries(entry.parameters)) {
      assert.ok(PARAMETER_PATTERN.test(name), 'invalid parameter name');
      assert.ok(['user_text', 'count', 'term'].includes(kind), 'unknown ParameterKind');
    }
    const one = entry.one ?? null, plural = entry.plural_parameter ?? null;
    assert.ok(one === null || typeof one === 'string');
    if (one !== null) assert.ok(validUnicode(one), 'unpaired surrogate unsupported by Rust String');
    assert.ok(plural === null || typeof plural === 'string');
    if (catalog.locale === 'ja') assert.ok(one === null && plural === null, 'Japanese count is invariant');
    if (plural !== null) assert.ok(entry.parameters[plural] === 'count' && one !== null, 'plural selector requires Count and one');
    placeholders(entry.other, entry.parameters);
    if (one !== null) placeholders(one, entry.parameters);
  }
  return true;
}
export function renderLiteralEntry(entry) {
  assert.deepEqual(entry.parameters, {});
  assert.ok(!('one' in entry) && !('plural_parameter' in entry));
  return tokenize(entry.other).map(token => {
    assert.ok('literal' in token, 'literal profile accidentally emitted a parameter');
    return token.literal;
  }).join('');
}
