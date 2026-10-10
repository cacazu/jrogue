// Isolated source proposal. Preserve the current exact typed event serializers.
const MAX_OUTPUT = 128 * 1024;
const MAX_CATALOG = 16 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal:true});

/** Explicitly initialized, module-owned Rust catalog, never initialized during repaint. */
export class RegisteredCatalog {
  #module;
  #handle = 0;
  #output = 0;
  #fallback = 0;
  #disposed = false;
  #rendering = false;

  constructor(module, catalogJSON) {
    if (typeof catalogJSON !== 'string') throw new TypeError('Catalog must be exact serialized JSON');
    this.#module = module;
    const bytes = encoder.encode(catalogJSON);
    if (bytes.length > MAX_CATALOG) throw new RangeError('Catalog exceeds Rust limit');
    const input = module._malloc(Math.max(1, bytes.length));
    if (!input) throw new Error('Catalog allocation failed');
    try {
      module.HEAPU8.set(bytes, input);
      const handle = module.ccall('nh_rust_catalog_register', 'number', ['number','number'], [input,bytes.length]);
      if (!Number.isInteger(handle) || handle <= 0) throw new Error(`Catalog initialization rejected (${handle})`);
      this.#handle = handle;
      this.#output = module._malloc(MAX_OUTPUT);
      this.#fallback = module._malloc(1);
      if (!this.#output || !this.#fallback) throw new Error('Render buffer allocation failed');
    } catch (error) {
      this.dispose(module);
      throw error;
    } finally {
      module._free(input);
    }
  }

  #checkModule(module) {
    if (module !== this.#module) throw new Error('Catalog belongs to a different Wasm instance');
    if (this.#disposed || !this.#handle) throw new Error('Catalog was disposed');
  }

  /** JSON must come from serializeTextEvent/serializeGameplayEnvelope unchanged. */
  renderJSON(module, json, locale = 'ja', kind = 1) {
    this.#checkModule(module);
    if (!['ja','en'].includes(locale) || ![0,1].includes(kind)) throw new TypeError('Invalid locale or event kind');
    if (typeof json !== 'string') throw new TypeError('Event must be exact serialized JSON');
    if (this.#rendering) throw new Error('Reentrant catalog render');
    const bytes = encoder.encode(json);
    if (bytes.length > (kind === 0 ? 65536 : 262144)) throw new RangeError('Event exceeds Rust limit');
    const input = module._malloc(Math.max(1, bytes.length));
    if (!input) throw new Error('Event allocation failed');
    this.#rendering = true;
    try {
      // Access a fresh heap view after allocations/calls; memory can grow.
      module.HEAPU8.set(bytes, input);
      module.HEAPU8[this.#fallback] = 255;
      const size = module.ccall('nh_rust_format_registered', 'number', Array(8).fill('number'),
        [this.#handle,input,bytes.length,kind,locale === 'en' ? 1 : 0,this.#output,MAX_OUTPUT,this.#fallback]);
      if (!Number.isInteger(size) || size < 0 || size > MAX_OUTPUT) throw new Error(`Rust presentation rejected (${size})`);
      const fallback = module.HEAPU8[this.#fallback];
      if (![0,1].includes(fallback)) throw new Error('Rust fallback output is invalid');
      const text = decoder.decode(module.HEAPU8.subarray(this.#output, this.#output + size));
      return Object.freeze({text,usedFallback:fallback === 1,locale});
    } finally {
      this.#rendering = false;
      module._free(input);
    }
  }

  /** Explicit teardown before module replacement; safe to call repeatedly. */
  dispose(module) {
    if (module !== this.#module) throw new Error('Catalog belongs to a different Wasm instance');
    if (this.#disposed) return;
    if (this.#rendering) throw new Error('Cannot dispose during a render');
    this.#disposed = true;
    const handle = this.#handle;
    this.#handle = 0;
    try {
      if (handle) {
        const result = module.ccall('nh_rust_catalog_release','number',['number'],[handle]);
        if (result !== 0) throw new Error(`Catalog release rejected (${result})`);
      }
    } finally {
      if (this.#output) module._free(this.#output);
      if (this.#fallback) module._free(this.#fallback);
      this.#output = 0;
      this.#fallback = 0;
    }
  }
}
