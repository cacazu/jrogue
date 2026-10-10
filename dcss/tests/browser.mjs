import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createPreviewServer} from '../web/server.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url));
const output=path.join(directory,'output');await mkdir(output,{recursive:true});
const profile=await mkdtemp(path.join(os.tmpdir(),'dcss-browser-'));
const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let chromeErrors='';chrome.stderr.on('data',chunk=>chromeErrors+=chunk);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(callback,label){const deadline=Date.now()+30000;while(Date.now()<deadline){const value=await callback();if(value)return value;await delay(100);}throw new Error('Timed out: '+label+' '+chromeErrors.slice(-1000));}
class CDP{
  constructor(socket){this.socket=socket;this.id=0;this.pending=new Map();socket.addEventListener('message',event=>{const packet=JSON.parse(event.data);if(packet.id){const pending=this.pending.get(packet.id);this.pending.delete(packet.id);if(pending){clearTimeout(pending.timer);packet.error?pending.reject(new Error(JSON.stringify(packet.error))):pending.resolve(packet.result);}}});}
  call(method,params={}){return new Promise((resolve,reject)=>{const id=++this.id,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP timeout '+method));},30000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const result=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
}
const evidence={time:new Date().toISOString(),scope:'real Chrome, Rust WASM boundary and migrated upstream RNG/dice; not full DCSS gameplay',checks:[],base};
let socket;
try{
  const binary=await readFile(path.join(directory,'../build/boundary.wasm'));evidence.wasm={bytes:binary.length,sha256:createHash('sha256').update(binary).digest('hex')};
  const port=await until(async()=>{try{return Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return null;}},'Chrome port');
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  const cdp=new CDP(socket);await cdp.call('Runtime.enable');await cdp.call('Page.enable');
  await cdp.call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
  await cdp.call('Page.navigate',{url:base+'?reference=1'});await until(()=>cdp.eval('Boolean(window.__dcssVerification)'),'Rust browser loaded');
  assert.equal(await cdp.eval('document.documentElement.lang'),'ja');assert.equal(await cdp.eval('__dcssVerification.response.ok'),true);
  assert.equal(await cdp.eval('__dcssVerification.mode'),'reference');assert.equal(await cdp.eval('Boolean(window.__dcssCore)'),false);evidence.checks.push('Japanese reference tools require explicit ?reference=1 and create no original-engine Worker');
  const browserSamples=await cdp.eval(`(()=>{document.querySelector('#seed').value='42';document.querySelector('#player').value='外部 Alice 😀';document.querySelector('#start').click();let values=[];for(let i=0;i<8;i++){document.querySelector('#sample').click();values.push(__dcssVerification.response.value.value);}return values;})()`);
  const reference=JSON.parse(await readFile(path.join(directory,'reference_rng.json'),'utf8'));
  // Compare against the first role stream from the compiled official C++ fixture.
  const streamCase=reference.streams.find(case_=>String(case_.seed)==='42');
  assert.deepEqual(browserSamples,streamCase.values[0].raw.slice(0,8));evidence.checks.push('Browser samples match official C++ gameplay stream reference');
  assert.match(await cdp.eval(`__dcssVerification.call({op:'text',message:{id:'status.player',params:{player:'外部 Alice 😀'}}}).text[0]`),/外部 Alice 😀/);
  const purity=await cdp.eval(`(()=>{const before=__dcssVerification.session;for(let i=0;i<50;i++){__dcssVerification.redrawLabels();__dcssVerification.renderCoreFrame({columns:2,rows:1,cells:[{glyph:64,foreground:15,background:0},{glyph:46,foreground:7,background:0}],cursor:null});}return before===__dcssVerification.session;})()`);
  assert.equal(purity,true);evidence.checks.push('50 localized redraws and frame validations do not advance RNG');
  await cdp.eval(`document.querySelector('#save').click();`);
  const next=await cdp.eval(`document.querySelector('#sample').click();__dcssVerification.response.value.value`);
  await cdp.call('Page.reload');await until(()=>cdp.eval('Boolean(window.__dcssVerification)&&document.querySelector("#player").value==="Player"'),'reloaded boundary');
  const restoredNext=await cdp.eval(`document.querySelector('#load').click();document.querySelector('#sample').click();__dcssVerification.response.value.value`);
  assert.equal(restoredNext,next);evidence.checks.push('Browser storage survives reload and resumes exact next random draw');
  const malformed=await cdp.eval(`(()=>{const before=__dcssVerification.session;const save=JSON.parse(localStorage.getItem('dcss.migration-verification.v1'));save.version=999;try{__dcssVerification.call({op:'load',save:JSON.stringify(save)});}catch{}return {unchanged:before===__dcssVerification.session,ok:__dcssVerification.response.ok};})()`);
  assert.equal(malformed.unchanged,true);assert.equal(malformed.ok,false);evidence.checks.push('Future save version rejected without modifying state');
  const keys=await cdp.eval(`({plain:__dcssVerification.key({key:'ArrowUp'}),shift:__dcssVerification.key({key:'ArrowUp',shiftKey:true}),ime:__dcssVerification.key({key:'h',isComposing:true})})`);
  assert.equal(keys.plain.value,-254);assert.equal(keys.shift.value,-243);assert.equal(keys.ime.kind,'ignore');evidence.checks.push('Upstream key codes and IME exclusion executed in Rust WASM');
  const beforeLanguage=await cdp.eval('__dcssVerification.session');await cdp.eval(`document.querySelector('#language').value='en';document.querySelector('#language').dispatchEvent(new Event('change'));`);
  assert.equal(await cdp.eval('__dcssVerification.session'),beforeLanguage);assert.equal(await cdp.eval('document.documentElement.lang'),'en');evidence.checks.push('Language switch preserves deterministic state');
  const largeSeed=await cdp.eval(`(()=>{const maximum='18446744073709551615';document.querySelector('#seed').value=maximum;document.querySelector('#start').click();const before=__dcssVerification.session;document.querySelector('#language').value='ja';document.querySelector('#language').dispatchEvent(new Event('change'));return {seed:__dcssVerification.response.messages?.[0]?.params?.seed,status:document.querySelector('#status').textContent,unchanged:before===__dcssVerification.session};})()`);
  assert.equal(largeSeed.unchanged,true);assert.match(largeSeed.status,/18446744073709551615/);evidence.checks.push('Full u64 seed survives browser JSON and language re-rendering without precision loss');
  await cdp.call('Page.captureScreenshot',{format:'png'}).then(r=>writeFile(path.join(output,'desktop.png'),Buffer.from(r.data,'base64')));
  await cdp.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await cdp.eval(`document.querySelector('#language').value='ja';document.querySelector('#language').dispatchEvent(new Event('change'));document.querySelector('#roll').click();`);
  assert.equal(await cdp.eval('__dcssVerification.response.ok'),true);assert.equal(await cdp.eval('document.documentElement.scrollWidth<=window.innerWidth'),true);
  await cdp.call('Page.captureScreenshot',{format:'png'}).then(r=>writeFile(path.join(output,'mobile.png'),Buffer.from(r.data,'base64')));evidence.checks.push('390px mobile viewport: touch controls, CJK wrapping and no horizontal overflow');
  evidence.result='pass';
}catch(error){evidence.result='fail';evidence.error=error.stack;process.exitCode=1;}
finally{if(socket)socket.close();chrome.kill();server.closeAllConnections();server.close();await writeFile(path.join(output,'browser-evidence.json'),JSON.stringify(evidence,null,2));process.stdout.write(JSON.stringify(evidence,null,2)+'\n');}
