// SPDX-License-Identifier: GPL-3.0-or-later
// Real C/Lua/Rust browser scenario. Parent executes it sequentially.
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const array=value=>Array.isArray(value)?value:[];
export async function runScenario({call,evaluate,output}){
  const checks=[];
  const check=(name,passed,detail)=>{checks.push({name,passed:!!passed,detail});if(!passed)throw Error(name+': '+JSON.stringify(detail));};
  const catalogue=await evaluate('window.tomeMissingRouteProbe.catalogue()');
  const status=await evaluate('window.tomeMissingRouteProbe.resolverStatus()');
  check('Actual new Rust host preserves base/dream separation and adds only reviewed20',status.ids===24846&&status.base_ids===24845&&status.extension_ids===1&&status.supplements===499&&status.format_policies===2,status);
  const expectedIds=Object.keys(catalogue.english).sort();
  check('EN JA delta index exact20 coverage',expectedIds.length===20&&JSON.stringify(expectedIds)===JSON.stringify(Object.keys(catalogue.japanese).sort())&&
    JSON.stringify(expectedIds)===JSON.stringify(catalogue.index.routes.map(row=>row.semantic_id).sort()),{ids:expectedIds.length});
  const observation=await evaluate('window.tomeMissingRouteProbe.observe()');
  check('Actual original read-only definition/name/negative transport probes preserve state and complete RNG',observation.state_preserved&&observation.rng_preserved&&observation.rng_bytes===2588,
    {state:observation.state_preserved,rng:observation.rng_preserved,bytes:observation.rng_bytes});
  const native=observation.value,view=native.reviewed_missing_routes;
  check('Actual early overlay loaded before genuine definitions and Japanese observer',view?.overlay_mounted===true&&view.locale==='ja_JP'&&native.enabled===true&&native.status.installed===true&&native.status.external_player_names_protected===true,
    {overlay:view?.overlay_mounted,locale:view?.locale,status:native.status});
  check('Original activation constant and native limit stay unchanged',view.constant_seed==='Activate Object'&&view.activation_limit===50,{seed:view.constant_seed,limit:view.activation_limit});
  check('Actual external wolf name stays unchanged after original birth',view.actual_player.name==='wolf'&&view.actual_player.get_name==='wolf'&&observation.original_state.game.player.name==='wolf',view.actual_player);
  const font=native.diagnostics.font;
  check('Actual original Japanese font and CJK wrapping remain active',font.japanese_package_loaded&&font.actual_font_exists&&font.matches_japanese_package&&font.break_text_all_character,font);
  const actualLabels=array(view.labels),actualById=new Map(actualLabels.map(row=>[row.semantic_id,row]));
  check('Actual original definitions expose exactly20 declared display owners',actualLabels.length===20&&actualById.size===20&&expectedIds.every(id=>actualById.has(id)),{labels:actualLabels.length});
  const guard=array(observation.guard),guardById=new Map(guard.map(row=>[row.semantic_id,row]));
  let originalIdentities=0;
  for(const route of catalogue.index.routes){
    const row=actualById.get(route.semantic_id),identities=array(row.native_identities),expected=catalogue.japanese[route.semantic_id],trace=guardById.get(route.semantic_id);
    check('Actual '+route.source+' Japanese names use reviewed semantic owner',row.source===route.source&&row.tag===route.tag&&identities.length===route.stable_short_names.length&&
      identities.every(identity=>identity.present&&identity.name===expected),{id:route.semantic_id,expected,identities});
    check('Actual '+route.source+' native identifiers and constants preserved',identities.every((identity,index)=>identity.short_name===route.stable_short_names[index]&&
      (identity.kind==='faction'?identity.lookup_key===identity.short_name:identity.id==='T_'+identity.short_name&&identity.class_constant===identity.id&&identity.class_constant_source==='actual_original_talent_registration_owner'&&identity.lookup_key===identity.id)),{id:route.semantic_id});
    check('Actual '+route.source+' production registrations reached guarded Rust host',trace?.accepted>=identities.length&&trace.accepted_missing_official===trace.accepted&&trace.accepted_original_template===trace.accepted&&
      trace.last_accepted?.id===route.semantic_id&&trace.last_accepted.tag===route.tag&&trace.last_accepted.line===route.overlay_consumer.line,
      {id:route.semantic_id,trace});
    check('Actual '+route.source+' equal text at another original Lua caller keeps original native text',row.actual_wrong_context_translation===route.source&&row.native_wrong_tag.resolved===false&&row.native_wrong_tag.reason==='unknown_source_tag',
      {id:route.semantic_id,wrongContext:row.actual_wrong_context_translation,wrongTag:row.native_wrong_tag});
    originalIdentities+=identities.length;
  }
  check('All124 original identities covered without synthetic registration',originalIdentities===124&&view.synthetic_registration===false&&view.actor_graph_modified===false&&view.gameplay_called===false&&view.rng_called===false,
    {identities:originalIdentities});
  const opaque=array(view.opaque_placeholders);
  check('Four original unfinished placeholder names and IDs remain opaque',opaque.length===4&&opaque.every(row=>row.present&&row.name===row.source&&row.id==='T_'+row.short_name&&row.finished_name_or_mechanics_invented===false),opaque);
  const observed=new Set(array(native.coverage.observed_semantic_ids));
  check('Actual original observer recorded all20 IDs and no known English fallback',expectedIds.every(id=>observed.has(id))&&native.coverage.counters.remaining_english_fallback===0,
    {observedNewIds:expectedIds.filter(id=>observed.has(id)),counters:native.coverage.counters});
  const hostLeases=await evaluate('window.tomeSemanticProbe ? window.tomeSemanticProbe.leases() : null');
  if(hostLeases!==null)check('Actual native semantic result leases released',hostLeases===0,{leases:hostLeases});
  // Render copied actual native names for diagnostic CJK layout, not invented
  // talents or a claim of the original campaign/dialog renderer.
  const displayed=actualLabels.map(row=>array(row.native_identities)[0].name);
  await evaluate('(()=>{let node=document.querySelector("#reviewed-native-names");if(!node){node=document.createElement("pre");node.id="reviewed-native-names";document.querySelector("main").append(node);}node.style.whiteSpace="pre-wrap";node.style.overflowWrap="anywhere";node.textContent='+JSON.stringify(displayed.join('\n'))+';return true;})()');
  const desktop=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile(path.join(output,'reviewed-routes-desktop.png'),Buffer.from(desktop.data,'base64'));
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const layout=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,names:document.querySelector("#reviewed-native-names").textContent.split("\\n")})');
  check('Actual20 native Japanese name copies fit mobile diagnostic layout',layout.scroll<=layout.width+2&&JSON.stringify(layout.names)===JSON.stringify(displayed),layout);
  const mobile=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile(path.join(output,'reviewed-routes-mobile.png'),Buffer.from(mobile.data,'base64'));
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const afterLayout=await evaluate('window.tomeMissingRouteProbe.observe()');
  check('Repeated actual diagnostics and DOM projection preserve real state/RNG',afterLayout.state_preserved&&afterLayout.rng_preserved&&
    JSON.stringify(afterLayout.original_state)===JSON.stringify(observation.original_state),{state:afterLayout.state_preserved,rng:afterLayout.rng_preserved});
  const origin=await evaluate('location.origin'),served=[];
  for(const route of ['/missing/semantic-route-delta.json','/missing/integration-source-manifest.json','/missing/source-freeze.json','/missing/merge-result.json',
    '/catalog/en.json','/catalog/ja.json','/catalog/registry.json','/catalog/ja-supplement-complete.json',
    '/catalog/format-policy.json','/catalog/dream-registry-extension.json','/missing/merge-delta.mjs','/missing/reviewed-resolver-profile.mjs',
    '/vfs/original/game/semantic-display-overlay/engine/interface/ActorTalents.lua','/vfs/original/game/semantic-display-overlay/engine/Faction.lua']){
    const response=await fetch(origin+route);check('Actual frozen profile source served '+route,response.ok,{status:response.status});
    const hash=createHash('sha256');let bytes=0;for await(const chunk of response.body){hash.update(chunk);bytes+=chunk.length;}
    served.push({route,bytes,sha256:hash.digest('hex')});
  }
  const result={passed:true,checks,source_commit:catalogue.index.source_commit,served_artifacts:served,actual_labels:actualLabels,
    original_native_identities:124,coverage:native.coverage,guard_before:guard,guard_after:afterLayout.guard,
    preserved_external_player_name:view.actual_player,retained_opaque_placeholders:opaque,
    limitations:['Twenty source-grounded registration display owners verified; legacy learnability and full campaign accessibility remain unverified.',
      'Screenshots show actual native copied names in a diagnostic DOM; this is not complete original UI or a pure Rust map-rendering claim.',
      'Four upstream unfinished names are intentionally retained; 953 repeated Japanese source inputs are not reverse-mapped.']};
  await writeFile(path.join(output,'reviewed-route-scenario.json'),JSON.stringify(result,null,2)+'\n');return result;
}
