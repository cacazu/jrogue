// SPDX-License-Identifier: GPL-3.0-or-later
// Root-only portable phase7 candidate. Importing launches no server/browser.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createTomeServer as createOriginalServer} from '../../../kernel/bootstrap/original_range_server.mjs';

const here=import.meta.dirname,phase7=path.resolve(here,'..'),port=path.resolve(phase7,'../..'),phase6=path.join(port,'experimental/phase6');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.lua':'text/javascript; charset=utf-8'};
function confined(root,relative){
  if(typeof relative!=='string'||relative.includes('\\')||relative.split('/').some(p=>!p||p==='.'||p==='..'||p.includes(':'))||path.isAbsolute(relative))throw Error('phase7.error.unconfined_relative');
  const file=path.resolve(root,relative),difference=path.relative(root,file);
  if(difference.startsWith('..')||path.isAbsolute(difference))throw Error('phase7.error.output_escaped');
  if(fs.existsSync(file)){
    const realRoot=fs.realpathSync(root),realFile=fs.realpathSync(file),realDifference=path.relative(realRoot,realFile);
    if(realDifference.startsWith('..')||path.isAbsolute(realDifference))throw Error('phase7.error.dependency_junction_escaped');
  }
  return file;
}
function smallJson(file){
  if(fs.statSync(file).size>16*1024*1024)throw Error('phase7.error.metadata_oversized');
  return JSON.parse(fs.readFileSync(file,'utf8'));
}
async function identity(file){
  const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('phase7.error.unreviewed_file');
  const hash=crypto.createHash('sha256');let bytes=0;
  for await(const part of fs.createReadStream(file,{highWaterMark:131072})){hash.update(part);bytes+=part.length;}
  return{bytes,sha256:hash.digest('hex')};
}
function same(a,b){return a.bytes===b.bytes&&a.sha256===b.sha256;}
async function verifiedSnapshot(expectedFreezeSha){
  if(fs.realpathSync(phase7)!==path.join(fs.realpathSync(port),'experimental','phase7'))throw Error('phase7.error.literal_target_required');
  const manifest=smallJson(path.join(phase7,'PHASE7-MANIFEST.json'));
  const freezeFile=path.join(phase7,'APPROVED-FREEZE.json'),freezeIdentity=await identity(freezeFile),freeze=smallJson(freezeFile);
  if(freezeIdentity.sha256!==manifest.approved_freeze_sha256||(expectedFreezeSha&&freezeIdentity.sha256!==expectedFreezeSha))throw Error('phase7.error.approved_freeze_changed');
  if(manifest.source_commit!=='624a67329fe2ad440c5b344785a9c73fcf22ae63'||manifest.complete!==false||manifest.default_activation!==false||manifest.full_renderer_ready!==false||manifest.portable_CLI_verified!==false)throw Error('phase7.error.experimental_scope_required');
  const expected=new Map(freeze.files.map(row=>[row.target,{bytes:row.bytes,sha256:row.sha256}]));
  for(const[key,value]of Object.entries(freeze.generated)){
    if(expected.has(key))throw Error('phase7.error.duplicate_frozen_target');expected.set(key,value);
  }
  if(expected.size!==manifest.files.length)throw Error('phase7.error.staged_count_changed');
  const selected=new Map();
  for(const row of manifest.files){
    if(selected.has(row.target)||!expected.has(row.target)||!same(row,expected.get(row.target)))throw Error('phase7.error.staged_identity_not_approved');
    if(!same(await identity(confined(phase7,row.target)),row))throw Error('phase7.error.staged_bytes_changed:'+row.target);
    selected.set(row.target,{bytes:row.bytes,sha256:row.sha256});
  }
  const guard=freeze.preserved_guard;
  if(guard.default.count!==496||guard.phase6.count!==216||guard.phase6.runtime_count!==40)throw Error('phase7.error.preserved_scope_changed');
  for(const[key,value]of Object.entries(guard.default.files))if(!same(await identity(confined(port,key)),value))throw Error('phase7.error.default_dependency_changed:'+key);
  const tome=path.resolve(port,'..');
  for(const[key,value]of Object.entries(guard.default.metadata))if(!same(await identity(confined(tome,key)),value))throw Error('phase7.error.default_metadata_changed:'+key);
  for(const bucket of ['files','runtime_files','metadata'])for(const[key,value]of Object.entries(guard.phase6[bucket]))if(!same(await identity(confined(phase6,key)),value))throw Error('phase7.error.phase6_changed:'+key);
  const config=smallJson(path.join(here,'profile-config.json'));
  if(config.source_commit!==manifest.source_commit||config.complete!==false||config.default_activation!==false||config.baseline_catalog_ids!==24826||Object.keys(config.profiles).join(',')!=='gameflow,stairs')throw Error('phase7.error.profile_scope_changed');
  return{manifest,freeze,config,selected,approvedFreezeSha:freezeIdentity.sha256};
}
export async function createPhase7Server(profile,options={}){
  if(!['gameflow','stairs'].includes(profile))throw Error('phase7.error.explicit_profile_required');
  if(Object.keys(options).some(key=>key!=='expectedFreezeSha'))throw Error('phase7.error.unreviewed_root_override');
  const proof=await verifiedSnapshot(options.expectedFreezeSha),config=proof.config.profiles[profile];
  if(config.navigation_profile===true&&config.reviewed_gameflow_observer_cache_contract_verified!==true)throw Error('phase7.error.observer_cache_review_pending');
  if(config.portable_runtime_revalidated!==false)throw Error('phase7.error.new_proof_requires_separate_runtime_record');
  const original=await createOriginalServer({
    manifest:confined(phase7,config.manifest),nativeBuildRoot:confined(phase7,config.native_root),
    staticRoot:path.join(port,'kernel/bootstrap'),rustBrowserRoot:path.join(port,'retained/browser'),
    retainedBuildRoot:path.join(phase6,'dist/retained'),semanticBuildRoot:path.join(phase6,'dist/semantic-text'),
    semanticRoot:path.join(port,'localization/wasm'),catalogRoot:path.join(port,'localization/catalogs'),reviewRoot:path.join(port,'localization/review'),
  });
  const [handler]=original.listeners('request');if(typeof handler!=='function')throw Error('phase7.error.original_handler_required');
  const routes=new Map();
  for(const[route,location]of Object.entries(config.routes)){
    const root=location.namespace==='phase7'?phase7:location.namespace==='phase6'?phase6:location.namespace==='port'?port:null;
    if(!root)throw Error('phase7.error.route_namespace');
    const expected=location.namespace==='phase7'?proof.selected.get(location.file):location.namespace==='phase6'?proof.freeze.preserved_guard.phase6.files[location.file]:proof.freeze.preserved_guard.default.files[location.file];
    if(!expected)throw Error('phase7.error.route_not_in_approved_selection:'+route);
    const file=confined(root,location.file),stat=fs.statSync(file);
    routes.set(route,{file,size:stat.size,mtime:stat.mtimeMs});
  }
  const server=http.createServer((request,response)=>{
    let route;try{route=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{response.writeHead(400).end();return;}
    const record=routes.get(route);if(!record)return handler(request,response);
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
    try{
      const stat=fs.lstatSync(record.file);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==record.size||stat.mtimeMs!==record.mtime){response.writeHead(409).end('phase7.error.indexed_source_changed');return;}
      const headers={'Content-Type':types[path.extname(record.file)]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
      let start=0,end=stat.size-1,status=200;
      if(request.headers.range){
        const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if(!match||(!match[1]&&!match[2])){response.writeHead(416,{'Content-Range':'bytes */'+stat.size}).end();return;}
        if(!match[1])start=Math.max(0,stat.size-Number(match[2]));
        else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=stat.size){response.writeHead(416,{'Content-Range':'bytes */'+stat.size}).end();return;}
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length']=Math.max(0,end-start+1);response.writeHead(status,headers);
      if(request.method==='HEAD'||stat.size===0){response.end();return;}
      const stream=fs.createReadStream(record.file,{start,end,highWaterMark:131072});
      stream.on('error',error=>response.destroy(error));response.on('close',()=>stream.destroy());stream.pipe(response);
    }catch(error){if(!response.headersSent)response.writeHead(404).end(error.message);else response.destroy(error);}
  });
  server.tomeSourceIndex={...original.tomeSourceIndex,profile:'isolated-phase7-'+profile,approvedFreezeSha256:proof.approvedFreezeSha,
    historicalProofOnly:true,portableRuntimeRevalidated:false,defaultDeliveryModified:false,phase6DeliveryModified:false,
    complete:false,fullRendererReady:false,mediaCopiedBytes:0,baselineCatalogIds:24826};
  return server;
}
