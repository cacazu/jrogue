#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const slash = p => p.split(path.sep).join('/');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const pointerEscape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
export const catalogKey = (context, singular) => JSON.stringify([context ?? '', singular]);

export function spanLocator(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const position = offset => {
    let lo = 0, hi = starts.length;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (starts[mid] <= offset) lo = mid; else hi = mid; }
    return { line: lo + 1, column: offset - starts[lo] + 1 };
  };
  return (start, end) => ({ start: position(start), end: position(end), offset: start, endOffset: end });
}

function decodeCpp(value) {
  return value.replace(/\\(u[\da-fA-F]{4}|U[\da-fA-F]{8}|x[\da-fA-F]+|[0-7]{1,3}|[\s\S])/g, (_, escape) => {
    if (escape[0] === 'u' || escape[0] === 'U' || escape[0] === 'x') {
      const code = parseInt(escape.slice(1), 16);
      return code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
    }
    if (/^[0-7]/.test(escape)) return String.fromCharCode(parseInt(escape, 8));
    return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', a: '\x07', '\n': '', '\r': '', '"': '"', "'": "'", '\\': '\\', '?': '?' })[escape] ?? escape;
  });
}

export function cppTokens(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) { i++; continue; }
    if (text.startsWith('//', i)) { i = text.indexOf('\n', i + 2); if (i < 0) break; continue; }
    if (text.startsWith('/*', i)) { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 2; continue; }
    const start = i;
    const raw = /^(?:u8|u|U|L)?R"([^\s\\()]{0,16})\(/.exec(text.slice(i));
    if (raw) {
      const contentStart = i + raw[0].length, close = ')' + raw[1] + '"';
      const end = text.indexOf(close, contentStart);
      if (end < 0) throw new Error(`Unclosed C++ raw literal at offset ${i}`);
      i = end + close.length;
      tokens.push({ kind: 'string', value: text.slice(contentStart, end), start, end: i });
      continue;
    }
    const literal = /^(?:u8|u|U|L)?(["'])/.exec(text.slice(i));
    if (literal) {
      const quote = literal[1], contentStart = i + literal[0].length;
      i = contentStart;
      while (i < text.length && text[i] !== quote) { if (text[i] === '\\') i++; i++; }
      if (i === text.length) throw new Error(`Unclosed C++ literal at offset ${start}`);
      const value = decodeCpp(text.slice(contentStart, i));
      i++;
      tokens.push({ kind: quote === '"' ? 'string' : 'char', value, start, end: i });
      continue;
    }
    const identifier = /^[a-zA-Z_][\w]*/.exec(text.slice(i));
    if (identifier) { i += identifier[0].length; tokens.push({ kind: 'identifier', value: identifier[0], start, end: i }); continue; }
    i++;
    tokens.push({ kind: 'punctuation', value: text[start], start, end: i });
  }
  return tokens;
}

const CPP_CALLS = new Map([
  ['_', { singular: 0 }], ['gettext', { singular: 0 }], ['pgettext', { context: 0, singular: 1 }],
  ['ngettext', { singular: 0, plural: 1 }], ['n_gettext', { singular: 0, plural: 1 }], ['npgettext', { context: 0, singular: 1, plural: 2 }],
  ['translate_marker', { singular: 0 }], ['translate_marker_context', { context: 0, singular: 1 }],
  ['to_translation', { flexible: true }], ['pl_translation', { flexiblePlural: true }],
]);

function splitArguments(tokens, open) {
  const args = [[]];
  let depth = 1;
  for (let i = open + 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.value === '(' || token.value === '[' || token.value === '{') depth++;
    if (token.value === ')' || token.value === ']' || token.value === '}') depth--;
    if (depth === 0) return { args, close: i };
    if (token.value === ',' && depth === 1) args.push([]); else args.at(-1).push(token);
  }
  return null;
}

function literalArgument(tokens) {
  if (!tokens?.length || tokens.some(t => t.kind !== 'string')) return null;
  return tokens.map(t => t.value).join('');
}

export function extractCpp(text, file = '') {
  const tokens = cppTokens(text), locate = spanLocator(text), entries = [], dynamic = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i], spec = CPP_CALLS.get(token.value);
    if (!spec || token.kind !== 'identifier' || tokens[i + 1].value !== '(') continue;
    const call = splitArguments(tokens, i + 1);
    if (!call) { dynamic.push({ file, call: token.value, reason: 'unclosed-call', span: locate(token.start, token.end) }); continue; }
    const values = call.args.map(literalArgument);
    let indices = spec;
    if (spec.flexible) indices = call.args.length >= 2 ? { context: 0, singular: 1 } : { singular: 0 };
    if (spec.flexiblePlural) indices = call.args.length >= 3 ? { context: 0, singular: 1, plural: 2 } : { singular: 0, plural: 1 };
    const sourceSpan = locate(token.start, tokens[call.close].end);
    if (values[indices.singular] === null || (indices.context !== undefined && values[indices.context] === null) || (indices.plural !== undefined && values[indices.plural] === null)) {
      dynamic.push({ file, call: token.value, reason: 'nonliteral-translation-argument', span: sourceSpan, expression: text.slice(token.start, tokens[call.close].end).slice(0, 1200) });
      continue;
    }
    const singular = values[indices.singular], context = values[indices.context] ?? '', plural = values[indices.plural];
    if (typeof singular !== 'string') { dynamic.push({ file, call: token.value, reason: 'missing-translation-argument', span: sourceSpan }); continue; }
    entries.push({ file, call: token.value, context, singular, ...(plural !== undefined ? { plural } : {}), catalogKey: catalogKey(context, singular), span: sourceSpan, placeholders: placeholderSignature(singular), ...(plural !== undefined ? { pluralPlaceholders: placeholderSignature(plural) } : {}) });
  }
  return { entries, dynamic };
}

export function scanJson(text, { jsonc = false } = {}) {
  const strings = [];
  let cursor = 0;
  const locate = spanLocator(text);
  const skip = () => {
    while (cursor < text.length) {
      if (/\s/.test(text[cursor])) { cursor++; continue; }
      if (jsonc && text.startsWith('//', cursor)) { const end = text.indexOf('\n', cursor + 2); cursor = end < 0 ? text.length : end; continue; }
      if (jsonc && text.startsWith('/*', cursor)) { const end = text.indexOf('*/', cursor + 2); if (end < 0) throw new Error(`Unclosed JSONC comment at ${cursor}`); cursor = end + 2; continue; }
      break;
    }
  };
  const string = () => {
    const start = cursor++;
    while (cursor < text.length && text[cursor] !== '"') { if (text[cursor] === '\\') cursor++; cursor++; }
    if (cursor === text.length) throw new Error(`Unclosed JSON string at ${start}`);
    cursor++;
    return { value: JSON.parse(text.slice(start, cursor)), span: locate(start, cursor) };
  };
  const value = pointer => {
    skip();
    if (text[cursor] === '"') { const item = string(); strings.push({ pointer, ...item }); return item.value; }
    if (text[cursor] === '{') {
      cursor++; skip(); const object = {};
      while (text[cursor] !== '}') {
        if (text[cursor] !== '"') throw new Error(`Expected JSON object key at ${cursor}`);
        const key = string(); skip();
        if (text[cursor++] !== ':') throw new Error(`Expected colon at ${cursor - 1}`);
        object[key.value] = value(pointer + '/' + pointerEscape(key.value)); skip();
        if (text[cursor] === ',') { cursor++; skip(); if (text[cursor] === '}' && !jsonc) throw new Error(`Trailing JSON comma at ${cursor}`); } else if (text[cursor] !== '}') throw new Error(`Expected comma or object end at ${cursor}`);
      }
      cursor++; return object;
    }
    if (text[cursor] === '[') {
      cursor++; skip(); const array = [];
      while (text[cursor] !== ']') {
        array.push(value(pointer + '/' + array.length)); skip();
        if (text[cursor] === ',') { cursor++; skip(); if (text[cursor] === ']' && !jsonc) throw new Error(`Trailing JSON comma at ${cursor}`); } else if (text[cursor] !== ']') throw new Error(`Expected comma or array end at ${cursor}`);
      }
      cursor++; return array;
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(cursor));
    if (!match) throw new Error(`Expected JSON value at ${cursor}`);
    cursor += match[0].length; return JSON.parse(match[0]);
  };
  const parsed = value(''); skip();
  if (cursor !== text.length) throw new Error(`Trailing JSON input at ${cursor}`);
  return { value: parsed, strings };
}

const TEXT_KEYS = new Set(['name', 'name_plural', 'description', 'desc', 'text', 'message', 'messages', 'msg', 'verb', 'sound', 'sound_msg', 'snippet', 'snippets', 'title', 'label', 'prompt', 'query', 'question', 'answer', 'reason', 'success_message', 'failure_message', 'done_message', 'info', 'menu_text', 'menu', 'short_name', 'long_name', 'profession_name', 'death_message', 'use_message', 'memorial_log', 'memorial_male', 'memorial_female', 'initial_message', 'entry', 'str', 'str_pl', 'str_sp']);
const STRUCTURAL_KEYS = new Set(['id', 'abstract', 'type', 'copy-from', 'flags', 'category', 'categories', 'material', 'materials', 'symbol', 'color', 'looks_like', 'relative', 'extend', 'delete', 'om_terrain', 'terrain', 'furniture', 'ammo', 'item', 'items', 'effect', 'effects', 'condition', 'conditions', 'weight', 'volume', 'time', 'duration', 'mod_id', 'dependencies', 'tileset', 'ascii', 'path', 'file', 'ctxt']);

export function classifyJsonString(pointer) {
  const parts = pointer.split('/').slice(1).map(p => p.replaceAll('~1', '/').replaceAll('~0', '~')).filter(p => !/^\d+$/.test(p));
  const leaf = parts.at(-1) ?? '';
  if (leaf === 'ctxt') return 'translation-context';
  if (TEXT_KEYS.has(leaf) || /(?:^|_)(?:message|messages|description|text|name|title|prompt|query|question|answer|reason|verb|snippet|label|memorial)(?:_|$)/.test(leaf)) return 'text-candidate';
  if (STRUCTURAL_KEYS.has(leaf)) return 'structural';
  if (parts.some(p => TEXT_KEYS.has(p))) return 'nested-text-candidate';
  return 'unclassified';
}

export function extractJson(text, file = '', options = {}) {
  const parsed = scanJson(text, options), objects = [], byPointer = new Map();
  const visit = (value, pointer, owner = null) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((child, i) => visit(child, pointer + '/' + i, owner)); return; }
    let current = owner;
    if (typeof value.type === 'string' || typeof value.id === 'string' || Array.isArray(value.id) || typeof value.abstract === 'string') {
      current = { pointer, type: value.type ?? null, id: value.id ?? null, abstract: value.abstract ?? null, copyFrom: value['copy-from'] ?? null };
      objects.push({ file, ...current });
    }
    byPointer.set(pointer, { value, owner: current });
    for (const [key, child] of Object.entries(value)) visit(child, pointer + '/' + pointerEscape(key), current);
  };
  visit(parsed.value, '');
  const strings = parsed.strings.map(item => {
    let parentPointer = item.pointer.slice(0, item.pointer.lastIndexOf('/'));
    while (!byPointer.has(parentPointer) && parentPointer !== '') parentPointer = parentPointer.slice(0, parentPointer.lastIndexOf('/'));
    const parent = byPointer.get(parentPointer), owner = parent?.owner;
    const context = parent?.value?.ctxt ?? '';
    const leaf = item.pointer.slice(item.pointer.lastIndexOf('/') + 1);
    const singular = leaf === 'str_pl' && typeof parent?.value?.str === 'string' ? parent.value.str : item.value;
    const plural = leaf === 'str' && typeof parent?.value?.str_pl === 'string' ? parent.value.str_pl : leaf === 'str_sp' ? item.value : null;
    const classification = classifyJsonString(item.pointer);
    const id = typeof owner?.id === 'string' ? owner.id : owner?.abstract;
    const semanticCandidate = id && /text-candidate/.test(classification) ? `cdda.${owner.type ?? 'data'}.${id}.${item.pointer.slice(owner.pointer.length + 1).split('/').filter(p => !/^\d+$/.test(p)).join('.')}` : null;
    return { file, ...item, classification, ...(owner ? { owner } : {}), ...(context ? { context } : {}), ...(semanticCandidate ? { semanticCandidate } : {}), ...(/text-candidate/.test(classification) ? { catalogKey: catalogKey(context, singular), ...(leaf === 'str_pl' ? { pluralOf: singular } : {}), ...(plural !== null ? { plural } : {}), placeholders: placeholderSignature(item.value) } : {}) };
  });
  return { objects, strings };
}

export function parsePo(text, file = '') {
  const entries = [], errors = [], lines = text.replace(/^\ufeff/, '').split(/\r?\n/);
  let entry = null, active = null;
  const fresh = line => ({ file, line, context: '', singular: null, plural: null, translations: {}, references: [], flags: [], comments: [], obsolete: false });
  const flush = endLine => {
    if (entry?.singular !== null && entry?.singular !== undefined) entries.push({ ...entry, endLine, catalogKey: catalogKey(entry.context, entry.singular), placeholders: placeholderSignature(entry.singular), ...(entry.plural !== null ? { pluralPlaceholders: placeholderSignature(entry.plural) } : {}) });
    entry = null; active = null;
  };
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index];
    if (!line.trim()) { flush(index + 1); continue; }
    if (line.startsWith('#~')) { entry ??= fresh(index + 1); entry.obsolete = true; line = line.slice(2).trimStart(); }
    if (line.startsWith('#')) {
      if (entry?.singular !== null && entry?.singular !== undefined && Object.keys(entry.translations).length) flush(index);
      entry ??= fresh(index + 1);
      if (line.startsWith('#:')) entry.references.push(...line.slice(2).trim().split(/\s+/));
      else if (line.startsWith('#,')) entry.flags.push(...line.slice(2).split(',').map(v => v.trim()));
      else entry.comments.push(line.slice(1).trimStart());
      continue;
    }
    const field = /^(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?)\s+(".*")\s*$/.exec(line);
    const continuation = /^\s*(".*")\s*$/.exec(line);
    if (field) {
      if (field[1] === 'msgid' && entry?.singular !== null && entry?.singular !== undefined) flush(index);
      entry ??= fresh(index + 1);
      const target = field[1] === 'msgctxt' ? 'context' : field[1] === 'msgid' ? 'singular' : field[1] === 'msgid_plural' ? 'plural' : 'translations';
      const translationIndex = /\[(\d+)\]/.exec(field[1])?.[1] ?? '0';
      active = { target, translationIndex };
      try { const decoded = JSON.parse(field[2]); if (target === 'translations') entry.translations[translationIndex] = decoded; else entry[target] = decoded; }
      catch (error) { errors.push({ file, line: index + 1, reason: 'invalid-po-quoted-string', detail: error.message }); active = null; }
    } else if (continuation && active) {
      try { const decoded = JSON.parse(continuation[1]); if (active.target === 'translations') entry.translations[active.translationIndex] += decoded; else entry[active.target] += decoded; }
      catch (error) { errors.push({ file, line: index + 1, reason: 'invalid-po-continuation', detail: error.message }); }
    } else errors.push({ file, line: index + 1, reason: 'unparsed-po-line', detail: line.slice(0, 300) });
  }
  flush(lines.length);
  const header = entries.find(e => e.singular === '' && !e.context)?.translations['0'] ?? '';
  return { entries, errors, language: /^Language:\s*(.*)$/m.exec(header)?.[1] ?? null, pluralForms: /^Plural-Forms:\s*(.*)$/m.exec(header)?.[1] ?? null, nplurals: Number(/nplurals\s*=\s*(\d+)/.exec(header)?.[1]) || null };
}

export function placeholderSignature(text) {
  const printf = [], braces = [], tags = [];
  const format = /%%|%(?:(\d+)\$)?[-+ #0']*(?:\d+|\*(?:(\d+)\$)?)?(?:\.(?:\d*|\*(?:(\d+)\$)?))?(hh|h|ll|l|j|z|t|L)?([diouxXeEfFgGaAcspn])/g;
  let next = 1;
  for (const match of text.matchAll(format)) {
    if (match[0] === '%%') continue;
    // Prose such as "75% capacity" is not a printf argument. The catalog audit
    // additionally requires upstream c-format flags before rejecting printf.
    if (/^%\s/.test(match[0]) && /[a-zA-Z]/.test(text[match.index + match[0].length] ?? '')) continue;
    const stars = match[0].match(/\*(?:\d+\$)?/g) ?? [];
    for (const star of stars) { const position = /\d+/.exec(star)?.[0]; printf.push(`${position ?? next++}:int-width`); }
    const conversion = /[di]/.test(match[5]) ? 'integer' : /[ouxX]/.test(match[5]) ? 'unsigned' : /[eEfFgGaA]/.test(match[5]) ? 'float' : match[5];
    printf.push(`${match[1] ?? next++}:${match[4] ?? ''}${conversion}`);
  }
  for (const match of text.matchAll(/(?<!\{)\{([a-zA-Z_][\w.]*)(?:![rsa])?(?::[<>^=+ #0\d.,]*[bcdeEfFgGnosxX%]?)?\}(?!\})/g)) braces.push(match[1]);
  for (const match of text.matchAll(/<([^<>\s]+)>/g)) if (!/^(?:\/?color(?:_[\w]+)?|\/?bold|\/?italic|\/?u|\/?info|\/?good|\/?bad|\/?neutral|\/?stat|\/?header|\/?emphasis)$/.test(match[1])) tags.push(match[1]);
  return { printf: printf.sort(), braces: braces.sort(), tags: tags.sort() };
}

export function comparePlaceholders(source, translated) {
  const expected = placeholderSignature(source), actual = placeholderSignature(translated);
  return ['printf', 'braces', 'tags'].filter(type => JSON.stringify(expected[type]) !== JSON.stringify(actual[type])).map(type => ({ type, expected: expected[type], actual: actual[type] }));
}

export function auditPoEntry(entry) {
  const findings = [];
  const dynamicTag = value => /^(?:u_|npc_|yr|my|topic_item|current_activity|ammo$|punc$|activity$|item_name$|monster_name$|city$|world$|faction_|var:|global_val:|context_val:|u_val:|npc_val:)/.test(value);
  for (const [form, translated] of Object.entries(entry.translations)) {
    if (!translated) continue;
    const source = form === '0' ? entry.singular : (entry.plural ?? entry.singular);
    const differences = comparePlaceholders(source, translated);
    for (const difference of differences) {
      if (difference.type === 'printf' && !entry.flags.includes('c-format')) {
        findings.push({ form, severity: 'review', reason: 'unflagged-printf-candidate', ...difference });
      } else if (difference.type === 'tags') {
        const expected = difference.expected.filter(dynamicTag), actual = difference.actual.filter(dynamicTag);
        if (JSON.stringify(expected) !== JSON.stringify(actual)) findings.push({ form, severity: 'reject', reason: 'dynamic-tag-mismatch', type: 'tags', expected, actual });
        const unknownExpected = difference.expected.filter(value => !dynamicTag(value)), unknownActual = difference.actual.filter(value => !dynamicTag(value));
        if (JSON.stringify(unknownExpected) !== JSON.stringify(unknownActual)) findings.push({ form, severity: 'review', reason: 'non-dynamic-angle-tag-difference', type: 'tags', expected: unknownExpected, actual: unknownActual });
      } else findings.push({ form, severity: 'reject', reason: 'placeholder-mismatch', ...difference });
    }
  }
  return findings;
}

const SUBSYSTEMS = [
  ['world-generation', /^(?:mapgen|mapbuffer|mapdata|overmap|worldfactory|regional_settings|map_extras|iexamine|field|trap)/],
  ['combat-damage', /^(?:attack|ballistics|damage|defense|explosion|projectile|ranged|melee|martialarts|weakpoint|hit|ammo)/],
  ['character-survival', /^(?:avatar|character|player|bodypart|body_part|bodytemp|disease|effect|suffer|vitamin|morale|stamina|bionics|mutation|skill|profession|trait|magic|relic)/],
  ['creatures-ai', /^(?:monster|mon_|mattack|mdefense|monattack|monmove|monstergenerator|npc|faction|creature|pathfinding)/],
  ['items-inventory', /^(?:item|inventory|iuse|itype|i_armor|i_add|ammo|reload|pocket|contents|artifact|crafting|recipe|requirements|material|harvest)/],
  ['vehicles', /^(?:veh|vehicle)/],
  ['activities-crafting', /^(?:activity|activity_handlers|craft|construction|repair|butcher|digging|farming|fishing|mining|cooking|disassembly)/],
  ['quests-dialogue', /^(?:mission|dialogue|dialog|talk|event|achievement|scenario|start_location|quest)/],
  ['simulation-time-weather', /^(?:calendar|weather|climate|rng|enums|units|lightmap|sounds|scent|coordinates|fov|line|point)/],
  ['persistence', /^(?:save|load|json|cata_variant|serialization)/],
  ['presentation', /^(?:curses|sdl|sdltiles|sdl_wrappers|cata_tiles|cata_imgui|imgui|ui|display|output|input|help|options|translations|language|font|messages|color|catacharset|animation|minimap|panels|game_ui)/],
  ['platform', /^(?:filesystem|path_info|cata_path|cata_utility|cata_atomic|cata_scope_helpers|debug|crash|android|cata_android|network|cata_curl)/],
];

export function subsystem(file) {
  const stem = path.basename(file).replace(/\.[^.]+$/, '');
  return SUBSYSTEMS.find(([, regex]) => regex.test(stem))?.[0] ?? 'unclassified-source';
}

function category(file) {
  const lower = file.toLowerCase();
  if (/(^|\/)(?:license[^/]*|copying[^/]*|authors[^/]*|copyright[^/]*|credits[^/]*)$/.test(lower)) return 'license-attribution';
  if (/^src\//.test(file)) return 'source';
  if (/^tests?\//.test(file)) return 'tests';
  if (/^data\/mods\//.test(file)) return 'mods';
  if (/^data\/json\//.test(file)) return 'game-data';
  if (/^lang\//.test(file) || /\.(?:po|pot|mo)$/.test(lower)) return 'localization';
  if (/^doc\//.test(file) || /\.(?:md|rst)$/.test(lower)) return 'documentation';
  if (/\.(?:png|jpe?g|gif|svg|webp|bmp|ogg|mp3|wav|flac|ttf|otf|woff2?)$/.test(lower)) return 'assets';
  if (/^(?:build-scripts|tools|cmake|CMakeModules|msvc-full-features|msvc-min-features)\//.test(file) || /(?:CMakeLists\.txt|Makefile|\.cmake|\.py|\.sh|\.bat|\.ps1)$/.test(file)) return 'build-tooling';
  return 'other';
}

function *walk(root, relative = '') {
  const folder = path.join(root, relative);
  for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) { yield { relative: slash(rel), kind: 'symlink' }; continue; }
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'target', '.cache'].includes(entry.name)) continue;
      yield* walk(root, rel);
    } else if (entry.isFile()) yield { relative: slash(rel), kind: 'file', absolute: path.join(root, rel) };
  }
}

function writer(output, filename) {
  const fd = fs.openSync(path.join(output, filename), 'w');
  return { write: value => fs.writeSync(fd, JSON.stringify(value) + '\n'), close: () => fs.closeSync(fd) };
}

function inc(object, key, amount = 1) { object[key] = (object[key] ?? 0) + amount; }
function poLanguage(file) {
  const base = path.basename(file).toLowerCase();
  if (base.endsWith('.pot')) return 'template';
  if (/^ja(?:[_-][a-z]+)?\.po$/.test(base)) return 'ja';
  if (/^en(?:[_-][a-z]+)?\.po$/.test(base)) return 'en';
  return null;
}

export function inventory(options) {
  const root = path.resolve(options.source), output = path.resolve(options.output);
  if (!fs.statSync(root).isDirectory()) throw new Error('Source must be a directory');
  if (output === root || output.startsWith(root + path.sep)) throw new Error('Output must be outside pristine upstream');
  fs.mkdirSync(output, { recursive: true });
  const outputs = ['files', 'source-texts', 'dynamic-source-texts', 'data-strings', 'data-objects', 'po-entries', 'gaps', 'extraction-errors'];
  const writers = Object.fromEntries(outputs.map(name => [name, writer(output, name + '.jsonl')]));
  const summary = { schemaVersion: 1, provenance: { sourceRoot: root, officialRepository: options.upstream ?? null, version: options.version ?? null, commit: options.commit ?? null, acquisition: options.acquisition ?? null, generatedAt: new Date().toISOString(), inventoryToolSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))) }, files: 0, bytes: 0, categories: {}, extensions: {}, subsystems: {}, dataTypes: {}, dataStringClasses: {}, sourceTranslationCalls: {}, text: { sourceOccurrences: 0, uniqueSourceKeys: 0, dynamicSourceExpressions: 0, dataStrings: 0, dataTextCandidates: 0, dataObjects: 0 }, catalogs: {}, licenses: [], extractionErrors: 0, gaps: {}, limitations: ['Source subsystem mapping is a filename-based inventory, not a claim that mechanics have been ported.', 'Every JSON string is recorded. Text candidates are heuristic; unclassified strings and upstream extraction handlers require review before complete coverage can be asserted.', 'Nonliteral source translation arguments are explicit migration gaps.', 'Suggested data semantic IDs require human review, namespace collision resolution, and preservation of upstream plural/context rules.', 'Catalog coverage uses exact gettext context and singular text. It does not prove in-game reachability, UI correctness, or Japanese terminology consistency.', 'Files under .git, node_modules, target, and .cache are excluded. Symlinks are listed and not followed.'] };
  summary.sourceCounts = { sourceCodeFiles: 0, sourcePhysicalLines: 0, testCodeFiles: 0, testPhysicalLines: 0 };
  const sourceKeys = new Map(), dataKeys = new Map(), catalogs = new Map(), semanticIds = new Map(), errors = [];
  const gap = item => { writers.gaps.write(item); inc(summary.gaps, item.reason); };
  const error = item => { writers['extraction-errors'].write(item); errors.push(item); summary.extractionErrors++; };
  try {
    for (const item of walk(root)) {
      if (item.kind === 'symlink') { writers.files.write(item); inc(summary.categories, 'symlink'); continue; }
      const stat = fs.statSync(item.absolute), file = item.relative, kind = category(file), ext = path.extname(file).toLowerCase() || '(none)';
      summary.files++; summary.bytes += stat.size; inc(summary.categories, kind); inc(summary.extensions, ext);
      const bytes = fs.readFileSync(item.absolute);
      const isCode = /\.(?:cpp|cc|cxx|h|hpp|hxx|c|inc)$/.test(ext) && (kind === 'source' || kind === 'tests');
      const physicalLines = isCode ? (bytes.length ? bytes.toString('utf8').split('\n').length - (bytes.at(-1) === 10 ? 1 : 0) : 0) : null;
      if (isCode) { summary.sourceCounts[kind === 'source' ? 'sourceCodeFiles' : 'testCodeFiles']++; summary.sourceCounts[kind === 'source' ? 'sourcePhysicalLines' : 'testPhysicalLines'] += physicalLines; }
      writers.files.write({ file, kind, bytes: stat.size, sha256: hash(bytes), ...(physicalLines !== null ? { physicalLines } : {}), ...(kind === 'source' ? { subsystem: subsystem(file) } : {}) });
      if (kind === 'source') inc(summary.subsystems, subsystem(file));
      if (kind === 'license-attribution') summary.licenses.push({ file, sha256: hash(bytes), bytes: stat.size });
      if (/\.(?:cpp|cc|cxx|h|hpp|hxx|c)$/.test(ext) && (kind === 'source' || kind === 'tests')) {
        try {
          const extracted = extractCpp(bytes.toString('utf8'), file);
          for (const entry of extracted.entries) { writers['source-texts'].write(entry); summary.text.sourceOccurrences++; inc(summary.sourceTranslationCalls, entry.call); if (!sourceKeys.has(entry.catalogKey)) sourceKeys.set(entry.catalogKey, entry); }
          for (const dynamic of extracted.dynamic) { writers['dynamic-source-texts'].write(dynamic); summary.text.dynamicSourceExpressions++; }
        } catch (cause) { error({ file, category: 'cpp', detail: cause.message }); }
      }
      if (ext === '.json') {
        try {
          const extracted = extractJson(bytes.toString('utf8').replace(/^\ufeff/, ''), file, { jsonc: /^(?:\.devcontainer|\.vscode)\//.test(file) });
          for (const object of extracted.objects) { writers['data-objects'].write(object); summary.text.dataObjects++; inc(summary.dataTypes, String(object.type ?? '(no type)')); }
          for (const string of extracted.strings) {
            writers['data-strings'].write(string); summary.text.dataStrings++; inc(summary.dataStringClasses, string.classification);
            if (string.catalogKey) { summary.text.dataTextCandidates++; if (!dataKeys.has(string.catalogKey) || dataKeys.get(string.catalogKey).pluralOf) dataKeys.set(string.catalogKey, string); }
            if (string.semanticCandidate) {
              const previous = semanticIds.get(string.semanticCandidate);
              if (previous && previous.value !== string.value) gap({ reason: 'semantic-candidate-collision', semanticCandidate: string.semanticCandidate, first: { file: previous.file, pointer: previous.pointer }, second: { file, pointer: string.pointer } });
              else semanticIds.set(string.semanticCandidate, string);
            }
          }
        } catch (cause) { error({ file, category: 'json', detail: cause.message }); }
      }
      const locale = poLanguage(file);
      if (locale) {
        const parsed = parsePo(bytes.toString('utf8'), file);
        const stats = { file, language: parsed.language, pluralForms: parsed.pluralForms, nplurals: parsed.nplurals, entries: 0, translated: 0, untranslated: 0, fuzzy: 0, obsolete: 0, pluralEntries: 0, placeholderMismatches: 0 };
        const catalog = catalogs.get(locale) ?? new Map(); catalogs.set(locale, catalog);
        for (const entry of parsed.entries) {
          writers['po-entries'].write({ locale, ...entry });
          if (entry.obsolete) { stats.obsolete++; continue; }
          if (entry.singular === '') continue;
          stats.entries++; if (entry.plural !== null) stats.pluralEntries++;
          if (entry.flags.includes('fuzzy')) stats.fuzzy++;
          const values = Object.values(entry.translations), expectedForms = entry.plural !== null ? parsed.nplurals : 1;
          const complete = values.length > 0 && values.every(Boolean) && (!expectedForms || values.length === expectedForms);
          if (complete) stats.translated++; else stats.untranslated++;
          if (catalog.has(entry.catalogKey)) gap({ reason: 'duplicate-catalog-key', locale, file, line: entry.line, context: entry.context, singular: entry.singular });
          catalog.set(entry.catalogKey, { ...entry, complete, expectedForms });
          if (locale === 'ja' || locale === 'en') {
            if (!complete) gap({ reason: 'untranslated-catalog-entry', locale, file, line: entry.line, context: entry.context, singular: entry.singular, expectedForms });
            if (entry.flags.includes('fuzzy')) gap({ reason: 'fuzzy-catalog-entry', locale, file, line: entry.line, singular: entry.singular });
            const audit = auditPoEntry(entry);
            if (audit.some(finding => finding.severity === 'reject')) { stats.placeholderMismatches++; gap({ reason: 'catalog-placeholder-mismatch', locale, file, line: entry.line, flags: entry.flags, singular: entry.singular, findings: audit.filter(finding => finding.severity === 'reject') }); }
            if (audit.some(finding => finding.severity === 'review')) gap({ reason: 'catalog-placeholder-review', locale, file, line: entry.line, flags: entry.flags, singular: entry.singular, findings: audit.filter(finding => finding.severity === 'review') });
          }
        }
        for (const err of parsed.errors) error({ ...err, category: 'po' });
        summary.catalogs[locale] ??= []; summary.catalogs[locale].push(stats);
      }
    }
    summary.text.uniqueSourceKeys = sourceKeys.size;
    summary.text.uniqueDataCandidateKeys = dataKeys.size;
    const japanese = catalogs.get('ja');
    if (!japanese) gap({ reason: 'missing-japanese-catalog' });
    if (!catalogs.has('template')) gap({ reason: 'missing-gettext-template' });
    for (const [origin, keys] of [['source', sourceKeys], ['data-candidate', dataKeys]]) {
      for (const [key, entry] of keys) {
        const ja = japanese?.get(key);
        if (!ja) gap({ reason: 'text-missing-from-japanese-catalog', origin, file: entry.file, ...(entry.span ? { span: entry.span } : {}), ...(entry.pointer ? { pointer: entry.pointer } : {}), context: entry.context ?? '', singular: entry.singular ?? entry.value });
        const template = catalogs.get('template');
        if (template && !template.has(key)) gap({ reason: 'text-missing-from-gettext-template', origin, file: entry.file, ...(entry.span ? { span: entry.span } : {}), ...(entry.pointer ? { pointer: entry.pointer } : {}), context: entry.context ?? '', singular: entry.singular ?? entry.value });
      }
    }
    summary.text.semanticMappingsRequired = new Set([...sourceKeys.keys(), ...dataKeys.keys()]).size;
    summary.text.semanticCandidates = semanticIds.size;
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    fs.writeFileSync(path.join(output, 'REPORT.md'), renderReport(summary));
    return summary;
  } finally { for (const stream of Object.values(writers)) stream.close(); }
}

function renderReport(s) {
  const table = (heading, values) => `## ${heading}\n\n| Category | Count |\n| --- | ---: |\n${Object.entries(values).sort((a, b) => b[1] - a[1]).map(([key, count]) => `| ${key} | ${count.toLocaleString('en-US')} |`).join('\n')}\n\n`;
  return `# Cataclysm: DDA source inventory\n\nSource: \`${s.provenance.sourceRoot}\`\n\nOfficial repository: ${s.provenance.officialRepository ?? 'not supplied'}\n\nVersion: ${s.provenance.version ?? 'not supplied'}; commit: ${s.provenance.commit ?? 'not supplied'}\n\nAcquisition: ${s.provenance.acquisition ?? 'not supplied'}\n\nInventoried ${s.files.toLocaleString('en-US')} files, ${s.bytes.toLocaleString('en-US')} bytes. Extraction errors: ${s.extractionErrors}.\n\n` + table('File categories', s.categories) + table('Source subsystems', s.subsystems) + table('JSON types', s.dataTypes) + table('Text inventory', s.text) + table('JSON string classifications', s.dataStringClasses) + table('Translation and mapping gaps', s.gaps) + `## Catalogs\n\n\`summary.json\` contains language headers, plural rules, complete/fuzzy/obsolete entry counts, and placeholder mismatches per catalog.\n\n## Provenance and source spans\n\n- \`files.jsonl\`: every inventoried file, byte size and SHA-256.\n- \`source-texts.jsonl\`: literal translation calls, context, plural, printf/dynamic tokens, and exact source span.\n- \`dynamic-source-texts.jsonl\`: nonliteral expressions needing application-specific migration.\n- \`data-objects.jsonl\`: JSON type, ID, inheritance, file, and JSON pointer.\n- \`data-strings.jsonl\`: every JSON string, source span, owner ID, classification, and proposed semantic ID when possible.\n- \`po-entries.jsonl\`: English/template/Japanese strings, translations, source references, flags and source line spans.\n- \`gaps.jsonl\`: exact missing/fuzzy/placeholder/collision evidence.\n- \`extraction-errors.jsonl\`: parse failures; must be resolved before claiming complete extraction.\n\n## Limits requiring review\n\n${s.limitations.map(line => '- ' + line).join('\n')}\n`;
}

function args(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help') { parsed.help = true; continue; }
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`Invalid argument: ${argv[i]}`);
    parsed[argv[i].slice(2)] = argv[++i];
  }
  return parsed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = args(process.argv.slice(2));
    if (options.help || !options.source || !options.output) {
      console.log('Usage: node inventory.mjs --source <pristine-upstream> --output <separate-report-directory> [--upstream <url>] [--version <tag>] [--commit <sha>] [--acquisition <description>]');
      if (!options.help) process.exitCode = 2;
    } else {
      const summary = inventory(options);
      console.log(JSON.stringify({ output: path.resolve(options.output), files: summary.files, bytes: summary.bytes, sourceOccurrences: summary.text.sourceOccurrences, dataStrings: summary.text.dataStrings, catalogs: summary.catalogs, extractionErrors: summary.extractionErrors, gaps: summary.gaps }, null, 2));
      if (summary.extractionErrors) process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
