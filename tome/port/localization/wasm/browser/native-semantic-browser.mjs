// SPDX-License-Identifier: GPL-3.0-or-later
import nativeFactory from '/native/tome-native.mjs';
import {mountOriginalInputs} from '/bootstrap/browser_vfs_mounts.mjs';
import {createNativeSemanticSession} from './native-semantic-session.mjs';
const report=window.tomeNativeBootReport={completed:false,passed:false,phase:'semantic-host',
 scope:'Actual retained original C/Lua with compiled Rust semantic text resolver',
 completeGameUi:false,completeCampaignTextCoverage:false,mockedGame:false,
 renderer:'original-SDL-baseline-comparison-only',freshProfileRequested:true};
const canvas=document.querySelector('#original');
try{
 const session=await createNativeSemanticSession({nativeFactory,mountOriginalInputs,canvas,
  onPhase:phase=>{report.phase=phase;},
  nativeOptions:{print:line=>console.log(String(line).slice(0,8192)),printErr:line=>console.error(String(line).slice(0,8192))}});
 const raw=()=>session.snapshot(),localization=()=>session.localization();
 window.tomeSemanticProbe={raw,localization,rng:()=>session.rng(),calls:()=>session.calls(),
  wait:()=>session.wait(),observeDiagnostics:()=>session.observeDiagnostics(),
  resolverStatus:()=>({...session.resolver.status}),leases:()=>session.semanticHost.outstandingLeases(),
  drawBaseline:()=>session.drawBaseline(),report};
 const state=raw();
 report.snapshot={ready:state.ready,turn:state.game.turn,player:state.game.player,
  map:{w:state.game.level?.map?.w,h:state.game.level?.map?.h}};
 report.semanticCatalogue={...session.resolver.status};
 report.localization=session.initialLocalization;
 report.freshProfile={before:session.freshBefore,afterNativeInit:session.freshAfter};
 report.metrics={...session.vfs.metrics};report.transport=session.vfs.transport;report.sourceCommit=session.vfs.manifest.upstream_commit;
 report.calls=session.calls();
 // Original rendering is an explicit comparison step and can consume native
 // RNG/change original domain state. Never describe it as a pure Rust redraw.
 session.drawBaseline();report.originalEffectfulComparisonDraw=true;
 const diagnostics=report.localization.diagnostics;
 document.querySelector('#actual-text').textContent=[diagnostics?.player?.get_name,diagnostics?.player?.translated_subclass,
  ...(Array.isArray(diagnostics?.precision?.probes)?diagnostics.precision.probes.map(probe=>probe.result):[])].filter(value=>typeof value==='string').join('\n');
 report.passed=state.ready===true&&session.initialLocalization.status.locale==='ja_JP';
 report.phase='actual-semantic-ready';report.completed=true;
 const readable={...report,localization:{enabled:report.localization.enabled,status:report.localization.status,
  diagnostics:report.localization.diagnostics,coverage:{counters:report.localization.coverage.counters,
   observed_ids_sample:report.localization.coverage.observed_semantic_ids?.slice(0,16),
   full_corpus_runtime_coverage_claimed:false}}};
 document.querySelector('#evidence').textContent=JSON.stringify(readable,null,2);
}catch(error){
 report.completed=true;report.passed=false;report.error=error.stack||String(error);
 document.querySelector('#evidence').textContent=JSON.stringify(report,null,2);
 console.error('TOME_SEMANTIC_BROWSER_FAILURE='+report.error);
}
