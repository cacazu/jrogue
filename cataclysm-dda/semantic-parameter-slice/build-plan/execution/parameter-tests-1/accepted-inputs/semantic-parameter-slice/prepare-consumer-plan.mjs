// Source/pin preparation only. No child process, Cargo, extraction or cache write.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(own);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const load = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const pin = (file, relative = path.relative(root, file).replaceAll('\\', '/')) => {
  const bytes = fs.readFileSync(file);
  return { relative, path: file, bytes: bytes.length, sha256: hash(bytes) };
};
const base = load('presentation-snapshot-overlay/build-plan/parser-build-plan.json');
const previous = load('semantic-runtime-catalog/build-plan/consumer-build-plan.json');
const auditFile = path.join(root, 'semantic-runtime-catalog/build-plan/dependency-source-audit.json');
const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
assert.equal(audit.status, 'passed-read-only-source-audit');
assert.equal(audit.registryArchivesVerified, 13);
assert.equal(audit.unpackedFilesVerified, 595);
assert.equal(audit.unpackedBytesVerified, 6110443);
const templateFile = path.join(root, 'semantic-plural-slice/rust-verification/Cargo.lock');
const template = fs.readFileSync(templateFile, 'utf8');
const originalName = 'name = "cdda-source-plural-slice-verification"';
assert.equal(template.split(originalName).length, 2);
const lock = template.replace(originalName, 'name = "cdda-source-parameter-slice-verification"');
const lockFile = path.join(own, 'rust-verification/Cargo.lock');
if (fs.existsSync(lockFile)) assert.equal(fs.readFileSync(lockFile, 'utf8'), lock);
else fs.writeFileSync(lockFile, lock);

const registries = previous.cachedDependencies.filter(item => item.archive);
const payload = [];
const markers = [];
let sourceFiles = 0;
let sourceBytes = 0;
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), 'cached source symlink unsupported');
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(file);
    assert.ok(entry.isFile());
    return entry.name === '.cargo-ok' ? [] : [file];
  });
}
for (const crate of registries) {
  const archive = pin(crate.archive, 'cached-archive/' + crate.name + '-' + crate.version);
  assert.equal(archive.sha256, crate.sha256);
  payload.push(archive);
  markers.push(pin(path.join(path.dirname(crate.unpackedManifest), '.cargo-ok'),
    'cached-extraction-marker/' + crate.name + '-' + crate.version));
  const files = walk(path.dirname(crate.unpackedManifest));
  const old = audit.records.find(item => item.name === crate.name && item.version === crate.version);
  assert.equal(files.length, old.unpackedRegularFilesVerified);
  let bytes = 0;
  for (const file of files) {
    const record = pin(file, 'cached-source/' + crate.name + '-' + crate.version + '/' + path.relative(path.dirname(crate.unpackedManifest), file).replaceAll('\\', '/'));
    payload.push(record);
    bytes += record.bytes;
  }
  assert.equal(bytes, old.unpackedBytesVerified);
  sourceFiles += files.length;
  sourceBytes += bytes;
}
assert.equal(sourceFiles, 595);
assert.equal(sourceBytes, 6110443);

const inputNames = [
  'semantic-parameter-slice/rust-verification/Cargo.toml', 'semantic-parameter-slice/rust-verification/Cargo.lock',
  'semantic-parameter-slice/rust-verification/src/lib.rs', 'semantic-parameter-slice/rust-verification/src/tests.rs',
  'semantic-parameter-slice/output/en.json', 'semantic-parameter-slice/output/ja.json',
  'semantic-parameter-slice/output/term-fixtures.en.json', 'semantic-parameter-slice/output/term-fixtures.ja.json',
  'semantic-parameter-slice/output/source-inventory.json', 'semantic-parameter-slice/output/remaining-blockers.json',
  'semantic-parameter-slice/output/summary.json', 'semantic-parameter-slice/output/node-verification.json',
  'semantic-parameter-slice/bindings.mjs', 'semantic-parameter-slice/prepare.mjs', 'semantic-parameter-slice/test.mjs',
  'semantic-parameter-slice/run-consumer-window.py', 'semantic-parameter-slice/prepare-consumer-plan.mjs',
  'rust-contracts/Cargo.toml', 'rust-contracts/Cargo.lock',
  'rust-contracts/logic/Cargo.toml', 'rust-contracts/logic/src/lib.rs',
  'rust-contracts/presentation/Cargo.toml', 'rust-contracts/presentation/src/lib.rs',
  'rust-contracts/locales/en.json', 'rust-contracts/locales/ja.json',
];
const source = fs.readFileSync(path.join(own, 'rust-verification/src/tests.rs'), 'utf8');
const expectedTests = [...source.matchAll(/#\[test\]\s*fn\s+([a-z_]+)\s*\(/g)].map(item => 'tests::' + item[1]);
assert.equal(expectedTests.length, 7);
const crateDirectory = path.join(own, 'rust-verification');
const ancestors = [];
for (let directory = crateDirectory;; directory = path.dirname(directory)) {
  ancestors.push(directory);
  assert.ok(!fs.existsSync(path.join(directory, '.cargo/config')) && !fs.existsSync(path.join(directory, '.cargo/config.toml')));
  if (directory === path.dirname(directory)) break;
}
const cargoHome = 'C:\\Users\\kit\\.cargo';
assert.ok(!fs.existsSync(path.join(cargoHome, 'config')) && !fs.existsSync(path.join(cargoHome, 'config.toml')));
const environment = { ...base.rustEnvironment, CARGO_HOME: cargoHome };
const targetDirectory = path.join(crateDirectory, 'target');
const plan = {
  schemaVersion: 1, status: 'SOURCE_PREPARED_SEVEN_TESTS_PENDING_PARENT_RESERVATION',
  sourceCommit: base.sourceCommit,
  scope: 'existing Catalog parser/formatter with three original message programs and two synthetic source-leaf choices; no original producers/FFI/browser',
  owner: pin(path.join(root, 'presentation-snapshot-overlay/run-parser-window.py')),
  guard: base.guard, originalGuardPlan: base.originalGuardPlan, exercisedEvidence: base.exercisedEvidence,
  dependencyAudit: pin(auditFile), installedTools: base.installedTools,
  expectedTests,
  lockPreparation: { method: 'verbatim accepted plural lock graph; own package name only changed; no Cargo resolver invoked',
    template: pin(templateFile), registryPackages: 13, pathPackages: 2, ownPackage: 1,
    actualCargoAcceptancePending: true },
  cachePolicy: { existingCargoHome: cargoHome, ordinaryMetadataWritesAuthorizedByParent: true,
    possibleMetadataWrites: ['.global-cache', '.package-cache', '.package-cache-mutate'],
    registryPayloadEditsAllowed: false, extractionAllowed: false, downloadsAllowed: false,
    sourceConfigurationEditsAllowed: false, sdkChangesAllowed: false,
    freshPayloadPins: { archives: 13, sourceFiles, sourceBytes },
    originalArchiveSourceEquivalenceEvidence: pin(auditFile) },
  inspectedAncestorCargoConfigDirectories: ancestors,
  rustEnvironment: environment, removeInheritedEnvironment: base.removeInheritedEnvironment,
  launchGate: base.launchGate, ownedResourceGuard: base.ownedResourceGuard,
  commands: [{ stage: 'parameter-genuine-rust-consumer', executable: base.installedTools.cargo.path,
    argv: ['test', '--lib', '--verbose', '--offline', '--locked', '--jobs', '1', '--manifest-path',
      path.join(crateDirectory, 'Cargo.toml'), '--target', 'x86_64-pc-windows-gnu', '--target-dir', targetDirectory,
      '--', '--test-threads=1'], cwd: crateDirectory }],
  inputs: inputNames.map(relative => pin(path.join(root, relative), relative)), cachedPayloadPins: payload,
  cachedExtractionMarkerPins: markers,
  outputs: { targetDirectory, executionDirectory: path.join(own, 'build-plan/execution') },
  formatClippy: { executed: false, assessment: 'Rust source is compact and standard rustfmt changes are expected. Do not run a known-failing fmt check. A separate bounded formatting preview/review and refreshed source plan precede format-check/Clippy acceptance. This test-only reservation does not imply either check.' },
  prohibited: ['original C++ compile/link', 'engine', 'browser', 'server', 'network/install/extraction', 'SDK/cache payload/source/config edits', 'Git', 'publication'],
};
assert.equal(plan.owner.sha256, '0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb');
fs.mkdirSync(path.join(own, 'build-plan'), { recursive: true });
const bytes = Buffer.from(JSON.stringify(plan, null, 2) + '\n');
fs.writeFileSync(path.join(own, 'build-plan/consumer-build-plan.json'), bytes);
console.log(JSON.stringify({ status: plan.status, planSha256: hash(bytes), runnerSha256: plan.inputs.find(item => item.relative.endsWith('/run-consumer-window.py')).sha256,
  inputs: plan.inputs.length, cachedArchives: 13, cachedSourceFiles: sourceFiles, cachedSourceBytes: sourceBytes,
  sourcePreparationOnly: true, compilerExecuted: false }));
