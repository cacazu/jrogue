// Versioned, owned browser transport. Gameplay and normalization remain native.
export const LEGACY_MAX_ENVELOPE_BYTES = 36_700_381;
export const MAX_ENVELOPE_BYTES = 40 * 1024 * 1024;
export const MAX_ENVIRONMENT_BYTES = 4 * 1024 * 1024;
export const MAX_CONTEXT_BYTES = 8 * 1024 * 1024;
export const MAX_TEXT_BYTES = 65536;
export const MAX_PENDING = 256;
export const EVENT_WORDS = 16;
export const MUTABLE_ROOTS = ['/data/user', '/data/save', '/data/panic', '/data/scores', '/tmp', '/home'];
const utf8 = new TextEncoder();
const strictUtf8 = new TextDecoder('utf-8', {fatal: true});
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const uint = (value, max = 0xffffffff) => Number.isInteger(value) && value >= 0 && value <= max;
export function envelopeVersion(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 10 ||
      String.fromCharCode(...bytes.subarray(0, 8)) !== 'ABRSAVE\0') throw new Error('save.invalid');
  const version = bytes[8] | bytes[9] << 8;
  if (![1, 2, 3].includes(version) || bytes.length > (version === 3 ? MAX_ENVELOPE_BYTES : LEGACY_MAX_ENVELOPE_BYTES))
    throw new Error('save.invalid');
  return version;
}
export function replayIdentity(manifest) {
  if (!exact(manifest?.replayIdentity, ['engine', 'data', 'input', 'semantic'])) throw new Error('save.identity_missing');
  const bytes = new Uint8Array(128);
  ['engine', 'data', 'input', 'semantic'].forEach((key, index) => {
    const digest = manifest.replayIdentity[key];
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/i.test(digest)) throw new Error('save.identity_missing');
    for (let i = 0; i < 32; i++) bytes[index * 32 + i] = parseInt(digest.slice(i * 2, i * 2 + 2), 16);
  });
  return bytes;
}
function command(code, mods) {
  if (!uint(code, 0x10ffff) || !code || (code >= 0xd800 && code <= 0xdfff) || !uint(mods, 31)) return false;
  let normalizedCode = code, normalizedMods = mods;
  if (!(mods & 16)) {
    if ((mods & 1) && ((code >= 0x40 && code <= 0x5f) || (code >= 0x61 && code <= 0x7a))) {
      normalizedCode &= 31; normalizedMods &= ~1;
    }
    if (normalizedCode >= 1 && normalizedCode <= 31) normalizedMods &= ~1;
    if ((normalizedCode >= 0x21 && normalizedCode <= 0x2f) || (normalizedCode >= 0x3a && normalizedCode <= 0x60) ||
        (normalizedCode >= 0x7b && normalizedCode <= 0x7e)) normalizedMods &= ~2;
  }
  return normalizedCode === code && normalizedMods === mods;
}
export function validPacket(value, queued = true) {
  if ((!Array.isArray(value) && !(value instanceof Uint32Array)) || value.length !== EVENT_WORDS ||
      !Array.from(value).every(v => uint(v)) || value.slice(13).some(v => v)) return false;
  const [kind, code, mods, x, y, button, width, height, origin, low, high, index, count] = value;
  if (origin > 3 || (origin < 2 && (low || high || index || count)) ||
      (origin >= 2 && (!(low || high) || !count || count > 65536 || index >= count))) return false;
  if (kind === 0) return !queued && value.every(v => v === 0);
  if (kind === 1 || kind === 4) return command(code, mods) && ![x, y, button, width, height].some(Boolean);
  if (kind === 2) return !code && mods <= 15 && x <= 255 && y <= 255 && button <= 15 && !width && !height && origin < 2;
  return kind === 3 && ![code, mods, x, y, button].some(Boolean) && !origin && width >= 1 && width <= 255 && height >= 1 && height <= 255;
}
export function keyPacket(packed, touch = false) {
  if (!uint(packed, (1 << 26) - 1)) throw new Error('input.rejected');
  const words = new Uint32Array(EVENT_WORDS);
  words[0] = 1; words[1] = packed & 0x1fffff; words[2] = packed >>> 21; words[8] = touch ? 1 : 0;
  if (!validPacket(words)) throw new Error('input.rejected');
  return words;
}
export function nativePacket(event) {
  const words = new Uint32Array(EVENT_WORDS);
  if (exact(event, ['kind', 'x', 'y', 'button', 'mods']) && event.kind === 'mouse') {
    if (![event.x, event.y, event.button, event.mods].every(v => uint(v))) throw new Error('input.rejected');
    words[0] = 2; words[2] = event.mods; words[3] = event.x; words[4] = event.y; words[5] = event.button;
  } else if (exact(event, ['kind', 'width', 'height']) && event.kind === 'resize') {
    if (![event.width, event.height].every(v => uint(v))) throw new Error('input.rejected');
    words[0] = 3; words[6] = event.width; words[7] = event.height;
  } else throw new Error('input.rejected');
  if (!validPacket(words)) throw new Error('input.rejected');
  return words;
}
function textBytes(text) {
  if (typeof text !== 'string' || text.length > MAX_TEXT_BYTES || /[\u0000\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(text))
    throw new Error('input.rejected');
  const bytes = utf8.encode(text);
  if (bytes.length > MAX_TEXT_BYTES) throw new Error('input.rejected');
  return bytes;
}
export function textPackets(text, origin, group, available) {
  textBytes(text);
  if (![2, 3].includes(origin) || typeof group !== 'bigint' || group < 1n || group > 0xffffffffffffffffn || !uint(available, MAX_PENDING))
    throw new Error('input.rejected');
  const scalars = Array.from(text, value => value.codePointAt(0));
  if (!scalars.length || scalars.length > available) throw new Error('input.rejected');
  return scalars.map((code, index) => {
    const words = keyPacket(code);
    words[8] = origin; words[9] = Number(group & 0xffffffffn); words[10] = Number(group >> 32n);
    words[11] = index; words[12] = scalars.length;
    return words;
  });
}
export function validateDraft(draft) {
  if (!exact(draft, ['text', 'composing', 'selectionStart', 'selectionEnd', 'selectionDirection', 'focused'])) throw new Error('input.rejected');
  textBytes(draft.text);
  if (typeof draft.composing !== 'boolean' || typeof draft.focused !== 'boolean' ||
      !uint(draft.selectionStart, draft.text.length) || !uint(draft.selectionEnd, draft.text.length) ||
      draft.selectionStart > draft.selectionEnd || !['none', 'forward', 'backward'].includes(draft.selectionDirection)) throw new Error('input.rejected');
  return {...draft};
}
export function encodeContext(nextGroup, draft) {
  if (typeof nextGroup !== 'bigint' || nextGroup < 1n || nextGroup > 0xffffffffffffffffn) throw new Error('save.replay_unavailable');
  const value = {schema_version: 1, next_group: [Number(nextGroup & 0xffffffffn), Number(nextGroup >> 32n)], draft: validateDraft(draft)};
  const bytes = utf8.encode(JSON.stringify(value));
  if (bytes.length > MAX_CONTEXT_BYTES) throw new Error('save.replay_unavailable');
  return bytes;
}
export function decodeContext(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_CONTEXT_BYTES) throw new Error('save.corrupt');
  const value = JSON.parse(strictUtf8.decode(bytes));
  if (!exact(value, ['schema_version', 'next_group', 'draft']) || value.schema_version !== 1 ||
      !Array.isArray(value.next_group) || value.next_group.length !== 2 || !value.next_group.every(v => uint(v))) throw new Error('save.corrupt');
  const nextGroup = BigInt(value.next_group[0]) | BigInt(value.next_group[1]) << 32n;
  if (!nextGroup) throw new Error('save.corrupt');
  return {nextGroup, draft: validateDraft(value.draft)};
}
function mutablePath(path) {
  return typeof path === 'string' && new TextEncoder().encode(path).length < 4096 && !/[\u0000\\]/.test(path) &&
    !path.includes('//') && !path.split('/').some(part => part === '.' || part === '..') && !path.endsWith('/') &&
    MUTABLE_ROOTS.some(root => path === root || path.startsWith(`${root}/`));
}
export function encodeEnvironment(value) {
  validateEnvironment(value);
  const bytes = utf8.encode(JSON.stringify(value));
  if (bytes.length > MAX_ENVIRONMENT_BYTES) throw new Error('save.environment_too_large');
  return bytes;
}
export function decodeEnvironment(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_ENVIRONMENT_BYTES) throw new Error('save.corrupt');
  return validateEnvironment(JSON.parse(strictUtf8.decode(bytes)));
}
function validateEnvironment(value) {
  if (!exact(value, ['schema_version', 'roots', 'entries']) || value.schema_version !== 1 ||
      !Array.isArray(value.roots) || value.roots.length !== MUTABLE_ROOTS.length || value.roots.some((v, i) => v !== MUTABLE_ROOTS[i]) ||
      !Array.isArray(value.entries) || value.entries.length > 16384) throw new Error('save.corrupt');
  const paths = new Map();
  let decodedBytes = 0;
  for (const entry of value.entries) {
    if (!exact(entry, entry?.kind === 'directory' ? ['path', 'kind', 'mode', 'atime', 'mtime'] : ['path', 'kind', 'mode', 'atime', 'mtime', 'data']) ||
        !mutablePath(entry.path) || entry.path === '/data/save/browser' || paths.has(entry.path) ||
        !['file', 'directory'].includes(entry.kind) || !uint(entry.mode, 0o7777) ||
        !Number.isSafeInteger(entry.atime) || !Number.isSafeInteger(entry.mtime)) throw new Error('save.corrupt');
    if (MUTABLE_ROOTS.includes(entry.path) && entry.kind !== 'directory') throw new Error('save.corrupt');
    if (entry.kind === 'file') {
      if (typeof entry.data !== 'string' || entry.data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.data)) throw new Error('save.corrupt');
      decodedBytes += entry.data.length / 4 * 3 - (entry.data.endsWith('==') ? 2 : entry.data.endsWith('=') ? 1 : 0);
      if (decodedBytes > MAX_ENVIRONMENT_BYTES) throw new Error('save.corrupt');
    }
    const parent = entry.path.slice(0, entry.path.lastIndexOf('/'));
    if (!MUTABLE_ROOTS.includes(entry.path) && paths.get(parent) !== 'directory') throw new Error('save.corrupt');
    paths.set(entry.path, entry.kind);
  }
  return value;
}
