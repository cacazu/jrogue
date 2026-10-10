import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, lstat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),task=path.dirname(here);
const upstream=process.argv[2];if(!upstream)throw Error('pristine upstream path required');
const plan=JSON.parse(await readFile(path.join(here,'FOCUSED-COMPILE-PLAN.json'),'utf8'));
const destination=path.resolve(plan.sourceStaging.destination);
assert.equal(destination,path.join(here,'build/sources/src'));
try{await lstat(destination);throw Error('refuse existing coherent source tree');}catch(error){if(error.code!=='ENOENT')throw error;}
const sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(destination,{recursive:true});
const final=new Map();
for(const row of plan.sourceStaging.pins){
 const before=await readFile(path.join(upstream,row.file));assert.equal(before.length,row.bytes);assert.equal(sha(before),row.sha256);
 const target=path.join(here,'build/sources',row.file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,before,{flag:'wx'});
 assert.equal(sha(await readFile(target)),row.sha256);final.set(row.file,{path:target,bytes:before.length,sha256:sha(before),origin:'pristine'});
}
for(const row of plan.sourceStaging.generatedFiles){
 const bytes=await readFile(path.join(here,row.file));assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
 const file=row.file.slice('generated/'.length),target=path.join(here,'build/sources',file);
 if(final.has(file))assert.equal(sha(await readFile(target)),final.get(file).sha256);
 await writeFile(target,bytes);assert.equal(sha(await readFile(target)),row.sha256);final.set(file,{path:target,bytes:bytes.length,sha256:sha(bytes),origin:'coordinated-generated-overlay'});
}
const pins=[...final.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
await writeFile(path.join(here,'COHERENT-SOURCE-STAGING.json'),JSON.stringify({schemaVersion:1,status:'coherent-source-copied-no-compiler-execution',sourceCommit:plan.sourceCommit,checkedAt:new Date().toISOString(),fileCount:pins.length,totalBytes:pins.reduce((n,r)=>n+r.bytes,0),pins,upstreamUnchanged:true,compilerExecuted:false},null,2)+'\n');
console.log(JSON.stringify({status:'coherent-source-copied-no-compiler-execution',files:pins.length,bytes:pins.reduce((n,r)=>n+r.bytes,0)}));
