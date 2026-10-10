/** Original registry array/function presentation seams, preserving source identities and conditions. */
import {createHash} from 'node:crypto';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {reviewedRequirementDescriptions,reviewedBadgeTierNames,reviewedRankGroupTexts,verifyMiscRegistryFields} from './registry-perks-ranks.mjs';
const q=JSON.stringify,pas=s=>`'${s.replaceAll("'","''")}'`;
export function curateMiscRegistrySites({file,exact,catalog,patches}){
 verifyMiscRegistryFields();
 const f='bin/data/drl/ranks.lua',source=file(f);
 for(const tier of reviewedBadgeTierNames)catalog(tier.id,tier.english,tier.japanese);
 for(const group of reviewedRankGroupTexts)catalog(group.id,group.english,group.japanese,group.parameters??{});
 for(const r of reviewedRequirementDescriptions){
  const raw=source.slice(r.source.offset,r.source.endOffset);if(createHash('sha256').update(raw).digest('hex')!==r.source.sha256)throw Error(`Requirement function guard ${r.registryId}`);
  for(const b of r.branches){
   catalog(b.id,b.english,b.japanese,Object.fromEntries(b.bindings.map(p=>[p.name,p.type])));
   const bindings=b.bindings.map(p=>{
    let expression=p.presentationExpression;
    if(p.name==='tier')expression=`ui.semantic_text(({${reviewedBadgeTierNames.map(t=>q(t.id)).join(', ')}})[param], names[param])`;
    if(p.type==='integer')expression=`tostring(${expression})`;
    return `{name=${q(p.name)},kind=${q(p.type)},value=${expression}}`;
   });
   exact(f,'return '+b.originalReturnExpression+'\r\n',`return ui.semantic_text(${q(b.id)}, ${q(b.english)}, {${bindings.join(', ')}})\r\n`,b.id);
  }
 }
 const rankup='src/drlrankupview.pas';
 exact(rankup,"iRank := LuaSystem.Get(['ranks',aRank.Data[i].ID,aRank.Data[i].Value+1,'name'],'');",`iRank := DRLRegistryText('rank', aRank.Data[i].ID + ':' + IntToStr(aRank.Data[i].Value + 1), 'base_game', 'name',\r\n        AnsiString(LuaSystem.Get(['ranks',aRank.Data[i].ID,aRank.Data[i].Value+1,'name'],'')));`);
 const [skill,exp]=reviewedRankGroupTexts.filter(g=>g.field==='award');
 exact(rankup,'FLines[iSize] := Format( iDesc, [iRank] );',`if (aRank.Data[i].ID = 'skill') and (iDesc = ${pas(skill.englishOriginal)}) then\r\n        FLines[iSize] := DRLText(${pas(skill.id)}, ${pas(skill.english)}, [DRLStringParam('rank', iRank)])\r\n      else if (aRank.Data[i].ID = 'exp') and (iDesc = ${pas(exp.englishOriginal)}) then\r\n        FLines[iSize] := DRLText(${pas(exp.id)}, ${pas(exp.english)}, [DRLStringParam('rank', iRank)])\r\n      else FLines[iSize] := Format(iDesc, [iRank]);`);
 for(const [id,needle,index,registry]of [
  ['rank-next',"LuaSystem.Get(['ranks', aRankID, aCurrent+2,'name'])",'aCurrent+2','aRankID'],
  ['rank-current',"LuaSystem.Get([ 'ranks', iID, iRank+1, 'name' ])",'iRank+1','iID']
 ])exact('src/dfhof.pas',needle,`DRLRegistryText('rank', ${registry} + ':' + IntToStr(${index}), 'base_game', 'name', AnsiString(${needle}))`);
 exact('src/dfhof.pas',"LuaSystem.Get([ 'ranks', iID, 'name' ], '' )",`DRLRegistryText('rank_group', iID, 'base_game', 'name', AnsiString(LuaSystem.Get([ 'ranks', iID, 'name' ], '' )))`);
 const level='src/dflevel.pas',original="IO.Msg( GetString('welcome') )";
 exact(level,original,"IO.Msg(DRLRegistryText('level', FID, 'base_game', 'welcome', GetString('welcome')))",null);
 return {requiredUnits:{'src/drlrankupview.pas':['drlsemantictext','drlsemanticregistry'],'src/dfhof.pas':['drlsemanticregistry'],'src/dflevel.pas':['drlsemanticregistry']}};
}
