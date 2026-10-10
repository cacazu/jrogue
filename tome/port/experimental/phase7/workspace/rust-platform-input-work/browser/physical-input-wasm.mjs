// SPDX-License-Identifier: GPL-3.0-or-later
// The actual standalone Rust WASM byte ABI; no fixture or JavaScript key mapper.
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
export class PhysicalInputError extends Error {
  constructor(id, status = null) { super(id); this.textId = id; this.status = status; }
}
export class PhysicalInputWasm {
  static async create(url, {fetcher = fetch} = {}) {
    const response = await fetcher(url);
    if (!response.ok) throw new PhysicalInputError('input.error.wasm');
    const {instance} = await WebAssembly.instantiate(await response.arrayBuffer(), {});
    return new PhysicalInputWasm(instance.exports);
  }
  constructor(exports) {
    this.exports = exports;
    for (const name of ['reset', 'word', 'request', 'output_len', 'output_word']) {
      if (typeof exports['tome_physical_input_' + name] !== 'function')
        throw new PhysicalInputError('input.error.abi');
    }
    // A fresh native host must precede this fresh mapper. Never reset a live
    // mapper without first draining its Blur releases into original SDL.
    exports.tome_physical_input_reset();
  }
  map(input) {
    const bytes = encoder.encode(JSON.stringify(input));
    if (bytes.length > 65536) throw new PhysicalInputError('input.error.mailbox_limit');
    for (let offset = 0; offset < bytes.length; offset += 4) {
      const count = Math.min(4, bytes.length - offset);
      let word = 0;
      for (let i = 0; i < count; ++i) word |= bytes[offset + i] << (i * 8);
      if (this.exports.tome_physical_input_word(word >>> 0, count) !== 1) {
        // request consumes the rejected mailbox so a later valid request is
        // possible. Its error cannot update Rust's held physical state.
        this.exports.tome_physical_input_request();
        throw new PhysicalInputError('input.error.mailbox_limit');
      }
    }
    const accepted = this.exports.tome_physical_input_request();
    const length = this.exports.tome_physical_input_output_len() >>> 0;
    if (!length || length > 131072) throw new PhysicalInputError('input.error.output_limit');
    const output = new Uint8Array(length);
    for (let offset = 0; offset < length; offset += 4) {
      const word = this.exports.tome_physical_input_output_word(offset) >>> 0;
      for (let i = 0; i < 4 && offset + i < length; ++i) output[offset + i] = word >>> (i * 8) & 255;
    }
    let mapped;
    try { mapped = JSON.parse(decoder.decode(output)); }
    catch { throw new PhysicalInputError('input.error.abi'); }
    if (accepted !== 1 || mapped.error_id) throw new PhysicalInputError(mapped.error_id || 'input.error.abi');
    if (!Array.isArray(mapped.packets) || typeof mapped.handled !== 'boolean')
      throw new PhysicalInputError('input.error.abi');
    return mapped;
  }
}
