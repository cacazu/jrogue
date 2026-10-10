// SPDX-License-Identifier: GPL-3.0-or-later
// Streaming raw JSON initialization; synchronous immutable semantic queries.
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAX_REQUEST = 1024 * 1024;
const MAX_OUTPUT = 4 * 1024 * 1024;
const stages = [ ['english', 1], ['japanese', 2], ['registry', 3], ['supplements', 4], ['formatPolicies', 5], ['extension', 6] ];

export class SemanticTransportError extends Error {
  constructor(reason) { super(reason); this.name = 'SemanticTransportError'; this.reason = reason; }
}

function packedWords(bytes, consume) {
  if (!(bytes instanceof Uint8Array)) throw new SemanticTransportError('invalid_byte_chunk');
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const count = Math.min(4, bytes.length - offset);
    const word = ((bytes[offset] || 0) | ((bytes[offset + 1] || 0) << 8) |
      ((bytes[offset + 2] || 0) << 16) | ((bytes[offset + 3] || 0) << 24)) >>> 0;
    if (consume(word, count) !== 1) return false;
  }
  return true;
}

export class SemanticTextWasm {
  constructor(exports) {
    this.wasm = exports;
    this.ready = false;
    this.initializing = false;
    this.failed = false;
    this.queryActive = false;
    this.status = null;
    for (const name of [ 'tome_text_stage_reset', 'tome_text_stage_word', 'tome_text_stage_finish',
      'tome_text_initialize', 'tome_text_request_reset', 'tome_text_request_word',
      'tome_text_request', 'tome_text_output_len', 'tome_text_output_word' ]) {
      if (typeof exports[name] !== 'function') throw new SemanticTransportError('missing_wasm_export');
    }
  }

  async initialize(inputs, { fetcher = globalThis.fetch, expectedIds } = {}) {
    if (this.ready) throw new SemanticTransportError('already_initialized');
    if (this.initializing) throw new SemanticTransportError('initialization_in_progress');
    if (this.failed) throw new SemanticTransportError('initialization_failed_new_instance_required');
    this.initializing = true;
    try {
    for (const [name, kind] of stages) {
      if (kind >= 4 && inputs[name] == null) continue;
      if (inputs[name] == null) throw new SemanticTransportError(`missing_${name}`);
      if (this.wasm.tome_text_stage_reset(kind) !== 1) throw new SemanticTransportError(this.readOutput().reason);
      const source = typeof inputs[name] === 'string' || inputs[name] instanceof URL ?
        await fetcher(inputs[name]) : inputs[name];
      if (source instanceof Uint8Array || source instanceof ArrayBuffer) {
        this.pushStage(source instanceof Uint8Array ? source : new Uint8Array(source));
      } else {
        if (source?.ok === false) throw new SemanticTransportError(`catalog_fetch_${source.status}`);
        const reader = source?.body?.getReader?.();
        if (!reader) throw new SemanticTransportError('catalog_stream_required');
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            this.pushStage(value);
          }
        } catch (error) {
          try { await reader.cancel(error); } catch { /* Preserve the original rejection. */ }
          throw error;
        } finally { reader.releaseLock(); }
      }
      if (this.wasm.tome_text_stage_finish() !== 1) throw new SemanticTransportError(this.readOutput().reason);
    }
    if (this.wasm.tome_text_initialize() !== 1) throw new SemanticTransportError(this.readOutput().reason);
    this.status = this.readOutput();
    if (!this.status.ready || (expectedIds != null && this.status.ids !== expectedIds)) {
      throw new SemanticTransportError('catalog_coverage_mismatch');
    }
    this.ready = true;
    return this.status;
    } catch (error) {
      // A partial stage or rejected coverage check must never be reused with a
      // different optional supplement set. Start with another WASM instance.
      this.failed = true;
      throw error;
    } finally { this.initializing = false; }
  }

  pushStage(bytes) {
    if (!packedWords(bytes, (word, count) => this.wasm.tome_text_stage_word(word, count))) {
      this.wasm.tome_text_stage_finish(); // consume/clear rejected partial mailbox
      throw new SemanticTransportError(this.readOutput().reason || 'stage_bytes_exceeded');
    }
  }

  request(request) {
    if (this.queryActive) return { ok: false, reason: 'resolver_reentrant' };
    const bytes = encoder.encode(JSON.stringify(request));
    if (bytes.length > MAX_REQUEST) return { ok: false, reason: 'request_bytes_exceeded' };
    this.queryActive = true;
    try {
      this.wasm.tome_text_request_reset();
      if (!packedWords(bytes, (word, count) => this.wasm.tome_text_request_word(word, count))) {
        return { ok: false, reason: 'invalid_mailbox' };
      }
      this.wasm.tome_text_request();
      return this.readOutput();
    } finally { this.queryActive = false; }
  }

  // Locale comes from the actual original I18N at each call. Omission selects
  // the product's Japanese default; no external printf parameters are accepted.
  resolve(source, tag, file, line, locale = 'ja_JP') {
    if (!this.ready) return { ok: false, reason: 'resolver_not_ready' };
    if (locale !== 'ja_JP' && locale !== 'en_US') return { ok: false, reason: 'native_locale_outside_semantic_catalogue' };
    const response = this.request({ op: 'resolve', source, tag, file: file ?? null,
      line: Number.isInteger(line) && line >= 0 && line <= 0xffffffff ? line : null, locale });
    if (response.ok) validateTemplate(response.result);
    return response;
  }

  supplement(id) {
    if (!this.ready) return { ok: false, reason: 'resolver_not_ready' };
    const response = this.request({ op: 'supplement', id });
    if (response.ok && response.supplement !== null && typeof response.supplement !== 'string') {
      throw new SemanticTransportError('invalid_supplement_result');
    }
    return response;
  }

  formatPolicy(id) {
    if (!this.ready) return { ok: false, reason: 'resolver_not_ready' };
    return this.request({ op: 'format_policy', id });
  }

  readOutput() {
    const length = this.wasm.tome_text_output_len();
    if (!Number.isInteger(length) || length < 0 || length > MAX_OUTPUT) throw new SemanticTransportError('invalid_output_length');
    const bytes = new Uint8Array(length);
    for (let offset = 0; offset < length; offset += 4) {
      const word = this.wasm.tome_text_output_word(offset) >>> 0;
      for (let index = 0; index < Math.min(4, length - offset); index++) bytes[offset + index] = (word >>> (8 * index)) & 0xff;
    }
    return JSON.parse(decoder.decode(bytes));
  }
}

export function validateTemplate(result) {
  if (!result || ['id', 'template', 'owner', 'tag'].some(field => typeof result[field] !== 'string') ||
      !Array.isArray(result.args_order) || result.args_order.some(value => !Number.isInteger(value) || value < 1 || value > 0xffffffff) ||
      ['missing_official_japanese', 'delegate_native_special', 'delegate_native_format_review'].some(field => typeof result[field] !== 'boolean')) {
    throw new SemanticTransportError('invalid_semantic_result');
  }
  return result;
}

export async function createSemanticTextWasm(wasmBytes, inputs, options) {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  const resolver = new SemanticTextWasm(instance.exports);
  await resolver.initialize(inputs, options);
  return resolver;
}
