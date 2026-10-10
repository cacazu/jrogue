import { createServer } from 'node:http';
import { open, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const portArg = process.argv.find(arg => arg.startsWith('--port='));
const port = Number(portArg?.slice(7) || process.env.ANGBAND_PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.data': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.zip': 'application/zip', '.gz': 'application/gzip'
};
function isInside(path) {
  const local = relative(root, path);
  return local === '' || (!isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`));
}
export const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-cache');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
  }
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path.includes('\\') || path.includes('\0') || path.split('/').some(segment => segment.startsWith('.'))) {
      response.writeHead(403); response.end(); return;
    }
    if (path === '/') {
      response.writeHead(302, { Location: '/web/' }); response.end(); return;
    }
    let target = resolve(root, `.${path}`);
    if (!isInside(target)) { response.writeHead(403); response.end(); return; }
    if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
    target = await realpath(target);
    if (!isInside(target)) { response.writeHead(403); response.end(); return; }
    const contentType = mime[extname(target).toLowerCase()] || (/^(copying|licen[cs]e)(\.|$)/i.test(target.split(sep).at(-1)) ? 'text/plain; charset=utf-8' : null);
    if (!contentType) { response.writeHead(403); response.end(); return; }
    const handle = await open(target, 'r');
    const info = await handle.stat();
    response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': info.size });
    if (request.method === 'HEAD') { await handle.close(); response.end(); return; }
    handle.createReadStream().on('error', () => response.destroy()).pipe(response);
  } catch (error) {
    if (response.headersSent) { response.destroy(); return; }
    response.writeHead(error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? 404 : 400);
    response.end();
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Angband: http://127.0.0.1:${port}/web/`);
});
