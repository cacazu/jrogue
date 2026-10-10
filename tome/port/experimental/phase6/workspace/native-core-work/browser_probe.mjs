/* SPDX-License-Identifier: GPL-3.0-or-later
 * One real Chrome process tree, owned by monitor_native_job.py. No game mocks.
 */
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const args=new Map();
for(let i=2;i<process.argv.length;i+=2)args.set(process.argv[i],process.argv[i+1]);
const root=path.resolve(args.get('--root')||'.');
const entry=args.get('--entry')||'/index.html';
const output=path.resolve(args.get('--output')||'native-core-work/browser-probe');
const reportExpression=args.get('--report-expression')||'window.tomeNativeBootReport';
const deadlineMs=Number(args.get('--deadline-ms')||180000);
await mkdir(output,{recursive:true});
let server;
if(args.has('--server-module')){
  const namespace=await import(pathToFileURL(path.resolve(args.get('--server-module'))));
  server=await namespace.createTomeServer();
}else{
  server=http.createServer(async(req,res)=>{
    try{
      const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.resolve(root,'.'+name);
      if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.wasm':'application/wasm'};
      const bytes=await readFile(file);
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
    }catch(error){if(!res.headersSent)res.writeHead(404).end(String(error));else res.destroy(error);}
  });
}
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+entry;
const profile=await mkdtemp(path.join(os.tmpdir(),'tome-native-browser-'));
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
  '--headless=new','--no-first-run','--no-default-browser-check',
  '--disable-background-networking','--disable-component-update',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank',
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let stderr='',socket,sequence=0;
const pending=new Map(),exceptions=[],consoleLines=[];
let consoleEventCount=0;
chrome.stderr.on('data',bytes=>stderr+=bytes.toString());
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const evidence={scope:'Real Chrome actual source-backed browser runtime',url,started_at:new Date().toISOString()};
async function servedHash(route){
  const response=await fetch('http://127.0.0.1:'+server.address().port+route);
  if(!response.ok){await response.body?.cancel();return {route,status:response.status};}
  const hash=createHash('sha256');let bytes=0;
  for await(const chunk of response.body){hash.update(chunk);bytes+=chunk.length;}
  return {route,status:response.status,bytes,sha256:hash.digest('hex')};
}
function call(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++sequence;
    const timeout=method==='Runtime.evaluate'?deadlineMs:20000;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},timeout);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const value=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(value.exceptionDetails)throw Error(JSON.stringify(value.exceptionDetails));
  return value.result.value;
}
try{
  evidence.served_artifacts=[];
  const routes=['/native/tome-native.mjs','/native/tome-native.wasm','/vfs/adapter/real-core-probe.lua'];
  if(entry.includes('retained-browser')||entry.includes('ui-roundtrip')||entry.includes('play-browser')) {
    routes.push('/retained/tome_core_environment.wasm','/rust/retained-browser-session.mjs',
      '/rust/retained-core-adapter.mjs','/rust/original-native-core.mjs','/rust/diagnostic-renderer.mjs');
  }
  if(entry.includes('semantic')||entry.includes('play-browser'))routes.push('/semantic/tome_text_wasm.wasm');
  if(entry.includes('play-browser'))routes.push('/play-browser.html','/play-browser.mjs');
  if(entry.includes('physical-play-browser'))routes.push('/physical-play-browser.html','/physical-play-browser.mjs',
    '/physical/physical-play-owner.mjs','/physical/physical-input-wasm.mjs','/physical/original-physical-input.mjs',
    '/physical/focused-input-host.mjs','/physical/tome_physical_input.wasm','/physical/i18n/en.json','/physical/i18n/ja.json');
  if(entry.includes('prepared-map-observer'))routes.push('/prepared-map-observer.html','/observer/observer.mjs',
    '/observer/i18n/en.json','/observer/i18n/ja.json','/rust/tome-map-packet.wasm','/checkpoint/source-manifest.json',
    '/checkpoint/checkpoint_store.mjs','/checkpoint/baseline_flow.mjs','/checkpoint/native_archive_validator.mjs');
  if(entry.includes('planar-regression'))routes.push('/planar-regression.html','/planar-regression.mjs');
  if(entry.includes('ui-roundtrip'))routes.push('/ui-roundtrip-browser.html');
  for(const route of routes)evidence.served_artifacts.push(await servedHash(route));
  let port;
  const launchDeadline=Date.now()+30000;
  while(!port&&Date.now()<launchDeadline){
    try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}
    if(!port)await sleep(100);
  }
  if(!port)throw Error('Owned Chrome did not expose DevTools');
  const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',({data})=>{
    const message=JSON.parse(data);
    if(message.id){const item=pending.get(message.id);if(item){clearTimeout(item.timer);pending.delete(message.id);message.error?item.reject(Error(JSON.stringify(message.error))):item.resolve(message.result);}}
    else if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);
    else if(message.method==='Runtime.consoleAPICalled'){
      consoleEventCount++;
      const compact={type:message.params.type,timestamp:message.params.timestamp,
        args:message.params.args.map(arg=>({type:arg.type,value:typeof arg.value==='string'?arg.value.slice(0,8192):arg.value}))};
      consoleLines.push(compact);
      if(consoleLines.length>2000)consoleLines.shift();
    }
  });
  await call('Runtime.enable');await call('Page.enable');
  evidence.browser=await call('Browser.getVersion');
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url});
  const runtimeDeadline=Date.now()+deadlineMs;
  while(Date.now()<runtimeDeadline){
    const report=await evaluate(reportExpression);
    if(report&&report.completed){evidence.runtime=report;break;}
    if(report&&!('completed' in report)&&typeof report.passed==='boolean'){evidence.runtime=report;break;}
    await sleep(250);
  }
  if(!evidence.runtime)throw Error('Actual browser report did not complete before deadline');
  if(args.has('--scenario-module')&&evidence.runtime.passed){
    const scenario=await import(pathToFileURL(path.resolve(args.get('--scenario-module'))));
    evidence.scenario=await scenario.runScenario({call,evaluate,evidence,output});
    if(evidence.scenario.passed!==true)throw Error('Original browser scenario did not pass');
  }
  evidence.body_text=await evaluate('document.body.innerText');
  const screenshot=await call('Page.captureScreenshot',{format:'png'});
  await writeFile(path.join(output,'desktop.png'),Buffer.from(screenshot.data,'base64'));
  evidence.passed=evidence.runtime.passed===true&&exceptions.length===0;
  if(exceptions.length)throw Error('Actual browser reported uncaught runtime exceptions');
}catch(error){
  evidence.passed=false;evidence.error=error.stack||String(error);
  try{evidence.body_text=await evaluate('document.body.innerText');}catch{}
}finally{
  evidence.exceptions=exceptions;evidence.console=consoleLines;evidence.console_event_count=consoleEventCount;
  evidence.console_events_retained=consoleLines.length;evidence.console_capture_limit=2000;evidence.chrome_stderr=stderr;
  evidence.completed_at=new Date().toISOString();
  await writeFile(path.join(output,'evidence.json'),JSON.stringify(evidence,null,2));
  try{await call('Browser.close');}catch{}
  socket?.close();chrome.kill();
  for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Browser probe ended'));}
  await new Promise(resolve=>server.close(resolve));
}
console.log(JSON.stringify({passed:evidence.passed,evidence:path.join(output,'evidence.json'),
  runtime:evidence.runtime&&{passed:evidence.runtime.passed,phase:evidence.runtime.phase,sourceCommit:evidence.runtime.sourceCommit,
    snapshot:evidence.runtime.snapshot,metrics:evidence.runtime.metrics,semanticCatalogue:evidence.runtime.semanticCatalogue,
    localization:evidence.runtime.localization&&{enabled:evidence.runtime.localization.enabled,status:evidence.runtime.localization.status,
      counters:evidence.runtime.localization.coverage?.counters}},error:evidence.error}));
if(!evidence.passed)process.exitCode=1;
