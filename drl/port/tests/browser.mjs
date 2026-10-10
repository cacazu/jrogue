import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFile,writeFile,mkdir,mkdtemp,rm} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {createServer} from "../web/server.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const output=path.join(root,"tests","output");
await mkdir(output,{recursive:true});
const profile=await mkdtemp(path.join(os.tmpdir(),"drl-browser-verification-"));
const server=createServer();
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base="http://127.0.0.1:"+server.address().port+"/";
const chrome=spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",["--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--disable-background-networking","--disable-component-update","--remote-debugging-port=0","--user-data-dir="+profile,"about:blank"],{windowsHide:true,stdio:["ignore","ignore","pipe"]});
let errors="",socket,cdp;
chrome.stderr.on("data",data=>errors+=data.toString());
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(callback,label){for(let i=0;i<300;i++){const value=await callback();if(value)return value;await delay(100);}throw new Error("timeout: "+label+" "+errors.slice(-800));}
class CDP{
  constructor(socket){this.socket=socket;this.pending=new Map();this.id=0;socket.addEventListener("message",event=>{const packet=JSON.parse(event.data);if(packet.id){const entry=this.pending.get(packet.id);if(entry){this.pending.delete(packet.id);clearTimeout(entry.timer);packet.error?entry.reject(new Error(JSON.stringify(packet.error))):entry.resolve(packet.result);}}});}
  call(method,params={}){return new Promise((resolve,reject)=>{const id=++this.id;const timer=setTimeout(()=>reject(new Error("CDP timeout: "+method)),30000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  async evaluate(expression){const value=await this.call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw new Error(JSON.stringify(value.exceptionDetails));return value.result.value;}
}
const evidence={scope:"real Chrome PC/mobile migration verification; NOT full DRL gameplay",started_at:new Date().toISOString(),checks:[],source_commit:"a6f965072b3a25b768c91dbced00367f1b57d865"};
try{
  const response=await fetch(base);assert.equal(response.status,200);assert.match(await response.text(),/DRL/);
  const port=await until(async()=>{try{return Number((await readFile(path.join(profile,"DevToolsActivePort"),"utf8")).split("\n")[0]);}catch{return false;}},"Chrome debugger");
  const pages=await(await fetch("http://127.0.0.1:"+port+"/json/list")).json();
  socket=new WebSocket(pages.find(page=>page.type==="page").webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true});});
  cdp=new CDP(socket);
  await cdp.call("Page.enable");await cdp.call("Runtime.enable");
  await cdp.call("Page.addScriptToEvaluateOnNewDocument",{source:"window.__drlBootErrors=[];addEventListener('error',event=>__drlBootErrors.push(String(event.error||event.message)));addEventListener('unhandledrejection',event=>__drlBootErrors.push(String(event.reason)));"});
  await cdp.call("Emulation.setDeviceMetricsOverride",{width:1280,height:960,deviceScaleFactor:1,mobile:false});
  const navigation=await cdp.call("Page.navigate",{url:base});
  if(navigation.errorText)throw new Error("Browser navigation: "+JSON.stringify(navigation));
  await until(async()=>{const state=await cdp.evaluate("({ready:Boolean(window.__drlVerification),errors:window.__drlBootErrors,body:document.body?.textContent?.slice(0,250),url:location.href})");evidence.last_browser_state=state;if(state.errors?.length)throw new Error("Browser startup: "+JSON.stringify(state));return state.ready;},"Rust Wasm loaded");
  assert.equal(await cdp.evaluate("document.documentElement.lang"),"ja");
  assert.match(await cdp.evaluate("document.querySelector('h1').textContent"),/移植検証/);
  evidence.checks.push("Japanese default and explicit incomplete-campaign scope");
  await cdp.evaluate("document.querySelector('#draw').click()");
  assert.equal(await cdp.evaluate("__drlVerification.checkpoint().last_value"),3499211612);
  evidence.checks.push("Real browser executes compiled Rust MT19937 canonical seed5489 value");
  const state=await cdp.evaluate("__drlVerification.checkpoint()");
  await cdp.evaluate("for(let i=0;i<50;i++)__drlVerification.redraw();document.querySelector('#language').value='en';document.querySelector('#language').dispatchEvent(new Event('change'));document.querySelector('#language').value='ja';document.querySelector('#language').dispatchEvent(new Event('change'))");
  assert.deepEqual(await cdp.evaluate("__drlVerification.checkpoint()"),state);
  evidence.checks.push("50 Canvas redraws and EN/JA changes preserve full MT state and probe checkpoint");
  await cdp.evaluate("__drlVerification.keyboard({key:'ArrowLeft',code:'ArrowLeft',isComposing:true,target:document.querySelector('#surface')});__drlVerification.keyboard({key:'ArrowLeft',code:'ArrowLeft',target:document.querySelector('#seed')})");
  assert.equal(await cdp.evaluate("__drlVerification.checkpoint().last_input_id"),null);
  await cdp.evaluate("document.querySelector('#surface').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',code:'ArrowUp',bubbles:true}))");
  assert.equal(await cdp.evaluate("__drlVerification.checkpoint().last_input_id"),"input_walkup");
  assert.deepEqual(await cdp.evaluate("__drlVerification.checkpoint().rng"),state.rng);
  evidence.checks.push("Keyboard semantic direction, IME and editable focus guard without gameplay RNG consumption");
  const savedState=await cdp.evaluate("__drlVerification.checkpoint()");
  await cdp.evaluate("__drlVerification.save()");
  await cdp.evaluate("document.querySelector('#draw').click()");
  const future=await cdp.evaluate("__drlVerification.checkpoint().last_value");
  await cdp.call("Page.reload",{ignoreCache:true});
  await until(()=>cdp.evaluate("Boolean(window.__drlVerification)"),"new Wasm instance after reload");
  await cdp.evaluate("__drlVerification.resume()");
  assert.deepEqual(await cdp.evaluate("__drlVerification.checkpoint()"),savedState);
  await cdp.evaluate("document.querySelector('#draw').click()");
  assert.equal(await cdp.evaluate("__drlVerification.checkpoint().last_value"),future);
  evidence.checks.push("IndexedDB committed checkpoint restores in a fresh Wasm instance and preserves next value");
  const invalid=await cdp.evaluate("(()=>{const before=JSON.stringify(__drlVerification.checkpoint());try{__drlVerification.request({kind:'load',envelope:'{}'});return false;}catch{return before===JSON.stringify(__drlVerification.checkpoint());}})()");
  assert.equal(invalid,true);
  evidence.checks.push("Malformed checkpoint fails atomically");
  const pc=await cdp.call("Page.captureScreenshot",{format:"png"});
  await writeFile(path.join(output,"pc.png"),Buffer.from(pc.data,"base64"));
  await cdp.call("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await cdp.call("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
  const point=await cdp.evaluate("(()=>{const r=document.querySelector('[data-key=ArrowLeft]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  await cdp.call("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[point]});
  await cdp.call("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await until(()=>cdp.evaluate("__drlVerification.checkpoint().last_input_id==='input_walkleft'"),"mobile touch button");
  assert.equal(await cdp.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
  const mobile=await cdp.call("Page.captureScreenshot",{format:"png"});
  await writeFile(path.join(output,"mobile.png"),Buffer.from(mobile.data,"base64"));
  await cdp.evaluate("document.documentElement.style.fontSize='32px'");
  assert.equal(await cdp.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
  evidence.checks.push("Actual mobile touch input, Japanese CJK layout, no horizontal overflow at390px and200% font size");
  const wasm=await readFile(path.join(root,"dist","drl_web_port.wasm"));
  evidence.wasm={bytes:wasm.length,sha256:createHash("sha256").update(wasm).digest("hex")};
  evidence.result="pass";
}catch(error){evidence.result="fail";evidence.error=error.stack;process.exitCode=1;}
finally{
  evidence.finished_at=new Date().toISOString();await writeFile(path.join(output,"browser-evidence.json"),JSON.stringify(evidence,null,2));
  if(cdp)await cdp.call("Browser.close").catch(()=>{});
  socket?.close();
  for(let i=0;i<20&&chrome.exitCode===null;i++)await delay(100);
  if(chrome.exitCode===null)chrome.kill();
  await new Promise(resolve=>server.close(resolve));
  await delay(300);
  const checked=path.resolve(profile),temp=path.resolve(os.tmpdir())+path.sep;
  if(checked.startsWith(temp)&&path.basename(checked).startsWith("drl-browser-verification-"))await rm(checked,{recursive:true,force:true,maxRetries:8,retryDelay:200}).catch(error=>{evidence.temp_cleanup=error.code;});
  await writeFile(path.join(output,"browser-evidence.json"),JSON.stringify(evidence,null,2));
}
console.log(JSON.stringify({result:evidence.result,checks:evidence.checks.length,scope:evidence.scope,error:evidence.error}));
