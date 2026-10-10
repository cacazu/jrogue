import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { reconstructContext } from '../migration/context-menu-data/native-parity.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const source = read('logic/ui-context.c');
const before = read('migration/context-menu-data/producer-snapshot.c');
const upstream = read('migration/context-menu-data/upstream-snapshot.c');
const helper = read('logic/web-context-menu.c');
const header = read('logic/web-context-menu.h');
const bindings = read('migration/context-menu-data/command-bindings.inc');
const commandSource = read('migration/context-menu-data/command-source-snapshot.c');
const review = JSON.parse(read('migration/context-menu-data/source-manifest.json'));
const marker = /\/\* AB_CONTEXT_BEGIN \*\/([\s\S]*?)\/\* AB_CONTEXT_END \*\//g;
const captures = [...source.matchAll(marker)].map(match => match[1]).join('\n');
const ids = new Map(review.entries.map(entry => [entry.id, entry]));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const strings = text => [...text.matchAll(/"(context\.[a-z0-9_.]+)"/g)].map(match => match[1]);
const functionBody = (text, name) => {
 const match = new RegExp('^(?:static )?(?:int|void|bool) '+name+'\\([^;]*?\\)\\s*\\{','m').exec(text);
 assert.ok(match,name);
 const begin=match.index+match[0].lastIndexOf('{');
 let depth=1,quote=null;
 for(let i=begin+1;i<text.length;i++) {
  const c=text[i];
  if(quote) { if(c==='\\'){i++;continue;} if(c===quote)quote=null;continue; }
  if(c==='/'&&text[i+1]==='*') { const end=text.indexOf('*/',i+2);assert.ok(end>=0);i=end+1;continue; }
  if(c==='/'&&text[i+1]==='/') { const end=text.indexOf('\n',i+2);i=end<0?text.length:end;continue; }
  if(c==='"'||c==="'") {quote=c;continue;}
  if(c==='{')depth++;else if(c==='}'&&!--depth)return text.slice(begin,i+1);
 }
 throw Error('unclosed '+name);
};
const commandArrays = text => [...text.matchAll(/struct cmd_info (cmd_\w+)\[\]\s*=\s*\{([\s\S]*?)\n\};/g)]
 .map(match => ({ array:match[1], english:[...match[2].matchAll(/\{\s*("(?:[^"\\]|\\.)*")/g)].map(row=>JSON.parse(row[1])) }));
const stripStatic = text => text.replace(/\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g,'');

test('all context annotations reconstruct the exact accepted producer bytes', () => {
 assert.equal(sha(Buffer.from(before)), review.source_snapshot_sha256);
 assert.deepEqual(Buffer.from(reconstructContext(source)), Buffer.from(before));
 assert.equal((source.match(/AB_CONTEXT_BEGIN/g)??[]).length,187);
 assert.throws(()=>reconstructContext(source+'/* AB_CONTEXT_BEGIN */'),/unbalanced/);
});

test('source and acquisition line endings aside, original context gameplay is exactly pinned upstream', () => {
 assert.equal(sha(Buffer.from(upstream)), '19fdca516d09963f38e412c101cd7c7dee825fdd0a997cd97abceeac9c7f87d8');
 // CRLF in the already-accepted Windows source predates these additions.
 assert.equal(stripStatic(before).replace(/\r\n/g,'\n'), upstream.replace(/\r\n/g,'\n'));
 assert.equal(review.upstream_commit,'f3082213b73f3e463e3d0d60bff4b00462beae6e');
 const changed = source.replace('allowed = key_confirm_command(cmdkey);','allowed = true;');
 assert.notEqual(reconstructContext(changed), before, 'gameplay-policy mutations cannot pass reconstruction');
});

test('the reviewed catalog has unique semantic identities, Japanese text and exact parameter sets', () => {
 assert.equal(review.entries.length,218);
 assert.equal(ids.size,review.entries.length);
 for(const entry of review.entries) {
  assert.match(entry.id,/^context\.[a-z][a-z0-9_.]+$/);
  assert.equal(typeof entry.english,'string',entry.id);assert.ok(entry.english.length,entry.id);
  assert.equal(typeof entry.japanese,'string',entry.id);assert.ok(entry.japanese.length,entry.id);
  if(entry.id==='context.command.row') assert.equal(entry.japanese,'{label}{shortcut}');
  else assert.match(entry.japanese,/[\u3000-\u9fff]/,entry.id);
  const parameters=entry.parameters.map(p=>p.name).sort();
  for(const locale of ['english','japanese']) {
   const placeholders=[...new Set([...entry[locale].matchAll(/\{([a-z_]+)\}/g)].map(m=>m[1]))].sort();
   assert.deepEqual(placeholders,parameters,entry.id+' '+locale);
  }
 }
 for(const id of new Set(strings(captures+helper+bindings)))assert.ok(ids.has(id),id);
 assert.deepEqual(ids.get('context.prompt.seen_monster').parameters,[{name:'monster',type:'MonsterDescription'}]);
});

test('all 70 source-selected mouse menu labels are bound without runtime English lookup', () => {
 const entries=review.entries.filter(entry=>entry.role==='context_row_label');
 assert.equal(entries.length,70);
 for(const entry of entries) {
  const occurrences=[...source.matchAll(new RegExp('ab_context_label\\(m,"'+entry.id.replaceAll('.','\\.')+'",','g'))];
  assert.equal(occurrences.length,entry.sources.length,entry.id);
 }
 assert.match(source,/square\(c, grid\)->mon\) \? .*context\.row\.attack.* : .*context\.row\.alter/);
 assert.match(source,/object_is_ignored\(obj\) \? .*context\.row\.unignore.* : .*context\.row\.ignore/);
 assert.doesNotMatch(helper,/strcmp\([^;]*(?:native|desc|name)|strstr\([^;]*(?:native|desc|name)/);
});

test('all 16 command arrays and 122 descriptions map by array identity and source ordinal', () => {
 const arrays=commandArrays(commandSource);
 assert.equal(arrays.length,16);
 assert.equal(arrays.reduce((n,a)=>n+a.english.length,0),122);
 assert.deepEqual(review.command_arrays.map(a=>a.array),arrays.map(a=>a.array));
 for(const array of arrays) {
  const manifest=review.command_arrays.find(a=>a.array===array.array);
  assert.equal(manifest.ids.length,array.english.length,array.array);
  assert.deepEqual(manifest.ids.map(id=>ids.get(id).english),array.english,array.array);
  assert.ok(bindings.includes('context_'+array.array+'[]'),array.array);
 }
 assert.match(helper,/list==&cmds_all\[i\]/);
 assert.match(helper,/commands==cmds_all\[i\]\.list/);
 assert.match(helper,/list->len!=context_commands\[index\]\.count/);
 assert.doesNotMatch(helper,/cmd_lookup|cmd_list_lookup_by_name|->desc|->name|->nested_name|->prereq|->hook/);
 assert.match(bindings,/#ifdef ALLOW_BORG\r?\n "context\.command\.hidden\.borg",\r?\n#endif/);
});

test('source-native category visibility and nested selection/escape callbacks are retained', () => {
 const native=reconstructContext(source);
 assert.match(native,/while \(cmds_all\[len\]\.len && cmds_all\[len\]\.menu_level == 0\)/);
 assert.match(native,/if \(list->list\[menu.cursor\]\.cmd \|\|\s*list->list\[menu.cursor\]\.hook\)/);
 assert.match(native,/\*selection = &list->list\[menu.cursor\];/);
 assert.match(native,/cmd_list_lookup_by_name\(list->list\[menu.cursor\]\.nested_name\)/);
 assert.match(native,/if \(!cmd_menu\(&cmds_all\[list->list\[menu.cursor\]\.nested_cached_idx\], selection_p\)\)/);
 assert.match(native,/evt.type == EVT_ESCAPE[\s\S]*?result = true;/);
 assert.match(native,/if \(result && screen_save_depth > 1\s*&& \(tile_width > 1 \|\| tile_height > 1\)\)/);
 assert.match(commandSource,/\{ "Hidden",\s+cmd_hidden,\s+N_ELEMENTS\(cmd_hidden\), 0, 0 \}/);
});

test('every menu owner closes before free or before returning its native chosen-command result', () => {
 for(const name of ['context_menu_player_2','context_menu_player','context_menu_cave','context_menu_object','show_command_list','context_menu_command']) {
  const body=functionBody(source,name);
  assert.equal((body.match(/ab_context_open\(/g)??[]).length,1,name);
  assert.equal((body.match(/ab_context_close\(/g)??[]).length,1,name);
  assert.ok(body.indexOf('ab_context_open(')<body.indexOf('menu_dynamic_select('),name);
  assert.ok(body.indexOf('menu_dynamic_select(')<body.indexOf('ab_context_close('),name);
  assert.ok(body.indexOf('ab_context_close(')<body.indexOf('menu_dynamic_free('),name);
 }
 assert.match(helper,/frame!=&frames\[frame_count-1\]/);
 assert.match(helper,/ab_if_menu_forget\(menu\);ab_naming_snapshot_release\(&frame->prompt_name\)/);
 assert.match(helper,/memset\(frame,0,sizeof\(\*frame\)\);frame_count--;/);
});

test('disabled menu rows observe the single native validity argument and keep native confirmation policies', () => {
 assert.match(source,/labels, \/\* AB_CONTEXT_BEGIN \*\/ab_context_valid\(m,[\s\S]*?\(valid\)/);
 assert.match(header,/#define ab_context_valid\(menu,original\) \(original\)/);
 assert.match(header,/#define ab_context_label\(menu,id,native\) \(native\)/);
 const original=reconstructContext(source);
 assert.equal((original.match(/inven_carry_okay\(obj\)/g)??[]).length,2);
 assert.equal((original.match(/obj_has_charges\(obj\)/g)??[]).length,2);
 assert.equal((original.match(/player_can_cast\(player, false\)/g)??[]).length,3);
 assert.match(original,/allowed = key_confirm_command\(cmdkey\) &&\s*get_item_allow\(obj, cmdkey, selected, false\)/);
 assert.match(original,/case MENU_VALUE_DROP_ALL:[\s\S]*?cmd_set_arg_number\(cmdq_peek\(\), "quantity", obj->number\);/);
 assert.match(original,/gc->code = CMD_STASH;[\s\S]*?gc->code = CMD_SELL;/);
});

test('Enter shortcut composition uses the original one formatted key and finishes after native row drawing', () => {
 const body=functionBody(source,'cmd_sub_entry');
 assert.equal((body.match(/keypress_to_readable\(/g)??[]).length,1);
 assert.ok(body.indexOf('Term_addstr(-1, attr, buf);')<body.indexOf('ab_context_shortcut(menu,oid,buf);'));
 assert.ok(body.lastIndexOf('Term_addch(attr, L\')\');')<body.indexOf('ab_context_row_drawn(menu,oid);'));
 assert.match(helper,/if\(frame->construction_shortcuts\)ab_context_row_drawn\(menu,oid\)/);
 assert.match(helper,/AB_UI_OPAQUE\("shortcut","display_token",frame->shortcuts\[oid\]\)/);
 assert.match(helper,/snprintf\(frame->shortcuts\[oid\],sizeof\(frame->shortcuts\[oid\]\)," \(%s\)",display_shortcut\)/);
});

test('mouse controls come from the existing native visible-row path and carry only layout facts', () => {
 const menu=read('logic/ui-menu.c');
 const visible=functionBody(menu,'display_menu_row');
 assert.ok(visible.indexOf('row_valid == MN_ROW_HIDDEN')<visible.indexOf('ab_if_menu_row('));
 assert.ok(visible.indexOf('ab_if_menu_row(')<visible.indexOf('menu->row_funcs->display_row('));
 const controls=[...helper.matchAll(/context_parameter_(?:int|bool)\(&event,"([a-z_]+)"/g)].map(m=>m[1]);
 assert.deepEqual(controls,['x','y','valid','depth','flags','count','top','col','row','width','page_rows','cursor']);
 assert.match(helper,/y=menu->active.row\+view-menu->top/);
 assert.match(helper,/if\(menu->filter_list\)return;/);
 assert.match(helper,/menu->active.col<0 \|\| menu->active.col>255 \|\| y<0 \|\| y>255/);
 assert.match(helper,/frame->valid\[oid\]/);
 assert.doesNotMatch(helper,/Term_keypress|cmdq_push|menu_select|menu_refresh|menu_handle_action|key_confirm_command|get_item_allow/);
});

test('headers copy the already-selected native descriptor and terrain identity without a second query', () => {
 assert.match(source,/monster_desc\(m_name,[\s\S]*?MDESC_IND_VIS\);[\s\S]*?ab_context_prompt_named\(m,"context\.prompt\.seen_monster",m_name,false\)/);
 assert.match(source,/square_apparent_name\(player->cave, grid\);[\s\S]*?ab_context_prompt_terrain\(m,ab_look_selected_feature_id\(\),ab_look_selected_feature_prefix_id\(\)\)/);
 assert.match(helper,/AB_UI_NESTED\("terrain","angband\.look\.subject\.terrain",inner,N_ELEMENTS\(inner\)\)/);
 assert.match(helper,/ab_naming_copy_object_snapshot\(&frame->prompt_name,native_buffer\)/);
 assert.match(helper,/ab_naming_copy_monster_snapshot\(&frame->prompt_name,native_buffer\)/);
 assert.match(helper,/frame->prompt_named/);
 assert.match(source,/ab_context_floor_prompt\(player->upkeep->total_weight,diff\)/);
 assert.match(source,/ab_ui_reset\("context-floor"\)/);
});

test('presentation captures retain no gameplay objects, perform no simulation queries and consume no RNG', () => {
 const authored=(captures+helper).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\r\n]*/g,'');
 assert.doesNotMatch(authored,/\b(?:randint\w*|Rand\w*|rand_range|one_in_|dice_roll|effect_do|handle_stuff|update_mon|object_desc|monster_desc|square\w*|ignore_item_ok|player_can_\w*|inven_carry_okay|obj_has_charges|cmdq_push)\s*\(/);
 assert.doesNotMatch(authored,/\b(?:player|obj|mon|cave)->\w+(?:->\w+|\.\w+|\[[^\]\r\n]+\])*\s*(?:=(?!=)|\+\+|--|[+\-*/]=)/);
 assert.doesNotMatch(helper,/struct (?:object|monster|chunk)\s*\*/);
 assert.doesNotMatch(captures+helper,/[^\x00-\x7f]/,'CJK text belongs in reviewed JSON');
 assert.match(helper,/#define AB_CONTEXT_DEPTH 8U/);
 assert.match(helper,/#define AB_CONTEXT_ROWS 512U/);
 assert.deepEqual(review.limits.validity,{invalid:0,valid:1,hidden:2});
});

test('rogue mouse KC_TAB maps its exact source-selected byte to the existing readable Tab token', () => {
 const events=read('logic/ui-event.c'), keys=read('logic/ui-event.h');
 const tab=Number(/#define KC_TAB\s+(0x[0-9a-f]+)/i.exec(keys)[1]);
 assert.equal(tab,0x9d);
 assert.match(commandSource,/"Fire at nearest target",\s*\{\s*'h',\s*KC_TAB\s*\}/);
 assert.match(events,/\{ KC_TAB, "Tab" \}/);
 const original=functionBody(reconstructContext(source),'show_command_list');
 assert.match(original,/char key\[3\];/);
 assert.match(original,/key\[0\] = cmd_list\[i\]\.key\[mode\];\s*key\[1\] = '\\0';/);
 const enter=functionBody(reconstructContext(source),'cmd_sub_entry');
 assert.match(enter,/struct keypress kp = \{ EVT_KBRD, commands\[oid\]\.key\[mode\], 0 \};\s*char buf\[16\];/);
 const body=functionBody(helper,'ab_context_shortcut');
 // Execute the exact owned C ternary after adapting only its byte cast/NUL
 // syntax. The same native byte array and source keycode identity enter it.
 const ternary=/const char \*display_shortcut =\s*([\s\S]*?);/.exec(body)[1];
 assert.match(ternary,/^\(\(unsigned char\)native_shortcut\[0\] == KC_TAB && native_shortcut\[1\] == '\\0'\) \? "Tab" : native_shortcut$/);
 const adapt=Function('native_shortcut','KC_TAB','return '+ternary.replace('(unsigned char)','').replace("'\\0'",'0'));
 const decode=value => typeof value==='string' ? value : Buffer.from(value).subarray(0,value.indexOf(0)<0?value.length:value.indexOf(0)).toString('latin1');
 const raw=Uint8Array.from([tab,0]);
 assert.throws(()=>new TextDecoder('utf-8',{fatal:true}).decode(raw.subarray(0,1)),/encoded data|encoding/i);
 assert.equal(decode(adapt(raw,tab)),'Tab');
 for(const text of ['q','^d','^@','Tab']) {
  const native=Uint8Array.from([...Buffer.from(text,'ascii'),0]);
  assert.equal(decode(adapt(native,tab)),text,'all already-readable native shortcuts remain exact');
 }
 const moreThanOneByte=Uint8Array.from([tab,113,0]);
 assert.equal(adapt(moreThanOneByte,tab),moreThanOneByte,'mapping applies only to the sole KC_TAB byte');
 assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(' ('+decode(adapt(raw,tab))+')','utf8')),' (Tab)');
 const authored=body.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.doesNotMatch(authored,/keypress_to_readable|keycode_find_desc|cmd_lookup|strcmp|strstr|Term_|cmdq_|player|rand|Rand|object_desc|monster_desc/);
 const macro=/#define UN_KTRL\(X\) \\\r?\n\s*([^\r\n]+)/.exec(keys)[1];
 assert.equal(macro,'(((X) < 0x01 || (X) > 0x1B) ? (X) + 64 : (X) + 96)');
 const uncontrol=Function('X','return '+macro);
 const arrays=[...commandSource.matchAll(/struct cmd_info cmd_\w+\[\]\s*=\s*\{([\s\S]*?)\n\};/g)].map(match=>match[1]).join('\n');
 const controlCodes=[0,...[...arrays.matchAll(/KTRL\('([A-Z])'\)/g)].map(match=>match[1].charCodeAt(0)&0x1f)];
 const actualControlSuffix=[...new Set(controlCodes.map(code=>String.fromCharCode(uncontrol(code))))].sort().join('');
 assert.equal(actualControlSuffix,'@adefgloprstvwxz','finite pinned command keys plus the native zero-key placeholder');
 const contract=JSON.parse(read('migration/context-menu-data/shortcut-contract.json'));
 assert.equal(contract.upstream_commit,review.upstream_commit);
 assert.equal(contract.validation.caret_suffix_ascii,'@adefgloprstvwxz');
 assert.equal(contract.validation.maximum_utf8_bytes,18);
 for(const fingerprint of contract.source_fingerprints) {
  assert.equal(sha(fs.readFileSync(path.join(root,fingerprint.file))),fingerprint.sha256,fingerprint.file);
 }
});
