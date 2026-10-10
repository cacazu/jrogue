// DCSS migration audit tool, added 2026-10-02. GPL-2.0-or-later.
// This reads source as data. It does not execute upstream scripts or generate translations.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstream = path.resolve(process.argv[2] || path.join(root, 'upstream'));
const out = path.resolve(process.argv[3] || path.join(root, 'docs', 'inventory'));
fs.mkdirSync(out, { recursive: true });
// Fail fast instead of allowing concurrent runs to overwrite each other's raw
// streams. A force-killed run may leave this file; inspect its PID before removal.
const lockPath = path.join(out, '.inventory.lock');
const lock = fs.openSync(lockPath, 'wx');
fs.writeSync(lock, JSON.stringify({ pid: process.pid, purpose: 'DCSS source inventory' }));
fs.closeSync(lock);
process.on('exit', () => { try { fs.unlinkSync(lockPath); } catch {} });
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${upstream.replaceAll('\\', '/')}`, '-C', upstream, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const tree = git('ls-tree', '-r', 'HEAD').split('\n').map(line => {
  const match = /^(\d+) (\w+) ([0-9a-f]+)\t(.*)$/.exec(line);
  if (!match) throw new Error(`Unexpected tree row ${line}`);
  return { mode: match[1], kind: match[2], git_object: match[3], path: match[4] };
});
const resources = new Set(['.txt', '.yaml', '.yml', '.des', '.rst', '.md', '.html', '.rc']);
const code = new Set(['.cc', '.h', '.c', '.cpp', '.hpp', '.m']);
const script = new Set(['.lua', '.js', '.py', '.pl']);
const files = [];
const counts = { cpp_literals: 0, script_literals: 0, resource_lines: 0, database_blocks: 0, likely_player_text: 0 };
const handles = {};
for (const kind of ['cpp-literals', 'script-literals', 'resource-lines', 'database-blocks']) handles[kind] = fs.openSync(path.join(out, `${kind}.jsonl`), 'w');
function emit(kind, source, offset, line, text, raw, extra = {}) {
  const likely = /[A-Za-z]{2,}/.test(text) && (/[ \t][A-Za-z]{2,}/.test(text) || /[.!?]$/.test(text));
  const row = {
    discovery_id: sha(`${source}\0${offset}\0${kind}`).slice(0, 20),
    source, line, offset, text, raw,
    classification: likely ? 'likely_player_text_needs_review' : 'identifier_or_fragment_needs_review',
    printf_placeholders: [...text.matchAll(/%(?:\d+\$)?[-+#0 ]*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|ll|[hljztL])?[diuoxXfFeEgGaAcspn%]/g)].map(x => x[0]),
    ...extra,
  };
  fs.writeSync(handles[kind], JSON.stringify(row) + '\n');
  counts[kind.replaceAll('-', '_')]++;
  if (likely) counts.likely_player_text++;
}
function decodeC(raw) {
  return raw.replace(/\\(?:x([0-9a-fA-F]+)|([0-7]{1,3})|([\\"'nrtabfv?])|\r?\n)/g, (m, hex, oct, ch) => {
    if (hex || oct) return String.fromCodePoint(parseInt(hex || oct, hex ? 16 : 8));
    const simple = { n: '\n', r: '\r', t: '\t', a: '\x07', b: '\b', f: '\f', v: '\v' };
    return ch ? (simple[ch] ?? ch) : '';
  });
}
// Lex every C/C++ string, excluding comments and character literals. Concatenated
// literals retain separate occurrence records, with the adjacent source context.
function cppStrings(source, content) {
  let i = 0, line = 1;
  const advance = n => { line += (content.slice(i, i + n).match(/\n/g) || []).length; i += n; };
  while (i < content.length) {
    if (content.startsWith('//', i)) { const end = content.indexOf('\n', i); advance((end < 0 ? content.length : end) - i); continue; }
    if (content.startsWith('/*', i)) { const end = content.indexOf('*/', i + 2); advance((end < 0 ? content.length : end + 2) - i); continue; }
    const rawMatch = /^(?:u8|u|U|L)?R"([^ ()\\\t\r\n]{0,16})\(/.exec(content.slice(i, i + 24));
    if (rawMatch) {
      const start = i, startLine = line, begin = i + rawMatch[0].length, endMarker = `)${rawMatch[1]}"`;
      const end = content.indexOf(endMarker, begin);
      if (end < 0) throw new Error(`Unclosed raw literal ${source}:${line}`);
      emit('cpp-literals', source, start, startLine, content.slice(begin, end), content.slice(start, end + endMarker.length), { literal_kind: 'raw', context: content.slice(Math.max(0, start - 100), Math.min(content.length, end + endMarker.length + 100)) });
      advance(end + endMarker.length - i); continue;
    }
    const prefix = /^(?:u8|u|U|L)?"/.exec(content.slice(i, i + 4));
    if (prefix) {
      const start = i, startLine = line, begin = i + prefix[0].length;
      let end = begin;
      while (end < content.length && content[end] !== '"') { if (content[end] === '\\') end++; end++; }
      if (end >= content.length) throw new Error(`Unclosed string literal ${source}:${line}`);
      const raw = content.slice(begin, end);
      emit('cpp-literals', source, start, startLine, decodeC(raw), content.slice(start, end + 1), { literal_kind: 'quoted', context: content.slice(Math.max(0, start - 100), Math.min(content.length, end + 101)) });
      advance(end + 1 - i); continue;
    }
    if (content[i] === "'") {
      let end = i + 1;
      while (end < content.length && content[end] !== "'" && content[end] !== '\n') { if (content[end] === '\\') end++; end++; }
      advance(Math.min(content.length, end + 1) - i); continue;
    }
    advance(1);
  }
}
function scriptStrings(source, content) {
  // Conservative lexical candidates include quoted source comments too. This
  // deliberately over-collects; it does not claim parser-level completeness.
  const pattern = /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|\[(=*)\[[\s\S]*?\]\1\]/g;
  let previous = 0, line = 1;
  for (const match of content.matchAll(pattern)) {
    line += (content.slice(previous, match.index).match(/\n/g) || []).length;
    const raw = match[0], long = raw.startsWith('[');
    const text = long ? raw.replace(/^\[=*\[/, '').replace(/\]=*\]$/, '') : raw.slice(1, -1);
    emit('script-literals', source, match.index, line, text, raw, { extraction: 'conservative_regex_not_language_parser' });
    previous = match.index;
  }
}
function resourceLines(source, content) {
  let offset = 0, line = 1;
  for (const raw of content.split(/(?<=\n)/)) {
    const text = raw.replace(/\r?\n$/, '');
    // Hash-prefixed lines can be comments, Markdown headings or player-visible
    // help examples. Retain them for review rather than silently losing text.
    if (text.trim()) emit('resource-lines', source, offset, line, text, raw, { hash_comment_or_heading_candidate: /^\s*#/.test(text) });
    offset += raw.length; line++;
  }
}
function databaseBlocks(source, content) {
  const delimiter = /^%%%%\s*$/gm;
  const positions = [...content.matchAll(delimiter)].map(m => ({ start: m.index, end: m.index + m[0].length }));
  for (let i = 0; i < positions.length; i++) {
    const begin = positions[i].end, end = positions[i + 1]?.start ?? content.length;
    const raw = content.slice(begin, end), useful = raw.split(/\r?\n/).filter(x => x.trim() && !/^\s*#/.test(x));
    if (!useful.length) continue;
    const key = useful[0], text = useful.slice(1).join('\n');
    const line = (content.slice(0, begin).match(/\n/g) || []).length + 1;
    emit('database-blocks', source, begin, line, text, raw, { lookup_key: key, lookup_key_is_not_translation: true });
  }
}
for (const row of tree) {
  if (row.kind !== 'blob') continue;
  const local = path.join(upstream, row.path);
  const data = fs.readFileSync(local);
  files.push({ ...row, bytes: data.length, sha256: sha(data) });
  if (row.path.startsWith('crawl-ref/source/contrib/')) continue;
  const ext = path.extname(row.path).toLowerCase();
  const content = data.toString('utf8');
  if (code.has(ext)) cppStrings(row.path, content);
  else if (script.has(ext)) scriptStrings(row.path, content);
  else if (resources.has(ext)) resourceLines(row.path, content);
  if (/crawl-ref\/source\/dat\/(database|descript)\/.*\.txt$/.test(row.path)) databaseBlocks(row.path, content);
}
for (const handle of Object.values(handles)) fs.closeSync(handle);
const dependencyFiles = [];
const submodules = tree.filter(x => x.kind === 'commit').map(row => {
  const directory = path.join(upstream, row.path);
  const populated = fs.existsSync(path.join(directory, '.git'));
  const local_files_present = fs.readdirSync(directory).some(x => x !== '.git');
  if (!populated || !local_files_present) return { ...row, populated, local_files_present };
  const subgit = (...args) => execFileSync('git', ['-c', `safe.directory=${directory.replaceAll('\\', '/')}`, '-C', directory, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
  const actual_commit = subgit('rev-parse', 'HEAD');
  const subTree = subgit('ls-tree', '-r', 'HEAD').split('\n').map(line => {
    const m = /^(\d+) (\w+) ([0-9a-f]+)\t(.*)$/.exec(line);
    if (!m) throw new Error(`Unexpected dependency tree row ${line}`);
    if (m[2] !== 'blob') throw new Error(`Nested gitlink requires audit: ${row.path}/${m[4]}`);
    const data = fs.readFileSync(path.join(directory, m[4]));
    return { module: row.path, path: `${row.path}/${m[4]}`, mode: m[1], git_object: m[3], bytes: data.length, sha256: sha(data) };
  });
  dependencyFiles.push(...subTree);
  return { ...row, populated, local_files_present, actual_commit, pin_verified: actual_commit === row.git_object, tracked_files: subTree.length, tracked_bytes: subTree.reduce((sum, x) => sum + x.bytes, 0), worktree_clean: !subgit('status', '--porcelain') };
});
const read = p => fs.readFileSync(path.join(upstream, p), 'utf8');
const yaml = folder => tree.filter(x => x.kind === 'blob' && x.path.startsWith(`crawl-ref/source/dat/${folder}/`) && x.path.endsWith('.yaml')).map(x => {
  const content = read(x.path);
  return { source: x.path, deprecated: path.basename(x.path).startsWith('deprecated-'), fields: Object.fromEntries(['enum', 'name', 'short_name', 'difficulty', 'monster', 'category', 'talisman'].flatMap(field => { const m = new RegExp(`^${field}:\\s*(.*?)\\s*$`, 'm').exec(content); return m ? [[field, m[1].replace(/^"(.*)"$/, '$1')]] : []; })) };
});
const enumTokens = (p, prefix) => ({ source: p, caveat: 'lexical tokens include sentinels, historical compatibility and conditional branches; not an active gameplay count', tokens: [...new Set(read(p).match(new RegExp(`\\b${prefix}[A-Z0-9_]+\\b`, 'g')) || [])] });
const features = {
  schema_version: 1,
  species: yaml('species'), jobs: yaml('jobs'), monsters: yaml('mons'), forms: yaml('forms'),
  commands: enumTokens('crawl-ref/source/command-type.h', 'CMD_'),
  gods: enumTokens('crawl-ref/source/god-type.h', 'GOD_'),
  branches: enumTokens('crawl-ref/source/branch-type.h', 'BRANCH_'),
  abilities: enumTokens('crawl-ref/source/ability-type.h', 'ABIL_'),
  spells: enumTokens('crawl-ref/source/spell-type.h', 'SPELL_'),
  mutations: enumTokens('crawl-ref/source/mutation-type.h', 'MUT_'),
  skills: enumTokens('crawl-ref/source/skill-type.h', 'SK_'),
  statuses: enumTokens('crawl-ref/source/duration-type.h', 'DUR_'),
  vaults: tree.filter(x => x.kind === 'blob' && x.path.startsWith('crawl-ref/source/dat/des/') && x.path.endsWith('.des')).map(x => ({ source: x.path })),
};
const summary = {
  schema_version: 1, generated_by: 'tools/inventory.mjs', upstream_repository: 'https://github.com/crawl/crawl',
  upstream_commit: git('rev-parse', 'HEAD'), tracked_files: files.length,
  tracked_bytes: files.reduce((sum, x) => sum + x.bytes, 0), counts,
  dependency_tracked_files: dependencyFiles.length,
  dependency_tracked_bytes: dependencyFiles.reduce((sum, x) => sum + x.bytes, 0),
  superproject_worktree_clean: !git('status', '--porcelain'),
  submodules,
  feature_counts: Object.fromEntries(Object.entries(features).filter(([k]) => k !== 'schema_version').map(([k, v]) => [k, Array.isArray(v) ? v.length : v.tokens.length])),
  completeness: {
    source_tree: 'Every tracked superproject blob is hashed; submodule contents are separate repositories and excluded from lexical inventory.',
    cpp: 'All non-comment C/C++ quoted/raw literal occurrences in tracked code files; includes fragments, identifiers and inactive historical branches. No AST or UI reachability proof.',
    scripts: 'Conservative regex quote and Lua long-string inventory; not a parser and can include comments or miss interpolation semantics.',
    resources: 'All nonempty lines in selected text resource extensions, including hash comments/headings, plus full %%%% database blocks. Includes machine directives and map rows.',
    localization: 'Discovery IDs are source-location fingerprints, not semantic text IDs. Zero upstream strings have been reviewed or translated by this inventory.',
    excluded: 'Dependency source contents, binary art/fonts, generated runtime text, compiled-only preprocessing expansions, formatting behavior, and actual gameplay path coverage.',
  },
};
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'submodule-files.json'), JSON.stringify(dependencyFiles, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'features.json'), JSON.stringify(features, null, 2) + '\n');
summary.artifacts = [];
for (const kind of Object.keys(handles)) {
  const filename = `${kind}.jsonl`, rawPath = path.join(out, filename);
  const raw = fs.readFileSync(rawPath), compressed = gzipSync(raw, { level: 9 });
  fs.writeFileSync(`${rawPath}.gz`, compressed);
  fs.unlinkSync(rawPath);
  summary.artifacts.push({ file: `${filename}.gz`, rows: counts[kind.replaceAll('-', '_')], bytes: compressed.length, uncompressed_bytes: raw.length, sha256: sha(compressed), uncompressed_sha256: sha(raw) });
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
