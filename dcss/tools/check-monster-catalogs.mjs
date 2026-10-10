// Added 2026-10-02. GPL-2.0-or-later. Reads pinned upstream data; executes none.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const toolPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(toolPath), '..');
export const pinnedCommit = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sorted = values => [...values].sort();

function requireCondition(condition, reason) {
  if (!condition) throw new Error(reason);
}

function gitHead(upstream) {
  let gitDirectory = path.join(upstream, '.git');
  if (fs.statSync(gitDirectory).isFile()) {
    const pointer = fs.readFileSync(gitDirectory, 'utf8').trim();
    requireCondition(pointer.startsWith('gitdir: '), 'invalid upstream Git directory pointer');
    gitDirectory = path.resolve(upstream, pointer.slice(8));
  }
  const head = fs.readFileSync(path.join(gitDirectory, 'HEAD'), 'utf8').trim();
  if (/^[0-9a-f]{40}$/.test(head)) return head;
  requireCondition(head.startsWith('ref: '), 'unsupported upstream HEAD');
  const reference = head.slice(5);
  requireCondition(/^refs\/[A-Za-z0-9_./-]+$/.test(reference) && !reference.includes('..'), 'invalid upstream HEAD reference');
  const loosePath = path.join(gitDirectory, reference);
  if (fs.existsSync(loosePath)) return fs.readFileSync(loosePath, 'utf8').trim();
  const packed = fs.readFileSync(path.join(gitDirectory, 'packed-refs'), 'utf8');
  const row = packed.split(/\r?\n/).find(line => line.endsWith(` ${reference}`));
  requireCondition(row, `unresolved upstream HEAD reference: ${reference}`);
  return row.split(' ')[0];
}

// Parse only the top-level scalar/list forms used for names and classification
// in this pinned dataset. This is not a YAML parser or a gameplay-data importer.
function scalar(raw, context) {
  raw = raw.trim();
  requireCondition(raw.length > 0, `${context}: empty scalar`);
  if (raw.startsWith('"')) {
    let end = 1;
    while (end < raw.length) {
      if (raw[end] === '\\') { end += 2; continue; }
      if (raw[end] === '"') break;
      end++;
    }
    requireCondition(end < raw.length && /^(?:\s*#.*)?$/.test(raw.slice(end + 1)), `${context}: unsupported quoted scalar`);
    const value = JSON.parse(raw.slice(0, end + 1));
    requireCondition(typeof value === 'string', `${context}: scalar must be text`);
    return value;
  }
  if (raw.startsWith("'")) {
    const quoted = /^'((?:[^']|'')*)'(?:\s*#.*)?$/.exec(raw);
    requireCondition(quoted, `${context}: unsupported single-quoted scalar`);
    return quoted[1].replaceAll("''", "'");
  }
  const value = raw.replace(/\s+#.*$/, '').trim();
  requireCondition(/^[A-Za-z0-9_ -]+$/.test(value), `${context}: unsupported plain scalar`);
  return value;
}

function nameFields(text, source) {
  const fields = new Map();
  const relevant = new Set(['enum', 'name', 'genus', 'flags']);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const row = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (!row || !relevant.has(row[1])) continue;
    requireCondition(!fields.has(row[1]), `${source}:${index + 1}: duplicate ${row[1]}`);
    let value;
    if (row[1] === 'flags') {
      const flags = /^\[([a-z_, ]*)\](?:\s*#.*)?$/.exec(row[2].trim());
      requireCondition(flags, `${source}:${index + 1}: unsupported flags list`);
      value = flags[1].trim() ? flags[1].split(',').map(flag => flag.trim()) : [];
      requireCondition(value.every(flag => /^[a-z_]+$/.test(flag)), `${source}:${index + 1}: invalid flag`);
    } else value = scalar(row[2], `${source}:${index + 1}`);
    fields.set(row[1], { value, line: index + 1 });
  }
  requireCondition(fields.has('name'), `${source}: missing display name`);
  return fields;
}

// Evaluate only the TAG_MAJOR_VERSION conditions present in monster-type.h.
// Preserve original line numbers and reject unsupported conditional syntax.
function monsterEnums(text, tagMajorVersion) {
  let active = true;
  let inEnum = false;
  const stack = [];
  const records = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (/^enum monster_type\b/.test(line)) inEnum = true;
    if (!inEnum) continue;
    const condition = /^#if TAG_MAJOR_VERSION (==|>) (\d+)\s*$/.exec(line);
    if (condition) {
      const test = condition[1] === '=='
        ? tagMajorVersion === Number(condition[2])
        : tagMajorVersion > Number(condition[2]);
      stack.push({ parent: active, test, elseSeen: false });
      active = active && test;
    } else if (/^#else\s*$/.test(line)) {
      requireCondition(stack.length && !stack.at(-1).elseSeen, `monster-type.h:${index + 1}: invalid #else`);
      stack.at(-1).elseSeen = true;
      active = stack.at(-1).parent && !stack.at(-1).test;
    } else if (/^#endif\s*$/.test(line)) {
      requireCondition(stack.length, `monster-type.h:${index + 1}: unmatched #endif`);
      active = stack.pop().parent;
    } else {
      requireCondition(!/^#/.test(line), `monster-type.h:${index + 1}: unsupported preprocessor directive`);
      if (!active) continue;
      if (/^\s+NUM_MONSTERS\s*,/.test(line)) {
        requireCondition(stack.length === 0, 'NUM_MONSTERS appears inside an unresolved compatibility condition');
        requireCondition(records.length > 0, 'no real monster enum identities found');
        requireCondition(new Set(records.map(record => record.identity)).size === records.length, 'duplicate active monster enum identity');
        return records;
      }
      const row = /^\s+(MONS_[A-Z_0-9]+)\s*,(?:\s*\/\/\s*(.*))?$/.exec(line);
      if (row) records.push({ identity: row[1], line: index + 1, comment: row[2] ?? '' });
      else requireCondition(!/^\s+MONS_/.test(line) || /^\s+MONS_[A-Z_0-9]+\s*=/.test(line), `monster-type.h:${index + 1}: unsupported enum declaration`);
    }
  }
  throw new Error('monster-type.h: missing NUM_MONSTERS boundary');
}

function namingPolicy(identity) {
  if (identity === 'MONS_PLAYER_GHOST' || identity === 'MONS_PLAYER_ILLUSION')
    return 'base_name_only_external_player_identity_untranslated';
  if (identity === 'MONS_PANDEMONIUM_LORD')
    return 'base_name_only_generated_identity_untranslated';
  if (identity === 'MONS_PLAYER') return 'base_name_only_player_identity_untranslated';
  return 'base_name_only';
}

function fixedNamingConstants(monUtilCode, monsterCode) {
  const constants = [];
  const append = (identity, stem, source, code, match, grammaticalForm) => {
    requireCondition(match, `${source}: missing fixed naming constant ${identity}`);
    const name = JSON.parse(match[1]);
    requireCondition(name.length > 0 && !/[{}\r\n]/.test(name), `${identity}: unsupported naming constant`);
    const literalOffset = match.index + match[0].indexOf(match[1]);
    constants.push({ kind: 'monster_naming_constant', identity, name,
      name_id: `monster.naming.${stem}.name`, source,
      line: code.slice(0, literalOffset).split('\n').length,
      grammatical_form: grammaticalForm, parameters: {} });
  };
  for (const [identity, stem] of [
    ['RANDOM_MONSTER', 'random_monster'], ['RANDOM_DRACONIAN', 'random_draconian'],
    ['RANDOM_BASE_DRACONIAN', 'random_base_draconian'], ['RANDOM_NONBASE_DRACONIAN', 'random_nonbase_draconian'],
    ['WANDERING_MONSTER', 'wandering_monster'],
  ]) {
    const expression = new RegExp(`case ${identity}:\\s*result \\+=\\s*("(?:[^"\\\\]|\\\\.)*");\\s*return result;`, 'g');
    const matches = [...monUtilCode.matchAll(expression)];
    requireCondition(matches.length === 1, `mon-util.cc: ambiguous fixed naming identity ${identity}`);
    append(identity, stem, 'crawl-ref/source/mon-util.cc', monUtilCode, matches[0], 'base');
  }
  const begin = monsterCode.indexOf('if (!force_seen && !mon.observable())');
  const end = monsterCode.indexOf('if (desc == DESC_DBNAME)', begin);
  requireCondition(begin >= 0 && end > begin, 'monster.cc: missing unobserved naming branch');
  const branch = monsterCode.slice(begin, end);
  for (const [identity, stem, literal, grammaticalForm] of [
    ['UNOBSERVED', 'unobserved', '"something"', 'base'],
    ['UNOBSERVED_POSSESSIVE', 'unobserved_possessive', '"something\'s"', 'possessive'],
    ['UNOBSERVED_INVALID_DESCRIPTION', 'unobserved_invalid_description', '"it (buggy)"', 'diagnostic'],
  ]) {
    const literalOffset = branch.indexOf(`return ${literal};`);
    requireCondition(literalOffset >= 0 && branch.indexOf(`return ${literal};`, literalOffset + 1) === -1,
      `monster.cc: missing or ambiguous unobserved naming constant ${identity}`);
    const match = { 0: `return ${literal};`, 1: literal, index: begin + literalOffset };
    append(identity, stem, 'crawl-ref/source/monster.cc', monsterCode, match, grammaticalForm);
  }
  return constants.sort((a, b) => a.name_id.localeCompare(b.name_id, 'en'));
}

/** Read all real tag-34 monster base names, retaining compatibility identities. */
export function collectMonsterSource(root = defaultRoot, archiveMode = false) {
  const upstream = path.join(root, 'upstream');
  // Archive mode is explicit: archives do not normally contain upstream .git.
  // Source-byte equality with the pinned manifest is still checked by check().
  const commit = archiveMode
    ? JSON.parse(fs.readFileSync(path.join(root, 'locales', 'entities', 'monsters-source-map.json'), 'utf8')).commit
    : gitHead(upstream);
  requireCondition(commit === pinnedCommit, `source commit differs from the selected 0.34.1 commit: ${commit}`);
  const files = new Map();
  const read = source => {
    const bytes = fs.readFileSync(path.join(upstream, ...source.split('/')));
    files.set(source, { path: source, sha256: hash(bytes) });
    return bytes.toString('utf8');
  };
  const generatorSource = 'crawl-ref/source/util/mon-gen.py';
  const generator = read(generatorSource);
  requireCondition(generator.includes("self['enum'] = \"MONS_\" + self['name'].upper().replace(\" \", \"_\")")
    && generator.includes("'enum': Field(lambda s: \"MONS_\" + s.upper())"), 'upstream monster enum generation rules changed');
  read('crawl-ref/source/util/mon-gen/body.txt');
  read('crawl-ref/source/util/mon-gen/footer.txt');
  const tagVersion = read('crawl-ref/source/tag-version.h');
  const tagDefinition = /^#define TAG_MAJOR_VERSION (\d+)$/m.exec(tagVersion);
  requireCondition(tagDefinition && Number(tagDefinition[1]) === 34, 'pinned source does not default to TAG_MAJOR_VERSION 34');
  const enums = monsterEnums(read('crawl-ref/source/monster-type.h'), Number(tagDefinition[1]));
  // These hashes bind the scope/naming policies to the actual name composition
  // and ghost identity sources, without claiming their fragments are translated.
  const monsterCode = read('crawl-ref/source/monster.cc');
  const infoCode = read('crawl-ref/source/mon-info.cc');
  const monUtilCode = read('crawl-ref/source/mon-util.cc');
  requireCondition(monsterCode.includes('mname = ghost->name;')
    && infoCode.includes('s = apostrophise(mname) + " ghost";')
    && infoCode.includes('s = apostrophise(mname) + " illusion";'), 'upstream external player naming rules changed');
  const records = [];
  const metadata = new Map();
  const directory = path.join(upstream, 'crawl-ref', 'source', 'dat', 'mons');
  const filenames = fs.readdirSync(directory).filter(name => name.endsWith('.yaml')).sort();
  requireCondition(filenames.length > 0, 'no original monster YAML files found');
  for (const filename of filenames) {
    const source = `crawl-ref/source/dat/mons/${filename}`;
    const fields = nameFields(read(source), source);
    const name = fields.get('name').value;
    // This reproduces mon-gen.py, including the explicit overrides that share
    // a display name (e.g. Bai Suzhen and the four Serpents of Hell).
    const identity = `MONS_${fields.has('enum') ? fields.get('enum').value.toUpperCase() : name.toUpperCase().replaceAll(' ', '_')}`;
    requireCondition(/^MONS_[A-Z_]+$/.test(identity), `${source}: invalid generated enum identity`);
    requireCondition(name.trim().length > 0 && !/[{}\r\n]/.test(name), `${source}: unsupported base display name`);
    const genus = fields.has('genus') ? `MONS_${fields.get('genus').value.toUpperCase()}` : null;
    metadata.set(identity, { flags: fields.get('flags')?.value ?? [], genus });
    records.push({ kind: 'monster', identity, name, name_id: `monster.${identity.toLowerCase()}.name`,
      source, line: fields.get('name').line, status: 'current', tag_major_version: null,
      naming_policy: namingPolicy(identity), grammatical_form: 'base', parameters: {} });
  }
  const historySource = 'crawl-ref/source/util/mon-gen/header.txt';
  const history = read(historySource);
  const gate = /^#if TAG_MAJOR_VERSION == (\d+)$/m.exec(history);
  requireCondition(gate && Number(gate[1]) === 34, `${historySource}: missing tag-34 compatibility gate`);
  requireCondition(history.includes('id, \'X\', LIGHTRED, "removed " name,'), `${historySource}: compatibility name prefix changed`);
  const declared = history.split(/\r?\n/).filter(line => /^\s+AXED_MON\(/.test(line));
  const matches = [...history.matchAll(/^[ \t]+AXED_MON\((MONS_[A-Z_]+),[ \t]*("(?:[^"\\]|\\.)*")\)[ \t]*\r?$/gm)];
  requireCondition(matches.length === declared.length && matches.length > 0, `${historySource}: unsupported compatibility name syntax`);
  for (const match of matches) {
    const identity = match[1];
    records.push({ kind: 'monster', identity, name: `removed ${JSON.parse(match[2])}`,
      name_id: `monster.${identity.toLowerCase()}.name`, source: historySource,
      line: history.slice(0, match.index).split('\n').length,
      status: 'deprecated_compatibility', tag_major_version: Number(gate[1]), naming_policy: 'base_name_only',
      grammatical_form: 'base', parameters: {} });
  }
  const enumMetadata = new Map(enums.map(record => [record.identity, record]));
  assert.deepEqual(sorted(records.map(record => record.identity)), sorted(enumMetadata.keys()),
    'original names must cover every real monster enum identity exactly once');
  requireCondition(new Set(records.map(record => record.identity)).size === records.length, 'duplicate monster source identity');
  for (const record of records) {
    if (record.status === 'deprecated_compatibility') continue;
    const detail = metadata.get(record.identity);
    const comment = enumMetadata.get(record.identity).comment;
    const referencedAsGenus = [...metadata.values()].some(other => other.genus === record.identity);
    if (/\bgenus\b/.test(comment) || detail.flags.includes('cant_spawn') && referencedAsGenus)
      record.status = 'current_genus';
    else if (/\bdummy\b|player species only/.test(comment) || /^MONS_SENSED(?:_|$)/.test(record.identity)
      || record.identity === 'MONS_PROGRAM_BUG' || record.identity === 'MONS_PLAYER')
      record.status = 'current_category_placeholder';
    else if (/^MONS_TEST_/.test(record.identity)) record.status = 'current_debug';
    else if (detail.flags.includes('cant_spawn')) record.status = 'current_nonspawning';
  }
  records.sort((a, b) => a.name_id.localeCompare(b.name_id, 'en'));
  return { schema_version: 1, release: '0.34.1', commit,
    source_files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')), records,
    naming_constants: fixedNamingConstants(monUtilCode, monsterCode) };
}

/** Parse a flat monster-name catalog, rejecting duplicate JSON keys. */
export function parseMonsterCatalog(text, label = 'monster catalog') {
  let position = 0;
  const whitespace = () => { while (position < text.length && /\s/.test(text[position])) position++; };
  const string = () => {
    whitespace();
    requireCondition(text[position] === '"', `${label}: expected a JSON string at ${position}`);
    const begin = position++;
    while (position < text.length) {
      if (text[position] === '\\') { position += 2; continue; }
      if (text[position++] === '"') return JSON.parse(text.slice(begin, position));
    }
    throw new Error(`${label}: unterminated JSON string`);
  };
  whitespace();
  requireCondition(text[position++] === '{', `${label}: expected a flat JSON object`);
  const catalog = Object.create(null);
  whitespace();
  if (text[position] !== '}') {
    while (true) {
      const key = string();
      requireCondition(!Object.hasOwn(catalog, key), `${label}: duplicate key ${key}`);
      requireCondition(/^monster\.(?:mons_[a-z_]+|naming\.[a-z_]+)\.name$/.test(key), `${label}: invalid semantic ID ${key}`);
      whitespace();
      requireCondition(text[position++] === ':', `${label}: missing colon for ${key}`);
      catalog[key] = string();
      requireCondition(catalog[key].trim().length > 0, `${label}: empty value for ${key}`);
      whitespace();
      if (text[position] === '}') break;
      requireCondition(text[position++] === ',', `${label}: missing comma after ${key}`);
    }
  }
  requireCondition(text[position++] === '}', `${label}: missing object terminator`);
  whitespace();
  requireCondition(position === text.length, `${label}: trailing content`);
  return catalog;
}

function placeholders(text, context) {
  const found = new Set();
  for (let position = 0; position < text.length; position++) {
    if (text[position] === '{') {
      const end = text.indexOf('}', position + 1);
      requireCondition(end > position && /^[a-z][a-z0-9_]*$/.test(text.slice(position + 1, end)), `${context}: malformed placeholder`);
      found.add(text.slice(position + 1, end));
      position = end;
    } else requireCondition(text[position] !== '}', `${context}: unmatched closing brace`);
  }
  return sorted(found);
}

/** Validate exact source English, complete bilingual IDs, and empty parameter sets. */
export function validateMonsterPair(records, en, ja) {
  const expected = sorted(records.map(record => record.name_id));
  assert.deepEqual(sorted(Object.keys(en)), expected, 'English monster IDs differ from exact source identities');
  assert.deepEqual(sorted(Object.keys(ja)), expected, 'Japanese monster IDs differ from exact source identities');
  for (const record of records) {
    requireCondition(typeof en[record.name_id] === 'string' && typeof ja[record.name_id] === 'string', `${record.name_id}: names must be text`);
    requireCondition(en[record.name_id] === record.name, `${record.name_id}: English name differs from original source`);
    requireCondition(/[\u3040-\u30ff\u3400-\u9fff]/u.test(ja[record.name_id]), `${record.name_id}: Japanese base name is not translated`);
    assert.deepEqual(placeholders(en[record.name_id], record.name_id), placeholders(ja[record.name_id], record.name_id),
      `${record.name_id}: bilingual placeholders differ`);
    assert.deepEqual(placeholders(en[record.name_id], record.name_id), [], `${record.name_id}: base names take no interpolation parameters`);
  }
}

/** A disconnected identity lookup; external player text is preserved verbatim. */
export function resolveMonsterName(catalogs, descriptor, language = 'ja') {
  requireCondition(language === 'ja' || language === 'en', 'unsupported monster display language');
  requireCondition(descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor), 'invalid monster name descriptor');
  if (descriptor.kind === 'external_player') {
    assert.deepEqual(sorted(Object.keys(descriptor)), ['kind', 'value'], 'external player descriptor has unexpected fields');
    requireCondition(typeof descriptor.value === 'string', 'external player name must be text');
    return descriptor.value;
  }
  assert.deepEqual(sorted(Object.keys(descriptor)), ['identity', 'kind'], 'monster descriptor has unexpected fields');
  requireCondition(descriptor.kind === 'monster', 'unsupported monster name kind');
  requireCondition(typeof descriptor.identity === 'string' && /^MONS_[A-Z_]+$/.test(descriptor.identity), 'invalid monster identity');
  const id = `monster.${descriptor.identity.toLowerCase()}.name`;
  requireCondition(Object.hasOwn(catalogs[language], id), `missing monster name ID: ${id}`);
  return catalogs[language][id];
}

function selfTest(source, catalogs) {
  const records = source.records;
  const allRecords = [...records, ...source.naming_constants];
  const find = identity => records.find(record => record.identity === identity);
  assert.equal(find('MONS_NAMELESS_REVENANT').name, 'Nobody');
  assert.equal(find('MONS_FROG').name, 'giant frog');
  assert.equal(find('MONS_BAI_SUZHEN').name, find('MONS_BAI_SUZHEN_DRAGON').name);
  assert.notEqual(find('MONS_BAI_SUZHEN').name_id, find('MONS_BAI_SUZHEN_DRAGON').name_id);
  assert.equal(find('MONS_GIANT_COCKROACH').name, 'removed giant cockroach');
  assert.equal(resolveMonsterName(catalogs, { kind: 'monster', identity: 'MONS_ADDER' }, 'en'), 'adder');
  const external = 'Alice \u732b <img onerror=evil()> {name}';
  assert.equal(resolveMonsterName(catalogs, { kind: 'external_player', value: external }), external);
  assert.throws(() => resolveMonsterName(catalogs, { kind: 'monster', identity: 'adder' }));
  assert.throws(() => resolveMonsterName(catalogs, { kind: 'monster', identity: { toString: () => 'MONS_ADDER' } }));
  assert.throws(() => resolveMonsterName(catalogs, { kind: 'monster', identity: 'MONS_ADDER', count: 2 }));
  assert.throws(() => resolveMonsterName(catalogs, { kind: 'monster', identity: 'MONS_UNKNOWN' }));
  assert.throws(() => parseMonsterCatalog('{"monster.mons_adder.name":"adder","monster.mons_adder.name":"adder"}'));
  assert.throws(() => parseMonsterCatalog('{"monster.mons_adder.name":null}'));
  assert.throws(() => parseMonsterCatalog('{"monster.mons_adder.name":"adder",}'));
  const sample = find('MONS_ADDER');
  assert.throws(() => validateMonsterPair(allRecords, { ...catalogs.en, [sample.name_id]: 'Wrong source name' }, catalogs.ja));
  assert.throws(() => validateMonsterPair(allRecords, catalogs.en, { ...catalogs.ja, [sample.name_id]: '\u30d8\u30d3 {n}' }));
  const missing = { ...catalogs.ja };
  delete missing[sample.name_id];
  assert.throws(() => validateMonsterPair(allRecords, catalogs.en, missing));
  assert.throws(() => validateMonsterPair(allRecords, catalogs.en, { ...catalogs.ja, 'monster.mons_unknown.name': '不明' }));
  assert.equal(source.naming_constants.length, 8);
  assert.equal(catalogs.en['monster.naming.unobserved_possessive.name'], "something's");
  assert.equal(catalogs.en['monster.naming.unobserved_invalid_description.name'], 'it (buggy)');
  return 21;
}

export function check(root = defaultRoot, runSelfTests = false, archiveMode = false) {
  const source = collectMonsterSource(root, archiveMode);
  const entityRoot = path.join(root, 'locales', 'entities');
  const manifest = JSON.parse(fs.readFileSync(path.join(entityRoot, 'monsters-source-map.json'), 'utf8'));
  assert.deepEqual(source, manifest, 'monster source map differs from original pinned names, classification or source SHA-256 values');
  const catalogs = {
    en: parseMonsterCatalog(fs.readFileSync(path.join(entityRoot, 'monsters.en.json'), 'utf8'), 'monsters.en.json'),
    ja: parseMonsterCatalog(fs.readFileSync(path.join(entityRoot, 'monsters.ja.json'), 'utf8'), 'monsters.ja.json'),
  };
  validateMonsterPair([...source.records, ...source.naming_constants], catalogs.en, catalogs.ja);
  const statuses = {};
  for (const record of source.records) statuses[record.status] = (statuses[record.status] ?? 0) + 1;
  return { release: source.release, source_commit: source.commit,
    source_commit_evidence: archiveMode ? 'pinned manifest and source SHA-256 parity; Git HEAD not checked'
      : 'pristine upstream Git HEAD and source SHA-256 parity',
    total_monster_records: source.records.length, fixed_naming_constants: source.naming_constants.length, statuses,
    bilingual_ids: Object.keys(catalogs.en).length, source_files_verified: source.source_files.length,
    self_test_assertions: runSelfTests ? selfTest(source, catalogs) : 0,
    scope: 'real monster enum base names, including compatibility, genus, category and debug labels',
    runtime_integration: false, full_dynamic_name_coverage: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === toolPath) {
  try {
    const args = process.argv.slice(2);
    requireCondition(args.every(argument => argument === '--self-test' || argument === '--archive' || argument.startsWith('--root=')),
      'usage: node check-monster-catalogs.mjs [--self-test] [--archive] [--root=DCSS_ROOT]');
    const rootArgument = args.find(argument => argument.startsWith('--root='));
    console.log(JSON.stringify(check(rootArgument ? path.resolve(rootArgument.slice(7)) : defaultRoot,
      args.includes('--self-test'), args.includes('--archive')), null, 2));
  } catch (error) {
    console.error(`Monster catalog validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
