import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SOURCE_COMMIT = 'a6f965072b3a25b768c91dbced00367f1b57d865';
export const ENGINE_COMMIT = 'f89735a741a968997656c2d48a003ec569db7f22';
const taskRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// The original ForceRaw module loader reads these source files directly. This
// allowlist intentionally does not inherit the upstream native publish recipe.
export function permittedAsset(relative) {
  if (typeof relative !== 'string' || relative.split('/').some(part => part === '.' || part === '..')) return false;
  if (relative === 'config.lua' || relative === 'config-browser.lua') return true;
  if (/^data\/(core|drl)\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.lua$/.test(relative)) return true;
  return /^data\/drl\/(help\/[a-zA-Z0-9_.-]+\.hlp|ascii\/[a-zA-Z0-9_.-]+\.asc)$/.test(relative);
}
async function walk(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symbolic source asset rejected: ${relative}`);
    if (entry.isDirectory()) result.push(...await walk(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile() && permittedAsset(relative)) result.push(relative);
  }
  return result.sort();
}
export async function packageAssets({root = taskRoot, output = path.join(root, 'port/dist')} = {}) {
  const adapted = path.join(root, 'core-adapted/drl/bin');
  const pristine = path.join(root, 'upstream/drl/bin');
  const files = [...await walk(adapted), ...(await walk(pristine)).filter(file => file.endsWith('.asc'))].sort();
  if (new Set(files).size !== files.length) throw new Error('Duplicate source asset');
  for (const required of ['config.lua', 'config-browser.lua', 'data/core/meta.lua', 'data/core/main.lua', 'data/drl/meta.lua', 'data/drl/main.lua']) {
    if (!files.includes(required)) throw new Error(`Required original-core asset missing: ${required}`);
  }
  let total = 0;
  const manifest = {schema:1, source_commit:SOURCE_COMMIT, engine_commit:ENGINE_COMMIT,
    platform:'original Pascal/Lua, raw console, silent', files:[]};
  for (const relative of files) {
    // Pristine CC art was intentionally not copied into the code-only adapter
    // tree. Read it separately, without converting or modifying original bytes.
    const source = relative.endsWith('.asc') ? pristine : adapted;
    const bytes = await readFile(path.join(source, ...relative.split('/')));
    if (bytes.length > 1024 * 1024 || total + bytes.length > 16 * 1024 * 1024) throw new Error('Core asset package exceeds bounds');
    total += bytes.length;
    let original = null;
    if (relative !== 'config-browser.lua') original = hash(await readFile(path.join(pristine, ...relative.split('/'))));
    const virtualPath = 'data/' + relative;
    const url = 'assets/' + virtualPath;
    const destination = path.join(output, ...url.split('/'));
    await mkdir(path.dirname(destination), {recursive:true});
    await writeFile(destination, bytes);
    manifest.files.push({path:virtualPath, url, size:bytes.length, sha256:hash(bytes),
      original_sha256:original, modified:original === null || original !== hash(bytes), license:relative.endsWith('.asc') ? 'CC-BY-SA-4.0' : 'GPL-2.0'});
  }
  manifest.total_bytes = total;
  await mkdir(output, {recursive:true});
  await writeFile(path.join(output, 'core-assets.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await packageAssets();
  console.log(JSON.stringify({files:manifest.files.length, bytes:manifest.total_bytes,
    modified:manifest.files.filter(file => file.modified).map(file => file.path)}));
}
