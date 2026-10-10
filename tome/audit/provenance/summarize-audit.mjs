#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const auditFile = process.argv[2];
const outputFile = process.argv[3];
if (!auditFile || !outputFile) throw new Error('Usage: node summarize-audit.mjs AUDIT_JSON OUTPUT_JSON');
const audit = JSON.parse(await readFile(auditFile, 'utf8'));
function count(items, key) {
  const counts = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}
const missing = audit.trackedBlobComparison.filter(item => item.status === 'missing');
const matched = audit.trackedBlobComparison.filter(item => item.status === 'match');
const textCodeExtensions = new Set(['.lua', '.c', '.h', '.cpp', '.cc', '.hpp', '.js', '.glsl', '.frag', '.vert']);
const unresolvedCode = missing.filter(item => textCodeExtensions.has(path.posix.extname(item.path).toLowerCase()));
const developerRoots = new Set(['documentation', 'ideas', 'tiled-maps', 'utils']);
const developmentExclusions = missing.filter(item => developerRoots.has(item.path.split('/')[0]) || item.path === '.gitignore');
const isMediaTree = item => /(^|\/)data\/(gfx|music)\//.test(item.path);
const isDevelopment = item => developerRoots.has(item.path.split('/')[0]) || item.path === '.gitignore';
const otherMissing = missing.filter(item => !isMediaTree(item) && !isDevelopment(item));
const codeOutsideMediaAndDevelopment = unresolvedCode.filter(item => !isMediaTree(item) && !isDevelopment(item));
const findings = {
  auditFile: path.resolve(auditFile),
  exactContentMismatchCount: audit.trackedBlobComparison.filter(item => item.status === 'content_mismatch').length,
  matchedByComponent: count(matched, item => item.path.split('/').slice(0, 3).join('/')),
  matchedByExtension: count(matched, item => path.posix.extname(item.path) || '(no extension)'),
  missingByComponent: count(missing, item => item.path.split('/').slice(0, 3).join('/')),
  missingByExtension: count(missing, item => path.posix.extname(item.path) || '(no extension)'),
  developmentExclusionCount: developmentExclusions.length,
  missingGraphicsTreeCount: missing.filter(item => /(^|\/)data\/gfx\//.test(item.path)).length,
  missingMusicTreeCount: missing.filter(item => /(^|\/)data\/music\//.test(item.path)).length,
  unresolvedCodeByComponent: count(unresolvedCode, item => item.path.split('/').slice(0, 3).join('/')),
  unresolvedCodePaths: unresolvedCode.map(item => item.path),
  missingOutsideMediaAndDevelopmentCount: otherMissing.length,
  missingOutsideMediaAndDevelopmentByPrefix: count(otherMissing, item => item.path.split('/').slice(0, 5).join('/')),
  missingOutsideMediaAndDevelopmentPaths: otherMissing.map(item => item.path),
  missingCodeOutsideMediaAndDevelopmentCount: codeOutsideMediaAndDevelopment.length,
  missingCodeOutsideMediaAndDevelopmentPaths: codeOutsideMediaAndDevelopment.map(item => item.path),
  exactContentMismatches: audit.trackedBlobComparison.filter(item => item.status === 'content_mismatch'),
  releasePackages: audit.archiveOnly,
};
await writeFile(outputFile, `${JSON.stringify(findings, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  ...findings,
  matchedByComponent: undefined,
  unresolvedCodePaths: undefined,
  missingOutsideMediaAndDevelopmentPaths: undefined,
  missingCodeOutsideMediaAndDevelopmentPaths: undefined,
}, null, 2));
