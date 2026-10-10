// Independent read-only boundary probe. No production files are modified.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const wasmBytes=await fs.readFile(path.join(root,'build','boundary.wasm'));
const module=(await WebAssembly.instantiate(wasmBytes,{})).instance.exports;
const encoder=new TextEncoder(),decoder=new TextDecoder();
let allocations=0,releases=0,peakPages=0;
function call(command){
  const bytes=encoder.encode(JSON.stringify({language:'ja',...command}));
  const input=module.dcss_allocate(bytes.length);if(!input)throw new Error('allocation failed');allocations++;
  let output=0,length=0;
  try {
    new Uint8Array(module.memory.buffer,input,bytes.length).set(bytes);
    const packed=module.dcss_request(input,bytes.length);
    output=Number(packed&0xffffffffn);length=Number(packed>>32n);if(!output||!length)throw new Error('missing output');allocations++;
    return JSON.parse(decoder.decode(new Uint8Array(module.memory.buffer,output,length)));
  } finally {
    module.dcss_release(input,bytes.length);releases++;
    if(output&&length){module.dcss_release(output,length);releases++;}
    peakPages=Math.max(peakPages,module.memory.buffer.byteLength/65536);
  }
}
const records=[];
function record(name,value){records.push({name,...value});}
record('reviewed artifact',{file:'build/boundary.wasm',sha256:createHash('sha256').update(wasmBytes).digest('hex'),node:process.version});
for(const seed of ['9007199254740993','18446744073709551615']){
  const started=call({op:'seed',seed,player:'review'});
  const message=started.messages.find(message=>message.id==='rng.seed');
  const rerendered=call({op:'text',language:'en',message});
  record('seed event JS roundtrip',{seed,startedOk:started.ok,valueSeed:started.value.seed,wireSeed:message.params.seed,firstText:started.text[0],rerenderedOk:rerendered.ok,rerenderedText:rerendered.text,error:rerendered.value?.error??null});
}
for(const seed of ['042','+42',' 42','-1','1.0','','18446744073709551616',42]){
  const response=call({op:'text',language:'en',message:{id:'rng.seed',params:{seed}}});
  record('invalid decimal seed parameter',{seed,ok:response.ok,error:response.value?.error??null});
}
const ordinaryNumber=call({op:'text',message:{id:'rng.sample',params:{value:'42'}}});
record('ordinary integer still rejects numeric text',{ok:ordinaryNumber.ok,error:ordinaryNumber.value?.error??null});
const started=call({op:'seed',seed:'42',player:'review'});
const nearOverflow=started.session.replace(/"count":0/, '"count":18446744073709551615').replace(/"draws":0/, '"draws":18446744073709551615');
for(const command of [{op:'sample'},{op:'dice',count:1,sides:2},{op:'dice',count:1,sides:1}]){
  const response=call({...command,session:nearOverflow});
  record('counter u64MAX',{command,ok:response.ok,value:response.value,session:response.session});
}
for(const files of [
  [{path:'a',bytes:[1]},{path:'a/b',bytes:[2]}],
  [{path:'a/b',bytes:[2]},{path:'a',bytes:[1]}],
  [{path:'../escape',bytes:[1]}],
  [{path:'same',bytes:[1]},{path:'same',bytes:[2]}],
]){
  const response=call({op:'pack_native',files});
  const unpacked=response.ok?call({op:'unpack_native',save:response.value.save}):null;
  record('native path set',{paths:files.map(file=>file.path),packOk:response.ok,unpackOk:unpacked?.ok??null,error:response.value.error??null});
}
function checksum(text){let value=0xcbf29ce484222325n;for(const byte of encoder.encode(text))value=((value^BigInt(byte))*0x100000001b3n)&0xffffffffffffffffn;return value.toString(16).padStart(16,'0');}
const nativeBase=call({op:'pack_native',files:[{path:'valid',bytes:[1]}]}).value.save;
for(const paths of [['a','a/b'],['a/b','a']]){
  const envelope=JSON.parse(nativeBase);envelope.payload=JSON.stringify({files:paths.map(path=>({path,bytes:[1]}))});envelope.checksum=checksum(envelope.payload);
  const response=call({op:'unpack_native',save:JSON.stringify(envelope)});
  record('crafted native ancestor conflict',{paths,ok:response.ok,error:response.value?.error??null});
}
const saved=call({op:'save',session:started.session}).value.save;
for(const [field,value] of [['version',2],['abi',2],['upstream','other'],['kind','other'],['checksum','0000000000000000']]){
  const envelope=JSON.parse(saved);envelope[field]=value;
  const response=call({op:'load',save:JSON.stringify(envelope)});
  record('save metadata rejection',{field,ok:response.ok,error:response.value.error});
}
record('allocation limits',{zero:module.dcss_allocate(0),oversized:module.dcss_allocate(16*1024*1024+1)});
const before=module.memory.buffer.byteLength;
for(let index=0;index<2000;index++)call({op:'key',key:'ArrowUp',modifiers:{shift:false,ctrl:false,alt:false,meta:false,composing:false},text_mode:false});
record('repeated request allocations',{calls:2000,beforeBytes:before,afterBytes:module.memory.buffer.byteLength,allocations,releases,peakPages});
const frameTests=[
  {columns:0,rows:1,cells:[],cursor:null},
  {columns:1,rows:1,cells:[{glyph:0xd800,foreground:15,background:0}],cursor:null},
  {columns:1,rows:1,cells:[{glyph:64,foreground:16,background:0}],cursor:null},
  {columns:1,rows:1,cells:[{glyph:64,foreground:15,background:0}],cursor:[1,0]},
];
for(const frame of frameTests){const response=call({op:'frame',frame});record('frame bounds',{frame,ok:response.ok,error:response.value.error});}
for(const row of records.filter(record=>record.name==='seed event JS roundtrip')){
  assert.equal(row.startedOk,true);assert.equal(row.valueSeed,row.seed);assert.equal(row.wireSeed,row.seed);assert.equal(row.rerenderedOk,true);assert(row.rerenderedText[0].includes(row.seed));
}
for(const row of records.filter(record=>record.name==='invalid decimal seed parameter'||record.name==='ordinary integer still rejects numeric text'))assert.equal(row.ok,false);
for(const row of records.filter(record=>record.name==='native path set'))assert.equal(row.packOk,false);
for(const row of records.filter(record=>record.name==='crafted native ancestor conflict'))assert.equal(row.ok,false);
const counters=records.filter(record=>record.name==='counter u64MAX');for(const row of counters)assert.equal(row.ok,true);assert.equal(counters[0].value.draws,'0');assert.equal(counters[1].value.draws,'0');assert.equal(counters[0].session,counters[1].session);assert.equal(counters[2].value.draws,'18446744073709551615');
for(const row of records.filter(record=>record.name==='save metadata rejection'||record.name==='frame bounds'))assert.equal(row.ok,false);
const limits=records.find(record=>record.name==='allocation limits');assert.equal(limits.zero,0);assert.equal(limits.oversized,0);
const ownership=records.find(record=>record.name==='repeated request allocations');assert.equal(ownership.allocations,ownership.releases);assert.equal(ownership.beforeBytes,ownership.afterBytes);
record('regression assertions',{passed:true,records:records.length});
await fs.writeFile(path.join(root,'tests','review','probe-results.json'),JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify(records,null,2));
