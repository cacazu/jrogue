// SPDX-License-Identifier: GPL-3.0-or-later
// Prepare fresh derived catalogue JSON with bounded streaming of the base.
// Never copy/parse the whole original registry or media archive into memory.
import crypto from 'node:crypto';

const body = value => {
  const text = JSON.stringify(value);
  if (text[0] === '{' || text[0] === '[') return text.slice(1, -1);
  throw Error('An object or array insertion is required');
};

// insertions: { root?: object, entries?: object, routes?: array }
// Source bytes must match a reviewed expectedHash before a caller publishes
// the temporary output. SHA mismatch throws; the caller keeps it unselected.
export async function streamMergeJson(input, consume, insertions, expectedHash) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash ?? '') || typeof consume !== 'function') throw Error('Reviewed SHA/consumer required');
  const insertBodies = Object.fromEntries(Object.entries(insertions).map(([key, value]) => [key, body(value)]));
  if (Object.keys(insertBodies).some(key => !['root', 'entries', 'routes'].includes(key))) throw Error('Unsupported insertion target');
  const sourceHash = crypto.createHash('sha256'), outputHash = crypto.createHash('sha256');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let sourceBytes = 0, outputBytes = 0, inString = false, escaped = false, keyString = '', capturingKey = false;
  let rootExpectKey = false, rootKey = null, rootSeen = false, rootClosed = false;
  const stack = [], inserted = new Set();
  async function emit(text) {
    if (!text) return;
    const bytes = Buffer.from(text, 'utf8'); outputHash.update(bytes); outputBytes += bytes.length; await consume(bytes);
  }
  async function processText(text) {
    let copiedFrom = 0;
    for (let i = 0; i < text.length; i++) {
      const character = text[i];
      if (inString) {
        if (capturingKey) {
          keyString += character;
          // Existing source-semantic IDs include a 2,152-character narrative slug.
          // Keep bounded key buffering while admitting the verified base catalogue.
          if (keyString.length > 4096) throw Error('Unexpected oversized root JSON key');
        }
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') {
          inString = false;
          if (capturingKey) { rootKey = JSON.parse(keyString); capturingKey = false; rootExpectKey = false; keyString = ''; }
        }
        continue;
      }
      if (/[ \t\r\n]/.test(character)) continue;
      if (rootClosed) throw Error('Unexpected trailing source data');
      const current = stack.at(-1);
      if (character === '"') {
        if (!current) throw Error('Root JSON object required');
        current.nonempty = true; inString = true; escaped = false;
        if (stack.length === 1 && rootExpectKey) { capturingKey = true; keyString = '"'; }
        continue;
      }
      if (character === '{' || character === '[') {
        if (!current) {
          if (rootSeen || character !== '{') throw Error('One root JSON object required');
          rootSeen = true; rootExpectKey = true; stack.push({ type: '{', target: 'root', nonempty: false });
        } else {
          current.nonempty = true;
          const target = stack.length === 1 && ['entries', 'routes'].includes(rootKey) ? rootKey : null;
          if (target === 'entries' && character !== '{' || target === 'routes' && character !== '[') throw Error('Wrong registry insertion container');
          stack.push({ type: character, target, nonempty: false });
          if (stack.length > 256) throw Error('Source JSON depth limit');
        }
        continue;
      }
      if (character === '}' || character === ']') {
        if (!current || current.type !== (character === '}' ? '{' : '[')) throw Error('Mismatched source JSON delimiter');
        if (current.target && Object.hasOwn(insertBodies, current.target)) {
          if (inserted.has(current.target)) throw Error('Duplicate source insertion container');
          const insertion = insertBodies[current.target];
          await emit(text.slice(copiedFrom, i));
          await emit((current.nonempty && insertion ? ',' : '') + insertion);
          copiedFrom = i; inserted.add(current.target);
        }
        stack.pop(); if (!stack.length) rootClosed = true;
        continue;
      }
      if (stack.length === 1 && character === ',') { rootExpectKey = true; rootKey = null; }
      if (current && character !== ',' && character !== ':') current.nonempty = true;
    }
    await emit(text.slice(copiedFrom));
  }
  for await (const chunk of input) {
    const bytes = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk);
    sourceHash.update(bytes); sourceBytes += bytes.length;
    await processText(decoder.decode(bytes, { stream: true }));
  }
  await processText(decoder.decode());
  if (!rootClosed || inString || stack.length || !rootSeen || inserted.size !== Object.keys(insertBodies).length) throw Error('Missing/incomplete source insertion containers');
  const sourceSha256 = sourceHash.digest('hex');
  if (sourceSha256 !== expectedHash) throw Error('Reviewed base SHA mismatch');
  return { source_bytes: sourceBytes, source_sha256: sourceSha256, output_bytes: outputBytes, output_sha256: outputHash.digest('hex'), insertions: [...inserted] };
}
