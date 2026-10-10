import createLua from './lua-core.mjs';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const app=document.querySelector('#app'),status=document.querySelector('#status');
let exports,view,labels={};
const fieldNames=['attack','defense','damage','weapon_speed','speed_bonus','resist_all','resist_type','resist_cap','actor_speed'];
function message(id){status.textContent=labels[id]??id;}
function request(value){
  const bytes=encoder.encode(JSON.stringify(value));exports.tome_input_reset();
  for(const byte of bytes)exports.tome_input_byte(byte);exports.tome_request();
  const output=new Uint8Array(exports.tome_output_len());for(let i=0;i<output.length;i++)output[i]=exports.tome_output_byte(i);
  const response=JSON.parse(decoder.decode(output));if(response.view)show(response.view);
  if(response.error_id)message(response.error_id);else status.textContent='';return response;
}
function show(next){
  view=next;labels=view.labels;document.documentElement.lang=view.locale;document.title=labels['ui.title'];
  for(const element of document.querySelectorAll('[data-text]')){
    const id=element.dataset.text;if(!Object.hasOwn(labels,id))throw new Error('Missing semantic text ID: '+id);element.textContent=labels[id];
  }
  document.querySelector('#locale').value=view.locale;
  if(document.activeElement?.id!=='name')document.querySelector('#name').value=view.player_name;
  if(document.activeElement?.id!=='seed')document.querySelector('#seed').value=view.seed;
  const format=new Intl.NumberFormat(view.locale,{maximumFractionDigits:3});
  function list(id,pairs){const container=document.querySelector(id);container.replaceChildren();for(const [label,value]of pairs){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=labels[label];dd.textContent=typeof value==='number'?format.format(value):value;container.append(dt,dd);}}
  list('#formula',[['ui.hit_chance',view.formula.hit_chance],['ui.rescaled_damage',view.formula.rescaled_damage],['ui.combat_speed',view.formula.combat_speed],['ui.resistance',view.formula.resistance]]);
  list('#counters',[['ui.tick_count',view.tick],['ui.energy',view.energy.active],['ui.hits',view.hits],['ui.misses',view.misses]]);
  for(const key of fieldNames){const field=document.querySelector('#param-'+key);if(document.activeElement!==field)field.value=view.params[key];}
  const log=document.querySelector('#log');log.replaceChildren();for(const text of view.events){const li=document.createElement('li');li.textContent=text;log.append(li);}log.scrollTop=log.scrollHeight;
}
async function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('jrogue-tome-characterization',1);r.onupgradeneeded=()=>r.result.createObjectStore('saves');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function writeStorage(value){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(value,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
async function readStorage(){const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('saves').objectStore('saves').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
function command(command){return request({op:'command',command});}
async function boot(){
  labels=await (await fetch('ja.json')).json();message('ui.loading');
  const wasm=await WebAssembly.instantiateStreaming(fetch('tome_platform.wasm'),{});exports=wasm.instance.exports;
  const fields=document.querySelector('#fields');for(const key of fieldNames){const label=document.createElement('label'),span=document.createElement('span'),input=document.createElement('input');span.dataset.text='ui.'+key;input.id='param-'+key;input.name=key;input.type='number';input.step='any';input.required=true;label.append(span,input);fields.append(label);}
  request({op:'view'});app.setAttribute('aria-busy','false');
  // Execute retained original Lua methods under the original C interpreter.
  // This reference run is independent of the Rust sampling scaffold.
  let originalResult;
  await createLua({arguments:['/replay.lua'],print(line){if(line.startsWith('TOME_GOLDEN_JSON='))originalResult=JSON.parse(line.slice('TOME_GOLDEN_JSON='.length));},printErr(line){console.error(line);}});
  if(!originalResult)throw new Error('Original kernel produced no reference result');
  if(new URLSearchParams(location.search).has('test'))window.__tomeOriginal=originalResult;
  for(const action of ['strike','tick'])document.querySelector('#'+action).addEventListener('click',()=>request({op:'touch',action}));
  document.querySelector('#parameters').addEventListener('submit',event=>{event.preventDefault();const params={};for(const key of fieldNames)params[key]=Number(document.querySelector('#param-'+key).value);command({action:'configure',params});});
  document.querySelector('#apply-name').addEventListener('click',()=>command({action:'name',value:document.querySelector('#name').value}));
  document.querySelector('#reset').addEventListener('click',()=>command({action:'reset',seed:Number(document.querySelector('#seed').value)}));
  document.querySelector('#locale').addEventListener('change',event=>request({op:'locale',locale:event.target.value}));
  document.querySelector('#save').addEventListener('click',async()=>{try{const r=request({op:'save'});if(r.ok){await writeStorage(r.save);message('ui.saved');}}catch{message('error.storage');}});
  document.querySelector('#load').addEventListener('click',async()=>{try{const save=await readStorage();if(typeof save!=='string'){message('error.save.invalid');return;}const r=request({op:'load',save});if(r.ok)message('ui.loaded');}catch{message('error.storage');}});
  document.querySelector('#export').addEventListener('click',()=>{const r=request({op:'save'});if(!r.ok)return;const url=URL.createObjectURL(new Blob([r.save],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='tome-characterization-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  document.querySelector('#import').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>1048576){message('error.save.invalid');return;}const r=request({op:'load',save:await file.text()});if(r.ok)message('ui.loaded');}catch{message('error.storage');}finally{event.target.value='';}});
  window.addEventListener('keydown',event=>{
    const editable=event.target instanceof Element&&Boolean(event.target.closest('input,textarea,select,button,[contenteditable=true]'));
    const r=request({op:'key',input:{key:event.key,repeat:event.repeat,composing:event.isComposing,ctrl:event.ctrlKey,alt:event.altKey,meta:event.metaKey,editable}});
    if(r.handled)event.preventDefault();
  });
  if(new URLSearchParams(location.search).has('test'))window.__tomeTest={request,command,get view(){return view;},readStorage,writeStorage};
}
boot().catch(error=>{message('error.wasm');app.setAttribute('aria-busy','false');console.error(error);});
