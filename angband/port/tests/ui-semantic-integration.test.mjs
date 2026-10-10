import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { reconstructInterface } from '../migration/interface-data/native-parity.mjs';
import { reconstructTextInput } from '../migration/text-input/native-parity.mjs';
import { stripChecks } from '../migration/check-data/native-parity.mjs';
import {stripRecentAnnotations} from './native-annotations.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const files = ['ui-birth.c', 'ui-player.c', 'ui-display.c', 'ui-input.c', 'ui-options.c'];
const source = Object.fromEntries(files.map(name => [name, read('logic/' + name)]));
const marker = /#ifdef __EMSCRIPTEN__ \/\* AB_UI_PURE \*\/[\s\S]*?#endif \/\* AB_UI_PURE \*\/(?:\r\n|\n)?/g;
const captures = files.flatMap(name => [...source[name].matchAll(marker)].map(match => match[0])).join('\n');
const helper = read('logic/web-ui-text.c');
const header = read('logic/web-ui-text.h');
const review = JSON.parse(read('migration/birth-and-sidebar.json'));
const character = JSON.parse(read('migration/character-data/source-manifest.json'));
const schema = { ...JSON.parse(read('locales/review-schema.json')).entries, ...Object.fromEntries(JSON.parse(read('migration/history-data/source-manifest.json')).entries.map(entry => [entry.id, entry])) };
const staticMarker = /\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g;
const dynamicMarker = /\/\* AB_GAME_DYNAMIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_DYNAMIC_END \*\//g;
const replayMarker = /\/\* AB_REPLAY_BEGIN \*\/[\s\S]*?\/\* AB_REPLAY_END \*\//g;
const accepted = JSON.parse(read('tests/accepted-source-snapshot/manifest.json'));
const strings = text => [...text.matchAll(/"([a-z][a-z0-9_.]+)"/g)].map(match => match[1]);
// Composed confirmation producers bind reviewed references at the original
// get_check call; they intentionally live outside AB_UI_PURE display blocks.
const checkAnnotations = /\/\* AB_CHECK_(?:BEGIN|END) \*\//g;
const checkBindings = files.flatMap(name => {
 const normalized = source[name].replace(checkAnnotations, '');
 return [...normalized.matchAll(/\bget_check\(\s*AB_CHECK_SOURCE\(\s*"([a-z][a-z0-9_.]+)"\s*,\s*("(?:\\.|[^"\\])*")\s*\)\s*\)/g)]
  .map(match => ({ id: match[1], file: 'logic/' + name, originalCall: 'get_check(' + match[2] + ')' }));
});
const allIds = new Set([...strings(captures + helper), ...checkBindings.map(binding => binding.id)]
 .filter(id => Object.hasOwn(schema, id)));
// The former birth-only wrapper is now the reviewed generic confirmation
// projection of the same native source expression. Its relationship is checked
// below, independently of counting the directly bound semantic IDs.
const sharedReplacements = [{ reviewedId: 'birth.name.confirm_response_suffix', producerId: 'interface.check.confirm' }];
const coveredIds = new Set([...allIds, ...sharedReplacements.filter(binding => allIds.has(binding.producerId))
 .map(binding => binding.reviewedId)]);
const table = name => {
 const match = helper.match(new RegExp('\\b' + name + '\\[.*?\\]\\s*=\\s*\\{([\\s\\S]*?)\\n\\};'));
 assert.ok(match, name); return match[1];
};

// These checks are source evidence. They do not assert that an unbuilt engine
// or the browser has exercised every registered producer.
test('pure additions reconstruct all five accepted UI files byte-for-byte', () => {
 let count = 0;
 for (const name of files) {
  const baseline = fs.readFileSync(path.join(root, 'tests/accepted-source-snapshot', name));
  const identity = accepted.files.find(item => item.file === name);
  assert.ok(identity, name);
  assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'), identity.sha256, name);
  const current = source[name];
  count += [...current.matchAll(marker)].length;
  assert.deepEqual(Buffer.from(reconstructInterface(reconstructTextInput(stripRecentAnnotations(current))).replace(replayMarker, '').replace(dynamicMarker, '').replace(marker, '').replace(staticMarker, ''), 'utf8'), Buffer.from(stripRecentAnnotations(baseline.toString('utf8')),'utf8'), name);
  assert.equal((current.match(/#ifdef __EMSCRIPTEN__ \/\* AB_UI_PURE \*\//g) ?? []).length,
   (current.match(/#endif \/\* AB_UI_PURE \*\//g) ?? []).length, name);
 }
 assert.ok(count >= 236, "all previously reviewed UI additions remain tagged");
});

test('UI captures add no RNG, gameplay writes, repeated descriptors or hidden monster facts', () => {
 const authored = (captures + helper).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '');
 assert.doesNotMatch(authored, /\b(?:randint\w*|Rand\w*|rand_range|one_in_|dice_roll|effect_do|handle_stuff|update_mon|object_desc|monster_desc|player_object_to_book|get_spell_info|spell_chance|square_delete_object|drop_near|object_delete|disturb)\s*\(/);
 assert.doesNotMatch(authored, /\b(?:player|ability|feat|trap|grade|monster)->\w+(?:->\w+|\.\w+|\[[^\]\r\n]+\])*\s*(?:=(?!=)|\+\+|--|[+\-*/]=)/);
 assert.doesNotMatch(authored, /monster->(?:hp|maxhp|race)|cave->feeling|obj_feeling_value|mon_feeling_value/);
 assert.match(captures, /AB_UI_OPAQUE\("danger","display_token",mon_feeling_str\)/);
 assert.match(captures, /AB_UI_OPAQUE\("treasure","display_token",obj_feeling_str\)/);
 assert.doesNotMatch(captures + helper, /[^\x00-\x7f]/, 'Japanese belongs in JSON/Rust/DOM, never fixed C byte columns');
});

test('411 reviewed source endpoints and 110 character endpoints have bindings or source-verified shared replacements', () => {
 assert.equal(review.entries.length, 413);
 const missing = review.entries.filter(entry => !coveredIds.has(entry.id)).map(entry => entry.id);
 assert.deepEqual(missing, ['ui.sidebar.speed.fast.label', 'ui.sidebar.speed.slow.label']);
 assert.equal(review.entries.filter(entry => coveredIds.has(entry.id)).length, 411);
 const overwrite = checkBindings.filter(binding => binding.id === 'birth.name.overwrite.confirm');
 assert.equal(overwrite.length, 1, 'one exact source-bound overwrite producer');
 const overwriteReview = review.entries.find(entry => entry.id === overwrite[0].id);
 assert.equal(overwrite[0].file, overwriteReview.source.file);
 assert.equal(overwrite[0].originalCall, overwriteReview.original_call);
 assert.deepEqual(schema[overwrite[0].id].parameters, []);
 assert.deepEqual(sharedReplacements, [{ reviewedId: 'birth.name.confirm_response_suffix', producerId: 'interface.check.confirm' }]);
 const formerWrapper = review.entries.find(entry => entry.id === sharedReplacements[0].reviewedId);
 const sharedWrapper = JSON.parse(read('migration/check-data/source-manifest.json')).entries
  .find(entry => entry.id === sharedReplacements[0].producerId);
 assert.ok(allIds.has(sharedWrapper.id), 'actual shared producer is source-bound');
 assert.deepEqual(sharedWrapper.parameters, formerWrapper.parameters);
 assert.deepEqual(schema[sharedWrapper.id].parameters, formerWrapper.parameters);
 assert.equal(sharedWrapper.sources.length, 1);
 assert.equal(sharedWrapper.sources[0].file, formerWrapper.source.file);
 assert.equal(sharedWrapper.sources[0].original_lexeme, JSON.stringify(formerWrapper.original_english));
 const checkInput = source['ui-input.c'];
 const beginAt = checkInput.indexOf('static bool textui_get_check(');
 const endAt = checkInput.indexOf('char get_char(', beginAt);
 assert.ok(beginAt >= 0 && endAt > beginAt);
 const checkBody = checkInput.slice(beginAt, endAt);
 assert.ok(stripChecks(checkBody).includes(formerWrapper.original_call));
 const begin = checkBody.indexOf('ab_ui_check_begin(prompt,false);');
 const format = checkBody.indexOf(formerWrapper.original_call);
 const commit = checkBody.indexOf('ab_ui_scope_commit();');
 const input = checkBody.indexOf('ke = inkey_m();');
 const close = checkBody.indexOf('ab_ui_check_end();');
 assert.ok(begin >= 0 && begin < format && format < commit && commit < input && input < close,
  'same native wrapper begins, commits before input and closes after input');
 assert.match(checkInput, /get_check_hook = textui_get_check;/);
 assert.match(helper, /store_policy\?"interface\.check\.store\.confirm":"interface\.check\.confirm"/);
 assert.match(helper, /check_action\("yes",store_policy\?"interface\.check\.store\.accept":"interface\.check\.yes",'y'\)/);
 assert.match(helper, /check_action\("no",store_policy\?"interface\.check\.store\.cancel":"interface\.check\.no",store_policy\?ESCAPE:'n'\)/);
 assert.match(stripChecks(checkBody), /\(ke\.key\.code != 'Y'\) && \(ke\.key\.code != 'y'\)/);
 assert.match(source['ui-birth.c'].replace(checkAnnotations, ''),
  /!savefile_name_already_used\(name, true, true\)\s*\|\|\s*get_check\(AB_CHECK_SOURCE\("birth\.name\.overwrite\.confirm",/);
 assert.match(header, /#define AB_CHECK_SOURCE\(i,p\) ab_ui_check_source\(\(i\),\(p\)\)/);
 assert.match(header, /#define AB_CHECK_SOURCE\(i,p\) \(p\)/);
 assert.match(helper, /const char \*ab_ui_check_source\(const char \*id,const char \*prompt\) \{return ab_ui_check_parameters\(id,NULL,0,prompt\);\}/);
 const endpoints = review.dependencies.character_data.endpoints;
 assert.equal(endpoints.length, 110);
 assert.ok(endpoints.every(entry => allIds.has(entry.id)));
 // Static render requests cannot silently omit a declared dynamic parameter.
 for (const match of (captures + helper).matchAll(/ab_ui_static\([^;\n]*?"([a-z][a-z0-9_.]+)"\);/g)) {
  const id = match[1];
  assert.ok(Object.hasOwn(schema, id), id);
  assert.deepEqual(schema[id].parameters, [], id);
 }
 const semanticPrefixes = /^(?:angband\.player_|birth\.|player\.(?:sheet|stat|shape|ability)\.|ui\.(?:sidebar|topbar|status)\.|magic\.realm\.|terrain\.[a-z_]+\.name$|trap\.label\.|element\.)/;
 for (const id of strings(captures + helper).filter(id => semanticPrefixes.test(id))) {
  assert.ok(Object.hasOwn(schema, id), id);
 }
});

test('race, class, rank and shape mappings use canonical source-order domain identity', () => {
 assert.deepEqual(strings(table('ui_race_ids')),
  character.records.races.map(race => 'angband.player_race.' + race.race_key + '.name'));
 assert.deepEqual(character.records.races.map(race => race.ridx), Array.from({ length: 11 }, (_, i) => i));
 assert.deepEqual(strings(table('ui_class_ids')),
  character.records.classes.map(cls => 'angband.player_class.' + cls.class_key + '.name'));
 assert.deepEqual(character.records.classes.map(cls => cls.cidx), Array.from({ length: 9 }, (_, i) => i));
 assert.deepEqual(strings(table('ui_title_ids')), character.records.classes.flatMap(cls => cls.titles.map(title => title.id)));
 const shapes = review.entries.filter(entry => entry.id.startsWith('player.shape.')).sort((a, b) => a.source.line - b.source.line);
 assert.deepEqual(strings(table('ui_shape_ids')), shapes.map(entry => entry.id));
 assert.match(read('logic/init.c'), /shape->sidx = z_info->shape_max\+\+;/);
 assert.match(captures, /ab_ui_race_id\(oid\)/);
 assert.match(captures, /ab_ui_class_id\(oid\)/);
 assert.match(captures, /ab_ui_shape_id\(player->shape->sidx\)/);
});

test('all authored realm, terrain, trap, timed, property, element and option registries match the review', () => {
 const pairs = name => [...table(name).matchAll(/\{ "([^"]+)", "([^"]+)" \}/g)].map(m => [m[1], m[2]]);
 for (const [name, prefix] of [['ui_realm_ids', 'magic.realm.'], ['ui_terrain_ids', 'terrain.']]) {
  const expected = review.entries.filter(entry => entry.id.startsWith(prefix)).map(entry => [entry.identity, entry.id]);
  assert.deepEqual(pairs(name), expected, name);
 }
 assert.deepEqual(pairs('ui_trap_ids'), review.trap_record_aliases.map(alias => [alias.canonical_record_desc, alias.display_id]));
 const timed = [...table('ui_timed_ids').matchAll(/\{ TMD_(\w+), (\d+), "([^"]+)" \}/g)]
  .map(m => [m[1], Number(m[2]), m[3]]);
 assert.deepEqual(timed, review.entries.filter(entry => entry.id.startsWith('ui.status.timed.'))
  .map(entry => [entry.identity.effect, entry.identity.grade, entry.id]));
 assert.equal(timed.length, 71);
 const abilities = [...table('ui_ability_ids').matchAll(/\{ "(player|object)", (?:PF_|OF_)(\w+), "([^"]+)" \}/g)]
  .map(m => [m[1], m[2], m[3]]);
 assert.deepEqual(abilities, review.entries.filter(entry => /^player\.ability\.(?:player|object)\./.test(entry.id))
  .map(entry => [entry.identity.type, entry.identity.code, entry.id]));
 assert.equal(abilities.length, 41);
 const elements = [...table('ui_element_ids').matchAll(/\[ELEM_(\w+)\] = "([^"]+)"/g)].map(m => [m[1], m[2]]);
 assert.deepEqual(elements, review.entries.filter(entry => entry.id.startsWith('element.')).map(entry => [entry.identity, entry.id]));
 const options = [...table('ui_option_ids').matchAll(/\{ OPT_(\w+), "([^"]+)" \}/g)].map(m => [m[1], m[2]]);
 assert.deepEqual(options, review.entries.filter(entry => entry.id.startsWith('birth.options.') && entry.identity)
  .map(entry => [entry.identity, entry.id]));
 assert.equal(options.length, 15);
});

test('source gamedata and parser identities remain byte-exact', () => {
 for (const record of review.reviewed_files.filter(record => record.file.startsWith('data/'))) {
  const bytes = fs.readFileSync(path.join(root, record.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), record.sha256, record.file);
 }
 assert.doesNotMatch(helper, /(?:ability|grade|realm|shape|race|class|feat|trap)->(?:name|desc|type)\s*=(?!=)/);
 assert.match(captures, /AB_UI_OPAQUE\("option_key","canonical_identity",option_name\(oid\)\)/);
});

test('typed transport preserves integers, nested semantic references and ordered realm grammar', () => {
 for (const type of ['integer', 'signed_integer', 'decimal_one_place', 'localized_text', 'localized_text_list']) assert.ok(header.includes('"' + type + '"'));
 assert.match(helper, /count>16/);
 // Reviewed nested confirmation/list grammars share the finite eight-level
 // transport bound; exceeding it invalidates the event instead of emitting it.
 assert.match(helper, /if\(depth>8\)\s*\{\s*e->valid=false;return;\s*\}/);
 assert.match(read('logic/web-ui-residual-text.c'), /depth>8\)\{event->valid=false;return;\}/);
 assert.match(read('rust/src/text_parameters.rs'), /pub const MAX_PARAMETERS: usize = 16;/);
 assert.match(read('rust/src/localization.rs'), /const EVENT_LIMITS: Limits = Limits \{ max_bytes: MAX_EVENT_BYTES, max_depth: 32,/);
 assert.match(helper, /ab_semantic_json_string\(e,p->text\)/);
 assert.match(helper, /ui_parameters\(e,p->nested,p->nested_count,depth\+1\)/);
 assert.match(helper, /birth_realm_conjunction/);
 assert.match(captures, /const char \*realm_ids\[16\]/);
 assert.match(captures, /if\(!visible && realm_count\)/);
 assert.match(captures, /AB_UI_LIST\("realms",realm_ids,realm_count\)/);
 assert.doesNotMatch(helper, /ab_rs_message\(|strstr\(|str_replace|translated|japanese/);
 assert.match(helper, /ab_semantic_event_begin\(&event,id,"ui",context,widget,0,-1\)/);
 assert.match(helper, /if\(control\) ab_semantic_event_emit_control/);
});

test('name/options prompts are committed before blocking input and reset on every return path', () => {
 const name = source['ui-input.c'];
 assert.match(name, /ab_ui_scope_commit\(\);\s*#endif \/\* AB_UI_PURE \*\/\s*res = askfor_aux_ext\(buf, buflen, get_name_keypress, handle_name_mouse\);/);
 assert.match(name, /ab_ui_scope_end\(\);\s*ab_ui_reset\("name-editor"\);\s*#endif \/\* AB_UI_PURE \*\/\s*return res;/);
 const options = source['ui-options.c'];
 assert.match(options, /if\(ui_birth_options\)ab_ui_scope_commit\(\);\s*#endif \/\* AB_UI_PURE \*\/\s*menu_select\(m, 0, false\);/);
 assert.match(options, /if\(ui_birth_options\) \{ ab_ui_scope_end\(\);ab_ui_reset\("birth-options"\); \}/);
 assert.match(helper, /ui_batches\[i\]=false;break;/, 'commit records that __end has been emitted');
 assert.match(helper, /if\(ui_batches\[ui_depth-1\]\)ui_dispatch\(NULL,"__end"/);
 for (const scope of ['birth', 'birth-menu', 'birth-race-help', 'birth-class-help', 'birth-options', 'name-editor', 'history-editor', 'character']) {
  assert.ok(helper.includes('"' + scope + '"'), scope);
 }
});

test('history formatter authorization comes from validated generated/authored provenance, never the UI flag', () => {
 assert.match(captures, /if\(strcmp\(history,player->history\)\) \{[\s\S]*?ab_ui_history_edited\(\);[\s\S]*?"birth.history.edited_content"/);
 assert.equal((captures.match(/ab_ui_history_edited\(\)/g) ?? []).length, 1);
 assert.match(helper, /else if\(source.origin==AB_HISTORY_AUTHORED\) \{[\s\S]*?"player.sheet.history.value"/);
 assert.match(helper, /if\(source.origin==AB_HISTORY_GENERATED\) \{[\s\S]*?"player.sheet.generated_history.value"/);
 assert.match(helper, /if\(!ab_history_snapshot_matches\(&source,text\)\)source.origin=AB_HISTORY_UNKNOWN/);
 const historyRenderer = helper.slice(helper.indexOf('void ab_ui_history('), helper.indexOf('struct ui_key_id'));
 assert.ok(!historyRenderer.includes('ui_history_is_edited'));
 assert.match(historyRenderer, /param_begin\(&event,"history","GeneratedHistory"\)/);
 assert.match(helper, /__unsupported:%s/);
 assert.match(captures, /ab_ui_input\("history",buffer,"verbatim_user_text"\)/);
 assert.match(helper, /strnfmt\(key,sizeof\(key\),"__input:%s",widget\);ui_dispatch\(NULL,key,"",p,count,true\)/);
 assert.match(helper, /struct ab_ui_param p\[2\]=\{AB_UI_OPAQUE\("text",type,text\)\};size_t count=1;/);
 // An opaque draft is a control, never a formatter claim about generated text.
 assert.match(helper, /ab_ui_history_reset\(void\) \{ ui_history_is_edited=false; \}/);
});
