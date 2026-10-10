#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Exact source composition only. No server/browser/native/build execution.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {parseUniqueJson,validateDelta} from '../merge-delta.mjs';

const here=import.meta.dirname,owned=path.resolve(here,'..'),project=path.resolve(owned,'..'),generated=path.join(here,'generated');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const semanticOnly=process.argv.slice(2).join(' ')==='--semantic-only';
assert.ok(process.argv.length===2||semanticOnly,'Use no arguments for all profiles or --semantic-only');
const selectedProfiles=semanticOnly?['semantic']:['semantic','physical','prepared'];
const inputs=[],outputs=[];
function read(relative){const file=path.join(project,relative),bytes=fs.readFileSync(file);inputs.push({file:relative,bytes:bytes.length,sha256:hash(bytes)});return bytes.toString('utf8');}
function write(name,text){const bytes=Buffer.from(text,'utf8'),file=path.join(here,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);outputs.push({file:name,bytes:bytes.length,sha256:hash(bytes)});}
function replace(text,before,after,label){assert.equal(text.split(before).length,2,'Exact unique anchor: '+label);return text.replace(before,after);}
const delta=parseUniqueJson(read('semantic-missing-routes-work/candidate/semantic-route-delta.json'));validateDelta(delta);
const placeholders=parseUniqueJson(read('semantic-missing-routes-work/candidate/unfinished-placeholder-policy.json')).labels.map(row=>row.source);
const lua=value=>{if(Array.isArray(value))return '{'+value.map(lua).join(',')+'}';if(value&&typeof value==='object')return '{'+Object.entries(value).map(([key,value])=>'['+JSON.stringify(key)+']='+lua(value)).join(',')+'}';if(typeof value==='string')return JSON.stringify(value);if(typeof value==='number')return String(value);if(typeof value==='boolean')return value?'true':'false';throw Error('Finite Lua source value required');};
write('generated/reviewed-routes.lua','-- SPDX-License-Identifier: GPL-3.0-or-later\n-- Finite source ownership/identity data. No Japanese expectations are injected into Lua.\nreturn '+lua({source_commit:delta.source_commit,labels:delta.route_index.routes,opaque_placeholders:placeholders})+'\n');
const probePath=path.join(here,'missing-route-probe.lua');assert.ok(fs.statSync(probePath).isFile());

const mountAnchor='\tlocal result = original_require(module_name)\n';
const mount='\tif (module_name == "engine.interface.ActorTalents" or module_name == "engine.Faction") and not bridge.semantic_display_overlay_mounted then\n'+
  '\t\tassert(not package.loaded["engine.interface.ActorTalents"] and not package.loaded["engine.Faction"], "Semantic display overlay arrived after original definition registration")\n'+
  '\t\tassert(fs.mount(settings.root_game.."/semantic-display-overlay", "/", false), "Exact original semantic display leaf mount failed")\n'+
  '\t\tbridge.semantic_display_overlay_mounted=true\n\tend\n';
const diagnosticsAnchor='\t\tdiagnostics=diagnostics, coverage=semantic_observer:coverage_snapshot()})';
const diagnostics='\t\tdiagnostics=diagnostics, reviewed_missing_routes=assert(loadfile("/adapter/semantic-display/missing-route-probe.lua"))().collect(bridge),\n'+
  '\t\tcoverage=semantic_observer:coverage_snapshot()})';
const profileDefinitions=[
  ['semantic','bootstrap-work/browser-vfs-inputs.json'],
  ['physical','save-resume-work/browser-vfs-inputs.json'],
  ['prepared','mechanics-audit-work/prepared-map/integration-web/browser-vfs-inputs.json'],
];
for(const [profile,manifestName]of profileDefinitions.filter(([profile])=>selectedProfiles.includes(profile))){
  const manifest=parseUniqueJson(read(manifestName)),manifestDirectory=path.dirname(path.join(project,manifestName));
  const driver=manifest.inputs.find(row=>row.virtual==='/adapter/real-core-probe.lua');assert.ok(driver,'Actual profile driver');
  const driverRelative=path.relative(project,path.resolve(manifestDirectory,driver.physical)).replaceAll('\\','/');
  const source=read(driverRelative);
  let derived=replace(source,mountAnchor,mount+mountAnchor,profile+' original require');
  derived=replace(derived,diagnosticsAnchor,diagnostics,profile+' original semantic diagnostic envelope');
  write('generated/'+profile+'-driver.lua',derived);
  for(const row of manifest.inputs)row.physical=path.resolve(manifestDirectory,row.physical);
  driver.physical=path.join(generated,profile+'-driver.lua');driver.bytes=Buffer.byteLength(derived);driver.role+='; exact semantic display leaves and read-only original-definition diagnostics';
  for(const [physical,virtual,role]of [
    [path.join(owned,'candidate/overlay/game/engines/default/engine/interface/ActorTalents.lua'),'/original/game/semantic-display-overlay/engine/interface/ActorTalents.lua','Reversible post-short_name literal display leaves; original talent identities/rules retained'],
    [path.join(owned,'candidate/overlay/game/engines/default/engine/Faction.lua'),'/original/game/semantic-display-overlay/engine/Faction.lua','Reversible builtin Players display leaf; original faction identity/reactions retained'],
    [path.join(generated,'reviewed-routes.lua'),'/adapter/semantic-display/reviewed-routes.lua','Finite reviewed original producer identities, with no injected Japanese expected results'],
    [probePath,'/adapter/semantic-display/missing-route-probe.lua','Actual post-birth native definition/identity/name diagnostic; no synthetic talent registration'],
  ]){
    assert.ok(!manifest.inputs.some(row=>row.virtual===virtual),'No duplicate VFS path');const bytes=fs.readFileSync(physical);
    manifest.inputs.push({physical,virtual,type:'file',role,bytes:bytes.length,sha256:hash(bytes)});
  }
  if(manifest.build_overlay)manifest.build_overlay.staged=path.resolve(manifestDirectory,manifest.build_overlay.staged);
  manifest.semantic_display_profile={source_commit:delta.source_commit,profile,source_candidate:true,exact_guard_required:true,
    independent_default_delivery_unchanged:true,authored_delta_ids:20,complete_runtime_coverage_claim:false};
  write('generated/'+profile+'-vfs-inputs.json',JSON.stringify(manifest,null,2)+'\n');
}

const sessionSource=read('localization-wasm-work/browser/native-semantic-session.mjs');
let session=replace(sessionSource,"import {createSemanticTextWasm,SemanticTransportError} from './semantic-text-wasm.mjs';","import {createSemanticTextWasm,SemanticTransportError} from '/semantic/semantic-text-wasm.mjs';\nimport {installReviewedResolverGuard} from '/missing/reviewed-resolver-profile.mjs';",'Semantic session module import');
session=replace(session,"import {installNativeSemanticBridge} from './native-semantic-bridge.mjs';","import {installNativeSemanticBridge} from '/semantic/native-semantic-bridge.mjs';",'Actual native semantic bridge import');
session=replace(session,'},{expectedIds:24826});','},{expectedIds:24846});\n await installReviewedResolverGuard(resolver);','Reviewed host counts + guard before nativeFactory');
session=replace(session,'resolver.status.base_ids!==24825||resolver.status.extension_ids!==1||resolver.status.supplements!==479','resolver.status.base_ids!==24845||resolver.status.extension_ids!==1||resolver.status.supplements!==499','Explicit base/supplement counts');
write('generated/native-reviewed-session.mjs',session);
let page=read('localization-wasm-work/browser/native-semantic-browser.mjs');
page=replace(page,"import {createNativeSemanticSession} from './native-semantic-session.mjs';","import {createNativeSemanticSession} from '/missing/native-reviewed-session.mjs';\nimport {makeMissingRouteProbe} from '/missing/reviewed-resolver-profile.mjs';",'Standalone native session');
page=replace(page,"const raw=()=>session.snapshot(),localization=()=>session.localization();","const raw=()=>session.snapshot(),localization=()=>session.localization();\n window.tomeMissingRouteProbe=makeMissingRouteProbe({raw,rng:()=>session.rng(),localization,resolver:session.resolver});",'Real definition probe');
write('generated/semantic-route-browser.mjs',page);
let html=read('localization-wasm-work/browser/native-semantic-browser.html');
html=replace(html,'src="./native-semantic-browser.mjs"','src="/missing/semantic-route-browser.mjs"','Standalone page module');
write('generated/semantic-route-browser.html',html);

if(!semanticOnly){
let physical=read('rust-platform-input-work/integration-web/physical-play-browser.mjs');
physical=replace(physical,"import {installNativeSemanticBridge} from '/semantic/native-semantic-bridge.mjs';","import {installNativeSemanticBridge} from '/semantic/native-semantic-bridge.mjs';\nimport {installReviewedResolverGuard,makeMissingRouteProbe} from '/missing/reviewed-resolver-profile.mjs';",'Physical profile imports');
physical=replace(physical,'},{expectedIds:24826});','},{expectedIds:24846});\n  await installReviewedResolverGuard(resolver);','Physical actual host before factory/bridge');
physical=replace(physical,'  canvas.focus();\n}catch(error){','  window.tomeMissingRouteProbe=makeMissingRouteProbe({raw,rng,localization:()=>observeLocalization(),resolver});\n  canvas.focus();\n}catch(error){','Physical actual probe');
write('generated/physical-play-browser.mjs',physical);
write('generated/physical-play-browser.html',read('rust-platform-input-work/integration-web/physical-play-browser.html'));

let prepared=read('mechanics-audit-work/prepared-map/integration-web/observer.mjs');
prepared=replace(prepared,"import {saveBaselineCheckpoint} from '/checkpoint/baseline_flow.mjs';","import {saveBaselineCheckpoint} from '/checkpoint/baseline_flow.mjs';\nimport {createSemanticTextWasm} from '/semantic/semantic-text-wasm.mjs';\nimport {installNativeSemanticBridge} from '/semantic/native-semantic-bridge.mjs';\nimport {installReviewedResolverGuard,makeMissingRouteProbe} from '/missing/reviewed-resolver-profile.mjs';",'Prepared actual resolver imports');
prepared=replace(prepared,'  module=await nativeFactory({canvas,noInitialRun:true,','  const semanticBytes=await(await fetch(\'/semantic/tome_text_wasm.wasm\')).arrayBuffer();\n'+
  '  const semanticResolver=await createSemanticTextWasm(semanticBytes,{english:\'/catalog/en.json\',japanese:\'/catalog/ja.json\',registry:\'/catalog/registry.json\',\n'+
  '    supplements:\'/catalog/ja-supplement-complete.json\',formatPolicies:\'/catalog/format-policy.json\',extension:\'/catalog/dream-registry-extension.json\'},{expectedIds:24846});\n'+
  '  await installReviewedResolverGuard(semanticResolver);\n  module=await nativeFactory({canvas,noInitialRun:true,','Prepared resolver before actualFactory');
prepared=replace(prepared,"  check('observer.original.birth_completed',native('tome_native_start','number')===1);",'  installNativeSemanticBridge(module,semanticResolver);\n'+
  '  check(\'observer.original.reviewed_semantic_enabled\',native(\'tome_native_enable_semantic_fresh\',\'number\')===1);\n'+
  '  check(\'observer.original.external_name_configured\',native(\'tome_native_configure_character_name\',\'number\',[\'wolf\'],[\'string\'])===1);\n'+
  "  check('observer.original.birth_completed',native('tome_native_start','number')===1);\n"+
  "  window.tomeMissingRouteProbe=makeMissingRouteProbe({raw:snapshot,rng,localization:()=>nativeJson('tome_native_localization'),resolver:semanticResolver});",'Prepared init -> actual semantic bridge -> actual birth');
write('generated/prepared-observer.mjs',prepared);
let preparedHtml=read('mechanics-audit-work/prepared-map/integration-web/prepared-map-observer.html');
preparedHtml=replace(preparedHtml,'src="/observer/observer.mjs"','src="/observer/observer.mjs"','Prepared exact module URL retained');
write('generated/prepared-map-observer.html',preparedHtml);

}
for(const row of inputs)assert.equal(hash(fs.readFileSync(path.join(project,row.file))),row.sha256,'Frozen source changed during derivation: '+row.file);
const result={schema_version:1,source_commit:delta.source_commit,source_only:true,default_delivery_modified:false,pristine_modified:false,
  build_or_native_browser_executed:false,profiles:selectedProfiles,inputs,outputs,
  native_guard_installed_before_actual_bridge_in_every_profile:true,actual_original_graph_or_rng_modifications:false};
const perProfileInputs={
  semantic:['bootstrap-work/browser-vfs-inputs.json','bootstrap-work/real-core-probe.lua',
    'localization-wasm-work/browser/native-semantic-session.mjs','localization-wasm-work/browser/native-semantic-browser.mjs','localization-wasm-work/browser/native-semantic-browser.html'],
  physical:['save-resume-work/browser-vfs-inputs.json','save-resume-work/generated/baseline-birth-driver.lua',
    'rust-platform-input-work/integration-web/physical-play-browser.mjs','rust-platform-input-work/integration-web/physical-play-browser.html'],
  prepared:['mechanics-audit-work/prepared-map/integration-web/browser-vfs-inputs.json','save-resume-work/generated/baseline-birth-driver.lua',
    'mechanics-audit-work/prepared-map/integration-web/observer.mjs','mechanics-audit-work/prepared-map/integration-web/prepared-map-observer.html'],
};
const perProfileOutputs={
  semantic:['generated/native-reviewed-session.mjs','generated/semantic-route-browser.mjs','generated/semantic-route-browser.html'],
  physical:['generated/physical-play-browser.mjs','generated/physical-play-browser.html'],
  prepared:['generated/prepared-observer.mjs','generated/prepared-map-observer.html'],
};
for(const profile of selectedProfiles){
  const inputNames=new Set(['semantic-missing-routes-work/candidate/semantic-route-delta.json','semantic-missing-routes-work/candidate/unfinished-placeholder-policy.json',...perProfileInputs[profile]]);
  const outputNames=new Set(['generated/reviewed-routes.lua','generated/'+profile+'-driver.lua','generated/'+profile+'-vfs-inputs.json',...perProfileOutputs[profile]]);
  const uniqueInputs=[...new Map(inputs.filter(row=>inputNames.has(row.file)).map(row=>[row.file,row])).values()];
  write('integration-'+profile+'-source-manifest.json',JSON.stringify({...result,profiles:[profile],inputs:uniqueInputs,outputs:outputs.filter(row=>outputNames.has(row.file))},null,2)+'\n');
}
write('integration-source-manifest.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:true,profiles:result.profiles,inputs:inputs.length,outputs:outputs.length,source_only:true}));
