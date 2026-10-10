/* SPDX-License-Identifier: GPL-3.0-or-later
 * Platform adapter only: original source bytes and archive bytes are unchanged.
 * Original PhysFS and Lua retain archive decoding, loading, and gameplay.
 * The local range server and all runtime/browser checks are owned by the parent.
 */
const EINVAL = 28, EIO = 29, ENOSYS = 52, EROFS = 69; // Emscripten WASI errno.

function byteRange(entry, start, end) { return `bytes ${start}-${end}/${entry.bytes}`; }
function identityEncoding(headers) {
  const value = headers.get('Content-Encoding');
  return !value || value.toLowerCase() === 'identity';
}

async function verifyRangeEndpoint(entry) {
  if (!entry.bytes) return;
  const head = await fetch(entry.url,{method:'HEAD',cache:'no-store'});
  if (!head.ok || head.headers.get('Accept-Ranges') !== 'bytes' ||
      Number(head.headers.get('Content-Length')) !== entry.bytes || !identityEncoding(head.headers)) {
    throw new Error(`Original file has no verified identity byte-range endpoint: ${entry.virtual}`);
  }
  const response = await fetch(entry.url,{headers:{Range:'bytes=0-0','If-Match':entry.etag},cache:'no-store'});
  if (response.status !== 206 || response.headers.get('Content-Range') !== byteRange(entry,0,0) ||
      !identityEncoding(response.headers)) {
    await response.body?.cancel();
    throw new Error(`Original archive server did not return exact HTTP206: ${entry.virtual}`);
  }
  const byte = new Uint8Array(await response.arrayBuffer());
  if (byte.length !== 1) throw new Error(`Invalid archive range length: ${entry.virtual}`);
}

class ReadOnlyRanges {
  constructor(FS,{chunkBytes,cacheBytes},metrics) {
    this.FS = FS;
    this.chunkBytes = chunkBytes;
    this.cacheBytes = cacheBytes;
    this.metrics = metrics;
    this.cache = new Map();
    this.cachedBytes = 0;
    this.worker = typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope;
  }
  fail(message) {
    this.metrics.lastError = message;
    console.error('TOME_ORIGINAL_RANGE_ERROR='+message);
    throw new this.FS.ErrnoError(EIO);
  }
  chunk(entry,index) {
    const key = `${entry.virtual}\0${entry.etag}\0${index}`;
    const prior = this.cache.get(key);
    if (prior) {
      this.cache.delete(key); this.cache.set(key,prior);
      this.metrics.cacheHits++;
      return prior;
    }
    const start = index*this.chunkBytes;
    const end = Math.min(start+this.chunkBytes,entry.bytes)-1;
    const xhr = new XMLHttpRequest();
    try {
      xhr.open('GET',entry.url,false);
      xhr.setRequestHeader('Range',`bytes=${start}-${end}`);
      xhr.setRequestHeader('If-Match',entry.etag);
      if (this.worker) xhr.responseType = 'arraybuffer';
      else xhr.overrideMimeType('text/plain; charset=x-user-defined');
      xhr.send(null);
    } catch (error) {
      this.fail(`Synchronous original-file range failed (${this.worker?'worker':'main'}): ${entry.virtual}: ${error.message}`);
    }
    const encoding = xhr.getResponseHeader('Content-Encoding');
    if (xhr.status !== 206 || xhr.getResponseHeader('Content-Range') !== byteRange(entry,start,end) ||
        (encoding && encoding.toLowerCase() !== 'identity') || xhr.getResponseHeader('ETag') !== entry.etag) {
      this.fail(`Original source changed or exact identity range rejected: ${entry.virtual}`);
    }
    let bytes;
    if (this.worker) bytes = new Uint8Array(xhr.response);
    else {
      // Main-thread sync XHR cannot use responseType=arraybuffer. The text MIME
      // override retains byte values through charCode & 255; parent must verify
      // support with actual original ZIP and font bytes in each target browser.
      const text = xhr.responseText;
      bytes = new Uint8Array(text.length);
      for (let i=0;i<text.length;i++) bytes[i] = text.charCodeAt(i)&255;
    }
    if (bytes.length !== end-start+1) this.fail(`Original range byte length changed: ${entry.virtual}`);
    while (this.cachedBytes+bytes.length > this.cacheBytes && this.cache.size) {
      const oldestKey = this.cache.keys().next().value;
      this.cachedBytes -= this.cache.get(oldestKey).length;
      this.cache.delete(oldestKey);
      this.metrics.cacheEvictions++;
    }
    this.cache.set(key,bytes); this.cachedBytes += bytes.length;
    this.metrics.rangeRequests++;
    this.metrics.rangeBytes += bytes.length;
    if (/\.team$/i.test(entry.virtual)) this.metrics.archiveRangeBytes += bytes.length;
    this.metrics.cacheBytes = this.cachedBytes;
    this.metrics.peakCacheBytes = Math.max(this.metrics.peakCacheBytes,this.cachedBytes);
    return bytes;
  }
  read(entry,buffer,offset,length,position) {
    if (!Number.isSafeInteger(position) || position < 0) throw new this.FS.ErrnoError(EINVAL);
    const count = Math.min(length,Math.max(0,entry.bytes-position));
    let copied = 0;
    while (copied<count) {
      const absolute = position+copied;
      const chunk = this.chunk(entry,Math.floor(absolute/this.chunkBytes));
      const within = absolute%this.chunkBytes;
      const size = Math.min(count-copied,chunk.length-within);
      buffer.set(chunk.subarray(within,within+size),offset+copied);
      copied += size;
    }
    this.metrics.readCalls++; this.metrics.readBytes += count;
    return count;
  }
}

function installFile(FS,ranges,entry) {
  const index = entry.virtual.lastIndexOf('/');
  const parent = entry.virtual.slice(0,index) || '/';
  const name = entry.virtual.slice(index+1);
  const node = FS.createFile(parent,name,{},true,false);
  const baseGetattr = node.node_ops.getattr;
  const deny = () => { throw new FS.ErrnoError(EROFS); };
  node.node_ops = {...node.node_ops,getattr(current) {
    const stat = baseGetattr(current);
    stat.size = entry.bytes;
    stat.blocks = Math.ceil(entry.bytes/512);
    stat.mode = (stat.mode&~0o777)|0o444;
    return stat;
  },setattr:deny};
  node.stream_ops = {
    open(stream) { if ((stream.flags&3)!==0) deny(); },
    close() {},
    read:(stream,buffer,offset,length,position) => ranges.read(entry,buffer,offset,length,position),
    llseek(stream,offset,whence) {
      let position = offset;
      if (whence===1) position += stream.position;
      else if (whence===2) position += entry.bytes;
      else if (whence!==0) throw new FS.ErrnoError(EINVAL);
      if (!Number.isSafeInteger(position) || position<0) throw new FS.ErrnoError(EINVAL);
      return position;
    },
    write:deny,msync:deny,allocate:deny,
    mmap() { throw new FS.ErrnoError(ENOSYS); },
  };
  node.mode = (node.mode&~0o777)|0o444;
}

export async function mountOriginalInputs(module,manifestURL='/vfs-manifest.json',options={}) {
  const FS = module.FS;
  if (!FS?.createFile || !FS?.mkdirTree) throw new Error('Actual native module must export classic Emscripten FS');
  const response = await fetch(manifestURL,{cache:'no-store'});
  if (!response.ok) throw new Error(`Original source metadata unavailable: HTTP${response.status}`);
  const manifest = await response.json();
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !Array.isArray(manifest.directories)) {
    throw new Error('Unexpected original VFS metadata format');
  }
  const chunkBytes = options.chunkBytes ?? 262144;
  const cacheBytes = options.cacheBytes ?? 8388608;
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes<=0 || !Number.isSafeInteger(cacheBytes) || cacheBytes<chunkBytes) {
    throw new Error('Range cache limits must be positive byte counts with cache at least one chunk');
  }
  const seen = new Set();
  for (const entry of manifest.files) {
    if (!/^\/(?:original|unpacked|adapter)\//.test(entry.virtual) || entry.virtual.split('/').includes('..') ||
        seen.has(entry.virtual) || !Number.isSafeInteger(entry.bytes) || entry.bytes<0) {
      throw new Error('Invalid or duplicate original source metadata path');
    }
    entry.url = new URL(entry.url,new URL(manifestURL,location.href)).href;
    if (new URL(entry.url).origin !== location.origin) throw new Error('Original source routes must use the same origin');
    seen.add(entry.virtual);
  }
  // Verify large original archives asynchronously before any synchronous C read.
  // A server returning HTTP200 is canceled before its whole body is consumed.
  for (const entry of manifest.files.filter((file) => file.bytes>chunkBytes)) await verifyRangeEndpoint(entry);
  const metrics = {rangeRequests:0,rangeBytes:0,archiveRangeBytes:0,readCalls:0,readBytes:0,
    cacheHits:0,cacheEvictions:0,cacheBytes:0,peakCacheBytes:0,assetBytesPreloaded:0};
  const ranges = new ReadOnlyRanges(FS,{chunkBytes,cacheBytes},metrics);
  const directories = new Set(manifest.directories);
  for (const entry of manifest.files) {
    let current = entry.virtual.slice(0,entry.virtual.lastIndexOf('/'));
    while (current) { directories.add(current); current = current.slice(0,current.lastIndexOf('/')); }
  }
  for (const directory of [...directories].sort((a,b)=>a.length-b.length)) {
    if (!/^\/(?:original|unpacked|adapter)(?:\/|$)/.test(directory) || directory.split('/').includes('..')) {
      throw new Error('Invalid original source metadata directory');
    }
    FS.mkdirTree(directory);
  }
  for (const entry of manifest.files) installFile(FS,ranges,entry);
  const deny = () => { throw new FS.ErrnoError(EROFS); };
  for (const directory of directories) {
    const node = FS.lookupPath(directory).node;
    node.mode = (node.mode&~0o777)|0o555;
    node.node_ops = {...node.node_ops,setattr:deny,mknod:deny,rename:deny,unlink:deny,rmdir:deny,symlink:deny};
  }
  FS.mkdirTree('/persist'); // Session MEMFS only; parent must add actual IDBFS lifecycle for save/resume.
  console.log('TOME_BROWSER_VFS_READY='+JSON.stringify({files:manifest.files.length,
    directories:directories.size,assetBytesPreloaded:0,chunkBytes,cacheBytes,
    sourceCommit:manifest.upstream_commit,transport:ranges.worker?'worker-arraybuffer-xhr':'main-text-byte-xhr'}));
  return {manifest,metrics,transport:ranges.worker?'worker-arraybuffer-xhr':'main-text-byte-xhr'};
}
