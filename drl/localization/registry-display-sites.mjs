/** Reviewed presentation consumers of original DRL registries (GPL-2.0).
 * Proposals only; this module never writes upstream, catalogs, overlays or native code.
 * Baseline: 0_10_11a, a6f965072b3a25b768c91dbced00367f1b57d865.
 * Resolve by category + original registry ID + scope + actual field + exact English.
 */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {buildPascalViewTranslations} from './pascal-view-translations.mjs';
import {tokens as templateTokens,render} from './render.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const digest=value=>createHash('sha256').update(value).digest('hex');
const pas=value=>value.split(/([\x00-\x1f])/).filter(Boolean).map(p=>p.length===1&&p.charCodeAt(0)<32?`#${p.charCodeAt(0)}`:`'${p.replaceAll("'","''")}'`).join('')||"''";
export const registryDisplaySourceCommit='a6f965072b3a25b768c91dbced00367f1b57d865';
export const registryDisplaySourceLocks=Object.freeze({...Object.fromEntries([
 ['dfhof',39412,'3808caeaaa8d530cd4ec8b66d2b56a2b588836a7326b00da7e1537c2794a667d'],
 ['drlmainmenuview',35597,'ede8d5958854ab375e117086cccb35c7d3bc6d4bbbc0830b8182b53ec5a5066e'],
 ['drlassemblyview',2827,'21fe0d0e8cab466bf472fbc24c455e81c491456a723c089934fd76258310ea32'],
 ['drlmoreview',14119,'e2b31d029fb121a3308a7f4cb72ad8ec5251cc79dabdaf3adc5b39d0b5b0556b'],
 ['drlplayerview',39049,'e24c72e29c5ea701af06bfb2c96bf43f52b3b2b5457b0191535010de2d6789e6'],
 ['drlio',49187,'a0bb570acb545fad8ff2e2acc178a7005de39cc0b7457a900ef5f4b8b18bdd00'],
 ['drlgfxio',41931,'3db1831617fd0cec37e2df59daa635827f5287099b772a80aeccebc5c8298e25'],
 ['drlbase',59189,'5e8c6007bbf6ae53c371a150d2f3d1d16ed1a3844ffa65ec05f974aa2824df57'],
 ['dfthing',11921,'be911d566879e1791a18845539ebdb95a64a8c6d778bb755c46e5337bb161878'],
 ['dfitem',28166,'63b090179725a2fae0cdb2a999dee4e297fa4737e0456bf33e2535732b2e0fae'],
 ['drlperk',10053,'81f3b2f98029b1ba73806898ad1e20d7b273c0312f0c0434ba66395f30f6de0b'],
 ['dfdata',31417,'346395d359820361e1ce7708c169c9404b0f6614ef6634f889dbd33f05f955ae'],
].map(([base,bytes,sha256])=>[`src/${base}.pas`,{bytes,sha256}])),
 'bin/data/drl/main.lua':{bytes:29807,sha256:'ad11f523e3d92c03b2229fa0f5d56def89df885a6eb87e87febb2f4e6ee5d364'}});

const proposals=[];
function registry(base,line,original,category,registryIdExpression,field,options={}){
 const englishExpression=options.englishExpression??original;
 proposals.push({file:`src/${base}.pas`,line,original,
  replacement:`DRLRegistryText(${pas(category)}, ${registryIdExpression}, 'base_game', ${pas(field)}, AnsiString(${englishExpression}))`,
  kind:'registry-display',category,registryIdExpression,scope:'base_game',field,
  englishExpression,requiredUnits:['drlsemanticregistry'],...options});
}
function indexed(base,line,table,index,field,category){
 const original=`LuaSystem.Get(['${table}',${index},'${field}'])`;
 registry(base,line,original,category,`AnsiString(LuaSystem.Get(['${table}',${index},'id']))`,field);
}
function tableField(base,line,category,field){
 registry(base,line,`getString('${field}')`,category,"getString('id')",field,
  {lookupContext:'Existing with LuaSystem.GetTable; original field getter occurs exactly once.'});
}
indexed('dfhof',366,'beings','cn','name','being');
indexed('dfhof',391,'chal','Floor(cn div 4)','name','challenge');
for(const [line,field]of [[420,'name'],[423,'desc'],[435,'name'],[436,'desc']])
 indexed('dfhof',line,'medals','cn',field,'medal');
for(const line of [466,467,489])tableField('dfhof',line,'item','name');
for(const line of [535,538])tableField('dfhof',line,'mod_array','name');
tableField('dfhof',538,'mod_array','request_desc');
for(const line of [579,582])tableField('dfhof',line,'badge','name');
tableField('dfhof',583,'badge','desc');

registry('drlmainmenuview',871,"LuaSystem.Get( ['ranks','skill',FArrayChal[iSelect].Req+1,'name'] )",
 'rank',"'skill:' + IntToStr(FArrayChal[iSelect].Req+1)",'name',
 {note:'Presentation-only skill:<ordinal> registry ID; original Req, rank threshold and Lua array index unchanged.'});
proposals.push({file:'src/drlmainmenuview.pas',line:1112,
 original:"iEntry.ID    := GetString('id');",
 replacement:"iEntry.ID    := GetString('id');\n"+
 "      iEntry.Name := DRLRegistryText('challenge', iEntry.ID, 'base_game', iPrefix+'name', iEntry.Name);\n"+
 "      iEntry.Desc := DRLRegistryText('challenge', iEntry.ID, 'base_game', iPrefix+'description', iEntry.Desc);\n"+
 "      iEntry.Extra := DRLRegistryText('challenge', iEntry.ID, 'base_game', iPrefix+'rating', iEntry.Extra);",
 kind:'registry-display-buffer',category:'challenge',registryIdExpression:'iEntry.ID',scope:'base_game',
 field:'iPrefix + field',englishExpression:'iEntry.Name / iEntry.Desc / iEntry.Extra',
 fieldBindings:[
  {fieldExpression:"iPrefix+'name'",fields:['name','arch_name'],englishExpression:'iEntry.Name',originalGetter:"GetString(iPrefix+'name')"},
  {fieldExpression:"iPrefix+'description'",fields:['description','arch_description'],englishExpression:'iEntry.Desc',originalGetter:"GetString(iPrefix+'description')"},
  {fieldExpression:"iPrefix+'rating'",fields:['rating','arch_rating'],englishExpression:'iEntry.Extra',originalGetter:"GetString(iPrefix+'rating')"},
 ],ownershipGuardLines:[1108,1109,1110],requiredUnits:['drlsemanticregistry'],
 note:'Translate the presentation record after original Name/Desc/Extra/ID reads, retaining getter order and count. Existing empty-rating UNRATED branch, NID/Req/Allow and all domain metadata stay unchanged. External BLADE/SEREG/TORMUSE ratings are identities.'});

function perkToken(base,line,original,field,options={}){
 const nid='iPerks[i].ID';
 const replacement=field==='name-or-short'
  ?`DRLViewPerkName(${nid}, ${original}, Name)`
  :`DRLViewPerkField(${nid}, ${pas(field)}, ${original})`;
 proposals.push({file:`src/${base}.pas`,line,original,replacement,kind:'registry-display-perk',
  category:'perk',registryIdExpression:`AnsiString(LuaSystem.Get(['perks',${nid},'id']))`,scope:'base_game',field,
  englishExpression:original,tokenIdentifier:true,requiredUnits:['drlsemanticperks'],
  note:'Render operand only: preserve original empty-field tests, iName fallback, timing, hooks, PerkData and domain getters.',...options});
}
for(const [base,lines]of [
 ['drlmoreview',[136,137]],['drlplayerview',[1007,1008,1049,1050]],
])for(const line of lines){perkToken(base,line,'iName','name-or-short');perkToken(base,line,'Desc','desc');}
for(const [base,lines]of [
 ['drlmoreview',[153,400]],['drlplayerview',[1023]],
])for(const line of lines){perkToken(base,line,'Name','name');perkToken(base,line,'Desc','desc');}
// These two Desc operands currently sit inside already owned complete typed view events.
// The proposal is retained as skippedOwned, including its exact replacement, for parameter-owner handoff.
for(const line of [380,392])perkToken('drlmoreview',line,'Desc','desc',{
 ownerHandoff:'Change the existing DRLStringParam description binding to this replacement; do not add an overlapping source patch.'});

function itemPerk(base,line,original,thing,hook){
 proposals.push({file:`src/${base}.pas`,line,original,
  replacement:`DRLViewItemPerkText(${thing}, ${hook}, 'short', ${original})`,
  kind:'registry-display-item-perk',category:'perk',registryIdExpression:'First original perk NID with the same hook, then perks[NID].id',
  scope:'base_game',field:'short',englishExpression:original,
  requiredUnits:['drlsemanticperks','drlhooks'],note:'Original English getter evaluated once; first matching perk identity and original hook selection remain unchanged.'});
}
itemPerk('drlmoreview',319,'FItem.GetAltFireName','FItem','Hook_OnAltFire');
itemPerk('drlmoreview',321,'FItem.GetAltReloadName','FItem','Hook_OnAltReload');
itemPerk('drlmoreview',330,'FItem.GetAltFireName','FItem','Hook_OnAltFire');

function traits(base,line,original,thing,inventory=false){
 proposals.push({file:`src/${base}.pas`,line,original,
  replacement:`DRLViewTraitString(${thing}${inventory?', True':''})`,kind:'registry-display-trait-list',
  category:'perk',registryIdExpression:'Each original perk NID, then perks[NID].id',scope:'base_game',
  field:inventory?'name':'short',englishExpression:'Original Name or GetPerkShort branch; original OnDescribe result is opaque',
  requiredUnits:['drlsemanticperks'],callbackPolicy:'Replace one original GetTraitString call with one presentation loop preserving callback order, count, owner and timing. Hook output stays verbatim.',
  note:'Perk iteration, original pre-translation empty test, colors and separators retained; generic TThing.GetTraitString remains English.'});
}
traits('drlplayerview',758,'aItem.GetTraitString( True )','aItem',true);
traits('drlio',621,'DRL.Level.Being[ aTarget ].GetTraitString','DRL.Level.Being[ aTarget ]');
traits('drlio',951,'Player.GetTraitString','Player');
traits('drlio',1182,'DRL.Level.Being[ aWhere ].GetTraitString','DRL.Level.Being[ aWhere ]');
traits('drlgfxio',1066,'DRL.Level.Being[ iCoord ].GetTraitString','DRL.Level.Being[ iCoord ]');

function typedTarget(line,original,english,japanese,id){
 const binding={name:'mode',type:'string',expression:'iItem.GetAltFireName',
  presentationExpression:"DRLViewItemPerkText(iItem, Hook_OnAltFire, 'short', iItem.GetAltFireName)"};
 proposals.push({file:'src/drlbase.pas',line,original,
  replacement:`DRLText(${pas(id)}, ${pas(english)}, [DRLStringParam('mode', ${binding.presentationExpression})])`,
  kind:'registry-display-complete-event',id,english,japanese,parameters:{mode:'string'},bindings:[binding],
  category:'perk',registryIdExpression:'First original perk NID with Hook_OnAltFire, then perks[NID].id',scope:'base_game',field:'short',
  englishExpression:'iItem.GetAltFireName',requiredUnits:['drlsemantictext','drlsemanticperks','drlhooks'],
  note:'Complete typed event; original alternate-fire getter is evaluated once and never passed to localized Format.'});
}
typedTarget(782,"'Choose target ('+iItem.GetAltFireName+'):'",'Choose target ({{mode}}):','対象を選択（{{mode}}）:','view.target.choose-alt-mode');
typedTarget(832,"'Fire target ({L'+iItem.GetAltFireName+'}):'",'Fire target ({L{{mode}}}):','射撃対象（{L{{mode}}}）:','view.target.fire-alt-mode');

for(const line of [302,311,328])proposals.push({file:'src/drlmoreview.pas',line,
 original:'DamageTypeName(FItem.DamageType)',replacement:'DRLViewDamageTypeName(FItem.DamageType, DamageTypeName(FItem.DamageType))',
 kind:'indexed-view-term',category:'damage-type',field:'name',registryIdExpression:'Original TDamageType enum value',scope:'base_game',
 englishExpression:'DamageTypeName(FItem.DamageType)',requiredUnits:['drlsemanticviewterms'],
 note:'Finite enum presentation adapter; original function result evaluated once and unchanged.'});
for(const [base,line]of [['drlmoreview',116],['drlmoreview',117],['drlplayerview',567]])proposals.push({file:`src/${base}.pas`,line,
 original:'Padded(ResNames[iRes],7)',replacement:'DRLViewResistanceLabel(iRes, ResNames[iRes])',
 kind:'indexed-view-term',category:'resistance',field:'name',registryIdExpression:'Original TResistance enum value',scope:'base_game',
 englishExpression:'ResNames[iRes]',requiredUnits:['drlsemanticviewterms'],
 ownerHandoff:'Replace the complete original Padded operand, including its 7-cell width, so the 8-cell Japanese plasma label stays intact. If enclosed by an existing complete view event, change that event parameter binding. Original ResNames/ResIDs arrays stay English.',
 layoutMeasurement:'Resolve once; VTIG_Length measures the same name; add spaces to 7 cells without cropping a wider translated label.'});
proposals.push({file:'src/drlmoreview.pas',line:288,
 original:"LuaSystem.Get(['core', 'weapon_group_name', iGroup], iGroup)",
 replacement:"DRLViewWeaponGroupName(iGroup, AnsiString(LuaSystem.Get(['core', 'weapon_group_name', iGroup], iGroup)))",
 kind:'indexed-view-term',category:'weapon-group',field:'name',registryIdExpression:'iGroup',scope:'base_game',
 englishExpression:"LuaSystem.Get(['core', 'weapon_group_name', iGroup], iGroup)",requiredUnits:['drlsemanticviewterms'],
 note:'Original weapon group ID selects a reviewed exact-English semantic term. Unknown/custom IDs or changed values remain verbatim.'});

// Existing parent-owned registry seams are enumerated, not silently counted as new coverage.
for(const [line,original,category,id,field]of [
 [275,"LuaSystem.Get(['ranks', aRankID, aCurrent+2,'name'])",'rank',"aRankID + ':' + IntToStr(aCurrent+2)",'name'],
 [315,"LuaSystem.Get([ 'ranks', iID, 'name' ], '' )",'rank_group','iID','name'],
 [316,"LuaSystem.Get([ 'ranks', iID, iRank+1, 'name' ])",'rank',"iID + ':' + IntToStr(iRank+1)",'name'],
])registry('dfhof',line,original,category,id,field,{ownerHandoff:'Existing parent rank consumer seam; never duplicate its patch.'});
for(const line of [78,82])indexed('drlassemblyview',line,'mod_arrays','i','name','mod_array');
registry('drlassemblyview',83,"LuaSystem.Get(['mod_arrays',i,'request_desc'],'')",'mod_array',
 "AnsiString(LuaSystem.Get(['mod_arrays',i,'id']))",'request_desc');

/** Source-safe optional helper unit for the parent to place in its overlay only.
 * It is a presentation adapter. Original Pascal domain loaders/getters are untouched.
 * No active base-game perk has OnShort/OnDescribe; custom callback output stays opaque.
 */
export const registryDisplayPresentationUnit=Object.freeze({
 file:'src/drlsemanticperks.pas',unit:'drlsemanticperks',
 sourceGuards:['src/dfthing.pas','src/dfitem.pas','src/drlperk.pas'],
 interfaceFunctions:['DRLViewPerkField','DRLViewPerkName','DRLViewItemPerkText','DRLViewFirstPerkText','DRLViewTraitString'],
 implementation:`{$INCLUDE drl.inc}
{ Presentation adapter for pinned original DRL perk metadata. GPL-2.0. }
unit drlsemanticperks;
interface
uses dfthing;
function DRLViewPerkField(aNID: Integer; const aField, aEnglish: AnsiString): AnsiString;
function DRLViewPerkName(aNID: Integer; const aEnglish, aOriginalName: AnsiString): AnsiString;
function DRLViewItemPerkText(aThing: TThing; aHook: Byte; const aField, aEnglish: AnsiString): AnsiString;
function DRLViewFirstPerkText(aThing: TThing; const aField, aEnglish: AnsiString): AnsiString;
function DRLViewTraitString(aThing: TThing; aInvMode: Boolean = False): AnsiString;
implementation
uses vluasystem, vtig, drlperk, drlhooks, drlsemanticregistry;

function DRLViewPerkField(aNID: Integer; const aField, aEnglish: AnsiString): AnsiString;
var iID: AnsiString;
begin
  if (aNID < 0) or (aNID > High(PerkData)) then Exit(aEnglish);
  if not LuaSystem.Defined(['perks', aNID, 'id']) then Exit(aEnglish);
  iID := AnsiString(LuaSystem.Get(['perks', aNID, 'id']));
  Exit(DRLRegistryText('perk', iID, 'base_game', aField, aEnglish));
end;

function DRLViewPerkName(aNID: Integer; const aEnglish, aOriginalName: AnsiString): AnsiString;
begin
  if (aNID < 0) or (aNID > High(PerkData)) then Exit(aEnglish);
  { The existing fallback may be a custom OnShort callback result. Keep it opaque. }
  if (aOriginalName = '') and (Hook_OnShort in PerkData[aNID].Hooks) then Exit(aEnglish);
  if aOriginalName = ''
    then Exit(DRLViewPerkField(aNID, 'short', aEnglish))
    else Exit(DRLViewPerkField(aNID, 'name', aEnglish));
end;

function DRLViewItemPerkText(aThing: TThing; aHook: Byte; const aField, aEnglish: AnsiString): AnsiString;
var iPerks: TPerkList;
    i, iNID: Integer;
begin
  Result := aEnglish;
  if (aThing = nil) or (aEnglish = '') then Exit;
  iPerks := aThing.GetPerkList;
  if (iPerks = nil) or (iPerks.Size = 0) then Exit;
  for i := 0 to iPerks.Size - 1 do
  begin
    iNID := iPerks[i].ID;
    if (iNID < 0) or (iNID > High(PerkData)) then Continue;
    if aHook in PerkData[iNID].Hooks then
      Exit(DRLViewPerkField(iNID, aField, aEnglish));
  end;
end;

function DRLViewFirstPerkText(aThing: TThing; const aField, aEnglish: AnsiString): AnsiString;
var iPerks: TPerkList;
begin
  Result := aEnglish;
  if (aThing = nil) or (aEnglish = '') then Exit;
  iPerks := aThing.GetPerkList;
  if (iPerks = nil) or (iPerks.Size = 0) then Exit;
  Exit(DRLViewPerkField(iPerks[0].ID, aField, aEnglish));
end;

function DRLViewTraitString(aThing: TThing; aInvMode: Boolean): AnsiString;
var iPerks: TPerkList;
    i, iNID: Integer;
    iColor: Byte;
    iText, iField: AnsiString;
begin
  Result := '';
  if aThing = nil then Exit;
  iPerks := aThing.GetPerkList;
  if (iPerks = nil) or (iPerks.Size = 0) then Exit;
  for i := 0 to iPerks.Size - 1 do
  begin
    iNID := iPerks[i].ID;
    with PerkData[iNID] do
    begin
      iField := '';
      if Hook_OnDescribe in Hooks then
        iText := LuaSystem.ProtectedCall(['perks', iNID, HookNames[Hook_OnDescribe]], [aThing])
      else if aInvMode then
      begin
        iText := Name;
        iField := 'name';
      end
      else
      begin
        iText := aThing.GetPerkShort(iNID);
        if not (Hook_OnShort in Hooks) then iField := 'short';
      end;
      { Preserve the original empty test before localization. }
      if iText = '' then Continue;
      if iField <> '' then iText := DRLViewPerkField(iNID, iField, iText);
      if (iPerks[i].Time > 0) and (iPerks[i].Time <= 50)
        then iColor := ColorExp
        else iColor := Color;
      Result += '{' + VTIG_ColorChar(iColor) + iText + '}';
      if aInvMode then Result += ', ' else Result += ' ';
    end;
  end;
  if Result <> '' then
    if aInvMode
      then SetLength(Result, Length(Result) - 2)
      else SetLength(Result, Length(Result) - 1);
end;
end.
`,
});

const damageTerms=[
 ['Damage_Bullet','bullet','弾丸',543],['Damage_Melee','melee','近接',544],
 ['Damage_Sharpnel','shred','散弾',545],['Damage_Acid','acid','酸',546],
 ['Damage_Fire','fire','火炎',547],['Damage_Cold','cold','冷気',548],
 ['Damage_Poison','poison','毒',549],['Damage_Plasma','plasma','プラズマ',550],
 ['Damage_SPlasma','plasma','プラズマ',551],['Damage_IgnoreArmor','heavy','重撃',552],
 ['Damage_Pierce','pierce','貫通',553],
];
const resistanceTerms=[
 ['Resist_Bullet','bullet','Bullet','弾丸'],['Resist_Melee','melee','Melee','近接'],
 ['Resist_Shrapnel','shrapnel','Shrap','散弾'],['Resist_Acid','acid','Acid','酸'],
 ['Resist_Fire','fire','Fire','炎'],['Resist_Plasma','plasma','Plasma','プラズマ'],
 ['Resist_Cold','cold','Cold','冷気'],['Resist_Poison','poison','Poison','毒'],
 ['Resist_Pierce','pierce','Pierce','貫通'],
];
const weaponGroupTerms=[
 ['melee','melee','近接',65],['pistol','pistol','ピストル',66],
 ['shotgun','shotgun','ショットガン',67],['rocket','rocket','ロケット',68],
 ['chain','chaingun','チェーンガン',69],['plasma','plasma','プラズマ',70],['bfg','BFG','BFG',71],
];
export const registryDisplayFiniteTerms=Object.freeze([
 ...damageTerms.map(([enumValue,english,japanese,line])=>({id:`term.damage-type.${english}`,enumValue,english,japanese,
  source:{file:'src/dfdata.pas',line},role:'finite-enum-presentation'})),
 ...resistanceTerms.map(([enumValue,key,english,japanese])=>({id:`term.resistance.${key}`,enumValue,english,japanese,
  source:{file:'src/dfdata.pas',line:134},role:'finite-enum-presentation'})),
 ...weaponGroupTerms.map(([key,english,japanese,line])=>({id:`term.weapon-group.${key}`,registryId:key,english,japanese,
  source:{file:'bin/data/drl/main.lua',line},role:'finite-registry-presentation'})),
]);
export const registryDisplayTermPresentationUnit=Object.freeze({
 file:'src/drlsemanticviewterms.pas',unit:'drlsemanticviewterms',
 sourceGuards:['src/dfdata.pas','bin/data/drl/main.lua'],
 interfaceFunctions:['DRLViewDamageTypeName','DRLViewResistanceName','DRLViewResistanceLabel','DRLViewWeaponGroupName'],
 implementation:`{$INCLUDE drl.inc}
{ Finite original enum/group presentation terms. Domain arrays stay English. GPL-2.0. }
unit drlsemanticviewterms;
interface
uses dfdata;
function DRLViewDamageTypeName(aType: TDamageType; const aEnglish: AnsiString): AnsiString;
function DRLViewResistanceName(aType: TResistance; const aEnglish: AnsiString): AnsiString;
function DRLViewResistanceLabel(aType: TResistance; const aEnglish: AnsiString): AnsiString;
function DRLViewWeaponGroupName(const aGroupID, aEnglish: AnsiString): AnsiString;
implementation
uses sysutils, vtig, drlsemantictext;
function DRLViewDamageTypeName(aType: TDamageType; const aEnglish: AnsiString): AnsiString;
begin
  case aType of
${damageTerms.map(([enumValue,english])=>`    ${enumValue}: if aEnglish = '${english}' then Exit(DRLText('term.damage-type.${english}', aEnglish)) else Exit(aEnglish);`).join('\n')}
  end;
  Exit(aEnglish);
end;
function DRLViewResistanceName(aType: TResistance; const aEnglish: AnsiString): AnsiString;
begin
  case aType of
${resistanceTerms.map(([enumValue,key,english])=>`    ${enumValue}: if aEnglish = '${english}' then Exit(DRLText('term.resistance.${key}', aEnglish)) else Exit(aEnglish);`).join('\n')}
  end;
  Exit(aEnglish);
end;
function DRLViewWeaponGroupName(const aGroupID, aEnglish: AnsiString): AnsiString;
begin
${weaponGroupTerms.map(([key,english])=>`  if aGroupID = '${key}' then\n    if aEnglish = '${english}' then Exit(DRLText('term.weapon-group.${key}', aEnglish)) else Exit(aEnglish);`).join('\n')}
  Exit(aEnglish);
end;
function DRLViewResistanceLabel(aType: TResistance; const aEnglish: AnsiString): AnsiString;
var iName: AnsiString;
    iColumns: Integer;
begin
  iName := DRLViewResistanceName(aType, aEnglish);
  iColumns := VTIG_Length(iName);
  if iColumns < 7 then Exit(iName + StringOfChar(' ', 7 - iColumns));
  Exit(iName);
end;
end.
`,
});

// Exact bindings preserve the original IIf eager evaluation and every condition/getter.
// All numeric display helpers retain their original formatting, signs and units.
const boxRows=[
 [443,'durability','耐久力','IntToStr(FProps.MaxDurability)','integer','FProps.MaxDurability'],
 [444,'swap-time','交換時間','Seconds(FProps.SwapTime)'],
 [446,'damage-type','ダメージ属性','DamageTypeName(FProps.DamageType)','string',
  'DRLViewDamageTypeName(FProps.DamageType, DamageTypeName(FProps.DamageType))'],
 [447,'explosion-radius','爆発範囲','IntToStr(FProps.Radius)','integer','FProps.Radius'],
 [449,'fire-time','射撃時間','Seconds(FProps.UseTime)'],
 [450,'reload-time','リロード時間','Seconds(FProps.ReloadTime)'],
 [451,'swap-time','交換時間','Seconds(FProps.SwapTime)'],
 [452,'accuracy','命中補正','BonusStr(FProps.Acc)'],
 [453,'damage-type','ダメージ属性','DamageTypeName(FProps.DamageType)','string',
  'DRLViewDamageTypeName(FProps.DamageType, DamageTypeName(FProps.DamageType))'],
 [454,'shots','発射数','IntToStr(FProps.Shots)','integer','FProps.Shots'],
 [455,'shot-cost','消費弾数','IntToStr(FProps.ShotCost)','integer','FProps.ShotCost'],
 [456,'explosion-radius','爆発範囲','IntToStr(FProps.Radius)','integer','FProps.Radius'],
 [457,'damage-falloff','威力減衰','IntToStr(FProps.Falloff)','integer','FProps.Falloff'],
 [458,'cone-size','射撃の拡散幅','IntToStr(FProps.Spread)','integer','FProps.Spread'],
 [459,'max-range','最大射程','IntToStr(FProps.Range)','integer','FProps.Range'],
 [460,'alt-fire','特殊射撃','GetAltFireName','string',"DRLViewItemPerkText(Self, Hook_OnAltFire, 'short', GetAltFireName)"],
 [461,'alt-reload','特殊リロード','GetAltReloadName','string',"DRLViewItemPerkText(Self, Hook_OnAltReload, 'short', GetAltReloadName)"],
 [463,'attack-time','攻撃時間','Seconds(FProps.UseTime)'],
 [464,'swap-time','交換時間','Seconds(FProps.SwapTime)'],
 [465,'accuracy','命中補正','BonusStr(FProps.Acc)'],
 [466,'damage-type','ダメージ属性','DamageTypeName(FProps.DamageType)','string',
  'DRLViewDamageTypeName(FProps.DamageType, DamageTypeName(FProps.DamageType))'],
 [467,'alt-fire','特殊射撃','GetAltFireName','string',"DRLViewItemPerkText(Self, Hook_OnAltFire, 'short', GetAltFireName)"],
 [470,'move-speed','移動速度','Percent(FProps.MoveMod)'],
 [471,'knockback','ノックバック','Percent(FProps.KnockMod)'],
 [472,'dodge-rate','回避率','Percent(FProps.DodgeMod)'],
 ...[['bullet','弾丸'],['melee','近接'],['shrapnel','散弾'],['acid','酸'],['fire','炎'],['plasma','プラズマ'],['cold','冷気'],['poison','毒'],['pierce','貫通']]
  .map(([key,name],i)=>[475+i,`${key}-resistance`,`${name}耐性`,`BonusStr(GetResistance('${key}'))`]),
];
const displayCells=value=>[...value].reduce((n,char)=>n+(char.codePointAt(0)<128?1:2),0);

function buildDescriptionBoxProjection(sources){
 const file='src/dfitem.pas',source=sources[file],newline=source.includes('\r\n')?'\r\n':'\n';
 const methodStart=lineRange(source,437).start,methodEnd=lineRange(source,484).end;
 const originalMethod=source.slice(methodStart,methodEnd);
 const rowRecords=boxRows.map(([line,suffix,japaneseLabel,expression,type='string',presentationExpression=expression])=>{
  const ln=lineRange(source,line),scan=scanSource(ln.original,'pascal');
  const opening=scan.tokens.find(t=>t.kind==='string'&&t.value.includes(': {!'));
  const closing=scan.tokens.filter(t=>t.kind==='string').at(-1);
  const endToken=scan.tokens.find(t=>t.kind==='character-code'&&t.numericValue===10);
  if(!opening||!closing||!endToken||closing.start<opening.end)throw Error(`DescriptionBox row shape: ${line}`);
  const originalExpression=ln.original.slice(opening.end,closing.start).replace(/^\s*\+\s*/,'').replace(/\s*\+\s*$/,'');
  if(originalExpression!==expression)throw Error(`DescriptionBox exact property binding: ${line} ${originalExpression}`);
  const original=ln.original.slice(opening.start,endToken.end);
  const english=opening.value+'{{value}}'+closing.value+endToken.value;
  const colon=opening.value.indexOf(':');
  if(displayCells(japaneseLabel)>colon)throw Error(`DescriptionBox CJK label width: ${suffix}`);
  const japanese=japaneseLabel+' '.repeat(colon-displayCells(japaneseLabel))+opening.value.slice(colon)+'{{value}}'+closing.value+endToken.value;
  const id=`view.description-box.${suffix}`,parameters={value:type};
  const replacement=`DRLText(${pas(id)}, ${pas(english)}, [DRL${type==='integer'?'Integer':'String'}Param('value', ${presentationExpression})])`;
  return {file,line,start:ln.start+opening.start,end:ln.start+endToken.end,original,replacement,id,english,japanese,parameters,
   bindings:[{name:'value',type,expression,presentationExpression}],sourceSha256:registryDisplaySourceLocks[file].sha256,
   sourceGuard:{start:ln.start,end:ln.end,original:ln.original,sha256:digest(ln.original)},
   originalEnglishReconstructed:english,role:'complete-typed-description-row'};
 });
 const edits=[...rowRecords.map(r=>({start:r.start-methodStart,end:r.end-methodStart,replacement:r.replacement})),
  {start:lineRange(source,440).start-methodStart+lineRange(source,440).original.indexOf('GetFirstPerkDescription'),
   end:lineRange(source,440).start-methodStart+lineRange(source,440).original.indexOf('GetFirstPerkDescription')+'GetFirstPerkDescription'.length,
   replacement:"DRLViewFirstPerkText(Self, 'desc', GetFirstPerkDescription)"},
  ...scanSource(originalMethod,'pascal').tokens.filter(t=>t.kind==='identifier'&&t.raw==='DescriptionBox')
   .map(t=>({start:t.start,end:t.end,replacement:'PresentationDescriptionBox'})),
 ];
 edits.sort((a,b)=>b.start-a.start);
 let implementation=originalMethod;
 for(const e of edits)implementation=implementation.slice(0,e.start)+e.replacement+implementation.slice(e.end);
 implementation=implementation.replace('aShort : Boolean = False','aShort : Boolean');
 const header=lineRange(source,437).original;
 const defs=[
  {file,line:31,original:'function    DescriptionBox( aShort : Boolean = False ) : Ansistring;',
   replacement:'function    DescriptionBox( aShort : Boolean = False ) : Ansistring;'+newline+
    '    function    PresentationDescriptionBox( aShort : Boolean = False ) : Ansistring;',
   kind:'presentation-method-declaration',category:'item-description-box',field:'presentation-projection',scope:'base_game',
   registryIdExpression:'Original item / perk identities unchanged',englishExpression:'Original DescriptionBox signature',requiredUnits:[]},
  {file,line:437,original:header,replacement:implementation+newline+newline+header,
   kind:'presentation-method-projection',category:'item-description-box',field:'presentation-projection',scope:'base_game',
   registryIdExpression:'Original item / perk identities unchanged',englishExpression:'Original DescriptionBox method retained byte for byte',
   requiredUnits:['drlsemantictext','drlsemanticperks','drlsemanticviewterms'],ownershipGuardLines:Array.from({length:48},(_,i)=>437+i),
   sourceMethodGuard:{start:methodStart,end:methodEnd,original:originalMethod,sha256:digest(originalMethod)},
   note:'New TItem method mirrors the complete original expression structure. Original DescriptionBox remains English and untouched; every condition, IIf eager operand, stat helper, hook/name getter and resistance lookup retains its original evaluation count.'},
  ...[['drlplayerview',757,'aItem.DescriptionBox','aItem.PresentationDescriptionBox'],
      ['drlmoreview',83,'aItem.DescriptionBox( True )','aItem.PresentationDescriptionBox( True )']]
   .map(([base,line,original,replacement])=>({file:`src/${base}.pas`,line,original,replacement,
    kind:'presentation-method-consumer',category:'item-description-box',field:'presentation-projection',scope:'base_game',
    registryIdExpression:'aItem original item / perk identities',englishExpression:'Original DescriptionBox structure projected by the new method',requiredUnits:[]})),
 ];
 const catalogTerms=[...new Map(rowRecords.map(r=>[r.id,{id:r.id,english:r.english,japanese:r.japanese,parameters:r.parameters}])).values()];
 for(const r of rowRecords){const t=catalogTerms.find(t=>t.id===r.id);if(t.english!==r.english||t.japanese!==r.japanese||JSON.stringify(t.parameters)!==JSON.stringify(r.parameters))throw Error(`Conflicting DescriptionBox repeated row: ${r.id}`);}
 return {defs,implementation,originalMethod,rowRecords,catalogTerms,
  file,sourceMethodGuard:{start:methodStart,end:methodEnd,sha256:digest(originalMethod)},
  originalDomainModified:false,originalGetterCalled:false};
}

function verifyFiniteTermSources(sources){
 for(const [enumValue,english,,line]of damageTerms){
  const ln=lineRange(sources['src/dfdata.pas'],line);
  if(!ln.original.includes(enumValue)||!ln.original.includes(`Exit('${english}')`))throw Error(`Damage enum term source guard ${enumValue}`);
 }
 const resLine=lineRange(sources['src/dfdata.pas'],134).original;
 const values=scanSource(resLine,'pascal').tokens.filter(t=>t.kind==='string').map(t=>t.value);
 if(JSON.stringify(values)!==JSON.stringify(resistanceTerms.map(t=>t[2])))throw Error('Original resistance array term guard');
 for(const [key,english,,line]of weaponGroupTerms){
  const ln=lineRange(sources['bin/data/drl/main.lua'],line);
  const ts=scanSource(ln.original,'lua').tokens;
  if(ts.find(t=>t.kind==='identifier')?.raw!==key||ts.find(t=>t.kind==='string')?.value!==english)throw Error(`Weapon group term source guard ${key}`);
 }
}

/** Deliberate original-English dispositions. No English-to-Japanese matching is proposed. */
export const registryDisplayDispositions=Object.freeze([
 {file:'src/dfhof.pas',lines:[291],category:'rank',disposition:'parent-owned-indexed-unlocks',
  reason:'Original rank unlock arrays and requirements remain domain data; complete unlock producer events belong to the parent rank sidecar.'},
 {file:'src/dfhof.pas',lines:[615,616,619,620],category:'custom-award',disposition:'custom-module-fallback',
  reason:'awards[name/levels/name/desc] are external custom-module metadata, absent from the reviewed original badge/medal registries. Preserve raw values and require module-scoped IDs before translation.'},
 {file:'src/drlassemblyview.pas',lines:[84],category:'mod_array',field:'desc',disposition:'base-game-empty-optional-field',
  reason:'None of the 42 active original mod_array registrations defines desc. Existing empty fallback stays empty; custom module descriptions require a reviewed scoped catalog.'},
 {file:'src/dfitem.pas',lines:[33,34,35,396,410,424],category:'perk',disposition:'retain-English-domain-getters',
  reason:'GetAltFireName/GetAltReloadName/GetFirstPerkDescription are domain APIs; localize only consumers. Original first matching hook and first perk selection remain unchanged.'},
 {file:'src/dfitem.pas',lines:[440,460,461,467],category:'perk',disposition:'complete-presentation-descriptionbox-proposed',
  reason:'The sidecar now proposes the complete PresentationDescriptionBox method and both original consumers. Original DescriptionBox remains English; all stat labels and finite damage terms have guarded semantic IDs, and first-perk/alternate-mode fields resolve only by original identities.',
  proposals:[
   {line:440,original:'GetFirstPerkDescription',presentationExpression:"DRLViewFirstPerkText(Self, 'desc', GetFirstPerkDescription)",guard:'Original getter once; helper guards nil/empty list before selecting original first perk.'},
   {lines:[460,467],original:'GetAltFireName',presentationExpression:"DRLViewItemPerkText(Self, Hook_OnAltFire, 'short', GetAltFireName)"},
   {line:461,original:'GetAltReloadName',presentationExpression:"DRLViewItemPerkText(Self, Hook_OnAltReload, 'short', GetAltReloadName)"},
  ]},
 {file:'src/dfthing.pas',lines:[83,181,187],category:'perk',disposition:'retain-English-loader-and-getters',
  reason:'TThing.Name, GetPerkShort and GetTraitString remain English. The new adapter changes only the five actual UI callers.'},
 {file:'src/drlperk.pas',lines:[11,189,191],category:'perk',disposition:'retain-English-PerkData-and-callbacks',
  reason:'PerkData Name/Short/Desc and GetShort remain original. No pinned base-game perk defines OnShort or OnDescribe; future/custom hook output is opaque and callbacks execute only as originally required.'},
 {file:'src/drlua.pas',lines:[131],category:'perk',disposition:'retain-English-registry-loader',
  reason:'Loader populates domain PerkData with original English; no presentation text or registry ID is written back.'},
 {file:'bin/data/drl/main.lua',lines:[375,395,397,401,403,406,408],category:'challenge',disposition:'Lua-result-producer-owner-handoff',
  fields:['win_highscore','win_mortem','arch_win_highscore','arch_win_mortem'],
  reason:'GetResultDescription consumes these exact fields. There is no mortem_highscore field in the pinned source. Use complete producer events with challenge ID and exact field guards; never translate persisted prose by matching English.'},
 {file:'src/dfhof.pas',lines:[679,926],category:'score',disposition:'versioned-structured-score-migration-required',
  reason:'Highscore killed stores already rendered historical English, while new result descriptions come from a Lua producer. Retain old scores until a versioned structured result/death/challenge record can render both languages.'},
 {category:'item/being/level',disposition:'runtime-generated-name-producer-owner-handoff',
  reason:'Corpses, natural attacks, assembled/overcharged items, randomized levels, external usernames and custom names are not translated by this sidecar. Existing generated registry producer work must retain IDs, exact English and parameters; unknown overrides fall back verbatim.'},
]);

function readLockedSources(sourceRoot,sourceOverrides){
 const sources={};
 for(const [file,lock]of Object.entries(registryDisplaySourceLocks)){
  const supplied=sourceOverrides[file];
  const bytes=supplied===undefined?readFileSync(path.join(sourceRoot,file)):Buffer.isBuffer(supplied)?supplied:Buffer.from(supplied,'utf8');
  if(bytes.length!==lock.bytes||digest(bytes)!==lock.sha256)throw Error(`Registry display source hash guard failed: ${file}`);
  sources[file]=bytes.toString('utf8');
 }
 return sources;
}
function lineRange(source,line){
 let start=0;
 for(let i=1;i<line;i++){const next=source.indexOf('\n',start);if(next<0)throw Error(`Absent source line ${line}`);start=next+1;}
 let end=source.indexOf('\n',start);if(end<0)end=source.length;if(source[end-1]==='\r')end--;
 return {start,end,original:source.slice(start,end)};
}
function overlaps(a,b){return a.start<b.end&&b.start<a.end || b.start===b.end&&a.start<=b.start&&b.start<a.end;}
function resolveProposal(def,sources){
 const source=sources[def.file],line=lineRange(source,def.line);
 let starts=[];
 if(def.tokenIdentifier){
  starts=scanSource(source,'pascal').tokens.filter(t=>t.line===def.line&&t.kind==='identifier'&&t.raw===def.original).map(t=>t.start);
 }else{
  let at=line.original.indexOf(def.original);
  while(at>=0){starts.push(line.start+at);at=line.original.indexOf(def.original,at+def.original.length);}
 }
 if(starts.length!==1)throw Error(`Registry display exact source site guard failed: ${def.file}:${def.line} ${def.original} (${starts.length})`);
 const start=starts[0],end=start+def.original.length;
 const ownershipGuards=[{start,end},...(def.ownershipGuardLines??[]).map(n=>lineRange(source,n))];
 return {...def,start,end,sourceSha256:registryDisplaySourceLocks[def.file].sha256,
  sourceGuard:{line:def.line,start:line.start,end:line.end,original:line.original,sha256:digest(line.original)},
  ownershipGuards,englishGuardRequired:true,originalDomainModified:false};
}

/** Records are in original source UTF-16 offsets, before all parent overlay edits.
 * Pass {manifest:{patches:[]},skipPendingViewOwnership:false} for the complete authored baseline.
 * Default manifest and pending view ownership conservatively exclude overlapping source.
 */
export function buildRegistryDisplaySites(sourceRoot,{
 manifest=JSON.parse(readFileSync(path.join(here,'manifest.json'),'utf8')),
 sourceOverrides={},skipPendingViewOwnership=true,
}={}){
 const sources=readLockedSources(sourceRoot,sourceOverrides);
 verifyFiniteTermSources(sources);
 const descriptionBox=buildDescriptionBoxProjection(sources);
 const authored=[...proposals,...descriptionBox.defs].map(def=>resolveProposal(def,sources));
 const actualOwned=(manifest.patches??[]).map(p=>({...p,owner:'localization/manifest.json'}));
 const pendingOwned=skipPendingViewOwnership?(()=>{
  const views=buildPascalViewTranslations(sourceRoot,{manifest:{patches:[]},sourceOverrides});
  return [...views.records,...views.registryRecords].map(p=>({...p,owner:'localization/pascal-view-translations.mjs'}));
 })():[];
 const owned=[...actualOwned,...pendingOwned];
 const records=[],skippedOwned=[];
 for(const record of authored){
  const collisions=owned.filter(p=>p.file===record.file&&record.ownershipGuards.some(g=>overlaps(g,p)));
  if(collisions.length)skippedOwned.push({...record,ownership:collisions.map(p=>({owner:p.owner,id:p.id??null,start:p.start,end:p.end,original:p.original,replacement:p.replacement}))});
  else records.push(record);
 }
 records.sort((a,b)=>a.file.localeCompare(b.file)||a.start-b.start);
 for(let i=1;i<records.length;i++)if(records[i].file===records[i-1].file&&overlaps(records[i-1],records[i]))throw Error(`Overlapping authored registry display proposals: ${records[i].file}`);
 const requiredUnits={};
 for(const r of records)requiredUnits[r.file]=[...new Set([...(requiredUnits[r.file]??[]),...r.requiredUnits])];
 return {sourceCommit:registryDisplaySourceCommit,sourceLocks:registryDisplaySourceLocks,
  records,skippedOwned,requiredUnits,presentationUnit:registryDisplayPresentationUnit,
  termPresentationUnit:registryDisplayTermPresentationUnit,descriptionBox,
  catalogTerms:[...new Map(registryDisplayFiniteTerms.map(t=>[t.id,t])).values(),...descriptionBox.catalogTerms],
  dispositions:registryDisplayDispositions,
  pending:registryDisplayDispositions.filter(d=>!d.disposition.startsWith('retain-English')&&!d.disposition.startsWith('complete-presentation')),
  counts:{authoredSites:authored.length,readySites:records.length,skippedOwnedSites:skippedOwned.length,
   directRegistrySites:records.filter(r=>['registry-display','registry-display-buffer'].includes(r.kind)).length,
   perkOperandSites:records.filter(r=>r.kind==='registry-display-perk').length,
   itemPerkSites:records.filter(r=>r.kind==='registry-display-item-perk').length,
   traitListSites:records.filter(r=>r.kind==='registry-display-trait-list').length,
   completeEvents:records.filter(r=>r.kind==='registry-display-complete-event').length,
   finiteTermConsumerSites:records.filter(r=>r.kind==='indexed-view-term').length,
   presentationMethodSites:records.filter(r=>r.kind.startsWith('presentation-method-')).length,
   descriptionBoxRows:descriptionBox.rowRecords.length,descriptionBoxIds:descriptionBox.catalogTerms.length,
   finiteTerms:new Set(registryDisplayFiniteTerms.map(t=>t.id)).size,
   eventTextIds:new Set(records.filter(r=>r.id).map(r=>r.id)).size,
   textIds:new Set([...proposals.filter(r=>r.id).map(r=>r.id),...registryDisplayFiniteTerms.map(r=>r.id),...descriptionBox.catalogTerms.map(r=>r.id)]).size,
   sourceFiles:Object.keys(registryDisplaySourceLocks).length},
  originalDomainModified:false,runtimeAdapterConnected:false};
}

export function verifyRegistryDisplaySites(sourceRoot,options={}){
 const result=buildRegistryDisplaySites(sourceRoot,options);
 const sources=readLockedSources(sourceRoot,options.sourceOverrides??{});
 let parameters=0;
 for(const record of [...result.records,...result.skippedOwned]){
  const source=sources[record.file];
  if(source.slice(record.start,record.end)!==record.original)throw Error(`Registry display raw offset guard: ${record.file}:${record.line}`);
  const guard=record.sourceGuard;
  if(source.slice(guard.start,guard.end)!==guard.original||digest(guard.original)!==guard.sha256)throw Error(`Registry display context guard: ${record.file}:${record.line}`);
  if(record.originalDomainModified||!record.englishGuardRequired)throw Error('Registry display domain/English guard contract');
  if(record.kind==='registry-display'){
   const occurrences=record.replacement.split(record.englishExpression).length-1;
   if(occurrences!==1)throw Error(`Repeated original Lua field read: ${record.file}:${record.line}`);
  }
  if(record.kind==='registry-display-buffer')for(const binding of record.fieldBindings){
   const originalLine=lineRange(source,record.ownershipGuardLines[record.fieldBindings.indexOf(binding)]).original;
   if(!originalLine.includes(binding.originalGetter)||record.replacement.includes(binding.originalGetter))throw Error('Challenge field snapshot/get-once contract');
  }
  if(record.kind==='registry-display-complete-event'){
   const enNames=templateTokens(record.english).filter(t=>t.parameter).map(t=>t.parameter).sort();
   const jaNames=templateTokens(record.japanese).filter(t=>t.parameter).map(t=>t.parameter).sort();
   if(JSON.stringify(enNames)!==JSON.stringify(jaNames)||JSON.stringify(enNames)!==JSON.stringify(Object.keys(record.parameters).sort()))throw Error(`Target event placeholders: ${record.id}`);
   const originalStrings=scanSource(record.original,'pascal').tokens.filter(t=>t.kind==='string');
   const originalEnglish=originalStrings.map(t=>t.value).join('{{mode}}');
   if(originalEnglish!==record.english)throw Error(`Target event original English reconstruction: ${record.id}`);
   if(record.replacement.includes('Format(')||(record.replacement.match(/iItem\.GetAltFireName/g)??[]).length!==1)throw Error(`Target event get-once/Format contract: ${record.id}`);
   render({[record.id]:record.english},{[record.id]:record.parameters},record.id,{mode:'test'});
   render({[record.id]:record.japanese},{[record.id]:record.parameters},record.id,{mode:'test'});
   parameters+=enNames.length;
  }
 }
 const helper=registryDisplayPresentationUnit.implementation;
 if(/\b(?:Random|Randomize|Roll|AddPerk|RemovePerk|GetBonus|SetPerk)\b|PerkData\[[^\]]+\]\.[A-Za-z]+\s*:=/i.test(helper))throw Error('Presentation helper may write domain state or RNG');
 if((helper.match(/LuaSystem\.ProtectedCall/g)??[]).length!==1||(helper.match(/aThing\.GetPerkShort\(iNID\)/g)??[]).length!==1)throw Error('Trait list original callback count contract');
 if(!helper.includes("if iText = '' then Continue;\n      if iField <> ''"))throw Error('Trait list original empty branch must precede localization');
 if(!helper.includes("if not (Hook_OnShort in Hooks) then iField := 'short';")||!helper.includes("(Hook_OnShort in PerkData[aNID].Hooks) then Exit(aEnglish);"))throw Error('Custom OnShort output must stay opaque');
 const termHelper=registryDisplayTermPresentationUnit.implementation;
 for(const t of registryDisplayFiniteTerms)if(!termHelper.includes(`if aEnglish = '${t.english}' then Exit(DRLText('${t.id}', aEnglish)) else Exit(aEnglish);`))throw Error(`Finite term exact runtime English guard: ${t.id}`);
 if(termHelper.includes('Padded(')||!termHelper.includes('iColumns := VTIG_Length(iName);')||!termHelper.includes("StringOfChar(' ', 7 - iColumns)"))throw Error('Resistance resolved CJK label must not be cropped');
 const projection=result.descriptionBox;
 for(const r of projection.rowRecords){
  if(sources[r.file].slice(r.start,r.end)!==r.original)throw Error(`DescriptionBox row source guard: ${r.line}`);
  const names=templateTokens(r.english).filter(t=>t.parameter).map(t=>t.parameter);
  const jaNames=templateTokens(r.japanese).filter(t=>t.parameter).map(t=>t.parameter);
  if(JSON.stringify(names)!==JSON.stringify(jaNames)||names.length!==1||names[0]!=='value')throw Error(`DescriptionBox placeholder contract: ${r.id}`);
  const binding=r.bindings[0];
  const [prefix,tail]=r.original.split(binding.expression);
  if(tail===undefined)throw Error(`DescriptionBox original binding guard: ${r.line}`);
  const reconstruct=fragment=>scanSource(fragment,'pascal').tokens.filter(t=>['string','character-code'].includes(t.kind)).map(t=>t.value).join('');
  if(reconstruct(prefix)+'{{value}}'+reconstruct(tail)!==r.english)throw Error(`DescriptionBox full original English: ${r.line}`);
  if(r.parameters.value==='integer'&&!/^IntToStr\([A-Za-z0-9.]+\)$/.test(binding.expression))throw Error(`DescriptionBox numeric source contract: ${r.line}`);
  const value=r.parameters.value==='integer'?7:'sample';
  const renderedEn=render({[r.id]:r.english},{[r.id]:r.parameters},r.id,{value});
  const renderedJa=render({[r.id]:r.japanese},{[r.id]:r.parameters},r.id,{value});
  if(!renderedEn.endsWith('\n')||!renderedJa.endsWith('\n')||renderedEn.indexOf(':')!==12||displayCells(renderedJa.slice(0,renderedJa.indexOf(':')))!==12)throw Error(`DescriptionBox CJK/control layout contract: ${r.line}`);
  if((r.replacement.match(/DRL(?:String|Integer)Param\(/g)??[]).length!==1)throw Error(`DescriptionBox typed binding arity: ${r.line}`);
 }
 const tokensFor=s=>scanSource(s,'pascal').tokens;
 const originalTokens=tokensFor(projection.originalMethod),projectedTokens=tokensFor(projection.implementation);
 const count=(tokens,name)=>tokens.filter(t=>t.kind==='identifier'&&t.raw.toLowerCase()===name.toLowerCase()).length;
 for(const name of ['IIf','GetAltFireName','GetAltReloadName','GetFirstPerkDescription','GetResistance','HasHook','BonusStr','Seconds','Percent','DamageTypeName'])
  if(count(originalTokens,name)!==count(projectedTokens,name))throw Error(`DescriptionBox original evaluation count: ${name}`);
 if(projectedTokens.some(t=>t.kind==='identifier'&&t.raw==='DescriptionBox'))throw Error('Projection must not call or overwrite original DescriptionBox');
 return {...result.counts,verifiedHashes:Object.keys(sources).length,
  guardedSourceSites:result.records.length+result.skippedOwned.length,typedEventParameters:parameters,
  helperSourceSha256:digest(helper),termHelperSourceSha256:digest(registryDisplayTermPresentationUnit.implementation),
  descriptionBoxMethodSha256:digest(projection.implementation),descriptionBoxOriginalGetterCountsPreserved:true,
  originalDomainModified:false,nativeOrBrowserExecuted:false};
}
