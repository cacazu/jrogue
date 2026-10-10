#!/usr/bin/env node
/** Source-only inventory of active upstream locale t() registrations. */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import { lexLua } from './inventory-tome.mjs';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const testing = args.includes('--self-test');
if (!testing && (!option('--source') || !option('--inventory'))) throw new Error('Use --source UNPACKED_ROOT --inventory INVENTORY_OUTPUT [--output OUTPUT].');
const root = testing ? null : path.resolve(option('--source'));
const inventory = testing ? null : path.resolve(option('--inventory'));
const output = testing ? null : path.resolve(option('--output') ?? inventory);
if (!testing) fs.mkdirSync(output, { recursive: true });
const relative = absolute => path.relative(root, absolute).split(path.sep).join('/');
const hashRegex = /#[A-Za-z0-9_]+#|#\{[^}]+\}#/g;
const printfSpecifiers = value => [...value.replace(/%%/g, '').matchAll(/%(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[cdiouxXeEfgGqsaA]/g)].map(m => m[0]);
const printf = value => printfSpecifiers(value).map(specifier => specifier.at(-1));
const normalizedKey = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const scopeOf = file => /game\/modules\/([^/]+)/.exec(file)?.[1] ? `module.${normalizedKey(/game\/modules\/([^/]+)/.exec(file)[1])}` : /game\/addons\/([^/]+)/.exec(file)?.[1] ? `addon.${normalizedKey(/game\/addons\/([^/]+)/.exec(file)[1])}` : file.includes('/engine') ? 'engine' : normalizedKey(file.split('/')[0]);
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(directory, e.name)) : e.isFile() ? [path.join(directory, e.name)] : []);
}

function literalValue(tokens) {
  let index = 0;
  function parse() {
    const token = tokens[index++];
    if (!token) throw new Error('missing_literal');
    if (token.type === 'string') return token.value;
    if (token.type === 'number') return Number(token.value);
    if (token.value === 'true' || token.value === 'false') return token.value === 'true';
    if (token.value === 'nil') return null;
    if (token.value === '-' && tokens[index]?.type === 'number') return -Number(tokens[index++].value);
    if (token.value !== '{') throw new Error('nonliteral_expression');
    const named = Object.create(null), positional = [];
    while (tokens[index]?.value !== '}') {
      if (!tokens[index]) throw new Error('unclosed_table');
      if (tokens[index].type === 'identifier' && tokens[index + 1]?.value === '=') {
        const name = tokens[index].value; index += 2; named[name] = parse();
      } else if (tokens[index].value === '[') {
        index++; const name = parse();
        if (tokens[index++]?.value !== ']' || tokens[index++]?.value !== '=') throw new Error('nonliteral_key');
        named[name] = parse();
      } else positional.push(parse());
      if ([',', ';'].includes(tokens[index]?.value)) index++;
      else if (tokens[index]?.value !== '}') throw new Error('nonliteral_table_value');
    }
    index++;
    return Object.keys(named).length ? positional.length ? { namedEntries: named, positionalEntries: positional } : named : positional;
  }
  try {
    const value = parse();
    if (index !== tokens.length) throw new Error('trailing_expression');
    return { parsingStatus: 'literal_json', value };
  } catch (error) { return { parsingStatus: 'expression_requires_review', reason: error.message }; }
}

function parseLocale(source, file) {
  const { tokens, diagnostics } = lexLua(source);
  let locale = path.basename(file, '.lua'), section = null;
  const registrations = [], configurationCalls = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === 'locale' && tokens[i + 1]?.type === 'string') locale = tokens[i + 1].value;
    if (tokens[i].value === 'section' && tokens[i + 1]?.type === 'string') section = tokens[i + 1].value;
    if (tokens[i].type !== 'identifier' || !['t', 'setFlag', 'forceFontPackage'].includes(tokens[i].value) || tokens[i + 1]?.value !== '(' || ['.', ':'].includes(tokens[i - 1]?.value)) continue;
    const start = i, argumentsTokens = [[]];
    const callName = tokens[start].value;
    i++; // The opening call parenthesis is already accounted for by depth=1.
    let depth = 1;
    while (++i < tokens.length) {
      const token = tokens[i];
      if (token.type === 'symbol' && ['(', '{', '['].includes(token.value)) depth++;
      if (token.type === 'symbol' && [')', '}', ']'].includes(token.value)) depth--;
      if (depth === 0) break;
      if (depth === 1 && token.value === ',') argumentsTokens.push([]);
      else argumentsTokens.at(-1).push(token);
    }
    const stringAt = index => argumentsTokens[index]?.length === 1 && argumentsTokens[index][0].type === 'string' ? argumentsTokens[index][0].value : null;
    if (callName !== 't') {
      configurationCalls.push({ file, line: tokens[start].line, locale, call: callName, key: stringAt(0), ...literalValue(argumentsTokens[callName === 'setFlag' ? 1 : 0] ?? []), sourceExpression: source.slice(tokens[start].start, tokens[i]?.end ?? source.length), migrationStatus: 'configuration_semantics_require_preservation' });
      continue;
    }
    const english = stringAt(0), translated = stringAt(1), tag = stringAt(2);
    const argsOrderTokens = argumentsTokens[3] ?? [];
    const simpleArgsOrder = argsOrderTokens.length === 1 && argsOrderTokens[0].value === 'nil' || argsOrderTokens.every(t => t.type === 'number' || t.type === 'symbol' && ['{', '}', ','].includes(t.value));
    const argsOrder = simpleArgsOrder ? argsOrderTokens.filter(t => t.type === 'number').map(t => Number(t.value)) : [];
    const specialTokens = argumentsTokens[4] ?? [];
    const sourceTypes = english === null ? [] : printf(english), targetTypes = translated === null ? [] : printf(translated);
    const expectedTypes = argsOrder.length ? argsOrder.map(index => sourceTypes[index - 1]) : sourceTypes;
    const type = char => /[diouxX]/.test(char ?? '') ? 'integer' : /[eEfgGaA]/.test(char ?? '') ? 'number' : char;
    const incompatiblePrintf = translated !== null && english !== null && (expectedTypes.length !== targetTypes.length || expectedTypes.some((v, index) => type(v) !== type(targetTypes[index])));
    registrations.push({ file, line: tokens[start].line, section, locale, english, translated, tag, argsOrder, argsOrderTokens: argsOrderTokens.map(t => ({ type: t.type, value: t.value })), argsOrderParsingStatus: simpleArgsOrder ? 'positional_numeric_array_or_absent' : 'expression_requires_review', specialTokens: specialTokens.map(t => ({ type: t.type, value: t.value })), literalRegistration: english !== null && translated !== null, emptyTarget: translated === '', identicalTarget: english !== null && translated === english, containsJapaneseCharacters: /[\u3040-\u30ff\u3400-\u9fff]/u.test(translated ?? ''), sourcePrintfSpecifiers: printfSpecifiers(english ?? ''), targetPrintfSpecifiers: printfSpecifiers(translated ?? ''), sourcePrintfTypes: sourceTypes, targetPrintfTypes: targetTypes, printfReviewRequired: incompatiblePrintf || !simpleArgsOrder, sourceMarkup: [...new Set(english?.match(hashRegex) ?? [])], targetMarkup: [...new Set(translated?.match(hashRegex) ?? [])] });
  }
  return { locale, registrations, configurationCalls, diagnostics };
}

if (testing) {
  const sample = parseLocale('locale "ja_JP"\nsection "test.lua"\n-- t("comment","hidden")\n--[=[ t("long-comment", "hidden") ]=]\nt("%s %d", "%d %s", "tformat", {2,1})\nt([[English]], [[日本語]], "_t")\nt("empty", "", "nil")\nt("special %s", "%s", "tformat", nil, {mode="special"})\nsetFlag("break_text_all_character", true)\nforceFontPackage("japanese")', 'game/modules/tome/data/locales/ja_JP.lua');
  assert.equal(sample.locale, 'ja_JP');
  assert.equal(sample.registrations.length, 4);
  assert.deepEqual(sample.registrations[0].argsOrder, [2, 1]);
  assert.equal(sample.registrations[0].printfReviewRequired, false);
  assert.equal(sample.registrations[1].translated, '日本語');
  assert.equal(sample.registrations[1].containsJapaneseCharacters, true);
  assert.equal(sample.registrations[2].emptyTarget, true);
  assert.equal(sample.registrations[3].argsOrderParsingStatus, 'positional_numeric_array_or_absent');
  assert.equal(sample.registrations[3].specialTokens.some(token => token.value === 'special'), true);
  assert.equal(sample.configurationCalls.length, 2);
  assert.equal(sample.configurationCalls[0].sourceExpression, 'setFlag("break_text_all_character", true)');
  assert.equal(sample.diagnostics.length, 0);
  assert.deepEqual(printfSpecifiers('%% %02d %+0.2f %s'), ['%02d', '%+0.2f', '%s']);
  assert.deepEqual(sample.registrations[0].sourcePrintfSpecifiers, ['%s', '%d']);
  assert.deepEqual(sample.registrations[0].targetPrintfSpecifiers, ['%d', '%s']);
  assert.equal(sample.configurationCalls[0].value, true);
  assert.equal(sample.configurationCalls[1].value, 'japanese');
  const literalTable = literalValue(lexLua('{rules={start="あ", weight=2}, ["end"]="終", on=true}').tokens);
  assert.equal(literalTable.parsingStatus, 'literal_json');
  assert.equal(literalTable.value.rules.start, 'あ');
  assert.equal(literalTable.value.end, '終');
  assert.equal(literalValue(lexLua('function() return "x" end').tokens).parsingStatus, 'expression_requires_review');
  console.log('Upstream locale parser self-test: 21 assertions passed.');
  process.exit(0);
}

const catalogueRows = [];
const japaneseConfigurationCalls = [];
const localeFiles = [];
for (const absolute of walk(root).filter(file => /[\\/]data[\\/]locales[\\/].*\.lua$/i.test(file)).sort()) {
  const file = relative(absolute), source = fs.readFileSync(absolute, 'utf8'), parsed = parseLocale(source, file), rows = parsed.registrations;
  localeFiles.push({ file, scope: scopeOf(file), locale: parsed.locale, bytes: Buffer.byteLength(source), registrations: rows.length, literalRegistrations: rows.filter(r => r.literalRegistration).length, emptyTargets: rows.filter(r => r.emptyTarget).length, identicalTargets: rows.filter(r => r.identicalTarget).length, printfReviewRequired: rows.filter(r => r.printfReviewRequired).length, lexerDiagnostics: parsed.diagnostics.length, untranslatedCommentBlocks: [...source.matchAll(/-- untranslated text/g)].length });
  if (parsed.locale === 'ja_JP') { catalogueRows.push(...rows); japaneseConfigurationCalls.push(...parsed.configurationCalls); }
}
const byEnglish = new Map();
for (const row of catalogueRows) {
  if (row.english === null) continue;
  const list = byEnglish.get(row.english) ?? [];
  list.push(row); byEnglish.set(row.english, list);
}
const bySourceAndTag = Object.create(null);
for (const row of catalogueRows) {
  if (row.english === null) continue;
  const tags = bySourceAndTag[row.english] ??= Object.create(null), tag = row.tag ?? 'nil';
  const entry = tags[tag] ??= { registrations: [], distinctLiteralTargets: [], translationStatus: null };
  entry.registrations.push({ japanese: row.translated, file: row.file, line: row.line, section: row.section, argsOrder: row.argsOrder, argsOrderTokens: row.argsOrderTokens, specialTokens: row.specialTokens, sourcePrintfSpecifiers: row.sourcePrintfSpecifiers, targetPrintfSpecifiers: row.targetPrintfSpecifiers, printfReviewRequired: row.printfReviewRequired });
}
let duplicateSourceTagPairs = 0, conflictingSourceTagPairs = 0, ambiguousSourceKeys = 0;
for (const [english, tags] of Object.entries(bySourceAndTag)) {
  const allTargets = new Set();
  for (const entry of Object.values(tags)) {
    entry.distinctLiteralTargets = [...new Set(entry.registrations.map(r => r.japanese).filter(value => value !== null))];
    const changedTargets = entry.distinctLiteralTargets.filter(value => value && value !== english);
    if (entry.registrations.length > 1) duplicateSourceTagPairs++;
    if (entry.distinctLiteralTargets.length > 1) conflictingSourceTagPairs++;
    entry.translationStatus = entry.distinctLiteralTargets.length > 1 ? 'conflicting_source_tag_registrations' : changedTargets.length ? 'upstream_translated_literal' : entry.distinctLiteralTargets.includes(english) ? 'identical_literal_requires_review' : entry.distinctLiteralTargets.includes('') ? 'empty_untranslated' : 'nonliteral_requires_review';
    entry.distinctLiteralTargets.forEach(target => allTargets.add(target));
  }
  if (allTargets.size > 1) ambiguousSourceKeys++;
}
fs.writeFileSync(path.join(output, 'source-ja-map.json'), JSON.stringify({ schemaVersion: 1, mapKind: 'upstream_source_text_and_tag_not_semantic_ids', sourceRoot: root, runtimeSemantics: 'I18N.get checks exact tag then nil fallback. I18N.set also updates nil fallback on every registration; cross-package load order must be verified before selecting an effective fallback.', bySourceAndTag, japaneseConfigurationCalls }, null, 2) + '\n');
const summary = { schemaVersion: 1, generatedAt: new Date().toISOString(), sourceRoot: root, method: 'static_active_t_registrations_no_source_execution', locales: [...new Set(localeFiles.map(f => f.locale))].sort(), localeFiles, japanese: { activeRegistrations: catalogueRows.length, literalRegistrations: catalogueRows.filter(r => r.literalRegistration).length, uniqueEnglishSources: byEnglish.size, uniqueSourceTagPairs: Object.values(bySourceAndTag).reduce((sum, tags) => sum + Object.keys(tags).length, 0), duplicateSourceTagPairs, conflictingSourceTagPairs, ambiguousSourceKeys, emptyTargets: catalogueRows.filter(r => r.emptyTarget).length, identicalTargets: catalogueRows.filter(r => r.identicalTarget).length, nonLiteralTargets: catalogueRows.filter(r => !r.literalRegistration).length, printfReviewRequired: catalogueRows.filter(r => r.printfReviewRequired).length, configurationCalls: japaneseConfigurationCalls.length }, candidatesByScope: {}, semanticSuggestionCollisions: 0, limitations: ['Active registrations exclude commented untranslated blocks. Identical, empty and non-literal targets are counted separately.', 'Matched source literals are static inventory evidence, not proof of reachable runtime or complete gameplay translation.', 'Translations are keyed by original English and tag in upstream. Context/argument-order/special processing must be preserved when migrating to semantic IDs.', 'Potential text includes internal/debug text requiring review. No global replacement and no translation of external usernames is performed.', 'Placeholder review findings require inspection; printf special processing can intentionally change argument representation.', 'Original catalogue and font licence obligations must be preserved; source catalogue extraction itself does not license bundled non-code media.'] };
const reuseFd = fs.openSync(path.join(output, 'ja-reuse-candidates.jsonl'), 'w');
const collisions = new Map();
const gaps = [];
try {
  const reader = readline.createInterface({ input: fs.createReadStream(path.join(inventory, 'text-candidates.jsonl'), 'utf8'), crlfDelay: Infinity });
  for await (const line of reader) {
    if (!line) continue;
    const candidate = JSON.parse(line);
    if (candidate.file.includes('/data/locales/')) continue;
    const scope = scopeOf(candidate.file), counts = summary.candidatesByScope[scope] ??= { callsites: 0, uniqueSources: new Set(), sourceMatches: 0, sourceMatchedNonEmpty: 0, sourceMatchedChanged: 0, ambiguousTargets: 0, noSourceMatch: 0, placeholderReview: 0, explicitHooks: 0, explicitHooksSourceMatchedChanged: 0, explicitHooksExactTagMatch: 0, explicitHooksNilFallbackMatch: 0, explicitHooksTagUnresolved: 0, sourceLocalizationHooks: {} };
    counts.callsites++; counts.uniqueSources.add(candidate.value);
    const matches = byEnglish.get(candidate.value) ?? [];
    const exactTag = candidate.sourceLocalization?.tag;
    const tagMatches = exactTag ? matches.filter(r => (r.tag ?? 'nil') === exactTag) : [];
    const fallbackMatches = exactTag ? matches.filter(r => (r.tag ?? 'nil') === 'nil') : [];
    const selectedMatches = tagMatches.length ? tagMatches : fallbackMatches.length ? fallbackMatches : matches;
    const nonEmpty = matches.filter(r => r.literalRegistration && r.translated.length > 0);
    const translations = [...new Set(nonEmpty.map(r => r.translated))];
    if (matches.length) counts.sourceMatches++; else counts.noSourceMatch++;
    if (nonEmpty.length) counts.sourceMatchedNonEmpty++;
    if (nonEmpty.some(r => r.translated !== candidate.value)) counts.sourceMatchedChanged++;
    if (candidate.sourceLocalization) {
      counts.explicitHooks++;
      counts.sourceLocalizationHooks[candidate.sourceLocalization.hook] = (counts.sourceLocalizationHooks[candidate.sourceLocalization.hook] ?? 0) + 1;
      if (nonEmpty.some(r => r.translated !== candidate.value)) counts.explicitHooksSourceMatchedChanged++;
      if (tagMatches.length) counts.explicitHooksExactTagMatch++;
      else if (fallbackMatches.length) counts.explicitHooksNilFallbackMatch++;
      else counts.explicitHooksTagUnresolved++;
    }
    if (translations.length > 1) counts.ambiguousTargets++;
    if (matches.some(r => r.printfReviewRequired)) counts.placeholderReview++;
    const selectedNonEmpty = selectedMatches.filter(r => r.literalRegistration && r.translated.length > 0);
    const selectedTranslations = [...new Set(selectedNonEmpty.map(r => r.translated))];
    const changedTranslations = selectedTranslations.filter(value => value !== candidate.value);
    const translationStatus = !matches.length ? 'no_source_match' : exactTag && !tagMatches.length && !fallbackMatches.length ? 'source_only_runtime_tag_requires_review' : selectedTranslations.length > 1 ? 'ambiguous_context' : !selectedNonEmpty.length ? 'empty_or_nonliteral_target' : !changedTranslations.length ? 'identical_literal_requires_review' : 'source_match_requires_semantic_review';
    if (translationStatus !== 'source_match_requires_semantic_review') gaps.push({ semanticIdSuggestion: candidate.semanticIdSuggestion, sourceRootId: candidate.sourceRootId, file: candidate.file, line: candidate.line, english: candidate.value, sourceLocalization: candidate.sourceLocalization, gapKind: translationStatus, reviewRequired: true });
    const suggestion = candidate.semanticIdSuggestion;
    const locators = collisions.get(suggestion) ?? [];
    locators.push({ sourceRootId: candidate.sourceRootId, file: candidate.file, line: candidate.line }); collisions.set(suggestion, locators);
    fs.writeSync(reuseFd, JSON.stringify({ semanticIdSuggestion: suggestion, suggestionStatus: 'review_required_not_final_catalogue', sourceRootId: candidate.sourceRootId, file: candidate.file, line: candidate.line, english: candidate.value, evidence: candidate.evidence, sourceLocalization: candidate.sourceLocalization, matchingTagStatus: tagMatches.length ? 'exact_tag_available' : fallbackMatches.length ? 'nil_fallback_available' : exactTag ? 'source_only_tag_unresolved' : 'source_only_runtime_tag_requires_review', upstreamJapaneseSourceMatches: selectedMatches.map(r => ({ file: r.file, line: r.line, section: r.section, tag: r.tag, japanese: r.translated, argsOrder: r.argsOrder, argsOrderTokens: r.argsOrderTokens, specialTokens: r.specialTokens, sourcePrintfSpecifiers: r.sourcePrintfSpecifiers, targetPrintfSpecifiers: r.targetPrintfSpecifiers, printfReviewRequired: r.printfReviewRequired })), translationStatus }) + '\n');
  }
} finally { fs.closeSync(reuseFd); }
for (const scope of Object.values(summary.candidatesByScope)) scope.uniqueSources = scope.uniqueSources.size;
const duplicateSuggestions = [...collisions].filter(([, locators]) => locators.length > 1).map(([suggestion, locators]) => ({ suggestion, locators }));
summary.semanticSuggestionCollisions = duplicateSuggestions.length;
fs.writeFileSync(path.join(output, 'semantic-suggestion-collisions.json'), JSON.stringify(duplicateSuggestions, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'ja-gaps.json'), JSON.stringify({ schemaVersion: 1, status: 'static_inventory_gaps_require_visibility_context_review', gaps }, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'upstream-ja-catalogue.jsonl'), catalogueRows.map(row => JSON.stringify(row)).join('\n') + '\n');
fs.writeFileSync(path.join(output, 'locale-summary.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = ['# Upstream Japanese localization inventory', '', 'Official source catalogues are reusable migration inputs. They remain keyed by original English text and tags until deliberately mapped to stable semantic IDs.', '', `Available catalogue locale declarations: ${summary.locales.join(', ')}.`, '', `Japanese: ${summary.japanese.activeRegistrations} active registrations, ${summary.japanese.uniqueEnglishSources} unique English sources, ${summary.japanese.uniqueSourceTagPairs} distinct source/tag pairs, ${summary.japanese.duplicateSourceTagPairs} duplicate source/tag pairs, ${summary.japanese.conflictingSourceTagPairs} conflicting source/tag pairs, ${summary.japanese.ambiguousSourceKeys} source keys with differing translations, ${summary.japanese.emptyTargets} empty targets, ${summary.japanese.identicalTargets} identical targets, ${summary.japanese.nonLiteralTargets} non-literal registrations, ${summary.japanese.printfReviewRequired} printf review findings.`, '', '## Japanese files', '', '| Source | Active registrations | Empty | Identical | Printf review |', '| --- | ---: | ---: | ---: | ---: |', ...localeFiles.filter(f => f.locale === 'ja_JP').map(f => `| ${f.file} | ${f.registrations} | ${f.emptyTargets} | ${f.identicalTargets} | ${f.printfReviewRequired} |`), '', '## Static text candidate matches', '', '| Scope | Candidate callsites | Unique sources | Nonempty Japanese source match | No source match | Ambiguous targets |', '| --- | ---: | ---: | ---: | ---: | ---: |', ...Object.entries(summary.candidatesByScope).sort(([a], [b]) => a.localeCompare(b)).map(([scope, counts]) => `| ${scope} | ${counts.callsites} | ${counts.uniqueSources} | ${counts.sourceMatchedNonEmpty} | ${counts.noSourceMatch} | ${counts.ambiguousTargets} |`), '', '## Migration evidence', '', '- `source-ja-map.json` keys original English source and tag, preserving all registrations, context, reordered arguments and Japanese name/font/line-break configuration. It is explicitly not a semantic-ID catalogue.', '- `upstream-ja-catalogue.jsonl` preserves source, target, tag, argument order, special processing tokens and catalogue locator.', '- `ja-reuse-candidates.jsonl` joins potential semantic-ID contexts to upstream source-text matches. Ambiguous/context-sensitive matches require review.', '- `ja-gaps.json` identifies absent, empty, identical or ambiguous static mappings without copying English into Japanese as translated.', ("- semantic-suggestion-collisions.json identifies " + duplicateSuggestions.length + " repeated suggestions across files; those are explicitly unfinished key decisions."), '- `locale-summary.json` records all inspected locale files and diagnostics, including explicit translation hook counts and exact-tag/fallback evidence.', '', '## Limits', '', ...summary.limitations.map(limit => `- ${limit}`), ''];
fs.writeFileSync(path.join(output, 'JA-LOCALIZATION.md'), lines.join('\n'));
console.log(JSON.stringify({ japanese: summary.japanese, candidatesByScope: summary.candidatesByScope, semanticSuggestionCollisions: summary.semanticSuggestionCollisions, localeFiles: localeFiles.length, output }));
