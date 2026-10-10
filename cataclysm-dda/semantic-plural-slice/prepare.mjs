import assert from 'node:assert/strict';
import {readFileSync, openSync, readSync, closeSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {sha256, serialized, SOURCE_COMMIT, UPSTREAM, printfEvidence} from '../semantic-runtime-catalog/convert.mjs';
import {literalTemplate, validateCatalog, validId} from '../semantic-runtime-catalog/model.mjs';
import {DISPATCH_ID} from './selector.mjs';

export const DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.dirname(DIRECTORY);
export const INPUT_FILES = ['ja-current/en.json', 'ja-current/ja.json', 'ja-current/reviewed-current-additions.json',
  'ja-current/semantic-id-registry.json', 'semantic-runtime-catalog/output/blockers.json',
  'rust-contracts/logic/src/lib.rs', 'rust-contracts/presentation/src/lib.rs', 'ja-current/verification.json'];
const MO_PATH = 'ja-current/generated/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo';
const SOURCE_CONSUMERS = {
  'src/item_factory.cpp': [{function: 'itype::load', lines: [4060, 4127, 4128, 4152], fragments: ['name = translation( translation::plural_tag() );', 'mandatory( jo, was_loaded, "name", name );', 'optional( jo, was_loaded, "phase", phase, phase_id::SOLID );']},
    {function: 'itype_variant_data::load', lines: [3011, 3013, 3015], fragments: ['alt_name.make_plural();', 'mandatory( jo, false, "name", alt_name );']}],
  'src/itype.cpp': [{function: 'itype::nname', lines: [107, 111, 112, 114], fragments: ['std::string itype::nname( unsigned int quantity ) const', 'if( phase == phase_id::LIQUID )', 'quantity = 1;', 'return name.translated( quantity );']}],
  'src/item.cpp': [{function: 'item::type_name', lines: [15401, 15414, 15417, 15419, 15454, 15489], fragments: ['ret_name = itype_variant().alt_name.translated( quantity );', 'ret_name = type->nname( quantity );', 'return iter->second.str();']},
    {function: 'item::nname', lines: [15514, 15517], fragments: ['std::string item::nname( const itype_id &id, unsigned int quantity )', 'return t->nname( quantity );']}],
  'src/monstergenerator.cpp': [{function: 'mtype::load', lines: [754, 755], fragments: ['name.make_plural();', 'mandatory( jo, was_loaded, "name", name );']}],
  'src/mtype.cpp': [{function: 'mtype::nname', lines: [341, 343], fragments: ['std::string mtype::nname( unsigned int quantity ) const', 'return name.translated( quantity );']}],
  'src/monster.cpp': [{function: 'monster::name', lines: [706, 708, 712, 717, 722], fragments: ['std::string monster::name(', 'type->nname( quantity )', 'unique monster name', 'fused mission monster']}],
  'src/event_statistics.cpp': [{function: 'event_statistic::load / score::description', lines: [1274, 1279, 1280, 1282, 1286, 1288], fragments: ['description_.make_plural();', 'desc = stat_->description().translated( val.get<int>() );', 'desc = stat_->description().translated();']}],
  'src/achievement.cpp': [{function: 'text_for_requirement', lines: [482, 493, 495, 496, 498, 499, 501], fragments: ['text_for_requirement', 'req.statistic->description().translated()', 'req.statistic->description().translated( target )']}],
  'src/stats_tracker.cpp': [{function: 'event_multiset::maximum', lines: [142, 144, 151, 155], fragments: ['event_multiset::maximum', 'int maximum = 0;']}],
  'src/display.cpp': [{function: 'colorized_compass_legend_text', lines: [1352, 1374, 1392], fragments: ['m.first->nname( m.second )']}],
  'src/diary.cpp': [{function: 'diary::kill_changes', lines: [252, 266, 289, 298, 300], fragments: ['diary::kill_changes', 'nname( elem.second )']}],
  'src/scores_ui.cpp': [{function: 'scores / kill list rendering', lines: [162, 175], fragments: ['scr->description( stats )', 'm.nname()']}],
  'src/cata_variant.h': [{function: 'int_ stored type', lines: [292, 298], fragments: ['cata_variant_type::int_', 'using type = int;']}],
  'src/translation.cpp': [{function: 'translation::deserialize / possible_plural_of / translated', lines: [86, 88, 124, 149, 195, 205, 209, 212, 246, 247, 269, 296, 315, 322], fragments: ['const std::string plural = raw + "s";', 'std::string translation::translated( const int num ) const', 'n_gettext( raw.c_str(), raw_pl->c_str(), num )', 'npgettext( ctxt->c_str(), raw.c_str(), raw_pl->c_str(), num )']}],
  'src/translation.h': [{function: 'translation::translated default', lines: [73], fragments: ['std::string translated( int num = 1 ) const;']}],
  'src/translations.h': [{function: 'n_gettext / npgettext', lines: [61, 64, 65, 77, 81, 83], fragments: ['std::size_t n )', 'const unsigned long long n )']}],
  'src/translation_manager_impl.cpp': [{function: 'TranslatePlural / TranslatePluralWithContext', lines: [178, 179, 185, 187, 218, 221, 228, 230], fragments: ['GetTranslatedStringPlural( string_index, n )', 'if( n == 1 )']}],
  'src/translation_document.cpp': [{function: 'EvaluatePluralForm / GetTranslatedStringPlural', lines: [54, 57, 207, 210, 216], fragments: ['plural_rules->Evaluate( n )', 'GetString( translated_offsets[index][plural_form] )']}],
  'src/generic_factory.h': [{function: 'mandatory / optional load reader', lines: [640, 653, 869, 877], fragments: ['mandatory', 'optional']}],
  'src/flexbuffer_json-inl.h': [{function: 'JsonValue::read / JsonObject::read', lines: [317, 327, 1074, 1080], fragments: ['v.deserialize( *this )', 'JsonObject::read']}],
};
function readJson(name) { return JSON.parse(readFileSync(path.join(ROOT, name), 'utf8')); }
function traverse(document, pointer) {
  return pointer.split('/').slice(1).reduce((value, part) => value[part.replace(/~1/g, '/').replace(/~0/g, '~')], document);
}
function pluralDefinition(value) {
  if (typeof value === 'string') return {singular: value, plural: value + 's', method: 'native-raw-plus-s', context: ''};
  if ('str_sp' in value) return {singular: value.str_sp, plural: value.str_sp, method: 'native-str_sp-invariant', context: value.ctxt ?? ''};
  return {singular: value.str, plural: value.str_pl ?? (value.str + 's'), method: value.str_pl === undefined ? 'native-raw-plus-s' : 'native-explicit-str_pl', context: value.ctxt ?? ''};
}
function readMO() {
  // Bounded random access: don't read the 20MB MO into a single allocation.
  const fd = openSync(path.join(ROOT, MO_PATH), 'r');
  function bytes(length, offset) { assert.ok(length >= 0 && length <= 1024 * 1024); const value = Buffer.alloc(length); assert.equal(readSync(fd, value, 0, length, offset), length); return value; }
  const header = bytes(28, 0);
  assert.equal(header.readUInt32LE(0), 0x950412de, 'expected little-endian generated GNU MO');
  const count = header.readUInt32LE(8), originals = header.readUInt32LE(12), translations = header.readUInt32LE(16);
  function stringAt(table, index) { const row = bytes(8, table + index * 8); return bytes(row.readUInt32LE(0), row.readUInt32LE(4)); }
  function lookup(key) {
    const target = Buffer.from(key), visited = [];
    let left = 0, right = count - 1;
    while (left <= right) {
      const mid = (left + right) >> 1, original = stringAt(originals, mid);
      const nul = original.indexOf(0), prefix = nul < 0 ? original : original.subarray(0, nul);
      const order = Buffer.compare(prefix, target); visited.push(mid);
      if (order === 0) return {original: original.toString('utf8'), translated: stringAt(translations, mid).toString('utf8'), index: mid};
      if (order < 0) left = mid + 1; else right = mid - 1;
    }
    return null;
  }
  return {lookup, count, close: () => closeSync(fd)};
}
function streamingFileHash(name) {
  const fd = openSync(path.join(ROOT, name), 'r'), buffer = Buffer.alloc(1024 * 1024), hash = createHash('sha256');
  try { for (;;) { const bytes = readSync(fd, buffer, 0, buffer.length, null); if (!bytes) break; hash.update(buffer.subarray(0, bytes)); } }
  finally { closeSync(fd); }
  return hash.digest('hex');
}
function route(binding, document) {
  const owner = traverse(document, binding.ownerPointer), relative = binding.jsonPointers[0].slice(binding.ownerPointer.length);
  if (binding.ownerType === 'item') {
    if (relative === '/name') return {kind: 'itype-base-name', nativeId: owner.id, liveSelectorInputs: ['original quantity argument', 'original resolved itype phase'], loader: 'itype::load', consumer: 'itype::nname', policy: 'LIQUID forces1 before translation::translated(int); other phases forward quantity', rawPhase: owner.phase ?? null, copyFrom: owner['copy-from'] ?? null};
    const match = /^\/variants\/(\d+)\/name$/.exec(relative);
    if (match) return {kind: 'item-variant-name', nativeId: owner.id, variantId: owner.variants[Number(match[1])].id, liveSelectorInputs: ['original quantity argument', 'original selected variant identity'], loader: 'itype_variant_data::load', consumer: 'item::type_name variant branch', policy: 'alt_name.translated(quantity) directly; no liquid clamp'};
  }
  if (binding.ownerType === 'monster' && relative === '/name') return {kind: 'mtype-name', nativeId: owner.id, liveSelectorInputs: ['original quantity argument'], loader: 'mtype::load', consumer: 'mtype::nname', policy: 'quantity forwarded to translation::translated(int); dynamic nickname/unique/fused assembly remains original C++'};
  if (binding.ownerType === 'event_statistic' && relative === '/description') return {kind: 'statistic-description', nativeId: owner.id, statType: owner.stat_type, liveSelectorInputs: ['exact caller route', 'int32 passed to translated, when applicable'], loader: 'event_statistic::load', consumers: [
    {kind: 'score-int-current-value', function: 'score::description', policy: 'val.get<int>()'},
    {kind: 'score-non-int-default-one', function: 'score::description', policy: 'translated() default1'},
    {kind: 'achievement-int-target', function: 'text_for_requirement', policy: 'target.get<int>(), not current statistic'},
    {kind: 'achievement-anything-default-one', function: 'text_for_requirement', policy: 'translated(1)'},
  ], policy: 'consumer-specific; leaf has no inserted numeric value'};
  return {kind: 'unresolved-owner-field', relative};
}
export function prepare() {
  const hashes = Object.fromEntries(INPUT_FILES.map(name => [name, sha256(readFileSync(path.join(ROOT, name)))]));
  const english = readJson('ja-current/en.json'), japanese = readJson('ja-current/ja.json');
  const reviewed = readJson('ja-current/reviewed-current-additions.json'), registry = readJson('ja-current/semantic-id-registry.json');
  const recordsById = new Map(reviewed.records.map(record => [record.semanticId, record]));
  const source = readJson('semantic-runtime-catalog/output/blockers.json');
  for (const document of [english, japanese, reviewed, registry, source]) assert.equal(document.source_commit ?? document.sourceCommit, SOURCE_COMMIT);
  const plurals = source.records.filter(record => record.reasons.some(reason => reason.code === 'native-plural-consumer-and-selector-required'));
  assert.equal(plurals.length, 155);
  assert.ok(!(DISPATCH_ID in english.entries) && !(DISPATCH_ID in japanese.entries));
  assert.ok(!(DISPATCH_ID in registry.idMap) && !Object.values(registry.idMap).includes(DISPATCH_ID));
  const sourcePins = {};
  for (const [file, witnesses] of Object.entries(SOURCE_CONSUMERS)) {
    const buffer = readFileSync(path.join(UPSTREAM, file)), text = buffer.toString('utf8');
    for (const witness of witnesses) for (const fragment of witness.fragments) assert.ok(text.includes(fragment), `consumer pin fragment missing: ${file}: ${fragment}`);
    sourcePins[file] = {sha256: sha256(buffer), witnesses};
  }
  const documents = new Map(), definitionPins = {};
  const mo = readMO(), metadata = mo.lookup('');
  const nativeMOHash = streamingFileHash(MO_PATH), moVerification = readJson('ja-current/verification.json');
  assert.equal(nativeMOHash, moVerification.mo_sha256, 'actual MO differs from compiler evidence');
  assert.ok(metadata && /Plural-Forms: nplurals=1; plural=0;/.test(metadata.translated), 'actual Japanese MO must be invariant');
  const en = {schema_version: 1, locale: 'en', entries: {}}, ja = {schema_version: 1, locale: 'ja', entries: {}};
  const inventory = [], blocked = [];
  const counts = {item: 0, monster: 0, event_statistic: 0}, routeCounts = {}, pluralMethods = {};
  let pointers = 0;
  try {
    for (const record of [...plurals].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
      const original = recordsById.get(record.id);
      assert.ok(original); assert.ok(validId(record.id)); assert.equal(original.singular, record.en);
      assert.equal(japanese.entries[record.id].text, record.ja); assert.equal(english.entries[record.id].text, record.en);
      assert.deepEqual(original.sourceBindings, record.sourceBindings); assert.deepEqual(original.pluralVariants, record.sourcePluralVariants);
      const bindings = [], reasons = [];
      if (record.reasons.some(reason => reason.code !== 'native-plural-consumer-and-selector-required')) reasons.push('overlapping-unsupported-template');
      if (record.sourcePluralVariants.length !== 1 || record.sourcePluralVariants[0] === null) reasons.push('multiple-or-unknown-native-plurals');
      for (const plural of record.sourcePluralVariants.filter(value => value !== null)) {
        if (printfEvidence(plural).length || /<[^<>\r\n]+>/.test(plural)) reasons.push('unsupported-plural-template');
      }
      for (const binding of record.sourceBindings) {
        assert.equal(binding.bindingStatus, 'exact-pointer');
        if (!documents.has(binding.sourceFile)) {
          const buffer = readFileSync(path.join(UPSTREAM, binding.sourceFile));
          documents.set(binding.sourceFile, JSON.parse(buffer.toString('utf8'))); definitionPins[binding.sourceFile] = sha256(buffer);
        }
        const document = documents.get(binding.sourceFile), owner = traverse(document, binding.ownerPointer);
        assert.equal(owner.type.toLowerCase(), binding.ownerType);
        assert.equal(owner[binding.ownerIdentity.field], binding.ownerIdentity.value);
        for (const pointer of binding.jsonPointers) {
          const definition = pluralDefinition(traverse(document, pointer));
          assert.equal(definition.singular, record.en); assert.equal(definition.plural, record.sourcePluralVariants[0]);
          assert.equal(definition.context, record.context); pointers++;
          pluralMethods[definition.method] = (pluralMethods[definition.method] ?? 0) + 1;
        }
        const producer = route(binding, document);
        if (producer.kind === 'unresolved-owner-field') reasons.push('unresolved-owner-field');
        routeCounts[producer.kind] = (routeCounts[producer.kind] ?? 0) + 1;
        bindings.push({binding, producer});
      }
      const key = (record.context ? record.context + '\u0004' : '') + record.en;
      const nativeJA = mo.lookup(key);
      assert.ok(nativeJA, 'actual Japanese MO missing leaf: ' + record.id);
      assert.equal(nativeJA.translated, record.ja, 'MO Japanese differs from companion');
      assert.equal(nativeJA.original, key + '\0' + record.sourcePluralVariants[0], 'MO native plural binding differs');
      const item = {...record, producerBindings: bindings,
        termApiMapping: {idUnchanged: true, dispatchId: DISPATCH_ID, dispatchScope: 'internal-test-only-unconnected', parameter: {name: 'leaf', kind: 'term', origin: 'existing ParameterValue::Term API operand, not an inferred source role'}, count: {one: 1, other: 0, meaning: 'declared representative of original native selector category; not displayed quantity'}, enOne: record.en, enOther: record.sourcePluralVariants[0], jaOther: record.ja},
        japaneseMO: {file: MO_PATH, entryIndex: nativeJA.index, exactTranslationAndPluralVerified: true, pluralRule: 'nplurals=1; plural=0;'},
        coverageScope: 'raw definition translation leaf only; no complete dynamic item/monster/score assembly or live producer hook'};
      inventory.push(item); counts[record.sourceBindings[0].ownerType]++;
      if (reasons.length) blocked.push({...item, blockers: [...new Set(reasons)]});
      else {
        en.entries[record.id] = {parameters: {}, one: literalTemplate(record.en), other: literalTemplate(record.sourcePluralVariants[0])};
        ja.entries[record.id] = {parameters: {}, other: literalTemplate(record.ja)};
      }
    }
  } finally { mo.close(); }
  assert.equal(streamingFileHash(MO_PATH), nativeMOHash, 'Japanese MO changed during bounded verification');
  en.entries[DISPATCH_ID] = {parameters: {leaf: 'term'}, other: '{leaf}'};
  ja.entries[DISPATCH_ID] = {parameters: {leaf: 'term'}, other: '{leaf}'};
  validateCatalog(en); validateCatalog(ja);
  const common = {schemaVersion: 1, sourceCommit: SOURCE_COMMIT, inputSha256: hashes, rustConsumerVerified: false, originalProducerConnected: false, runtimeConnected: false};
  return {
    'en.json': en, 'ja.json': ja,
    'consumer-inventory.json': {...common, sourcePins, definitionFileSha256: definitionPins, japaneseNativeMO: {file: MO_PATH, sha256: nativeMOHash, header: metadata.translated}, dispatcherScope: 'Internal test-only term binder; absent from upstream/public registry', records: inventory},
    'blocked-identities.json': {...common, records: blocked},
    'summary.json': {...common, inputNativePluralIdentities: 155, preparedPublicTermIdentities: Object.keys(en.entries).length - 1, internalTestDispatchers: 1,
      totalRuntimeEntries: Object.keys(en.entries).length, blockedIdentities: blocked.length, ownerCounts: counts, producerBindingCounts: routeCounts,
      exactJSONPointersChecked: pointers, nativePluralDefinitionMethodsPerPointer: pluralMethods, actualJapaneseMOMatches: inventory.length,
      completeNativeCallerGraphVerified: false, sourceLeafContractsVerified: true,
      selectorBoundary: 'Original C++ freezes n==1 after actual argument/phase/type conversions; Rust receives One/Other and maps to declared term counts1/0. Node rejects unmodeled unsigned narrowing instead of guessing.',
      supportedLocales: ['en', 'ja'], candidateConsumerOnly: true, wholeGameSemanticMigrationComplete: false,
      blockedProducerSituations: ['Missing original resolved itype phase', 'Unknown caller route or selected variant/type identity', 'Quantity beyond signed-int range without original C++ frozen selector', 'Statistic target confused with current value', 'Dynamic nickname, blood, conditional names, corpse ownership or other name assembly passed as this raw leaf', 'Missing/overridden runtime definitions, mod load precedence, or actual native-ID annotation not resolved'],
      remainingGates: ['Genuine Rust consumer tests prepared but unexecuted', 'Prepared native C++ selector fixtures uncompiled/unexecuted', 'Original definition identity annotation and selected producer/FFI hooks', 'Resolved inheritance/mod precedence and actual live selector capture', 'Dynamic name/score assembly, fallback policy and actual game/browser tests', 'Full game semantic coverage remains incomplete']},
  };
}
export function main(check = false) {
  const artifacts = prepare();
  if (!check) mkdirSync(path.join(DIRECTORY, 'output'), {recursive: true});
  for (const [name, value] of Object.entries(artifacts)) {
    const target = path.join(DIRECTORY, 'output', name), data = serialized(value);
    if (check) assert.equal(readFileSync(target, 'utf8'), data, 'stale generated artifact ' + name);
    else writeFileSync(target, data, 'utf8');
  }
  console.log(JSON.stringify(artifacts['summary.json'], null, 2));
  return artifacts;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.includes('--check'));
