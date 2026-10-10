// Authored probe contracts. Importing this module never compiles or runs WASM.
const cExpected={lua_version:'Lua 5.1',pointer_bytes:4,integer_bytes:8,number_bytes:8,
  debug_bytes:100,debug_lastlinedefined_offset:32,debug_short_src_offset:36,debug_i_ci_offset:96,
  buffer_bytes:1036,buffer_constant:1024,c_callbacks:2,protected_errors:true,
  syntax_error_recovery:true,coroutine_yield:true,large_buffer:true};
const mixedExpected={mixed_pascal_lua:true,callbacks:2,platform_semantic_callbacks:3,
  fixed_format:true,packed_format:true,debug_record_bytes:100,buffer_record_bytes:1036,
  pascal_buffer_bytes:4097,protected_callback_error:true,error_callbacks:2001,pascal_finally_count:0,
  allocator_patterns:true,allocator_oom_retains_old_block:true,interleaved_pascal_c_allocations:true,
  stdio_file_io:true,gc_iterations:5000};

export function validateProbeOutput(variant,output){
  if(!['c','mixed','mixed-jspi'].includes(variant))return ['Unknown probe variant: '+variant];
  if(output===null||typeof output!=='object'||Array.isArray(output))return ['Probe result must be a JSON object'];
  const expected=variant==='c'?cExpected:{...mixedExpected,...(variant==='mixed-jspi'?{suspended_pascal_callbacks:1,error_callbacks:2002}:{})};
  const errors=[];
  for(const [key,value] of Object.entries(expected))if(output[key]!==value)errors.push(`Unexpected ${key}: expected ${JSON.stringify(value)}, received ${JSON.stringify(output[key])}`);
  const keys=new Set(Object.keys(expected));
  if(variant!=='c'){
    for(const key of ['error_heap_first','error_heap_second']){
      keys.add(key);
      if(!Number.isSafeInteger(output[key])||output[key]<=0||output[key]>=67108864)errors.push('Invalid sampled heap byte count: '+key);
    }
    if(Number.isSafeInteger(output.error_heap_first)&&Number.isSafeInteger(output.error_heap_second)&&output.error_heap_second>output.error_heap_first+4096)errors.push('Repeated protected errors exceed the 4096-byte retained-heap tolerance');
  }
  for(const key of Object.keys(output))if(!keys.has(key))errors.push('Unexpected probe result field: '+key);
  return errors;
}

export function validateDigest(label,expected,actual){
  if(typeof expected!=='string'||!/^[0-9a-f]{64}$/.test(expected))return [label+': missing or invalid recorded SHA-256'];
  return expected===actual?[]:[label+': SHA-256 mismatch'];
}

export function validateBuildInputs(provenance,requiredPaths=[]){
  const errors=[];
  if(provenance?.schema_version!==1)return ['Missing supported build-time provenance schema'];
  if(provenance.inputs_stable!==true||!Array.isArray(provenance.errors)||provenance.errors.length)errors.push('Build inputs were not recorded as stable');
  const before=provenance.inputs_before,after=provenance.inputs_after;
  if(!Array.isArray(before)||!Array.isArray(after)||!before.length||before.length!==after.length)return [...errors,'Incomplete before/after build input snapshots'];
  const byPath=new Map();
  const kinds=new Set(['compiler','archive','pascal-source','pascal-overlay-source','rtl-ppu','rtl-object','shadow-startup']);
  for(const item of before){
    if(typeof item.path!=='string'||byPath.has(item.path))errors.push('Missing or duplicate before-build input path');
    if(!kinds.has(item.kind))errors.push('Unknown build input kind: '+item.kind);
    byPath.set(item.path,item);
    errors.push(...validateDigest('Before-build input '+item.path,item.sha256,item.sha256));
  }
  const seen=new Set();
  for(const item of after){
    if(seen.has(item.path))errors.push('Duplicate after-build input path: '+item.path);
    seen.add(item.path);
    const original=byPath.get(item.path);
    if(!original||original.kind!==item.kind)errors.push('After-build input lacks matching before record: '+item.path);
    else errors.push(...validateDigest('Changed build input '+item.path,original.sha256,item.sha256));
  }
  for(const file of requiredPaths)if(!byPath.has(file))errors.push('Required build-time input not captured: '+file);
  return errors;
}
