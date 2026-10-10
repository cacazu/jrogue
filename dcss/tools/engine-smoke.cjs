// Observe the complete official engine; this fixture does not replace its rules.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const startupFixture = require('./startup-fixture.cjs');
const nativeEnvelopeFixture = require('./native-envelope-fixture.cjs');
const promptCalls = receipt => typeof startupFixture.promptCalls==='function' ? startupFixture.promptCalls(receipt) : receipt.formatCalls;
const NATIVE_LANGUAGE = startupFixture.language(process.env.DCSS_NATIVE_LANGUAGE ?? 'ja');
const gameRoot = path.resolve(__dirname, '..');
const ENGINE_MODE = process.env.DCSS_ENGINE_MODE || 'asyncify';
assert(['asyncify','jspi'].includes(ENGINE_MODE), 'DCSS_ENGINE_MODE must be asyncify or jspi');
const build = path.resolve(__dirname, ENGINE_MODE==='jspi' ? '../engine/build-jspi' : '../engine/build');
const UPSTREAM = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const U64_MAX = (1n << 64n) - 1n;
const STREAMS = 45;
const BASELINE_REQUESTED = process.env.DCSS_WASM_BASELINE==='1';
const COMPILER_MODE = process.execArgv.includes('--liftoff-only') ? 'baseline-noTurboFan' : 'optimized-default';
const semanticEvents = [], semanticErrors = [];
let mod, pendingKey, lastFrame, frames = 0, failure, throwSemantic = false;
const mainLifetime = {kind:null, settled:false, exitStatus:null, acceptedExitZero:false};
const logs = [];
const result = {engine:'dcss-0.34.1', engineMode:ENGINE_MODE, tests:[], processId:process.pid,
  progress:[], mainLifetime};
result.runtime = {wasmCompilationTasks:1, execArgv:[...process.execArgv],
  explicitMainStartup:true,
  engineMode:ENGINE_MODE, jspiEnabled:process.execArgv.includes('--experimental-wasm-jspi'),
  compilerMode:COMPILER_MODE, baselineRequested:BASELINE_REQUESTED,
  diagnosticOnly:BASELINE_REQUESTED || COMPILER_MODE==='baseline-noTurboFan'};
assert(process.execArgv.includes('--wasm-num-compilation-tasks=1'),
  'Run this full-core diagnostic fixture with explicit --wasm-num-compilation-tasks=1; memory mitigation is not yet proven');
assert(!BASELINE_REQUESTED || process.execArgv.includes('--liftoff-only'),
  'DCSS_WASM_BASELINE=1 requires outer Node --liftoff-only; this is an explicitly diagnostic compiler mode');
assert(ENGINE_MODE!=='jspi' || result.runtime.jspiEnabled,
  'JSPI fixture requires outer Node --experimental-wasm-jspi');
Object.assign(result, artifactIdentity());
result.sourceContracts = {
  command:{file:'upstream/crawl-ref/source/cmd-keys.h', line:83,
    sha256:'3c7fa51c94ca8695d7459a0e720e43b5aa5cb341a46815a06641c7ca0538ecd9',
    key:73, name:'CMD_DISPLAY_SPELLS'},
  noSpells:{file:'upstream/crawl-ref/source/spl-cast.cc', lines:[694,699],
    sha256:'5bbfdd2519ee1f22a449b277833bf1b2c9c7b716def88019e78bea4e2f87b94c',
    condition:'!you.spell_no', canned:'MSG_NO_SPELLS'},
  message:{file:'upstream/crawl-ref/source/message.cc', lines:[2035,2036],
    sha256:'63d0aa5d84e3f82301fb948d0f4e4c80bc113971aa273ade7ae539c8844a4784',
    id:'game.canned.no_spells', original:"You don't know any spells."},
  weaponPrompt:{file:'upstream/crawl-ref/source/newgame.cc', line:1837,
    original:'You have a choice of weapons.', fixture:'Minotaur Fighter, no weapon CLI option'},
  nativeCommandBoundary:{input:'upstream/crawl-ref/source/main.cc:2816-2818 clear_messages()',
    flush:'upstream/crawl-ref/source/message.cc:1853-1859 flush_prev_message()',
    newCommand:'upstream/crawl-ref/source/message.cc:1716-1725 msgwin_new_cmd()',
    note:'A canonical repeat marker cannot be assumed across separate input commands.'},
};
const deadline = Date.now() + 300000;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function artifactIdentity() {
  const manifestBytes = fs.readFileSync(path.join(build, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.version, '0.34.1');
  assert.equal(manifest.upstream_commit, UPSTREAM, 'Fixture requires its reviewed upstream commit');
  assert(manifest.runtime===ENGINE_MODE || (ENGINE_MODE==='asyncify' && manifest.runtime===undefined),
    'Manifest runtime must match its selected fixed engine directory');
  const expectedNames = ['dcss.data','dcss.js','dcss.wasm'];
  assert(Array.isArray(manifest.outputs));
  assert.deepEqual(manifest.outputs.map(output => output.name).sort(), expectedNames);
  const artifacts = manifest.outputs.map(output => {
    assert(Number.isSafeInteger(output.bytes) && output.bytes>0);
    assert(typeof output.sha256==='string' && /^[0-9a-f]{64}$/.test(output.sha256));
    const bytes = fs.readFileSync(path.join(build, output.name));
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(bytes.length, output.bytes, 'Artifact byte count must match manifest: '+output.name);
    assert.equal(hash, output.sha256, 'Artifact SHA must match manifest: '+output.name);
    return {name:output.name, bytes:bytes.length, sha256:hash};
  }).sort((a,b) => a.name.localeCompare(b.name));
  return {upstreamCommit:manifest.upstream_commit, engineMode:ENGINE_MODE,
    startupTextManifest:startupFixture.manifestIdentity(manifest),
    manifestRuntime:manifest.runtime || 'asyncify',
    runtimeMetadata:manifest.runtime===undefined ? 'legacy-fixed-directory' : 'explicit-manifest',
    manifestSha256:crypto.createHash('sha256').update(manifestBytes).digest('hex'), artifacts};
}
function mainFailure(error) {
  mainLifetime.settled = true;
  if (error && error.name==='ExitStatus' && error.status===0 && mainLifetime.exitStatus===0) {
    mainLifetime.acceptedExitZero = true;
    return;
  }
  mainLifetime.error = String(error);
  failure = error instanceof Error ? error : new Error('Official main lifetime failed: '+String(error));
}
function launchMain(argv) {
  try {
    const lifetime = mod.callMain(argv);
    const promising = lifetime && typeof lifetime.then==='function';
    assert(ENGINE_MODE!=='jspi' || promising, 'JSPI callMain must expose its promised game lifetime');
    mainLifetime.kind = promising ? 'promise' : 'asyncify-suspended-call';
    // The game loop awaits host input indefinitely. Observe failures without
    // awaiting its lifetime before the fixture sends its first input.
    if (promising) Promise.resolve(lifetime).then(() => {mainLifetime.settled = true;}, mainFailure);
  } catch (error) {
    mainFailure(error);
    if (failure) throw failure;
  }
}
function progress(stage) {
  const memory = process.memoryUsage();
  result.progress.push({stage, timeUtc:new Date().toISOString(),
    // Unexported Emscripten Module properties may be aborting getters.
    // Receipt diagnostics never probe them or change the engine ABI.
    wasmHeapBytes:null, wasmHeapUnavailableReason:'heap-view-not-exported',
    jsHeapUsedBytes:memory.heapUsed, rssBytes:memory.rss});
  fs.writeFileSync(path.join(build, 'smoke-progress.json'), JSON.stringify({version:1,
    processId:process.pid, runtime:result.runtime, progress:result.progress}, null, 2));
}
function u64(value, label) {
  assert.equal(typeof value, 'string', label+' must remain an exact decimal string');
  assert(/^(?:0|[1-9][0-9]*)$/.test(value), label+' must be canonical unsigned decimal');
  const integer = BigInt(value);
  assert(integer <= U64_MAX, label+' must fit u64');
  return integer;
}
function validateSnapshot(state) {
  assert.equal(state.engine, 'dcss-0.34.1');
  u64(state.seed, 'seed');
  assert(Array.isArray(state.rng));
  assert.equal(state.rng.length, STREAMS, 'Observer must expose all 45 ordered official generators');
  state.rng.forEach((rng, i) => {
    assert.deepEqual(Object.keys(rng).sort(), ['draws','sequence','state']);
    u64(rng.state, 'rng['+i+'].state');
    assert.equal(u64(rng.sequence, 'rng['+i+'].sequence') & 1n, 1n, 'PCG increment must be odd');
    u64(rng.draws, 'rng['+i+'].draws');
  });
  return state;
}
function screenText() {
  if (!lastFrame) return '';
  let out = '';
  out = startupFixture.decodeFrame(lastFrame);
  return out;
}
function snapshot() { return validateSnapshot(JSON.parse(mod.UTF8ToString(mod._dcss_snapshot_json()))); }
function saveFiles(directory='/persist') {
  const files = [];
  for (const name of mod.FS.readdir(directory).sort()) {
    if (name==='.' || name==='..') continue;
    const file = directory+'/'+name;
    if (mod.FS.isDir(mod.FS.stat(file).mode)) files.push(...saveFiles(file));
    else files.push({path:file, bytes:mod.FS.stat(file).size});
  }
  return files;
}
async function waitInput() {
  while (!pendingKey) {
    if (failure) throw failure;
    if (mainLifetime.exitStatus!==null) throw new Error('Official engine exited before expected input: '+mainLifetime.exitStatus);
    if (Date.now() > deadline) throw new Error('Timed out waiting for official engine input: '+screenText());
    await pause(20);
  }
  if (failure) throw failure;
}
async function key(value) {
  await waitInput();
  const wake = pendingKey; pendingKey = null;
  wake(value);
  await waitInput();
}
async function enterFixture() {
  const screens = [];
  let weaponPromptSeen = false;
  progress('beforeCallMain');
  launchMain(['-name','DcssTest','-species','Minotaur','-background','Fighter','-seed','424242']);
  await waitInput();
  for (let i=0; i<12; ++i) {
    const screen = screenText();
    screens.push(screen);
    if (startupFixture.observeStartupPrompt(screen, result.startupText, true)) {
      weaponPromptSeen = true;
      result.weaponPromptFrame = startupFixture.promptFrame(lastFrame,result.startupText);
    }
    const state = snapshot();
    if (state.hp > 0 && state.x >= 0 && state.y >= 0) {
      assert(weaponPromptSeen, 'This fixed Minotaur Fighter fixture must traverse the genuine weapon menu');
      assert.equal(state.seed, '424242', 'Official CLI seed must survive startup');
      assert.equal(new Set(state.rng.map(x => x.state+':'+x.sequence)).size, STREAMS);
      if (result.startupText.enabled) {
        assert(promptCalls(result.startupText)>0, 'Integrated prompt must come through the reviewed Rust formatter');
        assert.equal(result.startupText.errors.length,0);
      }
      result.startup = {weaponPromptSeen, nativeLanguage:result.startupText.language,
        weaponFrame:result.weaponPromptFrame, screens};
      progress('gameplayReady');
      return state;
    }
    await key(13);
  }
  throw new Error('Cannot enter official seeded gameplay: '+screenText());
}
function validateEvent(event) {
  assert.equal(event.version, 1);
  assert.equal(event.source, 'canned-v1');
  assert.equal(event.upstream, UPSTREAM);
  assert(u64(event.sequence, 'semantic sequence') > 0n);
  for (const name of ['turn','channel','param','colour']) assert(Number.isSafeInteger(event[name]), name+' must be an integer');
  assert(event.colour >= 0 && event.colour <= 15);
  for (const name of ['join','nojoin','more','flash','shout']) assert.equal(typeof event[name], 'boolean');
  assert(event.message && /^[a-z0-9._]+$/.test(event.message.id));
  assert.deepEqual(event.message.params, {});
}
function noSpellsEmission(first, turn) {
  const events = semanticEvents.slice(first);
  events.forEach(validateEvent);
  const matches = events.filter(event => event.message.id===result.sourceContracts.message.id);
  assert.equal(matches.length, 1, 'The genuine no-spells command must emit its source-tagged observation once');
  const event = matches[0];
  assert.equal(event.turn, turn);
  assert.equal(event.channel, 0); // MSGCH_PLAIN, original mpr default.
  assert.equal(event.param, 0);
  assert.equal(event.nojoin, false);
  assert.equal(event.shout, false); // This unmodified Minotaur Fighter has no quad-damage shout.
  assert(screenText().includes(result.sourceContracts.message.original), 'Canonical native message must still reach its frame');
  return events;
}
function drawDeltas(before, after) {
  return before.rng.map((rng, i) => {
    assert.equal(after.rng[i].sequence, rng.sequence);
    return ((BigInt(after.rng[i].draws)-BigInt(rng.draws)) & U64_MAX).toString();
  });
}
// pcg.cc:41-47 increments state by state*6364136223846793005+inc modulo 2^64.
// Advance with exponentiation so validation never loops once per native draw.
function advanceState(state, increment, delta) {
  let multiplier = 6364136223846793005n, plus = increment;
  let accumulatedMultiplier = 1n, accumulatedPlus = 0n;
  while (delta > 0n) {
    if (delta & 1n) {
      accumulatedMultiplier = accumulatedMultiplier * multiplier & U64_MAX;
      accumulatedPlus = (accumulatedPlus * multiplier + plus) & U64_MAX;
    }
    plus = (multiplier + 1n) * plus & U64_MAX;
    multiplier = multiplier * multiplier & U64_MAX;
    delta >>= 1n;
  }
  return (accumulatedMultiplier * state + accumulatedPlus) & U64_MAX;
}
function assertTrace(before, after, expectedDeltas) {
  assert.deepEqual(drawDeltas(before, after), expectedDeltas,
    'Observed command draws must match the comparator trace for all 45 streams');
  before.rng.forEach((rng, i) => assert.equal(after.rng[i].state,
    advanceState(BigInt(rng.state), BigInt(rng.sequence), BigInt(expectedDeltas[i])).toString(),
    'Native PCG state must agree with its diagnostic draw count at stream '+i));
}
async function repaintProof(state, eventCount, errorCount, label) {
  const formattingCalls = promptCalls(result.startupText);
  for (let i=0; i<25; ++i) mod._dcss_repaint();
  assert.equal(promptCalls(result.startupText),formattingCalls,'Redraw must not reconstruct the native startup prompt');
  assert.deepEqual(snapshot(), state, 'Cached redraw must preserve observed player fields, all 90 PCG words, and diagnostic counts');
  assert.equal(semanticEvents.length, eventCount, 'Cached redraw must not emit additional semantic observations');
  assert.equal(semanticErrors.length, errorCount, 'Cached redraw must not rerun throwing callbacks');
  assert.equal(result.startupText.errors.length,0, 'Redraw must not introduce startup bridge errors');
  result.tests.push({name:label, pass:true, redraws:25, streams:STREAMS});
}
async function main() {
  progress('beforeStartupTextPreflight');
  const startup = await startupFixture.createStartupFixture(gameRoot, result.startupTextManifest, NATIVE_LANGUAGE,
    {onError:error => {failure=error;}});
  result.startupText = startup.receipt;
  progress('afterStartupTextPreflight');
  const createEngine = require(path.join(build, 'dcss.js'));
  progress('beforeCreateEngine');
  mod = await createEngine({
    ...startup.options,
    // Match the worker: input and persistence are prepared before explicit main.
    // INVOKE_RUN=0 already disables auto-main; this is not a constructor fix.
    noInitialRun:true,
    locateFile:file => path.join(build, file),
    print:line => {logs.push(line); console.log(line);},
    printErr:line => {logs.push(line); console.error(line);},
    onAbort:value => {failure = new Error(String(value));},
    onExit:status => {
      mainLifetime.exitStatus = status;
      pendingKey = null;
      if (status!==0) failure = new Error('Official engine exited with status '+status);
    },
    dcssFrame:cells => {lastFrame = cells; ++frames; if (frames===1) progress('firstFrame');},
    dcssHasKey:() => 0,
    dcssReadKey:wake => {pendingKey = wake;},
    dcssSemantic:event => {
      // Host observation only: never reenter native exports from this callback.
      semanticEvents.push(JSON.parse(JSON.stringify(event)));
      if (throwSemantic) throw new Error('DCSS smoke intentional semantic callback failure');
    },
    dcssSemanticError:error => semanticErrors.push(String(error)),
  });
  progress('afterCreateEngine');
  mod.FS.mkdir('/persist');
  const loadmaps = mod.FS.readFile('/data/dat/dlua/loadmaps.lua', {encoding:'utf8'});
  assert(loadmaps.includes('"des/00init.des"'), 'Map manifest must use official dat-relative paths');
  const before = await enterFixture();
  result.gameplayTrace = {fresh:before};
  result.tests.push({name:'official seeded Minotaur Fighter startup traverses genuine weapon selection', pass:true, snapshot:before});
  await repaintProof(before, semanticEvents.length, semanticErrors.length, '25 initial redraws preserve every observed PCG stream');
  const beforeScreen = screenText();
  assert(!beforeScreen.includes(result.sourceContracts.message.original),
    'Fresh fixture must have no canonical no-spells text before its first command');
  assert.equal(semanticErrors.length, 0);
  const throwingFirst = semanticEvents.length;
  throwSemantic = true;
  await key(73); // FIRST I: cmd-keys.h:83, main.cc:2244 -> inspect_spells().
  throwSemantic = false;
  const throwing = snapshot();
  result.gameplayTrace.throwing = throwing;
  assert.equal(throwing.turn, before.turn, 'Displaying absent memorized spells is a non-turn command');
  const throwingEvents = noSpellsEmission(throwingFirst, before.turn);
  const throwingScreen = screenText();
  assert(throwingScreen.includes(result.sourceContracts.message.original),
    'First genuine no-spells command must newly present canonical native text despite its throwing observer');
  const throwingDeltas = drawDeltas(before, throwing);
  assertTrace(before, throwing, throwingDeltas);
  assert.equal(semanticErrors.length, throwingEvents.length,
    'Every intentional callback failure must be caught by the host adapter');
  assert(semanticErrors.every(error => error.includes('DCSS smoke intentional semantic callback failure')));
  result.tests.push({name:'first no-spells command newly presents canonical text despite a throwing semantic callback',
    pass:true, events:throwingEvents, errors:[...semanticErrors], drawDeltas:throwingDeltas,
    canonicalBeforeScreen:beforeScreen, canonicalScreen:throwingScreen, canonicalTextWasAbsentBefore:true});
  await repaintProof(throwing, semanticEvents.length, semanticErrors.length, '25 redraws after a caught callback error preserve state and emissions');
  const normalFirst = semanticEvents.length, previousErrors = semanticErrors.length;
  await key(73); // SECOND I supplies the ordinary observer comparator.
  const normal = snapshot();
  result.gameplayTrace.normal = normal;
  assert.equal(normal.turn, throwing.turn);
  const normalEvents = noSpellsEmission(normalFirst, throwing.turn);
  assertTrace(throwing, normal, throwingDeltas);
  assert.equal(semanticErrors.length, previousErrors, 'Ordinary observer must add no errors');
  result.tests.push({name:'ordinary no-spells command matches the throwing command trace across all 45 PCG streams',
    pass:true, events:normalEvents, drawDeltas:drawDeltas(throwing, normal), canonicalScreen:screenText(),
    comparison:'First command throws; second command observes normally; canonical text absence/presence proves the first presentation.'});
  await repaintProof(normal, semanticEvents.length, semanticErrors.length, '25 semantic redraws add no emissions or native draws');
  for (let i=0; i<semanticEvents.length; ++i) {
    validateEvent(semanticEvents[i]);
    if (i) assert(BigInt(semanticEvents[i].sequence) > BigInt(semanticEvents[i-1].sequence), 'Semantic sequence must increase');
  }
  await key(46); // Official wait command.
  const after = snapshot();
  result.gameplayTrace.wait = after;
  assert(after.turn > normal.turn, 'Official wait must advance the engine turn');
  result.tests.push({name:'official wait command advances gameplay after callback error', pass:true,
    beforeTurn:normal.turn, afterTurn:after.turn});
  assert.equal(await mod._dcss_save(), 1, 'Official native save function must run');
  const afterSave = snapshot();
  result.gameplayTrace.afterSave = afterSave;
  assert.deepEqual(afterSave, after, 'Native save must preserve observed player and RNG state');
  const saves = saveFiles();
  assert(saves.some(file => file.path.endsWith('.cs') && file.bytes > 0), 'Official save must produce a native compressed save');
  if (process.env.DCSS_NATIVE_ENVELOPE_WITNESS==='1') {
    const fixture = await nativeEnvelopeFixture.createNativeEnvelopeFixture(gameRoot);
    const portableFiles = saves.filter(file => !/^\/persist\/saves\/(?:db|des)\//.test(file.path))
      .map(file => ({ path:file.path, bytes:mod.FS.readFile(file.path) }));
    const eventsBefore = semanticEvents.length, errorsBefore = semanticErrors.length;
    const verified = fixture.verify(portableFiles, semanticEvents);
    result.nativeEnvelopeWitness = { enabled:true, ...verified.receipt };
    assert.deepEqual(snapshot(), afterSave, 'Rust native v1/v2 import/pack must preserve every native PCG word/count');
    assert.equal(semanticEvents.length, eventsBefore); assert.equal(semanticErrors.length, errorsBefore);
  }
  result.tests.push({name:'official native save writes filesystem without observer-state changes', pass:true, files:saves});
  result.semanticCoverage = {fixture:'default Minotaur Fighter, I command',
    scope:'One genuine no-spells canonical route and a throwing host callback; Lua/rc/filter variants are not exercised here.'};
  result.frames = frames;
  result.finalScreen = screenText();
  result.logs = logs;
  fs.writeFileSync(path.join(build, 'smoke-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result.tests.map(test => ({name:test.name, pass:test.pass})), null, 2));
  process.exit(0);
}
main().catch(error => {
  progress('failed');
  fs.writeFileSync(path.join(build, 'smoke-result.json'), JSON.stringify({...result,
    error:String(error), logs, screen:screenText(), semanticEvents, semanticErrors}, null, 2));
  console.error(error); process.exit(1);
});
