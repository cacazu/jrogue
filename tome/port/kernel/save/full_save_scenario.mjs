/* SPDX-License-Identifier: GPL-3.0-or-later
 * Independent actual CDP scenario for the existing monitored Chrome harness.
 * No browser/process is launched by this module. Original commands, full graph
 * ZIP bytes, original load/delay flow and exact three-component RNG are used.
 */
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {inspectOriginalGraphZip} from '../bootstrap-work/original-browser-scenario.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function stableSnapshot(value) {
  // Only the original Entity:loaded UID remapping is normalized in this finite
  // observation seam. All remaining provided map/player/turn/energy fields stay.
  return JSON.parse(JSON.stringify(value,(key,item)=>key==='uid'?undefined:item));
}
export async function runScenario({call,evaluate,evidence,output}) {
  const result={scope:'Comparison-only genuine original full-game/world save, actual IDBFS fresh-page resume and command continuation',
    checks:[],passed:false,renderer_purity_claim:false,full_campaign_claim:false,uid_normalization:'Entity:loaded remapping only in finite existing bridge view'};
  function check(name,passed,detail) {result.checks.push({name,passed:!!passed,detail});if(!passed)throw new Error(name);}
  try {
    check('actual baseline checkpoint page ready',await evaluate('window.tomeCheckpointReport.passed===true'));
    const origin=new URL(evidence.url).origin;
    await evaluate('window.tomeCheckpointProbe.command("MOVE_STAY")'); // Original ordinary player boundary.
    async function caughtSave(){
      return evaluate('(async()=>{try{return {ok:true,value:await window.tomeCheckpointProbe.save()};}catch(error){return {ok:false,message:error.message,detail:error.detail,text_id:error.text_id,operation:window.tomeCheckpointReport.save_operation,save_error:window.tomeCheckpointReport.save_error};}})()');
    }
    const firstResult=await caughtSave();
    check('first genuine save accepted original boundary',firstResult.ok,firstResult);
    const completed=firstResult.value;
    check('actual fullsave committed before native gate released',completed.operation.phase==='complete'&&completed.durable.phase==='committed'&&
      await evaluate('window.tomeCheckpointProbe.nativeBusy()')===0,{generation:completed.operation.generation});
    const secondResult=await caughtSave();
    check('second genuine save accepted original boundary',secondResult.ok,secondResult);
    const second=secondResult.value;
    check('second actual durable checkpoint retains verified prior head',second.operation.phase==='complete'&&second.durable.phase==='committed');
    const generation=await evaluate('window.tomeCheckpointProbe.exportGeneration()');
    check('singleton sidecar preserves every current original component',generation.sidecar.layout_id===1&&generation.sidecar.bytes===2588&&
      /^[0-9a-f]{5176}$/.test(generation.sidecar.hex)&&generation.manifest.mode==='baseline_original_checkpoint');
    result.head=generation.head;result.manifest=generation.manifest;
    result.archives={};
    for(const [role,expectedMainClass] of [['game','mod.class.Game'],['world','mod.class.World']]) {
      const exported=generation.graphs[role],bytes=Buffer.from(exported.data,'base64');
      check('actual '+role+' exported byte length exact',bytes.length===exported.bytes&&bytes.length>0);
      const inspected=inspectOriginalGraphZip(bytes,{expectedMainClass});
      const file=path.join(output,role==='game'?'original-fullgame.teag':'original-fullworld.teaw');
      await writeFile(file,bytes);
      result.archives[role]={guest_relative_path:exported.path,artifact:file,...inspected};
      check('independent Node '+role+' ZIP validation succeeded',inspected.main_header?.main_class===expectedMainClass&&inspected.expected_main_class===expectedMainClass,
        {actual_inspector_keys:Object.keys(inspected),expectedMainClass});
    }
    check('actual captured RNG equals post-graph live state',generation.sidecar.hex===await evaluate('window.tomeCheckpointProbe.rng()'));
    const corrupt=await evaluate('window.tomeCheckpointProbe.corruptionRejected()');
    check('native malformed RNG rejected without mutation',corrupt.rejected&&corrupt.unchanged,{bytes:corrupt.bytes});
    const rejection=await evaluate('window.tomeCheckpointProbe.rejectionProbes()');
    check('future version and corrupt graph fail closed before original loader',rejection.future.rejected&&rejection.corrupt.rejected&&rejection.rng_unchanged,rejection);
    check('corrupt current generation falls back to verified immutable prior head',rejection.prior.validated&&rejection.prior.matched,rejection.prior);
    result.rejection_probes=rejection;
    result.post_save=stableSnapshot(await evaluate('window.tomeCheckpointProbe.snapshot()'));
    const commands=['MOVE_STAY','MOVE_STAY'];
    const continued=[];
    for(const command of commands) {
      const value=await evaluate(`window.tomeCheckpointProbe.command(${JSON.stringify(command)})`);
      continued.push({command,ticks:value.ticks,after:stableSnapshot(value.after),rng:await evaluate('window.tomeCheckpointProbe.rng()')});
    }
    const resumeURL=await evaluate('window.tomeCheckpointProbe.resumeURL()');
    const beforeReloadOrigin=await evaluate('window.tomeCheckpointReport.document_time_origin');
    check('actual current document has a finite fresh-page identity',Number.isFinite(beforeReloadOrigin));
    check('resume reload keeps exact same Node origin/session',new URL(resumeURL).origin===origin,{origin,resumeURL});
    await evaluate(`history.replaceState(null,"",${JSON.stringify(resumeURL)})`);
    await call('Page.reload',{ignoreCache:true});
    const deadline=Date.now()+180000;
    let reloaded;
    while(Date.now()<deadline) {
      try {reloaded=await evaluate('window.tomeCheckpointReport');} catch {}
      if(reloaded?.completed&&Number.isFinite(reloaded.document_time_origin)&&reloaded.document_time_origin!==beforeReloadOrigin) break;
      await sleep(250);
    }
    check('fresh actual document replaces old completed report',Number.isFinite(reloaded?.document_time_origin)&&reloaded.document_time_origin!==beforeReloadOrigin,
      {before:beforeReloadOrigin,after:reloaded?.document_time_origin});
    check('fresh actual module resumes verified durable generation',reloaded?.completed&&reloaded.passed===true&&
      reloaded.resumed_head?.generation===generation.head.generation&&reloaded.resume_operation?.phase==='ready',
      {phase:reloaded?.phase,error:reloaded?.error,resume:reloaded?.resume_operation});
    check('genuine world/Game and deferred callback loaded once',reloaded.resume_operation.world_loaded===1&&
      reloaded.resume_operation.game_loaded===1&&reloaded.resume_operation.delay_completed===true&&
      reloaded.resume_operation.original_display_settle_passes===1);
    check('RNG restored exactly after original load and settling',await evaluate('window.tomeCheckpointProbe.rng()')===generation.sidecar.hex);
    const recovered=await evaluate('window.tomeCheckpointProbe.exportGeneration()');
    check('actual IndexedDB generation/manifest survives page reload',recovered.head.generation===generation.head.generation&&
      recovered.head.manifest_sha256===generation.head.manifest_sha256&&recovered.sidecar.hex===generation.sidecar.hex);
    result.post_resume=stableSnapshot(await evaluate('window.tomeCheckpointProbe.snapshot()'));
    check('finite original semantic observation matches checkpoint after UID remapping',JSON.stringify(result.post_resume)===JSON.stringify(result.post_save));
    result.continuation=[];
    for(let index=0;index<commands.length;index++) {
      const value=await evaluate(`window.tomeCheckpointProbe.command(${JSON.stringify(commands[index])})`);
      const actual={command:commands[index],ticks:value.ticks,after:stableSnapshot(value.after),rng:await evaluate('window.tomeCheckpointProbe.rng()')};
      check('original command continuation '+index+' matches actual state/ticks/full RNG',JSON.stringify(actual)===JSON.stringify(continued[index]),
        {command:actual.command,ticks:actual.ticks});
      result.continuation.push({command:actual.command,ticks:actual.ticks,rng_equal:true,semantic_equal:true});
    }
    const shot=await call('Page.captureScreenshot',{format:'png'});
    await writeFile(path.join(output,'full-save-resume.png'),Buffer.from(shot.data,'base64'));
    result.passed=result.checks.every(entry=>entry.passed);
  } catch(error) {result.error=error.stack||String(error);}
  await writeFile(path.join(output,'full-save-resume-evidence.json'),JSON.stringify(result,null,2));
  return result;
}
