#!/usr/bin/env node
/** Source-only ToME inventory. Never loads or executes upstream Lua. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const DECLARATIONS = new Set(['newTalent', 'newTalentType', 'newEffect', 'newDamageType', 'newEntity', 'newBirthDescriptor', 'newQuest', 'newZone', 'newAchievement', 'newLore', 'newChat', 'newAI', 'newResolver', 'newInventory', 'newFaction']);
const VISIBLE_FIELDS = new Set(['name', 'desc', 'description', 'title', 'text', 'help', 'help_text', 'tooltip', 'label', 'message', 'display_name', 'short_desc', 'long_desc', 'chat', 'say', 'info', 'keywords', 'lore']);
const TEXT_CALLS = new Set(['log', 'logPlayer', 'logSeen', 'logCombat', 'logVisible', 'simplePopup', 'yesnoPopup', 'yesnoLongPopup', 'selectPopup', 'listPopup', 'tooltip', 'addTooltip', 'setTooltip', 'showTooltip', 'drawTooltip', 'addText', 'drawText', 'drawString', 'drawStringBlended', 'toTString', 'toTStringFull', 'say', 'speak', 'chat', 'message', 'error', 'assert', 'print', 'tformat', '_t', '_tc', '_nt']);
const TRANSLATION_HELPERS = new Set(['_t', '_tc', '_nt']);
const PATH_CALLS = new Set(['require', 'load', 'loadfile', 'dofile', 'loadList', 'loadListFrom', 'loadLua', 'loadFont', 'loadImage', 'loadTexture', 'loadSound', 'loadMusic', 'playSound', 'playSoundNear', 'playSoundWith', 'newShader', 'resolveSource']);
const FORMAT_RE = /%(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[cdiouxXeEfgGqsaA]/g;
const normalize = s => s.replace(/\r\n?|\n/g, '\n');
const key = s => String(s).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unnamed';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function longOpen(source, offset) {
  if (source[offset] !== '[') return null;
  const match = /^\[(=*)\[/.exec(source.slice(offset));
  return match ? { length: match[0].length, close: `]${match[1]}]` } : null;
}

/** Tokenizes Lua comments/strings without confusing code in either for tokens. */
export function lexLua(source) {
  const tokens = [];
  const diagnostics = [];
  let i = 0, line = 1, column = 1;
  const advance = end => {
    while (i < end) {
      if (source[i] === '\r') {
        if (source[i + 1] === '\n' && i + 1 < end) i++;
        line++; column = 1;
      } else if (source[i] === '\n') { line++; column = 1; }
      else column++;
      i++;
    }
  };
  const emit = (type, value, start, startLine, startColumn, end, extras = {}) => {
    tokens.push({ type, value, start, end, line: startLine, column: startColumn, ...extras });
    advance(end);
  };
  while (i < source.length) {
    const c = source[i];
    if (/\s/.test(c)) { advance(c === '\r' && source[i + 1] === '\n' ? i + 2 : i + 1); continue; }
    const start = i, startLine = line, startColumn = column;
    if (source.startsWith('--', i)) {
      const opener = longOpen(source, i + 2);
      if (opener) {
        const stop = source.indexOf(opener.close, i + 2 + opener.length);
        if (stop < 0) diagnostics.push({ line, column, issue: 'unterminated_long_comment' });
        advance(stop < 0 ? source.length : stop + opener.close.length);
      } else {
        let end = i + 2;
        while (end < source.length && !/[\r\n]/.test(source[end])) end++;
        advance(end);
      }
      continue;
    }
    const opener = longOpen(source, i);
    if (opener) {
      const contentStart = i + opener.length;
      const stop = source.indexOf(opener.close, contentStart);
      const end = stop < 0 ? source.length : stop + opener.close.length;
      let value = normalize(source.slice(contentStart, stop < 0 ? source.length : stop));
      if (value.startsWith('\n')) value = value.slice(1); // Lua long strings skip first newline.
      if (stop < 0) diagnostics.push({ line, column, issue: 'unterminated_long_string' });
      emit('string', value, start, startLine, startColumn, end, { syntax: 'long', raw: source.slice(start, end) });
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let cursor = i + 1, value = '', closed = false;
      while (cursor < source.length) {
        let current = source[cursor++];
        if (current === quote) { closed = true; break; }
        if (current !== '\\') { value += current; continue; }
        if (cursor >= source.length) break;
        const escaped = source[cursor++];
        const escapes = { a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', '"': '"', "'": "'" };
        if (Object.hasOwn(escapes, escaped)) value += escapes[escaped];
        else if (/\d/.test(escaped)) {
          let digits = escaped;
          while (digits.length < 3 && /\d/.test(source[cursor] ?? '')) digits += source[cursor++];
          value += String.fromCharCode(Number(digits));
        } else if (escaped === 'x' && /^[0-9a-f]{2}/i.test(source.slice(cursor))) {
          value += String.fromCharCode(parseInt(source.slice(cursor, cursor + 2), 16)); cursor += 2;
        } else if (escaped === 'u' && /^\{[0-9a-f]+\}/i.test(source.slice(cursor))) {
          const match = /^\{([0-9a-f]+)\}/i.exec(source.slice(cursor));
          const cp = parseInt(match[1], 16);
          if (cp <= 0x10ffff) value += String.fromCodePoint(cp);
          else diagnostics.push({ line: startLine, column: startColumn, issue: 'invalid_unicode_escape' });
          cursor += match[0].length;
        } else if (escaped === 'z') {
          while (cursor < source.length && /\s/.test(source[cursor])) cursor++;
        } else if (escaped === '\r' || escaped === '\n') {
          if (escaped === '\r' && source[cursor] === '\n') cursor++;
          value += '\n';
        } else value += escaped; // Lua 5.1 accepts some escaped characters literally.
      }
      if (!closed) diagnostics.push({ line: startLine, column: startColumn, issue: 'unterminated_quoted_string' });
      emit('string', normalize(value), start, startLine, startColumn, cursor, { syntax: 'quoted', raw: source.slice(start, cursor) });
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      const match = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(source.slice(i));
      emit('identifier', match[0], start, startLine, startColumn, i + match[0].length);
      continue;
    }
    if (/\d/.test(c)) {
      const match = /^(?:0[xX][0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?(?:[pP][+-]?\d+)?|\d+(?:\.(?!\.)\d*)?(?:[eE][+-]?\d+)?)/.exec(source.slice(i));
      emit('number', match[0], start, startLine, startColumn, i + match[0].length);
      continue;
    }
    const operator = ['...', '..', '==', '~=', '<=', '>=', '::', '//', '<<', '>>'].find(op => source.startsWith(op, i)) ?? c;
    emit('symbol', operator, start, startLine, startColumn, i + operator.length);
  }
  return { tokens, diagnostics };
}

function matchBrackets(tokens) {
  const pairs = new Map(), stack = [];
  const closes = { ')': '(', '}': '{', ']': '[' };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'symbol') continue;
    if (['(', '{', '['].includes(t.value)) stack.push(i);
    else if (Object.hasOwn(closes, t.value)) {
      if (stack.length && tokens[stack.at(-1)].value === closes[t.value]) {
        const start = stack.pop(); pairs.set(start, i); pairs.set(i, start);
      }
    }
  }
  return pairs;
}

function scopeOf(relative) {
  const parts = relative.split('/');
  const index = parts.indexOf('modules');
  if (index >= 0 && parts[index + 1]) return `module.${key(parts[index + 1])}`;
  const addon = parts.indexOf('addons');
  if (addon >= 0 && parts[addon + 1]) return `addon.${key(parts[addon + 1])}`;
  return parts.includes('engine') ? 'engine' : key(parts[0]);
}

function categoriesOf(relative) {
  const categories = [];
  const lower = `/${relative.toLowerCase()}`;
  const terms = { talents: '/talents/', effects: '/timed_effects/', zones: '/zones/', quests: '/quests/', birth: '/birth/', objects: '/objects/', npcs: '/npcs/', maps: '/maps/', artifacts: 'artifact', lore: '/lore/', chats: '/chats/', classes: '/class/', ai: '/ai/', damage_types: 'damage_types', achievements: 'achievements', dialogs: '/dialogs/', gfx: '/gfx/', engine: '/engine/', keybindings: 'keybind', factions: 'factions', resolvers: 'resolvers' };
  for (const [name, term] of Object.entries(terms)) if (lower.includes(term)) categories.push(name);
  return categories.length ? categories : ['other'];
}

function functionEnd(tokens, start, limit = tokens.length) {
  let depth = 1, index = start;
  while (++index < limit && depth) {
    if (tokens[index].type !== 'identifier') continue;
    if (['function', 'if', 'do', 'repeat'].includes(tokens[index].value)) depth++;
    else if (['end', 'until'].includes(tokens[index].value)) depth--;
  }
  return index - 1;
}

function declarationFields(tokens, open, close, pairs) {
  const fields = {};
  for (let i = open + 1; i < close; i++) {
    if (tokens[i].type === 'identifier' && tokens[i].value === 'function') {
      // Function bodies can contain assignments with the same names as fields.
      // Balance Lua block keywords so those are never definition identities.
      i = functionEnd(tokens, i, close);
      continue;
    }
    if (tokens[i].type === 'identifier' && tokens[i + 1]?.value === '=') {
      const field = tokens[i].value;
      let value = tokens[i + 2];
      if (TRANSLATION_HELPERS.has(value?.value)) {
        value = tokens[i + 3]?.value === '(' ? tokens[i + 4] : tokens[i + 3];
      }
      if (value && ['string', 'number'].includes(value.type)) fields[field] = value.value;
      else if (value?.type === 'identifier' && !['function', 'nil'].includes(value.value)) fields[field] = value.value;
      else if (value?.value === '{') {
        const end = pairs.get(i + 2);
        if (end) fields[field] = tokens.slice(i + 3, end).filter(t => t.type === 'string').map(t => t.value);
      }
    }
    if (['{', '(', '['].includes(tokens[i].value) && tokens[i].type === 'symbol' && pairs.has(i)) i = pairs.get(i);
  }
  return fields;
}

function declarationsIn(tokens, pairs, relative) {
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'identifier' || !DECLARATIONS.has(tokens[i].value)) continue;
    let open = i + 1;
    if (tokens[open]?.value === '(') open++;
    if (tokens[open]?.value !== '{' || !pairs.has(open)) continue;
    const close = pairs.get(open), fields = declarationFields(tokens, open, close, pairs);
    const kind = tokens[i].value;
    const specialized = kind === 'newBirthDescriptor' ? [fields.type, fields.name].filter(Boolean).join(':') : ['newTalentType', 'newDamageType'].includes(kind) ? fields.type ?? fields.name : fields.name;
    const identity = fields.define_as ?? fields.short_name ?? fields.id ?? specialized ?? `at_line_${tokens[i].line}`;
    const suggestion = `${scopeOf(relative)}.${key(tokens[i].value.replace(/^new/, ''))}.${key(Array.isArray(identity) ? identity.join('_') : identity)}`;
    result.push({ kind: tokens[i].value, identity, fields, semanticContextSuggestion: suggestion, file: relative, line: tokens[i].line, column: tokens[i].column, tokenStart: open, tokenEnd: close });
  }
  return result;
}

function callsIn(tokens, pairs) {
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'identifier') continue;
    let open = i + 1;
    if (tokens[open]?.value !== '(' || !pairs.has(open)) continue;
    const close = pairs.get(open);
    let nameStart = i;
    while (nameStart >= 2 && ['.', ':'].includes(tokens[nameStart - 1]?.value) && tokens[nameStart - 2]?.type === 'identifier') nameStart -= 2;
    const fullName = tokens.slice(nameStart, i + 1).map(t => t.value).join('');
    if (TEXT_CALLS.has(tokens[i].value) || PATH_CALLS.has(tokens[i].value) || tokens[i].value === 'format' || /Dialog|Text|Label|Button|List|Popup|Chat/.test(fullName)) {
      result.push({ name: tokens[i].value, fullName, start: open, end: close, argument: 1, line: tokens[i].line });
    }
  }
  return result;
}

function fieldAt(tokens, index) {
  if (TRANSLATION_HELPERS.has(tokens[index - 1]?.value) && tokens[index - 2]?.value === '=' && tokens[index - 3]?.type === 'identifier') return tokens[index - 3].value;
  if (tokens[index - 1]?.value === '(' && TRANSLATION_HELPERS.has(tokens[index - 2]?.value) && tokens[index - 3]?.value === '=' && tokens[index - 4]?.type === 'identifier') return tokens[index - 4].value;
  if (tokens[index - 1]?.value === '=' && tokens[index - 2]?.type === 'identifier') return tokens[index - 2].value;
  if (tokens[index - 1]?.value === '=' && tokens[index - 2]?.value === ']' && tokens[index - 3]?.type === 'string') return tokens[index - 3].value;
  return null;
}

function placeholders(value) {
  const printf = [...value.replace(/%%/g, '').matchAll(FORMAT_RE)].map(m => m[0]);
  const tomeMarkup = [...new Set(value.match(/#[A-Za-z0-9_]+#|#\{[^}]+\}#|\$[A-Za-z_][A-Za-z0-9_]*/g) ?? [])];
  return { printf, tomeMarkup };
}

function argumentAt(tokens, index, call, pairs) {
  let arg = 1;
  for (let i = call.start + 1; i < index; i++) {
    if (tokens[i].value === ',') arg++;
    else if (tokens[i].type === 'symbol' && ['{', '(', '['].includes(tokens[i].value) && pairs.has(i) && pairs.get(i) < index) i = pairs.get(i);
  }
  return arg;
}

function stringArgument(tokens, call, argument, pairs) {
  let arg = 1;
  for (let i = call.start + 1; i < call.end; i++) {
    if (tokens[i].value === ',') arg++;
    else if (tokens[i].type === 'symbol' && ['{', '(', '['].includes(tokens[i].value) && pairs.has(i)) i = pairs.get(i);
    else if (arg === argument && tokens[i].type === 'string') return tokens[i].value;
  }
  return null;
}

export function inspectLua(source, relative) {
  const { tokens, diagnostics } = lexLua(source), pairs = matchBrackets(tokens);
  const declarations = declarationsIn(tokens, pairs, relative), calls = callsIn(tokens, pairs);
  const textFunctions = [];
  const textTables = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === 'function' && tokens[i - 1]?.value === '=' && tokens[i - 2]?.type === 'identifier' && VISIBLE_FIELDS.has(tokens[i - 2].value.toLowerCase())) {
      textFunctions.push({ start: i, end: functionEnd(tokens, i), field: tokens[i - 2].value, line: tokens[i - 2].line });
    }
    if (tokens[i].value === '{' && tokens[i - 1]?.value === '=' && tokens[i - 2]?.type === 'identifier' && VISIBLE_FIELDS.has(tokens[i - 2].value.toLowerCase()) && pairs.has(i)) {
      textTables.push({ start: i, end: pairs.get(i), field: tokens[i - 2].value, line: tokens[i - 2].line });
    }
  }
  const literals = [];
  const seenSuggestions = new Map();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'string') continue;
    const declaration = declarations.filter(d => i > d.tokenStart && i < d.tokenEnd).at(-1);
    const call = calls.filter(c => i > c.start && i < c.end).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
    const field = fieldAt(tokens, i);
    const textFunction = textFunctions.filter(f => i > f.start && i < f.end).at(-1);
    const textTable = textTables.filter(f => i > f.start && i < f.end).at(-1);
    const isTableKey = tokens[i + 1]?.value === ']' && tokens[i + 2]?.value === '=';
    const assignmentKey = field ? field.toLowerCase() : null;
    let classification = 'unclassified_literal', evidence = [];
    if (isTableKey) { classification = 'internal_key'; evidence.push('table_key'); }
    else if (TRANSLATION_HELPERS.has(tokens[i - 1]?.value)) { classification = 'potential_upstream_translation'; evidence.push(`translation_sugar:${tokens[i - 1].value}`); }
    else if (assignmentKey && VISIBLE_FIELDS.has(assignmentKey)) { classification = 'potential_text_field'; evidence.push(`field:${field}`); }
    else if (textFunction) { classification = 'potential_text_function'; evidence.push(`function_field:${textFunction.field}`); }
    else if (textTable) { classification = 'potential_text_table'; evidence.push(`table_field:${textTable.field}`); }
    else if (relative.includes('/chats/') && tokens[i - 1]?.value === '{') { classification = 'potential_dialogue_choice'; evidence.push('chat_positional_table_string'); }
    else if (call && TEXT_CALLS.has(call.name)) { classification = 'potential_text_call'; evidence.push(`call:${call.fullName}`); }
    else if (call && /Dialog|Text|Label|Button|List|Popup|Chat/.test(call.fullName)) { classification = 'potential_ui_constructor'; evidence.push(`call:${call.fullName}`); }
    else if (tokens[i + 1]?.value === ':' && ['format', 'tformat', 'toTString'].includes(tokens[i + 2]?.value)) { classification = 'potential_formatted_text'; evidence.push(`method:${tokens[i + 2].value}`); }
    else if (tokens[i + 1]?.value === ')' && tokens[i + 2]?.value === ':' && ['format', 'tformat', 'toTString'].includes(tokens[i + 3]?.value)) { classification = 'potential_formatted_text'; evidence.push(`parenthesized_method:${tokens[i + 3].value}`); }
    else if (call && PATH_CALLS.has(call.name)) { classification = 'internal_asset_or_module_reference'; evidence.push(`call:${call.fullName}`); }
    else if (assignmentKey && ['define_as', 'short_name', 'type', 'subtype', 'image', 'sound', 'shader', 'display', 'faction', 'id', 'file', 'resolvers', 'require'].includes(assignmentKey)) { classification = 'internal_definition_or_asset'; evidence.push(`field:${field}`); }
    else if (/^(?:[/\\]|(?:data|gfx|music|sound|engine|mod)[/.])|\.(?:png|jpg|dds|ogg|wav|lua|glsl|frag|vert)$/i.test(t.value)) { classification = 'likely_internal_reference'; evidence.push('path_pattern'); }
    const candidate = classification.startsWith('potential_');
    const fileContext = `${scopeOf(relative)}.${relative.replace(/\.lua$/, '').split('/').map(key).join('.')}`;
    const role = field ? key(field) : textFunction ? `${key(textFunction.field)}.text` : textTable ? `${key(textTable.field)}.item` : call ? `${key(call.name)}.argument_${argumentAt(tokens, i, call, pairs)}` : 'literal';
    let sourceLocalization = null;
    if (tokens[i - 1]?.value === '_t') sourceLocalization = { hook: '_t_sugar', tag: '_t' };
    else if (call?.name === '_t' && argumentAt(tokens, i, call, pairs) === 1) sourceLocalization = { hook: '_t_call', tag: stringArgument(tokens, call, 2, pairs) ?? '_t' };
    else if (tokens[i + 1]?.value === ':' && tokens[i + 2]?.value === 'tformat' || tokens[i + 1]?.value === ')' && tokens[i + 2]?.value === ':' && tokens[i + 3]?.value === 'tformat') sourceLocalization = { hook: 'tformat_method', tag: 'tformat' };
    else if (tokens[i - 1]?.value === '_nt') sourceLocalization = { hook: '_nt_marker', tag: null };
    const baseSuggestion = `${declaration?.semanticContextSuggestion ?? fileContext}.${role}`;
    const collision = (seenSuggestions.get(baseSuggestion) ?? 0) + 1;
    seenSuggestions.set(baseSuggestion, collision);
    literals.push({ file: relative, line: t.line, column: t.column, offset: t.start, endOffset: t.end, syntax: t.syntax, value: t.value, classification, evidence, reviewRequired: true, ...(candidate ? { semanticIdSuggestion: collision === 1 ? baseSuggestion : `${baseSuggestion}.occurrence_${collision}`, suggestionStatus: 'context_based_review_required' } : {}), field, sourceLocalization, functionField: textFunction ? { field: textFunction.field, line: textFunction.line } : null, declaration: declaration ? { kind: declaration.kind, identity: declaration.identity, line: declaration.line } : null, call: call ? { name: call.fullName, line: call.line, argument: argumentAt(tokens, i, call, pairs) } : null, composition: { concatenated: tokens[i - 1]?.value === '..' || tokens[i + 1]?.value === '..', formatted: tokens[i + 1]?.value === ':' && ['format', 'tformat'].includes(tokens[i + 2]?.value), fieldFunction: !!textFunction }, placeholders: placeholders(t.value) });
  }
  return { declarations: declarations.map(({ tokenStart, tokenEnd, ...d }) => d), literals, diagnostics };
}

function filesUnder(directory) {
  const result = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) result.push(absolute);
    }
  }
  walk(directory);
  return result;
}

function featureRecords(relative, source, declarations) {
  const scope = scopeOf(relative), records = [];
  const zone = /\/data\/zones\/([^/]+)\/zone\.lua$/i.exec(relative);
  if (zone) {
    const { tokens } = lexLua(source), pairs = matchBrackets(tokens);
    const open = tokens.findIndex((t, i) => t.value === '{' && tokens[i - 1]?.value === 'return');
    const fields = open >= 0 && pairs.has(open) ? declarationFields(tokens, open, pairs.get(open), pairs) : {};
    records.push({ scope, kind: 'zone_file', identity: zone[1], file: relative, line: open >= 0 ? tokens[open].line : 1, fields, evidence: 'zone.lua_path_and_optional_return_table', reviewRequired: true });
  }
  const quest = /\/data\/quests\/([^/]+)\.lua$/i.exec(relative);
  if (quest) records.push({ scope, kind: 'quest_file', identity: quest[1], file: relative, line: 1, evidence: 'quest_data_file_path', reviewRequired: true });
  const chat = /\/data\/chats\/([^/]+)\.lua$/i.exec(relative);
  if (chat) records.push({ scope, kind: 'chat_file', identity: chat[1], file: relative, line: 1, evidence: 'chat_data_file_path', reviewRequired: true });
  for (const declaration of declarations) {
    records.push({ scope, kind: declaration.kind, identity: declaration.identity, file: relative, line: declaration.line, fields: declaration.fields, evidence: 'explicit_definition_call', reviewRequired: true });
  }
  return records;
}

function selfTest() {
  const sample = `-- newTalent{name="commented"}\n--[=[ log("hidden") ]=]\nnewTalent { name = "Death Dance", short_name = 'DEATH_DANCE',\n desc = [=[\nTwo hits.\n]=], info = function(self) return "Damage: %d%%":format(25) end,\n nested = { name = "nested" }, image = "gfx/a.png" }\ngame:logPlayer(player, "You strike %s for %d damage.", target.name, amount)\nlocal s = "a\\z  \n b\\065\\x42\\u{43}"\nlocal x = 'don\\\'t'\nlocal y = [==[literal -- "]==]\n`;
  const result = inspectLua(sample, 'game/modules/tome/data/talents/technique/test.lua');
  assert.equal(result.declarations.length, 1);
  assert.equal(result.declarations[0].fields.short_name, 'DEATH_DANCE');
  assert.equal(result.declarations[0].fields.name, 'Death Dance');
  assert.equal(result.literals.some(l => l.value === 'commented' || l.value === 'hidden'), false);
  assert.equal(result.literals.find(l => l.value.startsWith('Two hits.')).value, 'Two hits.\n');
  assert.equal(result.literals.find(l => l.value.startsWith('You strike')).call.argument, 2);
  assert.deepEqual(result.literals.find(l => l.value.startsWith('You strike')).placeholders.printf, ['%s', '%d']);
  assert.equal(result.literals.find(l => l.value === 'abABC').syntax, 'quoted');
  assert.equal(result.literals.some(l => l.value === "don't"), true);
  assert.equal(result.literals.find(l => l.value === 'literal -- "').syntax, 'long');
  assert.equal(result.diagnostics.length, 0);
  assert.equal(lexLua('[=[unfinished').diagnostics[0].issue, 'unterminated_long_string');
  assert.equal(lexLua('--[=[unfinished').diagnostics[0].issue, 'unterminated_long_comment');
  assert.equal(lexLua('"unfinished').diagnostics[0].issue, 'unterminated_quoted_string');
  assert.deepEqual(placeholders('%% %s %02d #RED# $name #{bold}#'), { printf: ['%s', '%02d'], tomeMarkup: ['#RED#', '$name', '#{bold}#'] });
  const nested = inspectLua('newTalent{name="a", nested={ name="b", define_as="BAD" }, define_as="GOOD"}', 'game/modules/tome/a.lua');
  assert.equal(nested.declarations[0].identity, 'GOOD');
  const functionBody = inspectLua('newTalent{name="a", info=function(self) if self then name="bad" end return "help" end, define_as="GOOD"}', 'game/modules/tome/a.lua');
  assert.equal(functionBody.declarations[0].fields.name, 'a');
  assert.equal(functionBody.literals.find(l => l.value === 'help').classification, 'potential_text_function');
  assert.equal(inspectLua('newChat{text="Greeting",answers={{"Yes",jump="accept"}}}', 'game/modules/tome/data/chats/test.lua').literals.find(l => l.value === 'Yes').classification, 'potential_dialogue_choice');
  assert.equal(lexLua('a\r\nb\r\nc').tokens[2].line, 3);
  const translated = inspectLua('newTalent{name=_t"Strike",type={"technique/test",1},info=function() return (_t"Hit %s"):tformat("target") end} newBirthDescriptor{type="class",name=_t"Warrior",desc={_t"Description"}}', 'game/modules/tome/a.lua');
  assert.equal(translated.declarations[0].identity, 'Strike');
  assert.equal(translated.declarations[1].identity, 'class:Warrior');
  assert.equal(translated.literals.find(l => l.value === 'Description').classification, 'potential_upstream_translation');
  assert.equal(translated.literals.find(l => l.value === 'Strike').field, 'name');
  assert.equal(placeholders('#Target# #Source#').tomeMarkup.length, 2);
  assert.equal(translated.literals.find(l => l.value === 'Strike').sourceLocalization.tag, '_t');
  assert.equal(inspectLua('local s=("format %s"):tformat(x)', 'game/modules/tome/a.lua').literals[0].sourceLocalization.tag, 'tformat');
  assert.equal(inspectLua('local s=_t("Text", "context")', 'game/modules/tome/a.lua').literals[0].sourceLocalization.tag, 'context');
  console.log('Lua lexer / inventory self-test: 30 assertions passed.');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) { selfTest(); return; }
  const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const options = name => args.flatMap((arg, i) => arg === name && args[i + 1] ? [args[i + 1]] : []);
  const sourceRoots = options('--source').map(root => path.resolve(root));
  const outputRoot = path.resolve(option('--output') ?? 'inventory-output');
  if (!sourceRoots.length || sourceRoots.some(root => !fs.statSync(root).isDirectory())) throw new Error('Use --source PATH to extracted official source. Repeat --source for separately unpacked module/engine roots.');
  if (sourceRoots.some(root => outputRoot === root || outputRoot.startsWith(root + path.sep))) throw new Error('Output must be outside the pristine source tree.');
  for (let i = 0; i < sourceRoots.length; i++) for (let j = 0; j < sourceRoots.length; j++) {
    if (i !== j && (sourceRoots[i] === sourceRoots[j] || sourceRoots[i].startsWith(sourceRoots[j] + path.sep))) throw new Error('Source roots must be distinct and non-overlapping to avoid duplicate counts.');
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  const outputs = Object.fromEntries(['files', 'features', 'declarations', 'literals', 'text-candidates', 'diagnostics'].map(name => [name, fs.openSync(path.join(outputRoot, `${name}.jsonl`), 'w')]));
  const write = (name, row) => fs.writeSync(outputs[name], JSON.stringify(row) + '\n');
  const summary = { schemaVersion: 1, generatedAt: new Date().toISOString(), sourceRoots, sourceVersionClaim: option('--version') ?? null, inventoryMethod: 'static_lua_lexical_scan_no_source_execution', totalFiles: 0, totalBytes: 0, luaFiles: 0, luaBytes: 0, stringLiterals: 0, potentialTextLiterals: 0, declarations: 0, diagnostics: 0, scopes: {}, categories: {}, declarationKinds: {}, featureKindsByScope: {}, literalClassifications: {}, candidatePlaceholderCounts: { printf: 0, tomeMarkup: 0 }, limits: ['Potential text classification is evidence-based and requires review; all literals are not user-visible text.', 'Semantic IDs are suggestions derived from definition identity / source context; manual stable key selection and collision review are required.', 'Dynamic table creation, inheritance, runtime-generated names, text concatenation and non-Lua resources require additional runtime/manual inventory.', 'Declarations are explicit recognized newX table callsites only; counts are source definitions, not instantiated runtime features.', 'Zone/quest/chat file counts identify static source units, not playable or reachable runtime content.', 'Archive containers (.team/.teae/.teaa) must be separately unpacked and supplied as non-overlapping source roots; this scanner does not silently execute or extract archives.', 'Total file bytes cover selected physical roots, including any archive containers and unpacked assets; this is not a deduplicated release download size.', 'Static lexical scanner is not a full Lua parser or execution-based coverage tool.'] };
  try {
    for (let rootIndex = 0; rootIndex < sourceRoots.length; rootIndex++) {
      const sourceRoot = sourceRoots[rootIndex], sourceRootId = `root_${rootIndex + 1}`;
    for (const file of filesUnder(sourceRoot)) {
      const relative = path.relative(sourceRoot, file).split(path.sep).join('/'), stat = fs.statSync(file);
      summary.totalFiles++; summary.totalBytes += stat.size;
      if (!relative.toLowerCase().endsWith('.lua')) continue;
      const bytes = fs.readFileSync(file), source = bytes.toString('utf8'), scope = scopeOf(relative), categories = categoriesOf(relative);
      summary.luaFiles++; summary.luaBytes += bytes.length;
      const result = inspectLua(source, relative);
      for (const feature of featureRecords(relative, source, result.declarations)) {
        write('features', { sourceRootId, ...feature });
        const scopeFeatures = summary.featureKindsByScope[scope] ??= {};
        scopeFeatures[feature.kind] = (scopeFeatures[feature.kind] ?? 0) + 1;
      }
      const candidates = result.literals.filter(l => l.classification.startsWith('potential_'));
      const fileRow = { sourceRootId, file: relative, scope, categories, bytes: bytes.length, sha256: sha(bytes), literalCount: result.literals.length, potentialTextLiteralCount: candidates.length, declarationCount: result.declarations.length, diagnosticCount: result.diagnostics.length };
      write('files', fileRow);
      const scopeCount = summary.scopes[scope] ??= { luaFiles: 0, bytes: 0, literals: 0, potentialTextLiterals: 0, declarations: 0 };
      scopeCount.luaFiles++; scopeCount.bytes += bytes.length; scopeCount.literals += result.literals.length; scopeCount.potentialTextLiterals += candidates.length; scopeCount.declarations += result.declarations.length;
      for (const category of categories) {
        const cat = summary.categories[category] ??= { luaFiles: 0, literals: 0, potentialTextLiterals: 0, declarations: 0 };
        cat.luaFiles++; cat.literals += result.literals.length; cat.potentialTextLiterals += candidates.length; cat.declarations += result.declarations.length;
      }
      for (const declaration of result.declarations) { write('declarations', { sourceRootId, ...declaration }); summary.declarations++; summary.declarationKinds[declaration.kind] = (summary.declarationKinds[declaration.kind] ?? 0) + 1; }
      for (const literal of result.literals) {
        write('literals', { sourceRootId, ...literal }); summary.stringLiterals++; summary.literalClassifications[literal.classification] = (summary.literalClassifications[literal.classification] ?? 0) + 1;
        if (literal.classification.startsWith('potential_')) { write('text-candidates', { sourceRootId, ...literal }); summary.potentialTextLiterals++; summary.candidatePlaceholderCounts.printf += literal.placeholders.printf.length; summary.candidatePlaceholderCounts.tomeMarkup += literal.placeholders.tomeMarkup.length; }
      }
      for (const diagnostic of result.diagnostics) { write('diagnostics', { sourceRootId, file: relative, ...diagnostic }); summary.diagnostics++; }
    }
    }
  } finally { Object.values(outputs).forEach(fd => fs.closeSync(fd)); }
  fs.writeFileSync(path.join(outputRoot, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  const lines = ['# Tales of Maj’Eyal / T-Engine source inventory', '', ...sourceRoots.map((root, i) => `Source root_${i + 1}: ${root}`), `Version claim supplied by caller: ${summary.sourceVersionClaim ?? '(none)'}`, '', `Scanned ${summary.totalFiles.toLocaleString()} files (${summary.totalBytes.toLocaleString()} bytes), including ${summary.luaFiles.toLocaleString()} Lua files (${summary.luaBytes.toLocaleString()} bytes).`, '', `Found ${summary.declarations.toLocaleString()} recognized source declarations, ${summary.stringLiterals.toLocaleString()} string literals, and ${summary.potentialTextLiterals.toLocaleString()} potential text literals requiring review. Lexer diagnostics: ${summary.diagnostics}.`, '', '## Explicit declaration callsites', '', '| Kind | Count |', '| --- | ---: |', ...Object.entries(summary.declarationKinds).sort((a, b) => b[1] - a[1]).map(([name, count]) => `| ${name} | ${count} |`), '', '## Source areas (overlapping categories)', '', '| Area | Lua files | Declarations | Potential text literals |', '| --- | ---: | ---: | ---: |', ...Object.entries(summary.categories).sort((a, b) => b[1].luaFiles - a[1].luaFiles).map(([name, count]) => `| ${name} | ${count.luaFiles} | ${count.declarations} | ${count.potentialTextLiterals} |`), '', '## Modules and engine', '', '| Scope | Lua files | Declarations | Potential text literals |', '| --- | ---: | ---: | ---: |', ...Object.entries(summary.scopes).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `| ${name} | ${count.luaFiles} | ${count.declarations} | ${count.potentialTextLiterals} |`), '', '## Files and source locators', '', '- `files.jsonl`: per-Lua-file SHA-256, category and counts.', '- `features.jsonl`: recognized declarations plus zone/quest/chat source files, identity and locator.', '- `declarations.jsonl`: definition identity, top-level fields, file, line and column.', '- `literals.jsonl`: every lexed Lua string literal; internal and unclassified strings retained for audit.', '- `text-candidates.jsonl`: potential text callsites/fields with context-based semantic ID suggestions, placeholders and composition flags.', '- `diagnostics.jsonl`: malformed/unsupported lexical construct findings.', '- `summary.json`: machine-readable totals and scope/category distributions.', '', '## Limits and next review', '', ...summary.limits.map(limit => `- ${limit}`), '', 'Do not ship these candidate suggestions as a complete localization catalogue. Review declaration keys, classify unclassified literals, trace dynamic text and dialogue tables, and establish gameplay/runtime coverage before claiming complete English/Japanese text coverage.', ''];
  fs.writeFileSync(path.join(outputRoot, 'INVENTORY.md'), lines.join('\n'));
  console.log(JSON.stringify({ outputRoot, totalFiles: summary.totalFiles, luaFiles: summary.luaFiles, declarations: summary.declarations, stringLiterals: summary.stringLiterals, potentialTextLiterals: summary.potentialTextLiterals, diagnostics: summary.diagnostics }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
