/** Reviewed startup/target/tutorial producers and three presentation consumers.
 * Source hashes and exact original spans gate every change. No simulation or RNG
 * producer is evaluated here, and no rendered English string is a lookup key.
 */
import {createHash} from 'node:crypto';
import {scanSource} from '../port/tools/inventory-texts.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const pascalString=s=>`'${s.replaceAll("'","''")}'`;
const luaString=s=>JSON.stringify(s);
export const runtimePathSourcePins={
 'src/drlbase.pas':'5e8c6007bbf6ae53c371a150d2f3d1d16ed1a3844ffa65ec05f974aa2824df57',
 'src/drlhudviews.pas':'77ac611f0ae43331b5840d33e044b0fb255950991aadeacfcc7dcd9dbff6b7b3',
 'src/drlplayerview.pas':'e24c72e29c5ea701af06bfb2c96bf43f52b3b2b5457b0191535010de2d6789e6',
 'src/dfdata.pas':'346395d359820361e1ce7708c169c9404b0f6614ef6634f889dbd33f05f955ae',
 'bin/data/drl/main.lua':'ad11f523e3d92c03b2229fa0f5d56def89df885a6eb87e87febb2f4e6ee5d364',
 'bin/data/drl/levels/intro.lua':'0b2bc16f7302e1c435a79ee31ce825da2edfc8dc88bcbbe27bb5b4d3d122fbdc'
};
const main='bin/data/drl/main.lua',intro='bin/data/drl/levels/intro.lua',base='src/drlbase.pas',hud='src/drlhudviews.pas',player='src/drlplayerview.pas';
const targetTitles=[
 [820,27285,27306,'view.target.fire','Choose fire target:','射撃対象を選択:'],
 [826,27460,27490,'view.target.chain.initial','Alternate fire ({Ginitial}):','特殊射撃（{G初動}）:'],
 [827,27527,27557,'view.target.chain.warming','Alternate fire ({Ywarming}):','特殊射撃（{Y回転上昇}）:'],
 [828,27594,27621,'view.target.chain.full','Alternate fire ({Rfull}):','特殊射撃（{R最大回転}）:'],
 [873,28920,28936,'view.target.use','Choose target:','対象を選択:']
];
const tutorialHints=[
 [226,6596,6689,'move-controller','Hint : hold left joy for direction, press <{!{$controller_gameplay_move}}> to confirm move!','ヒント：左スティックを倒して方向を選び、<{!{$controller_gameplay_move}}>で移動を確定！'],
 [228,6717,6768,'move-keyboard','Hint : use {!numpad} or {!arrows} to move around!','ヒント：{!テンキー}または{!矢印キー}で移動！'],
 [231,6818,6873,'menu-help','Hint : press <{!{$input_menu}}> for menu and {!Help}!','ヒント：<{!{$input_menu}}>でメニューを開き、{!ヘルプ}を参照！'],
 [233,6915,6971,'hide-hints','Hint : you can turn off hints in the {!Settings} menu!','ヒント：{!設定}メニューでヒントを非表示にできます！'],
 [236,7055,7109,'fire','Hint : press <{!{$input_fire}}> to fire your weapon!','ヒント：<{!{$input_fire}}>で武器を撃つ！'],
 [239,7193,7251,'reload','Hint : press <{!{$input_reload}}> to reload your weapon!','ヒント：<{!{$input_reload}}>で武器をリロード！'],
 [243,7326,7391,'pickup','Hint : press <{!{$input_pickup}}> to get items from the ground!','ヒント：<{!{$input_pickup}}>で床のアイテムを拾う！'],
 [247,7492,7547,'stairs','Hint : press <{!{$input_action}}> to move downstairs!','ヒント：<{!{$input_action}}>で階段を下りる！']
];
const logoBoxOriginal='[[{rDRL version {R]]..VERSION_MODULE..[[}\nby {RKornel Kisielewicz}\ngraphics by {RDerek Yu}\nand {RLukasz Sliwinski}}]]';
const logoTextOriginal=`[[{rDRL Engine  : {y]]..VERSION_ENGINE..[[}
Add. coding : {ytehtmi}, {yGame Hunter}, {yshark20061}, {yadd} and {ybrisbang}
Music tracks: {ySonic Clang} (remixes), {ySimon Volpert} (special levels)
HQ SFX      : {yPer Kristian Risvik}
Major changes since last version (see {yversion.txt} for full list)
{R  * tons of UI and UX changes, a lot new visual effects!
  * new L4 special levels by brisbang, two new environment fluids!
  * enrage mechanic, infighting, more nightmare variants, tons little stuff!
  
{B facebook.com/ChaosForge  x.com/chaosforge_org  discord.gg/jupiterhell}
                                       Press <{y{$input_ok}}> to continue...}
]]`;
const firstRunOriginal=`[[{yWelcome to {RD**m the Roguelike}!

You are running DRL for the first time. I hope you will find this roguelike game as enjoyable as it was for me to write it.

This game is in active development (again?), and as such please be always sure that you have the most recent version, for bugs are fixed, new features appear, and the game becomes better at every iteration. You can find the lastest version on DRL website:

{Bhttps://drl.chaosforge.org/}

Also, if you enjoy this game, join the Discord and/or the forums:

{Bhttp://discord.gg/jupiterhell}
{Bhttp://forum.chaosforge.org/}

You can also follow me on X ({B@chaosforge_org}/{B@epyoncf}).

Press <{L{$input_ok}}> to continue...}
]]`;
const startupGetters=[
 {line:644,start:22628,end:22710,id:'startup.motd',original:'"{BSupport the game by buying the {LDRL expansion} at {Ljupiterhellclassic.com}!}"',japanese:'{B{Ljupiterhellclassic.com}で{LDRL 拡張版}を購入して、ゲームを支援してください！}'},
 {line:653,start:22800,end:22917,id:'startup.logo-box',original:logoBoxOriginal,version:'VERSION_MODULE',japanese:'{rDRL バージョン {R{{version}}}\n制作：{RKornel Kisielewicz}\nグラフィック：{RDerek Yu}\nおよび {RLukasz Sliwinski}}'},
 {line:661,start:22958,end:23620,id:'startup.logo-text',original:logoTextOriginal,version:'VERSION_ENGINE',japanese:`{rDRL エンジン : {y{{version}}}
追加コード：{ytehtmi}、{yGame Hunter}、{yshark20061}、{yadd}、{ybrisbang}
音楽：{ySonic Clang}（リミックス）、{ySimon Volpert}（特別フロア）
高品質効果音：{yPer Kristian Risvik}
前バージョンからの主な変更（全一覧は{yversion.txt}を参照）
{R  * UI と操作性を大幅に変更し、多くの新しい視覚効果を追加！
  * brisbang 制作の新しい L4 特別フロアと、2 種類の新しい環境液体！
  * 激怒の仕組み、同士討ち、ナイトメアの新種など、細かな変更も多数！
  
{B facebook.com/ChaosForge  x.com/chaosforge_org  discord.gg/jupiterhell}
                                       <{y{$input_ok}}>で続行...}
`},
 {line:703,start:24162,end:24852,id:'startup.first-run',original:firstRunOriginal,japanese:`{y{RD**m the Roguelike}へようこそ！

DRLを初めて起動しました。私がこのローグライクを作って楽しんだのと同じくらい、皆さんにも楽しんでもらえれば幸いです。

このゲームは（再び？）活発に開発中です。バグを修正し、新機能を追加して、更新のたびに改良しているので、必ず最新バージョンを使ってください。最新版は DRL のウェブサイトで入手できます：

{Bhttps://drl.chaosforge.org/}

ゲームを楽しめたら、Discord やフォーラムにも参加してください：

{Bhttp://discord.gg/jupiterhell}
{Bhttp://forum.chaosforge.org/}

X（{B@chaosforge_org}/{B@epyoncf}）でも私をフォローできます。

<{L{$input_ok}}>で続行...}
`}
];
export const equipmentSlotTerms=[
 ['efTorso','mortem.slot.armor','[ Armor      ]'],
 ['efWeapon','mortem.slot.weapon','[ Weapon     ]'],
 ['efBoots','mortem.slot.boots','[ Boots      ]'],
 ['efWeapon2','mortem.slot.prepared','[ Prepared   ]'],
 ['efRelic','mortem.slot.relic','[ Relic      ]']
];
function slotHelper(){
 return `function DRLViewSlotName(aSlot: TEqSlot; const aEnglish: AnsiString): AnsiString;
begin
  case aSlot of
${equipmentSlotTerms.map(([slot,id,english])=>`    ${slot}: if aEnglish = ${pascalString(english)} then\n      Exit(DRLText(${pascalString(id)}, aEnglish));`).join('\n')}
  end;
  Exit(aEnglish);
end;
`;
}
export function runtimeLuaTemplate(original,version){
 const ts=scanSource(original,'lua').tokens;
 if(version){
  if(ts.length!==5||ts[0].kind!=='string'||ts[1].raw!=='..'||ts[2].raw!==version||ts[3].raw!=='..'||ts[4].kind!=='string')throw Error('Runtime startup version expression changed');
  return ts[0].value+'{{version}}'+ts[4].value;
 }
 if(ts.length!==1||ts[0].kind!=='string')throw Error('Runtime startup literal changed');
 return ts[0].value;
}
export function curateRuntimePathSites({file,catalog,patches,viewRecords}){
 const sources={};for(const [f,pin]of Object.entries(runtimePathSourcePins)){const s=file(f);if(sha(s)!==pin)throw Error(`Runtime-path source hash changed: ${f}`);sources[f]={sha256:pin};}
 const entries=[],projections=[],requiredUnits={};
 function add(record){
  const source=file(record.file);
  if(source.slice(record.start,record.end)!==record.original||source.slice(0,record.start).split('\n').length!==record.line)throw Error(`Runtime-path expression changed: ${record.file}:${record.line}`);
  if(patches.some(p=>p.file===record.file&&p.start<record.end&&p.end>record.start))throw Error(`Runtime-path source overlap: ${record.file}:${record.line}`);
  const p={file:record.file,start:record.start,end:record.end,original:record.original,replacement:record.replacement,id:record.id??null,kind:record.id?'semantic-runtime-path':'runtime-path-projection'};
  patches.push(p);const report={...record,sourceSha256:sources[record.file].sha256,originalExpressionSha256:sha(record.original)};
  if(record.id){catalog(record.id,record.english,record.japanese,record.parameters??{});entries.push(report);}else projections.push(report);
 }
 for(const [line,start,end,id,english,japanese]of targetTitles){
  const original=pascalString(english);
  add({file:base,line,start,end,id,english,japanese,parameters:{},original,replacement:`DRLText(${pascalString(id)}, ${original})`,role:'target-title'});
 }
 for(const row of startupGetters){
  const english=runtimeLuaTemplate(row.original,row.version),parameters=row.version?{version:'string'}:{},args=row.version?`{{name="version",kind="string",value=${row.version}}}`:'{}';
  add({...row,file:main,english,parameters,replacement:`ui.semantic_text(${luaString(row.id)}, ${luaString(english)}, ${args})`,role:'startup-getter'});
 }
 for(const [line,start,end,suffix,english,japanese]of tutorialHints){
  const id='message.tutorial.intro.'+suffix,original=luaString(english);
  add({file:intro,line,start,end,id,english,japanese,parameters:{},original,replacement:`ui.semantic_text(${luaString(id)}, ${original}, {})`,role:'tutorial-hint'});
 }
 const slotOriginal='iEntry.Name  := SlotName( iSlot );';
 add({file:player,line:803,start:25733,end:25767,original:slotOriginal,replacement:'iEntry.Name  := DRLViewSlotName(iSlot, SlotName(iSlot));',role:'equipment-empty-slot',catalogIds:equipmentSlotTerms.map(r=>r[1])});
 const descOriginal='IO.HintOverlay := FArray[ FIndex ].Description;';
 add({file:hud,line:562,start:15421,end:15468,original:descOriginal,replacement:'IO.HintOverlay := FArray[ FIndex ].PresentationDescription;',role:'scroll-swap-item-description',catalogIds:[]});
 // This parameter is inside the already-reviewed label expression, so amend that
 // explicit ID/site rather than create overlapping source substitutions.
 const feeling=patches.filter(p=>p.file===player&&p.id==='view.level.feeling');
 const expectedOriginal="Format( '  Level feel   : {!%s}', [DRL.Level.Feeling] )";
 const expectedReplacement="DRLText('view.level.feeling', '  Level feel   : {!{{feeling}}}', [DRLStringParam('feeling', DRL.Level.Feeling)])";
 if(feeling.length!==1||feeling[0].start!==34801||feeling[0].end!==34856||feeling[0].original!==expectedOriginal||feeling[0].replacement!==expectedReplacement)throw Error('Runtime character feeling semantic parent changed');
 feeling[0].replacement="DRLText('view.level.feeling', '  Level feel   : {!{{feeling}}}', [DRLStringParam('feeling', DRLRepeatSemanticFeeling(DRL.Level.Feeling))])";
 if(viewRecords){
  const views=viewRecords.filter(r=>r.file===player&&r.id==='view.level.feeling');
  if(views.length!==1||views[0].original!==expectedOriginal||views[0].replacement!==expectedReplacement||views[0].bindings.length!==1||views[0].bindings[0].originalExpression!=='DRL.Level.Feeling')throw Error('Runtime character feeling view metadata changed');
  views[0].replacement=feeling[0].replacement;
  views[0].bindings[0].presentationExpression='DRLRepeatSemanticFeeling(DRL.Level.Feeling)';
 }
 projections.push({file:player,line:1035,start:34801,end:34856,original:expectedOriginal,replacement:feeling[0].replacement,role:'character-semantic-feeling',catalogIds:['view.level.feeling'],parentPatchId:feeling[0].id,sourceSha256:sources[player].sha256,originalExpressionSha256:sha(expectedOriginal)});
 const source=file(player),uses=source.indexOf('uses ',source.indexOf('implementation')),at=source.indexOf(';',uses)+1;
 if(uses<0||at<=0||source.includes('DRLViewSlotName'))throw Error('Runtime equipment slot helper injection changed');
 for(const [slot,,english]of equipmentSlotTerms)if(!new RegExp(`${slot}\\s*:\\s*Exit\\(${pascalString(english).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\);`).test(file('src/dfdata.pas')))throw Error(`Runtime original slot guard changed: ${slot}`);
 const newline=source.includes('\r\n')?'\r\n':'\n',helper=slotHelper();
 patches.push({file:player,start:at,end:at,original:'',replacement:newline+newline+helper.replaceAll('\n',newline)+newline,id:null,kind:'runtime-path-enum-helper'});
 requiredUnits[player]=['drlsemantictext','drlsemanticfeelings'];requiredUnits[base]=['drlsemantictext'];
 if(entries.length!==17||projections.length!==3)throw Error('Runtime path accounting changed');
 return {schema:1,sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',sources,entries,projections,requiredUnits,slotHelper:helper,counts:{newCatalogIds:17,targetTitles:5,startupGetters:4,tutorialHints:8,presentationProjections:3,existingSlotIds:5,addedProducerPatches:19,amendedExistingSemanticPatches:1,helperPatches:1},originalDomainFieldsAndSaveStringsPreserved:true,asciiLogoAndVersionValuesPreserved:true,fullGameLocalizationComplete:false,nativeCompiled:false,browserExecuted:false};
}
