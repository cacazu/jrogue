import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createPreviewServer} from '../web/server.mjs';
import { installSemanticBrowserProbe, verifySemanticBrowser } from './semantic-browser.mjs';
import { installHistoryObserverProbe, verifySemanticHistorySave, verifySemanticHistoryResume, verifyLegacyNativeResume } from './history-browser.mjs';
import { verifyLifecycleBrowser } from './lifecycle-browser.mjs';
import { verifyRootStartup, verifyQuickstartHelp } from './root-native-witness.mjs';
const runtime=process.env.DCSS_ENGINE_MODE??'jspi';if(runtime!=='jspi')throw new Error('normal-route browser verification requires JSPI');
const coreQuery='';
const directory=path.dirname(fileURLToPath(import.meta.url)),output=path.join(directory,'output');await mkdir(output,{recursive:true});
const profile=await mkdtemp(path.join(os.tmpdir(),'dcss-core-browser-'));
const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu',...(runtime==='jspi'&&process.env.DCSS_BROWSER_SINGLE_COMPILATION!=='1'?[]:['--wasm-num-compilation-tasks=1']),...(process.env.DCSS_WASM_BASELINE==='1'?['--js-flags=--liftoff-only']:[]),'--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let chromeErrors='';chrome.stderr.on('data',chunk=>chromeErrors+=chunk);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(callback,label){evidence.step=label;const deadline=Date.now()+150000;while(Date.now()<deadline){const value=await callback();if(value)return value;await delay(100);}throw new Error('Timed out: '+label+' '+chromeErrors.slice(-500));}
class CDP{
  constructor(socket){this.socket=socket;this.id=0;this.pending=new Map();socket.addEventListener('message',event=>{const p=JSON.parse(event.data);if(p.method==='Runtime.exceptionThrown')evidence.runtimeErrors=(evidence.runtimeErrors||[]).concat(p.params);if(p.method==='Runtime.consoleAPICalled')evidence.console=(evidence.console||[]).slice(-100).concat({type:p.params.type,args:p.params.args.map(a=>a.value??a.description)});if(p.id){const q=this.pending.get(p.id);this.pending.delete(p.id);if(q){clearTimeout(q.timer);p.error?q.reject(new Error(JSON.stringify(p.error))):q.resolve(p.result);}}});}
  call(method,params={}){return new Promise((resolve,reject)=>{const id=++this.id,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP timeout '+method+' at '+evidence.step));},60000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
const evidence={time:new Date().toISOString(),scope:'official full C++ engine + Rust browser boundaries; partial typed Japanese canned messages, other gameplay English',checks:[],base,runtime,runtimeCompilationMode:process.env.DCSS_WASM_BASELINE==='1'?'diagnostic baseline-only V8; ordinary browser performance unverified':(runtime==='jspi'&&process.env.DCSS_BROWSER_SINGLE_COMPILATION!=='1'?'ordinary V8 compilation and tier-up settings':'V8 tier-up enabled; test compilation concurrency1')};
let socket;
try{
  evidence.build=JSON.parse(await readFile(path.join(directory,'../engine/build-jspi/manifest.json'),'utf8'));assert.equal(evidence.build.runtime,'jspi');assert.equal(evidence.build.exception_model,'wasm');
  const port=await until(async()=>{try{return Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return null;}},'Chrome port');
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  const cdp=new CDP(socket);await cdp.call('Runtime.enable');await cdp.call('Page.enable');
  await installSemanticBrowserProbe(cdp);
  await installHistoryObserverProbe(cdp);
  await cdp.call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
  await cdp.call('Page.navigate',{url:base+coreQuery});
  const captureNative=async name=>{const shot=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,name+'.png'),Buffer.from(shot.data,'base64'));};
  await verifyRootStartup({cdp,until,evidence,capture:captureNative});
  const initial=await cdp.eval('__dcssCore.state()');assert.equal(initial.hp>0,true);assert.equal(initial.rng.length,45);assert.equal(new Set(initial.rng.map(r=>r.state+'/'+r.sequence)).size,45,'Snapshot must observe 45 distinct persistent streams');evidence.initial=initial;evidence.checks.push('Official Human Fighter game starts in real Chrome');
  await verifySemanticBrowser({cdp,until,evidence});
  const pure=await cdp.eval(`(async()=>{const before=JSON.stringify(await __dcssCore.state());for(let i=0;i<25;i++)await __dcssCore.repaint();return before===JSON.stringify(await __dcssCore.state());})()`);
  assert.equal(pure,true);evidence.checks.push('25 Rust/Canvas redraws preserve full exposed player state and every PCG state/count');
  await verifyQuickstartHelp({cdp,until,evidence,capture:captureNative});
  await cdp.eval(`document.querySelector('#console').focus()`);await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',key:'.',code:'Period',text:'.'});
  await until(()=>cdp.eval(`(async()=>__dcssCore.waiting&&(await __dcssCore.state()).turn>${initial.turn})()`),'keyboard wait turn');evidence.checks.push('Real keyboard input crosses Rust key translation and advances official turn');
  const beforeInventory=await cdp.eval('(async()=> (await __dcssCore.state()).turn)()');await cdp.eval('__dcssCore.queue(105)');await until(()=>cdp.eval('__dcssCore.waiting'),'inventory');assert.equal(await cdp.eval('(async()=> (await __dcssCore.state()).turn)()'),beforeInventory);await cdp.eval('__dcssCore.queue(27)');await until(()=>cdp.eval('__dcssCore.waiting'),'close inventory');evidence.checks.push('Native inventory opens and closes without advancing a turn');
  if(!process.argv.includes('--startup-only')){
  const save=await cdp.eval('__dcssCore.save()');assert.equal(typeof save,'string');evidence.saved=await cdp.eval('__dcssCore.state()');evidence.files=await cdp.eval('(async()=> (await __dcssCore.files()).map(file=>({path:file.path,bytes:file.bytes.length})))()');evidence.checks.push('Native save bytes validated by Rust and committed to IndexedDB');
  await verifySemanticHistorySave({cdp,evidence,save});
  await cdp.eval('__dcssCore.queue(46)');await until(()=>cdp.eval(`(async()=>__dcssCore.waiting&&(await __dcssCore.state()).turn>${evidence.saved.turn})()`),'next saved command');evidence.expectedNext=await cdp.eval('__dcssCore.state()');
  await cdp.call('Page.navigate',{url:base+'?resume=1'});await until(()=>cdp.eval(`(async()=> Boolean(window.__dcssCore?.waiting)&&(await __dcssCore.state()).turn===${evidence.saved.turn})()`),'native resume');
  const restored=await cdp.eval('__dcssCore.state()');evidence.restored=restored;
  function logical(value){return JSON.parse(JSON.stringify(value,(key,value)=>['count','draws'].includes(key)?undefined:value));}
  assert.deepEqual(logical(restored),logical(evidence.saved));
  await cdp.eval('__dcssCore.queue(46)');await until(()=>cdp.eval(`(async()=>__dcssCore.waiting&&(await __dcssCore.state()).turn>${evidence.saved.turn})()`),'restored next command');evidence.actualNext=await cdp.eval('__dcssCore.state()');assert.deepEqual(logical(evidence.actualNext),logical(evidence.expectedNext));evidence.checks.push('Native reload resumes same turn/player/PCG words and deterministic next wait command');
  await verifySemanticHistoryResume({cdp,until,evidence});
  await verifyLegacyNativeResume({cdp,until,evidence,base});
  }
  await cdp.call('Page.captureScreenshot',{format:'png'}).then(r=>writeFile(path.join(output,'core-desktop.png'),Buffer.from(r.data,'base64')));
  await cdp.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});const beforeTouch=await cdp.eval('(async()=> (await __dcssCore.state()).turn)()');await cdp.eval(`document.querySelector('[data-key="."]').click()`);await until(()=>cdp.eval(`(async()=>__dcssCore.waiting&&(await __dcssCore.state()).turn>${beforeTouch})()`),'touch wait');assert.equal(await cdp.eval('document.documentElement.scrollWidth<=window.innerWidth'),true);evidence.checks.push('Mobile touch wait command reaches full engine; no page overflow');
  await cdp.call('Page.captureScreenshot',{format:'png'}).then(r=>writeFile(path.join(output,'core-mobile.png'),Buffer.from(r.data,'base64')));
  await verifyLifecycleBrowser({cdp,until,evidence});
  evidence.result='pass';
}catch(error){evidence.result='fail';evidence.error=error.stack;process.exitCode=1;}
finally{if(socket)socket.close();chrome.kill();server.closeAllConnections();server.close();await writeFile(path.join(output,'core-browser-evidence.json'),JSON.stringify(evidence,null,2));process.stdout.write(JSON.stringify({result:evidence.result,step:evidence.step,checks:evidence.checks,error:evidence.error,console:evidence.console,runtimeErrors:evidence.runtimeErrors},null,2)+'\n');}
