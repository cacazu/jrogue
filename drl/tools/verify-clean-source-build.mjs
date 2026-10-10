// Serial corresponding-source reconstruction and clean game compilation.
// All source extraction is authenticated; only reviewed standard prerequisites
// are reused. No existing game objects or WebAssembly binaries are copied.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const task=fileURLToPath(new URL('../',import.meta.url));
const receipt=JSON.parse(fs.readFileSync(path.join(task,'port/dist/source-bundle.json'),'utf8'));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(hash(path.join(task,'port/dist/source.zip'))!==receipt.sha256)throw Error('Source archive no longer matches receipt');
const logs=path.join(task,'docs/source-clean-build-'+receipt.core_sha256.slice(0,8));fs.mkdirSync(logs,{recursive:true});
const record={schema:1,result:'running',archive_sha256:receipt.sha256,core_sha256:receipt.core_sha256,adapter_sha256:hash(path.join(task,'port/dist/drl_web_port.wasm')),started_utc:new Date().toISOString(),steps:[],full_toolchain_bootstrap_verified:false,game_objects_copied:false,game_wasm_copied:false,full_port_complete:false};
let root;
function run(name,exe,args,{cwd=task,env=process.env,timeout=420000}={}){
  const start=new Date().toISOString();const r=spawnSync(exe,args,{cwd,env,windowsHide:true,encoding:'utf8',maxBuffer:16777216,timeout});
  fs.writeFileSync(path.join(logs,name+'.stdout.log'),r.stdout??'');fs.writeFileSync(path.join(logs,name+'.stderr.log'),r.stderr??'');
  record.steps.push({name,command:[exe,...args],cwd,started_utc:start,completed_utc:new Date().toISOString(),exit_code:r.status,error:r.error?.message??null});
  console.log(JSON.stringify({stage:name,exit_code:r.status}));
  if(r.status!==0)throw Error(name+' failed: '+(r.stderr??r.error?.message??'').slice(-5000));return r.stdout;
}
try{
  let verified,resume=false;
  if(process.argv[2]==='--resume'){
    const previous=JSON.parse(fs.readFileSync(path.join(task,'docs/SOURCE-CLEAN-BUILD-EVIDENCE.json'),'utf8'));
    if(previous.result!=='fail'||previous.archive_sha256!==receipt.sha256||previous.core_sha256!==receipt.core_sha256||previous.steps.at(-1)?.name!=='external-standard-prerequisites'||previous.steps.at(-1)?.exit_code!==1||previous.steps.find(s=>s.name==='cargo-vendor-restore')?.exit_code!==0)throw Error('Resume requires the retained authenticated prerequisite-stage failure');
    verified=previous.authenticated_source;resume=true;record.resumed_after='false root comparison before any prerequisite/game object copy';
  }else{
    const output=run('fresh-source-and-fpc',process.execPath,['tools/verify-source-bundle-fast.mjs','--fresh']);
    verified=JSON.parse(output.trim().split(/\r?\n/).at(-1));
  }
  root=verified.extracted_root;record.root=root;record.authenticated_source=verified;
  if(verified.result!=='pass'||verified.core_sha256!==record.core_sha256||verified.archive_sha256!==receipt.sha256)throw Error('Extracted source identity differs');
  const scan=p=>{for(const f of fs.readdirSync(p,{withFileTypes:true})){if(f.isSymbolicLink())throw Error('Clean build source symlink');const q=path.join(p,f.name);if(f.isDirectory())scan(q);else if(/\.(o|ppu|wasm|a|exe|dll)$/i.test(f.name))throw Error('Existing game build artifact in source: '+q);}};
  scan(path.join(root,'core-adapted'));record.clean_game_build_input=true;
  if(!resume)run('cargo-vendor-restore',path.join(process.env.ProgramFiles,'PowerShell','7','pwsh.exe'),['-NoProfile','-File',path.join(root,'tools/restore-core-source-inputs.ps1'),'-SourceRoot',root,'-VendorOnly']);
  run('external-standard-prerequisites',process.execPath,['tools/prepare-clean-source-toolchain.mjs',root]);
  run('original-game-clean-build',process.execPath,[path.join(root,'tools/build-browser-core.mjs'),'--build'],{cwd:root});
  const link=JSON.parse(fs.readFileSync(path.join(root,'core-adapted/build/browser-core/link-evidence.json'),'utf8'));
  if(link.result.exit_code!==0||!link.imports_validated||!link.source_inputs_unchanged||!link.archives_unchanged||link.compiled_sources.files.length!==139)throw Error('Clean original-core build evidence incomplete');
  record.rebuilt_core_sha256=hash(path.join(root,'core-adapted/build/browser-core/drl-core.wasm'));
  record.compiled_sources=link.compiled_sources.files.length;record.core_byte_exact=record.rebuilt_core_sha256===record.core_sha256;
  run('empty-cache-offline-cargo-metadata',process.execPath,['tools/check-restored-cargo.mjs',root]);
  const meta=JSON.parse(fs.readFileSync(path.join(task,'docs/source-bundle-cargo-metadata-'+record.core_sha256.slice(0,8)+'.json'),'utf8'));
  if(meta.root!==root||meta.core_sha256!==record.core_sha256||meta.vendor_packages!==23)throw Error('Offline source resolution evidence differs');
  const target=path.join(root,'.clean-rust-target');if(fs.existsSync(target))throw Error('Clean Rust target directory already exists');
  run('rust-adapter-clean-build',path.join(process.env.USERPROFILE,'.cargo/bin/cargo.exe'),['build','--offline','--locked','--release','--target','wasm32-unknown-unknown','-j','1'],{cwd:path.join(root,'port'),env:{...process.env,CARGO_HOME:meta.cargo_home,CARGO_TARGET_DIR:target,RUSTUP_TOOLCHAIN:'1.98.1-x86_64-pc-windows-gnu'}});
  record.rebuilt_adapter_sha256=hash(path.join(target,'wasm32-unknown-unknown/release/drl_web_port.wasm'));
  record.adapter_byte_exact=record.rebuilt_adapter_sha256===record.adapter_sha256;record.cargo_vendors_verified=true;
  record.clean_compile_verified=true;record.result=record.core_byte_exact&&record.adapter_byte_exact?'pass':'compiled-artifact-differs';
  if(record.result!=='pass')process.exitCode=1;
}catch(error){record.result='fail';record.error=error.stack??String(error);process.exitCode=1;}
record.completed_utc=new Date().toISOString();record.scope='Authenticated fresh source/FPC/vendor restore and clean original-game/Rust compile using external pinned standard compiler/units/libraries; full toolchain bootstrap, campaign/world/text completion remain separate';
fs.writeFileSync(path.join(task,'docs/SOURCE-CLEAN-BUILD-EVIDENCE.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({result:record.result,root,core_byte_exact:record.core_byte_exact,adapter_byte_exact:record.adapter_byte_exact,error:record.error??null}));
