// Platform glue source only. No context resolution, command, draw, or game call.
const MAX_BYTES=4*1024*1024;
function wasmU32(value){
  if(!Number.isInteger(value)||value< -0x80000000||value>0xffffffff)throw new RangeError('WASM32 scalar');
  return value>>>0;
}
export function copyOwnedTextSnapshot(module){
  const handle=wasmU32(module._cdda_text_snapshot_pin());
  if(!handle)return null;
  try{
    const pointer=wasmU32(module._cdda_text_snapshot_data(handle));
    const size=wasmU32(module._cdda_text_snapshot_size(handle));
    // Refresh the heap AFTER the scalar calls, which may invalidate old views.
    const current=module.HEAPU8;
    if(!(current instanceof Uint8Array)||!pointer||!size||size>MAX_BYTES||pointer>current.byteLength||
      size>current.byteLength-pointer)throw new RangeError('snapshot heap range');
    return current.slice(pointer,pointer+size);
  }finally{
    module._cdda_text_snapshot_release(handle);
  }
}
export function publicationFromNotice(notice){
  if(notice?.kind!==2||![0,1,2,3].includes(notice.availability))throw new Error('text notice');
  const low=wasmU32(notice.publicationLow),high=wasmU32(notice.publicationHigh);
  return (BigInt(high)<<32n)|BigInt(low);
}
