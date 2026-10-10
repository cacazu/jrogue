// DCSS audit artifact verification, added 2026-10-02. GPL-2.0-or-later.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'docs', 'inventory');
const upstream = path.join(root, 'upstream');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8'));
const superFiles = JSON.parse(fs.readFileSync(path.join(directory, 'files.json'), 'utf8'));
const dependencyFiles = JSON.parse(fs.readFileSync(path.join(directory, 'submodule-files.json'), 'utf8'));
const fail = message => { throw new Error(message); };
for (const row of [...superFiles, ...dependencyFiles]) {
  const bytes = fs.readFileSync(path.join(upstream, row.path));
  if (bytes.length !== row.bytes || sha(bytes) !== row.sha256) fail(`Source hash mismatch: ${row.path}`);
}
if (superFiles.length !== summary.tracked_files || dependencyFiles.length !== summary.dependency_tracked_files) fail('Tracked file count mismatch');
if (summary.submodules.some(row => !row.pin_verified || !row.worktree_clean)) fail('Unverified or modified dependency');
const sources = new Map();
function source(p) {
  if (!sources.has(p)) {
    const content = fs.readFileSync(path.join(upstream, p), 'utf8');
    const newlines = [];
    for (let i = 0; i < content.length; i++) if (content[i] === '\n') newlines.push(i);
    sources.set(p, { content, newlines });
  }
  return sources.get(p);
}
function lineAt(newlines, offset) {
  let lo = 0, hi = newlines.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (newlines[mid] < offset) lo = mid + 1; else hi = mid; }
  return lo + 1;
}
const artifacts = [];
for (const artifact of summary.artifacts) {
  const compressed = fs.readFileSync(path.join(directory, artifact.file));
  if (compressed.length !== artifact.bytes || sha(compressed) !== artifact.sha256) fail(`Compressed hash mismatch: ${artifact.file}`);
  const digest = crypto.createHash('sha256');
  let bytes = 0, rows = 0;
  const kind = artifact.file.replace(/\.jsonl\.gz$/, '');
  const seen = new Set();
  const input = fs.createReadStream(path.join(directory, artifact.file)).pipe(createGunzip());
  input.on('data', chunk => { digest.update(chunk); bytes += chunk.length; });
  for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
    const row = JSON.parse(line);
    const id = sha(`${row.source}\0${row.offset}\0${kind}`).slice(0, 20);
    if (row.discovery_id !== id || seen.has(id)) fail(`Invalid/duplicate discovery locator: ${artifact.file}:${rows + 1}`);
    seen.add(id);
    const original = source(row.source);
    if (original.content.slice(row.offset, row.offset + row.raw.length) !== row.raw) fail(`Source occurrence mismatch: ${row.source}:${row.line}`);
    if (lineAt(original.newlines, row.offset) !== row.line) fail(`Source line mismatch: ${row.source}:${row.line}`);
    rows++;
  }
  if (rows !== artifact.rows || bytes !== artifact.uncompressed_bytes || digest.digest('hex') !== artifact.uncompressed_sha256) fail(`Raw count/hash mismatch: ${artifact.file}`);
  artifacts.push({ file: artifact.file, rows, verified: true });
}
const features = JSON.parse(fs.readFileSync(path.join(directory, 'features.json'), 'utf8'));
for (const value of Object.values(features)) {
  if (Array.isArray(value)) {
    for (const row of value) if (!fs.existsSync(path.join(upstream, row.source))) fail(`Missing feature source: ${row.source}`);
  } else if (typeof value === 'object' && value.source && !fs.existsSync(path.join(upstream, value.source))) fail(`Missing enum source: ${value.source}`);
}
const result = { result: 'pass', upstream_commit: summary.upstream_commit, verified_source_files: superFiles.length + dependencyFiles.length, verified_source_bytes: summary.tracked_bytes + summary.dependency_tracked_bytes, verified_occurrences: artifacts.reduce((sum, row) => sum + row.rows, 0), artifacts, scope: 'Source file hashes, exact dependency pins recorded in inventory, compressed/raw artifact hashes and row counts, unique discovery locators, original source offsets/lines, feature reference existence; no gameplay or localization parity claim.' };
fs.writeFileSync(path.join(directory, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
