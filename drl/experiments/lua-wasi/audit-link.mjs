import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {auditAllocatorMap} from './link-validation.mjs';
import {auditMixedSources,sha256File} from './source-audit.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const mapPath=path.resolve(process.argv[2]??path.join(root,'mixed-build/mixed.map'));
const variant=path.basename(mapPath)==='mixed-jspi.map'?'mixed-jspi':'mixed';
const result={started_utc:new Date().toISOString(),map:path.relative(root,mapPath).replaceAll('\\','/'),
  result:'fail',errors:[],scope:'Static link ownership and current recorded-input audit; runtime evidence is separate.',
  limits:['The historical build record does not capture a map hash; this map is associated by its recorded command path.']};
try{
  const map=fs.readFileSync(mapPath,'utf8');
  const referencePath=path.join(root,'allocator-symbol-refs.log');
  Object.assign(result,auditAllocatorMap(map,fs.readFileSync(referencePath,'utf8')));
  result.map_sha256=crypto.createHash('sha256').update(map).digest('hex');
  result.allocator_inventory_sha256=await sha256File(referencePath);
  result.source_audit=await auditMixedSources(root,variant);
  result.complete_build_provenance=result.source_audit.complete_provenance;
  if(result.complete_build_provenance)result.limits=[];
  result.errors.push(...result.source_audit.errors);
  const record=JSON.parse(fs.readFileSync(path.join(root,result.source_audit.build_record),'utf8').replace(/^\uFEFF/,''));
  if(!record.command.includes('-k--Map='+mapPath))result.errors.push('Map path differs from the recorded build command');
  // The retained nm inventory was captured from this exact official SDK libc archive.
  const libc=record.archives.find(item=>path.basename(item.path)==='libc.a');
  if(libc?.sha256!=='a9aff53312240258085fd94da05e18545f4c98b2f6a91ce4985b519eb8159fb9')result.errors.push('Allocator inventory does not cover this libc archive');
  if(result.inventory_reference_count!==76)result.errors.push('Pinned allocator inventory must contain 76 references');
  result.result=result.errors.length?'fail':'pass';
}catch(error){result.errors.push(error.name+': '+error.message);}
fs.writeFileSync(path.join(root,variant==='mixed-jspi'?'link-audit-jspi.json':'link-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({result:result.result,wasm_sha256:result.source_audit?.wasm_sha256,
  selected_objects:result.selected_libc_objects?.length,allocator_references:result.selected_allocator_references?.length,errors:result.errors}));
process.exitCode=result.result==='pass'?0:1;
