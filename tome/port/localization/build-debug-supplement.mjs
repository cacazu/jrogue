// GPL-3.0-or-later. Bounded authored Japanese supplement; no upstream edits.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {lexLua} from './lua-lexer.mjs';
import {directLiteralHooks} from './direct-literal-hooks.mjs';
const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const sourceRoot=option('--source-root');if(!sourceRoot)throw new Error('--source-root required');
const file='game/modules/tome/mod/dialogs/debug/DebugMain.lua';
const prefix='game.modules.tome.mod.dialogs.debug.debugmain';
// IDs use the real owning method and the command/message role.
const rows=[
 ['init.title',29,"Debug/Cheat! It's BADDDD!",'デバッグ／チート！ 悪用厳禁！','_t','init','debug dialog title'],
 ['use.change_level.zone_title',106,'Zone: %s','ゾーン：%s','tformat','use','zone selection dialog title; external zone parameter unchanged'],
 ['use.change_level.level_range',106,'Level 1-%s','階層 1～%s','tformat','use','level selection range; existing parameter unchanged'],
 ['use.remove_all.popup_title',128,'Kill or Remove','倒す／削除する','_t','use','remove-all confirmation title'],
 ['use.remove_all.confirmation',128,'Remove all (non-party) creatures or kill them for the player (awards experience and drops loot)?','仲間以外のすべての生物を削除しますか？ それともプレイヤーが倒した扱いにしますか？（経験値を獲得し、戦利品が落ちます）','_t','use','remove-all confirmation; neither action is executed by translation'],
 ['use.remove_all.removed_status',146,'Removed','削除した','_t','use','removed status fragment interpolated into original debug log'],
 ['use.remove_all.killed_status',146,'Killed','倒した','_t','use','killed status fragment interpolated into original debug log'],
 ['use.remove_all.remove_button',148,'Remove','削除','_t','use','confirmation affirmative action'],
 ['use.remove_all.kill_button',148,'Kill','倒す','_t','use','confirmation alternate action'],
 ['generate_list.command.change_zone',170,'Change Zone','ゾーンを変更','_t','generateList','ChangeZone dialog command'],
 ['generate_list.command.change_level',171,'Change Level','階層を変更','_t','generateList','change_level command'],
 ['generate_list.command.reveal_map',172,'Reveal all map','マップ全体を表示','_t','generateList','magic_map command'],
 ['generate_list.command.demigodmode',173,'Toggle Demi-Godmode','半神モードを切り替え','_t','generateList','demigodmode command'],
 ['generate_list.command.godmode',174,'Toggle Godmode','神モードを切り替え','_t','generateList','godmode command'],
 ['generate_list.command.alter_faction',175,'Alter Faction','所属勢力を変更','_t','generateList','AlterFaction dialog command'],
 ['generate_list.command.summon_creature',176,'Summon a Creature','生物を召喚','_t','generateList','SummonCreature dialog command'],
 ['generate_list.command.create_items',177,'Create Items','アイテムを作成','_t','generateList','CreateItem dialog command'],
 ['generate_list.command.create_trap',178,'Create a Trap','罠を作成','_t','generateList','CreateTrap dialog command'],
 ['generate_list.command.alter_quests',179,'Grant/Alter Quests','クエストを付与／変更','_t','generateList','GrantQuest dialog command'],
 ['generate_list.command.advance_player',180,'Advance Player','プレイヤーを成長させる','_t','generateList','AdvanceActor dialog command'],
 ['generate_list.command.remove_creatures',181,'Remove or Kill all creatures','すべての生物を削除／倒す','_t','generateList','remove-all command'],
 ['generate_list.command.fortress_energy',182,"Give Sher'tul fortress energy",'シェール・タル城塞にエネルギーを付与','_t','generateList','shertul-energy command; uses existing official Sher\'Tul Fortress terminology'],
 ['generate_list.command.ingredients',183,'Give all ingredients','すべての材料を付与','_t','generateList','all-ingredients command'],
 ['generate_list.command.weakdamage',184,'Weakdamage','微弱ダメージ','_t','generateList','weakdamage command'],
 ['generate_list.command.spawn_event',185,'Spawn Event','イベントを発生','_t','generateList','SpawnEvent dialog command'],
 ['generate_list.command.endgamify',186,'Endgamify','終盤状態にする','_t','generateList','Endgamify class command'],
 ['generate_list.command.reload_zone',187,'Reload/regenerate Zone and level','ゾーンと階層を再読込／再生成','_t','generateList','ReloadZone class command'],
 ['generate_list.command.clear_zones',188,'Automatically Clear Zones','ゾーンを自動攻略','_t','generateList','AdvanceZones class command'],
];
const original=fs.readFileSync(path.join(sourceRoot,file),'utf8'), {tokens,diagnostics}=lexLua(original),hooks=directLiteralHooks(tokens);
assert.equal(diagnostics.length,0);assert.equal(rows.length,28);
const en={},ja={},entries={};
for(const [role,line,english,japanese,tag,method,context]of rows){
 const token=tokens.find(token=>token.type==='string'&&token.line===line&&token.value===english&&hooks.get(token.start)?.tag===tag);
 assert.ok(token,`complete original runtime literal: ${line} ${english}`);
 assert.ok(japanese.length>0&&japanese!==english);
 const id=prefix+'.'+role;assert.equal(en[id],undefined);en[id]=english;ja[id]=japanese;
 assert.deepEqual(english.match(/%(?:[-+ #0]*\d*(?:\.\d+)?[cdiouxXeEfgGqs])/g)??[],japanese.match(/%(?:[-+ #0]*\d*(?:\.\d+)?[cdiouxXeEfgGqs])/g)??[]);
 entries[id]={english,japanese,tag,method,context,source_locations:[{file,line,column:token.column}],japanese_args_order:[],special_tokens:[],translation_origin:'authored_supplement',official_translation_available:false};
}
let officialRecords=0,existingMatches=0,peak=process.memoryUsage().rss;
for await(const line of readline.createInterface({input:fs.createReadStream(new URL('../inventory-work/inventory-output/upstream-ja-catalogue.jsonl',import.meta.url),'utf8'),crlfDelay:Infinity})){
 const row=JSON.parse(line);officialRecords++;if(rows.some(([, ,english])=>row.english===english&&row.translated))existingMatches++;
 peak=Math.max(peak,process.memoryUsage().rss);
}
assert.equal(existingMatches,0,'supplement does not override any nonempty official Japanese source translation');
const output=path.join(import.meta.dirname,'supplements/debug-main');fs.mkdirSync(output,{recursive:true});
const manifest={schema_version:1,source_version:'1.7.6',source_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63',source_sha256:crypto.createHash('sha256').update(original).digest('hex'),license:'GPL-3.0-or-later',scope:'original runtime debug/cheat dialog only; not normal campaign translation coverage',translation_origin:'authored_supplement_separate_from_official_catalogue',default_integration:'not_merged_into_official_ja; integrate only verified source/tag/callsite routes',entries,validation:{complete_original_literal_callsites_verified:rows.length,matching_en_ja_ids:rows.length,original_printf_specifier_arrays_equal:true,official_registrations_scanned:officialRecords,nonempty_official_source_matches:existingMatches,sampled_peak_rss_bytes:peak},limitations:['Debug log templates without _t/tformat hooks remain English; translated status fragments do not establish full debug-log coverage.','This supplement does not run or change any debug command.','No full campaign or browser execution has been verified.']};
for(const[name,body]of [['en.json',en],['ja.json',ja],['manifest.json',manifest]])fs.writeFileSync(path.join(output,name),JSON.stringify(body,null,2)+'\n');
console.log(JSON.stringify({entries:rows.length,official_records:officialRecords,existing_official_translations:existingMatches,sampled_peak_rss_bytes:peak,output}));
