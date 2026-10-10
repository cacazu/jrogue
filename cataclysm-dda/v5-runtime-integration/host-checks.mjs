import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ASSETS, TILESET_DIRECTORY } from './asset-manifest.mjs';
import { prepareV5Assets, installV5Assets } from './v5-loader.mjs';
import { bindV5Policy, digestWords } from './policy-bridge.mjs';
import { V5AssetError, formatV5Error, formatV5Message } from './v5-errors.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const assetRoot = String.raw`C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\assets-16px\native-v5\tileset\CDDA16_Combined_Ready`;
const buffers = ASSETS.map(asset => new Uint8Array(fs.readFileSync(path.join(assetRoot, asset.name))));
const hash = data => createHash('sha256').update(data).digest('hex');
for (const [index, asset] of ASSETS.entries()) {
  assert.equal(buffers[index].length, asset.bytes);
  assert.equal(hash(buffers[index]), asset.sha256);
}
// Explicit test double for host control/error behavior. Actual Rust/WASM
// acceptance is a separate check and is never inferred from this double.
const policy = { validateAsset(index, bytes, digest) {
  const asset = ASSETS[index];
  return !asset ? 1 : bytes !== asset.bytes ? 2 : digest !== asset.sha256 ? 3 : 0;
} };
const responses = () => async url => {
  const index = ASSETS.findIndex(asset => asset.name === new URL(url).pathname.split('/').pop());
  assert.ok(index >= 0);
  return new Response(buffers[index].slice(), { status: 200,
    headers: { 'content-length': String(buffers[index].length) } });
};
const prepare = options => prepareV5Assets(policy, { baseUrl: new URL('http://127.0.0.1/assets/'),
  fetchImpl: responses(), cryptoImpl: webcrypto, ...options });
function memoryFS({ existing = false, partialWrite = false, corruptReadback = false, cleanupFails = false } = {}) {
  const nodes = new Map(existing ? [[TILESET_DIRECTORY, 'original']] : []);
  const writes = [];
  return { nodes, writes,
    analyzePath(filename) { return { exists: nodes.has(filename) }; },
    mkdir(filename) { assert.equal(filename, TILESET_DIRECTORY); assert.ok(!nodes.has(filename)); nodes.set(filename, 'directory'); },
    writeFile(filename, data) {
      assert.ok(ASSETS.some(asset => filename === TILESET_DIRECTORY + '/' + asset.name));
      nodes.set(filename, data.slice()); writes.push(filename);
      if (partialWrite) throw new Error('injected partial write');
    },
    readFile(filename) { const data = nodes.get(filename).slice(); if (corruptReadback) data[0] ^= 1; return data; },
    unlink(filename) { if (cleanupFails) throw new Error('injected unlink failure'); nodes.delete(filename); },
    rmdir(filename) { if (cleanupFails) throw new Error('injected rmdir failure'); nodes.delete(filename); }
  };
}
const passed = [];
async function check(name, action) { await action(); passed.push(name); }
const rejects = async (action, id, parameters) => {
  const result = await action().then(() => { throw new Error('Expected failure'); }, error => error);
  assert.ok(result instanceof V5AssetError); assert.equal(result.textId, id);
  if (parameters) assert.deepEqual(result.parameters, parameters);
  return result;
};
await check('all-six-actual-parent-assets-prepare-and-readback-in-explicit-MEMFS-double', async () => {
  const prepared = await prepare(); const FS = memoryFS(); const result = await installV5Assets(FS, prepared);
  assert.equal(result.bytes, 1200829); assert.equal(result.originalEngineRendererExecuted, false);
  assert.equal(FS.nodes.size, 7); assert.equal(FS.writes.length, 6);
  ASSETS.forEach((asset, index) => assert.deepEqual(FS.nodes.get(TILESET_DIRECTORY + '/' + asset.name), buffers[index]));
});
await check('body-abort-is-localized-without-platform-error-text', async () => {
  const error = await rejects(() => prepare({ fetchImpl: async () => ({ ok: true, status: 200,
    headers: new Headers(), arrayBuffer: async () => { throw new Error('NETWORK PRIVATE DETAIL'); } }) }),
  'assets.v5.fetch_failed', { file: ASSETS[0].name, status: 200 });
  assert.ok(formatV5Error(error).includes('読み込めません')); assert.ok(!formatV5Error(error).includes('PRIVATE'));
});
await check('fetch-rejection-and-http-status-are-typed', async () => {
  await rejects(() => prepare({ fetchImpl: async () => { throw new Error('fetch failure'); } }), 'assets.v5.fetch_failed', { file: ASSETS[0].name, status: 0 });
  await rejects(() => prepare({ fetchImpl: async () => new Response('', { status: 404 }) }), 'assets.v5.fetch_failed', { file: ASSETS[0].name, status: 404 });
});
await check('declared-length-rejected-before-body-consumption', async () => {
  let read = false;
  await rejects(() => prepare({ fetchImpl: async () => ({ ok: true, status: 200,
    headers: new Headers({ 'content-length': '999999999' }), arrayBuffer: async () => { read = true; return buffers[0].buffer; } }) }), 'assets.v5.size_failed');
  assert.equal(read, false);
});
await check('actual-body-length-and-content-digest-must-match', async () => {
  await rejects(() => prepare({ fetchImpl: async () => new Response(new Uint8Array(1)) }), 'assets.v5.size_failed');
  const data = buffers[0].slice(); data[0] ^= 1;
  await rejects(() => prepare({ fetchImpl: async () => new Response(data) }), 'assets.v5.digest_failed');
});
await check('crypto-failure-has-semantic-id', async () => {
  await rejects(() => prepare({ cryptoImpl: { subtle: { digest: async () => { throw new Error('unsupported'); } } } }), 'assets.v5.crypto_failed');
});
await check('existing-directory-preserves-all-original-bytes', async () => {
  const FS = memoryFS({ existing: true });
  await rejects(async () => installV5Assets(FS, await prepare()), 'assets.v5.existing_directory');
  assert.equal(FS.nodes.get(TILESET_DIRECTORY), 'original'); assert.equal(FS.writes.length, 0);
});
await check('prepared-byte-mutation-rejected-before-FS-mutation', async () => {
  const prepared = await prepare(); prepared.files[5].data[0] ^= 1; const FS = memoryFS();
  await rejects(() => installV5Assets(FS, prepared), 'assets.v5.digest_failed'); assert.equal(FS.nodes.size, 0);
});
await check('mutable-name-getter-cannot-change-owned-manifest-path', async () => {
  const prepared = await prepare(); let reads = 0;
  const files = prepared.files.map((file, index) => index ? file : { data: file.data,
    get name() { return reads++ === 0 ? ASSETS[0].name : '../../save/escape'; } });
  const FS = memoryFS(); await installV5Assets(FS, { ...prepared, files });
  assert.equal(reads, 1); assert.ok(FS.writes.every(filename => filename.startsWith(TILESET_DIRECTORY + '/')));
});
await check('partial-write-rolls-back-only-owned-new-directory', async () => {
  const FS = memoryFS({ partialWrite: true });
  const error = await rejects(async () => installV5Assets(FS, await prepare()), 'assets.v5.install_failed');
  assert.equal(FS.nodes.size, 0); assert.deepEqual(error.cleanupFailures, []);
});
await check('readback-corruption-rolls-back-and-has-own-id', async () => {
  const FS = memoryFS({ corruptReadback: true });
  await rejects(async () => installV5Assets(FS, await prepare()), 'assets.v5.readback_failed'); assert.equal(FS.nodes.size, 0);
});
await check('failed-cleanup-is-reported-with-exact-owned-paths', async () => {
  const FS = memoryFS({ partialWrite: true, cleanupFails: true });
  const error = await rejects(async () => installV5Assets(FS, await prepare()), 'assets.v5.install_failed');
  assert.deepEqual(error.cleanupFailures, [TILESET_DIRECTORY + '/' + ASSETS[0].name, TILESET_DIRECTORY]);
});
await check('invalid-prepared-shape-is-typed', async () => {
  await rejects(() => installV5Assets(memoryFS(), null), 'assets.v5.policy_failed');
});
await check('typed-catalog-coverage-preserves-filenames-and-placeholder-contract', async () => {
  const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/en.json'), 'utf8'));
  const ja = JSON.parse(fs.readFileSync(path.join(root, 'locales/ja.json'), 'utf8'));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ja).sort());
  for (const id of Object.keys(en)) {
    const names = [...en[id].matchAll(/\{([a-z]+)\}/g)].map(match => match[1]);
    const parameters = Object.fromEntries(names.map(name => [name, name === 'file' ? 'QA_Kit_日本.png' : 404]));
    for (const language of ['en', 'ja']) {
      const text = formatV5Message(language, id, parameters);
      if (names.includes('file')) assert.ok(text.includes('QA_Kit_日本.png'));
      assert.throws(() => formatV5Message(language, id, { ...parameters, unexpected: 'x' }));
    }
  }
});
await check('scalar-policy-contract-and-big-endian-encoding', async () => {
  assert.deepEqual(digestWords('00010203'.repeat(8)), new Array(8).fill(0x00010203));
  assert.throws(() => digestWords('ff'));
  const exports = { cdda_v5_policy_version: () => 1, cdda_v5_asset_count: () => 6,
    cdda_v5_validate_asset: (...args) => { assert.equal(args.length, 10); return 0; },
    cdda_v5_new_profile_option_count: () => 3, cdda_v5_new_profile_option_kind: index => index + 1 };
  const bound = bindV5Policy(exports);
  assert.equal(bound.validateAsset(0, ASSETS[0].bytes, ASSETS[0].sha256), 0);
  assert.deepEqual(bound.newProfileOptions(), [ { name: 'USE_LANG', value: 'ja' },
    { name: 'TILES', value: 'cdda16_combined_ready' }, { name: 'OVERMAP_TILES', value: 'cdda16_combined_ready' } ]);
  assert.throws(() => bindV5Policy({ ...exports, cdda_v5_asset_count: () => 5 }));
  assert.throws(() => bindV5Policy({ ...exports, cdda_v5_new_profile_option_kind: () => 0 }).newProfileOptions());
});
const result = { schema: 1, checkedAt: new Date().toISOString(), status: 'passed', checks: passed,
  count: passed.length, assetBytes: buffers.reduce((sum, bytes) => sum + bytes.length, 0),
  policyExecuted: 'explicit-JS-test-double', filesystemExecuted: 'explicit-memory-test-double',
  originalEngineRendererExecuted: false, fullGameValidated: false };
fs.writeFileSync(path.join(root, 'HOST-CHECKS.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
