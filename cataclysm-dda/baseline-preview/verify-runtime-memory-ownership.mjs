import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Tiny fixtures exercise the actual linked SDK's FS operations. No engine,
// browser, compressor job, package modification or source-tree write occurs.
const root = path.dirname(fileURLToPath(import.meta.url));
const linked = fs.readFileSync(path.join(root, 'web/cataclysm-tiles.js'), 'utf8');
const linkedSha256 = crypto.createHash('sha256').update(linked).digest('hex');
assert.equal(linkedSha256, '8e41e1903f220bbaf8831a215de66427b166741ca19f2fa01edc0995e0cc74b5');
function sdkObject(name) {
  const start = linked.indexOf('var ' + name + ' = {');
  const end = linked.indexOf('\n};', start);
  assert.ok(start >= 0 && end > start);
  return linked.slice(start, end + 3);
}
const nodes = new Map([['/', { name: '/', contents: {}, mode: 0o040777 }]]);
const getPath = node => node.path;
nodes.get('/').path = '/';
const FS = {
  isFile: mode => (mode & 0o170000) === 0o100000,
  isDir: mode => (mode & 0o170000) === 0o040000,
  ErrnoError: class extends Error { constructor(errno) { super(String(errno)); this.errno = errno; } },
  createPath(_parent, directory) {
    const parts = directory.split('/').filter(Boolean); let current = nodes.get('/');
    for (const part of parts) {
      const next = path.posix.join(current.path, part);
      if (!nodes.has(next)) { const node = { name: part, path: next, parent: current, contents: {}, mode: 0o040777 };
        current.contents[part] = node; nodes.set(next, node); }
      current = nodes.get(next);
    }
  },
  analyzePath: filename => ({ object: nodes.get(filename), exists: nodes.has(filename) }),
  createNode(parent, name, mode) {
    const node = { parent, name, mode, path: path.posix.join(getPath(parent), name) };
    nodes.set(node.path, node); return node;
  }
};
let mmapRequestedBytes = 0;
let pluginCalls = 0;
const context = vm.createContext({ FS, PATH: path.posix, Module: {}, assert: condition => assert.ok(condition),
  console: { log() {} }, out() {}, mmapAlloc: length => { mmapRequestedBytes = length; return 4096; },
  Browser: { init: () => pluginCalls++ }, preloadPlugins: [] });
vm.runInContext('var HEAP8 = new Int8Array(65536);' + sdkObject('MEMFS') + sdkObject('LZ4'), context);
const fixture = vm.runInContext('new Uint8Array(10240)', context);
for (let i = 0; i < fixture.length; i++) fixture[i] = Math.floor(i / 97) % 7;
context.LZ4.init();
const compressed = context.LZ4.codec.compressPackage(fixture.buffer, true);
const metadata = { files: [{ filename: '/data/first.json', start: 0, end: 3072 },
  { filename: '/gfx/second.bin', start: 3072, end: 6144 },
  { filename: '/lang/mo/ja/catalog.mo', start: 6144, end: 10240 }] };
await context.LZ4.loadPackage({ metadata, compressedData: compressed }, false);
let assertions = 0;
assert.equal(pluginCalls, 0); assertions++;
for (const file of metadata.files) {
  const node = nodes.get(file.filename);
  assert.equal(node.contents.compressedData, compressed); assertions++;
  assert.equal(node.contents.compressedData.data.buffer, compressed.data.buffer); assertions++;
  const read = new Uint8Array(node.size);
  assert.equal(context.LZ4.stream_ops.read({ node }, read, 0, read.length, 0), read.length); assertions++;
  assert.deepEqual(Buffer.from(read), Buffer.from(fixture.subarray(file.start, file.end))); assertions++;
}
assert.equal(compressed.cachedChunks.length, 2); assertions++;
assert.equal(context.LZ4.CHUNK_SIZE, 2048); assertions++;
for (const chunk of compressed.cachedChunks) {
  assert.equal(chunk.buffer, compressed.data.buffer); assertions++;
  assert.equal(chunk.byteLength, 2048); assertions++;
}
const bytes = vm.runInContext('new Uint8Array(4096).fill(73)', context);
const copiedNode = { mode: 0o100666, contents: null, usedBytes: 0 };
context.MEMFS.stream_ops.write({ node: copiedNode }, bytes, 0, bytes.length, 0, false);
assert.notEqual(copiedNode.contents.buffer, bytes.buffer); assertions++;
assert.deepEqual(Buffer.from(copiedNode.contents), Buffer.from(bytes)); assertions++;
const ownedNode = { mode: 0o100666, contents: null, usedBytes: 0 };
context.MEMFS.stream_ops.write({ node: ownedNode }, bytes, 0, bytes.length, 0, true);
assert.equal(ownedNode.contents.buffer, bytes.buffer); assertions++;
assert.deepEqual(Buffer.from(ownedNode.contents), Buffer.from(bytes)); assertions++;
const nativeMapping = context.MEMFS.stream_ops.mmap({ node: ownedNode }, bytes.length, 0, 1, 1);
assert.equal(nativeMapping.allocated, true); assertions++;
assert.equal(mmapRequestedBytes, bytes.length); assertions++;
assert.deepEqual(Buffer.from(context.HEAP8.subarray(nativeMapping.ptr, nativeMapping.ptr + bytes.length)), Buffer.from(bytes)); assertions++;
assert.notEqual(ownedNode.contents.buffer, context.HEAP8.buffer); assertions++;
const report = { result: 'pass', scope: 'tiny_fixture_actual_sdk_filesystem_ownership', linkedSha256,
  assertions, fixtureBytes: fixture.length, sharedCompressedArrayBuffer: true, cacheBytes: 4096,
  noPreloadPluginCopies: true, memfsCanOwnAvoidsOneTransientSlice: true,
  nativeMmapStillCopiesJsBackedFileIntoWasm: true, livePackageChanged: false,
  realGameResourceRecoveryVerified: false, recordedUtc: new Date().toISOString() };
fs.writeFileSync(path.join(root, 'runtime-memory-ownership-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
