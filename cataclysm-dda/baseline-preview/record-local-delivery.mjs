import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Parent-authorized bounded delivery evidence; never emits full-game acceptance.
const ownRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(ownRoot);
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fileHash = file => hash(fs.readFileSync(path.join(root, file)));
const web = 'baseline-preview/web/';
const manifestPath = web + 'package-manifest.json';
const manifest = read(manifestPath);
const manifestSha256 = fileHash(manifestPath);
const runtime = read('baseline-preview/package-runtime-verification.json');
const http = read('baseline-preview/local-http-readiness.json');
const serverIdentity = read('baseline-preview/local-node-server-identity.json');
assert.equal(runtime.result, 'pass'); assert.equal(runtime.manifestSha256, manifestSha256);
assert.equal(http.result, 'pass'); assert.equal(http.manifestSha256, manifestSha256);
assert.equal(serverIdentity.pid, http.serverPid);
assert.equal(serverIdentity.localAddress, '127.0.0.1'); assert.equal(serverIdentity.localPort, 8878);
assert.match(serverIdentity.commandLine, /node\.exe.*baseline-preview\\serve-local\.mjs 8878/);
assert.equal(manifest.referenceOnly, true); assert.equal(manifest.completePort, false);
assert.equal(runtime.runtimeAssetEntries, 7938); assert.equal(runtime.verifiedNotices, 60);
const browserPath = process.argv[2];
assert.ok(browserPath && browserPath.startsWith('browser-qa/output/') && browserPath.endsWith('/evidence.json'));
const browserBytes = fs.readFileSync(path.join(root, browserPath));
const browser = JSON.parse(browserBytes);
assert.equal(browser.base, 'http://127.0.0.1:8878/');
assert.equal(hash(Buffer.from(JSON.stringify(browser.package, null, 2) + '\n')), manifestSha256,
  'Browser must have loaded the current verified package manifest.');
assert.ok(browser.requests.length >= 13, 'Actual browser runtime requests are required.');
assert.ok(browser.requests.every(request => new URL(request.url).origin === http.loopbackOrigin));
const observedAt = new Date().toISOString();
const networkSnapshot = { observedAt, sourceEvidencePath: browserPath, sourceEvidenceReadSha256: hash(browserBytes),
  sourceSessionStatusAtRead: browser.status, scope: 'actual_game_page_requests_observed_so_far',
  requests: browser.requests, externalGamePageRequests: [],
  chromeBackgroundServices: 'Chrome stderr separately records Google registration/update-service attempts; these are not game-page runtime requests.' };
const snapshotPath = 'baseline-preview/local-delivery-network-snapshot.json';
fs.writeFileSync(path.join(root, snapshotPath), JSON.stringify(networkSnapshot, null, 2) + '\n');

const notices = read(web + 'notice-manifest.json');
for (const notice of notices) {
  const filename = web + 'notices/' + notice.path;
  assert.equal(fs.statSync(path.join(root, filename)).size, notice.bytes);
  assert.equal(fileHash(filename), notice.sha256);
}
const acquisition = read('acquisition.json');
const integrity = read('upstream-integrity.json');
assert.equal(acquisition.acquisition_completed, true); assert.equal(integrity.result, 'pass');
assert.equal(integrity.matched_files, 9921); assert.equal(integrity.expected_files, 9921);
assert.equal(integrity.tree_sha, manifest.sourceCommit);
assert.equal(fs.statSync(acquisition.source_archive_path).size, acquisition.source_archive_bytes);
assert.ok(fs.statSync(integrity.source).isDirectory());
assert.ok(fs.statSync(path.join(integrity.source, 'src/main.cpp')).isFile());
const rustSources = read(web + 'notices/rust-browser-bridge/source-hashes.json');
for (const source of rustSources) {
  assert.equal(fs.statSync(path.join(root, source.path)).size, source.bytes);
  assert.equal(fileHash(source.path), source.sha256, 'Delivered Rust source differs: ' + source.path);
}
const addedSourcePaths = ['baseline-preview/shell/index.html', 'baseline-preview/shell/baseline-shell.js',
  'baseline-preview/shell/baseline.css', 'baseline-preview/package-local.mjs', 'baseline-preview/engine-selection.mjs',
  'baseline-preview/serve-local.mjs', 'baseline-preview/refresh-shell.mjs', 'engine-build/build-engine.mjs',
  'ja-current/compile-current.mjs', 'ja-current/generated/current-ja.po', 'ja-current/en.json', 'ja-current/ja.json'];
const portSources = addedSourcePaths.map(file => ({ path: file, bytes: fs.statSync(path.join(root, file)).size,
  sha256: file.endsWith('.po') ? null : fileHash(file) }));
const common = { schema_version: 1, recorded_at: observedAt, source_commit: manifest.sourceCommit,
  package_manifest: manifestPath, package_manifest_sha256: manifestSha256, reference_only: true,
  complete_port: false, full_game_browser_verified: false, external_hosting: false };
const delivery = { ...common, result: 'pass', scope: 'bounded_local_node_runtime_delivery_and_observed_startup',
  url: browser.base, served_by_node: true, loopback_only: true, html_served: true,
  wasm_mime_verified: true, javascript_module_mime_verified: true, runtime_assets_verified: true,
  no_external_runtime_requests: true, network_observation_scope: networkSnapshot.scope,
  network_snapshot: snapshotPath, observed_game_page_request_count: browser.requests.length,
  chrome_background_service_attempts_excluded_from_game_page_claim: true,
  server: { pid: http.serverPid, created_utc: serverIdentity.createdUtc,
    executable: serverIdentity.executable, command: serverIdentity.commandLine, bind: serverIdentity.localAddress,
    identity_evidence: 'baseline-preview/local-node-server-identity.json' },
  evidence: { runtime_integrity: 'baseline-preview/package-runtime-verification.json',
    live_http: 'baseline-preview/local-http-readiness.json', browser_observation: browserPath },
  pending: ['complete original game creation/play/save/resume', 'revised mobile viewport and pointer mapping',
    'fresh mobile-first startup', 'full Rust frontend and gameplay semantic text integration'] };
const licenseEvidence = { ...common, result: 'pass', scope: 'bundled_local_reference_assets_notices_and_available_sources',
  asset_manifest_audited: true, port_source_available: true, runtime_asset_entries: 7938, preserved_notices: notices.length,
  asset_exclusions: [], bundled_basic_audio_preserved: true, audio_engine_enabled: false,
  source_audit: 'audit/UPSTREAM-AUDIT.md', asset_inventory: 'baseline-preview/asset-inventory.json',
  notices_manifest: web + 'notice-manifest.json', attribution_page: browser.base + 'attribution.html',
  upstream_source: { path: integrity.source, archive_path: acquisition.source_archive_path,
    archive_sha256: acquisition.source_archive_sha256, prior_integrity: 'upstream-integrity.json',
    tracked_files: 9921, immutable_url: acquisition.immutable_source_zip_url },
  rust_source_files_verified: rustSources.length, rust_source_hash_manifest: web + 'notices/rust-browser-bridge/source-hashes.json',
  port_source_files: portSources,
  license_conditions: ['Project and added shell/translation adaptations: CC BY-SA 3.0; retain attribution, changes and share-alike terms.',
    'Original fonts are unchanged. Retain OFL/Apache notices and Unifont copyright/license metadata, including its font embedding exception.',
    'Bundled tileset notices and sprite credits are retained; compiled dependencies retain their individual notices.'],
  excluded_external_content: ['No paid Mushroom Dream edition acquired.',
    'No unpinned external full soundpack or CO.AG music acquired; bundled Basic assets remain, sound disabled.'],
  source_availability_scope: 'Actual local source tree, translation patch sources and build/package recipes are available in this shared workspace; no external deployment was performed.' };
fs.writeFileSync(path.join(root, 'evidence/local-node-delivery.json'), JSON.stringify(delivery, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'evidence/local-delivery-notices.json'), JSON.stringify(licenseEvidence, null, 2) + '\n');
console.log(JSON.stringify({ result: 'pass', scope: delivery.scope, manifestSha256,
  observedPageRequests: browser.requests.length, verifiedNotices: notices.length, rustSourceFiles: rustSources.length,
  fullGameBrowserVerified: false, output: ['evidence/local-node-delivery.json', 'evidence/local-delivery-notices.json'] }));
