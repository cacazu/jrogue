import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const task = path.dirname(here);
const upstream = process.argv[2];
if (!upstream) throw new Error('usage: node semantic-display-live-slice/prepare.mjs PRISTINE_UPSTREAM_ROOT');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fixed = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const base = JSON.parse(await readFile(path.join(task, 'help-semantic-slice/SOURCE-PREPARATION.json'), 'utf8'));
assert.equal(base.source_commit, fixed);
const pins = [];
async function pin(file) {
  const bytes = await readFile(file); pins.push({ path: path.relative(task, file).replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) }); return bytes;
}
await pin(path.join(task, 'help-semantic-slice/SOURCE-PREPARATION.json'));
await pin(path.join(task, 'help-semantic-slice/source-pins.json'));
const originals = [];
const files = [];
function replaceOne(source, needle, replacement) {
  assert.equal(source.split(needle).length, 2, 'exact unique anchor');
  return source.replace(needle, replacement);
}
for (const record of base.original_files) {
  const original = await pin(path.join(upstream, record.file));
  assert.equal(sha(original), record.original_sha256);
  let prepared = await pin(path.join(task, 'help-semantic-slice/generated', record.file));
  assert.equal(sha(prepared), record.prepared_sha256);
  if (record.file === 'src/help.cpp') {
    let source = prepared.toString('utf8');
    source = replaceOne(source, '#include "help.h"\n', '#include "help.h"\n#include "cdda_help_transport.h"\n');
    source = replaceOne(source, 'void help::display_help() const\n{\n', 'void help::display_help() const\n{\n    // Install the dedicated owned observer before the original native consumer.\n    cdda_help_transport::attach();\n');
    source = replaceOne(source, 'void help::reset()\n', 'std::optional<cdda_help_semantic::topic_metadata> help::observe_loaded_topic( const int order ) const noexcept\n{\n    try {\n        const auto found = semantic_help_topics.find( order );\n        if( found != semantic_help_topics.end() ) { return found->second; }\n    } catch( ... ) {}\n    return std::nullopt;\n}\n\nvoid help::reset()\n');
    prepared = Buffer.from(source);
  }
  if (record.file === 'src/help.h') {
    prepared = Buffer.from(replaceOne(prepared.toString('utf8'), '        static void reset();\n', '        static void reset();\n        // Owned UI-only metadata from the actual original loader; absent means legacy/failure.\n        std::optional<cdda_help_semantic::topic_metadata> observe_loaded_topic( int order ) const noexcept;\n'));
  }
  const destination = path.join(here, 'generated', record.file);
  await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, prepared);
  originals.push({ file: record.file, bytes: original.length, original_sha256: sha(original), inherited_prepared_sha256: record.prepared_sha256, prepared_sha256: sha(prepared) });
  files.push({ file: `generated/${record.file}`, bytes: prepared.length, sha256: sha(prepared) });
}
for (const record of base.new_files) {
  const inherited = await pin(path.join(task, 'help-semantic-slice/generated', record.file));
  assert.equal(sha(inherited), record.sha256);
  let bytes = inherited;
  if (record.file === 'src/cdda_help_semantic.h') {
    bytes = Buffer.from(replaceOne(inherited.toString('utf8'), 'void set_help_sink( help_sink sink ) noexcept;\n', 'void set_help_sink( help_sink sink ) noexcept;\n// Allocation-free failure signal; no borrowed record must be constructed.\nusing help_failure_sink = void ( * )();\nvoid set_help_failure_sink( help_failure_sink sink ) noexcept;\n'));
  }
  if (record.file === 'src/cdda_help_semantic.cpp') {
    let text = inherited.toString('utf8');
    text = replaceOne(text, 'help_sink active_help_sink = nullptr;\n', 'help_sink active_help_sink = nullptr;\nhelp_failure_sink active_help_failure_sink = nullptr;\n');
    text = replaceOne(text, 'void send_help( selected_help_observation &observation ) noexcept\n', 'void signal_help_failure() noexcept\n{\n    if( active_help_failure_sink == nullptr || in_callback ) { return; }\n    in_callback = true;\n    try { active_help_failure_sink(); } catch( ... ) {}\n    in_callback = false;\n}\n\nvoid send_help( selected_help_observation &observation ) noexcept\n');
    text = replaceOne(text, '        observation.engine_build_id = CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID;\n    } catch( ... ) {\n        return;\n', '        observation.engine_build_id = CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID;\n    } catch( ... ) {\n        signal_help_failure();\n        return;\n');
    text = replaceOne(text, '    in_callback = true;\n    try {\n        active_help_sink( observation );\n    } catch( ... ) {\n        // Observer failures cannot change original help or escape into its input loop.\n    }\n    in_callback = false;\n', '    bool failed = false;\n    in_callback = true;\n    try {\n        active_help_sink( observation );\n    } catch( ... ) {\n        failed = true;\n    }\n    in_callback = false;\n    if( failed ) { signal_help_failure(); }\n');
    text = replaceOne(text, '        // Even an inability to allocate the unavailable envelope is observer-only.\n        // A future transport must invalidate host state on pin/publication failure.\n', '        // No allocating envelope is required to clear the attached host observation.\n        signal_help_failure();\n');
    text = replaceOne(text, 'void set_name_sink( const name_sink sink ) noexcept\n', 'void set_help_failure_sink( const help_failure_sink sink ) noexcept\n{\n    active_help_failure_sink = sink;\n}\nvoid set_name_sink( const name_sink sink ) noexcept\n');
    bytes = Buffer.from(text);
  }
  await writeFile(path.join(here, 'generated', record.file), bytes);
  files.push({ file: `generated/${record.file}`, bytes: bytes.length, sha256: sha(bytes) });
}
for (const file of ['cdda_help_transport.cpp', 'cdda_help_transport.h']) {
  const bytes = await readFile(path.join(here, 'cpp', file)); await writeFile(path.join(here, 'generated/src', file), bytes);
  files.push({ file: `generated/src/${file}`, bytes: bytes.length, sha256: sha(bytes) });
}
for (const file of ['locales/en.json', 'locales/ja.json', 'registry.json', 'text-programs.json', 'structured-direction-grid.json', 'LICENSE-UPSTREAM.txt']) {
  const bytes = await pin(path.join(task, 'help-semantic-slice', file));
  await writeFile(path.join(here, file), bytes); files.push({ file, bytes: bytes.length, sha256: sha(bytes) });
}
await pin(path.join(upstream, 'src/input_enums.h'));
await pin(path.join(upstream, 'src/point.h'));
// Complete-file reversible patch: these are six coordinated original owners, not
// independently applied pristine diffs on input_context. Root merges exact anchors.
const split = buffer => { const value = buffer.toString('utf8'); assert.ok(value.endsWith('\n')); return value.slice(0, -1).split('\n'); };
let patch = '';
for (const record of originals) {
  const before = await readFile(path.join(upstream, record.file));
  const after = await readFile(path.join(here, 'generated', record.file));
  const old = split(before), next = split(after);
  patch += `diff --git a/${record.file} b/${record.file}\n--- a/${record.file}\n+++ b/${record.file}\n@@ -1,${old.length} +1,${next.length} @@\n${old.map(line => `-${line}\n`).join('')}${next.map(line => `+${line}\n`).join('')}`;
}
for (const record of files.filter(record => record.file.startsWith('generated/src/') && !originals.some(item => `generated/${item.file}` === record.file))) {
  const file = record.file.slice('generated/'.length), lines = split(await readFile(path.join(here, record.file)));
  patch += `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line => `+${line}\n`).join('')}`;
}
await writeFile(path.join(here, 'semantic-help-transport.patch'), patch);
const result = { schema_version: 1, source_commit: fixed, status: 'source_prepared_uncompiled_unconnected', wire_text_ids: 7, inherited_catalog_ids: 14, new_semantic_ids: 0, original_files: originals, files, inherited_pins: pins, patch_sha256: sha(Buffer.from(patch)), applied_to_pristine: false, compiled: false, cpp_sink_installed_in_generated_source: true, real_producer_executed: false, rust_acceptance: false, browser_integrated: false };
await writeFile(path.join(here, 'SOURCE-PREPARATION.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, files: files.length, inherited_pins: pins.length, patch_sha256: result.patch_sha256 }));
