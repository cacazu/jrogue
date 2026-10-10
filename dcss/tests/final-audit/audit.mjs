// Read saved final receipts only. No game, WASM, browser, compiler, fetch or installed write.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const installed='C:/Users/kit/gameme/jnethack/jrouge/dcss';
const out=dirname(fileURLToPath(import.meta.url));
const source='1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const inputs=new Map(),assertions=[],gaps=[];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function file(relative){
  const path=join(installed,relative),bytes=readFileSync(path),stat=statSync(path);
  const receipt={path,relative,bytes:bytes.length,sha256:sha(bytes),modified_utc:stat.mtime.toISOString()};
  inputs.set(relative,receipt);return {bytes,receipt};
}
function json(relative){return JSON.parse(file(relative).bytes.toString('utf8').replace(/^\uFEFF/,''));}
function check(name,operation){operation();assertions.push(name);}
function sortedOutputs(outputs){return outputs.map(({name,bytes,sha256})=>({name,bytes,sha256})).sort((a,b)=>a.name.localeCompare(b.name));}
const manifest=json('engine/build-jspi/manifest.json');
const manifestFile=inputs.get('engine/build-jspi/manifest.json');
check('Current native manifest pins 0.34.1/official commit/JSPI/native Wasm exceptions/one startup ID',()=>{
  assert.equal(manifest.version,'0.34.1');assert.equal(manifest.upstream_commit,source);
  assert.equal(manifest.runtime,'jspi');assert.equal(manifest.exception_model,'wasm');
  assert.deepEqual(manifest.startup_text.ids,['startup.weapon.prompt']);
});
const outputs=sortedOutputs(manifest.outputs);
for(const expected of outputs)check('Actual native output size/hash: '+expected.name,()=>{
  const actual=file('engine/build-jspi/'+expected.name).receipt;
  assert.equal(actual.bytes,expected.bytes);assert.equal(actual.sha256,expected.sha256);
});
const boundary=file('build/boundary.wasm').receipt;
check('Current Rust boundary matches native preflight identity',()=>{
  assert.equal(boundary.bytes,manifest.startup_text.boundary_bytes);assert.equal(boundary.sha256,manifest.startup_text.boundary_sha256);
});
const browser=json('tests/output/core-browser-root-ja-final-20261002/core-browser-evidence.json');
check('Final real core browser receipt passes all18 checks on current native manifest',()=>{
  assert.equal(browser.result,'pass');assert.equal(browser.checks.length,18);
  assert.deepEqual(browser.build,manifest);assert.equal(browser.runtime,'jspi');
  assert.deepEqual({path:browser.root_route.path,query:browser.root_route.query,mode:browser.root_route.mode,language:browser.root_route.language},
    {path:'/',query:'',mode:'core',language:'ja'});
  assert.equal(browser.semanticBrowser.result,'pass');assert.equal(browser.lifecycleBrowser.result,'pass');
});
check('Final default JA weapon prompt has eight genuine CJK continuation cells',()=>{
  const cells=browser.root_startup.cjk_continuations;
  assert.equal(cells.length,8);assert.equal(cells.map(cell=>cell.character).join(''),'武器を選べます。');
  for(const cell of cells){assert.equal(cell.glyph,cell.character.codePointAt(0));assert.equal(cell.continuation,0);}
});
for(const [relative,expected]of Object.entries(browser.lifecycleBrowser.source_hashes))check('Browser original control source hash: '+relative,()=>{
  assert.equal(file('upstream/'+relative).receipt.sha256,expected);
});
const protocol=json('tests/output/protocol-current-startup-20261002/evidence.json');
const hostPaths={worker:'web/core-worker.js',debug:'web/core-debug.mjs',formatter:'web/startup-text.mjs',route:'web/default-route.mjs'};
check('Current protocol receipt is88 mocks in44/19/16/9 suites',()=>{
  assert.equal(protocol.result,'pass');assert.equal(protocol.count,88);
  assert.deepEqual(protocol.suites.map(suite=>suite.count),[44,19,16,9]);
  assert.equal(protocol.suites.reduce((count,suite)=>count+suite.count,0),88);
});
for(const [label,relative]of Object.entries(hostPaths))check('Current protocol host source hash: '+label,()=>{
  assert.equal(file(relative).receipt.sha256,protocol.source[label]);
});
check('Current formatter JS matches the native startup manifest',()=>{
  assert.equal(inputs.get(hostPaths.formatter).sha256,manifest.startup_text.bridge_sha256);
});
const paired={
  jaSmoke:json('tests/output/engine-smoke-paired-ja-20261002/smoke-result.json'),
  enSmoke:json('tests/output/engine-smoke-paired-en-20261002/smoke-result.json'),
  jaResume:json('tests/output/engine-resume-paired-ja-20261002/resume-result.json'),
  enResume:json('tests/output/engine-resume-paired-en-20261002/resume-result.json'),
  crossResume:json('tests/output/engine-resume-cross-ja-en-20261002/resume-result.json'),
};
for(const [label,value]of Object.entries(paired))check('Preserved native '+label+' passes all gates on actual current artifact',()=>{
  assert(!Object.hasOwn(value,'error'));assert.equal(value.tests.length,label.endsWith('Smoke')?8:5);
  value.tests.forEach(test=>assert.equal(test.pass,true));
  assert.equal(value.upstreamCommit,source);assert.equal(value.manifestSha256,manifestFile.sha256);
  assert.deepEqual(sortedOutputs(value.artifacts),outputs);assert.deepEqual(value.startupTextManifest,manifest.startup_text);
});
function snapshot(value){
  assert.equal(value.rng.length,45);
  assert.deepEqual(Object.keys(value).sort(),['engine','x','y','hp','maxHp','turn','xl','branch','depth','seed','rng'].sort());
  for(const generator of value.rng){
    assert.deepEqual(Object.keys(generator).sort(),['draws','sequence','state']);
    for(const text of Object.values(generator)){assert(/^(0|[1-9][0-9]*)$/.test(text));assert(BigInt(text)<1n<<64n);}
    assert.equal(BigInt(generator.sequence)&1n,1n);
  }
  return value;
}
function exact(name,left,right){
  check(name,()=>{for(const value of Array.isArray(left)?left:[left])snapshot(value);for(const value of Array.isArray(right)?right:[right])snapshot(value);assert.deepEqual(left,right);});
}
const parityComparisons=[];
function parity(name,left,right){exact(name,left,right);parityComparisons.push(name);}
for(const phase of ['fresh','throwing','normal','wait','afterSave'])parity('Exact JA/EN smoke snapshot '+phase,paired.jaSmoke.gameplayTrace[phase],paired.enSmoke.gameplayTrace[phase]);
check('Exact JA/EN first-throw/normal semantic events and45 draw deltas',()=>{
  const select=value=>value.tests.filter(test=>test.events).map(({events,drawDeltas})=>({events,drawDeltas}));
  assert.deepEqual(select(paired.jaSmoke),select(paired.enSmoke));
});parityComparisons.push('Exact JA/EN semantic events and draw deltas');
for(const key of ['fresh','checkpoint','resumedState','continuationSnapshots','resumedContinuationSnapshots'])parity('Exact JA/EN resume '+key,paired.jaResume[key],paired.enResume[key]);
check('Crosslocale JA->EN plan and same current artifact',()=>{
  assert.deepEqual(paired.crossResume.localePlan,{original:'ja',resumed:'en',crossLocale:true});
  assert.equal(paired.crossResume.resumedStartupText.language,'en');
  assert.equal(paired.crossResume.manifestSha256,manifestFile.sha256);
});parityComparisons.push('Crosslocale artifact identity');
for(const key of ['fresh','checkpoint','continuationSnapshots'])parity('Exact crosslocale original '+key,paired.crossResume[key],paired.jaResume[key]);
for(const key of ['resumedState','resumedContinuationSnapshots'])parity('Exact crosslocale restored '+key,paired.crossResume[key],paired.enResume[key]);
for(const [label,value]of Object.entries(paired).filter(([label])=>label.endsWith('Resume')))check('Native restoration/cache/three-turn guards retained: '+label,()=>{
  assert.equal(value.phase,'resumed-complete');assert.equal(value.coordinator.sequential,true);
  assert.notEqual(value.coordinator.children[0].processId,value.coordinator.children[1].processId);
  assert.deepEqual(value.restoredFiles,value.files);
  assert.equal(value.continuationSnapshots.length,3);assert.equal(value.resumedContinuationSnapshots.length,3);
  const logical=state=>({...state,rng:state.rng.map(({draws,...generator})=>generator)});
  assert.deepEqual(logical(value.resumedState),logical(value.checkpoint));
  for(let i=0;i<3;i++)assert.deepEqual(logical(value.resumedContinuationSnapshots[i]),logical(value.continuationSnapshots[i]));
  for(const previous of value.regenerableCaches.files){const actual=value.regenerableCaches.regeneratedFiles.find(file=>file.path===previous.path);assert(actual);if(previous.bytes>0)assert(actual.bytes>0);}
});
const parityReceipt=json('tests/output/native-locale-parity-evidence.json');
check('Saved paired comparison receipt agrees with independent17 comparisons and no excluded snapshot fields',()=>{
  assert.equal(parityReceipt.ok,true);assert.equal(parityReceipt.comparison_count,17);assert.equal(parityComparisons.length,17);
  assert.equal(parityReceipt.streams,45);assert.equal(parityReceipt.draw_counts_compared,true);
  assert.deepEqual(parityReceipt.ignored_snapshot_fields,[]);assert.equal(parityReceipt.source,source);
});
const adapter=json('tests/output/browser-evidence.json');
const adapterCopy=json('tests/output/adapter-browser-reference-final-20261002/browser-evidence.json');
const adapterMemory=json('tests/output/adapter-browser-reference-final-20261002/memory.summary.json');
file('tests/output/adapter-browser-reference-final-20261002/stdout.log');
check('Final explicit reference adapter passes9 checks on current Rust boundary and belongs to final monitored run',()=>{
  assert.equal(adapter.result,'pass');assert.equal(adapter.checks.length,9);
  assert.equal(adapter.wasm.bytes,boundary.bytes);assert.equal(adapter.wasm.sha256,boundary.sha256);
  assert.equal(adapterMemory.completed,true);assert.equal(adapterMemory.error,null);
  assert(Date.parse(adapter.time)>=Date.parse(adapterMemory.rootCreatedUtc));
  assert(Date.parse(adapter.time)<=Date.parse(adapterMemory.finishedUtc));
  assert.deepEqual(adapterCopy,adapter);
  assert.equal(inputs.get('tests/output/adapter-browser-reference-final-20261002/browser-evidence.json').sha256,
    inputs.get('tests/output/browser-evidence.json').sha256);
});
const delivery=json('tests/delivery-evidence.json');
check('Final delivery receipt honestly records the local milestone and exact active artifacts',()=>{
  assert.equal(delivery.result,'verified_local_milestone');assert.equal(delivery.release_ready,false);
  assert.equal(delivery.complete_japanese_game,false);assert.equal(delivery.source.commit,source);
  assert.equal(delivery.active.manifest.sha256,manifestFile.sha256);
  assert.equal(delivery.active.manifest.bytes,manifestFile.bytes);
  for(const expected of delivery.active.artifacts){
    const actual=inputs.get(expected.path)??file(expected.path).receipt;
    assert.equal(actual.bytes,expected.bytes);assert.equal(actual.sha256,expected.sha256);
  }
});
const controlledFlows=[];
for(const [flow,dir,count]of [
  ['combat','combat-2026-10-02T19-36-09-504Z',8],
  ['branch','branch-2026-10-02T19-37-22-450Z',10],
  ['death','death-2026-10-02T19-38-47-683Z',4],
  ['victory','victory-2026-10-02T19-39-37-159Z',4],
]){
  const value=json('tests/output/core-gameflows/'+dir+'/evidence.json');
  check('Final controlled '+flow+' passes '+count+' entries on actual current manifest',()=>{
    assert.equal(value.result,'pass');assert.equal(value.checks.length,count);
    assert.deepEqual(value.runtimeErrors,[]);assert.equal(value.manifest_sha256,manifestFile.sha256);
    assert.deepEqual(value.build,manifest);assert.equal(value.external_publication,false);
  });
  controlledFlows.push({flow,path:join(installed,'tests/output/core-gameflows',dir,'evidence.json'),count,checks:value.checks,fixture_scope:value.scope});
}
gaps.push({kind:'scope',detail:'Gameplay remains the official C++ engine behind Rust/browser adapters; these receipts do not prove complete Rust migration or complete Japanese text integration. Native startup display covers startup.weapon.prompt only, with locale pinned per session.'});
gaps.push({kind:'controlled_fixture',detail:'Final combat/branch/death/victory flows use genuine native wizard/DLua fixture preparation. They prove the exercised native control/exit paths, not an ordinary complete campaign or exhaustive mechanics coverage.'});
gaps.push({kind:'metadata',detail:'Current manifest still records candidate_only:true, release_ready:false and runtime_tests:"pending for final JS/data; this helper never starts the engine". Saved final receipts now provide actual narrower runtime evidence; the manifest status fields alone cannot establish release readiness.'});
gaps.push({kind:'native_counter_scope',detail:'Native save restoration serializes PCG state/increment words, not diagnostic draw counters. Matching-locale phase comparisons include all counts; do not describe the browser branch-restore fixture as persisting instrumentation counters.'});
gaps.push({kind:'historical_host_identity',detail:'Final controlled-flow receipts pin the native manifest and original source receipts but do not save historical Worker/core-debug hashes. Current host files match the saved 88-check protocol hashes; that establishes current identity, not a missing per-flow historical host hash.'});
const screenshots=[];
for(const dir of ['combat-2026-10-02T19-36-09-504Z','branch-2026-10-02T19-37-22-450Z','death-2026-10-02T19-38-47-683Z','victory-2026-10-02T19-39-37-159Z']){
  for(const name of readdirSync(join(installed,'tests/output/core-gameflows',dir)).filter(name=>name.endsWith('.png'))){
    const screenshot=file('tests/output/core-gameflows/'+dir+'/'+name).receipt;
    screenshots.push({...screenshot,priority:/goodbye|orb-exit|temple|retaliation/.test(name)?'high':'supporting'});
  }
}
for(const relative of ['tests/output/root-startup-ja.png','tests/output/core-mobile.png'])screenshots.push({...file(relative).receipt,priority:'high'});
check('Every audited installed evidence/artifact/source byte remains unchanged during read-only audit',()=>{
  for(const receipt of inputs.values())assert.equal(sha(readFileSync(receipt.path)),receipt.sha256);
});
const childFile=join(out,'controlled-flows-review.json'),childBytes=readFileSync(childFile);
const report={schema_version:1,ok:true,audited_utc:new Date().toISOString(),scope:'Saved final evidence and current byte identities only; no engine/browser/WASM/build executed and no installed writes.',
  source,current_manifest:manifestFile,current_native_outputs:outputs,rust_boundary:boundary,
  counts:{real_core_browser:18,protocol_mocks:88,protocol_suite_counts:[44,19,16,9],paired_native_smoke:[8,8],paired_native_resume:[5,5,5],independently_rechecked_locale_comparisons:17,reference_adapter_browser:9,controlled_flows:{combat:8,branch:10,death:4,victory:4},controlled_flow_entries:26,controlled_flow_distinct_check_strings:new Set(controlledFlows.flatMap(flow=>flow.checks)).size},
  assertions,files:[...inputs.values()],screenshots,controlled_flows:controlledFlows,concrete_gaps:gaps,
  controlled_flow_independent_review:'controlled-flows-review.json supplies separate child source/hash/line and screenshot detail; this audit independently verifies four final receipts and current manifest identities.',
  controlled_flow_review_file:{path:childFile,bytes:childBytes.length,sha256:sha(childBytes)},
  closed_notes:[{kind:'adapter_preservation',detail:'Final reference adapter snapshot is now preserved under adapter-browser-reference-final-20261002; it is byte-identical to the canonical 9-check receipt and matches the final monitor interval.'}],
  visual_inspection_performed:false};
writeFileSync(join(out,'audit.json'),JSON.stringify(report,null,2)+'\n');
const text=`Read-only final DCSS audit passed ${assertions.length} byte/schema/evidence checks. No engine, browser, WASM or build ran; installed files were not written.\n\n`+
  `The saved real core browser receipt passes 18 checks, protocol mocks 88 (44+19+16+9), paired native smoke 8+8, native resume 5+5+5, independent locale comparison 17 and explicit reference adapter 9. Final controlled combat/branch/death/victory pass 8/10/4/4 entries; the 26 entries contain 15 distinct check strings with repeated lifecycle/shared fixture checks. These are different scopes and are not an aggregate whole-game coverage count.\n\n`+
  `Current manifest SHA256: ${manifestFile.sha256}. All preserved paired native receipts and final embedded browser build use the same actual current JS/WASM/data and Rust boundary hashes. Source is official DCSS 0.34.1 commit ${source}.\n\n`+
  `See audit.json for exact absolute paths, hashes, counts, screenshots and concrete gaps; see controlled-flows-review.json for the separate final flow audit.\n\n`+
  gaps.map(gap=>`- ${gap.detail}`).join('\n')+'\n';
writeFileSync(join(out,'AUDIT.md'),text);
console.log(JSON.stringify({ok:true,checks:assertions.length,files:inputs.size,parity_comparisons:parityComparisons.length,manifest_sha256:manifestFile.sha256,gaps:gaps.map(gap=>gap.kind)}));
