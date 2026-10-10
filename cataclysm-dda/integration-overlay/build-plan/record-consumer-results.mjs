// Verify completed guarded-stage records and publish narrow consumer proof.
// Read-only inputs; writes only the two owned build-plan result files.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const text = file => readFileSync(path.join(ROOT, file), 'utf8');
const document = file => JSON.parse(text(file));
const hash = file => createHash('sha256').update(readFileSync(path.join(ROOT, file))).digest('hex');
const planFile = 'integration-overlay/build-plan/next-consumer-build-plan.json';
const terminalFile = 'integration-overlay/build-plan/next-consumer-terminal.json';
const plan = document(planFile), terminal = document(terminalFile);
assert.equal(terminal.status, 'passed'); assert.equal(terminal.stagesPassed, 2);
assert.equal(terminal.actualOfflineLockedAccepted, true);
assert.equal(terminal.planSha256, hash(planFile));
assert.deepEqual(terminal.sourceSha256After, plan.sourceSha256);
for (const [file, expected] of Object.entries(plan.sourceSha256)) assert.equal(hash(file), expected, file);

function verify(command, prefix) {
  const stageFile = command.evidenceDirectory + '/' + command.stage + '.json';
  const stage = document(stageFile);
  assert.equal(stage.passed, true); assert.equal(stage.exitCode, 0);
  assert.deepEqual(stage.remainingOwnedPidsBeforeJobClose, []);
  assert.ok(stage.rootIdentity.pid > 0 && stage.rootIdentity.creationFiletime > 0);
  assert.ok(stage.freshGate.physicalFreeBytes >= 4 * 2 ** 30);
  assert.ok(stage.freshGate.exactCommitHeadroomBytes >= 6 * 2 ** 30);
  assert.ok(stage.jobPeakPrivateBytes <= 2 ** 30 && stage.samples.length > 0);
  for (const sample of stage.samples) {
    assert.ok(sample.physicalFreeBytes >= 2 * 2 ** 30 && sample.exactCommitHeadroomBytes >= 2 * 2 ** 30);
    assert.ok(sample.ownedPrivateBytes <= 2 ** 30 && sample.ownedWorkingSetBytes <= 2 ** 30);
  }
  const stdout = command.evidenceDirectory + '/' + command.stage + '.stdout.log';
  const stderr = command.evidenceDirectory + '/' + command.stage + '.stderr.log';
  assert.ok(text(stdout).includes(`test result: ok. ${command.expectedTests} passed; 0 failed;`));
  const targetIndex = command.argv.indexOf('--target-dir');
  const executableDirectory = path.join(command.argv[targetIndex + 1], 'x86_64-pc-windows-gnu/debug/deps');
  const files = readdirSync(executableDirectory).filter(file => file.startsWith(prefix + '-') && file.endsWith('.exe'));
  assert.equal(files.length, 1);
  const executable = path.relative(ROOT, path.join(executableDirectory, files[0])).replaceAll('\\', '/');
  return {status: 'passed-native-rust-tests', nativeTarget: 'x86_64-pc-windows-gnu', testsPassed: command.expectedTests,
    offlineLockedAccepted: true, argv: stage.argv, cwd: stage.cwd,
    scope: command.expectedScope, durationSeconds: stage.durationSeconds,
    jobPeakPrivateBytes: stage.jobPeakPrivateBytes,
    sampledPeakWorkingSetBytes: Math.max(...stage.samples.map(item => item.ownedWorkingSetBytes)),
    freshGate: stage.freshGate, minimumSampledPhysicalFreeBytes: Math.min(...stage.samples.map(item => item.physicalFreeBytes)),
    minimumSampledExactCommitHeadroomBytes: Math.min(...stage.samples.map(item => item.exactCommitHeadroomBytes)),
    ownedJobsClosed: true, remainingOwnedProcesses: 0,
    evidence: stageFile, evidenceSha256: hash(stageFile), stdout, stdoutSha256: hash(stdout), stderr, stderrSha256: hash(stderr),
    executable, executableSha256: hash(executable)};
}
const shared = {schemaVersion: 1, sourceCommit: plan.sourceCommit, sourceFixtureLockFingerprintsUnchanged: true,
  sourceSha256: plan.sourceSha256, plan: planFile, planSha256: hash(planFile), terminal: terminalFile, terminalSha256: hash(terminalFile),
  actualRustTestsExecuted: true, heavySlotReleased: true, rustContractsConsumption: false,
  originalProducerConnected: false, runtimeConnected: false, wholeGameSemanticMigrationComplete: false,
  browserExecuted: false, SDKChanged: false, originalSourceModified: false, publicCatalogsModified: false};
const snapshot = {...shared, ...verify(plan.commands[0], 'contract'), registryPackages: 11,
  exercised: ['Strict schema/UTF-8/source/build and lossless u64 decoding', 'Owned ordered binding metadata and empty origins',
    'Synthetic transport pin release on success/error', 'Notice ordering, nested parent epochs, stale/conflicting notices and sticky exhaustion',
    'Command authorization remains denied'],
  remainingAssertionGaps: plan.staticReview.snapshotAssertionGaps,
  remainingIntegrationGates: ['All JSON fixtures and FakeTransport are synthetic', 'Original C++ serializer and four live exports',
    'Actual host copy/current heap growth and exact pointer/length boundary tests', 'Asyncify/native binding precedence and real game state/RNG/browser behavior']};
const cosmetic = {...shared, ...verify(plan.commands[1], 'cdda_cosmetic_presentation_source'), registryPackages: 0,
  actualSourcePath: 'cosmetic-purity-overlay/rust/src/lib.rs', manifestRedirectOnly: true,
  exercised: ['Prepared weather hash/static weighted golden fixtures', 'Zero/single/overflow weighted-list behavior',
    'Signed one-in predicate/equal-color branch', 'Bounded-word rejection/ranges', 'Repeat/interleave without retained random state'],
  remainingAssertionGaps: plan.staticReview.cosmeticAssertionGaps,
  remainingIntegrationGates: ['Actual C++ helper/complete fixture-set parity', 'Real admitted NPC loop/order and native weighted/animated drawing',
    'Original source overlay integration', 'Authoritative-state/RNG purity and real browser/game flows']};
writeFileSync(path.join(HERE, 'consumer-verification.json'), JSON.stringify(snapshot, null, 2) + '\n');
writeFileSync(path.join(ROOT, 'cosmetic-purity-overlay/build-plan/consumer-verification.json'), JSON.stringify(cosmetic, null, 2) + '\n');
console.log(JSON.stringify({status: 'passed', snapshotTestsPassed: snapshot.testsPassed, cosmeticTestsPassed: cosmetic.testsPassed,
  sourceFixtureLockFingerprintsUnchanged: true, ownedJobsClosed: true, originalProducerConnected: false}));
