#!/usr/bin/env node
// GPL-3.0-or-later: generated text data retains official ToME provenance.
// This build reads source; it never executes, rewrites or loads upstream gameplay.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { lexLua } from './lua-lexer.mjs';
import { directLiteralHooks } from './direct-literal-hooks.mjs';

const slug = text => String(text).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'text';
const words = text => text.replace(/#[A-Za-z0-9_]+#|#\{[^}]*\}#/g, ' ').replace(/%(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[cdiouxXeEfgGqsaA]/g, ' parameter ').match(/[a-zA-Z0-9]+/g)?.map(slug) ?? ['text'];
export const specs = text => [...text.replace(/%%/g, '').matchAll(/%(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[cdiouxXeEfgGqsaA]/g)].map(match => match[0]);
const parameterType = spec => /[diouxXeEfgGaAc]$/.test(spec) ? 'number' : /[sq]$/.test(spec) ? 'string' : 'unknown';
const sourceKey = (source, tag) => `${tag}\u0000${source}`;
const locationKey = row => `${row.sourceRootId ?? row.source_root_id}:${row.file}:${row.line}:${row.column ?? 0}`;
const normalizeFile = file => file?.replace(/^@/, '').replace(/\\/g, '/').replace(/^\/+/, '') ?? null;
export function sectionFile(section, catalogueFile) {
  if (!section || section === '.always_merge') return null;
  const module = /game\/modules\/([^/]+)/.exec(catalogueFile);
  const addon = /game\/addons\/([^/]+)/.exec(catalogueFile);
  const moduleFile = (name, suffix) => `game/modules/${name}/${/^(data|mod)\//.test(suffix) ? '' : 'mod/'}${suffix}`;
  if (section.startsWith('game/')) return section;
  if (addon && section.startsWith(addon[1] + '/')) return 'game/addons/' + section;
  if (section.startsWith('mod-tome/')) return moduleFile('tome', section.slice(9));
  if (section.startsWith('mod-boot/')) return moduleFile('boot', section.slice(9));
  if (section.startsWith('engine/modules/boot/')) return moduleFile('boot', section.slice(20));
  if (section.startsWith('engine/engine/') || section.startsWith('engine/data/')) return 'game/engines/default/' + section.slice(7);
  if (section.startsWith('engine/')) return 'game/engines/default/' + section;
  if (section.startsWith('data/')) return module ? `game/modules/${module[1]}/${section}` : addon ? `game/addons/${addon[1]}/${section}` : `game/engines/default/${section}`;
  if (section.startsWith('mod/')) return module ? `game/modules/${module[1]}/${section}` : addon ? `game/addons/${addon[1]}/${section}` : section;
  return addon ? `game/addons/${addon[1]}/${section}` : module ? `game/modules/${module[1]}/${section}` : section;
}

function functionContexts(source) {
  const { tokens } = lexLua(source), contexts = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'identifier' || tokens[i].value !== 'function') continue;
    let name = null;
    if (tokens[i + 1]?.type === 'identifier') {
      const nameTokens = [];
      let j = i + 1;
      while (j < tokens.length && tokens[j].value !== '(') nameTokens.push(tokens[j++].value);
      name = nameTokens.join('').replace(/^_M[.:]/, '');
    } else if (tokens[i - 1]?.value === '=' && tokens[i - 2]?.type === 'identifier') name = tokens[i - 2].value;
    if (!name) continue;
    let depth = 1, j = i;
    while (++j < tokens.length && depth) {
      if (tokens[j].type !== 'identifier') continue;
      if (['function', 'if', 'do', 'repeat'].includes(tokens[j].value)) depth++;
      else if (['end', 'until'].includes(tokens[j].value)) depth--;
    }
    contexts.push({ start: tokens[i].start, end: tokens[Math.min(j - 1, tokens.length - 1)]?.end ?? source.length, name: slug(name) });
  }
  return { contexts, hooks: directLiteralHooks(tokens) };
}

export function ownerOf(candidate, functionName = null) {
  const fileOwner = normalizeFile(candidate.file).replace(/\.lua$/, '').split('/').map(slug).join('.');
  const declaration = candidate.declaration;
  const identity = declaration && !String(declaration.identity).startsWith('at_line_') ? slug(Array.isArray(declaration.identity) ? declaration.identity.join('_') : declaration.identity) : null;
  const definition = declaration ? slug(declaration.kind.replace(/^new/, '')) : null;
  const functionOwner = candidate.functionField?.field ?? functionName;
  const field = candidate.field ?? candidate.functionField?.field ?? null;
  return [fileOwner, identity ? definition : null, identity, functionOwner ? 'method' : null, functionOwner ? slug(functionOwner) : null, field ? 'property' : null, field ? slug(field) : null, !field && candidate.call ? slug(candidate.call.name.split(/[.:]/).at(-1)) : null].filter(Boolean).join('.');
}

/** Resolve punctuation/case/format variants explicitly, without hashes or row numbers. */
export function assignIds(records) {
  const byBase = new Map();
  for (const record of records) {
    const labelWords = words(record.source), label = labelWords.slice(0, 10).join('_');
    const base = `${record.owner}.${slug(record.tag)}.${label}`;
    const group = byBase.get(base) ?? []; group.push(record); byBase.set(base, group);
  }
  const ids = new Map(), collisionResolutions = [];
  for (const [base, group] of byBase) {
    const distinct = [...new Set(group.map(record => sourceKey(record.source, record.tag)))];
    for (const record of group) {
      let id = base;
      if (distinct.length > 1) {
        const allWords = words(record.source);
        const distinguishing = allWords.slice(10).join('_');
        const punctuation = [...record.source.matchAll(/[^a-zA-Z0-9\s]/g)].map(match => ({ '!': 'exclamation', '?': 'question', '.': 'period', ':': 'colon', ';': 'semicolon', ',': 'comma', '%': 'percent', '#': 'markup', '(': 'open_paren', ')': 'close_paren', '[': 'open_bracket', ']': 'close_bracket', '/': 'slash', '-': 'hyphen', '+': 'plus', '=': 'equals', "'": 'apostrophe', '"': 'quote', '\\': 'backslash', '<': 'less', '>': 'greater', '_': 'underscore', '*': 'star' }[match[0]] ?? `codepoint_${match[0].codePointAt(0).toString(16)}`)).join('_');
        const layout = `${record.source.includes('\n') ? 'multiline' : 'single_line'}_${(record.source.match(/\n/g) ?? []).length}_lines_${(record.source.match(/\s/g) ?? []).length}_spaces`;
        const casing = (record.source.match(/[a-zA-Z0-9]+/g) ?? []).map(word => word === word.toLowerCase() ? 'lower' : word === word.toUpperCase() ? 'upper' : /^[A-Z][a-z0-9]*$/.test(word) ? 'title' : 'mixed').join('_');
        const markup = (record.source.match(/#[A-Za-z0-9_]+#|#\{[^}]+\}#/g) ?? []).map(slug).join('_');
        id += `.detail.${distinguishing || 'same_words'}.format.${specs(record.source).map(slug).join('_') || 'plain'}.markup.${markup || 'none'}.punctuation.${punctuation || 'none'}.case.${casing || 'none'}.${layout}`;
        collisionResolutions.push({ base, id, owner: record.owner, source: record.source, tag: record.tag, resolution: 'actual_owner_full_message_format_and_layout_context' });
      }
      const existing = ids.get(id);
      if (existing && sourceKey(existing.source, existing.tag) !== sourceKey(record.source, record.tag)) {
        const conflict = { id, existing: { source: existing.source, tag: existing.tag, owner: existing.owner, locations: existing.locations }, incoming: { source: record.source, tag: record.tag, owner: record.owner, locations: record.locations } };
        throw new Error(`Unresolved semantic ID collision: ${JSON.stringify(conflict)}`);
      }
      record.id = id; ids.set(id, record);
    }
  }
  return { ids, collisionResolutions };
}

export function placeholderSafety(english, japanese, order, special) {
  if (japanese === null) return { safe: true, status: 'missing_official_japanese' };
  if (special.length) return { safe: true, status: 'delegate_original_special_formatter' };
  const source = specs(english), target = specs(japanese);
  const argumentsTypes = order.length ? order.map(index => parameterType(source[index - 1] ?? '')) : source.map(parameterType);
  const safe = target.length <= argumentsTypes.length && target.every((specifier, index) => parameterType(specifier) === argumentsTypes[index]);
  return { safe, status: safe ? 'compatible_original_printf_arguments' : 'placeholder_contract_requires_review', source, target, order };
}

async function build(options) {
  const started = performance.now(), memorySamples = [];
  const measure = phase => {
    const memory = process.memoryUsage();
    const sample = { phase, elapsed_ms: Math.round(performance.now() - started), rss_bytes: memory.rss, heap_used_bytes: memory.heapUsed, heap_total_bytes: memory.heapTotal };
    memorySamples.push(sample); console.error(JSON.stringify(sample));
  };
  const inventory = path.resolve(options.inventory), output = path.resolve(options.output);
  fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(path.join(output, 'catalogs'), { recursive: true });
  const summary = JSON.parse(fs.readFileSync(path.join(inventory, 'summary.json'), 'utf8'));
  const official = JSON.parse(fs.readFileSync(path.join(inventory, 'source-ja-map.json'), 'utf8'));
  // Keep only provenance/formatter fields used below. Inventory review fields and
  // duplicate source/target strings are not part of the runtime registry.
  for (const tags of Object.values(official.bySourceAndTag)) for (const original of Object.values(tags)) {
    original.registrations = original.registrations.map(({ file, line, section, argsOrder = [], specialTokens = [] }) => ({ file, line, section, argsOrder, specialTokens }));
  }
  measure('official_catalogue_compacted');
  const candidates = [];
  const reader = readline.createInterface({ input: fs.createReadStream(path.join(inventory, 'text-candidates.jsonl'), 'utf8'), crlfDelay: Infinity });
  for await (const line of reader) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (row.file.includes('/data/locales/') || !/game\/(?:engines|modules\/(?:tome|boot)|addons)\//.test(row.file)) continue;
    const { sourceRootId, file, line: sourceLine, column, offset, endOffset, value, evidence, field, sourceLocalization, functionField, declaration, call } = row;
    candidates.push({ sourceRootId, file, line: sourceLine, column, offset, endOffset, value, evidence, field, sourceLocalization, functionField, declaration, call });
  }
  measure('candidates_compacted');
  const byFile = new Map();
  for (const candidate of candidates) { const key = `${candidate.sourceRootId}:${candidate.file}`; const rows = byFile.get(key) ?? []; rows.push(candidate); byFile.set(key, rows); }
  let inspectedFiles = 0, excludedNonliteralHookCandidates = 0, dynamicTagLiteralHooks = 0;
  for (const rows of byFile.values()) {
    const candidate = rows[0], rootIndex = Number(candidate.sourceRootId.replace('root_', '')) - 1;
    const { contexts, hooks } = functionContexts(fs.readFileSync(path.join(summary.sourceRoots[rootIndex], candidate.file), 'utf8'));
    for (const row of rows) {
      const method = contexts.filter(context => row.offset > context.start && row.offset < context.end).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0]; row.owner = ownerOf(row, method?.name);
      const actualHook = hooks.get(row.offset);
      if (row.sourceLocalization && row.sourceLocalization.hook !== '_nt_marker' && !actualHook) excludedNonliteralHookCandidates++;
      if (actualHook?.dynamic_tag) dynamicTagLiteralHooks++;
      row.sourceLocalization = actualHook ?? (row.sourceLocalization?.hook === '_nt_marker' ? row.sourceLocalization : null);
    }
    if (++inspectedFiles % 50 === 0) measure(`source_contexts_${inspectedFiles}`);
  }
  byFile.clear(); measure('source_contexts_complete');
  const byEnglish = new Map();
  for (const candidate of candidates) { const rows = byEnglish.get(candidate.value) ?? []; rows.push(candidate); byEnglish.set(candidate.value, rows); }
  const records = [], sourceRoutes = new Map(), missing = [], formatReview = [];
  const add = record => { records.push(record); const key = sourceKey(record.source, record.tag); const rows = sourceRoutes.get(key) ?? []; rows.push(record); sourceRoutes.set(key, rows); };
  for (const [source, tags] of Object.entries(official.bySourceAndTag)) for (const [tag, original] of Object.entries(tags)) {
    // Empty Japanese templates intentionally remove English articles/pronouns.
    // Lua treats "" as truthy: only absent registrations are translation gaps.
    const distinct = original.distinctLiteralTargets.filter(text => typeof text === 'string');
    if (distinct.length > 1) throw new Error(`Conflicting official source/tag targets: ${tag} ${source}`);
    const japanese = distinct.length ? distinct[0] : null;
    const matching = (byEnglish.get(source) ?? []).filter(candidate => {
      const matchingFile = original.registrations.some(registration => sectionFile(registration.section, registration.file) === candidate.file);
      return candidate.sourceLocalization ? candidate.sourceLocalization.tag === tag : matchingFile;
    });
    const contexts = matching.length ? matching.map(candidate => ({ candidate, registration: original.registrations.find(registration => sectionFile(registration.section, registration.file) === candidate.file) ?? original.registrations[0] })) : original.registrations.map(registration => ({ candidate: null, registration }));
    for (const { candidate, registration } of contexts) {
      const file = candidate?.file ?? sectionFile(registration.section, registration.file);
      const owner = candidate?.owner ?? (file ? normalizeFile(file).replace(/\.lua$/, '').split('/').map(slug).join('.') : `game.${slug(registration.section ?? 'shared_names')}.${slug(tag)}`);
      const record = { source, tag, japanese, owner, locations: candidate ? [{ source_root_id: candidate.sourceRootId, file: candidate.file, line: candidate.line, column: candidate.column }] : file ? [{ source_root_id: 'root_2', file, line: null, column: null }] : [], official: original.registrations, order: registration.argsOrder ?? [], special: registration.specialTokens ?? [], sourceKinds: candidate?.evidence ?? ['official_runtime_tag_registration'] };
      add(record);
    }
  }
  let explicitHooks = 0;
  for (const candidate of candidates) {
    const tag = candidate.sourceLocalization?.tag;
    if (!tag || candidate.sourceLocalization.hook === '_nt_marker') continue;
    explicitHooks++;
    const key = sourceKey(candidate.value, tag);
    if (sourceRoutes.has(key)) {
      const current = sourceRoutes.get(key);
      if (!current.some(record => record.owner === candidate.owner && record.locations.some(location => location.file === candidate.file && location.line === candidate.line))) {
        const original = current[0];
        add({ ...original, owner: candidate.owner, locations: [{ source_root_id: candidate.sourceRootId, file: candidate.file, line: candidate.line, column: candidate.column }] });
      }
      continue;
    }
    add({ source: candidate.value, tag, japanese: null, owner: candidate.owner, locations: [{ source_root_id: candidate.sourceRootId, file: candidate.file, line: candidate.line, column: candidate.column }], official: [], order: [], special: [], sourceKinds: candidate.evidence });
  }
  const assigned = assignIds(records), en = Object.create(null), ja = Object.create(null), entries = Object.create(null);
  byEnglish.clear(); measure('semantic_ids_assigned');
  for (const record of records) {
    en[record.id] = record.source; ja[record.id] = record.japanese;
    const safety = placeholderSafety(record.source, record.japanese, record.order, record.special);
    if (!safety.safe) formatReview.push({ id: record.id, owner: record.owner, english: record.source, japanese: record.japanese, ...safety });
    const existing = entries[record.id];
    const entry = existing ?? { owner: record.owner, tag: record.tag, japanese_status: record.japanese === null ? 'missing_official_translation' : 'official_translation', japanese_args_order: record.order, special_tokens: record.special, printf_contract: safety, native_effective_metadata_validation_required: true, declared_metadata_variants: [], source_locations: [], source_kinds: record.sourceKinds };
    const declaredMetadata = { args_order: record.order, special_tokens: record.special };
    if (!entry.declared_metadata_variants.some(value => JSON.stringify(value) === JSON.stringify(declaredMetadata))) entry.declared_metadata_variants.push(declaredMetadata);
    for (const location of record.locations) if (!entry.source_locations.some(existing => locationKey(existing) === locationKey(location))) entry.source_locations.push(location);
    entries[record.id] = entry;
  }
  const routes = [];
  for (const records of sourceRoutes.values()) {
    const aliasIds = [...new Set(records.map(record => record.id))].sort();
    const semanticContracts = [...new Set(records.map(record => JSON.stringify({ order: record.order, special: record.special })))];
    const provenance = new Map();
    for (const record of records) for (const registration of record.official) provenance.set(`${registration.file}:${registration.line}`, { file: registration.file, line: registration.line, section: registration.section });
    routes.push({ source: records[0].source, tag: records[0].tag, default_id: semanticContracts.length === 1 ? aliasIds[0] : null, aliases: aliasIds, format_ambiguity: semanticContracts.length > 1, original_catalogue_locators: [...provenance.values()] });
  }
  routes.sort((a, b) => a.tag.localeCompare(b.tag) || a.source.localeCompare(b.source));
  for (const [id, entry] of Object.entries(entries)) if (ja[id] === null) missing.push({ id, owner: entry.owner, tag: entry.tag, english: en[id], source_locations: entry.source_locations, reason: 'official_catalogue_has_no_literal_translation' });
  const registry = { schema_version: 1, source_version: '1.7.6', source_commit: '624a67329fe2ad440c5b344785a9c73fcf22ae63', default_locale: 'ja_JP', metadata_semantics: 'Registration metadata is declared provenance. Original I18N effective runtime state is authoritative; mismatched metadata delegates to the original formatter.', entries, routes, japanese_configuration: official.japaneseConfigurationCalls, fallback_semantics: 'Exact source/tag route first. Unknown tag may use nil fallback only if registered tag variants agree and native effective state agrees; otherwise delegate to the original I18N handler.' };
  // Serialize one entry at a time rather than retaining a second full registry
  // string. JSON remains ordinary interoperable JSON, with deterministic order.
  const writeJson = (filename, value) => {
    const fd = fs.openSync(filename, 'w');
    const write = text => fs.writeSync(fd, text, null, 'utf8');
    const emit = object => {
      if (Array.isArray(object)) { write('['); object.forEach((item, index) => { if (index) write(','); emit(item); }); write(']'); }
      else if (object !== null && typeof object === 'object') { write('{'); Object.entries(object).forEach(([key, item], index) => { if (index) write(','); write(JSON.stringify(key) + ':'); emit(item); }); write('}'); }
      else write(JSON.stringify(object));
    };
    try { emit(value); write('\n'); } finally { fs.closeSync(fd); }
  };
  writeJson(path.join(output, 'catalogs/en.json'), en);
  writeJson(path.join(output, 'catalogs/ja.json'), ja);
  writeJson(path.join(output, 'catalogs/registry.json'), registry);
  fs.writeFileSync(path.join(output, 'missing-official-ja.json'), JSON.stringify(missing, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'placeholder-review.json'), JSON.stringify(formatReview, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'id-collision-resolutions.json'), JSON.stringify(assigned.collisionResolutions, null, 2) + '\n');
  measure('catalogues_written');
  const result = { schema_version: 1, semantic_ids: Object.keys(entries).length, source_tag_routes: routes.length, explicit_runtime_hook_callsites: explicitHooks, excluded_nonliteral_hook_candidates: excludedNonliteralHookCandidates, dynamic_tag_literal_hooks_requiring_runtime_lookup: dynamicTagLiteralHooks, known_official_source_tag_pairs: Object.values(official.bySourceAndTag).reduce((sum, tags) => sum + Object.keys(tags).length, 0), official_intentional_empty_translation_ids: Object.values(ja).filter(value => value === '').length, missing_official_japanese_ids: missing.length, resolved_message_label_collisions: assigned.collisionResolutions.length, unresolved_id_collisions: 0, format_review_ids: formatReview.length, format_ambiguous_routes: routes.filter(route => route.format_ambiguity).length, untranslated_english_copied_to_ja: 0, source_unchanged: true };
  fs.writeFileSync(path.join(output, 'catalog-build-result.json'), JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'catalog-build-memory.json'), JSON.stringify({ node_heap_arguments: process.execArgv, v8_heap_size_limit_bytes: getHeapStatistics().heap_size_limit, enforcement: 'invoke node with recorded heap limits; retained kernel builds and browsers are not launched', peak_sampled_rss_bytes: Math.max(...memorySamples.map(sample => sample.rss_bytes)), peak_sampled_heap_used_bytes: Math.max(...memorySamples.map(sample => sample.heap_used_bytes)), memory_samples: memorySamples }, null, 2) + '\n');
  console.log(JSON.stringify(result));
}

function selfTest() {
  const result = assignIds([{ owner: 'tome.talent.strike.info', source: 'Deal %d damage!', tag: 'tformat' }, { owner: 'tome.talent.strike.info', source: 'Deal %s damage?', tag: 'tformat' }, { owner: 'tome.talent.strike.info', source: 'Deal %d damage!', tag: 'tformat' }]);
  assert.equal(result.ids.size, 2);
  assert.equal(new Set(result.collisionResolutions.map(record => record.id)).size, 2);
  assert.equal([...result.ids.keys()].some(id => /occurrence|at_line|sha|hash/.test(id)), false);
  assert.equal(placeholderSafety('%s %d', '%d %s', [2, 1], []).safe, true);
  assert.equal(placeholderSafety('%s', '%d', [], []).safe, false);
  assert.equal(placeholderSafety('%02.2f', '%d', [], []).safe, true);
  assert.equal(placeholderSafety('%s', null, [], []).status, 'missing_official_japanese');
  assert.equal(sectionFile('mod-tome/data/talents/test.lua', 'game/modules/tome/data/locales/ja_JP.lua'), 'game/modules/tome/data/talents/test.lua');
  assert.equal(sectionFile('engine/ui/Text.lua', 'game/engines/default/data/locales/engine/ja_JP.lua'), 'game/engines/default/engine/ui/Text.lua');
  assert.equal(assignIds([{ owner: 'game.options.status', source: 'Enabled', tag: '_t' }, { owner: 'game.options.status', source: 'enabled', tag: '_t' }]).ids.size, 2);
  assert.equal(assignIds([{ owner: 'world.npc.logcombat', source: '#Source# kills #Target#.', tag: 'logCombat' }, { owner: 'world.npc.logcombat', source: '#Target# kills #Source#.', tag: 'logCombat' }]).ids.size, 2);
  console.log('Production catalogue builder self-test: 11 assertions passed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2), option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  if (args.includes('--self-test')) selfTest();
  else { if (!option('--inventory') || !option('--output')) throw new Error('Use --inventory PATH --output PATH'); await build({ inventory: option('--inventory'), output: option('--output') }); }
}
