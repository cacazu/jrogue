import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Curated copy only: never touch a shared Git index or another game's folder.
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('usage: node stage-delivery.mjs SOURCE CATACLYSM_DDA_DESTINATION');
const root = path.resolve(source);
const dest = path.resolve(destination);
if (path.basename(dest).toLowerCase() !== 'cataclysm-dda' || path.basename(path.dirname(dest)).toLowerCase() !== 'jrouge') throw new Error('destination must be the explicitly requested jrouge/cataclysm-dda folder');
const directories = ['audit', 'docs', 'tools', 'inventory-tools', 'rust-contracts', 'domain-milestone', 'rng-adapter', 'ja-completion', 'catalog-reconcile', 'ja-current', 'baseline-preview', 'rust-browser-bridge', 'browser-qa', 'engine-build', 'integration-overlay', 'semantic-runtime-catalog', 'semantic-plural-slice', 'semantic-parameter-slice', 'cosmetic-purity-overlay', 'help-semantic-slice', 'presentation-snapshot-overlay', 'determinism-audit', 'optimizer-diagnosis', 'evidence', 'input-context-live-slice', 'semantic-display-live-slice', 'v5-runtime-integration', 'full-engine-overlay-plan', 'native-cosmetic-parity'];
const roots = ['README.md', '.gitignore', 'acquisition.json', 'upstream-integrity.json', 'progress.json', 'completion-gates.json', 'publication-gates.json'];
const excluded = new Set(['target', 'owned-target', 'owned-build', 'dist', 'node_modules', 'cache', 'ports', 'objects', 'generated', 'build', 'emcache', 'browser-profiles', 'profiles', '__pycache__', '.git', '.sites-runtime']);
const files = [];
async function collect(relative) {
  for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const child = path.join(relative, item.name);
    if (item.isDirectory()) {
      // Full-engine serial execution contains live logs and large per-stage
      // archives. Preserve those in the execution workspace; deliver stable
      // source packets, success receipts and the timed compact progress proof.
      if (relative.split(path.sep)[0] === 'full-engine-overlay-plan' && item.name === 'execution') continue;
      if (!excluded.has(item.name) && !item.name.startsWith('objects-') && !item.name.startsWith('cache-')) await collect(child);
    } else if (item.isFile()) {
      const smallReviewedInventory = child === path.join('determinism-audit', 'occurrences.jsonl');
      if ((item.name.endsWith('.jsonl') && !smallReviewedInventory) || item.name === '.emscripten' || item.name.startsWith('.env')) continue;
      // Full engine output is staged through its separately verified local
      // HTML/runtime package. Unfinished JS/WASM is not a playable deliverable.
      if (relative.split(path.sep)[0] === 'engine-build' && relative.split(path.sep).includes('output')) continue;
      // Browser run directories contain changing telemetry and save exports.
      // Verified summaries/screenshots are handed off through evidence instead.
      if (relative === 'browser-qa' + path.sep + 'output' || relative.startsWith('browser-qa' + path.sep + 'output' + path.sep)) continue;
      if (relative.startsWith('baseline-preview' + path.sep + 'output')) continue;
      if (relative === 'baseline-preview' + path.sep + 'web' || relative.startsWith('baseline-preview' + path.sep + 'web' + path.sep)) continue;
      // The verified v5 runtime is separately copied to baseline-preview/web/v5.
      // Keep its source, accepted small WASM and proofs, not a second web copy.
      if (relative.split(path.sep)[0] === 'v5-runtime-integration' && relative.split(path.sep).includes('preview')) continue;
      files.push(child);
    }
  }
}
for (const directory of directories) {
  try { await collect(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
for (const file of roots) {
  try { await readFile(path.join(root, file)); files.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
// Retain the separately GNU-verified Japanese legacy catalog as a local
// artifact. This does not establish semantic or real-game runtime coverage.
const verifiedCatalog = path.join('ja-current', 'generated', 'lang', 'mo', 'ja', 'LC_MESSAGES', 'cataclysm-dda.mo');
try {
  const bytes = await readFile(path.join(root, verifiedCatalog));
  const progress = JSON.parse(await readFile(path.join(root, 'progress.json'), 'utf8'));
  const expected = progress.current_japanese_catalog?.mo_sha256;
  if (!expected || createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('verified Japanese MO digest mismatch');
  files.push(verifiedCatalog);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const copied = [];
for (const file of files.sort()) {
  const from = path.join(root, file), to = path.join(dest, file);
  if (!to.startsWith(dest + path.sep)) throw new Error('copy escapes the requested game folder');
  const bytes = await readFile(from);
  if (file === path.join('determinism-audit', 'occurrences.jsonl') && createHash('sha256').update(bytes).digest('hex') !== '1507e01248fe85ce955152ae5e45a53ea1a4db8836fbfcf3a736c2796fee1e8c') throw new Error('reviewed RNG occurrence inventory digest mismatch');
  await mkdir(path.dirname(to), { recursive: true });
  // The recorded digest must describe exactly the bytes delivered, even if a
  // producer updates a source-side evidence file during collection.
  await writeFile(to, bytes);
  copied.push({ path: file.split(path.sep).join('/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const manifest = { schema_version: 1, copied_at: new Date().toISOString(), source: root, destination: dest, files: copied, count: copied.length, bytes: copied.reduce((total, item) => total + item.bytes, 0), pristine_upstream_copied_or_changed: false, shared_git_operations: false, active_full_engine_execution_archives_copied: false, full_engine_execution_evidence: 'Stable success receipts and timed compact progress snapshot; raw per-stage history retained in execution workspace.', whole_game_accepted: false };
await writeFile(path.join(dest, 'delivery-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ count: manifest.count, bytes: manifest.bytes, destination: dest }));
