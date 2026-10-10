// Hash/archive completed evidence only; never launches a compiler or edits source.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const own = path.dirname(here);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pin = file => { const bytes = fs.readFileSync(file); return { path: path.relative(own, file).replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) }; };
const require = (condition, message) => { if (!condition) throw Error(message); };
const acceptedHash = '091048a51f400baae8a3190673c937b5bf7bdeafe0b0a90d88094df1aafe3c57';
const planFile = path.join(own, 'build-plan/parser-build-plan.json');
const planBytes = fs.readFileSync(planFile);
require(sha(planBytes) === acceptedHash, 'actual formatted accepted plan changed');
const plan = JSON.parse(planBytes);
for (const record of plan.inputs) {
  const actual = pin(record.path);
  require(actual.bytes === record.bytes && actual.sha256 === record.sha256, 'completed input no longer matches accepted bytes');
}
const stageSpecs = [['format-check-1', 'rust-parser-format-check'],
  ['native-tests-formatted-1', 'rust-parser-native-tests'], ['clippy-formatted-1', 'rust-parser-clippy-check']];
const stages = stageSpecs.map(([attempt, stage]) => {
  const directory = path.join(own, 'build-plan/execution', attempt);
  const resultFile = path.join(directory, stage + '.json');
  const resultRaw = fs.readFileSync(resultFile, 'utf8');
  const result = JSON.parse(resultRaw);
  const terminalFile = path.join(directory, 'terminal.json');
  const terminal = JSON.parse(fs.readFileSync(terminalFile));
  const cleanup = JSON.parse(fs.readFileSync(path.join(directory, stage + '.outer-cleanup.json')));
  require(result.passed && result.exitCode === 0 && terminal.status === 'passed' &&
    terminal.planSha256 === acceptedHash && terminal.inputFingerprintsUnchanged === true &&
    result.remainingOwnedPidsBeforeJobClose.length === 0 && cleanup.passed &&
    cleanup.errors.length === 0 && cleanup.remainingOwnedJobHandles.length === 0 &&
    cleanup.outerActions.some(action => action.action === 'close-owned-process-handle'), 'completed stage/cleanup did not pass');
  require(!terminal.originalCppCompiled && !terminal.liveNativeRustConnected && !terminal.browserExecuted, 'scope drift');
  if (stage === 'rust-parser-native-tests') require(terminal.testCount === 5 &&
    JSON.stringify([...terminal.testsPassed].sort()) === JSON.stringify([...plan.expectedTests].sort()), 'exact five tests required');
  const identityRaw = resultRaw.match(/"rootIdentity":\s*\{[^}]+\}/)?.[0];
  const filetime = identityRaw?.match(/"creationFiletime":\s*(\d+)/)?.[1];
  require(filetime, 'exact owned-root FILETIME missing');
  const createdUtc = new Date(Number((BigInt(filetime) - 116444736000000000n) / 10000n)).toISOString();
  const names = ['terminal.json', stage + '.json', stage + '.outer-cleanup.json',
    stage + '.stdout.log', stage + '.stderr.log', 'input-fingerprints-before.json', 'input-fingerprints-after.json'];
  return { stage, attempt, passed: true, root_created_utc_from_exact_filetime: createdUtc,
    root_creation_filetime_100ns_decimal: filetime,
    terminal_written_at_utc_as_observed: fs.statSync(terminalFile).mtime.toISOString(),
    duration_seconds: result.durationSeconds, job_peak_private_bytes: result.jobPeakPrivateBytes,
    fresh_physical_bytes: result.freshGate.physicalFreeBytes,
    fresh_exact_commit_headroom_bytes: result.freshGate.exactCommitHeadroomBytes,
    minimum_sampled_physical_bytes: Math.min(...result.samples.map(sample => sample.physicalFreeBytes)),
    minimum_sampled_exact_commit_headroom_bytes: Math.min(...result.samples.map(sample => sample.exactCommitHeadroomBytes)),
    peak_sampled_owned_working_set_bytes: Math.max(...result.samples.map(sample => sample.ownedWorkingSetBytes)),
    input_fingerprints_unchanged_during_stage: true, remaining_owned_pids: 0,
    remaining_owned_job_handles: 0, owned_cleanup_passed: true,
    evidence: names.map(name => pin(path.join(directory, name))) };
});
const archive = path.join(own, 'build-plan/execution/native-tests-formatted-1/accepted-inputs');
fs.mkdirSync(archive, { recursive: false });
fs.writeFileSync(path.join(archive, 'parser-build-plan.json'), planBytes, { flag: 'wx' });
for (const record of plan.inputs) {
  const destination = path.resolve(archive, record.relative);
  require(destination.startsWith(archive + path.sep), 'archive relative path escaped');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const bytes = fs.readFileSync(record.path);
  require(sha(bytes) === record.sha256, 'archive input changed');
  fs.writeFileSync(destination, bytes, { flag: 'wx' });
}
const proof = { schema_version: 1, status: 'ACTUAL_FORMATTED_ISOLATED_RUST_FMTCHECK_FIVE_TESTS_CLIPPY_PASSED',
  upstream_commit: plan.sourceCommit, reviewed_plan_sha256: acceptedHash,
  runner_sha256: plan.inputs.find(record => record.relative === 'run-parser-window.py').sha256,
  guard_sha256: plan.guard.sha256, accepted_input_archive: path.relative(own, archive).replaceAll('\\', '/'),
  accepted_input_file_count_excluding_plan: plan.inputs.length,
  current_formatted_sources: ['rust/src/lib.rs', 'rust/src/tests.rs'].map(relative => pin(path.join(own, relative))),
  preformat_proof_preserved: pin(path.join(own, 'RUST-VERIFICATION.json')),
  format_preview_plan_sha256: plan.reviewedFormatting.previewPlanSha256,
  preview_diff: pin(plan.reviewedFormatting.diff), parser_test_count: 5, parser_test_names: plan.expectedTests,
  synthetic_fixtures: true, standard_library_only: true, registry_and_path_dependencies: 0,
  cargo_offline_locked_for_tests_clippy: true, cargo_fmt_offline_environment: true,
  prepared_lock_accepted_unchanged: true, cargo_jobs: 1, rust_test_threads: 1,
  launch_gate: plan.launchGate, resource_guard: plan.ownedResourceGuard, stages,
  format_check_passed: true, rust_compiled: true, rust_tests_executed: true, clippy_passed: true,
  original_cpp_compiled: false, native_rust_connected: false, wasm_target_executed: false,
  browser_tested: false, rust_input_ownership_accepted: false, full_canvas_verified: false,
  whole_game_render_purity_verified: false, full_semantic_coverage_verified: false,
  all_inputs_unchanged_during_runs: true, no_source_changes_after_formatted_verification: true,
  timestamp_note: 'Root creation uses exact original FILETIME extracted as decimal BigInt; terminal timestamp is observed file mtime after owned cleanup. Raw records are hashed, never rewritten.' };
const proofFile = path.join(own, 'RUST-FORMATTED-VERIFICATION.json');
fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ proof: pin(proofFile), archivedInputs: plan.inputs.length,
  stages: stages.map(({ evidence, ...summary }) => summary) }, null, 2));
