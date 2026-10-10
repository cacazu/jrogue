#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Source-only generator: exact reversible derived leaves and isolated JSON delta.
// It does not load or execute Lua, compile, run a server, or run a browser.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import { parseUniqueJson, validateDelta } from './merge-delta.mjs';

const directory = import.meta.dirname, project = path.dirname(directory);
const output = path.join(directory, 'candidate');
const commit = '624a67329fe2ad440c5b344785a9c73fcf22ae63';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let assertions = 0, sampledPeakRss = process.memoryUsage().rss;
const sample = () => { sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss); };
const equal = (left, right, message) => { assertions++; assert.deepEqual(left, right, message); };
const truth = (condition, message) => { assertions++; assert.ok(condition, message); };
const readJson = relative => parseUniqueJson(fs.readFileSync(path.join(project, relative), 'utf8'));
const auditPath = path.join(project, 'unknown-runtime-audit-work/reviewed-summary.json');
const auditBytes = fs.readFileSync(auditPath), audit = parseUniqueJson(auditBytes.toString('utf8'));
const review = readJson('semantic-missing-routes-work/reviewed-labels.json');
equal(audit.source_commit, commit, 'Wrong audited source revision');
equal(review.source_commit, commit, 'Wrong authored review revision');
equal(review.labels.length, 20, 'Expected twenty meaningful labels');
equal(review.retained_placeholders.length, 4, 'Expected four opaque placeholders');
equal(audit.english_runtime_labels.length, 24, 'Audit changed');
equal([...review.labels.map(row => row.source), ...review.retained_placeholders].sort(), audit.english_runtime_labels.map(row => row.source).sort(), 'Exact 24-label partition required');
truth(review.labels.every(row => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(row.japanese)), 'Meaningful Japanese labels required');
const roots = readJson('inventory-work/inventory-output/summary.json').sourceRoots;
const unpacked = path.resolve(process.argv[2] ?? roots[1]);
const files = new Map();
function original(file) {
  if (files.has(file)) return files.get(file);
  const bytes = fs.readFileSync(path.join(unpacked, file)), source = bytes.toString('utf8');
  equal(Buffer.from(source, 'utf8'), bytes, 'Original source is not exact UTF-8: ' + file);
  const row = { file, bytes: bytes.length, sha256: hash(bytes), source, lines: source.split(/\r?\n/) };
  files.set(file, row); sample(); return row;
}

const talentFile = 'game/engines/default/engine/interface/ActorTalents.lua';
const factionFile = 'game/engines/default/engine/Faction.lua';
const activationFile = 'game/modules/tome/mod/class/interface/ActorObjectUse.lua';
const inscriptionFile = 'game/modules/tome/data/talents/misc/inscriptions.lua';
const talent = original(talentFile), faction = original(factionFile), activation = original(activationFile), inscription = original(inscriptionFile);
equal(talent.sha256, audit.consumer_groups.find(row => row.file === talentFile && row.line === 88).source_evidence.sha256, 'Talent original hash differs');
equal(faction.sha256, audit.consumer_groups.find(row => row.file === factionFile).source_evidence.sha256, 'Faction original hash differs');
equal(talent.lines[70], '\tt.short_name = t.short_name or t.name', 'Talent identity seed moved');
equal(talent.lines[71], '\tt.short_name = t.short_name:upper():gsub("[ \']", "_")', 'Talent identity normalization moved');
equal(talent.lines[89], '\tt.id = "T_"..t.short_name', 'Talent ID assignment moved');
equal(faction.lines[37], '\tt.short_name = t.short_name or t.name:lower():gsub(" ", "-")', 'Faction identity generation moved');
equal(activation.lines[72], '_M.base_object_talent_name = "Activate Object"', 'Activation seed moved');
equal(activation.lines[73], '_M.max_object_use_talents = 50 --(allows for approximately 15 items worn and 35 items carried.)', 'Activation limit moved');
equal(activation.lines[80], '\tlocal short_name = base_name:upper():gsub("[ ]", "_").."_"..num', 'Activation generator moved');
equal(activation.lines[81], '\treturn "T_"..short_name, short_name', 'Activation ID generator moved');
equal(inscription.lines[21], '\tfor i = 1, 6 do', 'Inscription slot limit moved');
equal(inscription.lines[23], '\t\ttt.short_name = tt.name:upper():gsub("[ ]", "_").."_"..i', 'Inscription ID generator moved');
truth(inscription.lines[1154].includes('only kept for legacy compatibility and occasionally NPC use'), 'Original legacy scope changed');

const reviewed = review.labels.map(label => {
  const row = audit.english_runtime_labels.find(row => row.source === label.source);
  equal(row.official_matches.length, 0, 'Not an authored missing translation anymore');
  const producer = row.producer_candidates.find(candidate => candidate.field === 'name' || candidate.field === 'base_object_talent_name') ?? row.producer_candidates[0];
  const source = original(producer.file);
  equal(source.sha256, producer.sha256, 'Producer pristine hash differs: ' + label.source);
  truth(source.lines[producer.line - 1].includes('"' + label.source + '"'), 'Producer literal moved: ' + label.source);
  const nativeBase = label.source.toUpperCase().replace(/[ ']/g, '_');
  let stableShortNames, condition;
  if (label.role === 'builtin_faction') {
    stableShortNames = ['players']; condition = 't.short_name == "players"';
  } else if (label.role === 'generated_activation') {
    stableShortNames = Array.from({ length: 50 }, (_, i) => 'ACTIVATE_OBJECT_' + (i + 1));
    condition = '(t.short_name:match("^ACTIVATE_OBJECT_([1-9][0-9]?)$") and tonumber(t.short_name:match("([0-9]+)$")) <= 50)';
  } else if (label.role === 'legacy_inscription') {
    stableShortNames = Array.from({ length: 6 }, (_, i) => nativeBase + '_' + (i + 1));
    condition = 't.short_name:match("^' + nativeBase + '_[1-6]$")';
  } else { stableShortNames = [nativeBase]; condition = 't.short_name == "' + nativeBase + '"'; }
  const ownerBase = producer.file.replace(/\.lua$/, '').replace(/[^a-zA-Z0-9/]/g, '_').replaceAll('/', '.').toLowerCase();
  const owner = ownerBase + '.' + label.owner_suffix;
  const id = owner + '.property.name';
  truth(/^[a-z0-9_.]+$/.test(id), 'Invalid semantic ID');
  return { ...label, semantic_id: id, owner, tag: row.tag, original_consumer: { file: row.consumer, line: row.line },
    producer: { file: producer.file, line: producer.line, bytes: source.bytes, sha256: source.sha256 },
    stable_short_names: stableShortNames, branch_condition: 't.name == ' + JSON.stringify(label.source) + ' and ' + condition };
});

const talentBefore = '\tt.name = _t(t.name, "talent name")';
const factionBefore = '\tt.name = _t(t.name, "faction name")';
const talentRows = reviewed.filter(row => row.role !== 'builtin_faction');
const talentAfter = [ '\t-- Reviewed display leaves only; the original short_name is already final.',
  ...talentRows.flatMap((row, index) => ['\t' + (index ? 'elseif ' : 'if ') + row.branch_condition + ' then', '\t\tt.name = _t(' + JSON.stringify(row.source) + ', "talent name")']),
  '\telse', talentBefore.replace(/^\t/, '\t\t'), '\tend' ].join('\n');
const players = reviewed.find(row => row.source === 'Players');
const factionAfter = [ '\t-- Builtin faction display only; preserve the original players identity.',
  '\tif ' + players.branch_condition + ' then', '\t\tt.name = _t("Players", "faction name")',
  '\telse', factionBefore.replace(/^\t/, '\t\t'), '\tend' ].join('\n');
const overlays = [];
function overlay(originalRow, before, after, line) {
  equal(originalRow.lines[line - 1], before, 'Wrong exact original translation call');
  equal(originalRow.source.split(before).length, 2, 'Original splice must be unique');
  const source = originalRow.source.replace(before, after);
  equal(source.replace(after, before), originalRow.source, 'Overlay must reverse byte-exactly');
  const bytes = Buffer.from(source, 'utf8');
  const filename = 'overlay/' + originalRow.file;
  fs.mkdirSync(path.join(output, path.dirname(filename)), { recursive: true });
  fs.writeFileSync(path.join(output, filename), bytes);
  const name = path.basename(originalRow.file, '.lua') + '-display-leaves.patch';
  const patch = '--- a/' + originalRow.file + '\n+++ b/' + originalRow.file + '\n@@ -' + line + ',1 +' + line + ',' + after.split('\n').length + ' @@\n-' + before + '\n' + after.split('\n').map(line => '+' + line).join('\n') + '\n';
  fs.writeFileSync(path.join(output, name), patch);
  const row = { original: { file: originalRow.file, bytes: originalRow.bytes, sha256: originalRow.sha256 },
    derived: { file: filename, bytes: bytes.length, sha256: hash(bytes) }, patch: { file: name, bytes: Buffer.byteLength(patch), sha256: hash(patch) },
    splice: { line, before, after }, only_display_field_modified: 't.name',
    original_identity_assignments_byte_unchanged: true, original_pristine_source_modified: false, native_runtime_verified: false };
  overlays.push(row); return source;
}
fs.mkdirSync(output, { recursive: true });
const derivedTalent = overlay(talent, talentBefore, talentAfter, 88);
const derivedFaction = overlay(faction, factionBefore, factionAfter, 40);
for (const row of reviewed) {
  const source = row.role === 'builtin_faction' ? derivedFaction : derivedTalent;
  const needle = '\t\tt.name = _t(' + JSON.stringify(row.source) + ', ' + JSON.stringify(row.tag) + ')';
  equal(source.split(needle).length, 2, 'One exact derived literal route required');
  row.overlay_consumer = { file: row.original_consumer.file, line: source.slice(0, source.indexOf(needle)).split('\n').length };
}

const english = {}, japanese = {}, japaneseBase = {}, entries = {}, routes = [];
for (const row of reviewed) {
  const id = row.semantic_id;
  english[id] = row.source; japanese[id] = row.japanese; japaneseBase[id] = null;
  entries[id] = { owner: row.owner, tag: row.tag, japanese_status: 'missing_official_translation_with_separate_authored_supplement',
    japanese_args_order: [], special_tokens: [], parameters: [],
    printf_contract: { safe: true, status: 'compatible_original_printf_arguments', source: [], target: [], order: [] },
    native_effective_metadata_validation_required: true,
    source_locations: [ { source_root_id: 'root_2', ...row.producer, bytes: undefined, sha256: undefined, role: 'original_producer' },
      { source_root_id: 'root_2', ...row.original_consumer, role: 'original_post_identity_display_consumer' },
      { source_root_id: 'root_2', ...row.overlay_consumer, overlay: true, role: 'exact_stable_identity_literal_display_consumer' } ],
    source_kinds: [ 'reviewed_runtime_registration_display_route', 'reviewed_source_overlay:exact_stable_identity_literal' ] };
  routes.push({ source: row.source, tag: row.tag, default_id: id, aliases: [id], format_ambiguity: false });
}
const registry = { schema_version: 1, source_commit: commit, default_locale: 'ja_JP', japanese_configuration: [], entries, routes };
const index = { schema_version: 1, source_commit: commit, exact_source_tag_and_consumer_required: true,
  default_variant: 'original', routes: reviewed.map(({ semantic_id, source, tag, original_consumer, overlay_consumer, producer, stable_short_names, branch_condition }) =>
    ({ semantic_id, source, tag, original_consumer, overlay_consumer, producer, stable_short_names, branch_condition })) };
const delta = { schema_version: 1, source_commit: commit, english, japanese_base: japaneseBase, japanese_supplement: japanese, registry, route_index: index,
  activation_status: 'source_candidate_not_loaded_in_existing_runtime', unchanged_existing_base_and_dream_ids: true,
  translation_provenance: 'authored_source_grounded; official related terminology only; these exact original names have no official registration' };
truth(validateDelta(delta), 'Delta contract failed');
const jsonOutputs = new Map([
  ['en.json', english], ['ja.json', japanese], ['ja-base.json', japaneseBase], ['ja-supplement.json', japanese],
  ['registry.json', registry], ['route-index.json', index], ['semantic-route-delta.json', delta],
]);
const write = (name, value) => { const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8'); fs.writeFileSync(path.join(output, name), bytes); return { file: name, bytes: bytes.length, sha256: hash(bytes) }; };
const artifacts = [...jsonOutputs].map(([name, value]) => write(name, value));

// Check source collisions without materializing the 30 MB registry entries.
async function* registryRoutes(file) {
  let found = false, tail = '', value = '', depth = 0, inString = false, escaped = false;
  for await (const chunk of fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 65536 })) {
    let input = chunk;
    if (!found) { const combined = tail + chunk, match = /"routes"\s*:\s*\[/.exec(combined);
      if (!match) { tail = combined.slice(-256); continue; } found = true; input = combined.slice(match.index + match[0].length); tail = ''; }
    for (const character of input) {
      if (!depth) { if (character === ']') return; if (/[\s,]/.test(character)) continue;
        equal(character, '{', 'Registry route object required'); depth = 1; value = '{'; inString = false; escaped = false; continue; }
      value += character;
      if (inString) { if (escaped) escaped = false; else if (character === '\\') escaped = true; else if (character === '"') inString = false; continue; }
      if (character === '"') inString = true; else if (character === '{' || character === '[') depth++; else if (character === '}' || character === ']') depth--;
      if (!depth) { yield parseUniqueJson(value); value = ''; sample(); }
      if (value.length > 2 * 1024 * 1024) throw Error('Oversized single registry route');
    }
  }
  throw Error('Unterminated registry route array');
}
const deltaSources = new Set(reviewed.map(row => row.source));
let routeCount = 0;
for await (const route of registryRoutes(path.join(project, 'localization-kernel-work/catalogs/registry.json'))) {
  routeCount++; truth(!deltaSources.has(route.source), 'Existing base source route collision: ' + route.source);
}
equal(routeCount, audit.route_audit.streamed_current_routes, 'Baseline route inventory changed');

const termSources = new Set(['Activate an object', 'Infusion: Healing', 'Rune: Teleportation', 'Taint: Devourer', 'Vision', 'Phase Door', 'Insidious Poison', 'Lightning', 'Invisibility', 'Heat Shift', 'Phase Shift']);
const terms = [];
let registrations = 0;
for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(project, 'inventory-work/inventory-output/upstream-ja-catalogue.jsonl'), { encoding: 'utf8', highWaterMark: 65536 }), crlfDelay: Infinity })) {
  if (!line) continue;
  const row = parseUniqueJson(line); registrations++;
  if (termSources.has(row.english) && !terms.some(term => term.source === row.english) && (row.file.includes('/tome/') || row.english === 'Lightning')) {
    const locale = original(row.file);
    truth(locale.lines[row.line - 1].includes(JSON.stringify(row.english)), 'Official term source line changed');
    truth(locale.lines[row.line - 1].includes(JSON.stringify(row.translated)), 'Official term target line changed');
    terms.push({ file: row.file, line: row.line, source: row.english, japanese: row.translated, tag: row.tag, section: row.section, sha256: locale.sha256 });
  }
  if (registrations % 1000 === 0) sample();
}
equal(terms.length, termSources.size, 'Expected related official terminology provenance');
artifacts.push(write('translation-review.json', { schema_version: 1, source_commit: commit, review_status: review.review_status,
  labels: reviewed, related_official_terminology: terms, exact_original_registration_missing: 20, translations_authored: 20,
  dynamic_parameters: 0, external_user_names_modified: false, legacy_drop_tables_modified: false }));

const placeholderRows = review.retained_placeholders.map(source => {
  const auditRow = audit.english_runtime_labels.find(row => row.source === source), producer = auditRow.producer_candidates.find(row => row.field === 'name') ?? auditRow.producer_candidates[0];
  const originalRow = original(producer.file);
  equal(originalRow.sha256, producer.sha256, 'Placeholder source changed');
  truth(originalRow.lines[producer.line - 1].includes(JSON.stringify(source)), 'Placeholder literal moved');
  return { source, native_short_name: source.toUpperCase().replace(/[ ']/g, '_'), producer: { file: producer.file, line: producer.line, sha256: originalRow.sha256 },
    policy: 'retain_exact_upstream_opaque_label', japanese_replacement_authored: false, active_route_added: false,
    reason: 'Original labels contain unfinished placeholder text. Descriptions are not evidence of an intended finished talent name or completed implementation.',
    player_learnability_or_rendered_exposure_verified: false };
});
artifacts.push(write('unfinished-placeholder-policy.json', { schema_version: 1, source_commit: commit, labels: placeholderRows,
  excluded_from_twenty_label_delta: true, remaining_japanese_label_semantics_unresolved: 4, runtime_verified: false }));
artifacts.push(write('already-japanese-policy.json', { schema_version: 1, source_commit: commit, observed_keys: 953,
  observed_exact_official_target_equalities: 877, new_translations_added: 0, reverse_japanese_replacement: false,
  scope: 'Repeated native translation inputs are retained unchanged. Producer identity/parameter routes for dynamic decorated text require a separate future audit.' }));

for (const originalRow of files.values()) equal(hash(fs.readFileSync(path.join(unpacked, originalRow.file))), originalRow.sha256, 'Pristine source changed during inspection');
const baseFiles = [
  ['english', 'localization-kernel-work/catalogs/en.json'],
  ['japanese', 'localization-kernel-work/catalogs/ja.json'],
  ['registry', 'localization-kernel-work/catalogs/registry.json'],
  ['supplements', 'localization-review-work/final-review/ja-supplement-complete.json'],
];
const baseEnglish = readJson(baseFiles[0][1]), baseJapanese = readJson(baseFiles[1][1]), baseSupplements = readJson(baseFiles[3][1]);
equal(Object.keys(baseEnglish).sort(), Object.keys(baseJapanese).sort(), 'Existing base EN/JA coverage differs');
for (const id of Object.keys(english)) {
  truth(!Object.hasOwn(baseEnglish, id) && !Object.hasOwn(baseJapanese, id) && !Object.hasOwn(baseSupplements, id), 'Existing base/supplement ID collision');
}
const baseCatalogueInputs = [];
for (const [kind, file] of baseFiles) {
  const digest = crypto.createHash('sha256'); let bytes = 0;
  for await (const chunk of fs.createReadStream(path.join(project, file), { highWaterMark: 65536 })) { digest.update(chunk); bytes += chunk.length; sample(); }
  baseCatalogueInputs.push({ kind, file, bytes, sha256: digest.digest('hex') });
}
const manifest = { schema_version: 1, source_commit: commit,
  input_audit: { file: 'unknown-runtime-audit-work/reviewed-summary.json', bytes: auditBytes.length, sha256: hash(auditBytes), proof_sha256: audit.evidence.sha256 },
  meaningful_semantic_ids: 20, exact_routes: 20, native_short_name_identities: reviewed.reduce((sum, row) => sum + row.stable_short_names.length, 0),
  authored_japanese_supplements: 20, official_japanese_registration_absent: 20, retained_opaque_placeholders: 4, ignored_japanese_second_pass_keys: 953,
  original_sources: [...files.values()].map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 })),
  overlays, artifacts, structural_source_assertions: assertions, base_routes_scanned: routeCount, official_registrations_scanned: registrations,
  base_catalogue_inputs: baseCatalogueInputs, base_catalogue_semantic_ids: Object.keys(baseEnglish).length,
  baseline_dream_ids_kept_separate: 1, existing_authored_supplements: Object.keys(baseSupplements).length,
  existing_base_catalog_modified: false, existing_dream_extension_modified: false, original_source_modified: false,
  gameplay_or_rng_executed: false, build_executed: false, native_runtime_verified: false,
  loader_requirement: 'Fresh 1/2/3 stages plus exact-context guard and merged reviewed supplement4; keep original dream extension6 unchanged.',
  memory: { sampled_peak_rss_bytes: sampledPeakRss, final: process.memoryUsage() } };
write('source-manifest.json', manifest);
console.log(JSON.stringify({ passed: true, assertions, semantic_ids: 20, original_source_modified: false, build_or_gameplay_executed: false,
  output, overlays: overlays.map(row => row.derived), sampled_peak_rss_bytes: sampledPeakRss }));
