import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';

// A guarded owner must establish process execution and source/artifact identity.
// This verifier establishes complete captured-stream equality only.
const args = process.argv.slice(2);
if (args.length !== 3) {
  throw new Error('usage: node verify-streams.mjs EXPECTED CPP_STDOUT RUST_STDOUT');
}
const maxBytes = 65_536;
function captured(path) {
  const size = statSync(path).size;
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
    throw new Error(`invalid captured stream size: ${path}`);
  }
  const raw = readFileSync(path);
  if (raw.length !== size || (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf)) {
    throw new Error(`changed or BOM-prefixed stream: ${path}`);
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  if (!text.endsWith('\n')) throw new Error(`missing final newline: ${path}`);
  if (text.includes('\r') && /(?<!\r)\n/.test(text)) {
    throw new Error(`mixed newline conventions: ${path}`);
  }
  const normalized = text.replaceAll('\r\n', '\n');
  if (normalized.includes('\r')) throw new Error(`bare carriage return: ${path}`);
  return {
    path,
    bytes: raw.length,
    sha256: createHash('sha256').update(raw).digest('hex'),
    normalized,
  };
}
const [expected, cpp, rust] = args.map(captured);
const lines = expected.normalized.slice(0, -1).split('\n');
if (lines.length !== 23 || lines.at(-1) !== '{"summary":true,"checks":23,"failed":0}') {
  throw new Error('the expected packet is not the frozen 22-record/23-check stream');
}
for (const result of [cpp, rust]) {
  if (result.normalized !== expected.normalized) {
    throw new Error(`complete stream differs from expected: ${result.path}`);
  }
}
if (cpp.normalized !== rust.normalized) throw new Error('C++ and Rust streams differ');
console.log(JSON.stringify({
  status: 'captured-stream-equality-pass',
  records: 22,
  checks: 23,
  exactWholeStreams: true,
  newlineNormalization: 'uniform LF or CRLF only',
  executionEstablishedByThisVerifier: false,
  streams: [expected, cpp, rust].map(({ normalized, ...pin }) => pin),
}));
