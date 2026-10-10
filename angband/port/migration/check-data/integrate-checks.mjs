// Retired first-stage importer: byte-exact additive source phases are now authoritative.
// Do not rerun against integrated files; use focused source assertions and preserve original line endings.
/* Additive source bindings. Never restores another owner's C inputs. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const manifest=JSON.parse(read('migration/interface-data/source-manifest.json'));
const en=JSON.parse(read('migration/interface-data/en.json')),ja=JSON.parse(read('migration/interface-data/ja.json'));
const phase=[],connections=[];
function source(file,needle){const text=read('tests/first-naming-build-snapshot/source/'+file),at=text.indexOf(needle);assert.ok(at>=0,file+': '+needle);return{file,line:text.slice(0,at).split('\n').length,original_lexeme:needle};}
function add(id,english,japanese,parameters=[],sources=[]){const record={id,english,japanese,parameters,sources,role:'source_check_projection',status:'reviewed_source_catalog'};
 if(Object.hasOwn(en,id)){assert.equal(en[id],english);assert.equal(ja[id],japanese);}else{en[id]=english;ja[id]=japanese;manifest.entries.push(record);}phase.push(record);return id;}
const fixed=[
 ['descend','Are you sure you want to descend? ','本当に下の階へ降りますか？','cmd-cave.c'],
 ['wizard_mode','Are you sure you want to enter wizard mode? ','本当にウィザード・モードに入りますか？','cmd-misc.c'],
 ['borg_commands','Are you sure you want to use the borg commands? ','本当に自動プレイのコマンドを使いますか？','cmd-misc.c'],
 ['cast_anyway','Attempt it anyway? ','それでも試みますか？','cmd-obj.c'],
 ['acquire_great','Acquire great objects? ','上質な品を生成しますか？','cmd-wizard.c'],
 ['stop_disconnected','Stop if disconnected level found? ','移動不能な区画のある階が見つかったら止めますか？','cmd-wizard.c'],
 ['regenerate_randarts','Regen randarts (warning SLOW)? ','ランダム・アーティファクトを再生成しますか？（時間がかかります）','cmd-wizard.c'],
 ['instant_artifacts','Create instant artifacts? ','即時生成型のアーティファクトを作りますか？','cmd-wizard.c'],
 ['choose_cave_profile','Choose cave profile? ','洞窟の生成形式を選びますか？','cmd-wizard.c'],
 ['discard_wizard_item','Couldn\'t proceed.  Stop playing with item and lose all changes? ','処理を続けられません。品の編集をやめ、変更をすべて破棄しますか？','cmd-wizard.c'],
 ['set_recall_depth','Set recall depth to current depth? ','帰還先を現在の階に設定しますか？','effect-handler-general.c'],
 ['cancel_recall','Word of Recall is already active.  Do you want to cancel it? ','帰還の呪文はすでに発動中です。取り消しますか？','effect-handler-general.c'],
 ['debug_commands','Are you sure you want to use the debug commands? ','本当にデバッグ用コマンドを使いますか？','game-input.c'],
 ['die','Die? ','死を受け入れますか？','player-util.c'],
 ['panic_save','A panic save exists.  Use it? ','緊急保存のデータがあります。使いますか？','ui-game.c'],
 ['retry_save','Saving failed.  Try again? ','保存に失敗しました。再試行しますか？','ui-game.c'],
 ['replace_file','Replace existing file? ','既存のファイルを置き換えますか？','ui-input.c'],
 ['inscription_command','Are you sure? ','本当に実行しますか？','ui-input.c'],
 ['quit_without_save','Really quit without saving? ','本当に保存せずに終了しますか？','ui-wizard.c'],
];
for(const[key,english,japanese,file]of fixed)add('interface.check.'+key,english,japanese,[],[source('logic/'+file,JSON.stringify(english))]);
add('interface.check.confirm','{prompt} [y/n]','{prompt} ［y＝はい／n＝いいえ］',[{name:'prompt',type:'localized_text'}],[source('logic/ui-input.c','"%.70s[y/n] "')]);
add('interface.check.yes','Yes','はい');add('interface.check.no','No','いいえ');
add('interface.check.store.confirm','{prompt} [ESC, any other key to accept]','{prompt} ［Esc＝取消／それ以外のキー＝了承］',[{name:'prompt',type:'localized_text'}],[source('logic/ui-store.c','"[ESC, any other key to accept]"')]);
add('interface.check.store.accept','Accept','了承する');add('interface.check.store.cancel','Cancel','取り消す');
add('interface.check.store.price','Price: {price}','価格：{price}',[{name:'price',type:'integer'}],[source('logic/ui-store.c','"Price: %ld"')]);
add('interface.check.object.take_off','Really take off {object}?','本当に{object}を外しますか？',[{name:'object',type:'KnownObjectDescription'}],[source('logic/cmd-obj.c','"Really take off %s? "')]);
add('interface.check.object.take_off_drop','Really take off and drop {object}?','本当に{object}を外して床に置きますか？',[{name:'object',type:'KnownObjectDescription'}],[source('logic/obj-ignore.c','"Really take off and drop"')]);
add('interface.check.object.action','Really {action} {object}?','本当に{object}に対して「{action}」を実行しますか？',[{name:'action',type:'localized_text'},{name:'object',type:'KnownObjectDescription'}],[source('logic/ui-object.c','"Really %s"'),source('logic/obj-util.c','"%s %s? "')]);
for(const[key,english,japanese,needle]of[
 ['sell','Sell {object}?','{object}を売りますか？','"Sell"'],['give','Give {object}?','{object}を店に寄付しますか？','"Give"'],
 ['buy','Buy {object}?','{object}を買いますか？','"Buy %s?%s %s"'],['buy_cannot_use','Buy {object}? (Can\'t use!)','{object}を買いますか？（使用できません）','" (Can\'t use!)"'],
])add('interface.check.store.'+key,english,japanese,[{name:'object',type:'KnownObjectDescription'}],[source('logic/ui-store.c',needle)]);
for(const[key,english,japanese,file,needle]of[
 ['write_file','Confirm writing to {path}?','{path}に書き込みますか？','ui-input.c','"Confirm writing to %s? "'],
 ['write_preferences','Confirm writing to {path}?','{path}に設定を書き込みますか？','ui-options.c','"Confirm writing to %s? "'],
 ['load_preferences','Confirm loading {path}?','{path}から設定を読み込みますか？','ui-options.c','"Confirm loading %s? "'],
])add('interface.check.'+key,english,japanese,[{name:'path',type:'opaque_file_path'}],[source('logic/'+file,needle)]);
add('interface.check.fire_out_of_range','Target out of range by {distance} squares. Fire anyway?','標的までの距離が射程を{distance}マス超えています。それでも撃ちますか？',[{name:'distance',type:'integer'}],[source('logic/player-attack.c','"Target out of range by %d squares. Fire anyway? "')]);

const verbsJa={
 LOADFILE:'セーブデータを読み込む',NEWGAME:'新しいゲームを始める',BIRTH_INIT:'キャラクター作成を始める',BIRTH_RESET:'キャラクター作成の最初に戻る',CHOOSE_RACE:'種族を選ぶ',CHOOSE_CLASS:'職業を選ぶ',BUY_STAT:'能力値にポイントを割り振る',SELL_STAT:'能力値のポイントを戻す',RESET_STATS:'能力値を初期化する',REFRESH_STATS:'能力値を更新する',ROLL_STATS:'能力値を振り直す',PREV_STATS:'直前に振った能力値を使う',NAME_CHOICE:'名前を選ぶ',HISTORY_CHOICE:'生い立ちを書く',ACCEPT_CHARACTER:'キャラクターを確定する',
 GO_UP:'階段を上る',GO_DOWN:'階段を下りる',WALK:'歩く',RUN:'走る',EXPLORE:'探索する',NAVIGATE_UP:'上の階へ向かう',NAVIGATE_DOWN:'下の階へ向かう',JUMP:'跳ぶ',OPEN:'開ける',CLOSE:'閉める',TUNNEL:'掘る',HOLD:'その場に留まる',DISARM:'罠を解除する',ALTER:'操作する',STEAL:'盗む',REST:'休息する',SLEEP:'眠る',PATHFIND:'歩く',PICKUP:'拾う',AUTOPICKUP:'自動で拾う',WIELD:'装備する',TAKEOFF:'外す',DROP:'床に置く',UNINSCRIBE:'銘を消す',AUTOINSCRIBE:'自動で銘を付ける',EAT:'食べる',QUAFF:'飲む',USE_ROD:'ロッドを振る',USE_STAFF:'杖を使う',USE_WAND:'ワンドを向ける',READ_SCROLL:'読む',ACTIVATE:'発動させる',REFILL:'燃料を補給する',FIRE:'射撃する',THROW:'投げる',INSCRIBE:'銘を付ける',STUDY:'学ぶ',CAST:'呪文を唱える',SELL:'売る',STASH:'自宅に保管する',BUY:'買う',RETRIEVE:'自宅から取り出す',USE:'使う',RETIRE:'キャラクターを引退させる',HELP:'ヘルプを開く',REPEAT:'繰り返す',COMMAND_MONSTER:'モンスターに命令する',
 SPOIL_ARTIFACT:'アーティファクトの全情報をファイルに書く',SPOIL_MON:'モンスターの全情報をファイルに書く',SPOIL_MON_BRIEF:'モンスターの情報一覧をファイルに書く',SPOIL_OBJ:'品の全情報をファイルに書く',
 WIZ_ACQUIRE:'品を生成する',WIZ_ADVANCE:'キャラクターを強化する',WIZ_BANISH:'近くのモンスターを追放する',WIZ_CHANGE_ITEM_QUANTITY:'品の個数を変更する',WIZ_COLLECT_DISCONNECT_STATS:'移動不能な区画の統計を取る',WIZ_COLLECT_OBJ_MON_STATS:'品とモンスターの統計を取る',WIZ_COLLECT_PIT_STATS:'モンスターの巣の統計を取る',WIZ_CREATE_ALL_ARTIFACT:'すべてのアーティファクトを生成する',WIZ_CREATE_ALL_ARTIFACT_FROM_TVAL:'指定した種類のアーティファクトをすべて生成する',WIZ_CREATE_ALL_OBJ:'すべての品を生成する',WIZ_CREATE_ALL_OBJ_FROM_TVAL:'指定した種類の品をすべて生成する',WIZ_CREATE_ARTIFACT:'アーティファクトを生成する',WIZ_CREATE_OBJ:'品を生成する',WIZ_CREATE_TRAP:'罠を生成する',WIZ_CURE_ALL:'すべて回復する',WIZ_CURSE_ITEM:'品の呪いを変更する',WIZ_DETECT_ALL_LOCAL:'近くのすべてを感知する',WIZ_DETECT_ALL_MONSTERS:'すべてのモンスターを感知する',WIZ_DISPLAY_KEYLOG:'キー入力の記録を表示する',WIZ_DUMP_LEVEL_MAP:'階の地図をファイルに書く',WIZ_EDIT_PLAYER_EXP:'経験値を変更する',WIZ_EDIT_PLAYER_GOLD:'所持金を変更する',WIZ_EDIT_PLAYER_START:'キャラクターの編集を始める',WIZ_EDIT_PLAYER_STAT:'能力値を編集する',WIZ_HIT_ALL_LOS:'視界内のすべてのモンスターを攻撃する',WIZ_INCREASE_EXP:'経験値を増やす',WIZ_JUMP_LEVEL:'指定した階に移動する',WIZ_LEARN_OBJECT_KINDS:'品の種類の知識を得る',WIZ_MAGIC_MAP:'近くの地形を把握する',WIZ_PEEK_NOISE_SCENT:'音と匂いの分布を表示する',WIZ_PERFORM_EFFECT:'効果を実行する',WIZ_PLAY_ITEM:'品を試しに編集する',WIZ_PUSH_OBJECT:'マスから品を移動する',WIZ_QUERY_FEATURE:'指定した地形を強調表示する',WIZ_QUERY_SQUARE_FLAG:'マスの属性を調べる',WIZ_QUIT_NO_SAVE:'保存せずに終了する',WIZ_RECALL_MONSTER:'モンスターの情報を表示する',WIZ_RERATE:'HPを振り直す',WIZ_REROLL_ITEM:'品を振り直す',WIZ_STAT_ITEM:'品の統計を取る',WIZ_SUMMON_NAMED:'指定したモンスターを召喚する',WIZ_SUMMON_RANDOM:'ランダムなモンスターを召喚する',WIZ_TELEPORT_RANDOM:'テレポートする',WIZ_TELEPORT_TO:'指定した場所へテレポートする',WIZ_TWEAK_ITEM:'品の属性を変更する',WIZ_WIPE_RECALL:'モンスターの知識を消す',WIZ_WIZARD_LIGHT:'階の全域を照らす',
};
const commandSource=read('tests/first-naming-build-snapshot/source/logic/cmd-core.c');
const commands=[...commandSource.matchAll(/\{ (CMD_([A-Z0-9_]+)), ("(?:[^"\\]|\\.)*")\s*,/g)].map(m=>({command:m[1],key:m[2],lexeme:JSON.parse(m[3]),id:'interface.check.command.'+m[2].toLowerCase()}));
assert.equal(commands.length,Object.keys(verbsJa).length);
for(const c of commands){assert.ok(verbsJa[c.key],c.key);add(c.id,c.lexeme,verbsJa[c.key],[],[source('logic/cmd-core.c',`{ ${c.command}, ${JSON.stringify(c.lexeme)},`)]);}
add('interface.check.command.unknown','do that with','その操作を行う',[],[source('logic/ui-object.c','"do that with"')]);
write('logic/web-check-commands.h','/* SPDX-License-Identifier: GPL-2.0-only */\n/* Source enum + immutable field verification; not completed-English lookup. */\nstatic const struct { int command; const char *lexeme,*id; } ab_check_commands[] = {\n'+commands.map(c=>` {${c.command},${JSON.stringify(c.lexeme)},${JSON.stringify(c.id)}},`).join('\n')+'\n};\n');

const B='/* AB_CHECK_BEGIN */',E='/* AB_CHECK_END */';
const inline=(prefix,native,suffix=')')=>B+prefix+E+native+B+suffix+E;
const block=text=>B+'\n#ifdef __EMSCRIPTEN__\n'+text+'\n#endif\n'+E;
const pending=new Map();
function get(file){file='logic/'+file;if(!pending.has(file))pending.set(file,{original:read(file),source:read(file)});return pending.get(file);}
function replace(file,needle,next,count=1){const f=get(file),n=f.source.split(needle).length-1;assert.equal(n,count,file+': '+needle);f.source=f.source.replaceAll(needle,next);}
function staticCall(file,literal,id){const needle='get_check('+JSON.stringify(literal)+')';replace(file,needle,'get_check('+inline('AB_CHECK_SOURCE('+JSON.stringify(id)+', ',JSON.stringify(literal))+')',get(file).source.split(needle).length-1);connections.push({file:'logic/'+file,id,original_argument:JSON.stringify(literal),kind:'fixed_source_prompt'});}
for(const[key,literal,,file]of fixed)staticCall(file,literal,'interface.check.'+key);
staticCall('effect-handler-general.c','Are you sure you want to descend? ','interface.check.descend');
for(const[file,literal,id]of[
 ['ui-birth.c','A savefile for that name exists.  Overwrite it? ','birth.name.overwrite.confirm'],
 ['ui-command.c','Do you want to retire? ','interface.command.textui_cmd_retire.do_you_want_to_retire'],
 ['ui-command.c','Do you really want to retire?','interface.command.textui_cmd_retire.do_you_really_want_to_retire'],
 ['ui-command.c','Include monster list? ','interface.command.do_cmd_save_screen.include_monster_list'],
 ['ui-death.c','Start a new game? ','interface.death.death_new_game.start_a_new_game'],
 ['ui-death.c','Do you want to quit? ','interface.death.death_screen.do_you_want_to_quit'],
 ['ui-options.c','Keep this keymap? ','interface.options.ui_keymap_create.keep_this_keymap'],
])staticCall(file,literal,id);
replace('ui-birth.c','\tab_ui_expect_check("birth.name.overwrite.confirm");\n','');
replace('ui-birth.c','\tab_ui_expect_check(NULL);\n','');

for(const[file,buffer,english,id]of[
 ['ui-input.c','buf','Confirm writing to %s? ','interface.check.write_file'],
 ['ui-options.c','ftmp','Confirm writing to %s? ','interface.check.write_preferences'],
 ['ui-options.c','ftmp','Confirm loading %s? ','interface.check.load_preferences'],
]){const native=`format(${JSON.stringify(english)}, ${buffer})`;replace(file,'get_check('+native+')','get_check('+inline(`AB_CHECK_PARAMS("${id}", ((const struct ab_ui_param[]){AB_UI_OPAQUE("path","opaque_file_path",${buffer})}), 1, `,native)+')');connections.push({file:'logic/'+file,id,original_argument:native,kind:'opaque_filename'});}
replace('player-attack.c','get_check(msg)','get_check('+inline('AB_CHECK_PARAMS("interface.check.fire_out_of_range", ((const struct ab_ui_param[]){AB_UI_INT("distance",taim-range)}), 1, ','msg')+')');
connections.push({file:'logic/player-attack.c',id:'interface.check.fire_out_of_range',original_argument:'msg',kind:'already_computed_distance'});
const takeoff='object_desc(o_name, sizeof(o_name), equip_obj,\n\t\t\tODESC_PREFIX | ODESC_FULL, player);';
replace('cmd-obj.c',takeoff,takeoff+block('\tab_ui_check_object_prepare("interface.check.object.take_off",o_name);'));
replace('cmd-obj.c','get_check(format("Really take off %s? ", o_name))','get_check('+inline('AB_CHECK_PROMPT(','format("Really take off %s? ", o_name)')+')');
connections.push({file:'logic/cmd-obj.c',id:'interface.check.object.take_off',original_argument:'format("Really take off %s? ", o_name)',kind:'immediate_owned_object_snapshot'});
const verifyDesc='object_desc(o_name, sizeof(o_name), obj, ODESC_PREFIX | ODESC_FULL, p);';
replace('obj-util.c',verifyDesc,verifyDesc+block('\tab_ui_check_verify_object(prompt,o_name);'));
replace('obj-util.c','get_check(out_val)','get_check('+inline('AB_CHECK_PROMPT(','out_val')+')');
replace('obj-ignore.c','verify_object("Really take off and drop", obj, p)',inline('AB_CHECK_VERIFY("interface.check.object.take_off_drop", "Really take off and drop", ','verify_object("Really take off and drop", obj, p)'));
replace('ui-object.c','verify_object(prompt_buf, obj, player)',inline('AB_CHECK_VERIFY_COMMAND(cmd,verb,prompt_buf, ','verify_object(prompt_buf, obj, player)'));
connections.push({file:'logic/obj-util.c',id:'interface.check.object.action',original_argument:'out_val',kind:'verified_source_verb_and_immediate_owned_object_snapshot'});

const old='\n#ifdef __EMSCRIPTEN__ /* AB_UI_PURE */\n if(ab_ui_pending_check_id()) {\n  struct ab_ui_param p=AB_UI_REF("prompt",ab_ui_pending_check_id());\n  ab_ui_emit("name-editor","confirmation","birth.name.confirm_response_suffix",&p,1);\n }\n#endif /* AB_UI_PURE */';
replace('ui-input.c',old,block('\tab_ui_check_begin(prompt,false);'));
const inputSource=get('ui-input.c'),inputStart=inputSource.source.indexOf('static bool textui_get_check('),inputEnd=inputSource.source.indexOf('/* TODO: refactor get_check()',inputStart);
let inputFn=inputSource.source.slice(inputStart,inputEnd);
assert.ok(inputFn.includes('\tke = inkey_m();'));
inputFn=inputFn.replace('\tke = inkey_m();',block('\tab_ui_scope_commit();')+'\tke = inkey_m();');
inputFn=inputFn.replace('\tprt("", 0, 0);','\tprt("", 0, 0);'+block('\tab_ui_check_end();'));
inputSource.source=inputSource.source.slice(0,inputStart)+inputFn+inputSource.source.slice(inputEnd);

const sellDesc='object_desc(o_name, sizeof(o_name), temp_obj,\n\t\tODESC_PREFIX | ODESC_FULL, player);';
replace('ui-store.c',sellDesc,sellDesc+block('\tab_ui_check_object_capture(o_name);'));
replace('ui-store.c','} else { /* Player is at home */','} else { /* Player is at home */'+block('\t\tab_ui_check_discard();'));
replace('ui-store.c','OPT(player, birth_no_selling) ? "Give" : "Sell", o_name)',
 'OPT(player, birth_no_selling) ? '+inline('AB_CHECK_OBJECT_SELECT("interface.check.store.give", ','"Give"')+' : '+inline('AB_CHECK_OBJECT_SELECT("interface.check.store.sell", ','"Sell"')+', o_name)');
const buyDesc='object_desc(o_name, sizeof(o_name), dummy,\n\t\t\tODESC_PREFIX | ODESC_FULL | ODESC_STORE, player);';
replace('ui-store.c',buyDesc,buyDesc+block('\t\tab_ui_check_object_prepare(obj_can_use?"interface.check.store.buy":"interface.check.store.buy_cannot_use",o_name);'));
const salePrompt='format("%s %s? [ESC, any other key to accept]",\n\t\t\t\tOPT(player, birth_no_selling) ? ';
assert.ok(get('ui-store.c').source.includes(salePrompt));
// Wrap complete native expressions after adding selected-branch bindings.
const storeSource=get('ui-store.c');
for(const startMatch of [...storeSource.source.matchAll(/\bstore_get_check\(format\(/g)].reverse()){
 const start=startMatch.index+'store_get_check('.length,end=endCall(storeSource.source,start);const native=storeSource.source.slice(start,end);
 storeSource.source=storeSource.source.slice(0,start)+inline('AB_CHECK_PROMPT(',native)+storeSource.source.slice(end);
}
const nativePrice='prt(format("Price: %ld", (long)price), 1, 0)';
replace('ui-store.c',nativePrice,inline('AB_CHECK_PRICE(price, ',nativePrice),2);
const fnStart=storeSource.source.indexOf('static bool store_get_check('),fnEnd=storeSource.source.indexOf('\n/*',fnStart);
let checkFn=storeSource.source.slice(fnStart,fnEnd);
checkFn=checkFn.replace('\t/* Prompt for it */',block('\tab_ui_check_begin(prompt,true);')+'\t/* Prompt for it */');
checkFn=checkFn.replace('\tch = inkey();',block('\tab_ui_scope_commit();')+'\tch = inkey();');
checkFn=checkFn.replace('\tprt("", 0, 0);','\tprt("", 0, 0);'+block('\tab_ui_check_end();'));
storeSource.source=storeSource.source.slice(0,fnStart)+checkFn+storeSource.source.slice(fnEnd);
connections.push({file:'logic/ui-store.c',id:'interface.check.store.sell/give',kind:'selected_native_sale_branch_and_frozen_object'});
connections.push({file:'logic/ui-store.c',id:'interface.check.store.buy/buy_cannot_use',kind:'existing_book_usability_boolean_and_frozen_object'});

for(const[file,value]of pending){
 if(!value.source.includes('#include "web-ui-text.h"'))value.source=value.source.replace('#include "angband.h"',B+'#include "web-ui-text.h"\n'+E+'#include "angband.h"');
 assert.equal(read(file),value.original,'concurrent source change: '+file);write(file,value.source);
}
function endCall(source,start){let depth=0,quoted=null;for(let i=start;i<source.length;i++){const c=source[i];if(quoted){if(c==='\\'){i++;continue;}if(c===quoted)quoted=null;continue;}if(c==='"'||c==="'"){quoted=c;continue;}if(c==='(')depth++;else if(c===')'&&!--depth)return i+1;}throw Error('unclosed call');}
function calls(source,file){const result=[];let quote=null,comment=null;for(let i=0;i<source.length;i++){const c=source[i],n=source[i+1];if(comment){if(comment==='line'&&c==='\n')comment=null;else if(comment==='block'&&c==='*'&&n==='/'){comment=null;i++;}continue;}if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}if(c==='/'&&(n==='/'||n==='*')){comment=n==='/'?'line':'block';i++;continue;}if(c==='"'||c==="'"){quote=c;continue;}if(source.startsWith('get_check',i)&&!/[a-zA-Z0-9_]/.test(source[i-1]??'')){const m=source.slice(i).match(/^get_check\s*\(/);if(!m)continue;const open=i+m[0].length-1,end=endCall(source,open);if(/^\s*\{/.test(source.slice(end)))continue;result.push({file,line:source.slice(0,i).split('\n').length,argument:source.slice(open+1,end-1),status:file==='logic/main-sdl.c'?'native_sdl_excluded':file==='logic/cmd-cave.c'&&source.slice(open+1,end-1).startsWith('feat->')?'shared_domain_source_binding':'source_connected'});i=end-1;}}return result;}
const baselineDir=path.join(root,'tests/first-naming-build-snapshot/source/logic');
const inventory=fs.readdirSync(baselineDir).filter(f=>f.endsWith('.c')).flatMap(f=>calls(fs.readFileSync(path.join(baselineDir,f),'utf8'),'logic/'+f));
manifest.check_phase={catalog_entries:phase.length,command_verbs:commands.length,source_call_sites:inventory.length,source_connected:true,browser_verified:false};
for(const[p,v]of[['migration/interface-data/source-manifest.json',manifest],['migration/interface-data/en.json',en],['migration/interface-data/ja.json',ja]])write(p,JSON.stringify(v,null,2)+'\n');
write('migration/check-data/source-manifest.json',JSON.stringify({schema_version:1,upstream_commit:manifest.upstream_commit,status:'source_connected_unbuilt',complete_game_translation:false,entries:phase,commands,connections,inventory,source_files:[...pending.keys()],remaining:['native SDL-only save failure prompt is excluded from the browser build','get_char and quantity-entry dialogs use separate original policies and are not covered by get_check','source-bound shop owner greetings and hints remain outside this phase'],max_reference_bytes:16384,identity:'original prompt address, consumed once; source parameters copied before callbacks'},null,2)+'\n');
console.log(JSON.stringify({catalog_entries:manifest.entries.length,new_entries:phase.length,command_verbs:commands.length,get_check_call_sites:inventory.length,core_source_files:pending.size,source_connected:true,browser_verified:false}));
