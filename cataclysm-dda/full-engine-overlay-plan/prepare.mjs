// Preparation only: source copies, exact dependency evidence and command records.
// Never spawns a process, imports WebAssembly or changes an accepted engine.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const task = path.dirname(here);
const normalize = p => path.resolve(p).replaceAll('\\', '/');
const sha = b => createHash('sha256').update(b).digest('hex');
const commit = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const fixed = {
  'engine-build/build-manifest.json': '45e63b655b7399d8c8199a29e08a2c224e928f9e5ac538f488752ab266a31451',
  'semantic-display-live-slice/SOURCE-PREPARATION.json': 'c8497482c2809db7e704e45c10e67a63e72971f0cfb3d1c3ac895f7efe9d6661',
  'integration-overlay/hook-input-wait.inc': 'deda71f6f15d0a2a2a0992499bbc8789069581c9abb311bde8f23ed173ab400c',
  'presentation-snapshot-overlay/generated/src/sdltiles.cpp': 'c5a3843ecbbe0253519a60e211b790f072d29699143ed5c83cd47c60a4262eb2',
  'integration-overlay/build-plan/cpp-compile/run-compile-window.py': '0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395',
  'presentation-snapshot-overlay/run-parser-window.py': '0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb',
  'browser-qa/quiet-liftoff-v3-pinned-candidate-readiness.json': '7de80aecc4ac85a267be1ae3335a794a6a0122e75128e16f8297989755d5281e',
  'baseline-preview/web/package-manifest.json': 'eb09bac0ddaf7373b411bcfe7a60d21e4fd4775689e4e7437e07be0283360f39',
  'baseline-preview/web/index.html': 'fe63e838a93e42fcd45a1b7707d2cb9c1356787198ef391822a313c3b1844f0c',
  'baseline-preview/serve-local.mjs': 'd5b90c1952bfc338835654c57b4b32e1f0cad8f6048d2d4d7c461bd7ef40de9d',
};
const evidence = new Map();
function read(file, expected) {
  const absolute = path.isAbsolute(file) ? file : path.join(task, file);
  const state = fs.lstatSync(absolute);
  assert.ok(state.isFile() && !state.isSymbolicLink(), `regular file required: ${file}`);
  const bytes = fs.readFileSync(absolute);
  if (expected) assert.equal(sha(bytes), expected, `pin: ${file}`);
  evidence.set(normalize(absolute), { path: absolute, bytes: bytes.length, sha256: sha(bytes) });
  return bytes;
}
function json(file) { return JSON.parse(read(file, fixed[file]).toString('utf8')); }
for (const [file, expected] of Object.entries(fixed)) read(file, expected);
const baseline = json('engine-build/build-manifest.json');
assert.equal(baseline.upstreamCommit, commit);
const upstream = path.resolve(baseline.upstream);
assert.equal(path.basename(upstream), `Cataclysm-DDA-${commit}`);
const sourcePlan = json('semantic-display-live-slice/FOCUSED-COMPILE-PLAN.json');
const semantic = json('semantic-display-live-slice/SOURCE-PREPARATION.json');
const input = json('integration-overlay/SOURCE-PREPARATION.json');
const presentation = json('presentation-snapshot-overlay/SOURCE-PREPARATION.json');
const prior = json('integration-overlay/build-plan/cpp-compile/compile-plan.json');
const reference = json('evidence/full-engine-build.json');
const link = json('engine-build/candidates/o1-conservative-asyncify/attempts/attempt-2/link-candidate.json');
const resources = json('engine-build/candidates/o1-conservative-asyncify/attempts/attempt-2/evidence/terminal-resource-stage-report.json');
const actualInputCompile = json('integration-overlay/build-plan/cpp-compile/compile-verification.json');
assert.equal(semantic.source_commit, commit);
assert.equal(input.sourceCommit, commit);
assert.equal(presentation.upstream_commit, commit);
assert.equal(sourcePlan.sourceCommit, commit);
assert.equal(sourcePlan.sourceStaging.sourceFiles, 964);
assert.equal(reference.result, 'pass');
assert.equal(reference.sourceUnits.total, 438);
assert.equal(reference.linkOptimization, '-O1');
assert.equal(reference.provenanceHashes.candidateConfigSha256, sha(read('engine-build/candidates/o1-conservative-asyncify/attempts/attempt-2/link-candidate.json')));

const original = new Map();
for (const row of sourcePlan.sourceStaging.pins) {
  assert.ok(/^src\/[a-zA-Z0-9_.\-/]+$/.test(row.file) && !row.file.includes('..'));
  const bytes = read(path.join(upstream, row.file), row.sha256);
  assert.equal(bytes.length, row.bytes);
  assert.ok(!original.has(row.file));
  original.set(row.file, bytes);
}
assert.equal(original.size, 964);
const combined = new Map(original);
const changes = new Map();
for (const row of semantic.files.filter(r => r.file.startsWith('generated/src/'))) {
  const file = row.file.slice('generated/'.length);
  const bytes = read(path.join('semantic-display-live-slice', row.file), row.sha256);
  assert.equal(bytes.length, row.bytes);
  combined.set(file, bytes);
  changes.set(file, { source: 'semantic-display-live-slice/' + row.file, purpose: 'source-bound native help metadata and owned help transport' });
}
assert.equal(changes.size, 11);
const semanticInput = combined.get('src/input_context.cpp').toString('utf8');
const hook = read('integration-overlay/hook-input-wait.inc', input.hook.sha256).toString('utf8');
function replaceOnce(text, before, after) {
  assert.equal(text.split(before).length, 2, 'exact unique merge anchor');
  return text.replace(before, after);
}
const start = 'const std::string &input_context::handle_input( const int timeout )\n{\n';
const nativePrefix = '    const int old_timeout = inp_mngr.get_timeout();\n    if( timeout >= 0 ) {\n        inp_mngr.set_timeout( timeout );\n    }\n';
const anchor = '    next_action.type = input_event_t::error;\n';
assert.equal(semanticInput.split(start).length, 2);
assert.ok(semanticInput.slice(semanticInput.indexOf(start)).startsWith(start + nativePrefix + anchor));
assert.ok(!semanticInput.includes('browser_input_snapshot.h'));
let merged = replaceOnce(semanticInput, start + nativePrefix + anchor, start + nativePrefix + hook + anchor);
merged = replaceOnce(merged, '#include "input_context.h"\n', '#include "input_context.h"\n#include "browser_input_snapshot.h"\n');
assert.equal(replaceOnce(replaceOnce(merged, '#include "browser_input_snapshot.h"\n', ''), hook, ''), semanticInput);
combined.set('src/input_context.cpp', Buffer.from(merged));
changes.set('src/input_context.cpp', { source: 'semantic input_context.cpp plus exact accepted input hook', purpose: 'both native semantic names and read-only original input wait', semanticBaseSha256: sha(Buffer.from(semanticInput)), hookSha256: sha(Buffer.from(hook)), reversalToSemanticBaseVerified: true });
for (const row of input.additions) {
  const bytes = read(path.join('integration-overlay', row.path), row.sha256);
  assert.equal(bytes.length, row.bytes);
  assert.ok(!combined.has(row.path));
  combined.set(row.path, bytes);
  changes.set(row.path, { source: 'integration-overlay/' + row.path, purpose: 'original input observation helper; native input remains owner' });
}
const sdl = read('presentation-snapshot-overlay/generated/src/sdltiles.cpp', presentation.generated.sha256);
assert.equal(sdl.length, presentation.generated.bytes);
combined.set('src/sdltiles.cpp', sdl);
changes.set('src/sdltiles.cpp', { source: 'presentation-snapshot-overlay/generated/src/sdltiles.cpp', purpose: 'raw native text submissions and committed present observation' });
read('presentation-snapshot-overlay/presentation-snapshot.patch', presentation.patch.sha256);
for (const file of ['src/browser_text_snapshot.h', 'src/browser_text_snapshot.cpp']) {
  assert.ok(!combined.has(file));
  const bytes = read(path.join('presentation-snapshot-overlay', file));
  combined.set(file, bytes);
  changes.set(file, { source: 'presentation-snapshot-overlay/' + file, purpose: 'bounded owned raw text observation, not complete canvas' });
}
assert.equal(combined.size, 973);
const identityPayload = [...changes].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([file]) => ({ file, bytes: combined.get(file).length, sha256: sha(combined.get(file)) }));
const identity = 'cdda-authoritative-observers-v1-' + sha(JSON.stringify({ commit, identityPayload, commonFlags: baseline.commonFlags, cppFlags: baseline.cppFlags, warnings: baseline.warnings, linkOptimization: '-O1' })).slice(0, 24) + '-sdk6.0.8';
assert.ok(Buffer.byteLength(identity) <= 256);
const candidate = path.join(here, 'candidate-' + identity.split('-v1-')[1].split('-sdk')[0]);
const tree = path.join(candidate, 'sources');
assert.ok(normalize(candidate).startsWith(normalize(here) + '/'));
assert.ok(!fs.existsSync(candidate), 'fresh candidate path required; existing output is immutable');

const ordered = [...baseline.cppSources, ...baseline.cSources];
assert.equal(ordered.length, 438);
assert.equal(new Set(ordered).size, 438);
const changedOriginal = [...changes.keys()].filter(file => original.has(file));
const changedHeaders = changedOriginal.filter(file => file.endsWith('.h'));
assert.deepEqual([...changedHeaders].sort(), ['src/help.h', 'src/input.h', 'src/input_context.h']);
const compileResults = json('engine-build/compile-results.json');
const dependencyRows = [], objectRows = [], rebuild = [];
const dependencyContent = new Map();
function baselineObject(file) { return path.join(task, 'engine-build/objects', file.slice(4).replace(/\.(cpp|c)$/, '.o')); }
function baselineArgs(file) {
  return [...baseline.commonFlags, ...baseline.warnings,
    ...(file.endsWith('.c') ? ['-std=c17', '-x', 'c'] : baseline.cppFlags),
    ...(file.includes('/third-party/') ? ['-w'] : []), '-MMD', '-MP', '-c', baseline.upstream + '/' + file, '-o', baselineObject(file)];
}
for (const file of ordered) {
  const object = baselineObject(file), dep = object.replace(/\.o$/, '.d');
  const bytes = read(dep);
  // Supported original paths contain no whitespace. Parse the first rule only;
  // later -MP phony rules must not masquerade as compile dependencies.
  const rule = bytes.toString('utf8').replace(/\\\r?\n/g, ' ').split(/\r?\n/, 1)[0];
  const match = rule.match(/^(.+\.o):\s+(.+)$/);
  assert.ok(match && normalize(match[1]) === normalize(object), 'dependency target');
  const dependencies = match[2].trim().split(/\s+/).map(normalize);
  assert.ok(dependencies.includes(normalize(path.join(upstream, file))), 'source dependency');
  const reasons = changedOriginal.filter(name => dependencies.includes(normalize(path.join(upstream, name))));
  const row = { source: file, dependencyFile: evidence.get(normalize(dep)), dependentChangedFiles: reasons, dependencies };
  dependencyRows.push(row);
  if (reasons.length) rebuild.push(file);
  const success = compileResults.findLast(result => result.source === file);
  assert.ok(success && success.code === 0, 'successful source result');
  const log = read(success.logPath), command = JSON.parse(log.toString('utf8').split('\n', 1)[0]);
  assert.equal(command.tool, baseline.upstream ? 'C:/Users/kit/emsdk/upstream/emscripten/em++.py' : '');
  assert.deepEqual(command.args, baselineArgs(file), 'exact successful original compile flags');
  if (!reasons.length) {
    const objectBytes = read(object);
    const checked = [];
    for (const depPath of dependencies) {
      if (depPath.startsWith(normalize(upstream) + '/')) {
        const relative = depPath.slice(normalize(upstream).length + 1);
        assert.ok(original.has(relative), 'original dependency inventory');
        assert.equal(sha(combined.get(relative)), sha(original.get(relative)), 'unchanged reused sibling dependency');
        checked.push({ file: relative, bytes: original.get(relative).length, sha256: sha(original.get(relative)) });
      } else {
        assert.ok(depPath.startsWith(normalize(path.join(task, 'engine-build/generated')) + '/'), 'unrecognized non-system dependency blocks reuse');
        if (!dependencyContent.has(depPath)) dependencyContent.set(depPath, read(depPath));
        const b = dependencyContent.get(depPath);
        checked.push({ path: depPath, bytes: b.length, sha256: sha(b) });
      }
    }
    objectRows.push({ source: file, object: evidence.get(normalize(object)), successfulCommandLog: evidence.get(normalize(success.logPath)), success, unchangedDependencies: checked, requiresPrelinkRehash: true, referencedReadOnlyNotCopied: true });
  }
}
assert.equal(rebuild.length, 231);
assert.equal(objectRows.length, 207);
assert.deepEqual([...rebuild].sort(), sourcePlan.fullRelinkClosure.units.map(row => 'src/' + row.unit).sort());
assert.ok(rebuild.includes('src/sdltiles.cpp'));
const newUnits = ['src/browser_input_snapshot.cpp', 'src/browser_text_snapshot.cpp', 'src/cdda_help_semantic.cpp', 'src/cdda_help_transport.cpp'];
assert.deepEqual([...changes.keys()].filter(file => !original.has(file) && file.endsWith('.cpp')).sort(), [...newUnits].sort());
const linkOrder = [...ordered, ...newUnits];
assert.equal(linkOrder.length, 442);
const compilationOrder = [...newUnits, 'src/input_context.cpp', 'src/input.cpp', 'src/help.cpp', 'src/sdltiles.cpp', ...rebuild.filter(file => !['src/input_context.cpp', 'src/input.cpp', 'src/help.cpp', 'src/sdltiles.cpp'].includes(file))];
assert.equal(compilationOrder.length, 235);
assert.equal(new Set(compilationOrder).size, 235);

fs.mkdirSync(candidate, { recursive: true });
const sourcePins = [];
for (const [file, bytes] of [...combined].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
  const target = path.join(tree, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: 'wx' });
  assert.equal(sha(fs.readFileSync(target)), sha(bytes));
  sourcePins.push({ file, path: target, bytes: bytes.length, sha256: sha(bytes), origin: changes.get(file) ?? { source: 'pristine original source', purpose: 'unchanged original C++ gameplay/dependency' } });
}
const generated = path.join(candidate, 'generated');
fs.mkdirSync(generated);
for (const name of ['version.h', 'prefix.h']) {
  const bytes = read(path.join(task, 'engine-build/generated', name));
  fs.writeFileSync(path.join(generated, name), bytes, { flag: 'wx' });
}
const frozenConfig = read(prior.frozenSDK.config.path, prior.frozenSDK.config.sha256);
fs.writeFileSync(path.join(candidate, '.emscripten'), frozenConfig, { flag: 'wx' });
for (const d of ['objects', 'output', 'logs', 'evidence']) fs.mkdirSync(path.join(candidate, d));
const environment = { ...prior.commands[0].environment, EM_CONFIG: path.join(candidate, '.emscripten') };
const newObject = file => path.join(candidate, 'objects', file.slice(4).replace(/\.cpp$/, '.o'));
const commands = compilationOrder.map((file, index) => {
  fs.mkdirSync(path.dirname(newObject(file)), { recursive: true });
  const argv = baselineArgs(file);
  const c = argv.indexOf('-c'), o = argv.indexOf('-o');
  assert.ok(c > 0 && o > c);
  argv[c + 1] = path.join(tree, file);
  argv[o + 1] = newObject(file);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-I' + path.join(task, 'engine-build/generated')) argv[i] = '-I' + generated;
    if (argv[i] === '-I' + baseline.upstream + '/src') argv[i] = '-I' + path.join(tree, 'src');
    if (argv[i] === baseline.upstream + '/src/third-party') argv[i] = path.join(tree, 'src/third-party');
  }
  argv.splice(c, 0, '-DCDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID="' + identity + '"', '-DCDDA_TEXT_SNAPSHOT_BUILD_ID="' + identity + '"');
  assert.ok(argv.includes('-Os') && !argv.includes('-O1'));
  assert.ok(!argv.some(arg => arg.startsWith('-I') && arg.includes('/upstream/')));
  return { index, stage: 'compile-' + file.replace(/[^a-zA-Z0-9]/g, '_'), source: file, executable: prior.commands[0].executable, argv: [prior.commands[0].argv[0], ...argv], cwd: candidate, environment, outputObject: newObject(file), outputDependencyFile: newObject(file).replace(/\.o$/, '.d'), outputsMustBeFresh: true, soleRootReleasedWindowRequired: true, automaticRetry: false };
});
const objects = linkOrder.map(file => compilationOrder.includes(file) ? newObject(file) : baselineObject(file));
const response = objects.map(file => JSON.stringify(file.replaceAll('\\', '/'))).join('\n');
fs.writeFileSync(path.join(candidate, 'objects.rsp'), response, { flag: 'wx' });
const exports = ['_main', '_cdda_browser_snapshot_pin', '_cdda_browser_snapshot_data', '_cdda_browser_snapshot_size', '_cdda_browser_snapshot_release', '_cdda_text_snapshot_pin', '_cdda_text_snapshot_data', '_cdda_text_snapshot_size', '_cdda_text_snapshot_release', '_cdda_help_snapshot_pin', '_cdda_help_snapshot_data', '_cdda_help_snapshot_size', '_cdda_help_snapshot_release'];
const linkArgs = [...link.argv];
linkArgs[1] = '@' + path.join(candidate, 'objects.rsp');
linkArgs[linkArgs.indexOf('-o') + 1] = path.join(candidate, 'output/cataclysm-tiles.js');
linkArgs.splice(linkArgs.indexOf('-o'), 0, '-sEXPORTED_FUNCTIONS=' + JSON.stringify(exports));
assert.ok(linkArgs.includes('-O1') && linkArgs.includes('-sASYNCIFY') && linkArgs.includes('-Wl,--threads=1'));
assert.ok(!linkArgs.some(arg => /ASYNCIFY_(ONLY|REMOVE|IGNORE_INDIRECT|IMPORTS)|JSPI/.test(arg)));
const linkCommand = { stage: 'link-authoritative-observer-engine', executable: link.executable, argv: linkArgs, cwd: candidate, environment, outputJavascript: path.join(candidate, 'output/cataclysm-tiles.js'), outputWasm: path.join(candidate, 'output/cataclysm-tiles.wasm'), outputsMustBeFresh: true, soleRootReleasedWindowRequired: true, automaticRetry: false, executableOwnerReady: false };

let patch = '';
const lines = b => { const s = b.toString('utf8'); assert.ok(s.endsWith('\n') && !s.includes('\r')); return s.slice(0, -1).split('\n'); };
for (const file of [...changes.keys()].sort()) {
  const after = lines(combined.get(file));
  patch += `diff --git a/${file} b/${file}\n`;
  if (original.has(file)) {
    const before = lines(original.get(file));
    patch += `--- a/${file}\n+++ b/${file}\n@@ -1,${before.length} +1,${after.length} @@\n` + before.map(line => '-' + line + '\n').join('') + after.map(line => '+' + line + '\n').join('');
  } else patch += `new file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${after.length} @@\n` + after.map(line => '+' + line + '\n').join('');
}
fs.writeFileSync(path.join(here, 'combined-source.patch'), patch, { flag: 'wx' });
const baselinePackage = json('baseline-preview/web/package-manifest.json');
const noticeRows = baselinePackage.files.filter(row => /(?:^|\/)(?:notices|licenses)(?:\/|$)|attribution|notice-manifest|dependency-licenses|LICENSE|NOTICE/.test(row.path));
const licenseCopies = [];
for (const row of noticeRows) {
  const bytes = read(path.join(task, 'baseline-preview/web', row.path), row.sha256);
  assert.equal(bytes.length, row.bytes);
  licenseCopies.push({ path: row.path, bytes: bytes.length, sha256: sha(bytes), verifiedInExistingLocalPackage: true, copyToNewRuntimeRequired: true });
}
read('engine-build/dependency-license-manifest.json');
read('engine-build/dependency-provenance.json');
const attribution = read('baseline-preview/web/attribution.html').toString('utf8');
assert.ok(attribution.includes('https://github.com/CleverRaven/Cataclysm-DDA/tree/' + commit));
const GIB = 1024 ** 3;
const proof = {
  schemaVersion: 1, status: 'combined-source-and-command-plan-prepared-no-build-or-launch', generatedUtc: new Date().toISOString(), sourceCommit: commit, buildIdentity: identity, candidateDirectory: candidate,
  authority: { gameplay: 'unchanged original C++ engine', input: 'native C++/SDL event loop; observers cannot execute commands', presentation: 'native C++/SDL remains active; text-only owned observation is partial', platform: 'owned heap copies and local Node; original C++ IDBFS mount is sole owner' },
  originalSource: { files: original.size, bytes: [...original.values()].reduce((n, b) => n + b.length, 0), noPristineWrite: true },
  staging: { coherentSiblingTree: tree, files: sourcePins.length, bytes: sourcePins.reduce((n, row) => n + row.bytes, 0), changedOriginalFiles: changedOriginal.sort(), additions: [...changes.keys()].filter(file => !original.has(file)).sort(), pins: sourcePins },
  combinedPatch: { path: path.join(here, 'combined-source.patch'), bytes: Buffer.byteLength(patch), sha256: sha(Buffer.from(patch)), semanticInputMergeReversedByteExactly: true },
  dependencyClosure: { records: dependencyRows.length, bytes: dependencyRows.reduce((n, row) => n + row.dependencyFile.bytes, 0), changedHeaders, rebuiltExistingUnits: rebuild.length, rebuiltExistingSources: rebuild, newUnits, totalCompileCommands: commands.length, originalUnits: ordered.length, fullLinkedUnits: linkOrder.length, sdlAlreadyInSemanticClosure: true, recordsAndExactDependencies: dependencyRows },
  compatibleObjectReuse: { units: objectRows.length, verifiedOnlyNotLinked: true, requirements: ['Latest recorded original result exited zero', 'Successful command equals exact baseline flags/source/output', 'Every original non-system dependency is pinned and unchanged in coherent tree', 'No changed class/header/source appears in original MMD closure', 'Rehash original object/log/dependencies and frozen compiler/SDK immediately before link'], objects: objectRows, noFrozenHelperObjectReuse: true },
  compileCommands: commands,
  linkCommand,
  linkResponse: { path: path.join(candidate, 'objects.rsp'), bytes: Buffer.byteLength(response), sha256: sha(Buffer.from(response)), originalOrderPreserved: true, newHelpersAppendedOnce: true, totalObjects: objects.length },
  exportContract: { originalObservedModuleExports: ['_main'], originalMainRetained: true, explicitExports: exports, runtimeMethodsUnchanged: ['FS', 'stackTrace', 'jsStackTrace'], families: ['cdda-live-input-snapshot/1', 'cdda-native-text-submissions/1', 'cdda-help-observation/1'], notifications: ['globalThis.cddaInputSnapshotAvailable(kind=1)', 'globalThis.cddaTextSnapshotAvailable(kind=2)', 'globalThis.cddaHelpSnapshotAvailable(kind=3)'], callbacksDistinct: true },
  frozenSDK: prior.frozenSDK, inheritedCompilerAndSDKPinVerificationRequired: true,
  ownerGuard: { cpp2Helper: evidence.get(normalize(path.join(task, 'integration-overlay/build-plan/cpp-compile/run-compile-window.py'))), outerWrapper: evidence.get(normalize(path.join(task, 'presentation-snapshot-overlay/run-parser-window.py'))), primitive: 'verified same-buffer CPP2 loader -> reviewed load_guard + run_owned; never historical run_stage alone', compileOwnerAdapterPrepared: false, fullLinkOwnerAdapterPrepared: false, independentReviewAndRootSlotReleaseRequired: true },
  resources: {
    browserPriority: { physicalBytes: 7 * GIB, exactCommitBytes: 9 * GIB, reuseSingleAcceptedUnconsumedCandidate: true },
    compilation: { launchGate: prior.launchGate, ownedResourceGuard: prior.ownedResourceGuard, oneCompilePerRootReleasedWindow: true, deadlineSeconds: 180, claimEveryUnitFits: false, previousActualInputHelperStages: actualInputCompile.stages.map(stage => ({ stage: stage.stage, durationSeconds: stage.durationSeconds, jobPeakPrivateBytes: stage.jobPeakPrivateBytes, maximumSampledWorkingSetBytes: stage.maximumSampledWorkingSetBytes })), rule: 'Measure current fresh 4/6 launch fit. Preserve one job, 1 GiB cap and 2 GiB floors. A failed/deferred attempt is archived; no automatic retry or cap reduction.' },
    fullLinkProposalNotApprovedForExecution: { previousElapsedSeconds: resources.outcome.elapsedSeconds, previousSampledPeakPrivateBytes: resources.sampledResources.sampledPeakOwnedPrivateBytes, previousSampledPeakWorkingSetBytes: resources.sampledResources.sampledPeakOwnedWorkingSetBytes, proposedPhysicalLaunchBytes: 6 * GIB, proposedExactCommitLaunchBytes: 6 * GIB, maximumOwnedPrivateBytes: 4 * GIB, maximumOwnedWorkingSetBytes: 4 * GIB, runningPhysicalAndCommitFloorsBytes: 2 * GIB, deadlineSeconds: 600, workers: 1, rationale: 'Fresh 6/6 is 4 GiB bounded owned cap plus 2 GiB global floor. Existing full-engine observed peak is 3,559,145,472 private / 3,592,372,224 working-set bytes. A 600-second finite deadline exceeds the observed 229.930-second original link; new helper effect is unmeasured. Link needs a separately reviewed CPP2-compatible budget adapter; the current compile-only 1 GiB/180-second owner cannot execute it.' },
    cleanup: 'Fresh unnamed Windows Job; native suspended root handle and exact FILETIME assigned before resume; run_owned finally owns only returned handles. Close every root/job, verify no survivors and preserve PID35584 Node preview server. No unrelated process or cache mutation.'
  },
  localPackage: { acceptedManifest: evidence.get(normalize(path.join(task, 'baseline-preview/web/package-manifest.json'))), acceptedIndex: evidence.get(normalize(path.join(task, 'baseline-preview/web/index.html'))), serverSource: evidence.get(normalize(path.join(task, 'baseline-preview/serve-local.mjs'))), oldEngineAndPackageUntouched: true, newRuntimeTarget: 'baseline-preview/web/integrated-observers/index.html after actual link and host validation', serverIdentityExpected: { pid: 35584, creationFiletimeDecimal: '134354521644890629', url: 'http://127.0.0.1:8878/' }, liveIdentityAndHttpMustBeRecapturedBeforeStage: true, noticesVerified: licenseCopies, originalRuntimeDataMayBeReferencedWithoutRepackaging: true, newEngineMustUseOriginalPinnedCataclysmTilesDataJsAndData: true, sourceOfferMustIncludeCombinedPatchNewHelperAndExactBuildRecipes: true, externalPublication: false, v5AssetsAreIndependentParentOwnedAndNeverChangedHere: true },
  blockers: [
    'No full candidate compiler/linked WASM/browser execution has occurred; exact coherent source plan requires independent root acceptance.',
    'A one-command CPP2 owner adapter with complete source/object/frozen SDK before/after pin closure is still required for each compile release.',
    'Full link cannot fit the compile-only 1 GiB/180-second owner. Derive and review the separate finite 4 GiB/600-second owned link adapter before release; measure fresh 6/6 and defer to eligible accepted browser candidate.',
    'Real synchronous Rust WASM consumers/host hooks for these three families are not available in the accepted runtime. Current standalone tests and byte-copy contracts cannot substitute for actual Rust acceptance.',
    'Movement help selection/default-mode/native key description/nested editing must execute in the fully linked original engine. Existing focused fixture does not execute that scope.',
    'Direct native input readers remain untracked, so observations always deny helper command authorization.',
    'Raw text records omit tiles, overmap, minimap, clears, retained canvas and ImGui; full Rust presentation and whole-game render/RNG/save compatibility remain unverified.'
  ],
  nextOperations: [
    'Independently review this source tree, exact merge reversal, 438 MMD records, 231 affected / 207 reusable split, compile/link argv and preserved licenses.',
    'Prepare reviewed single-command CPP2 owner binding for first new helper only; record full source/SDK cache and protected baseline pin closure; root releases one heavy window after fresh browser-priority check.',
    'Compile four helpers then original input_context/input/help/sdltiles; after each real result inspect new MMD against coherent tree and diagnostics, verify owned handles closed and original protected bytes unchanged.',
    'Continue the remaining 227 affected originals individually with fresh gate and root release; invalidate reuse if new dependency evidence or flags change. Do not mix untouched pristine sibling class headers.',
    'Pin 235 real new objects and all 207 reused originals, validate 442-entry response and actual SDK archives; execute exactly one separately reviewed O1 conservative Asyncify link when resource fit and root slot permit.',
    'Validate actual WASM binary, JS syntax and all 13 exports; preserve trace/licensing/source-offer. Stage separate runtime and observer-only host callbacks with copy/release finally and exact Rust ABI identity.',
    'In actual browser verify original native menus/help/nested bindings/Unicode/heap growth/failed pin lifetime and native RNG/state neutrality before any stronger claim. Original game remains playable on unavailable observations.',
    'Proceed through original world generation, character creation, movement, combat, inventory, craft/build, save/export/reload/resume and PC/mobile flows; compare observation state and native RNG/save hashes. Keep partial semantic/presentation/input limits explicit.'
  ],
  evidencePins: [...evidence.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')),
  compilerExecuted: false, CargoExecuted: false, NodeWasmExecuted: false, browserExecuted: false, originalEngineIntegrated: false, completePort: false,
};
fs.writeFileSync(path.join(here, 'FULL-INTEGRATION-PLAN.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(here, 'SOURCE-STAGING.json'), JSON.stringify({ schemaVersion: 1, status: proof.status, sourceCommit: commit, buildIdentity: identity, candidateDirectory: candidate, fileCount: sourcePins.length, totalBytes: proof.staging.bytes, pins: sourcePins, noBuildExecuted: true }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: proof.status, sourceFiles: sourcePins.length, sourceBytes: proof.staging.bytes, affectedOriginalUnits: rebuild.length, reusableOriginalObjects: objectRows.length, newHelpers: newUnits.length, compileCommands: commands.length, fullLinkedUnits: linkOrder.length, buildIdentity: identity, planSha256: sha(fs.readFileSync(path.join(here, 'FULL-INTEGRATION-PLAN.json'))) }));
