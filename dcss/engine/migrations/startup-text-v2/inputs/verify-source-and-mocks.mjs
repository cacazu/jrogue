// Bounded source/ABI/protocol mocks. Never starts a game or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {STARTUP_TEXT_PIN as pin,createStartupTextBridge,expectedNativeDisplayText,validateNativeDisplayMessage,loadStartupTextBridge} from './web/startup-text.mjs';
import {classifyStartingWeaponMenu,nativeFrameRows} from './tests/controlled-gameplay-browser.mjs';
import {nativeMenuEntityHotkey,nativeCjkLabelCells} from './tests/native-dynamic-startup-browser.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),game='C:/Users/kit/gameme/jnethack/jrouge/dcss';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),read=relative=>fs.readFileSync(path.join(root,relative));
const normalized=bytes=>bytes.toString('utf8').replace(/\r\n/g,'\n');
const receipts=JSON.parse(read('source-receipts.json')),checks=[];
function check(label,body){body();checks.push(label);}
check('exact45-ID categorized union/frozen pin',()=>{
  assert.equal(pin.ids.length,45);assert(Object.isFrozen(pin));assert(Object.isFrozen(pin.messages));
  assert.deepEqual(Object.fromEntries(['fixed','dynamic','hud'].map(category=>[category,pin.ids.filter(id=>pin.messages[id].category===category).length])),{fixed:11,dynamic:12,hud:22});
});
for(const override of receipts.native_overrides)check('whole immutable native inversion '+override.native_path,()=>{
  const finalBytes=read('engine/'+path.basename(override.native_path));assert.equal(hash(finalBytes),override.final_sha256);
  let current=normalized(finalBytes);
  for(const action of override.inverse_actions.toReversed()){
    const after=normalized(Buffer.from(action.after)),before=normalized(Buffer.from(action.before));
    assert.equal(current.split(after).length,2);current=current.replace(after,before);
  }
  const original=fs.readFileSync(path.join(game,'upstream',override.native_path));assert.equal(hash(original),override.original_sha256);assert.equal(current,normalized(original));
});
check('library exact inverse to frozen pristine baseline',()=>{
  let text=read('engine/library.js').toString('utf8');for(const action of receipts.library.inverse_actions.toReversed()){assert.equal(text.split(action.after).length,2);text=text.replace(action.after,action.before);}
  assert.equal(hash(Buffer.from(text)),receipts.library.base_sha256);assert.equal(hash(read('base/engine/library.js')),receipts.library.base_sha256);
});
for(const asset of receipts.assets)check('catalog/source asset hash '+asset.path,()=>assert.equal(hash(read(asset.path.slice(1))),asset.sha256));
function mock(){
  const memory=new WebAssembly.Memory({initial:2}),state={requests:[],releases:[],mutate:null,callback:null,grow:false};
  const exports={memory,dcss_allocate(length){assert(length<=4096);return 256;},dcss_request(pointer,length){
    const request=JSON.parse(new TextDecoder().decode(new Uint8Array(memory.buffer,pointer,length)));state.requests.push(request);
    if(state.callback)state.callback(request);if(state.grow){memory.grow(1);state.grow=false;}
    let response={ok:true,value:null,session:null,messages:[request.message],text:[expectedNativeDisplayText(request.message.id,request.message.params,request.language)]};
    if(state.mutate)response=state.mutate(response);
    const bytes=new TextEncoder().encode(JSON.stringify(response));new Uint8Array(memory.buffer,8192,bytes.length).set(bytes);return(BigInt(bytes.length)<<32n)|8192n;
  },dcss_release(pointer,length){state.releases.push({pointer,length});}};
  return{exports,state};
}
for(const language of ['en','ja']){
  const abi=mock(),bridge=createStartupTextBridge(abi.exports,language);
  check('all90preflight requests use plain Text, exact per-ID categories, both locales '+language,()=>{
    assert.equal(abi.state.requests.length,90);assert(abi.state.requests.every(request=>request.op==='text'&&request.message&&!Object.hasOwn(request,'session')));
    for(const id of pin.ids)assert.deepEqual(abi.state.requests.filter(request=>request.message.id===id).map(request=>request.language),['en','ja']);
    assert.equal(abi.state.releases.length,180);
  });
  for(const id of pin.ids)check('reviewed '+language+' native buffer text '+id,()=>{
    const params=pin.messages[id].preflight_params,text=bridge.format(id,params);
    assert.equal(text,expectedNativeDisplayText(id,params,language));assert(Buffer.byteLength(text)<=511);
  });
  check('memory growth uses fresh Rust views '+language,()=>{abi.state.grow=true;assert.equal(bridge.format('startup.weapon.prompt',{}),pin[language]);});
  for(const mutate of [
    response=>({...response,session:{unexpected:true}}),
    response=>({...response,messages:[{id:response.messages[0].id,params:{unexpected:true}}]}),
    response=>({...response,text:['arbitrary native text']}),
  ])check('reject corrupted response and release both allocations '+language+' '+checks.length,()=>{
    abi.state.mutate=mutate;const before=abi.state.releases.length;assert.throws(()=>bridge.format('startup.weapon.prompt',{}));
    assert.equal(abi.state.releases.length,before+2);abi.state.mutate=null;
  });
  check('reentrant formatter fails and recovers '+language,()=>{
    abi.state.callback=()=>bridge.format('startup.weapon.prompt',{});assert.throws(()=>bridge.format('startup.weapon.prompt',{}),/reentrant/);
    abi.state.callback=null;assert.equal(bridge.format('startup.weapon.prompt',{}),pin[language]);
  });
}
const validSpecies=pin.messages['startup.dynamic.species_name'].preflight_params.species;
for(const bad of [
  {...validSpecies,domain:'job'},{...validSpecies,id:'species.sp_human.abbrev'},{...validSpecies,id:'Human'},
  {...validSpecies,version:2},{...validSpecies,upstream:'unreviewed'},{...validSpecies,extra:1},
])check('reject malformed/unknown entity '+checks.length,()=>assert.throws(()=>validateNativeDisplayMessage('startup.dynamic.species_name',{species:bad})));
const validActor=pin.messages['startup.dynamic.welcome.named_only'].preflight_params.player_name;
for(const name of ['','a\0b','a\nb','\ud800','a'.repeat(129)])check('reject external actor outside native scalar/buffer profile '+checks.length,()=>assert.throws(()=>
  validateNativeDisplayMessage('startup.dynamic.welcome.named_only',{player_name:{...validActor,identity:{visibility:'external',name}}})));
check('external actor literal is preserved in both reviewed languages',()=>{
  const params={player_name:{...validActor,identity:{visibility:'external',name:'Literal_Kit-Name'}}};
  for(const language of ['en','ja'])assert(expectedNativeDisplayText('startup.dynamic.welcome.named_only',params,language).includes('Literal_Kit-Name'));
});
// Exercise the actual staged Emscripten import in a tiny standalone VM heap.
const heap=new Uint8Array(65536),encoder=new TextEncoder(),nativeErrors=[];
const nativeContext={HEAPU8:heap,TextDecoder,LibraryManager:{library:{}},Module:{dcssFormatStartup(id,params){return expectedNativeDisplayText(id,params,'ja');},dcssStartupTextError(error){nativeErrors.push(error);}},
  mergeInto(target,value){Object.assign(target,value);},lengthBytesUTF8:text=>encoder.encode(text).length,
  stringToUTF8(text,pointer,capacity){const bytes=encoder.encode(text);assert(bytes.length<capacity);heap.set(bytes,pointer);heap[pointer+bytes.length]=0;}};
vm.createContext(nativeContext);vm.runInContext(read('engine/library.js').toString('utf8'),nativeContext,{timeout:2000});
function nativeCall(id,params){
  heap.fill(0);heap.set(encoder.encode(id),256);heap.set(encoder.encode(JSON.stringify(params)),4096);
  return nativeContext.LibraryManager.library.dcss_host_startup_text(256,4096,8192,512);
}
for(const id of pin.ids)check('actual staged synchronous native import '+id,()=>{
  const params=pin.messages[id].preflight_params,length=nativeCall(id,params);assert(length>0&&length<512);
  assert.equal(new TextDecoder('utf8',{fatal:true}).decode(heap.slice(8192,8192+length)),expectedNativeDisplayText(id,params,'ja'));assert.equal(heap[8192+length],0);
});
check('native import rejects unknown IDs/extra params/unreviewed output/capacity',()=>{
  assert.equal(nativeCall('startup.unreviewed',{}),-1);assert.equal(nativeCall('startup.weapon.prompt',{extra:1}),-1);
  const formatter=nativeContext.Module.dcssFormatStartup;nativeContext.Module.dcssFormatStartup=()=> 'unknown translation';
  assert.equal(nativeCall('startup.weapon.prompt',{}),-1);nativeContext.Module.dcssFormatStartup=formatter;
  assert.equal(nativeContext.LibraryManager.library.dcss_host_startup_text(256,4096,8192,511),-1);assert.equal(nativeErrors.length,4);
});
// Replace only the pending boundary pin in a disposable in-memory module, then
// supply a mock Rust instance. This tests real loader checks without executing WASM.
const fakeBoundary=Buffer.from('mock-boundary-v2'),runtimeSource=read('web/startup-text.mjs').toString('utf8')
  .replace('"bytes": '+pin.boundary.bytes,'"bytes": '+fakeBoundary.length).replace(pin.boundary.sha256,hash(fakeBoundary));
const loaderModule=await import('data:text/javascript;base64,'+Buffer.from(runtimeSource).toString('base64'));
const assets=new Map(pin.catalogs.map(asset=>[asset.path,read(asset.path.slice(1))]));assets.set('/build/boundary.wasm',fakeBoundary);
const fetches=[];const abi=mock();
await loaderModule.loadStartupTextBridge('ja',{crypto:webcrypto,fetcher:async(file,options)=>{
  assert.deepEqual(options,{cache:'no-store'});assert(assets.has(file));fetches.push(file);const bytes=assets.get(file);
  return{ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
},instantiate:async bytes=>{assert.deepEqual(Buffer.from(bytes),fakeBoundary);return{instance:{exports:abi.exports}};}});
checks.push('real loader source/catalog typed-object/schema validation with mock Rust only');
check('loader fetches exactly14pinned catalogs and one mocked boundary;90preflights',()=>{assert.equal(fetches.length,15);assert.equal(abi.state.requests.length,90);});
const labels=Object.fromEntries(['en','ja'].map(language=>[language,Object.fromEntries(Object.entries(pin.messages).map(([id,message])=>[id,message[language]]))]));
for(const language of ['en','ja']){
  const menu=[pin[language],...['recommended','aptitudes','help','random','back'].map(role=>labels[language]['startup.weapon.'+role+'.label'])];
  check('genuine five-control '+language+' menu recognizes v2',()=>assert.equal(classifyStartingWeaponMenu(menu,{en:pin.en,ja:pin.ja},labels).display_schema,2));
  check('heading alone and mixed-locale menu rejected '+language,()=>{
    assert.equal(classifyStartingWeaponMenu([pin[language]],{en:pin.en,ja:pin.ja},labels),null);
    const mixed=[...menu];mixed[1]=labels[language==='en'?'ja':'en']['startup.weapon.recommended.label'];
    assert.equal(classifyStartingWeaponMenu(mixed,{en:pin.en,ja:pin.ja},labels),null);
  });
}
check('legacy one-ID classifier remains explicit version1',()=>assert.equal(classifyStartingWeaponMenu([pin.ja,'+ - Recommended random choice','* - Random weapon','Bksp - Return to character menu'],{en:pin.en,ja:pin.ja}).display_schema,1));
const frame={columns:12,rows:1,cells:[{glyph:97},{glyph:32},{glyph:45},{glyph:32},{glyph:20154},{glyph:0},{glyph:38291},{glyph:0},...Array.from({length:4},()=>({glyph:32}))]};
check('CJK logical row and actual physical continuations/row hotkey',()=>{
  assert.equal(nativeFrameRows(frame)[0].trim(),'a - 人間');assert.equal(nativeMenuEntityHotkey(nativeFrameRows(frame),'人間').key,'a');
  assert.equal(nativeCjkLabelCells(frame,'人間').length,2);
  assert.throws(()=>nativeCjkLabelCells({...frame,cells:frame.cells.map(cell=>cell.glyph===0?{glyph:32}:cell)},'人間'));
});
check('source-controlled fixture uses real Worker request/key and transferred native frame protocol',()=>{
  const fixture=read('tests/native-dynamic-startup-browser.mjs').toString('utf8');
  assert(fixture.includes("type:'request',id,op"));assert(fixture.includes("type:'key',key"));assert(fixture.includes('new Uint32Array(data.buffer)'));
  assert(fixture.includes("await physical(cdp,'Enter')"));assert(fixture.includes("op:'pack_native'"));assert(fixture.includes("modifiers:2,text:'\\u0011'"));
  assert(!fixture.includes("params:{name:'Human'"));assert(fixture.includes("Goodbye, '+player+'.'"));assert(fixture.includes('Quit the game'));
});
if(receipts.boundary_gate_pending){
  await assert.rejects(()=>loadStartupTextBridge('ja',{fetcher(){throw Error('must not fetch pending boundary');},crypto:{subtle:{}},instantiate(){throw Error('must not instantiate');}}),/awaits reviewed Rust build/);
  checks.push('pending new Rust pin fails before fetch/instantiate');
}
const result={result:'pass',scope:'source and ABI/protocol mocks only; no C++/Rust/engine/browser executed',checks:checks.length,labels:checks,
  files:Object.fromEntries(['engine/newgame.cc','engine/output.cc','engine/library.js','web/startup-text.mjs','tests/native-dynamic-startup-browser.mjs'].map(file=>[file,hash(read(file))]))};
fs.writeFileSync(path.join(root,'source-mock-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:result.result,scope:result.scope,checks:result.checks,files:result.files}));
