import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ownerRoot = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(ownerRoot, 'web');
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
const hash = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const manifestPath = path.join(webRoot, 'package-manifest.json');
const manifest = read(manifestPath);
assert.equal(manifest.sourceCommit, '7b2efa5cea38e4d4d97dd0e63b28b9148623da59');
assert.equal(manifest.baselineOnly, true);
assert.equal(manifest.referenceOnly, true);
assert.equal(manifest.completePort, false);
assert.equal(manifest.delivery.nodeLocalhostOnly, true);
assert.equal(manifest.selectedEngine.candidateAttempt, 'attempt-2');
assert.equal(manifest.selectedEngine.ready, true);
assert.equal(manifest.runtimeAssets.files, 7938);
assert.equal(manifest.runtimeAssets.bytes, 175162548);
assert.equal(manifest.compiledJapaneseMo.sha256, '336dc66ccd4d1e828832a38756cddcc165e0f1af917f546752b5655ff02705e7');
assert.equal(manifest.rustBrowserBridge.wasmSha256, '0dadaa2a2d1f133b39f0ee3265c9ba65d4a601c6ce274ae6d4b83f1b40d9d835');
const filenames = new Set();
let verifiedBytes = 0;
for (const entry of manifest.files) {
  assert.equal(filenames.has(entry.path), false, 'Duplicate manifest file: ' + entry.path);
  filenames.add(entry.path);
  const filename = path.resolve(webRoot, entry.path);
  assert.ok(filename.startsWith(webRoot + path.sep), 'Manifest path leaves the package.');
  assert.equal(fs.lstatSync(filename).isFile(), true);
  assert.equal(fs.statSync(filename).size, entry.bytes, 'Size changed: ' + entry.path);
  assert.equal(hash(filename), entry.sha256, 'Hash changed: ' + entry.path);
  verifiedBytes += entry.bytes;
}
assert.equal(verifiedBytes, manifest.totalPackageBytes);
for (const name of ['index.html', 'baseline-shell.js', 'baseline.css', 'cataclysm-tiles.js', 'cataclysm-tiles.wasm',
  'cataclysm-tiles.data.js', 'cataclysm-tiles.data', 'attribution.html', 'notice-manifest.json',
  'locales/en.json', 'locales/ja.json', 'rust-browser-bridge/cdda_rust_browser_bridge.wasm']) assert.ok(filenames.has(name), name);
for (const artifact of manifest.selectedEngine.artifacts) {
  assert.equal(hash(path.join(webRoot, artifact.name)), artifact.sha256, 'Selected engine copy differs.');
}
const notices = read(path.join(webRoot, 'notice-manifest.json'));
for (const entry of notices) {
  const filename = path.resolve(webRoot, 'notices', entry.path);
  assert.ok(filename.startsWith(path.join(webRoot, 'notices') + path.sep));
  assert.equal(fs.statSync(filename).size, entry.bytes);
  assert.equal(hash(filename), entry.sha256);
}
const sourceVerification = read(path.join(ownerRoot, 'packaging-verification.json'));
assert.equal(sourceVerification.passed, true);
assert.equal(sourceVerification.metadataEntries, 7938);
assert.equal(sourceVerification.allDataAndGfxFilesPresent, true);
assert.equal(sourceVerification.allSourceAssetSizesMatched, true);
assert.equal(sourceVerification.compiledJapaneseMoPresent, true);
const report = { result:'pass', scope:'actual_local_original_engine_package_integrity',
  sourceCommit:manifest.sourceCommit, manifestPath, manifestSha256:hash(manifestPath),
  verifiedFiles:filenames.size, verifiedBytes, verifiedNotices:notices.length,
  runtimeAssetEntries:manifest.runtimeAssets.files, compressedDataBytes:fs.statSync(path.join(webRoot,'cataclysm-tiles.data')).size,
  wasmSha256:hash(path.join(webRoot,'cataclysm-tiles.wasm')), javascriptSha256:hash(path.join(webRoot,'cataclysm-tiles.js')),
  referenceOnly:true,completePort:false, browserFlowsVerified:false, recordedUtc:new Date().toISOString() };
fs.writeFileSync(path.join(ownerRoot,'package-runtime-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
