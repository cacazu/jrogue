import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ASSETS } from './asset-manifest.mjs';
import { bindV5Policy, digestWords, loadV5Policy } from './policy-bridge.mjs';
import { prepareV5Assets } from './v5-loader.mjs';
import { readAcceptedPolicy } from './read-accepted-policy.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
if (process.argv.length !== 4) throw new Error('Supply the exact reviewed success terminal path and digest.');
const accepted = readAcceptedPolicy(process.argv[2], process.argv[3]);
const bytes = accepted.bytes;
const sha256 = createHash('sha256').update(bytes).digest('hex');
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);
const native = new WebAssembly.Instance(module).exports;
const policy = bindV5Policy(native);
let assertions = 0;
for (const [index, asset] of ASSETS.entries()) {
  assert.equal(policy.validateAsset(index, asset.bytes, asset.sha256), 0); assertions++;
  assert.equal(native.cdda_v5_validate_asset(index, asset.bytes - 1, ...digestWords(asset.sha256)), 2); assertions++;
  assert.equal(native.cdda_v5_validate_asset(index, asset.bytes + 1, ...digestWords(asset.sha256)), 2); assertions++;
  const words = digestWords(asset.sha256);
  for (let word = 0; word < 8; word++) {
    for (let bit = 0; bit < 32; bit++) {
      const changed = words.slice(); changed[word] = (changed[word] ^ (2 ** bit)) >>> 0;
      assert.equal(native.cdda_v5_validate_asset(index, asset.bytes, ...changed), 3); assertions++;
    }
  }
}
for (const index of [6, 7, 0xffffffff]) {
  assert.equal(native.cdda_v5_validate_asset(index, 0, ...new Array(8).fill(0)), 1); assertions++;
}
assert.equal(native.cdda_v5_new_profile_option_kind(3), 0); assertions++;
assert.deepEqual(policy.newProfileOptions(), [ { name: 'USE_LANG', value: 'ja' },
  { name: 'TILES', value: 'cdda16_combined_ready' }, { name: 'OVERMAP_TILES', value: 'cdda16_combined_ready' } ]); assertions++;
const loaded = await loadV5Policy({ url: new URL('http://127.0.0.1/policy.wasm'), bytes: bytes.length, sha256,
  fetchImpl: async () => new Response(bytes), cryptoImpl: webcrypto });
const assetRoot = String.raw`C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\assets-16px\native-v5\tileset\CDDA16_Combined_Ready`;
const prepared = await prepareV5Assets(loaded, { baseUrl: new URL('http://127.0.0.1/assets/'), cryptoImpl: webcrypto,
  fetchImpl: async url => new Response(fs.readFileSync(path.join(assetRoot, new URL(url).pathname.split('/').pop()))) });
assert.equal(prepared.files.length, 6); assertions++;
for (const [index, asset] of ASSETS.entries()) {
  assert.equal(createHash('sha256').update(prepared.files[index].data).digest('hex'), asset.sha256); assertions++;
}
await assert.rejects(() => loadV5Policy({ url: new URL('http://127.0.0.1/policy.wasm'), bytes: bytes.length, sha256,
  fetchImpl: async () => new Response(Buffer.alloc(bytes.length)), cryptoImpl: webcrypto }),
  error => error.textId === 'assets.v5.policy_failed'); assertions++;
const result = { schema: 1, checkedAt: new Date().toISOString(), status: 'passed', assertions,
  wasm: { file: accepted.artifact.path, bytes: bytes.length, sha256, imports: [] }, acceptedProof: accepted.proofPin,
  actualWasmExecuted: true, actualSixParentAssetDigestsAccepted: true,
  originalEngineRendererExecuted: false, existingProfileRestoreExecuted: false, fullGameValidated: false };
fs.writeFileSync(path.join(root, 'WASM-POLICY-CHECKS.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
