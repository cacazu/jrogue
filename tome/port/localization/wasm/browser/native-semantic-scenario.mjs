/* SPDX-License-Identifier: GPL-3.0-or-later
 * Actual-source Chrome scenario for native-core-work/browser_probe.mjs.
 * No fixture game/locale objects or caller-supplied expected replacement text.
 */
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const array=value=>Array.isArray(value)?value:[]; // Original finite encoder emits an empty table as {}.
export async function runScenario({call,evaluate,output}){
 const checks=[],limitations=[];
 const check=(name,passed,detail)=>{checks.push({name,passed:Boolean(passed),detail});if(!passed)throw Error(name+': '+JSON.stringify(detail));};
 const initial=await evaluate('window.tomeSemanticProbe.raw()');
 const catalogue=await evaluate('window.tomeSemanticProbe.resolverStatus()');
 check('Actual immutable final semantic catalogue loaded',catalogue.base_ids===24825&&catalogue.extension_ids===1&&catalogue.supplements===479&&catalogue.format_policies===2,catalogue);
 const observation=await evaluate('window.tomeSemanticProbe.observeDiagnostics()');
 check('Real diagnostic lookups preserve original state and all captured native RNG',observation.preserves_actual_state&&observation.preserves_actual_rng,
  {state:observation.preserves_actual_state,rng:observation.preserves_actual_rng,rngBytes:observation.rng_bytes});
 const native=observation.value,diagnostics=native.diagnostics;
 check('Actual original birth installed Japanese I18N and external-name protection',native.enabled&&native.status.installed&&native.status.locale==='ja_JP'&&native.status.external_player_names_protected,native.status);
 check('Actual Japanese font package and CJK wrapping flag are active',diagnostics?.font?.japanese_package_loaded&&diagnostics.font.matches_japanese_package&&diagnostics.font.actual_font_exists&&diagnostics.font.break_text_all_character,diagnostics?.font);
 const player=diagnostics?.player;
 check('Born external name wolf stays unchanged while its actual native entity-name route translates',initial.game.player.name==='wolf'&&player?.name==='wolf'&&player.get_name==='wolf'&&typeof player.native_entity_name_translation==='string'&&player.native_entity_name_translation!=='wolf',player);
 check('Real original Berserker descriptor displays Japanese',player?.subclass==='Berserker'&&/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(player.translated_subclass),{raw:player?.subclass,display:player?.translated_subclass});
 const precision=array(diagnostics?.precision?.probes);
 check('Both exact reviewed native tformat precision owners preserve complete CJK resource names',precision.length===2&&precision.every(probe=>probe.ok&&probe.passed&&probe.id===probe.resolved_id&&typeof probe.resource_name==='string'&&probe.result.includes(probe.resource_name)),precision);
 const contracts=diagnostics?.contracts;
 check('Actual native special/order diagnostic metadata is present',contracts&&contracts.no_synthetic_locale_metadata===true,contracts);
 const attempts=array(contracts.attempts);
 check('Probed official native formatters preserve actual argument contracts',attempts.every(probe=>probe.passed),attempts);
 if(contracts.active_special_sources>0)check('At least one active native special formatter is preserved',contracts.verified_special>0,contracts);
 else limitations.push('The actual active Japanese locale had no special-format source; no synthetic special metadata was injected.');
 if(contracts.active_order_sources>0)check('At least one active native argument-order formatter is preserved',contracts.verified_order>0,contracts);
 else limitations.push('The actual active Japanese locale had no nonempty argument-order source; that path remains unobserved in this scenario.');
 const coverage=native.coverage;
 check('Bounded telemetry records actual native-to-Rust localization requests',coverage?.counters?.requests>0&&coverage.counters.resolved>0&&array(coverage.observed_semantic_ids).length===coverage.counters.distinct_ids&&coverage.locale==='ja_JP',
  {counters:coverage?.counters,events:array(coverage?.bounded_events).length,ids:array(coverage?.observed_semantic_ids).length});
 const unknown=coverage.unknown_callsite_inventory,unknownEntries=array(unknown?.entries);
 check('Actual unresolved native calls retain source owners and honest bounded occurrence accounting',
  unknown?.distinct_limit===1024&&unknownEntries.length===unknown.retained_distinct_count&&unknownEntries.length<=1024&&
  unknown.retained_occurrences+unknown.omitted_occurrences===coverage.counters.unmapped&&
  unknown.distinct_count_is_lower_bound===(unknown.omitted_occurrences>0)&&
  unknownEntries.every(entry=>typeof entry.source==='string'&&typeof entry.file==='string'&&Number.isInteger(entry.line)&&
   entry.occurrences>0&&entry.source_copy_bytes<=8192&&entry.source_bytes>=entry.source_copy_bytes),
  {distinct:unknown?.retained_distinct_count,retained:unknown?.retained_occurrences,omitted:unknown?.omitted_occurrences,lowerBound:unknown?.distinct_count_is_lower_bound});
 check('Coverage stays explicitly incomplete',coverage.full_corpus_runtime_coverage_claimed===false&&diagnostics.complete_campaign_coverage===false,{coverageClaim:coverage.full_corpus_runtime_coverage_claimed});
 const callsBefore=await evaluate('window.tomeSemanticProbe.calls()');
 const action=await evaluate('window.tomeSemanticProbe.wait()');
 const callsAfter=await evaluate('window.tomeSemanticProbe.calls()');
 check('One real original MOVE_STAY advances its original rule loop',action.command==='MOVE_STAY'&&action.ticks>0&&action.after.game.turn>action.before.game.turn&&callsAfter.tome_native_command===(callsBefore.tome_native_command||0)+1,
  {beforeTurn:action.before.game.turn,afterTurn:action.after.game.turn,ticks:action.ticks});
 const after=await evaluate('window.tomeSemanticProbe.observeDiagnostics()');
 check('Japanese native text diagnostics still preserve real state/RNG after original wait',after.preserves_actual_state&&after.preserves_actual_rng,{state:after.preserves_actual_state,rng:after.preserves_actual_rng});
 check('Native semantic result leases are all released',await evaluate('window.tomeSemanticProbe.leases()')===0,{outstanding:await evaluate('window.tomeSemanticProbe.leases()')});
 const desktop=await call('Page.captureScreenshot',{format:'png'});
 await writeFile(path.join(output,'semantic-desktop.png'),Buffer.from(desktop.data,'base64'));
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const layout=await evaluate('({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,text:document.querySelector("#actual-text").textContent})');
 check('Actual native Japanese sample text fits mobile diagnostic layout',layout.scrollWidth<=layout.viewport+2&&layout.text.includes(player.translated_subclass),layout);
 const mobile=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
 await writeFile(path.join(output,'semantic-mobile.png'),Buffer.from(mobile.data,'base64'));
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 limitations.push('This is actual retained C/Lua + semantic text integration; complete original dialogs, campaign text coverage, production Rust rendering, and locale-reboot hydration need separate scenarios.');
 return {passed:true,checks,initial:{turn:initial.game.turn,player:initial.game.player},final:{turn:action.after.game.turn,player:action.after.game.player},
  coverageBefore:coverage,coverageAfter:after.value.coverage,limitations};
}
