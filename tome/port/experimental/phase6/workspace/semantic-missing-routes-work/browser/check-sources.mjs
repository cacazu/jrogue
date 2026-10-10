#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect generated source and ask Node to parse it; execute no imported code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const here=import.meta.dirname,work=path.resolve(here,'../..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
let assertions=0;
const equal=(a,b,message)=>{assertions++;assert.deepEqual(a,b,message);};
const truth=(value,message)=>{assertions++;assert.ok(value,message);};
const selectedProfile=(process.argv.find(value=>value.startsWith('--profile='))||'--profile=semantic').slice(10);
assert.ok(['semantic','physical','prepared'].includes(selectedProfile),'Exact profile required');
const manifest=JSON.parse(fs.readFileSync(path.join(here,'integration-'+selectedProfile+'-source-manifest.json'),'utf8'));
for(const row of manifest.inputs)equal(hash(fs.readFileSync(path.join(work,row.file))),row.sha256,'Frozen source input');
for(const row of manifest.outputs){const bytes=fs.readFileSync(path.join(here,row.file));equal(bytes.length,row.bytes);equal(hash(bytes),row.sha256);}
for(const profile of manifest.profiles){
  const driver=fs.readFileSync(path.join(here,'generated',profile+'-driver.lua'),'utf8');
  const vfs=JSON.parse(fs.readFileSync(path.join(here,'generated',profile+'-vfs-inputs.json'),'utf8'));
  const actual=vfs.inputs.find(row=>row.virtual==='/adapter/real-core-probe.lua');
  equal(path.resolve(actual.physical),path.join(here,'generated',profile+'-driver.lua'));
  equal(vfs.semantic_display_profile.authored_delta_ids,20);
  equal(vfs.inputs.filter(row=>row.virtual.includes('semantic-display-overlay/engine/')).length,2);
  equal(new Set(vfs.inputs.map(row=>row.virtual)).size,vfs.inputs.length);
  truth(driver.indexOf('Semantic display overlay arrived after original definition registration')<driver.indexOf('local result = original_require(module_name)'));
  truth(driver.includes('reviewed_missing_routes=assert(loadfile("/adapter/semantic-display/missing-route-probe.lua"))().collect(bridge)'));
  truth(driver.includes('semantic_observer:coverage_snapshot()'));
  for(const row of vfs.inputs.filter(row=>row.virtual.includes('/semantic-display/')||row.virtual.includes('/semantic-display-overlay/'))){
    const bytes=fs.readFileSync(row.physical);equal(bytes.length,row.bytes);equal(hash(bytes),row.sha256);
  }
}
const session=fs.readFileSync(path.join(here,'generated/native-reviewed-session.mjs'),'utf8');
truth(session.indexOf('await installReviewedResolverGuard(resolver);')<session.indexOf('installNativeSemanticBridge(module,resolver)'));
truth(session.includes('resolver.status.base_ids!==24845||resolver.status.extension_ids!==1||resolver.status.supplements!==499'));
if(manifest.profiles.includes('physical')){
const physical=fs.readFileSync(path.join(here,'generated/physical-play-browser.mjs'),'utf8');
truth(physical.indexOf('await installReviewedResolverGuard(resolver);')<physical.indexOf('installNativeSemanticBridge(module,resolver);'));
truth(physical.includes('physicalOwner.prepare()')&&physical.includes('await physicalOwner.start()')&&physical.includes('keyTarget:null'));
}
if(manifest.profiles.includes('prepared')){
const prepared=fs.readFileSync(path.join(here,'generated/prepared-observer.mjs'),'utf8');
truth(prepared.indexOf('await installReviewedResolverGuard(semanticResolver);')<prepared.indexOf('installNativeSemanticBridge(module,semanticResolver);'));
truth(prepared.indexOf("native('tome_native_init','number')")<prepared.indexOf('installNativeSemanticBridge(module,semanticResolver);'));
truth(prepared.indexOf('installNativeSemanticBridge(module,semanticResolver);')<prepared.indexOf("native('tome_native_start','number')"));
truth(prepared.includes('const saved=await saveBaselineCheckpoint(module,store,')&&prepared.includes('report.external_original_frame_calls++'));
}
const checked=[];
for(const file of [...fs.readdirSync(here).filter(name=>name.endsWith('.mjs')).map(name=>path.join(here,name)),
  ...manifest.outputs.filter(row=>row.file.endsWith('.mjs')).map(row=>path.join(here,row.file))]){
  const result=spawnSync(process.execPath,['--check',file],{windowsHide:true,encoding:'utf8'});
  equal(result.status,0,'Node syntax: '+file+'\n'+result.stderr);checked.push(path.relative(here,file));
}
const result={passed:true,assertions,node_syntax_files:checked,build_executed:false,native_or_browser_executed:false,
  original_or_shared_source_modified:false,integration_manifest_sha256:hash(fs.readFileSync(path.join(here,'integration-'+selectedProfile+'-source-manifest.json'))),memory:process.memoryUsage()};
fs.writeFileSync(path.join(here,'source-check-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
