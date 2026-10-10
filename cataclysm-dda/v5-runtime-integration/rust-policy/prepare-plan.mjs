// Prepare four exact Rust commands using the existing reviewed owned-job adapter.
// No Cargo/compiler/browser/Windows guard is launched here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function pin(file) {
  const bytes = fs.readFileSync(file);
  return { path: path.resolve(file), bytes: bytes.length, sha256: sha(bytes) };
}
const referencePath = path.join(root, 'integration-overlay/native-module-fixture/rust-build-plan/formatted-quality/quality-plan.json');
const referenceBytes = fs.readFileSync(referencePath);
assert.equal(sha(referenceBytes), '504c67c4e405cf373941e121686941b77fc2a8037287161a38b5be5249d39895');
const reference = JSON.parse(referenceBytes);
const sourcePath = path.join(here, 'source-validation.json');
const validation = JSON.parse(fs.readFileSync(sourcePath));
assert.equal(validation.status, 'source-and-six-actual-parent-assets-verified');
for (const record of [...validation.pins, ...validation.files, validation.handoff]) {
  const expected = { path: path.resolve(record.path), bytes: record.bytes, sha256: record.sha256 };
  assert.deepEqual(pin(record.path), expected);
}
const helperPath = path.join(root, 'integration-overlay/build-plan/cpp-compile/run-compile-window.py');
const helper = pin(helperPath);
assert.equal(helper.sha256, '0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395');
const installedTools = reference.installedTools;
const toolchain = path.resolve(path.dirname(installedTools.cargo.path), '..');
const wasmLinker = path.join(toolchain, 'lib/rustlib/x86_64-pc-windows-gnu/bin/rust-lld.exe');
assert.ok(fs.existsSync(wasmLinker));
installedTools.wasmLinker = pin(wasmLinker);
for (const record of Object.values(installedTools)) assert.deepEqual(pin(record.path), record);
const wasmStd = path.join(toolchain, 'lib/rustlib/wasm32-unknown-unknown/lib');
const wasmStandardLibraries = fs.readdirSync(wasmStd).filter(name => /\.(?:rlib|rmeta)$/.test(name)).sort().map(name => pin(path.join(wasmStd, name)));
assert.ok(wasmStandardLibraries.some(record => path.basename(record.path).startsWith('libstd-')));
assert.ok(wasmStandardLibraries.some(record => path.basename(record.path).startsWith('libcore-')));
const target = path.join(here, 'owned-target');
assert.ok(!fs.existsSync(target), 'new owned target only; preserve every existing target');
const manifest = path.join(here, 'Cargo.toml');
const common = ['--manifest-path', manifest, '--package', 'cdda-v5-platform-policy'];
const offline = ['--offline', '--locked', '--jobs', '1'];
const commands = [
  { stage: 'v5-policy-format-check', argv: ['fmt', ...common, '--', '--check', '--config-path', path.join(here, 'rustfmt.toml')] },
  { stage: 'v5-policy-five-native-tests', argv: ['test', ...offline, ...common, '--target', 'x86_64-pc-windows-gnu', '--target-dir', target, '--lib', '--', '--test-threads=1'] },
  { stage: 'v5-policy-package-clippy', argv: ['clippy', ...offline, ...common, '--target', 'x86_64-pc-windows-gnu', '--target-dir', target, '--lib', '--tests', '--no-deps', '--', '-D', 'warnings'] },
  { stage: 'v5-policy-wasm-release-build', argv: ['build', '--release', ...offline, ...common, '--target', 'wasm32-unknown-unknown', '--target-dir', target, '--lib'] },
].map(command => ({ ...command, executable: installedTools.cargo.path, cwd: here }));
const rustEnvironment = { ...reference.rustEnvironment, CARGO_PROFILE_RELEASE_CODEGEN_UNITS: '1' };
// Dispatch only the pinned toolchain and installed system/linker directories.
// Rust tools and native linker are absolute paths; no new SDK/configuration.
rustEnvironment.PATH = reference.rustEnvironment.PATH;
const files = [...validation.pins, ...validation.files, validation.handoff, pin(sourcePath), pin(referencePath), pin(helperPath), ...Object.values(installedTools), ...wasmStandardLibraries, pin(reference.guard.currentWrapper.path), pin(reference.guard.historicalHelper.path), pin(path.join(here, 'prepare-plan.mjs'))];
const unique = new Map();
for (const record of files) {
  const normalized = { path: path.resolve(record.path), bytes: record.bytes, sha256: record.sha256 };
  if (unique.has(normalized.path)) assert.deepEqual(unique.get(normalized.path), normalized);
  unique.set(normalized.path, normalized);
}
const tests = fs.readFileSync(path.join(here, 'src/tests.rs'), 'utf8');
const expectedOrderedTests = [...tests.matchAll(/#\[test\]\s+fn ([a-z0-9_]+)\(\)/g)].map(match => 'tests::' + match[1]).sort();
assert.equal(expectedOrderedTests.length, 5);
const plan = {
  schemaVersion: 1,
  status: 'prepared-four-command-window-not-executed',
  policyVersion: 1,
  originalSourceCommit: validation.originalSourceCommit,
  sourceValidation: pin(sourcePath),
  pins: [...unique.values()].sort((a,b) => a.path.localeCompare(b.path)),
  preparedUniquePinCount: unique.size,
  installedTools,
  cpp2Helper: helper,
  guard: reference.guard,
  launchGate: reference.launchGate,
  ownedResourceGuard: reference.ownedResourceGuard,
  browserPriorityGate: reference.browserPriorityGate,
  rustEnvironment,
  removeInheritedEnvironment: reference.removeInheritedEnvironment,
  commands,
  expectedOrderedTests,
  actualParentAssetPins: validation.files,
  newOwnedTarget: target,
  wasmOutput: path.join(target, 'wasm32-unknown-unknown/release/cdda_v5_platform_policy.wasm'),
  RustTestsExecuted: false,
  ClippyExecuted: false,
  WasmBuildExecuted: false,
  engineRuntimeVerified: false,
  allGameArtworkComplete: false,
  externalPublication: false,
  policy: 'Only four sequential exact package commands after root release and independent source review. Offline std-only, fresh owned target, no old-target mutation or global SDK/config/cache/security change. Reviewed fixed run_owned outer handles cleanup; no generalized framework or unrelated process action.'
};
const planBytes = Buffer.from(JSON.stringify(plan, null, 2) + '\n');
fs.writeFileSync(path.join(here, 'quality-plan.json'), planBytes);
const runnerPath = path.join(here, 'run-policy-window.py');
const runner = fs.readFileSync(runnerPath, 'utf8');
assert.equal((runner.match(/PLAN_SHA = "[0-9a-f]{64}"/g) ?? []).length, 1);
fs.writeFileSync(runnerPath, runner.replace(/PLAN_SHA = "[0-9a-f]{64}"/, 'PLAN_SHA = "' + sha(planBytes) + '"'));
console.log(JSON.stringify({ status: plan.status, plan: pin(path.join(here, 'quality-plan.json')), runner: pin(runnerPath), protectedInputCount: unique.size, exactCommands: commands.length }));
