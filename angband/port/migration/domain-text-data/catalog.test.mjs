import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const port = path.resolve(directory, '../..');
const upstream = process.env.ANGBAND_PRISTINE ?? 'C:/Users/kit/gameme/jnethack/jrouge/angband/upstream/angband-4.2.6';
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const inventory = read('inventory.json'), manifest = read('source-manifest.json');
const en = read('en.json'), ja = read('ja.json'), schema = read('schema.json');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('all nine data files and both canonical enum tables retain exact pristine upstream bytes', () => {
 assert.equal(inventory.upstream_commit, 'f3082213b73f3e463e3d0d60bff4b00462beae6e');
 assert.equal(inventory.sources.length, 11);
 const original = JSON.parse(fs.readFileSync(path.join(port, 'inventory/source_file_manifest.json'), 'utf8'));
 for (const source of inventory.sources) {
  const bytes = fs.readFileSync(path.join(upstream, source.file));
  assert.equal(bytes.length, source.bytes);
  assert.equal(hash(bytes), source.sha256);
  assert.equal(original.find(row => row.path === source.file).sha256, source.sha256);
  if (source.file.startsWith('lib/gamedata/')) assert.equal(hash(fs.readFileSync(path.join(port, source.file.slice(4).replace('gamedata/', 'data/gamedata/')))), source.sha256);
 }
});

test('all runtime endpoints have reviewed Japanese, schema and immutable source identity', () => {
 assert.equal(manifest.entries.length, 1069);
 assert.deepEqual(Object.keys(en).sort(), Object.keys(ja).sort());
 assert.deepEqual(Object.keys(en).sort(), Object.keys(schema.entries).sort());
 assert.deepEqual(inventory.coverage.by_file, { object:161, activation:164, player_timed:275, trap:128, terrain:81, shape:41, curse:61, artifact:143, ego_item:5 });
 for (const entry of manifest.entries) {
  assert.equal(en[entry.id], entry.english);
  assert.equal(ja[entry.id], entry.japanese);
  assert.ok(entry.sources.length > 0);
  assert.equal(entry.japanese.includes('\ufffd'), false);
  if (entry.english && entry.id !== 'domain.message.terrain.damage') assert.notEqual(entry.english, entry.japanese, entry.id);
  const japaneseNumbers = new Set(entry.japanese.match(/[0-9]+/g) ?? []);
  for (const number of new Set(entry.english.match(/[0-9]+/g) ?? [])) assert.ok(japaneseNumbers.has(number), `Lost numeric fact ${entry.id}:${number}`);
  assert.ok(['native_custom_grammar','selected_field_composition'].includes(entry.role) || entry.canonical);
 }
});

test('native custom tags retain every occurrence and use source-selected typed descriptors', () => {
 const tags = value => [...value.matchAll(/\{([a-z]+)\}/g)].map(match => match[1]).sort();
 const expectedTypes = { name:'KnownObjectDescription', kind:'KnownObjectDescription', s:'DomainCustomVerbSuffix', is:'DomainCustomCopula' };
 assert.equal(inventory.entries.filter(entry => entry.native_custom_tags.length).length, 64);
 for (const entry of manifest.entries) {
  assert.deepEqual(tags(entry.english), tags(entry.japanese), entry.id);
  assert.deepEqual(entry.parameters.map(parameter => parameter.name).sort(), [...new Set(tags(entry.english))], entry.id);
  for (const parameter of entry.parameters) if (entry.role !== 'selected_field_composition') assert.equal(parameter.type, expectedTypes[parameter.name]);
 }
 assert.equal(ja['domain.custom_message.hands'], '両手');
 for (const key of ['verb.singular','verb.plural','copula.singular','copula.plural']) assert.equal(ja[`domain.custom_message.${key}`], '');
});

test('activation and curse array identities follow native reverse linked-list population', () => {
 for (const file of ['activation', 'curse']) {
  const records = inventory.records[file];
  const field = file === 'curse' ? 'curse_index' : 'activation_index';
  for (const record of records) assert.equal(record.canonical[field], records.length - record.source_ordinal);
 }
 const curses = inventory.records.curse;
 assert.equal(curses.find(row => row.identity === 'air swing').canonical.curse_index, 1);
 assert.equal(curses.find(row => row.identity === 'vulnerability').canonical.curse_index, 27);
 const native = fs.readFileSync(path.join(upstream, 'src/obj-init.c'), 'utf8');
 assert.match(native, /for \(act = parser_priv\(p\); act; act = next, count\+\+\)/);
 assert.match(native, /activations\[count\]\.index = count/);
});

test('shape blow selection preserves native reverse order and duplicate weighted branches', () => {
 const native = fs.readFileSync(path.join(upstream, 'src/init.c'), 'utf8');
 assert.match(native, /blow->next = shape->blows;\s*shape->blows = blow/);
 for (const record of inventory.records.shape) {
  for (const blow of record.blows ?? []) {
   const entry = inventory.entries.find(entry => entry.id === `domain.shape.${record.key}.blow.${blow.ordinal}.verb`);
   assert.equal(entry.canonical.blow_ordinal, record.blows.length - 1 - blow.ordinal);
   assert.equal(entry.english, blow.text);
  }
 }
 const bear = inventory.entries.filter(entry => entry.id.startsWith('domain.shape.bear.blow.') && entry.english === 'hit');
 assert.equal(bear.length, 2);
 assert.notEqual(bear[0].canonical.blow_ordinal, bear[1].canonical.blow_ordinal);
});

test('native ignored pre-effect message and timed sentinel slots are not invented runtime text', () => {
 assert.equal(manifest.ignored_native_fields.length, 2);
 assert.deepEqual(manifest.ignored_native_fields.map(entry => entry.id).sort(), ['domain.player_timed.food.grade.6.leave_message', 'domain.shape.werewolf.effect_message']);
 assert.equal(Object.hasOwn(en, 'domain.shape.werewolf.effect_message'), false);
 const parser = fs.readFileSync(path.join(upstream, 'src/init.c'), 'utf8');
 assert.match(parser, /effect = shape->effect;\s*if \(effect == NULL\) \{\s*return PARSE_ERROR_NONE/);
 for (const record of inventory.records.player_timed) for (const grade of record.grades ?? []) {
  for (const [field, role] of [['name','status_name'], ['up','enter_message']]) if (grade[field].length === 1)
   assert.equal(Object.hasOwn(en, `domain.player_timed.${record.key}.grade.${grade.grade}.${role}`), false);
 }
});

test('trailing empty optional timed down-message is retained as parser-absent evidence, never registered', () => {
 const id = 'domain.player_timed.food.grade.6.leave_message';
 const declared = inventory.entries.find(entry => entry.id === id);
 assert.equal(declared.native_ignored, true);
 assert.deepEqual(declared.canonical, { timed_index:10, code:'FOOD', grade:6 });
 assert.equal(declared.english, '');
 const historical = manifest.ignored_native_fields.find(entry => entry.id === id);
 assert.equal(historical.japanese, '');
 assert.match(historical.ignored_reason, /optional sym down_msg.*trailing empty token.*down_msg NULL/);
 const line = fs.readFileSync(path.join(upstream, declared.file), 'utf8').split(/\r?\n/)[declared.source_lines[0] - 1];
 assert.equal(line, 'grade:g:100:Full:You are full!:');
 const nativeParser = fs.readFileSync(path.join(upstream, 'src/parser.c'), 'utf8');
 assert.match(nativeParser, /tok = strtok\(sp, ":"\)/);
 assert.match(nativeParser, /if \(!tok\) \{[\s\S]*?if \(!\(s->type & PARSE_T_OPT\)\)[\s\S]*?break;/);
 const timedParser = fs.readFileSync(path.join(upstream, 'src/player-timed.c'), 'utf8');
 assert.match(timedParser, /if \(parser_hasval\(p, "down_msg"\)\) \{\s*l->down_msg = string_make\(parser_getsym\(p, "down_msg"\)\);/);
 for (const catalog of [en, ja, schema.entries]) assert.equal(Object.hasOwn(catalog, id), false);
 assert.equal(manifest.entries.some(entry => entry.id === id), false);
 assert.equal(fs.readFileSync(path.join(directory, 'domain-bindings.inc'), 'utf8').includes(id), false);
});

test('artifact alternate activation branch and every actual prose endpoint are retained', () => {
 assert.equal(manifest.entries.filter(entry => entry.role === 'alternate_activation_message').length, 5);
 assert.equal(manifest.entries.filter(entry => entry.id.startsWith('domain.artifact.') && entry.role === 'description').length, 138);
 assert.equal(manifest.entries.filter(entry => entry.id.startsWith('domain.ego_item.') && entry.role === 'description').length, 5);
 const source = fs.readFileSync(path.join(upstream, 'src/cmd-obj.c'), 'utf8');
 const start = source.indexOf('static void activation_message');
 const body = source.slice(start, source.indexOf('\n}', start) + 2);
 assert.match(body, /if \(!obj->activation\) return/);
 assert.match(body, /if \(!obj->activation->message\) return/);
 assert.match(body, /obj->artifact && obj->artifact->alt_msg/);
 assert.ok(body.indexOf('!obj->activation->message') < body.indexOf('obj->artifact &&'));
});

test('verification binds the exact complete catalog outputs rather than placeholder status', () => {
 const report = read('verification.json');
 assert.equal(report.data_endpoints, 1059);
 assert.equal(report.catalog_entries, 1069);
 assert.equal(report.missing_japanese, 0);
 assert.equal(manifest.complete_game_translation, false);
 assert.equal(manifest.status, 'reviewed_data_catalog_awaiting_runtime_binding');
 for (const output of report.outputs) {
  const bytes = fs.readFileSync(path.join(directory, output.file));
  assert.equal(bytes.length, output.bytes);
  assert.equal(hash(bytes), output.sha256);
 }
});
