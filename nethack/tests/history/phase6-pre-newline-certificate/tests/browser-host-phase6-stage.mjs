/* Isolated Phase6/7 acceptance reader. Importing starts no engine or process.
 * Exact file hashes and data gate are evidence; parent serial permission remains separate. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pattern=/^[0-9a-f]{64}$/;
const inside=(base,path)=>{const name=relative(base,path);return name!=='..'&&!name.startsWith(`..${sep}`)&&!isAbsolute(name);};
const names=['engine/nethack.js','engine/nethack.wasm','app.mjs','shim-host.mjs','registered-catalog-host.mjs','dom-ui.mjs','save-store.mjs','browser-ui.json','gameplay-core.json','index.html','style.css'];

export async function loadStageConfig(suite) {
  assert.ok(['browser','native-name','phase7','compiled'].includes(suite));
  const index=process.argv.indexOf('--stage-config');
  assert.ok(index>=0&&process.argv[index+1],'Explicit --stage-config required; never use historical outputs by default');
  const configPath=await realpath(resolve(process.cwd(),process.argv[index+1]));
  assert.ok(inside(root,configPath));
  const configBytes=await readFile(configPath),config=JSON.parse(configBytes.toString('utf8'));
  assert.equal(config.schema_version,1);assert.equal(config.stage,'phase6-7-isolated-candidate');
  assert.equal(config.runtime_status,'installed-frozen-candidate');assert.equal(config.render_export,'nh_rust_format_registered');
  const build=await realpath(resolve(root,'build')),webRoot=await realpath(resolve(root,config.web_root));
  assert.ok(inside(build,webRoot)&&webRoot!==build);assert.notEqual(webRoot,await realpath(resolve(root,'web')));
  const outputRoot=resolve(root,config.report_directory);
  assert.ok(inside(build,outputRoot)&&outputRoot!==build&&!inside(webRoot,outputRoot));
  assert.ok(inside(resolve(build,'phase6'),outputRoot)&&outputRoot!==resolve(build,'phase6'),'Never target historical reports');
  const nativeSourceRoot=await realpath(resolve(root,config.native_source_root));assert.ok(inside(root,nativeSourceRoot));
  const references=[];
  async function bound(ref) {
    assert.ok(ref&&typeof ref.path==='string'&&pattern.test(ref.sha256??''),'Missing exact source/gate reference');
    const path=await realpath(resolve(root,ref.path));assert.ok(inside(root,path));
    const bytes=await readFile(path);assert.equal(hash(bytes),ref.sha256,`Bound evidence changed: ${ref.path}`);
    if(!references.some(item=>item.path===ref.path))references.push({...ref,bytes:bytes.length});
    return bytes;
  }
  const json=async ref=>JSON.parse((await bound(ref)).toString('utf8'));
  const requiredTests=['tests/browser-host-phase6-stage.mjs','tests/browser-host-phase6-cdp.mjs','tests/browser-host-phase6-lifecycle.mjs','tests/browser-host-phase6-browser.mjs','tests/browser-host-phase6-name-producers.mjs','tools/serve-integration.mjs','tests/prepare-phase6-acceptance-config.py','tests/browser-host-semantic-cdp.mjs','tools/run-monitored.py', 'tools/semantic-text/phase6-immutable-catalog/tests/registered-catalog-wasm.mjs'];
  assert.ok(Array.isArray(config.test_sources));
  assert.deepEqual(config.test_sources.map(item=>item.path).sort(),[...requiredTests].sort(),'Bind every executed acceptance/transport/server/source-config dependency');
  for(const ref of config.test_sources)await bound(ref);
  async function runtimeHashes() {
    const result=[];
    for(const name of names) {
      const expected=config.expected_runtime_sha256?.[name];assert.ok(pattern.test(expected??''),`Pin runtime: ${name}`);
      const path=await realpath(resolve(webRoot,name));assert.ok(inside(webRoot,path));
      const bytes=await readFile(path);assert.equal(hash(bytes),expected,`Runtime changed: ${name}`);
      result.push({name,sha256:expected,bytes:bytes.length});
    }
    return result;
  }
  const artifacts=await runtimeHashes();
  const engine=await json(config.engine_manifest),source=await json(config.source_manifest),generator=await json(config.generator_manifest);
  const binding=await json(config.data_binding),consumer=await json(config.consumer_report);
  assert.equal(binding.status,'passed');assert.equal(consumer.status,'passed');
  assert.equal(consumer.consumer_execution_proved,true);assert.equal(consumer.failed_assertion_count,0);
  assert.equal(binding.candidate_engine_wasm_sha256,config.expected_runtime_sha256['engine/nethack.wasm']);
  assert.equal(binding.engine_manifest_sha256,config.engine_manifest.sha256);
  assert.equal(binding.consumer_report_sha256,config.consumer_report.sha256);
  assert.equal(binding.generator_manifest_sha256,config.generator_manifest.sha256);
  assert.equal(binding.archive_sha256,consumer.archive_sha256);
  const archive=await bound(config.archive);assert.equal(archive.length,config.archive.bytes);
  assert.equal(config.archive.sha256,binding.archive_sha256);assert.equal(archive.length,binding.datafile_expected_actual_bytes);
  assert.equal(engine.frontend.registered_catalog,true);
  assert.equal(engine.isolated_phase6.source_manifest_sha256,config.source_manifest.sha256);
  assert.equal(engine.isolated_phase6.target_data_manifest_sha256,config.generator_manifest.sha256);
  assert.equal(source.catalog.sha256,config.expected_runtime_sha256['gameplay-core.json']);
  const prepared=await json(config.consumer_prepared);
  assert.equal(consumer.source_evidence,'prepared.json');
  assert.equal(config.consumer_prepared.path,relative(root,resolve(dirname(resolve(root,config.consumer_report.path)),'prepared.json')).split(sep).join('/'));
  assert.equal(config.consumer_prepared.sha256,consumer.prepared_sha256);
  assert.equal(prepared.candidate_manifest_sha256,config.engine_manifest.sha256);
  assert.equal(prepared.generator_manifest_sha256,config.generator_manifest.sha256);
  assert.equal(prepared.source_phase,'phase6');assert.equal(prepared.generated_data_lf_verified,true);
  assert.equal(prepared.official_commit,engine.official_commit);
  assert.equal(prepared.archive_sha256,config.archive.sha256);assert.equal(prepared.archive_bytes,config.archive.bytes);
  assert.equal(await realpath(prepared.actual_archive),await realpath(resolve(root,config.archive.path)));
  for(const [key,filename,reportedHash] of [['consumer_js','original-consumer.cjs',consumer.consumer_js_sha256],['consumer_wasm','original-consumer.wasm',consumer.consumer_wasm_sha256]]){
    const ref=config[key];assert.equal(ref.sha256,reportedHash);
    assert.equal(ref.path,relative(root,resolve(dirname(resolve(root,config.consumer_report.path)),filename)).split(sep).join('/'));
    await bound(ref);
  }
  assert.equal(await realpath(prepared.working_source_root),nativeSourceRoot);
  const expectedMacros={UNIX:1,WIN32:0,MSDOS:0,_WIN32:0,DLBLIB:1,CROSS_TO_WASM:1};
  assert.deepEqual(consumer.actual_target_macros,expectedMacros);
  assert.deepEqual(engine.target_macros,expectedMacros);
  assert.equal(consumer.macro_evidence.matches_expected,true);assert.equal(consumer.macro_evidence.cr_normalization_compiled,false);
  const normalizeFlags=flags=>flags.map(flag=>{
    if(!flag.startsWith('-I'))return flag;
    const path=resolve(nativeSourceRoot,flag.slice(2));assert.ok(inside(nativeSourceRoot,path));return '-I'+relative(nativeSourceRoot,path).split(sep).join('/');
  });
  assert.deepEqual(normalizeFlags(prepared.target_flags),normalizeFlags(generator.target_flags));
  assert.deepEqual(normalizeFlags(prepared.target_flags),normalizeFlags(engine.target_flags));
  const embedded=engine.embedded_data;
  assert.equal(embedded.generator_manifest_sha256,config.generator_manifest.sha256);
  assert.equal(embedded.archive.sha256,config.archive.sha256);assert.equal(embedded.link.archive_sha256_at_link,config.archive.sha256);
  assert.equal(await realpath(embedded.archive.source_path),await realpath(resolve(root,config.archive.path)));
  assert.equal(embedded.datafile_entry.name,'/nhdat');
  assert.equal(embedded.archive.bytes,config.archive.bytes);assert.equal(embedded.datafile_entry.expected_bytes,config.archive.bytes);assert.equal(embedded.datafile_entry.actual_bytes,config.archive.bytes);
  assert.equal(embedded.datafile_entry.actual_sha256,config.archive.sha256);
  assert.equal(embedded.emitted_js.sha256,config.expected_runtime_sha256['engine/nethack.js']);assert.equal(embedded.emitted_wasm.sha256,config.expected_runtime_sha256['engine/nethack.wasm']);
  assert.ok(pattern.test(embedded.emitted_js.loader_sha256));assert.ok(pattern.test(embedded.link.command_sha256));assert.ok(embedded.link.argv.includes(embedded.link.embed_argument));

  const actualNative=new Map();
  for(const item of [...engine.compiled_input_hashes,...engine.compiled_header_hashes]) {
    assert.ok(pattern.test(item.sha256));
    if(actualNative.has(item.path))assert.equal(actualNative.get(item.path),item.sha256);
    actualNative.set(item.path,item.sha256);
  }
  assert.ok(engine.compiled_input_hashes.length>=174&&engine.compiled_header_hashes.length>=20);
  assert.deepEqual(config.expected_native_source_sha256,Object.fromEntries(actualNative),'Config must pin every actual compiled C/Lua input and header');
  async function verifyNative() {
    for(const [name,expected] of actualNative) {
      const path=await realpath(resolve(nativeSourceRoot,name));assert.ok(inside(nativeSourceRoot,path));
      assert.equal(hash(await readFile(path)),expected,`Actual compiled source/header changed: ${name}`);
    }
  }
  await verifyNative();
  for(const [name,expected] of Object.entries(prepared.working_headers))assert.equal(actualNative.get(name),expected,`Probe/engine shared header mismatch: ${name}`);
  const officialFunctions={unpadline:'112b4268882487df8eac4a85d6249736622ac27c796e7e2d9cc2136aaf429d29',init_rumors:'6744cd9c32a1fa4b8c056fbbb81eca5b499a58245da8df097103d3bb32a6c4aa',get_rnd_line:'a22cd4c9afd09476a4aa15779016b7753d7c94ad1218cdc37e2a7039c6dacdf2',init_oracles:'3b79135a7b9717e3b0d474086f60058e5db8f276f23465fa1bfd2024b96c8c39',outoracle:'be862c86a222160a5cc6d85ffbb36e78074454353465051ea2f126b1900e4757'};
  assert.deepEqual(Object.fromEntries(prepared.official_functions.map(row=>[row.function,row.sha256])),officialFunctions);
  assert.equal(engine.compile_evidence.units.length,engine.compiled_input_hashes.length);
  const unitSources=new Set();
  for(const unit of engine.compile_evidence.units){const path=resolve(nativeSourceRoot,unit.source);assert.ok(inside(nativeSourceRoot,path));const name=relative(nativeSourceRoot,path).split(sep).join('/');assert.ok(!unitSources.has(name),'Duplicate successful compiler unit');unitSources.add(name);assert.equal(unit.status,'passed');assert.equal(unit.source_sha256,actualNative.get(name));assert.ok(unit.argv.includes('-c')&&pattern.test(unit.command_sha256));}
  assert.deepEqual([...unitSources].sort(),engine.compiled_input_hashes.map(row=>row.path.split('\\').join('/')).sort(),'Every exact compiled input has one successful compiler unit');

  const frontend=new Map(engine.frontend.files.map(item=>[item.path,item.sha256]));
  for(const item of artifacts.filter(item=>!item.name.startsWith('engine/')))assert.equal(frontend.get(item.name),item.sha256);
  const metadataById=new Map();
  assert.ok(Array.isArray(config.metadata_paths)&&config.metadata_paths.length>=4,'Pin inherited Phase3, Phase4 and new Phase6 ownership metadata');
  for(const ref of config.metadata_paths) {
    const document=await json(ref);assert.ok(Array.isArray(document.entries));
    for(const entry of document.entries) {
      assert.equal(typeof entry.id,'string');
      const existing=metadataById.get(entry.id);
      if(!existing){metadataById.set(entry.id,structuredClone(entry));continue;}
      for(const field of ['api','category','source_field','source_english_literal','arguments','required_argument_union']) {
        if(existing[field]!==undefined&&entry[field]!==undefined)assert.deepEqual(existing[field],entry[field],`Conflicting ${field} for ${entry.id}`);
      }
      for(const field of ['api','category','source_field','source_english_literal','arguments','required_argument_union'])if(existing[field]===undefined&&entry[field]!==undefined)existing[field]=structuredClone(entry[field]);
      const sites=new Map();
      for(const site of [...(existing.source_call_sites??[]),...(entry.source_call_sites??[])]) {
        const key=JSON.stringify([site.source,site.line,site.api??entry.api]);
        const previous=sites.get(key);
        if(previous)for(const field of ['original_call_sha256','original_argument_expressions','formal_c_types'])if(previous[field]!==undefined&&site[field]!==undefined)assert.deepEqual(previous[field],site[field],`Conflicting original source call ${entry.id}`);
        sites.set(key,{...previous,...site});
      }
      existing.source_call_sites=[...sites.values()];
    }
  }
  const audit=await json(config.producer_audit),appearance=await json(config.appearance_audit);
  assert.equal(appearance.original_pointer_selection_unchanged,true);assert.equal(appearance.description_slots,326);
  const aliases=new Map();
  for(const row of appearance.source_mapping) {
    assert.ok(row.public_only_identity&&row.public_alias.startsWith('nethack.public.appearance.'));
    if(aliases.has(row.public_alias))assert.deepEqual(aliases.get(row.public_alias),row);
    aliases.set(row.public_alias,row);
  }
  assert.equal(aliases.size,appearance.public_aliases);
  const producerSites=new Map();
  for(const site of audit.sites) {
    const key=JSON.stringify([site.id,site.api,site.source,site.line]);
    if(producerSites.has(key))assert.deepEqual(producerSites.get(key),site);
    producerSites.set(key,site);
  }
  let plan=null;
  if(config.phase7) {
    plan=await json(config.phase7.plan);const phase7audit=await json(config.phase7.audit);
    assert.equal(plan.branches.length,7);assert.equal(phase7audit.enabled,true);
    await bound(config.phase7['browser-host-phase7-scenarios.mjs']);await bound(config.phase7['browser-host-phase7-compiled-format.mjs']);
  }
  const byId=new Map((plan?.branches??[]).map(branch=>[branch.id,branch]));
  const port=config.port??0;assert.ok(Number.isInteger(port)&&port>=0&&port<=65535);
  return {
    webRoot,port,artifacts,nativeSourceRoot,metadataById,plan,byId,outputRoot,testSources:config.test_sources,
    archiveBinding:config.archive,renderExport:config.render_export,catalogPath:'gameplay-core.json',catalogSha256:config.expected_runtime_sha256['gameplay-core.json'],
    results:resolve(outputRoot,`${suite}-artifacts`),reportPath:resolve(outputRoot,`${suite}-verification.json`),
    provenance:{stage:config.stage,configPath:relative(root,configPath),config_sha256:hash(configBytes),web_root:relative(root,webRoot),source_metadata:references,actual_compiled_source_count:engine.compiled_input_hashes.length,actual_header_count:engine.compiled_header_hashes.length,data_probe_scope:'Exact target nhdat, original oracle/random readers and LF indexed assets; probe WASM is separate from full engine. Encyclopedia original reader pending.',maximum_concurrent_wasm_instances:1,historical_runtime_changed:false},
    requireExecution(){assert.equal(process.env.NETHACK_PARENT_SERIAL_SLOT,'phase6','Parent must explicitly supply the Phase6 serial slot in addition to this frozen config');},
    async verifyUnchanged(){assert.deepEqual(await runtimeHashes(),artifacts);assert.equal(hash(await readFile(configPath)),hash(configBytes));for(const ref of references)await bound(ref);await verifyNative();return artifacts;},
    sourceOwner(capture,api=capture.envelope.context.api) {
      assert.equal(capture.envelope.context.api,api,'Captured native API must equal the asserted original source API');
      const id=capture.envelope.event.id,branch=byId.get(id);
      if(branch) {
        assert.ok(actualNative.has(branch.source),'Phase7 owner source must be an actual compiled input');
        assert.equal(api,branch.producer_line===536?'add_menu_str':branch.consumer_line===1098?'pline1':'putstr','Phase7 API must be the exact original consumer');
        assert.deepEqual(Object.keys(capture.envelope.event.args).sort(),[...branch.argument_schemas].sort());
        for(const argument of branch.typed_arguments)assert.equal(capture.envelope.event.args[argument.name].type,argument.type);
        assert.equal(capture.callback,branch.producer_line===536?'shim_add_menu':'shim_putstr');
        return {id,api,source:branch.source,original_source_sha256:branch.source_sha256,actual_compiled_source_sha256:actualNative.get(branch.source),producer_line:branch.producer_line,consumer_line:branch.consumer_line,typed_arguments:branch.typed_arguments};
      }
      const entry=metadataById.get(id);assert.ok(entry,`Native ID absent from frozen ownership metadata: ${id}`);assert.equal(entry.api,api);
      assert.ok(entry.source_call_sites?.length);
      assert.ok(Array.isArray(entry.arguments),'Exact source typed argument schema required');
      const declared=entry.required_argument_union??entry.arguments.map(argument=>argument.name);
      assert.deepEqual(Object.keys(capture.envelope.event.args).sort(),[...declared].sort(),'Captured event must have exactly the declared original consumed argument union');
      for(const argument of entry.arguments) {
        const actual=capture.envelope.event.args[argument.name];assert.ok(actual);
        const accepted=argument.accepted_types??(argument.type==='text'?['text','text_id','event']:[argument.type]);
        assert.ok(accepted.includes(actual.type),`Original C argument type mismatch for ${id}:${argument.name}`);
        if(actual.type==='event'||actual.type==='text_id')assert.ok(actualNative.has('src/nh-semantic-name.c'),'Public semantic refinement requires the exact compiled native sidecar producer');
      }

      return {id,api,sites:entry.source_call_sites.map(site=>{
        const inherited=producerSites.get(JSON.stringify([id,api,site.source,site.line]));
        const original=site.original_call_sha256??inherited?.original_call_sha256;
        assert.ok(pattern.test(original??''),'Native ownership needs exact original call hash; unknown/new contracts remain unproved');
        if(site.original_call_sha256&&inherited)assert.equal(original,inherited.original_call_sha256);
        assert.ok(actualNative.has(site.source),'Owner source was not compiled into this exact engine');
        return {source:site.source,line:site.line,function_candidate:site.function_candidate,original_call_sha256:original,actual_compiled_source_sha256:actualNative.get(site.source)};
      })};
    },
    async appearanceSource(id) {
      const row=aliases.get(id);assert.ok(row,'Actual nested appearance must use an exact public-only alias in the frozen ledger');
      assert.equal(row.public_only_identity,true);assert.ok(!id.includes('crystal_ball'));
      const files=['src/objnam.c','src/nh-semantic-name.c'];
      for(const name of files)assert.ok(actualNative.has(name),`Missing compiled public producer ${name}`);
      return {public_alias:row.public_alias,public_phrase:row.public_phrase,japanese_eligible:row.japanese_eligible,ledger_sha256:config.appearance_audit.sha256,original_pointer_selection_unchanged:true,compiled_producers:files.map(path=>({path,sha256:actualNative.get(path)})),offline_private_source_ids:row.private_source_ids,runtime_query_note:'Only captured public descriptor IDs were inspected. Ledger private IDs are offline source evidence, never emitted. No otyp, oc_descr_idx, known flag, native name function or RNG was queried.'};
    },
  };
}
