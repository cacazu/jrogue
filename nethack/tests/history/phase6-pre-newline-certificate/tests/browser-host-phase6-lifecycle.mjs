/* Test-only CDP response instrumentation; never writes any staged runtime file. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const appAnchor="  const layout = JSON.parse(module.ccall('nh_abi_layout_json','string',[],[]));";

function observeCatalogCalls(m) {
  // No field, event, name, engine, memory, or RNG queries: lifecycle metadata only.
  const trace=globalThis.__phase6CatalogTrace??= {schema:1,phase:'startup',serial:0,ordinal:0,lifecycle:[],renderCounts:{},errors:[]};
  const serial=++trace.serial,original=m.ccall;
  const record=value=>{if(trace.lifecycle.length<4096)trace.lifecycle.push(value);else if(!trace.errors.includes('lifecycle-bound'))trace.errors.push('lifecycle-bound');};
  m.ccall=function(...args) {
    let result;
    try { result=Reflect.apply(original,this,args); }
    catch(error) {
      try { if(['nh_rust_catalog_register','nh_rust_catalog_release','nh_rust_format_registered'].includes(args[0]))record({serial,ordinal:++trace.ordinal,phase:trace.phase,export:args[0],threw:true}); } catch {}
      throw error;
    }
    try {
      const [name,,,values]=args;
      if(name==='nh_rust_catalog_register')record({serial,ordinal:++trace.ordinal,phase:trace.phase,export:name,inputBytes:values?.[1],handle:result});
      else if(name==='nh_rust_catalog_release')record({serial,ordinal:++trace.ordinal,phase:trace.phase,export:name,handle:values?.[0],result});
      else if(name==='nh_rust_format_registered') {
        const key=JSON.stringify([serial,trace.phase,values?.[0],values?.[3],values?.[4]]);
        if(Object.hasOwn(trace.renderCounts,key)||Object.keys(trace.renderCounts).length<512)trace.renderCounts[key]=(trace.renderCounts[key]??0)+1;
        else if(!trace.errors.includes('render-count-bound'))trace.errors.push('render-count-bound');
      }
    } catch { if(trace.errors.length<16)trace.errors.push('observer-metadata-error'); }
    return result;
  };
}

export const observerSource=`(${observeCatalogCalls.toString()})(module);`;
export const insertion=`  /* TEST ONLY: transparent lifecycle metadata observer; not a product patch. */\n  ${observerSource}\n`;

export async function installLifecycleOverlay(cdp,url,stage) {
  stage.requireExecution();
  const appUrl=new URL('app.mjs',url).href;
  const expected=stage.artifacts.find(item=>item.name==='app.mjs');assert.ok(expected);
  const evidence={testOnly:true,appUrl,expectedOriginalSha256:expected.sha256,anchor:appAnchor,exactInsertion:insertion,observerSource,overlays:[],errors:[]};
  cdp.on('Fetch.requestPaused',async request=>{
    try {
      assert.equal(request.request.url,appUrl,'Only the exact staged app response may be overlaid');
      assert.equal(request.responseStatusCode,200);
      const response=await cdp.send('Fetch.getResponseBody',{requestId:request.requestId});
      const original=Buffer.from(response.body,response.base64Encoded?'base64':'utf8');
      assert.equal(hash(original),expected.sha256,'Fetched app must match frozen runtime hash before instrumentation');
      const text=original.toString('utf8');
      assert.equal(text.split(appAnchor).length,2,'Lifecycle insertion anchor must occur exactly once');
      const overlaid=Buffer.from(text.replace(appAnchor,insertion+appAnchor),'utf8');
      assert.equal(evidence.overlays.length,0,'One initial app response per fixture only');
      evidence.overlays.push({originalBytes:original.length,originalSha256:hash(original),servedOverlayBytes:overlaid.length,servedOverlaySha256:hash(overlaid),exactPatch:{insertBefore:appAnchor,text:insertion}});
      const headers=(request.responseHeaders??[]).filter(item=>!['content-length','content-encoding'].includes(item.name.toLowerCase()));
      headers.push({name:'Content-Length',value:String(overlaid.length)});
      await cdp.send('Fetch.fulfillRequest',{requestId:request.requestId,responseCode:200,responsePhrase:request.responseStatusText??'OK',responseHeaders:headers,body:overlaid.toString('base64')});
    } catch(error) {
      evidence.errors.push(error.stack);
      await cdp.send('Fetch.failRequest',{requestId:request.requestId,errorReason:'BlockedByClient'}).catch(()=>{});
    }
  });
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:appUrl,requestStage:'Response'}]});
  return evidence;
}

export async function catalogTrace(page) {return page.cdp.evaluate('structuredClone(window.__phase6CatalogTrace??null)');}

export function assertStartupTrace(trace,serial=1) {
  assert.ok(trace);assert.deepEqual(trace.errors,[]);
  const lifecycle=trace.lifecycle.filter(item=>item.serial===serial);
  const registrations=lifecycle.filter(item=>item.export==='nh_rust_catalog_register');
  assert.equal(registrations.length,2,'UI and gameplay catalogs each register once for this module');
  assert.ok(registrations.every(item=>item.handle>0&&!item.phase.startsWith('repaint:')&&item.inputBytes>0));
  assert.equal(new Set(registrations.map(item=>item.handle)).size,2);
  assert.equal(lifecycle.filter(item=>item.export==='nh_rust_catalog_release').length,0,'Active module catalogs remain owned');
  return {serial,uiHandle:registrations[0].handle,gameplayHandle:registrations[1].handle,registrations};
}

export function assertReplacementTrace(trace) {
  assert.equal(trace.serial,2,'Same-page restore constructs exactly one replacement module');assert.deepEqual(trace.errors,[]);
  const old=trace.lifecycle.filter(item=>item.serial===1),next=trace.lifecycle.filter(item=>item.serial===2);
  const registrations=old.filter(item=>item.export==='nh_rust_catalog_register'),releases=old.filter(item=>item.export==='nh_rust_catalog_release');
  assert.equal(registrations.length,2);assert.equal(releases.length,2);
  assert.deepEqual(releases.map(item=>item.handle).sort((a,b)=>a-b),registrations.map(item=>item.handle).sort((a,b)=>a-b));
  assert.ok(releases.every(item=>item.result===0&&!item.phase.startsWith('repaint:')));
  assert.equal(next.filter(item=>item.export==='nh_rust_catalog_register').length,2);
  assert.ok(Math.max(...releases.map(item=>item.ordinal))<Math.min(...next.map(item=>item.ordinal)),'Both old catalogs release before replacement registrations');
  return {oldReleases:releases,replacement:assertStartupTrace(trace,2)};
}

export async function repaintOneHundred(page,stage,{label='history',instrumented=false}={}) {
  stage.requireExecution();assert.equal(stage.renderExport,'nh_rust_format_registered');
  const preparation=await page.cdp.evaluate(`(async()=>{
    const t=window.netHackTest,m=t.module;
    const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
    const owned=()=>JSON.stringify({history:t.host.history,frame:t.getFrame(),queue:t.host.inbox.queue,consumed:t.host.inbox.consumedTotal,pending:t.host.pendingKind,drafts:Array.from(document.querySelectorAll('input,textarea,select')).map(el=>({type:el.type,value:el.value,checked:el.checked,start:el.selectionStart,end:el.selectionEnd}))});
    const focus=()=>{let el=document.activeElement;const path=[];while(el&&el!==document.documentElement){if(el.id){path.unshift('#'+el.id);break;}const peers=el.parentElement?Array.from(el.parentElement.children).filter(peer=>peer.tagName===el.tagName):[];path.unshift(el.tagName.toLowerCase()+':nth-of-type('+(peers.indexOf(el)+1)+')');el=el.parentElement;}return path.join('>');};
    const dom=()=>JSON.stringify({html:document.documentElement.outerHTML,controls:Array.from(document.querySelectorAll('input,textarea,select')).map(el=>({type:el.type,value:el.value,checked:el.checked,start:el.selectionStart,end:el.selectionEnd})),focus:focus(),canvas:document.querySelector('#canvas').toDataURL(),translations:Array.from(document.querySelectorAll('[data-translation]')).map(el=>({id:el.dataset.semanticTextId,translation:el.dataset.translation,text:el.textContent})),scroll:{x:scrollX,y:scrollY,mapX:document.querySelector('#map-viewport').scrollLeft,mapY:document.querySelector('#map-viewport').scrollTop,messages:document.querySelector('#messages').scrollTop,modal:document.querySelector('#modal').scrollTop,modalBody:document.querySelector('#modal-body').scrollTop}});
    const native=()=>({state:m.ccall('nh_abi_state_json','string',[],[]),raw:m.ccall('nh_abi_state_checksum','number',[],[])>>>0,world:m.ccall('nh_abi_world_checksum','number',[],[])>>>0,rng:m.ccall('nh_abi_rng_checksum','number',[],[])>>>0});
    const baseline=owned(),state=native(),focusBefore=focus(),traceBefore=${instrumented}?structuredClone(window.__phase6CatalogTrace):null;
    if(${instrumented}){if(!traceBefore)throw Error('Missing startup observer');window.__phase6CatalogTrace.phase='repaint:prepare:'+${JSON.stringify(label)};}
    const expected={},original=m.ccall,preparationCalls=[];
    m.ccall=function(...args){preparationCalls.push(args[0]);return Reflect.apply(original,this,args);};
    try{for(const locale of ['en','ja']){
      t.setLocale(locale);t.repaint();
      if(owned()!==baseline)throw Error('Initial locale switch changed owned history/frame/input');
      if(focus()!==focusBefore)throw Error('Initial locale switch changed active control identity');
      expected[locale]=dom();
    }}finally{m.ccall=original;}
    if(preparationCalls.length===0||preparationCalls.some(name=>name!==${JSON.stringify(stage.renderExport)}))throw Error('Initial locale switch called an unapproved export: '+JSON.stringify([...new Set(preparationCalls)]));
    if(JSON.stringify(native())!==JSON.stringify(state))throw Error('Initial locale switch changed original C/world/RNG');
    if(${instrumented}){
      if(JSON.stringify(window.__phase6CatalogTrace.lifecycle)!==JSON.stringify(traceBefore.lifecycle))throw Error('Initial locale switch registered or released a catalog');
      window.__phase6CatalogTrace.phase='repaint:'+${JSON.stringify(label)};
    }
    window.__phase6RepaintFixture={expected,baseline,state,owned,dom,native,digest};
    return {before:state,ownedSha256:await digest(baseline),historyRecords:t.host.history.length,expectedDomSha256:{en:await digest(expected.en),ja:await digest(expected.ja)},focusBefore,preparationFormatterCalls:preparationCalls.length,preparationCalledExports:[...new Set(preparationCalls)]};
  })()`);
  const started=Date.now(),batches=[];
  try {
    for(let start=0;start<100;start+=10) {
      const batch=await page.cdp.evaluate(`(()=>{
        const t=window.netHackTest,m=t.module,f=window.__phase6RepaintFixture,original=m.ccall,calls=[];
        m.ccall=function(...args){calls.push(args[0]);return Reflect.apply(original,this,args);};
        const began=performance.now();
        try{for(let i=${start};i<${start+10};i++){
          const locale=i%2?'ja':'en';t.setLocale(locale);t.repaint();
          if(f.dom()!==f.expected[locale])throw Error('Full DOM/rendered text/fallback/draft differs at transition '+i);
          if(f.owned()!==f.baseline)throw Error('Immutable history/frame/input changed at transition '+i);
        }}finally{m.ccall=original;}
        return {start:${start},transitions:10,durationMs:performance.now()-began,calls};
      })()`);
      assert.ok(batch.calls.length>0&&batch.calls.every(name=>name===stage.renderExport),`Repaint queried an unapproved export: ${JSON.stringify([...new Set(batch.calls)])}`);
      batches.push({start:batch.start,transitions:10,durationMs:batch.durationMs,formatterCalls:batch.calls.length,calledExports:[...new Set(batch.calls)]});
    }
    const completion=await page.cdp.evaluate(`(async()=>{const f=window.__phase6RepaintFixture;return {after:f.native(),ownedSha256:await f.digest(f.owned()),locale:window.netHackTest.locale};})()`);
    assert.deepEqual(completion.after,preparation.before,'C/world/RNG changed during 100 locale transitions');
    assert.equal(completion.ownedSha256,preparation.ownedSha256);assert.equal(completion.locale,'ja');
    const trace=instrumented?await catalogTrace(page):null;
    if(trace){assert.deepEqual(trace.errors,[]);assert.ok(!trace.lifecycle.some(item=>item.phase===`repaint:${label}`),'Catalog lifecycle operation happened during repaint');}
    return {...preparation,...completion,iterations:100,durationMs:Date.now()-started,batches,formatterCalls:batches.reduce((n,item)=>n+item.formatterCalls,0),calledExports:[stage.renderExport],fullDomAndFallbackEveryTransition:true,completeOwnedHistoryRetained:true,initialSwitchInvariantVerified:true,lifecycleDuringRepaint:0,timingScope:'End-to-end locale+render+full DOM/canvas/history checks, not formatter-only; no legacy comparator or speedup claim'};
  } finally {
    await page.cdp.evaluate(`(()=>{delete window.__phase6RepaintFixture;if(window.__phase6CatalogTrace)window.__phase6CatalogTrace.phase='fixture';})()`).catch(()=>{});
  }
}

/** Guard the earliest exact EN/JA frame paints as well as the later100 loop. */
export async function paintLocale(page,stage,locale,{instrumented=false}={}) {
  stage.requireExecution();assert.ok(['en','ja'].includes(locale));
  const evidence=await page.cdp.evaluate(`(()=>{
    const t=window.netHackTest,m=t.module;
    const focus=()=>{let el=document.activeElement;const path=[];while(el&&el!==document.documentElement){if(el.id){path.unshift('#'+el.id);break;}const peers=el.parentElement?Array.from(el.parentElement.children).filter(peer=>peer.tagName===el.tagName):[];path.unshift(el.tagName.toLowerCase()+':nth-of-type('+(peers.indexOf(el)+1)+')');el=el.parentElement;}return path.join('>');};
    const owned=()=>JSON.stringify({history:t.host.history,frame:t.getFrame(),queue:t.host.inbox.queue,consumed:t.host.inbox.consumedTotal,pending:t.host.pendingKind,focus:focus(),drafts:Array.from(document.querySelectorAll('input,textarea,select')).map(el=>({type:el.type,value:el.value,checked:el.checked,start:el.selectionStart,end:el.selectionEnd}))});
    const native=()=>({state:m.ccall('nh_abi_state_json','string',[],[]),raw:m.ccall('nh_abi_state_checksum','number',[],[])>>>0,world:m.ccall('nh_abi_world_checksum','number',[],[])>>>0,rng:m.ccall('nh_abi_rng_checksum','number',[],[])>>>0});
    const before=owned(),state=native(),trace=${instrumented}?window.__phase6CatalogTrace:null,phase=trace?.phase,lifecycle=trace?JSON.stringify(trace.lifecycle):null,calls=[],original=m.ccall;
    if(${instrumented}&&!trace)throw Error('Missing first-paint lifecycle observer');
    if(trace)trace.phase='repaint:exact-frame:'+${JSON.stringify(locale)};
    m.ccall=function(...args){calls.push(args[0]);return Reflect.apply(original,this,args);};
    try{t.setLocale(${JSON.stringify(locale)});t.repaint();}finally{m.ccall=original;if(trace)trace.phase=phase;}
    if(owned()!==before)throw Error('Exact-frame locale paint changed owned records/input/draft');
    const after=native();if(JSON.stringify(after)!==JSON.stringify(state))throw Error('Exact-frame locale paint changed C/world/RNG');
    if(trace&&JSON.stringify(trace.lifecycle)!==lifecycle)throw Error('Exact-frame locale paint registered/released a catalog');
    return {locale:${JSON.stringify(locale)},calls,before:state,after,ownedUnchanged:true,lifecycleUnchanged:true};
  })()`);
  assert.ok(evidence.calls.length>0&&evidence.calls.every(name=>name===stage.renderExport),'First exact-frame paint may only use registered rendering');
  return evidence;
}
