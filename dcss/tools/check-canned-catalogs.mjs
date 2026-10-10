// Standalone verification of the bounded DCSS canned-message catalogs.
// Node built-ins only. This never executes C++, WASM, Lua, Cargo or Git.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const COMMIT = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
export const SOURCE = 'canned-v1';
const PINNED = {
  'crawl-ref/source/message.cc': '63d0aa5d84e3f82301fb948d0f4e4c80bc113971aa273ade7ae539c8844a4784',
  'crawl-ref/source/canned-message-type.h': '1802137341109fca9334263f824b3e9b1b45186ddfcbe5404b04abb6ccf09bfd',
  'crawl-ref/source/mpr.h': '6931ce4d3d30675dd69dd952e2184f0bb105b01228a1aa51e081a6881449b3a4',
};
const ID = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const same = (first, second, label) => assert.deepEqual(first, second, label);

export function parseStrictJson(text) {
  const result = JSON.parse(text);
  let offset = 0;
  const space = () => { while (/\s/.test(text[offset] ?? '') && offset < text.length) offset++; };
  function string() {
    const match = /"(?:\\.|[^"\\])*"/y;
    match.lastIndex = offset;
    const token = match.exec(text);
    assert(token, 'invalid JSON string');
    offset = match.lastIndex;
    return JSON.parse(token[0]);
  }
  function value() {
    space();
    if (text[offset] === '{') {
      offset++;
      const keys = new Set();
      space();
      if (text[offset] === '}') { offset++; return; }
      while (true) {
        space();
        const key = string();
        assert(!keys.has(key), 'duplicate JSON key: ' + key);
        keys.add(key);
        space(); offset++; // JSON.parse already verified the colon.
        value(); space();
        if (text[offset++] === '}') break;
      }
    } else if (text[offset] === '[') {
      offset++; space();
      if (text[offset] === ']') { offset++; return; }
      while (true) { value(); space(); if (text[offset++] === ']') break; }
    } else if (text[offset] === '"') {
      string();
    } else {
      const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(offset));
      assert(token, 'invalid JSON token');
      offset += token[0].length;
    }
  }
  value(); space();
  assert.equal(offset, text.length);
  return result;
}

function enumEntries(text, type, prefix) {
  const match = new RegExp('enum ' + type + '\\s*\\{([\\s\\S]*?)\\};').exec(text);
  assert(match, 'missing enum ' + type);
  const bodyOffset = match.index + match[0].indexOf('{') + 1;
  let ordinal = 0;
  const result = [];
  let consumed = 0;
  for (const raw of match[1].split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (line) {
      const identity = /^([A-Z_0-9]+)(?:\s*=\s*(\d+))?\s*,?$/.exec(line);
      assert(identity, 'unsupported enum declaration: ' + line);
      if (identity[2] !== undefined) ordinal = Number(identity[2]);
      if (identity[1].startsWith(prefix)) {
        result.push({ identity: identity[1], ordinal, line: text.slice(0, bodyOffset + consumed).split('\n').length });
      }
      ordinal++;
    }
    consumed += raw.length + 1;
  }
  return result;
}

function callsIn(text, absoluteOffset, original) {
  const pattern = /\b(mpr_nojoin|mprf|mpr)\s*\(/g;
  const calls = [];
  for (const match of text.matchAll(pattern)) {
    const open = match.index + match[0].lastIndexOf('(');
    let depth = 1, quoted = false, escaped = false, cursor = open + 1;
    const starts = [cursor], ends = [];
    for (; cursor < text.length; cursor++) {
      const character = text[cursor];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === '(') depth++;
      else if (character === ')' && --depth === 0) { ends.push(cursor); break; }
      else if (character === ',' && depth === 1) { ends.push(cursor); starts.push(cursor + 1); }
    }
    assert.equal(depth, 0, 'unclosed pinned emitter call');
    const arguments_ = starts.map((start, index) => text.slice(start, ends[index]).trim());
    const channel = /^MSGCH_[A-Z_]+$/.test(arguments_[0]) ? arguments_[0] : 'MSGCH_PLAIN';
    const formatIndex = channel === arguments_[0] ? 1 : 0;
    const format = JSON.parse(arguments_[formatIndex]);
    calls.push({
      function: match[1], line: original.slice(0, absoluteOffset + match.index).split('\n').length,
      channel, nojoin: match[1] === 'mpr_nojoin', format,
      arguments: arguments_.slice(formatIndex + 1),
      source_call: text.slice(match.index, cursor + 1),
    });
  }
  return calls;
}

export function buildSourceModel(projectRoot) {
  const texts = new Map(), sourceFiles = [];
  for (const [relative, sha256] of Object.entries(PINNED)) {
    const bytes = fs.readFileSync(path.join(projectRoot, 'upstream', relative));
    same(crypto.createHash('sha256').update(bytes).digest('hex'), sha256, 'pinned source bytes: ' + relative);
    texts.set(relative, bytes.toString('utf8').replace(/\r\n/g, '\n'));
    sourceFiles.push({ path: relative, sha256 });
  }
  const original = texts.get('crawl-ref/source/message.cc');
  const identities = enumEntries(texts.get('crawl-ref/source/canned-message-type.h'), 'canned_message_type', 'MSG_');
  const channels = enumEntries(texts.get('crawl-ref/source/mpr.h'), 'msg_channel_type', 'MSGCH_');
  const channelMap = new Map(channels.map(channel => [channel.identity, channel]));
  const functionMatch = /^void canned_msg\(canned_message_type which_message\)\s*\{([\s\S]*?)^\}/m.exec(original);
  assert(functionMatch, 'missing pinned canned_msg');
  const body = functionMatch[1], bodyOffset = functionMatch.index + functionMatch[0].indexOf('{') + 1;
  const cases = [...body.matchAll(/case (MSG_[A-Z_]+):/g)].map(match => ({ identity: match[1], offset: match.index, end: match.index + match[0].length }));
  same(cases.map(case_ => case_.identity), identities.map(enum_ => enum_.identity), 'source-complete enum/case order');
  same(identities.length, 37, 'pinned identity count');
  function receipt(relative, firstLine, lastLine = firstLine) {
    return { path: relative, first_line: firstLine, last_line: lastLine,
      text: texts.get(relative).split('\n').slice(firstLine - 1, lastLine).join('\n') };
  }
  const records = [], groups = new Map();
  for (let index = 0; index < cases.length; index++) {
    const case_ = cases[index], enum_ = identities[index];
    let emissionIndex = index;
    while (emissionIndex + 1 < cases.length
      && !body.slice(cases[emissionIndex].end, cases[emissionIndex + 1].offset).trim()) emissionIndex++;
    let firstIndex = emissionIndex;
    while (firstIndex > 0 && !body.slice(cases[firstIndex - 1].end, cases[firstIndex].offset).trim()) firstIndex--;
    const endOffset = cases[emissionIndex + 1]?.offset ?? body.length;
    const group = body.slice(cases[firstIndex].offset, endOffset);
    const groupOffset = bodyOffset + cases[firstIndex].offset;
    const calls = callsIn(group, groupOffset, original);
    groups.set(groupOffset, calls);
    const firstLine = original.slice(0, groupOffset).split('\n').length;
    const lastLine = original.slice(0, bodyOffset + endOffset).split('\n').length - 1;
    const effects = group.split('\n').flatMap((line, lineIndex) =>
      /crawl_state\.cancel_cmd_repeat\(\)|learned_something_new\(/.test(line)
        ? [{ line: firstLine + lineIndex, source: line.trim() }] : []);
    const base = 'game.canned.' + case_.identity.slice(4).toLowerCase();
    function add(suffix, call, english, predicates = []) {
      const channel = channelMap.get(call.channel);
      assert(channel, 'unknown original channel');
      const id = suffix ? base + '.' + suffix : base;
      assert(ID.test(id));
      const caseLine = original.slice(0, bodyOffset + case_.offset).split('\n').length;
      records.push({
        id, enum_identity: case_.identity, enum_value: enum_.ordinal,
        enum_line: enum_.line, case_line: caseLine, emission_line: call.line,
        channel: call.channel, channel_value: channel.ordinal, nojoin: call.nojoin,
        english, parameters: {}, conditional: { variant: suffix || 'default', predicates },
        emitter: call, original_control: { param: 0, capitalize: true },
        side_effects: effects,
        source_receipts: [
          receipt('crawl-ref/source/canned-message-type.h', enum_.line),
          receipt('crawl-ref/source/message.cc', firstLine, lastLine),
          receipt('crawl-ref/source/mpr.h', channel.line),
        ],
      });
    }
    if (case_.identity === 'MSG_SOMETHING_APPEARS') {
      same(calls.length, 1);
      same(calls[0].arguments, ['player_has_feet() ? "at your feet" : "before you"']);
      const phrases = [...calls[0].arguments[0].matchAll(/"([^"]*)"/g)].map(match => match[1]);
      add('at_feet', calls[0], calls[0].format.replace('%s', phrases[0]), [{ expression: 'player_has_feet()', value: true }]);
      add('before_you', calls[0], calls[0].format.replace('%s', phrases[1]), [{ expression: 'player_has_feet()', value: false }]);
    } else if (case_.identity.startsWith('MSG_EMPTY_HANDED_')) {
      same(calls.length, 4);
      assert(group.includes('(which_message == MSG_EMPTY_HANDED_ALREADY ? "already" : "now")'));
      assert(/you\.has_mutation\(MUT_NO_GRASPING\)[\s\S]*you\.has_usable_claws\(true\)[\s\S]*you\.has_usable_tentacles\(true\)/.test(group));
      const already = case_.identity === 'MSG_EMPTY_HANDED_ALREADY';
      const expressions = ['you.has_mutation(MUT_NO_GRASPING)', 'you.has_usable_claws(true)', 'you.has_usable_tentacles(true)'];
      for (const [branch, suffix] of ['mouth', 'claws', 'tentacles', 'hands'].entries()) {
        same(calls[branch].arguments, ['when']);
        const predicates = [{ expression: 'which_message == MSG_EMPTY_HANDED_ALREADY', value: already }];
        for (let condition = 0; condition < Math.min(branch + 1, 3); condition++) {
          predicates.push({ expression: expressions[condition], value: condition === branch });
        }
        add(suffix, calls[branch], calls[branch].format.replace('%s', already ? 'already' : 'now'), predicates);
      }
    } else if (case_.identity === 'MSG_MAGIC_DRAIN') {
      same(calls.length, 2);
      assert(group.includes('you.has_mutation(MUT_HP_CASTING)'));
      add('hp_casting', calls[0], calls[0].format, [{ expression: 'you.has_mutation(MUT_HP_CASTING)', value: true }]);
      add('magic_energy', calls[1], calls[1].format, [{ expression: 'you.has_mutation(MUT_HP_CASTING)', value: false }]);
    } else {
      same(calls.length, 1, 'singleton emitter for ' + case_.identity);
      same(calls[0].arguments, []);
      assert(!calls[0].format.includes('%'), 'unexpected dynamic singleton');
      add('', calls[0], calls[0].format);
    }
  }
  same(records.length, 45, 'pinned variant count');
  const callCount = [...groups.values()].reduce((count, calls) => count + calls.length, 0);
  same(callCount, 40, 'pinned emitter call-site count');
  return { schema_version: 1, release: '0.34.1', commit: COMMIT, source: SOURCE,
    coverage: { enum_identities: 37, render_ids: 45, emitter_call_sites: 40 },
    source_files: sourceFiles, records };
}

export function renderCanned(catalog, id, params = {}) {
  assert(ID.test(id), 'invalid semantic ID');
  assert(Object.hasOwn(catalog, id), 'missing semantic ID');
  assert(params && typeof params === 'object' && !Array.isArray(params), 'parameters must be an object');
  same(Object.keys(params), [], 'canned variants take zero parameters');
  return catalog[id].text;
}

export function validateCatalogs(en, ja, map, expected) {
  same(map, expected, 'source registry, branch receipts and original control metadata');
  for (const [language, catalog] of [['en', en], ['ja', ja]]) {
    assert(catalog && typeof catalog === 'object' && !Array.isArray(catalog), 'catalog object');
    same(Object.keys(catalog).sort(), expected.records.map(record => record.id).sort(), language + ' complete ID set');
    for (const record of expected.records) {
      const entry = catalog[record.id];
      assert(entry && typeof entry === 'object' && !Array.isArray(entry), 'explicit typed entry');
      same(Object.keys(entry).sort(), ['params', 'text'], 'Catalog template fields');
      assert(typeof entry.text === 'string' && entry.text.length > 0, 'nonempty text');
      same(entry.params, {}, 'zero parameter schema');
      assert(!/[{}]/.test(entry.text), 'placeholder/schema mismatch');
      assert(!entry.text.includes('%s'), 'unexpanded upstream format');
      if (language === 'en') same(entry.text, record.english, 'exact original English expansion');
      else assert(/[\u3040-\u30ff\u3400-\u9fff]/.test(entry.text), 'Japanese content required');
      same(renderCanned(catalog, record.id, {}), entry.text);
    }
  }
  return { enum_identities: 37, bilingual_render_ids: 45, emitter_call_sites: 40,
    parameterized_entries: 0, verified_source_files: Object.keys(PINNED).length };
}

function runProbes(en, ja, map, expected) {
  let probes = 0;
  const rejected = callback => { assert.throws(callback); probes++; };
  rejected(() => parseStrictJson('{"id":1,"id":2}'));
  rejected(() => parseStrictJson('{"a":{"text":"x","text":"y"}}'));
  rejected(() => parseStrictJson('{"a":[{"id":1,"id":2}]}'));
  rejected(() => parseStrictJson('{"a":}'));
  const mutate = callback => {
    const values = [structuredClone(en), structuredClone(ja), structuredClone(map)];
    callback(...values); return () => validateCatalogs(...values, expected);
  };
  const first = expected.records[0].id;
  rejected(mutate(english => { delete english[first]; }));
  rejected(mutate((english, japanese) => { delete japanese[first]; }));
  rejected(mutate(english => { english['game.canned.extra'] = { text: 'Extra', params: {} }; }));
  rejected(mutate((english, japanese) => { japanese[first].text = 'English fallback'; }));
  rejected(mutate(english => { english[first].text = 'Changed original'; }));
  rejected(mutate(english => { english[first].params = { name: 'text' }; }));
  rejected(mutate((english, japanese) => { japanese[first].text += '{name}'; }));
  rejected(mutate(english => { english[first].extra = true; }));
  rejected(mutate((english, japanese, registry) => { registry.commit = '0'.repeat(40); }));
  rejected(mutate((english, japanese, registry) => { registry.records[0].channel_value = 99; }));
  rejected(mutate((english, japanese, registry) => { registry.records[0].nojoin = true; }));
  rejected(mutate((english, japanese, registry) => { registry.records[0].conditional.predicates[0].value = false; }));
  rejected(mutate((english, japanese, registry) => { registry.records[0].source_receipts[1].text += ' '; }));
  rejected(mutate((english, japanese, registry) => { registry.records.pop(); }));
  rejected(() => renderCanned(ja, 'game.canned.missing'));
  rejected(() => renderCanned(ja, first, { player: '猫' }));
  rejected(() => renderCanned(ja, first, { n: 2 }));
  rejected(() => renderCanned(ja, first, []));
  same(map.records.find(record => record.id === 'game.canned.you_die').nojoin, true); probes++;
  same(map.records.filter(record => record.nojoin).length, 1); probes++;
  same(map.records.find(record => record.id === 'game.canned.magic_drain.hp_casting').channel_value, 0); probes++;
  same(map.records.find(record => record.id === 'game.canned.magic_drain.magic_energy').channel_value, 6); probes++;
  same(map.records.find(record => record.id === 'game.canned.ok').channel_value, 2); probes++;
  same(map.records.find(record => record.id === 'game.canned.huh').channel_value, 24); probes++;
  same(map.records.filter(record => record.enum_identity === 'MSG_EMPTY_HANDED_ALREADY').length, 4); probes++;
  same(map.records.filter(record => record.enum_identity === 'MSG_EMPTY_HANDED_NOW').length, 4); probes++;
  return probes;
}

function main() {
  const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let sourceRoot = defaultRoot, catalogRoot = defaultRoot, selfTest = false;
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--self-test') selfTest = true;
    else if (args[index] === '--source-root' || args[index] === '--catalog-root') {
      assert(args[index + 1], 'missing path argument');
      if (args[index] === '--source-root') sourceRoot = path.resolve(args[++index]);
      else catalogRoot = path.resolve(args[++index]);
    } else throw Error('unknown argument: ' + args[index]);
  }
  const read = name => parseStrictJson(fs.readFileSync(path.join(catalogRoot, 'locales/gameplay', name), 'utf8'));
  const en = read('canned.en.json'), ja = read('canned.ja.json'), map = read('canned-source-map.json');
  const expected = buildSourceModel(sourceRoot);
  const result = validateCatalogs(en, ja, map, expected);
  const probes = selfTest ? runProbes(en, ja, map, expected) : 0;
  console.log(JSON.stringify({ ok: true, source: SOURCE, commit: COMMIT, ...result, self_test_probes: probes,
    proof: 'pinned source-byte hashes, actual enum/case/emitter extraction, exact receipts and bilingual schema',
    runtime_integration_verified: false, complete_gameplay_translation: false }, null, 2));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { main(); } catch (error) { console.error(error.stack ?? String(error)); process.exitCode = 1; }
}
