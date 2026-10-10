// SPDX-License-Identifier: GPL-3.0-or-later
// Exact source derivatives for a fresh canvas-identity profile only.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {createTomeServer as createOriginal} from '../../bootstrap-work/original_range_server.mjs';
export async function createTomeServer(){
 const work=path.resolve(import.meta.dirname,'../..'),physical=path.join(work,'rust-platform-input-work');
 const original=await createOriginal({manifest:path.join(import.meta.dirname,'../textbox-web/browser-vfs-inputs.json'),nativeBuildRoot:path.join(work,'native-core-work/physical-input-compat-game-flow-build')});
 const [handler]=original.listeners('request');
 const exact=(source,before,after)=>{if(source.split(before).length!==2)throw Error('Reviewed source anchor mismatch: '+before);return source.replace(before,after);};
 let html=fs.readFileSync(path.join(physical,'integration-web/physical-play-browser.html'),'utf8');
 html=html.replaceAll('#original','#canvas');html=exact(html,'id="original"','id="canvas"');
 let script=fs.readFileSync(path.join(physical,'integration-web/physical-play-browser.mjs'),'utf8');
 script=exact(script,"import nativeFactory from '/native/tome-native.mjs';", "import nativeFactory from '/native/tome-native.mjs';\nimport {prepareFreshNativeCanvas,readNativeDisplayContract} from '/physical/native-canvas-contract.mjs';\nimport {NativeTextboxFixture,installNativeTextboxFixture,settlePendingOriginalFocus} from '/textbox/native-textbox-fixture.mjs';\nimport {installNativeGameFlowObserver,NativeGameFlowProbe} from '/game-flow/native-game-flow-probe.mjs';\nlet flowInstallation,flowProbe;");
 script=exact(script,"canvas=document.querySelector('#original');","canvas=document.querySelector('#canvas');\nconst canvasLease=prepareFreshNativeCanvas(canvas,{freshDocument:true});");
 script=exact(script,'      module.ccall=(name,...args)=>{','      module.ccall=(name,...args)=>{\n        if(name===\'tome_native_init\')canvasLease.beforeNativeInit(module);');
 script=exact(script,'    beforeStart:({module})=>{',`    beforeStart:async ({module})=>{\n      await installNativeTextboxFixture(module,'/textbox/native-textbox-fixture.lua');`);
 const prepare='      report.physical_prepare=physicalOwner.prepare();';
 script=exact(script,prepare,prepare+"\n      const flowProvenance=await fetchJson('/game-flow/observer-provenance.json');\n      flowInstallation=await installNativeGameFlowObserver(module,'/game-flow/visible-flow-observer.lua',flowProvenance.derivative_sha256);\n      report.planar_compat_install=module.ccall('tome_planar_client_array_refresh_install','number',[],[]);\n      if(report.planar_compat_install!==1)throw Error('render.error.client_array_contract');");
 script=exact(script,'    raw,rng,calls:()=>({...nativeCalls}),gateExclusion:()=>physicalOwner.gateExclusion(save)};',
  "    displayContract:()=>readNativeDisplayContract(native),planarCompat:()=>JSON.parse(native.ccall('tome_planar_client_array_refresh_status','string',[],[])),\n    raw,rng,calls:()=>({...nativeCalls}),gateExclusion:()=>physicalOwner.gateExclusion(save)};");
 let host=fs.readFileSync(path.join(physical,'audit-new/pointer-dispatch-candidate/serialized-pointer-host.mjs'),'utf8');
 host=exact(host,"from '../../browser/focused-input-host.mjs'", "from '/physical/focused-input-host-base.mjs'");
 host=exact(host,"from '../../browser/physical-input-wasm.mjs'", "from '/physical/physical-input-wasm.mjs'");
 host=exact(host,"from '../resize-candidate/native-canvas-contract.mjs'", "from '/physical/native-canvas-contract.mjs'");
 let owner=fs.readFileSync(path.join(physical,'integration-web/physical-play-owner.mjs'),'utf8');
 owner=exact(owner,"import {FocusedInputHost} from '/physical/focused-input-host.mjs';","import {SerializedPointerHost as FocusedInputHost} from '/physical/focused-input-host.mjs';");
 owner=exact(owner,'keys.length!==31','keys.length!==54');
 owner=exact(owner,'    this.claimed=this.host.start();','    this.host.completedOriginalFrame();\n    this.claimed=this.host.start();');
 script=exact(script,'  await physicalOwner.start();report.physical_claim=copy(physicalOwner.claimed);','  observeGate();originalVisualFrame();\n  await physicalOwner.start();report.physical_claim=copy(physicalOwner.claimed);');
 script=exact(script,`  observeGate();originalVisualFrame();\n  checkedPresentation(await session.dispatch({op:'snapshot'}).completion);`,`  observeGate();\n  checkedPresentation(await session.dispatch({op:'snapshot'}).completion);`);
 script=exact(script,'  await physicalOwner.start();report.physical_claim=copy(physicalOwner.claimed);',`  await physicalOwner.start();report.physical_claim=copy(physicalOwner.claimed);
  report.initial_focus_settlement=await settlePendingOriginalFocus(physicalOwner.original);
  originalVisualFrame();physicalOwner.host.completedOriginalFrame();\n  flowProbe=new NativeGameFlowProbe({module:native,original:physicalOwner.original,ownerDiagnostic:()=>physicalOwner.diagnostic(),canObserve:()=>mayRead(),installation:flowInstallation});\n  report.game_flow_installation=flowProbe.attachAfterBirth();\n  window.tomeGameFlowProbe=flowProbe.readOnlyFacade();`);
 script=exact(script,'  canvas.focus();',`  const textboxLabels=await fetchJson('/textbox/i18n/ja.json');
  const textbox=new NativeTextboxFixture({module:native,inputHost:physicalOwner.host,original:physicalOwner.original,
    onOriginalFrame:async status=>{await physicalOwner.onSettled(status);physicalOwner.host.completedOriginalFrame();}});
  window.tomeTextboxProbe={open:initial=>{canvas.focus({preventScroll:true});return textbox.open(initial,{title:textboxLabels['textbox.fixture.title'],field:textboxLabels['textbox.fixture.field'],cancel:textboxLabels['textbox.fixture.cancel']});},
    close:()=>textbox.close(),status:()=>textbox.status(),focusStatus:()=>textbox.focus(),display:()=>readNativeDisplayContract(native),
    installation:()=>({installed_pre_start:true}),inputHost:()=>physicalOwner.diagnostic(),physical:()=>physicalOwner.status()};
  canvas.focus();`);
 const keyOracle="window.__tomeRoadEvents=[];for(const kind of ['keydown','keyup'])window.addEventListener(kind,event=>{if(window.__tomeRoadEvents.length<64)window.__tomeRoadEvents.push({type:event.type,key:event.key,code:event.code,trusted:event.isTrusted,composing:event.isComposing,target_id:event.target?.id||null});},{capture:true,passive:true});";
 script=exact(script,'  await physicalOwner.start();report.physical_claim=copy(physicalOwner.claimed);',keyOracle+"\n  await physicalOwner.start();report.physical_claim=copy(physicalOwner.claimed);");
 const files=new Map([['/physical-play-browser.html',Buffer.from(html)],['/play-browser.html',Buffer.from(html)],
  ['/physical-play-browser.mjs',Buffer.from(script)],['/play-browser.mjs',Buffer.from(script)],
  ['/physical/focused-input-host.mjs',Buffer.from(host)],['/physical/physical-play-owner.mjs',Buffer.from(owner)],
  ['/physical/native-canvas-contract.mjs',fs.readFileSync(path.join(physical,'audit-new/resize-candidate/native-canvas-contract.mjs'))]]);
 for(const locale of ['en','ja']){
  const base=JSON.parse(fs.readFileSync(path.join(physical,'i18n',locale+'.json')));
  const delta={...JSON.parse(fs.readFileSync(path.join(physical,'audit-new/resize-candidate',locale+'.json'))),...JSON.parse(fs.readFileSync(path.join(physical,'audit-new/pointer-dispatch-candidate',locale+'.json'))),...JSON.parse(fs.readFileSync(path.join(physical,'audit-new/textbox-native-candidate',locale+'.json')))};
  if(Object.keys(delta).some(key=>Object.hasOwn(base,key))||Object.keys(delta).length!==23)throw Error('Resize label collision');
  files.set('/physical/i18n/'+locale+'.json',Buffer.from(JSON.stringify({...base,...delta})));
 }
 const flowRoot=path.join(physical,'audit-new/game-flow-native-candidate');
 const sourceFiles=new Map([
 ...['native-game-flow-probe.mjs','visible-flow-observer.lua','observer-provenance.json'].map(name=>['/game-flow/'+name,path.join(flowRoot,name)]),
 ...['en','ja'].map(locale=>['/game-flow/i18n/'+locale+'.json',path.join(flowRoot,locale+'.json')]),
 ...['physical-input-wasm.mjs','original-physical-input.mjs'].map(name=>['/physical/'+name,path.join(physical,'browser',name)]),
 ['/physical/focused-input-host-base.mjs',path.join(physical,'browser/focused-input-host.mjs')],
 ['/physical/tome_physical_input.wasm',path.join(physical,'rust/target/wasm32-unknown-unknown/release/tome_physical_input.wasm')],
 ...['native-textbox-fixture.mjs','native-textbox-fixture.lua'].map(name=>['/textbox/'+name,path.join(physical,'audit-new/textbox-native-candidate',name)]),
 ...['en','ja'].map(locale=>['/textbox/i18n/'+locale+'.json',path.join(physical,'audit-new/textbox-native-candidate',locale+'.json')]),
 ['/checkpoint/source-manifest.json',path.join(work,'save-resume-work/source-manifest.json')],
 ...['checkpoint_store.mjs','baseline_flow.mjs','native_archive_validator.mjs'].map(name=>['/checkpoint/'+name,path.join(work,'save-resume-work',name)]),
 ...['en','ja'].map(locale=>['/checkpoint/i18n/'+locale+'.json',path.join(work,'save-resume-work/i18n',locale+'.json')]),
 ]);
 for(const [route,file] of sourceFiles)files.set(route,fs.readFileSync(file));
 files.set('/textbox/native-textbox-fixture.lua',fs.readFileSync(path.join(import.meta.dirname,'../textbox-web/native-textbox-fixture-trace.lua')));
 const server=http.createServer((req,res)=>{const route=new URL(req.url,'http://127.0.0.1').pathname,body=files.get(route);
  if(!body)return handler(req,res);if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  res.writeHead(200,{'Content-Type':route.endsWith('.html')?'text/html; charset=utf-8':route.endsWith('.json')?'application/json; charset=utf-8':'text/javascript; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:body);});
 server.tomeSourceIndex={...original.tomeSourceIndex,candidate:'isolated-original-native-game-flow-observer'};return server;
}
