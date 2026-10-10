import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const originalPath = 'browser-qa/compilation-preparation-verification.json';
const originalBytes = await readFile(originalPath);
const original = JSON.parse(originalBytes);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const artifacts = [];
for (const prior of original.artifacts) {
  const bytes = await readFile(prior.path);
  const current = { path: prior.path, bytes: bytes.length, sha256: sha(bytes),
    previousSha256: prior.sha256, unchanged: sha(bytes) === prior.sha256 };
  if (prior.path !== 'docs/BROWSER-MEMORY-RECOVERY.md' && !current.unchanged) {
    throw new Error('Unexpected change to syntax/source-checked artifact: ' + prior.path);
  }
  artifacts.push(current);
}
const record = {
  schema: 'cdda-browser-preparation-document-fingerprint-refresh', version: 1,
  checkedAt: new Date().toISOString(), originalVerification: { path: originalPath, sha256: sha(originalBytes), checkedAt: original.checkedAt },
  browserStarted: false, compilerStarted: false, serverStarted: false,
  operation: 'Refresh source/document hashes only; prior syntax/source results apply to unchanged harness artifacts.',
  experimentalMode: original.experimentalMode, chromeArgument: original.chromeArgument,
  installedExactV8SourceTagVerified: false, experimentalMemoryBenefitMeasured: false,
  guardLimits: original.guardLimits, rootHeavyWindowRequired: true, automaticRetry: false,
  artifacts
};
const stamp = record.checkedAt.replaceAll(':', '-').replaceAll('.', '-');
const output = 'browser-qa/compilation-preparation-doc-refresh-' + stamp + '.json';
await writeFile(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
await writeFile('browser-qa/compilation-preparation-current.json', JSON.stringify({
  path: output, sha256: sha(await readFile(output)), checkedAt: record.checkedAt,
  originalVerification: record.originalVerification, browserStarted: false
}, null, 2) + '\n');
console.log(JSON.stringify({ output, sha256: sha(await readFile(output)), artifacts }, null, 2));
