// Native Text display formatter. GPL-3.0-or-later. Synchronous Rust instance only.
export const STARTUP_TEXT_PIN = /* GENERATED_REVIEWED_PIN */;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const MAX_REQUEST = 4096, MAX_RESPONSE = 8192, MAX_NATIVE_BYTES = 511;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => object(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
function freeze(value) {
  if (object(value) || Array.isArray(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
freeze(STARTUP_TEXT_PIN);
function locale(value) {
  if (value !== 'en' && value !== 'ja') throw Error('unsupported native display locale');
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function entity(value, domain) {
  if (!keys(value, ['kind', 'version', 'upstream', 'domain', 'id', 'form']) || value.kind !== 'entity_label'
      || value.version !== 1 || value.upstream !== STARTUP_TEXT_PIN.upstream || value.domain !== domain || value.form !== 'name'
      || typeof value.id !== 'string' || !Object.hasOwn(STARTUP_TEXT_PIN.entityRegistry[domain], value.id))
    throw Error('unreviewed native entity label descriptor');
  return value.id;
}
function actor(value) {
  if (!keys(value, ['kind', 'version', 'upstream', 'form', 'identity']) || value.kind !== 'actor_label' || value.version !== 1
      || value.upstream !== STARTUP_TEXT_PIN.upstream || value.form !== 'name' || !keys(value.identity, ['visibility', 'name'])
      || value.identity.visibility !== 'external' || typeof value.identity.name !== 'string'
      || !value.identity.name.length || /\p{Cc}/u.test(value.identity.name)
      || Array.from(value.identity.name).some(character => {const point=character.codePointAt(0);return point>=0xd800&&point<=0xdfff;})
      || encoder.encode(value.identity.name).length > STARTUP_TEXT_PIN.externalNameBytes)
    throw Error('unreviewed native external actor descriptor');
  return value.identity.name;
}
export function validateNativeDisplayMessage(id, params) {
  if (typeof id !== 'string' || !Object.hasOwn(STARTUP_TEXT_PIN.messages, id)) throw Error('unreviewed native display ID');
  const schema = STARTUP_TEXT_PIN.messages[id].parameters;
  if (!keys(params, Object.keys(schema))) throw Error('unreviewed native display parameter keys');
  for (const [key, descriptor] of Object.entries(schema)) {
    if (descriptor.type === 'entity_label') entity(params[key], descriptor.role);
    else if (descriptor.type === 'actor_label') actor(params[key]);
    else throw Error('unreviewed native display parameter type');
  }
  if (encoder.encode(JSON.stringify(params)).length > 2047) throw Error('native display parameters exceed reviewed bound');
}
export function expectedNativeDisplayText(id, params, language) {
  validateNativeDisplayMessage(id, params); locale(language);
  const message = STARTUP_TEXT_PIN.messages[id];
  const values = Object.fromEntries(Object.entries(message.parameters).map(([key, schema]) => [key,
    schema.type === 'entity_label' ? STARTUP_TEXT_PIN.entityRegistry[schema.role][entity(params[key], schema.role)][language] : actor(params[key])]));
  const text = message[language].replace(/\{([a-z][a-z0-9_]*)\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw Error('reviewed native template has an unknown placeholder');
    return values[key];
  });
  if (text.includes('\0') || encoder.encode(text).length > MAX_NATIVE_BYTES) throw Error('native display result exceeds reviewed buffer');
  return text;
}
function range(memory, pointer, length) {
  if (!Number.isInteger(pointer) || pointer <= 0 || !Number.isInteger(length) || length <= 0 || pointer + length > memory.buffer.byteLength)
    throw Error('invalid Rust native-display ABI range');
}
export function createStartupTextBridge(exports, language = 'ja') {
  locale(language);
  if (!(exports?.memory instanceof WebAssembly.Memory) || ['dcss_allocate', 'dcss_request', 'dcss_release'].some(name => typeof exports[name] !== 'function')
      || exports.dcss_allocate.length !== 1 || exports.dcss_request.length !== 2 || exports.dcss_release.length !== 2) throw Error('unsupported Rust native-display ABI');
  let busy = false;
  function render(id, params, requestedLanguage) {
    const expected = expectedNativeDisplayText(id, params, requestedLanguage);
    if (busy) throw Error('reentrant Rust native-display formatting');
    const inputBytes = encoder.encode(JSON.stringify({ language: requestedLanguage, op: 'text', message: { id, params } }));
    if (!inputBytes.length || inputBytes.length > MAX_REQUEST) throw Error('native-display request exceeds reviewed bound');
    let input = 0, output = 0, length = 0, inputOwned = false, outputOwned = false; busy = true;
    try {
      const allocated = exports.dcss_allocate(inputBytes.length);
      if (!Number.isInteger(allocated) || allocated < -0x80000000 || allocated > 0xffffffff) throw Error('invalid Rust native-display allocation');
      input = allocated >>> 0; range(exports.memory, input, inputBytes.length); inputOwned = true;
      new Uint8Array(exports.memory.buffer, input, inputBytes.length).set(inputBytes);
      const packed = exports.dcss_request(input, inputBytes.length);
      if (typeof packed !== 'bigint' || packed <= 0n || packed > 0xffffffffffffffffn) throw Error('invalid Rust native-display response descriptor');
      output = Number(packed & 0xffffffffn); length = Number(packed >> 32n);
      if (length > MAX_RESPONSE) throw Error('Rust native-display response exceeds reviewed bound');
      range(exports.memory, output, length);
      if (output < input + inputBytes.length && input < output + length) throw Error('Rust native-display output aliases input');
      outputOwned = true;
      const response = JSON.parse(decoder.decode(new Uint8Array(exports.memory.buffer, output, length)));
      if (!keys(response, ['ok', 'value', 'session', 'messages', 'text']) || response.ok !== true || response.value !== null || response.session !== null
          || !Array.isArray(response.messages) || response.messages.length !== 1 || !keys(response.messages[0], ['id', 'params'])
          || response.messages[0].id !== id || canonical(response.messages[0].params) !== canonical(params)
          || !Array.isArray(response.text) || response.text.length !== 1 || response.text[0] !== expected)
        throw Error('Rust native-display response differs from reviewed descriptor/catalog');
      return response.text[0];
    } finally {
      try { if (outputOwned) exports.dcss_release(output, length); }
      finally { try { if (inputOwned) exports.dcss_release(input, inputBytes.length); } finally { busy = false; } }
    }
  }
  for (const id of STARTUP_TEXT_PIN.ids) for (const language of ['en', 'ja']) render(id, STARTUP_TEXT_PIN.messages[id].preflight_params, language);
  return Object.freeze({ language, format(id, params) { return render(id, params, language); } });
}
export async function loadStartupTextBridge(language = 'ja', dependencies = {}) {
  locale(language);
  const fetcher = dependencies.fetcher ?? globalThis.fetch, crypto = dependencies.crypto ?? globalThis.crypto;
  const instantiate = dependencies.instantiate ?? WebAssembly.instantiate;
  if (typeof fetcher !== 'function' || !crypto?.subtle || typeof instantiate !== 'function') throw Error('native display preflight dependencies unavailable');
  if (!/^[a-f0-9]{64}$/.test(STARTUP_TEXT_PIN.boundary.sha256) || STARTUP_TEXT_PIN.boundary.bytes <= 0) throw Error('native v2 boundary pin awaits reviewed Rust build');
  async function bytes(pin, limit) {
    const response = await fetcher(pin.path, { cache: 'no-store' });
    if (!response?.ok) throw Error('native display artifact fetch failed: ' + pin.path);
    const buffer = await response.arrayBuffer();
    if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.byteLength > limit || (pin.bytes !== undefined && buffer.byteLength !== pin.bytes)) throw Error('native display artifact size mismatch');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    if (Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('') !== pin.sha256) throw Error('native display artifact checksum mismatch: ' + pin.path);
    return new Uint8Array(buffer);
  }
  const assets = {};
  for (const pin of STARTUP_TEXT_PIN.catalogs) assets[pin.path] = JSON.parse(decoder.decode(await bytes(pin, 256 * 1024)));
  for (const [id, expected] of Object.entries(STARTUP_TEXT_PIN.messages)) {
    const source = assets[expected.source_map], receipt = source?.messages?.find(message => message.id === id);
    const enEntry = assets[expected.en_catalog]?.[id], jaEntry = assets[expected.ja_catalog]?.[id];
    const enText = typeof enEntry === 'string' ? enEntry : enEntry?.text;
    const jaText = typeof jaEntry === 'string' ? jaEntry : jaEntry?.text;
    if (source?.schema_version !== 1 || source.commit !== STARTUP_TEXT_PIN.upstream || source.release !== STARTUP_TEXT_PIN.release
        || !source.source_files?.some(file => file.path.replace(/^upstream\//,'') === expected.native_source && file.sha256 === STARTUP_TEXT_PIN.nativeSources[expected.native_source])
        || enText !== expected.en || jaText !== expected.ja
        || receipt?.expected_en !== expected.en || !Array.isArray(receipt.source_sites) || !receipt.source_sites.includes(expected.source_site))
      throw Error('native display source binding mismatch: ' + id);
    // The descriptor schemas are generated from the reviewed dynamic source map;
    // scalar startup/HUD bindings must still carry exactly empty parameters.
    if (Object.keys(expected.parameters).length === 0 && !keys(receipt.params, [])) throw Error('fixed native display source parameters changed');
    if (canonical(receipt.params) !== canonical(expected.source_params)) throw Error('native display source parameter schema mismatch: ' + id);
    if (expected.catalog_shape === 'typed' && (!keys(enEntry,['text','params'])||!keys(jaEntry,['text','params'])
        || canonical(enEntry.params)!==canonical(expected.source_params)
        || canonical(jaEntry.params)!==canonical(expected.source_params))) throw Error('dynamic catalog descriptor schema mismatch: '+id);
    if (expected.catalog_shape === 'string' && (typeof enEntry!=='string'||typeof jaEntry!=='string'))
      throw Error('fixed native catalog value must be a string: '+id);
  }
  const registry = assets['/locales/entities/source-map.json'];
  if (registry?.schema_version !== 1 || registry.commit !== STARTUP_TEXT_PIN.upstream || registry.release !== STARTUP_TEXT_PIN.release) throw Error('native entity registry source mismatch');
  for (const domain of ['species', 'job']) for (const [id, value] of Object.entries(STARTUP_TEXT_PIN.entityRegistry[domain])) {
    const record = registry.records?.find(record => record.kind === domain && record.name_id === id);
    if (!record || record.identity !== value.identity || record.name !== value.en || assets['/locales/entities/' + (domain === 'job' ? 'jobs' : 'species') + '.en.json']?.[id] !== value.en
        || assets['/locales/entities/' + (domain === 'job' ? 'jobs' : 'species') + '.ja.json']?.[id] !== value.ja) throw Error('native entity name binding mismatch: ' + id);
  }
  const result = await instantiate(await bytes(STARTUP_TEXT_PIN.boundary, STARTUP_TEXT_PIN.boundary.bytes), {});
  return createStartupTextBridge(result?.instance?.exports, language);
}
