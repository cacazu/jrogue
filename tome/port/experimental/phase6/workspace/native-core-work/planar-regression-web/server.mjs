// SPDX-License-Identifier: GPL-3.0-or-later
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {createTomeServer as createOriginal} from '../../bootstrap-work/original_range_server.mjs';
export async function createTomeServer(){
 const root=import.meta.dirname;
 const original=await createOriginal({nativeBuildRoot:path.resolve(root,'../physical-input-compat-regression-build')});
 const [handler]=original.listeners('request');
 const files=new Map(['/planar-regression.html','/planar-regression.mjs'].map(route=>[route,fs.readFileSync(path.join(root,route.slice(1)))]));
 const server=http.createServer((req,res)=>{const route=new URL(req.url,'http://127.0.0.1').pathname,bytes=files.get(route);
  if(!bytes)return handler(req,res);if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  res.writeHead(200,{'Content-Type':route.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:bytes);});
 server.tomeSourceIndex={...original.tomeSourceIndex,diagnostic:'same-cpu-pointer-client-array'};return server;
}
