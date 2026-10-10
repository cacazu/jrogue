// SPDX-License-Identifier: GPL-2.0-only
// Lightweight contract/adversarial tests and an executable Pascal harness.
// Node runs a reference oracle and verifies Pascal/FCL source contracts. It does
// not execute Pascal. Compile/run the emitted harness after the heavy-job hold.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(directory);
const limits = { records: 256, params: 16, text: 32768, json: 1048576, depth: 8, tokens: 100000 };
const catalog = new Map([
  ['feeling.test.quiet', { english: 'Quiet.', japanese: '静かだ。', params: {} }],
  ['feeling.test.count', { english: '{{count}} shadows.', japanese: '{{count}}体の影。', params: { count: 'integer' } }],
  ['feeling.test.name', { english: '{{name}} waits.', japanese: '{{name}}が待っている。', params: { name: 'string' } }],
]);
const clone = value => structuredClone(value);
const bytes = value => Buffer.byteLength(value, 'utf8');
function text(value, limit = limits.text) {
  assert.equal(typeof value, 'string');
  assert.ok(bytes(value) <= limit);
  for (const character of value) {
    const point = character.codePointAt(0);
    assert.ok(point !== 0 && !(point >= 0xd800 && point <= 0xdfff));
  }
  return value;
}
function name(value, id = false) {
  assert.equal(typeof value, 'string');
  assert.ok(value.length > 0 && value.length <= (id ? 160 : 64));
  assert.match(value, id ? /^[a-z][a-z0-9_.-]*$/ : /^[a-z][a-z0-9_]*$/);
}
function integer(value) {
  assert.match(value, /^(?:0|-[1-9][0-9]*|[1-9][0-9]*)$/);
  const number = BigInt(value);
  assert.ok(number >= -9223372036854775808n && number <= 9223372036854775807n);
  assert.equal(number.toString(), value);
}
function fields(value, expected) {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}
function render(template, params) {
  const byName = new Map(params.map(param => [param.name, param.value]));
  const used = new Set();
  const result = template.replace(/\{\{([^{}]+)\}\}/g, (_, key) => {
    name(key);
    assert.ok(byName.has(key));
    used.add(key);
    return byName.get(key);
  });
  assert.ok(!template.includes('{{') || used.size > 0);
  assert.equal(used.size, byName.size);
  return text(result);
}
function validateRecord(record, validator = catalog) {
  fields(record, ['id', 'english', 'joinBefore', 'params']);
  name(record.id, true);
  text(record.english); text(record.joinBefore);
  assert.ok(Array.isArray(record.params) && record.params.length <= limits.params);
  assert.ok(validator instanceof Map && validator.has(record.id));
  const known = validator.get(record.id);
  assert.equal(record.english, known.english);
  const seen = new Set();
  let retained = bytes(record.id) + bytes(record.english) + bytes(record.joinBefore);
  for (const param of record.params) {
    fields(param, ['name', 'kind', 'value']);
    name(param.name); text(param.value);
    assert.ok(!seen.has(param.name)); seen.add(param.name);
    assert.ok(param.kind === 'string' || param.kind === 'integer');
    assert.equal(param.kind, known.params[param.name]);
    if (param.kind === 'integer') integer(param.value);
    retained += bytes(param.name) + bytes(param.value);
  }
  assert.deepEqual([...seen].sort(), Object.keys(known.params).sort());
  assert.ok(retained <= limits.text);
  return { retained, english: render(record.english, record.params), known };
}
function validateRecords(records, guard, validator) {
  text(guard);
  assert.ok(Array.isArray(records) && records.length <= limits.records);
  assert.ok(validator instanceof Map);
  let retained = 0, cumulative = '';
  for (const record of records) {
    const checked = validateRecord(record, validator);
    retained += checked.retained;
    assert.ok(retained <= limits.text);
    cumulative = text(cumulative + record.joinBefore + checked.english);
  }
  assert.equal(cumulative, guard);
  return retained;
}

// Separate strict JSON oracle retains numeric lexemes for schema 1 vs 1.0,
// rejects duplicate keys (including escaped aliases) and bounded recursion.
class NumberToken { constructor(raw) { this.raw = raw; } }
function strictJSON(data) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  assert.ok(buffer.length > 0 && buffer.length <= limits.json);
  const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
  text(source, limits.json);
  let offset = 0, tokens = 0;
  const tick = () => assert.ok(++tokens <= limits.tokens);
  const whitespace = () => { while (/[ \t\r\n]/.test(source[offset] ?? '\0')) offset++; };
  const consume = expected => { whitespace(); assert.equal(source[offset++], expected); tick(); };
  function string() {
    whitespace(); assert.equal(source[offset], '"');
    const start = offset++;
    while (offset < source.length) {
      const character = source[offset++];
      if (character === '\\') { assert.ok(offset < source.length); offset++; }
      else if (character === '"') { tick(); return text(JSON.parse(source.slice(start, offset))); }
    }
    throw new Error('Unterminated string');
  }
  function value(depth) {
    whitespace(); tick();
    const character = source[offset];
    if (character === '"') return string();
    if (character === '{') {
      assert.ok(depth < limits.depth); consume('{');
      const object = Object.create(null), keys = new Set();
      whitespace();
      if (source[offset] === '}') { consume('}'); return object; }
      while (true) {
        const key = string(); assert.ok(!keys.has(key)); keys.add(key);
        consume(':'); object[key] = value(depth + 1); whitespace();
        if (source[offset] === '}') { consume('}'); return object; }
        consume(',');
      }
    }
    if (character === '[') {
      assert.ok(depth < limits.depth); consume('[');
      const array = []; whitespace();
      if (source[offset] === ']') { consume(']'); return array; }
      while (true) {
        array.push(value(depth + 1)); whitespace();
        if (source[offset] === ']') { consume(']'); return array; }
        consume(',');
      }
    }
    for (const literal of ['true', 'false', 'null']) {
      if (source.slice(offset, offset + literal.length) === literal) {
        offset += literal.length; return JSON.parse(literal);
      }
    }
    const match = source.slice(offset).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    assert.ok(match); offset += match[0].length;
    return new NumberToken(match[0]);
  }
  const result = value(0); whitespace(); assert.equal(offset, source.length);
  return result;
}

class FeelingOracle {
  constructor() { this.validator = catalog; this.resolver = known => known.japanese; this.clear(); }
  clear() { this.records = []; this.guard = ''; this.retained = 0; this.usable = true; }
  remember(record, guard) {
    if (!this.usable) return false;
    this.usable = false;
    try {
      const candidate = clone(record);
      const checked = validateRecord(candidate, this.validator);
      assert.ok(this.records.length < limits.records);
      text(guard); assert.ok(this.retained + checked.retained <= limits.text);
      assert.equal(text(this.guard + candidate.joinBefore + checked.english), guard);
      this.records.push(candidate); this.guard = guard; this.retained += checked.retained;
      return this.usable = true;
    } catch { return false; }
  }
  repeat(guard) {
    try {
      assert.ok(this.usable); assert.equal(this.guard, guard);
      validateRecords(this.records, guard, this.validator);
      let result = '';
      for (const record of this.records) {
        const known = this.validator.get(record.id);
        const template = this.resolver ? this.resolver(known) : record.english;
        result = text(result + record.joinBefore + render(template, record.params));
      }
      return result;
    } catch { return guard; }
  }
  save() {
    assert.ok(this.usable); validateRecords(this.records, this.guard, this.validator);
    return JSON.stringify({ schema: 1, format: 'drl.semantic-feelings', englishGuard: this.guard, records: this.records });
  }
  load(data, expectedGuard) {
    this.usable = false;
    try {
      const candidate = strictJSON(data);
      fields(candidate, ['schema', 'format', 'englishGuard', 'records']);
      assert.ok(candidate.schema instanceof NumberToken && candidate.schema.raw === '1');
      assert.equal(candidate.format, 'drl.semantic-feelings');
      text(expectedGuard); assert.equal(candidate.englishGuard, expectedGuard);
      const retained = validateRecords(candidate.records, expectedGuard, this.validator);
      this.records = candidate.records; this.guard = expectedGuard; this.retained = retained;
      return this.usable = true;
    } catch { return false; }
  }
}

const quiet = () => ({ id: 'feeling.test.quiet', english: 'Quiet.', joinBefore: '', params: [] });
const count = value => ({ id: 'feeling.test.count', english: '{{count}} shadows.', joinBefore: ' ', params: [{ name: 'count', kind: 'integer', value }] });
const named = value => ({ id: 'feeling.test.name', english: '{{name}} waits.', joinBefore: '', params: [{ name: 'name', kind: 'string', value }] });
const cases = [];
function test(label, callback) { callback(); cases.push(label); }

test('deep copies, cumulative English guard, presentation language switching, no recursive parameters', () => {
  const oracle = new FeelingOracle(), record = quiet();
  assert.equal(oracle.remember(record, 'Quiet.'), true);
  record.english = 'tampered';
  assert.equal(oracle.remember(count('3'), 'Quiet. 3 shadows.'), true);
  assert.equal(oracle.repeat('Quiet. 3 shadows.'), '静かだ。 3体の影。');
  oracle.resolver = null;
  assert.equal(oracle.repeat('Quiet. 3 shadows.'), 'Quiet. 3 shadows.');
  assert.equal(oracle.repeat('different level'), 'different level');
  oracle.clear(); oracle.resolver = known => known.japanese;
  assert.equal(oracle.remember(named('ユーザー{{count}}'), 'ユーザー{{count}} waits.'), true);
  assert.equal(oracle.repeat('ユーザー{{count}} waits.'), 'ユーザー{{count}}が待っている。');
});
test('JSON round trip, Int64 extrema, escapes, multiline, astral Unicode and preserved external names', () => {
  for (const value of ['-9223372036854775808', '9223372036854775807', '0']) {
    const oracle = new FeelingOracle();
    const record = count(value); record.joinBefore = '';
    assert.equal(oracle.remember(record, `${value} shadows.`), true);
    const serialized = oracle.save();
    assert.equal(typeof JSON.parse(serialized).records[0].params[0].value, 'string');
    oracle.clear(); assert.equal(oracle.load(serialized, `${value} shadows.`), true);
    assert.equal(oracle.repeat(`${value} shadows.`), `${value}体の影。`);
  }
  const oracle = new FeelingOracle(), value = 'Cacazu "quoted"\\path\n日本語 🐉';
  assert.equal(oracle.remember(named(value), `${value} waits.`), true);
  const serialized = oracle.save(); oracle.clear();
  assert.equal(oracle.load(serialized, `${value} waits.`), true);
  assert.equal(oracle.repeat(`${value} waits.`), `${value}が待っている。`);
});

const invalidRecords = [
  ['unknown ID', record => { record.id = 'feeling.unknown'; }],
  ['invalid ID', record => { record.id = 'Feeling.test.quiet'; }],
  ['wrong English guard template', record => { record.english = 'quiet.'; }],
  ['unknown parameter', record => { record.params.push({ name: 'extra', kind: 'string', value: 'x' }); }],
  ['duplicate parameter', record => { record.params.push(clone(record.params[0])); }],
  ['wrong named parameter', record => { record.params[0].name = 'amount'; }],
  ['wrong typed parameter', record => { record.params[0].kind = 'string'; }],
  ['unknown typed parameter', record => { record.params[0].kind = 'float'; }],
  ['numeric JSON value', record => { record.params[0].value = 3; }],
  ['noncanonical plus', record => { record.params[0].value = '+3'; }],
  ['noncanonical zero prefix', record => { record.params[0].value = '03'; }],
  ['noncanonical negative zero', record => { record.params[0].value = '-0'; }],
  ['noncanonical exponent', record => { record.params[0].value = '3e0'; }],
  ['noncanonical whitespace', record => { record.params[0].value = ' 3'; }],
  ['Int64 positive overflow', record => { record.params[0].value = '9223372036854775808'; }],
  ['Int64 negative overflow', record => { record.params[0].value = '-9223372036854775809'; }],
  ['NUL value', record => { record.params[0].value = '3\0'; }],
  ['invalid UTF-16 surrogate value', record => { record.params[0].value = '\ud800'; }],
  ['oversized value', record => { record.params[0].value = 'x'.repeat(32769); }],
  ['too many parameters', record => { record.params = Array.from({ length: 17 }, (_, index) => ({ name: `p${index}`, kind: 'string', value: '' })); }],
  ['unknown field', record => { record.untrusted = true; }],
];
for (const [label, mutate] of invalidRecords) test(`reject ${label}; failed load cannot replay stale records`, () => {
  const oracle = new FeelingOracle(); oracle.remember(quiet(), 'Quiet.');
  oracle.remember(count('3'), 'Quiet. 3 shadows.');
  const snapshot = JSON.parse(oracle.save()); mutate(snapshot.records[1]);
  const prior = clone(oracle.records);
  assert.equal(oracle.load(JSON.stringify(snapshot), 'Quiet. 3 shadows.'), false);
  assert.deepEqual(oracle.records, prior); // No partial candidate commit.
  assert.equal(oracle.repeat('Quiet. 3 shadows.'), 'Quiet. 3 shadows.');
});

test('remember mismatch, missing validator and invalid record disable a matching prior prefix', () => {
  const oracle = new FeelingOracle(); oracle.remember(quiet(), 'Quiet.');
  assert.equal(oracle.remember(count('3'), 'wrong cumulative guard'), false);
  assert.equal(oracle.repeat('Quiet.'), 'Quiet.');
  assert.equal(oracle.remember(count('3'), 'Quiet. 3 shadows.'), false);
  oracle.clear(); oracle.validator = null;
  assert.equal(oracle.remember(quiet(), 'Quiet.'), false);
  assert.equal(oracle.repeat('Quiet.'), 'Quiet.');
  assert.equal(oracle.load(JSON.stringify({ schema: 1, format: 'drl.semantic-feelings', englishGuard: '', records: [] }), ''), false);
});
test('leading joins are original data, empty snapshot round trips, resolver exceptions and malformed output fall back', () => {
  const oracle = new FeelingOracle();
  const record = quiet(); record.joinBefore = ' ';
  assert.equal(oracle.remember(record, ' Quiet.'), true);
  assert.equal(oracle.repeat(' Quiet.'), ' 静かだ。');
  oracle.resolver = () => { throw new Error('render failure'); };
  assert.equal(oracle.repeat(' Quiet.'), ' Quiet.');
  oracle.resolver = () => '\0'; assert.equal(oracle.repeat(' Quiet.'), ' Quiet.');
  oracle.clear(); const empty = oracle.save();
  assert.equal(oracle.load(empty, ''), true); assert.equal(oracle.repeat(''), '');
});

const baseline = JSON.stringify({ schema: 1, format: 'drl.semantic-feelings', englishGuard: 'Quiet.', records: [quiet()] });
const invalidJSON = [
  ['unknown schema', baseline.replace('"schema":1', '"schema":2')],
  ['floating schema', baseline.replace('"schema":1', '"schema":1.0')],
  ['string schema', baseline.replace('"schema":1', '"schema":"1"')],
  ['unknown format', baseline.replace('drl.semantic-feelings', 'other-format')],
  ['duplicate schema', baseline.replace('"schema":1', '"schema":1,"schema":1')],
  ['escaped duplicate schema', baseline.replace('"schema":1', '"schema":1,"sch\\u0065ma":1')],
  ['duplicate nested field', baseline.replace('"id":"feeling.test.quiet"', '"id":"feeling.test.quiet","id":"feeling.test.quiet"')],
  ['unexpected root field', baseline.replace('"schema":1', '"schema":1,"extra":null')],
  ['missing root field', baseline.replace('"schema":1,', '')],
  ['appended root', baseline + '{}'],
  ['appended garbage', baseline + 'oops'],
  ['trailing comma', baseline.replace('"params":[]', '"params":[],')],
  ['comment', baseline.replace('"schema":1', '"schema":/*x*/1')],
  ['unquoted key', baseline.replace('"schema":1', 'schema:1')],
  ['invalid escape', baseline.replace('Quiet.', '\\q')],
  ['decoded NUL', baseline.replace('Quiet.', '\\u0000')],
  ['unpaired escaped surrogate', baseline.replace('Quiet.', '\\ud800')],
  ['excessive depth', '['.repeat(9) + '0' + ']'.repeat(9)],
  ['empty read', ''],
  ['oversized file', ' '.repeat(limits.json + 1)],
  ['invalid raw UTF8', Buffer.from([0x7b, 0x22, 0xc0, 0xaf, 0x22, 0x7d])],
  ['raw NUL', Buffer.from([0x7b, 0x00, 0x7d])],
  ['raw surrogate UTF8', Buffer.from([0xed, 0xa0, 0x80])],
  ['raw out-of-range UTF8', Buffer.from([0xf4, 0x90, 0x80, 0x80])],
  ['BOM', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(baseline)])],
];
for (const [label, data] of invalidJSON) test(`strict JSON rejects ${label}`, () => {
  const oracle = new FeelingOracle(); oracle.remember(quiet(), 'Quiet.');
  assert.equal(oracle.load(data, 'Quiet.'), false);
  assert.equal(oracle.repeat('Quiet.'), 'Quiet.');
});
test('wrong expected native guard rejects a valid snapshot', () => {
  const oracle = new FeelingOracle(); assert.equal(oracle.load(baseline, 'another level'), false);
  assert.equal(oracle.repeat('another level'), 'another level');
});
test('record-count and aggregate retained-text bounds are enforced', () => {
  const oracle = new FeelingOracle(); let guard = '';
  for (let index = 0; index < limits.records; index++) {
    const record = quiet(); record.joinBefore = index ? ' ' : '';
    guard += record.joinBefore + record.english; assert.equal(oracle.remember(record, guard), true);
  }
  const snapshot = JSON.parse(oracle.save());
  snapshot.records.push(quiet()); assert.equal(oracle.load(JSON.stringify(snapshot), guard), false);
  oracle.clear(); guard = '';
  for (let index = 0; index < 3; index++) {
    const record = named('x'.repeat(11000)); record.joinBefore = index ? ' ' : '';
    guard += record.joinBefore + 'x'.repeat(11000) + ' waits.';
    assert.equal(oracle.remember(record, guard), index < 2);
  }
});

const pascal = fs.readFileSync(path.join(directory, 'drlsemanticfeelings.pas'), 'utf8');
const fcl = name => fs.readFileSync(path.join(root, 'toolchain/fpc-src/packages/fcl-json/src', name), 'utf8');
test('Pascal source implements contract, actual FCL reader confirms strict full-document and duplicate-key behavior', () => {
  for (const [constant, value] of Object.entries({ DRL_FEELING_SCHEMA: 1, DRL_FEELING_MAX_RECORDS: 256, DRL_FEELING_MAX_PARAMS: 16, DRL_FEELING_MAX_TEXT_BYTES: 32768, DRL_FEELING_MAX_JSON_BYTES: 1048576, MAX_JSON_DEPTH: 8, MAX_JSON_TOKENS: 100000 })) {
    assert.match(pascal, new RegExp(`\\b${constant}\\s*=\\s*${value}\\s*;`));
  }
  assert.match(pascal, /TJSONScanner\.Create\(aData, \[joUTF8, joStrict\]\)/);
  assert.match(pascal, /TJSONParser\.Create\(data, \[joUTF8, joStrict\]\)/);
  assert.match(pascal, /if depth >= MAX_JSON_DEPTH then Exit/);
  assert.match(pascal, /if tokens > MAX_JSON_TOKENS then Exit/);
  assert.match(pascal, /tkNumber:\s*if scanner\.CurTokenString <> '1' then Exit/);
  assert.match(pascal, /DRLEnglishText\(aRecord\.ID, aRecord\.English, aRecord\.Params\)/);
  assert.match(pascal, /if not Assigned\(DRLSemanticFeelingValidator\) then Exit/);
  assert.match(pascal, /TFileStream\.Create\(aFilename, fmOpenRead or fmShareDenyNone\)/);
  assert.match(pascal, /stream\.ReadBuffer\(data\[1\], Length\(data\)\)/);
  assert.match(pascal, /stream\.WriteBuffer\(data\[1\], Length\(data\)\)/);
  assert.match(pascal, /schema\.AsJSON <> '1'/);
  assert.match(pascal, /FRecords := candidate;[\s\S]*?FUsable := True/);
  assert.match(pascal, /scalar < minimum[\s\S]*?scalar > \$10FFFF[\s\S]*?\$D800[\s\S]*?\$DFFF/);
  assert.match(fcl('jsonreader.pp'), /\(joStrict in Options\) and not \(joSingle in Options\)[\s\S]{0,300}CurrentToken<>tkEOF/);
  assert.match(fcl('jsonparser.pp'), /not \(joIgnoreDuplicates in options\)/i);
  const code = pascal.replace(/\{[\s\S]*?\}/g, '');
  assert.doesNotMatch(code, /\b(?:Random|Randomize|RandSeed|FFeeling|LuaSystem|Hook|WriteAnsiString|ReadAnsiString)\b/i);
});

// This harness runs the ACTUAL Pascal unit, including standard-file persistence
// and parser rejection. The parent may emit to a temporary build directory and
// compile against drlsemantictext + drlsemanticfeelings + official FCL JSON.
export const nativePascalHarness = String.raw`program feeling_sidecar_harness;
{$mode objfpc}{$H+}{$B-}{$codepage utf8}
uses Classes, SysUtils, drlsemantictext, drlsemanticfeelings;
var Filename, Guard, Saved: AnsiString; Stream: TFileStream;
    Params: array[0..0] of TDRLTextParam;
function B(const Value: RawByteString): AnsiString;
begin SetLength(Result, Length(Value));
  if Length(Value) > 0 then Move(Value[1], Result[1], Length(Value)); end;
procedure Check(Value: Boolean; const LabelText: AnsiString);
begin if not Value then raise Exception.Create('FAIL: ' + LabelText); end;
function Validate(const ID, English: AnsiString;
  const P: array of TDRLTextParam): Boolean;
begin
  Result := ((ID = 'feeling.test.quiet') and (English = 'Quiet.') and (Length(P) = 0)) or
    ((ID = 'feeling.test.count') and (English = '{{count}} shadows.') and
      (Length(P) = 1) and (P[0].Name = 'count') and (P[0].Kind = DRL_TEXT_INTEGER)) or
    ((ID = 'feeling.test.name') and (English = '{{name}} waits.') and
      (Length(P) = 1) and (P[0].Name = 'name') and (P[0].Kind = DRL_TEXT_STRING));
end;
function Resolve(const ID, English: AnsiString;
  const P: array of TDRLTextParam): AnsiString;
begin
  if ID = 'feeling.test.quiet' then Result := B('静かだ。')
  else if ID = 'feeling.test.count' then Result := P[0].Value + B('体の影。')
  else if ID = 'feeling.test.name' then Result := P[0].Value + B('が待っている。')
  else Result := English;
end;
procedure WriteRaw(const Data: AnsiString);
begin
  Stream := TFileStream.Create(Filename, fmCreate);
  try if Length(Data) > 0 then Stream.WriteBuffer(Data[1], Length(Data));
  finally Stream.Free; end;
end;
function ReadRaw: AnsiString;
begin
  Stream := TFileStream.Create(Filename, fmOpenRead);
  try SetLength(Result, Stream.Size);
    if Length(Result) > 0 then Stream.ReadBuffer(Result[1], Length(Result));
  finally Stream.Free; end;
end;
procedure Reject(const Data, LabelText: AnsiString);
begin
  Check(Data <> Saved, LabelText + ' fixture changes saved JSON');
  Check(DRLLoadSemanticFeelings(Filename, Guard), 'reestablish baseline before rejection');
  WriteRaw(Data);
  Check(not DRLLoadSemanticFeelings(Filename, Guard), LabelText);
  Check(DRLRepeatSemanticFeeling(Guard) = Guard, LabelText + ' fallback');
  WriteRaw(Saved);
end;
begin
  Check(ParamCount = 1, 'pass one temporary JSON filename'); Filename := ParamStr(1);
  DRLSemanticFeelingValidator := @Validate; DRLSemanticTextResolver := @Resolve;
  DRLClearSemanticFeelings;
  Check(DRLRememberSemanticFeeling('feeling.test.quiet', 'Quiet.', [], '', 'Quiet.'), 'quiet remember');
  Params[0] := DRLIntegerParam('count', 3); Guard := 'Quiet. 3 shadows.';
  Check(DRLRememberSemanticFeeling('feeling.test.count', '{{count}} shadows.', Params, ' ', Guard), 'typed remember');
  Params[0].Value := '9';
  Check(DRLRepeatSemanticFeeling(Guard) = B('静かだ。 3体の影。'), 'deep copy and Japanese repeat');
  Check(DRLRepeatSemanticFeeling('another level') = 'another level', 'guard fallback');
  Check(DRLSaveSemanticFeelings(Filename), 'save'); Saved := ReadRaw;
  DRLClearSemanticFeelings;
  Check(DRLLoadSemanticFeelings(Filename, Guard), 'load');
  Check(DRLRepeatSemanticFeeling(Guard) = B('静かだ。 3体の影。'), 'resume repeat');
  DRLSemanticTextResolver := nil;
  Check(DRLRepeatSemanticFeeling(Guard) = Guard, 'English resolver fallback');
  DRLSemanticTextResolver := @Resolve;
  Reject(Saved + '{}', 'trailing root');
  Reject(StringReplace(Saved, '"schema" : 1', '"schema" : 2', []), 'unknown schema');
  Reject(StringReplace(Saved, '"schema" : 1', '"schema" : 1.0', []), 'floating schema');
  Reject(StringReplace(Saved, '"schema" : 1', '"schema" : 1, "schema" : 1', []), 'duplicate schema');
  Reject(StringReplace(Saved, '"schema" : 1', '"schema" : 1, "sch\u0065ma" : 1', []), 'escaped duplicate schema');
  Reject(StringReplace(Saved, '"schema" : 1', '"schema" : 1, "extra" : null', []), 'unexpected root field');
  Reject(StringReplace(Saved, 'feeling.test.count', 'feeling.test.unknown', []), 'unknown ID');
  Reject(StringReplace(Saved, '"integer"', '"string"', []), 'kind mismatch');
  Reject(StringReplace(Saved, '"3"', '"03"', []), 'noncanonical integer');
  Reject(StringReplace(Saved, '"3"', '"9223372036854775808"', []), 'integer overflow');
  Reject(StringReplace(Saved, '"3"', '"\u0000"', []), 'escaped NUL');
  Reject(StringReplace(Saved, '"3"', '"\ud800"', []), 'unpaired surrogate');
  Reject(StringOfChar('[', 9) + '0' + StringOfChar(']', 9), 'nesting bound');
  Reject(StringOfChar(' ', 1048577), 'file bound');
  Reject('{' + #0 + '}', 'raw NUL');
  Reject(#$ED + #$A0 + #$80, 'raw surrogate UTF8');
  Check(not DRLLoadSemanticFeelings(Filename, 'wrong level'), 'expected guard rejection');
  Check(DRLRepeatSemanticFeeling(Guard) = Guard, 'failed-load stale fallback');
  DRLClearSemanticFeelings;
  Check(DRLRememberSemanticFeeling('feeling.test.quiet', 'Quiet.', [], '', 'Quiet.'), 'new baseline');
  Check(not DRLRememberSemanticFeeling('feeling.test.quiet', 'Quiet.', [], ' ', 'wrong'), 'remember mismatch');
  Check(DRLRepeatSemanticFeeling('Quiet.') = 'Quiet.', 'early-exit failure disables replay');
  DRLClearSemanticFeelings; DRLSemanticFeelingValidator := nil;
  Check(not DRLRememberSemanticFeeling('feeling.test.quiet', 'Quiet.', [], '', 'Quiet.'), 'nil validator');
  DRLSemanticFeelingValidator := @Validate;
  DRLClearSemanticFeelings;
  Params[0] := DRLIntegerParam('count', Low(Int64)); Guard := '-9223372036854775808 shadows.';
  Check(DRLRememberSemanticFeeling('feeling.test.count', '{{count}} shadows.', Params, '', Guard), 'Int64 minimum');
  Check(DRLSaveSemanticFeelings(Filename), 'minimum save'); DRLClearSemanticFeelings;
  Check(DRLLoadSemanticFeelings(Filename, Guard), 'minimum load');
  Check(DRLRepeatSemanticFeeling(Guard) = B('-9223372036854775808体の影。'), 'minimum exactness');
  DRLClearSemanticFeelings;
  Params[0] := DRLStringParam('name', B('Cacazu "quoted"\path') + #10 + B('日本語 🐉 {{count}}'));
  Guard := Params[0].Value + ' waits.';
  Check(DRLRememberSemanticFeeling('feeling.test.name', '{{name}} waits.', Params, '', Guard), 'UTF8 remember');
  Check(DRLSaveSemanticFeelings(Filename), 'UTF8 save'); DRLClearSemanticFeelings;
  Check(DRLLoadSemanticFeelings(Filename, Guard), 'UTF8 load');
  Check(DRLRepeatSemanticFeeling(Guard) = Params[0].Value + B('が待っている。'), 'UTF8 exact roundtrip');
  Check(DeleteFile(Filename), 'temporary file cleanup');
  WriteLn('PASS: actual Pascal feeling sidecar persistence, guards, typed parameters, strict parser, UTF8 and fallback');
end.
`;

const emitIndex = process.argv.indexOf('--emit-pascal-test');
if (emitIndex >= 0) {
  assert.ok(process.argv[emitIndex + 1], 'provide a temporary .pas output path');
  fs.writeFileSync(process.argv[emitIndex + 1], nativePascalHarness, 'utf8');
}
console.log(JSON.stringify({
  passed: cases.length, cases,
  evidence: 'Node reference-oracle/adversarial tests plus Pascal and official FCL source contracts; native harness not executed',
  nativeHarness: 'node localization/feeling-sidecar-test.mjs --emit-pascal-test <temporary-path.pas>; compile/run after hold release',
  sourceSha256: crypto.createHash('sha256').update(pascal).digest('hex'),
}, null, 2));
