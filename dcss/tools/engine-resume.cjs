// Verify native save continuation in two sequential, independently loaded cores.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const startupFixture = require('./startup-fixture.cjs');
const nativeEnvelopeFixture = require('./native-envelope-fixture.cjs');
const promptCalls = receipt => typeof startupFixture.promptCalls==='function' ? startupFixture.promptCalls(receipt) : receipt.formatCalls;
const NATIVE_LANGUAGE = startupFixture.language(process.env.DCSS_NATIVE_LANGUAGE ?? 'ja');
const gameRoot = path.resolve(__dirname, '..');
const LOCALE_PLAN = startupFixture.localePlan(process.env);
const ENGINE_MODE = process.env.DCSS_ENGINE_MODE || 'asyncify';
assert(['asyncify','jspi'].includes(ENGINE_MODE), 'DCSS_ENGINE_MODE must be asyncify or jspi');
const build = path.resolve(__dirname, ENGINE_MODE==='jspi' ? '../engine/build-jspi' : '../engine/build');
const UPSTREAM = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const U64_MAX = (1n << 64n) - 1n;
const STREAMS = 45, FOLLOWING_TURNS = 3, RECEIPT_VERSION = 1;
const BASELINE_REQUESTED = process.env.DCSS_WASM_BASELINE==='1';
const COMPILER_MODE = process.execArgv.includes('--liftoff-only') ? 'baseline-noTurboFan' : 'optimized-default';
// Full-core startup showed measured commit pressure on this PC. Pin this setting
// for reproducible diagnostics; one compilation task is not a proven mitigation.
// The coordinator also releases each core process before starting the next.
const WASM_COMPILATION_ARGS = ['--wasm-num-compilation-tasks=1',
  ...(BASELINE_REQUESTED ? ['--liftoff-only'] : []),
  ...(ENGINE_MODE==='jspi' ? ['--experimental-wasm-jspi'] : [])];
const checkpointPath = path.join(build, 'resume-checkpoint.json');
const resultPath = path.join(build, 'resume-result.json');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const evidence = {engine:'dcss-0.34.1', engineMode:ENGINE_MODE, tests:[], progress:[]};
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function progress(stage, session) {
  const memory = process.memoryUsage();
  evidence.progress.push({stage, label:session ? session.label : 'coordinator',
    processId:process.pid, timeUtc:new Date().toISOString(),
    // Do not inspect unexported Emscripten properties: they can abort on access.
    wasmHeapBytes:null, wasmHeapUnavailableReason:'heap-view-not-exported',
    jsHeapUsedBytes:memory.heapUsed, rssBytes:memory.rss});
  fs.writeFileSync(path.join(build, 'resume-progress.json'), JSON.stringify({version:1,
    runId:evidence.runId, processId:process.pid, engineMode:ENGINE_MODE, compilerMode:COMPILER_MODE,
    baselineRequested:BASELINE_REQUESTED, progress:evidence.progress}, null, 2));
}
function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index+1];
}
function artifactIdentity() {
  const manifestBytes = fs.readFileSync(path.join(build, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.version, '0.34.1');
  assert.equal(manifest.upstream_commit, UPSTREAM, 'Continuation requires its reviewed upstream');
  assert(manifest.runtime===ENGINE_MODE || (ENGINE_MODE==='asyncify' && manifest.runtime===undefined),
    'Manifest runtime must match its selected fixed engine directory');
  assert(Array.isArray(manifest.outputs));
  assert.deepEqual(manifest.outputs.map(output => output.name).sort(), ['dcss.data','dcss.js','dcss.wasm']);
  const artifacts = manifest.outputs.map(output => {
    assert(Number.isSafeInteger(output.bytes) && output.bytes>0);
    assert(typeof output.sha256==='string' && /^[0-9a-f]{64}$/.test(output.sha256));
    const bytes = fs.readFileSync(path.join(build, output.name));
    const hash = sha256(bytes);
    assert.equal(bytes.length, output.bytes, 'Artifact byte count must match manifest: '+output.name);
    assert.equal(hash, output.sha256, 'Artifact SHA must match manifest: '+output.name);
    return {name:output.name, bytes:bytes.length, sha256:hash};
  }).sort((a,b) => a.name.localeCompare(b.name));
  return {upstreamCommit:manifest.upstream_commit, engineMode:ENGINE_MODE,
    startupTextManifest:startupFixture.manifestIdentity(manifest),
    manifestRuntime:manifest.runtime || 'asyncify',
    runtimeMetadata:manifest.runtime===undefined ? 'legacy-fixed-directory' : 'explicit-manifest',
    manifestSha256:sha256(manifestBytes), artifacts};
}
function u64(value, label) {
  assert.equal(typeof value, 'string', label+' must remain an exact decimal string');
  assert(/^(?:0|[1-9][0-9]*)$/.test(value), label+' must be canonical unsigned decimal');
  const integer = BigInt(value);
  assert(integer <= U64_MAX, label+' must fit u64');
  return integer;
}
function validateSnapshot(state, includeDraws=true) {
  assert.equal(state.engine, 'dcss-0.34.1');
  u64(state.seed, 'seed');
  assert(Array.isArray(state.rng));
  assert.equal(state.rng.length, STREAMS, 'Observer must expose all 45 ordered official generators');
  state.rng.forEach((rng, i) => {
    assert.deepEqual(Object.keys(rng).sort(), includeDraws ? ['draws','sequence','state'] : ['sequence','state']);
    u64(rng.state, 'rng['+i+'].state');
    assert.equal(u64(rng.sequence, 'rng['+i+'].sequence') & 1n, 1n);
    if (includeDraws) u64(rng.draws, 'rng['+i+'].draws');
  });
  return state;
}
function logical(state) {
  validateSnapshot(state);
  // PCG count_ is a diagnostic observer counter, not part of native generators_to_vector().
  // Only count is excluded across restore; all 90 state/increment words retain order.
  return {...state, rng:state.rng.map(({draws,...generator}) => generator)};
}
function safeNativePath(filePath) {
  assert.equal(typeof filePath, 'string');
  assert(filePath.startsWith('/persist/'), 'Test transport must contain native persistence paths only');
  assert(!filePath.includes('\\') && !filePath.includes('\0'));
  assert.equal(path.posix.normalize(filePath), filePath, 'Native path must be canonical');
  assert(filePath.split('/').slice(2).every(part => part && part!=='.' && part!=='..'));
  return filePath;
}
function fileManifest(files) {
  const manifest = files.map(file => ({path:safeNativePath(file.path),
    bytes:file.bytes.length, sha256:sha256(file.bytes)})).sort((a,b) => a.path.localeCompare(b.path));
  const paths = new Set(manifest.map(file => file.path));
  assert.equal(paths.size, manifest.length, 'Native files must have unique paths');
  for (const file of manifest) {
    let parent = path.posix.dirname(file.path);
    while (parent!=='/persist' && parent!=='/') {
      assert(!paths.has(parent), 'A native file must not also be another file ancestor');
      parent = path.posix.dirname(parent);
    }
  }
  return manifest;
}
// database.cc:169-174 and maps.cc:1261-1281 are the only excluded cache roots.
// files.cc:686-694 selects the unversioned save directory in this Web build.
const regenerable = file => /^\/persist\/saves\/(?:db|des)\//.test(file.path);
async function create(label, saved=[]) {
  const session = {label, pending:null, failure:null, frames:0, screen:'', logs:[],
    mainLifetime:{kind:null, settled:false, exitStatus:null, acceptedExitZero:false}};
  progress('beforeStartupTextPreflight', session);
  const startup = await startupFixture.createStartupFixture(gameRoot, evidence.startupTextManifest, NATIVE_LANGUAGE,
    {onError:error => {session.failure=error;}});
  session.startupText = startup.receipt;
  progress('afterStartupTextPreflight', session);
  // Lazy load: the coordinator process never loads another core alongside its child.
  const factory = require(path.join(build, 'dcss.js'));
  progress('beforeCreateEngine', session);
  session.mod = await factory({
    ...startup.options,
    // Explicitly match worker startup; generated INVOKE_RUN=0 already skips main.
    noInitialRun:true,
    locateFile:file => path.join(build, file),
    print:line => session.logs.push(line),
    printErr:line => {session.logs.push(line); console.error(label+': '+line);},
    onAbort:value => {session.failure = new Error(String(value));},
    onExit:status => {
      session.mainLifetime.exitStatus = status;
      session.pending = null;
      if (status!==0) session.failure = new Error('Official engine exited with status '+status);
    },
    dcssFrame:cells => {
      ++session.frames;
      session.lastFrame = cells;
      session.screen = startupFixture.decodeFrame(cells);
      if (session.frames===1) progress('firstFrame', session);
    },
    dcssHasKey:() => 0,
    dcssReadKey:wake => {session.pending = wake;},
  });
  progress('afterCreateEngine', session);
  session.mod.FS.mkdir('/persist');
  const expectedFiles = fileManifest(saved);
  for (const file of saved) {
    assert(!regenerable(file), 'Regenerable cache files must be absent from resume transport');
    session.mod.FS.mkdirTree(path.posix.dirname(file.path));
    session.mod.FS.writeFile(file.path, file.bytes);
  }
  assert.deepEqual(fileManifest(saveFiles(session)), expectedFiles,
    'Every transported native file must be restored byte-for-byte before official startup');
  session.restoredFiles = expectedFiles;
  session.snapshot = () => validateSnapshot(JSON.parse(session.mod.UTF8ToString(session.mod._dcss_snapshot_json())));
  session.wait = async () => {
    const end = Date.now()+300000;
    while (!session.pending) {
      if (session.failure) throw session.failure;
      if (session.mainLifetime.exitStatus!==null) throw new Error(label+' exited before expected input: '+session.mainLifetime.exitStatus);
      if (Date.now()>end) throw new Error(label+' timed out: '+session.screen+'\n'+session.logs.join('\n'));
      await pause(20);
    }
    if (session.failure) throw session.failure;
  };
  session.key = async key => {
    await session.wait();
    const wake = session.pending; session.pending = null;
    wake(key); await session.wait();
  };
  return session;
}
function mainFailure(session, error) {
  session.mainLifetime.settled = true;
  if (error && error.name==='ExitStatus' && error.status===0 && session.mainLifetime.exitStatus===0) {
    session.mainLifetime.acceptedExitZero = true;
    return;
  }
  session.mainLifetime.error = String(error);
  session.failure = error instanceof Error ? error : new Error('Official main lifetime failed: '+String(error));
}
function launchMain(session, argv) {
  try {
    const lifetime = session.mod.callMain(argv);
    const promising = lifetime && typeof lifetime.then==='function';
    assert(ENGINE_MODE!=='jspi' || promising, 'JSPI callMain must expose its promised game lifetime');
    session.mainLifetime.kind = promising ? 'promise' : 'asyncify-suspended-call';
    // Observe, never await, the indefinitely suspended game-loop lifetime here.
    if (promising) Promise.resolve(lifetime).then(() => {session.mainLifetime.settled = true;},
      error => mainFailure(session, error));
  } catch (error) {
    mainFailure(session, error);
    if (session.failure) throw session.failure;
  }
}
function saveFiles(session, directory='/persist') {
  const files = [];
  for (const name of session.mod.FS.readdir(directory).sort()) {
    if (name==='.' || name==='..') continue;
    const file = directory+'/'+name;
    if (session.mod.FS.isDir(session.mod.FS.stat(file).mode)) files.push(...saveFiles(session, file));
    else files.push({path:file, bytes:session.mod.FS.readFile(file)});
  }
  return files;
}
async function ready(session, argv, requireWeaponPrompt) {
  console.log('Starting '+session.label);
  const screens = [];
  let weaponPromptSeen = false;
  progress('beforeCallMain', session);
  launchMain(session, argv);
  await session.wait();
  for (let attempts=0; attempts<12; ++attempts) {
    screens.push(session.screen);
    if (startupFixture.observeStartupPrompt(session.screen, session.startupText, requireWeaponPrompt)) {
      weaponPromptSeen = true;
      session.weaponPromptFrame = startupFixture.promptFrame(session.lastFrame,session.startupText);
    }
    const state = session.snapshot();
    if (state.hp>0 && state.x>=0 && state.y>=0) {
      if (requireWeaponPrompt) assert(weaponPromptSeen,
        'This fixed Minotaur Fighter fixture must traverse the genuine weapon menu at newgame.cc:1837');
      assert.equal(session.startupText.errors.length,0);
      if (session.startupText.enabled) assert.equal(promptCalls(session.startupText)>0,requireWeaponPrompt,
        'Only genuine new-character weapon selection may invoke the formatter');
      session.startup = {weaponPromptSeen, nativeLanguage:session.startupText.language,
        weaponFrame:session.weaponPromptFrame ?? null, screens};
      progress('gameplayReady', session);
      return state;
    }
    await session.key(13);
  }
  throw new Error('Cannot enter native gameplay: '+session.screen);
}
function readReceipt(runId) {
  const receipt = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
  assert.equal(receipt.version, RECEIPT_VERSION);
  assert.equal(receipt.phase, 'original-complete', 'Resume requires the completed original process receipt');
  assert.equal(receipt.runId, runId, 'Stale checkpoints must not satisfy a new test run');
  assert(Number.isSafeInteger(receipt.originalProcessId) && receipt.originalProcessId>0);
  assert.notEqual(receipt.originalProcessId, process.pid, 'Resume must execute in a different process');
  assert.equal(receipt.followingTurns, FOLLOWING_TURNS);
  assert.equal(receipt.evidence.runtime.wasmCompilationTasks, 1);
  assert(receipt.evidence.runtime.originalExecArgv.includes(WASM_COMPILATION_ARGS[0]));
  assert.equal(receipt.evidence.runtime.compilerMode, COMPILER_MODE,
    'Both continuation phases must use the same explicitly recorded compiler mode');
  assert.equal(receipt.evidence.runtime.baselineRequested, BASELINE_REQUESTED);
  if (BASELINE_REQUESTED) assert(receipt.evidence.runtime.originalExecArgv.includes('--liftoff-only'));
  assert.equal(receipt.evidence.runtime.engineMode, ENGINE_MODE);
  if (ENGINE_MODE==='jspi') assert(receipt.evidence.runtime.originalExecArgv.includes('--experimental-wasm-jspi'));
  assert.equal(receipt.evidence.continuation.length, FOLLOWING_TURNS);
  assert.equal(receipt.evidence.continuationSnapshots.length, FOLLOWING_TURNS);
  validateSnapshot(receipt.evidence.checkpoint);
  receipt.evidence.continuation.forEach(state => validateSnapshot(state, false));
  receipt.evidence.continuationSnapshots.forEach((state, i) => {
    validateSnapshot(state);
    assert.deepEqual(logical(state), receipt.evidence.continuation[i]);
  });
  assert.deepEqual(artifactIdentity(), {upstreamCommit:receipt.evidence.upstreamCommit,
    engineMode:receipt.evidence.engineMode, manifestRuntime:receipt.evidence.manifestRuntime,
    runtimeMetadata:receipt.evidence.runtimeMetadata, manifestSha256:receipt.evidence.manifestSha256,
    artifacts:receipt.evidence.artifacts, startupTextManifest:receipt.evidence.startupTextManifest},
    'Both phases must use identical runtime, manifest, startup bridge and official core/data artifacts');
  assert.deepEqual(receipt.evidence.localePlan,LOCALE_PLAN,
    'Both sequential phases must use the same explicitly recorded locale plan');
  assert.equal(receipt.evidence.startupText.requestedLanguage,LOCALE_PLAN.original,
    'Original save receipt must retain its source native locale');
  const files = receipt.files.map(file => {
    safeNativePath(file.path);
    assert.equal(typeof file.base64, 'string');
    const bytes = Buffer.from(file.base64, 'base64');
    assert.equal(bytes.toString('base64'), file.base64, 'Native transport must use canonical base64');
    return {path:file.path, bytes};
  });
  assert.deepEqual(fileManifest(files), receipt.evidence.files, 'Transported bytes must match all native path/length/hash receipts');
  assert(files.every(file => !regenerable(file)));
  return {receipt, files};
}
async function originalPhase(runId) {
  assert.equal(NATIVE_LANGUAGE,LOCALE_PLAN.original,'Original phase must use its explicitly planned locale');
  evidence.localePlan = LOCALE_PLAN;
  Object.assign(evidence, artifactIdentity(), {version:RECEIPT_VERSION, runId,
    runtime:{wasmCompilationTasks:1, originalExecArgv:[...process.execArgv],
      explicitMainStartup:true,
      engineMode:ENGINE_MODE, jspiEnabled:process.execArgv.includes('--experimental-wasm-jspi'),
      compilerMode:COMPILER_MODE, baselineRequested:BASELINE_REQUESTED,
      diagnosticOnly:BASELINE_REQUESTED || COMPILER_MODE==='baseline-noTurboFan'},
    phases:[{phase:'original-running', processId:process.pid}]});
  const original = await create('original');
  const start = await ready(original, ['-name','ResumeTest','-species','Minotaur','-background','Fighter','-seed','424242'], true);
  assert.equal(start.seed, '424242', 'Official CLI seed must survive startup');
  assert.equal(new Set(start.rng.map(rng => rng.state+':'+rng.sequence)).size, STREAMS,
    'Observer must expose distinct real generators in this seeded fixture');
  evidence.startup = original.startup;
  evidence.startupText = original.startupText;
  evidence.fresh = start;
  const formattingCalls = promptCalls(original.startupText);
  for (let i=0; i<25; ++i) original.mod._dcss_repaint();
  assert.equal(promptCalls(original.startupText),formattingCalls,'Native redraw must not reconstruct startup text');
  assert.deepEqual(original.snapshot(), start);
  evidence.tests.push({name:'seeded native startup visits genuine weapon selection and 25 redraws preserve all observed fields',
    pass:true, streams:STREAMS, stateWords:STREAMS*2});
  await original.key(46);
  const checkpoint = original.snapshot();
  evidence.checkpoint = checkpoint;
  evidence.originalScreen = original.screen;
  assert(checkpoint.turn>start.turn);
  assert.equal(await original.mod._dcss_save(), 1);
  assert.deepEqual(original.snapshot(), checkpoint, 'Native saving must preserve all observed fields and diagnostic PCG counters');
  const allFiles = saveFiles(original);
  const caches = allFiles.filter(regenerable);
  const files = allFiles.filter(file => !regenerable(file));
  evidence.allNativeFiles = fileManifest(allFiles);
  evidence.files = fileManifest(files);
  evidence.regenerableCaches = {files:fileManifest(caches),
    bytes:caches.reduce((sum,file) => sum+file.bytes.length, 0),
    sourceRoots:['database.cc:169-174 db/', 'maps.cc:1261-1281 des/'],
    hashesComparedOnRegeneration:false};
  assert(caches.some(file => file.path.startsWith('/persist/saves/db/') && file.bytes.length>0),
    'Fixture must actually generate the database cache it will omit');
  assert(caches.some(file => file.path.startsWith('/persist/saves/des/') && file.bytes.length>0),
    'Fixture must actually generate the vault cache it will omit');
  assert(files.some(file => file.path.endsWith('.cs') && file.bytes.length>0), 'Official compressed save must exist');
  assert.deepEqual([...evidence.files, ...evidence.regenerableCaches.files].sort((a,b) => a.path.localeCompare(b.path)),
    evidence.allNativeFiles, 'The native/cache partition must retain a receipt for every original native file');
  evidence.tests.push({name:'native save preserves state and retains every non-cache file with path/size/hash evidence', pass:true,
    transportedFiles:files.length, omittedCacheFiles:caches.length});
  let nativeEnvelopes;
  if (process.env.DCSS_NATIVE_ENVELOPE_WITNESS==='1') {
    const fixture = await nativeEnvelopeFixture.createNativeEnvelopeFixture(gameRoot);
    const verified = fixture.verify(files);
    nativeEnvelopes = { v1:verified.v1, v2:verified.v2 };
    evidence.nativeEnvelopeWitness = { enabled:true, ...verified.receipt };
    assert.deepEqual(original.snapshot(), checkpoint, 'Rust portable import must preserve every native PCG word/count');
  }
  evidence.continuation = [];
  evidence.continuationSnapshots = [];
  for (let i=0; i<FOLLOWING_TURNS; ++i) {
    await original.key(46);
    const state = original.snapshot();
    assert(state.turn > (i ? evidence.continuationSnapshots[i-1].turn : checkpoint.turn));
    evidence.continuationSnapshots.push(state);
    evidence.continuation.push(logical(state));
  }
  evidence.frames = {original:original.frames};
  evidence.mainLifetimes = {original:original.mainLifetime};
  evidence.phases[0].phase = 'original-complete';
  // The completion marker is written only after all three reference turns exist.
  fs.writeFileSync(checkpointPath, JSON.stringify({version:RECEIPT_VERSION, phase:'original-complete',
    runId, originalProcessId:process.pid, followingTurns:FOLLOWING_TURNS,
    evidence, nativeEnvelopes, files:files.map(file => ({path:file.path, base64:Buffer.from(file.bytes).toString('base64')}))}));
  console.log('Original phase completed native checkpoint and three uninterrupted reference turns');
}
async function resumedPhase(runId) {
  assert.equal(NATIVE_LANGUAGE,LOCALE_PLAN.resumed,'Resumed phase must use its explicitly planned locale');
  const {receipt, files:receiptFiles} = readReceipt(runId);
  let files = receiptFiles;
  if (process.env.DCSS_NATIVE_ENVELOPE_WITNESS==='1') {
    const version = process.env.DCSS_NATIVE_RESUME_ENVELOPE || 'v2';
    assert(['v1','v2'].includes(version), 'DCSS_NATIVE_RESUME_ENVELOPE must be v1 or v2');
    assert(receipt.nativeEnvelopes && typeof receipt.nativeEnvelopes[version]==='string');
    const fixture = await nativeEnvelopeFixture.createNativeEnvelopeFixture(gameRoot);
    assert.deepEqual(fixture.identity, receipt.evidence.nativeEnvelopeWitness.boundary,
      'Both phases require byte-identical actual Rust boundary artifacts');
    const imported = fixture.unpack(receipt.nativeEnvelopes[version]);
    files = imported.files.map(file => ({ path:'/persist/'+file.path, bytes:Uint8Array.from(file.bytes) }));
    assert.deepEqual(fileManifest(files), receipt.evidence.files,
      'The actual Rust-selected v1/v2 import must retain every native file byte');
    receipt.evidence.nativeEnvelopeResume = { version:Number(version.slice(1)),
      actualRustImport:true, actualFreshNativeResumePending:true, legacyHistoryEmpty:version==='v1',
      boundary:fixture.identity };
  }
  Object.assign(evidence, receipt.evidence);
  evidence.runtime.resumedExecArgv = [...process.execArgv];
  const resumed = await create('resumed', files);
  evidence.restoredFiles = resumed.restoredFiles;
  assert.deepEqual(resumed.restoredFiles, evidence.files);
  const beforeStartup = saveFiles(resumed);
  assert(!beforeStartup.some(regenerable), 'Fresh core must begin with all declared cache files absent');
  const resumedState = await ready(resumed, ['-name','ResumeTest'], false);
  evidence.resumedState = resumedState;
  evidence.resumedScreen = resumed.screen;
  evidence.resumedStartup = resumed.startup;
  evidence.resumedStartupText = resumed.startupText;
  assert.equal(resumed.startupText.requestedLanguage,LOCALE_PLAN.resumed);
  assert.equal(resumed.startupText.language,resumed.startupText.enabled ? LOCALE_PLAN.resumed : 'en');
  assert.deepEqual(logical(resumedState), logical(evidence.checkpoint),
    'Resume must restore every observed player field and all 90 ordered PCG state/increment words');
  evidence.tests.push({name:'different process restores native files byte-for-byte and all 45 PCG generators', pass:true,
    streams:STREAMS, stateWords:STREAMS*2, diagnosticCountsExcludedOnlyAcrossResume:true});
  const regeneratedFiles = fileManifest(saveFiles(resumed).filter(regenerable));
  const regeneratedByPath = new Map(regeneratedFiles.map(file => [file.path, file]));
  for (const previous of evidence.regenerableCaches.files) {
    const regenerated = regeneratedByPath.get(previous.path);
    assert(regenerated, 'Official startup must actually recreate omitted cache path '+previous.path);
    if (previous.bytes>0) assert(regenerated.bytes>0, 'Recreated data cache must be nonempty: '+previous.path);
  }
  evidence.regenerableCaches.regeneratedFiles = regeneratedFiles;
  evidence.tests.push({name:'pinned official data recreates every observed omitted database/vault cache path', pass:true,
    recreatedPaths:evidence.regenerableCaches.files.length,
    note:'Cache bytes may contain timestamps; path existence and nonempty data are verified, byte equality is not claimed.'});
  evidence.resumedContinuationSnapshots = [];
  for (let i=0; i<FOLLOWING_TURNS; ++i) {
    await resumed.key(46);
    const state = resumed.snapshot();
    evidence.resumedContinuationSnapshots.push(state);
    assert.deepEqual(logical(state), evidence.continuation[i],
      'Native continuation must match uninterrupted observed fields and all PCG state words at step '+(i+1));
  }
  evidence.tests.push({name:'three following official turns match uninterrupted observed fields and all 45 PCG generators',
    pass:true, turns:FOLLOWING_TURNS, stateWordsPerTurn:STREAMS*2});
  evidence.frames.resumed = resumed.frames;
  evidence.mainLifetimes.resumed = resumed.mainLifetime;
  if (evidence.nativeEnvelopeResume) {
    evidence.nativeEnvelopeResume.actualFreshNativeResumePending = false;
    evidence.nativeEnvelopeResume.actualFreshNativeResumeVerified = true;
    evidence.nativeEnvelopeResume.all45NativeGeneratorsAndThreeFollowingTurnsVerified = true;
  }
  evidence.phases.push({phase:'resumed-complete', processId:process.pid});
  evidence.phase = 'resumed-complete';
  fs.writeFileSync(resultPath, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence.tests.map(test => ({name:test.name, pass:test.pass}))));
}
async function main() {
  const phase = argument('--phase');
  if (phase) {
    assert(process.execArgv.includes(WASM_COMPILATION_ARGS[0]),
      'Every full-core child must explicitly use one V8 Wasm compilation task');
    assert(!BASELINE_REQUESTED || process.execArgv.includes('--liftoff-only'),
      'A direct baseline phase must explicitly disable TurboFan with --liftoff-only');
    assert(ENGINE_MODE!=='jspi' || process.execArgv.includes('--experimental-wasm-jspi'),
      'A direct JSPI phase requires --experimental-wasm-jspi');
    const runId = argument('--run-id');
    assert(typeof runId==='string' && /^[0-9a-f-]{36}$/.test(runId), 'A phase requires its coordinator-issued UUID run id');
    evidence.runId = runId;
    evidence.phase = phase+'-running';
    if (phase==='original') await originalPhase(runId);
    else if (phase==='resumed') await resumedPhase(runId);
    else throw new Error('Unknown test phase '+phase);
  } else {
    const runId = crypto.randomUUID(); // Host test identity; never passed into native RNG.
    evidence.runId = runId;
    evidence.phase = 'coordinator-running';
    for (const file of [resultPath, checkpointPath]) if (fs.existsSync(file)) fs.unlinkSync(file);
    const childReceipts = [];
    for (const childPhase of ['original','resumed']) {
      // spawnSync releases the first full C++ process before starting the second.
      const child = spawnSync(process.execPath, [...WASM_COMPILATION_ARGS,__filename,'--phase',childPhase,'--run-id',runId],
        {stdio:'inherit', timeout:600000,
          env:{...process.env,
            DCSS_NATIVE_LANGUAGE:childPhase==='original' ? LOCALE_PLAN.original : LOCALE_PLAN.resumed,
            DCSS_NATIVE_ORIGINAL_LANGUAGE:LOCALE_PLAN.original,
            DCSS_NATIVE_RESUME_LANGUAGE:LOCALE_PLAN.resumed}});
      if (child.error) throw child.error;
      assert.equal(child.status, 0, 'Native save '+childPhase+' phase must exit successfully');
      childReceipts.push({phase:childPhase, processId:child.pid, exitCode:child.status,
        wasmCompilationTasks:1, execArgs:[...WASM_COMPILATION_ARGS],
        nativeLanguage:childPhase==='original' ? LOCALE_PLAN.original : LOCALE_PLAN.resumed,
        engineMode:ENGINE_MODE, jspiEnabled:ENGINE_MODE==='jspi',
        compilerMode:BASELINE_REQUESTED ? 'baseline-noTurboFan' : 'optimized-default'});
    }
    const complete = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    assert.equal(complete.runId, runId);
    assert.equal(complete.phase, 'resumed-complete');
    assert.deepEqual(complete.phases.map(item => item.phase), ['original-complete','resumed-complete']);
    assert.deepEqual(complete.phases.map(item => item.processId), childReceipts.map(item => item.processId));
    assert.notEqual(childReceipts[0].processId, childReceipts[1].processId);
    complete.coordinator = {processId:process.pid, sequential:true, children:childReceipts};
    Object.assign(evidence, complete);
    fs.writeFileSync(resultPath, JSON.stringify(evidence, null, 2));
  }
  process.exit(0);
}
main().catch(error => {
  // Preserve a child failure from this run only; never adopt stale result evidence.
  if (!argument('--phase') && fs.existsSync(resultPath)) {
    const childEvidence = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    if (childEvidence.runId===evidence.runId) Object.assign(evidence, childEvidence);
  }
  progress('failed');
  fs.writeFileSync(resultPath, JSON.stringify({...evidence, error:String(error)}, null, 2));
  console.error(error); process.exit(1);
});
