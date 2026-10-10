import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const mixed=process.argv[2]==='mixed';
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'drl-lua-wasi-'));
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://127.0.0.1').pathname;const target=path.resolve(root,'.'+(pathname==='/'?'/browser-probe.html':pathname));if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const bytes=await fs.readFile(target);res.writeHead(200,{'Content-Type':target.endsWith('.mjs')?'text/javascript':target.endsWith('.wasm')?'application/wasm':'text/html','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket,cdp,errors='';chrome.stderr.on('data',b=>errors+=b.toString());
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<200;i++){const v=await fn();if(v)return v;await delay(100);}throw Error('Timeout '+errors.slice(-500));}
class CDP{constructor(ws){this.ws=ws;this.id=0;this.wait=new Map();ws.addEventListener('message',e=>{const p=JSON.parse(e.data),r=this.wait.get(p.id);if(r){this.wait.delete(p.id);clearTimeout(r.timer);p.error?r.reject(Error(JSON.stringify(p.error))):r.resolve(p.result);}});}call(method,params={}){return new Promise((resolve,reject)=>{const id=++this.id,timer=setTimeout(()=>reject(Error('CDP timeout')),20000);this.wait.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));});}async eval(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}}
const evidence={started_utc:new Date().toISOString(),scope:mixed?'Authored mixed Pascal/Lua ABI, allocator and virtual file probe; no DRL campaign':'Original Lua C interpreter ABI only; no DRL campaign/Pascal callback test'};
try{
  const port=await until(async()=>{try{return Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return false;}});
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});cdp=new CDP(socket);
  await cdp.call('Page.enable');await cdp.call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'+(mixed?'?mode=mixed':'')});
  const result=await until(async()=>{const error=await cdp.eval('window.luaProbeError');if(error)throw Error(error);return cdp.eval('window.luaProbe');});
  assert.equal(result.exit_code,0);assert.deepEqual(result.unsupported,{});
  if(mixed){assert.equal(result.output.callbacks,2);assert.equal(result.output.interleaved_pascal_c_allocations,true);assert.equal(result.output.stdio_file_io,true);assert.equal(result.output.packed_format,true);assert.equal(result.output.protected_callback_error,true);assert.equal(result.virtual_files[0].bytes,32768);}else {assert.equal(result.output.integer_bytes,8);assert.equal(result.output.debug_bytes,100);assert.equal(result.output.c_callbacks,2);assert.equal(result.output.protected_errors,true);}
  evidence.result='pass';evidence.probe=result;
}catch(error){evidence.result='fail';evidence.error=error.stack;process.exitCode=1;}
finally{evidence.finished_utc=new Date().toISOString();await fs.writeFile(path.join(root,mixed?'browser-mixed-evidence.json':'browser-evidence.json'),JSON.stringify(evidence,null,2));if(cdp)await cdp.call('Browser.close').catch(()=>{});socket?.close();for(let i=0;i<20&&chrome.exitCode===null;i++)await delay(100);if(chrome.exitCode===null)chrome.kill();await new Promise(resolve=>server.close(resolve));const checked=path.resolve(profile),temp=path.resolve(os.tmpdir())+path.sep;if(checked.startsWith(temp)&&path.basename(checked).startsWith('drl-lua-wasi-'))await fs.rm(checked,{recursive:true,force:true,maxRetries:8,retryDelay:200});}
console.log(JSON.stringify(evidence));
