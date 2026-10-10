// Materialize only previously verified standard toolchain prerequisites.
// Never copy original game object files or an existing game WebAssembly binary.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const task=path.resolve(fileURLToPath(new URL('../',import.meta.url))),root=path.resolve(process.argv[2]??'');
const temp=path.resolve(process.env.LOCALAPPDATA,'Temp');
if(!root.toLowerCase().startsWith((temp+path.sep).toLowerCase())||path.basename(root)!=='drl-original-core'||!/^drl-source-verify-[a-f0-9]{32}$/.test(path.basename(path.dirname(root))))throw Error('Clean source root confinement failed');
const digest=b=>createHash('sha256').update(b).digest('hex');
async function noLinks(p,base){for(let q=p;;q=path.dirname(q)){try{if((await fs.lstat(q)).isSymbolicLink())throw Error('Toolchain symlink rejected');}catch(e){if(e.code!=='ENOENT')throw e;}if(q.toLowerCase()===base.toLowerCase())break;if(!q.toLowerCase().startsWith(base.toLowerCase()+path.sep))throw Error('Toolchain path escaped base');}}
await noLinks(root,temp);
const manifest=JSON.parse(await fs.readFile(path.join(root,'SOURCE-BUNDLE.json'),'utf8'));
const records=[],fixed=[{path:'toolchain/fpc-src/compiler/ppcwasm32.exe',sha256:'5ac9eaad7c3276872ac0bd9f832c010214cec41562d3116b2d455be14028aa15'},...manifest.core.archives];
async function copy(rel,expected){if(/(^\/)|\\|:|(^|\/)\.\.(\/|$)/.test(rel))throw Error('Invalid prerequisite path');const src=path.join(task,rel),dst=path.join(root,rel);await noLinks(src,task);await noLinks(dst,root);const b=await fs.readFile(src),sha256=digest(b);if(expected&&sha256!==expected)throw Error('Pinned prerequisite differs: '+rel);await fs.mkdir(path.dirname(dst),{recursive:true});await noLinks(dst,root);await fs.writeFile(dst,b,{flag:'wx'});if(digest(await fs.readFile(src))!==sha256||digest(await fs.readFile(dst))!==sha256)throw Error('Prerequisite copy changed');records.push({path:rel,size:b.length,sha256});}
for(const f of fixed)await copy(f.path,f.sha256);
const packages=['rtl-objpas','rtl-generics','rtl-unicode','rtl-extra','hash','paszlib','fcl-base','fcl-xml','fcl-json'];
for(const rel of ['toolchain/rtl-exnref',...packages.map(p=>'toolchain/packages-exnref/'+p+'/units/wasm32-wasip1')]){const list=await fs.readdir(path.join(task,rel),{withFileTypes:true});const binaries=list.filter(e=>e.isFile()&&/\.(o|ppu)$/.test(e.name));if(!binaries.length||list.some(e=>e.isSymbolicLink()))throw Error('Standard unit directory incomplete');for(const f of binaries)await copy(rel+'/'+f.name);}
const result={schema:1,result:'pass',scope:'External standard compiler, precompiled standard units and six source-backed linker prerequisites; no game objects/WASM copied',root,core_sha256:manifest.core.sha256,compiler_sha256:fixed[0].sha256,files:records.length,bytes:records.reduce((n,f)=>n+f.size,0),records,game_objects_copied:false,game_wasm_copied:false,full_toolchain_bootstrap_verified:false};
await fs.writeFile(path.join(root,'EXTERNAL-TOOLCHAIN-PREREQUISITES.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
await fs.writeFile(path.join(task,'docs/source-clean-toolchain-'+manifest.core.sha256.slice(0,8)+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({result:'pass',files:result.files,bytes:result.bytes,core:manifest.core.sha256,root}));
