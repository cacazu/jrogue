import { MAX_ENVELOPE_BYTES } from './protocol.js';
export { MAX_ENVELOPE_BYTES } from './protocol.js';
export const SAVE_FORMAT = 'jrogue.angband.web-save';
export const MAX_SAVE_BYTES = MAX_ENVELOPE_BYTES;
export class SaveError extends Error {
  constructor(id) { super(id); this.id = id; }
}
export async function digestBytes(bytes) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function validatePayloadLength(length) {
  if (!Number.isInteger(length) || length < 1) throw new SaveError('save.corrupt');
  if (length > MAX_SAVE_BYTES) throw new SaveError('save.too_large');
}
export async function makeSaveRecord(payload, build, seed, now = new Date()) {
  const bytes = new Uint8Array(payload);
  validatePayloadLength(bytes.length);
  return {
    format: SAVE_FORMAT, schemaVersion: build.schemaVersion, engineVersion: build.engineVersion,
    upstreamCommit: build.upstreamCommit, seed, savedAt: now.toISOString(),
    payloadLength: bytes.length, sha256: await digestBytes(bytes), payload: bytes.buffer
  };
}
export async function validateSaveRecord(record, build) {
  if (!record || record.format !== SAVE_FORMAT || typeof record.savedAt !== 'string' || !Number.isFinite(Date.parse(record.savedAt)) || !Number.isInteger(record.seed) || record.seed < 0 || record.seed > 0xffffffff) throw new SaveError('save.invalid');
  if (record.schemaVersion !== build.schemaVersion || record.engineVersion !== build.engineVersion || record.upstreamCommit !== build.upstreamCommit) throw new SaveError('save.incompatible');
  validatePayloadLength(record.payloadLength);
  if (!(record.payload instanceof ArrayBuffer) && !(record.payload instanceof Uint8Array)) throw new SaveError('save.invalid');
  const bytes = new Uint8Array(record.payload);
  validatePayloadLength(bytes.length);
  if (!bytes.length || record.payloadLength !== bytes.length || record.sha256 !== await digestBytes(bytes)) throw new SaveError('save.corrupt');
  return bytes;
}
export function exportRecord(record) {
  const bytes = new Uint8Array(record.payload);
  let binary = '';
  for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  return JSON.stringify({ ...record, payload: btoa(binary) });
}
export function importRecord(json) {
  let record;
  try { record = JSON.parse(json); } catch { throw new SaveError('save.invalid'); }
  if (!record || typeof record.payload !== 'string') throw new SaveError('save.invalid');
  if (record.payload.length > Math.ceil(MAX_SAVE_BYTES / 3) * 4) throw new SaveError('save.too_large');
  try {
    const binary = atob(record.payload);
    record.payload = Uint8Array.from(binary, char => char.charCodeAt(0)).buffer;
  } catch { throw new SaveError('save.invalid'); }
  return record;
}
export function openSaveDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('jrogue-angband', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
  });
}
export function readSave(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('saves', 'readonly');
    const request = transaction.objectStore('saves').get('current');
    let value;
    request.onsuccess = () => { value = request.result || null; };
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Save read aborted'));
  });
}
export function writeSave(db, record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('saves', 'readwrite');
    transaction.objectStore('saves').put(record, 'current');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Save write aborted'));
  });
}
