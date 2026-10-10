import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {auditAllocatorMap} from '../experiments/lua-wasi/link-validation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,''));
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex');
const link=read('core-adapted/build/browser-core/link-evidence.json');
const mapFile='core-adapted/build/browser-core/drl-core.map';
const wasmFile='core-adapted/build/browser-core/drl-core.wasm';
const refsFile='experiments/lua-wasi/allocator-symbol-refs.log';
const result={schema:1,created_utc:new Date().toISOString(),scope:'Final original-engine static allocator ownership; gameplay runtime proof is separate',
  wasm_sha256:hash(wasmFile),map_sha256:hash(mapFile),allocator_inventory_sha256:hash(refsFile),
  ...auditAllocatorMap(fs.readFileSync(path.join(root,mapFile),'utf8'),fs.readFileSync(path.join(root,refsFile),'utf8'))};
if(!link.imports_validated||!link.source_inputs_unchanged||!link.archives_unchanged||
  !link.compiled_sources.files.length||link.compiled_sources.unresolved.length)
  result.errors.push('Final link source/import proof incomplete');
if(link.wasm_sha256!==result.wasm_sha256)result.errors.push('Module no longer matches successful link');
const libc=link.archives.find(archive=>path.basename(archive.path)==='libc.a');
if(libc?.sha256!=='a9aff53312240258085fd94da05e18545f4c98b2f6a91ce4985b519eb8159fb9')
  result.errors.push('Allocator inventory is not for the linked official libc');
if(result.inventory_reference_count!==76)result.errors.push('Official libc allocator reference inventory changed');
for(const archive of link.archives){
  const relative=path.relative(root,archive.path);
  if(hash(relative)!==archive.sha256)result.errors.push('Linked archive changed: '+relative);
}
result.result=result.errors.length?'fail':'pass';
fs.writeFileSync(path.join(root,'docs/CORE-ALLOCATOR-AUDIT.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({result:result.result,libc_objects:result.selected_libc_objects.length,
  allocator_references:result.selected_allocator_references.length,errors:result.errors}));
process.exitCode=result.errors.length?1:0;
