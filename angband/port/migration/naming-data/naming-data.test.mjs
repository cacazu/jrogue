import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const port = resolve(here, '../..');
const json = name => JSON.parse(readFileSync(resolve(here, name), 'utf8'));
const inventory = json('source-records.json');
const bindings = json('source-bindings.json');
const manifest = json('source-manifest.json');
const grammar = json('grammar.json');
const en = json('en.json');
const ja = json('ja.json');
const rules = new Map(grammar.rules.map(rule => [rule.role, rule]));
const P = 'angband.naming.';
const local = (role, params = {}) => rules.get(role).render.ja.replace(/\{([a-z_]+)\}/g,
  (token, name) => Object.hasOwn(params, name) ? String(params[name]) : token);

test('pinned source hashes remain exact and all naming domains have bilingual coverage', () => {
  for (const source of inventory.sources) {
    const content = readFileSync(resolve(port, source.file));
    assert.equal(content.length, source.bytes, source.file);
    assert.equal(createHash('sha256').update(content).digest('hex'), source.sha256, source.file);
  }
  assert.equal(manifest.upstream_commit, 'f3082213b73f3e463e3d0d60bff4b00462beae6e');
  assert.deepEqual(Object.keys(en), Object.keys(ja));
  assert.equal(Object.keys(en).length, 2130);
  assert.equal(manifest.entries.length, 2130);
  assert.equal(manifest.coverage.monster_races, 624);
  assert.equal(manifest.coverage.explicit_monster_plurals, 96);
  assert.equal(manifest.coverage.monster_possessive_stems, 60);
  assert.equal(manifest.coverage.object_named_kinds, 409);
  assert.equal(manifest.coverage.source_object_kinds, 375);
  assert.equal(manifest.coverage.class_generated_unique_book_kinds, 20);
  assert.equal(manifest.coverage.artifact_generated_dummy_kinds, 14);
  assert.equal(manifest.coverage.named_flavor_records, 251);
  assert.equal(manifest.coverage.generated_scroll_title_records, 51);
  assert.equal(manifest.coverage.fixed_artifacts, 138);
  assert.equal(manifest.coverage.ego_records, 107);
  assert.equal(manifest.coverage.grammar_rules, 125);
  assert.equal(manifest.runtime_integrated, false);
  assert.equal(manifest.coverage.complete_game_localization, false);
  const emptyJa = new Set(['object.prefix.definite', 'object.prefix.a', 'object.prefix.an',
    'monster.article.a', 'monster.article.an', 'monster.article.definite', 'monster.comma']);
  for (const entry of manifest.entries) {
    assert.equal(en[entry.id], entry.english);
    assert.equal(ja[entry.id], entry.japanese);
    if (entry.role !== 'naming_grammar') {
      assert.match(entry.japanese, /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u, entry.id);
      assert.doesNotMatch(entry.japanese, /[A-Za-z]/, entry.id);
      assert.ok(entry.sources.length > 0, entry.id);
    } else if (entry.japanese === '') {
      assert.ok(emptyJa.has(entry.grammar_role), entry.id);
    }
  }
});

test('every English lexeme maps to the exact source field or explicitly derived native pattern', () => {
  const texts = new Map();
  for (const entry of manifest.entries) for (const source of entry.sources) {
    if (!texts.has(source.file)) texts.set(source.file, readFileSync(resolve(port, source.file), 'utf8').split(/\r?\n/));
    const line = texts.get(source.file)[source.line - 1];
    if (entry.role === 'naming_grammar') {
      assert.ok(line.includes(source.literal), `${entry.id}:${source.line}`);
      assert.equal(JSON.parse(source.literal), entry.english);
      assert.equal(source.exact_value, entry.english);
      continue;
    }
    assert.equal(line, source.raw_line, `${entry.id}:${source.line}`);
    assert.equal(line.slice(0, line.indexOf(':')), source.directive);
    assert.equal(line.slice(line.indexOf(':') + 1), source.value);
    let expected = source.value;
    if (entry.role === 'object_kind_name' && source.identity.origin === 'class_book') expected = source.value.split(':')[2];
    else if (entry.role === 'object_kind_name' && source.identity.origin === 'artifact_dummy') expected = `& ${source.value.split(':')[1]}~`;
    else if (entry.role === 'object_base_name') expected = source.value.slice(source.value.indexOf(':') + 1);
    else if (entry.role.startsWith('object_flavor_')) expected = source.value.split(':').slice(source.identity.fixed ? 3 : 2).join(':');
    else if (entry.role === 'monster_race_possessive_stem') expected = source.value.slice(0, entry.source_span.end);
    assert.equal(expected, entry.english, entry.id);
    assert.equal(source.exact_selected_english, entry.english, entry.id);
  }
});

test('private canonical maps preserve parser-generated identities and coalesce displayed roles', () => {
  assert.deepEqual(bindings.monster_races.map(r => r.ridx), Array.from({ length: 624 }, (_, i) => i));
  assert.deepEqual(bindings.artifacts.map(a => a.aidx), Array.from({ length: 138 }, (_, i) => i + 1));
  assert.deepEqual(bindings.egos.map(e => e.eidx), Array.from({ length: 107 }, (_, i) => i));
  assert.equal(bindings.reserved_unnamed_object_kidx, 375);
  assert.ok(!bindings.object_kinds.some(k => k.kidx === 375));
  assert.equal(bindings.object_kinds.at(-1).kidx, 409);
  assert.equal(bindings.object_bases.find(b => b.tval_key === 'gold').name_id, null);
  for (const group of ['object_kinds', 'flavors', 'egos', 'chest_traps']) {
    const same = new Map();
    for (const binding of bindings[group]) {
      if (binding.raw_english === null) continue;
      assert.equal(en[binding.name_id], binding.raw_english);
      assert.ok(Object.hasOwn(ja, binding.name_id));
      if (same.has(binding.raw_english)) assert.equal(binding.name_id, same.get(binding.raw_english));
      same.set(binding.raw_english, binding.name_id);
    }
  }
  const stems = new Map();
  for (const race of bindings.monster_races) {
    assert.equal(en[race.possessive_name_id], race.raw_possessive_name);
    assert.ok(Object.hasOwn(ja, race.counter_id));
    if (race.name_id !== race.possessive_name_id) {
      assert.ok(race.naming_flags.includes('NAME_COMMA'));
      assert.ok(race.raw_english.indexOf(',') < 1024);
      assert.doesNotMatch(race.possessive_name_id, /agent_of_saruman|the_shape_changer|the_mountain_bear/);
      if (stems.has(race.raw_possessive_name)) assert.equal(race.possessive_name_id, stems.get(race.raw_possessive_name));
      stems.set(race.raw_possessive_name, race.possessive_name_id);
    }
    if (race.plural_id) assert.equal(en[race.plural_id], race.raw_plural);
  }
  assert.equal(stems.size, 59);
  assert.equal(bindings.monster_races[321].possessive_name_id, bindings.monster_races[322].possessive_name_id);
  assert.deepEqual(bindings.chest_traps.map(t => t.code), ['NO_TRAP', 'POISON', 'LOSE_STR', 'LOSE_CON', 'SUMMON', 'PARALYZE', 'EXPLODE']);
});

test('grammar typed slots, native markup and deliberate locale-only parameters are reviewed', () => {
  const types = new Set(['integer', 'signed_integer', 'localized_text', 'display_token', 'inscription']);
  for (const rule of grammar.rules) {
    const declared = new Set(Object.keys(rule.parameters));
    const used = new Set();
    for (const locale of ['en', 'ja']) {
      for (const match of rule.render[locale].matchAll(/\{([a-z_]+)\}/g)) {
        if (rule.role.startsWith('object.store.')) continue; // Native literal inscription punctuation.
        assert.ok(declared.has(match[1]), `${rule.role}/${locale}/${match[1]}`);
        used.add(match[1]);
      }
    }
    assert.deepEqual([...used].sort(), [...declared].sort(), rule.role);
    for (const type of Object.values(rule.parameters)) assert.ok(types.has(type), `${rule.role}/${type}`);
    if (rule.role.startsWith('object.basename.')) assert.ok(Object.hasOwn(ja, rule.counter_id));
  }
  for (const entry of manifest.entries) if (entry.english_grammar) {
    assert.equal(entry.english_grammar.map(p => p.raw).join(''), entry.english, entry.id);
    let cursor = 0;
    for (const part of entry.english_grammar) { assert.equal(part.offset, cursor); cursor += part.raw.length; }
  }
  const staff = manifest.entries.find(e => e.grammar_role === 'object.basename.staff.plain');
  assert.equal(staff.english, '& Sta|ff|ves|');
  assert.deepEqual(staff.english_grammar.find(p => p.kind === 'plural_alternative'),
    { kind: 'plural_alternative', singular: 'ff', plural: 'ves', raw: '|ff|ves|', offset: 5 });
  assert.equal(rules.get('object.charges').render.ja.includes('{plural_suffix}'), false);
  assert.equal(rules.get('object.prefix.quantity').render.en.includes('{counter}'), false);
  assert.equal(rules.get('monster.comma').render.en, ',');
  assert.equal(rules.get('monster.comma').render.ja, '');
});

test('shared book labels match the frozen character catalog across all thirty associations', () => {
  const characterEn = JSON.parse(readFileSync(resolve(port, 'migration/character-data/en.json'), 'utf8'));
  const characterJa = JSON.parse(readFileSync(resolve(port, 'migration/character-data/ja.json'), 'utf8'));
  assert.equal(bindings.class_book_associations.length, 30);
  for (const association of bindings.class_book_associations) {
    const kind = bindings.object_kinds.find(k => k.kidx === association.kidx);
    assert.equal(en[kind.name_id], characterEn[association.character_id]);
    assert.equal(ja[kind.name_id], characterJa[association.character_id]);
  }
  const terses = ['magic_book', 'prayer_book', 'nature_book', 'other_book'].map(t => rules.get(`object.basename.${t}.terse`));
  for (const rule of terses) {
    assert.equal(rule.source_english, terses[0].source_english);
    assert.deepEqual(rule.render, terses[0].render);
    assert.deepEqual(rule.parameters, terses[0].parameters);
    assert.equal(rule.counter_id, terses[0].counter_id);
  }
});

test('Japanese composition preserves disclosed identity, quantity, artifact relation and numeric units', () => {
  const ruby = ja[bindings.flavors.find(f => f.raw_english === 'Ruby').modifier_id];
  const ring = local('object.basename.ring.flavored', { modifier: ruby });
  const flames = ja[bindings.object_kinds.find(k => k.raw_english === 'Flames').name_id];
  const aware = local('object.compose.aware_kind', { base: ring, suffix: flames });
  assert.equal(aware, '火炎のルビーの指輪');
  assert.equal(local('object.compose.quantity', { number: 3, counter: local('counter.ko'), base: aware }), '3個の火炎のルビーの指輪');
  assert.equal(local('object.compose.no_more', { base: aware }), '火炎のルビーの指輪はもうない');
  assert.equal(local('object.compose.artifact_of', { base: '玻璃瓶', suffix: ja[P + 'artifact.of_galadriel.name'] }), 'ガラドリエルの玻璃瓶');
  assert.equal(local('object.compose.artifact_quoted', { base: '短剣', suffix: ja[P + 'artifact.sting.name'] }), '短剣『つらぬき丸』');
  assert.equal(local('object.compose.ego', { base: '短剣', suffix: ja[P + 'ego.blessed.modifier'] }), '祝福された短剣');
  const wormtongue = bindings.monster_races.find(r => r.ridx === 116);
  assert.equal(ja[wormtongue.possessive_name_id] + local('monster.comma') + local('monster.possessive'), '蛇の舌の');
  assert.equal(local('object.fuel', { turns: 123 }), '（残り123ターン）');
  assert.equal(local('object.dice', { dice: 2, sides: 6 }), '（2d6）');
  assert.equal(local('object.charges', { charges: 5 }), '（残り5回）');
  assert.equal(local('object.charging.count', { number: 2 }), '（2本充填中）');
  assert.equal(local('object.basename.scroll.flavored', { modifier: 'DUM DAR' }), '『DUM DAR』と記された巻物');
});

test('authored names preserve stage/headcount distinctions and effect terminology', () => {
  const hydra = bindings.monster_races.filter(r => /^[2-9]-headed hydra$/.test(r.raw_english));
  assert.equal(hydra.length, 8);
  for (const race of hydra) assert.match(ja[race.name_id], new RegExp(`^${race.raw_english[0]}つ首の`));
  for (const [english, word] of [['baby', '幼生'], ['young', '若い'], ['mature', '成体'], ['ancient', '古代']]) {
    const races = bindings.monster_races.filter(r => r.raw_english.startsWith(english + ' ') && r.raw_english.endsWith(' dragon'));
    assert.ok(races.length >= 6, english);
    for (const race of races) assert.ok(ja[race.name_id].includes(word), race.raw_english);
  }
  const kind = english => ja[bindings.object_kinds.find(k => k.raw_english === english).name_id];
  assert.equal(kind('Restoration'), '能力回復');
  assert.equal(kind('Dispel Undead'), 'アンデッド消散');
  assert.equal(kind('Banishment'), '追放');
  assert.equal(kind('ESP'), 'テレパシー');
  assert.equal(ja[P + 'grammar.object.annotation.tried'], '試用済み');
  const treasure = rules.get('object.literal.treasure');
  assert.equal(treasure.source_english, 'treasure');
  assert.equal(treasure.render.ja, '宝');
  assert.ok(treasure.sources.some(s => s.upstream_file === 'src/mon-util.c' && s.line === 1514));
  const generated = bindings.flavors.filter(f => f.origin === 'generated_scroll_title');
  assert.equal(generated.length, 51);
  for (const flavor of generated) {
    assert.equal(flavor.raw_english, null);
    assert.equal(flavor.name_id, null);
    assert.equal(flavor.modifier_id, null);
  }
});
