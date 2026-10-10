// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated read-only candidate routes; factory does not listen or launch tools.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTomeServer as createBaselineServer} from '../../save-resume-work/baseline_server.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),work=path.resolve(here,'../..'),physical=path.resolve(here,'..');
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm'};
export async function createTomeServer(options={}){
  const baseline=await createBaselineServer({...options,nativeBuildRoot:options.nativeBuildRoot||path.join(work,'native-core-work/physical-input-build')});
  const [handler]=baseline.listeners('request');if(typeof handler!=='function')throw Error('save.server.original_handler_missing');
  const files=new Map([
    ['/physical-play-browser.html',path.join(here,'physical-play-browser.html')],
    ['/physical-play-browser.mjs',path.join(here,'physical-play-browser.mjs')],
    // Existing browser_probe hashes these route names. Both aliases are exactly
    // the same isolated derivative bytes; default baseline files stay unchanged.
    ['/play-browser.html',path.join(here,'physical-play-browser.html')],
    ['/play-browser.mjs',path.join(here,'physical-play-browser.mjs')],
    ['/physical/physical-play-owner.mjs',path.join(here,'physical-play-owner.mjs')],
    ...['physical-input-wasm.mjs','original-physical-input.mjs','focused-input-host.mjs'].map(name=>['/physical/'+name,path.join(physical,'browser',name)]),
    ...['en','ja'].map(locale=>['/physical/i18n/'+locale+'.json',path.join(physical,'i18n',locale+'.json')]),
    ['/physical/tome_physical_input.wasm',options.physicalWasm||path.join(physical,'rust/target/wasm32-unknown-unknown/release/tome_physical_input.wasm')],
  ]);
  const initial=new Map();for(const [route,file] of files){const stat=fs.statSync(file);if(!stat.isFile())throw Error('Candidate input is not a file');initial.set(route,{bytes:stat.size,mtime:stat.mtimeMs});}
  const server=http.createServer((request,response)=>{
    const route=new URL(request.url,'http://127.0.0.1').pathname,file=files.get(route);if(!file)return handler(request,response);
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return;}
    try{
      const stat=fs.statSync(file),expected=initial.get(route);
      if(!stat.isFile()||stat.size!==expected.bytes||stat.mtimeMs!==expected.mtime){response.writeHead(409).end('Candidate source changed after indexing');return;}
      response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store'});
      if(request.method==='HEAD'){response.end();return;}
      const stream=fs.createReadStream(file);stream.on('error',error=>response.destroy(error));response.on('close',()=>stream.destroy());stream.pipe(response);
    }catch(error){if(!response.headersSent)response.writeHead(404).end(error.message);else response.destroy(error);}
  });
  server.tomeSourceIndex={...baseline.tomeSourceIndex,candidate:'isolated-original-physical-input',
    default_delivery_changed:false,original_assets_preloaded_bytes:0};return server;
}
