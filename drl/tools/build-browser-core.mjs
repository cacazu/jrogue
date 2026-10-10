import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {captureLinkSources, compiledSourceRecords, fileHash} from './core-link-inputs.mjs';

// --plan records exact bounded commands without launching a compiler/linker.
// --build runs only in the authorized serial measured job lane after the mixed-ABI gate.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.argv[2]??'--plan';
if(!['--plan','--build'].includes(mode))throw Error('Use --plan or --build');
const geometry=process.argv.includes('--geometry');
const output=path.join(root,'core-adapted/build',geometry?'vtig-geometry':'browser-core');
const compiler=path.join(root,'toolchain/fpc-src/compiler/ppcwasm32.exe');
const source=path.join(root,geometry?'experiments/vtig-cjk/geometry-probe.pas':'core-adapted/drl/src/drl_browser.lpr');
const lua=path.join(root,'experiments/lua-wasi');
const sysroot=path.join(lua,'toolchain/wasi-sysroot-34.0/lib/wasm32-wasip1');
const builtins=path.join(lua,'toolchain/libclang_rt-34.0/wasm32-unknown-wasip1');
const linkerDirectory=process.env.DRL_LLVM_BIN??path.join(process.env.USERPROFILE??process.env.HOME??'','emsdk/upstream/bin');
const libraries=[path.join(lua,'build/drl-lua-bridge.a'),path.join(lua,'build/lua5.1.a'),
  path.join(sysroot,'libc.a'),path.join(sysroot,'libsetjmp.a'),path.join(sysroot,'libwasi-emulated-process-clocks.a'),
  path.join(builtins,'libclang_rt.builtins.a')];
const packageNames=['rtl-objpas','rtl-generics','rtl-unicode','rtl-extra','hash','paszlib','fcl-base','fcl-xml','fcl-json'];
const unitPaths=[path.join(root,'toolchain/rtl-exnref'),
  ...packageNames.map(p=>path.join(root,`toolchain/packages-exnref/${p}/units/wasm32-wasip1`)),
  ...['drl/src','fpcvalkyrie/src','fpcvalkyrie/libs'].map(p=>path.join(root,'core-adapted',p))];
const exports=[...(geometry?[]:['drl_probe_buffer','drl_probe_capacity','drl_probe_capture','drl_probe_run_delay','drl_probe_multimove_active']),
  'drl_save_generation','drl_user_files_generation'];
const resultFile=path.join(output,geometry?'vtig-geometry.wasm':'drl-core.wasm');
const args=['-n','-vi','-Sc','-B','-Twasip1','-CTwasmexceptions','-dDRL_WASM','-dDRL_BROWSER','-Xe',
  '-FD'+linkerDirectory,...unitPaths.map(p=>'-Fu'+p),
  ...[path.join(lua,'build'),sysroot,builtins].map(p=>'-Fl'+p),
  '-Fi'+path.join(root,'core-adapted/fpcvalkyrie/src'),'-FU'+output,'-FE'+output,'-o'+resultFile,
  '-k--export-memory','-k--export=__heap_base','-k--export=__stack_pointer',
  ...exports.map(s=>'-k--export='+s),'-k--wrap=FPC_WASM_SETINITIALHEAPBLOCKSTART',
  '-k--fatal-warnings','-k--threads=2','-k--max-memory=67108864','-k--Map='+path.join(output,'drl-core.map'),
  ...libraries.map(p=>'-k'+p),source];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const plan={schema:2,created_utc:new Date().toISOString(),command:[compiler,...args],
  authored_vtig_geometry_probe:geometry,
  compile_link_started:false,full_game_started:false,full_port_complete:false,
  compiler_sha256:fs.existsSync(compiler)?sha(compiler):null,
  source_sha256:fs.existsSync(source)?sha(source):null,
  archives:libraries.map(p=>({path:p,exists:fs.existsSync(p),sha256:fs.existsSync(p)?sha(p):null})),
  required_runtime_import_modules:['wasi_snapshot_preview1','drl_host'],
  prerequisites:['parent authorized one measured serial DRL job','fresh bridge archive matches bridge.c',
    'mixed Pascal/Lua callbacks, packed varargs, exceptions and production allocator validated'],
  imports_validated:false};
fs.mkdirSync(output,{recursive:true});
if(mode==='--build') {
  const bridgeManifest=JSON.parse(fs.readFileSync(path.join(lua,'bridge-build-manifest.json'),'utf8').replace(/^\uFEFF/,''));
  if(bridgeManifest.source_sha256!==sha(path.join(lua,'bridge.c'))||bridgeManifest.archive_sha256!==sha(libraries[0]))
    throw Error('Lua bridge source/archive manifest is stale; rebuild bridge first');
  if(plan.archives.some(a=>!a.exists))throw Error('A required official archive is absent');
  const sourceRoots=['core-adapted','core-overlay','localization','experiments/lua-wasi',
    'toolchain/fpc-src/rtl','toolchain/fpc-src/packages','toolchain/packages-exnref',
    'tools/build-browser-core.mjs','tools/core-link-inputs.mjs'];
  if(geometry)sourceRoots.push('experiments/vtig-cjk');
  plan.source_inputs=await captureLinkSources(root,sourceRoots);
  plan.compile_link_started=true;
  const built=spawnSync(compiler,args,{cwd:root,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024,windowsHide:true});
  fs.writeFileSync(path.join(output,'compile-link.log'),(built.stdout??'')+(built.stderr??''));
  plan.result={exit_code:built.status,signal:built.signal,error:built.error?.message??null};
  if(built.status===0) {
    plan.wasm_sha256=sha(resultFile);plan.wasm_bytes=fs.statSync(resultFile).size;
    try {
      const module=new WebAssembly.Module(fs.readFileSync(resultFile));
      plan.imports=WebAssembly.Module.imports(module);plan.exports=WebAssembly.Module.exports(module);
      const bad=plan.imports.filter(i=>i.kind!=='function'||!plan.required_runtime_import_modules.includes(i.module));
      if(bad.length)throw Error('Unexpected native/untyped core imports: '+JSON.stringify(bad));
      for(const name of exports)if(!plan.exports.some(e=>e.name===name&&e.kind==='function'))throw Error('Required core diagnostic export missing: '+name);
      plan.imports_validated=true;
    } catch(error) {
      plan.validation_error=error.message;
    }
  }
  plan.compiled_source_units=[...((built.stdout??'')+(built.stderr??'')).matchAll(/^Compiling (.+)$/gm)].map(m=>m[1].trim());
  plan.compiled_sources=compiledSourceRecords(root,plan.compiled_source_units,plan.source_inputs);
  const requiredCompiled=geometry?['experiments/vtig-cjk/geometry-probe.pas']:
    ['core-adapted/drl/src/drl_browser.lpr','core-adapted/drl/src/drlbase.pas',
     'core-adapted/fpcvalkyrie/libs/vlualibrary.pas'];
  plan.required_compiled_sources=requiredCompiled;
  plan.missing_required_compiled_sources=requiredCompiled.filter(required=>
    !plan.compiled_sources.files.some(file=>file.path.toLowerCase()===required.toLowerCase()));
  const after=await captureLinkSources(root,sourceRoots);
  plan.source_inputs_unchanged=plan.source_inputs.sha256===after.sha256;
  plan.archives_unchanged=true;
  for(const archive of plan.archives)if(await fileHash(archive.path)!==archive.sha256)plan.archives_unchanged=false;
  if(!plan.source_inputs_unchanged||!plan.archives_unchanged||plan.compiled_sources.unresolved.length||
      plan.missing_required_compiled_sources.length){
    plan.validation_error='Build inputs changed, a compiled source is outside the closure, or required compilation evidence is missing';
    plan.imports_validated=false;
  }
  process.exitCode=plan.validation_error?1:(built.status??1);
}
fs.writeFileSync(path.join(output,mode==='--plan'?'link-plan.json':'link-evidence.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({mode,compile_link_started:plan.compile_link_started,result:plan.result??null,
  archives:plan.archives.length,output,imports_validated:plan.imports_validated}));
