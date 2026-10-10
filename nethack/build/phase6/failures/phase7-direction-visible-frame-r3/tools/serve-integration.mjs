/* Local-only NetHack integration server. No packages, installs, or external hosts. */
import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip', '.tgz': 'application/gzip', '.data': 'application/octet-stream',
};

function inside(root, target) {
  const path = relative(root, target);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export async function serveIntegration({ root = resolve(dirname(fileURLToPath(import.meta.url)), '../web'), port = 0 } = {}) {
  const directory = await realpath(root);
  const requests = [];
  const server = createServer(async (request, response) => {
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const finish = (status, body, type = 'text/plain; charset=utf-8') => {
      requests.push({ method: request.method, path: request.url, status });
      response.writeHead(status, { 'Content-Type': type });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(request.method)) return finish(405, 'Method not allowed');
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const decoded = decodeURIComponent(url.pathname);
      if (decoded.includes('\0') || decoded.includes('\\')) return finish(400, 'Invalid path');
      let candidate = resolve(directory, `.${decoded}`);
      if (!inside(directory, candidate)) return finish(403, 'Forbidden');
      if ((await stat(candidate)).isDirectory()) candidate = resolve(candidate, 'index.html');
      candidate = await realpath(candidate);
      if (!inside(directory, candidate)) return finish(403, 'Forbidden');
      const body = await readFile(candidate);
      return finish(200, body, MIME[extname(candidate).toLowerCase()] ?? 'application/octet-stream');
    } catch (error) {
      return finish(error instanceof URIError ? 400 : 404, 'Not found');
    }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', accept);
  });
  const address = server.address();
  return { root: directory, url: `http://127.0.0.1:${address.port}/`, requests,
    close: () => new Promise((accept, reject) => server.close(error => error ? reject(error) : accept())) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const service = await serveIntegration({ root: process.argv[2], port: Number(process.argv[3] ?? 3000) });
  process.stdout.write(`${service.url}\n`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await service.close(); process.exit(); });
}
