import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const nativePins={
 'ui-player.c':'c6487ae963b9739b2395898252fd2d8e04406d145e96640c280801e8577e464d',
 'ui-entry.c':'4c9bedf5bcc23c987a97d9ccce0bbc5edfd240111ff5c9bc428ab8474563fc90',
 'ui-entry.h':'162ab0431fb51e4cfe58aa2e7d5d406f2b7f7b4de8d82e2585118184cbdd2af1',
 'ui-entry-renderers.c':'cb9e574de3ec318f16c5cfa3ffbbbb4c839f166186084d33124336e26141d072',
};
const stripOwn=source=>source.replace(/\/\* AB_CHARACTER_MATRIX_BEGIN \*\/[\s\S]*?\/\* AB_CHARACTER_MATRIX_END \*\//g,'').replace(/\/\* AB_CHARACTER_MATRIX_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_CHARACTER_MATRIX_INLINE_END \*\//g,'');
for(const [file,pin] of Object.entries(nativePins))test(`matrix/export annotations preserve exact prior native bytes: ${file}`,async()=>{
 const baseline=await readFile(new URL('migration/character-matrix-data/native-baseline/'+file,root));
 assert.equal(hash(baseline),pin,'frozen baseline cannot change to waive parity');
 const current=await read('logic/'+file);
 assert.equal(hash(Buffer.from(stripOwn(current))),pin);
 assert.equal(Buffer.compare(Buffer.from(stripOwn(current)),baseline),0);
});
test('native reconstruction catches an actual gameplay getter mutation',async()=>{
 const source=await read('logic/ui-player.c');
 const mutated=source.replace('compute_ui_entry_values_for_player(entry, player, &pcache','compute_ui_entry_values_for_player(entry, NULL, &pcache');
 assert.notEqual(hash(Buffer.from(stripOwn(mutated))),nativePins['ui-player.c']);
});
test('catalog IDs, types and EN/JA placeholders match all reviewed entries',async()=>{
 const manifest=JSON.parse(await read('migration/character-matrix-data/source-manifest.json'));
 const en=JSON.parse(await read('migration/character-matrix-data/en.json')),ja=JSON.parse(await read('migration/character-matrix-data/ja.json'));
 assert.equal(manifest.upstream_commit,'f3082213b73f3e463e3d0d60bff4b00462beae6e');
 assert.equal(manifest.entries.length,173);assert.equal(manifest.complete_game_localization,false);
 assert.deepEqual(Object.keys(en).sort(),Object.keys(ja).sort());assert.deepEqual(Object.keys(en).sort(),manifest.entries.map(e=>e.id).sort());
 const placeholders=text=>[...text.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(m=>m[1]).sort();
 for(const e of manifest.entries){
  assert.equal(en[e.id],e.english);assert.equal(ja[e.id],e.japanese);assert.ok(e.japanese);
  assert.deepEqual(placeholders(e.english),e.parameters.map(p=>p.name).sort(),e.id+' EN');assert.deepEqual(placeholders(e.japanese),e.parameters.map(p=>p.name).sort(),e.id+' JA');
  assert.ok(e.parameters.every(p=>['localized_text','integer','signed_integer','opaque_parser_token','canonical_key','KnownObjectDescription','canonical_identity','opaque_build_identity','verbatim_user_text'].includes(p.type)));
 }
});
test('all 86 source label directives bind canonical identity and exact English',async()=>{
 const manifest=JSON.parse(await read('migration/character-matrix-data/source-manifest.json'));
 const labels=manifest.entries.filter(e=>e.role==='matrix_label');assert.equal(labels.length,86);
 const lines=(await read('data/gamedata/ui_entry.txt')).split(/\r?\n/);const expected=[];let name;
 lines.forEach((line,index)=>{if(line.startsWith('name:'))name=line.slice(5);else if(/^label(?:\d+)?:/.test(line))expected.push({name,line:index+1,english:line.slice(line.indexOf(':')+1)});});
 assert.equal(expected.length,86);
 for(const item of expected){const e=labels.find(e=>e.sources.some(s=>s.line===item.line && s.canonical_name===item.name));assert.ok(e,item.name);assert.equal(e.english,item.english);assert.match(e.japanese,/[\u3000-\u9fff]/);}
});
test('five actual stat-generated entries and exact 12-slot body order are projected',async()=>{
 const manifest=JSON.parse(await read('migration/character-matrix-data/source-manifest.json'));
 const stats=[...(await read('logic/list-stats.h')).matchAll(/^STAT\((\w+)\)/gm)].map(m=>m[1]);assert.deepEqual(stats,['STR','INT','WIS','DEX','CON']);
 assert.deepEqual(manifest.entries.filter(e=>e.role==='matrix_generated_label').map(e=>e.english),stats);
 const body=(await read('data/gamedata/body.txt')).split(/\r?\n/).filter(l=>l.startsWith('slot:'));assert.equal(body.length,12);
 const helper=await read('logic/web-character-matrix.c');assert.match(helper,/"abcdefgimnop"\[index\]/);assert.match(helper,/index==matrix.slots\?'@'/);
 assert.match(helper,/#define AB_MATRIX_MAX_SLOTS 12/);
 const labels=[...helper.matchAll(/\{"([^"]+)","angband.character.matrix.label./g)].map(m=>m[1]);assert.equal(labels.length,50);assert.equal(new Set(labels).size,50);
});
for(const [backend,enumName,count] of [['COMPACT_RESIST_RENDERER_WITH_COMBINED_AUX','RESIST',22],['COMPACT_FLAG_RENDERER_WITH_COMBINED_AUX','FLAG',5],['NUMERIC_AS_SIGN_RENDERER_WITH_COMBINED_AUX','SIGNED',11],['NUMERIC_RENDERER_WITH_BOOL_AUX','SUSTAIN',8]])test(`${backend}: observe final native palette, preserve hidden-value branch`,async()=>{
 const render=await read('logic/ui-entry-renderers.c');const start=render.lastIndexOf('static void renderer_'+backend+'('),end=render.indexOf('\nstatic int valuewidth_',start);const part=render.slice(start,end);
 assert.equal((part.match(/ab_character_matrix_selected\(/g)||[]).length,1);
 const written=part.indexOf(enumName==='SUSTAIN'?'safe_queue_chars(p.x':'Term_putch(');assert.ok(written>=0 && part.indexOf('ab_character_matrix_selected(')>written);
 assert.match(part,new RegExp('ab_character_matrix_selected\\(AB_MATRIX_'+enumName+',i,palette_index,info->colors\\[palette_index \\+ color_offset\\]'));
 assert.match(part,/UI_ENTRY_UNKNOWN_VALUE|convert_vanilla_res_level/);
 const manifest=JSON.parse(await read('migration/character-matrix-data/source-manifest.json'));assert.equal(manifest.entries.filter(e=>e.role==='matrix_selected_state' && e.sources[0].backend===enumName.toLowerCase()).length,count);
});
test('capture adds no gameplay getter, RNG or combiner reevaluation',async()=>{
 const helper=await read('logic/web-character-matrix.c');
 assert.doesNotMatch(helper,/\b(?:randint0|randint1|one_in_|Rand_div|slot_object|object_flags_known|object_flag_is_known|object_element_is_known|compute_ui_entry_values_for_object|compute_ui_entry_values_for_player|is_ui_entry_for_known_rune|ui_entry_renderer_apply|ui_entry_combiner_get_funcs)\s*\(/);
 assert.match(helper,/Term_what\(x\+i,y,&a,&c\)/);
 assert.match(helper,/width>AB_MATRIX_MAX_VALUE_WIDTH/);assert.match(helper,/index>matrix.slots/);
 const source=await read('logic/ui-player.c');assert.equal((source.match(/compute_ui_entry_values_for_object\(/g)||[]).length,2);assert.equal((source.match(/compute_ui_entry_values_for_player\(/g)||[]).length,2);
 assert.match(source,/vals\[player->body.count\] = 0;/);
});
test('native export observes all original item sections, options, message/death and final boundary',async()=>{
 const source=await read('logic/ui-player.c'),helper=await read('logic/web-character-matrix.c');
 assert.equal((source.match(/AB_CHARACTER_EXPORT_SLOT\(/g)||[]).length,4);
 assert.equal((source.match(/AB_CHARACTER_EXPORT_RETIRED\(/g)||[]).length,1);
 assert.equal((source.match(/AB_CHARACTER_EXPORT_OPTION_KEY\(/g)||[]).length,1);
 assert.match(helper,/ab_naming_copy_object_snapshot\(&snapshot,native_buffer\)/);
 assert.match(helper,/ab_dc_emit_current\("character-export",widget/);
 assert.match(helper,/ab_message_recall_emit\(\(uint16_t\)age,"character-export",widget\)/);
 assert.match(helper,/ab_ui_scope_begin_required\("character-export",true\)/);
 assert.match(helper,/"__export_ready"/);assert.match(helper,/#define AB_EXPORT_MAX_ROWS 16384U/);
 assert.match(helper,/exported.row>=AB_EXPORT_MAX_ROWS/);
 for(const role of ['basics','sustains','messages','equipment','inventory','quiver','home','options','randart_seed'])assert.ok(source.includes('ab_character_export_heading("'+role+'")'));
});
test('original slot/key/death getters are evaluated once with identity-return wrappers',async()=>{
 const source=await read('logic/ui-player.c'),native=await read('migration/character-matrix-data/native-baseline/ui-player.c');
 for(const pattern of [/gear_to_label\(player, obj\)/g,/option_name\(opt\)/g,/streq\(player->died_from, "Retiring"\)/g])assert.equal([...source.matchAll(pattern)].length,[...native.matchAll(pattern)].length);
 const helper=await read('logic/web-character-matrix.c');assert.match(helper,/ab_character_export_object\(\(char\)selected_slot,buffer\);return selected_slot;/);assert.match(helper,/ab_character_export_option\(option,value,key\);return key;/);assert.match(helper,/ab_character_export_death\(retired\);return retired;/);
});
test('export UI mirror nests owned selected descriptors and skips recursive or second-sheet output',async()=>{
 const helper=await read('logic/web-character-matrix.c');
 assert.match(helper,/!exported\.basics/);assert.match(helper,/strcmp\(context,"character"\)/);
 assert.match(helper,/AB_UI_NESTED\("value",source,params,count\)/);
 assert.match(helper,/if\(!strcmp\(role,"sustains"\)\)\{[\s\S]*?exported.basics=false/);
 assert.match(helper,/export_label_count>=AB_EXPORT_LABELS/);
 assert.match(helper,/"verbatim_user_text"/);
});

test('capture saturation or missing source descriptors rejects readiness without partial download',async()=>{
 const helper=await read('logic/web-character-matrix.c');
 assert.match(helper,/if\(exported.failed\)return;/);
 const end=helper.slice(helper.indexOf('void ab_character_export_end'),helper.indexOf('void ab_character_export_heading'));
 assert.ok(end.indexOf('if(exported.failed)return;')<end.indexOf('__export_ready'));
 assert.match(helper,/exported.row>=AB_EXPORT_MAX_ROWS\)\{exported.failed=true;return false;/);
 assert.match(helper,/if\(!ab_naming_copy_object_snapshot\(&snapshot,native_buffer\)\)\{exported.failed=true;return;/);
});

test('all native dumped INTERFACE and BIRTH options use the full existing semantic map',async()=>{
 const options=await read('logic/list-options.h'),bindings=await read('migration/interface-data/option-bindings.inc'),helper=await read('logic/web-character-matrix.c');
 const dumped=[...options.matchAll(/OP\((\w+),\s*"(?:\\.|[^"\\])*",\s*(INTERFACE|BIRTH),/g)].map(m=>m[1]);
 assert.equal(dumped.length,37);for(const name of dumped)assert.ok(bindings.includes('OPT_'+name),name);
 assert.match(helper,/const char \*id=ab_if_option_id\(option\)/);assert.doesNotMatch(helper,/ab_ui_option_id\(option\)/);
});

test('level-cap advance experience observes original unavailable branch without a new player lookup',async()=>{
 const source=await read('logic/ui-player.c');const a=source.indexOf('static const char *show_adv_exp'),b=source.indexOf('static const char *show_depth',a);const part=source.slice(a,b);
 assert.match(part,/player->lev < PY_MAX_LEVEL/);assert.match(part,/ab_ui_static\(NULL,"advance_experience.value","angband.character.export.advance_experience.capped"\)/);
 assert.ok(part.indexOf('angband.character.export.advance_experience.capped')<part.indexOf('return "********"'));
 const manifest=JSON.parse(await read('migration/character-matrix-data/source-manifest.json'));const e=manifest.entries.find(e=>e.id==='angband.character.export.advance_experience.capped');assert.equal(e.english,'********');assert.equal(e.japanese,'上限到達');
});
test('value-before-label stealth captures only the original static descriptor until original label arrives',async()=>{
 const source=await read('logic/ui-player.c'),helper=await read('logic/web-character-matrix.c');const a=source.indexOf('/* Stealth */',source.indexOf('get_panel_skills'));
 assert.ok(source.indexOf('desc = likert(',a)<source.indexOf('"stealth.label"',a));
 assert.match(helper,/static struct \{ bool valid; char key\[96\],id\[192\]; \} export_pending_static/);
 assert.match(helper,/export_pending_static.valid && !strcmp\(export_pending_static.key,export_labels\[i\].key\)/);
 assert.match(helper,/AB_UI_REF\("value",export_pending_static.id\)/);
 assert.match(helper,/export_pending_static.valid=false;ab_character_export_emit\("angband.character.export.field",p,2\)/);
 assert.match(helper,/if\(export_pending_static.valid\)ab_character_export_reject\(\)/);
});
test('primary first-sheet source path clears the obsolete second-sheet scope',async()=>{
 const source=await read('logic/ui-player.c');const a=source.indexOf('void display_player(int mode)'),b=source.indexOf('void write_character_dump',a);const part=source.slice(a,b);
 assert.match(part,/if\(ui_character_main && !mode\)ab_ui_reset\("character-matrix"\)/);
 assert.ok(part.indexOf('ab_ui_reset("character-matrix")')<part.indexOf('display_player_stat_info();'));
});

// Exact source count detects rejected final rows independently of observed prefix.
test('export readiness owns the exact allocation count for completion validation', async () => {
  const source = (await read('logic/web-character-matrix.c')).toString('utf8');
  const end = source.slice(source.indexOf('void ab_character_export_end(void)'), source.indexOf('void ab_character_export_heading('));
  assert.match(end, /if\(exported\.failed\)return;/);
  assert.match(end, /ab_semantic_param_begin\(&event,"expected_rows","integer"\)/);
  assert.match(end, /ab_semantic_json_int32\(&event,\(int32_t\)exported\.row\)/);
  assert.equal((end.match(/ab_semantic_param_begin/g) || []).length, 1);
  const allocate = source.slice(source.indexOf('bool ab_character_export_widget('), source.indexOf('void ab_character_export_emit('));
  assert.match(allocate, /exported\.row>=AB_EXPORT_MAX_ROWS/);
  assert.match(allocate, /exported\.row\+\+/);
  assert.match(source, /#define AB_EXPORT_MAX_ROWS 16384U/);
});

test('the native turns-used group heading is preserved by canonical widget identity', async () => {
  const player = (await read('logic/ui-player.c')).toString('utf8');
  const helper = (await read('logic/web-character-matrix.c')).toString('utf8');
  assert.match(player, /ab_ui_static\(NULL,"turns_used\.label","player\.sheet\.turns_used\.label"\)/);
  assert.match(player, /panel_line\(p, attr, "Turns used:", ""\)/);
  assert.match(helper, /if\(!strcmp\(widget,"turns_used\.label"\)\)ab_character_export_emit\(id,NULL,0\)/);
  assert.doesNotMatch(helper, /strcmp\([^\n]*"Turns used"/);
});

const stripInputCapacityObserver = source => source.replace(/#ifdef __EMSCRIPTEN__ \/\* AB_UI_PURE \*\/\r?\n \/\* AB_UI_INPUT_CAPACITY: already selected initialized bytes and capacity\. \*\/\r?\n ab_ui_input_capacity\(buf, capacity\);\r?\n#endif \/\* AB_UI_PURE \*\/\r?\n/g, '');
test('input-capacity observer restores exact prior native input bytes and rejects an 80-column rule change', async () => {
 const source = await read('logic/ui-input.c');
 const pin = '15395f7cdcfd49c62e92e36304b694e82e12ecda58609095985c2d591523b2ab';
 assert.equal((source.match(/ab_ui_input_capacity\(buf, capacity\)/g) || []).length, 1);
 assert.equal(hash(Buffer.from(stripInputCapacityObserver(source))), pin);
 const mutated = source.replace('if (x + len > 80) len = 80 - x;', 'if (x + len > 100) len = 100 - x;');
 assert.notEqual(hash(Buffer.from(stripInputCapacityObserver(mutated))), pin);
});
test('name bound comes from the successful selected initializer after the original 55-column/80-column clamp', async () => {
 const source = await read('logic/ui-input.c');
 const initialize = source.slice(source.indexOf('static bool ab_web_text_initialize('), source.indexOf('static bool ab_web_text_keypress('));
 assert.ok(initialize.indexOf('ab_ui_input_capacity(buf, capacity)') > initialize.indexOf('buf[terminator] = 0;'));
 assert.ok(initialize.indexOf('ab_ui_input_capacity(buf, capacity)') > initialize.indexOf('status != 0'));
 const edit = source.slice(source.indexOf('bool askfor_aux_ext('), source.indexOf('static bool get_name_keypress('));
 assert.ok(edit.indexOf('if (x + len > 80) len = 80 - x;') < edit.indexOf('ab_web_text_initialize(buf, len)'));
 assert.ok(edit.indexOf('ab_web_text_initialize(buf, len)') < edit.indexOf('in = inkey_ex()'));
 const name = source.slice(source.indexOf('bool get_character_name('), source.indexOf('static bool textui_get_string('));
 const prompt = name.match(/prt\(("[^"\n]+"), 0, 0\)/);
 assert.ok(prompt);assert.equal(JSON.parse(prompt[1]).length,55);
 assert.equal(80 - JSON.parse(prompt[1]).length,25);
 const helper = await read('logic/web-ui-text.c');
 assert.match(helper, /binding->max_bytes=\(int32_t\)\(effective_capacity-1\)/);
 assert.equal((80 - JSON.parse(prompt[1]).length)-1,24);
});
test('typed input byte metadata survives refresh and is isolated by widget and scope lifetime including zero capacity', async () => {
 const helper = await read('logic/web-ui-text.c');
 const input = helper.slice(helper.indexOf('void ab_ui_input('), helper.indexOf('void ab_ui_leave_birth('));
 assert.match(input, /if\(binding->bounded\)p\[count\+\+\]=AB_UI_INT\("max_bytes",binding->max_bytes\)/);
 assert.match(input, /binding->bounded=true/);assert.doesNotMatch(input, /if\(binding->max_bytes/);
 assert.match(input, /strcmp\(binding->widget,widget\)/);assert.match(input, /strcmp\(binding->type,type\)/);
 assert.match(input, /ui_dispatch\(NULL,key,"",p,count,true\)/);
 assert.match(input, /ab_ui_input\(binding->widget,selected_text,binding->type\)/);
 for(const sequence of ['memset(&ui_inputs[ui_depth],0,sizeof(ui_inputs[ui_depth]));','memset(&ui_inputs[ui_depth-1],0,sizeof(ui_inputs[ui_depth-1]));','memset(&ui_inputs[i],0,sizeof(ui_inputs[i]));'])assert.ok(helper.includes(sequence));
 assert.match(await read('logic/web-ui-text.h'), /void ab_ui_input_capacity\(const char \*selected_text,size_t effective_capacity\)/);
 assert.doesNotMatch(input, /\b(?:randint0|randint1|Rand_div|effect_do|Term_locate|player_random_name)\s*\(/);
});
