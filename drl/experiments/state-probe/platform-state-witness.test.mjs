// SOURCE ONLY: authored fixture suite, not executed in this delegated task.
import test from 'node:test';
import assert from 'node:assert/strict';
import {capturePlatformInput} from './platform-state-witness.mjs';
const packet=key=>{const bytes=new Uint8Array(128),view=new DataView(bytes.buffer);view.setUint32(0,1,true);view.setUint32(8,key,true);return bytes;};
const owner=()=>({frozen:true,fifo:{packets:[{receipt:1,bytes:packet(13)},{receipt:2,bytes:packet(27)}],lastEnqueuedReceipt:2,consumedReceipt:0,consumedPacketCount:0,textReceipt:null},keys:{jobs:[{token:1,event:Object.freeze({key:'Enter',code:'Enter',shiftKey:false}),tap:true,released:true,acknowledged:false,stage:'down',receipt:1}],nextToken:1,presentedReceipt:0}});
test('direct capture is stable, preserves every owned array/byte, and remains partial',()=>{
  const source=owner(),before=structuredClone(source),a=capturePlatformInput(source),b=capturePlatformInput(source);
  assert.equal(a.failed,false);assert.equal(a.complete,false);assert.deepEqual(a.bytes,b.bytes);assert.deepEqual(source,before);
  assert.deepEqual([...a.bytes.slice(0,16)],[68,82,83,80,1,0,1,0,8,0,0,0,0,0,0,0]);
  a.bytes.fill(0);assert.deepEqual(source,before);assert.notDeepEqual(a.bytes,b.bytes);
});
test('off-head event contents and FIFO order change the witness',()=>{
  const source=owner(),before=capturePlatformInput(source).bytes;
  source.fifo.packets[1].bytes[8]=99;assert.notDeepEqual(capturePlatformInput(source).bytes,before);
  source.fifo.packets.reverse();assert.notDeepEqual(capturePlatformInput(source).bytes,before);
});
test('receipt progression and deferred key acknowledgement are observable separately',()=>{
  const source=owner(),before=capturePlatformInput(source).bytes;
  source.fifo.textReceipt=1;
  assert.notDeepEqual(capturePlatformInput(source).bytes,before);
  source.fifo.textReceipt=null;
  assert.deepEqual(capturePlatformInput(source).bytes,before);
  source.fifo.consumedReceipt=1;source.fifo.consumedPacketCount=1;
  const consumed=capturePlatformInput(source).bytes;assert.notDeepEqual(consumed,before);
  source.keys.jobs[0].acknowledged=true;source.keys.jobs[0].stage='up';source.keys.presentedReceipt=1;
  assert.notDeepEqual(capturePlatformInput(source).bytes,consumed);
});
test('unfrozen, overflow, invalid packet, unsupported event and lone surrogate fail with empty bytes',()=>{
  for(const alter of [o=>{o.frozen=false;},o=>{o.fifo.packets[0].bytes[0]=2;},o=>{o.keys.jobs[0].event={key:{nested:true}};},o=>{o.keys.jobs[0].event={key:'\ud800'};}]){
    const source=owner();alter(source);const result=capturePlatformInput(source);assert.equal(result.failed,true);assert.equal(result.bytes.length,0);assert.equal(result.complete,false);
  }
  const overflow=capturePlatformInput(owner(),16);assert.equal(overflow.failed,true);assert.equal(overflow.bytes.length,0);
});
test('event accessors are rejected without running their getter',()=>{
  const source=owner();let calls=0;source.keys.jobs[0].event=Object.defineProperty({},'key',{enumerable:true,get(){calls++;return 'Enter';}});
  const result=capturePlatformInput(source);assert.equal(result.failed,true);assert.equal(result.error_id,'probe.error.accessor');assert.equal(calls,0);
});
