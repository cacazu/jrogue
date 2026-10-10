import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const commit = 'f3082213b73f3e463e3d0d60bff4b00462beae6e';
const english = {}, japanese = {}, entries = {};
const inputs = [];

function placeholders(value) {
  const names = new Set();
  for (let index = 0; index < value.length;) {
    const char = value[index++];
    if (char !== '{' && char !== '}') continue;
    if (value[index] === char) { index++; continue; }
    assert.equal(char, '{', 'unmatched template brace');
    const end = value.indexOf('}', index);
    assert.ok(end >= index, 'unclosed template placeholder');
    const name = value.slice(index, end);
    assert.match(name, /^[a-z][a-z0-9_]*$/);
    names.add(name); index = end + 1;
  }
  return [...names].sort();
}

function add(record, ja = record.japanese) {
  assert.match(record.id, /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/);
  assert.ok(!Object.hasOwn(entries, record.id), `duplicate reviewed ID ${record.id}`);
  assert.equal(typeof record.english, 'string');
  assert.equal(typeof ja, 'string');
  const emptyCombatGrammar = record.role === 'grammar' && record.parameters?.length === 0 &&
    ['angband.combat.grammar.has.monster', 'angband.combat.grammar.has.player',
      'angband.combat.grammar.none', 'angband.combat.grammar.stop.none',
      'angband.combat.grammar.subject.separator'].includes(record.id);
  const emptyDomainRole = new Map([
    ['domain.terrain.lava.look_prefix', 'look_prefix'],
    ['domain.custom_message.verb.singular', 'native_custom_grammar'],
    ['domain.custom_message.verb.plural', 'native_custom_grammar'],
    ['domain.custom_message.copula.singular', 'native_custom_grammar'],
    ['domain.custom_message.copula.plural', 'native_custom_grammar'],
  ]).get(record.id);
  const emptyDomainGrammar = emptyDomainRole !== undefined && record.role === emptyDomainRole && record.parameters?.length === 0;
  const emptyKnowledgeRoles = new Set([
    'speed_adjective.normal_speed_preposition','speed_multiplier.multiplier_preposition',
    'clause.before_conjunction_space','clause.item_separator_space',
    'spell_clause.before_conjunction_space','spell_clause.item_separator_space',
    'movement.speed_spacing','toughness.hit_article_vowel',
    'experience.unique_kill_subject','experience.normal_kill_subject','experience.experience_transition',
    ...['remains','remain','has','have','article_a','article_an','ordinal_th','ordinal_st','ordinal_nd','ordinal_rd','singular','plural'].map(role=>`lexeme.morphology.${role}`),
    ...['clause_continues','no_randomness','no_pursuit_clause','no_quality','no_pack_hunt','no_intelligence','no_frequency','complete_damage','no_damage_separator'].map(role=>`lexeme.projection.${role}`),
  ]);
  const knowledgeRole = record.id.startsWith('angband.knowledge.lore.') ? record.id.slice('angband.knowledge.lore.'.length) : '';
  const emptyKnowledgeGrammar = emptyKnowledgeRoles.has(knowledgeRole) && record.role === `lore.${knowledgeRole}` && Object.keys(record.parameters ?? {}).length === 0;
  const emptyStatGrammar = record.id === 'game.stat.damage.quake.empty' && record.role === 'native_selected_lexeme' && record.parameters?.length === 0;
  const emptyObjectRoles = new Set([
    'object_combat.range_prefix','object_combat.range_suffix','object_combat.breakage_suffix',
    'object_light.intensity_prefix','object_light.intensity_suffix','object_recharge.duration_prefix',
    'lexeme.plural.singular','lexeme.plural.plural','lexeme.projection.empty',
    'lexeme.projection.no_current_speed','lexeme.projection.no_maximum',
    'lexeme.origin_article.a','lexeme.origin_article.an','lexeme.origin_comma.comma',
  ]);
  const objectRole = record.id.startsWith('angband.knowledge.object_info.') ? record.id.slice('angband.knowledge.object_info.'.length) : '';
  const emptyObjectGrammar = emptyObjectRoles.has(objectRole) && record.role === `object_info.${objectRole}` && Object.keys(record.parameters ?? {}).length === 0;

  // Pinned list locals initialize absent sleep/location fragments to NUL.
  const emptyListLayout = record.id === 'angband.list.layout.empty' && record.role === 'native_selected_lexeme' && record.parameters?.length === 0;
  const emptyEffectGrammar = record.id === 'angband.effect_info.grammar.empty' && record.role === 'effect_empty_grammar' && record.parameters?.length === 0;
  const emptyLookRoles = new Map([
    ['angband.look.empty','empty'], ['angband.look.article.a','article.a'], ['angband.look.article.an','article.an'],
    ['angband.look.terrain.prefix.a','terrain.prefix.a'], ['angband.look.terrain.prefix.an','terrain.prefix.an'],
    ['angband.look.carry.first','carry.first'], ['angband.look.terrain.prefix.some','terrain.prefix.some'],
  ]);
  const emptyLookGrammar = emptyLookRoles.has(record.id) && emptyLookRoles.get(record.id) === record.role && record.parameters?.length === 0;
  assert.ok((record.role === 'layout' && record.parameters?.length === 0) || emptyCombatGrammar || emptyDomainGrammar || emptyKnowledgeGrammar || emptyObjectGrammar || emptyStatGrammar || emptyEffectGrammar || emptyListLayout || emptyLookGrammar || (record.english.length && ja.length), record.id);
  assert.ok(!record.english.includes('\0') && !ja.includes('\0'), record.id);
  assert.ok(!ja.includes('\uFFFD'), `replacement character in reviewed Japanese ${record.id}`);
  const parameters = Array.isArray(record.parameters) ? record.parameters : Object.entries(record.parameters ?? {}).map(([name, type]) => ({ name, type }));
  const names = parameters.map(parameter => parameter.name).sort();
  assert.equal(new Set(names).size, names.length, record.id);
  assert.deepEqual(placeholders(record.english), names, record.id);
  assert.deepEqual(placeholders(ja), names, record.id);
  english[record.id] = record.english;
  japanese[record.id] = ja;
  entries[record.id] = {
    parameters: parameters.map(({ name, type }) => ({ name, type })),
    sources: record.sources ?? [record.source],
    role: record.role ?? record.source_role ?? record.category ?? record.source_kind ?? 'command_message',
    ...(record.identity ? { identity: record.identity } : {}),
    ...(record.native_output_max_bytes !== undefined ? {native_output_max_bytes:record.native_output_max_bytes} : {}),
    ...(record.native_output_english_only !== undefined ? {native_output_english_only:record.native_output_english_only} : {}),
  };
  for (const branch of record.branch_templates ?? []) add(branch);
}

for (const name of ['migration/commands-text.json', 'migration/birth-and-sidebar.json']) {
  const manifest = read(name);
  assert.equal(manifest.upstream_commit, commit);
  for (const record of [...manifest.entries, ...(manifest.supporting_templates ?? [])]) add(record);
  inputs.push(name);
}
const character = read('migration/character-data/source-manifest.json');
const characterJapanese = read('migration/character-data/ja.json');
assert.equal(character.upstream_commit, commit);
for (const record of character.entries) add(record, characterJapanese[record.id]);
inputs.push('migration/character-data/source-manifest.json', 'migration/character-data/ja.json');

// These are producer identities in actual type:gold records, never rendered
// English names. Original order/sval allocation stays in the C data parser.
const money = [
  ['copper', '銅貨'], ['silver', '銀貨'], ['garnets', 'ガーネット'],
  ['gold', '金貨'], ['opals', 'オパール'], ['sapphires', 'サファイア'],
  ['rubies', 'ルビー'], ['diamonds', 'ダイヤモンド'], ['emeralds', 'エメラルド'],
  ['mithril', 'ミスリル'], ['adamantite', 'アダマンタイト'],
];
const objectLines = fs.readFileSync(path.join(root, 'data/gamedata/object.txt'), 'utf8').split(/\r?\n/);
const moneyEntries = money.map(([name, translation]) => {
  const line = objectLines.findIndex((text, index) => text === `name:${name}` && objectLines[index + 1] === 'type:gold');
  assert.ok(line >= 0, `missing original money kind ${name}`);
  return { id: `money.${name}.name`, english: name, japanese: translation, parameters: [],
    source: { file: 'data/gamedata/object.txt', line: line + 1 },
    original_call: objectLines[line], original_english: name, source_kind: 'data_identity',
    identity: { object_type: 'gold', original_name: name },
    notes: 'Display-only catalog; preserve parser-assigned sval and original aggregation branches.' };
});
for (const record of moneyEntries) add(record);

// Whole reviewed static messages are identified at their original producer.
// These are source bindings; they never select IDs from completed runtime text.
const staticManifest = read('migration/message-data/static-manifest.json');
assert.equal(staticManifest.upstream_commit, commit);
assert.equal(staticManifest.reviewed, true);
for (const record of staticManifest.entries) add(record);
inputs.push('migration/message-data/static-manifest.json');

const history = read('migration/history-data/source-manifest.json');
assert.equal(history.upstream_commit, commit);
for (const record of history.entries) add(record);
inputs.push('migration/history-data/source-manifest.json');

const dynamic = read('migration/message-data/dynamic-manifest.json');
assert.equal(dynamic.upstream_commit, commit);
assert.equal(dynamic.reviewed, true);
for (const record of dynamic.entries) add(record);
inputs.push('migration/message-data/dynamic-manifest.json');

for (const name of ['migration/interface-data/source-manifest.json', 'migration/help-data/source-manifest.json', 'migration/ui-residual-message-data/source-manifest.json', 'migration/recall-knowledge-data/source-manifest.json', 'migration/character-matrix-data/source-manifest.json', 'migration/context-menu-data/source-manifest.json', 'migration/look-target-data/source-manifest.json', 'migration/game-history-data/source-manifest.json', 'migration/chest-message-data/source-manifest.json', 'migration/message-recall-layout-data/source-manifest.json']) {
  const manifest = read(name);
  assert.equal(manifest.upstream_commit, commit);
  for (const record of manifest.entries) add(record);
  inputs.push(name);
}
{
  const name = 'migration/store-comment-data/source-manifest.json';
  const manifest = read(name);
  assert.equal(manifest.upstream_commit, commit);
  for (const record of manifest.entries) add(record);
  inputs.push(name);
}

for (const [id, name, type] of [
  ['naming.object.description', 'object', 'KnownObjectDescription'],
  ['naming.monster.description', 'monster', 'MonsterDescription'],
]) add({id, english: `{${name}}`, japanese: `{${name}}`, parameters: [{name, type}],
  role: 'owned_naming_projection', source: {file: name === 'object' ? 'logic/obj-desc.c' : 'logic/mon-desc.c', function: name === 'object' ? 'object_desc' : 'monster_desc'}});

// The combat catalog includes selected-source aliases and pure composition.
// C producer integration is recorded separately; availability is not coverage.
{
  const schemaFile = 'migration/combat-data/schema.json';
  const enFile = 'migration/combat-data/en.json', jaFile = 'migration/combat-data/ja.json';
  const schema = read(schemaFile), en = read(enFile), ja = read(jaFile);
  assert.equal(schema.upstream_commit, commit);
  for (const [id, record] of Object.entries(schema.entries))
    add({id, ...record, english: en[id], japanese: ja[id]});
  inputs.push(schemaFile, enFile, jaFile);
}

// Parsed data prose and grammar remain separate source identities. These
// entries are selected by native record/branch captures, never English lookup.
{
  const directory = 'migration/domain-text-data';
  const manifest = read(`${directory}/source-manifest.json`);
  const en = read(`${directory}/en.json`), ja = read(`${directory}/ja.json`);
  assert.equal(manifest.upstream_commit, commit);
  for (const record of manifest.entries) add({...record, english: en[record.id],
    source: {file: record.file, lines: record.source_lines, canonical: record.canonical}}, ja[record.id]);
  inputs.push(`${directory}/source-manifest.json`, `${directory}/en.json`, `${directory}/ja.json`, `${directory}/schema.json`);
}
{
  const directory = 'migration/knowledge-text-data';
  const manifest = read(`${directory}/source-manifest.json`);
  const schemas = read(`${directory}/schema.json`);
  const en = read(`${directory}/en.json`), ja = read(`${directory}/ja.json`);
  assert.equal(manifest.upstream_commit, commit);
  for (const [id, record] of Object.entries(manifest.entries)) add({id,
    english: en[id], japanese: ja[id], parameters: schemas[id], role: record.role,
    sources: record.associations.flatMap(association => association.sources)});
  inputs.push(`${directory}/source-manifest.json`, `${directory}/schema.json`, `${directory}/en.json`, `${directory}/ja.json`);
}

for (const family of ['object', 'stat', 'realm', 'monster-action', 'store-welcome', 'list']) {
  const directory = `migration/${family}-message-data`;
  const manifest = read(`${directory}/source-manifest.json`);
  const schema = read(`${directory}/schema.json`);
  const en = read(`${directory}/en.json`), ja = read(`${directory}/ja.json`);
  assert.equal(manifest.upstream_commit, commit);
  for (const [id, specification] of Object.entries(schema.entries)) {
    const record = Array.isArray(manifest.entries) ? manifest.entries.find(entry => entry.id === id) : manifest.entries?.[id];
    const sources = specification.sources ?? (specification.source_indices ?? record?.source_indices ?? []).map(index => {
      const producer = manifest.source_callsites.find(call => call.source_index === index);
      assert.ok(producer, `${id}: missing original producer ${index}`);
      return producer.source;
    });
    add({id, english:en[id], parameters:specification.parameters, sources,
      role:specification.role ?? record?.source_role ?? (id.includes('.message.') ? 'original_message' : 'native_selected_lexeme'),
      ...(specification.identity ? {identity:specification.identity} : {})},ja[id]);
  }
  inputs.push(`${directory}/source-manifest.json`,`${directory}/schema.json`,`${directory}/en.json`,`${directory}/ja.json`);
}

// These are imports of shared immutable naming lexemes for the source UI's
// direct race/base/ego/artifact labels. Descriptors still use naming grammar;
// imported endpoints are not independently authored translations or producers.
{
  const directory='migration/naming-data';
  const manifest=read(`${directory}/source-manifest.json`);
  const en=read(`${directory}/en.json`),ja=read(`${directory}/ja.json`);
  const roles=new Set(['monster_race_name','monster_base_display_name','ego_name','artifact_name']);
  assert.equal(manifest.upstream_commit,commit);
  for(const record of manifest.entries.filter(entry=>roles.has(entry.role))) {
    add({...record,english:en[record.id],role:`source_shared_${record.role}`},ja[record.id]);
  }
  inputs.push(`${directory}/source-manifest.json`,`${directory}/en.json`,`${directory}/ja.json`);
}
// Source-selected effect templates and lexemes; the C graph owns every
// branch, numeric fact and native buffer boundary before pure formatting.
for (const directory of ['migration/effect-description-data','migration/spell-preview-data']) {
  const schema=read(`${directory}/schema.json`);
  const en=read(`${directory}/en.json`),ja=read(`${directory}/ja.json`);
  assert.equal(schema.upstream_commit,commit);
  for(const [id,spec] of Object.entries(schema.entries)) add({id,english:en[id],japanese:ja[id],parameters:spec.parameters,sources:spec.sources,
    role:id==='angband.effect_info.grammar.empty'?'effect_empty_grammar':'effect_source_template'});
  inputs.push(`${directory}/schema.json`,`${directory}/en.json`,`${directory}/ja.json`);
}
// The original61 AB_MSG(T) producers already own44 reviewed zero-param IDs.
// Import their authoritative catalogs so owned recall/save descriptors use the
// same pure event formatter; completed native English is never an identity.
{
 const en=read('locales/game-en.json'),ja=read('locales/game-ja.json');
 assert.equal(en._meta.upstream_commit,commit);assert.equal(ja._meta.upstream_commit,commit);
 const source=fs.readFileSync(path.join(root,'logic/cmd-cave.c'),'utf8');
 const bindings=[...source.matchAll(/\bAB_MSGT?\("([^"]+)"/g)];
 assert.equal(bindings.length,61);
 const ids=[...new Set(bindings.map(binding=>binding[1]))].sort();
 assert.equal(ids.length,44);assert.deepEqual(ids,Object.keys(en.messages).sort());assert.deepEqual(ids,Object.keys(ja.messages).sort());
 for(const id of ids) add({id,english:en.messages[id],japanese:ja.messages[id],parameters:[],role:'existing_source_static_message',
  sources:bindings.filter(binding=>binding[1]===id).map(binding=>({file:'logic/cmd-cave.c',lines:[source.slice(0,binding.index).split('\n').length],semantic_macro:binding[0]}))});
 inputs.push('locales/game-en.json','locales/game-ja.json','logic/cmd-cave.c');
}
const sorted = object => Object.fromEntries(Object.entries(object).sort(([left], [right]) => left.localeCompare(right, 'en')));
const schema = {
  schema_version: 1, upstream_commit: commit, complete_game_translation: false,
  status: 'source_connected_unbuilt', catalog_entries: Object.keys(entries).length,
  entries: sorted(entries),
  input_provenance: inputs.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') })),
};
const files = new Map([
  ['locales/review-en.json', sorted(english)], ['locales/review-ja.json', sorted(japanese)],
  ['locales/review-schema.json', schema],
  ['migration/command-descriptors.json', { schema_version: 1, upstream_commit: commit, status: 'reviewed_not_integrated', complete_game_translation: false, entries: moneyEntries }],
]);
for (const [file, value] of files) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (process.argv.includes('--check')) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), content, `stale generated catalog ${file}`);
  else fs.writeFileSync(path.join(root, file), content);
}
// These four context headings use the same source-backed endpoints as
// reviewed events. Keep the presentation label catalog synchronized.
for(const [locale,values] of [['en',english],['ja',japanese]]) {
  const file=`web/i18n/${locale}.json`, labels=read(file);
  for(const id of ['semantic.context.rune_lore','semantic.context.shape_lore','semantic.context.quantity_editor','semantic.context.choice_dialog']) {
    if(Object.hasOwn(values,id)) labels[id]=values[id];
  }
  const content=`${JSON.stringify(labels,null,2)}\n`;
  if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path.join(root,file),'utf8'),content,`stale source context labels ${file}`);
  else fs.writeFileSync(path.join(root,file),content);
}
// Bind optional owned-message storage to the complete reviewed catalogs.
const recallDigest=createHash('sha256').update(JSON.stringify([sorted(english),sorted(japanese),sorted(entries)])).digest('hex');
const recallHeader='logic/web-message-recall.h';
const oldRecallHeader=fs.readFileSync(path.join(root,recallHeader),'utf8');
const newRecallHeader=oldRecallHeader.replace(/(#define AB_MESSAGE_RECALL_CATALOG_SHA256 )"[a-f0-9]{64}"/,`$1"${recallDigest}"`);
assert.ok(newRecallHeader.includes(`AB_MESSAGE_RECALL_CATALOG_SHA256 "${recallDigest}"`),'recall digest macro');
if(process.argv.includes('--check')) assert.equal(oldRecallHeader,newRecallHeader,'stale recall catalog binding');
else fs.writeFileSync(path.join(root,recallHeader),newRecallHeader);
console.log(JSON.stringify({ passed: true, catalogEntries: schema.catalog_entries, characterEntries: character.entries.length, moneyEntries: moneyEntries.length, status: schema.status, engineBuilt: false }));
