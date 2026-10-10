// Actual selected original class + actual four native exports + actual Rust WASM.
// Synchronous test wait callback is a transparent scripted hardware leaf.
// Production deferred ready delivery, SDL/IME, Asyncify and full engine remain unproved.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createBrowserInputHost} from './host-v2.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const identity=fs.readFileSync(path.join(here,'../continuation-interner/module-build-id.txt'),'utf8').trim();
const wasmBytes=fs.readFileSync(path.join(here,'wasm-build/target/wasm32-unknown-unknown/debug/cdda_browser_input_adapter.wasm'));
const wasmModule=await WebAssembly.compile(wasmBytes);
const imports=['snapshot_pin','snapshot_data','snapshot_size','native_heap_length','copy_to_rust','snapshot_release'].sort();
assert.deepEqual(WebAssembly.Module.imports(wasmModule).map(i=>({module:i.module,name:i.name,kind:i.kind})).sort((a,b)=>a.name.localeCompare(b.name)),imports.map(name=>({module:'cdda_observer_host',name,kind:'function'})));
const exports=['cdda_input_abi_version','cdda_input_identity_buffer_data','cdda_input_identity_buffer_capacity','cdda_input_initialize_build_id','cdda_input_raw_buffer_data','cdda_input_raw_buffer_capacity','cdda_input_accept_raw_utf8','cdda_input_observe','cdda_input_invalidate','cdda_input_view_data','cdda_input_view_size'].sort();
assert.deepEqual(WebAssembly.Module.exports(wasmModule).filter(e=>e.kind==='function').map(e=>e.name).sort(),exports);
assert(WebAssembly.Module.exports(wasmModule).some(e=>e.name==='memory'&&e.kind==='memory'));
const factory=(await import(pathToFileURL(path.join(here,'original-wait-leaf/build/original-context-browser-leaf.mjs')).href)).default;
const native=await factory();
const rows=[];let host=null,instance=null,views=[],records=[],fault=null,injected=false,releaseCount=0;
const bytes=(pointer,size)=>{const heap=native.HEAPU8;assert(pointer>0&&size>0&&size<=262144&&size<=heap.length-pointer);return heap.slice(pointer,pointer+size);};
const nativeText=prefix=>{const size=native['_cdda_context_'+prefix+'_size']();return size?new TextDecoder('utf-8',{fatal:true}).decode(bytes(native['_cdda_context_'+prefix+'_data'](),size)):'';};
const action=(view,id)=>view.snapshot.actions.find(a=>a.action_id===id);
let deferred=[],deferredViews=[];globalThis.cddaInputSnapshotAvailable=n=>deferred.push(n);
globalThis.cddaOriginalContextWaitLeaf=index=>{
 const original=bytes(native._cdda_context_record_data(index),native._cdda_context_record_size(index));
 const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(original));assert.equal(raw.engine_build_id,identity);
 const sequence=BigInt(raw.publication_sequence);
 const view=host.receive(1,Number(sequence&0xffffffffn),Number(sequence>>32n),1);
 if(fault){assert.equal(view.snapshot,null);assert.equal(view.command_authorization.kind,'denied');
   assert.equal(view.outcome,fault==='exception'?'rejected':'invalidated');
   if(fault==='exception')assert.equal(view.error_text_id,'ui.input.observation.invalid_range');
   views.push(view);records.push(original);return;}
 assert.equal(view.outcome,index===0||views.at(-1)?.last_publication_sequence!==raw.publication_sequence?'ready':'stale');
 assert.equal(view.command_authorization.reason,'UntrackedNativeReaders');
 assert.equal(view.snapshot.engine_build_id,identity);assert.equal(view.snapshot.category,raw.category);
 assert.equal(view.snapshot.context_epoch,raw.context_epoch);assert.equal(view.snapshot.parent_context_epoch,raw.parent_context_epoch);
 assert.equal(view.snapshot.effective_timeout_ms,raw.effective_timeout_ms);
 for(const a of raw.actions){const typed=action(view,a.id);assert(typed);assert.equal(typed.binding_origin,a.origin);assert.deepEqual(typed.bindings.map(b=>b.sequence),a.bindings.map(b=>b.sequence));}
 views.push(view);records.push(original);
};
async function run(id,inject=null){
 fault=inject;injected=false;releaseCount=0;delete globalThis.cddaOriginalContextWaitLeafError;
 const observedNative=new Proxy(native,{get(target,key){
   if(key==='_cdda_browser_snapshot_release')return handle=>{releaseCount++;return target[key](handle);};
   if(key==='_cdda_browser_snapshot_data'&&inject)return handle=>{
     const value=target[key](handle);
     if(!injected){injected=true;
       if(inject==='reentry')assert.equal(host.receive(1,1,0,1),null);
       else if(inject==='exception')throw new Error('controlled native data adapter exception');
       else if(inject==='actual_rust_trap'){
         // Adversarial test bypasses host guard: actual nested Rust export
         // borrows its already-borrowed RefCell and really traps.
         instance.exports.cdda_input_observe(1,1,0,1);
         throw Error('actual Rust nested call unexpectedly returned');
       }
     }return value;
   };return Reflect.get(target,key);
 }});
 host=createBrowserInputHost({nativeModule:observedNative,expectedBuildId:identity});
 instance=await WebAssembly.instantiate(wasmModule,host.importObject);
 assert.equal(instance.exports.cdda_input_abi_version(),1);
 assert.equal(instance.exports.cdda_input_raw_buffer_data(),0);assert.equal(instance.exports.cdda_input_raw_buffer_capacity(),0);
 assert.equal(host.attach(instance).outcome,'initialized');
 assert.equal(instance.exports.cdda_input_identity_buffer_data(),0);assert.equal(instance.exports.cdda_input_identity_buffer_capacity(),0);
 assert.equal(instance.exports.cdda_input_initialize_build_id(0),0);
 views=[];records=[];deferred=[];deferredViews=[];
 if(id===1&&!inject){
   const oldRustBuffer=instance.exports.memory.buffer,nativeBuffer=native.HEAPU8.buffer;
   const oldRustLength=oldRustBuffer.byteLength,nativeLength=nativeBuffer.byteLength;
   assert.notEqual(oldRustBuffer,nativeBuffer);
   assert.equal(instance.exports.memory.grow(1),oldRustLength/65536);
   assert.equal(oldRustBuffer.byteLength,0);
   assert.equal(instance.exports.memory.buffer.byteLength,oldRustLength+65536);
   assert.equal(native.HEAPU8.buffer,nativeBuffer);assert.equal(nativeBuffer.byteLength,nativeLength);
 }

 assert.equal(native._cdda_context_run(id),1,nativeText('failure'));
 assert.equal(native._cdda_browser_snapshot_pin(1),0);
 await new Promise(resolve=>queueMicrotask(resolve));
 if(inject==='actual_rust_trap'){
   assert(globalThis.cddaOriginalContextWaitLeafError instanceof WebAssembly.RuntimeError);
   assert.equal(host.status().poisoned,true);assert.equal(host.status().heldNativePins,0);
   assert.throws(()=>host.receive(1,1,0,1),/actual Rust WASM unavailable/);
   assert.throws(()=>host.preserveRawUtf8(new Uint8Array([65])),/actual Rust WASM unavailable/);
   assert.throws(()=>host.invalidate(),/actual Rust WASM unavailable/);
   assert.equal(releaseCount,1);return {views:[],records:[]};
 }
 if(globalThis.cddaOriginalContextWaitLeafError)throw globalThis.cddaOriginalContextWaitLeafError;
 // Genuine deferred notices arrive after actual C++ scope closes. Older
 // notices may be stale; final current exit notice must clear the view.
 let exit=null;for(const n of deferred){
   exit=host.receive(n.kind,n.publicationLow,n.publicationHigh,n.availability);
   assert.equal(exit.command_authorization.kind,'denied');deferredViews.push(exit);
   if(exit.outcome==='unavailable')assert.equal(exit.availability,n.availability===2?'serialization_failure':'unavailable');
   if(exit.outcome==='terminal_unavailable')assert.equal(exit.availability,'unsupported');
 }
 assert(exit);assert.equal(exit.snapshot,null);assert.equal(host.status().heldNativePins,0);
 return {views:[...views],records:[...records]};
}
{
 const {views}=await run(1);assert.equal(views.length,1);assert.equal(action(views[0],'OPEN').binding_origin,'context');
 assert.deepEqual(action(views[0],'OPEN').bindings[0].sequence,[113]);assert.equal(action(views[0],'MISSING_NATIVE_ACTION').binding_origin,'missing');
 rows.push({name:'original-live-wait-native-four-export-rust-owned-lookup',passed:true});
}
for(const id of [7,8]){
 const {views}=await run(id);assert.equal(views.length,3);const [parent,nested,restored]=views.map(v=>v.snapshot);
 assert.equal(nested.depth,2);assert.equal(nested.parent_context_epoch,parent.context_epoch);assert.equal(restored.context_epoch,parent.context_epoch);
 assert(BigInt(restored.publication_sequence)>BigInt(nested.publication_sequence));assert.equal(restored.effective_timeout_ms,id===7?9:-1);
 assert.deepEqual(action(views[2],'OPEN').bindings[0].sequence,[id===7?114:113]);
 rows.push({name:id===7?'original-live-nested-parent-current-bindings-through-rust':'original-live-help-reset-timeout-through-rust',passed:true});
}
{
 const {views}=await run(9);assert.equal(views[0].snapshot.text_policy,'raw_utf8');
 const raw=new TextEncoder().encode(nativeText('text')),original=raw.slice();const echo=host.preserveRawUtf8(raw);raw.fill(0);
 assert.deepEqual(new TextEncoder().encode(echo.raw_utf8),original);assert.equal(echo.source,'host_provided_bytes');assert.equal(echo.command_authorization.kind,'denied');
 rows.push({name:'original-stored-raw-user-bytes-rust-owned-no-translation',passed:true,nativeSDLOrIME:false});
}
{
 const {views,records}=await run(14);assert.equal(views.length,6);
 for(let i=1;i<6;i++){assert.equal(views[i].outcome,'stale');assert.deepEqual(records[i],records[0]);assert.deepEqual(views[i].snapshot,views[0].snapshot);}
 rows.push({name:'original-held-wait-repeat-rust-publication-stale-owned-data',passed:true});
}
{
 await run(15);assert.equal(views.length,0);
 assert(deferredViews.some(v=>v.availability==='serialization_failure'&&v.snapshot===null));
 assert.equal(deferredViews.at(-1).availability,'unavailable');
 const absent=host.invalidate();assert.equal(absent.snapshot,null);assert.equal(absent.command_authorization.reason,'UntrackedNativeReaders');
 rows.push({name:'original-over-limit-and-post-wait-rust-fail-closed',passed:true});
}
for(const inject of ['exception','reentry']){
 const {views}=await run(1,inject);assert.equal(views.length,1);assert(injected);assert.equal(releaseCount,1);
 assert.equal(host.status().heldNativePins,0);assert.equal(host.status().poisoned,false);
 rows.push({name:inject==='exception'?'actual-native-pin-rust-ffi-error-releases-and-denies':'actual-native-pin-rust-ffi-reentry-clears-and-releases',passed:true});
}
assert.throws(()=>createBrowserInputHost({nativeModule:native,expectedBuildId:'bad\uD800'}));
assert.throws(()=>host.preserveRawUtf8(new Uint8Array([0xff])));
const bom=new TextEncoder().encode('\uFEFFQA_Kit_\u65e5\u672c\u{1f642}e\u0301');
assert.deepEqual(new TextEncoder().encode(host.preserveRawUtf8(bom).raw_utf8),bom);
await run(1,'actual_rust_trap');assert(injected);assert.equal(host.status().poisoned,true);
rows.push({name:'actual-rust-wasm-refcell-trap-quarantined-native-pin-closed-original-scope-completes',passed:true});
delete globalThis.cddaOriginalContextWaitLeaf;delete globalThis.cddaOriginalContextWaitLeafError;delete globalThis.cddaInputSnapshotAvailable;
const out=process.env.CDDA_ADAPTER_RESULT;if(!out)throw Error('owned result path required');if(fs.existsSync(out))throw Error('refuse existing result');
fs.writeFileSync(out,JSON.stringify({schemaVersion:1,status:'actual-original-context-rust-wasm-leaf-tests-passed',tests:rows,expectedIdentity:identity,actualSelectedOriginalClassExecuted:true,trueNativeFourExportsExecuted:true,actualRustWasmConsumerExecuted:true,scriptedHardwareLeaf:true,synchronousTestObservationLeaf:true,productionDeferredReadyNoticeProved:false,SDLOrIMEProved:false,AsyncifyProved:false,liveEngineIntegrated:false,wholeGameVerified:false,commandAuthorization:'Denied(UntrackedNativeReaders)'},null,2)+'\n');
console.log(JSON.stringify({status:'actual-original-context-rust-wasm-leaf-tests-passed',checks:rows.length,liveEngineIntegrated:false}));
