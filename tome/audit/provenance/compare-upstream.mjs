#!/usr/bin/env node
/**
 * Compare an extracted official release with every tracked blob at a Git tag.
 * Node 18+, Git; no third-party packages; never writes into either input tree.
 *
 * node compare-upstream.mjs --repo PATH --source PATH --tag tome-1.7.6 \
 *   --expected-commit SHA --archive PATH --expected-archive-sha256 SHA --out DIR
 * Optional --supplemental-root PATH overlays separately unpacked release packages.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readlink, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!key?.startsWith('--') || process.argv[i + 1] === undefined) {
    throw new Error('Arguments must be --name value pairs. See script header.');
  }
  options[key.slice(2)] = process.argv[i + 1];
}
for (const key of ['repo', 'source', 'out']) {
  if (!options[key]) throw new Error(`Missing --${key}`);
}
const repo = path.resolve(options.repo);
const source = path.resolve(options.source);
const supplementalRoot = options['supplemental-root'] ? path.resolve(options['supplemental-root']) : null;
const out = path.resolve(options.out);
const tag = options.tag ?? 'tome-1.7.6';
const concurrency = Number(options.concurrency ?? 4);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
  throw new Error('--concurrency must be an integer from 1 to 32.');
}
for (const input of [repo, source, supplementalRoot].filter(Boolean)) {
  const relative = path.relative(input, out);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Output directory must be outside both read-only input trees.');
  }
}
function git(...args) {
  const result = spawnSync('git', [`--git-dir=${repo}`, ...args], {
    shell: false, windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.toString('utf8')}`);
  return result.stdout;
}
const commit = git('rev-parse', `${tag}^{commit}`).toString('utf8').trim();
if (options['expected-commit'] && commit !== options['expected-commit']) {
  throw new Error(`Commit mismatch: expected ${options['expected-commit']}, got ${commit}`);
}
const objectFormat = git('rev-parse', '--show-object-format').toString('utf8').trim();
if (!['sha1', 'sha256'].includes(objectFormat)) throw new Error(`Unsupported Git object format ${objectFormat}`);
const commitInfo = {
  commit,
  authorDate: git('show', '-s', '--format=%aI', commit).toString('utf8').trim(),
  committerDate: git('show', '-s', '--format=%cI', commit).toString('utf8').trim(),
  subject: git('show', '-s', '--format=%s', commit).toString('utf8').trim(),
  remote: git('config', '--get', 'remote.origin.url').toString('utf8').trim(),
};
const rawTree = git('ls-tree', '-r', '-z', '--full-tree', commit);
const entries = rawTree.toString('utf8').split('\0').filter(Boolean).map(record => {
  const match = /^(\d+) (\S+) ([0-9a-f]+)\t([\s\S]+)$/.exec(record);
  if (!match) throw new Error(`Cannot parse Git tree record ${JSON.stringify(record)}`);
  return { mode: match[1], type: match[2], gitOid: match[3], path: match[4] };
});
entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

function sourcePath(relative, root = source) {
  if (relative.startsWith('/') || relative.split('/').some(part => part === '..') || /[\x00\\:]/.test(relative)) {
    throw new Error(`Unsafe or unrepresentable Git path ${JSON.stringify(relative)}`);
  }
  const result = path.resolve(root, ...relative.split('/'));
  const check = path.relative(root, result);
  if (check.startsWith(`..${path.sep}`) || check === '..' || path.isAbsolute(check)) throw new Error('Path escapes source root');
  return result;
}
function supplementalCandidates(relative) {
  const candidates = [relative];
  const modulePrefix = 'game/modules/tome/';
  const bootPrefix = 'game/engines/default/modules/boot/';
  if (relative.startsWith(modulePrefix)) {
    candidates.push(`${modulePrefix}mod/${relative.slice(modulePrefix.length)}`);
  }
  if (relative.startsWith(bootPrefix)) {
    const suffix = relative.slice(bootPrefix.length);
    candidates.push(`game/modules/boot/${suffix}`, `game/modules/boot/mod/${suffix}`);
  }
  return candidates;
}
async function streamedDigest(file, algorithm, gitBlob = false) {
  const before = await lstat(file);
  if (!before.isFile()) throw new Error('Expected regular file');
  const digest = createHash(algorithm);
  if (gitBlob) digest.update(Buffer.from(`blob ${before.size}\0`, 'ascii'));
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    digest.update(chunk);
    bytes += chunk.length;
  }
  const after = await lstat(file);
  if (bytes !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new Error('File changed while hashing');
  }
  return { hash: digest.digest('hex'), bytes };
}
async function compare(entry) {
  if (entry.type !== 'blob') return { ...entry, status: 'excluded_non_blob', reason: 'Gitlink or non-blob tree entry has no Git blob contents.' };
  let file = sourcePath(entry.path);
  let representation = 'extracted_release';
  let mappedPackagePath = null;
  let stat;
  try { stat = await lstat(file); }
  catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') return { ...entry, status: 'unreadable', error: error.message };
    if (!supplementalRoot) return { ...entry, status: 'missing', reason: 'No file at the raw Git path in the extracted release; may be packaged in a release ZIP or intentionally excluded from the release.' };
    representation = 'unpacked_release_package';
    for (const candidate of supplementalCandidates(entry.path)) {
      file = sourcePath(candidate, supplementalRoot);
      try {
        stat = await lstat(file);
        mappedPackagePath = candidate;
        break;
      } catch (supplementalError) {
        if (supplementalError.code !== 'ENOENT' && supplementalError.code !== 'ENOTDIR') return { ...entry, status: 'unreadable', error: supplementalError.message };
      }
    }
    if (!stat) return { ...entry, status: 'missing', reason: 'No file at the Git path or documented mod/boot package mapping in either extracted release or unpacked package overlay; unopened asset packages and intentionally excluded development files remain possible.' };
  }
  try {
    let digest;
    if (entry.mode === '120000') {
      if (!stat.isSymbolicLink()) return { ...entry, representation, mappedPackagePath, status: 'type_mismatch', actualType: stat.isFile() ? 'regular_file' : 'other' };
      const link = await readlink(file, { encoding: 'buffer' });
      const hash = createHash(objectFormat).update(Buffer.from(`blob ${link.length}\0`, 'ascii')).update(link).digest('hex');
      digest = { hash, bytes: link.length };
    } else {
      if (!stat.isFile()) return { ...entry, representation, mappedPackagePath, status: 'type_mismatch', actualType: stat.isSymbolicLink() ? 'symlink' : 'other' };
      digest = await streamedDigest(file, objectFormat, true);
    }
    return { ...entry, representation, mappedPackagePath, archiveOid: digest.hash, bytes: digest.bytes, status: digest.hash === entry.gitOid ? 'match' : 'content_mismatch' };
  } catch (error) { return { ...entry, representation, mappedPackagePath, status: 'unreadable', error: error.message }; }
}
async function mapLimited(items, fn) {
  const result = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      result[index] = await fn(items[index]);
    }
  }));
  return result;
}
const comparison = await mapLimited(entries, compare);
const tracked = new Set(entries.map(entry => entry.path));
const archiveOnly = [];
let archiveFileCount = 0;
let archiveFileBytes = 0;
let archiveDirectoryCount = 0;
async function walk(directory, relative = '') {
  const children = await readdir(directory, { withFileTypes: true });
  children.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const child of children) {
    const childRelative = relative ? `${relative}/${child.name}` : child.name;
    const file = path.join(directory, child.name);
    if (child.isDirectory()) { archiveDirectoryCount++; await walk(file, childRelative); continue; }
    const stat = await lstat(file);
    const kind = stat.isSymbolicLink() ? 'symlink' : stat.isFile() ? 'regular_file' : 'other';
    archiveFileCount++;
    archiveFileBytes += stat.size;
    if (!tracked.has(childRelative)) archiveOnly.push({ path: childRelative, kind, bytes: stat.size });
  }
}
await walk(source);
archiveOnly.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const statusCounts = {};
for (const entry of comparison) statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;
const representationCounts = {};
for (const entry of comparison) if (entry.representation) representationCounts[entry.representation] = (representationCounts[entry.representation] ?? 0) + 1;
function groupTopLevel(items) {
  const result = {};
  for (const item of items) {
    const top = item.path.includes('/') ? item.path.split('/')[0] : '(root files)';
    result[top] = (result[top] ?? 0) + 1;
  }
  return result;
}
const exclusions = comparison.filter(item => item.status !== 'match');
const caseMap = new Map();
const caseCollisions = [];
for (const entry of entries) {
  const folded = entry.path.toLowerCase();
  if (caseMap.has(folded) && caseMap.get(folded) !== entry.path) caseCollisions.push([caseMap.get(folded), entry.path]);
  else caseMap.set(folded, entry.path);
}
let archive = null;
if (options.archive) {
  const file = path.resolve(options.archive);
  const digest = await streamedDigest(file, 'sha256');
  archive = {
    path: file,
    sha256: digest.hash,
    bytes: digest.bytes,
    expectedSha256: options['expected-archive-sha256'] ?? null,
    expectedHashMatches: options['expected-archive-sha256'] ? digest.hash === options['expected-archive-sha256'] : null,
    acquisitionUrl: 'https://te4.org/dl/t-engine/t-engine4-src-1.7.6.tar.bz2',
  };
}
const audit = {
  schemaVersion: 1,
  method: 'git ls-tree -r -z --full-tree; compare each blob to a streaming hash of ASCII blob + space + byte length + NUL + raw file bytes; package namespace mappings recorded per file; no source input writes',
  documentedPackageMappings: {
    'game/modules/tome/<path>': ['game/modules/tome/<path>', 'game/modules/tome/mod/<path>'],
    'game/engines/default/modules/boot/<path>': ['game/modules/boot/<path>', 'game/modules/boot/mod/<path>'],
  },
  inputs: { repository: repo, extractedSource: source, supplementalRoot, tag, objectFormat, ...commitInfo, archive },
  summary: {
    gitTrackedEntries: entries.length,
    gitTrackedBlobs: entries.filter(item => item.type === 'blob').length,
    statusCounts, representationCounts,
    archiveFileCount, archiveFileBytes, archiveDirectoryCount,
    archiveOnlyCount: archiveOnly.length,
    missingByTopLevel: groupTopLevel(comparison.filter(item => item.status === 'missing')),
    contentMismatchByTopLevel: groupTopLevel(comparison.filter(item => item.status === 'content_mismatch')),
    archiveOnlyByTopLevel: groupTopLevel(archiveOnly),
    windowsCaseCollisions: caseCollisions,
    allTrackedBlobsMatch: comparison.every(item => item.type !== 'blob' || item.status === 'match'),
  },
  trackedBlobComparison: comparison,
  mismatchesAndExclusions: exclusions,
  archiveOnly,
};
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
await writeFile(path.join(out, 'summary.json'), `${JSON.stringify({ inputs: audit.inputs, summary: audit.summary }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(audit.summary, null, 2));
console.log(`Audit written to ${path.join(out, 'audit.json')}`);
if (archive && archive.expectedHashMatches === false) process.exitCode = 2;
if (comparison.some(item => ['unreadable', 'type_mismatch'].includes(item.status))) process.exitCode = 3;
