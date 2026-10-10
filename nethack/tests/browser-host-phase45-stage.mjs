/* Source-only adapter for a parent-approved, isolated compiled candidate.
 * Importing this module starts no server/browser/WASM. Execution still requires
 * the parent's measured slot/headroom gate; a JSON config is not that permission.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const hashPattern = /^[0-9a-f]{64}$/;
const inside = (root, path) => {
  const rel = relative(root,path);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

export async function loadStageConfig(suite) {
  assert.ok(['browser','native-name'].includes(suite));
  const index = process.argv.indexOf('--stage-config');
  assert.ok(index >= 0 && process.argv[index+1], 'An explicit --stage-config is required; frozen historical reports cannot be the default output');
  const configPath = resolve(process.cwd(),process.argv[index+1]);
  assert.ok(inside(projectRoot,configPath),'Stage config must be in this NetHack subtree');
  const configBytes = await readFile(configPath);
  const config = JSON.parse(configBytes.toString('utf8'));
  assert.equal(config.schema_version,1);
  assert.equal(config.stage,'phase4-5-isolated-candidate');
  assert.equal(config.runtime_status,'installed-frozen-candidate','Fill the config only after the gated build has installed and frozen its complete runtime');
  const buildRoot = await realpath(resolve(projectRoot,'build'));
  const webRoot = await realpath(resolve(projectRoot,config.web_root));
  assert.ok(inside(buildRoot,webRoot),'Candidate web root must be isolated under build/');
  assert.notEqual(webRoot,await realpath(resolve(projectRoot,'web')),'Never serve/modify the frozen historical runtime for candidate acceptance');
  const outputRoot = resolve(projectRoot,config.report_directory);
  assert.ok(inside(buildRoot,outputRoot) && outputRoot !== buildRoot,'Candidate reports require a separate directory under build/');
  const port = config.port ?? 0;
  assert.ok(Number.isInteger(port) && port >= 0 && port <= 65535,'Use a valid loopback port, or 0 for an assigned local port');
  const catalogPath = config.catalog_path ?? 'gameplay-core.json';
  assert.ok(inside(webRoot,resolve(webRoot,catalogPath)) && !isAbsolute(catalogPath),'Catalog path must be relative to the staged web root');
  const names = ['engine/nethack.js','engine/nethack.wasm','app.mjs','shim-host.mjs','dom-ui.mjs','save-store.mjs','browser-ui.json',catalogPath,'index.html','style.css'];
  assert.equal(new Set(names).size,names.length);
  assert.ok(config.expected_runtime_sha256 && typeof config.expected_runtime_sha256 === 'object');
  async function runtimeHashes() {
    const artifacts=[];
    for(const name of names) {
      assert.ok(hashPattern.test(config.expected_runtime_sha256[name] ?? ''),`Parent must pin staged artifact SHA256: ${name}`);
      const path=await realpath(resolve(webRoot,name));
      assert.ok(inside(webRoot,path),`Staged artifact escaped web root: ${name}`);
      const bytes=await readFile(path);
      const hash=sha256(bytes);
      assert.equal(hash,config.expected_runtime_sha256[name],`Parent-approved staged artifact mismatch: ${name}`);
      artifacts.push({name,bytes:bytes.length,sha256:hash});
    }
    return artifacts;
  }
  const artifacts=await runtimeHashes();
  const nativeSourceRoot=await realpath(resolve(projectRoot,config.native_source_root ?? 'work/phase4/NetHack-5.0.0'));
  assert.ok(inside(projectRoot,nativeSourceRoot),'Native source evidence must remain in this NetHack subtree');
  const metadataPaths=config.metadata_paths;
  assert.ok(Array.isArray(metadataPaths) && metadataPaths.length >= 2,'Pin message/getlin and diagnostic owner metadata');
  const metadataById=new Map(),sourceMetadata=[];
  for(const item of metadataPaths) {
    assert.ok(typeof item.path === 'string' && hashPattern.test(item.sha256 ?? ''));
    const path=await realpath(resolve(projectRoot,item.path));
    assert.ok(inside(projectRoot,path));
    const bytes=await readFile(path);
    assert.equal(sha256(bytes),item.sha256,'Metadata changed after parent checkpoint');
    sourceMetadata.push({path:item.path,bytes:bytes.length,sha256:item.sha256});
    const data=JSON.parse(bytes.toString('utf8'));
    assert.ok(Array.isArray(data.entries));
    for(const entry of data.entries) {
      if(metadataById.has(entry.id)) assert.equal(metadataById.get(entry.id).api,entry.api,'Conflicting source API ownership');
      else metadataById.set(entry.id,entry);
    }
  }
  const producerAudit=config.producer_audit;
  assert.ok(producerAudit && typeof producerAudit.path==='string' && hashPattern.test(producerAudit.sha256 ?? ''),'Pin the inherited native producer audit');
  const producerAuditPath=await realpath(resolve(projectRoot,producerAudit.path));
  assert.ok(inside(projectRoot,producerAuditPath));
  const producerAuditBytes=await readFile(producerAuditPath);
  assert.equal(sha256(producerAuditBytes),producerAudit.sha256,'Producer audit changed after parent checkpoint');
  sourceMetadata.push({path:producerAudit.path,bytes:producerAuditBytes.length,sha256:producerAudit.sha256});
  const producerData=JSON.parse(producerAuditBytes.toString('utf8'));
  assert.ok(Array.isArray(producerData.sites));
  const producerSites=new Map();
  for(const site of producerData.sites) {
    const key=JSON.stringify([site.id,site.api,site.source,site.line]);
    if(producerSites.has(key)) assert.deepEqual(producerSites.get(key),site,'Conflicting native producer site');
    else producerSites.set(key,site);
  }
  return {
    webRoot,port,catalogPath,artifacts,metadataById,
    results:resolve(outputRoot,`${suite}-artifacts`),
    reportPath:resolve(outputRoot,`${suite}-verification.json`),
    nativeSourceRoot,
    provenance:{stage:config.stage,configPath:relative(projectRoot,configPath),config_sha256:sha256(configBytes),web_root:relative(projectRoot,webRoot),catalog_path:catalogPath,requested_port:port,source_metadata:sourceMetadata,maximum_concurrent_wasm_instances:1,historical_phase3_runtime_changed:false},
    async verifyUnchanged() {
      const after=await runtimeHashes();
      assert.deepEqual(after,artifacts);
      assert.equal(sha256(await readFile(configPath)),sha256(configBytes),'Stage config changed during acceptance');
      for(const source of sourceMetadata) assert.equal(sha256(await readFile(resolve(projectRoot,source.path))),source.sha256);
      return after;
    },
    sourceOwner(capture,api) {
      const source=metadataById.get(capture.envelope.event.id);
      assert.ok(source,`Actual native source ID is absent from bound metadata: ${capture.envelope.event.id}`);
      assert.equal(source.api,api);
      assert.ok(Array.isArray(source.source_call_sites) && source.source_call_sites.length > 0);
      return {id:source.id,api:source.api,sites:source.source_call_sites.map(({source:filename,line,function_candidate,original_call_sha256})=>{
        const inherited=producerSites.get(JSON.stringify([source.id,source.api,filename,line]));
        const hash=original_call_sha256 ?? inherited?.original_call_sha256;
        assert.ok(hashPattern.test(hash ?? ''),'Accepted native source requires its exact original call hash');
        if(original_call_sha256 && inherited) assert.equal(original_call_sha256,inherited.original_call_sha256);
        return {source:filename,line,function_candidate,original_call_sha256:hash};
      })};
    },
    async appearanceSource(id) {
      const label=metadataById.get(id);
      assert.ok(label && label.category==='object-label' && label.source_field==='appearance','Nested appearance ID must bind an exact public source label');
      const filename='src/objnam.c';
      const source=producerData.files.find(file=>file.source===filename);
      assert.ok(source && hashPattern.test(source.patched_sha256));
      const bytes=await readFile(resolve(nativeSourceRoot,filename));
      assert.equal(sha256(bytes),source.patched_sha256,'Actual candidate public-name producer source changed');
      const bridge=producerData.generated_files.find(file=>file.path==='src/nh-semantic-name.c');
      assert.ok(bridge && hashPattern.test(bridge.sha256));
      const bridgeBytes=await readFile(resolve(nativeSourceRoot,bridge.path));
      assert.equal(sha256(bridgeBytes),bridge.sha256,'Actual candidate public-index registry source changed');
      return {label:{id:label.id,source:label.source,official_line:label.official_line,source_field:label.source_field,source_enum:label.source_enum,source_english_literal:label.source_english_literal,knowledge_guard:label.knowledge_guard},producer:{source:filename,patched_sha256:source.patched_sha256,selection:producerData.public_objects.selection,label_validation:producerData.public_objects.label_validation},registry:{source:bridge.path,sha256:bridge.sha256},runtime_query_note:'Only the already-emitted public descriptor was inspected; no otyp, oc_descr_idx, known flag, or native name/RNG function was queried by the test.'};
    },
  };
}
