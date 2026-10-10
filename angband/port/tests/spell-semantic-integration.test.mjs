import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMPTY_PRESENTATION_MODEL, parsePresentationModel, renderPresentationModel } from '../web/semantic-view.js';
import { stripRecentAnnotations } from './native-annotations.mjs';

const port = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(port, name), 'utf8').replace(/\r\n/g, '\n');
const readRaw = name => fs.readFileSync(path.join(port, name));
const source = read('logic/ui-spell.c'), helper = read('logic/web-spell-text.c');
const manifest = JSON.parse(read('migration/character-data/source-manifest.json'));
const en = JSON.parse(read('migration/character-data/en.json'));

// Select the original native branch without normalizing any surviving bytes.
function conditionalSource(text, browser) {
 if (!browser) text = stripRecentAnnotations(text).replace(/\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g, '');
 const stack = [], output = [];
 let active = true;
 for (const record of text.match(/[^\n]*(?:\n|$)/g).filter(Boolean)) {
  const line = record.replace(/\r?\n$/, '');
  if (line === '#ifdef __EMSCRIPTEN__') {
   stack.push({ parent: active, first: browser }); active = active && browser;
  } else if (line === '#else') {
   assert.ok(stack.length); active = stack.at(-1).parent && !stack.at(-1).first;
  } else if (line === '#endif') {
   assert.ok(stack.length); active = stack.pop().parent;
  } else if (active) output.push(record);
 }
 assert.equal(stack.length, 0);
 return output.join('');
}

test('native ui-spell source is identical to accepted pinned snapshot', () => {
 const baseline = readRaw('tests/accepted-source-snapshot/ui-spell.c');
 const pinned = JSON.parse(readRaw('tests/accepted-source-snapshot/manifest.json').toString('utf8'))
  .files.find(file => file.file === 'ui-spell.c');
 assert.ok(pinned);
 assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'), pinned.sha256);
 assert.deepEqual(Buffer.from(conditionalSource(readRaw('logic/ui-spell.c').toString('utf8'), false)),
  Buffer.from(conditionalSource(baseline.toString('utf8'), false)));
 const native = conditionalSource(source, false), browser = conditionalSource(source, true);
 for (const code of [native, browser]) {
  assert.equal((code.match(/spell_chance\(spell_index\)/g) ?? []).length, 1);
  assert.equal((code.match(/get_spell_info\(spell_index, help, sizeof\(help\)\)/g) ?? []).length, 1);
  assert.equal((code.match(/spell_by_index\(player, spell_index\)/g) ?? []).length, 2);
 }
 assert.match(browser, /ab_fail = spell_chance\(spell_index\);/);
 assert.match(browser, /ab_spell_row\(player, spell, m->selections\[oid\], attr, ab_fail, ab_state\)/);
 assert.match(browser, /ab_spell_description\(player, spell, d->show_description\)/);
 assert.equal((browser.match(/ab_spell_menu_begin\(player, d->spells\[0\]\)/g) ?? []).length, 2);
 assert.equal((browser.match(/ab_spell_menu_end\(\)/g) ?? []).length, 2);
});

test('30 books and 163 spell name/description pairs bind to original canonical indices', () => {
 const bookBindings = [...helper.matchAll(/\{ (\d+), (\d+), "(angband\.[^"]+)" \},/g)]
  .map(m => [Number(m[1]), Number(m[2]), m[3]]);
 const spellBindings = [...helper.matchAll(/\{ (\d+), (\d+), (\d+), "(angband\.[^"]+)", "(angband\.[^"]+)" \},/g)]
  .map(m => [Number(m[1]), Number(m[2]), Number(m[3]), m[4], m[5]]);
 const expectedBooks = [], expectedSpells = [];
 for (const cls of manifest.records.classes) for (const book of cls.books) {
  const base = `angband.player_class.${cls.class_key}.book.${book.book_key}`;
  expectedBooks.push([cls.cidx, book.bidx, `${base}.name`]);
  for (const spell of book.spells) {
   expectedSpells.push([cls.cidx, book.bidx, spell.sidx,
    `${base}.spell.${spell.spell_key}.name`, `${base}.spell.${spell.spell_key}.description`]);
  }
 }
 assert.deepEqual(bookBindings, expectedBooks);
 assert.deepEqual(spellBindings, expectedSpells);
 assert.equal(bookBindings.length, 30); assert.equal(spellBindings.length, 163);
 const ids = [...bookBindings.map(b => b[2]), ...spellBindings.flatMap(s => s.slice(3))];
 assert.equal(new Set(ids).size, 356);
 for (const id of ids) assert.ok(Object.hasOwn(en, id), id);
 assert.doesNotMatch(helper, /strcmp|spell->name|spell->text|upstream_name|strstr/);
});

test('projection is bounded, typed and gated without extra simulation or knowledge work', () => {
 assert.doesNotMatch(helper, /\b(?:randint\w*|Rand\w*|dice_roll|effect_avg_damage|effect_projection|spell_chance|spell_by_index|player_object_to_book|object_desc|get_spell_info|handle_stuff|msg|text_out)\s*\(/);
 assert.doesNotMatch(helper, /\b(?:p|spell)->[\w.\->\[\]]+\s*=(?!=)/);
 assert.match(helper, /bidx >= p->class->magic.num_books \|\| sidx >= p->class->magic.total_spells/);
 assert.match(helper, /binding->cidx == p->class->cidx && binding->bidx == bidx &&/);
 assert.match(helper, /state != AB_SPELL_ILLEGIBLE\) \{\n  ab_spell_text/);
 assert.match(helper, /state != AB_SPELL_ILLEGIBLE\) \{\n  ab_spell_integer\(&event, "level"/);
 assert.match(helper, /if \(visible && binding\) ab_spell_text\("description", binding->description_id\)/);
 assert.match(helper, /__clear:description/);
 assert.match(helper, /key < 0x20 \|\| key > 0x7e/);
 assert.match(helper, /"illegible", "forgotten", "worked", "untried", "unknown", "difficult"/);
 assert.match(helper, /param_begin\(event, name, "integer"\)/);
 assert.match(helper, /param_begin\(event, name, "display_token"\)/);
 assert.match(helper, /json_string\(event, value\)/);
 assert.match(helper, /ab_semantic_event_emit_control\(&event\)/);
 for (const field of ['level', 'mana', 'fail', 'color']) assert.ok(helper.includes(`ab_spell_integer(&event, "${field}"`));
 // Control events bypass Rust formatting; completed English is never a parameter.
 const writer = read('logic/web-semantic.c');
 assert.match(writer, /localized = control \? "" : ab_rs_review_event/);
 assert.doesNotMatch(writer, /control && \(!event->ui_control \|\| event->parameter_count\)/);
});

test('browser adapter displays Rust-owned spell rows and clears a replaced model', () => {
 const text = 'a) 魔法の矢 · 未習得 · レベル 1 · 魔力 1 · 失敗率 22%';
 const model = parsePresentationModel({ schema_version: 1, locale: 'ja', state_summary: '',
  sections: [{ key: 'spells', heading: '呪文', blocks: [{ kind: 'paragraph', key: 'row.0.name', text,
   selected: false, color: null, activation_key: null }] }], messages: [], message_ids: [], missing_ids: [],
  semantic: { scopes: [], messages: [] } });
 class Element {
  children = []; textContent = ''; attributes = {};
   setAttribute(name,value) { this.attributes[name] = value; }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
 }
 const document_ = { createElement: () => new Element() }, container = new Element();
 renderPresentationModel(container, model, null, document_);
 assert.equal(container.children[0].children[1].textContent, text);
 assert.ok(helper.includes('"row.%d.name"'));
 assert.ok(helper.includes('"__clear:row.%d.name"'));
 renderPresentationModel(container, EMPTY_PRESENTATION_MODEL, null, document_);
 assert.equal(container.children.length, 0);
 const rust = read('rust/src/semantic_presentation.rs');
 assert.ok(rust.includes('__spell_row:'));
 assert.ok(rust.includes('spell_replacement_removes_unreadable_metadata_and_reset_removes_scope'));
});
