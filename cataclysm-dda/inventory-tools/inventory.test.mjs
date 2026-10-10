import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { extractCpp, extractJson, scanJson, parsePo, placeholderSignature, comparePlaceholders, auditPoEntry, inventory } from './inventory.mjs';

test('C++ extraction preserves context, raw literals, concatenation and nested dynamic expressions', () => {
  const text = '// _( "ignored" )\nconst char * x = pgettext("menu", "Open " "door");\n'
    + 'auto plural = ngettext(R"tag(one %s)tag", "many %s", count);\n'
    + 'auto dynamic = _(string_format("computed %s", _( "nested" )));\n';
  const result = extractCpp(text, 'src/test.cpp');
  assert.equal(result.entries.length, 3);
  assert.deepEqual(result.entries.map(e => e.singular), ['Open door', 'one %s', 'nested']);
  assert.equal(result.entries[0].context, 'menu');
  assert.equal(result.entries[0].span.start.line, 2);
  assert.equal(result.entries[1].plural, 'many %s');
  assert.equal(result.dynamic.length, 1);
  assert.match(result.dynamic[0].expression, /string_format/);
});

test('JSON inventory preserves exact escaped-string spans, object owners and pointers', () => {
  const text = '[\n{"type":"GENERIC","id":"test_item","name":{"str":"door","str_pl":"doors","ctxt":"item"},"description":"日本語\\nsecond","a/b":{"~key":"value"}}\n]';
  const result = extractJson(text, 'data/json/test.json');
  assert.equal(result.objects.length, 1);
  const name = result.strings.find(e => e.pointer === '/0/name/str');
  assert.equal(name.context, 'item');
  assert.equal(name.owner.id, 'test_item');
  assert.equal(name.semanticCandidate, 'cdda.GENERIC.test_item.name.str');
  const desc = result.strings.find(e => e.pointer === '/0/description');
  assert.equal(JSON.parse(text.slice(desc.span.offset, desc.span.endOffset)), desc.value);
  assert.equal(desc.span.start.line, 2);
  assert.equal(result.strings.find(e => e.value === 'value').pointer, '/0/a~1b/~0key');
  assert.throws(() => scanJson('{"x":1} trailing'), /Trailing/);
  assert.throws(() => scanJson('{"x":1,}'), /Trailing JSON comma/);
  assert.deepEqual(scanJson('// config\n{"x":1,}', { jsonc: true }).value, { x: 1 });
});

test('PO parser retains headers, plural forms, references, fuzzy and obsolete entries', () => {
  const text = 'msgid ""\nmsgstr ""\n"Language: ja\\n"\n"Plural-Forms: nplurals=1; plural=0;\\n"\n\n'
    + '#: src/test.cpp:3 data/json/item.json:2\n#, fuzzy, c-format\nmsgctxt "item"\nmsgid "one %s"\nmsgid_plural "many %s"\nmsgstr[0] "%s個"\n\n'
    + '#~ msgid "obsolete"\n#~ msgstr "古い"\n';
  const result = parsePo(text, 'lang/po/ja.po');
  assert.equal(result.language, 'ja');
  assert.equal(result.nplurals, 1);
  assert.equal(result.entries.length, 3);
  assert.equal(result.entries[1].references.length, 2);
  assert.ok(result.entries[1].flags.includes('fuzzy'));
  assert.equal(result.entries[1].translations['0'], '%s個');
  assert.equal(result.entries[2].obsolete, true);
  assert.deepEqual(result.errors, []);
});

test('printf placeholders support reordered positional arguments, width, precision, escaping and dynamic tags', () => {
  assert.deepEqual(comparePlaceholders('%s has %d', '%2$d : %1$s'), []);
  assert.deepEqual(placeholderSignature('%*.*f %% {player} <npcname> <color_red>'), { printf: ['1:int-width', '2:int-width', '3:float'], braces: ['player'], tags: ['npcname'] });
  assert.equal(comparePlaceholders('%s {player}', '%d {player}').length, 1);
  assert.equal(comparePlaceholders('Hi <npcname>', 'こんにちは <u_name>').length, 1);
  assert.deepEqual(comparePlaceholders('75% capacity and 25% closer', '75%の容量と25%近い'), []);
  assert.deepEqual(comparePlaceholders('cache{transp:%.4f seen:%.4f}', 'cache{透明度:%.4f 視界:%.4f}'), []);
  assert.deepEqual(placeholderSignature('%.f %lld %ls'), { printf: ['1:float', '2:llinteger', '3:ls'], braces: [], tags: [] });
  assert.equal(auditPoEntry({ singular: 'Hi %s', plural: null, flags: [], translations: { 0: 'こんにちは %d' } })[0].severity, 'review');
});

test('end-to-end inventory reports exact missing/fuzzy/placeholder gaps without mutating source', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cdda-inventory-test-'));
  const source = path.join(base, 'upstream'), output = path.join(base, 'report');
  fs.mkdirSync(path.join(source, 'src'), { recursive: true });
  fs.mkdirSync(path.join(source, 'data', 'json'), { recursive: true });
  fs.mkdirSync(path.join(source, 'lang', 'po'), { recursive: true });
  fs.writeFileSync(path.join(source, 'src', 'avatar.cpp'), '_("Welcome %s"); _(computed);');
  fs.writeFileSync(path.join(source, 'data', 'json', 'item.json'), '[{"type":"GENERIC","id":"item","name":"door"}]');
  fs.writeFileSync(path.join(source, 'lang', 'po', 'ja.po'), 'msgid ""\nmsgstr "Language: ja\\n"\n\n#, fuzzy, c-format\nmsgid "Welcome %s"\nmsgstr "ようこそ %d"\n');
  const before = fs.readFileSync(path.join(source, 'src', 'avatar.cpp'), 'utf8');
  const result = inventory({ source, output, commit: 'fixture' });
  assert.equal(result.files, 3);
  assert.equal(result.extractionErrors, 0);
  assert.equal(result.text.dynamicSourceExpressions, 1);
  assert.equal(result.gaps['catalog-placeholder-mismatch'], 1);
  assert.equal(result.gaps['fuzzy-catalog-entry'], 1);
  assert.equal(result.gaps['text-missing-from-japanese-catalog'], 1);
  assert.equal(fs.readFileSync(path.join(source, 'src', 'avatar.cpp'), 'utf8'), before);
  assert.throws(() => inventory({ source, output: path.join(source, 'bad') }), /outside pristine/);
  // The verified temporary fixture root is owned by this test.
  assert.ok(base.startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(base, { recursive: true });
});
