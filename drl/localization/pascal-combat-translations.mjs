/** Exact-source presentation proposals for DRL combat, examination and cursor text.
 * GPL-2.0; baseline 0_10_11a, a6f965072b3a25b768c91dbced00367f1b57d865.
 * Original English getters, fields, hook arguments, saved data and RNG remain intact.
 */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {scanMessageCalls} from './message-inventory.mjs';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {tokens as templateTokens,render} from './render.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const digest=b=>createHash('sha256').update(b).digest('hex');
const pas=s=>`'${s.replaceAll("'","''")}'`;
const normalize=s=>scanSource(s,'pascal').tokens.map(t=>t.raw).join('');
const crlf=s=>s.replaceAll('\n','\r\n');
export const pascalCombatSourceLocks=Object.freeze({
 'src/dfbeing.pas':{bytes:122430,sha256:'05c15eb6b57b867c1378995bc730d88acde40d2313ff5d292a1cb33ee725e3a7'},
 'src/dfplayer.pas':{bytes:29088,sha256:'7068d0645251a65e63438cd007a17e9751d78b358958bd41599378f15bf5f13b'},
 'src/drlbase.pas':{bytes:59189,sha256:'5e8c6007bbf6ae53c371a150d2f3d1d16ed1a3844ffa65ec05f974aa2824df57'},
 'src/dfdata.pas':{bytes:31417,sha256:'346395d359820361e1ce7708c169c9404b0f6614ef6634f889dbd33f05f955ae'},
 'src/dflevel.pas':{bytes:70572,sha256:'9d21d5c5a908fd9f6c9ea7b37ed25be83051a39bff0d2b834db7039899eeecaf'},
 'src/dfmap.pas':{bytes:6282,sha256:'9e0db5c43ffcfcb5411f878c4d829210dde4b601782689189cdeed7fcc40290e'},
});
const terms=[];
const term=(id,english,japanese,parameters={})=>{const r={id,english,japanese,parameters};terms.push(r);return r;};
term('entity.player.you','you','あなた');
term('entity.player.you-sentence','You','あなた');
for(const [verb,japanese]of [['hit','{{subject}}は{{target}}に攻撃を当てた。'],['miss','{{subject}}の攻撃は{{target}}に当たらなかった。']]){
 term(`message.melee-${verb}.player`,`{{subject}} ${verb} {{target}}.`,japanese,{subject:'string',target:'string'});
 term(`message.melee-${verb}.observer`,`{{subject}} ${verb==='hit'?'hits':'misses'} {{target}}.`,japanese,{subject:'string',target:'string'});
}
for(const [suffix,english,japanese]of [
 ['destroyed','completely destroyed!','完全に壊れた！'],['damaged','damaged!','損傷した！']
])for(const [kind,verb]of [['torso','is'],['feet','are']])term(`message.armor-${suffix}.${kind}`,`Your {{item}} ${verb} ${english}`,`{{item}}が${japanese}`,{item:'string'});
term('message.missile-hits','The missile hits {{target}}.','飛翔物が{{target}}に命中した。',{target:'string'});
term('message.hit.player-default','You are hit!','攻撃を受けた！');
term('message.examine-being','You see {{being}} ({{condition}}) {{coordinate}}.','{{coordinate}}に{{being}}がいる（{{condition}}）。',{being:'string',condition:'string',coordinate:'string'});
term('message.examine-item','You see {{item}} {{coordinate}}.','{{coordinate}}に{{item}}がある。',{item:'string',coordinate:'string'});
term('message.door-none.open',"There's no door you can open here.",'ここには開けられる扉がない。');
term('message.door-none.close',"There's no door you can close here.",'ここには閉められる扉がない。');
term('message.door-none.custom',"There's no door you can {{action}} here.",'ここには{{action}}できる扉がない。',{action:'string'});
term('message.level-enter','You enter {{level}}.','{{level}}に入った。',{level:'string'});
term('view.door-action','Action','操作');
term('view.door-open','Open door','扉を開ける');
term('view.door-close','Close door','扉を閉める');
term('view.look-being','{{being}} ({{condition}})','{{being}}（{{condition}}）',{being:'string',condition:'string'});
term('view.target-being','{{being}} ({{condition}})','{{being}}（{{condition}}）',{being:'string',condition:'string'});
term('view.out-of-vision','out of vision','視界外');
const woundRows=[
 ['dead','dead','死亡'],['almost-dead','almost dead','瀕死'],['mortally-wounded','mortally wounded','致命傷'],
 ['severely-wounded','severely wounded','重度の負傷'],['heavily-wounded','heavily wounded','大きな負傷'],
 ['wounded','wounded','負傷'],['lightly-wounded','lightly wounded','軽傷'],['scratched','scratched','かすり傷'],
 ['almost-unhurt','almost unhurt','ほぼ無傷'],['unhurt','unhurt','無傷'],['boosted','boosted','体力強化'],['cheated','cheated','異常な体力'],
];
for(const [suffix,english,japanese]of woundRows)term('entity.condition.'+suffix,english,japanese);
for(const [suffix,letter,japanese]of [['south','s','南'],['north','n','北'],['east','e','東'],['west','w','西']])term('entity.coordinate.'+suffix,'{{distance}}'+letter,japanese+'{{distance}}',{distance:'integer'});
term('entity.coordinate.here','[here]','[現在地]');
term('entity.coordinate.relative','[{{vertical}}{{horizontal}}]','[{{vertical}}{{horizontal}}]',{vertical:'string',horizontal:'string'});
export const reviewedPascalCombatTerms=Object.freeze(terms.map(Object.freeze));
const byId=Object.fromEntries(terms.map(t=>[t.id,t]));
const binding=(name,kind,originalExpression,presentationExpression=originalExpression)=>({name,kind,originalExpression,presentationExpression});
const paramsCode=bindings=>bindings.map(b=>`DRL${b.kind==='integer'?'Integer':'String'}Param(${pas(b.name)}, ${b.presentationExpression})`).join(', ');
const textCode=(id,bindings=[])=>`DRLText(${pas(id)}, ${pas(byId[id].english)}${bindings.length?`, [${paramsCode(bindings)}]`:''})`;
const supports=[];
const support=(file,original,replacement,role,ids=[])=>supports.push({file,original,replacement,role,ids,kind:'combat-presentation-support'});
const being='src/dfbeing.pas',player='src/dfplayer.pas',base='src/drlbase.pas',level='src/dflevel.pas';
support(being,'function GetName( known : boolean ) : string;','function GetName( known : boolean ) : string;\r\n    function PresentationNameValue(const aEnglish: AnsiString; aKnown: Boolean; aSentence: Boolean = False): AnsiString;','declaration-presentation-name-snapshot');
support(being,'function  WoundStatus : string;','function  WoundStatus : string;\r\n    function PresentationWoundStatusValue(const aEnglish: AnsiString): AnsiString;','declaration-presentation-status-snapshot');
const nameHelper=crlf(`{ Presentation consumes the original English getter once; custom values retain their source text. }
function TBeing.PresentationNameValue(const aEnglish: AnsiString; aKnown: Boolean; aSentence: Boolean): AnsiString;
var iExpected: AnsiString;
begin
  iExpected := Name;
  if not (BF_UNIQUENAME in FFlags) then
    if aKnown then iExpected := 'the ' + Name
              else iExpected := Preposition(Name) + Name;
  if aEnglish <> iExpected then
  begin
    if aSentence then Exit(Capitalized(aEnglish));
    Exit(aEnglish);
  end;
  Exit(PresentationName(aKnown, aSentence));
end;

function TBeing.PresentationWoundStatusValue(const aEnglish: AnsiString): AnsiString;
begin
${woundRows.map(([suffix,english])=>`  if aEnglish = ${pas(english)} then Exit(${textCode('entity.condition.'+suffix)});`).join('\n')}
  Exit(aEnglish);
end;

`);
support(being,'function TBeing.GetName(known : boolean) : string;',nameHelper+'function TBeing.GetName(known : boolean) : string;','implementation-guarded-being-projections',woundRows.map(([s])=>'entity.condition.'+s));
support(being,'function TBeing.Attack( aTarget : TBeing; aSecond : Boolean = False; aWeapon : TItem = nil ) : Boolean;\r\nvar iName          : string;\r\n    iDefenderName  : string;\r\n    iResult        : string;',
 'function TBeing.Attack( aTarget : TBeing; aSecond : Boolean = False; aWeapon : TItem = nil ) : Boolean;\r\nvar iName          : string;\r\n    iDefenderName  : string;\r\n    iResult        : string;\r\n    iDisplayName, iDefenderDisplayName, iMessageID, iMessageEnglish: AnsiString;',
 'attack-presentation-snapshots-declaration');
support(being,'iName         := GetName( true );\r\n  iDefenderName := aTarget.GetName( true );\r\n  if IsPlayer         then iName         := \'you\';\r\n  if aTarget.IsPlayer then iDefenderName := \'you\';',
 crlf(`iName         := GetName( true );
  iDefenderName := aTarget.GetName( true );
  iDisplayName := PresentationNameValue(iName, True, True);
  iDefenderDisplayName := aTarget.PresentationNameValue(iDefenderName, True);
  if IsPlayer then
  begin
    iName := 'you';
    iDisplayName := ${textCode('entity.player.you-sentence')};
  end;
  if aTarget.IsPlayer then
  begin
    iDefenderName := 'you';
    iDefenderDisplayName := ${textCode('entity.player.you')};
  end;`),
 'attack-display-snapshots-before-original-onfire-hooks',['entity.player.you','entity.player.you-sentence']);
for(const [verb,result]of [['miss','misses'],['hit','hits']])support(being,`if IsPlayer then iResult := ' ${verb} ' else iResult := ' ${result} ';`,
 crlf(`if IsPlayer then
      begin
        iResult := ' ${verb} ';
        iMessageID := 'message.melee-${verb}.player';
        iMessageEnglish := ${pas(byId[`message.melee-${verb}.player`].english)};
      end
      else
      begin
        iResult := ' ${result} ';
        iMessageID := 'message.melee-${verb}.observer';
        iMessageEnglish := ${pas(byId[`message.melee-${verb}.observer`].english)};
      end;`),
 `attack-${verb}-same-player-observer-selection`,[`message.melee-${verb}.player`,`message.melee-${verb}.observer`]);
support(being,'iFireDesc   : Ansistring;','iFireDesc   : Ansistring;\r\n    iDefaultFireDesc: Boolean;','projectile-description-origin-declaration');
support(being,"iFireDesc := LuaSystem.Get(['items',aItem.NID,'hitdesc'], '');","iFireDesc := LuaSystem.Get(['items',aItem.NID,'hitdesc'], '');\r\n              iDefaultFireDesc := iFireDesc = '';",'capture-default-description-origin-before-original-assignment');
const coordinateHelper=crlf(`{ Relative coordinates are a presentation projection; BlindCoord remains unchanged. }
function DRLPresentationBlindCoord(const aEnglish: AnsiString; const aWhere: TCoord2D): AnsiString;
var iExpected, iVertical, iHorizontal: AnsiString;
begin
  iExpected := '[';
  if aWhere.y > 0 then iExpected += IntToStr(aWhere.y) + 's';
  if aWhere.y < 0 then iExpected += IntToStr(-Int64(aWhere.y)) + 'n';
  if aWhere.x > 0 then iExpected += IntToStr(aWhere.x) + 'e';
  if aWhere.x < 0 then iExpected += IntToStr(-Int64(aWhere.x)) + 'w';
  if (aWhere.x = 0) and (aWhere.y = 0) then iExpected += 'here';
  iExpected += ']';
  if aEnglish <> iExpected then Exit(aEnglish);
  if (aWhere.x = 0) and (aWhere.y = 0) then Exit(${textCode('entity.coordinate.here')});
  iVertical := '';
  iHorizontal := '';
  if aWhere.y > 0 then iVertical := ${textCode('entity.coordinate.south',[binding('distance','integer','Int64(aWhere.y)')])};
  if aWhere.y < 0 then iVertical := ${textCode('entity.coordinate.north',[binding('distance','integer','-Int64(aWhere.y)')])};
  if aWhere.x > 0 then iHorizontal := ${textCode('entity.coordinate.east',[binding('distance','integer','Int64(aWhere.x)')])};
  if aWhere.x < 0 then iHorizontal := ${textCode('entity.coordinate.west',[binding('distance','integer','-Int64(aWhere.x)')])};
  Exit(${textCode('entity.coordinate.relative',[binding('vertical','string','iVertical'),binding('horizontal','string','iHorizontal')])});
end;

`);
support(player,'procedure TPlayer.ExamineNPC;',coordinateHelper+'procedure TPlayer.ExamineNPC;','implementation-relative-coordinate-projection',terms.filter(t=>t.id.startsWith('entity.coordinate.')).map(t=>t.id));
const doorHelper=crlf(`function DRLPresentationDoorTitle(const aAction, aEnglish: AnsiString): AnsiString;
begin
  if (aAction = 'open') and (aEnglish = 'Open door') then Exit(${textCode('view.door-open')});
  if (aAction = 'close') and (aEnglish = 'Close door') then Exit(${textCode('view.door-close')});
  Exit(aEnglish);
end;

`);
support(base,'function TDRL.HandleActionCommand( aInput : TInputKey ) : Boolean;',doorHelper+'function TDRL.HandleActionCommand( aInput : TInputKey ) : Boolean;','implementation-guarded-door-title',['view.door-open','view.door-close']);
const expressionRows=[];
const expression=(file,line,original,replacement,role,ids=[])=>expressionRows.push({file,line,original,replacement,role,ids,kind:'combat-presentation-view'});
expression(base,623,"'Action'",textCode('view.door-action'),'door-action-heading',['view.door-action']);
expression(base,624,"Capitalized(iID)+' door'","DRLPresentationDoorTitle(iID, Capitalized(iID)+' door')",'guarded-door-action-heading',['view.door-open','view.door-close']);
expression(level,1701,"GetName( false ) + ' (' + WoundStatus + ')'",textCode('view.look-being',[
 binding('being','string','GetName( false )','PresentationNameValue(GetName(False), False)'),
 binding('condition','string','WoundStatus','PresentationWoundStatusValue(WoundStatus)'),
]),'cursor-being-name-and-condition',['view.look-being']);
expression(level,1702,'Item[ aWhere ].GetExtName( False )','Item[ aWhere ].PresentationExtName(False)','cursor-item-description-projection');
for(const [line,field,member]of [[1709,'blname','bldesc'],[1710,'name','desc']])expression(level,line,`Cells[ GetCell(aWhere) ].${member}`,
 `DRLRegistryText('cell', AnsiString(LuaSystem.Get(['cells', iCellID, 'id'])), 'base_game', '${field}', Cells[ GetCell(aWhere) ].${member})`,
 `cursor-cell-${field}-exact-registry-guard`);
for(const line of [1713,1731])expression(level,line,"'out of vision'",textCode('view.out-of-vision'),'cursor-out-of-vision',['view.out-of-vision']);
expression(level,1734,"iBeing.Name + ' (' + iBeing.WoundStatus + ')'",textCode('view.target-being',[
 binding('being','string','iBeing.Name',"DRLRegistryText('being', iBeing.ID, 'base_game', 'name', iBeing.Name)"),
 binding('condition','string','iBeing.WoundStatus','iBeing.PresentationWoundStatusValue(iBeing.WoundStatus)'),
]),'target-being-name-and-condition',['view.target-being']);
const callRows=[];
const message=(file,line,id,bindings,proof={},replacement=null,variantIds=[])=>callRows.push({file,line,id,bindings,proof,replacement,variantIds,kind:'semantic-message'});
for(const [line,verb]of [[2028,'miss'],[2044,'hit']])message(being,line,`message.melee-${verb}.player`,[
 binding('subject','string','Capitalized(iName)','iDisplayName'),binding('target','string','iDefenderName','iDefenderDisplayName'),
],{kind:'selected-concatenation',verb,producer:`if IsPlayer then iResult := ' ${verb} ' else iResult := ' ${verb==='hit'?'hits':'misses'} ';`},
 "IO.Msg(DRLText(iMessageID, iMessageEnglish, [DRLStringParam('subject', iDisplayName), DRLStringParam('target', iDefenderDisplayName)]))",
 [`message.melee-${verb}.player`,`message.melee-${verb}.observer`]);
for(const [line,suffix,kind]of [[2232,'destroyed','torso'],[2233,'destroyed','feet'],[2237,'damaged','torso'],[2238,'damaged','feet']])message(being,line,`message.armor-${suffix}.${kind}`,
 [binding('item','string','iArmor.Name',"DRLRegistryText('item', iArmor.ID, 'base_game', 'name', iArmor.Name)")],{kind:'concatenation'});
message(being,2541,'message.missile-hits',[binding('target','string','iBeing.GetName(true)','iBeing.PresentationNameValue(iBeing.GetName(True), True)')],{kind:'concatenation'});
message(being,2539,'message.hit.player-default',[],{kind:'guarded-registry-dispatch',originalExpression:'Capitalized( iFireDesc )'},
 `if iDefaultFireDesc then IO.Msg(${textCode('message.hit.player-default')})\r\n              else IO.Msg(DRLRegistryText('item', aItem.ID, 'base_game', 'hitdesc', Capitalized(iFireDesc)))`,
 ['message.hit.player-default','term.item.nat-arch.hitdesc','term.item.nat-narch.hitdesc','term.item.nat-apostle.hitdesc']);
message(player,449,'message.examine-being',[
 binding('being','string','GetName(false)','PresentationNameValue(GetName(False), False)'),
 binding('condition','string','WoundStatus','PresentationWoundStatusValue(WoundStatus)'),
 binding('coordinate','string','BlindCoord(iWhere-Self.FPosition)','DRLPresentationBlindCoord(BlindCoord(iWhere-Self.FPosition), iWhere-Self.FPosition)'),
],{kind:'concatenation'});
message(player,467,'message.examine-item',[
 binding('item','string','GetName(false)','PresentationNameValue(GetName(False), False)'),
 binding('coordinate','string','BlindCoord(iWhere-Self.FPosition)','DRLPresentationBlindCoord(BlindCoord(iWhere-Self.FPosition), iWhere-Self.FPosition)'),
],{kind:'concatenation'});
message(base,616,'message.door-none.open',[binding('action','string','iID')],{kind:'selected-printf',names:['action']},
 crlf(`begin
        if iID = 'open' then IO.Msg(${textCode('message.door-none.open')})
        else if iID = 'close' then IO.Msg(${textCode('message.door-none.close')})
        else IO.Msg(${textCode('message.door-none.custom',[binding('action','string','iID')])});
      end`),['message.door-none.open','message.door-none.close','message.door-none.custom']);
message(base,1440,'message.level-enter',[binding('level','string','FLevel.Name')],{kind:'printf',names:['level']});
export const pendingPascalCombatProducers=Object.freeze([
 {file:being,line:2300,role:'being-death-event-producer',reason:'Generic GetDeathMessage dispatcher must retain external Lua module text; original drl.GetDeathMessage producer is localized separately by the integrating curator.'},
 {file:base,line:1440,role:'ordinary-episode-level-name',reason:'Event is translated; FLevel.Name remains original. Phobos/Deimos/Hell/Beyond/Phobos Hell names need structured episode producer metadata, including challenge overrides; no parsing of arbitrary rendered level names.'},
 {file:level,line:1704,role:'custom-cell-on-describe-hook',reason:'Existing CallHook is retained once. Original finite cell hook producers require separate exact-ID text seams; arbitrary external module hook text remains verbatim.'},
 {file:level,line:1702,role:'custom-item-on-describe-hook',reason:'PresentationExtName preserves the existing OnDescribe hook once and localizes the default name. Finite built-in hook-produced names need their own exact producer seams; unknown custom text remains verbatim.'},
]);
function sourceData(sourceRoot,sourceOverrides){
 const data={};for(const [file,lock]of Object.entries(pascalCombatSourceLocks)){
  const bytes=Object.hasOwn(sourceOverrides,file)?Buffer.from(sourceOverrides[file],'utf8'):readFileSync(path.join(sourceRoot,file));
  if(bytes.length!==lock.bytes||digest(bytes)!==lock.sha256)throw Error(`Pascal combat source provenance mismatch: ${file}`);
  const source=bytes.toString('utf8'),scanned=scanSource(source,'pascal');
  if(scanned.diagnostics.length)throw Error(`Pascal combat lexical diagnostic: ${file}`);
  data[file]={source,tokens:scanned.tokens,calls:scanMessageCalls(source,'pascal',file)};
 }
 return data;
}
function exactRecord(data,row){
 const source=data[row.file].source,newline=source.includes('\r\n')?'\r\n':'\n';row={...row,original:row.original.replaceAll('\r\n',newline),replacement:row.replacement.replaceAll('\r\n',newline)};let start;
 if(row.line){const lines=source.split('\n'),line=lines[row.line-1],within=line.indexOf(row.original);if(within<0||line.indexOf(row.original,within+1)>=0)throw Error(`Pascal combat exact line guard failed: ${row.file}:${row.line}:${row.role??row.id}`);start=lines.slice(0,row.line-1).join('\n').length+(row.line>1?1:0)+within;}
 else{start=source.indexOf(row.original);if(start<0||source.indexOf(row.original,start+1)>=0)throw Error(`Pascal combat exact source guard failed: ${row.file}:${row.role}`);}
 return {...row,start,end:start+row.original.length,line:source.slice(0,start).split('\n').length,sourceSha256:pascalCombatSourceLocks[row.file].sha256};
}
const overlaps=(manifest,r)=>(manifest.patches??[]).filter(p=>p.file===r.file&&p.start<r.end&&p.end>r.start);
function reconstructConcatenation(expression,bindings){
 const ts=scanSource(expression,'pascal').tokens,parts=[];let start=0,depth=0;
 for(const t of ts){if(t.raw==='('||t.raw==='[')depth++;if(t.raw===')'||t.raw===']')depth--;if(t.raw==='+'&&depth===0){parts.push(expression.slice(start,t.start).trim());start=t.end;}}
 parts.push(expression.slice(start).trim());
 return parts.map(part=>{
  if(/^(?:'(?:[^']|'')*'|#[0-9]+|\s)+$/.test(part))return Array.from(part.matchAll(/'((?:[^']|'')*)'|#([0-9]+)/g),m=>m[2]?String.fromCharCode(Number(m[2])):m[1].replaceAll("''","'")).join('');
  const b=bindings.find(b=>normalize(part)===normalize(b.originalExpression));
  if(b)return `{{${b.name}}}`;
  throw Error(`Unreconstructed Pascal combat operand: ${part}`);
 }).join('');
}
/** All proposals carry exact pinned byte hashes and UTF-8 source intervals. */
export function buildPascalCombatTranslations(sourceRoot=path.resolve(here,'../upstream/drl'),{manifest={patches:[]},sourceOverrides={}}={}){
 const data=sourceData(sourceRoot,sourceOverrides),records=[],supportRecords=[],viewRecords=[],alreadyPatched=[];
 const add=(r,target)=>{const existing=overlaps(manifest,r);if(existing.length){alreadyPatched.push({...r,existingPatches:existing.map(p=>p.id??p.kind)});return;}target.push(r);};
 for(const row of callRows){
  const calls=data[row.file].calls.filter(c=>c.line===row.line);if(calls.length!==1)throw Error(`Pascal combat call guard failed: ${row.file}:${row.line}`);
  const c=calls[0],newline=data[row.file].source.includes('\r\n')?'\r\n':'\n',r={...row,key:c.key,start:c.start,end:c.end,original:c.original,source:c.original,sourceSha256:pascalCombatSourceLocks[row.file].sha256,replacement:(row.replacement??`IO.Msg(${textCode(row.id,row.bindings)})`).replaceAll('\r\n',newline),parameters:byId[row.id].parameters,english:byId[row.id].english,japanese:byId[row.id].japanese};
  if(row.proof.kind==='concatenation'){r.proof.reconstructed=reconstructConcatenation(c.arguments[0].source,row.bindings);if(r.proof.reconstructed!==r.english)throw Error(`Pascal combat English concatenation changed: ${r.id}`);}
  if(row.proof.kind==='selected-concatenation'){
   if(!data[row.file].source.includes(row.proof.producer))throw Error(`Pascal combat selection producer changed: ${r.id}`);
   const reconstructed=reconstructConcatenation(c.arguments[0].source,[...row.bindings,binding('verb','string','iResult')]);
   if(reconstructed!=='{{subject}}{{verb}}{{target}}.')throw Error(`Pascal melee reconstruction changed: ${r.id}`);
   r.proof.reconstructed=reconstructed;
  }
  if(row.proof.kind.includes('printf')){
   const format=c.arguments[0].strings?.[0]?.value;
   if(!format||c.arguments[1]?.source.replaceAll(/\s/g,'')!==`[${row.bindings.map(b=>b.originalExpression.replaceAll(/\s/g,'')).join(',')}]`)throw Error(`Pascal combat printf argument order changed: ${r.id}`);
   let index=0;const reconstructed=format.replace(/%%|%s/g,s=>s==='%%'?'%':`{{${row.proof.names[index++]}}}`);
   const expected=row.proof.kind==='selected-printf'?byId['message.door-none.custom'].english:r.english;
   if(index!==row.proof.names.length||reconstructed!==expected)throw Error(`Pascal combat printf English changed: ${r.id}`);
   r.proof.printfFormat=format;r.proof.reconstructed=reconstructed;
  }
  if(row.proof.kind==='guarded-registry-dispatch'){
   if(normalize(c.arguments[0].source)!==normalize(row.proof.originalExpression)||!data[being].source.includes("if iFireDesc = '' then iFireDesc := 'You are hit!';"))throw Error('Player projectile hit description producer changed');
   const registry=JSON.parse(readFileSync(path.join(here,'registration-term-catalog.json'),'utf8'));
   const expectedIds=r.variantIds.filter(id=>id.startsWith('term.item.'));
   for(const id of expectedIds)if(registry.englishCatalog[id]!=='You are engulfed in flames!')throw Error(`Missing guarded natural-attack hitdesc metadata: ${id}`);
   r.proof.reconstructed='Original Capitalized(iFireDesc) is evaluated before exact item-ID/scope/field/English registry lookup; original empty default assignment stays unchanged.';
  }
  add(r,records);
 }
 for(const row of supports)add(exactRecord(data,row),supportRecords);
 for(const row of expressionRows)add(exactRecord(data,{...row,id:row.ids.length===1?row.ids[0]:null}),viewRecords);
 const accountingRecords=[];
 const welcomeCalls=data[level].calls.filter(c=>c.line===222);
 if(welcomeCalls.length!==1||normalize(welcomeCalls[0].original)!==normalize("IO.Msg( GetString('welcome') )"))throw Error('Existing level welcome call source changed');
 const c=welcomeCalls[0],existing=overlaps(manifest,{file:level,start:c.start,end:c.end});
 if(existing.some(p=>normalize(p.replacement)===normalize("IO.Msg(DRLRegistryText('level', FID, 'base_game', 'welcome', GetString('welcome')))"))){
  const registry=JSON.parse(readFileSync(path.join(here,'registration-term-catalog.json'),'utf8'));
  const variantIds=Object.keys(registry.englishCatalog).filter(id=>id.startsWith('term.level.')&&id.endsWith('.welcome'));
  if(!variantIds.length)throw Error('Level welcome registry accounting has no guarded semantic IDs');
  accountingRecords.push({key:c.key,file:level,line:222,id:variantIds[0],variantIds,source:c.original,original:c.original,replacement:existing.find(p=>p.start<=c.start&&p.end>=c.end)?.replacement,registryCategory:'level',registryField:'welcome',sourceSha256:pascalCombatSourceLocks[level].sha256,accountingOnly:true,representativeRegistryId:true,note:'Already patched by misc-registry-sites.mjs with original FID/scope/English guard; the id is an accounting representative, while variantIds lists the actual registry choices. No duplicate source mutation.'});
 }
 const sorted=[...records,...supportRecords,...viewRecords].toSorted((a,b)=>a.file.localeCompare(b.file)||a.start-b.start);
 for(let i=1;i<sorted.length;i++)if(sorted[i].file===sorted[i-1].file&&sorted[i].start<sorted[i-1].end)throw Error(`Overlapping Pascal combat proposals: ${sorted[i].file}:${sorted[i].line}`);
 const woundBody=data[being].source.slice(data[being].source.indexOf('function  TBeing.WoundStatus : string;'),data[being].source.indexOf('function TBeing.TryMove'));
 for(const[,english]of woundRows)if(!woundBody.includes(`Exit(${pas(english)})`))throw Error(`Original WoundStatus producer changed: ${english}`);
 if(!data['src/dfmap.pas'].source.replaceAll('\r\n','\n').includes("iCell.Desc      := getString('name');\n    iCell.BlDesc    := getString('blname');"))throw Error('Original cell name/blname storage mapping changed');
 const blindBody=data['src/dfdata.pas'].source.slice(data['src/dfdata.pas'].source.indexOf('function BlindCoord( const where : TCoord2D ) : string;',data['src/dfdata.pas'].source.indexOf('implementation')));
 for(const piece of ["if where.y > 0 then BlindCoord += IntToStr(where.y)+'s';","if where.y < 0 then BlindCoord += IntToStr(-where.y)+'n';","if where.x > 0 then BlindCoord += IntToStr(where.x)+'e';","if where.x < 0 then BlindCoord += IntToStr(-where.x)+'w';","if (where.x = 0) and (where.y = 0) then BlindCoord += 'here';"])if(!blindBody.includes(piece))throw Error('Original BlindCoord producer changed');
 return {sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',sourceLocks:pascalCombatSourceLocks,terms:reviewedPascalCombatTerms,records,supportRecords,viewRecords,accountingRecords,alreadyPatched,pending:pendingPascalCombatProducers,requiredUnits:{[being]:['drlsemantictext','drlsemanticregistry'],[player]:['drlsemantictext'],[base]:['drlsemantictext'],[level]:['drlsemantictext','drlsemanticregistry']},originalDomainModified:false,nativeOrBrowserExecuted:false};
}
/** Integration hook used by the original-source overlay curator. */
export function curatePascalCombatSites({file,catalog,patches}){
 const result=buildPascalCombatTranslations(undefined,{manifest:{patches},sourceOverrides:Object.fromEntries(Object.keys(pascalCombatSourceLocks).map(f=>[f,file(f)]))});
 for(const t of result.terms)catalog(t.id,t.english,t.japanese,t.parameters);
 for(const r of [...result.records,...result.supportRecords,...result.viewRecords])patches.push({file:r.file,start:r.start,end:r.end,original:r.original,replacement:r.replacement,id:r.id??null,kind:r.kind});
 return{reviewed:[...result.records,...result.accountingRecords].map(r=>({key:r.key,id:r.id,source:r.source,replacement:r.replacement,...(r.variantIds?.length?{variantIds:r.variantIds}:{}),...(r.accountingOnly?{accountingOnly:true,registryCategory:r.registryCategory,registryField:r.registryField}:{})})),requiredUnits:result.requiredUnits,pending:result.pending,report:{newMessageCalls:result.records.length,existingAccountedCalls:result.accountingRecords.length,supportSites:result.supportRecords.length,viewSites:result.viewRecords.length,semanticIds:result.terms.length,alreadyPatched:result.alreadyPatched.length}};
}
/** Read-only lexical/source/English reconstruction checks; no Pascal execution. */
export function verifyPascalCombatTranslations(sourceRoot,options={}){
 const result=buildPascalCombatTranslations(sourceRoot,options);let renderedVariants=0,coordinateCases=0;
 for(const t of result.terms){
  const params=s=>Array.from(new Set(templateTokens(s).filter(x=>x.parameter).map(x=>x.parameter))).sort();
  if(JSON.stringify(params(t.english))!==JSON.stringify(params(t.japanese))||JSON.stringify(params(t.english))!==JSON.stringify(Object.keys(t.parameters).sort()))throw Error(`Pascal combat placeholder contract mismatch: ${t.id}`);
  const values=Object.fromEntries(Object.entries(t.parameters).map(([name,kind])=>[name,kind==='integer'?-(1n<<63n):`名前${name}% {{opaque}} {x} 😀`]));
  const en=render({[t.id]:t.english},{[t.id]:t.parameters},t.id,values),ja=render({[t.id]:t.japanese},{[t.id]:t.parameters},t.id,values);
  for(const value of Object.values(values))if(!en.includes(value)||!ja.includes(value))throw Error(`Pascal combat parameter changed: ${t.id}`);
  renderedVariants+=2;
 }
 for(const verb of ['hit','miss'])for(const playerActor of [true,false])for(const target of ['you','the imp','Zoe%{{name}}😀']){
  const id=`message.melee-${verb}.${playerActor?'player':'observer'}`,subject=playerActor?'You':'The imp',original=subject+' '+(playerActor?verb:verb==='hit'?'hits':'misses')+' '+target+'.';
  if(render({[id]:byId[id].english},{[id]:byId[id].parameters},id,{subject,target})!==original)throw Error('Melee English reconstruction changed');
  renderedVariants++;
 }
 for(const action of ['open','close','custom%{{verb}}']){
  const id=action==='open'?'message.door-none.open':action==='close'?'message.door-none.close':'message.door-none.custom';
  if(render({[id]:byId[id].english},{[id]:byId[id].parameters},id,byId[id].parameters.action?{action}:{})!==`There's no door you can ${action} here.`)throw Error('Door English reconstruction changed');
  renderedVariants++;
 }
 const catalog=Object.fromEntries(result.terms.map(t=>[t.id,t.english])),contracts=Object.fromEntries(result.terms.map(t=>[t.id,t.parameters]));
 for(const [x,y]of [[0n,0n],[2n,0n],[-2n,0n],[0n,3n],[0n,-3n],[2n,3n],[-2n,-3n],[-32768n,-32768n],[32767n,32767n]]){
  const piece=(direction,distance)=>render(catalog,contracts,'entity.coordinate.'+direction,{distance});
  const vertical=y>0?piece('south',y):y<0?piece('north',-y):'',horizontal=x>0?piece('east',x):x<0?piece('west',-x):'';
  const rendered=x===0n&&y===0n?render(catalog,contracts,'entity.coordinate.here',{}):render(catalog,contracts,'entity.coordinate.relative',{vertical,horizontal});
  const original='['+(y>0?`${y}s`:y<0?`${-y}n`:'')+(x>0?`${x}e`:x<0?`${-x}w`:'')+(x===0n&&y===0n?'here':'')+']';
  if(rendered!==original)throw Error('BlindCoord English reconstruction changed');coordinateCases++;
 }
 const projected=[...result.records,...result.supportRecords,...result.viewRecords].map(r=>r.replacement).join('\n');
 if(/DRL(?:Text|RegistryText)[^;]*\b(?:Roll|Random|RLongInt|CallHook|CallHookCheck)\(/s.test(projected))throw Error('Presentation proposal added a simulation operation');
 if(result.records.some(r=>r.replacement.startsWith('IO.Msg(')&&r.replacement.includes('], [')))throw Error('Localized final text must use one-argument IO.Msg');
 return{newMessageCalls:result.records.length,existingAccountedCalls:result.accountingRecords.length,supportSites:result.supportRecords.length,viewSites:result.viewRecords.length,semanticIds:result.terms.length,sourceFiles:Object.keys(result.sourceLocks).length,renderedVariants,coordinateCases,alreadyPatched:result.alreadyPatched.length,englishReconstructed:true,originalDomainModified:false,nativeOrBrowserExecuted:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyPascalCombatTranslations()));
