'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Decode this fixture's ordinary wasm32 import section without compiling or
// instantiating a WebAssembly.Module just to inspect its imports.
function importDescriptors(bytes) {
  assert.deepEqual(Array.from(bytes.subarray(0, 8)), [0, 97, 115, 109, 1, 0, 0, 0]);
  let position = 8;
  let limit = bytes.length;
  function byte() {
    if (position >= limit) throw new Error('truncated Wasm import data');
    return bytes[position++];
  }
  function u32() {
    let value = 0;
    for (let index = 0; index < 5; index++) {
      const next = byte();
      if (index === 4 && (next & 0xf0)) throw new Error('invalid Wasm u32');
      value += (next & 0x7f) * (2 ** (index * 7));
      if (!(next & 0x80)) return value;
    }
    throw new Error('overlong Wasm u32');
  }
  function name() {
    const length = u32();
    if (position + length > limit) throw new Error('truncated Wasm import name');
    const value = bytes.toString('utf8', position, position + length);
    position += length;
    return value;
  }
  function limits() {
    const flags = u32();
    if (flags & ~3) throw new Error('fixture parser expects wasm32 limits');
    u32();
    if (flags & 1) u32();
  }
  while (position < bytes.length) {
    limit = bytes.length;
    const section = byte();
    const length = u32();
    const end = position + length;
    if (end > bytes.length) throw new Error('truncated Wasm section');
    if (section !== 2) { position = end; continue; }
    limit = end;
    const count = u32();
    const imports = [];
    for (let index = 0; index < count; index++) {
      const module = name();
      const field = name();
      const kind = byte();
      imports.push({ module, name: field, kind });
      switch (kind) {
        case 0: u32(); break; // function type index
        case 1: byte(); limits(); break; // funcref table
        case 2: limits(); break; // memory
        case 3: byte(); byte(); break; // value type and mutability
        case 4: byte(); u32(); break; // exception tag attribute and type index
        default: throw new Error(`unknown Wasm import kind ${kind}`);
      }
    }
    assert.equal(position, end, 'unexpected bytes at end of import section');
    return imports;
  }
  return [];
}

const evidence = { fixture: 'jspi-indirect-suspension-eh', events: [], stdout: [], stderr: [] };
const timers = new Set();
let timeout;

async function run() {
  const [moduleArgument, ...options] = process.argv.slice(2);
  assert.ok(moduleArgument, 'usage: driver.cjs module.js [--require-invoke] [--expect-ctor]');
  assert.ok(options.every(option => option === '--require-invoke' || option === '--expect-ctor'), 'unknown driver arguments');
  assert.equal(new Set(options).size, options.length, 'duplicate driver arguments');
  const expectCtor = options.includes('--expect-ctor');
  evidence.expectCtor = expectCtor;
  const modulePath = path.resolve(moduleArgument);
  assert.ok(modulePath.endsWith('.js'), 'expected the generated CommonJS .js file');
  const wasmPath = modulePath.slice(0, -3) + '.wasm';
  evidence.imports = importDescriptors(fs.readFileSync(wasmPath));
  evidence.invokeImports = evidence.imports.filter(item => item.kind === 0 && item.name.startsWith('invoke_'));
  assert.ok(evidence.imports.some(item => item.kind === 0 && item.name === 'jspi_fixture_yield'), 'yield import missing');
  if (options.includes('--require-invoke')) {
    assert.ok(evidence.invokeImports.some(item => item.name === 'invoke_ii'), 'JS-EH fixture must actually import invoke_ii');
  }
  assert.equal(typeof WebAssembly.Suspending, 'function', 'JSPI WebAssembly.Suspending unavailable');
  assert.equal(typeof WebAssembly.promising, 'function', 'JSPI WebAssembly.promising unavailable');
  const factory = require(modulePath);
  assert.equal(typeof factory, 'function', 'expected MODULARIZE factory');

  let returnedToHost = false;
  let mainSettled = false;
  const yields = [];
  const wakes = [];
  let rejectCallback;
  const callbackFailure = new Promise((_, reject) => { rejectCallback = reject; });
  const engine = await factory({
    noInitialRun: true,
    print(line) { evidence.stdout.push(String(line)); evidence.events.push(`stdout:${line}`); },
    printErr(line) { evidence.stderr.push(String(line)); },
    onAbort(reason) { evidence.abort = String(reason); },
    onExit(status) { evidence.exitCallbackStatus = status; },
    fixtureYield(mode, wakeUp) {
      assert.equal(mode, yields.length + 1, 'unexpected yield order');
      assert.ok(mode === 1 || mode === 2, 'unexpected extra yield');
      yields.push(mode);
      evidence.events.push(`yield:${mode}`);
      const timer = setTimeout(() => {
        timers.delete(timer);
        try {
          assert.ok(returnedToHost, 'wakeup ran before callMain returned');
          assert.equal(mainSettled, false, 'main settled before its deferred wakeup');
          wakes.push(mode);
          evidence.events.push(`wake:${mode}`);
          wakeUp(100 + mode);
        } catch (error) {
          evidence.callbackError = String(error);
          rejectCallback(error);
        }
      }, 10);
      timers.add(timer);
    }
  });
  assert.equal(yields.length, 0, 'factory must not start main');
  assert.deepEqual(evidence.stdout, expectCtor ? ['FIXTURE CTOR value=73'] : [], 'unexpected output during factory initialization');
  evidence.events.push('main-call');
  const lifetime = engine.callMain([]);
  assert.ok(lifetime && typeof lifetime.then === 'function', 'callMain must return a Promise');
  returnedToHost = true;
  evidence.events.push('main-return');
  const tracked = lifetime.then(status => {
    mainSettled = true;
    evidence.events.push(`main-resolved:${status}`);
    return status;
  }, error => { mainSettled = true; throw error; });
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error('fixture main did not settle within 10 seconds')), 10000);
  });
  evidence.mainStatus = await Promise.race([tracked, callbackFailure, deadline]);
  assert.equal(evidence.mainStatus, 0, 'main must resolve numeric zero');
  assert.deepEqual(yields, [1, 2], 'expected two genuine suspensions');
  assert.deepEqual(wakes, [1, 2], 'expected two deferred wakeups');
  assert.deepEqual(evidence.events, [
    ...(expectCtor ? ['stdout:FIXTURE CTOR value=73'] : []),
    'main-call', 'stdout:FIXTURE START', 'yield:1', 'main-return', 'wake:1',
    'stdout:FIXTURE RETURN value=101', 'yield:2', 'wake:2',
    'stdout:FIXTURE CATCH value=102', 'stdout:FIXTURE PASS', 'main-resolved:0'
  ], 'return/catch/suspension event sequence changed');
  return { ...evidence, status: 'pass' };
}

run().then(result => {
  console.log(JSON.stringify(result, null, 2));
}, error => {
  process.exitCode = 1;
  console.log(JSON.stringify({ ...evidence, status: 'fail', error: String(error), stack: error?.stack }, null, 2));
}).finally(() => {
  clearTimeout(timeout);
  for (const timer of timers) clearTimeout(timer);
});
