import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WASI} from 'node:wasi';
import crypto from 'node:crypto';
import {validateProbeOutput,validateDigest} from './probe-validation.mjs';
import {auditMixedSources} from './source-audit.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const variant=process.argv[2]??'c';
if(!['c','mixed'].includes(variant)){
  console.error('Usage: node run-node.mjs [c|mixed]. The mixed-jspi probe requires the browser Suspending/promising host.');
  process.exitCode=1;
}else{
const started_utc=new Date().toISOString();
const stdoutPath=path.join(root,variant==='mixed'?'node-mixed-stdout.log':'node-stdout.log');
const stderrPath=path.join(root,variant==='mixed'?'node-mixed-stderr.log':'node-stderr.log');
let stdoutFd,stderrFd,module,instance,wasm_sha256=null,source_audit=null;
let exit_code=null,failure=null,output=null,stage='open-output';
try{
  stdoutFd=fs.openSync(stdoutPath,'w');
  stderrFd=fs.openSync(stderrPath,'w');
  stage='read-module';
  const bytes=fs.readFileSync(path.join(root,variant==='mixed'?'mixed-build/mixed-probe.wasm':'build/lua-probe.wasm'));
  wasm_sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  stage='source-audit';
  if(variant==='mixed')source_audit=await auditMixedSources(root,variant,wasm_sha256);
  else{
    const errors=validateDigest('Validated C-only snapshot','97a5687842af3dbe7f8072d6233c214e3010aeb76b3567e45cba27b0304bfe55',wasm_sha256);
    source_audit={result:errors.length?'fail':'pass',wasm_sha256,errors,scope:'Previously validated C-only module snapshot; current mixed archives are separate.'};
  }
  if(source_audit.result!=='pass')throw Error('Source audit failed: '+source_audit.errors.join('; '));
  if(variant==='mixed'&&source_audit.complete_provenance!==true)throw Error('This historical mixed build lacks captured Pascal/RTL/map inputs; rebuild with the current build-mixed.ps1 before guarded execution.');
  stage='compile';module=await WebAssembly.compile(bytes);
  const vfs=path.join(root,'probe-vfs');if(variant==='mixed')fs.mkdirSync(vfs,{recursive:true});
  const wasi=new WASI({version:'preview1',args:['lua-probe'],env:{},preopens:variant==='mixed'?{'/probe':vfs}:{},stdout:stdoutFd,stderr:stderrFd,returnOnExit:true});
  stage='instantiate';instance=await WebAssembly.instantiate(module,wasi.getImportObject());
  stage='start';exit_code=wasi.start(instance);
}catch(error){failure={stage,name:error.name,message:error.message,stack:error.stack};}
finally{
  for(const descriptor of [stdoutFd,stderrFd])if(descriptor!==undefined){
    try{fs.closeSync(descriptor);}catch(error){failure??={stage:'close-output',name:error.name,message:error.message};}
  }
}
const stdout=stdoutFd===undefined?'':fs.readFileSync(stdoutPath,'utf8');
const stderr=stderrFd===undefined?'':fs.readFileSync(stderrPath,'utf8');
try{output=JSON.parse(stdout.trim());}catch(error){failure??={stage:'parse-output',name:error.name,message:'Probe stdout is not a JSON result: '+error.message};}
const validation_errors=validateProbeOutput(variant,output);
const linked_layout={};
for(const name of ['__stack_pointer','__heap_base'])if(instance?.exports[name] instanceof WebAssembly.Global)linked_layout[name]=instance.exports[name].value;
if(variant==='mixed'&&instance&&!(linked_layout.__stack_pointer>0&&linked_layout.__heap_base>linked_layout.__stack_pointer))validation_errors.push('Exported heap/stack layout is absent or inconsistent');
const success=exit_code===0&&failure===null&&stderr.length===0&&validation_errors.length===0&&source_audit?.result==='pass';
const result={started_utc,variant,wasm_sha256,result:success?'pass':'fail',exit_code,output,stdout,stderr,failure,validation_errors,source_audit,linked_layout,imports:module?WebAssembly.Module.imports(module):[],exports:module?WebAssembly.Module.exports(module):[],node_version:process.version,pristine_game_executed:false,pascal_callback_tested:success&&variant==='mixed',full_game:false};
fs.writeFileSync(path.join(root,variant==='mixed'?'node-mixed-evidence.json':'node-evidence.json'),JSON.stringify(result,null,2)+'\n');
console.error(JSON.stringify(result));
process.exitCode=success?0:exit_code||1;
}
