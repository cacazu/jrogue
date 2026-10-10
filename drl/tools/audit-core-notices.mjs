import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async p=>readFile(path.join(root,p));
const json=async p=>JSON.parse((await read(p)).toString('utf8').replace(/^\uFEFF/,''));
const sha=b=>createHash('sha256').update(b).digest('hex');
const audit=await json('docs/CORE-ALLOCATOR-AUDIT.json');
const link=await json('core-adapted/build/browser-core/link-evidence.json');
assert.equal(audit.result,'pass');assert.equal(link.imports_validated,true);
assert.equal(audit.wasm_sha256,link.wasm_sha256);
assert.equal(sha(await read('core-adapted/build/browser-core/drl-core.wasm')),audit.wasm_sha256);
assert.equal(sha(await read('core-adapted/build/browser-core/drl-core.map')),audit.map_sha256);
const manifest=await json('port/licenses/core/manifest.json');
for(const file of manifest.files){const bytes=await read('port/licenses/core/'+file.file);assert.equal(bytes.length,file.size);assert.equal(sha(bytes),file.sha256,'Retained permission text changed: '+file.file);}
for(const file of ['upstream__drl__LICENSE','upstream__fpcvalkyrie__LICENSE','upstream__lua-5.1.5__COPYRIGHT','toolchain__fpc-src__rtl__COPYING.FPC','WebAssembly__wasi-libc__LICENSE-APACHE-LLVM','WebAssembly__wasi-libc__libc-top-half__musl__COPYRIGHT','WebAssembly__wasi-libc__libc-bottom-half__cloudlibc__LICENSE','llvm__llvm-project__compiler-rt__LICENSE.TXT','Rust-Standard-Library-Copyright.html'])assert.ok(manifest.files.some(n=>n.file===file),'Required selected-family notice: '+file);
const mathDirectory='upstream/wasi-libc/libc-top-half/musl/src/math';
const selectedHeaders=[];
for(const name of await readdir(path.join(root,mathDirectory))){
  if(!name.endsWith('.c')||!audit.selected_libc_objects.includes(name+'.obj'))continue;
  const source=(await read(mathDirectory+'/'+name)).toString('utf8');
  const header=source.match(/^((?:\s*\/\*[\s\S]*?\*\/)+)/)?.[1];
  if(!header||!/(Sun Microsystems|Arm Limited)/.test(header))continue;
  const notice=manifest.files.find(f=>f.selected_object===name+'.obj');
  assert.ok(notice,'Missing selected math permission header: '+name);
  assert.equal(notice.source,mathDirectory+'/'+name);assert.equal(notice.source_sha256,sha(Buffer.from(source)));
  assert.ok((await read('port/licenses/core/'+notice.file)).toString('utf8').endsWith(header+'\n'),'Permission header is exact');
  selectedHeaders.push({object:name+'.obj',source:notice.source,source_sha256:notice.source_sha256,notice:notice.file});
}
const record={schema:1,result:'pass',recorded_utc:new Date().toISOString(),scope:'Static retention and selected Sun/Arm math notice audit for the exact linked original-core artifact; gameplay, full legal review and clean source reconstruction remain separate',core_sha256:audit.wasm_sha256,map_sha256:audit.map_sha256,permission_files:manifest.files.length,selected_libc_members:audit.selected_libc_objects.length,selected_math_headers:selectedHeaders,review_basis:'docs/FINAL-SOURCE-LICENSE-AUDIT.md',review_basis_sha256:sha(await read('docs/FINAL-SOURCE-LICENSE-AUDIT.md')),no_new_permissions_granted:true};
manifest.scope='Retained runtime-family permission pool; exact linked-object math notices and allocator ownership checked';
manifest.final_link_map_reviewed=true;manifest.selected_object_audit=record;
await writeFile(path.join(root,'port/licenses/core/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(root,'docs/FINAL-NOTICE-RETENTION.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({result:record.result,core:record.core_sha256,notices:record.permission_files,math_headers:selectedHeaders.length}));
