import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_COMMIT, REVIEWED_HELP, REVIEWED_LABELS, GRID_CELLS, GRID_LINES,
  loadBoundSources, sha256, validId, escapeBraces, pressActions } from './prepare.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const upstreamRoot = process.argv[2];
if (!upstreamRoot) throw new Error('usage: node help-semantic-slice/validate.mjs PRISTINE_UPSTREAM_ROOT');
let assertions = 0;
const equal = (actual, expected, note) => { assertions++; assert.deepEqual(actual, expected, note); };
const ok = (condition, note) => { assertions++; assert.ok(condition, note); };
const rejects = (callback, note) => { assertions++; assert.throws(callback, note); };
const json = async file => JSON.parse(await readFile(path.join(out, file), 'utf8'));
const source = await loadBoundSources(upstreamRoot);
const pins = await json('source-pins.json'), registry = await json('registry.json');
const en = await json('locales/en.json'), ja = await json('locales/ja.json');
const programs = await json('text-programs.json'), grid = await json('structured-direction-grid.json');
const manifest = await json('SOURCE-PREPARATION.json');
equal(pins.source_commit, SOURCE_COMMIT); equal(registry.source_commit, SOURCE_COMMIT);
equal(registry.semantic_runtime_connected, false); equal(registry.records, source.records);
equal(registry.records.length, 14); equal(pins.mo.sha256, sha256(source.moBytes)); equal(pins.gnu_po.sha256, sha256(source.poBytes));
for (const [file, bytes] of source.bytes) {
  equal(pins.files[file].sha256, sha256(bytes), `${file}: immutable source hash`);
  equal(pins.files[file].bytes, bytes.length);
}
function strictCatalog(catalog, locale) {
  equal(Object.keys(catalog).sort(), ['entries', 'locale', 'schema_version']);
  equal(catalog.schema_version, 1); equal(catalog.locale, locale);
  equal(Object.keys(catalog.entries).sort(), registry.records.map(record => record.id).sort());
  for (const [id, entry] of Object.entries(catalog.entries)) {
    ok(validId(id)); equal(Object.keys(entry).sort(), ['other', 'parameters']); equal(entry.parameters, {});
    const record = registry.records.find(record => record.id === id);
    equal(entry.other, escapeBraces(locale === 'en' ? record.singular : record.japanese));
    // Current scalar formatter's braces are not repurposed as key-binding parameters.
    ok(!/(?<!\{)\{[a-z][a-z0-9_]*\}(?!\})/.test(entry.other));
  }
}
strictCatalog(en, 'en'); strictCatalog(ja, 'ja');
const existing = JSON.parse(await readFile(path.join(source.workspace, 'ja-current/en.json'), 'utf8'));
const contract = JSON.parse(await readFile(path.join(source.workspace, 'rust-contracts/locales/en.json'), 'utf8'));
const oldIds = new Set([...Object.keys(existing.entries), ...Object.keys(contract.entries)]);
for (const record of registry.records) ok(!oldIds.has(record.id), `${record.id}: independent accepted ID collision`);
function validatePrograms(document) {
  equal(document.interface, 'cdda-help-rich-program/1'); equal(document.source_commit, SOURCE_COMMIT);
  equal(document.status, 'source_prepared_uncompiled_unconnected'); equal(document.schema_version, 1); equal(document.catalogs_schema, 1);
  equal(Object.keys(document.locales).sort(), ['en', 'ja']);
  for (const locale of ['en', 'ja']) {
    equal(Object.keys(document.locales[locale]).sort(), registry.records.map(record => record.id).sort());
    for (const record of registry.records) {
      const program = document.locales[locale][record.id];
      equal(program.parameters, record.typed_key_parameters);
      equal(program.nodes.map(node => node.kind === 'literal' ? node.value : `<press_${node.action}>`).join(''), locale === 'en' ? record.singular : record.japanese);
      equal(program.nodes.filter(node => node.kind === 'key_binding').map(node => node.action).sort(), pressActions(record.singular).sort());
      for (const node of program.nodes) {
        if (node.kind === 'literal') { equal(Object.keys(node).sort(), ['kind', 'value']); ok(!node.value.includes('<press_')); }
        else {
          equal(Object.keys(node).sort(), ['action', 'category', 'color', 'description', 'empty_binding_text', 'kind', 'parameter']);
          equal(node.kind, 'key_binding'); equal(node.category, 'DEFAULTMODE'); equal(node.description, 'long'); equal(node.color, 'light_blue'); equal(node.empty_binding_text, '');
          equal(node.parameter, `press_${node.action}`); equal(program.parameters[node.parameter].kind, 'key_binding');
        }
      }
    }
  }
}
validatePrograms(programs);
equal(grid.cells, GRID_CELLS); equal(grid.connector_lines, GRID_LINES); equal(grid.public_semantic_id, null);
equal(grid.source.pointer, '/1/messages/1'); equal(grid.source.sentinel, source.help[1].messages[1]);
equal(grid.alternatives_per_cell, 2); equal(grid.category, 'DEFAULTMODE'); equal(grid.render_runtime_verified, false);
equal(grid.selection.maximum_modifier_count, 0); equal(grid.selection.restrict_to_keyboard, true); equal(grid.selection.restrict_to_printable, true);
const helpCpp = source.bytes.get('src/help.cpp').toString('utf8');
const nativeTemplate = /std::string movement = ([\s\S]*?);\n/.exec(helpCpp)?.[1];
ok(nativeTemplate); const literalStrings = nativeTemplate.match(/"(?:\\.|[^"\\])*"/g);
equal(literalStrings.map(literal => JSON.parse(literal)).join(''), GRID_LINES.join('\n'), 'exact native grid connectors/newlines');
const nativeArray = /movearray = \{\{([\s\S]*?)\}\n\s*\};/.exec(helpCpp)?.[1];
ok(nativeArray); equal(nativeArray.match(/ACTION_[A-Z_]+/g), GRID_CELLS.map(cell => cell.native_action));
const actionCpp = source.bytes.get('src/action.cpp').toString('utf8');
for (const cell of GRID_CELLS) {
  const mapping = new RegExp(`case ${cell.native_action}:\\s*return "([^"]+)";`).exec(actionCpp);
  ok(mapping); equal(mapping[1], cell.action);
}
ok(source.bytes.get('src/game.cpp').toString('utf8').includes('input_context ctxt( "DEFAULTMODE", keyboard_mode::keycode );'));
ok(source.bytes.get('src/init.h').toString('utf8').includes('const std::function<void( const JsonObject &, const std::string &, const cata_path &, const cata_path & )>'));

// Minimal independent unified-patch reader verifies exact forward/reverse byte preparation.
const patchBytes = await readFile(path.join(out, 'help-semantic-overlay.patch'));
equal(sha256(patchBytes), manifest.patch_sha256);
function parsePatch(value) {
  const files = [], lines = value.trimEnd().split('\n'); let current;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('diff --git ')) {
      const match = /^diff --git a\/(\S+) b\/(\S+)$/.exec(line); ok(match); equal(match[1], match[2]);
      current = { file: match[1], isNew: false, hunks: [] }; files.push(current);
    } else if (line === '--- /dev/null') { current.isNew = true; }
    else if (line.startsWith('@@ ')) {
      const match = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/.exec(line); ok(match);
      const hunk = { oldStart: Number(match[1]), oldCount: Number(match[2]), newStart: Number(match[3]), newCount: Number(match[4]), operations: [] };
      while (i + 1 < lines.length && /^[ +\-]/.test(lines[i + 1]) && !lines[i + 1].startsWith('--- ')) hunk.operations.push(lines[++i]);
      equal(hunk.operations.filter(op => !op.startsWith('+')).length, hunk.oldCount);
      equal(hunk.operations.filter(op => !op.startsWith('-')).length, hunk.newCount);
      current.hunks.push(hunk);
    }
  }
  return files;
}
function applyOne(bytes, file, reverse = false) {
  const input = bytes.length ? bytes.toString('utf8').slice(0, -1).split('\n') : [];
  const output = []; let cursor = 0;
  for (const hunk of file.hunks) {
    const start = reverse ? hunk.newStart : hunk.oldStart, count = reverse ? hunk.newCount : hunk.oldCount;
    const index = count === 0 ? start : start - 1;
    output.push(...input.slice(cursor, index)); cursor = index;
    for (const raw of hunk.operations) {
      const kind = reverse ? ({ '+': '-', '-': '+', ' ': ' ' }[raw[0]]) : raw[0], text = raw.slice(1);
      if (kind !== '+') { equal(input[cursor], text, `${file.file}: patch context/reversal`); cursor++; }
      if (kind !== '-') output.push(text);
    }
  }
  output.push(...input.slice(cursor));
  return Buffer.from(output.length ? output.join('\n') + '\n' : '');
}
const patchFiles = parsePatch(patchBytes.toString('utf8'));
equal(patchFiles.length, 9); equal(patchFiles.filter(file => file.isNew).length, 3);
for (const file of patchFiles) {
  const original = source.bytes.get(file.file) ?? Buffer.alloc(0);
  const prepared = await readFile(path.join(out, 'generated', file.file));
  equal(applyOne(original, file), prepared, `${file.file}: exact forward patch`);
  equal(applyOne(prepared, file, true), original, `${file.file}: exact reverse patch`);
  if (file.isNew) equal(prepared, await readFile(path.join(out, 'cpp', path.basename(file.file))));
}
for (const record of manifest.original_files) {
  equal(record.original_sha256, pins.files[record.file].sha256);
  equal(record.prepared_sha256, sha256(await readFile(path.join(out, 'generated', record.file))));
}
equal(manifest.applied_to_pristine, false); equal(manifest.compiled, false); equal(manifest.rust_consumer_connected, false); equal(manifest.native_help_replaced, false);
const members = await readFile(path.join(out, 'cpp/input-context-members.inc'), 'utf8');
const observerMethods = members.split('void input_context::register_action_semantic')[0].replace(/\/\/[^\n]*/g, '');
ok(!/\b(?:get_action_attributes|get_input_for_action|handle_input|rng|rng_bits|press_x|translated|draw|do_turn)\s*\(/.test(observerMethods));
ok(!/action_contexts\s*\[|basic_action_contexts\s*\[/.test(observerMethods));
ok(members.includes('const auto effective_default =')); ok(members.includes('inp_mngr.action_contexts.find( default_context_id )'));
ok(members.includes('matches_reviewed_label_override('));
const rustSource = await readFile(path.join(out, 'rust/src/lib.rs'), 'utf8');
ok(rustSource.includes('Catalog::from_json(bytes)?')); ok(rustSource.includes('key_name_renderer_pending: true'));
ok(!/\b(?:EngineBridge|rng|rng_bits|handle_input|get_input_for_action|do_turn)\b/.test(rustSource.replace(/\/\/[^\n]*/g, '')));

// Small policy fixtures validate the source-preparation contract, not native C++ execution.
const effective = (contexts, category, action) => {
  if (category !== 'default' && contexts.has(category) && contexts.get(category).has(action)) return { origin: 'context', value: contexts.get(category).get(action) };
  if (contexts.get('default')?.has(action)) return { origin: 'default', value: contexts.get('default').get(action) };
  return { origin: 'missing', value: undefined };
};
const keys = new Map([['default', new Map([['UP', ['k', '8']], ['pause', ['.']], ['wait', ['|']], ['save', ['S']]])], ['PICKUP', new Map([['UP', []]])]]);
const before = JSON.stringify([...keys].map(([category, actions]) => [category, [...actions]]));
equal(effective(keys, 'PICKUP', 'UP'), { origin: 'context', value: [] });
equal(effective(keys, 'BIONICS', 'UP'), { origin: 'default', value: ['k', '8'] });
equal(effective(keys, 'PICKUP', 'UNKNOWN'), { origin: 'missing', value: undefined });
equal(effective(keys, 'default', 'pause').value, ['.']); equal(effective(keys, 'default', 'wait').value, ['|']); equal(effective(keys, 'default', 'save').value, ['S']);
equal(JSON.stringify([...keys].map(([category, actions]) => [category, [...actions]])), before, 'fixture observation does not insert missing actions');
const resolveName = (basic, current, overrides, category, action) => {
  if (overrides.has(action)) return overrides.get(action);
  const fallback = () => basic.get('default')?.has(action) ? basic.get('default').get(action) : current.get('default')?.get(action);
  const named = effective(basic, category, action).value ?? fallback();
  return named?.text ? named : fallback()?.text ? fallback() : { literal: action };
};
const basic = new Map([['default', new Map([['UP', { text: 'Pan up', id: REVIEWED_LABELS[0].id }]])], ['PICKUP', new Map([['UP', { text: '' }]])]]);
const current = new Map([['default', new Map([['DYNAMIC', { text: 'User-defined label', legacy: true }]])]]);
equal(resolveName(basic, current, new Map(), 'PICKUP', 'UP').id, REVIEWED_LABELS[0].id);
equal(resolveName(basic, current, new Map(), 'default', 'DYNAMIC'), { text: 'User-defined label', legacy: true });
equal(resolveName(basic, current, new Map([['UP', { text: 'User override', legacy: true }]]), 'PICKUP', 'UP'), { text: 'User override', legacy: true });
const gridEligible = binding => ['keyboard_char', 'keyboard_code'].includes(binding.type) && binding.enabled && binding.printable
  && binding.sequence.length === 1 && binding.modifiers.length === 0
  && binding.sequence[0] >= 0 && binding.sequence[0] < 255 && binding.sequence[0] !== 32;
for (const code of [-1, 255, 32]) equal(gridEligible({ type: 'keyboard_char', enabled: true, printable: true, sequence: [code], modifiers: [] }), false, 'malformed printable flag cannot bypass necessary native code bounds');
equal(gridEligible({ type: 'keyboard_code', enabled: true, printable: true, sequence: [107], modifiers: [] }), true);
equal(gridEligible({ type: 'gamepad', enabled: true, printable: true, sequence: [107], modifiers: [] }), false);
equal(gridEligible({ type: 'keyboard_code', enabled: true, printable: true, sequence: [107], modifiers: ['shift'] }), false);
ok(rustSource.includes('*code < 0 || *code >= 255 || *code == 32'));
const altered = structuredClone(programs); altered.locales.ja['help.core.movement.doors'].nodes.find(node => node.kind === 'key_binding').action = 'close';
rejects(() => validatePrograms(altered), 'changed typed press action is rejected');
const duplicate = structuredClone(en); duplicate.entries['bad.0'] = { parameters: {}, other: 'x' };
rejects(() => strictCatalog(duplicate, 'en'), 'numeric positional public ID rejected');
for (const id of ['', 'help.0', 'help..movement', 'Help.movement', 'help.%3Dmovement', 'help.movement name']) ok(!validId(id), `invalid public ID: ${id}`);
const changed = Buffer.from(source.bytes.get(patchFiles[0].file));
const firstContextOffset = source.bytes.get(patchFiles[0].file).toString('utf8').split('\n').slice(0, patchFiles[0].hunks[0].oldStart - 1).reduce((sum, line) => sum + Buffer.byteLength(line) + 1, 0);
changed[firstContextOffset] ^= 1;
rejects(() => applyOne(changed, patchFiles[0]), 'wrong pristine source cannot silently accept patch');

const files = ['locales/en.json', 'locales/ja.json', 'registry.json', 'text-programs.json', 'structured-direction-grid.json', 'help-semantic-overlay.patch', 'cpp/cdda_help_semantic.h', 'cpp/cdda_help_semantic.cpp', 'cpp/input-context-members.inc', 'cpp/reviewed_definitions.inc', 'rust/Cargo.toml', 'rust/src/lib.rs', 'rust/src/model.rs'];
const hashes = {};
for (const file of files) hashes[file] = sha256(await readFile(path.join(out, file)));
const evidence = { schema_version: 1, source_commit: SOURCE_COMMIT, result: 'pass_source_preparation', assertions, source_pin_files: source.bytes.size,
  textual_entries: 14, source_json_text_bindings: 13, cpp_title_callsites: 2, typed_key_binding_parameters: 5,
  structured_grid_cells: 9, locales: ['en', 'ja'], japanese_mo_sha256: pins.mo.sha256, gnu_po_sha256: pins.gnu_po.sha256,
  exact_forward_and_reverse_patch: true, original_files_modified_in_preparation: 6, new_cpp_files: 3,
  native_cpp_executed: false, rust_compiled: false, actual_runtime_consumer_verified: false,
  key_name_renderer_complete: false, full_semantic_coverage: false, source_files_unchanged: true, files_sha256: hashes };
await writeFile(path.join(out, 'SOURCE-CHECKS.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
