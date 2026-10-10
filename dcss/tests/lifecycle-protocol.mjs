// Browser-host lifecycle stubs; no native C++/Rust or browser is executed.
import fs from 'node:fs';
import path from 'node:path';
import startupMock from './worker/startup-bridge-mock.cjs';
const { runWorkerInContext } = startupMock;
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.DCSS_REPOSITORY||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=startupMock.readWorkerSource();
const checks=[];
function workerFixture(mode='waiting') {
  const posts=[],listeners={};let options,exports=0,finishBoot;
  const booted=new Promise(resolve=>{finishBoot=resolve;});
  const engine={FS:{mkdirTree(){},writeFile(){}},callMain(){
    if(mode==='waiting')options.dcssReadKey(()=>{});
    else {options.onExit(0);if(mode==='unexpected')throw Error('unexpected after exit');throw {name:'ExitStatus',status:0,message:'normal exit'};}
  },_dcss_snapshot_json(){exports++;return 1;},UTF8ToString(){return '{}';}};
  const self={postMessage(value){posts.push(structuredClone(value));if(value.type==='response'&&value.id===1)finishBoot(value);},addEventListener:(name,fn)=>listeners[name]=fn,
    createDcssEngine:async value=>{options=value;return engine;}};
  runWorkerInContext(source,{self,queueMicrotask,importScripts(){},Uint8Array,Uint32Array,console});
  const send=async data=>{await self.onmessage({data});if(data.type==='request'&&data.op==='boot')await booted;await new Promise(setImmediate);};
  return {posts,listeners,send,get options(){return options;},get exports(){return exports;}};
}
const normal=workerFixture('normal');
await normal.send({type:'request',op:'boot',id:1,files:[]});
await normal.send({type:'request',op:'start',id:2,arguments:[]});
assert.equal(normal.posts.find(post=>post.id===2).ok,true);
assert.equal(normal.posts.filter(post=>post.type==='completed').length,1);
assert.equal(normal.posts.some(post=>post.type==='fatal'),false);
checks.push('status0 plus expected ExitStatus0 completes a synchronous session');
normal.options.onExit(0);await new Promise(setImmediate);
assert.equal(normal.posts.filter(post=>post.type==='completed').length,1);
checks.push('normal completion is idempotent');
await normal.send({type:'request',op:'state',id:3});
assert.equal(normal.posts.find(post=>post.id===3).ok,false);
await normal.send({type:'key',key:46});
assert.equal(normal.exports,0);
checks.push('terminal requests and keys never invoke engine exports');
let prevented=false;
normal.listeners.error({error:{name:'ExitStatus',status:0},preventDefault(){prevented=true;}});
assert.equal(prevented,true);
assert.equal(normal.posts.some(post=>post.type==='fatal'),false);
checks.push('expected ExitStatus0 error event is narrowly suppressed after completion');
normal.listeners.error({error:Error('late arbitrary exception'),message:'late error'});
assert.equal(normal.posts.some(post=>post.type==='fatal'&&post.error.includes('late arbitrary')),true);
checks.push('arbitrary post-exit errors remain fatal');
const unexpected=workerFixture('unexpected');
await unexpected.send({type:'request',op:'boot',id:1,files:[]});
await unexpected.send({type:'request',op:'start',id:2,arguments:[]});
assert.equal(unexpected.posts.some(post=>post.type==='fatal'),true);
assert.equal(unexpected.posts.some(post=>post.type==='completed'),false);
checks.push('synchronous unexpected exception after status0 is not hidden by completion');
const failed=workerFixture();
await failed.send({type:'request',op:'boot',id:1,files:[]});
failed.options.onExit(1);
assert.equal(failed.posts.some(post=>post.type==='fatal'),true);
assert.equal(failed.posts.some(post=>post.type==='completed'),false);
checks.push('nonzero exit remains fatal');

const instances=[],events=[];
// Capability stubs for the main-host probe; no WASM module is instantiated.
globalThis.WebAssembly={Suspending(){},promising(){}};
globalThis.Worker=class {
  constructor(){this.terminated=false;this.sent=[];instances.push(this);}
  postMessage(data){this.sent.push(data);if(['boot','start'].includes(data.op))queueMicrotask(()=>this.onmessage({data:{type:'response',id:data.id,ok:true,value:true}}));}
  terminate(){this.terminated=true;}
};
globalThis.window={dispatchEvent:event=>events.push(event)};
globalThis.CustomEvent=class {constructor(type,options){this.type=type;this.detail=options.detail;}};
globalThis.location={href:'http://localhost/?core=1'};
const nodes={'#player':{value:'Player'},'#seed':{value:'42'},'#species':{value:'Hu'},'#job':{value:'Fi'},'#console':{focus(){}},'#status':{textContent:''}};
globalThis.document={querySelector:selector=>nodes[selector]};
const retained=[{id:'game.canned.you_die'}];
const {startCore}=await import(pathToFileURL(process.env.DCSS_CORE_DEBUG_SOURCE||path.join(root,'web/core-debug.mjs')).href);
const api=await startCore({setEngine(){},call(request){assert.equal(request.message.id,'status.game_ended');return {text:['ゲームは終了しました。']};}});
const pending=api.state();
instances[0].onmessage({data:{type:'completed',status:0}});
await assert.rejects(pending,/session completed/);
assert.equal(api.completed,true);assert.equal(api.error,null);assert.equal(api.waiting,false);
assert.equal(instances[0].terminated,true);assert.equal(events.at(-1).type,'dcss-core-completed');
assert.equal(nodes['#status'].textContent,'ゲームは終了しました。');
checks.push('main completion releases Worker, settles pending requests and shows localized terminal status');
const sent=instances[0].sent.length;
await assert.rejects(api.state(),/session completed/);await assert.rejects(api.save(),/session completed/);
api.queue(46);assert.equal(instances[0].sent.length,sent);
assert.equal(retained[0].id,'game.canned.you_die');
assert.equal(events.some(event=>event.type==='dcss-core-error'),false);
checks.push('completed API neither forwards commands nor reports an abnormal engine failure');
console.log(JSON.stringify({kind:'lifecycle host stubs',checks,count:checks.length,actual_engine_executed:false,browser_executed:false},null,2));
