/* Authored read-only codec; execution and integration are pending parent review.
 * Call inside the owning synchronous closures while the core is suspended.
 * No poll, peek, pump, dispatch, renderer, RNG, clocks, serialization or getters.
 */
const encoder = new TextEncoder();
const MAXIMUM_BYTES = 16 * 1024 * 1024;
const KINDS = Object.freeze({u8:1,u16:2,u32:3,u64:4,i32:5,bool:6,original:7,bytes:8,u32s:9});
class ProbeError extends Error {
  constructor(id,path){super(id);this.id=id;this.path=path;}
}
function requireValue(condition,id,path){if(!condition)throw new ProbeError(id,path);}
function dataField(object,key,path){
  const descriptor=Object.getOwnPropertyDescriptor(object,key);
  requireValue(descriptor && Object.hasOwn(descriptor,"value"),"probe.error.accessor",path);
  return descriptor.value;
}
function plain(object,path){
  requireValue(object !== null && typeof object === "object","probe.error.type",path);
  const prototype=Object.getPrototypeOf(object);
  requireValue(prototype === Object.prototype || prototype === null,"probe.error.prototype",path);
  return object;
}
function safeInteger(value,path){
  requireValue(Number.isSafeInteger(value) && value >= 0,"probe.error.integer",path);
  return BigInt(value);
}
function originalString(value,path,maximum){
  requireValue(typeof value === "string","probe.error.type",path);
  let byteLength=0;
  for(let index=0;index<value.length;index++){
    const unit=value.charCodeAt(index);
    if(unit>=0xd800&&unit<=0xdbff){
      const next=value.charCodeAt(++index);
      requireValue(next>=0xdc00&&next<=0xdfff,"probe.error.unicode",path);
      byteLength+=4;
    }else{
      requireValue(!(unit>=0xdc00&&unit<=0xdfff),"probe.error.unicode",path);
      byteLength+=unit<0x80?1:unit<0x800?2:3;
    }
    requireValue(byteLength<=maximum,"probe.error.capacity",path);
  }
  return encoder.encode(value);
}
function writer(capacity,flags){
  requireValue(Number.isInteger(capacity) && capacity >= 16 && capacity <= MAXIMUM_BYTES,"probe.error.capacity","meta.capacity");
  const output=new Uint8Array(capacity),view=new DataView(output.buffer);
  let offset=16;
  output.set([68,82,83,80]);view.setUint16(4,1,true);view.setUint16(6,1,true);view.setUint32(8,flags,true);
  function field(tag,kind,payload){
    requireValue(/^[a-z0-9._-]{1,255}$/.test(tag),"probe.error.tag",tag);
    const name=encoder.encode(tag);
    requireValue(offset+7+name.length+payload.length <= output.length,"probe.error.capacity",tag);
    view.setUint16(offset,name.length,true);offset+=2;output.set(name,offset);offset+=name.length;
    output[offset++]=kind;view.setUint32(offset,payload.length,true);offset+=4;output.set(payload,offset);offset+=payload.length;
  }
  const u64=(tag,value)=>{const payload=new Uint8Array(8);new DataView(payload.buffer).setBigUint64(0,safeInteger(value,tag),true);field(tag,KINDS.u64,payload);};
  const u32=(tag,value)=>{requireValue(Number.isInteger(value)&&value>=0&&value<=0xffffffff,"probe.error.integer",tag);const payload=new Uint8Array(4);new DataView(payload.buffer).setUint32(0,value,true);field(tag,KINDS.u32,payload);};
  const bool=(tag,value)=>{requireValue(typeof value==="boolean","probe.error.type",tag);field(tag,KINDS.bool,Uint8Array.of(Number(value)));};
  const original=(tag,value)=>field(tag,KINDS.original,originalString(value,tag,capacity-offset-7-tag.length));
  const bytes=(tag,value)=>{requireValue(value instanceof Uint8Array,"probe.error.type",tag);const payload=new Uint8Array(4+value.length);new DataView(payload.buffer).setUint32(0,value.length,true);payload.set(value,4);field(tag,KINDS.bytes,payload);};
  return {u64,u32,bool,original,bytes,finish:()=>output.slice(0,offset)};
}

export function capturePlatformInput(owner,capacity=262144){
  try {
    plain(owner,"input");
    requireValue(dataField(owner,"frozen","meta.safe_point")===true,"probe.error.not_frozen","meta.safe_point");
    const capture=writer(capacity,0x00000008);
    capture.original("meta.scope","browser-event-fifo-and-deferred-keys-v1");
    const fifo=plain(dataField(owner,"fifo","input.event_fifo"),"input.event_fifo");
    const packets=dataField(fifo,"packets","input.event_fifo.packets");
    requireValue(Array.isArray(packets)&&packets.length<=4096,"probe.error.queue_limit","input.event_fifo.packets");
    capture.u64("input.event_fifo.last_enqueued",dataField(fifo,"lastEnqueuedReceipt","input.event_fifo.last_enqueued"));
    capture.u64("input.event_fifo.consumed_receipt",dataField(fifo,"consumedReceipt","input.event_fifo.consumed_receipt"));
    capture.u64("input.event_fifo.consumed_count",dataField(fifo,"consumedPacketCount","input.event_fifo.consumed_count"));
    const textReceipt=dataField(fifo,"textReceipt","input.event_fifo.text_receipt");
    capture.bool("input.event_fifo.text_receipt_present",textReceipt!==null);
    if(textReceipt!==null)capture.u64("input.event_fifo.text_receipt",textReceipt);
    capture.u32("input.event_fifo.count",packets.length);
    for(let index=0;index<packets.length;index++){
      const tag=`input.event_fifo.packet.${index}`,packet=plain(dataField(packets,String(index),tag),tag);
      const value=dataField(packet,"bytes",tag+".bytes");
      requireValue(value instanceof Uint8Array&&value.length===128,"probe.error.packet",tag);
      requireValue(new DataView(value.buffer,value.byteOffset,value.byteLength).getUint32(0,true)===1,"probe.error.packet_version",tag);
      capture.u64(tag+".receipt",dataField(packet,"receipt",tag+".receipt"));
      capture.bytes(tag+".bytes",value);
    }
    const keys=plain(dataField(owner,"keys","input.deferred_keys"),"input.deferred_keys");
    const jobs=dataField(keys,"jobs","input.deferred_keys.jobs");
    requireValue(Array.isArray(jobs)&&jobs.length<=4096,"probe.error.queue_limit","input.deferred_keys.jobs");
    capture.u64("input.deferred_keys.next_token",dataField(keys,"nextToken","input.deferred_keys.next_token"));
    capture.u64("input.deferred_keys.presented_receipt",dataField(keys,"presentedReceipt","input.deferred_keys.presented_receipt"));
    capture.u32("input.deferred_keys.count",jobs.length);
    for(let index=0;index<jobs.length;index++){
      const tag=`input.deferred_keys.job.${index}`,job=plain(dataField(jobs,String(index),tag),tag);
      capture.u64(tag+".token",dataField(job,"token",tag+".token"));
      for(const name of ["tap","released","acknowledged"])capture.bool(tag+"."+name,dataField(job,name,tag+"."+name));
      const stage=dataField(job,"stage",tag+".stage");
      requireValue(["pending","down","up"].includes(stage),"probe.error.key_stage",tag+".stage");capture.original(tag+".stage",stage);
      const receipt=dataField(job,"receipt",tag+".receipt");capture.bool(tag+".has_receipt",receipt!==null);
      if(receipt!==null)capture.u64(tag+".receipt",receipt);
      const event=plain(dataField(job,"event",tag+".event"),tag+".event");
      const names=Object.getOwnPropertyNames(event).sort();
      requireValue(Object.getOwnPropertySymbols(event).length===0,"probe.error.symbol_key",tag+".event");
      capture.u32(tag+".event.count",names.length);
      for(let field=0;field<names.length;field++){
        const name=names[field],path=tag+`.event.field.${field}`,value=dataField(event,name,path);
        capture.original(path+".name",name);
        if(typeof value==="boolean")capture.bool(path+".value",value);
        else if(typeof value==="string")capture.original(path+".value",value);
        else if(typeof value==="number"&&Number.isSafeInteger(value)&&value>=0)capture.u64(path+".value",value);
        else throw new ProbeError("probe.error.event_value",path);
      }
    }
    capture.bool("input.remaining_platform_state.covered",false);
    capture.original("input.remaining_platform_state.reason","held-input-rust-normalizer-ime-driver-and-modal-layer-ledger-pending");
    return {schema:1,complete:false,failed:false,error_id:null,error_path:null,bytes:capture.finish()};
  }catch(error){
    if(!(error instanceof ProbeError))throw error;
    return {schema:1,complete:false,failed:true,error_id:error.id,error_path:error.path,bytes:new Uint8Array()};
  }
}
