/* SPDX-License-Identifier: GPL-3.0-or-later
 * Additive actual-native protocol. No original rules, serializer, RNG or mocks.
 * Source-only; application must route every external frame/command through the
 * installed native gate and own all original worker/quiescence accounting.
 */
function failed(id,detail) { const e=new Error(id); e.text_id=id; e.detail=detail; throw e; }
function api(module,name,args=[]) {
  const output=module.ccall(name,'string',args.map(()=> 'string'),args);
  if(!output) failed('save.flow.native_call_failed',name);
  return JSON.parse(output);
}
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));

export async function saveBaselineCheckpoint(module,store,{generation,loader,onStatus=()=>{}}) {
  let state=api(module,'tome_native_full_save_settle',[generation]);
  onStatus(state);
  while(state.phase==='settling') {
    await yieldFrame();
    state=api(module,'tome_native_full_save_settle',[generation]);
    onStatus(state);
  }
  if(state.phase!=='prepared') failed('save.flow.original_save_rejected',state);
  state=api(module,'tome_native_full_save_begin',[generation]);
  onStatus(state);
  if(state.phase==='rejected'||state.phase==='failed') failed('save.flow.original_save_rejected',state);
  while(state.phase==='serializing'||state.phase==='draining-prior') {
    await yieldFrame();
    state=api(module,'tome_native_full_save_poll');
    onStatus(state);
  }
  if(state.phase!=='graph-complete') failed('save.flow.original_graph_incomplete',state);
  const originalLoader={...(state.loader||loader),save_name:state.save_name};
  let commit;
  try {
    // stageAndCommit captures the actual singleton RNG synchronously before
    // its first await; the real native gate stays held for the entire operation.
    commit=store.stageAndCommit({generation,graphStatus:state,layout:1,loader:originalLoader});
    state=api(module,'tome_native_full_save_persisting',[generation]);
    if(state.phase!=='persisting') failed('save.flow.invalid_commit_transition',state);
    onStatus(state);
    const durable=await commit;
    if(durable.phase!=='committed') failed('save.flow.browser_commit_failed',durable);
    state=api(module,'tome_native_full_save_committed',[generation]);
    if(state.phase!=='complete') failed('save.flow.invalid_commit_transition',state);
    store.acknowledgeCommitted(generation);
    onStatus(state);
    return {operation:state,durable};
  } catch(error) {
    if(commit) await commit.catch(()=>{});
    api(module,'tome_native_full_save_failed',[error.text_id||error.message]);
    throw error; // No automatic retry, gate release or live-graph rollback.
  }
}

export async function resumeBaselineCheckpoint(freshModule,store,{verified,onStatus=()=>{},beforeOriginalStart}) {
  // A new modularized WASM instance, populated IDBFS and empty runtime home are
  // required. Never run the new_game=true birth driver against this working slot.
  if(beforeOriginalStart!==undefined&&typeof beforeOriginalStart!=='function')
    failed('save.flow.native_call_failed','beforeOriginalStart must be a function');
  const request=await store.copyForFreshResume(verified);
  if(request.rng_layout!==1) failed('save.flow.named_resume_requires_strict_host');
  if(freshModule.ccall('tome_native_init','number',[],[])!==1) failed('save.flow.native_initialization_failed');
  const accepted=freshModule.ccall('tome_native_set_resume_request','number',
    ['string','string','string','string','number'],[request.save_name,request.generation,
      request.extra_module_info||'no_birth_popup=true',request.profile_name||'default',1]);
  if(accepted!==1) failed('save.flow.original_resume_failed');
  // Optional host hydration seam. The real native core and request exist, but
  // no original module/world/game load has started. Await exactly one host call;
  // never initialize again, reseed, run birth, or replace original loading.
  if(beforeOriginalStart!==undefined) await beforeOriginalStart(freshModule,{request,verified});
  if(freshModule.ccall('tome_native_start_resume','number',[],[])!==1)
    failed('save.flow.original_resume_failed');
  let state;
  do {
    state=api(freshModule,'tome_native_resume_poll');
    onStatus(state);
    if(state.phase==='original-dialog-required') failed('save.flow.original_dialog_required',state);
    if(state.phase==='failed') failed('save.flow.original_resume_failed',state);
    if(state.phase==='settling') await yieldFrame();
  } while(state.phase==='settling');
  if(state.phase!=='restore-required') failed('save.flow.original_resume_not_quiescent',state);
  const valid=freshModule.ccall('tome_web_rng_validate_hex','number',['string','number'],[request.sidecar.hex,1]);
  const restored=valid===1&&freshModule.ccall('tome_web_rng_restore_hex','number',['string','number'],[request.sidecar.hex,1])===1;
  if(!restored) failed('save.flow.rng_restore_failed');
  const exact=freshModule.ccall('tome_native_rng_snapshot_hex','string',[],[]);
  if(exact!==request.sidecar.hex) failed('save.flow.rng_restore_mismatch');
  state=api(freshModule,'tome_native_resume_restored',[request.generation]);
  if(state.phase!=='ready') failed('save.flow.original_resume_not_ready',state);
  onStatus(state);
  return {operation:state,request};
}
