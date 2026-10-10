/** Generate a closed, reviewed item-name transition catalog for the Pascal adapter. */
const pas=s=>`'${s.replaceAll("'","''")}'`;
export function buildItemNameCatalog(aspects,registry){
 const bases=registry.metadata.filter(r=>r.category==='item'&&r.fields.name).map(r=>({id:r.registryId,english:r.fields.name.english}));
 const rules=aspects.rules;
 if(new Set(rules.map(r=>r.eventID)).size!==rules.length)throw Error('Duplicate item-name whitelist event');
 for(const r of rules)if(!['fixed','prefix','schematic'].includes(r.kind))throw Error('Unknown item-name rule');
 const unit=`{ Generated source-guarded original item-name transition rules. GPL-2.0. }
unit drlsemanticitemcatalog;
{$mode objfpc}{$H+}
interface
implementation
uses drlsemanticitemnames, drlsemanticregistry, drlsemantictext;
const BaseNames: array[0..${bases.length-1}] of record ID, English: AnsiString; end = (
${bases.map(b=>` (ID:${pas(b.id)};English:${pas(b.english)})`).join(',\n')}
);
const Rules: array[0..${rules.length-1}] of record
 EventID, SemanticID, EnglishTemplate, ExpectedPrefix, ExpectedFixed,
 RequiredPrototype, AssemblyID, AssemblyEnglish: AnsiString;
 Kind: Byte;
end = (
${rules.map(r=>` (EventID:${pas(r.eventID)};SemanticID:${pas(r.semanticID)};EnglishTemplate:${pas(r.englishTemplate)};ExpectedPrefix:${pas(r.prefix??'')};ExpectedFixed:${pas(r.fixedEnglish??'')};RequiredPrototype:${pas(r.requiredPrototypeId??'')};AssemblyID:${pas(r.assemblyRegistryId??'')};AssemblyEnglish:${pas(r.assemblyEnglish??'')};Kind:${{fixed:0,prefix:1,schematic:2}[r.kind]})`).join(',\n')}
);
function ValidateBase(const aPrototypeID, aEnglish: AnsiString): Boolean;
var i: SizeInt;
begin
 for i:=0 to High(BaseNames) do if (BaseNames[i].ID=aPrototypeID) and (BaseNames[i].English=aEnglish) then Exit(True);
 Exit(False);
end;
function ValidateTransition(const aPrototypeID, aAspectID, aBeforeEnglish, aAfterEnglish: AnsiString): Boolean;
var i: SizeInt;
begin
 for i:=0 to High(Rules) do if Rules[i].EventID=aAspectID then with Rules[i] do begin
  if (RequiredPrototype<>'') and (RequiredPrototype<>aPrototypeID) then Exit(False);
  if Kind=1 then Exit(aAfterEnglish=ExpectedPrefix+aBeforeEnglish);
  Exit(aAfterEnglish=ExpectedFixed);
 end;
 Exit(False);
end;
function RenderAspect(const aPrototypeID, aAspectID, aPriorPresentation: AnsiString): AnsiString;
var i: SizeInt;
begin
 for i:=0 to High(Rules) do if Rules[i].EventID=aAspectID then with Rules[i] do begin
  if (RequiredPrototype<>'') and (RequiredPrototype<>aPrototypeID) then Exit(aPriorPresentation);
  if Kind=1 then Exit(DRLText(SemanticID,EnglishTemplate,[DRLStringParam('name',aPriorPresentation)]));
  if Kind=2 then Exit(DRLText(SemanticID,EnglishTemplate,[DRLStringParam('assembly',DRLRegistryText('mod_array',AssemblyID,'base_game','name',AssemblyEnglish))]));
  Exit(DRLText(SemanticID,EnglishTemplate));
 end;
 Exit(aPriorPresentation);
end;
initialization
 DRLItemNameBaseValidator:=@ValidateBase;
 DRLItemNameTransitionValidator:=@ValidateTransition;
 DRLItemNameAspectRenderer:=@RenderAspect;
end.
`;
 return{unit,baseNames:bases.length,whitelistRules:rules.length,semanticIds:new Set(rules.map(r=>r.semanticID)).size};
}
