import {createHash} from 'node:crypto';
import {cp, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cargoCache = path.join(process.env.CARGO_HOME || path.join(process.env.USERPROFILE,'.cargo'),'registry/src');
const registries = (await readdir(cargoCache,{withFileTypes:true})).filter(entry => entry.isDirectory()).map(entry => path.join(cargoCache,entry.name));
const lock = await readFile(path.join(root,'port/Cargo.lock'),'utf8');
const packages = lock.split('[[package]]').slice(1).filter(block => /source = "registry\+/.test(block)).map(block => ({
  name:block.match(/^name = "([a-zA-Z0-9_-]+)"/m)?.[1],
  version:block.match(/^version = "([a-zA-Z0-9.+_-]+)"/m)?.[1],
  checksum:block.match(/^checksum = "([a-f0-9]{64})"/m)?.[1],
}));
const destination = path.join(root,'port/licenses/rust');
await mkdir(destination,{recursive:true});
const manifest = {schema:1,source:'Cargo.lock-pinned cached registry source',packages:[]};
for (const pkg of packages) {
  if (!pkg.name || !pkg.version || !pkg.checksum) throw new Error('Malformed locked registry package');
  let directory;
  for (const registry of registries) {
    const candidate = path.join(registry,`${pkg.name}-${pkg.version}`);
    try { await readFile(path.join(candidate,'Cargo.toml')); directory=candidate; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!directory) throw new Error(`Locked source not cached: ${pkg.name}-${pkg.version}`);
  const cargo = await readFile(path.join(directory,'Cargo.toml'),'utf8');
  const files = (await readdir(directory,{withFileTypes:true})).filter(entry => entry.isFile() && /^(LICENSE|COPYRIGHT|NOTICE)(?:[._-].*)?$/i.test(entry.name));
  if (!files.length) throw new Error(`No retained permission notice: ${pkg.name}`);
  const record = {...pkg,license:cargo.match(/^license = "([^"]+)"/m)?.[1] ?? null,notices:[]};
  for (const file of files) {
    const bytes = await readFile(path.join(directory,file.name));
    const target = `${pkg.name}-${pkg.version}/${file.name}`;
    await mkdir(path.dirname(path.join(destination,target)),{recursive:true});
    await cp(path.join(directory,file.name),path.join(destination,target));
    record.notices.push({file:target,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  manifest.packages.push(record);
}
await writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({packages:manifest.packages.length,notices:manifest.packages.reduce((sum,pkg)=>sum+pkg.notices.length,0)}));
