'use strict';
const assert = require('node:assert/strict');
const { runWorkerInContext, readWorkerSource, ID, PIN } = require('./startup-bridge-mock.cjs');
const checks = [];
const settle = () => new Promise(setImmediate);
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(mock = {}) {
  const posts = [], events = [], listeners = {}, writes = [];
  let engineOptions, factories = 0;
  const self = {
    postMessage(message) { posts.push(structuredClone(message)); },
    addEventListener(name, callback) { listeners[name] = callback; },
  };
  const engine = { FS: { mkdirTree() { events.push('filesystem'); }, writeFile(name, bytes) { writes.push([name, [...bytes]]); } } };
  const bridge = runWorkerInContext(readWorkerSource(), {
    self, Error, queueMicrotask, Uint8Array, Uint32Array,
    WebAssembly: { Suspending() {}, promising() {} },
    importScripts(script) {
      events.push('engine-import:' + script);
      self.createDcssEngine = async options => {
        events.push('engine-factory'); factories++; engineOptions = options; return engine;
      };
    },
  }, { ...mock, events });
  const send = async data => { await self.onmessage({ data }); await settle(); };
  const boot = (extra = {}) => send({ type: 'request', id: 1, op: 'boot', files: [], ...extra });
  const response = id => posts.find(value => value.type === 'response' && value.id === id);
  return { posts, events, listeners, writes, bridge, send, boot, response,
    get options() { return engineOptions; }, get factories() { return factories; } };
}
function rejectedOnce(test, pattern) {
  assert.equal(test.posts.filter(value => value.type === 'response' && value.id === 1).length, 1);
  assert.equal(test.response(1).ok, false); assert.match(test.response(1).error, pattern);
  assert.equal(test.posts.filter(value => value.type === 'fatal').length, 1);
  assert.equal(test.factories, 0); assert.equal(test.writes.length, 0);
  assert.equal(test.events.some(value => value.startsWith('engine-import:') || value === 'filesystem'), false);
}
(async () => {
  for (const [runtime, language] of [['asyncify', undefined], ['asyncify', 'en'], ['jspi', 'ja'], ['jspi', 'en']]) {
    const selected = language ?? 'ja', test = fixture();
    await test.boot({ runtime, ...(language === undefined ? {} : { language }) });
    assert.equal(test.response(1).ok, true); assert.equal(test.bridge.bridge.language, selected);
    assert.equal(test.factories, 1);
    assert.deepEqual(test.bridge.requests.map(request => ({ language: request.language, message: request.message })),
      PIN.ids.flatMap(id => ['en', 'ja'].map(language => ({ language, message: { id, params: PIN.messages[id].preflight_params } }))));
    assert.equal(test.bridge.instantiateCalls, 1); assert.equal(test.bridge.releases.length, PIN.ids.length * 4);
    assert.deepEqual(test.bridge.assetPaths, [...PIN.catalogs.map(pin => pin.path), PIN.boundary.path]);
    const factory = test.events.indexOf('engine-factory');
    for (const event of ['rust-text:en', 'rust-text:ja', 'preflight:finish:' + selected]) {
      assert(test.events.indexOf(event) < factory, event + ' before engine factory');
    }
    const build = runtime === 'jspi' ? '/engine/build-jspi/' : '/engine/build/';
    assert(test.events.includes('engine-import:' + build + 'dcss.js'));
    assert.equal(test.options.locateFile('dcss.wasm'), build + 'dcss.wasm');
    assert.equal(test.options.dcssFormatStartup(ID, {}), PIN.messages[ID][selected]);
    assert.equal(test.bridge.requests.at(-1).language, selected);
    assert.throws(() => test.options.dcssFormatStartup('startup.invalid', {}), /unreviewed native display ID/);
    assert.throws(() => test.options.dcssFormatStartup(ID, { unexpected: 1 }), /unreviewed native display parameter keys/);
    const speciesId = 'startup.dynamic.species_name';
    const species = structuredClone(PIN.messages[speciesId].preflight_params);
    assert.equal(test.options.dcssFormatStartup(speciesId, species), PIN.entityRegistry.species[species.species.id][selected]);
    species.species.extra = true;
    assert.throws(() => test.options.dcssFormatStartup(speciesId, species), /unreviewed native entity label descriptor/);
    const wrongDomain = structuredClone(PIN.messages[speciesId].preflight_params);
    wrongDomain.species.domain = 'job';
    assert.throws(() => test.options.dcssFormatStartup(speciesId, wrongDomain), /unreviewed native entity label descriptor/);
    const unknownEntity = structuredClone(PIN.messages[speciesId].preflight_params);
    unknownEntity.species.id = 'species.unreviewed.name';
    assert.throws(() => test.options.dcssFormatStartup(speciesId, unknownEntity), /unreviewed native entity label descriptor/);
    const actorId = 'startup.dynamic.welcome.named_only';
    const actor = structuredClone(PIN.messages[actorId].preflight_params);
    actor.player_name.identity.name = 'Kit猫';
    assert.equal(test.options.dcssFormatStartup(actorId, actor), PIN.messages[actorId][selected].replace('{player_name}', 'Kit猫'));
    actor.player_name.identity.name = 'bad\nname';
    assert.throws(() => test.options.dcssFormatStartup(actorId, actor), /unreviewed native external actor descriptor/);
    const actorExtra = structuredClone(PIN.messages[actorId].preflight_params);
    actorExtra.player_name.identity.extra = true;
    assert.throws(() => test.options.dcssFormatStartup(actorId, actorExtra), /unreviewed native external actor descriptor/);
    test.options.dcssStartupTextError('bounded diagnostic');
    assert.deepEqual(test.posts.at(-1), { type: 'startup-text-error', error: 'bounded diagnostic' });
    assert.equal(test.posts.some(value => value.type === 'fatal'), false);
    checks.push(runtime + ' ' + (language ?? 'default-ja') + ' preflights all45 typed V2 IDs in EN/JA before factory; preserves locale/external names and rejects malformed descriptors');
  }
  for (const mock of [{ importError: new Error('import refused') },
    { preflightError: new Error('preflight refused') },
    { corruptAsset: '/locales/startup/source-map.json' }]) {
    const test = fixture(mock); await test.boot();
    rejectedOnce(test, /refused|checksum mismatch/);
    assert.equal(test.bridge.instantiateCalls, 0);
    checks.push('bridge ' + Object.keys(mock)[0] + ' fails before engine import/factory/filesystem');
  }
  const invalid = fixture(); await invalid.boot({ language: 'de' });
  rejectedOnce(invalid, /unsupported native display locale/);
  assert.equal(invalid.bridge.assetPaths.length, 0);
  checks.push('unsupported native language fails before asset fetch or engine factory');
  for (const phase of ['import', 'preflight']) {
    const gate = deferred(), test = fixture({ [phase + 'Gate']: gate.promise });
    const pending = test.boot(); await settle();
    assert.equal(test.response(1), undefined); assert.equal(test.factories, 0);
    assert(test.events.includes(phase === 'import' ? 'bridge-import:start' : 'preflight:start:ja'));
    const error = new Error('terminal during pending ' + phase);
    test.listeners.error({ error }); await settle();
    rejectedOnce(test, /terminal during pending/);
    gate.resolve(); await pending; await settle();
    rejectedOnce(test, /terminal during pending/);
    assert.equal(test.bridge.loadCalls, phase === 'import' ? 0 : 1);
    checks.push('terminal while pending ' + phase + ' settles once and blocks late engine factory continuation');
  }
  const rejectedGate = deferred(), late = fixture({ preflightGate: rejectedGate.promise });
  const latePending = late.boot(); await settle();
  late.listeners.unhandledrejection({ reason: new Error('terminal first'), preventDefault() {} });
  rejectedGate.reject(new Error('late preflight rejection')); await latePending; await settle();
  rejectedOnce(late, /terminal first/);
  checks.push('late preflight rejection after terminal cannot duplicate response/fatal or reach factory');
  const dead = fixture(); await dead.boot({ language: 'en' });
  dead.options.onAbort('terminal after boot');
  const requestsBefore = dead.bridge.requests.length;
  assert.throws(() => dead.options.dcssFormatStartup(ID, {}), /terminal after boot/);
  assert.equal(dead.bridge.requests.length, requestsBefore);
  checks.push('startup formatter terminal guard blocks calls into bridge after abort');
  console.log(JSON.stringify({ kind: 'V2 startup Worker readiness with pinned JS bridge and mock ABI exports',
    count: checks.length, checks, actual_engine_executed: false, actual_wasm_executed: false,
    actual_wasm_instantiated: false, browser_executed: false, production_asset_checks_executed: true,
    production_bridge_preflight_executed: true, native_gameplay_or_rng_proved: false }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
