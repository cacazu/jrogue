import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// HTTP readiness only: actual native flows and browser requests have their own QA.
const root = path.dirname(fileURLToPath(import.meta.url));
const origin = 'http://127.0.0.1:8878';
const manifestBytes = fs.readFileSync(path.join(root, 'web/package-manifest.json'));
const manifest = JSON.parse(manifestBytes);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const checks = [['/', 'index.html', 'text/html'],
  ['/cataclysm-tiles.wasm', 'cataclysm-tiles.wasm', 'application/wasm'],
  ['/cataclysm-tiles.js', 'cataclysm-tiles.js', 'text/javascript'],
  ['/cataclysm-tiles.data', 'cataclysm-tiles.data', 'application/octet-stream'],
  ['/cataclysm-tiles.data.js', 'cataclysm-tiles.data.js', 'text/javascript'],
  ['/rust-browser-bridge/browser-bridge.mjs', 'rust-browser-bridge/browser-bridge.mjs', 'text/javascript'],
  ['/rust-browser-bridge/cdda_rust_browser_bridge.wasm', 'rust-browser-bridge/cdda_rust_browser_bridge.wasm', 'application/wasm']];
const runtimeHeaders = [];
for (const [route, file, mime] of checks) {
  const response = await fetch(origin + route, { method: 'HEAD', redirect: 'error' });
  assert.equal(response.status, 200, route);
  assert.equal(new URL(response.url).origin, origin);
  assert.equal(response.headers.get('content-type').split(';')[0], mime, route);
  assert.equal(Number(response.headers.get('content-length')), manifest.files.find(entry => entry.path === file).bytes, route);
  runtimeHeaders.push({ file: route, status: response.status, contentType: response.headers.get('content-type'),
    contentLength: Number(response.headers.get('content-length')) });
}
const liveManifest = await fetch(origin + '/package-manifest.json', { redirect: 'error' });
assert.equal(hash(Buffer.from(await liveManifest.arrayBuffer())), hash(manifestBytes));
for (const file of ['index.html', 'baseline-shell.js', 'baseline.css']) {
  const response = await fetch(origin + '/' + file, { redirect: 'error' });
  assert.equal(response.status, 200);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())), manifest.files.find(entry => entry.path === file).sha256, file);
}
const report = { result: 'pass', scope: 'local_node_http_readiness', recordedUtc: new Date().toISOString(),
  servedByNode: true, loopbackOrigin: origin, serverPid: Number(process.argv[2]) || null,
  manifestSha256: hash(manifestBytes), htmlServed: true, wasmMimeVerified: true,
  javascriptModuleMimeVerified: true, liveManifestAndShellHashesVerified: true, runtimeHeaders,
  actualBrowserFlowsVerified: false, noExternalRuntimeRequestsBrowserVerification: 'pending',
  priorMjsMimeFailureCorrected: true };
fs.writeFileSync(path.join(root, 'local-http-readiness.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
