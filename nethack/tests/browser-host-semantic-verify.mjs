/* Source-only phase 3 evidence. No WASM factory, browser, compiler or server. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../',import.meta.url));
const tests = ['tests/browser-host.test.mjs','tests/browser-host-semantic.test.mjs'];
const syntax = ['web/shim-host.mjs','web/dom-ui.mjs','web/app.mjs','tests/browser-host-semantic.test.mjs','tests/browser-host-semantic-verify.mjs'];
const inputs = [...new Set([...syntax,...tests,'web/save-store.mjs','web/browser-ui.json','web/index.html','locales/gameplay-core.json','upstream/NetHack-5.0.0/win/shim/winshim.c','work/NetHack-5.0.0/win/shim/winshim.c'])];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = () => Object.fromEntries(inputs.map(path => [path,digest(readFileSync(resolve(root,path)))]));
const before = hashes();
const nodeArgs = ['--max-old-space-size=128','--test','--test-reporter=tap',...tests];
const result = spawnSync(process.execPath,nodeArgs,{cwd:root,encoding:'utf8',maxBuffer:1024*1024});
if (result.error || result.status !== 0) { process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? ''); throw result.error ?? new Error('Pure/mock source checks failed'); }
const count = label => Number(result.stdout.match(new RegExp(`^# ${label} (\\d+)`,'m'))?.[1] ?? -1);
const total = count('tests');
if (total !== 47 || count('pass') !== total || count('fail') !== 0 || count('skipped') !== 0 || count('cancelled') !== 0) throw new Error('Unexpected source-check totals');
const commands = [`node ${nodeArgs.join(' ')}`];
for (const path of syntax) {
  const args = ['--max-old-space-size=128','--check',path];
  const checked = spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:65536});
  if (checked.error || checked.status !== 0) throw checked.error ?? new Error(`Source syntax failed: ${path}\n${checked.stderr}`);
  commands.push(`node ${args.join(' ')}`);
}
const after = hashes();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Source inputs changed during finite checks');
const report = {
  status:'passed',measured_at:new Date().toISOString(),phase:'semantic-source-only',
  source_commit:'16ff59115315917b93185d026aeefea06db9b0f4',abi:'nethack-shim-5.0.0-v1',
  host_mock_tests:23,semantic_mock_tests:24,total_passed:total,failed:0,skipped:0,cancelled:0,syntax_checks:syntax.length,
  command:'node --max-old-space-size=128 tests/browser-host-semantic-verify.mjs',commands,
  compiled_pipeline_verified:false,wasm_instantiated:false,wasm_factory_imported:false,browser_invoked:false,compiler_invoked:false,server_invoked:false,
  v8_old_space_limit_mib:128,peak_rss_measured:false,
  source_sha256:after,tap_sha256:digest(result.stdout),
  historical_phase2_evidence_sha256:digest(readFileSync(resolve(root,'build/browser-boundary-verification.json'))),
  coverage:['Typed immutable events, exact i64/u64 serialization, bounded nested public-name events and explicit invalid-event English fallback.','Actual callback shape mocked: synchronous capture, original-English native history, noHistory/urgent attributes, original menu accelerators and prompt response bytes.','Additive Rust ABI mocked: whole envelope, helper/accessibility ownership, argument union, locale repaint preserving drafts/selections/input handlers.','Quest grouping mocked: exact callback/window identity, every line and public argument, complete contiguous original-row overlay, conflicts/duplicates/qualifiers/missing rows retain originals, bounded staging.'],
  limits:['No phase 3 native or Rust code was compiled or executed. No WASM module or browser was loaded.','Native producer association, real Rust formatting, full gameplay coverage, actual locale repaint and RNG invariance require the separately authorized compiled/browser phase.','Catalog hash binds source only; runtime gameplay-core.json installation and new compiled exports remain pending.','Historical phase 2 compiled/browser evidence is preserved and does not validate this changed semantic source pipeline.']
};
const destination = resolve(root,'build/browser-semantic-source-verification.json');
writeFileSync(destination,`${JSON.stringify(report,null,2)}\n`,'utf8');
process.stdout.write(`Source-only checks passed: ${total}/${total}; syntax ${syntax.length}/${syntax.length}; build/browser-semantic-source-verification.json\n`);
