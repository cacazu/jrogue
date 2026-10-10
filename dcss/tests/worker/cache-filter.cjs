const assert = require('node:assert/strict');
const { runWorkerInContext, readWorkerSource } = require('./startup-bridge-mock.cjs');
const workerSource = readWorkerSource();
async function enumerate(seedFiles) {
  const files = new Map(seedFiles.map(file => ['/persist/' + file.path, [...file.bytes]]));
  const reads = [], directories = [], outputs = [];
  const before = JSON.stringify([...files]);
  let options;
  const engine = {
    FS: {
      mkdirTree() {},
      writeFile() { throw Error('enumeration must not write or replace native files'); },
      readdir(directory) {
        directories.push(directory);
        return ['.', '..', ...new Set([...files.keys()]
          .filter(key => key.startsWith(directory + '/'))
          .map(key => key.slice(directory.length + 1).split('/')[0]))];
      },
      stat(absolute) {
        return { mode: files.has(absolute) ? 0 : 1 };
      },
      isDir(mode) { return mode === 1; },
      readFile(absolute) { reads.push(absolute); return Uint8Array.from(files.get(absolute)); },
    },
    callMain() { options.dcssReadKey(() => {}); },
    _dcss_save() { return 1; },
  };
  const self = {
    postMessage(message) { outputs.push(structuredClone(message)); },
    addEventListener() {},
  };
  runWorkerInContext(workerSource, {
    self, Error, Uint32Array, Uint8Array, Set, JSON, Number, Array, queueMicrotask,
    importScripts() { self.createDcssEngine = async value => { options = value; return engine; }; },
  });
  const send = async data => { await self.onmessage({ data }); await new Promise(setImmediate); };
  await send({ type: 'request', id: 1, op: 'boot', files: [] });
  await send({ type: 'request', id: 2, op: 'start', arguments: [] });
  await send({ type: 'request', id: 3, op: 'files' });
  await send({ type: 'request', id: 4, op: 'save' });
  const listed = outputs.find(output => output.id === 3).value;
  const saved = outputs.find(output => output.id === 4).value;
  assert.deepEqual(saved, listed, 'inspection and save must use the same exact filter');
  assert.equal(JSON.stringify([...files]), before, 'save transport must not remove or modify engine files');
  return { listed, reads, directories };
}
(async () => {
  const native = [
    { path: 'saves/猫.cs', bytes: Array.from({ length: 33775 }, (_, index) => index % 256) },
    { path: 'saves/猫.prf', bytes: Array.from({ length: 180 }, (_, index) => (255 - index) % 256) },
  ];
  const caches = [
    ...Array.from({ length: 22 }, (_, index) => ({ path: 'saves/db/cache-' + index, bytes: [index] })),
    ...Array.from({ length: 553 }, (_, index) => ({ path: 'saves/des/cache-' + index, bytes: [index % 256] })),
  ];
  const fullCountFixture = await enumerate([...native, ...caches]);
  assert.equal(native.length + caches.length, 577);
  assert.deepEqual(fullCountFixture.listed, native);
  assert.equal(fullCountFixture.listed.reduce((total, file) => total + file.bytes.length, 0), 33955);
  assert.equal(fullCountFixture.directories.includes('/persist/saves/db'), false);
  assert.equal(fullCountFixture.directories.includes('/persist/saves/des'), false);
  assert.equal(fullCountFixture.reads.length, 4, 'excluded cache bytes must not be read during either enumeration');

  const retained = [
    { path: 'db/native.cs', bytes: [0, 255] },
    { path: 'des/native.cs', bytes: [1, 254] },
    { path: 'other/saves/db/native.cs', bytes: [2, 253] },
    { path: 'other/saves/des/native.cs', bytes: [3, 252] },
    { path: 'saves/db-cache/native.db', bytes: [4, 251] },
    { path: 'saves/des-backup/native.des', bytes: [5, 250] },
    { path: 'saves/db2/native.cs', bytes: [6, 249] },
    { path: 'saves/des2/native.cs', bytes: [7, 248] },
    { path: 'saves/native.db', bytes: [8, 247] },
    { path: 'saves/native.des', bytes: [9, 246] },
    { path: 'saves/game/native.cs', bytes: [10, 245] },
  ];
  const matchingFixture = await enumerate([
    ...retained,
    { path: 'saves/db/nested/actual-player.cs', bytes: [11, 244] },
    { path: 'saves/des/nested/actual-player.cs', bytes: [12, 243] },
  ]);
  assert.deepEqual(matchingFixture.listed,
    [...retained].sort((first, second) => first.path < second.path ? -1 : first.path > second.path ? 1 : 0));
  const fileCollisionFixture = await enumerate([
    { path: 'saves/db', bytes: [13, 242] },
    { path: 'saves/des', bytes: [14, 241] },
  ]);
  assert.deepEqual(fileCollisionFixture.listed, [
    { path: 'saves/db', bytes: [13, 242] },
    { path: 'saves/des', bytes: [14, 241] },
  ]);
  console.log(JSON.stringify({
    protocol: 'pinned cache transport filter stub only',
    checks: [
      '575 cache files omitted from a 577-file count fixture',
      'all 33955 native fixture bytes retained exactly',
      'cache directories not traversed and cache bytes not read',
      'files inspection and save use the same filter',
      'engine filesystem unchanged by transport',
      'root and nested near-match directories retained',
      'native .db and .des filenames outside exact directories retained',
      'regular files named saves/db or saves/des retained',
    ],
    actual_engine_executed: false,
    cache_regeneration_or_resume_verified: false,
  }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
