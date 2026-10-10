// Postpackage delivery receipt. It never modifies gameplay, saves, or Git.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readFile,writeFile,mkdir,readdir,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const task=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const repository=path.resolve('C:/Users/kit/gameme/jnethack/jrouge');
const shared=path.join(repository,'drl');
assert.equal((await realpath(repository)).toLowerCase(),repository.toLowerCase());
const json=async relative=>JSON.parse(await readFile(path.join(task,relative),'utf8'));
async function noLinks(file){let current=path.parse(file).root;for(const part of file.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);assert.equal((await lstat(current)).isSymbolicLink(),false,current);}}
async function hash(file){await noLinks(file);const digest=createHash('sha256');let size=0;for await(const bytes of fs.createReadStream(file)){size+=bytes.length;digest.update(bytes);}return{size,sha256:digest.digest('hex')};}
const primary=await json('docs/ORIGINAL-GAME-RUNTIME-EVIDENCE.json');
const combat=await json('docs/ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json');
const death=await json('docs/ORIGINAL-DEATH-RUNTIME-EVIDENCE.json');
const browser=await json('docs/SHARED-LOCAL-BROWSER-EVIDENCE.json');
const server=await json('docs/LOCAL-SERVER-EVIDENCE.json');
const visual=await json('docs/SHARED-LOCAL-VISUAL-QA.json');
const clean=await json('docs/SOURCE-CLEAN-BUILD-EVIDENCE.json');
const cleanBrowser=await json('docs/CLEAN-SOURCE-BROWSER-EVIDENCE.json');
const adapterDiff=await json('docs/CLEAN-RUST-ADAPTER-DIFF.json');
const bundle=await json('port/dist/source-bundle.json');
const build=await json('port/dist/build.json');
const plan=await json('docs/core-source-package-plan.json');
const amendment=await json('docs/HANDOFF-VERIFIER-AMENDMENT-EVIDENCE.json');
const current=await json('core-adapted/build/browser-core/link-evidence.json');
assert.equal(clean.clean_compile_verified,true);assert.equal(clean.core_byte_exact,true);assert.equal(clean.adapter_byte_exact,false);
assert.equal(clean.full_toolchain_bootstrap_verified,false);assert.equal(clean.game_objects_copied,false);assert.equal(clean.game_wasm_copied,false);
const fresh=JSON.parse(await readFile(path.join(clean.root,'core-adapted/build/browser-core/link-evidence.json'),'utf8'));
for(const [receipt,count] of [[primary,15],[combat,6],[death,8],[browser,3]]){
  assert.equal(receipt.result,'pass');assert.equal(receipt.checks.length,count);assert.deepEqual(receipt.browser_errors,[]);
  for(const check of receipt.checks)assert.equal(check.result,'pass');
}
assert.equal(cleanBrowser.result,'pass');assert.equal(cleanBrowser.browser.checks.length,15);assert.equal(cleanBrowser.browser.result,'pass');assert.deepEqual(cleanBrowser.browser.browser_errors,[]);
assert.equal(adapterDiff.result,'pass');assert.equal(adapterDiff.core_byte_exact,true);assert.equal(adapterDiff.clean_compilation_verified,true);
assert.equal(server.result,'pass');assert.equal(server.url,'http://127.0.0.1:4189/game.html');assert.equal(server.loopback_only,true);
assert.equal(server.files.length,8);assert.equal(server.external_deployment,false);
assert.equal(visual.result,'pass');assert.equal(visual.reviewed_by,'/root');assert.equal(visual.screenshots.length,2);
for(const shot of browser.screenshots){const inspected=visual.screenshots.find(x=>x.sha256===shot.sha256);assert.ok(inspected);assert.equal(inspected.inspected,true);assert.deepEqual(await hash(shot.file),{size:shot.size,sha256:shot.sha256});}
const exact=items=>items.map(({path,size,sha256})=>({path,size,sha256})).sort((a,b)=>a.path.localeCompare(b.path,'en'));
assert.equal(current.compiled_sources.unresolved.length,0);assert.equal(fresh.compiled_sources.unresolved.length,0);
assert.equal(current.compiled_sources.files.length,139);
assert.deepEqual(exact(current.compiled_sources.files),exact(fresh.compiled_sources.files));
assert.deepEqual(exact(plan.core.selectedUnits),exact(current.compiled_sources.files));
assert.equal(current.source_inputs.files.length,14416);
assert.deepEqual(exact(current.source_inputs.files),exact(fresh.source_inputs.files));
assert.equal(plan.core.sourceSnapshotSha256,current.source_inputs.sha256);assert.equal(current.source_inputs.sha256,fresh.source_inputs.sha256);
const selected=new Map(plan.files.map(x=>[x.path,x]));
const currentInputs=new Map(current.source_inputs.files.map(x=>[x.path,x]));
const freshInputs=new Map(fresh.source_inputs.files.map(x=>[x.path,x]));
assert.equal(plan.core.sourceMappings.length,13776);
for(const mapping of plan.core.sourceMappings){
  const published=selected.get(mapping.sourcePath),a=currentInputs.get(mapping.buildPath),b=freshInputs.get(mapping.buildPath);
  assert.ok(published&&a&&b,mapping.sourcePath);assert.equal(published.sha256,mapping.sha256);assert.equal(a.sha256,mapping.sha256);assert.equal(b.sha256,mapping.sha256);assert.equal(published.size,a.size);assert.equal(a.size,b.size);
}
for(const unit of plan.core.selectedUnits){assert.equal(selected.get(unit.path)?.sha256,unit.sha256);assert.equal(selected.get(unit.path)?.size,unit.size);}
const artifacts={};
for(const relative of ['port/dist/source.zip','port/dist/source-bundle.json','port/dist/drl-core.wasm','port/dist/drl_web_port.wasm','port/dist/game.html','port/dist/index.html']){
  const a=await hash(path.join(task,relative)),b=await hash(path.join(shared,relative));assert.deepEqual(b,a,relative);artifacts[relative]=a;
}
assert.equal(artifacts['port/dist/source.zip'].sha256,bundle.sha256);assert.equal(artifacts['port/dist/source.zip'].size,bundle.size);
assert.equal(amendment.result,'pass');assert.equal(amendment.archive_sha256,bundle.sha256);assert.equal(amendment.plan_sha256,(await hash(path.join(task,'docs/core-source-package-plan.json'))).sha256);assert.equal(amendment.full_decompressed_readback,true);
assert.equal(plan.sourceFiles,bundle.source_files);assert.equal(plan.sourceFiles,plan.files.length);assert.equal(plan.sourceBytes,plan.files.reduce((n,x)=>n+x.size,0));
const core=build.core.sha256,adapter=build.adapter.sha256;
assert.equal(clean.core_sha256,core);assert.equal(clean.rebuilt_core_sha256,core);assert.equal(clean.adapter_sha256,adapter);
assert.equal(adapterDiff.core_sha256,core);assert.equal(adapterDiff.source_archive_sha256,clean.archive_sha256);
assert.equal(adapterDiff.original.sha256,adapter);assert.equal(adapterDiff.clean.sha256,clean.rebuilt_adapter_sha256);
assert.equal(cleanBrowser.pins.archive,clean.archive_sha256);assert.equal(cleanBrowser.pins.core,core);
assert.equal(cleanBrowser.pins.deployedAdapter,adapter);assert.equal(cleanBrowser.pins.cleanAdapter,clean.rebuilt_adapter_sha256);
assert.equal(cleanBrowser.browser.artifacts['drl-core.wasm'].sha256,core);
assert.equal(cleanBrowser.browser.artifacts['drl_web_port.wasm'].sha256,clean.rebuilt_adapter_sha256);
assert.equal(cleanBrowser.current_runtime_changed,false);assert.equal(cleanBrowser.original_archive_changed,false);
assert.equal(core,artifacts['port/dist/drl-core.wasm'].sha256);assert.equal(adapter,artifacts['port/dist/drl_web_port.wasm'].sha256);
assert.equal(plan.core.sha256,core);assert.equal(current.wasm_sha256,core);assert.equal(fresh.wasm_sha256,core);assert.equal(bundle.core_sha256,core);
assert.equal(primary.artifacts['drl-core.wasm'].sha256,core);assert.equal(primary.artifacts['drl_web_port.wasm'].sha256,adapter);
for(const receipt of [combat,death]){assert.equal(receipt.artifacts.core.sha256,core);assert.equal(receipt.artifacts.adapter.sha256,adapter);}
for(const receipt of [browser,server]){assert.equal(receipt.core_sha256,core);assert.equal(receipt.adapter_sha256,adapter);assert.equal(receipt.source_archive_sha256,bundle.sha256);}
for(const relative of ['tools/verify-shared-drl-browser.mjs','tools/start-shared-local-server.ps1','tools/write-local-handoff-evidence.mjs','tools/amend-handoff-verifier.ps1']){
  const bytes=await hash(path.join(task,relative));assert.equal(bytes.sha256,selected.get(relative)?.sha256);assert.equal(bytes.size,selected.get(relative)?.size);assert.deepEqual(await hash(path.join(shared,relative)),bytes);
}
const native=await json('docs/native-source-manifest.json');assert.equal(native.files.length,305);assert.equal(native.modified_gameplay_files,0);
let nativeBytes=0;
for(const original of native.files){const expected={size:original.bytes,sha256:original.sha256};assert.deepEqual(await hash(path.join(task,original.file)),expected);assert.deepEqual(await hash(path.join(shared,original.file)),expected);nativeBytes+=original.bytes;}
assert.equal(nativeBytes,3486100);
const notice=await json('docs/FINAL-NOTICE-RETENTION.json');
const allocator=await json('docs/CORE-ALLOCATOR-AUDIT.json');
const memory=await json('docs/shared-local-browser-memory.json');
assert.equal(memory.exit_code,0);
assert.equal(notice.result,'pass');assert.equal(notice.core_sha256,core);assert.equal(notice.permission_files,56);
assert.equal(allocator.result,'pass');assert.equal(allocator.wasm_sha256,core);assert.deepEqual(allocator.errors,[]);
const evidence={schema:1,result:'pass-with-open-scope',recorded_utc:new Date().toISOString(),scope:'Verified local HTML/Node original-game checkpoint; explicitly incomplete full task',destination:shared,url:server.url,server_pid:server.pid,external_deployment:false,full_port_complete:false,full_local_browser_scope_verified:false,basic_original_game_browser_verified:true,original_core_language:'Pascal/Lua',rust_scope:'Display, input, platform and a delegating application/reference contract; not a full Rust gameplay rewrite',source_commit:native.source_commit,engine_commit:native.engine_commit,artifacts,source_files:plan.sourceFiles,source_bytes:plan.sourceBytes,source_archive_sha256:bundle.sha256,compiled_source_closure:{result:'pass',compiled_records:139,source_mappings:13776,source_input_records:14416,source_snapshot_sha256:current.source_inputs.sha256,unresolved:0,clean_compile_archive:clean.archive_sha256,final_archive_freshly_compiled:false,qualification:'Clean compilation and fresh-browser proof used historical881 archive. Final archive is linked by exact unchanged compiled/input/source-mapping records plus full ZIP readback. External pinned standard prerequisites were reused; no game objects/WASM copied.'},clean_rust_adapter:{raw_result:clean.result,byte_exact:false,original_sha256:adapter,rebuilt_sha256:clean.rebuilt_adapter_sha256,qualified_diff_evidence:'docs/CLEAN-RUST-ADAPTER-DIFF.json',diff_result:adapterDiff.result},browser_checks:{primary:15,combat:6,death_and_persistence:8,shared_handoff:3,fresh_clean_pair_primary:15,http_stream_hashes:8},screenshots_review:'docs/SHARED-LOCAL-VISUAL-QA.json',native_pristine:{files:305,bytes:nativeBytes,task_and_shared_byte_hashes_verified:true,gameplay_modified:false},licenses:{code:'DRL GPL-2.0; Valkyrie MIT and retained component headers; Lua MIT; RNG BSD-3-Clause',permitted_visual_assets:'22 byte-exact ASCII artwork files under CC BY-SA 4.0 with retained Derek Yu and Łukasz Śliwiński attribution; system fonts',excluded:'FMOD/Steam SDK bindings, DOOM audio, unreviewed fonts and proprietary runtime assets',notices:'docs/FINAL-NOTICE-RETENTION.json',allocator:'docs/CORE-ALLOCATOR-AUDIT.json'},memory:{shared_browser_peak_job_commit_bytes:memory.exact_job_peak_commit_bytes,shared_browser_minimum_headroom_bytes:memory.minimum_sampled_headroom_bytes},historical_receipt_scope:'The remaining_gates arrays copied from the primary-suite receipt in CURRENT-CHECKPOINT.json and delivery.json are per-suite historical lists. Their combat/zero-delay/death/clean-source gates are closed by the independent receipts; this handoff lists the current project-wide open scope.',remaining:['Canonical full owning-world state witness and render/locale/full-save purity, including enemy UID/HP, exact player-kill attribution, Lua graphs, all maps and transient native command/multimove state. DRLP/MT bounded checks do not prove full-world identity.','Normal/alternate campaigns beyond the selected first-floor flows; bosses, winning endings, challenges, awards and wider combat branches in real browser.','Complete semantic EN/JA coverage, including observed English Post mortem title, report footer, profile rank/requirements/seconds and HOF death description; dynamic producers and inventory discovery queues remain.','Full Rust gameplay/domain migration if still required; current native mechanics execute original Pascal/Lua.','Full compiler/toolchain bootstrap from corresponding source; this checkpoint rebuilt gameplay/adapter with authenticated existing standard prerequisites.','Parent-coordinated Git checkpoint only; no shared index, commit, push or global safe.directory changes performed.'],supporting_receipts:['docs/ORIGINAL-GAME-RUNTIME-EVIDENCE.json','docs/ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json','docs/ORIGINAL-DEATH-RUNTIME-EVIDENCE.json','docs/SOURCE-CLEAN-BUILD-EVIDENCE.json','docs/CLEAN-SOURCE-BROWSER-EVIDENCE.json','docs/CLEAN-RUST-ADAPTER-DIFF.json','docs/HANDOFF-VERIFIER-AMENDMENT-EVIDENCE.json','docs/SHARED-LOCAL-BROWSER-EVIDENCE.json','docs/LOCAL-SERVER-EVIDENCE.json','docs/LOCAL-RUNTIME-CHECKPOINT.json','docs/LOCAL-SUPPORT-CHECKPOINT.json','docs/FULL-STATE-WITNESS-NEXT.md']};
assert.ok(notice&&allocator);
const output=JSON.stringify(evidence,null,2)+'\n';
for(const root of [task,shared]){await noLinks(root);await mkdir(path.join(root,'docs'),{recursive:true});await writeFile(path.join(root,'docs/FINAL-LOCAL-HANDOFF.json'),output);}
console.log(JSON.stringify({result:evidence.result,url:evidence.url,source_files:plan.sourceFiles,source_archive_sha256:bundle.sha256,primary:15,combat:6,death:8,shared:3,full_port_complete:false}));
