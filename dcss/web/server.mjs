import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.css':'text/css; charset=utf-8','.data':'application/octet-stream'};
export function createPreviewServer(){
  return createServer(async(req,res)=>{
    try{
      const parsed=new URL(req.url,'http://127.0.0.1');
      const pathname=decodeURIComponent(parsed.pathname);
      const relative=pathname==='/'?'web/index.html':pathname.slice(1);
      const target=path.resolve(root,relative);
      const engineFiles=new Set(['dcss.js','dcss.wasm','dcss.data','manifest.json']);
      const engineAsset=['build','build-jspi'].some(directory=>path.dirname(target)===path.join(root,'engine',directory))&&engineFiles.has(path.basename(target));
      const allowed=engineAsset||['web','build','locales'].some(directory=>target.startsWith(path.join(root,directory)+path.sep));
      if(!allowed){res.writeHead(403);res.end('Forbidden');return;}
      const bytes=await readFile(target);
      res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','X-Content-Type-Options':'nosniff'});
      res.end(bytes);
    }catch{res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.DCSS_PORT||4186);
  createPreviewServer().listen(port,'127.0.0.1',()=>process.stdout.write(`DCSS local verification: http://127.0.0.1:${port}/\n`));
}
