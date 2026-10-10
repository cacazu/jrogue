// Source preparation only. No native execution.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const game = 'C:/Users/kit/gameme/jnethack/jrouge/dcss';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = relative => fs.readFileSync(path.join(game, relative));
const fixed = JSON.parse(fs.readFileSync(path.join(root, 'fixed-source-receipts.json')));
let cpp = fs.readFileSync(path.join(root, 'engine/newgame.cc'), 'utf8');
const fixedPin = fixed.files.find(file => file.path === 'engine/newgame.cc').sha256;
if (hash(Buffer.from(cpp)) !== fixedPin) throw Error('fixed native stage changed');
const entitiesBytes = read('locales/entities/source-map.json');
const entities = JSON.parse(entitiesBytes);
const commit = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
if (entities.commit !== commit || entities.release !== '0.34.1') throw Error('entity registry source mismatch');
const records = Object.fromEntries(['species', 'job'].map(kind => [kind, entities.records.filter(record => record.kind === kind)]));
const sourcePins = { 'locales/entities/source-map.json': hash(entitiesBytes) };
let helper = fs.readFileSync(path.join(root, 'native-dynamic-helper.inc'), 'utf8');
for (const kind of ['species', 'job']) {
  const relative = 'engine/work-wasm-eh/crawl-ref/source/' + kind + '-type.h';
  const bytes = read(relative), header = bytes.toString('utf8'); sourcePins[relative] = hash(bytes);
  for (const record of records[kind]) if (!header.includes(record.identity)) throw Error('registry enum missing: ' + record.identity);
  const mapping = records[kind].map(record => '    case ' + record.identity + ': return ' + JSON.stringify(record.name_id) + ';').join('\n');
  helper = helper.replace('        // SOURCE_' + kind.toUpperCase() + '_MAPPING', mapping);
}
const anchor = '// END jrogue startup-fixed-weapon adapter v1\n\n';
const actions = [{ before: anchor, after: anchor + helper + '\n', source_site: 'private dynamic descriptor helper insertion' },
  ...JSON.parse(fs.readFileSync(path.join(root, 'native-dynamic-sites.json')))];
for (const action of actions) {
  if (cpp.split(action.before).length !== 2) throw Error('native source site not unique: ' + action.source_site);
  cpp = cpp.replace(action.before, action.after);
}
let inverted = cpp;
for (const action of actions.toReversed()) {
  if (inverted.split(action.after).length !== 2) throw Error('dynamic inverse not unique');
  inverted = inverted.replace(action.after, action.before);
}
if (hash(Buffer.from(inverted)) !== fixedPin) throw Error('dynamic inversion failed');
fs.writeFileSync(path.join(root, 'engine/newgame.cc'), cpp);
const schemas = Object.fromEntries(['species', 'job'].map(domain => [domain, { kind: 'entity_label', version: 1, upstream: commit, domain, form: 'name',
  id: { source: 'locales/entities/source-map.json records[].name_id', allowed: records[domain].map(record => record.name_id) } }]));
const receipt = { schema_version: 2, source: 'startup-text-v2', source_only: true, upstream: commit,
  original_sha256: fixed.native_overrides[0].original_sha256, final_sha256: hash(Buffer.from(cpp)), fixed_source_sha256: fixedPin,
  inverse_actions: [...fixed.native_overrides[0].inverse_actions, ...actions],
  descriptor_schemas: { ...schemas, player_name: { kind: 'actor_label', version: 1, upstream: commit, form: 'name', identity: { visibility: 'external', name: 'unchanged native ng.name, JSON escaped only' } } },
  source_pins: sourcePins, mappings: records,
  controls: { canonical_item_name_database_key_retained: true, canonical_species_article_retained: true, menu_letters_ids_restrictions_colours_focus_unchanged: true, native_utf8_player_name_rules_unchanged: true },
  excluded: ['weapon base names/aptitude suffix/Tab previous weapon', 'species/job group headings and description bodies', 'reroll title', 'seed/map prompts', 'name controls/validation labels'],
  default_reachability: { welcome: 'reachable at default weapon title; three existing consumers', name_title: 'only without configured/-name input; normal product boot bypasses it', species_job_rows: 'only without resolved species/background; normal product boot bypasses both menus' } };
fs.writeFileSync(path.join(root, 'native-dynamic-receipts.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, source_only: true, cpp_sha256: receipt.final_sha256,
  entity_labels: Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.length])), dynamic_source_replacements: actions.length - 1 }));
