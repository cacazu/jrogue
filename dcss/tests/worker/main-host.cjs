const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
const instances=[],stored=new Map(),events=[];let putsCommitted=0,packCalls=0,unpackCalls=0,frameCalls=0;
const nativeFiles=[{path:'player.cs',bytes:[0,255,1]}];
class FakeWorker{
constructor(url,options){assert.equal(url,'/web/core-worker.js');assert.equal(options.type,undefined);this.messages=[];this.terminated=false;instances.push(this);}
postMessage(message){this.messages.push(structuredClone(message));if(message.type==='key')return;
queueMicrotask(()=>{if(this.terminated)return;if(message.op==='start'){this.frame();this.onmessage({data:{type:'waiting',value:true}});}
let value=true;if(message.op==='state')value={turn:1,rng:'18446744073709551615'};if(message.op==='save'||message.op==='files')value=nativeFiles;
if(message.op==='repaint')this.frame();if(message.op==='blocked')return;this.onmessage({data:{type:'response',id:message.id,ok:true,value}});});}
frame(){const words=new Uint32Array([0x304b,7,0,0,7,0]);this.onmessage({data:{type:'frame',buffer:words.buffer,columns:2,rows:1,x:0,y:0,cursor:true,clusters:[{cell:0,text:'か\u3099'}]}});}
terminate(){this.terminated=true;}
}
global.WebAssembly={Suspending:function MockSuspending(){},promising:function MockPromising(fn){return fn;}};
global.Worker=FakeWorker;global.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail;}};
global.window={dispatchEvent(event){events.push(event);}};global.location={href:'http://localhost/?core=1'};
const elements={'#player':{value:'猫'},'#seed':{value:'123'},'#species':{value:'Hu'},'#job':{value:'Fi'},'#console':{focus(){}},'#status':{textContent:''}};
global.document={querySelector(selector){return elements[selector];}};
global.indexedDB={open(){const request={result:{close(){},transaction(name,mode){const tx={objectStore(){return {put(value,key){stored.set(key,value);queueMicrotask(()=>{putsCommitted++;tx.oncomplete();});},get(key){const read={};queueMicrotask(()=>{read.result=stored.get(key);read.onsuccess();});return read;}};}};return tx;}}};queueMicrotask(()=>request.onsuccess());return request;}};
const harness={setEngine(value){assert.equal(typeof value.dcssQueueKey,'function');assert.equal(Object.keys(value).length,1);},renderCoreFrame(frame){frameCalls++;assert.equal(frame.cells[0].text,'か\u3099');assert.equal(frame.cells[1].glyph,0);},call(request){if(request.op==='pack_native'){packCalls++;assert.deepEqual(request.files,nativeFiles);return {value:{save:'validated-native-envelope'}};}if(request.op==='unpack_native'){unpackCalls++;assert.equal(request.save,'validated-native-envelope');return {value:{files:nativeFiles}};}if(request.op==='text')return {text:['ゲーム本体を利用できません。']};throw Error('unexpected Rust boundary call');}};
(async()=>{
const {startCore}=await import(pathToFileURL(process.env.DCSS_CORE_DEBUG_SOURCE||path.resolve(__dirname,'../../web/core-debug.mjs')).href);
const api=await startCore(harness);assert.equal(api.runtime,'jspi');assert.equal(instances[0].messages.find(m=>m.op==='boot').runtime,'jspi');assert.equal(api.nativeLanguage,'ja');assert.equal(instances[0].messages.find(m=>m.op==='boot').language,'ja');assert.equal(api.waiting,true);assert.equal(api.frames,1);assert.equal('module' in api,false);assert.equal(typeof global.createDcssEngine,'undefined');
assert.equal((await api.state()).rng,'18446744073709551615');assert.equal(await api.repaint(),true);assert.equal(api.frames,2);
assert.deepEqual(await api.files(),nativeFiles);assert.equal(await api.save(),'validated-native-envelope');assert.equal(packCalls,1);assert.equal(putsCommitted,1);
api.queue(46);assert.equal(api.waiting,false);assert.equal(instances[0].messages.at(-1).key,46);assert.throws(()=>api.queue('j'));
const worker=instances[0];worker.postMessage=message=>worker.messages.push(message);const pending=api.state();worker.onmessage({data:{type:'fatal',error:'stub abort'}});
await assert.rejects(pending,/stub abort/);await assert.rejects(api.files(),/stub abort/);assert.equal(worker.terminated,true);assert.equal(api.error,'stub abort');assert.equal(events.at(-1).type,'dcss-core-error');
global.location.href='http://localhost/?core=1&resume=1';harness.language='en';const resumed=await startCore(harness);assert.equal(resumed.nativeLanguage,'en');assert.equal(instances[1].messages.find(m=>m.op==='boot').language,'en');assert.equal(unpackCalls,1);assert.deepEqual(instances[1].messages.find(m=>m.op==='boot').files,nativeFiles);
const priorWorkers=instances.length;global.location.href='http://localhost/?runtime=asyncify';await assert.rejects(startCore(harness),/requires JSPI/);assert.equal(instances.length,priorWorkers);
global.location.href='http://localhost/?runtime=unknown';await assert.rejects(startCore(harness),/requires JSPI/);assert.equal(instances.length,priorWorkers);
global.location.href='http://localhost/';global.WebAssembly={};await assert.rejects(startCore(harness),/does not support JSPI/);assert.equal(instances.length,priorWorkers);
console.log(JSON.stringify({protocol:'main-thread host stub only',checks:['default boot requests JSPI','explicit Asyncify rejected before Worker','unknown runtime rejected before Worker','missing JSPI rejected before Worker','default Japanese and explicit English nativeLanguage boot contract','async inspection API and cached wait/frame values','no main-thread C++ module','Rust frame/text cluster route','Rust native pack before committed storage','normalized integer keys only','fatal rejects all pending/future requests','resume Rust unpack before worker files'],actual_engine_executed:false},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
