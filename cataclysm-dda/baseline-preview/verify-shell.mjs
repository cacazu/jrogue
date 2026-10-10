import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const shell = path.join(root,'shell');
const source = fs.readFileSync(path.join(shell,'baseline-shell.js'),'utf8');
const html = fs.readFileSync(path.join(shell,'index.html'),'utf8');
const css = fs.readFileSync(path.join(shell,'baseline.css'),'utf8');
const locales = Object.fromEntries(['en','ja'].map(name => [name,JSON.parse(fs.readFileSync(path.join(shell,'locales',name+'.json'),'utf8'))]));
const bridgeRoot=path.join(shell,'rust-browser-bridge');
const originalNodeFetch=globalThis.fetch;
let bridgeFetchFailure=false;
globalThis.fetch=async(url)=>{
  if(bridgeFetchFailure)return{ok:false};
  if(url==='rust-browser-bridge/cdda_rust_browser_bridge.wasm')return{ok:true,arrayBuffer:async()=>{
    const data=fs.readFileSync(path.join(bridgeRoot,'cdda_rust_browser_bridge.wasm'));
    return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);}};
  if(url==='rust-browser-bridge/text-manifest.json')return{ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(bridgeRoot,'text-manifest.json'),'utf8'))};
  throw new Error('Unexpected Node bridge fetch: '+url);
};
const placeholders = text => [...text.matchAll(/\{([a-z_]+)\}/g)].map(match=>match[1]).sort();
const enIds = Object.keys(locales.en.messages).sort();
assert.deepEqual(Object.keys(locales.ja.messages).sort(),enIds);
for (const id of enIds) {
  assert.ok(locales.en.messages[id]); assert.ok(locales.ja.messages[id]);
  assert.deepEqual(placeholders(locales.ja.messages[id]),placeholders(locales.en.messages[id]),id);
}
const references = new Set([...html.matchAll(/data-(?:text|aria)="([^"]+)"/g)].map(match=>match[1]));
for (const match of source.matchAll(/'((?:baseline|browser|game|input|runtime|save)\.[a-z_]+)'/g)) references.add(match[1]);
for (const id of references) assert.ok(enIds.includes(id),'Undefined text ID '+id);
assert.ok(!/FS\.(mount|mkdir)\(/.test(source),'Shell must not mount original IDBFS');
assert.ok(!/https?:\/\//.test(source),'Shell must not import remote code');
assert.ok(!/<script[^>]+https?:/i.test(html),'HTML must not import remote code');
assert.ok(!/\b(?:width|height)\s*:/.test(css.match(/(?:^|\n)canvas\s*\{([^}]+)\}/)[1]),'Startup canvas must retain intrinsic size for the SDL window probe');
assert.match(css,/#stage\s*\{[^}]*overflow:\s*auto/,'Readable canvas must remain scrollable');

const SAVE_ROOT = '/home/web_user/.cataclysm-dda';
const optionsPath = SAVE_ROOT+'/config/options.json';
const moPath = '/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo';
const moBytes = fs.readFileSync(path.join(root,'../ja-current/generated/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo'));
let assertions = 0;
async function harness({existingOptions=null,restoreError=null,failRustStartup=false,corruptCatalog=false}={}) {
  bridgeFetchFailure=failRustStartup;
  const elements = new Map();
  const listeners = new Map();
  const files = new Map();
  const syncCalls = [];
  const fileNodes = new Map();
  const unlinkedFiles = [];
  const resizeObservers = [];
  const mutationObservers = [];
  const catalog = new Uint8Array(moBytes);
  if (corruptCatalog) catalog[0] ^= 1;
  files.set(moPath,catalog);
  fileNodes.set(moPath,{stream_ops:{read(){}}});
  const helperButtons=['ArrowUp','.','Tab'].map(key=>{const button=element();button.dataset.key=key;return button;});
  const panButtons=['left','up','down','right'].map(direction=>{const button=element();button.dataset.pan=direction;return button;});
  let bootResolve;
  const booted=new Promise(resolve=>{bootResolve=resolve;});
  if(existingOptions!==null) files.set(optionsPath,new TextEncoder().encode(existingOptions));
  const dirMode = 0o040000, fileMode = 0o100000;
  const FS = {
    syncfs(populate,callback) { syncCalls.push(populate); queueMicrotask(()=>callback(populate?restoreError:null)); },
    analyzePath(file) { return {exists:files.has(file),object:fileNodes.get(file)}; },
    mkdirTree() {},
    writeFile(file,data) { files.set(file,typeof data==='string'?new TextEncoder().encode(data):new Uint8Array(data));fileNodes.set(file,{stream_ops:{mmap(){}}}); },
    unlink(file) {unlinkedFiles.push(file);files.delete(file);fileNodes.delete(file);},
    readFile(file) { if(!files.has(file))throw Error('Missing '+file);return files.get(file); },
    stat(file) { return {mode:files.has(file)?fileMode:dirMode}; },
    isDir(mode) {return mode===dirMode;}, isFile(mode) {return mode===fileMode;},
    readdir(directory) { const prefix=directory+'/';return ['.','..',...new Set([...files.keys()].filter(file=>file.startsWith(prefix)).map(file=>file.slice(prefix.length).split('/')[0]))]; }
  };
  function element(id='') {
    const result={id,dataset:{},textContent:'',hidden:false,disabled:true,value:'',children:[],style:{},scrollLeft:0,scrollTop:0,
      addEventListener(type,callback) {this[type]=callback;},setAttribute(){},focus(){},dispatchEvent(event){this.children.push(event);},click(){},
      appendChild(child){this.children.push(child);if(child.onload)queueMicrotask(child.onload);}};
    if(id==='diagnostic-output') {
      let value='';Object.defineProperty(result,'textContent',{get(){return value;},set(next){
        value=next;if(String(next).includes('"phase": "failed"'))bootResolve();}});
    }
    if(id==='canvas'){result.width=1280;result.height=640;}
    if(id==='stage'){result.clientWidth=1280;result.clientHeight=720;}
    return result;
  }
  const document={documentElement:{lang:''},head:element(),querySelectorAll(selector){return selector==='[data-key]'?helperButtons:selector==='[data-pan]'?panButtons:[];},
    getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id);},createElement(){return element();}};
  document.head.appendChild=child=>{document.head.children.push(child);queueMicrotask(()=>{child.onload();if(child.src==='cataclysm-tiles.js')bootResolve();});};
  const window={crypto:globalThis.crypto,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}};
  let exportedBlob;
  const context = vm.createContext({window,document,console,Date,Blob,btoa,setTimeout:(callback)=>{callback();return 0;},
    URL:{createObjectURL(blob){exportedBlob=blob;return'blob:local-test';},revokeObjectURL(){}},
    fetch:async(url)=>({ok:true,json:async()=>locales[url.includes('/ja.')?'ja':'en']}),
    KeyboardEvent:class{constructor(type,properties){this.type=type;Object.assign(this,properties);}},
    ResizeObserver:class{constructor(callback){resizeObservers.push(callback);}observe(){}},
    MutationObserver:class{constructor(callback){mutationObservers.push(callback);}observe(){}}});
  vm.runInContext(source,context,{filename:path.join(shell,'baseline-shell.js'),
    importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER});
  let bootTimeout;
  await Promise.race([booted,new Promise((_,reject)=>{bootTimeout=setTimeout(()=>reject(new Error('Shell did not finish bounded Rust startup')),5000);})]).finally(()=>clearTimeout(bootTimeout));
  if(failRustStartup) {
    assert.equal(window.cddaBaselineDiagnostics.phase,'failed');assertions++;
    assert.match(document.getElementById('loading').textContent,/Rust bridge asset fetch failed/);assertions++;
    assert.equal(document.head.children.length,0);assertions++;
    assert.equal(window.Module,undefined);assertions++;
    assert.equal(window.cddaBaselineDiagnostics.events.at(-1).type,'failure');assertions++;
    bridgeFetchFailure=false;
    return{window,document};
  }
  assert.equal(window.cddaBaselineDiagnostics.rustBridge.scope,'bounded-shell-and-helper-input');assertions++;
  assert.equal(window.Module.canvas,document.getElementById('canvas'));assertions++;
  window.Module.FS=FS;
  window.Module.preRun[0]();
  const restored = await new Promise(resolve=>FS.syncfs(true,error=>resolve(error)));
  return {window,document,files,FS,syncCalls,restored,helperButtons,panButtons,listeners,resizeObservers,mutationObservers,unlinkedFiles,exportedBlob:()=>exportedBlob};
}

const fresh = await harness();
for(const language of ['en','ja'])for(const id of enIds) {
  const values={completed:1,total:2,count:3,bytes:70000,reason:'利用者Ａ😀 <script>'};
  const parameters=Object.fromEntries(placeholders(locales[language].messages[id]).map(name=>[name,values[name]]));
  const expected=locales[language].messages[id].replace(/\{([a-z_]+)\}/g,(_,name)=>String(values[name]));
  assert.equal(fresh.window.cddaRustBridge.formatText(language,id,parameters),expected,id);assertions++;
}
assert.equal(fresh.restored,null); assertions++;
assert.equal(JSON.parse(new TextDecoder().decode(fresh.files.get(optionsPath)))[0].value,'ja'); assertions++;
assert.deepEqual(fresh.syncCalls,[true,false]); assertions++;
assert.equal(fresh.window.cddaBaselineDiagnostics.profileSeeded,true); assertions++;
assert.equal(fresh.window.cddaBaselineDiagnostics.japaneseCatalog.mmapSupported,true);assertions++;
assert.equal(fresh.window.cddaBaselineDiagnostics.japaneseCatalog.materializedFromCompressedFile,true);assertions++;
assert.deepEqual(fresh.unlinkedFiles,[moPath]);assertions++;
assert.deepEqual(Buffer.from(fresh.files.get(moPath)),moBytes);assertions++;
const existing = '[{"name":"USE_LANG","value":"en"},{"name":"FONT_SIZE","value":"18"}]';
const retained = await harness({existingOptions:existing});
assert.equal(new TextDecoder().decode(retained.files.get(optionsPath)),existing); assertions++;
assert.deepEqual(retained.syncCalls,[true]); assertions++;
assert.equal(retained.window.cddaBaselineDiagnostics.profileSeeded,false); assertions++;
const restoreFailure = new Error('IDBFS permission denied');
const failed = await harness({restoreError:restoreFailure});
assert.equal(failed.restored,restoreFailure); assertions++;
assert.equal(failed.files.has(optionsPath),false); assertions++;
assert.deepEqual(failed.syncCalls,[true]); assertions++;
const corrupt = await harness({corruptCatalog:true});
assert.match(String(corrupt.restored),/catalog hash differs/);assertions++;
assert.equal(corrupt.files.has(optionsPath),false);assertions++;
assert.deepEqual(corrupt.unlinkedFiles,[]);assertions++;
assert.equal(corrupt.window.cddaBaselineDiagnostics.phase,'failed');assertions++;

const canvas = fresh.document.getElementById('canvas');
const stage = fresh.document.getElementById('stage');
fresh.window.Module.onRuntimeInitialized();
for(const callback of [...fresh.resizeObservers,...fresh.mutationObservers,...fresh.listeners.get('resize')])callback();
assert.equal(canvas.style.width,undefined);assertions++;
assert.equal(canvas.style.height,undefined);assertions++;
// Model SDL's startup probe: CSS must also remain natural at 1×1.
canvas.width=1;canvas.height=1;
for(const callback of fresh.mutationObservers)callback();
assert.equal(canvas.style.width,undefined);assertions++;
canvas.width=1280;canvas.height=640;
for(const callback of fresh.listeners.get('menuready'))callback();
assert.equal(canvas.style.width,'1280px');assertions++;
assert.equal(canvas.style.height,'640px');assertions++;
stage.clientWidth=390;stage.clientHeight=430;
for(const callback of fresh.listeners.get('resize'))callback();
assert.equal(canvas.width,1280);assertions++;
assert.equal(canvas.height,640);assertions++;
assert.equal(canvas.style.width,'960px');assertions++;
assert.equal(canvas.style.height,'480px');assertions++;
assert.equal(fresh.window.cddaBaselineDiagnostics.canvas.scale,0.75);assertions++;
const inputEventsBeforeViewControls=canvas.children.length;
fresh.document.getElementById('view-scale').input({target:{value:'100'}});
assert.equal(canvas.style.width,'1280px');assertions++;
assert.equal(fresh.document.getElementById('view-scale-value').textContent,'100%');assertions++;
fresh.panButtons[3].click();
assert.equal(stage.scrollLeft,292.5);assertions++;
fresh.panButtons[2].click();
assert.equal(stage.scrollTop,322.5);assertions++;
assert.equal(canvas.children.length,inputEventsBeforeViewControls);assertions++;
fresh.document.getElementById('view-fit').click();
assert.equal(canvas.style.width,'390px');assertions++;
assert.equal(canvas.style.height,'195px');assertions++;
assert.equal(canvas.width,1280);assertions++;
assert.equal(canvas.height,640);assertions++;
fresh.document.getElementById('view-scale').input({target:{value:'150'}});
assert.equal(canvas.style.width,'1920px');assertions++;
fresh.document.getElementById('view-scale').input({target:{value:'invalid'}});
assert.equal(canvas.style.width,'1920px');assertions++;
canvas.width=1440;
for(const callback of fresh.mutationObservers)callback();
assert.equal(canvas.style.width,'2160px');assertions++;
assert.equal(canvas.width,1440);assertions++;
assert.equal(canvas.children.length,inputEventsBeforeViewControls);assertions++;

const binary = Uint8Array.from({length:70000},(_,i)=>i%256);
fresh.files.set(SAVE_ROOT+'/save/世界/プレイヤー.sav',binary);
const result = await fresh.window.cddaBaselineExportSaveFiles();
assert.equal(result.files,2); assertions++;
const exported = JSON.parse(await fresh.exportedBlob().text());
assert.equal(exported.version,1); assertions++;
assert.equal(exported.upstream.commit,'7b2efa5cea38e4d4d97dd0e63b28b9148623da59'); assertions++;
const binaryEntry=exported.files.find(file=>file.path==='save/世界/プレイヤー.sav');
assert.equal(binaryEntry.bytes,binary.length); assertions++;
assert.deepEqual(Buffer.from(binaryEntry.data,'base64'),Buffer.from(binary)); assertions++;
assert.equal(fresh.syncCalls.at(-1),false); assertions++;
fresh.window.cddaBaselineDiagnostics.menuReady=true;
fresh.window.cddaBaselineSendKey('.');
const periodEvents=fresh.document.getElementById('canvas').children;
assert.equal(periodEvents[0].keyCode,190);assert.equal(periodEvents[0].code,'Period'); assertions+=2;
assert.equal(periodEvents[1].charCode,46); assertions++;
fresh.window.cddaBaselineSendKey('?');
assert.equal(periodEvents[3].keyCode,191);assert.equal(periodEvents[3].shiftKey,true); assertions+=2;
fresh.helperButtons[0].click();
assert.equal(fresh.window.cddaBaselineDiagnostics.events.at(-1).resolvedBy,'rust-wasm');assertions++;
assert.equal(periodEvents.at(-2).key,'ArrowUp');assertions++;
fresh.helperButtons[1].click();
assert.equal(fresh.window.cddaBaselineDiagnostics.events.at(-1).resolvedBy,'original-cpp-native-key');assertions++;
assert.equal(periodEvents.at(-3).key,'.');assertions++;
await harness({failRustStartup:true});
const report={passed:true,checks:{localeIds:enIds.length,referencedIds:references.size,
  localePlaceholderParity:true,noRemoteCodeImports:true,noSecondIdbfsMount:true,
  newProfileJapaneseAfterRestore:true,existingProfilePreserved:true,
  restoreFailureDoesNotSeed:true,unicodePathAndBinaryExportPreserved:true,punctuationInputCodes:true,
  actualRustWasmShellFormatting:true,rustHelperButtonsPreserveNativeFallback:true,
  rustStartupFailureIsFatalAndDiagnosable:true,
  pinnedJapaneseCatalogMaterializedForNativeMmap:true,corruptCatalogRejectedBeforeOptionsOrNativeResume:true,
  canvasUnstyledThroughNativeWindowCreation:true,viewportControlsNeverWriteNativeFramebuffer:true,
  narrowViewportReadableScaleAndPan:true,explicitOverviewAvailable:true,viewportControlsDoNotSendGameInput:true,
  rustShellMessageChecks:54,rustScope:'bounded-shell-and-helper-input',platformAssertions:assertions},
  realEngineBrowserValidation:'pending; this verifier tests the browser shell boundary only'};
fs.writeFileSync(path.join(root,'shell-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
globalThis.fetch=originalNodeFetch;
