// SPDX-License-Identifier: GPL-3.0-or-later
// Actual retained C/Lua initialization; semantic Rust owns text resolution only.
import {createSemanticTextWasm,SemanticTransportError} from '/semantic/semantic-text-wasm.mjs';
import {installReviewedResolverGuard} from '/missing/reviewed-resolver-profile.mjs';
import {installNativeSemanticBridge} from '/semantic/native-semantic-bridge.mjs';

export const semanticUrls=Object.freeze({
 wasm:'/semantic/tome_text_wasm.wasm',english:'/catalog/en.json',japanese:'/catalog/ja.json',registry:'/catalog/registry.json',
 supplements:'/catalog/ja-supplement-complete.json',formatPolicies:'/catalog/format-policy.json',extension:'/catalog/dream-registry-extension.json',
});
function verifyFreshProfile(module,{requireEmpty=true}={}){
 const FS=module.FS;
 if(!FS||typeof FS.readdir!=='function'||typeof FS.analyzePath!=='function')throw new SemanticTransportError('actual_native_fs_unavailable');
 const exists=FS.analyzePath('/persist').exists;
 const entries=exists?FS.readdir('/persist').filter(name=>name!=='.'&&name!=='..'):[];
 if(requireEmpty&&entries.length)throw new SemanticTransportError('fresh_profile_contains_existing_files');
 const memfs=FS.filesystems?.MEMFS;
 const profileMount=FS.lookupPath?.(exists?'/persist':'/').node?.mount;
 if(memfs&&profileMount?.type!==memfs)throw new SemanticTransportError('fresh_profile_requires_owned_memfs');
 return {guest_profile:'/persist',exists,entries,require_empty_before_original_init:requireEmpty,
  hydrated_from_persisted_storage:false,owned_new_native_factory_instance:true};
}
export async function createNativeSemanticSession({nativeFactory,mountOriginalInputs,canvas,urls=semanticUrls,onPhase=()=>{},nativeOptions={}}){
 onPhase('semantic-wasm-fetch');
 const response=await fetch(urls.wasm);
 if(!response.ok)throw new SemanticTransportError('semantic_wasm_fetch_failed');
 onPhase('semantic-catalog-stream');
 const resolver=await createSemanticTextWasm(await response.arrayBuffer(),{
  english:urls.english,japanese:urls.japanese,registry:urls.registry,supplements:urls.supplements,
  formatPolicies:urls.formatPolicies,extension:urls.extension,
 },{expectedIds:24846});
 await installReviewedResolverGuard(resolver);
 if(resolver.status.base_ids!==24845||resolver.status.extension_ids!==1||resolver.status.supplements!==499||resolver.status.format_policies!==2){
  throw new SemanticTransportError('final_reviewed_semantic_coverage_mismatch');
 }
 onPhase('original-native-factory');
 const module=await nativeFactory({...nativeOptions,canvas,noInitialRun:true,locateFile:name=>'/native/'+name});
 for(const name of ['tome_native_init','tome_native_start','tome_native_enable_semantic_fresh','tome_native_configure_character_name',
  'tome_native_snapshot','tome_native_command','tome_native_localization','tome_native_rng_snapshot_hex']){
  if(typeof module['_'+name]!=='function')throw new SemanticTransportError('missing_actual_export_'+name);
 }
 const calls={};
 const original=module.ccall.bind(module);
 module.ccall=(name,...args)=>{calls[name]=(calls[name]||0)+1;return original(name,...args);};
 onPhase('original-source-vfs');
 const vfs=await mountOriginalInputs(module,'/vfs-manifest.json');
 const freshBefore=verifyFreshProfile(module);
 const error=()=>module.ccall('tome_native_last_error','string',[],[])||'original_native_call_failed';
 const requireSuccess=(name,args=[],types=[])=>{
  if(module.ccall(name,'number',types,args)!==1)throw new SemanticTransportError(error());
 };
 const readJson=(name,args=[],types=[])=>{
  // ccall copies the borrowed native response before another bridge call.
  const value=module.ccall(name,'string',types,args);
  if(!value)throw new SemanticTransportError(error());
  return JSON.parse(value);
 };
 onPhase('actual-native-init');requireSuccess('tome_native_init');
 // Original init may create its own fresh directories. The empty pre-init
 // check and owned MEMFS still prove no previous profile was hydrated.
 const freshAfter=verifyFreshProfile(module,{requireEmpty:false});
 onPhase('actual-semantic-register');
 const semanticHost=installNativeSemanticBridge(module,resolver);
 onPhase('actual-fresh-profile-opt-in');requireSuccess('tome_native_enable_semantic_fresh');
 // Supply the user-owned name through the original birth configuration seam.
 // No born actor is renamed or otherwise mutated for this collision probe.
 requireSuccess('tome_native_configure_character_name',['wolf'],['string']);
 onPhase('original-loader-japanese');requireSuccess('tome_native_start');
 const snapshot=()=>readJson('tome_native_snapshot');
 const localization=()=>readJson('tome_native_localization');
 const rng=()=>{
  const value=module.ccall('tome_native_rng_snapshot_hex','string',[],[]);
  if(typeof value!=='string'||!value.length||!/^[0-9a-f]+$/.test(value))throw new SemanticTransportError('actual_rng_snapshot_unavailable');
  return value;
 };
 const born=snapshot();
 if(born.ready!==true||!Number.isFinite(born.game?.player?.uid))throw new SemanticTransportError('original_birth_incomplete');
 const initialLocalization=localization();
 if(initialLocalization.enabled!==true||initialLocalization.status?.installed!==true||initialLocalization.status.locale!=='ja_JP'){
  throw new SemanticTransportError('actual_japanese_observer_not_installed');
 }
 onPhase('actual-japanese-player-ready');
 return {module,vfs,resolver,semanticHost,freshBefore,freshAfter,initialLocalization,
  snapshot,localization,rng,calls:()=>({...calls}),
  wait:()=>readJson('tome_native_command',['MOVE_STAY'],['string']),
  drawBaseline:()=>requireSuccess('tome_native_draw_baseline'),
  observeDiagnostics:()=>{
   const before=snapshot(),beforeRng=rng(),value=localization(),after=snapshot(),afterRng=rng();
   return {value,preserves_actual_state:JSON.stringify(before)===JSON.stringify(after),preserves_actual_rng:beforeRng===afterRng,
    observer_telemetry_may_change:true,rng_bytes:beforeRng.length/2};
  },
 };
}
