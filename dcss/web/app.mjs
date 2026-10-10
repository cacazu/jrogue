import { SemanticLog } from './semantic-log.mjs';
import { selectAppMode, coreResumeURL } from './default-route.mjs';
const appMode = selectAppMode(location.href);
document.body.dataset.mode = appMode;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const languageElement=document.querySelector('#language');
let language='ja',session=null,lastResponse=null,shownResponse=null,labels={},engine=null,coreFrame=null,lastError=null,characterRecords=[];
const boundary=(await WebAssembly.instantiateStreaming(fetch('/build/boundary.wasm'),{})).instance.exports;
function call(command){
  const bytes=encoder.encode(JSON.stringify({language,...command}));
  const input=boundary.dcss_allocate(bytes.length);
  if(!input)throw new Error('allocation failed');
  let output=0,length=0;
  try{
    new Uint8Array(boundary.memory.buffer,input,bytes.length).set(bytes);
    const packet=boundary.dcss_request(input,bytes.length);
    output=Number(packet&0xffffffffn);length=Number(packet>>32n);
    if(!output||!length)throw new Error('boundary request failed');
    const response=JSON.parse(decoder.decode(new Uint8Array(boundary.memory.buffer,output,length)));
    lastResponse=response;
    if(!response.ok){lastError=response.value;throw new Error(response.value.error);}
    if(response.session)session=response.session;
    return response;
  }finally{
    boundary.dcss_release(input,bytes.length);
    if(output&&length)boundary.dcss_release(output,length);
  }
}
function text(id,params={}){return call({op:'text',message:{id,params}}).text[0];}
const semanticLog = new SemanticLog(call);
let semanticErrors = 0;
let coreCompleted = false;
window.addEventListener('dcss-core-completed', () => {
  coreCompleted = true;
  for (const control of document.querySelectorAll('#core-panel [data-key], #core-save')) control.disabled = true;
  document.querySelector('#status').textContent = labels['status.game_ended'];
});
function renderCoreMessages(prepared = null) {
  const panel = document.querySelector('#semantic-panel');
  const entries = prepared ?? semanticLog.render();
  const list = document.querySelector('#semantic-messages');
  if (!entries.length) { list.replaceChildren(); panel.hidden = true; return; }
  const retained = new Set(entries.map(entry => entry.session + ':' + entry.event.sequence));
  const nodes = new Map(Array.from(list.children, node => [node.dataset.identity, node]));
  for (const [sequence, node] of nodes) if (!retained.has(sequence)) node.remove();
  for (const { session: hostSession, event, text } of entries) {
    const identity = hostSession + ':' + event.sequence;
    const line = nodes.get(identity) || document.createElement('li');
    if (line.textContent !== text) line.textContent = text;
    line.dataset.identity = identity;
    line.dataset.session = hostSession;
    line.dataset.sequence = event.sequence;
    line.dataset.channel = String(event.channel);
    if (event.channel === 6) line.dataset.urgency = 'warning';
    if (event.shout) line.dataset.emphasis = 'shout';
    if (line.parentElement !== list) list.append(line);
  }
  document.querySelector('#semantic-heading').textContent = labels['adapter.semantic_messages'];
  panel.hidden = false;
}
function acceptCoreMessage(event) {
  const latest = semanticLog.append(event);
  renderCoreMessages();
  // Announce only the newly accepted event; locale redraws retain quiet history.
  document.querySelector('#semantic-announcer').replaceChildren(document.createTextNode(latest.text));
}
function restoreCoreHistory(checkpoint) {
  const prepared = semanticLog.restore(checkpoint);
  // These are fresh host diagnostics, not restored native engine counters.
  semanticErrors = 0;
  document.querySelector('#semantic-announcer').replaceChildren();
  renderCoreMessages(prepared);
}
function rejectCoreMessage(reason) {
  semanticErrors++;
  lastError = { message: String(reason), source: 'semantic' };
  console.error('[DCSS semantic]', String(reason));
  document.querySelector('#status').textContent = labels['error.semantic_unavailable'] || labels['error.operation_failed'];
}
function redrawLabels(){
  labels=call({op:'catalog'}).value;
  document.documentElement.lang=language;
  for(const element of document.querySelectorAll('[data-text]')){
    const id=element.dataset.text;
    if(!(id in labels))throw new Error('missing UI ID: '+id);
    element.textContent=labels[id];
  }
  for(const element of document.querySelectorAll('[data-aria-label]')){
    const id=element.dataset.ariaLabel;
    if(!(id in labels))throw new Error('missing accessible UI ID: '+id);
    element.setAttribute('aria-label',labels[id]);
  }
  document.title=labels['app.title'];
  document.querySelector('#dice-label').textContent=text('dice.parameters',{count:Number(document.querySelector('#count').value),sides:Number(document.querySelector('#sides').value)});
  for(const kind of ['species','job']){
    const select=document.querySelector('#'+kind),selected=select.value||({species:'Hu',job:'Fi'})[kind];
    select.replaceChildren();
    for(const record of characterRecords.filter(record=>record.kind===kind&&record.status==='current_start')){
      const option=document.createElement('option');option.value=record.abbrev;option.textContent=labels[record.name_id];select.append(option);
    }
    select.value=selected;
  }
  if(shownResponse)document.querySelector('#status').textContent=shownResponse.messages.map(message=>call({op:'text',message}).text[0]).join(' ');
  document.querySelector('.scope').textContent=labels[appMode==='reference'?'scope.verification_only':engine?'scope.debug_engine':'scope.complete_port_unavailable'];
  if(coreCompleted)document.querySelector('#status').textContent=labels['status.game_ended'];
  renderCoreMessages();
}
function show(response){
  shownResponse=structuredClone(response);
  document.querySelector('#status').textContent=response.text.join(' ');
  document.querySelector('#result').textContent=JSON.stringify(response.value,null,2);
}
function act(callback){try{callback();}catch(error){document.querySelector('#status').textContent=labels['error.operation_failed'];lastError={message:error.message};}}
function seed(){show(call({op:'seed',seed:document.querySelector('#seed').value,player:document.querySelector('#player').value}));}
document.querySelector('#start').addEventListener('click',()=>act(seed));
document.querySelector('#sample').addEventListener('click',()=>act(()=>show(call({op:'sample',session}))));
document.querySelector('#roll').addEventListener('click',()=>act(()=>show(call({op:'dice',session,count:Number(document.querySelector('#count').value),sides:Number(document.querySelector('#sides').value)}))));
document.querySelector('#save').addEventListener('click',()=>act(()=>{
  const response=call({op:'save',session});
  localStorage.setItem('dcss.migration-verification.v1',response.value.save);
  show(response);
}));
document.querySelector('#load').addEventListener('click',()=>act(()=>{
  const save=localStorage.getItem('dcss.migration-verification.v1');
  if(!save){document.querySelector('#status').textContent=labels['error.missing_save'];return;}
  show(call({op:'load',save}));
}));
document.querySelector('#export').addEventListener('click',()=>act(()=>{
  const save=call({op:'save',session}).value.save;
  const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([save],{type:'application/json'}));link.download='dcss-migration-verification-v1.json';link.click();URL.revokeObjectURL(link.href);
}));
document.querySelector('#import').addEventListener('change',async(event)=>{
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>16*1024*1024){document.querySelector('#status').textContent=labels['error.invalid_save'];return;}
  const save=await file.text();act(()=>show(call({op:'load',save})));event.target.value='';
});
languageElement.addEventListener('change',()=>act(()=>{language=languageElement.value;redrawLabels();}));
document.querySelector('#help').addEventListener('click',()=>{document.querySelector('#help-panel').open=!document.querySelector('#help-panel').open;});
for(const element of document.querySelectorAll('#count,#sides'))element.addEventListener('change',()=>act(redrawLabels));
function key(event){
  return call({op:'key',key:event.key,modifiers:{shift:event.shiftKey||false,ctrl:event.ctrlKey||false,alt:event.altKey||false,meta:event.metaKey||false,composing:event.isComposing||false},text_mode:false}).value;
}
document.querySelector('#console').addEventListener('keydown',(event)=>{
  const action=key(event);
  if(action.kind==='key'&&engine?.dcssQueueKey){event.preventDefault();engine.dcssQueueKey(action.value);}
});
document.querySelector('#console').addEventListener('click',event=>{
  if(!coreFrame||!engine?.dcssQueueKey)return;
  const bounds=event.currentTarget.getBoundingClientRect();
  const column=Math.floor((event.clientX-bounds.left)*event.currentTarget.width/bounds.width/10),row=Math.floor((event.clientY-bounds.top)*event.currentTarget.height/bounds.height/20);
  const point=call({op:'mouse',column,row,button:1,columns:coreFrame.columns,rows:coreFrame.rows}).value;
  const player=coreFrame.cells.findIndex(cell=>cell.glyph===64);
  if(!point||player<0)return;
  const dx=point.column-player%coreFrame.columns,dy=point.row-Math.floor(player/coreFrame.columns);
  const keys={'-1,-1':'y','0,-1':'k','1,-1':'u','-1,0':'h','0,0':'.','1,0':'l','-1,1':'b','0,1':'j','1,1':'n'};
  const selected=keys[`${dx},${dy}`];if(selected){const action=key({key:selected});if(action.kind==='key')engine.dcssQueueKey(action.value);}
});
document.querySelector('#core-save').addEventListener('click',async()=>{try{await window.__dcssCore.save();if(!coreCompleted)document.querySelector('#status').textContent=labels['status.native_saved'];}catch(error){if(coreCompleted)return;lastError={message:String(error)};document.querySelector('#status').textContent=labels['error.save_failed'];}});
document.querySelector('#core-load').addEventListener('click',()=>{location.href=coreResumeURL(location.href);});
for(const button of document.querySelectorAll('[data-key]'))button.addEventListener('click',()=>{
  const action=key({key:button.dataset.key});
  if(action.kind==='key'&&engine?.dcssQueueKey)engine.dcssQueueKey(action.value);
});
const colors=['#000000','#0000aa','#00aa00','#00aaaa','#aa0000','#aa00aa','#aa5500','#aaaaaa','#555555','#5555ff','#55ff55','#55ffff','#ff5555','#ff55ff','#ffff55','#ffffff'];
function renderCoreFrame(frame){
  const response=call({op:'frame',frame});coreFrame=response.value.frame;
  const canvas=document.querySelector('#console'),context=canvas.getContext('2d');
  canvas.width=frame.columns*10;canvas.height=frame.rows*20;context.font='16px Consolas,monospace';context.textBaseline='top';
  coreFrame.cells.forEach((cell,index)=>{
    const x=(index%frame.columns)*10,y=Math.floor(index/frame.columns)*20;
    context.fillStyle=colors[cell.background];context.fillRect(x,y,10,20);
  });
  coreFrame.cells.forEach((cell,index)=>{
    if(cell.glyph===0)return;
    const x=(index%frame.columns)*10,y=Math.floor(index/frame.columns)*20;
    context.fillStyle=colors[cell.foreground];context.fillText(cell.text??String.fromCodePoint(cell.glyph),x,y);
  });
  const player=coreFrame.cells.findIndex(cell=>cell.glyph===64),viewport=canvas.parentElement;
  if(player>=0){viewport.scrollLeft=Math.max(0,(player%frame.columns+.5)*10-viewport.clientWidth/2);viewport.scrollTop=Math.max(0,(Math.floor(player/frame.columns)+.5)*20-viewport.clientHeight/2);}
}
const names=await(await fetch('/locales/entities/source-map.json')).json();
if(names.commit!=='1eebc1a2892e1c89776a0d7a10691f8dac8d9796')throw new Error('entity source mismatch');
characterRecords=names.records;
await redrawLabels();if(appMode==='reference')seed();
const coreOptions=new URL(location.href).searchParams;
if(appMode==='core'){
  for(const kind of ['species','job']){
    const selected=coreOptions.get(kind);
    if(selected&&characterRecords.some(record=>record.kind===kind&&record.status==='current_start'&&record.abbrev===selected))document.querySelector('#'+kind).value=selected;
  }
  const seedOption=coreOptions.get('seed');
  if(seedOption&&/^[0-9]+$/.test(seedOption))document.querySelector('#seed').value=seedOption;
}
// Developer-only harness used by browser verification. No simulated dungeon.
window.__dcssVerification={get mode(){return appMode;},call,renderCoreFrame,acceptCoreMessage,rejectCoreMessage,restoreCoreHistory,semanticCheckpoint:()=>semanticLog.checkpoint(),get semanticHistory(){return semanticLog.history();},get semanticSession(){return semanticLog.session;},get semanticMessages(){return semanticLog.snapshot();},get semanticErrors(){return semanticErrors;},key,redrawLabels,get session(){return session;},get response(){return lastResponse;},get language(){return language;},get error(){return lastError;},get frame(){return coreFrame;},setEngine(value){engine=value;document.body.dataset.mode='core';document.querySelector('#core-panel').hidden=false;document.querySelector('#character-settings').hidden=false;for(const id of ['species','job'])document.querySelector('#'+id).disabled=true;document.querySelector('.scope').textContent=text('scope.debug_engine');}};
if(appMode==='core'){
  try{await(await import('/web/core-debug.mjs')).startCore(window.__dcssVerification);}
  catch(error){lastError={message:String(error)};document.querySelector('#status').textContent=labels[error?.code==='jspi-unsupported'?'error.jspi_unavailable':'error.engine_unavailable'];}
}
