// Bounded native startup display adapter. GPL-3.0-or-later.
// Owns a separate Rust WASM instance; never calls a native engine export.
export const STARTUP_TEXT_PIN = Object.freeze({
  version: 1,
  upstream: '1eebc1a2892e1c89776a0d7a10691f8dac8d9796',
  release: '0.34.1',
  id: 'startup.weapon.prompt',
  nativeSource: 'b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c',
  boundary: Object.freeze({ path: '/build/boundary.wasm', bytes: 701559,
    sha256: 'b35e93f807923e5320ccb7d11d9edf84bc296d713a4cd6056c11306c31577f2c' }),
  catalogs: Object.freeze([
    Object.freeze({ path: '/locales/startup/en.json', sha256: '1fe29184d921ff7b809f168394efddd9601681c357481fddb87bda8cc77bb866' }),
    Object.freeze({ path: '/locales/startup/ja.json', sha256: '849f34f6db7f27595bbec292b1ad522baf8757db8c392b82da6c9b0102a629ab' }),
    Object.freeze({ path: '/locales/startup/source-map.json', sha256: 'cac159c02ec30ebcadebf8188228d25f15e03af51d1a7533ad25c9c64dec042c' }),
  ]),
  en: 'You have a choice of weapons.',
  ja: '\u6b66\u5668\u3092\u9078\u3079\u307e\u3059\u3002',
});

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const MAX_REQUEST = 1024;
const MAX_RESPONSE = 2048;
const MAX_NATIVE_BYTES = 511;

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value, keys) {
  return object(value) && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
}
function checkLanguage(language) {
  if (language !== 'ja' && language !== 'en') throw new Error('unsupported native startup locale');
  return language;
}
function checkMessage(id, params) {
  if (id !== STARTUP_TEXT_PIN.id || !exactKeys(params, [])) {
    throw new Error('native startup text is outside the reviewed ID/parameter slice');
  }
}
function checkRange(memory, pointer, length) {
  if (!Number.isInteger(pointer) || pointer <= 0 || !Number.isInteger(length)
      || length <= 0 || pointer + length > memory.buffer.byteLength) {
    throw new Error('invalid Rust startup ABI memory range');
  }
}

// Exported for isolated mock tests and equivalent Node fixture wiring.
// Production callers obtain exports only through loadStartupTextBridge below.
export function createStartupTextBridge(exports, language = 'ja') {
  checkLanguage(language);
  if (!(exports?.memory instanceof WebAssembly.Memory)
      || ['dcss_allocate', 'dcss_request', 'dcss_release'].some(name => typeof exports[name] !== 'function')
      || exports.dcss_allocate.length !== 1 || exports.dcss_request.length !== 2
      || exports.dcss_release.length !== 2) throw new Error('unsupported Rust startup ABI');
  let busy = false;

  function render(id, params, locale) {
    checkMessage(id, params);
    checkLanguage(locale);
    if (busy) throw new Error('reentrant Rust startup formatting');
    const bytes = encoder.encode(JSON.stringify({ language: locale, op: 'text', message: { id, params } }));
    if (!bytes.length || bytes.length > MAX_REQUEST) throw new Error('startup request is too large');
    let input = 0, output = 0, length = 0, inputOwned = false, outputOwned = false;
    busy = true;
    try {
      const allocated = exports.dcss_allocate(bytes.length);
      if (!Number.isInteger(allocated) || allocated < -0x80000000 || allocated > 0xffffffff) {
        throw new Error('invalid Rust startup allocation');
      }
      input = allocated >>> 0;
      checkRange(exports.memory, input, bytes.length);
      inputOwned = true;
      // Allocation and request may grow memory. Always create fresh views.
      new Uint8Array(exports.memory.buffer, input, bytes.length).set(bytes);
      const packed = exports.dcss_request(input, bytes.length);
      if (typeof packed !== 'bigint' || packed <= 0n || packed > 0xffffffffffffffffn) {
        throw new Error('invalid Rust startup response descriptor');
      }
      output = Number(packed & 0xffffffffn);
      length = Number(packed >> 32n);
      if (length > MAX_RESPONSE) throw new Error('Rust startup response is too large');
      checkRange(exports.memory, output, length);
      if (output < input + bytes.length && input < output + length) {
        throw new Error('Rust startup output aliases its input');
      }
      outputOwned = true;
      const response = JSON.parse(decoder.decode(new Uint8Array(exports.memory.buffer, output, length)));
      if (!exactKeys(response, ['ok', 'value', 'session', 'messages', 'text'])
          || response.ok !== true || response.value !== null || response.session !== null
          || !Array.isArray(response.messages) || response.messages.length !== 1
          || !exactKeys(response.messages[0], ['id', 'params'])
          || response.messages[0].id !== id || !exactKeys(response.messages[0].params, [])
          || !Array.isArray(response.text) || response.text.length !== 1
          || typeof response.text[0] !== 'string') throw new Error('invalid Rust startup Text response');
      const text = response.text[0];
      if (text.includes('\0') || encoder.encode(text).length > MAX_NATIVE_BYTES
          || text !== STARTUP_TEXT_PIN[locale]) throw new Error('startup text differs from the reviewed locale');
      return text;
    } finally {
      try {
        if (outputOwned) exports.dcss_release(output, length);
      } finally {
        try { if (inputOwned) exports.dcss_release(input, bytes.length); }
        finally { busy = false; }
      }
    }
  }

  // No engine exists yet. Both language/catalog/ABI paths must succeed.
  render(STARTUP_TEXT_PIN.id, {}, 'en');
  render(STARTUP_TEXT_PIN.id, {}, 'ja');
  return Object.freeze({
    language,
    format(id, params) { return render(id, params, language); },
  });
}

export async function loadStartupTextBridge(language = 'ja', dependencies = {}) {
  checkLanguage(language);
  const fetcher = dependencies.fetcher ?? globalThis.fetch;
  const crypto = dependencies.crypto ?? globalThis.crypto;
  const instantiate = dependencies.instantiate ?? WebAssembly.instantiate;
  if (typeof fetcher !== 'function' || !crypto?.subtle || typeof instantiate !== 'function') {
    throw new Error('startup preflight dependencies unavailable');
  }
  async function verifiedBytes(pin, limit) {
    const response = await fetcher(pin.path, { cache: 'no-store' });
    if (!response?.ok) throw new Error('startup artifact fetch failed: ' + pin.path);
    const buffer = await response.arrayBuffer();
    if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.byteLength > limit
        || (pin.bytes !== undefined && buffer.byteLength !== pin.bytes)) {
      throw new Error('startup artifact size mismatch: ' + pin.path);
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    const hash = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== pin.sha256) throw new Error('startup artifact checksum mismatch: ' + pin.path);
    return new Uint8Array(buffer);
  }
  // Sequential bounded fetches avoid an additional large engine allocation.
  const catalogs = [];
  for (const pin of STARTUP_TEXT_PIN.catalogs) {
    catalogs.push(JSON.parse(decoder.decode(await verifiedBytes(pin, 128 * 1024))));
  }
  const [en, ja, source] = catalogs;
  const receipt = source?.messages?.find(message => message.id === STARTUP_TEXT_PIN.id);
  if (en?.[STARTUP_TEXT_PIN.id] !== STARTUP_TEXT_PIN.en || ja?.[STARTUP_TEXT_PIN.id] !== STARTUP_TEXT_PIN.ja
      || source.schema_version !== 1 || source.release !== STARTUP_TEXT_PIN.release
      || source.commit !== STARTUP_TEXT_PIN.upstream
      || !source.source_files?.some(file => file.path === 'crawl-ref/source/newgame.cc'
        && file.sha256 === STARTUP_TEXT_PIN.nativeSource)
      || receipt?.expected_en !== STARTUP_TEXT_PIN.en || !exactKeys(receipt.params, [])
      || receipt.source_sites?.length !== 1 || receipt.source_sites[0] !== STARTUP_TEXT_PIN.id) {
    throw new Error('startup catalog source identity mismatch');
  }
  const bytes = await verifiedBytes(STARTUP_TEXT_PIN.boundary, STARTUP_TEXT_PIN.boundary.bytes);
  const result = await instantiate(bytes, {});
  return createStartupTextBridge(result?.instance?.exports, language);
}
