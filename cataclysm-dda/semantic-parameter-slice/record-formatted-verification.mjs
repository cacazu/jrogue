// Record this one completed reserved window without changing historical proofs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.dirname(own);
const relative = file => path.relative(own, file).replaceAll('\\', '/');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const record = file => { const bytes = fs.readFileSync(file); return { path: relative(file), bytes: bytes.length, sha256: sha(bytes) }; };
const planFile = path.join(own, 'format-next/verification-plan.json');
const runnerFile = path.join(own, 'format-next/run-verification.py');
const oldProofFile = path.join(own, 'RUST-VERIFICATION.json');
const previewProofFile = path.join(own, 'FORMAT-PREVIEW-VERIFICATION.json');
assert.equal(record(planFile).sha256, '2e954759294b91d6dd9d7ccedcd8622bd69a9b1c825da6d32fde688d7c53954d');
assert.equal(record(runnerFile).sha256, '1fe1a94cb0e740dfa8040335facd3bf1706c16adc04472667dd96de45ebc55ac');
assert.equal(record(oldProofFile).sha256, '88b88cd31637900c2dd38e86eb2268d72cbeb84deb742239e74b9db64d5e6c53');
assert.equal(record(previewProofFile).sha256, 'c087d1901201203a77062bdef53e51f2f6fae5812b7d12d743b2f4127750eb1f');
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const old = JSON.parse(fs.readFileSync(oldProofFile, 'utf8'));
const execution = path.join(own, 'format-next/verification-execution/formatted-tests-1');
const terminalFile = path.join(execution, 'terminal.json');
const terminal = JSON.parse(fs.readFileSync(terminalFile, 'utf8'));
assert.equal(terminal.status, 'passed-three-formatted-source-checks');
assert.equal(terminal.inputFingerprintsUnchanged, true);
assert.equal(terminal.originalProducerConnected, false);
assert.equal(terminal.runtimeConnected, false);
assert.equal(terminal.browserExecuted, false);
assert.equal(terminal.planSha256, record(planFile).sha256);
const before = fs.readFileSync(path.join(execution, 'input-fingerprints-before.json'));
const after = fs.readFileSync(path.join(execution, 'input-fingerprints-after.json'));
assert.deepEqual(before, after);
assert.equal(plan.inputs.length, 708);
for (const pin of plan.inputs) {
  const bytes = fs.readFileSync(pin.path);
  assert.equal(bytes.length, pin.bytes, pin.path);
  assert.equal(sha(bytes), pin.sha256, pin.path);
}
const stages = [];
const artifacts = [terminalFile, path.join(execution, 'input-fingerprints-before.json'), path.join(execution, 'input-fingerprints-after.json')];
for (const stage of ['parameter-format-check', 'parameter-seven-tests-formatted', 'parameter-clippy-check']) {
  const directory = path.join(execution, stage);
  const coreFile = path.join(directory, stage + '.json');
  const cleanupFile = path.join(directory, stage + '.outer-cleanup.json');
  const stdoutFile = path.join(directory, stage + '.stdout.log');
  const stderrFile = path.join(directory, stage + '.stderr.log');
  const raw = fs.readFileSync(coreFile, 'utf8');
  const core = JSON.parse(raw);
  const cleanup = JSON.parse(fs.readFileSync(cleanupFile, 'utf8'));
  assert.equal(core.passed, true);
  assert.equal(core.exitCode, 0);
  assert.deepEqual(core.remainingOwnedPidsBeforeJobClose, []);
  assert.equal(cleanup.passed, true);
  assert.deepEqual(cleanup.remainingOwnedJobHandles, []);
  assert.deepEqual(cleanup.errors, []);
  const unclosed = cleanup.rootsCreated.filter(root => !cleanup.outerActions.some(action => action.processHandle === root.processHandle && action.action === 'close-owned-process-handle'));
  assert.deepEqual(unclosed, []);
  // Preserve 64-bit FILETIME as an exact decimal string, without JS rounding.
  const match = raw.match(/"rootIdentity"\s*:\s*\{\s*"pid"\s*:\s*(\d+),\s*"creationFiletime"\s*:\s*(\d+)/);
  assert.ok(match);
  const filetime = BigInt(match[2]);
  const created = new Date(Number(filetime / 10000n - 11644473600000n)).toISOString();
  const samples = core.samples;
  stages.push({
    stage, status: 'passed', argv: core.argv, cwd: core.cwd, exitCode: core.exitCode,
    timestamps: { rootCreationFiletime100ns: match[2], rootCreatedUtc: created,
      cleanupArtifactWriteUtcObservedAfterCleanup: fs.statSync(cleanupFile).mtime.toISOString() },
    resources: { durationSeconds: core.durationSeconds, freshGate: core.freshGate,
      minimumPhysicalFreeBytes: Math.min(...samples.map(sample => sample.physicalFreeBytes)),
      minimumExactCommitHeadroomBytes: Math.min(...samples.map(sample => sample.exactCommitHeadroomBytes)),
      exactOwnedJobPeakPrivateBytes: core.jobPeakPrivateBytes,
      sampledPeakPrivateBytes: Math.max(...samples.map(sample => sample.ownedPrivateBytes)),
      sampledPeakWorkingSetBytes: Math.max(...samples.map(sample => sample.ownedWorkingSetBytes)),
      lastSample: samples.at(-1) },
    cleanup: { rootPid: Number(match[1]), jobsCreated: cleanup.jobsCreated, rootsCreated: cleanup.rootsCreated,
      explicitProcessHandleCloseActions: cleanup.outerActions,
      remainingOwnedPidsBeforeJobClose: core.remainingOwnedPidsBeforeJobClose,
      remainingOwnedJobHandles: cleanup.remainingOwnedJobHandles,
      remainingOwnedProcessHandles: unclosed.map(root => root.processHandle),
      processHandleArrayProvenance: 'Derived by exact created-handle minus successful explicit close-action matching; raw outer schema has no remaining-process-handle field',
      errors: cleanup.errors, passed: true },
    stdout: record(stdoutFile), stderr: record(stderrFile)
  });
  artifacts.push(coreFile, cleanupFile, stdoutFile, stderrFile);
}
const seven = terminal.stages.find(stage => stage.stage === 'parameter-seven-tests-formatted');
assert.equal(seven.testCount, 7);
assert.deepEqual([...seven.testsPassed].sort(), [...old.testsPassed].sort());
const archived = [];
function archive(file, targetRelative, expected) {
  const bytes = fs.readFileSync(file);
  const sourceRecord = record(file);
  if (expected) { assert.equal(sourceRecord.bytes, expected.bytes); assert.equal(sourceRecord.sha256, expected.sha256); }
  const target = path.join(execution, 'accepted-inputs', targetRelative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes);
  else fs.writeFileSync(target, bytes, { flag: 'wx' });
  archived.push({ ...record(target), originalRelative: path.relative(workspace, file).replaceAll('\\', '/') });
}
for (const input of old.acceptedSourceArchives) {
  const file = path.join(workspace, input.originalRelative);
  const pin = plan.inputs.find(pin => path.resolve(pin.path) === path.resolve(file));
  assert.ok(pin);
  archive(file, input.originalRelative, pin);
}
for (const file of [planFile, runnerFile, path.join(own, 'format-next/rustfmt.toml'), oldProofFile, previewProofFile,
  path.join(own, 'format-next/execution/preview-1/APPLY-REVIEWED.json'), path.join(own, 'RUST-VERIFICATION.md')]) {
  archive(file, path.relative(workspace, file));
}
const report = {
  schemaVersion: 1, status: 'PASSED_FORMAT_CHECK_SEVEN_GENUINE_CATALOG_TESTS_AND_CLIPPY_FORMATTED_OWNED_SOURCES',
  sourceCommit: plan.sourceCommit, attempt: 'formatted-tests-1',
  planSha256: record(planFile).sha256, runnerSha256: record(runnerFile).sha256, ownerSha256: terminal.ownerSha256,
  scope: terminal.scope, testsPassed: seven.testsPassed, testCount: 7, failedTests: 0,
  formatCheckPassed: true, clippyWarningsDeniedPassed: true, compilerExecuted: true,
  genuineRustCatalogConsumerExecuted: true, originalProducerConnected: false, runtimeConnected: false,
  browserExecuted: false, completeTranslationCoverage: false,
  terminalWriteUtcObservedAfterCleanup: fs.statSync(terminalFile).mtime.toISOString(),
  stages, fingerprints: { protectedTotal: plan.inputs.length, cachedArchives: 13, cachedSourceFiles: 595,
    cachedSourceBytes: 6110443, cachedExtractionMarkers: 13, allBeforeAfterUnchanged: true,
    beforeSha256: sha(before), afterSha256: sha(after), ordinaryCargoMetadataWritesPossible: true },
  currentFormattedSources: plan.approvedFormattedSources,
  historicalProofsPreservedUnchanged: [record(oldProofFile), record(previewProofFile)],
  acceptedSourceArchives: archived, stageArtifacts: artifacts.map(record),
  remainingIntegration: [
    'actual loaded-definition identity/override/lifecycle registration and source producer annotations',
    'original C++ producer-to-Rust typed Term FFI and native output equivalence',
    'rich/keybinding/recursive-name programs for9 retained exclusions',
    'runtime locale/merge and browser consumption',
    'full game deterministic save/RNG/render/input and local browser flows'
  ]
};
const outputFile = path.join(own, 'RUST-FORMATTED-VERIFICATION.json');
const output = Buffer.from(JSON.stringify(report, null, 2) + '\n');
if (fs.existsSync(outputFile)) assert.deepEqual(fs.readFileSync(outputFile), output);
else fs.writeFileSync(outputFile, output, { flag: 'wx' });
console.log(JSON.stringify({ proof: record(outputFile), acceptedCopies: archived.length,
  protectedCount: plan.inputs.length, stages: stages.map(stage => ({ stage: stage.stage, timestamps: stage.timestamps, resources: stage.resources, cleanup: stage.cleanup })) }));
