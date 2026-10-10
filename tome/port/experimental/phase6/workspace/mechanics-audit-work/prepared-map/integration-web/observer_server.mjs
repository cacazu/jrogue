/* SPDX-License-Identifier: GPL-3.0-or-later
 * Source-only local observer routes. Parent owns all launches and builds.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTomeServer as createOriginalServer} from '../../../bootstrap-work/original_range_server.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const task=path.resolve(here,'../../..');
const baseline=path.join(task,'save-resume-work');
const files=new Map([
  ['/',path.join(here,'prepared-map-observer.html')],
  ['/prepared-map-observer.html',path.join(here,'prepared-map-observer.html')],
  ['/observer/observer.mjs',path.join(here,'observer.mjs')],
  ...['en','ja'].map(locale=>['/observer/i18n/'+locale+'.json',path.join(here,'i18n',locale+'.json')]),
  ['/checkpoint/source-manifest.json',path.join(baseline,'source-manifest.json')],
  ...['checkpoint_store.mjs','baseline_flow.mjs','native_archive_validator.mjs'].map(name=>['/checkpoint/'+name,path.join(baseline,name)]),
]);

export async function createTomeServer(options={}) {
  if(!options.nativeBuildRoot||!options.rustWasmFile)
    throw new Error('Explicit capture nativeBuildRoot and actual Rust rustWasmFile are required');
  const wasm=fs.realpathSync(path.resolve(options.rustWasmFile));
  if(!fs.statSync(wasm).isFile())throw new Error('Actual Rust wrapper WASM file is absent');
  const original=await createOriginalServer({...options,manifest:path.join(here,'browser-vfs-inputs.json')});
  const [originalHandler]=original.listeners('request');
  if(!originalHandler)throw new Error('Original range server handler is absent');
  const routes=new Map(files);routes.set('/rust/tome-map-packet.wasm',wasm);
  const server=http.createServer((request,response)=>{
    let pathname;
    try{pathname=new URL(request.url,'http://localhost').pathname;}catch{response.writeHead(400).end();return;}
    const file=routes.get(pathname);
    if(!file)return originalHandler(request,response);
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
    try{
      const stat=fs.statSync(file);if(!stat.isFile())throw new Error('Observer source route is not a file');
      const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':
        file.endsWith('.wasm')?'application/wasm':'text/javascript; charset=utf-8';
      response.writeHead(200,{'Content-Type':type,'Content-Length':stat.size,'Cache-Control':'no-store'});
      if(request.method==='HEAD'){response.end();return;}
      const stream=fs.createReadStream(file);stream.on('error',error=>response.destroy(error));
      response.on('close',()=>stream.destroy());stream.pipe(response);
    }catch(error){if(!response.headersSent)response.writeHead(404).end(error.message);else response.destroy(error);}
  });
  server.tomeSourceIndex={...original.tomeSourceIndex,observer_scope:'actual original fullsave then one native map observation',
    observer_renderer_ready:false,rustWasmFile:wasm};
  return server;
}
