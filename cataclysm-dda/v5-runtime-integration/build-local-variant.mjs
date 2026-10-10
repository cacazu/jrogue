import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ASSETS, SOURCE_COMMIT } from './asset-manifest.mjs';
import { readAcceptedPolicy } from './read-accepted-policy.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.dirname(root);
const assetRoot = String.raw`C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\assets-16px\native-v5\tileset\CDDA16_Combined_Ready`;
const output = path.join(root, 'preview');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (process.argv.length !== 4) throw new Error('Supply the exact reviewed success terminal path and digest.');
const accepted = readAcceptedPolicy(process.argv[2], process.argv[3]);
const wasm = accepted.bytes;
const module = new WebAssembly.Module(wasm);
if (WebAssembly.Module.imports(module).length) throw new Error('The policy must have no imports.');
const exports = new WebAssembly.Instance(module).exports;
if (exports.cdda_v5_policy_version() !== 1 || exports.cdda_v5_asset_count() !== 6) throw new Error('Unexpected policy ABI.');
if (fs.existsSync(output)) throw new Error('Preserve the existing variant; use a reviewed new output instead.');
const inputs = [accepted.proofPin, { file: accepted.artifact.path, bytes: wasm.length, sha256: hash(wasm) }];
function pinned(filename, expected) {
  const bytes = fs.readFileSync(filename);
  if (hash(bytes) !== expected) throw new Error('Reviewed source changed: ' + filename);
  inputs.push({ file: filename, bytes: bytes.length, sha256: hash(bytes) });
  return bytes;
}
const shellBytes = pinned(path.join(workspace, 'baseline-preview/shell/baseline-shell.js'),
  '73cf6db6bbc3a69caebcf3d0550d13ca0cc05e4263b94d75ec1519b2f3581411');
const htmlBytes = pinned(path.join(workspace, 'baseline-preview/web/index.html'),
  'fe63e838a93e42fcd45a1b7707d2cb9c1356787198ef391822a313c3b1844f0c');
let shell = shellBytes.toString('utf8');
let html = htmlBytes.toString('utf8');
const substitutions = [];
function replaceOnce(text, before, after, label) {
  if (text.split(before).length !== 2) throw new Error('Expected one source boundary: ' + label);
  substitutions.push(label);
  return text.replace(before, after);
}
shell = replaceOnce(shell, '  let rustBridge;\n',
  '  let rustBridge;\n  let v5Errors;\n  let v5Loader;\n  let v5Prepared;\n  let v5Policy;\n', 'owned-v5-state');
shell = replaceOnce(shell, "    document.title = t('baseline.title');\n",
  "    document.title = t('baseline.title');\n    if (v5Errors) document.getElementById('v5-attribution').textContent =\n      v5Errors.formatV5Message(language, 'assets.v5.notice_label');\n", 'notice-semantic-id');
shell = replaceOnce(shell, "    if (catalogs && rustBridge) setStatus('runtime.failure', { reason: String(reason) });\n    else loading.textContent = String(reason);\n    record('failure', { reason: String(reason) });",
  "    const message = v5Errors ? v5Errors.formatV5Error(reason, language) : String(reason);\n    if (catalogs && rustBridge) setStatus('runtime.failure', { reason: message });\n    else loading.textContent = message;\n    record('failure', { reason: message, textId: reason?.textId ?? null,\n      parameters: reason?.parameters ?? null, cleanupFailures: reason?.cleanupFailures ?? [] });", 'typed-v5-failure');
shell = replaceOnce(shell, '          await prepareJapaneseCatalog(FS);\n',
  "          await prepareJapaneseCatalog(FS);\n          diagnostics.v5Assets = await v5Loader.installV5Assets(FS, v5Prepared);\n          record('v5-assets-ready', diagnostics.v5Assets);\n", 'restore-before-native-options-scan');
shell = replaceOnce(shell, "          FS.writeFile(optionsPath, JSON.stringify([{ name: 'USE_LANG', value: 'ja' }]) + '\\n');",
  "          const options = v5Policy.newProfileOptions();\n          FS.writeFile(optionsPath, JSON.stringify(options) + '\\n');", 'rust-new-profile-options');
shell = replaceOnce(shell, "          record('new-profile-default', { option: 'USE_LANG', value: 'ja' });",
  "          record('new-profile-default', { options });", 'new-profile-options-evidence');
shell = replaceOnce(shell, "await import('./rust-browser-bridge/browser-bridge.mjs')",
  "await import('../rust-browser-bridge/browser-bridge.mjs')", 'original-rust-bridge-path');
shell = replaceOnce(shell, "await fetch('locales/' + name + '.json')",
  "await fetch('../locales/' + name + '.json')", 'original-shell-locales-path');
shell = replaceOnce(shell, '    catalogs = Object.fromEntries(locales);\n',
  "    catalogs = Object.fromEntries(locales);\n    v5Errors = await import('./v5-errors.mjs');\n    v5Loader = await import('./v5-loader.mjs');\n    const { loadV5Policy } = await import('./policy-bridge.mjs');\n    const { policyArtifact } = await import('./v5-policy-artifact.mjs');\n    v5Policy = await loadV5Policy({ ...policyArtifact, url: new URL(policyArtifact.url, document.baseURI) });\n    v5Prepared = await v5Loader.prepareV5Assets(v5Policy, { baseUrl: new URL('./assets/', document.baseURI) });\n    diagnostics.v5Policy = { abi: 1, sha256: policyArtifact.sha256,\n      scope: 'immutable-asset-identities-and-new-profile-string-options' };\n", 'before-engine-load');
shell = replaceOnce(shell, '    window.Module = {\n      canvas,',
  "    window.Module = {\n      // The original package loader resolves .data against the document.\n      // Keep both original binary requests at the unchanged sibling runtime.\n      locateFile(file, prefix) {\n        return file === 'cataclysm-tiles.data' || file === 'cataclysm-tiles.wasm'\n          ? new URL('../' + file, document.baseURI).href : prefix + file;\n      },\n      canvas,", 'original-binary-sibling-resolution');
shell = replaceOnce(shell, "await loadScript('cataclysm-tiles.data.js')", "await loadScript('../cataclysm-tiles.data.js')", 'original-data-loader-path');
shell = replaceOnce(shell, "await loadScript('cataclysm-tiles.js')", "await loadScript('../cataclysm-tiles.js')", 'original-engine-path');
html = replaceOnce(html, 'href="baseline.css"', 'href="../baseline.css"', 'original-css-path');
html = replaceOnce(html, 'href="favicon.ico"', 'href="../favicon.ico"', 'original-favicon-path');
html = replaceOnce(html, 'href="attribution.html"', 'href="../attribution.html"', 'original-attribution-path');
html = replaceOnce(html, '    <details id="diagnostics">',
  '    <a id="v5-attribution" href="asset-notice.txt" target="_blank" rel="noopener">16px画像について</a>\n    <details id="diagnostics">', 'parent-asset-notice');
const staged = new Map();
staged.set('index.html', Buffer.from(html));
staged.set('baseline-shell.js', Buffer.from(shell));
for (const name of ['asset-manifest.mjs', 'catalogs.mjs', 'v5-errors.mjs', 'policy-bridge.mjs', 'v5-loader.mjs']) {
  const bytes = fs.readFileSync(path.join(root, name));
  inputs.push({ file: name, bytes: bytes.length, sha256: hash(bytes) }); staged.set(name, bytes);
}
staged.set('v5-policy.wasm', wasm);
staged.set('v5-policy-artifact.mjs', Buffer.from('export const policyArtifact = Object.freeze(' +
  JSON.stringify({ url: './v5-policy.wasm', bytes: wasm.length, sha256: hash(wasm) }) + ');\n'));
for (const asset of ASSETS) staged.set('assets/' + asset.name, pinned(path.join(assetRoot, asset.name), asset.sha256));
staged.set('asset-notice.txt', pinned(path.resolve(assetRoot, '../..', 'NOTICE.txt'),
  '41ccf6831109e97a16b77221e5d09ea602f25525320cd2f296af746607c09909'));
const manifest = { schema: 1, builtAt: new Date().toISOString(), sourceCommit: SOURCE_COMMIT,
  url: 'http://127.0.0.1:8878/v5/index.html', localOnly: true,
  sourceInputs: inputs, substitutions, originalEngineArtifactsModified: false,
  existingProfileOptionsPreserved: 'source-boundary; live restore check pending',
  gameplayAuthority: 'unchanged-original-C++', imageRenderer: 'unchanged-original-C++',
  originalEngineRendererExecuted: false, worldGenerated: false, fullGameValidated: false,
  files: [...staged].map(([file, bytes]) => ({ file, bytes: bytes.length, sha256: hash(bytes) })) };
// All source/policy/asset checks finish before any variant file is created.
for (const [file, bytes] of staged) {
  const target = path.join(output, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
}
fs.writeFileSync(path.join(output, 'runtime-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output, files: staged.size + 1, policyBytes: wasm.length, sha256: hash(wasm), localOnly: true }));
