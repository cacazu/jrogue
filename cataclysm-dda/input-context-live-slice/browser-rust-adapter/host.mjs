// Narrow platform bridge only. C++ owns gameplay; Rust owns validated views.
export const MAX_BYTES = 262144;
export const MAX_FIELD_BYTES = 16384;
export const MAX_RESPONSE_BYTES = 2 * MAX_BYTES + 4096;
export const SOURCE_COMMIT = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
function word(value) {
  if (!Number.isInteger(value) || value < -0x80000000 || value > 0xffffffff) throw new Error('WASM word');
  return value >>> 0;
}
function checkedView(memory) {
  if (!(memory instanceof WebAssembly.Memory) ||
      (typeof SharedArrayBuffer !== 'undefined' && memory.buffer instanceof SharedArrayBuffer)) throw new Error('unshared Rust memory required');
  return new Uint8Array(memory.buffer);
}
function bounds(heap, pointer, size, maximum) {
  if (!pointer || !size || size > maximum || pointer >= heap.length || size > heap.length - pointer) throw new Error('owned byte range');
}
// Real exports are called only through these imports. Tests of this module are
// transport-only until a compiled actual Rust WASM instance is attached.
export function createNativeTransfer(module, getRustMemory) {
  const held = new Set();
  const releasing = new Set();
  let failure = null, trap = null;
  const invoke = action => { try { return action(); } catch (error) { failure = String(error); if (error instanceof WebAssembly.RuntimeError) trap = error; return 0; } };
  const own = handle => { if (!held.has(handle)) throw new Error('unowned native snapshot handle'); };
  const imports = Object.freeze({
    snapshot_pin(kind) { return invoke(() => {
      if (word(kind) !== 1) throw new Error('input kind');
      const handle = word(module._cdda_browser_snapshot_pin(1));
      if (handle !== 0) {
        if (held.has(handle)) throw new Error('duplicate native pin');
        held.add(handle);
      }
      return handle;
    }); },
    snapshot_data(handle) { return invoke(() => { handle = word(handle); own(handle); return word(module._cdda_browser_snapshot_data(handle)); }); },
    snapshot_size(handle) { return invoke(() => { handle = word(handle); own(handle); return word(module._cdda_browser_snapshot_size(handle)); }); },
    native_heap_length() {
      try {
        const heap = module.HEAPU8;
        if (!(heap instanceof Uint8Array) || heap.length > 0x100000000) throw new Error('native memory');
        return BigInt(heap.length);
      } catch (error) { failure = String(error); if (error instanceof WebAssembly.RuntimeError) trap = error; return 0n; }
    },
    copy_to_rust(address, destination, length) { return invoke(() => {
      address = word(address); destination = word(destination); length = word(length);
      // Refresh both heaps after every native export; no retained native view.
      const original = module.HEAPU8;
      if (!(original instanceof Uint8Array)) throw new Error('current native heap');
      bounds(original, address, length, MAX_BYTES);
      const owned = original.slice(address, address + length);
      const target = checkedView(getRustMemory());
      bounds(target, destination, length, MAX_BYTES);
      target.set(owned, destination);
      return length;
    }); },
    snapshot_release(handle) {
      handle = word(handle);
      if (!held.has(handle)) return;
      if (releasing.has(handle)) return;
      releasing.add(handle);
      try { module._cdda_browser_snapshot_release(handle); held.delete(handle); }
      catch (error) { failure = String(error); if (error instanceof WebAssembly.RuntimeError) trap = error; }
      finally { releasing.delete(handle); }
    },
  });
  return Object.freeze({ imports, releaseAll() {
    for (const handle of [...held]) imports.snapshot_release(handle);
    if (held.size !== 0) throw new Error("native release unresolved");
  }, heldCount: () => held.size, failure: () => failure, trap: () => trap,
    clearFailure() { failure = null; trap = null; } });
}
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function createBrowserInputHost({ nativeModule, expectedBuildId }) {
  // Trusted explicit manifest identity, never a packet-provided self identity.
  if (typeof expectedBuildId !== 'string') throw new Error('expected host identity');
  const identity=new TextEncoder().encode(expectedBuildId);
  if (!identity.length || identity.length>MAX_FIELD_BYTES ||
      new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(identity)!==expectedBuildId) throw new Error('expected strict UTF-8 identity');
  let rust=null,receiving=false,reentered=false,poisoned=false;
  const transfer=createNativeTransfer(nativeModule,()=>rust?.memory);
  const requireRust=()=>{if(!rust||poisoned)throw new Error('actual Rust WASM unavailable');};
  const begin=()=>{if(receiving){reentered=true;throw new Error('FFI reentry');}receiving=true;reentered=false;transfer.clearFailure();};
  const operation=action=>{
    begin();
    try { return action(); }
    catch(error){
      if(error instanceof WebAssembly.RuntimeError||transfer.trap())poisoned=true;
      else if(rust&&!poisoned){try{rust.cdda_input_invalidate();}catch{poisoned=true;}}
      throw error;
    }finally{try{transfer.releaseAll();}finally{receiving=false;}}
  };
  const writeBytes=(bytes,initialization=false)=>{
    requireRust();
    const capacity=word(initialization?rust.cdda_input_identity_buffer_capacity():rust.cdda_input_raw_buffer_capacity());
    const pointer=word(initialization?rust.cdda_input_identity_buffer_data():rust.cdda_input_raw_buffer_data());
    const heap=checkedView(rust.memory);
    if(capacity!==MAX_FIELD_BYTES||bytes.length>capacity||!pointer||pointer>=heap.length||bytes.length>heap.length-pointer)throw new Error('owned scratch range');
    heap.set(bytes,pointer);
  };
  const readResponse=()=>{
    requireRust();
    const pointer=word(rust.cdda_input_view_data()),size=word(rust.cdda_input_view_size());
    const heap=checkedView(rust.memory);bounds(heap,pointer,size,MAX_RESPONSE_BYTES);
    const owned=heap.slice(pointer,pointer+size);
    const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(owned));
    if(value?.schema_version!==1||value.source_commit!==SOURCE_COMMIT||value.engine_build_id!==expectedBuildId||
      value.command_authorization?.kind!=='denied'||value.command_authorization?.reason!=='UntrackedNativeReaders'||
      !['cdda-rust-input-view/1','cdda-rust-raw-utf8/1'].includes(value.interface))throw new Error('typed denied response');
    return freeze(value);
  };
  const finishView=()=>{
    if(transfer.trap()){poisoned=true;throw transfer.trap();}
    if(reentered){rust.cdda_input_invalidate();return readResponse();}
    const response=readResponse();
    // Preserve the actual Rust typed rejection when ordinary host transfer fails.
    // A failure may never retain an apparently usable current snapshot.
    if(transfer.failure()&&response.snapshot!==null){rust.cdda_input_invalidate();return readResponse();}
    return response;
  };
  return Object.freeze({
    importObject:Object.freeze({cdda_observer_host:transfer.imports}),
    attach(instance){return operation(()=>{
      if(rust||!(instance instanceof WebAssembly.Instance))throw new Error('one actual WASM instance required');
      const exports=instance.exports;
      const names=['cdda_input_abi_version','cdda_input_identity_buffer_data','cdda_input_identity_buffer_capacity',
        'cdda_input_initialize_build_id','cdda_input_observe','cdda_input_invalidate','cdda_input_raw_buffer_data',
        'cdda_input_raw_buffer_capacity','cdda_input_accept_raw_utf8','cdda_input_view_data','cdda_input_view_size'];
      if(names.some(n=>typeof exports[n]!=='function'))throw new Error('actual Rust ABI exports');
      checkedView(exports.memory);rust=exports;
      if(word(rust.cdda_input_abi_version())!==1)throw new Error('Rust ABI version');
      writeBytes(identity,true);
      if(word(rust.cdda_input_initialize_build_id(identity.length))!==1||
        rust.cdda_input_identity_buffer_data()!==0||rust.cdda_input_identity_buffer_capacity()!==0)throw new Error('identity buffer not sealed');
      return finishView();
    });},
    receive(kind,low,high,availability){
      if(receiving){reentered=true;return null;}
      return operation(()=>{requireRust();rust.cdda_input_observe(word(kind),word(low),word(high),word(availability));return finishView();});
    },
    preserveRawUtf8(bytes){return operation(()=>{
      requireRust();
      if(!(bytes instanceof Uint8Array)||bytes.length>MAX_FIELD_BYTES)throw new Error('owned raw UTF-8');
      const owned=bytes.slice();new TextDecoder('utf-8',{fatal:true}).decode(owned);
      if(reentered)throw new Error('raw FFI reentry');
      writeBytes(owned);
      if(word(rust.cdda_input_accept_raw_utf8(owned.length))!==1)throw new Error('raw UTF-8 rejected');
      const response=finishView();
      if(response.interface!=='cdda-rust-raw-utf8/1'||response.source!=='host_provided_bytes')throw new Error('raw scope');
      const roundtrip=new TextEncoder().encode(response.raw_utf8);
      if(roundtrip.length!==owned.length||roundtrip.some((b,i)=>b!==owned[i]))throw new Error('raw UTF-8 changed');
      return response;
    });},
    invalidate(){return operation(()=>{requireRust();rust.cdda_input_invalidate();return finishView();});},
    status(){return Object.freeze({attached:rust!==null,poisoned,receiving,heldNativePins:transfer.heldCount(),commandAuthorization:'Denied(UntrackedNativeReaders)'});},
  });
}
