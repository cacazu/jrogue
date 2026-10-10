/* SPDX-License-Identifier: GPL-3.0-or-later
 * Local read-only source routes. No copies, uploads, subprocesses, or preloads.
 * Runtime/server launches are owned by the parent.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const adapterDir = path.dirname(fileURLToPath(import.meta.url));
const taskDir = path.resolve(adapterDir,'..');
const workLayout = path.basename(adapterDir)==='bootstrap-work';
const portDir = path.resolve(adapterDir,'../..');
const defaultNativeBuildRoot = workLayout?path.join(taskDir,'native-core-work/browser-build'):path.join(portDir,'dist/native');
const defaultRustBrowserRoot = workLayout?path.join(taskDir,'rust-kernel-adapter-work/browser'):path.join(portDir,'retained/browser');
const defaultRetainedBuildRoot = workLayout?path.join(taskDir,'rust-kernel-adapter-work/target/wasm32-unknown-unknown/release'):path.join(portDir,'dist/retained');
const mime = {'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm'};
function within(root,file) {
  const relative = path.relative(root,file);
  return relative==='' || (!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith(`..${path.sep}`));
}
function etag(stat) { return `"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs*1000).toString(16)}"`; }

function originalIndex(manifest,manifestDir) {
  const records = new Map(), directories = new Set();
  function addFile(virtual,physical,role,overlay=false) {
    if (records.has(virtual)) throw new Error(`Duplicate original file: ${virtual}`);
    const resolved = fs.realpathSync(path.resolve(manifestDir,physical));
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) throw new Error(`Original input is not a file: ${physical}`);
    records.set(virtual,{virtual,physical:resolved,bytes:stat.size,mtimeMs:stat.mtimeMs,
      etag:etag(stat),url:'/vfs'+virtual.split('/').map(encodeURIComponent).join('/'),role,overlay});
    let directory = path.posix.dirname(virtual);
    while (directory!=='/') { directories.add(directory); directory=path.posix.dirname(directory); }
  }
  function walk(root,physical,virtual,role) {
    directories.add(virtual);
    for (const item of fs.readdirSync(physical,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      if (item.isSymbolicLink()) throw new Error(`Source symlink needs explicit review: ${path.join(physical,item.name)}`);
      const file = path.join(physical,item.name);
      const resolved = fs.realpathSync(file);
      if (!within(root,resolved)) throw new Error('Original source entry escaped its explicit input root');
      const target = path.posix.join(virtual,item.name);
      if (item.isDirectory()) walk(root,resolved,target,role);
      else if (item.isFile()) {
        const overlay = manifest.build_overlay;
        if (overlay?.virtual===target) addFile(target,overlay.staged,role,true);
        else addFile(target,resolved,role);
      }
    }
  }
  for (const input of manifest.inputs) {
    const physical = fs.realpathSync(path.resolve(manifestDir,input.physical));
    if (input.type==='directory') walk(physical,physical,input.virtual,input.role);
    else if (input.type==='file') addFile(input.virtual,physical,input.role);
    else throw new Error('Unexpected original input type');
  }
  const publicManifest = {version:1,upstream_commit:manifest.upstream_commit,
    source_archive_sha256:manifest.source_archive_sha256,
    directories:[...directories].sort(),files:[...records.values()].map(({physical,mtimeMs,...publicFile})=>publicFile),
    source_mutation:'Rejected after startup metadata snapshot',
    publication:'Local source-backed test only; hosted redistribution remains subject to the parent license audit'};
  return {records,publicManifest};
}

function sendFile(req,res,record) {
  const stat = fs.statSync(record.physical);
  if (stat.size!==record.bytes || stat.mtimeMs!==record.mtimeMs) {
    res.writeHead(409,{'Content-Type':'text/plain'}).end('Original input changed after metadata indexing'); return;
  }
  const common = {'Content-Type':mime[path.extname(record.physical)]||'application/octet-stream',
    'Cache-Control':'no-store','Accept-Ranges':'bytes','ETag':record.etag,
    'Last-Modified':stat.mtime.toUTCString()};
  if (req.headers['if-match'] && req.headers['if-match']!==record.etag) {
    res.writeHead(412,common).end(); return;
  }
  let start=0,end=record.bytes-1,status=200;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1]&&!match[2]) || !record.bytes) {
      res.writeHead(416,{...common,'Content-Range':`bytes */${record.bytes}`}).end(); return;
    }
    if (!match[1]) {
      const suffix = Number(match[2]); start = Math.max(0,record.bytes-suffix);
      if (!Number.isSafeInteger(suffix)||suffix<=0) start=record.bytes;
    } else {
      start = Number(match[1]); end = match[2]?Number(match[2]):end;
    }
    if (!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=record.bytes||end<start) {
      res.writeHead(416,{...common,'Content-Range':`bytes */${record.bytes}`}).end(); return;
    }
    end=Math.min(end,record.bytes-1); status=206;
    common['Content-Range']=`bytes ${start}-${end}/${record.bytes}`;
  }
  const bytes = Math.max(0,end-start+1);
  res.writeHead(status,{...common,'Content-Length':bytes});
  if (req.method==='HEAD' || !bytes) { res.end(); return; }
  const stream=fs.createReadStream(record.physical,{start,end,highWaterMark:65536});
  stream.on('error',error=>res.destroy(error));
  res.on('close',()=>stream.destroy());
  stream.pipe(res);
}

export async function createTomeServer(options={}) {
  const manifestFile = path.resolve(options.manifest || path.join(adapterDir,'browser-vfs-inputs.json'));
  const manifestDir = path.dirname(manifestFile);
  const staticRoot = path.resolve(options.staticRoot || adapterDir);
  const nativeBuildRoot = path.resolve(options.nativeBuildRoot || defaultNativeBuildRoot);
  const rustBrowserRoot = path.resolve(options.rustBrowserRoot || defaultRustBrowserRoot);
  const retainedBuildRoot = path.resolve(options.retainedBuildRoot || defaultRetainedBuildRoot);
  const semanticRoot = path.resolve(options.semanticRoot || (workLayout?path.join(taskDir,'localization-wasm-work'):path.join(portDir,'localization/wasm')));
  const semanticBuildRoot = path.resolve(options.semanticBuildRoot || (workLayout?path.join(semanticRoot,'target/wasm32-unknown-unknown/release'):path.join(portDir,'dist/semantic')));
  const catalogRoot = path.resolve(options.catalogRoot || (workLayout?path.join(taskDir,'localization-kernel-work/catalogs'):path.join(portDir,'localization/catalogs')));
  const reviewRoot = path.resolve(options.reviewRoot || (workLayout?path.join(taskDir,'localization-review-work'):path.join(portDir,'localization/review')));
  const manifest = JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  const {records,publicManifest} = originalIndex(manifest,manifestDir);
  const metadata = Buffer.from(JSON.stringify(publicManifest),'utf8');
  const staticFiles = new Map([
    ['/',{root:staticRoot,file:path.join(staticRoot,'original-browser-boot.html')}],
    ['/index.html',{root:staticRoot,file:path.join(staticRoot,'original-browser-boot.html')}],
    ['/original-browser-boot.html',{root:staticRoot,file:path.join(staticRoot,'original-browser-boot.html')}],
    ['/retained-browser.html',{root:staticRoot,file:path.join(staticRoot,'retained-browser.html')}],
    ['/ui-roundtrip-browser.html',{root:staticRoot,file:path.join(staticRoot,'ui-roundtrip-browser.html')}],
    ['/bootstrap/browser_vfs_mounts.mjs',{root:staticRoot,file:path.join(staticRoot,'browser_vfs_mounts.mjs')}],
    ['/native/tome-native.mjs',{root:nativeBuildRoot,file:path.join(nativeBuildRoot,'tome-native.mjs')}],
    ['/native/tome-native.wasm',{root:nativeBuildRoot,file:path.join(nativeBuildRoot,'tome-native.wasm')}],
    ['/semantic/tome_text_wasm.wasm',{root:semanticBuildRoot,file:path.join(semanticBuildRoot,'tome_text_wasm.wasm')}],
    ...['semantic-text-wasm.mjs','native-semantic-bridge.mjs','native-semantic-browser.html','native-semantic-browser.mjs','native-semantic-session.mjs'].map(name=>
      ['/semantic/'+name,{root:semanticRoot,file:path.join(semanticRoot,'browser',name)}]),
    ...['en.json','ja.json','registry.json'].map(name=>['/catalog/'+name,{root:catalogRoot,file:path.join(catalogRoot,name)}]),
    ...['ja-supplement-complete.json','format-policy.json'].map(name=>['/catalog/'+name,{root:reviewRoot,file:path.join(reviewRoot,'final-review',name)}]),
    ['/catalog/dream-registry-extension.json',{root:reviewRoot,file:path.join(reviewRoot,'dream-stage','dream-registry-extension.json')}],
  ]);
  function codeFile(name) {
    if (staticFiles.has(name)) return staticFiles.get(name);
    // Source-only Rust session modules may import siblings. No build artifacts,
    // credentials, arbitrary task files, directory listing, or parent paths.
    if (name.startsWith('/rust/') && /\.(?:mjs|js|wasm|json)$/.test(name)) {
      const target=path.resolve(rustBrowserRoot,name.slice('/rust/'.length));
      if (within(rustBrowserRoot,target)) return {root:rustBrowserRoot,file:target};
    }
    if (name.startsWith('/retained/') && /\.(?:wasm|json)$/.test(name)) {
      const target=path.resolve(retainedBuildRoot,name.slice('/retained/'.length));
      if (within(retainedBuildRoot,target)) return {root:retainedBuildRoot,file:target};
    }
    return null;
  }
  const server=http.createServer((req,res)=>{
    try {
      if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{'Allow':'GET, HEAD'}).end(); return; }
      const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      if (name==='/vfs-manifest.json') {
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':metadata.length,'Cache-Control':'no-store'});
        res.end(req.method==='HEAD'?undefined:metadata); return;
      }
      if (name.startsWith('/vfs/')) {
        const record=records.get(name.slice('/vfs'.length));
        if (!record) { res.writeHead(404).end('Source route absent from explicit manifest'); return; }
        sendFile(req,res,record); return;
      }
      const code=codeFile(name);
      if (!code) { res.writeHead(404).end('No local test route'); return; }
      const allowedRoot=fs.realpathSync(code.root), resolved=fs.realpathSync(code.file);
      if (!within(allowedRoot,resolved)) { res.writeHead(403).end(); return; }
      const stat=fs.statSync(resolved);
      sendFile(req,res,{physical:resolved,bytes:stat.size,mtimeMs:stat.mtimeMs,etag:etag(stat)});
    } catch (error) {
      if (res.headersSent) res.destroy(error);
      else res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'}).end(error.message);
    }
  });
  server.tomeSourceIndex={fileCount:records.size,directoryCount:publicManifest.directories.length,
    sourceCommit:manifest.upstream_commit,assetBytesCopied:0,metadataBytes:metadata.length};
  return server; // Parent owns listen()/close(), lifecycle, monitoring, and tests.
}

export async function startTomeServer(options={}) {
  const port=options.port??4187;
  if (!Number.isSafeInteger(port)||port<0||port>65535) throw new Error('Local port must be an integer from 0 to 65535');
  const nativeRoot=path.resolve(options.nativeBuildRoot||defaultNativeBuildRoot);
  for (const name of ['tome-native.mjs','tome-native.wasm']) {
    if (!fs.statSync(path.join(nativeRoot,name)).isFile()) throw new Error(`Actual native build file is missing: ${name}`);
  }
  const server=await createTomeServer(options);
  await new Promise((resolve,reject)=>{
    const failed=error=>reject(error);
    server.once('error',failed);
    server.listen(port,'127.0.0.1',()=>{server.removeListener('error',failed);resolve();});
  });
  const url=`http://127.0.0.1:${server.address().port}/`;
  console.log('TOME_LOCAL_SERVER='+JSON.stringify({url,bind:'127.0.0.1',...server.tomeSourceIndex}));
  return server;
}

export function localServerOptions(argv) {
  const options={port:4187};
  const keys=new Map([['--manifest','manifest'],['--native-root','nativeBuildRoot'],
    ['--rust-root','rustBrowserRoot'],['--retained-root','retainedBuildRoot'],['--static-root','staticRoot']]);
  for (let i=0;i<argv.length;i++) {
    const argument=argv[i];
    if (argument==='--help') {options.help=true;continue;}
    const value=argv[++i];
    if (!value||value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
    if (argument==='--port') {
      if (!/^\d+$/.test(value)) throw new Error('Port must be a decimal integer');
      options.port=Number(value);
    } else if (keys.has(argument)) options[keys.get(argument)]=path.resolve(value);
    else throw new Error(`Unknown local server option: ${argument}`);
  }
  return options;
}

export function installLocalShutdown(server) {
  let closing=false;
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>{
    if (closing) return;closing=true;
    server.close(()=>{process.exitCode=0;});
    server.closeIdleConnections?.();
    const timer=setTimeout(()=>server.closeAllConnections?.(),5000);timer.unref();
  });
}

if (process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const options=localServerOptions(process.argv.slice(2));
    if (options.help) console.log('Local only: node original_range_server.mjs [--port 4187] [--manifest FILE] [--native-root DIR] [--rust-root DIR] [--retained-root DIR] [--static-root DIR]');
    else installLocalShutdown(await startTomeServer(options));
  } catch (error) {
    console.error('TOME_LOCAL_SERVER_FAILURE='+JSON.stringify({message:error.message}));process.exitCode=1;
  }
}
