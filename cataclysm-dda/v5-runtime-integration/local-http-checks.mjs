import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadV5Policy } from './policy-bridge.mjs';
import { prepareV5Assets } from './v5-loader.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const base = new URL('http://127.0.0.1:8878/');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = fs.readFileSync(path.join(root, 'preview/runtime-manifest.json'));
const manifest = JSON.parse(manifestBytes);
const files = [...manifest.files, { file: 'runtime-manifest.json', bytes: manifestBytes.length, sha256: hash(manifestBytes) }];
const fetched = [];
for (const pin of files) {
  const url = new URL('v5/' + pin.file, base);
  const response = await fetch(url, { cache: 'no-store', redirect: 'error' }); assert.equal(response.status, 200);
  const data = new Uint8Array(await response.arrayBuffer()); assert.equal(data.length, pin.bytes); assert.equal(hash(data), pin.sha256);
  fetched.push({ file: pin.file, status: response.status, bytes: data.length, sha256: hash(data), contentType: response.headers.get('content-type') });
}
const { policyArtifact } = await import('./preview/v5-policy-artifact.mjs');
const policy = await loadV5Policy({ ...policyArtifact, url: new URL('v5/v5-policy.wasm', base), cryptoImpl: webcrypto });
const prepared = await prepareV5Assets(policy, { baseUrl: new URL('v5/assets/', base), cryptoImpl: webcrypto });
assert.equal(prepared.files.length, 6);
const original = [];
for (const [file, bytes, sha256] of [
  ['index.html', 3346, 'fe63e838a93e42fcd45a1b7707d2cb9c1356787198ef391822a313c3b1844f0c'],
  ['package-manifest.json', 30768, 'eb09bac0ddaf7373b411bcfe7a60d21e4fd4775689e4e7437e07be0283360f39']
]) {
  const response = await fetch(new URL(file, base), { cache: 'no-store', redirect: 'error' });
  assert.equal(response.status, 200); const data = new Uint8Array(await response.arrayBuffer());
  assert.equal(data.length, bytes); assert.equal(hash(data), sha256); original.push({ file, status: 200, sha256 });
}
const originalHeads = [];
for (const file of ['cataclysm-tiles.data', 'cataclysm-tiles.wasm', 'baseline.css', 'favicon.ico', 'attribution.html']) {
  const response = await fetch(new URL(file, base), { method: 'HEAD', redirect: 'error' });
  assert.equal(response.status, 200); originalHeads.push({ file, status: 200, contentType: response.headers.get('content-type') });
}
const result = { schema: 1, checkedAt: new Date().toISOString(), status: 'passed',
  url: new URL('v5/index.html', base).href, localOnly: true, files: fetched,
  actualHttpPolicyExecuted: true, actualSixHttpAssetDigestsAccepted: true,
  originalSmallHttpHashes: original, originalSiblingHeadResponses: originalHeads,
  originalCppMainExecuted: false, originalEngineRendererExecuted: false,
  actualBrowserRestoreExecuted: false, fullGameValidated: false };
fs.writeFileSync(path.join(root, 'LOCAL-HTTP-CHECKS.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, files: fetched.length, url: result.url,
  actualHttpPolicyExecuted: true, actualBrowserExecuted: false, fullGameValidated: false }));
