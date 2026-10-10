// Staging generator only. Never reads or writes the installed engine.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const pins = {
  'core-worker.js': '1fc57fc6c58d14b0b2e2ebe48480fa65aea9a1218c6a04e6779ab52641d15b04',
  'core-debug.mjs': 'eb6ddd2e782752f8dc4b5baa553abd0e9ea15ae5afda924e46052142c00a91a1',
  'library.js': 'ffdad020054a28f92e7030a9199cefcbee59dc332264091173b72e214647a6a5',
  'newgame.cc': 'b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c',
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function base(name) {
  const bytes = readFileSync(join(root, 'base', name));
  if (hash(bytes) !== pins[name]) throw new Error('staged base source changed: ' + name);
  return bytes.toString('utf8').replace(/\r\n/g, '\n');
}
function replaceOnce(text, before, after) {
  if (text.split(before).length !== 2) throw new Error('expected exactly one pinned anchor: ' + before);
  return text.replace(before, after);
}
const transformations = {};
function output(relative, name, text, edits) {
  writeFileSync(join(root, relative), text, 'utf8');
  transformations[relative] = { installed_path: relative === 'engine/newgame.cc'
    ? 'engine/work/crawl-ref/source/newgame.cc' : relative,
    base_sha256: pins[name], staged_sha256: hash(Buffer.from(text)), edits };
}

let worker = base('core-worker.js');
worker = replaceOnce(worker, "let runtime = 'asyncify';", "let runtime = 'asyncify';\nlet startupText = null;");
worker = replaceOnce(worker, "  booting = true;\n  const build =", `  booting = true;
  // This native widget locale is pinned for the session. Main-thread log/label
  // language changes do not relocalize already constructed C++ Text widgets.
  const { loadStartupTextBridge } = await import('/web/startup-text.mjs');
  if (terminal()) throw failure ?? new Error('engine session completed');
  startupText = await loadStartupTextBridge(request.language ?? 'ja');
  if (terminal()) throw failure ?? new Error('engine session completed');
  const build =`);
worker = replaceOnce(worker, "    locateFile: name => build + name,", `    locateFile: name => build + name,
    dcssFormatStartup(id, params) {
      if (terminal()) throw failure ?? new Error('engine session completed');
      return startupText.format(id, params);
    },
    dcssStartupTextError(reason) {
      // The native helper subsequently follows end(1); never inject a key or
      // reinterpret this as user cancellation. This is a separate diagnostic.
      self.postMessage({ type: 'startup-text-error', error: String(reason) });
    },`);
output('web/core-worker.js', 'core-worker.js', worker, 3);

let debug = base('core-debug.mjs');
debug = replaceOnce(debug, "export async function startCore(harness) {", `export async function startCore(harness) {
  // Native Text construction uses this boot locale for the entire session.
  const nativeLanguage = harness.language ?? 'ja';
  if (nativeLanguage !== 'ja' && nativeLanguage !== 'en') throw new Error('unsupported native startup locale');`);
debug = replaceOnce(debug, "      } else if (data.type === 'semantic-error') {", `      } else if (data.type === 'startup-text-error') {
        // Unlike an optional observer, a failed native display bridge rejects
        // the session. It does not enter the canned-message stream.
        fail(new Error(data.error || 'native startup localization failed'));
      } else if (data.type === 'semantic-error') {`);
debug = replaceOnce(debug, '    get waiting() { return waiting; },', '    get nativeLanguage() { return nativeLanguage; },\n    get waiting() { return waiting; },');
debug = replaceOnce(debug, "    await request('boot', { files, runtime });", "    await request('boot', { files, runtime, language: nativeLanguage });");
output('web/core-debug.mjs', 'core-debug.mjs', debug, 4);

let library = base('library.js');
const importCode = `  // Synchronous presentation import. Rust and C++ have separate memories.
  dcss_host_startup_text__deps: ['$UTF8ToString', '$lengthBytesUTF8', '$stringToUTF8'],
  dcss_host_startup_text: function(idPtr, paramsPtr, destination, capacity) {
    try {
      if (!Number.isInteger(capacity) || capacity !== 512 || !destination
          || destination < 0 || destination + capacity > HEAPU8.length) {
        throw new Error('invalid native startup destination');
      }
      if (!idPtr || idPtr < 0 || idPtr + 22 > HEAPU8.length
          || !paramsPtr || paramsPtr < 0 || paramsPtr + 3 > HEAPU8.length) {
        throw new Error('invalid native startup descriptor');
      }
      const id = UTF8ToString(idPtr, 22);
      const paramsJson = UTF8ToString(paramsPtr, 3);
      if (id !== 'startup.weapon.prompt' || paramsJson !== '{}'
          || HEAPU8[idPtr + 21] !== 0 || HEAPU8[paramsPtr + 2] !== 0) {
        throw new Error('unreviewed native startup descriptor');
      }
      if (typeof Module.dcssFormatStartup !== 'function') throw new Error('native startup formatter unavailable');
      const text = Module.dcssFormatStartup(id, {});
      if (typeof text !== 'string' || !text.length || text.indexOf('\\0') !== -1) {
        throw new Error('native startup formatter must return plain text synchronously');
      }
      if (text !== 'You have a choice of weapons.'
          && text !== '\\u6b66\\u5668\\u3092\\u9078\\u3079\\u307e\\u3059\\u3002') {
        throw new Error('native startup text differs from the reviewed en/ja slice');
      }
      const length = lengthBytesUTF8(text);
      if (length >= capacity) throw new Error('native startup text exceeds destination');
      // Re-read the current heap after the callback; never use Module.HEAPU8.
      if (destination + capacity > HEAPU8.length) throw new Error('native startup destination changed');
      stringToUTF8(text, destination, capacity);
      return length;
    } catch (error) {
      try { if (typeof Module.dcssStartupTextError === 'function') Module.dcssStartupTextError(String(error)); }
      catch (_) { /* No diagnostic may throw into the native fatal route. */ }
      return -1;
    }
  },
`;
library = replaceOnce(library, 'mergeInto(LibraryManager.library, {\n', 'mergeInto(LibraryManager.library, {\n' + importCode);
output('engine/library.js', 'library.js', library, 1);

let native = base('newgame.cc');
const nativeHelper = `// BEGIN jrogue startup-weapon-prompt adapter v1
// Source: DCSS 0.34.1 newgame.cc:1837; params={}, CYAN and controls unchanged.
// No public header is changed. Only this compilation unit needs rebuilding.
#ifdef __EMSCRIPTEN__
extern "C" int dcss_host_startup_text(const char*, const char*, char*, int);
#endif
static string _dcss_startup_weapon_prompt()
{
#ifdef __EMSCRIPTEN__
    char text[512] = {};
    const int length = dcss_host_startup_text("startup.weapon.prompt", "{}",
                                             text, sizeof(text));
    if (length <= 0 || length >= static_cast<int>(sizeof(text))
        || text[length] != '\\0' || string(text, length).find('\\0') != string::npos)
    {
        // end with a message would invoke a fatal-error popup requiring input.
        // Report the technical error, then use the existing nonzero exit route.
        fprintf(stderr, "Native startup localization failed.\\n");
        end(1);
    }
    return string(text, length);
#else
    return "You have a choice of weapons.";
#endif
}
// END jrogue startup-weapon-prompt adapter v1

`;
native = replaceOnce(native, 'using namespace ui;\n\n', 'using namespace ui;\n\n' + nativeHelper);
native = replaceOnce(native,
  '    auto prompt = make_shared<Text>(formatted_string("You have a choice of weapons.", CYAN));',
  '    auto prompt = make_shared<Text>(formatted_string(_dcss_startup_weapon_prompt(), CYAN));');
output('engine/newgame.cc', 'newgame.cc', native, 2);

writeFileSync(join(root, 'source-receipts.json'), JSON.stringify({
  schema_version: 1, upstream: '1eebc1a2892e1c89776a0d7a10691f8dac8d9796', release: '0.34.1',
  scope: 'one native ui::Text startup.weapon.prompt; no runtime execution',
  transformations,
  new_files: { 'web/startup-text.mjs': {
    installed_path: 'web/startup-text.mjs', staged_sha256: hash(readFileSync(join(root, 'web/startup-text.mjs'))),
  } },
  review_files: Object.fromEntries(['prepare.mjs', 'tests/bridge.test.mjs', 'README.md'].map(path =>
    [path, { install: false, staged_sha256: hash(readFileSync(join(root, path))) }])),
}, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, staged: Object.keys(transformations), installed: false }));
