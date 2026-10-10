import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'web');
const port=Number(process.argv[2]||8878);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose a port between 1024 and 65535.');
const manifestPath=path.join(root,'package-manifest.json');
if(!fs.existsSync(manifestPath))throw new Error('Package the actual linked engine before starting its local server.');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(!manifest.baselineOnly||!manifest.publication.localOnly)throw new Error('This server is only for the local reference package.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm',
  '.data':'application/octet-stream','.txt':'text/plain; charset=utf-8','.ico':'image/x-icon',
  '.png':'image/png','.md':'text/plain; charset=utf-8','.h':'text/plain; charset=utf-8',
  '.cpp':'text/plain; charset=utf-8'};
const server=http.createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
  let filename;
  try {
    let pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    if(pathname==='/')pathname='/index.html';
    filename=path.resolve(root,'.'+pathname);
    if(!filename.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  } catch {response.writeHead(400).end();return;}
  fs.stat(filename,(error,stat)=>{
    if(error||!stat.isFile()){response.writeHead(404).end();return;}
    response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'text/plain; charset=utf-8',
      'Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(request.method==='HEAD'){response.end();return;}
    const stream=fs.createReadStream(filename);stream.on('error',()=>response.destroy());stream.pipe(response);
  });
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({localOnly:true,url:`http://127.0.0.1:${port}/`,
  sourceCommit:manifest.sourceCommit,root})));
