/* SPDX-License-Identifier: GPL-3.0-or-later
 * Actual retained fullsave -> one original frame -> owned TMP1/Rust observation.
 * Parent owns execution. No draw loop, commands, cache forcing, or retry path.
 */
import nativeFactory from '/native/tome-native.mjs';
import {mountOriginalInputs} from '/bootstrap/browser_vfs_mounts.mjs';
import {OriginalCheckpointStore} from '/checkpoint/checkpoint_store.mjs';
import {actualNativeArchiveValidator} from '/checkpoint/native_archive_validator.mjs';
import {saveBaselineCheckpoint} from '/checkpoint/baseline_flow.mjs';

const locale=new URL(location.href).searchParams.get('lang')==='en'?'en':'ja';
const report=window.tomePreparedMapReport={protocol:1,completed:false,passed:false,phase:'source-load',
  document_time_origin:performance.timeOrigin,scope:'Actual original fullsave then one original map observation',
  full_renderer_ready:false,renderer_purity_claim:false,full_campaign_claim:false,input_disabled:true,
  external_original_frame_calls:0,native_calls:[],checks:[],original_errors:[]};
const canvas=document.querySelector('#game'),statusNode=document.querySelector('#status'),log=document.querySelector('#log');
let module,catalog,ownedPacket,rust,terminal=false;
const observations={},lines=[];
const MAX_PACKET=64*1024*1024,HEAP_CHUNK=1024*1024;

// Registered before nativeFactory can install SDL handlers. This page has no
// original input route, including during asynchronous save/hash/transport work.
for(const name of ['keydown','keyup','keypress','pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove','wheel','touchstart','touchmove','touchend'])
  window.addEventListener(name,event=>{if(event.type.startsWith('key')||event.target===canvas){event.preventDefault();event.stopImmediatePropagation();}},
    {capture:true,passive:false});
function fail(id,detail){const error=new Error(id);error.text_id=id;error.detail=detail;throw error;}
function check(name,condition,detail){report.checks.push({name,passed:!!condition,detail});if(!condition)fail(name,detail);}
function show(id){statusNode.textContent=catalog?.[id]||id;}
function print(...values){
  const raw=values.map(String).join(' ');
  if(/(?:Lua Error:|Display callback error:|Map z-callback error:|TOME_NATIVE_ERROR=|Aborted\()/.test(raw))
    report.original_errors.push({phase:report.phase,message:raw.slice(0,8192)});
  const value=/^TOME_REAL_[A-Z_]+_JSON=/.test(raw)?raw.slice(0,raw.indexOf('='))+'=<original finite snapshot emitted>':raw;
  lines.push(value.slice(0,4096));if(lines.length>120)lines.shift();log.textContent=lines.join('\n');
  console.log(value);
}
function native(name,type,args=[],argTypes=args.map(()=> 'number')){
  if(terminal)fail('observer.native.instance_terminal',{name});
  report.native_calls.push(name);
  return module.ccall(name,type,argTypes,args);
}
function nativeJson(name,args=[]){
  const value=native(name,'string',args);if(!value)fail('observer.native.metadata_failed',{name,error:native('tome_native_prepared_map_last_error','string')});
  try{return JSON.parse(value);}catch(error){fail('observer.native.metadata_invalid',{name,message:error.message});}
}
function snapshot(){
  const value=native('tome_native_snapshot','string');if(!value)fail('observer.native.snapshot_failed');return JSON.parse(value);
}
function rng(){
  const value=native('tome_native_rng_snapshot_hex','string');
  if(!/^[0-9a-f]{5176}$/.test(value||''))fail('observer.native.baseline_rng_unavailable');return value;
}
function observe(label){const value={snapshot:snapshot(),rng:rng()};observations[label]=value;return value;}
function pendingError(label){
  const pending=native('tome_native_prepared_map_lua_error_pending','number');
  if(pending!==0&&pending!==1)fail('observer.native.pending_error_invalid',{label,pending});
  const value={pending};if(pending)value.message=native('tome_native_prepared_map_lua_error_message','string');
  report[label]=value;return value;
}
const bytesHex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
async function sha(bytes){return bytesHex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));}
async function scanNativeMemory(){
  const initial=module.HEAPU8,length=initial.byteLength,buffer=initial.buffer,hashes=[];
  for(let start=0;start<length;start+=HEAP_CHUNK){
    if(module.HEAPU8.buffer!==buffer||module.HEAPU8.byteLength!==length)fail('observer.purity.native_memory_grew_during_scan',{start,length});
    hashes.push(await sha(initial.slice(start,Math.min(start+HEAP_CHUNK,length))));
  }
  if(module.HEAPU8.buffer!==buffer||module.HEAPU8.byteLength!==length)fail('observer.purity.native_memory_grew_during_scan',{length});
  return {bytes:length,chunk_bytes:HEAP_CHUNK,hashes};
}
function compareMemory(before,after){
  const changed=[];
  if(before.bytes===after.bytes)for(let i=0;i<before.hashes.length;i++)if(before.hashes[i]!==after.hashes[i])changed.push(i*HEAP_CHUNK);
  return {equal:before.bytes===after.bytes&&before.hashes.length===after.hashes.length&&changed.length===0,
    bytes_before:before.bytes,bytes_after:after.bytes,chunk_bytes:HEAP_CHUNK,chunks_compared:before.hashes.length,
    changed_chunk_byte_offsets:changed,method:'SHA-256 of every whole-memory consecutive chunk; no masks or exclusions'};
}
function copyNativePacket(){
  const pointer=native('tome_native_prepared_map_packet_ptr','number'),length=native('tome_native_prepared_map_packet_size','number');
  if(!Number.isInteger(pointer)||pointer<=0||!Number.isInteger(length)||length<64||length>MAX_PACKET||pointer+length>module.HEAPU8.byteLength)
    fail('observer.native.packet_range_invalid',{pointer,length,heap:module.HEAPU8.byteLength});
  return {pointer,length,bytes:module.HEAPU8.slice(pointer,pointer+length)};
}
function sameBytes(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
function encode64(bytes){let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);}

// Independent byte spans used to compare actual C output against Rust output.
// This reads no game map and implements no simulation or replacement renderer.
function nativeWire(bytes){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),events=[],draws=[];
  const u=(at)=>v.getUint32(at,true),i=(at)=>v.getInt32(at,true),f=(at)=>v.getFloat32(at,true);
  const array=(at,count,read)=>Array.from({length:count},(_,n)=>read(at+4*n));
  if(new TextDecoder().decode(bytes.subarray(0,4))!=='TMP1'||u(4)!==1||u(8)!==64||u(24)!==bytes.length)fail('observer.wire.header_invalid');
  const header={flags:u(12),epoch:Number(v.getBigUint64(16,true)),bytes:u(24),events:u(28),draws:u(32),
    width:u(36),height:u(40),zdepth:u(44),keyframes:i(48)};
  let at=64;
  for(let index=0;index<header.events;index++){
    if(at+16>bytes.length)fail('observer.wire.record_truncated',{index,at});
    const kind=u(at),length=u(at+4),sequence=u(at+8),layer=i(at+12),p=at+16;
    if(length<16||at+length>bytes.length||sequence!==index+1)fail('observer.wire.record_invalid',{index,at,length,sequence});
    const event={index,kind,sequence,layer,record_start:at};
    if(kind===1){
      const n=u(p+4),q=u(p+24);if(length!==232+32*n+12*q||n!==q*6||!n)fail('observer.wire.batch_invalid',{index,n,q,length});
      let start=p+216;const counts=[2*n,2*n,4*n,3*q],arrays=counts.map(words=>{const span={start,words,bytes:4*words};start+=span.bytes;return span;});
      const gl={active_unit_2d_texture:u(p+8),cached_program:u(p+12),cached_framebuffer:u(p+16),active_texture_unit:u(p+20),
        capture_flags_at_batch:u(p+28),viewport:array(p+32,4,i),scissor_box:array(p+48,4,i),blend_enabled:u(p+64)===1,
        scissor_enabled:u(p+68)===1,blend_factors:array(p+72,4,u),modelview:array(p+88,16,f),projection:array(p+152,16,f)};
      Object.assign(event,{draw_index:draws.length,vertex_count:n,quad_count:q,arrays,gl});draws.push(event);
    }else if(kind===8){
      const width=u(p+4),height=u(p+8),count=width*height*4;
      if(!Number.isSafeInteger(count)||length!==32+count||u(p+12)!==0x80e1)fail('observer.wire.seen_invalid',{index,width,height,length});
      Object.assign(event,{native_texture:u(p),width,height,start:p+16,bytes:count});
    }else if(kind<2||kind>7||length!==16)fail('observer.wire.marker_invalid',{index,kind,length});
    events.push(event);at+=length;
  }
  if(at!==bytes.length||draws.length!==header.draws)fail('observer.wire.counts_differ',{at,bytes:bytes.length});
  return {header,events,draws};
}
function f32Bits(value){const b=new ArrayBuffer(4),v=new DataView(b);v.setFloat32(0,value,true);return v.getUint32(0,true);}
function compareDrawMetadata(actual,source){
  const expected={kind:1,draw_index:source.draw_index,source_sequence:source.sequence,native_layer_at_flush:source.layer,
    vertex_count:source.vertex_count,quad_count:source.quad_count,array_word_counts:source.arrays.map(x=>x.words),full_renderer_ready:false};
  for(const [key,value]of Object.entries(expected))if(JSON.stringify(actual[key])!==JSON.stringify(value))fail('observer.rust.draw_metadata_differs',{key,draw:source.draw_index});
  for(const [key,value]of Object.entries(source.gl)){
    if(key==='modelview'||key==='projection'){
      if(actual.gl?.[key]?.length!==16||value.some((n,j)=>f32Bits(n)!==f32Bits(actual.gl[key][j])))fail('observer.rust.transform_bits_differ',{key,draw:source.draw_index});
    }else if(JSON.stringify(actual.gl?.[key])!==JSON.stringify(value))fail('observer.rust.gl_metadata_differs',{key,draw:source.draw_index});
  }
}
class RustPacket {
  constructor(exports){this.e=exports;this.calls=0;for(const name of ['begin','write_word','commit','release','status','event','draw','draw_words','seen_bytes','output_kind','output_len','output_word','error_code','full_replay'])
    if(typeof exports['tome_map_wasm_'+name]!=='function')fail('observer.rust.export_missing',{name});}
  call(name,args=[]){this.calls++;return this.e['tome_map_wasm_'+name](...args);}
  ok(name,args=[]){const result=this.call(name,args);if(result!==1)fail('observer.rust.call_rejected',{name,result,error_code:this.call('error_code')});}
  output(kind){
    if(this.call('output_kind')!==kind)fail('observer.rust.output_kind_invalid',{kind});
    const length=this.call('output_len')>>>0;if(length>16384)fail('observer.rust.output_limit_exceeded',{length});
    const bytes=new Uint8Array(length),view=new DataView(bytes.buffer);
    for(let at=0;at<length;at+=4){const word=this.call('output_word',[at])>>>0;
      if(at+4<=length)view.setUint32(at,word,true);else for(let j=0;j<length-at;j++)bytes[at+j]=(word>>>(8*j))&255;}
    return bytes;
  }
  json(name,args=[]){this.ok(name,args);return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(this.output(1)));}
  binary(name,args=[]){this.ok(name,args);return this.output(2);}
  upload(bytes,epoch,generation){
    const split=n=>[Number(n&0xffffffffn),Number(n>>32n)];this.ok('begin',[bytes.length,...split(epoch),...split(generation)]);
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    for(let at=0;at<bytes.length;at+=4){const valid=Math.min(4,bytes.length-at);let word=0;
      if(valid===4)word=view.getUint32(at,true);else for(let j=0;j<valid;j++)word|=bytes[at+j]<<(8*j);
      this.ok('write_word',[at,word>>>0,valid]);}
    this.ok('commit');
  }
}
function rejectCorruptRust(compiled,bytes,wire,epoch,generation){
  const cases=[
    {name:'unknown protocol',bytes:()=>{const altered=bytes.slice();new DataView(altered.buffer).setUint32(4,2,true);return altered;}},
    {name:'truncated actual packet',bytes:()=>bytes.slice(0,-1)},
    {name:'nonfinite actual vertex',bytes:()=>{const altered=bytes.slice();new DataView(altered.buffer).setUint32(wire.draws[0].arrays[0].start,0x7fc00000,true);return altered;}},
    {name:'source layer outside actual map',bytes:()=>{const altered=bytes.slice();new DataView(altered.buffer).setInt32(wire.draws[0].record_start+12,wire.header.zdepth,true);return altered;}},
    {name:'stale expected epoch',bytes:()=>bytes,epoch:epoch+1},
  ];
  const results=[];
  for(const test of cases){
    const probe=new RustPacket(new WebAssembly.Instance(compiled,{}).exports);let rejected=false,reason;
    try{probe.upload(test.bytes(),BigInt(test.epoch||epoch),generation);}catch(error){
      rejected=error.text_id==='observer.rust.call_rejected'&&error.detail?.name==='commit'&&error.detail?.error_code===4;reason=error.detail;
    }
    const state=probe.json('status');
    check('observer.rust.corruption_rejected.'+test.name,rejected&&state.phase==='rejected'&&state.error_code===4&&state.full_renderer_ready===false&&probe.call('full_replay')===0,
      {source:'fresh Rust instance; mutation of actual copied native bytes only',reason,state});
    results.push({name:test.name,rejected,state});probe.ok('release');
  }
  const incomplete=new RustPacket(new WebAssembly.Instance(compiled,{}).exports);
  const split=n=>[Number(n&0xffffffffn),Number(n>>32n)];
  incomplete.ok('begin',[bytes.length,...split(BigInt(epoch)),...split(generation)]);
  incomplete.ok('write_word',[0,new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0,true),4]);
  const gap=incomplete.call('write_word',[8,0,4]),gapCode=incomplete.call('error_code');
  check('observer.rust.nonsequential_upload_rejected',gap===0&&gapCode===3&&incomplete.call('full_replay')===0,{result:gap,error_code:gapCode});
  const partial=incomplete.call('commit'),partialCode=incomplete.call('error_code');
  check('observer.rust.incomplete_upload_rejected',partial===0&&partialCode===2&&incomplete.call('full_replay')===0,{result:partial,error_code:partialCode});
  results.push({name:'nonsequential and incomplete upload',rejected:true,error_codes:[gapCode,partialCode]});incomplete.ok('release');
  report.rust_corruption_probes=results;
}
async function compileRust(){
  const response=await fetch('/rust/tome-map-packet.wasm',{cache:'no-store'});if(!response.ok)fail('observer.rust.artifact_missing',{status:response.status});
  const artifact=new Uint8Array(await response.arrayBuffer());report.rust_artifact_sha256=await sha(artifact);
  const compiled=await WebAssembly.compile(artifact),imports=WebAssembly.Module.imports(compiled);report.rust_wasm_imports=imports;
  check('observer.rust.has_zero_imports',imports.length===0,imports);
  return compiled;
}
function checkRust(compiled,bytes,wire,epoch,generation){
  rust=new RustPacket(new WebAssembly.Instance(compiled,{}).exports);
  check('observer.rust.owns_distinct_memory',rust.e.memory.buffer!==module.HEAPU8.buffer);
  rust.upload(bytes,BigInt(epoch),generation);const metadata=rust.json('status');report.rust_metadata=metadata;
  check('observer.rust.header_matches_actual_packet',metadata.phase==='validated'&&metadata.protocol===1&&metadata.epoch===epoch&&metadata.vm_generation===String(generation)&&
    metadata.capture_flags===wire.header.flags&&metadata.packet_bytes===bytes.length&&metadata.event_count===wire.events.length&&metadata.draw_count===wire.draws.length&&
    metadata.map?.width===wire.header.width&&metadata.map?.height===wire.header.height&&metadata.map?.native_zdepth===wire.header.zdepth&&metadata.original_keyframes===wire.header.keyframes,metadata);
  let words=0,seenBytes=0;
  for(const event of wire.events){
    const actual=rust.json('event',[event.index]);
    if(actual.kind!==event.kind||actual.source_sequence!==event.sequence||actual.full_renderer_ready!==false)
      fail('observer.rust.event_source_differs',{index:event.index,actual,source:event});
    if(event.kind===1)compareDrawMetadata(actual,event);
    else if(actual.native_layer!==event.layer)fail('observer.rust.event_layer_differs',{index:event.index});
    if(event.kind===8){
      if(actual.native_texture!==event.native_texture||actual.width!==event.width||actual.height!==event.height||actual.byte_count!==event.bytes||actual.format!=='BGRA')
        fail('observer.rust.seen_metadata_differs',{index:event.index});
      for(let start=0;start<event.bytes;start+=16384){const count=Math.min(16384,event.bytes-start),output=rust.binary('seen_bytes',[event.index,start,count]);
        if(!sameBytes(output,bytes.subarray(event.start+start,event.start+start+count)))fail('observer.rust.seen_bytes_differ',{index:event.index,start,count});seenBytes+=count;}
    }
  }
  for(const draw of wire.draws){
    const actual=rust.json('draw',[draw.draw_index]);compareDrawMetadata(actual,draw);
    for(let kind=1;kind<=4;kind++){const span=draw.arrays[kind-1];
      for(let start=0;start<span.words;start+=4096){const count=Math.min(4096,span.words-start),output=rust.binary('draw_words',[draw.draw_index,kind,start,count]);
        if(!sameBytes(output,bytes.subarray(span.start+4*start,span.start+4*(start+count))))fail('observer.rust.array_bits_differ',{draw:draw.draw_index,kind,start,count});words+=count;}
    }
  }
  const stable=JSON.stringify(rust.json('status'));
  for(let n=0;n<8;n++){
    if(rust.call('full_replay')!==0||JSON.stringify(rust.json('status'))!==stable)fail('observer.rust.replay_or_status_changed');
  }
  check('observer.rust.reads_match_all_actual_arrays',true,{draws:wire.draws.length,events:wire.events.length,array_words:words,seen_bytes:seenBytes});
  check('observer.rust.replay_always_rejected',metadata.full_renderer_ready===false&&rust.call('full_replay')===0);
  report.rust_calls=rust.calls;rust.ok('release');
  rejectCorruptRust(compiled,bytes,wire,epoch,generation);
}
window.tomePreparedMapProbe={
  report,observations:()=>structuredClone(observations),packetInfo:()=>ownedPacket?{bytes:ownedPacket.length,sha256:report.packet?.sha256}:null,
  packetChunk:(start,count)=>{
    if(!ownedPacket||!Number.isSafeInteger(start)||!Number.isSafeInteger(count)||start<0||count<1||count>1048576||start+count>ownedPacket.length)
      fail('observer.export.range_invalid',{start,count});
    return {start,bytes:count,encoding:'base64',data:encode64(ownedPacket.subarray(start,start+count))};
  },
};

try{
  const localized=await fetch('/observer/i18n/'+locale+'.json',{cache:'no-store'});if(!localized.ok)fail('observer.catalog.unavailable');catalog=await localized.json();
  document.documentElement.lang=locale;document.title=catalog['observer.ui.title'];
  for(const node of document.querySelectorAll('[data-text]')){const text=catalog[node.dataset.text];if(typeof text!=='string')fail('observer.catalog.text_id_missing',{id:node.dataset.text});node.textContent=text;}
  show('observer.ui.loading');report.phase='fresh-factory';
  const sources=await(await fetch('/checkpoint/source-manifest.json',{cache:'no-store'})).json();
  module=await nativeFactory({canvas,noInitialRun:true,locateFile:name=>'/native/'+name,print,printErr:print,
    onAbort:reason=>{report.native_abort=String(reason);terminal=true;}});
  for(const name of ['tome_native_prepared_map_install','tome_native_prepared_map_begin','tome_native_prepared_map_seal','tome_native_prepared_map_status',
    'tome_native_prepared_map_release','tome_native_prepared_map_packet_ptr','tome_native_prepared_map_packet_size','tome_native_prepared_map_last_error',
    'tome_native_prepared_map_lua_error_pending','tome_native_prepared_map_lua_error_message'])
    if(typeof module['_'+name]!=='function')fail('observer.native.required_export_missing',{name});
  // One fresh modularized instance and one original init. No same-instance reset.
  const generation=1n;report.vm_generation=String(generation);report.vm_generation_scope='one fresh module owned by this document';
  const vfs=await mountOriginalInputs(module);report.vfs_metrics={...vfs.metrics};
  const compatibility={schema:1,engine:'te4-1.7.6',module:'tome-1.7.6',core_version:17,lua_abi:'5.1.5',target:'wasm32',sdk:'6.0.8',libc_rng:'emsdk-musl-rand-v1',
    upstream_commit:vfs.manifest.upstream_commit,source_archive_sha256:vfs.manifest.source_archive_sha256,adapter_sources_sha256:sources.bundle_sha256};
  const store=new OriginalCheckpointStore(module,{compatibility,validateOriginalArchives:actualNativeArchiveValidator(module)});
  report.phase='idbfs-populate';await store.initialize();
  report.existing_verified_head=store.verifiedHead?structuredClone(store.verifiedHead):null;
  check('observer.original.fresh_durable_store',!store.verifiedHead,{existing_head:report.existing_verified_head,
    required_action:'Use a fresh private browser profile/origin; do not delete or clear an existing store'});
  report.phase='original-birth';check('observer.original.initialized_once',native('tome_native_init','number')===1);
  check('observer.original.birth_completed',native('tome_native_start','number')===1);
  report.before_first_save=observe('before_first_save');
  check('observer.original.player_exists',report.before_first_save.snapshot.ready===true&&!!report.before_first_save.snapshot.game?.player&&!!report.before_first_save.snapshot.game?.level);
  pendingError('before_save_original_error');check('observer.original.no_birth_error',report.before_save_original_error.pending===0&&report.original_errors.length===0);
  // No initial baseline draw. The genuine save owns any screenshot preparation.
  report.phase='first-genuine-fullsave';show('observer.ui.saving');
  const saved=await saveBaselineCheckpoint(module,store,{generation:'map_observer_'+crypto.randomUUID().replaceAll('-',''),onStatus:value=>report.save_operation=value});
  report.fullsave={operation:saved.operation,durable:saved.durable};
  check('observer.original.fullsave_committed_and_released',saved.operation.phase==='complete'&&saved.durable.phase==='committed'&&module._tome_web_checkpoint_busy()===0,
    {operation:saved.operation,durable:saved.durable.phase});
  pendingError('after_save_original_error');check('observer.original.no_save_error',report.after_save_original_error.pending===0&&report.original_errors.length===0);
  report.phase='map-install';check('observer.native.adapter_installed',native('tome_native_prepared_map_install','number')===1);
  const epoch=1;report.application_epoch=epoch;report.phase='map-begin';report.map_begin=nativeJson('tome_native_prepared_map_begin',[epoch,16*1024*1024]);
  report.effectful_frame_before=observe('effectful_frame_before');
  pendingError('before_frame_original_error');check('observer.original.no_preparation_error',report.before_frame_original_error.pending===0);
  report.phase='one-original-frame';show('observer.ui.capturing');const priorErrors=report.original_errors.length;
  report.external_original_frame_calls++;
  check('observer.original.one_frame_returned',native('tome_native_draw_baseline','number')===1);
  pendingError('after_frame_original_error');
  check('observer.original.frame_has_no_reported_lua_error',report.after_frame_original_error.pending===0&&report.original_errors.length===priorErrors,
    {pending:report.after_frame_original_error,printed_errors:report.original_errors.slice(priorErrors)});
  report.phase='post-frame-lifecycle';report.map_after_frame=nativeJson('tome_native_prepared_map_status');
  check('observer.original.native_map_returned_exactly_once',report.map_after_frame.entered===1&&report.map_after_frame.returned===1&&report.map_after_frame.depth===0,
    {status:report.map_after_frame,unsupported_reason:report.map_after_frame.entered===0?'natural map/FBO cache hit or unsupported original display path':'missing, repeated, or incomplete map return; no retry'});
  check('observer.native.no_capture_failure_flags',(report.map_after_frame.flags&(16|32|64|128|256))===0,report.map_after_frame);
  report.effectful_frame_after=observe('effectful_frame_after');
  report.effectful_frame_changes={finite_snapshot_changed:JSON.stringify(report.effectful_frame_before.snapshot)!==JSON.stringify(report.effectful_frame_after.snapshot),
    complete_rng_changed:report.effectful_frame_before.rng!==report.effectful_frame_after.rng,purity_expected:false};
  report.phase='map-seal';report.map_sealed=nativeJson('tome_native_prepared_map_seal',[epoch]);
  check('observer.native.sealed_incomplete_packet',report.map_sealed.phase==='sealed'&&report.map_sealed.epoch===epoch&&report.map_sealed.full_renderer_ready===false);
  report.phase='native-getter-purity';show('observer.ui.checking');
  const semanticBefore=observe('native_getters_before');
  report.map_getter_status=nativeJson('tome_native_prepared_map_status');
  const warmed=copyNativePacket();ownedPacket=warmed.bytes;
  const memoryBefore=await scanNativeMemory();
  for(let n=0;n<8;n++){const copy=copyNativePacket();if(copy.pointer!==warmed.pointer||copy.length!==warmed.length||!sameBytes(copy.bytes,ownedPacket))fail('observer.native.repeated_packet_differs',{n});}
  const memoryAfter=await scanNativeMemory();report.native_binary_memory_purity=compareMemory(memoryBefore,memoryAfter);
  check('observer.native.binary_getters_preserve_whole_memory',report.native_binary_memory_purity.equal,report.native_binary_memory_purity);
  const semanticAfter=observe('native_getters_after');
  check('observer.native.getters_preserve_original_snapshot_and_rng',JSON.stringify(semanticBefore)===JSON.stringify(semanticAfter));
  check('observer.native.packet_size_matches_metadata',ownedPacket.length===report.map_sealed.bytes,{actual:ownedPacket.length,metadata:report.map_sealed.bytes});
  const wire=nativeWire(ownedPacket);
  check('observer.native.actual_nonempty_geometry',wire.draws.length>0,{draws:wire.draws.length,events:wire.events.length,unsupported_reason:'zero capture is not renderer success; do not force another frame'});
  report.packet={bytes:ownedPacket.length,sha256:await sha(ownedPacket),header:wire.header};
  report.phase='native-release';report.map_release=nativeJson('tome_native_prepared_map_release');
  check('observer.native.observer_released_once',report.map_release.phase==='released'&&report.map_release.protocol===1);
  // Native release precedes Rust. No original call occurs inside this bracket.
  // Finish fetch/compilation before the synchronous purity window. Original
  // SDL timer callbacks may write native stack/queues between await boundaries.
  const compiledRust=await compileRust();
  const rustSemanticBefore=observe('rust_before'),nativeCallsBefore=report.native_calls.length;
  const nativeView=module.HEAPU8,nativeBuffer=nativeView.buffer;
  check('observer.native.memory_is_unshared',typeof SharedArrayBuffer==='undefined'||!(nativeBuffer instanceof SharedArrayBuffer));
  report.phase='pure-rust-observation';
  const beforeBytes=nativeView.slice();
  checkRust(compiledRust,ownedPacket,wire,epoch,generation);
  const afterView=module.HEAPU8,changed=[];let differences=0;
  if(afterView.buffer===nativeBuffer&&afterView.length===beforeBytes.length){
    for(let offset=0;offset<beforeBytes.length;offset++)if(beforeBytes[offset]!==afterView[offset]){
      differences++;if(changed.length<16)changed.push(offset);
    }
  }
  report.rust_native_memory_purity={equal:afterView.buffer===nativeBuffer&&afterView.length===beforeBytes.length&&differences===0,
    bytes_before:beforeBytes.length,bytes_after:afterView.length,all_bytes_compared:beforeBytes.length,
    differences,first_changed_byte_offsets:changed,
    method:'Exact byte comparison in one synchronous unshared-memory window; no await, native call, timer suspension, masks or rollback',
    diagnostic_copy_bytes:beforeBytes.length};
  check('observer.rust.made_no_original_calls',report.native_calls.length===nativeCallsBefore);
  check('observer.rust.preserves_whole_original_memory',report.rust_native_memory_purity.equal,report.rust_native_memory_purity);
  const rustSemanticAfter=observe('rust_after');check('observer.rust.preserves_original_snapshot_and_rng',JSON.stringify(rustSemanticBefore)===JSON.stringify(rustSemanticAfter));
  report.phase='completed-observation';report.passed=true;report.completed=true;show('observer.ui.complete');
}catch(error){
  const failedPhase=report.phase;terminal=true;report.completed=true;report.passed=false;report.phase='failed-closed';report.terminal_instance_failure=true;
  report.failure={text_id:error.text_id||'observer.exception',message:error.message,detail:error.detail,stack:error.stack,source_phase:failedPhase,
    original_frame_calls:report.external_original_frame_calls,pending_error:report.after_frame_original_error||report.before_frame_original_error||report.after_save_original_error||report.before_save_original_error,
    latest_native_status:report.map_after_frame||report.map_begin,original_errors:report.original_errors,native_abort:report.native_abort};
  // Preserve a failed in-flight/sealed operation. Never release/reset/retry it.
  show('observer.ui.failed');lines.push('OBSERVER_FAILURE='+JSON.stringify(report.failure));
  log.textContent=lines.join('\n');console.error('OBSERVER_FAILURE',report.failure);
}
