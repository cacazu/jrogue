// Bounded source-only preparation; no compiler/process/network invocation.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const sha = data => createHash('sha256').update(data).digest('hex');
const bytes = file => readFileSync(path.isAbsolute(file) ? file : path.join(ROOT, file));
const pin = file => ({path: path.resolve(ROOT, file), bytes: bytes(file).length, sha256: sha(bytes(file))});
const json = file => JSON.parse(bytes(file).toString('utf8'));
const relative = file => path.relative(ROOT, file).replaceAll('\\', '/');
const baselineFile = 'engine-build/build-manifest.json';
const baseline = json(baselineFile);
const source = json('integration-overlay/SOURCE-PREPARATION.json');
assert.equal(baseline.upstreamCommit, source.sourceCommit);
assert.equal(baseline.actualCompiler, '6.0.8');
assert.ok(baseline.commonFlags.includes('-DEMSCRIPTEN'));
assert.equal(baseline.cppSources.length + baseline.cSources.length, 438);
const logFile = 'engine-build/logs/compile-src_input_context_cpp.log';
const log = JSON.parse(bytes(logFile).toString('utf8').split(/\r?\n/)[0]);
const baselineFlags = [...baseline.commonFlags, ...baseline.warnings, ...baseline.cppFlags];
assert.deepEqual(log.args.slice(0, baselineFlags.length), baselineFlags);
assert.deepEqual(log.args.slice(baselineFlags.length, -3), ['-MMD', '-MP', '-c']);
assert.equal(path.resolve(log.args.at(-3)), path.resolve(baseline.upstream, 'src/input_context.cpp'));
assert.equal(log.args.at(-2), '-o');
const records = json('engine-build/compile-results.json');
const originalResult = records.filter(item => item.source === 'src/input_context.cpp' && item.code === 0).at(-1);
assert.ok(originalResult);
assert.equal(records.filter(item => item.source === 'src/input_context.cpp').length, 1);
const dependencyFile = 'engine-build/objects/input_context.d';
const logicalLine = bytes(dependencyFile).toString('utf8').replace(/\\\r?\n/g, ' ').split(/\r?\n/)[0];
const delimiter = logicalLine.indexOf(': ');
assert.ok(delimiter > 0);
const dependencyPaths = [...new Set(logicalLine.slice(delimiter + 2).trim().split(/\s+/).map(file => path.resolve(file)))];
assert.equal(dependencyPaths.length, 144);
for (const file of dependencyPaths) assert.ok(file.startsWith(path.resolve(baseline.upstream) + path.sep));
const baselineDependencies = dependencyPaths.map(pin);
for (const item of source.sourceInputs) assert.equal(pin(path.join(baseline.upstream, item.path)).sha256, item.sha256);
const patchFiles = [...bytes('integration-overlay/live-input-snapshot.patch').toString('utf8').matchAll(/^\+\+\+ b\/(\S+)$/gm)].map(match => match[1]);
assert.deepEqual(patchFiles.sort(), ['src/browser_input_snapshot.cpp', 'src/browser_input_snapshot.h', 'src/input_context.cpp']);
assert.equal(source.modifiedOriginalFiles.length, 1);
assert.equal(source.modifiedOriginalFiles[0], 'src/input_context.cpp');

const destination = path.join(HERE, 'cpp-compile');
const stagedSrc = path.join(destination, 'sources/src');
const objects = path.join(destination, 'objects');
mkdirSync(stagedSrc, {recursive: true});
mkdirSync(objects, {recursive: true});
const stagedFiles = [];
for (const name of ['input_context.cpp', 'browser_input_snapshot.cpp', 'browser_input_snapshot.h']) {
  const original = 'integration-overlay/generated/src/' + name;
  const expected = name === 'input_context.cpp' ? source.patchedInput.sha256 : source.additions.find(item => item.path.endsWith('/' + name)).sha256;
  assert.equal(pin(original).sha256, expected);
  const target = path.join(stagedSrc, name);
  writeFileSync(target, bytes(original));
  stagedFiles.push({...pin(target), copiedExactlyFrom: original});
}
assert.deepEqual(readdirSync(stagedSrc).sort(), ['browser_input_snapshot.cpp', 'browser_input_snapshot.h', 'input_context.cpp']);
const configInput = bytes('engine-build/.emscripten').toString('utf8');
assert.ok(!/FROZEN_CACHE/.test(configInput));
const configPath = path.join(destination, '.emscripten');
writeFileSync(configPath, configInput + '\nFROZEN_CACHE = True\n');
const cache = path.resolve(log.EM_CACHE), ports = path.resolve(log.EM_PORTS);
assert.equal(bytes(path.join(cache, 'sanity.txt')).toString('utf8').trim(), '6.0.8|C:/Users/kit/emsdk/upstream/bin');
const cacheIncludes = path.join(cache, 'sysroot/include');
for (const header of ['SDL2/SDL.h', 'SDL2/SDL_image.h', 'SDL2/SDL_ttf.h', 'emscripten.h', 'c++/v1/string', 'c++/v1/vector', 'c++/v1/array', 'c++/v1/memory', 'c++/v1/stdexcept']) assert.ok(existsSync(path.join(cacheIncludes, header)), 'frozen baseline include missing: ' + header);
const baselineGeneratedDirectory = path.resolve(ROOT, 'engine-build/generated');
const generatedPins = readdirSync(baselineGeneratedDirectory).filter(name => name.endsWith('.h')).sort().map(name => pin(path.join(baselineGeneratedDirectory, name)));
const includePins = ['SDL2/SDL.h', 'SDL2/SDL_image.h', 'SDL2/SDL_ttf.h', 'emscripten.h', 'c++/v1/string', 'c++/v1/vector', 'c++/v1/array', 'c++/v1/memory', 'c++/v1/stdexcept'].map(name => pin(path.join(cacheIncludes, name)));
const patchHash = source.patch.sha256;
const buildId = 'cdda-input-snapshot-compilecheck-v1-p' + patchHash.slice(0, 16) + '-f' + sha(JSON.stringify(baselineFlags)).slice(0, 16) + '-sdk6.0.8';
const buildDefine = '-DCDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID="' + buildId + '"';
const sdk = 'C:/Users/kit/emsdk';
const executable = path.resolve(sdk, 'python/3.13.3_64bit/python.exe');
const environment = {EM_CONFIG: configPath, EM_CACHE: cache, EM_PORTS: ports, EMSDK_PYTHON: executable,
  EMCC_CORES: '1', EMCC_BATCH_BUILD: '0', BINARYEN_CORES: '1'};
const commands = ['input_context', 'browser_input_snapshot'].map(name => ({stage: 'compile-overlay-' + name,
  executable, argv: [log.tool, '-v', '-I' + stagedSrc, ...baselineFlags, buildDefine,
    '-MMD', '-MP', '-c', path.join(stagedSrc, name + '.cpp'), '-o', path.join(objects, name + '.o')],
  cwd: destination, environment, outputObject: path.join(objects, name + '.o'),
  outputDependencyFile: path.join(objects, name + '.d'), scope: 'One original-baseline-compatible wasm32 translation unit; compile only, no link/runtime'}));
const previousGuardPlan = json('semantic-runtime-catalog/build-plan/consumer-build-plan.json');
const protectedFiles = ['integration-overlay/SOURCE-PREPARATION.json', 'integration-overlay/SOURCE-REVIEW.md',
  'cosmetic-purity-overlay/SOURCE-REVIEW.md', 'cosmetic-purity-overlay/SOURCE-PREPARATION.json',
  'engine-build/build-manifest.json', 'engine-build/compile-results.json', logFile, dependencyFile,
  'engine-build/objects/input_context.o', 'engine-build/dependency-provenance.json', 'engine-build/dependency-license-manifest.json',
  'engine-build/cache-policy.json', 'engine-build/.emscripten', 'integration-overlay/live-input-snapshot.patch',
  'integration-overlay/SOURCE-CHECKS.json'];
const wrapperPath = path.resolve(ROOT, 'presentation-snapshot-overlay/run-parser-window.py');
const manifest = {schemaVersion: 1, status: 'source-plan-prepared-no-compiler-run', sourceCommit: baseline.upstreamCommit,
  compilerExecuted: false, CargoExecuted: false, browserExecuted: false, browserRecoveryHasPriority: true,
  parentExclusiveSlotReleaseRequired: true, compilationTargets: ['src/input_context.cpp', 'src/browser_input_snapshot.cpp'],
  originalInputCppUnchanged: true, originalHeaderChanges: [], stagedFiles,
  baseline: {manifest: pin(baselineFile), sourceUnits: 438, compiler: baseline.actualCompiler, officialRecipeCompiler: baseline.officialCompiler,
    actualInputContextCommand: pin(logFile), exactBaseFlagsPreserved: baselineFlags, success: originalResult,
    object: pin('engine-build/objects/input_context.o'), dependencyFile: pin(dependencyFile), originalDependencies: baselineDependencies,
    generatedHeaderInputs: generatedPins, sdkHeaderInputs: includePins,
    note: 'The no-legacy-macro attempt is incomplete historical input and intentionally excluded; accepted baseline preserves -DEMSCRIPTEN'},
  includeResolution: {stagedSiblingHeader: path.join(stagedSrc, 'browser_input_snapshot.h'),
    newSearchDirectory: stagedSrc, originalSourceDirectory: path.resolve(baseline.upstream, 'src'),
    baselineIncludeOrderPreserved: true, originalClassHeadersAreNotCopiedOrReplaced: true,
    originalQuotedSiblingResolution: 'Patched source has no sibling original class headers; baseline -I original src resolves the exact originals. Original headers then search their original sibling directories. New snapshot header resolves beside both staged TUs.',
    sdkAndPortSystemHeaderTransitiveCoverage: 'Baseline MMD excludes system headers; retained SDK/cache/official-port provenance and explicit top-level headers are pinned. Actual compiler verbose/dependency output is still required; no claim of preprocessor execution is made.'},
  buildIdentity: {value: buildId, argvMacro: buildDefine, scope: 'Distinct compile-check identity, not a linked or gameplay-accepted build'},
  frozenSDK: {config: pin(configPath), configSource: pin('engine-build/.emscripten'), cache, ports,
    sanity: pin(path.join(cache, 'sanity.txt')), provenance: pin('engine-build/dependency-provenance.json'),
    missingCachePolicy: 'Fail closed on missing cache/port variant; no download, regeneration, activation, install or global config changes'},
  installedTools: [executable, log.tool, path.join(sdk, 'upstream/bin/clang++.exe')].map(pin),
  protectedFiles: protectedFiles.map(pin), commands,
  resourceEvidence: {inputContextOriginalCompileMilliseconds: originalResult.milliseconds,
    inputContextPerUnitPrivatePeakBytes: null, inputContextPerUnitWorkingSetPeakBytes: null,
    newModulePreviouslyCompiled: false, newModulePerUnitPrivatePeakBytes: null,
    canClaimFitsOneGiB: false,
    note: 'No source-associated per-unit peak was found. compile-results records elapsed/exit only. The general resource checkpoint has no source attribution; link peaks do not establish TU peaks. Guarded compilation must measure fit, and any cap breach stops only that owned job.'},
  launchGate: previousGuardPlan.launchGate, ownedResourceGuard: previousGuardPlan.ownedResourceGuard,
  rustEnvironment: {},
  guard: {historicalHelper: pin('semantic-runtime-catalog/run-consumer-window.py'),
    failClosedWrapperPath: wrapperPath, currentWrapper: pin(wrapperPath),
    reviewStatus: 'Parent/help_semantic_slice review and stable hash confirmation required before execution',
    requiredFunction: 'run_owned(guard, command, destination)',
    historicalRunStageAloneForbidden: true,
    note: 'Future owned C++ runner must call the reviewed fail-closed outer run_owned wrapper; the parser-only CLI cannot accept these C++ stages. It cannot launch with old run_stage unchanged. rustEnvironment is deliberately empty for the historical helper environment key; all C++ environment overrides are exact command.environment fields.'},
  removeInheritedEnvironment: previousGuardPlan.removeInheritedEnvironment,
  futureEvidenceRequired: ['Parent browser-priority/exclusive-slot release', 'Stable reviewed fail-closed wrapper hash and exact plan hash',
    'Fresh physical/exact-commit gates for each TU', 'Exact SDK/clang argv and frozen cache selection',
    'Owned root/job/member creation identities, cap/floor samples and cleanup evidence', 'Object and fresh MMD dependency hashes',
    'Protected source/header/object/cache sanity hashes before and after', 'Warnings/errors and distinct TU verdicts'],
  nextValidityScope: 'Successful two-object compile proves C++ translation-unit/type/access/EM_JS lowering validity only. No old object replacement, final exports, link, Asyncify/notifications, original producer execution, host copy or native/Rust/state/RNG/browser acceptance.',
  originalProducerConnected: false, runtimeConnected: false, wholeGameSemanticMigrationComplete: false};
writeFileSync(path.join(destination, 'compile-plan.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({status: manifest.status, translationUnits: 2, pinnedOriginalDependencies: baselineDependencies.length,
  preservedBaselineUnits: 438, originalInputCompileMilliseconds: originalResult.milliseconds, measuredOneGiBFit: false, compilerExecuted: false}));
