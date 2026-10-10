// Source-only rebase. Never builds or edits installed files.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const installed = 'C:/Users/kit/gameme/jnethack/jrouge/dcss';
const archive = path.join(installed, 'engine/migration-staging/startup-fixed-weapon-labels');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(file);
const normalize = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n');
const original = read(path.join(installed, 'upstream/crawl-ref/source/newgame.cc'));
if (hash(original) !== 'b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c') throw Error('original native unit pin mismatch');
const receipt = JSON.parse(read(path.join(archive, 'source-receipts.json')));
const bindings = receipt.bindings;
for (const [relative, expected] of Object.entries(receipt.source_pins)) {
  if (hash(read(path.join(installed, relative))) !== expected) throw Error('source/catalog pin mismatch: ' + relative);
}
const archivedCpp = read(path.join(archive, 'engine/newgame.cc'));
if (hash(archivedCpp) !== receipt.transformations['engine/newgame.cc'].staged_sha256) throw Error('archive cpp pin mismatch');
const cpp = normalize(archivedCpp);
const marker = '// BEGIN jrogue startup-fixed-weapon adapter v1\n';
const finish = '// END jrogue startup-fixed-weapon adapter v1\n\n';
const start = cpp.indexOf(marker), end = cpp.indexOf(finish, start);
if (start < 0 || end < start) throw Error('missing reviewed helper');
const helper = cpp.slice(start, end + finish.length);
const actions = [{ before: '', after: helper, insertion_anchor: 'using namespace ui;\n\n' }];
let restored = cpp.replace(helper, '');
for (const binding of bindings) {
  const before = JSON.stringify(binding.en);
  const after = `_dcss_startup_fixed_text(${JSON.stringify(binding.id)}, ${before})`;
  if (restored.split(after).length !== 2) throw Error('nonunique reviewed native binding ' + binding.id);
  restored = restored.replace(after, before);
  actions.push({ before, after, source_site: binding.source_site });
}
if (restored !== normalize(original)) throw Error('native unit does not invert exactly to immutable original');
const libraryBase = read(path.join(installed, 'engine/library.js'));
if (hash(libraryBase) !== 'ffdad020054a28f92e7030a9199cefcbee59dc332264091173b72e214647a6a5') throw Error('current library base pin mismatch');
const archivedLibrary = read(path.join(archive, 'engine/library.js'));
if (hash(archivedLibrary) !== receipt.transformations['engine/library.js'].staged_sha256) throw Error('archived library pin mismatch');
const a = normalize(archivedLibrary), importStart = a.indexOf('  // Future fixed weapon texts.'), importEnd = a.indexOf('  dcss_host_frame:', importStart);
if (importStart < 0 || importEnd < importStart) throw Error('missing strict reviewed import');
const importText = a.slice(importStart, importEnd);
let library = libraryBase.toString('utf8');
const anchor = 'mergeInto(LibraryManager.library, {';
if (library.split(anchor).length !== 2 || library.includes('dcss_host_startup_text')) throw Error('current library import placement mismatch');
const insertion = library.includes('\r\n') ? importText.replace(/\n/g, '\r\n') : importText;
library = library.replace(anchor, anchor + (library.includes('\r\n') ? '\r\n' : '\n') + insertion.replace(/\r?\n$/, ''));
const bridge = read(path.join(archive, 'web/startup-text.mjs'));
if (hash(bridge) !== receipt.transformations['web/startup-text.mjs'].staged_sha256) throw Error('archive bridge pin mismatch');
function emit(relative, bytes) {
  const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes);
  return { path: relative, bytes: fs.statSync(file).size, sha256: hash(read(file)) };
}
const files = [emit('engine/newgame.cc', cpp), emit('engine/library.js', library), emit('web/startup-text.mjs', bridge)];
emit('base/engine/library.js', libraryBase); emit('base/engine/newgame.cc', original);
emit('base/web/startup-text.mjs', read(path.join(installed, 'web/startup-text.mjs')));
const result = { schema_version: 2, scope: 'startup-fixed-weapon-v1 rebase; staged only', upstream: '1eebc1a2892e1c89776a0d7a10691f8dac8d9796',
  source_pins: receipt.source_pins, ids: receipt.ids, bindings, files,
  native_overrides: [{ native_path: 'crawl-ref/source/newgame.cc', object_index: 170, original_sha256: hash(original), final_sha256: hash(Buffer.from(cpp)),
    comparison: 'normalize CRLF to LF, then exact whole original bytes/text', inverse_actions: actions }],
  library_base_sha256: hash(libraryBase), library_insert: { anchor, after: insertion.replace(/\r?\n$/, '') },
  bridge: { boundary_pin_changed: false, rust_execution: false, fixed_ids: 11, en_ja_preflight_calls: 22 },
  controls_and_descriptions: receipt.description_visibility_evidence, original_catalogs_unchanged: true, installed_files_changed: false };
emit('fixed-source-receipts.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, source_only: true, ids: 11, files }));
