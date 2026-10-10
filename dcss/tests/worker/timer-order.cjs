const assert = require('node:assert/strict');
const { runWorkerInContext, readWorkerSource } = require('./startup-bridge-mock.cjs');
const outputs = [], deliveredKeys = [];
let options, heldTimer, phase = 'uninitialized', turn = 0, snapshots = 0, saves = 0;
function enterInput() {
  phase = 'unwinding';
  options.dcssReadKey(key => {
    deliveredKeys.push(key);
    phase = 'timer';
    heldTimer = () => { turn++; enterInput(); };
  });
  if (phase === 'unwinding') phase = 'waiting';
}
const engine = {
  FS: { mkdirTree() {}, readdir() { return ['.', '..']; } },
  callMain() { enterInput(); },
  UTF8ToString() { return JSON.stringify({ turn }); },
  _dcss_snapshot_json() {
    assert.equal(phase, 'waiting', 'snapshot must follow a complete Asyncify unwind');
    snapshots++;
    return 1;
  },
  _dcss_save() {
    assert.equal(phase, 'waiting', 'save must follow a complete Asyncify unwind');
    saves++;
    return 1;
  },
};
const self = {
  postMessage(message) { outputs.push(structuredClone(message)); },
  addEventListener() {},
};
const context = {
  self, Error, Uint32Array, Uint8Array, Set, JSON, Number, Array, queueMicrotask,
  importScripts() { self.createDcssEngine = async value => { options = value; return engine; }; },
};
runWorkerInContext(readWorkerSource(), context);
const settle = () => new Promise(setImmediate);
const send = async data => { await self.onmessage({ data }); await settle(); };
const response = id => outputs.find(message => message.type === 'response' && message.id === id);
(async () => {
  await send({ type: 'request', id: 1, op: 'boot', files: [] });
  await send({ type: 'request', id: 2, op: 'start', arguments: [] });
  assert.equal(phase, 'waiting');
  await send({ type: 'key', key: 46 });
  await send({ type: 'request', id: 3, op: 'state' });
  await send({ type: 'key', key: 47 });
  assert.equal(response(3), undefined);
  assert.equal(snapshots, 0);
  heldTimer();
  await settle();
  assert.equal(response(3).value.turn, 1, 'earlier snapshot must precede later key');
  assert.deepEqual(deliveredKeys, [46, 47]);
  assert.equal(phase, 'timer');
  heldTimer();
  await settle();
  assert.equal(turn, 2);
  await send({ type: 'key', key: 48 });
  await send({ type: 'key', key: 49 });
  await send({ type: 'request', id: 4, op: 'state' });
  await send({ type: 'key', key: 50 });
  heldTimer();
  await settle();
  assert.equal(response(4), undefined, 'snapshot must wait for an earlier queued key');
  assert.deepEqual(deliveredKeys, [46, 47, 48, 49]);
  heldTimer();
  await settle();
  assert.equal(response(4).value.turn, 4);
  assert.deepEqual(deliveredKeys, [46, 47, 48, 49, 50]);
  await send({ type: 'request', id: 5, op: 'save' });
  await send({ type: 'key', key: 51 });
  assert.equal(saves, 0);
  heldTimer();
  await settle();
  assert.equal(response(5).ok, true, 'earlier save must precede later key');
  assert.equal(saves, 1);
  assert.deepEqual(deliveredKeys, [46, 47, 48, 49, 50, 51]);
  console.log(JSON.stringify({
    protocol: 'timer suspension ordering stub only',
    checks: [
      'no snapshot or save export during a timer suspension',
      'earlier snapshot runs before later queued key',
      'snapshot waits for earlier queued key',
      'earlier save runs before later queued key',
      'exports require complete input Asyncify unwind',
    ],
    actual_engine_executed: false,
  }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
