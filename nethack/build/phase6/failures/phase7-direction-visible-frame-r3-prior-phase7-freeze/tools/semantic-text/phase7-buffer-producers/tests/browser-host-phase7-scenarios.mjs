/* Added 2026-10-02, NGPL. Prepared adapters, never executed at import.
 * Parent supplies an already-started authorized isolated page and stage.
 * No compiler, server, Chrome, native flags or game fields are started/edited.
 */
import assert from 'node:assert/strict';
import {click,delay,key,waitFor} from '../../../../tests/browser-host-semantic-cdp.mjs';

const commandReady="window.netHackTest?.host?.pendingKind==='command'&&window.netHackTest.getFrame().cells.length>0";
const openMenu="window.netHackTest?.host?.pendingKind==='menu'&&document.querySelector('#modal').open";
const marker='__phase7BufferQA';
const serialized=value=>JSON.stringify(value);

export async function installPhase7Observer(page,stage) {
  stage.requireExecution();
  return page.cdp.evaluate(`(() => {
    if(window.${marker})throw Error('Phase7 observer already installed on this page');
    const m=window.netHackTest.module,original=window.__jrogueNetHackShim;
    if(typeof original!=='function'||typeof m._nh_abi_semantic_event!=='function')throw Error('Native callback/getter unavailable');
    const surfaces={shim_putstr:2,shim_add_menu:7,shim_end_menu:1,shim_raw_print:0,shim_raw_print_bold:0,shim_yn_function:0,shim_getlin:0};
    const windows=new Set(['shim_putstr','shim_add_menu','shim_end_menu']);
    const qa=window.${marker}={callbacks:[],captures:[],getterCalls:0,dropped:0};
    window.__jrogueNetHackShim=async(name,...args)=>{
      if(Object.hasOwn(surfaces,name)) {
        const windowId=windows.has(name)?args[0]:-1;
        const sourceText=String(args[surfaces[name]]??'');
        const json=m.ccall('nh_abi_semantic_event','string',['string','number'],[name,windowId]);qa.getterCalls++;
        const envelope=json?JSON.parse(json):null;
        if(envelope) {
          const wrong=m.ccall('nh_abi_semantic_event','string',['string','number'],[name,windowId+0x400000]);qa.getterCalls++;
          if(wrong)throw Error('Native descriptor leaked to a wrong window');
          const other=m.ccall('nh_abi_semantic_event','string',['string','number'],['phase7_wrong_callback',windowId]);qa.getterCalls++;
          if(other)throw Error('Native descriptor leaked to a wrong callback');
        }
        const row={callback:name,window:windowId,sourceText,attr:name==='shim_putstr'?args[1]:name==='shim_add_menu'?args[5]:null,envelope};
        if(qa.callbacks.length<20480&&sourceText.length<=65536)qa.callbacks.push(row);else qa.dropped++;
        if(envelope) {if(qa.captures.length<4096)qa.captures.push(structuredClone(row));else qa.dropped++;}
      }
      return await original(name,...args);
    };
    return {installed:true,actualCallbacksOnly:true};
  })()`);
}

async function captureIndex(page) {return page.cdp.evaluate(`window.${marker}.captures.length`);}
async function callbackIndex(page) {return page.cdp.evaluate(`window.${marker}.callbacks.length`);}
async function capturesAfter(page,index) {return page.cdp.evaluate(`window.${marker}.captures.slice(${index})`);}
async function nativeInput(page,value) {await page.cdp.evaluate("document.querySelector('#canvas').focus()");await key(page,value);}

async function state(page) {
  return page.cdp.evaluate(`(() => {const t=window.netHackTest,m=t.module;
    const focus=()=>{let el=document.activeElement;const path=[];while(el&&el!==document.documentElement){if(el.id){path.unshift('#'+el.id);break;}const peers=el.parentElement?Array.from(el.parentElement.children).filter(peer=>peer.tagName===el.tagName):[];path.unshift(el.tagName.toLowerCase()+':nth-of-type('+(peers.indexOf(el)+1)+')');el=el.parentElement;}return path.join('>');};
    return {
    state:JSON.parse(m.ccall('nh_abi_state_json','string',[],[])),
    raw:m.ccall('nh_abi_state_checksum','number',[],[])>>>0,
    world:m.ccall('nh_abi_world_checksum','number',[],[])>>>0,
    rng:m.ccall('nh_abi_rng_checksum','number',[],[])>>>0,
    inputs:t.host.inbox.consumedTotal,queued:t.host.inbox.queue.length,pending:t.host.pendingKind,
    frame:JSON.stringify(t.getFrame()),
    history:JSON.stringify(t.host.history),
    activeControl:focus(),
    callbacks:window.${marker}.callbacks.length,captures:window.${marker}.captures.length,getterCalls:window.${marker}.getterCalls,
    draft:Array.from(document.querySelectorAll('#modal input')).map(el=>({type:el.type,value:el.value,checked:el.checked,start:el.selectionStart,end:el.selectionEnd})),
    failures:{capture:t.diagnostics.semanticCaptureFailures,formatting:t.diagnostics.semanticFormattingFailures},
  };})()`);
}

export async function assertPhase7RepaintInvariant(page,stage,label='phase7-buffer') {
  stage.requireExecution();
  assert.equal(stage.renderExport,'nh_rust_format_registered','Explicit immutable-catalog stage capability is required');
  assert.equal(typeof stage.repaintInvariant,'function','Phase6/7 requires the shared bounded full-DOM/history/fallback repaint observer');
  const before=await state(page);
  const shared=await stage.repaintInvariant(page,label);
  assert.equal(shared.iterations,100);
  assert.equal(shared.batches.length,10);
  assert.deepEqual(shared.batches.map(batch=>[batch.start,batch.transitions]),Array.from({length:10},(_,index)=>[index*10,10]));
  assert.equal(shared.batches.reduce((count,batch)=>count+batch.transitions,0),100);
  assert.equal(shared.fullDomAndFallbackEveryTransition,true);
  assert.equal(shared.completeOwnedHistoryRetained,true);
  assert.equal(shared.initialSwitchInvariantVerified,true);
  assert.deepEqual(shared.calledExports,[stage.renderExport]);
  assert.deepEqual(shared.preparationCalledExports,[stage.renderExport]);
  assert.ok(shared.preparationFormatterCalls>0);
  for(const batch of shared.batches)assert.deepEqual(batch.calledExports,[stage.renderExport]);
  const after=await state(page);
  assert.deepEqual(after,before,'Locale/repaint or first shared preparation changed native state/RNG/input/history/owned records/drafts/observer counters');
  const outside=await page.cdp.evaluate(`(() => {const m=window.netHackTest.module,pairs=new Map(window.${marker}.captures.map(row=>[row.callback+':'+row.window,[row.callback,row.window]]));pairs.set('shim_end_menu:-1',['shim_end_menu',-1]);return Array.from(pairs.values(),pair=>({pair,value:m.ccall('nh_abi_semantic_event','string',['string','number'],pair)}));})()`);
  assert.ok(outside.every(row=>!row.value),'Descriptor remained visible outside accepted callbacks with its actual callback/window');
  return {before,after,repaintCycles:100,sharedFullDomHistoryFallback:shared,calledExports:[stage.renderExport],outsideGetter:outside};
}

function expectedPlain(branch,event,locale) {
  const template=branch[locale];
  return template.replace(/\{(arg_[0-9]+):(%(?:ld|[scdu]))\}/g,(_,name,format)=>{
    const arg=event.args[name];assert.ok(arg);
    if(format==='%s'){assert.equal(arg.type,'text');return arg.value;}
    assert.ok(Number.isInteger(arg.value));
    if(format==='%c')return String.fromCharCode(arg.value&255);
    assert.equal(arg.type,format==='%u'?'unsigned':'integer');return String(arg.value);
  });
}

async function assertVisibleFrame(page,stage,capture) {
  const owner=stage.sourceOwner(capture);
  const branch=stage.byId.get(owner.id);
  assert.equal(capture.envelope.context.api,branch.producer_line===536?'add_menu_str':branch.consumer_line===1098?'pline1':'putstr');
  assert.equal(capture.envelope.context.helperVariant,'plain');
  assert.equal(capture.sourceText,expectedPlain(branch,capture.envelope.event,'en'),'Captured English differed from the exact original source format');
  const framePreparationBefore=await state(page),framePreparation=[];
  async function rendered(locale) {
    const result=await page.cdp.evaluate(`(() => {
      const m=window.netHackTest.module,original=m.ccall,calls=[];
      m.ccall=function(...args){calls.push(args[0]);return Reflect.apply(original,this,args);};
      try{window.netHackTest.setLocale(${serialized(locale)});window.netHackTest.repaint();}
      finally{m.ccall=original;}
      return {calls,texts:Array.from(document.querySelectorAll('[data-semantic-text-id]')).filter(el=>el.dataset.semanticTextId===${serialized(owner.id)}).map(el=>({text:el.textContent,translation:el.dataset.translation}))};
    })()`);
    assert.ok(result.calls.length>0&&result.calls.every(name=>name===stage.renderExport),'First expected-frame locale paint called an unapproved export');
    const after=await state(page);assert.deepEqual(after,framePreparationBefore,'First expected-frame paint changed native/history/input/owned/draft/observer state');
    const texts=result.texts;
    const expected=expectedPlain(branch,capture.envelope.event,locale);
    assert.ok(texts.some(row=>row.text===expected),`Expected exact ${locale} source frame on the active native UI: ${serialized(texts)}`);
    framePreparation.push({locale,formatterCalls:result.calls.length,calledExports:[...new Set(result.calls)],before:framePreparationBefore,after});
    return {expected,texts};
  }
  const english=await rendered('en');assert.equal(english.expected,capture.sourceText);
  const japanese=await rendered('ja');
  const invariance=await assertPhase7RepaintInvariant(page,stage,`phase7:${owner.id}`);
  return {owner,capture,english,japanese,framePreparationPaints:2,framePreparation,invariance};
}

async function dismissToCommand(page) {
  for(let n=0;n<30;n++) {
    if(await page.cdp.evaluate(commandReady))return;
    if(await page.cdp.evaluate("document.querySelector('#modal').open"))await key(page,'Escape');
    await delay(50);
  }
  throw Error('Original command did not return to command wait');
}

async function openExtendedList(page) {
  await waitFor(page,commandReady);
  await nativeInput(page,'#');
  await waitFor(page,"window.netHackTest.host.pendingKind==='extended'&&document.querySelector('#modal').open");
  await click(page,'.text-editor');await page.cdp.send('Input.insertText',{text:'?'});await key(page,'Enter');
  await waitFor(page,openMenu);
}

export async function runPhase7CommandFootnote(page,stage) {
  stage.requireExecution();
  const branch=stage.plan.branches.find(row=>row.source==='src/cmd.c'&&row.producer_line===536);
  const evidence=[];
  // Two actual calls reuse the same source scope independently; no raw pointer
  // address or same-byte alias certificate is inferred from this browser test.
  for(let repeat=0;repeat<2;repeat++) {
    const before=await captureIndex(page);
    await openExtendedList(page);
    const matches=(await capturesAfter(page,before)).filter(row=>row.envelope.event.id===branch.id);
    assert.equal(matches.length,1,'Original no-search command list emits one footnote');
    evidence.push(await assertVisibleFrame(page,stage,matches[0]));
    await dismissToCommand(page);
  }
  return {status:'actual-native-producer-candidate',originalCommand:'#?',independentInvocations:evidence};
}

export async function runPhase7NativeSearchFilter(page,stage) {
  stage.requireExecution();
  await openExtendedList(page);
  await page.cdp.evaluate("window.netHackTest.setLocale('en')");
  // English here selects an already-visible original test control. Production
  // source IDs are never inferred from English, and no descriptor is installed.
  const searchIndex=await page.cdp.evaluate("Array.from(document.querySelectorAll('.menu-row')).findIndex(row=>row.textContent.includes('Search extended commands'))");
  assert.ok(searchIndex>=0);
  const before=await captureIndex(page),callbacksBefore=await callbackIndex(page);
  await page.cdp.evaluate(`document.querySelectorAll('.menu-row')[${searchIndex}].dataset.phase7Search='true'`);
  await click(page,'[data-phase7-search] input');
  await waitFor(page,"window.netHackTest.host.pendingKind==='text'&&document.querySelector('#modal').open");
  await click(page,'.text-editor');await page.cdp.send('Input.insertText',{text:'Phase7NoCommandMatch_9eaf'});await key(page,'Enter');
  await waitFor(page,openMenu);
  const captures=await capturesAfter(page,before);
  const callbacks=await page.cdp.evaluate(`window.${marker}.callbacks.slice(${callbacksBefore})`);
  const id=stage.plan.branches.find(row=>row.producer_line===536).id;
  assert.ok(!captures.some(row=>row.envelope.event.id===id),'Original no-match branch emitted a suppressed footnote');
  assert.ok(callbacks.some(row=>row.callback==='shim_add_menu'&&row.sourceText==='no matches'),'Actual original no-match path reached its accepted menu row');
  const invariance=await assertPhase7RepaintInvariant(page,stage);
  await dismissToCommand(page);
  return {status:'actual-native-filter-candidate',captures,callbacks,invariance};
}

export async function runPhase7DirectionCharacter(page,stage) {
  stage.requireExecution();
  await waitFor(page,commandReady);
  const before=await captureIndex(page);
  // Only pager.c doidtrap passes getdir("^"). Ordinary open/direction commands
  // pass a different prompt and will not select this original %c explanation.
  await nativeInput(page,'^');
  await waitFor(page,"window.netHackTest.host.pendingKind==='question'&&document.querySelector('#modal').open");
  await key(page,'p');
  await waitFor(page,"window.netHackTest.host.pendingKind==='display'&&document.querySelector('#modal').open");
  const branch=stage.plan.branches.find(row=>row.source==='src/cmd.c'&&row.producer_line===4258);
  const matches=(await capturesAfter(page,before)).filter(row=>row.envelope.event.id===branch.id);
  assert.equal(matches.length,1,'Original help_dir must actually select the %c frame; enable cmdassist through original pre-main options');
  assert.equal(matches[0].envelope.event.args.arg_1.value,80,'Original highc selected ASCII P once');
  const evidence=await assertVisibleFrame(page,stage,matches[0]);
  await dismissToCommand(page);
  return {status:'actual-native-producer-candidate',originalCommand:'^ then p',evidence};
}

export async function phase7PendingEvidence(stage) {
  const pending=stage.plan.branches.filter(row=>row.actual_native_browser_status==='blocked-original-debug-policy');
  assert.equal(pending.length,5);
  return {status:'pending',branches:pending.map(({id,source,producer_line,consumer_line})=>({id,source,producer_line,consumer_line})),reason:'Original Emscripten getpwnam/getpwuid stubs do not authorize -D; no identity/wizard/core/save bypass. Compiled fixture values cannot replace original native branch proof.'};
}

export async function phase7FinalObserverEvidence(page,stage) {
  stage.requireExecution();
  const result=await page.cdp.evaluate(`({dropped:window.${marker}.dropped,callbacks:window.${marker}.callbacks.length,captures:window.${marker}.captures.length,phase:window.netHackTest.phase,failures:window.netHackTest.diagnostics.semanticCaptureFailures})`);
  assert.equal(result.dropped,0,'Bounded observer dropped evidence');
  assert.notEqual(result.phase,'error');
  await stage.verifyUnchanged();
  return result;
}
