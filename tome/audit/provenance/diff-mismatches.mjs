#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const [auditFile, outputDirectory] = process.argv.slice(2);
if (!auditFile || !outputDirectory) throw new Error('Usage: node diff-mismatches.mjs AUDIT_JSON OUTPUT_DIRECTORY');
const audit = JSON.parse(await readFile(auditFile, 'utf8'));
const out = path.resolve(outputDirectory);
for (const input of [audit.inputs.repository, audit.inputs.extractedSource, audit.inputs.supplementalRoot].filter(Boolean)) {
  const relative = path.relative(path.resolve(input), out);
  if (relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) throw new Error('Output must be outside upstream inputs');
}
await mkdir(out, { recursive: true });
const summaries = [];
for (const entry of audit.exactContentMismatches ?? audit.trackedBlobComparison.filter(item => item.status === 'content_mismatch')) {
  const label = entry.path.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const expected = spawnSync('git', [`--git-dir=${audit.inputs.repository}`, 'cat-file', 'blob', entry.gitOid], { shell: false, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (expected.error || expected.status !== 0) throw expected.error ?? new Error(expected.stderr.toString('utf8'));
  const actualRoot = entry.representation === 'unpacked_release_package' ? audit.inputs.supplementalRoot : audit.inputs.extractedSource;
  const actual = await readFile(path.join(actualRoot, ...(entry.mappedPackagePath ?? entry.path).split('/')));
  const expectedFile = path.join(out, `${label}.git`);
  const actualFile = path.join(out, `${label}.release`);
  await writeFile(expectedFile, expected.stdout);
  await writeFile(actualFile, actual);
  const diff = spawnSync('git', ['--no-pager', 'diff', '--no-index', '--text', '--', expectedFile, actualFile], { shell: false, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (diff.error || ![0, 1].includes(diff.status)) throw diff.error ?? new Error(diff.stderr.toString('utf8'));
  const diffFile = path.join(out, `${label}.diff`);
  await writeFile(diffFile, diff.stdout);
  const releaseStartsWithGitBytes = actual.subarray(0, expected.stdout.length).equals(expected.stdout);
  const appendedBytes = releaseStartsWithGitBytes ? actual.subarray(expected.stdout.length) : null;
  summaries.push({
    path: entry.path, gitOid: entry.gitOid, releaseOid: entry.archiveOid,
    gitBytes: expected.stdout.length, releaseBytes: actual.length,
    releaseStartsWithGitBytes,
    appendedBytesHex: appendedBytes ? appendedBytes.toString('hex') : null,
    appendedUtf8: appendedBytes ? appendedBytes.toString('utf8') : null,
    expectedFile, actualFile, diffFile,
  });
  console.log(diff.stdout.toString('utf8'));
}
await writeFile(path.join(out, 'mismatch-diffs.json'), `${JSON.stringify(summaries, null, 2)}\n`, 'utf8');
