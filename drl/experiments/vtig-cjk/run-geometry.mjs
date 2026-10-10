import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {WASI} from 'node:wasi';

// Actual Pascal producers -> copied wire -> actual Rust projection. This runs
// only after both current artifacts have been built under the shared build gate.
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const corePath=path.join(root,'core-adapted/build/vtig-geometry/vtig-geometry.wasm');
const rustPath=path.join(root,'port/dist/drl_web_port.wasm');
const coreBytes=fs.readFileSync(corePath),rustBytes=fs.readFileSync(rustPath);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rust=(await WebAssembly.instantiate(rustBytes,{})).instance.exports;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
function dispatch(message){
  const bytes=encoder.encode(JSON.stringify(message));assert(bytes.length<=rust.drl_request_capacity());
  const pointer=rust.drl_request_pointer();
  new Uint8Array(rust.memory.buffer,pointer,bytes.length).set(bytes);
  assert.equal(rust.drl_dispatch(bytes.length),1,'Rust rejected actual Pascal frame');
  const outputPointer=rust.drl_output_pointer(),outputLength=rust.drl_output_length();
  return JSON.parse(decoder.decode(new Uint8Array(rust.memory.buffer,outputPointer,outputLength)));
}
function rustText(bytes,columns){
  assert(bytes.length<=rust.drl_request_capacity());
  const pointer=rust.drl_request_pointer();
  new Uint8Array(rust.memory.buffer,pointer,bytes.length).set(bytes);
  return columns===undefined?rust.drl_text_columns(bytes.length):rust.drl_text_fit(bytes.length,columns);
}
const logPath=path.join(root,'core-adapted/build/vtig-geometry/runtime.log'),log=fs.openSync(logPath,'w');
const wasi=new WASI({version:'preview1',args:['vtig-geometry'],env:{},preopens:{},returnOnExit:true,stdout:log,stderr:log});
let core,frames=0;const commands=[],projections=[];
const copy=(ptr,len)=>Uint8Array.from(new Uint8Array(core.exports.memory.buffer,ptr,len));
const host={
  text_columns(ptr,len){return rustText(copy(ptr,len));},
  text_fit(ptr,len,columns){return rustText(copy(ptr,len),columns);},
  draw_command(ptr,len,textPtr,textLen){
    assert.equal(len,64);const header=copy(ptr,len),text=copy(textPtr,textLen),view=new DataView(header.buffer);
    const words=Array.from({length:16},(_,i)=>view.getUint32(i*4,true));
    assert.equal(words[0],1);assert(words[1]<=5);
    for(const index of [4,5,8,9])assert(words[index]<=4096,'negative/unbounded Pascal geometry');
    assert.equal(words[14],0);assert.equal(words[15],0);
    commands.push({header:Array.from(header),text:Array.from(text),words});
  },
  frame(ptr,len){
    frames++;assert.equal(len,24032);assert(commands.length>3);
    const marker=commands.at(-1);assert.deepEqual(marker.text,[30]);
    assert.equal(marker.words[1],0);assert.equal(marker.words[13],1);assert.equal(marker.words[10],15);
    assert.equal(marker.words[11],0xefffffff);
    const glyph=commands.find(c=>c.words[1]===0&&c.text.length===1&&c.text[0]===71);
    assert(glyph,'offset VTIG_RenderChar fixture missing');assert(glyph.words[4]>0&&glyph.words[5]>0);
    const label=commands.find(c=>c.words[1]===0&&c.words[13]===0&&decoder.decode(Uint8Array.from(c.text))==='MOUSE');
    assert(label,'overlapping text fixture missing');assert.deepEqual(label.words.slice(2,4),marker.words.slice(2,4));
    const bar=commands.find(c=>c.words[1]===5);
    assert(bar,'original scrollbar bar fixture missing');
    assert.deepEqual(bar.text,[193,194,177],'BAR transports only three native-read bytes');
    const thumb=commands.find(c=>c.words[1]===0&&c.words[13]===1&&c.text.length===1&&c.text[0]===178);
    assert(thumb,'separate original fourth-frame-byte scrollbar thumb missing');
    assert.deepEqual(thumb.words.slice(2,4),bar.words.slice(2,4),'thumb stays at intended source cell without native byte wrap');
    assert(thumb.words[2]>=thumb.words[6]&&thumb.words[3]>=thumb.words[7]);
    assert(thumb.words[2]<thumb.words[6]+thumb.words[8]&&thumb.words[3]<thumb.words[7]+thumb.words[9]);
    const presentation=dispatch({kind:'frame',bytes:Array.from(copy(ptr,len)),
      commands:commands.map(({header,text})=>({header,text}))}).presentation;
    assert(presentation);const final=presentation.commands.at(-1);
    assert.equal(final.kind,'glyph');assert.equal(final.text,'▲');assert.equal(final.foreground,'#ffffff');
    assert.deepEqual([final.x,final.y],marker.words.slice(2,4));projections.push(presentation);
  },
  poll_event(){return 0;},event_pending(){return 0;},sleep(){},drl_sleep(){},now_ms(){return 0;},
  text_input(){},title(){},rumble(){return 0;},
};
try {
  core=(await WebAssembly.instantiate(coreBytes,{...wasi.getImportObject(),drl_host:host})).instance;
  assert.equal(wasi.start(core),0);assert.equal(frames,1);
} finally {fs.closeSync(log);}
const result={schema:1,status:'passed',actual_vtig_unit_executed:true,original_game_executed:false,
  core_sha256:sha(coreBytes),rust_sha256:sha(rustBytes),frames,draw_commands:commands.length,
  checks:['actual translated trait padding preserves UTF-8 and CJK columns','caller-owned open color scope and clipped balanced color scope','nonnegative offset byte-glyph extents','original scrollbar producer','same-cell text and final mouse marker',
    'strict Rust frame projection','CP437 final marker above ordinary UI commands']};
fs.writeFileSync(path.join(root,'docs/core-geometry-runtime-evidence.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
