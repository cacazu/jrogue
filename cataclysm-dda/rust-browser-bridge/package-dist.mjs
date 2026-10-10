import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const own = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(own);
const dist = path.join(own, 'dist');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const runtime = JSON.parse(await readFile(path.join(own,'evidence','wasm-runtime.json')));
const wasmPath = path.join(own,'target','wasm32-unknown-unknown','release','cdda_rust_browser_bridge.wasm');
const wasm = await readFile(wasmPath);
if (!runtime.passed || runtime.imports.length || hash(wasm) !== runtime.wasm.sha256) {
  throw Error('Only the verified import-free WASM may be packaged');
}
await mkdir(dist,{recursive:true});
await mkdir(path.join(own,'licenses'),{recursive:true});
await copyFile(path.join(root,'rust-contracts','LICENSE-UPSTREAM.txt'),path.join(own,'LICENSE-UPSTREAM.txt'));
for (const filename of ['browser-bridge.mjs','text-manifest.json','NOTICE.md','LICENSE-UPSTREAM.txt']) {
  await copyFile(path.join(own,filename),path.join(dist,filename));
}
await writeFile(path.join(dist,'cdda_rust_browser_bridge.wasm'),wasm);

const {stdout: metadataText} = await run('cargo',['metadata','--offline','--locked','--format-version','1'],
  {cwd:own,maxBuffer:4 * 1024 * 1024,windowsHide:true});
const metadata = JSON.parse(metadataText);
const licenses = [];
for (const pkg of metadata.packages.filter(pkg => pkg.source)) {
  const packagePath = path.dirname(pkg.manifest_path);
  const noticeFiles = (await readdir(packagePath,{withFileTypes:true}))
    .filter(entry => entry.isFile() && /^(license|copying|notice|unlicense)/i.test(entry.name));
  if (!noticeFiles.length) throw Error(`Missing cached original notices: ${pkg.name}`);
  const copied = [];
  for (const file of noticeFiles) {
    const relative = `${pkg.name}-${pkg.version}/${file.name}`;
    await mkdir(path.join(own,'licenses',path.dirname(relative)),{recursive:true});
    await copyFile(path.join(packagePath,file.name),path.join(own,'licenses',relative));
    const bytes = await readFile(path.join(own,'licenses',relative));
    copied.push({path:relative,bytes:bytes.length,sha256:hash(bytes)});
  }
  licenses.push({name:pkg.name,version:pkg.version,license:pkg.license,repository:pkg.repository,
    source:pkg.source,notices:copied,includesBuildTimeDependencies:true});
}
const {stdout: sysrootText} = await run('rustc',['--print','sysroot'],{cwd:own,windowsHide:true});
const rustDoc = path.join(sysrootText.trim(),'share','doc','rust');
const rustNotices = ['COPYRIGHT-library.html'];
const standardLicenseFiles = (await readdir(path.join(rustDoc,'licenses'),{withFileTypes:true}))
  .filter(entry => entry.isFile()).map(entry => `licenses/${entry.name}`);
const rustCopied = [];
for (const relative of [...rustNotices,...standardLicenseFiles]) {
  const destination = path.join(own,'licenses','rust-standard-library',relative);
  await mkdir(path.dirname(destination),{recursive:true});
  await copyFile(path.join(rustDoc,relative),destination);
  const bytes = await readFile(destination);
  rustCopied.push({path:`rust-standard-library/${relative}`,bytes:bytes.length,sha256:hash(bytes)});
}
await writeFile(path.join(own,'evidence','dependency-licenses.json'),JSON.stringify({cargo:licenses,
  rustStandardLibrary:{toolchain:(await run('rustc',['--version'],{cwd:own,windowsHide:true})).stdout.trim(),
    notices:rustCopied,scope:'Installed standard-library copyright inventory; all referenced license texts retained.'}},null,2)+'\n');

async function copyTree(from,to) {
  await mkdir(to,{recursive:true});
  for (const entry of await readdir(from,{withFileTypes:true})) {
    if (entry.isDirectory()) await copyTree(path.join(from,entry.name),path.join(to,entry.name));
    else if (entry.isFile()) await copyFile(path.join(from,entry.name),path.join(to,entry.name));
  }
}
await copyTree(path.join(own,'licenses'),path.join(dist,'licenses'));
await copyFile(path.join(own,'evidence','dependency-licenses.json'),path.join(dist,'dependency-licenses.json'));

const sourceFiles = [];
async function recordSources(directory,relative='') {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    if (['target','dist','evidence'].includes(entry.name)) continue;
    const item = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await recordSources(path.join(directory,entry.name),item);
    else if (entry.isFile()) {
      const bytes = await readFile(path.join(directory,entry.name));
      sourceFiles.push({path:`rust-browser-bridge/${item}`,bytes:bytes.length,sha256:hash(bytes)});
    }
  }
}
await recordSources(own);
for (const relative of ['Cargo.toml','logic/Cargo.toml','logic/src/lib.rs','input/Cargo.toml','input/src/lib.rs',
  'presentation/Cargo.toml','presentation/src/lib.rs','fixtures/keybindings.json','locales/en.json','locales/ja.json']) {
  const bytes = await readFile(path.join(root,'rust-contracts',relative));
  sourceFiles.push({path:`rust-contracts/${relative}`,bytes:bytes.length,sha256:hash(bytes)});
}
sourceFiles.sort((a,b) => a.path.localeCompare(b.path,'en'));
await writeFile(path.join(own,'evidence','source-hashes.json'),JSON.stringify(sourceFiles,null,2)+'\n');
const delivered = [];
async function recordDist(directory,relative='') {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const item = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await recordDist(path.join(directory,entry.name),item);
    else {
      const bytes = await readFile(path.join(directory,entry.name));
      delivered.push({path:item,bytes:bytes.length,sha256:hash(bytes)});
    }
  }
}
await recordDist(dist);
await writeFile(path.join(own,'evidence','dist-manifest.json'),JSON.stringify({schemaVersion:1,
  wasm:runtime.wasm,files:delivered,totalBytes:delivered.reduce((sum,file)=>sum+file.bytes,0),
  scope:'Bounded bridge package, not a complete game or publication.'},null,2)+'\n');
console.log(JSON.stringify({files:delivered.length,totalBytes:delivered.reduce((sum,file)=>sum+file.bytes,0),
  wasm:runtime.wasm,cargoDependencyNotices:licenses.length,rustNotices:rustCopied.length}));
