// Generates a reviewed source candidate only. Parent supplies new Rust pins explicitly.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const game = 'C:/Users/kit/gameme/jnethack/jrouge/dcss';
const hud = path.join(root, '../dcss-native-path-work');
const dynamic = process.env.DCSS_DYNAMIC_STAGE ?? path.join(root, '../dcss-dynamic-schema-work');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(file);
const json = file => JSON.parse(read(file));
const normalize = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n');
const fixed = json(path.join(root, 'fixed-source-receipts.json'));
const native = json(path.join(root, 'native-dynamic-receipts.json'));
const hudReceipt = json(path.join(hud, 'source-receipts.json'));
const commit = native.upstream;
const boundarySha = process.env.DCSS_V2_BOUNDARY_SHA256 ?? 'REQUIRES_REVIEWED_V2_BOUNDARY_SHA256';
const boundaryBytes = Number(process.env.DCSS_V2_BOUNDARY_BYTES ?? 0);
if (boundarySha !== 'REQUIRES_REVIEWED_V2_BOUNDARY_SHA256' && (!/^[a-f0-9]{64}$/.test(boundarySha) || !Number.isSafeInteger(boundaryBytes) || boundaryBytes <= 0)) throw Error('invalid reviewed boundary pin');
function emit(relative, bytes) {
  const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes);
  return { path: relative, sha256: hash(read(file)), bytes: fs.statSync(file).size };
}
const assets = [];
function asset(base, relative) { const bytes = read(path.join(base, relative)); const info = emit(relative, bytes); assets.push({ path: '/' + relative, sha256: info.sha256 }); return json(path.join(base, relative)); }
const maps = {}, catalogs = {};
for (const [name, base] of [['startup', game], ['hud', hud], ['dynamic', dynamic]]) {
  catalogs[name] = Object.fromEntries(['en', 'ja'].map(language => [language, asset(base, 'locales/' + name + '/' + language + '.json')]));
  maps[name] = asset(base, 'locales/' + name + '/source-map.json');
  if (maps[name].commit !== commit || maps[name].release !== '0.34.1' || maps[name].schema_version !== 1) throw Error('unreviewed source map ' + name);
}
const registry = asset(game, 'locales/entities/source-map.json');
const entityRegistry = {};
for (const domain of ['species', 'job']) {
  const stem = domain === 'job' ? 'jobs' : 'species';
  const en = asset(game, 'locales/entities/' + stem + '.en.json'), ja = asset(game, 'locales/entities/' + stem + '.ja.json');
  entityRegistry[domain] = Object.fromEntries(registry.records.filter(record => record.kind === domain).map(record => {
    if (en[record.name_id] !== record.name || typeof ja[record.name_id] !== 'string') throw Error('entity registry binding mismatch');
    return [record.name_id, { en: en[record.name_id], ja: ja[record.name_id], identity: record.identity }];
  }));
}
const entity = (domain, id) => ({ kind: 'entity_label', version: 1, upstream: commit, domain, id, form: 'name' });
const external = { kind: 'actor_label', version: 1, upstream: commit, form: 'name', identity: { visibility: 'external', name: 'DcssExternalName' } };
const dynamicIds = ['startup.dynamic.species_name', 'startup.dynamic.job_name', 'startup.dynamic.character.a', 'startup.dynamic.character.an',
  ...['empty', 'named_only', 'named_job', 'named_species', 'named_species_job', 'unnamed_job', 'unnamed_species', 'unnamed_species_job'].map(name => 'startup.dynamic.welcome.' + name)];
function parameters(id) {
  const result = {};
  if (id === 'startup.dynamic.species_name' || id.includes('character.') || id.endsWith('_species') || id.endsWith('_species_job')) result.species = { type: 'entity_label', role: 'species' };
  if (id === 'startup.dynamic.job_name' || id.includes('character.') || id.endsWith('_job')) result.job = { type: 'entity_label', role: 'job' };
  if (id.includes('.welcome.named_')) result.player_name = { type: 'actor_label', role: 'external_username' };
  return result;
}
const groups = [['startup', 'fixed', fixed.ids], ['dynamic', 'dynamic', dynamicIds], ['hud', 'hud', hudReceipt.ids]];
const messages = {};
const template = value => typeof value === 'string' ? value : value?.text;
for (const [scope, category, ids] of groups) for (const id of ids) {
  const source = maps[scope].messages.find(message => message.id === id);
  if (!source || !Array.isArray(source.source_sites) || !source.source_sites.length || source.expected_en !== template(catalogs[scope].en[id]) || typeof template(catalogs[scope].ja[id]) !== 'string') throw Error('missing native message binding ' + id);
  const schema = category === 'dynamic' ? parameters(id) : {};
  if (Object.keys(source.params).sort().join() !== Object.keys(schema).sort().join()) throw Error('dynamic parameter source keys mismatch: ' + id);
  const preflight = Object.fromEntries(Object.entries(schema).map(([key, value]) => [key,
    value.type === 'actor_label' ? external : entity(value.role, value.role === 'job' ? 'job.job_fighter.name'
      : id === 'startup.dynamic.character.an' ? 'species.sp_octopode.name' : 'species.sp_human.name')]));
  const catalogShape = typeof catalogs[scope].en[id] === 'string' ? 'string' : 'typed';
  if ((typeof catalogs[scope].ja[id] === 'string' ? 'string' : 'typed') !== catalogShape) throw Error('native catalog shape differs between languages');
  messages[id] = { en: template(catalogs[scope].en[id]), ja: template(catalogs[scope].ja[id]), catalog_shape: catalogShape, source_site: source.source_sites[0],
    native_source: scope === 'hud' ? 'crawl-ref/source/output.cc' : 'crawl-ref/source/newgame.cc', category, parameters: schema, source_params: source.params,
    preflight_params: preflight, source_map: '/locales/' + scope + '/source-map.json', en_catalog: '/locales/' + scope + '/en.json', ja_catalog: '/locales/' + scope + '/ja.json' };
}
const pin = { version: 2, schema_version: 2, source: 'startup-text-v2', scope: 'startup-text-v2', upstream: commit, release: '0.34.1',
  id: 'startup.weapon.prompt', nativeSource: native.original_sha256,
  nativeSources: { 'crawl-ref/source/newgame.cc': native.original_sha256, 'crawl-ref/source/output.cc': hudReceipt.source_pins['upstream/crawl-ref/source/output.cc'] },
  boundary: { path: '/build/boundary.wasm', bytes: boundaryBytes, sha256: boundarySha }, catalogs: assets,
  en: messages['startup.weapon.prompt'].en, ja: messages['startup.weapon.prompt'].ja, ids: Object.keys(messages), messages, entityRegistry, externalNameBytes: 128 };
if (pin.ids.length !== 45) throw Error('reviewed native ID union must be exactly45');
const runtime = fs.readFileSync(path.join(root, 'startup-v2-runtime.mjs'), 'utf8');
const bridge = runtime.replace('/* GENERATED_REVIEWED_PIN */', JSON.stringify(pin, null, 2));
if (bridge === runtime) throw Error('missing runtime generation marker');
const bridgeInfo = emit('web/startup-text.mjs', bridge);
const importPin = { upstream: commit, messages: Object.fromEntries(Object.entries(messages).map(([id, message]) => [id,
  { en: message.en, ja: message.ja, parameters: message.parameters }])), entities: entityRegistry };
const importTemplate = fs.readFileSync(path.join(root, 'native-v2-import.inc'), 'utf8');
const libraryImport = importTemplate.replace('/* GENERATED_REVIEWED_IMPORT */', JSON.stringify(importPin));
const libraryBase = read(path.join(root, 'base/engine/library.js'));
if (hash(libraryBase) !== fixed.library_base_sha256) throw Error('pristine library pin changed');
const newline = libraryBase.toString('utf8').includes('\r\n') ? '\r\n' : '\n';
const insertion = newline + libraryImport.replace(/\r\n/g, '\n').replace(/\n/g, newline).replace(/\r?\n$/, '');
const library = libraryBase.toString('utf8').replace('mergeInto(LibraryManager.library, {', 'mergeInto(LibraryManager.library, {' + insertion);
const libraryInfo = emit('engine/library.js', library);
const cppInfo = { path: 'engine/newgame.cc', sha256: hash(read(path.join(root, 'engine/newgame.cc'))) };
if (cppInfo.sha256 !== native.final_sha256) throw Error('final native unit pin changed');
const outputInfo = emit('engine/output.cc', read(path.join(hud, 'engine/output.cc')));
const hudActions = hudReceipt.transformations['engine/output.cc'].patches.map(({before,after})=>({before,after}));
  const sourceBoundaries = [
  { source: 'engine/work-wasm-eh/crawl-ref/source/newgame.cc', path: 'crawl-ref/source/newgame.cc', original_sha256: native.original_sha256, transformed_sha256: native.final_sha256,
    functions: ['_construct_weapon_menu', '_prompt_weapon', '_welcome', '_choose_name', 'UINewGameMenu::_add_group_item'], ids: [...fixed.ids, ...dynamicIds] },
  { source: 'engine/work-wasm-eh/crawl-ref/source/output.cc', path: 'crawl-ref/source/output.cc', original_sha256: pin.nativeSources['crawl-ref/source/output.cc'], transformed_sha256: outputInfo.sha256,
    functions: [...new Set(hudReceipt.bindings.map(binding => binding.function))], ids: hudReceipt.ids },
];
const descriptorSchemas = {
  entity_label: { kind: 'entity_label', version: 1, upstream: commit, form: 'name', domains: ['species', 'job'], exact_keys: ['kind', 'version', 'upstream', 'domain', 'id', 'form'] },
  actor_label: { kind: 'actor_label', version: 1, upstream: commit, form: 'name', exact_keys: ['kind', 'version', 'upstream', 'form', 'identity'],
    identity: { exact_keys: ['visibility', 'name'], visibility: 'external', name: 'verbatim' } },
};
const metadata = { schema_version: 2, source: 'startup-text-v2', upstream: commit, ids: pin.ids,
  message_schemas: Object.fromEntries(Object.entries(messages).map(([id, message]) => [id, { category: message.category, parameters: message.parameters }])),
  dynamic_contract: { schema_version: 1, upstream: commit, descriptor_schemas: descriptorSchemas,
    native_profile: { external_name_utf8_bytes: [1, 128], rejects_unicode_controls: true, parameter_utf8_bytes_max: 2047, native_destination_bytes: 512 },
    entity_identity: 'exact domain/form=name and records[].name_id in pinned entity registry; no English lookup/no abbreviation identity', external_actor_name: 'verbatim' },
  source_boundaries: sourceBoundaries, bridge_sha256: bridgeInfo.sha256, library_sha256: libraryInfo.sha256,
  boundary_sha256: boundarySha, boundary_bytes: boundaryBytes, locale_mode: 'session' };
emit('startup-text-v2.json', JSON.stringify(metadata, null, 2) + '\n');
emit('startup-text-pin.json', JSON.stringify(pin, null, 2) + '\n');
emit('source-receipts.json', JSON.stringify({ schema_version: 2, source_only: true, startup_text: metadata, assets,
  native_overrides: [
    { native_path: 'crawl-ref/source/newgame.cc', object_index: 170, original_sha256: native.original_sha256, final_sha256: native.final_sha256, inverse_actions: native.inverse_actions },
    { native_path: 'crawl-ref/source/output.cc', object_index: 181, original_sha256: pin.nativeSources['crawl-ref/source/output.cc'], final_sha256: outputInfo.sha256, inverse_actions: hudActions }
  ], library: { base_sha256: hash(libraryBase), final_sha256: libraryInfo.sha256, inverse_actions: [{ before: '', after: insertion }] },
  files: [cppInfo, outputInfo, bridgeInfo, libraryInfo], boundary_gate_pending: boundaryBytes === 0, controls: native.controls }, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, source_only: true, ids: pin.ids.length, preflight_calls: pin.ids.length * 2,
  categories: Object.fromEntries(groups.map(([scope, category, ids]) => [category, ids.length])), boundary_gate_pending: boundaryBytes === 0, files: [cppInfo, outputInfo, bridgeInfo, libraryInfo] }));
