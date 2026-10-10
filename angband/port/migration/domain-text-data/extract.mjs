// Pinned, source-aware offline inventory. Never used by the game at runtime.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const port = path.resolve(directory, '../..');
const upstream = path.resolve(process.argv[2] ?? 'C:/Users/kit/gameme/jnethack/jrouge/angband/upstream/angband-4.2.6');
const commit = 'f3082213b73f3e463e3d0d60bff4b00462beae6e';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + '\n');
const slug = text => text.replace(/&|~|\|/g, '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const originalManifest = JSON.parse(fs.readFileSync(path.join(port, 'inventory/source_file_manifest.json'), 'utf8'));
const sources = [];
function source(relative) {
 const bytes = fs.readFileSync(path.join(upstream, relative));
 const recorded = originalManifest.find(row => row.path === relative);
 if (!recorded || recorded.sha256 !== sha(bytes) || recorded.bytes !== bytes.length) throw new Error(`Unverified pristine source: ${relative}`);
 sources.push({ file: relative, bytes: bytes.length, sha256: sha(bytes) });
 return bytes.toString('utf8').replace(/\r\n/g, '\n');
}
const indexTable = (file, macro) => [...source(file).matchAll(new RegExp(`^${macro}\\(([^,\\s)]+)`, 'gm'))].map(match => match[1]);
const terrainCodes = indexTable('src/list-terrain.h', 'FEAT');
const timedCodes = indexTable('src/list-player-timed.h', 'TMD');
const roles = {
 object: { msg: 'effect_message', 'vis-msg': 'visible_message', desc: 'description' },
 activation: { msg: 'message', desc: 'description' },
 player_timed: { desc: 'description', 'on-end': 'end_message', 'on-increase': 'increase_message', 'on-decrease': 'decrease_message', 'effect-msg': 'effect_message' },
 trap: { desc: 'description', msg: 'trigger_message', 'msg-good': 'saved_message', 'msg-bad': 'failed_message', 'msg-xtra': 'extra_message' },
 terrain: { name: 'name', desc: 'description', 'walk-msg': 'walking_warning', 'run-msg': 'running_warning', 'hurt-msg': 'damage_message', 'die-msg': 'death_reason', 'confused-msg': 'confused_monster_message', 'look-prefix': 'look_prefix', 'look-in-preposition': 'look_preposition' },
 shape: { 'effect-msg': 'effect_message' },
 curse: { desc: 'description', msg: 'effect_message' },
 artifact: { desc: 'description', msg: 'alternate_activation_message' },
 ego_item: { desc: 'description' },
};
const records = {}, entries = [], candidates = [];
const customTypes = { name: 'KnownObjectDescription', kind: 'KnownObjectDescription', s: 'DomainCustomVerbSuffix', is: 'DomainCustomCopula' };
function customGrammar(english) {
 const tags = [...new Set([...english.matchAll(/\{([a-z]+)\}/g)].map(match => match[1]))];
 for (const tag of tags) if (!Object.hasOwn(customTypes, tag)) throw new Error(`Unreviewed native custom grammar: ${tag}`);
 return { native_custom_tags: tags, parameters: tags.map(name => ({ name, type: customTypes[name] })) };
}
for (const [file, fields] of Object.entries(roles)) {
 const text = source(`lib/gamedata/${file}.txt`);
 const staged = fs.readFileSync(path.join(port, `data/gamedata/${file}.txt`));
 if (sha(staged) !== sources.at(-1).sha256) throw new Error(`Staged data changed: ${file}`);
 let record;
 const list = records[file] = [];
 for (const [offset, line] of text.split('\n').entries()) {
  if (!line || line.startsWith('#')) continue;
  const separator = line.indexOf(':');
  if (separator < 0) continue;
  const directive = line.slice(0, separator), value = line.slice(separator + 1);
  const header = file === 'terrain' ? directive === 'code' : directive === 'name';
  if (header) {
   const identity = file === 'trap' ? value.split(':')[0] : value;
   record = { source_ordinal: list.length, identity, source_line: offset + 1, key: slug(identity), fields: {}, lines: {}, repeated: {} };
   list.push(record);
   if (file === 'trap') { record.fields.short_name = value.slice(identity.length + 1); record.lines.short_name = [offset + 1]; }
   if (file === 'shape' || file === 'curse') { record.fields.name = value; record.lines.name = [offset + 1]; }
   continue;
  }
  if (!record) throw new Error(`Directive before record ${file}:${offset + 1}`);
  if (file === 'object' && directive === 'type') record.tval = value;
  if (file === 'shape' && directive === 'effect') (record.effects ??= []).push({ ordinal: (record.effects ??= []).length, identity: value, source_line: offset + 1 });
  if (file === 'shape' && directive === 'effect-msg') {
   if (!(record.effects?.length)) record.ignored_effect_message = 'Native parse_shape_effect_msg returns without storing before first effect.';
   else {
    const effectOrdinal = record.effects.length - 1;
    if (record.message_effect_ordinal !== undefined && record.message_effect_ordinal !== effectOrdinal) throw new Error(`Separate per-effect identities required: ${record.identity}`);
    record.message_effect_ordinal = effectOrdinal;
   }
  }
  if (file === 'player_timed' && directive === 'grade') {
   const parts = value.split(':');
   const grade = (record.grades ??= []).length + 1;
   (record.grades ??= []).push({ grade, color: parts[0], maximum: Number(parts[1]), name: parts[2], up: parts[3], down: parts[4] ?? null, source_line: offset + 1 });
  }
  if (file === 'shape' && directive === 'blow') (record.blows ??= []).push({ ordinal: (record.blows ??= []).length, text: value, source_line: offset + 1 });
  if (Object.hasOwn(fields, directive)) {
   const role = fields[directive];
   record.fields[role] = (record.fields[role] ?? '') + value;
   (record.lines[role] ??= []).push(offset + 1);
  }
  candidates.push({ file: `lib/gamedata/${file}.txt`, line: offset + 1, identity: record.identity, directive,
   category: file === 'shape' && directive === 'effect-msg' && !record.effects?.length ? 'ignored_native_field' : Object.hasOwn(fields, directive) || (file === 'player_timed' && directive === 'grade') || (file === 'shape' && directive === 'blow') ? 'visible_text_or_grammar' : 'mechanics_or_private_identity' });
 }
 for (const record of list) {
  if (file === 'object') { record.key = `${slug(record.tval)}.${record.key}`; record.canonical = { kidx: record.source_ordinal, tval_identity: record.tval }; }
  else if (file === 'activation') record.canonical = { activation_index: list.length - record.source_ordinal };
  else if (file === 'curse') record.canonical = { curse_index: list.length - record.source_ordinal };
  else if (file === 'terrain') record.canonical = { fidx: terrainCodes.indexOf(record.identity), code: record.identity };
  else if (file === 'player_timed') record.canonical = { timed_index: timedCodes.indexOf(record.identity), code: record.identity };
  else if (file === 'shape') record.canonical = { sidx: record.source_ordinal };
  else if (file === 'artifact') record.canonical = { aidx: record.source_ordinal + 1 };
  else if (file === 'ego_item') record.canonical = { eidx: record.source_ordinal };
  else { record.key = slug(record.fields.short_name); record.canonical = { tidx: record.source_ordinal }; }
  if (Object.values(record.canonical).includes(-1)) throw new Error(`Unknown canonical index ${file}:${record.identity}`);
  for (const [role, english] of Object.entries(record.fields)) {
   const id = `domain.${file}.${record.key}.${role}`;
   entries.push({ id, file: `lib/gamedata/${file}.txt`, role, canonical: { ...record.canonical, ...(file === 'shape' && role === 'effect_message' && !record.ignored_effect_message ? { effect_ordinal: record.message_effect_ordinal } : {}) }, source_lines: record.lines[role], english,
    ...(file === 'shape' && role === 'effect_message' && record.ignored_effect_message ? { native_ignored: true, ignored_reason: record.ignored_effect_message } : {}),
    ...customGrammar(english) });
  }
  for (const grade of record.grades ?? []) for (const [field, role] of [['name','status_name'],['up','enter_message'],['down','leave_message']]) {
   const english = grade[field];
   if (english === null || ((field === 'name' || field === 'up') && english.length === 1)) continue;
   entries.push({ id: `domain.${file}.${record.key}.grade.${grade.grade}.${role}`, file: `lib/gamedata/${file}.txt`, role,
    canonical: { ...record.canonical, grade: grade.grade }, source_lines: [grade.source_line], english,
    ...(field === 'down' && english === '' ? {
     native_ignored: true,
     ignored_reason: 'Native parser_parse tokenizes optional sym down_msg with strtok(..., ":"); the trailing empty token is absent, parser_hasval is false, and parse_player_timed_grade leaves down_msg NULL.'
    } : {}),
    ...customGrammar(english) });
  }
  for (const blow of record.blows ?? []) entries.push({ id: `domain.shape.${record.key}.blow.${blow.ordinal}.verb`, file: 'lib/gamedata/shape.txt', role: 'blow_verb',
   canonical: { ...record.canonical, blow_ordinal: record.blows.length - 1 - blow.ordinal, source_blow_ordinal: blow.ordinal }, source_lines: [blow.source_line], english: blow.text, native_custom_tags: [], parameters: [] });
 }
}
if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error(`Semantic identity collision: ${JSON.stringify(entries.filter((row,index)=>entries.findIndex(other=>other.id===row.id)!==index).map(row=>[row.id,row.canonical,row.english]))}`);
const groups = [];
for (const entry of entries) {
 const group = groups.find(group => group.english === entry.english);
 if (group) group.ids.push(entry.id);
 else groups.push({ english: entry.english, ids: [entry.id] });
}
write('inventory.json', { schema_version: 1, upstream_commit: commit, sources, records, entries, candidates,
 coverage: { declared_entries: entries.length, entries: entries.filter(row => !row.native_ignored).length, ignored_native_fields: entries.filter(row => row.native_ignored).length, unique_authored_texts: groups.length, by_file: Object.fromEntries(Object.keys(roles).map(file => [file, entries.filter(row => !row.native_ignored && row.file === `lib/gamedata/${file}.txt`).length])) } });
write('authoring-groups.json', groups);
write('en.json', Object.fromEntries(entries.map(entry => [entry.id, entry.english])));
fs.writeFileSync(path.join(directory, 'authoring-lines.txt'), groups.map((group, index) => `${index}\t${JSON.stringify(group.english)}\t${group.ids[0]}`).join('\n') + '\n');
console.log(JSON.stringify({ entries: entries.length, authoringGroups: groups.length, files: sources.length }));
