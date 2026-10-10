#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Source-only freeze/verification; no integration/runtime imports.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const here=import.meta.dirname,work=path.resolve(here,'../..');
const profile=(process.argv.find(value=>value.startsWith('--profile='))||'--profile=semantic').slice(10);
assert.ok(['semantic','physical','prepared'].includes(profile),'Exact profile required');
const target=path.join(here,'source-freeze-'+profile+'.json'),manifestName='integration-'+profile+'-source-manifest.json';
const writeSelected=process.argv.includes('--write');
assert.ok(process.argv.slice(2).every(value=>value==='--write'||value==='--profile='+profile),'Use --profile=semantic|physical|prepared and optional --write');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(here,manifestName),'utf8'));
const names=new Set([
  ...fs.readdirSync(here).filter(name=>/\.(mjs|lua|md)$/.test(name)).map(name=>path.join(here,name)),
  path.join(here,manifestName),
  ...manifest.outputs.map(row=>path.join(here,row.file)),
  ...manifest.inputs.map(row=>path.join(work,row.file)),
  ...['merge-delta.mjs','stream-merge.mjs','prepare-merged-catalogs.mjs','candidate/source-manifest.json',
    'candidate/overlay/game/engines/default/engine/interface/ActorTalents.lua',
    'candidate/overlay/game/engines/default/engine/Faction.lua'].map(name=>path.join(here,'..',name)),
  ...['bootstrap-work/original_range_server.mjs','bootstrap-work/browser_vfs_mounts.mjs',
    ...(manifest.profiles.includes('physical')?['save-resume-work/baseline-save-resume.html']:[]),
    'localization-wasm-work/browser/semantic-text-wasm.mjs','localization-wasm-work/browser/native-semantic-bridge.mjs',
    ...(manifest.profiles.includes('physical')?['rust-platform-input-work/integration-web/physical-browser-scenario.mjs']:[]),
    ...(manifest.profiles.includes('prepared')?['mechanics-audit-work/prepared-map/integration-web/prepared_map_scenario.mjs']:[]),
    'native-core-work/browser_probe.mjs','native-core-work/monitor_native_job.py'].map(name=>path.join(work,name)),
]);
const files=[...names].sort().map(file=>{const bytes=fs.readFileSync(file);return {
  file:path.relative(work,file).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)};});
const current={schema_version:1,source_commit:manifest.source_commit,source_only:true,profiles:manifest.profiles,
  original_or_shared_source_modified:false,build_native_browser_or_server_executed:false,
  integration_manifest_sha256:sha(fs.readFileSync(path.join(here,manifestName))),files};
if(writeSelected)fs.writeFileSync(target,JSON.stringify(current,null,2)+'\n');
else{

  assert.deepEqual(current,JSON.parse(fs.readFileSync(target,'utf8')),'Reviewed source differs from frozen recipe');
}
console.log(JSON.stringify({passed:true,mode:writeSelected?'write':'verify',profile,files:files.length,
  freeze_bytes:fs.statSync(target).size,freeze_sha256:sha(fs.readFileSync(target)),source_only:true}));
