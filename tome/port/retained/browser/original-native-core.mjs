// SPDX-License-Identifier: GPL-3.0-or-later
// Browser environment seam for native-core-work/native_browser_init.c.
// These calls execute the retained original C/Lua runtime, never Rust gameplay.

const MAX_NATIVE_JSON_BYTES = 8 * 1024 * 1024;
const utf8 = new TextEncoder();
const nativeExports = [
  'tome_native_init', 'tome_native_start', 'tome_native_last_error',
  'tome_native_snapshot', 'tome_native_command',
];

export class NativeCoreError extends Error {
  constructor(textId, phase, detail = '') {
    super(`${phase}: ${detail || textId}`);
    this.name = 'NativeCoreError';
    this.textId = textId;
    this.phase = phase;
    // Native technical diagnostics are for developer inspection, not UI copy.
    this.detail = detail;
  }
}

export class OriginalNativeCore {
  constructor(module) {
    this.module = module;
    this.phase = 'fresh';
    this.failure = null;
    if (!module || typeof module.ccall !== 'function' ||
        nativeExports.some(name => typeof module[`_${name}`] !== 'function')) {
      throw new NativeCoreError('error.core.native_exports', 'exports');
    }
  }

  initialize() {
    if (this.phase === 'initialized' || this.phase === 'started') return;
    this.requirePhase('fresh');
    this.invokeStatus('tome_native_init', 'error.core.native_init', 'initialize');
    this.phase = 'initialized';
  }

  start() {
    if (this.phase === 'started') return;
    this.requirePhase('initialized');
    this.invokeStatus('tome_native_start', 'error.core.native_start', 'start');
    this.phase = 'started';
  }

  snapshotJson() {
    this.requirePhase('started');
    return this.invokeJson('tome_native_snapshot', [], []);
  }

  commandJson(key) {
    this.requirePhase('started');
    // Rust owns the whitelist. This additional transport guard rejects Lua
    // source, embedded NUL, and unbounded data at the native string boundary.
    if (typeof key !== 'string' || !/^(?:MOVE|ATTACK_OR_MOVE)_(?:LEFT|RIGHT|UP|DOWN|LEFT_UP|LEFT_DOWN|RIGHT_UP|RIGHT_DOWN|STAY)$/.test(key) ||
        key === 'ATTACK_OR_MOVE_STAY') {
      throw new NativeCoreError('error.core.request', 'command');
    }
    return this.invokeJson('tome_native_command', ['string'], [key]);
  }

  get uiAvailable() {
    const exportsPresent=['snapshot', 'command', 'last_error'].every(name => typeof this.module[`_tome_native_ui_${name}`] === 'function');
    return exportsPresent && (typeof this.module._tome_native_ui_available!=='function' ||
      this.module.ccall('tome_native_ui_available','number',[],[])===1);
  }

  uiSnapshotJson() {
    this.requirePhase('started');
    if (!this.uiAvailable) throw new NativeCoreError('error.ui.unavailable', 'ui snapshot');
    return this.invokeJson('tome_native_ui_snapshot', [], [], 'tome_native_ui_last_error');
  }

  uiCommandJson(command) {
    this.requirePhase('started');
    if (!this.uiAvailable) throw new NativeCoreError('error.ui.unavailable', 'ui command');
    if (!command || typeof command.dialog !== 'string' || !/^[a-zA-Z0-9_]{1,80}$/.test(command.dialog) ||
        (command.target != null && (typeof command.target !== 'string' || !/^[a-zA-Z0-9_]{1,80}$/.test(command.target))) ||
        !['ACCEPT', 'EXIT', 'MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT'].includes(command.key)) {
      throw new NativeCoreError('error.core.request', 'ui command');
    }
    return this.invokeJson('tome_native_ui_command', ['string', 'string', 'string'],
      [command.dialog, command.target || '', command.key], 'tome_native_ui_last_error');
  }

  requirePhase(expected) {
    if (this.failure) throw this.failure;
    if (this.phase !== expected) {
      throw new NativeCoreError('error.core.not_ready', this.phase);
    }
  }

  invokeStatus(name, textId, phase) {
    try {
      if (this.module.ccall(name, 'number', [], []) !== 1) throw this.nativeError(textId, phase);
    } catch (error) {
      // A partial native init/start is terminal for this session. Repeating it
      // could replace userdata or run original character birth twice.
      this.failure = error instanceof NativeCoreError ? error :
        new NativeCoreError(textId, phase, String(error));
      this.phase = 'failed';
      throw this.failure;
    }
  }

  invokeJson(name, types, values, errorExport = 'tome_native_last_error') {
    let text;
    try {
      // ccall's string return copies the borrowed C buffer immediately. The
      // buffer belongs to C and is replaced by the next successful bridge call.
      text = this.module.ccall(name, 'string', types, values);
    } catch (error) {
      throw new NativeCoreError('error.core.failed', name, String(error));
    }
    if (typeof text !== 'string' || text.length === 0) throw this.nativeError('error.core.failed', name, errorExport);
    const bytes = utf8.encode(text);
    if (bytes.length > MAX_NATIVE_JSON_BYTES) throw new NativeCoreError('error.core.bytes', name);
    // Rust validates the protocol; do not decode/rebuild the original JSON or
    // translate source names here. The copy has no native-memory lifetime.
    return bytes;
  }

  nativeError(textId, phase, errorExport = 'tome_native_last_error') {
    let detail = '';
    try {
      detail = this.module.ccall(errorExport, 'string', [], []);
    } catch { /* The original failure remains reportable if error retrieval fails. */ }
    return new NativeCoreError(textId, phase, typeof detail === 'string' ? detail : '');
  }
}
