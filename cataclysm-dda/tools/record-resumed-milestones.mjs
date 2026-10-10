import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const progressPath = path.join(root, 'progress.json');
const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
function pin(file, sha256) {
  const bytes = fs.readFileSync(path.join(root, file));
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('Reviewed milestone changed: ' + file);
  return { proof: file, bytes: bytes.length, sha256 };
}
const policy = pin('v5-runtime-integration/rust-policy/formatted-quality/policy-verification.json',
  'cc566f72be67c54be61351605d5873c41ff2003db6c853cf6d01b8ea72dc3df1');
const input = pin('input-context-live-slice/ORIGINAL-CONTEXT-VERIFICATION.json',
  'dbc812584b6d7bd26e3e752be84dada30ddf1851b7b4daa88f7736844356fd53');
const inputRust = pin('input-context-live-slice/ORIGINAL-CONTEXT-RUST-VERIFICATION.json',
  'c6e26b1b161428d0c3743895421fcf888af67fea39f63ae266590d03c4903d00');
const help = pin('semantic-display-live-slice/COMPILE-VERIFICATION.json',
  '78fda00342ab9681ebfd633b9199cecd0d2c4c30989655c4aa8297138f26b1bf');
const staging = pin('v5-runtime-integration/LOCAL-STAGING.json',
  '43cdb12cc04d751eae63236ca1ca5ec3227665742ed46ddbfd4c1fc148227944');
const http = pin('v5-runtime-integration/LOCAL-HTTP-CHECKS.json',
  '1e8c36d0e87f3f644c4be20d8fda1643f6522173b6547cabbbb85503d730e86a');
progress.last_updated = new Date().toISOString();
progress.resumed_original_input = { status: 'selected-original-class-members-executed', ...input,
  actual_wasm_cases: 15, native_json_records: 24, protected_inputs: 246, original_interner: true,
  scripted_hardware_and_menu_leaves: true, raw_username_payload_in_snapshot_abi: false,
  actual_rust_native_record_consumer_executed: true, native_rust_consumer: inputRust,
  native_rust_tests: 5, native_rust_protected_inputs: 540, browser_rust_wasm_connected: false,
  full_engine_integrated: false,
  command_authorization: 'Denied(UntrackedNativeReaders)', whole_game_verified: false };
progress.resumed_help_display = { status: 'six-actual-cpp-compiles-passed', ...help,
  original_units_compiled: ['help', 'input', 'input_context'], helper_transport_and_fixture_compiled: true,
  protected_inputs: 1210, original_producer_executed: false, real_rust_acceptance: false,
  full_engine_integrated: false, actual_browser_executed: false };
progress.native_16px_assets.runtime_increment = { status: 'separate-local-variant-http-and-rust-policy-verified',
  url: 'http://127.0.0.1:8878/v5/index.html', policy, staging, http,
  wasm_bytes: 1392, wasm_sha256: '2ced53ec33c6600846e9c4bd5af63bbe0e99786af7b90437b0c4ea36f1bf7e9b',
  genuine_rust_tests: 5, actual_wasm_abi_assertions: 1567, asset_files: 6, asset_bytes: 1200829,
  new_profile_options: ['USE_LANG=ja', 'TILES=cdda16_combined_ready', 'OVERMAP_TILES=cdda16_combined_ready'],
  generated_restore_tests: 5, restore_test_filesystem_and_callbacks: 'explicit-doubles',
  original_engine_artifacts_modified: false, actual_browser_restore_executed: false,
  original_engine_renderer_executed: false, full_game_verified: false };
progress.native_16px_assets.next_action = 'Native browser map/overmap/layers/fallback and existing-profile restore checks remain pending the unchanged browser gate.';
progress.active_increment.test_breakdown.v5_asset_policy = 5;
progress.active_increment.test_breakdown.original_context_records = 5;
progress.active_increment.unique_tests_across_new_bounded_slices =
  Object.values(progress.active_increment.test_breakdown).reduce((sum, count) => sum + count, 0);
const recovery = progress.local_browser_reference.conditional_recovery;
if (recovery) {
  recovery.last_resource_check = { at: '2026-10-03T00:19:41.0781338Z',
    physical_available_bytes: 5962932224, commit_headroom_bytes: 10151190528,
    physical_gate_pass: false, commit_gate_pass: true, profile_created: false, chrome_started: false };
  recovery.candidate_consumed = false;
  recovery.cheap_no_fit_samples = 23;
  recovery.historical_no_fit_handoff_before_resume ??= recovery.final_no_fit_handoff;
  recovery.final_no_fit_handoff = 'browser-qa/resume/no-fit-handoff-2026-10-03T00-21-31-033Z.json';
  recovery.final_no_fit_handoff_sha256 = 'beaddfd725c6b263d02bcc4c731fb383c20a4e0275deec9fe20785dfca158fad';
}
progress.current_browser_resource_check = { at: '2026-10-03T00:19:41.0781338Z',
  physical_available_bytes: 5962932224, exact_commit_headroom_bytes: 10151190528,
  minimum_physical_bytes: 7516192768, minimum_exact_commit_bytes: 9663676416,
  candidate_consumed: false, chrome_started: false };
fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2) + '\n');
console.log(JSON.stringify({ updated: progress.last_updated, distinctBoundedRustTests: progress.active_increment.unique_tests_across_new_bounded_slices,
  originalInputCases: 15, localV5Files: 17, fullGameVerified: false }));
