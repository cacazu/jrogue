import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const port = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(port, name), 'utf8');
const json = name => JSON.parse(read(`migration/character-data/${name}`));
const en = json('en.json'), ja = json('ja.json');
const manifest = json('source-manifest.json'), review = json('wording-review.json');
const entry = suffix => Object.entries(ja).filter(([id]) => id.endsWith(suffix));

test('469 flat locale values preserve exact pinned English source and typed parameter coverage', () => {
 assert.equal(Object.keys(en).length, 469);
 assert.deepEqual(Object.keys(ja).sort(), Object.keys(en).sort());
 assert.equal(crypto.createHash('sha256').update(read('migration/character-data/en.json')).digest('hex'),
  'cee6fe3bc0c3e4f1ae151627c343aa2ae6b9065681d894a73e6b23a366b0691d');
 const mapped = new Set();
 for (const source of manifest.sources) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(port, source.file))).digest('hex'), source.sha256);
 }
 for (const item of manifest.entries) {
  assert.equal(item.english, en[item.id]);
  assert.deepEqual(item.parameters, {});
  assert.equal(item.sources.map(s => s.exact_value).join(''), en[item.id]);
  for (const source of item.sources) {
   const line = read(source.file).split(/\r?\n/)[source.line - 1];
   assert.equal(line, source.raw_line);
   mapped.add(`${source.file}:${source.line}`);
  }
  assert.match(ja[item.id], /[\u3040-\u30ff\u3400-\u9fff]/u);
  assert.doesNotMatch(en[item.id] + ja[item.id], /\{[^{}]*\}|\ufffd/u);
  const numeric = en[item.id].replace(/\bradius-(\d+)/g, 'radius $1');
  for (const literal of numeric.match(/[+-]?\d+(?:\+\d*d\d+|d\d+|%)?/g) ?? []) {
   assert.ok(ja[item.id].includes(literal), `${item.id}: ${literal}`);
  }
 }
 assert.equal(mapped.size, 637);
 assert.equal(manifest.coverage.excluded_nontext_source_lines, 963);
});

test('all active identities and shared book associations retain consistent Japanese', () => {
 assert.equal(manifest.records.races.length, 11);
 assert.equal(manifest.records.classes.length, 9);
 const shared = new Map();
 let books = 0, spells = 0;
 for (const cls of manifest.records.classes) {
  assert.equal(cls.titles.length, 10);
  for (const book of cls.books) {
   books++;
   const id = `angband.player_class.${cls.class_key}.book.${book.book_key}.name`;
   assert.match(ja[id], /^\[.+\]$/u);
   if (shared.has(book.upstream_book_name)) assert.equal(ja[id], shared.get(book.upstream_book_name));
   shared.set(book.upstream_book_name, ja[id]);
   spells += book.spells.length;
  }
 }
 assert.equal(books, 30); assert.equal(shared.size, 20); assert.equal(spells, 163);
 assert.deepEqual(review.reviewed_ids.slice().sort(), Object.keys(en).sort());
 assert.equal(review.active_effect_symbols_reviewed.length, 75);
 const handlers = read('logic/effect-handler-attack.c') + read('logic/effect-handler-general.c');
 for (const effect of review.active_effect_symbols_reviewed) {
  assert.ok(handlers.includes(`effect_handler_${effect}(`), `missing reviewed effect handler ${effect}`);
 }
 for (const change of review.changes) {
  assert.equal(change.english_preserved, en[change.id]);
  // A later terminology correction can follow an earlier mechanics correction.
  const last = review.changes.filter(c => c.id === change.id).at(-1);
  assert.equal(last.after, ja[change.id]);
  assert.ok(change.source_evidence.length && change.before !== change.after);
 }
});

test('wording follows actual resistance, damage, healing and knowledge rules', () => {
 assert.match(entry('.spell.sleep_evil.description')[0][1], /睡眠に耐性/);
 assert.match(read('logic/list-mon-timed.h'), /MON_TMD\(SLEEP,\s*true,\s*NO,\s*RF_NO_SLEEP/);
 assert.match(read('logic/list-mon-timed.h'), /MON_TMD\(STUN,\s*false,\s*MAX,\s*RF_NO_STUN/);
 assert.match(entry('.spell.maim_foe.description')[0][1], /生き残った敵.*耐性がない敵.*6ターン分/);
 assert.match(entry('.spell.vampire_form.description')[0][1], /基本.*4分の1.*ダメージ/);
 assert.match(read('data/gamedata/shape.txt'), /expr:B:PLAYER_HP:\/ 4/);
 for (const [, value] of entry('.spell.phase_door.description')) {
  assert.match(value, /10マス程度/); assert.doesNotMatch(value, /最大/);
 }
 for (const [, value] of entry('.spell.call_light.description')) assert.match(value, /周囲1マス/);
 assert.match(entry('.spell.create_darkness.description')[0][1], /周囲1マス/);
 assert.doesNotMatch(entry('.spell.berserk_strength.description')[0][1], /HP回復が止まる/);
 assert.match(entry('.spell.brand_ammunition.description')[0][1], /アーティファクト、エゴアイテム、価値のない/);
 assert.doesNotMatch(entry('.spell.brand_ammunition.description')[0][1], /呪われている/);
 for (const [, value] of entry('.spell.minor_healing.description')) assert.match(value, /失ったHP.*大きい方.*20ポイント分軽減/);
 for (const suffix of ['power_sacrifice', 'curse', 'unholy_reprieve']) {
  assert.match(entry(`.spell.${suffix}.description`)[0][1], /基本\d+HP分のダメージ/);
 }
 for (const suffix of ['treasure_detection', 'detection']) {
  assert.match(entry(`.spell.${suffix}.description`)[0][1], /床にある金とアイテムの存在を察知/);
 }
 assert.match(entry('.spell.object_detection.description')[0][1], /金鉱脈、床にある金、アイテム/);
 const glossary = read('docs/TERMINOLOGY.md');
 for (const term of ['知力', '黒の息', '守りの刻印', '囮', 'カオス', '隕石', '轟音', '魔力', '痕跡隠し']) {
  assert.ok(glossary.includes(term)); assert.ok(Object.values(ja).some(v => v.includes(term)));
 }
});
