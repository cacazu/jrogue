import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {validateDigest,validateBuildInputs} from './probe-validation.mjs';

export async function sha256File(file){
  const hash=crypto.createHash('sha256');
  // Stream archive/compiler input rather than retaining its full contents.
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
}
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const relative=(root,file)=>path.relative(root,file).replaceAll('\\','/');

export async function auditMixedSources(root,variant='mixed',wasmSha256=null){
  if(!['mixed','mixed-jspi'].includes(variant))throw Error('Source audit requires a mixed probe variant');
  const errors=[],files=[];
  const suffix=variant==='mixed-jspi'?'-jspi':'';
  const recordPath=path.join(root,'probe-mixed.pas'+suffix+'-commands.json');
  const wasmPath=path.join(root,'mixed-build','mixed-probe'+suffix+'.wasm');
  const record=json(recordPath),command=record.command??[];
  async function check(file,expected,label){
    const actual=await sha256File(file);
    files.push({path:relative(root,file),sha256:actual});
    errors.push(...validateDigest(label,expected,actual));
    return actual;
  }
  const actualWasm=wasmSha256??await sha256File(wasmPath);
  errors.push(...validateDigest('Linked module',record.output_sha256,actualWasm));
  if(record.exit_code!==0)errors.push('Recorded mixed build did not succeed');
  if(!command.includes('-CTwasmexceptions'))errors.push('Mixed build does not select current WASM exceptions');
  if(!command.includes('-k--wrap=FPC_WASM_SETINITIALHEAPBLOCKSTART')&&!command.some(arg=>arg.startsWith('-Fu')&&arg.includes('startup-overlay')))errors.push('Mixed build omits the external-LLD heap startup correction');
  if(command.includes('-dDRL_PROBE_JSPI')!==(variant==='mixed-jspi'))errors.push('Build variant differs from requested probe');
  if(!command.includes('-o'+wasmPath))errors.push('Build command output path differs from audited module');
  await check(command[0],record.compiler_sha256,'FPC compiler');
  const archives=record.archives??[];
  const expectedArchives=['drl-lua-bridge.a','lua5.1.a','libc.a','libsetjmp.a','libwasi-emulated-process-clocks.a','libclang_rt.builtins.a'];
  if(archives.length!==expectedArchives.length)errors.push('Mixed build must record exactly six archives');
  for(const name of expectedArchives)if(archives.filter(item=>path.basename(item.path)===name).length!==1)errors.push('Missing or ambiguous archive: '+name);
  for(const archive of archives){
    if(!command.includes('-k'+archive.path))errors.push('Archive was not explicitly supplied to external linker: '+archive.path);
    await check(archive.path,archive.sha256,'Archive '+path.basename(archive.path));
  }
  const bridge=json(path.join(root,'bridge-build-manifest.json'));
  if(bridge.compile_exit!==0)errors.push('Recorded bridge compilation failed');
  await check(path.join(root,'bridge.c'),bridge.source_sha256,'Bridge source');
  const bridgeArchive=archives.find(item=>path.basename(item.path)==='drl-lua-bridge.a');
  errors.push(...validateDigest('Bridge archive manifest',bridge.archive_sha256,bridgeArchive?.sha256));
  for(const name of ['malloc','calloc','realloc','free'])if(!bridge.command?.includes('-fno-builtin-'+name))errors.push('Bridge fixture can be optimized away without -fno-builtin-'+name);
  const patches=json(path.join(root,'patch-manifest.json'));
  if(patches.pristine_modified!==false||patches.lua_version!=='5.1.5')errors.push('Unexpected Lua preparation provenance');
  if((patches.patches??[]).length!==3||!['liolib.c','loslib.c','luaconf.h'].every(name=>patches.patches.filter(item=>item.file===name).length===1))errors.push('Unexpected Lua patch set');
  if(patches.authored_files?.length!==1||patches.authored_files[0]?.file!=='drl_platform_errors.h')errors.push('Missing authored semantic-error header provenance');
  const pristine=path.resolve(root,'../../upstream/lua-5.1.5/src');
  const patchByName=new Map((patches.patches??[]).map(item=>[item.file,item]));
  for(const name of fs.readdirSync(pristine).filter(name=>/\.(c|h)$/.test(name))){
    const originalHash=await sha256File(path.join(pristine,name));
    const patch=patchByName.get(name);
    if(patch)errors.push(...validateDigest('Pristine Lua '+name,patch.original_sha256,originalHash));
    await check(path.join(root,'lua-src',name),patch?.patched_sha256??originalHash,'Prepared Lua '+name);
  }
  for(const authored of patches.authored_files??[]){
    await check(path.join(root,authored.file),authored.sha256,'Authored Lua header '+authored.file);
    await check(path.join(root,'lua-src',authored.file),authored.sha256,'Copied Lua header '+authored.file);
  }
  const platform=json(path.join(root,'platform-errors-build-manifest.json'));
  const luaArchive=archives.find(item=>path.basename(item.path)==='lua5.1.a');
  errors.push(...validateDigest('Platform Lua archive manifest',platform.archive_sha256,luaArchive?.sha256));
  for(const name of ['liolib.c','loslib.c']){
    const builds=(platform.commands??[]).filter(item=>item.source===name);
    if(builds.length!==1||builds[0]?.exit_code!==0)errors.push('Missing successful platform source build: '+name);
    else errors.push(...validateDigest('Compiled platform source '+name,builds[0].source_sha256,patchByName.get(name)?.patched_sha256));
  }
  let complete_provenance=false;
  const limits=['Unchanged Lua sources are compared to the retained pristine tree now; their historical compilation hashes are not recorded.',
    'This verifies current inputs against available manifests; runtime and static-link ownership checks remain separate.'];
  if(!record.provenance)limits.unshift('Historical build: no Pascal-source, RTL-object or map hashes were captured at build time.');
  else{
    const provenance=record.provenance;
    const task=path.resolve(root,'../..'),rtl=path.join(task,'toolchain','rtl-exnref');
    const mapPath=path.join(root,'mixed-build','mixed'+suffix+'.map');
    const overlay=path.join(root,'pascal-overlay');
    const requiredPaths=[command[0],...archives.map(item=>item.path),path.join(root,'probe-mixed.pas'),
      ...fs.readdirSync(overlay).filter(name=>/\.(pas|pp|inc)$/.test(name)).map(name=>path.join(overlay,name)),
      ...fs.readdirSync(rtl).filter(name=>name.endsWith('.ppu')).map(name=>path.join(rtl,name))];
    const map=fs.readFileSync(mapPath,'utf8');
    const usedObjects=[...new Set([...map.matchAll(/^\s*(?:-|[0-9a-fA-F]+)\s+(?:-|[0-9a-fA-F]+)\s+[0-9a-fA-F]+\s+(.+?\.o):\(/gm)]
      .map(match=>path.resolve(task,match[1])).filter(file=>file.toLowerCase().startsWith((rtl+path.sep).toLowerCase())))].sort();
    requiredPaths.push(...usedObjects);
    errors.push(...validateBuildInputs(provenance,requiredPaths));
    if(!command.includes('-B'))errors.push('Captured Pascal source build did not force authored-unit recompilation');
    if(!usedObjects.length||JSON.stringify([...(provenance.used_rtl_objects??[])].sort())!==JSON.stringify(usedObjects))errors.push('Recorded used RTL objects differ from final map');
    if(provenance.map_path!==mapPath||provenance.module_path!==wasmPath)errors.push('Build-time output paths differ from audited artifacts');
    errors.push(...validateDigest('Build-time module',provenance.module_sha256,actualWasm));
    errors.push(...validateDigest('Build-time map',provenance.map_sha256,await sha256File(mapPath)));
    for(const input of provenance.inputs_after??[])await check(input.path,input.sha256,'Captured '+input.kind+' '+input.path);
    complete_provenance=errors.length===0;
    // These snapshots prove the authored Pascal and selected RTL inputs for this new build.
    // They do not retroactively add input records to an earlier build/module.
  }
  return {result:errors.length?'fail':'pass',variant,build_record:relative(root,recordPath),
    build_record_sha256:await sha256File(recordPath),wasm_sha256:actualWasm,completed_utc:record.completed_utc,
    complete_provenance,files,errors,limits};
}
