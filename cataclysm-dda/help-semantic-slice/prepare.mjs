import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeMo } from '../tools/mo-codec.mjs';
import { parsePo } from '../inventory-tools/inventory.mjs';

export const SOURCE_COMMIT = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
export const MO_SHA256 = '336dc66ccd4d1e828832a38756cddcc165e0f1af917f546752b5655ff02705e7';
export const GNU_PO_SHA256 = '0684a3182724bf5e082d52955998a0cdef9f511cef7a2dd785e1b29087c442da';
export const REVIEWED_LABELS = [
  { id: 'input.keybinding.default.up.name', pointer: '/9/name', category: 'default', action: 'UP', singular: 'Pan up' },
  { id: 'input.keybinding.pickup.up.name', pointer: '/26/name', category: 'PICKUP', action: 'UP', singular: 'Previous item' },
  { id: 'input.keybinding.bionics.up.name', pointer: '/439/name', category: 'BIONICS', action: 'UP', singular: 'Move cursor up' },
  { id: 'input.keybinding.default_mode.pause.name', pointer: '/289/name', category: 'DEFAULTMODE', action: 'pause', singular: 'Pause' },
  { id: 'input.keybinding.default_mode.pickup.name', pointer: '/303/name', category: 'DEFAULTMODE', action: 'pickup', singular: 'Pick up items from one nearby tile' },
  { id: 'input.keybinding.default_mode.inventory.name', pointer: '/316/name', category: 'DEFAULTMODE', action: 'inventory', singular: 'Open inventory' },
  { id: 'input.keybinding.default_mode.help.name', pointer: '/369/name', category: 'DEFAULTMODE', action: 'help', singular: 'View help' },
];
export const REVIEWED_HELP = [
  { id: 'help.core.movement.name', pointer: '/1/name', role: 'name', singular: 'Movement' },
  { id: 'help.core.movement.controls', pointer: '/1/messages/0', role: 'controls', singular: 'Movement is performed using the numpad, the arrow keys, or vikeys.' },
  { id: 'help.core.movement.movement_cost', pointer: '/1/messages/2', role: 'movement_cost', singular: 'Each step will take 100 movement points (or more, depending on the terrain); you will then replenish a variable amount of movement points, depending on many factors (press <press_player_data> to see the exact amount).' },
  { id: 'help.core.movement.melee', pointer: '/1/messages/3', role: 'melee', singular: 'To attempt to hit a monster with your weapon, simply move into it.' },
  { id: 'help.core.movement.doors', pointer: '/1/messages/4', role: 'doors', singular: "You may find doors, ('+'); these may be opened with <press_open> or closed with <press_close>.  Some doors are locked.  Locked doors, windows, and some other obstacles can be destroyed by smashing them (<press_smash>, then choose a direction).  Smashing down obstacles is much easier with a good weapon or a strong character." },
  { id: 'help.core.movement.safe_mode', pointer: '/1/messages/5', role: 'safe_mode', singular: 'There may be times when you want to move more quickly by holding down a movement key.  However, fast movement in this fashion may lead to the player getting into a dangerous situation or even killed before they have a chance to react.  Pressing <press_safemode> will toggle "safe mode."  While this is on, any movement will be ignored if new monsters enter the player\'s view.' },
];
export const TITLE = { id: 'ui.help.title', singular: 'Help' };
export const GRID_CELLS = [
  { role: 'north_west', row: 0, column: 0, action: 'LEFTUP', native_action: 'ACTION_MOVE_FORTH_LEFT' },
  { role: 'north', row: 0, column: 1, action: 'UP', native_action: 'ACTION_MOVE_FORTH' },
  { role: 'north_east', row: 0, column: 2, action: 'RIGHTUP', native_action: 'ACTION_MOVE_FORTH_RIGHT' },
  { role: 'west', row: 1, column: 0, action: 'LEFT', native_action: 'ACTION_MOVE_LEFT' },
  { role: 'pause', row: 1, column: 1, action: 'pause', native_action: 'ACTION_PAUSE' },
  { role: 'east', row: 1, column: 2, action: 'RIGHT', native_action: 'ACTION_MOVE_RIGHT' },
  { role: 'south_west', row: 2, column: 0, action: 'LEFTDOWN', native_action: 'ACTION_MOVE_BACK_LEFT' },
  { role: 'south', row: 2, column: 1, action: 'DOWN', native_action: 'ACTION_MOVE_BACK' },
  { role: 'south_east', row: 2, column: 2, action: 'RIGHTDOWN', native_action: 'ACTION_MOVE_BACK_RIGHT' },
];
export const GRID_LINES = [
  '<LEFTUP_0>  <UP_0>  <RIGHTUP_0>   <LEFTUP_1>  <UP_1>  <RIGHTUP_1>',
  ' \\ | /     \\ | /',
  '  \\|/       \\|/',
  '<LEFT_0>--<pause_0>--<RIGHT_0>   <LEFT_1>--<pause_1>--<RIGHT_1>',
  '  /|\\       /|\\',
  ' / | \\     / | \\',
  '<LEFTDOWN_0>  <DOWN_0>  <RIGHTDOWN_0>   <LEFTDOWN_1>  <DOWN_1>  <RIGHTDOWN_1>',
];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const escapeBraces = value => value.replaceAll('{', '{{').replaceAll('}', '}}');
export const pointer = (value, ref) => ref.split('/').slice(1).reduce((obj, component) => obj[component.replaceAll('~1', '/').replaceAll('~0', '~')], value);
export const validId = value => typeof value === 'string' && Buffer.byteLength(value) <= 160 && /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/.test(value);
export const pressActions = value => [...value.matchAll(/<press_([^<>\n]+)>/g)].map(match => match[1]);

export function compileProgram(value, expectedActions) {
  const nodes = [];
  let cursor = 0;
  for (const match of value.matchAll(/<press_([^<>\n]+)>/g)) {
    const action = match[1];
    assert.ok(expectedActions.includes(action), `unreviewed press token: ${action}`);
    if (match.index > cursor) nodes.push({ kind: 'literal', value: value.slice(cursor, match.index) });
    nodes.push({ kind: 'key_binding', parameter: `press_${action}`, category: 'DEFAULTMODE', action, description: 'long', color: 'light_blue', empty_binding_text: '' });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) nodes.push({ kind: 'literal', value: value.slice(cursor) });
  assert.deepEqual(pressActions(value).sort(), [...expectedActions].sort());
  assert.equal(nodes.map(node => node.kind === 'literal' ? node.value : `<press_${node.action}>`).join(''), value);
  return nodes;
}

export async function loadBoundSources(upstreamRoot) {
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const files = ['data/raw/keybindings.json', 'data/core/help.json', 'src/help.cpp', 'src/help.h', 'src/input.cpp', 'src/input.h', 'src/input_context.cpp', 'src/input_context.h', 'src/input_enums.h', 'src/action.cpp', 'src/game.cpp', 'src/init.h', 'src/translation.h', 'src/cata_path.h'];
  const bytes = new Map();
  for (const file of files) bytes.set(file, await readFile(path.join(upstreamRoot, file)));
  const keys = JSON.parse(bytes.get('data/raw/keybindings.json'));
  const help = JSON.parse(bytes.get('data/core/help.json'));
  const moBytes = await readFile(path.join(workspace, 'ja-current/generated/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo'));
  assert.equal(sha256(moBytes), MO_SHA256, 'Japanese MO changed; review required');
  const mo = new Map(decodeMo(moBytes).map(pair => [pair.original, pair.translated]));
  const poBytes = await readFile(path.join(workspace, 'ja-current/generated/gnu-roundtrip.po'));
  assert.equal(sha256(poBytes), GNU_PO_SHA256, 'GNU roundtrip PO changed; review required');
  const po = parsePo(poBytes.toString('utf8'), 'ja-current/generated/gnu-roundtrip.po');
  assert.equal(po.errors.length, 0); assert.equal(po.language, 'ja'); assert.equal(po.nplurals, 1);
  const poByKey = new Map(po.entries.filter(entry => !entry.obsolete).map(entry => [(entry.context ? `${entry.context}\x04` : '') + entry.singular + (entry.plural === null ? '' : `\0${entry.plural}`), entry]));
  const records = [];
  for (const label of REVIEWED_LABELS) {
    const owner = pointer(keys, label.pointer.replace(/\/name$/, ''));
    assert.equal(owner.type, 'keybinding'); assert.equal(owner.id, label.action); assert.equal(owner.category ?? 'default', label.category);
    assert.equal(pointer(keys, label.pointer), label.singular, `${label.id}: English source changed`);
    assert.equal(keys.filter(record => record.type === 'keybinding' && record.id === label.action && (record.category ?? 'default') === label.category).length, 1, 'ambiguous named owner');
    records.push({ ...label, source_file: 'data/raw/keybindings.json', owner: { type: 'keybinding', category: label.category, id: label.action }, consumers: [{ file: 'src/input.cpp', function: 'input_manager::load' }, { file: 'src/input_context.cpp', function: 'input_context::get_action_name', note: 'Name resolution uses basic_action_contexts, independently of current key-binding overrides.' }] });
  }
  assert.equal(help[1].type, 'help'); assert.equal(help[1].order, 1); assert.equal(help[1].name, 'Movement');
  assert.equal(help[1].messages.length, 6); assert.equal(help[1].messages[1], '<HELP_DRAW_DIRECTIONS>');
  for (const item of REVIEWED_HELP) {
    assert.equal(pointer(help, item.pointer), item.singular, `${item.id}: help source changed`);
    records.push({ ...item, source_file: 'data/core/help.json', owner: { type: 'help', reviewed_topic: 'movement', source_order: 1 }, consumers: [{ file: 'src/help.cpp', function: 'help::load_object' }, { file: 'src/help.cpp', function: item.role === 'name' ? 'help::draw_menu' : 'help::display_help' }] });
  }
  const helpCpp = bytes.get('src/help.cpp').toString('utf8');
  assert.equal((helpCpp.match(/_\( "Help" \)/g) ?? []).length, 2, 'review both original title callsites');
  records.push({ ...TITLE, source_file: 'src/help.cpp', owner: { function: 'help::display_help', role: 'title' }, consumers: [{ file: 'src/help.cpp', function: 'help::display_help', source_expression: 'draw_border( w_help_border, BORDER_COLOR, _( "Help" ) )' }, { file: 'src/help.cpp', function: 'help::display_help', source_expression: 'scrollable_text( get_w_help_border, _( "Help" ),' }] });
  for (const record of records) {
    assert.ok(validId(record.id));
    assert.ok(mo.has(record.singular), `${record.id}: missing MO translation`);
    const poEntry = poByKey.get(record.singular);
    assert.ok(poEntry); assert.equal(poEntry.context, ''); assert.equal(poEntry.plural, null);
    assert.equal(poEntry.translations['0'], mo.get(record.singular));
    record.legacy = { context: '', singular: record.singular, plural: null };
    record.japanese = mo.get(record.singular);
    record.typed_key_parameters = Object.fromEntries(pressActions(record.singular).map(action => [`press_${action}`, { kind: 'key_binding', category: 'DEFAULTMODE', action }]));
    record.po_binding = { file: 'ja-current/generated/gnu-roundtrip.po', line: poEntry.line ?? null, context: poEntry.context, plural: poEntry.plural };
  }
  assert.equal(records.length, 14); assert.equal(new Set(records.map(record => record.id)).size, 14);
  return { workspace, bytes, keys, help, records, moBytes, poBytes };
}

export async function prepare(upstreamRoot) {
  const out = path.dirname(fileURLToPath(import.meta.url));
  const source = await loadBoundSources(upstreamRoot);
  await mkdir(path.join(out, 'locales'), { recursive: true });
  const catalogs = {};
  for (const locale of ['en', 'ja']) {
    catalogs[locale] = { schema_version: 1, locale, entries: Object.fromEntries(source.records.map(record => [record.id, { parameters: {}, other: escapeBraces(locale === 'en' ? record.singular : record.japanese) }])) };
    await writeFile(path.join(out, 'locales', `${locale}.json`), JSON.stringify(catalogs[locale], null, 2) + '\n');
  }
  const registry = { schema_version: 1, source_commit: SOURCE_COMMIT, scope: '14 textual entries; selected core Movement topic and seven named keybinding labels', semantic_runtime_connected: false, records: source.records };
  await writeFile(path.join(out, 'registry.json'), JSON.stringify(registry, null, 2) + '\n');
  const programs = { interface: 'cdda-help-rich-program/1', schema_version: 1, source_commit: SOURCE_COMMIT, catalogs_schema: 1, status: 'source_prepared_uncompiled_unconnected', locales: Object.fromEntries(['en', 'ja'].map(locale => [locale, Object.fromEntries(source.records.map(record => [record.id, { parameters: record.typed_key_parameters, nodes: compileProgram(locale === 'en' ? record.singular : record.japanese, pressActions(record.singular)) }]))])) };
  await writeFile(path.join(out, 'text-programs.json'), JSON.stringify(programs, null, 2) + '\n');
  const grid = { interface: 'cdda-structured-direction-grid/1', schema_version: 1, source_commit: SOURCE_COMMIT, block_kind: 'structured_direction_grid', source: { file: 'data/core/help.json', pointer: '/1/messages/1', sentinel: '<HELP_DRAW_DIRECTIONS>', producer: 'src/help.cpp::help::get_dir_grid' }, public_semantic_id: null, category: 'DEFAULTMODE', native_orientation: 'Original movearray order; no Rust world/isometric transform', alternatives_per_cell: 2, cells: GRID_CELLS, connector_lines: GRID_LINES, selection: { preserves_native_binding_order: true, local_present_empty_wins: true, maximum_modifier_count: 0, restrict_to_printable: true, restrict_to_keyboard: true, enabled_type_observed_by_cpp: true, single_code_only: true, first_eligible_count: 2, short_description_required: true }, style: { bound: 'light_blue', unbound: 'red', unbound_literal: '?' }, render_runtime_verified: false };
  await writeFile(path.join(out, 'structured-direction-grid.json'), JSON.stringify(grid, null, 2) + '\n');
  const pins = { schema_version: 1, source_commit: SOURCE_COMMIT, files: Object.fromEntries([...source.bytes].map(([file, bytes]) => [file, { bytes: bytes.length, sha256: sha256(bytes) }])), mo: { file: 'ja-current/generated/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo', bytes: source.moBytes.length, sha256: MO_SHA256 }, gnu_po: { file: 'ja-current/generated/gnu-roundtrip.po', bytes: source.poBytes.length, sha256: GNU_PO_SHA256 } };
  await writeFile(path.join(out, 'source-pins.json'), JSON.stringify(pins, null, 2) + '\n');
  return source;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const upstreamRoot = process.argv[2];
  if (!upstreamRoot) throw new Error('usage: node help-semantic-slice/prepare.mjs PRISTINE_UPSTREAM_ROOT');
  const source = await prepare(upstreamRoot);
  console.log(JSON.stringify({ status: 'source_prepared_uncompiled_unconnected', entries: source.records.length, locales: ['en', 'ja'], key_binding_parameters: source.records.reduce((sum, record) => sum + Object.keys(record.typed_key_parameters).length, 0), grid_cells: GRID_CELLS.length, actual_runtime_consumer_verified: false }));
}
