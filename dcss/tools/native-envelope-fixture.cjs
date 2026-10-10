// Optional actual Rust native-envelope witnesses for full-core diagnostics.
// Importing this file does not instantiate WASM; root schedules invocation.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const UPSTREAM = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const ABI = 1;
function checksum(payload) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of Buffer.from(payload, 'utf8')) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
}
function inspectEnvelope(save) {
  const envelope = JSON.parse(save);
  assert.equal(envelope.format, 'dcss-rust-boundary'); assert.equal(envelope.abi, ABI);
  assert.equal(envelope.upstream, UPSTREAM);
  assert([1, 2].includes(envelope.version), 'Only exact native v1/v2 envelopes are supported');
  assert.equal(envelope.kind, 'native-dcss-file-set-v' + envelope.version);
  assert.equal(envelope.checksum, checksum(envelope.payload));
  return envelope;
}
function legacyEnvelope(files) {
  const payload = JSON.stringify({ files });
  return JSON.stringify({ format: 'dcss-rust-boundary', version: 1, abi: ABI,
    upstream: UPSTREAM, kind: 'native-dcss-file-set-v1', checksum: checksum(payload), payload });
}
async function createNativeEnvelopeFixture(gameRoot) {
  const source = path.resolve(process.env.DCSS_BOUNDARY_WASM || path.join(gameRoot, 'build/boundary.wasm'));
  const bytes = fs.readFileSync(source);
  const identity = { path: source, bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  const instance = (await WebAssembly.instantiate(bytes, {})).instance.exports;
  for (const name of ['dcss_allocate', 'dcss_request', 'dcss_release']) assert.equal(typeof instance[name], 'function');
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
  function call(command) {
    const inputBytes = encoder.encode(JSON.stringify({ language: 'ja', ...command }));
    const input = instance.dcss_allocate(inputBytes.length);
    assert(input, 'Rust request allocation failed');
    let output = 0, length = 0;
    try {
      new Uint8Array(instance.memory.buffer, input, inputBytes.length).set(inputBytes);
      const packet = instance.dcss_request(input, inputBytes.length);
      assert.equal(typeof packet, 'bigint');
      output = Number(packet & 0xffffffffn); length = Number(packet >> 32n);
      assert(output && length);
      const response = JSON.parse(decoder.decode(new Uint8Array(instance.memory.buffer, output, length)));
      assert.equal(response.ok, true, JSON.stringify(response.value));
      return response.value;
    } finally {
      instance.dcss_release(input, inputBytes.length);
      if (output && length) instance.dcss_release(output, length);
    }
  }
  function unpack(save) {
    const envelope = inspectEnvelope(save);
    const native = call({ op: 'unpack_native', save });
    if (envelope.version === 1) assert(native.semantic == null, 'Legacy native v1 must import with empty history');
    return native;
  }
  function verify(files, events = []) {
    const portableFiles = files.map(file => {
      assert(file.path.startsWith('/persist/'));
      return { path: file.path.slice('/persist/'.length), bytes: Array.from(file.bytes) };
    });
    const semantic = { version: 1, upstream: UPSTREAM, session: '1',
      events: events.slice(-200).map(event => ({ session: '1', event: JSON.parse(JSON.stringify(event)) })) };
    const v2 = call({ op: 'pack_native', files: portableFiles, semantic }).save;
    assert.equal(inspectEnvelope(v2).version, 2, 'New pack_native must actually emit v2');
    const current = unpack(v2);
    assert.deepEqual(current.files, portableFiles); assert.deepEqual(current.semantic, semantic);
    const v1 = legacyEnvelope(portableFiles);
    const legacy = unpack(v1);
    assert.deepEqual(legacy.files, portableFiles);
    return { v1, v2, receipt: { pass: true, actualRustExecuted: true,
      boundary: identity, supportedNativeVersions: [1, 2],
      legacyHistoryEmpty: true, nativeBytesPreserved: true,
      nativeFiles: portableFiles.map(file => ({ path: file.path, bytes: file.bytes.length,
        sha256: crypto.createHash('sha256').update(Buffer.from(file.bytes)).digest('hex') })),
      semanticEvents: semantic.events.length, engineCommandsIssued: 0 } };
  }
  return { identity, unpack, verify };
}
module.exports = { createNativeEnvelopeFixture, inspectEnvelope, legacyEnvelope };
