// Preserve permission texts and inherited source notices. The final link-map
// review identifies actual embedded objects; this copies the reviewed pool.
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const directory='toolchain/acquisition/dependency-licenses';
const audit=JSON.parse(await readFile(path.join(root,directory,'core-dependency-license-audit.json'),'utf8'));
const downloads=JSON.parse(await readFile(path.join(root,directory,'manifest.json'),'utf8'));
const output=path.join(root,'port/licenses/core');
await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest={schema:1,scope:'retained permission and inherited source notice pool; selected-object audit pending',
  final_link_map_reviewed:false,files:[]};
async function retain(source,name,expected,purpose){
  const bytes=await readFile(source),sha256=hash(bytes);
  if(expected&&sha256!==expected)throw Error('Reviewed permission text changed: '+name);
  await writeFile(path.join(output,name),bytes);
  manifest.files.push({file:name,size:bytes.length,sha256,purpose});
}
for(const entry of audit.retained_notices)await retain(path.join(root,entry.retained_file),path.basename(entry.retained_file),entry.sha256,entry.purpose);
for(const entry of downloads){
  const name=path.basename(entry.file);
  // The acquisition record contains original executor paths. Resolve a reviewed
  // notice by its retained basename inside the owned current source tree.
  await retain(path.join(root,directory,name),name,entry.sha256,'downloaded upstream notice/source excerpt: '+entry.url);
}
const rustRoot=process.env.DRL_RUST_TOOLCHAIN??path.join(process.env.USERPROFILE,'.rustup/toolchains/1.98.1-x86_64-pc-windows-gnu');
await retain(path.join(rustRoot,'share/doc/rust/COPYRIGHT-library.html'),'Rust-Standard-Library-Copyright.html',null,'Installed Rust1.98.1 library copyright and permission record');
await retain(path.join(rustRoot,'lib/rustlib/src/rust/library/compiler-builtins/LICENSE.txt'),'Rust-Compiler-Builtins-License.txt',null,'Matching installed Rust compiler-builtins source notice');
await retain(path.join(root,'upstream/llvm-project/third-party/siphash/include/siphash/SipHash.h'),'LLVM-SipHash-Source-Notice.h',null,'Pinned compiler-rt builtins source/build dependency; permission text retained in header');
const selected=JSON.parse(await readFile(path.join(root,'docs/CORE-ALLOCATOR-AUDIT.json'),'utf8'));
const mathNames=['__cos','__rem_pio2','__rem_pio2_large','__sin','acos','asin','atan','atan2','cos','expm1','log10','sin','tan','__tan',
  'exp','exp_data','log','log_data','pow','pow_data'];
for(const name of mathNames){
  if(!selected.selected_libc_objects.includes(name+'.c.obj'))continue;
  const relative='upstream/wasi-libc/libc-top-half/musl/src/math/'+name+'.c';
  const source=await readFile(path.join(root,relative),'utf8');
  const header=source.match(/^((?:\s*\/\*[\s\S]*?\*\/)+)/)?.[1];
  if(!header||!/(Sun Microsystems|Arm Limited)/.test(header))throw Error('Expected selected math permission header: '+relative);
  const bytes=Buffer.from('Selected original source: '+relative+'\nPinned wasi-libc: 2e6fb9d8ee0cdf9e431fbcabe8af3115de000a13\n\n'+header+'\n');
  const file='musl-math__'+name+'.txt';
  await writeFile(path.join(output,file),bytes);
  manifest.files.push({file,size:bytes.length,sha256:hash(bytes),purpose:'Exact selected Sun/Arm math copyright and permission header',
    source:relative,source_sha256:hash(Buffer.from(source)),selected_object:name+'.c.obj'});
}
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({notices:manifest.files.length,bytes:manifest.files.reduce((sum,file)=>sum+file.size,0),final_link_map_reviewed:false}));
