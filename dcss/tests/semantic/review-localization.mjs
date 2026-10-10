// Independent source/catalog review only. No game, compiler, browser, or Git.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const root = args[0] ? path.resolve(args[0]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const catalogRoot = args[1] ? path.resolve(args[1]) : path.join(root, 'locales/gameplay');
assert.ok(args.length <= 2, 'usage: review-localization.mjs [dcss-root] [gameplay-catalog-root]');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function uniqueRootKeys(text, label) {
  let depth = 0;
  const keys = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      const start = i++;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === '"') break;
        i++;
      }
      assert.ok(i < text.length, `${label}: unterminated JSON string`);
      let following = i + 1;
      while (/\s/.test(text[following] ?? '') && following < text.length) following++;
      if (depth === 1 && text[following] === ':') keys.push(JSON.parse(text.slice(start, i + 1)));
    } else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') depth--;
  }
  assert.equal(new Set(keys).size, keys.length, `${label}: duplicate root ID`);
  return keys.sort();
}

const catalogs = {};
for (const language of ['en', 'ja']) {
  const filename = path.join(catalogRoot, `canned.${language}.json`);
  const text = fs.readFileSync(filename, 'utf8');
  const keys = uniqueRootKeys(text, filename);
  catalogs[language] = JSON.parse(text);
  assert.deepEqual(Object.keys(catalogs[language]).sort(), keys);
  for (const [id, entry] of Object.entries(catalogs[language])) {
    assert.match(id, /^game\.canned\.[a-z0-9_]+(?:\.[a-z0-9_]+)*$/);
    assert.deepEqual(Object.keys(entry).sort(), ['params', 'text']);
    assert.deepEqual(entry.params, {}, `${id}: this reviewed slice accepts no parameters`);
    assert.equal(typeof entry.text, 'string');
    assert.ok(entry.text.trim(), `${id}: empty text`);
    assert.equal(/[{}]/.test(entry.text), false, `${id}: undeclared placeholder`);
  }
}
assert.deepEqual(Object.keys(catalogs.en).sort(), Object.keys(catalogs.ja).sort());

const manifest = JSON.parse(fs.readFileSync(path.join(catalogRoot, 'canned-source-map.json'), 'utf8'));
assert.equal(manifest.commit, '1eebc1a2892e1c89776a0d7a10691f8dac8d9796');
assert.equal(manifest.schema_version, 1);
assert.equal(manifest.source, 'canned-v1');
const source = read('upstream/crawl-ref/source/message.cc');
const enumHeader = read('upstream/crawl-ref/source/canned-message-type.h');
const enums = [...enumHeader.matchAll(/^\s+(MSG_[A-Z_]+)\s*,?\s*$/gm)].map(match => match[1]);
const channels = [...read('upstream/crawl-ref/source/mpr.h').matchAll(/^\s+(MSGCH_[A-Z_]+),/gm)].map(match => match[1]);
assert.equal(enums.length, 37, 'reviewed pristine 0.34.1 enum denominator changed');
const ids = manifest.records.map(record => record.id);
assert.equal(ids.length, 45);
assert.equal(new Set(ids).size, ids.length);
assert.deepEqual([...ids].sort(), Object.keys(catalogs.en).sort());
assert.deepEqual([...new Set(manifest.records.map(record => record.enum_identity))].sort(), [...enums].sort());
const multiplicity = new Map();
let receipts = 0;
for (const file of manifest.source_files) {
  const bytes = fs.readFileSync(path.join(root, 'upstream', file.path));
  assert.equal(sha(bytes), file.sha256, `${file.path}: source hash drift`);
}
for (const record of manifest.records) {
  multiplicity.set(record.enum_identity, (multiplicity.get(record.enum_identity) ?? 0) + 1);
  assert.equal(record.enum_value, enums.indexOf(record.enum_identity));
  assert.equal(catalogs.en[record.id].text, record.english);
  assert.deepEqual(record.parameters, {});
  assert.equal(record.original_control.param, 0);
  assert.equal(record.original_control.capitalize, true);
  assert.ok(source.includes(record.emitter.source_call), `${record.id}: emitter missing from pristine source`);
  assert.equal(record.nojoin, record.emitter.function === 'mpr_nojoin');
  const namedChannel = record.emitter.source_call.match(/^\w+\(\s*(MSGCH_[A-Z_]+)\s*,/);
  assert.equal(record.channel, namedChannel?.[1] ?? 'MSGCH_PLAIN');
  assert.equal(record.channel_value, channels.indexOf(record.channel));
  for (const receipt of record.source_receipts) {
    const lines = read(path.join('upstream', receipt.path)).split('\n');
    assert.equal(lines.slice(receipt.first_line - 1, receipt.last_line).join('\n'), receipt.text);
    receipts++;
  }
  let expected = record.emitter.format;
  if (record.enum_identity === 'MSG_SOMETHING_APPEARS') {
    assert.ok(['at_feet', 'before_you'].includes(record.conditional.variant));
    expected = expected.replace('%s', record.conditional.variant === 'at_feet' ? 'at your feet' : 'before you');
  } else if (/^MSG_EMPTY_HANDED_(ALREADY|NOW)$/.test(record.enum_identity)) {
    const when = record.enum_identity === 'MSG_EMPTY_HANDED_ALREADY' ? 'already' : 'now';
    expected = expected.replace('%s', when);
  }
  assert.equal(expected, record.english, `${record.id}: exact original EN branch differs`);
}
for (const identity of enums) {
  const expected = identity === 'MSG_SOMETHING_APPEARS' || identity === 'MSG_MAGIC_DRAIN' ? 2
    : identity === 'MSG_EMPTY_HANDED_ALREADY' || identity === 'MSG_EMPTY_HANDED_NOW' ? 4 : 1;
  assert.equal(multiplicity.get(identity), expected, `${identity}: conditional variant coverage differs`);
}
assert.equal(manifest.records.filter(record => record.nojoin).length, 1);
assert.equal(manifest.records.find(record => record.nojoin).enum_identity, 'MSG_YOU_DIE');
assert.equal(manifest.records.find(record => record.id === 'game.canned.magic_drain.magic_energy').channel, 'MSGCH_WARN');
assert.equal(manifest.records.find(record => record.id === 'game.canned.magic_drain.hp_casting').channel, 'MSGCH_PLAIN');
assert.equal(manifest.records.find(record => record.id === 'game.canned.ok').channel, 'MSGCH_PROMPT');
assert.equal(manifest.records.find(record => record.id === 'game.canned.huh').channel, 'MSGCH_EXAMINE_FILTER');

// A disconnected authoring catalog is not proof of engine integration. Independently
// check the bounded startup receipts and complete templates when it is installed.
let startup = null;
const startupDirectory = path.join(root, 'locales/startup');
if (fs.existsSync(path.join(startupDirectory, 'source-map.json'))) {
  const sourceMap = JSON.parse(fs.readFileSync(path.join(startupDirectory, 'source-map.json'), 'utf8'));
  assert.equal(sourceMap.commit, manifest.commit);
  assert.equal(sourceMap.scope.runtime_integration, false);
  assert.equal(sourceMap.scope.full_startup_coverage, false);
  assert.equal(sourceMap.scope.fixed_output_sites, 37);
  assert.equal(sourceMap.output_sites.length, 37);
  assert.equal(sourceMap.messages.length, 51);
  const locales = {};
  for (const language of ['en', 'ja']) {
    const raw = fs.readFileSync(path.join(startupDirectory, `${language}.json`), 'utf8');
    const ids = uniqueRootKeys(raw, `startup ${language}`);
    locales[language] = JSON.parse(raw);
    assert.deepEqual(ids, Object.keys(locales[language]).sort());
  }
  const expectedIds = sourceMap.messages.map(record => record.id).sort();
  assert.equal(new Set(expectedIds).size, expectedIds.length);
  assert.deepEqual(Object.keys(locales.en).sort(), expectedIds);
  assert.deepEqual(Object.keys(locales.ja).sort(), expectedIds);
  for (const file of sourceMap.source_files) {
    assert.equal(sha(fs.readFileSync(path.join(root, 'upstream', file.path))), file.sha256);
  }
  const sites = new Map();
  for (const site of sourceMap.output_sites) {
    assert.equal(sites.has(site.id), false, 'duplicate startup output site');
    sites.set(site.id, site);
    const original = read(path.join('upstream', site.source)).split('\n')
      .slice(site.line - 1, site.end_line).join('\n');
    assert.equal(site.original_expression, original, `${site.id}: original expression drift`);
    assert.equal(site.expression_sha256, sha(Buffer.from(original)));
    for (const id of site.message_ids) assert.ok(expectedIds.includes(id));
  }
  for (const receipt of sourceMap.control_sites) {
    const original = read(path.join('upstream', receipt.source)).split('\n')
      .slice(receipt.line - 1, receipt.end_line).join('\n');
    assert.equal(receipt.original_expression, original);
    assert.equal(receipt.expression_sha256, sha(Buffer.from(original)));
  }
  function normalizedEntry(entry) {
    if (typeof entry === 'string') return { text: entry, params: {} };
    assert.deepEqual(Object.keys(entry).sort(), ['params', 'text']);
    return entry;
  }
  for (const record of sourceMap.messages) {
    const en = normalizedEntry(locales.en[record.id]);
    const ja = normalizedEntry(locales.ja[record.id]);
    assert.equal(en.text, record.expected_en, `${record.id}: original EN template drift`);
    assert.deepEqual(en.params, record.params);
    assert.deepEqual(ja.params, record.params);
    assert.deepEqual(Object.keys(record.parameter_bindings).sort(), Object.keys(record.params).sort());
    for (const entry of [en, ja]) {
      assert.equal(typeof entry.text, 'string');
      assert.ok(entry.text.trim());
      const placeholders = [...entry.text.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map(match => match[1]);
      assert.deepEqual([...new Set(placeholders)].sort(), Object.keys(record.params).sort());
      assert.equal(/[{}]/.test(entry.text.replace(/\{[a-z][a-z0-9_]*\}/g, '')), false);
      for (const kind of Object.values(entry.params)) assert.ok(['text', 'unsigned', 'integer'].includes(kind));
    }
    for (const siteId of record.source_sites) assert.ok(sites.get(siteId)?.message_ids.includes(record.id));
    assert.deepEqual(record.source_emission_conditions.map(condition => condition.source_site), record.source_sites);
    assert.ok(record.source_emission_conditions.every(condition => typeof condition.condition === 'string' && condition.condition));
    for (const token of record.required_command_tokens) {
      assert.equal(en.text.includes(token), true, `${record.id}: original command token missing`);
      assert.equal(ja.text.includes(token), true, `${record.id}: Japanese command token changed`);
    }
  }
  // Re-extract the four finite compile-time footer branches from pristine C++.
  const footerLines = read('upstream/crawl-ref/source/newgame.cc').split('\n').slice(905, 920);
  for (const [variant, local, unreliable] of [
    ['standard', false, false], ['unreliable', false, true],
    ['local', true, false], ['local_unreliable', true, true],
  ]) {
    const flags = { USE_TILE_LOCAL: local, SEEDING_UNRELIABLE: unreliable };
    const stack = [true];
    let english = '';
    for (const line of footerLines) {
      const directive = line.match(/^#ifdef ([A-Z_]+)$/);
      if (directive) { assert.ok(Object.hasOwn(flags, directive[1])); stack.push(stack.at(-1) && flags[directive[1]]); }
      else if (line === '#endif') stack.pop();
      else if (stack.at(-1)) {
        for (const literal of line.matchAll(/"(?:\\.|[^"\\])*"/g)) english += JSON.parse(literal[0]);
      }
    }
    assert.equal(stack.length, 1);
    const id = `startup.seed.footer.${variant}`;
    assert.equal(locales.en[id], english, `${id}: original compile variant differs`);
    assert.equal(locales.ja[id].includes('クリップボード'), local);
    assert.equal(locales.ja[id].includes('警告：'), unreliable);
  }
  assert.equal(expectedIds.filter(id => id.startsWith('startup.welcome.')).length, 8);
  assert.equal(locales.en['startup.name.overwrite'].endsWith('[Y/n]'), true);
  assert.equal(locales.ja['startup.name.overwrite'].endsWith('[Y/n]'), true);
  assert.equal(locales.en['startup.opening.copyright'], sourceMap.source_constants.copyright.value);
  assert.equal(locales.ja['startup.opening.copyright'], sourceMap.source_constants.copyright.value);
  const records = new Map(sourceMap.messages.map(record => [record.id, record]));
  const current = records.get('startup.weapon.row').parameter_bindings.weapon_name;
  const previous = records.get('startup.weapon.default.label').parameter_bindings.weapon_name;
  assert.equal(current.source_context, 'current_choice');
  assert.equal(previous.source_context, 'previous_choice');
  assert.deepEqual([...current.fixed_refs].sort(), ['startup.weapon.claws.name', 'startup.weapon.unarmed.name']);
  assert.deepEqual([...previous.fixed_refs].sort(), ['startup.weapon.default.random', 'startup.weapon.default.recommended', 'startup.weapon.unarmed.name']);
  assert.deepEqual(records.get('startup.weapon.unarmed.name').source_emission_conditions, [
    { source_site: 'startup.weapon.unarmed.output', condition: '!species::has_claws(ng.species)' },
    { source_site: 'startup.weapon.default.output', condition: 'defweapon == WPN_UNARMED' },
  ]);
  // Exercise the owner's disconnected renderer for the concrete context defect.
  // This imports authored review code only; it still executes no game or Rust.
  const { renderStartupMessage, readEntityCatalogs } = await import(pathToFileURL(path.join(root, 'tools/check-startup-catalogs.mjs')).href);
  const entities = readEntityCatalogs(root);
  const render = (id, params) => renderStartupMessage(sourceMap, locales, entities, id, params, 'en');
  const weapon = id => ({ id });
  assert.equal(render('startup.weapon.row', { hotkey: 'a', weapon_name: weapon('startup.weapon.claws.name') }), ' a - claws');
  for (const id of ['startup.weapon.unarmed.name', 'startup.weapon.default.random', 'startup.weapon.default.recommended']) {
    assert.equal(render('startup.weapon.default.label', { weapon_name: weapon(id) }), 'Tab - ' + normalizedEntry(locales.en[id]).text);
  }
  for (const id of ['startup.weapon.default.random', 'startup.weapon.default.recommended']) {
    assert.throws(() => render('startup.weapon.row', { hotkey: 'a', weapon_name: weapon(id) }));
  }
  assert.throws(() => render('startup.weapon.default.label', { weapon_name: weapon('startup.weapon.claws.name') }));
  startup = {
    bilingual_ids: 51, exact_source_sites: 37, source_hashes: sourceMap.source_files.length,
    independently_reexpanded_seed_footer_variants: 4, runtime_integration: false,
    exact_control_receipts: sourceMap.control_sites.length, context_renderer_probes: 7,
    catalog_sha256: Object.fromEntries(['en.json', 'ja.json', 'source-map.json'].map(file =>
      [file, sha(fs.readFileSync(path.join(startupDirectory, file)))])),
  };
}

console.log(JSON.stringify({
  kind: 'independent pristine-source and canned-catalog review',
  upstream: manifest.commit, enums: enums.length, bilingual_ids: ids.length,
  source_hashes: manifest.source_files.length, exact_source_receipts: receipts,
  japanese_semantics: 'manual review documented separately; not inferred by this probe',
  catalog_sha256: Object.fromEntries(['canned.en.json', 'canned.ja.json', 'canned-source-map.json'].map(file =>
    [file, sha(fs.readFileSync(path.join(catalogRoot, file)))])),
  startup,
  actual_engine_executed: false, actual_rust_executed: false, browser_executed: false,
  native_history_persisted: false,
}, null, 2));
