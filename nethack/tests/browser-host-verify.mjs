/* Reproducible browser boundary evidence, added 2026-10-02. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../',import.meta.url));
const runtime = ['web/index.html','web/style.css','web/browser-ui.json','web/app.mjs','web/dom-ui.mjs','web/shim-host.mjs','web/save-store.mjs','web/engine/nethack.js','web/engine/nethack.wasm'];
const sources = ['tests/browser-host.test.mjs','tests/browser-host-wasm.test.mjs','tests/browser-host-verify.mjs','web/README.md','rust/Cargo.toml','rust/Cargo.lock','rust/nethack_layers.h','tools/build-upstream-abi.c','work/NetHack-5.0.0/win/shim/winshim.c','work/NetHack-5.0.0/sys/libnh/libnhmain.c'];
for (const name of readdirSync(resolve(root,'rust/src'))) if (name.endsWith('.rs')) sources.push(`rust/src/${name}`);
const digest = path => createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');
const hashes = paths => Object.fromEntries(paths.map(path => [path,digest(path)]));
const beforeRuntime = hashes(runtime);
const beforeSources = hashes(sources);
function verify(file,expected) {
  const command = ['--test','--test-reporter=spec',file];
  const result = spawnSync(process.execPath,command,{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
  process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
  if (result.error || result.status !== 0) throw result.error ?? new Error(`Boundary checks failed: ${file}`);
  const output = result.stdout.replace(/\u001b\[[0-9;]*m/g,'');
  const value = label => Number(output.match(new RegExp(`^[ℹ#]\\s+${label}\\s+(\\d+)`,'m'))?.[1] ?? -1);
  if (value('tests') !== expected || value('pass') !== expected || value('fail') !== 0 || value('skipped') !== 0) throw new Error(`Unexpected boundary totals: ${file}`);
  return expected;
}
const hostTests = verify('tests/browser-host.test.mjs',23);
const compiledTests = verify('tests/browser-host-wasm.test.mjs',6);
const afterRuntime = hashes(runtime);
const afterSources = hashes(sources);
if (JSON.stringify(beforeRuntime) !== JSON.stringify(afterRuntime) || JSON.stringify(beforeSources) !== JSON.stringify(afterSources)) throw new Error('Runtime/source changed while checks ran');
const buildManifest = 'build/build-manifest.json';
const report = {
  status:'passed',measured_at:new Date().toISOString(),
  source_commit:'16ff59115315917b93185d026aeefea06db9b0f4',abi:'nethack-shim-5.0.0-v1',
  wasm_sha256:afterRuntime['web/engine/nethack.wasm'],
  host_tests:hostTests,compiled_boundary_tests:compiledTests,total_passed:hostTests+compiledTests,failed:0,skipped:0,
  command:'node tests/browser-host-verify.mjs',
  runtime_sha256:afterRuntime,source_sha256:afterSources,
  ...(existsSync(resolve(root,buildManifest)) ? {engine_build_manifest_sha256:digest(buildManifest)} : {}),
  limits:['Focused host checks use mock engine memory; compiled boundary checks call actual Rust/C exports without starting a game.','Actual gameplay, desktop/mobile input and real-game save/restore are verified separately by integration-browser.mjs.','English game prose is explicit untranslated output; these checks do not establish Japanese game text coverage.']
};
const destination = resolve(root,'build/browser-boundary-verification.json');
writeFileSync(destination,`${JSON.stringify(report,null,2)}\n`,'utf8');
process.stdout.write(`Verified ${report.total_passed} boundary checks; ${relative(root,destination)}; WASM ${report.wasm_sha256}\n`);
