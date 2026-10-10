const assert=require('node:assert/strict');
const {runWorkerInContext,readWorkerSource}=require('./startup-bridge-mock.cjs');
const outputs=[],listeners={},dataFiles=new Map();let options,heldResume,atInput=false,turn=0,snapshots=0,saveCalls=0;
const nativeWords=new Uint32Array([0x304b,7,0,0,7,0]);
const emitFrame=()=>options.dcssFrame(nativeWords,2,1,0,0,true,[{cell:0,text:'か\u3099'}]);
const readInput=()=>{atInput=true;options.dcssReadKey(key=>{atInput=false;heldResume=()=>{turn++;emitFrame();readInput();};});};
const engine={FS:{mkdirTree(){},writeFile(p,b){dataFiles.set(p,Array.from(b));},readFile(p){return Uint8Array.from(dataFiles.get(p));},readdir(p){return ['.','..',...new Set([...dataFiles.keys()].filter(k=>k.startsWith(p+'/')).map(k=>k.slice(p.length+1).split('/')[0]))];},stat(){return {mode:0};},isDir(){return false;}},
callMain(args){assert.equal(JSON.stringify(args),JSON.stringify(['-name','猫']));emitFrame();readInput();},
UTF8ToString(){return JSON.stringify({turn,rng:'18446744073709551615'});},
_dcss_snapshot_json(){assert.equal(atInput,true);snapshots++;return 1;},
_dcss_repaint(){assert.equal(atInput,true);emitFrame();},
_dcss_save(){assert.equal(atInput,true);saveCalls++;dataFiles.set('/persist/level',[1,2,3]);return 1;}};
const self={postMessage(message,transfer=[]){outputs.push(structuredClone(message,{transfer}));},addEventListener(type,fn){listeners[type]=fn;}};
const context={self,Error,Uint32Array,Uint8Array,Set,JSON,Number,Array,queueMicrotask,importScripts(url){assert.equal(url,'/engine/build/dcss.js');self.createDcssEngine=async o=>{options=o;return engine;};}};
runWorkerInContext(readWorkerSource(),context);
const send=async data=>{await self.onmessage({data});await new Promise(setImmediate);};
(async()=>{
await send({type:'request',id:1,op:'boot',files:[{path:'player',bytes:[5]}]});assert.equal(outputs.find(o=>o.id===1).ok,true,JSON.stringify(outputs));
await send({type:'request',id:2,op:'start',arguments:['-name','猫']});assert.equal(outputs.find(o=>o.id===2).ok,true,JSON.stringify(outputs));
assert.equal(nativeWords.buffer.byteLength,24);const frame=outputs.find(o=>o.type==='frame');assert.equal(frame.clusters[0].text,'か\u3099');assert.equal(new Uint32Array(frame.buffer)[3],0);
await send({type:'key',key:46});assert.equal(atInput,false);
await send({type:'request',id:3,op:'state'});assert.equal(outputs.some(o=>o.id===3),false);assert.equal(snapshots,0);
heldResume();await new Promise(setImmediate);assert.equal(outputs.find(o=>o.id===3).value.turn,1);assert.equal(snapshots,1);
await send({type:'request',id:4,op:'repaint'});assert.equal(outputs.find(o=>o.id===4).ok,true);assert.equal(turn,1);
await send({type:'request',id:5,op:'save'});assert.equal(saveCalls,1);assert.equal(outputs.find(o=>o.id===5).value.some(f=>f.path==='level'),true);
await send({type:'key',key:46});await send({type:'request',id:6,op:'state'});assert.equal(outputs.some(o=>o.id===6),false);
options.onAbort('test failure');assert.equal(outputs.find(o=>o.id===6).ok,false);assert.equal(outputs.some(o=>o.type==='fatal'&&o.error.includes('test failure')),true);
console.log(JSON.stringify({protocol:'classic worker host stub only',checks:['startup and validated file restore','frame transfer preserves original memory','exact combining cluster and zero continuation','busy requests deferred until input suspension','repaint adds no command','save returns native bytes','abort rejects deferred request'],actual_engine_executed:false},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
