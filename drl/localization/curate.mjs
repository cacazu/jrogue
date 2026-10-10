/** Reviewed authoring manifest. Every edit is scoped to an exact source site.
 * This script does not execute DRL, translate by global replacement, or write upstream.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {buildHelpCatalog} from './help-bodies.mjs';
import {buildRegistryTerms} from './registry-terms.mjs';
import {curateRegistrySites} from './registry-sites.mjs';
import {curateGameplaySites} from './gameplay-sites.mjs';
import {curateLuaSites} from './lua-sites.mjs';
import {curateMiscRegistrySites} from './misc-registry-sites.mjs';
import {curateViewSites,addPresentationUnits} from './view-sites.mjs';
import {curateFeelingSites} from './semantic-feeling-sites.mjs';
import {curateDeathProducerSites} from './death-producer-sites.mjs';
import {curatePascalCombatSites} from './pascal-combat-translations.mjs';
import {curateRegistryDisplaySites} from './registry-display-integration.mjs';
import {curateItemNameAspectSites} from './item-name-aspects.mjs';
import {curateTraitHistorySites} from './trait-history-sites.mjs';
import {curateMortemSites,curateMortemScoreSites} from './mortem-translations.mjs';
import {curateHistoryPresentation} from './history-presentation.mjs';
import {curatePaddingSites} from './padding-sites.mjs';
import {curateRuntimePathSites} from './runtime-path-sites.mjs';
import {curateModificationNotices} from './modification-notices.mjs';
import {browserPresentationOverrides} from './browser-ui-overrides.mjs';
import {curateLocaleRefreshSites} from './locale-refresh-sites.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../upstream/drl');
const en={},ja={},sources={},patches=[],contracts={};
const digest=s=>createHash('sha256').update(s).digest('hex');
const quoted=s=>s.split(/([\x00-\x1f])/).filter(Boolean).map(p=>p.length===1&&p.charCodeAt(0)<32?`#${p.charCodeAt(0)}`:`'${p.replaceAll("'","''")}'`).join('')||"''";
const file=f=>sources[f]??=(readFileSync(path.join(root,f),'utf8'));
function catalog(id,english,japanese,parameters={}) {
  if(!/^[a-z][a-z0-9_.-]+$/.test(id))throw Error(`Bad ID ${id}`);
  if(en[id]!==undefined&&(en[id]!==english||ja[id]!==japanese))throw Error(`Conflict ${id}`);
  en[id]=english;ja[id]=japanese;contracts[id]=parameters;
}
function exact(f,needle,replacement,id=null,occurrence=null) {
  const s=file(f),newline=s.includes('\r\n')?'\r\n':'\n';let start=-1;
  needle=needle.replaceAll('\r\n',newline);replacement=replacement.replaceAll('\r\n',newline);
  for(let i=0;i<=(occurrence??0);i++){start=s.indexOf(needle,start+1);if(start<0)throw Error(`Missing ${f}: ${needle}`);}
  if(occurrence===null&&s.indexOf(needle,start+1)>=0)throw Error(`Ambiguous ${f}: ${needle}`);
  patches.push({file:f,start,end:start+needle.length,original:needle,replacement,id,kind:id?'semantic-site':'bridge-support'});
}
function literal(f,line,english,id,japanese) {
  const token=scanSource(file(f),'pascal').tokens.filter(t=>t.kind==='string'&&t.line===line&&t.value===english);
  if(token.length!==1)throw Error(`Literal site ${f}:${line} ${english}, found ${token.length}`);
  const t=token[0];catalog(id,english,japanese);
  patches.push({file:f,start:t.start,end:t.end,original:t.raw,replacement:`DRLText(${quoted(id)}, ${t.raw})`,id,kind:'semantic-site'});
}
function expression(f,old,id,english,japanese,args,parameters) {
  catalog(id,english,japanese,parameters);
  exact(f,old,`DRLText(${quoted(id)}, ${quoted(english)}, [${args.join(', ')}])`,id);
}
const cfg='src/drlconfiguration.pas',settings='src/drlsettingsview.pas',menu='src/drlmainmenuview.pas',help='src/drlhelpview.pas',controllers='src/drlcontrollerbindings.pas';
for(const f of [cfg,settings,menu,help,controllers]) {
  const s=file(f),p=s.indexOf('implementation'),u=s.indexOf('uses ',p);
  if(u<0)throw Error(`Implementation uses missing ${f}`);
  patches.push({file:f,start:u+5,end:u+5,original:'',replacement:'drlsemantictext, ',id:null,kind:'bridge-support'});
}

// Complete declared display labels/descriptions in TDRLConfiguration.Create.
const optionRows=[
 ['skip_intro','イントロを省略','{!有効}にすると、ゲーム開始前の物語の紹介を省略します。'],
 ['default_module','標準モジュール','モジュールを選ぶと起動時の選択画面を省略します。{!起動時に選ぶ}なら毎回選択します。'],
 ['fullscreen','全画面表示','{!無効}にすると、ウィンドウ表示で起動します。'],
 ['font_multiplier','文字の倍率','文字の大きさを調整します。{!自動}なら解像度に応じて選びます。'],
 ['tile_multi','タイルの倍率','タイルの大きさを調整します。{!自動}なら解像度に応じて選びます。'],
 ['minimap_multi','ミニマップの倍率','ミニマップの大きさを調整します。{!自動}なら解像度に応じて選びます。'],
 ['minimap_opacity','ミニマップの不透明度','ミニマップの不透明度を調整します。{!0}なら表示しません。'],
 ['screen_shake','画面の揺れ','{!無効}にすると、画面が揺れる演出を止めます。'],
 ['flashing_fx','画面の閃光','{!無効}にすると、画面が光る演出を止めます。'],
 ['pulse_fx','血の脈動','{!無効}にすると、画面の周囲で血が脈打つ演出を止めます。'],
 ['glow_fx','発光効果','{!無効}にすると、発光効果を止めて描画の負荷を軽くします。'],
 ['fade_fx','フェード効果','{!無効}にすると、フロア移動時や終了時のフェード効果を止めます。'],
 ['item_drop_animation','アイテムを落とす演出','{!無効}にすると、落としたアイテムが跳ねる演出を止めます。'],
 ['volume_sound','効果音の音量','効果音の音量を調整します。{!0}なら効果音を止めます。'],
 ['volume_music','音楽の音量','音楽の音量を調整します。{!0}なら音楽を止めます。'],
 ['menu_sound','メニューの効果音','{!無効}にすると、メニュー操作の効果音を止めます。'],
 ['heartbeat_sound','心音','{!無効}にすると、体力が低いときの心音を止めます。'],
 ['wait_sound','待機の効果音','{!無効}にすると、待機時の効果音を止めます。'],
 ['always_random_name','名前を自動で決める','{!有効}にすると、名前の入力を省略し、常にランダムな名前を使います。'],
 ['hide_hints','ヒントを隠す','{!有効}にすると、右上のヒントを隠します。'],
 ['run_over_items','アイテムの上で連続移動を続ける','{!有効}にすると、連続移動中にアイテムを見つけても止まりません。'],
 ['group_messages','同じメッセージをまとめる','同じメッセージを (x{^3}) の形にまとめ、「続き…」の確認を減らします。'],
 ['unlock_all','すべて解放','復帰したプレイヤーが解放し直す手間を省くための設定です。それ以外での使用はチートです！'],
 ['empty_confirm','弾切れ時の射撃を確認','{!有効}にすると、弾のない武器で射撃しようとしたときに確認を待ちます。'],
 ['enable_mouse','マウス操作','{!無効}にすると、マウス操作とマウス用の表示を止めます。'],
 ['mouse_edge_pan','画面端でマウススクロール','{!有効}にすると、マウスを画面の端に置いたときにスクロールします。'],
 ['enable_gamepad','ゲームパッド操作','{!無効}にすると、ゲームパッド操作とゲームパッド用の表示を止めます。'],
 ['enable_rumble','ゲームパッドの振動','{!無効}にすると、ゲームパッドの振動を止めます。'],
];
for(const [key,name,desc]of optionRows){
  const s=file(cfg),start=s.indexOf(`( '${key}',`),end=s.indexOf(';',start),part=s.slice(start,end);
  if(start<0)throw Error(`Missing option ${key}`);
  const ts=scanSource(part,'pascal').tokens;
  for(const [method,japanese]of [['SetName',name],['SetDescription',desc]]){
    const at=ts.findIndex(t=>t.raw===method),t=ts[at+2];
    if(at<0||t.kind!=='string')throw Error(`Missing ${key}.${method}`);
    const id=`settings.option.${key}.${method==='SetName'?'name':'description'}`;
    catalog(id,t.value,japanese);
    patches.push({file:cfg,start:start+t.start,end:start+t.end,original:t.raw,replacement:`DRLText(${quoted(id)}, ${t.raw})`,id,kind:'semantic-site'});
  }
}
catalog('settings.value.automatic','Automatic','自動');
const cfgStrings=scanSource(file(cfg),'pascal').tokens.filter(t=>t.kind==='string');
for(const t of cfgStrings.filter(t=>t.value==='Automatic'))patches.push({file:cfg,start:t.start,end:t.end,original:t.raw,replacement:`DRLText('settings.value.automatic', ${t.raw})`,id:'settings.value.automatic',kind:'semantic-site'});
const fuzzy=cfgStrings.find(t=>t.value==='x1.5(fuzzy)');catalog('settings.value.tile-fuzzy','x1.5(fuzzy)','x1.5（ぼかし）');
patches.push({file:cfg,start:fuzzy.start,end:fuzzy.end,original:fuzzy.raw,replacement:`DRLText('settings.value.tile-fuzzy', ${fuzzy.raw})`,id:'settings.value.tile-fuzzy',kind:'semantic-site'});
// KeyInfo literals remain pristine. IDs derive from the official action ID at the precise UI metadata boundary.
exact(cfg,'.SetName(KeyInfo[ iInput ].Name)',".SetName(DRLText(KeyInfo[ iInput ].ID + '.name', KeyInfo[ iInput ].Name))");
exact(cfg,'.SetDescription(KeyInfo[ iInput ].Description)',".SetDescription(DRLText(KeyInfo[ iInput ].ID + '.description', KeyInfo[ iInput ].Description))");
const inputEn=JSON.parse(readFileSync(path.resolve(here,'../port/locales/input-en.json'),'utf8'));
const inputJa=JSON.parse(readFileSync(path.resolve(here,'../port/locales/input-ja.json'),'utf8'));
for(const [id,value]of Object.entries(inputEn))catalog(id,value,inputJa[id]);

const stateRows=[
 ['general','設定'],['display','設定（表示）'],['audio','設定（音声）'],['gameplay','設定（ゲームプレイ）'],['input','設定（入力）'],['controller','設定（コントローラー）'],
 ['keybindings_movement','キー割り当て（移動）'],['keybindings_actions','キー割り当て（行動）'],['keybindings_ui','キー割り当て（画面）'],['keybindings_running','キー割り当て（連続移動）'],['keybindings_helper','キー割り当て（補助）'],['keybindings_legacy','キー割り当て（旧方式）']
];
const stateTokens=scanSource(file(settings),'pascal').tokens.filter(t=>t.kind==='string'&&t.line>=79&&t.line<=90&&t.raw===t.raw&&file(settings).slice(t.start-8,t.start).includes('Title'));
if(stateTokens.length!==12)throw Error('State titles incomplete');
stateRows.forEach(([key,japanese],i)=>catalog(`settings.title.${key}`,stateTokens[i].value,japanese));
const subRows=[
 ['display','表示','映像と表示の設定を変更します。'],['audio','音声','音楽と効果音の設定を変更します。'],['gameplay','ゲームプレイ','ゲームプレイの設定を変更します。'],['input','入力','キー割り当て以外の入力設定を変更します。'],['controller','コントローラー','ゲーム中の行動にコントローラーのボタンを割り当てます。'],
 ['keybindings_movement','キー割り当て：移動','移動に使うキーを変更します。'],['keybindings_actions','キー割り当て：行動','ゲーム中の行動に使うキーを変更します。'],['keybindings_ui','キー割り当て：画面','所持品などの画面を開くキーを変更します。'],['keybindings_running','キー割り当て：連続移動','連続移動に使うキーを変更します。'],['keybindings_helper','キー割り当て：補助','補助操作とクイックスロットのキーを変更します。'],['keybindings_legacy','キー割り当て：旧方式','現在は不要になった旧来のキー操作を設定します。']
];
const subTokens=scanSource(file(settings),'pascal').tokens.filter(t=>t.kind==='string'&&t.line>=95&&t.line<=105);
subRows.forEach(([key,name,desc],i)=>{catalog(`settings.category.${key}.name`,subTokens[i*2].value,name);catalog(`settings.category.${key}.description`,subTokens[i*2+1].value,desc);});
const subIDs=subRows.map(([key])=>`   (Name: 'settings.category.${key}.name'; Description: 'settings.category.${key}.description')`).join(',\r\n');
const stateIDs=stateRows.map(([key])=>`'settings.title.${key}'`).concat("''").join(',\r\n   ');
exact(settings,'constructor TSettingsView.Create;\r\nvar',`const CStateTextIDs: array[TSettingsViewState] of AnsiString = (\r\n   ${stateIDs}\r\n);\r\nconst CSubTextIDs: array[1..11] of record Name, Description: AnsiString; end = (\r\n${subIDs}\r\n);\r\n\r\nconstructor TSettingsView.Create;\r\nvar`);
exact(settings,'CStates[ FState ].Title',"DRLText(CStateTextIDs[FState], CStates[FState].Title)");
exact(settings,'CSub[i].Select',"DRLText(CSubTextIDs[i].Name, CSub[i].Select)");
exact(settings,'CSub[iSelected + 1].Desc',"DRLText(CSubTextIDs[iSelected + 1].Description, CSub[iSelected + 1].Desc)");

const settingLiterals=[
 [136,'Automatic','settings.value.automatic','自動'],[144,'Ask on launch','settings.value.ask','起動時に選ぶ'],
 [187,'Warning','ui.warning','警告'],[189,'{l<{!{$input_escape},{$input_ok}}> continue}','settings.hint.continue','{l<{!{$input_escape},{$input_ok}}> 続ける}'],
 [199,'Restart?','settings.restart.title','再起動しますか？'],[200,'This is a different core mod then the current one. Restart with new core mod?','settings.restart.confirm','現在とは異なる基本モジュールです。新しいモジュールで再起動しますか？'],
 [202,'Restart','settings.restart.accept','再起動'],[203,'Cancel','ui.cancel','キャンセル'],[232,'Resolution','settings.resolution.name','解像度'],[255,'Reset to defaults','settings.reset.name','初期設定に戻す'],[256,'Apply settings','settings.apply.name','設定を適用'],[317,'Unavailable','settings.value.unavailable','利用不可'],
 [360,'Do note that the x1.5 multiplier is an accessability option, created mostly for SteamDeck readability - the pixel art will be distorted in this setting, and small artifacts may appear!','settings.tile-fuzzy.warning','x1.5 は主に Steam Deck で読みやすくするための補助設定です。ピクセルアートが変形し、細かな表示の乱れが出ることがあります。'],
 [381,'Resets ALL configuration values to default values.','settings.reset.all','すべての設定を初期値に戻します。'],[382,'Apply changes and exit.','settings.apply.exit','変更を適用して閉じます。'],[386,'Resets values from this screen to default values.','settings.reset.screen','この画面の設定を初期値に戻します。'],[387,'Apply changes and return to previous menu.','settings.apply.back','変更を適用して前のメニューに戻ります。'],
 [392,'Choose screen resolution. Pick {!Automatic} to use native in fullscreen.','settings.resolution.description','画面の解像度を選びます。{!自動}なら全画面表示で画面本来の解像度を使います。'],[393,'Resolution choice unavailable in ASCII mode. You can still reset it to default if needed.','settings.resolution.ascii','ASCII 表示では解像度を選べません。必要なら初期値には戻せます。'],
 [402,'{l<{!{$input_up},{$input_down}}> select, <{!{$input_ok}}> rebind, <{!{$input_escape}}> back}','settings.hint.controller','{l<{!{$input_up},{$input_down}}> 選択、<{!{$input_ok}}> 割り当て、<{!{$input_escape}}> 戻る}'],
 [404,'{l<{!{$input_up},{$input_down}}> select, <{!{$input_ok}}> change/enter, <{!{$input_escape}}> back, <{!{$input_uidrop}}> clear}','settings.hint.keys','{l<{!{$input_up},{$input_down}}> 選択、<{!{$input_ok}}> 変更／開く、<{!{$input_escape}}> 戻る、<{!{$input_uidrop}}> 解除}'],
 [405,'{l<{!{$input_up},{$input_down}}> select, <{!{$input_ok}}> change or enter submenu, <{!{$input_escape}}> back}','settings.hint.options','{l<{!{$input_up},{$input_down}}> 選択、<{!{$input_ok}}> 変更／次の画面、<{!{$input_escape}}> 戻る}'],
 [489,'D-pad directions are fixed.','settings.controller.dpad-fixed','方向パッドの割り当ては固定です。'],[523,'Release one controller button to bind.','settings.controller.capture','割り当てたいボタンを押してから離してください。'],[524,'Hold {!B} for one second or press {!Escape} to cancel.','settings.controller.cancel','{!B} を 1 秒押し続けるか、{!Escape} でキャンセルします。'],[578,'Press the key or chord you want to bind, or <{!Escape}> to cancel...','settings.keys.capture','割り当てたいキーまたはキーの組み合わせを押してください。<{!Escape}> でキャンセルします。']
];
for(const row of settingLiterals)literal(settings,...row);
expression(settings,"FModCurrent+' (missing)'",'settings.module.missing','{{module}} (missing)','{{module}}（見つかりません）',["DRLStringParam('module', FModCurrent)"],{module:'string'});
catalog('settings.value.enabled','Enabled','有効');catalog('settings.value.disabled','Disabled','無効');
exact(settings,'VTIG_EnabledInput( Access, iSelected = i )',"VTIG_EnabledInput(Access, iSelected = i, DRLText('settings.value.enabled', 'Enabled'), DRLText('settings.value.disabled', 'Disabled'))");
catalog('settings.value.unbound','none','未割り当て');
exact(settings,'VTIG_InputField( IOKeyCodeToStringShort( aValue^ ) );',"if aValue^ = 0 then\r\n    VTIG_InputField(DRLText('settings.value.unbound', 'none'))\r\n  else\r\n    VTIG_InputField(IOKeyCodeToStringShort(aValue^));",'settings.value.unbound');

// Controller registry names/descriptions are localized only at their UI metadata use.
const controllerRows=[
 ['move','移動／待機を確定','左スティックで指定した移動を確定するか、その場で待機します。'],['action','状況に応じた行動／拾う','状況に応じた行動をするか、アイテムを拾います。'],['fire','射撃','装備中の武器で射撃します。'],['reload','リロード','装備中の武器をリロードします。'],['menu','ゲームメニュー','ゲームメニューを開きます。'],['player','キャラクター画面','キャラクター画面を開きます。'],['active','発動型スキル','発動型スキルを使います。'],['swap','武器を交換','装備中の武器を交換します。'],['target_prev','前の対象','前の対象を選びます。'],['target_next','次の対象','次の対象を選びます。'],['up','上方向','照準または選択を上に動かします。'],['down','下方向','照準または選択を下に動かします。'],['left','左方向','照準または選択を左に動かします。'],['right','右方向','照準または選択を右に動かします。'],['modifier_run','連続移動／クイックスロット補助','移動とクイックスロットの操作を切り替えます。'],['modifier_alt','照準／別モード補助','照準、射撃、リロード、アイテム操作を別モードに切り替えます。']
];
for(const [i,[key,name,desc]]of controllerRows.entries()){
  const ts=scanSource(file(controllers),'pascal').tokens.filter(t=>t.kind==='string'&&t.line===54+i);
  if(ts[0].value!==`controller_gameplay_${key}`)throw Error('Controller order mismatch');
  catalog(`controller_gameplay_${key}.name`,ts[2].value,name);catalog(`controller_gameplay_${key}.description`,ts[3].value,desc);
}
exact(controllers,'.SetName( ControllerBindingInfo[ iAction ].Name )',".SetName(DRLText(ControllerBindingInfo[iAction].ID + '.name', ControllerBindingInfo[iAction].Name))");
exact(controllers,'.SetDescription( ControllerBindingInfo[ iAction ].Description )',".SetDescription(DRLText(ControllerBindingInfo[iAction].ID + '.description', ControllerBindingInfo[iAction].Description))");
exact(settings,'VTIG_Selectable( ControllerBindingInfo[ iAction ].Name )',"VTIG_Selectable(DRLText(ControllerBindingInfo[iAction].ID + '.name', ControllerBindingInfo[iAction].Name))");

// New-game and challenge-type records remain intact, including IDs/requirements/mechanics.
const newRows=[['regular','通常のゲーム','標準ルールでゲームを始めます。'],['challenge','チャレンジ','ルールを変更するチャレンジを選びます。'],['seeded','シード指定','シードを入力して同じ初期条件を再現します。プラチナ以上のバッジは獲得できません。']];
const newTokens=scanSource(file(menu),'pascal').tokens.filter(t=>t.kind==='string'&&[116,117,120,121,124,125].includes(t.line));
newRows.forEach(([key,name,desc],i)=>{catalog(`menu.new.${key}.name`,newTokens[2*i].value,name);catalog(`menu.new.${key}.description`,newTokens[2*i+1].value,desc);});
const helpers=`const CNewGameTextIDs: array[0..2] of record Name, Description: AnsiString; end = (\r\n${newRows.map(([key])=>`  (Name: 'menu.new.${key}.name'; Description: 'menu.new.${key}.description')`).join(',\r\n')}\r\n);\r\nfunction NewGameText(aIndex: Integer; aDescription: Boolean): AnsiString;\r\nbegin\r\n  if aDescription then\r\n    Exit(DRLText(CNewGameTextIDs[aIndex].Description, NewGameType[aIndex].Desc));\r\n  Exit(DRLText(CNewGameTextIDs[aIndex].Name, NewGameType[aIndex].Name));\r\nend;\r\n\r\n`;
exact(menu,'constructor TMainMenuView.Create( aInitial : TMainMenuViewMode = MAINMENU_FIRST; aResult : TMenuResult = nil );\r\nbegin',helpers+'constructor TMainMenuView.Create( aInitial : TMainMenuViewMode = MAINMENU_FIRST; aResult : TMenuResult = nil );\r\nbegin');
for(const index of ['iSelected','0','1','2'])exact(menu,`NewGameType[${index}].Name`,`NewGameText(${index}, False)`);
exact(menu,'NewGameType[iSelected].Desc','NewGameText(iSelected, True)');
const chalRows=[['angel','エンジェル・ゲーム','DRL の定番チャレンジです。プレイ方法に制限を加えたり、ルールを変えたりします。','{y上等兵}の階級に到達すると解放されます！'],['dual','デュアル・エンジェル','DRL のチャレンジを 2 つ組み合わせます。スコアに反映されるのは最初のチャレンジだけです。2 つ目は自分への挑戦です！','{y軍曹}の階級に到達すると解放されます！'],['arch','アークエンジェル','DRL のチャレンジを超高難度でプレイします。公平さは期待しないでください！','{y上級曹長}の階級に到達すると解放されます！'],['custom','カスタム・チャレンジ','さまざまなカスタムフロアやエピソードをプレイします。メインメニューの {yCustom game/Download Mods} から追加できます。',null]];
const chalTokens=scanSource(file(menu),'pascal').tokens.filter(t=>t.kind==='string'&&t.value&&t.line>=97&&t.line<=110);
chalRows.forEach(([key,name,desc,unlock],i)=>{
  const base=i*3;catalog(`menu.challenge-type.${key}.name`,chalTokens[base].value,name);catalog(`menu.challenge-type.${key}.description`,chalTokens[base+1].value,desc);
  if(unlock!==null)catalog(`menu.challenge-type.${key}.unlock`,chalTokens[base+2].value,unlock);
});
for(let i=1;i<=3;i++){
 const key=chalRows[i-1][0];exact(menu,`FArrayCType.Push( ChallengeType[${i}] );`,`iEntry := ChallengeType[${i}];\r\n  iEntry.Name := DRLText('menu.challenge-type.${key}.name', iEntry.Name);\r\n  iEntry.Desc := DRLText('menu.challenge-type.${key}.description', iEntry.Desc);\r\n  iEntry.Extra := DRLText('menu.challenge-type.${key}.unlock', iEntry.Extra);\r\n  FArrayCType.Push(iEntry);`);
}
const mainConstants=[['TextContinueGame','continue','続きから'],['TextNewGame','new','新しいゲーム'],['TextJHC','jhc','Steam で JHC を購入！'],['TextShowHighscore','highscores','ハイスコア'],['TextShowPlayer','player','プレイヤー情報'],['TextExit','exit','終了'],['TextHelp','help','ヘルプ'],['TextSettings','settings','設定']];
for(const [name,key,japanese]of mainConstants){
 const match=new RegExp(`${name}\\s*=\\s*('(?:[^']|'')*');`).exec(file(menu));if(!match)throw Error(`Missing ${name}`);
 const english=scanSource(match[1],'pascal').tokens[0].value;
 // Keep color structure/decorative runs byte-for-byte; translate only the content.
 const translated=key==='jhc'?english.replace('Buy JHC on Steam!',japanese):english.replace(/ (?=[A-Z])[A-Za-z ]+ (?=\{b)/,` ${japanese} `);
 catalog(`menu.main.${key}`,english,translated);
 exact(menu,`VTIG_Selectable( ${name} )`,`VTIG_Selectable(DRLText('menu.main.${key}', ${name}))`);
}
const menuLiterals=[
 [275,'Enter name','menu.name.title','名前を入力'],[307,'Engine version mismatch','menu.engine-mismatch.title','エンジンのバージョン不一致'],[308,'This module expects a different {!engine version}.','menu.engine-mismatch.message','このモジュールには異なる{!エンジンのバージョン}が必要です。'],[314,'Update the engine or the module, whichever is lower. Continuing may cause unstable behaviour!','menu.engine-mismatch.advice','エンジンとモジュールのうち、古いほうを更新してください。続けると動作が不安定になる可能性があります。'],[316,'Exit','ui.exit','終了'],[321,'Continue','ui.continue','続ける'],
 [477,'Enter seed','menu.seed.title','シードを入力'],[538,'Enter seed','menu.seed.title','シードを入力'],[519,'Enter a seed (1..999999)','menu.seed.prompt','シードを入力（1〜999999）'],[543,'{RSeed not in range!}','menu.seed.invalid','{Rシードが範囲外です！}'],
 [565,'Corrupted save file','menu.save.corrupt.title','セーブファイルの破損'],[567,'Press <{!{$input_ok},{$input_escape}}> to continue...','menu.hint.continue','<{!{$input_ok},{$input_escape}}> で続けます…'],[577,'Incompatible save file!','menu.save.incompatible.title','互換性のないセーブファイル'],[580,'Save file uses an incompatible {!engine version}!','menu.save.incompatible.engine','セーブファイルの{!エンジンのバージョン}に互換性がありません！'],[584,'This in-progress save cannot be loaded by this engine version.','menu.save.incompatible.engine-advice','このエンジンのバージョンでは、進行中のセーブデータを読み込めません。'],[588,'Save file is from an incompatible version of the game!','menu.save.incompatible.game','セーブファイルのゲームバージョンに互換性がありません！'],
 [593,'You can try to download the direct previous version from {!Steam} Betas tab and finish the game, or delete the save file now.','menu.save.incompatible.steam-advice','{!Steam} のベータタブから直前のバージョンを入手してゲームを終えるか、今セーブファイルを削除できます。'],[594,'You can try downloading the previous version from the web and finish the game, or delete the save file now.','menu.save.incompatible.web-advice','Web から以前のバージョンを入手してゲームを終えるか、今セーブファイルを削除できます。'],[598,'Save file uses different mods!','menu.save.incompatible.mods','セーブファイルで使われている MOD が異なります！'],[602,'You can exit the game and try to match the mods or delete the save file now.','menu.save.incompatible.mod-advice','ゲームを終了して MOD の構成を合わせるか、今セーブファイルを削除できます。'],[605,'  Cancel loading, keep save','menu.save.keep','  読み込みを取り消し、セーブを残す'],[607,'  Delete save file','menu.save.delete','  セーブファイルを削除'],
 [622,'Warning','ui.warning','警告'],[624,"Are you sure? This difficulty level isn't even remotely fair!",'menu.difficulty.warning','本当によろしいですか？ この難易度は公平さとはほど遠いものです！'],[627,'Bring it on!','menu.difficulty.accept','望むところだ！'],[629,'Cancel','ui.cancel','キャンセル'],[652,'Type a name for your character','menu.name.prompt','キャラクターの名前を入力してください'],
 [874,'{l<{!{$input_up}},{!{$input_down}}> select, <{!{$input_ok}}> select, <{!{$input_escape}}> cancel}','menu.challenge.hint','{l<{!{$input_up}},{!{$input_down}}> 選択、<{!{$input_ok}}> 決定、<{!{$input_escape}}> キャンセル}'],
 [1043,'Choose your Challenge','menu.challenge.choose','チャレンジを選択'],[1049,'Choose your Primary Challenge','menu.challenge.choose-primary','第 1 チャレンジを選択'],[1059,'Choose your Arch-Challenge','menu.challenge.choose-arch','アークチャレンジを選択'],[1071,'Choose your Secondary Challenge','menu.challenge.choose-secondary','第 2 チャレンジを選択'],[1098,'UNRATED','menu.challenge.unrated','未評価'],
 [1125,'Mod loading errors','menu.mods.errors-title','MOD 読み込みエラー'],[1126,'{!There were errors while loading mods - fix, remove or disable!} ','menu.mods.errors-message','{!MOD の読み込みでエラーが起きました。修正、削除、または無効化してください！} '],[1134,'You can ignore and proceed the errors are just version compatibility errors, otherwise the game might be unstable.','menu.mods.errors-advice','バージョンの互換性だけのエラーなら続けられます。それ以外ではゲームが不安定になる可能性があります。'],[1135,"If you're working on a mod, you can edit it and press {!Ctrl}+{!F1} to reload.",'menu.mods.reload-advice','MOD を開発中なら、編集してから {!Ctrl}+{!F1} で読み直せます。'],[1136,'Press <{!{$input_escape}}> to continue...','menu.mods.continue','<{!{$input_escape}}> で続けます…']
];
const correctedMenuLines={543:544,652:648,874:878,1043:1063,1049:1069,1059:1078,1071:1090,1098:1111};
for(const [line,...rest] of menuLiterals)literal(menu,correctedMenuLines[line]??line,...rest);
const versions=[
 ["'Module version          : {!'+VersionModule+'}'",'menu.version.module','Module version          : {!{{version}}}','モジュールのバージョン：{!{{version}}}','VersionModule'],
 ["'Engine version          : {!'+VersionEngine+'}'",'menu.version.engine','Engine version          : {!{{version}}}','エンジンのバージョン：{!{{version}}}','VersionEngine'],
 ["'Expected engine version : {!'+VersionEngineExpected+'}'",'menu.version.expected','Expected engine version : {!{{version}}}','必要なエンジンのバージョン：{!{{version}}}','VersionEngineExpected'],
 ["'Save engine version : {!'+SaveVersionEngine+'}'",'menu.save.version.engine','Save engine version : {!{{version}}}','セーブのエンジンバージョン：{!{{version}}}','SaveVersionEngine'],
 ["'Current engine version : {!'+VersionEngineSave+'}'",'menu.save.version.current-engine','Current engine version : {!{{version}}}','現在のエンジンバージョン：{!{{version}}}','VersionEngineSave'],
 ["'Save game version : {!'+SaveVersionModule+'}'",'menu.save.version.game','Save game version : {!{{version}}}','セーブのゲームバージョン：{!{{version}}}','SaveVersionModule'],
 ["'This game version : {!'+VersionModuleSave+'}'",'menu.save.version.current-game','This game version : {!{{version}}}','現在のゲームバージョン：{!{{version}}}','VersionModuleSave'],
 ["'Save file IDs : {!'+SaveModString+'}'",'menu.save.mods.saved','Save file IDs : {!{{mods}}}','セーブの MOD：{!{{mods}}}','SaveModString'],
 ["'Current IDs   : {!'+DRL.Modules.ModString+'}'",'menu.save.mods.current','Current IDs   : {!{{mods}}}','現在の MOD：{!{{mods}}}','DRL.Modules.ModString']
];
for(const [old,id,english,japanese,variable]of versions){const p=id.includes('.mods.')?'mods':'version';expression(menu,old,id,english,japanese,[`DRLStringParam('${p}', ${variable})`],{[p]:'string'});}
expression(menu,"'Save file is {!corrupted}!'+#10+#10+'{!Removed} corrupted save file, we''re sorry :(. Player and score data are {!intact}.'",'menu.save.corrupt.message',"Save file is {!corrupted}!\n\n{!Removed} corrupted save file, we're sorry :(. Player and score data are {!intact}.",'セーブファイルが{!破損}しています！\n\n破損したセーブファイルを{!削除}しました。申し訳ありません。プレイヤーとスコアのデータは{!無事}です。',[],{});
expression(menu,"'Reach {y'+iRank+'} rank to unlock!'",'menu.challenge.unlock','Reach {y{{rank}}} rank to unlock!','{y{{rank}}}の階級に到達すると解放されます！',["DRLStringParam('rank', iRank)"],{rank:'string'});
expression(menu,"'Rating: {!'+FArrayChal[iSelect].Extra+'}'#10#10+FArrayChal[iSelect].Desc",'menu.challenge.details','Rating: {!{{rating}}}\n\n{{description}}','難易度評価：{!{{rating}}}\n\n{{description}}',["DRLStringParam('rating', FArrayChal[iSelect].Extra)","DRLStringParam('description', FArrayChal[iSelect].Desc)"],{rating:'string',description:'string'});
expression(menu,"'... and '+IntToStr( ModErrors.Size - 8 )+' more error line(s).'",'menu.mods.more-errors','... and {{count}} more error line(s).','…ほか {{count}} 件のエラー。',["DRLIntegerParam('count', ModErrors.Size - 8)"],{count:'integer'});
catalog('menu.seed.value','Seed: {!{{seed}}}','シード：{!{{seed}}}',{seed:'integer'});
exact(menu,"VTIG_Text( 'Seed: {!{0}}', [FResult.Seed] )","VTIG_Text(DRLText('menu.seed.value', 'Seed: {!{{seed}}}', [DRLIntegerParam('seed', FResult.Seed)]))",'menu.seed.value');

// Help selector and complete built-in quick primers. Help document bodies remain a separate migration queue.
const helpRows=[
 [89,'{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_ok},{$input_escape}}> return}','help.hint.read','{l<{!{$input_up},{$input_down}}> スクロール、<{!{$input_ok},{$input_escape}}> 戻る}'],[103,'Help topics','help.title','ヘルプの項目'],[109,'Quit help','help.exit','ヘルプを閉じる'],[116,'Select help topic above. Quick controls primer:','help.primer.controller.title','上から項目を選んでください。基本のコントローラー操作：'],
 [118,'Movement is done by moving the {!Left Stick} to the desired direction and confirming it with the {!{$controller_gameplay_move}} button.','help.primer.controller.move','{!左スティック}で方向を指定し、{!{$controller_gameplay_move}} ボタンで移動を確定します。'],
 [119,'  {!{$controller_gameplay_move|5}} -- move ( with {!{$controller_gameplay_modifier_alt}} held - move targeting reticule )','help.primer.controller.move-modifier','  {!{$controller_gameplay_move|5}} -- 移動（{!{$controller_gameplay_modifier_alt}} を押しながらなら照準を移動）'],[120,'  {!{$controller_gameplay_action|5}} -- pickup item or activate stairs/lever','help.primer.controller.action','  {!{$controller_gameplay_action|5}} -- アイテムを拾う／階段やレバーを使う'],[121,'           + with {!{$controller_gameplay_modifier_alt}} held - use item from ground','help.primer.controller.ground','           + {!{$controller_gameplay_modifier_alt}} を押しながら -- 床のアイテムを使う'],[122,'           + {!LStick} direction - direction of action (open/close door)','help.primer.controller.direction','           + {!LStick} の方向 -- 行動の方向を指定（ドアの開閉）'],[123,'  {!{$controller_gameplay_fire|5}} -- fire ( with {!{$controller_gameplay_modifier_alt}} held - alt-fire )','help.primer.controller.fire','  {!{$controller_gameplay_fire|5}} -- 射撃（{!{$controller_gameplay_modifier_alt}} を押しながらなら別モード）'],[124,'  {!{$controller_gameplay_reload|5}} -- reload ( with {!{$controller_gameplay_modifier_alt}} held - alt-reload )','help.primer.controller.reload','  {!{$controller_gameplay_reload|5}} -- リロード（{!{$controller_gameplay_modifier_alt}} を押しながらなら別モード）'],[125,'  {!{$controller_gameplay_player|5}} -- character screens (inventory, etc)','help.primer.controller.player','  {!{$controller_gameplay_player|5}} -- キャラクター画面（所持品など）'],[126,'  ...      -- see "Gamepad controls" entry for the rest','help.primer.controller.more','  …        -- その他は「ゲームパッド操作」を参照'],
 [130,'Select help topic above. Quick (default) keybindings primer:','help.primer.keyboard.title','上から項目を選んでください。初期設定の基本キー操作：'],[132,'  {!Escape}    - game menu (Save, Quit, Settings, Help, etc)','help.primer.keyboard.menu','  {!Escape}    - ゲームメニュー（セーブ、終了、設定、ヘルプなど）'],[133,'  {!Arrows}    - movement (Home,End,PgUp,PgDown - diagonals)','help.primer.keyboard.move','  {!Arrows}    - 移動（Home、End、PgUp、PgDown は斜め移動）'],[134,'  {!W}         - wait (pass turn)','help.primer.keyboard.wait','  {!W}         - 待機（ターンを進める）'],[135,'  {!SPACE}     - action (open,close,press button,descend stairs)','help.primer.keyboard.action','  {!SPACE}     - 行動（開閉、ボタンを押す、階段を降りる）'],[136,'  {!I},{!E},{!P},{!T}   - inventory, equipment etc (left/right to switch while open)','help.primer.keyboard.player','  {!I},{!E},{!P},{!T}   - 所持品、装備など（開いた画面は左右キーで切り替え）'],[137,'  {!F}         - fire weapon (SHIFT for alternative mode)','help.primer.keyboard.fire','  {!F}         - 射撃（SHIFT で別モード）'],[138,'  {!R}         - reload weapon (SHIFT for alternative mode)','help.primer.keyboard.reload','  {!R}         - リロード（SHIFT で別モード）'],[139,'  {!G}         - get item (pickup) from floor (SHIFT to use)','help.primer.keyboard.ground','  {!G}         - 床のアイテムを拾う（SHIFT で使う）'],[140,'  ...          see "Controls" entry for the rest','help.primer.keyboard.more','  …            その他は操作の項目を参照'],[144,'{l<{!{$input_up},{$input_down}}> select, <{!{$input_ok}}> open, <{!{$input_escape}}> exit}','help.hint.menu','{l<{!{$input_up},{$input_down}}> 選択、<{!{$input_ok}}> 開く、<{!{$input_escape}}> 閉じる}']
];
for(const row of helpRows)literal(help,...row);
const topics=[['intro','Introduction','紹介'],['start','Getting started','始め方'],['gamepad','Gamepad controls','ゲームパッド操作'],['keys','Keyboard controls','キーボード操作'],['mouse','Mouse controls','マウス操作'],['feedback','Feedback','意見と不具合報告'],['disclaim','Disclaimer','免責事項'],['credits','Credits','クレジット']];
for(const [key,english,japanese]of topics)catalog(`help.topic.${key}`,english,japanese);

const helpBodies=buildHelpCatalog(root);
for(const entry of helpBodies.entries)catalog(entry.id,entry.en,entry.ja);
// Help source bytes and view state are retained by locale-refresh-sites.

const registryTerms=buildRegistryTerms(root);
for(const [id,english]of Object.entries(registryTerms.englishCatalog))catalog(id,english,registryTerms.japaneseCatalog[id]);
curateRegistrySites({file,exact});
writeFileSync(path.join(here,'registration-term-catalog.json'),JSON.stringify(registryTerms,null,2)+'\n');
const adapterEnglishPath=path.resolve(here,'../experiments/lua-wasi/adapter-errors-en.json');
const adapterJapanesePath=path.resolve(here,'../experiments/lua-wasi/adapter-errors-ja.json');
const adapterEnglish=JSON.parse(readFileSync(adapterEnglishPath,'utf8')),adapterJapanese=JSON.parse(readFileSync(adapterJapanesePath,'utf8'));
if(JSON.stringify(Object.keys(adapterEnglish).sort())!==JSON.stringify(Object.keys(adapterJapanese).sort()))throw Error('Adapter diagnostic locale IDs differ');
for(const [id,value]of Object.entries(adapterEnglish))catalog(id,value,adapterJapanese[id]);
for(const [id,english,japanese]of [
 ['error.lua.platform.external-process','external processes are unavailable in the browser','ブラウザーでは外部プロセスを実行できません'],
 ['error.lua.platform.temporary-name','temporary filename allocation requires the browser platform adapter','一時ファイル名を作るにはブラウザー用のプラットフォーム接続が必要です'],
 ['error.lua.platform.temporary-file','temporary file allocation requires the browser platform adapter','一時ファイルを作るにはブラウザー用のプラットフォーム接続が必要です']
])catalog(id,english,japanese);
const browserEnglish=JSON.parse(readFileSync(path.resolve(here,'../port/locales/gameui-en.json'),'utf8'));
const browserJapanese=JSON.parse(readFileSync(path.resolve(here,'../port/locales/gameui-ja.json'),'utf8'));
if(JSON.stringify(Object.keys(browserEnglish).sort())!==JSON.stringify(Object.keys(browserJapanese).sort()))throw Error('Browser UI locale IDs differ');
// This product-facing attribution is a reviewed semantic-ID override, separate
// from original-game migration. Bootstrap HTML/locales are integrated by parent.
for(const id of Object.keys(browserPresentationOverrides))if(!Object.hasOwn(browserEnglish,id))throw Error(`Unknown browser override ID: ${id}`);
for(const [id,value]of Object.entries(browserEnglish)){
 const override=browserPresentationOverrides[id];
 catalog(id,override?.[0]??value,override?.[1]??browserJapanese[id]);
}
const gameplaySites=curateGameplaySites({file,exact,catalog,patches});
const luaSites=curateLuaSites({file,exact,catalog,patches});
const miscellaneousSites=curateMiscRegistrySites({file,exact,catalog,patches});
addPresentationUnits({file,patches},miscellaneousSites.requiredUnits);
const feelingSites=curateFeelingSites({file,exact,catalog,patches});
addPresentationUnits({file,patches},feelingSites.requiredUnits);
const deathProducerSites=curateDeathProducerSites({file,exact,catalog,patches});
writeFileSync(path.join(here,'death-producer-sites.json'),JSON.stringify(deathProducerSites,null,2)+'\n');
catalog('ui.error.feeling_sidecar_save','The game was saved, but its translated level message could not be saved.','ゲームは保存されましたが、フロアの雰囲気文を翻訳して再表示するための情報は保存できませんでした。');
const viewSites=curateViewSites({file,exact,catalog,patches},root);
const combatSites=curatePascalCombatSites({file,catalog,patches});
addPresentationUnits({file,patches},combatSites.requiredUnits);
const registryDisplaySites=curateRegistryDisplaySites({file,catalog,patches},root);
addPresentationUnits({file,patches},registryDisplaySites.requiredUnits);
writeFileSync(path.join(here,'registry-display-sites.json'),JSON.stringify(registryDisplaySites,null,2)+'\n');
const itemNameAspects=curateItemNameAspectSites({file,catalog,patches,messageSites:gameplaySites.concat(luaSites,combatSites.reviewed)});
writeFileSync(path.join(here,'item-name-aspects.json'),JSON.stringify(itemNameAspects,null,2)+'\n');
catalog('ui.error.item_name_sidecar_save','The game was saved, but its translated item names could not be saved.','ゲームは保存されましたが、アイテム名を翻訳して再表示するための情報は保存できませんでした。');
const traitHistorySites=curateTraitHistorySites({file,exact,catalog,patches});
addPresentationUnits({file,patches},traitHistorySites.requiredUnits);
const mortemSites=curateMortemSites({file,exact,catalog,patches});
const mortemScoreSites=curateMortemScoreSites({file,exact,patches});
const historySites=curateHistoryPresentation({file,catalog,patches});
addPresentationUnits({file,patches},historySites.requiredUnits);
catalog('ui.error.history_sidecar_save','The game was saved, but its translated history could not be saved.','ゲームは保存されましたが、履歴を翻訳して再表示するための情報は保存できませんでした。');
writeFileSync(path.join(here,'history-sites.json'),JSON.stringify(historySites,null,2)+'\n');
writeFileSync(path.join(here,'mortem-score-sites.json'),JSON.stringify(mortemScoreSites,null,2)+'\n');
writeFileSync(path.join(here,'mortem-sites.json'),JSON.stringify(mortemSites,null,2)+'\n');
writeFileSync(path.join(here,'combat-sites.json'),JSON.stringify(combatSites,null,2)+'\n');
writeFileSync(path.join(here,'gameplay-sites.json'),JSON.stringify({schema:1,sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',allGameplayMessagesCovered:false,reviewed:gameplaySites.concat(luaSites,combatSites.reviewed)},null,2)+'\n');
const paddingSites=curatePaddingSites({file,patches});
writeFileSync(path.join(here,'padding-sites.json'),JSON.stringify(paddingSites,null,2)+'\n');
const runtimePathSites=curateRuntimePathSites({file,catalog,patches,viewRecords:viewSites.records});
addPresentationUnits({file,patches},runtimePathSites.requiredUnits);
writeFileSync(path.join(here,'runtime-path-sites.json'),JSON.stringify(runtimePathSites,null,2)+'\n');
const localeRefreshSites=curateLocaleRefreshSites({file,exact,patches,en,contracts});
writeFileSync(path.join(here,'locale-refresh-sites.json'),JSON.stringify(localeRefreshSites,null,2)+'\n');
writeFileSync(path.join(here,'view-sites.json'),JSON.stringify(viewSites,null,2)+'\n');
const modificationNotices=curateModificationNotices({file,patches});
writeFileSync(path.join(here,'modification-notices.json'),JSON.stringify(modificationNotices,null,2)+'\n');

// Ordering catches accidental overlap or duplicate sites during authoring.
for(const f of Object.keys(sources)){
 const ps=patches.filter(p=>p.file===f).sort((a,b)=>a.start-b.start||a.end-b.end);
 for(let i=1;i<ps.length;i++)if(ps[i].start<ps[i-1].end)throw Error(`Overlapping ${f}:${ps[i].start}`);
}
mkdirSync(here,{recursive:true});
const sort=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b,'en')));
writeFileSync(path.join(here,'en.json'),JSON.stringify(sort(en),null,2)+'\n');
writeFileSync(path.join(here,'ja.json'),JSON.stringify(sort(ja),null,2)+'\n');
writeFileSync(path.join(here,'contract.json'),JSON.stringify({schema:1,grammar:'native-vtig-markup+double-brace-named-parameters',parameters:sort(contracts)},null,2)+'\n');
writeFileSync(path.join(here,'help-catalog.json'),JSON.stringify(helpBodies,null,2)+'\n');
writeFileSync(path.join(here,'manifest.json'),JSON.stringify({
 schema:1,sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',upstream:'https://github.com/chaosforgeorg/drl',offsetUnit:'UTF-16-code-unit',license:'GPL-2.0',
 scope:'Reviewed original settings, menus, all eight help bodies, registry presentation fields, gameplay/plot/mortem messages and structured item names; separate browser and adapter diagnostics; not all DRL text',
  catalogs:{englishSha256:digest(readFileSync(path.join(here,'en.json'))),japaneseSha256:digest(readFileSync(path.join(here,'ja.json'))),helpCatalogSha256:digest(readFileSync(path.join(here,'help-catalog.json'))),registryCatalogSha256:digest(readFileSync(path.join(here,'registration-term-catalog.json'))),itemNameAspectSha256:digest(readFileSync(path.join(here,'item-name-aspects.json'))),historySitesSha256:digest(readFileSync(path.join(here,'history-sites.json')))},
 sources:Object.fromEntries(Object.entries(sources).map(([f,s])=>[f,{sha256:digest(readFileSync(path.join(root,f))),bytes:readFileSync(path.join(root,f)).length}])),parameters:sort(contracts),patches:patches.sort((a,b)=>a.file.localeCompare(b.file)||a.start-b.start||a.end-b.end)
},null,2)+'\n');
console.log(JSON.stringify({catalogIds:Object.keys(en).length,sourceFiles:Object.keys(sources).length,sourcePatches:patches.length,originalGameplayExecuted:false}));
