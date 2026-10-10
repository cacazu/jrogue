import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const directory = path.join(root, 'rust-policy/formatted-quality');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stages = ['v5-policy-format-check', 'v5-policy-five-native-tests',
  'v5-policy-package-clippy', 'v5-policy-wasm-release-build'];
function require(condition, message) { if (!condition) throw new Error(message); }
function checkedPin(pin) {
  const bytes = fs.readFileSync(pin.path);
  require(bytes.length === pin.bytes && hash(bytes) === pin.sha256, 'Accepted evidence/artifact pin changed: ' + pin.path);
  return bytes;
}
// Root supplies the reviewed terminal digest. Hash the proof and artifact
// before any WASM compilation or instantiation; never accept an arbitrary ABI.
export function readAcceptedPolicy(proofFilename, proofSha256) {
  const expected = path.join(directory, 'execution/v5-policy-formatted-initial/terminal.json');
  require(path.resolve(proofFilename) === expected && /^[0-9a-f]{64}$/.test(proofSha256), 'Exact reviewed terminal and digest required.');
  const proofBytes = fs.readFileSync(expected);
  require(hash(proofBytes) === proofSha256, 'Reviewed policy terminal digest differs.');
  const proof = JSON.parse(proofBytes);
  require(proof.status === 'four-v5-policy-checks-passed' &&
    ['formatCheckPassed', 'fiveNativeTestsPassed', 'ClippyPassed', 'WasmBuildPassed',
      'allProtectedPinnedBytesUnchanged', 'allOwnedJobsAndExactRootHandlesClosed'].every(key => proof[key] === true),
  'All four checks, immutable inputs and exact owned closure must pass.');
  require(proof.planSha256 === 'edb9d8c006d67f839bbe888f7e1ccb5d0b787a919af66409624cd884a3af18a1' &&
    proof.runnerSha256 === '6a8a00b1fc20981c4ba6440c8be700aab8db3b49c69c9d9e3a1d182c661e07b9', 'Exact reviewed formatted owner required.');
  require(proof.stages.length === 4 && proof.stages.every((stage, index) => stage.stage === stages[index] &&
    stage.status === 'passed' && stage.decision === 'launch'), 'Four exact stage verdicts required.');
  require(proof.stages[1].reports.length === 5 && proof.stages[1].reports.every(row => row.status === 'ok'), 'Five native test reports required.');
  require(proof.ownedCleanupRecords.length === 4 && proof.ownedCleanupRecords.every((row, index) =>
    row.stage === stages[index] && row.passed === true && row.remainingOwnedJobHandles.length === 0 && row.rootsCreated.length === 1),
  'Four exact owned cleanup records required.');
  proof.ownedCleanupRecords.forEach(row => checkedPin(row.evidence));
  const expectedWasm = path.join(directory, 'owned-target/wasm32-unknown-unknown/release/cdda_v5_platform_policy.wasm');
  require(proof.wasmArtifact.path === expectedWasm && proof.wasmArtifact.bytes > 8 && proof.wasmArtifact.bytes < 1048576,
    'Exact bounded policy build output required.');
  const bytes = checkedPin(proof.wasmArtifact);
  return { bytes, artifact: proof.wasmArtifact, proofPin: { file: expected, bytes: proofBytes.length, sha256: proofSha256 } };
}
