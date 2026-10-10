import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveIntegration } from '../tools/serve-integration.mjs';

const results = resolve(dirname(fileURLToPath(import.meta.url)), 'results');
const service = await serveIntegration();
const checks = [];
try {
  const script = await fetch(`${service.url}shim-host.mjs`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal(script.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(script.headers.get('cross-origin-embedder-policy'), 'require-corp');
  assert.match(await script.text(), /export class ShimHost/);
  checks.push('Real host JavaScript served with WASM isolation headers');
  const head = await fetch(`${service.url}shim-host.mjs`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  checks.push('HEAD emits headers without file contents');
  const escape = await fetch(`${service.url}%2e%2e%2fREADME.md`);
  assert.equal(escape.status, 403);
  checks.push('Encoded path traversal cannot read parent files');
  const post = await fetch(service.url, { method: 'POST', body: 'unchanged' });
  assert.equal(post.status, 405);
  checks.push('Server exposes only read-only GET and HEAD');
  await mkdir(results, { recursive: true });
  const report = { status: 'passed', measuredAt: new Date().toISOString(), checks, requests: service.requests };
  await writeFile(resolve(results, 'server.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally { await service.close(); }
