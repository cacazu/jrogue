/* Added 2026-10-02, NGPL. Does not instantiate WASM at import.
 * Actual compiled Rust formatter tests use explicitly synthetic typed envelopes.
 * They cannot prove the C buffer producer, filters, OOM or Asyncify lifetime.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const numeric=(type,value)=>({type,value});
const text=value=>numeric('text',value);
const formatExpected=(template,args)=>template.replace(/\{(arg_[0-9]+):(%(?:ld|[scdu]))\}/g,(_,name,format)=>format==='%c'?String.fromCharCode(args[name].value&255):String(args[name].value));
const MAX_OUTPUT=128*1024;

export function runPhase7CompiledFormatting({module,catalogJSON,stage}) {
  stage.requireExecution();assert.equal(stage.renderExport,'nh_rust_format_registered');
  for(const name of ['_nh_abi_semantic_event','_nh_rust_catalog_register','_nh_rust_catalog_release','_nh_rust_format_registered'])assert.equal(typeof module[name],'function');
  assert.equal(typeof catalogJSON,'string','Provide exact parent-hashed staged catalog bytes; no small replacement catalog');
  assert.equal(createHash('sha256').update(catalogJSON).digest('hex'),stage.catalogSha256);
  const state=()=>Object.fromEntries(['nh_abi_state_checksum','nh_abi_world_checksum','nh_abi_rng_checksum'].map(name=>[name,module.ccall(name,'number',[],[])>>>0]));
  const before=state(),cases=[];
  const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
  const catalogBytes=encoder.encode(catalogJSON);
  let handle=0,output=0,flag=0;
  const input=module._malloc(Math.max(1,catalogBytes.length));
  try {
    assert.ok(input);module.HEAPU8.set(catalogBytes,input);
    handle=module.ccall('nh_rust_catalog_register','number',['number','number'],[input,catalogBytes.length]);
    assert.ok(Number.isInteger(handle)&&handle>0,'Actual complete catalog registration must succeed');
  } finally {if(input)module._free(input);}
  let shortOutput;
  try {
    output=module._malloc(MAX_OUTPUT+2);flag=module._malloc(3);assert.ok(output&&flag);
    function withEnvelope(envelope,operation) {
      const bytes=encoder.encode(JSON.stringify(envelope)),event=module._malloc(Math.max(1,bytes.length));
      assert.ok(event);
      try {
        module.HEAPU8.set(bytes,event);
        return operation((locale,pointer,capacity)=>module.ccall(stage.renderExport,'number',Array(8).fill('number'),[handle,event,bytes.length,1,locale==='en'?1:0,pointer,capacity,flag+1]));
      } finally {module._free(event);}
    }
    for(const branch of stage.plan.branches) {
      const argumentVectors=branch.typed_arguments.length===2?
        [[numeric('integer',2147483647),numeric('integer',-2147483648)],[numeric('integer',42),numeric('integer',7)]]:
        branch.typed_arguments[0].type==='text'?[[text('m')],[text('^M')]]:
        branch.typed_arguments[0].c_conversion==='c'?[[numeric('integer',80)]]:
        branch.typed_arguments[0].type==='unsigned'?[[numeric('unsigned',0)],[numeric('unsigned',4294967295)]]:
        [[numeric('integer',-2147483648)],[numeric('integer',2147483647)]];
      for(const vector of argumentVectors) {
        const args=Object.fromEntries(branch.typed_arguments.map((argument,index)=>[argument.name,vector[index]]));
        const envelope={event:{id:branch.id,args},context:{api:branch.producer_line===536?'add_menu_str':branch.consumer_line===1098?'pline1':'putstr',helperVariant:'plain'}};
        const unchanged=JSON.stringify(envelope);
        withEnvelope(envelope,raw=>{
          for(const locale of ['ja','en']) {
            module.HEAPU8.fill(0xa5,output,output+MAX_OUTPUT+2);module.HEAPU8.fill(0xa5,flag,flag+3);
            const expected=formatExpected(branch[locale],args);
            const size=raw(locale,output+1,MAX_OUTPUT);
            assert.ok(Number.isInteger(size)&&size>=0&&size<=MAX_OUTPUT);
            const result=decoder.decode(module.HEAPU8.subarray(output+1,output+1+size));
            assert.equal(result,expected);assert.equal(module.HEAPU8[flag+1],0,'Exact installed source ID must render without fallback');
            assert.equal(module.HEAPU8[output],0xa5);assert.equal(module.HEAPU8[output+MAX_OUTPUT+1],0xa5);
            assert.equal(module.HEAPU8[flag],0xa5);assert.equal(module.HEAPU8[flag+2],0xa5);
            cases.push({id:branch.id,locale,args,result,evidence_class:'synthetic-typed-envelope-with-actual-compiled-Rust',actual_native_buffer_producer_verified:false});
          }
        });
        assert.equal(JSON.stringify(envelope),unchanged);
      }
    }
    const branch=stage.plan.branches.find(row=>row.producer_line===536);
    const envelope={event:{id:branch.id,args:{arg_1:text('m')}},context:{api:'add_menu_str',helperVariant:'plain'}};
    const expected=encoder.encode(formatExpected(branch.ja,envelope.event.args));
    withEnvelope(envelope,raw=>{
      module.HEAPU8.fill(0xa5,output,output+MAX_OUTPUT+2);module.HEAPU8.fill(0xa5,flag,flag+3);
      assert.equal(raw('ja',0,0),expected.length);
      assert.ok(module.HEAPU8.subarray(flag,flag+3).every(value=>value===0xa5),'Query must not write fallback');
      assert.equal(raw('ja',output+1,expected.length-1),expected.length);
      assert.ok(module.HEAPU8.subarray(output,output+MAX_OUTPUT+2).every(value=>value===0xa5));
      assert.ok(module.HEAPU8.subarray(flag,flag+3).every(value=>value===0xa5),'Short output must not write fallback');
      assert.equal(raw('ja',output+1,expected.length),expected.length);
      assert.deepEqual(module.HEAPU8.subarray(output+1,output+expected.length+1),expected);
      assert.equal(module.HEAPU8[flag+1],0);assert.equal(module.HEAPU8[flag],0xa5);assert.equal(module.HEAPU8[flag+2],0xa5);
      assert.equal(module.HEAPU8[output],0xa5);assert.equal(module.HEAPU8[output+expected.length+1],0xa5);
      shortOutput={utf8_bytes:expected.length,text_and_fallback_unchanged_for_query_and_short:true,exact_copy_canaries_unchanged:true,evidence_class:'actual-compiled-registered-Rust-ABI'};
    });
    for(const callback of ['shim_putstr','shim_add_menu','shim_end_menu'])for(const window of [-1,0,1,7])assert.equal(module.ccall('nh_abi_semantic_event','number',['string','number'],[callback,window]),0);
  } finally {
    try {if(handle)assert.equal(module.ccall('nh_rust_catalog_release','number',['number'],[handle]),0);}
    finally {if(output)module._free(output);if(flag)module._free(flag);}
  }
  const after=state();assert.deepEqual(after,before);
  return {cases,shortOutput,before,after,registered_catalog_lifecycle:'one explicit register/release outside formatting',actual_native_buffer_producer_verified:false,C_buffer_OOM_nesting_Asyncify_verified:false};
}
