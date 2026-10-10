import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const ownRoot = path.dirname(fileURLToPath(import.meta.url));
const FIXED_DESTINATION = 'C:\\Users\\kit\\gameme\\jnethack\\jrouge\\cataclysm-dda\\baseline-preview\\web';
const MANIFEST_SHA256 = 'eb09bac0ddaf7373b411bcfe7a60d21e4fd4775689e4e7437e07be0283360f39';
const BUFFER_BYTES = 64 * 1024;
const hashBytes = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

export function validateRelativePath(relative) {
  assert.equal(typeof relative, 'string');
  assert.ok(relative.length && !path.isAbsolute(relative) && !/[\\\x00-\x1f:*?"<>|]/.test(relative), 'Unsafe relative file path.');
  for (const part of relative.split('/')) {
    assert.ok(part && part !== '.' && part !== '..' && !/[. ]$/.test(part), 'Unsafe path segment.');
    assert.ok(!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part), 'Windows reserved path segment.');
  }
  assert.notEqual(relative.toLowerCase(), 'package-manifest.json', 'Manifest is copied separately, unchanged.');
  return relative;
}
function contained(root, relative) {
  const result = path.resolve(root, relative);
  assert.ok(result.startsWith(path.resolve(root) + path.sep), 'Path leaves the selected tree.');
  return result;
}
export async function inspectPath(filename, { mayBeMissing = false, file = false } = {}) {
  const absolute = path.resolve(filename);
  const drive = path.parse(absolute).root;
  let current = drive;
  const parts = absolute.slice(drive.length).split(path.sep).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try { stat = await fsp.lstat(current); }
    catch (error) { if (error.code === 'ENOENT' && mayBeMissing) return null; throw error; }
    assert.ok(!stat.isSymbolicLink(), 'Symlink/junction rejected: ' + current);
    if (i < parts.length - 1 || !file) assert.ok(stat.isDirectory(), 'Non-directory ancestor: ' + current);
    else assert.ok(stat.isFile(), 'Only regular files are permitted: ' + current);
  }
  const resolved = await fsp.realpath(absolute);
  assert.ok(samePath(resolved, absolute), 'Resolved path differs from the literal selected tree.');
  return fsp.lstat(absolute);
}
function signature(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
}
async function releaseStream(stream) {
  if (!stream || stream.closed) return;
  const closed = new Promise(resolve => stream.once('close', resolve));
  stream.destroy();
  await closed;
}
export async function hashRegularFile(filename) {
  const before = await inspectPath(filename, { file: true });
  const handle = await fsp.open(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  let stream;
  try {
    const opened = await handle.stat();
    assert.ok(opened.isFile()); assert.equal(signature(opened), signature(before), 'File identity changed before read.');
    const hash = crypto.createHash('sha256'); let bytes = 0;
    stream = handle.createReadStream({ autoClose: false, highWaterMark: BUFFER_BYTES });
    for await (const chunk of stream) {
      hash.update(chunk); bytes += chunk.byteLength;
    }
    assert.equal(signature(await handle.stat()), signature(opened), 'File changed during hash.');
    assert.equal(signature(await inspectPath(filename, { file: true })), signature(opened), 'File path changed during hash.');
    return { bytes, sha256: hash.digest('hex'), signature: signature(opened) };
  } finally { await releaseStream(stream); await handle.close(); }
}
function matches(actual, expected) {
  return actual.bytes === expected.bytes && actual.sha256 === expected.sha256;
}
async function readManifest(sourceRoot, expectedSha256) {
  const filename = contained(sourceRoot, 'package-manifest.json');
  const checked = await hashRegularFile(filename);
  assert.equal(checked.sha256, expectedSha256, 'Source manifest differs from the reviewed pin.');
  // Only the ~29 KiB manifest is read whole. All runtime payload hashes stream.
  const bytes = await fsp.readFile(filename);
  assert.equal(hashBytes(bytes), expectedSha256, 'Source manifest changed after its hash.');
  const manifest = JSON.parse(bytes.toString('utf8'));
  assert.equal(manifest.referenceOnly, true); assert.equal(manifest.baselineOnly, true);
  assert.equal(manifest.completePort, false); assert.equal(manifest.delivery.nodeLocalhostOnly, true);
  assert.equal(manifest.publication.localOnly, true); assert.equal(manifest.publication.siteCreated, false);
  const names = new Set(); let total = 0;
  for (const entry of manifest.files) {
    validateRelativePath(entry.path);
    assert.ok(!names.has(entry.path.toLowerCase()), 'Case-folded duplicate manifest file.');
    names.add(entry.path.toLowerCase());
    assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 && /^[a-f0-9]{64}$/.test(entry.sha256));
    total += entry.bytes;
  }
  assert.equal(total, manifest.totalPackageBytes);
  return { bytes, manifest, file: { path: 'package-manifest.json', bytes: bytes.length, sha256: expectedSha256 } };
}

// Exported core permits tiny fixtures in this staging directory. The CLI below
// has no source/pin override and admits only the one explicitly reviewed target.
export async function planHandoff({ sourceRoot, destinationRoot, expectedSha256, expectedFiles }) {
  assert.ok(!samePath(sourceRoot, destinationRoot), 'Source and destination must be distinct.');
  await inspectPath(sourceRoot);
  await inspectPath(destinationRoot, { mayBeMissing: true });
  const source = await readManifest(sourceRoot, expectedSha256);
  assert.equal(source.manifest.files.length, expectedFiles);
  const files = [...source.manifest.files, source.file];
  const actions = [];
  // Inspect every selected destination before creating anything. A mismatched
  // existing file aborts the entire plan; no overwrite switch is exposed.
  for (const entry of files) {
    const input = contained(sourceRoot, entry.path);
    const checked = await hashRegularFile(input);
    assert.ok(matches(checked, entry), 'Source payload differs from manifest: ' + entry.path);
    const output = contained(destinationRoot, entry.path);
    const existing = await inspectPath(output, { mayBeMissing: true, file: true });
    if (existing) {
      assert.ok(matches(await hashRegularFile(output), entry), 'Existing destination differs; preserve and request root review: ' + entry.path);
    }
    actions.push({ path: entry.path, bytes: entry.bytes, sha256: entry.sha256,
      action: existing ? 'retain_matching_existing_file' : 'create_exclusive_regular_file', sourceSignature: checked.signature });
  }
  await readManifest(sourceRoot, expectedSha256);
  return { sourceRoot, destinationRoot, expectedSha256, expectedFiles, actions,
    sourceCommit: source.manifest.sourceCommit, referenceOnly: true, completePort: false,
    totalPayloadBytes: source.manifest.totalPackageBytes, totalFilesWithUnchangedManifest: files.length,
    sourceManifestStableAfterPlan: true };
}
async function createDirectories(directory) {
  const absolute = path.resolve(directory), drive = path.parse(absolute).root;
  let current = drive;
  for (const part of absolute.slice(drive.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const existing = await inspectPath(current, { mayBeMissing: true });
    if (!existing) {
      await fsp.mkdir(current); // no recursive computed-path operation
      await inspectPath(current);
    }
  }
}
export async function executeHandoff(plan) {
  await readManifest(plan.sourceRoot, plan.expectedSha256);
  // Refresh all guards before any destination write, including source hashes.
  const refreshed = await planHandoff(plan);
  const copied = [];
  for (const entry of refreshed.actions) {
    if (entry.action === 'retain_matching_existing_file') continue;
    const input = contained(plan.sourceRoot, entry.path), output = contained(plan.destinationRoot, entry.path);
    await inspectPath(input, { file: true });
    await createDirectories(path.dirname(output));
    await inspectPath(output, { mayBeMissing: true, file: true });
    const source = await fsp.open(input, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    let destination, inputStream, outputStream;
    try {
      const before = await source.stat();
      assert.equal(signature(before), entry.sourceSignature, 'Source changed after the reviewed plan.');
      // wx never overwrites a file created concurrently or an existing mismatch.
      destination = await fsp.open(output, 'wx', 0o644);
      const hash = crypto.createHash('sha256'); let bytes = 0;
      const meter = new Transform({ highWaterMark: BUFFER_BYTES, transform(chunk, _encoding, callback) {
        hash.update(chunk); bytes += chunk.length; callback(null, chunk);
      } });
      inputStream = source.createReadStream({ autoClose: false, highWaterMark: BUFFER_BYTES });
      outputStream = destination.createWriteStream({ autoClose: false, highWaterMark: BUFFER_BYTES });
      await pipeline(inputStream, meter, outputStream);
      assert.equal(signature(await source.stat()), signature(before), 'Source changed during copy.');
      assert.ok(matches({ bytes, sha256: hash.digest('hex') }, entry), 'Copy input differs from the pin.');
      await destination.sync();
    } finally {
      await releaseStream(inputStream); await releaseStream(outputStream);
      if (destination) await destination.close();
      await source.close();
    }
    // Independent destination read/hash; never trust the copy's input digest.
    assert.ok(matches(await hashRegularFile(output), entry), 'Independent destination verification failed.');
    copied.push(entry.path);
  }
  await readManifest(plan.sourceRoot, plan.expectedSha256);
  for (const entry of refreshed.actions) {
    assert.ok(matches(await hashRegularFile(contained(plan.destinationRoot, entry.path)), entry), 'Final destination differs.');
  }
  return { result: 'pass', scope: 'verified_original_cpp_reference_runtime_handoff',
    sourceRoot: plan.sourceRoot, destinationRoot: plan.destinationRoot,
    manifestSha256: plan.expectedSha256, sourceCommit: plan.sourceCommit,
    copiedFiles: copied.length, retainedMatchingFiles: refreshed.actions.length - copied.length,
    verifiedDestinationFiles: refreshed.actions.length, totalPayloadBytes: plan.totalPayloadBytes,
    sourceManifestStableBeforeAndAfter: true, independentDestinationHashesVerified: true,
    referenceOnly: true, completePort: false, externalPublication: false,
    actualWorldCreationVerified: false, saveResumeVerified: false, mobileVerified: false, wholePortVerified: false,
    stagingServerChanged: false, deletions: 0, recordedUtc: new Date().toISOString() };
}
async function main() {
  const args = process.argv.slice(2);
  assert.ok(args.every(argument => ['--plan', '--execute', '--destination', FIXED_DESTINATION].includes(argument)), 'Unknown handoff option.');
  assert.ok(!(args.includes('--plan') && args.includes('--execute')), 'Choose plan or execute.');
  const destinationIndex = args.indexOf('--destination');
  assert.ok(destinationIndex >= 0 && args[destinationIndex + 1] === FIXED_DESTINATION, 'Explicit exact reviewed destination is required.');
  const execute = args.includes('--execute');
  const config = { sourceRoot: path.join(ownRoot, 'web'), destinationRoot: FIXED_DESTINATION,
    expectedSha256: MANIFEST_SHA256, expectedFiles: 121 };
  const plan = await planHandoff(config);
  for (const [name, bytes, sha256] of [
    ['cataclysm-tiles.js', 498522, '8e41e1903f220bbaf8831a215de66427b166741ca19f2fa01edc0995e0cc74b5'],
    ['cataclysm-tiles.wasm', 134832388, '3db7de7161c00e711828e219b148a376f15297c5fd6ee1213b14d10228a7f666']
  ]) assert.ok(plan.actions.some(entry => entry.path === name && entry.bytes === bytes && entry.sha256 === sha256), 'Original engine pair differs.');
  const result = execute ? await executeHandoff(plan) : { ...plan, result: 'ready_for_root_review',
    scope: 'read_only_runtime_handoff_plan', destinationWrites: 0, referenceOnly: true, completePort: false,
    actualWorldCreationVerified: false, saveResumeVerified: false, mobileVerified: false, wholePortVerified: false };
  // Evidence lives in staging only; no extra payload is placed in web.
  const filename = path.join(ownRoot, execute ? 'runtime-handoff-result.json' : 'runtime-handoff-plan.json');
  await fsp.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, actions: result.actions ? result.actions.length : undefined, reportPath: filename }));
}
if (process.argv[1] && samePath(fileURLToPath(import.meta.url), process.argv[1])) {
  main().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
