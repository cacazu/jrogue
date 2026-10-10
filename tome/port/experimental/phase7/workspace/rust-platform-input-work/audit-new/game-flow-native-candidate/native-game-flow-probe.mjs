/* SPDX-License-Identifier: GPL-3.0-or-later.
 * Source-only copied original diagnostic facade. No gameplay commands, tick
 * pumps, actors, RNG, save or renderer APIs. Queries are NOT heap-pure: native
 * Lua stack/own encoder allocations are explicitly outside the Rust bracket.
 */
const utf8=new TextEncoder();
export class NativeGameFlowError extends Error {
  constructor(textId){super(textId);this.textId=textId;}
}
function failed(module,fallback){
  const id=module.ccall('tome_game_flow_error','string',[],[]);
  throw new NativeGameFlowError(id||fallback);
}
/** Real native init completed; original loader/start has NOT run. This async
 * trusted-source fetch/hash and C evaluation must finish before native start.
 * Expected hash comes from the frozen observer-provenance/source manifest. */
export async function installNativeGameFlowObserver(module,sourceURL,expectedSha256){
  if(!module||typeof module.ccall!=='function'||typeof sourceURL!=='string'||
    typeof expectedSha256!=='string'||!/^[0-9a-f]{64}$/.test(expectedSha256))
    throw new NativeGameFlowError('game_flow.error.request');
  const response=await fetch(sourceURL,{cache:'no-store'});
  if(!response.ok)throw new NativeGameFlowError('game_flow.error.source');
  const bytes=new Uint8Array(await response.arrayBuffer());
  let source;
  try{source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}
  catch{throw new NativeGameFlowError('game_flow.error.source');}
  const encoded=utf8.encode(source);
  if(!bytes.length||bytes.length>65536||source.includes('\0')||encoded.length!==bytes.length||
    !encoded.every((byte,index)=>byte===bytes[index]))throw new NativeGameFlowError('game_flow.error.source');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
    byte=>byte.toString(16).padStart(2,'0')).join('');
  if(digest!==expectedSha256)throw new NativeGameFlowError('game_flow.error.source');
  if(module.ccall('tome_game_flow_install','number',['string','number'],[source,bytes.length])!==1)
    failed(module,'game_flow.error.install');
  return Object.freeze({installed_pre_start:true,source_bytes:bytes.length,source_sha256:digest,
    actor_mutation:false,source_requires_classes:false});
}
export class NativeGameFlowProbe {
  #module;#original;#diagnostic;#canObserve;#installation;#hooks=false;#attachAttempted=false;
  constructor({module,original,ownerDiagnostic,canObserve,installation}){
    if(!module||typeof module.ccall!=='function'||!original||typeof ownerDiagnostic!=='function'||
      typeof canObserve!=='function'||installation?.installed_pre_start!==true)
      throw new NativeGameFlowError('game_flow.error.request');
    this.#module=module;this.#original=original;this.#diagnostic=ownerDiagnostic;
    this.#canObserve=canObserve;this.#installation=structuredClone(installation);
  }
  #assertOwnerIdle(){
    const diagnostic=this.#diagnostic(); // copied JS owner state, no C getter
    if(this.#original.busy||diagnostic?.busy||diagnostic?.failed||diagnostic?.queued_packets!==0)
      throw new NativeGameFlowError('game_flow.error.boundary');
  }
  /** One explicit source-native diagnostic preparation AFTER actual birth,
   * normal original hook loading, original startup quiescence and true frame.
   * Does not settle anything. Failure requires a fresh document/VM. */
  attachAfterBirth(){
    if(this.#attachAttempted)throw new NativeGameFlowError('game_flow.error.stage');
    this.#assertOwnerIdle();this.#attachAttempted=true;
    if(this.#module.ccall('tome_game_flow_attach_hooks','number',[],[])!==1)
      failed(this.#module,'game_flow.error.hooks');
    this.#hooks=true;
    return this.installation();
  }
  installation(){
    return {...structuredClone(this.#installation),hooks_attached_post_birth:this.#hooks,
      hook_callbacks_return_nil:true,observer_heap_pure:false,production_visibility_complete:false,
      complete_campaign_verified:false,reboot_bridge_verified:false};
  }
  /** Synchronous copied read OUTSIDE any pure rendering/native heap bracket.
   * Never awaits, drains input, advances an original frame, or runs a command. */
  snapshot(targetUid=0){
    if(!Number.isInteger(targetUid)||targetUid<0||targetUid>0xffffffff)
      throw new NativeGameFlowError('game_flow.error.request');
    if(!this.#hooks||this.#canObserve()!==true)throw new NativeGameFlowError('game_flow.error.boundary');
    this.#assertOwnerIdle();
    const text=this.#module.ccall('tome_game_flow_snapshot_json','string',['number'],[targetUid]);
    if(!text)failed(this.#module,'game_flow.error.observer');
    let value;try{value=JSON.parse(text);}catch{throw new NativeGameFlowError('game_flow.error.response');}
    if(value?.protocol!==1||value.available!==true||value.causal_hooks_installed!==true||
      value.scope!=='original_flow_diagnostic_raw_reads'||!Array.isArray(value.dialogs)||
      value.dialogs.length>16||!Array.isArray(value.trace)||value.trace.length>256||
      value.production_visibility_complete!==false||value.actor_graph_serialization!==false||
      !Array.isArray(value.navigation?.cells)||value.navigation.cells.length>8||
      value.navigation.passability_computed!==false)
      throw new NativeGameFlowError('game_flow.error.response');
    return value; // owns decoded strings/scalars/tables; no live Lua reference
  }
  /** Expose this two-query surface only on window.tomeGameFlowProbe. Preparation
   * stays private to boot integration; there is deliberately no command API. */
  readOnlyFacade(){
    return Object.freeze({snapshot:uid=>this.snapshot(uid),installation:()=>this.installation()});
  }
}