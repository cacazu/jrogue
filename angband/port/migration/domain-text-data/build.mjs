// Offline assembly of reviewed semantic IDs. Never imported by the browser.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + '\n');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const inventory = read('inventory.json');
const groups = read('authoring-groups.json');
const authored = new Map();
for (const filename of ['ja-authored-objects.json', 'ja-authored-activations.json', 'ja-authored-timed.json', 'ja-authored-environment.json', 'ja-authored-artifacts.json']) {
 for (const [key, text] of Object.entries(read(filename))) {
  const index = Number(key);
  if (!Number.isInteger(index) || index < 0 || index >= groups.length || authored.has(index) || typeof text !== 'string') throw new Error(`Invalid/duplicate authored index ${filename}:${key}`);
  authored.set(index, text);
 }
}
const curse = read('ja-authored-curse-review.json');
const japanese = {};
for (const [index, group] of groups.entries()) {
 for (const id of group.ids) {
  const text = Object.hasOwn(curse, id) ? curse[id] : authored.get(index);
  if (typeof text !== 'string') throw new Error(`Missing reviewed Japanese ${index}:${id}`);
  japanese[id] = text;
 }
}
for (const id of Object.keys(curse)) if (!Object.hasOwn(japanese, id)) throw new Error(`Unknown curse review ${id}`);
const grammar = [
 { id: 'domain.custom_message.hands', english: 'hands', japanese: '両手', branch: 'obj == NULL, name/kind' },
 { id: 'domain.custom_message.verb.singular', english: 's', japanese: '', branch: 'obj != NULL && obj->number == 1' },
 { id: 'domain.custom_message.verb.plural', english: '', japanese: '', branch: 'obj == NULL || obj->number != 1' },
 { id: 'domain.custom_message.copula.singular', english: 'is', japanese: '', branch: 'obj != NULL && obj->number <= 1' },
 { id: 'domain.custom_message.copula.plural', english: 'are', japanese: '', branch: 'obj == NULL || obj->number > 1' },
];
const ignoredFields = inventory.entries.filter(entry => entry.native_ignored).map(entry => ({ ...entry, japanese: japanese[entry.id] }));
for (const entry of ignoredFields) delete japanese[entry.id];
const activeEntries = inventory.entries.filter(entry => !entry.native_ignored);
const entries = activeEntries.map(entry => ({ ...entry, japanese: japanese[entry.id],
 sources: entry.source_lines.map(line => ({ file: entry.file, line })), status: 'reviewed_source_catalog' }));
for (const entry of grammar) {
 japanese[entry.id] = entry.japanese;
 entries.push({ ...entry, role: 'native_custom_grammar', parameters: [], native_custom_tags: [], sources: [{ file: 'src/obj-util.c', function: 'print_custom_message' }], status: 'reviewed_source_catalog' });
}
const runtimeTemplates = read('runtime-templates.json');
for (const entry of runtimeTemplates) {
 if (Object.hasOwn(japanese, entry.id)) throw new Error(`Duplicate runtime template ${entry.id}`);
 japanese[entry.id] = entry.japanese;
 entries.push({ ...entry, native_custom_tags: [], status: 'reviewed_source_catalog' });
}
const tags = text => [...text.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map(match => match[1]).sort();
for (const entry of entries) {
 if (entry.english.includes('\0') || entry.japanese.includes('\0') || entry.japanese.includes('\ufffd')) throw new Error(`Invalid text ${entry.id}`);
 if (JSON.stringify(tags(entry.english)) !== JSON.stringify(tags(entry.japanese))) throw new Error(`Native grammar tag mismatch ${entry.id}`);
 if (entry.japanese === entry.english && entry.english !== '' && entry.id !== 'domain.message.terrain.damage') throw new Error(`Untranslated visible text ${entry.id}`);
 const typed = entry.parameters.map(parameter => parameter.name).sort();
 if (JSON.stringify([...new Set(tags(entry.english))]) !== JSON.stringify(typed)) throw new Error(`Typed grammar mismatch ${entry.id}`);
}
const english = Object.fromEntries(entries.map(entry => [entry.id, entry.english]));
write('en.json', english);
write('ja.json', japanese);
write('schema.json', { schema_version: 1, entries: Object.fromEntries(entries.map(entry => [entry.id, { parameters: entry.parameters }])) });
const bindings = Object.fromEntries(Object.entries(inventory.records).map(([file, records]) => [file, records.map(record => ({
 identity: record.identity, source_ordinal: record.source_ordinal, source_line: record.source_line, canonical: record.canonical,
 fields: Object.fromEntries(activeEntries.filter(entry => entry.file === `lib/gamedata/${file}.txt` &&
 Object.entries(record.canonical).every(([name, value]) => entry.canonical[name] === value)).map(entry => [entry.role + (entry.canonical.grade === undefined ? '' : `.grade.${entry.canonical.grade}`) + (entry.canonical.blow_ordinal === undefined ? '' : `.blow.${entry.canonical.blow_ordinal}`), entry.id]))
 }))]));
write('bindings.json', { schema_version: 1, upstream_commit: inventory.upstream_commit, records: bindings });
const sourceManifest = { schema_version: 1, upstream_commit: inventory.upstream_commit,
 status: 'reviewed_data_catalog_awaiting_runtime_binding', complete_game_translation: false,
 source_hashes: inventory.sources, coverage: { ...inventory.coverage, grammar_entries: grammar.length, composition_entries: runtimeTemplates.length, total_catalog_entries: entries.length },
 capture_contract: {
  name: 'KnownObjectDescription: copy complete v2 capture from original object_desc ODESC_PREFIX|ODESC_BASE output buffer; null object native hands literal buffer uses domain.custom_message.hands.',
  kind: 'KnownObjectDescription: copy complete v2 capture from original object_kind_name aware=true output buffer, base part/mode=0; null object native hands literal buffer uses domain.custom_message.hands. No repeated knowledge queries.',
  DomainCustomVerbSuffix: 'Owned {has_object:boolean,number:integer}; source-selected count; EN singular s only for non-null number==1, Japanese empty.',
  DomainCustomCopula: 'Owned {has_object:boolean,number:integer}; EN is only for non-null number<=1, otherwise are; Japanese empty.'
 },
 consumers: {
  object: ['src/obj-init.c:parse_object_msg/parse_object_vis_msg/parse_object_desc', 'src/cmd-obj.c:use_aux', 'src/obj-info.c:object_info'],
  activation: ['src/obj-init.c:finish_parse_act (reverse linked-list indices)', 'src/cmd-obj.c:activation_message'],
  artifact: ['src/obj-init.c:parse_artifact_msg/parse_artifact_desc', 'src/cmd-obj.c:activation_message (alt_msg only after activation.message non-null)', 'src/obj-info.c:object_info'],
  ego_item: ['src/obj-init.c:parse_ego_desc', 'src/obj-info.c:object_info'],
  player_timed: ['src/player-timed.c:grade parser and player_set_timed, one-character name/up sentinel retained'],
  trap: ['src/init.c:parse_trap_*', 'src/trap.c:hit_trap original branches', 'src/ui-knowledge.c:trap recall'],
  terrain: ['src/init.c:parse_feat_*', 'src/cmd-cave.c:original get_check warnings', 'src/player-util.c:player_take_terrain_damage', 'src/mon-move.c:original visible confused terrain collision', 'src/ui-target.c:original apparent look grammar'],
  shape: ['src/init.c:parse_shape_* (blow linked-list prepends)', 'src/player-attack.c:shape blow selection'],
  curse: ['src/obj-init.c:finish_parse_curse (reverse linked-list indices)', 'src/ui-curse.c:original filtered curse choices', 'src/obj-knowledge.c:rune_desc']
 },
 entries, ignored_native_fields: ignoredFields,
 remaining_scope: ['Runtime C producer bindings and Rust custom descriptor resolvers remain root-owned and unbuilt at catalog generation.', 'Monster race prose is owned by knowledge-text-data; no duplicate domain entries.', 'Technical data identities, filenames, color codes, dice, flags, effect codes and original native data are preserved.']
};
write('source-manifest.json', sourceManifest);
write('verification.json', { schema_version: 1, upstream_commit: inventory.upstream_commit, data_endpoints: activeEntries.length, declared_data_fields: inventory.entries.length, ignored_native_fields: ignoredFields.length,
 catalog_entries: entries.length, authored_groups: groups.length, coverage: inventory.coverage.by_file,
 missing_japanese: 0, untranslated_visible_text: 0, mismatched_native_tags: 0,
 outputs: ['en.json', 'ja.json', 'schema.json', 'bindings.json', 'source-manifest.json'].map(file => { const bytes = fs.readFileSync(path.join(directory, file)); return { file, bytes: bytes.length, sha256: sha(bytes) }; }) });
console.log(JSON.stringify({ dataEndpoints: activeEntries.length, catalogEntries: entries.length, ignoredNativeFields: ignoredFields.length, authoredGroups: groups.length, missingJapanese: 0 }));
