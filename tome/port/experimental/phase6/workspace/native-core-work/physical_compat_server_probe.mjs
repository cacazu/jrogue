// SPDX-License-Identifier: GPL-3.0-or-later
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTomeServer as createPhysical} from '../rust-platform-input-work/integration-web/physical_server.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export async function createTomeServer(){
  const original=await createPhysical({nativeBuildRoot:path.join(here,'physical-input-compat-build')});
  const [handler]=original.listeners('request');
  const base=path.resolve(here,'../rust-platform-input-work/integration-web');
  const html=fs.readFileSync(path.join(base,'physical-play-browser.html'));
  const raw=fs.readFileSync(path.join(base,'physical-play-browser.mjs'),'utf8');
  const anchor='      report.physical_prepare=physicalOwner.prepare();';
  if(raw.split(anchor).length!==2)throw Error('Exact candidate startup anchor missing');
  const addition=anchor+"\n      report.planar_compat_install=module.ccall('tome_planar_client_array_refresh_install','number',[],[]);\n      if(report.planar_compat_install!==1)throw Error('render.error.client_array_contract');";
  const probe='    raw,rng,calls:()=>({...nativeCalls}),gateExclusion:()=>physicalOwner.gateExclusion(save)};';
  if(raw.split(probe).length!==2)throw Error('Exact candidate probe anchor missing');
  const script=Buffer.from(raw.replace(anchor,addition).replace(probe,"    planarCompat:()=>JSON.parse(module.ccall('tome_planar_client_array_refresh_status','string',[],[])),\n"+probe));
  const bodies=new Map([['/physical-play-browser.html',html],['/play-browser.html',html],['/physical-play-browser.mjs',script],['/play-browser.mjs',script]]);
  const server=http.createServer((req,res)=>{const route=new URL(req.url,'http://127.0.0.1').pathname,body=bodies.get(route);
    if(!body)return handler(req,res);if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    res.writeHead(200,{'Content-Type':route.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:body);});
  server.tomeSourceIndex={...original.tomeSourceIndex,candidate:'isolated-original-physical-input-planar-compat'};return server;
}
