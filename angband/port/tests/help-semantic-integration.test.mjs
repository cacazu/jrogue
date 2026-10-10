// SPDX-License-Identifier: GPL-2.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const bytes = path => readFileSync(new URL(path, root));
const read = path => bytes(path).toString('utf8');
const json = path => JSON.parse(read(path));
const manifest = json('migration/help-data/source-manifest.json');
const en = json('migration/help-data/en.json');
const ja = json('migration/help-data/ja.json');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const pure = /^[\t ]*#ifdef __EMSCRIPTEN__ \/\* AB_HELP_PURE \*\/\r?\n[\s\S]*?^[\t ]*#endif \/\* AB_HELP_PURE \*\/\r?\n/gm;
const branch = /\/\* AB_HELP_BRANCH_BEGIN \*\/[\s\S]*?\/\* AB_HELP_BRANCH_END \*\//g;
const current = read('logic/ui-help.c');
const native = read('tests/accepted-source-snapshot/ui-help.c');
const helper = read('logic/web-help-text.c');
const generated = read('logic/web-help-data.h');

// Independent template scanner: doubled braces are real key/symbol glyphs.
function template(source) {
 let rendered = '', names = [];
 for (let i = 0; i < source.length;) {
  const c = source[i];
  if ((c === '{' || c === '}') && source[i + 1] === c) {
   rendered += c; i += 2;
  } else if (c === '{') {
   const end = source.indexOf('}', i + 1);
   assert.ok(end >= 0);
   const name = source.slice(i + 1, end);
   assert.match(name, /^[a-z][a-z0-9_]*$/);
   names.push(name); rendered += '{' + name + '}'; i = end + 1;
  } else {
   assert.notEqual(c, '}'); rendered += c; i++;
  }
 }
 return { rendered, names: [...new Set(names)].sort() };
}

function logicalLines(text) {
 const physical = text.replaceAll('\r\n', '\n').split('\n');
 if (physical.at(-1) === '') physical.pop();
 const out = [];
 for (let line = 0; line < physical.length; line++) {
  if (physical[line].startsWith('.. ')) {
   // ui-help.c skips the directive body and its terminating whitespace line.
   do { line++; } while (line < physical.length && !/^[ \t]*$/.test(physical[line]));
  } else out.push({ line: line + 1, text: physical[line] });
 }
 return out;
}

test('five immutable help assets and native C are byte-exact pinned originals', () => {
 assert.equal(sha256(bytes('tests/accepted-source-snapshot/ui-help.c')), 'fe40ef1707faaea9997df9d1410909cb1f2484bb8bfe7f343d4a5308ea7acd56');
 assert.deepEqual(Buffer.from(current.replace(branch, '').replace(pure, ''), 'utf8'), bytes('tests/accepted-source-snapshot/ui-help.c'));
 assert.equal([...current.matchAll(pure)].length, 18);
 assert.equal([...current.matchAll(branch)].length, 10);
 for (const file of manifest.files) assert.equal(sha256(bytes('data/help/' + file.filename)), file.sha256);
 const corpus = createHash('sha256');
 for (const file of manifest.files) corpus.update(file.filename + '\0').update(bytes('data/help/' + file.filename));
 assert.equal(corpus.digest('hex'), manifest.corpus_sha256);
});

test('complete logical-line catalog preserves physical source and original layout identities', () => {
 assert.equal(manifest.upstream_commit, 'f3082213b73f3e463e3d0d60bff4b00462beae6e');
 assert.deepEqual(manifest.coverage, { files: 5, logical_rows: 278, text_rows: 229, layout_rows: 49, ui_templates: 10, catalog_ids: 301 });
 assert.deepEqual(Object.keys(en).sort(), Object.keys(ja).sort());
 assert.equal(manifest.entries.length, 301);
 assert.equal(manifest.application_actions, 13);
 const rows = manifest.entries.filter(e => e.source_kind === 'help_logical_line');
 for (const file of manifest.files) {
  const source = logicalLines(read('data/help/' + file.filename));
  assert.equal(source.length, file.logical_lines);
  const items = rows.filter(e => e.source.file === 'data/help/' + file.filename);
  assert.equal(items.length, source.length);
  for (let i = 0; i < source.length; i++) {
   const item = items[i];
   assert.equal(item.source.logical_line, i);
   assert.equal(item.source.line, source[i].line);
   assert.equal(item.original_english, source[i].text);
   assert.equal(item.original_call, source[i].text);
   assert.equal(template(en[item.id]).rendered, source[i].text);
   assert.equal(file.ids[i], item.id);
   assert.ok(generated.includes('"' + item.id + '"'));
  }
 }
 assert.equal(rows.filter(e => e.role === 'text').length, 229);
 assert.equal(rows.filter(e => e.role === 'layout').length, 49);
 assert.ok(rows.filter(e => e.role === 'text').every(e => !/\.line_\d+$/.test(e.id)));
 assert.equal(manifest.files.find(f => f.filename === 'commands.txt').ids[17], 'help.original.command.aim_wand_and_activate');
 assert.equal(manifest.files.find(f => f.filename === 'index.txt').ids[3], 'help.index.reference.manual_link');
 assert.deepEqual(manifest.files.find(f => f.filename === 'index.txt').native_menu_hooks, { a: 'commands.txt', b: 'symbols.txt' });
 assert.deepEqual(manifest.files.find(f => f.filename === 'r_index.txt').native_menu_hooks, { a: 'r_comm.txt', b: 'symbols.txt' });
});

test('RST logical identity skips directives and continuation including the terminating blank', () => {
 const fixture = 'before\n.. menu:: [a] unchanged.txt\n  hidden continuation\n\t\n\nafter\n.. _tag:\n\nend\n';
 assert.deepEqual(logicalLines(fixture), [
  { line: 1, text: 'before' }, { line: 5, text: '' }, { line: 6, text: 'after' }, { line: 9, text: 'end' },
 ]);
 for (const file of manifest.files.filter(f => f.filename.includes('index'))) {
  assert.deepEqual(file.skipped_lines.map(e => e.line), [21, 22, 23]);
  assert.ok(file.ids.every(id => !en[id].startsWith('.. ')));
 }
 assert.match(native, /if \(skip_lines\)[\s\S]*?contains_only_spaces\(buf\)[\s\S]*?continue;/);
 assert.match(read('logic/z-util.c'), /const char spaces\[\]=" \\t";/);
});

test('all templates validate declared named parameters and literal symbol keys survive rendering', () => {
 for (const item of manifest.entries) {
  assert.equal(en[item.id], item.english);
  assert.equal(ja[item.id], item.japanese);
  const names = item.parameters.map(p => p.name).sort();
  assert.deepEqual(template(item.english).names, names, item.id + ' English');
  assert.deepEqual(template(item.japanese).names, names, item.id + ' Japanese');
  if (item.source_kind === 'help_logical_line') assert.deepEqual(names, []);
 }
 for (const filename of ['commands.txt', 'r_comm.txt']) {
  const file = manifest.files.find(f => f.filename === filename);
  for (let i = 17; i < file.logical_lines; i++) {
   const id = file.ids[i], cells = template(en[id]).rendered.trim().split(/\s{2,}/);
   const translated = template(ja[id]).rendered.trim();
   assert.ok(translated.startsWith(cells[0] + ' '), id);
   if (cells.length === 4) assert.ok(translated.includes(' ／ ' + cells[2] + ' '), id);
  }
 }
 const symbols = manifest.files.find(f => f.filename === 'symbols.txt');
 assert.ok(template(ja[symbols.ids[52]]).rendered.includes('{ 弾・矢・ボルト'));
 assert.ok(template(ja[symbols.ids[51]]).rendered.includes('} スリング・弓・クロスボウ'));
 assert.equal(ja['help.prompt.find'], '検索する文字列：');
 assert.equal(ja['help.prompt.goto_file'], '移動先のファイル：');
});

test('UI template provenance is the exact original call at accepted source location', () => {
 const lines = native.replaceAll('\r\n', '\n').split('\n');
 for (const entry of manifest.entries.filter(e => e.source_kind === 'ui_call')) {
  const span = lines.slice(entry.source.line - 1, entry.source.line + 2).join('\n');
  assert.ok(span.includes(entry.original_call), entry.id);
  assert.ok(entry.original_call.includes(entry.original_english), entry.id);
 }
 assert.deepEqual(manifest.entries.find(e => e.id === 'help.title').parameters, [
  { name: 'build', type: 'opaque_build_identity' }, { name: 'caption', type: 'localized_text' },
  { name: 'first', type: 'integer' }, { name: 'last', type: 'integer' }, { name: 'total', type: 'integer' },
 ]);
});

test('capture uses canonical source identities after native search, commits before blocking input, and preserves failure flow', () => {
 assert.ok(current.indexOf('if (find && !i && !strstr(lc_buf, find)) continue;') < current.indexOf('ab_help_row(&ab_help, next - 1, i);'));
 assert.ok(current.indexOf('ab_help_row(&ab_help, next - 1, i);') < current.indexOf('Term_putstr(0, i+2, -1, COLOUR_WHITE, buf);'));
 assert.ok(current.indexOf('ab_help_page_finish(&ab_help);') < current.indexOf('ch = inkey();'));
 assert.ok(current.indexOf('ab_help_bundled(&ab_help, name);') > current.indexOf('path_build(path, sizeof(path), ANGBAND_DIR_HELP, name);'));
 assert.equal((current.match(/ab_help_bundled\(/g) ?? []).length, 1);
 assert.match(helper, /ab_ui_scope_begin\("help", true\);[\s\S]*?help_control\("__unsupported:document"\)/);
 assert.match(helper, /ab_help_files\[view->file_index\]\.count/);
 assert.ok(!helper.includes('strstr(') && !helper.includes('lc_buf') && !helper.includes('Term_putstr'));
 assert.ok(!/\b(randint\d?|Rand\w*|player|cave|file_open|file_getl)\s*\(/.test(helper));
 assert.match(helper, /ab_semantic_event_begin\(&event, "", "ui", "help", "__help_page"[\s\S]*?ab_semantic_event_emit_control\(&event\);/);
 assert.match(helper, /ab_semantic_param_begin\(event, name, "boolean"\);\s*ab_semantic_json_bool/);
 for (const id of ['help.prompt.highlight', 'help.prompt.find', 'help.prompt.goto_line', 'help.prompt.goto_file']) {
  assert.match(current, new RegExp('ab_help_prompt\\(&ab_help, "' + id.replaceAll('.', '\\.') + '"\\);[\\s\\S]*?askfor_aux'));
 }
});

test('source catalog flags pending runtime acceptance and actual upstream navigation mismatches', () => {
 assert.ok(manifest.exclusions.some(x => x.includes('Compiled/browser acceptance')));
 assert.ok(manifest.exclusions.some(x => x.includes('External/arbitrary')));
 assert.ok(manifest.entries.filter(e => e.notes.some(n => n.includes('no matching switch cases'))).length === 4);
 assert.ok(!native.includes("case '=':") && !native.includes("case '+':") && !native.includes("case '_':"));
});

test('Japanese scan delegates to pure source-row matching and editor delegates unchanged UTF-8 input', () => {
 const rust = read('rust/src/application_help.rs');
 assert.match(current, /ab_help_match_result == 2 \?\s*!strstr\(lc_buf, find\) : ab_help_match_result != 1/);
 assert.match(current, /ab_help_matches\(&ab_help,\s*next - 1, find, case_sensitive\)/);
 assert.equal((current.match(/ab_help_askfor\(&ab_help,/g) ?? []).length, 4);
 assert.match(helper, /done = askfor_aux_keypress\(buffer, buffer_size, cursor, length, key, first_time\);/);
 assert.match(helper, /ab_ui_scope_commit\(\);[\s\S]*?accepted = askfor_aux\(buffer, buffer_size, help_keypress\);/);
 assert.match(helper, /ab_ui_clear\("query"\);\s*ab_ui_scope_end\(\);/);
 const nativeInput = read('logic/ui-input.c');
 assert.match(nativeInput, /utf32_to_utf8\(encoded/);
 assert.match(nativeInput, /utf8_fskip\(buf, \*curs/);
 assert.match(read('web/app.js'), /postMessage\(\{type: 'text', payload: \{text: pendingText, origin:/);
 assert.doesNotMatch(read('web/app.js'), /\.slice\(0, 80\)/, 'committed text groups cannot be silently truncated');
 assert.match(rust, /include_str!\("\.\.\/\.\.\/migration\/help-data\/row-bindings.tsv"\)/);
 assert.ok(!rust.includes('rand') && !rust.includes('unsafe') && !rust.includes('extern "C"'));
 const bindings = read('migration/help-data/row-bindings.tsv').trimEnd().split('\n').map(row => row.split('\t'));
 assert.equal(bindings.length, 278);
 for (const [file, logical, id] of bindings) assert.equal(manifest.files.find(record => record.filename === file).ids[Number(logical)], id);
 const commands = manifest.files.find(file => file.filename === 'commands.txt');
 const rows = commands.ids.map(id => template(ja[id]).rendered);
 assert.equal(rows.findIndex(text => text.includes('罠')), 20);
 assert.equal(rows.findIndex((text, index) => index > 20 && text.includes('罠')), 39);
 assert.ok(!template(en[commands.ids[20]]).rendered.includes('罠'));
 assert.match(rust, /character\.to_lowercase\(\)/);
 assert.match(rust, /original_start: start/);
 assert.match(rust, /pub fn highlight_runs/);
});

test('CJK DELETE regression fixtures preserve scalar edits, ASCII equivalence and buffer guards', () => {
 // Independent scalar-span contract, with actual byte arenas/guard checks.
 // This executes no original C or unsafe pointer access.
 const safeDelete = (text, cursor, capacity, firstTime = false) => {
  const characters = [...text], encoded = Buffer.from(text, 'utf8');
  assert.ok(encoded.length < capacity);
  const arena = Buffer.alloc(capacity + 16, 0xa5);
  encoded.copy(arena); arena[encoded.length] = 0;
  let length = encoded.length;
  if (firstTime) { length = 0; arena[0] = 0; }
  else if (cursor < characters.length) {
   const start = Buffer.byteLength(characters.slice(0, cursor).join(''));
   const end = start + Buffer.byteLength(characters[cursor]);
   const move = length - end + 1;
   assert.ok(start >= 0 && end > start && end <= length);
   assert.ok(start + move <= capacity);
   arena.copy(arena, start, end, length + 1);
   length -= end - start;
  }
  assert.equal(arena[length], 0);
  assert.deepEqual(arena.subarray(capacity), Buffer.alloc(16, 0xa5));
  const result = arena.subarray(0, length).toString('utf8');
  assert.ok(!result.includes('\ufffd'));
  const expected = firstTime ? '' : characters.filter((_, index) => index !== cursor).join('');
  assert.equal(result, expected);
  return result;
 };
 for (const text of ['abcdef', '罠魔法', 'a🌸罠𠮷b', '罠'.repeat(24)]) {
  for (let cursor = 0; cursor <= [...text].length; cursor++) {
   const capacity = Buffer.byteLength(text) + 1;
   safeDelete(text, cursor, capacity);
  }
  safeDelete(text, 2, Buffer.byteLength(text) + 1, true);
 }
 // Locate the old C pointer's result independently from valid UTF-8 starts.
 const text = '罠'.repeat(24), bytes_ = Buffer.from(text), cursor = 23;
 const originalStart = 3 * cursor;
 const oldStarts = [...text].map((_, index) => index * 3).filter(offset => offset >= cursor);
 const originalShift = oldStarts[1];
 const oldMove = bytes_.length - originalShift;
 assert.equal(originalShift, 27);
 assert.ok(originalStart + oldMove > bytes_.length + 1, 'old DELETE memmove exceeds even the terminator capacity');
 assert.ok(originalStart + oldMove > 80, 'old DELETE also exceeds the actual original 80-byte help buffer');
 safeDelete(text, cursor, 74); // Original Find/Show prompt's effective editor bound.
 safeDelete(text, cursor, 80); // Original allocated help query buffer.
 const ascii = Buffer.from('abcdef'), index = 4, shift = index + 1;
 const original = Buffer.concat([ascii.subarray(0, index), ascii.subarray(shift)]).toString('utf8');
 assert.equal(safeDelete('abcdef', index, 7), original, 'native English edit is identical');
 const editor = read('rust/src/application_text.rs');
 assert.match(editor, /text.replace_range\(start\.\.end, ""\);/);
 assert.match(editor, /scalar_byte_offset\(&text, remove_cursor/);
 assert.ok(!helper.includes('help_delete_scalar') && !helper.includes('utf8_fskip(buffer + *cursor'));
 assert.equal((helper.match(/askfor_aux_keypress\(/g) ?? []).length, 1, 'one shared scalar-safe edit per key');
});

test('reviewed mobile actions capture actual native keys and are disabled during query editing', () => {
 const actions = manifest.entries.filter(e => e.source_kind === 'reviewed_application_action');
 assert.equal(actions.length, 13);
 const lines = native.replaceAll('\r\n', '\n').split('\n');
 for (const action of actions) {
  assert.ok(lines[action.source.line - 1].includes(action.original_call));
  assert.equal(action.original_english, null);
  assert.ok(generated.includes('"' + action.id + '", ' + action.native_activation_key + 'U'));
  const key = action.key_source;
  const keyLines = (key.file === 'logic/ui-help.c' ? native : read(key.file)).replaceAll('\r\n', '\n').split('\n');
  assert.ok(keyLines[key.line - 1].includes(key.original_call));
  assert.equal(key.value, action.native_activation_key);
  if (key.expression === 'ESCAPE') {
   const actual = Number(key.original_call.match(/#define\s+ESCAPE\s+(0x[0-9a-f]+)/i)[1]);
   assert.equal(actual, 0xe000);
   assert.equal(action.native_activation_key, actual);
  } else {
   const literal = key.original_call.match(/(?:case\s+|ch\.code\s*==\s*)'([^']*)'/)[1];
   assert.equal(literal.codePointAt(0), action.native_activation_key);
  }
 }
 assert.deepEqual(actions.map(e => e.native_activation_key), [107, 106, 45, 32, 55, 49, 47, 38, 35, 37, 33, 0xe000, 63]);
 assert.ok(actions.every(e => ![61, 43, 95].includes(e.native_activation_key)));
 assert.match(helper, /ab_ui_static\("help", widget, ab_help_actions\[action\]\.id\);\s*help_row_key\(row, ab_help_actions\[action\]\.activation_key\)/);
 assert.match(helper, /Disable page\/menu actions while their native keys mean editor input/);
 assert.match(helper, /help_row_key\(visible, 0\)/);
});
