// Real production Worker/native UI fixture. Only the parent runs the browser.
import assert from 'node:assert/strict';
import {STARTUP_TEXT_PIN,expectedNativeDisplayText} from '../web/startup-text.mjs';
import {nativeFrameRows,classifyStartingWeaponMenu} from './controlled-gameplay-browser.mjs';
const commit=STARTUP_TEXT_PIN.upstream;
const entity=(domain,id)=>({kind:'entity_label',version:1,upstream:commit,domain,id,form:'name'});
const species=entity('species','species.sp_human.name'),job=entity('job','job.job_fighter.name');
const labels=Object.fromEntries(['en','ja'].map(language=>[language,Object.fromEntries(Object.entries(STARTUP_TEXT_PIN.messages).map(([id,message])=>[id,message[language]]))]));
const prompts={en:STARTUP_TEXT_PIN.en,ja:STARTUP_TEXT_PIN.ja};
const evaluate=(cdp,fn,...args)=>cdp.eval('('+fn.toString()+')('+args.map(value=>JSON.stringify(value)).join(',')+')');
const escaped=text=>text.replace(/[.*+?^\x24{}()|[\]\\]/g,'\\$&');
export function nativeMenuEntityHotkey(rows,label){
  const pattern=new RegExp('(?:^|\\s)([a-zA-Z]) - '+escaped(label)+'(?=\\s|$)');
  const found=rows.flatMap((row,index)=>{const match=pattern.exec(row);return match?[{key:match[1],row:index,label,text:row}]:[];});
  assert.equal(found.length,1,'source-bound native entity row must expose exactly one actual hotkey');return found[0];
}
export function isNativeInitialStartupMenu(rows){
  const text=rows.join(' ');
  return text.includes('Enter your name:')&&text.includes('Choices:')
    &&text.includes('Dungeon Crawl')&&text.includes('Choose Game Seed');
}
export function nativeCjkLabelCells(frame,text){
  const characters=Array.from(text),widths=characters.map(character=>character.codePointAt(0)>=0x3000?2:1);
  for(let start=0;start<frame.cells.length;start++){
    let position=start,ok=true;const result=[];
    for(let index=0;index<characters.length;index++){
      const glyph=characters[index].codePointAt(0),width=widths[index];
      if(frame.cells[position]?.glyph!==glyph||(width===2&&frame.cells[position+1]?.glyph!==0)){ok=false;break;}
      result.push({character:characters[index],cell:position,glyph,continuation:width===2?frame.cells[position+1].glyph:null});position+=width;
    }
    if(ok&&Math.floor(start/frame.columns)===Math.floor((position-1)/frame.columns))return result;
  }
  assert.fail('localized native label must retain CJK leading/continuation cells in one row');
}
async function physical(cdp,key,extra={}){
  const letter=/^[A-Za-z]$/.test(key),code=key==='Enter'?'Enter':key==='Escape'?'Escape':key===' '?'Space':key==='.'?'Period':letter?'Key'+key.toUpperCase():key;
  await cdp.eval('document.querySelector("#console").focus()');
  const input={key,code,modifiers:letter&&key===key.toUpperCase()?8:0,...extra};
  await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',...input});await cdp.call('Input.dispatchKeyEvent',{type:'keyUp',...input});
}
async function setup(cdp,language,args){
  return evaluate(cdp,async function(language,args){
    if(__dcssVerification.mode!=='reference'||window.__dcssCore)throw Error('requires explicit reference page with no default engine');
    const worker=new Worker('/web/core-worker.js'),pending=new Map();let sequence=0,waiting=false,frames=0,error=null,completed=false;
    const request=(op,extra={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({type:'request',id,op,...extra});});
    worker.onmessage=event=>{
      const data=event.data;
      if(data.type==='response'){const entry=pending.get(data.id);if(!entry)return;pending.delete(data.id);data.ok?entry.resolve(data.value):entry.reject(Error(data.error));}
      else if(data.type==='waiting')waiting=data.value;
      else if(data.type==='frame'){
        const words=new Uint32Array(data.buffer),cells=[];
        for(let index=0;index<words.length;index+=3)cells.push({glyph:words[index],foreground:words[index+1]&15,background:words[index+2]&15});
        const seen=new Set();
        for(const cluster of data.clusters??[]){
          if(!Number.isInteger(cluster.cell)||cluster.cell<0||cluster.cell>=cells.length||typeof cluster.text!=='string'||seen.has(cluster.cell))
            throw Error('invalid native text cluster');
          seen.add(cluster.cell);cells[cluster.cell].text=cluster.text;
        }
        const {columns,rows,x,y,cursor}=data;
        __dcssVerification.renderCoreFrame({columns,rows,cells,cursor:cursor&&x>=0&&y>=0&&x<columns&&y<rows?[x,y]:null});frames++;
      }
      else if(data.type==='completed'){completed=true;waiting=false;}
      else if(data.type==='fatal'||data.type==='startup-text-error'){error=data.error;for(const entry of pending.values())entry.reject(Error(error));pending.clear();}
      else if(data.type==='semantic')__dcssVerification.acceptCoreMessage(data.event);
    };
    worker.onerror=event=>{error=event.message;};
    window.__dcssDynamicCore={get waiting(){return waiting},get frames(){return frames},get error(){return error},get completed(){return completed},
      state:()=>request('state'),async save(){
        const files=await request('save'),save=__dcssVerification.call({op:'pack_native',files}).value.save;
        const {put}=await import('/web/storage.mjs');await put('dcss.native.startup-v2.fixture',save);return save;
      },finish(){if(!completed)throw Error('cleanup requires actual native completion');worker.terminate();}};
    __dcssVerification.setEngine({dcssQueueKey:key=>{waiting=false;worker.postMessage({type:'key',key});}});
    const lifetime=(async()=>{await request('boot',{files:[],runtime:'jspi',language});await request('start',{arguments:args});})();
    lifetime.catch(reason=>{error=reason.message??String(reason);});return true;
  },language,args);
}
const view=cdp=>cdp.eval('({waiting:__dcssDynamicCore.waiting,frames:__dcssDynamicCore.frames,error:__dcssDynamicCore.error,completed:__dcssDynamicCore.completed,frame:__dcssVerification.frame})');
async function current(cdp,until,label,predicate,minFrames=-1){
  return until(async()=>{const state=await view(cdp);if(state.error)throw Error(state.error);assert(!state.completed);
    return state.waiting&&state.frames>minFrames&&predicate(nativeFrameRows(state.frame))?state:false;},label);
}
// Fresh ?reference=1 page for each JA/EN and named/unnamed run. Sequential only.
export async function verifyNativeDynamicStartup({cdp,until,language='ja',named=false,evidence,capture}){
  assert(['en','ja'].includes(language));assert.equal(STARTUP_TEXT_PIN.schema_version,2);
  const player='DcssExternalName',args=['-seed','42',...(named?['-name',player]:[])];
  evidence.dynamic_startup={language,named,arguments:args,fixture:'source-controlled native character creation; no WIZARD',frames:[]};
  await setup(cdp,language,args);
  if(!named){
    // startup.cc1056–1082 bypasses this menu only with a good nonempty name.
    // Fresh files[] leaves no startup prefs; on_show defaults to normal mode,
    // and menu_item_activated accepts the blank name with is_good_name(...,true).
    const opening=await current(cdp,until,'genuine initial normal-game startup menu',isNativeInitialStartupMenu);
    evidence.dynamic_startup.frames.push({kind:'initial-startup',rows:nativeFrameRows(opening.frame),
      input:{key:'Enter',source:'startup.cc804–819,920–930; ng-input.cc62–68'}});
    await capture?.('dynamic-initial-startup-'+language);await physical(cdp,'Enter');
  }
  const initial=await current(cdp,until,'genuine native species menu',rows=>rows.join(' ').includes('Please select your species.'));
  const welcomeParams=named?{player_name:{kind:'actor_label',version:1,upstream:commit,form:'name',identity:{visibility:'external',name:player}}}:{};
  assert(nativeFrameRows(initial.frame).join(' ').includes(expectedNativeDisplayText(named?'startup.dynamic.welcome.named_only':'startup.dynamic.welcome.empty',welcomeParams,language)));
  if(named)assert(nativeFrameRows(initial.frame).join(' ').includes(player));
  const human=STARTUP_TEXT_PIN.entityRegistry.species[species.id][language],speciesKey=nativeMenuEntityHotkey(nativeFrameRows(initial.frame),human);
  evidence.dynamic_startup.frames.push({kind:'species',rows:nativeFrameRows(initial.frame),hotkey:speciesKey,cells:language==='ja'?nativeCjkLabelCells(initial.frame,human):null});
  await capture?.('dynamic-species-'+language+(named?'-named':''));await physical(cdp,speciesKey.key);
  const backgrounds=await current(cdp,until,'genuine native background menu',rows=>rows.join(' ').includes('Please select your background.'));
  const fighter=STARTUP_TEXT_PIN.entityRegistry.job[job.id][language],jobKey=nativeMenuEntityHotkey(nativeFrameRows(backgrounds.frame),fighter);
  evidence.dynamic_startup.frames.push({kind:'job',rows:nativeFrameRows(backgrounds.frame),hotkey:jobKey,cells:language==='ja'?nativeCjkLabelCells(backgrounds.frame,fighter):null});
  await capture?.('dynamic-job-'+language+(named?'-named':''));await physical(cdp,jobKey.key);
  const weapons=await current(cdp,until,'genuine native fixed11 weapon menu',rows=>Boolean(classifyStartingWeaponMenu(rows,prompts,labels)));
  assert.equal(classifyStartingWeaponMenu(nativeFrameRows(weapons.frame),prompts,labels).language,language);
  assert(nativeFrameRows(weapons.frame).join(' ').includes(expectedNativeDisplayText(named?'startup.dynamic.welcome.named_species_job':'startup.dynamic.welcome.unnamed_species_job',{species,job,...(named?welcomeParams:{})},language)));
  evidence.dynamic_startup.frames.push({kind:'weapon',rows:nativeFrameRows(weapons.frame),menu:classifyStartingWeaponMenu(nativeFrameRows(weapons.frame),prompts,labels)});
  // Escape goes back to species/job selection; X ends generation at this popup.
  if(named)await physical(cdp,'X');
  else{
    await physical(cdp,'Enter');
    const name=await current(cdp,until,'genuine native name-entry title',rows=>rows.join(' ').includes('What is your name today?'));
    assert(nativeFrameRows(name.frame).join(' ').includes(expectedNativeDisplayText('startup.dynamic.character.a',{species,job},language)));
    evidence.dynamic_startup.frames.push({kind:'name-title',semantic_id:'startup.dynamic.character.a',rows:nativeFrameRows(name.frame)});
    await capture?.('dynamic-name-title-'+language);
    for(const character of player)await physical(cdp,character);
    const entered=await current(cdp,until,'external name in native input buffer',rows=>rows.join(' ').includes('What is your name today? '+player));
    evidence.dynamic_startup.external_name_input_rows=nativeFrameRows(entered.frame);
    await physical(cdp,'Enter');
    const started=await current(cdp,until,'native character created by name Enter',rows=>rows.some(row=>row.includes('@')));
    const initialState=await cdp.eval('__dcssDynamicCore.state()');
    assert(initialState.hp>0);assert.equal(initialState.rng.length,45);assert.equal(initialState.seed,'42');
    evidence.dynamic_startup.initial_state=initialState;evidence.dynamic_startup.player_rows=nativeFrameRows(started.frame);
    await capture?.('dynamic-created-'+language);await physical(cdp,'.');
    await until(async()=>{const status=await view(cdp);if(status.error)throw Error(status.error);
      if(!status.waiting)return false;return (await cdp.eval('__dcssDynamicCore.state()')).turn>initialState.turn;},'ordinary new character wait turn');
    const beforeSave=await cdp.eval('__dcssDynamicCore.state()'),save=await cdp.eval('__dcssDynamicCore.save()');
    assert.equal(typeof save,'string');assert.deepEqual(await cdp.eval('__dcssDynamicCore.state()'),beforeSave);
    evidence.dynamic_startup.saved={bytes:Buffer.byteLength(save),native_state:beforeSave,
      route:'actual native save -> Rust pack_native -> fixture IndexedDB'};
    await physical(cdp,'q',{modifiers:2,text:'\u0011'});
    const confirm=await current(cdp,until,'source-native Ctrl-Q confirmation',rows=>rows.join(' ').includes('Confirm with "quit".'));
    assert(nativeFrameRows(confirm.frame).join(' ').includes('Are you sure you want to abandon this character'));
    evidence.dynamic_startup.quit_confirmation_rows=nativeFrameRows(confirm.frame);
    for(const character of 'quit')await physical(cdp,character);await physical(cdp,'Enter');
    let ending=await current(cdp,until,'native accepted quit ending',rows=>rows.join(' ').includes('--more--')||rows.join(' ').includes('Gear:')||rows.join(' ').includes('Inventory:')||rows.join(' ').includes('Goodbye, '+player+'.'));
    evidence.dynamic_startup.quit_prompts=[];
    for(let ordinal=0;ordinal<12;ordinal++){
      const text=nativeFrameRows(ending.frame).join(' '),beforeFrames=ending.frames;
      if(text.includes('Goodbye, '+player+'.')&&text.includes('Best Crawlers -'))break;
      let key,kind;
      if(/\b(?:Inventory|Gear):\s+.*(?:gear slots|Left\/Right to switch category)/.test(text)
          ||/\b(?:Potions|Scrolls|Evocable Items):\s+.*Left\/Right to switch category/.test(text)){key='Escape';kind='source-native final inventory';}
      else if(text.includes('--more--')){key=' ';kind='source-native end more';}
      else throw Error('unknown native quit screen '+JSON.stringify(nativeFrameRows(ending.frame)));
      evidence.dynamic_startup.quit_prompts.push({kind,key,rows:nativeFrameRows(ending.frame)});await physical(cdp,key);
      ending=await current(cdp,until,'bounded native quit prompt '+(ordinal+1),()=>true,beforeFrames);
    }
    const goodbye=nativeFrameRows(ending.frame).join(' ');
    assert(goodbye.includes('Goodbye, '+player+'.'));assert(goodbye.includes('Best Crawlers -'));assert(goodbye.includes('Quit the game'));
    evidence.dynamic_startup.goodbye_rows=nativeFrameRows(ending.frame);await capture?.('dynamic-quit-'+language);await physical(cdp,'Enter');
  }
  // Source-native end(0) or ordinary quit completes the actual engine lifetime.
  await until(async()=>{const result=await view(cdp);if(result.error)throw Error(result.error);return result.completed;},named?'native X generation cancellation completion':'native ordinary quit completion');
  await cdp.eval('__dcssDynamicCore.finish()');
  evidence.checks.push('Actual '+language+' native species/job/fixed11 menus, physical hotkeys, '+(named?'literal external-name welcome and native cancellation':'name Enter creates real character, ordinary wait/native save/Rust pack/IndexedDB and source-verified quit score')+' before Worker cleanup');
}
