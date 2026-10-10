// Read verified owned-stage evidence and publish scoped consumer results.
// No compiler, process spawning, source extraction or catalog mutation.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT, SOURCE_COMMIT, serialized} from './convert.mjs';

const execution = path.join(ROOT, 'semantic-runtime-catalog/build-plan/execution');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const plan = read(path.join(ROOT, 'semantic-runtime-catalog/build-plan/consumer-build-plan.json'));
const dependencyAudit = read(path.join(ROOT, 'semantic-runtime-catalog/build-plan/dependency-source-audit.json'));
assert.equal(dependencyAudit.status, 'passed-read-only-source-audit');
assert.equal(dependencyAudit.registryArchivesVerified, 13);
assert.equal(dependencyAudit.planSha256, hash(path.join(ROOT, 'semantic-runtime-catalog/build-plan/consumer-build-plan.json')));
const originalBefore = read(path.join(execution, 'input-fingerprints-before.json'));
assert.deepEqual(originalBefore, read(path.join(execution, 'input-fingerprints-after.json')));
assert.deepEqual(originalBefore, read(path.join(execution, 'native-retry/input-fingerprints-before.json')));
assert.deepEqual(originalBefore, read(path.join(execution, 'native-retry/input-fingerprints-after.json')));
for (const [file, expected] of Object.entries(originalBefore)) assert.equal(hash(file), expected, file);
assert.equal(read(path.join(execution, 'native-retry/terminal.json')).status, 'passed');

function stage(name, retry = false, tests = null) {
  const directory = retry ? path.join(execution, 'native-retry') : execution;
  const file = path.join(directory, name + '.json');
  const result = read(file);
  assert.equal(result.passed, true); assert.equal(result.exitCode, 0);
  assert.deepEqual(result.remainingOwnedPidsBeforeJobClose, []);
  assert.ok(result.rootIdentity.pid > 0 && result.rootIdentity.creationFiletime > 0);
  assert.ok(result.identities.every(identity => identity.pid > 0 && identity.creationFiletime > 0));
  assert.ok(result.freshGate.physicalFreeBytes >= 4 * 2 ** 30);
  assert.ok(result.freshGate.exactCommitHeadroomBytes >= 6 * 2 ** 30);
  assert.ok(result.jobPeakPrivateBytes <= 2 ** 30);
  assert.ok(result.samples.length > 0);
  for (const sample of result.samples) {
    assert.ok(sample.physicalFreeBytes >= 2 * 2 ** 30);
    assert.ok(sample.exactCommitHeadroomBytes >= 2 * 2 ** 30);
    assert.ok(sample.ownedPrivateBytes <= 2 ** 30 && sample.ownedWorkingSetBytes <= 2 ** 30);
  }
  const stdoutPath = path.join(directory, name + '.stdout.log');
  const stderrPath = path.join(directory, name + '.stderr.log');
  const stdout = readFileSync(stdoutPath, 'utf8');
  if (tests !== null) assert.ok(stdout.includes(`test result: ok. ${tests} passed; 0 failed;`));
  return {name, testsPassed: tests, evidence: path.relative(ROOT, file).replaceAll('\\', '/'), evidenceSha256: hash(file),
    argv: result.argv, cwd: result.cwd, durationSeconds: result.durationSeconds,
    freshGate: result.freshGate, jobPeakPrivateBytes: result.jobPeakPrivateBytes,
    sampledPeakWorkingSetBytes: Math.max(...result.samples.map(item => item.ownedWorkingSetBytes)),
    minimumSampledPhysicalFreeBytes: Math.min(...result.samples.map(item => item.physicalFreeBytes)),
    minimumSampledExactCommitHeadroomBytes: Math.min(...result.samples.map(item => item.exactCommitHeadroomBytes)),
    remainingOwnedProcesses: 0, identityPinnedProcessesObserved: result.identities.length,
    stdout: path.relative(ROOT, stdoutPath).replaceAll('\\', '/'), stdoutSha256: hash(stdoutPath),
    stderr: path.relative(ROOT, stderrPath).replaceAll('\\', '/'), stderrSha256: hash(stderrPath)};
}
const literal = stage('catalog-genuine-rust-consumer', false, 7);
const plural = stage('plural-genuine-rust-consumer', false, 5);
const nativeBuild = stage('native-cpp-selector-fixture-build', true);
const nativeRun = stage('native-cpp-selector-fixture-node-execution', true);
assert.equal(readFileSync(path.join(ROOT, nativeRun.stdout), 'utf8').trim(), 'native plural selector fixtures passed; original game producer remains unconnected');
const nativeStderr = readFileSync(path.join(ROOT, nativeBuild.stderr), 'utf8');
const linkerLine = nativeStderr.split(/\r?\n/).find(line => line.includes('wasm-ld.exe'));
assert.ok(linkerLine?.includes('wasm32-emscripten'));
const archiveNames = [...new Set([...linkerLine.matchAll(/(?:^|\s)-l([^\s]+)/g)].map(match => 'lib' + match[1] + '.a'))].sort();
const archiveDirectory = path.join(plan.nativeFrozenConfig.cache, 'sysroot/lib/wasm32-emscripten');
const selectedNativeArchives = Object.fromEntries(archiveNames.map(name => [name, hash(path.join(archiveDirectory, name))]));
const clangVersion = /clang version ([^\r\n]+)/.exec(nativeStderr)?.[1];
assert.ok(clangVersion);

function executableFor(directory, prefix) {
  const folder = path.join(ROOT, directory, 'rust-verification/target/x86_64-pc-windows-gnu/debug/deps');
  const candidates = readdirSync(folder).filter(file => file.startsWith(prefix + '-') && file.endsWith('.exe'));
  assert.equal(candidates.length, 1);
  const file = path.join(folder, candidates[0]);
  return {file: path.relative(ROOT, file).replaceAll('\\', '/'), sha256: hash(file)};
}
const fingerprintMap = Object.fromEntries(Object.entries(originalBefore).map(([file, fingerprint]) => [path.relative(ROOT, file).replaceAll('\\', '/'), fingerprint]));
const shared = {schemaVersion: 1, status: 'passed-genuine-consumer-tests', sourceCommit: SOURCE_COMMIT,
  actualRustConsumerCompiled: true, cargoOfflineLockedAccepted: true, frozenRegistryPackages: 13,
  dependencySourceAudit: 'semantic-runtime-catalog/build-plan/dependency-source-audit.json',
  inputSourceCatalogLockSha256Unchanged: fingerprintMap,
  originalProducerConnected: false, runtimeConnected: false,
  completeNativeCallerGraphVerified: false, wholeGameSemanticMigrationComplete: false,
  heavySlotReleased: true, externalHostingPerformed: false,
  scope: 'Actual existing native Rust Catalog parser/formatter; no original-game producer, FFI, browser UI or whole-game semantic consumption'};
const literalResult = {...shared, preparedPublicIds: 315, explicitlyExcludedIds: 224,
  actualRustConsumerTestsPassed: 7, rustConsumerVerified: true, stage: literal,
  executable: executableFor('semantic-runtime-catalog', 'catalog'),
  checks: ['All 315 IDs format exact original English/Japanese text', 'All 224 excluded IDs remain missing in both locales',
    'Unique provenance IDs and 315/224 partition equal the exact original 539 IDs', 'Japanese default and explicit missing-ID behavior',
    'Literal brace/UTF-8/whitespace roundtrip', 'Extra parameters and malformed templates/schema/Unicode are rejected'],
  remainingGates: ['Bind original definition identity and caller semantics', 'Connect an original C++ text producer through reviewed FFI',
    'Resolve excluded printf/snippet/rich-text/dialogue producers', 'Verify live rendering, RNG purity and actual game flows']};
const nativeOutputDirectory = path.join(ROOT, 'semantic-plural-slice/native-consumer-build');
const pluralResult = {...shared, preparedPublicIds: 155, internalTestOnlyDispatchers: 1,
  actualRustConsumerTestsPassed: 5, rustConsumerVerified: true, stage: plural,
  executable: executableFor('semantic-plural-slice', 'plural'),
  nativeFixture: {status: 'passed-standalone-wasm32-fixture', actualNativeCPPSelectorTestPassed: true,
    originalGameProducerExecuted: false, target: 'wasm32-unknown-emscripten', clangVersion,
    source: 'semantic-plural-slice/native-selector-fixtures.cpp', sourceSha256: hash(path.join(ROOT, 'semantic-plural-slice/native-selector-fixtures.cpp')),
    build: nativeBuild, run: nativeRun, selectedFrozenArchiveSha256: selectedNativeArchives,
    outputSha256: Object.fromEntries(['selector-fixtures.cjs', 'selector-fixtures.wasm'].map(name => [name, hash(path.join(nativeOutputDirectory, name))])),
    sandboxSpawnFailure: {preserved: true, evidence: 'semantic-runtime-catalog/build-plan/execution/native-cpp-selector-fixture-build.json',
      reason: 'Unescalated sandbox SDK clang spawn returned permission denied; scoped official-SDK escalation succeeded without security or global changes'},
    cases: ['0, 1, 2, -1, INT_MIN, INT_MAX', 'contextual int -> unsigned long long -> size_t',
      'Liquid clamp precedes conversion', 'Non-liquid and selected variant/mtype paths remain unclamped',
      'Pinned wasm32 unsigned narrowing gates at INT_MAX+1 and UINT_MAX', 'Current statistic, achievement target and default-one routes'],
    limitation: 'These reviewed source-mirrored functions establish compiler ABI/selector fixtures; they do not invoke the original translation cache/MO/engine producer'},
  checks: ['All 155 public identities retain exact original singular/plural/context and Japanese translation',
    'Actual typed Term API preserves both English forms and Japanese invariance', 'Unique catalog/inventory identity sets match',
    'Distinct test-only binder remains absent from the 539 public IDs', 'Wrong/missing/extra typed operands, missing IDs and recursive term are rejected'],
  remainingGates: ['Original loaded definition identity/mod precedence and live item phase', 'Original caller/quantity/target freezes selector',
    'Connect original C++ producer through FFI', 'Preserve complete dynamic name assembly and fallback', 'Verify render/RNG purity and real game flows']};
writeFileSync(path.join(ROOT, 'semantic-runtime-catalog/output/genuine-consumer-verification.json'), serialized(literalResult));
writeFileSync(path.join(ROOT, 'semantic-plural-slice/output/genuine-consumer-verification.json'), serialized(pluralResult));
writeFileSync(path.join(ROOT, 'semantic-runtime-catalog/build-plan/consumer-results.json'), serialized({
  schemaVersion: 1, status: 'passed', heavySlotReleased: true, originalProducerConnected: false,
  wholeGameSemanticMigrationComplete: false, literalRustTestsPassed: 7, pluralRustTestsPassed: 5,
  standaloneNativeFixturePassed: true, stages: [literal, plural, nativeBuild, nativeRun],
  sourceCatalogLockFingerprintsUnchanged: true, selectedNativeArchives, selectedFrozenArchiveSha256: selectedNativeArchives,
  compiledNativeCommands: 3, networkUsed: false, globalSDKConfigurationChanged: false, frozenCacheRegenerated: false,
  initialSandboxFailurePreserved: true}));
console.log(JSON.stringify({status: 'passed', literalRustTests: 7, pluralRustTests: 5,
  standaloneNativeFixturePassed: true, selectedFrozenArchives: archiveNames.length, originalProducerConnected: false}));
