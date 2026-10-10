import http from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const mime = {".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".wasm":"application/wasm",".json":"application/json; charset=utf-8",".txt":"text/plain; charset=utf-8",".zip":"application/zip"};
export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname);
      const target = path.resolve(root, "." + (pathname === "/" ? "/game.html" : pathname));
      if (target !== root && !target.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
      const bytes = await readFile(target);
      response.writeHead(200, {"Content-Type":mime[path.extname(target)] ?? "application/octet-stream","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}); response.end(bytes);
    } catch { response.writeHead(404); response.end("not found"); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createServer(); server.listen(Number(process.env.DRL_PORT ?? 4189), "127.0.0.1", () => console.log(`Original DRL: http://127.0.0.1:${server.address().port}/game.html`));
}
