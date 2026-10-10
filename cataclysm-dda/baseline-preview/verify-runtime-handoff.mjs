import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { planHandoff, executeHandoff, validateRelativePath, inspectPath } from './handoff-runtime.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(root, 'handoff-fixtures', new Date().toISOString().replace(/[:.]/g, '-'));
assert.ok(fixtureRoot.startsWith(root + path.sep));
await fs.mkdir(fixtureRoot, { recursive: true }); // owned staging-only fixtures
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
let assertions = 0;
const badPaths = ['', '../other', '/outside', 'C:/outside', 'a\\outside', 'a/../b', 'a/./b', 'a//b', 'a/',
  'a.', 'a ', 'a:b', 'a\0b', 'CON', 'aux.txt', 'a/LPT1.bin', 'package-manifest.json'];
for (const bad of badPaths) { assert.throws(() => validateRelativePath(bad)); assertions++; }
assert.equal(validateRelativePath('notices/gfx/MshockXotto+/tileset.txt'), 'notices/gfx/MshockXotto+/tileset.txt'); assertions++;
const sourceRoot = path.join(fixtureRoot, 'source');
const destinationRoot = path.join(fixtureRoot, 'destination');
await fs.mkdir(path.join(sourceRoot, 'nested'), { recursive: true });
const payloads = [{ path: 'index.html', data: Buffer.from('Clearly marked handoff fixture; no gameplay.\n') },
  { path: 'nested/data.bin', data: Buffer.from(Array.from({ length: 70001 }, (_, i) => i % 251)) }];
for (const item of payloads) await fs.writeFile(path.join(sourceRoot, item.path), item.data);
const manifest = { sourceCommit: 'fixture_only_not_actual_engine', baselineOnly: true, referenceOnly: true, completePort: false,
  delivery: { nodeLocalhostOnly: true }, publication: { localOnly: true, siteCreated: false },
  files: payloads.map(item => ({ path: item.path, bytes: item.data.length, sha256: hash(item.data) })),
  totalPackageBytes: payloads.reduce((sum, item) => sum + item.data.length, 0) };
const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
await fs.writeFile(path.join(sourceRoot, 'package-manifest.json'), manifestBytes);
const config = { sourceRoot, destinationRoot, expectedSha256: hash(manifestBytes), expectedFiles: 2 };
const plan = await planHandoff(config);
assert.equal(plan.actions.length, 3); assertions++;
await assert.rejects(fs.stat(destinationRoot), { code: 'ENOENT' }); assertions++;
await fs.mkdir(destinationRoot);
await fs.writeFile(path.join(destinationRoot, 'index.html'), payloads[0].data);
await fs.writeFile(path.join(destinationRoot, 'unselected-existing.txt'), 'retain');
const matching = await planHandoff(config);
assert.equal(matching.actions[0].action, 'retain_matching_existing_file'); assertions++;
const completed = await executeHandoff(matching);
assert.equal(completed.result, 'pass'); assertions++;
assert.equal(completed.copiedFiles, 2); assertions++;
assert.equal(completed.retainedMatchingFiles, 1); assertions++;
assert.equal(completed.verifiedDestinationFiles, 3); assertions++;
assert.equal(completed.deletions, 0); assertions++;
assert.equal(completed.completePort, false); assertions++;
assert.equal(completed.actualWorldCreationVerified, false); assertions++;
assert.deepEqual(await fs.readFile(path.join(destinationRoot, 'nested/data.bin')), payloads[1].data); assertions++;
assert.deepEqual(await fs.readFile(path.join(destinationRoot, 'package-manifest.json')), manifestBytes); assertions++;
assert.equal(await fs.readFile(path.join(destinationRoot, 'unselected-existing.txt'), 'utf8'), 'retain'); assertions++;
const repeated = await executeHandoff(await planHandoff(config));
assert.equal(repeated.copiedFiles, 0); assertions++;
assert.equal(repeated.retainedMatchingFiles, 3); assertions++;
const mismatchRoot = path.join(fixtureRoot, 'mismatch');
await fs.mkdir(mismatchRoot);
await fs.writeFile(path.join(mismatchRoot, 'index.html'), 'existing-mismatch');
await assert.rejects(planHandoff({ ...config, destinationRoot: mismatchRoot }), /Existing destination differs/); assertions++;
assert.equal(await fs.readFile(path.join(mismatchRoot, 'index.html'), 'utf8'), 'existing-mismatch'); assertions++;
assert.deepEqual(await fs.readdir(mismatchRoot), ['index.html']); assertions++;
await assert.rejects(planHandoff({ ...config, expectedSha256: '0'.repeat(64) }), /manifest differs/); assertions++;
const plannedBeforeMutation = await planHandoff({ ...config, destinationRoot: path.join(fixtureRoot, 'changed-source-target') });
await fs.writeFile(path.join(sourceRoot, 'package-manifest.json'), Buffer.from(manifestBytes.toString().replace('fixture_only', 'altered_only')));
await assert.rejects(executeHandoff(plannedBeforeMutation), /manifest differs/); assertions++;
await assert.rejects(fs.stat(plannedBeforeMutation.destinationRoot), { code: 'ENOENT' }); assertions++;
await fs.writeFile(path.join(sourceRoot, 'package-manifest.json'), manifestBytes);
let junctionCoverage = 'pass';
const junction = path.join(fixtureRoot, 'linked-source');
try {
  await fs.symlink(sourceRoot, junction, 'junction');
  await assert.rejects(inspectPath(junction), /Symlink\/junction rejected/); assertions++;
  await assert.rejects(planHandoff({ ...config, sourceRoot: junction }), /Symlink\/junction rejected/); assertions++;
} catch (error) {
  if (['EPERM', 'EACCES'].includes(error.code)) junctionCoverage = 'unavailable_under_fixture_permissions';
  else throw error;
}
const report = { result: 'pass', scope: 'staging_only_tiny_runtime_handoff_fixtures', assertions,
  fixtureRoot, fixturePayloadBytes: manifest.totalPackageBytes, junctionCoverage,
  actualRuntimeTransferred: false, fixedRealDestinationTouched: false, deletions: 0,
  realPackageManifestPin: 'eb09bac0ddaf7373b411bcfe7a60d21e4fd4775689e4e7437e07be0283360f39',
  recordedUtc: new Date().toISOString() };
await fs.writeFile(path.join(root, 'runtime-handoff-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
