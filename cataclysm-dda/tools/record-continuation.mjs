// Record exact reviewed evidence without treating source preparations as runs.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function readEvidence(file, expected) {
  const raw = fs.readFileSync(path.join(root, file));
  const sha256 = createHash('sha256').update(raw).digest('hex');
  if (expected !== undefined && sha256 !== expected) throw new Error('Reviewed evidence changed: ' + file);
  return { raw, evidence: { file, bytes: raw.length, sha256 } };
}
function pin(file, expected) { return readEvidence(file, expected).evidence; }
function require(condition, message) { if (!condition) throw new Error(message); }
// Preserve native FILETIME lexical digits before JSON.parse can round a Number.
// Metadata-map timestamps are never compared or republished by this recorder.
function exactJson(raw) {
  return JSON.parse(raw.toString('utf8').replace(/("[^"\\]*filetime[^"\\]*"\s*:\s*)(\d+)(?=\s*[,}])/gi, '$1"$2"'));
}
function evidenceJson(file, expected) {
  const record = readEvidence(file, expected);
  return { evidence: record.evidence, value: exactJson(record.raw) };
}
function relativeOwned(file) {
  const relative = path.relative(root, path.resolve(file));
  require(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'Evidence outside owned workspace');
  return relative.split(path.sep).join('/');
}
function recordedPin(record) {
  const current = evidenceJson(relativeOwned(record.path), record.sha256);
  require(current.evidence.bytes === record.bytes, 'Pinned evidence size changed');
  return current;
}
const quality = pin('input-context-live-slice/rust-build-plan/formatted-quality/QUALITY-VERIFICATION.json', '32dbd4e36c6eaf3b490b9bdb7af9990dedddf4a2360e3d447f62608899a51cf6');
const identity = pin('input-context-live-slice/rust-build-plan/formatted-quality/EXACT-IDENTITY-CORRECTION.json', '415e70ed214c3868392f7629dd8a1a7d7ffe5d1cc601c18aa41b8551cdfc0dbd');
const functionalDeadline = pin('input-context-live-slice/browser-rust-adapter/wasm-build/APPROVAL-DEADLINE-BLOCKER.json', 'f11dc17600371cd6d7894a1f30cf4f70b68e3a02e0441ad332214a23120edd23');
const functionalAbsence = pin('input-context-live-slice/browser-rust-adapter/wasm-build/TIMED-ABSENCE-CORRECTION.json', '7d630e79c731aad0fea86687cbde2d1ac8550ea968b35a35548816c1028ef6ea');
const qualityDeadline = pin('input-context-live-slice/rust-build-plan/formatted-quality/wasm-no-run-continuation/APPROVAL-DEADLINE-BLOCKER.json', '8cb2056509995dc2edb341ab3a826b1ece139f6936733e7e06d89b205ea7ab2f');
const helpEvidence = pin('semantic-display-live-slice/CURRENT-EVIDENCE.json', 'b0799d73f6ecde88153f1078be4850005c810f74ca7b7850b7f6273b7f6828ee');
const historicalBrowser = pin('browser-qa/resume/no-fit-handoff-2026-10-03T02-25-10-134Z.json', 'f92314ebd3b83eb94b8749ee32c2361eebe62c60baeb4b55dc990d7985976474');
const browser = pin('browser-qa/resume/no-fit-handoff-2026-10-03T03-07-19-323Z.json', '827584ed79b8399b6fd0412a2e6f43568a5e53b0b2e051cb07141c680ab67d6b');
require(browser.bytes === 5600, 'Exact new browser snapshot size required');
const sourcePlan = pin('full-engine-overlay-plan/v2/FULL-INTEGRATION-PLAN.json', '208c9b5dffb6822752dc155e80fb7ad187fd9735fccb80ab9eb0264655546b03');
const parity = evidenceJson('native-cosmetic-parity/ACTUAL-VERIFICATION.json', 'c2a267346c0d2b49c6ce5ddd86c91b0afbba8ed7506b1531601dd9bfd205f4b1');
require(parity.evidence.bytes === 21603 && parity.value.status === 'actual-cpp-rust-parity-passed-archived-evidence-verified' &&
  parity.value.checks === 23 && parity.value.dataRecords === 22 && parity.value.distinctBoundedRustUnitTests === 62 &&
  parity.value.newDistinctRustUnitTests === 0 && parity.value.completeStreamsByteExact,
  'Exact reviewed parity scope required');
for (const key of ['originalCallersExecuted', 'originalRngProved', 'saveResumeProved', 'browserExecuted', 'wholeGameAccepted'])
  require(parity.value[key] === false, 'Parity cannot close original-caller or whole-game gates');
const r3Owner = pin('full-engine-overlay-plan/v2/run-owner-window-r3.py', '2af7f79539fd6332564add22770d04299888edf1cc60d5396d92c46853fec5ba');
const r3Packet = evidenceJson('full-engine-overlay-plan/v2/OWNER-PINS-r3.json', '4b06db92f6712fb090b0e45ed1458cb3ed3449dfc4019899dd5625e531aa7568');
const serialDriver = pin('full-engine-overlay-plan/v2/run-serial-compiles-r3-r2.py', 'eb1c3ea187cac0c71de32f5649577b0fefa2956bbf38293d3ce0b72dd96ac75a');
const serialPlan = pin('full-engine-overlay-plan/v2/SERIAL-COMPILE-PLAN-r3-r2.json', '34eccdc1e1199c5eb6837d432ae6ceb6de37b0991fc269db54425acf0675f5c2');
const r2Failure = pin('full-engine-overlay-plan/v2/FAILED-SOURCE-OWNER-index000-FACTS.json', '1d162aaa13c0d239f92ee78f4f7aff08018461530aa521827555e7df7bed12fc');
const treeCounts = Object.fromEntries(Object.entries(r3Packet.value.acceptedTreeBaselines).map(([name, entries]) => [name, Object.keys(entries).length]));
require(r3Packet.value.pins.length === 11673 && treeCounts.cache === 2824 && treeCounts.ports === 8335 &&
  treeCounts.coherentSources === 986 && treeCounts.generated === 2, 'Reviewed r3 pin/membership counts changed');
const cacheRoot = path.join(root, 'engine-build/cache');
const selectedCachePins = r3Packet.value.pins.filter(record => {
  const relative = path.relative(cacheRoot, record.path);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
});
require(selectedCachePins.length === 10 && r3Packet.value.fullScopedPortFileCount === 7459 &&
  r3Packet.value.fullScopedPortBytes === 284871127, 'Selected cache versus full ports coverage changed');

function currentCompileSnapshot() {
  const started = new Date().toISOString();
  const directory = 'full-engine-overlay-plan/v2/candidate-e3ff38d8bc59cf07ddbb48ce/evidence';
  const files = fs.readdirSync(path.join(root, directory)).filter(name => /^compile-\d{3}-success\.json$/.test(name)).sort();
  const enumerated = new Date().toISOString();
  const rows = files.map((name, orderedIndex) => {
    const receipt = evidenceJson(directory + '/' + name);
    const value = receipt.value;
    require(value.index === orderedIndex && value.index < 235 && value.status === 'genuine-original-tuple-compile-passed' &&
      value.fullPlanSha256 === sourcePlan.sha256 && value.buildIdentity === r3Packet.value.buildIdentity && value.ownedCleanupPassed,
      'Only a contiguous genuine completed compile prefix may be recorded');
    const prefix = String(value.index).padStart(3, '0');
    const step = evidenceJson('full-engine-overlay-plan/v2/execution/v2-compile-r3-serial-initial/' + prefix + '.serial-step.json');
    require(step.value.status === 'genuine-original-tuple-compile-passed-and-closed' && step.value.index === value.index &&
      step.value.sourceOwnerExitCode === 0 && step.value.sourceOwnerHandleClosed &&
      step.value.receipt.sha256 === receipt.evidence.sha256 && step.value.receipt.bytes === receipt.evidence.bytes &&
      typeof step.value.sourceOwnerCreationFILETIMEDecimal === 'string' && /^\d+$/.test(step.value.sourceOwnerCreationFILETIMEDecimal),
      'Exact closed SDK source-owner receipt binding required');
    const guard = recordedPin(value.guardVerdict);
    const terminal = recordedPin(value.terminal);
    const cleanup = evidenceJson(relativeOwned(value.guardVerdict.path).replace(/\.json$/, '.outer-cleanup.json'));
    require(guard.value.passed && guard.value.exitCode === 0 && guard.value.remainingOwnedPidsBeforeJobClose.length === 0 &&
      cleanup.value.passed && cleanup.value.errors.length === 0 && cleanup.value.remainingOwnedJobHandles.length === 0,
      'Genuine native compile must have complete owned closure');
    require(typeof guard.value.rootIdentity.creationFiletime === 'string' && /^\d+$/.test(guard.value.rootIdentity.creationFiletime),
      'Native FILETIME digits must remain exact');
    return { index: value.index, source: value.command.source, status: value.status, receipt: receipt.evidence,
      serial_step: step.evidence, guard_verdict: guard.evidence, terminal: terminal.evidence, outer_cleanup: cleanup.evidence,
      artifact_pins_from_verified_receipt: value.artifactPins, actual_non_system_dependency_count: value.actualNonSystemDependencies.length,
      sdk_source_owner: { pid: step.value.sourceOwnerPID, creation_filetime_decimal: step.value.sourceOwnerCreationFILETIMEDecimal,
        exit_code: 0, exact_handle_closed: true }, native_guard_root: guard.value.rootIdentity,
      duration_seconds: guard.value.durationSeconds, job_peak_private_bytes: guard.value.jobPeakPrivateBytes,
      remaining_owned_pids: [], remaining_owned_job_handles: [], cleanup_errors: [] };
  });
  require(rows.length >= 3 && rows.length < 235, 'This recorder is for a running partial compile snapshot');
  return { recording_started_at: started, receipt_directory_enumerated_at: enumerated, recording_finished_at: new Date().toISOString(),
    status: 'partial-success-receipts-recorded-serial-session-reported-running', parent_owned_serial_session: 93261,
    running_status_source: 'Parent and source-owner live session report; recorder does not query or stop the process',
    confirmed_completed_compile_count: rows.length, confirmed_indices: rows.map(row => row.index),
    total_required_compile_count: 235, next_unconfirmed_index: rows.length, receipts: rows,
    all235_compiles_accepted: false, final_link_completed: false, runtime_executed: false, browser_accepted: false, whole_game_accepted: false };
}
const progressPath = path.join(root, 'progress.json');
const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
const browserOnly = process.argv.length === 3 && process.argv[2] === '--browser-only';
require(process.argv.length === 2 || browserOnly, 'Only default recording or browser-only amendment is supported');
const snapshotBeforeBrowserAmendment = browserOnly ? JSON.stringify(progress.continuation.full_engine.actual_r3_compile_snapshot) : null;
const compileSnapshot = browserOnly ? progress.continuation.full_engine.actual_r3_compile_snapshot : currentCompileSnapshot();
if (browserOnly) require(compileSnapshot.confirmed_completed_compile_count === 11 &&
  compileSnapshot.receipt_directory_enumerated_at === '2026-10-03T03:06:25.026Z', 'Preserve the accepted eleven-unit snapshot');
const previousBrowser = progress.continuation?.browser;
const browserHistory = previousBrowser?.evidence?.sha256 === historicalBrowser.sha256 ? previousBrowser :
  previousBrowser?.historical_previous_resource_snapshot;
progress.last_updated = new Date().toISOString();
progress.continuation = {
  status: 'implementation-in-progress-native-and-browser-acceptance-open',
  formatted_original_context: { quality, exact_identity_correction: identity,
    actual_stages: ['fmt', 'same-five-native-tests', 'clippy'], new_distinct_tests: 0,
    initial_wasm_no_run_launched: false, continuation: { source_clear: true, protected_files: 624,
      actual_wasm_compiler_launched: false, approval_deadline: qualityDeadline } },
  original_context_cpp_rust_transport: { source_clear: true, planned_cases: 9,
    actual_cpp_or_rust_wasm_launched: false, approval_deadline: functionalDeadline,
    original_absence_rows: 'untimed', separate_timed_filesystem_witness: functionalAbsence,
    command_authorization: 'Denied(UntrackedNativeReaders)',
    production_deferred_ready_proved: false, sdl_ime_proved: false, asyncify_proved: false,
    live_world_commands_proved: false },
  help_key_scope: { evidence: helpEvidence, actual_cpp_compile_stages: 6,
    actual_producer_assertions: 0, official_primary_bindings_retained: 620,
    key_scope_prepared_cases: 36, planned_twice_assertions: 72,
    actual_help_resource: 'data/core/help.json', inherited_binder_fix_required: false,
    rust_or_browser_acceptance: false },
  full_engine: { source_plan: sourcePlan, original_recompilations: 231, fresh_helpers: 4,
    baseline_objects_reused: 207, final_link_objects: 442,
    r3_source_preparation: { source_clear: true, owner: r3Owner, packet: r3Packet.evidence,
      byte_pins: 11673, metadata_member_counts: treeCounts, selected_cache_byte_pin_count: 10,
      blanket_cache_byte_coverage_claimed: false, full_scoped_ports_byte_pins: 7459, full_scoped_ports_bytes: 284871127,
      original_byte_pins_retained: 4220, serial_corrected_driver: serialDriver, serial_corrected_plan: serialPlan },
    actual_r3_compile_snapshot: compileSnapshot,
    historical_r2_index_zero: { evidence: r2Failure, actual_native_compiles: 0, index_zero_stopped_before_guard: true,
      compiler_launched: false, restricted_ports_members: 3798, scoped_ports_members: 8335,
      old_byte_pins_unchanged: 4220, separate_r3_packet_was_required: true },
    final_candidate_link_completed: false, full_engine_runtime_accepted: false,
    acl_or_security_settings_changed: false },
  cosmetic_parity: { source_structure_reviewed: true, prepared_checks: 23,
    expected_data_records: 22, original_rust_library_prefix_retained: true,
    actual_verification: parity.evidence, reviewer_artifact_clear: true, actual_cross_language_checks_passed: 23,
    new_distinct_rust_unit_tests: 0, complete_streams_byte_exact: true, newline_normalization_required: false,
    cpp_compiler_executed: true, rust_compiler_executed: true, runtime_executed: true,
    original_callers_executed: false, original_rng_proved: false, save_resume_proved: false,
    browser_accepted: false, whole_game_accepted: false },
  browser: { evidence: browser, at: '2026-10-03T03:06:35.4990144Z',
    physical_available_bytes: 6489661440, exact_commit_headroom_bytes: 9826078720,
    physical_gate_pass: false, physical_gate_shortfall_bytes: 1026531328,
    commit_gate_pass: true, exact_commit_surplus_over_gate_bytes: 162402304, candidate_consumed: false,
    small_pins_passed: 22, four_artifact_sizes_passed: true,
    server_identity_verified: true, http_verified: true,
    current_large_hashes_performed: false, chrome_started: false, profile_created: false,
    historical_previous_resource_snapshot: browserHistory },
  distinct_bounded_rust_unit_tests: 62, whole_game_accepted: false,
};
const recovery = progress.local_browser_reference?.conditional_recovery;
if (recovery) {
  recovery.last_resource_check = progress.continuation.browser;
  recovery.candidate_consumed = false;
}
if (browserOnly) require(JSON.stringify(progress.continuation.full_engine.actual_r3_compile_snapshot) === snapshotBeforeBrowserAmendment,
  'Browser-only amendment must not recapture or change native receipts');
fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2) + '\n');
console.log(JSON.stringify({ status: progress.continuation.status, updated_at: progress.last_updated,
  distinct_bounded_rust_unit_tests: 62, actual_cross_language_parity_checks: 23, new_distinct_rust_unit_tests: 0,
  confirmed_partial_compile_count: compileSnapshot.confirmed_completed_compile_count,
  snapshot_at: compileSnapshot.receipt_directory_enumerated_at, serial_session: 93261,
  browser_only_amendment: browserOnly, native_snapshot_preserved_without_receipt_recapture: browserOnly,
  whole_game_accepted: false }));
