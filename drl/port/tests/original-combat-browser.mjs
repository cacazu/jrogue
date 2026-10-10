/* Separate real-original-core gate. Default execution launches Chrome and one
 * local server; --self-test performs only source/fixture/helper checks.
 * No native memory, original gameplay, source asset or save bytes are edited.
 * The exact previously committed native snapshot is restored into an isolated
 * temporary browser profile, preserving version-2 file timestamps. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from '../web/server.mjs';
import {SOURCE_COMMIT,ENGINE_COMMIT,validateBuild,validateManifest} from '../web/game.mjs';
import {observeMap,nativeTargetWitness,captureCombatMessages}
  from './original-combat-witness.mjs';
import {chooseObservedEntryRoute} from './original-entry-route.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dist=path.join(root,'port','dist');
const output=path.join(root,'port','tests','output','original-combat');
const sha=bytes=>createHash('sha256').update(Array.isArray(bytes)?Uint8Array.from(bytes):bytes).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const glyphs=s=>s.replace(/\s/gu,'');
const contains=(s,label)=>glyphs(s).includes(glyphs(label));
const staticText=s=>s.replace(/\{[a-zA-Z!^]/g,'').replace(/[{}]/g,'').trim();
const PLAYING=4,SEED=5489,NAME='BrowserMarine_5489';
const MAX_ACTIONS=60,MAX_SHOTS=12,MAX_EXPOSURE_WAITS=8;

export function diagnostic(probe){
  assert.ok(probe&&Array.isArray(probe.bytes));
  const bytes=Uint8Array.from(probe.bytes),v=new DataView(bytes.buffer);
  assert.ok(bytes.length>=128&&bytes.length<=8192);
  assert.equal(v.getUint32(0,true),0x504c5244);assert.equal(v.getUint32(4,true),1);
  assert.equal(v.getUint32(8,true),128);assert.equal(v.getUint32(12,true),bytes.length-128);
  return {state:v.getUint32(16,true),seed:v.getUint32(20,true),difficulty:v.getUint32(24,true),
    seeded:Boolean(v.getUint32(28,true)),playerPresent:Boolean(v.getUint32(32,true)),
    x:v.getInt32(36,true),y:v.getInt32(40,true),hp:v.getInt32(44,true),hpMax:v.getUint32(48,true),
    exp:v.getInt32(52,true),expLevel:v.getUint32(56,true),level:v.getInt32(64,true),
    levelTime:v.getUint32(80,true),sha256:sha(bytes),rng_sha256:sha(bytes.subarray(128))};
}
export function weaponAmmo(text){
  const m=text.match(/\[(\d+)\/(\d+)\]\s*\((\d+)\)/);
  assert.ok(m,'Original pistol HUD must expose magazine and reserve');
  return {loaded:Number(m[1]),capacity:Number(m[2]),reserve:Number(m[3])};
}
export function sourceSelectedRunDelay(original,browser){
  const literal=s=>[...s.matchAll(/^\s*RunDelay\s*=\s*(\d+)\s*(?:--[^\n]*)?$/gm)].map(m=>({value:Number(m[1]),index:m.index}));
  const originalValues=literal(original),browserValues=literal(browser);
  assert.equal(originalValues.length,1,'Expected pinned literal original RunDelay');
  const includes=[...browser.matchAll(/^dofile\(['"]config\.lua['"]\)\s*$/gm)];
  assert.equal(includes.length,1,'Browser must load the original config exactly once');
  const overrides=browserValues.filter(value=>value.index>includes[0].index);
  return {configured_delay_ms:overrides.at(-1)?.value??originalValues[0].value,
    original_delay_ms:originalValues[0].value,browser_literal_override:overrides.length>0,
    runtime_option_introspected:false,native_settings_ui_option_found:false,
    limitation:'Literal source selection must be corroborated by optional read-only native configuration getters. Unchanged DRLP bytes remain a bounded player/RNG witness, not fullworld state.'};
}
export function runtimeConfiguration(probe){
  const value=probe?.configuration;
  assert.ok(value&&Number.isInteger(value.runDelayMs)&&value.runDelayMs>=0&&value.runDelayMs<=255,
    'Read-only native RunDelay getter required');
  assert.ok(typeof value.multiMoveActive==='boolean','Read-only native MultiMove.Active getter required during play');
  return {runDelayMs:value.runDelayMs,multiMoveActive:value.multiMoveActive};
}
function sameDisplayedName(outcome,target){
  // Original GetName(true) adds the English definite article; GetName(false)
  // used by look-description omits it. Preserve both raw observed values.
  return outcome===target||outcome===`the ${target}`||outcome===`The ${target}`;
}
class CDP{
  constructor(socket,events){this.socket=socket;this.next=0;this.pending=new Map();socket.addEventListener('message',e=>{
    const p=JSON.parse(e.data);if(!p.id){events(p);return;}const q=this.pending.get(p.id);if(!q)return;
    clearTimeout(q.timer);this.pending.delete(p.id);p.error?q.reject(new Error(JSON.stringify(p.error))):q.resolve(p.result);
  });socket.addEventListener('close',()=>{for(const q of this.pending.values()){clearTimeout(q.timer);q.reject(new Error('Chrome debugger closed'));}this.pending.clear();});}
  call(method,params={}){return new Promise((resolve,reject)=>{const id=++this.next,timer=setTimeout(()=>{
    this.pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},30000);
    this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  async evaluate(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
async function fixtureAndArtifacts(){
  const fixturePath=process.env.DRL_COMBAT_FIXTURE??path.join(root,'port','tests','output','original-game','native-save-snapshot.json');
  const fixtureBytes=await readFile(fixturePath),fixture=JSON.parse(fixtureBytes);
  assert.equal(fixture.format,'drl-original-core-files');assert.equal(fixture.version,2,'Current verified timestamp-preserving native snapshot required');
  const native=fixture.entries.filter(e=>e.kind==='file'&&e.path==='/user/user/drl/save');
  assert.equal(native.length,1);assert.ok(native[0].bytes.length>32);assert.equal(sha(native[0].bytes),native[0].sha256);
  const build=validateBuild(JSON.parse(await readFile(path.join(dist,'build.json'),'utf8')));
  const manifest=validateManifest(JSON.parse(await readFile(path.join(dist,'core-assets.json'),'utf8')));
  for(const a of [build.core,build.adapter]){const b=await readFile(path.join(dist,a.file));assert.equal(b.length,a.size);assert.equal(sha(b),a.sha256);}
  const getAsset=async name=>{const a=manifest.files.find(a=>a.path===name);assert.ok(a,`Missing original asset ${name}`);
    const b=await readFile(path.join(dist,...a.url.split('/')));assert.equal(sha(b),a.sha256);return {descriptor:a,text:b.toString('utf8')};};
  const [config,browser]=await Promise.all([getAsset('data/config.lua'),getAsset('data/config-browser.lua')]);
  const runDelay={...sourceSelectedRunDelay(config.text,browser.text),original_asset_sha256:config.descriptor.sha256,
    browser_asset_sha256:browser.descriptor.sha256};
  const catalogs={};for(const language of ['en','ja'])catalogs[language]=JSON.parse(await readFile(path.join(root,'localization',`${language}.json`),'utf8'));
  return {fixture,fixturePath,fixture_sha256:sha(fixtureBytes),nativeSave:native[0],build,runDelay,catalogs};
}
async function suite(){
  const mode=process.argv.find(a=>a.startsWith('--mode='))?.slice(7)??'all';assert.ok(['all','combat','autorun'].includes(mode));
  await mkdir(output,{recursive:true});
  const e={schema:1,scope:'Original Pascal/Lua observed hostile combat and physical autorun cancellation; bounded acquisition, not fullworld or campaign proof',
    started_at:new Date().toISOString(),result:'pending',source_commit:SOURCE_COMMIT,engine_commit:ENGINE_COMMIT,
    mode,checks:[],actions:[],observations:[],console:[],browser_errors:[],remaining_gates:[],player_kill_attribution_verified:false,
    original_world_witness_complete:false,complete_campaign:false};
  let server,chrome,profile,socket,cdp,chromeError='',spawnError,observationIndex=0,acceptedActions=0;
  const check=(name,detail={})=>e.checks.push({name,result:'pass',...detail});
  try{
    const a=await fixtureAndArtifacts();e.artifacts={core:a.build.core,adapter:a.build.adapter};e.run_delay=a.runDelay;
    e.fixture={file:a.fixturePath,sha256:a.fixture_sha256,native_path:a.nativeSave.path,native_sha256:a.nativeSave.sha256,version:a.fixture.version};
    const ja=a.catalogs.ja;
    const until=async(fn,label,timeout=45000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(spawnError)throw spawnError;
      const value=await fn();if(value)return value;await pause(25);}throw new Error(`Timeout: ${label}; Chrome ${chromeError.slice(-400)}`);};
    server=createServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
    const base=`http://127.0.0.1:${server.address().port}/`;
    profile=await mkdtemp(path.join(os.tmpdir(),'drl-original-combat-'));
    chrome=spawn(process.env.DRL_CHROME??'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
      '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking',
      '--disable-component-update','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],
      {windowsHide:true,stdio:['ignore','ignore','pipe']});
    chrome.once('error',error=>{spawnError=error;});chrome.stderr.on('data',b=>{chromeError=(chromeError+b.toString()).slice(-8192);});
    const port=await until(async()=>{try{return Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return false;}},'Chrome debugger');
    const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json(),page=pages.find(p=>p.type==='page');assert.ok(page);
    socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
    cdp=new CDP(socket,p=>{if(p.method==='Runtime.consoleAPICalled')e.console.push(p.params);
      if(p.method==='Runtime.exceptionThrown')e.browser_errors.push(p.params.exceptionDetails);});
    await cdp.call('Page.enable');await cdp.call('Runtime.enable');e.chrome=await cdp.call('Browser.getVersion');
    await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:"window.__combatBootErrors=[];addEventListener('error',e=>__combatBootErrors.push(String(e.error||e.message)));addEventListener('unhandledrejection',e=>__combatBootErrors.push(String(e.reason)));"});
    await cdp.call('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});
    const sample=()=>cdp.evaluate(`(()=>{const g=window.drlGame;return {ready:!!g,running:g?.running??false,paused:g?.paused??false,
      locale:g?.locale,queueLength:g?.queueLength??0,frameGeneration:g?.frameGeneration??0,lastEnqueuedReceipt:g?.lastEnqueuedReceipt??0,
      lastPresentedReceipt:g?.lastPresentedReceipt??0,textDeliveryPending:g?.textDeliveryPending??false,
      unsupported:g?.unsupportedImports??[],failedPresentation:g?.failedPresentation??null,
      probe:g?.paused?g.probe():null,projection:g?.projection??null,text:document.querySelector('#screen-text')?.textContent??'',
      status:document.querySelector('#status')?.textContent??'',error:document.querySelector('#status')?.dataset.error==='true',
      startEnabled:!document.querySelector('#start')?.disabled,resumeEnabled:!document.querySelector('#resume')?.disabled,
      textActive:!document.querySelector('#text-entry')?.hidden,errors:window.__combatBootErrors??[]};})()`);
    const healthy=async()=>{const s=await sample();e.last_state={...s,projection:undefined,probe:s.probe?diagnostic(s.probe):null};
      assert.equal(s.error,false,s.status);assert.deepEqual(s.errors,[]);assert.deepEqual(s.unsupported,[]);assert.equal(s.failedPresentation,null);return s;};
    const settle=async()=>{let previous=null,same=0;return until(async()=>{const s=await healthy();
      if(!s.running||!s.paused||s.queueLength||s.textDeliveryPending||!s.probe){previous=null;same=0;return false;}
      const h=sha(s.probe.bytes);same=h===previous?same+1:0;previous=h;return same>=3?s:false;},'Native paused seam and drained input');};
    const vk=key=>({Enter:13,Escape:27,Home:36,End:35,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Tab:9,Shift:16}[key]??key.toUpperCase().charCodeAt(0));
    const dispatch=(type,key,code=key,modifiers=0)=>cdp.call('Input.dispatchKeyEvent',{type,key,code,modifiers,windowsVirtualKeyCode:vk(key),nativeVirtualKeyCode:vk(key)});
    const key=async(keyValue,code=keyValue,modifiers=0)=>{const before=await settle();
      await cdp.evaluate("document.querySelector('#game-screen').focus({preventScroll:true})");
      await dispatch('keyDown',keyValue,code,modifiers);const receipt=await cdp.evaluate('drlGame.lastEnqueuedReceipt');assert.ok(receipt>before.lastEnqueuedReceipt);
      const shown=await until(async()=>{const s=await healthy();return s.lastPresentedReceipt>=receipt?s:false;},'Original presentation acknowledges physical key-down');
      await dispatch('keyUp',keyValue,code,modifiers);const after=await settle();
      e.actions.push({kind:'physical_key',key:keyValue,code,modifiers,down_receipt:receipt,down_presented_frame:shown.frameGeneration,
        before:diagnostic(before.probe),after:diagnostic(after.probe)});
      if(diagnostic(after.probe).levelTime>diagnostic(before.probe).levelTime)acceptedActions++;
      await capture(`physical-key-${keyValue}`,after);
      return after;};
    const capture=async(label,s)=>{s??=await settle();assert.ok(s.paused&&s.probe&&s.projection);const d=diagnostic(s.probe);
      const filename=`frame-${String(++observationIndex).padStart(3,'0')}.json`,record={schema:1,label,probe:s.probe,
        diagnostic:d,frameGeneration:s.frameGeneration,lastPresentedReceipt:s.lastPresentedReceipt,text:s.text,projection:s.projection};
      const bytes=Buffer.from(JSON.stringify(record,null,2));await writeFile(path.join(output,filename),bytes);
      e.observations.push({label,file:filename,sha256:sha(bytes),diagnostic:d,
        ammo:/\[\d+\/\d+\]\s*\(\d+\)/.test(s.text)?weaponAmmo(s.text):null});return s;};
    const navigate=async()=>{await cdp.call('Page.navigate',{url:base+'game.html'});await until(async()=>{const s=await healthy();return s.ready&&s.startEnabled?s:false;},'Original verified browser shell',90000);};
    const restore=async()=>{await cdp.evaluate(`(async()=>{const s=${JSON.stringify(a.fixture)};for(const e of s.entries)e.bytes=Uint8Array.from(e.bytes);
      const db=await new Promise((r,j)=>{const q=indexedDB.open('drl-original-core',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});
      try{await new Promise((r,j)=>{const t=db.transaction('snapshots','readwrite');t.objectStore('snapshots').put(s,'latest');t.oncomplete=r;t.onerror=t.onabort=()=>j(t.error)})}finally{db.close()}})()`);};
    const launch=async()=>{await navigate();await restore();await navigate();assert.equal((await healthy()).resumeEnabled,true);
      await cdp.evaluate("document.querySelector('#resume').click()");
      const continueLabel=staticText(ja['menu.main.continue']).replace(/^[-=\s]+|[-=\s]+$/g,'');
      const logoPrefix=staticText(ja['startup.logo-text'].split('{{version}}')[0]);
      for(let n=0;n<3;n++){const s=await settle();if(contains(s.text,continueLabel))break;
        assert.ok(logoPrefix&&contains(s.text,logoPrefix),'Only witnessed original startup logo may receive confirmation');
        await capture('known-native-startup-logo',s);await key('Enter');}
      assert.ok(contains((await settle()).text,continueLabel),'Native Continue entry required');await key('Home');await key('Enter');
      const s=await until(async()=>{const s=await settle();return diagnostic(s.probe).state===PLAYING?s:false;},'Original native Continue game');
      const d=diagnostic(s.probe);assert.equal(d.seed,SEED);assert.equal(d.difficulty,1);assert.equal(d.seeded,true);
      assert.ok(s.text.includes(NAME),'External character name restored exactly');assert.equal(d.x,6);assert.equal(d.y,10);
      if(s.probe.configuration){const c=runtimeConfiguration(s.probe);
        assert.equal(c.runDelayMs,a.runDelay.configured_delay_ms,'Native option agrees with the verified literal configuration chain');
        assert.equal(c.multiMoveActive,false);e.run_delay={...a.runDelay,runtime_option_introspected:true,
          native_run_delay_ms:c.runDelayMs,native_configuration:c};}
      await capture('native-fixture-loaded',s);
      // Exactly the already observed original continuation, not a synthetic save.
      await capture('recorded-continuation-right',await key('ArrowRight'));const last=await capture('recorded-continuation-wait',await key('w','KeyW'));
      const p=diagnostic(last.probe);assert.equal(p.x,7);assert.equal(p.y,10);assert.equal(p.levelTime,83);return last;};
    const moreLabels=['view.hud.more','view.hud.press-confirm'].map(id=>{
      assert.equal(typeof ja[id],'string');
      // The exact existing fixture retains original INPUT_OK=Enter. Future
      // rebound fixtures fail this known native prompt witness rather than
      // receiving arbitrary Enter presses.
      return {id,text:staticText(ja[id].replace('{$input_ok}','Enter'))};});
    const moreWitness=s=>moreLabels.find(l=>contains(s.text.split('\n')[1]??'',l.text));
    const normal=async(label,s)=>{s??=await settle();
      for(let n=0;n<8&&moreWitness(s);n++){
        const w=moreWitness(s);await capture(`known-native-more-${w.id}`,s);
        e.actions.push({kind:'known_more_confirmation',id:w.id,screen:s.text});s=await key('Enter');
      }
      assert.ok(!moreWitness(s),'More-prompt confirmation bound exhausted');
      assert.ok(!contains(s.text,staticText(ja['view.target.fire'])),'Target overlay is not a normal combat observation');
      let d=diagnostic(s.probe),map=null;assert.equal(d.state,PLAYING);assert.equal(d.level,1);
      assert.ok(d.hp>0);assert.ok(!s.textActive);
      await until(async()=>{
        if(!s.paused||s.queueLength||s.textDeliveryPending||!s.probe){s=await healthy();return false;}
        d=diagnostic(s.probe);assert.equal(d.state,PLAYING);assert.equal(d.level,1);assert.ok(d.hp>0);
        try{map=observeMap(s.projection,d);return s;}catch(error){
          if(error.message!=='Native @ / DRLP map-coordinate validation failed')throw error;
          // Native damage/projectile animations temporarily cover @ with *.
          // Require a later actual frame exposing the native player again.
          s=await healthy();return false;
        }
      },'Original animation completes with actual @ / DRLP map correlation',10000);
      await capture(label,s);return {sample:s,probe:d,map};};

    if(mode!=='combat'){
      const initial=await launch(),before=diagnostic(initial.probe),map=observeMap(initial.projection,before);
      const configuration=runtimeConfiguration(initial.probe);
      assert.equal(configuration.runDelayMs,0,'This gate specifically requires actual native RunDelay=0');
      assert.equal(a.runDelay.configured_delay_ms,0,'Verified browser configuration selects RunDelay=0 after original config');
      assert.equal(configuration.multiMoveActive,false);
      assert.equal(map.hostiles.length,0,'Cancellation starts before a visible enemy can naturally stop run');
      const clear=new Set(map.clearCells.map(p=>`${p.x},${p.y}`));
      for(let x=before.x+1;x<=before.x+6;x++)assert.ok(clear.has(`${x},${before.y}`),'Six actually observed clear east tiles required');
      assert.ok(!contains(initial.text,ja['message.stop']),'Fresh fixture must not contain an old Stop message');
      await cdp.evaluate("document.querySelector('#game-screen').focus({preventScroll:true})");
      // Start observer before physical input. It samples only JSPI-paused seams
      // and resolves after a genuinely accepted original movement turn.
      const accepted=cdp.evaluate(`new Promise((resolve,reject)=>{const end=Date.now()+10000;const tick=()=>{
        const g=drlGame;if(Date.now()>end){reject(new Error('No accepted original autorun turn'));return;}
        if(g.paused&&g.projection&&!g.textDeliveryPending&&g.queueLength===0&&g.frameGeneration>${initial.frameGeneration}){
          const p=g.probe();if(p?.state===4&&p.x>${before.x}&&p.y===${before.y}&&p.configuration?.multiMoveActive===true){
          resolve({paused:true,probe:p,projection:g.projection,text:document.querySelector('#screen-text').textContent,
            frameGeneration:g.frameGeneration,lastPresentedReceipt:g.lastPresentedReceipt});return;}}
        setTimeout(tick,0);};tick();})`);
      // Prevent an early rejected observer from becoming an unhandled rejection.
      accepted.catch(()=>{});
      await dispatch('keyDown','Shift','ShiftLeft',8);await dispatch('keyDown','ArrowRight','ArrowRight',8);
      const first=await accepted;assert.ok(diagnostic(first.probe).levelTime>before.levelTime);
      assert.equal(runtimeConfiguration(first.probe).runDelayMs,0);assert.equal(runtimeConfiguration(first.probe).multiMoveActive,true);
      observeMap(first.projection,diagnostic(first.probe));
      await dispatch('keyDown','Escape','Escape',8);const stopReceipt=await cdp.evaluate('drlGame.lastEnqueuedReceipt');
      const stopped=await until(async()=>{const s=await healthy();return s.paused&&s.probe&&
        s.lastPresentedReceipt>=stopReceipt&&contains(s.text,ja['message.stop'])?s:false;},'Original run receives physical Escape and reports Stop',10000);
      await dispatch('keyUp','Escape','Escape',8);await dispatch('keyUp','ArrowRight','ArrowRight',8);await dispatch('keyUp','Shift','ShiftLeft',0);
      await capture('autorun-first-accepted-original-turn',first);
      const end=await capture('autorun-stopped',await settle()),d=diagnostic(end.probe);
      assert.equal(runtimeConfiguration(end.probe).runDelayMs,0);assert.equal(runtimeConfiguration(end.probe).multiMoveActive,false);
      assert.ok(d.x>before.x);assert.equal(d.y,before.y);assert.equal(d.state,PLAYING);
      assert.ok(!contains(end.text,staticText(ja['view.menu.save-quit'])),'Stop key is discarded rather than opening a menu');
      const stable=d.sha256,targetFrame=end.frameGeneration+20;
      await until(async()=>{const s=await healthy();if(!s.paused||!s.probe)return false;
        assert.equal(diagnostic(s.probe).sha256,stable,'Cancelled automatic movement stays stopped, including all bounded RNG bytes');
        assert.equal(runtimeConfiguration(s.probe).multiMoveActive,false,'Native automatic movement remains inactive');
        return s.frameGeneration>=targetFrame?s:false;},'Twenty real native presentations after run cancellation');
      e.actions.push({kind:'physical_shift_right_escape',first_accepted:diagnostic(first.probe),stop_receipt:stopReceipt,
        stop_presented_frame:stopped.frameGeneration,before,after:d});
      check('Physical Shift+Right autorun accepts an original turn; Escape stops it without opening a menu; twenty later native frames remain stable',
        {source_selected_run_delay_ms:a.runDelay.configured_delay_ms,runtime_option_introspected:true,
          native_run_delay_ms:configuration.runDelayMs,active_at_first_turn:true,inactive_after_escape:true});
      check('Native RunDelay=0 cancellation',{option_truth:e.run_delay});
      e.requested_zero_delay_verified=true;
    }

    if(mode!=='autorun'){
      let current=await normal('combat-start',await launch()),visited=new Set([`${current.probe.x},${current.probe.y}`]),opened=new Set();
      acceptedActions=0;let encountered=false;
      const deadline=Date.now()+120000;
      const selectTarget=async(normalState)=>{await key('t','KeyT');let s=await settle();
        for(let n=0;n<8;n++){const target=nativeTargetWitness(s.text,s.projection,ja,{probe:normalState.probe,hostiles:normalState.map.hostiles});
          if(target?.validated){await capture('named-visible-native-target',s);return {sample:s,target};}
          s=await key('Tab');}
        await key('Escape');throw new Error('No named native target matched the observed visible hostile');};
      const inspectKnownTile=async(normalState,target,{expectedIds=[]}={})=>{
        // Original TLookModeView starts at Player.Position. Look arrows change
        // its reticle only; prove unchanged native player/RNG bytes throughout.
        // VTIG root origin adds one before console indexing: Point(...,1)
        // captions render at browser row 1; FHintOverlay Point(...,2) at row 2. GetLookDescription
        // returns a visible cell name only inside original isVisible(aWhere).
        const originalSha=normalState.probe.sha256;
        const lookLabel=staticText(ja['view.hud.look-mode']);
        let s=await key('l','KeyL');
        assert.ok(contains(s.text.split('\n')[1]??'',lookLabel),'Exact native Look Mode caption');
        assert.equal(diagnostic(s.probe).sha256,originalSha,'Entering native Look Mode consumes no turn/RNG');
        let x=normalState.probe.x,y=normalState.probe.y;
        assert.deepEqual(s.projection.cursor,[x,y+1],'Original look reticle starts at actual player');
        assert.ok(target.x>=1&&target.x<=78&&target.y>=1&&target.y<=20,'Prior visible target coordinate remains inside original map');
        let steps=0;
        while(x!==target.x||y!==target.y){
          assert.ok(++steps<=98,'Bounded original look reticle movement');
          const direction=x!==target.x?(target.x>x?'ArrowRight':'ArrowLeft'):(target.y>y?'ArrowDown':'ArrowUp');
          s=await key(direction);if(direction==='ArrowRight')x++;else if(direction==='ArrowLeft')x--;else if(direction==='ArrowDown')y++;else y--;
          assert.equal(diagnostic(s.probe).sha256,originalSha,'Moving original look reticle consumes no turn/RNG');
          assert.deepEqual(s.projection.cursor,[x,y+1],'Actual native reticle reaches each requested original coordinate');
        }
        const description=s.text.split('\n')[2]??'';
        const outOfVision=contains(description,ja['view.out-of-vision'])||contains(description,a.catalogs.en['view.out-of-vision']);
        const corpseIds=['term.cell.formercorpse.name','term.cell.sergeantcorpse.name']
          .filter(id=>contains(description,ja[id]));
        const nowClear=normalState.map.clearCells.some(p=>p.x===target.x&&p.y===target.y);
        const clearIds=['term.cell.floor.name','term.cell.floor.blname','term.cell.rock.name']
          .filter(id=>contains(description,ja[id]));
        const doorIds=['term.cell.door.name','term.cell.odoor.name'].filter(id=>contains(description,ja[id]));
        const expectedCellIds=expectedIds.filter(id=>contains(description,ja[id]));
        const witness={coordinate:{x:target.x,y:target.y},description_row:2,description,
          out_of_vision:outOfVision,corpse_semantic_ids:corpseIds,clear_cell_semantic_ids:clearIds,
          door_semantic_ids:doorIds,expected_cell_semantic_ids:expectedCellIds,
          current_clear_projection:nowClear,current_visibility_verified:!outOfVision&&(corpseIds.length>0||doorIds.length>0||(nowClear&&clearIds.length>0)),
          enemy_uid_verified:false,corpse_identity_verified:false,player_kill_attribution_verified:false};
        await capture('fresh-native-look-former-target',s);
        const closed=await key('Escape');assert.equal(diagnostic(closed.probe).sha256,originalSha,'Closing native Look Mode consumes no turn/RNG');
        return {witness,normal:await normal('native-look-closed',closed)};
      };
      while(!current.map.hostiles.length&&acceptedActions<MAX_ACTIONS&&Date.now()<deadline){
        const route=chooseObservedEntryRoute(current.map,{visited,opened,maxSteps:1});
        assert.ok(route.length,'No currently observed clear/known door route; preserve acquisition as incomplete');
        const step=route[0];
        if(step.kind==='open_door'){
          const inspected=await inspectKnownTile(current,step,{expectedIds:['term.cell.door.name']});
          current=inspected.normal;
          assert.ok(inspected.witness.current_visibility_verified&&inspected.witness.expected_cell_semantic_ids.includes('term.cell.door.name'),
            'Fresh original L confirms this actually projected closed door is visible');
          const before=current.probe;
          current=await normal('native-observed-door-arrow-bump',await key(step.key,step.code));
          assert.equal(current.probe.x,before.x);assert.equal(current.probe.y,before.y);
          assert.ok(current.probe.levelTime>before.levelTime,'Original MoveDoor action consumes a genuine turn');
          assert.ok(contains(current.sample.text,ja['message.door.open']),'Exact native translated door-open message');
          const door=current.map.mapCells.find(p=>p.x===step.x&&p.y===step.y);
          assert.ok(door?.source==='base'&&(door.text==='/'||current.map.hostiles.some(p=>p.x===step.x&&p.y===step.y)),
            'Opened door appears as original slash, or an actual hostile now occupies the doorway');
          opened.add(`${step.x},${step.y}`);
          e.actions.push({kind:'observed_native_door_open',coordinate:{x:step.x,y:step.y},look:inspected.witness,
            message_semantic_id:'message.door.open',before,after:current.probe});
        }else{
          current=await normal(`observed-${step.kind}-terrain-step`,await key(step.key,step.code));
          assert.equal(current.probe.x,step.x);assert.equal(current.probe.y,step.y,'Exactly the one actually projected traversable step');
        }
        visited.add(`${current.probe.x},${current.probe.y}`);
        assert.ok(current.probe.hp>current.probe.hpMax/2,'Bounded acquisition health floor');
      }
      assert.ok(current.map.hostiles.length,'No observed hostile within bounded acquisition');encountered=true;
      check('Bounded original movement and source-backed observed door use acquire an actually visible hostile from normal rendered projection',
        {hostiles:current.map.hostiles,accepted_actions:acceptedActions,probe:current.probe,opened_door_coordinates:[...opened]});
      let selected=await selectTarget(current);await key('Escape');
      const firstTarget=selected.target;e.encounter={target:firstTarget,normal_hostiles:current.map.hostiles};
      let playerDamage=false,hit=false,hostileDamage=false,death=false,shots=0;
      for(let n=0;n<MAX_EXPOSURE_WAITS&&!playerDamage;n++){
        const previous=current;current=await normal('bounded-hostile-exposure-wait',await key('w','KeyW'));
        const messages=captureCombatMessages(current.sample.text,{catalog:a.catalogs});
        playerDamage=current.probe.hp<previous.probe.hp&&messages.playerHits.length>0;
        assert.ok(current.probe.hp>current.probe.hpMax/2,'Stop exposure at health floor');
        assert.ok(current.map.hostiles.length,'Hostile visibility lost during bounded exposure');
      }
      e.player_damage={verified:playerDamage};
      if(playerDamage)check('Observed player HP decreases on harmless terrain with original hostile-hit message');
      else e.remaining_gates.push('No attributed player damage witnessed within eight original waits; no damage assumption from RNG or ticks.');
      while(shots<MAX_SHOTS&&acceptedActions<MAX_ACTIONS&&Date.now()<deadline&&!death){
        const before=current,ammo=weaponAmmo(before.sample.text);
        if(ammo.loaded===0){assert.ok(ammo.reserve>0,'No pistol reserve');current=await normal('native-combat-reload',await key('r','KeyR'));continue;}
        selected=await selectTarget(before);const target=selected.target;
        const fired=await key('f','KeyF');shots++;current=await normal('named-hostile-shot',fired);
        const afterAmmo=weaponAmmo(current.sample.text);assert.equal(afterAmmo.loaded,ammo.loaded-1,'One native pistol shot');
        const messages=captureCombatMessages(current.sample.text,{catalog:a.catalogs});
        const namedHit=messages.hits.some(m=>sameDisplayedName(m.name,target.name));hit ||= namedHit;
        const namedDeath=messages.deaths.some(m=>sameDisplayedName(m.name,target.name));
        const noLongerThere=!current.map.hostiles.some(p=>p.x===target.x&&p.y===target.y);
        let visibility=null;
        if(namedDeath&&current.probe.exp>before.probe.exp&&noLongerThere){
          const inspected=await inspectKnownTile(current,target);visibility=inspected.witness;current=inspected.normal;
        }
        death=namedDeath&&current.probe.exp>before.probe.exp&&noLongerThere&&visibility?.current_visibility_verified===true;
        hostileDamage ||= death;
        e.actions.push({kind:'observed_hostile_shot',target,messages,named_hit:namedHit,named_visible_death:namedDeath,
          former_target_fresh_look:visibility,xp_delta:current.probe.exp-before.probe.exp,
          player_kill_attribution_verified:false,ammo_before:ammo,ammo_after:afterAmmo});
        assert.ok(current.probe.hp>current.probe.hpMax/2,'Bounded combat health floor');
        if(!death)assert.ok(current.map.hostiles.length,'Target vanished without a named visible death witness');
      }
      assert.ok(encountered&&hit,'No original named missile hit within shot bound');
      check('Original pistol consumes ammo and reports a named hit on an observed hostile',{shots});
      assert.ok(death&&hostileDamage,'No named visible hostile death, XP increase and fresh visible corpse/clear/door former target tile within bounds');
      check('Named visible hostile death follows original shots; XP rises and fresh native look verifies the still-visible former target tile',
        {shots,exact_enemy_hp_verified:false,player_kill_attribution_verified:false});
      e.remaining_gates.push('Current DRLP lacks enemy UID/HP and registered player-kill counters: correlated hostile death is observed; exact player kill attribution and fullworld state are not asserted.');
    }
    assert.deepEqual(e.browser_errors,[]);e.result=e.remaining_gates.some(s=>s.startsWith('Requested RunDelay=0')||s.startsWith('No attributed player damage'))?'partial':'pass';
    e.requested_zero_delay_verified=e.requested_zero_delay_verified===true;
    e.bounded_observable_combat_complete=mode!=='autorun'&&e.checks.some(c=>c.name.startsWith('Named visible hostile death'));
    if(e.result==='partial')process.exitCode=1;
  }catch(error){e.result='fail';e.error=error.stack;process.exitCode=1;
    if(cdp)try{const p=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'failure.png'),Buffer.from(p.data,'base64'));}catch{}
  }finally{
    if(cdp)await cdp.call('Browser.close').catch(()=>{});socket?.close();
    if(chrome){for(let n=0;n<20&&chrome.exitCode===null;n++)await pause(100);if(chrome.exitCode===null)chrome.kill();}
    if(server)await new Promise(r=>server.close(r));
    if(profile){const p=path.resolve(profile),temp=path.resolve(os.tmpdir())+path.sep;
      assert.ok(p.startsWith(temp)&&path.basename(p).startsWith('drl-original-combat-'));await rm(p,{recursive:true,force:true,maxRetries:8,retryDelay:200}).catch(error=>{e.cleanup_error=error.code;});}
    e.finished_at=new Date().toISOString();await writeFile(path.join(output,'evidence.json'),JSON.stringify(e,null,2));
  }
  console.log(JSON.stringify({result:e.result,checks:e.checks.length,remaining:e.remaining_gates,output}));return e;
}
async function selfTest(){
  assert.deepEqual(weaponAmmo('武:ピストル (2d4) [6/6] (39)'),{loaded:6,capacity:6,reserve:39});
  assert.throws(()=>weaponAmmo('no ammo'));
  assert.equal(sourceSelectedRunDelay('RunDelay = 20',"dofile('config.lua')").configured_delay_ms,20);
  assert.equal(sourceSelectedRunDelay('RunDelay = 20',"dofile('config.lua')\nRunDelay = 0").configured_delay_ms,0);
  assert.equal(sourceSelectedRunDelay('RunDelay = 20',"RunDelay = 0\ndofile('config.lua')").configured_delay_ms,20);
  assert.throws(()=>sourceSelectedRunDelay('RunDelay = 20',''),/load/);
  assert.equal(sameDisplayedName('The former human','former human'),true);
  assert.equal(sameDisplayedName('former sergeant','former human'),false);
  assert.deepEqual(runtimeConfiguration({configuration:{runDelayMs:0,multiMoveActive:true}}),{runDelayMs:0,multiMoveActive:true});
  assert.throws(()=>runtimeConfiguration({configuration:{runDelayMs:-1,multiMoveActive:false}}),/RunDelay/);
  assert.throws(()=>runtimeConfiguration({}),/RunDelay/);
  assert.throws(()=>runtimeConfiguration({configuration:{runDelayMs:0,multiMoveActive:null}}),/MultiMove/);
  const a=await fixtureAndArtifacts();assert.equal(a.fixture.version,2);
  console.log(JSON.stringify({result:'pass',scope:'Pure helper/current asset/native fixture checks; no browser or game executed',checks:13,
    fixture_sha256:a.fixture_sha256,core:a.build.core.sha256,adapter:a.build.adapter.sha256,run_delay:a.runDelay}));
}
if(process.argv.includes('--self-test'))await selfTest();else await suite();
