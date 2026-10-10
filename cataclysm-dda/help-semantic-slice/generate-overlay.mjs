import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REVIEWED_LABELS, REVIEWED_HELP, GRID_CELLS, SOURCE_COMMIT, sha256, loadBoundSources } from './prepare.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const upstreamRoot = process.argv[2];
if (!upstreamRoot) throw new Error('usage: node help-semantic-slice/generate-overlay.mjs PRISTINE_UPSTREAM_ROOT');
const source = await loadBoundSources(upstreamRoot);
const pins = JSON.parse(await readFile(path.join(out, 'source-pins.json'), 'utf8'));
for (const [file, bytes] of source.bytes) assert.equal(sha256(bytes), pins.files[file].sha256, `${file}: changed source pin`);
const quoted = value => JSON.stringify(value);
const expected = source.help[1].messages;
const messageIds = expected.map((_, index) => REVIEWED_HELP.find(record => record.pointer === `/1/messages/${index}`)?.id ?? null);
const presses = source.records.flatMap(record => Object.entries(record.typed_key_parameters).map(([parameter, ref]) => ({ id: record.id, parameter, action: ref.action })));
const definitions = `// Reviewed original owner bindings, generated without changing English prose.\nnamespace {\nstruct reviewed_label { const char *id; const char *category; const char *action; const char *singular; };\nconst std::array<reviewed_label, 7> reviewed_labels = {{\n${REVIEWED_LABELS.map(record => `    { ${[record.id, record.category, record.action, record.singular].map(quoted).join(', ')} },`).join('\n')}\n}};\nconst std::array<const char *, 6> reviewed_movement_messages = {{\n${expected.map(text => `    ${quoted(text)},`).join('\n')}\n}};\nconst std::array<const char *, 6> reviewed_movement_ids = {{\n${messageIds.map(id => `    ${id === null ? 'nullptr' : quoted(id)},`).join('\n')}\n}};\nstruct reviewed_press { const char *id; const char *parameter; const char *action; };\nconst std::array<reviewed_press, 5> reviewed_press_parameters = {{\n${presses.map(record => `    { ${[record.id, record.parameter, record.action].map(quoted).join(', ')} },`).join('\n')}\n}};\nstruct reviewed_grid_cell { const char *role; const char *action; int row; int column; };\nconst std::array<reviewed_grid_cell, 9> reviewed_grid_cells = {{\n${GRID_CELLS.map(cell => `    { ${quoted(cell.role)}, ${quoted(cell.action)}, ${cell.row}, ${cell.column} },`).join('\n')}\n}};\n} // namespace\n`;
await writeFile(path.join(out, 'cpp/reviewed_definitions.inc'), definitions);
const inputMembers = await readFile(path.join(out, 'cpp/input-context-members.inc'), 'utf8');
const edits = new Map();
function edit(file, needle, replacement) {
  const text = source.bytes.get(file).toString('utf8');
  const offset = text.indexOf(needle);
  assert.ok(offset >= 0 && text.indexOf(needle, offset + 1) < 0, `${file}: anchor must occur exactly once`);
  assert.ok(offset === 0 || text[offset - 1] === '\n', `${file}: edit must start at line boundary`);
  assert.ok(needle.endsWith('\n') && replacement.endsWith('\n'));
  const list = edits.get(file) ?? [];
  list.push({ offset, needle, replacement }); edits.set(file, list);
}

edit('src/input.h', '    translation name;\n', '    translation name;\n    // Reviewed UI-only semantic metadata; empty means unconverted legacy name.\n    std::string semantic_name_id;\n');
edit('src/input.cpp', '            action.read( "name", actions[action_id].name );\n', '            action.read( "name", actions[action_id].name );\n            actions[action_id].semantic_name_id = cdda_help_semantic::bind_keybinding_name(\n                    file_name, is_user_preferences, context, action_id, action );\n');
edit('src/input.cpp', '#include "input.h"\n', '#include "input.h"\n#include "cdda_help_semantic.h"\n');
edit('src/input_context.h', '#include "input_enums.h"\n', '#include "input_enums.h"\n#include "cdda_help_semantic.h"\n');
edit('src/input_context.h', '        std::map<std::string, translation> action_name_overrides;\n', '        std::map<std::string, translation> action_name_overrides;\n        std::map<std::string, std::string> semantic_action_name_overrides;\n');
edit('src/input_context.h', '        std::string get_action_name( const std::string &action_id ) const;\n', '        std::string get_action_name( const std::string &action_id ) const;\n        // Owned, const sidecar observations; neither invokes input nor lazy insertion.\n        cdda_help_semantic::binding_observation observe_semantic_bindings(\n            const std::string &action_id ) const;\n        cdda_help_semantic::name_observation get_semantic_action_name(\n            const std::string &action_id ) const;\n        void register_action_semantic( const std::string &action_descriptor,\n                                      const translation &name, const std::string &semantic_id );\n');
edit('src/input_context.h', '            action_name_overrides = other.action_name_overrides;\n', '            action_name_overrides = other.action_name_overrides;\n            semantic_action_name_overrides = other.semantic_action_name_overrides;\n');
edit('src/input_context.cpp', '#include <set>\n', '#include <set>\n#include <stdexcept>\n');
edit('src/input_context.cpp', '        action_name_overrides[action_descriptor] = name;\n', '        action_name_overrides[action_descriptor] = name;\n        // A later ordinary override invalidates an earlier explicit semantic sidecar.\n        semantic_action_name_overrides.erase( action_descriptor );\n');
edit('src/input_context.cpp', 'std::string input_context::get_action_name( const std::string &action_id ) const\n{\n', `${inputMembers}\nstd::string input_context::get_action_name( const std::string &action_id ) const\n{\n    cdda_help_semantic::observe_action_name( *this, action_id );\n`);
edit('src/help.h', '#include "translation.h"\n', '#include "translation.h"\n#include "cata_path.h"\n#include "cdda_help_semantic.h"\n');
edit('src/help.h', 'class JsonObject;\n', 'class JsonObject;\nclass cata_path;\n');
edit('src/help.h', '        static void load( const JsonObject &jo, const std::string &src );\n', '        static void load( const JsonObject &jo, const std::string &src,\n                          const cata_path &base_path = cata_path(),\n                          const cata_path &full_path = cata_path() );\n');
edit('src/help.h', '        void load_object( const JsonObject &jo, const std::string &src );\n', '        void load_object( const JsonObject &jo, const std::string &src,\n                          const cata_path &full_path );\n');
edit('src/help.h', '        std::map<int, std::pair<translation, std::vector<translation>>> help_texts;\n', '        std::map<int, std::pair<translation, std::vector<translation>>> help_texts;\n        std::map<int, cdda_help_semantic::topic_metadata> semantic_help_topics;\n');
edit('src/help.cpp', 'void help::load( const JsonObject &jo, const std::string &src )\n{\n    get_help().load_object( jo, src );\n}\n', 'void help::load( const JsonObject &jo, const std::string &src,\n                 const cata_path &, const cata_path &full_path )\n{\n    get_help().load_object( jo, src, full_path );\n}\n');
edit('src/help.cpp', '    help_texts.clear();\n', '    help_texts.clear();\n    semantic_help_topics.clear();\n');
edit('src/help.cpp', 'void help::load_object( const JsonObject &jo, const std::string &src )\n', 'void help::load_object( const JsonObject &jo, const std::string &src,\n                        const cata_path &full_path )\n');
edit('src/help.cpp', '        jo.throw_error_at( "order", "\\\"order\\\" must be unique (per src)" );\n    }\n', '        jo.throw_error_at( "order", "\\\"order\\\" must be unique (per src)" );\n    }\n    const auto semantic = cdda_help_semantic::bind_movement_topic( full_path, src, name, messages );\n    if( semantic.has_value() ) {\n        try {\n            semantic_help_topics.emplace( modified_order, *semantic );\n        } catch( ... ) {\n            // Original successfully loaded help remains available through gettext.\n        }\n    }\n');
edit('src/help.cpp', '        cat_name += text.second.first.translated();\n', '        const auto semantic_topic = semantic_help_topics.find( text.first );\n        if( semantic_topic != semantic_help_topics.end() ) {\n            cdda_help_semantic::observe_topic_name( semantic_topic->second );\n        }\n        cat_name += text.second.first.translated();\n');
edit('src/help.cpp', '                std::vector<std::string> i18n_help_texts;\n', '                const auto semantic_topic = semantic_help_topics.find( hotkey_entry.first );\n                cdda_help_semantic::selected_help_scope semantic_scope(\n                    semantic_topic == semantic_help_topics.end() ? nullptr : &semantic_topic->second );\n                std::vector<std::string> i18n_help_texts;\n');

function lineParts(value) { assert.ok(value.endsWith('\n')); return value.slice(0, -1).split('\n'); }
export function buildModified(text, changes) {
  const sorted = [...changes].sort((a, b) => a.offset - b.offset);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1].offset + sorted[i - 1].needle.length <= sorted[i].offset, 'overlapping replacement');
  let result = text;
  for (const change of sorted.toReversed()) result = result.slice(0, change.offset) + change.replacement + result.slice(change.offset + change.needle.length);
  return result;
}
function unified(file, text, changes) {
  const original = lineParts(text);
  const spans = [...changes].sort((a, b) => a.offset - b.offset).map(change => ({ ...change, start: text.slice(0, change.offset).split('\n').length - 1, oldLines: lineParts(change.needle), newLines: lineParts(change.replacement) }));
  const groups = [];
  for (const span of spans) {
    const start = Math.max(0, span.start - 3), end = Math.min(original.length, span.start + span.oldLines.length + 3);
    const previous = groups.at(-1);
    if (previous && start <= previous.end) { previous.end = Math.max(previous.end, end); previous.spans.push(span); }
    else groups.push({ start, end, spans: [span] });
  }
  let patch = `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n`, delta = 0;
  for (const group of groups) {
    const adjustment = group.spans.reduce((sum, span) => sum + span.newLines.length - span.oldLines.length, 0);
    patch += `@@ -${group.start + 1},${group.end - group.start} +${group.start + delta + 1},${group.end - group.start + adjustment} @@\n`;
    let cursor = group.start;
    for (const span of group.spans) {
      patch += original.slice(cursor, span.start).map(line => ` ${line}\n`).join('');
      patch += span.oldLines.map(line => `-${line}\n`).join('');
      patch += span.newLines.map(line => `+${line}\n`).join('');
      cursor = span.start + span.oldLines.length;
    }
    patch += original.slice(cursor, group.end).map(line => ` ${line}\n`).join('');
    delta += adjustment;
  }
  return patch;
}

await mkdir(path.join(out, 'generated/src'), { recursive: true });
const manifest = { schema_version: 1, source_commit: SOURCE_COMMIT, status: 'source_prepared_uncompiled_unconnected', original_files: [], new_files: [], applied_to_pristine: false, compiled: false, rust_consumer_connected: false, native_help_replaced: false };
let patch = '';
for (const [file, changes] of edits) {
  const original = source.bytes.get(file).toString('utf8');
  const modified = buildModified(original, changes);
  await writeFile(path.join(out, 'generated', file), modified);
  manifest.original_files.push({ file, original_sha256: sha256(Buffer.from(original)), prepared_sha256: sha256(Buffer.from(modified)), replacement_count: changes.length });
  patch += unified(file, original, changes);
}
for (const file of ['cdda_help_semantic.h', 'cdda_help_semantic.cpp', 'reviewed_definitions.inc']) {
  const bytes = await readFile(path.join(out, 'cpp', file));
  await writeFile(path.join(out, 'generated/src', file), bytes);
  const lines = lineParts(bytes.toString('utf8'));
  patch += `diff --git a/src/${file} b/src/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/src/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line => `+${line}\n`).join('')}`;
  manifest.new_files.push({ file: `src/${file}`, bytes: bytes.length, sha256: sha256(bytes) });
}
await writeFile(path.join(out, 'help-semantic-overlay.patch'), patch);
manifest.patch_sha256 = sha256(Buffer.from(patch));
await writeFile(path.join(out, 'SOURCE-PREPARATION.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ status: manifest.status, original_files: manifest.original_files.length, new_files: manifest.new_files.length, patch_sha256: manifest.patch_sha256, compiled: false, actual_runtime_consumer_verified: false }));
