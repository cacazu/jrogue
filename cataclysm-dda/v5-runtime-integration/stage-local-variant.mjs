import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'preview');
const game = String.raw`C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda`;
const web = path.join(game, 'baseline-preview/web');
const target = path.join(web, 'v5');
if (process.argv.length !== 3 || !['--check', '--stage', '--verify'].includes(process.argv[2])) throw new Error('Use --check, --stage or --verify.');
const action = process.argv[2];
function require(condition, message) { if (!condition) throw new Error(message); }
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fileSha(filename) {
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of fs.createReadStream(filename, { highWaterMark: 65536 })) { hash.update(chunk); bytes += chunk.length; }
  return { file: filename, bytes, sha256: hash.digest('hex') };
}
const originalPins = [
  ['index.html', 3346, 'fe63e838a93e42fcd45a1b7707d2cb9c1356787198ef391822a313c3b1844f0c'],
  ['package-manifest.json', 30768, 'eb09bac0ddaf7373b411bcfe7a60d21e4fd4775689e4e7437e07be0283360f39'],
  ['cataclysm-tiles.js', 498522, '8e41e1903f220bbaf8831a215de66427b166741ca19f2fa01edc0995e0cc74b5'],
  ['cataclysm-tiles.wasm', 134832388, '3db7de7161c00e711828e219b148a376f15297c5fd6ee1213b14d10228a7f666'],
  ['cataclysm-tiles.data.js', 2225841, '2148975c28b02862887c722406c6c33007c22981e37303db3e8c588370bc098a'],
  ['cataclysm-tiles.data', 116219695, '9ace7d8c416f67e066fa9897150af616c5cd8dc4bd8558f99cb22a99179d1212']
];
require(fs.realpathSync(game) === game && fs.realpathSync(web) === web, 'Exact ordinary requested game/web roots required.');
const manifestBytes = fs.readFileSync(path.join(source, 'runtime-manifest.json'));
const manifest = JSON.parse(manifestBytes);
require(manifest.localOnly === true && manifest.originalEngineArtifactsModified === false && manifest.files.length === 16,
  'Reviewed local variant manifest required.');
const buffers = new Map();
for (const pin of manifest.files) {
  require(!path.isAbsolute(pin.file) && !pin.file.split(/[\\/]/).includes('..'), 'Variant path escapes its folder.');
  const filename = path.resolve(source, pin.file);
  require(filename.startsWith(source + path.sep) && fs.realpathSync(filename) === filename, 'Ordinary source file required.');
  const bytes = fs.readFileSync(filename);
  require(bytes.length === pin.bytes && sha(bytes) === pin.sha256, 'Variant source changed: ' + pin.file);
  buffers.set(pin.file, bytes);
}
buffers.set('runtime-manifest.json', manifestBytes);
new vm.Script(buffers.get('baseline-shell.js').toString('utf8'), { filename: 'v5/baseline-shell.js' });
for (const proof of ['HOST-CHECKS.json', 'WASM-POLICY-CHECKS.json', 'RESTORE-BOUNDARY-CHECKS.json']) {
  require(JSON.parse(fs.readFileSync(path.join(root, proof), 'utf8')).status === 'passed', 'Required checks failed: ' + proof);
}
const before = [];
for (const [file, bytes, sha256] of originalPins) {
  const actual = await fileSha(path.join(web, file));
  require(actual.bytes === bytes && actual.sha256 === sha256, 'Accepted original runtime changed: ' + file); before.push(actual);
}
if (action === '--stage') {
  require(!fs.existsSync(target), 'Preserve an existing/partial variant; do not overwrite it.');
  fs.mkdirSync(target);
  for (const [file, bytes] of buffers) {
    const filename = path.resolve(target, file);
    require(filename.startsWith(target + path.sep), 'Destination escapes the new variant.');
    fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, bytes, { flag: 'wx' });
  }
}
const delivered = [];
if (action !== '--check') {
  require(fs.realpathSync(target) === target, 'Ordinary variant destination required.');
  for (const [file, bytes] of buffers) {
    const actual = await fileSha(path.join(target, file));
    require(actual.bytes === bytes.length && actual.sha256 === sha(bytes), 'Delivered variant differs: ' + file); delivered.push(actual);
  }
}
const after = [];
for (const pin of before) after.push(await fileSha(pin.file));
require(JSON.stringify(before) === JSON.stringify(after), 'Original accepted runtime changed during variant staging.');
const result = { schema: 1, checkedAt: new Date().toISOString(), status: 'passed', action,
  url: 'http://127.0.0.1:8878/v5/index.html', source, target, files: buffers.size,
  protectedOriginals: after, deliveredFiles: delivered, originalEngineFilesModified: false,
  sharedGitOperations: false, localOnly: true, actualBrowserExecuted: false,
  originalEngineRendererExecuted: false, fullGameValidated: false };
fs.writeFileSync(path.join(root, action === '--stage' ? 'LOCAL-STAGING.json' : action === '--verify' ? 'LOCAL-VERIFICATION.json' : 'STAGING-CHECK.json'),
  JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, action, files: result.files, url: result.url,
  originalEngineFilesModified: false, actualBrowserExecuted: false }));
