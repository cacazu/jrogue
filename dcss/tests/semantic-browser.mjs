// Real-browser assertions for the complete native core; no launcher here.
// Before navigation: await installSemanticBrowserProbe(cdp).
// After the Fighter player frame: await verifySemanticBrowser({cdp,until,evidence}).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstream = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const messageId = 'game.canned.no_spells';
const sources = [
  'crawl-ref/source/cmd-keys.h:83: I -> CMD_DISPLAY_SPELLS',
  'crawl-ref/source/main.cc:2244: CMD_DISPLAY_SPELLS -> inspect_spells',
  'crawl-ref/source/spl-cast.cc:694-699: !you.spell_no -> MSG_NO_SPELLS then return',
  'crawl-ref/source/message.cc:2035-2036: MSG_NO_SPELLS canonical emitter',
];
function evaluate(cdp, callback, ...args) {
  return cdp.eval('(' + callback.toString() + ')(' + args.map(arg => JSON.stringify(arg)).join(',') + ')');
}
function snapshot(cdp) {
  return evaluate(cdp, async function () {
    return {
      state: await __dcssCore.state(), events: __dcssVerification.semanticMessages,
      errors: __dcssVerification.semanticErrors, frames: __dcssCore.frames,
      language: __dcssVerification.language, documentLanguage: document.documentElement.lang,
      player: document.querySelector('#player').value,
      panelHidden: document.querySelector('#semantic-panel').hidden,
      lines: Array.from(document.querySelector('#semantic-messages').children, node => ({
        sequence: node.dataset.sequence, channel: node.dataset.channel,
        text: node.textContent, children: node.childElementCount,
      })),
      announcer: document.querySelector('#semantic-announcer').textContent,
    };
  });
}
function assertStreams(state) {
  assert.equal(state.rng.length, 45, 'snapshot must expose all 45 native streams');
  for (const stream of state.rng) {
    for (const field of ['state', 'sequence', 'draws']) {
      assert.equal(typeof stream[field], 'string', 'PCG u64 precision must survive transport');
      assert.match(stream[field], /^(?:0|[1-9][0-9]*)$/);
      assert(BigInt(stream[field]) <= 0xffffffffffffffffn);
    }
  }
}
function assertSequences(events) {
  let previous = 0n;
  for (const event of events) {
    assert.equal(typeof event.sequence, 'string');
    assert.match(event.sequence, /^[1-9][0-9]*$/);
    const sequence = BigInt(event.sequence);
    assert(sequence > previous && sequence <= 0xffffffffffffffffn, 'native u64 event sequences must strictly increase');
    previous = sequence;
  }
}
function assertProjection(actual, baseline, language, catalog) {
  assert.equal(actual.errors, 0, 'no semantic transport or validation errors');
  assert.equal(actual.language, language);
  assert.equal(actual.documentLanguage, language);
  assert.equal(actual.panelHidden, false);
  assert.equal(actual.player, baseline.player, 'external player name must stay verbatim');
  assert.deepEqual(actual.events, baseline.events, 'locale/redraw must retain exact descriptors');
  assert.deepEqual(actual.state, baseline.state, 'locale/redraw must preserve state and all 45 PCG words/counters');
  assert.deepEqual(actual.lines.map(line => line.sequence), actual.events.map(event => event.sequence));
  for (const event of actual.events) {
    const line = actual.lines.find(candidate => candidate.sequence === event.sequence);
    assert(line, 'retained event must have exactly one DOM line');
    assert.equal(line.channel, String(event.channel));
    assert.equal(line.children, 0, 'semantic output must use plain text');
    const entry = catalog[event.message.id];
    assert(entry, 'native ID must be source-cataloged');
    assert.equal(line.text, event.shout && language === 'en' ? entry.text.toUpperCase() : entry.text);
  }
}
const semanticCatalogGroups = [
  'locales/LANGUAGE.json', 'locales/entities/species.LANGUAGE.json',
  'locales/entities/jobs.LANGUAGE.json', 'locales/gameplay/canned.LANGUAGE.json',
  'locales/startup/LANGUAGE.json', 'locales/dynamic/LANGUAGE.json',
  'locales/hud/LANGUAGE.json',
];
function exactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), label + ' has unexpected or missing fields');
}
function templateKeys(text, label) {
  assert.equal(typeof text, 'string', label + ' must be text');
  assert(text.length > 0, label + ' must be nonempty');
  const keys = new Set();
  for (let i = 0; i < text.length; i++) {
    if ((text[i] === '{' || text[i] === '}') && text[i + 1] === text[i]) { i++; continue; }
    if (text[i] === '{') {
      const end = text.indexOf('}', i + 1);
      assert(end !== -1, label + ' has an unclosed placeholder');
      const key = text.slice(i + 1, end);
      assert.match(key, /^[a-z][a-z0-9_]*$/, label + ' has an invalid placeholder');
      keys.add(key); i = end;
    } else {
      assert(text[i] !== '}', label + ' has an unmatched closing brace');
    }
  }
  return [...keys].sort();
}
function validateParameterSchema(schema, label, dynamic) {
  if (!dynamic) {
    assert(['text', 'decimal', 'unsigned', 'integer', 'quantity'].includes(schema), label + ' has an unsupported scalar schema');
    return;
  }
  assert(schema && typeof schema === 'object' && !Array.isArray(schema), label + ' must be a typed descriptor schema');
  const fields = {
    entity_label: ['kind', 'version', 'domain', 'form'],
    actor_label: ['kind', 'version', 'visibility', 'form'],
    rich_text: ['kind', 'version'], quantity: ['kind', 'version'],
    item_label: ['kind', 'version', 'visibility', 'form'],
    command_ref: ['kind', 'version', 'command', 'binding'],
  };
  assert(Object.hasOwn(fields, schema.kind), label + ' has an unsupported descriptor kind');
  exactKeys(schema, fields[schema.kind], label);
  assert.equal(schema.version, 1, label + ' has an unsupported descriptor version');
  if (schema.kind === 'entity_label') {
    assert(['species', 'job'].includes(schema.domain), label + ' has an unsupported entity domain');
    assert.equal(schema.form, 'name');
  } else if (schema.kind === 'actor_label') {
    assert.equal(schema.visibility, 'external'); assert.equal(schema.form, 'name');
  } else if (schema.kind === 'item_label') {
    assert.equal(schema.visibility, 'base'); assert.equal(schema.form, 'base_name');
  } else if (schema.kind === 'command_ref') {
    assert.equal(schema.command, 'command.display_spells'); assert.equal(schema.binding, 'native_resolved');
  }
}
function validateCatalogEntry(id, entry, dynamic) {
  if (typeof entry === 'string') {
    assert.deepEqual(templateKeys(entry, id), [], id + ' primitive text cannot have parameters');
    return {};
  }
  const plural = Object.hasOwn(entry ?? {}, 'one') || Object.hasOwn(entry ?? {}, 'other');
  assert(!dynamic || !plural, id + ' typed entries must use the text/params shape');
  exactKeys(entry, plural ? ['one', 'other', 'params'] : ['text', 'params'], id);
  assert(entry.params && typeof entry.params === 'object' && !Array.isArray(entry.params), id + ' params must be an object');
  const parameters = Object.keys(entry.params).sort();
  for (const [name, schema] of Object.entries(entry.params)) {
    assert.match(name, /^[a-z][a-z0-9_]*$/);
    validateParameterSchema(schema, id + '.' + name, dynamic);
  }
  for (const text of plural ? [entry.one, entry.other] : [entry.text]) {
    assert.deepEqual(templateKeys(text, id), parameters, id + ' placeholder/parameter mismatch');
  }
  return entry.params;
}
// Source-only QA can invoke this projection without starting Chrome or loading WASM.
export function projectSemanticCatalogs(catalogs, sourceMaps) {
  const dynamicMap = sourceMaps.dynamic, hudMap = sourceMaps.hud;
  for (const map of [dynamicMap, hudMap]) {
    assert.equal(map.schema_version, 1); assert.equal(map.release, '0.34.1'); assert.equal(map.commit, upstream);
  }
  assert.equal(dynamicMap.messages.length, 12);
  assert.equal(dynamicMap.boundary_messages.length, 4);
  assert.equal(dynamicMap.rich_labels.length, 27);
  assert.equal(hudMap.messages.length, 22);
  const boundaryText = {
    'boundary.dynamic.rich_text': '{content}', 'boundary.dynamic.quantity': '{quantity}',
    'boundary.dynamic.item_base': '{item}', 'boundary.dynamic.command_token': '{command}',
  };
  const dynamicMessages = new Map();
  for (const message of [...dynamicMap.messages, ...dynamicMap.boundary_messages]) {
    assert(!dynamicMessages.has(message.id), 'duplicate dynamic source ID');
    if (message.id.startsWith('boundary.')) {
      assert(Object.hasOwn(boundaryText, message.id), 'unknown presentation-boundary ID');
      assert.equal(message.native_emission, false, 'presentation-boundary API must not claim a native emitter');
    } else {
      assert.equal(typeof message.expected_en, 'string');
    }
    dynamicMessages.set(message.id, message);
  }
  const dynamicIds = [...dynamicMessages.keys(), ...dynamicMap.rich_labels].sort();
  assert.equal(new Set(dynamicIds).size, 43, 'dynamic source registry must contain 43 distinct IDs');
  const hudMessages = new Map(hudMap.messages.map(message => [message.id, message]));
  assert.equal(hudMessages.size, 22, 'duplicate HUD source ID');
  const embedded = { en: {}, ja: {} }, canned = {}, fixed = { en: {}, ja: {} };
  for (const language of ['en', 'ja']) {
    assert.deepEqual(Object.keys(catalogs[language]).sort(), [...semanticCatalogGroups].sort(), 'all current catalog groups are required');
    for (const group of semanticCatalogGroups) {
      const catalog = catalogs[language][group];
      assert(catalog && typeof catalog === 'object' && !Array.isArray(catalog), 'catalog must be an object');
      const dynamic = group === 'locales/dynamic/LANGUAGE.json';
      const hud = group === 'locales/hud/LANGUAGE.json';
      if (dynamic) assert.deepEqual(Object.keys(catalog).sort(), dynamicIds, 'dynamic catalog differs from its complete source registry');
      if (hud) assert.deepEqual(Object.keys(catalog).sort(), [...hudMessages.keys()].sort(), 'HUD catalog differs from its complete source registry');
      let typedDynamic = 0;
      for (const [id, entry] of Object.entries(catalog)) {
        assert(!Object.hasOwn(embedded[language], id), 'duplicate embedded ID: ' + id);
        const params = validateCatalogEntry(id, entry, dynamic);
        if (dynamic) {
          const source = dynamicMessages.get(id);
          if (source) {
            assert.deepEqual(params, source.params, id + ' schema differs from its source contract');
            const text = typeof entry === 'string' ? entry : entry.text;
            if (language === 'en' || id.startsWith('boundary.')) {
              assert.equal(text, Object.hasOwn(boundaryText, id) ? boundaryText[id] : source.expected_en, id + ' template differs from its source contract');
            }
            if (id === 'startup.dynamic.welcome.empty') assert.equal(typeof entry, 'string');
            else { assert.equal(typeof entry, 'object'); assert(Object.keys(params).length > 0); typedDynamic++; }
          } else {
            assert.equal(typeof entry, 'string', id + ' registered label must be primitive');
          }
        }
        if (hud) {
          assert.equal(typeof entry, 'string', id + ' fixed HUD text must be primitive');
          assert.deepEqual(hudMessages.get(id).params, {});
          if (language === 'en') assert.equal(entry, hudMessages.get(id).expected_en);
        }
        embedded[language][id] = entry;
        // Only validated, parameter-free entries belong to op:catalog.
        if (Object.keys(params).length === 0) fixed[language][id] = typeof entry === 'string' ? entry : entry.text;
      }
      if (dynamic) assert.equal(typedDynamic, 15, 'all 15 dynamic typed entries must be validated before exclusion');
    }
    canned[language] = catalogs[language]['locales/gameplay/canned.LANGUAGE.json'];
    assert.equal(Object.keys(canned[language]).length, 45);
  }
  assert.deepEqual(Object.keys(embedded.en).sort(), Object.keys(embedded.ja).sort());
  for (const id of Object.keys(embedded.en)) {
    assert.deepEqual(typeof embedded.en[id] === 'string' ? {} : embedded.en[id].params,
      typeof embedded.ja[id] === 'string' ? {} : embedded.ja[id].params, id + ' bilingual parameter schemas differ');
  }
  return { embedded, canned, fixed };
}
async function fixtures() {
  const catalogs = { en: {}, ja: {} }, sourceMaps = {};
  for (const language of ['en', 'ja']) {
    for (const group of semanticCatalogGroups) {
      catalogs[language][group] = JSON.parse(await readFile(path.join(root, group.replace('LANGUAGE', language)), 'utf8'));
    }
  }
  for (const category of ['dynamic', 'hud']) {
    sourceMaps[category] = JSON.parse(await readFile(path.join(root, 'locales', category, 'source-map.json'), 'utf8'));
  }
  return projectSemanticCatalogs(catalogs, sourceMaps);
}

export async function installSemanticBrowserProbe(cdp) {
  function install() {
    const probe = { beats: 0, maxGapMs: 0, began: performance.now(), previous: performance.now() };
    probe.timer = setInterval(() => {
      const now = performance.now();
      probe.maxGapMs = Math.max(probe.maxGapMs, now - probe.previous);
      probe.previous = now; probe.beats++;
    }, 50);
    // Keep ordinary Player intact. Original ng-input.cc:71-93 rejects
    // combining marks via iswalnum; never force an invalid startup name.
    Object.defineProperty(window, '__dcssSemanticBrowserProbe', { value: probe, configurable: true });
  }
  await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: '(' + install.toString() + ')()' });
}

export async function verifySemanticBrowser({ cdp, until, evidence, maxStartupGapMs = 10000 }) {
  const record = evidence.semanticBrowser = {
    result: 'running', source: 'canned-v1', trigger: 'ordinary uppercase I keyboard command',
    command_sources: sources, wizard_commands_used: false,
    synthetic_native_events_or_frames: false, checks: [],
  };
  const check = label => { record.checks.push(label); evidence.checks.push(label); };
  const fixture = await fixtures();
  record.embedded_catalog_ids_per_language = Object.keys(fixture.embedded.en).length;
  record.static_catalog_ids_per_language = Object.keys(fixture.fixed.en).length;
  const heartbeat = await evaluate(cdp, function () {
    const probe = window.__dcssSemanticBrowserProbe;
    if (!probe) throw Error('semantic startup probe must be installed before navigation');
    clearInterval(probe.timer);
    return { beats: probe.beats, maxGapMs: probe.maxGapMs, elapsedMs: performance.now() - probe.began };
  });
  record.startup_main_thread = heartbeat;
  assert(heartbeat.beats >= 2, 'main-thread heartbeat must run during authentic startup');
  assert(heartbeat.maxGapMs < maxStartupGapMs, 'main thread stalled during Worker startup');
  assert.equal(await evaluate(cdp, function () {
    return 'module' in __dcssCore || typeof window.createDcssEngine === 'function';
  }), false);
  check('Classic Worker startup keeps main-thread heartbeat running and exposes no C++ module');

  const initial = await snapshot(cdp);
  assertStreams(initial.state); assertSequences(initial.events);
  assert.equal(initial.errors, 0);
  assert.equal(initial.language, 'ja', 'Japanese must be the default presentation language');
  assert.equal(initial.documentLanguage, 'ja');
  assert.equal(await evaluate(cdp, function () { return document.querySelector('#job').value; }), 'Fi');
  record.initial_player = initial.player; record.initial_turn = initial.state.turn;

  for (let ordinal = 1; ordinal <= 2; ordinal++) {
    const before = await snapshot(cdp), previousSequence = before.events.at(-1)?.sequence ?? '0';
    await evaluate(cdp, function () { document.querySelector('#console').focus(); });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'I', code: 'KeyI', text: 'I', modifiers: 8 });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'I', code: 'KeyI', modifiers: 8 });
    await until(() => evaluate(cdp, function (previous, id) {
      if (__dcssCore.error) throw Error(__dcssCore.error);
      if (__dcssVerification.semanticErrors) throw Error('native semantic observer rejected an event');
      return __dcssCore.waiting && __dcssVerification.semanticMessages.some(event =>
        BigInt(event.sequence) > BigInt(previous) && event.message.id === id);
    }, previousSequence, messageId), 'ordinary native no-spells event ' + ordinal);
    const after = await snapshot(cdp);
    const added = after.events.filter(event => BigInt(event.sequence) > BigInt(previousSequence));
    assert.equal(added.length, 1, 'one canonical emitter must produce exactly one observation');
    const event = added[0];
    assert.equal(event.version, 1); assert.equal(event.source, 'canned-v1');
    assert.equal(event.upstream, upstream); assert.equal(event.message.id, messageId);
    assert.deepEqual(event.message.params, {}); assert.equal(event.channel, 0);
    assert.equal(event.param, 0); assert.equal(event.nojoin, false);
    assert.equal(event.shout, false, 'ordinary starting Fighter has no quad-damage shout');
    for (const flag of ['join', 'more', 'flash']) assert.equal(typeof event[flag], 'boolean');
    assert(Number.isInteger(event.colour) && event.colour >= 0 && event.colour <= 15);
    assert.equal(event.turn, before.state.turn);
    assert.equal(after.state.turn, before.state.turn, 'no-spells information takes no native turn');
    for (const key of ['x', 'y', 'hp', 'maxHp', 'xl', 'branch', 'depth', 'seed']) {
      assert.equal(after.state[key], before.state[key], 'informational command changed player ' + key);
    }
    assertStreams(after.state); assertSequences(after.events);
    record['native_event_' + ordinal] = event;
    // Preserve native UI behavior. Rendering purity starts after this genuine
    // command, rather than assuming native UI code never draws from UI RNG.
    record['command_rng_changed_streams_' + ordinal] = after.state.rng.flatMap((stream, index) =>
      JSON.stringify(stream) === JSON.stringify(before.state.rng[index]) ? [] : [index]);
  }
  check('Real keyboard I produces one source-tagged no-spells event per command with increasing u64 sequences');

  const baseline = await snapshot(cdp);
  await evaluate(cdp, function () {
    window.__dcssSemanticBrowserNodes = Array.from(document.querySelector('#semantic-messages').children);
  });
  const lastEvent = baseline.events.at(-1);
  const rendering = await evaluate(cdp, function (event) {
    return ['ja', 'en'].map(language => ({
      language, response: __dcssVerification.call({ op: 'game_message', language, event }),
    }));
  }, lastEvent);
  for (const { language, response } of rendering) {
    assert.equal(response.ok, true); assert.deepEqual(response.value.event, lastEvent);
    assert.equal(response.text[0], fixture.canned[language][messageId].text);
  }
  check('Actual native descriptor renders exact English and Japanese through Rust without metadata changes');

  try {
    for (const language of ['en', 'ja', 'en', 'ja']) {
      await evaluate(cdp, function (selected) {
        const select = document.querySelector('#language');
        select.value = selected; select.dispatchEvent(new Event('change', { bubbles: true }));
      }, language);
      const catalog = await evaluate(cdp, function () { return __dcssVerification.call({ op: 'catalog' }).value; });
      assert.deepEqual(catalog, fixture.fixed[language], 'WASM fixed catalog differs from current source catalogs');
      const actual = await snapshot(cdp);
      assertProjection(actual, baseline, language, fixture.canned[language]);
      assert.equal(actual.frames, baseline.frames, 'locale rendering must not request native repaint');
      assert.equal(actual.announcer, baseline.announcer, 'locale redraw must not reannounce old events');
      assert.equal(await evaluate(cdp, function () {
        return window.__dcssSemanticBrowserNodes.every((node, index) =>
          document.querySelector('#semantic-messages').children[index] === node);
      }), true, 'locale redraw must preserve native history DOM nodes');
    }
    const repaintCount = 10;
    await evaluate(cdp, async function (count) {
      for (let index = 0; index < count; index++) await __dcssCore.repaint();
    }, repaintCount);
    const after = await snapshot(cdp);
    assertProjection(after, baseline, 'ja', fixture.canned.ja);
    assert(after.frames >= baseline.frames + repaintCount, 'repaint requests must actually return frames');
    assert.equal(after.announcer, baseline.announcer);
    record.final_turn = after.state.turn; record.final_streams = after.state.rng;
    record.retained_native_sequences = after.events.map(event => event.sequence);
    check('Four locale changes preserve DOM history, external name and all45 native PCG states/streams/draws');
    check('Ten real Worker repaints return frames without messages, turns or any native RNG consumption');
    record.result = 'pass';
  } finally {
    await evaluate(cdp, function () { delete window.__dcssSemanticBrowserNodes; });
  }
  return record;
}

// Optional separate pass after an original input context genuinely accepts
// Unicode text. No name injection or synthetic frame. Combining marks are
// invalid player names under ng-input.cc:71-93; use another accepted context.
export async function verifyAcceptedNativeUnicodeFrame(cdp, { text, wideCharacter, combiningCluster }) {
  assert.equal(typeof text, 'string'); assert(text.length > 0);
  const observed = await evaluate(cdp, function () {
    const frame = __dcssVerification.frame;
    return { columns: frame.columns, rows: frame.rows, cells: frame.cells,
      errors: __dcssVerification.semanticErrors, player: document.querySelector('#player').value };
  });
  assert.equal(observed.errors, 0);
  const rows = Array.from({ length: observed.rows }, (_, row) => observed.cells
    .slice(row * observed.columns, (row + 1) * observed.columns)
    .map(cell => cell.text ?? (cell.glyph ? String.fromCodePoint(cell.glyph) : '')).join(''));
  assert(rows.some(row => row.includes(text)), 'actual native frame must retain accepted exact Unicode text');
  if (combiningCluster !== undefined) {
    assert(observed.cells.some(cell => cell.text === combiningCluster), 'native cluster was lost or normalized');
  }
  if (wideCharacter !== undefined) {
    assert.equal(Array.from(wideCharacter).length, 1);
    const scalar = wideCharacter.codePointAt(0);
    assert(observed.cells.some((cell, index) => cell.glyph === scalar
      && index % observed.columns + 1 < observed.columns
      && observed.cells[index + 1].glyph === 0), 'native wide glyph lacks its zero-scalar continuation');
  }
  return { accepted_text: text, wide_character: wideCharacter, combining_cluster: combiningCluster,
    actual_native_frame: true, synthetic_frame: false };
}

