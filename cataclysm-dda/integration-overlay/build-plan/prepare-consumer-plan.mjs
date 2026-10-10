// Lightweight read-only source/cache audit and owned plan/manifest preparation.
// No Cargo/compiler/browser or other child process is invoked.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = file => sha(readFileSync(path.join(ROOT, file)));
const read = file => readFileSync(path.join(ROOT, file), 'utf8');
const base = JSON.parse(read('semantic-runtime-catalog/build-plan/consumer-build-plan.json'));
const sourceAudit = JSON.parse(read('semantic-runtime-catalog/build-plan/dependency-source-audit.json'));
assert.equal(sourceAudit.status, 'passed-read-only-source-audit');
const sourceLock = read('rust-contracts/Cargo.lock');
const snapshotLock = read('integration-overlay/rust-snapshot-consumer/Cargo.lock');
const parse = input => new Map(input.split('[[package]]').slice(1).map(tail => {
  const block = '[[package]]' + tail.trimEnd() + '\n';
  const name = /^name = "([^"]+)"$/m.exec(block)?.[1];
  const version = /^version = "([^"]+)"$/m.exec(block)?.[1];
  assert.ok(name && version);
  return [name, {name, version, block, dependencies: [...(/dependencies = \[([\s\S]*?)\]/.exec(block)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(match => match[1])}];
}));
const packages = parse(sourceLock), prepared = parse(snapshotLock);
const selected = new Set();
function visit(name) {
  if (selected.has(name)) return;
  const item = packages.get(name); assert.ok(item);
  selected.add(name); item.dependencies.forEach(visit);
}
['serde', 'serde_json'].forEach(visit);
assert.equal(selected.size, 11);
for (const name of selected) assert.equal(prepared.get(name)?.block, packages.get(name).block, name);
assert.equal(prepared.size, 12);
assert.equal(prepared.get('cdda-live-input-snapshot-consumer')?.version, '0.1.0');
assert.deepEqual(prepared.get('cdda-live-input-snapshot-consumer')?.dependencies, ['serde', 'serde_json']);
const pins = [...selected].sort().map(name => {
  const pin = base.cachedDependencies.find(item => item.name === name);
  const audit = sourceAudit.records.find(item => item.name === name);
  assert.equal(pin.version, packages.get(name).version);
  assert.equal(audit.archiveSha256, pin.sha256);
  assert.equal(sha(readFileSync(pin.archive)), pin.sha256);
  return {...pin, sourceArchiveEqualityEvidence: 'semantic-runtime-catalog/build-plan/dependency-source-audit.json'};
});

const cosmeticDirectory = path.join(ROOT, 'cosmetic-purity-overlay/build-plan');
mkdirSync(cosmeticDirectory, {recursive: true});
const originalCosmeticManifest = read('cosmetic-purity-overlay/rust/Cargo.toml');
assert.ok(originalCosmeticManifest.includes('path = "src/lib.rs"'));
const ownedCosmeticManifest = originalCosmeticManifest.replace('path = "src/lib.rs"', 'path = "../rust/src/lib.rs"');
writeFileSync(path.join(cosmeticDirectory, 'Cargo.toml'), ownedCosmeticManifest);
writeFileSync(path.join(cosmeticDirectory, 'Cargo.lock'), '# Source-prepared std-only lock; actual offline/locked acceptance pending.\nversion = 4\n\n[[package]]\nname = "cdda-cosmetic-presentation-source"\nversion = "0.1.0"\n');

const sourceFiles = ['integration-overlay/rust-snapshot-consumer/Cargo.toml', 'integration-overlay/rust-snapshot-consumer/Cargo.lock',
  'integration-overlay/rust-snapshot-consumer/tests/contract.rs', 'cosmetic-purity-overlay/rust/Cargo.toml',
  'cosmetic-purity-overlay/build-plan/Cargo.toml', 'cosmetic-purity-overlay/build-plan/Cargo.lock',
  'semantic-runtime-catalog/run-consumer-window.py', 'rust-contracts/Cargo.lock',
  'semantic-runtime-catalog/build-plan/dependency-source-audit.json'];
for (const directory of ['integration-overlay/rust-snapshot-consumer/src', 'integration-overlay/rust-snapshot-consumer/fixtures', 'cosmetic-purity-overlay/rust/src']) {
  for (const name of readdirSync(path.join(ROOT, directory)).sort()) if (name.endsWith('.rs') || name.endsWith('.json')) sourceFiles.push(directory + '/' + name);
}
const sourceSha256 = Object.fromEntries(sourceFiles.map(file => [file, hash(file)]));
const snapshotTests = [...read('integration-overlay/rust-snapshot-consumer/tests/contract.rs').matchAll(/#\[test\]\s+fn\s+(\w+)/g)].map(match => match[1]);
const cosmeticTests = [...read('cosmetic-purity-overlay/rust/src/tests.rs').matchAll(/#\[test\]\s+fn\s+(\w+)/g)].map(match => match[1]);
assert.equal(snapshotTests.length, 19); assert.equal(cosmeticTests.length, 5);
const command = (stage, manifest, targetDirectory, testArguments, expectedTests, expectedScope, evidenceDirectory) => ({
  stage, executable: base.installedNativeTools.cargo,
  argv: ['test', '--offline', '--locked', '--jobs', '1', '--manifest-path', path.join(ROOT, manifest), '--target', 'x86_64-pc-windows-gnu',
    '--target-dir', path.join(ROOT, targetDirectory), ...testArguments, '--', '--test-threads=1'],
  cwd: ROOT, expectedTests, expectedScope, evidenceDirectory});
const plan = {schemaVersion: 1, status: 'source-plan-prepared-not-executed', sourceCommit: '7b2efa5cea38e4d4d97dd0e63b28b9148623da59',
  parentExplicitWindowReleaseRequired: true, heavyWindowReleased: false, cargoExecuted: false, browserExecuted: false,
  compilerExecuted: false, externalHostingAllowed: false, sourceSha256,
  dependencyAudit: {snapshotRegistryPackages: 11, cosmeticRegistryPackages: 0, selectedPins: pins,
    priorExactSourceAuditSha256: hash('semantic-runtime-catalog/build-plan/dependency-source-audit.json'),
    rootLockSha256: sha(sourceLock), snapshotLockAcceptedByCargo: false, cosmeticLockAcceptedByCargo: false},
  cosmeticManifest: {method: 'Exact existing std-only manifest with only lib path redirected to unchanged ../rust/src/lib.rs; all new manifest/lock/output files stay in build-plan',
    original: 'cosmetic-purity-overlay/rust/Cargo.toml', owned: 'cosmetic-purity-overlay/build-plan/Cargo.toml', originalSourceUntouched: true},
  rustEnvironment: base.rustEnvironment, removeInheritedEnvironment: base.removeInheritedEnvironment,
  launchGate: base.launchGate, ownedResourceGuard: base.ownedResourceGuard,
  guard: {file: 'semantic-runtime-catalog/run-consumer-window.py', sha256: sourceSha256['semantic-runtime-catalog/run-consumer-window.py'],
    reuse: 'Import only the already exercised Windows counters/job/member-identity guard; replace its plan with this reviewed plan before invoking run_stage'},
  preparedTests: {snapshot: snapshotTests, cosmetic: cosmeticTests},
  estimatedBounds: {snapshotSeconds: '20-40 with fresh isolated dependency target, unverified estimate', cosmeticSeconds: '1-10, unverified estimate',
    expectedPeakPrivateBytes: 'Below 400 MiB based on measured preceding serde/syn consumers; not a guarantee', hardJobCapBytes: 1073741824, perStageTimeoutSeconds: 180},
  commands: [command('input-snapshot-genuine-rust-consumer', 'integration-overlay/rust-snapshot-consumer/Cargo.toml', 'integration-overlay/build-plan/target', ['--test', 'contract'], 19,
    'Real standalone Rust parser, ownership/RAII release and notice state machine against synthetic fixtures/fake transport; no rust-contracts API or original exports', 'integration-overlay/build-plan/execution'),
    command('cosmetic-helper-genuine-rust-consumer', 'cosmetic-purity-overlay/build-plan/Cargo.toml', 'cosmetic-purity-overlay/build-plan/target', ['--lib'], 5,
      'Real std-only Rust helper computations and prepared synthetic golden/bounds/interleave tests; no native helper/caller or full-game RNG execution', 'cosmetic-purity-overlay/build-plan/execution')],
  staticReview: {concreteCompileErrorFound: false,
    snapshotAssertionGaps: ['FakeTransport discards requested copy length', 'Successful high-bit addresses and exact heap-end acceptance not asserted',
      'No real/current-heap growth adapter test', 'Exact collection/depth-limit acceptance not asserted'],
    cosmeticAssertionGaps: ['Follower pass outputs not asserted', 'Exact npc_key golden values not asserted', 'Third empty-ID weather golden omitted',
      'No complete native/Rust fixture-set execution parity']},
  remainingIntegrationGates: ['Original C++ serializer, four original-module exports and real host copy/heap growth', 'Asyncify/nested wait scheduling and native binding precedence',
    'Actual native helper and real caller admission/order/weighted/animated drawing', 'Live original-state/RNG purity and browser/full-game flows'],
  sourceOrCatalogModified: false, rustContractsConsumption: false, originalProducerConnected: false, runtimeConnected: false, wholeGameSemanticMigrationComplete: false};
writeFileSync(path.join(HERE, 'next-consumer-build-plan.json'), JSON.stringify(plan, null, 2) + '\n');
writeFileSync(path.join(cosmeticDirectory, 'CONSUMER-PLAN-REFERENCE.json'), JSON.stringify({schemaVersion: 1, plan: '../../integration-overlay/build-plan/next-consumer-build-plan.json',
  note: 'Workspace-relative plan integration-overlay/build-plan/next-consumer-build-plan.json owns the sequential source-only proposal; no compiler started',
  planSha256: sha(JSON.stringify(plan, null, 2) + '\n'), originalSourceUntouched: true}, null, 2) + '\n');
console.log(JSON.stringify({status: plan.status, snapshotTestsPrepared: 19, cosmeticTestsPrepared: 5, cachedSnapshotRegistryPackages: pins.length, compilerExecuted: false}));
