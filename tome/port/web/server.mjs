import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function createServer(root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist')) {
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm'};
  return http.createServer(async(req,res)=>{
    try {
      const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
      if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      const bytes=await readFile(file);
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(bytes);
    }catch{res.writeHead(404).end();}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createServer();server.listen(4186,'127.0.0.1',()=>console.log('http://127.0.0.1:4186/'));
}
