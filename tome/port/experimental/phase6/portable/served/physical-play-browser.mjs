// SPDX-License-Identifier: GPL-3.0-or-later
// Source-only combined increment. The original C/Lua VM owns every game action,
// the baseline visual frame, its RNG, and full game/world serialization. Rust
// owns input mapping and immutable HUD/dialog projections; it is not a new game.
import nativeFactory from '/native/tome-native.mjs';
import {mountOriginalInputs} from '/bootstrap/browser_vfs_mounts.mjs';
import {createRetainedBrowserSession} from '/rust/retained-browser-session.mjs';
import {renderDiagnostic} from '/rust/diagnostic-renderer.mjs';
import {NativeCoreError} from '/rust/original-native-core.mjs';
import {createSemanticTextWasm} from '/semantic/semantic-text-wasm.mjs';
import {installNativeSemanticBridge} from '/semantic/native-semantic-bridge.mjs';
import {OriginalCheckpointStore} from '/checkpoint/checkpoint_store.mjs';
import {actualNativeArchiveValidator} from '/checkpoint/native_archive_validator.mjs';
import {saveBaselineCheckpoint} from '/checkpoint/baseline_flow.mjs';
import {PhysicalPlayOwner} from '/physical/physical-play-owner.mjs';

const root=document.querySelector('#play'),canvas=document.querySelector('#original');
const saveButton=document.querySelector('#save'),saveStatus=document.querySelector('#save-status');
const resumeLink=document.querySelector('#resume-comparison'),diagnostics=document.querySelector('#diagnostics');
const log=document.querySelector('#log'),nativeCalls={},pendingCalls={},lines=[];
const requestedName=new URL(location.href).searchParams.get('name');
const report=window.tomePlayReport={completed:false,passed:false,phase:'catalogues',
  document_time_origin:performance.timeOrigin,
  mode:'isolated_original_physical_input_candidate',complete_game_ui:false,complete_campaign_verified:false,
  renderer:'effectful_original_baseline_frame_with_Rust_HUD_and_supported_dialog_projection',
  renderer_purity_claim:false,save_mode:'baseline_original_checkpoint',
  requested_original_locale:'ja_JP',original_locale:null,projection_locale:'ja',lifecycle:[],
  resume:{route:'/baseline-save-resume.html?resume=1',kind:'separate_diagnostic_comparison',
    combined_semantic_resume_verified:false,semantic_observer_installed:false,name_protection_verified:false}};
let session,native,vfs,store,resolver,lastPresentation,lastSave,physicalOwner;
let operation='startup',nativeGate=false,saveStatusId='save.ui.loading';
let lastCompletion=Promise.resolve(),saveCatalogs;
const copy=value=>structuredClone(value);
const fail=id=>{throw new Error(id);};

async function fetchJson(url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)fail('source_fetch_'+response.status+':'+url);
  return response.json();
}
async function fetchBytes(url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)fail('source_fetch_'+response.status+':'+url);
  return response.arrayBuffer();
}
function checkSaveCatalogues(english,japanese){
  const enKeys=Object.keys(english).sort(),jaKeys=Object.keys(japanese).sort();
  if(JSON.stringify(enKeys)!==JSON.stringify(jaKeys)||enKeys.some(id=>
    typeof english[id]!=='string'||typeof japanese[id]!=='string'))fail('save_ui_catalogue_contract');
  for(const id of ['save.ui.save','save.ui.saved','save.ui.saving','save.ui.loading','save.ui.ready',
    'save.ui.failed','save.ui.diagnostics','save.ui.scope','save.ui.resume_button']){
    if(!Object.hasOwn(english,id)||/[{}]/.test(english[id]+japanese[id]))fail('save_ui_catalogue_contract:'+id);
  }
  return {en:english,ja:japanese};
}
function saveLabel(id,locale=lastPresentation?.locale||'ja'){
  const catalogue=saveCatalogs?.[locale];
  if(!catalogue||!Object.hasOwn(catalogue,id))fail('save_ui_missing_id:'+id);
  return catalogue[id];
}
function print(value){
  let line=String(value),match=line.match(/^(TOME_REAL_[A-Z_]+_JSON)=(.*)$/);
  if(match){try{const observed=JSON.parse(match[2]);line=match[1]+'_SUMMARY='+JSON.stringify({
    ready:observed.ready,turn:observed.game?.turn,name:observed.game?.player?.name,
    map:{w:observed.game?.level?.map?.w,h:observed.game?.level?.map?.h}});}catch{/* Bound malformed native logs too. */}}
  line=line.slice(0,2048);console.log(line);lines.push(line);if(lines.length>80)lines.shift();
  log.textContent=lines.join('\n');
}
function compactDiagnostics(){
  // Coverage lists and map cells stay in the explicit probe, not a giant UI dump.
  const coverage=report.localization?.coverage,counts={};
  for(const [key,value] of Object.entries(coverage||{}))if(typeof value==='number')counts[key]=value;
  diagnostics.textContent=JSON.stringify({phase:report.phase,operation,native_checkpoint_gate:nativeGate,
    original_locale:report.original_locale,projection_locale:report.projection_locale,
    projection_language_scope:'Rust adapter labels and supported dialog templates only; original Japanese requires VM reboot to change',
    renderer:report.renderer,renderer_purity_claim:false,complete_game_ui:false,
    semantic_catalogue:resolver?.status,coverage:counts,
    source_commit:report.source_commit,save_operation:report.save_operation?.phase,
    durable_generation:report.last_saved_head?.generation,resume:report.resume,
    error:report.error,save_error:report.save_error,adapter_error:lastPresentation?.error_id},null,2);
}
function mayRead(){
  return report.passed&&!operation&&!nativeGate&&!physicalOwner?.busy&&!physicalOwner?.failed&&!session?.failure&&
    lastPresentation?.phase==='ready'&&lastPresentation.pending_kind===0;
}
function mayOperate(){return mayRead()&&!lastPresentation.error_id;}
function present(value){
  lastPresentation=value;renderDiagnostic(root,value);report.projection_locale=value.locale;
  document.documentElement.lang=value.locale;document.title=value.labels['ui.core.title'];
  canvas.setAttribute('aria-label',document.title);
  for(const node of root.querySelectorAll('[data-save-text-id]'))node.textContent=saveLabel(node.dataset.saveTextId,value.locale);
  saveStatus.textContent=saveLabel(saveStatusId,value.locale);
  const blocked=!mayOperate();
  if(blocked)for(const button of root.querySelectorAll('[data-tome-command],[data-tome-ui-key]'))button.disabled=true;
  for(const button of root.querySelectorAll('[data-tome-op]'))button.disabled=!mayRead();
  for(const button of root.querySelectorAll('[data-tome-locale]'))button.disabled=value.pending_kind!==0;
  saveButton.disabled=blocked||Boolean(value.ui?.dialogs.length);
  resumeLink.hidden=!store?.verifiedHead;
  // Cached host gates only: repaint and locale changes never query the native VM.
  resumeLink.setAttribute('aria-disabled',String(Boolean(operation||nativeGate)));
  compactDiagnostics();
}
function observeGate(){
  const value=native._tome_web_checkpoint_busy();
  if(value!==0&&value!==1)fail('save_native_gate_contract');
  nativeGate=value===1;return nativeGate;
}
function actualJson(name,errorExport='tome_native_last_error'){
  // ccall immediately copies the C-owned, borrowed response before another call.
  const text=native.ccall(name,'string',[],[]);
  if(typeof text!=='string'||!text)fail(native.ccall(errorExport,'string',[],[])||name);
  return JSON.parse(text);
}
const raw=()=>actualJson('tome_native_snapshot');
const rng=()=>{
  const value=native.ccall('tome_native_rng_snapshot_hex','string',[],[]);
  if(!/^[0-9a-f]{5176}$/.test(value||''))fail('save.flow.invalid_baseline_rng');return value;
};
function observeLocalization(){
  report.localization=actualJson('tome_native_localization');
  if(report.localization.enabled!==true)fail('original_semantic_observer_not_enabled');
  const observed=report.localization.diagnostics;
  report.original_locale=observed?.locale??null;
  if(report.original_locale!=='ja_JP')fail('actual_original_japanese_locale_required');
  if(observed.font?.japanese_package_loaded!==true||observed.font.actual_font_exists!==true||
    observed.font.matches_japanese_package!==true||observed.font.break_text_all_character!==true){
    fail('actual_original_japanese_font_required');
  }
  if(typeof observed.player?.name!=='string'||observed.player.get_name!==observed.player.name||
    (requestedName!==null&&observed.player.name!==requestedName))fail('actual_external_player_name_not_preserved');
  report.actual_external_name_preserved=true;
  compactDiagnostics();return report.localization;
}
function originalVisualFrame(){
  if(nativeGate)fail('save.flow.command_gate_closed');
  if(native.ccall('tome_native_draw_baseline','number',[],[])!==1){
    throw new NativeCoreError('error.core.failed','original baseline visual frame',native.ccall('tome_native_last_error','string',[],[]));
  }
  report.original_visual_frames=(report.original_visual_frames||0)+1;
}
function assertFreshHome(module){
  const home='/persist';
  if(module.FS.analyzePath(home).exists&&module.FS.readdir(home).some(name=>name!=='.'&&name!=='..')){
    fail('save.store.fresh_runtime_home_required');
  }
  // Never erase a runtime profile. Hydrated /checkpoint-store is separate and
  // nothing is copied into /persist in this fresh-character-only host.
  report.fresh_runtime_home_verified=true;
}
function checkedPresentation(value){
  if(session.failure||value.error_id)fail(value.error_id||String(session.failure));return value;
}

function installCommandFrameBoundary(){
  const originalDispatch=session.dispatch.bind(session);
  session.dispatch=request=>{
    const result=originalDispatch(request),kind=result.immediate.pending_kind;
    pendingCalls[kind]=(pendingCalls[kind]||0)+1;
    if((kind!==2&&kind!==4)||result.immediate.error_id){
      // Internal UI/snapshot followups must not replace the outer accepted
      // command completion that also owns its native frame and final refresh.
      if(operation!=='command')lastCompletion=result.completion;
      return result;
    }
    // Rust already mapped/validated one actual original key or opaque UI action.
    // No original SDL drain or independent tick loop runs beside this path.
    operation='command';present(lastPresentation);
    const completion=result.completion.then(async value=>{
      if(session.failure||value.error_id)return value;
      observeGate();originalVisualFrame();
      // Original display can change FOV, queued WASD and shake RNG. Read a fresh
      // actual snapshot afterwards; do not claim this frame is a pure repaint.
      const refreshed=await originalDispatch({op:'snapshot'}).completion;
      if(!refreshed.error_id&&!session.failure)observeLocalization();
      return refreshed;
    }).catch(error=>{report.command_error=error.stack||String(error);print(report.command_error);return session.fail(error);})
      .finally(()=>{operation=null;observeGate();present(lastPresentation);});
    lastCompletion=completion;return {immediate:result.immediate,completion};
  };
}
async function command(key){
  if(!mayOperate())fail('save.flow.command_gate_closed');
  return copy(checkedPresentation(await session.dispatch({op:'touch',key}).completion));
}
async function save(){
  await physicalOwner.suspendAndDrain();
  if(!mayOperate()||lastPresentation.ui?.dialogs.length)fail('save.flow.command_gate_closed');
  operation='saving';saveStatusId='save.ui.saving';present(lastPresentation);
  try{
    // This flow first invokes original full_save_settle. Original graph workers,
    // tick-end callbacks, archive validation, RNG capture and IDBFS durability
    // remain its existing gated protocol; no snapshot becomes a savefile.
    lastSave=await saveBaselineCheckpoint(native,store,{generation:'play_'+crypto.randomUUID().replaceAll('-',''),
      onStatus:value=>{report.save_operation=copy(value);physicalOwner.samplePhysicalWhileSave(value);compactDiagnostics();}});
    report.last_saved_head=copy(lastSave.durable.head);report.durable=true;
    saveStatusId='save.ui.saved';
    observeGate();
    if(nativeGate)fail('save.flow.invalid_commit_transition');
    checkedPresentation(await session.dispatch({op:'snapshot'}).completion);
    observeLocalization();return copy(lastSave);
  }catch(error){
    report.save_error={id:error.text_id||error.message,detail:error.detail};saveStatusId='save.ui.failed';
    print(JSON.stringify(report.save_error));throw error;
  }finally{
    // Failure may intentionally retain the native gate. Never release, retry,
    // redraw, or roll back the original graph from a host finally block.
    operation=null;observeGate();if(!nativeGate&&!physicalOwner.failed)physicalOwner.resume();present(lastPresentation);
  }
}
async function purity(){
  if(!mayOperate())fail('save.flow.command_gate_closed');
  operation='projection-check';present(lastPresentation);
  try{
    const before=JSON.stringify(raw()),beforeRng=rng(),beforeCalls=JSON.stringify(nativeCalls);
    const initialLocale=lastPresentation.locale;
    for(let index=0;index<4;index++){
      checkedPresentation(await session.dispatch({op:'view'}).completion);
      checkedPresentation(await session.dispatch({op:'locale',locale:index%2?'ja':'en'}).completion);
    }
    checkedPresentation(await session.dispatch({op:'locale',locale:initialLocale}).completion);
    const zeroCalls=JSON.stringify(nativeCalls)===beforeCalls;
    const sameState=JSON.stringify(raw())===before,sameRng=rng()===beforeRng;
    return {passed:zeroCalls&&sameState&&sameRng,pure_Rust_projection_zero_native_calls:zeroCalls,
      original_snapshot_preserved:sameState,original_rng_preserved:sameRng,
      original_baseline_render_tested:false,scope:'Rust view/locale projection only; native visual frames remain effectful'};
  }finally{operation=null;present(lastPresentation);}
}
async function inspect(){
  if(!mayRead())fail('save.flow.command_gate_closed');
  operation='checkpoint-inspection';present(lastPresentation);
  try{
    const verified=await store.latestVerified();
    return {snapshot:raw(),rng:rng(),localization:copy(observeLocalization()),
      head:copy(verified?.head||null),manifest:copy(verified?.manifest||null),sidecar:copy(verified?.sidecar||null),
      presentation:copy(lastPresentation),calls:{...nativeCalls}};
  }finally{operation=null;present(lastPresentation);}
}
function bytes64(bytes){
  let encoded='';
  for(let offset=0;offset<bytes.length;offset+=16384)encoded+=String.fromCharCode(...bytes.subarray(offset,offset+16384));
  return btoa(encoded);
}
async function exportGeneration(){
  if(!mayRead())fail('save.flow.command_gate_closed');
  operation='checkpoint-archive-export';present(lastPresentation);
  try{
    const verified=await store.latestVerified();
    if(!verified)fail('save.store.no_valid_generation');
    const graphs={};
    for(const role of ['game','world']){
      const path=verified.manifest.graph_paths[role],bytes=native.FS.readFile(verified.base+'/home/'+path);
      graphs[role]={path,bytes:bytes.length,encoding:'base64',data:bytes64(bytes)};
    }
    // The actual original serializer's durable archives, never projection JSON.
    // This explicit probe does not print archive bytes into the DOM or console.
    return {head:copy(verified.head),manifest:copy(verified.manifest),sidecar:copy(verified.sidecar),graphs};
  }finally{operation=null;present(lastPresentation);}
}

try{
  // Small metadata first; then stream raw catalog bytes through the safe Rust
  // mailbox. Keep official JA provenance and the exact reviewed overrides apart.
  saveCatalogs=checkSaveCatalogues(await fetchJson('/checkpoint/i18n/en.json'),await fetchJson('/checkpoint/i18n/ja.json'));
  saveStatus.textContent=saveLabel(saveStatusId);
  for(const node of root.querySelectorAll('[data-save-text-id]'))node.textContent=saveLabel(node.dataset.saveTextId);
  const sources=await fetchJson('/checkpoint/source-manifest.json');
  resolver=await createSemanticTextWasm(await fetchBytes('/semantic/tome_text_wasm.wasm'),{
    english:'/catalog/en.json',japanese:'/catalog/ja.json',registry:'/catalog/registry.json',
    supplements:'/catalog/ja-supplement-complete.json',formatPolicies:'/catalog/format-policy.json',
    extension:'/catalog/dream-registry-extension.json'},{expectedIds:24826});
  report.phase='factory';
  session=await createRetainedBrowserSession({nativeFactory,canvas,
    rustWasmBytes:await fetchBytes('/retained/tome_core_environment.wasm'),onPresentation:present,
    locateFile:name=>'/native/'+name,nativeOptions:{print,printErr:print},
    mountBeforeInit:async module=>{
      native=module;vfs=await mountOriginalInputs(module);
      const call=module.ccall.bind(module);
      module.ccall=(name,...args)=>{
        nativeCalls[name]=(nativeCalls[name]||0)+1;
        if(['tome_native_init','tome_native_semantic_register','tome_native_enable_semantic_fresh',
          'tome_native_configure_character_name','tome_native_start'].includes(name))report.lifecycle.push(name);
        return call(name,...args);
      };
      for(const name of ['tome_native_draw_baseline','tome_native_localization','tome_native_enable_semantic_fresh',
        'tome_native_full_save_settle','tome_native_full_save_begin','tome_native_full_save_poll',
        'tome_native_full_save_persisting','tome_native_full_save_committed','tome_native_full_save_failed',
        'tome_web_checkpoint_busy'])if(typeof module['_'+name]!=='function')fail('missing_actual_native_export:'+name);
      const compatibility={schema:1,engine:'te4-1.7.6',module:'tome-1.7.6',core_version:17,lua_abi:'5.1.5',
        target:'wasm32',sdk:'6.0.8',libc_rng:'emsdk-musl-rand-v1',upstream_commit:vfs.manifest.upstream_commit,
        source_archive_sha256:vfs.manifest.source_archive_sha256,adapter_sources_sha256:sources.bundle_sha256};
      store=new OriginalCheckpointStore(module,{compatibility,validateOriginalArchives:actualNativeArchiveValidator(module)});
      report.phase='idbfs-populate';await store.initialize();report.lifecycle.push('actual_IDBFS_store_initialized');assertFreshHome(module);
      report.source_commit=vfs.manifest.upstream_commit;observeGate();
    },
    beforeStart:({module})=>{
      physicalOwner=new PhysicalPlayOwner({module,canvas,textTarget:document.querySelector('#physical-text'),snapshot:raw,rng,
        onStatus:value=>{report.physical_status=copy(value);if(value.busy&&operation===null)operation='physical';},
        onSettled:async value=>{
          originalVisualFrame();checkedPresentation(await session.dispatch({op:'snapshot'}).completion);observeLocalization();
          report.physical_last_settled=copy(value);
        },onIdle:()=>{if(operation==='physical')operation=null;if(lastPresentation)present(lastPresentation);},
        onError:error=>{report.physical_error={id:error.textId||error.message,status:error.status};
          print(physicalOwner.label(error.textId||error.message));session.fail(error);}});
      report.physical_prepare=physicalOwner.prepare();
      report.planar_compat_install=module.ccall('tome_planar_client_array_refresh_install','number',[],[]);
      if(report.planar_compat_install!==1)throw Error('render.error.client_array_contract');
      // OriginalNativeCore initialized exactly one real VM. Register after init
      // and before original module/config/birth start, never duplicate either.
      installNativeSemanticBridge(module,resolver);
      if(module.ccall('tome_native_enable_semantic_fresh','number',[],[])!==1){
        throw new NativeCoreError('error.core.native_start','fresh Japanese semantic configuration',module.ccall('tome_native_last_error','string',[],[]));
      }
      // Optional bounded fresh-birth configuration for the actual external-name
      // collision scenario. This never changes an already constructed actor.
      if(requestedName!==null){
        if(!/^[A-Za-z0-9_-]{1,25}$/.test(requestedName)||typeof module._tome_native_configure_character_name!=='function'){
          throw new NativeCoreError('error.core.request','fresh character name');
        }
        if(module.ccall('tome_native_configure_character_name','number',['string'],[requestedName])!==1){
          throw new NativeCoreError('error.core.native_start','fresh character name',module.ccall('tome_native_last_error','string',[],[]));
        }
        report.requested_external_name=requestedName;
      }
      report.semantic_registered_before_start=true;report.phase='original-birth';
    }});
  if(session.failure)throw session.failure;
  installCommandFrameBoundary();await session.start();
  if(session.failure||session.phase!=='ready')fail(String(session.failure||'original_birth_not_ready'));
  await physicalOwner.start();report.physical_claim=copy(physicalOwner.claimed);
  observeGate();originalVisualFrame();
  checkedPresentation(await session.dispatch({op:'snapshot'}).completion);
  const observed=raw();
  if(observed.ready!==true||!observed.game?.player||!observed.game?.level)fail('actual_original_world_not_ready');
  observeLocalization();
  report.snapshot={ready:observed.ready,turn:observed.game.turn,player:copy(observed.game.player),
    map:{w:observed.game.level.map.w,h:observed.game.level.map.h}};
  report.metrics={...vfs.metrics};report.phase='original_japanese_player_ready';
  report.passed=true;report.completed=true;operation=null;saveStatusId='save.ui.ready';present(lastPresentation);
  session.bindControls({keyTarget:null,controlsRoot:root,ownHandledInput:true,
    canDispatch:({request})=>request?.op==='locale'?lastPresentation.pending_kind===0:
      request?.op==='snapshot'?mayRead():mayOperate()&&physicalOwner.accepting});
  saveButton.addEventListener('click',()=>save().catch(error=>print(error.text_id||error.message)));
  resumeLink.addEventListener('click',event=>{if(operation||nativeGate||!store.verifiedHead)event.preventDefault();});
  window.tomePlayProbe={raw,rng,command,save,purity,inspect,exportGeneration,report,
    generation:()=>store.verifiedHead?.generation||null,
    presentation:()=>copy(lastPresentation),calls:()=>({...nativeCalls}),pendingCalls:()=>({...pendingCalls}),
    nativeBusy:()=>observeGate(),localization:()=>copy(observeLocalization()),
    settled:async()=>{await lastCompletion;return copy(lastPresentation);},
    locale:async locale=>copy(checkedPresentation(await session.dispatch({op:'locale',locale}).completion)),
    refresh:async()=>{if(!mayRead())fail('save.flow.command_gate_closed');return copy(checkedPresentation(await session.dispatch({op:'snapshot'}).completion));},
    resumeComparisonURL:()=>new URL('/baseline-save-resume.html?resume=1',location.href).href};
  window.tomePhysicalProbe={status:()=>physicalOwner.status(),backend:()=>physicalOwner.backend(),ui:()=>physicalOwner.ui(),
    diagnostic:()=>physicalOwner.diagnostic(),frameErrors:()=>physicalOwner.frameErrors(),settled:()=>physicalOwner.settled(),focus:()=>canvas.focus({preventScroll:true}),
    planarCompat:()=>JSON.parse(module.ccall('tome_planar_client_array_refresh_status','string',[],[])),
    raw,rng,calls:()=>({...nativeCalls}),gateExclusion:()=>physicalOwner.gateExclusion(save)};
  canvas.focus();
}catch(error){
  report.completed=true;report.passed=false;report.phase='failed';report.error=error.stack||String(error);
  operation=null;saveStatusId='save.ui.failed';print(report.error);
  if(session)session.fail(error);else if(saveCatalogs)saveStatus.textContent=saveLabel(saveStatusId);
  saveButton.disabled=true;compactDiagnostics();
}
