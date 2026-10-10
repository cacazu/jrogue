/* Platform persistence: native completed saves and committed auxiliary files. Changed 2026-10-02. */
import { SOURCE_COMMIT, HOST_ABI } from './shim-host.mjs';

const LIMIT = 16 * 1024 * 1024;
const ENVELOPE_LIMIT = LIMIT * 2 + 4096;
export const SAVE_DIRECTORY = '/save';
export const AUXILIARY_FORMAT = 'nethack-auxiliary-files-v1';
const SCORE_FILES = new Set(['record','logfile','xlogfile']);
// Exact pinned dungeon/quest bones grammar; uncompressed POSIX build.
// Temporary player-lock .bn files and live level files are excluded.
export function isAuxiliaryName(name) {
  return typeof name === 'string' && (SCORE_FILES.has(name) || /^bon[0-9]?(?:D0\.(?:[1-9]|[12][0-9]|3[0-2]|[ROB])|G0\.(?:[1-9]|[12][0-9]|3[0-2]|[VJBAXYOFG])|M0\.(?:[1-9]|[12][0-9]|3[0-2]|T)|Q(?:Arc|Bar|Cav|Hea|Kni|Mon|Pri|Ran|Rog|Sam|Tou|Val|Wiz)\.(?:[1-9]|[12][0-9]|3[0-2]|L))$/.test(name));
}
export function bytesToBase64(bytes) {
  let text = '';
  for (let start = 0; start < bytes.length; start += 8192) text += String.fromCharCode(...bytes.subarray(start,start+8192));
  return btoa(text);
}
export function base64ToBytes(text) {
  if (typeof text !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw new Error('Invalid save file encoding');
  const decoded = atob(text);
  return Uint8Array.from(decoded,char => char.charCodeAt(0));
}
function validateFiles(files,auxiliary = false) {
  if (!Array.isArray(files) || files.length > (auxiliary ? 512 : 32)) throw new Error('Invalid save file list');
  let total = 0;
  const names = new Set();
  return files.map(file => {
    if (!file || typeof file.name !== 'string' || !/^[^\u0000-\u001f\u007f/\\]+$/u.test(file.name) || new TextEncoder().encode(file.name).length > 255 || file.name === '.' || file.name === '..' || names.has(file.name) || (auxiliary && !isAuxiliaryName(file.name))) throw new Error('Unsafe or duplicate save filename');
    names.add(file.name);
    if (typeof file.data !== 'string' || file.data.length > LIMIT*4/3+4) throw new Error('Save file is too large');
    const bytes = base64ToBytes(file.data);
    total += bytes.length;
    if ((!auxiliary && !bytes.length) || total > LIMIT || (auxiliary && !SCORE_FILES.has(file.name) && !bytes.length)) throw new Error('Save files exceed allowed size');
    return {name:file.name,bytes};
  });
}
function validateIdentity(payload,format) {
  if (payload?.format !== format || payload.source !== SOURCE_COMMIT || payload.abi !== HOST_ABI) throw new Error('Save source or ABI mismatch');
}
export function validateAuxiliaryPayload(payload) {
  validateIdentity(payload,AUXILIARY_FORMAT);
  return {files:validateFiles(payload.files,true)};
}
export function validatePayload(payload) {
  validateIdentity(payload,'nethack-completed-save-files-v1');
  const files = validateFiles(payload.files);
  if (!['string','undefined'].includes(typeof payload.playerName) || (payload.playerName?.length ?? 0) > 128) throw new Error('Invalid saved player name');
  const auxiliary = payload.auxiliary === undefined ? undefined : validateAuxiliaryPayload(payload.auxiliary);
  return {files,playerName:payload.playerName ?? 'Player',...(auxiliary ? {auxiliary} : {})};
}
const fileRows = files => files.map(file => ({name:file.name,data:bytesToBase64(file.bytes)}));
function auxiliaryPayload(files) { return {format:AUXILIARY_FORMAT,source:SOURCE_COMMIT,abi:HOST_ABI,files}; }
export function snapshotAuxiliaryFiles(FS) {
  const files = [];
  for (const name of FS.readdir('/').sort()) {
    if (!isAuxiliaryName(name)) continue;
    const path = `/${name}`;
    if (!FS.isFile(FS.stat(path).mode)) continue;
    files.push({name,data:bytesToBase64(FS.readFile(path))});
  }
  const payload = auxiliaryPayload(files);
  validateAuxiliaryPayload(payload);
  return payload;
}
export function snapshotSaveFiles(FS,playerName) {
  const files = [];
  for (const name of FS.readdir(SAVE_DIRECTORY)) {
    if (name === '.' || name === '..') continue;
    const path = `${SAVE_DIRECTORY}/${name}`;
    if (!FS.isFile(FS.stat(path).mode)) continue;
    const bytes = FS.readFile(path);
    if (bytes.length) files.push({name,data:bytesToBase64(bytes)});
  }
  const payload = {format:'nethack-completed-save-files-v1',source:SOURCE_COMMIT,abi:HOST_ABI,playerName,files};
  validatePayload(payload);
  return payload;
}

export class SaveStore {
  constructor(module) { this.module = module; this.dbPromise = null; }
  database() {
    if (!this.dbPromise) this.dbPromise = new Promise((resolve,reject) => {
      const request = indexedDB.open('jrogue-nethack-5.0.0',1);
      request.onupgradeneeded = () => request.result.createObjectStore('saves');
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Save database is blocked by another tab'));
      request.onsuccess = () => resolve(request.result);
    });
    return this.dbPromise;
  }
  async readState() {
    const db = await this.database();
    return new Promise((resolve,reject) => {
      const transaction = db.transaction('saves','readonly');
      const store = transaction.objectStore('saves');
      const result = {latest:null,auxiliary:null};
      for (const key of Object.keys(result)) {
        const request = store.get(key);
        request.onsuccess = () => { result[key] = request.result ?? null; };
      }
      transaction.oncomplete = () => {
        try { this.validateState(result); resolve(result); } catch (error) { reject(error); }
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Save read aborted'));
    });
  }
  async read() { return (await this.readState()).latest; }
  validateState(state) {
    if (!state || !Object.hasOwn(state,'latest') || !Object.hasOwn(state,'auxiliary')) throw new Error('Invalid browser save state');
    if (state.latest !== null) this.decode(state.latest);
    if (state.auxiliary !== null) this.decodeAuxiliary(state.auxiliary);
    return state;
  }
  async writeState(state) {
    // Validation precedes storage or filesystem mutation.
    this.validateState(state);
    const db = await this.database();
    await new Promise((resolve,reject) => {
      const transaction = db.transaction('saves','readwrite');
      const store = transaction.objectStore('saves');
      for (const key of ['latest','auxiliary']) {
        if (state[key] === null) store.delete(key); else store.put(state[key],key);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Save write aborted'));
    });
  }
  async write(envelope) {
    const state = await this.readState();
    state.latest = envelope;
    await this.writeState(state);
  }
  transform(name,bytes) {
    if (bytes.length > ENVELOPE_LIMIT) throw new Error('Save envelope is too large');
    const module = this.module;
    const input = module._malloc(Math.max(1,bytes.length));
    module.HEAPU8.set(bytes,input);
    let output = 0;
    try {
      const size = module.ccall(name,'number',Array(4).fill('number'),[input,bytes.length,0,0]);
      if (size < 0 || size > ENVELOPE_LIMIT) throw new Error(`Save validation failed (${size})`);
      output = module._malloc(Math.max(1,size));
      const written = module.ccall(name,'number',Array(4).fill('number'),[input,bytes.length,output,size]);
      if (written !== size) throw new Error('Save envelope length mismatch');
      return module.HEAPU8.slice(output,output+size);
    } finally { if (output) module._free(output); module._free(input); }
  }
  encode(payload) {
    validatePayload(payload);
    return new TextDecoder('utf-8',{fatal:true}).decode(this.transform('nh_rust_save_wrap',new TextEncoder().encode(JSON.stringify(payload))));
  }
  decode(envelope) {
    return validatePayload(this.unwrap(envelope));
  }
  unwrap(envelope) {
    if (typeof envelope !== 'string' || envelope.length > ENVELOPE_LIMIT) throw new Error('Invalid save envelope');
    const decoded = this.transform('nh_rust_save_unwrap',new TextEncoder().encode(envelope));
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decoded));
  }
  encodeAuxiliary(payload) {
    validateAuxiliaryPayload(payload);
    return new TextDecoder('utf-8',{fatal:true}).decode(this.transform('nh_rust_save_wrap',new TextEncoder().encode(JSON.stringify(payload))));
  }
  decodeAuxiliary(envelope) { return validateAuxiliaryPayload(this.unwrap(envelope)); }
  captureState(FS,playerName) {
    const save = snapshotSaveFiles(FS,playerName);
    const auxiliary = snapshotAuxiliaryFiles(FS);
    return {latest:save.files.length ? this.encode(save) : null,auxiliary:this.encodeAuxiliary(auxiliary)};
  }
  hydrateAuxiliary(FS,envelope) {
    if (envelope === null) return;
    const decoded = this.decodeAuxiliary(envelope);
    // Remove consumed bones when a previously initialized module is reused.
    for (const name of FS.readdir('/')) {
      if (isAuxiliaryName(name) && FS.isFile(FS.stat(`/${name}`).mode)) FS.unlink(`/${name}`);
    }
    for (const file of decoded.files) FS.writeFile(`/${file.name}`,file.bytes);
    const present = new Set(decoded.files.map(file => file.name));
    for (const name of SCORE_FILES) if (!present.has(name)) FS.writeFile(`/${name}`,new Uint8Array());
  }
  exportState(state) {
    this.validateState(state);
    const saved = state.latest ? this.decode(state.latest) : {files:[],playerName:'Player'};
    const auxiliary = state.auxiliary ? this.decodeAuxiliary(state.auxiliary) : undefined;
    if (!saved.files.length && !auxiliary?.files.some(file => file.bytes.length)) return null;
    return this.encode({format:'nethack-completed-save-files-v1',source:SOURCE_COMMIT,abi:HOST_ABI,playerName:saved.playerName,files:fileRows(saved.files),...(auxiliary ? {auxiliary:auxiliaryPayload(fileRows(auxiliary.files))} : {})});
  }
  importState(envelope,previous) {
    this.validateState(previous);
    const decoded = this.decode(envelope);
    const latest = decoded.files.length ? this.encode({format:'nethack-completed-save-files-v1',source:SOURCE_COMMIT,abi:HOST_ABI,playerName:decoded.playerName,files:fileRows(decoded.files)}) : null;
    const auxiliary = decoded.auxiliary ? this.encodeAuxiliary(auxiliaryPayload(fileRows(decoded.auxiliary.files))) : previous.auxiliary;
    return {latest,auxiliary};
  }
  hydrate(FS,envelope) {
    const decoded = this.decode(envelope);
    FS.mkdirTree(SAVE_DIRECTORY);
    // Validate the complete import before touching the running module.
    const existing = FS.readdir(SAVE_DIRECTORY).filter(name => name !== '.' && name !== '..');
    if (existing.length) throw new Error('Restoring into a nonempty save directory is forbidden');
    for (const file of decoded.files) FS.writeFile(`${SAVE_DIRECTORY}/${file.name}`,file.bytes);
    return decoded.playerName;
  }
  async completed(FS,playerName) {
    const state = this.captureState(FS,playerName);
    await this.writeState(state);
    return state.latest;
  }
}
