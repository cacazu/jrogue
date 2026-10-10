/**
 * Read-only DRL text discovery. This is a lexical inventory, not a translator,
 * executable-source loader, runtime replacement engine, or full language parser.
 * Offsets are UTF-16 code units; lines and columns are one-based.
 */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '../../upstream/drl');
const defaultOutput = path.resolve(path.dirname(scriptPath), '../catalog');
const digest = value => createHash('sha256').update(value).digest('hex');
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'literal';

export function locationAt(source, offset) {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const lastNewline = before.lastIndexOf('\n');
  return { line, column: offset - lastNewline };
}

function sourceLocator(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1);
  return offset => {
    let low = 0;
    let high = starts.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (starts[middle] <= offset) low = middle; else high = middle;
    }
    return { line: low + 1, column: offset - starts[low] + 1 };
  };
}

function longBracketAt(source, offset) {
  const match = /^\[(=*)\[/.exec(source.slice(offset));
  return match ? { opening: match[0], closing: `]${match[1]}]` } : null;
}

function decodeLua(body) {
  const escapeMap = { a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\x0b', '\\': '\\', '"': '"', "'": "'" };
  const diagnostics = [];
  let value = '';
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '\\') { value += body[i]; continue; }
    const start = i;
    const next = body[++i];
    if (next in escapeMap) value += escapeMap[next];
    else if (next === '\n') value += '\n';
    else if (next === '\r') { if (body[i + 1] === '\n') i++; value += '\n'; }
    else if (/[0-9]/.test(next ?? '')) {
      let number = next;
      for (let n = 0; n < 2 && /[0-9]/.test(body[i + 1] ?? ''); n++) number += body[++i];
      if (+number > 255) diagnostics.push(`Decimal escape exceeds byte range: \\${number}`);
      value += String.fromCharCode(+number);
    } else if (next === 'x' && /^[0-9a-f]{2}/i.test(body.slice(i + 1))) {
      value += String.fromCharCode(parseInt(body.slice(i + 1, i + 3), 16)); i += 2;
    } else if (next === 'z') {
      while (/\s/.test(body[i + 1] ?? '') && i + 1 < body.length) i++;
    } else if (next === 'u' && /^\{[0-9a-f]+\}/i.test(body.slice(i + 1))) {
      const match = /^\{([0-9a-f]+)\}/i.exec(body.slice(i + 1));
      const point = parseInt(match[1], 16);
      if (point <= 0x10ffff) value += String.fromCodePoint(point);
      else { diagnostics.push('Unicode escape exceeds code point range'); value += body.slice(start, i + match[0].length + 1); }
      i += match[0].length;
    } else {
      // Preserve unsupported dialect escapes: never silently drop a backslash.
      value += `\\${next ?? ''}`;
      diagnostics.push(`Unrecognized Lua escape at literal offset ${start}`);
    }
  }
  return { value, diagnostics };
}

/** Tokenize code while excluding comments and compiler directives. */
export function scanSource(source, language) {
  if (!['lua', 'pascal'].includes(language)) throw new Error(`Unsupported language: ${language}`);
  const tokens = [];
  const diagnostics = [];
  const locate = sourceLocator(source);
  let i = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  const add = (kind, start, end, data = {}) => tokens.push({ kind, start, end, raw: source.slice(start, end), ...locate(start), ...data });
  while (i < source.length) {
    const start = i;
    const c = source[i];
    if (/\s/.test(c)) { i++; continue; }
    if (language === 'lua' && source.startsWith('--', i)) {
      const long = longBracketAt(source, i + 2);
      if (long) {
        const end = source.indexOf(long.closing, i + 2 + long.opening.length);
        if (end < 0) { diagnostics.push({ ...locationAt(source, i), offset: i, message: 'Unterminated Lua long comment' }); i = source.length; }
        else i = end + long.closing.length;
      } else { const end = source.indexOf('\n', i + 2); i = end < 0 ? source.length : end; }
      continue;
    }
    if (language === 'pascal' && source.startsWith('//', i)) {
      const end = source.indexOf('\n', i + 2); i = end < 0 ? source.length : end; continue;
    }
    if (language === 'pascal' && (c === '{' || source.startsWith('(*', i))) {
      const stack = [c === '{' ? '}' : '*)'];
      i += c === '{' ? 1 : 2;
      while (i < source.length && stack.length) {
        if (source.startsWith(stack.at(-1), i)) { const closing = stack.pop(); i += closing.length; }
        else if (source[i] === '{') { stack.push('}'); i++; }
        else if (source.startsWith('(*', i)) { stack.push('*)'); i += 2; }
        else i++;
      }
      if (stack.length) diagnostics.push({ ...locationAt(source, start), offset: start, message: 'Unterminated Pascal comment/directive' });
      continue;
    }
    if (language === 'lua' && c === '[') {
      const long = longBracketAt(source, i);
      if (long) {
        const bodyStart = i + long.opening.length;
        const close = source.indexOf(long.closing, bodyStart);
        const closed = close >= 0;
        const bodyEnd = closed ? close : source.length;
        i = closed ? close + long.closing.length : source.length;
        // Lua ignores one initial newline (CRLF, CR, or LF) in long strings.
        const body = source.slice(bodyStart, bodyEnd).replace(/^(?:\r\n|\n|\r)/, '');
        add('string', start, i, { value: body.replace(/\r\n|\r/g, '\n'), syntax: 'lua-long-bracket', closed });
        if (!closed) diagnostics.push({ ...locationAt(source, start), offset: start, message: 'Unterminated Lua long string' });
        continue;
      }
    }
    if ((language === 'pascal' && c === "'") || (language === 'lua' && (c === '"' || c === "'"))) {
      const quote = c;
      i++;
      let closed = false;
      while (i < source.length) {
        if (language === 'lua' && source[i] === '\\') { i += source[i + 1] === '\r' && source[i + 2] === '\n' ? 3 : 2; continue; }
        if (source[i] === quote) {
          if (language === 'pascal' && source[i + 1] === quote) { i += 2; continue; }
          i++; closed = true; break;
        }
        i++;
      }
      i = Math.min(i, source.length);
      const body = source.slice(start + 1, closed ? i - 1 : i);
      const decoded = language === 'pascal' ? { value: body.replace(/''/g, "'"), diagnostics: [] } : decodeLua(body);
      add('string', start, i, { ...decoded, syntax: language === 'pascal' ? 'pascal-quoted' : `lua-${quote === '"' ? 'double' : 'single'}-quoted`, closed });
      if (!closed) diagnostics.push({ ...locationAt(source, start), offset: start, message: 'Unterminated quoted string' });
      continue;
    }
    if (language === 'pascal' && c === '#') {
      const match = /^#(?:\$[a-f0-9]+|\d+)/i.exec(source.slice(i));
      if (match) {
        i += match[0].length;
        const value = match[0][1] === '$' ? parseInt(match[0].slice(2), 16) : parseInt(match[0].slice(1), 10);
        add('character-code', start, i, { value: value <= 0x10ffff ? String.fromCodePoint(value) : null, numericValue: value, syntax: 'pascal-character-code', closed: true });
        continue;
      }
    }
    if (/[a-z_]/i.test(c)) {
      i++; while (i < source.length && /[a-z_0-9]/i.test(source[i])) i++;
      add('identifier', start, i); continue;
    }
    if (/[0-9]/.test(c)) {
      i++; while (i < source.length && /[0-9a-fx]/i.test(source[i])) i++;
      add('number', start, i); continue;
    }
    const operator = ['...', '..', ':=', '==', '~=', '>=', '<=', '<>'].find(op => source.startsWith(op, i));
    i += operator?.length ?? 1;
    add('punctuation', start, i);
  }
  return { tokens, literals: tokens.filter(t => ['string', 'character-code'].includes(t.kind)), diagnostics };
}

/** Detect format parameters without treating DRL color/key markup as parameters. */
export function extractPlaceholders(value) {
  const placeholders = [];
  const escapedPercents = [];
  const markup = [];
  const printf = /%(?:(\d+)\$|(\d+):)?[-+ #0]*(?:\d+|\*)?(?:\.(?:\d+|\*))?[aAcCdDeEfFgGiIoOpPsSuUxXq]/gy;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '%' && value[i + 1] === '%') { escapedPercents.push({ offset: i, raw: '%%' }); i++; continue; }
    if (value[i] === '%') {
      // A numeric percentage followed by prose is not a format placeholder.
      if (/\d/.test(value[i - 1] ?? '') && /^\s+[a-z]/i.test(value.slice(i + 1))) continue;
      printf.lastIndex = i;
      const match = printf.exec(value);
      if (match) { placeholders.push({ kind: 'printf', offset: i, raw: match[0], index: match[1] ?? match[2] ?? null, conversion: match[0].at(-1) }); i += match[0].length - 1; }
    }
  }
  for (const match of value.matchAll(/\{([^{}\n]+)\}/g)) {
    if (/^[!a-zA-Z][^{}]*$/.test(match[1]) && (/^[!rgbwycmoRGBWYCMO]/.test(match[1]) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(match[1]))) {
      markup.push({ kind: 'drl-brace-markup-candidate', offset: match.index, raw: match[0] });
    } else {
      // Named brace syntax is only a candidate until its call-site formatter is identified.
      placeholders.push({ kind: 'named-brace-candidate', offset: match.index, raw: match[0], name: match[1], requiresFormatterReview: true });
    }
  }
  for (const match of value.matchAll(/@(\d+)/g)) placeholders.push({ kind: 'drl-at-index', offset: match.index, raw: match[0], index: match[1], requiresFormatterReview: true });
  for (const match of value.matchAll(/@[a-zA-Z!]/g)) markup.push({ kind: 'drl-color-markup-candidate', offset: match.index, raw: match[0] });
  return { placeholders, escapedPercents, markup };
}

const displayKeys = new Set(['name', 'name_plural', 'plural', 'desc', 'description', 'quote', 'title', 'text', 'message', 'msg', 'abbr', 'fullname', 'brief', 'help', 'short', 'hint', 'wintext', 'losemsg', 'history', 'entry', 'welcome', 'warning', 'select']);
const internalKeys = new Set(['id', 'group', 'sound', 'sound_id', 'damage', 'filename', 'file', 'path', 'folder', 'music', 'module', 'classname', 'ammo_id', 'ascii', 'resist', 'ai_type', 'ai', 'type', 'target']);
const displayCall = /(?:msg|message|emote|warn|error|confirm|choice|print|setname|setdescription|setnames|text|drawstring|drawtext|write|title|hint|success|fail|addoption|addtext|addmessage)/i;
const internalCall = /(?:require|dofile|loadfile|add_property|add_perk|remove_perk|register|addgroup|addinteger|addtoggle|addfloat|addstring|getproperty|getfield|rawget|open|findfirst|setconfig|log|debug)/i;

function qualifiedName(tokens, end) {
  if (end < 0 || tokens[end].kind !== 'identifier') return null;
  let start = end;
  while (start >= 2 && ['.', ':'].includes(tokens[start - 1].raw) && tokens[start - 2].kind === 'identifier') start -= 2;
  return tokens.slice(start, end + 1).map(t => t.raw).join('');
}

/** Heuristic structural anchors. Candidates must be reviewed before becoming API IDs. */
export function inventorySource(source, language, file) {
  const scan = scanSource(source, language);
  const records = [];
  const stack = [];
  const occurrences = new Map();
  let scope = 'module';
  let pendingEntity = null;
  const tokens = scan.tokens;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const word = token.raw.toLowerCase();
    if (language === 'pascal' && /^(procedure|function|constructor|destructor)$/.test(word)) {
      let n = index + 1;
      if (tokens[n]?.kind === 'identifier') {
        let name = tokens[n].raw;
        while (tokens[n + 1]?.raw === '.' && tokens[n + 2]?.kind === 'identifier') { name += `.${tokens[n + 2].raw}`; n += 2; }
        scope = name;
      }
    }
    if (language === 'lua' && word === 'function') {
      let n = index + 1;
      let name = null;
      if (tokens[n]?.kind === 'identifier') {
        name = tokens[n].raw;
        while (['.', ':'].includes(tokens[n + 1]?.raw) && tokens[n + 2]?.kind === 'identifier') { name += `${tokens[n + 1].raw}${tokens[n + 2].raw}`; n += 2; }
      } else if (tokens[index - 1]?.raw === '=' && tokens[index - 2]?.kind === 'identifier') name = tokens[index - 2].raw;
      // Lua block scopes are conservative anchors; their precision is stated in metadata.
      scope = name ?? `${scope}.anonymous`;
    }
    if (token.raw === '(' || token.raw === '[' || (language === 'lua' && token.raw === '{')) {
      const entity = token.raw === '{' ? pendingEntity : null;
      stack.push({ kind: token.raw, call: token.raw === '(' ? qualifiedName(tokens, index - 1) : null, entity });
      if (entity) pendingEntity = null;
    }
    if ([')', ']', '}'].includes(token.raw)) {
      const opening = { ')': '(', ']': '[', '}': '{' }[token.raw];
      if (stack.at(-1)?.kind === opening) stack.pop();
    }
    if (!['string', 'character-code'].includes(token.kind)) continue;
    const previous = tokens[index - 1];
    const beforePrevious = tokens[index - 2];
    const isRegisterId = previous?.kind === 'identifier' && /^register_/.test(previous.raw);
    if (isRegisterId && tokens[index + 1]?.raw === '{') pendingEntity = { kind: previous.raw.slice(9), id: token.value };
    // Alternate register_item("id", {...}) form.
    const enclosingCall = [...stack].reverse().find(x => x.call)?.call ?? null;
    const isRegisterCallId = /^register_/.test(enclosingCall ?? '') && previous?.raw === '(';
    if (isRegisterCallId) pendingEntity = { kind: enclosingCall.slice(9), id: token.value };
    const entity = [...stack].reverse().find(x => x.entity)?.entity ?? null;
    let key = null;
    if (['=', ':=', ':'].includes(previous?.raw) && beforePrevious?.kind === 'identifier') key = beforePrevious.raw;
    const keyLower = key?.toLowerCase();
    const lineStart = source.lastIndexOf('\n', token.start - 1) + 1;
    const lineEnd = source.indexOf('\n', token.end);
    const lineContext = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd).replace(/\r$/, '');
    const concatenated = [previous?.raw, tokens[index + 1]?.raw].some(op => op === '+' || op === '..')
      || (language === 'pascal' && (previous?.kind === 'character-code' || tokens[index + 1]?.kind === 'character-code' || previous?.kind === 'string' || tokens[index + 1]?.kind === 'string'));
    const lexicalValue = token.value ?? '';
    let classification = 'ambiguous';
    let reason = 'No recognized text sink or display field; manual review required.';
    if (token.kind === 'character-code') { classification = 'text-fragment'; reason = 'Pascal numeric character fragment; join adjacent fragments at use-case migration.'; }
    else if (isRegisterId || isRegisterCallId) { classification = 'internal'; reason = 'Registry identifier used to address game entities, not display wording.'; }
    else if (displayKeys.has(keyLower)) { classification = 'user-facing-candidate'; reason = `Display-like field ${key}.`; }
    else if (internalKeys.has(keyLower)) { classification = 'internal-candidate'; reason = `Data/configuration field ${key}; verify display use before exclusion.`; }
    else if (enclosingCall && displayCall.test(enclosingCall)) { classification = 'user-facing-candidate'; reason = `Potential text sink ${enclosingCall}; verify argument role.`; }
    else if (enclosingCall && internalCall.test(enclosingCall)) { classification = 'internal-candidate'; reason = `Potential identifier/path/logging API ${enclosingCall}; verify argument role.`; }
    else if (lexicalValue.length === 0 || /^\s*$/.test(lexicalValue)) { classification = 'empty-or-layout'; reason = 'Empty/whitespace literal; retain for layout and dynamic assembly review.'; }
    else if (/^[A-Za-z]:[\\/]|\.(?:lua|png|wav|ogg|mp3|dll|wad|dat|sav|txt|hlp|asc)$/.test(lexicalValue)) { classification = 'internal-candidate'; reason = 'File/path-like literal; must not be mechanically translated.'; }
    else if (/^\d+d\d+(?:[+-]\d+)?$/.test(lexicalValue)) { classification = 'internal-candidate'; reason = 'Dice expression, interpreted by gameplay rules.'; }
    const category = /settings|config|bindings/i.test(file) ? 'settings-input'
      : /help|manual/i.test(file) ? 'help'
      : /hof|awards|ranks|statistics/i.test(file) ? 'awards-history-statistics'
      : /plot/i.test(file) ? 'plot'
      : /items|beings|cells|traits|perks|affects|assemblies|difficulty|klass|challenge|levels/i.test(file) ? 'game-content'
      : /view|io/i.test(file) ? 'ui'
      : 'game-engine-or-support';
    const anchor = [slug(file.replace(/\.[^.]+$/, '')), entity ? `${slug(entity.kind)}.${slug(entity.id)}` : slug(scope), slug(key ?? enclosingCall ?? 'literal')].join('.');
    const ordinal = (occurrences.get(anchor) ?? 0) + 1;
    occurrences.set(anchor, ordinal);
    const dynamicReason = /(?:getname|getextname|preposition|description|plural|mortem|record)/i.test(scope)
      || /(?:GetName|GetExtName|Preposition|Plural|StringReplace|Format|format|tostring)/i.test(lineContext);
    records.push({
      candidateId: `drl.${anchor}.${ordinal}`,
      candidateStatus: 'unreviewed-structural-candidate',
      file, language, kind: token.kind, line: token.line, column: token.column,
      offset: token.start, endOffset: token.end, raw: token.raw, value: token.value,
      syntax: token.syntax, closed: token.closed,
      decodeDiagnostics: token.diagnostics ?? [], classification, classificationReason: reason, category,
      structure: { scopeCandidate: scope, entityCandidate: entity, keyCandidate: key, enclosingCallCandidate: enclosingCall, heuristic: true },
      context: { line: lineContext, before: source.slice(Math.max(0, token.start - 100), token.start), after: source.slice(token.end, token.end + 100) },
      formatting: extractPlaceholders(lexicalValue),
      dynamicAssembly: { concatenated, nameOrPluralOrFormattingCandidate: dynamicReason, requiresMigrationReview: concatenated || dynamicReason },
      translated: false,
    });
  }
  return { records, diagnostics: scan.diagnostics };
}

async function walk(root, current = '') {
  const entries = await readdir(path.join(root, current), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name === '.git') continue;
    const relative = path.posix.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

function linesForDocument(source, file) {
  const records = [];
  let offset = 0;
  for (const [index, line] of source.split('\n').entries()) {
    const value = line.replace(/\r$/, '');
    if (value.trim()) records.push({ candidateId: `drl.document.${slug(file)}.line.${index + 1}`, candidateStatus: 'unreviewed-document-line', file, line: index + 1, column: 1, offset, endOffset: offset + value.length, raw: value, value, classification: file.endsWith('.hlp') ? 'user-facing-document' : 'document-review', formatting: extractPlaceholders(value), translated: false });
    offset += line.length + 1;
  }
  return records;
}

/** Collect dynamic constructions independently of whether they contain a literal. */
export function findDynamicSources(source, language, file) {
  const scan = scanSource(source, language);
  const candidates = [];
  const seen = new Set();
  const pattern = /(?:plural|preposition|get_?name|getextname|getwoundstatus|description|addarticle|format|emote|mortem|stringreplace|record|tostring|register_corpse|register_klass_badge|register_master_badge|deathname|deathdesc)/i;
  for (const token of scan.tokens) {
    if (token.kind !== 'identifier' || !pattern.test(token.raw) || seen.has(token.line)) continue;
    seen.add(token.line);
    const start = source.lastIndexOf('\n', token.start - 1) + 1;
    const end = source.indexOf('\n', token.start);
    candidates.push({ file, line: token.line, offset: token.start, symbol: token.raw, reason: 'Dynamic name/plural/article/format/history construction candidate; inspect expression and arguments.', context: source.slice(start, end < 0 ? source.length : end).replace(/\r$/, ''), reviewed: false });
  }
  return candidates;
}

function totalsBy(records, field) {
  const totals = {};
  for (const record of records) totals[record[field]] = (totals[record[field]] ?? 0) + 1;
  return Object.fromEntries(Object.entries(totals).sort(([a], [b]) => a.localeCompare(b, 'en')));
}

export async function generateInventory(root = defaultRoot, output = defaultOutput) {
  root = path.resolve(root); output = path.resolve(output);
  if (output === root || output.startsWith(`${root}${path.sep}`)) throw new Error('Output must be separate from pristine upstream.');
  const fileNames = await walk(root);
  const manifest = [];
  const records = [];
  const documents = [];
  const dynamicSources = [];
  const diagnostics = [];
  const unscannedFiles = [];
  const documentExtensions = new Set(['.hlp', '.txt', '.asc', '.md', '.rc', '.ini', '.cfg', '.xml', '.json', '.yml', '.yaml', '.pl', '.sh', '.bat', '.fpc']);
  for (const file of fileNames) {
    const extension = path.extname(file).toLowerCase();
    const code = ['.pas', '.lpr', '.inc', '.lua'].includes(extension);
    const document = documentExtensions.has(extension);
    if (!code && !document) { unscannedFiles.push({ file, extension, reason: 'Binary or unrecognized extension; possible embedded/painted text requires separate audit.' }); continue; }
    const buffer = await readFile(path.join(root, file));
    const source = buffer.toString('utf8');
    // Report replacement characters: upstream legacy encoding is not assumed UTF-8.
    const encodingReview = source.includes('\ufffd');
    if (encodingReview) diagnostics.push({ file, message: 'UTF-8 decoding contains replacement character(s); source encoding requires review.' });
    const language = extension === '.lua' ? 'lua' : code ? 'pascal' : null;
    let count = 0;
    if (code) {
      const inventory = inventorySource(source, language, file);
      records.push(...inventory.records); count = inventory.records.length;
      dynamicSources.push(...findDynamicSources(source, language, file));
      diagnostics.push(...inventory.diagnostics.map(d => ({ file, ...d })));
    } else {
      const lines = linesForDocument(source, file);
      documents.push({ file, bytes: buffer.length, sha256: digest(buffer), role: file.endsWith('.hlp') ? 'in-game-help' : /manual/.test(file) ? 'manual' : /\.asc$/.test(file) ? 'ascii-layout-or-plot-review' : 'support-document-review', lines });
      count = lines.length;
    }
    manifest.push({ file, bytes: buffer.length, sha256: digest(buffer), language, scan: code ? 'lexical-literals' : 'document-lines', occurrences: count, encodingReview });
  }
  let commit = null;
  try { commit = execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 15000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { diagnostics.push({ message: 'Git commit could not be read; verify against acquisition provenance.' }); }
  const summary = {
    scannedFiles: manifest.length,
    codeFiles: manifest.filter(f => f.language).length,
    literalOccurrences: records.length,
    uniqueLiteralValues: new Set(records.map(r => r.value)).size,
    classificationCounts: totalsBy(records, 'classification'),
    categoryCounts: totalsBy(records, 'category'),
    documentFiles: documents.length,
    documentNonemptyLines: documents.reduce((sum, d) => sum + d.lines.length, 0),
    helpFiles: documents.filter(d => d.role === 'in-game-help').length,
    dynamicSourceCandidates: dynamicSources.length,
    printfOccurrences: records.filter(r => r.formatting.placeholders.some(p => p.kind === 'printf')).length,
    dynamicLiteralOccurrences: records.filter(r => r.dynamicAssembly.requiresMigrationReview).length,
    translatedOccurrences: 0,
    diagnostics: diagnostics.length,
    unscannedFiles: unscannedFiles.length,
  };
  const artifact = {
    schemaVersion: 1,
    source: { repository: 'https://github.com/chaosforgeorg/drl', commit, rootRelativeToPort: path.relative(path.dirname(output), root).replaceAll('\\', '/') },
    method: { offsetUnit: 'UTF-16 code units', lineBase: 1, columnBase: 1, parser: 'Lexical comment-aware scanner plus conservative structural heuristics', includes: ['All .pas/.lpr/.inc/.lua in pristine tree, including old/tool/config/module sources', 'Help/manual/ASCII plus resource/config/structured/support text documents'], excludes: ['.git', 'Binary assets and unrecognized-extension files (explicitly enumerated)', 'External dependency sources absent from this tree'], runtimeTranslation: false, reviewedSemanticIds: false, japaneseCoverageClaimed: false },
    summary, manifest, literals: records, documents, dynamicSources, unscannedFiles, diagnostics,
  };
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'text-inventory.json'), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  const topFiles = [...manifest.filter(f => f.language)].sort((a, b) => b.occurrences - a.occurrences).slice(0, 20);
  const readme = `# DRL source text inventory\n\nSource commit: \`${commit ?? 'unresolved'}\`. This catalog inventories pristine upstream; it does not claim that the Rust port or Japanese localization is complete.\n\nRegenerate from the staged DRL directory with \`node port/tools/inventory-texts.mjs\`. Run scanner tests with \`node --test port/tests/text-inventory.test.mjs\`. Paths can be overridden with \`--source <directory> --out <directory>\`. The script never executes upstream Pascal/Lua and rejects output paths inside upstream.\n\n## Discovery coverage\n\n- ${summary.codeFiles} Pascal/Lua source files, ${summary.literalOccurrences} literal occurrences, ${summary.uniqueLiteralValues} unique decoded values.\n- ${summary.documentFiles} text/help/manual/ASCII/support documents, ${summary.documentNonemptyLines} nonempty lines; ${summary.helpFiles} in-game help files.\n- ${summary.dynamicSourceCandidates} dynamic name/plural/article/format/history source candidates, including calls with no static literal.\n- ${summary.printfOccurrences} literals with printf-style placeholders; ${summary.dynamicLiteralOccurrences} literals flagged for dynamic assembly review.\n- ${summary.diagnostics} lexical/encoding/provenance diagnostics; ${summary.translatedOccurrences} translated occurrences.\n\nAll source files are hashed in the manifest. Every literal includes relative file, one-based line/column, UTF-16 offset/endOffset, exact raw syntax, decoded value, syntax type, context, placeholder candidates, markup candidates, and a structural semantic ID candidate. Comments and Pascal compiler directives are excluded. Pascal doubled quotes and numeric character codes, Lua quoted escapes and arbitrary-equals long brackets are retained. Text documents use line records so titles, key labels, body text and ASCII layouts remain discoverable. Blank lines remain in upstream; line numbers preserve their positions.\n\n## Review queues\n\n| Classification | Occurrences |\n| --- | ---: |\n${Object.entries(summary.classificationCounts).map(([name, count]) => `| ${name} | ${count} |`).join('\n')}\n\n\`user-facing-candidate\` means a likely display field or output API argument, not a proof of display use. \`internal-candidate\` still needs review: identifiers, paths, dice expressions and logs must not be blindly translated. \`ambiguous\` literals are retained, never silently dropped. Empty strings, character literals, spacing, and dynamic concatenations are retained. A given API can mix text, identifier and parameter arguments. Classification and structure are conservative heuristics rather than a full Pascal/Lua AST.\n\nCandidate IDs use file, registry entity (where lexically available), procedure/function or call/key anchors, and an occurrence ordinal. These IDs are **unreviewed**. After review, assign stable meaning-based public IDs; do not expose occurrence ordinals as final localization contracts. Function and call anchors can be imprecise for nested/anonymous functions, chained calls, or complex table construction.\n\nThe \`dynamicSources\` review queue includes \`TItem.GetName/GetExtName/Preposition\`, \`TBeing.GetName/Preposition\`, plural suffix formation in Hall of Fame/mortem records, \`Format\`/\`Emote\` and Lua \`format\`/\`tostring\` constructions. Migrate complete messages with typed parameters, entity-name IDs, Japanese counters/articles/plural rules and grammatical variants; translating string fragments independently cannot preserve grammar. External player/user names must remain parameters. Review all settings, keybindings, help, errors, plots, entity names/descriptions, awards/history and dynamically loaded modules.\n\nDRL markup such as \`{!Escape}\`, \`{rControls}\` and color tags is flagged separately from interpolation. Named braces are candidates requiring formatter review. Percent values such as \`20%\` are not printf arguments. Preserve the exact format specification and typed/positional argument meaning while replacing the formatter with semantic parameters.\n\n## Highest literal counts\n\n| File | Occurrences |\n| --- | ---: |\n${topFiles.map(f => `| \`${f.file}\` | ${f.occurrences} |`).join('\n')}\n\n## Completion requirements\n\n1. Review every record, including ambiguous/internal candidates, and document exclusions by actual role.\n2. Reconcile text-bearing files outside scanned extensions and resources in external Valkyrie/dependency sources; user-created modules require separate catalogs. Binary assets may contain embedded/painted text and need a visual asset audit.\n3. Map complete application/domain events to reviewed semantic IDs and typed parameters. Keep drawing and language lookup independent of deterministic simulation/RNG.\n4. Produce reviewed \`en.json\` and \`ja.json\` with identical IDs and placeholder contracts; measure coverage against the migrated event/API surface and this inventory. No Japanese translations are invented by this discovery step.\n5. Verify Japanese terminology, plural/counter behavior, CJK wrapping, keybinding hints, errors, help, settings and dynamic names in complete browser flows.\n\nSource assets and story names may have different licensing constraints from code. This extraction is an internal engineering catalog; it is not authorization to publish game assets or upstream texts.\n`;
  const knownDynamicNotes = `\n## Concrete dynamic source review\n\n- \`bin/data/core/main.lua\`: \`register_corpse\` appends \`" corpse"\` to a being name; \`register_being\` supplies \`name_plural = name .. "s"\` and a default \`"ranged attack"\` natural weapon name. These defaults need language-specific semantic constructions.\n- The same core registration code builds class badge names/descriptions and Bronze/Silver/Gold/Platinum/Diamond badge names. Preserve identifiers while translating displayed tier/name composition.\n- \`bin/data/drl/main.lua\` and core mortem/history functions construct episode/floor/chapter names and death/result descriptions. DRL \`@1\`, \`@2\` history substitutions are inventoried as positional parameter candidates, independently of color markup.\n- \`src/dfbeing.pas\`: \`GetWoundStatus\`, \`Emote\`, \`Fail\`, \`GetName\`, and \`Preposition\`; \`src/dfitem.pas\`: \`GetName\`, \`GetExtName\`, \`Description\`, and \`Preposition\`; \`src/dfhof.pas\`: plural suffixes and paged report composition.\n- \`bin/config.lua\` message wildcards can make behavior depend on English text. Port behavior must use event/semantic IDs and matching rules, with a documented migration for user configuration.\n- Upstream uses \`AnsiString\`, byte-length/cell assumptions, and CP437/VTIG control markup. Japanese requires Unicode text, measured CJK display cells/wrapping, and explicit separation of markup from display strings.\n\nThese are engineering findings from actual source review, not a claim that all runtime constructions are already migrated or translated.\n`;
  await writeFile(path.join(output, 'README.md'), readme + knownDynamicNotes, 'utf8');
  return { output, commit, summary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const args = process.argv.slice(2);
  const valueFor = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  const result = await generateInventory(valueFor('--source') ?? defaultRoot, valueFor('--out') ?? defaultOutput);
  console.log(JSON.stringify(result, null, 2));
}
