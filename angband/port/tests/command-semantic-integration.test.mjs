import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {stripRecentAnnotations} from './native-annotations.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const review = JSON.parse(read('migration/commands-text.json'));
const accepted = JSON.parse(read('tests/accepted-source-snapshot/manifest.json'));
const marker = /\/\* AB_TEXT_CAPTURE_BEGIN \*\/[\s\S]*?\/\* AB_TEXT_CAPTURE_END \*\/(?:\r\n|\n)?/g;
const source = Object.fromEntries(['cmd-cave.c', 'cmd-pickup.c'].map(name => [name, read('logic/' + name)]));
const captures = read('logic/web-text-capture.c');

test('entire accepted command rules, RNG, messages and CRLF reconstruct byte-for-byte', () => {
  assert.ok(accepted.engineBuiltAt);
  for (const [name, current] of Object.entries(source)) {
    const baseline = fs.readFileSync(path.join(root, 'tests/accepted-source-snapshot', name));
    const identity = accepted.files.find(record => record.file === name);
    assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'), identity.sha256);
    assert.deepEqual(Buffer.from(stripRecentAnnotations(current).replace(/\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g, '').replace(marker, ''), 'utf8'), Buffer.from(stripRecentAnnotations(baseline.toString('utf8')),'utf8'), name);
    assert.ok(current.includes('\r\n'), name + ' must preserve the accepted Windows line endings');
  }
});

test('all 19 original dynamic message calls follow tagged capture comma expressions', () => {
  assert.equal(review.entries.length, 19);
  for (const entry of review.entries) {
    const text = source[path.basename(entry.source.file)];
    const position = text.indexOf(entry.original_call);
    assert.ok(position >= 0, entry.id + ' retains exact original C text');
    assert.equal(text.indexOf(entry.original_call, position + entry.original_call.length), -1, entry.id);
    const prior = text.slice(Math.max(0, position - 500), position);
    assert.match(prior, /\/\* AB_TEXT_CAPTURE_BEGIN \*\/AB_TEXT_CAPTURE\([^\r\n]*\), \/\* AB_TEXT_CAPTURE_END \*\/$/, entry.id);
    assert.ok(prior.includes('"' + entry.id + '"'), entry.id);
  }
});

test('capture modules do not invoke formatting, RNG, game mutation or native feedback APIs', () => {
  const withoutComments = captures.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '');
  for (const forbidden of ['msg', 'msgt', 'monster_desc', 'object_desc', 'randint0', 'randint1', 'one_in_', 'rand_range', 'random_value', 'disturb', 'square_delete_object', 'drop_near', 'object_delete', 'update_mon']) {
    assert.doesNotMatch(withoutComments, new RegExp('\\b' + forbidden + '\\s*\\('), forbidden);
  }
  assert.doesNotMatch(withoutComments, /(?:monster|object|known_cave|feature|kind)->[A-Za-z_][A-Za-z_0-9]*\s*(?:=(?!=)|\+\+|--|[+\-*/]=)/);
  assert.match(read('logic/web-text-capture.h'), /#else[\s\S]*#define AB_TEXT_CAPTURE\(expression\) \(\(void\)0\)/);
});

test('terrain, trap aliases and 1-based money IDs match independent reviewed source identities', () => {
  const terrain = [...read('logic/list-terrain.h').matchAll(/^FEAT\(([^)]+)\)/gm)].map(match => 'terrain.' + match[1].toLowerCase() + '.name');
  const terrainBlock = captures.match(/ab_terrain_ids\[\] = \{([\s\S]*?)\};/)[1];
  assert.deepEqual([...terrainBlock.matchAll(/"([^"\r\n]+)"/g)].map(match => match[1]), terrain);
  const aliases = JSON.parse(read('migration/birth-and-sidebar.json')).trap_record_aliases;
  const trapBlock = captures.match(/ab_trap_ids\[\] = \{([\s\S]*?)\};/)[1];
  assert.deepEqual([...trapBlock.matchAll(/"([^"\r\n]+)"/g)].map(match => match[1]), aliases.map(alias => alias.display_id));
  const objectLines = read('data/gamedata/object.txt').split(/\r?\n/);
  const money = []; let name = '';
  for (const line of objectLines) {
    if (line.startsWith('name:')) name = line.slice(5);
    if (line === 'type:gold') money.push('money.' + name + '.name');
  }
  const moneyBlock = captures.match(/ab_money_ids\[\] = \{([\s\S]*?)\};/)[1];
  assert.match(moneyBlock, /^\s*NULL,/);
  assert.deepEqual([...moneyBlock.matchAll(/"([^"\r\n]+)"/g)].map(match => match[1]), money);
  assert.match(read('logic/obj-init.c'), /k->base->num_svals\+\+;\s*k->sval = k->base->num_svals;/);
  assert.match(read('logic/init.c'), /tidx = z_info->trap_max - 1;[\s\S]*?tidx--[\s\S]*?trap_info\[tidx\]\.tidx = tidx;/);
});

test('command descriptors freeze already-selected facts without live knowledge rereads', () => {
  const monster = captures.match(/void ab_text_capture_monster\([\s\S]*?\n\}/)[0];
  assert.match(monster, /ab_naming_copy_monster_subject_snapshot/);
  assert.match(monster, /memcpy\(projection->json, snapshot.json/);
  assert.doesNotMatch(monster, /monster->|monster_is_visible|monster_is_shape_unique|panel_contains/);
  const object = captures.match(/static void ab_text_known_object_parameter\([\s\S]*?\n\}/)[0];
  assert.match(object, /ab_text_object_is_live\(object\)/);
  assert.match(object, /ab_naming_copy_object_subject_snapshot/);
  assert.match(object, /ODESC_PREFIX \| ODESC_FULL/);
  assert.doesNotMatch(object.replace(/\/\*[\s\S]*?\*\//g, ""), /object->|quark_str|object_desc|monster_desc/);
  assert.doesNotMatch(captures, /UnsupportedObjectNameGrammar|race_index/);
  const actor = read('logic/web-text-capture.h').match(/struct ab_text_monster_projection \{([\s\S]*?)\};/)[1];
  assert.match(actor, /char json\[4096\]/);
  assert.doesNotMatch(actor, /(?:monster|object) \*|race_index/);
});

test('legacy static path, bounded UTF-8 event ownership and unsupported dispatch are retained', () => {
  const bridge = read('logic/web-semantic.c');
  const baseline = read('tests/accepted-source-snapshot/web-semantic.c');
  assert.ok(stripRecentAnnotations(bridge).startsWith(stripRecentAnnotations(baseline)), 'accepted static callback source remains unchanged');
  assert.match(read('logic/web-semantic.h'), /AB_SEMANTIC_EVENT_MAX_BYTES \(128U \* 1024U\)/);
  assert.match(bridge, /ab_semantic_utf8_valid\(cursor\)/);
  assert.match(bridge, /scalar < minimum \|\| scalar > 0x10ffff/);
  const finish = bridge.match(/static void ab_semantic_event_finish\([\s\S]*?\n\}/)[0];
  assert.match(finish, /localized = control \? "" : ab_rs_review_event/);
  assert.match(finish, /ab_host_semantic_event\(event->data, \(uint32_t\)event->length, localized\)/);
  assert.ok(finish.indexOf('ab_host_semantic_event') < finish.indexOf('ab_semantic_event_discard'));
  assert.doesNotMatch(finish.replace(/\/\*[\s\S]*?\*\//g, ''), /msg\(|msgt\(|English|english|ab_rs_message\(/);
});


test('browser drop guard precedes every post-drop dereference and retains action energy', () => {
  const drop = source['cmd-cave.c'].match(/case CMD_DROP: \{([\s\S]*?)\n\t\tcase CMD_HOLD:/)[1];
  const placement = drop.indexOf('drop_near(cave, &obj, 0, mon->grid, true, false);');
  const address = drop.indexOf('uintptr_t ab_drop_address = (uintptr_t)obj;');
  const guard = drop.indexOf('if (!ab_text_object_address_is_live(ab_drop_address)) break;');
  const description = drop.indexOf('object_desc(o_name, sizeof(o_name), obj,');
  const ignore = drop.indexOf('ignore_item_ok(player, obj)');
  assert.ok(address >= 0 && address < placement && guard > placement && description > guard && ignore > description);
  assert.doesNotMatch(drop.slice(placement), /\(uintptr_t\)obj/);
  const safety = [...drop.matchAll(/\/\* AB_TEXT_CAPTURE_BEGIN \*\/\r\n#ifdef __EMSCRIPTEN__[\s\S]*?\/\* AB_TEXT_CAPTURE_END \*\//g)].map(match => match[0]).find(block => block.includes('if (!ab_text_object_address_is_live'));
  assert.match(safety, /if \(!ab_text_object_address_is_live\(ab_drop_address\)\) break;/);
  assert.doesNotMatch(safety, /\breturn\b|\b(?:msg|msgt|object_desc|ignore_item_ok|randint0|object_delete)\s*\(/);
  assert.equal([...drop.matchAll(/\bdrop_near\s*\(/g)].length, 1);
  assert.ok(source['cmd-cave.c'].lastIndexOf('player->upkeep->energy_use = z_info->move_energy;') > source['cmd-cave.c'].indexOf('if (!ab_text_object_address_is_live(ab_drop_address)) break;'));
  assert.match(read('logic/web-text-capture.h'), /bool ab_text_object_address_is_live\(uintptr_t address\);/);
  assert.match(captures, /\nbool ab_text_object_address_is_live\(uintptr_t address\)/);

  // Independent engine lifecycle evidence: placement registers live drops;
  // absorption/failure delete through local pointers and remove real slots
  // before free. The guarded caller consequently cannot rely on obj==NULL.
  // Reconstruct before extracting functions: additive captures may contain their own closing braces.
  const pile = stripRecentAnnotations(read('logic/obj-pile.c'));
  const level = read('logic/cave.c');
  const carry = pile.match(/bool floor_carry\([\s\S]*?\n\}/)[0];
  assert.match(carry, /object_absorb\(obj, drop\);/);
  assert.match(carry, /list_object\(c, drop\);/);
  const deletion = pile.match(/void object_delete\([\s\S]*?\n\}/)[0];
  assert.ok(deletion.indexOf('c->objects[obj->oidx] = NULL;') < deletion.indexOf('object_free(obj);'));
  assert.match(pile, /object_delete\(cave, player->cave, &obj2\);/);
  const failure = pile.match(/static void floor_carry_fail\([\s\S]*?\n\}/)[0];
  // Compose only reversible UI sidecars; the exact native delist/free adjacency remains required.
  assert.match(stripRecentAnnotations(failure), /delist_object\(c, drop\);\s*object_delete\(c, player->cave, &drop\);/);
  const near = pile.match(/void drop_near\([\s\S]*?\n\}/)[0];
  assert.doesNotMatch(near, /\*dropped\s*=(?!=)/);
  assert.match(level, /for \(i = 1; i < c->obj_max; i\+\+\)/);
});

test('source-extracted address scan handles live, merged and destroyed drops without touching object memory', () => {
  // Execute only the exact, tiny pure scan body translated mechanically to JS.
  // Pointer addresses are numbers here. This is a source-policy fixture check;
  // it does not execute or compile C, model the allocator, or run the engine.
  const body = captures.match(/bool ab_text_object_address_is_live\(uintptr_t address\)\s*\{([\s\S]*?)\n\}/)[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\bint index;/, 'let index;')
    .replace(/\(uintptr_t\)/g, '')
    .replace(/cave->/g, 'cave.')
    .replace(/==(?!=)/g, '===');
  assert.doesNotMatch(body, /(?:needle|address)\s*(?:->|\[|\.)|objects\[index\]\s*(?:->|\[|\.)/);
  const live = new Function('cave', 'address', body);
  const dropAddress = 0x3000, survivorAddress = 0x4000, consumedAddress = 0x5000;
  const regular = Object.freeze({ obj_max: 4, objects: Object.freeze([0, 0, dropAddress, survivorAddress]) });
  assert.equal(live(regular, dropAddress), true, 'ordinary registered drop retains original feedback');
  assert.equal(live(regular, survivorAddress), true, 'last in-range slot remains live');
  const orphan = Object.freeze({ obj_max: 3, objects: Object.freeze([0, dropAddress, 0]) });
  assert.equal(live(orphan, dropAddress), true, 'allocated retained/orphaned object retains original feedback');
  const merged = Object.freeze({ obj_max: 4, objects: Object.freeze([0, survivorAddress, 0, 0]) });
  assert.equal(live(merged, consumedAddress), false, 'consumed merged address does not select the survivor');
  const destroyed = Object.freeze({ obj_max: 4, objects: Object.freeze([0, 0, 0, 0]) });
  assert.equal(live(destroyed, consumedAddress), false, 'destroyed address skips unsafe follow-up');
  assert.equal(live(regular, consumedAddress), false);
  assert.equal(live(null, consumedAddress), false);
  assert.equal(live(regular, 0), false);
  assert.equal(live({ obj_max: 2, objects: [dropAddress, 0, dropAddress] }, dropAddress), false, 'reserved zero and exclusive upper boundary are excluded');
  assert.deepEqual(regular.objects, [0, 0, dropAddress, survivorAddress], 'the predicate never changes the live table');
});
