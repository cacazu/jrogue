/* Execute only with parent BUILD_DONE/CLIPPY_DONE + fresh headroom approval.
 * Child Node processes run serially; at most one live WASM instance exists.
 * This report does not establish actual native callback/browser acceptance. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../',import.meta.url));
const runtime = ['web/index.html','web/style.css','web/browser-ui.json','web/gameplay-core.json','web/app.mjs','web/dom-ui.mjs','web/shim-host.mjs','web/save-store.mjs','web/engine/nethack.js','web/engine/nethack.wasm'];
const sources = ['tests/browser-host.test.mjs','tests/browser-host-semantic.test.mjs','tests/browser-host-wasm.test.mjs','tests/browser-host-semantic-wasm.test.mjs','tests/browser-host-semantic-compiled-verify.mjs','locales/gameplay-core.json','rust/nethack_layers.h','tools/build-upstream-abi.c','work/NetHack-5.0.0/win/shim/winshim.c'];
for (const name of ['nh-semantic','nh-semantic-name','nh-quest-semantic']) {
  sources.push(`work/NetHack-5.0.0/src/${name}.c`,`work/NetHack-5.0.0/include/${name}.h`);
}
for (const name of readdirSync(resolve(root,'rust/src'))) if (name.endsWith('.rs')) sources.push(`rust/src/${name}`);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = paths => Object.fromEntries(paths.map(path => [path,digest(readFileSync(resolve(root,path)))]));
const beforeRuntime = hashes(runtime), beforeSources = hashes(sources);
if (beforeRuntime['web/gameplay-core.json'] !== beforeSources['locales/gameplay-core.json']) throw new Error('Installed gameplay catalog differs from canonical source');
const expectedWasm = process.env.NETHACK_EXPECT_WASM_SHA256;
if (expectedWasm && beforeRuntime['web/engine/nethack.wasm'] !== expectedWasm) throw new Error('Compiled engine is not the parent-approved build');
const commands = [], stages = [];
function stage(files,expected,kind) {
  const args = ['--max-old-space-size=128','--test','--test-concurrency=1','--test-reporter=tap',...files];
  commands.push(`node ${args.join(' ')}`);
  const started = performance.now();
  const result = spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:1024*1024});
  if (result.error || result.status !== 0) { process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? ''); throw result.error ?? new Error(`${kind} failed`); }
  const count = label => Number(result.stdout.match(new RegExp(`^# ${label} (\\d+)`,'m'))?.[1] ?? -1);
  if (count('tests') !== expected || count('pass') !== expected || count('fail') !== 0 || count('skipped') !== 0 || count('cancelled') !== 0) throw new Error(`Unexpected ${kind} totals`);
  const measured = {kind,tests:expected,passed:expected,failed:0,skipped:0,duration_ms:Math.round(performance.now()-started),tap_sha256:digest(result.stdout)};
  stages.push(measured); process.stdout.write(`${kind}: ${expected}/${expected} passed\n`);
}
stage(['tests/browser-host.test.mjs','tests/browser-host-semantic.test.mjs'],47,'pure/mock browser source');
stage(['tests/browser-host-wasm.test.mjs'],6,'existing compiled platform regression');
stage(['tests/browser-host-semantic-wasm.test.mjs'],14,'actual compiled semantic boundary');
const afterRuntime = hashes(runtime), afterSources = hashes(sources);
if (JSON.stringify(beforeRuntime) !== JSON.stringify(afterRuntime) || JSON.stringify(beforeSources) !== JSON.stringify(afterSources)) throw new Error('Runtime/source changed during serial checks');
const report = {
  status:'passed',measured_at:new Date().toISOString(),phase:'semantic-compiled-boundary',
  source_commit:'16ff59115315917b93185d026aeefea06db9b0f4',abi:'nethack-shim-5.0.0-v1',
  host_mock_tests:23,semantic_mock_tests:24,compiled_platform_tests:6,compiled_semantic_tests:14,total_passed:67,failed:0,skipped:0,
  wasm_sha256:afterRuntime['web/engine/nethack.wasm'],runtime_sha256:afterRuntime,source_sha256:afterSources,
  command:'node --max-old-space-size=128 tests/browser-host-semantic-compiled-verify.mjs',commands,stages,
  compiled_boundary_verified:true,compiled_pipeline_verified:false,native_callback_semantics_verified:false,browser_invoked:false,compiler_invoked:false,server_invoked:false,maximum_concurrent_wasm_instances:1,v8_old_space_limit_mib:128,peak_rss_measured:false,
  source_only_checkpoint_sha256:digest(readFileSync(resolve(root,'build/browser-semantic-source-verification.json'))),
  historical_phase2_evidence_sha256:digest(readFileSync(resolve(root,'build/browser-boundary-verification.json'))),
  coverage:['Actual compiled Rust/C exports and off-callback getter eligibility; complete 3026-entry catalog validation and representative source hash IDs.','Actual Rust helper/accessibility/printf/i64/u64/UTF8 formatting, nested appearance/name grammar, fallback propagation, whole quest source-union guards, buffer canaries, depth and expansion limits.','Repeated formatter and out-of-scope getter calls preserve compiled native state/world/RNG checksums; actual gameplay is not started in these checks.'],
  limits:['Formatter envelopes are synthetic boundary inputs, not proof that native gameplay producers capture correct source IDs/public knowledge.','Actual callback association, visible Japanese gameplay, native quest/name producers, locale/mobile behavior and real save/restore require separate actual browser acceptance.','No historical phase 2 or source-only checkpoint was overwritten.']
};
writeFileSync(resolve(root,'build/browser-semantic-compiled-verification.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');
process.stdout.write(`Verified ${report.total_passed} serial checks; WASM ${report.wasm_sha256}; build/browser-semantic-compiled-verification.json\n`);
