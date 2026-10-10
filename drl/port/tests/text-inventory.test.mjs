import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanSource, inventorySource, extractPlaceholders, findDynamicSources, generateInventory, locationAt } from '../tools/inventory-texts.mjs';

test('Pascal comments/directives are excluded while quotes in live strings survive', () => {
  const source = "{$INCLUDE 'not-text.inc'}\n{ 'comment' { nested 'comment' } }\n(* 'another comment' (* nested *) *)\n// 'ignored'\nIO.Msg('It''s a -- {message} (*live*)');";
  const scan = scanSource(source, 'pascal');
  assert.equal(scan.literals.length, 1);
  assert.equal(scan.literals[0].value, "It's a -- {message} (*live*)");
  assert.equal(scan.literals[0].raw, "'It''s a -- {message} (*live*)'");
  assert.equal(scan.literals[0].line, 5);
  assert.equal(scan.diagnostics.length, 0);
});

test('Pascal numeric character fragments retain original spelling and exact value', () => {
  const scan = scanSource("'first'#13#10'last'#$0041", 'pascal');
  assert.deepEqual(scan.literals.map(t => t.value), ['first', '\r', '\n', 'last', 'A']);
  assert.deepEqual(scan.literals.map(t => t.raw), ["'first'", '#13', '#10', "'last'", '#$0041']);
  const rows = inventorySource("'first'#13#10'last'", 'pascal', 'src/demo.pas').records;
  assert.ok(rows.every(r => r.dynamicAssembly.concatenated));
});

test('Lua arbitrary-equals long brackets do not terminate on unrelated closing brackets', () => {
  const source = '--[==[ ignored "literal" ]==]\nlocal text = [=[\r\nfirst ]] still text\r\nlast]=]';
  const scan = scanSource(source, 'lua');
  assert.equal(scan.literals.length, 1);
  assert.equal(scan.literals[0].value, 'first ]] still text\nlast');
  assert.ok(scan.literals[0].raw.startsWith('[=[\r\n'));
  assert.equal(scan.literals[0].line, 2);
  assert.equal(scan.diagnostics.length, 0);
});

test('Lua comments are ignored but comment characters inside quoted strings survive', () => {
  const source = '-- "not a string"\nui.msg("--[[ still text ]]\\n\\\"quote\\\"") -- \'ignored\'\nlocal x=\'apostrophe\\\'s\'';
  const scan = scanSource(source, 'lua');
  assert.deepEqual(scan.literals.map(t => t.value), ['--[[ still text ]]\n"quote"', "apostrophe's"]);
});

test('Lua decimal, hex, unicode and whitespace escapes decode while retaining raw syntax', () => {
  const source = String.raw`"\065\x42\u{43}\z   ` + '\n' + String.raw` D"`;
  const literal = scanSource(source, 'lua').literals[0];
  assert.equal(literal.value, 'ABCD');
  assert.equal(literal.raw, source);
  assert.deepEqual(literal.diagnostics, []);
});

test('Unrecognized Lua escapes are preserved and flagged, never silently normalized', () => {
  const literal = scanSource(String.raw`"bad\j"`, 'lua').literals[0];
  assert.equal(literal.value, String.raw`bad\j`);
  assert.equal(literal.diagnostics.length, 1);
});

test('Unterminated strings/comments are surfaced with source coordinates', () => {
  assert.equal(scanSource('local x=[==[unfinished', 'lua').diagnostics[0].message, 'Unterminated Lua long string');
  assert.equal(scanSource("x := 'unfinished", 'pascal').literals[0].closed, false);
  assert.equal(scanSource('{ unclosed', 'pascal').diagnostics[0].offset, 0);
  assert.equal(scanSource('--[=[ unclosed', 'lua').diagnostics[0].message, 'Unterminated Lua long comment');
});

test('Coordinates explicitly use UTF-16 units and CRLF lines', () => {
  const source = "😀\r\nui.msg('日本語')";
  const literal = scanSource(source, 'lua').literals[0];
  assert.equal(literal.start, 11);
  assert.deepEqual({ line: literal.line, column: literal.column }, { line: 2, column: 8 });
  assert.deepEqual(locationAt(source, literal.start), { line: 2, column: 8 });
  assert.equal(source.slice(literal.start, literal.end), literal.raw);
});

test('Format specifiers preserve positional/width/type meaning and distinguish percent signs', () => {
  const result = extractPlaceholders('%s has %+03d damage, %0:d turns and %2$.*f value; 20%, 100%%');
  assert.deepEqual(result.placeholders.map(p => p.raw), ['%s', '%+03d', '%0:d', '%2$.*f']);
  assert.deepEqual(result.placeholders.map(p => p.index), [null, null, '0', '2']);
  assert.equal(result.escapedPercents.length, 1);
  assert.equal(extractPlaceholders('20% of starting HP, 10% damage per level.').placeholders.length, 0);
});

test('DRL key/color markup does not become a named parameter', () => {
  const result = extractPlaceholders('{!Escape} {rControls} @yPress {player_name}');
  assert.deepEqual(result.placeholders.map(p => p.name), ['player_name']);
  assert.equal(result.markup.length, 3);
  assert.deepEqual(extractPlaceholders('@1 killed @2').placeholders.map(p => p.index), ['1', '2']);
});

test('Entity names/descriptions get structural anchors while registry IDs remain internal', () => {
  const source = 'register_item "knife" { name = "combat knife", desc = "Better than fists", damage = "2d5", group = "melee" }';
  const records = inventorySource(source, 'lua', 'bin/data/drl/items/items.lua').records;
  assert.equal(records[0].classification, 'internal');
  assert.equal(records[1].classification, 'user-facing-candidate');
  assert.deepEqual(records[1].structure.entityCandidate, { kind: 'item', id: 'knife' });
  assert.match(records[1].candidateId, /item\.knife\.name\.1$/);
  assert.equal(records[3].classification, 'internal-candidate');
  assert.ok(records.every(r => r.translated === false));
});

test('Nested registry tables and alternate parenthesized registration retain ownership', () => {
  const source = 'register_being("imp", { name="imp", nested={ note="unknown" }, desc="A monster" })';
  const records = inventorySource(source, 'lua', 'beings.lua').records;
  assert.deepEqual(records[1].structure.entityCandidate, { kind: 'being', id: 'imp' });
  assert.deepEqual(records[3].structure.entityCandidate, { kind: 'being', id: 'imp' });
});

test('Dynamic concatenation and names/plurals require migration review', () => {
  const source = "function TItem.GetName: string;\nbegin Result := 'shell' + iPlural; IO.Msg('You see ' + Item.GetName(True)); end;";
  const records = inventorySource(source, 'pascal', 'src/dfitem.pas').records;
  assert.ok(records.every(r => r.dynamicAssembly.requiresMigrationReview));
  assert.equal(records[1].structure.enclosingCallCandidate, 'IO.Msg');
  const withoutLiteral = findDynamicSources('local n = item:get_name()\nlocal text = tostring(player.name)', 'lua', 'names.lua');
  assert.ok(withoutLiteral.some(r => r.symbol === 'tostring'));
});

test('Repeated literals retain distinct IDs and discovery results remain stable', () => {
  const source = "procedure TView.Update; begin IO.Msg('Yes'); IO.Msg('Yes'); end;";
  const first = inventorySource(source, 'pascal', 'src/view.pas').records;
  const second = inventorySource(source, 'pascal', 'src/view.pas').records;
  assert.equal(new Set(first.map(r => r.candidateId)).size, 2);
  assert.deepEqual(first, second);
});

test('Ambiguous literals are inventoried instead of silently excluded', () => {
  const records = inventorySource('local x="mystery"; local y=""', 'lua', 'unknown.lua').records;
  assert.equal(records[0].classification, 'ambiguous');
  assert.equal(records[1].classification, 'empty-or-layout');
});

test('Inventory generation hashes source, discovers help/documents, excludes .git and rejects upstream writes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'drl-text-inventory-test-'));
  const root = path.join(directory, 'upstream');
  const output = path.join(directory, 'catalog');
  try {
    await mkdir(path.join(root, '.git'), { recursive: true });
    await writeFile(path.join(root, '.git', 'hidden.lua'), '"hidden"');
    await writeFile(path.join(root, 'items.lua'), 'register_item "knife" { name="combat knife" }');
    await writeFile(path.join(root, 'keys.hlp'), '{rControls}\n\n{!Escape} Exit\n');
    const result = await generateInventory(root, output);
    const artifact = JSON.parse(await readFile(path.join(output, 'text-inventory.json'), 'utf8'));
    assert.equal(result.summary.literalOccurrences, 2);
    assert.equal(result.summary.helpFiles, 1);
    assert.equal(result.summary.documentNonemptyLines, 2);
    assert.equal(artifact.documents[0].lines[1].line, 3);
    assert.equal(artifact.manifest.length, 2);
    assert.match(artifact.manifest[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal(artifact.method.japaneseCoverageClaimed, false);
    await assert.rejects(generateInventory(root, path.join(root, 'catalog')), /separate from pristine upstream/);
  } finally {
    const resolvedDirectory = path.resolve(directory);
    assert.equal(path.dirname(resolvedDirectory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolvedDirectory).startsWith('drl-text-inventory-test-'));
    await rm(resolvedDirectory, { recursive: true, force: true });
  }
});
