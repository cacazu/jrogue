/* Host adapter only: Rust resolves bounded controls and formats semantic text. */
const CONTEXTS = Object.freeze({ gameplay: 0, menu: 1, character_name: 2 });
const CONTROLS = Object.freeze({ north: 1, north_east: 2, east: 3, south_east: 4,
  south: 5, south_west: 6, west: 7, north_west: 8, confirm: 9, cancel: 10,
  inventory: 11, examine: 12, pickup: 13, pause: 14, wait_minutes: 15, save_quit: 16 });
const KEYS = Object.freeze([null, 'ArrowUp', 'u', 'ArrowRight', 'n', 'ArrowDown', 'b',
  'ArrowLeft', 'y', 'Enter', 'Escape', 'i', 'e', 'g', '.', '|', 'S']);
const HELPER_CONTROLS = Object.freeze({ ArrowUp: 'north', ArrowRight: 'east',
  ArrowDown: 'south', ArrowLeft: 'west', Enter: 'confirm', Escape: 'cancel',
  '.': 'pause', '|': 'wait_minutes', S: 'save_quit', i: 'inventory', e: 'examine', g: 'pickup' });
const MAX_U64 = (1n << 64n) - 1n;
const decoder = new TextDecoder('utf-8', { fatal: true });

function contextId(name) {
  if (!Object.hasOwn(CONTEXTS, name)) throw new RangeError(`Unknown input context: ${name}`);
  return CONTEXTS[name];
}
function checkedCount(value, name) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`Invalid count: ${name}`);
    value = BigInt(value);
  }
  if (typeof value !== 'bigint' || value < 0n || value > MAX_U64) throw new TypeError(`Invalid count: ${name}`);
  return [Number(value & 0xffffffffn), Number(value >> 32n)];
}

/** Create a bridge from an already instantiated, import-free Rust module.
 * The engine and DOM are deliberately absent from this function's arguments.
 */
export function createBridge(instance, manifest) {
  const api = instance.exports;
  if (api.cdda_bridge_abi_version() !== 1 || api.cdda_bridge_init() !== 1) {
    throw new Error('Rust browser bridge initialization failed');
  }
  if (manifest.schemaVersion !== 1 || manifest.defaultLocale !== 'ja' || !Array.isArray(manifest.entries)) {
    throw new Error('Rust bridge text manifest is invalid');
  }
  if (api.cdda_bridge_text_count() !== manifest.entries.length) throw new Error('Rust bridge text count mismatch');
  const copyText = (pointer, length) => {
    pointer >>>= 0;
    length >>>= 0;
    if (pointer > api.memory.buffer.byteLength || length > api.memory.buffer.byteLength - pointer) {
      throw new Error('Rust text output exceeded WASM memory');
    }
    return decoder.decode(new Uint8Array(api.memory.buffer, pointer, length).slice());
  };
  const entries = new Map();
  for (const [index, entry] of manifest.entries.entries()) {
    if (entry.index !== index || entries.has(entry.id)) throw new Error('Rust bridge text indices are invalid');
    if (copyText(api.cdda_bridge_text_id_ptr(index), api.cdda_bridge_text_id_len(index)) !== entry.id) {
      throw new Error('Rust bridge compiled text ID mismatch');
    }
    entries.set(entry.id, Object.freeze({ ...entry, parameters: Object.freeze({ ...entry.parameters }) }));
  }
  const keyFor = value => {
    if (!Number.isInteger(value) || value < 0 || value >= KEYS.length) throw new Error('Invalid Rust wire key');
    return KEYS[value];
  };
  return Object.freeze({
    defaultLocale: 'ja',
    /** Unsupported controls return null; the host decides whether to pass raw native input. */
    touch(control, context = 'menu') {
      if (!Object.hasOwn(CONTROLS, control)) return null;
      return keyFor(api.cdda_bridge_touch(contextId(context), CONTROLS[control]));
    },
    gamepadButton(button, context = 'gameplay') {
      if (!Number.isInteger(button) || button < 0 || button > 255) return null;
      return keyFor(api.cdda_bridge_gamepad_button(contextId(context), button));
    },
    gamepadDirection(direction, context = 'gameplay') {
      if (!Number.isInteger(direction) || direction < 0 || direction > 7) return null;
      return keyFor(api.cdda_bridge_gamepad_direction(contextId(context), direction));
    },
    /** Only call for helper buttons, never for keyboard events or character names.
     * Explicit fallback retains the original key when this bounded contract has no command.
     */
    resolveHelperKey(key, context = 'menu') {
      const control = HELPER_CONTROLS[key];
      if (!control) return Object.freeze({ key, resolvedBy: 'original-cpp-native-key' });
      const mapped = this.touch(control, context);
      return Object.freeze(mapped === null ? { key, resolvedBy: 'original-cpp-native-key' } :
        { key: mapped, resolvedBy: 'rust-wasm', control, context });
    },
    /** Returns plain text; hosts must use textContent, never innerHTML. */
    formatText(locale = 'ja', id, parameters = {}) {
      if (locale !== 'ja' && locale !== 'en') throw new RangeError(`Unsupported locale: ${locale}`);
      const entry = entries.get(id);
      if (!entry) throw new Error(`Missing shell text ID: ${id}`);
      const expected = Object.keys(entry.parameters).sort();
      if (JSON.stringify(Object.keys(parameters).sort()) !== JSON.stringify(expected)) {
        throw new TypeError(`Shell text parameter mismatch: ${id}`);
      }
      api.cdda_bridge_text_reset();
      let first = [0, 0], second = [0, 0];
      if (id === 'runtime.preparing') {
        first = checkedCount(parameters.completed, 'completed');
        second = checkedCount(parameters.total, 'total');
      } else if (id === 'save.exported') {
        first = checkedCount(parameters.count, 'count');
        second = checkedCount(parameters.bytes, 'bytes');
      } else if (Object.hasOwn(entry.parameters, 'reason')) {
        if (typeof parameters.reason !== 'string') throw new TypeError(`Invalid user text: ${id}:reason`);
        for (const scalar of parameters.reason) {
          const status = api.cdda_bridge_text_push_scalar(scalar.codePointAt(0));
          if (status !== 0) throw new RangeError(`Rust user-text validation failed: ${status}`);
        }
      }
      const status = api.cdda_bridge_text_prepare(locale === 'ja' ? 0 : 1, entry.index, ...first, ...second);
      if (status !== 0) throw new Error(`Rust semantic formatting failed: ${id}:${status}`);
      // Copy while the scratch pointer is valid, then decode with strict UTF-8.
      return copyText(api.cdda_bridge_text_ptr(), api.cdda_bridge_text_len());
    }
  });
}

/** Load this independent module before starting the original Emscripten engine. */
export async function loadBridge({ wasmUrl = 'rust-browser-bridge/cdda_rust_browser_bridge.wasm',
  manifestUrl = 'rust-browser-bridge/text-manifest.json', fetchImpl = globalThis.fetch } = {}) {
  const [wasmResponse, manifestResponse] = await Promise.all([fetchImpl(wasmUrl), fetchImpl(manifestUrl)]);
  if (!wasmResponse.ok || !manifestResponse.ok) throw new Error('Rust bridge asset fetch failed');
  const [wasm, manifest] = await Promise.all([wasmResponse.arrayBuffer(), manifestResponse.json()]);
  const module = await WebAssembly.compile(wasm);
  if (WebAssembly.Module.imports(module).length !== 0) throw new Error('Rust bridge unexpectedly imports host capabilities');
  return createBridge(await WebAssembly.instantiate(module, {}), manifest);
}
