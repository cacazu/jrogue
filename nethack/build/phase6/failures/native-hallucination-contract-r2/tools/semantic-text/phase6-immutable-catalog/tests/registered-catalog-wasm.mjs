/* Source-prepared Phase6 compiled ABI fixtures. This file runs no compiler,
 * browser, server, game loop or native producer replay. Parent execution gate
 * and exact installed-stage hashes are checked before importing one engine.
 * Synthetic values prove formatter transport, never original C capture. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,mkdir,open,readFile,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadStageConfig} from '../../../../tests/browser-host-phase6-stage.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const PROOF_PATH='build/phase6-rust/actual-proof.json';
const PROOF_SHA='d115a3d6b82dcba2233f15a70be052d2c1895fb931cde6f8edcee49dac667ff3';
const MAX_OUTPUT=128*1024,MAX_GAMEPLAY=256*1024,MAX_TEXT=64*1024;
const MAX_CATALOG=16*1024*1024,CANARY=0xad;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const slash=name=>name.split(sep).join('/');
const inside=(base,path)=>{const name=relative(base,path);return name!=='..'&&!name.startsWith(`..${sep}`)&&!isAbsolute(name);};
const text=value=>({type:'text',value});
const integer=value=>({type:'integer',value});
const unsigned=value=>({type:'unsigned',value});
const reference=value=>({type:'text_id',value});
const nested=value=>({type:'event',value});
const event=(id,args={})=>({id,args});
const envelope=(id,args={},context={})=>({event:event(id,args),context:{api:'pline',helperVariant:'plain',...context}});
const quest=(changes={})=>({sequence:1,lineIndex:1,lineCount:2,final:true,captureComplete:true,window:7,resolvedSection:'Wiz',resolvedMessageId:'nemesis_wantsit',itemIndex:0,field:'text',sourceTemplate:'Fixture diagnostics only, never an ID lookup.',decodedLine:'Original fixture line.',...changes});

// The loader independently guards the complete compiled C/Lua/header set,
// runtime11, source manifests and actual reader-data gate before this import.
const stage=await loadStageConfig('compiled');
stage.requireExecution();
assert.ok(process.execArgv.some(arg=>/^--max-old-space-size=128$/.test(arg)),
  'Use the measured serial command with the explicit 128MiB V8 old-space cap');
async function reserveReport(directory,name) {
  const reportPath=resolve(directory,name);
  assert.equal(reportPath,stage.reportPath);
  // Shared fresh stage root is allowed; this suite's report/artifact targets
  // must both be absent, including dangling symlinks, before any engine import.
  for(const target of [reportPath,stage.results]) {
    try {await lstat(target);assert.fail(`Refuse existing compiled evidence target: ${target}`);}
    catch(error) {if(error.code!=='ENOENT')throw error;}
  }
  await mkdir(directory,{recursive:true});
  assert.ok(inside(await realpath(resolve(ROOT,'build/phase6')),await realpath(directory)));
  await mkdir(stage.results,{recursive:false});
  // wx is the atomic report reservation. Keep this owned descriptor open;
  // final/failure records never reopen or overwrite another report by path.
  const owner=await open(reportPath,'wx');
  async function write(record) {
    const bytes=Buffer.from(`${JSON.stringify(record,null,2)}\n`,'utf8');
    await owner.truncate(0);
    for(let offset=0;offset<bytes.length;) {
      const {bytesWritten}=await owner.write(bytes,offset,bytes.length-offset,offset);
      assert.ok(bytesWritten>0);offset+=bytesWritten;
    }
    await owner.sync();
  }
  try {await write({status:'reserved',failed:null,total_passed:0,compiled_boundary_verified:false,native_callback_semantics_verified:false});}
  catch(error) {await owner.close();throw error;}
  return {write,close:()=>owner.close()};
}
const reservation=await reserveReport(stage.outputRoot,'compiled-verification.json');
let moduleInstantiationAttempted=false,suiteSetupComplete=false,finalSourceRecheck=null;
try {
const config=JSON.parse(await readFile(resolve(ROOT,stage.provenance.configPath),'utf8'));
const proofBytes=await readFile(resolve(ROOT,PROOF_PATH));
assert.equal(sha(proofBytes),PROOF_SHA,'Final selected Rust proof changed; re-review and bind a new suite');
const proof=JSON.parse(proofBytes.toString('utf8'));
assert.equal(proof.status,'native_rust_phase6_tests_passed');
assert.equal(proof.tests_passed,67);assert.equal(proof.failed,0);
for(const name of ['native','fmt','clippy','release'])assert.equal(proof.validation[name].status,'passed');
const engineManifest=JSON.parse(await readFile(resolve(ROOT,config.engine_manifest.path),'utf8'));
assert.equal(engineManifest.rust_library.sha256,proof.rustLibrary.sha256,'Installed engine must link the exact proved registered-catalog library');
assert.equal(engineManifest.rust_library.bytes,proof.rustLibrary.bytes);

const sourceInputs=[];
async function sourceInput(actualName,packageName,expected) {
  const path=await realpath(resolve(ROOT,actualName));assert.ok(inside(ROOT,path));
  const bytes=await readFile(path),actual=sha(bytes);
  if(expected)assert.equal(actual,expected,`Selected source changed: ${actualName}`);
  const previous=sourceInputs.find(item=>item.package_path===packageName);
  if(previous){assert.equal(previous.sha256,actual);return;}
  sourceInputs.push({actual_project_path:slash(relative(ROOT,path)),package_path:packageName,sha256:actual,bytes:bytes.length});
}
for(const ref of stage.testSources)await sourceInput(ref.path,ref.path,ref.sha256);
for(const ref of proof.sourceFiles)await sourceInput(`${proof.selectedRustRoot}/${ref.path}`,`rust/${ref.path}`,ref.sha256);
for(const ref of proof.projectProvenance)await sourceInput(ref.path,ref.path,ref.sha256);
for(const ref of proof.tested_fixtureSha256)await sourceInput(ref.project_path,ref.source_package_path.replace(/^nethack\//,''),ref.sha256);
for(const [name,expected] of Object.entries(config.expected_native_source_sha256)) {
  await sourceInput(`${config.native_source_root}/${name}`,`engine-source/${name}`,expected);
}
const libraryBytes=await readFile(resolve(ROOT,proof.rustLibrary.path));
assert.equal(sha(libraryBytes),proof.rustLibrary.sha256);
assert.equal(libraryBytes.length,proof.rustLibrary.bytes);
async function verifySourceInputs() {
  for(const ref of sourceInputs)assert.equal(sha(await readFile(resolve(ROOT,ref.actual_project_path))),ref.sha256,`Source changed during tests: ${ref.actual_project_path}`);
  assert.equal(sha(await readFile(resolve(ROOT,PROOF_PATH))),PROOF_SHA);
  assert.equal(sha(await readFile(resolve(ROOT,proof.rustLibrary.path))),proof.rustLibrary.sha256);
}
finalSourceRecheck=verifySourceInputs;
const factory=(await import(pathToFileURL(resolve(stage.webRoot,'engine/nethack.js')).href)).default;
const {serializeTextEvent,serializeGameplayEnvelope}=await import(pathToFileURL(resolve(stage.webRoot,'shim-host.mjs')).href);
const wasmBytes=await readFile(resolve(stage.webRoot,'engine/nethack.wasm'));
moduleInstantiationAttempted=true;
const module=await factory({noInitialRun:true,wasmBinary:new Uint8Array(wasmBytes)});
const {RegisteredCatalog}=await import(pathToFileURL(resolve(stage.webRoot,'registered-catalog-host.mjs')).href);
const catalogBytes=await readFile(resolve(stage.webRoot,stage.catalogPath));
assert.equal(sha(catalogBytes),stage.catalogSha256);
const catalog=JSON.parse(catalogBytes.toString('utf8'));
const liveHandles=new Set(),results=[];
let lastHandle=0,fullHandle=0,ownershipReuseObserved=false;

function ccall(name,args){return module.ccall(name,'number',Array(args.length).fill('number'),args);}
function withBytes(value,fn) {
  const bytes=typeof value==='string'?encoder.encode(value):value;
  const pointer=module._malloc(Math.max(1,bytes.length));assert.ok(pointer,'Allocation failed');
  module.HEAPU8.set(bytes,pointer);
  try{return fn(pointer,bytes.length);}finally{module._free(pointer);}
}
function register(paired) {
  const bytes=paired instanceof Uint8Array?paired:encoder.encode(JSON.stringify(paired));
  const handle=withBytes(bytes,(pointer,length)=>ccall('nh_rust_catalog_register',[pointer,length]));
  assert.ok(Number.isInteger(handle)&&handle>lastHandle,'Module handles must be positive and strictly increasing');
  lastHandle=handle;liveHandles.add(handle);return handle;
}
function release(handle) {
  assert.equal(ccall('nh_rust_catalog_release',[handle]),0);
  liveHandles.delete(handle);
}
function usingCatalog(paired,fn) {
  const handle=register(paired);
  try{return fn(handle);}finally{release(handle);}
}
function wire(value,kind=0) {
  return kind===0?serializeTextEvent(value):serializeGameplayEnvelope(value);
}
function raw(handle,value,kind=0,locale=0,out=0,cap=0,flag=0) {
  const serialized=typeof value==='string'?value:wire(value,kind);
  return withBytes(serialized,(pointer,length)=>ccall('nh_rust_format_registered',[handle,pointer,length,kind,locale,out,cap,flag]));
}
function outputBuffers(cap,fn) {
  // Separate allocations; disjoint writable output and fallback are ABI rules.
  const output=module._malloc(cap+2),fallback=module._malloc(3);
  assert.ok(output&&fallback);
  module.HEAPU8.fill(CANARY,output,output+cap+2);module.HEAPU8.fill(CANARY,fallback,fallback+3);
  try{return fn(output+1,fallback+1,output,fallback);}finally{module._free(output);module._free(fallback);}
}
function render(handle,value,kind=0,locale=0) {
  return outputBuffers(MAX_OUTPUT,(out,flag,base,fbase)=>{
    const size=raw(handle,value,kind,locale,out,MAX_OUTPUT,flag);
    assert.ok(Number.isInteger(size)&&size>=0&&size<=MAX_OUTPUT,`Registered rendering rejected: ${size}`);
    assert.equal(module.HEAPU8[base],CANARY);assert.equal(module.HEAPU8[base+MAX_OUTPUT+1],CANARY);
    assert.equal(module.HEAPU8[fbase],CANARY);assert.equal(module.HEAPU8[fbase+2],CANARY);
    const fallback=module.HEAPU8[flag];assert.ok([0,1].includes(fallback));
    // Obtain a fresh view after the call in case malloc/format grew Wasm memory.
    const rendered=decoder.decode(module.HEAPU8.subarray(out,out+size));
    assert.ok(module.HEAPU8.subarray(out+size,out+MAX_OUTPUT).every(byte=>byte===CANARY));
    return {text:rendered,usedFallback:fallback===1,bytes:size};
  });
}
function rejected(handle,json,{kind=0,locale=0,error=-3}={}) {
  return outputBuffers(32,(out,flag,base,fbase)=>{
    const result=raw(handle,json,kind,locale,out,32,flag);assert.equal(result,error);
    assert.ok(module.HEAPU8.subarray(base,base+34).every(byte=>byte===CANARY));
    assert.ok(module.HEAPU8.subarray(fbase,fbase+3).every(byte=>byte===CANARY));
  });
}
function stateless(paired,value,kind,locale) {
  const prefix=kind===0?'nh_rust_format':'nh_rust_format_gameplay';
  const bytes=paired instanceof Uint8Array?paired:encoder.encode(JSON.stringify(paired));
  return withBytes(bytes,(catalogPtr,catalogLen)=>withBytes(wire(value,kind),(eventPtr,eventLen)=>{
    const args=[catalogPtr,catalogLen,eventPtr,eventLen,locale];
    const fallback=ccall(`${prefix}_fallback`,args);assert.ok([0,1].includes(fallback));
    const size=ccall(prefix,[...args,0,0]);assert.ok(size>=0&&size<=MAX_OUTPUT);
    return outputBuffers(Math.max(1,size),(out,flag,base,fbase)=>{
      assert.equal(ccall(prefix,[...args,out,size]),size);
      assert.equal(module.HEAPU8[base],CANARY);assert.equal(module.HEAPU8[base+Math.max(1,size)+1],CANARY);
      assert.ok(module.HEAPU8.subarray(fbase,fbase+3).every(byte=>byte===CANARY));
      return {text:decoder.decode(module.HEAPU8.subarray(out,out+size)),usedFallback:fallback===1,bytes:size};
    });
  }));
}
function equalPaths(paired,handle,value,kind=0) {
  for(const locale of [0,1])assert.deepEqual(render(handle,value,kind,locale),stateless(paired,value,kind,locale));
}
function errorRegistration(json,expected=-3) {
  assert.equal(withBytes(json,(pointer,length)=>ccall('nh_rust_catalog_register',[pointer,length])),expected);
}
async function check(name,fn) {
  const start=performance.now();
  try{await fn();results.push({name,status:'passed',duration_ms:Math.round((performance.now()-start)*1000)/1000});}
  catch(error){results.push({name,status:'failed',error:String(error.stack??error),duration_ms:Math.round((performance.now()-start)*1000)/1000});console.error(`FAIL ${name}: ${error.message}`);}
}
const simple={en:{'fixture.raw':'{raw}','fixture.empty':''},ja:{'fixture.raw':'{raw}','fixture.empty':''}};
const simpleEvent=event('fixture.raw',{raw:text('自由 100% {x} 🐈')});
suiteSetupComplete=true;

await check('Required compiled registered and legacy exports/default locale',()=>{
  for(const name of ['nh_rust_catalog_register','nh_rust_catalog_release','nh_rust_format_registered','nh_rust_format','nh_rust_format_fallback','nh_rust_format_gameplay','nh_rust_format_gameplay_fallback'])assert.equal(typeof module[`_${name}`],'function',name);
  assert.equal(ccall('nh_rust_default_locale',[]),0);
});
await check('Native semantic getter cannot invent an event outside actual callback scope',()=>{
  assert.equal(typeof module._nh_abi_semantic_event,'function');
  for(const callback of ['shim_putstr','shim_raw_print','shim_add_menu','shim_yn_function','shim_end_menu','shim_getlin','shim_exit_nhwindows','unknown']) {
    for(const window of [-1,0,1,7])assert.equal(module.ccall('nh_abi_semantic_event','number',['string','number'],[callback,window]),0);
  }
});
await check('Catalog ownership survives caller free and valid allocator overwrite',()=>{
  const bytes=encoder.encode(JSON.stringify(simple)),pointer=module._malloc(bytes.length);assert.ok(pointer);
  module.HEAPU8.set(bytes,pointer);
  const handle=ccall('nh_rust_catalog_register',[pointer,bytes.length]);
  module._free(pointer);assert.ok(handle>lastHandle);lastHandle=handle;liveHandles.add(handle);
  const poison=module._malloc(bytes.length);assert.ok(poison);ownershipReuseObserved=poison===pointer;
  module.HEAPU8.fill(0x7f,poison,poison+bytes.length);
  try{assert.equal(render(handle,simpleEvent).text,'自由 100% {x} 🐈');}finally{module._free(poison);release(handle);}
});
await check('Module-local handles strictly increase across explicit release; stale never revives',()=>{
  const first=register(simple);release(first);assert.equal(ccall('nh_rust_catalog_release',[first]),-7);
  const next=register(simple);assert.ok(next>first);
  try{rejected(first,simpleEvent,{error:-7});rejected(0,simpleEvent,{error:-7});}
  finally{release(next);}
});
await check('Host owner rejects foreign module objects and all rendering after idempotent disposal',()=>{
  const owned=new RegisteredCatalog(module,JSON.stringify(simple));
  const foreign={ccall(){throw new Error('Foreign module must never be called');}};
  try{
    assert.equal(owned.renderJSON(module,wire(simpleEvent),'ja',0).text,'自由 100% {x} 🐈');
    assert.throws(()=>owned.renderJSON(foreign,wire(simpleEvent),'ja',0),/different Wasm instance/);
    assert.throws(()=>owned.dispose(foreign),/different Wasm instance/);
  }finally{owned.dispose(module);}
  owned.dispose(module);
  assert.throws(()=>owned.renderJSON(module,wire(simpleEvent),'ja',0),/disposed/);
});
await check('Registry count bound eight; ninth rejects; explicit release restores admission',()=>{
  const handles=[];
  try{
    for(let i=0;i<8;i++)handles.push(register(simple));
    errorRegistration(JSON.stringify(simple),-6);release(handles.shift());handles.push(register(simple));
  }finally{for(const handle of handles)release(handle);}
});
await check('Catalog malformed UTF8/schema/ID/templates are rejected at registration',()=>{
  errorRegistration(new Uint8Array([0xff]),-3);
  for(const invalid of ['{','{"en":{},"ja":{},"metadata":{}}',
    '{"en":{"9invalid":"x"},"ja":{}}',
    '{"en":{"fixture.bad":"{missing}"},"ja":{"fixture.bad":"none"}}',
    '{"en":{"fixture.bad":"{x}"},"ja":{},"argument_schemas":{"fixture.bad":["other"]}}'])errorRegistration(invalid);
  assert.equal(ccall('nh_rust_catalog_register',[0,1]),-1);
  assert.equal(ccall('nh_rust_catalog_register',[0,MAX_CATALOG+1]),-6);
});
await check('Direct UTF8/free text matches stateless EN/JA text and fallback',()=>usingCatalog(simple,handle=>equalPaths(simple,handle,simpleEvent)));
await check('Query/short/full copies preserve guards and optional fallback contract',()=>usingCatalog(simple,handle=>{
  const expected=encoder.encode('自由 100% {x} 🐈').length;
  outputBuffers(expected+4,(out,flag,base,fbase)=>{
    assert.equal(raw(handle,simpleEvent,0,0,0,0,flag),expected);
    assert.ok(module.HEAPU8.subarray(base,base+expected+6).every(byte=>byte===CANARY));
    assert.ok(module.HEAPU8.subarray(fbase,fbase+3).every(byte=>byte===CANARY));
    assert.equal(raw(handle,simpleEvent,0,0,out,expected-1,flag),expected);
    assert.ok(module.HEAPU8.subarray(base,base+expected+6).every(byte=>byte===CANARY));
    assert.ok(module.HEAPU8.subarray(fbase,fbase+3).every(byte=>byte===CANARY));
    assert.equal(raw(handle,simpleEvent,0,0,out,expected,flag),expected);
    assert.equal(module.HEAPU8[flag],0);assert.equal(module.HEAPU8[out+expected],CANARY);
    assert.equal(raw(handle,simpleEvent,0,1,out,expected,0),expected);
  });
}));
await check('Empty output query leaves flag; full valid output writes false',()=>usingCatalog(simple,handle=>{
  const value=event('fixture.empty');
  outputBuffers(1,(out,flag)=>{assert.equal(raw(handle,value,0,0,0,0,flag),0);assert.equal(module.HEAPU8[flag],CANARY);assert.equal(raw(handle,value,0,0,out,1,flag),0);assert.equal(module.HEAPU8[flag],0);assert.equal(module.HEAPU8[out],CANARY);});
}));
await check('Invalid kind/locale/handle/pointer/bounds leave output and fallback untouched',()=>usingCatalog(simple,handle=>{
  rejected(handle,JSON.stringify(simpleEvent),{kind:2,error:-2});rejected(handle,JSON.stringify(simpleEvent),{locale:2,error:-2});
  rejected(handle,'{');
  outputBuffers(32,(out,flag,base,fbase)=>{
    for(const [ptr,len,kind,expected] of [[0,1,0,-1],[0,MAX_TEXT+1,0,-6],[0,MAX_GAMEPLAY+1,1,-6]])assert.equal(ccall('nh_rust_format_registered',[handle,ptr,len,kind,0,out,32,flag]),expected);
    assert.equal(raw(handle,simpleEvent,0,0,0,32,flag),-1);
    assert.ok(module.HEAPU8.subarray(base,base+34).every(byte=>byte===CANARY));assert.ok(module.HEAPU8.subarray(fbase,fbase+3).every(byte=>byte===CANARY));
  });
}));
await check('Complete installed merged catalog validates and registers exactly once',()=>{
  assert.ok(Object.keys(catalog.en).length>3026);assert.ok(Object.keys(catalog.ja).length>3026);
  assert.ok(Object.keys(catalog.argument_schemas??{}).length>960);
  fullHandle=register(catalogBytes);
});
await check('Merged source IDs/default Japanese equal legacy stateless rendering',()=>{
  assert.ok(fullHandle);
  for(const id of ['nethack.entity.monster.orc.name_neutral','nethack.message.eat.cpostfx.pline.yum_that_was_real_brain_food.ce60299dbd']){
    assert.ok(catalog.en[id]!==undefined&&catalog.ja[id]!==undefined);
    equalPaths(catalogBytes,fullHandle,envelope(id),1);
    assert.equal(render(fullHandle,envelope(id),1,0).text,catalog.ja[id]);
  }
});
await check('Captured dream/underwater/plain helper variants retain exact localized templates',()=>{
  const id='nethack.message.dbridge.destroy_drawbridge.you_hear.a_loud_crash.375d03f6b7';
  for(const helperVariant of ['plain','dream','underwater']){
    const value=envelope(id,{}, {api:'You_hear',helperVariant});equalPaths(catalogBytes,fullHandle,value,1);
    const lookup=helperVariant==='plain'?id:`variant.${helperVariant}.${id}`;
    for(const locale of [0,1])assert.equal(render(fullHandle,value,1,locale).text,catalog[locale===0?'ja':'en'][lookup]);
  }
});
await check('Accessibility qualifier remains literal, visible and explicit Japanese fallback',()=>{
  const id='nethack.message.dbridge.destroy_drawbridge.you_hear.a_loud_crash.375d03f6b7';
  const location='north 100% {public_coordinate}',value=envelope(id,{}, {api:'You_hear',locationPrefix:location});
  equalPaths(catalogBytes,fullHandle,value,1);
  assert.ok(render(fullHandle,value,1,0).text.includes(location));assert.equal(render(fullHandle,value,1,0).usedFallback,true);
  assert.equal(render(fullHandle,value,1,1).usedFallback,false);
});
await check('Original source %c promoted integer and %i/%o/%x width remain exact',()=>{
  const id='nethack.message.eat.eatspecial.pline.yuck_c.dbe94b5155';
  for(const [value,result] of [[33,'Yuck!'],[46,'Yuck.']]){
    const valueEvent=envelope(id,{arg_1:integer(value)});equalPaths(catalogBytes,fullHandle,valueEvent,1);assert.equal(render(fullHandle,valueEvent,1,1).text,result);
  }
  const command=envelope('nethack.message.pager.dowhatdoes.pline.no_such_command_s_char_code_d.2fa35947a9',{arg_1:text('?'),arg_2:integer(63),arg_3:unsigned(63),arg_4:unsigned(63)});
  equalPaths(catalogBytes,fullHandle,command,1);assert.equal(render(fullHandle,command,1,1).text,"No such command '?', char code 63 (0077 or 0x3f).");
});
await check('Exact i64/u64/boolean numeric tokens and UTF8 literal slots match both ABIs',()=>{
  const paired={en:{'fixture.typed':'{signed:%ld}|{unsigned}|{boolean}|{literal:%s}'},ja:{'fixture.typed':'{signed:%ld}|{unsigned}|{boolean}|{literal:%s}'}};
  const value=event('fixture.typed',{signed:integer(-9223372036854775808n),unsigned:unsigned(18446744073709551615n),boolean:{type:'boolean',value:true},literal:text('自由 100% {x} 🐈')});
  usingCatalog(paired,handle=>{equalPaths(paired,handle,value);assert.equal(render(handle,value).text,'-9223372036854775808|18446744073709551615|true|自由 100% {x} 🐈');});
});
await check('Strict typed JSON rejects unknown fields/overflow/wrong numeric printf type',()=>{
  const paired={en:{'fixture.typed':'{number:%d}'},ja:{'fixture.typed':'{number:%d}'}};
  usingCatalog(paired,handle=>{
    for(const args of ['{"number":{"type":"integer","value":9223372036854775808}}','{"number":{"type":"unsigned","value":18446744073709551616}}','{"number":{"type":"integer","value":1,"hidden":true}}','{"number":{"type":"text","value":"1"}}','{"number":{"type":"integer","value":1},"extra":{"type":"integer","value":2}}'])rejected(handle,`{"id":"fixture.typed","args":${args}}`);
    rejected(handle,'{"id":"fixture.typed","args":{"number":{"type":"integer","value":1}},"hiddenKnowledge":true}');
  });
});
await check('Nested semantic names propagate English-only leaf fallback without translation guessing',()=>{
  const paired={en:{'fixture.name':'{original}','fixture.leaf':'raw public name'},ja:{'fixture.name':'{inner}'},argument_schemas:{'fixture.name':['original','inner'],'fixture.leaf':[]}};
  const value=event('fixture.name',{original:text('the raw public name'),inner:nested(event('fixture.leaf'))});
  usingCatalog(paired,handle=>{equalPaths(paired,handle,value);assert.equal(render(handle,value,0,0).text,'raw public name');assert.equal(render(handle,value,0,0).usedFallback,true);assert.equal(render(handle,value,0,1).text,'the raw public name');});
});
await check('Source object composition accepts full 26-argument union with locale-specific use',()=>{
  const id='nethack.name.object.public.sequence_25',args={original:text('completed native English')};
  assert.equal(catalog.argument_schemas[id].length,26);
  for(let i=1;i<=25;i++)args[`part_${i}`]=text(`公${i}`);
  const value=envelope(id,args);equalPaths(catalogBytes,fullHandle,value,1);
  assert.equal(render(fullHandle,value,1,1).text,'completed native English');
  assert.equal(render(fullHandle,value,1,0).text,Array.from({length:25},(_,i)=>`公${i+1}`).join(''));
});
await check('Nested event root depth0 through8 accepted; depth9 including unused union rejected',()=>{
  const paired={en:{'fixture.node':'{child}','fixture.leaf':'終'},ja:{'fixture.node':'{child}','fixture.leaf':'終'}};
  const chain=depth=>{let value=event('fixture.leaf');for(let i=0;i<depth;i++)value=event('fixture.node',{child:nested(value)});return value;};
  usingCatalog(paired,handle=>{equalPaths(paired,handle,chain(8));rejected(handle,JSON.stringify(chain(9)));});
  const union={en:{'fixture.union':'{original}',...paired.en},ja:{'fixture.union':'{original}',...paired.ja},argument_schemas:{'fixture.union':['original','unused']}};
  usingCatalog(union,handle=>rejected(handle,JSON.stringify(event('fixture.union',{original:text('public'),unused:nested(chain(8))}))));
});
await check('Repeated empty nested expansion rejects bounded work even with tiny final text',()=>{
  const paired={en:{'fixture.expand':'{child}'.repeat(8),'fixture.leaf':''},ja:{'fixture.expand':'{child}'.repeat(8),'fixture.leaf':''}};
  let value=event('fixture.leaf');for(let i=0;i<8;i++)value=event('fixture.expand',{child:nested(value)});
  usingCatalog(paired,handle=>rejected(handle,JSON.stringify(value)));
});
await check('512 owned event nodes accepted; 513 even in unused schema branches rejected',()=>{
  const rootNames=['original',...Array.from({length:8},(_,i)=>`branch_${i}`)];
  const branchNames=count=>['original',...Array.from({length:count},(_,i)=>`leaf_${i}`)];
  const paired={en:{'fixture.root':'{original}','fixture.branch':'{original}','fixture.short':'{original}','fixture.leaf':'public'},ja:{'fixture.root':'{original}','fixture.branch':'{original}','fixture.short':'{original}','fixture.leaf':'公開'},argument_schemas:{'fixture.root':rootNames,'fixture.branch':branchNames(63),'fixture.short':branchNames(62),'fixture.leaf':[]}};
  function tree(count) {
    const args={original:text('public')};
    for(let i=0;i<8;i++) {
      const size=i===7&&count===512?62:63,child={original:text('public')};
      for(let j=0;j<size;j++)child[`leaf_${j}`]=nested(event('fixture.leaf'));
      args[`branch_${i}`]=nested(event(size===62?'fixture.short':'fixture.branch',child));
    }
    return envelope('fixture.root',args);
  }
  usingCatalog(paired,handle=>{assert.equal(render(handle,tree(512),1).text,'public');rejected(handle,JSON.stringify(tree(513)),{kind:1});});
});
await check('4096 total typed arguments accepted;4097 unused nested values reject',()=>{
  const rootNames=['original',...Array.from({length:63},(_,i)=>`branch_${i}`)],branchNames=Array.from({length:64},(_,i)=>`slot_${i}`);
  const paired={en:{'fixture.root':'{original}','fixture.branch':'{slot_0}','fixture.leaf':'{value}'},ja:{'fixture.root':'{original}','fixture.branch':'{slot_0}','fixture.leaf':'{value}'},argument_schemas:{'fixture.root':rootNames,'fixture.branch':branchNames,'fixture.leaf':['value']}};
  const args={original:text('public')};
  for(let i=0;i<63;i++)args[`branch_${i}`]=nested(event('fixture.branch',Object.fromEntries(branchNames.map(name=>[name,text('x')]))));
  const value=envelope('fixture.root',args);
  usingCatalog(paired,handle=>{
    assert.equal(render(handle,value,1).text,'public');
    const tooMany=structuredClone(value);tooMany.event.args.branch_0.value.args.slot_0=nested(event('fixture.leaf',{value:text('x')}));
    rejected(handle,JSON.stringify(tooMany),{kind:1});
  });
});
await check('Per-event64 args accepted,65 rejected and single text64KiB bound enforced',()=>{
  const schemas=Array.from({length:64},(_,i)=>`arg_${i}`),args=Object.fromEntries(schemas.map(name=>[name,text('x')]));
  const paired={en:{'fixture.union':'{arg_0}'},ja:{'fixture.union':'{arg_0}'},argument_schemas:{'fixture.union':schemas}};
  usingCatalog(paired,handle=>{equalPaths(paired,handle,event('fixture.union',args));rejected(handle,JSON.stringify(event('fixture.union',{...args,arg_64:text('x')})));});
  usingCatalog(simple,handle=>{
    const value=envelope('fixture.raw',{raw:text('x'.repeat(MAX_TEXT))});assert.equal(render(handle,value,1).bytes,MAX_TEXT);
    rejected(handle,JSON.stringify(envelope('fixture.raw',{raw:text('x'.repeat(MAX_TEXT+1))})),{kind:1});
  });
});
await check('Gameplay accepts aggregate output beyond64KiB but output over128KiB rejects',()=>{
  const paired={en:{'fixture.large':'{left}{right}','context.location_prefix':'{location}: {text}'},ja:{'fixture.large':'{left}{right}','context.location_prefix':'{location}：{text}'}};
  usingCatalog(paired,handle=>{
    const value=envelope('fixture.large',{left:text('x'.repeat(33000)),right:text('y'.repeat(33000))},{locationPrefix:'north'});
    assert.equal(render(handle,value,1,1).bytes,66007);equalPaths(paired,handle,value,1);
  });
  const huge={en:{'fixture.large':'{raw}{raw}{raw}'},ja:{'fixture.large':'{raw}{raw}{raw}'}};
  usingCatalog(huge,handle=>rejected(handle,JSON.stringify(envelope('fixture.large',{raw:text('x'.repeat(50000))})),{kind:1}));
});
await check('Complete quest declared union retains English modifier and Japanese base slots',()=>{
  const id='nethack.quest.wiz.nemesis_wantsit.text',names=catalog.argument_schemas[id];assert.deepEqual([...names].sort(),['quest_quest_artifact','quest_quest_artifact_modifier_C'].sort());
  const value=envelope(id,{quest_quest_artifact:text('魔法使いの魔除け'),quest_quest_artifact_modifier_C:text('The Eye of the Aethiopica')},{api:'convert_line',quest:quest()});
  equalPaths(catalogBytes,fullHandle,value,1);
  assert.ok(render(fullHandle,value,1,0).text.includes('魔法使いの魔除け'));
  assert.ok(render(fullHandle,value,1,1).text.includes('The Eye of the Aethiopica'));
});
await check('Quest completion,sequence,line/window/field bounds and exact union fail closed',()=>{
  const paired={en:{'fixture.quest':'{original}'},ja:{'fixture.quest':'{base}'},argument_schemas:{'fixture.quest':['original','base']}};
  usingCatalog(paired,handle=>{
    const value=envelope('fixture.quest',{original:text('public English'),base:text('公開日本語')},{quest:quest()});equalPaths(paired,handle,value,1);
    for(const changes of [{sequence:0},{lineCount:4097},{lineIndex:2},{final:false},{captureComplete:false},{window:2147483648},{field:'unknown'},{field:'item',itemIndex:0},{field:'text',itemIndex:1},{resolvedSection:''},{resolvedMessageId:'x'.repeat(161)},{decodedLine:'x'.repeat(MAX_TEXT+1)}])rejected(handle,JSON.stringify({...value,context:{...value.context,quest:quest(changes)}}),{kind:1});
    const missing=envelope('fixture.quest',{original:text('public')},{quest:quest()});rejected(handle,JSON.stringify(missing),{kind:1});
  });
});
await check('Native API context identifiers accepted; unknown helper branch/hidden context rejected',()=>usingCatalog(simple,handle=>{
  for(const api of ['panic','panic1','config_error_add','livelog_printf','dump_forward_putstr','exit_nhwindows'])assert.equal(render(handle,envelope('fixture.raw',{raw:text('public')},{api}),1).text,'public');
  for(const context of [{api:'invalid-api'},{api:'pline',helperVariant:'blind'},{api:'You_hear',helperVariant:'blind'},{hiddenKnowledge:true}])rejected(handle,JSON.stringify(envelope('fixture.raw',{raw:text('public')},context)),{kind:1});
}));
await check('Repeated registered EN/JA renders leave native state/world/RNG checksums exact',()=>{
  const checksum=()=>Object.fromEntries(['nh_abi_state_checksum','nh_abi_world_checksum','nh_abi_rng_checksum'].map(name=>[name,ccall(name,[])]));
  const before=checksum(),value=envelope('nethack.entity.monster.orc.name_neutral');
  for(let i=0;i<20;i++)render(fullHandle,value,1,i%2);
  assert.deepEqual(checksum(),before);
});

await check('Explicit teardown releases every owned handle and rejects final stale lookup',()=>{
  const stale=fullHandle;
  for(const handle of [...liveHandles])release(handle);
  assert.equal(liveHandles.size,0);
  if(stale)rejected(stale,event('nethack.entity.monster.orc.name_neutral'),{error:-7});
});
await check('Installed runtime11, selected compiled source/header and Rust proof remain unchanged',async()=>{
  await stage.verifyUnchanged();await verifySourceInputs();
});

const failed=results.filter(item=>item.status==='failed').length;
const runtimeSha=Object.fromEntries(stage.artifacts.map(item=>[`web/${item.name}`,item.sha256]));
const report={
  schema_version:1,status:failed?'failed':'passed',phase:'phase6-registered-catalog-compiled-boundary',
  measured_at:new Date().toISOString(),source_commit:'16ff59115315917b93185d026aeefea06db9b0f4',abi:'nethack-shim-5.0.0-v1',
  total_passed:results.length-failed,failed,skipped:0,results,
  wasm_sha256:sha(wasmBytes),runtime_sha256:runtimeSha,
  source_sha256:Object.fromEntries(sourceInputs.map(ref=>[ref.package_path,ref.sha256])),source_inputs:sourceInputs,
  selected_rust_proof:{path:PROOF_PATH,sha256:PROOF_SHA,tests_passed:proof.tests_passed,rust_library:proof.rustLibrary},
  config_sha256:stage.provenance.config_sha256,test_source_sha256:sha(await readFile(fileURLToPath(import.meta.url))),
  provenance:stage.provenance,command:[process.execPath,...process.execArgv,...process.argv.slice(1)],
  merged_catalog:{sha256:stage.catalogSha256,bytes:catalogBytes.length,en:Object.keys(catalog.en).length,ja:Object.keys(catalog.ja).length,argument_schemas:Object.keys(catalog.argument_schemas??{}).length},
  ownership_allocator_reuse_observed:ownershipReuseObserved,
  compiled_boundary_verified:failed===0,compiled_pipeline_verified:false,native_callback_semantics_verified:false,
  browser_invoked:false,compiler_invoked:false,server_invoked:false,game_loop_started:false,
  maximum_concurrent_wasm_instances:1,v8_old_space_limit_mib:128,speedup_claimed:false,
  limits:[
    'Synthetic typed events do not prove original C callback selection, hidden-information safety or native producer lifetime.',
    'Handles are module-local; a numeric token must never be reused with a replacement module. This suite initializes one instance.',
    'Concurrent release/thread reentry and handle exhaustion near i32::MAX are not exercised by this single-thread compiled fixture suite.',
    'This is an ABI check, not the same100 accumulated-history browser performance benchmark.'
  ]
};
await reservation.write(report);
console.log(JSON.stringify({status:report.status,total_passed:report.total_passed,failed,report:slash(relative(ROOT,stage.reportPath)),wasm_sha256:report.wasm_sha256}));
if(failed)process.exitCode=1;
} catch(error) {
  const endChecks={};
  try {await stage.verifyUnchanged();endChecks.stage='passed';}
  catch(checkError) {endChecks.stage='failed';endChecks.stage_error=String(checkError.stack??checkError);}
  if(finalSourceRecheck) {
    try {await finalSourceRecheck();endChecks.selected_source='passed';}
    catch(checkError) {endChecks.selected_source='failed';endChecks.selected_source_error=String(checkError.stack??checkError);}
  } else {endChecks.selected_source='unavailable-before-source-setup-completed';}
  await reservation.write({schema_version:1,status:'failed',phase:'phase6-registered-catalog-compiled-boundary',failed:1,total_passed:0,setup_failed:!suiteSetupComplete,error:String(error.stack??error),end_input_verification:endChecks,module_instantiation_attempted:moduleInstantiationAttempted,compiled_boundary_verified:false,compiled_pipeline_verified:false,native_callback_semantics_verified:false,browser_invoked:false,compiler_invoked:false,server_invoked:false,game_loop_started:false,provenance:stage.provenance});
  throw error;
} finally {await reservation.close();}
