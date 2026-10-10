import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readAcceptedPolicy } from './read-accepted-policy.mjs';
import { ASSETS, TILESET_DIRECTORY } from './asset-manifest.mjs';
import { bindV5Policy } from './policy-bridge.mjs';
import * as v5Loader from './v5-loader.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
if (process.argv.length !== 4) throw new Error('Supply the reviewed success terminal path and digest.');
const accepted = readAcceptedPolicy(process.argv[2], process.argv[3]);
const policy = bindV5Policy(new WebAssembly.Instance(new WebAssembly.Module(accepted.bytes)).exports);
const preview = path.join(root, 'preview');
const manifest = JSON.parse(fs.readFileSync(path.join(preview, 'runtime-manifest.json'), 'utf8'));
const shell = fs.readFileSync(path.join(preview, 'baseline-shell.js'));
const shellPin = manifest.files.find(row => row.file === 'baseline-shell.js');
assert.equal(shell.length, shellPin.bytes); assert.equal(createHash('sha256').update(shell).digest('hex'), shellPin.sha256);
const source = shell.toString('utf8');
const start = source.indexOf('  function observeOriginalFilesystem() {');
const end = source.indexOf('  // A versioned container around unchanged native files;', start);
assert.ok(start >= 0 && end > start);
const observerSource = source.slice(start, end);
const prepared = await v5Loader.prepareV5Assets(policy, { baseUrl: new URL('http://127.0.0.1/assets/'), cryptoImpl: webcrypto,
  fetchImpl: async url => new Response(fs.readFileSync(path.join(preview, 'assets', new URL(url).pathname.split('/').pop()))) });
const SAVE_ROOT = '/home/web_user/.cataclysm-dda';
const optionsPath = SAVE_ROOT + '/config/options.json';
function fixture({ existingOptions, restoreError = null, directoryExists = false } = {}) {
  const originalOptions = existingOptions === undefined ? null : Buffer.from(existingOptions);
  const nodes = new Map(originalOptions ? [[optionsPath, originalOptions.slice()]] : []);
  if (directoryExists) nodes.set(TILESET_DIRECTORY, 'original');
  const order = [], calls = [], writes = [], errors = [];
  let restored = false;
  const FS = {
    analyzePath(filename) { return { exists: nodes.has(filename) }; },
    mkdir(filename) { assert.equal(filename, TILESET_DIRECTORY); nodes.set(filename, 'directory'); order.push('asset-directory'); },
    mkdirTree(filename) { assert.equal(filename, SAVE_ROOT + '/config'); assert.equal(restored, true); order.push('new-config-directory'); },
    writeFile(filename, data) { writes.push(filename); nodes.set(filename, typeof data === 'string' ? Buffer.from(data) : data.slice()); },
    readFile(filename) { return nodes.get(filename).slice(); },
    unlink(filename) { nodes.delete(filename); }, rmdir(filename) { nodes.delete(filename); },
    syncfs(populate, callback) {
      calls.push(Boolean(populate));
      queueMicrotask(() => { if (populate) { restored = true; order.push('cpp-restore-completed'); }
        callback(populate ? restoreError : null); });
    }
  };
  const diagnostics = {};
  const context = vm.createContext({ window: { Module: { FS } }, SAVE_ROOT, diagnostics, v5Loader,
    v5Prepared: prepared, v5Policy: policy, JSON,
    record(type) { order.push(type); }, fail(error) { errors.push(error); },
    async prepareJapaneseCatalog(actualFS) { assert.equal(actualFS, FS); assert.equal(restored, true); order.push('original-mo-hook'); }
  });
  vm.runInContext(observerSource + '\nobserveOriginalFilesystem();', context);
  const sync = populate => new Promise(resolve => FS.syncfs(populate, error => { order.push('native-callback'); resolve(error); }));
  return { FS, sync, nodes, order, calls, writes, errors, diagnostics, originalOptions };
}
const checks = [];
async function check(name, run) { await run(); checks.push(name); }
await check('new-profile-rust-string-defaults-follow-original-restore-and-before-native-callback', async () => {
  const result = fixture(); assert.equal(await result.sync(true), null);
  assert.equal(result.diagnostics.profileSeeded, true);
  assert.deepEqual(JSON.parse(result.nodes.get(optionsPath).toString()), policy.newProfileOptions());
  assert.deepEqual(result.calls, [true, false]);
  assert.ok(result.order.indexOf('cpp-restore-completed') < result.order.indexOf('original-mo-hook'));
  assert.ok(result.order.indexOf('asset-directory') < result.order.indexOf('native-callback'));
  assert.equal(result.nodes.size, 8);
  ASSETS.forEach(asset => assert.ok(result.nodes.has(TILESET_DIRECTORY + '/' + asset.name)));
  assert.equal(result.diagnostics.v5Assets.originalEngineRendererExecuted, false);
});
await check('existing-options-remain-byte-identical-and-no-persist-write-occurs', async () => {
  const result = fixture({ existingOptions: '[{"name":"USE_LANG","value":"en"},{"name":"TILES","value":"UltimateCataclysm"}]\n' });
  assert.equal(await result.sync(true), null);
  assert.equal(result.diagnostics.profileSeeded, false);
  assert.deepEqual(result.nodes.get(optionsPath), result.originalOptions);
  assert.deepEqual(result.calls, [true]); assert.ok(!result.writes.includes(optionsPath));
});
await check('later-syncs-do-not-reinstall-assets-or-reseed-options', async () => {
  const result = fixture(); await result.sync(true); const writes = result.writes.length;
  await result.sync(true); await result.sync(false);
  assert.equal(result.writes.length, writes); assert.deepEqual(result.calls, [true, false, true, false]);
});
await check('restore-error-propagates-before-any-v5-or-config-mutation', async () => {
  const error = new Error('original restore failure'); const result = fixture({ restoreError: error });
  assert.equal(await result.sync(true), error); assert.equal(result.nodes.size, 0);
  assert.equal(result.writes.length, 0); assert.ok(!result.order.includes('original-mo-hook'));
});
await check('v5-failure-stops-native-success-callback-and-preserves-original-directory-options', async () => {
  const result = fixture({ existingOptions: 'unaltered original bytes\n', directoryExists: true });
  const error = await result.sync(true); assert.equal(error.textId, 'assets.v5.existing_directory');
  assert.equal(result.errors[0], error); assert.deepEqual(result.nodes.get(optionsPath), result.originalOptions);
  assert.equal(result.nodes.get(TILESET_DIRECTORY), 'original'); assert.equal(result.writes.length, 0);
});
const result = { schema: 1, checkedAt: new Date().toISOString(), status: 'passed', checks, count: checks.length,
  generatedObserverSourceSha256: createHash('sha256').update(observerSource).digest('hex'),
  actualRustWasmPolicyExecuted: true, originalSyncfsExecuted: 'explicit-callback-test-double',
  JapaneseCatalogExecuted: 'explicit-hook-test-double', originalCppMainExecuted: false,
  originalEngineRendererExecuted: false, actualBrowserRestoreExecuted: false, fullGameValidated: false };
fs.writeFileSync(path.join(root, 'RESTORE-BOUNDARY-CHECKS.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
