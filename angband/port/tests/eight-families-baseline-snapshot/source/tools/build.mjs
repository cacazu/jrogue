import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fingerprintBuildInputs } from './build-inputs.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sdk = process.env.ANGBAND_SDK || 'C:\\Users\\kit\\emsdk';
const python = path.join(sdk,'python','3.13.3_64bit','python.exe');
const emcc = path.join(sdk,'upstream','emscripten','emcc.py');
const build = path.join(root,'build');
await mkdir(build,{recursive:true});
await writeFile(path.join(root,'logic','version.h'),'#ifndef VERSION_H\n#define VERSION_H\n#define VERSION_STRING "4.2.6"\n#endif\n');
const inputBefore = await fingerprintBuildInputs(root);
// The parent coordinates this shared PC's heavy jobs. Default to one compiler
// worker, and permit only an explicitly selected positive concurrency.
const jobs = process.env.ANGBAND_BUILD_JOBS || '1';
if (!/^[1-9][0-9]?$/.test(jobs)) throw new Error('invalid ANGBAND_BUILD_JOBS');
const env = {...process.env, EM_CONFIG:path.join(sdk,'.emscripten'), EM_CACHE:path.join(build,'em-cache'), EMCC_CORES:jobs, BINARYEN_CORES:jobs, CARGO_BUILD_JOBS:jobs, CARGO_TARGET_DIR:path.join(root,'rust','target')};
async function run(command,args) {
  return new Promise((resolve,reject)=>{
    const p=spawn(command,args,{cwd:root,env,windowsHide:true,stdio:'inherit'});
    p.on('error',reject); p.on('exit',code=>code===0?resolve():reject(new Error(`${command} exited ${code}`)));
  });
}
const checkAdapters = process.argv.includes('--check-adapters');
if (!process.argv.includes('--skip-rust') && !checkAdapters) await run('cargo',['build','--offline','--manifest-path',path.join(root,'rust','Cargo.toml'),'--release','--lib','--target','wasm32-unknown-emscripten']);
const makefile=await readFile(path.join(root,'logic','Makefile.src'),'utf8');
const allObjects=[...makefile.matchAll(/^\s*([a-z0-9/-]+)\.o\s*\\?\s*$/gm)].map(m=>m[1]);
const sources=[...new Set(allObjects)].filter(n=>!n.startsWith('main')&&!n.startsWith('sdl2/')&&!n.startsWith('win/')&&!n.startsWith('stats/')).map(n=>path.join(root,'logic',n+'.c'));
sources.push(path.join(root,'logic','buildid.c'),path.join(root,'logic','main-web.c'));
try { await access(path.join(root,'logic','web-semantic.c')); sources.push(path.join(root,'logic','web-semantic.c')); } catch {}
try { await access(path.join(root,'logic','web-checkpoint.c')); sources.push(path.join(root,'logic','web-checkpoint.c')); } catch {}
for (const adapter of ['web-text-capture.c', 'web-ui-text.c', 'web-spell-text.c', 'web-static-text.c', 'web-interface-text.c', 'web-history.c', 'web-naming.c', 'web-dynamic-text.c', 'web-help-text.c', 'web-combat.c', 'web-death-cause.c', 'web-domain-text.c', 'web-replay-environment.c', 'web-knowledge-text.c', 'web-object-messages.c', 'web-stat-message.c', 'web-realm-text.c', 'web-monster-action-message.c', 'web-ui-residual-text.c', 'web-effect-description.c', 'web-spell-preview.c', 'web-list-text.c', 'web-store-welcome.c']) {
  try { await access(path.join(root,'logic',adapter)); sources.push(path.join(root,'logic',adapter)); } catch {}
}
// Export the definitions in registered FFI modules as a checked source list;
// browser setup and C callbacks share one ABI rather than drifting lists.
if (checkAdapters) {
 await run(python,[emcc,...sources.filter(source=>path.basename(source).startsWith('web-') || path.basename(source)==='main-web.c'),
  '-I'+path.join(root,'logic'),'-std=c11','-O1','-fwrapv','-DHAVE_VERSION_H','-fsyntax-only']);
 const after = await fingerprintBuildInputs(root);
 if (inputBefore.sha256 !== after.sha256) throw new Error('adapter inputs changed during syntax check');
 console.log(JSON.stringify({adapterSyntaxPassed:true,sourceFingerprint:inputBefore.sha256}));
 process.exit(0);
}
const exportedFunctions = new Set(['_ab_run','_ab_request_save','_malloc','_free',
 '_ab_domain_status','_ab_object_message_status','_ab_stat_message_status']);
for (const module of ['lib.rs','application_menu.rs','application_text.rs','death_cause.rs','localization.rs','semantic_presentation.rs','replay_bridge.rs']) {
 const rustSource = await readFile(path.join(root,'rust','src',module),'utf8');
 for (const match of rustSource.matchAll(/pub (?:unsafe )?extern "C" fn (ab_rs_[a-z0-9_]+)\s*\(/g)) exportedFunctions.add('_'+match[1]);
}
const args=[...new Set(sources),path.join(root,'rust','target','wasm32-unknown-emscripten','release','libangband_layers.a'),'-I'+path.join(root,'logic'),'-std=c11','-O1','-fwrapv','-DHAVE_VERSION_H','--no-entry','--js-library',path.join(root,'web','library.js'),
 '-sMODULARIZE=1','-sEXPORT_NAME=createAngbandModule','-sENVIRONMENT=web,worker,node','-sALLOW_MEMORY_GROWTH=1','-sSTACK_SIZE=4194304','-sASSERTIONS=1','-sASYNCIFY=1','-sASYNCIFY_STACK_SIZE=1048576',
 '-sEXPORTED_FUNCTIONS='+JSON.stringify([...exportedFunctions].sort()),
 '-sEXPORTED_RUNTIME_METHODS=["ccall","FS","UTF8ToString","HEAPU8"]','--preload-file',path.join(root,'data')+'@/data','-o',path.join(build,'game.js')];
await run(python,[emcc,...args]);
const inputAfter = await fingerprintBuildInputs(root);
if (inputBefore.sha256 !== inputAfter.sha256) throw new Error('engine inputs changed during build; result is not accepted');
const outputs=await Promise.all(['game.js','game.wasm','game.data'].map(async name=>{const b=await readFile(path.join(build,name));return {name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}));
const replayIdentity = {
 engine: outputs.find(output=>output.name==='game.wasm').sha256,
 data: outputs.find(output=>output.name==='game.data').sha256,
 input: createHash('sha256').update(await readFile(path.join(root,'rust','src','input.rs'))).digest('hex'),
 semantic: createHash('sha256').update(await readFile(path.join(root,'rust','src','semantic_presentation.rs'))).digest('hex'),
};
await writeFile(path.join(build,'manifest.json'),JSON.stringify({builtAt:new Date().toISOString(),engineVersion:'4.2.6',upstreamCommit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',cFiles:new Set(sources).size,inputFingerprint:inputBefore,replayIdentity,outputs},null,2));
console.log(JSON.stringify({cFiles:new Set(sources).size,outputs}));
