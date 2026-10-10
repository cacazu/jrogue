/** Explicit, reviewed original gameplay message sites. No domain text or comparisons are replaced. */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanMessageCalls} from './message-inventory.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const quote=s=>s.split(/([\x00-\x1f])/).filter(Boolean).map(p=>p.length===1&&p.charCodeAt(0)<32?`#${p.charCodeAt(0)}`:`'${p.replaceAll("'","''")}'`).join('')||"''";
export function curateGameplaySites({file,exact,catalog,patches}){
 const calls=new Map(),reviewed=[];
 const list=f=>{if(!calls.has(f))calls.set(f,scanMessageCalls(file(f),'pascal',f));return calls.get(f);};
 const at=(f,line)=>{const found=list(f).filter(c=>c.line===line);if(found.length!==1)throw Error(`Expected one message at ${f}:${line}, got ${found.length}`);return found[0];};
 const uses=(f,unit)=>{
  const source=file(f),u=source.indexOf('uses ',source.indexOf('implementation'));
  if(u<0)throw Error(`No implementation uses ${f}`);
  patches.push({file:f,start:u+5,end:u+5,original:'',replacement:`${unit}, `,id:null,kind:'bridge-support'});
 };
 function replace(c,replacement,id){patches.push({file:c.file,start:c.start,end:c.end,original:c.original,replacement,id,kind:'semantic-message'});reviewed.push({key:c.key,id,source:c.original,replacement});}
 const being='src/dfbeing.pas';
 const beingInterface=file(being).indexOf('uses ');
 patches.push({file:being,start:beingInterface+5,end:beingInterface+5,original:'',replacement:'drlsemantictext, ',id:null,kind:'bridge-support'});
 uses(being,'drlsemanticregistry');
 exact(being,'procedure Emote( const aPlayerText, aBeingText : AnsiString; const aParams : array of Const );',`procedure Emote( const aPlayerText, aBeingText : AnsiString; const aParams : array of Const );\r\n    function PresentationName(aKnown: Boolean; aSentence: Boolean = False): AnsiString;\r\n    function SemanticFail(const aID, aEnglish: AnsiString; const aParams: array of TDRLTextParam): Boolean;\r\n    function SemanticSuccess(const aID, aEnglish: AnsiString; const aParams: array of TDRLTextParam; aCost: DWord = 0): Boolean;\r\n    procedure SemanticEmote(const aPlayerID, aPlayerEnglish, aBeingID, aBeingEnglish: AnsiString; const aParams: array of TDRLTextParam);\r\n    function SemanticSuccessEmote(const aPlayerID, aPlayerEnglish, aBeingID, aBeingEnglish: AnsiString; const aParams: array of TDRLTextParam; aCost: DWord = 0): Boolean;`);
 exact(being,'function TBeing.Fail ( const aText: AnsiString; const aParams: array of const ): Boolean;',readFileSync(path.join(here,'being-semantic-methods.pas'),'utf8')+'\r\nfunction TBeing.Fail ( const aText: AnsiString; const aParams: array of const ): Boolean;');
 for(const [suffix,english]of [['known','the {{name}}'],['known-sentence','The {{name}}'],['indefinite-a','a {{name}}'],['indefinite-an','an {{name}}'],['indefinite-a-sentence','A {{name}}'],['indefinite-an-sentence','An {{name}}']])catalog('entity.name.'+suffix,english,'{{name}}',{name:'string'});
 for(const [suffix,english,japanese]of [['ground-feature','There is a {{item}} here.','ここには{{item}}がある。'],['ground-items','There are {{item}} lying here.','ここには{{item}}が落ちている。'],['ground-item','There is {{item}} lying here.','ここには{{item}}が落ちている。']])catalog('message.'+suffix,english,japanese,{item:'string'});
 replace(at('src/dfplayer.pas',387),'IO.Msg(iLevel.Item[FPosition].PresentationExtName(True))','message.ground-item');
 const staticRows={
  'src/dfbeing.pas':[
   [605,'already-using','すでに使っている！'],[607,'item-no-longer-owned','もう持っていない！'],[620,'target-invalid','有効な標的がない！'],[622,'item-kind-no-longer-owned','その種類のアイテムはもう持っていない！'],
   [681,'weapon-swap-instant','武器を瞬時に持ち替えた！'],[682,'weapon-swap','武器を持ち替えた。'],[729,'drop-melts','落としたアイテムが溶けた！'],[734,'floor-no-room','床に置く場所がない。'],
   [812,'reload-no-weapon','装填できる武器を持っていない。'],[814,'reload-manual-forbidden','この武器は手動で装填できない！'],[815,'reload-unnecessary','この武器は装填する必要がない！'],
   [853,'reload-dual-impossible','二丁同時に装填できない。'],[866,'reload-guns-full','銃はすでに装填されている。'],[868,'reload-no-ammo-question','装填できない。弾切れか？'],[875,'reload-no-weapon','装填できる武器を持っていない。'],[889,'reload-no-special-mode','この武器には特殊な装填モードがない。'],
   [980,'ground-empty','ここには何もない！'],[981,'pickup-ground-empty','ここには拾えるものがない！'],[1001,'no-time-to-waste','ぐずぐずしていられない。'],[1005,'target-invalid','有効な標的がない！'],
   [1023,'inventory-no-room','バックパックに十分な空きがない。'],[1026,'inventory-no-room','バックパックに十分な空きがない。'],[1158,'out-of-range','射程外！'],
   [1198,'unload-item-forbidden','このアイテムから弾を抜くことはできない！'],[1199,'unload-weapon-forbidden','この武器から弾を抜くことはできない！'],[1200,'weapon-uses-no-ammo','この武器は弾薬を使わない！'],[1201,'unload-weapon-empty','武器は装填されていない！'],
   [2489,'dodge','かわした！'],[2496,'boom','ドカン！'],[2533,'dodge','かわした！'],[2582,'dodge','かわした！']
  ],
  'src/dflevel.pas':[[627,'valuable-feeling','ここには本当に価値のあるものがある気がする！'],[1327,'relatively-safe','これで少しは安全になった気がする。'],[1443,'just-in-time','間一髪だった！']],
  'src/dfplayer.pas':[[371,'cannot-act-short','できない！'],[399,'stop','止まった。'],[451,'no-monsters-in-sight','見える範囲に怪物はいない。'],[469,'no-items-in-sight','見える範囲にアイテムはない。'],[557,'player-dies','死んでしまった……']],
  'src/drlbase.pas':[
   [518,'multi-move-enemies','敵がいるので連続移動できない。'],[556,'unknown-command','不明な操作。{^{$input_menu}} でメニューとヘルプを開ける。'],[615,'nothing-to-act-on','ここには操作できるものがない。'],[640,'way-blocked','何かが邪魔をしている！'],[646,'cannot-do-that','それはできない！'],[660,'cannot-act-short','できない！'],[688,'bump-wall','壁にぶつかった。'],
   [731,'weapon-missing','武器を持っていない。'],[737,'fire-no-alternate','この武器には別の射撃モードがない'],[759,'ranged-weapon-missing','遠距離武器を持っていない。'],[793,'weapon-empty','武器は弾切れだ。'],[816,'out-of-range','射程外！'],[854,'target-invalid-period','有効な標的がない。'],[919,'nothing-to-swap','持ち替えるものがない！'],[930,'ground-nothing-usable','地面には使えるものがない！'],
   [1037,'cannot-reach','そこへは行けない！'],[1043,'path-unknown','そこへの行き方がわからない！'],[1277,'multi-move-enemies','敵がいるので連続移動できない。'],[1298,'unknown-command','不明な操作。{^{$input_menu}} でメニューとヘルプを開ける。'],[1455,'explosion-above','上で巨大な爆発が聞こえた！'],[1698,'game-loaded','ゲームを読み込んだ。']
  ],
  'src/drlhudviews.pas':[[465,'suicide-constructive','もっと建設的な自殺の方法を探そう。'],[549,'weapons-none','武器を一つも持っていない！'],[550,'weapons-no-other','ほかの武器を持っていない！']],
  'src/drlingamemenuview.pas':[[112,'quit-declined','そうか。それなら留まって、運命を受け入れろ……']],
  'src/drlio.pas':[[383,'explosion-heard','爆発が聞こえた！']]
 };
 for(const [f,rows]of Object.entries(staticRows)){
  // TBeing's interface imports the typed contract for its public signatures;
  // FPC rejects importing the same unit again in implementation uses.
  if(f!==being)uses(f,'drlsemantictext');
  for(const [line,suffix,japanese]of rows){
   const c=at(f,line);if(c.classification!=='static_literal')throw Error(`Not static message ${c.key}`);
   const english=c.arguments[0].strings[0].value,id='message.'+suffix;catalog(id,english,japanese);
   let replacement;
   if(c.callee.toLowerCase().endsWith('fail')||c.callee==='Success'){
    if(c.arguments[1]?.source!=='[]')throw Error(`Unexpected static action arguments ${c.key}`);
    const callee=c.callee.replace('Fail','SemanticFail').replace('Success','SemanticSuccess');
    replacement=`${callee}(${quote(id)}, ${quote(english)}, []${c.arguments[2]?', '+c.arguments[2].source:''})`;
   }else replacement=`IO.Msg(DRLText(${quote(id)}, ${quote(english)}))`;
   replace(c,replacement,id);
  }
 }
 // Snapshot display metadata before original gameplay can destroy an item. Original English
 // snapshots are retained too; no prototype field or hook argument changes.
 exact(being,'iAmmoName : AnsiString;','iAmmoName : AnsiString;\r\n    iAmmoDisplayName : AnsiString;');
 exact(being,'iAmmoName := iItem.Name;','iAmmoName := iItem.Name;\r\n  iAmmoDisplayName := DRLRegistryText(\'item\', iItem.ID, \'base_game\', \'name\', iAmmoName);');
 exact(being,'function TBeing.ActionPickup( aApplyCost : Boolean = True ) : Boolean;\r\nvar iAmount  : byte;\r\n    iItem   : TItem;\r\n    iName   : AnsiString;', 'function TBeing.ActionPickup( aApplyCost : Boolean = True ) : Boolean;\r\nvar iAmount  : byte;\r\n    iItem   : TItem;\r\n    iName   : AnsiString;\r\n    iDisplayName : AnsiString;');
 exact(being,'iName := iItem.Name;\r\n      iCount :=','iName := iItem.Name;\r\n      iDisplayName := DRLRegistryText(\'item\', iItem.ID, \'base_game\', \'name\', iName);\r\n      iCount :=');
 exact(being,'function TBeing.ActionUnLoad ( aItem : TItem; aDisassembleID : AnsiString = \'\' ) : Boolean;\r\nvar iAmount : Integer;\r\n    iName   : AnsiString;', 'function TBeing.ActionUnLoad ( aItem : TItem; aDisassembleID : AnsiString = \'\' ) : Boolean;\r\nvar iAmount : Integer;\r\n    iName   : AnsiString;\r\n    iDisplayName : AnsiString;');
 for(let n=0;n<2;n++)exact(being,'iName   := aItem.Name;','iName   := aItem.Name;\r\n    iDisplayName := DRLRegistryText(\'item\', aItem.ID, \'base_game\', \'name\', iName);',null,n);
 const term=(variable)=>`DRLRegistryText('item', ${variable}.ID, 'base_game', 'name', ${variable}.Name)`;
 const formattedRows=[
  [being,624,'quickslot-unassigned','Quickslot {{slot}} is unassigned!','クイックスロット {{slot}} は未割り当て！',{slot:['integer','aIndex']}],
  [being,636,'weapon-already-held','You already have {{item}} in your hands.','すでに{{item}}を手に持っている。',{item:['string','Inv.Slot[efWeapon].PresentationName(True)']}],
  [being,655,'weapon-not-owned',"You don't have a {{item}}!",'{{item}}を持っていない！',{item:['string',"DRLRegistryText('item', aWeaponID, 'base_game', 'name', AnsiString(LuaSystem.Get(['items', aWeaponID, 'name'])))"]}],
  [being,664,'weapon-prepare','You prepare the {{item}}!','{{item}}を予備に用意した！',{item:['string',term('iWeapon')]}],
  [being,665,'weapon-prepare-instant','You prepare the {{item}} instantly!','{{item}}を瞬時に予備へ用意した！',{item:['string',term('iWeapon')]}],
  [being,720,'item-dropped','You dropped {{item}}.','{{item}}を落とした。',{item:['string','aItem.PresentationName(False)']}],
  [being,727,'item-dropped','You dropped {{item}}.','{{item}}を落とした。',{item:['string','aItem.PresentationName(False)']}],
  [being,816,'weapon-already-loaded','Your {{item}} is already loaded.','{{item}}はすでに装填されている。',{item:['string',term('iWeapon')]}],
  [being,826,'weapon-no-more-ammo','You have no more ammo for the {{item}}!','{{item}}用の弾薬がもうない！',{item:['string',term('iWeapon')]}],
  [being,843,'ammo-pack-depleted','Your {{item}} is depleted.','{{item}}を使い切った。',{item:['string','iAmmoDisplayName']}],
  [being,1022,'item-stack-found','You found {{count}} of {{item}}.','{{item}}を {{count}} 個見つけた。',{count:['integer','iCount'],item:['string','iDisplayName']}],
  [being,1030,'item-picked-up','You picked up {{item}}.','{{item}}を拾った。',{item:['string','iItem.PresentationName(False)']}],
  [being,1195,'item-disassembled','You disassemble the {{item}}.','{{item}}を分解した。',{item:['string','iDisplayName']}],
  [being,1210,'item-fully-unloaded','You fully unload the {{item}}.','{{item}}の弾をすべて抜いた。',{item:['string','iDisplayName']}],
  [being,1212,'item-unload-no-room',"You don't have enough room in your backpack to unload the {{item}}.",'{{item}}の弾を抜くには、バックパックの空きが足りない。',{item:['string','iDisplayName']}],
  [being,1214,'item-partly-unloaded','You partially unload the {{item}}.','{{item}}の弾を一部抜いた。',{item:['string','iDisplayName']}],
  ['src/dflevel.pas',1434,'nuke-seconds','Warning! Explosion in {{count}} seconds!','警告！　あと {{count}} 秒で爆発！',{count:['integer','Player.NukeActivated div 10']}],
  ['src/dflevel.pas',1435,'nuke-seconds','Warning! Explosion in {{count}} seconds!','警告！　あと {{count}} 秒で爆発！',{count:['integer','Player.NukeActivated div 10']}],
  ['src/dflevel.pas',1436,'nuke-minutes','Warning! Explosion in {{count}} minutes!','警告！　あと {{count}} 分で爆発！',{count:['integer','Player.NukeActivated div 600']}],
  ['src/dfplayer.pas',253,'level-advanced','You advance to level {{level}}!','レベル {{level}} に上がった！',{level:['integer','FExpLevel']}],
  ['src/drlbase.pas',794,'weapon-not-enough-to-fire',"You don't have enough ammo to fire the {{item}}!",'{{item}}を撃つだけの弾薬がない！',{item:['string',term('iItem')]}]
 ];
 for(const [f,line,suffix,english,japanese,bindings]of formattedRows){
  const c=at(f,line),id='message.'+suffix;
  if(c.classification!=='formatted_or_composed')throw Error(`Not formatted message ${c.key}`);
  const contracts=Object.fromEntries(Object.entries(bindings).map(([name,[kind]])=>[name,kind]));catalog(id,english,japanese,contracts);
  const parameters=Object.entries(bindings).map(([name,[kind,value]])=>`DRL${kind==='integer'?'Integer':'String'}Param(${quote(name)}, ${value})`);
  let replacement;
  if(c.callee==='Fail'||c.callee==='Success')replacement=`${c.callee==='Fail'?'SemanticFail':'SemanticSuccess'}(${quote(id)}, ${quote(english)}, [${parameters.join(', ')}]${c.arguments[2]?', '+c.arguments[2].source:''})`;
  else replacement=`IO.Msg(DRLText(${quote(id)}, ${quote(english)}, [${parameters.join(', ')}]))`;
  replace(c,replacement,id);
 }
 uses('src/drlinventory.pas','drlsemantictext');
 uses('src/drlbase.pas','drlsemanticregistry');
 catalog('message.wear-wield','You wear/wield : {{item}}','身につけた／構えた：{{item}}',{item:'string'});
 for(const line of [262,275])replace(at('src/drlinventory.pas',line),"IO.Msg(DRLText('message.wear-wield', 'You wear/wield : {{item}}', [DRLStringParam('item', aItem.PresentationName(False))]))",'message.wear-wield');
 exact(being,'iOldName   : AnsiString;','iOldName   : AnsiString;\r\n    iOldDisplayName : AnsiString;');
 exact(being,'iOldName   := \'\';','iOldName   := \'\';\r\n  iOldDisplayName := \'\';');
 exact(being,'iOldName := iOldItem.GetName(false);','iOldName := iOldItem.GetName(false);\r\n              iOldDisplayName := iOldItem.PresentationNameValue(iOldName, False);');
 const emoteRows=[
  [862,'reload-dual','You dualreload your guns!','銃を二丁同時に装填した！','{{subject}} dualreloads his guns.','{{subject}}が銃を二丁同時に装填した。',{}],
  [1077,'lever-pull','You pull the lever...','レバーを引いた……','{{subject}} pulls the lever...','{{subject}}がレバーを引いた……',{}],
  [1081,'item-use-ground','You use {{item}} from the ground.','地面にある{{item}}を使った。','{{subject}} uses {{item}}.','{{subject}}が{{item}}を使った。',{item:'aItem.PresentationName(False, True)'}],
  [1103,'item-equip-ground','You equip {{item}} from the ground.','地面にある{{item}}を装備した。','{{subject}} equips {{item}}.','{{subject}}が{{item}}を装備した。',{item:'aItem.PresentationName(False)'}],
  [1115,'item-swap-ground','You swap {{item}} from the ground.','地面にある{{item}}と持ち替えた。','{{subject}} swaps {{item}}.','{{subject}}が{{item}}と持ち替えた。',{item:'aItem.PresentationName(False)'}],
  [1121,'item-use','You use {{item}}.','{{item}}を使った。','{{subject}} uses {{item}}.','{{subject}}が{{item}}を使った。',{item:'aItem.PresentationName(False, True)'}],
  [1142,'old-item-drop-destroyed','You drop {{item}} and it is destroyed!','{{item}}を落とし、壊れてしまった！','{{subject}} ','{{subject}}',{item:'iOldDisplayName'}],
  [1145,'old-item-stored','You put {{item}} in inventory.','{{item}}を所持品に入れた。','{{subject}} ','{{subject}}',{item:'iOldDisplayName'}],
  [1157,'item-use','You use {{item}}.','{{item}}を使った。','{{subject}} uses {{item}}.','{{subject}}が{{item}}を使った。',{item:'aItem.PresentationName(False, True)'}]
 ];
 for(const [line,suffix,english,japanese,observerEnglish,observerJapanese,bindings]of emoteRows){
  const c=at(being,line),id='message.'+suffix+'.player',observerID='message.'+suffix+'.observer';
  const params=Object.fromEntries(Object.keys(bindings).map(name=>[name,'string']));
  catalog(id,english,japanese,params);
  const observerParams=Object.fromEntries(Object.keys(bindings).filter(name=>observerEnglish.includes(`{{${name}}}`)).map(name=>[name,'string']));
  catalog(observerID,observerEnglish,observerJapanese,{subject:'string',...observerParams});
  const values=Object.entries(bindings).map(([name,value])=>`DRLStringParam(${quote(name)}, ${value})`);
  const callee=c.callee==='Success'?'SemanticSuccessEmote':'SemanticEmote';
  replace(c,`${callee}(${quote(id)}, ${quote(english)}, ${quote(observerID)}, ${quote(observerEnglish)}, [${values.join(', ')}]${c.arguments[3]?', '+c.arguments[3].source:''})`,id);
  reviewed.at(-1).observerId=observerID;
 }
 // Reload's player has four complete messages, selected by the same captured booleans.
 // Observer text never had the player's "quickly" fragment; keep that distinction.
 const reloadVariants=[
  ['normal','You reload the {{item}}.','{{item}}を装填した。'],
  ['quick','You quickly reload the {{item}}.','{{item}}を素早く装填した。'],
  ['ground','You reload the {{item}} from the ground.','地面の弾薬で{{item}}を装填した。'],
  ['quick-ground','You quickly reload the {{item}} from the ground.','地面の弾薬で{{item}}を素早く装填した。']
 ];
 for(const [suffix,english,japanese]of reloadVariants)catalog('message.reload.'+suffix+'.player',english,japanese,{item:'string'});
 catalog('message.reload.normal.observer','{{subject}} reloads his {{item}}.','{{subject}}が{{item}}を装填した。',{subject:'string',item:'string'});
 catalog('message.reload.ground.observer','{{subject}} reloads his {{item}} from the ground.','{{subject}}が地面の弾薬で{{item}}を装填した。',{subject:'string',item:'string'});
 const choose=(values)=>`IIf(iIsPack, IIf(iIsGround, ${quote(values[3])}, ${quote(values[1])}), IIf(iIsGround, ${quote(values[2])}, ${quote(values[0])}))`;
 const playerID=choose(reloadVariants.map(([suffix])=>'message.reload.'+suffix+'.player'));
 const playerEnglish=choose(reloadVariants.map(([,english])=>english));
 const observerID="IIf(iIsGround, 'message.reload.ground.observer', 'message.reload.normal.observer')";
 const observerEnglish="IIf(iIsGround, '{{subject}} reloads his {{item}} from the ground.', '{{subject}} reloads his {{item}}.')";
 replace(at(being,839),`SemanticEmote(${playerID}, ${playerEnglish}, ${observerID}, ${observerEnglish}, [DRLStringParam('item', ${term('iWeapon')})])`,'message.reload.normal.player');
 reviewed.at(-1).variantIds=reloadVariants.map(([suffix])=>'message.reload.'+suffix+'.player').concat(['message.reload.normal.observer','message.reload.ground.observer']);
 return reviewed;
}
