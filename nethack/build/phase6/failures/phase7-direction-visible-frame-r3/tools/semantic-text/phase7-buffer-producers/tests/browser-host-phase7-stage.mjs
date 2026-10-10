/* Added 2026-10-02, NGPL. Import/load starts no compiler/server/browser/WASM.
 * This explicit isolated-stage reader never falls back to current web/reports.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const hash=value=>createHash('sha256').update(value).digest('hex');
const pattern=/^[0-9a-f]{64}$/;
const inside=(base,path)=>{const rel=relative(base,path);return rel!=='..'&&!rel.startsWith(`..${sep}`)&&!isAbsolute(rel);};
const files=['engine/nethack.js','engine/nethack.wasm','app.mjs','shim-host.mjs','registered-catalog-host.mjs','dom-ui.mjs','save-store.mjs','browser-ui.json','gameplay-core.json','index.html','style.css'];

export async function loadPhase7Stage({configPath,configSha256,parentAuthorizedSerialRun=false,repaintInvariant=null}) {
  assert.ok(configPath&&pattern.test(configSha256),'Explicit parent-pinned isolated config required');
  const path=await realpath(resolve(root,configPath));
  assert.ok(inside(root,path));
  const configBytes=await readFile(path);
  assert.equal(hash(configBytes),configSha256);
  const config=JSON.parse(configBytes.toString('utf8'));
  assert.equal(config.schema_version,1);
  assert.equal(config.stage,'phase6-7-isolated-candidate');
  assert.equal(config.runtime_status,'installed-frozen-candidate');
  assert.equal(config.render_export,'nh_rust_format_registered','This Phase6/7 candidate uses an explicitly registered immutable catalog');
  const build=await realpath(resolve(root,'build'));
  const webRoot=await realpath(resolve(root,config.web_root));
  assert.ok(inside(build,webRoot)&&webRoot!==build,'Isolated runtime must be a build/ child');
  assert.notEqual(webRoot,await realpath(resolve(root,'web')));
  const outputRoot=resolve(root,config.report_directory);
  assert.ok(inside(build,outputRoot)&&outputRoot!==build&&!inside(webRoot,outputRoot),'Distinct reports outside the staged runtime');
  assert.match(relative(build,outputRoot),/^phase7-acceptance-[^\\/]+$/,'New phase7-acceptance-* report directory');
  const sourceRoot=await realpath(resolve(root,config.native_source_root));
  assert.ok(inside(root,sourceRoot));
  assert.ok(config.expected_native_source_sha256&&Object.keys(config.expected_native_source_sha256).length>=5,'Pin the three composed original files and private bridge/header');
  const sourceFiles=[];
  for(const [name,expected] of Object.entries(config.expected_native_source_sha256)) {
    assert.ok(!isAbsolute(name)&&pattern.test(expected));
    const sourcePath=await realpath(resolve(sourceRoot,name));
    assert.ok(inside(sourceRoot,sourcePath));
    const bytes=await readFile(sourcePath);
    assert.equal(hash(bytes),expected,`Composed source changed: ${name}`);
    sourceFiles.push({path:sourcePath,name,sha256:expected,bytes:bytes.length});
  }
  for(const name of ['src/cmd.c','src/restore.c','src/timeout.c','src/nh-buffer-producer.c','include/nh-buffer-producer.h'])assert.ok(sourceFiles.some(file=>file.name===name),`Missing composed source: ${name}`);
  const actualNative=new Map(sourceFiles.map(file=>[file.name,file.sha256]));
  const planPath=resolve(dirname(fileURLToPath(import.meta.url)),'browser-host-phase7-plan.json');
  assert.ok(pattern.test(config.expected_plan_sha256));
  const planBytes=await readFile(planPath);
  assert.equal(hash(planBytes),config.expected_plan_sha256);
  const plan=JSON.parse(planBytes.toString('utf8'));
  assert.equal(plan.compiled,false);assert.equal(plan.browser_executed,false);
  assert.equal(plan.branches.length,7);assert.equal(plan.counts.consumer_sites,6);
  const byId=new Map(plan.branches.map(branch=>[branch.id,branch]));
  assert.equal(byId.size,7);
  async function runtimeHashes() {
    const result=[];
    for(const name of files) {
      const expected=config.expected_runtime_sha256?.[name];
      assert.ok(pattern.test(expected??''),`Pin complete runtime: ${name}`);
      const artifactPath=await realpath(resolve(webRoot,name));assert.ok(inside(webRoot,artifactPath));
      const bytes=await readFile(artifactPath);assert.equal(hash(bytes),expected,`Runtime changed: ${name}`);
      result.push({name,sha256:expected,bytes:bytes.length});
    }
    return result;
  }
  const artifacts=await runtimeHashes();
  return {
    executionAuthorized:parentAuthorizedSerialRun===true,
    repaintInvariant,
    renderExport:config.render_export,
    catalogSha256:config.expected_runtime_sha256['gameplay-core.json'],
    webRoot,outputRoot,artifacts,byId,plan,
    provenance:{stage:config.stage,config_sha256:configSha256,plan_sha256:config.expected_plan_sha256,source_files:sourceFiles.map(({path,...file})=>file),maximum_concurrent_wasm_pages:1,active_runtime_changed:false},
    requireExecution() {assert.equal(this.executionAuthorized,true,'Parent serial runtime slot approval is required separately from loading this source-only adapter');},
    sourceOwner(capture) {
      const branch=byId.get(capture.envelope?.event?.id);
      assert.ok(branch,'Accepted source-issued ID is absent from the frozen seven-branch plan');
      assert.ok(actualNative.has(branch.source),'Phase7 owner must exist in the exact staged native source set before any hash claim');
      assert.ok(capture.callback==='shim_putstr'||capture.callback==='shim_add_menu');
      assert.deepEqual(Object.keys(capture.envelope.event.args).sort(),[...branch.argument_schemas].sort());
      for(const argument of branch.typed_arguments)assert.equal(capture.envelope.event.args[argument.name].type,argument.type);
      assert.equal(capture.callback,branch.producer_line===536?'shim_add_menu':'shim_putstr');
      return {id:branch.id,source:branch.source,source_sha256:branch.source_sha256,staged_native_source_sha256:actualNative.get(branch.source),producer_line:branch.producer_line,consumer_line:branch.consumer_line,typed_arguments:branch.typed_arguments};
    },
    async verifyUnchanged() {
      assert.deepEqual(await runtimeHashes(),artifacts);
      assert.equal(hash(await readFile(path)),configSha256);
      assert.equal(hash(await readFile(planPath)),config.expected_plan_sha256);
      for(const source of sourceFiles)assert.equal(hash(await readFile(source.path)),source.sha256);
      return artifacts;
    },
  };
}
