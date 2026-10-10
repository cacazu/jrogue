import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Refresh bounded frontend files without another asset pack or engine build.
const root = path.dirname(fileURLToPath(import.meta.url));
const reason = process.argv[2];
if (!/^[a-z0-9-]+$/.test(reason || '')) throw new Error('Provide a named frontend revision.');
const web = path.join(root, 'web');
const manifestPath = path.join(web, 'package-manifest.json');
const hash = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const previous = fs.readFileSync(manifestPath);
const manifest = JSON.parse(previous.toString('utf8'));
assert.equal(manifest.referenceOnly, true); assert.equal(manifest.completePort, false);
for (const name of ['cataclysm-tiles.js', 'cataclysm-tiles.wasm', 'cataclysm-tiles.data', 'cataclysm-tiles.data.js']) {
  const entry = manifest.files.find(file => file.path === name);
  assert.equal(hash(path.join(web, name)), entry.sha256, 'Engine/data changed before shell refresh.');
}
const backupPath = path.join(root, 'package-manifest.before-' + reason + '.json');
fs.writeFileSync(backupPath, previous, { flag:'wx' });
const changes = [];
for (const name of ['baseline-shell.js', 'baseline.css', 'index.html']) {
  const entry = manifest.files.find(file => file.path === name);
  const source = path.join(root, 'shell', name);
  const updated = hash(source);
  if (entry.sha256 === updated) continue;
  changes.push({ path:name, priorSha256:entry.sha256, sha256:updated });
  fs.copyFileSync(source, path.join(web,name));
  entry.sha256 = updated; entry.bytes = fs.statSync(source).size;
}
manifest.totalPackageBytes = manifest.files.reduce((sum,file) => sum + file.bytes,0);
manifest.frontendRevisions = [...(manifest.frontendRevisions || []), { reason, recordedUtc:new Date().toISOString(),
  priorManifestSha256:crypto.createHash('sha256').update(previous).digest('hex'), changes,
  engineAndPackedDataUnchanged:true }];
fs.writeFileSync(manifestPath, JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({ reason, changes, manifestSha256:hash(manifestPath), engineAndPackedDataUnchanged:true }));
