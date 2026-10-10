// Source preparation only: no process/tool/compiler execution.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url));
const staging = path.dirname(own);
const guard = path.join(staging, 'semantic-runtime-catalog/run-consumer-window.py');
const guardHash = 'ae54cce5dbbe2e769d52572528f750b0573ef37fb172cc29db8ab8fa8208a8c3';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fingerprint = file => {
  const bytes = fs.readFileSync(file);
  return { path: file, bytes: bytes.length, sha256: sha(bytes) };
};
if (sha(fs.readFileSync(guard)) !== guardHash) throw Error('exercised guard bytes changed');
const oldPlanFile = path.join(staging, 'semantic-runtime-catalog/build-plan/consumer-build-plan.json');
const oldPlan = JSON.parse(fs.readFileSync(oldPlanFile));
const manifest = path.join(own, 'rust/Cargo.toml');
const manifestBytes = fs.readFileSync(manifest, 'utf8');
if (!manifestBytes.includes('[workspace]') || /\[(?:dev-|build-)?dependencies(?:\.[^\]]+)?\]/.test(manifestBytes) ||
    /^(?:build|links)\s*=/m.test(manifestBytes) || fs.existsSync(path.join(own, 'rust/build.rs'))) {
  throw Error('expected exact isolated std-only package without build script');
}
const lock = path.join(own, 'rust/Cargo.lock');
const expectedLock = '# Prepared for this isolated std-only package without running Cargo.\n' +
  '# Accepted unchanged by the reserved offline/locked run; see RUST-VERIFICATION.json.\n' +
  'version = 4\n\n[[package]]\nname = "cdda-native-text-snapshot-source"\nversion = "0.1.0"\n';
if (fs.readFileSync(lock, 'utf8') !== expectedLock) throw Error('one-package prepared lock mismatch');
const testSource = fs.readFileSync(path.join(own, 'rust/src/tests.rs'), 'utf8');
const testNames = [...testSource.matchAll(/#\[test\]\s*fn ([a-z_]+)\(/g)].map(match => `tests::${match[1]}`);
if (testNames.length !== 5 || new Set(testNames).size !== 5) throw Error('expected exact five real parser tests');
let ancestor = path.join(own, 'rust');
const inspectedConfigDirectories = [];
while (true) {
  inspectedConfigDirectories.push(ancestor);
  for (const name of ['.cargo/config', '.cargo/config.toml']) {
    if (fs.existsSync(path.join(ancestor, name))) throw Error(`unexpected ancestor Cargo configuration: ${ancestor}`);
  }
  const next = path.dirname(ancestor);
  if (next === ancestor) break;
  ancestor = next;
}
const directory = path.join(own, 'build-plan');
fs.mkdirSync(directory, { recursive: true });
const target = path.join(own, 'rust/target');
const toolchain = oldPlan.installedNativeTools.toolchain;
const tools = {
  cargo: oldPlan.installedNativeTools.cargo,
  rustc: oldPlan.installedNativeTools.rustc,
  linker: oldPlan.installedNativeTools.linker,
  python: 'C:/Users/kit/emsdk/python/3.13.3_64bit/python.exe',
  rustfmt: path.join(toolchain, 'bin/rustfmt.exe'),
  'cargo-fmt': path.join(toolchain, 'bin/cargo-fmt.exe'),
  'cargo-clippy': path.join(toolchain, 'bin/cargo-clippy.exe'),
  'clippy-driver': path.join(toolchain, 'bin/clippy-driver.exe'),
};
const sharedArgv = ['--offline', '--locked', '--jobs', '1', '--manifest-path', manifest,
  '--target', 'x86_64-pc-windows-gnu', '--target-dir', target];
const command = (stage, argv) => ({ stage, executable: tools.cargo, argv, cwd: path.join(own, 'rust') });
const oldEvidence = ['catalog-genuine-rust-consumer', 'plural-genuine-rust-consumer'].map(stage => {
  const file = path.join(staging, 'semantic-runtime-catalog/build-plan/execution', stage + '.json');
  const data = JSON.parse(fs.readFileSync(file));
  if (!data.passed || data.remainingOwnedPidsBeforeJobClose.length) throw Error('previous exercised guard did not clean up');
  return { ...fingerprint(file), passed: data.passed, jobPeakPrivateBytes: data.jobPeakPrivateBytes };
});
const inputPaths = ['rust/Cargo.toml', 'rust/Cargo.lock', 'rust/src/lib.rs', 'rust/src/tests.rs',
  'fixtures/raw-border-cjk.bin', 'fixtures/empty-submit-batch.bin', 'fixtures/manifest.json',
  'src/browser_text_snapshot.cpp', 'src/browser_text_snapshot.h', 'presentation-snapshot.patch',
  'source-pins.json', 'SOURCE-CHECKS.json', 'run-parser-window.py', 'prepare-parser-run.mjs'];
const plan = {
  schemaVersion: 1,
  status: 'SOURCE_PLAN_ONLY_NOT_EXECUTED_PARENT_RESERVATION_REQUIRED',
  sourceCommit: '7b2efa5cea38e4d4d97dd0e63b28b9148623da59',
  scope: 'actual isolated Rust owned parser and five synthetic binary-fixture tests; no original C++ or live FFI',
  guard: fingerprint(guard), originalGuardPlan: fingerprint(oldPlanFile), exercisedEvidence: oldEvidence,
  toolchain, installedTools: Object.fromEntries(Object.entries(tools).map(([key, file]) => [key, fingerprint(file)])),
  expectedTests: testNames,
  dependencies: { standardLibraryOnly: true, registryPackages: 0, pathPackages: 0, buildScripts: 0,
    isolatedWorkspace: true, preparedLockPackageCount: 1, actualCargoAcceptancePending: true },
  inspectedAncestorCargoConfigDirectories: inspectedConfigDirectories,
  rustEnvironment: { ...oldPlan.rustEnvironment,
    CARGO_HOME: path.join(directory, 'cargo-home'),
    RUSTFMT: tools.rustfmt,
    RAYON_NUM_THREADS: '1',
    PATH: path.join(toolchain, 'bin') + path.delimiter + process.env.PATH,
  },
  removeInheritedEnvironment: [...new Set([...oldPlan.removeInheritedEnvironment, 'CARGO_HOME',
    'CARGO_TARGET_DIR', 'CARGO_BUILD_RUSTC', 'CARGO_BUILD_RUSTC_WRAPPER', 'CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER',
    'CARGO_BUILD_TARGET', 'RUSTUP_TOOLCHAIN', 'PYTHONOPTIMIZE', 'CLIPPY_CONF_DIR'])],
  launchGate: { parentExplicitWindowReleaseRequired: true, sequentialOneHeavyJob: true,
    minimumPhysicalFreeBytes: 4 * 1024 ** 3, minimumExactCommitHeadroomBytes: 6 * 1024 ** 3,
    recaptureBeforeEveryStage: true, counterFailureBlocksLaunch: true,
    unrelatedHeavyJobsExcludedByExplicitParentReservation: true },
  ownedResourceGuard: { maximumOwnedTreePrivateBytes: 1024 ** 3, maximumOwnedTreeWorkingSetBytes: 1024 ** 3,
    minimumPhysicalFreeBytes: 2 * 1024 ** 3, minimumExactCommitHeadroomBytes: 2 * 1024 ** 3,
    maximumStageSeconds: 180, sampleIntervalMilliseconds: 250,
    cleanup: 'only newly created unnamed owned jobs and exact returned Popen process handles; no PID/name termination' },
  defaultStage: 'rust-parser-native-tests',
  commands: [
    command('rust-parser-native-tests', ['test', '--lib', '--verbose', ...sharedArgv, '--', '--test-threads=1']),
    command('rust-parser-format-check', ['fmt', '--manifest-path', manifest, '--all', '--', '--check']),
    command('rust-parser-clippy-check', ['clippy', ...sharedArgv, '--lib', '--tests', '--', '-D', 'warnings']),
  ],
  inputs: inputPaths.map(relative => ({ relative, ...fingerprint(path.join(own, relative)) })),
  outputs: { targetDirectory: target, cargoHome: path.join(directory, 'cargo-home'),
    executionDirectory: path.join(directory, 'execution') },
  prohibited: ['original C++ compile/link', 'native engine', 'browser', 'server', 'network/install', 'Git', 'publication'],
};
const planPath = path.join(directory, 'parser-build-plan.json');
fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({ status: plan.status, plan: fingerprint(planPath), runner: fingerprint(path.join(own, 'run-parser-window.py')),
  guardSha256: plan.guard.sha256, testCount: plan.expectedTests.length, dependencyCount: 0, commands: plan.commands }, null, 2));
