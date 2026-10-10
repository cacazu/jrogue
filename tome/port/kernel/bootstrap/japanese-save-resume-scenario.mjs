/* SPDX-License-Identifier: GPL-3.0-or-later
 * Actual original save/load through same-origin Chrome navigation. The parent
 * owns all execution. No generated actors, JSON saves, rules or RNG fixtures.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
// Same independent real ZIP inspector used by full_save_scenario.mjs.
import {inspectOriginalGraphZip} from './original-browser-scenario.mjs';

const array=value=>Array.isArray(value)?value:[];
const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const stableSnapshot=value=>JSON.parse(JSON.stringify(value,(key,item)=>key==='uid'?undefined:item));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function runScenario({call,evaluate,evidence,output}){
  const result={passed:false,scope:'Actual Japanese original full save and hydrated fresh-document resume',checks:[],
    renderer_purity_claim:false,complete_campaign_verified:false,domain_load_equivalence_claim:false,
    uid_normalization:'Only original Entity:loaded uid remapping in the finite existing bridge observation',
    continuation_frame:'Actual original command -> explicit effectful original draw -> actual snapshot and combined RNG',
    limitations:['Finite observation equality is not full graph/domain equivalence or campaign completion.',
      'Original rendering remains effectful; post-application-frame RNG differences fail this scenario without masking or rollback.',
      'The semantic observer records incomplete runtime coverage; a loaded complete catalog does not mean every game text call was exercised.']};
  const check=(name,passed,detail={})=>{
    result.checks.push({name,passed:Boolean(passed),...detail});
    if(!passed)throw Error(name+' failed: '+JSON.stringify(detail));
  };
  const fresh=expression=>evaluate('window.tomePlayProbe.'+expression);
  const resumed=expression=>evaluate('window.tomeSemanticResumeProbe.'+expression);
  function compactLocalization(value){
    const coverage=value.coverage,diagnostics=value.diagnostics;
    return {enabled:value.enabled,status:value.status,font:diagnostics?.font,player:diagnostics?.player,
      precision:diagnostics?.precision,contracts:diagnostics?.contracts,
      coverage:{locale:coverage?.locale,counters:coverage?.counters,
        observed_id_count:array(coverage?.observed_semantic_ids).length,
        observed_ids_sample:array(coverage?.observed_semantic_ids).slice(0,16),
        unknown_retained_distinct:coverage?.unknown_callsite_inventory?.retained_distinct_count,
        full_corpus_runtime_coverage_claimed:coverage?.full_corpus_runtime_coverage_claimed}};
  }
  function assertJapanese(value,label){
    const d=value.diagnostics,c=value.coverage?.counters;
    check(label+' uses actual hydrated Japanese I18N and name protection',value.enabled===true&&value.status?.installed===true&&
      value.status.locale==='ja_JP'&&d?.locale==='ja_JP'&&value.status.external_player_names_protected===true,
      {status:value.status,actual_I18N_locale:d?.locale});
    check(label+' keeps user wolf raw while actual NPC entity-name lookup translates',d?.player?.name==='wolf'&&d.player.get_name==='wolf'&&
      d.player.native_entity_name_translation==='\u30aa\u30aa\u30ab\u30df',{player:d?.player});
    check(label+' uses genuine Japanese font package and CJK wrapping flag',d?.font?.japanese_package_loaded&&d.font.matches_japanese_package&&
      d.font.actual_font_exists&&d.font.break_text_all_character,{font:d?.font});
    check(label+' exercises reviewed complete supplements through actual native requests',c?.requests>0&&c.resolved>0&&
      c.authored_supplement>0&&value.coverage.locale==='ja_JP'&&value.coverage.full_corpus_runtime_coverage_claimed===false,
      {counters:c,complete_campaign_coverage:d?.complete_campaign_coverage});
    const precision=array(d?.precision?.probes);
    check(label+' preserves complete CJK resource names at both exact format owners',precision.length===2&&
      precision.every(probe=>probe.ok&&probe.passed&&probe.id===probe.resolved_id&&probe.result.includes(probe.resource_name)),{probes:precision});
  }
  async function caughtSave(){
    return evaluate('(async()=>{try{return {ok:true,value:await window.tomePlayProbe.save()};}catch(error){return {ok:false,message:error.message,detail:error.detail,text_id:error.text_id,operation:window.tomePlayReport.save_operation,save_error:window.tomePlayReport.save_error};}})()');
  }
  try{
    await mkdir(output,{recursive:true});
    const freshReport=await evaluate('window.tomePlayReport');
    check('actual combined Japanese fresh application is ready',freshReport?.completed&&freshReport.passed===true,
      {phase:freshReport?.phase,error:freshReport?.error});
    check('proof name supplied before genuine original birth',freshReport.requested_external_name==='wolf'&&
      (await fresh('raw()')).game.player.name==='wolf',{requested:freshReport.requested_external_name});
    const beforeReloadOrigin=freshReport.document_time_origin;
    check('fresh actual document has finite navigation identity',Number.isFinite(beforeReloadOrigin));
    const initialLocalization=await fresh('localization()');assertJapanese(initialLocalization,'Fresh original VM');
    result.localization_fresh=compactLocalization(initialLocalization);
    const pure=await fresh('purity()');
    check('fresh Rust projection remains separate from effectful frames',pure.passed&&pure.pure_Rust_projection_zero_native_calls&&
      pure.original_snapshot_preserved&&pure.original_rng_preserved,{purity:pure});

    const beforeFirstWait=await fresh('raw()'),callsBefore=await fresh('calls()');
    await fresh('command("MOVE_STAY")');
    const afterFirstWait=await fresh('raw()'),callsAfter=await fresh('calls()');
    check('one actual initial wait executes through fresh Rust and original frame',afterFirstWait.game.turn>beforeFirstWait.game.turn&&
      callsAfter.tome_native_command===(callsBefore.tome_native_command||0)+1&&
      callsAfter.tome_native_draw_baseline===(callsBefore.tome_native_draw_baseline||0)+1,
      {before_turn:beforeFirstWait.game.turn,after_turn:afterFirstWait.game.turn});
    const first=await caughtSave();check('first actual full original checkpoint commits',first.ok&&
      first.value.operation.phase==='complete'&&first.value.durable.phase==='committed',{save:first});
    check('first actual durable commit releases its original gate',await fresh('nativeBusy()')===false||await fresh('nativeBusy()')===0);
    const second=await caughtSave();check('second actual full original checkpoint commits',second.ok&&
      second.value.operation.phase==='complete'&&second.value.durable.phase==='committed',{save:second});
    const generation=await fresh('exportGeneration()');
    check('actual saved locale is Japanese with verified previous generation',generation.manifest.loader.preferred_locale==='ja_JP'&&
      generation.manifest.previous_head?.generation===first.value.durable.head.generation&&
      generation.head.generation===second.value.durable.head.generation,
      {saved_locale:generation.manifest.loader.preferred_locale,head:generation.head,previous_head:generation.manifest.previous_head});
    check('actual post-graph singleton RNG sidecar captures all components',generation.sidecar.layout_id===1&&generation.sidecar.bytes===2588&&
      /^[0-9a-f]{5176}$/.test(generation.sidecar.hex)&&generation.sidecar.hex===await fresh('rng()')&&
      generation.manifest.mode==='baseline_original_checkpoint',
      {layout:generation.sidecar.layout,bytes:generation.sidecar.bytes,rng_sha256:sha(generation.sidecar.hex)});
    result.head=generation.head;result.manifest=generation.manifest;result.archives={};
    for(const [role,expectedMainClass] of [['game','mod.class.Game'],['world','mod.class.World']]){
      const exported=generation.graphs[role],bytes=Buffer.from(exported.data,'base64');
      check('actual '+role+' archive export has exact bytes',bytes.length===exported.bytes&&bytes.length>0);
      const inspected=inspectOriginalGraphZip(bytes,{expectedMainClass});
      const artifact=path.join(output,'japanese-original-'+(role==='game'?'fullgame.teag':'fullworld.teaw'));
      await writeFile(artifact,bytes);result.archives[role]={artifact,guest_relative_path:exported.path,...inspected};
      check('independent Node original '+role+' ZIP/CRC/root class validation succeeds',
        inspected.main_header.main_class===expectedMainClass&&inspected.crc_members_verified===inspected.entry_count,
        {class_name:inspected.main_header.main_class,entries:inspected.entry_count,sha256:inspected.sha256});
    }
    const postSave=await fresh('inspect()');
    result.post_save=stableSnapshot(postSave.snapshot);
    check('finite checkpoint observation still matches exact captured RNG',postSave.rng===generation.sidecar.hex);
    result.expected_continuation=[];
    for(let index=0;index<2;index++){
      await fresh('command("MOVE_STAY")');
      const observation=await fresh('inspect()');
      result.expected_continuation.push({command:'MOVE_STAY',snapshot:stableSnapshot(observation.snapshot),rng:observation.rng});
    }

    const origin=new URL(evidence.url).origin,resumeURL=new URL('/semantic-resume.html',origin).href;
    check('new actual resume document remains on exact original Node origin',new URL(resumeURL).origin===origin,{origin,resumeURL});
    await call('Page.navigate',{url:resumeURL});
    const deadline=Date.now()+240000;let report;
    while(Date.now()<deadline){
      try{report=await evaluate('window.tomeNativeBootReport');}catch{}
      if(report?.completed&&Number.isFinite(report.document_time_origin)&&report.document_time_origin!==beforeReloadOrigin)break;
      await sleep(250);
    }
    check('new actual document replaces the prior completed report',Number.isFinite(report?.document_time_origin)&&
      report.document_time_origin!==beforeReloadOrigin,{before:beforeReloadOrigin,after:report?.document_time_origin});
    check('actual verified generation resumes with Japanese semantic hydration',report.completed&&report.passed===true&&
      report.resumed_head?.generation===generation.head.generation&&report.resume_operation?.phase==='ready'&&
      report.saved_preferred_locale==='ja_JP'&&report.hydration?.preferred_locale==='ja_JP',
      {phase:report.phase,error:report.error,resume:report.resume_operation,hydration:report.hydration});
    const lifecycle=report.lifecycle,required=['tome_native_init','tome_native_set_resume_request','tome_native_semantic_register',
      'tome_native_enable_semantic_resume','tome_native_start_resume'];
    check('hydrated hook runs once between actual init/request and one original resume start',report.hydration_hook_calls===1&&
      required.every(name=>lifecycle.filter(value=>value===name).length===1)&&
      required.every((name,index)=>index===0||lifecycle.indexOf(required[index-1])<lifecycle.indexOf(name))&&
      !lifecycle.includes('tome_native_enable_semantic_fresh')&&!lifecycle.includes('tome_native_start'),{lifecycle});
    check('genuine original World/Game and deferred load callback execute once',report.resume_operation.world_loaded===1&&
      report.resume_operation.game_loaded===1&&report.resume_operation.delay_completed===true&&
      report.resume_operation.original_display_settle_passes===1,{resume:report.resume_operation});
    const catalogue=await resumed('resolverStatus()');
    check('hydrated actual semantic resolver contains final reviewed corpus',catalogue.base_ids===24825&&catalogue.extension_ids===1&&
      catalogue.supplements===479&&catalogue.format_policies===2,{catalogue});
    const diagnostics=await resumed('observeDiagnostics()');
    check('actual hydrated text/name/font lookups preserve state and saved combined RNG',diagnostics.preserves_actual_state&&diagnostics.preserves_actual_rng,
      {state:diagnostics.preserves_actual_state,rng:diagnostics.preserves_actual_rng});
    assertJapanese(diagnostics.value,'Hydrated original VM');result.localization_resumed=compactLocalization(diagnostics.value);
    check('saved RNG restores exactly after original loader/settling',await resumed('rng()')===generation.sidecar.hex);
    const recovered=await resumed('exportGeneration()');
    check('actual durable manifest and sidecar survive fresh same-origin navigation',recovered.head.generation===generation.head.generation&&
      recovered.head.manifest_sha256===generation.head.manifest_sha256&&recovered.sidecar.hex===generation.sidecar.hex&&
      recovered.manifest.loader.preferred_locale==='ja_JP');
    for(const role of ['game','world']){
      const bytes=Buffer.from(recovered.graphs[role].data,'base64');
      check('durable original '+role+' archive bytes remain identical after page replacement',
        bytes.length===recovered.graphs[role].bytes&&sha(bytes)===result.archives[role].sha256);
    }
    const postResume=await resumed('inspect()');result.post_resume=stableSnapshot(postResume.snapshot);
    check('finite original checkpoint observation matches after only UID normalization',
      JSON.stringify(result.post_resume)===JSON.stringify(result.post_save),
      {checkpoint_sha256:sha(result.post_save),resumed_sha256:sha(result.post_resume)});
    result.continuation=[];
    for(let index=0;index<2;index++){
      const beforeCalls=await resumed('calls()');const accepted=await resumed('command("MOVE_STAY")');
      const observed=await resumed('inspect()'),afterCalls=await resumed('calls()');
      const actual={command:'MOVE_STAY',snapshot:stableSnapshot(observed.snapshot),rng:observed.rng},expected=result.expected_continuation[index];
      check('resumed original wait '+index+' executes one actual command and frame',accepted.command==='MOVE_STAY'&&accepted.ticks>0&&
        afterCalls.tome_native_command===(beforeCalls.tome_native_command||0)+1&&
        afterCalls.tome_native_draw_baseline===(beforeCalls.tome_native_draw_baseline||0)+1,{ticks:accepted.ticks});
      check('post-application-frame continuation '+index+' preserves exact original state and all RNG',
        JSON.stringify(actual.snapshot)===JSON.stringify(expected.snapshot)&&actual.rng===expected.rng,
        {expected_state_sha256:sha(expected.snapshot),actual_state_sha256:sha(actual.snapshot),
          expected_rng_sha256:sha(expected.rng),actual_rng_sha256:sha(actual.rng),turn:actual.snapshot.game.turn});
      result.continuation.push({command:actual.command,ticks:accepted.ticks,post_frame_state_equal:true,combined_rng_equal:true});
    }
    const finalLocalization=await resumed('localization()');assertJapanese(finalLocalization,'Continued hydrated original VM');
    check('actual native semantic leases are released after load and commands',await resumed('leases()')===0);
    const picture=await call('Page.captureScreenshot',{format:'png'});
    const artifact=path.join(output,'japanese-save-resume.png');await writeFile(artifact,Buffer.from(picture.data,'base64'));result.screenshot=artifact;
    result.resume_report={document_time_origin:report.document_time_origin,lifecycle:report.lifecycle,
      hydration:report.hydration,resumed_head:report.resumed_head,resume_operation:report.resume_operation};
    result.passed=result.checks.every(entry=>entry.passed);
  }catch(error){result.error=error.stack||String(error);}
  await writeFile(path.join(output,'japanese-save-resume-evidence.json'),JSON.stringify(result,null,2));return result;
}
