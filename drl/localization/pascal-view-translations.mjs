/** Exact-source presentation proposals for the original DRL Pascal views (GPL-2.0).
 * Authoring sidecar only: no gameplay strings, persisted IDs or upstream files change.
 * Reviewed baseline: 0_10_11a, a6f965072b3a25b768c91dbced00367f1b57d865.
 */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {tokens as templateTokens,render} from './render.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const digest=b=>createHash('sha256').update(b).digest('hex');
const pas=s=>s.split(/([\x00-\x1f])/).filter(Boolean).map(p=>p.length===1&&p.charCodeAt(0)<32?`#${p.charCodeAt(0)}`:`'${p.replaceAll("'","''")}'`).join('')||"''";
const locked=[
 ['drlhudviews',16540,'77ac611f0ae43331b5840d33e044b0fb255950991aadeacfcc7dcd9dbff6b7b3'],
 ['drlio',49187,'a0bb570acb545fad8ff2e2acc178a7005de39cc0b7457a900ef5f4b8b18bdd00'],
 ['drlplayerview',39049,'e24c72e29c5ea701af06bfb2c96bf43f52b3b2b5457b0191535010de2d6789e6'],
 ['drlmoreview',14119,'e2b31d029fb121a3308a7f4cb72ad8ec5251cc79dabdaf3adc5b39d0b5b0556b'],
 ['drlingamemenuview',2709,'74d9bf6120dfc8dfb50144eadab9652effc33269397c9bbf7cc1d0948ced3e79'],
 ['drlrankupview',2180,'2c4d585b25fd795b5314b2fb2ac33c1fdd90186e9805dc5b3fc337e42969a564'],
 ['drlassemblyview',2827,'21fe0d0e8cab466bf472fbc24c455e81c491456a723c089934fd76258310ea32'],
 ['drlmessagesview',1663,'1107359167b941609ce5662360eff31fbb01e2f691b9555ecd0720d4b1d89064'],
 ['drlmodulechoiceview',1279,'873945ca45a21e540d91d58a4dbe6210a6ec7619e163933f4bd3830f6f25214b'],
 ['drlchoiceview',3668,'bdce344faabcf256971c58f51fb6a27916a76953a8c64d960b826ce126e4568f'],
 ['drlconfirmview',2235,'0692e468be421225d50695423e8144887c6d8e48b56744b0b2ac9006950d77ee'],
 ['drlloadingview',2628,'ca6b191e982d2aa5ffc1f59ae5782105ba7c23eaa344bbcb431fdef16f125783'],
 ['dfhof',39412,'3808caeaaa8d530cd4ec8b66d2b56a2b588836a7326b00da7e1537c2794a667d'],
];
export const pascalViewSourceLocks=Object.freeze(Object.fromEntries(locked.map(([base,bytes,sha256])=>[`src/${base}.pas`,{bytes,sha256}])));
const literals=[];
function labels(base,rows){for(const[line,english,suffix,japanese,role='presentation-label']of rows)literals.push({file:`src/${base}.pas`,line,english,id:`view.${suffix}`,japanese,literalRole:role});}
labels('drlingamemenuview',[
 [43,'Continue','menu.continue','続ける'],
 [47,'Help','menu.help','ヘルプ'],
 [52,'Settings','menu.settings','設定'],
 [57,'Message history','menu.messages','メッセージ履歴'],
 [62,'Assemblies','menu.assemblies','組み立て品'],
 [67,'Abandon Run','menu.abandon','冒険を放棄する'],
 [72,'Save & Quit','menu.save-quit','保存して終了'],
 [96,'Continue run','menu.continue-run','冒険を続ける'],
 [97,'Abandon run','menu.abandon-run','冒険を放棄する'],
 [99,'{yAre you sure you want to abandon this run?}','menu.abandon-confirm','{y本当にこの冒険を放棄しますか？}'],
]);
labels('drlplayerview',[
 [151,'use','inventory.action-use','使う'],
 [151,'Choose item to use','inventory.choose-use','使うアイテムを選択'],
 [152,'drop','inventory.action-drop','置く'],
 [152,'Choose item to drop','inventory.choose-drop','置くアイテムを選択'],
 [154,'unload/scavenge','inventory.action-unload-scavenge','弾を抜く／分解する'],
 [154,'Choose item to unload/scavenge','inventory.choose-unload-scavenge','弾を抜く／分解するアイテムを選択'],
 [155,'unload','inventory.action-unload','弾を抜く'],
 [155,'Choose item to unload','inventory.choose-unload','弾を抜くアイテムを選択'],
 [182,'wear/use','inventory.action-wear-use','装備する／使う'],
 [183,'Inventory','inventory.title','所持品'],
 [346,'No matching items, press <{!{$input_ok}}>.','inventory.no-matching-items','該当するアイテムがありません。<{!{$input_ok}}>を押してください。'],
 [347,'{!No items in inventory!}','inventory.empty','{!所持品がありません！}'],
 [367,'  <{!RTrigger+A}> more','item.more-controller','  <{!RTrigger+A}> 詳細'],
 [368,'  <{!m}>ore','item.more-keyboard','  <{!m}> 詳細'],
 [374,'<{!{$input_uidrop}}> drop','inventory.drop-hint','<{!{$input_uidrop}}> 置く'],
 [375,'<{!{$input_uialtdrop}}>    unload and drop','inventory.unload-drop-hint','<{!{$input_uialtdrop}}>    弾を抜いて置く'],
 [377,'<{!LTrigger+DPad}> mark quickslot','item.quickslot-controller','<{!LTrigger+DPad}> クイックキーを割り当て'],
 [378,'<{!1-9}> mark quickslot','item.quickslot-keyboard','<{!1-9}> クイックキーを割り当て'],
 [384,'{l<{!{$input_up},{$input_down}}> select, <{!{$input_escape}}> exit}','hint.select-exit','{l<{!{$input_up},{$input_down}}> 選択、<{!{$input_escape}}> 終了}'],
 [385,'{l<{!{$input_left},{$input_right}}> panels, <{!{$input_up},{$input_down}}> select, <{!{$input_escape}}> exit}','hint.panels-select-exit','{l<{!{$input_left},{$input_right}}> 画面切替、<{!{$input_up},{$input_down}}> 選択、<{!{$input_escape}}> 終了}'],
 [499,'Equipment','equipment.title','装備'],
 [520,'  <{!RTrigger+A}> more','item.more-controller','  <{!RTrigger+A}> 詳細'],
 [521,'  <{!m}>ore','item.more-keyboard','  <{!m}> 詳細'],
 [538,'Basic traits','traits.basic','基本特性'],
 [539,'Advanced traits','traits.advanced','上級特性'],
 [540,'Resistances','equipment.resistances','耐性'],
 [568,' Torso','equipment.torso',' 胴'],
 [569,' Feet','equipment.feet',' 足'],
 [573,'<{!{$input_ok}}> take off/wear','equipment.wear-remove-hint','<{!{$input_ok}}> 外す／装備する'],
 [576,'<{!LTrigger+DPad}> mark quickslot','item.quickslot-controller','<{!LTrigger+DPad}> クイックキーを割り当て'],
 [577,'<{!{$input_uiswap}}> swap item, <{!{$input_uidrop}}> drop item','equipment.swap-drop-hint','<{!{$input_uiswap}}> アイテムを交換、<{!{$input_uidrop}}> アイテムを置く'],
 [581,'<{!{$input_uiswap}}> swap item, <{!1-9}> mark quickslot','equipment.swap-quickslot-hint','<{!{$input_uiswap}}> アイテムを交換、<{!1-9}> クイックキーを割り当て'],
 [582,'<{!{$input_uidrop}}> drop item','equipment.drop-hint','<{!{$input_uidrop}}> アイテムを置く'],
 [584,'{l<{!{$input_left},{$input_right}}> panels, <{!{$input_up},{$input_down}}> select, <{!{$input_escape}}> exit}','hint.panels-select-exit','{l<{!{$input_left},{$input_right}}> 画面切替、<{!{$input_up},{$input_down}}> 選択、<{!{$input_escape}}> 終了}'],
 [682,'{l<{!{$input_left},{$input_right}}> panels, <{!{$input_up},{$input_down}}> scroll, <{!{$input_escape}}> exit}','hint.panels-scroll-exit','{l<{!{$input_left},{$input_right}}> 画面切替、<{!{$input_up},{$input_down}}> スクロール、<{!{$input_escape}}> 終了}'],
 [692,'Select trait to upgrade','traits.choose-upgrade','強化する特性を選択'],
 [693,'Traits','traits.title','特性'],
 [718,'Requires : {0}','traits.requires','必要条件 : {0}'],
 [720,'Blocks   : {0}','traits.blocks','取得不可 : {0}'],
 [727,'{rYou can pick only one {RMaster} trait.}','traits.one-master-warning','{r取得できる{Rマスター}特性は1つだけです。}'],
 [730,'You can pick only one {!Master} trait.','traits.one-master','取得できる{!マスター}特性は1つだけです。'],
 [736,'{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_ok}}> select}','hint.scroll-select','{l<{!{$input_up},{$input_down}}> スクロール、<{!{$input_ok}}> 選択}'],
 [737,'{l<{!{$input_left},{$input_right}}> panels, <{!{$input_up},{$input_down}}> scroll, <{!{$input_escape}}> exit}','hint.panels-scroll-exit','{l<{!{$input_left},{$input_right}}> 画面切替、<{!{$input_up},{$input_down}}> スクロール、<{!{$input_escape}}> 終了}'],
 [891,'Level }({!','traits.level-requirement-label','レベル }({!'],
 [974,'{!Current speeds}','character.speeds','{!現在の速度}'],
 [975,'{!Accuracy}','character.accuracy-heading','{!命中率}'],
 [976,'{!Bonuses}','character.bonuses','{!補正}'],
 [978,'Movement','character.movement','移動'],
 [979,'Ranged','character.ranged','射撃'],
 [980,'Dodge','character.dodge','回避'],
 [982,'Attack','character.attack','攻撃'],
 [982,'Fire','character.fire','射撃'],
 [982,'dualshot','character.dualshot','二丁射撃'],
 [982,'shot','character.shot','射撃'],
 [983,'Melee','character.melee','近接'],
 [984,'Knockback','character.knockback','ノックバック'],
 [986,'Reload','character.reload','リロード'],
 [997,'{!Status effects}','effects.status-heading','{!状態変化}'],
 [1017,'{!Permanents}','effects.permanent-heading','{!恒久効果}'],
 [1140,'Select item to wear/wield','inventory.choose-wear-wield','装備するアイテムを選択'],
 [1141,'wear/wield','inventory.action-wear-wield','装備する'],
 [1152,'An ammopack might serve better in the Prepared slot. Continuing will unload the ammo destroying the pack. Are you sure?','inventory.ammopack-unload-confirm','弾薬パックは予備武器スロットに入れたほうが役立つかもしれません。続けると弾を抜き、パックを破壊します。本当によろしいですか？'],
 [1168,'Drop item','inventory.confirm-drop','アイテムを置く'],
 [1169,'Cancel','confirm.cancel','キャンセル'],
]);
labels('drlhudviews',[
 [124,' = LOOK MODE =','hud.look-mode',' = 観察モード ='],
 [236,'Run mode','hud.run-mode','連続移動'],
 [247,'Melee attack','hud.melee-attack','近接攻撃'],
 [272,'[more] press <{L{$input_ok}}>...','hud.more','[続き] <{L{$input_ok}}>を押してください…'],
 [273,'Press <{L{$input_ok}}>...','hud.press-confirm','<{L{$input_ok}}>を押してください…'],
 [561,'Scroll, <{!LMB}> wield, <{!RMB}> cancel:','hud.scroll-wield-hint','スクロールで選択、<{!LMB}> 装備、<{!RMB}> キャンセル：'],
]);
labels('drlio',[
 [676,'Enter','input-key.enter','Enter','physical-input-name'],
 [677,'Escape','input-key.escape','Escape','physical-input-name'],
 [678,'Backspace','input-key.backspace','Backspace','physical-input-name'],
 [679,'SHIFT+Backspace','input-key.shift-backspace','SHIFT+Backspace','physical-input-name'],
 [680,'Tab','input-key.tab','Tab','physical-input-name'],
 [681,'Left','input-key.left','左','physical-input-name'],
 [682,'Right','input-key.right','右','physical-input-name'],
 [683,'Up','input-key.up','上','physical-input-name'],
 [684,'Down','input-key.down','下','physical-input-name'],
 [685,'PgUp','input-key.page-up','PgUp','physical-input-name'],
 [686,'PgDn','input-key.page-down','PgDn','physical-input-name'],
 [692,'Escape','input-key.escape','Escape','physical-input-name'],
 [696,'A','input-button.a','A','physical-input-name'],
 [697,'B','input-button.b','B','physical-input-name'],
 [698,'Y','input-button.y','Y','physical-input-name'],
 [699,'RTrigger+Y','input-button.right-trigger-y','RTrigger+Y','physical-input-name'],
 [700,'X','input-button.x','X','physical-input-name'],
 [701,'Left','input-key.left','左','physical-input-name'],
 [702,'Right','input-key.right','右','physical-input-name'],
 [703,'Up','input-key.up','上','physical-input-name'],
 [704,'Down','input-key.down','下','physical-input-name'],
 [711,'PgUp','input-key.page-up','PgUp','physical-input-name'],
 [712,'PgDn','input-key.page-down','PgDn','physical-input-name'],
 [865,'MAX','hud.experience-max','最大'],
 [903,'A:','hud.armor-label','鎧:'],
 [907,'Health:      Exp:   /      W:','hud.percent-health-labels','体力:        経験   /      武:'],
 [914,'Health:        Exp:        W:','hud.health-labels','体力:          経験        武:'],
 [922,'none','hud.none','なし'],
 [939,'none','hud.none','なし'],
 [1180,' | <{LA}> more','look.more-controller',' | <{LA}> 詳細'],
 [1181,' | <{Lm}>ore','look.more-keyboard',' | <{Lm}> 詳細'],
 [1216,'{yError written to error.log, please report!}','error.log-report','{yエラーをerror.logに記録しました。報告をお願いします！}'],
 [1345,'ERROR','choice.missing-name','エラー'],
]);
labels('drlmoreview',[
 [116,', torso ','being.torso-resistance-label',', 胴 '],
 [131,'{!Status effects}','effects.status-heading','{!状態変化}'],
 [151,'{!Permanents}','effects.permanent-heading','{!恒久効果}'],
 [187,'{l<{!{$input_escape}},{!{$input_ok}}> exit}','hint.confirm-escape-exit','{l<{!{$input_escape}},{!{$input_ok}}> 終了}'],
 [199,'{!Resistances}','being.resistances','{!耐性}'],
 [211,'{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_ok},{$input_escape}}> return}','hint.scroll-return','{l<{!{$input_up},{$input_down}}> スクロール、<{!{$input_ok},{$input_escape}}> 戻る}'],
 [289,'Weapon group','item-stat.weapon-group','武器分類'],
 [292,'Ammo type','item-stat.ammo-type','弾薬種別'],
 [297,'Durability','item-stat.durability','耐久力'],
 [298,'Swap time','item-stat.swap-time','交換時間'],
 [302,'Damage type','item-stat.damage-type','ダメージ属性'],
 [303,'Expl.radius','item-stat.explosion-radius','爆発範囲'],
 [307,'Fire time','item-stat.fire-time','射撃時間'],
 [308,'Reload time','item-stat.reload-time','リロード時間'],
 [309,'Swap time','item-stat.swap-time','交換時間'],
 [310,'Accuracy','item-stat.accuracy','命中補正'],
 [311,'Damage type','item-stat.damage-type','ダメージ属性'],
 [312,'Shots','item-stat.shots','発射数'],
 [313,'Shot cost','item-stat.shot-cost','消費弾数'],
 [314,'Expl.radius','item-stat.explosion-radius','爆発範囲'],
 [315,'Dmg. falloff','item-stat.damage-falloff','威力減衰'],
 [316,'Cone size','item-stat.cone-size','射撃の拡散幅'],
 [317,'Max range','item-stat.max-range','最大射程'],
 [317,'N/A','item-stat.not-applicable','該当なし'],
 [319,'Alt. fire','item-stat.alt-fire','特殊射撃'],
 [321,'Alt. reload','item-stat.alt-reload','特殊リロード'],
 [325,'Attack time','item-stat.attack-time','攻撃時間'],
 [326,'Swap time','item-stat.swap-time','交換時間'],
 [327,'Accuracy','item-stat.accuracy','命中補正'],
 [328,'Damage type','item-stat.damage-type','ダメージ属性'],
 [330,'Alt. fire','item-stat.alt-fire','特殊射撃'],
 [335,'Move speed','item-stat.move-speed','移動速度'],
 [336,'Knockback','item-stat.knockback','ノックバック'],
 [337,'Dodge rate','item-stat.dodge-rate','回避率'],
 [343,'Bullet res.','item-stat.bullet-resistance','弾丸耐性'],
 [345,'Melee res.','item-stat.melee-resistance','近接耐性'],
 [347,'Shrapnel res','item-stat.shrapnel-resistance','散弾耐性'],
 [349,'Acid res.','item-stat.acid-resistance','酸耐性'],
 [351,'Fire res.','item-stat.fire-resistance','炎耐性'],
 [353,'Plasma res.','item-stat.plasma-resistance','プラズマ耐性'],
 [355,'Cold res.','item-stat.cold-resistance','冷気耐性'],
 [357,'Poison res.','item-stat.poison-resistance','毒耐性'],
 [359,'Pierce res.','item-stat.pierce-resistance','貫通耐性'],
 [420,'{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_ok},{$input_escape}}> return}','hint.scroll-return','{l<{!{$input_up},{$input_down}}> スクロール、<{!{$input_ok},{$input_escape}}> 戻る}'],
]);
labels('drlrankupview',[
 [45,'This unlocks the following features:','rank-up.unlocks-heading','次の機能が解禁されます：'],
 [63,'Congratulations!','rank-up.title','おめでとうございます！'],
 [68,'Press <{!{$input_ok}}>...','rank-up.press-confirm','<{!{$input_ok}}>を押してください…'],
 [70,'{l<{!{$input_ok},{$input_escape}}> continue}','hint.confirm-escape-continue','{l<{!{$input_ok},{$input_escape}}> 続ける}'],
]);
labels('drlassemblyview',[
 [37,'Known assemblies','assemblies.title','判明済みの組み立て品'],
 [41,'{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_ok},{$input_escape}}> return}','hint.scroll-return','{l<{!{$input_up},{$input_down}}> スクロール、<{!{$input_ok},{$input_escape}}> 戻る}'],
]);
labels('drlmessagesview',[
 [38,'Past messages','messages.title','過去のメッセージ'],
 [47,'{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_ok},{$input_escape}}> continue}','hint.scroll-continue','{l<{!{$input_up},{$input_down}}> スクロール、<{!{$input_ok},{$input_escape}}> 続ける}'],
 [48,'{l<{!{$input_up},{$input_down},{$input_pgup},{$input_pgdn}}> scroll, <{!{$input_ok},{$input_escape}}> continue}','hint.scroll-page-continue','{l<{!{$input_up},{$input_down},{$input_pgup},{$input_pgdn}}> スクロール、<{!{$input_ok},{$input_escape}}> 続ける}'],
]);
labels('drlmodulechoiceview',[
 [34,'DRL module choice','module-choice.title','DRL モジュール選択'],
 [35,'Select core module to run','module-choice.prompt','実行するコアモジュールを選択'],
 [41,'You can set your default core module in Settings!','module-choice.default-hint','設定画面で既定のコアモジュールを指定できます！'],
]);
labels('drlconfirmview',[[51,'Cancel','confirm.cancel','キャンセル'],[52,'Confirm','confirm.confirm','決定']]);
labels('drlloadingview',[[76,'L O A D I N G . . .','loading.label','読み込み中…']]);
labels('dfhof',[
 [101,'none','report.none','なし'],[103,'none','report.none','なし'],[113,'Error!','report.invalid-result','エラー！'],[122,'none','report.none','なし'],[133,'none','report.none','なし'],
 [149,'{lnone}','report.none-dim','{lなし}'],[153,'{lnone}','report.none-dim','{lなし}'],[263,'{lnone}','report.none-dim','{lなし}'],
 [165,'{dPart 0}','report.partial-zero','{d部分 0}'],[168,'{dStnd 0}','report.standard-zero','{d通常 0}'],[171,'{dFull 0}','report.full-zero','{d完全 0}'],
 [299,'Player Info','report.player-info-title','プレイヤー情報'],
 [346,'Difficulty level achievements','report.difficulty-achievements','難易度別の実績'],
 [357,'Kills','report.kills-title','撃破数'],[357,'Monster name','report.monster-name-column','敵の名前'],[357,'TOTAL','report.total-column','合計'],
 [358,'Easy','report.easy-column','初級'],[358,'Med','report.medium-short-column','中級'],[358,'Hard','report.hard-column','上級'],[358,'VHard','report.very-hard-short-column','超上級'],[358,'NMare','report.nightmare-short-column','悪夢'],
 [359,'Melee','report.melee-column','近接'],[359,'Pist','report.pistol-column','拳銃'],[359,'Shotg','report.shotgun-column','散弾'],[359,'Chain','report.chaingun-column','連射'],
 [381,'Victories','report.victories-title','勝利数'],[381,'Difficulty','report.difficulty-column','難易度'],
 [382,'Medium','report.medium-column','中級'],[382,'Hard','report.hard-column','上級'],[382,'Very Hard','report.very-hard-column','超上級'],[382,'Nightmare','report.nightmare-column','悪夢'],
 [390,'Standard Game','report.standard-game','通常ゲーム'],
 [447,'Medals','report.medals-title','勲章'],[506,'Items','report.items-title','アイテム'],
 [519,' {!Basic assemblies}','report.basic-assemblies',' {!基本組み立て品}'],[520,' {!Advanced assemblies}','report.advanced-assemblies',' {!上級組み立て品}'],[521,' {!Master assemblies}','report.master-assemblies',' {!マスター組み立て品}'],
 [555,'Assemblies','report.assemblies-title','組み立て品'],[598,'Custom Awards','report.custom-awards-title','独自の賞'],[716,'Hall of fame','report.hall-of-fame-title','殿堂'],
]);
const expressions=[];
function sourceExpression(file,line,original,id,english,japanese,bindings=[],extra={}){
 expressions.push({file:`src/${file}.pas`,line,original,id:`view.${id}`,english,japanese,bindings,...extra});
}
const binding=(name,kind,originalExpression,presentationExpression)=>({name,kind,originalExpression,...(presentationExpression?{presentationExpression}:{} )});
sourceExpression('drlhudviews',188,"FPrompt + ', choose direction...'",'hud.choose-direction','{{action}}, choose direction...','{{action}}：方向を選んでください…',[binding('action','string','FPrompt')]);
sourceExpression('drlmoreview',182,"'Picture'#10'N/A'",'being.picture-unavailable','Picture\nN/A','画像\nなし');
sourceExpression('drlio',1213,"'{RError:} '+aText",'error.message','{RError:} {{detail}}','{Rエラー：} {{detail}}',[binding('detail','string','aText')]);
sourceExpression('drlplayerview',944,"'Character ( '+FCTitle+' )'",'character.title','Character ( {{mode}} )','キャラクター（{{mode}}）',[binding('mode','string','FCTitle')]);
sourceExpression('drlplayerview',956,"'{!' + Name + '} - level {!' + IntToStr(ExpLevel) + '} ' + AnsiString(LuaSystem.Get(['klasses',Klass,'name']))",'character.identity','{!{{name}}} - level {!{{level}}} {{class}}','{!{{name}}} — レベル{!{{level}}} {{class}}',[
 binding('name','string','Name'),binding('level','integer','ExpLevel'),binding('class','string',"AnsiString(LuaSystem.Get(['klasses',Klass,'name']))","DRLRegistryText('klass', AnsiString(LuaSystem.Get(['klasses',Klass,'id'])), 'base_game', 'name', AnsiString(LuaSystem.Get(['klasses',Klass,'name'])))"),
],{identityParameters:['name'],englishReconstruction:{kind:'concatenation',parts:['{!',{parameter:'name'},'} - level {!',{parameter:'level'},'} ',{parameter:'class'}]}});
sourceExpression('drlplayerview',1153,"'Do you want to disassemble the '+FItem.Name+'?'",'inventory.disassemble-confirm','Do you want to disassemble the {{item}}?','{{item}}を分解しますか？',[binding('item','string','FItem.Name',"DRLRegistryText('item', FItem.ID, 'base_game', 'name', FItem.Name)")]);
sourceExpression('drlplayerview',1170,"'No room in inventory to take off '+FItem.Name+', should it be dropped?'",'inventory.no-room-confirm','No room in inventory to take off {{item}}, should it be dropped?','{{item}}を外して所持品に入れる空きがありません。床に置きますか？',[binding('item','string','FItem.Name',"DRLRegistryText('item', FItem.ID, 'base_game', 'name', FItem.Name)")]);
sourceExpression('drlmoreview',380,"'Alt. fire    : {!' + Desc + '}'",'item.alt-fire-description','Alt. fire    : {!{{description}}}','特殊射撃    : {!{{description}}}',[binding('description','string','Desc')]);
sourceExpression('drlmoreview',392,"'Alt. reload  : {!' + Desc + '}'",'item.alt-reload-description','Alt. reload  : {!{{description}}}','特殊リロード : {!{{description}}}',[binding('description','string','Desc')]);
sourceExpression('dfhof',104,"'reached level '+ExtractDelimited(2, iMax, [':'])",'report.result-reached-level','reached level {{level}}','第{{level}}階に到達',[binding('level','string',"ExtractDelimited(2, iMax, [':'])")]);
sourceExpression('dfhof',154,"'{Rlevel '+ExtractDelimited(2, iMax, [':'])+'}'",'report.result-reached-level-red','{Rlevel {{level}}}','{R第{{level}}階}',[binding('level','string',"ExtractDelimited(2, iMax, [':'])")]);
sourceExpression('dfhof',164,"'{lPart }{L'+IntToStr(iSacrifice)+'}'",'report.partial-count','{lPart }{L{{count}}}','{l部分 }{L{{count}}}',[binding('count','integer','iSacrifice')]);
sourceExpression('dfhof',167,"'{lStnd }{L'+IntToStr(iWin)+'}'",'report.standard-count','{lStnd }{L{{count}}}','{l通常 }{L{{count}}}',[binding('count','integer','iWin')]);
sourceExpression('dfhof',170,"'{lFull }{L'+IntToStr(iFinal)+'}'",'report.full-count','{lFull }{L{{count}}}','{l完全 }{L{{count}}}',[binding('count','integer','iFinal')]);
sourceExpression('dfhof',172,"'{yTotl }{L'+IntToStr(iSacrifice+iWin+iFinal)+'}'",'report.total-count','{yTotl }{L{{count}}}','{y合計 }{L{{count}}}',[binding('count','integer','iSacrifice+iWin+iFinal')]);
sourceExpression('dfhof',329,"'Total game time: {!'+DurationString(GetCount('player/time'))+'}'",'report.total-game-time','Total game time: {!{{duration}}}','総プレイ時間：{!{{duration}}}',[binding('duration','string',"DurationString(GetCount('player/time'))")]);
sourceExpression('dfhof',616,"' {d'+LuaSystem.Get(['awards',cn,'name'])+' (none yet)}'",'report.custom-award-unearned',' {d{{award}} (none yet)}',' {d{{award}}（未獲得）}',[binding('award','string',"LuaSystem.Get(['awards',cn,'name'])")],{opaqueExternalParameters:['award']});
sourceExpression('dfhof',617,"' {dModule: {l'+LuaSystem.Get(['awards',cn,'mname'])+'}}'",'report.custom-award-module',' {dModule: {l{{module}}}}',' {dモジュール：{l{{module}}}}',[binding('module','string',"LuaSystem.Get(['awards',cn,'mname'])")],{opaqueExternalParameters:['module']});
sourceExpression('dfhof',619,"'   {dMaximum award level reached. Award received for: {l'+LuaSystem.Get(['awards',cn,'levels',iTotal,'name'] )+'}}'",'report.custom-award-max-level','   {dMaximum award level reached. Award received for: {l{{level}}}}','   {d賞の最高段階に到達しました。授与された段階：{l{{level}}}}',[binding('level','string',"LuaSystem.Get(['awards',cn,'levels',iTotal,'name'] )")],{opaqueExternalParameters:['level']});
sourceExpression('dfhof',620,"'   {dTo achieve {L'+LuaSystem.Get(['awards',cn,'levels',iTotal+1,'name'])+'} level you need to: {l'+LuaSystem.Get(['awards',cn,'levels',iTotal+1,'desc'] )+'}'",'report.custom-award-next-level','   {dTo achieve {L{{level}}} level you need to: {l{{requirement}}}','   {d{L{{level}}}の段階に到達する条件：{l{{requirement}}}',[binding('level','string',"LuaSystem.Get(['awards',cn,'levels',iTotal+1,'name'])"),binding('requirement','string',"LuaSystem.Get(['awards',cn,'levels',iTotal+1,'desc'] )")],{opaqueExternalParameters:['level','requirement']});
const registryRows=[
 {file:'src/drlio.pas',line:948,original:'VTIG_FreeLabel( DRL.Level.Name, Point( -2-Length( DRL.Level.Name), iBottom ), iColor );',replacement:"iDesc := DRLRegistryText('level', DRL.Level.ID, 'base_game', 'name', DRL.Level.Name);\n    VTIG_FreeLabel( iDesc, Point( -2-VTIG_Length( iDesc ), iBottom ), iColor );",registry:{category:'level',registryIdExpression:'DRL.Level.ID',scope:'base_game',field:'name',originalEnglishExpression:'DRL.Level.Name'},cachedPresentationExpression:'iDesc',layoutMeasurement:'VTIG_Length( iDesc )',note:'Reuse existing DrawHUD iDesc local; lookup once, draw and measure the same resolved string. Original Level.Name is unchanged.'},
 {file:'src/drlio.pas',line:976,original:'VTIG_FreeLabel( iBoss.Name, Point( 40 - Ceil(Length( iBoss.Name ) / 2), 3 ), iCBold );',replacement:"iDesc := DRLRegistryText('being', iBoss.ID, 'base_game', 'name', iBoss.Name);\n      VTIG_FreeLabel( iDesc, Point( 40 - Ceil(VTIG_Length( iDesc ) / 2), 3 ), iCBold );",registry:{category:'being',registryIdExpression:'iBoss.ID',scope:'base_game',field:'name',originalEnglishExpression:'iBoss.Name'},cachedPresentationExpression:'iDesc',layoutMeasurement:'VTIG_Length( iDesc )',note:'Reuse existing DrawHUD iDesc local; retain custom/runtime-name English fallback on tuple guard mismatch.'},
 {file:'src/drlplayerview.pas',line:1028,original:'DRL.Level.Name',replacement:"DRLRegistryText('level', DRL.Level.ID, 'base_game', 'name', DRL.Level.Name)",registry:{category:'level',registryIdExpression:'DRL.Level.ID',scope:'base_game',field:'name',originalEnglishExpression:'DRL.Level.Name'}},
 {file:'src/drlmoreview.pas',line:292,original:"LuaSystem.Get(['items', FItem.AmmoID, 'name'], '')",replacement:"DRLRegistryText('item', AnsiString(LuaSystem.Get(['items', FItem.AmmoID, 'id'])), 'base_game', 'name', AnsiString(LuaSystem.Get(['items', FItem.AmmoID, 'name'], '')))",registry:{category:'item',registryIdExpression:"AnsiString(LuaSystem.Get(['items', FItem.AmmoID, 'id']))",scope:'base_game',field:'name',originalEnglishExpression:"AnsiString(LuaSystem.Get(['items', FItem.AmmoID, 'name'], ''))"}},
 {file:'src/drlassemblyview.pas',line:78,original:"LuaSystem.Get(['mod_arrays',i,'name'])",replacement:"DRLRegistryText('mod_array', AnsiString(LuaSystem.Get(['mod_arrays',i,'id'])), 'base_game', 'name', AnsiString(LuaSystem.Get(['mod_arrays',i,'name'])))",registry:{category:'mod_array',registryIdExpression:"AnsiString(LuaSystem.Get(['mod_arrays',i,'id']))",scope:'base_game',field:'name',originalEnglishExpression:"AnsiString(LuaSystem.Get(['mod_arrays',i,'name']))"}},
 {file:'src/drlassemblyview.pas',line:82,original:"LuaSystem.Get(['mod_arrays',i,'name'])",replacement:"DRLRegistryText('mod_array', AnsiString(LuaSystem.Get(['mod_arrays',i,'id'])), 'base_game', 'name', AnsiString(LuaSystem.Get(['mod_arrays',i,'name'])))",registry:{category:'mod_array',registryIdExpression:"AnsiString(LuaSystem.Get(['mod_arrays',i,'id']))",scope:'base_game',field:'name',originalEnglishExpression:"AnsiString(LuaSystem.Get(['mod_arrays',i,'name']))"}},
 {file:'src/drlassemblyview.pas',line:83,original:"LuaSystem.Get(['mod_arrays',i,'request_desc'],'')",replacement:"DRLRegistryText('mod_array', AnsiString(LuaSystem.Get(['mod_arrays',i,'id'])), 'base_game', 'request_desc', AnsiString(LuaSystem.Get(['mod_arrays',i,'request_desc'],'')))",registry:{category:'mod_array',registryIdExpression:"AnsiString(LuaSystem.Get(['mod_arrays',i,'id']))",scope:'base_game',field:'request_desc',originalEnglishExpression:"AnsiString(LuaSystem.Get(['mod_arrays',i,'request_desc'],''))"}},
];
const multilineRows=[];
function multilineExpression(base,line,lastLine,prefix,suffix,english,japanese,bindings){multilineRows.push({file:`src/${base}.pas`,line,lastLine,prefix,suffix,id:`view.${suffix}`,english,japanese,bindings});}
multilineExpression('dfhof',322,325,"'Games won      : {!'",'report.games-won','Games won      : {!{{total}}  ({{partial}} partial, {{standard}} standard, {{full}} full)}}','勝利数         : {!{{total}}  （部分 {{partial}}、通常 {{standard}}、完全 {{full}}）}}',[
 binding('total','integer',"GetCount('player/games/win[@id=\"total\"]')"),binding('partial','integer',"GetCount('player/games/win[@id=\"sacrifice\"]')"),binding('standard','integer',"GetCount('player/games/win[@id=\"win\"]')"),binding('full','integer',"GetCount('player/games/win[@id=\"final\"]')"),
]);
multilineExpression('dfhof',326,328,"'All kills      : {!'",'report.all-kills','All kills      : {!{{total}}  ({{melee}} melee, {{pistol}} pistol)}','総撃破数       : {!{{total}}  （近接 {{melee}}、拳銃 {{pistol}}）}',[
 binding('total','integer',"GetCount('player/kills')"),binding('melee','integer',"GetCount('player/kills/killtype[@id=\"weapon-melee\"]')"),binding('pistol','integer',"GetCount('player/kills/killtype[@id=\"weapon-pistol\"]')"),
]);
multilineExpression('dfhof',350,352,"' '+Padded",'report.difficulty-achievement-row',' {{difficulty}}: {!{{score}}} Deaths: {!{{deaths}}} Kills: {!{{kills}}}',' {{difficulty}}：{!{{score}}} 死亡：{!{{deaths}}} 撃破：{!{{kills}}}',[
 binding('difficulty','string',"Padded(LuaSystem.Get([ 'diff', cn, 'name' ]),21)","VTIG_Padded(DRLRegistryText('difficulty', iDiffID, 'base_game', 'name', AnsiString(LuaSystem.Get([ 'diff', cn, 'name' ]))),21)"),
 binding('score','string','Padded(GetDiffScore(iDiffID),25)','VTIG_Padded(GetDiffScore(iDiffID),25)'),binding('deaths','string','Padded(GetDiffDeaths(iDiffID),4)','VTIG_Padded(GetDiffDeaths(iDiffID),4)'),binding('kills','string','Padded(GetDiffKills(iDiffID),6)','VTIG_Padded(GetDiffKills(iDiffID),6)'),
]);
multilineExpression('dfhof',447,447,"'Total medals received  : {!'",'report.medals-summary','Total medals received  : {!{{total}}}Total different medals  : {!{{different}}}/{!{{available}}}','獲得勲章の総数         : {!{{total}}}異なる勲章の種類数      : {!{{different}}}/{!{{available}}}',[
 binding('total','string','Padded(IntToStr(cn),7)'),binding('different','integer','cn2'),binding('available','integer',"LuaSystem.Get(['medals','__counter'])"),
]);
multilineExpression('dfhof',506,506,"'Total specials found  : {!'",'report.items-summary','Total specials found  : {!{{total}}}Total different specials  : {!{{different}}}/{!{{available}}}','発見した特殊装備の総数 : {!{{total}}}異なる特殊装備の種類数    : {!{{different}}}/{!{{available}}}',[
 binding('total','string','Padded(IntToStr(cn),7)'),binding('different','integer','cn2'),binding('available','integer','c'),
]);
multilineExpression('dfhof',555,555,"'Total assembled       : {!'",'report.assemblies-summary','Total assembled       : {!{{total}}}Total different assemblies: {!{{different}}}/{!{{available}}}','組み立てた総数         : {!{{total}}}異なる組み立て品の種類数  : {!{{different}}}/{!{{available}}}',[
 binding('total','string','Padded(IntToStr(cn),7)'),binding('different','integer','cn2'),binding('available','integer','c'),
]);
const pluralRows=[
 {line:110,condition:"iMax = 'sacrifice'",prefix:'half won',id:'view.report.half-won',japanese:'部分勝利'},
 {line:111,condition:"iMax = 'win'",prefix:'won',id:'view.report.won',japanese:'勝利'},
 {line:112,condition:"iMax = 'final'",prefix:'fully won',id:'view.report.fully-won',japanese:'完全勝利'},
];
const constants=[
 ...[['Basic','基本'],['Advanced','上級'],['Master','マスター']].map(([english,japanese],index)=>({file:'src/drlassemblyview.pas',line:61,variable:'TypeName',index,id:`view.assembly-tier.${['basic','advanced','master'][index]}`,english,japanese})),
 ...[[' Bronze ',' 銅 '],[' Silver ',' 銀 '],['  Gold  ','  金  '],['Platinum','プラチナ'],['Diamond ','ダイヤモンド '],['Angelic ','天使 ']].map(([english,japanese],index)=>({file:'src/dfhof.pas',line:241,variable:'BadgeLevelName',index:index+1,id:`view.badge-tier.${['bronze','silver','gold','platinum','diamond','angelic'][index]}`,english,japanese})),
];
export const pascalViewConstantResolvers=[
 {name:'DRLViewAssemblyTier',argumentRange:[0,2],sourceVariable:'TypeName',englishFallbackExpression:'TypeName[iType]',implementation:"function DRLViewAssemblyTier(aIndex: Integer; const aEnglish: AnsiString): AnsiString;\nconst IDs: array[0..2] of AnsiString = ('view.assembly-tier.basic','view.assembly-tier.advanced','view.assembly-tier.master');\nbegin\n  if (aIndex < Low(IDs)) or (aIndex > High(IDs)) then Exit(aEnglish);\n  Exit(DRLText(IDs[aIndex], aEnglish));\nend;",note:'Keep original TypeName constant English. Resolve only at display consumption.'},
 {name:'DRLViewBadgeTier',argumentRange:[1,6],sourceVariable:'BadgeLevelName',englishFallbackExpression:'BadgeLevelName[cn2]',implementation:"function DRLViewBadgeTier(aIndex: Integer; const aEnglish: AnsiString): AnsiString;\nconst IDs: array[1..6] of AnsiString = ('view.badge-tier.bronze','view.badge-tier.silver','view.badge-tier.gold','view.badge-tier.platinum','view.badge-tier.diamond','view.badge-tier.angelic');\nbegin\n  if (aIndex < Low(IDs)) or (aIndex > High(IDs)) then Exit(aEnglish);\n  Exit(DRLText(IDs[aIndex], aEnglish));\nend;",note:'Keep original tier constants and numeric award levels English/unchanged.'},
];
sourceExpression('drlassemblyview',68,"'{y'+TypeName[iType]+' assemblies}'",'assemblies.tier-heading','{y{{tier}} assemblies}','{y{{tier}}組み立て品}',[binding('tier','string','TypeName[iType]','DRLViewAssemblyTier(iType, TypeName[iType])')],{requiresHelper:'DRLViewAssemblyTier'});
sourceExpression('dfhof',589,"'Badges - '+BadgeLevelName[cn2]",'report.badge-tier-title','Badges - {{tier}}','バッジ — {{tier}}',[binding('tier','string','BadgeLevelName[cn2]','DRLViewBadgeTier(cn2, BadgeLevelName[cn2])')],{requiresHelper:'DRLViewBadgeTier'});
sourceExpression('dfhof',589,"Padded('Total '+Trim(BadgeLevelName[cn2])+' badges received',36)+' : {!'+IntToStr(iFound)+'}/{!'+IntToStr(iTotal)+'}'",'report.badge-tier-summary','{{label}} : {!{{found}}}/{!{{total}}}','{{label}} : {!{{found}}}/{!{{total}}}',[
 binding('label','string',"Padded('Total '+Trim(BadgeLevelName[cn2])+' badges received',36)","VTIG_Padded(DRLText('view.report.badge-tier-summary-label', 'Total {{tier}} badges received', [DRLStringParam('tier', Trim(DRLViewBadgeTier(cn2, BadgeLevelName[cn2])))]),36)"),binding('found','integer','iFound'),binding('total','integer','iTotal'),
],{requiresHelper:'DRLViewBadgeTier',additionalCatalogTerms:[{id:'view.report.badge-tier-summary-label',english:'Total {{tier}} badges received',japanese:'獲得した{{tier}}バッジの総数',parameters:{tier:'string'}}]});
const formatRows=[];
function formats(base,rows){for(const[line,printfFormat,suffix,japanese,names]of rows)formatRows.push({file:`src/${base}.pas`,line,printfFormat,id:`view.${suffix}`,japanese,names});}
formats('drlmoreview',[
 [100,'Health     : {!{R%d}/%d}','being.health','体力       : {!{R{{health}}}/{{maximum}}}',['health','maximum']],
 [101,'Armor      : {!%d}','being.armor','防御力     : {!{{armor}}}',['armor']],
 [102,'Speed      : {!%d%%}','being.speed','速度       : {!{{speed}}%}',['speed']],
 [103,'Accuracy   : {!%d}','being.accuracy','命中補正   : {!{{accuracy}}}',['accuracy']],
 [104,'Strength   : {!%d} (xd3 damage)','being.strength','筋力       : {!{{strength}}}（xd3ダメージ）',['strength']],
 [105,'Experience : {!%d}','being.experience','獲得経験値 : {!{{experience}}}',['experience']],
 [106,'Vision     : {!%d}','being.vision','視界       : {!{{vision}}}',['vision']],
]);
formats('drlplayerview',[
 [958,'  Experience   : {!%d} ({!%d} more needed for level {!%d})','character.experience','  経験値       : {!{{experience}}}（レベル{!{{next_level}}}まであと{!{{needed}}}）',['experience','needed','next_level']],
 [959,'  Experience   : {!%d} ({!max level reached!})','character.experience-max','  経験値       : {!{{experience}}}（{!最大レベルに到達！}）',['experience']],
 [960,'  Kills        : {!%d}/{!%d} ({!%d%%}), spree {!%d} (record {!%d})','character.kills','  撃破数       : {!{{kills}}}/{!{{maximum}}}（{!{{percentage}}%}）、連続撃破 {!{{spree}}}（最高 {!{{record}}}）',['kills','maximum','percentage','spree','record']],
 [964,'  Total kills  : {!%d}/{!%d}','character.total-kills','  総撃破数     : {!{{kills}}}/{!{{maximum}}}',['kills','maximum']],
 [965,'  Damage taken : {!%d} ({!%d} this floor)','character.damage-taken','  被ダメージ   : {!{{damage}}}（この階 {!{{floor_damage}}}）',['damage','floor_damage']],
 [966,'  Game time    : {!%d} turns, {!%d}s realtime','character.game-time','  経過時間     : {!{{turns}}}ターン、実時間 {!{{seconds}}}秒',['turns','seconds']],
 [1032,'  Turns taken  : {!%d}','level.turns-taken','  経過ターン   : {!{{turns}}}',['turns']],
 [1033,'  Turns taken  : {!%d}','level.turns-taken','  経過ターン   : {!{{turns}}}',['turns']],
 [1032,'Enemies left : {!%d}','level.enemies-left','残りの敵 : {!{{enemies}}}',['enemies']],
 [1033,'Enemies left : {!%d} (%d respawned)','level.enemies-respawned','残りの敵 : {!{{enemies}}}（うち復活 {{respawned}}）',['enemies','respawned']],
 [1035,'  Level feel   : {!%s}','level.feeling','  この階の気配 : {!{{feeling}}}',['feeling']],
]);
function templateFromPrintf(fmt,names){let index=0;const template=fmt.replace(/%%|%[ds]/g,s=>s==='%%'?'%':`{{${names[index++]}}}`);if(index!==names.length||/%(?:[a-z]|[0-9])/i.test(template))throw Error('Unsupported Pascal view printf contract');return template;}
function originalFormatCall(tokens,literal){
 const index=tokens.indexOf(literal),first=index-2;
 if(tokens[first]?.raw.toLowerCase()!=='format'||tokens[first+1]?.raw!=='(')throw Error('View format literal is not a direct Format call');
 let depth=0,last=first+1;
 for(;last<tokens.length;last++){if(tokens[last].raw==='(')depth++;if(tokens[last].raw===')'&&--depth===0)break;}
 if(tokens[index+1]?.raw!==','||tokens[index+2]?.raw!=='[')throw Error('View Format arguments are not an explicit array');
 const ranges=[];let begin=index+3,parens=0,brackets=0;
 for(let i=begin;i<last;i++){
  const raw=tokens[i].raw;
  if(raw==='(')parens++;if(raw===')')parens--;
  if(raw==='[')brackets++;if(raw===']'){
   if(brackets===0){if(i>begin)ranges.push([tokens[begin].start,tokens[i-1].end]);break;}brackets--;
  }
  if(raw===','&&parens===0&&brackets===0){ranges.push([tokens[begin].start,tokens[i-1].end]);begin=i+1;}
 }
 return{start:tokens[first].start,end:tokens[last].end,ranges};
}
/** Residual presentation groups are explicit; this sidecar does not claim full-game coverage. */
export const pendingPascalViewGroups=[
 {file:'src/drlplayerinfoview.pas',reason:'Requested filename is absent; player-info report is implemented in src/dfhof.pas.'},
 {file:'src/drlrankupview.pas',line:37,role:'dynamic rank award/unlock presentation',reason:'Original rank.award/name/unlocks strings require their structured registry producer seams; do not globally translate the result of Format.'},
 {file:'src/dfhof.pas',line:276,role:'dynamic rank requirement/unlock headers',reason:'Parent owns rank promotion/name integration and complete rank requirement/unlock headers; excluded to avoid conflicting source sites.'},
 {file:'src/drlplayerview.pas',line:1002,role:'perk name/short/description presentation',reason:'Resolve each field by original perk ID; preserve domain PerkData and short-code behavior.'},
 {file:'src/drlmoreview.pas',line:287,role:'weapon group presentation',reason:'Original core.weapon_group_name has a finite group-ID mapping; translate at the group-ID seam.'},
 {file:'src/drlmoreview.pas',line:302,role:'damage type presentation',reason:'DamageTypeName and ResNames producer helpers in src/dfdata.pas need typed enum lookup; do not change ResIDs or damage mechanics.'},
 {file:'src/drlmoreview.pas',line:319,role:'alternate fire/reload presentation',reason:'Original item hook-produced name/description strings need exact registry/hook producer guards.'},
 {file:'src/dfhof.pas',line:598,role:'custom module awards',reason:'External module award names/descriptions retain their source text until module-scoped catalogs exist.'},
 {file:'src/dfhof.pas',line:679,role:'historical score outcome text',reason:'Stored killed attribute may contain original English prose; migrate from structured result/depth IDs, preserve usernames and old saves.'},
 {file:'src/drlio.pas',line:1500,role:'native crash dialogs/terminal report',reason:'Full platform crash report and save-on-crash suffix remain pending; paths and diagnostic details must be verbatim parameters.'},
];
function sourceData(sourceRoot,sourceOverrides={}){
 const data={};for(const[file,lock]of Object.entries(pascalViewSourceLocks)){
  const bytes=Object.hasOwn(sourceOverrides,file)?Buffer.from(sourceOverrides[file],'utf8'):readFileSync(path.join(sourceRoot,file));
  if(bytes.length!==lock.bytes||digest(bytes)!==lock.sha256)throw Error(`Pascal view source provenance mismatch: ${file}`);
  const source=bytes.toString('utf8'),scanned=scanSource(source,'pascal');
  if(scanned.diagnostics.length)throw Error(`Pascal view lexical diagnostic: ${file}`);
  data[file]={source,tokens:scanned.tokens};
 }return data;
}
function matchesPatch(manifest,record){return(manifest.patches??[]).filter(p=>p.file===record.file&&p.start<record.end&&p.end>record.start);}
function exactSourceRecord(data,row){
 const source=data[row.file].source,lineStart=source.split('\n').slice(0,row.line-1).join('\n').length+(row.line>1?1:0),nextLine=source.indexOf('\n',lineStart),lineEnd=nextLine<0?source.length:nextLine;
 const line=source.slice(lineStart,lineEnd),within=line.indexOf(row.original);
 if(within<0||line.indexOf(row.original,within+1)>=0)throw Error(`Pascal exact-source guard is not unique at declared line: ${row.file}:${row.line}`);
 const start=lineStart+within;return{...row,start,end:start+row.original.length};
}
const normalized=s=>scanSource(s,'pascal').tokens.map(t=>t.raw).join('');
/** Reconstruct source concatenation symbolically; never evaluate Pascal or Lua. */
function reconstructConcatenation(record){
 const ts=scanSource(record.original,'pascal').tokens,parts=[];let start=0,depth=0;
 for(const t of ts){if(t.raw==='('||t.raw==='[')depth++;if(t.raw===')'||t.raw===']')depth--;if(t.raw==='+'&&depth===0){parts.push(record.original.slice(start,t.start).trim());start=t.end;}}
 parts.push(record.original.slice(start).trim());
 return parts.map(part=>{
  if(/^(?:'(?:[^']|'')*'|#[0-9]+|\s)+$/.test(part))return Array.from(part.matchAll(/'((?:[^']|'')*)'|#([0-9]+)/g),m=>m[2]?String.fromCharCode(Number(m[2])):m[1].replaceAll("''","'")).join('');
  for(const b of record.bindings){const p=normalized(part),original=normalized(b.originalExpression);if(p===original||(b.kind==='integer'&&p===`IntToStr(${original})`))return`{{${b.name}}}`;}
  throw Error(`Unreconstructed original Pascal view operand: ${record.id}:${part}`);
 }).join('');
}
/** Produce exact source intervals; callers apply proposals after their own integration review. */
export function buildPascalViewTranslations(sourceRoot,{manifest=JSON.parse(readFileSync(path.join(here,'manifest.json'),'utf8')),sourceOverrides={}}={}){
 const data=sourceData(sourceRoot,sourceOverrides),records=[],registryRecords=[],constantTerms=[],alreadyPatched=[];
 for(const row of literals){
  const matches=data[row.file].tokens.filter(t=>t.kind==='string'&&t.line===row.line&&t.value===row.english);
  if(matches.length!==1)throw Error(`Pascal literal guard is not unique: ${row.file}:${row.line}:${row.id}`);
  const t=matches[0],r={...row,start:t.start,end:t.end,original:t.raw,parameters:{},bindings:[],identity:row.english===row.japanese,replacement:`DRLText(${pas(row.id)}, ${t.raw})`,englishReconstruction:{kind:'pascal-literal',sourceRaw:t.raw,decoded:t.value}};
  const overlap=matchesPatch(manifest,r);if(overlap.length){alreadyPatched.push({...r,existingPatches:overlap.map(p=>p.id??p.kind)});continue;}records.push(r);
 }
 for(const row of expressions){
  const s=data[row.file].source;let start=s.indexOf(row.original);
  if(start<0||s.indexOf(row.original,start+1)>=0)throw Error(`Pascal expression guard is not unique: ${row.file}:${row.line}:${row.id}`);
  if(s.slice(0,start).split('\n').length!==row.line)throw Error(`Pascal expression source line mismatch: ${row.id}`);
  const parameters=Object.fromEntries(row.bindings.map(b=>[b.name,b.kind]));
  const params=row.bindings.map(b=>`${b.kind==='integer'?'DRLIntegerParam':'DRLStringParam'}(${pas(b.name)}, ${b.presentationExpression??b.originalExpression})`).join(', ');
  const r={...row,start,end:start+row.original.length,parameters,replacement:row.replacement??`DRLText(${pas(row.id)}, ${pas(row.english)}${params?`, [${params}]`:''})`};
  if(reconstructConcatenation(r)!==r.english)throw Error(`Pascal concatenation English reconstruction mismatch: ${r.id}`);
  r.englishReconstruction={kind:'pascal-concatenation',verified:true,originalExpression:r.original,parameterBindings:r.bindings.map(b=>({name:b.name,kind:b.kind,expression:b.originalExpression}))};
  const overlap=matchesPatch(manifest,r);if(overlap.length){alreadyPatched.push({...r,existingPatches:overlap.map(p=>p.id??p.kind)});continue;}records.push(r);
 }
 for(const row of formatRows){
  const {source,tokens}=data[row.file],matches=tokens.filter(t=>t.kind==='string'&&t.line===row.line&&t.value===row.printfFormat);
  if(matches.length!==1)throw Error(`Pascal Format guard is not unique: ${row.id}`);
  const call=originalFormatCall(tokens,matches[0]),specs=Array.from(row.printfFormat.matchAll(/%%|%[ds]/g),m=>m[0]).filter(s=>s!=='%%');
  if(call.ranges.length!==row.names.length||specs.length!==row.names.length)throw Error(`Pascal Format argument contract mismatch: ${row.id}`);
  const bindings=call.ranges.map(([start,end],i)=>binding(row.names[i],specs[i]==='%d'?'integer':'string',source.slice(start,end)));
  const english=templateFromPrintf(row.printfFormat,row.names),params=bindings.map(b=>`${b.kind==='integer'?'DRLIntegerParam':'DRLStringParam'}(${pas(b.name)}, ${b.originalExpression})`).join(', ');
  const r={file:row.file,line:row.line,id:row.id,english,japanese:row.japanese,original:source.slice(call.start,call.end),start:call.start,end:call.end,bindings,parameters:Object.fromEntries(bindings.map(b=>[b.name,b.kind])),replacement:`DRLText(${pas(row.id)}, ${pas(english)}, [${params}])`,englishReconstruction:{kind:'pascal-format',printfFormat:row.printfFormat,parameterOrder:row.names,argumentExpressions:bindings.map(b=>b.originalExpression)},literalRole:'complete-typed-presentation'};
  const overlap=matchesPatch(manifest,r);if(overlap.length){alreadyPatched.push({...r,existingPatches:overlap.map(p=>p.id??p.kind)});continue;}records.push(r);
 }
 for(const row of multilineRows){
  const source=data[row.file].source,lines=source.split('\n'),block=lines.slice(row.line-1,row.lastLine).join('\n'),at=block.indexOf(row.prefix),tail=block.lastIndexOf(');');
  if(at<0||block.indexOf(row.prefix,at+1)>=0||tail<=at)throw Error(`Multiline Pascal view source guard failed: ${row.id}`);
  const original=block.slice(at,tail).trim(),start=lines.slice(0,row.line-1).join('\n').length+(row.line>1?1:0)+at,parameters=Object.fromEntries(row.bindings.map(b=>[b.name,b.kind]));
  const params=row.bindings.map(b=>`${b.kind==='integer'?'DRLIntegerParam':'DRLStringParam'}(${pas(b.name)}, ${b.presentationExpression??b.originalExpression})`).join(', ');
  const r={...row,original,start,end:start+original.length,parameters,replacement:`DRLText(${pas(row.id)}, ${pas(row.english)}, [${params}])`,englishReconstruction:{kind:'pascal-concatenation',verified:true},literalRole:'complete-typed-presentation'};
  if(reconstructConcatenation(r)!==r.english)throw Error(`Multiline English reconstruction mismatch: ${r.id}`);
  const overlap=matchesPatch(manifest,r);if(overlap.length){alreadyPatched.push({...r,existingPatches:overlap.map(p=>p.id??p.kind)});continue;}records.push(r);
 }
 for(const row of pluralRows){
  const file='src/dfhof.pas',source=data[file].source,line=source.split('\n')[row.line-1],original=line.trim();
  const expected=`if ${row.condition}`;
  if(!original.startsWith(expected)||!original.includes(`'${row.prefix} ('+iWins+' win'+iPlural+' total)'`))throw Error(`Pascal result plural source guard failed: ${row.id}`);
  const variants=[{id:`${row.id}.one`,english:`${row.prefix} ({{wins}} win total)`,japanese:`${row.japanese}（通算{{wins}}勝）`,parameters:{wins:'string'}},{id:`${row.id}.many`,english:`${row.prefix} ({{wins}} wins total)`,japanese:`${row.japanese}（通算{{wins}}勝）`,parameters:{wins:'string'}}];
  const renderVariant=v=>`DRLText(${pas(v.id)}, ${pas(v.english)}, [DRLStringParam('wins', iWins)])`;
  const r={...exactSourceRecord(data,{file,line:row.line,original}),...variants[0],bindings:[binding('wins','string','iWins')],variants,additionalCatalogTerms:[variants[1]],replacement:`if ${row.condition} then\nbegin\n  if iWins = '1'\n    then Exit(${renderVariant(variants[0])})\n    else Exit(${renderVariant(variants[1])});\nend;`,englishReconstruction:{kind:'pascal-plural',prefix:row.prefix,originalPluralSelection:"iWins = '1' -> ''; otherwise 's'",originalPluralGuard:"if iWins = '1' then iPlural := ''\n    else iPlural := 's';"},literalRole:'complete-typed-plural'};
  if(!source.includes(r.englishReconstruction.originalPluralGuard))throw Error('Original Pascal plural selection guard changed');
  const overlap=matchesPatch(manifest,r);if(overlap.length){alreadyPatched.push({...r,existingPatches:overlap.map(p=>p.id??p.kind)});continue;}records.push(r);
 }
 for(const row of constants){
  const matches=data[row.file].tokens.filter(t=>t.kind==='string'&&t.line===row.line&&t.value===row.english);
  if(matches.length!==1)throw Error(`Indexed view constant guard failed: ${row.id}`);
  const t=matches[0];constantTerms.push({...row,start:t.start,end:t.end,original:t.raw,parameters:{},literalRole:'indexed-presentation-constant',domainConstantPreserved:true,replacement:null});
 }
 for(const row of registryRows){
  const r={...exactSourceRecord(data,row),kind:'registry-presentation',englishGuardRequired:true};
  const overlap=matchesPatch(manifest,r);if(overlap.length){alreadyPatched.push({...r,existingPatches:overlap.map(p=>p.id??p.kind)});continue;}registryRecords.push(r);
 }
 const sorted=[...records,...registryRecords].toSorted((a,b)=>a.file.localeCompare(b.file)||a.start-b.start);
 for(let i=1;i<sorted.length;i++)if(sorted[i].file===sorted[i-1].file&&sorted[i].start<sorted[i-1].end)throw Error(`Overlapping proposed Pascal view records: ${sorted[i].id}`);
 const ids=new Map;for(const r of [...records,...constantTerms,...records.flatMap(r=>r.additionalCatalogTerms??[])]){const last=ids.get(r.id);if(last&&(last.english!==r.english||last.japanese!==r.japanese))throw Error(`Conflicting Pascal view semantic ID: ${r.id}`);ids.set(r.id,r);}
 return{sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',sourceLocks:pascalViewSourceLocks,records,registryRecords,constantTerms,constantResolvers:pascalViewConstantResolvers,alreadyPatched,pending:pendingPascalViewGroups,reviewedSites:records.length,registrySites:registryRecords.length,semanticIds:ids.size,originalDomainModified:false,runtimeAdapterConnected:false};
}
/** Template, exact-source and symbolic English reconstruction checks are read-only. */
export function verifyPascalViewTranslations(sourceRoot,options={}){
 const result=buildPascalViewTranslations(sourceRoot,options);let typedSites=0,formatSites=0,controls=0;
 for(const r of [...result.records,...result.constantTerms,...result.records.flatMap(r=>r.additionalCatalogTerms??[])]){
  const enTokens=templateTokens(r.english),jaTokens=templateTokens(r.japanese),params=t=>Array.from(new Set(t.filter(t=>t.parameter).map(t=>t.parameter))).sort();
  if(JSON.stringify(params(enTokens))!==JSON.stringify(params(jaTokens))||JSON.stringify(params(enTokens))!==JSON.stringify(Object.keys(r.parameters).sort()))throw Error(`Pascal view placeholder contract mismatch: ${r.id}`);
  const symbols=s=>Array.from(s.matchAll(/\{\$[a-z_]+\}|\{[0-9]+\}/g),m=>m[0]).sort();
  if(JSON.stringify(symbols(r.english))!==JSON.stringify(symbols(r.japanese)))throw Error(`Pascal view controls changed: ${r.id}`);
  const codes=ts=>Array.from(ts.map(t=>t.literal??'').join('').matchAll(/\{([A-Za-z!^])/g),m=>m[1]);
  if(JSON.stringify(codes(enTokens))!==JSON.stringify(codes(jaTokens)))throw Error(`Pascal view VTIG codes changed: ${r.id}`);
  const values=Object.fromEntries(Object.entries(r.parameters).map(([name,kind],i)=>[name,kind==='integer'?BigInt(i+17):`sample ${name}% {{opaque}} 日本語`]));
  render({[r.id]:r.english},{[r.id]:r.parameters},r.id,values);render({[r.id]:r.japanese},{[r.id]:r.parameters},r.id,values);
  if(r.bindings?.length)typedSites++;
  if(r.englishReconstruction?.kind==='pascal-format'){
   let index=0;const original=r.englishReconstruction.printfFormat.replace(/%%|%[ds]/g,s=>s==='%%'?'%':String(values[r.englishReconstruction.parameterOrder[index++]]));
   if(original!==render({[r.id]:r.english},{[r.id]:r.parameters},r.id,values))throw Error(`Pascal printf reconstruction changed: ${r.id}`);
   formatSites++;
  }
  if(r.englishReconstruction?.kind==='pascal-plural')for(const wins of ['1','2','100']){
   const variant=r.variants[wins==='1'?0:1],original=`${r.englishReconstruction.prefix} (${wins} win${wins==='1'?'':'s'} total)`;
   if(render({[variant.id]:variant.english},{[variant.id]:variant.parameters},variant.id,{wins})!==original)throw Error(`Pascal plural English reconstruction changed: ${r.id}`);
  }
  controls+=symbols(r.english).length;
 }
 return{reviewedSites:result.reviewedSites,semanticIds:result.semanticIds,typedSites,formatSites,registrySites:result.registrySites,inputAndPositionalControls:controls,sourceFiles:Object.keys(result.sourceLocks).length,alreadyPatched:result.alreadyPatched.length,pendingGroups:result.pending.length,englishReconstructed:true,referenceRendererExecuted:true,nativeOrBrowserExecuted:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(verifyPascalViewTranslations(path.resolve(here,'../upstream/drl'))));
}
