// Complete original-core source selection. --plan never launches a build or
// archive process. --package produces a source candidate; publication remains
// gated by actual game verification and the final linked-object license audit.
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const mode=process.argv[2]??'--plan';
if(!['--plan','--package'].includes(mode))throw Error('Use --plan or --package');
const sdkBindings=new Set(['vfmodconst.inc','vfmodtypes.inc','vfmodlibrary.pas',
  'vsteamconst.inc','vsteamtypes.inc','vsteamlibrary.pas']);
const excludedDirectories=new Set(['.git','target','dist','build','mixed-build','mixed-rtl','toolchain','output','probe-build','native-probe-build','tests-output']);
const binaryExtensions=/\.(?:exe|dll|so|dylib|a|o|ppu|wasm|png|jpg|ogg|mp3|wav|ttf|otf|fon)$/i;
const records=new Map(),foldedPaths=new Set(),blockers=[];
async function hashFile(file){const hash=createHash('sha256');for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest('hex');}
function destination(value){
  if(typeof value!=='string'||value.includes('\\')||value.startsWith('/')||value.split('/').some(part=>!part||part==='.'||part==='..'||part.includes(':')))throw Error('Unsafe source bundle path');
  return value;
}
async function add(source,target,{allowBinary=false,expectedHash=null}={}){
  target=destination(target);
  if(sdkBindings.has(path.basename(source)))return;
  if(!allowBinary&&binaryExtensions.test(source))return;
  const stat=await lstat(source);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('Source file must be ordinary: '+source);
  if(foldedPaths.has(target.toLowerCase()))throw Error('Duplicate source destination: '+target);
  const sha256=await hashFile(source);
  if(expectedHash&&sha256!==expectedHash)throw Error('Pinned source checksum differs: '+source);
  records.set(target,{path:target,source,size:stat.size,sha256});
  foldedPaths.add(target.toLowerCase());
}
async function tree(relative,{target=relative,exclude=true,allowBinary=false}={}){
  const base=path.join(root,relative);
  async function visit(directory,prefix=''){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      if(entry.isSymbolicLink())throw Error('Source symlink excluded: '+entry.name);
      if(entry.name==='.git'||entry.name==='node_modules'||entry.name==='core-source-package-plan.json')continue;
      if(entry.isDirectory()){
        if(exclude&&excludedDirectories.has(entry.name))continue;
        await visit(path.join(directory,entry.name),prefix+entry.name+'/');
      }else if(entry.isFile())await add(path.join(directory,entry.name),target+'/'+prefix+entry.name,{allowBinary});
    }
  }
  await visit(base);
}
async function file(relative,options={}){await add(path.join(root,relative),options.target??relative,options);}
async function json(relative){return JSON.parse((await readFile(path.join(root,relative),'utf8')).replace(/^\uFEFF/,''));}
async function gitSource(relative,commit){
  const directory=path.join(root,relative);
  const result=spawnSync('git',['-C',directory,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true});
  if(result.status!==0||result.stdout.trim()!==commit)throw Error('Pinned source revision mismatch: '+relative);
  const status=spawnSync('git',['-C',directory,'status','--porcelain','--untracked-files=normal'],{encoding:'utf8',windowsHide:true});
  if(status.status!==0||status.stdout.trim())throw Error('Official source checkout modified: '+relative);
  const selectedPaths=relative==='upstream/llvm-project'?
    ['compiler-rt/lib/builtins','compiler-rt/cmake','compiler-rt/include','cmake','llvm/cmake','llvm/include','third-party/siphash',
      ':(top,glob)*',':(top,glob)compiler-rt/*',':(top,glob)compiler-rt/lib/*',':(top,glob)llvm/*',':(top,glob)third-party/*']:[];
  const listing=spawnSync('git',['-C',directory,'ls-files','-z','--',...selectedPaths],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  if(listing.status!==0)throw Error('Cannot inventory official source: '+relative);
  let selected=0;
  for(const name of listing.stdout.split('\0').filter(Boolean)){
    const source=path.join(directory,name);
    let stat;try{stat=await lstat(source);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(stat.isDirectory())continue; // separately acquired pinned gitlink
    await add(source,relative+'/'+name.replaceAll('\\','/'));selected++;
  }
  return selected;
}

// Published source includes complete selected original code plus generated
// adaptations and their guarded recipes. Pristine native gameplay stays intact.
await tree('native',{exclude:false});
for(const entry of [...records.values()])if(entry.path.startsWith('native/'))await add(entry.source,'upstream/'+entry.path.slice('native/'.length));
for(const name of ['core-overlay','localization','tools','docs','port/src','port/tests','port/web','port/tools','port/locales','port/licenses','experiments/lua-wasi','experiments/vtig-cjk','experiments/state-probe'])await tree(name);
await tree('core-adapted',{exclude:true});
await tree('upstream/fpcvalkyrie/libs',{exclude:false});
for(const name of ['dkey.inc','version.txt','version_api.txt'])await file('upstream/drl/bin/'+name);
// The code-only native selection is sufficient to reproduce adapted scripts;
// these byte-exact art and permission files complete the runtime asset inputs.
await tree('upstream/drl/bin/data/drl/ascii',{exclude:false});
await file('upstream/drl/bin/data/drl/graphics/LICENSE');
for(const name of ['.gitignore','README.md','feature-inventory.json','feature-inventory.md','feature-registry-appendix.md','inventory-source.mjs','port/Cargo.toml','port/Cargo.lock','port/build.ps1','port/start.ps1','port/README.md'])await file(name);
for(const entry of await readdir(path.join(root,'toolchain'),{withFileTypes:true}))if(entry.isFile()&&/\.(ps1|json)$/.test(entry.name))await file('toolchain/'+entry.name);
await tree('toolchain/wasm-probe',{exclude:true});
await tree('toolchain/acquisition/dependency-licenses',{exclude:false});
await file('toolchain/acquisition/wasm-build/fpc-source.zip',{allowBinary:true,expectedHash:'fb97cbb1ac458df86d7345312380587cb81bda4407ae7077eb06b87f7ef701bf'});
const dependencies=[
  ['upstream/wasi-libc','2e6fb9d8ee0cdf9e431fbcabe8af3115de000a13'],
  ['upstream/wasi-libc/tools/wasi-headers/WASI','59cbe140561db52fc505555e859de884e0ee7f00'],
  ['upstream/wasi-sdk','5a0bf653a1a06e1c18867567c5937006d3394a69'],
  ['upstream/llvm-project','895aa2c896ada719451be2e3673c83da8ddf1141'],
];
const sourceDependencies=[];
for(const [directory,commit] of dependencies){
  try{sourceDependencies.push({directory,commit,files:await gitSource(directory,commit)});}
  catch(error){blockers.push(error.message);}
}
// Retain original registry archives, verified against Cargo.lock, rather than
// assuming a mutable extracted cache remains identical to published source.
const lock=await readFile(path.join(root,'port/Cargo.lock'),'utf8');
const packages=lock.split('[[package]]').slice(1).filter(block=>/source = "registry\+/.test(block)).map(block=>({
  name:block.match(/^name = "([\w-]+)"/m)?.[1],version:block.match(/^version = "([\w.+-]+)"/m)?.[1],checksum:block.match(/^checksum = "([a-f0-9]{64})"/m)?.[1],
}));
const cacheRoot=path.join(process.env.CARGO_HOME??path.join(process.env.USERPROFILE,'.cargo'),'registry/cache');
const registries=(await readdir(cacheRoot,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>path.join(cacheRoot,entry.name));
for(const pkg of packages){
  if(!pkg.name||!pkg.version||!pkg.checksum)throw Error('Malformed Cargo package lock');
  const name=`${pkg.name}-${pkg.version}.crate`;let source;
  for(const registry of registries){try{await lstat(path.join(registry,name));source=path.join(registry,name);break;}catch(error){if(error.code!=='ENOENT')throw error;}}
  if(!source){blockers.push('Missing locked Cargo source archive: '+name);continue;}
  await add(source,'vendor-archives/'+name,{allowBinary:true,expectedHash:pkg.checksum});
}
const rustRoot=process.env.DRL_RUST_TOOLCHAIN??path.join(process.env.USERPROFILE,'.rustup/toolchains/1.98.1-x86_64-pc-windows-gnu');
try{
  const library=path.join(rustRoot,'lib/rustlib/src/rust/library');
  async function rustVisit(dir,prefix=''){
    for(const entry of await readdir(dir,{withFileTypes:true})){
      if(entry.isSymbolicLink())throw Error('Rust standard source symlink');
      if(entry.isDirectory())await rustVisit(path.join(dir,entry.name),prefix+entry.name+'/');
      else if(entry.isFile())await add(path.join(dir,entry.name),'rust-standard-library/'+prefix+entry.name);
    }
  }
  await rustVisit(library);
  await add(path.join(rustRoot,'share/doc/rust/COPYRIGHT-library.html'),'licenses/Rust-Standard-Library-Copyright.html');
}catch(error){blockers.push('Rust standard library source/notices: '+error.message);}
const manifest={schema:1,scope:'Corresponding source for exact compiled original core; basic Chrome, combat/autorun and selected-object notice audits passed; full campaign/world/text completion remains separate',
  full_port_complete:false,publication_approved:false,created_utc:new Date().toISOString(),sourceDependencies,
  sourceCompanionArchives:[{file:'toolchain/acquisition/wasm-build/fpc-source.zip',
    sha256:'fb97cbb1ac458df86d7345312380587cb81bda4407ae7077eb06b87f7ef701bf',source_code_executed:false,
    nested_fixture_exception:'Official immutable FPC source archive retains 422 .o fixtures and one .a (2776818 bytes), mainly compiler tests and three PalmOS RTL objects; these are not game runtime downloads.'}],
  lockedRustPackages:packages,excludedSdkBindings:[...sdkBindings].sort(),blockers,
  files:[...records.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'))};
const link=await json('core-adapted/build/browser-core/link-evidence.json').catch(()=>null);
if(!link?.imports_validated||!link?.wasm_sha256)manifest.blockers.push('No successful final original-core link/import evidence');
else {
  if(!link.source_inputs_unchanged||!link.archives_unchanged||!link.compiled_sources?.files?.length||link.compiled_sources.unresolved.length)
    manifest.blockers.push('Final link lacks an unchanged source/archive snapshot and resolved compiled-source inventory');
  for(const name of ['link-evidence.json','drl-core.map','memory-evidence.json'])
    await file('core-adapted/build/browser-core/'+name);
  // Retain exact mutable runtime/package inputs in addition to the immutable
  // official archive. Restore applies these source-only copies after baseline
  // extraction, including any generated package shadows used by this build.
  const sourceMappings=[];
  for(const input of link.source_inputs?.files??[]){
    if(!/^toolchain\/(fpc-src\/(rtl|packages)\/|packages-exnref\/)/.test(input.path))continue;
    const target='linked-source/'+input.path;
    await file(input.path,{target,expectedHash:input.sha256});
    sourceMappings.push({sourcePath:target,buildPath:input.path,sha256:input.sha256});
  }
  for(const input of link.source_inputs?.files??[]){
    const packaged=records.get(input.path);
    if(packaged&&packaged.sha256!==input.sha256)manifest.blockers.push('Source changed after final link: '+input.path);
  }
  for(const input of link.compiled_sources?.files??[]){
    if(!records.has(input.path)&&!sourceMappings.some(mapping=>mapping.buildPath===input.path))
      manifest.blockers.push('Compiled source is absent from corresponding-source selection: '+input.path);
  }
  manifest.core={sha256:link.wasm_sha256,size:link.wasm_bytes,
    archives:link.archives.map(archive=>({...archive,path:path.relative(root,archive.path).replaceAll('\\','/')})),
    selectedUnits:link.compiled_sources?.files??[],sourceSnapshotSha256:link.source_inputs?.sha256,
    sourceMappings};
  manifest.files=[...records.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
const out=path.join(root,'docs/core-source-package-plan.json');
await writeFile(out,JSON.stringify(manifest,null,2)+'\n');
if(mode==='--package'){
  if(manifest.blockers.length)throw Error('Source bundle blocked: '+manifest.blockers.join('; '));
  const packed=spawnSync(process.env.DRL_POWERSHELL??'pwsh.exe',['-NoProfile','-File','tools/write-core-source-zip.ps1','-Plan',out,'-Destination',path.join(root,'port/dist/source.zip')],{cwd:root,windowsHide:true,stdio:'inherit'});
  if(packed.status!==0)throw Error('Source archive creation failed');
}
console.log(JSON.stringify({mode,files:records.size,bytes:[...records.values()].reduce((sum,entry)=>sum+entry.size,0),blockers:manifest.blockers,publication:false}));
