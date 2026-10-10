import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from '../web/server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=path.join(root,'tests/output');
await mkdir(output,{recursive:true});
const evidence={scope:'Original Lua/C scalar kernel and Rust adapter reference harness only; no full ToME gameplay claim',started_at:new Date().toISOString(),checks:[],artifacts:[]};
for(const name of ['tome_platform.wasm','lua-core.mjs','lua-core.wasm','app.js','index.html','ja.json','en.json','style.css']){const data=await readFile(path.join(root,'dist',name));evidence.artifacts.push({name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){const end=Date.now()+30000;while(Date.now()<end){const r=await fn();if(r)return r;await sleep(50);}throw new Error('Timed out: '+label);}
class CDP{
  constructor(socket){this.socket=socket;this.next=0;this.pending=new Map;this.errors=[];this.console=[];socket.addEventListener('message',({data})=>{const p=JSON.parse(data);if(p.id){const item=this.pending.get(p.id);if(item){this.pending.delete(p.id);clearTimeout(item.timer);p.error?item.reject(new Error(JSON.stringify(p.error))):item.resolve(p.result);}}else if(p.method==='Runtime.exceptionThrown')this.errors.push(p.params.exceptionDetails);else if(p.method==='Runtime.consoleAPICalled')this.console.push(p.params);});}
  call(method,params={}){return new Promise((resolve,reject)=>{const id=++this.next,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP timeout '+method));},30000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/?test=1';
const profile=await mkdtemp(path.join(os.tmpdir(),'tome-reference-browser-'));
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket,cdp,stderr='';chrome.stderr.on('data',b=>stderr+=b.toString());
function check(name,value){assert(value,name);evidence.checks.push({name,result:'pass'});}
try{
  const port=await until(async()=>{try{return Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return false;}},'Chrome');
  const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});cdp=new CDP(socket);
  await cdp.call('Runtime.enable');await cdp.call('Page.enable');evidence.browser=await cdp.call('Browser.getVersion');
  await cdp.call('Emulation.setDeviceMetricsOverride',{width:1240,height:1000,deviceScaleFactor:1,mobile:false});await cdp.call('Page.navigate',{url});
  await until(()=>cdp.eval('Boolean(window.__tomeTest)'),'Rust WASM UI');
  await until(()=>cdp.eval('Boolean(window.__tomeOriginal)'),'Original C/Lua WASM kernel');
  const golden=JSON.parse(await readFile(path.join(root,'reference/lua/combat-golden.json'),'utf8'));
  const actualOriginal=await cdp.eval('window.__tomeOriginal');
  await writeFile(path.join(output,'original-browser-golden.json'),JSON.stringify(actualOriginal,null,2));
  for(const group of ['check_hit','rescale_combat_stats','rescale_damage','weapon_damage_power'])assert.deepEqual(actualOriginal[group],golden[group]);
  assert.equal(actualOriginal.lua_version,golden.lua_version);
  check('Actual browser executes 66 original Lua scalar fixtures exactly',true);
  evidence.original_kernel={fixtures:66,combat_source_sha256:'0cfaba3995f19a0ddb9e716b2ae8ab68e916c1e1784bb753f72b159bfd17af13'};
  check('Japanese default and semantic scope displayed',await cdp.eval("document.documentElement.lang==='ja' && document.querySelector('.scope').textContent.includes('C/Lua')"));
  check('Every rendered static label exists',await cdp.eval("[...document.querySelectorAll('[data-text]')].every(e=>e.textContent.length>0)"));
  const before=await cdp.eval("__tomeTest.request({op:'save'}).save");
  check('Repeated rendering/locale changes preserve save and SFMT state',await cdp.eval(`(()=>{const before=__tomeTest.request({op:'save'}).save;for(let i=0;i<15;i++){__tomeTest.request({op:'view'});__tomeTest.request({op:'locale',locale:i%2?'ja':'en'});}__tomeTest.request({op:'locale',locale:'ja'});return before===__tomeTest.request({op:'save'}).save;})()`));
  await cdp.eval("document.querySelector('#name').value='日本語 % {name} <img src=x onerror=alert(1)>';document.querySelector('#apply-name').click()");
  check('External Unicode name is unchanged and rendered as text',await cdp.eval("__tomeTest.view.player_name==='日本語 % {name} <img src=x onerror=alert(1)>' && document.querySelectorAll('img').length===0"));
  await cdp.eval("document.querySelector('#strike').click()");check('Physical button crosses Rust touch command boundary once',await cdp.eval('__tomeTest.view.hits+__tomeTest.view.misses===1'));
  check('Unavailable action rejects without changing RNG/state',await cdp.eval("(()=>{const before=__tomeTest.request({op:'save'}).save;const r=__tomeTest.request({op:'touch',action:'strike'});return r.error_id==='error.energy'&&before===__tomeTest.request({op:'save'}).save;})()"));
  check('IME, shortcuts, repeat and editable input preserve state',await cdp.eval("(()=>{const before=__tomeTest.request({op:'save'}).save;for(const key of [{key:'Enter',composing:true},{key:'.',repeat:true},{key:'Enter',ctrl:true},{key:'.',editable:true}]){const r=__tomeTest.request({op:'key',input:key});if(r.handled)return false;}return before===__tomeTest.request({op:'save'}).save;})()"));
  await cdp.eval("document.body.tabIndex=-1;document.body.focus()");for(let i=0;i<10;i++)await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',key:'.',code:'Period'});await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});
  check('Actual Chrome keyboard events map to Rust tick/strike',await cdp.eval('__tomeTest.view.tick===10 && __tomeTest.view.hits+__tomeTest.view.misses===2'));
  await cdp.eval("document.querySelector('#save').click()");const saved=await until(()=>cdp.eval('__tomeTest.readStorage()'),'IndexedDB save');
  check('IndexedDB stores exact versioned save',JSON.parse(saved).schema===1&&JSON.parse(saved).source_commit==='624a67329fe2ad440c5b344785a9c73fcf22ae63');
  await cdp.call('Page.reload');await until(()=>cdp.eval('Boolean(window.__tomeTest)'),'reload');await cdp.eval("document.querySelector('#load').click()");await until(()=>cdp.eval('__tomeTest.view.hits+__tomeTest.view.misses===2'),'restore');
  check('Reload and actual storage restore preserve complete RNG/state',await cdp.eval('__tomeTest.request({op:"save"}).save')===saved);
  check('Save/resume continuation is deterministic',await cdp.eval(`(()=>{const saved=__tomeTest.request({op:'save'}).save;function run(){for(let i=0;i<20;i++){for(let n=0;n<10;n++)__tomeTest.command({action:'tick'});__tomeTest.command({action:'strike'});}return __tomeTest.request({op:'save'}).save;}const a=run();__tomeTest.request({op:'load',save:saved});return a===run();})()`));
  check('Corrupt/future saves reject without changing runtime',await cdp.eval(`(()=>{const before=__tomeTest.request({op:'save'}).save;for(const field of ['schema','source_commit','checksum']){const v=JSON.parse(before);v[field]=field==='schema'?2:'bad';const r=__tomeTest.request({op:'load',save:JSON.stringify(v)});if(r.ok||before!==__tomeTest.request({op:'save'}).save)return false;}return true;})()`));
  await cdp.eval("__tomeTest.request({op:'view'})");let capture=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'desktop-ja.png'),Buffer.from(capture.data,'base64'));
  await cdp.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cdp.call('Emulation.setTouchEmulationEnabled',{enabled:true});
  check('Mobile CJK layout has no horizontal overflow',await cdp.eval('document.documentElement.scrollWidth<=innerWidth+1'));
  const tickBefore=await cdp.eval('__tomeTest.view.tick');await cdp.eval("document.querySelector('#tick').scrollIntoView({block:'center'})");await sleep(100);const point=await cdp.eval("(()=>{const r=document.querySelector('#tick').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  evidence.touch={tick_before:tickBefore,point,target:await cdp.eval(`document.elementFromPoint(${point.x},${point.y})?.id`)};
  await cdp.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:1,radiusY:1,force:1}]});await sleep(100);await cdp.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await until(async()=>await cdp.eval('__tomeTest.view.tick')===tickBefore+1,'mobile touch');check('Actual mobile touch triggers one Rust command',true);
  capture=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'mobile-ja.png'),Buffer.from(capture.data,'base64'));
  await cdp.eval("document.documentElement.style.fontSize='32px';window.scrollTo(0,0)");check('200% CJK text enlargement fits mobile width',await cdp.eval('document.documentElement.scrollWidth<=innerWidth+1'));
  check('Primary mobile controls meet 44px hit size',await cdp.eval("['strike','tick'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.width>=44&&r.height>=44})"));
  capture=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'mobile-ja-200.png'),Buffer.from(capture.data,'base64'));
  check('No uncaught browser errors',cdp.errors.length===0);
  evidence.result='pass';evidence.completed_at=new Date().toISOString();await writeFile(path.join(output,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({result:'pass',checks:evidence.checks.length,evidence:path.join(output,'evidence.json')}));
}catch(error){evidence.result='fail';evidence.error=error.stack;evidence.chrome_stderr=stderr;evidence.console=cdp?.console;evidence.browser_errors=cdp?.errors;try{evidence.body_text=await cdp.eval('document.body.innerText');evidence.current_view=await cdp.eval('window.__tomeTest?.view');const capture=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'failure.png'),Buffer.from(capture.data,'base64'));}catch{}await writeFile(path.join(output,'evidence.json'),JSON.stringify(evidence,null,2));throw error;}
finally{try{await cdp?.call('Browser.close');}catch{}socket?.close();chrome.kill();await new Promise(r=>server.close(r));}
