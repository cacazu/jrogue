import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,''));
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex');
const checkpoint=read('docs/CURRENT-CHECKPOINT.json');
checkpoint.recorded_utc=new Date().toISOString();
checkpoint.heavy_job_hold={active:false,source:'Parent explicitly released one necessary serial compiler/runtime job at a time',explicit_release_received:true,no_auto_review_rejection:true,resource_policy:'Measure current headroom and actual job peak; no concurrent DRL heavy jobs'};
const mixed=read('experiments/lua-wasi/node-mixed-evidence.json');
const audit=read('experiments/lua-wasi/link-audit.json');
const json=read('toolchain/packages-exnref/fcl-json/units/wasm32-wasip1/build-evidence.json');
const clippy=read('port/tests/output/current-clippy-memory.json');
const rust=read('port/tests/output/current-rust-tests-memory.json');
const results=fs.readFileSync(path.join(root,'port/tests/output/current-rust-tests-memory.json.stdout.log'),'utf8');
const passed=[...results.matchAll(/test result: ok\. (\d+) passed;/g)].reduce((sum,match)=>sum+Number(match[1]),0);
const wasm=read('port/tests/output/current-wasm-memory.json');
const browser=read('port/tests/output/core-host-browser.json');
const browserMemory=read('port/tests/output/current-host-browser-memory.json');
const core=read('core-adapted/build/browser-core/link-evidence.json');
const coreMemory=read('core-adapted/build/browser-core/memory-evidence.json');
const original=read('port/tests/output/original-game/evidence.json');
const originalMemory=read('port/tests/output/original-game-memory.json');
const combat=read('docs/ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json');
const combatMemory=read('docs/original-combat-browser-memory.json');
const finalAllocator=read('docs/CORE-ALLOCATOR-AUDIT.json');
const geometry=fs.existsSync(path.join(root,'docs/core-geometry-runtime-evidence.json'))?
  read('docs/core-geometry-runtime-evidence.json'):null;
const nativeRecords=fs.readdirSync(path.join(root,'localization/native-probe-build'),{withFileTypes:true})
  .filter(entry=>entry.isDirectory()&&fs.existsSync(path.join(root,'localization/native-probe-build',entry.name,'result.json')))
  .map(entry=>({file:`localization/native-probe-build/${entry.name}/result.json`,record:read(`localization/native-probe-build/${entry.name}/result.json`)}));
const nativeProbes={};
for(const probe of ['semantic','json-contract','feeling','item','history']){
  const latest=nativeRecords.filter(value=>value.record.probe===probe)
    .sort((a,b)=>(b.record.execution?.finishedUtc??b.record.compilation?.finishedUtc??'').localeCompare(a.record.execution?.finishedUtc??a.record.compilation?.finishedUtc??''))[0];
  if(latest)nativeProbes[probe]={evidence:latest.file,passed:latest.record.passed,
    compilation_exit:latest.record.compilation?.exitCode,execution_exit:latest.record.execution?.exitCode,
    fixture_sha256:latest.record.sourceSha256,executed_units:latest.record.unitSourceSha256,
    output:latest.record.execution?.stdout??null,full_game_executed:false};
}
checkpoint.executed_runtime_checks={mixed_pascal_lua:{result:mixed.result,wasm_sha256:mixed.wasm_sha256,output:mixed.output},allocator_object_audit:{result:audit.result,selected_libc_objects:audit.selected_libc_objects.length,allocator_references:audit.selected_allocator_references.length},json_runtime_subset:{exit_code:json.exit_code,units:json.units.map(unit=>({name:unit.name,built:unit.built})),scope:json.scope},current_rust:{clippy_exit:clippy.exit_code,tests_exit:rust.exit_code,tests_passed:passed,peak_commit_bytes:rust.exact_job_peak_commit_bytes,minimum_sampled_free_commit_bytes:rust.minimum_sampled_headroom_bytes.commit,wasm_exit:wasm.exit_code,wasm_sha256:hash('port/dist/drl_web_port.wasm')},native_localization_fixtures:nativeProbes,core_host_browser:{result:browser.result,checks_passed:27,evidence:'port/tests/output/core-host-browser.json',scope:browser.scope,peak_commit_bytes:browserMemory.exact_job_peak_commit_bytes},original_core_link:{result:core.result,wasm_sha256:core.wasm_sha256,wasm_bytes:core.wasm_bytes,imports_validated:core.imports_validated,source_inputs_unchanged:core.source_inputs_unchanged,archives_unchanged:core.archives_unchanged,compiled_source_records:core.compiled_sources?.files.length??0,peak_commit_bytes:coreMemory.exact_job_peak_commit_bytes,corresponding_source_evidence_complete:core.imports_validated&&core.compiled_sources?.files.length>0}};
checkpoint.full_port_complete=false;checkpoint.local_browser_verified=false;
checkpoint.basic_original_game_browser_verified=original.result==='pass'&&original.artifacts?.['drl-core.wasm']?.sha256===core.wasm_sha256&&original.artifacts?.['drl_web_port.wasm']?.sha256===hash('port/dist/drl_web_port.wasm');
checkpoint.executed_runtime_checks.platform_timestamps=read('docs/PLATFORM-TIMESTAMP-EVIDENCE.json');
checkpoint.executed_runtime_checks.final_notice_retention=read('docs/FINAL-NOTICE-RETENTION.json');
checkpoint.executed_runtime_checks.original_game_browser={result:original.result,
  checks_passed:original.checks.length,evidence:'port/tests/output/original-game/evidence.json',
  scope:original.scope,error:original.error??null,remaining_gates:original.remaining_gates??[],
  artifacts:original.artifacts??null,peak_commit_bytes:originalMemory.exact_job_peak_commit_bytes,
  complete_world_witness:false,full_campaign_verified:false};
checkpoint.executed_runtime_checks.final_core_allocator_audit={...finalAllocator,
  evidence:'docs/CORE-ALLOCATOR-AUDIT.json',matches_current_core:finalAllocator.wasm_sha256===core.wasm_sha256};
checkpoint.executed_runtime_checks.original_combat_autorun={result:combat.result,checks_passed:combat.checks.length,evidence:'docs/ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json',scope:combat.scope,remaining_gates:combat.remaining_gates,artifacts:combat.artifacts,peak_commit_bytes:combatMemory.exact_job_peak_commit_bytes,matches_current_pair:combat.artifacts.core.sha256===core.wasm_sha256&&combat.artifacts.adapter.sha256===hash('port/dist/drl_web_port.wasm'),full_world_verified:false};
checkpoint.executed_runtime_checks.actual_vtig_geometry=geometry;
if(fs.existsSync(path.join(root,'docs/ORIGINAL-DEATH-RUNTIME-EVIDENCE.json'))){
  const death=read('docs/ORIGINAL-DEATH-RUNTIME-EVIDENCE.json'),memory=read('docs/original-death-browser-memory.json');
  if(death.result!=='pass'||death.artifacts.core.sha256!==core.wasm_sha256||death.artifacts.adapter.sha256!==hash('port/dist/drl_web_port.wasm'))throw Error('Death evidence does not match current pair');
  checkpoint.executed_runtime_checks.original_death_report_profile={result:death.result,checks_passed:death.checks.length,evidence:'docs/ORIGINAL-DEATH-RUNTIME-EVIDENCE.json',scope:death.scope,localization_findings:death.localization_findings,artifacts:death.artifacts,peak_commit_bytes:memory.exact_job_peak_commit_bytes,matches_current_pair:true,full_world_verified:false};
}
if(fs.existsSync(path.join(root,'docs/SOURCE-CLEAN-BUILD-EVIDENCE.json'))){
  const clean=read('docs/SOURCE-CLEAN-BUILD-EVIDENCE.json'),fresh=fs.existsSync(path.join(root,'docs/CLEAN-SOURCE-BROWSER-EVIDENCE.json'))?read('docs/CLEAN-SOURCE-BROWSER-EVIDENCE.json'):null;
  checkpoint.executed_runtime_checks.corresponding_source_clean_compile={result:clean.result,clean_compile_verified:clean.clean_compile_verified===true,core_byte_exact:clean.core_byte_exact===true,adapter_byte_exact:clean.adapter_byte_exact===true,archive_sha256:clean.archive_sha256,core_sha256:clean.core_sha256,adapter_sha256:clean.adapter_sha256,rebuilt_adapter_sha256:clean.rebuilt_adapter_sha256,compiled_sources:clean.compiled_sources,source_files:clean.authenticated_source?.source_files,vendor_packages:23,game_objects_copied:clean.game_objects_copied,game_wasm_copied:clean.game_wasm_copied,full_toolchain_bootstrap_verified:false,evidence:'docs/SOURCE-CLEAN-BUILD-EVIDENCE.json',isolated_rebuilt_browser:fresh?{result:fresh.result,evidence:'docs/CLEAN-SOURCE-BROWSER-EVIDENCE.json',checks_passed:fresh.checks_passed??fresh.browser?.checks?.length??fresh.checks?.length??null}:null};
}

checkpoint.next_executable_gate_after_release=['complete canonical state/render witness beyond bounded DRLP/MT','campaign transitions, win/challenge and remaining gameplay flows; death/profile are separately gated','complete semantic text dispositions and wider locale refresh','full toolchain bootstrap and local destination delivery; clean game sources are separately gated'];
fs.writeFileSync(path.join(root,'docs/CURRENT-CHECKPOINT.json'),JSON.stringify(checkpoint,null,2)+'\n');
console.log(JSON.stringify({mixed:mixed.result,allocator_audit:audit.result,json_units:json.units.length,rust_tests:passed,heavy_hold:false,full_port_complete:false}));
