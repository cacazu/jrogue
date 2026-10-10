/* SPDX-License-Identifier: GPL-3.0-or-later
 * Read-only local routes around the existing verified original range server.
 * No server/browser launch is performed by this source module.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const workLayout=path.basename(here)==='save-resume-work';
const {createTomeServer:createOriginalServer}=await import(workLayout?'../bootstrap-work/original_range_server.mjs':'../bootstrap/original_range_server.mjs');
const routes=new Map([
  ['/baseline-save-resume.html','baseline-save-resume.html'],
  ['/semantic-resume.html','semantic-resume.html'],
  ...['play-browser.html','play-browser.mjs'].map(name=>['/'+name,(workLayout?'../bootstrap-work/':'../bootstrap/')+name]),
  ['/checkpoint/source-manifest.json','source-manifest.json'],
  ...['checkpoint_store.mjs','baseline_flow.mjs','native_archive_validator.mjs'].map(name=>['/checkpoint/'+name,name]),
  ...['en','ja'].map(locale=>['/checkpoint/i18n/'+locale+'.json','i18n/'+locale+'.json']),
]);
export async function createTomeServer(options={}) {
  const original=await createOriginalServer({...options,manifest:path.join(here,'browser-vfs-inputs.json')});
  const [originalHandler]=original.listeners('request');
  if(!originalHandler) throw new Error('save.server.original_handler_missing');
  const server=http.createServer((request,response)=>{
    const route=routes.get(new URL(request.url,'http://localhost').pathname);
    if(!route) return originalHandler(request,response);
    if(!['GET','HEAD'].includes(request.method)) {response.writeHead(405).end();return;}
    const file=path.join(here,route);
    try {
      const stat=fs.statSync(file);
      if(!stat.isFile()) throw new Error('save.server.invalid_file');
      const type=route.endsWith('.html')?'text/html; charset=utf-8':route.endsWith('.json')?'application/json; charset=utf-8':'text/javascript; charset=utf-8';
      response.writeHead(200,{'Content-Type':type,'Content-Length':stat.size,'Cache-Control':'no-store'});
      if(request.method==='HEAD') return response.end();
      const stream=fs.createReadStream(file);
      stream.on('error',error=>response.destroy(error));
      response.on('close',()=>stream.destroy());
      stream.pipe(response);
    } catch(error) {if(!response.headersSent)response.writeHead(404).end(error.message);else response.destroy(error);}
  });
  server.tomeSourceIndex=original.tomeSourceIndex;
  return server;
}
