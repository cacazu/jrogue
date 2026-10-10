// Rust input/display/environment bridge to a separately owned original C/Lua instance.
// Native callbacks return copied UTF-8 JSON from __TOME_WEB.snapshot_json()/command_json().
// They must never evaluate generated Lua source or replace the original gameplay core.

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAX_BYTES = 16 * 1024 * 1024;

export class RetainedCoreAdapter {
  constructor(wasmExports, originalCore) {
    this.wasm = wasmExports;
    this.original = originalCore;
    this.inFlight = null;
    this.lastCoreError = null;
    for (const name of [
      'tome_adapter_input_reset', 'tome_adapter_input_byte', 'tome_adapter_request',
      'tome_adapter_pending_kind', 'tome_adapter_pending_len', 'tome_adapter_pending_byte',
      'tome_adapter_core_result', 'tome_adapter_core_failed',
      'tome_adapter_output_len', 'tome_adapter_output_byte',
    ]) {
      if (typeof this.wasm[name] !== 'function') throw new TypeError(`Missing Rust ABI export: ${name}`);
    }
    if (typeof originalCore.snapshotJson !== 'function' || typeof originalCore.commandJson !== 'function') {
      throw new TypeError('The original core must supply snapshotJson and commandJson callbacks');
    }
  }

  // Synchronous input mapping: the event handler can preventDefault immediately only
  // when response.handled is true. Native gameplay is dispatched separately by fulfill().
  request(request) {
    this.writeInput(encoder.encode(JSON.stringify(request)));
    this.wasm.tome_adapter_request();
    return this.readOutput();
  }

  async fulfill() {
    if (this.inFlight) return this.inFlight;
    const kind = this.wasm.tome_adapter_pending_kind();
    if (kind === 0) return this.readOutput();
    const key = decoder.decode(this.readBytes(
      this.wasm.tome_adapter_pending_len(),
      index => this.wasm.tome_adapter_pending_byte(index),
    ));
    this.inFlight = (async () => {
      try {
        let nativeResult;
        if (kind === 1) nativeResult = await this.original.snapshotJson();
        else if (kind === 2) nativeResult = await this.original.commandJson(key);
        else if (kind === 3 && typeof this.original.uiSnapshotJson === 'function') nativeResult = await this.original.uiSnapshotJson();
        else if (kind === 4 && typeof this.original.uiCommandJson === 'function') nativeResult = await this.original.uiCommandJson(JSON.parse(key));
        else throw new Error('Unsupported Rust pending-call kind');
        const bytes = typeof nativeResult === 'string' ? encoder.encode(nativeResult) : nativeResult;
        if (!(bytes instanceof Uint8Array)) throw new TypeError('Native JSON must be UTF-8 string or copied Uint8Array');
        this.writeInput(bytes);
        this.wasm.tome_adapter_core_result();
        this.lastCoreError = null;
      } catch (error) {
        this.lastCoreError = error;
        this.wasm.tome_adapter_core_failed();
      } finally {
        this.inFlight = null;
      }
      return this.readOutput();
    })();
    return this.inFlight;
  }

  writeInput(bytes) {
    if (bytes.length > MAX_BYTES) throw new RangeError('Core transport byte limit exceeded');
    this.wasm.tome_adapter_input_reset();
    for (const byte of bytes) {
      if (this.wasm.tome_adapter_input_byte(byte) !== 1) throw new RangeError('Rust input mailbox rejected bytes');
    }
  }

  readBytes(length, byteAt) {
    if (!Number.isInteger(length) || length < 0 || length > MAX_BYTES * 2) {
      throw new RangeError('Invalid Rust mailbox length');
    }
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index++) {
      const byte = byteAt(index);
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw new RangeError('Invalid Rust mailbox byte');
      bytes[index] = byte;
    }
    return bytes;
  }

  readOutput() {
    return JSON.parse(decoder.decode(this.readBytes(
      this.wasm.tome_adapter_output_len(),
      index => this.wasm.tome_adapter_output_byte(index),
    )));
  }
}

// Text entry and composition context are copied to Rust; browser code owns no key map.
export function keyInput(event) {
  const target = event.target;
  return {
    key: event.key,
    code: event.code || '',
    repeat: Boolean(event.repeat),
    composing: Boolean(event.isComposing || event.keyCode === 229),
    ctrl: Boolean(event.ctrlKey), alt: Boolean(event.altKey),
    meta: Boolean(event.metaKey), shift: Boolean(event.shiftKey),
    editable: Boolean(target && (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))),
  };
}
