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
import {createDeathClassifier,terminalConfirmationAllowed} from './original-death-phase.mjs';
import {sourceSelectedDeathPaths,pinnedSeededRecordingPolicy} from './original-death-storage.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dist=path.join(root,'port','dist');
const output=path.join(root,'port','tests','output','original-death');
const sha=bytes=>createHash('sha256').update(Array.isArray(bytes)?Uint8Array.from(bytes):bytes).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const glyphs=s=>s.replace(/\s/gu,'');
const contains=(s,label)=>glyphs(s).includes(glyphs(label));
const staticText=s=>s.replace(/\{[a-zA-Z!^]/g,'').replace(/[{}]/g,'').trim();
const PLAYING=4,SEED=5489,NAME='BrowserMarine_5489';
const MAX_ACTIONS=80,MAX_ROUTE_ACTIONS=40;

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
  const persistencePaths=sourceSelectedDeathPaths(browser.text);
  const policyPaths={data:'native/drl/src/dfdata.pas',base:'native/drl/src/drlbase.pas',hof:'native/drl/src/dfhof.pas',playerLua:'native/drl/bin/data/core/player.lua'};
  const policySources=Object.fromEntries(await Promise.all(Object.entries(policyPaths).map(async([key,file])=>[key,await readFile(path.join(root,...file.split('/')),'utf8')])));
  const recordingPolicy={...pinnedSeededRecordingPolicy(policySources),source_hashes:Object.fromEntries(Object.entries(policySources).map(([key,text])=>[policyPaths[key],sha(Buffer.from(text))]))};
  return {fixture,fixturePath,fixture_sha256:sha(fixtureBytes),nativeSave:native[0],build,runDelay,catalogs,persistencePaths,recordingPolicy};
}
async function suite(){
  await mkdir(output,{recursive:true});
  const e={schema:1,scope:'Original Pascal/Lua native death, mortem, score/profile and fresh-page persistence; finite observed route/waits, not fullworld or campaign proof',
    started_at:new Date().toISOString(),result:'pending',source_commit:SOURCE_COMMIT,engine_commit:ENGINE_COMMIT,
    checks:[],actions:[],observations:[],screenshots:[],console:[],browser_errors:[],localization_findings:[],remaining_gates:[],player_kill_attribution_verified:false,
    original_world_witness_complete:false,complete_campaign:false};
  let server,chrome,profile,socket,cdp,chromeError='',spawnError,observationIndex=0,acceptedActions=0;
  const check=(name,detail={})=>e.checks.push({name,result:'pass',...detail});
  try{
    const a=await fixtureAndArtifacts();e.artifacts={core:a.build.core,adapter:a.build.adapter};e.run_delay=a.runDelay;
    e.source_selected_persistence_paths=a.persistencePaths;e.source_recording_policy=a.recordingPolicy;
    e.fixture={file:a.fixturePath,sha256:a.fixture_sha256,native_path:a.nativeSave.path,native_sha256:a.nativeSave.sha256,version:a.fixture.version};
    const ja=a.catalogs.ja;
    const until=async(fn,label,timeout=45000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(spawnError)throw spawnError;
      const value=await fn();if(value)return value;await pause(25);}throw new Error(`Timeout: ${label}; Chrome ${chromeError.slice(-400)}`);};
    server=createServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
    const base=`http://127.0.0.1:${server.address().port}/`;
    profile=await mkdtemp(path.join(os.tmpdir(),'drl-original-death-'));
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
      locale:g?.locale,filesGeneration:g?.filesGeneration??null,saveGeneration:g?.saveGeneration??null,queueLength:g?.queueLength??0,frameGeneration:g?.frameGeneration??0,lastEnqueuedReceipt:g?.lastEnqueuedReceipt??0,
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

      let current=await normal('death-route-start',await launch()),visited=new Set([`${current.probe.x},${current.probe.y}`]),opened=new Set();
      acceptedActions=0;let encountered=false;
      const deadline=Date.now()+180000;
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
      while(!current.map.hostiles.length&&acceptedActions<MAX_ROUTE_ACTIONS&&Date.now()<deadline){
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
      check('Bounded original terrain and native L-validated door route acquires a visible hostile before death',
        {hostiles:current.map.hostiles,accepted_actions:acceptedActions,probe:current.probe,opened_door_coordinates:[...opened]});

    const named=await selectTarget(current);
    assert.equal(named.target.name,ja['term.being.former.name'],'Actual Japanese former human target, not an inferred glyph identity');
    assert.equal(diagnostic(named.sample.probe).sha256,current.probe.sha256,'Target observation consumes no native turn or RNG');
    current=await normal('native-target-cancelled-before-harmless-waits',await key('Escape'));
    e.encounter={target:named.target,route_actions:acceptedActions,probe:current.probe};
    const initialAmmo=weaponAmmo(current.sample.text),initialExp=current.probe.exp;
    const classify=createDeathClassifier(ja,{name:NAME});
    const witness=s=>classify({text:s.text,probe:diagnostic(s.probe)});
    const recordPhase=(phase,s)=>{
      const w=witness(s);assert.equal(w.kind,phase);
      e.actions.push({kind:'observed_native_terminal_phase',phase,witness:w,frameGeneration:s.frameGeneration,probe:diagnostic(s.probe)});
      for(const finding of w.findings)if(!e.localization_findings.some(old=>old.kind===finding.kind&&old.text===finding.text))e.localization_findings.push(finding);
      return w;
    };
    const screenshotPhase=async(phase,s,label=phase)=>{
      assert.equal(witness(s).kind,phase,'Only exact witnessed native phases receive a phase screenshot');
      assert.ok(s.paused&&s.probe&&!s.queueLength&&!s.textDeliveryPending);
      if(e.screenshots.some(value=>value.phase===label))return;
      assert.ok(/^[a-z_-]+$/.test(label));
      const shot=await cdp.call('Page.captureScreenshot',{format:'png'}),bytes=Buffer.from(shot.data,'base64');
      assert.ok(bytes.length>24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Actual Chrome PNG required');
      const file=label+'.png';await writeFile(path.join(output,file),bytes);
      e.screenshots.push({phase:label,native_phase:phase,file,size:bytes.length,sha256:sha(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),frameGeneration:s.frameGeneration,probe:diagnostic(s.probe)});
    };
    const awaitPhase=async(phase,afterFrame=-1)=>until(async()=>{
      const s=await healthy();if(!s.running||!s.paused||s.queueLength||s.textDeliveryPending||!s.probe||s.frameGeneration<=afterFrame)return false;
      return witness(s).kind===phase?s:false;
    },'Exact source-backed native terminal phase: '+phase,45000);
    let dead=null,waits=0,playerDamage=false;
    const deathDeadline=Date.now()+240000;
    while(acceptedActions<MAX_ACTIONS&&Date.now()<deathDeadline&&!dead){
      const before=current,after=await key('w','KeyW');waits++;
      const d=diagnostic(after.probe),messages=captureCombatMessages(after.text,{catalog:a.catalogs});
      assert.equal(d.x,before.probe.x,'Harmless native wait does not move the player');
      assert.equal(d.y,before.probe.y);assert.equal(d.exp,initialExp,'No combat attack or attributed kill during death waits');
      assert.ok(d.levelTime>before.probe.levelTime,'Each native wait advances genuine original time');
      playerDamage ||= d.hp<before.probe.hp&&messages.playerHits.length>0;
      e.actions.push({kind:'native_harmless_death_wait',wait:waits,costly_actions:acceptedActions,before:before.probe,after:d,messages});
      if(d.hp<=0){
        dead=await awaitPhase('death_more');await capture('exact-Japanese-native-death-before-acknowledgement',dead);break;
      }
      current=await normal('native-harmless-exposure-still-alive',after);
      assert.deepEqual(weaponAmmo(current.sample.text),initialAmmo,'Death route never fires or reloads');
    }
    assert.ok(dead,'No native death witnessed within 80 costly actions / bounded waits; do not force player death');
    assert.ok(playerDamage,'Require original translated hostile-hit message correlated with decreasing player HP before death');
    const deathWitness=recordPhase('death_more',dead);await screenshotPhase('death_more',dead);
    check('Physical original harmless waits lead to zero HP and exact Japanese native death/Enter prompt',
      {waits,costly_actions:acceptedActions,player_damage_witnessed:playerDamage,death:diagnostic(dead.probe),named_hostile:named.target,exact_enemy_uid_verified:false,exact_killer_attribution_verified:false});
    assert.ok(terminalConfirmationAllowed(deathWitness,{expected:'death_more',frameGeneration:dead.frameGeneration}));
    await key(deathWitness.confirm);
    let terminal=await until(async()=>{
      const s=await healthy();if(!s.running||!s.paused||s.queueLength||s.textDeliveryPending||!s.probe||s.frameGeneration<=dead.frameGeneration)return false;
      return ['rank_up','mortem'].includes(witness(s).kind)?s:false;
    },'Native first post-death phase is an exactly witnessed rank-up or mortem',45000),phase=witness(terminal);
    // Native HOF.RankCheck can insert exactly one rank-up layer. Every key is
    // conditioned on its complete Japanese title and both original prompts.
    if(phase.kind==='rank_up'){
      recordPhase('rank_up',terminal);await capture('native-optional-rank-up',terminal);
      assert.ok(terminalConfirmationAllowed(phase,{expected:'rank_up',frameGeneration:terminal.frameGeneration,activationFrame:dead.frameGeneration}));
      terminal=await key(phase.confirm);check('Optional source-backed Japanese rank-up layer is acknowledged once');
    }
    terminal=await awaitPhase('mortem',dead.frameGeneration);
    const mortemWitness=recordPhase('mortem',terminal);await capture('native-mortem-report-with-Japanese-body-and-full-name',terminal);await screenshotPhase('mortem',terminal);
    check('Original DSFinished produces native mortem report with exact full external name and Japanese semantic version/body marker',
      {full_external_name_preserved:true,report_title_localized:false,report_footer_localized:false,semantic_ids:mortemWitness.semantic_ids});
    const snapshot=()=>cdp.evaluate("(async()=>{const s=await drlGame.storedFiles();return s?{...s,entries:s.entries.map(e=>({...e,bytes:Array.from(e.bytes)}))}:null})()");
    // Original ScorePath is independent of ModuleUserPath; the verified browser
    // asset selects /user/score.wad, while profile/mortem stay in /user/user/drl/.
    const paths=[a.persistencePaths.mortem,a.persistencePaths.profile,a.persistencePaths.score];
    const saved=await until(async()=>{
      const s=await snapshot();
      e.last_committed_snapshot_summary=s?{format:s.format,version:s.version,entries:s.entries.map(entry=>({path:entry.path,kind:entry.kind,size:entry.bytes?.length??0,sha256:entry.sha256??null})),required_paths:paths}:null;
      return s&&paths.every(p=>s.entries.some(e=>e.kind==='file'&&e.path===p&&e.bytes.length>0))?s:false;
    },'Original mortem/profile/score files committed after native WriteMemorial');
    assert.equal(saved.version,2,'Timestamp-preserving production snapshot');
    const fileWitness=s=>paths.map(p=>{const v=s.entries.find(e=>e.kind==='file'&&e.path===p);assert.ok(v&&v.bytes.length);assert.equal(sha(v.bytes),v.sha256);return {path:p,sha256:v.sha256,size:v.bytes.length};});
    const savedFiles=fileWitness(saved),mortemFile=saved.entries.find(v=>v.path===paths[0]);
    const mortemText=Buffer.from(mortemFile.bytes).toString('utf8');
    assert.ok(mortemText.includes(NAME),'Committed native mortem retains full external name');
    assert.ok(contains(mortemText,'ローグライクの戦闘記録'),'Committed native mortem contains exact Japanese report marker');
    for(const p of paths.slice(1)){
      const old=a.fixture.entries.find(e=>e.kind==='file'&&e.path===p),now=savedFiles.find(e=>e.path===p);
      assert.ok(!old||old.sha256!==now.sha256,'Original death creates/changes native '+p);
    }
    assert.ok(!saved.entries.some(v=>v.kind==='file'&&v.path==='/user/user/drl/save'),'Consumed native run cannot be resumed after death');
    await writeFile(path.join(output,'native-death-snapshot.json'),JSON.stringify(saved));
    e.persistence={saved_files:savedFiles,full_external_name_in_mortem:true,native_xml_and_score_wad_not_reinterpreted:true};
    check('Native WriteMemorial changes profile and score files, writes mortem, and production storage commits all three',
      {files:savedFiles,save_absent:true});
    assert.ok(terminalConfirmationAllowed(mortemWitness,{expected:'mortem',frameGeneration:terminal.frameGeneration,activationFrame:dead.frameGeneration}));
    const mortemFrame=terminal.frameGeneration;await key(mortemWitness.confirm);
    terminal=await awaitPhase('hall_of_fame',mortemFrame);
    const hallWitness=recordPhase('hall_of_fame',terminal);await capture('native-post-death-hall-of-fame',terminal);await screenshotPhase('hall_of_fame',terminal);
    check('Original post-death hall of fame displays the native 17-byte name field',
      {external_name:NAME,displayed_name:hallWitness.displayed_name,native_display_cropped:hallWitness.native_name_display_cropped});
    assert.ok(terminalConfirmationAllowed(hallWitness,{expected:'hall_of_fame',frameGeneration:terminal.frameGeneration,activationFrame:mortemFrame}));
    const hallFrame=terminal.frameGeneration;await key(hallWitness.confirm);
    terminal=await awaitPhase('main_menu',hallFrame);recordPhase('main_menu',terminal);await capture('native-returned-to-main-menu-after-death',terminal);
    check('Native death/report sequence returns to the original Japanese menu with no live player');
    const openMenuReport=async(index,expected)=>{
      const s=await awaitPhase('main_menu');recordPhase('main_menu',s);
      await key('Home');assert.equal(witness(await settle()).kind,'main_menu');
      for(let n=0;n<index;n++){await key('ArrowDown');assert.equal(witness(await settle()).kind,'main_menu');}
      const before=await settle();await key('Enter');
      const view=await awaitPhase(expected,before.frameGeneration);recordPhase(expected,view);await capture('fresh-native-'+expected,view);if(expected==='profile')await screenshotPhase('profile',view);return view;
    };
    let profileView=await openMenuReport(2,'profile');await key(recordPhase('profile',profileView).confirm);
    await awaitPhase('main_menu',profileView.frameGeneration);
    check('Original Japanese player profile opens from the returned native menu');
    // Fresh page creates new Pascal/Lua and Rust instances; reuse only the
    // production committed files. Never restore the old alive fixture here.
    await navigate();assert.equal((await healthy()).resumeEnabled,true);
    await cdp.evaluate("document.querySelector('#resume').click()");
    const logoPrefix=staticText(ja['startup.logo-text'].split('{{version}}')[0]);
    for(let n=0;n<3;n++){
      const s=await settle();if(witness(s).kind==='main_menu')break;
      assert.ok(logoPrefix&&contains(s.text,logoPrefix),'Only exact native startup logo may receive its initial confirmation');
      await capture('fresh-native-startup-logo-after-death',s);await key('Enter');
    }
    terminal=await awaitPhase('main_menu');assert.equal(diagnostic(terminal.probe).playerPresent,false);
    const restored=await snapshot();assert.deepEqual(fileWitness(restored),savedFiles,'All native mortem/profile/score bytes survive a fresh browser page');
    assert.ok(!restored.entries.some(v=>v.path==='/user/user/drl/save'),'Fresh restore cannot resurrect consumed/dead native save');
    const persistedHall=await openMenuReport(1,'persisted_hall_of_fame');await key(recordPhase('persisted_hall_of_fame',persistedHall).confirm);
    await awaitPhase('main_menu',persistedHall.frameGeneration);
    profileView=await openMenuReport(2,'profile');await key(recordPhase('profile',profileView).confirm);
    terminal=await awaitPhase('main_menu',profileView.frameGeneration);await capture('fresh-native-final-menu-with-persisted-death-records',terminal);await screenshotPhase('main_menu',terminal,'fresh-final-menu');
    check('Fresh original instances reload exact native files, display persisted score and player profile, and end at the Japanese native menu',
      {files:savedFiles,save_absent:true,new_native_instances:true});
    e.original_death_report_profile_flow_verified=true;
    e.remaining_gates.push('Native paged report title/footer retain concrete English literals. Japanese phase-body guards pass independently; complete localization remains false.');
    e.remaining_gates.push('A visible named former human and hostile-hit messages precede native death; DRLP has no killer/enemy UID and exact killer attribution is not asserted. Fullworld/campaign/challenge coverage remains false.');
    assert.deepEqual(e.browser_errors,[]);e.result='pass';e.full_localization_verified=false;
  }catch(error){e.result='fail';e.error=error.stack;process.exitCode=1;
    // Diagnose through the application's production read-only storedFiles API.
    // This never forces a commit, bypasses IndexedDB, writes native files, or
    // acknowledges a prompt. Retain actual committed bytes before Chrome closes.
    if(cdp)try{
      const diagnostic=await cdp.evaluate("(async()=>{const g=window.drlGame;const s=g?await g.storedFiles():null;return {paused:g?.paused??false,running:g?.running??false,locale:g?.locale??null,frameGeneration:g?.frameGeneration??null,filesGeneration:g?.filesGeneration??null,saveGeneration:g?.saveGeneration??null,lastPresentedReceipt:g?.lastPresentedReceipt??null,status:document.querySelector('#status')?.textContent??'',snapshot:s?{...s,entries:s.entries.map(entry=>({...entry,bytes:Array.from(entry.bytes)}))}:null};})()");
      const bytes=Buffer.from(JSON.stringify({schema:1,label:'read-only production committed snapshot at browser gate failure',captured_at:new Date().toISOString(),...diagnostic},null,2));
      const file='failure-committed-snapshot.json';await writeFile(path.join(output,file),bytes);
      e.failure_committed_snapshot={file,sha256:sha(bytes),size:bytes.length,paused:diagnostic.paused,frameGeneration:diagnostic.frameGeneration,filesGeneration:diagnostic.filesGeneration,
        entries:diagnostic.snapshot?.entries?.map(entry=>({path:entry.path,kind:entry.kind,size:entry.bytes?.length??0,sha256:entry.sha256??null}))??null};
    }catch(captureError){e.failure_committed_snapshot_error=captureError.stack;}
    if(cdp)try{const p=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'failure.png'),Buffer.from(p.data,'base64'));}catch{}
  }finally{
    if(cdp)await cdp.call('Browser.close').catch(()=>{});socket?.close();
    if(chrome){for(let n=0;n<20&&chrome.exitCode===null;n++)await pause(100);if(chrome.exitCode===null)chrome.kill();}
    if(server)await new Promise(r=>server.close(r));
    if(profile){const p=path.resolve(profile),temp=path.resolve(os.tmpdir())+path.sep;
      assert.ok(p.startsWith(temp)&&path.basename(p).startsWith('drl-original-death-'));await rm(p,{recursive:true,force:true,maxRetries:8,retryDelay:200}).catch(error=>{e.cleanup_error=error.code;});}
    e.finished_at=new Date().toISOString();await writeFile(path.join(output,'evidence.json'),JSON.stringify(e,null,2));
  }
  console.log(JSON.stringify({result:e.result,checks:e.checks.length,localization_findings:e.localization_findings,remaining:e.remaining_gates,output}));return e;
}
async function selfTest(){
  const a=await fixtureAndArtifacts();assert.equal(a.fixture.version,2);
  createDeathClassifier(a.catalogs.ja,{name:NAME});
  console.log(JSON.stringify({result:'pass',scope:'Current asset/native fixture/phase-construction checks only; no Chrome or native core execution',fixture_sha256:a.fixture_sha256,core:a.build.core.sha256,adapter:a.build.adapter.sha256,persistence_paths:a.persistencePaths,recording_policy:a.recordingPolicy,max_costly_actions:MAX_ACTIONS,max_route_actions:MAX_ROUTE_ACTIONS}));
}
if(process.argv.includes('--self-test'))await selfTest();else await suite();
