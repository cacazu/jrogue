// Pure JavaScript transport checks. No WebAssembly executable is created or run.
// The only WebAssembly memory objects below are fixed 64 KiB byte buffers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const expectedHostSha = process.argv[2];
if (!/^[a-f0-9]{64}$/.test(expectedHostSha ?? '') || process.argv.length !== 3) {
  throw new Error('Require exactly one reviewed host SHA-256 argument');
}
const hostUrl = new URL('./host.mjs', import.meta.url);
const reportUrl = new URL('./TRANSPORT-SOURCE-CHECKS.json', import.meta.url);
const sourceUrl = new URL('./test-transport.mjs', import.meta.url);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pin = url => { const bytes = fs.readFileSync(url); return { path:fileURLToPath(url), bytes:bytes.length, sha256:sha(bytes) }; };
const protectedExpected = [
  ['./SOURCE-DESIGN.json', 'f93fd492e75b69de0d83d29a1a93f799cedfdca763e1377d6733c15b98807e0d'],
  ['./V2-IDENTITY-CHECKS.json', 'cb45c829008c25bccc779e909339c29b6115b99995a9ff55bd6ba42a8bb0c50d'],
  ['../ORIGINAL-CONTEXT-VERIFICATION.json', 'dbc812584b6d7bd26e3e752be84dada30ddf1851b7b4daa88f7736844356fd53'],
  ['../ORIGINAL-CONTEXT-RUST-VERIFICATION.json', 'c6e26b1b161428d0c3743895421fcf888af67fea39f63ae266590d03c4903d00'],
];
const hostBefore = pin(hostUrl);
assert.equal(hostBefore.sha256, expectedHostSha, 'reviewed host source before import');
const protectedBefore = protectedExpected.map(([path, expected]) => {
  const row = pin(new URL(path, import.meta.url));
  assert.equal(row.sha256, expected, `preserved proof ${path}`);
  return row;
});
const { createNativeTransfer, createBrowserInputHost, MAX_BYTES, MAX_FIELD_BYTES } = await import(hostUrl.href);
const checks = [];
function check(name, test) {
  try { test(); checks.push({ name, status:'passed' }); }
  catch (error) { checks.push({ name, status:'failed', error:String(error), stack:error.stack }); }
}
const identity = 'cdda-authoritative-observers-cosmetic-v2-e3ff38d8bc59cf07ddbb48ce-sdk6.0.8';
const memory = () => new WebAssembly.Memory({ initial:1, maximum:1 });
const vector = [3, 17, 127, 251];
function fixture() {
  const state = {
    handle:7, address:256, size:vector.length,
    pinError:null, dataError:null, sizeError:null, releaseError:null,
    dataHook:null, releaseHook:null,
    calls:{ pin:[], data:[], size:[], release:[] },
  };
  let rustMemory = memory();
  const native = {
    HEAPU8:new Uint8Array(new ArrayBuffer(65536)),
    _cdda_browser_snapshot_pin(kind) {
      state.calls.pin.push(kind);
      if (state.pinError) throw state.pinError;
      return state.handle;
    },
    _cdda_browser_snapshot_data(handle) {
      state.calls.data.push(handle);
      state.dataHook?.();
      if (state.dataError) throw state.dataError;
      return state.address;
    },
    _cdda_browser_snapshot_size(handle) {
      state.calls.size.push(handle);
      if (state.sizeError) throw state.sizeError;
      return state.size;
    },
    _cdda_browser_snapshot_release(handle) {
      state.calls.release.push(handle);
      state.releaseHook?.(handle);
      if (state.releaseError) throw state.releaseError;
    },
  };
  native.HEAPU8.set(vector, state.address);
  const transfer = createNativeTransfer(native, () => rustMemory);
  return { state, native, transfer, get memory() { return rustMemory; }, setMemory(value) { rustMemory=value; } };
}
function pinned(f, body) {
  const handle=f.transfer.imports.snapshot_pin(1);
  assert.notEqual(handle, 0);
  try { return body(handle); }
  finally { f.transfer.releaseAll(); }
}

check('six exact production transport imports and fixed byte-buffer memory', () => {
  const f=fixture();
  assert.deepEqual(Object.keys(f.transfer.imports).sort(), ['copy_to_rust','native_heap_length','snapshot_data','snapshot_pin','snapshot_release','snapshot_size']);
  assert.equal(f.memory.buffer.byteLength,65536);
  assert.equal(f.native.HEAPU8.length,65536);
  assert(Object.isFrozen(f.transfer.imports));
  assert.equal(MAX_BYTES,262144); assert.equal(MAX_FIELD_BYTES,16384);
});
check('actual transfer helpers copy owned bytes and release the actual tracked fixture pin', () => {
  const f=fixture();
  pinned(f, handle => {
    assert.equal(f.transfer.heldCount(),1);
    const address=f.transfer.imports.snapshot_data(handle);
    const size=f.transfer.imports.snapshot_size(handle);
    assert.equal(f.transfer.imports.native_heap_length(),65536n);
    assert.equal(f.transfer.imports.copy_to_rust(address,512,size),4);
    assert.deepEqual([...new Uint8Array(f.memory.buffer,512,4)],vector);
    f.native.HEAPU8.fill(0,address,address+size);
    assert.deepEqual([...new Uint8Array(f.memory.buffer,512,4)],vector);
  });
  assert.equal(f.transfer.heldCount(),0);
  assert.deepEqual(f.state.calls.release,[7]);
  f.transfer.imports.snapshot_release(7);
  assert.deepEqual(f.state.calls.release,[7]);
});
check('copy refreshes native heap after a native export replaces it', () => {
  const f=fixture();
  const replacement=[11,29,53,199];
  f.state.dataHook=()=>{ f.native.HEAPU8=new Uint8Array(new ArrayBuffer(65536)); f.native.HEAPU8.set(replacement,256); };
  pinned(f, handle => {
    const address=f.transfer.imports.snapshot_data(handle);
    assert.equal(f.transfer.imports.copy_to_rust(address,512,4),4);
    assert.deepEqual([...new Uint8Array(f.memory.buffer,512,4)],replacement);
  });
});
check('copy refreshes actual Rust memory reference at the copy boundary', () => {
  const f=fixture(), old=f.memory, replacement=memory();
  pinned(f, handle => {
    const address=f.transfer.imports.snapshot_data(handle);
    f.setMemory(replacement);
    assert.equal(f.transfer.imports.copy_to_rust(address,512,4),4);
    assert.deepEqual([...new Uint8Array(replacement.buffer,512,4)],vector);
    assert.deepEqual([...new Uint8Array(old.buffer,512,4)],[0,0,0,0]);
  });
});
for (const [name,address,destination,length] of [
  ['native zero pointer',0,512,4],
  ['native pointer exactly at end',65536,512,4],
  ['native end overflow',65534,512,4],
  ['native unsigned address maximum',0xffffffff,512,4],
  ['native signed maximum encoding',-1,512,4],
  ['zero byte length',256,512,0],
  ['native ingress cap exceeded',256,512,262145],
  ['Rust zero pointer',256,0,4],
  ['Rust pointer exactly at end',256,65536,4],
  ['Rust end overflow',256,65534,4],
  ['Rust unsigned address maximum',256,0xffffffff,4],
  ['nonintegral WASM address',256.5,512,4],
  ['address beyond WASM32',0x100000000,512,4],
]) {
  check(`bounded copy rejects ${name} and finally releases owned pin`, () => {
    const f=fixture();
    pinned(f, () => {
      assert.equal(f.transfer.imports.copy_to_rust(address,destination,length),0);
      assert(f.transfer.failure());
      assert.equal(new Uint8Array(f.memory.buffer).some(byte=>byte!==0),false);
    });
    assert.equal(f.transfer.heldCount(),0);
    assert.deepEqual(f.state.calls.release,[7]);
  });
}
check('non-native heap view rejected by heap length and copy', () => {
  const f=fixture();
  pinned(f, () => {
    f.native.HEAPU8=new Uint8ClampedArray(65536);
    assert.equal(f.transfer.imports.native_heap_length(),0n);
    assert.equal(f.transfer.imports.copy_to_rust(256,512,4),0);
    assert.match(f.transfer.failure(),/current native heap/);
  });
});
check('copy rejects a fake Rust memory object', () => {
  const f=fixture();
  pinned(f, () => {
    f.setMemory({buffer:new ArrayBuffer(65536)});
    assert.equal(f.transfer.imports.copy_to_rust(256,512,4),0);
    assert.match(f.transfer.failure(),/unshared Rust memory required/);
  });
});
check('copy rejects shared Rust memory', () => {
  const f=fixture();
  const shared=new WebAssembly.Memory({initial:1,maximum:1,shared:true});
  assert.equal(shared.buffer.byteLength,65536);
  pinned(f, () => {
    f.setMemory(shared);
    assert.equal(f.transfer.imports.copy_to_rust(256,512,4),0);
    assert.match(f.transfer.failure(),/unshared Rust memory required/);
  });
});
check('unsupported notice kind never invokes native pin', () => {
  const f=fixture();
  assert.equal(f.transfer.imports.snapshot_pin(2),0);
  assert.deepEqual(f.state.calls.pin,[]);
  assert.equal(f.transfer.heldCount(),0);
});
check('zero native handle creates no ownership or release call', () => {
  const f=fixture(); f.state.handle=0;
  assert.equal(f.transfer.imports.snapshot_pin(1),0);
  f.transfer.releaseAll();
  assert.equal(f.transfer.heldCount(),0);
  assert.deepEqual(f.state.calls.release,[]);
});
check('unowned handles never reach native data size or release', () => {
  const f=fixture();
  assert.equal(f.transfer.imports.snapshot_data(91),0);
  assert.equal(f.transfer.imports.snapshot_size(91),0);
  f.transfer.imports.snapshot_release(91);
  assert.deepEqual(f.state.calls.data,[]);
  assert.deepEqual(f.state.calls.size,[]);
  assert.deepEqual(f.state.calls.release,[]);
  assert.equal(f.transfer.heldCount(),0);
});
check('signed WASM return word normalizes to exact unsigned owned handle', () => {
  const f=fixture(); f.state.handle=-1;
  pinned(f,handle=>{
    assert.equal(handle,0xffffffff);
    assert.equal(f.transfer.imports.snapshot_data(-1),256);
  });
  assert.deepEqual(f.state.calls.data,[0xffffffff]);
  assert.deepEqual(f.state.calls.release,[0xffffffff]);
});
check('duplicate native handle retains one owned pin and records failure', () => {
  const f=fixture();
  pinned(f, () => {
    assert.equal(f.transfer.imports.snapshot_pin(1),0);
    assert.equal(f.transfer.heldCount(),1);
    assert.match(f.transfer.failure(),/duplicate native pin/);
  });
  assert.deepEqual(f.state.calls.release,[7]);
});
for (const target of ['pin','data','size']) {
  check(`ordinary synthetic native ${target} exception records failure with owned cleanup`, () => {
    const f=fixture(); f.state[`${target}Error`]=new Error(`synthetic ${target} failure`);
    if (target==='pin') {
      assert.equal(f.transfer.imports.snapshot_pin(1),0);
      f.transfer.releaseAll();
      assert.deepEqual(f.state.calls.release,[]);
    } else {
      pinned(f,handle=>assert.equal(f.transfer.imports[`snapshot_${target}`](handle),0));
      assert.deepEqual(f.state.calls.release,[7]);
    }
    assert.match(f.transfer.failure(),new RegExp(`synthetic ${target} failure`));
    assert.equal(f.transfer.trap(),null);
    assert.equal(f.transfer.heldCount(),0);
  });
}
check('synthetic RuntimeError is retained exactly and cleanup releases only tracked handle', () => {
  const f=fixture(), simulated=new WebAssembly.RuntimeError('synthetic error object; no WASM code ran');
  f.state.dataError=simulated;
  pinned(f,handle=>{
    assert.equal(f.transfer.imports.snapshot_data(handle),0);
    assert.equal(f.transfer.trap(),simulated);
  });
  assert.equal(f.transfer.heldCount(),0);
  assert.deepEqual(f.state.calls.release,[7]);
  f.transfer.clearFailure();
  assert.equal(f.transfer.failure(),null); assert.equal(f.transfer.trap(),null);
});
check('ordinary fixture-body exception runs finally cleanup without treating error as a WASM trap', () => {
  const f=fixture();
  assert.throws(()=>pinned(f,()=>{throw new Error('synthetic body failure');}),/synthetic body failure/);
  assert.equal(f.transfer.heldCount(),0);
  assert.deepEqual(f.state.calls.release,[7]);
  assert.equal(f.transfer.trap(),null);
});
check('release failure remains owned until a successful synthetic cleanup call', () => {
  const f=fixture();
  assert.equal(f.transfer.imports.snapshot_pin(1),7);
  f.state.releaseError=new Error('synthetic release failure');
  f.transfer.imports.snapshot_release(7);
  assert.equal(f.transfer.heldCount(),1);
  assert.match(f.transfer.failure(),/synthetic release failure/);
  assert.throws(()=>f.transfer.releaseAll(),/native release unresolved/);
  assert.equal(f.transfer.heldCount(),1);
  assert.deepEqual(f.state.calls.release,[7,7]);
  f.state.releaseError=null;
  f.transfer.releaseAll();
  assert.equal(f.transfer.heldCount(),0);
  assert.deepEqual(f.state.calls.release,[7,7,7]);
});
check('synthetic release RuntimeError remains tracked and preserves exact error object', () => {
  const f=fixture(), simulated=new WebAssembly.RuntimeError('synthetic release error object');
  assert.equal(f.transfer.imports.snapshot_pin(1),7);
  f.state.releaseError=simulated;
  f.transfer.imports.snapshot_release(7);
  assert.equal(f.transfer.trap(),simulated); assert.equal(f.transfer.heldCount(),1);
  f.state.releaseError=null; f.transfer.releaseAll();
  assert.equal(f.transfer.heldCount(),0);
});
check('recursive release cannot release the same owned handle twice', () => {
  const f=fixture();
  f.state.releaseHook=handle=>f.transfer.imports.snapshot_release(handle);
  pinned(f,()=>{});
  assert.deepEqual(f.state.calls.release,[7]);
  assert.equal(f.transfer.heldCount(),0);
});
check('strict trusted identity rejects lone UTF-16 surrogates before any native calls', () => {
  const f=fixture();
  for(const value of ['\ud800','\udfff','build-\ud800-end']) {
    assert.throws(()=>createBrowserInputHost({nativeModule:f.native,expectedBuildId:value}),/expected strict UTF-8 identity/);
  }
  assert.deepEqual(f.state.calls.pin,[]);
});
check('trusted identity requires nonempty bounded explicit string', () => {
  const f=fixture();
  for(const value of ['', 'x'.repeat(16385)]) assert.throws(()=>createBrowserInputHost({nativeModule:f.native,expectedBuildId:value}),/expected strict UTF-8 identity/);
  for(const value of [null,undefined,17,new String(identity)]) assert.throws(()=>createBrowserInputHost({nativeModule:f.native,expectedBuildId:value}),/expected host identity/);
  for(const value of [identity,'x'.repeat(16384),'\ufeff'+identity,'\u{1f642}']) {
    const host=createBrowserInputHost({nativeModule:f.native,expectedBuildId:value});
    assert.equal(host.status().attached,false);
    assert.equal(host.status().commandAuthorization,'Denied(UntrackedNativeReaders)');
  }
});
check('plain fake Rust instance is rejected before supplied fake exports are called', () => {
  const f=fixture(), host=createBrowserInputHost({nativeModule:f.native,expectedBuildId:identity});
  let accessed=false;
  const fake={get exports(){accessed=true;throw new Error('fake exports must not be read');}};
  assert.throws(()=>host.attach(fake),/one actual WASM instance required/);
  assert.equal(accessed,false);
  assert.equal(host.status().attached,false);
  assert.equal(host.status().receiving,false);
  assert.deepEqual(f.state.calls.pin,[]);
});
check('prototype forgery cannot satisfy the actual WebAssembly instance exports brand', () => {
  const f=fixture(), host=createBrowserInputHost({nativeModule:f.native,expectedBuildId:identity});
  const fake=Object.create(WebAssembly.Instance.prototype);
  assert.throws(()=>host.attach(fake),TypeError);
  assert.equal(host.status().attached,false);
  assert.equal(host.status().receiving,false);
  assert.deepEqual(f.state.calls.pin,[]);
});
check('unattached receive raw and invalidate calls fail closed without native activity', () => {
  const f=fixture(), host=createBrowserInputHost({nativeModule:f.native,expectedBuildId:identity});
  assert.throws(()=>host.receive(1,1,0,0),/actual Rust WASM unavailable/);
  assert.throws(()=>host.preserveRawUtf8(new Uint8Array(vector)),/actual Rust WASM unavailable/);
  assert.throws(()=>host.invalidate(),/actual Rust WASM unavailable/);
  assert.deepEqual(f.state.calls.pin,[]);
  assert.deepEqual(f.state.calls.release,[]);
  assert.deepEqual(host.status(),{attached:false,poisoned:false,receiving:false,heldNativePins:0,commandAuthorization:'Denied(UntrackedNativeReaders)'});
});

const hostAfter=pin(hostUrl);
const protectedAfter=protectedExpected.map(([path])=>pin(new URL(path,import.meta.url)));
check('reviewed host and four preserved proof artifacts unchanged through tests', () => {
  assert.deepEqual(hostAfter,hostBefore);
  assert.deepEqual(protectedAfter,protectedBefore);
});
const passed=checks.every(row=>row.status==='passed');
const report={
  schema_version:1,
  status:passed?'passed':'failed',
  run_kind:'pure_node_javascript_transport_with_transparent_fixtures',
  node:{version:process.version,execPath:process.execPath,platform:process.platform,architecture:process.arch},
  invocation:{source:fileURLToPath(sourceUrl),expectedHostSha256:expectedHostSha},
  hostBefore,hostAfter,testSource:pin(sourceUrl),protectedBefore,protectedAfter,
  checkCount:checks.length,passedCount:checks.filter(row=>row.status==='passed').length,checks,
  scope:{
    actualNodeJavaScriptExecuted:true,
    syntheticNativeExports:true,
    syntheticRuntimeErrorObjects:true,
    WebAssemblyMemoryUsedOnlyAs64KiBByteBuffer:true,
    actualRustWasmParserExecuted:false,
    actualOriginalClassExecuted:false,
    actualWasmCodeCompiled:false,
    actualWasmCodeExecuted:false,
    actualWasmTrapsExecuted:false,
    actualRustPinGuardExecuted:false,
    actualBrowserExecuted:false,
    actualRuntimeQuarantineExecuted:false,
    nativeSnapshotPacketsBuilt:0,
    nativeToolchainOrCargoLaunched:false,
    commandAuthorizationProved:false,
  },
  limits:[
    'High-level attachment, Rust parser/lifecycle, immutable Rust initialization, typed Rust responses, and real trap quarantine require the separately authorized actual Rust WASM window.',
    'The synthetic callbacks model native exports solely for the JavaScript ownership/copy boundary; no original class or native snapshot producer executed.',
    'Repeated synthetic cleanup in the release-failure check is not a compiler, native job, or functional-window retry.',
    'Raw UTF-8 accepted after actual Rust attachment and original SDL/raw-event integration remain separate acceptance prerequisites.',
  ],
};
fs.writeFileSync(reportUrl,JSON.stringify(report,null,2)+'\n',{encoding:'utf8'});
console.log(JSON.stringify({status:report.status,checkCount:report.checkCount,passedCount:report.passedCount,hostSha256:hostBefore.sha256,reportSha256:pin(reportUrl).sha256,scope:report.scope}));
if(!passed) process.exitCode=1;
