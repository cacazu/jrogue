// Source/read-only dependency audit and owned plan/lock preparation only.
// This module never imports child_process or invokes Cargo/compiler/browser.
import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {sha256, serialized, ROOT, DIRECTORY, SOURCE_COMMIT} from './convert.mjs';

const baseLockFile = path.join(ROOT, 'rust-contracts/Cargo.lock');
const baseLock = readFileSync(baseLockFile, 'utf8');
assert.ok(/^version = 4$/m.test(baseLock));
const packages = new Map();
for (const tail of baseLock.split('[[package]]').slice(1)) {
  const block = '[[package]]' + tail.trimEnd() + '\n';
  const name = /^name = "([^"]+)"$/m.exec(block)?.[1];
  const version = /^version = "([^"]+)"$/m.exec(block)?.[1];
  assert.ok(name && version && !packages.has(name), 'prepared parser requires unique package names');
  const dependencyText = /dependencies = \[([\s\S]*?)\]/.exec(block)?.[1] ?? '';
  const dependencies = [...dependencyText.matchAll(/"([^"]+)"/g)].map(match => match[1]);
  assert.ok(dependencies.every(name => !name.includes(' ')), 'ambiguous lock dependency needs exact parser review');
  packages.set(name, {name, version, dependencies, block,
    source: /^source = "([^"]+)"$/m.exec(block)?.[1] ?? null,
    checksum: /^checksum = "([^"]+)"$/m.exec(block)?.[1] ?? null});
}
const selected = new Set();
function select(name) {
  if (selected.has(name)) return;
  const item = packages.get(name); assert.ok(item, 'dependency missing from reviewed lock: ' + name);
  selected.add(name); item.dependencies.forEach(select);
}
['cdda-logic-contract', 'cdda-presentation', 'serde_json'].forEach(select);
const registry = 'C:/Users/kit/.cargo/registry';
const index = 'index.crates.io-1949cf8c6b5b557f';
const dependencyPins = [];
for (const name of [...selected].sort()) {
  const item = packages.get(name);
  if (item.source === null) {
    assert.ok(['cdda-logic-contract', 'cdda-presentation'].includes(name));
    const directory = name === 'cdda-logic-contract' ? 'logic' : 'presentation';
    dependencyPins.push({name, version: item.version, source: 'existing path dependency',
      manifestSha256: sha256(readFileSync(path.join(ROOT, 'rust-contracts', directory, 'Cargo.toml'))),
      librarySha256: sha256(readFileSync(path.join(ROOT, 'rust-contracts', directory, 'src/lib.rs')))});
  } else {
    assert.equal(item.source, 'registry+https://github.com/rust-lang/crates.io-index');
    const cachePath = path.join(registry, 'cache', index, `${name}-${item.version}.crate`);
    const sourcePath = path.join(registry, 'src', index, `${name}-${item.version}`);
    assert.ok(existsSync(cachePath) && existsSync(path.join(sourcePath, 'Cargo.toml')), 'required dependency is not already cached: ' + name);
    const actual = sha256(readFileSync(cachePath));
    assert.equal(actual, item.checksum, 'cached archive checksum mismatch: ' + name);
    const sourceChecksumPath = path.join(sourcePath, '.cargo-checksum.json');
    const sourceChecksum = existsSync(sourceChecksumPath)
      ? JSON.parse(readFileSync(sourceChecksumPath, 'utf8')).package : null;
    if (sourceChecksum !== null) assert.equal(sourceChecksum, item.checksum);
    dependencyPins.push({name, version: item.version, source: item.source, sha256: actual, archive: cachePath,
      unpackedManifest: path.join(sourcePath, 'Cargo.toml'), unpackedManifestSha256: sha256(readFileSync(path.join(sourcePath, 'Cargo.toml'))),
      unpackedCargoChecksumFilePresent: sourceChecksum !== null,
      cargoExtractionMarkerPresent: existsSync(path.join(sourcePath, '.cargo-ok')),
      cachedArchiveBytes: statSync(cachePath).size});
  }
}

const projects = [
  {directory: 'semantic-runtime-catalog', name: 'cdda-source-literal-catalog-verification', test: 'catalog', expectedTests: 7},
  {directory: 'semantic-plural-slice', name: 'cdda-source-plural-slice-verification', test: 'plural', expectedTests: 5},
];
const rustToolchain = 'C:/Users/kit/.rustup/toolchains/1.98.1-x86_64-pc-windows-gnu';
const cargo = path.join(rustToolchain, 'bin/cargo.exe'), rustc = path.join(rustToolchain, 'bin/rustc.exe');
const nativeLinker = path.join(rustToolchain, 'lib/rustlib/x86_64-pc-windows-gnu/bin/self-contained/x86_64-w64-mingw32-gcc.exe');
for (const file of [cargo, rustc, nativeLinker]) assert.ok(existsSync(file), 'installed native tool unavailable');
const futureCommands = [];
for (const project of projects) {
  const rootBlock = `[[package]]\nname = "${project.name}"\nversion = "0.1.0"\ndependencies = [\n "cdda-logic-contract",\n "cdda-presentation",\n "serde_json",\n]\n`;
  const blocks = [...selected].map(name => packages.get(name)).concat({name: project.name, block: rootBlock})
    .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const lock = '# Prepared from the reviewed rust-contracts/Cargo.lock without running Cargo.\n# Cargo acceptance remains pending; run with --offline --locked.\nversion = 4\n\n' + blocks.map(item => item.block).join('\n');
  const ownedLock = path.join(ROOT, project.directory, 'rust-verification/Cargo.lock');
  writeFileSync(ownedLock, lock, 'utf8');
  project.lockSha256 = sha256(lock);
  project.manifestSha256 = sha256(readFileSync(path.join(ROOT, project.directory, 'rust-verification/Cargo.toml')));
  const testFile = path.join(ROOT, project.directory, 'rust-verification/tests', project.test + '.rs');
  const testSource = readFileSync(testFile, 'utf8');
  assert.equal([...testSource.matchAll(/#\[test\]/g)].length, project.expectedTests);
  project.testSourceSha256 = sha256(testSource);
  futureCommands.push({stage: project.test + '-genuine-rust-consumer', executable: cargo,
    argv: ['test', '--offline', '--locked', '--jobs', '1', '--manifest-path', path.join(ROOT, project.directory, 'rust-verification/Cargo.toml'),
      '--target', 'x86_64-pc-windows-gnu', '--target-dir', path.join(ROOT, project.directory, 'rust-verification/target'),
      '--test', project.test, '--', '--test-threads=1'], cwd: ROOT, expectedIntegrationTests: project.expectedTests,
    scope: 'actual existing Rust Catalog parser/formatter only; not original C++ producer/FFI or browser'});
}
const sdk = 'C:/Users/kit/emsdk';
const configInput = readFileSync(path.join(sdk, '.emscripten'), 'utf8');
const config = configInput.replaceAll('$CFGDIR', sdk) + '\nFROZEN_CACHE = True\n';
const nativeDirectory = path.join(ROOT, 'semantic-plural-slice/build-plan');
mkdirSync(nativeDirectory, {recursive: true});
const configPath = path.join(nativeDirectory, '.emscripten');
writeFileSync(configPath, config, 'utf8');
const emCache = path.join(sdk, 'upstream/emscripten/cache');
const requiredNativeArchives = ['libc++.a', 'libc++abi.a', 'libc.a', 'libdlmalloc.a'];
for (const archive of requiredNativeArchives) assert.ok(existsSync(path.join(emCache, 'sysroot/lib/wasm32-emscripten', archive)), 'frozen native cache input missing: ' + archive);
const python = path.join(sdk, 'python/3.13.3_64bit/python.exe'), emcc = path.join(sdk, 'upstream/emscripten/emcc.py');
for (const file of [python, emcc]) assert.ok(existsSync(file));
const cppOutput = path.join(ROOT, 'semantic-plural-slice/native-consumer-build/selector-fixtures.cjs');
futureCommands.push({stage: 'native-cpp-selector-fixture-build', executable: python,
  argv: [emcc, path.join(ROOT, 'semantic-plural-slice/native-selector-fixtures.cpp'), '-std=c++17', '-O0', '-g0',
    '-ffp-contract=off', '-fexceptions', '-Wall', '-Wextra', '-Werror', '-sDEFAULT_TO_CXX=1', '-sENVIRONMENT=node',
    '-sEXIT_RUNTIME=1', '-sASSERTIONS=1', '-o', cppOutput], cwd: ROOT,
  environment: {EM_CONFIG: configPath, EM_CACHE: emCache, EMSDK_PYTHON: python, EMCC_CORES: '1', EMCC_BATCH_BUILD: '0', BINARYEN_CORES: '1'},
  cachePolicy: 'Installed official frozen cache only; missing cache variants stop the stage without regeneration or installs',
  scope: 'standalone pinned wasm32 C++ language/selector boundary; no original translation cache, MO lookup or live producer call'});
futureCommands.push({stage: 'native-cpp-selector-fixture-node-execution', executable: 'C:/Program Files/nodejs/node.exe', argv: [cppOutput], cwd: ROOT,
  scope: 'execute only the reviewed owned fixture after successful compile; no browser/npm/server or engine run'});

const plan = {
  schemaVersion: 1, status: 'source-plan-prepared-not-executed', sourceCommit: SOURCE_COMMIT,
  heavyWindowReleased: false, cargoExecuted: false, compilerExecuted: false, browserExecuted: false, externalHostingAllowed: false,
  lockPreparation: {originalLockSha256: sha256(baseLock), method: 'exact dependency closure and verbatim registry package blocks from already verified root lock; no Cargo resolver invoked',
    registryPackages: dependencyPins.filter(item => item.sha256).length, pathPackages: dependencyPins.filter(item => !item.sha256).length,
    actualCargoLockAcceptancePending: true, projects},
  cachedDependencies: dependencyPins,
  installedNativeTools: {toolchain: rustToolchain, cargo, rustc, linker: nativeLinker,
    recordedPreviousVersions: JSON.parse(readFileSync(path.join(ROOT, 'rust-contracts/verification/results.json'), 'utf8')),
    rustToolVersionExecutionPending: true},
  rustEnvironment: {RUSTC: rustc, CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER: nativeLinker, CARGO_NET_OFFLINE: 'true',
    CARGO_BUILD_JOBS: '1', RUST_TEST_THREADS: '1', CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_CODEGEN_UNITS: '1', CARGO_PROFILE_TEST_CODEGEN_UNITS: '1',
    CARGO_PROFILE_DEV_DEBUG: '0', CARGO_PROFILE_TEST_DEBUG: '0'},
  removeInheritedEnvironment: ['RUSTC_WRAPPER', 'RUSTC_WORKSPACE_WRAPPER', 'RUSTFLAGS', 'CARGO_ENCODED_RUSTFLAGS', 'RUSTDOCFLAGS', 'CARGO_ENCODED_RUSTDOCFLAGS', 'EMCC_CFLAGS', 'EMCC_DEBUG', 'BINARYEN_PASS_DEBUG'],
  launchGate: {parentExplicitWindowReleaseRequired: true, sequentialOneHeavyJob: true, maximumAgeMilliseconds: 15000,
    minimumPhysicalFreeBytes: 4294967296, minimumExactCommitHeadroomBytes: 6442450944,
    counters: ['Win32_OperatingSystem.FreePhysicalMemory * 1024', 'Win32_PerfFormattedData_PerfOS_Memory.CommitLimit - CommittedBytes'],
    recaptureBeforeEveryCompileStage: true, counterFailureBlocksLaunch: true, unrelatedChromeOrOtherHeavyJobMustBeAbsentOrParentConfirmedFinished: true},
  ownedResourceGuard: {sampleIntervalMilliseconds: 2000, minimumPhysicalFreeBytes: 2147483648, minimumExactCommitHeadroomBytes: 2147483648,
    maximumOwnedTreePrivateBytes: 1073741824, maximumOwnedTreeWorkingSetBytes: 1073741824, maximumStageSeconds: 180,
    ownership: 'Only selected stage root PID plus its descendants, each pinned by PID + creation time. Never infer ownership from process name.',
    failurePolicy: 'Stop only verified owned stage descendants on resource breach, monitor failure, timeout or failed command; preserve Chrome, parent, all unrelated processes and source/cache/accepted artifacts'},
  nativeFrozenConfig: {file: configPath, sha256: sha256(config), inputSha256: sha256(configInput),
    cache: emCache, cacheSanitySha256: sha256(readFileSync(path.join(emCache, 'sanity.txt'))), requiredArchivePresenceOnly: requiredNativeArchives,
    exactSelectedArchiveTracePending: true},
  commands: futureCommands,
  evidenceRequired: ['Fresh gate and owned PID/creation identities per compile stage', 'Exact argv/environment/tool versions; command exits and per-test counts',
    'Owned-resource samples/peaks and successful cleanup', 'Prepared/source/catalog/lock hashes before and after', 'Native compiler ABI gate and fixture stdout',
    'Selected SDK archive trace and unchanged frozen cache sanity', 'Separate actual Rust and native fixture verdicts; no conversion-summary/runtime gates changed automatically'],
  nextIntegrationGate: 'After genuine tests pass: original definition identity/caller annotation and one original C++ producer-to-Term FFI route, with original English/Japanese output equivalence and render/RNG purity. These fixture tests cannot establish full native assembly or whole-game consumption.',
};
const destination = path.join(DIRECTORY, 'build-plan');
mkdirSync(destination, {recursive: true});
writeFileSync(path.join(destination, 'consumer-build-plan.json'), serialized(plan), 'utf8');
console.log(JSON.stringify({status: plan.status, cachedRegistryPackages: plan.lockPreparation.registryPackages,
  existingPathPackages: plan.lockPreparation.pathPackages, genuineRustTestsPrepared: 12, commandsPrepared: futureCommands.length, compilerExecuted: false}));
