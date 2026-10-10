import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commit = 'f3082213b73f3e463e3d0d60bff4b00462beae6e';
const ids = new Set();
const sourceCache = new Map();
const commandParameterizedIds = new Set();
const dependencies = [];
const acceptedSnapshot = JSON.parse(fs.readFileSync(path.join(root, 'tests/accepted-source-snapshot/manifest.json'), 'utf8'));
const acceptedSourceFiles = new Set(acceptedSnapshot.files.map(record => `logic/${record.file}`));

function names(template) {
  assert.equal(typeof template, 'string');
  const result = new Set();
  for (let i = 0; i < template.length;) {
    const c = template[i++];
    if (c !== '{' && c !== '}') continue;
    if (template[i] === c) { i++; continue; }
    assert.equal(c, '{', `unmatched closing brace in ${template}`);
    const close = template.indexOf('}', i);
    assert.ok(close >= i, `unclosed placeholder in ${template}`);
    const name = template.slice(i, close);
    assert.match(name, /^[a-z][a-z0-9_]*$/);
    result.add(name);
    i = close + 1;
  }
  return [...result].sort();
}

function source(location, originalCall) {
  assert.equal(typeof location.file, 'string');
  assert.ok(Number.isSafeInteger(location.line) && location.line > 0);
  let relative = location.file.replaceAll('\\', '/');
  if (!relative.includes('/')) relative = `logic/${relative}`;
  // Review anchors describe the accepted source before additive hooks shifted
  // its lines. Producer parity tests separately reconstruct those exact bytes.
  const file = path.resolve(root, acceptedSourceFiles.has(relative)
    ? `tests/accepted-source-snapshot/${path.basename(relative)}` : relative);
  assert.ok(file.startsWith(`${root}${path.sep}`), `outside source root: ${relative}`);
  let lines = sourceCache.get(file);
  if (!lines) {
    lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    sourceCache.set(file, lines);
  }
  assert.ok(location.line <= lines.length, `invalid source line: ${relative}:${location.line}`);
  if (originalCall) {
    const text = lines.slice(Math.max(0, location.line - 4), location.line + 64).join('\n');
    const canonical = value => value.replace(/\r\n/g, '\n').trim();
    assert.ok(canonical(text).includes(canonical(originalCall)), `source call differs: ${relative}:${location.line}`);
  }
}

function entry(record) {
  assert.match(record.id, /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/);
  assert.ok(!ids.has(record.id), `duplicate semantic ID: ${record.id}`);
  ids.add(record.id);
  const parameters = record.parameters ?? [];
  const declared = parameters.map(parameter => {
    assert.match(parameter.name, /^[a-z][a-z0-9_]*$/);
    assert.equal(typeof parameter.type, 'string');
    assert.ok(parameter.type.length > 0);
    return parameter.name;
  });
  assert.equal(new Set(declared).size, declared.length, `duplicate parameter: ${record.id}`);
  assert.deepEqual(names(record.english), [...declared].sort(), `English parameter set: ${record.id}`);
  assert.deepEqual(names(record.japanese), [...declared].sort(), `Japanese parameter set: ${record.id}`);
  assert.ok(record.japanese.length > 0);
  source(record.source, record.original_call);
  for (const location of record.additional_sources ?? []) source(location, location.original_call);
  for (const branch of record.branch_templates ?? []) entry(branch);
}

const reviewed = [];
const arguments_ = process.argv.slice(2);
const requested = arguments_.filter(argument => argument !== '--check');
for (const name of requested.length ? requested : ['commands-text.json', 'birth-and-sidebar.json']) {
  assert.match(name, /^[a-z0-9_-]+\.json$/);
  const file = path.join(root, 'migration', name);
  assert.ok(fs.existsSync(file), `review not ready: ${name}`);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(manifest.upstream_commit, commit);
  assert.equal(manifest.status, 'reviewed_not_integrated');
  assert.ok(Array.isArray(manifest.entries));
  for (const record of manifest.entries) entry(record);
  for (const record of manifest.supporting_templates ?? []) entry(record);
  if (name === 'commands-text.json') {
    const parameterized = record => {
      if ((record.parameters ?? []).length > 0) commandParameterizedIds.add(record.id);
      for (const branch of record.branch_templates ?? []) parameterized(branch);
    };
    for (const record of [...manifest.entries, ...(manifest.supporting_templates ?? [])]) parameterized(record);
  }
  reviewed.push({ file: `migration/${name}`, entries: manifest.entries.length, supportingTemplates: manifest.supporting_templates?.length ?? 0 });
  dependencies.push(...(manifest.dependencies?.character_data?.endpoints ?? []));
}

let characterCatalogIdsVerified = 0;
if (!requested.length) {
  const directory = path.join(root, 'migration', 'character-data');
  const english = JSON.parse(fs.readFileSync(path.join(directory, 'en.json'), 'utf8'));
  const japanese = JSON.parse(fs.readFileSync(path.join(directory, 'ja.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'source-manifest.json'), 'utf8'));
  assert.equal(manifest.upstream_commit, commit);
  assert.equal(manifest.runtime_integrated, false);
  assert.deepEqual(Object.keys(english).sort(), Object.keys(japanese).sort());
  assert.deepEqual(manifest.entries.map(record => record.id).sort(), Object.keys(english).sort());
  for (const record of manifest.entries) {
    assert.match(record.id, /^angband\.[a-z0-9_]+(?:\.[a-z0-9_]+)+$/);
    assert.ok(!ids.has(record.id), `competing catalog ID: ${record.id}`);
    ids.add(record.id);
    assert.equal(record.english, english[record.id]);
    assert.deepEqual(names(english[record.id]), Object.keys(record.parameters).sort());
    assert.deepEqual(names(japanese[record.id]), Object.keys(record.parameters).sort());
    assert.ok(japanese[record.id].length > 0);
    for (const location of record.sources) source(location, location.raw_line);
  }
  for (const endpoint of dependencies) {
    assert.ok(Object.hasOwn(english, endpoint.id), `missing character endpoint: ${endpoint.id}`);
    assert.ok(Object.hasOwn(japanese, endpoint.id), `missing Japanese endpoint: ${endpoint.id}`);
    source(endpoint.source);
  }
  characterCatalogIdsVerified = manifest.entries.length;
  reviewed.push({ file: 'migration/character-data/source-manifest.json', entries: manifest.entries.length, catalogs: ['en.json', 'ja.json'] });
}

let rustTypedIdsVerified = false;
const prototype = path.join(root, 'rust', 'src', 'text_parameters.rs');
if (!requested.length && fs.existsSync(prototype)) {
  const rust = fs.readFileSync(prototype, 'utf8');
  const keys = [...rust.matchAll(/Self::[A-Za-z0-9_]+\s*=>\s*"((?:game|angband)\.[^"]+)"/g)].map(match => match[1]);
  assert.deepEqual([...new Set(keys)].sort(), [...commandParameterizedIds].sort(), 'Rust prototype dynamic ID set differs from the reviewed manifest');
  assert.equal(keys.length, new Set(keys).size, 'duplicate Rust prototype dynamic ID');
  assert.ok(fs.readFileSync(path.join(root, 'rust', 'src', 'lib.rs'), 'utf8').includes('mod text_parameters'), 'typed formatter is not registered');
  rustTypedIdsVerified = true;
}

let generatedCatalogIdsVerified = 0;
if (!requested.length) {
  const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/review-en.json'), 'utf8'));
  const ja = JSON.parse(fs.readFileSync(path.join(root, 'locales/review-ja.json'), 'utf8'));
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'locales/review-schema.json'), 'utf8'));
  assert.equal(schema.upstream_commit, commit);
  assert.equal(schema.status, 'source_connected_unbuilt');
  assert.equal(schema.complete_game_translation, false);
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ja).sort());
  assert.deepEqual(Object.keys(en).sort(), Object.keys(schema.entries).sort());
  for (const id of ids) assert.ok(Object.hasOwn(en, id), `reviewed ID missing from registered catalog: ${id}`);
  for (const [id, record] of Object.entries(schema.entries)) {
    const declared = record.parameters.map(parameter => parameter.name).sort();
    assert.deepEqual(names(en[id]), declared, `registered English parameter set: ${id}`);
    assert.deepEqual(names(ja[id]), declared, `registered Japanese parameter set: ${id}`);
  }
  assert.equal(Object.keys(en).length, ids.size + 11, 'the only new family is 11 source-identified money kinds');
  const money = JSON.parse(fs.readFileSync(path.join(root, 'migration/command-descriptors.json'), 'utf8'));
  for (const record of money.entries) source(record.source, record.original_call);
  generatedCatalogIdsVerified = Object.keys(en).length;
}

const report = {
  verifiedAt: new Date().toISOString(),
  passed: true,
  status: 'source_connected_unbuilt',
  upstreamCommit: commit,
  reviewed,
  semanticIds: ids.size,
  sourcesRead: sourceCache.size,
  characterCatalogIdsVerified,
  characterEndpointsVerified: dependencies.length,
  rustTypedIdsVerified,
  generatedCatalogIdsVerified,
  provenance: 'historical C anchors use hash-identified accepted source snapshots; additive producer parity is checked separately',
  rustCompilationEvidence: '../tests/source-integration-evidence/rust-test-resources.json',
  engineRebuilt: false,
  browserTested: false,
  deployed: false,
};
if (!arguments_.includes('--check')) {
  fs.writeFileSync(path.join(root, 'migration', 'review-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report));
