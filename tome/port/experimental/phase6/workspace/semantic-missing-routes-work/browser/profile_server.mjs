// SPDX-License-Identifier: GPL-3.0-or-later
// Read-only isolated routes. This factory does not listen or spawn anything.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createTomeServer as createOriginalServer} from '../../bootstrap-work/original_range_server.mjs';

const here=import.meta.dirname,owned=path.resolve(here,'..'),work=path.resolve(owned,'..');
const baseline=path.join(work,'save-resume-work'),physical=path.join(work,'rust-platform-input-work');
const prepared=path.join(work,'mechanics-audit-work/prepared-map/integration-web');
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm'};
export async function createProfileServer(profile='semantic',options={}){
  if(!['semantic','physical','prepared'].includes(profile))throw Error('Explicit reviewed semantic profile required');
  const frozen=JSON.parse(fs.readFileSync(path.join(here,'source-freeze-'+profile+'.json'),'utf8'));
  if(frozen.source_commit!=='624a67329fe2ad440c5b344785a9c73fcf22ae63'||frozen.source_only!==true||!frozen.profiles.includes(profile))throw Error('Reviewed source freeze required');
  for(const row of frozen.files){
    const bytes=fs.readFileSync(path.join(work,row.file));
    if(bytes.length!==row.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==row.sha256)
      throw Error('Reviewed profile source differs from freeze: '+row.file);
  }
  const merge=JSON.parse(fs.readFileSync(path.join(owned,'merged-candidate/merge-result.json'),'utf8'));
  if(merge.base_ids!==24825||merge.delta_ids!==20||merge.merged_base_ids!==24845||merge.requires_exact_route_guard!==true)
    throw Error('Reviewed merged inputs must be prepared first');
  const nativeRoots={semantic:'browser-build',physical:'physical-input-build',prepared:'prepared-map-build'};
  const nativeBuildRoot=options.nativeBuildRoot||process.env.TOME_REVIEWED_NATIVE_BUILD_ROOT||path.join(work,'native-core-work',nativeRoots[profile]);
  const original=await createOriginalServer({...options,nativeBuildRoot,manifest:path.join(here,'generated',profile+'-vfs-inputs.json')});
  const [handler]=original.listeners('request');if(typeof handler!=='function')throw Error('Actual original range handler required');
  const routes=new Map([
    ['/missing/merge-delta.mjs',path.join(owned,'merge-delta.mjs')],
    ['/missing/semantic-route-delta.json',path.join(owned,'candidate/semantic-route-delta.json')],
    ['/missing/reviewed-resolver-profile.mjs',path.join(here,'reviewed-resolver-profile.mjs')],
    ['/missing/native-reviewed-session.mjs',path.join(here,'generated/native-reviewed-session.mjs')],
    ['/missing/semantic-route-browser.mjs',path.join(here,'generated/semantic-route-browser.mjs')],
    ['/missing/integration-source-manifest.json',path.join(here,'integration-'+profile+'-source-manifest.json')],
    ['/missing/source-freeze.json',path.join(here,'source-freeze-'+profile+'.json')],
    ['/missing/merge-result.json',path.join(owned,'merged-candidate/merge-result.json')],
    ['/semantic-route-browser.html',path.join(here,'generated/semantic-route-browser.html')],
    ['/catalog/en.json',path.join(owned,'merged-candidate/english.json')],
    ['/catalog/ja.json',path.join(owned,'merged-candidate/japanese.json')],
    ['/catalog/registry.json',path.join(owned,'merged-candidate/registry.json')],
    ['/catalog/ja-supplement-complete.json',path.join(owned,'merged-candidate/supplements.json')],
    ['/checkpoint/source-manifest.json',path.join(baseline,'source-manifest.json')],
    ...['checkpoint_store.mjs','baseline_flow.mjs','native_archive_validator.mjs'].map(name=>['/checkpoint/'+name,path.join(baseline,name)]),
    ...['en','ja'].map(locale=>['/checkpoint/i18n/'+locale+'.json',path.join(baseline,'i18n',locale+'.json')]),
  ]);
  if(profile==='physical'){
    for(const [route,file]of [
      ['/baseline-save-resume.html',path.join(baseline,'baseline-save-resume.html')],
      ['/physical-play-browser.html',path.join(here,'generated/physical-play-browser.html')],
      ['/physical-play-browser.mjs',path.join(here,'generated/physical-play-browser.mjs')],
      ['/play-browser.html',path.join(here,'generated/physical-play-browser.html')],
      ['/play-browser.mjs',path.join(here,'generated/physical-play-browser.mjs')],
      ['/physical/physical-play-owner.mjs',path.join(physical,'integration-web/physical-play-owner.mjs')],
      ...['physical-input-wasm.mjs','original-physical-input.mjs','focused-input-host.mjs'].map(name=>['/physical/'+name,path.join(physical,'browser',name)]),
      ...['en','ja'].map(locale=>['/physical/i18n/'+locale+'.json',path.join(physical,'i18n',locale+'.json')]),
      ['/physical/tome_physical_input.wasm',options.physicalWasm||path.join(physical,'rust/target/wasm32-unknown-unknown/release/tome_physical_input.wasm')],
    ])routes.set(route,file);
  }
  if(profile==='prepared'){
    const mapWasm=options.rustWasmFile||process.env.TOME_REVIEWED_MAP_WASM;
    if(!mapWasm)throw Error('Set explicit TOME_REVIEWED_MAP_WASM to the actual validated map wrapper WASM');
    for(const [route,file]of [
      ['/prepared-map-observer.html',path.join(here,'generated/prepared-map-observer.html')],
      ['/observer/observer.mjs',path.join(here,'generated/prepared-observer.mjs')],
      ...['en','ja'].map(locale=>['/observer/i18n/'+locale+'.json',path.join(prepared,'i18n',locale+'.json')]),
      ['/rust/tome-map-packet.wasm',mapWasm],
    ])routes.set(route,file);
  }
  const entry=profile==='semantic'?'/semantic-route-browser.html':profile==='physical'?'/physical-play-browser.html':'/prepared-map-observer.html';
  routes.set('/',routes.get(entry));routes.set('/index.html',routes.get(entry));
  const indexed=new Map();
  for(const [route,file]of routes){const stat=fs.statSync(file);if(!stat.isFile())throw Error('Source-only route is not a file: '+file);indexed.set(route,{bytes:stat.size,mtime:stat.mtimeMs});}
  for(const item of merge.results){
    const file=path.join(owned,'merged-candidate',item.file),digest=crypto.createHash('sha256');let bytes=0;
    for await(const chunk of fs.createReadStream(file,{highWaterMark:65536})){digest.update(chunk);bytes+=chunk.length;}
    if(bytes!==item.output_bytes||digest.digest('hex')!==item.output_sha256)throw Error('Merged catalogue changed after reviewed preparation');
  }
  const server=http.createServer((request,response)=>{
    let route;try{route=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{response.writeHead(400).end();return;}
    const file=routes.get(route);if(!file)return handler(request,response);
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
    try{
      const stat=fs.statSync(file),prior=indexed.get(route);
      if(stat.size!==prior.bytes||stat.mtimeMs!==prior.mtime){response.writeHead(409).end('Reviewed profile source changed after indexing');return;}
      response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store'});
      if(request.method==='HEAD'){response.end();return;}
      const stream=fs.createReadStream(file,{highWaterMark:65536});stream.on('error',error=>response.destroy(error));response.on('close',()=>stream.destroy());stream.pipe(response);
    }catch(error){if(!response.headersSent)response.writeHead(404).end(error.message);else response.destroy(error);}
  });
  server.tomeSourceIndex={...original.tomeSourceIndex,profile:'isolated-reviewed-semantic-'+profile,selected_semantic_ids:24846,
    new_reviewed_ids:20,default_delivery_modified:false,media_copied_bytes:0,complete_runtime_claim:false};return server;
}
