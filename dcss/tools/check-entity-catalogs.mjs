// Added 2026-10-02. GPL-2.0-or-later. Reads pinned upstream data; executes none.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const toolPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(toolPath), '..');
export const pinnedCommit = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
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

// This intentionally parses only the single-line top-level naming/identity
// scalars present in the pinned YAML, not arbitrary YAML or gameplay data.
// Unsupported scalar syntax fails closed rather than guessing a name.
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
    requireCondition(typeof value === 'string', `${context}: scalar must be a string`);
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
  const relevant = new Set(['enum', 'name', 'short_name', 'difficulty', 'category', 'TAG_MAJOR_VERSION']);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const row = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (!row || !relevant.has(row[1])) continue;
    requireCondition(!fields.has(row[1]), `${source}:${index + 1}: duplicate ${row[1]}`);
    fields.set(row[1], { value: scalar(row[2], `${source}:${index + 1}`), line: index + 1 });
  }
  requireCondition(fields.has('enum') && fields.has('name'), `${source}: missing enum or display name`);
  return fields;
}

function enumIdentities(text, prefix) {
  // Alias assignments are deliberately excluded; they do not define entities.
  return [...text.matchAll(new RegExp(`^\\s+(${prefix}_[A-Z_]+)\\s*,`, 'gm'))].map(match => match[1]);
}

/** Read original identity/name fields, including the separate history job data. */
export function collectSource(root = defaultRoot, archiveMode = false) {
  const upstream = path.join(root, 'upstream');
  // Source archives normally omit Git metadata. That mode is explicit and
  // relies on the pinned manifest plus the source-byte checks below.
  const commit = archiveMode
    ? JSON.parse(fs.readFileSync(path.join(root, 'locales', 'entities', 'source-map.json'), 'utf8')).commit
    : gitHead(upstream);
  requireCondition(commit === pinnedCommit, `source commit differs from the selected 0.34.1 commit: ${commit}`);
  const files = new Map();
  const read = source => {
    const bytes = fs.readFileSync(path.join(upstream, ...source.split('/')));
    files.set(source, { path: source, sha256: hash(bytes) });
    return bytes.toString('utf8');
  };
  const records = [];
  for (const [kind, folder, prefix] of [['species', 'species', 'SP'], ['job', 'jobs', 'JOB']]) {
    const directory = path.join(upstream, 'crawl-ref', 'source', 'dat', folder);
    const filenames = fs.readdirSync(directory).filter(name => name.endsWith('.yaml')).sort();
    requireCondition(filenames.length > 0, `no ${kind} source files found`);
    for (const filename of filenames) {
      const source = `crawl-ref/source/dat/${folder}/${filename}`;
      const fields = nameFields(read(source), source);
      const identity = fields.get('enum').value;
      requireCondition(new RegExp(`^${prefix}_[A-Z_]+$`).test(identity), `${source}: invalid enum identity`);
      const name = fields.get('name').value;
      requireCondition(name.length >= 2 && !/[{}\r\n]/.test(name), `${source}: unsupported display name`);
      const abbrev = fields.get('short_name')?.value ?? name.slice(0, 2);
      requireCondition(abbrev.length === 2, `${source}: abbreviation must match the two-character upstream code`);
      const gate = fields.get('TAG_MAJOR_VERSION')?.value;
      requireCondition(gate === undefined || /^\d+$/.test(gate), `${source}: invalid compatibility gate`);
      const selectionField = kind === 'species' ? 'difficulty' : 'category';
      requireCondition(fields.has(selectionField), `${source}: missing ${selectionField}`);
      const selection = fields.get(selectionField).value;
      const hidden = selection.toLowerCase() === 'false';
      let status = 'current_start';
      if (gate !== undefined || filename.startsWith('deprecated-')) {
        requireCondition(hidden && gate !== undefined, `${source}: inconsistent deprecated classification`);
        status = 'deprecated_compatibility';
      } else if (hidden) {
        requireCondition(kind === 'species' && identity.endsWith('_DRACONIAN') && identity !== 'SP_BASE_DRACONIAN',
          `${source}: non-selectable current entity needs explicit classification`);
        status = 'current_subspecies';
      }
      records.push({ kind, identity, name, abbrev, source, line: fields.get('name').line,
        status, selection: hidden ? null : selection,
        tag_major_version: gate === undefined ? null : Number(gate),
        name_id: `${kind}.${identity.toLowerCase()}.name`,
        abbrev_id: `${kind}.${identity.toLowerCase()}.abbrev` });
    }
  }
  const historySource = 'crawl-ref/source/util/job-gen/job-data-deprecated-jobs.txt';
  const history = read(historySource);
  const historyGate = /^#if TAG_MAJOR_VERSION == (\d+)$/m.exec(history);
  requireCondition(historyGate, `${historySource}: missing explicit compatibility gate`);
  const matches = [...history.matchAll(/\{\s*(JOB_[A-Z_]+),\s*\{\s*("(?:[^"\\]|\\.)*"),\s*("(?:[^"\\]|\\.)*")\s*,/g)];
  const declared = [...history.matchAll(/\{\s*(JOB_[A-Z_]+),/g)].map(match => match[1]);
  requireCondition(matches.length === declared.length, `${historySource}: unsupported history name syntax`);
  for (const match of matches) {
    const identity = match[1];
    records.push({ kind: 'job', identity, name: JSON.parse(match[3]), abbrev: JSON.parse(match[2]),
      source: historySource, line: history.slice(0, match.index).split('\n').length,
      status: 'deprecated_compatibility', selection: null, tag_major_version: Number(historyGate[1]),
      name_id: `job.${identity.toLowerCase()}.name`, abbrev_id: `job.${identity.toLowerCase()}.abbrev` });
  }
  for (const [kind, prefix, header] of [
    ['species', 'SP', 'crawl-ref/source/util/species-gen/species-type-header.txt'],
    ['job', 'JOB', 'crawl-ref/source/util/job-gen/job-type-header.txt'],
  ]) {
    const declaredIds = sorted(enumIdentities(read(header), prefix));
    const extractedIds = sorted(records.filter(record => record.kind === kind).map(record => record.identity));
    assert.deepEqual(extractedIds, declaredIds, `${kind}: source definitions must cover every real enum identity`);
    requireCondition(new Set(extractedIds).size === extractedIds.length, `${kind}: duplicate source identity`);
  }
  records.sort((a, b) => a.name_id.localeCompare(b.name_id, 'en'));
  return { schema_version: 1, release: '0.34.1', commit,
    source_files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')), records };
}

/** Parse a flat string catalog while detecting duplicate JSON keys. */
export function parseCatalog(text, label = 'catalog') {
  let position = 0;
  const whitespace = () => { while (/\s/.test(text[position] ?? '') && position < text.length) position++; };
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
      requireCondition(/^(?:species\.sp_[a-z_]+|job\.job_[a-z_]+)\.(?:name|abbrev)$/.test(key), `${label}: invalid semantic ID ${key}`);
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

/** Enforce exact source names/codes and complete bilingual identities. */
export function validatePair(records, en, ja) {
  const expected = sorted(records.flatMap(record => [record.name_id, record.abbrev_id]));
  assert.deepEqual(sorted(Object.keys(en)), expected, 'English semantic IDs differ from exact source identities');
  assert.deepEqual(sorted(Object.keys(ja)), expected, 'Japanese semantic IDs differ from exact source identities');
  for (const record of records) {
    requireCondition(en[record.name_id] === record.name, `${record.name_id}: English value differs from source`);
    requireCondition(en[record.abbrev_id] === record.abbrev && ja[record.abbrev_id] === record.abbrev,
      `${record.abbrev_id}: upstream identity code must be preserved in both languages`);
    requireCondition(/[\u3040-\u30ff\u3400-\u9fff]/u.test(ja[record.name_id]), `${record.name_id}: Japanese name is not translated`);
    for (const id of [record.name_id, record.abbrev_id]) {
      assert.deepEqual(placeholders(en[id], id), placeholders(ja[id], id), `${id}: bilingual placeholders differ`);
      assert.deepEqual(placeholders(en[id], id), [], `${id}: entity labels take no interpolation parameters`);
    }
  }
}

/** Disconnected lookup contract: entity identities never become English keys. */
export function resolveEntityName(catalogs, descriptor, language = 'ja') {
  requireCondition(language === 'ja' || language === 'en', 'unsupported entity display language');
  requireCondition(descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor), 'invalid name descriptor');
  if (descriptor.kind === 'external_player') {
    assert.deepEqual(sorted(Object.keys(descriptor)), ['kind', 'value'], 'external player descriptor has unexpected fields');
    requireCondition(typeof descriptor.value === 'string', 'external player name must be text');
    return descriptor.value;
  }
  assert.deepEqual(sorted(Object.keys(descriptor)), ['form', 'identity', 'kind'], 'entity descriptor has unexpected fields');
  requireCondition(descriptor.kind === 'species' || descriptor.kind === 'job', 'unsupported entity kind');
  requireCondition(descriptor.form === 'name' || descriptor.form === 'abbrev', 'unsupported entity name form');
  const prefix = descriptor.kind === 'species' ? 'SP' : 'JOB';
  requireCondition(typeof descriptor.identity === 'string', 'entity identity must be a typed string');
  requireCondition(new RegExp(`^${prefix}_[A-Z_]+$`).test(descriptor.identity), 'invalid entity identity');
  const id = `${descriptor.kind}.${descriptor.identity.toLowerCase()}.${descriptor.form}`;
  requireCondition(Object.hasOwn(catalogs[language], id), `missing entity text ID: ${id}`);
  return catalogs[language][id];
}

function selfTest(records, catalogs) {
  const sample = records.find(record => record.identity === 'SP_HUMAN');
  requireCondition(sample, 'source lacks SP_HUMAN test identity');
  assert.equal(resolveEntityName(catalogs, { kind: 'species', identity: 'SP_HUMAN', form: 'name' }), '人間');
  assert.equal(resolveEntityName(catalogs, { kind: 'species', identity: 'SP_HUMAN', form: 'name' }, 'en'), 'Human');
  const external = 'Alice 猫 <img onerror=evil()> {name}';
  assert.equal(resolveEntityName(catalogs, { kind: 'external_player', value: external }), external);
  assert.throws(() => resolveEntityName(catalogs, { kind: 'species', identity: 'Human', form: 'name' }));
  assert.throws(() => resolveEntityName(catalogs, { kind: 'species', identity: { toString: () => 'SP_HUMAN' }, form: 'name' }));
  assert.throws(() => resolveEntityName(catalogs, { kind: 'species', identity: 'SP_HUMAN', form: 'name', count: 2 }));
  assert.throws(() => resolveEntityName(catalogs, { kind: 'species', identity: 'SP_UNKNOWN', form: 'name' }));
  assert.throws(() => parseCatalog('{"species.sp_human.name":"Human","species.sp_human.name":"Human"}'));
  assert.throws(() => parseCatalog('{"species.sp_human.name":null}'));
  assert.throws(() => parseCatalog('{"species.sp_human.name":"Human",}'));
  assert.throws(() => validatePair(records, { ...catalogs.en, [sample.name_id]: 'Wrong source name' }, catalogs.ja));
  assert.throws(() => validatePair(records, catalogs.en, { ...catalogs.ja, [sample.name_id]: '人間 {n}' }));
  const missing = { ...catalogs.ja };
  delete missing[sample.name_id];
  assert.throws(() => validatePair(records, catalogs.en, missing));
  assert.throws(() => validatePair(records, catalogs.en, { ...catalogs.ja, 'species.sp_unknown.name': '不明' }));
  assert.throws(() => validatePair(records, catalogs.en, { ...catalogs.ja, [sample.abbrev_id]: '人' }));
  return 15;
}

export function check(root = defaultRoot, runSelfTests = false, archiveMode = false) {
  const source = collectSource(root, archiveMode);
  const entityRoot = path.join(root, 'locales', 'entities');
  const manifest = JSON.parse(fs.readFileSync(path.join(entityRoot, 'source-map.json'), 'utf8'));
  assert.deepEqual(source, manifest, 'source-map differs from exact pinned original data or source checksums');
  const catalogs = { en: Object.create(null), ja: Object.create(null) };
  for (const [kind, stem] of [['species', 'species'], ['job', 'jobs']]) {
    const selected = source.records.filter(record => record.kind === kind);
    const en = parseCatalog(fs.readFileSync(path.join(entityRoot, `${stem}.en.json`), 'utf8'), `${stem}.en.json`);
    const ja = parseCatalog(fs.readFileSync(path.join(entityRoot, `${stem}.ja.json`), 'utf8'), `${stem}.ja.json`);
    validatePair(selected, en, ja);
    Object.assign(catalogs.en, en);
    Object.assign(catalogs.ja, ja);
  }
  const count = (kind, status) => source.records.filter(record => record.kind === kind && record.status === status).length;
  const result = {
    release: source.release, source_commit: source.commit,
    source_commit_evidence: archiveMode
      ? 'pinned manifest and source SHA-256 parity; Git HEAD not checked'
      : 'pristine upstream Git HEAD and source SHA-256 parity',
    species: { total_records: count('species', 'current_start') + count('species', 'current_subspecies') + count('species', 'deprecated_compatibility'),
      current_start: count('species', 'current_start'), current_subspecies: count('species', 'current_subspecies'),
      deprecated_compatibility: count('species', 'deprecated_compatibility') },
    jobs: { total_records: count('job', 'current_start') + count('job', 'deprecated_compatibility'),
      current_start: count('job', 'current_start'), deprecated_compatibility: count('job', 'deprecated_compatibility') },
    bilingual_ids: Object.keys(catalogs.en).length,
    source_files_verified: source.source_files.length,
    self_test_assertions: runSelfTests ? selfTest(source.records, catalogs) : 0,
    runtime_integration: false,
  };
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === toolPath) {
  try {
    const args = process.argv.slice(2);
    requireCondition(args.every(argument => argument === '--self-test' || argument === '--archive' || argument.startsWith('--root=')), 'usage: node check-entity-catalogs.mjs [--self-test] [--archive] [--root=DCSS_ROOT]');
    const rootArgument = args.find(argument => argument.startsWith('--root='));
    console.log(JSON.stringify(check(rootArgument ? path.resolve(rootArgument.slice(7)) : defaultRoot,
      args.includes('--self-test'), args.includes('--archive')), null, 2));
  } catch (error) {
    console.error(`Entity catalog validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
